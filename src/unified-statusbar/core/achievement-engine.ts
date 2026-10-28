// ===== 成就系统 · 求值引擎 =====
// 详见 docs/superpowers/specs/2026-06-27-achievement-system-design.md §1/§2/§6
//
// 职责：求值器分派表（EVALUATORS，按 observe.type 字符串分派）+ 扫描循环 + 解锁收集
//   + snapshot-delta 单调 floor 守护 + 基线种子 + feature-event 队列消费。
// 纯逻辑，不碰 DOM（UI 通知由 achievement-ui.ts 在 onUnlocks 回调里处理）。
//
// 扫描接入点：index.ts 的 registerUpdateListener 节流回调，紧跟 checkNotifications() 之后。
// 此处 _allSheetsCache 已被 invalidateCache() 重建、checkNotifications() 暖好 → getSheetByName 全是缓存命中，零额外 I/O。
import { getSheetByName, getCellByHeader } from './data-manager';
import { getGachaDrawnSet } from './gacha';
import {
  loadAchievementStore, isUnlocked, getCounter, advanceCounter, advanceChatCounter,
  bumpCounter, seedBaseline, isSeeded, unlockBatch,
  getIndividualBaseline, setIndividualBaselines,
  getStreak, setStreak,
  getSessionStartTs, setSessionStartTs,
  getDailyCounter, bumpDailyCounter,
  getWindowCounter, bumpWindowCounter,
  shiftChatCounterBaselines,
  rebaseSnapshotLastSeen, rebaseChatCounterBaselines, resetSessionStart,
} from './achievement-store';
import { getAchievements, achievementCatalogReady, ensureAchievementCatalog } from './achievement-catalog';
import type { AchievementDef, Observe, CompoundObserve, LogEntry, RealClockObserve, StreakWindowObserve, TierAtLeastObserve } from './achievement-types';
import {
  getTodayDateKey, dateInRange, monthDayOfDateKey, seasonOfMonthDay, weekdayOfDateKey,
  currentSeasonWindowId,
} from './calendar-core';
import { getRealClockParts, matchHourRange } from './real-clock';
import { computeTierSnapshot } from './achievement-tier';
import { currencyBalancePeak } from './currency';
import { parseAgeCellNumber } from './birthday';
import { getWardrobeSnapshot } from './wardrobe-store';
import { currentSillyChatId } from './env';

interface AchievementIndexes {
  featureEvents: Map<string, AchievementDef[]>;
  streakEvents: Map<string, AchievementDef[]>;
  byCategory: Map<string, AchievementDef[]>;
  snapshots: AchievementDef[];
  nonFeature: AchievementDef[];
  lightScan: AchievementDef[];
}

let _achievementIndexes: AchievementIndexes | null = null;

function addToIndex(map: Map<string, AchievementDef[]>, key: string, achievement: AchievementDef): void {
  const list = map.get(key);
  if (list) list.push(achievement);
  else map.set(key, [achievement]);
}

/** 首次实际扫描时建立一次索引；成就功能关闭时保持零额外初始化成本。 */
function getAchievementIndexes(): AchievementIndexes {
  if (_achievementIndexes) return _achievementIndexes;

  const featureEvents = new Map<string, AchievementDef[]>();
  const streakEvents = new Map<string, AchievementDef[]>();
  const byCategory = new Map<string, AchievementDef[]>();
  const snapshots: AchievementDef[] = [];
  const nonFeature: AchievementDef[] = [];

  for (const achievement of getAchievements()) {
    const observe = achievement.observe;
    if (!achievement.hidden && !achievement.id.startsWith('_')) {
      addToIndex(byCategory, achievement.cat, achievement);
    }
    if (observe.type === 'feature-event') {
      addToIndex(featureEvents, observe.event, achievement);
    } else {
      nonFeature.push(achievement);
    }
    if (observe.type === 'streak-window') {
      addToIndex(streakEvents, observe.event, achievement);
    }
    if (observe.type === 'snapshot-delta') {
      snapshots.push(achievement);
    }
  }

  const lightScan = nonFeature.filter(achievement => {
    const type = achievement.observe.type;
    return type === 'counter-store'
      || type === 'meta'
      || type === 'daily-action'
      || type === 'window-action'
      || (type === 'compound' && isPureRead(achievement.observe));
  });

  _achievementIndexes = { featureEvents, streakEvents, byCategory, snapshots, nonFeature, lightScan };
  return _achievementIndexes;
}

// 解锁回调：由 index.ts 注入 UI 通知（toastr + 特效）。
let _onUnlocks: ((entries: LogEntry[]) => void) | null = null;
export function setOnUnlocks(fn: (entries: LogEntry[]) => void): void { _onUnlocks = fn; }

// 「当前季节窗口标识」已下沉到 calendar-core（currentSeasonWindowId）：本引擎 window-action 求值
// 与成就簿面板的进度显示（achievement-progress peek）共用同一处，避免两套季节口径漂移（第九轮 F33）。

/** 当前聊天标识（chat-snapshot-delta 按对话存基线用）。
 *  U32：与 achievement-store 的逐字双胞胎收编为 env.currentSillyChatId（此处薄别名保调用点）。 */
function currentChatId(): string | undefined {
  return currentSillyChatId();
}

// ===== O16：单次 scan() 内生效的「扫描型查询」去重缓存 =====
// O10 只覆盖了 SNAPSHOT_GETTERS 注册表；**评估器这一层**（counter-rows / collection /
// enum-state / numeric-any-row / age-range-rows / cross-table-numeric）此前仍各自**直接整表扫**，
// 同一 (表, 列, 条件) 会被几十条成就重复问（例：「在场角色表」被 93 条引用；347 条扫表型判定
// 摊在约 15 张表上），且每张表都要重新 `headers.indexOf(列)` 再逐行扫。
// 此处按「查询签名」去重：同一扫描内同一问题只算一次。
//
// ★ 只缓存**纯读**查询。snapshot-delta / chat-snapshot-delta / individuals-delta 会写计数器与
//   进度基线，**绝不能**入此缓存（它们根本不经本缓存，各自直接调 store）。
// ★ scan() 全程同步（无 await），且表格数据在扫描期间不变 ⇒ 同一签名结果恒定，缓存安全；
//   finally 释放，不跨扫描留存（杜绝陈旧）。扫描外调用（成就面板 peek 等）cache 为 null，行为不变。
let _scanReadCache: Map<string, number | boolean> | null = null;

/** 测试用：关掉扫描期去重以复现 O16 之前的行为（验证收益与等价性）。生产路径恒为 false。 */
let _scanReadDedupDisabled = false;
export function __setScanReadDedupDisabledForTests(disabled: boolean): void { _scanReadDedupDisabled = disabled; }

/** 扫描作用域内的查询 memo：`_scanReadCache` 为 null（扫描外）时直接计算，行为与旧代码逐字节一致。 */
function scanRead<T extends number | boolean>(
  kind: string,
  args: ReadonlyArray<string | number | boolean | undefined>,
  compute: () => T,
): T {
  const cache = _scanReadCache;
  if (!cache) return compute();
  // undefined 必须与真实空串可区分（'u' 前缀永远不等于 's' + 任意值）
  const key = kind + '\u0000' + args.map(a => (a === undefined ? 'u' : 's' + a)).join('\u0000');
  const hit = cache.get(key);
  if (hit !== undefined) return hit as T;
  const value = compute();
  cache.set(key, value);
  return value;
}

// 评估器专用包装（只读；导出原函数保持不动，供 achievement-progress 等扫描外调用）
function memoAnyRowNumeric(table: string, col: string, op: string, value: number): boolean {
  return scanRead('numeric-any-row', [table, col, op, value], () => anyRowNumeric(table, col, op, value));
}
function memoRowCount(table: string, filter?: { col: string; equals: string }): number {
  return scanRead('counter-rows', [table, filter?.col, filter?.equals], () => rowCount(table, filter));
}
function memoDistinctCount(table: string, col: string): number {
  return scanRead('collection', [table, col], () => distinctCount(table, col));
}
function memoExistsValue(table: string, col: string, value: string): boolean {
  return scanRead('enum-state', [table, col, value], () => existsValue(table, col, value));
}
function memoAgeRangeCount(table: string, col: string, min: number, max: number): number {
  return scanRead('age-range-rows', [table, col, min, max], () => ageRangeCount(table, col, min, max));
}
function memoCrossTableNumeric(o: {
  ageTable: string; ageCol?: string; min?: number; max?: number; allNames?: boolean;
  nameTable: string; nameCol: string; numCol: string; op: string; numValue: number;
  aggregate?: 'count' | 'sum';
}): number {
  return scanRead(
    'cross-table-numeric',
    [o.ageTable, o.ageCol, o.min, o.max, o.allNames, o.nameTable, o.nameCol, o.numCol, o.op, o.numValue, o.aggregate],
    () => crossTableNumeric(o),
  );
}

// ===== 工具（纯读，导出供 achievement-progress.ts peek 复用，避免重复实现）=====
export function toNum(v: string | null): number {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}
export function rowCount(table: string, filter?: { col: string; equals: string }): number {
  const sheet = getSheetByName(table);
  if (!sheet || !sheet.content) return 0;
  if (!filter) return Math.max(0, sheet.content.length - 1);
  const headers = sheet.content[0];
  const idx = headers.indexOf(filter.col);
  if (idx === -1) return 0;
  let n = 0;
  for (let i = 1; i < sheet.content.length; i++) {
    if (String(sheet.content[i][idx] ?? '') === filter.equals) n++;
  }
  return n;
}
export function distinctCount(table: string, col: string): number {
  const sheet = getSheetByName(table);
  if (!sheet || !sheet.content) return 0;
  const headers = sheet.content[0];
  const idx = headers.indexOf(col);
  if (idx === -1) return 0;
  const set = new Set<string>();
  for (let i = 1; i < sheet.content.length; i++) {
    const v = String(sheet.content[i][idx] ?? '');
    if (v && v !== '无') set.add(v);
  }
  return set.size;
}
export function existsValue(table: string, col: string, value: string): boolean {
  const sheet = getSheetByName(table);
  if (!sheet || !sheet.content) return false;
  const headers = sheet.content[0];
  const idx = headers.indexOf(col);
  if (idx === -1) return false;
  for (let i = 1; i < sheet.content.length; i++) {
    if (String(sheet.content[i][idx] ?? '') === value) return true;
  }
  return false;
}
/** 某表某列(年龄)解析数字后落在 [min, max) 区间内的数据行数。当前态。
 *  V3.2.0 起两角色表为「生日」列：优先按生日+当前游戏日期推算周岁，旧库年龄列兼容解析。 */
export function ageRangeCount(table: string, col: string, min: number, max: number): number {
  const sheet = getSheetByName(table);
  if (!sheet || !sheet.content) return 0;
  const headers = sheet.content[0];
  const idx = headers.indexOf(col);
  const birthdayIdx = headers.indexOf('生日');
  if (idx === -1 && birthdayIdx === -1) return 0;
  const todayKey = getTodayDateKey();
  let n = 0;
  for (let i = 1; i < sheet.content.length; i++) {
    const raw = birthdayIdx !== -1 ? sheet.content[i][birthdayIdx] : sheet.content[i][idx];
    const a = parseAgeCellNumber(String(raw ?? ''), todayKey);
    if (a != null && a >= min && a < max) n++;
  }
  return n;
}
/**
 * 跨表按姓名关联计数。取 ageTable 中年龄落在 [min,max) 的角色姓名集合，
 * 在 numTable 中按 nameCol 匹配这些姓名：
 *   - aggregate 缺省/'count'：统计 numCol 满足 op/numValue 的**行数**（人数）。语义："30岁以上对象中性爱次数≥1的有几人"。
 *   - aggregate='sum'：把这些角色的 numCol 数值**求和**。语义："与30岁以上对象累计性爱多少次"。
 *     sum 模式下 op/numValue 不参与单行判定（求和后整体与 value 比较由 evaluator 处理）。
 * 两表均只增不删（恋爱对象表/NSFW表禁止删除），故"当前值"即"累计值"，文案可写"累计"。
 */
export function crossTableNumeric(o: {
  ageTable: string; ageCol?: string; min?: number; max?: number; allNames?: boolean;
  nameTable: string; nameCol: string; numCol: string; op: string; numValue: number;
  aggregate?: 'count' | 'sum';
}): number {
  const ageSheet = getSheetByName(o.ageTable);
  if (!ageSheet || !ageSheet.content) return 0;
  const aHeaders = ageSheet.content[0];
  const nameIdxInAge = aHeaders.indexOf('姓名');
  if (nameIdxInAge === -1) return 0;
  // 收集姓名集合：allNames=取全部行；否则取年龄落在 [min,max) 的行
  const names = new Set<string>();
  if (o.allNames) {
    for (let i = 1; i < ageSheet.content.length; i++) {
      const nm = String(ageSheet.content[i][nameIdxInAge] ?? '').trim();
      if (nm && nm !== '无') names.add(nm);
    }
  } else {
    if (o.ageCol == null || o.min == null || o.max == null) return 0;
    const aIdx = aHeaders.indexOf(o.ageCol);
    const birthdayIdx = aHeaders.indexOf('生日');
    if (aIdx === -1 && birthdayIdx === -1) return 0;
    const todayKey = getTodayDateKey();
    for (let i = 1; i < ageSheet.content.length; i++) {
      const raw = birthdayIdx !== -1 ? ageSheet.content[i][birthdayIdx] : ageSheet.content[i][aIdx];
      const a = parseAgeCellNumber(String(raw ?? ''), todayKey);
      if (a != null && a >= o.min && a < o.max) {
        const nm = String(ageSheet.content[i][nameIdxInAge] ?? '').trim();
        if (nm && nm !== '无') names.add(nm);
      }
    }
  }
  if (names.size === 0) return 0;
  const numSheet = getSheetByName(o.nameTable);
  if (!numSheet || !numSheet.content) return 0;
  const nHeaders = numSheet.content[0];
  const nameIdx = nHeaders.indexOf(o.nameCol);
  const numIdx = nHeaders.indexOf(o.numCol);
  if (nameIdx === -1 || numIdx === -1) return 0;
  const isSum = o.aggregate === 'sum';
  let n = 0;
  for (let i = 1; i < numSheet.content.length; i++) {
    const nm = String(numSheet.content[i][nameIdx] ?? '').trim();
    if (!names.has(nm)) continue;
    const v = toNum(numSheet.content[i][numIdx]);
    if (isSum) { n += v; continue; }
    switch (o.op) {
      case '>=': if (v >= o.numValue) n++; break;
      case '>': if (v > o.numValue) n++; break;
      case '<=': if (v <= o.numValue) n++; break;
      case '<': if (v < o.numValue) n++; break;
      default: if (v === o.numValue) n++; break;
    }
  }
  return n;
}
/**
 * individuals-delta 用：取在场者姓名→其在 numTable 中 numCol 的当前数值。
 * presenceTable 各行姓名，去 numTable 按 nameCol 匹配，取 numCol 数值（无匹配则该在场者无数值，跳过）。
 * 仅返回在场且在 numTable 有匹配的个体。空名/「无」不计。
 */
export function collectPresentValues(presenceTable: string, presenceNameCol: string, numTable: string, nameCol: string, numCol: string): Record<string, number> {
  const out: Record<string, number> = {};
  const presSheet = getSheetByName(presenceTable);
  if (!presSheet || !presSheet.content) return out;
  const pHeaders = presSheet.content[0];
  const pNameIdx = pHeaders.indexOf(presenceNameCol);
  if (pNameIdx === -1) return out;
  // 先收集在场姓名集合
  const presentNames = new Set<string>();
  for (let i = 1; i < presSheet.content.length; i++) {
    const nm = String(presSheet.content[i][pNameIdx] ?? '').trim();
    if (nm && nm !== '无') presentNames.add(nm);
  }
  if (presentNames.size === 0) return out;
  // 去 numTable 取这些姓名的 numCol 当前值
  const numSheet = getSheetByName(numTable);
  if (!numSheet || !numSheet.content) return out;
  const nHeaders = numSheet.content[0];
  const nNameIdx = nHeaders.indexOf(nameCol);
  const nNumIdx = nHeaders.indexOf(numCol);
  if (nNameIdx === -1 || nNumIdx === -1) return out;
  for (let i = 1; i < numSheet.content.length; i++) {
    const nm = String(numSheet.content[i][nNameIdx] ?? '').trim();
    if (!presentNames.has(nm)) continue;
    out[nm] = toNum(numSheet.content[i][nNumIdx]);
    presentNames.delete(nm); // 同名取首条即可，避免重复
  }
  return out;
}

/** 某表某列任一数据行数值 op value 是否成立。 */
function anyRowNumeric(table: string, col: string, op: string, value: number): boolean {
  const sheet = getSheetByName(table);
  if (!sheet || !sheet.content) return false;
  const headers = sheet.content[0];
  const idx = headers.indexOf(col);
  if (idx === -1) return false;
  for (let i = 1; i < sheet.content.length; i++) {
    const v = toNum(sheet.content[i][idx]);
    switch (op) {
      case '>=': if (v >= value) return true; break;
      case '>': if (v > value) return true; break;
      case '<=': if (v <= value) return true; break;
      case '<': if (v < value) return true; break;
      default: if (v === value) return true; break;
    }
  }
  return false;
}

// ===== snapshot 取数器注册表（同步）。新增快照源 = 在此加一项 =====
// 键 = SnapshotDeltaObserve.getter / ChatSnapshotDeltaObserve.getter
/** 跨表按姓名关联求和：取 ageTable 中年龄落在 [min,max) 的角色姓名集合，在 numTable 中匹配并求 numCol 之和。 */
function crossTableSum(ageTable: string, ageCol: string, min: number, max: number, numTable: string, nameCol: string, numCol: string): number {
  return crossTableNumeric({ ageTable, ageCol, min, max, nameTable: numTable, nameCol, numCol, op: '>=', numValue: 0, aggregate: 'sum' });
}
export const SNAPSHOT_GETTERS: Record<string, () => number> = {
  // 抽卡已抽集合大小（localStorage，同步可取）
  gachaDrawnSetSize: () => getGachaDrawnSet().size,
  // 日历等无同步持久计数器的快照源不要放这里 → 改用 counter-store / feature-event

  // ===== 跨对话总和累计（chat-snapshot-delta）的分桶取数器 =====
  // 年龄段分桶：[0,20) 20岁以下 / [20,25) 20-25岁 / [25,30) 25-30岁 / [30,9999) 30岁以上
  // 恋爱对象年龄段人数（恋爱对象表只增不删→单局内单调；跨对话由 chatLastSeen 聚合）
  loverYoungCount: () => ageRangeCount('恋爱对象表', '年龄', 0, 20),
  loverPrimeCount: () => ageRangeCount('恋爱对象表', '年龄', 20, 25),
  loverLateCount: () => ageRangeCount('恋爱对象表', '年龄', 25, 30),
  loverMatureCount: () => ageRangeCount('恋爱对象表', '年龄', 30, 9999),
  // 重要角色年龄段人数
  importantMatureCount: () => ageRangeCount('重要角色表', '年龄', 30, 9999),
  // 某年龄段恋爱对象的累计性爱次数之和（NSFW.性爱次数只增不减）
  sexYoungTotal: () => crossTableSum('恋爱对象表', '年龄', 0, 20, 'NSFW信息表', '姓名', '性爱次数'),
  sexPrimeTotal: () => crossTableSum('恋爱对象表', '年龄', 20, 25, 'NSFW信息表', '姓名', '性爱次数'),
  sexLateTotal: () => crossTableSum('恋爱对象表', '年龄', 25, 30, 'NSFW信息表', '姓名', '性爱次数'),
  sexMatureTotal: () => crossTableSum('恋爱对象表', '年龄', 30, 9999, 'NSFW信息表', '姓名', '性爱次数'),
  // 某年龄段恋爱对象的累计调教值之和（NSFW.调教值只升不降）
  trainYoungTotal: () => crossTableSum('恋爱对象表', '年龄', 0, 20, 'NSFW信息表', '姓名', '调教值'),
  trainPrimeTotal: () => crossTableSum('恋爱对象表', '年龄', 20, 25, 'NSFW信息表', '姓名', '调教值'),
  trainLateTotal: () => crossTableSum('恋爱对象表', '年龄', 25, 30, 'NSFW信息表', '姓名', '调教值'),
  trainMatureTotal: () => crossTableSum('恋爱对象表', '年龄', 30, 9999, 'NSFW信息表', '姓名', '调教值'),

  // ===== 跨对话总和累计（chat-snapshot-delta）：只增不删表的累计行数 =====
  // 恋爱对象表 / NSFW信息表 / 重要角色表 均 deleteNode=禁止删除 → 单局单调，跨对话按基线累加。
  loverTotalCount:          () => rowCount('恋爱对象表'),
  nsfwInfoTotalCount:       () => rowCount('NSFW信息表'),
  importantCharTotalCount:  () => rowCount('重要角色表'),
  // 纪要表（deleteNode:禁止 → 只增不删，适合 chat-snapshot-delta 跨对话累计）
  chronicleRowCount:        () => rowCount('纪要表'),

  // ===== 当前态存量 getter（current-value 观察类型用）：纯读、无副作用 =====
  // 全局衣柜目录中来源卡名去重数（非空 source；当前态，删除自然下降）
  wardrobeDistinctSourceCards: () => {
    const items = getWardrobeSnapshot().items || [];
    return new Set(items.map(it => it.source).filter((s): s is string => typeof s === 'string' && s.trim() !== '')).size;
  },
  // 货币（L13）：当前对话里最高的币种余额（货币关闭时不读盘，直接 0）
  currencyMaxBalance: () => currencyBalancePeak(),
};

const CHARACTER_MIGRATION_COUNTERS = [
  'loverTotalCount', 'importantCharTotalCount',
  'loverYoungCount', 'loverPrimeCount', 'loverLateCount', 'loverMatureCount',
  'importantMatureCount',
  'sexYoungTotal', 'sexPrimeTotal', 'sexLateTotal', 'sexMatureTotal',
  'trainYoungTotal', 'trainPrimeTotal', 'trainLateTotal', 'trainMatureTotal',
] as const;

/** 捕获会受人物分类迁移影响的累计成就 getter 当前值。 */
export function captureCharacterMigrationAchievementSnapshot(): Record<string, number> {
  const snapshot: Record<string, number> = {};
  for (const name of CHARACTER_MIGRATION_COUNTERS) {
    const getter = SNAPSHOT_GETTERS[name];
    snapshot[name] = typeof getter === 'function' ? getter() : 0;
  }
  return snapshot;
}

/**
 * 按迁移造成的 getter 差值平移当前对话基线，不推进全局累计 counter。
 * 这样迁移本身不算新增，同时保留迁移前尚未被常规扫描结算的正常进度。
 */
export function preserveAchievementProgressAcrossCharacterMigration(
  before: Record<string, number>,
): void {
  const after = captureCharacterMigrationAchievementSnapshot();
  const deltas: Record<string, number> = {};
  for (const name of CHARACTER_MIGRATION_COUNTERS) {
    deltas[name] = after[name] - (before[name] ?? 0);
  }
  shiftChatCounterBaselines(currentChatId(), deltas);
}

// ===== feature-event 队列：现场 emit 入队，扫描时消费 =====
interface PendingEvent { event: string; payload: Record<string, number | string>; }
const _pending: PendingEvent[] = [];

/**
 * 功能现场打点。不在现场 gate 已解锁（保持功能/成就解耦），
 * 引擎扫描时按 pending 判定 + 引擎入口 Set.has 截断已解锁目标。
 * 若 observe.incrementCounter 指定，引擎消费时会推进内置计数器。
 */
export function emitAchievementEvent(event: string, payload: Record<string, number | string> = {}): void {
  _pending.push({ event, payload });
  // 入队即去抖调度一次轻量消费，使用户直接操作（放入仓库/抽卡/丢物品…）的相关成就
  // 即刻解锁，无需等待下一次 registerTableUpdateCallback 驱动的全量 scan。
  scheduleLightScan();
}

// ===== 求值器分派表（开放枚举）。新增 observe.type = 加一个 case =====
const EVALUATORS: Record<string, (o: Observe) => boolean> = {
  'numeric-threshold'(o) {
    const n = o as Extract<Observe, { type: 'numeric-threshold' }>;
    const v = toNum(getCellByHeader(n.table, n.row, n.col));
    switch (n.op) {
      case '>=': return v >= n.value;
      case '>': return v > n.value;
      case '<=': return v <= n.value;
      case '<': return v < n.value;
      default: return v === n.value;
    }
  },
  'numeric-any-row'(o) {
    const n = o as Extract<Observe, { type: 'numeric-any-row' }>;
    return memoAnyRowNumeric(n.table, n.col, n.op, n.value); // O16：扫描内按查询签名去重
  },
  'counter-rows'(o) {
    const n = o as Extract<Observe, { type: 'counter-rows' }>;
    const c = memoRowCount(n.table, n.filter); // O16：扫描内按查询签名去重
    switch (n.op) {
      case '>': return c > n.value;
      case '<=': return c <= n.value;
      case '<': return c < n.value;
      case '==': return c === n.value;
      default: return c >= n.value;  // 缺省 '>='，向后兼容
    }
  },
  'collection'(o) {
    const n = o as Extract<Observe, { type: 'collection' }>;
    return memoDistinctCount(n.table, n.col) >= n.value; // O16：扫描内按查询签名去重
  },
  'enum-state'(o) {
    const n = o as Extract<Observe, { type: 'enum-state' }>;
    return memoExistsValue(n.table, n.col, n.value); // O16：扫描内按查询签名去重
  },
  'age-range-rows'(o) {
    const n = o as Extract<Observe, { type: 'age-range-rows' }>;
    return memoAgeRangeCount(n.table, n.col, n.min, n.max) >= n.value; // O16：扫描内按查询签名去重
  },
  'cross-table-numeric'(o) {
    const n = o as Extract<Observe, { type: 'cross-table-numeric' }>;
    return memoCrossTableNumeric(n) >= n.value; // O16：扫描内按查询签名去重
  },
  'counter-store'(o) {
    const n = o as Extract<Observe, { type: 'counter-store' }>;
    return getCounter(n.counter) >= n.value;
  },
  'snapshot-delta'(o) {
    const n = o as Extract<Observe, { type: 'snapshot-delta' }>;
    const cur = readSnapshotGetter(n.getter); // O10：扫描内按名缓存
    if (cur === null) return false;
    // 单调 floor 守护累加（advanceCounter 内部处理 current<lastSeen 的不变情形）
    const acc = advanceCounter(n.counter, cur);
    return acc >= n.value;
  },
  'chat-snapshot-delta'(o) {
    const n = o as Extract<Observe, { type: 'chat-snapshot-delta' }>;
    const cur = readSnapshotGetter(n.getter); // O10：扫描内按名缓存
    if (cur === null) return false;
    // 按对话存基线，各对话增量累加进全局 counter（跨对话总和）
    const acc = advanceChatCounter(n.counter, currentChatId(), cur);
    return acc >= n.value;
  },
  'individuals-delta'(o) {
    const n = o as Extract<Observe, { type: 'individuals-delta' }>;
    // 1. 收集当前在场者 { name: currentValue }（姓名按 numTable 关联取 numCol）
    const present = collectPresentValues(n.presenceTable, n.presenceNameCol, n.numTable, n.nameCol, n.numCol);
    // 2. 仅当在场 ≥ presenceMin 才处理；否则什么都不做（不刷基线、不检测）
    const keys = Object.keys(present);
    if (keys.length < n.presenceMin) return false;
    // 3. 对每个在场者判定增长（基线无则建立、不计增量）；同时攒新基线（仅当前在场者）
    let increased = 0;
    const newBase: Record<string, number> = {};
    for (const name of keys) {
      const cur = present[name];
      const last = getIndividualBaseline(n.counter, name);
      if (last != null && cur - last >= n.minDelta) increased++;
      newBase[name] = cur; // 离场者不入新基线→回来当新人
    }
    setIndividualBaselines(n.counter, newBase);
    // 4. 判定
    return increased >= n.minIncreased;
  },
  // feature-event 由消费阶段单独处理（见 consumePending），此处不在此处求值
  'feature-event'() { return false; },
  // streak-window 同样由 consumePending 阶段处理（事件到达时计连击），常规 scan 不求值
  'streak-window'() { return false; },
  /**
   * session-duration：在同一角色卡中连续游玩超过 N 分钟。
   * 首扫记 sessionStartTs = Date.now()，后续扫描算 elapsed = now - sessionStartTs。
   * 每页加载/热重载时 sessionStartTs 为 0 → 首扫自动记录，无需显式重置。
   */
  'session-duration'(o) {
    const n = o as Extract<Observe, { type: 'session-duration' }>;
    const start = getSessionStartTs();
    const now = Date.now();
    if (start === 0) { setSessionStartTs(now); return false; }
    const elapsedMin = (now - start) / 60000;
    return elapsedMin >= n.minutes;
  },
  'meta'(o) {
    const n = o as Extract<Observe, { type: 'meta' }>;
    // depIds 全部解锁，或（matchCat 时）该类别非隐藏成就全部解锁
    if (n.depIds && n.depIds.length) {
      if (!n.depIds.every(id => isUnlocked(id))) return false;
    }
    if (n.matchCat) {
      // 同类别非隐藏、且非内部计数推进用成就（id 不以 _ 开头）全部解锁才算达成
      const sameCat = getAchievementIndexes().byCategory.get(n.matchCat) || [];
      if (!sameCat.every(a => isUnlocked(a.id))) return false;
    }
    return true;
  },
  'compound'(o) {
    const n = o as Extract<Observe, { type: 'compound' }>;
    return n.conditions.every(c => evaluate(c));
  },
  'calendar-event'(o) {
    const n = o as Extract<Observe, { type: 'calendar-event' }>;
    const todayKey = getTodayDateKey();
    if (!todayKey) return false;
    const todayMd = monthDayOfDateKey(todayKey); // F3：负年份安全，不 slice(5)
    if (!todayMd) return false;
    switch (n.match) {
      case 'date':        return todayMd === n.date;
      case 'anniversary': return todayMd === n.anniversary;
      case 'range':       return dateInRange(todayMd, n.range!);
      case 'season':      return seasonOfMonthDay(todayMd) === n.season;
      case 'weekday':     return n.weekday!.includes(weekdayOfDateKey(todayKey));
    }
    return false;
  },
  'daily-action'(o) {
    const n = o as Extract<Observe, { type: 'daily-action' }>;
    const today = getTodayDateKey();
    if (!today) return false;
    const slot = getDailyCounter(n.action);
    if (!slot || slot.date !== today) return false;
    const target = n.value ?? 1;
    return slot.count >= target;
  },
  'window-action'(o) {
    const n = o as Extract<Observe, { type: 'window-action' }>;
    if (n.window !== 'season') return false;
    const wid = currentSeasonWindowId();
    if (!wid) return false;
    const slot = getWindowCounter(n.action);
    // 窗口已切换但本季节未再推进该 action → 新窗口 count 视为 0；清零在下次 bumpWindowCounter 时发生
    if (!slot || slot.windowId !== wid) return false;
    return slot.count >= n.value;
  },
  'current-value'(o) {
    const n = o as Extract<Observe, { type: 'current-value' }>;
    const cur = readSnapshotGetter(n.getter); // O10：扫描内按名缓存
    if (cur === null) return false;
    return cur >= n.value;
  },
  /**
   * real-clock（第九轮 L10）：现实本地时钟彩蛋。纯读零 I/O；getRealClockParts 按分钟记忆，
   * 同一次扫描内多次调用只构造一次 Date。支持跨零点区间（23→5）。
   */
  'real-clock'(o) {
    const n = o as RealClockObserve;
    const c = getRealClockParts();
    if (n.weekday && n.weekday.length && !n.weekday.includes(c.weekday)) return false;
    return matchHourRange(c.hour, n.from, n.to);
  },
  /**
   * tier-at-least（第九轮 L12）：段位勋章。读 core/achievement-tier 的单一来源快照
   * （按成就簿修订令牌记忆 ⇒ 扫描期零重算）。勋章自身不计入分母，无自循环。
   * 口径与统计条显示一致：显示「第 N 档」⇔ snapshot.tier+1 >= N。
   */
  'tier-at-least'(o) {
    const n = o as TierAtLeastObserve;
    const snap = computeTierSnapshot();
    return snap.tier + 1 >= n.tier;
  },
};

/** 求值单个 observe（非 feature-event）。 */
function evaluate(o: Observe): boolean {
  if (o.type === 'feature-event') return false; // feature-event 不在常规扫描求值
  const fn = EVALUATORS[o.type];
  return fn ? fn(o) : false;
}

/** 匹配 feature-event payload 可选条件。 */
function payloadMatches(payload: Record<string, number | string>, match?: Record<string, number | string>): boolean {
  if (!match) return true;
  for (const k in match) {
    const want = match[k];
    const got = payload[k];
    if (typeof want === 'number') {
      // schema.md §8 契约：数值键 → Number(payload[k]) >= want。
      // 缺失/非数值时 Number→NaN，`NaN >= want` 恒 false ⇒ 不匹配。
      // 旧写法 `if (Number(got) < want) return false` 会让 NaN 漏过（缺字段被误判命中，
      // 如任何 gacha_draw 都能推进特卖计数、任何 text 消息都能解锁长篇大论）。
      if (!(Number(got) >= want)) return false;
    } else if (String(got) !== String(want)) {
      return false;
    }
  }
  return true;
}

/** 消费 pending feature-events：推进内置计数器 + 计 streak 连击 + 收集本批解锁。返回新解锁定义。 */
function consumePending(): AchievementDef[] {
  if (_pending.length === 0) return [];
  const events = _pending.splice(0);
  const unlocked: AchievementDef[] = [];
  const indexes = getAchievementIndexes();
  for (const ev of events) {
    // 1) feature-event 条目：推进计数器 / 匹配解锁
    for (const a of indexes.featureEvents.get(ev.event) || []) {
      if (a.observe.type !== 'feature-event') continue;
      // 内部计数推进条目（带 incrementCounter）：匹配事件后推进计数器，本身永不解锁、不入解锁队列。
      // `_unlock` 只负责让内部条目自身永不解锁，不参与推进条件；其余 source/kind 等字段仍必须匹配。
      // 仅含 `_unlock` 的旧条目会得到空条件，保持「每次同名事件都推进」行为。
      // 累加量：amountFromPayload 指定字段 > payload.amount > +1，支撑 shop_energy_spent 按 price 累加等场景。
      if (a.observe.incrementCounter) {
        const pm = a.observe.payloadMatch;
        const counterMatch = pm
          ? Object.fromEntries(Object.entries(pm).filter(([key]) => key !== '_unlock'))
          : undefined;
        if (counterMatch && !payloadMatches(ev.payload, counterMatch)) continue;
        const amt = a.observe.amountFromPayload ? (ev.payload as any)?.[a.observe.amountFromPayload] : (ev.payload as any)?.amount;
        bumpCounter(a.observe.incrementCounter, typeof amt === 'number' ? amt : 1);
        continue;
      }
      if (isUnlocked(a.id)) continue;
      if (!payloadMatches(ev.payload, a.observe.payloadMatch)) continue;
      unlocked.push(a);
    }
    // 2) streak-window 条目：同事件在 window 内连续达 value 次 → 解锁。按 event 命名空间共享 count。
    // F49(第十二轮)：共享计数**每个事件只推进一次**——原实现写在逐条成就的循环体内，
    // 同一事件挂两条成就时（skill_activated 有 3 连与 5 连两枚）第二条会读到刚写下的 count 再 +1，
    // 一次事件推进两次 ⇒ 三连/五连只需一半次数即可解锁。窗口取该事件下最长者（当前目录同事件窗口同值）。
    const streakItems = (indexes.streakEvents.get(ev.event) || [])
      .filter((a): a is AchievementDef & { observe: StreakWindowObserve } =>
        a.observe.type === 'streak-window' && !isUnlocked(a.id));
    if (streakItems.length) {
      const now = Date.now();
      const st = getStreak(ev.event);
      const windowMs = Math.max(...streakItems.map(a => a.observe.window));
      const count = st && now - st.lastTs <= windowMs ? st.count + 1 : 1;
      setStreak(ev.event, count, now);
      for (const a of streakItems) {
        if (count >= a.observe.value) unlocked.push(a);
      }
    }
    // 3) action-on-date 事件：写入当天计数器（跨天自动清零），不与普通 feature-event 混淆
    if (ev.event === 'action-on-date') {
      const action = String((ev.payload as any)?.action ?? '');
      if (action) {
        const today = getTodayDateKey();
        if (today) bumpDailyCounter(action, today);
        const wid = currentSeasonWindowId();
        if (wid) bumpWindowCounter(action, wid);
      }
    }
  }
  return unlocked;
}

// ===== 当前真实时间（解锁履历用）=====
// 解锁时间统一记真实时间，不读全局数据表「当前时间」（游戏内时间会随剧情回滚而失真，
// 且无法跨多次解锁形成稳定时序）。格式 YYYY-MM-DD HH:MM。
function currentRealTime(): string {
  try {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
      + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  } catch (e) { return ''; }
}

// ===== 基线种子：仅对已注册的 snapshot getter 取当前快照填入 lastSeen =====
function maybeSeed(): void {
  if (isSeeded()) return;
  const snap: Record<string, number> = {};
  // 对每条 snapshot-delta 成就取其 getter 当前值作为基线
  for (const a of getAchievementIndexes().snapshots) {
    if (a.observe.type !== 'snapshot-delta') continue;
    const v = readSnapshotGetter(a.observe.getter); // O10：扫描内按名缓存
    if (v !== null) snap[a.observe.counter] = v;
  }
  seedBaseline(snap);
}

// ===== 轻量即时扫描：让用户直接操作 emit 的 feature-event 即刻消费 =====
// 背景：deleteRow/insertRow 等直接写 API 不触发 registerTableUpdateCallback（需另调
//   refreshDataAndWorldbook 才通知前端刷新），导致用户操作 emit 的事件滞留 _pending 队列，
//   要等下一次 AI 写表的完整刷新才会被 scan.consumePending 消费 → 表现为「下次快照才触发」。
// 方案：emit 入队后经 microtask 去抖调度 lightScan，只消费 pending + 求值纯读不访问 DB 的类型
//   （counter-store 读 getCounter、meta 读 isUnlocked、calendar-event/daily-action 读日期与当天计数器），
//   以及「子条件全纯读」的 compound（如 calendar-event+daily-action 的节气日期动作成就），零 DB I/O。
//   无状态派（counter-rows/enum-state/collection/snapshot-delta…）需读 DB，仍由全量 scan 处理。
// 资源纪律：未 emit 不调度（零开销）；queueMicrotask 合并连续 emit（一次处理一批）；纯内存求值。
//   与全量 scan 经 _pending.splice + isUnlocked + unlockBatch 自然互斥，无重复解锁。
let _lightScanScheduled = false;

function scheduleLightScan(): void {
  if (_lightScanScheduled) return;
  _lightScanScheduled = true;
  queueMicrotask(() => {
    _lightScanScheduled = false;
    lightScan();
  });
}

/**
 * 判断 observe 是否「纯读不访问 DB」：lightScan 安全求值用（零 DB I/O 纪律）。
 * 叶类型仅允许 counter-store / meta / calendar-event / daily-action / window-action / real-clock /
 * tier-at-least（均纯内存读、无副作用；real-clock 按分钟记忆、tier 按修订令牌记忆）。
 * compound 递归判定所有子条件均纯读才返回 true。其余（snapshot-delta/counter-rows 等读 DB、
 * session-duration 有写副作用、feature-event/streak-window 由 consumePending 处理）一律 false。
 */
function isPureRead(o: Observe): boolean {
  switch (o.type) {
    case 'counter-store':
    case 'meta':
    case 'calendar-event':
    case 'daily-action':
    case 'window-action':
    case 'current-value':
    case 'real-clock':
    case 'tier-at-least':
      return true;
    case 'compound':
      return (o as CompoundObserve).conditions.every(sub => isPureRead(sub));
    default:
      return false;
  }
}

/**
 * 轻量扫描：消费 pending feature-events + 求值纯读不访问 DB 的成就类型（counter-store / meta
 *   / daily-action，以及子条件全纯读的 compound，如 calendar-event+daily-action 节气日期动作成就）。
 *   consumePending 先写当天 dailyCounters，再在本循环求值 daily-action，时序保证「当天动作→即时解锁」。
 * 不调用 maybeSeed：本函数不求值 snapshot-delta，无需基线种子；seed 仍由全量 scan 首次执行。
 * 与全量 scan 经 _pending.splice + isUnlocked + unlockBatch 自然互斥，无重复解锁。
 */
function lightScan(): void {
  try {
    loadAchievementStore();
    const fromEvents = consumePending();
    const ts = currentRealTime();
    const collected: { id: string; name: string; cat: LogEntry['cat']; ts: string }[] = [];
    // feature-event/streak-window 已由 consumePending 处理（fromEvents）；
    // 此处补求值纯读类型：counter-store/meta/daily-action + 子条件全纯读的 compound，使其即刻解锁。
    for (const a of getAchievementIndexes().lightScan) {
      if (isUnlocked(a.id)) continue;
      if (evaluate(a.observe)) collected.push({ id: a.id, name: a.name, cat: a.cat, ts });
    }
    for (const a of fromEvents) {
      if (!isUnlocked(a.id)) collected.push({ id: a.id, name: a.name, cat: a.cat, ts });
    }
    if (collected.length === 0) return;
    const newEntries = unlockBatch(collected);
    if (newEntries.length && _onUnlocks) _onUnlocks(newEntries);
  } catch (e) {
    console.warn('[achievement] lightScan failed:', e);
  }
}

// ===== 扫描主入口：求值所有非 feature-event 成就 + 消费 pending events =====
/** 本次扫描是否已执行基线种子（同一 init 周期内只种一次） */
let _seededThisSession = false;

/**
 * O10：单次 scan() 内生效的取数器值缓存。
 * 成就库 47 处引用了 20 个取数器（其中 crossTableSum 一个就要整表扫两遍），而原实现直接
 * `getter()` ⇒ 同一扫描内同一取数器被重复计算（sexMatureTotal 4 遍、sexYoungTotal 3 遍…），
 * 每 300ms 心跳白跑约 27 次。取数器全部是纯读（读表 / 读 localStorage / 克隆快照，无副作用），
 * 同一扫描内值恒定，故按名缓存安全；扫描结束立即置空（finally），不跨扫描留存，杜绝陈旧。
 * 扫描外的调用点（迁移快照 / 重锚）此时缓存为 null，照旧取实时值。
 */
let _scanGetterCache: Map<string, number> | null = null;

/** 取某注册取数器的值：扫描期间按名命中缓存；未注册返回 null（调用方据此保持原「跳过」语义）。 */
function readSnapshotGetter(name: string): number | null {
  const getter = SNAPSHOT_GETTERS[name];
  if (typeof getter !== 'function') return null;
  if (_scanGetterCache) {
    const hit = _scanGetterCache.get(name);
    if (hit !== undefined) return hit;
  }
  const value = getter();
  if (_scanGetterCache) _scanGetterCache.set(name, value);
  return value;
}

export function scan(): void {
  // O39(第十一轮)：目录就绪门——惰性解析未完成时跳过本 tick 并触发装载（微任务内完成，
  // 下一次 tick 自然补上；外部存档就绪远慢于此，正常游玩感知不到这道门）。
  if (!achievementCatalogReady()) { void ensureAchievementCatalog(); return; }
  _scanGetterCache = new Map(); // O10：本次扫描的取数器缓存（finally 释放）
  _scanReadCache = _scanReadDedupDisabled ? null : new Map(); // O16：本次扫描的查询去重缓存（finally 释放）
  try {
    loadAchievementStore();
    if (!_seededThisSession) { maybeSeed(); _seededThisSession = true; }

    // 1. 消费 feature-event（先推进计数器，使 counter-store 成就能在同 tick 求值）
    const fromEvents = consumePending();

    // 2. 求值所有非 feature-event 成就
    const ts = currentRealTime();
    const collected: { id: string; name: string; cat: LogEntry['cat']; ts: string }[] = [];
    for (const a of getAchievementIndexes().nonFeature) {
      if (isUnlocked(a.id)) continue;
      if (evaluate(a.observe)) {
        collected.push({ id: a.id, name: a.name, cat: a.cat, ts });
      }
    }
    // 3. feature-event 解锁（已确认 payload 匹配的）
    for (const a of fromEvents) {
      if (!isUnlocked(a.id)) collected.push({ id: a.id, name: a.name, cat: a.cat, ts });
    }

    if (collected.length === 0) return;

    const newEntries = unlockBatch(collected);
    if (newEntries.length && _onUnlocks) _onUnlocks(newEntries);
  } catch (e) {
    // 扫描失败不应影响状态栏主功能：静默
    console.warn('[achievement] scan failed:', e);
  } finally {
    _scanGetterCache = null; // O10：释放本次扫描缓存
    _scanReadCache = null;   // O16：释放本次扫描查询去重缓存
  }
}

/** 重置会话内种子标记（热重载场景用）。 */
export function resetSession(): void { _seededThisSession = false; _pending.length = 0; _lightScanScheduled = false; }

/**
 * 切卡/首载角色卡时的累计重锚：保证「新卡存量不计为新增、累计只发生在游玩过程中」。
 * 幂等、零解锁副作用，可在切卡（chat-changed）或检测到表格快照切换到新卡时调用。
 *
 * 1. 清空未消费的 feature-event 队列（切卡瞬间旧卡打点残留，消费即污染新卡进度）。
 * 2. 清掉尚未执行的 lightScan 调度（其消费的 pending 已被一并清空）。
 * 3. 重锚 snapshot-delta 的全局 lastSeen 到新卡当前快照（如 gacha 已抽集合大小）。
 * 4. 重锚 chat-snapshot-delta 当前 chatId 的基线到新卡当前快照（新卡存量不计）。
 * 5. 重置 session-duration 会话计时（在新卡重新开始连续游玩计时）。
 *
 * 注意：此函数依赖 DB 快照（getter 读表/读 localStorage），须在 chatKey 切换已生效、
 * 且数据库数据已切换到新卡之后调用。调用方保证时序（表格更新回调内、快照已就绪）。
 * 成就功能关闭时由调用方 gate（不调用，避免加载成就簿）。
 */
export function rebaseAchievementBaselines(): void {
  // 1+2. 清 pending 与 lightScan 调度（切卡瞬间的残留打点不跨卡消费）
  _pending.length = 0;
  _lightScanScheduled = false;
  // 3+4. 取 snapshot getter 当前值，按类型分开重锚（多成就共享同一 counter，去重只取一次）
  const globalSnap: Record<string, number> = {};
  const chatSnap: Record<string, number> = {};
  for (const a of getAchievements()) {
    const o = a.observe;
    if (o.type === 'snapshot-delta') {
      const g = SNAPSHOT_GETTERS[o.getter];
      if (typeof g === 'function' && globalSnap[o.counter] === undefined) globalSnap[o.counter] = g();
    } else if (o.type === 'chat-snapshot-delta') {
      const g = SNAPSHOT_GETTERS[o.getter];
      if (typeof g === 'function' && chatSnap[o.counter] === undefined) chatSnap[o.counter] = g();
    }
  }
  rebaseSnapshotLastSeen(globalSnap);
  rebaseChatCounterBaselines(currentChatId(), chatSnap);
  // 5. 重置连续游玩会话计时（在新卡重新开始）
  resetSessionStart();
}

/**
 * C2 补通路解锁：开面板时命中日期的成就顺手解锁 + 触发 _onUnlocks 庆祝。
 * 封装 scan 的「unlockBatch + _onUnlocks」尾巴，供 achievement-ui 调用，不重复实现庆祝
 * （庆祝 DOM 由 _onUnlocks 回调统一处理，Task 2c 会改写其父窗口实现，C2 自动受益）。
 * 内部用 currentRealTime（与 scan 一致）。零额外遍历/零新监听/零新定时器。
 */
export function unlockDefinitions(defs: AchievementDef[]): LogEntry[] {
  if (!defs || defs.length === 0) return [];
  const ts = currentRealTime();
  const payload = defs.map(d => ({ id: d.id, name: d.name, cat: d.cat, ts }));
  const newEntries = unlockBatch(payload);
  if (newEntries.length && _onUnlocks) _onUnlocks(newEntries);
  return newEntries;
}
