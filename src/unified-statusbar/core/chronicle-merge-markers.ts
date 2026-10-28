// ===== 纪要合并产物标记 store（不碰数据库） =====
// [LEGACY-MERGE · DB-ONLY] 仅状态栏数据库模式使用。
// 瑟瑟台账有自己独占的标记存储（core/summary-merge-markers.ts，chat_metadata.seseLedgerMerge），
// 不读写本模块。后续移除状态栏合并时可将本文件及其 story feature 标记一起删除；
// **不要**把台账指向这里（台账标记必须与状态栏生命周期解耦）。
// 设计文档：docs/superpowers/specs/2026-07-28-chronicle-merge-marker-design.md
//
// 合并提交后把每个 success 段产物的「时间跨度 → 几合一计数」存到 extensionSettings 独立子键，
// 纪要表本身一字不改。渲染数据库弹窗纪要 tab 与合并配置弹窗 AM 网格时，用当前条目算时间跨度
// 反查，命中则显示徽章 / 角标。
//
// 为何用时间跨度而非内容指纹：合并产物按首条起始 ~ 末条结束拼 time_span，同一批原纪要再合并
// 得到的时间跨度稳定（独立于 row_id/AM 重排与 AI 文本）；用时间跨度标记则内容再编辑、AI 文本
// 变化都不影响命中——「几合一」徽章不再因编辑产物/换模型重生成而凭空消失。同一时间跨度仅由
// 同一批原纪要唯一生成，重复合并同一批只会在 commit 时用累计计数覆盖。
// 修剪：提交时按当前表各行的 time_span 做集合差——被合并掉/删除的产品行其标记随之移除（无陈旧
// 残留），仍存活产物标记保留。修剪只依赖 time_span（无内容漂移），不会像指纹方案那样误删。
//
// 存储载体：story feature `chronicle.mergeMarkers`（随聊天 V2 journal 持久化），
// 按 chatKey 分桶（一聊天一纪要表），跨浏览器随外部存储同步、与同步过来的纪要表保持一致。

import {
  getCurrentStoryChatKey,
  readStoryFeature,
  writeStoryFeature,
} from './story-floor-store';

const STORY_FEATURE_KEY = 'chronicle.mergeMarkers';

/** 单条标记：几合一（累计原始轮数）。 */
interface MergeMarkerEntry {
  count: number;
}

/** 某 chatKey 下的标记表：timeKey → entry。 */
type ChatMarkers = Record<string, MergeMarkerEntry>;
/** 全部：chatKey → ChatMarkers。 */
type AllMarkers = Record<string, ChatMarkers>;

// ===== 内存态（按当前聊天加载，写穿故事存储） =====
let _cache: { chatKey: string; markers: ChatMarkers } | null = null;

// ===== 存储 IO =====

/** 校验/归一化从存储读回的原始对象，丢弃非法条目。 */
function normalizeAll(raw: Record<string, any>): AllMarkers {
  const out: AllMarkers = {};
  for (const chatKey in raw) {
    const m = raw[chatKey];
    if (!m || typeof m !== 'object') continue;
    const clean: ChatMarkers = {};
    for (const k in m) {
      const e = m[k];
      if (e && typeof e === 'object' && typeof e.count === 'number' && e.count >= 1 && Number.isFinite(e.count)) {
        clean[k] = { count: Math.floor(e.count) };
      }
    }
    if (Object.keys(clean).length) out[chatKey] = clean;
  }
  return out;
}

function loadCurrent(): ChatMarkers {
  const chatKey = getCurrentChatKeyOrNull();
  if (!chatKey) return {};
  if (_cache?.chatKey === chatKey) return _cache.markers;
  const raw = readStoryFeature<Record<string, any>>(STORY_FEATURE_KEY, {});
  const normalized = normalizeAll({ [chatKey]: raw });
  _cache = { chatKey, markers: normalized[chatKey] || {} };
  return _cache.markers;
}

function flushCurrent(): void {
  if (!_cache) return;
  void writeStoryFeature(STORY_FEATURE_KEY, _cache.markers);
}

/** 当前聊天 chatKey；'unknown-' / 空 → null（渲染与提交都应据此降级）。 */
export function getCurrentChatKeyOrNull(): string | null {
  const k = getCurrentStoryChatKey();
  if (!k || k.startsWith('unknown-')) return null;
  return k;
}

// ===== 时间跨度归一化 =====

/** 纪要表一行的时间跨度：'{start} ~ {end}'。 */
export interface ChronicleTimeSpan {
  time_span: string;
}

/**
 * 把 time_span 归一化为标记键：两侧日期截断到 4 位年份 + 去空格转大写。
 * 支持短年份（021-02-05 → 0021-02-05）；首条纪要开始为空时键为 `~结束时间`；
 * 只有结束缺失才返回 null（该条不查不记录）。
 */
export function normalizeTimeKey(time_span: string): string | null {
  const raw = String(time_span ?? '').trim();
  if (!raw) return null;
  const idx = raw.indexOf('~');
  // 单边时间跨度（首条纪要没有开始）：整串当结束，键为 `~结束`（与完整区间键不冲突）。
  if (idx < 0) return '~' + padYear(raw).toUpperCase().replace(/\s+/g, '');
  const start = raw.slice(0, idx).trim();
  const end = raw.slice(idx + 1).trim();
  if (!end) return null;
  return (start ? padYear(start).toUpperCase().replace(/\s+/g, '') : '') + '~' + padYear(end).toUpperCase().replace(/\s+/g, '');
}

function padYear(s: string): string {
  // 日期部分：YYYY-MM-DD 或 YY-MM-DD → 规范「至少 4 位」年份（021-02-05 → 0021-02-05；14900 原样）
  const m = s.match(/^(\d{1,6})-(\d{1,2})-(\d{1,2})/);
  if (!m) return s;
  const y = m[1].padStart(4, '0');
  return y + '-' + m[2] + '-' + m[3] + s.slice(m[0].length);
}

// ===== 公开 API =====

/** 查某条纪要是否合并产物；命中返回几合一 count（≥1），否则 null。 */
export function getMergedCount(chatKey: string, c: ChronicleTimeSpan): number | null {
  if (chatKey !== getCurrentChatKeyOrNull()) return null;
  const key = normalizeTimeKey(c.time_span);
  if (!key) return null;
  const m = loadCurrent();
  if (!m) return null;
  const e = m[key];
  return e ? e.count : null;
}

// 纪要表 time_span 列的中英文别名（小写匹配）。
const COL_TIME_SPAN = ['时间跨度', 'time_span'];

function findCol(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] ?? '').trim().toLowerCase();
    if (aliases.indexOf(h) >= 0) return i;
  }
  return -1;
}

/**
 * 渲染用：从数据库弹窗的 headers + cells 行取纪要表 time_span 列查标记。
 * 非纪要表（取不到 time_span 列）→ 返回 null（不显示徽章）。
 */
export function getMergedCountForCells(
  chatKey: string,
  headers: string[],
  cells: (string | null | undefined)[],
): number | null {
  const ti = findCol(headers, COL_TIME_SPAN);
  if (ti < 0) return null;
  return getMergedCount(chatKey, { time_span: String(cells[ti] ?? '') });
}

/** 取某个 success 段的累计原始轮数：Σ(段内每条 origEntry 的旧计数 ?? 1)。 */
export function cumulativeMergeCount(chatKey: string, origEntries: ChronicleTimeSpan[]): number {
  const m = chatKey === getCurrentChatKeyOrNull() ? loadCurrent() : {};
  let sum = 0;
  for (const o of origEntries) {
    const key = normalizeTimeKey(o.time_span);
    const e = key ? m && m[key] : null;
    sum += e ? e.count : 1;
  }
  return sum;
}

/**
 * 提交成功后为本次 success 段写入/更新标记，并按当前表各行 time_span 做集合差修剪
 * （engine.commitMerge 调）。计数已含累计（cumulativeMergeCount）；同一时间跨度被再次合并时
 * 覆盖为最新累计。被合并掉/删除的产品行（time_span 不在 liveTimeSpans）其标记随之移除——
 * 无陈旧残留；修剪只依赖 time_span（非空简单字符串，无内容读漂移），不会误删存活产物。
 */
export function markMergedProducts(
  chatKey: string,
  newMerged: { time_span: string; count: number }[],
  liveTimeSpans: string[],
): void {
  if (chatKey !== getCurrentChatKeyOrNull()) return;
  const cur = loadCurrent();
  const live = new Set<string>();
  for (const ts of liveTimeSpans) {
    const k = normalizeTimeKey(ts);
    if (k) live.add(k);
  }
  const next: ChatMarkers = {};
  for (const k in cur) {
    if (live.has(k)) next[k] = cur[k];
  }
  for (const m of newMerged) {
    const key = normalizeTimeKey(m.time_span);
    if (!key) continue;
    if (m.count >= 1 && Number.isFinite(m.count)) next[key] = { count: Math.floor(m.count) };
  }
  _cache = { chatKey, markers: next };
  flushCurrent();
}
