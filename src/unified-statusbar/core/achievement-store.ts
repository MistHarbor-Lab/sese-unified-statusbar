// ===== 成就系统 · 持久化存储（成就簿） =====
// 详见 docs/superpowers/specs/2026-06-27-achievement-system-design.md §3
//
// 存储载体：外部成就簿文件（usb_g_achievements_* snapshot+segment 协议），
//   与偏好/配置同为外部全局对象存储；V2-only，无 extensionSettings/localStorage 回退。
//
// 内存模型：init 时一次性读入内存 → 扫描全操作内存（零 I/O）→ 同一微任务内合并后串行确认回写。
// 解锁不触发状态栏重渲染（成就数据不入渲染签名）。
import type { AchievementBook, LogEntry } from './achievement-types';
import { plainClone } from './deep-clone';
import type { ExternalObjectStore } from './external-object-store';
import { getCurrentCardName } from './current-card';
import { currentSillyChatId } from './env';

const SCHEMA_VERSION = 1 as const;
function emptyBook(): AchievementBook {
  return {
    schema: SCHEMA_VERSION,
    seeded: false,
    unlockedIds: [],
    unlockedAt: {},
    unlockedCard: {},
    counters: {},
    lastSeen: {},
    chatLastSeen: {},
    individualBaselines: {},
    streaks: {},
    sessionStartTs: 0,
    dailyCounters: {},
    windowCounters: {},
    log: [],
  };
}

// ===== 内存态 =====
let _book: AchievementBook | null = null;
let _unlocked: Set<string> = new Set();
let _dirty = false;
let _writeScheduled = false;
let _writeChain: Promise<boolean> = Promise.resolve(true);
let _externalStore: ExternalObjectStore | null = null;
let _persistedBook: AchievementBook | null = null;
/** 修订令牌：任何改变已解锁集合的操作（载入/解锁/重置）推进一次，供派生态按令牌记忆。 */
let _revision = 0;

export function configureAchievementStorage(
  store: ExternalObjectStore | null,
): void {
  _externalStore = store;
  _book = null;
  _unlocked = new Set();
  _dirty = false;
  _writeScheduled = false;
  _writeChain = Promise.resolve(true);
  _persistedBook = null;
}

/** 兼容读取 SillyTavern 当前聊天标识（用于 LogEntry.chatId）。
 *  U32：与 achievement-engine 的逐字双胞胎收编为 env.currentSillyChatId（此处薄别名保调用点）。 */
function currentChatId(): string | undefined {
  return currentSillyChatId();
}

// ===== 归一化（外部读取仍走） =====
function normalizeBook(raw: Record<string, any>): AchievementBook {
  const b = emptyBook();
  if (typeof raw.schema === 'number') b.schema = raw.schema as 1;
  if (typeof raw.seeded === 'boolean') b.seeded = raw.seeded;
  if (Array.isArray(raw.unlockedIds)) b.unlockedIds = raw.unlockedIds.filter((x: any) => typeof x === 'string');
  if (raw.unlockedAt && typeof raw.unlockedAt === 'object') {
    for (const k in raw.unlockedAt) if (typeof raw.unlockedAt[k] === 'string') b.unlockedAt[k] = raw.unlockedAt[k];
  }
  if (raw.unlockedCard && typeof raw.unlockedCard === 'object') {
    for (const k in raw.unlockedCard) if (typeof raw.unlockedCard[k] === 'string') b.unlockedCard[k] = raw.unlockedCard[k];
  }
  if (raw.counters && typeof raw.counters === 'object') {
    for (const k in raw.counters) if (typeof raw.counters[k] === 'number') b.counters[k] = raw.counters[k];
  }
  if (raw.lastSeen && typeof raw.lastSeen === 'object') {
    for (const k in raw.lastSeen) if (typeof raw.lastSeen[k] === 'number') b.lastSeen[k] = raw.lastSeen[k];
  }
  if (raw.chatLastSeen && typeof raw.chatLastSeen === 'object') {
    // { chatId: { counterName: number } }，仅保留数字值
    for (const cid in raw.chatLastSeen) {
      const m = raw.chatLastSeen[cid];
      if (m && typeof m === 'object') {
        const clean: Record<string, number> = {};
        for (const cn in m) if (typeof m[cn] === 'number') clean[cn] = m[cn];
        if (Object.keys(clean).length) b.chatLastSeen[cid] = clean;
      }
    }
  }
  if (raw.individualBaselines && typeof raw.individualBaselines === 'object') {
    // { counter: { name: number } }，仅保留数字值
    for (const cn in raw.individualBaselines) {
      const m = raw.individualBaselines[cn];
      if (m && typeof m === 'object') {
        const clean: Record<string, number> = {};
        for (const nm in m) if (typeof m[nm] === 'number') clean[nm] = m[nm];
        if (Object.keys(clean).length) b.individualBaselines[cn] = clean;
      }
    }
  }
  if (raw.streaks && typeof raw.streaks === 'object') {
    // { event: { count: number, lastTs: number } }，仅保留合法结构
    for (const ev in raw.streaks) {
      const s = raw.streaks[ev];
      if (s && typeof s === 'object' && typeof s.count === 'number' && typeof s.lastTs === 'number') {
        b.streaks[ev] = { count: s.count, lastTs: s.lastTs };
      }
    }
  }
  if (typeof raw.sessionStartTs === 'number') b.sessionStartTs = raw.sessionStartTs;
  if (raw.dailyCounters && typeof raw.dailyCounters === 'object') {
    for (const k in raw.dailyCounters) {
      const s = raw.dailyCounters[k];
      if (s && typeof s === 'object' && typeof s.date === 'string' && typeof s.count === 'number') {
        b.dailyCounters[k] = { date: s.date, count: s.count };
      }
    }
  }
  if (raw.windowCounters && typeof raw.windowCounters === 'object') {
    for (const k in raw.windowCounters) {
      const s = raw.windowCounters[k];
      if (s && typeof s === 'object' && typeof s.windowId === 'string' && typeof s.count === 'number') {
        b.windowCounters[k] = { windowId: s.windowId, count: s.count };
      }
    }
  }
  if (Array.isArray(raw.log)) {
    b.log = raw.log
      .filter((e: any) => e && typeof e.id === 'string')
      .map((e: any) => ({
        id: String(e.id),
        name: typeof e.name === 'string' ? e.name : '',
        cat: typeof e.cat === 'string' ? e.cat : '养成',
        ts: typeof e.ts === 'string' ? e.ts : '',
        ...(typeof e.chatId === 'string' ? { chatId: e.chatId } : {}),
        ...(typeof e.card === 'string' && e.card ? { card: e.card } : {}),
      } as LogEntry));
  }
  return b;
}

// ===== 写入：外部成就簿（唯一事实源） =====
async function writeSnapshot(snapshot: AchievementBook): Promise<boolean> {
  const store = _externalStore;
  if (!store) return false;
  const previous = _persistedBook || emptyBook();
  const updates: Record<string, unknown> = {};
  const current = snapshot as unknown as Record<string, unknown>;
  const before = previous as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(current)) {
    let same = false;
    try { same = JSON.stringify(value) === JSON.stringify(before[key]); } catch (_e) { /* write */ }
    if (!same) updates[key] = plainClone(value);
  }
  if (!Object.keys(updates).length) return true;
  const ok = await store.patch(updates);
  if (ok) _persistedBook = plainClone(snapshot) as AchievementBook;
  else console.error('[统一状态栏] 外部成就簿写入失败');
  return ok;
}

function enqueueWrite(): Promise<boolean> {
  if (!_book || !_dirty) return _writeChain;
  const snapshot = plainClone(_book) as AchievementBook;
  _dirty = false;
  const run = async (): Promise<boolean> => {
    const ok = await writeSnapshot(snapshot);
    if (!ok) _dirty = true;
    else if (_book) _dirty = JSON.stringify(_book) !== JSON.stringify(snapshot);
    return ok;
  };
  _writeChain = _writeChain.then(run, run);
  return _writeChain;
}

function scheduleWrite(): void {
  if (_writeScheduled) return;
  _writeScheduled = true;
  queueMicrotask(() => {
    if (!_writeScheduled) return;
    _writeScheduled = false;
    void enqueueWrite();
  });
}

// ===== 公开 API =====

/** 初始化：一次性读入内存。状态栏 init 时调用。 */
export function loadAchievementStore(): void {
  if (_book) return;
  _book = normalizeBook(_externalStore?.readAll() || {});
  _unlocked = new Set(_book.unlockedIds);
  _dirty = false;
  _persistedBook = plainClone(_book) as AchievementBook;
  _revision++;
}

/**
 * 成就簿修订令牌（单调递增）。任何会改变「已解锁集合」的操作（载入/批量解锁/重置）都会推进。
 * 用途：派生态（如 core/achievement-tier.ts 的段位快照）按此令牌记忆，扫描期重复调用零重算。
 */
export function getBookRevision(): number { return _revision; }

/** 取内存成就簿（只读视图，勿直接改）。 */
export function getBook(): AchievementBook {
  if (!_book) loadAchievementStore();
  return _book!;
}

/** 是否已解锁某成就。O(1)。 */
export function isUnlocked(id: string): boolean { return _unlocked.has(id); }

/** 当前 snapshot-delta 计数器值。 */
export function getCounter(name: string): number { return _book?.counters[name] ?? 0; }
/** 当前 snapshot-delta 上次快照值。 */
export function getLastSeen(name: string): number { return _book?.lastSeen[name] ?? 0; }

/** 把内置计数器 +1（feature-event 增量推进用）。返回累加后的值。 */
export function bumpCounter(name: string, by = 1): number {
  if (!_book) loadAchievementStore();
  _book!.counters[name] = (_book!.counters[name] ?? 0) + by;
  _dirty = true;
  scheduleWrite();
  return _book!.counters[name] ?? 0;
}

/**
 * snapshot-delta 单调 floor 守护累加。
 * 仅当 current >= lastSeen 才累加 delta；否则（切到进度较小的聊天）保持不变。
 * 返回累加后的计数器值。负责更新 lastSeen。
 */
export function advanceCounter(name: string, current: number): number {
  if (!_book) loadAchievementStore();
  const last = _book!.lastSeen[name] ?? 0;
  // 「相等」也是无变化。旧写法用 current >= last ⇒ 数值没动也标脏 + scheduleWrite，
  // 微任务随即把**整本成就簿深拷贝**一遍（enqueueWrite）再逐栏序列化比对（writeSnapshot），
  // 在 300ms tick 里纯白做（生成期约 3.3 次/秒）。current < last（切到进度较小的聊天）
  // 同样保持计数器与 lastSeen 不变（单调 floor）。
  if (current > last) {
    _book!.counters[name] = (_book!.counters[name] ?? 0) + (current - last);
    _book!.lastSeen[name] = current;
    _dirty = true;
    scheduleWrite();
  }
  return _book!.counters[name] ?? 0;
}

/**
 * 跨对话总和累加（chat-snapshot-delta 用）。
 * 与该 chatId 的基线比较：current >= 基线时，把增量累加进**全局 counter**（跨对话总和）；
 * current < 基线（该对话数据被删/回退）时，更新基线为 current 但不回退全局 counter（只增不减，避免误删导致虚减）。
 * 各对话有独立基线，故 A 对话 300 + B 对话 200 = 全局 500。
 * chatId 取不到时回退为全局单基线（退化为 snapshot-delta 语义）。
 */
export function advanceChatCounter(name: string, chatId: string | undefined, current: number): number {
  if (!_book) loadAchievementStore();
  const key = chatId || '__global__';
  const perChat = _book!.chatLastSeen[key] || (_book!.chatLastSeen[key] = {});
  const last = perChat[name] ?? 0;
  let changed = false;
  if (current > last) {
    _book!.counters[name] = (_book!.counters[name] ?? 0) + (current - last);
    changed = true;
  }
  // 该对话基线记录最新进度：值确实变了才算变更。
  // 旧写法无条件 perChat[name] = current + 标脏 ⇒ 数值未变也每 tick 触发整本深拷贝空写。
  if (perChat[name] !== current) {
    perChat[name] = current;
    changed = true;
  }
  if (changed) {
    _dirty = true;
    scheduleWrite();
  }
  return _book!.counters[name] ?? 0;
}

/**
 * 平移当前对话的 chat-snapshot-delta 基线，不修改累计 counter。
 * 用于人物表迁移等“分类调整”：迁移前后 getter 的差值只应改变基线，
 * 不能被下一次扫描误计为新拥有/新结识进度。
 */
export function shiftChatCounterBaselines(
  chatId: string | undefined,
  deltas: Record<string, number>,
): void {
  if (!_book) loadAchievementStore();
  const key = chatId || '__global__';
  const perChat = _book!.chatLastSeen[key] || (_book!.chatLastSeen[key] = {});
  let changed = false;
  for (const name of Object.keys(deltas)) {
    const delta = deltas[name];
    if (!Number.isFinite(delta) || delta === 0) continue;
    perChat[name] = (perChat[name] ?? 0) + delta;
    changed = true;
  }
  if (!changed) return;
  _dirty = true;
  scheduleWrite();
}

/**
 * snapshot-delta lastSeen 重锚：把全局 lastSeen **设为** snapshotValues（绝对值覆盖）。
 * 用于切卡/首载角色卡——新卡快照（如 gacha 已抽集合大小）直接写入 lastSeen，
 * 使新卡已有进度不计为新增；游玩过程中的真实增量仍正常累计（advanceCounter 后续累加）。
 * counter 全局累计值不动（旧卡已累计的保留）。
 */
export function rebaseSnapshotLastSeen(snapshotValues: Record<string, number>): void {
  if (!_book) loadAchievementStore();
  if (!Object.keys(snapshotValues).length) return;
  let changed = false;
  for (const name of Object.keys(snapshotValues)) {
    const v = snapshotValues[name];
    if (!Number.isFinite(v)) continue;
    if (_book!.lastSeen[name] !== v) { _book!.lastSeen[name] = v; changed = true; }
  }
  if (!changed) return;
  _dirty = true;
  scheduleWrite();
}

/**
 * 切卡重锚：把指定 chatId 的 chat-snapshot-delta 基线**设为** snapshotValues（绝对值覆盖，非平移）。
 * 用于切卡/首载角色卡——新卡存量快照直接写入基线，使该卡已有数据不被下一次扫描误计为新增，
 * 后续游玩增量仍正常累计。counter 全局累计值不动（旧卡已累计的保留）。
 */
export function rebaseChatCounterBaselines(
  chatId: string | undefined,
  snapshotValues: Record<string, number>,
): void {
  if (!_book) loadAchievementStore();
  if (!Object.keys(snapshotValues).length) return;
  const key = chatId || '__global__';
  const perChat = _book!.chatLastSeen[key] || (_book!.chatLastSeen[key] = {});
  let changed = false;
  for (const name of Object.keys(snapshotValues)) {
    const v = snapshotValues[name];
    if (!Number.isFinite(v)) continue;
    if (perChat[name] !== v) { perChat[name] = v; changed = true; }
  }
  if (!changed) return;
  _dirty = true;
  scheduleWrite();
}

/**
 * 强制重置 session-duration 会话起始时间戳（切卡时调用：连续游玩在新卡重新计时）。
 * 区别于 setSessionStartTs（仅 0 时写入），此处无条件清零。
 */
export function resetSessionStart(): void {
  if (!_book) loadAchievementStore();
  _book!.sessionStartTs = 0;
  _dirty = true;
  scheduleWrite();
}

/**
 * 基线种子：升级用户首扫，用当前快照填入 lastSeen、置 seeded=true，
 * 但不解锁任何 snapshot-delta 成就。新用户天然基线 0。
 */
export function seedBaseline(snapshotValues: Record<string, number>): void {
  if (!_book) loadAchievementStore();
  if (_book!.seeded) return;
  for (const k in snapshotValues) {
    _book!.lastSeen[k] = snapshotValues[k];
    _book!.counters[k] = _book!.counters[k] ?? 0;
  }
  _book!.seeded = true;
  _dirty = true;
  scheduleWrite();
}
export function isSeeded(): boolean { return !!_book?.seeded; }

/**
 * individuals-delta 个体基线访问。
 * - getIndividualBaseline(counter, name)：取某个体当前基线，无则返回 null（表示新人/无记录）。
 * - setIndividualBaselines(counter, map)：用 map 整体覆盖某 counter 的基线桶（离场者自动从桶中移除）。
 */
export function getIndividualBaseline(counter: string, name: string): number | null {
  const m = _book?.individualBaselines?.[counter];
  if (!m || typeof m[name] !== 'number') return null;
  return m[name];
}
export function setIndividualBaselines(counter: string, map: Record<string, number>): void {
  if (!_book) loadAchievementStore();
  _book!.individualBaselines[counter] = map;
  _dirty = true;
  scheduleWrite();
}

/**
 * streak-window 连击状态访问。
 * - getStreak(event)：取某事件当前连击 { count, lastTs }，无则返回 null（首次/无记录）。
 * - setStreak(event, count, ts)：写入某事件的连击状态。
 * 按 event 命名空间共享：同 event 的多条不同 value 成就共享一个 count。
 */
export function getStreak(event: string): { count: number; lastTs: number } | null {
  const s = _book?.streaks?.[event];
  if (!s || typeof s.count !== 'number' || typeof s.lastTs !== 'number') return null;
  return s;
}
export function setStreak(event: string, count: number, lastTs: number): void {
  if (!_book) loadAchievementStore();
  _book!.streaks[event] = { count, lastTs };
  _dirty = true;
  scheduleWrite();
}

/**
 * session-duration 会话首扫时间戳。
 * - getSessionStartTs()：取当前会话起始时间戳（毫秒），未记录返回 0。
 * - setSessionStartTs(ts)：写入会话起始时间戳（仅当当前值为 0 时才写，避免重复覆盖）。
 */
export function getSessionStartTs(): number {
  return _book?.sessionStartTs ?? 0;
}
export function setSessionStartTs(ts: number): void {
  if (!_book) loadAchievementStore();
  if (_book!.sessionStartTs === 0) {
    _book!.sessionStartTs = ts;
    _dirty = true;
    scheduleWrite();
  }
}

/**
 * 批量解锁。更新内存（unlockedIds/log/unlockedAt/unlockedCard 由本函数维护）+ 标脏回写。
 * ts = 游戏内时间字符串；chatId 可选。返回新解锁的条目（供 UI 弹通知）。
 */
export function unlockBatch(entries: { id: string; name: string; cat: LogEntry['cat']; ts: string }[]): LogEntry[] {
  if (!_book) loadAchievementStore();
  const newEntries: LogEntry[] = [];
  const chatId = currentChatId();
  const card = getCurrentCardName();
  for (const e of entries) {
    if (_unlocked.has(e.id)) continue;
    _unlocked.add(e.id);
    _book!.unlockedIds.push(e.id);
    _book!.unlockedAt[e.id] = e.ts;
    if (card) _book!.unlockedCard[e.id] = card;
    const entry: LogEntry = {
      id: e.id, name: e.name, cat: e.cat, ts: e.ts,
      ...(chatId ? { chatId } : {}),
      ...(card ? { card } : {}),
    };
    _book!.log.push(entry);
    newEntries.push(entry);
  }
  if (newEntries.length) { _dirty = true; _revision++; scheduleWrite(); }
  return newEntries;
}

/** 立即落盘；返回值表示本次快照是否获得外部文件确认。 */
export async function flushNow(): Promise<boolean> {
  _writeScheduled = false;
  const ok = await enqueueWrite();
  await _externalStore?.flush?.();
  return ok && !_dirty;
}

/**
 * 重置成就簿：原地清空所有已解锁记录、计数器与进度基线，立即落盘。
 * 仅处理 store 侧；调用方需另行调用引擎 resetSession() 清会话内种子标记与 pending 事件队列，
 * 使下次扫描用当前快照重埋基线（seeded=false → maybeSeed）。
 */
export async function resetAchievements(): Promise<boolean> {
  if (!_book) loadAchievementStore();
  _writeScheduled = false;
  const previous = plainClone(_book) as AchievementBook;
  _book!.seeded = false;
  _book!.unlockedIds = [];
  _book!.unlockedAt = {};
  _book!.unlockedCard = {};
  _book!.counters = {};
  _book!.lastSeen = {};
  _book!.chatLastSeen = {};
  _book!.individualBaselines = {};
  _book!.streaks = {};
  _book!.sessionStartTs = 0;
  _book!.dailyCounters = {};
  _book!.windowCounters = {};
  _book!.log = [];
  _unlocked = new Set<string>();
  _dirty = false;
  _revision++;
  const snapshot = plainClone(_book) as AchievementBook;
  const run = async (): Promise<boolean> => {
    const ok = Boolean(_externalStore)
      && await _externalStore!.replaceAll(snapshot as unknown as Record<string, unknown>);
    if (ok) {
      _persistedBook = snapshot;
      return true;
    }
    _book = previous;
    _unlocked = new Set(previous.unlockedIds);
    _revision++;
    console.error('[统一状态栏] 外部成就簿重置失败');
    return false;
  };
  _writeChain = _writeChain.then(run, run);
  return _writeChain;
}

/** 取当天行为计数器（纯读，无副作用）。返回 {date, count} 或 null（今天未发生过）。 */
export function getDailyCounter(action: string): { date: string; count: number } | null {
  if (!_book) loadAchievementStore();
  const slot = _book!.dailyCounters[action];
  if (!slot) return null;
  return { date: slot.date, count: slot.count };
}

/** 推进当天行为计数器（消费 action-on-date 时调用）。跨天自动清零。 */
export function bumpDailyCounter(action: string, today: string): void {
  if (!_book) loadAchievementStore();
  const slot = _book!.dailyCounters[action] || (_book!.dailyCounters[action] = { date: today, count: 0 });
  if (slot.date !== today) { slot.date = today; slot.count = 0; }
  slot.count += 1;
  _dirty = true;
  scheduleWrite();
}

/** 取季节窗口行为计数器（纯读，无副作用）。返回 {windowId, count} 或 null（当前未推进过）。 */
export function getWindowCounter(action: string): { windowId: string; count: number } | null {
  if (!_book) loadAchievementStore();
  const slot = _book!.windowCounters[action];
  if (!slot) return null;
  return { windowId: slot.windowId, count: slot.count };
}

/**
 * 推进季节窗口行为计数器（消费 action-on-date 时与 bumpDailyCounter 并排调用）。
 * 窗口标识 windowId 不符（季节切换或跨年同季节）时自动清零重计。与 dailyCounters 独立（windowCounters 管季节窗口、dailyCounters 管当天）。
 */
export function bumpWindowCounter(action: string, windowId: string): void {
  if (!_book) loadAchievementStore();
  const slot = _book!.windowCounters[action] || (_book!.windowCounters[action] = { windowId, count: 0 });
  if (slot.windowId !== windowId) { slot.windowId = windowId; slot.count = 0; }
  slot.count += 1;
  _dirty = true;
  scheduleWrite();
}
