// ===== 统一酒馆助手状态栏 - 入口文件 =====
import { ancientCSS } from './styles/ancient';
import { ensureStyleOnce } from './renderers/style-once';
import { UB_EVENT, emitUbEvent } from './core/events';
import { flirtatiousCSS } from './styles/flirtatious';
import { minimalCSS } from './styles/minimal';
import { sweetCSS } from './styles/sweet';
import { xianxiaCSS } from './styles/xianxia';
import { bridgeCSS } from './styles/bridge';
import { iosCSS } from './styles/ios';
import { getConfig, setConfig, _lsGet, _lsSet } from './core/config-store';
import { ubIcon } from './core/icons';
import { escapeHtml } from './core/html-escape';
import {
  getAutoCardAPI, invalidateCache, markSheetCacheChatKey,
  getCellByHeader, getSheetByName, sendMessageToChat,
  getOptionBarItems, buildTableDataSignature,
  flushDbWrites,
} from './core/data-manager';
import { handleTableUpdate, hasDatabaseTableSnapshot, startTimeAnchor, stopTimeAnchor } from './core/time-anchor';
import { isRefillMode, setRefillModeSuppressor } from './core/refill-mode';
import { isLedgerTakeover } from './core/ledger-takeover';
import { bindLedgerPresenceSignal } from './core/ledger-presence-signal';
import { type StyleType, setFollowBottomActive } from './core/constants';
import { SKILL_TABLE_NAME, SKILL_COL } from './core/skill-types';
import { readSkillTree } from './core/skill-store';
import { getToastr } from './core/env';
import { isTtManagedChatSurface, effectivePositionMode } from './core/tt-chat-surface';
import { createPersistentSettingsBtn, positionSettingsBtn, updateFloatingBtnVisibility, createFixedToggleBtn, updateFixedToggleBtn, refreshCollapseMenuItems, showFixedToggleOnboarding, initFloatingChrome, resetFixedToggleBtnSignature, syncFixedToggleAi } from './chrome/floating-chrome';
import { initAiActivityBar, syncAiActivityBar } from './renderers/ai-activity-bar';
import { initAiActivityNotify, refreshAiActivityNotify } from './core/ai-activity-notify';
import { setAiActivityChatKeyReader, subscribeAiActivities } from './core/ai-activity';
import { advanceWardrobeProjectionEpoch, handleWardrobeAutomationTick, initWardrobeOrchestration, invalidateWardrobePanelOpen, openWardrobePanel, reconcileWardrobeStateAndProjection, setupWardrobeActionBridge } from './wardrobe-orchestration';
import { showSkillTreePopup } from './renderers/skill-tree-panel';
import { initMapSystem, refreshMapDebounced, navigateToNode } from './core/map-system';
import { readTreeIndex } from './core/map-tree-store';
import { syncMapOverviewToMiscTable } from './core/map-overview-sync';
import { syncMapNodeWorldbookEntries } from './core/map-worldbook-inject';
import { resolveMapLocation } from './core/map-location-resolver';
import {
  getCurrentStoryChatKey,
  getPortraitDataRevision,
  initStoryFloorStore,
  isStoryStorageReady,
   getStoryJournalDataToken,
} from './core/story-floor-store';
import { createStoryReadinessCoordinator } from './core/story-readiness-coordinator';
import {
  flushStatusbarStorage,
  getStatusbarStorageStatus,
  initializeStatusbarStorage,
  initStoryBackupSystem,
  maybeAutoBackupStory,
  STATUSBAR_STORAGE_READY_EVENT,
} from './core/storage-bootstrap';
import { showMapPopup } from './renderers/map-panel';
import { showSkillPopup } from './renderers/skill-popup';
import { showSkillGainDialog } from './renderers/skill-gain-dialog';
import { injectSkillCSS } from './styles/skill-base';
import { setNotifyBeautifyEnabled } from './styles/notify-base';
import { syncSkillWorldbook, setSkillTagColorSyncListener, getSkillAccentColorMap, resolveSkillDisplayDesc } from './core/skill-worldbook';
import {
  advanceWorldbookProjectionScope,
  initializeWorldbookProjectionRuntime,
  refreshAllWorldbookProjections,
  registerExternalWorldbookProjection,
  requestExternalWorldbookProjectionAsync,
  runWorldbookProjectionExclusive,
  setWorldbookProjectionEnabled,
  unregisterExternalWorldbookProjection,
} from './core/worldbook-projection-runtime';
import { requestWorldbookProjection } from './core/worldbook-projection-events';
import { registerStorageRelocationCopier, unregisterStorageRelocationCopier } from './core/storage-relocation-bridge';
import { ensureSkillTable } from './core/skill-table-ensure';
import { syncCharacterRelationWorldbook } from './core/character-relation-worldbook';
import { MAP_BASE_CSS, buildMapThemeVarsCss } from './styles/map-base';
import {
  initPortraitSystem,
  refreshPortraitDebounced,
  requestLedgerPresencePortraitUpdate,
  requestPortraitAutoGeneration,
  stopPortraitAutoGeneration,
  stopPortraitSystem,
} from './core/portrait-system';
import { bindPortraitEvents } from './renderers/portrait-panel';
import { enqueueSharedImageTask } from './core/image-gen';
import { PORTRAIT_BASE_CSS } from './styles/portrait-base';
import { STORY_IMAGE_BASE_CSS } from './styles/story-image-base';
import { initStoryImageAutoTrigger, resolvePortraitCharTags } from './core/story-image-engine';
import { isPortraitFanwork, getPortraitFanTags } from './core/portrait-system';
import { initStoryImageFloorButton, stopStoryImageFloorButton } from './renderers/story-image-floor-button';
import { initStoryImageTextViewer, openHostLightbox, stopStoryImageTextViewer } from './renderers/story-image-text-viewer';
import { mapDirtyGuard, portraitDirtyGuard } from './core/auto-gen-dirty-guard';
import { handleCycleTick, invalidateCycleDecisionRuntime } from './core/cycle-engine';
import { installCycleExternalApi } from './core/cycle-external-api';
import { flushSystemDecisionQueue } from './core/system-decision-queue';
import { invalidateCycleStoreCache } from './core/cycle-store';
import { injectCycleCSS, cycleDisplayDigest } from './renderers/cycle-ui';
import {
  buildHTML,
  buildMinimalPresentChars, buildMinimalPlayGrid,
  buildProtagonistPortraitBoxHtml,
  buildOptionsBar,
  buildWeatherIconHTML,
  refreshPlayChipsUI,
} from './renderers/html-builder';
import { setPanelColorMode } from './renderers/panel-color-mode';
import { showConfirmDialog, showHelpPanel } from './renderers/confirm-dialog';
import { initialBeyondBatch, pickBeyondBatch } from './core/world-engine/world-state';
import { loadWorldState } from './core/world-engine/world-store';
import { BEYOND_CHAR_MAX, beyondAvailable } from './renderers/beyond-lens';
import { beyondLensBaseCSS } from './styles/beyond-lens-base';
import { decisionBaseCSS } from './styles/decision-base';
import { ITEM_OVERVIEW_BASE_CSS } from './styles/item-overview-base';
import { WAREHOUSE_BASE_CSS } from './styles/warehouse-base';
import { CURRENCY_POPUP_CSS } from './styles/currency-popup';
import { showCurrencyPopup } from './renderers/currency-popup';
import { syncWalletEntryMinimal } from './renderers/currency-entry';
import { CURRENCY_CHANGED_EVENT, currencyDisplayDigest } from './core/currency';
import { initCurrencyProseTrigger } from './core/currency-prose';
import { ensureSkillRegexInjection } from './core/skill-regex';
import { bindCurrencyHostBridge } from './core/currency-host-bridge';
import { ensureCurrencyRegexInjection } from './core/currency-regex';
import { showWorldWindow } from './renderers/world-window';
import {
  showMemoPopup, showItemPopup,
  showMissionPopup, showDiaryPopup,
  showPastExperiencePopup,
  showInvestigationPopup,
  showInvestigationExtraPromptDialog,
  showNsfwGuidanceExtraPromptDialog,
  showInterviewConfigPopup,
  showInterviewContent,
  showCharacterInfoPopup,
  showMapCharPopup,
  showDatabasePopup,
} from './renderers/popup-manager';
import { showCharacterRelationGraphPopup } from './renderers/character-relation-graph-popup';
import { bindLongPressDelegated, type LongPressHandle } from './renderers/long-press';
import { initSystemDecisionPopup } from './renderers/system-decision-popup';
import { showCycleManagerPopup } from './renderers/cycle-manager-popup';
import {
  closeWardrobePanel,
  injectWardrobeCss,
  refreshWardrobePanel,
  removeWardrobeCss,
  setWardrobeQueueController,
} from './renderers/wardrobe-panel';
import {
  peekWardrobeSnapshot,
  loadWardrobeState,
} from './core/wardrobe-store';
import { buildProtagonistOutfitItems } from './core/wardrobe-worldbook';
import {
  disposeWardrobeRuntime,
  getWardrobeRuntime,
  type WardrobeRuntime,
} from './core/wardrobe-runtime';
import {
  spawnClickHeart, spawnClickText, spawnEroticBurst,
  spawnTabRipple, spawnInkSparks, spawnDrips,
  createMouseGlow, updateMouseGlow,
} from './renderers/effects';
import { checkNotifications, clearBadge, getBadgeCount, itemBadgeHTML, missionBadgeHTML, memoBadgeHTML } from './renderers/notification-badge';
import { showConfigPanel, setConfigChangeCallback, notifyConfigChanged, resetFloatingBtnToCenter } from './panels/config-panel';
import {
  destroyAssistantUI,
  invalidateAssistantUIForChatChange,
  mountAssistantEntry,
} from './renderers/assistant-panel';
import { invalidateAssistantSourceCatalog } from './core/assistant-sources';
import { isInvestigating } from './core/investigation';
import { hasInterview, isInterviewing } from './core/interview';
import { syncPlayWorldbook, disablePlayWorldbook, syncItemUseEntries, resetPlayWorldbookCache } from './core/play-worldbook';
import { repositionManagedWbEntries } from './core/wb-position';
import {
  clearPlayState,
  getPlayStateSignature,
  readSelectedPlays,
  writeSelectedPlays,
} from './core/play-state-store';
import {
  getPlayLibrary,
  listVisiblePlays,
  pickRandomPlay,
  getPlayMaxSelected,
} from './core/play-library';
import { showPlaySelectorPopup } from './renderers/play-selector-popup';
import {
  getNsfwGuidanceInputText,
  getSelectedNsfwGuidancePlays,
  isNsfwGuidanceGenerating,
  performNsfwGuidance,
} from './core/nsfw-guidance';
// ===== 成就系统 =====
import { scan as achievementScan, setOnUnlocks, emitAchievementEvent, resetSession as resetAchievementSession, rebaseAchievementBaselines } from './core/achievement-engine';
import { ensureAchievementCatalog } from './core/achievement-catalog';
import { loadAchievementStore, flushNow as flushAchievementStore } from './core/achievement-store';
import { showAchievementPopup, onAchievementUnlocks } from './renderers/achievement-ui';
// ===== 商店弹窗（Task 5 主体）=====
import { showShopPopup } from './renderers/shop-popup';

// ===== 抽奖功能（卡池系统，供商店弹窗抽奖 Tab 调用）=====
// 已迁移至 core/gacha.ts；performGachaDraw 由 shop-popup.ts 直接 import 调用
import {
  exposeGachaGlobals,
} from './core/gacha';

// ===== 日历功能 =====
import { showCalendarPopup } from './renderers/calendar-popup';
import { showChronicleReaderPopup } from './renderers/chronicle-reader-popup';
import { calendarBaseCSS } from './styles/calendar-base';
import {
  handleCalendarDateChange,
  getCachedTodayWeather,
  refreshTodayWeather,
  projectCalendarToWorldbook,
} from './core/calendar-core';
import { performCalendarGeneration } from './core/calendar-ai';
import { initWorldEvolution } from './core/world-engine/world-sources';
import { applyScene, validateSceneProfile, isSceneApplying } from './core/scene-switcher';
import type { SceneMode } from './core/constants';
import { applyStatusbarContentFontScale } from './core/statusbar-font-scale';
import { applyUiFontScale } from './core/ui-font-scale';
import { setPerfDebug, perfReset, perfStart, perfEnd, perfDump } from './core/perf-timing';

// ===== 双实例防御（纵深层；权威修复在 loader 的 __ub_loader_booted 哨兵）=====
// 两个相同副本会把主脚本注入两次，整份应用在共享主页面 window / 角色卡世界书 / 数据库上
// 跑两份：数据更新回调双引擎 + 各副本世界书 reconcile 签名基线互相触发重写，刷新后拖死页面。
// ESM 顶层不能 return，第二副本让位方式 = 不跑 init、不覆盖 window 桥（IS_FIRST_BOOT 门控）；
// import 期副作用（地图树监听等）无法在模块层摘除，残余面由 loader 哨兵兜住。
const IS_FIRST_BOOT: boolean = !((window as any).__ub_statusbar_booted);
(window as any).__ub_statusbar_booted = true;

// 模块评估开始标记（ub_perf_debug 门控；loader 注入前已打点则不覆盖——loader 的
// 时间戳在父页面脚本注入前记录，能涵盖 3.1MB 模块 parse；此处是独立页面回退）
try {
  if (localStorage.getItem('ub_perf_debug') === '1' && !(window as any).__ub_perf_load_start) {
    (window as any).__ub_perf_load_start = performance.now();
  }
} catch { /* ignore */ }

// ===== 悬浮 chrome（提案三 S1 拆分至 chrome/floating-chrome.ts；index 局部能力在此注入） =====
initFloatingChrome({
  render,
  showPopupOrToggle,
  handleOptionItemClick,
  ensureOverlaysInBody,
  updateWrapperStyle,
  openWardrobePanel,
});

// ===== 全局状态 =====
let currentStyle: StyleType = 'ancient';
let mouseGlow: HTMLElement | null = null;

// 古风/仙侠为阅读优先主题，默认禁用随机点击爱心/漂字/粒子/常驻鼠标光晕/页签涟漪/爆裂。
// 判定以当前主题为准（currentStyle 在配置变更回调内同步重赋值，点击时读取即反映活跃主题）。
function isReadingTheme(style: StyleType): boolean {
  return style === 'ancient' || style === 'xianxia';
}

// 大调查 / 瑟瑟指导按钮长按（U10：计时器与合成 click 吞噬统一交给 renderers/long-press）。
// 句柄分开按容器（#ac-content 与 .minimal-container）持有——旧实现的模块级单例 timer/flag 在两个
// 容器都挂载同 id 按钮时会互相踩（一个容器按下、另一个容器抬起会误触发短按）。bindEvents 可在
// reinject 时重入，重绑前先 stop 掉上一次，避免监听叠加。
let _invLpAc: LongPressHandle | null = null;
let _nsfwLpAc: LongPressHandle | null = null;
let _invLpMc: LongPressHandle | null = null;
let _nsfwLpMc: LongPressHandle | null = null;

// ===== CSS注入管理 =====
const CSS_MAP: Record<StyleType, string> = {
  ancient: ancientCSS,
  flirtatious: flirtatiousCSS,
  minimal: minimalCSS,
  sweet: sweetCSS,
  xianxia: xianxiaCSS,
  bridge: bridgeCSS,
  ios: iosCSS,
};

function injectCSS(style: StyleType): void {
  const cssText = CSS_MAP[style] || CSS_MAP.ancient;
  // O5：内容一致且仅一份时跳过——init 里 renderStorageLoadingShell 与 doInitRender 两次
  // injectCSS 同内容，remove+append 会让浏览器重新解析整份主题（~200KB）。切主题时内容
  // 变化照常重建；遗留多份（旧脚本双注入）时不跳过，维持「清理到恰一份」语义。
  const existing = document.querySelectorAll('#statusbar-active-style');
  if (existing.length === 1 && (existing[0] as HTMLStyleElement).textContent === cssText) return;
  // 先移除所有旧的状态栏样式（包括之前脚本执行遗留的，按ID清理避免多份CSS共存）
  existing.forEach(function(el) { el.remove(); });
  const newStyle = document.createElement('style');
  newStyle.id = 'statusbar-active-style';
  newStyle.textContent = cssText;
  document.head.appendChild(newStyle);
}

/** 注入镜头之外样式（主界面按钮/面板常驻，幂等；六主题作用域见 beyond-lens-base）。 */
function injectBeyondLensCSS(): void {
  ensureStyleOnce('statusbar-beyond-style', beyondLensBaseCSS); // U35：收编幂等注入
}

/** 注入决策弹窗主题样式（五主题作用域常驻，幂等；bridge 走既有 bridge-module-decision-queue 不在此）。 */
function injectDecisionCSS(): void {
  ensureStyleOnce('statusbar-decision-style', decisionBaseCSS); // U35：收编幂等注入
}

/** 注入物品总览图面板样式（令牌驱动共享基底，幂等）。 */
function injectItemOverviewCSS(): void {
  ensureStyleOnce('ub-item-overview-css', ITEM_OVERVIEW_BASE_CSS); // U35：收编幂等注入
}

/** 注入仓库分组 UI 样式（分组条/每组总览图卡片/管理页/目标选择弹窗共用，幂等）。 */
function injectWarehouseCSS(): void {
  ensureStyleOnce('ub-warehouse-css', WAREHOUSE_BASE_CSS);
}

/** 注入货币弹窗样式（幂等）。 */
function injectCurrencyPopupCSS(): void {
  ensureStyleOnce('ub-currency-popup-css', CURRENCY_POPUP_CSS); // U35：收编幂等注入
}

// 注入地图面板 CSS（主题变量 + 共享基底）；内容不变时不触发 CSS 重解析
let _mapCssCacheStyle: StyleType | null = null;
let _mapCssCacheText = '';
function injectMapCSS(enabled = getConfig().mapEnabled): void {
  const existing = document.getElementById('statusbar-map-style');
  if (!enabled) {
    if (existing) existing.remove();
    return;
  }
  if (_mapCssCacheStyle !== currentStyle) {
    _mapCssCacheStyle = currentStyle;
    _mapCssCacheText = buildMapThemeVarsCss(currentStyle) + '\n' + MAP_BASE_CSS;
  }
  const cssText = _mapCssCacheText;
  if (existing) {
    if (existing.textContent === cssText) return;
    existing.textContent = cssText;
    return;
  }
  const style = document.createElement('style');
  style.id = 'statusbar-map-style';
  style.textContent = cssText;
  document.head.appendChild(style);
}

// 注入立绘面板 CSS（共享基底，5 主题通用）；内容不变时复用现有节点
function injectPortraitCSS(enabled = getConfig().portraitEnabled): void {
  const existing = document.getElementById('ub-portrait-css');
  if (!enabled) {
    if (existing) existing.remove();
    return;
  }
  if (existing?.textContent === PORTRAIT_BASE_CSS) return;
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = 'ub-portrait-css';
  style.textContent = PORTRAIT_BASE_CSS;
  document.head.appendChild(style);
}

// 注入正文插图图库 CSS（常驻幂等：DOM 无匹配节点零重绘，不随开关注入/移除——
// 关闭自动插图后图库仍可从设置打开浏览历史图片）
function injectStoryImageCSS(): void {
  const existing = document.getElementById('ub-story-image-css');
  if (existing?.textContent === STORY_IMAGE_BASE_CSS) return;
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = 'ub-story-image-css';
  style.textContent = STORY_IMAGE_BASE_CSS;
  document.head.appendChild(style);
}

// ===== 可见性控制 =====
function applyVisibility(): void {
  const config = getConfig();
  const acContent = document.getElementById('ac-content');
  const minimalContainer = document.querySelector('.minimal-container') as HTMLElement;
  const ps = document.getElementById('ac-persistent-settings');

  if (currentStyle === 'minimal') {
    if (acContent) acContent.style.display = 'none';
    if (minimalContainer) minimalContainer.style.display = '';
  } else {
    if (acContent) acContent.style.display = '';
    if (minimalContainer) minimalContainer.style.display = 'none';
  }
  if (ps) {
    ps.style.display = config.showFloatingBtn ? '' : 'none';
    ps.title = '状态栏设置';
  }
  updateFeatureButtonVisibility();
}

function injectCalendarCSS(enabled = getConfig().calendarEnabled): void {
  const existing = document.getElementById('statusbar-calendar-style');
  if (!enabled) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return;
  ensureStyleOnce('statusbar-calendar-style', calendarBaseCSS); // U35：收编幂等注入（开/关闸保留在上）
}

/** 更新商店/大调查按钮可见性 */
function updateFeatureButtonVisibility(): void {
  const config = getConfig();
  // 商店按钮：多种 id 用于不同风格
  ['ac-lottery-head-btn', 'lottery-btn'].forEach(function(id) {
    const btn = document.getElementById(id);
    if (btn) btn.style.display = config.shopEnabled ? '' : 'none';
  });
  // 大调查按钮
  const invBtns = document.querySelectorAll('#ac-investigate-btn');
  invBtns.forEach(function(btn) {
    (btn as HTMLElement).style.display = config.investigationEnabled ? '' : 'none';
  });
  // 大采访按钮
  const interviewBtns = document.querySelectorAll('#ac-interview-btn');
  interviewBtns.forEach(function(btn) {
    (btn as HTMLElement).style.display = config.interviewEnabled ? '' : 'none';
  });
  // 数据库可视化按钮（minimal 静态按钮，4 主题在 buildHTML 内按 dbViewerEnabled 条件输出）
  const dbBtnMin = document.getElementById('ac-database-btn-minimal');
  if (dbBtnMin) dbBtnMin.style.display = config.dbViewerEnabled ? '' : 'none';
  // 技能按钮（minimal 静态按钮，4 主题在 buildHTML 内按 skillEnabled 条件输出；querySelectorAll 兼顾两容器）
  document.querySelectorAll('#ac-skill-btn').forEach(function(btn) {
    (btn as HTMLElement).style.display = config.skillEnabled ? '' : 'none';
  });
  document.querySelectorAll('#ac-wardrobe-btn, #ac-wardrobe-summary').forEach(function(btn) {
    (btn as HTMLElement).style.display = config.wardrobeEnabled ? '' : 'none';
  });
  updateWardrobeQueueIndicators();
}

let _wardrobeStatusUnsubscribe: (() => void) | null = null;

function updateWardrobeQueueIndicators(): void {
  if (!getConfig().wardrobeEnabled) return;
  const snapshot = getWardrobeRuntime().getSnapshot();
  const active = !!snapshot && ['preparing', 'running'].includes(snapshot.status);
  const remaining = snapshot?.tasks.filter(task =>
    ['waiting_prompt', 'queued', 'running', 'interrupted'].includes(task.status)).length || 0;
  document.querySelectorAll<HTMLElement>('#ac-wardrobe-btn').forEach(btn => {
    btn.classList.toggle('wardrobe-queue-active', active);
    if (active) {
      btn.dataset.wardrobeRemaining = String(remaining);
      btn.title = `衣柜生图进行中，剩余 ${remaining} 项`;
    } else {
      delete btn.dataset.wardrobeRemaining;
      btn.title = '衣柜';
    }
  });
}

function bindWardrobeRuntime(runtime: WardrobeRuntime | null): void {
  _wardrobeStatusUnsubscribe?.();
  _wardrobeStatusUnsubscribe = null;
  setWardrobeQueueController(runtime);
  if (!runtime) return;
  _wardrobeStatusUnsubscribe = runtime.subscribe(() => updateWardrobeQueueIndicators());
  updateWardrobeQueueIndicators();
}

// ===== 主渲染函数 =====
let _renderPending = false;
let _renderRafId: number | null = null;
let _forceRender = false; // 强制渲染标记（主题/配置变更、reinject、展开补渲染等场景）
let _lastRenderSignature = ''; // 上次渲染的完整签名（数据+配置+UI状态），用于脏检查

// 进卡存储就绪后 runReadyStoryAutomation 已跑过 cycle/日历/衣柜投影；随后 flush 落盘派发的
// ub-story-state-invalidated 会重复跑同一批投影。记录最近一次 ready-automation 时间，给后续
// state-invalidated 处理器加冷却：仅抑制重复投影，render(true) 始终执行。CHAT_CHANGED 时重置。
const STORY_PROJECTION_COOLDOWN_MS = 500;
let _lastReadyAutomationAt = 0;

// state-invalidated 事件所见聊天。同聊天落盘（衣柜删除/生图/编辑）不改，面板保持打开；
// 切卡后首事件该值与当前 key 不等 → 关面板 + switchChat。不依赖 wardrobeProjectionChatKey
// （advanceWardrobeProjectionEpoch/handleReinject 会提前把它更新成新 key，检测不出切换）。
let _lastStoryInvalidatedChatKey = getCurrentStoryChatKey();

/** 把非关键回调推迟到浏览器空闲帧；不支持 requestIdleCallback 时回退到 setTimeout(1)（DB 插件同款回退）。 */
function scheduleIdle(cb: () => void): void {
  const ric = (window as any).requestIdleCallback;
  if (typeof ric === 'function') { ric(cb); return; }
  setTimeout(cb, 1);
}

/** 组装完整渲染签名（表格数据 + 配置显示字段 + localStorage 状态 + _activeChar + 徽章计数） */
function composeRenderSignature(): string {
  perfStart('render-signature');
  try {
  // 表格数据部分（缓存为空时返回 null → 签名置为特殊值，确保触发渲染）
  const tableSig = buildTableDataSignature();
  if (tableSig === null) return '__force_no_cache__';

  // 配置显示字段（直接影响 buildHTML 输出的 16 个字段）
  const cfg = getConfig();
  const cfgSig = [
    cfg.style,
    cfg.darkTheme ? 1 : 0,
    cfg.nsfwPlayEnabled ? 1 : 0,
    cfg.shopEnabled ? 1 : 0,
    cfg.investigationEnabled ? 1 : 0,
    cfg.interviewEnabled ? 1 : 0,
    cfg.sceneSwitchEnabled ? 1 : 0,
    cfg.sceneSwitchCurrent || '',
    cfg.optionsBarEnabled ? 1 : 0,
    cfg.mapEnabled ? 1 : 0,
    cfg.worldEnabled ? 1 : 0,
    cfg.portraitEnabled ? 1 : 0,
    cfg.portraitProtagonistEnabled ? 1 : 0,
    cfg.wardrobeEnabled ? 1 : 0,
    cfg.showHelpTips ? 1 : 0,
    cfg.playCollapsed ? 1 : 0,
  ].join(',');

  // 当前角色卡玩法状态 + localStorage 物品使用开关
  const playState = getPlayStateSignature();
  const itemUse = String(cfg.itemUseEnabled);

  // 当前选中角色
  const activeChar = String((window as any)._activeChar || '');

  // 徽章计数（renderBadges 依赖）
  const badgeSig = getBadgeCount('item') + ':' + getBadgeCount('mission') + ':' + getBadgeCount('memo');

  // 今日天气缓存（buildWeatherIconHTML 依赖；缓存从空→有数据时签名变化触发重渲染）
  const _w = getCachedTodayWeather();
  const weatherSig = _w ? (_w.category + ':' + (_w.description || '').slice(0, 32)) : 'none';

  // 镜头之外视图/批次（2026-08-21：切视图与换一批触发重建，刷新不重抽）
  const beyondSig = String((window as any)._activeBeyond || '')
    + ':' + String(Array.isArray((window as any)._beyondBatch) ? (window as any)._beyondBatch.join(',') : '');

  // story 输入指纹（提案 E，2026-09-15）：渲染树直接消费 story 数据的仅两处——立绘
  // （html-builder buildPortraitBoxHtml→getCurrentPortraitPath）与主角穿搭（同文件
  // buildProtagonistOutfitItems(getWardrobeSnapshot())）；其余 story 写入（calendar/cycle/
  // map/worldbook 键）经投影/表格间接影响渲染，已被 tableSig/badgeSig 覆盖。两指纹与渲染
  // 同源同鲜度（同一读路径），据此 ub-story-cache-changed 可走 render() 脏检查——
  // 与渲染无关的 story 写不再强制全量重建。
  const portraitRev = getPortraitDataRevision();
  let outfitSig = '';
  // O2：签名走 peek（零克隆只读视图）——原 getWardrobeSnapshot 每次签名全量 JSON 克隆衣柜，
  // 而签名在生成期 3.3 次/秒地跑；buildProtagonistOutfitItems 纯读（filter/map/join），peek 安全。
  try { outfitSig = buildProtagonistOutfitItems(peekWardrobeSnapshot()); } catch (_e) { outfitSig = 'n/a'; /* story 尚未就绪 */ }
  // O37(第十一轮)：story 派生显示输入的三个缺口补齐——货币余额（四风格钱包入口/萦绕内芯）、
  // 经期情绪变体与周期条、镜头之外视图的世界内容（仅激活时计入，平时零耦合）。
  // 补齐后 storyStateInvalidated（落盘尾）与 CURRENCY_CHANGED 降级为脏检查 render()：
  // 无关 story 写（地图/图库/日历投影等）不再强制全量重建；显示相关字段变化仍必翻签名。
  // 字段清单为契约（tests/round11-batch4.test.ts 锁定）：新增 story 派生显示字段必须同步入签。
  let currencySig = '';
  try { currencySig = currencyDisplayDigest(); } catch (_e) { currencySig = 'n/a'; /* story 尚未就绪 */ }
  let cycleSig = '';
  try { cycleSig = cycleDisplayDigest(activeChar); } catch (_e) { cycleSig = 'n/a'; }
  const worldSig = (window as any)._activeBeyond ? String(getStoryJournalDataToken()) : '';
  const storySig = portraitRev + '|' + outfitSig + '|' + currencySig + '|' + cycleSig + '|' + worldSig;

  return tableSig + '|' + cfgSig + '|' + playState + '|' + itemUse + '|' + activeChar + '|' + badgeSig + '|' + weatherSig + '|' + beyondSig + '|' + storySig;
  } finally {
    perfEnd('render-signature');
  }
}

/** 请求渲染。
 *  @param force true 表示强制渲染（跳过脏检查），用于主题/配置变更、reinject、展开补渲染、角色名牌点击等场景。
 *               false（默认）表示脏检查：渲染签名未变时跳过全量重建，节省 CPU。 */
function render(force?: boolean): void {
  // 防止短时间内重复渲染导致闪烁
  if (_renderPending) {
    // 已有渲染排队中：若此次是强制渲染，升级排队的渲染为强制
    if (force) _forceRender = true;
    return;
  }
  _renderPending = true;
  if (force) _forceRender = true;

  // 使用 rAF 将渲染推迟到下一帧，避免同步布局抖动
  if (_renderRafId) cancelAnimationFrame(_renderRafId);
  _renderRafId = requestAnimationFrame(doRender);
}

function doRender(): void {
  perfStart('doRender-total');
  try {
  _renderRafId = null;
  // 页面不可见时跳过渲染节省资源，但保持 _renderPending=true
  // 以便 visibilitychange 事件触发时能补渲染，避免状态栏永久空白
  if (document.hidden) {
    return;
  }
  // 浮动选项栏独立于 wrapper，折叠态下也需刷新（它在 #ac-statusbar-wrapper 之外，不受折叠影响）
  syncOptionsBarFloating();
  // 状态栏折叠时跳过渲染（display:none 下全量重建纯浪费，移动端省电关键）
  // 重置 _renderPending 和 _forceRender，避免死锁（折叠态下任何 render 调用都不应阻塞后续渲染）
  // 展开时由 toggleFixedExpand 主动触发 render(true) 补渲染
  const _wrapperForSkip = document.getElementById('ac-statusbar-wrapper');
  if (_wrapperForSkip && _wrapperForSkip.classList.contains('ub-collapsed')) {
    _renderPending = false;
    _forceRender = false;
    return;
  }

  // 镜头之外自愈：世界演化关闭或内容清空时退出视图（标志归位 → beyondSig 变化 → 重建为角色档案）。
  // 视图未激活时仅读一个内存标志，零额外开销。
  if ((window as any)._activeBeyond && !beyondAvailable()) {
    (window as any)._activeBeyond = false;
  }

  // 脏检查：非强制渲染时，若签名未变则跳过全量重建
  // 签名覆盖表格数据/配置显示字段/localStorage 玩法状态/_activeChar/徽章计数
  if (!_forceRender) {
    const sig = composeRenderSignature();
    if (sig === _lastRenderSignature) {
      _renderPending = false;
      return;
    }
  }

  const config = getConfig();


  // 角色卡切换时同步更新悬浮按钮可见性（角色卡可单独配置 showFloatingBtn）
  updateFloatingBtnVisibility();
  updateFixedToggleBtn();
  syncFixedToggleAi();

  if (currentStyle === 'minimal') {
    renderMinimal();
  } else {
    renderAncientOrFlirtatious();
  }
  // AI 提示条不在 composeRenderSignature 内：每次构建后按其自身签名同步（无活动时零写入）
  syncAiActivityBar();

  // 功能按钮可见性必须在每次重建后重新施加（切卡/切聊后关闭态按钮复活修复，2026-10-05）：
  // 商店/大调查按钮在 buildHTML 内是无条件输出（未走 interview 的条件输出惯例），
  // 关闭态仅靠 updateFeatureButtonVisibility 写的内联 display:none 撑着；而重建 innerHTML 会连内联样式
  // 一起丢掉——wrapper 被 loader 重建（跟随底部切聊清空 #chat）或分区内容变化时，已关闭的按钮即复活，
  // 且点击处理器不判开关，等于配置被绕过。此处与上方 updateFloatingBtnVisibility/updateFixedToggleBtn
  // 同位置同口径：凡「只靠内联样式控制」的按钮，重建后一律重施加（含 minimal 静态壳的 #lottery-btn）。
  updateFeatureButtonVisibility();

  // bindEvents 已改为一次性委托绑定（在 doInitRender / handleReinject 中调用），
  // 委托事件绑定在稳定的 #ac-content / .minimal-container 容器上，跨 innerHTML 存活，无需每次渲染重绑

  // 注入通知徽章
  renderBadges();

  // 地图面板 CSS（仅在主题或 CSS 真变化时更新；关闭时移除）
  injectMapCSS(config.mapEnabled);
  injectSkillCSS(config.skillEnabled, currentStyle);
  // 立绘面板 CSS（主题无关；已存在且内容一致时零写入，关闭时移除）
  injectPortraitCSS(config.portraitEnabled);
  // 月信经期 CSS（按 cycleMode 自管理：off 移除、非 off 注入；doRender 每次调用，切档经 _onConfigChanged→render 自动重注）
  injectCycleCSS();

  // 渲染完成：记录签名供下次脏检查，重置强制标记
  _lastRenderSignature = composeRenderSignature();
  _forceRender = false;
  _renderPending = false;
  } finally {
    perfEnd('doRender-total');
  }
}

// —— 分区渲染状态：上次渲染的主题与各 data-ub-section 容器的 innerHTML 快照 ——
// F41(第十一轮)：萦绕主题整块写入的字符串守卫——生成串与上次相同则不碰 DOM
// （对齐浮动栏 _lastFloatingBarHtml / 衣柜面板 _lastWardrobeBodyHtml 既有范式）。
// 现状病灶：renderMinimal 五处无守卫 .html() 重写，任何格子变化（最常见=当前时间跳分）
// 都连带重建角色卡/立绘/选项栏——立绘 img 重新解码、悬停态丢失。哨兵初值保证首渲必写。
let _minimalSysTimeHtml = '\u0000';
let _minimalEnergyHtml = '\u0000';
let _minimalProtagonistPortrait = '\u0000';
let _minimalPresentHtml = '\u0000';
let _minimalPlayHtml = '\u0000';
let _minimalOptionsHtml = '\u0000';
/** F47(第十二轮)：壳被 loader 重建后哨兵必须归零——新壳是 index.html 模板默认值
 *  （#sys-time 空 span、#energy-badge 字面 ⚡0），哨兵若仍记着上一份壳写过的串，
 *  守卫比对相等即跳过写入 ⇒ 时间/能量/立绘/角色卡/玩法格/选项栏停在模板值，
 *  直到各自内容下次变化（可能整整一轮对话）；徽章签名同理（重注失败则徽章消失）。 */
function resetMinimalRenderSentinels(): void {
  _minimalSysTimeHtml = '\u0000';
  _minimalEnergyHtml = '\u0000';
  _minimalProtagonistPortrait = '\u0000';
  _minimalPresentHtml = '\u0000';
  _minimalPlayHtml = '\u0000';
  _minimalOptionsHtml = '\u0000';
  _lastBadgeSig = '';
}
let _sectionState: { style: string | null; html: Record<string, string>; ident: Record<string, SectionIdentity> } = { style: null, html: {}, ident: {} };
// 游离探测容器（不挂载到活 DOM，仅解析 buildHTML 产物提取区块，不触碰活页面）
let _sectionProbe: HTMLDivElement | null = null;
// O29：产物与上次解析过的串逐字节相同 ⇒ 直接复用上次提取结果（几十 KB 的 memcmp 远便宜于整串 DOM parse）。
// 提取管线本身一行未动：解析串与注入串仍走同一条 DOM 序列化路径，行为零变化。
// （纯字符串切分方案在 F1 未转义玩法值注入点面前有配平错位风险，F1 修复前不做——见第七轮提案 O29 口径。）
let _sectionParseCacheHtml: string | null = null;
let _sectionParseCacheResult: { sections: Record<string, string>; idents: Record<string, SectionIdentity>; rootClass: string } | null = null;

/** 分区容器自身身份：className + data-* 属性（分区键除外）。分区渲染只替换 innerHTML、
 *  容器元素被跨渲染复用，身份不同步的话容器携带的状态属性会停留在上一个渲染期——
 *  典型病灶：charportrait 分区容器即 .portrait-box 本身，切角色后 data-portrait-name
 *  仍是旧角色名，点击「生成/换/图库」全路由到旧角色。构建产物为规范值，直接覆盖。 */
interface SectionIdentity { className: string; attrs: Record<string, string>; }
function sectionIdentityOf(el: HTMLElement): SectionIdentity {
  const attrs: Record<string, string> = {};
  for (const a of Array.from(el.attributes)) {
    if (a.name === 'data-ub-section' || !a.name.startsWith('data-')) continue;
    attrs[a.name] = a.value;
  }
  return { className: el.className, attrs };
}
function applySectionIdentity(el: HTMLElement, ident: SectionIdentity): void {
  if (el.className !== ident.className) el.className = ident.className;
  for (const [name, value] of Object.entries(ident.attrs)) {
    if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  }
  for (const a of Array.from(el.attributes)) {
    if (a.name.startsWith('data-') && a.name !== 'data-ub-section' && !(a.name in ident.attrs)) el.removeAttribute(a.name);
  }
}

/** 从 buildHTML 产物提取各 data-ub-section 容器的 innerHTML 与根容器 class。
 *  比较与替换都是「解析串 vs 解析串」，天然稳定；返回前清空游离容器防增长。
 *  F46(第十二轮)：同一键出现两次会让「唯一键数 ≠ 元素数」恒真 ⇒ 分区渲染静默退化为整根重建；
 *  此处显式告警（只报一次），把静默退化变成可见问题。 */
let _sectionDupWarned = false;
function extractSections(html: string): { sections: Record<string, string>; idents: Record<string, SectionIdentity>; rootClass: string } {
  if (_sectionParseCacheResult && _sectionParseCacheHtml === html) return _sectionParseCacheResult;
  if (!_sectionProbe) _sectionProbe = document.createElement('div');
  _sectionProbe.innerHTML = html;
  const sections: Record<string, string> = {};
  const idents: Record<string, SectionIdentity> = {};
  const seen = new Set<string>();
  _sectionProbe.querySelectorAll('[data-ub-section]').forEach((el) => {
    const k = (el as HTMLElement).dataset.ubSection;
    if (!k) return;
    if (seen.has(k) && !_sectionDupWarned) {
      _sectionDupWarned = true;
      console.warn('[ub] 分区键重复：' + k + '（同名分区只保留最后一个，分区渲染将退化为整根重建；请给实例区分键）');
    }
    seen.add(k);
    sections[k] = el.innerHTML;
    idents[k] = sectionIdentityOf(el as HTMLElement);
  });
  const root = _sectionProbe.querySelector('#ac-book') as HTMLElement | null;
  const rootClass = root ? root.className : '';
  _sectionProbe.innerHTML = '';
  _sectionParseCacheHtml = html;
  _sectionParseCacheResult = { sections, idents, rootClass };
  return _sectionParseCacheResult;
}

function renderAncientOrFlirtatious(): void {
  const style = currentStyle;
  perfStart('render-buildHTML');
  const html = buildHTML(style);
  perfEnd('render-buildHTML');
  const acContent = document.getElementById('ac-content');
  if (!acContent) return;

  perfStart('render-sections');
  const { sections, idents, rootClass } = extractSections(html);
  const htmlKeys = Object.keys(sections);
  const domKeys = Array.from(acContent.querySelectorAll('[data-ub-section]'))
    .map((el) => (el as HTMLElement).dataset.ubSection || '');

  // 主题切换 / 容器集合增减 / 无分区主题（如 bridge）→ 整根重建回退
  const structureChanged = _sectionState.style !== style
    || htmlKeys.length === 0
    || htmlKeys.length !== domKeys.length
    || htmlKeys.some((k) => !domKeys.includes(k));

  // fixed-top 下 wrapper 是滚动容器，替换会改内容高度 → 先记再恢复
  // （effective 口径：TT 托管聊天区下 follow-bottom 回退 fixed-top，滚动容器判定随之）
  const wrapper = document.getElementById('ac-statusbar-wrapper') as HTMLElement | null;
  const fixedTop = effectivePositionMode(getConfig().positionMode) === 'fixed-top' && !!wrapper;
  const savedTop = fixedTop ? wrapper!.scrollTop : 0;

  if (structureChanged) {
    acContent.innerHTML = html;
    _sectionState = { style, html: sections, ident: idents };
    _lastBadgeSig = '';
  } else {
    let replacedAny = false;
    for (const key of htmlKeys) {
      const inner = sections[key];
      const ident = idents[key];
      if (_sectionState.html[key] === inner && _sectionState.ident[key] === ident) continue;
      const el = acContent.querySelector('[data-ub-section="' + key + '"]') as HTMLElement | null;
      if (el) {
        if (_sectionState.html[key] !== inner) { el.innerHTML = inner; replacedAny = true; }
        // 容器身份同步：innerHTML 不变但容器属性变化（如切角色后 charportrait 的
        // data-portrait-name / has-real-portrait class）也要跟上，否则复用容器带着旧身份
        if (_sectionState.ident[key] !== ident) applySectionIdentity(el, ident);
      }
      _sectionState.html[key] = inner;
      _sectionState.ident[key] = ident;
    }
    // 被替换区内的动态徽章已随节点移除；清签名让 renderBadges 重注
    if (replacedAny) _lastBadgeSig = '';
  }
  perfEnd('render-sections');

  // 根容器 class（nsfw-border 等由状态产出）同步，防根类陈旧
  const rootEl = acContent.querySelector('#ac-book') as HTMLElement | null;
  if (rootEl && rootEl.className !== rootClass) rootEl.className = rootClass;

  // fixed-top 滚动保持
  if (fixedTop && wrapper) wrapper.scrollTop = savedTop;

  // 隐藏萦绕容器
  const mc = document.querySelector('.minimal-container') as HTMLElement;
  if (mc) mc.style.display = 'none';
  acContent.style.display = '';

  // 从 minimal 切回动态主题：凭源标记回收 minimal 写入 body 的深色类（宿主自设的 dark-mode 不动）
  if (document.body.getAttribute('data-ub-dark') === '1') {
    document.body.removeAttribute('data-ub-dark');
    document.body.classList.remove('dark-mode');
  }

  // 应用暗色主题
  const config = getConfig();
  if (config.darkTheme) {
    acContent.classList.add('dark');
  } else {
    acContent.classList.remove('dark');
  }

  // 应用玩法区折叠状态：必须与 innerHTML 在同一同步任务内完成。
  // 否则浏览器会先绘制「展开态」、下一帧再折叠，造成切换角色等重渲染时的画面抖动
  // （原实现用 setTimeout(…,10) 把加类推迟到独立任务，正是抖动根因）。
  if (config.playCollapsed) {
    const ps = document.getElementById('ac-play-section');
    if (ps) ps.classList.add('collapsed');
    // 古风/仙侠新结构（.ub-play-disclosure）：渲染器已在 HTML 串内同步产出
    // #ac-play-body[hidden] + aria-expanded="false"，故此处无需再改；
    // 兜底防御：若存在 #ac-play-body 则同步 hidden/aria，绝不改 textContent
    // （折叠按钮内含 chevron/标题/摘要 span，textContent 会抹掉它们）。
    const body = document.getElementById('ac-play-body');
    if (body) {
      body.hidden = true;
      const pcb = document.getElementById('ac-play-collapse-btn');
      if (pcb) pcb.setAttribute('aria-expanded', 'false');
    } else if (currentStyle !== 'xianxia') {
      // 其余主题旧结构：折叠按钮文字 +/−
      const pcb = document.getElementById('ac-play-collapse-btn');
      if (pcb) pcb.textContent = '+';
    }
  }

  // 更新物品使用按钮：同样同步化，避免按钮先显示默认 OFF 文案再闪到 ON。
  updateItemUseToggle();
}

function renderMinimal(): void {
  const acContent = document.getElementById('ac-content');
  if (acContent) {
    // 清掉切主题前动态主题留在 #ac-content 的残留 DOM（含残留的 #ac-scene-btn，
    // 其 ID 与萦绕静态按钮相同且 DOM 顺序在前，会干扰全局 ID 选择器）；
    // 切回动态主题时 renderAncientOrFlirtatious 会 innerHTML 全量覆盖，清空无副作用。
    acContent.innerHTML = '';
    acContent.style.display = 'none';
  }

  const mc = document.querySelector('.minimal-container') as HTMLElement;
  if (mc) mc.style.display = '';

  // 更新静态元素
  const currentLocation = getCellByHeader('全局数据表', 1, '当前详细地点') || '';
  const currentTime = getCellByHeader('全局数据表', 1, '当前时间') || '';
  const seseEnergy = getCellByHeader('主角信息表', 1, '瑟瑟能量') || '0';
  const mainCharStatus = getCellByHeader('主角信息表', 1, '近况') || '';
  const mainCharName = getCellByHeader('主角信息表', 1, '姓名') || '';
  const config = getConfig();

  $('#sys-location').text(currentLocation || 'LOCATION UNKNOWN').css('cursor', config.mapEnabled ? 'pointer' : '');
  $('#sys-status').text(mainCharStatus || '');
  const sysTimeHtml = buildWeatherIconHTML(16) + escapeHtml(currentTime || '—'); // U2：统一出口
  if (_minimalSysTimeHtml !== sysTimeHtml) { $('#sys-time').html(sysTimeHtml); _minimalSysTimeHtml = sysTimeHtml; }
  const energyHtml = ubIcon('bolt') + escapeHtml(seseEnergy);
  if (_minimalEnergyHtml !== energyHtml) { $('#energy-badge').html(energyHtml); _minimalEnergyHtml = energyHtml; }
  syncWalletEntryMinimal(); // 钱包入口（萦绕静态 DOM）：内芯随刷新同步

  // 主角立绘框：身份栏顶部居中（开关关/空串时移除节点，保证与现状一致）
  let $ppPortrait = $('#sys-protagonist-portrait');
  const ppMarkup = buildProtagonistPortraitBoxHtml();
  if (ppMarkup) {
    if (!$ppPortrait.length) {
      $ppPortrait = $('<div id="sys-protagonist-portrait"></div>').prependTo('.sys-header');
      $ppPortrait.html(ppMarkup);
      _minimalProtagonistPortrait = ppMarkup;
    } else if (_minimalProtagonistPortrait !== ppMarkup) {
      $ppPortrait.html(ppMarkup);
      _minimalProtagonistPortrait = ppMarkup;
    }
    $ppPortrait.show();
  } else {
    $ppPortrait.remove();
    _minimalProtagonistPortrait = '\u0000';
  }

  // 主角姓名
  const $sysCharName = $('#sys-char-name');
  if ($sysCharName.length) {
    if (mainCharName) {
      $sysCharName.text(mainCharName).show();
    } else {
      $sysCharName.hide();
    }
  }

  if (config.darkTheme) {
    mc.classList.add('dark-mode');
    if (config.panelColorMode !== 'tavern') {
      document.body.classList.add('dark-mode');
      document.body.setAttribute('data-ub-dark', '1'); // 源标记：此类由插件 minimal 写入
    }
    $('#theme-toggle-btn').text('DAY');
  } else {
    mc.classList.remove('dark-mode');
    if (config.panelColorMode !== 'tavern') {
      document.body.classList.remove('dark-mode');
      document.body.removeAttribute('data-ub-dark');
    }
    $('#theme-toggle-btn').text('NIGHT');
  }

  // 渲染角色内容
  const presentHtml = buildMinimalPresentChars(config);
  if (_minimalPresentHtml !== presentHtml) {
    $('#present-chars-container').html(presentHtml);
    _minimalPresentHtml = presentHtml;
  }

  // 玩法区可见性（包括头部的静态HTML）
  const playSection = document.getElementById('play-section');
  if (playSection) playSection.style.display = config.nsfwPlayEnabled ? '' : 'none';

  // 渲染玩法区

  if (config.nsfwPlayEnabled) {
    const playHtml = buildMinimalPlayGrid();
    if (_minimalPlayHtml !== playHtml) {
      $('#play-grid').html(playHtml);
      _minimalPlayHtml = playHtml;
    }
  } else {
    _minimalPlayHtml = '\u0000'; // 开关切换后重开时必重写
  }

  // 更新物品使用状态
  updateItemUseToggleMinimal();
  // 更新新手帮助按钮显示
  const playHelpTip = document.getElementById('play-help-tip');
  if (playHelpTip) playHelpTip.style.display = config.showHelpTips ? '' : 'none';

  // 场景切换按钮（minimal 用静态 DOM，需按 config 同步显隐/文字/激活态；
  // renderMinimal 不走 buildHTML 路径，否则按钮永远停留在 display:none）
  // ⚠️ 必须限定到 .minimal-container：切到萦绕前 #ac-content 残留的动态 #ac-scene-btn
  //    在 DOM 顺序上先于静态按钮，全局 $('#ac-scene-btn') 会命中残留按钮（其父容器
  //    display:none，show 无效），导致萦绕容器内的按钮停留在 display:none。
  const $sceneBtn = $('.minimal-container #ac-scene-btn');
  if ($sceneBtn.length) {
    if (config.sceneSwitchEnabled) {
      $sceneBtn.show();
      const sceneLabel = config.sceneSwitchCurrent === 'nsfw' ? '瑟瑟'
        : config.sceneSwitchCurrent === 'daily' ? '日常' : '场景';
      $sceneBtn.text(sceneLabel);
      $sceneBtn.removeClass('scene-active-daily scene-active-nsfw');
      if (config.sceneSwitchCurrent) $sceneBtn.addClass('scene-active-' + config.sceneSwitchCurrent);
    } else {
      $sceneBtn.hide();
    }
  }

  // 渲染选项栏
  const optionsBarContainer = document.getElementById('options-bar-container');
  if (optionsBarContainer) {
    const optionsHtml = buildOptionsBar('minimal');
    if (_minimalOptionsHtml !== optionsHtml) {
      optionsBarContainer.innerHTML = optionsHtml;
      _minimalOptionsHtml = optionsHtml;
    }
  }
}

function updateItemUseToggle(): void {
  const isOn = getConfig().itemUseEnabled;
  const toggle = document.getElementById('ac-item-use-toggle');
  if (toggle) {
    // 古风用雅称，仙侠用法宝，瑟瑟保留原样
    const onText = currentStyle === 'ancient' ? '物件启用' : currentStyle === 'xianxia' ? '法宝催动' : '物品使用 ON';
    const offText = currentStyle === 'ancient' ? '物件停用' : currentStyle === 'xianxia' ? '法宝归寂' : '物品使用 OFF';
    toggle.textContent = isOn ? onText : offText;
    toggle.classList.toggle('active', isOn);
  }
}

function updateItemUseToggleMinimal(): void {
  const isOn = getConfig().itemUseEnabled;
  const toggle = document.getElementById('item-use-toggle');
  if (toggle) {
    toggle.textContent = isOn ? '物品使用 ON' : '物品使用 OFF';
    toggle.classList.toggle('active', isOn);
  }
}

// ===== 共享事件处理函数（消除 $ac/$mc 双轨重复） =====

// ===== 玩法区交互（多选翻新：chips + 选择器弹窗；旧 select/hydrate/骰子/示意图按钮链路已退役）=====

/** 移除单个已选玩法（chip 上的 ×；即时生效：写角色卡 → 重注入 → 刷 chips）。 */
function handlePlayChipRemove(name: string): void {
  const selected = readSelectedPlays().filter(p => p.name !== name);
  if (!writeSelectedPlays(selected)) {
    getToastr()?.error('无法保存到当前角色卡，请确认已打开角色卡', '玩法');
    return;
  }
  syncPlayWorldbook();
  refreshPlayChipsUI();
  getToastr()?.success('已移除：' + name, '玩法');
}

/** 收藏随机（状态栏骰子按钮）：优先从收藏池随机追加 1 条（不与已选重复）；无收藏回落全库。 */
function handlePlayFavoriteRandom(): void {
  const lib = getPlayLibrary();
  const selected = readSelectedPlays();
  const max = getPlayMaxSelected();
  if (selected.length >= max) {
    getToastr()?.warning('已达上限 ' + max + ' 条，可在设置中调整（1-10）', '玩法');
    return;
  }
  const favorites = new Set(lib.favorites);
  const visible = listVisiblePlays(lib);
  const favPool = visible.filter(p => favorites.has(p.name));
  const pool = favPool.length > 0 ? favPool : visible;
  const pick = pickRandomPlay(pool, new Set(selected.map(p => p.name)));
  if (!pick) {
    getToastr()?.warning('没有可随机的新玩法（收藏池已全部选中或库为空）', '提示');
    return;
  }
  selected.push({ name: pick.name, category: pick.category });
  if (!writeSelectedPlays(selected)) {
    getToastr()?.error('无法保存到当前角色卡，请确认已打开角色卡', '玩法');
    return;
  }
  syncPlayWorldbook();
  refreshPlayChipsUI();
  try { (window as any).__ubEmitAchievement?.('play_random', {}); } catch (_e) { /* ignore */ }
  try { (window as any).__ubEmitAchievement?.('play_activated', {}); } catch (_e) { /* ignore */ }
  getToastr()?.success('随机选择成功：' + pick.name, '玩法');
}

async function handlePlayClear(): Promise<void> {
  // 清空全部选中态 → 硬删角色卡 WB 中的聚合玩法条目
  if (!clearPlayState()) {
    getToastr()?.error('无法清空当前角色卡玩法，请确认已打开角色卡', '玩法');
    return;
  }
  disablePlayWorldbook();
  refreshPlayChipsUI();
  getToastr()?.success('玩法已清空', '玩法');
  try { (window as any).__ubEmitAchievement?.('play_clear', {}); } catch (_e) { /* ignore */ }
}

/**
 * 按当前选中态 + 物品开关，把玩法/物品条目重新注入当前角色卡世界书。
 * 用于 init 首屏与 handleReinject（切聊/重注入后角色卡 WB 可能已变，需重 reconciling）。
 * nsfwPlayEnabled 关时不注入。受签名/串行守卫保护，内容未变零写入。
 */
function reconcilePlayWorldbook(): void {
  if (!getConfig().nsfwPlayEnabled) return;
  resetPlayWorldbookCache();
  syncPlayWorldbook();
  syncItemUseEntries(getConfig().itemUseEnabled);
}

async function handleNsfwGuidance(triggerEl: HTMLButtonElement, extraPrompt?: string): Promise<void> {
  // 进行中提示由统一 AI 活动注册表负责；按钮「指导中…」保留。忙态重复点击直接忽略。
  if (isNsfwGuidanceGenerating()) return;

  const originalInput = getNsfwGuidanceInputText();
  if (!originalInput) {
    getToastr()?.warning('请先在输入框中写下本次行动', '瑟瑟指导');
    return;
  }

  const plays = getSelectedNsfwGuidancePlays();
  if (plays.length === 0 && !await showConfirmDialog({ message: '当前没有选择任何玩法，是否仍根据角色输入、人物、场景与上下文生成瑟瑟指导？' })) {
    return;
  }

  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('#ac-nsfw-guidance-btn, #nsfw-guidance-btn'));
  for (const button of buttons) {
    button.disabled = true;
    button.dataset.guidanceOriginalText = button.textContent || '瑟瑟指导';
    button.textContent = '指导中…';
  }

  try {
    const output = await performNsfwGuidance(originalInput, plays, extraPrompt);
    if (!output) return; // 聊天已切换：结果丢弃，不打扰新聊天
    getToastr()?.success('已将行动框架覆盖回输入框', '瑟瑟指导');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    getToastr()?.error(message || '生成失败', '瑟瑟指导');
    console.error('[瑟瑟指导] 生成失败:', error);
  } finally {
    const currentButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#ac-nsfw-guidance-btn, #nsfw-guidance-btn'));
    const restoreTargets = currentButtons.length > 0 ? currentButtons : [triggerEl];
    for (const button of restoreTargets) {
      button.disabled = false;
      button.textContent = button.dataset.guidanceOriginalText || '瑟瑟指导';
      delete button.dataset.guidanceOriginalText;
    }
  }
}

function handleOptionItemClick(el: HTMLElement): void {
  const displayText = el.getAttribute('data-option-text') || '';
  const config = getConfig();

  if (config.optionsBarSendMode === 'send') {
    sendMessageToChat(displayText);
    try {
      const parentDoc = (window.parent as any).document;
      const sendBtn = parentDoc.getElementById('send_but');
      if (sendBtn) {
        setTimeout(() => sendBtn.click(), 100);
      } else {
        const input = parentDoc.getElementById('send_textarea');
        if (input) {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        }
      }
    } catch (e) { /* cross-origin */ }
  } else {
    // 追加到输入框现有文字后
    try {
      const parentDoc = (window.parent as any).document;

      const input = parentDoc.getElementById('send_textarea');
      if (input) {
        const nativeInputValueSetter =
          Object.getOwnPropertyDescriptor((window as any).HTMLTextAreaElement.prototype, 'value')!.set!;
        const currentText = input.value;
        const newText = currentText ? currentText + '\n' + displayText : displayText;
        nativeInputValueSetter.call(input, newText);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch (e) { /* cross-origin */ }
  }

  // 视觉反馈：点击后短暂高亮
  el.style.transform = 'scale(0.97)';
  setTimeout(() => { el.style.transform = ''; }, 150);
}

async function handleItemUseToggle(btnEl: HTMLElement): Promise<void> {
  const isCurrentlyOn = btnEl.classList.contains('active');
  const newState = !isCurrentlyOn;
  // 物品使用改为注入头/尾条目（深度/顺序与原 WB 一致），乐观切换，注入失败仅 console 警告。
  syncItemUseEntries(newState);
  setConfig('itemUseEnabled', newState);
  void setWorldbookProjectionEnabled('item-use', newState && getConfig().nsfwPlayEnabled === true);
  const isAncient = currentStyle === 'ancient';
  const isXianxia = currentStyle === 'xianxia';
  getToastr()?.success(
    isAncient ? (newState ? '物件已启用' : '物件已停用') : isXianxia ? (newState ? '法宝已催动' : '法宝已归寂') : ('物品使用已' + (newState ? '开启' : '关闭')),
    '玩法'
  );
  btnEl.textContent = newState
    ? (isAncient ? '物件启用' : isXianxia ? '法宝催动' : '物品使用 ON')
    : (isAncient ? '物件停用' : isXianxia ? '法宝归寂' : '物品使用 OFF');
  btnEl.classList.toggle('active', newState);
}

// ===== 通知徽章注入 =====
/** 动态注入通知徽章到入口按钮旁（避免修改大型 HTML builder） */
let _lastBadgeSig = ''; // 上次注入的徽章签名，计数未变时跳过 DOM 操作
function renderBadges(): void {
  // 签名：item/mission/memo 计数 + 当前主题（不同主题产生不同 HTML）
  const sig = getBadgeCount('item') + '|' + getBadgeCount('mission') + '|' + getBadgeCount('memo') + '|' + currentStyle;
  if (sig === _lastBadgeSig) return; // 计数与主题均未变，跳过 DOM 操作
  _lastBadgeSig = sig;

  const style = currentStyle;

  // 清理旧徽章
  document.querySelectorAll('.ub-badge').forEach(el => el.remove());
  // 清理旧的 wrapper
  document.querySelectorAll('.ub-btn-badged').forEach(el => {
    el.classList.remove('ub-btn-badged');
  });

  // 辅助：将徽章注入按钮内部
  function inject(btnId: string, html: string): void {
    if (!html) return;
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.classList.add('ub-btn-badged');
    btn.insertAdjacentHTML('beforeend', html);
  }

  // 物品徽章
  inject('ac-item-head-btn', itemBadgeHTML(style));
  inject('item-btn', itemBadgeHTML(style));
  // 任务徽章
  inject('ac-mission-head-btn', missionBadgeHTML(style));
  inject('mission-btn', missionBadgeHTML(style));
  // 备忘录徽章
  inject('ac-memo-head-btn', memoBadgeHTML(style));
  inject('memo-btn', memoBadgeHTML(style));
}

// ===== 事件绑定 =====
function bindEvents(): void {
  const $ac = $('#ac-content');
  const $mc = $('.minimal-container');
  const acEl = $ac[0] as HTMLElement | undefined;
  const mcEl = $mc[0] as HTMLElement | undefined;

  // “周期”文字保持原样，仅作为委托触发器打开当前人物的参数管理窗口。
  const openCycleManager = function (e: JQuery.ClickEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const name = String((e.currentTarget as HTMLElement).dataset.cycleName || '');
    if (name) showCycleManagerPopup(name, currentStyle, () => render(true));
  };
  $ac.off('click.ac-cycle-manager').on('click.ac-cycle-manager', '.cycle-manage-trigger', openCycleManager);
  $mc.off('click.ac-cycle-manager').on('click.ac-cycle-manager', '.cycle-manage-trigger', openCycleManager);

  // 角色名牌点击 - 古风
  $ac.off('click.ac-tab').on('click.ac-tab', '.spine-label', function (e) {
    (window as any)._activeChar = $(this).data('char');
    (window as any)._activeBeyond = false; // 切角色退出镜头之外视图
    // 非强制：activeChar 已纳入渲染签名（composeRenderSignature:776），换角色→签名变→重建；
    // 点击已激活的同一角色→签名不变→跳过无谓全量重建。涟漪/爆裂特效照常触发。
    render();
    if (!isReadingTheme(currentStyle)) {
      spawnTabRipple(this, currentStyle);
      spawnEroticBurst(e.clientX, e.clientY, currentStyle);
    }
  });

  // 角色Tab点击 - 瑟瑟/甜恋
  $ac.off('click.ac-tab2').on('click.ac-tab2', '.tab', function (e) {
    (window as any)._activeChar = $(this).data('char');
    (window as any)._activeBeyond = false; // 切角色退出镜头之外视图
    render(); // 非强制：activeChar 在签名内，换角色才重建（见上 ac-tab 注释）
    spawnTabRipple(this, currentStyle);
    spawnEroticBurst(e.clientX, e.clientY, currentStyle);
  });

  // 角色丸点击 - 仙侠
  $ac.off('click.ac-xianxia-pill').on('click.ac-xianxia-pill', '.xx-char-pill', function (e) {
    (window as any)._activeChar = $(this).data('char');
    (window as any)._activeBeyond = false; // 切角色退出镜头之外视图
    render(); // 非强制：activeChar 在签名内，换角色才重建（见上 ac-tab 注释）
    if (!isReadingTheme(currentStyle)) {
      spawnTabRipple(this, currentStyle);
      spawnEroticBurst(e.clientX, e.clientY, currentStyle);
    }
  });

  // 古风/仙侠角色页签键盘导航：方向键移动焦点并切换活跃角色，Home/End 跳首尾。
  // 单一委托处理器，绑定在 #ac-content 上，不随每次渲染新增 document listener。
  $ac.off('keydown.ac-literary-tabs').on('keydown.ac-literary-tabs', '.ub-character-tabs[role="tablist"] .ub-char-tab', function (e) {
    const self = this as HTMLButtonElement;
    const container = self.parentElement;
    if (!container) return;
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('.ub-char-tab'));
    if (tabs.length === 0) return;
    const idx = tabs.indexOf(self);
    let next = idx;
    switch (e.key) {
      case 'ArrowRight': next = (idx + 1) % tabs.length; break;
      case 'ArrowLeft': next = (idx - 1 + tabs.length) % tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    e.preventDefault();
    const target = tabs[next];
    if (!target) return;
    target.focus();
    (window as any)._activeChar = $(target).data('char');
    (window as any)._activeBeyond = false; // 切角色退出镜头之外视图
    render();
  });

  // 角色名点击 - 跳转角色中枢详情页
  function handleCharNameClick(e: JQuery.ClickEvent): void {
    e.stopPropagation();
    const char = (window as any)._activeChar;
    if (char) showCharacterInfoPopup(currentStyle, char);
  }
  $ac.off('click.ac-name').on('click.ac-name', '#ac-char-name', handleCharNameClick);

  // 主界面「与主角关系」类别色胶囊 → 打开人物关系网并定位该角色（全主题通用委托）
  function bindRelationPick($scope: JQuery): void {
    $scope.off('click.ac-rel-pick').on('click.ac-rel-pick', '[data-ub-rel-pick]', function (e) {
      e.stopPropagation();
      const name = String($(this).data('ubRelPick') || '').trim();
      if (name) showCharacterRelationGraphPopup({ style: currentStyle, initialFocus: name });
    });
  }
  bindRelationPick($ac);
  bindRelationPick($mc);

  // ===== 镜头之外视图（2026-08-21 拍板）：内存态，pagehide 清空 =====
  function enterBeyondView(): void {
    if ((window as any)._activeBeyond) return;
    (window as any)._activeBeyond = true;
    if (!Array.isArray((window as any)._beyondBatch)) {
      const st = loadWorldState();
      (window as any)._beyondBatch = initialBeyondBatch(Object.values(st.profiles || {}), BEYOND_CHAR_MAX).map(p => p.name);
    }
    render();
  }
  function reshuffleBeyond(): void {
    const st = loadWorldState();
    const cur = Array.isArray((window as any)._beyondBatch) ? (window as any)._beyondBatch : [];
    (window as any)._beyondBatch = pickBeyondBatch(Object.values(st.profiles || {}), cur, BEYOND_CHAR_MAX).map(p => p.name);
    render();
  }
  // 镜头之外：页签切换 / 换一批 / 点卡联动（$ac 主容器 + $mc minimal 双绑定）
  function bindBeyondDelegates($scope: JQuery): void {
    $scope.off('click.ac-beyond').on('click.ac-beyond', '.ub-beyond-tab', function (e) {
      e.stopPropagation();
      enterBeyondView();
    });
    $scope.off('click.ac-beyond-reshuffle').on('click.ac-beyond-reshuffle', '.ub-beyond-reshuffle', function (e) {
      e.stopPropagation();
      reshuffleBeyond();
    });
    $scope.off('click.ac-beyond-rumor').on('click.ac-beyond-rumor', '.ub-beyond-rumor', function (e) {
      e.stopPropagation();
      showWorldWindow(currentStyle, undefined, 'front');
    });
    $scope.off('click.ac-beyond-char-card').on('click.ac-beyond-char-card', '.ub-beyond-char', function (e) {
      e.stopPropagation();
      showWorldWindow(currentStyle, undefined, 'back');
    });
    $scope.off('click.ac-beyond-char-name').on('click.ac-beyond-char-name', '.ub-beyond-char-name', function (e) {
      e.stopPropagation();
      const n = String($(this).data('beyondChar') || '');
      if (n) showCharacterInfoPopup(currentStyle, n);
    });
  }
  bindBeyondDelegates($ac);
  bindBeyondDelegates($mc);

  // 主角姓名点击 - 角色信息弹窗（全主题通用，通过 data-clickable 属性委托）
  $ac.off('click.ac-char-info').on('click.ac-char-info', '[data-clickable="char-name"]', function (e) {
    e.stopPropagation();
    showCharacterInfoPopup(currentStyle);
  });

  // 萦绕主题主角姓名点击（minimal 容器中的 #sys-char-name）
  $mc.off('click.ac-char-info-minimal').on('click.ac-char-info-minimal', '#sys-char-name', function (e) {
    e.stopPropagation();
    showCharacterInfoPopup('minimal');
  });

  // 功能按钮
  $ac.off('click.ac-memo-head').on('click.ac-memo-head', '#ac-memo-head-btn', () => { clearBadge('memo'); showMemoPopup(currentStyle); });
  $ac.off('click.ac-chronicle').on('click.ac-chronicle', '#ac-chronicle-btn', () => { showChronicleReaderPopup(currentStyle); });
  $ac.off('click.ac-item-head').on('click.ac-item-head', '#ac-item-head-btn', () => { clearBadge('item'); showItemPopup(currentStyle); });
  // 货币 chip（iOS hero / 古风仙侠 masthead 共用 id；点击开货币弹窗）
  // 另含三风格钱包入口 #ac-wallet-btn（甜蜜/撩人/舰桥）；萦绕静态 DOM 的 #ac-wallet-btn-minimal 在 $mc 域绑定
  $ac.off('click.ac-currency').on('click.ac-currency', '#ac-currency-chip,#ac-currency-more,#ac-currency-btn,#ac-wallet-btn', () => { showCurrencyPopup(currentStyle); });
  $ac.off('click.ac-mission-head').on('click.ac-mission-head', '#ac-mission-head-btn', () => { /* 任务徽章为状态驱动，不清除——已完成条目持续提示直到删除 */ showMissionPopup(currentStyle); });

  // 商店按钮（关闭态早退：按钮本应被 updateFeatureButtonVisibility 隐藏，但历史遗留的
  // 无条件输出 + 重建会漏出可见按钮，此处兜底，防关闭开关被绕过）
  $ac.off('click.ac-lottery-head').on('click.ac-lottery-head', '#ac-lottery-head-btn', async function () {
    if (!getConfig().shopEnabled) return;
    await showShopPopup(currentStyle, render);
  });

  // 日记按钮
  $ac.off('click.ac-diary').on('click.ac-diary', '#ac-diary-btn', function () {
    const char = (window as any)._activeChar;
    if (char) showDiaryPopup(char, currentStyle);
  });

  // 详情面板切换
  $ac.off('click.ac-switch-clothes').on('click.ac-switch-clothes', '#ac-switch-clothes', function () {
    const clothesEl = document.getElementById('ac-clothes-list');
    const bodyEl = document.getElementById('ac-body-list');
    if (clothesEl) clothesEl.style.display = '';
    if (bodyEl) bodyEl.style.display = 'none';
    $(this).addClass('active-switch');
    $('#ac-switch-body').removeClass('active-switch');
  });
  $ac.off('click.ac-switch-body').on('click.ac-switch-body', '#ac-switch-body', function () {
    const clothesEl = document.getElementById('ac-clothes-list');
    const bodyEl = document.getElementById('ac-body-list');
    if (clothesEl) clothesEl.style.display = 'none';
    if (bodyEl) bodyEl.style.display = '';
    $(this).addClass('active-switch');
    $('#ac-switch-clothes').removeClass('active-switch');
  });

  // 瑟瑟指导按钮（U10：统一走 long-press）：短按直接生成，长按弹额外指导要求输入框
  _nsfwLpAc?.stop();
  _nsfwLpAc = acEl ? bindLongPressDelegated<HTMLButtonElement>(acEl, '#ac-nsfw-guidance-btn', {
    onShort: (btn) => { void handleNsfwGuidance(btn); },
    onLong: (btn) => { showNsfwGuidanceExtraPromptDialog((extra) => { void handleNsfwGuidance(btn, extra); }); },
  }) : null;

  $ac.off('click.ac-play-collapse').on('click.ac-play-collapse', '#ac-play-collapse-btn', function (e) {
    if ((e.target as HTMLElement).closest('#ac-nsfw-guidance-btn')) return;
    const ps = document.getElementById('ac-play-section');
    if (!ps) return;
    const isCollapsed = ps.classList.toggle('collapsed');
    const body = document.getElementById('ac-play-body');
    if (body) {
      // 古风/仙侠新结构：用 hidden + aria-expanded 同步
      body.hidden = isCollapsed;
      this.setAttribute('aria-expanded', String(!isCollapsed));
    } else if (currentStyle !== 'xianxia') {
      // 其余主题旧结构：折叠按钮文字 +/−（仙侠旧用箭头旋转，不替换文字）
      this.textContent = isCollapsed ? '+' : '−';
    }
    setConfig('playCollapsed', isCollapsed);
  });

  // 主题切换 - 古风
  $ac.off('click.ac-theme').on('click.ac-theme', '#ac-theme-btn', function () {
    const container = document.getElementById('ac-content')!;
    container.classList.toggle('dark');
    const isDark = container.classList.contains('dark');
    // ios/bridge 渲染器把 dark-mode 烤进 #ac-book 根类（buildHTML 时按 config 快照）；
    // 只翻 #ac-content.dark 时根上残留的 .book.dark-mode 会把深色 token 组原样顶回
    // （症状：深→浅点击无效，须等下一次重渲染才生效）——切换时即时同步根类。
    if (currentStyle === 'ios' || currentStyle === 'bridge') {
      document.getElementById('ac-book')?.classList.toggle('dark-mode', isDark);
    }
    setConfig('darkTheme', isDark);
    // 自适应通知皮肤即时跟随明暗切换（深色切换不走 config-change 回调，须直连重算 ub-skin-*）
    {
      const _cfg = getConfig();
      setNotifyBeautifyEnabled(_cfg.notifyEffect !== 'original', _cfg.style, _cfg.notifyAlign, _cfg.notifyEffect, isDark);
    }
    // 成就打点：切换深色模式（4 主题共用此按钮）
    try { (window as any).__ubEmitAchievement?.('dark_mode_toggle', {}); } catch (_e) { /* ignore */ }
    // 根据当前风格使用不同的主题切换文案
    if (currentStyle === 'flirtatious') {
      this.textContent = isDark ? '亮粉' : '暗夜';
    } else if (currentStyle === 'sweet') {
      this.textContent = isDark ? '☀️' : '🌙';
    } else if (currentStyle === 'bridge') {
      this.textContent = isDark ? '晨雾模式' : '深空模式';
    } else if (currentStyle === 'ios') {
      this.textContent = isDark ? '浅色' : '深色';
    } else {
      // 古风/仙侠：统一太阳/月亮图标（与 literary-statusbar 初始渲染一致）
      const label = isDark ? '浅色' : '深色';
      this.setAttribute('aria-label', label);
      this.title = label;
      this.innerHTML = isDark
        ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
        : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    }
  });

  // 设置按钮
  $ac.off('click.ac-settings').on('click.ac-settings', '#ac-settings-btn', () => { showPopupOrToggle('settings', () => showConfigPanel(currentStyle)); });

  // 古风/仙侠合并风格：状态栏内配色切换（ancient↔xianxia）
  $ac.off('click.ac-scheme-toggle').on('click.ac-scheme-toggle', '#ac-scheme-toggle', function () {
    const next: StyleType = currentStyle === 'ancient' ? 'xianxia' : 'ancient';
    setConfig('style', next);
    setConfig('literaryScheme', next);
    notifyConfigChanged();
  });
  $mc.off('click.ac-settings-min').on('click.ac-settings-min', '#ac-settings-btn-minimal', () => { showPopupOrToggle('settings', () => showConfigPanel('minimal')); });

  // 数据库按钮（顶栏设置 ⚙ 旁的 🗄 快捷入口，4 主题 + minimal）
  $ac.off('click.ac-database').on('click.ac-database', '#ac-database-btn', () => { showPopupOrToggle('database', () => showDatabasePopup(currentStyle)); });
  $mc.off('click.ac-database-min').on('click.ac-database-min', '#ac-database-btn-minimal', () => { showPopupOrToggle('database', () => showDatabasePopup('minimal')); });

  // 成就簿按钮（系统级统计，数据库 🗄 左侧的 🏅 入口，4 主题 + minimal）
  $ac.off('click.ac-achievement').on('click.ac-achievement', '#ac-achievement-btn', () => { showPopupOrToggle('achievements', () => showAchievementPopup(currentStyle)); });
  $mc.off('click.ac-achievement-min').on('click.ac-achievement-min', '#ac-achievement-btn-minimal', () => { showPopupOrToggle('achievements', () => showAchievementPopup('minimal')); });
  // 主角技能与天赋树（4 主题按钮 + minimal 折叠菜单入口）
  $ac.off('click.ac-skill').on('click.ac-skill', '#ac-skill-btn', () => { showPopupOrToggle('skill', () => showSkillPopup(currentStyle)); });
  $mc.off('click.ac-skill-min').on('click.ac-skill-min', '#ac-skill-btn', () => { showPopupOrToggle('skill', () => showSkillPopup('minimal')); });
  // 衣柜入口与主角穿搭摘要共用同一个窗口；minimal 的摘要也由静态容器委托处理。
  $ac.off('click.ac-wardrobe').on('click.ac-wardrobe', '#ac-wardrobe-btn, #ac-wardrobe-summary', () => {
    showPopupOrToggle('wardrobe', () => { void openWardrobePanel(currentStyle); });
  });
  $mc.off('click.ac-wardrobe-min').on('click.ac-wardrobe-min', '#ac-wardrobe-btn, #ac-wardrobe-summary', () => {
    showPopupOrToggle('wardrobe', () => { void openWardrobePanel('minimal'); });
  });

  // 场景一键切换按钮（顶栏两态按钮：日常 ↔ 瑟瑟）
  // 同时绑定 $ac（4 个主题动态 HTML）和 $mc（minimal 静态 body），用命名空间避免重复
  async function handleSceneBtnClick(btn: HTMLElement): Promise<void> {
    const cfg = getConfig();
    if (!cfg.sceneSwitchEnabled) {
      getToastr()?.info('请在设置 → API → 场景切换中启用并配置', '场景切换未启用');
      return;
    }
    if (isSceneApplying()) {
      getToastr()?.warning('正在切换中，请稍候', '场景切换');
      return;
    }
    // 在两个档位之间 toggle：当前是 daily → nsfw；否则 → daily
    const next: SceneMode = cfg.sceneSwitchCurrent === 'daily' ? 'nsfw' : 'daily';
    const preErr = validateSceneProfile(next);
    if (preErr) {
      getToastr()?.error(preErr, '场景切换');
      return;
    }
    const orig = btn.textContent;
    (btn as HTMLButtonElement).disabled = true;
    btn.textContent = '切换中';
    try {
      await applyScene(next);
      getToastr()?.success('已切换到「' + (next === 'daily' ? '日常' : '瑟瑟') + '」，酒馆主连接已更新', '场景切换');
      // 刷新按钮文字 + 激活态（minimal 用静态 DOM，单独同步）
      const newLabel = next === 'daily' ? '日常' : '瑟瑟';
      btn.textContent = newLabel;
      btn.classList.remove('scene-active-daily', 'scene-active-nsfw');
      btn.classList.add('scene-active-' + next);
      // minimal 容器内也要同步（若按钮在 minimal 容器）
      const $mcScene = $mc.find('#ac-scene-btn');
      if ($mcScene.length && $mcScene[0] !== btn) {
        $mcScene.text(newLabel);
        $mcScene.removeClass('scene-active-daily scene-active-nsfw');
        $mcScene.addClass('scene-active-' + next);
      }
    } catch (e) {
      const msg = (e as any)?.message || String(e);
      getToastr()?.error(msg, '场景切换失败');
      btn.textContent = orig; // 失败时还原文字
    } finally {
      (btn as HTMLButtonElement).disabled = false;
    }
  }
  $ac.off('click.ac-scene').on('click.ac-scene', '#ac-scene-btn', function () { void handleSceneBtnClick(this as HTMLElement); });
  $mc.off('click.ac-scene-mc').on('click.ac-scene-mc', '#ac-scene-btn', function () { void handleSceneBtnClick(this as HTMLElement); });

  // 选项栏点击
  $ac.off('click.ac-option-item').on('click.ac-option-item', '.option-item', function (e) {
    e.stopPropagation();
    handleOptionItemClick(this);
  });
  $mc.off('click.ac-option-item-min').on('click.ac-option-item-min', '.option-item', function (e) {
    e.stopPropagation();
    handleOptionItemClick(this);
  });
  // 浮动选项栏（跟随底部模式，独立于 #ac-content / .minimal-container）
  $(document).off('click.ac-option-item-float').on('click.ac-option-item-float', '#ac-options-bar-floating .option-item', function (e) {
    e.stopPropagation();
    handleOptionItemClick(this);
  });

  // 大调查按钮（U10：统一走 long-press）：短按调查，长按弹额外提示词输入框
  _invLpAc?.stop();
  _invLpAc = acEl ? bindLongPressDelegated<HTMLButtonElement>(acEl, '#ac-investigate-btn', {
    canStart: (btn) => { const n = String($(btn).data('name') || ''); return !!n && !isInvestigating(n); },
    onShort: (btn) => {
      const charName = String($(btn).data('name') || '');
      if (charName && !isInvestigating(charName)) showInvestigationPopup(charName, currentStyle, btn);
    },
    onLong: (btn) => {
      const charName = String($(btn).data('name') || '');
      if (charName && !isInvestigating(charName)) void showInvestigationExtraPromptDialog(charName, currentStyle, btn);
    },
  }) : null;

  // 大采访按钮：首次打开配置，已有记录则直接查看档案
  $ac.off('.ac-interview').on('click.ac-interview', '#ac-interview-btn', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const charName = String($(this).data('name') || '').trim();
    if (!charName || isInterviewing(charName)) return;
    hasInterview(charName)
      ? showInterviewContent(charName, currentStyle)
      : showInterviewConfigPopup(charName, currentStyle, this as HTMLButtonElement);
  });

  // 过往经历按钮 - 古风/瑟瑟/甜恋
  $ac.off('click.ac-past-exp').on('click.ac-past-exp', '#ac-past-exp-btn', function (e) {
    e.stopPropagation();
    const charName = $(this).data('name');
    if (charName) {
      showPastExperiencePopup(charName, currentStyle);
    }
  });

  // 玩法区 chips（多选翻新）：× 移除单条 / 点 chip 主体开选择器定位详情 / ＋ 添加 / 收藏随机
  $ac.off('click.ac-play-chips').on('click.ac-play-chips', '[data-play-chip], #ac-play-add-btn, #ac-play-dice-btn', function (e) {
    const removeBtn = (e.target as HTMLElement).closest('[data-play-remove]');
    if (removeBtn) { e.stopPropagation(); handlePlayChipRemove((removeBtn as HTMLElement).dataset.playRemove || ''); return; }
    const el = this as HTMLElement;
    if (el.id === 'ac-play-dice-btn') { handlePlayFavoriteRandom(); return; }
    if (el.id === 'ac-play-add-btn') { showPlaySelectorPopup(currentStyle); return; }
    showPlaySelectorPopup(currentStyle, el.dataset.playChip || undefined);
  });

  // 清空玩法（关闭体位条目 + 关闭所有"玩法-"前缀条目）
  $ac.off('click.ac-play-clear').on('click.ac-play-clear', '#ac-play-clear-btn, #play-clear-btn', function () {
    void handlePlayClear();
  });

  // 物品使用切换（通过世界书条目"物品使用ON"管理）
  $ac.off('click.ac-item-use-toggle').on('click.ac-item-use-toggle', '#ac-item-use-toggle', function () {
    handleItemUseToggle(this);
  });

  // 点击特效 - 古风/瑟瑟
  $ac.off('click.ac-book').on('click.ac-book', '.book', function (e) {
    if (isReadingTheme(currentStyle)) return; // 古风/仙侠阅读优先：禁用随机点击爱心/漂字/粒子
    const tab = (e.target as HTMLElement).closest('.spine-label, .tab');
    if (tab) return;
    const item = (e.target as HTMLElement).closest('.bound-page, .char-clothes-item');
    if (item) {
      item.classList.remove('touched');
      void (item as HTMLElement).offsetWidth;
      item.classList.add('touched');
      setTimeout(() => item.classList.remove('touched'), 1000);
      spawnInkSparks(e.clientX, e.clientY, 5);
      spawnDrips(e.clientX, e.clientY, 4);
      spawnClickText(e.clientX + 20, e.clientY - 20, currentStyle,
        currentStyle === 'ancient' ?
          ['不要看...❀', '别撕...❀', '裙子...', '喵...别脱...❀', '还在...❀', '求你...', '不要脱...❀', '嗯...别动...❀', '好羞...❀', '遮住了...', '不要拉...❀', '还穿着呢...❀', '别急...', '嗯喵...❀', '轻一点...❀'] :
        currentStyle === 'sweet' ?
          ['不要看...💕', '别撕...🩷', '裙子...', '喵...别脱...🧸', '还在...💗', '求你...🥺', '不要脱...💝', '嗯...别动...🎀', '好羞...😳', '遮住了...💦', '不要拉...💌', '还穿着呢...🌸', '别急...💓', '嗯喵...✨', '轻一点...💖'] :
        currentStyle === 'xianxia' ?
          ['别看...✨', '仙衣...', '不要...⚘', '呀...别脱...✦', '还在...❊', '求你...', '好羞...☯', '嗯...别动...💫', '遮住了...', '不要拉...✨', '还穿着呢...⚘', '别急...', '嗯...☯', '轻一点...💫', '道心要乱了...✦'] :
          ['不要看...♥', '别撕...♥', '裙子...', '喵...别脱...♥', '还在...♥', '求你...', '不要脱...♥', '嗯...别动...♥', '好羞...♥', '遮住了...', '不要拉...♥', '还穿着呢...♥', '别急...', '嗯喵...♥', '轻一点...♥']
      );
      return;
    }
    spawnClickHeart(e.clientX, e.clientY, currentStyle);
    if (Math.random() > 0.5) spawnClickText(e.clientX, e.clientY, currentStyle);
  });

  // ===== 日历弹窗事件 =====
  $ac.off('click.ac-calendar').on('click.ac-calendar', '.title-time, .book-head-time, .bubble-tag.mint, .xx-time, [data-clickable="calendar-time"]', function (e) {
    e.stopPropagation();
    showCalendarPopup(currentStyle);
  });
  $mc.off('click.ac-calendar-min').on('click.ac-calendar-min', '#sys-time', function (e) {
    e.stopPropagation();
    showCalendarPopup('minimal');
  });

  // ===== 萦绕风格事件 =====
  // 人物选择（排除镜头之外页签：其复用 char-select-btn 形制，由上方 .ub-beyond-tab 委托处理）
  $mc.off('click', '.char-select-btn').on('click', '.char-select-btn:not(.ub-beyond-tab)', function () {
    (window as any)._activeChar = $(this).data('char');
    (window as any)._activeBeyond = false; // 切角色退出镜头之外视图
    render(); // 非强制：activeChar 在签名内，换角色才重建，点当前角色跳过
  });

  // 悬浮提示
  $mc.off('mouseenter.tooltip', '.name-hoverable').on('mouseenter.tooltip', '.name-hoverable', function () {
    const el = this as HTMLElement;
    const age = el.dataset.age;
    const intro = el.dataset.intro;
    if (!age && !intro) return;
    const tooltip = document.getElementById('char-tooltip')!;
    let tipHtml = '';
    if (age) tipHtml += '<div class="char-tooltip-age">' + escapeHtml(age) + '</div>';
    if (intro) tipHtml += '<div class="char-tooltip-intro">' + escapeHtml(intro) + '</div>';
    tooltip.innerHTML = tipHtml;
    const rect = el.getBoundingClientRect();
    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    tooltip.style.top = (rect.top - 8) + 'px';
    tooltip.style.transform = 'translate(-50%, -100%)';
    tooltip.classList.add('visible');
  }).off('mouseleave.tooltip', '.name-hoverable').on('mouseleave.tooltip', '.name-hoverable', () => {
    const tooltip = document.getElementById('char-tooltip');
    if (tooltip) tooltip.classList.remove('visible');
  });

  // 展开/收起
  $mc.off('click', '.status-toggle').on('click', '.status-toggle', function () {
    const content = $(this).next('.status-content');
    $(this).toggleClass('active');
    if (content.is(':visible')) {
      content.slideUp(250);
    } else {
      content.slideDown(250);
    }
  });

  // 功能按钮
  $mc.off('click', '#item-btn').on('click', '#item-btn', () => { clearBadge('item'); showItemPopup('minimal'); });
  $mc.off('click', '#mission-btn').on('click', '#mission-btn', () => { /* 任务徽章为状态驱动，不清除 */ showMissionPopup('minimal'); });
  $mc.off('click', '#memo-btn').on('click', '#memo-btn', () => { clearBadge('memo'); showMemoPopup('minimal'); });
  $mc.off('click.ac-chronicle-min').on('click.ac-chronicle-min', '#ac-chronicle-btn', () => { showChronicleReaderPopup('minimal'); });
  // 钱包入口（F35）：#ac-wallet-btn-minimal 在 minimal 静态 DOM（#ac-content 外），$ac 委托够不到，须在此域绑定
  $mc.off('click.ac-currency-min').on('click.ac-currency-min', '#ac-wallet-btn-minimal', () => { showCurrencyPopup('minimal'); });

  // 商店（关闭态早退，理由同动态主题侧 #ac-lottery-head-btn 处理器）
  $mc.off('click', '#lottery-btn').on('click', '#lottery-btn', async function () {
    if (!getConfig().shopEnabled) return;
    await showShopPopup('minimal', render);
  });

  // 调教值点击
  $mc.off('click', '.train-value-clickable').on('click', '.train-value-clickable', function (e) {
    e.stopPropagation();
    const name = $(this).data('name');
    if (name) showCharacterInfoPopup('minimal', name);
  });

  // 日记预览点击
  $mc.off('click', '.diary-preview-clickable').on('click', '.diary-preview-clickable', function (e) {
    e.stopPropagation();
    const charName = $(this).data('name');
    if (charName) showDiaryPopup(charName, 'minimal');
  });

  // 大调查按钮 - 萦绕风格（U10：统一走 long-press）：短按调查，长按弹额外提示词输入框
  _invLpMc?.stop();
  _invLpMc = mcEl ? bindLongPressDelegated<HTMLButtonElement>(mcEl, '#ac-investigate-btn', {
    canStart: (btn) => { const n = String($(btn).data('name') || ''); return !!n && !isInvestigating(n); },
    onShort: (btn) => {
      const charName = String($(btn).data('name') || '');
      if (charName && !isInvestigating(charName)) showInvestigationPopup(charName, currentStyle, btn);
    },
    onLong: (btn) => {
      const charName = String($(btn).data('name') || '');
      if (charName && !isInvestigating(charName)) void showInvestigationExtraPromptDialog(charName, currentStyle, btn);
    },
  }) : null;

  // 大采访按钮 - 萦绕风格：首次打开配置，已有记录则直接查看档案
  $mc.off('.ac-interview-mc').on('click.ac-interview-mc', '#ac-interview-btn', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const charName = String($(this).data('name') || '').trim();
    if (!charName || isInterviewing(charName)) return;
    hasInterview(charName)
      ? showInterviewContent(charName, currentStyle)
      : showInterviewConfigPopup(charName, currentStyle, this as HTMLButtonElement);
  });

  // 过往经历按钮 - 萦绕风格
  $mc.off('click', '#ac-past-exp-btn').on('click', '#ac-past-exp-btn', function (e) {
    e.stopPropagation();
    const charName = $(this).data('name');
    if (charName) {
      showPastExperiencePopup(charName, currentStyle);
    }
  });

  // 主题切换
  $mc.off('click', '#theme-toggle-btn').on('click', '#theme-toggle-btn', function () {
    const container = $('.minimal-container');
    container.toggleClass('dark-mode');
    const isDark = container.hasClass('dark-mode');
    $(this).text(isDark ? 'DAY' : 'NIGHT');
    setConfig('darkTheme', isDark);
    // 自适应通知皮肤即时跟随明暗切换（深色切换不走 config-change 回调，须直连重算 ub-skin-*）
    {
      const _cfg = getConfig();
      setNotifyBeautifyEnabled(_cfg.notifyEffect !== 'original', _cfg.style, _cfg.notifyAlign, _cfg.notifyEffect, isDark);
    }
    // 成就打点：切换深色模式（萦绕主题）
    try { (window as any).__ubEmitAchievement?.('dark_mode_toggle', {}); } catch (_e) { /* ignore */ }
    // 同步 body class 以便固定定位的弹窗（nsfw/panel/settings overlay）继承暗色变量；
    // 跟随酒馆模式下由弹窗打开时按酒馆明暗接管，插件明暗不覆盖
    if (isDark) {
      if (getConfig().panelColorMode !== 'tavern') {
        document.body.classList.add('dark-mode');
        document.body.setAttribute('data-ub-dark', '1'); // 源标记：minimal 写入
      }
    } else {
      if (getConfig().panelColorMode !== 'tavern') {
        document.body.classList.remove('dark-mode');
        document.body.removeAttribute('data-ub-dark');
      }
    }
  });

  // 玩法区 - 萦绕（使用 scoped 选择器，避免与 #ac-content 中同名 ID 冲突）
  $mc.off('click', '#play-collapse-btn').on('click', '#play-collapse-btn', function () {
    const ps = document.querySelector('.minimal-container #play-section') as HTMLElement;
    if (!ps) return;
    const isCollapsed = ps.classList.toggle('collapsed');
    this.textContent = isCollapsed ? '+' : '−';
  });

  // 玩法区 chips - 萦绕（多选翻新，同 $ac 委托）
  $mc.off('click.ac-play-chips-min').on('click.ac-play-chips-min', '[data-play-chip], #ac-play-add-btn, #ac-play-dice-btn', function (e) {
    const removeBtn = (e.target as HTMLElement).closest('[data-play-remove]');
    if (removeBtn) { e.stopPropagation(); handlePlayChipRemove((removeBtn as HTMLElement).dataset.playRemove || ''); return; }
    const el = this as HTMLElement;
    if (el.id === 'ac-play-dice-btn') { handlePlayFavoriteRandom(); return; }
    if (el.id === 'ac-play-add-btn') { showPlaySelectorPopup(currentStyle); return; }
    showPlaySelectorPopup(currentStyle, el.dataset.playChip || undefined);
  });

  // 清空玩法 - 萦绕（关闭体位条目 + 关闭所有"玩法-"前缀条目）
  $mc.off('click', '#play-clear-btn').on('click', '#play-clear-btn', function () {
    void handlePlayClear();
  });

  // 物品使用切换 - 萦绕（通过世界书条目管理）
  $mc.off('click', '#item-use-toggle').on('click', '#item-use-toggle', function () {
    handleItemUseToggle(this);
  });

  // 瑟瑟指导按钮 - 萦绕风格（U10：统一走 long-press）
  _nsfwLpMc?.stop();
  _nsfwLpMc = mcEl ? bindLongPressDelegated<HTMLButtonElement>(mcEl, '#nsfw-guidance-btn', {
    onShort: (btn) => { void handleNsfwGuidance(btn); },
    onLong: (btn) => { showNsfwGuidanceExtraPromptDialog((extra) => { void handleNsfwGuidance(btn, extra); }); },
  }) : null;


  // 点击特效 - 萦绕
  $mc.off('click.ac-effects').on('click.ac-effects', function (e) {
    const btn = (e.target as HTMLElement).closest('button');
    if (btn) return;
    const select = (e.target as HTMLElement).closest('select');
    if (select) return;
    spawnClickHeart(e.clientX, e.clientY, 'minimal');
    if (Math.random() > 0.5) spawnClickText(e.clientX, e.clientY, 'minimal');
  });

  // 地图弹窗：点击主界面"当前地点"打开
  // 无条件绑定委托：bindEvents 仅在初始化/reinject 时调用，配置变更后 render(true) 不会重绑。
  // 若按 mapEnabled 快照条件绑定，关闭再打开地图时绑定不会恢复 → 点击无反应。

  // 改为始终委托到稳定容器，是否带 #ac-location-btn / #sys-location 由渲染时 mapEnabled 决定
  // （关闭地图时按钮不带 id，委托自然不命中；showMapPopup 内部亦有 mapEnabled 兜底）。
  $ac.off('click.ac-location').on('click.ac-location', '#ac-location-btn', function () {
    showMapPopup(currentStyle);
  });
  $mc.off('click.ac-location-min').on('click.ac-location-min', '#sys-location', function () {
    showMapPopup(currentStyle);
  });

  // 立绘框点击委托（生成/换/浏览/放大）
  // 萦绕风格下立绘框渲染在 .minimal-container 内（不在 #ac-content），故两容器都需委托；
  // 主题切换时另一方残留 DOM 已被 innerHTML 清空，委托自然不命中，无副作用。
  // 强制渲染：换立绘/删除后表格数据可能未变（仅世界书 portrait 索引变），脏检查会跳过，故需 render(true)。
  bindPortraitEvents($ac, () => currentStyle, () => { render(true); });
  bindPortraitEvents($mc, () => currentStyle, () => { render(true); });
}

// ===== 鼠标光晕（仅桌面端启用，移动端无鼠标且持续监听浪费电量） =====
function initMouseGlow(): void {
  if (mouseGlow) return;
  // 古风/仙侠阅读优先：禁用常驻鼠标光晕（mousemove 监听耗电 + 视觉干扰）
  if (isReadingTheme(currentStyle)) return;
  // 移动端/触屏设备跳过鼠标光晕，避免无意义的 mousemove 监听耗电
  if (window.innerWidth <= 1024 || ('ontouchstart' in window && !(window as any).MSStream)) return;
  mouseGlow = createMouseGlow();
  $(document).off('mousemove.ac-glow').on('mousemove.ac-glow', function (e) {
    updateMouseGlow(mouseGlow!, e);
  });
}

/**
 * 统一管理状态栏 CSS 动画的启停。
 *
 * 两类暂停，使用不同机制（语义不同，不可混用）：
 *  - 页面不可见（document.hidden）→ `.ub-anim-paused`（animation-play-state:paused，
 *    停在当前帧）。安全：doRender 在 hidden 时早退，不会新建 DOM/动画，已完成的
 *    一次性动画停在 100% 帧，可见后恢复即可。
 *  - 「跟随底部」布局模式 → `.ub-anim-off`（animation:none/transition:none，彻底移除）。
 *    必须用 none 而非 paused：许多一次性入场动画从 opacity:0 起步（popup-in /
 *    char-panel fade-in / book-page page-flip / ub-badge-pop），paused 会冻在 0% 帧
 *    使元素永久不可见；none 让元素回归基础样式（opacity 默认 1）→ 可见且零持续重绘。
 *
 * 同时刷新 follow-bottom 缓存（供 effects.ts 高频路径 O(1) 读取）并联动鼠标光晕显隐。
 * 统一在此调用，消除原 visibilitychange 处理器直接 add/remove 类与布局模式判定之间的冲突。
 */
/** 是否有任意 overlay（设置 / NSFW / 面板）处于打开态 */
function _isAnyOverlayOpen(): boolean {
  const ids = ['settingsOverlay', 'panelOverlay', 'ubDecisionOverlay'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && el.classList.contains('show')) return true;
  }
  return false;
}

function syncAnimState(wrapper: HTMLElement): void {
  const followBottom = effectivePositionMode(getConfig().positionMode) === 'follow-bottom';
  setFollowBottomActive(followBottom);
  // 跟随底部：关动画；页面不可见：冻结。两者可并存（hidden 时无可见内容，无害）。
  wrapper.classList.toggle('ub-anim-off', followBottom);
  // 暂停条件：页面不可见 OR 任意 overlay 打开。
  // overlay 打开时状态栏在其背后不可见，动画纯浪费；且其每帧重绘会令 overlay 的
  // backdrop-filter 不断重新模糊——这是在设置面板内滑动卡顿的主因。暂停后 backdrop
  // 静止，backdrop-filter 只模糊一次即缓存，不再每帧重算。
  const overlayOpen = _isAnyOverlayOpen();
  wrapper.classList.toggle('ub-anim-paused', document.hidden || overlayOpen);
  // F45(十一轮)：弹窗层动画同样在页面不可见时冻结。只看 hidden——弹窗打开时自身可见，
  // overlayOpen 对弹窗内部不成立（那只是 wrapper 背后不可见的判定）；新行呼吸高亮等
  // 每帧重绘型动画在切走页面后不再空烧，回页自动续播。
  const _freezeOverlays = document.hidden;
  document.getElementById('panelOverlay')?.classList.toggle('ub-anim-paused', _freezeOverlays);
  document.getElementById('settingsOverlay')?.classList.toggle('ub-anim-paused', _freezeOverlays);
  document.getElementById('ubDecisionOverlay')?.classList.toggle('ub-anim-paused', _freezeOverlays);
  if (mouseGlow) {
    const hideGlow = followBottom || overlayOpen || isReadingTheme(currentStyle);
    mouseGlow.style.display = hideGlow ? 'none' : '';
    if (hideGlow) mouseGlow.classList.remove('active');
  }
}

// ===== 配置变更回调 =====
// ===== 移动端全面适配（通过 inline style 确保不被父页面CSS覆盖） =====
function applyMobileFixes(): void {
  const isMobile = window.innerWidth <= 1024;
  if (!isMobile) return;

  // 1. 防止横向溢出（overflow-x 已在 updateWrapperStyle 的 cssText 中内置）
  const wrapper = document.getElementById('ac-statusbar-wrapper');
  if (wrapper) {
    wrapper.style.maxWidth = '100vw';
  }

  // 2. 所有 overlay 避开浏览器头部
  const overlays = document.querySelectorAll('.settings-overlay, .nsfw-overlay, .panel-overlay');
  overlays.forEach(function(ov) {
    (ov as HTMLElement).style.alignItems = 'flex-start';
    (ov as HTMLElement).style.paddingTop = '60px';
    (ov as HTMLElement).style.paddingBottom = '20px';
    // 上下 padding 总额暴露给弹窗 CSS：移动端全屏弹窗（≤599px height:100dvh 的
    // 商店/成就/日历/地图/周期/采访规则）用它抵扣，否则弹窗整体比可视区高 80px，
    // 底部固定区（如商店详情的购买按钮）被推到视口外且无法滚动到。
    // 改上方 60/20 时此值必须同步。
    (ov as HTMLElement).style.setProperty('--ub-ol-pad-total', '80px');
  });

  // 3. Popup 限制高度
  const popups = document.querySelectorAll('.settings-popup, .nsfw-popup, .panel-popup');
  popups.forEach(function(p) {
    (p as HTMLElement).style.maxHeight = '70vh';
  });

  // 4. 齿轮按钮定位
  positionSettingsBtn();
}

// ===== #chat 末尾维护：单一 MutationObserver =====
// 同时承担两个职责（设计上任意时刻最多一个目标在 #chat 内，互斥）：
//   - follow-bottom 模式：wrapper 在 #chat 末尾，随消息流贴底
//   - 选项栏跟随底部（fixed 模式）：浮动选项栏 #ac-options-bar-floating 在 #chat 末尾
// 关键：用「按 config 确定性选取唯一 tail 元素」的规则，任意一次回调最多移动一个元素，
// 避免早期「两个观察者各抢一个元素当末尾」互相 appendChild 的无限循环（曾导致整个页面卡死）。
const OPTIONS_BAR_FLOATING_ID = 'ac-options-bar-floating';
let _chatTailObserver: MutationObserver | null = null;
let _chatTailChatEl: HTMLElement | null = null;
// 防抖贴底：重建期间 #chat 连续 append N 条 .mes 会触发 N 次 childList mutation，
// 旧实现「每帧 1 次 appendChild」虽消除了同步强制布局抖动，但每帧那次移动本身仍会让
// 选项栏随消息流上下弹跳（用户滚到底想看选项栏 → 被逐帧拉回挤上去 → 反复几次）。
// 改为「#chat 静默 CHAT_TAIL_DEBOUNCE_MS 后一次性 appendChild」，重建期不逐帧移动，
// 等消息流停歇再贴回末尾，弹跳消失。CHAT_TAIL_MAX_STALE_MS 为防御上限：异常持续
// mutation 永不全静默时，最多每隔该时长强制贴底一次，保证 tail 不会长期错位。
let _chatTailTimer: number | null = null;
let _chatTailLastFlush = 0;
const CHAT_TAIL_DEBOUNCE_MS = 200;
const CHAT_TAIL_MAX_STALE_MS = 1000;

/** 当前「选项栏跟随底部」是否生效（TT 托管聊天区下 #chat 容纳不了外来子节点，恒不生效） */
function isOptionsBarFollowBottomActive(): boolean {
  if (isTtManagedChatSurface()) return false;
  const cfg = getConfig();
  return cfg.optionsBarEnabled && cfg.optionsBarFollowBottom && effectivePositionMode(cfg.positionMode) !== 'follow-bottom';
}

/** 当前应在 #chat 末尾的唯一元素：按 config 确定性选取（不依赖 DOM 状态，杜绝乒乓） */
function _getChatTailEl(): HTMLElement | null {
  if (isTtManagedChatSurface()) return null; // #chat 被托管：wrapper 与浮动栏都不进 #chat
  const cfg = getConfig();
  if (cfg.positionMode === 'follow-bottom') {
    return document.getElementById('ac-statusbar-wrapper');
  }
  return document.getElementById(OPTIONS_BAR_FLOATING_ID);
}

/** 是否需要 #chat 末尾观察者（TT 托管聊天区无 tail 元素，不需要） */
function _isChatTailObserverNeeded(): boolean {
  if (isTtManagedChatSurface()) return false;
  const cfg = getConfig();
  if (cfg.positionMode === 'follow-bottom') return true;
  return cfg.optionsBarEnabled && cfg.optionsBarFollowBottom;
}

/** 实际执行 tail 贴底移动。仅在 tail 确在 chat 内且不在末尾时 appendChild，并记录贴底时间。 */
function _flushChatTail(chat: HTMLElement): void {
  const tail = _getChatTailEl();
  // 不在 #chat 内则不干预（如 wrapper 处于 body 的 fixed 模式 / 已切到固定布局）
  if (!tail || tail.parentElement !== chat) return;
  const last = chat.lastElementChild;
  if (last === tail) return; // 已在末尾，无需移动
  chat.appendChild(tail);
  _chatTailLastFlush = Date.now();
}

/**
 * 共享防抖贴底调度：观察者 mutation 与 syncOptionsBarFloating 渲染刷新都走这里。
 * 重置静默计时器，200ms 无后续触发才真正 appendChild；距上次实际贴底超 1s 则立即兜底。
 * 这样浮动选项栏与 wrapper 共用同一套防抖，渲染期不再逐次移动、也不会与观察者重复移动
 * （_flushChatTail 内 last===tail 短路保证幂等）。
 */
function _scheduleChatTailFlush(chat: HTMLElement): void {
  if (_chatTailTimer !== null) { clearTimeout(_chatTailTimer); _chatTailTimer = null; }
  if (Date.now() - _chatTailLastFlush > CHAT_TAIL_MAX_STALE_MS) {
    _flushChatTail(chat);
    return;
  }
  _chatTailTimer = window.setTimeout(function () {
    _chatTailTimer = null;
    _flushChatTail(chat);
  }, CHAT_TAIL_DEBOUNCE_MS);
}

function _ensureChatTailObserver(chat: HTMLElement): void {
  if (_chatTailObserver && _chatTailChatEl === chat) return;
  _stopChatTailObserver();
  _chatTailChatEl = chat;
  // 初始化为当前时间，避免首条 mutation 因 lastFlush=0 触发立即贴底（保留纯 trailing 语义）
  _chatTailLastFlush = Date.now();
  _chatTailObserver = new MutationObserver(function () {
    // 任意一次 mutation 都意味着消息流仍在变动，推迟贴底（共享防抖调度）。
    _scheduleChatTailFlush(chat);
  });
  _chatTailObserver.observe(chat, { childList: true });
}

function _stopChatTailObserver(): void {
  if (_chatTailObserver) {
    try { _chatTailObserver.disconnect(); } catch (e) { /* ignore */ }
    _chatTailObserver = null;
  }
  if (_chatTailTimer !== null) { clearTimeout(_chatTailTimer); _chatTailTimer = null; }
  _chatTailChatEl = null;
  _chatTailLastFlush = 0;
}

/** 同步观察者生命周期：需要时启动，不需要时停止（功能关闭后不占用资源） */
function _syncChatTailObserver(): void {
  const chat = document.getElementById('chat');
  if (_isChatTailObserverNeeded() && chat) {
    _ensureChatTailObserver(chat);
  } else {
    _stopChatTailObserver();
  }
}

/** 同步浮动选项栏：生效时创建/刷新；不生效时移除 */
// 上次写入浮动栏的内容串：doRender 每次都调本函数（含签名早退/折叠路径），
// buildOptionsBar 照常执行（布局/配置变化必然反映到字符串），但 innerHTML 只在内容真的变化时写，
// 避免跟随底部模式下每 tick 一次无差别 DOM 解析+重建。
let _lastFloatingBarHtml = '';
function syncOptionsBarFloating(): void {
  const chat = document.getElementById('chat');
  const active = isOptionsBarFollowBottomActive();

  // 纯浪费情形早退：选项未开 + 无残留浮动栏 + 不需观察者时，跳过每次渲染的冗余查找。
  // 需清理（有残留栏）或需观察者（follow-bottom）时不早退，落入下方分支处理。
  if (!active && !document.getElementById(OPTIONS_BAR_FLOATING_ID) && !_isChatTailObserverNeeded()) return;

  if (!active) {
    const existing = document.getElementById(OPTIONS_BAR_FLOATING_ID);
    if (existing) existing.remove();
    // 被外部摘除（如清空聊天）后缓存失效：下次创建必须重写
    _lastFloatingBarHtml = '';
    // 不直接 stop：follow-bottom 模式下虽选项栏不生效，wrapper 仍需末尾观察者。
    // _syncChatTailObserver 会按当前 config 判断是否真正需要保留观察者。
    _syncChatTailObserver();
    return;
  }
  if (!chat) return;

  let fb = document.getElementById(OPTIONS_BAR_FLOATING_ID) as HTMLElement | null;
  const freshlyCreated = !fb;
  if (!fb) {
    fb = document.createElement('div');
    fb.id = OPTIONS_BAR_FLOATING_ID;
    fb.className = 'ac-options-bar-floating';
    chat.appendChild(fb);
  }
  // 内容刷新（强制浮动渲染，绕过内联抑制）；未变化时跳过 DOM 写（解析/重建为零）
  const barHtml = buildOptionsBar(currentStyle, { floating: true });
  if (freshlyCreated || barHtml !== _lastFloatingBarHtml) {
    fb.innerHTML = barHtml;
    _lastFloatingBarHtml = barHtml;
  }
  // 深色模式同步
  fb.classList.toggle('dark', !!getConfig().darkTheme);
  // 始终保持在 #chat 末尾——委托给与 wrapper 共享的防抖贴底逻辑（_flushChatTail）。
  // 旧实现每次渲染都直接 chat.appendChild(fb)，批量渲染时逐次贴底仍会跳动；
  // 改为触发一次防抖 flush：与 chat 观察者共用 200ms 静默窗口 + 1s 兜底上限，
  // 内容已刷新到 fb，贴底时机交给防抖，渲染期不再逐次移动。
  // _flushChatTail 内部已判断 last===tail 则不移动，与观察者不会重复 appendChild。
  _scheduleChatTailFlush(chat);
  _syncChatTailObserver();
}

function updateWrapperStyle(): void {
  const cfg = getConfig();
  const wrapper = document.getElementById('ac-statusbar-wrapper');
  if (!wrapper) return;

  // 刷新动画暂停态与 follow-bottom 缓存（含折叠态，保证缓存始终新鲜；
  // 折叠时 wrapper 为 display:none，类切换无副作用）
  syncAnimState(wrapper);

  // 折叠时跳过样式更新（避免展开时定位偏差）
  if (wrapper.classList.contains('ub-collapsed')) return;

  const isPhone = window.innerWidth <= 600;
  const isMobile = window.innerWidth <= 1024;

  // 三种宽度模式 + 居中偏移

  let w: string;
  let centerCSS: string;
  if (cfg.widthMode === 'custom') {
    const pct = cfg.customWidthPercent / 100;
    w = 'calc(100vw * ' + pct + ')';
    centerCSS = 'left:50%;margin-left:calc(100vw * ' + (-pct / 2) + ');';
  } else if (cfg.widthMode === 'chat') {
    w = 'var(--sheldWidth,60vw)';
    centerCSS = 'left:50%;margin-left:calc(var(--sheldWidth,60vw) / -2);';
  } else {
    w = '100vw';
    centerCSS = 'left:0;';
  }

  const heightVh = cfg.customHeightPercent + 'vh';

  // 生效布局口径：TT 托管聊天区（虚拟化开启）下 follow-bottom 回退 fixed-top——
  // 托管后的 #chat 容纳不了外来子节点，resize/handleReinject 重算样式时也必须同口径，
  // 否则会把 loader 建好的 fixed-top wrapper 重新挪回 #chat（只修 loader = 半修）。
  const posMode = effectivePositionMode(cfg.positionMode);

  // ===== 模式 1: 固定顶部 =====
  if (posMode === 'fixed-top') {

    const chat = document.getElementById('chat');
    if (chat && !isPhone) {
      const topDist = Math.max(chat.getBoundingClientRect().top, 0);
      wrapper.style.cssText = 'position:fixed;'
        + 'top:' + topDist + 'px;'
        + centerCSS
        + 'width:' + w + ';'
        + 'max-height:' + heightVh + ';overflow-y:auto;overflow-x:hidden;'
        + 'z-index:9998;';
    } else {
      wrapper.style.cssText = 'position:fixed;top:0;'
        + centerCSS
        + 'width:' + w + ';'
        + 'max-height:' + heightVh + ';overflow-y:auto;overflow-x:hidden;z-index:9998;';
    }
    if (wrapper.parentNode !== document.body) document.body.appendChild(wrapper);
    if (isMobile) applyMobileFixes();
    return;
  }

  // ===== 模式 2: 跟随底部（嵌入 #chat 末尾，sticky 贴底跟随消息滚动） =====
  if (posMode === 'follow-bottom') {
    const chat = document.getElementById('chat');
    if (chat) {
      // 宽度：跟随底部模式下默认占满消息流宽度；自定义宽度时居中
      let innerW = '100%';
      let innerMargin = '0 auto';
      if (cfg.widthMode === 'custom') {
        innerW = 'calc(100% * ' + (cfg.customWidthPercent / 100) + ')';
        innerMargin = '8px auto';
      }
      // 作为消息流的最后一项：和普通 .mes 一样参与 #chat 的滚动，
      // 向上滚动看不到状态栏，滚到最底才显现。不设 overflow/max-height，
      // 让 wrapper 自身高度由内容决定，整体由 #chat 滚动。
      wrapper.style.cssText = 'position:relative;'
        + 'width:' + innerW + ';'
        + 'margin:' + innerMargin + ';'
        + 'flex-shrink:0;'
        + 'overflow-anchor:none;' // 关闭浏览器滚动锚定，避免它与下方观察者的贴底移动争抢 scrollTop
        + 'z-index:auto;';
      if (wrapper.parentNode !== chat) chat.appendChild(wrapper);
      _syncChatTailObserver();
      if (isMobile) applyMobileFixes();
    } else {
      // chat 尚未就绪时回退到固定底部
      wrapper.style.cssText = 'position:fixed;bottom:60px;' + centerCSS + 'width:' + w
        + ';max-height:' + heightVh + ';overflow-y:auto;overflow-x:hidden;z-index:9998;';
      if (wrapper.parentNode !== document.body) document.body.appendChild(wrapper);
      _syncChatTailObserver();
    }
    return;
  }

  // ===== 模式 3: 固定底部（固定在文字输入框上方，column-reverse 让内容从下往上增长） =====
  if (posMode === 'fixed-bottom') {

    // 计算 bottom 偏移：定位在发送区域上方
    let bottomPx = '60px';
    try {
      const sendArea = document.getElementById('send_textarea')
        || document.querySelector('#send_but')
        || document.querySelector('[data-id=\"send_but\"]');
      if (sendArea) {
        const sr = sendArea.getBoundingClientRect();
        // bottom = 从视口底部到发送区域顶部的距离
        // 使用 sr.top 相对于视口顶部，bottom = viewportHeight - sr.top
        const distFromBottom = window.innerHeight - sr.top;
        // 确保至少留 40px（防止虚拟键盘等极端情况）
        bottomPx = Math.max(distFromBottom, 40) + 'px';
      }
    } catch (e) { /* use default */ }

    // 移动端安全下限：确保 bottom 值不会把 wrapper 推出可视区域
    if (isPhone) {
      const bottomVal = parseInt(bottomPx) || 60;
      // 移动端浏览器地址栏收缩/展开时 innerHeight 可能变化，
      // 限制 bottom 不超过视口高度的 60%，防止 wrapper 被推到屏幕外
      const maxBottom = Math.floor(window.innerHeight * 0.6);
      if (bottomVal > maxBottom) {
        bottomPx = maxBottom + 'px';
      }
    }

    wrapper.style.cssText = 'position:fixed;'
      + 'bottom:' + bottomPx + ';'
      + centerCSS
      + 'width:' + w + ';'
      + 'max-height:' + heightVh + ';overflow-y:auto;overflow-x:hidden;'
      + 'z-index:9998;'
      + 'display:flex;flex-direction:column-reverse;';
    if (wrapper.parentNode !== document.body) document.body.appendChild(wrapper);
    if (isMobile) applyMobileFixes();
    _syncChatTailObserver();
    return;
  }

  // 其他模式：同步 #chat 末尾观察者生命周期（需要则保留，否则停止）
  _syncChatTailObserver();

}

// ===== 衣柜编排（提案三 S2 拆分至 wardrobe-orchestration.ts；index 局部能力在此注入） =====
initWardrobeOrchestration({
  render,
  getActivePopup: () => _activePopup,
  getCurrentStyle: () => currentStyle,
});


// ===== 重填模式（设置 → 通用 → 运行模式）=====
// 开启期间：core/refill-mode.ts 的 isRefillMode() 在各自动入口拦下「自动 AI 请求 + 自动数据写入」。
// 被拦下的请求直接丢弃，不做补救、不做补跑——关掉开关后各自动链在下一次表格更新/消息事件时
// 按当时的最新数据照常运行。故此处没有任何恢复逻辑。
// 拦截点清单（新增自动功能时须一并加闸门，否则重填期间会漏）：
//   · 300ms tick 总入口 / runReadyStoryAutomation（index.ts）
//   · MESSAGE_RECEIVED（剧情自动备份 + 玩法自动清空，index.ts）
//   · 世界演化 scheduleEvolve / 正文插图 scheduleStoryImage（含各自防抖回调内二次判定）
//   · 立绘自动补齐 requestPortraitAutoGeneration（卡入口直接调用，不经 ready 自动化）
//   · 世界书投影派发入口 requestWorldbookProjection（覆盖全部自动世界书写入）
//   · 时间锚定 handleTableUpdate / 杂表 syncMapOverviewToMiscTable / 经期孕期 handleCycleTick
//   · 卡入口与重注入路径（storage-ready / handleReinject / story 落盘事件 / init / reapply）
//
// 台账接管时主项目不再承担填表，本开关不适用：设置页整块隐藏（panels/config-panel.ts），
// 运行时同口径视为关闭；保存值不改写，退出台账模式后原状态恢复生效。
setRefillModeSuppressor(isLedgerTakeover);

setConfigChangeCallback(() => {
  // 折叠菜单项随功能开关变化重建（开关变化是低频事件、菜单打开是高频事件，
  // 故在配置变更时重建菜单项，而非每次打开时重新生成）
  refreshCollapseMenuItems();
  // 成就总开关/通知开关变化时即时接线：开启→接通派发器+回调，关闭→派发器退化空函数。
  setupAchievementSystem();
  const newConfig = getConfig();
  syncAssistantUI();
  const portraitWasEnabled = lastPortraitEnabled;
  const portraitAutoWasEnabled = lastPortraitAutoUpdateMode !== 'off';
  const wardrobeWasEnabled = lastWardrobeEnabled;
  lastPortraitEnabled = newConfig.portraitEnabled;
  lastPortraitAutoUpdateMode = newConfig.portraitAutoUpdateMode;
  lastWardrobeEnabled = newConfig.wardrobeEnabled;
  if (newConfig.dsCacheOptimize !== lastDsCacheOptimize) {
    lastDsCacheOptimize = newConfig.dsCacheOptimize;
    void repositionManagedWbEntries();
    // 外部注册投影（如小手机消息记录）不在 MANAGED 名单里，靠自身 reconcile 的 dsCachePos 重定位——全量刷新一遍
    void refreshAllWorldbookProjections();
  }
  if (!newConfig.portraitEnabled) {
    if (portraitWasEnabled) stopPortraitSystem();
  } else if (!portraitWasEnabled) {
    injectPortraitCSS();
    void initPortraitSystem().then(() => render(true));
  } else if (newConfig.portraitAutoUpdateMode !== 'off' && !portraitAutoWasEnabled) {
    // 用户刚开启自动更新：立即扫描当前在场角色。
    requestPortraitAutoGeneration();
  } else if (newConfig.portraitAutoUpdateMode === 'off' && portraitAutoWasEnabled) {
    stopPortraitAutoGeneration();
  }
  if (!newConfig.wardrobeEnabled) {
    setupWardrobeActionBridge(false);
    closeWardrobePanel();
    bindWardrobeRuntime(null);
    removeWardrobeCss();
    if (wardrobeWasEnabled) {
      void disposeWardrobeRuntime();
      void reconcileWardrobeStateAndProjection();
    }
  } else {
    setupWardrobeActionBridge(true);
    injectWardrobeCss(true);
    if (!wardrobeWasEnabled) {
      loadWardrobeState();
      const runtime = getWardrobeRuntime();
      runtime.load();
      bindWardrobeRuntime(runtime);
      void reconcileWardrobeStateAndProjection();
    }
  }
  injectCalendarCSS(newConfig.calendarEnabled);
  // 通知美化：按 notifyEffect 四档决定皮肤或回原生 toastr（含成就自建共用对齐；auto 读 darkTheme 定素瓷/云墨）
  setNotifyBeautifyEnabled(newConfig.notifyEffect !== 'original', newConfig.style, newConfig.notifyAlign, newConfig.notifyEffect, !!newConfig.darkTheme);
  const styleChanged = newConfig.style !== currentStyle;
  const layoutChanged = newConfig.positionMode !== lastLayoutPos
    || newConfig.widthMode !== lastLayoutWid
    || newConfig.customWidthPercent !== lastCustomWidthPct
    || newConfig.customHeightPercent !== lastCustomHeightPct;

  if (styleChanged) {
    // 主题切换过渡动画：先淡出 → 切换CSS+渲染 → 再淡入
    const contentEl = document.getElementById('ac-content') || document.querySelector('.minimal-container');
    if (contentEl) {
      contentEl.classList.add('ub-theme-switching');
      // 双 rAF 确保浏览器先渲染 opacity:0 再做 DOM 变更
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          currentStyle = newConfig.style;
          injectCSS(currentStyle);
          // 成就打点：主题切换成功
          try { (window as any).__ubEmitAchievement?.('theme_switch', {}); } catch (_e) { /* ignore */ }
          lastCustomHeightPct = newConfig.customHeightPercent;
          if (layoutChanged) {
            lastLayoutPos = newConfig.positionMode;
            lastLayoutWid = newConfig.widthMode;
            lastCustomWidthPct = newConfig.customWidthPercent;
            lastCustomHeightPct = newConfig.customHeightPercent;
            updateWrapperStyle();
            // 成就打点：布局切换成功（主题切换同时改布局的路径）
            try { (window as any).__ubEmitAchievement?.('layout_switch', {}); } catch (_e) { /* ignore */ }
          }
          invalidateCache();
          render(true); // 强制渲染：主题切换必须全量重建 DOM
          // 主题切换后补建鼠标光晕：若初始为阅读主题（ancient/xianxia）起步则 initMouseGlow 曾早退，
          // 切到 flirtatious/sweet 时需在此创建，否则光晕在该场景永久失效
          initMouseGlow();
          // 渲染完成后移除类名，触发淡入
          requestAnimationFrame(() => {
            if (contentEl) contentEl.classList.remove('ub-theme-switching');
          });
        });
      });
      return;
    }
    // 回退：无 content 元素时直接切换
    currentStyle = newConfig.style;
    injectCSS(currentStyle);
    initMouseGlow();
    // 成就打点：主题切换成功（回退路径）
    try { (window as any).__ubEmitAchievement?.('theme_switch', {}); } catch (_e) { /* ignore */ }
    lastCustomHeightPct = newConfig.customHeightPercent;
  }
  // 旧布局是否为「跟随底部」——须在 reassign lastLayoutPos 前捕获，用于判断内联选项栏 followActive 是否翻转
  const oldIsFollowBottom = lastLayoutPos === 'follow-bottom';
  if (layoutChanged) {
    lastLayoutPos = newConfig.positionMode;
    lastLayoutWid = newConfig.widthMode;
    lastCustomWidthPct = newConfig.customWidthPercent;
    lastCustomHeightPct = newConfig.customHeightPercent;
    updateWrapperStyle();
    // 成就打点：布局切换成功（纯布局切换路径）
    try { (window as any).__ubEmitAchievement?.('layout_switch', {}); } catch (_e) { /* ignore */ }
  }

  if (layoutChanged) {
    // buildHTML 仅在 buildOptionsBar 内依赖布局（isOptionsBarFollowBottomActive = optionsBarEnabled &&
    // optionsBarFollowBottom && positionMode !== 'follow-bottom'，见 index.ts isOptionsBarFollowBottomActive），
    // 其余 DOM 与布局无关；wrapper 定位已由 updateWrapperStyle 处理，浮动选项栏由
    // syncOptionsBarFloating 刷新。仅当内联选项栏 followActive 翻转（跨过 follow-bottom 边界）时
    // buildHTML 产物才变，需全量重建；纯布局切换（如 fixed-bottom↔fixed-top）的 innerHTML 重建为纯浪费，
    // 改走非强制 render()：cfgSig 不含布局（见 composeRenderSignature），签名一致则跳过，数据已变则照常重建。
    const followActiveChanged = newConfig.optionsBarEnabled
      && newConfig.optionsBarFollowBottom
      && (oldIsFollowBottom !== (newConfig.positionMode === 'follow-bottom'));
    if (followActiveChanged) {
      invalidateCache();
      render(true); // 跨过 follow-bottom 边界：内联选项栏空↔渲染翻转，需全量重建
    } else {
      render(); // 纯布局切换：走脏检查，签名一致则跳过全量 innerHTML 重建
    }
  } else {
    // 非布局/主题的配置变更（如 optionsBarFollowBottom、showFloatingBtn 等非 cfgSig 字段）：
    // 保持原有强制刷新，确保非签名字段的变更也反映到 DOM
    render(true);
  }

  // 更新悬浮按钮可见性和固定模式按钮
  updateFloatingBtnVisibility();
  updateFixedToggleBtn();
  updateFeatureButtonVisibility();
});
let lastLayoutPos = getConfig().positionMode;
let lastLayoutWid = getConfig().widthMode;
let lastCustomWidthPct = getConfig().customWidthPercent;
let lastCustomHeightPct = getConfig().customHeightPercent;
let lastPortraitEnabled = getConfig().portraitEnabled;
let lastPortraitAutoUpdateMode = getConfig().portraitAutoUpdateMode;
let lastWardrobeEnabled = getConfig().wardrobeEnabled;
let lastDsCacheOptimize = getConfig().dsCacheOptimize;

/** 宅仙唯一启动门：禁用时只做幂等清理，不读取会话、资料目录或模型服务。 */
function syncAssistantUI(): void {
  const { assistantEnabled } = getConfig();
  if (assistantEnabled) mountAssistantEntry();
  else destroyAssistantUI();
}

// ===== 供 loader 调用的全局回调 =====
// ===== 确保所有 overlay 在 body 中（不受 wrapper 折叠影响） =====
// 确保所有 overlay 在 body 中且唯一：loader 重注入（CHAT_CHANGED）会通过 w.innerHTML 重建 wrapper，
// 产生新的 overlay 元素，与已移到 body 的旧 overlay 形成重复 id。重复时保留带 show 的（当前打开的弹窗），
// 否则保留已 in body 的，移除其余。若保留项仍在 wrapper 内则移到 body。
// 重复的 overlay 会导致 getElementById 返回空白的那个而不是有 show 的那个，
// closeActivePopup 操作到空白 overlay 上变成无操作 → 设置按钮需要多按一次才能关闭。
function ensureOverlaysInBody(): void {
  const wrapper = document.getElementById('ac-statusbar-wrapper');
  if (!wrapper) return;
  const overlayIds = ['settingsOverlay', 'panelOverlay'];
  for (const id of overlayIds) {
    const all = Array.from(document.querySelectorAll('#' + id)) as HTMLElement[];
    if (all.length === 0) continue;
    if (all.length === 1) {
      if (wrapper.contains(all[0])) document.body.appendChild(all[0]);
      continue;
    }
    // 有重复（loader 重注入产生）：保留带 show 的（当前打开的弹窗），否则保留已 in body 的，否则第一个
    const keep = all.find(el => el.classList.contains('show'))
              || all.find(el => !wrapper.contains(el))
              || all[0];
    if (wrapper.contains(keep)) document.body.appendChild(keep);
    for (const el of all) if (el !== keep) el.remove();
  }
}

// 帮助提示 #helpTooltipGlobal 必须留在 document.body：它 position:fixed+z-index:999999，
// 但若留在 #ac-statusbar-wrapper 内（fixed 模式 wrapper 是 z-index:9998 的层叠上下文），
// 999999 会被 9998「困住」，整块 wrapper 渲染在 settingsOverlay(z-index:10002) 之下，
// 导致悬浮「?」出现的提示被设置面板/数据库插件浮层遮挡。loader 重注入会重建 wrapper
// 产生新的 tooltip 副本，故须像 overlay 一样在 init 与每次 re-inject 都把它移到 body 并去重。
function ensureTooltipInBody(): void {
  const wrapper = document.getElementById('ac-statusbar-wrapper');
  const all = Array.from(document.querySelectorAll('#helpTooltipGlobal')) as HTMLElement[];
  if (all.length === 0) return;
  if (all.length === 1) {
    if (wrapper && wrapper.contains(all[0])) document.body.appendChild(all[0]);
  } else {
    // 重复（loader 重注入产生）：保留已在 body 的，否则第一个；其余移除
    const keep = (wrapper ? all.find(el => !wrapper.contains(el)) : all[0]) || all[0];
    if (wrapper && wrapper.contains(keep)) document.body.appendChild(keep);
    for (const el of all) if (el !== keep) el.remove();
  }
  // 缓存可能指向已被移除的副本，重置以便下次 getGlobalTooltip 重新查到 body 中唯一的 tooltip
  _globalTooltip = null;
}

// ===== 活跃弹窗追踪（用于菜单项 toggle 行为） =====
let _activePopup: string | null = null; // 'calendar' | 'items' | 'missions' | 'memo' | 'optionsbar' | 'database' | 'settings' | null

function closeActivePopup(): void {
  if (_activePopup === 'settings') {
    const ov = document.getElementById('settingsOverlay');
    if (ov) ov.classList.remove('show');
  } else if (_activePopup === 'wardrobe') {
    // 衣柜有 store/队列订阅与焦点恢复，必须走自身清理；仅移除 show 会泄漏订阅。
    invalidateWardrobePanelOpen();
    closeWardrobePanel();
  } else if (_activePopup) {
    const ov = document.getElementById('panelOverlay');
    if (ov) ov.classList.remove('show');
  }
  _activePopup = null;
}

/** 设置 overlay class 变化监听（仅一次），当 overlay 被外部关闭时同步 _activePopup。
 *  同时统一驱动 syncAnimState：overlay 开→暂停状态栏动画（省电+避免 backdrop-filter 重算），
 *  overlay 关→恢复。 */
function _setupOverlayCloseWatcher(): void {
  if ((document as any).__ub_overlay_watcher) return;
  (document as any).__ub_overlay_watcher = true;
  let lastOverlayOpen = _isAnyOverlayOpen();
  const observer = new MutationObserver((mutations) => {
    const nowOpen = _isAnyOverlayOpen();
    if (nowOpen !== lastOverlayOpen) {
      lastOverlayOpen = nowOpen;
      const wrapper = document.getElementById('ac-statusbar-wrapper');
      if (wrapper) syncAnimState(wrapper);
    }
    for (const m of mutations) {
      const el = m.target as HTMLElement;
      if (el.classList.contains('show')) continue;
      if (el.id === 'settingsOverlay' && _activePopup === 'settings') _activePopup = null;
      else if (el.id === 'panelOverlay' && _activePopup && _activePopup !== 'settings') {
        if (_activePopup === 'wardrobe' && el.classList.contains('wardrobe-overlay')) closeWardrobePanel();
        _activePopup = null;
      }
    }
  });
  const observe = () => {
    ['settingsOverlay', 'panelOverlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  };
  observe();
  // 延迟重试：overlay 可能在 body 迁移过程中短暂不存在
  setTimeout(observe, 300);
}

/** 确保 overlay 在 body 并显示指定弹窗（带 toggle 支持） */
function showPopupOrToggle(popupId: string, showFn: () => void): void {
  ensureOverlaysInBody();
  _setupOverlayCloseWatcher();
  if (_activePopup === popupId) {
    closeActivePopup();
    return;
  }
  closeActivePopup(); // 先关闭当前弹窗
  _activePopup = popupId;
  showFn();
}

// loader 重注入 wrapper 后调用，恢复 overlay 和按钮状态
function handleReinject(): void {
  invalidateAssistantUIForChatChange();
  advanceWardrobeProjectionEpoch();
  // F47(第十二轮)：wrapper 可能刚被 loader 重建（跟随底部切聊清空 #chat 等），
  // 萦绕主题的「内容没变就不写 DOM」哨兵必须归零，否则新壳停在模板默认值。
  resetMinimalRenderSentinels();
  // 进卡/切卡：重置 ready-automation 冷却标记，避免上一张卡的入场时间戳抑制新卡的投影（B1）。
  _lastReadyAutomationAt = 0;
  // 1. 确保所有 overlay 在 body 中且唯一
  ensureOverlaysInBody();
  // 帮助提示同样须移到 body 并去重，否则重注入后新 tooltip 困在 wrapper 层叠上下文被遮挡
  ensureTooltipInBody();
  initSystemDecisionPopup();

  // 2. 更新 wrapper 样式（必须在 toggle 之前，否则 ub-collapsed 会导致 updateWrapperStyle 提前返回）
  updateWrapperStyle();
  updateFloatingBtnVisibility();
  resetFixedToggleBtnSignature(); // 重注入后布局/内容可能变，强制刷新折叠按钮
  updateFixedToggleBtn();
  syncFixedToggleAi();
  applyMobileFixes();

  // 3. 重新绑定事件（wrapper 刚被 loader 重建，旧委托绑定在已移除的容器上失效，必须重绑到新容器）
  bindEvents();
  syncAssistantUI();

  // 4. 重新渲染（wrapper 可能刚被 loader 重建，需要填充内容）
  invalidateCache();
  render(true); // 强制渲染：wrapper 重建后必须全量填充内容
  // 切聊后按当前 chatKey 重算统一通知（旧聊天的请求不再显示在 toast 上；提示条由 doRender 同步）
  refreshAiActivityNotify();

  // 5. 切聊/重注入后角色卡绑定世界书可能已变，玩法/物品使用条目需重新 reconciling（签名不变也要强制写）
  // 重填模式：跳过世界书重注入与衣柜投影（均为自动写入）；关闭后下一次表格更新时照常重跑。
  if (getConfig().wardrobeEnabled) {
    loadWardrobeState();
  }
  if (!isRefillMode()) {
    reconcilePlayWorldbook();
    void reconcileWardrobeStateAndProjection();
  }
}
// 暴露给 loader（IS_FIRST_BOOT 门控：双实例副本 2 不得覆盖第一副本的桥引用）
if (IS_FIRST_BOOT) {
  (window as any).__ub_on_reinject = handleReinject;
  // 暴露通知徽章清除函数（供 popup-manager 调用）
  (window as any).__ub_clearBadge = clearBadge;
  // 暴露徽章刷新函数（供 popup-manager 在面板关闭后调用，移除已清零的徽章）
  (window as any).__ub_refreshBadges = renderBadges;
  // 暴露通用图片放大桥（UBS_phone 等子模块通过此桥在宿主页全屏放大，视觉交互对齐立绘放大）
  (window as any).__ub_openLightbox = openHostLightbox;
  // 暴露悬浮按钮重置桥（UBS_phone 连点三下小手机悬浮球=找回拖出屏外的主项目按钮；与设置项「重置到屏幕中间」共用同一函数）
  (window as any).__ub_resetFloatBtn = resetFloatingBtnToCenter;
  // 暴露共享生图闸门（UBS_phone 等子模块的生图第二步经此排队——跨 bundle 共用同一间隔池，防并发撞车）
  (window as any).__ubImageGenQueue = {
    enqueue: (task: () => Promise<string>, signal?: AbortSignal) => enqueueSharedImageTask(task, signal),
  };
  // 暴露立绘固定一致性 tag 读取桥（UBS_phone 生图第一步经此注入人物固定 tag：读立绘索引内存层最新值，
  // 含主角哨兵键与 useCharTags 开关；本插件未加载/版本过旧/开关未开时小手机自动回落数据库散文注入）
  (window as any).__ubPortraitCharTags = {
    get: (npc: string, isProtagonist: boolean) => resolvePortraitCharTags(npc, isProtagonist),
  };
  // 暴露同人角色标记读取桥（UBS_phone 生图第一步经此识别同人角色：资料块不注入外貌/身材，
  // 提示词改用原作标准角色标签与作品标签；主项目未加载/版本过旧时小手机回落散文注入，零破坏）
  (window as any).__ubPortraitFanwork = {
    get: (npc: string) => isPortraitFanwork(npc),
  };
  // 暴露同人身份 tag 读取桥（UBS_phone 生图第一步经此取固化的原作人物/作品标签：资料块原样给出、
  // 提示词照抄开头，不再由 AI 现场推断原作；主项目未加载/未填/未标记时小手机回落普通出图，零破坏）
  (window as any).__ubPortraitFanTags = {
    get: (npc: string) => getPortraitFanTags(npc),
  };
  // 暴露世界书投影外部注册桥（UBS_phone 等伴生插件把自有条目投影交给本插件统一调度：
  // 同一协调器串行化整书读写、切卡 epoch、refreshAll；见 core/worldbook-projection-runtime）
  (window as any).__ubWorldbookProjection = {
    register: registerExternalWorldbookProjection,
    request: (id: string, reason: 'data-change' | 'config-change') => { requestWorldbookProjection(id, reason); },
    /** 台账等需要 await 结果的外部投影：true=实际执行成功，false=无世界书/读写异常/重填抑制。 */
    requestAsync: (id: string, reason: 'data-change' | 'config-change') => requestExternalWorldbookProjectionAsync(id, reason),
    unregister: (id: string) => unregisterExternalWorldbookProjection(id),
    /** 手工清理 sweep 与投影共用一条队列，避免并发 read-modify-write 互相覆盖。 */
    exclusive: (task: () => Promise<any>) => runWorldbookProjectionExclusive(task),
    isRefillMode: () => isRefillMode(),
    setEnabled: (id: string, enabled: boolean) => { void setWorldbookProjectionEnabled(id, enabled); },
  };
  // 桥就绪广播：伴生插件可能先于本插件装载（注册时桥不存在），监听此事件补注册。
  // 线名（跨 bundle 契约，与 core/events.ts 的 UB_EVENT 登记一致，供小手机等订阅）：
  //   ub-worldbook-projection-ready / ub-storage-relocation-ready
  emitUbEvent(UB_EVENT.worldbookProjectionReady);
  // 暴露一键搬家外部存储复制桥（UBS_phone 等伴生插件把自有 storageId 域文件随搬家复制到新聊天：
  // 搬家只识别主项目三域，插件自有域（usb_phone_*）不在其列，未注册则搬家后表现为插件数据丢失；
  // 见 core/storage-relocation-bridge 与 core/chat-relocation 步骤 2b）
  (window as any).__ubStorageRelocation = {
    register: registerStorageRelocationCopier,
    unregister: unregisterStorageRelocationCopier,
  };
  // 桥就绪广播（与上方同理：插件可能先于本插件装载）
  emitUbEvent(UB_EVENT.storageRelocationReady);
}

// 周期/孕育引擎对外 API（拓展项目用）：宿主窗口与本 iframe 各挂同一对象引用；
// 纯静态对象 + 惰性方法，未调用时零开销（详见 core/cycle-external-api.ts 与 docs/周期孕育引擎-对外API实现说明.md）。
if (IS_FIRST_BOOT) installCycleExternalApi();

// loader resize/orientationchange 防抖后调用
function handleResize(): void {
  // 布局变化时按钮默认定位（基于 #chat rect）需重算，重置签名绕过早退
  resetFixedToggleBtnSignature();
  updateWrapperStyle();
  updateFixedToggleBtn();
  applyMobileFixes();
  syncAssistantUI();
}
if (IS_FIRST_BOOT) (window as any).__ub_on_resize = handleResize;

// 角色中枢深链：纪要/地图等只传递精确姓名，不接受对象或 HTML。
if (IS_FIRST_BOOT) {
  (window as any).__ub_showCharacterHub = function (name?: unknown) {
    showCharacterInfoPopup(currentStyle, typeof name === 'string' ? name : undefined);
  };
}

// 剧情回顾深链（F31②）：世界窗口「纪事/回廊日期」点击跳转。第二个参数是「关闭后回到哪」的回调
// （世界窗口据此按原页签返回，与角色中枢的 childRestore 同款）；世界窗口不直接 import 本弹窗模块。
if (IS_FIRST_BOOT) {
  (window as any).__ub_showChronicleReader = function (dateKey?: unknown, onClosed?: unknown) {
    void showChronicleReaderPopup(currentStyle, {
      dateKey: typeof dateKey === 'string' ? dateKey : '',
      onClosed: typeof onClosed === 'function' ? onClosed as () => void : undefined,
    });
  };
}

// 暴露选项栏数据获取函数（供 html-builder 使用）
if (IS_FIRST_BOOT) (window as any).__ub_getOptionBarItems = getOptionBarItems;

/**
 * 供美化正则面板等外部 iframe 调用：打开状态栏地图弹窗并定位到指定地点。
 * 返回 Promise<{ok:boolean; reason?:string; name?:string}>。
 * 只读解析（readTreeIndex + resolveMapLocation），不写存储、不建节点、不调 AI。
 */
async function showMapForLocation(loc: string): Promise<{ ok: boolean; reason?: string; name?: string }> {
  const config = getConfig();
  if (!config.mapEnabled) return { ok: false, reason: '地图功能未启用' };
  const location = String(loc || '').trim();
  if (!location) return { ok: false, reason: '地点为空' };
  const index = await readTreeIndex();
  const res = resolveMapLocation(index, location); // 只读，无副作用
  let nodeId: string | null = null;
  if (res.kind === 'exact') nodeId = res.nodeId;
  else if (res.kind === 'candidates') nodeId = res.candidates[0]?.nodeId ?? null;
  // res.kind === 'new' / 'empty' → nodeId 保持 null
  if (!nodeId) return { ok: false, reason: '未生成地图' };
  showMapPopup(getConfig().style, { skipOpenRefresh: true }); // 打开地图弹窗（跳过打开时当前地点刷新，随后 navigateToNode 定位）
  const nav = await navigateToNode(nodeId);      // 定位 + 渲染 + 派发 ub-map-navigated
  if (nav.navigated) return { ok: true, name: nav.name };
  if (nav.pending) return { ok: false, reason: '该地点地图尚未生成' };
  return { ok: false, reason: '未找到该地点地图' };
}
if (IS_FIRST_BOOT) (window as any).__ub_showMapForLocation = showMapForLocation;

// 技能发动标签桥接：正则标签点击 → 打开对应技能天赋树弹窗
// 技能名优先命中技能表；未命中回退扫各树节点 title（节点效果也可标注），打开所属技能的天赋树；都无 → toast
function showSkillTreeForTag(skillName: string): void {
  const name = String(skillName || '').trim();
  if (!name) return;
  const sheet = getSheetByName(SKILL_TABLE_NAME);
  const rowCount = sheet && Array.isArray(sheet.content) ? sheet.content.length - 1 : 0;
  let owner: string | null = null;
  for (let idx = 1; idx <= rowCount; idx++) {
    const skill = getCellByHeader(SKILL_TABLE_NAME, idx, SKILL_COL.name);
    if (!skill) continue;
    if (skill === name) { owner = skill; break; }
    const tree = readSkillTree(skill);
    if (tree && Object.keys(tree.nodes || {}).some(id => (tree.nodes[id] as any)?.title === name)) owner = owner || skill;
  }
  if (!owner) { getToastr()?.warning(`未找到技能「${name}」`, '技能发动'); return; }
  showSkillTreePopup(owner, getConfig().style);
}
if (IS_FIRST_BOOT) (window as any).__ub_showSkillTree = showSkillTreeForTag;

// 技能卡片颜色变量：accentColor map → <style id="ub-skill-tag-colors"> 的 :root 变量族（幂等更新）
// v2 卡片（渐变底/描边/徽章/微光）全部经变量族取色，替代旧 color-mix（用户内核 Chromium 79+ 不支持，
// 铁律 21：旧写法下整条声明被丢弃=背景边框一直没显示）。新增卡为固定金色内联字面量，不依赖此处。
function expandSkillColorVars(name: string, color: string): string {
  let r = -1, g = -1, b = -1;
  const m = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(color);
  if (m) { r = Number(m[1]); g = Number(m[2]); b = Number(m[3]); }
  else {
    const h = /^#([0-9a-fA-F]{6})$/.exec(color);
    if (h) { const n = parseInt(h[1], 16); r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255; }
  }
  if (r < 0 || g < 0 || b < 0 || r > 255 || g > 255 || b > 255) return `--ub-skill-c-${name}:${color}`;
  return `--ub-skill-c-${name}:${color};--ub-skill-ic-${name}:rgba(${r},${g},${b},.16);--ub-skill-bd-${name}:rgba(${r},${g},${b},.5);--ub-skill-bdd-${name}:rgba(${r},${g},${b},.22);--ub-skill-gl-${name}:rgba(${r},${g},${b},.15)`;
}
function syncSkillTagColorCss(): void {
  const vars = Object.entries(getSkillAccentColorMap())
    .filter(([, c]) => c && !c.includes('"'))
    .map(([name, c]) => expandSkillColorVars(name, c))
    .join(';');
  let style = document.getElementById('ub-skill-tag-colors') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'ub-skill-tag-colors';
    document.head.appendChild(style);
  }
  style.textContent = vars ? `:root{${vars}}` : '';
}
if (IS_FIRST_BOOT) {
  setSkillTagColorSyncListener(syncSkillTagColorCss);
  syncSkillTagColorCss(); // 脚本注入即注入一次（map 可能为空，buildContent 后监听器会再同步）
}

// 技能卡片点击：document 级委托监听（酒馆 DOMPurify 会把正则替换 HTML 的 onclick 剥掉，委托监听不受影响；
// class 可能被剥——钩子一律用 data-* 属性，data-skill 优先、文本内容兜底）。
// 行为：点头部 = 展开/收起（发动卡每次展开经插件实时读取技能表/天赋树派生描述填入效果行）；
// 「天赋树」按钮 = 开天赋树弹窗；「手动添加」按钮（仅新增卡）= 手动补录弹窗（填表漏写时用）；
// 历史 DOM 里的旧胶囊（未经新正则重渲染）保持旧行为：点击直接开弹窗。
function fillSkillCardEffect(card: HTMLElement, name: string): void {
  const eff = card.querySelector('[data-ub-eff]') as HTMLElement | null;
  const typeEl = card.querySelector('[data-ub-type]') as HTMLElement | null;
  const info = resolveSkillDisplayDesc(name);
  if (typeEl) {
    typeEl.textContent = info ? info.type : '';
    typeEl.style.display = info && info.type ? 'inline-block' : 'none';
  }
  if (eff) eff.textContent = info ? info.desc : '（技能表中未找到该技能）';
}

function toggleSkillCard(card: HTMLElement): void {
  const body = card.querySelector('[data-ub-bd]') as HTMLElement | null;
  const chev = card.querySelector('[data-ub-chev]') as HTMLElement | null;
  const name = card.getAttribute('data-skill') || '';
  if (!body) { if (name) showSkillTreeForTag(name); return; } // 形态异常防御：回落旧行为
  const open = body.style.display !== 'none';
  if (!open) {
    if (card.getAttribute('data-kind') === 'fire' && name) fillSkillCardEffect(card, name);
    body.style.display = 'block';
    if (chev) chev.style.transform = 'rotate(180deg)';
  } else {
    body.style.display = 'none';
    if (chev) chev.style.transform = '';
  }
}

if (!(window as any).__ub_skill_tag_click_bound) {
  (window as any).__ub_skill_tag_click_bound = true;
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;
    const treeBtn = target.closest('[data-ub-tree]') as HTMLElement | null;
    if (treeBtn) {
      const n = treeBtn.getAttribute('data-skill') || '';
      if (n) showSkillTreeForTag(n);
      return;
    }
    const addBtn = target.closest('[data-ub-add]') as HTMLElement | null;
    if (addBtn) {
      const card = addBtn.closest('[data-ub-card]') as HTMLElement | null;
      if (card) {
        // 名称/类别/描述从卡片自身读取（标签是唯一事实源，不回头解析正文）
        const name = card.getAttribute('data-skill') || '';
        const type = (card.querySelector('[data-ub-type]') as HTMLElement | null)?.textContent || '';
        const desc = (card.querySelector('[data-ub-eff]') as HTMLElement | null)?.textContent || '';
        if (name) showSkillGainDialog({ name, type, desc });
      }
      return;
    }
    const hd = target.closest('[data-ub-hd]') as HTMLElement | null;
    if (hd) {
      const card = hd.closest('[data-ub-card]') as HTMLElement | null;
      if (card) { toggleSkillCard(card); return; }
    }
    if (target.closest('[data-ub-card]')) return; // 卡片内部其余区域（正文/斜线）：不响应
    // 历史 DOM 的旧胶囊（未经新正则重渲染）：保持旧行为直接开树
    const el = target.closest('.ub-skill-trigger, [style*="--ub-skill-c-"]') as HTMLElement | null;
    if (!el) return;
    const name = el.getAttribute('data-skill')
      || (el.textContent || '').replace(/^(?:⚡\s*)?技能发动[：:]\s*/, '').trim();
    if (name) showSkillTreeForTag(name);
  });
}

let _initDone = false;

// ===== 成就系统接线（受 achievementEnabled 总开关 gate）=====
// 开启：读入成就簿(零后续 I/O) + 注册解锁回调 + 接通 __ubEmitAchievement 派发器。
// 关闭：__ubEmitAchievement 退化为空函数(功能模块打点零成本)，不读簿、不注册回调 → 彻底零负担。
// 由 init() 与 setConfigChangeCallback 在开关切换时调用；重复调用幂等。
// 注意：开启→关闭时不清空已加载的成就簿内存（仅停扫描+停派发），关闭期间不落盘不计数；
//       关闭→开启时不补算关闭期间的进度（按用户要求不做兜底），从当前状态起继续。
function setupAchievementSystem(): void {
  if (!getConfig().achievementEnabled) {
    // 关闭路径：派发器退化为空函数，功能模块调用零成本（不排队、不计数、扫描中零消费）。
    (window as any).__ubEmitAchievement = function () { /* 成就功能已关闭：零负担空函数 */ };
    return;
  }
  // 开启路径：一次性读入成就簿到内存（后续扫描零 I/O）；注册解锁回调 → toastr(含趣评) + 特效。
  loadAchievementStore();
  setOnUnlocks((entries) => {
    const cfg = getConfig();
    if (!cfg.achievementNotifyEnabled) return;
    onAchievementUnlocks(entries);
  });
  // 全局成就事件派发器：功能模块（gacha/worldbook/scene/popup）经此打点，
  // 避免与 achievement-engine 的模块循环依赖（engine 反向 import gacha 取快照）。
  (window as any).__ubEmitAchievement = (event: string, payload: Record<string, number | string> = {}) => {
    try { emitAchievementEvent(event, payload); } catch (e) { /* ignore */ }
  };
}

function setStorageLoadingIndicator(loading: boolean, opts?: { stuckReason?: string }): void {
  const wrapper = document.getElementById('ac-statusbar-wrapper');
  if (!wrapper) return;
  const stuck = opts?.stuckReason;
  // 升级为失败态时不再转圈：仅保留提示胶囊并换警示样式（见 base.ts .ub-storage-failed）。
  wrapper.classList.toggle('ub-storage-syncing', loading && !stuck);
  wrapper.classList.toggle('ub-storage-failed', !!stuck);
  let indicator = wrapper.querySelector('.ub-storage-sync-indicator') as HTMLElement | null;
  if (!loading && !stuck) {
    indicator?.remove();
    return;
  }
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'ub-storage-sync-indicator';
    indicator.setAttribute('role', 'status');
    indicator.setAttribute('aria-live', 'polite');
    wrapper.appendChild(indicator);
  }
  indicator.classList.toggle('ub-storage-failed', !!stuck);
  indicator.textContent = stuck ?? '存档同步中';
}

function renderStorageLoadingShell(): void {
  const config = getConfig();
  currentStyle = config.style;
  injectCSS(currentStyle);
  render(true);
  applyVisibility();
  applyMobileFixes();
  bindEvents();
  setStorageLoadingIndicator(true);
  if ((window as any).__ub_perf_load_start != null) {
    // eslint-disable-next-line no-console
    console.log(`[ub-perf] load-to-first-frame=${(performance.now() - (window as any).__ub_perf_load_start).toFixed(2)}ms`);
  }
}

// 在跑锁：本链由 300ms tick 的 requestRefresh 反复触发（void 不等待），链耗时超过 300ms 时
// （外部存档慢/世界书投影重）旧一轮未完成新一轮又起，并发重叠做重复投影/写入。
// 跳过的一轮无损失：链每次执行都读最新状态，下个 tick（300ms 后）自然补跑。
let _readyAutomationRunning = false;
async function runReadyStoryAutomation(): Promise<void> {
  if (!isStoryStorageReady()) return;
  // 重填模式：就绪自动化整条停摆（决策队列/日历日期变更+自动生成/经期/日历投影/地图/立绘）。
  // 重填期间不需要状态栏跟随刷新；关闭后下一次 tick 照常跑本链。
  if (isRefillMode()) return;
  if (_readyAutomationRunning) return;
  _readyAutomationRunning = true;
  try {
  // 不在此清 cycle 内存缓存：cycle `_store` 是同一聊天内的权威缓存（读永远命中内存，
  // 文件只负责写入/首载/切卡重载）。每 300ms tick 清缓存会让 loadCycleStore 被迫重读
  // write-behind overlay/journal，一旦撞上落盘 flush 清 overlay、journal.write 尚未写入的
  // 窗口就读到空 → 经期冷启动重复弹通知。切卡重载由 loadCycleStore 自带的 chatKey 守卫负责，
  // 无需此处强制清缓存。
  invalidateCycleDecisionRuntime();
  flushSystemDecisionQueue();
  await handleCalendarDateChange(async () => {
    await performCalendarGeneration();
  }).then((changed: boolean) => {
    if (changed) render(true);
  });
  handleCycleTick();
  void projectCalendarToWorldbook();
  const config = getConfig();
  // 关键表内容签名守卫：地图只看「全局数据表」，立绘只看「在场角色表」。
  // 分组填表逐组触发 _notifyTableUpdate 时，先完成的分组若不含对应关键表则内容未变，
  // 抑制本次自动刷新，避免用旧数据生成过期的立绘/地图。手动 force 路径不经过本函数，不受影响。
  // 【台账接管 + every-turn】立绘改由台账「在场角色表本轮落账完成」信号驱动（portrait-system
  //   的 requestLedgerPresencePortraitUpdate），表格脏检查这条路整条让开——否则任何分组落账/
  //   重注入/缓存重建都可能再点一次火，回到"一轮两张"的老问题。
  const portraitDrivenByLedgerSignal = config.portraitAutoUpdateMode === 'every-turn' && isLedgerTakeover();
  if (config.mapEnabled && mapDirtyGuard.consumeAutoGenDirty('map')) refreshMapDebounced();
  if (config.portraitEnabled && !portraitDrivenByLedgerSignal && portraitDirtyGuard.consumeAutoGenDirty('portrait')) refreshPortraitDebounced();
  perfStart('automation-render');
  // 自动化投影的渲染覆盖（只读验证 2026-08-22）：
  // - handleCalendarDateChange 已自带条件 render(true)（changed 时才渲）；
  // - handleCycleTick 写 cycle 记录 → story flush 派发 ub-story-state-invalidated/cache-changed → render(true)；
  // - projectCalendarToWorldbook 只写世界书（不进状态栏 DOM），且走 requestWorldbookProjection 派发。
  // 故这里不再无条件强渲（原实现每 tick 存储就绪都强渲 = 签名 render 之外的重复整链，doRender 85ms×N）。
  // 数据表变化仍由 300ms 节流的签名 render() 兜底；不再变化时走签名早退，零整链成本。
  render();
  perfEnd('automation-render');
  // 标记刚跑过 ready 投影，让紧随其后的 state-invalidated（flush 落盘）抑制重复投影（B1）。
  _lastReadyAutomationAt = Date.now();
  } finally {
    _readyAutomationRunning = false;
  }
}

const storyReadinessCoordinator = createStoryReadinessCoordinator({
  isReady: () => isStoryStorageReady(),
  runStoryRefresh: runReadyStoryAutomation,
  setLoading: setStorageLoadingIndicator,
  // 非瞬态失败（只读保护/冲突/错误）升级为失败提示，避免「存档同步中」无限转圈且无解释。
  getStuckReason: () => {
    const story = getStatusbarStorageStatus().story.external;
    if (story && (story.state === 'read-only' || story.state === 'conflict' || story.state === 'error')) {
      return story.lastError
        ? `存档同步失败（${story.state}：${story.lastError}）`
        : `存档同步失败（${story.state}）`;
    }
    return null;
  },
  setStuck: reason => setStorageLoadingIndicator(!!reason, { stuckReason: reason || undefined }),
});

async function init(): Promise<void> {
  // O39(第十一轮)：成就目录惰性装载点火——解析在微任务内完成（503KB 目录不再占用启动的
  // 同步求值路径），与外部存档的网络往返并行；扫描入口另有就绪门，正常感知不到。
  void ensureAchievementCatalog();
  if (_initDone) return;
  // 性能打点：ub_perf_debug==='1' 时开启热路径计时（默认关闭，零开销）。
  try {
    const _perfDebugOn = (localStorage.getItem('ub_perf_debug') || '') === '1';
    setPerfDebug(_perfDebugOn);
    if (_perfDebugOn) (window as any).__ub_perf_dump = perfDump;
    perfReset();
  } catch { /* ignore */ }
  initializeWorldbookProjectionRuntime();
  // 台账落账信号：传输层（core/ledger-presence-signal）在应用启动时绑定一次（幂等），
  // 不依赖立绘初始化、也不依赖聊天是否已就绪。「欢迎页启动→再进聊天」「切卡/重注入」
  // 「存储晚就绪」都不会漏绑；handler 内部再按 portraitEnabled / every-turn / 台账接管 /
  // 重填模式自门控（立绘关闭时每轮只多几次布尔判断）。
  bindLedgerPresenceSignal((token) => requestLedgerPresencePortraitUpdate(token));
  if (!(window as any).__ub_storage_migration_reminder_bound) {
    (window as any).__ub_storage_migration_reminder_bound = true;
    window.addEventListener(STATUSBAR_STORAGE_READY_EVENT, () => {
      // 切卡屏障：先排空数据库写回队列，防跨卡串数据（队列批次按旧卡 row_id 寻址）
      void flushDbWrites();
      invalidateAssistantUIForChatChange();
      advanceWardrobeProjectionEpoch();
      const readyChatKey = getCurrentStoryChatKey();
      if (readyChatKey) {
        void initStoryBackupSystem(readyChatKey);
      }
      void storyReadinessCoordinator.notifyReady().then(replayed => {
        if (!replayed) void storyReadinessCoordinator.requestRefresh();
      });
      // 重填模式：衣柜协调会写「主角当前穿搭」世界书条目、reapplyCharacterCardWorldbooks 会整批
      // 重建世界书投影——两者都是自动写入，重填期间跳过。
      // switchChat() 本身只换内存/读盘，保留以免切卡后衣柜面板读到旧卡数据。
      if (getConfig().wardrobeEnabled) {
        closeWardrobePanel();
        void getWardrobeRuntime().switchChat().then(async () => {
          if (!isRefillMode()) await reconcileWardrobeStateAndProjection();
          render(true);
        });
      } else if (!isRefillMode()) {
        void reconcileWardrobeStateAndProjection();
      }
      // 切换到新角色卡：重注入切卡时缺失的世界书条目（地图节点/概览、日历WB）。
      // 地图/立绘刷新与玩法WB已分别由 runReadyStoryAutomation / handleReinject 负责，此处不重跑，避免重复劳动。
      // 覆盖「欢迎页面 → 选角色卡」（init 时因无 chatKey 跳过的初始化在此补做）与卡间切换。
      // 用 requestIdleCallback 延后（B2）：进卡首屏 DB 数据已渲染后再做世界书同步，不阻塞首屏。
      if (!isRefillMode()) scheduleIdle(() => reapplyCharacterCardWorldbooks());
    });
  }
  const initialStoragePromise = initializeStatusbarStorage();
  renderStorageLoadingShell();
  void registerUpdateListener();
  perfStart('load-storage-init');
  await initialStoragePromise;
  perfEnd('load-storage-init');
  setStorageLoadingIndicator(false);
  initStoryFloorStore();
  // 弹窗配色来源：从持久化配置同步模式缓存（默认跟随插件，零开销路径）。
  setPanelColorMode(getConfig().panelColorMode === 'tavern' ? 'tavern' : 'plugin');
  // 渲染跟着缓存走：每次缓存变更（写时）立即重渲染状态栏，不等后端落盘（用户体感仅取决于内存速度）。
  // 与下面的 ub-story-state-invalidated 解耦：后者在落盘完成(flush)后才跑，驱动 cycle/日历/衣柜派生投影。
  // render() 走脏检查（签名含 story 输入指纹：立绘令牌+主角穿搭，见 composeRenderSignature）——
  // 立绘/穿搭写入照常重建；无关 story 写（calendar/cycle/map 等经投影间接影响，tableSig/badgeSig
  // 已覆盖）被签名跳过，消灭「每 story 写必全量重建」。rAF 合并保持：连点 N 次只渲染一次。
  if (!(window as any).__ub_story_cache_changed_bound) {
    (window as any).__ub_story_cache_changed_bound = true;
    window.addEventListener(UB_EVENT.storyCacheChanged, () => {
      if (!isStoryStorageReady()) return;
      render();
    });
  }
  if (!(window as any).__ub_story_projection_sync_bound) {
    (window as any).__ub_story_projection_sync_bound = true;
    window.addEventListener(UB_EVENT.storyStateInvalidated, () => {
      advanceWardrobeProjectionEpoch();
      if (!isStoryStorageReady()) {
        void storyReadinessCoordinator.requestRefresh();
        return;
      }
      // 聊天切换检测：仅当本事件所见聊天与上一次不同才关面板 + switchChat（保留切卡安全语义）。
      // 同聊天落盘（衣柜删除/生图/编辑/穿戴）面板保持打开，只刷新缓存并重投影。
      const chatKey = getCurrentStoryChatKey();
      const chatChanged = chatKey !== _lastStoryInvalidatedChatKey;
      _lastStoryInvalidatedChatKey = chatKey;
      if (chatChanged) {
        invalidateAssistantUIForChatChange();
        // 仅切卡时清 cycle 权威缓存：loadCycleStore 自带 _loadedChatKey===chatKey 守卫负责切卡重载，
        // 同聊天 flush（衣柜删除/生图/编辑/穿戴等落盘）不清缓存——若每 flush 都清，读回窗口内
        // loadCycleStore 会重读 write-behind 落盘态，撞上 flush 清 overlay、journal.write 尚未写完的
        // 空窗口就读到空 → 经期对全 roster 重新冷启动（重复「已为 X 建立周期记录」+ 重复 upload）。
        invalidateCycleStoreCache();
      }
      // 冷却（B1）：若进卡 ready-automation 刚在 STORY_PROJECTION_COOLDOWN_MS 内跑过同一批
      // cycle/日历/衣柜投影，则跳过重复投影（flush 落盘紧跟 ready 级联，投影已完成）。
      // swipe/delete/sync 等非入场场景落在冷却窗外，照常重投影。render(true) 始终执行。
      const _withinReadyCooldown = Date.now() - _lastReadyAutomationAt <= STORY_PROJECTION_COOLDOWN_MS;
      // 重填模式：跳过这一整块自动写入（决策队列/经期/日历投影/衣柜协调），仅保留 render(true)。
      // 本事件由 story 落盘派发，而重填期间的自动落盘已被各闸门拦下，故通常不会到达这里；
      // 兜住「开启重填模式前已排队的落盘」与外部写入两种残留路径。
      if (!_withinReadyCooldown && !isRefillMode()) {
        invalidateCycleDecisionRuntime();
        flushSystemDecisionQueue();
        handleCycleTick();
        void projectCalendarToWorldbook();
        if (getConfig().wardrobeEnabled) {
          if (chatChanged) {
            closeWardrobePanel();
            void getWardrobeRuntime().switchChat().then(async () => {
              await reconcileWardrobeStateAndProjection();
              render(true);
            });
          } else {
            loadWardrobeState();
            void reconcileWardrobeStateAndProjection();
            refreshWardrobePanel();
          }
        } else {
          void reconcileWardrobeStateAndProjection();
        }
      }
      // O37(第十一轮)：降级为脏检查——签名已覆盖全部 story 派生显示输入（见 composeRenderSignature），
      // 无关落盘（地图/图库/投影）零重渲；切卡分支上方仍保留自己的 render(true)。
      render();
    });
  }
  // 统一 toastr 通知配置：3秒后自动消失
  try {
    const tr = getToastr();
    if (tr) {
      tr.options.timeOut = 3000;
      tr.options.extendedTimeOut = 1000;
      tr.options.closeButton = false;
      tr.options.progressBar = true;
    }
  } catch (e) { /* cross-origin */ }
  // 按钮/齿轮拖拽位置持久化于 localStorage：不在 init 清空，用户拖至不可触达位置时
  // 可通过清除浏览器缓存（localStorage）恢复默认位置。
  // 最早创建两个关键按钮，确保任何情况下可用
  createPersistentSettingsBtn();
  createFixedToggleBtn();
  // AI 活动注册表：聊天键读取口 + 统一通知 + 主界面提示条 + 悬浮钮动效（全部幂等、事件驱动）
  setAiActivityChatKeyReader(getCurrentStoryChatKey);
  initAiActivityNotify();
  initAiActivityBar();
  subscribeAiActivities(() => syncFixedToggleAi());
  // 立即应用 wrapper 样式（避免跟随底部模式下等待数据期间样式未生效）
  updateWrapperStyle();
  // 立即应用固定模式按钮状态（不等待数据）
  updateFixedToggleBtn();
  syncFixedToggleAi();
  // 首次加载折叠按钮引导（仅首次，点击后消失）
  showFixedToggleOnboarding();

  const config = getConfig();
  currentStyle = config.style;
  if (config.wardrobeEnabled) {
    setupWardrobeActionBridge(true);
    injectWardrobeCss(true);
    loadWardrobeState();
    const runtime = getWardrobeRuntime();
    runtime.load();
    bindWardrobeRuntime(runtime);
  }
  // 衣柜投影协调会写「主角当前穿搭」到角色卡世界书（syncWardrobeWorldbook）——
  // 欢迎页面无角色卡、世界书未就绪，无脑跑只会刷「衣柜世界书同步失败」报错。
  // 仅在已载入角色卡时投影；切卡由 STATUSBAR_STORAGE_READY_EVENT 监听器补做（见上）。
  // 重填模式：跳过（投影会写角色卡世界书）。
  if (getCurrentStoryChatKey() && !isRefillMode()) {
    void reconcileWardrobeStateAndProjection();
  }
  applyStatusbarContentFontScale(config.statusbarContentFontScale);
  applyUiFontScale(config.popupSettingsFontScale);
  injectCSS(currentStyle);
  // 通知美化总开关：按 notifyEffect 四档决定皮肤或回原生 toastr（auto 读 darkTheme 定素瓷/云墨）
  setNotifyBeautifyEnabled(config.notifyEffect !== 'original', currentStyle, config.notifyAlign, config.notifyEffect, !!config.darkTheme);
  // O5：非关键 CSS 推迟到空闲帧（幂等注入器，晚 ≤1 个空闲周期；首个真实交互远在其后）。
  // 决策弹窗 CSS 不延后：MESSAGE_RECEIVED 驱动，重注入后一秒内就可能弹出。
  scheduleIdle(function() {
    injectBeyondLensCSS();
    injectItemOverviewCSS();
    injectWarehouseCSS();
    injectCurrencyPopupCSS();
  });
  // 注入决策弹窗主题样式（幂等；世界动态/地图归属/经期表单/跳跃摘要共用）
  injectDecisionCSS();

  // 直接渲染（无数据时也显示状态栏框架）
  doInitRender();
}

// ===== 全局帮助提示管理器 =====
let _globalTooltip: HTMLElement | null = null;
let _tooltipHideTimer: ReturnType<typeof setTimeout> | null = null;

function getGlobalTooltip(): HTMLElement {
  if (!_globalTooltip) _globalTooltip = document.getElementById('helpTooltipGlobal');
  return _globalTooltip!;
}

function showHelpTooltip(btn: HTMLElement, text: string): void {
  if (_tooltipHideTimer) { clearTimeout(_tooltipHideTimer); _tooltipHideTimer = null; }
  const tip = getGlobalTooltip();
  if (!tip || !text) return;
  tip.textContent = text.replace(/\\n/g, '\n');
  tip.style.display = '';
  const rect = btn.getBoundingClientRect();
  const tipWidth = 260;
  let left = rect.left + rect.width / 2 - tipWidth / 2;
  if (left < 8) left = 8;
  if (left + tipWidth > window.innerWidth - 8) left = window.innerWidth - tipWidth - 8;
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const spaceAbove = rect.top - 8;
  tip.style.transform = '';
  if (spaceBelow >= 80 || spaceBelow > spaceAbove) {
    tip.style.top = (rect.bottom + 6) + 'px';
  } else {
    tip.style.top = (rect.top - 6) + 'px';
    tip.style.transform = 'translateY(-100%)';
  }
  tip.style.left = left + 'px';
}

function hideHelpTooltip(): void {
  _tooltipHideTimer = setTimeout(function () {
    const tip = getGlobalTooltip();
    if (tip) { tip.style.display = 'none'; tip.style.transform = ''; }
    _tooltipHideTimer = null;
  }, 150);
}

// 超过该长度的说明不走 hover 气泡（260px 定宽塞不下多段教程），点「?」改开可滚动说明面板
const UB_LONG_TIP = 120;

// 暴露到 window 供 help-tip-btn 内联事件调用（IS_FIRST_BOOT 门控：双实例副本 2 不得覆盖）
if (IS_FIRST_BOOT) {
  (window as any).__ubShowHelpTip = function (btn: HTMLElement): void {
    const text = btn.getAttribute('data-tooltip') || '';
    if (text.length > UB_LONG_TIP) return;
    showHelpTooltip(btn, text);
  };
  (window as any).__ubHideHelpTip = function (): void {
    hideHelpTooltip();
  };
  // 触屏无 hover：点按「?」帮助点切换 tooltip（桌面误点行为等同再次悬停，无害）
  (window as any).__ubToggleHelpTip = function (btn: HTMLElement): void {
    const tip = getGlobalTooltip();
    if (tip && tip.style.display !== 'none' && (tip as any).__ubFor === btn) {
      (tip as any).__ubFor = null;
      hideHelpTooltip();
      return;
    }
    if (tip) (tip as any).__ubFor = btn;
    (window as any).__ubShowHelpTip(btn);
  };
}
// 委托：点按任意 [data-tooltip] 载体切换其 tooltip（帮助点/天气图标/设置说明统一触屏可开；
// 新按钮无需逐个绑 onclick）。命中载体内部的交互控件（开关/按钮/输入框等）时不弹，
// 避免点开关顺带弹出所在行的说明。
if (!(window as any).__ub_helptip_click_bound) {
  (window as any).__ub_helptip_click_bound = true;
  document.addEventListener('click', function (e) {
    const hit = (e.target as HTMLElement).closest?.('[data-tooltip]');
    if (!hit) return;
    const inner = (e.target as HTMLElement).closest?.('button,input,select,textarea,label,a,summary');
    if (inner && inner !== hit && hit.contains(inner)) return;
    const tipText = hit.getAttribute('data-tooltip') || '';
    if (tipText.length > UB_LONG_TIP) { showHelpPanel(tipText); return; }
    (window as any).__ubToggleHelpTip(hit);
  }, true);
}

// ===== 萦绕风格角色悬浮提示移动端修复 =====
// 为 .name-hoverable 添加 touchend 处理：点击元素外部时隐藏角色提示
if (!(window as any).__ub_tooltip_touchend_bound) {
  (window as any).__ub_tooltip_touchend_bound = true;
  document.addEventListener('touchend', function(e: TouchEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.name-hoverable')) {
      const tooltip = document.getElementById('char-tooltip');
      if (tooltip) tooltip.classList.remove('visible');
    }
    // 点按 tooltip 载体以外区域时收起全局 tooltip（配合 __ubToggleHelpTip 的点按开启）
    if (!target.closest('[data-tooltip]')) {
      const tip = document.getElementById('helpTooltipGlobal');
      if (tip && tip.style.display !== 'none') {
        (tip as any).__ubFor = null;
        tip.style.display = 'none';
      }
    }
  });
}

// 等待 AutoCardUpdaterAPI 就绪后注册数据更新回调（API 初始化可能晚于 iframe 加载）
// 使用节流避免数据频繁更新时连续触发全量渲染
let _dataUpdateTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingTableUpdateData: unknown = null;
// 表格新增行检测基线（成就打点用）：物品表/恋爱日记表/备忘录 行数，跨 tick 比较新增
let _lastItemRows = 0;
let _lastDiaryRows = 0;
let _lastMemoRows = 0;
// 主角技能自动建表已处理到的对话键（进入新角色卡时按需重建，每对话首次）
let _lastSkillEnsureChatKey = '';
// 成就累计已重锚到的对话键：跨对话累计只记游玩增量，切卡/首载时把基线重锚到新卡存量。
let _lastAchievementRebaseChatKey = '';

async function registerUpdateListener(): Promise<void> {
  // F4：window 令牌——宿主 AutoCardUpdaterAPI 上的回调按闭包身份注册，模块重求值后旧闭包
  // 无法摘除，模块布尔挡不住第二份（每个表格 tick 双跑整条渲染链）。轮询等待期同理只留一份。
  const w = window as any;
  if (w.__ub_update_listener_started) return;
  w.__ub_update_listener_started = true;
  // 分两阶段轮询：前 3 秒高频（100ms/次），之后低频（500ms/次），总计最多等 30 秒
  // 避免父页面加载慢导致回调永不被注册
  let attempt = 0;
  while (attempt < 84) {
    const api = getAutoCardAPI();
    if (api && typeof api.registerTableUpdateCallback === 'function') {
      // 跨 iframe 重注入替换：宿主 API 上的回调按闭包身份注册，上一份状态栏 iframe 的闭包无法从本
      // 窗口摘除（上面的模块布尔只防同窗口重求值）——把回调存「父窗口」引用一份，重注册前先注销旧的
      // （台账侧 unregisterTableUpdateCallback 已实现真注销；真数据库无此方法时退回旧行为=旧闭包遗留）。
      const hostW: any = (() => {
        try { const p = (window as any).parent; if (p && p !== window) return p; } catch (_e) { /* cross-origin */ }
        return window;
      })();
      try {
        const staleCb = hostW.__ub_table_update_cb;
        if (staleCb && typeof (api as any).unregisterTableUpdateCallback === 'function') {
          (api as any).unregisterTableUpdateCallback(staleCb);
          hostW.__ub_table_update_cb = null;
        }
      } catch (_e) { /* ignore */ }
      const tableUpdateCb = (tableData: unknown) => {
        _pendingTableUpdateData = tableData;
        // 节流：300ms 内只渲染一次，避免数据频繁更新时连续全量重建 DOM。
        // invalidateCache/checkNotifications/handleTableUpdate 也移入节流内——
        // 它们读表会触发 exportTableAsJson 全表序列化，AI 生成期间回调每秒可达十几次，
        // 每次都跑 = 每秒 20-40 次全表序列化；移入节流后降为每 300ms 一次，
        // 数据新鲜度与 render 一致（render 本就 300ms 一次）。
        if (_dataUpdateTimer) return;
        _dataUpdateTimer = setTimeout(() => {
          _dataUpdateTimer = null;
          // 重填模式：整条自动链停摆——本 tick 是「自动 AI 请求 + 自动数据写入」的总入口，
          // 涵盖时间锚定回写、技能/人物关系世界书、经期/孕期、衣柜编排、成就扫描与打点基线、
          // 状态栏渲染、以及 requestRefresh → 地图/立绘/日历自动化。
          // 用户重填期间不需要状态栏跟随刷新。
          if (isRefillMode()) return;
          perfStart('tick-total');
          const latestTableData = _pendingTableUpdateData;
          _pendingTableUpdateData = null;
          if (!document.body) return;
          // 空快照防护（DB 切卡/重载 null 窗口投递 {}）：空快照不置 null 缓存、不渲染，
          // 保留上一份有效快照，避免状态栏闪成空白；下一条带真数据的回调会正常刷新。
          const _hasSnapshot = hasDatabaseTableSnapshot(latestTableData);
          // 本 tick 强制读最新数据：供 checkNotifications、handleTableUpdate 与 render 使用
          perfStart('tick-buildCache');
          if (_hasSnapshot) invalidateCache();
          // 表快照变化后宅仙资料目录可能过期（新表/改名）；只清缓存，重建推迟到下一次提问
          if (_hasSnapshot) invalidateAssistantSourceCatalog();
          perfEnd('tick-buildCache');
          // 非空快照 = 当前聊天的真实表格数据 → 打表缓存归属标记（切卡过渡期的旧卡残留快照
          // 不会打标，cycle-engine 凭此判定「缓存是否属于当前聊天」，杜绝跨卡误冷启动）。
          if (_hasSnapshot) markSheetCacheChatKey(getCurrentStoryChatKey());
          if (_hasSnapshot) {
            // 阅读器若正开，只标记其按需页缓存失效；不在用户滚动时强制重读或重建列表。
            emitUbEvent(UB_EVENT.chronicleDataUpdated);
          }
          // 切卡/首载检测（成就累计门控）：chatKey 变化且已有真实数据快照时，
          // 把成就累计基线重锚到新卡当前存量 + 重置物品/日记/备忘录行数打点基线，
          // 保证「新卡存量不计为新增，累计只发生在角色卡游玩过程中」。
          if (_hasSnapshot && getConfig().achievementEnabled) {
            const _achChatKey = getCurrentStoryChatKey();
            if (_achChatKey && _achChatKey !== _lastAchievementRebaseChatKey) {
              _lastAchievementRebaseChatKey = _achChatKey;
              rebaseAchievementBaselines();
              // 行数打点基线重置到新卡当前值（避免新卡更多行数被当成本 tick「新增」emit）
              try {
                _lastItemRows = Math.max(0, (getSheetByName('物品表')?.content?.length || 1) - 1);
                _lastDiaryRows = Math.max(0, (getSheetByName('恋爱日记表')?.content?.length || 1) - 1);
                _lastMemoRows = Math.max(0, (getSheetByName('备忘录')?.content?.length || 1) - 1);
              } catch (_e) { /* ignore */ }
            }
          }
          // 面板若保持打开，立即重采角色名单并归一化已离场目标；关闭时为常量时间早退。
          perfStart('tick-wardrobe');
          refreshWardrobePanel();
          // 衣柜名单协调与日期换装独立于日历功能开关；内部由 wardrobeEnabled 守卫。
          void handleWardrobeAutomationTick();
          perfEnd('tick-wardrobe');
          // 成就打点：检测表格新增行（物品获得 / 日记新增 / 备忘录新增）。
          // 必须在 achievementScan() 之前 emit，使事件先入 _pending 队列、再被 scan 内 consumePending 消费。
          // 仅在成就开关开启时检测（关闭时 __ubEmitAchievement 为空函数，但此处读表也省了）。
          if (getConfig().achievementEnabled) {
            try {
              const itemRows = (getSheetByName('物品表')?.content?.length || 1) - 1;
              if (itemRows > _lastItemRows) {
                (window as any).__ubEmitAchievement?.('item_obtained', { amount: itemRows - _lastItemRows });
              }
              _lastItemRows = itemRows;
              const diaryRows = (getSheetByName('恋爱日记表')?.content?.length || 1) - 1;
              if (diaryRows > _lastDiaryRows) {
                (window as any).__ubEmitAchievement?.('diary_written', {});
                (window as any).__ubEmitAchievement?.('action-on-date', { action: 'diary_written' });
              }
              _lastDiaryRows = diaryRows;
              const memoRows = (getSheetByName('备忘录')?.content?.length || 1) - 1;
              if (memoRows > _lastMemoRows) {
                (window as any).__ubEmitAchievement?.('memo_created', {});
              }
              _lastMemoRows = memoRows;
            } catch (_e) { /* ignore */ }
          }
          perfStart('tick-notify');
          // 与 invalidateCache/handleTableUpdate 同规格：空快照（切卡/重载 null 窗口）不判定，
          // 否则徽章基线会被锚成 0，真实数据到达后凭空跳 N（v4 起内部另有缓存聊天键守卫）。
          if (_hasSnapshot) checkNotifications();
          perfEnd('tick-notify');
          // 成就扫描：搭 checkNotifications 已暖的缓存便车（零额外 I/O），解锁不触发状态栏重渲染
          // 受 achievementEnabled 总开关 gate：关闭时不扫描（零遍历/零计数/零 I/O）
          perfStart('tick-achieve');
          if (getConfig().achievementEnabled) achievementScan();
          perfEnd('tick-achieve');
          perfStart('tick-timeanchor');
          handleTableUpdate(latestTableData);
          perfEnd('tick-timeanchor');
          // 主角技能表变更 → 同步派生常亮条目「主角当前技能」（强化后描述喂给 AI）。
          // 欢迎页无角色卡（chatKey 为空）不写角色世界书。
          perfStart('tick-skillwb');
          if (getConfig().skillEnabled && getCurrentStoryChatKey()) void syncSkillWorldbook();
          perfEnd('tick-skillwb');
          // 人物关系表变更 → 与触发世界书条目同步（签名幂等；配置关/表缺失/签名未变零开销早退）
          perfStart('tick-charrelation');
          if (getCurrentStoryChatKey()) syncCharacterRelationWorldbook();
          perfEnd('tick-charrelation');
          // 主角技能：进入新角色卡（聊天切换）后若功能开启，确保「主角技能表」指南已登记（每对话首次）
          // （表不存在则静默跳过——不自动建表，由「数据库模板修复」入口补建）
          if (getConfig().skillEnabled) {
            const _skKey = getCurrentStoryChatKey();
            if (_skKey && _skKey !== _lastSkillEnsureChatKey) { _lastSkillEnsureChatKey = _skKey; void ensureSkillTable(); }
          }
          // 时间窗模式（含时间窗+菜单）：刷新按钮上显示的时间/地点
          const _btnStyle = getConfig().collapseBtnStyle;
          if (_btnStyle === 'time-window' || _btnStyle === 'time-window-menu') {
            updateFixedToggleBtn();
          }
          // 渲染：走签名脏检查；真实数据变化照常更新，无变化回调不再全量重建 DOM
          // 空快照（null 窗口 {}）不渲染：保持上次有效 DOM，避免进卡时数据闪成空白
          perfStart('tick-render');
          if (_hasSnapshot) render();
          perfEnd('tick-render');
          // 经期/孕期世界书：日期变更驱动。必须走无条件路径（对齐旧版 300ms 便车），不能只依赖
          // requestRefresh 的 storage-ready 门控——若外部存档未就绪，runReadyStoryAutomation 不会执行、
          // handleCycleTick 不会跑，日期变更时经期/孕期世界书就不更新（加载卡/开关功能走非门控路径正常）。
          // handleCycleTick 内部按 cycleMode==='off' 早退 + per-record lastProcessedDateKey 幂等锚，
          // 300ms 便车开销可控；重复执行由签名幂等去重。空快照窗口不驱动（缓存可能陈旧）。
          perfStart('tick-cycle');
          // O38(第十一轮)：就绪时跳过直调——紧随其后的 requestRefresh 会同步跑 run()→
          // runReadyStoryAutomation→handleCycleTick（同一回调内双跑，NSFW 建索引+三表枚举 ×2）。
          // 未就绪时保留直调：日期变更驱动的经期/孕期世界书不依赖 storage-ready 门控（见上注释）。
          if (_hasSnapshot && !isStoryStorageReady()) handleCycleTick();
          perfEnd('tick-cycle');
          // 剧情自动业务统一等待当前聊天外部存档就绪；加载期只保留数据库只读渲染。
          void storyReadinessCoordinator.requestRefresh();
          perfEnd('tick-total');
        }, 300);
      };
      api.registerTableUpdateCallback(tableUpdateCb);
      try { hostW.__ub_table_update_cb = tableUpdateCb; } catch (_e) { /* ignore */ }
      try {
        handleTableUpdate(api.exportTableAsJson?.() || {});
      } catch { /* 数据库尚未载入当前聊天时保持静默，等待正式更新回调 */ }
      // 主角技能：DB 就绪后若功能开启，确保「主角技能表」指南已登记（表不存在则静默跳过，不自动建表）；记录当前对话键，供聊天切换时按需补登
      // 重填模式：跳过一次（登记指南属自动写入，会改动当前聊天的表格指南）；关闭后由恢复链的
      // reapplyCharacterCardWorldbooks / 下一 tick 的 ensureSkillTable 按对话键补登。
      if (getConfig().skillEnabled && !isRefillMode()) { _lastSkillEnsureChatKey = getCurrentStoryChatKey(); void ensureSkillTable(); }
      return;
    }
    attempt++;
    // 前 30 次（3 秒）每 100ms 一次，之后每 500ms 一次
    const delay = attempt < 30 ? 100 : 500;
    await new Promise(r => setTimeout(r, delay));
  }
  console.warn('[statusbar] AutoCardUpdaterAPI 在 30 秒内未就绪，数据更新将不会自动刷新状态栏。切换风格可手动刷新。');
}

/**
 * 角色卡相关功能初始化：地图系统 / 立绘系统 / 日历世界书 / 玩法世界书注入。
 * 这些都依赖「当前角色卡的世界书」——酒馆欢迎页面没有角色卡、世界书未就绪，
 * 强行注入只会刷一堆「世界书未就绪」报错，且在欢迎页面做毫无意义。
 * 故仅在 getCurrentStoryChatKey() 非空（已载入角色卡）时调用。
 *
 * 这是「首次初始化」语义（建内存缓存 + 首次注入），只在 doInitRender() 末尾调用一次。
 * 切卡刷新走 reapplyCharacterCardWorldbooks()，**不要**重复调用本函数——
 * 地图/立绘的刷新已由 runReadyStoryAutomation 的 refreshMapDebounced/refreshPortraitDebounced 负责，
 * 玩法世界书已由 loader 的 handleReinject（CHAT_CHANGED）负责，这里重跑只会重复劳动。
 */
async function initCharacterCardFeatures(): Promise<void> {
  const chatKey = getCurrentStoryChatKey();
  if (chatKey) void initStoryBackupSystem(chatKey);
  const cfg = getConfig();
  if (cfg.mapEnabled) {
    // 起地图系统
    void initMapSystem();
    void syncMapOverviewToMiscTable();
    void syncMapNodeWorldbookEntries();
  }
  if (cfg.portraitEnabled) {
    // 读当前角色卡世界书索引到内存缓存（按 chatKey）
    void initPortraitSystem();
  }
  // 日历世界书条目（投影内部已按 calendarEnabled 开闭条目）
  projectCalendarToWorldbook().then(() => {
    if (getConfig().calendarEnabled) {
      // 加载今日天气并渲染图标（不必等首次表格更新回调）
      refreshTodayWeather().then(() => render(true)).catch(() => { /* ignore */ });
    }
  });
  // 经期/孕期世界书：首载角色卡时同步（storage-ready 门控路径可能未跑 handleCycleTick，
  // 此处补非门控兜底；内部按 cycleMode 早退 + 签名幂等，重跑无副作用）。
  handleCycleTick();
  // 玩法世界书：按当前选中态注入角色卡 WB
  reconcilePlayWorldbook();
}

/**
 * 切卡专用：按新角色卡重注入世界书条目。
 * 只补做切卡时原本缺失的部分——
 *   - 地图节点世界书 + 地点概览同步（新卡空白，须重注入）；
 *   - 日历世界书条目 ensure（新卡可能没有）。
 * 刻意**不**调地图/立绘 init 与玩法世界书：
 *   - 地图/立绘由同事件链上 runReadyStoryAutomation 的 refreshMapDebounced/refreshPortraitDebounced 防抖刷新
 *     （initPortraitSystem 与 refreshPortraitDebounced 工作完全相同，重跑只会把防抖降级、全量重读索引）；
 *   - 玩法世界书由 loader 的 handleReinject（CHAT_CHANGED）已重注入。
 * 覆盖「欢迎页面 → 选角色卡」（init 时因无 chatKey 跳过）与卡间切换。
 */
function reapplyCharacterCardWorldbooks(): void {
  // 重填模式：整段跳过（本函数全部是自动世界书写入）。其中 refreshAllWorldbookProjections 走
  // 协调器直连、不经过 requestWorldbookProjection 闸门，故必须在此整段拦下。
  // 关闭后下一次表格更新/切卡时照常调用本函数。
  if (isRefillMode()) return;
  advanceWorldbookProjectionScope();
  const cfg = getConfig();
  if (cfg.mapEnabled) {
    void syncMapOverviewToMiscTable();
    void syncMapNodeWorldbookEntries();
  }
  projectCalendarToWorldbook();
  // 经期/孕期世界书：切卡时重注入（storage-ready 门控路径可能因外部存储未就绪而跳过 handleCycleTick，
  // 此处补一次非门控兜底；handleCycleTick 内部按 cycleMode 早退、由签名幂等，重跑无副作用）。
  handleCycleTick();
  void refreshAllWorldbookProjections();
  syncSkillTagColorCss();
}

async function doInitRender(): Promise<void> {
  _initDone = true;

  // 暴露抽卡工具函数到全局（供 config-panel 使用）
  exposeGachaGlobals();


  // 将所有 overlay 和帮助提示移到 body，使其独立于状态栏（折叠时也能打开）
  ensureOverlaysInBody();
  initSystemDecisionPopup();
  // 帮助提示移到 body 并去重（见 ensureTooltipInBody 注释：避免困在 wrapper 层叠上下文被遮挡）
  ensureTooltipInBody();
  syncAssistantUI();

  // O5：走脏检查——renderStorageLoadingShell 已 render(true) 全量构建过；若表格数据在
  // 存储就绪后未变（签名相等），再 force 一次纯属重复全量重建。签名含表格/配置/玩法/
  // 徽章/天气/穿搭全量输入，shell→init 之间的任何真实变化都会自然触发重建。
  render();
  applyVisibility();
  applyMobileFixes();
  bindEvents();
  initMouseGlow();

  // 页面可见性：不可见时暂停 CSS 动画（移动端省电关键）
  if (!(document as any).__ub_visibility_bound) {
    (document as any).__ub_visibility_bound = true;
    document.addEventListener('visibilitychange', function() {
      const wrapper = document.getElementById('ac-statusbar-wrapper');
      // 页面切到后台（隐藏）时：尽早排空 write-behind 防抖窗口内的待写批次——
      // 此时页面仍存活、有充足时间完成 fetch，比 pagehide 更可靠（卸载时浏览器不一定等 fetch 跑完）。
      // fire-and-forget；用户已接受「最后约 1 秒增量」可能丢的取舍，故不阻塞也不强求完成。
      if (document.hidden) {
        void flushStatusbarStorage();
      }
      if (!wrapper) return;
      // 统一走 syncAnimState：页面可见时若仍处跟随底部模式，须保持 ub-anim-off
      syncAnimState(wrapper);
      if (!document.hidden) {
        // 页面重新可见时，如果之前有被跳过的渲染，现在补上
        if (_renderPending) {
          if (_renderRafId) cancelAnimationFrame(_renderRafId);
          _renderRafId = requestAnimationFrame(doRender);
        }
      }
    });
  }

  // resize 由 loader 统一触发 __ub_on_resize → handleResize()，避免双重 cssText 赋值导致手机端闪烁
  // 此处不再注册独立的 resize 监听器

  // 瑟瑟玩法-自动清空：监听酒馆「消息接收」事件，每条 AI 回复后自动执行一键清空
  // 用 MESSAGE_RECEIVED 而非 GENERATION_ENDED：前者仅在新消息入栈时触发，并通过 type 参数
  // 明确区分 quiet/normal 等，无需维护跨事件的共享标志位，避免重叠生成导致的竞态误判。
  if (!(window as any).__ub_play_auto_clear_bound) {
    try {
      // 酒馆助手 iframe 注入的是扁平化 SillyTavern API；eventOn 并不是可靠的 window 属性。
      // 主窗口形态则通过 getContext() 取得同一套 eventSource/eventTypes。
      const rawSt: any = (window as any).SillyTavern || (window as any).TavernHelper?.SillyTavern;
      const st: any = typeof rawSt?.getContext === 'function' ? rawSt.getContext() : rawSt;
      const eventSource = st?.eventSource;
      const eventTypes = st?.eventTypes;
      const msgReceived = eventTypes?.MESSAGE_RECEIVED as string | undefined;
      if (eventSource && typeof eventSource.on === 'function' && msgReceived) {
        eventSource.on(msgReceived, function (_message_id: number, type: string) {
          try {
            // 消息入栈屏障：排空数据库写回队列，让本轮填表/读取看到前端已写值（防旧值覆盖）
            void flushDbWrites();
            // 重填模式：跳过本条消息驱动的两项自动写入——剧情自动备份（整库快照落盘）
            // 与瑟瑟玩法自动清空（按概率改写道具/表行）。两者都会与重填争抢表格数据。
            // 关闭后无需补跑：备份水位与自动清空均按「本轮是否达标」判定，下一条 AI 回复自然接续。
            if (isRefillMode()) return;
            void maybeAutoBackupStory();
            const cfg = getConfig();
            if (!cfg.nsfwPlayEnabled || !cfg.nsfwPlayAutoClear) return;
            // 跳过后台静默生成与模拟用户/命令/扩展等非 AI 正文的回复，避免干扰其它功能
            if (type === 'quiet' || type === 'impersonate' || type === 'command' || type === 'extension') return;
            // 自动清空失败不弹错误打扰用户，仅记录到控制台
            handlePlayClear().catch((e: any) => console.warn('[statusbar] 自动清空玩法失败:', e?.message || e));
          } catch (e) { /* ignore */ }
        });
        // 仅在监听器确实注册成功后置位，避免失败状态被误记为已绑定。
        (window as any).__ub_play_auto_clear_bound = true;
      } else {
        console.warn('[statusbar] 自动清空：未找到 SillyTavern eventSource / eventTypes，功能不可用');
      }
    } catch (e) { /* SillyTavern 事件 API 不可用时保持未绑定 */ }
  }

  // ===== 成就系统初始化（受 achievementEnabled 总开关 gate）=====
  // 开启：读入成就簿(零后续 I/O)+注册解锁回调+接通 __ubEmitAchievement 派发器。
  // 关闭：__ubEmitAchievement 退化为空函数(功能模块调用零成本)、不读簿不注册回调 → 彻底零负担。
  setupAchievementSystem();

  // 启动时间锚定功能
  startTimeAnchor();

  // 世界演化窗口：注册真实数据源 + 双轨触发（轮次/日期）。每次 doInitRender 调用一次，内部幂等。
  initWorldEvolution();

  // 正文插图（自动文生图）：MESSAGE_RECEIVED 监听注册（幂等；内部由 storyImageEnabled 开关守卫）
  initStoryImageAutoTrigger();
  // 货币系统：MESSAGE_RECEIVED 正文标签提取（幂等；内部由 currencyEnabled 开关守卫）
  initCurrencyProseTrigger();
  // 货币宿主桥：小手机 bundle 经 __ub_currency_host 读快照/记账（[自身, parent] 双窗注册；
  // 并监听 ub-phone-online 重投影货币世界书。脚本重跑由最新实例接管，每次调用幂等安全）
  bindCurrencyHostBridge();
  // 货币正则卡片：开关开启时幂等注入酒馆全局显示正则（先例=小手机正文联动；手动导入 JSON 不再必需）
  void ensureCurrencyRegexInjection().catch((e: unknown) => console.warn('[货币] 正则卡片注入失败:', e));
  // 技能入库改为「填表 AI 承担」：技能表 insert 规则（空表按正文生成初始技能；非空表正文明确
  // 提到获得/学会新技能时新增），技能行由数据库填表写入（不再有前端自动提取监听）；
  // 漏写时由正文卡片上的「手动添加」按钮补录（见委托点击）。
  // 技能正则卡片（发动/新增两条）：技能开关开启时幂等注入 + 同名漂移治愈（存量手动导入的旧发动正则自动升级）
  void ensureSkillRegexInjection().catch((e: unknown) => console.warn('[技能] 正则卡片注入失败:', e));
  // 货币数据变更 → 强制重渲染状态栏（chip 热更新；幂等绑定）
  if (!(window as any).__ub_currency_render_bound) {
    (window as any).__ub_currency_render_bound = true;
    // O37(第十一轮)：货币变更走脏检查（签名含 currencyDisplayDigest，余额变化必翻签名）
    window.addEventListener(CURRENCY_CHANGED_EVENT, () => render());
  }
  // 楼层「重新生成插图」按钮：宿主 #chat 变化持续注入（幂等；内部由 storyImageEnabled 开关守卫）
  initStoryImageFloorButton();
  // 正文图片点击放大/悬浮删除/悬浮描述：宿主页委托监听一次绑定（幂等；处理器内部查开关）
  initStoryImageTextViewer();

  // 注入功能 CSS（纯样式，与角色卡无关，欢迎页面也要先就位以便切卡后立即可用）
  const _mapCfg = getConfig();
  if (_mapCfg.mapEnabled) injectMapCSS();
  if (_mapCfg.portraitEnabled) injectPortraitCSS();
  injectStoryImageCSS();
  // 地图角色标记点击 → 弹窗（一次性全局监听，map-system 通过 CustomEvent 触发）
  // __ub_* 守卫对齐同函数兄弟监听：脚本重求值（reinject）不叠加监听，防标记点击重复开弹窗
  if (!(document as any).__ub_map_marker_bound) {
    (document as any).__ub_map_marker_bound = true;
    document.addEventListener(UB_EVENT.mapMarkerClick, (e: Event) => {
      const detail = (e as CustomEvent).detail as { name: string; detail?: string } | undefined;
      if (detail && detail.name) {
        showMapCharPopup(detail.name, currentStyle, () => showMapPopup(currentStyle), detail.detail);
      }
    });
  }
  // 立绘生成完成事件（portrait-system 可派发以触发重渲染；预留扩展点）
  if (!(document as any).__ub_portrait_generated_bound) {
    (document as any).__ub_portrait_generated_bound = true;
    document.addEventListener(UB_EVENT.portraitGenerated, () => {
      if (getConfig().portraitEnabled) render();
    });
  }
  // 数据库写完成事件（data-manager 各写助手/直接 SQL 写成功后派发）：写完立即渲染，
  // 不再等插件 _notifyTableUpdate 回调的 300ms 节流；回调到达后的重渲染由签名脏检查早退兜住。
  // __ub_* 守卫对齐兄弟监听：脚本重求值（reinject）不叠加监听。
  if (!(window as any).__ub_db_write_bound) {
    (window as any).__ub_db_write_bound = true;
    window.addEventListener(UB_EVENT.dbWriteCommitted, () => {
      render();
    });
  }

  // 仅为已启用功能注入日历 CSS
  injectCalendarCSS(_mapCfg.calendarEnabled);

  // 角色卡相关功能（地图系统/立绘缓存/日历世界书/玩法世界书注入）：仅当前已载入角色卡时才做。
  // 欢迎页面 getCurrentStoryChatKey() 为空、世界书未就绪，注入只会报错且无意义；
  // 切换到角色卡时由 STATUSBAR_STORAGE_READY_EVENT 监听器（chat-changed 触发）补做。
  if (getCurrentStoryChatKey()) {
    void initCharacterCardFeatures();
  }
}

// ===== 页面卸载时清理定时器，避免在已销毁的 iframe 中执行 =====
// __ub 守卫防重求值叠加 handler（清理逻辑幂等，叠加属无谓重复；对齐其它常驻监听的守卫模式）
if (!(window as any).__ub_pagehide_bound) {
  (window as any).__ub_pagehide_bound = true;
  $(window).on('pagehide', function() {
  destroyAssistantUI();
  stopTimeAnchor();
  stopStoryImageFloorButton();
  stopStoryImageTextViewer();
  _stopChatTailObserver();
  if (_dataUpdateTimer) { clearTimeout(_dataUpdateTimer); _dataUpdateTimer = null; }
  _pendingTableUpdateData = null;
  if (_tooltipHideTimer) { clearTimeout(_tooltipHideTimer); _tooltipHideTimer = null; }
  if (_renderRafId) { cancelAnimationFrame(_renderRafId); _renderRafId = null; }
  _renderPending = false;
  _forceRender = false;
  _lastRenderSignature = '';
  // 全部存储后端尽力落盘（write-behind 防抖窗口内的待写批次）。
  // 无条件：不应受成就功能开关影响（设置/剧情/立绘与成就解耦）。
  // fire-and-forget：卸载时浏览器不一定等这串 fetch 跑完；若未完成则丢「最后约 1 秒增量」（用户已接受）。
  flushAchievementStore();
  void flushStatusbarStorage();
  // 数据库写回队列排空（防抖窗口内批次尽力落盘；fire-and-forget，卸载时浏览器不一定等 fetch 跑完）
  void flushDbWrites();
  if (getConfig().achievementEnabled) {
    resetAchievementSession();
  }
  // 立绘系统：清理防抖定时器与内存缓存
  if (getConfig().portraitEnabled) {
    stopPortraitSystem();
  }
  setupWardrobeActionBridge(false);
  bindWardrobeRuntime(null);
  void disposeWardrobeRuntime();
  closeWardrobePanel();
  // 镜头之外会话态清空（批次与视图均不跨会话）
  (window as any)._activeBeyond = false;
  (window as any)._beyondBatch = null;
  });
}

// 启动（IS_FIRST_BOOT：双实例副本 2 不启动整份应用——权威修复在 loader 的
// __ub_loader_booted 哨兵，此处防非 loader 路径把主脚本注入两次）
if (IS_FIRST_BOOT) $(init);
