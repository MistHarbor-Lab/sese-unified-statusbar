// ===== 日历主题化渲染 + SVG 天气图标 =====
import { ubIcon, type IconName } from '../core/icons';
import { escapeAttr, escapeHtml } from '../core/html-escape';
import type { StyleType, WeatherCategory } from '../core/constants';
import type { CalendarCell, CalendarEvent, CalendarEventType } from '../core/calendar-core';
import type { CycleDayMark, CycleDayMarkKind } from '../core/cycle-engine';
import type { BirthdayDayMark } from '../core/birthday';

// ═══════════════════════════════════════════════════════════════
// 主题 CSS 类名
// ═══════════════════════════════════════════════════════════════

export function getCalendarThemeClass(style: StyleType): string {
  return 'cal-theme-' + style;
}

// ═══════════════════════════════════════════════════════════════
// SVG 天气图标（9 种 × 内联动画）
// ═══════════════════════════════════════════════════════════════

export function getWeatherSvg(category: WeatherCategory, size: number = 20): string {
  switch (category) {
    case '晴': return svgSunny(size);
    case '多云': return svgCloudy(size);
    case '阴': return svgOvercast(size);
    case '雨': return svgRain(size);
    case '雪': return svgSnow(size);
    case '雾': return svgFog(size);
    case '沙尘': return svgDust(size);
    case '冰雹': return svgHail(size);
    case '台风': return svgTyphoon(size);
    default: return '';
  }
}

// ─── 晴：太阳旋转 + 光晕 ───
function svgSunny(s: number): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<style>@keyframes sun-spin{to{transform:rotate(360deg)}}@keyframes sun-pulse{50%{opacity:.6}} .sun-core{animation:sun-spin 12s linear infinite;transform-origin:center} .sun-glow{animation:sun-pulse 2s ease-in-out infinite}</style>
<circle cx="12" cy="12" r="5" fill="#FBBF24" class="sun-core"/>
<g class="sun-glow"><line x1="12" y1="1" x2="12" y2="4" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="20" x2="12" y2="23" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"/><line x1="1" y1="12" x2="4" y2="12" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"/><line x1="20" y1="12" x2="23" y2="12" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"/><line x1="4.2" y1="4.2" x2="6.3" y2="6.3" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"/><line x1="17.7" y1="17.7" x2="19.8" y2="19.8" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"/><line x1="4.2" y1="19.8" x2="6.3" y2="17.7" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"/><line x1="17.7" y1="6.3" x2="19.8" y2="4.2" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"/></g></svg>`;
}

// ─── 多云：云层漂移 + 太阳 ───
function svgCloudy(s: number): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<style>@keyframes cloud-drift{50%{transform:translateX(2px)}} .cloud-body{animation:cloud-drift 3s ease-in-out infinite}</style>
<circle cx="9" cy="9" r="3.5" fill="#FBBF24" opacity=".8"/>
<g class="cloud-body"><ellipse cx="14" cy="14" rx="5.5" ry="3.5" fill="#94A3B8"/><ellipse cx="11" cy="13" rx="3.5" ry="2.5" fill="#CBD5E1"/><ellipse cx="16" cy="13" rx="3" ry="2" fill="#CBD5E1"/></g></svg>`;
}

// ─── 阴：多云层叠加 ───
function svgOvercast(s: number): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<style>@keyframes overcast-move{50%{transform:translateX(3px)}} .oc1{animation:overcast-move 4s ease-in-out infinite} .oc2{animation:overcast-move 5s ease-in-out infinite reverse}</style>
<ellipse cx="11" cy="9" rx="6" ry="3.5" fill="#64748B" opacity=".7" class="oc1"/>
<ellipse cx="14" cy="13" rx="7" ry="4" fill="#475569" opacity=".85"/>
<ellipse cx="10" cy="14" rx="5" ry="3" fill="#334155" class="oc2"/></svg>`;
}

// ─── 雨：三条雨滴下落 ───
function svgRain(s: number): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<style>@keyframes rain-drop{0%{transform:translateY(-8px);opacity:0}20%{opacity:1}100%{transform:translateY(8px);opacity:0}} .rd1{animation:rain-drop 1.2s ease-in infinite} .rd2{animation:rain-drop 1.2s ease-in .4s infinite} .rd3{animation:rain-drop 1.2s ease-in .8s infinite}</style>
<ellipse cx="12" cy="10" rx="7" ry="4" fill="#64748B" opacity=".6"/>
<ellipse cx="12" cy="13" rx="6" ry="3" fill="#475569" opacity=".75"/>
<line x1="8" y1="14" x2="6.5" y2="20" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round" class="rd1"/>
<line x1="12" y1="14" x2="10.5" y2="20" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round" class="rd2"/>
<line x1="16" y1="14" x2="14.5" y2="20" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round" class="rd3"/></svg>`;
}

// ─── 雪：雪花摇摆下落 ───
function svgSnow(s: number): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<style>@keyframes snow-fall{0%{transform:translateY(-6px) rotate(0deg);opacity:0}20%{opacity:1}100%{transform:translateY(6px) rotate(180deg);opacity:0}} .sf1{animation:snow-fall 2s ease-in infinite} .sf2{animation:snow-fall 2s ease-in .7s infinite} .sf3{animation:snow-fall 2s ease-in 1.4s infinite}</style>
<ellipse cx="12" cy="10" rx="7" ry="4" fill="#64748B" opacity=".5"/>
<ellipse cx="12" cy="13" rx="6" ry="3" fill="#475569" opacity=".7"/>
<text x="7" y="21" font-size="6" fill="#E2E8F0" class="sf1">❄</text>
<text x="11.5" y="21" font-size="5" fill="#E2E8F0" class="sf2">❄</text>
<text x="16" y="21" font-size="6" fill="#E2E8F0" class="sf3">❄</text></svg>`;
}

// ─── 雾：多层波纹 ───
function svgFog(s: number): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<style>@keyframes fog-wave{50%{opacity:.3}} .fw1{animation:fog-wave 2s ease-in-out infinite} .fw2{animation:fog-wave 2.5s ease-in-out .5s infinite} .fw3{animation:fog-wave 3s ease-in-out 1s infinite}</style>
<line x1="4" y1="8" x2="20" y2="8" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round" class="fw1" opacity=".5"/>
<line x1="6" y1="12" x2="18" y2="12" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" class="fw2" opacity=".6"/>
<line x1="5" y1="16" x2="19" y2="16" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round" class="fw3" opacity=".5"/></svg>`;
}

// ─── 沙尘：粒子飘散 ───
function svgDust(s: number): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<style>@keyframes dust-1{50%{transform:translate(3px,-2px);opacity:.4}}@keyframes dust-2{50%{transform:translate(-2px,3px);opacity:.3}} .ds1{animation:dust-1 1.5s ease-in-out infinite} .ds2{animation:dust-2 2s ease-in-out .5s infinite}</style>
<circle cx="12" cy="12" r="4" fill="#D4A574" opacity=".3"/>
<circle cx="6" cy="10" r="1.5" fill="#C4956A" class="ds1"/>
<circle cx="14" cy="7" r="1" fill="#C4956A" class="ds2"/>
<circle cx="18" cy="13" r="1.5" fill="#C4956A" class="ds1"/>
<circle cx="9" cy="16" r="1" fill="#C4956A" class="ds2"/></svg>`;
}

// ─── 冰雹：小圆点下落弹跳 ───
function svgHail(s: number): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<style>@keyframes hail-bounce{0%{transform:translateY(-6px);opacity:0}30%{transform:translateY(0);opacity:1}60%{transform:translateY(-2px)}100%{transform:translateY(6px);opacity:0}} .hb1{animation:hail-bounce 1s ease-in infinite} .hb2{animation:hail-bounce 1s ease-in .35s infinite} .hb3{animation:hail-bounce 1s ease-in .7s infinite}</style>
<ellipse cx="12" cy="10" rx="7" ry="4" fill="#64748B" opacity=".55"/>
<ellipse cx="12" cy="13" rx="6" ry="3" fill="#475569" opacity=".7"/>
<circle cx="7" cy="17" r="2" fill="#E2E8F0" class="hb1"/>
<circle cx="12" cy="17" r="2.5" fill="#E2E8F0" class="hb2"/>
<circle cx="17" cy="17" r="2" fill="#E2E8F0" class="hb3"/></svg>`;
}

// ─── 台风：螺旋线旋转 ───
function svgTyphoon(s: number): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<style>@keyframes typhoon-spin{to{transform:rotate(360deg)}} .ty-spin{animation:typhoon-spin 3s linear infinite;transform-origin:12px 12px}</style>
<g class="ty-spin"><path d="M12 4 Q18 8 18 14 Q18 20 12 20 Q6 20 6 14 Q6 8 12 8" stroke="#64748B" stroke-width="1.5" fill="none" opacity=".7"/><path d="M12 7 Q15 10 15 14 Q15 17 12 17" stroke="#94A3B8" stroke-width="1.5" fill="none" opacity=".5"/></g></svg>`;
}

// ═══════════════════════════════════════════════════════════════
// 经期事件项主题化文案（日历详情卡片专用，与 cycle-ui.ts 进度条文案语义不同）
// ═══════════════════════════════════════════════════════════════

const CYCLE_MARK_TITLE: Record<StyleType, Record<CycleDayMarkKind, string>> = {
  ancient: {
    'past-period': '月信', 'predicted-period': '将临月信',
    'pregnancy-early': '初有喜', 'pregnancy-middle': '胎息渐稳', 'pregnancy-late': '临盆将近', 'due-date': '预产之日',
  },
  flirtatious: {
    'past-period': '那几天', 'predicted-period': '将临那几天',
    'pregnancy-early': '有了', 'pregnancy-middle': '胎动期', 'pregnancy-late': '待产期', 'due-date': '预产日',
  },
  minimal: {
    'past-period': '经期', 'predicted-period': '预测经期',
    'pregnancy-early': '孕早期起点', 'pregnancy-middle': '孕中期起点', 'pregnancy-late': '孕晚期起点', 'due-date': '预产期',
  },
  sweet: {
    'past-period': '小红的日子', 'predicted-period': '将临小红',
    'pregnancy-early': '小生命萌芽', 'pregnancy-middle': '胎动时光', 'pregnancy-late': '等待见面', 'due-date': '见面日',
  },
  xianxia: {
    'past-period': '红尘劫', 'predicted-period': '桃花期',
    'pregnancy-early': '仙胎初结', 'pregnancy-middle': '胎息渐成', 'pregnancy-late': '灵胎将临', 'due-date': '降生之期',
  },
  bridge: {
    'past-period': '周期记录', 'predicted-period': '周期预测',
    'pregnancy-early': '孕程初段', 'pregnancy-middle': '孕程中段', 'pregnancy-late': '孕程后段', 'due-date': '预产节点',
  },
  ios: {
    'past-period': '经期', 'predicted-period': '预测经期',
    'pregnancy-early': '孕早期起点', 'pregnancy-middle': '孕中期起点', 'pregnancy-late': '孕晚期起点', 'due-date': '预产期',
  },
};

const PREGNANCY_MARK_KINDS: readonly CycleDayMarkKind[] = [
  'pregnancy-early', 'pregnancy-middle', 'pregnancy-late', 'due-date',
];

function isPregnancyMarkKind(kind: CycleDayMarkKind): boolean {
  return PREGNANCY_MARK_KINDS.includes(kind);
}

/** 将 YYYY-MM-DD 格式化为「M月D日」（中文友好，不显示年份；负年份亦解析）。 */
function formatMonthDay(dateKey: string): string {
  const m = dateKey.match(/^(-?\d{1,6})-(\d{1,2})-(\d{1,2})/);
  if (!m) return dateKey;
  return `${parseInt(m[2], 10)}月${parseInt(m[3], 10)}日`;
}

/** F77：周期/孕期条目描述 → 结构化片段（数字 tabular + 天数芯片）。
 *  输出为受信 HTML：骨架是本函数字面量，动态值（天数/日期）逐个 escapeHtml。 */
function cycleMarkDescHtml(mark: CycleDayMark, dateKey: string): string {
  const num = (n: number | string) => `<b class="num">${escapeHtml(String(n))}</b>`;
  if (mark.kind === 'past-period') {
    const day = mark.dayOfPeriod ?? 1;
    const total = mark.periodLength ?? 0;
    const pct = total > 0 ? Math.min(100, Math.max(6, Math.round((day / total) * 100))) : 0;
    return `<span class="cal-cyc-chip">第${num(day)}天<i>/共${num(total)}天</i><span class="cal-cyc-bar"><i style="width:${pct}%"></i></span></span>`
      + `<span class="cal-cyc-chip plain">周期${num(mark.cycleLength)}天</span>`;
  }
  if (mark.kind === 'predicted-period') {
    const days = mark.daysUntil ?? 0;
    return `<span class="cal-cyc-chip due${days >= 0 && days <= 3 ? ' hot' : ''}">距今约${num(days)}天</span>`
      + `<span class="cal-cyc-chip plain">周期${num(mark.cycleLength)}天</span>`
      + `<span class="cal-cyc-chip dim">末次${escapeHtml(formatMonthDay(mark.lastPeriodStart))}</span>`;
  }
  if (mark.kind === 'due-date') {
    const days = mark.daysUntil ?? 0;
    const dueText = days > 0 ? `距分娩${num(days)}天` : days === 0 ? '今日预产期' : `已过预产期${num(-days)}天`;
    return `<span class="cal-cyc-chip dim">预产${escapeHtml(formatMonthDay(dateKey))}</span>`
      + `<span class="cal-cyc-chip due${days >= 0 && days <= 3 ? ' hot' : ''}">${dueText}</span>`;
  }
  const week = mark.stageWeek ?? (mark.kind === 'pregnancy-middle' ? 13 : mark.kind === 'pregnancy-late' ? 28 : 1);
  const due = mark.expectedDueDate ? `<span class="cal-cyc-chip dim">预产${escapeHtml(formatMonthDay(mark.expectedDueDate))}</span>` : '';
  return `<span class="cal-cyc-chip plain">孕第${num(week)}周阶段起点</span><span class="cal-cyc-chip dim">${escapeHtml(formatMonthDay(dateKey))}</span>${due}`;
}

// ═══════════════════════════════════════════════════════════════
// 主题化日历格子 HTML
// ═══════════════════════════════════════════════════════════════

export function buildCalendarCellHTML(
  cell: CalendarCell,
  style: StyleType,
  cycleMarks: CycleDayMark[] = [],
  birthdayMarks: BirthdayDayMark[] = [],
): string {
  const classes: string[] = ['cal-day'];
  if (cell.isCurrentMonth) classes.push('is-current-month');
  if (!cell.isCurrentMonth) classes.push('is-outside-month');
  if (cell.isToday) classes.push('is-today');
  if (cell.isSelected) classes.push('is-selected');
  if (cell.hasContent) classes.push('has-content');

  let dotsHtml = '';
  if (cell.events.length > 0) {
    const types = new Set(cell.events.map(e => e.type));
    dotsHtml = '<span class="cal-dots">' +
      Array.from(types).map(t => `<span class="cal-dot ${t}"></span>`).join('') +
      '</span>';
  }

  let memoTags = '';
  const memos = cell.events.filter(e => e.type === 'memo').slice(0, 2);
  if (memos.length > 0) {
    memoTags = memos.map(m => `<span class="cal-memo-tag">${escapeHtml(m.title.slice(0, 4))}</span>`).join('');
  }

  // 同日允许一个孕期族代表标记（右上）+ 一个经期族代表标记（右下）；详情保留全部 mark。
  const pregnancyMarks = cycleMarks.filter(mark => isPregnancyMarkKind(mark.kind));
  const periodMarks = cycleMarks.filter(mark => !isPregnancyMarkKind(mark.kind));
  let cycleMarkHtml = '';

  const pregnancyPriority: CycleDayMarkKind[] = ['due-date', 'pregnancy-late', 'pregnancy-middle', 'pregnancy-early'];
  const chosenPregnancy = pregnancyPriority.find(kind => pregnancyMarks.some(mark => mark.kind === kind));
  if (chosenPregnancy) {
    cycleMarkHtml += `<span class="cal-cycle-mark cal-cycle-pregnancy-family cal-cycle-${chosenPregnancy} ${chosenPregnancy === 'due-date' ? 'cal-cycle-due' : 'cal-cycle-stage'}" title="${escapeAttr(cycleMarkTitle(chosenPregnancy, pregnancyMarks))}">${cycleMarkEmoji(chosenPregnancy, style)}</span>`;
  }

  const chosenPeriod: CycleDayMarkKind | null = periodMarks.some(mark => mark.kind === 'predicted-period')
    ? 'predicted-period'
    : periodMarks.some(mark => mark.kind === 'past-period') ? 'past-period' : null;
  if (chosenPeriod) {
    const visualKind = chosenPeriod === 'past-period' ? 'past' : 'predicted';
    cycleMarkHtml += `<span class="cal-cycle-mark cal-cycle-period-family cal-cycle-${chosenPeriod} cal-cycle-${visualKind}" title="${escapeAttr(cycleMarkTitle(chosenPeriod, periodMarks))}">${cycleMarkEmoji(chosenPeriod, style)}</span>`;
  }

  // 生日蛋糕标注（左下角，独立于经期/孕期族：周期系统关闭时仍显示）
  if (birthdayMarks.length > 0) {
    const uniqueNames = Array.from(new Set(birthdayMarks.map(mark => mark.charName)));
    const names = uniqueNames.slice(0, 5);
    const etc = uniqueNames.length > names.length ? ' 等' : '';
    cycleMarkHtml += `<span class="cal-birthday-mark" title="${escapeAttr(`生日：${names.join('、')}${etc}`)}">${ubIcon('cake')}</span>`;
  }

  return `<button class="${classes.join(' ')}" data-cal-key="${cell.key}" type="button">${cell.day}${dotsHtml}${memoTags}${cycleMarkHtml}</button>`;
}

function cycleMarkEmoji(kind: CycleDayMarkKind, _style: StyleType): string {
  if (kind === 'pregnancy-early') return ubIcon('sprout');
  if (kind === 'pregnancy-middle') return ubIcon('flower');
  if (kind === 'pregnancy-late') return ubIcon('belly');
  if (kind === 'due-date') return ubIcon('baby');
  // 经期族统一圆点字形（过往 ● / 预测 ○）；颜色由各主题 accent 经 cycle-base.ts 着色，故不再按主题分支
  if (kind === 'past-period') return '●';
  return '○'; // predicted-period
}

function cycleMarkTitle(kind: CycleDayMarkKind, marks: CycleDayMark[]): string {
  const names = Array.from(new Set(marks.map(mark => mark.charName))).slice(0, 5);
  const label = isPregnancyMarkKind(kind)
    ? CYCLE_MARK_TITLE.minimal[kind]
    : kind === 'predicted-period' ? '预测经期' : '过往经期';
  const etc = names.length < marks.length ? ' 等' : '';
  return `${label}：${names.join('、')}${etc}`;
}
// ═══════════════════════════════════════════════════════════════
// 主题化详情卡片 HTML
// ═══════════════════════════════════════════════════════════════

export function buildDetailCardHTML(
  dateKey: string,
  events: CalendarEvent[],
  weatherDesc: string,
  style: StyleType,
  cycleMarks: CycleDayMark[] = [],
  chronicleCount = 0,
  birthdayMarks: BirthdayDayMark[] = [],
): string {
  let html = '<div class="cal-detail-header">';
  html += `<span class="cal-detail-date">${dateKey}</span>`;
  if (weatherDesc) {
    html += `<span class="cal-detail-weather">${escapeHtml(weatherDesc)}</span>`;
  }
  html += '</div>';

  const cycleOrder: Record<CycleDayMarkKind, number> = {
    'due-date': 0,
    'pregnancy-late': 1,
    'pregnancy-middle': 2,
    'pregnancy-early': 3,
    'predicted-period': 4,
    'past-period': 5,
  };
  const sortedMarks = cycleMarks.slice().sort((a, b) => cycleOrder[a.kind] - cycleOrder[b.kind]);

  if (events.length === 0 && sortedMarks.length === 0 && birthdayMarks.length === 0) {
    html += '<div class="cal-detail-empty">该日暂无事件</div>';
  } else {
    html += '<div class="cal-detail-events">';
    for (const ev of events) {
      html += '<div class="cal-detail-event">';
      const isMemo = ev.type === 'memo';
      const actionsHtml = isMemo
        ? ''
        : `<span class="cal-ev-actions">` +
          `<button class="cal-ev-edit" data-cal-edit="${ev.id}" type="button" title="编辑">${ubIcon('pencil')}</button>` +
          `<button class="cal-ev-del" data-cal-del="${ev.id}" type="button" title="删除">${ubIcon('trash')}</button>` +
          `</span>`;
      html += `<div class="cal-detail-event-title"><span class="cal-detail-event-type ${ev.type}">${eventTypeLabel(ev.type)}</span><span class="cal-detail-event-title-text">${escapeHtml(ev.title)}</span>${actionsHtml}</div>`;
      if (ev.description) html += `<div class="cal-detail-event-desc">${escapeHtml(ev.description)}</div>`;
      const metaChips: Array<[IconName, string]> = [];
      if (ev.location) metaChips.push(['pin', ev.location]);
      if (ev.character) metaChips.push(['user', ev.character]);
      if (ev.participants) metaChips.push(['clover', ev.participants]);
      if (ev.startTime) metaChips.push(['clock', ev.startTime + (ev.endTime ? '~' + ev.endTime : '')]);
      if (ev.status) metaChips.push(['flag', ev.status]);
      if (ev.result) metaChips.push(['check', ev.result]);
      if (metaChips.length > 0) html += `<div class="cal-detail-event-meta cal-meta-chips">${metaChips.map(([icon, text]) => `<span class="cal-ev-chip">${ubIcon(icon)}${escapeHtml(text)}</span>`).join('')}</div>`;
      html += '</div>';
    }
    // 每个角色/标记独立一条；孕期阶段与格子图标共用同一份 sortedMarks。
    for (const mark of sortedMarks) {
      const title = CYCLE_MARK_TITLE[style][mark.kind];
      const desc = cycleMarkDescHtml(mark, dateKey);
      const pregnancyMark = isPregnancyMarkKind(mark.kind);
      const familyClass = pregnancyMark ? 'cal-detail-pregnancy' : 'cal-detail-cycle';
      html += `<div class="cal-detail-event ${familyClass} cal-cycle-${mark.kind}">`;
      if (pregnancyMark) {
        html += `<div class="cal-detail-event-title"><span class="cal-detail-event-type pregnancy">孕期</span>${escapeHtml(mark.charName)} · ${escapeHtml(title)}</div>`;
      } else {
        html += `<div class="cal-detail-event-title"><span class="cal-detail-event-type cycle">经期</span>${escapeHtml(mark.charName)} · ${escapeHtml(title)}</div>`;
      }
      html += `<div class="cal-detail-event-desc cal-cyc-desc">${desc}</div>`;
      html += '</div>';
    }
    // 人物生日（恋爱对象表/重要角色表「生日」列）：蛋糕标记对应的独立条目
    for (const mark of birthdayMarks) {
      const ageText = mark.ageAt == null ? '' : ` · 满${mark.ageAt}岁生日`;
      html += `<div class="cal-detail-event cal-detail-birthday"><div class="cal-detail-event-title"><span class="cal-detail-event-type birthday">生日</span>${escapeHtml(mark.charName)}${escapeHtml(ageText)}</div></div>`;
    }
    html += '</div>';
  }

  // 新增事件入口：选中某天时始终显示（即便该日只有 memo 或为空），memo 不可编辑故单独入口
  if (dateKey) {
    if (chronicleCount > 0) {
      html += `<button class="cal-chronicle-btn" data-cal-chronicle-date="${dateKey}" type="button">查看当日剧情回顾（${chronicleCount}）</button>`;
    }
    html += `<button class="cal-add-btn" data-cal-add="1" type="button">＋ 新增事件</button>`;
  }

  return html;
}

function eventTypeLabel(type: string): string {
  switch (type) {
    case 'world': return '世界';
    case 'major': return '大型';
    case 'character': return '角色';
    case 'memo': return '备忘';
    default: return type;
  }
}

// ═══════════════════════════════════════════════════════════════
// 事件编辑模态表单
// ═══════════════════════════════════════════════════════════════

/** 字段在哪些类型下显示（world/major/character）；不在此列表的类型该字段隐藏 */
const FIELD_SHOW_TYPES: Record<string, readonly CalendarEventType[]> = {
  'major-time': ['major'],
  'char-time': ['character'],
  'location': ['world', 'major', 'character'],
  'participants': ['world', 'major'],
  'character-field': ['world', 'character'],
};


export function buildEventEditModalHTML(
  dateKey: string,
  style: StyleType,
  event?: CalendarEvent,
): string {
  const isEdit = !!event;
  const type: CalendarEventType = event?.type || 'character';
  const themeClass = getCalendarThemeClass(style);
  const dateLabel = formatMonthDay(dateKey);
  const titleText = isEdit ? `编辑事件 · ${dateLabel}` : `新增事件 · ${dateLabel}`;

  const typeBtns = (['world', 'major', 'character'] as const).map(t =>
    `<button class="cal-edit-type-btn${t === type ? ' active' : ''}" data-edit-type="${t}" type="button">${eventTypeLabel(t)}</button>`,
  ).join('');

  const rows: string[] = [];
  rows.push(`<div class="cal-edit-row"><label>类型</label><div class="cal-edit-type-row">${typeBtns}</div></div>`);
  rows.push(`<div class="cal-edit-row"><label>标题</label><input id="cal-edit-title" type="text" value="${escapeAttr(event?.title)}" placeholder="必填" /></div>`);
  rows.push(`<div class="cal-edit-row"><label>日期</label><input id="cal-edit-date" type="text" value="${escapeAttr(event?.date || dateKey)}" placeholder="如 0212-08-15（负年份如 -0500-03-12）" /></div>`);
  rows.push(`<div class="cal-edit-row" data-field="major-time"><label>开始时间</label><input id="cal-edit-start" type="text" value="${escapeAttr(event?.startTime)}" placeholder="如 18:00" /></div>`);
  rows.push(`<div class="cal-edit-row" data-field="major-time"><label>结束时间</label><input id="cal-edit-end" type="text" value="${escapeAttr(event?.endTime)}" placeholder="可选" /></div>`);
  rows.push(`<div class="cal-edit-row" data-field="char-time"><label>时间</label><input id="cal-edit-time" type="text" value="${escapeAttr(event?.startTime)}" placeholder="如 19:00" /></div>`);
  rows.push(`<div class="cal-edit-row"><label>描述</label><textarea id="cal-edit-desc" placeholder="可选">${escapeAttr(event?.description)}</textarea></div>`);
  rows.push(`<div class="cal-edit-row" data-field="location"><label>地点</label><input id="cal-edit-location" type="text" value="${escapeAttr(event?.location)}" placeholder="可选" /></div>`);
  rows.push(`<div class="cal-edit-row" data-field="participants"><label>参与者</label><input id="cal-edit-participants" type="text" value="${escapeAttr(event?.participants)}" placeholder="可选" /></div>`);
  rows.push(`<div class="cal-edit-row" data-field="character-field"><label>角色</label><input id="cal-edit-character" type="text" value="${escapeAttr(event?.character)}" placeholder="可选" /></div>`);

  // 初始可见性：按当前 type 显隐
  const visibleTypes = (field: string): boolean => FIELD_SHOW_TYPES[field]?.includes(type) ?? false;
  const rowsHtml = rows.map(r => {
    const m = r.match(/data-field="([^"]+)"/);
    if (m && !visibleTypes(m[1])) return r.replace('<div class="cal-edit-row"', '<div class="cal-edit-row is-hidden"');
    return r;
  }).join('');

  const deleteBtn = isEdit
    ? `<button class="cal-edit-btn cal-edit-btn-danger" data-cal-modal-action="delete" type="button">删除</button>`
    : '';

  return `<div class="cal-edit-modal ${themeClass}" data-cal-modal>
    <div class="cal-edit-modal-card">
      <div class="cal-edit-modal-title">
        <span>${titleText}</span>
        <button class="cal-edit-modal-x" data-cal-modal-action="cancel" type="button">${ubIcon('close')}</button>
      </div>
      <div class="cal-edit-form">${rowsHtml}</div>
      <div class="cal-edit-actions">
        ${deleteBtn}
        <span style="flex:1"></span>
        <button class="cal-edit-btn" data-cal-modal-action="cancel" type="button">取消</button>
        <button class="cal-edit-btn cal-edit-btn-primary" data-cal-modal-action="save" type="button">保存</button>
      </div>
    </div>
  </div>`;
}
