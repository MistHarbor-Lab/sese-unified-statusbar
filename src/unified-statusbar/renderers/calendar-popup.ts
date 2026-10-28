// ===== 日历弹窗渲染与交互 =====
import { ubIcon } from '../core/icons';
import { UB_EVENT, emitUbEvent } from '../core/events';
import { getToastr } from '../core/env';
import type { StyleType } from '../core/constants';
import { CALENDAR_MAX_MONTH_RANGE, CALENDAR_REFRESH_LONG_PRESS_COST } from '../core/constants';
import {
  getTodayDateKey,
  parseDateKey,
  parseDateKeyFromText,
  buildEventMap,
  buildWeatherMap,
  buildMonthGrid,
  isMonthInRange,
  upsertCalendarEvent,
  deleteCalendarEvent,
  generateNewEventId,
  refreshTodayWeather,
  type CalendarEvent,
  type CalendarEventType,
} from '../core/calendar-core';
import { performCalendarGeneration } from '../core/calendar-ai';
import { getConfig } from '../core/config-store';
import {
  getCalendarThemeClass,
  buildCalendarCellHTML,
  buildDetailCardHTML,
  buildEventEditModalHTML,
} from './calendar-themed';
import { showWorldWindow } from './world-window';
import { getCycleCalendarAnnotations, type CycleDayMark } from '../core/cycle-engine';
import { getBirthdayCalendarAnnotations, type BirthdayDayMark } from '../core/birthday';
import { countChroniclesForDateCached, createDefaultChronicleReaderSource } from '../core/chronicle-reader';
import { showChronicleReaderPopup } from './chronicle-reader-popup';
import { markPopupShown, guardGhostClick, closePanelOverlay } from './html-builder';
import { applyOverlayDark, getPanelColorMode } from './panel-color-mode';
import { readExtraPromptCache, writeExtraPromptCache, EXTRA_PROMPT_CACHE_KEYS } from '../core/extra-prompt-cache';
import { bindLongPress, swallowGhostClickIfPointerActive } from './long-press';

// ═══════════════════════════════════════════════════
// 刷新按钮长按（短按免费普通刷新；长按弹额外提示词框、扣 3 能量）
// U10：计时器与合成 click 吞噬统一交给 renderers/long-press，本文件不再自持状态。
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// 弹窗工具函数（复用 popup-manager.ts 模式）
// ═══════════════════════════════════════════════════════════════

/**
 * F12：关闭必须走 html-builder 正版 closePanelOverlay——它会 releaseBackGuardIfIdle()
 * （归还安卓返回键守卫）+ clearPopupScrollMem()。此前这里有一份本地副本，只做
 * remove('show') + 清 innerHTML + 刷徽章，漏了归还守卫：而日历打开共享 #panelOverlay
 * 且确实调了 markPopupShown() 压守卫 ⇒ 用关闭按钮或点遮罩关闭后，那条压入浏览器历史的
 * 守卫记录永不回收，下次返回键先撞上它、被白白吞掉；反复开关日历会堆积多条幽灵记录。
 * 清空内容保留（日历原有语义），其余关闭语义统一交给正版。
 */
function closeCalendarOverlay(overlay: HTMLElement): void {
  closePanelOverlay(overlay);
  overlay.innerHTML = '';
}

function syncDarkClass(overlay: HTMLElement): void {
  try {
    if (getPanelColorMode() === 'tavern') { applyOverlayDark(overlay, getConfig().style === 'minimal'); return; }
    // plugin 模式：darkTheme 配置即事实源（主面板锚点渲染与否不影响弹窗配色）
    const dark = getConfig().darkTheme;
    overlay.classList.toggle('dark', dark);
    if (getConfig().style === 'minimal') document.body.classList.toggle('dark-mode', dark);
  } catch (e) { /* ignore */ }
}

function renderSelectedDetail(overlay: HTMLElement, key: string, chronicleCount = 0): void {
  const ov = overlay as any;
  const events = ov._calEventMap?.get(key) || [];
  const weatherDesc = ov._calWeatherMap?.get(key) || '';
  const cycleMarks = ov._calCycleMarksMap?.get(key) || [];
  const birthdayMarks = ov._calBirthdayMarksMap?.get(key) || [];
  const detailEl = overlay.querySelector('.cal-detail');
  if (detailEl) detailEl.innerHTML = buildDetailCardHTML(key, events, weatherDesc, ov._calStyle, cycleMarks, chronicleCount, birthdayMarks);
}

/** 只对当前选中日期按需扫描纪要，过期的异步返回绝不覆盖新的日期详情。
 *  O32：改走 countChroniclesForDateCached——内存直算 + 指纹缓存 + 在飞取消（见 core/chronicle-reader 段头注释）；
 *  返回 null = 本轮已被更新的点击取消，直接丢弃（不再渲染）。 */
async function refreshChronicleShortcut(overlay: HTMLElement, key: string): Promise<void> {
  const ov = overlay as any;
  const token = (ov._calChronicleToken || 0) + 1;
  ov._calChronicleToken = token;
  if (!key) return;
  const count = await countChroniclesForDateCached(key, createDefaultChronicleReaderSource([], []));
  if (count === null) return;
  if (ov._calChronicleToken !== token || ov._calSelectedKey !== key) return;
  renderSelectedDetail(overlay, key, count);
}

// ═══════════════════════════════════════════════════════════════
// 弹窗主函数
// ═══════════════════════════════════════════════════════════════

export async function showCalendarPopup(style: StyleType): Promise<void> {
  const config = getConfig();
  if (!config.calendarEnabled) {
    getToastr()?.info('日历功能未启用，请在设置中开启', '日历提示');
    return;
  }

  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;

  const todayKey = getTodayDateKey();
  const parsed = todayKey ? parseDateKey(todayKey) : null;
  if (!parsed) {
    // F3：游戏日期未建立（AI 尚未填「当前时间」）时不兜底现实年月——事件会记在现实
    // dateKey 名下，游戏纪年到达后被 migratePastEvents 当「远古旧事」静默清理（丢数据）。
    // 日历整轴都是游戏时间，无日期时无可用视图，直接提示退出。
    getToastr()?.info('游戏日期尚未建立：让 AI 填写「当前时间」后再打开日历', '日历提示');
    return;
  }
  const year = parsed.year;
  const month = parsed.month;

  await renderCalendar(overlay, year, month, todayKey, todayKey, style);

  syncDarkClass(overlay);
  markPopupShown();
  overlay.classList.add('show');

  bindCalendarOverlayEvents(overlay);
}

/** 绑定日历弹窗的事件委托处理器（供 newspaper 关闭后恢复使用） */
function bindCalendarOverlayEvents(overlay: HTMLElement): void {
  overlay.onclick = async function (e) {
    const target = e.target as HTMLElement;

    // 关闭：背景 或 关闭按钮
    if (e.target === overlay) {
      if (!guardGhostClick()) closeCalendarOverlay(overlay);
      return;
    }
    if (target.id === 'panelClose' || target.closest('#panelClose')) {
      closeCalendarOverlay(overlay);
      return;
    }

    // 月份导航
    const navBtn = target.closest('[data-cal-action]');
    if (navBtn) {
      const action = (navBtn as HTMLElement).dataset.calAction;
      const ov = overlay as any;
      if (action === 'prev-month') {
        ov._calMonth--;
        if (ov._calMonth < 1) { ov._calMonth = 12; ov._calYear--; }
      } else if (action === 'next-month') {
        ov._calMonth++;
        if (ov._calMonth > 12) { ov._calMonth = 1; ov._calYear++; }
      } else if (action === 'refresh') {
        // 长按已由 long-press 模块处理（弹了额外提示词框并吞掉合成 click），此处只处理短按免费刷新
        const btn = navBtn as HTMLButtonElement;
        await performCalendarGeneration(btn);
        // 渲染交给下方公共 renderCalendar，此处不再重复渲染一次
      }
      await renderCalendar(overlay, ov._calYear, ov._calMonth, ov._calTodayKey, ov._calSelectedKey, ov._calStyle);
      return;
    }

    // 日期格子点击
    const dayBtn = target.closest('[data-cal-key]');
    if (dayBtn) {
      const key = (dayBtn as HTMLElement).dataset.calKey!;
      const ov = overlay as any;
      ov._calSelectedKey = key;
      updateSelectedDateInDOM(overlay, key);
      renderSelectedDetail(overlay, key);
      void refreshChronicleShortcut(overlay, key);
      return;
    }

    const chronicleBtn = target.closest<HTMLElement>('[data-cal-chronicle-date]');
    if (chronicleBtn) {
      const dateKey = chronicleBtn.dataset.calChronicleDate;
      if (dateKey) { closeCalendarOverlay(overlay); void showChronicleReaderPopup((overlay as any)._calStyle, { dateKey }); }
      return;
    }

    // 日报按钮（世界演化窗口）
    if (target.closest('#calNewspaperBtn')) {
      const ov = overlay as any;
      showWorldWindow(ov._calStyle, () => {
        void renderCalendar(overlay, ov._calYear, ov._calMonth, ov._calTodayKey, ov._calSelectedKey, ov._calStyle);
        bindCalendarOverlayEvents(overlay);
      });
      return;
    }

    // 事件编辑入口：编辑
    const editBtn = target.closest('[data-cal-edit]');
    if (editBtn) {
      const ov = overlay as any;
      const id = (editBtn as HTMLElement).dataset.calEdit!;
      const event = findEventInView(overlay, id);
      if (event && ov._calSelectedKey) {
        showCalendarEventEditModal(overlay, ov._calStyle, ov._calSelectedKey, event);
      }
      return;
    }

    // 事件删除入口：删除（内联二次确认）
    const delBtnEl = target.closest('[data-cal-del]');
    if (delBtnEl) {
      const btn = delBtnEl as HTMLElement;
      const id = btn.dataset.calDel!;
      if (btn.dataset.confirming === '1') {
        btn.dataset.confirming = '';
        await doDeleteEvent(overlay, id);
      } else {
        btn.dataset.confirming = '1';
        btn.classList.add('is-confirming');
        const orig = btn.innerHTML;
        btn.innerHTML = '确认?';
        setTimeout(() => {
          if (btn.dataset.confirming === '1') {
            btn.dataset.confirming = '';
            btn.classList.remove('is-confirming');
            btn.innerHTML = orig;
          }
        }, 2500);
      }
      return;
    }

    // 新增事件入口
    const addBtn = target.closest('[data-cal-add]');
    if (addBtn) {
      const ov = overlay as any;
      if (ov._calSelectedKey) {
        showCalendarEventEditModal(overlay, ov._calStyle, ov._calSelectedKey, undefined);
      }
      return;
    }

    // 日历内部的其他元素不关闭弹窗
    if (target.closest('.calendar-popup')) return;
  };
}

/** 在当前弹窗的 eventMap 中按 id 查找事件 */
function findEventInView(overlay: HTMLElement, id: string): CalendarEvent | undefined {
  const ov = overlay as any;
  const eventMap: Map<string, CalendarEvent[]> = ov._calEventMap || new Map();
  for (const list of eventMap.values()) {
    const found = list.find(e => e.id === id);
    if (found) return found;
  }
  return undefined;
}

/** 删除事件后刷新弹窗 */
async function doDeleteEvent(overlay: HTMLElement, id: string): Promise<void> {
  const ov = overlay as any;
  await deleteCalendarEvent(id);
  await refreshTodayWeather();
  emitUbEvent(UB_EVENT.storyCacheChanged);
  await renderCalendar(overlay, ov._calYear, ov._calMonth, ov._calTodayKey, ov._calSelectedKey, ov._calStyle);
}

/** 显示事件编辑模态表单 */
function showCalendarEventEditModal(
  overlay: HTMLElement,
  style: StyleType,
  dateKey: string,
  event?: CalendarEvent,
): void {
  // 移除已有模态
  overlay.querySelector('[data-cal-modal]')?.remove();

  const popup = overlay.querySelector('.calendar-popup');
  if (!popup) return;
  popup.insertAdjacentHTML('afterend', buildEventEditModalHTML(dateKey, style, event));

  const modal = overlay.querySelector('[data-cal-modal]') as HTMLElement | null;
  if (!modal) return;
  syncDarkClassForModal(modal, style);

  let currentType: CalendarEventType = event?.type || 'character';

  const close = () => { modal.remove(); };

  modal.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;

    // 点击遮罩空白处关闭
    if (t === modal) { close(); return; }

    // 类型切换
    const typeBtn = t.closest('[data-edit-type]');
    if (typeBtn) {
      currentType = (typeBtn as HTMLElement).dataset.editType as CalendarEventType;
      modal.querySelectorAll('.cal-edit-type-btn').forEach(b => b.classList.remove('active'));
      (typeBtn as HTMLElement).classList.add('active');
      applyFieldVisibility(modal, currentType);
      return;
    }

    const actionEl = t.closest('[data-cal-modal-action]');
    if (!actionEl) return;
    const action = (actionEl as HTMLElement).dataset.calModalAction;

    if (action === 'cancel') { close(); return; }

    if (action === 'delete' && event) {
      modal.remove();
      void doDeleteEvent(overlay, event.id);
      return;
    }

    if (action === 'save') {
      await doSaveFromModal(overlay, modal, event, currentType, close);
    }
  });
}

/** 同步模态深色类（overlay 已有 .dark，但模态作为兄弟需单独加） */
function syncDarkClassForModal(modal: HTMLElement, _style: StyleType): void {
  try {
    if (getPanelColorMode() === 'tavern') { applyOverlayDark(modal, getConfig().style === 'minimal'); return; }
    const dark = getConfig().darkTheme;
    modal.classList.toggle('dark', dark);
    if (getConfig().style === 'minimal') document.body.classList.toggle('dark-mode', dark);
  } catch { /* ignore */ }
}

/** 按类型显隐字段行 */
function applyFieldVisibility(modal: HTMLElement, type: CalendarEventType): void {
  const show: Record<string, readonly CalendarEventType[]> = {
    'major-time': ['major'],
    'char-time': ['character'],
    'location': ['world', 'major', 'character'],
    'participants': ['world', 'major'],
    'character-field': ['world', 'character'],
  };
  modal.querySelectorAll<HTMLElement>('[data-field]').forEach(row => {
    const field = row.dataset.field!;
    const visible = show[field]?.includes(type) ?? false;
    row.classList.toggle('is-hidden', !visible);
  });
}

/** 从表单收集值并保存 */
async function doSaveFromModal(
  overlay: HTMLElement,
  modal: HTMLElement,
  event: CalendarEvent | undefined,
  type: CalendarEventType,
  close: () => void,
): Promise<void> {
  const title = (modal.querySelector('#cal-edit-title') as HTMLInputElement)?.value.trim() || '';
  const dateRaw = (modal.querySelector('#cal-edit-date') as HTMLInputElement)?.value.trim() || '';
  const desc = (modal.querySelector('#cal-edit-desc') as HTMLTextAreaElement)?.value.trim() || '';
  const location = (modal.querySelector('#cal-edit-location') as HTMLInputElement)?.value.trim() || '';
  const participants = (modal.querySelector('#cal-edit-participants') as HTMLInputElement)?.value.trim() || '';
  const character = (modal.querySelector('#cal-edit-character') as HTMLInputElement)?.value.trim() || '';
  const start = (modal.querySelector('#cal-edit-start') as HTMLInputElement)?.value.trim() || '';
  const end = (modal.querySelector('#cal-edit-end') as HTMLInputElement)?.value.trim() || '';
  const time = (modal.querySelector('#cal-edit-time') as HTMLInputElement)?.value.trim() || '';

  if (!title) {
    getToastr()?.warning('请填写标题', '日历');
    return;
  }
  const normalizedDate = parseDateKeyFromText(dateRaw);
  if (!normalizedDate) {
    getToastr()?.warning('日期格式无效，如 0212-08-15（负年份如 -0500-03-12）', '日历');
    return;
  }

  const id = event?.id || await generateNewEventId(type);
  const ev: CalendarEvent = {
    id,
    date: normalizedDate,
    type,
    title,
    description: desc,
  };
  if (type === 'major') {
    if (start) ev.startTime = start;
    if (end) ev.endTime = end;
  } else if (type === 'character') {
    if (time) ev.startTime = time;
  }
  if (location) ev.location = location;
  if (participants) ev.participants = participants;
  if (character) ev.character = character;

  const ov = overlay as any;
  const ok = await upsertCalendarEvent(ev);
  if (!ok) {
    getToastr()?.error('保存失败，请稍后重试', '日历');
    return;
  }
  await refreshTodayWeather();
  emitUbEvent(UB_EVENT.storyCacheChanged);
  // 日期可能变更，选中键跟随事件新日期
  ov._calSelectedKey = normalizedDate;
  close();
  await renderCalendar(overlay, ov._calYear, ov._calMonth, ov._calTodayKey, ov._calSelectedKey, ov._calStyle);
}

/** PC 视口判定（window 未定义时返回 true，供测试与构建环境） */
export function isPcViewport(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(min-width:768px)').matches;
  } catch { return true; }
}

/** 组装日历弹窗 HTML（纯函数，不触 IO）。PC 左右分栏 / 移动纵列。 */
export function buildCalendarPopupHTML(params: {
  year: number; month: number; todayKey: string | null; selectedKey: string | null;
  style: StyleType;
  eventMap: Map<string, CalendarEvent[]>;
  weatherMap: Map<string, string>;
  cycleMarksMap: Map<string, CycleDayMark[]>;
  birthdayMarksMap?: Map<string, BirthdayDayMark[]>;
  isPc: boolean;
}): string {
  const { year, month, todayKey, selectedKey, style, eventMap, weatherMap, cycleMarksMap, isPc } = params;
  const birthdayMarksMap = params.birthdayMarksMap || new Map<string, BirthdayDayMark[]>();
  const cells = buildMonthGrid(year, month, eventMap, selectedKey, todayKey);
  const themeClass = getCalendarThemeClass(style);
  const canPrev = isMonthInRange(year, month - 1 < 1 ? 12 : month - 1, CALENDAR_MAX_MONTH_RANGE);
  const canNext = isMonthInRange(year, month + 1 > 12 ? 1 : month + 1, CALENDAR_MAX_MONTH_RANGE);
  const monthLabel = `${year}年${month}月`;

  const headerHtml =
    '<div class="cal-header">' +
    `<button class="cal-nav-btn" data-cal-action="prev-month" type="button"${canPrev ? '' : ' disabled'}>&lt;</button>` +
    `<div class="cal-month-label">${monthLabel}</div>` +
    `<button class="cal-nav-btn" data-cal-action="next-month" type="button"${canNext ? '' : ' disabled'}>&gt;</button>` +
    '<span style="flex:1"></span>' +
    '<button class="cal-newspaper-btn" id="calNewspaperBtn" type="button" title="世界演化">' + ubIcon('world-evolve') + '</button>' +
    '<button class="cal-refresh-btn ub-lp-hint" data-cal-action="refresh" type="button" title="短按免费刷新；长按可附加刷新要求（消耗3能量）">' + ubIcon('refresh') + ' 刷新</button>' +
    '<button class="cal-close-btn" id="panelClose" type="button">&times;</button>' +
    '</div>';

  const gridHtml =
    '<div class="cal-grid">' +
    cells.map(cell => buildCalendarCellHTML(cell, style, cycleMarksMap.get(cell.key) || [], birthdayMarksMap.get(cell.key) || [])).join('') +
    '</div>';

  const selectedEvents = selectedKey ? (eventMap.get(selectedKey) || []) : [];
  const selectedCycleMarks = selectedKey ? (cycleMarksMap.get(selectedKey) || []) : [];
  const selectedBirthdayMarks = selectedKey ? (birthdayMarksMap.get(selectedKey) || []) : [];
  const weatherDesc = selectedKey ? (weatherMap.get(selectedKey) || '') : '';
  const detailHtml = buildDetailCardHTML(selectedKey || '', selectedEvents, weatherDesc, style, selectedCycleMarks, 0, selectedBirthdayMarks);

  let bodyHtml: string;
  if (isPc) {
    // A4 左右分栏：左列月历（居中留白），右列事件流整列高
    bodyHtml =
      '<div class="cal-split">' +
        '<div class="cal-col-cal">' +
          '<div class="cal-weekdays"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>' +
          '<div class="cal-grid-wrap">' + gridHtml + '</div>' +
        '</div>' +
        '<div class="cal-col-ev">' +
          '<div class="cal-detail">' + detailHtml + '</div>' +
        '</div>' +
      '</div>';
  } else {
    bodyHtml =
      '<div class="cal-weekdays"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>' +
      gridHtml +
      '<div class="cal-detail">' + detailHtml + '</div>';
  }

  return `<div class="calendar-popup ub-popup--l ${themeClass}${style === 'bridge' ? ' bridge-window bridge-module-calendar' : ''}"${isPc ? ' data-cal-layout="split"' : ''}>` +
    headerHtml + bodyHtml +
    '</div>';
}

/** 渲染完整的日历弹窗 */
async function renderCalendar(
  overlay: HTMLElement,
  year: number,
  month: number,
  todayKey: string | null,
  selectedKey: string | null,
  style: StyleType,
): Promise<void> {
  const eventMap = await buildEventMap(year, month);
  const weatherMap = await buildWeatherMap();
  const cycleMarksMap = getCycleCalendarAnnotations(year, month);
  // 生日蛋糕标注/详情条目：设置「日历生日」关闭时整体跳过（世界书生日行同开关）
  const birthdayMarksMap = getConfig().calendarBirthdayEnabled === false
    ? new Map<string, BirthdayDayMark[]>()
    : getBirthdayCalendarAnnotations(year);

  const html = buildCalendarPopupHTML({
    year, month, todayKey, selectedKey, style,
    eventMap, weatherMap, cycleMarksMap, birthdayMarksMap,
    isPc: isPcViewport(),
  });

  // 保存状态（不变）
  (overlay as any)._calYear = year;
  (overlay as any)._calMonth = month;
  (overlay as any)._calSelectedKey = selectedKey;
  (overlay as any)._calTodayKey = todayKey;
  (overlay as any)._calStyle = style;
  (overlay as any)._calEventMap = eventMap;
  (overlay as any)._calWeatherMap = weatherMap;
  (overlay as any)._calCycleMarksMap = cycleMarksMap;
  (overlay as any)._calBirthdayMarksMap = birthdayMarksMap;

  overlay.innerHTML = html;
  bindCalendarRefreshLongPress(overlay);
  void refreshChronicleShortcut(overlay, selectedKey || '');
}

/** 绑定刷新按钮长按（U10：统一走 long-press 模块）：短按放行 onclick 走免费刷新；长按弹额外提示词框、扣能量。
 *  长按后松手补发的合成 click（target 落在额外提示词遮罩上）由 showCalendarExtraPromptDialog 里的
 *  swallowGhostClickIfPointerActive 在 document capture 层吞掉，故这里不再自持 longPressed 标记。 */
function bindCalendarRefreshLongPress(overlay: HTMLElement): void {
  const btn = overlay.querySelector<HTMLButtonElement>('.cal-refresh-btn');
  if (!btn) return;
  bindLongPress(btn, {
    canStart: () => !btn.disabled,
    onLong: () => {
      showCalendarExtraPromptDialog(overlay, (val) => {
        void (async () => {
          await performCalendarGeneration(btn, val, CALENDAR_REFRESH_LONG_PRESS_COST);
          const ov = overlay as any;
          await renderCalendar(overlay, ov._calYear, ov._calMonth, ov._calTodayKey, ov._calSelectedKey, ov._calStyle);
        })();
      });
    },
  });
}

/** 关闭长按额外提示词弹窗 */
function closeCalendarExtraDialog(): void {
  const dlg = document.getElementById('calExtraOverlay');
  if (dlg) dlg.remove();
}

/**
 * 长按刷新弹框：输入额外提示词后回调 onConfirm(value)。
 * 作为 .calendar-popup 的兄弟节点插入（对齐 .cal-edit-modal：position:absolute 相对 #panelOverlay），
 * 不清空日历弹窗。复用日历主题 CSS 变量。输入非空才可点确认。
 */
function showCalendarExtraPromptDialog(overlay: HTMLElement, onConfirm: (value: string) => void): void {
  closeCalendarExtraDialog();
  const popup = overlay.querySelector('.calendar-popup');
  if (!popup) return;
  const html =
    '<div class="cal-extra-overlay" id="calExtraOverlay">' +
      '<div class="cal-extra-modal">' +
        '<div class="cal-extra-title">额外要求（仅本次刷新生效）</div>' +
        '<div class="cal-extra-field">' +
          '<label class="cal-extra-label">补充本次日历生成的额外要求（仅本次生效，不保存）。长按刷新消耗 <b>' + CALENDAR_REFRESH_LONG_PRESS_COST + '</b> 点瑟瑟能量。</label>' +
          '<textarea class="cal-extra-textarea" id="calExtraInput" rows="5" placeholder="例如：&#10;· 侧重某角色的羁绊事件&#10;· 加入契合当前场景的天气/节令&#10;· 指定某种叙事风格"></textarea>' +
        '</div>' +
        '<div class="cal-extra-actions">' +
          '<button class="cal-edit-btn" id="calExtraCancel" type="button">取消</button>' +
          '<button class="cal-edit-btn cal-edit-btn-primary" id="calExtraOk" type="button" disabled>开始生成</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  // 作为 .calendar-popup 的兄弟节点插入（对齐 .cal-edit-modal：position:absolute 相对 #panelOverlay）
  popup.insertAdjacentHTML('afterend', html);

  // 深色模式同步（对齐 .cal-edit-modal：读 #panelOverlay.dark）
  const dlgEl = document.getElementById('calExtraOverlay');
  if (dlgEl) {
    const isDark = overlay.classList.contains('dark') || document.body.classList.contains('dark-mode');
    if (isDark) dlgEl.classList.add('dark');
  }

  const input = document.getElementById('calExtraInput') as HTMLTextAreaElement | null;
  const okBtn = document.getElementById('calExtraOk') as HTMLButtonElement | null;
  const cancelBtn = document.getElementById('calExtraCancel');
  const close = (): void => closeCalendarExtraDialog();

  input?.addEventListener('input', () => { if (okBtn) okBtn.disabled = !input.value.trim(); });
  const cachedCal = readExtraPromptCache(EXTRA_PROMPT_CACHE_KEYS.calendar);
  if (input && cachedCal) { input.value = cachedCal; if (okBtn) okBtn.disabled = false; }
  cancelBtn?.addEventListener('click', close);
  okBtn?.addEventListener('click', () => {
    const val = (input?.value || '').trim();
    if (!val) return;
    writeExtraPromptCache(EXTRA_PROMPT_CACHE_KEYS.calendar, val);
    close();
    onConfirm(val);
  });
  // 点遮罩关闭（stopPropagation 防止冒泡到 #panelOverlay 的日历关闭处理）
  dlgEl?.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).id === 'calExtraOverlay') close();
  });
  // 长按触发时手指仍按下，松手补发的合成 click 会落在刚出现的遮罩上把弹窗立刻关掉；
  // 在 document capture 层一次性吞掉（U10：统一由 long-press 模块提供）。
  swallowGhostClickIfPointerActive();
  // 自动聚焦输入框
  setTimeout(() => { input?.focus(); }, 50);
}

/** 更新选中日期的高亮（不移除 today 高亮） */
function updateSelectedDateInDOM(overlay: HTMLElement, key: string): void {
  const cells = overlay.querySelectorAll('.cal-day');
  cells.forEach(c => {
    const cellKey = (c as HTMLElement).dataset.calKey;
    if (cellKey === key) {
      c.classList.add('is-selected');
    } else {
      c.classList.remove('is-selected');
    }
  });
}
