// ===== 纪要表合并：纯逻辑（分段 / 重排 / SQL 构造 / 状态机类型 / 自检） =====
// [LEGACY-MERGE · DB-ONLY] 仅真数据库模式可用。
// 瑟瑟台账接管时状态栏合并整块停用，合并由台账工作台「纪要合并」标签执行。
// 计划后续版本移除状态栏合并；删除本文件前确认 core/chronicle-rows.ts 仍保留
// （备忘录/人物世界书等只读功能依赖它）。
// 无 DOM 依赖；执行器（runMergeSession/commitMerge）见文件后半，经 callbacks 与渲染层解耦。
// 设计文档：docs/superpowers/specs/2026-07-26-chronicle-merge-design.md

import { readLocalJson } from './safe-json';
import { sqlColumnName, sqlTableName } from './db-schema-map';
import {
  sqlEscape,
  isSqliteMode,
  getAutoCardAPI,
  invalidateCache,
  queryLogicalTableRows,
  emitDbWriteCommitted,
} from './data-manager';
import { requestMerge } from './chronicle-merge-ai';
import { makeGenerationId, stopGenerationById } from './env';
import { beginAiActivity, endAiActivity, updateAiActivity } from './ai-activity';
import { AI_TEXT_FEATURE_LABEL } from './ai-text-features';
import { parseDateKeyFromText, parseDateKey, makeDate } from './calendar-core';
import { markMergedProducts, cumulativeMergeCount, getCurrentChatKeyOrNull } from './chronicle-merge-markers';
// 类型单源：行形状来自 chronicle-rows；但本文件保留一份本地读取副本，避免 DB 模式合并
// 的测试/旧调用多一条运行时依赖。新功能一律 import core/chronicle-rows.ts。
import type { ChronicleRow } from './chronicle-rows';
export type { ChronicleRow } from './chronicle-rows';

/** 段状态机。 */
export type SegmentStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'omitted';

export type MergeMode = 'fixedSize' | 'timeSpan';

export interface SegmentState {
  index: number;
  startRow: number; // 1-based 原表行号，含两端
  endRow: number;
  amRange: string; // 'AM0009~AM0013' 展示用
  origEntries: ChronicleRow[];
  status: SegmentStatus;
  retries: number;
  maxRetries: number;
  merged?: {
    summary: string;
    chronicle_text: string;
    key_dialogue: string;
    time_span: string; // JS 算好
  };
  error?: string;
}

export interface MergeSession {
  startRow: number;
  endRow: number;
  segmentSize: number;
  maxRetries: number;
  maxWords?: number;        // 软目标字数，默认 750
  mergeMode?: MergeMode;     // 默认 'fixedSize'
  thresholdHours?: number;  // timeSpan 模式用，默认 24
  /** 发起时的聊天键（防跨聊天提交/续跑）；旧存档/旧检查点无此字段＝无法校验，保持原行为。 */
  chatKey?: string;
  segments: SegmentState[];
  aborted: boolean;
  startedAt: number;
}

/** AI 单次尝试结果（chronicle-merge-ai.ts 实现）。 */
export interface MergeAttemptResult {
  ok: boolean;
  data?: { summary: string; chronicle_text: string; key_dialogue: string };
  error?: string;
}

/** 'AM0009' → 9；解析失败返回 0。 */
export function amNum(code: string): number {
  const m = /^AM(\d+)$/i.exec(String(code == null ? '' : code).trim());
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * 把 rows（全表，按 row_id 升序）中 [startRow, endRow] 范围切成每段 segmentSize 条。
 * 末段不足 segmentSize 单独成一段。返回段数组（仅中间段，不含 prefix/suffix）。
 */
export function computeSegments(
  rows: ChronicleRow[],
  startRow: number,
  endRow: number,
  segmentSize: number,
  maxRetries: number,
): SegmentState[] {
  const inRange = rows.filter(r => r.row_id >= startRow && r.row_id <= endRow);
  const segments: SegmentState[] = [];
  for (let i = 0; i < inRange.length; i += segmentSize) {
    const slice = inRange.slice(i, i + segmentSize);
    if (slice.length === 0) break;
    segments.push({
      index: segments.length,
      startRow: slice[0].row_id,
      endRow: slice[slice.length - 1].row_id,
      amRange: slice[0].code_index + '~' + slice[slice.length - 1].code_index,
      origEntries: slice,
      status: 'pending',
      retries: 0,
      maxRetries,
    });
  }
  return segments;
}

function makeTimeSeg(rows: ChronicleRow[], i: number, j: number, maxRetries: number, index: number): SegmentState {
  const slice = rows.slice(i, j + 1);
  return {
    index,
    startRow: slice[0].row_id,
    endRow: slice[slice.length - 1].row_id,
    amRange: slice[0].code_index + '~' + slice[slice.length - 1].code_index,
    origEntries: slice,
    status: 'pending',
    retries: 0,
    maxRetries,
  };
}

/**
 * 时间智能分段：从段首条起始时间起累积，加到第 N 条时跨度首次 >= thresholdHours → 段=[首..N]（含跨界条）。
 * j > i 守卫保证中间段 >=2 条；末段恰剩 1 条 → omitted。安全上限 20 条/段强制闭合。
 * 时间不可解析：并入当前段、不推进超界判定；segStart 用段内首个可解析 start。
 */
export function computeTimeSegments(
  rows: ChronicleRow[],
  startRow: number,
  endRow: number,
  thresholdHours: number,
  maxRetries: number,
): SegmentState[] {
  const inRange = rows.filter(r => r.row_id >= startRow && r.row_id <= endRow);
  const segments: SegmentState[] = [];
  const thresholdMs = thresholdHours * 3600000;
  let i = 0;
  while (i < inRange.length) {
    let segStart: Date | null = null;
    for (let k = i; k < inRange.length; k++) {
      segStart = parseChronicleTime(inRange[k].time_span, 'start');
      if (segStart) break;
    }
    let j = i;
    let closed = false;
    while (j < inRange.length) {
      if (j - i + 1 >= 20) {                       // 安全上限
        segments.push(makeTimeSeg(inRange, i, j, maxRetries, segments.length));
        i = j + 1; closed = true; break;
      }
      const curEnd = parseChronicleTime(inRange[j].time_span, 'end');
      if (curEnd && segStart && j > i && (curEnd.getTime() - segStart.getTime()) >= thresholdMs) {
        segments.push(makeTimeSeg(inRange, i, j, maxRetries, segments.length));
        i = j + 1; closed = true; break;
      }
      j++;
    }
    if (!closed) {
      segments.push(makeTimeSeg(inRange, i, inRange.length - 1, maxRetries, segments.length));
      i = inRange.length;
    }
  }
  for (const s of segments) {
    if (s.origEntries.length === 1) s.status = 'omitted';
  }
  return segments;
}

function splitTimeSpan(ts: string): { start: string; end: string } | null {
  const text = String(ts || '').trim();
  if (!text) return null;
  const idx = text.indexOf('~');
  // 单边时间跨度（首条纪要没有开始时间）：整串当结束、开始为空。
  // 只有开始没有结束（`开始 ~`）仍视为不可解析。
  if (idx < 0) return { start: '', end: text };
  const start = text.slice(0, idx).trim();
  const end = text.slice(idx + 1).trim();
  if (!end) return null;
  return { start, end };
}

/**
 * 取段内首条 time_span 的起始 ~ 末条 time_span 的结束。
 * 首条没有开始（台账首条纪要＝`~ 结束`）时输出 `~ 末条结束`；解析失败时回退首条原 time_span。
 */
export function jsMergeTimeSpan(entries: ChronicleRow[]): string {
  if (entries.length === 0) return '';
  if (entries.length === 1) return entries[0].time_span;
  const first = entries[0].time_span;
  const last = entries[entries.length - 1].time_span;
  const firstParts = splitTimeSpan(first);
  const lastParts = splitTimeSpan(last);
  if (lastParts) {
    // 首条没有开始（`~ 结束` 或单边旧形态）时保留空的开始：`~ 末条结束`
    return (firstParts?.start ? firstParts.start + ' ~ ' : '~ ') + lastParts.end;
  }
  return first; // 兜底
}

/**
 * 解析纪要 time_span 的某一侧（start/end）为 Date。
 * time_span 格式 'YYYY-MM-DD HH:MM ~ YYYY-MM-DD HH:MM'。
 * 日期用 calendar-core 短年份安全解析（makeDate 绕过 0-99→1900 陷阱，见 unified-statusbar-date-short-year-handling）。
 * 缺时间部分默认 00:00；解析失败返回 null。
 */
export function parseChronicleTime(timeSpan: string, side: 'start' | 'end'): Date | null {
  const parts = splitTimeSpan(timeSpan);
  if (!parts) return null;
  const raw = side === 'start' ? parts.start : parts.end;
  const dateKey = parseDateKeyFromText(raw);
  if (!dateKey) return null;
  const parsed = parseDateKey(dateKey);
  if (!parsed) return null;
  let hh = 0, mm = 0;
  const tm = raw.match(/(\d{1,2}):(\d{2})/);
  if (tm) {
    hh = parseInt(tm[1], 10);
    mm = parseInt(tm[2], 10);
    if (hh > 23 || mm > 59) return null;
  }
  const d = makeDate(parsed.year, parsed.month - 1, parsed.day);
  d.setHours(hh, mm, 0, 0);
  return d;
}

/**
 * 组装最终表：prefix 原样 + middle（待重排）+ suffix（待重排）。
 * row_id 与 code_index 连续重排：prefix 保留；middle+suffix 从 prefix 末尾 +1 起连续。
 * code_index 重排为 'AM' + 4 位零填充递增。
 */
export function renumberFinalTable(
  prefix: ChronicleRow[],
  middle: ChronicleRow[],
  suffix: ChronicleRow[],
): ChronicleRow[] {
  const lastPrefixRowId = prefix.length > 0 ? prefix[prefix.length - 1].row_id : 0;
  const lastPrefixAmNum = prefix.length > 0 ? amNum(prefix[prefix.length - 1].code_index) : 0;
  let nextRowId = lastPrefixRowId + 1;
  let nextAm = lastPrefixAmNum + 1;
  const renumber = (r: ChronicleRow): ChronicleRow => ({
    ...r,
    row_id: nextRowId++,
    code_index: 'AM' + String(nextAm++).padStart(4, '0'),
  });
  return [...prefix, ...middle.map(renumber), ...suffix.map(renumber)];
}

/**
 * 构造批量 SQL：DELETE middle+suffix（row_id >= cutRowId）+ 逐条 INSERT（row_id 自动 MAX+1）。
 * finalRows = middle+suffix（已 renumber；INSERT 用 MAX(row_id)+1 故 row_id 字段忽略，code_index/time_span/内容用 finalRows 的值）。
 * 返回语句数组；调用方 join(';\n') 后交 executeSqlBatch。
 */
export function buildMergeSql(finalRows: ChronicleRow[], cutRowId: number): string[] {
  // 表/列名走适配器：台账后端＝纪要表/中文列；真数据库后端＝jiyaobiao/物理列
  const table = sqlTableName('纪要表');
  const col = (header: string): string => sqlColumnName('纪要表', header) ?? header;
  const stmts: string[] = [`DELETE FROM ${table} WHERE row_id >= ${cutRowId}`];
  for (const r of finalRows) {
    stmts.push(
      `INSERT INTO ${table} (row_id, ${col('编码索引')}, ${col('时间跨度')}, ${col('概览')}, ${col('纪要')}, ${col('重要对话')}) VALUES (` +
        `(SELECT COALESCE(MAX(row_id), 0) + 1 FROM ${table}), ` +
        "'" + sqlEscape(r.code_index) + "', '" + sqlEscape(r.time_span) + "', " +
        "'" + sqlEscape(r.summary) + "', '" + sqlEscape(r.chronicle_text) + "', '" + sqlEscape(r.key_dialogue) + "')",
    );
  }
  return stmts;
}

/**
 * 校验最终行满足 chronicle 硬约束。返回首个错误或 null。
 * - summary ≤ 80 字符
 * - chronicle_text ≤ 750 字符
 * - code_index 全表唯一
 * - time_span 含 '~'
 */
export function validateFinalRows(rows: ChronicleRow[]): string | null {
  const seenAm = new Set<string>();
  for (const r of rows) {
    if (r.summary.length > 80) return '段 ' + r.code_index + ' 概览超长（' + r.summary.length + ' > 80）';
    if (r.chronicle_text.length > 750) return '段 ' + r.code_index + ' 纪要超长（' + r.chronicle_text.length + ' > 750）';
    if (r.time_span.indexOf('~') < 0) return '段 ' + r.code_index + ' 时间跨度格式错误';
    if (seenAm.has(r.code_index)) return '编码索引重复：' + r.code_index;
    seenAm.add(r.code_index);
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// localStorage checkpoint（防刷新崩溃恢复）
// ═══════════════════════════════════════════════════════════════

const SESSION_KEY = 'ub_chronicle_merge_session';

export function saveSessionCheckpoint(session: MergeSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* 配额满等，忽略——内存仍存活 */
  }
}

export function loadSessionCheckpoint(): MergeSession | null {
  // U33：收编 readLocalJson（原 !raw 与 ===null 语义在此等价：空串 parse 失败同落 null）
  return readLocalJson<MergeSession | null>(SESSION_KEY, null);
}

export function clearSessionCheckpoint(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

// ═══════════════════════════════════════════════════════════════
// 插件飞行模式（隐藏历史纪要）失效行 ID 清理
// ═══════════════════════════════════════════════════════════════

const FLIGHT_MODE_SCOPED_CONFIG_FIELD = 'TavernDB_ACU_ScopedConfig';

export interface FlightModeHiddenRowsPruneResult {
  prunedEntries: number;
  removedIds: number;
}

function resolveHostChatMetaContext(): { chat: unknown[]; chatMetadata: Record<string, any>; saveChat: () => Promise<void> } | null {
  if (typeof window === 'undefined') return null;
  const candidates: any[] = [];
  try { candidates.push((window as any).SillyTavern); } catch { /* ignore */ }
  try { candidates.push((window as any).parent?.SillyTavern); } catch { /* ignore */ }
  for (const st of candidates) {
    if (!st) continue;
    try {
      const ctx = typeof st.getContext === 'function' ? st.getContext() : st;
      const meta = ctx?.chat_metadata ?? ctx?.chatMetadata;
      if (ctx && Array.isArray(ctx.chat) && typeof ctx.saveChat === 'function' && meta && typeof meta === 'object') {
        return { chat: ctx.chat, chatMetadata: meta, saveChat: () => ctx.saveChat() };
      }
    } catch { /* try next */ }
  }
  return null;
}

/**
 * 清理数据库插件「飞行模式」聊天元数据里已失效的隐藏纪要行 ID。
 * 插件把隐藏行 row_id 存在 chat_metadata['TavernDB_ACU_ScopedConfig'].flightModeByIsolationKey
 * [隔离键].hiddenRowIds（chat[0] 有 legacy 镜像，写侧两处同写，对齐插件 setChatScoped
 * ConfigContainer_ACU）。合并/编号修复是 DELETE+重插，行身份全部重建；编号从 1 重排时
 * 新行必然落进旧 ID 区间，把「全隐藏」喂给填表 AI 会被插件误判成空表 → 重复初始化撞
 * jiyaobiao.code_index UNIQUE（2026-10 用户事故根因）。
 * 插件不公开隔离键，无法定位「当前」条目；hiddenRowIds 只对当前隔离条目生效，误清其他
 * 条目的后果仅是切换隔离配置后历史纪要重新可见（多耗 token，不丢数据），漏清则是填表
 * 连续报错——两害相权，对所有条目统一按幸存行集合裁剪。
 * survivingRowIds 为 null = 整表重排（全清）；否则只保留集合内 ID（合并幸存身份 = prefix 行）。
 * best-effort：宿主不可达 / 容器缺失 / 任何异常都不抛出；无删减不落盘；saveChat 失败回滚内存。
 */
export async function pruneStaleChronicleHiddenRowIds(
  survivingRowIds: ReadonlySet<string> | null,
): Promise<FlightModeHiddenRowsPruneResult | null> {
  let host: ReturnType<typeof resolveHostChatMetaContext> = null;
  let hadMetadataField = false;
  let prevMetadataField: any;
  let prevFirstField: any;
  let hadFirstField = false;
  let firstMsg: any = null;
  try {
    host = resolveHostChatMetaContext();
    if (!host) return null;
    // chat_metadata 为权威源；缺失时回退 chat[0] legacy 槽位（对齐插件读取序）。
    // 显式 any：typeof 收窄会把宿主数据收窄成 object 导致后续字段访问报错。
    let container: any = host.chatMetadata[FLIGHT_MODE_SCOPED_CONFIG_FIELD];
    if (!container || typeof container !== 'object') {
      firstMsg = host.chat[0] as any;
      container = firstMsg?.[FLIGHT_MODE_SCOPED_CONFIG_FIELD];
      if (!container || typeof container !== 'object') return null;
    }
    const map: any = container.flightModeByIsolationKey;
    if (!map || typeof map !== 'object' || Array.isArray(map)) return null;

    let removedIds = 0;
    let prunedEntries = 0;
    const nextMap: Record<string, any> = {};
    for (const [key, entry] of Object.entries(map) as [string, any][]) {
      if (!entry || typeof entry !== 'object' || !Array.isArray(entry.hiddenRowIds)) {
        nextMap[key] = entry;
        continue;
      }
      const kept = survivingRowIds === null
        ? []
        : entry.hiddenRowIds.filter((id: unknown) => survivingRowIds.has(String(id ?? '').trim()));
      const removed = entry.hiddenRowIds.length - kept.length;
      if (removed > 0) {
        removedIds += removed;
        prunedEntries++;
        nextMap[key] = { ...entry, hiddenRowIds: kept };
      } else {
        nextMap[key] = entry;
      }
    }
    if (removedIds === 0) return { prunedEntries: 0, removedIds: 0 };

    const nextContainer = { ...container, flightModeByIsolationKey: nextMap };
    // 快照旧值供 saveChat 失败回滚（内存不留「已清但未落盘」的中间态）。
    hadMetadataField = Object.prototype.hasOwnProperty.call(host.chatMetadata, FLIGHT_MODE_SCOPED_CONFIG_FIELD);
    prevMetadataField = host.chatMetadata[FLIGHT_MODE_SCOPED_CONFIG_FIELD];
    firstMsg = host.chat[0] as any;
    if (firstMsg && typeof firstMsg === 'object') {
      hadFirstField = Object.prototype.hasOwnProperty.call(firstMsg, FLIGHT_MODE_SCOPED_CONFIG_FIELD);
      prevFirstField = firstMsg[FLIGHT_MODE_SCOPED_CONFIG_FIELD];
    }
    host.chatMetadata[FLIGHT_MODE_SCOPED_CONFIG_FIELD] = nextContainer;
    if (firstMsg && typeof firstMsg === 'object') {
      firstMsg[FLIGHT_MODE_SCOPED_CONFIG_FIELD] = nextContainer;
    }
    await host.saveChat();
    return { prunedEntries, removedIds };
  } catch (e) {
    try {
      if (host) {
        if (hadMetadataField) host.chatMetadata[FLIGHT_MODE_SCOPED_CONFIG_FIELD] = prevMetadataField;
        else delete host.chatMetadata[FLIGHT_MODE_SCOPED_CONFIG_FIELD];
        if (firstMsg && typeof firstMsg === 'object') {
          if (hadFirstField) firstMsg[FLIGHT_MODE_SCOPED_CONFIG_FIELD] = prevFirstField;
          else delete firstMsg[FLIGHT_MODE_SCOPED_CONFIG_FIELD];
        }
      }
    } catch { /* 回滚失败只能放弃（advisory 状态，非用户数据） */ }
    console.warn('[纪要合并] 清理插件飞行模式失效隐藏行 ID 失败（不影响已提交的合并结果）：', e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 执行器（读表 / 段循环 / 组装 / 提交）
// ═══════════════════════════════════════════════════════════════

/**
 * 读纪要表并按 row_id 升序（[LEGACY-MERGE · DB-ONLY] 本地副本）。
 * 新功能请用 core/chronicle-rows.ts 的同名出口；本副本随状态栏合并一起删除。
 * 读取必须走 queryTableRows 兼容层，禁止回退到 raw querySql（数据库插件的表名映射坑）。
 * null 表示读取失败，[] 才表示真实空表。
 */
export function readChronicleRows(): ChronicleRow[] | null {
  const rawRows = queryLogicalTableRows({
    tableName: '纪要表',
    columns: ['row_id', '编码索引', '时间跨度', '概览', '纪要', '重要对话'],
    orderBy: { column: 'row_id', direction: 'ASC' },
  });
  if (rawRows === null) return null;
  return rawRows.map((r: any) => ({
    row_id: Number(r.row_id),
    code_index: String(r['编码索引'] ?? ''),
    time_span: String(r['时间跨度'] ?? ''),
    summary: String(r['概览'] ?? ''),
    chronicle_text: String(r['纪要'] ?? ''),
    key_dialogue: String(r['重要对话'] ?? ''),
  }));
}

export interface MergeCallbacks {
  /** 段状态变化时调（渲染该段卡片） */
  onSegmentUpdate: (s: SegmentState) => void;
  /** 全部段处理完（含被中断）调 → 弹完成/中断面板 */
  onAllDone: (session: MergeSession) => void;
  /** 每段前后检查是否已点中断 */
  shouldAbort: () => boolean;
}

const RETRY_BASE_DELAY_MS = 800;

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 串行跑所有 pending 段。每段最多 maxRetries 次重试（线性退避）。
 * 每段完成调 onSegmentUpdate + saveSessionCheckpoint。
 * 全部处理完或被中断 → onAllDone。
 * 注：success/skipped 段跳过（支持「继续未完成」/「重新生成选中」重入）。
 */
export async function runMergeSession(session: MergeSession, cb: MergeCallbacks): Promise<void> {
  // 聊天归属守卫：合并 session 跨多次 AI 请求；期间切聊天 → 停止续跑（已生成段留在 session/检查点，
  // 切回原聊天可继续；绝不把旧聊天的段结果续到新聊天）。
  const stillCurrent = (): boolean => !session.chatKey || getCurrentChatKeyOrNull() === session.chatKey;
  // 统一 AI 活动：纪要合并有专属弹窗进度 ⇒ 只上提示条与悬浮钮动效（suppressToast）。
  const activity = beginAiActivity({
    label: AI_TEXT_FEATURE_LABEL.chronicleMerge,
    phase: 'preparing',
    chatKey: session.chatKey || '',
    cancelable: true,
    suppressToast: true,
    cancel: () => {
      updateAiActivity(activity.id, { phase: 'terminating' });
      abortCurrentMerge();
      if (_mergeGenerationId) stopGenerationById(_mergeGenerationId);
    },
  });
  try {
  for (const s of session.segments) {
    if (s.status === 'success' || s.status === 'skipped' || s.status === 'omitted') continue;
    if (!stillCurrent()) {
      session.aborted = true;
      for (const rest of session.segments) {
        if (rest.status === 'pending') {
          rest.status = 'skipped';
          cb.onSegmentUpdate(rest);
        }
      }
      break;
    }
    if (cb.shouldAbort() || session.aborted) {
      if (s.status === 'pending') {
        s.status = 'skipped';
        cb.onSegmentUpdate(s);
      }
      continue;
    }
    s.status = 'running';
    cb.onSegmentUpdate(s);
    let attempt = 0;
    while (attempt <= s.maxRetries) {
      if (cb.shouldAbort() || session.aborted) break;
      _mergeGenerationId = makeGenerationId('ub-merge');
      activity.update({ phase: 'requesting', attempt: attempt + 1, maxAttempts: s.maxRetries + 1 });
      const r = await requestMerge(s.origEntries, session.maxWords ?? 750, { generationId: _mergeGenerationId });
      _mergeGenerationId = '';
      if (r.ok && r.data) {
        s.merged = { ...r.data, time_span: jsMergeTimeSpan(s.origEntries) };
        s.status = 'success';
        s.error = undefined;
        break;
      }
      // 用户终止/切聊天：当前段尚未合并成功但也不是「失败」，按跳过收口（不算重试、不报红）
      if (cb.shouldAbort() || session.aborted) {
        s.status = 'skipped';
        s.error = undefined;
        break;
      }
      attempt++;
      s.retries = attempt;
      s.error = r.error || '未知错误';
      if (attempt > s.maxRetries) {
        s.status = 'failed';
        break;
      }
      await wait(RETRY_BASE_DELAY_MS * attempt);
    }
    cb.onSegmentUpdate(s);
    saveSessionCheckpoint(session);
    if (cb.shouldAbort() || session.aborted) {
      for (let j = s.index + 1; j < session.segments.length; j++) {
        if (session.segments[j].status === 'pending') {
          session.segments[j].status = 'skipped';
          cb.onSegmentUpdate(session.segments[j]);
        }
      }
      break;
    }
  }
  saveSessionCheckpoint(session);
  cb.onAllDone(session);
  } finally {
    _mergeGenerationId = '';
    endAiActivity(activity.id);
  }
}

/**
 * 根据 session 组装最终表行（prefix + middle + suffix，已 renumber）。
 * middle：success 段→1 merged 行；未完成段→原条目（保留内容，参与重排）。
 */
export function assembleFinalRows(allRows: ChronicleRow[], session: MergeSession): ChronicleRow[] {
  const prefix = allRows.filter(r => r.row_id < session.startRow);
  const suffix = allRows.filter(r => r.row_id > session.endRow);
  const middle: ChronicleRow[] = [];
  for (const s of session.segments) {
    if (s.status === 'success' && s.merged) {
      middle.push({
        row_id: 0,
        code_index: '', // renumber 会填
        time_span: s.merged.time_span,
        summary: s.merged.summary,
        chronicle_text: s.merged.chronicle_text,
        key_dialogue: s.merged.key_dialogue,
      });
    } else {
      // 未完成段：保留原条目（内容不变，row_id/code_index 由 renumber 重排）
      for (const orig of s.origEntries) middle.push(orig);
    }
  }
  return renumberFinalTable(prefix, middle, suffix);
}

/**
 * 记录合并产物标记（不碰数据库；按 chatKey 作用域，标记 store 失败不影响提交结果）。
 * 几合一 = 累计原始轮数：Σ(段内每条 origEntry 旧计数 ?? 1)，用 origEntry 的时间跨度反查旧标记；
 * 新产物按时间跨度（首条起始 ~ 末条结束）落标记。同一时间跨度再合并时覆盖为最新累计。
 * 修剪：提交后重读当前纪要表各行 time_span 作存活集，被合并掉/删除的旧产物标记随之移除
 * （无陈旧残留）。时间跨度身份不受内容编辑/换模型影响，也不存在指纹方案的读漂移误删。
 */
function recordMergeMarkers(session: MergeSession): void {
  try {
    // 归属优先取 session 发起时的聊天键；旧 session 无键才回退当前聊天（保持原行为）。
    const chatKey = session.chatKey || getCurrentChatKeyOrNull();
    if (!chatKey) return;
    const newMerged = session.segments
      .filter(s => s.status === 'success' && s.merged)
      .map(s => ({
        time_span: s.merged!.time_span,
        count: cumulativeMergeCount(chatKey, s.origEntries),
      }));
    const liveTimeSpans = readChronicleLiveTimeSpans(getAutoCardAPI());
    markMergedProducts(chatKey, newMerged, liveTimeSpans);
  } catch {
    /* 标记 store 失败不影响合并提交结果 */
  }
}

/**
 * 提交后重读当前纪要表各行 time_span（渲染同款数据源 exportTableAsJson），作标记修剪存活集。
 * 只取 time_span 一列——time_span 是非空简单字符串，不涉及旧指纹方案 key_dialogue 读漂移问题。
 */
function readChronicleLiveTimeSpans(api: any): string[] {
  let all: any;
  try {
    all = api?.exportTableAsJson?.();
  } catch {
    return [];
  }
  if (!all || typeof all !== 'object') return [];
  for (const key in all) {
    if (!key.startsWith('sheet_')) continue;
    const sheet = all[key];
    if (!sheet || !Array.isArray(sheet.content)) continue;
    const isChronicle =
      key === 'sheet_summary' ||
      String(sheet.key || '') === 'sheet_summary' ||
      String(sheet.name || '') === '纪要表';
    if (!isChronicle) continue;
    const headers = (sheet.content[0] || []).map((h: any, i: number) =>
      String(h == null ? '' : h).trim() || ('列' + (i + 1)));
    const ti = findTimeSpanCol(headers);
    const out: string[] = [];
    for (const row of sheet.content.slice(1)) {
      if (!Array.isArray(row)) continue;
      out.push(String(row[ti >= 0 ? ti : 0] ?? ''));
    }
    return out;
  }
  return [];
}

function findTimeSpanCol(headers: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] ?? '').trim().toLowerCase();
    if (h === '时间跨度' || h === 'time_span') return i;
  }
  return -1;
}

/**
 * 提交合并：读真表 → 组装最终行 → 硬约束预校 → 一次 executeSqlBatch（DELETE+INSERT）→ 收尾。
 * 返回 {ok, error?}。失败时原表不变（executeSqlBatch 原子性，见 spec §8 待验证）。
 * 注：DELETE WHERE row_id >= session.startRow 删 middle+suffix；合并期间外部向纪要表插新行会被
 * 一并删除——靠警告弹窗「完成前勿推进对话」规避（spec §8 待验证项）。
 */
export async function commitMerge(session: MergeSession): Promise<{ ok: boolean; error?: string }> {
  // 聊天归属守卫：session 里的段结果是旧聊天 AI 生成的；切走后当前纪要表已换人，
  // 绝不能拿旧段去 DELETE/INSERT 新聊天的表（旧 session 无 chatKey 时保持原行为）。
  if (session.chatKey && getCurrentChatKeyOrNull() !== session.chatKey) {
    return { ok: false, error: '聊天已切换，本次合并结果已失效，请回到原聊天继续或重新开始' };
  }
  if (!isSqliteMode()) return { ok: false, error: '非 SQLite 模式，不支持合并提交' };
  const api = getAutoCardAPI();
  const allRows = readChronicleRows();
  if (allRows === null) return { ok: false, error: '纪要表读取失败，请稍后重试' };
  if (allRows.length === 0) return { ok: false, error: '纪要表为空' };
  // 校验范围仍有效（防止合并期间行数变化致范围失效）
  const minRowId = allRows[0].row_id;
  const maxRowId = allRows[allRows.length - 1].row_id;
  if (session.startRow < minRowId || session.endRow > maxRowId) {
    return { ok: false, error: '纪要表行数已变化，合并范围失效，请取消并重新选择' };
  }
  // 组装最终行
  const finalRows = assembleFinalRows(allRows, session);
  // 硬约束预校
  const err = validateFinalRows(finalRows);
  if (err) return { ok: false, error: '预校失败：' + err + '（请重新生成对应段）' };
  // 构造 SQL：DELETE row_id >= middle 起点原 row_id；INSERT middle+suffix（按 renumber 顺序，row_id 由 MAX+1 自动递增）
  const cutRowId = session.startRow;
  const prefixCount = allRows.filter(r => r.row_id < session.startRow).length;
  const toInsert = finalRows.slice(prefixCount); // middle + suffix（已 renumber）
  const stmts = buildMergeSql(toInsert, cutRowId);
  // 一次执行（透传 targetSheetKeys 精确锁范围）
  try {
    const r: any = await api.executeSqlBatch({ sql: stmts.join(';\n'), targetSheetKeys: ['sheet_summary'] });
    if (!r?.success) {
      return { ok: false, error: '写入失败：' + (r?.errors?.join(';') || 'executeSqlBatch 返回 success=false') + '（原表未变）' };
    }
  } catch (e: any) {
    return { ok: false, error: '写入异常：' + String(e?.message || e) + '（原表未变）' };
  }
  // 收尾
  invalidateCache();
  emitDbWriteCommitted?.();
  try {
    api._notifyTableUpdate?.();
  } catch {
    /* ignore */
  }
  // 插件飞行模式失效行 ID 清理（详见 pruneStaleChronicleHiddenRowIds 注释）：
  // 幸存身份 = 未被合并触碰的 prefix 行（row_id < startRow）；best-effort，不影响合并结果。
  const survivingRowIds = new Set(allRows.filter(r => r.row_id < session.startRow).map(r => String(r.row_id)));
  await pruneStaleChronicleHiddenRowIds(survivingRowIds);
  // 记录合并产物标记（不碰数据库；按 chatKey 作用域，标记 store 失败不影响提交结果）。
  // 几合一 = 累计原始轮数；新产物按 time_span 落标记，并按当前表做 time_span 集合差修剪（无陈旧残留）。
  recordMergeMarkers(session);
  clearSessionCheckpoint();
  clearCurrentMerge();
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
// 后台任务管理（与 UI 解耦：界面关闭后进程继续，仅 abortCurrentMerge 能终止）
// 再进入合并按钮时从 getCurrentMergeSession 恢复视图。
// ═══════════════════════════════════════════════════════════════

let _runningSession: MergeSession | null = null;
let _isRunning = false; // runMergeSession 是否在跑（区别于 _runningSession 保留待提交）
let _abortFlag = false;
let _mergeGenerationId = ''; // 当前段 generateRaw 请求标识（注册表取消时 stopGenerationById）
type SessionListener = (session: MergeSession) => void;
const _progressListeners = new Set<SessionListener>();
const _completeListeners = new Set<SessionListener>();

/** 是否有活跃合并任务（运行中 或 已完成待提交）。 */
export function isChronicleMergeActive(): boolean {
  return _runningSession !== null;
}

/** 合并循环是否正在跑（区别于"已完成待提交"）。 */
export function isChronicleMergeRunning(): boolean {
  return _isRunning;
}

/** 取当前后台任务 session（恢复视图用）。 */
export function getCurrentMergeSession(): MergeSession | null {
  return _runningSession;
}

/** 中断当前后台合并（runMergeSession 在当前段跑完后停止）。 */
export function abortCurrentMerge(): void {
  _abortFlag = true;
  if (_runningSession) _runningSession.aborted = true;
}

/** 清除当前任务（提交成功 / 放弃后调）。 */
export function clearCurrentMerge(): void {
  _runningSession = null;
  _isRunning = false;
  _abortFlag = false;
}

/** 订阅段进度更新，返回退订函数。 */
export function onMergeProgress(fn: SessionListener): () => void {
  _progressListeners.add(fn);
  return () => {
    _progressListeners.delete(fn);
  };
}

/** 订阅全部完成，返回退订函数。 */
export function onMergeComplete(fn: SessionListener): () => void {
  _completeListeners.add(fn);
  return () => {
    _completeListeners.delete(fn);
  };
}

/**
 * 启动后台合并循环（与 UI 解耦）。runMergeSession 跳过 success/skipped，只跑 pending；
 * 支持重复调用（继续未完成 / 重新生成选中）：每次重置 _abortFlag=false 并重跑。
 */
export async function startBackgroundMerge(session: MergeSession): Promise<void> {
  _runningSession = session;
  _isRunning = true;
  _abortFlag = false;
  session.aborted = false;
  try {
    await runMergeSession(session, {
      onSegmentUpdate: () => {
        _progressListeners.forEach(fn => fn(session));
      },
      onAllDone: sess => {
        _isRunning = false;
        _completeListeners.forEach(fn => fn(sess));
      },
      shouldAbort: () => _abortFlag,
    });
  } finally {
    _isRunning = false;
  }
}

/**
 * 一键修复纪要编号：把全表 row_id 重排为 1,2,3… 连续、code_index 重排为 AM0001,AM0002… 连续，二者顺序对齐。
 * 内容字段（time_span/summary/chronicle_text/key_dialogue）一字不动；零内容校验。
 * 整表 DELETE+INSERT 一次 executeSqlBatch 原子写，失败则原表不变。
 * <2 条直接返回（无断号可能，省一次写库）。
 */
export async function repairChronicleNumbering(): Promise<{ ok: boolean; error?: string }> {
  if (!isSqliteMode()) return { ok: false, error: '非 SQLite 模式，不支持修复编号' };
  const api = getAutoCardAPI();
  const allRows = readChronicleRows();
  if (allRows === null) return { ok: false, error: '纪要表读取失败，请稍后重试' };
  if (allRows.length < 2) return { ok: false, error: '纪要表不足 2 条，无需修复编号' };
  // 整表重排：空 prefix + 全表作 middle + 空 suffix → 从 row_id=1 / AM0001 起连续
  const renumbered = renumberFinalTable([], allRows, []);
  const minRowId = allRows[0].row_id; // 最小 row_id → DELETE 删全表
  const stmts = buildMergeSql(renumbered, minRowId);
  try {
    const r: any = await api.executeSqlBatch({ sql: stmts.join(';\n'), targetSheetKeys: ['sheet_summary'] });
    if (!r?.success) {
      return { ok: false, error: '写入失败：' + (r?.errors?.join(';') || 'executeSqlBatch 返回 success=false') + '（原表未变）' };
    }
  } catch (e: any) {
    return { ok: false, error: '写入异常：' + String(e?.message || e) + '（原表未变）' };
  }
  invalidateCache();
  emitDbWriteCommitted?.();
  try {
    api._notifyTableUpdate?.();
  } catch {
    /* ignore */
  }
  // 整表重排：旧隐藏 ID 无一幸存且与新 ID 区间重叠，必须全清（best-effort，不影响本次写库结果）。
  await pruneStaleChronicleHiddenRowIds(null);
  return { ok: true };
}
