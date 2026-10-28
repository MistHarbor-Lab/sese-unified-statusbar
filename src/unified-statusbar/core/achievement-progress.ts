// ===== 成就系统 · 进度可视化纯读 peek (§2.2) =====
// 与 EVALUATORS 同源但不共享会变异状态的路径：绝不调 advanceCounter/advanceChatCounter/
//   setSessionStartTs/bumpCounter/setIndividualBaselines/setStreak/bumpDailyCounter。
// 只读 getCounter/getLastSeen/getIndividualBaseline/getStreak/getDailyCounter/getSessionStartTs/
//   isUnlocked/getSheetByName/getCellByHeader/SNAPSHOT_GETTERS/calendar-core 日期纯函数。
// 进度只在面板打开时算（同步，§2.2 保险带 A），关闭=零开销。
// 真正解锁仍只由 scan 路径触发；本模块只算显示进度 + 日期类纯读命中判定（供 C2 开面板解锁）。

import { getSheetByName, getCellByHeader } from './data-manager';
import {
  getCounter, getLastSeen, getIndividualBaseline, getStreak, getDailyCounter, getWindowCounter,
  getSessionStartTs, isUnlocked,
} from './achievement-store';
import { getAchievements } from './achievement-catalog';
import {
  SNAPSHOT_GETTERS, toNum, rowCount, distinctCount, existsValue,
  ageRangeCount, crossTableNumeric, collectPresentValues,
} from './achievement-engine';
import { getTodayDateKey, dateInRange, monthDayOfDateKey, seasonOfMonthDay, weekdayOfDateKey, currentSeasonWindowId } from './calendar-core';
import { getRealClockParts, matchHourRange } from './real-clock';
import { computeTierSnapshot, tierThresholdPercent } from './achievement-tier';
import type {
  AchievementDef, Observe, CalendarEventObserve, DailyActionObserve, WindowActionObserve,
  MetaObserve, CompoundObserve, IndividualsDeltaObserve, SnapshotDeltaObserve,
  ChatSnapshotDeltaObserve, CounterStoreObserve, CounterRowsObserve, CollectionObserve,
  EnumStateObserve, AgeRangeRowsObserve, CrossTableNumericObserve, NumericThresholdObserve,
  NumericAnyRowObserve, StreakWindowObserve, SessionDurationObserve,
  CurrentValueObserve, RealClockObserve, TierAtLeastObserve,
} from './achievement-types';

export interface PeekResult { text: string; complete: boolean; }

/** 某表某列任一数据行数值的最大值（numeric-any-row peek 用，纯读）。 */
function maxRowNumeric(table: string, col: string): number {
  const sheet = getSheetByName(table);
  if (!sheet || !sheet.content) return 0;
  const headers = sheet.content[0];
  const idx = headers.indexOf(col);
  if (idx === -1) return 0;
  let max = 0;
  for (let i = 1; i < sheet.content.length; i++) {
    const v = toNum(sheet.content[i][idx]);
    if (v > max) max = v;
  }
  return max;
}

/** 格式化 x/y 进度文本（cur 截到 target，避免显示超过阈值）。 */
function fmt(cur: number, target: number): string {
  const c = target > 0 ? Math.min(cur, target) : 0;
  return c + '/' + target;
}

function cmpNum(v: number, op: string, value: number): boolean {
  switch (op) {
    case '>=': return v >= value;
    case '>':  return v > value;
    case '<=': return v <= value;
    case '<':  return v < value;
    default:   return v === value;
  }
}
function cmpRowCount(c: number, op: string | undefined, value: number): boolean {
  switch (op) {
    case '>':  return c > value;
    case '<=': return c <= value;
    case '<':  return c < value;
    case '==': return c === value;
    default:   return c >= value; // 缺省 '>='，与 evaluator 向后兼容
  }
}

/** 判断 observe 是否含日期类子条件（calendar-event / daily-action，compound 递归）。 */
export function hasDateCondition(o: Observe): boolean {
  if (o.type === 'calendar-event' || o.type === 'daily-action') return true;
  if (o.type === 'compound') {
    const c = o as CompoundObserve;
    return c.conditions.some(sub => hasDateCondition(sub));
  }
  return false;
}

/**
 * 判断 observe 是否含「时间类条件」（第九轮 F33 扩展）：条件的真假会随时间/日期推移而改变，
 * 但**不靠写表或事件推进** —— 因此常出现「面板里已经达成、却还锁着」的陈旧态（扫描只由
 * 表格更新/事件驱动）。开面板时的补解锁（C2）收集范围以本函数为准，覆盖：
 *   calendar-event（日期/节日/周几/季节）、daily-action（当天计数）、window-action（季节窗口计数）、
 *   real-clock（现实时段）、session-duration（连续游玩时长）、streak-window（连击时间窗）。
 * 注：hasDateCondition 是第一版（仅日期两型）的收窄版，保留原语义供外部兼容，勿再用于新调用点。
 */
export function hasTimingCondition(o: Observe): boolean {
  switch (o.type) {
    case 'calendar-event':
    case 'daily-action':
    case 'window-action':
    case 'real-clock':
    case 'session-duration':
    case 'streak-window':
      return true;
    case 'compound':
      return (o as CompoundObserve).conditions.some(sub => hasTimingCondition(sub));
    default:
      return false;
  }
}

/** 纯读判定 calendar-event 是否命中当前游戏内日期（与 Task1 evaluator 同源）。 */
function peekCalendarEvent(o: CalendarEventObserve): boolean {
  const todayKey = getTodayDateKey();
  if (!todayKey) return false;
  const todayMd = monthDayOfDateKey(todayKey); // F3：负年份安全，不 slice(5)
  if (!todayMd) return false;
  switch (o.match) {
    case 'date':        return todayMd === o.date;
    case 'anniversary': return todayMd === o.anniversary;
    case 'range':       return o.range ? dateInRange(todayMd, o.range) : false;
    case 'season':      return seasonOfMonthDay(todayMd) === o.season;
    case 'weekday':     return o.weekday ? o.weekday.includes(weekdayOfDateKey(todayKey)) : false;
  }
  return false;
}

/** 纯读 peek 核心：返回显示文本 + 当前条件是否满足（无副作用）。 */
function peekObserve(o: Observe): PeekResult {
  switch (o.type) {
    case 'numeric-threshold': {
      const n = o as NumericThresholdObserve;
      const v = toNum(getCellByHeader(n.table, n.row, n.col));
      return { text: fmt(v, n.value), complete: cmpNum(v, n.op, n.value) };
    }
    case 'numeric-any-row': {
      const n = o as NumericAnyRowObserve;
      const mx = maxRowNumeric(n.table, n.col);
      return { text: fmt(mx, n.value), complete: cmpNum(mx, n.op, n.value) };
    }
    case 'counter-rows': {
      const n = o as CounterRowsObserve;
      const c = rowCount(n.table, n.filter);
      return { text: fmt(c, n.value), complete: cmpRowCount(c, n.op, n.value) };
    }
    case 'collection': {
      const n = o as CollectionObserve;
      const d = distinctCount(n.table, n.col);
      return { text: fmt(d, n.value), complete: d >= n.value };
    }
    case 'enum-state': {
      const n = o as EnumStateObserve;
      const hit = existsValue(n.table, n.col, n.value);
      return { text: hit ? '1/1' : '0/1', complete: hit }; // 二态显示
    }
    case 'age-range-rows': {
      const n = o as AgeRangeRowsObserve;
      const c = ageRangeCount(n.table, n.col, n.min, n.max);
      return { text: fmt(c, n.value), complete: c >= n.value };
    }
    case 'cross-table-numeric': {
      const n = o as CrossTableNumericObserve;
      const c = crossTableNumeric(n);
      return { text: fmt(c, n.value), complete: c >= n.value };
    }
    case 'counter-store': {
      const n = o as CounterStoreObserve;
      const c = getCounter(n.counter);
      return { text: fmt(c, n.value), complete: c >= n.value };
    }
    case 'snapshot-delta': {
      const n = o as SnapshotDeltaObserve;
      const getter = SNAPSHOT_GETTERS[n.getter];
      const cur = typeof getter === 'function' ? getter() : 0;
      // peek：已累计 + 当前未累计增量，不调 advanceCounter（不吞下次 scan 增量、不刷 lastSeen）
      const acc = getCounter(n.counter) + Math.max(0, cur - getLastSeen(n.counter));
      return { text: fmt(acc, n.value), complete: acc >= n.value };
    }
    case 'chat-snapshot-delta': {
      const n = o as ChatSnapshotDeltaObserve;
      // peek：只读已累计全局 counter，不调 advanceChatCounter（不刷对话基线）
      const acc = getCounter(n.counter);
      return { text: fmt(acc, n.value), complete: acc >= n.value };
    }
    case 'individuals-delta': {
      const n = o as IndividualsDeltaObserve;
      // peek：只读 collectPresentValues + getIndividualBaseline，数增长个体，不调 setIndividualBaselines（不刷基线）
      const present = collectPresentValues(n.presenceTable, n.presenceNameCol, n.numTable, n.nameCol, n.numCol);
      const keys = Object.keys(present);
      if (keys.length < n.presenceMin) return { text: '0/1', complete: false };
      let increased = 0;
      for (const name of keys) {
        const cur = present[name];
        const last = getIndividualBaseline(n.counter, name);
        if (last != null && cur - last >= n.minDelta) increased++;
      }
      const met = increased >= n.minIncreased;
      // 防剧透：二态不显具体增长个体数
      return { text: met ? '1/1' : '0/1', complete: met };
    }
    case 'feature-event': {
      // feature-event 不在常规 scan evaluate（恒 false），由 consumePending 处理。
      // peek 也返回 false，显示「等待触发」。complete=false → C2 不解锁 feature-event。
      return { text: '等待触发', complete: false };
    }
    case 'streak-window': {
      const n = o as StreakWindowObserve;
      const st = getStreak(n.event);
      if (!st) return { text: '0/' + n.value + ' · 待触发', complete: false };
      const now = Date.now();
      const within = (now - st.lastTs) <= n.window;
      const count = within ? st.count : 0;
      const met = within && count >= n.value;
      return { text: count + '/' + n.value + ' · ' + (within ? '窗口内' : '超窗'), complete: met };
    }
    case 'session-duration': {
      const n = o as SessionDurationObserve;
      // peek：只读 getSessionStartTs + Date.now()，不调 setSessionStartTs（不种首扫时间戳）
      const start = getSessionStartTs();
      const now = Date.now();
      const elapsed = start > 0 ? (now - start) / 60000 : 0;
      const e = Math.floor(elapsed);
      return { text: fmt(e, n.minutes), complete: elapsed >= n.minutes };
    }
    case 'meta': {
      const n = o as MetaObserve;
      let total = 0, sat = 0;
      if (n.depIds && n.depIds.length) {
        total += n.depIds.length;
        for (const id of n.depIds) if (isUnlocked(id)) sat++;
      }
      if (n.matchCat) {
        const sameCat = getAchievements().filter(a => a.cat === n.matchCat && !a.hidden && !a.id.startsWith('_'));
        total += sameCat.length;
        for (const a of sameCat) if (isUnlocked(a.id)) sat++;
      }
      // 粗粒度 A：已满足子条件数 / 总数（不展开哪些满足）
      const complete = total === 0 || sat === total;
      return { text: total > 0 ? sat + '/' + total : '0/0', complete };
    }
    case 'compound': {
      const n = o as CompoundObserve;
      // 粗粒度 A：逐子条件 peekEvaluate 计数
      const total = n.conditions.length;
      let sat = 0;
      for (const c of n.conditions) if (peekObserve(c).complete) sat++;
      return { text: total > 0 ? sat + '/' + total : '0/0', complete: total === 0 || sat === total };
    }
    case 'calendar-event': {
      const n = o as CalendarEventObserve;
      const hit = peekCalendarEvent(n);
      return { text: hit ? '1/1' : '0/1', complete: hit }; // 二态
    }
    case 'daily-action': {
      const n = o as DailyActionObserve;
      const today = getTodayDateKey();
      if (!today) return { text: '0/' + (n.value ?? 1), complete: false };
      const slot = getDailyCounter(n.action);
      const count = slot && slot.date === today ? slot.count : 0;
      const target = n.value ?? 1;
      return { text: fmt(count, target), complete: count >= target };
    }
    case 'window-action': {
      // 第九轮 F33：补上季节窗口进度（此前落 default 空文本 ⇒ 面板只显示「未解锁」）。
      // 口径与 engine 的 window-action 求值一致：窗口 id 与当前季节不符 ⇒ 本季计 0（换季归零语义）。
      const n = o as WindowActionObserve;
      const slot = getWindowCounter(n.action);
      const wid = currentSeasonWindowId();
      const count = slot && wid && slot.windowId === wid ? slot.count : 0;
      return { text: fmt(count, n.value) + ' · 本季', complete: count >= n.value };
    }
    case 'real-clock': {
      // 第九轮 L10：显示「此刻 HH:MM」（她盯着你的钟）；周几不符时给出提示。
      const n = o as RealClockObserve;
      const c = getRealClockParts();
      const weekdayHit = !n.weekday || n.weekday.length === 0 || n.weekday.includes(c.weekday);
      const hit = weekdayHit && matchHourRange(c.hour, n.from, n.to);
      if (hit) return { text: '1/1', complete: true };
      return { text: '此刻 ' + c.hhmm + (weekdayHit ? '' : ' · 不在限定日'), complete: false };
    }
    case 'tier-at-least': {
      // 第九轮 L12：段位勋章进度（收藏度 % / 门槛 %）。与统计条同源（computeTierSnapshot）。
      const n = o as TierAtLeastObserve;
      const snap = computeTierSnapshot();
      const cur = Math.round(snap.completion * 100);
      const target = tierThresholdPercent(n.tier);
      return { text: cur + '% / ' + target + '%', complete: snap.tier + 1 >= n.tier };
    }
    case 'current-value': {
      const n = o as CurrentValueObserve;
      const getter = SNAPSHOT_GETTERS[n.getter];
      const cur = typeof getter === 'function' ? getter() : 0;
      return { text: fmt(cur, n.value), complete: cur >= n.value };
    }
    default:
      return { text: '', complete: false };
  }
}

/** 进度可视化（未解锁卡显示用）。隐藏成就由调用方不调用本函数处理（防剧透）。 */
export function peekProgress(def: AchievementDef): PeekResult {
  try {
    return peekObserve(def.observe);
  } catch (e) {
    return { text: '', complete: false };
  }
}
