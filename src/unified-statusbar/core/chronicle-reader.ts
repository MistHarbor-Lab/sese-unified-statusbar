// ===== 剧情回顾：分页、时间跨度与只读自动关联 =====
import { queryLogicalTablePage, getSheetByName, getSheetsContentRevision, getSheetCacheChatKey } from './data-manager';
import { formatDateKey, isGregorianLeapYear } from './calendar-core';

export interface ChronicleAutoTag { kind: 'person' | 'location'; name: string; nodeId?: string; }
export interface ChronicleRowRef { rowId: number; timeSpan: string; summary: string; chronicleText: string; keyDialogue: string; tags: ChronicleAutoTag[]; }
export interface ChroniclePageResult { items: ChronicleRowRef[]; hasNext: boolean; loadedCount: number; }
export interface ChronicleLocationCandidate { name: string; nodeId: string; excluded?: boolean; }
export interface ChronicleDialogueLine { speaker: string; text: string; raw?: string; }
export interface ChronicleReaderSource { readPage: (offset: number, limit: number) => Record<string, unknown>[] | null; people: string[]; protagonist?: string; locations: ChronicleLocationCandidate[]; }

const PAGE_SIZE = 10;

/** 按模板的一行一句结构解析；旧数据无法拆分时完整保留。
 *  分隔符：真实换行、字面量 `\n`（数据库常把换行存成反斜杠+n 两字符）、中英文分号。 */
export function parseKeyDialogue(raw: string): ChronicleDialogueLine[] {
  return String(raw || '').split(/(?:\r?\n|\\n|[；;])/).map(value => value.trim()).filter(Boolean).map(value => {
    const separator = value.search(/[:：]/);
    if (separator <= 0) return { speaker: '', text: value, raw: value };
    const speaker = value.slice(0, separator).trim();
    const text = value.slice(separator + 1).trim();
    if (!speaker || !text) return { speaker: '', text: value, raw: value };
    return { speaker, text };
  });
}

function dateNumber(key: string): number | null {
  const m = String(key || '').match(/^(-?\d{1,6})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const year = Number(m[1]); const month = Number(m[2]); const day = Number(m[3]);
  // F3：用 setUTCFullYear 绕过 Date.UTC 对 0-99 年按 1900+ 偏移的陷阱（虚构短年份如 3、21
  // 会被当成 1903/1921 → 校验恒失败 → 短纪年的日期筛选/打点静默全哑）。
  // 同款先例：cycle-profile.ts dateKeyToEpochDay。
  const date = new Date(Date.UTC(2000, month - 1, day));
  date.setUTCFullYear(year);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.getTime() : null;
}

/** F3：dateKey → {year, month}（负年份/短年份安全）；不认的 key 返回 null。
 *  「选择日期」弹层专用——绝不兜底现实时钟（公元前/无日期时兜到玩家真实年月 = 选不中任何纪要）。 */
export function chronicleYearMonthOfKey(key: string): { year: number; month: number } | null {
  const m = /^(-?\d{1,6})-(\d{1,2})-\d{1,2}$/.exec(String(key || ''));
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

/** F3：月网格（虚构纪年安全）——该月第一天周几（0=周日）与当月天数。
 *  new Date(year,…) 对 0-99 年按 1900+ 解释、翻月 getFullYear() 会读回 20 世纪，
 *  firstDay 全程 UTC+setUTCFullYear 与 cycle-profile 同一纪律（1 号恒存在，无滚动风险）；
 *  count 用纯算术——setUTCFullYear 在「2 月 29 日不存在」时会滚动到 3 月 1 日（实测 0003-02 得 1）。 */
export function chronicleMonthGrid(year: number, month: number): { firstDay: number; count: number } {
  const first = new Date(Date.UTC(2000, month - 1, 1));
  first.setUTCFullYear(year);
  const counts = [31, isGregorianLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return { firstDay: first.getUTCDay(), count: counts[month - 1] };
}

function dateFromText(value: string): string | null {
  // 三捕获组直接取年月日（不依赖 split('-')，负 key 首段为空串），年份带符号、幅值至少 4 位补零
  const m = String(value || '').match(/(-?\d{1,6})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  // U32：拼装收编 formatDateKey（口径一致：带符号年份 + 幅值至少 4 位补零）
  return formatDateKey(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
}

/** 时间跨度的日期区间：开始为空（首条纪要 `~ 结束` / 单边旧形态）时按结束日期单点覆盖。 */
function spanDateRange(timeSpan: string): { start: string; end: string } | null {
  const pieces = String(timeSpan || '').split('~');
  if (pieces.length === 1) {
    const point = dateFromText(pieces[0]);
    return point ? { start: point, end: point } : null;
  }
  if (pieces.length !== 2) return null;
  const end = dateFromText(pieces[1]);
  if (!end) return null;
  const start = dateFromText(pieces[0]) || end;
  return { start, end };
}

export function timeSpanCoversDate(timeSpan: string, dateKey: string): boolean {
  const range = spanDateRange(timeSpan);
  const target = dateNumber(dateKey);
  if (!range || target === null) return false;
  const startValue = dateNumber(range.start); const endValue = dateNumber(range.end);
  return startValue !== null && endValue !== null && startValue <= target && target <= endValue;
}

export function derivePeopleTags(text: string, candidates: string[], protagonist = ''): ChronicleAutoTag[] {
  const source = String(text || '');
  const seen = new Set<string>();
  return candidates.reduce<ChronicleAutoTag[]>((tags, raw) => {
    const name = String(raw || '').trim();
    if (!name || name === protagonist || seen.has(name) || !source.includes(name)) return tags;
    seen.add(name); tags.push({ kind: 'person', name }); return tags;
  }, []);
}

export function deriveLocationTags(text: string, candidates: ChronicleLocationCandidate[]): ChronicleAutoTag[] {
  const source = String(text || '');
  const grouped = new Map<string, ChronicleLocationCandidate[]>();
  for (const raw of candidates) {
    const name = String(raw.name || '').trim();
    if (!name || raw.excluded) continue;
    const list = grouped.get(name) || []; list.push(raw); grouped.set(name, list);
  }
  const tags: ChronicleAutoTag[] = [];
  for (const [name, matches] of grouped) {
    if (matches.length !== 1 || !matches[0].nodeId || !source.includes(name)) continue;
    // 完整链条不作为词条：候选名称自身不可含层级连接符。
    if (/[>＞—–-]/.test(name)) continue;
    tags.push({ kind: 'location', name, nodeId: matches[0].nodeId });
  }
  return tags;
}

function toRow(raw: Record<string, unknown>, source: ChronicleReaderSource): ChronicleRowRef {
  // 列名一律中文（台账口径）；真数据库后端的物理列名由 data-manager 按请求顺序归一
  const summary = String(raw['概览'] ?? '');
  const chronicleText = String(raw['纪要'] ?? '');
  const keyDialogue = String(raw['重要对话'] ?? '');
  const allText = `${summary}\n${chronicleText}\n${keyDialogue}`;
  return {
    rowId: Number(raw.row_id), timeSpan: String(raw['时间跨度'] ?? ''), summary, chronicleText, keyDialogue,
    tags: [...derivePeopleTags(allText, source.people, source.protagonist), ...deriveLocationTags(allText, source.locations)],
  };
}

export interface ChronicleReaderController {
  reset(dateKey?: string): Promise<ChroniclePageResult>;
  loadNext(): Promise<ChroniclePageResult>;
  getCachedDetail(rowId: number): ChronicleRowRef | null;
  getLoaded(): ChronicleRowRef[];
  searchAll(text: string, signal: AbortSignal): Promise<ChronicleRowRef[]>;
  invalidate(): void;
}

export function createChronicleReaderController(source: ChronicleReaderSource): ChronicleReaderController {
  let loaded: ChronicleRowRef[] = [];
  let offset = 0;
  let hasNext = true;
  let activeDate = '';
  const detailCache = new Map<number, ChronicleRowRef>();
  // 筛选某一日期时，命中的纪要可能远早于最新 30 条。分批读取并让出一帧，
  // 直到凑够一屏或读完为止；普通模式始终只读一个页面。
  const yieldToBrowser = (): Promise<void> => new Promise(resolve => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
  const read = async (): Promise<ChroniclePageResult> => {
    if (!hasNext) return { items: [], hasNext, loadedCount: loaded.length };
    const page: ChronicleRowRef[] = [];
    do {
      const raw = source.readPage(offset, PAGE_SIZE);
      if (raw === null) { hasNext = false; break; }
      offset += raw.length;
      hasNext = raw.length === PAGE_SIZE;
      const matched = raw.map(row => toRow(row, source)).filter(row => !activeDate || timeSpanCoversDate(row.timeSpan, activeDate));
      page.push(...matched);
      // 非筛选模式恰好一页即停；日期筛选则渐进扫描，不在一个长任务里阻塞界面。
      if (!activeDate || page.length >= PAGE_SIZE || !hasNext) break;
      await yieldToBrowser();
    } while (hasNext);
    loaded.push(...page);
    page.forEach(row => detailCache.set(row.rowId, row));
    return { items: page, hasNext, loadedCount: loaded.length };
  };
  return {
    async reset(dateKey = '') { loaded = []; detailCache.clear(); offset = 0; hasNext = true; activeDate = dateKey; return read(); },
    async loadNext() { return read(); },
    getCachedDetail(rowId) { return detailCache.get(rowId) || null; },
    getLoaded() { return loaded.slice(); },
    async searchAll(text, signal) {
      const keyword = String(text || '').trim();
      if (!keyword || signal.aborted) return [];
      let searchOffset = 0;
      const matches: ChronicleRowRef[] = [];
      while (!signal.aborted) {
        const raw = source.readPage(searchOffset, 100);
        if (raw === null) return [];
        const page = raw.map(row => toRow(row, source)).filter(row => {
          const searchable = `${row.summary}\n${row.chronicleText}\n${row.keyDialogue}`;
          return searchable.includes(keyword);
        });
        page.forEach(row => detailCache.set(row.rowId, row));
        matches.push(...page);
        if (raw.length < 100) break;
        searchOffset += raw.length;
        await yieldToBrowser();
      }
      return signal.aborted ? [] : matches;
    },
    invalidate() { loaded = []; detailCache.clear(); offset = 0; hasNext = true; activeDate = ''; },
  };
}

/** 标准数据源：打开阅读器或主动刷新时才调用。 */
export function createDefaultChronicleReaderSource(
  people: string[],
  locations: ChronicleLocationCandidate[],
): ChronicleReaderSource {
  return {
    people,
    locations,
    readPage(offset, limit) {
      return queryLogicalTablePage({ tableName: '纪要表', columns: ['row_id', '时间跨度', '概览', '纪要', '重要对话'], orderBy: { column: 'row_id', direction: 'DESC' }, limit, offset });
    },
  };
}

/**
 * 日历仅在用户选中某天后调用。逐页统计而非一次性读表，避免月份切换产生额外 I/O。
 * token 由调用方校验，因而旧选择日期的异步结果不会覆写新详情。
 * O32：可选 `abort`——外部置 `aborted=true` 后循环在下一页前退出并返回 null（调用方丢弃结果）。
 */
export async function countChroniclesForDate(
  dateKey: string,
  source: Pick<ChronicleReaderSource, 'readPage'>,
  abort?: ChronicleCountAbort,
): Promise<number | null> {
  let offset = 0;
  let count = 0;
  while (true) {
    if (abort?.aborted) return null; // 中止检查放循环头：置位后不再读下一页（连点不陪跑）
    const raw = source.readPage(offset, 100);
    if (raw === null) return abort?.aborted ? null : 0;
    count += raw.filter(row => timeSpanCoversDate(String(row['时间跨度'] ?? ''), dateKey)).length;
    if (raw.length < 100) return count;
    offset += raw.length;
    await new Promise<void>(resolve => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
      else setTimeout(resolve, 0);
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// O32：日期计数「内存直算 + 指纹缓存 + 在飞取消」
//   旧行为：每次点日期都从第 0 页逐页读整张纪要表（100 行/页、每页等一帧）——2000 行表要 ~300ms
//   才出「当日 N 条」，且连点日期会并发多份扫描、谁也不取消（token 只防旧结果覆盖，不防白做工）。
//   新行为：①优先用表格缓存（内存）直算——零宿主查询、零帧等待；
//           ②结果按「聊天 + 纪要表内容修订 + 表指纹 + 日期」缓存，表没变时再点即时出数；
//           ③表缓存不可用/列不认识时回落分页源，并带中止句柄（新点击立刻中止上一轮）。
// ═══════════════════════════════════════════════════════════════

/** O32：计数扫描的中止句柄（外部置 aborted=true；返回 null 表示本轮作废）。 */
export interface ChronicleCountAbort { aborted: boolean }

const CHRONICLE_TABLE_NAME = '纪要表';
const COUNT_CACHE_MAX = 32;
/** 日期 → 条数缓存（键含聊天/内容修订/表指纹，表一变即自然失效，不存陈旧值）。 */
const _countCache = new Map<string, number>();
/** 在飞扫描单槽：同键复用（连点同一天不重复扫）、异键中止（连点不同天只跑最新一轮）。 */
let _countScan: { aborted: boolean; key: string; promise: Promise<number | null> } | null = null;

/** @internal 测试缝：清空缓存与在飞扫描。 */
export function __resetChronicleCountCacheForTests(): void {
  _countCache.clear();
  if (_countScan) _countScan.aborted = true;
  _countScan = null;
}

/**
 * O32：从表格缓存（内存）统计某日纪要条数——列口径与 rowsFromChronicleSheet 一致（中文表头「时间跨度」）。
 * 表/列不可识别时返回 null（调用方回落分页源）；不抛错。
 */
export function countChroniclesForDateFromSheet(dateKey: string, sheet: unknown): number | null {
  const content = (sheet as { content?: unknown } | null | undefined)?.content;
  if (!Array.isArray(content) || content.length < 2) return null;
  const header = content[0];
  if (!Array.isArray(header)) return null;
  const colIdx = header.indexOf('时间跨度');
  if (colIdx < 0) return null;
  let count = 0;
  for (let i = 1; i < content.length; i++) {
    const row = content[i];
    if (!Array.isArray(row)) continue;
    if (timeSpanCoversDate(String(row[colIdx] ?? ''), dateKey)) count++;
  }
  return count;
}

/**
 * O32：纪要表指纹（O(1)）——行数 + 首/末行「时间跨度」。行数变化（追加/删除）与首末行改写即失效。
 * 边界（与通知徽章 O7 指纹同族）：不改行数、也不动首末行的「中间行原地编辑」不击穿指纹；
 * 时间锚定对中间行的回写会推进表格内容修订号（data-manager），故缓存键把它一并并入，堵住该缺口。
 */
export function chronicleSheetCountFingerprint(sheet: unknown): string {
  const content = (sheet as { content?: unknown } | null | undefined)?.content;
  if (!Array.isArray(content) || content.length < 2) return 'empty';
  const header = Array.isArray(content[0]) ? content[0] : [];
  const colIdx = header.indexOf('时间跨度');
  const cell = (row: unknown): string => (Array.isArray(row) && colIdx >= 0 ? String(row[colIdx] ?? '') : '');
  return `${content.length}|${cell(content[1])}|${cell(content[content.length - 1])}`;
}

/** 缓存键：聊天（表缓存归属）+ 内容修订（我们的就地写）+ 表指纹 + 日期。 */
function countScopeKey(dateKey: string): { key: string; sheet: unknown } {
  const sheet = getSheetByName(CHRONICLE_TABLE_NAME);
  const scope = `${getSheetCacheChatKey()}\u0001${getSheetsContentRevision()}\u0001${chronicleSheetCountFingerprint(sheet)}`;
  return { key: `${scope}\u0001${dateKey}`, sheet };
}

function rememberChronicleCount(key: string, count: number): void {
  if (_countCache.size >= COUNT_CACHE_MAX) _countCache.clear();
  _countCache.set(key, count);
}

/**
 * O32：日历「当日 N 条纪要」的唯一入口（缓存/直算/回落/取消都在这里）。
 * 返回 null = 本轮被更新的点击取消（调用方丢弃）。
 */
export async function countChroniclesForDateCached(
  dateKey: string,
  source: Pick<ChronicleReaderSource, 'readPage'>,
): Promise<number | null> {
  const { key, sheet } = countScopeKey(dateKey);
  const hit = _countCache.get(key);
  if (hit !== undefined) return hit;
  const fast = countChroniclesForDateFromSheet(dateKey, sheet);
  if (fast !== null) {
    rememberChronicleCount(key, fast);
    return fast;
  }
  let scan = _countScan;
  if (!scan || scan.aborted || scan.key !== key) {
    if (scan) scan.aborted = true; // 异键（或已作废）⇒ 中止上一轮，只跑最新一轮
    const next: { aborted: boolean; key: string; promise: Promise<number | null> } = {
      aborted: false, key, promise: Promise.resolve<number | null>(null),
    };
    next.promise = countChroniclesForDate(dateKey, source, next);
    _countScan = next;
    scan = next;
  }
  const count = await scan.promise;
  if (scan.aborted || count === null) return null;
  if (_countScan === scan) _countScan = null;
  rememberChronicleCount(key, count);
  return count;
}

/**
 * 剧情回顾日期选择器：返回某月内所有被纪要「时间跨度」覆盖的日期键集合（YYYY-MM-DD）。
 * 整表逐页扫描一次，逐条把「时间跨度」与目标月取交集后展开成日期键。
 * 调用方按 (year,month) 缓存，避免来回翻月重复 I/O；无安全早退，必须扫完。
 */
export async function listChronicleDatesInMonth(
  year: number,
  month: number,
  source: Pick<ChronicleReaderSource, 'readPage'>,
): Promise<Set<string>> {
  const days = new Set<string>();
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month - 1, new Date(Date.UTC(year, month, 0)).getUTCDate());
  let offset = 0;
  while (true) {
    const raw = source.readPage(offset, 100);
    if (raw === null) break;
    for (const row of raw) {
      const range = spanDateRange(String(row['时间跨度'] ?? ''));
      if (!range) continue;
      const start = dateNumber(range.start); const end = dateNumber(range.end);
      if (start === null || end === null) continue;
      const clampedStart = Math.max(start, monthStart);
      const clampedEnd = Math.min(end, monthEnd);
      if (clampedStart > clampedEnd) continue;
      for (let t = clampedStart; t <= clampedEnd; t += 86_400_000) {
        const d = new Date(t);
        // U32 修复：原为裸拼年月日（无负年/短年处理——0~99 年产出两位年键、公元前产出非法键，
        // 与 DATE_KEY 契约不一致且从未被日历侧命中）；收编 formatDateKey 后公元前/远古纪年如实入格。
        days.add(formatDateKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
      }
    }
    if (raw.length < 100) break;
    offset += raw.length;
    await new Promise<void>(resolve => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
      else setTimeout(resolve, 0);
    });
  }
  return days;
}
