// ===== 月信与孕育系统 · 持久化存储（周期簿） =====
// 详见 docs/经期孕期功能设计.md §1
//
// 主存储载体：当前聊天故事楼层 features.cycle。
//
// 内存模型：init 时一次性读入内存 → 引擎全操作内存（零 I/O）→ 日期变更时标脏 → 立即/防抖回写。
// schema 2 按规范化姓名分桶：{ [nameKey]: CycleRecord }，人物跨角色表迁移仍沿用同一记录。
import { normalizeCycleName, clampInt } from './cycle-eligibility';
import { getCurrentStoryChatKey, hasStoryFeature, readStoryFeature, writeStoryFeature, isStoryStorageReady } from './story-floor-store';
import { compareDateKey } from './calendar-core';

const CYCLE_STORY_KEY = 'cycle';
const SCHEMA_VERSION = 2 as const;
const WRITE_DEBOUNCE_MS = 800;

/** 日期键正则：YYYY-MM-DD（严格两位月日；年份幅值 4-6 位——负年份为公元前、五位以上为远未来纪年，同 calendar-core formatYear） */
const DATE_KEY_RE = /^-?\d{4,6}-\d{2}-\d{2}$/;

/** 合法的经期阶段值（pendingSexForm.phase 校验用，与 cycle-engine.CyclePhase 一致）。 */
const VALID_PHASES: ReadonlyArray<string> = ['menstrual', 'follicular', 'ovulation', 'luteal'];

// ═══════════════════════════════════════════════════════════════
// 数据结构
// ═══════════════════════════════════════════════════════════════

/**
 * 孕期状态（仅 full 档产生）。null = 未受孕（state 隐式 'none'）。
 * 受孕结果在性爱后（日期变更处理时）即算法落定存 store，对玩家隐藏；
 * 玩家只在后续验孕弹窗被告知（§3.4）。
 */
export interface PregnancyState {
  state: 'pregnant' | 'postpartum'; // 'none' 由外层 null 表示
  conceiveDate: string;             // 受孕日（算法落定日）"YYYY-MM-DD"
  lmp: string;                      // 末次月经开始日（算预产期）"YYYY-MM-DD"
  expectedDueDate: string;          // = lmp + 280 天（Naegele 法）"YYYY-MM-DD"
  postpartumUntil: string | null;   // postpartum 专用：恢复经期的日期
  weeks: number;                    // 当前孕周（1-based，日期变更时推进）
  milestones: string[];             // 已触发里程碑 id（trimester_2/trimester_3/first_kick）
  confirmed: boolean;               // 玩家是否已验孕知晓（验孕弹窗点击后置 true）
  // 终止记录：null = 正常足月分娩（未终止）；对象 = 人工终止。
  // postpartum 期间区分「产后恢复」与「小产后恢复」世界书文案；成就派发依据。
  termination: {
    kind: 'abortion';                              // 终止类型（后续迭代可扩展 'miscarriage'）
    method: 'medical' | 'surgical' | 'induction';  // 堕胎方式：药流 / 人流 / 引产
    date: string;                                  // 终止日期 "YYYY-MM-DD"
  } | null;
}

/**
 * 受孕形式弹窗「待确认」快照（仅 full + always_ask 产生）。
 * 弹窗显示时存此字段，玩家点击后清空。作用：弹窗显示的那一刻 lastSeenSexCount 基线已推进、
 * 但掷骰推迟到点击回调——若此时酒馆闪退/误关/切卡，内存态 _sexFormPending 丢失且 Δ 已被吞。
 * 持久化此快照后，重载由 reconcilePendingSexForm 据此重新弹窗/掷骰，确保事件不丢。
 */
export interface PendingSexForm {
  delta: number;        // 触发时的性爱次数增量（掷骰次数，≥1；弹窗开着期间累积新 Δ）
  phase: string;        // 触发时所处的经期阶段（menstrual/follicular/ovulation/luteal），掷骰 baseRisk 用
  conceiveDate: string; // 触发日期 "YYYY-MM-DD"（= 受孕落定日，掷骰 today 用）
}

/** 单个角色的周期记录。P2 pregnancy 为联合类型（null=未受孕）。 */
export interface CycleRecord {
  baseCycleLength: number;      // 个人周期基准；新人物加权 random(24,35)，旧记录回退为原 cycleLength
  cycleLength: number;          // 当前这一轮周期长度；每轮围绕 baseCycleLength ±2 天
  periodLength: number;         // 经期天数；新人物加权 random(5,8)，旧记录原样兼容
  regularity: 'stable' | 'irregular';
  lastPeriodStart: string;      // "YYYY-MM-DD" 最近一次经期开始日
  periodHistory: string[];      // 历次经期开始日（升序，保留最近 12 条）
  isOnPeriod: boolean;          // 当前是否在经期（缓存，日期变更时写）
  pregnancy: PregnancyState | null; // null=未受孕；对象=已受孕/产后
  pendingSexForm: PendingSexForm | null; // 受孕形式弹窗待确认快照（null=无待确认）；崩溃/重载恢复用
  lastSeenSexCount: number;     // 上次见到的性爱次数，受孕感知算增量 Δ 的基线
  lastProcessedDateKey: string; // ⭐ 幂等锚：上次日期变更处理到的 "YYYY-MM-DD"
  eligibilitySuspendedAt: string | null; // 年龄暂不合格时休眠；恢复时不回放停用期间事件
}

export interface PermanentCycleExclusion {
  name: string;
  excludedAt: string;
  reason: 'manual';
}

/**
 * 生殖能力三开关的手动覆盖（对外 API 追加批次 1）。
 * 稀疏存储：只存调用方显式提供的键；缺省键按表面性别（含 sexOverrides 推导）auto 补全。
 * 交互归一化（canGestate⇒hasCycle / !hasCycle⇒!canGestate）在读侧/写入函数执行，
 * 持久层只做类型清洗，容手改数据。
 */
export interface CycleCapabilityOverride {
  hasCycle?: boolean;
  canGestate?: boolean;
  canInseminate?: boolean;
}

export interface CycleStore {
  schema: 2;
  records: Record<string, CycleRecord>;
  permanentExclusions: Record<string, PermanentCycleExclusion>;
  pendingJumpSummaries: PendingCycleJumpSummary[];
  /** 能力覆盖（追加批次 1）；与 records 同一 feature 对象，写路径同一次原子写。 */
  capabilityOverrides: Record<string, CycleCapabilityOverride>;
  /** 表面性别覆盖（追加批次 1 setFemale，仅周期/孕育域内生效）：nameKey → true=女 / false=男。 */
  sexOverrides: Record<string, boolean>;
}

export interface PendingCycleJumpSummary {
  name: string;
  gap: number;
  newPeriodStarts: string[];
  pregnancyDelta: null | 'conceived' | 'progressed' | 'delivered';
  pregnancyFromWeeks?: number;
  pregnancyToWeeks?: number;
  newMilestones: string[];
}

function emptyStore(): CycleStore {
  return {
    schema: SCHEMA_VERSION,
    records: {},
    permanentExclusions: {},
    pendingJumpSummaries: [],
    capabilityOverrides: {},
    sexOverrides: {},
  };
}

// ═══════════════════════════════════════════════════════════════
// 性别判定
// ═══════════════════════════════════════════════════════════════

/** 性别值是否为女性：含「女」或「female」（忽略大小写）。空/男/双性/扶他均不纳入（可靠性纪律）。 */
export function isFemaleGender(gender: string | null | undefined): boolean {
  if (!gender) return false;
  const g = String(gender).trim().toLowerCase();
  if (!g) return false;
  return g.includes('女') || g.includes('female');
}

// ═══════════════════════════════════════════════════════════════
// normalize：逐字段清洗 + 缺/类型错回退（仿 achievement-store.normalizeBook）
// ═══════════════════════════════════════════════════════════════

function validDateKey(s: any): s is string {
  return typeof s === 'string' && DATE_KEY_RE.test(s);
}

/** 把任意 raw 归一为合法 CycleRecord；无法识别返回 null（丢弃）。 */
function normalizeRecord(raw: any): CycleRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const cycleLength = clampInt(raw.cycleLength, 21, 45, 28);
  const baseCycleLength = clampInt(raw.baseCycleLength, 21, 45, cycleLength);
  const periodLength = clampInt(raw.periodLength, 2, 10, 5);
  const regularity: 'stable' | 'irregular' = raw.regularity === 'irregular' ? 'irregular' : 'stable';

  const lastPeriodStart = validDateKey(raw.lastPeriodStart) ? raw.lastPeriodStart : '';
  const lastProcessedDateKey = validDateKey(raw.lastProcessedDateKey) ? raw.lastProcessedDateKey : '';
  const eligibilitySuspendedAt = validDateKey(raw.eligibilitySuspendedAt) ? raw.eligibilitySuspendedAt : null;

  let periodHistory: string[] = [];
  if (Array.isArray(raw.periodHistory)) {
    const seen = new Set<string>();
    for (const d of raw.periodHistory) if (validDateKey(d) && !seen.has(d)) seen.add(d);
    periodHistory = Array.from(seen).sort(compareDateKey); // F50：dateKey 不等长，禁字符串字典序
  }
  // 保留最近 12 条
  if (periodHistory.length > 12) periodHistory = periodHistory.slice(-12);

  const isOnPeriod = raw.isOnPeriod === true;
  const lastSeenSexCount = clampInt(raw.lastSeenSexCount, 0, 1e9, 0);

  // lastPeriodStart 缺失视为非法记录（强制引擎重新冷启动）
  if (!lastPeriodStart) return null;

  // pregnancy 归一化：null/非法 → null；合法对象 → 清洗后保留
  let pregnancy: PregnancyState | null = null;
  if (raw.pregnancy && typeof raw.pregnancy === 'object') {
    const p = raw.pregnancy as any;
    const state: 'pregnant' | 'postpartum' | null =
      p.state === 'pregnant' || p.state === 'postpartum' ? p.state : null;
    const conceiveDate = validDateKey(p.conceiveDate) ? p.conceiveDate : null;
    const lmp = validDateKey(p.lmp) ? p.lmp : null;
    const expectedDueDate = validDateKey(p.expectedDueDate) ? p.expectedDueDate : null;
    const postpartumUntil = validDateKey(p.postpartumUntil) ? p.postpartumUntil : null;
    // postpartum 必须有恢复日期；旧版无日期的废弃 postpartum 记录仍安全清空。
    if (state && conceiveDate && lmp && expectedDueDate && (state !== 'postpartum' || postpartumUntil)) {
      let milestones: string[] = [];
      if (Array.isArray(p.milestones)) {
        const seen = new Set<string>();
        for (const m of p.milestones) if (typeof m === 'string' && m && !seen.has(m)) seen.add(m);
        milestones = Array.from(seen);
      }
      // termination 归一化：缺/非法 → null（旧数据无迁移成本）；合法 → 清洗保留
      let termination: PregnancyState['termination'] = null;
      if (p.termination && typeof p.termination === 'object') {
        const t = p.termination as any;
        const kind = t.kind === 'abortion' ? 'abortion' : null;
        const method = t.method === 'medical' || t.method === 'surgical' || t.method === 'induction' ? t.method : null;
        const date = validDateKey(t.date) ? t.date : null;
        if (kind && method && date) {
          termination = { kind, method, date };
        }
      }
      pregnancy = {
        state,
        conceiveDate,
        lmp,
        expectedDueDate,
        postpartumUntil,
        weeks: clampInt(p.weeks, 1, 50, 1),
        milestones,
        confirmed: p.confirmed === true,
        termination,
      };
    }
  }

  // pendingSexForm 归一化：缺关键字段（phase 非法 / conceiveDate 非法）→ 丢弃（null）
  let pendingSexForm: PendingSexForm | null = null;
  if (raw.pendingSexForm && typeof raw.pendingSexForm === 'object') {
    const psf = raw.pendingSexForm as any;
    const phase = typeof psf.phase === 'string' && VALID_PHASES.includes(psf.phase) ? psf.phase : null;
    const conceiveDate = validDateKey(psf.conceiveDate) ? psf.conceiveDate : null;
    if (phase && conceiveDate) {
      pendingSexForm = { delta: clampInt(psf.delta, 1, 1000, 1), phase, conceiveDate };
    }
  }

  return {
    baseCycleLength,
    cycleLength,
    periodLength,
    regularity,
    lastPeriodStart,
    periodHistory,
    isOnPeriod,
    pregnancy,
    pendingSexForm,
    lastSeenSexCount,
    lastProcessedDateKey,
    eligibilitySuspendedAt,
  };
}

function normalizePendingJumpSummaries(raw: unknown): PendingCycleJumpSummary[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const value = item as any;
    const pregnancyDelta = value.pregnancyDelta === 'conceived'
      || value.pregnancyDelta === 'progressed'
      || value.pregnancyDelta === 'delivered'
      ? value.pregnancyDelta
      : null;
    const summary: PendingCycleJumpSummary = {
      name: String(value.name || '').trim().slice(0, 64),
      gap: Math.max(0, Math.floor(Number(value.gap) || 0)),
      newPeriodStarts: Array.isArray(value.newPeriodStarts)
        ? value.newPeriodStarts.filter((date: unknown) => validDateKey(date)).slice(0, 24)
        : [],
      pregnancyDelta,
      newMilestones: Array.isArray(value.newMilestones)
        ? value.newMilestones.filter((id: unknown) => typeof id === 'string').slice(0, 24)
        : [],
    };
    if (Number.isFinite(value.pregnancyFromWeeks)) summary.pregnancyFromWeeks = Math.max(0, Math.floor(value.pregnancyFromWeeks));
    if (Number.isFinite(value.pregnancyToWeeks)) summary.pregnancyToWeeks = Math.max(0, Math.floor(value.pregnancyToWeeks));
    return summary.name ? [summary] : [];
  });
}

export function normalizeCycleStore(raw: unknown): CycleStore {
  const store = emptyStore();
  if (!raw || typeof raw !== 'object') return store;
  const source = raw as any;
  if (source.records && typeof source.records === 'object') {
    for (const rawKey of Object.keys(source.records)) {
      const key = normalizeCycleName(rawKey);
      const rec = normalizeRecord(source.records[rawKey]);
      if (key && rec) store.records[key] = rec;
    }
  }
  if (source.permanentExclusions && typeof source.permanentExclusions === 'object') {
    for (const rawKey of Object.keys(source.permanentExclusions)) {
      const key = normalizeCycleName(rawKey);
      const value = source.permanentExclusions[rawKey];
      if (!key || !value || typeof value !== 'object' || value.reason !== 'manual') continue;
      store.permanentExclusions[key] = {
        name: String(value.name || rawKey).trim().slice(0, 64),
        excludedAt: validDateKey(value.excludedAt) ? value.excludedAt : '',
        reason: 'manual',
      };
    }
  }
  store.pendingJumpSummaries = normalizePendingJumpSummaries(source.pendingJumpSummaries)
    .filter(summary => !store.permanentExclusions[normalizeCycleName(summary.name)]);
  if (source.capabilityOverrides && typeof source.capabilityOverrides === 'object') {
    for (const rawKey of Object.keys(source.capabilityOverrides)) {
      const key = normalizeCycleName(rawKey);
      const value = source.capabilityOverrides[rawKey];
      if (!key || !value || typeof value !== 'object') continue;
      const cleaned: CycleCapabilityOverride = {};
      if (typeof value.hasCycle === 'boolean') cleaned.hasCycle = value.hasCycle;
      if (typeof value.canGestate === 'boolean') cleaned.canGestate = value.canGestate;
      if (typeof value.canInseminate === 'boolean') cleaned.canInseminate = value.canInseminate;
      if (Object.keys(cleaned).length > 0) store.capabilityOverrides[key] = cleaned;
    }
  }
  if (source.sexOverrides && typeof source.sexOverrides === 'object') {
    for (const rawKey of Object.keys(source.sexOverrides)) {
      const key = normalizeCycleName(rawKey);
      const value = source.sexOverrides[rawKey];
      if (key && typeof value === 'boolean') store.sexOverrides[key] = value;
    }
  }
  return store;
}

// ═══════════════════════════════════════════════════════════════
// 内存态
// ═══════════════════════════════════════════════════════════════

let _store: CycleStore | null = null;
let _loadedChatKey = '';
let _dirty = false;
/** 单调递增的内存修改版本；用于保护等待 saveChat 期间产生的新修改不被旧事务清脏。 */
let _mutationVersion = 0;
/** 每个姓名最后一次 record 写入版本；可识别同一对象被 tick 原地推进后的并发更新。 */
const _recordMutationVersions = new Map<string, number>();
let _writeTimer: ReturnType<typeof setTimeout> | null = null;

// ===== 写入：聊天楼层 story feature =====

function writeNow(): void {
  if (!_store) return;
  const version = _mutationVersion;
  void writeStoryFeature(CYCLE_STORY_KEY, _store).then((ok) => {
    // 写入被拒（删除屏障 / 存储未就绪 / 无锚点）且期间无更新的内存修改时保留 dirty 重试。
    // 否则冷启动重建/弹窗确认后的状态只活内存、刷新即丢（经期重新冷启动、事后窗重弹）。
    if (ok || !_store || _mutationVersion !== version) return;
    _dirty = true;
    scheduleWrite();
  });
}

function scheduleWrite(): void {
  if (_writeTimer) return;
  _writeTimer = setTimeout(() => {
    _writeTimer = null;
    if (_dirty) {
      _dirty = false;
      writeNow();
    }
  }, WRITE_DEBOUNCE_MS);
}

// ═══════════════════════════════════════════════════════════════
// 公开 API
// ═══════════════════════════════════════════════════════════════

/** 初始化：一次性读入内存。off 档不调用（handleCycleTick 早退），故零 I/O。
 * 仅缓存「存储就绪」的读取：加载早期外部存储未就绪时 hasStoryFeature 恒 false，
 * 若把此时读到的空 store 以当前 chatKey 缓存，存储就绪后同 chatKey 会一直命中空缓存，
 * 经期记录被掩盖、handleCycleTick 对全 roster 重新冷启动（重复「已为 X 建立周期记录」）。
 * 未就绪时每次重读（hasStoryFeature 短路，开销≈0）；就绪后走缓存。 */
export function loadCycleStore(): CycleStore {
  const chatKey = getCurrentStoryChatKey();
  if (isStoryStorageReady() && _store && _loadedChatKey === chatKey) return _store;
  if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null; }
  _recordMutationVersions.clear();
  _loadedChatKey = isStoryStorageReady() ? chatKey : '';
  _store = isStoryStorageReady() && hasStoryFeature(CYCLE_STORY_KEY)
    ? normalizeCycleStore(readStoryFeature<unknown>(CYCLE_STORY_KEY, emptyStore()))
    : emptyStore();
  _dirty = false;
  return _store;
}

/** 取某角色记录（key 为规范化姓名）。 */
export function getCycleRecord(nameKey: string): CycleRecord | null {
  loadCycleStore();
  return _store!.records[normalizeCycleName(nameKey)] || null;
}

/** 写/更新某角色记录（标脏 + 防抖回写）。 */
export function setCycleRecord(nameKey: string, rec: CycleRecord): void {
  loadCycleStore();
  const key = normalizeCycleName(nameKey);
  if (!key) return;
  _store!.records[key] = rec;
  const recordVersion = ++_mutationVersion;
  _recordMutationVersions.set(key, recordVersion);
  _dirty = true;
  scheduleWrite();
}

/** 取全部记录引用（仅供引擎/世界书同步读取，勿改）。 */
export function getAllCycleRecords(): Record<string, CycleRecord> {
  loadCycleStore();
  return _store!.records;
}

export function isCyclePermanentlyExcluded(nameOrKey: string): boolean {
  const key = normalizeCycleName(nameOrKey);
  if (!key) return false;
  return !!loadCycleStore().permanentExclusions[key];
}

function cancelScheduledWrite(): void {
  if (_writeTimer) {
    clearTimeout(_writeTimer);
    _writeTimer = null;
  }
}

/** UI 不可逆操作专用：聊天记录真正写入成功后才返回 true；失败恢复该姓名的旧排除值。 */
export async function excludeCycleNamePermanently(name: string, excludedAt: string): Promise<boolean> {
  const key = normalizeCycleName(name);
  if (!key || !validDateKey(excludedAt)) return false;
  const store = loadCycleStore();
  if (store.permanentExclusions[key]) return true;
  const previous = store.permanentExclusions[key];
  const wasDirty = _dirty;
  cancelScheduledWrite();
  store.permanentExclusions[key] = { name: String(name).trim().slice(0, 64), excludedAt, reason: 'manual' };
  const writeVersion = ++_mutationVersion;
  _dirty = true;
  const ok = await writeStoryFeature(CYCLE_STORY_KEY, store);
  if (ok) {
    if (_store === store) {
      if (_mutationVersion === writeVersion) _dirty = false;
      else {
        _dirty = true;
        scheduleWrite();
      }
    }
    return true;
  }
  if (store.permanentExclusions[key]?.excludedAt === excludedAt) {
    if (previous) store.permanentExclusions[key] = previous;
    else delete store.permanentExclusions[key];
  }
  if (_store === store) {
    _dirty = wasDirty || _mutationVersion !== writeVersion;
    if (_dirty) scheduleWrite();
  }
  return false;
}

/** 参数窗口专用：等待聊天保存；失败时只回滚该姓名记录。 */
export async function updateCycleRecordPersisted(nameKey: string, next: CycleRecord): Promise<boolean> {
  const key = normalizeCycleName(nameKey);
  if (!key) return false;
  const store = loadCycleStore();
  const previous = store.records[key];
  const previousRecordVersion = _recordMutationVersions.get(key);
  const wasDirty = _dirty;
  cancelScheduledWrite();
  store.records[key] = next;
  const writeVersion = ++_mutationVersion;
  _recordMutationVersions.set(key, writeVersion);
  _dirty = true;
  const ok = await writeStoryFeature(CYCLE_STORY_KEY, store);
  if (ok) {
    if (_store === store) {
      if (_mutationVersion === writeVersion) _dirty = false;
      else {
        _dirty = true;
        scheduleWrite();
      }
    }
    return true;
  }
  if (_store === store && _recordMutationVersions.get(key) === writeVersion && store.records[key] === next) {
    if (previous) store.records[key] = previous;
    else delete store.records[key];
    if (previousRecordVersion === undefined) _recordMutationVersions.delete(key);
    else _recordMutationVersions.set(key, previousRecordVersion);
  }
  if (_store === store) {
    _dirty = wasDirty || _mutationVersion !== writeVersion;
    if (_dirty) scheduleWrite();
  }
  return false;
}

export function getPendingCycleJumpSummaries(): PendingCycleJumpSummary[] {
  loadCycleStore();
  return _store!.pendingJumpSummaries.map(summary => ({
    ...summary,
    newPeriodStarts: [...summary.newPeriodStarts],
    newMilestones: [...summary.newMilestones],
  }));
}

export function setPendingCycleJumpSummaries(summaries: PendingCycleJumpSummary[]): void {
  loadCycleStore();
  _store!.pendingJumpSummaries = summaries.map(summary => ({
    ...summary,
    newPeriodStarts: [...summary.newPeriodStarts],
    newMilestones: [...summary.newMilestones],
  }));
  _mutationVersion++;
  _dirty = true;
  persistCycleStoreImmediate();
}

/** 立即落盘（清掉待触发的防抖定时器，马上写）。handleCycleTick 同步阶段末尾调用，确保 render 前落盘。 */
export function persistCycleStoreImmediate(): void {
  cancelScheduledWrite();
  if (_dirty) {
    _dirty = false;
    writeNow();
  }
}

/**
 * 立即落盘并返回写入结果（诊断用）。与 persistCycleStoreImmediate 不同：await writeStoryFeature 的
 * 返回值，用于确认「清空 pendingSexForm」这条写入是否真的进入了持久层（coordinator pending + recovery）。
 */
export async function persistCycleStoreImmediateAsync(): Promise<boolean> {
  cancelScheduledWrite();
  if (!_dirty) return true;
  const version = _mutationVersion;
  _dirty = false;
  const ok = await writeStoryFeature(CYCLE_STORY_KEY, _store as CycleStore);
  if (!ok && _store && _mutationVersion === version) {
    _dirty = true;
    scheduleWrite();
  }
  return ok;
}

/**
 * 恢复被永久排除的姓名（对外 API setExcluded(name,false) 专用）。
 * 只删排除标记并立即整盘落盘；记录续算/事件派发由引擎侧 restoreCycleEligibilityForApi 负责。
 * 与 excludeCycleNamePermanently 对称：聊天记录写成功才返回 true，失败保持排除不变。
 */
export async function restoreCycleEligibilityInStore(nameOrKey: string): Promise<boolean> {
  const key = normalizeCycleName(nameOrKey);
  if (!key || !loadCycleStore().permanentExclusions[key]) return false;
  const store = loadCycleStore();
  const previous = store.permanentExclusions[key];
  const wasDirty = _dirty;
  cancelScheduledWrite();
  delete store.permanentExclusions[key];
  const writeVersion = ++_mutationVersion;
  _dirty = true;
  const ok = await writeStoryFeature(CYCLE_STORY_KEY, store);
  if (ok) {
    if (_store === store) {
      if (_mutationVersion === writeVersion) _dirty = false;
      else {
        _dirty = true;
        scheduleWrite();
      }
    }
    return true;
  }
  // 失败回滚：恢复原排除条目
  if (_store === store && !store.permanentExclusions[key] && previous) {
    store.permanentExclusions[key] = previous;
  }
  if (_store === store) {
    _dirty = wasDirty || _mutationVersion !== writeVersion;
    if (_dirty) scheduleWrite();
  }
  return false;
}

/**
 * 整体替换全部周期记录（对外 API setCycleState 专用）。调用方须先完成逐条校验
 * （失败必须发生在任何写入之前，保证「要么整体成功、要么原状」）；本函数只负责
 * 落位 + 标脏，持久化时机由调用方（persistCycleStoreImmediate）决定。
 */
export function replaceAllCycleRecords(records: Record<string, CycleRecord>): void {
  loadCycleStore();
  _store!.records = records;
  _mutationVersion++;
  _recordMutationVersions.clear();
  _dirty = true;
}

// ═══════════════════════════════════════════════════════════════
// 生殖能力 / 表面性别覆盖（对外 API 追加批次 1）
// 与 records 同一 feature 对象：写路径整盘一次原子写，天然满足「与周期记录同一次写入」。
// ═══════════════════════════════════════════════════════════════

/** 读能力覆盖（深拷贝）；无覆盖返回 null。 */
export function getCapabilityOverride(nameOrKey: string): CycleCapabilityOverride | null {
  const key = normalizeCycleName(nameOrKey);
  if (!key) return null;
  const value = loadCycleStore().capabilityOverrides[key];
  return value ? { ...value } : null;
}

/** 读表面性别覆盖；无覆盖返回 null（由调用方回退人物表性别）。 */
export function getSexOverrideForName(nameOrKey: string): boolean | null {
  const key = normalizeCycleName(nameOrKey);
  if (!key) return null;
  const value = loadCycleStore().sexOverrides[key];
  return typeof value === 'boolean' ? value : null;
}

/**
 * 一次原子写同时落位能力覆盖与/或表面性别覆盖（追加批次 1 专用）。
 * patch.capability 传 null = 清除覆盖（回到纯 auto 推导）；patch.sex 传 null = 清除性别覆盖。
 * 聊天记录写成功才返回 true；失败时两处修改一并回滚（同一事务语义）。
 */
export async function setCycleDomainOverrides(
  nameKey: string,
  patch: { capability?: CycleCapabilityOverride | null; sex?: boolean | null },
): Promise<boolean> {
  const key = normalizeCycleName(nameKey);
  if (!key || !patch || (patch.capability === undefined && patch.sex === undefined)) return false;
  const store = loadCycleStore();
  const previousCapability = store.capabilityOverrides[key];
  const previousSex = store.sexOverrides[key];
  const wasDirty = _dirty;
  cancelScheduledWrite();
  if (patch.capability !== undefined) {
    if (patch.capability === null || Object.keys(patch.capability).length === 0) delete store.capabilityOverrides[key];
    else store.capabilityOverrides[key] = { ...patch.capability };
  }
  if (patch.sex !== undefined) {
    if (patch.sex === null) delete store.sexOverrides[key];
    else store.sexOverrides[key] = patch.sex;
  }
  const writeVersion = ++_mutationVersion;
  _dirty = true;
  const ok = await writeStoryFeature(CYCLE_STORY_KEY, store);
  if (ok) {
    if (_store === store) {
      if (_mutationVersion === writeVersion) _dirty = false;
      else {
        _dirty = true;
        scheduleWrite();
      }
    }
    return true;
  }
  // 失败回滚：能力覆盖与性别覆盖一并恢复原值
  if (_store === store) {
    if (patch.capability !== undefined) {
      if (previousCapability) store.capabilityOverrides[key] = previousCapability;
      else delete store.capabilityOverrides[key];
    }
    if (patch.sex !== undefined) {
      if (previousSex !== undefined) store.sexOverrides[key] = previousSex;
      else delete store.sexOverrides[key];
    }
    _dirty = wasDirty || _mutationVersion !== writeVersion;
    if (_dirty) scheduleWrite();
  }
  return false;
}

/** 楼层删除、swipe 或聊天切换后丢弃模块缓存；不写数据。 */
export function invalidateCycleStoreCache(): void {
  if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null; }
  _store = null;
  _loadedChatKey = '';
  _dirty = false;
  _recordMutationVersions.clear();
}
