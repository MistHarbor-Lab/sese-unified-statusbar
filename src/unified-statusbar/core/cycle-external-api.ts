// ===== 周期/孕育引擎 · 对外 API 门面（window.__ubCycleAPI） =====
//
// 供拓展项目读写周期状态、触发受孕/验孕/终止/分娩、观察事件、接管避孕/验孕决策渲染。
//
// 性能与隔离纪律：
// - 本模块只静态挂载一个对象；所有重活都在方法体内按需执行，无轮询/无定时器/无监听。
// - 事件派发经 core/cycle-api-events.ts，无订阅者时零开销；引擎侧派发点全部在「确有变化」分支。
// - 所有读接口返回深拷贝；所有写接口经引擎既有写入路径（标脏/防抖/awaited 持久化 + 回滚）。
// - host 模式（默认）下引擎行为与本模块存在与否完全一致；delegate 模式只改「渲染」，不改判定。

import { safeClone } from './deep-clone';
import { getConfig } from './config-store';
import { getTodayDateKey, computeDateKeyForOffset, compareDateKey } from './calendar-core';
import { getCurrentStoryChatKey, isStoryStorageReady } from './story-floor-store';
// L8（规格 §I）：字段渲染注册器（纯模块；注册/查询/渲染三原语在此暴露为 API 面）
import {
  registerCycleFieldRenderer as registerFieldRenderer,
  renderCycleFieldViaRegistry,
} from './cycle-field-renderer';
import {
  type CycleRecord,
  type PregnancyState,
  type PendingSexForm,
  type PendingCycleJumpSummary,
  getCycleRecord,
  setCycleRecord,
  persistCycleStoreImmediate,
  getPendingCycleJumpSummaries,
  setPendingCycleJumpSummaries,
  getAllCycleRecords,
  isCyclePermanentlyExcluded,
  updateCycleRecordPersisted,
  replaceAllCycleRecords,
} from './cycle-store';
import { normalizeCycleName } from './cycle-eligibility';
import {
  classifyPhase,
  computeDaysIntoCycle,
  diffDays,
  handleCycleTick,
  isCycleNameEligibleNow,
  permanentlyExcludeCycleCharacter,
  terminatePregnancy,
  conceiveForApi,
  confirmPregnancyForApi,
  deliverPregnancyForApi,
  cancelPregnancyForApi,
  resolveCycleCapabilityForApi,
  setCapabilityForApi,
  setFemaleForApi,
  listCycleActorsForApi,
  restoreCycleEligibilityForApi,
  setCycleDecisionDelegation,
  listExternalCycleDecisions,
  resolveExternalCycleDecision,
  dismissExternalCycleDecision,
  type CycleActorApiInfo,
  type CycleCapability,
} from './cycle-engine';
import { subscribeCycleApiEvent, unsubscribeCycleApiEvent, emitCycleApiEvent, type CycleApiEventHandler } from './cycle-api-events';

export const CYCLE_API_NAME = 'ub-cycle-api';
export const CYCLE_API_VERSION = '1.0.0';
export const CYCLE_API_SCHEMA_VERSION = 2;

type ApiResult = { ok: boolean; message?: string };
type SexForm = 'unprotected' | 'withdrawal' | 'condom';

const DATE_KEY_RE = /^-?\d{4,6}-\d{2}-\d{2}$/;
const VALID_SEX_FORMS: ReadonlyArray<string> = ['unprotected', 'withdrawal', 'condom'];

function isValidDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_KEY_RE.test(value);
}

function intInRange(value: unknown, lo: number, hi: number): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
}

// ═══════════════════════════════════════════════════════════════
// 数据映射（引擎内部 → 对外 schema）
// ═══════════════════════════════════════════════════════════════

function toApiTermination(preg: PregnancyState): PregnancyState['termination'] & { weeksAtTerm: number; daysToRecover: number } | null {
  if (!preg.termination) return null;
  const daysToRecover = preg.postpartumUntil && isValidDateKey(preg.postpartumUntil)
    ? diffDays(preg.postpartumUntil, preg.termination.date) ?? preg.weeks
    : preg.weeks;
  return { ...preg.termination, weeksAtTerm: preg.weeks, daysToRecover };
}

function toApiPregnancy(preg: PregnancyState | null): Record<string, unknown> | null {
  if (!preg) return null;
  return {
    state: preg.state,
    conceiveDate: preg.conceiveDate,
    lmp: preg.lmp,
    expectedDueDate: preg.expectedDueDate,
    postpartumUntil: preg.postpartumUntil,
    weeks: preg.weeks,
    milestones: [...preg.milestones],
    confirmed: preg.confirmed,
    termination: toApiTermination(preg),
  };
}

function toApiPendingSexForm(pending: PendingSexForm | null): Record<string, unknown> | null {
  if (!pending) return null;
  return {
    name: '',
    anchor: getCurrentStoryChatKey(),
    options: ['unprotected', 'withdrawal', 'condom'],
    delta: pending.delta,
    phase: pending.phase,
    conceiveDate: pending.conceiveDate,
  };
}

function toApiCycleRecord(key: string, rec: CycleRecord, actors?: CycleActorApiInfo): Record<string, unknown> {
  const today = getTodayDateKey();
  const daysInto = today ? computeDaysIntoCycle(today, rec.lastPeriodStart, rec.cycleLength) : null;
  const phase = daysInto !== null ? classifyPhase(daysInto, rec.cycleLength, rec.periodLength) : null;
  const candidate = actors ?? listCycleActorsForApi().find(entry => entry.key === key);
  const excluded = isCyclePermanentlyExcluded(key);
  return {
    key,
    name: candidate?.name ?? key,
    source: candidate?.source ?? 'important',
    age: candidate?.age ?? null,
    female: candidate?.female ?? false,
    // cycleEnabled 按生效参与（hasCycle，含能力覆盖的男性可妊娠者）判定，而非表面性别
    cycleEnabled: getConfig().cycleMode !== 'off' && !excluded && isCycleNameEligibleNow(key),
    hasCycleRecord: true,
    baseCycleLength: rec.baseCycleLength,
    cycleLength: rec.cycleLength,
    periodLength: rec.periodLength,
    regularity: rec.regularity,
    lastPeriodStart: rec.lastPeriodStart,
    periodHistory: [...rec.periodHistory],
    isOnPeriod: rec.isOnPeriod,
    // —— 只读派生字段（实时计算；渲染层另有「未验孕隐藏孕情」的玩家可见性掩码，API 返回真实值）——
    phase,
    daysIntoCycle: daysInto,
    lastSeenSexCount: rec.lastSeenSexCount,
    lastProcessedDateKey: rec.lastProcessedDateKey,
    eligibilitySuspendedAt: rec.eligibilitySuspendedAt,
    pregnancy: toApiPregnancy(rec.pregnancy),
    pendingSexForm: toApiPendingSexForm(rec.pendingSexForm),
  };
}

// ═══════════════════════════════════════════════════════════════
// 写入校验（规格 §1：范围校验失败必须点名字段；扩展字段一律剥离）
// ═══════════════════════════════════════════════════════════════

function validateIncomingPregnancy(raw: unknown): { ok: true; pregnancy: PregnancyState | null } | { ok: false; message: string } {
  if (raw === null || raw === undefined) return { ok: true, pregnancy: null };
  if (!raw || typeof raw !== 'object') return { ok: false, message: '字段 pregnancy 须为对象或 null。' };
  const p = raw as Record<string, unknown>;
  const state = p.state === 'pregnant' || p.state === 'postpartum' ? p.state : null;
  if (!state) return { ok: false, message: '字段 pregnancy.state 须为 pregnant / postpartum（清空孕育请传 null）。' };
  if (!isValidDateKey(p.conceiveDate)) return { ok: false, message: '字段 pregnancy.conceiveDate 须为 YYYY-MM-DD。' };
  if (!isValidDateKey(p.lmp)) return { ok: false, message: '字段 pregnancy.lmp 须为 YYYY-MM-DD。' };
  if (!isValidDateKey(p.expectedDueDate)) return { ok: false, message: '字段 pregnancy.expectedDueDate 须为 YYYY-MM-DD。' };
  const weeks = intInRange(p.weeks, 1, 42);
  if (weeks === null) return { ok: false, message: '字段 pregnancy.weeks 须为 1–42 的整数。' };
  const postpartumUntil = isValidDateKey(p.postpartumUntil) ? p.postpartumUntil : null;
  if (state === 'postpartum' && !postpartumUntil) {
    return { ok: false, message: '字段 pregnancy.postpartumUntil：postpartum 状态必须携带有效的恢复日期。' };
  }
  let termination: PregnancyState['termination'] = null;
  if (p.termination !== null && p.termination !== undefined) {
    if (!p.termination || typeof p.termination !== 'object') {
      return { ok: false, message: '字段 pregnancy.termination 须为对象或 null。' };
    }
    const t = p.termination as Record<string, unknown>;
    const method = t.method === 'medical' || t.method === 'surgical' || t.method === 'induction' ? t.method : null;
    if (t.kind !== 'abortion' || !method || !isValidDateKey(t.date)) {
      return { ok: false, message: '字段 pregnancy.termination 须含 kind=abortion、method(medical/surgical/induction) 与有效日期。' };
    }
    termination = { kind: 'abortion', method, date: t.date };
  }
  const milestones = Array.isArray(p.milestones)
    ? Array.from(new Set(p.milestones.filter((m): m is string => typeof m === 'string' && !!m)))
    : [];
  return {
    ok: true,
    pregnancy: {
      state,
      conceiveDate: p.conceiveDate,
      lmp: p.lmp,
      expectedDueDate: p.expectedDueDate,
      postpartumUntil,
      weeks,
      milestones,
      confirmed: p.confirmed === true,
      termination,
    },
  };
}

/**
 * 把对外传入的 record 规范化为引擎 CycleRecord。范围字段（cycleLength 等）非法直接拒绝并点名；
 * 引擎锚字段（lastProcessedDateKey/lastSeenSexCount/eligibilitySuspendedAt）非法或缺省时回退现有值。
 * 任何不认识的字段（含拓展方扩展数据）一律剥离——扩展数据必须存调用方自己的命名空间（规格 §1）。
 */
function buildRecordFromApi(input: unknown, existing: CycleRecord, today: string): { ok: true; record: CycleRecord } | { ok: false; message: string } {
  if (!input || typeof input !== 'object') return { ok: false, message: 'record 须为对象。' };
  const raw = input as Record<string, unknown>;

  const baseCycleLength = intInRange(raw.baseCycleLength, 21, 45);
  if (baseCycleLength === null) return { ok: false, message: '字段 baseCycleLength 须为 21–45 的整数。' };
  const cycleLength = intInRange(raw.cycleLength, 21, 45);
  if (cycleLength === null) return { ok: false, message: '字段 cycleLength 须为 21–45 的整数。' };
  const periodLength = intInRange(raw.periodLength, 2, 10);
  if (periodLength === null || periodLength > cycleLength) {
    return { ok: false, message: '字段 periodLength 须为 2–10 的整数，且不能超过当前周期长度。' };
  }
  if (raw.regularity !== 'stable' && raw.regularity !== 'irregular') {
    return { ok: false, message: '字段 regularity 须为 stable / irregular。' };
  }
  if (!isValidDateKey(raw.lastPeriodStart)) return { ok: false, message: '字段 lastPeriodStart 须为 YYYY-MM-DD。' };
  if (diffDays(raw.lastPeriodStart, today) === null || (diffDays(raw.lastPeriodStart, today) as number) > 0) {
    return { ok: false, message: '字段 lastPeriodStart：末次经期开始日必须是今天或更早的有效日期。' };
  }
  const pregnancyResult = validateIncomingPregnancy(raw.pregnancy === undefined ? null : raw.pregnancy);
  if (!pregnancyResult.ok) return pregnancyResult;

  let periodHistory = existing.periodHistory;
  if (Array.isArray(raw.periodHistory)) {
    const seen = new Set<string>();
    for (const d of raw.periodHistory) if (isValidDateKey(d)) seen.add(d);
    if (!seen.has(raw.lastPeriodStart)) seen.add(raw.lastPeriodStart);
    periodHistory = Array.from(seen).sort(compareDateKey).slice(-12); // F50：数值比较
  } else {
    if (!periodHistory.includes(raw.lastPeriodStart)) {
      periodHistory = [...periodHistory, raw.lastPeriodStart].sort(compareDateKey).slice(-12); // F50
    }
  }

  const lastProcessedDateKey = isValidDateKey(raw.lastProcessedDateKey)
    ? (diffDays(raw.lastProcessedDateKey, today) ?? 1) > 0 ? today : raw.lastProcessedDateKey
    : existing.lastProcessedDateKey;
  const lastSeenSexCount = intInRange(raw.lastSeenSexCount, 0, 1e9) ?? existing.lastSeenSexCount;
  const eligibilitySuspendedAt = isValidDateKey(raw.eligibilitySuspendedAt) ? raw.eligibilitySuspendedAt : existing.eligibilitySuspendedAt;

  const daysInto = computeDaysIntoCycle(today, raw.lastPeriodStart, cycleLength);
  return {
    ok: true,
    record: {
      baseCycleLength,
      cycleLength,
      periodLength,
      regularity: raw.regularity,
      lastPeriodStart: raw.lastPeriodStart,
      periodHistory,
      isOnPeriod: pregnancyResult.pregnancy ? false : daysInto !== null && daysInto <= periodLength,
      pregnancy: pregnancyResult.pregnancy,
      pendingSexForm: existing.pendingSexForm, // 弹窗待确认快照由引擎独占管理，不接收外部写入
      lastSeenSexCount,
      lastProcessedDateKey,
      eligibilitySuspendedAt,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// API 对象
// ═══════════════════════════════════════════════════════════════

function createCycleApi() {
  const fail = (message: string): ApiResult => ({ ok: false, message });

  const requireStorage = (): ApiResult | null =>
    isStoryStorageReady() ? null : fail('存储未就绪。');

  const api = {
    // —— A. 元信息 / 就绪 / 配置 / 日期 / 锚点 ——
    name: CYCLE_API_NAME,
    schemaVersion: CYCLE_API_SCHEMA_VERSION,
    apiVersion: CYCLE_API_VERSION,

    ready(): boolean {
      return isStoryStorageReady();
    },

    capabilities(): Record<string, boolean> {
      const cfg = getConfig();
      const full = cfg.cycleMode === 'full' && isStoryStorageReady();
      return {
        cycleRead: cfg.cycleMode !== 'off',
        cycleWrite: cfg.cycleMode !== 'off' && isStoryStorageReady(),
        conception: full,
        confirm: full,
        termination: full,
        worldbook: (cfg.cycleMode !== 'off' && cfg.cycleWorldbookPeriod !== false)
          || (cfg.cycleMode === 'full' && cfg.cycleWorldbookPregnancy !== false),
        events: true,
        decisions: true,
        // 追加批次 1：生殖能力三开关（getCapability / setCapability / setFemale）
        reproductiveCapabilities: true,
      };
    },

    getConfig(): Record<string, unknown> {
      const cfg = getConfig();
      return {
        cycleMode: cfg.cycleMode,
        cycleWorldbookPeriod: cfg.cycleWorldbookPeriod !== false,
        cycleWorldbookPregnancy: cfg.cycleWorldbookPregnancy !== false,
        cycleSexFormPrompt: cfg.cycleSexFormPrompt,
        cycleShowBar: cfg.cycleShowBar !== false,
      };
    },

    today(): string {
      return getTodayDateKey() || '';
    },

    currentAnchor(): string {
      return getCurrentStoryChatKey();
    },

    // —— B. 人物名单 / 性别 / 排除 ——
    listCycleActors(): CycleActorApiInfo[] {
      try {
        return safeClone(listCycleActorsForApi());
      } catch (_e) {
        return [];
      }
    },

    isFemale(name: unknown): boolean {
      try {
        const key = String(name ?? '').trim().toLowerCase();
        return !!listCycleActorsForApi().some(entry => entry.key === key && entry.female);
      } catch (_e) {
        return false;
      }
    },

    isExcluded(name: unknown): boolean {
      try {
        return isCyclePermanentlyExcluded(String(name ?? ''));
      } catch (_e) {
        return false;
      }
    },

    async setExcluded(name: unknown, excluded: unknown): Promise<ApiResult> {
      try {
        const nameStr = String(name ?? '');
        if (excluded === true) {
          const result = await permanentlyExcludeCycleCharacter(nameStr);
          return { ok: result.ok, message: result.ok ? undefined : result.message };
        }
        if (excluded === false) {
          return await restoreCycleEligibilityForApi(nameStr);
        }
        return fail('excluded 参数须为 true / false。');
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    // —— K. 生殖能力三开关 / 性别写入（追加批次 1） ——
    async getCapability(name: unknown): Promise<Record<string, unknown> | null> {
      try {
        const capability: CycleCapability | null = resolveCycleCapabilityForApi(String(name ?? ''));
        return capability ? safeClone(capability) as unknown as Record<string, unknown> : null;
      } catch (_e) {
        return null;
      }
    },

    async setCapability(name: unknown, patch: unknown): Promise<ApiResult & { capability?: unknown }> {
      try {
        const storage = requireStorage();
        if (storage) return storage;
        if (!patch || typeof patch !== 'object') {
          return fail('patch 须为对象（hasCycle / canGestate / canInseminate 缺省字段保持现状）。');
        }
        const raw = patch as Record<string, unknown>;
        const clean: { hasCycle?: boolean; canGestate?: boolean; canInseminate?: boolean } = {};
        for (const field of ['hasCycle', 'canGestate', 'canInseminate'] as const) {
          const value = raw[field];
          if (value === undefined) continue;
          if (typeof value !== 'boolean') return fail(`字段 ${field} 须为 boolean。`);
          clean[field] = value;
        }
        if (Object.keys(clean).length === 0) {
          return fail('patch 至少包含 hasCycle / canGestate / canInseminate 之一。');
        }
        const result = await setCapabilityForApi(String(name ?? ''), clean);
        if (!result.ok) return fail(result.message || '保存失败。');
        refreshUiBestEffort();
        return { ok: true, ...(result.capability ? { capability: result.capability } : {}) };
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    async setFemale(name: unknown, female: unknown): Promise<ApiResult> {
      try {
        const storage = requireStorage();
        if (storage) return storage;
        if (typeof female !== 'boolean') return fail('female 参数须为 boolean（true=女，false=男）。');
        const result = await setFemaleForApi(String(name ?? ''), female);
        if (!result.ok) return fail(result.message || '保存失败。');
        refreshUiBestEffort();
        return { ok: true };
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    // —— C. 周期 / 孕育状态读写 ——
    getCycleRecord(name: unknown): Record<string, unknown> | null {
      try {
        const key = normalizeCycleName(name);
        const rec = key ? getCycleRecord(key) : null;
        if (!rec) return null;
        return safeClone(toApiCycleRecord(key, rec));
      } catch (_e) {
        return null;
      }
    },

    getCycleState(): Record<string, unknown> {
      try {
        const actors = listCycleActorsForApi();
        const actorByKey = new Map(actors.map(actor => [actor.key, actor]));
        const records: Record<string, unknown> = {};
        for (const key of Object.keys(getAllCycleRecords())) {
          const rec = getCycleRecord(key);
          if (rec) records[key] = toApiCycleRecord(key, rec, actorByKey.get(key));
        }
        return safeClone({
          records,
          pendingJumpSummaries: getPendingCycleJumpSummaries(),
        });
      } catch (_e) {
        return { records: {}, pendingJumpSummaries: [] };
      }
    },

    setCycleRecord(name: unknown, record: unknown): ApiResult {
      try {
        const storage = requireStorage();
        if (storage) return storage;
        const key = normalizeCycleName(name);
        const existing = key ? getCycleRecord(key) : null;
        const today = getTodayDateKey();
        if (!key || !existing) return fail('该人物暂无周期记录（记录由引擎为三表人物自动建立）。');
        if (!today) return fail('当前无有效游戏内日期。');
        const built = buildRecordFromApi(record, existing, today);
        if (!built.ok) return built;
        setCycleRecord(key, built.record); // 标脏 + 防抖落盘（引擎常规写路径）
        return { ok: true };
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    async saveCycleRecord(name: unknown, record: unknown): Promise<ApiResult> {
      try {
        const storage = requireStorage();
        if (storage) return storage;
        const key = normalizeCycleName(name);
        const existing = key ? getCycleRecord(key) : null;
        const today = getTodayDateKey();
        if (!key || !existing) return fail('该人物暂无周期记录（记录由引擎为三表人物自动建立）。');
        if (!today) return fail('当前无有效游戏内日期。');
        const built = buildRecordFromApi(record, existing, today);
        if (!built.ok) return built;
        const ok = await updateCycleRecordPersisted(key, built.record); // 原子写 + 失败回滚
        if (!ok) return fail('保存失败，原状态已保留，请稍后重试。');
        handleCycleTick(); // 世界书投影 + 引擎一致性收尾（幂等）
        refreshUiBestEffort();
        emitCycleApiEvent('cycle-state-changed', { name: keyToDisplayName(key), anchor: getCurrentStoryChatKey() });
        return { ok: true };
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    async setCycleState(state: unknown): Promise<ApiResult> {
      try {
        const storage = requireStorage();
        if (storage) return storage;
        const today = getTodayDateKey();
        if (!today) return fail('当前无有效游戏内日期。');
        if (!state || typeof state !== 'object') return fail('state 须为 { records, pendingJumpSummaries }。');
        const raw = state as Record<string, unknown>;
        if (!raw.records || typeof raw.records !== 'object') return fail('字段 records 须为对象。');
        const rawRecords = raw.records as Record<string, unknown>;

        // 先整体校验（任何一条非法都不写，保证「要么整体成功、要么原状」）
        const builtByKey = new Map<string, CycleRecord>();
        for (const rawKey of Object.keys(rawRecords)) {
          const key = normalizeCycleName(rawKey);
          const existing = key ? getCycleRecord(key) : null;
          if (!key || !existing) return fail(`records["${rawKey}"]：该人物暂无周期记录，整体未写入。`);
          const built = buildRecordFromApi(rawRecords[rawKey], existing, today);
          if (!built.ok) return fail(`records["${rawKey}"]：${built.message}`);
          builtByKey.set(key, built.record);
        }
        const summaries: PendingCycleJumpSummary[] = Array.isArray(raw.pendingJumpSummaries)
          ? (raw.pendingJumpSummaries as unknown[]).flatMap(item => {
              if (!item || typeof item !== 'object') return [];
              const s = item as Record<string, unknown>;
              const name = String(s.name ?? '').trim().slice(0, 64);
              if (!name) return [];
              const pregnancyDelta = s.pregnancyDelta === 'conceived' || s.pregnancyDelta === 'progressed' || s.pregnancyDelta === 'delivered'
                ? s.pregnancyDelta : null;
              return [{
                name,
                gap: Math.max(0, Math.floor(Number(s.gap) || 0)),
                newPeriodStarts: Array.isArray(s.newPeriodStarts) ? s.newPeriodStarts.filter(isValidDateKey).slice(0, 24) : [],
                pregnancyDelta,
                newMilestones: Array.isArray(s.newMilestones) ? s.newMilestones.filter((m): m is string => typeof m === 'string').slice(0, 24) : [],
              }];
            })
          : getPendingCycleJumpSummaries();

        replaceAllCycleRecords(Object.fromEntries(builtByKey));
        setPendingCycleJumpSummaries(summaries);
        persistCycleStoreImmediate();
        handleCycleTick();
        refreshUiBestEffort();
        const anchor = getCurrentStoryChatKey();
        for (const key of builtByKey.keys()) {
          emitCycleApiEvent('cycle-state-changed', { name: keyToDisplayName(key), anchor });
        }
        return { ok: true };
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    // —— D. 孕育动作 ——
    async conceive(name: unknown, options?: unknown): Promise<ApiResult & { conceived?: boolean; pregnancy?: unknown }> {
      try {
        const method = (options as { method?: unknown } | undefined)?.method ?? 'unprotected';
        if (!VALID_SEX_FORMS.includes(String(method))) {
          return fail('method 须为 unprotected / withdrawal / condom 之一。');
        }
        return await conceiveForApi(String(name ?? ''), method as SexForm);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    async confirmPregnancy(name: unknown): Promise<ApiResult> {
      try {
        return await confirmPregnancyForApi(String(name ?? ''));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    async terminatePregnancy(name: unknown): Promise<ApiResult> {
      try {
        const result = await terminatePregnancy(String(name ?? ''));
        return { ok: result.ok, message: result.ok ? undefined : result.message };
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    async deliverPregnancy(_name: unknown, _options?: unknown): Promise<ApiResult> {
      try {
        // options（force/deliveryRoute/medicalProfile/birthContext）本引擎无对应模型，忽略；
        // 行为等价于「把该角色妊娠推进到产后并派发 delivery」，见实现说明文档。
        return await deliverPregnancyForApi(String(_name ?? ''));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    async cancelPregnancy(name: unknown): Promise<ApiResult> {
      try {
        // 追加批次 2：取消怀孕 / 撤回子嗣的母体侧——「当作没发生过」的干净回退，
        // 不进入恢复期；子嗣/血缘数据由调用方在自己存储里撤销。
        const result = await cancelPregnancyForApi(String(name ?? ''));
        if (!result.ok) return fail(result.message || '取消失败。');
        refreshUiBestEffort();
        return { ok: true };
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    // —— E. 决策队列（渲染接管） ——
    configure(options: unknown): ApiResult {
      try {
        if (!options || typeof options !== 'object') return fail('options 须为对象。');
        const rendering = (options as { decisionRendering?: unknown }).decisionRendering;
        if (rendering !== 'host' && rendering !== 'delegate') {
          return fail('decisionRendering 须为 host / delegate。');
        }
        setCycleDecisionDelegation(rendering === 'delegate');
        return { ok: true };
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    getPendingDecisions(): Array<Record<string, unknown>> {
      try {
        return safeClone(listExternalCycleDecisions());
      } catch (_e) {
        return [];
      }
    },

    async resolveDecision(key: unknown, result: unknown): Promise<ApiResult> {
      try {
        if (typeof key !== 'string' || !key) return fail('key 须为非空字符串。');
        return await resolveExternalCycleDecision(key, (result ?? {}) as { method?: unknown; confirm?: unknown; meta?: unknown });
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    dismissDecision(key: unknown): ApiResult {
      try {
        if (typeof key !== 'string' || !key) return fail('key 须为非空字符串。');
        return dismissExternalCycleDecision(key);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    // —— F. 世界书投影 / UI 刷新 ——
    refreshCycleWorldbook(): ApiResult {
      try {
        const storage = requireStorage();
        if (storage) return storage;
        handleCycleTick(); // 幂等：内部签名比对，只增删改两条带标记条目
        return { ok: true };
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    refreshUI(_reason?: unknown): ApiResult {
      try {
        return refreshUiBestEffort();
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    // —— G. 事件订阅 ——
    on(event: unknown, handler: unknown): (() => void) | null {
      try {
        if (typeof event !== 'string' || typeof handler !== 'function') return null;
        return subscribeCycleApiEvent(event, handler as CycleApiEventHandler);
      } catch (_e) {
        return null;
      }
    },

    off(event: unknown, handler?: unknown): void {
      try {
        if (typeof event !== 'string') return;
        unsubscribeCycleApiEvent(event, typeof handler === 'function' ? handler as CycleApiEventHandler : undefined);
      } catch (_e) {
        /* ignore */
      }
    },

    // —— H. 周期阶段 ——
    getCyclePhase(name: unknown): Record<string, unknown> | null {
      try {
        const rec = getCycleRecord(String(name ?? ''));
        if (!rec || rec.eligibilitySuspendedAt || isCyclePermanentlyExcluded(String(name ?? ''))) return null;
        const today = getTodayDateKey();
        if (!today) return null;
        const daysInto = computeDaysIntoCycle(today, rec.lastPeriodStart, rec.cycleLength);
        if (daysInto === null) return null;
        // 排卵日/易孕期与 classifyPhase 同一公式：排卵日=第 max(periodLength+1, cycleLength-14) 天，
        // 易孕窗=排卵日 ±2 天；日期换算按 1-based 天数（第 D 天 ↔ lmp + (D-1)）。
        const ovulationDay = Math.max(rec.periodLength + 1, rec.cycleLength - 14);
        return safeClone({
          phase: classifyPhase(daysInto, rec.cycleLength, rec.periodLength),
          daysIntoCycle: daysInto,
          isOnPeriod: rec.pregnancy ? false : daysInto <= rec.periodLength,
          predictedOvulationDay: computeDateKeyForOffset(rec.lastPeriodStart, ovulationDay - 1) || '',
          fertileWindowStart: computeDateKeyForOffset(rec.lastPeriodStart, ovulationDay - 3) || '',
          fertileWindowEnd: computeDateKeyForOffset(rec.lastPeriodStart, ovulationDay + 1) || '',
          nextPeriodDue: computeDateKeyForOffset(rec.lastPeriodStart, rec.cycleLength) || '',
        });
      } catch (_e) {
        return null;
      }
    },

    // —— I. 字段渲染注册器（规格 §I，L8 补全）——
    /** 注册/注销（renderer=null）某展示型字段的渲染器 (value, ctx) => html。字段白名单与
     *  语义见 core/cycle-field-renderer.ts；未注册字段的渲染完全走调用方默认（宿主零影响）。 */
    registerCycleFieldRenderer(field: unknown, renderer: unknown): ApiResult {
      try {
        if (renderer !== null && typeof renderer !== 'function') {
          return fail('renderer 须为 (value, ctx) => html 的函数；传 null 表示注销。');
        }
        const result = registerFieldRenderer(String(field ?? ''), renderer === null ? null : renderer as (v: unknown, c: unknown) => string);
        return result.ok ? { ok: true } : fail(result.message || '注册失败。');
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },

    /** 用已注册渲染器渲染某人物的某字段；未注册 → ok:true 且 html:null（调用方回退默认渲染）。
     *  值经 toApiCycleRecord 同源解析，并套玩家可见性掩码：孕情未经验孕确认（pregnancy.confirmed
     *  ≠ true）时以 null 交付渲染器——「未验孕隐藏孕情」由引擎语义保证，拓展方无须自行复刻。 */
    renderCycleField(name: unknown, field: unknown): ApiResult {
      try {
        const key = normalizeCycleName(name);
        const rec = key ? getCycleRecord(key) : null;
        if (!key || !rec) return fail('该人物暂无周期记录（记录由引擎为三表人物自动建立）。');
        const apiRecord = toApiCycleRecord(key, rec) as Record<string, unknown>;
        // 玩家可见性掩码：与渲染层同语义（pregnancy.confirmed === true 才对玩家可见）
        const preg = rec.pregnancy;
        if (!preg || preg.confirmed !== true) apiRecord.pregnancy = null;
        const fieldName = String(field ?? '');
        if (!(fieldName in apiRecord)) return fail(`字段 ${fieldName} 不在周期 API 记录中。`);
        const out = renderCycleFieldViaRegistry(fieldName, apiRecord[fieldName], {
          key,
          name: String(apiRecord.name ?? key),
          record: apiRecord,
        });
        if (out.error) return fail(`渲染失败：${out.error}`);
        // html=null = 该字段未注册渲染器（调用方回退默认渲染，非错误）
        return { ok: true, html: out.html } as ApiResult & { html: string | null };
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },
  };

  return api;
}

/** 事件 payload 里的 name 用显示名（找不到候选时回退键名）。 */
function keyToDisplayName(key: string): string {
  return listCycleActorsForApi().find(entry => entry.key === key)?.name ?? key;
}

function refreshUiBestEffort(): ApiResult {
  try {
    const refresh = (window as any).__ub_refreshBadges;
    if (typeof refresh === 'function') {
      refresh();
      return { ok: true };
    }
    return { ok: false, message: '状态栏渲染钩子尚未就绪（稍后的常规刷新会自动补上）。' };
  } catch (_e) {
    return { ok: false, message: '状态栏刷新失败（不影响数据，稍后的常规刷新会自动补上）。' };
  }
}

// ═══════════════════════════════════════════════════════════════
// 挂载：宿主窗口（window.parent）与 iframe window 各放同一对象引用
// ═══════════════════════════════════════════════════════════════

export function installCycleExternalApi(): void {
  if (typeof window === 'undefined') return;
  const api = createCycleApi();
  try { (window as any).__ubCycleAPI = api; } catch (_e) { /* ignore */ }
  try {
    if (window.parent && window.parent !== window) {
      (window.parent as any).__ubCycleAPI = api;
    }
  } catch (_e) {
    // 跨域访问 parent 会抛错：状态栏运行在同源 iframe，此分支仅作兜底
  }
}
