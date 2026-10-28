// ===== 悬浮 chrome（提案三 S1 拆分，2026-09-15）=====
// 自 index.ts 原样迁出：持久化设置按钮 / 固定模式展开折叠按钮（含拖拽）/ 折叠下拉菜单 /
// 选项栏独立弹窗 / 首次加载引导。本模块禁止 import index.ts——index 局部能力
// （render/弹窗编排等）经 initFloatingChrome 注入；core/renderers/panels 既有模块直接 import。
import { readStoryClockRaw } from '../core/calendar-core';
import { getConfig, _lsGet, _lsSet } from '../core/config-store';
import { ensureStyleOnce } from '../renderers/style-once';
import { ubIcon } from '../core/icons';
import { escapeHtml, escapeAttr } from '../core/html-escape';
import { getCellByHeader } from '../core/data-manager';
import { bindFloatingDrag, dragJustEnded, readSavedPos, applyClampedPosition } from './floating-drag';
import { listCurrentChatAiActivities } from '../core/ai-activity';
import { syncDarkClass, syncDarkClassMinimal } from '../renderers/html-builder';
import { showConfigPanel } from '../panels/config-panel';
import { showMapPopup } from '../renderers/map-panel';
import { showSkillPopup } from '../renderers/skill-popup';
import { showItemPopup, showMissionPopup, showDatabasePopup } from '../renderers/popup-manager';
import { showMemoPopup } from '../renderers/popup-manager';
import { showCalendarPopup } from '../renderers/calendar-popup';
import type { StyleType } from '../core/constants';

/** index.ts 注入的局部能力（双向解耦：chrome 不反向依赖入口文件）。 */
export interface FloatingChromeDeps {
  render(): void;
  showPopupOrToggle(popupId: string, opener: () => void): void;
  handleOptionItemClick(el: HTMLElement): void;
  ensureOverlaysInBody(): void;
  updateWrapperStyle(): void;
  openWardrobePanel(style: StyleType): Promise<void>;
}

let deps: FloatingChromeDeps;

/** 注入 index 局部依赖；须在任一 chrome 函数被调用前执行（index 模块顶层调用，函数声明有提升）。 */
export function initFloatingChrome(theDeps: FloatingChromeDeps): void {
  deps = theDeps;
}

// ===== 持久化设置按钮（放在消息窗口右边缘，确保移动端可见） =====
// 齿轮尺寸常量：拖拽钳制/恢复/重置三处共用（cssText 与之一致，改动须同步）
const GEAR_SIZE = 44;
const GEAR_POS_KEY = 'statusbar-gear-pos';

export function createPersistentSettingsBtn(): void {
  if (document.getElementById('ac-persistent-settings')) return;
  const btn = document.createElement('button');
  btn.id = 'ac-persistent-settings';
  btn.innerHTML = ubIcon('gear', 'ub-persist-gear');
  btn.title = '状态栏设置';
  btn.type = 'button';
  const initTop = window.innerWidth <= 600 ? '60px' : '8px';
  // touch-action:none + user-select:none：pointer 拖拽前置条件（小手机悬浮球同款）；
  // transition 只保留颜色反馈——left/top 若进 transition，拖拽会拖出 0.2s 的「追赶」延迟
  btn.style.cssText = 'position:fixed;z-index:99999;top:' + initTop + ';left:8px;width:44px;height:44px;border-radius:50%;border:1px solid rgba(128,128,128,0.3);background:rgba(30,30,30,0.85);color:#ccc;font-size:22px;cursor:grab;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,0.3);transition:background 0.2s,color 0.2s;line-height:1;touch-action:none;user-select:none;-webkit-tap-highlight-color:transparent;';
  btn.onmouseenter = function() { btn.style.background = 'rgba(60,60,60,0.9)'; btn.style.color = '#fff'; };
  btn.onmouseleave = function() { btn.style.background = 'rgba(30,30,30,0.85)'; btn.style.color = '#ccc'; };
  btn.onclick = function(e) {
    if (dragJustEnded()) return; // 拖完的残留 click 不算点击
    e.stopPropagation();
    deps.showPopupOrToggle('settings', () => showConfigPanel(getConfig().style));
  };
  document.body.appendChild(btn);
  // 恢复拖拽存档（经视口钳制——旧 loader 恢复路径无钳制，窗口缩小/缩放变化后齿轮会停在视口外且无恢复出口）
  const savedGearPos = readSavedPos(GEAR_POS_KEY);
  if (savedGearPos) applyClampedPosition(btn, savedGearPos.x, savedGearPos.y, GEAR_SIZE, GEAR_SIZE);
  // 拖拽绑定在创建处完成（小手机同款：元素由本模块创建，监听随元素生死），loader 不再代绑
  bindFloatingDrag(btn, btn, GEAR_POS_KEY, () => GEAR_SIZE, () => GEAR_SIZE, {
    onDragStart() { btn.style.cursor = 'grabbing'; },
    onDragEnd() { btn.style.cursor = 'grab'; },
  });
  updateFloatingBtnVisibility();
}

export function positionSettingsBtn(): void {
  const btn = document.getElementById('ac-persistent-settings');
  if (!btn) return;
  // 移动端布局修正（applyMobileFixes）触发的重定位：尊重拖拽存档并钳制保证可见。
  // 旧实现无条件重置 8/60，与拖拽落盘互相覆盖=「手机上拖完位置记不住」的根因；
  // 无存档时回退安全默认位（手机上方留 60px 避开浏览器地址栏；其他 8px）。
  const savedGearPos = readSavedPos(GEAR_POS_KEY);
  if (savedGearPos) {
    applyClampedPosition(btn, savedGearPos.x, savedGearPos.y, GEAR_SIZE, GEAR_SIZE);
  } else {
    const isPhone = window.innerWidth <= 600;
    applyClampedPosition(btn, 8, isPhone ? 60 : 8, GEAR_SIZE, GEAR_SIZE);
  }
  btn.style.position = 'fixed';
}

export function updateFloatingBtnVisibility(): void {
  const ps = document.getElementById('ac-persistent-settings');
  if (!ps) return;
  const config = getConfig();
  ps.style.display = config.showFloatingBtn ? '' : 'none';
}

// ===== 固定模式展开/折叠按钮 =====
// 固定模式展开/折叠按钮 — 拖拽状态（_ftDrag 供 updateFixedToggleBtn 拖拽期跳过重定位/签名早退）
let _ftDrag = false;
let _ftBtnCreated = false;
let _ftLastSig = '';
const FT_PLUS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12h13M12 5.5v13" fill="none" stroke="currentColor" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FT_MINUS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12h13" fill="none" stroke="currentColor" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FT_MENU_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="1.65"/><circle cx="16" cy="8" r="1.65"/><circle cx="8" cy="16" r="1.65"/><circle cx="16" cy="16" r="1.65"/></svg>';

export function createFixedToggleBtn(): void {
  // 防止重复创建导致 document 级被动监听器累积（移动端滚动冻结的原因之一）
  if (_ftBtnCreated) return;
  _ftBtnCreated = true;
  const btn = document.createElement('button');
  btn.id = 'ac-fixed-toggle';
  btn.innerHTML = FT_PLUS_ICON;
  btn.title = '展开状态栏';
  btn.setAttribute('aria-label', '展开状态栏');
  btn.type = 'button';
  const isPhone = window.innerWidth <= 600;
  btn.style.cssText = 'position:fixed;z-index:100000;'
    + (isPhone ? 'width:40px;height:40px;' : 'width:36px;height:36px;')
    + 'border-radius:50%;font-size:14px;cursor:grab;display:none;align-items:center;justify-content:center;line-height:1;padding:0;user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent;';

  // ===== 拖拽（chrome/floating-drag：与小手机 bindDrag 同一实现——pointer 单轨 +
  //       移动/落盘/恢复三点视口钳制 + 时间戳吞拖后 click；宽高惰性取值适配模式换形） =====
  bindFloatingDrag(btn, btn, 'statusbar-fixed-btn-pos',
    () => btn.offsetWidth || 36,
    () => btn.offsetHeight || 36,
    {
      onDragStart() { _ftDrag = true; btn.style.cursor = 'grabbing'; },
      onDragEnd() { _ftDrag = false; btn.style.cursor = 'grab'; },
    });

  // 点击事件：根据当前样式分发行为（拖完 600ms 内的残留 click 不算点击）
  btn.addEventListener('click', function(e: MouseEvent) {
    if (dragJustEnded()) return;
    e.stopPropagation();
    const cfg = getConfig();
    if (cfg.collapseBtnStyle === 'menu' || cfg.collapseBtnStyle === 'time-window-menu') {
      toggleCollapseMenu();
    } else {
      toggleFixedExpand();
    }
  });

  document.body.appendChild(btn);

  // 创建菜单下拉面板（始终创建，按需显示）
  createCollapseMenu();
}

// ===== 菜单模式：下拉菜单 =====
let _menuOpen = false;
let _menuDocClickBound = false;

/** 在 panelOverlay 中显示独立选项栏弹窗 */
export function showOptionsBarPopup(): void {
  deps.ensureOverlaysInBody();
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;

  const config = getConfig();
  const style = config.style;
  const items = (window as any).__ub_getOptionBarItems ? (window as any).__ub_getOptionBarItems() : [];
  const NUMBER_LABELS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

  let headerLabel: string;
  switch (style) {
    case 'ancient': headerLabel = '妙计锦囊'; break;
    case 'flirtatious': headerLabel = '心动选项'; break;
    case 'minimal': headerLabel = 'OPTIONS'; break;
    case 'sweet': headerLabel = '甜蜜选择'; break;
    case 'xianxia': headerLabel = '天机抉择'; break;
    case 'bridge': headerLabel = '指令选项'; break;
    case 'ios': headerLabel = '接下来的选择'; break;
    default: headerLabel = '选项栏';

  }

  const isBridge = style === 'bridge';
  let html = '<div class="panel-popup' + (isBridge ? ' bridge-window bridge-module-options' : '') + '">';
  html += '<div class="panel-popup-head"><div class="panel-popup-title">' + headerLabel + '</div><button class="panel-popup-close" id="panelClose">&times;</button></div>';
  html += '<div class="panel-popup-body">';

  if (!items || items.length === 0) {
    html += '<div class="panel-empty">暂无可用选项</div>';
  } else {
    html += '<div class="options-bar"><div class="options-bar-items">';
    items.forEach((item: any, idx: number) => {
      const numLabel = NUMBER_LABELS[idx] || String(idx + 1);
      html += '<button class="option-item" data-option-index="' + idx + '" data-option-text="' + escapeAttr(item.displayText) + '"><span class="option-number">' + numLabel + '</span><span class="option-text">' + escapeHtml(item.displayText) + '</span></button>';
    });
    html += '</div></div>';
  }

  html += '</div></div>';
  if (style === 'minimal') syncDarkClassMinimal(overlay);
  else syncDarkClass(overlay);
  overlay.innerHTML = html;
  overlay.classList.add('show');

  // 绑定关闭按钮
  const closeBtn = overlay.querySelector('#panelClose');
  if (closeBtn) closeBtn.addEventListener('click', () => overlay.classList.remove('show'));
  // 点击遮罩关闭
  overlay.onclick = function(e) {
    if (e.target === overlay) overlay.classList.remove('show');
  };
  // 绑定选项点击事件
  const optionItems = overlay.querySelectorAll('.option-item');
  optionItems.forEach(el => {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      deps.handleOptionItemClick(el as HTMLElement);
    });
  });
}

// 折叠菜单项定义（模块级，供事件委托按 data-idx 索引）
let _collapseMenuItems: { label: string; icon: string; key?: string; action: () => void }[] = [];

/** 判断菜单项在当前配置下是否应显示：功能关闭则菜单中也不显示该项 */
function _shouldShowCollapseMenuItem(item: { key?: string }): boolean {
  const cfg = getConfig();
  if (item.key === 'map' && !cfg.mapEnabled) return false;
  if (item.key === 'calendar' && !cfg.calendarEnabled) return false;
  if (item.key === 'optionsbar' && !cfg.optionsBarEnabled) return false;
  if (item.key === 'database' && !cfg.dbViewerEnabled) return false;
  if (item.key === 'skill' && !cfg.skillEnabled) return false;
  if (item.key === 'wardrobe' && !cfg.wardrobeEnabled) return false;
  return true;
}

/** 重建折叠菜单项列表与 DOM（按当前配置过滤掉功能已关闭的项）。
 *  开关变化是低频事件、菜单打开是高频事件，故在配置变更时重建，而非每次打开时重新生成。 */
export function refreshCollapseMenuItems(): void {
  _collapseMenuItems = [
    { label: '主界面', icon: ubIcon('home'), action: () => { toggleFixedExpand(); } },
    { label: '地图', icon: ubIcon('map'), key: 'map', action: () => { closeCollapseMenu(); deps.showPopupOrToggle('map', () => showMapPopup(getConfig().style)); } },
    { label: '日历', icon: ubIcon('calendar'), key: 'calendar', action: () => { closeCollapseMenu(); deps.showPopupOrToggle('calendar', () => showCalendarPopup(getConfig().style)); } },
    { label: '技能', icon: ubIcon('gem'), key: 'skill', action: () => { closeCollapseMenu(); deps.showPopupOrToggle('skill', () => showSkillPopup(getConfig().style)); } },
    { label: '物品', icon: ubIcon('pack'), action: () => { closeCollapseMenu(); deps.showPopupOrToggle('items', () => showItemPopup(getConfig().style)); } },
    { label: '衣柜', icon: ubIcon('dress'), key: 'wardrobe', action: () => { closeCollapseMenu(); deps.showPopupOrToggle('wardrobe', () => { void deps.openWardrobePanel(getConfig().style); }); } },
    { label: '任务', icon: ubIcon('clipboard'), action: () => { closeCollapseMenu(); deps.showPopupOrToggle('missions', () => showMissionPopup(getConfig().style)); } },
    { label: '备忘录', icon: ubIcon('memo'), action: () => { closeCollapseMenu(); deps.showPopupOrToggle('memo', () => showMemoPopup(getConfig().style)); } },
    { label: '选项栏', icon: ubIcon('sliders'), key: 'optionsbar', action: () => { closeCollapseMenu(); deps.showPopupOrToggle('optionsbar', () => showOptionsBarPopup()); } },
    { label: '数据库', icon: ubIcon('database'), key: 'database', action: () => { closeCollapseMenu(); deps.showPopupOrToggle('database', () => showDatabasePopup(getConfig().style)); } },
    { label: '设置', icon: ubIcon('gear'), action: () => { closeCollapseMenu(); deps.showPopupOrToggle('settings', () => showConfigPanel(getConfig().style)); } },
  ];

  const menu = document.getElementById('ac-collapse-menu');
  if (!menu) return;
  let html = '';
  for (let i = 0; i < _collapseMenuItems.length; i++) {
    const item = _collapseMenuItems[i];
    // 功能关闭时菜单中也不显示该项（地图/日历/技能/衣柜/选项栏/数据库）
    if (!_shouldShowCollapseMenuItem(item)) continue;
    // 样式/hover 全部走 CSS 类（内联 padding 曾压过 base.ts 移动端媒体查询致触屏高度不达标；
    // 内联 onmouseenter/leave 触屏无效且留粘滞态）
    html += '<div class="ac-collapse-menu-item" data-idx="' + i + '"' + (item.key ? ' data-key="' + item.key + '"' : '') + '>'
      + '<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;font-size:14px;line-height:1;">' + item.icon + '</span>'
      + '<span style="line-height:1;">' + item.label + '</span></div>';
  }
  menu.innerHTML = html;
}

function createCollapseMenu(): void {
  if (document.getElementById('ac-collapse-menu')) return;
  const menu = document.createElement('div');
  menu.id = 'ac-collapse-menu';
  menu.style.cssText = 'position:fixed;z-index:100002;display:none;'
    + 'background:rgba(30,30,30,0.92);border:1px solid rgba(128,128,128,0.3);'
    + 'border-radius:8px;padding:4px 0;min-width:140px;'
    + 'box-shadow:0 4px 20px rgba(0,0,0,0.4);'
    + 'font-size:13px;color:#ddd;user-select:none;'
    + 'font-family:inherit;';

  document.body.appendChild(menu);
  refreshCollapseMenuItems();

  // 绑定点击事件到菜单项（按 data-idx 取原始 items 下标，跳过隐藏项后仍映射正确）
  menu.addEventListener('click', function(e: MouseEvent) {
    e.stopPropagation();
    const itemEl = (e.target as HTMLElement).closest('.ac-collapse-menu-item');
    if (!itemEl) return;
    const idx = parseInt((itemEl as HTMLElement).dataset.idx || '-1', 10);
    if (idx >= 0 && idx < _collapseMenuItems.length) {
      _collapseMenuItems[idx].action();
    }
  });

  // 全局点击关闭菜单（只绑定一次）
  if (!_menuDocClickBound) {
    _menuDocClickBound = true;
    document.addEventListener('click', function(e: MouseEvent) {
      if (!_menuOpen) return;
      const target = e.target as HTMLElement;
      if (!target.closest('#ac-collapse-menu') && !target.closest('#ac-fixed-toggle')) {
        closeCollapseMenu();
      }
    });
  }
}

function toggleCollapseMenu(): void {
  if (_menuOpen) {
    closeCollapseMenu();
  } else {
    openCollapseMenu();
  }
}

function openCollapseMenu(): void {
  const btn = document.getElementById('ac-fixed-toggle');
  const menu = document.getElementById('ac-collapse-menu');
  if (!btn || !menu) return;

  _menuOpen = true;
  const r = btn.getBoundingClientRect();
  // 菜单定位在按钮下方
  menu.style.left = r.left + 'px';
  menu.style.top = (r.bottom + 6) + 'px';
  menu.style.display = '';

  // 如果菜单超出屏幕底部，改为向上弹出
  requestAnimationFrame(() => {
    const mr = menu.getBoundingClientRect();
    if (mr.bottom > window.innerHeight - 8) {
      menu.style.top = (r.top - mr.height - 6) + 'px';
    }
    // 如果菜单超出屏幕右侧
    if (mr.right > window.innerWidth - 8) {
      menu.style.left = (window.innerWidth - mr.width - 8) + 'px';
    }
    // 不低于左边界
    if (parseInt(menu.style.left) < 4) {
      menu.style.left = '4px';
    }
  });
}

export function closeCollapseMenu(): void {
  _menuOpen = false;
  const menu = document.getElementById('ac-collapse-menu');
  if (menu) menu.style.display = 'none';
}

/** 重置折叠按钮签名早退缓存（重注入/resize 等布局变化后强制刷新按钮）。 */
export function resetFixedToggleBtnSignature(): void {
  _ftLastSig = '';
}

/**
 * AI 活动动效：文字请求进行中时给展开/折叠按钮叠加呼吸（圆形）或扫光（时间窗药丸）。
 * 只切类名，颜色吃现有 --ub-ft-ring-*；不进入 _ftLastSig（按钮重建后由 doRender/reinject 重新贴类）。
 */
export function syncFixedToggleAi(): void {
  const btn = document.getElementById('ac-fixed-toggle');
  if (!btn) return;
  const active = listCurrentChatAiActivities().length > 0;
  const style = getConfig().collapseBtnStyle || 'time-window';
  const circular = style === 'minimal' || style === 'menu';
  btn.classList.toggle('ub-ft-ai-breath', active && circular);
  btn.classList.toggle('ub-ft-ai-sweep', active && !circular);
}

export function updateFixedToggleBtn(): void {
  const btn = document.getElementById('ac-fixed-toggle');
  if (!btn) return;

  const cfg = getConfig();
  const btnStyle = cfg.collapseBtnStyle || 'time-window';
  // 默认展开（首次加载或从未设置过时），仅当用户明确折叠后才会隐藏
  const rawExpanded = _lsGet('statusbar-fixed-expanded');
  const fixedExpanded = rawExpanded === null ? true : rawExpanded === 'true';
  const isPhone = window.innerWidth <= 600;
  const isTimeWindow = btnStyle === 'time-window' || btnStyle === 'time-window-menu';
  const currentTime = isTimeWindow ? (readStoryClockRaw()) : '';
  const currentLocation = isTimeWindow ? (getCellByHeader('全局数据表', 1, '当前详细地点') || '') : '';
  const savedPosSig = _ftDrag ? '' : (_lsGet('statusbar-fixed-btn-pos') || '');
  // 签名早退：状态未变时跳过 innerHTML 重建与 getBoundingClientRect 强制布局
  // （doRender 与 300ms tick 各调一次=同 tick 两次，稳定时纯无谓开销）
  const sig = btnStyle + '|' + fixedExpanded + '|' + isPhone + '|' + savedPosSig + '|' + currentTime + '|' + currentLocation + '|' + _ftDrag;
  if (!_ftDrag && sig === _ftLastSig) return;
  _ftLastSig = sig;

  const isIconMode =
    btnStyle === 'minimal' ||
    btnStyle === 'menu' ||
    btnStyle === 'time-window' ||
    btnStyle === 'time-window-menu';
  btn.classList.toggle('ub-ft-icon-mode', isIconMode);
  // 仅菜单按钮的四点图标需要实心圆点；用专属类名收窄，避免误填时钟等描边图标的圆
  btn.classList.toggle('ub-ft-menu', btnStyle === 'menu');

  const wrapper = document.getElementById('ac-statusbar-wrapper');

  // 未拖拽时：有保存位置则恢复，无保存位置则用默认左侧定位
  if (!_ftDrag) {
    // 视口钳制：窗口缩小后存量坐标可能越界（移动/落盘/恢复三点同一 helper 钳制=根治按钮飞出屏外）
    const savedPos = readSavedPos('statusbar-fixed-btn-pos');
    if (savedPos) {
      applyClampedPosition(btn, savedPos.x, savedPos.y, btn.offsetWidth || 36, btn.offsetHeight || 36);
    } else {
    const chat = document.getElementById('chat');
    if (chat) {
      const cr = chat.getBoundingClientRect();
      btn.style.left = Math.max(cr.left - 44, 4) + 'px';
      btn.style.right = 'auto';
      btn.style.top = Math.max(cr.top - 44, 4) + 'px';
      btn.style.bottom = 'auto';
    } else {
      btn.style.left = '8px';
      btn.style.right = 'auto';
      btn.style.top = '12px';
      btn.style.bottom = 'auto';
    }
    }
  }

  btn.style.setProperty('z-index', '100001', 'important');
  btn.style.display = 'flex';

  // 根据折叠按钮样式应用不同的外观
  if (isTimeWindow) {
    // 时间窗模式：显示时间和地点（currentTime/currentLocation 已在签名阶段读取）
    const timeDisplay = currentTime || '—';
    const locationDisplay = currentLocation || '位置未知';

    btn.style.width = 'auto';
    btn.style.height = isPhone ? '36px' : '32px';
    btn.style.borderRadius = '18px';
    btn.style.padding = '0 14px';
    btn.style.fontSize = isPhone ? '11px' : '12px';
    btn.style.whiteSpace = 'nowrap';
    btn.style.gap = '8px';
    btn.innerHTML = '<span style="color:#a0d8f0;display:inline-flex;align-items:center;gap:3px;">' + ubIcon('clock') + escapeHtml(timeDisplay) + '</span>'
      + '<span style="color:rgba(200,200,200,0.5);margin:0 2px;">|</span>'
      + '<span style="color:#c0d0a0;display:inline-flex;align-items:center;gap:3px;">' + ubIcon('pin') + escapeHtml(locationDisplay) + '</span>';
    // 纯时间窗：点击折叠/展开状态栏；时间窗+菜单：点击打开功能菜单
    btn.title = btnStyle === 'time-window-menu' ? '点击打开功能菜单' : (fixedExpanded ? '点击收回状态栏' : '点击展开状态栏');
    btn.setAttribute('aria-label', btn.title);
  } else if (btnStyle === 'menu') {
    // 菜单模式：圆形按钮 + 四点图标
    btn.style.width = isPhone ? '40px' : '36px';
    btn.style.height = isPhone ? '40px' : '36px';
    btn.style.borderRadius = '50%';
    btn.style.padding = '0';
    btn.style.fontSize = '16px';
    btn.style.gap = '0';
    btn.innerHTML = FT_MENU_ICON;
    btn.title = '菜单';
    btn.setAttribute('aria-label', '打开功能菜单');
    // 当展开/折叠状态变化时，不改变菜单按钮内容
  } else {
    // 极简模式（默认）：圆形按钮 + −/+
    btn.style.width = isPhone ? '40px' : '36px';
    btn.style.height = isPhone ? '40px' : '36px';
    btn.style.borderRadius = '50%';
    btn.style.padding = '0';
    btn.style.fontSize = '14px';
    btn.style.gap = '0';
    btn.innerHTML = fixedExpanded ? FT_MINUS_ICON : FT_PLUS_ICON;
    btn.title = fixedExpanded ? '收回状态栏' : '展开状态栏';
    btn.setAttribute('aria-label', btn.title);
  }

  if (wrapper) {
    if (fixedExpanded) {
      wrapper.classList.remove('ub-collapsed');

      // 展开后立即刷新 wrapper 样式：折叠期间 updateWrapperStyle() 被跳过，
      // 若使用 loader 的初始样式会出现居中/定位偏差（尤其是首次展开时）
      deps.updateWrapperStyle();
    } else {
      wrapper.classList.add('ub-collapsed');
    }
  }
}

// ===== 首次加载折叠按钮引导 =====
export function showFixedToggleOnboarding(): void {
  // 已引导过则跳过
  if (_lsGet('statusbar-ft-onboarded') === 'true') return;

  const btn = document.getElementById('ac-fixed-toggle');
  if (!btn) return;

  const cfg = getConfig();

  // 注入脉冲动画样式（仅一次）
  // U35：收编幂等注入（内容与 id 逐字保持）
  ensureStyleOnce('ub-onboarding-style', '@keyframes ub-ft-pulse{0%,100%{box-shadow:0 4px 14px rgba(0,0,0,.31),0 0 10px var(--ub-ft-ring-glow,rgba(126,232,255,.34))}50%{box-shadow:0 5px 16px rgba(0,0,0,.34),0 0 22px 7px var(--ub-ft-ring-glow,rgba(126,232,255,.34))}}#ac-fixed-toggle.ub-onboarding{animation:ub-ft-pulse 2s ease-in-out infinite}');

  btn.classList.add('ub-onboarding');

  // 创建提示框
  const tip = document.createElement('div');
  tip.id = 'ub-ft-tip';
  const btnStyle = cfg.collapseBtnStyle || 'minimal';
  if (btnStyle === 'menu' || btnStyle === 'time-window-menu') {
    tip.textContent = '点击打开功能菜单';
  } else if (btnStyle === 'time-window') {
    tip.textContent = '点击折叠/展开状态栏';
  } else {
    tip.textContent = '点击折叠/展开状态栏';
  }
  const isPhone = window.innerWidth <= 600;
  tip.style.cssText = 'position:fixed;z-index:100002;'
    + 'background:rgba(30,30,30,0.92);color:#fff;font-size:' + (isPhone ? '12px' : '13px') + ';'
    + 'padding:8px 14px;border-radius:6px;'
    + 'pointer-events:none;white-space:nowrap;'
    + 'box-shadow:0 2px 16px rgba(0,0,0,0.4);';
  document.body.appendChild(tip);

  // 定位提示框（在按钮右侧）
  function positionTip(): void {
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const tipW = tip.offsetWidth;
    // 优先放在右侧，空间不够则放左侧
    if (r.right + 12 + tipW < window.innerWidth - 8) {
      tip.style.left = (r.right + 12) + 'px';
      tip.style.right = 'auto';
    } else {
      tip.style.left = 'auto';
      tip.style.right = (window.innerWidth - r.left + 12) + 'px';
    }
    tip.style.top = (r.top + r.height / 2) + 'px';
    tip.style.transform = 'translateY(-50%)';
  }
  positionTip();

  // 关闭引导
  function dismissOnboarding(): void {
    if (!btn) return;
    btn.classList.remove('ub-onboarding');
    if (tip.parentNode) tip.remove();
    _lsSet('statusbar-ft-onboarded', 'true');
    const s = document.getElementById('ub-onboarding-style');
    if (s) s.remove();
  }

  btn.addEventListener('click', dismissOnboarding, { once: true });
}

export function toggleFixedExpand(): void {
  // null（未设置）语义与 updateFixedToggleBtn 一致：默认展开(true)，避免首次需点两次才折叠
  const raw = _lsGet('statusbar-fixed-expanded');
  const current = raw === null ? true : raw === 'true';
  const newVal = !current;
  _lsSet('statusbar-fixed-expanded', String(newVal));

  // 折叠时关闭所有弹窗/浮层，防止残留的 fixed 全屏覆盖层阻断触摸事件（移动端常见原因）
  if (!newVal) {
    const overlays = document.querySelectorAll('#settingsOverlay,#panelOverlay');
    overlays.forEach(function(ov) { ov.classList.remove('show'); });
  }

  // 关闭菜单下拉（如果打开着）
  closeCollapseMenu();

  // 同步执行展开/折叠的视觉变更（移除 display:none、重新定位 wrapper 与按钮）。
  // 这一步本身很轻，浏览器可在点击事件结束后立即绘制，用户瞬间看到状态栏出现/消失。
  updateFixedToggleBtn();

  if (newVal) {
    // 展开时补一次渲染：折叠期间 doRender 跳过了渲染，内容可能是折叠前的旧数据。
    //
    // 关键：把重渲染推迟到「下一帧」之后再排。这里包一层 requestAnimationFrame，
    // 而 render() 内部还会再 requestAnimationFrame(doRender) 一次，于是 buildHTML +
    // innerHTML 的大块同步重建落在「展开绘制之"后"的那一帧」执行，不再阻塞点击响应
    // 的首帧绘制——这正是固定顶部模式下开关卡顿 ~1s 的根因（rAF 回调在本帧绘制前执行，
    // 单层 rAF 会让展开与重建挤在同一帧，首帧绘制被 doRender 拖住）。
    //
    // 折叠期间 DOM 并未清空（仅 display:none），相当于天然的「上一次渲染」缓存，
    // 首帧先展示这份缓存内容，下一帧再用最新数据重建覆盖。
    //
    // 使用非强制 render()：数据未变时（渲染签名一致）直接跳过重建，省去无谓开销；
    // 数据已变时签名必变，照常重建，内容同样刷新到最新（与每条 AI 消息的非强制渲染
    // 信任同一份签名，风险一致）。
    requestAnimationFrame(() => deps.render());
  }
}
