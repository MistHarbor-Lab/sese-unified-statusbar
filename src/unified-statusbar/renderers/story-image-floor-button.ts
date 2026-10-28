// ===== 正文插图：楼层「重新生成插图」按钮 =====
// 参照 AI润色扩展的楼层按钮模式：每条 AI 楼层注入两枚按钮——
//   顶部：.mes_buttons 内（.mes_edit 之前；该组为 flex 自动排开，不与其他按钮重叠）；
//   底部：.swipeRightBlock 之前 absolute 贴楼层右下（AI润色 bottom 同模式）。
// 重叠避让：AI润色底部按钮固定占 right:72px（基准 .mes relative），检测到它时本按钮
//   错开到 right:96px；且每次 refresh 重算（两个插件的 MutationObserver 注入有先后竞态，
//   后触发的一方会把先注入的一方修正到正确位置）。
// 用户/系统楼层不注入：酒馆模板里 is_user/is_system 是 .mes 的 **attribute**（非 class）。
// 楼层 DOM 在宿主页（脚本跑在 TavernHelper iframe 内），统一经 window.parent.document 访问；
// 按钮 CSS 在 iframe 注入的样式表够不到宿主页，底部按钮样式走内联 style。
import { getConfig } from '../core/config-store';
import { regenerateStoryImagesForMessage } from '../core/story-image-engine';

const BUTTON_CLASS = 'ub-story-regen-button';
const BOTTOM_CLASS = 'ub-story-regen-button-bottom';
const POLISHER_BOTTOM_CLASS = 'ai-polisher-floor-button-bottom'; // AI润色底部按钮（占 right:72px）
let _observer: MutationObserver | null = null;
let _docClick: ((e: Event) => void) | null = null;
// O8：流式输出期间 #chat 每秒变化几十次，旧实现「任何 addedNodes → rAF 全楼扫描」
// ≈每秒 12 万次 DOM 查询且与 AI 输出抢主线程。改为 trailing 防抖 + 最大等待 +
// 增量（只重刷本轮变化涉及的楼层；楼层增删/变化过多/目标脱离文档树时退全量）。
const REFRESH_DEBOUNCE_MS = 200;
const REFRESH_MAX_WAIT_MS = 600;
const INCREMENTAL_MAX_FLOORS = 24;
let _refreshTimer: ReturnType<typeof setTimeout> | null = null;
let _maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingRefresh: { full: boolean; floors: Set<HTMLElement> } | null = null;

/** F4：整组宿主监听（#chat observer + document 捕获 click）的统一拆卸。
 *  清单挂在 window 上——模块重求值时新副本 init 先调旧 teardown，杜绝 observer 叠加
 *  （旧实现观察器无任何停止路径，重求值后每个 childList 变化驱动两份刷新）。 */
export function stopStoryImageFloorButton(): void {
  const w = window as any;
  if (typeof w.__ub_sifb_teardown === 'function') {
    try { w.__ub_sifb_teardown(); } catch (_e) { /* ignore */ }
  }
}

function hostDocument(): Document | null {
  try { return (window.parent as any).document || document; } catch (_e) { return document; }
}

/** AI 楼层判定：mesid 为整数且 is_user/is_system 属性均非 "true"（酒馆模板契约）。 */
function isAiFloor(node: HTMLElement): boolean {
  const mesId = Number(node.getAttribute('mesid'));
  if (!Number.isInteger(mesId)) return false;
  if (node.getAttribute('is_user') === 'true' || node.getAttribute('is_system') === 'true') return false;
  return true;
}

/** 底部按钮横向位置：AI润色底部按钮在时让位到其左侧（其余场景回到缺省 72px）。 */
function applyBottomPosition(btn: HTMLElement, floor: HTMLElement): void {
  btn.style.right = floor.querySelector('.' + POLISHER_BOTTOM_CLASS) ? '96px' : '72px';
}

function createButton(mesId: number, doc: Document, location: 'top' | 'bottom'): HTMLDivElement {
  const btn = doc.createElement('div');
  if (location === 'top') {
    btn.className = `mes_button ${BUTTON_CLASS} fa-solid fa-images interactable`;
  } else {
    btn.className = `${BUTTON_CLASS} ${BOTTOM_CLASS} fa-solid fa-images interactable`;
    // AI润色 bottom 同模式（楼层右下、避开 swipe 区）+ 常显半透明；样式内联（宿主页无本插件样式表）
    btn.style.position = 'absolute';
    btn.style.bottom = '6px';
    btn.style.zIndex = '10';
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.opacity = '.48';
    btn.style.cursor = 'pointer';
    btn.style.transition = 'opacity .18s ease, transform .18s ease';
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; btn.style.transform = 'scale(1.08)'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '.48'; btn.style.transform = 'none'; });
  }
  btn.dataset.messageId = String(mesId);
  btn.dataset.location = location;
  btn.title = '重新生成插图';
  btn.tabIndex = 0;
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', `重新生成第 ${mesId} 楼的正文插图`);
  return btn;
}

/** 按当前开关状态刷新给定楼层按钮：开启→AI 楼层注入顶部+底部两枚；关闭→移除。 */
function refreshFloors(nodes: HTMLElement[]): void {
  const doc = hostDocument();
  if (!doc) return;
  const enabled = getConfig().storyImageEnabled === true;
  for (const node of nodes) {
    const existing = node.querySelectorAll(`.${BUTTON_CLASS}`);
    const eligible = enabled && isAiFloor(node);
    if (!eligible) {
      if (existing.length) existing.forEach((b) => b.remove());
      continue;
    }
    if (existing.length >= 2) {
      // 两枚齐备：仍要更新底部位置（润色按钮可能在本按钮注入后才出现，需让位避重叠）
      const bottomBtn = node.querySelector<HTMLElement>(`.${BOTTOM_CLASS}`);
      if (bottomBtn) applyBottomPosition(bottomBtn, node);
      continue;
    }
    existing.forEach((b) => b.remove()); // 残缺（缺顶部或底部）时重注入两枚
    const mesId = Number(node.getAttribute('mesid'));
    const area = node.querySelector<HTMLElement>('.mes_buttons');
    if (area) {
      const topBtn = createButton(mesId, doc, 'top');
      const editBtn = area.querySelector('.mes_edit');
      if (editBtn) area.insertBefore(topBtn, editBtn);
      else area.appendChild(topBtn);
    }
    const bottomBtn = createButton(mesId, doc, 'bottom');
    applyBottomPosition(bottomBtn, node);
    const swipeBlock = node.querySelector<HTMLElement>('.swipeRightBlock');
    if (swipeBlock?.parentNode) swipeBlock.parentNode.insertBefore(bottomBtn, swipeBlock);
    else (node.querySelector<HTMLElement>('.mes_block') || node).appendChild(bottomBtn);
  }
}

/** 按当前开关状态刷新全部楼层按钮：开启→AI 楼层注入顶部+底部两枚；关闭→全部移除。 */
export function refreshStoryImageFloorButtons(): void {
  const doc = hostDocument();
  if (!doc) return;
  refreshFloors(Array.from(doc.querySelectorAll<HTMLElement>('#chat > .mes[mesid]')));
}

/** O8：从本轮 MutationRecord 收集受影响楼层。楼层增删（#chat 直接子层）或目标/新增节点
 *  已不在文档树（closest 取不到楼层）时置 full——增量定位不了，退全量兜底。 */
function collectPendingFloors(records: MutationRecord[], pending: { full: boolean; floors: Set<HTMLElement> }): void {
  const chat = hostDocument()?.getElementById('chat') || null;
  for (const record of records) {
    if (pending.full) return;
    if (!record.addedNodes.length) continue;
    const parent = record.target as HTMLElement | null;
    if (!parent || parent === chat || typeof parent.closest !== 'function') { pending.full = true; return; }
    const floor = parent.closest('.mes');
    if (!floor) { pending.full = true; return; }
    pending.floors.add(floor as HTMLElement);
    for (const node of Array.from(record.addedNodes)) {
      const el = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
      const nodeFloor = el && typeof el.closest === 'function' ? el.closest('.mes') : null;
      if (!nodeFloor) { pending.full = true; return; }
      pending.floors.add(nodeFloor as HTMLElement);
    }
  }
}

function runFloorRefresh(): void {
  if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
  if (_maxWaitTimer) { clearTimeout(_maxWaitTimer); _maxWaitTimer = null; }
  const pending = _pendingRefresh;
  _pendingRefresh = null;
  if (pending && !pending.full && pending.floors.size > 0 && pending.floors.size <= INCREMENTAL_MAX_FLOORS) {
    refreshFloors(Array.from(pending.floors));
  } else {
    refreshStoryImageFloorButtons(); // 无增量信息/楼层增删/积压过多 → 全量兜底
  }
}

function scheduleFloorRefresh(records: MutationRecord[]): void {
  if (!_pendingRefresh) {
    _pendingRefresh = { full: false, floors: new Set() };
    // 最大等待：持续流式无停顿也不会让按钮晚于 600ms 出现
    _maxWaitTimer = setTimeout(runFloorRefresh, REFRESH_MAX_WAIT_MS);
  }
  collectPendingFloors(records, _pendingRefresh);
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(runFloorRefresh, REFRESH_DEBOUNCE_MS);
}

/** 装载（幂等；doInitRender 每次调用）：刷新一次 + 监听楼层 DOM 变化 + 绑定点击。 */
export function initStoryImageFloorButton(): void {
  const doc = hostDocument();
  if (!doc) return;
  const w = window as any;
  // F4：模块重求值 → 先拆旧副本的整组监听再重绑（旧副本闭包引用已废模块态）
  if (typeof w.__ub_sifb_teardown === 'function') {
    try { w.__ub_sifb_teardown(); } catch (_e) { /* ignore */ }
  }
  refreshStoryImageFloorButtons();
  _docClick = (e: Event) => {
    const btn = (e.target as HTMLElement | null)?.closest?.(`.${BUTTON_CLASS}`) as HTMLElement | null;
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const mesId = Number(btn.dataset.messageId);
    if (Number.isInteger(mesId)) void regenerateStoryImagesForMessage(mesId);
  };
  doc.addEventListener('click', _docClick, true);
  const chat = doc.getElementById('chat');
  if (!chat) {
    w.__ub_sifb_teardown = () => {
      if (_docClick) { doc.removeEventListener('click', _docClick, true); _docClick = null; }
      w.__ub_sifb_teardown = null;
    };
    return;
  }
  _observer = new MutationObserver((records) => {
    if (records.some((r) => r.addedNodes.length > 0)) {
      scheduleFloorRefresh(records);
    }
  });
  _observer.observe(chat, { childList: true, subtree: true });
  w.__ub_sifb_teardown = () => {
    if (_observer) { _observer.disconnect(); _observer = null; }
    if (_docClick) { doc.removeEventListener('click', _docClick, true); _docClick = null; }
    // O8：待刷队列与双计时器一并清掉（防抖/最大等待回调不得在拆卸后触发）
    if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
    if (_maxWaitTimer) { clearTimeout(_maxWaitTimer); _maxWaitTimer = null; }
    _pendingRefresh = null;
    w.__ub_sifb_teardown = null;
  };
}
