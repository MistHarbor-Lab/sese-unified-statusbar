import { formatDateKey } from './calendar-core';
// ===== 月信与孕育系统 · 个体周期分布（纯函数） =====
// 新人物初始化使用可注入随机源；后续周期波动使用角色指纹+经期开始日的确定性散列，
// 保证同一条记录重复渲染/重载时结果稳定，同时让不同人物、不同周期自然错开。

export type RandomSource = () => number;

const CYCLE_BASELINE_POOL = [
  24, 25, 26, 27,
  28, 28, 28, 28,
  29, 29, 29, 29,
  30, 30, 30, 30,
  31, 32, 33, 34, 35,
] as const;

// 5 天最常见，其次 6/7/8 天；所有新人物都严格落在用户指定的 5–8 天。
const PERIOD_LENGTH_POOL = [5, 5, 5, 5, 6, 6, 6, 7, 7, 8] as const;

// 围绕个人基准轻微变化：不变权重最高，±1 次之，±2 较少。
const CYCLE_JITTER_POOL = [0, 0, 0, -1, 1, -1, 1, -2, 2] as const;

function unitInterval(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1 - Number.EPSILON;
  return value;
}

function pickFromPool<T>(pool: readonly T[], random: RandomSource): T {
  const index = Math.floor(unitInterval(random()) * pool.length);
  return pool[index];
}

export function pickCycleBaseline(random: RandomSource = Math.random): number {
  return pickFromPool(CYCLE_BASELINE_POOL, random);
}

export function pickPeriodLength(random: RandomSource = Math.random): number {
  return pickFromPool(PERIOD_LENGTH_POOL, random);
}

/** 均匀返回 [1, cycleLength]；不会把周期第 1 天重复放进抽样空间。 */
export function pickInitialCycleDay(cycleLength: number, random: RandomSource = Math.random): number {
  const length = Math.max(1, Math.floor(cycleLength));
  return Math.floor(unitInterval(random()) * length) + 1;
}

function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** 同角色同开始日结果稳定；每轮围绕个人基准 ±2 天。 */
export function cycleLengthForStart(baseCycleLength: number, fingerprint: string, startDateKey: string): number {
  const baseline = Math.max(21, Math.min(45, Math.floor(baseCycleLength) || 29));
  const isNewRangeBaseline = baseline >= 24 && baseline <= 35;
  const minLength = isNewRangeBaseline ? 24 : 21;
  const maxLength = isNewRangeBaseline ? 35 : 45;
  const hash = hash32(`${fingerprint}|${startDateKey}|cycle-length-v1`);
  const jitter = CYCLE_JITTER_POOL[hash % CYCLE_JITTER_POOL.length];
  return Math.max(minLength, Math.min(maxLength, baseline + jitter));
}

export interface CycleScheduleInput {
  lastPeriodStart: string;
  today: string;
  cycleLength: number;
  baseCycleLength: number;
  fingerprint: string;
}

export interface CycleScheduleResult {
  lastPeriodStart: string;
  cycleLength: number;
  newPeriodStarts: string[];
}

// 负年份（公元前，如 -0044-03-15）与远未来五位纪年（如 14900-07-15）都与 calendar-core
// formatDateKey/formatYear 对齐（幅值 4-6 位）；拒绝会让 BC/长纪年剧本周期簿失效
const DATE_KEY_RE = /^(-?\d{4,6})-(\d{2})-(\d{2})$/;
const DAY_MS = 86400000;

function dateKeyToEpochDay(dateKey: string): number | null {
  const match = DATE_KEY_RE.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // 用 setUTCFullYear 绕过 Date.UTC 对 0-99 年按 1900+ 偏移的陷阱（虚构短年份如 21、1）
  const base = Date.UTC(2000, month - 1, day);
  const date = new Date(base);
  date.setUTCFullYear(year);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return Math.floor(date.getTime() / DAY_MS);
}

function epochDayToDateKey(epochDay: number): string {
  const date = new Date(epochDay * DAY_MS);
  // U32：拼装收编 formatDateKey（口径原本就一致：带符号年份 + 幅值至少 4 位补零）
  return formatDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * 按每轮实际周期长度推进到 today。只保留最近 12 个新开始日，和周期簿历史上限一致。
 * 该函数只在剧情日期变化时调用，不引入定时器或渲染期开销。
 */
export function advanceCycleSchedule(input: CycleScheduleInput): CycleScheduleResult {
  let startDay = dateKeyToEpochDay(input.lastPeriodStart);
  const todayDay = dateKeyToEpochDay(input.today);
  if (startDay === null || todayDay === null || todayDay <= startDay) {
    return {
      lastPeriodStart: input.lastPeriodStart,
      cycleLength: input.cycleLength,
      newPeriodStarts: [],
    };
  }

  let cycleLength = Math.max(21, Math.min(45, Math.floor(input.cycleLength) || 28));
  const newPeriodStarts: string[] = [];

  while (startDay + cycleLength <= todayDay) {
    startDay += cycleLength;
    const startDateKey = epochDayToDateKey(startDay);
    newPeriodStarts.push(startDateKey);
    if (newPeriodStarts.length > 12) newPeriodStarts.shift();
    cycleLength = cycleLengthForStart(input.baseCycleLength, input.fingerprint, startDateKey);
  }

  return {
    lastPeriodStart: epochDayToDateKey(startDay),
    cycleLength,
    newPeriodStarts,
  };
}
