// ===== 剧情回顾阅读器：固定外壳、局部追加与筛选 =====
import type { StyleType } from '../core/constants';
import { UB_EVENT } from '../core/events';
import { getToastr } from '../core/env';
import { getSheetByName } from '../core/data-manager';
import { createChronicleReaderController, createDefaultChronicleReaderSource, chronicleMonthGrid, chronicleYearMonthOfKey, listChronicleDatesInMonth, parseKeyDialogue, type ChronicleDialogueLine, type ChronicleRowRef } from '../core/chronicle-reader';
import { getConfig } from '../core/config-store';
import { listMapLibraryNodes } from '../core/map-system';
import { escapeHtml, escapeHtmlAttr } from '../core/html-escape';
// [LEGACY-MERGE · DB-ONLY] 状态栏合并仅数据库模式；台账接管时这里只保留「去台账合并」导航。
import { openChronicleMerge } from './chronicle-merge-popup';
import { isLedgerTakeover, ledgerSupportsSummaryMerge, openLedgerWorkbench } from '../core/ledger-takeover';
import { bridgeWindowClass, closePanelOverlay, guardGhostClick, markPopupShown, setPopupReturnTo, syncDarkClass, syncDarkClassMinimal } from './html-builder';
import { getTodayDateKey, formatDateKey } from '../core/calendar-core';

function names(tableName: string): string[] {
  const sheet = getSheetByName(tableName); if (!sheet?.content?.length) return [];
  const column = sheet.content[0].indexOf('姓名'); if (column < 0) return [];
  return sheet.content.slice(1).map(row => String(row[column] || '').trim()).filter(Boolean);
}
function appendHtml(parent: Element, html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  parent.append(template.content);
}
function tagHtml(item: ChronicleRowRef): string {
  return item.tags.map(tag => `<button class="chronicle-auto-tag ${tag.kind}" data-chronicle-tag="${tag.kind}" data-chronicle-name="${escapeHtmlAttr(tag.name)}"${tag.nodeId ? ` data-chronicle-node="${escapeHtmlAttr(tag.nodeId)}"` : ''} type="button">${escapeHtml(tag.name)}</button>`).join('');
}
function timelineTime(timeSpan: string): { date: string; range: string; raw: string } {
  const raw = String(timeSpan || '').trim();
  const [start = '', end = ''] = raw.split(/\s*(?:~|～|至)\s*/, 2);
  const date = start.match(/-?\d{1,6}-\d{1,2}-\d{1,2}/)?.[0] || '';
  const startTime = start.match(/\d{1,2}:\d{2}/)?.[0] || '';
  const endTime = end.match(/\d{1,2}:\d{2}/)?.[0] || '';
  return { date, range: startTime && endTime ? `${startTime}—${endTime}` : startTime || endTime, raw };
}
function dialogueLineHtml(line: ChronicleDialogueLine, linkable: boolean): string {
  const speaker = line.speaker
    ? (linkable
      ? `<button class="chronicle-dialogue-speaker" data-chronicle-speaker="${escapeHtmlAttr(line.speaker)}" type="button">${escapeHtml(line.speaker)}</button>`
      : `<span class="chronicle-dialogue-speaker">${escapeHtml(line.speaker)}</span>`)
    : '<span class="chronicle-dialogue-speaker is-unknown">旧记录</span>';
  return `<div class="chronicle-dialogue-line">${speaker}<q class="chronicle-dialogue-copy">${escapeHtml(line.text)}</q></div>`;
}

function dialogueHtml(raw: string, people: Set<string>, preview: boolean): string {
  const lines = parseKeyDialogue(raw);
  if (!lines.length) return '';
  const shown = preview ? lines.slice(0, 2) : lines;
  const more = preview && lines.length > shown.length
    ? `<div class="chronicle-dialogue-more"><span class="cr-more-badge">+${lines.length - shown.length} 句</span>进入详情后完整展开</div>`
    : '';
  return `<div class="chronicle-timeline-dialogue${preview ? ' is-preview' : ' is-detail'}">${shown.map(line => dialogueLineHtml(line, !!line.speaker && line.speaker !== '主角' && people.has(line.speaker))).join('')}${more}</div>`;
}

function buildTimelineEntry(item: ChronicleRowRef, people: Set<string>): string {
  const time = timelineTime(item.timeSpan);
  const timeHtml = time.date || time.range
    ? `<b>${escapeHtml(time.date || '日期未详')}</b><span>${escapeHtml(time.range || '时间未详')}</span>`
    : `<span>${escapeHtml(time.raw || '未记录时间')}</span>`;
  const dialogue = dialogueHtml(item.keyDialogue, people, true);
  return `<article class="chronicle-timeline-entry" data-chronicle-open="${item.rowId}"><time class="chronicle-timeline-time">${timeHtml}</time><span class="chronicle-timeline-rail" aria-hidden="true"><i class="chronicle-timeline-node"></i></span><div class="chronicle-timeline-content chronicle-reader-card"><span class="chronicle-timeline-kicker">STORY LOG · ${String(item.rowId).padStart(3, '0')}</span><h3>${escapeHtml(item.summary || '未命名纪要')}</h3>${dialogue}<div class="chronicle-timeline-tags">${tagHtml(item)}</div></div></article>`;
}
function dateFromKey(key: string): { year: number; month: number } | null {
  // F3：负年份/短年份安全解析，不再兜底现实时钟（公元前剧本原会被兜到玩家真实年月）
  return chronicleYearMonthOfKey(key);
}
function dateKeyFor(year: number, month: number, day: number): string {
  // U32：拼装收编 formatDateKey（口径原本就一致；注释已自认同 formatYear）
  return formatDateKey(year, month, day);
}

async function mapLocationCandidates(): Promise<{ name: string; nodeId: string; excluded?: boolean }[]> {
  try {
    const exclusion = new Set(String(getConfig().mapExcludePattern || '').split(/[、，,\n]/).map(value => value.trim()).filter(Boolean));
    const nodes = await listMapLibraryNodes();
    return nodes
      .filter(node => !!node.name && !/[>→—]/.test(node.name))
      .map(node => ({ name: node.name.trim(), nodeId: node.nodeId, excluded: exclusion.has(node.name.trim()) }));
  } catch (_error) { return []; }
}

export async function showChronicleReaderPopup(style: StyleType, options: { dateKey?: string; onClosed?: () => void } = {}): Promise<void> {
  const overlay = document.getElementById('panelOverlay'); if (!overlay) return;
  const people = [...names('恋爱对象表'), ...names('重要角色表')];
  const peopleSet = new Set(people);
  const controller = createChronicleReaderController(createDefaultChronicleReaderSource(
    people,
    await mapLocationCandidates(),
  ));
  let dateKey = options.dateKey || '';
  const onClosed = options.onClosed;
  // F2：子窗（角色中枢/地图）接管 overlay 期间保持本弹窗监听存活（restoreReader 会重新接回），
  // 观察器据此跳过接管清理；除此之外的「内容被其它弹窗直接重写」一律就地 dispose。
  let handoffPending = false;
  let searchDraft = '';
  let searchText = '';
  let allHistoryResults: ChronicleRowRef[] | null = null;
  let searchAbort: AbortController | null = null;
  let loading = false;
  let searchingHistory = false;
  let hasNext = true;
  let stale = false;
  let listScrollTop = 0;
  let observer: IntersectionObserver | null = null;
  let calendar = dateFromKey(dateKey || getTodayDateKey() || '') || { year: 1, month: 1 };
  const calendarChronicleCache = new Map<string, Set<string>>();
  let calendarChronicleToken = 0;
  const cls = style === 'bridge' ? `${bridgeWindowClass('chronicle-reader', 'l')} chronicle-reader-popup` : 'panel-popup ub-popup--l chronicle-reader-popup';

  if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  const root = document.createElement('div');
  root.className = `${cls} chronicle-reader-theme-${style}`;
  // 搜索已加载纪要（兼容旧契约标记）
  appendHtml(root, `<div class="panel-popup-head"><div class="panel-popup-title">剧情回顾</div><button class="panel-popup-close" id="panelClose" type="button">&times;</button></div><section class="chronicle-reader-list"><div class="chronicle-reader-tools"><button data-chronicle-filter="today" type="button">今天</button><div class="chronicle-date-anchor"><button data-chronicle-action="pick-date" type="button">选择日期</button><aside class="chronicle-date-popover" data-chronicle-calendar hidden><header><button data-chronicle-calendar-nav="prev" type="button" aria-label="上个月">‹</button><b data-chronicle-calendar-title></b><button data-chronicle-calendar-nav="next" type="button" aria-label="下个月">›</button></header><div class="chronicle-calendar-week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div><div class="chronicle-calendar-days" data-chronicle-calendar-days></div></aside></div>${isLedgerTakeover() ? (ledgerSupportsSummaryMerge() ? '<button data-chronicle-action="ledger-merge" type="button">去台账合并</button>' : '') : '<button data-chronicle-action="merge" type="button">合并</button>'}<button data-chronicle-action="search-all" type="button" hidden>搜索全部历史</button></div><div class="chronicle-stale" data-chronicle-stale hidden>纪要数据已更新 <button data-chronicle-action="refresh" type="button">刷新当前列表</button></div><form class="chronicle-search" data-chronicle-search-form><span>搜索已加载纪要</span><input data-chronicle-search placeholder="标题、正文或对话"><button data-chronicle-search-submit type="submit">搜索</button></form><div class="chronicle-load-status" data-chronicle-status></div><div class="chronicle-reader-items" data-chronicle-items></div><button class="chronicle-reader-sentinel" data-chronicle-action="more" type="button">加载更早的纪要</button></section><section class="chronicle-reader-detail" data-chronicle-detail hidden><button data-chronicle-back type="button">← 返回列表</button><div data-chronicle-detail-content></div></section>`);
  overlay.replaceChildren(root);
  const list = root.querySelector<HTMLElement>('.chronicle-reader-list');
  const detail = root.querySelector<HTMLElement>('[data-chronicle-detail]');
  const detailContent = root.querySelector<HTMLElement>('[data-chronicle-detail-content]');
  const itemsRoot = root.querySelector<HTMLElement>('[data-chronicle-items]');
  const statusRoot = root.querySelector<HTMLElement>('[data-chronicle-status]');
  const staleRoot = root.querySelector<HTMLElement>('[data-chronicle-stale]');
  const moreButton = root.querySelector<HTMLButtonElement>('[data-chronicle-action="more"]');
  const historyButton = root.querySelector<HTMLButtonElement>('[data-chronicle-action="search-all"]');
  const calendarPopover = root.querySelector<HTMLElement>('[data-chronicle-calendar]');
  const calendarTitle = root.querySelector<HTMLElement>('[data-chronicle-calendar-title]');
  const calendarDays = root.querySelector<HTMLElement>('[data-chronicle-calendar-days]');
  if (!list || !detail || !detailContent || !itemsRoot || !statusRoot || !staleRoot || !moreButton || !historyButton || !calendarPopover || !calendarTitle || !calendarDays) return;

  const visibleItems = (): ChronicleRowRef[] => {
    const rows = allHistoryResults || controller.getLoaded();
    if (!searchText) return rows;
    return rows.filter(item => `${item.summary}\n${item.chronicleText}\n${item.keyDialogue}`.includes(searchText));
  };
  const updateStatus = (): void => {
    // F84：状态行结构化（主词 + 命中芯片；逐次读取条数的固定文案按拍板整体删除）
    statusRoot.innerHTML = `<span class="cr-status-main">${escapeHtml(dateKey ? `筛选日期：${dateKey}` : '最新剧情回顾')}</span>`
      + (searchText ? `<span class="cr-chip">命中 <b>${visibleItems().length}</b>${allHistoryResults ? '（全部历史）' : ''}</span>` : '');
    staleRoot.hidden = !stale;
    moreButton.hidden = !hasNext || !!allHistoryResults;
    historyButton.hidden = !searchText;
    historyButton.disabled = searchingHistory;
    historyButton.textContent = searchingHistory ? '正在搜索全部历史…' : '搜索全部历史';
  };
  const appendTimelineEntries = (rows: ChronicleRowRef[]): void => {
    const template = document.createElement('template');
    template.innerHTML = rows.map(item => buildTimelineEntry(item, peopleSet)).join('');
    itemsRoot.append(template.content);
  };
  const refreshItems = (resetScroll = false): void => {
    itemsRoot.replaceChildren();
    const rows = visibleItems();
    if (rows.length) appendTimelineEntries(rows);
    else appendHtml(itemsRoot, '<div class="panel-empty">暂无匹配纪要</div>');
    if (resetScroll) list.scrollTop = 0;
    updateStatus();
  };
  const appendLoadedItems = (rows: ChronicleRowRef[]): void => {
    if (!rows.length || allHistoryResults || searchText) { refreshItems(); return; }
    const empty = itemsRoot.querySelector('.panel-empty');
    empty?.remove();
    appendTimelineEntries(rows);
    updateStatus();
  };
  const submitSearch = (): void => {
    searchAbort?.abort();
    searchingHistory = false;
    allHistoryResults = null;
    searchText = searchDraft.trim();
    refreshItems(true);
  };
  const monthKey = (y: number, m: number): string => `${y}-${m}`;
  const applyCalendarMarks = (): void => {
    const cached = calendarChronicleCache.get(monthKey(calendar.year, calendar.month));
    calendarDays.querySelectorAll<HTMLElement>('button[data-chronicle-calendar-day]').forEach(btn => {
      btn.classList.toggle('has-chronicle', !!cached?.has(btn.dataset.chronicleCalendarDay || ''));
    });
  };
  const refreshCalendarMarks = async (): Promise<void> => {
    const token = ++calendarChronicleToken;
    const key = monthKey(calendar.year, calendar.month);
    const days = await listChronicleDatesInMonth(calendar.year, calendar.month, createDefaultChronicleReaderSource([], []));
    if (calendarChronicleToken !== token) return;
    calendarChronicleCache.set(key, days);
    if (monthKey(calendar.year, calendar.month) === key) applyCalendarMarks();
  };
  const updateCalendar = (): void => {
    calendarTitle.textContent = `${calendar.year} 年 ${calendar.month} 月`;
    calendarDays.replaceChildren();
    // F3：chronicleMonthGrid 全程 UTC+setFullYear——new Date(3,…) 会把短纪年解释成 1903 年
    const { firstDay, count } = chronicleMonthGrid(calendar.year, calendar.month);
    for (let blank = 0; blank < firstDay; blank += 1) { const spacer = document.createElement('span'); spacer.className = 'is-blank'; calendarDays.append(spacer); }
    for (let day = 1; day <= count; day += 1) {
      const button = document.createElement('button');
      const key = dateKeyFor(calendar.year, calendar.month, day);
      button.type = 'button'; button.dataset.chronicleCalendarDay = key; button.textContent = String(day);
      if (key === dateKey) button.classList.add('is-selected');
      calendarDays.append(button);
    }
    applyCalendarMarks();
  };
  const changeMonth = (delta: number): void => {
    // F3：手算年月进退——Date 对象路径对短纪年翻月会读回 1900+ 年
    let year = calendar.year; let month = calendar.month + delta;
    if (month < 1) { month = 12; year -= 1; } else if (month > 12) { month = 1; year += 1; }
    calendar = { year, month };
    updateCalendar();
    void refreshCalendarMarks();
  };
  const configureObserver = (): void => {
    observer?.disconnect();
    if (typeof IntersectionObserver === 'undefined') return;
    observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void load(false); }, { root: list, rootMargin: '180px' });
    observer.observe(moreButton);
  };
  const load = async (reset = false): Promise<void> => {
    if (loading) return;
    loading = true; moreButton.disabled = true;
    const beforeCount = controller.getLoaded().length;
    const result = reset ? (allHistoryResults = null, await controller.reset(dateKey)) : await controller.loadNext();
    hasNext = result.hasNext;
    if (reset) { stale = false; refreshItems(true); }
    else appendLoadedItems(controller.getLoaded().slice(beforeCount));
    loading = false; moreButton.disabled = false; updateStatus();
  };
  const selectCalendarDate = async (key: string): Promise<void> => {
    dateKey = key;
    calendar = dateFromKey(dateKey || getTodayDateKey() || '') || { year: 1, month: 1 };
    calendarPopover.hidden = true;
    updateCalendar();
    await load(true);
  };
  const showDetail = (item: ChronicleRowRef): void => {
    listScrollTop = list.scrollTop;
    detailContent.replaceChildren();
    // F84：详情头部时间串拆「日期 + 时段」双芯片（原 <small> 裸串退役）
    const timeParts = (item.timeSpan || '').trim().split(/\s+/);
    const tsDate = timeParts.shift() || '';
    const tsRange = timeParts.join(' ');
    const timeChips = (tsDate || tsRange)
      ? `<div class="cr-timechips">${tsDate ? `<span class="cr-chip">${escapeHtml(tsDate)}</span>` : ''}${tsRange ? `<span class="cr-chip dim">${escapeHtml(tsRange)}</span>` : ''}</div>`
      : '';
    appendHtml(detailContent, `${timeChips}<h3>${escapeHtml(item.summary || '未命名纪要')}</h3><div>${tagHtml(item)}</div><section class="chronicle-detail-text"><h4>纪要</h4><p>${escapeHtml(item.chronicleText || '暂无纪要')}</p></section>${item.keyDialogue ? `<section class="chronicle-detail-dialogue"><h4>重要对话</h4>${dialogueHtml(item.keyDialogue, peopleSet, false)}</section>` : ''}`);
    list.hidden = true; detail.hidden = false;
  };
  const showList = (): void => { detail.hidden = true; list.hidden = false; detailContent.replaceChildren(); list.scrollTop = listScrollTop; };
  const onChronicleDataUpdated = (): void => { stale = true; calendarChronicleCache.clear(); updateStatus(); if (!calendarPopover.hidden) void refreshCalendarMarks(); };
  let handoffListScroll = 0;
  let handoffDetailScroll = 0;
  const restoreReader = (): void => {
    handoffPending = false;
    overlay.onclick = null; overlay.oninput = null; overlay.onsubmit = null;
    overlay.replaceChildren(root);
    markPopupShown();
    overlay.classList.add('show');
    overlay.addEventListener('click', onOverlayClick);
    takeoverObserver.observe(overlay, { childList: true });
    list.scrollTop = handoffListScroll;
    detail.scrollTop = handoffDetailScroll;
  };
  const handoffToHub = (name?: string): void => {
    if (!(window as any).__ub_showCharacterHub) return;
    handoffPending = true;
    handoffListScroll = list.scrollTop; handoffDetailScroll = detail.scrollTop;
    overlay.removeEventListener('click', onOverlayClick);
    setPopupReturnTo(restoreReader);
    (window as any).__ub_showCharacterHub(name);
  };
  const handoffToMap = async (name?: string): Promise<void> => {
    if (!(window as any).__ub_showMapForLocation) return;
    handoffPending = true;
    handoffListScroll = list.scrollTop; handoffDetailScroll = detail.scrollTop;
    overlay.removeEventListener('click', onOverlayClick);
    setPopupReturnTo(restoreReader);
    const res = await (window as any).__ub_showMapForLocation(name);
    if (overlay.contains(root)) {
      // 子窗未真正打开（如地图未生成）：恢复阅读器监听，避免悬空无响应
      handoffPending = false;
      setPopupReturnTo(null);
      overlay.addEventListener('click', onOverlayClick);
      if (res && !res.ok && res.reason) getToastr()?.info(res.reason, '地图提示');
    }
  };
  // F2（弹窗接管泄漏）：常驻 #panelOverlay 被其它弹窗直接重写 innerHTML（如阅读器开着时点
  // 物品/任务/备忘按钮，index.ts 直呼 showItemPopup 一族不走 closeActivePopup）时，本弹窗
  // 没有任何「打招呼」路径——IntersectionObserver、window 级 ub-chronicle-data-updated 监听
  // 与 overlay 点击监听会残留，且可随每次接管叠加。这里以 childList 观察器兜底：root 被移出
  // overlay 即就地 dispose（与自身关闭同一条清理链，幂等）；子窗往返（handoffPending）除外。
  const takeoverObserver = new MutationObserver(() => {
    if (overlay.contains(root) || handoffPending) return;
    takeoverObserver.disconnect();
    dispose();
  });
  const dispose = (): void => { observer?.disconnect(); searchAbort?.abort(); overlay.removeEventListener('click', onOverlayClick); window.removeEventListener(UB_EVENT.chronicleDataUpdated, onChronicleDataUpdated); takeoverObserver.disconnect(); setPopupReturnTo(null); };
  const closeReader = (): void => { dispose(); if (onClosed) onClosed(); else closePanelOverlay(overlay); };
  const onOverlayClick = (event: MouseEvent): void => {
    if (event.target === overlay && !guardGhostClick()) closeReader();
  };
  window.addEventListener(UB_EVENT.chronicleDataUpdated, onChronicleDataUpdated);
  takeoverObserver.observe(overlay, { childList: true });
  updateCalendar(); updateStatus(); configureObserver(); void load(true);
  markPopupShown(); overlay.classList.add('show');

  overlay.onclick = null;
  overlay.oninput = null;
  overlay.onsubmit = null;
  overlay.addEventListener('click', onOverlayClick);
  root.addEventListener('click', async event => {
    const target = event.target as HTMLElement;
    if (target.closest('#panelClose')) { if (!guardGhostClick()) closeReader(); return; }
    const speaker = target.closest<HTMLElement>('[data-chronicle-speaker]');
    if (speaker) { handoffToHub(speaker.dataset.chronicleSpeaker); return; }
    const tag = target.closest<HTMLElement>('[data-chronicle-tag]');
    if (tag?.dataset.chronicleTag === 'person') { handoffToHub(tag.dataset.chronicleName); return; }
    if (tag?.dataset.chronicleTag === 'location') { void handoffToMap(tag.dataset.chronicleName); return; }
    const open = target.closest<HTMLElement>('[data-chronicle-open]');
    if (open) { const item = visibleItems().find(row => row.rowId === Number(open.dataset.chronicleOpen)) || controller.getCachedDetail(Number(open.dataset.chronicleOpen)); if (item) showDetail(item); return; }
    if (target.closest('[data-chronicle-back]')) { showList(); return; }
    if (target.closest('[data-chronicle-filter="today"]')) { await selectCalendarDate(getTodayDateKey() || ''); return; }
    if (target.closest('[data-chronicle-action="pick-date"]')) { calendarPopover.hidden = !calendarPopover.hidden; if (!calendarPopover.hidden) { updateCalendar(); if (!calendarChronicleCache.has(monthKey(calendar.year, calendar.month))) void refreshCalendarMarks(); } return; }
    const day = target.closest<HTMLElement>('[data-chronicle-calendar-day]');
    if (day) { await selectCalendarDate(day.dataset.chronicleCalendarDay || ''); return; }
    const nav = target.closest<HTMLElement>('[data-chronicle-calendar-nav]');
    if (nav) { changeMonth(nav.dataset.chronicleCalendarNav === 'prev' ? -1 : 1); return; }
    if (target.closest('[data-chronicle-action="refresh"]')) { await load(true); return; }
    if (target.closest('[data-chronicle-action="search-all"]')) {
      searchAbort?.abort(); searchAbort = new AbortController(); searchingHistory = true; updateStatus();
      const results = await controller.searchAll(searchText, searchAbort.signal);
      if (!searchAbort.signal.aborted) { allHistoryResults = results; searchingHistory = false; refreshItems(true); }
      return;
    }
    // [LEGACY-MERGE · DB-ONLY] 台账接管：只跳到台账「纪要合并」标签，不执行状态栏合并。
    if (target.closest('[data-chronicle-action="ledger-merge"]')) {
      dispose();
      openLedgerWorkbench('merge');
      return;
    }
    if (target.closest('[data-chronicle-action="merge"]')) {
      if (isLedgerTakeover()) { dispose(); openLedgerWorkbench('merge'); return; }
      dispose();
      openChronicleMerge();
      return;
    }
    if (target.closest('[data-chronicle-action="more"]')) { await load(false); return; }
  });
  root.addEventListener('input', event => {
    const input = event.target as HTMLInputElement;
    if (input.matches('[data-chronicle-search]')) searchDraft = input.value;
  });
  root.addEventListener('submit', event => {
    const form = event.target as HTMLFormElement;
    if (!form.matches('[data-chronicle-search-form]')) return;
    event.preventDefault();
    submitSearch();
  });
}
