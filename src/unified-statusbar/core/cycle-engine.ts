// ===== 月信与孕育系统 · 核心引擎（P1：经期） =====
// 详见 docs/经期孕期功能设计.md §2（§2.1 主循环 / §2.2 时间跳跃 / §2.3 四阶段 / §2.4 冷启动 / §2.5 渲染）
//
// 唯一重逻辑入口 = 日期变更处理。挂在 index.ts 数据更新回路（搭 registerTableUpdateCallback
// 300ms 节流便车），与 handleTableUpdate / handleCalendarDateChange 并列。
// **不能复用 handleCalendarDateChange**：其首行 if(!calendarEnabled) return false 会被
// 日历开关短路，导致「日历关、经期开」时经期整体失效。本引擎自维护 per-record 的
// lastProcessedDateKey 做日期 diff，不依赖日历。
//
// 幂等保证：
//   1. per-char rec.lastProcessedDateKey —— 同一日期不重复跑 processDateChange
//   2. 世界书侧 _wbSignature + _wbInFlight（见 cycle-worldbook）
// 同步部分（store 变更）单线程不可打断、必然早于 render 完成；世界书 fire-and-forget。
import { getConfig } from './config-store';
import { isRefillMode } from './refill-mode';
import {
  getCellByHeader, getSheetByName, findRowByColumn, insertContentRowSqlFirst, deleteContentRowSqlFirst,
  getSheetCacheChatKey,
} from './data-manager';
import { getTodayDateKey, computeDateKeyForOffset, parseDateKey, makeDate, compareDateKey } from './calendar-core';
import { getCurrentStoryChatKey, isStoryStorageReady } from './story-floor-store';
import { getToastr } from './env';
import {
  type CycleRecord,
  type PregnancyState,
  type CycleCapabilityOverride,
  loadCycleStore,
  getCycleRecord,
  setCycleRecord,
  persistCycleStoreImmediate,
  getPendingCycleJumpSummaries,
  setPendingCycleJumpSummaries,
  isFemaleGender,
  isCyclePermanentlyExcluded,
  excludeCycleNamePermanently,
  updateCycleRecordPersisted,
  persistCycleStoreImmediateAsync,
  restoreCycleEligibilityInStore,
  getCapabilityOverride,
  getSexOverrideForName,
  setCycleDomainOverrides,
} from './cycle-store';
import { normalizeCycleName, clampInt } from './cycle-eligibility';
import { stripTimeAnchorPrefix } from './time-anchor';
import { readCharAgeNumber } from './birthday';
import { installCycleDiagnosticsConsole, traceCycleDiagnostic } from './cycle-diagnostics';
import { emitCycleApiEvent, hasCycleApiListeners, takeNextConceiveMeta, setNextConceiveMeta, clearNextConceiveMeta } from './cycle-api-events';
import {
  advanceCycleSchedule,
  cycleLengthForStart,
  pickCycleBaseline,
  pickInitialCycleDay,
  pickPeriodLength,
} from './cycle-profile';
import { syncCycleWorldbook, syncPregnancyWorldbook, hashPeriodSeed, type OnPeriodChar, type PregnantChar, type PostpartumChar } from './cycle-worldbook';
import { systemDecisionQueue } from './system-decision-queue';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 04 待修：core 反向依赖 renderers（借 cycle-popup 的 mergeJumpSummariesByName 与两个弹窗入口）⇒ 把纯函数 mergeJumpSummariesByName 下沉到 core 即可断掉这条反向边
import {
  invalidateCycleDecisionsForName,
  showSexFormPopup,
  showPregnancyTestPopup,
  showJumpSummaryPopup,
  type SexForm,
} from '../renderers/cycle-popup';

installCycleDiagnosticsConsole();

// ═══════════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════════

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

/** 渲染层只读视图（每次 render 重新算，不写 store）。 */
export interface CycleRenderInfo {
  phase: CyclePhase;
  daysIntoCycle: number;      // 1-based，[1, cycleLength]
  cycleLength: number;
  periodLength: number;
  isOnPeriod: boolean;
  isHighRisk: boolean;        // 排卵期
  dayOfPeriod: number | null; // 经期第几天（1-based），非经期 null
  /** 孕期展示信息；null=玩家尚未知晓孕情或当前不展示。非 null 即已验孕确认。 */
  pregnancy: {
    weeks: number;            // 当前孕周（1-based）
    trimester: 1 | 2 | 3;     // 早/中/晚期
    confirmed: boolean;       // 玩家是否已验孕知晓
    daysToDue: number;        // 距预产期天数（负=已过预产期）
    expectedDueDate: string;
  } | null;
}

export interface RosterEntry {
  key: string;
  name: string;
  source: 'protagonist' | 'romance' | 'important';
  age: number;
  /** 生效表面性别（含 setFemale 覆盖）：能力推导与受孕门禁的热路径依据。 */
  female: boolean;
}

export interface CycleManagerInput {
  lastPeriodStart: string;
  baseCycleLength: number;
  cycleLength: number;
  periodLength: number;
  regularity: 'stable' | 'irregular';
}

export interface CycleManagerSnapshot extends CycleManagerInput {
  key: string;
  name: string;
  source: 'protagonist' | 'romance' | 'important';
  age: number;
  phase: CyclePhase;
  daysIntoCycle: number;
  pregnancyWeeks: number | null;
}

export type CycleManagerField = keyof CycleManagerInput;
export type CycleManagerResult =
  | { ok: true }
  | { ok: false; field?: CycleManagerField; message: string };

// ═══════════════════════════════════════════════════════════════
// P3：跳跃摘要（§2.2）/ 日历标注（§5.6）
// ═══════════════════════════════════════════════════════════════

/**
 * 跳跃摘要（§2.2 P3）。processDateChange 检测到 gap≥3 时产出，
 * 累积到 handleCycleTick 末尾合并为一个弹窗展示。
 */
export interface JumpSummary {
  name: string;
  gap: number;                            // 实际跨越天数（gap = today - lastProcessedDateKey）
  newPeriodStarts: string[];              // 区间内新落的经期开始日（YYYY-MM-DD）
  pregnancyDelta: null | 'conceived' | 'progressed' | 'delivered';
  pregnancyFromWeeks?: number;            // progressed 时的起孕周
  pregnancyToWeeks?: number;              // conceived/progressed 时的末孕周
  newMilestones: string[];                // 区间内触发的里程碑 id（trimester_2/trimester_3/first_kick）
}

/** 日历标注类型（§5.6）。 */
export type CycleDayMarkKind =
  | 'past-period'
  | 'predicted-period'
  | 'pregnancy-early'
  | 'pregnancy-middle'
  | 'pregnancy-late'
  | 'due-date';

export interface CycleDayMark {
  kind: CycleDayMarkKind;
  charName: string;
  // 详情字段（供日历详情卡片展示，零额外 I/O——标注查询时已遍历 CycleRecord）
  cycleLength: number;             // 周期长度
  periodLength: number;            // 经期长度
  lastPeriodStart: string;         // 末次月经开始日
  dayOfPeriod?: number;            // past-period 专用：经期第几天（1-based）
  daysUntil?: number;              // 预测/孕期标记距今天数（负=已过）
  weeks?: number;                  // 当前孕周
  trimester?: 1 | 2 | 3;          // 早/中/晚期
  stageWeek?: 1 | 13 | 28;        // 孕期阶段起点周
  expectedDueDate?: string;        // 孕期详情专用
}

// ═══════════════════════════════════════════════════════════════
// 日期/周期数学（纯函数）
// ═══════════════════════════════════════════════════════════════

/** a - b 的天数（YYYY-MM-DD；任一非法返回 null）。 */
export function diffDays(a: string, b: string): number | null {
  const pa = parseDateKey(a);
  const pb = parseDateKey(b);
  if (!pa || !pb) return null;
  const da = makeDate(pa.year, pa.month - 1, pa.day);
  const db = makeDate(pb.year, pb.month - 1, pb.day);
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

/**
 * 周期第几天（1-based）。
 * daysIntoCycle = ((today - lastPeriodStart) mod cycleLength) + 1，正模保证 [1, cycleLength]。
 */
export function computeDaysIntoCycle(today: string, lastPeriodStart: string, cycleLength: number): number | null {
  const diff = diffDays(today, lastPeriodStart);
  if (diff === null) return null;
  const cl = cycleLength > 0 ? cycleLength : 28;
  const mod = ((diff % cl) + cl) % cl; // [0, cl-1]
  return mod + 1;
}

/**
 * 经期四阶段判定（§2.3）。
 * 排卵日 = cycleLength - 14（黄体期固定 14 天，故周期变化只移动排卵日、不移动黄体期长度；
 * 这才是「非简单除 2」的正确公式——文档 §2.3 写作 cycleLength/2-14 对 28 天得 0，系笔误）。
 */
export function classifyPhase(daysIntoCycle: number, cycleLength: number, periodLength: number): CyclePhase {
  if (daysIntoCycle <= periodLength) return 'menstrual';
  const ovulationDay = Math.max(periodLength + 1, cycleLength - 14);
  if (daysIntoCycle >= ovulationDay - 2 && daysIntoCycle <= ovulationDay + 2) return 'ovulation';
  if (daysIntoCycle < ovulationDay - 2) return 'follicular';
  return 'luteal';
}

// ═══════════════════════════════════════════════════════════════
// 受孕与孕期（仅 full 档）—— 纯函数 + 副作用辅助
// 详见 docs/经期孕期功能设计.md §3
// ═══════════════════════════════════════════════════════════════

/** 各阶段的基础受孕概率 baseRisk（§2.3）。 */
function baseRiskForPhase(phase: CyclePhase): number {
  switch (phase) {
    case 'ovulation':   return 0.35;
    case 'follicular':  return 0.08;
    case 'luteal':      return 0.02;
    case 'menstrual':   return 0.01;
    default:            return 0.05;
  }
}

/** 防护系数（§3.2）：无防护 1.0 / 体外 0.3 / 安全套 0.1。 */
function protectionFactorForForm(form: SexForm): number {
  switch (form) {
    case 'unprotected': return 1.0;
    case 'withdrawal':  return 0.3;
    case 'condom':      return 0.1;
    default:            return 1.0;
  }
}

/** 规律系数（§3.3）：不规律 ×1.3。 */
function regularityFactor(rec: CycleRecord): number {
  return rec.regularity === 'irregular' ? 1.3 : 1.0;
}

/** 孕周（1-based）：自受孕日起每 7 天 +1。 */
function computeWeeks(conceiveDate: string, today: string): number {
  const d = diffDays(today, conceiveDate);
  if (d === null || d < 0) return 1;
  return Math.max(1, Math.floor(d / 7) + 1);
}

/** 孕周所属阶段：早(1-12)/中(13-27)/晚(28-40)。 */
function trimesterOf(weeks: number): 1 | 2 | 3 {
  if (weeks >= 28) return 3;
  if (weeks >= 13) return 2;
  return 1;
}

/**
 * 掷骰判定单次受孕。命中则落定 pregnancy（conceiveDate/lmp/expectedDueDate 等齐备），
 * 并派发成就；返回是否命中。**对玩家隐藏**（玩家在后续验孕弹窗被告知）。
 * 调用方须保证此时 rec.pregnancy===null（已用 !rec.pregnancy 守卫）。
 * charName/emitEvent：对外 API 派发 conceived 事件用；内部路径默认派发
 * （若该次判定源自拓展方 resolveDecision 提交，meta 会经 takeNextConceiveMeta 并入 payload）。
 */
function rollConception(
  rec: CycleRecord,
  today: string,
  phase: CyclePhase,
  form: SexForm,
  charName?: string,
  emitEvent = true,
): boolean {
  if (rec.pregnancy) return false; // 安全双保险
  const p = baseRiskForPhase(phase) * protectionFactorForForm(form) * regularityFactor(rec);
  if (Math.random() >= p) return false;
  const lmp = rec.lastPeriodStart;
  const due = computeDateKeyForOffset(lmp, 280) || today;
  rec.pregnancy = {
    state: 'pregnant',
    conceiveDate: today,
    lmp,
    expectedDueDate: due,
    postpartumUntil: null,
    weeks: 1,
    milestones: [],
    confirmed: false,
    termination: null,
  };
  rec.isOnPeriod = false;
  // 安全期意外受孕先只记录事实；验孕确认后再派发彩蛋，避免成就 toastr 提前剧透。
  if (phase !== 'ovulation') {
    rec.pregnancy.milestones.push('surprise_pregnancy');
  }
  if (emitEvent) {
    const meta = takeNextConceiveMeta();
    emitCycleApiEvent('conceived', {
      name: charName ?? '',
      conceiveDate: today,
      expectedDueDate: due,
      weeks: 1,
      ...(meta !== undefined ? { meta } : {}),
    });
  }
  return true;
}

/** 里程碑触发（§3.5 表）。 */
function checkPregnancyMilestones(rec: CycleRecord, charName: string): void {
  const preg = rec.pregnancy;
  if (!preg) return;
  const w = preg.weeks;
  const add = (id: string, event: string): void => {
    if (preg.milestones.includes(id)) return;
    preg.milestones.push(id);
    if (preg.confirmed) {
      try { (window as any).__ubEmitAchievement?.(event, { name: charName }); } catch (_e) { /* ignore */ }
    }
  };
  if (w >= 13) add('trimester_2', 'trimester_reached');
  if (w >= 20) add('first_kick', 'first_kick');
  if (w >= 28) add('trimester_3', 'trimester_reached');
}

/** 写预产期备忘录（§6.1）：确认受孕后往备忘录表插一行。 */
function writeDueDateMemo(charName: string, expectedDueDate: string): void {
  void (async () => {
    try {
      await insertContentRowSqlFirst('备忘录', {
        '备忘标题': '预产期-' + charName,
        '类型': '纪念日',
        '相关角色': charName,
        '详细内容': '预产期已确认，详见经期与孕育系统。',
        '当前状态': '待确认',
        '约定时间': expectedDueDate,
      });
    } catch (_e) {
      /* ignore */
    }
  })();
}

// ═══════════════════════════════════════════════════════════════
// roster 枚举（女性主角 + 恋爱对象表女性 + 重要角色表女性；姓名去重 + 年龄门禁）
// ═══════════════════════════════════════════════════════════════

interface CycleCandidate {
  key: string;
  name: string;
  source: 'protagonist' | 'romance' | 'important';
  age: number | null;
  female: boolean;
}

/** 同一聊天运行期内，同一规范化姓名只提示一次脏数据；追踪仍只保留优先读到的一份。 */
const _duplicateCycleNameWarnings = new Set<string>();

function enumerateCycleCandidates(): CycleCandidate[] {
  const candidates = new Map<string, CycleCandidate>();
  const todayKey = getTodayDateKey();
  const add = (table: string, row: number, source: CycleCandidate['source']): void => {
    const name = getCellByHeader(table, row, '姓名');
    const key = normalizeCycleName(name);
    if (!key) return;
    if (candidates.has(key)) {
      const warningKey = `${getCurrentStoryChatKey()}\u0000${key}`;
      if (!_duplicateCycleNameWarnings.has(warningKey)) {
        _duplicateCycleNameWarnings.add(warningKey);
        console.warn(`[统一状态栏] 周期追踪发现同名人物“${String(name).trim()}”，仅按姓名处理一次。`);
      }
      return;
    }
    candidates.set(key, {
      key,
      name: String(name).trim(),
      source,
      // 年龄：三表生日列按当前游戏日期推算；旧库年龄列兜底透传
      age: readCharAgeNumber(table, row, todayKey),
      // 表面性别：setFemale 覆盖（追加批次 1）优先于人物表性别——名单合成单点覆盖，
      // 下游 roster/能力推导/isFemale 全部自动跟随。
      female: getSexOverrideForName(key) ?? isFemaleGender(getCellByHeader(table, row, '性别')),
    });
  };

  try { add('主角信息表', 1, 'protagonist'); } catch (_e) { /* ignore */ }
  for (const [table, source] of [
    ['恋爱对象表', 'romance'],
    ['重要角色表', 'important'],
  ] as const) {
    try {
      const sheet = getSheetByName(table);
      const rows = sheet?.content?.length || 0;
      for (let row = 1; row < rows; row++) add(table, row, source);
    } catch (_e) { /* ignore */ }
  }
  return Array.from(candidates.values());
}

/**
 * 周期参与者（生效 hasCycle，含能力覆盖的男性可妊娠者）、未被永久排除者纳入追踪；无年龄限制。
 * O12：可传入已枚举的 candidates 复用（handleCycleTick 同一 tick 内本已枚举一次，
 * 原实现让它再枚举一遍 = 全表逐行 + 逐格 headers.indexOf 白跑一轮）；不传则内部照旧枚举。
 */
export function enumerateRoster(candidates?: CycleCandidate[]): RosterEntry[] {
  const out = new Map<string, RosterEntry>();
  for (const candidate of candidates ?? enumerateCycleCandidates()) {
    if (!candidateHasCycle(candidate) || isCyclePermanentlyExcluded(candidate.key)) continue;
    out.set(candidate.key, { ...candidate, age: candidate.age as number });
  }
  return Array.from(out.values());
}

/** 提交统一决策前重新读取三张人物表与永久排除名单，阻断已经过期的闭包。 */
export function isCycleNameEligibleNow(nameOrKey: string): boolean {
  const key = normalizeCycleName(nameOrKey);
  return !!key && enumerateRoster().some(entry => entry.key === key);
}

// ═══════════════════════════════════════════════════════════════
// 生殖能力三开关（对外 API 追加批次 1）
// 覆盖存周期簿根部 capabilityOverrides（与记录同一 feature，写路径同一次原子写）；
// 无覆盖时按生效表面性别（含 setFemale 覆盖）auto 推导。三开关只决定「谁参与」，
// 不改概率算法 / 周期推进 / 受孕重试 / 确认生产终止流程（追加规格 §J-7）。
// ═══════════════════════════════════════════════════════════════

/** 解析后的生殖能力（对外 getCapability 返回 shape）。 */
export interface CycleCapability {
  hasCycle: boolean;      // 是否具备并参与周期计算
  canGestate: boolean;    // 是否能受孕（canGestate=true ⇒ hasCycle=true）
  canInseminate: boolean; // 是否能成为亲本候选（与上两者独立）
  source: 'auto' | 'override';
}

/** auto 推导（追加规格 §K.3.1）：女 → 参与+可妊娠；男 → 可使孕（亲本候选）。 */
function autoCapabilityTriple(female: boolean): { hasCycle: boolean; canGestate: boolean; canInseminate: boolean } {
  return female
    ? { hasCycle: true, canGestate: true, canInseminate: false }
    : { hasCycle: false, canGestate: false, canInseminate: true };
}

/** 交互归一化（追加规格 §K.2）：canGestate ⇒ hasCycle；!hasCycle ⇒ !canGestate；canInseminate 恒独立。 */
function normalizeCapabilityTriple<T extends { hasCycle: boolean; canGestate: boolean; canInseminate: boolean }>(triple: T): T {
  if (triple.canGestate) triple.hasCycle = true;
  if (!triple.hasCycle) triple.canGestate = false;
  return triple;
}

/** 覆盖 + auto 合成归一（读时归一化，容手改数据违反不变式）。 */
function mergeCapabilityTriple(surfaceFemale: boolean, override: CycleCapabilityOverride | null) {
  return normalizeCapabilityTriple({ ...autoCapabilityTriple(surfaceFemale), ...(override ?? {}) });
}

/**
 * 名单合成/资格门禁用的 hasCycle 生效值（覆盖优先于表面性别）。
 * 每 tick 每 candidate 一次 Map 查表，零 I/O。
 */
function candidateHasCycle(candidate: CycleCandidate): boolean {
  const override = getCapabilityOverride(candidate.key);
  const base = override && typeof override.hasCycle === 'boolean' ? override.hasCycle : candidate.female;
  return base || override?.canGestate === true;
}

/**
 * 受孕门禁（追加规格 §J-5）：canGestate=false 不进入受孕判定，但周期照常推进（区别于 setExcluded）。
 * 热路径（每 tick 性爱增量检测）专用：调用方自带生效表面性别，本函数只做一次 Map 查表。
 */
function canGestateForChar(key: string, surfaceFemale: boolean): boolean {
  return mergeCapabilityTriple(surfaceFemale, getCapabilityOverride(key)).canGestate;
}

/**
 * 受孕门禁低频版：只有姓名键时全量解析（弹窗 resolve / reconcile 等用户驱动路径专用，
 * 内部本就伴随 enumerateCycleCandidates 级别的读表，不额外进入 tick 热路径）。
 */
function canGestateForKey(nameKey: string): boolean {
  const key = normalizeCycleName(nameKey);
  const candidate = key ? enumerateCycleCandidates().find(entry => entry.key === key) : null;
  return !!candidate && candidateHasCycle(candidate)
    && canGestateForChar(candidate.key, candidate.female);
}

// ═══════════════════════════════════════════════════════════════
// 冷启动（§2.4）
// ═══════════════════════════════════════════════════════════════

/**
 * 每 tick 一次性构建的「姓名→性爱次数」索引：roster 循环内逐角色各自 findRowByColumn
 * 是对 NSFW 表做 O(行) 重复全表扫描（R 角色 × M 行，每 tick 上万次单元格访问，实测 80ms），
 * 索引把成本降到 O(M)+R 次 Map 查表。仅 handleCycleTick 内有效（进入构建、退出清空）；
 * 外部调用回退到逐行 findRowByColumn（语义不变）。
 */
let _tickSexCountIndex: Map<string, number> | null = null;

function buildSexCountIndex(): Map<string, number> | null {
  try {
    const sheet = getSheetByName('NSFW信息表');
    if (!sheet) return null;
    const headers = sheet.content[0];
    const nameIdx = headers.indexOf('姓名');
    const countIdx = headers.indexOf('性爱次数');
    if (nameIdx === -1 || countIdx === -1) return null;
    const map = new Map<string, number>();
    for (let i = 1; i < sheet.content.length; i++) {
      // 与 findRowByColumn 完全等价：任何单元格值都用 String() 作键，同名取首次出现（不覆盖已存在键）
      const key = String(sheet.content[i][nameIdx]);
      if (!map.has(key)) map.set(key, clampInt(sheet.content[i][countIdx], 0, 1e9, 0));
    }
    return map;
  } catch { return null; }
}

/**
 * 读 NSFW信息表「性爱次数」基线（冷启动时记，P2 受孕感知用）。
 * 找不到行 / 表不在当前快照时返回 null（区别于 0）——让调用方跳过基线同步，
 * 避免多表分组填表瞬间 NSFW 表缺席被当 0、基线误降产生幻影增量。
 */
function readSexCountForName(name: string): number | null {
  if (_tickSexCountIndex) {
    return _tickSexCountIndex.has(name) ? _tickSexCountIndex.get(name)! : null;
  }
  try {
    const row = findRowByColumn('NSFW信息表', '姓名', name);
    if (row === -1) return null;
    return clampInt(getCellByHeader('NSFW信息表', row, '性爱次数'), 0, 1e9, 0);
  } catch (e) {
    return null;
  }
}

function initColdStart(today: string, char: RosterEntry): CycleRecord {
  const baseCycleLength = pickCycleBaseline();
  const cycleLength = baseCycleLength;
  const periodLength = pickPeriodLength();
  const initialCycleDay = pickInitialCycleDay(cycleLength);
  const backoff = initialCycleDay - 1;
  const virtualLmp = computeDateKeyForOffset(today, -backoff) || today;
  return {
    baseCycleLength,
    cycleLength,
    periodLength,
    regularity: 'stable',
    lastPeriodStart: virtualLmp,
    periodHistory: [virtualLmp],
    isOnPeriod: initialCycleDay <= periodLength,
    pregnancy: null,
    pendingSexForm: null,
    lastSeenSexCount: readSexCountForName(char.name) ?? 0,
    lastProcessedDateKey: today,
    eligibilitySuspendedAt: null,
  };
}

// ═══════════════════════════════════════════════════════════════
// 日期变更处理（§2.1 + §2.2 时间跳跃折叠 + §2.3 经期推进）
// ═══════════════════════════════════════════════════════════════

/**
 * 处理一次日期变更。返回是否产生了需要落盘的变更。
 * 已假定 today !== rec.lastProcessedDateKey（调用方做幂等过滤）。
 * summariesOut：调用方传入的累加数组，gap≥3 时本函数会追加 JumpSummary（P3）。
 */
function processDateChange(rec: CycleRecord, today: string, char: RosterEntry, summariesOut: JumpSummary[]): boolean {
  const last = rec.lastProcessedDateKey;
  const gap = diffDays(today, last);
  if (gap === null) return false;

  // —— P3 跳跃摘要快照：记录处理前的状态供结束后比对 ——
  const needJumpSummary = gap >= 3;
  const historyBefore = needJumpSummary ? new Set(rec.periodHistory) : null;
  const prevPregSnapshot = needJumpSummary && rec.pregnancy
    ? {
        weeks: rec.pregnancy.weeks,
        milestones: [...rec.pregnancy.milestones],
        state: rec.pregnancy.state,
        confirmed: rec.pregnancy.confirmed,
      }
    : null;

  // 时间没前进（停滞/回退）：只刷新缓存，不制造历史记录。
  if (gap <= 0) {
    if (rec.pregnancy) {
      rec.isOnPeriod = false;
    } else {
      const d = computeDaysIntoCycle(today, rec.lastPeriodStart, rec.cycleLength);
      rec.isOnPeriod = d !== null && d <= rec.periodLength;
    }
    return true;
  }

  // 日期向前时，孕产生命周期必须先于经期推进；受孕后立即冻结经期，不等待 confirmed。
  const pregnancyAdvance = getConfig().cycleMode === 'full'
    ? processPregnancyAdvance(rec, today, char)
    : { suppressPeriod: rec.pregnancy !== null, resumeDate: null };

  if (pregnancyAdvance.suppressPeriod) {
    rec.isOnPeriod = false;
  } else {
    // cycle-progressed 快照：仅当对外 API 有订阅者时才计算（零开销守卫）。
    const trackProgression = hasCycleApiListeners('cycle-progressed');
    const prevDays = trackProgression
      ? computeDaysIntoCycle(last, rec.lastPeriodStart, rec.cycleLength)
      : null;
    const prevPhase = trackProgression && prevDays !== null
      ? classifyPhase(prevDays, rec.cycleLength, rec.periodLength)
      : null;
    const advanced = advanceCycleSchedule({
      lastPeriodStart: rec.lastPeriodStart,
      today,
      cycleLength: rec.cycleLength,
      baseCycleLength: rec.baseCycleLength,
      fingerprint: char.key,
    });
    for (const start of advanced.newPeriodStarts) rec.periodHistory.push(start);
    rec.lastPeriodStart = advanced.lastPeriodStart;
    rec.cycleLength = advanced.cycleLength;
    if (advanced.newPeriodStarts.includes(today)) {
      try { (window as any).__ubEmitAchievement?.('period_started', { name: char.name }); } catch (_e) { /* ignore */ }
      emitCycleApiEvent('period-start', { name: char.name, periodStart: today });
    }

    const finalDaysInto = computeDaysIntoCycle(today, rec.lastPeriodStart, rec.cycleLength);
    rec.isOnPeriod = finalDaysInto !== null && finalDaysInto <= rec.periodLength;
    if (trackProgression && finalDaysInto !== null) {
      const nextPhase = classifyPhase(finalDaysInto, rec.cycleLength, rec.periodLength);
      if (nextPhase !== prevPhase || finalDaysInto !== prevDays) {
        emitCycleApiEvent('cycle-progressed', {
          name: char.name,
          phase: nextPhase,
          daysIntoCycle: finalDaysInto,
          ...(prevPhase ? { prevPhase } : {}),
          isOnPeriod: rec.isOnPeriod,
          nextPeriodDue: computeDateKeyForOffset(rec.lastPeriodStart, rec.cycleLength) || '',
        });
      }
    }
  }

  rec.periodHistory = Array.from(new Set(rec.periodHistory)).sort(compareDateKey).slice(-12); // F50：数值比较

  // —— P3 跳跃摘要：gap≥3 时产出（仅当确有事件，避免空弹窗） ——
  if (needJumpSummary) {
    const newStarts = rec.periodHistory.filter(d => !historyBefore?.has(d));
    let pregnancyDelta: JumpSummary['pregnancyDelta'] = null;
    let pregnancyFromWeeks: number | undefined;
    let pregnancyToWeeks: number | undefined;
    const newMilestones: string[] = [];

    // 玩家可见摘要只报告已经验孕知晓的孕情；真实孕期推进不受此门槛影响。
    if (prevPregSnapshot?.confirmed) {
      if (prevPregSnapshot.state === 'pregnant') {
        if (!rec.pregnancy || rec.pregnancy.state === 'postpartum') {
          pregnancyDelta = 'delivered';
        } else {
          pregnancyDelta = 'progressed';
          pregnancyFromWeeks = prevPregSnapshot.weeks;
          pregnancyToWeeks = rec.pregnancy.weeks;
          const prevMs = new Set(prevPregSnapshot.milestones);
          for (const m of rec.pregnancy.milestones) if (!prevMs.has(m)) newMilestones.push(m);
        }
      }
    } else if (!prevPregSnapshot && rec.pregnancy?.state === 'pregnant' && rec.pregnancy.confirmed) {
      pregnancyDelta = 'conceived';
      pregnancyToWeeks = rec.pregnancy.weeks;
    }

    if (newStarts.length > 0 || pregnancyDelta !== null) {
      summariesOut.push({
        name: char.name,
        gap,
        newPeriodStarts: newStarts,
        pregnancyDelta,
        pregnancyFromWeeks,
        pregnancyToWeeks,
        newMilestones,
      });
    }
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════
// 受孕感知（脱离日期变更，每个 tick 查 NSFW 性爱次数增量）
// §3.1 感知 / §3.2 形式确认 / §3.3 概率（每次独立掷骰）
//
// ⭐ 触发条件只看「性爱次数增加」：
//   1) 不依赖日期变更——同日内多次性爱也能逐次感知（catch AI 同日推进）；
//   2) 不因已孕而跳过——否则玩家能凭「没弹窗」反推出角色已孕，泄露隐藏孕情。
//      已孕时仍弹窗，但 resolve 见 pregnancy!=null 即不掷骰（选择纯演示、不影响判定）。
// ═══════════════════════════════════════════════════════════════

/** 已弹出受孕形式确认的角色姓名键集合（防同 tick 重弹；resolve 时清）。 */
const _sexFormPending = new Set<string>();
/** 已弹出验孕提示的角色姓名键集合（防同 tick 重弹；confirm 时清）。 */
const _pregTestPending = new Set<string>();
/** 上一次清空运行时去重标记的聊天键；同一聊天内绝不重复清（防每 tick 清空致连环重弹）。 */
let _lastCycleRuntimeChatKey = '';

/**
 * 聊天/楼层上下文切换时清理仅属于旧上下文的运行时去重标记。
 * **只在聊天键真正变化时清**——runReadyStoryAutomation 每个表格更新 tick 都调用本函数，
 * 若无条件清空会抹掉受孕形式/验孕的去重守卫，让同一事件在幻影增量下反复弹窗。
 */
export function invalidateCycleDecisionRuntime(): void {
  const chatKey = getCurrentStoryChatKey();
  if (!chatKey || chatKey === _lastCycleRuntimeChatKey) return;
  _lastCycleRuntimeChatKey = chatKey;
  _sexFormPending.clear();
  _pregTestPending.clear();
  _externalCycleDecisions.clear();
  _dismissedExternalDecisions.clear();
}

// ═══════════════════════════════════════════════════════════════
// 决策渲染接管（对外 API 规格 §E；门面见 core/cycle-external-api.ts）
//
// host（默认）：引擎照常把避孕/验孕决策送入统一决策队列并自绘弹窗，行为与无 API 时完全一致。
// delegate：引擎只产生/应用决策、不绘制弹窗——processSexIncrement / reconcilePendingSexForm /
//   processPregnancyAdvance 三处弹窗调用点改走 registerExternal*，把「与原弹窗完全相同的
//   resolve 回调」登记到外部注册表并派发 decision-pending；拓展方经 resolveExternalCycleDecision
//   提交 ≡ 原弹窗点选（同一条应用路径）。
// ═══════════════════════════════════════════════════════════════

export type ExternalCycleDecisionKind = 'sex-form' | 'pregnancy';

export interface ExternalCycleDecision {
  key: string;
  kind: ExternalCycleDecisionKind;
  name: string;
  anchor: string;
  payload: Record<string, unknown>;
  resolve: (choice: unknown) => Promise<{ ok: boolean; error?: string }>;
}

let _cycleDecisionDelegated = false;
const _externalCycleDecisions = new Map<string, ExternalCycleDecision>();
/** 正在提交中的外部决策 key（防拓展方并发重复提交；与原队列 _resolving 守卫对齐）。 */
const _resolvingExternalDecisions = new Set<string>();
/** 已放弃的外部决策（key → 触发标识）：sex-form 存触发日（新 Δ 到来可重新询问）；pregnancy 存受孕日（同一孕程不再询问）。 */
const _dismissedExternalDecisions = new Map<string, string>();

export function isCycleDecisionDelegated(): boolean {
  return _cycleDecisionDelegated;
}

export function setCycleDecisionDelegation(enabled: boolean): void {
  if (_cycleDecisionDelegated === enabled) return;
  _cycleDecisionDelegated = enabled;
  if (!enabled) {
    // 切回 host：接管期登记的外部决策全部让位。清掉对应运行时去重标记后，
    // 受孕形式由 reconcilePendingSexForm 重弹（pendingSexForm 快照仍在持久层）、
    // 验孕由 processPregnancyAdvance 在满足触发条件时重弹——均走引擎既有恢复语义。
    for (const entry of _externalCycleDecisions.values()) {
      const nameKey = normalizeCycleName(entry.name);
      if (entry.kind === 'sex-form') _sexFormPending.delete(nameKey);
      else _pregTestPending.delete(nameKey);
    }
    _externalCycleDecisions.clear();
  }
}

function externalDecisionKey(kind: ExternalCycleDecisionKind, nameKey: string): string {
  return `cycle-${kind}:${getCurrentStoryChatKey()}:${nameKey}`;
}

/** 人物失去资格/被排除/终止妊娠时，移除其外部决策与放弃标记（与 invalidateCycleDecisionsForName 并联调用）。 */
function dropExternalCycleDecisionsForName(nameOrKey: string): void {
  const nameKey = normalizeCycleName(nameOrKey);
  if (!nameKey) return;
  for (const key of Array.from(_externalCycleDecisions.keys())) {
    if (key.endsWith(`:${nameKey}`)) _externalCycleDecisions.delete(key);
  }
  for (const key of Array.from(_dismissedExternalDecisions.keys())) {
    if (key.endsWith(`:${nameKey}`)) _dismissedExternalDecisions.delete(key);
  }
}

/**
 * 登记「受孕形式」外部决策。freshTrigger=true 表示由新的性爱增量触发（清除历史放弃标记，可重新询问）；
 * false 表示 reconcile 恢复路径（尊重该实例的放弃标记：返回 false 并顺手清掉 pendingSexForm 快照）。
 * 返回是否成功登记（成功后调用方照常 _sexFormPending.add + 写 pendingSexForm 快照，与弹窗路径一致）。
 */
function registerExternalSexFormDecision(char: RosterEntry, freshTrigger: boolean): boolean {
  const key = externalDecisionKey('sex-form', char.key);
  if (freshTrigger) {
    _dismissedExternalDecisions.delete(key);
  } else if (_dismissedExternalDecisions.has(key)) {
    const rec = getCycleRecord(char.key);
    if (rec?.pendingSexForm) {
      rec.pendingSexForm = null;
      setCycleRecord(char.key, rec);
      persistCycleStoreImmediate();
    }
    return false;
  }
  const anchor = getCurrentStoryChatKey();
  const pending = getCycleRecord(char.key)?.pendingSexForm ?? null;
  _externalCycleDecisions.set(key, {
    key,
    kind: 'sex-form',
    name: char.name,
    anchor,
    payload: {
      options: ['unprotected', 'withdrawal', 'condom'],
      ...(pending ?? {}),
    },
    resolve: async choice => {
      const form = (choice as { method?: unknown })?.method;
      if (form !== 'unprotected' && form !== 'withdrawal' && form !== 'condom') {
        return { ok: false, error: '避孕方式须为 unprotected / withdrawal / condom 之一。' };
      }
      await makeSexFormResolver(char.key, char.name)(form);
      return { ok: true };
    },
  });
  emitCycleApiEvent('decision-pending', { key, kind: 'sex-form', name: char.name, anchor });
  return true;
}

/** 登记「验孕」外部决策；返回是否成功登记（该孕程曾被放弃时返回 false，引擎状态机照常继续）。 */
function registerExternalPregnancyDecision(char: RosterEntry): boolean {
  const key = externalDecisionKey('pregnancy', char.key);
  const conceiveDate = getCycleRecord(char.key)?.pregnancy?.conceiveDate ?? '';
  if (conceiveDate && _dismissedExternalDecisions.get(key) === conceiveDate) {
    return false;
  }
  _dismissedExternalDecisions.delete(key);
  const anchor = getCurrentStoryChatKey();
  _externalCycleDecisions.set(key, {
    key,
    kind: 'pregnancy',
    name: char.name,
    anchor,
    payload: {
      message: `${char.name} 的月信迟迟未至，是否验孕确认？`,
      conceiveDate,
    },
    resolve: async choice => {
      if ((choice as { confirm?: unknown })?.confirm !== true) {
        return { ok: false, error: '验孕决策须以 { confirm: true } 提交。' };
      }
      _pregTestPending.delete(char.key);
      confirmPregnancyForChar(char.key, char.name);
      return { ok: true };
    },
  });
  emitCycleApiEvent('decision-pending', { key, kind: 'pregnancy', name: char.name, anchor });
  return true;
}

export function listExternalCycleDecisions(): Array<{
  key: string;
  kind: ExternalCycleDecisionKind;
  name: string;
  anchor: string;
  payload: Record<string, unknown>;
}> {
  return Array.from(_externalCycleDecisions.values()).map(entry => ({
    key: entry.key,
    kind: entry.kind,
    name: entry.name,
    anchor: entry.anchor,
    payload: { ...entry.payload },
  }));
}

/**
 * 提交外部决策（拓展方调用）。先出队再执行（天然幂等：重复提交同一 key 返回「已处理或已过期」）；
 * 底层 resolve 失败时回队保持可重试（与原弹窗失败保留一致）。
 * result.meta 会被原样并入该次提交触发的 conceived 事件 payload（引擎不解析、不落地）。
 */
export async function resolveExternalCycleDecision(
  key: string,
  result: { method?: unknown; confirm?: unknown; meta?: unknown },
): Promise<{ ok: boolean; message?: string }> {
  const entry = _externalCycleDecisions.get(key);
  if (!entry || entry.anchor !== getCurrentStoryChatKey()) {
    if (entry) _externalCycleDecisions.delete(key); // 过期锚点：直接出队丢弃
    return { ok: false, message: '决策已处理或已过期' };
  }
  if (_resolvingExternalDecisions.has(key)) {
    return { ok: false, message: '决策正在处理中，请稍候。' };
  }
  _resolvingExternalDecisions.add(key);
  if (result && result.meta !== undefined) setNextConceiveMeta(result.meta);
  let outcome: { ok: boolean; error?: string };
  try {
    outcome = await entry.resolve(result);
  } catch (error) {
    outcome = { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearNextConceiveMeta();
    _resolvingExternalDecisions.delete(key);
  }
  if (!outcome.ok) return { ok: false, message: outcome.error || '决策处理失败，可重试。' };
  _externalCycleDecisions.delete(key);
  emitCycleApiEvent('decision-resolved', { key, kind: entry.kind, name: entry.name });
  return { ok: true };
}

/**
 * 放弃某外部决策：不做受孕/确认判定，引擎状态机正常继续。
 * 受孕形式：清 pendingSexForm 快照（后续新的性爱增量会重新询问）；
 * 验孕：对同一孕程（conceiveDate 相同）不再询问，新孕程恢复询问。
 */
export function dismissExternalCycleDecision(key: string): { ok: boolean; message?: string } {
  const entry = _externalCycleDecisions.get(key);
  if (!entry) return { ok: false, message: '决策不存在或已处理' };
  _externalCycleDecisions.delete(key);
  const nameKey = normalizeCycleName(entry.name);
  if (entry.kind === 'sex-form') {
    _sexFormPending.delete(nameKey);
    const rec = getCycleRecord(nameKey);
    if (rec?.pendingSexForm) {
      rec.pendingSexForm = null;
      setCycleRecord(nameKey, rec);
      persistCycleStoreImmediate();
    }
  } else {
    _pregTestPending.delete(nameKey);
  }
  _dismissedExternalDecisions.set(key, String((entry.payload as { conceiveDate?: unknown }).conceiveDate ?? ''));
  emitCycleApiEvent('decision-resolved', { key, kind: entry.kind, name: entry.name });
  return { ok: true };
}

/**
 * 性爱次数增量检测 + 受孕判定。脱离日期变更、每 tick 调用。
 * 用当前周期位置（经 processDateChange 已更新 lastPeriodStart）算阶段。
 * 返回是否产生了需落盘的变更。
 */
function processSexIncrement(rec: CycleRecord, today: string, char: RosterEntry): boolean {
  const currentCount = readSexCountForName(char.name);
  // 降噪：只在「有 pending / 计数变化 / 瞬时不可读」时记读事件，避免无信息量的 delta=0 读刷屏淹没关键事件。
  if (currentCount === null || rec.pendingSexForm != null || currentCount !== rec.lastSeenSexCount) {
    traceCycleDiagnostic('sex-count-read', {
      chatKey: getCurrentStoryChatKey(), name: char.name, key: char.key, today,
      currentCount, lastSeenSexCount: rec.lastSeenSexCount,
      pendingBefore: rec.pendingSexForm,
    });
  }
  // NSFW 表瞬时不可读（多表分组填表快照缺失）→ 跳过本次基线同步与判定，绝不当 0 重置基线。
  if (currentCount === null) {
    traceCycleDiagnostic('sex-count-unreadable-skip', { chatKey: getCurrentStoryChatKey(), name: char.name, key: char.key });
    return false;
  }
  // 追加批次 1 门禁（规格 §J-5）：canGestate=false → 不进入受孕判定（不弹窗、不掷骰），
  // 周期照常推进（本函数之后的日期推进路径不受影响）。增量照常消费（基线同步），
  // 绝不残留到恢复门控后被重放成新受孕事件。
  if (!canGestateForChar(char.key, char.female)) {
    if (currentCount !== rec.lastSeenSexCount) {
      traceCycleDiagnostic('sex-count-gestate-gated-sync', {
        chatKey: getCurrentStoryChatKey(), name: char.name, key: char.key,
        from: rec.lastSeenSexCount, to: currentCount,
      });
      rec.lastSeenSexCount = currentCount;
      return true;
    }
    return false;
  }
  const delta = currentCount - rec.lastSeenSexCount;
  traceCycleDiagnostic('sex-count-delta', {
    chatKey: getCurrentStoryChatKey(), name: char.name, key: char.key,
    currentCount, lastSeenSexCount: rec.lastSeenSexCount, delta,
  });
  if (delta <= 0) {
    // Δ<=0：仅同步基线防漂移（性爱次数被手动改小等异常），不判定
    if (currentCount !== rec.lastSeenSexCount) {
      traceCycleDiagnostic('sex-count-baseline-sync', {
        chatKey: getCurrentStoryChatKey(), name: char.name, key: char.key,
        from: rec.lastSeenSexCount, to: currentCount,
      });
      rec.lastSeenSexCount = currentCount;
      return true;
    }
    return false;
  }

  // Δ > 0
  // 已公开孕情或产后恢复期不再弹受孕形式弹窗；隐藏孕期仍保留弹窗以防侧信道泄露。
  if (rec.pregnancy && (rec.pregnancy.confirmed || rec.pregnancy.state === 'postpartum')) {
    rec.lastSeenSexCount = currentCount;
    return true;
  }

  // 进入概率判定。阶段取当前周期位置（已孕也会走到这，但掷骰内部 no-op）
  const daysInto = computeDaysIntoCycle(today, rec.lastPeriodStart, rec.cycleLength) ?? 1;
  const phase = classifyPhase(daysInto, rec.cycleLength, rec.periodLength);
  const mode = getConfig().cycleSexFormPrompt;

  if (mode === 'assume_unprotected' || mode === 'assume_withdrawal' || mode === 'assume_protected') {
    const form: SexForm = mode === 'assume_unprotected' ? 'unprotected' : mode === 'assume_withdrawal' ? 'withdrawal' : 'condom';
    rec.lastSeenSexCount = currentCount;
    rollConceptionMulti(rec, today, phase, form, delta, char.name); // 已孕则 rollConception 内部 no-op
    traceCycleDiagnostic('sex-form-assumed-resolved', {
      chatKey: getCurrentStoryChatKey(), name: char.name, key: char.key, delta, phase, form,
    });
    return true;
  }

  // always_ask：弹窗不因已孕跳过（防"没弹窗=已孕"的孕情泄露）
  if (_sexFormPending.has(char.key)) {
    // 弹窗仍开着又有新增性爱：累加 delta、推进基线（不吞计数）
    if (rec.pendingSexForm) rec.pendingSexForm.delta += delta;
    rec.lastSeenSexCount = currentCount;
    traceCycleDiagnostic('sex-form-pending-accumulated', {
      chatKey: getCurrentStoryChatKey(), name: char.name, key: char.key, delta,
      pendingAfter: rec.pendingSexForm,
    });
    return true;
  }
  const shown = isCycleDecisionDelegated()
    ? registerExternalSexFormDecision(char, true)
    : showSexFormPopup(
        char.name,
        makeSexFormResolver(char.key, char.name),
        char.key,
      );
  if (!shown) {
    traceCycleDiagnostic('sex-form-popup-not-enqueued', { chatKey: getCurrentStoryChatKey(), name: char.name, key: char.key, delta, phase });
    return false;
  }
  _sexFormPending.add(char.key);
  rec.lastSeenSexCount = currentCount; // 推进基线（防 Δ 重计）
  // 持久化「待确认」快照：弹窗不自动消失，须玩家手点；若期间闪退/切卡，重载后由
  // reconcilePendingSexForm 据此重弹，确保 Δ 不被吞（掷骰参数取触发时刻，保证结果一致）。
  rec.pendingSexForm = { delta, phase, conceiveDate: today };
  traceCycleDiagnostic('sex-form-pending-created', {
    chatKey: getCurrentStoryChatKey(), name: char.name, key: char.key,
    delta, phase, conceiveDate: today, enqueueStatus: 'accepted',
  });
  return true;
}

/**
 * 受孕形式弹窗 resolve 回调工厂：读 pendingSexForm 里的 delta/phase/conceiveDate 掷骰，
 * 然后清掉 pendingSexForm。trigger 路径与崩溃恢复路径共用，保证掷骰参数一致、不依赖闭包变量。
 */
function makeSexFormResolver(nameKey: string, charName: string): (form: SexForm) => void | Promise<void> {
  return async (form: SexForm): Promise<void> => {
    _sexFormPending.delete(nameKey);
    const latest = getCycleRecord(nameKey);
    traceCycleDiagnostic('sex-form-choice-received', {
      chatKey: getCurrentStoryChatKey(), key: nameKey, form,
      pendingBefore: latest?.pendingSexForm || null,
    });
    // 资格瞬时失效（三表分组填表快照缺失）不能吞掉事件：先读快照清 pending 落盘，
    // 再判资格决定是否掷骰——否则残留 pendingSexForm 会被 reconcilePendingSexForm 下 tick 重弹。
    if (latest && latest.pendingSexForm) {
      const pend = latest.pendingSexForm;
      if (!isCycleNameEligibleNow(nameKey)) {
        latest.pendingSexForm = null;
        setCycleRecord(nameKey, latest);
        persistCycleStoreImmediate();
        traceCycleDiagnostic('sex-form-pending-cleared-ineligible', { chatKey: getCurrentStoryChatKey(), key: nameKey, form });
        return;
      }
      // 追加批次 1 门禁（§J-5）：快照落定后能力被改为 canGestate=false → 不掷骰，只清快照。
      if (!canGestateForKey(nameKey)) {
        latest.pendingSexForm = null;
        setCycleRecord(nameKey, latest);
        persistCycleStoreImmediate();
        traceCycleDiagnostic('sex-form-pending-cleared-gestate-gated', { chatKey: getCurrentStoryChatKey(), key: nameKey, form });
        return;
      }
      rollConceptionMulti(latest, pend.conceiveDate, pend.phase as CyclePhase, form, pend.delta, charName);
      latest.pendingSexForm = null;
      setCycleRecord(nameKey, latest);
      // await 落盘并记录结果：诊断「清空写入是否真正进入持久层」。若 writeOk=false，说明被
      // coordinator/顶层门禁丢弃，重载后 reconcile 才会读到残留 pending 重弹（本 bug 的直接嫌疑）。
      const writeOk = await persistCycleStoreImmediateAsync();
      traceCycleDiagnostic('sex-form-pending-cleared-after-choice', {
        chatKey: getCurrentStoryChatKey(), key: nameKey, form,
        writeOk, storageReady: isStoryStorageReady(),
      });
      if (writeOk) {
        emitCycleApiEvent('cycle-state-changed', { name: charName, anchor: getCurrentStoryChatKey() });
      }
      // 延迟确认路径也要立即刷新世界书，不能等下一次表格更新 tick。
      handleCycleTick();
    }
  };
}

/**
 * 受孕形式弹窗「待确认」核对（崩溃/重载恢复 + 配置切换善后）。仅 full 档运行。
 * - always_ask：overlay 空闲则据 pendingSexForm 重新弹窗（掷骰参数取快照）；overlay 忙则下 tick 再试。
 * - assume_*（玩家从 always_ask 改了档）：静默按假定形式掷骰清掉 pending，不再 nag 弹窗。
 * - 仅对当前 roster 内角色恢复；离线角色（不在恋爱对象表/主角表）的 pending 冻结，等其回归再弹。
 * 返回是否产生了需落盘的变更。
 */
function reconcilePendingSexForm(roster: RosterEntry[], changedNamesOut: string[] = []): boolean {
  if (getConfig().cycleMode !== 'full') return false; // 非 full：conception 不追踪，pending 冻结
  const mode = getConfig().cycleSexFormPrompt;
  let dirty = false;
  for (const char of roster) {
    const rec = getCycleRecord(char.key);
    if (!rec || !rec.pendingSexForm) continue;
    if (_sexFormPending.has(char.key)) {
      traceCycleDiagnostic('sex-form-reconcile-already-active', { chatKey: getCurrentStoryChatKey(), name: char.name, key: char.key, pending: rec.pendingSexForm });
      continue;
    }

    if (mode === 'always_ask') {
      const shown = isCycleDecisionDelegated()
        ? registerExternalSexFormDecision(char, false)
        : showSexFormPopup(
            char.name,
            makeSexFormResolver(char.key, char.name),
            char.key,
          );
      if (shown) {
        _sexFormPending.add(char.key);
        traceCycleDiagnostic('sex-form-reconcile-reopened', { chatKey: getCurrentStoryChatKey(), name: char.name, key: char.key, pending: rec.pendingSexForm });
      } else {
        traceCycleDiagnostic('sex-form-reconcile-enqueue-failed', { chatKey: getCurrentStoryChatKey(), name: char.name, key: char.key, pending: rec.pendingSexForm });
      }
    } else {
      // 玩家已切到 assume 档：静默按假定形式掷骰清 pending（canGestate=false 门控时只清不掷，§J-5）
      const form: SexForm =
        mode === 'assume_unprotected' ? 'unprotected' :
        mode === 'assume_withdrawal' ? 'withdrawal' : 'condom';
      const pend = rec.pendingSexForm;
      if (!rec.pregnancy && canGestateForKey(char.key)) {
        rollConceptionMulti(rec, pend.conceiveDate, pend.phase as CyclePhase, form, pend.delta, char.name);
      }
      rec.pendingSexForm = null;
      setCycleRecord(char.key, rec);
      dirty = true;
      changedNamesOut.push(char.name);
      traceCycleDiagnostic('sex-form-reconcile-auto-cleared', { chatKey: getCurrentStoryChatKey(), name: char.name, key: char.key, form });
    }
  }
  return dirty;
}

/** 对 Δ 次性爱每次独立掷骰（§3.3），命中即 break。 */
function rollConceptionMulti(
  rec: CycleRecord,
  today: string,
  phase: CyclePhase,
  form: SexForm,
  delta: number,
  charName?: string,
  emitEvent = true,
): void {
  for (let i = 0; i < delta; i++) {
    if (rollConception(rec, today, phase, form, charName, emitEvent)) break; // 命中即止
  }
}

// ═══════════════════════════════════════════════════════════════
// step4：孕期推进（weeks 推进 + 里程碑 + 到期分娩 + 验孕触发）
// §3.4 验孕 / §3.5 孕期三阶段
// ═══════════════════════════════════════════════════════════════

function processPregnancyAdvance(
  rec: CycleRecord,
  today: string,
  char: RosterEntry,
): { suppressPeriod: boolean; resumeDate: string | null } {
  const preg = rec.pregnancy;
  if (!preg) return { suppressPeriod: false, resumeDate: null };

  if (preg.state === 'postpartum') {
    const resumeDate = preg.postpartumUntil
      || computeDateKeyForOffset(preg.expectedDueDate, rec.cycleLength)
      || today;
    const untilResume = diffDays(today, resumeDate);
    if (untilResume === null || untilResume < 0) {
      rec.isOnPeriod = false;
      return { suppressPeriod: true, resumeDate: null };
    }

    // 产后完整等待一个角色自身周期；恢复日才建立新的真实周期锚点。
    rec.pregnancy = null;
    rec.lastPeriodStart = resumeDate;
    rec.cycleLength = cycleLengthForStart(rec.baseCycleLength, char.key, resumeDate);
    rec.periodHistory.push(resumeDate);
    rec.isOnPeriod = today === resumeDate;
    if (today === resumeDate) {
      try { (window as any).__ubEmitAchievement?.('period_started', { name: char.name }); } catch (_e) { /* ignore */ }
      emitCycleApiEvent('period-start', { name: char.name, periodStart: resumeDate });
    }
    emitCycleApiEvent('recovered', { name: char.name, resumeDate });
    return { suppressPeriod: false, resumeDate };
  }

  // weeks 推进 + 里程碑
  const newWeeks = computeWeeks(preg.conceiveDate, today);
  if (newWeeks > preg.weeks) {
    preg.weeks = Math.min(newWeeks, 42);
    checkPregnancyMilestones(rec, char.name);
  }

  // 到期分娩后进入产后恢复窗口；不把分娩日误记为经期。
  const dueDiff = diffDays(today, preg.expectedDueDate);
  if (dueDiff !== null && dueDiff >= 0) {
    if (preg.confirmed) {
      try { (window as any).__ubEmitAchievement?.('new_life', { name: char.name }); } catch (_e) { /* ignore */ }
      // F18：全自动生育的落点——在此结算「预产期-X」备忘（旧写法漏掉，过期行永久残留）。
      settleDeliveryForName(char.name);
    }
    const resumeDate = computeDateKeyForOffset(preg.expectedDueDate, rec.cycleLength) || today;
    preg.state = 'postpartum';
    preg.postpartumUntil = resumeDate;
    rec.isOnPeriod = false;
    // delivery 事件（非终止的 pregnant→postpartum 过渡）：拓展方靠它在上层自建子嗣/血缘。
    emitCycleApiEvent('delivery', {
      name: char.name,
      conceiveDate: preg.conceiveDate,
      expectedDueDate: preg.expectedDueDate,
      deliveryDate: today,
      weeks: preg.weeks,
    });

    if ((diffDays(today, resumeDate) ?? -1) < 0) {
      return { suppressPeriod: true, resumeDate: null };
    }

    // 大跨度跳日可能一次跨过分娩与恢复日。
    rec.pregnancy = null;
    rec.lastPeriodStart = resumeDate;
    rec.cycleLength = cycleLengthForStart(rec.baseCycleLength, char.key, resumeDate);
    rec.periodHistory.push(resumeDate);
    if (today === resumeDate) {
      try { (window as any).__ubEmitAchievement?.('period_started', { name: char.name }); } catch (_e) { /* ignore */ }
      emitCycleApiEvent('period-start', { name: char.name, periodStart: resumeDate });
    }
    emitCycleApiEvent('recovered', { name: char.name, resumeDate });
    return { suppressPeriod: false, resumeDate };
  }

  rec.isOnPeriod = false;

  // 验孕触发：该来月信没来 或 受孕满 14 天，取较早者；未确认且未弹窗时触发。
  if (!preg.confirmed && !_pregTestPending.has(char.key)) {
    const sinceConceive = diffDays(today, preg.conceiveDate) ?? 0;
    const expectedNextPeriod = computeDateKeyForOffset(preg.lmp, rec.cycleLength);
    const periodOverdue = expectedNextPeriod ? (diffDays(today, expectedNextPeriod) ?? 0) >= 0 : false;
    if (sinceConceive >= 14 || periodOverdue) {
      const shown = isCycleDecisionDelegated()
        ? registerExternalPregnancyDecision(char)
        : showPregnancyTestPopup(
            char.name,
            () => {
              _pregTestPending.delete(char.key);
              confirmPregnancyForChar(char.key, char.name);
            },
            char.key,
            () => {
              // 仅读内存孕态判存活，不调 isCycleNameEligibleNow 读三张人物表——
              // 避免分组填表瞬时缺表让弹窗 isValid 抖动 → 队列把正在显示的验孕弹窗剪掉。
              const latest = getCycleRecord(char.key);
              return !!latest?.pregnancy
                && latest.pregnancy.state === 'pregnant'
                && !latest.pregnancy.confirmed;
            },
          );
      if (shown) _pregTestPending.add(char.key);
    }
  }

  return { suppressPeriod: true, resumeDate: null };
}

/**
 * 验孕确认的唯一落地路径：原验孕弹窗确认回调与对外 API（host 弹窗 / delegate resolveDecision）共用，
 * 保证「拓展方提交 ≡ 原弹窗点选」。副作用：置 confirmed + 落盘 + 成就补发 + 预产期备忘 + 事件。
 */
function confirmPregnancyForChar(key: string, charName: string): void {
  const latest = getCycleRecord(key);
  if (!latest || !latest.pregnancy || latest.pregnancy.state !== 'pregnant') return;
  if (latest.pregnancy.confirmed) return;
  latest.pregnancy.confirmed = true;
  setCycleRecord(key, latest);
  persistCycleStoreImmediate();
  try { (window as any).__ubEmitAchievement?.('pregnancy_confirmed', { name: charName }); } catch (_e) { /* ignore */ }
  // 受孕后至确认前只记录真实里程碑；确认时补发玩家此刻才可知晓的成就。
  if (latest.pregnancy.milestones.includes('surprise_pregnancy')) {
    try { (window as any).__ubEmitAchievement?.('surprise_pregnancy', { name: charName }); } catch (_e) { /* ignore */ }
  }
  if (
    latest.pregnancy.milestones.includes('trimester_2')
    || latest.pregnancy.milestones.includes('trimester_3')
  ) {
    try { (window as any).__ubEmitAchievement?.('trimester_reached', { name: charName }); } catch (_e) { /* ignore */ }
  }
  if (latest.pregnancy.milestones.includes('first_kick')) {
    try { (window as any).__ubEmitAchievement?.('first_kick', { name: charName }); } catch (_e) { /* ignore */ }
  }
  writeDueDateMemo(charName, latest.pregnancy.expectedDueDate);
  emitCycleApiEvent('pregnancy-confirmed', { name: charName, expectedDueDate: latest.pregnancy.expectedDueDate });
  emitCycleApiEvent('cycle-state-changed', { name: charName, anchor: getCurrentStoryChatKey() });
}

// ═══════════════════════════════════════════════════════════════
// 主入口：日期变更驱动（搭数据更新回路 300ms 便车）
// ═══════════════════════════════════════════════════════════════

export function handleCycleTick(): void {
  // —— 重填模式早退 ——
  // 重填期间暂停经期/孕期的一切自动写入（周期簿落盘、预产期备忘录、经期/孕期世界书投影、
  // 冷启动/判定弹窗）——重填正在重写角色表，此时按旧 roster 冷启动会产生假记录与假弹窗。
  // 关闭重填模式后由 index.ts 恢复链补跑一次；本函数内部按签名/lastProcessedDateKey 幂等，
  // 补跑只会得到「按重填后数据重新对齐」的结果，不会重复写入。
  if (isRefillMode()) return;
  // —— off 早退（真零开销）——
  if (getConfig().cycleMode === 'off') return;
  // —— 外部存储未就绪早退 ——
  // 加载角色卡早期（欢迎页 → 选卡）外部存储尚未配置好：此时 loadCycleStore 读不到真记录
  // （空 store），若在这里对 roster 冷启动，会把所有角色的周期记录写成全新的 initColdStart，
  // 并弹「已为 X 建立周期记录」toastr、用 phantom 数据刷世界书。等到存储就绪的
  // runReadyStoryAutomation（STATUSBAR_STORAGE_READY_EVENT 级联）或数据回调再跑本函数即可。
  if (!isStoryStorageReady()) return;

  // —— 切卡过渡期守卫：表格快照须归属当前聊天 ——
  // 数据库插件切卡时先置空表格、再延迟加载新卡表格；期间状态栏的表格缓存仍是上一张卡的
  // 残留（仅非空快照才会 invalidateCache 重建）。此时存储已就绪，若用旧卡 roster 对
  // 新卡周期簿冷启动，会对旧卡角色误弹「已为 X 建立周期记录」（写入又落不了盘、周期数据
  // 不变，只出假弹窗）。快照归属当前聊天前视同空快照（等价欢迎页直开的天然免疫），
  // 等本卡首个真实快照打标后由数据便车照常推进。
  if (getSheetCacheChatKey() !== getCurrentStoryChatKey()) return;

  const today = getTodayDateKey();
  if (!today) return; // 全局数据表无 cur_time，无法推进

  // 每 tick 一次性构建 NSFW 性爱次数索引（roster 循环逐角色 findRowByColumn 的 O(R×M) 降到 O(M)）
  _tickSexCountIndex = buildSexCountIndex();
  const store = loadCycleStore();
  const candidates = enumerateCycleCandidates();
  const roster = enumerateRoster(candidates); // O12：复用上面这次枚举，不再枚举第二遍
  const coldStartNames: string[] = [];
  const changedNames: string[] = []; // 对外 API cycle-state-changed 派发名单（本 tick 确有状态变化的角色）
  const newSummaries: JumpSummary[] = []; // P3 跳跃摘要累积（gap≥3 时由 processDateChange 写入）

  // 年龄/性别资格是动态门禁。暂时失去资格时冻结已有记录，恢复资格时从“今天”继续，
  // 不补算停用期间的经期、性爱增量或孕期里程碑。永久排除由独立名单控制，不可恢复。
  for (const candidate of candidates) {
    const rec = store.records[candidate.key];
    if (!rec || isCyclePermanentlyExcluded(candidate.key)) continue;
    // 参与（生效 hasCycle）是动态门禁：暂时失去资格冻结记录，恢复资格静默续算（不回放停用期）。
    // 能力覆盖把 hasCycle 置 false 时走同一暂停语义（追加批次 1）：记录/孕期保留、基线冻结。
    const eligible = candidateHasCycle(candidate);
    if (!eligible) {
      invalidateCycleDecisionsForName(candidate.key);
      dropExternalCycleDecisionsForName(candidate.key);
      _sexFormPending.delete(candidate.key);
      _pregTestPending.delete(candidate.key);
      const currentSummaries = getPendingCycleJumpSummaries();
      const retainedSummaries = currentSummaries
        .filter(summary => normalizeCycleName(summary.name) !== candidate.key);
      if (retainedSummaries.length !== currentSummaries.length) {
        setPendingCycleJumpSummaries(retainedSummaries);
        changedNames.push(candidate.name);
      }
      if (!rec.eligibilitySuspendedAt) {
        rec.eligibilitySuspendedAt = today;
        rec.pendingSexForm = null;
        setCycleRecord(candidate.key, rec);
        changedNames.push(candidate.name);
      }
    } else if (eligible && rec.eligibilitySuspendedAt) {
      rec.eligibilitySuspendedAt = null;
      rec.lastProcessedDateKey = today;
      rec.lastSeenSexCount = readSexCountForName(candidate.name) ?? rec.lastSeenSexCount;
      if (rec.pregnancy) {
        rec.isOnPeriod = false;
        rec.pregnancy.weeks = Math.min(computeWeeks(rec.pregnancy.conceiveDate, today), 42);
      } else {
        const day = computeDaysIntoCycle(today, rec.lastPeriodStart, rec.cycleLength);
        rec.isOnPeriod = day !== null && day <= rec.periodLength;
      }
      setCycleRecord(candidate.key, rec);
      changedNames.push(candidate.name);
    }
  }

  for (const char of roster) {
    const existing = store.records[char.key];
    if (!existing) {
      // 新角色发现：冷启动（setCycleRecord 标脏 + 防抖调度）
      setCycleRecord(char.key, initColdStart(today, char));
      coldStartNames.push(char.name);
      changedNames.push(char.name);
      continue; // 冷启动 lastSeenSexCount 已取当前值（Δ=0）、lastProcessedDateKey 已 = today
    }

    let changed = false;
    // 日期变更：经期推进 + 孕期推进（受孕感知已脱离日期变更，见 processSexIncrement）
    if (today !== existing.lastProcessedDateKey) {
      changed = processDateChange(existing, today, char, newSummaries);
      existing.lastProcessedDateKey = today; // 无论 changed 都推进锚（含 gap<=0 的重置语义）
    }
    // 性爱次数增量检测：full 档每 tick 都查（脱离日期变更，catch 同日多次性爱；不因已孕跳过）
    if (getConfig().cycleMode === 'full' && processSexIncrement(existing, today, char)) changed = true;
    if (changed) {
      setCycleRecord(char.key, existing); // 标脏（existing 与 store 内同引用）
      changedNames.push(char.name);
    }
  }

  // —— P3 跳跃摘要：累积 newSummaries 到 pending 队列并尝试 flush ——
  if (newSummaries.length > 0) {
    setPendingCycleJumpSummaries([
      ...getPendingCycleJumpSummaries(),
      ...newSummaries,
    ]);
  }
  flushJumpSummaries(newSummaries);

  // —— 受孕形式弹窗待确认核对（崩溃/重载恢复 + 配置切换善后）；可能标脏 ——
  reconcilePendingSexForm(roster, changedNames);

  // —— 同步落盘（必须早于 render，让 cycle-ui 读到最新；无脏则 no-op）——
  persistCycleStoreImmediate();

  // —— 对外 API：本 tick 确有状态变化并已触发落盘的角色派发 cycle-state-changed ——
  if (changedNames.length > 0 && hasCycleApiListeners('cycle-state-changed')) {
    const anchor = getCurrentStoryChatKey();
    for (const name of changedNames) {
      emitCycleApiEvent('cycle-state-changed', { name, anchor });
    }
  }

  // —— 冷启动合并一条 toastr 轻提示（不刷屏）——
  if (coldStartNames.length > 0) {
    try {
      const toastr = getToastr();
      if (toastr && typeof toastr.info === 'function') {
        const names = coldStartNames.length <= 3
          ? coldStartNames.join('、')
          : coldStartNames.slice(0, 3).join('、') + ` 等 ${coldStartNames.length} 位`;
        toastr.info(`已为 ${names} 建立周期记录，可在面板调整`, '', { timeOut: 4000 });
      }
    } catch (e) {
      /* ignore */
    }
  }

  // —— 世界书：fire-and-forget（不阻塞 render；内部 _wbSignature + _wbInFlight 幂等）——
  // cycleWorldbookPeriod 关闭 → 传空列表，syncCycleWorldbook 会把条目置 disabled
  const onPeriod: OnPeriodChar[] = [];
  if (getConfig().cycleWorldbookPeriod !== false) {
    for (const char of roster) {
      const rec = store.records[char.key];
      if (rec && rec.isOnPeriod) {
        const day = computeDaysIntoCycle(today, rec.lastPeriodStart, rec.cycleLength);
        onPeriod.push({
          name: char.name,
          day: day ?? 1,
          periodLength: rec.periodLength,
          seed: hashPeriodSeed(char.name, rec.lastPeriodStart),
        });
      }
    }
  }
  void syncCycleWorldbook(onPeriod);

  // —— 孕期世界书：仅 full 档（§4.1）。cycleWorldbookPregnancy 关闭 → 传空 → 条目 disabled ——
  if (getConfig().cycleMode === 'full') {
    const pregnant: PregnantChar[] = [];
    const postpartum: PostpartumChar[] = [];
    if (getConfig().cycleWorldbookPregnancy !== false) {
      for (const char of roster) {
        const rec = store.records[char.key];
        if (rec?.pregnancy?.state === 'pregnant') {
          pregnant.push({
            name: char.name,
            weeks: rec.pregnancy.weeks,
            trimester: trimesterOf(rec.pregnancy.weeks),
            confirmed: rec.pregnancy.confirmed,
            daysToDue: diffDays(rec.pregnancy.expectedDueDate, today) ?? 0,
          });
        } else if (rec?.pregnancy?.state === 'postpartum') {
          postpartum.push({
            name: char.name,
            kind: rec.pregnancy.termination?.kind === 'abortion' ? 'abortion' : 'delivery',
            method: rec.pregnancy.termination?.method,
            weeksAtTerm: rec.pregnancy.weeks,
            daysToRecover: diffDays(rec.pregnancy.postpartumUntil ?? rec.pregnancy.expectedDueDate, today) ?? 0,
          });
        }
      }
    }
    void syncPregnancyWorldbook(pregnant, postpartum);
  }
  _tickSexCountIndex = null;
}

// ═══════════════════════════════════════════════════════════════
// 渲染层只读查询（每次 render 搭便车，不算追踪）
// ═══════════════════════════════════════════════════════════════

/** 取某角色当前周期展示信息。无记录/无日期返回 null（渲染层不画进度条）。 */
export function getCycleRenderInfo(nameKey: string): CycleRenderInfo | null {
  if (isCyclePermanentlyExcluded(nameKey)) return null;
  const rec = getCycleRecord(nameKey);
  if (!rec || rec.eligibilitySuspendedAt) return null;
  const today = getTodayDateKey();
  if (!today) return null;
  // 产后恢复窗口不展示伪周期；到恢复日后 pregnancy 会被引擎清空并建立新周期。
  if (rec.pregnancy?.state === 'postpartum') return null;
  const computedDays = computeDaysIntoCycle(today, rec.lastPeriodStart, rec.cycleLength);
  if (computedDays === null) return null;
  // 玩家可见状态与真实状态分层：受孕已落定但尚未验孕时，继续只读推算正常周期，
  // 不把推算结果写回 store；确认后才公开孕期并隐藏经期表现。
  const playerKnowsPregnancy =
    getConfig().cycleMode === 'full'
    && rec.pregnancy?.state === 'pregnant'
    && rec.pregnancy.confirmed;
  const visibleDaysIntoCycle = playerKnowsPregnancy ? rec.cycleLength : computedDays;
  const visiblePhase: CyclePhase = playerKnowsPregnancy
    ? 'luteal'
    : classifyPhase(visibleDaysIntoCycle, rec.cycleLength, rec.periodLength);
  const visibleIsOnPeriod = !playerKnowsPregnancy && visibleDaysIntoCycle <= rec.periodLength;
  // 孕期展示：仅 full 档、pregnant 态且玩家已经验孕确认时填充。
  let pregnancy: CycleRenderInfo['pregnancy'] = null;
  if (playerKnowsPregnancy && rec.pregnancy) {
    const weeks = Math.min(computeWeeks(rec.pregnancy.conceiveDate, today), 42);
    const daysToDue = diffDays(rec.pregnancy.expectedDueDate, today) ?? 0;
    pregnancy = {
      weeks,
      trimester: trimesterOf(weeks),
      confirmed: rec.pregnancy.confirmed,
      daysToDue,
      expectedDueDate: rec.pregnancy.expectedDueDate,
    };
  }
  return {
    phase: visiblePhase,
    daysIntoCycle: visibleDaysIntoCycle,
    cycleLength: rec.cycleLength,
    periodLength: rec.periodLength,
    isOnPeriod: visibleIsOnPeriod,
    isHighRisk: !playerKnowsPregnancy && visiblePhase === 'ovulation',
    dayOfPeriod: visibleIsOnPeriod ? visibleDaysIntoCycle : null,
    pregnancy: playerKnowsPregnancy ? pregnancy : null,
  };
}

/** 渲染侧：姓名是当前聊天内唯一身份；三张人物表之间移动不会换记录。 */
export function resolveCycleKeyByCharName(charName: string): string | null {
  const key = normalizeCycleName(charName);
  if (!key) return null;
  return enumerateRoster().some(char => char.key === key) ? key : null;
}

export function getCycleManagerSnapshot(nameOrKey: string): CycleManagerSnapshot | null {
  const key = normalizeCycleName(nameOrKey);
  const char = enumerateRoster().find(entry => entry.key === key);
  if (!char) return null;
  const rec = getCycleRecord(key);
  const today = getTodayDateKey();
  if (!rec || rec.eligibilitySuspendedAt || !today) return null;
  const daysIntoCycle = computeDaysIntoCycle(today, rec.lastPeriodStart, rec.cycleLength);
  if (daysIntoCycle === null) return null;
  return {
    key,
    name: char.name,
    source: char.source,
    age: char.age,
    phase: classifyPhase(daysIntoCycle, rec.cycleLength, rec.periodLength),
    daysIntoCycle,
    pregnancyWeeks: rec.pregnancy?.state === 'pregnant' && rec.pregnancy.confirmed
      ? Math.min(computeWeeks(rec.pregnancy.conceiveDate, today), 42)
      : null,
    lastPeriodStart: rec.lastPeriodStart,
    baseCycleLength: rec.baseCycleLength,
    cycleLength: rec.cycleLength,
    periodLength: rec.periodLength,
    regularity: rec.regularity,
  };
}

function isRealDateKey(value: string): boolean {
  const parsed = parseDateKey(value);
  if (!parsed) return false;
  const date = makeDate(parsed.year, parsed.month - 1, parsed.day);
  return date.getFullYear() === parsed.year
    && date.getMonth() === parsed.month - 1
    && date.getDate() === parsed.day;
}

function managerInt(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

export async function saveCycleManagerParams(
  nameOrKey: string,
  input: CycleManagerInput,
): Promise<CycleManagerResult> {
  const key = normalizeCycleName(nameOrKey);
  const rec = getCycleRecord(key);
  const today = getTodayDateKey();
  if (!key || !rec || rec.eligibilitySuspendedAt || isCyclePermanentlyExcluded(key)) {
    return { ok: false, message: '该人物当前不纳入经期和怀孕功能。' };
  }
  if (!today || !isRealDateKey(input.lastPeriodStart) || (diffDays(input.lastPeriodStart, today) ?? 1) > 0) {
    return { ok: false, field: 'lastPeriodStart', message: '末次经期开始日必须是今天或更早的有效日期。' };
  }
  const baseCycleLength = managerInt(input.baseCycleLength);
  if (baseCycleLength === null || baseCycleLength < 21 || baseCycleLength > 45) {
    return { ok: false, field: 'baseCycleLength', message: '基础周期长度须为 21–45 天的整数。' };
  }
  const cycleLength = managerInt(input.cycleLength);
  if (cycleLength === null || cycleLength < 21 || cycleLength > 45) {
    return { ok: false, field: 'cycleLength', message: '当前周期长度须为 21–45 天的整数。' };
  }
  const periodLength = managerInt(input.periodLength);
  if (periodLength === null || periodLength < 2 || periodLength > 10 || periodLength > cycleLength) {
    return { ok: false, field: 'periodLength', message: '经期长度须为 2–10 天的整数，且不能超过当前周期。' };
  }
  if (input.regularity !== 'stable' && input.regularity !== 'irregular') {
    return { ok: false, field: 'regularity', message: '请选择有效的周期规律状态。' };
  }

  const periodHistory = rec.periodHistory.filter(date => date !== rec.lastPeriodStart);
  if (!periodHistory.includes(input.lastPeriodStart)) periodHistory.push(input.lastPeriodStart);
  periodHistory.sort(compareDateKey); // F50：数值比较（dateKey 不等长）
  const daysIntoCycle = computeDaysIntoCycle(today, input.lastPeriodStart, cycleLength);
  const next: CycleRecord = {
    ...rec,
    baseCycleLength,
    cycleLength,
    periodLength,
    regularity: input.regularity,
    lastPeriodStart: input.lastPeriodStart,
    periodHistory: periodHistory.slice(-12),
    isOnPeriod: !rec.pregnancy && daysIntoCycle !== null && daysIntoCycle <= periodLength,
    pregnancy: rec.pregnancy,
    lastProcessedDateKey: today,
  };
  return await updateCycleRecordPersisted(key, next)
    ? { ok: true }
    : { ok: false, message: '保存失败，原参数已保留，请稍后重试。' };
}

export async function permanentlyExcludeCycleCharacter(nameOrKey: string): Promise<CycleManagerResult> {
  const key = normalizeCycleName(nameOrKey);
  const char = enumerateRoster().find(entry => entry.key === key);
  const today = getTodayDateKey();
  if (!key || !char || !today) return { ok: false, message: '无法定位该人物或当前日期。' };
  if (!await excludeCycleNamePermanently(char.name, today)) {
    return { ok: false, message: '排除标记保存失败，未执行排除。' };
  }
  invalidateCycleDecisionsForName(key);
  dropExternalCycleDecisionsForName(key);
  _sexFormPending.delete(key);
  _pregTestPending.delete(key);
  const rec = getCycleRecord(key);
  if (rec?.pendingSexForm) {
    rec.pendingSexForm = null;
    setCycleRecord(key, rec);
    persistCycleStoreImmediate();
  }
  setPendingCycleJumpSummaries(
    getPendingCycleJumpSummaries().filter(summary => normalizeCycleName(summary.name) !== key),
  );
  // 立即把排除结果投影到经期/孕期世界书，不等待下一次表格更新回调。
  handleCycleTick();
  emitCycleApiEvent('excluded-changed', { name: char.name, excluded: true });
  emitCycleApiEvent('cycle-state-changed', { name: char.name, anchor: getCurrentStoryChatKey() });
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
// 堕胎（人工终止妊娠）—— 仅 full 档 + 已验孕确认；复用 postpartum 恢复期
// 详见 docs/superpowers/specs/2026-07-20-cycle-abortion-design.md
// ═══════════════════════════════════════════════════════════════

/** 按孕周判定堕胎方式（§0.2 弹窗形态）：≤12周药流 / 13–27周人流 / ≥28周引产。 */
function abortionMethodForWeeks(weeks: number): 'medical' | 'surgical' | 'induction' {
  if (weeks <= 12) return 'medical';   // 药流
  if (weeks <= 27) return 'surgical';  // 人流
  return 'induction';                  // 引产
}

/**
 * 删除预产期备忘录行（验孕确认时 writeDueDateMemo 写入）；找不到静默跳过。
 * 匹配必须**容忍「时间锚定」前缀**：开时间锚定后「备忘标题」会被改写成「3天前，预产期-X」，
 * 旧写法用 findRowByColumn 严格相等 ⇒ 一开锚定就永远匹配不上（终止/放弃路径也一起失效）。
 * 用 stripTimeAnchorPrefix 剥净前缀后再精确比较（不用 endsWith 之类宽松匹配，避免误伤同名）。
 * 同名只删首次出现，与 findRowByColumn 语义一致。
 */
function deleteDueDateMemoForName(name: string): void {
  void (async () => {
    try {
      const target = '预产期-' + name;
      const sheet = getSheetByName('备忘录');
      if (!sheet?.content?.length) return;
      const titleIdx = sheet.content[0].indexOf('备忘标题');
      if (titleIdx === -1) return;
      for (let row = 1; row < sheet.content.length; row++) {
        const title = String(sheet.content[row]?.[titleIdx] ?? '');
        if (stripTimeAnchorPrefix(title) !== target) continue;
        await deleteContentRowSqlFirst('备忘录', row);
        return;
      }
    } catch (_e) { /* ignore */ }
  })();
}

/**
 * 分娩结算：清掉「预产期-X」备忘 + 一条轻提示。自然分娩（processPregnancyAdvance）
 * 与对外分娩（deliverPregnancyForApi）共用。
 * 旧写法只有「人工终止 / 放弃」两条路径删备忘，**两条分娩路径都漏** ⇒ 全自动生育后
 * 那条过期的「预产期-X / 待确认」（还会随备忘进日历）永久残留。
 */
function settleDeliveryForName(charName: string): void {
  deleteDueDateMemoForName(charName);
  try {
    const toastr = getToastr();
    if (toastr && typeof toastr.info === 'function') {
      toastr.info(`${charName} 已顺利分娩`, '', { timeOut: 4000 });
    }
  } catch (_e) { /* ignore */ }
}

/**
 * 人工终止妊娠：把已确认的 pregnancy 置为 postpartum + termination 记录，
 * 复用现有 processPregnancyAdvance 恢复期推进（恢复日清空 pregnancy 重建周期）。
 * 门禁：full 档 + 在场合格 + 已受孕 + 已验孕确认 + 未重复终止。
 * 落盘成功后才执行副作用（删备忘录 / 派发成就 / 刷新世界书）；失败回滚 record。
 */
export async function terminatePregnancy(nameOrKey: string): Promise<CycleManagerResult> {
  const key = normalizeCycleName(nameOrKey);
  const today = getTodayDateKey();
  const char = enumerateRoster().find(e => e.key === key);
  const rec = getCycleRecord(key);

  if (!key || !today || !char) return { ok: false, message: '无法定位该人物或当前日期。' };
  if (getConfig().cycleMode !== 'full') return { ok: false, message: '当前未开启完整孕育功能。' };
  if (!rec || !rec.pregnancy || rec.pregnancy.state !== 'pregnant' || !rec.pregnancy.confirmed) {
    return { ok: false, message: '该人物当前未确认怀孕，无法终止。' };
  }
  if (rec.pregnancy.milestones.includes('aborted')) {
    return { ok: false, message: '此次妊娠已终止。' };
  }

  const method = abortionMethodForWeeks(rec.pregnancy.weeks);
  const resumeDate = computeDateKeyForOffset(today, rec.cycleLength) || today;
  const next: CycleRecord = {
    ...rec,
    pregnancy: {
      ...rec.pregnancy,
      state: 'postpartum',
      postpartumUntil: resumeDate,
      weeks: rec.pregnancy.weeks,
      milestones: [...rec.pregnancy.milestones, 'aborted'],
      termination: { kind: 'abortion', method, date: today },
    },
    isOnPeriod: false,
  };

  const ok = await updateCycleRecordPersisted(key, next);
  if (!ok) return { ok: false, message: '保存失败，原状态已保留，请稍后重试。' };

  deleteDueDateMemoForName(char.name);
  try { (window as any).__ubEmitAchievement?.('pregnancy_terminated', { name: char.name, method, weeks: rec.pregnancy.weeks }); } catch (_e) { /* ignore */ }
  emitCycleApiEvent('pregnancy-terminated', {
    name: char.name,
    method,
    date: today,
    weeksAtTerm: rec.pregnancy.weeks,
    daysToRecover: diffDays(resumeDate, today) ?? rec.cycleLength,
  });
  emitCycleApiEvent('cycle-state-changed', { name: char.name, anchor: getCurrentStoryChatKey() });
  invalidateCycleDecisionsForName(key);
  dropExternalCycleDecisionsForName(key);
  handleCycleTick();
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
// P3 跳跃摘要 flush（§2.2）+ 日历标注查询（§5.6）
// ═══════════════════════════════════════════════════════════════

/**
 * 把多份跳跃摘要按角色名合并：gap 取最大、newPeriodStarts/newMilestones 取并集、
 * pregnancyDelta 按优先级 delivered>progressed>conceived 取胜。供 flushJumpSummaries
 * 与决策队列 merge 复用，确保同一角色重复入队不会出现多行。
 */
export function mergeJumpSummariesByName(summaries: JumpSummary[]): JumpSummary[] {
  const merged: JumpSummary[] = [];
  const byName = new Map<string, number>();
  const rank = { conceived: 1, progressed: 2, delivered: 3 } as const;
  for (const s of summaries) {
    const idx = byName.get(s.name);
    if (idx === undefined) {
      byName.set(s.name, merged.length);
      merged.push({ ...s, newPeriodStarts: [...s.newPeriodStarts], newMilestones: [...s.newMilestones] });
    } else {
      const m = merged[idx];
      m.gap = Math.max(m.gap, s.gap);
      for (const d of s.newPeriodStarts) if (!m.newPeriodStarts.includes(d)) m.newPeriodStarts.push(d);
      for (const ms of s.newMilestones) if (!m.newMilestones.includes(ms)) m.newMilestones.push(ms);
      if (s.pregnancyDelta && (!m.pregnancyDelta || rank[s.pregnancyDelta] > rank[m.pregnancyDelta])) {
        m.pregnancyDelta = s.pregnancyDelta;
        m.pregnancyFromWeeks = s.pregnancyFromWeeks;
        m.pregnancyToWeeks = s.pregnancyToWeeks;
      }
    }
  }
  return merged;
}

/**
 * 把已持久化的跳跃摘要合并后送入统一决策队列；用户确认后才清空。
 * 仅在本 tick 产生新摘要、或队列尚未持有该聊天的跳跃摘要项时入队——
 * 否则每次表格更新都会重复入队，merge 会把已展示的摘要再叠一行，且
 * 每次重渲都会重置弹窗的「可点击计时」使「知道了」按钮无法按下。
 */
function flushJumpSummaries(newSummaries: JumpSummary[]): void {
  const jumpKey = `cycle-jump-summary:${getCurrentStoryChatKey()}:pending`;
  const hasItem = systemDecisionQueue.activeItem?.key === jumpKey
    || systemDecisionQueue.pendingItems.some(item => item.key === jumpKey);
  if (newSummaries.length === 0 && hasItem) return;
  const pending = getPendingCycleJumpSummaries() as JumpSummary[];
  if (pending.length === 0) return;
  const merged = mergeJumpSummariesByName(pending);
  showJumpSummaryPopup(merged, () => {
    setPendingCycleJumpSummaries([]);
  });
}

/**
 * 日历标注查询（§5.6）。**仅在打开日历弹窗时调用**——平时零开销。
 * 返回 dateKey → CycleDayMark[] 的 Map；空 Map = 无标注（off 档也返回空）。
 *
 * 标记规则（按角色聚合，同日多角色合并）：
 * - past-period：periodHistory 中每个开始日（淡化样式）
 * - predicted-period：lmp + cycleLength × k（k=1,2,3），仅未来日（≥ today）
 * - due-date：已 confirmed 的孕期角色的 expectedDueDate
 *
 * 注意：返回 Map 可能包含月格外的日期（如 periodHistory 跨月）；调用方按 cell.key 查找自动过滤。
 */
export function getCycleCalendarAnnotations(_year: number, _month: number): Map<string, CycleDayMark[]> {
  const out = new Map<string, CycleDayMark[]>();
  const cycleMode = getConfig().cycleMode;
  if (cycleMode === 'off') return out;

  const today = getTodayDateKey();
  const roster = enumerateRoster();

  for (const char of roster) {
    const rec = getCycleRecord(char.key);
    if (!rec) continue;

    const baseFields = {
      charName: char.name,
      cycleLength: rec.cycleLength,
      periodLength: rec.periodLength,
      lastPeriodStart: rec.lastPeriodStart,
    };

    const addMark = (
      dateKey: string | null,
      kind: CycleDayMarkKind,
      extra?: Partial<CycleDayMark>,
    ): void => {
      if (!dateKey) return;
      const arr = out.get(dateKey) || [];
      arr.push({ kind, ...baseFields, ...extra } as CycleDayMark);
      out.set(dateKey, arr);
    };

    // 怀孕与产后恢复期间不生成该角色的经期历史点或未来预测。
    if (!rec.pregnancy) {
      for (const d of rec.periodHistory) {
        addMark(d, 'past-period', { dayOfPeriod: 1 });
      }

      let predictedStart = rec.lastPeriodStart;
      let predictedLength = rec.cycleLength;
      for (let k = 1; k <= 3; k++) {
        const predicted = computeDateKeyForOffset(predictedStart, predictedLength);
        if (!predicted) continue;
        const daysUntil = today ? diffDays(predicted, today) : null;
        if (daysUntil !== null && daysUntil < 0) continue;
        const nextLength = cycleLengthForStart(rec.baseCycleLength, char.key, predicted);
        addMark(predicted, 'predicted-period', {
          daysUntil: daysUntil ?? undefined,
          cycleLength: nextLength,
        });
        predictedStart = predicted;
        predictedLength = nextLength;
      }
    }

    // 孕期阶段点只在 full 档且验孕消息确认后生成；确认后可回看已经过的起点。
    if (cycleMode === 'full' && rec.pregnancy?.state === 'pregnant' && rec.pregnancy.confirmed) {
      const preg = rec.pregnancy;
      const stages: Array<{ kind: CycleDayMarkKind; offset: number; week: 1 | 13 | 28; trimester: 1 | 2 | 3 }> = [
        { kind: 'pregnancy-early', offset: 0, week: 1, trimester: 1 },
        { kind: 'pregnancy-middle', offset: 12 * 7, week: 13, trimester: 2 },
        { kind: 'pregnancy-late', offset: 27 * 7, week: 28, trimester: 3 },
      ];
      for (const stage of stages) {
        const stageDate = computeDateKeyForOffset(preg.conceiveDate, stage.offset);
        addMark(stageDate, stage.kind, {
          weeks: preg.weeks,
          trimester: stage.trimester,
          stageWeek: stage.week,
          expectedDueDate: preg.expectedDueDate,
          daysUntil: stageDate && today ? (diffDays(stageDate, today) ?? undefined) : undefined,
        });
      }
      addMark(preg.expectedDueDate, 'due-date', {
        weeks: preg.weeks,
        trimester: trimesterOf(preg.weeks),
        expectedDueDate: preg.expectedDueDate,
        daysUntil: today ? (diffDays(preg.expectedDueDate, today) ?? undefined) : undefined,
      });
    }
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════
// 对外 API（window.__ubCycleAPI）引擎侧支撑
// 门面与参数映射见 core/cycle-external-api.ts；此处只提供与引擎内部完全同一套
// 判定/写入/副作用路径的入口，保证「拓展方调用 ≡ 引擎自然流程」。
// ═══════════════════════════════════════════════════════════════

/** 对外 listCycleActors()：三张人物表全部候选（含被排除者，附 excluded 标记），按姓名去重、顺序稳定。 */
export interface CycleActorApiInfo {
  key: string;
  name: string;
  source: 'protagonist' | 'romance' | 'important';
  age: number | null;
  female: boolean;
  excluded: boolean;
  hasRecord: boolean;
}

export function listCycleActorsForApi(): CycleActorApiInfo[] {
  const store = loadCycleStore();
  return enumerateCycleCandidates().map(candidate => ({
    key: candidate.key,
    name: candidate.name,
    source: candidate.source,
    age: candidate.age,
    female: candidate.female,
    excluded: !!store.permanentExclusions[candidate.key],
    hasRecord: !!store.records[candidate.key],
  }));
}

/**
 * 对外 conceive(name, {method})：手动触发一次受孕判定。
 * 概率 = baseRisk(当前阶段) × 防护系数 × 规律系数，与自然流程共用 rollConception（同一代码路径）。
 * 掷骰静默执行，成功落盘后才派发 conceived 事件（保证事件与持久状态一致）。
 */
export async function conceiveForApi(
  nameOrKey: string,
  form: SexForm,
): Promise<{ ok: boolean; message?: string; conceived?: boolean; pregnancy?: PregnancyState | null }> {
  if (!isStoryStorageReady()) return { ok: false, message: '存储未就绪。' };
  if (getConfig().cycleMode !== 'full') return { ok: false, message: '当前未开启完整孕育功能。' };
  const key = normalizeCycleName(nameOrKey);
  const today = getTodayDateKey();
  const char = enumerateRoster().find(entry => entry.key === key);
  if (!key || !char || !today) return { ok: false, message: '无法定位该人物或当前游戏内日期。' };
  const rec = getCycleRecord(key);
  if (!rec) return { ok: false, message: '该人物暂无周期记录，请等待引擎建立后再试。' };
  if (rec.eligibilitySuspendedAt) return { ok: false, message: '该人物当前不纳入经期和怀孕功能。' };
  // 追加批次 1 门禁（§J-5 / 验收 30）：canGestate=false（含三开关全 false）不进入受孕判定。
  if (!canGestateForChar(key, char.female)) {
    return { ok: false, message: '该人物不具备妊娠能力（canGestate=false），不可受孕。' };
  }
  if (rec.pregnancy) {
    if (rec.pregnancy.state === 'postpartum') return { ok: false, message: '该人物正处于产后/小产恢复期。' };
    return { ok: false, message: '该人物已处于孕期（含尚未验孕的隐藏孕期），不可重复受孕。' };
  }
  const daysInto = computeDaysIntoCycle(today, rec.lastPeriodStart, rec.cycleLength) ?? 1;
  const phase = classifyPhase(daysInto, rec.cycleLength, rec.periodLength);
  const next: CycleRecord = { ...rec, pregnancy: null, pendingSexForm: rec.pendingSexForm };
  rollConceptionMulti(next, today, phase, form, 1, char.name, false); // 静默掷骰，事件延后到落盘成功
  const conceived = next.pregnancy !== null;
  const ok = await updateCycleRecordPersisted(key, next);
  if (!ok) return { ok: false, message: '保存失败，状态未改变，请稍后重试。' };
  if (conceived && next.pregnancy) {
    emitCycleApiEvent('conceived', {
      name: char.name,
      conceiveDate: next.pregnancy.conceiveDate,
      expectedDueDate: next.pregnancy.expectedDueDate,
      weeks: 1,
    });
  }
  emitCycleApiEvent('cycle-state-changed', { name: char.name, anchor: getCurrentStoryChatKey() });
  handleCycleTick(); // 刷新世界书投影（幂等）
  return { ok: true, conceived, pregnancy: conceived ? next.pregnancy : null };
}

/**
 * 对外 deliverPregnancy(name)：手动临盆/强制分娩。
 * 与自然到期分娩共用 postpartum 语义：state='postpartum'、postpartumUntil=分娩日+当前周期长度
 * （自然分娩为预产期+周期长度；手动以实际分娩日起算恢复期）、isOnPeriod=false。
 * 派发 delivery 事件（conceiveDate/expectedDueDate/deliveryDate/weeks 齐备）。
 */
export async function deliverPregnancyForApi(nameOrKey: string): Promise<{ ok: boolean; message?: string }> {
  if (!isStoryStorageReady()) return { ok: false, message: '存储未就绪。' };
  if (getConfig().cycleMode !== 'full') return { ok: false, message: '当前未开启完整孕育功能。' };
  const key = normalizeCycleName(nameOrKey);
  const today = getTodayDateKey();
  const char = enumerateRoster().find(entry => entry.key === key);
  const rec = getCycleRecord(key);
  if (!key || !char || !today) return { ok: false, message: '无法定位该人物或当前游戏内日期。' };
  if (!rec?.pregnancy || rec.pregnancy.state !== 'pregnant') {
    return { ok: false, message: '该人物当前不在孕期，无法分娩。' };
  }
  const preg = rec.pregnancy;
  const weeksAtDelivery = Math.min(computeWeeks(preg.conceiveDate, today), 42);
  const resumeDate = computeDateKeyForOffset(today, rec.cycleLength) || today;
  const next: CycleRecord = {
    ...rec,
    pregnancy: {
      ...preg,
      state: 'postpartum',
      postpartumUntil: resumeDate,
      weeks: weeksAtDelivery,
    },
    isOnPeriod: false,
  };
  const ok = await updateCycleRecordPersisted(key, next);
  if (!ok) return { ok: false, message: '保存失败，原状态已保留，请稍后重试。' };
  if (next.pregnancy?.confirmed) {
    try { (window as any).__ubEmitAchievement?.('new_life', { name: char.name }); } catch (_e) { /* ignore */ }
    // F18：与自然分娩同口径——对外分娩同样结算「预产期-X」备忘。
    settleDeliveryForName(char.name);
  }
  emitCycleApiEvent('delivery', {
    name: char.name,
    conceiveDate: preg.conceiveDate,
    expectedDueDate: preg.expectedDueDate,
    deliveryDate: today,
    weeks: weeksAtDelivery,
  });
  emitCycleApiEvent('cycle-state-changed', { name: char.name, anchor: getCurrentStoryChatKey() });
  invalidateCycleDecisionsForName(key);
  dropExternalCycleDecisionsForName(key);
  handleCycleTick();
  return { ok: true };
}

/**
 * 对外 confirmPregnancy(name)：手动验孕确认。时机校验与引擎自然触发一致
 * （受孕 ≥14 天 或 月信已推迟），落地走 confirmPregnancyForChar 同一唯一路径。
 */
export async function confirmPregnancyForApi(nameOrKey: string): Promise<{ ok: boolean; message?: string }> {
  if (!isStoryStorageReady()) return { ok: false, message: '存储未就绪。' };
  if (getConfig().cycleMode !== 'full') return { ok: false, message: '当前未开启完整孕育功能。' };
  const key = normalizeCycleName(nameOrKey);
  const today = getTodayDateKey();
  if (!key || !today) return { ok: false, message: '无法定位该人物或当前游戏内日期。' };
  const rec = getCycleRecord(key);
  if (!rec?.pregnancy || rec.pregnancy.state !== 'pregnant') return { ok: false, message: '该人物当前不在孕期。' };
  if (rec.pregnancy.confirmed) return { ok: false, message: '此次怀孕已确认过。' };
  const sinceConceive = diffDays(today, rec.pregnancy.conceiveDate) ?? 0;
  const expectedNextPeriod = computeDateKeyForOffset(rec.pregnancy.lmp, rec.cycleLength);
  const periodOverdue = expectedNextPeriod ? (diffDays(today, expectedNextPeriod) ?? 0) >= 0 : false;
  if (sinceConceive < 14 && !periodOverdue) {
    return { ok: false, message: '尚未到验孕时机（需受孕满 14 天或月信已推迟）。' };
  }
  const charName = enumerateCycleCandidates().find(entry => entry.key === key)?.name ?? key;
  _pregTestPending.delete(key);
  confirmPregnancyForChar(key, charName);
  handleCycleTick(); // 刷新孕期世界书投影（幂等）
  return { ok: true };
}

/**
 * 对外 setExcluded(name, false)：恢复被永久排除的人物（UI 侧保持「不可撤销」，仅 API 提供）。
 * 恢复语义与「资格恢复」既有先例一致：从今天继续、不回放排除期间的经期/性爱增量；
 * 排除期间冻结的孕期按绝对日期（conceiveDate/expectedDueDate）自然续算。
 */
export async function restoreCycleEligibilityForApi(nameOrKey: string): Promise<{ ok: boolean; message?: string }> {
  const key = normalizeCycleName(nameOrKey);
  const today = getTodayDateKey();
  if (!key || !today) return { ok: false, message: '无法定位该人物或当前游戏内日期。' };
  if (!isCyclePermanentlyExcluded(key)) return { ok: false, message: '该人物未被永久排除。' };
  const candidate = enumerateCycleCandidates().find(entry => entry.key === key);
  if (!candidate) return { ok: false, message: '当前聊天的人物表中未找到该人物。' };
  if (!isStoryStorageReady()) return { ok: false, message: '存储未就绪。' };
  if (!await restoreCycleEligibilityInStore(key)) {
    return { ok: false, message: '恢复失败，排除标记保持不变，请稍后重试。' };
  }
  const rec = getCycleRecord(key);
  if (rec) {
    const next: CycleRecord = {
      ...rec,
      lastProcessedDateKey: today,
      lastSeenSexCount: readSexCountForName(candidate.name) ?? rec.lastSeenSexCount,
    };
    if (next.pregnancy) {
      next.isOnPeriod = false;
      next.pregnancy.weeks = Math.min(computeWeeks(next.pregnancy.conceiveDate, today), 42);
    } else {
      const day = computeDaysIntoCycle(today, next.lastPeriodStart, next.cycleLength);
      next.isOnPeriod = day !== null && day <= next.periodLength;
    }
    await updateCycleRecordPersisted(key, next);
  }
  handleCycleTick();
  emitCycleApiEvent('excluded-changed', { name: candidate.name, excluded: false });
  emitCycleApiEvent('cycle-state-changed', { name: candidate.name, anchor: getCurrentStoryChatKey() });
  return { ok: true };
}

/**
 * 对外 getCapability(name)：解析后的生殖能力（追加批次 1）。
 * 覆盖优先于生效表面性别（含 setFemale 覆盖）；无覆盖时 auto 推导。
 * 候选不存在/不可读返回 null。所有名单合成均走 enumerateCycleCandidates（含男性候选）。
 */
export function resolveCycleCapabilityForApi(nameOrKey: string): CycleCapability | null {
  const key = normalizeCycleName(nameOrKey);
  const candidate = key ? enumerateCycleCandidates().find(entry => entry.key === key) : null;
  if (!candidate) return null;
  const override = getCapabilityOverride(key);
  const triple = mergeCapabilityTriple(candidate.female, override);
  return { ...triple, source: override ? 'override' : 'auto' };
}

/**
 * 对外 setCapability(name, patch)：生殖能力三开关覆盖（追加批次 1）。
 * - 归一化在 mergeCapabilityTriple 内完成：canGestate⇒hasCycle、!hasCycle⇒!canGestate。
 * - 参与（hasCycle 生效值）变化经由既有资格冻结/恢复机制落地：暂停保留记录/孕期，
 *   恢复按当前日期续算并同步性爱次数基线（handleCycleTick 内，不重放暂停期间增量）。
 * - 表面性别为男 + canGestate:true：归一化强制 hasCycle=true → 下一 tick 冷启动建立周期记录，
 *   纳入经期/周期条/受孕链路（验收 27）。
 * - 覆盖与记录同存周期簿 feature：setCycleDomainOverrides 一次原子写 + 失败回滚。
 */
export async function setCapabilityForApi(
  nameOrKey: string,
  patch: { hasCycle?: boolean; canGestate?: boolean; canInseminate?: boolean },
): Promise<{ ok: boolean; message?: string; capability?: CycleCapability }> {
  if (!isStoryStorageReady()) return { ok: false, message: '存储未就绪。' };
  const key = normalizeCycleName(nameOrKey);
  const candidate = key ? enumerateCycleCandidates().find(entry => entry.key === key) : null;
  if (!key || !candidate) return { ok: false, message: '当前聊天的人物表中未找到该人物。' };
  const before = mergeCapabilityTriple(candidate.female, getCapabilityOverride(key));
  const merged = normalizeCapabilityTriple({ ...before, ...patch });
  if (!await setCycleDomainOverrides(key, { capability: { ...merged } })) {
    return { ok: false, message: '保存失败，能力未改变，请稍后重试。' };
  }
  handleCycleTick(); // 参与/记录变化走既有冻结/恢复/冷启动路径 + 世界书投影（幂等）
  emitCycleApiEvent('capability-changed', {
    name: candidate.name,
    hasCycle: merged.hasCycle,
    canGestate: merged.canGestate,
    canInseminate: merged.canInseminate,
  });
  if (before.hasCycle !== merged.hasCycle) {
    emitCycleApiEvent('cycle-state-changed', { name: candidate.name, anchor: getCurrentStoryChatKey() });
  }
  return { ok: true, capability: { ...merged, source: 'override' } };
}

/**
 * 对外 setFemale(name, female)（追加批次 1，P1）：写表面性别覆盖（仅周期/孕育域内生效，
 * 人物表数据不动）。名单合成单点覆盖（enumerateCycleCandidates）→ 能力按「覆盖优先于
 * 表面性别」重推导；周期参与变化的副作用与 setCapability 同一机制。
 */
export async function setFemaleForApi(nameOrKey: string, female: boolean): Promise<{ ok: boolean; message?: string }> {
  if (!isStoryStorageReady()) return { ok: false, message: '存储未就绪。' };
  const key = normalizeCycleName(nameOrKey);
  const candidate = key ? enumerateCycleCandidates().find(entry => entry.key === key) : null;
  if (!key || !candidate) return { ok: false, message: '当前聊天的人物表中未找到该人物。' };
  const beforeHasCycle = candidateHasCycle(candidate);
  if (!await setCycleDomainOverrides(key, { sex: female })) {
    return { ok: false, message: '保存失败，性别未改变，请稍后重试。' };
  }
  handleCycleTick();
  const after = mergeCapabilityTriple(female, getCapabilityOverride(key));
  emitCycleApiEvent('capability-changed', {
    name: candidate.name,
    hasCycle: after.hasCycle,
    canGestate: after.canGestate,
    canInseminate: after.canInseminate,
  });
  if (beforeHasCycle !== after.hasCycle) {
    emitCycleApiEvent('cycle-state-changed', { name: candidate.name, anchor: getCurrentStoryChatKey() });
  }
  return { ok: true };
}

/**
 * 对外 cancelPregnancy(name)：取消怀孕 / 撤回子嗣的母体侧（追加批次 2，P0）。
 * 「当作没发生过」的干净回退（§J-8）：清 pregnancy（pregnant/postpartum 均可，postpartumUntil/
 * termination 随之消失）+ 清 pendingSexForm + 删「预产期-<姓名>」备忘（与 terminatePregnancy
 * 同一条删除路径）+ 不进入恢复期；周期按既有参数与当前日期重算阶段，性爱基线同步当前值
 * （不重放孕育期间增量）。子嗣/血缘数据由调用方在自己的存储里撤销，不在本方法内。
 */
export async function cancelPregnancyForApi(nameOrKey: string): Promise<{ ok: boolean; message?: string }> {
  if (!isStoryStorageReady()) return { ok: false, message: '存储未就绪。' };
  if (getConfig().cycleMode !== 'full') return { ok: false, message: '当前未开启完整孕育功能。' };
  const key = normalizeCycleName(nameOrKey);
  const today = getTodayDateKey();
  const candidate = key ? enumerateCycleCandidates().find(entry => entry.key === key) : null;
  const rec = key ? getCycleRecord(key) : null;
  if (!key || !today || !candidate) return { ok: false, message: '无法定位该人物或当前游戏内日期。' };
  if (!rec?.pregnancy) return { ok: false, message: '该人物当前没有孕育状态（孕期/产后），无需取消。' };
  const charName = candidate.name;
  const next: CycleRecord = {
    ...rec,
    pregnancy: null,       // 清孕期/产后（不写 state:'postpartum'、termination 保持 null，即不进恢复期）
    pendingSexForm: null,  // 清受孕形式待确认快照
    // 不重放孕育期间的性爱增量：基线直接同步到当前值
    lastSeenSexCount: readSexCountForName(charName) ?? rec.lastSeenSexCount,
    isOnPeriod: false,
  };
  // 回到「未孕育」基线：按既有 cycleLength/baseCycleLength/lastPeriodStart 与当前日期重算经期缓存
  const daysInto = computeDaysIntoCycle(today, next.lastPeriodStart, next.cycleLength);
  next.isOnPeriod = daysInto !== null && daysInto <= next.periodLength;
  const ok = await updateCycleRecordPersisted(key, next);
  if (!ok) return { ok: false, message: '保存失败，原状态已保留，请稍后重试。' };

  deleteDueDateMemoForName(charName);
  invalidateCycleDecisionsForName(key);
  dropExternalCycleDecisionsForName(key);
  _sexFormPending.delete(key);
  _pregTestPending.delete(key);
  emitCycleApiEvent('pregnancy-cancelled', { name: charName });
  emitCycleApiEvent('cycle-state-changed', { name: charName, anchor: getCurrentStoryChatKey() });
  handleCycleTick(); // 刷新经期/孕期世界书投影（幂等；孕期条目随孕情清空而关闭）
  return { ok: true };
}
