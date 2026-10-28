// ===== 货币系统数据层（前端自管，按聊天保存）=====
// 方案：docs/plans/金钱系统设计方案V2-2026-10-05.md（V2.4）
// 货币 = 本模块 story feature 'currency'（每聊天独立），与物品表完全无关；
// 所有写入走 writeStoryFeature 单键整写 + 'ub-currency-changed' 事件广播标脏。
// 允许负余额（欠款语义）；金额变动不钳制；世界书侧约束 AI「余额不足不交易」。
import { readStoryClockRaw } from './calendar-core';
import { readStoryFeature, writeStoryFeature, getCurrentStoryChatKey } from './story-floor-store';
import { debounce } from './timing';
import { getConfig } from './config-store';
import { CURRENCY_ICONS, currencyIconSvg, type CurrencyIconName } from './currency-icons';
import { requestWorldbookProjection } from './worldbook-projection-events';
import { CURRENCY_HOST_CHANGED_EVENT, topWindowCandidates } from './cross-window';

export const CURRENCY_STORY_KEY = 'currency';
export const CURRENCY_CHANGED_EVENT = 'ub-currency-changed';
/** 世界书余额摘要重建防抖（ms）。 */
const WB_DISPATCH_DEBOUNCE = 5000;
// U34：货币数据变更 → 世界书投影节流（尾沿防抖，规范库带 cancel 句柄）
const dispatchCurrencyWbProjection = debounce(() => {
  try { requestWorldbookProjection('currency', 'data-change'); } catch (_e) { /* 投影运行时未初始化 */ }
}, WB_DISPATCH_DEBOUNCE);
/** 流水滚动上限（保尾）。 */
const LEDGER_MAX = 100;

/** 币种图标名（图形正文与 CURRENCY_ICON_PATHS 的唯一事实源：core/currency-icons.ts，
 *  手机分发包也取那一份，见本文件末的再导出）。 */
export type CurrencyIcon = CurrencyIconName;
export { CURRENCY_ICONS, currencyIconSvg };

export type CurrencySource = 'prose' | 'phone-out' | 'phone-in' | 'rp-open' | 'shop' | 'manual';

export interface CurrencyMeta {
  id: string;
  name: string;
  desc: string;
  icon: CurrencyIcon;
  /** 小数位：现代币种 2，其余 0。 */
  precision: 0 | 2;
}

/** 新增币种的入参：id 可省——唯一性由数据层保证（id 是行内全部动作的查找键）。 */
export type CurrencyDraft = Omit<CurrencyMeta, 'id'> & { id?: string };

export interface CurrencyLedgerEntry {
  ts: number;
  /** 全局数据表「当前时间」快照（与状态栏时间 chip 同源）。 */
  storyTime?: string;
  currencyId: string;
  /** 币种名快照：删除币种后流水仍可读。 */
  currencyName: string;
  delta: number;
  balanceAfter: number;
  source: CurrencySource;
  note: string;
  /** prose 来源时的楼层键（chatKey#mesId），供幂等与溯源。 */
  floorId?: string;
}

export interface CurrencyData {
  schema: 1;
  currencies: CurrencyMeta[];
  /** 币种 id → 余额（可为负）。 */
  balances: Record<string, number>;
  /** 常用货币：仅为默认项（状态栏展示 / 标签省略币种名 / 手机默认支付），不限制其他货币收付。 */
  commonId: string | null;
  ledger: CurrencyLedgerEntry[];
  /** 正文提取幂等标记：楼层键（chatKey#mesId）→ true。 */
  extractedFloors: Record<string, true>;
}

export function emptyCurrencyData(): CurrencyData {
  return { schema: 1, currencies: [], balances: {}, commonId: null, ledger: [], extractedFloors: {} };
}

// ─── 纯函数（可单测，不触 IO）───────────────────────────────

function clampPrecision(n: number, precision: 0 | 2): number {
  const f = precision === 2 ? 100 : 1;
  return Math.round(n * f) / f;
}

export function normalizeCurrencyMeta(raw: unknown): CurrencyMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const name = String(v.name ?? '').trim();
  if (!name || name.length > 20) return null;
  const icon = (CURRENCY_ICONS as readonly string[]).includes(String(v.icon)) ? v.icon as CurrencyIcon : 'coin';
  return {
    id: typeof v.id === 'string' && v.id ? v.id : makeCurrencyId(),
    name,
    desc: String(v.desc ?? '').slice(0, 60),
    icon,
    precision: v.precision === 2 ? 2 : 0,
  };
}

export function normalizeCurrencyData(raw: unknown): CurrencyData {
  const data = emptyCurrencyData();
  if (!raw || typeof raw !== 'object') return data;
  const v = raw as Record<string, unknown>;
  if (Array.isArray(v.currencies)) {
    for (const item of v.currencies) {
      const meta = normalizeCurrencyMeta(item);
      if (!meta || data.currencies.some(c => c.name.toLowerCase() === meta.name.toLowerCase())) continue;
      // id 唯一性 = 行内动作（点余额/换图标/★/删除）的查找契约：重复 id 重新分配（脏数据自愈）
      if (data.currencies.some(c => c.id === meta.id)) meta.id = makeCurrencyId();
      data.currencies.push(meta);
    }
  }
  const balances = (v.balances && typeof v.balances === 'object') ? v.balances as Record<string, unknown> : {};
  for (const c of data.currencies) {
    const n = Number(balances[c.id]);
    data.balances[c.id] = Number.isFinite(n) ? n : 0;
  }
  const common = typeof v.commonId === 'string' ? v.commonId : null;
  data.commonId = common && data.currencies.some(c => c.id === common) ? common : (data.currencies[0]?.id ?? null);
  if (Array.isArray(v.ledger)) {
    for (const item of v.ledger) {
      const e = normalizeLedgerEntry(item);
      if (e) data.ledger.push(e);
    }
    if (data.ledger.length > LEDGER_MAX) data.ledger.length = LEDGER_MAX;
  }
  if (v.extractedFloors && typeof v.extractedFloors === 'object') {
    for (const [k, val] of Object.entries(v.extractedFloors as Record<string, unknown>)) {
      if (val === true) data.extractedFloors[k] = true;
    }
  }
  return data;
}

function normalizeLedgerEntry(raw: unknown): CurrencyLedgerEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const currencyId = String(v.currencyId ?? '');
  const delta = Number(v.delta);
  const balanceAfter = Number(v.balanceAfter);
  if (!currencyId || !Number.isFinite(delta) || !Number.isFinite(balanceAfter)) return null;
  const source = (['prose', 'phone-out', 'phone-in', 'rp-open', 'shop', 'manual'] as readonly string[]).includes(String(v.source))
    ? v.source as CurrencySource : 'manual';
  return {
    ts: Number(v.ts) || 0,
    ...(typeof v.storyTime === 'string' && v.storyTime ? { storyTime: v.storyTime.slice(0, 60) } : {}),
    currencyId,
    currencyName: String(v.currencyName ?? '').slice(0, 20),
    delta,
    balanceAfter,
    source,
    note: String(v.note ?? '').slice(0, 80),
    ...(typeof v.floorId === 'string' && v.floorId ? { floorId: v.floorId } : {}),
  };
}

export function makeCurrencyId(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** 余额千分位 + 精度格式化（整数币不带小数，两位币固定两位）。 */
export function fmtQty(precision: 0 | 2, n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  const v = precision === 2 ? safe.toFixed(2) : String(Math.round(safe));
  const parts = v.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

/** 缩略档位（升序）：万(1e4) → 亿(1e8) → 万亿(1e12)。上限口径与正文提取的 PROSE_AMOUNT_MAX 一致，
 *  再大继续用「万亿」档、整数位自然增长（1234.56万亿）。 */
const QTY_SHORT_UNITS: ReadonlyArray<readonly [number, string]> = [[1e4, '万'], [1e8, '亿'], [1e12, '万亿']];
/** 缩略起点：不足 1 万原样显示（万档也是下面进位判定的阈值，同一常量复用）。 */
const QTY_SHORT_MIN = 1e4;

/** 大额显示的缩略写法：≥1万 → X.XX万 / X.XX亿 / X.XX万亿（恒定两位小数、四舍五入、进位跨档、保留符号）；
 *  不足 1 万直接复用 fmtQty（千分位 + 精度），所以小额显示逐字不变。
 *  **只用于显示层**：世界书余额摘要（AI 记账要精确值）、存档、手机桥数值一律仍走 fmtQty 原值。 */
export function fmtQtyShort(precision: 0 | 2, n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  const abs = Math.abs(safe);
  if (abs < QTY_SHORT_MIN) return fmtQty(precision, safe);
  let idx = 0;
  for (let i = 0; i < QTY_SHORT_UNITS.length; i++) {
    if (abs >= QTY_SHORT_UNITS[i][0]) idx = i;
  }
  let mant = Math.round((abs / QTY_SHORT_UNITS[idx][0]) * 100) / 100;
  // 四舍五入后的进位跨档：9999.9999万 → 10000.00万 应交由「亿」档显示（升序档位只可能升一级）
  if (mant >= QTY_SHORT_MIN && idx < QTY_SHORT_UNITS.length - 1) {
    idx++;
    mant = Math.round((abs / QTY_SHORT_UNITS[idx][0]) * 100) / 100;
  }
  return (safe < 0 ? '-' : '') + mant.toFixed(2) + QTY_SHORT_UNITS[idx][1];
}

/** 按名称解析币种（trim + 忽略大小写全等）；miss 返回 null。 */
export function resolveCurrencyByName(data: CurrencyData, name: string | undefined | null): CurrencyMeta | null {
  const key = String(name ?? '').trim().toLowerCase();
  if (!key) return null;
  return data.currencies.find(c => c.name.toLowerCase() === key) || null;
}

export interface AdjustResult {
  data: CurrencyData;
  entry: CurrencyLedgerEntry | null;
}

/** 余额调整（纯函数）：不钳制（允许负余额）、按精度取整、写流水。delta=0 返回 no-op。 */
export function adjustInData(
  data: CurrencyData,
  id: string,
  delta: number,
  source: CurrencySource,
  note: string,
  opts: { storyTime?: string; ts?: number; floorId?: string } = {},
): AdjustResult {
  const meta = data.currencies.find(c => c.id === id);
  if (!meta || !Number.isFinite(delta) || delta === 0) return { data, entry: null };
  const before = Number.isFinite(data.balances[id]) ? data.balances[id] : 0;
  const after = clampPrecision(before + delta, meta.precision);
  data.balances[id] = after;
  const entry: CurrencyLedgerEntry = {
    ts: opts.ts ?? Date.now(),
    ...(opts.storyTime ? { storyTime: opts.storyTime } : {}),
    currencyId: id,
    currencyName: meta.name,
    delta: clampPrecision(delta, meta.precision),
    balanceAfter: after,
    source,
    note: String(note ?? '').slice(0, 80) || (source === 'manual' ? '手动调整' : '金额变动'),
    ...(opts.floorId ? { floorId: opts.floorId } : {}),
  };
  data.ledger.unshift(entry);
  if (data.ledger.length > LEDGER_MAX) data.ledger.length = LEDGER_MAX;
  return { data, entry };
}

/** 流水行身份签名（长按删除用）：同一毫秒内可能建多条流水（同层多个标签撞 ts），只比 ts 会认错行；
 *  ts+金额+币种+备注全同 = 内容等价的条目，删哪一条都一样。ts/金额/币种 id 都不含 `|`，比对无需解析。 */
export function ledgerEntryKey(e: CurrencyLedgerEntry): string {
  return `${e.ts}|${e.delta}|${e.currencyId}|${e.note}`;
}

/** 删除一条流水（纯函数）：按签名命中（渲染之后被删/被改动 ⇒ 返回 null，调用方提示重试，不猜下标），
 *  并把该笔 delta 反冲回余额（＝把这笔记账退回去，允许反冲成负）。币种已删除的旧流水只摘条目不反冲。 */
export function removeLedgerEntryInData(data: CurrencyData, key: string): CurrencyLedgerEntry | null {
  const idx = data.ledger.findIndex(e => ledgerEntryKey(e) === key);
  if (idx < 0) return null;
  const entry = data.ledger[idx];
  data.ledger.splice(idx, 1);
  const meta = data.currencies.find(c => c.id === entry.currencyId);
  if (meta) {
    const before = Number.isFinite(data.balances[entry.currencyId]) ? data.balances[entry.currencyId] : 0;
    data.balances[entry.currencyId] = clampPrecision(before - entry.delta, meta.precision);
  }
  return entry;
}

/** 新增币种（按名称去重，忽略大小写）；初始数量 0；首个币种自动成为常用货币。 */
export function addCurrencyToData(data: CurrencyData, meta: CurrencyDraft, initialQty = 0): { data: CurrencyData; meta: CurrencyMeta | null; created: boolean } {
  const exists = data.currencies.find(c => c.name.toLowerCase() === meta.name.toLowerCase());
  if (exists) return { data, meta: exists, created: false };
  // 空串/重复 id 一律重新分配：落盘的空 id 会被 normalizeCurrencyMeta 每次读盘重造，
  // 行渲染拿到的 id 与点击回读的 id 不是同一个 ⇒ 调余额/换图标/★/删除全部按 id 查找 miss
  // （用户实测 bug：手动新建的币种"什么都不能调整"）。
  const id = meta.id && !data.currencies.some(c => c.id === meta.id) ? meta.id : makeCurrencyId();
  const stored: CurrencyMeta = { ...meta, id };
  data.currencies.push(stored);
  data.balances[id] = clampPrecision(initialQty, stored.precision);
  if (!data.commonId) data.commonId = id;
  return { data, meta: stored, created: true };
}

export function removeCurrencyFromData(data: CurrencyData, id: string): boolean {
  const idx = data.currencies.findIndex(c => c.id === id);
  if (idx < 0) return false;
  data.currencies.splice(idx, 1);
  delete data.balances[id];
  // 流水保留（条目带 currencyName 快照，删除币种后仍可读）
  if (data.commonId === id) data.commonId = data.currencies[0]?.id ?? null;
  return true;
}

export function setCommonInData(data: CurrencyData, id: string): boolean {
  if (!data.currencies.some(c => c.id === id)) return false;
  data.commonId = id;
  return true;
}

export function setIconInData(data: CurrencyData, id: string, icon: CurrencyIcon): boolean {
  const meta = data.currencies.find(c => c.id === id);
  if (!meta || !(CURRENCY_ICONS as readonly string[]).includes(icon)) return false;
  meta.icon = icon;
  return true;
}

// ─── IO 层（story feature 单键整写 + 事件广播）──────────────────

/** 脏 id 探针（读盘自愈前置）：任一币种 id 缺失/空串/重复 ⇒ true。 */
export function currencyIdsNeedRepair(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const list = (raw as { currencies?: unknown }).currencies;
  if (!Array.isArray(list)) return false;
  const seen = new Set<string>();
  for (const item of list) {
    const id = item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined;
    if (typeof id !== 'string' || !id) return true;
    if (seen.has(id)) return true;
    seen.add(id);
  }
  return false;
}

function readCurrencyData(): CurrencyData {
  const raw = readStoryFeature(CURRENCY_STORY_KEY, emptyCurrencyData());
  const data = normalizeCurrencyData(raw);
  // 自愈旧版脏数据（空串/重复 id）：只写 id、不加事件与投影派发——内容未变，仅让 id 落定，
  // 否则每次读盘重造随机 id，存量损坏存档在 UI 上永远修不回来（删除也按 id miss）。
  if (currencyIdsNeedRepair(raw)) void writeStoryFeature(CURRENCY_STORY_KEY, data);
  return data;
}


function persistCurrencyData(data: CurrencyData): void {
  void writeStoryFeature(CURRENCY_STORY_KEY, data);
  try { window.dispatchEvent(new CustomEvent(CURRENCY_CHANGED_EVENT)); } catch (_e) { /* 非浏览器环境（测试） */ }
  // 跨 bundle 广播：小手机经宿主桥（__ub_currency_host）读余额，变更须送达 [自身, parent] 双窗
  for (const w of topWindowCandidates()) {
    try { (w as { dispatchEvent?: (e: unknown) => void }).dispatchEvent?.(new CustomEvent(CURRENCY_HOST_CHANGED_EVENT)); } catch (_e) { /* ignore */ }
  }
  // 世界书余额摘要节流重建（防抖 ≥5s；无注册表/未启用时投影侧自身短路）——U34：改走规范库
  dispatchCurrencyWbProjection();
}

/** 整写持久化（currency-prose 提取器整层应用后复用同一广播链）。 */
export function persistCurrency(data: CurrencyData): void {
  persistCurrencyData(data);
}


/** 状态栏 chip / 弹窗共享的同步快照。 */
export function listCurrencies(): CurrencyMeta[] {
  return readCurrencyData().currencies;
}

export function currencyDataSnapshot(): CurrencyData {
  return readCurrencyData();
}

/** O37(第十一轮)：渲染签名专用的货币显示摘要——常用币 + 全部余额（键排序稳定）。
 *  F51(第十二轮)：补币种 meta（名/图标/精度）——状态栏 chip 直接显示 name/icon/precision，
 *  改名/换图标/改小数位时余额与常用币都没变，原摘要不翻 ⇒ 脏检查跳过 ⇒ chip 停在旧值。
 *  其变化必翻签名；货币无关的 story 写不再连带重渲。对象小（数币种+百条流水上限），签名频率可承受。 */
export function currencyDisplayDigest(): string {
  const data = readCurrencyData();
  const balances = Object.keys(data.balances).sort()
    .map(k => k + ':' + data.balances[k]).join(',');
  const metas = data.currencies
    .map(c => c.id + ':' + c.name + ':' + c.icon + ':' + c.precision).join(',');
  return (data.commonId || '-') + '|' + balances + '|' + metas;
}

export function balanceOf(id: string): number {
  const data = readCurrencyData();
  const n = data.balances[id];
  return Number.isFinite(n) ? n : 0;
}

export function commonCurrency(): CurrencyMeta | null {
  const data = readCurrencyData();
  return data.currencies.find(c => c.id === data.commonId) || data.currencies[0] || null;
}

/**
 * 成就取数口（L13）：**当前对话里最高的币种余额**（欠款不算存量 → 负数按 0 计）。
 * 口径：账本按聊天独立，跨对话相加无意义，故只取本对话最高币种；
 * 货币开关关闭时直接返回 0（不读盘）——引用它的两条成就解锁后引擎自动短路。
 */
export function currencyBalancePeak(): number {
  try {
    if (getConfig().currencyEnabled !== true) return 0;
    const data = currencyDataSnapshot();
    let max = 0;
    for (const c of data.currencies) {
      const n = data.balances[c.id];
      if (Number.isFinite(n) && (n as number) > max) max = n as number;
    }
    return max;
  } catch (_e) { return 0; }
}

export function resolveCurrency(name: string | undefined | null): CurrencyMeta | null {
  return resolveCurrencyByName(readCurrencyData(), name);
}

function currentStoryTime(): string | undefined {
  try {
    const t = readStoryClockRaw();
    return t ? String(t).slice(0, 60) : undefined;
  } catch (_e) { return undefined; }
}

/**
 * 成就打点（L13）：桥不在（未启用成就 / 非浏览器）时静默跳过，零成本。
 * 铁律：payload 里**不得出现数字型 `amount` 键**——引擎对 `amount` 会按金额累加计数，
 * 笔数计数器会被金额灌爆；金额字段统一叫 `qty`（笔数 +1）。
 */
function emitCurrencyAchievement(event: string, payload: Record<string, unknown>): void {
  try { (window as any).__ubEmitAchievement?.(event, payload); } catch (_e) { /* ignore */ }
}

/** 账本打点 payload（纯函数，便于单测；铁律：金额字段叫 `qty`，绝不叫 `amount`）。 */
export function ledgerAchievementPayload(entry: CurrencyLedgerEntry, before: number): Record<string, string | number> {
  return {
    dir: entry.delta >= 0 ? 'in' : 'out',
    qty: Math.abs(entry.delta),
    source: entry.source,
    currency: entry.currencyName,
    bal: entry.balanceAfter,
    ...(entry.balanceAfter < 0 ? { neg: 1 } : {}),
    ...(before < 0 && entry.balanceAfter >= 0 ? { cleared: 1 } : {}),
  };
}

/** 账本写成功后的打点（方向 / 单笔金额 / 记完余额 / 是否欠款 / 是否还清 / 来源 / 币种名）。 */
function emitLedgerAchievement(entry: CurrencyLedgerEntry, before: number): void {
  emitCurrencyAchievement('currency_ledger', ledgerAchievementPayload(entry, before));
}

/** AI 造币成功打点（成就「凭空造钱」）。 */
export function emitCurrencyAiMinted(): void {
  emitCurrencyAchievement('currency_ai_generated', {});
}

export function adjust(id: string, delta: number, source: CurrencySource, note: string, floorId?: string): CurrencyLedgerEntry | null {
  const data = readCurrencyData();
  const rawBefore = data.balances[id];
  const before = Number.isFinite(rawBefore) ? (rawBefore as number) : 0; // adjustInData 原地改，先取
  const { data: next, entry } = adjustInData(data, id, delta, source, note, { storyTime: currentStoryTime(), floorId });
  if (entry) {
    persistCurrencyData(next);
    emitLedgerAchievement(entry, before);
  }
  return entry;
}

/** 删除一条流水并反冲余额（长按流水行）：命中即整写 + 广播（世界书余额摘要随防抖重建）。 */
export function removeLedgerEntry(key: string): CurrencyLedgerEntry | null {
  const data = readCurrencyData();
  const entry = removeLedgerEntryInData(data, key);
  if (entry) persistCurrencyData(data);
  return entry;
}

export function addCurrency(meta: CurrencyDraft, initialQty = 0): { meta: CurrencyMeta | null; created: boolean } {
  const data = readCurrencyData();
  const { data: next, meta: added, created } = addCurrencyToData(data, meta, initialQty);
  if (created) {
    persistCurrencyData(next);
    // 币种数（含新加这枚）——「三币在囊 / 万国通货」按 count 门槛判定
    emitCurrencyAchievement('currency_created', { count: next.currencies.length, currency: added?.name || meta.name });
  }
  return { meta: added, created };
}

export function removeCurrency(id: string): boolean {
  const data = readCurrencyData();
  const meta = data.currencies.find(c => c.id === id);
  const had = Number(data.balances[id]) || 0;
  const ok = removeCurrencyFromData(data, id);
  if (ok) {
    persistCurrencyData(data);
    // 只在「删掉还有余额的币种」时打点（成就「覆水难收」）
    if (had !== 0) emitCurrencyAchievement('currency_removed', { hadBalance: 1, currency: meta?.name || '' });
  }
  return ok;
}

export function setCommonCurrency(id: string): boolean {
  const data = readCurrencyData();
  const ok = setCommonInData(data, id);
  if (ok) persistCurrencyData(data);
  return ok;
}

export function setCurrencyIcon(id: string, icon: CurrencyIcon): boolean {
  const data = readCurrencyData();
  const ok = setIconInData(data, id, icon);
  if (ok) persistCurrencyData(data);
  return ok;
}

export function updateCurrencyMeta(id: string, patch: Partial<Pick<CurrencyMeta, 'name' | 'desc' | 'precision'>>): boolean {
  const data = readCurrencyData();
  const meta = data.currencies.find(c => c.id === id);
  if (!meta) return false;
  if (typeof patch.name === 'string' && patch.name.trim()) meta.name = patch.name.trim().slice(0, 20);
  if (typeof patch.desc === 'string') meta.desc = patch.desc.slice(0, 60);
  if (patch.precision === 0 || patch.precision === 2) meta.precision = patch.precision;
  persistCurrencyData(data);
  return true;
}

export function currentCurrencyFloorKey(mesId: string): string {
  return `${getCurrentStoryChatKey()}#${mesId}`;
}

/** F39(第十一轮，用户方案)：正文提取楼层标记的滚动窗口修剪——只保留当前聊天最近
 * keep 层的标记，其余（含**其它聊天**的陈旧键）全部淘汰。
 * 为什么窗口足够：提取只由 MESSAGE_RECEIVED 驱动、且只读**最新**一层（runCurrencyProseExtraction），
 * 标记真正拦的是「同一楼层重复触发」（重生成/swipe 后同 mesId 再来一次）——最新层永远在窗口内。
 * 已接受的边界（用户口径）：删除超过 keep 层后再重生成旧楼层，标记已淘汰可能重复记账
 * （流水条目自带 floorId 可溯源）；触发条件极窄，不做额外防护。 */
export function pruneExtractedFloors(data: CurrencyData, keep = 10): void {
  const prefix = `${getCurrentStoryChatKey()}#`;
  const keys: Array<{ key: string; mesId: number }> = [];
  for (const key of Object.keys(data.extractedFloors)) {
    if (!key.startsWith(prefix)) { delete data.extractedFloors[key]; continue; }
    const mesId = Number(key.slice(prefix.length));
    keys.push({ key, mesId: Number.isFinite(mesId) ? mesId : -1 });
  }
  if (keys.length <= keep) return;
  keys.sort((a, b) => b.mesId - a.mesId);
  for (let i = keep; i < keys.length; i++) delete data.extractedFloors[keys[i].key];
}

/** 币种名 → 手机/标签显示金额（"520" / "520 上品灵石"）。 */
export function currencyAmountText(amount: number | string, meta: { name: string; precision: 0 | 2 } | null): string {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  return meta ? `${fmtQty(meta.precision, safe)} ${meta.name}` : String(safe);
}

