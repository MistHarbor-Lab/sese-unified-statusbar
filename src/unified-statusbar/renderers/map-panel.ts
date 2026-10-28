// ===== 地图弹窗（popup 形式，点击主界面"当前地点"或菜单项打开） =====
//
// showMapPopup(style)：在 #panelOverlay 中展示地图弹窗，内部包含地图容器、
//   控制按钮（刷新/清缓存/浏览）与状态指示。SVG 内容由 map-system 模块按缓存自填。
// bindMapEvents($overlay)：委托式绑定按钮/下拉事件，调用 map-system 导出的函数。

import { ubIcon } from '../core/icons';
import { UB_EVENT } from '../core/events';
import { getToastr } from '../core/env';
import type { StatusBarConfig } from '../core/config-store';
import type { StyleType } from '../core/constants';
import { flashInlineHint } from './effects';
import { bindPanZoom, panZoomBy, resetPanZoom, type PanZoomState } from './pan-zoom';
import { bindLongPressDelegated, swallowGhostClickIfPointerActive, type LongPressHandle } from './long-press';
import { setButtonBusy } from '../core/busy-state';
import { getConfig } from '../core/config-store';
import {
  refreshMap,
  forceRefreshMap,
  forceRefreshMapScene,
  clearCurrentMapCache,
  clearAllMapCache,
  clearCurrentMapScene,
  clearAllMapSceneCache,
  getCurrentMapSceneImage,
  generateMapSceneForLibraryNode,
  listMapLibraryNodes,
  previewMapNodeFull,
  navigateToNode,
  deleteMapNodeFromLibrary,
  generateNodeMapFromLibrary,
  isNodeGenerated,
  toggleNodeFavorite,
  toggleMapNodeFinalChild,
  renameMapNode,
  addChildMapNode,
  updateMapNodeDesc,
  readMapNodeDesc,
  readMapNodeExploreRecord,
  fillInfoDrawer,
  moveMapNode,
  listNodeLocationAliases,
  removeMapLocationAlias,
  addMapLocationAlias,
  inspectMapNodeMerge,
  mergeMapNodes,
} from '../core/map-system';
import { getCurrentDisplayNodeId, markDisplayNodeId } from '../core/map-system';
import { decideMapNodeView } from '../core/map-view-navigation';
import { readMapSceneImage, listMapSceneImages, type MapSceneImageRecord } from '../core/map-scene-store';
import { readTreeIndex, isFavorite, parseLocationHierarchy, deriveNodeId, checkCanMoveTo, listAllNodesForUI } from '../core/map-tree-store';
import type { MapTreeNode } from '../core/map-tree-store';
import { getCellByHeader } from '../core/data-manager';
import { syncDarkClass, syncDarkClassMinimal, closePanelOverlayOrReturn, markPopupShown, guardGhostClick } from './html-builder';
import { showConfirmDialog, showPromptDialog, confirmMessage } from './confirm-dialog';
import { placeAnchoredMenu } from './anchored-menu';
import { showMapOrganizePanel } from './map-organize-panel';
import { escapeHtml } from '../core/html-escape';
import { readExtraPromptCache, writeExtraPromptCache, EXTRA_PROMPT_CACHE_KEYS } from '../core/extra-prompt-cache';

// ─────────────────────────────────────────────────────────────
// 缩放/拖动状态
// ─────────────────────────────────────────────────────────────
// U6：缩放状态与四个纯函数已收拢到 `renderers/pan-zoom.ts`（与技能树面板共用同一实现）。
// 本面板只传自己的参数：缩放范围 0.5–4；忽略 `.map-zoom-btn` / `.character-marker` / `.map-exit-marker`。
const MAP_PAN_ZOOM_OPTS = {
  minScale: 0.5,
  maxScale: 4,
  ignoreSelector: '.map-zoom-btn, .character-marker, .map-exit-marker',
};

let _zoomState: PanZoomState | null = null;
// 缩放交互的停止句柄：每次打开地图弹窗都会重建交互，先停掉上一组注册的监听，
// 避免 document 上的 mousemove/mouseup 随反复开关堆叠泄漏（容器内监听随 DOM 替换自然回收，
// 但 document 监听不会，必须显式清理）。任意时刻最多存活一组监听，泄漏被限制在 O(1)。
let _zoomStop: (() => void) | null = null;

/** 停用当前缩放监听（关闭弹窗 / 绑定下一组前调用）。幂等。 */
function stopMapZoom(): void {
  if (_zoomStop) { _zoomStop(); _zoomStop = null; }
}

/** 绑定缩放交互（薄包装：先停上一组，再建新的一组并记录状态；签名与调用点保持不变）。 */
function setupZoomInteraction(container: HTMLElement, viewport: HTMLElement): void {
  stopMapZoom();
  const bound = bindPanZoom(container, viewport, MAP_PAN_ZOOM_OPTS);
  _zoomStop = bound.stop;
  _zoomState = bound.state;
}

// ─────────────────────────────────────────────────────────────
// 地图按钮长按（短按=原行为，长按=弹额外提示词输入框，模仿大调查）
// U10：计时器/合成 click 吞噬统一交给 renderers/long-press；本文件只留一个「重新绑定前先解绑」的句柄
// （bindMapEvents 的容器是常驻共享弹窗 #panelOverlay，每次打开都会重绑，必须能解绑，否则监听叠加）。
// ─────────────────────────────────────────────────────────────
let _mapRefreshLp: LongPressHandle | null = null;

// ─────────────────────────────────────────────────────────────
// 视图模式 + 历史栈状态（会话级，弹窗关闭时重置）
// ─────────────────────────────────────────────────────────────
interface MapHistoryEntry {
  nodeId: string;
}

let _mapHistory: MapHistoryEntry[] = [];
let _mapHistoryCursor: number = -1;
// 会话级折叠状态：nodeId → true=折叠
const _collapsedState = new Map<string, boolean>();
// 库预览当前浏览的 nodeId（用于库预览区内 exit 跳转）
let _libPreviewNodeId: string | null = null;
// 地图库预览请求序号：旧地点的异步结果不得覆盖后来选中的地点。
let _libPreviewRequestSeq = 0;

function beginLibraryPreviewRequest(nodeId: string): number {
  _libPreviewNodeId = nodeId;
  return ++_libPreviewRequestSeq;
}

function invalidateLibraryPreview(): void {
  _libPreviewNodeId = null;
  _libPreviewRequestSeq++;
}

function isCurrentLibraryPreviewRequest(nodeId: string, requestId: number): boolean {
  return _libPreviewNodeId === nodeId && _libPreviewRequestSeq === requestId;
}

function pushHistory(nodeId: string): void {
  _mapHistory = _mapHistory.slice(0, _mapHistoryCursor + 1);
  _mapHistory.push({ nodeId });
  _mapHistoryCursor++;
  updateHistoryButtons();
}

function updateHistoryButtons(): void {
  const backBtn = document.getElementById('ac-map-back') as HTMLButtonElement | null;
  const fwdBtn = document.getElementById('ac-map-forward') as HTMLButtonElement | null;
  if (backBtn) backBtn.disabled = _mapHistoryCursor <= 0;
  if (fwdBtn) fwdBtn.disabled = _mapHistoryCursor >= _mapHistory.length - 1;
}

function resetHistory(): void {
  _mapHistory = [];
  _mapHistoryCursor = -1;
  updateHistoryButtons();
}

function isSceneDisplayMode(): boolean {
  return document.getElementById('mapContainer')?.dataset.displayMode === 'scene';
}

function renderMapSceneRecord(record: MapSceneImageRecord | null, transientStatus?: string): void {
  const image = document.getElementById('mapSceneImage') as HTMLImageElement | null;
  const empty = document.getElementById('mapSceneEmpty');
  const status = document.getElementById('mapSceneStatus');
  if (!image || !empty) return;
  const hasImage = !!record?.imagePath && record.status !== 'cleared';
  image.style.display = hasImage ? '' : 'none';
  empty.style.display = hasImage ? 'none' : '';
  if (hasImage && image.src !== record!.imagePath) image.src = record!.imagePath;
  if (!hasImage) image.removeAttribute('src');
  if (status) {
    const text = transientStatus || (record?.status === 'ready'
      ? `场景图 · ${record.width}×${record.height}`
      : record?.status === 'failed'
        ? '场景图生成失败，可重试'
        : record?.status === 'stale'
          ? '场景图对应旧地图版本'
          : record?.status === 'cleared'
            ? '尚未生成场景图'
            : '等待场景图');
    status.textContent = text;
    status.classList.toggle('error', record?.status === 'failed');
    status.classList.toggle('loading', record?.status === 'prompting' || record?.status === 'generating');
  }
}

async function syncCurrentMapSceneImage(): Promise<void> {
  const requestedNodeId = getCurrentDisplayNodeId();
  try {
    const current = await getCurrentMapSceneImage();
    // 读取期间主视图可能已经导航到别的地点；旧读取结果不能回写新地点的场景图。
    if (getCurrentDisplayNodeId() !== requestedNodeId) return;
    if (current && requestedNodeId !== current.nodeId) return;
    renderMapSceneRecord(current?.record || null);
  } catch (_e) {
    if (getCurrentDisplayNodeId() !== requestedNodeId) return;
    renderMapSceneRecord(null);
  }
}

function setMapDisplayMode(mode: 'svg' | 'scene'): void {
  const container = document.getElementById('mapContainer');
  if (!container) return;
  container.dataset.displayMode = mode;
  const toggle = document.getElementById('ac-map-display-toggle');
  if (toggle) {
    toggle.innerHTML = mode === 'svg' ? ubIcon('image') + ' 场景图' : ubIcon('map') + ' SVG地图';
    toggle.setAttribute('title', mode === 'svg' ? '切换到场景图' : '切换到 SVG 地图');
    toggle.setAttribute('aria-pressed', mode === 'scene' ? 'true' : 'false');
  }
  const refresh = document.getElementById('ac-map-refresh-btn');
  const clearCur = document.getElementById('ac-map-clear-cur-btn');
  const clearAll = document.getElementById('ac-map-clear-all-btn');
  if (refresh) refresh.setAttribute('title', mode === 'scene' ? '刷新当前场景图' : '强制刷新当前 SVG 地图');
  if (clearCur) clearCur.setAttribute('title', mode === 'scene' ? '清除当前地点场景图' : '清除当前地点地图缓存');
  if (clearAll) clearAll.setAttribute('title', mode === 'scene' ? '清空所有场景图' : '清空所有地图缓存');
  if (mode === 'scene') void syncCurrentMapSceneImage();
}

function _onMapSceneState(e: Event): void {
  const detail = (e as CustomEvent).detail as {
    nodeId?: string;
    status?: string;
    result?: { ok: boolean; record?: MapSceneImageRecord; error?: string };
  };
  if (!detail || detail.status === 'cleared-all') {
    if (isSceneDisplayMode()) void syncCurrentMapSceneImage();
    return;
  }
  void getCurrentMapSceneImage().then(current => {
    if (!current || (detail.nodeId && current.nodeId !== detail.nodeId)) return;
    if (detail.result?.ok && detail.result.record) {
      renderMapSceneRecord(detail.result.record);
    } else if (detail.status === 'generating') {
      renderMapSceneRecord(current.record, '正在生成场景图…');
    } else if (detail.result?.error) {
      renderMapSceneRecord(current.record, detail.result.error);
    } else {
      renderMapSceneRecord(current.record);
    }
  });
}

function setViewMode(mode: 'map' | 'library'): void {
  const panel = document.querySelector('.map-panel');
  if (!panel) return;
  panel.setAttribute('data-view-mode', mode);
  const libBtn = document.getElementById('ac-map-library-btn');
  if (libBtn) {
    if (mode === 'library') {
      libBtn.innerHTML = ubIcon('home');
      libBtn.setAttribute('title', '返回当前场景地图');
    } else {
      libBtn.innerHTML = ubIcon('book');
      libBtn.setAttribute('title', '编辑地图库');
    }
  }
  // 库模式下隐藏刷新/清缓存按钮
  const refreshBtn = document.getElementById('ac-map-refresh-btn');
  const clearCurBtn = document.getElementById('ac-map-clear-cur-btn');
  const clearAllBtn = document.getElementById('ac-map-clear-all-btn');
  const displayToggle = document.getElementById('ac-map-display-toggle');
  const hide = mode === 'library';
  [refreshBtn, clearCurBtn, clearAllBtn, displayToggle].forEach(btn => {
    if (btn) btn.style.display = hide ? 'none' : '';
  });
  if (mode === 'library') {
    void renderMapLibrary();
  } else {
    setMapDisplayMode((document.getElementById('mapContainer')?.dataset.displayMode as 'svg' | 'scene') || 'svg');
    resetHistory();
    void refreshMap({ force: false });
  }
}

async function renderBreadcrumb(nodeId: string): Promise<void> {
  const breadcrumbEl = document.getElementById('mapBreadcrumb');
  if (!breadcrumbEl) return;
  const actionsHtml = `<span class="breadcrumb-actions">
    <button class="map-btn breadcrumb-back" id="ac-map-back" type="button" title="后退" disabled>${ubIcon('arrow-left')}</button>
    <button class="map-btn breadcrumb-forward" id="ac-map-forward" type="button" title="前进" disabled>${ubIcon('arrow-right')}</button>
    <button class="map-btn breadcrumb-reset" id="ac-map-reset" type="button" title="返回当前场景地点">${ubIcon('home')}</button>
  </span>`;
  try {
    const index = await readTreeIndex();
    // 沿 parentId 上溯构建祖先链
    const chain: { nodeId: string; name: string }[] = [];
    let curId: string | null = nodeId;
    const visited = new Set<string>();
    while (curId && !visited.has(curId)) {
      visited.add(curId);
      const node: MapTreeNode | undefined = index.nodes[curId];
      if (!node) break;
      chain.unshift({ nodeId: curId, name: node.name });
      curId = node.parentId;
    }
    const itemsHtml = chain.map((item, i) => {
      const isCurrent = i === chain.length - 1;
      return `<span class="breadcrumb-item ${isCurrent ? 'current' : ''}" data-node-id="${escapeHtml(item.nodeId)}">${escapeHtml(item.name)}</span>${isCurrent ? '' : '<span class="breadcrumb-sep">›</span>'}`;
    }).join('');
    breadcrumbEl.innerHTML = itemsHtml + actionsHtml;
    updateHistoryButtons();
  } catch (e) {
    console.error('[map-panel] renderBreadcrumb 失败:', e);
    breadcrumbEl.innerHTML = `<span class="breadcrumb-item current">—</span>` + actionsHtml;
  }
}

function _onMapNavigated(e: Event): void {
  const detail = (e as CustomEvent).detail as { nodeId: string; fullPath: string; skipHistory: boolean };
  void renderBreadcrumb(detail.nodeId);
  void readMapSceneImage(detail.nodeId).then(record => {
    if (getCurrentDisplayNodeId() !== detail.nodeId) return;
    renderMapSceneRecord(record);
  });
  if (!detail.skipHistory) {
    pushHistory(detail.nodeId);
  }
}

function _onMapMerged(e: Event): void {
  const detail = (e as CustomEvent).detail as { finalNodeId?: string; discardedNodeId?: string };
  if (!detail.finalNodeId) return;
  if (detail.discardedNodeId && getCurrentDisplayNodeId() === detail.discardedNodeId) {
    void navigateBreadcrumbNode(detail.finalNodeId, { skipHistory: false });
  }
  if (document.querySelector('.map-panel')?.getAttribute('data-view-mode') === 'library') {
    void renderMapLibrary();
  }
}

/** 场景图记录是否有可用图片（非 cleared/failed） */
function sceneRecordHasImage(record: MapSceneImageRecord | null): boolean {
  return !!record?.imagePath && record.status !== 'cleared' && record.status !== 'failed';
}

/** 面包屑/历史回退统一导航入口：按 decideMapNodeView 决定展示场景图/SVG/提示 */
async function navigateBreadcrumbNode(nodeId: string, opts?: { skipHistory?: boolean }): Promise<void> {
  const [sceneRecord, hasSvg] = await Promise.all([readMapSceneImage(nodeId), isNodeGenerated(nodeId)]);
  const hasScene = sceneRecordHasImage(sceneRecord);
  const currentMode = isSceneDisplayMode() ? 'scene' : 'svg';
  const view = decideMapNodeView(hasScene, hasSvg, currentMode);
  if (view.action === 'hint') {
    const index = await readTreeIndex();
    const name = index.nodes[nodeId]?.name || '该地点';
    const toastr = getToastr();
    toastr?.info?.(`「${name}」尚未生成地图或场景图`, '地图');
    return;
  }
  if (view.action === 'show-scene') {
    // 场景图模式保持；SVG 模式自动切到场景图展示（无 SVG 有场景图场景）
    if (!isSceneDisplayMode()) setMapDisplayMode('scene');
    markDisplayNodeId(nodeId);
    renderMapSceneRecord(sceneRecord);
    await renderBreadcrumb(nodeId);
    if (!opts?.skipHistory) pushHistory(nodeId);
    return;
  }
  // show-svg：场景图模式自动切回 SVG；SVG 模式保持
  if (isSceneDisplayMode()) setMapDisplayMode('svg');
  const result = await navigateToNode(nodeId, { skipHistory: opts?.skipHistory });
  const toastr = getToastr();
  if (result.pending) {
    toastr?.info?.(`需先进入「${result.name || '该地点'}」才能生成其地图`, '地图');
  } else if (!result.navigated) {
    toastr?.warning?.('无法导航到该地点', '地图');
  }
}

// 弹窗 HTML（panel-popup 结构，复用 map-section 样式）
// ─────────────────────────────────────────────────────────────
export function buildMapPopupHTML(_config: StatusBarConfig): string {
  const bridgeClass = _config.style === 'bridge'
    ? ' bridge-window bridge-module-navigation bridge-navigation-telemetry'
    : '';
  return `<div class="panel-popup map-popup ub-popup--xl${bridgeClass}">
    <div class="panel-popup-head">
      <div class="panel-popup-title">${_config.style === 'bridge' ? '导航阵列 / NAV ARRAY' : ubIcon('map') + ' 地图'}</div>
      <button class="panel-popup-close" id="panelClose">&times;</button>
    </div>
    <div class="panel-popup-body">
      <div class="map-section" id="ac-map-section">
        <div class="map-section-head">
          <div class="map-section-left">
            <button class="map-btn map-display-toggle" id="ac-map-display-toggle" type="button" title="切换到场景图" aria-pressed="false">${ubIcon('image')} 场景图</button>
          </div>
          <div class="map-section-right">
            <button class="map-btn ub-lp-hint" id="ac-map-refresh-btn" type="button" title="强制刷新当前 SVG 地图；长按可附加生成要求">${ubIcon('refresh')}</button>
            <button class="map-btn" id="ac-map-clear-cur-btn" type="button" title="清除当前地点地图缓存">${ubIcon('pin')}</button>
            <button class="map-btn" id="ac-map-clear-all-btn" type="button" title="清空所有地图缓存">${ubIcon('trash')}</button>
            <button class="map-btn" id="ac-map-library-btn" type="button" title="编辑地图库">${ubIcon('book')}</button>
          </div>
        </div>
        <div class="map-panel" data-view-mode="map">
          <!-- 地图主体（map 模式可见） -->
          <div class="map-main">
            <div class="map-breadcrumb" id="mapBreadcrumb">
              <span class="breadcrumb-item current">—</span>
              <span class="breadcrumb-actions">
                <button class="map-btn breadcrumb-back" id="ac-map-back" type="button" title="后退" disabled>${ubIcon('arrow-left')}</button>
                <button class="map-btn breadcrumb-forward" id="ac-map-forward" type="button" title="前进" disabled>${ubIcon('arrow-right')}</button>
                <button class="map-btn breadcrumb-reset" id="ac-map-reset" type="button" title="返回当前场景地点">${ubIcon('home')}</button>
              </span>
            </div>
            <div class="map-container" id="mapContainer" data-display-mode="svg">
              <div class="map-viewport" id="mapViewport">
                <svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" class="map-svg map-default" preserveAspectRatio="xMidYMid meet">
                  <text x="400" y="300" text-anchor="middle" class="map-empty-text">暂无地图数据</text>
                </svg>
              </div>
              <div class="map-scene-viewport" id="mapSceneViewport" aria-live="polite">
                <img id="mapSceneImage" alt="当前地点场景图" draggable="false" style="display:none;">
                <div class="map-scene-empty" id="mapSceneEmpty">尚未生成场景图</div>
                <div class="map-scene-status" id="mapSceneStatus">等待场景图</div>
              </div>
              <div class="map-zoom-controls">
                <button class="map-btn map-zoom-btn" id="ac-map-zoom-in" type="button" title="放大">＋</button>
                <button class="map-btn map-zoom-btn" id="ac-map-zoom-out" type="button" title="缩小">－</button>
                <button class="map-btn map-zoom-btn" id="ac-map-zoom-reset" type="button" title="重置缩放">${ubIcon('expand')}</button>
                <button class="map-btn map-zoom-btn" id="ac-map-info-btn" type="button" title="地点信息">ℹ</button>
              </div>
            </div>
            <div class="map-status" id="mapStatus" data-stale-label="STALE DATA">
              <span class="status-indicator"></span><span class="status-text">就绪</span>
            </div>
          </div>
          <!-- 地图库（library 模式可见） -->
          <div class="map-library" id="mapLibrary">
            <div class="map-library-head">
              <span class="map-library-title">${ubIcon('book')} 地图库</span>
              <button class="map-btn map-lib-ai" id="ac-map-organize-btn" type="button" title="AI 整理地图层级与名称（仅发送节点名称）"><span class="map-lib-ai-ico">${ubIcon('sparkle')}</span><span class="map-lib-ai-label">AI地图整理</span></button>
            </div>
            <div class="map-library-list" id="mapLibraryList">
              <div class="map-library-empty">暂无地图数据</div>
            </div>
            <div class="map-library-preview" id="mapLibraryPreview" style="display:none;"></div>
          </div>
          <!-- 地点信息抽屉（独立于 map/library 视图，双模式共用） -->
          <div class="map-info-drawer" id="mapInfoDrawer">
            <div class="map-info-drawer-head">
              <span class="map-info-drawer-title">${ubIcon('pin')} 地点信息</span>
              <button class="map-btn map-info-drawer-close" id="mapInfoDrawerClose" type="button" title="关闭">${ubIcon('close')}</button>
            </div>
            <div class="map-info-drawer-body">
              <div class="map-info-section">
                <div class="map-info-section-title">简介</div>
                <div class="map-info-summary" id="mapInfoSummary">—</div>
              </div>
              <div class="map-info-section">
                <div class="map-info-section-title">物品</div>
                <div class="map-info-items" id="mapInfoItems">—</div>
              </div>
              <div class="map-info-section">
                <div class="map-info-section-title">方位</div>
                <div class="map-info-directions" id="mapInfoDirections">—</div>
              </div>
              <div class="map-info-section">
                <div class="map-info-section-title">探索情况总结</div>
                <div class="map-info-summary" id="mapInfoExploreSummary">—</div>
              </div>
              <div class="map-info-section">
                <div class="map-info-section-title">近期探索（最多 3 条）</div>
                <div class="map-info-log" id="mapInfoLog">—</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────────────────────
// 事件绑定（委托式，防重绑）
// ─────────────────────────────────────────────────────────────
export function bindMapEvents(container: JQuery): void {
  // 刷新当前显示：SVG 与场景图共用按钮，但动作严格按当前显示模式分流。
  // 短按走 pointerup（onShort），长按弹额外要求框；合成 click 由 long-press 模块吞掉。
  _mapRefreshLp?.stop();
  const mapRoot = container[0] as HTMLElement | undefined;
  _mapRefreshLp = mapRoot
    ? bindLongPressDelegated(mapRoot, '#ac-map-refresh-btn', {
      onShort: (btn) => {
        // F22：刷新期间按钮自旋并禁用，防重复触发（长按路径经额外要求弹窗，不走此分支）
        void withBtnBusy(btn as HTMLElement, async () => {
          if (isSceneDisplayMode()) await forceRefreshMapScene();
          else await forceRefreshMap();
        });
      },
      onLong: () => {
        showMapExtraPromptDialog({
          title: isSceneDisplayMode() ? '场景图额外要求（仅本次刷新生效）' : '额外要求（仅本次刷新生效）',
          confirmLabel: isSceneDisplayMode() ? '刷新场景图' : '强制刷新',
          cacheKey: EXTRA_PROMPT_CACHE_KEYS.mapRefresh,
          onConfirm: (v: string) => {
            if (isSceneDisplayMode()) void forceRefreshMapScene(v).then(result => {
              if (!result.ok) renderMapSceneRecord(null, result.error);
            });
            else void forceRefreshMap(v);
          },
        });
      },
    })
    : null;
  // 清当前缓存
  container.off('click', '#ac-map-clear-cur-btn').on('click', '#ac-map-clear-cur-btn', function () {
    const btn = this as HTMLElement;
    if (isSceneDisplayMode()) {
      void clearCurrentMapScene(confirmMessage).then(ok => {
        if (!ok) flashInlineHint(btn, '当前地点没有可清除的场景图');
        else void syncCurrentMapSceneImage();
      });
    } else {
      void clearCurrentMapCache((msg) => flashInlineHint(btn, msg), confirmMessage);
    }
  });
  // 清空全部缓存
  container.off('click', '#ac-map-clear-all-btn').on('click', '#ac-map-clear-all-btn', function () {
    if (isSceneDisplayMode()) void clearAllMapSceneCache(confirmMessage).then(() => syncCurrentMapSceneImage());
    else void clearAllMapCache(confirmMessage);
  });
  // 缩放控制
  container.off('click', '#ac-map-zoom-in').on('click', '#ac-map-zoom-in', function () {
    if (!_zoomState) return;
    const viewport = document.getElementById('mapViewport');
    const mapContainer = document.getElementById('mapContainer');
    if (!viewport || !mapContainer) return;
    const rect = mapContainer.getBoundingClientRect();
    panZoomBy(_zoomState, 1.3, rect.left + rect.width / 2, rect.top + rect.height / 2, viewport, mapContainer);
  });
  container.off('click', '#ac-map-zoom-out').on('click', '#ac-map-zoom-out', function () {
    if (!_zoomState) return;
    const viewport = document.getElementById('mapViewport');
    const mapContainer = document.getElementById('mapContainer');
    if (!viewport || !mapContainer) return;
    const rect = mapContainer.getBoundingClientRect();
    panZoomBy(_zoomState, 1 / 1.3, rect.left + rect.width / 2, rect.top + rect.height / 2, viewport, mapContainer);
  });
  container.off('click', '#ac-map-zoom-reset').on('click', '#ac-map-zoom-reset', function () {
    if (!_zoomState) return;
    const viewport = document.getElementById('mapViewport');
    if (!viewport) return;
    resetPanZoom(_zoomState, viewport);
  });
}

// ─────────────────────────────────────────────────────────────
// 角落浮层 + 地图库事件绑定（原生 addEventListener，避免 jQuery 委托问题）
// 在 showMapPopup 中每次打开弹窗时调用，DOM 替换后旧监听器随元素回收。
// ─────────────────────────────────────────────────────────────
/** 打开地点信息抽屉。PC 端顶部对齐「地图界面」（alignEl = 地图容器/库预览区），
 *  不再从面板最顶开始盖住工具条/面包屑/列表；移动端（≤599px）维持全宽全高信息页。 */
function openInfoDrawer(alignEl: HTMLElement | null): void {
  const drawer = document.getElementById('mapInfoDrawer');
  if (!drawer) return;
  if (alignEl && !window.matchMedia('(max-width:599px)').matches) {
    const panel = drawer.parentElement;
    if (panel) {
      const top = Math.max(0, Math.round(alignEl.getBoundingClientRect().top - panel.getBoundingClientRect().top));
      drawer.style.top = `${top}px`;
    }
  }
  drawer.classList.add('open');
}

/** 关闭地点信息抽屉并清掉对齐偏移（下次打开按当前布局重新测量）。 */
function closeInfoDrawer(): void {
  const drawer = document.getElementById('mapInfoDrawer');
  if (!drawer) return;
  drawer.classList.remove('open');
  drawer.style.top = '';
}

// O31③：窗口级监听的统一拆卸（正常关闭路径与「被其它弹窗接管」兜底共用，幂等）。
function teardownMapWindowListeners(): void {
  window.removeEventListener(UB_EVENT.mapNavigated, _onMapNavigated);
  window.removeEventListener(UB_EVENT.mapSceneState, _onMapSceneState);
  window.removeEventListener(UB_EVENT.mapMerged, _onMapMerged);
}

// O31③（F2 弹窗接管泄漏同族）：地图弹窗内容被其它弹窗直接 innerHTML 接管时，关闭按钮路径
// 不会执行，window 监听会残留并在地图未打开时被事件触发空转，且随每次接管叠加。
// childList 兜底：.map-popup 不在 overlay 内即按关闭语义清理（与 wardrobe F2 同范式）；
// 地图自身的视图切换/刷新只重建 .map-popup 内部，观察器空转一次查询即返回。
let _mapTakeoverObserver: MutationObserver | null = null;

function armMapTakeoverGuard(overlay: HTMLElement): void {
  _mapTakeoverObserver?.disconnect();
  const observer = new MutationObserver(() => {
    if (overlay.querySelector('.map-popup')) return;
    if (_mapTakeoverObserver === observer) _mapTakeoverObserver = null;
    observer.disconnect();
    stopMapZoom();
    _zoomState = null;
    resetHistory();
    _collapsedState.clear();
    invalidateLibraryPreview();
    teardownMapWindowListeners();
  });
  observer.observe(overlay, { childList: true });
  _mapTakeoverObserver = observer;
}

function setupOverlayAndLibraryEvents(): void {
  const displayToggle = document.getElementById('ac-map-display-toggle');
  if (displayToggle) {
    displayToggle.addEventListener('click', function () {
      setMapDisplayMode(isSceneDisplayMode() ? 'svg' : 'scene');
    });
  }
  window.addEventListener(UB_EVENT.mapSceneState, _onMapSceneState);
  window.addEventListener(UB_EVENT.mapMerged, _onMapMerged);

  // 地点信息抽屉：info 按钮开关 + 关闭按钮
  const infoBtn = document.getElementById('ac-map-info-btn');
  const drawerClose = document.getElementById('mapInfoDrawerClose');
  if (infoBtn) {
    infoBtn.addEventListener('click', function () {
      if (document.getElementById('mapInfoDrawer')?.classList.contains('open')) closeInfoDrawer();
      else openInfoDrawer(document.getElementById('mapContainer'));
    });
  }
  if (drawerClose) {
    drawerClose.addEventListener('click', closeInfoDrawer);
  }

  // 地图库 ↔ 地图视图切换
  const libBtn = document.getElementById('ac-map-library-btn');
  if (libBtn) {
    libBtn.addEventListener('click', function () {
      const panel = document.querySelector('.map-panel');
      const currentMode = panel?.getAttribute('data-view-mode') || 'map';
      setViewMode(currentMode === 'map' ? 'library' : 'map');
    });
  }

  const organizeBtn = document.getElementById('ac-map-organize-btn');
  if (organizeBtn) {
    organizeBtn.addEventListener('click', openMapOrganizePanel);
  }

  // 面包屑点击导航
  const breadcrumbEl = document.getElementById('mapBreadcrumb');
  if (breadcrumbEl) {
    breadcrumbEl.addEventListener('click', function (e: Event) {
      const target = e.target as HTMLElement;
      // 历史按钮
      const backBtn = target.closest('#ac-map-back') as HTMLElement | null;
      if (backBtn) {
        if (_mapHistoryCursor <= 0) return;
        _mapHistoryCursor--;
        const entry = _mapHistory[_mapHistoryCursor];
        if (entry) void navigateBreadcrumbNode(entry.nodeId, { skipHistory: true });
        updateHistoryButtons();
        return;
      }
      const fwdBtn = target.closest('#ac-map-forward') as HTMLElement | null;
      if (fwdBtn) {
        if (_mapHistoryCursor >= _mapHistory.length - 1) return;
        _mapHistoryCursor++;
        const entry = _mapHistory[_mapHistoryCursor];
        if (entry) void navigateBreadcrumbNode(entry.nodeId, { skipHistory: true });
        updateHistoryButtons();
        return;
      }
      const resetBtn = target.closest('#ac-map-reset') as HTMLElement | null;
      if (resetBtn) {
        resetHistory();
        void refreshMap({ force: false });
        // 同步面包屑与历史栈到当前地点：refreshMap 只重渲染 SVG、不派发 ub-map-navigated，
        // 而面包屑靠该事件更新，故这里手动对齐 showMapPopup 初始化逻辑，
        // 否则面包屑会停在之前浏览的子地点、历史栈也为空。
        void (async () => {
          try {
            const loc = getCellByHeader('全局数据表', 1, '当前详细地点')
              || getCellByHeader('全局数据表', 1, '当前位置')
              || '';
            if (loc) {
              const { segments } = parseLocationHierarchy(String(loc).trim());
              if (segments.length > 0) {
                const nodeId = deriveNodeId(segments.join('-'));
                await renderBreadcrumb(nodeId);
                pushHistory(nodeId);
              }
            }
          } catch (e) { /* ignore */ }
        })();
        return;
      }
      // 面包屑段点击
      const item = target.closest('.breadcrumb-item') as HTMLElement | null;
      if (!item || item.classList.contains('current')) return;
      const nodeId = item.dataset.nodeId || '';
      if (!nodeId) return;
      void navigateBreadcrumbNode(nodeId);
    });
  }

  // 地图库列表：事件委托（收藏 + 编辑器 + 大地图 + 删除 + 预览）
  const listEl = document.getElementById('mapLibraryList');
  if (listEl) {
    // 长按检测（U10：统一走 long-press 模块）：.map-lib-large 短按=原确认生成流程（onClick），
    // 长按=弹额外提示词（模仿大调查）。短按动作从下面的大 click 委托里彻底摘出来（见该处 .map-lib-large 早退）。
    bindLongPressDelegated(listEl, '.map-lib-large', {
      canStart: (genBtn) => !!(genBtn.closest('.map-library-item') as HTMLElement | null)?.dataset.nodeId,
      onLong: (genBtn) => {
        const item = genBtn.closest('.map-library-item') as HTMLElement | null;
        const nodeId = item?.dataset.nodeId || '';
        const nodeName = item?.querySelector('.map-lib-name')?.textContent || '';
        const isGenerated = genBtn.dataset.generated === '1';
        showMapExtraPromptDialog({
          title: '额外要求 — ' + nodeName,
          confirmLabel: isGenerated ? '重新生成' : '生成',
          cacheKey: EXTRA_PROMPT_CACHE_KEYS.mapLibGen,
          onConfirm: (v: string) => { void withBtnBusy(genBtn, () => runLibraryGenerate(nodeId, nodeName, isGenerated, v)); },
        });
      },
      onClick: (genBtn, e) => { e.stopPropagation(); void shortPressLibraryGenerate(genBtn); },
    });

    listEl.addEventListener('click', async function (e: Event) {
      const target = e.target as HTMLElement;
      // .map-lib-large 的短按/长按已由 long-press 模块统一处理（短按走 onClick），此处一律放行，
      // 避免长按后合成 click 又落到下面「点击节点 → 预览」兜底分支。
      if (target.closest('.map-lib-large')) return;
      // 折叠按钮
      const toggleBtn = target.closest('.map-lib-toggle') as HTMLElement | null;
      if (toggleBtn && !toggleBtn.classList.contains('leaf')) {
        e.stopPropagation();
        const item = toggleBtn.closest('.map-library-item') as HTMLElement | null;
        const nodeId = item?.dataset.nodeId || '';
        if (nodeId) toggleCollapse(nodeId);
        return;
      }
      // 收藏按钮
      const favBtn = target.closest('.map-lib-fav') as HTMLElement | null;
      if (favBtn) {
        e.stopPropagation();
        const item = favBtn.closest('.map-library-item') as HTMLElement | null;
        const nodeId = item?.dataset.nodeId || '';
        if (!nodeId) return;
        void (async () => {
          const fav = await toggleNodeFavorite(nodeId);
          const toastr = getToastr();
          toastr?.success?.(fav ? '已收藏' : '已取消收藏', '地图库');
          await renderMapLibrary();
        })();
        return;
      }
      // 重命名按钮
      const editBtn = target.closest('.map-lib-edit') as HTMLElement | null;
      if (editBtn) {
        e.stopPropagation();
        const item = editBtn.closest('.map-library-item') as HTMLElement | null;
        const nodeId = item?.dataset.nodeId || '';
        const oldName = item?.querySelector('.map-lib-name')?.textContent || '';
        if (!nodeId) return;
        const newName = await showPromptDialog({ message: '输入新名称：', defaultValue: oldName });
        if (newName === null || newName.trim() === '' || newName.trim() === oldName) return;
        void (async () => {
          const ok = await renameMapNode(nodeId, newName.trim());
          const toastr = getToastr();
          if (ok) toastr?.success?.('已重命名', '地图库');
          else toastr?.error?.('重命名失败', '地图库');
          await renderMapLibrary();
        })();
        return;
      }
      // ⋯ 更多：低频项二级菜单（编辑描述/新增子节点/移动到…/地点别名/设为最终子节点）
      const moreBtn = target.closest('.map-lib-more') as HTMLElement | null;
      if (moreBtn) {
        e.stopPropagation();
        const item = moreBtn.closest('.map-library-item') as HTMLElement | null;
        const nodeId = item?.dataset.nodeId || '';
        if (nodeId) void showNodeMoreMenu(nodeId, moreBtn);
        return;
      }
      // 生成/重新生成节点场景图按钮：场景图任务按该行 nodeId 执行，不读取当前剧情地点。
      const sceneBtn = target.closest('.map-lib-scene') as HTMLButtonElement | null;
      if (sceneBtn) {
        e.stopPropagation();
        if (sceneBtn.disabled) return;
        const item = sceneBtn.closest('.map-library-item') as HTMLElement | null;
        const nodeId = item?.dataset.nodeId || '';
        const nodeName = item?.querySelector('.map-lib-name')?.textContent || '';
        const hasScene = sceneBtn.dataset.sceneGenerated === '1';
        if (!nodeId) return;
        if (!await showConfirmDialog({
          message: hasScene
            ? `重新生成「${nodeName}」的场景图？将覆盖现有场景图。`
            : `为「${nodeName}」生成场景图？将使用该地点的 SVG 地图和探索描述。`,
        })) return;
        void withBtnBusy(sceneBtn, () => runLibrarySceneGenerate(nodeId, nodeName, hasScene));
        return;
      }
      // 生成/重新生成节点地图按钮的短按/长按已由上方 bindLongPressDelegated 统一处理，这里不再分支。
      // 删除节点按钮
      const delBtn = target.closest('.map-lib-del') as HTMLElement | null;
      if (delBtn) {
        e.stopPropagation();
        const item = delBtn.closest('.map-library-item') as HTMLElement | null;
        const nodeId = item?.dataset.nodeId || '';
        const nodeName = item?.querySelector('.map-lib-name')?.textContent || '';
        if (!nodeId) return;
        if (!await showConfirmDialog({ message: `确定删除「${nodeName}」及其所有子地图吗？此操作不可撤销。`, danger: true })) return;
        void (async () => {
          const count = await deleteMapNodeFromLibrary(nodeId);
          const toastr = getToastr();
          toastr?.success?.(`已删除 ${count} 个节点`, '地图库');
          await renderMapLibrary();
        })();
        return;
      }
      // 点击节点 → 预览单地点地图
      const item = target.closest('.map-library-item') as HTMLElement | null;
      if (item) {
        const nodeId = item.dataset.nodeId || '';
        if (!nodeId) return;
        listEl.querySelectorAll('.map-library-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        void previewLibraryNode(nodeId);
      }
    });
  }

  // 手机端全屏预览的「×」关闭：委托在常驻的 #mapLibraryPreview 上（innerHTML 各状态都会带关闭钮）
  const previewDelegationEl = document.getElementById('mapLibraryPreview');
  if (previewDelegationEl) {
    previewDelegationEl.addEventListener('click', (e: Event) => {
      if ((e.target as HTMLElement).closest('.map-lib-full-close')) {
        previewDelegationEl.classList.remove('lib-full');
        previewDelegationEl.style.display = 'none';
      }
    });
  }

  // 主地图 exit 热点点击导航（§10.1）：委托到稳定父级 #mapContainer（SVG 每次渲染替换，
  // 委托式不随 SVG 重建丢绑定）。
  const mapContainer = document.getElementById('mapContainer');
  if (mapContainer) {
    mapContainer.addEventListener('click', function (e: Event) {
      const target = e.target as HTMLElement;
      const exitMarker = target.closest('.map-exit-marker') as HTMLElement | null;
      if (!exitMarker) return;
      e.stopPropagation();
      const targetNodeId = exitMarker.dataset.targetNode || '';
      if (!targetNodeId) return;
      void (async () => {
        const result = await navigateToNode(targetNodeId);
        const toastr = getToastr();
        if (result.pending) {
          // 目标 status=pending（或无重数据）：提示需先进入（§10.1）
          toastr?.info?.(`需先进入「${result.name || '该地点'}」才能生成其地图`, '地图');
          return;
        }
        if (!result.navigated) {
          // 索引无此节点（exit 引用失效）或容器已不在
          toastr?.warning?.('无法导航到该地点', '地图');
          return;
        }
        // 导航成功：重置缩放/拖动，避免新地图沿用上一张的视图变换
        if (_zoomState) {
          const vp = document.getElementById('mapViewport');
          if (vp) resetPanZoom(_zoomState, vp);
        }
      })();
    });
  }

  // 监听 navigateToNode 的 CustomEvent，更新面包屑 + 历史栈
  window.addEventListener(UB_EVENT.mapNavigated, _onMapNavigated);
}

// ─────────────────────────────────────────────────────────────
// 地图库列表渲染 + 节点预览
// ─────────────────────────────────────────────────────────────

/** 打开 AI 地图整理；执行完成后刷新地图库并处理当前显示节点。 */
function openMapOrganizePanel(): void {
  const libraryEl = document.querySelector('.map-library') as HTMLElement | null;
  if (!libraryEl) return;
  showMapOrganizePanel({
    host: libraryEl,
    onApplied: async (nextCurrentNodeId) => {
      await renderMapLibrary();
      // 结构变更后旧历史栈里的 nodeId 可能已被移动/合并/删除，整栈重置避免回退到失效节点。
      resetHistory();
      if (nextCurrentNodeId) {
        await navigateBreadcrumbNode(nextCurrentNodeId, { skipHistory: true });
      } else {
        markDisplayNodeId('');
        refreshMap({ force: false });
      }
    },
  });
}

async function renderMapLibrary(): Promise<void> {
  const listEl = document.getElementById('mapLibraryList');
  const previewEl = document.getElementById('mapLibraryPreview');
  if (!listEl) return;
  // F24：整表重载前记住滚动位置，重建后恢复（删除/生成后的重载不再跳回顶部；内容变矮时浏览器自动钳制）
  const savedScroll = listEl.scrollTop;
  invalidateLibraryPreview();
  listEl.innerHTML = '<div class="map-library-empty">加载中...</div>';
  if (previewEl) { previewEl.style.display = 'none'; previewEl.innerHTML = ''; }
  const restoreScroll = (): void => { listEl.scrollTop = savedScroll; };
  try {
    // 一次读树索引：listMapLibraryNodes 内部也 readTreeIndex，此处直接派生避免 2 次深拷贝。
    const index = await readTreeIndex();
    const nodes = listAllNodesForUI(index);
    const aiBtn = document.getElementById('ac-map-organize-btn') as HTMLButtonElement | null;
    if (aiBtn) {
      aiBtn.disabled = nodes.length === 0;
      aiBtn.title = nodes.length ? 'AI 整理地图层级与名称（仅发送节点名称）' : '地图库为空';
    }
    if (nodes.length === 0) {
      listEl.innerHTML = '<div class="map-library-empty">暂无地图数据</div>';
      return;
    }
    // 查各节点生成状态 + 收藏状态 + 场景图状态：一次读树索引 + 一次读全部场景图记录，
    // 替代逐节点串行查询（isNodeGenerated/isNodeFavorite 每次内部都重读整个树索引，
    // readMapSceneImage 每次重读场景图索引——N 个节点 = 3N 次串行读取，地图库打开卡顿源）。
    const sceneRecords = await listMapSceneImages();
    const sceneById = new Map(sceneRecords.map(r => [r.nodeId, r]));
    const genFlags = new Map<string, boolean>();
    const favFlags = new Map<string, boolean>();
    const sceneFlags = new Map<string, boolean>();
    for (const n of nodes) {
      genFlags.set(n.nodeId, index.nodes[n.nodeId]?.status === 'generated');
      favFlags.set(n.nodeId, isFavorite(index, n.nodeId));
      sceneFlags.set(n.nodeId, sceneRecordHasImage(sceneById.get(n.nodeId) ?? null));
    }
    // 收藏的节点排在前面（同 depth 内）
    const sorted = [...nodes].sort((a, b) => {
      const fa = favFlags.get(a.nodeId) === true ? 0 : 1;
      const fb = favFlags.get(b.nodeId) === true ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return 0;
    });
    const items = sorted.map(n => {
      const statusCls = n.status === 'generated' ? 'generated' : n.status === 'text-only' ? 'text-only' : 'pending';
      const statusText = n.status === 'generated' ? '已生成' : n.status === 'text-only' ? '仅记录' : '待生成';
      const isFav = favFlags.get(n.nodeId) === true;
      const isGenerated = genFlags.get(n.nodeId) === true;
      const hasScene = sceneFlags.get(n.nodeId) === true;
      // 判断是否有子节点（用于显示折叠按钮）
      const hasChildren = sorted.some(other => other.parentId === n.nodeId);
      const toggleCls = hasChildren ? '' : 'leaf';
      const collapsedCls = _collapsedState.get(n.nodeId) === true ? 'collapsed' : '';
      // 收藏按钮
      const favBtn = `<button class="map-lib-fav ${isFav ? 'active' : ''}" type="button" title="${isFav ? '取消收藏' : '收藏'}">${ubIcon('star')}</button>`;
      // 编辑器按钮
      const editBtn = `<button class="map-lib-edit" type="button" title="重命名">${ubIcon('pencil')}</button>`;
      // 生成/重新生成地图按钮（已生成 refresh 重新生成 / 未生成 pin 生成）
      const genBtn = `<button class="map-lib-large ub-lp-hint" type="button" title="${isGenerated ? '重新生成地图' : '生成地图'}；长按可附加生成要求" data-generated="${isGenerated ? '1' : '0'}">${isGenerated ? ubIcon('repeat') : ubIcon('pin')}</button>`;
      // 生成/重新生成场景图按钮：必须已有该节点的 SVG 地图，目标由行上的 nodeId 绑定。
      const sceneBtn = `<button class="map-lib-scene" type="button" title="${!isGenerated ? '请先生成地图' : hasScene ? '重新生成场景图' : '生成场景图'}" data-scene-generated="${hasScene ? '1' : '0'}"${isGenerated ? '' : ' disabled'}>${ubIcon('image')}</button>`;
      // ⋯ 更多：编辑描述/新增子节点/移动到…/地点别名/设为最终子节点（低频项收进二级菜单）
      const moreBtn = `<button class="map-lib-more${n.finalChild ? ' has-active' : ''}" type="button" title="更多">⋯</button>`;
      const finalMarker = n.finalChild ? `<span class="map-final-marker" title="最终子节点">${ubIcon('flag')}</span>` : '';
      return `<div class="map-library-item ${collapsedCls}" data-node-id="${escapeHtml(n.nodeId)}" data-parent-id="${escapeHtml(n.parentId || '')}" style="--depth: ${n.depth}" title="${escapeHtml(n.fullPath)}">
        <button class="map-lib-toggle ${toggleCls}" type="button" title="折叠/展开"></button>
        ${favBtn}
        <span class="map-lib-name">${escapeHtml(n.name)}${finalMarker}</span>
        <span class="map-lib-status ${statusCls}">${statusText}</span>
        ${editBtn}${genBtn}${sceneBtn}
        ${moreBtn}
        <button class="map-lib-del" type="button" title="删除节点">${ubIcon('close')}</button>
      </div>`;
    }).join('');
    listEl.innerHTML = items;
    applyCollapseState();
    restoreScroll();
  } catch (e) {
    listEl.innerHTML = '<div class="map-library-empty">加载失败</div>';
    console.error('[map-library] 加载列表失败:', e);
  }
}

/** 关闭地点别名 Modal（从 DOM 中移除） */
function closeAliasModal(): void {
  document.querySelector('.map-alias-modal-overlay')?.remove();
}

/**
 * 弹出地点别名管理 Modal：列出已映射表述（可解除）+ 添加输入框 + 6 态校验。
 * 仿 showMoveModal：注入 .map-library、同步深色类、点遮罩/ESC/关闭按钮关闭。
 */
async function showAliasModal(nodeId: string, nodeName: string): Promise<void> {
  closeAliasModal();

  const data = await listNodeLocationAliases(nodeId);
  const canonicalPath = data?.canonicalPath || nodeName;

  const modalHtml = `
    <div class="map-alias-modal-overlay">
      <div class="map-alias-modal" id="mapAliasModal">
        <div class="map-alias-title">${ubIcon('link')} 地点别名管理：${escapeHtml(nodeName)}</div>
        <div class="map-alias-canonical">规范路径：<b>${escapeHtml(canonicalPath)}</b></div>
        <div class="map-alias-section-label">已映射表述</div>
        <div class="map-alias-list" id="mapAliasList"></div>
        <div class="map-alias-add">
          <input class="map-alias-input" id="mapAliasInput" type="text" placeholder="输入别名表述，如「二楼-B房间」">
          <button class="map-btn map-alias-add-btn" id="mapAliasAddBtn" type="button">添加</button>
        </div>
        <div class="map-alias-msg-slot" id="mapAliasMsgSlot"></div>
        <div class="map-alias-hint">添加后建立「别名表述 → 本节点」映射；解除只删映射，不删节点。</div>
        <div class="map-alias-actions"><button class="map-btn map-alias-close" id="mapAliasClose" type="button">关闭</button></div>
      </div>
    </div>`;

  const libraryEl = document.querySelector('.map-library');
  if (!libraryEl) return;
  libraryEl.insertAdjacentHTML('beforeend', modalHtml);

  const overlay = document.querySelector('.map-alias-modal-overlay') as HTMLElement | null;
  if (overlay) {
    const panel = overlay.closest('.panel-overlay') as HTMLElement | null;
    const isDark = panel?.classList.contains('dark') ?? document.body.classList.contains('dark-mode');
    if (isDark) overlay.classList.add('dark');
  }

  const toastr = getToastr();
  const listEl = document.getElementById('mapAliasList');
  const msgSlot = document.getElementById('mapAliasMsgSlot');
  const inputEl = document.getElementById('mapAliasInput') as HTMLInputElement | null;

  const renderList = (aliases: string[]) => {
    if (!listEl) return;
    if (!aliases.length) {
      listEl.innerHTML = `<div class="map-alias-empty">暂无别名</div>`;
      return;
    }
    listEl.innerHTML = aliases
      .map(a => `<div class="map-alias-item"><span class="map-alias-text">${escapeHtml(a)}</span><button class="map-alias-remove" type="button" title="解除" data-alias="${escapeHtml(a)}">${ubIcon('close')}</button></div>`)
      .join('');
  };
  const showMsg = (kind: 'error' | 'warn' | 'ok', text: string) => {
    if (msgSlot) msgSlot.innerHTML = `<div class="map-alias-msg ${kind}">${escapeHtml(text)}</div>`;
  };
  const showConfirm = (text: string) => {
    if (!msgSlot) return;
    msgSlot.innerHTML = `<div class="map-alias-msg warn">${escapeHtml(text)}</div>
      <div class="map-alias-conflict">
        <button class="map-btn map-alias-confirm" id="mapAliasConfirm" type="button">改为映射到本节点</button>
        <button class="map-btn map-alias-cancel" id="mapAliasCancelConf" type="button">取消</button>
      </div>`;
  };
  const refresh = async () => {
    const d = await listNodeLocationAliases(nodeId);
    renderList(d?.aliases || []);
  };
  await refresh();

  const doAdd = async (force: boolean) => {
    const text = inputEl?.value.trim() || '';
    if (!text) { showMsg('error', '别名不能为空'); return; }
    const r = await addMapLocationAlias(nodeId, text, force);
    if (r.ok) {
      showMsg('ok', `已添加：${text}`);
      if (inputEl) inputEl.value = '';
      await refresh();
    } else if (r.conflictNodeName) {
      showConfirm(`该表述当前映射到「${r.conflictNodeName}」，要改为映射到本节点吗？`);
    } else {
      showMsg('error', r.reason || '添加失败');
    }
  };

  if (overlay) {
    overlay.addEventListener('click', async (e: Event) => {
      const t = e.target as HTMLElement;
      if (t === overlay) { closeAliasModal(); return; }
      if (t.id === 'mapAliasClose' || t.classList.contains('map-alias-close')) { closeAliasModal(); return; }
      if (t.id === 'mapAliasCancelConf') { showMsg('warn', '已取消'); return; }
      if (t.id === 'mapAliasConfirm') { await doAdd(true); return; }
      if (t.id === 'mapAliasAddBtn' || t.classList.contains('map-alias-add-btn')) { await doAdd(false); return; }
      if (t.classList.contains('map-alias-remove')) {
        const alias = t.getAttribute('data-alias') || '';
        if (await removeMapLocationAlias(alias)) {
          toastr?.success?.(`已解除映射：${alias}`, '地图库');
          await refresh();
        } else toastr?.error?.('解除映射失败，请重试', '地图库');
      }
    });
    overlay.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape') closeAliasModal(); });
  }
  if (inputEl) {
    inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); void doAdd(false); }
    });
  }
}

/** 「⋯ 更多」二级菜单打开期间要撤掉的监听（滚动关菜单用）；未开菜单时为 null ⇒ 零常驻。 */
let nodeMoreMenuCleanup: (() => void) | null = null;

/** 关闭节点「⋯ 更多」二级菜单：移除 DOM + 撤掉打开期间挂的监听。 */
function closeNodeMoreMenu(): void {
  document.getElementById('mapMoreMenu')?.remove();
  nodeMoreMenuCleanup?.();
  nodeMoreMenuCleanup = null;
}

function closeMergeModal(): void {
  document.querySelector('.map-merge-modal-overlay')?.remove();
}

function isMergeRelated(index: Awaited<ReturnType<typeof readTreeIndex>>, rootId: string, candidateId: string): boolean {
  if (rootId === candidateId) return true;
  let current = candidateId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    current = index.nodes[current]?.parentId || '';
    if (current === rootId) return true;
  }
  current = rootId;
  seen.clear();
  while (current && !seen.has(current)) {
    seen.add(current);
    current = index.nodes[current]?.parentId || '';
    if (current === candidateId) return true;
  }
  return false;
}

async function showMergeModal(nodeId: string, nodeName: string): Promise<void> {
  closeMergeModal();
  const index = await readTreeIndex();
  const nodes = await listMapLibraryNodes();
  const byId = new Map(nodes.map(node => [node.nodeId, node]));
  const candidates = nodes.map(node => {
    const related = isMergeRelated(index, nodeId, node.nodeId);
    return {
      ...node,
      disabled: related,
      disabledReason: node.nodeId === nodeId ? '当前节点' : '父子关系节点不能合并',
    };
  });
  const candidateHtml = candidates.map(candidate => `
    <label class="map-merge-candidate${candidate.disabled ? ' disabled' : ''}" title="${escapeHtml(candidate.disabledReason)}">
      <input type="radio" name="mapMergeTarget" value="${escapeHtml(candidate.nodeId)}"${candidate.disabled ? ' disabled' : ''}>
      <span class="map-merge-candidate-name">${escapeHtml(candidate.name)}</span>
      <span class="map-merge-candidate-path">${escapeHtml(candidate.fullPath)}</span>
      ${candidate.disabled ? `<span class="map-merge-candidate-reason">${escapeHtml(candidate.disabledReason)}</span>` : ''}
    </label>`).join('');
  const choiceOptions = (group: string, label: string) => `
    <fieldset class="map-merge-choice-group" data-choice-group="${group}" disabled>
      <legend>${label}</legend>
      <label><input type="radio" name="mapMerge${group}" value="${escapeHtml(nodeId)}" checked> ${escapeHtml(nodeName)}</label>
      <label class="map-merge-alt-choice"><input type="radio" name="mapMerge${group}" value=""> <span class="map-merge-alt-name">请选择另一个节点</span></label>
    </fieldset>`;
  const modalHtml = `
    <div class="map-merge-modal-overlay">
      <div class="map-merge-modal" role="dialog" aria-modal="true" aria-labelledby="mapMergeTitle">
        <div class="map-merge-title" id="mapMergeTitle">合并节点：${escapeHtml(nodeName)}</div>
        <div class="map-merge-hint">选择要合并的另一个节点。合并不可撤销，冲突的直接子节点会阻止提交。</div>
        <div class="map-merge-section-label">选择另一个节点</div>
        <div class="map-merge-candidates">${candidateHtml}</div>
        <div class="map-merge-conflict" id="mapMergeConflict" role="alert"></div>
        <div class="map-merge-choices" id="mapMergeChoices">
          ${choiceOptions('Name', '名称与节点链')}
          ${choiceOptions('Description', '描述、物品与方位')}
          ${choiceOptions('Visual', '地图图片与场景图（同组选项）')}
        </div>
        <div class="map-merge-actions">
          <button class="map-btn map-merge-cancel" type="button">取消</button>
          <button class="map-btn map-merge-submit" type="button" disabled>确认合并</button>
        </div>
      </div>
    </div>`;
  const libraryEl = document.querySelector('.map-library');
  if (!libraryEl) return;
  libraryEl.insertAdjacentHTML('beforeend', modalHtml);
  const overlay = document.querySelector('.map-merge-modal-overlay') as HTMLElement | null;
  if (!overlay) return;
  const panel = overlay.closest('.panel-overlay') as HTMLElement | null;
  if (panel?.classList.contains('dark') || document.body.classList.contains('dark-mode')) overlay.classList.add('dark');
  const conflictEl = overlay.querySelector('#mapMergeConflict') as HTMLElement;
  const submitBtn = overlay.querySelector('.map-merge-submit') as HTMLButtonElement;
  const choiceFieldsets = [...overlay.querySelectorAll('.map-merge-choice-group')] as HTMLFieldSetElement[];
  const targetInputs = [...overlay.querySelectorAll('input[name="mapMergeTarget"]')] as HTMLInputElement[];
  let targetId = '';
  let latestInspection: { ok: boolean; reason?: string; conflicts: Array<{ name: string }> } | null = null;
  let requestSerial = 0;

  const setChoiceTarget = (value: string, targetInfo?: typeof nodes[number]) => {
    overlay.querySelectorAll('.map-merge-alt-name').forEach(el => { el.textContent = targetInfo?.name || '请选择另一个节点'; });
    overlay.querySelectorAll('.map-merge-alt-choice input').forEach(input => { (input as HTMLInputElement).value = value; });
  };
  const refreshInspection = async () => {
    const serial = ++requestSerial;
    latestInspection = null;
    submitBtn.disabled = true;
    choiceFieldsets.forEach(fieldset => { fieldset.disabled = !targetId; });
    if (!targetId) {
      conflictEl.textContent = '请选择一个不在当前节点父子链上的节点。';
      return;
    }
    const targetInfo = byId.get(targetId);
    setChoiceTarget(targetId, targetInfo);
    const [inspection, leftScene, rightScene] = await Promise.all([
      inspectMapNodeMerge(nodeId, targetId),
      readMapSceneImage(nodeId),
      readMapSceneImage(targetId),
    ]);
    if (serial !== requestSerial) return;
    latestInspection = inspection;
    overlay.querySelectorAll('.map-merge-resource-status').forEach(el => el.remove());
    if (!inspection.ok) {
      conflictEl.textContent = inspection.conflicts.length
        ? `直接子节点名称冲突：${inspection.conflicts.map(item => item.name).join('、')}`
        : inspection.reason || '这两个节点不能合并。';
    } else {
      conflictEl.textContent = '检查通过，可以选择合并后的内容来源。';
    }
    const visualMeta = `${byId.get(nodeId)?.status === 'generated' ? '有地图' : '无地图'} / ${leftScene?.imagePath ? '有场景图' : '无场景图'}`;
    const targetMeta = `${targetInfo?.status === 'generated' ? '有地图' : '无地图'} / ${rightScene?.imagePath ? '有场景图' : '无场景图'}`;
    const firstMeta = choiceFieldsets.find(fieldset => fieldset.dataset.choiceGroup === 'Visual')?.querySelector('label');
    if (firstMeta) firstMeta.insertAdjacentHTML('beforeend', ` <span class="map-merge-resource-status">${visualMeta}</span>`);
    const secondMeta = choiceFieldsets.find(fieldset => fieldset.dataset.choiceGroup === 'Visual')?.querySelector('.map-merge-alt-choice');
    if (secondMeta) secondMeta.insertAdjacentHTML('beforeend', ` <span class="map-merge-resource-status">${targetMeta}</span>`);
    submitBtn.disabled = !inspection.ok;
  };

  targetInputs.forEach(input => input.addEventListener('change', () => {
    targetId = input.value;
    void refreshInspection();
  }));
  overlay.querySelector('.map-merge-cancel')?.addEventListener('click', closeMergeModal);
  overlay.addEventListener('click', (event: Event) => {
    if (event.target === overlay) closeMergeModal();
  });
  overlay.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') closeMergeModal();
  });
  submitBtn.addEventListener('click', async () => {
    if (!targetId || !latestInspection?.ok) return;
    if (!await showConfirmDialog({ message: `确认将「${nodeName}」与「${byId.get(targetId)?.name || targetId}」合并？此操作不可撤销。`, danger: true })) return;
    const selected = (name: string) => (overlay.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement)?.value || nodeId;
    submitBtn.disabled = true;
    choiceFieldsets.forEach(fieldset => { fieldset.disabled = true; });
    const result = await mergeMapNodes({
      leftNodeId: nodeId,
      rightNodeId: targetId,
      nameSourceId: selected('mapMergeName'),
      descriptionSourceId: selected('mapMergeDescription'),
      visualSourceId: selected('mapMergeVisual'),
    });
    if (!result.ok) {
      conflictEl.textContent = result.error || '合并失败，请稍后重试。';
      submitBtn.disabled = false;
      choiceFieldsets.forEach(fieldset => { fieldset.disabled = false; });
      return;
    }
    closeMergeModal();
    await renderMapLibrary();
    const finalItem = document.querySelector(`.map-library-item[data-node-id="${CSS.escape(result.finalNodeId || nodeId)}"]`) as HTMLElement | null;
    finalItem?.classList.add('active');
    if (result.finalNodeId) await previewLibraryNode(result.finalNodeId);
  });
}

/**
 * 弹出节点「⋯ 更多」二级菜单：编辑描述/新增子节点/移动到…/地点别名/设为最终子节点。
 * 点击 ⋯ 时按需创建单个共享浮层（挂到 body、position:fixed 定位到按钮下方），选项后关闭。
 * 低频项收进此菜单以缓解库行按钮拥挤。不打开时零 DOM 开销。
 */
async function showNodeMoreMenu(nodeId: string, anchorEl: HTMLElement): Promise<void> {
  closeNodeMoreMenu();
  const nodes = await listMapLibraryNodes();
  const info = nodes.find(n => n.nodeId === nodeId);
  if (!info) return;
  const isGenerated = info.status === 'generated';
  const isRecorded = info.status !== 'pending';
  const nodeName = info.name;

  // 挂到地图弹窗 .panel-overlay（#panelOverlay：position:fixed;z-index:10000 全屏）内部，
  // 用 position:absolute 相对它定位——共享弹窗层叠上下文（在库内容之上，不被弹窗遮住），
  // 且不受 <html> transform/perspective 影响（移动端），避免菜单被遮或错位。
  const overlayEl = anchorEl.closest('.panel-overlay') as HTMLElement | null;
  if (!overlayEl) return;
  const overlayRect = overlayEl.getBoundingClientRect();
  const rect = anchorEl.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.className = 'map-more-menu';
  menu.id = 'mapMoreMenu';
  // 手机端行内重命名/生成/场景图/删除按钮按 CSS（≤599px）隐藏，改由菜单提供同一批动作
  const phone = typeof window.matchMedia === 'function' && window.matchMedia('(max-width:599px)').matches;
  menu.innerHTML = `
    <div class="map-more-menu-item${isRecorded ? '' : ' disabled'}" data-act="desc"><span class="mi-icon">${ubIcon('memo')}</span>编辑描述</div>
    ${phone ? `<div class="map-more-menu-item" data-act="rename"><span class="mi-icon">${ubIcon('pencil')}</span>重命名</div>
    <div class="map-more-menu-item" data-act="gen"><span class="mi-icon">${isGenerated ? ubIcon('repeat') : ubIcon('pin')}</span>${isGenerated ? '重新生成地图' : '生成地图'}</div>
    <div class="map-more-menu-item${isGenerated ? '' : ' disabled'}" data-act="scene"><span class="mi-icon">${ubIcon('image')}</span>生成场景图</div>` : ''}
    <div class="map-more-menu-item" data-act="add"><span class="mi-icon">${ubIcon('plus')}</span>新增子节点</div>
    <div class="map-more-menu-item" data-act="move"><span class="mi-icon">${ubIcon('pencil')}</span>移动到…</div>
    <div class="map-more-menu-item" data-act="merge"><span class="mi-icon">${ubIcon('merge')}</span>合并节点</div>
    <div class="map-more-menu-item" data-act="alias"><span class="mi-icon">${ubIcon('link')}</span>地点别名</div>
    <div class="map-more-menu-sep"></div>
    <div class="map-more-menu-item" data-act="final"><span class="mi-icon">${ubIcon('flag')}</span>设为最终子节点${info.finalChild ? '<span class="mi-check">✓</span>' : ''}</div>
    ${phone ? `<div class="map-more-menu-item" data-act="del"><span class="mi-icon">${ubIcon('trash')}</span>删除节点</div>` : ''}`;
  overlayEl.appendChild(menu);

  // bridge 风格打标：菜单保住暗青盘（.map-more-menu.bridge-module-menu），不进深色中性翻转
  if (anchorEl.closest('.map-popup.bridge-module-navigation')) menu.classList.add('bridge-module-menu');

  // 定位（共用 placeAnchoredMenu，与立绘 ⋮ 菜单同一口径）：默认向下展开；下方放不下翻到行上方，
  // 两侧都放不下则限高内滚。手机端本菜单 11 项 ≈330px（行内按钮全收进来），库列表滚到底时行下沿
  // 只剩几十 px——旧写法「永远 rect.bottom + 2」会让菜单下部落到视口之外：不可见、不可滚、点不到。
  // 高度取已入 DOM 的实测值（一次同步量取，无定时器/监听）；限高按 border-box 算（见 .map-more-menu）。
  const place = placeAnchoredMenu(rect, overlayRect, { width: menu.offsetWidth, height: menu.offsetHeight });
  menu.style.left = `${place.left}px`;
  menu.style.top = `${place.top}px`;
  if (place.maxHeight !== null) {
    menu.style.maxHeight = `${place.maxHeight}px`;
    menu.style.overflowY = 'auto';
  }

  const toastr = getToastr();
  const itemEl = anchorEl.closest('.map-library-item') as HTMLElement | null;
  const close = () => closeNodeMoreMenu();

  menu.addEventListener('click', async (e: Event) => {
    const t = e.target as HTMLElement;
    const menuItem = t.closest('.map-more-menu-item') as HTMLElement | null;
    if (!menuItem) return;
    const act = menuItem.dataset.act;
    if ((act === 'desc' && !isRecorded) || (act === 'scene' && !isGenerated)) return; // 禁用项不响应
    close();
    if (act === 'desc') {
      if (itemEl) {
        document.querySelectorAll('.map-library-item').forEach(el => el.classList.remove('active'));
        itemEl.classList.add('active');
      }
      void editNodeDesc(nodeId);
    } else if (act === 'rename') {
      const newName = await showPromptDialog({ message: '输入新名称：', defaultValue: nodeName });
      if (newName === null || newName.trim() === '' || newName.trim() === nodeName) return;
      const ok = await renameMapNode(nodeId, newName.trim());
      if (ok) toastr?.success?.('已重命名', '地图库');
      else toastr?.error?.('重命名失败', '地图库');
      await renderMapLibrary();
    } else if (act === 'gen') {
      const msg = isGenerated
        ? `重新生成「${nodeName}」的地图？将覆盖现有地图数据。`
        : `为「${nodeName}」生成地图？将搜索世界书中包含该名称的条目作为参考。`;
      if (await showConfirmDialog({ message: msg })) void withBtnBusy(libRowBtn(nodeId, '.map-lib-large'), () => runLibraryGenerate(nodeId, nodeName, isGenerated));
    } else if (act === 'scene') {
      const hasScene = sceneRecordHasImage(await readMapSceneImage(nodeId));
      const msg = hasScene
        ? `重新生成「${nodeName}」的场景图？将覆盖现有场景图。`
        : `为「${nodeName}」生成场景图？将使用该地点的 SVG 地图和探索描述。`;
      if (await showConfirmDialog({ message: msg })) void withBtnBusy(libRowBtn(nodeId, '.map-lib-scene'), () => runLibrarySceneGenerate(nodeId, nodeName, hasScene));
    } else if (act === 'del') {
      if (!await showConfirmDialog({ message: `确定删除「${nodeName}」及其所有子地图吗？此操作不可撤销。`, danger: true })) return;
      const count = await deleteMapNodeFromLibrary(nodeId);
      toastr?.success?.(`已删除 ${count} 个节点`, '地图库');
      await renderMapLibrary();
    } else if (act === 'add') {
      const childName = await showPromptDialog({ message: `为「${nodeName}」新增子节点：\n输入子节点名称（将创建为 pending 状态，需在剧情中进入后才会生成地图）` });
      if (childName === null || childName.trim() === '') return;
      const newId = await addChildMapNode(nodeId, childName.trim());
      if (newId) toastr?.success?.(`已新增子节点「${childName.trim()}」`, '地图库');
      else toastr?.error?.('新增失败（可能重名）', '地图库');
      await renderMapLibrary();
    } else if (act === 'move') {
      void showMoveModal(nodeId, nodeName);
    } else if (act === 'merge') {
      void showMergeModal(nodeId, nodeName);
    } else if (act === 'alias') {
      void showAliasModal(nodeId, nodeName);
    } else if (act === 'final') {
      const next = await toggleMapNodeFinalChild(nodeId);
      if (next === null) toastr?.error?.('切换失败', '地图库');
      else {
        toastr?.success?.(next ? `已设「${nodeName}」为最终子节点` : `已取消「${nodeName}」最终子节点`, '地图库');
        await renderMapLibrary();
      }
    }
  });

  // 点外部 / ESC 关闭（setTimeout 延迟注册 mousedown，避免开菜单的本次点击立即关掉）
  setTimeout(() => {
    const onDown = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) { close(); document.removeEventListener('mousedown', onDown); }
    };
    document.addEventListener('mousedown', onDown);
    // 容器内滚动会让锚行移位、菜单却留在原处（菜单挂视口层不随行动）→ 滚动即关。
    // 与 mousedown 同批延迟注册（避免本次点击聚焦引发的滚动立刻关掉）；关菜单时统一解绑，零常驻。
    if (menu.isConnected) {
      const onScroll = () => close();
      overlayEl.addEventListener('scroll', onScroll, { capture: true, passive: true });
      nodeMoreMenuCleanup = () => overlayEl.removeEventListener('scroll', onScroll, { capture: true });
    }
  }, 0);
  document.addEventListener('keydown', function esc(e: KeyboardEvent) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

/** 关闭移动 Modal（从 DOM 中移除） */
function closeMoveModal(): void {
  const overlay = document.querySelector('.map-move-modal-overlay');
  if (overlay) overlay.remove();
}

/**
 * 弹出移动目标选择 Modal。
 * 显示树形目标列表（排除自身、后代、当前父节点、已有同名子节点的目标），
 * 支持"移至根级别"选项。
 */
async function showMoveModal(nodeId: string, nodeName: string): Promise<void> {
  // 先关闭已存在的 Modal
  closeMoveModal();

  const index = await readTreeIndex();
  const uiNodes = listAllNodesForUI(index);

  // 构建每个候选目标的行：可选/不可选
  const targetRows = uiNodes.map(n => {
    const check = checkCanMoveTo(index, nodeId, n.nodeId);
    const canSelect = check.ok;
    const reason = check.reason || '';
    return {
      nodeId: n.nodeId,
      name: n.name,
      depth: n.depth,
      canSelect,
      reason,
    };
  });

  // 根级别是否可选
  const rootCheck = checkCanMoveTo(index, nodeId, null);
  const canMoveToRoot = rootCheck.ok;

  // 构建选项 HTML
  const rootOptionHtml = canMoveToRoot
    ? `<label class="map-move-modal-option">
        <input type="radio" name="moveTarget" value="__root__"> 移至根级别（顶层）
      </label>`
    : `<label class="map-move-modal-option disabled" title="${escapeHtml(rootCheck.reason || '')}">
        <input type="radio" name="moveTarget" value="__root__" disabled> 移至根级别（顶层）
      </label>`;

  const treeItemsHtml = targetRows.map(r => {
    if (r.canSelect) {
      return `<label class="map-move-modal-option" style="padding-left: ${r.depth * 18 + 4}px" title="${escapeHtml(r.nodeId)}">
        <input type="radio" name="moveTarget" value="${escapeHtml(r.nodeId)}"> ${ubIcon('folder')} ${escapeHtml(r.name)}
      </label>`;
    } else {
      return `<label class="map-move-modal-option disabled" style="padding-left: ${r.depth * 18 + 4}px" title="${escapeHtml(r.reason)}">
        <input type="radio" name="moveTarget" value="${escapeHtml(r.nodeId)}" disabled> ${ubIcon('folder')} ${escapeHtml(r.name)}
      </label>`;
    }
  }).join('');

  // 构建 Modal DOM
  const modalHtml = `
    <div class="map-move-modal-overlay">
      <div class="map-move-modal" id="mapMoveModal">
        <div class="map-move-modal-title">移动「${escapeHtml(nodeName)}」到…</div>
        ${rootOptionHtml}
        <div style="font-size:var(--ub-ui-font-11,11px);color:var(--map-text-soft,#7a6a5a);margin-top:4px;">选择目标父节点：</div>
        <div class="map-move-modal-tree">${treeItemsHtml}</div>
        <div class="map-move-modal-actions">
          <button class="map-btn" id="mapMoveCancel" type="button">取消</button>
          <button class="map-btn" id="mapMoveConfirm" type="button" disabled>确认移动</button>
        </div>
      </div>
    </div>`;

  // 注入到 map-library 容器
  const libraryEl = document.querySelector('.map-library');
  if (!libraryEl) return;
  libraryEl.insertAdjacentHTML('beforeend', modalHtml);

  // 同步深色模式
  const overlay = document.querySelector('.map-move-modal-overlay') as HTMLElement | null;
  if (overlay) {
    const panel = overlay.closest('.panel-overlay') as HTMLElement | null;
    const isDark = panel?.classList.contains('dark') ?? document.body.classList.contains('dark-mode');
    if (isDark) overlay.classList.add('dark');
  }

  // 绑定交互
  const confirmBtn = document.getElementById('mapMoveConfirm') as HTMLButtonElement | null;
  const cancelBtn = document.getElementById('mapMoveCancel') as HTMLButtonElement | null;
  const radios = libraryEl.querySelectorAll<HTMLInputElement>('input[name="moveTarget"]');

  // 任选一项后启用确认按钮
  radios.forEach(r => {
    r.addEventListener('change', () => {
      if (confirmBtn) confirmBtn.disabled = false;
    });
  });

  // 确认
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const selected = libraryEl.querySelector<HTMLInputElement>('input[name="moveTarget"]:checked');
      if (!selected) return;
      const targetValue = selected.value;
      const newParentId = targetValue === '__root__' ? null : targetValue;
      closeMoveModal();
      const result = await moveMapNode(nodeId, newParentId);
      if (result.ok) {
        await renderMapLibrary();
      }
    });
  }

  // 取消
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeMoveModal);
  }

  // 点击遮罩关闭
  if (overlay) {
    overlay.addEventListener('click', (e: Event) => {
      if ((e.target as HTMLElement).classList.contains('map-move-modal-overlay')) {
        closeMoveModal();
      }
    });
  }
}

/** 关闭长按额外提示词 Modal（从 DOM 移除） */
function closeMapExtraDialog(): void {
  document.getElementById('mapExtraOverlay')?.remove();
}

/**
 * 长按额外提示词 Modal（模仿大调查 showInvestigationExtraPromptDialog）：
 * 注入到 .map-panel 作为覆盖层（不清空 #panelOverlay，避免地图弹窗被冲掉），
 * 复用 map 主题 CSS 变量。输入非空才可点确认；确认后回调 onConfirm(value)。
 */
function showMapExtraPromptDialog(opts: { title: string; confirmLabel: string; cacheKey?: string; onConfirm: (value: string) => void }): void {
  closeMapExtraDialog();
  const panel = document.querySelector('.map-panel');
  if (!panel) return;
  const html =
    '<div class="map-extra-overlay" id="mapExtraOverlay">' +
      '<div class="map-extra-modal">' +
        '<div class="map-extra-title">' + escapeHtml(opts.title) + '</div>' +
        '<div class="map-extra-field">' +
          '<label>补充额外要求（仅本次生效，不保存；支持 {{char}}/{{user}} 等宏）</label>' +
          '<textarea id="mapExtraInput" rows="5" placeholder="例如：&#10;· 侧重某区域的氛围描写&#10;· 调整地图风格 / 配色&#10;· 增加特定建筑或地标"></textarea>' +
        '</div>' +
        '<div class="map-extra-actions">' +
          '<button class="map-btn" id="mapExtraCancel" type="button">取消</button>' +
          '<button class="map-btn map-extra-ok" id="mapExtraOk" type="button" disabled>' + escapeHtml(opts.confirmLabel) + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  panel.insertAdjacentHTML('beforeend', html);

  // 深色模式同步（对齐 showMoveModal：读 .panel-overlay.dark / body.dark-mode）
  const overlay = document.getElementById('mapExtraOverlay');
  if (overlay) {
    const po = overlay.closest('.panel-overlay') as HTMLElement | null;
    const isDark = po?.classList.contains('dark') ?? document.body.classList.contains('dark-mode');
    if (isDark) overlay.classList.add('dark');
  }

  const input = document.getElementById('mapExtraInput') as HTMLTextAreaElement | null;
  const okBtn = document.getElementById('mapExtraOk') as HTMLButtonElement | null;
  const cancelBtn = document.getElementById('mapExtraCancel');
  const close = (): void => closeMapExtraDialog();
  const cachedMap = opts.cacheKey ? readExtraPromptCache(opts.cacheKey) : '';
  if (input && cachedMap) { input.value = cachedMap; if (okBtn) okBtn.disabled = false; }

  // 输入非空时启用确认按钮
  input?.addEventListener('input', () => {
    if (okBtn) okBtn.disabled = !input.value.trim();
  });
  cancelBtn?.addEventListener('click', close);
  okBtn?.addEventListener('click', () => {
    const val = (input?.value || '').trim();
    if (!val) return;
    if (opts.cacheKey) writeExtraPromptCache(opts.cacheKey, val);
    close();
    opts.onConfirm(val);
  });
  // 点遮罩关闭（stopPropagation 防止冒泡到 #panelOverlay 的地图关闭处理）
  overlay?.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).id === 'mapExtraOverlay') close();
  });
  // 长按触发时手指仍按下，松手补发的合成 click 会落在刚出现的遮罩上把弹窗立刻关掉；
  // 在 document capture 层一次性吞掉（U10：统一由 long-press 模块提供）。
  swallowGhostClickIfPointerActive();
  // 自动聚焦输入框
  setTimeout(() => { input?.focus(); }, 50);
}

/** 地图库预览容器进入「提示态」（加载/进度/错误）：手机端（≤599px）同样走全屏覆盖层，末尾统一带「×」关闭钮
 *  （关闭为事件委托，监听在 setupOverlayAndLibraryEvents 挂在常驻的 #mapLibraryPreview 上）。 */
function setLibraryPreviewNotice(html: string): void {
  const previewEl = document.getElementById('mapLibraryPreview');
  if (!previewEl) return;
  const phone = typeof window.matchMedia === 'function' && window.matchMedia('(max-width:599px)').matches;
  previewEl.style.display = phone ? 'flex' : 'block';
  if (phone) previewEl.classList.add('lib-full');
  previewEl.setAttribute('data-lib-mode', 'svg');
  previewEl.innerHTML = html + (phone ? `<button class="map-btn map-lib-full-close" type="button" title="关闭预览">${ubIcon('close')}</button>` : '');
}

/** 地图库生成/重新生成场景图；节点目标由 nodeId 固定，不受当前地图地点影响。 */
// F22：图标小按钮的忙碌态统一包裹（spinner-only，文案放不下；成功路径会整表重渲，恢复挂在游离节点上无害）
async function withBtnBusy<T>(btn: HTMLElement | null, fn: () => Promise<T>): Promise<T> {
  setButtonBusy(btn, true, '');
  try { return await fn(); } finally { setButtonBusy(btn, false, ''); }
}
function libRowBtn(nodeId: string, sel: string): HTMLElement | null {
  return document.querySelector('.map-library-item[data-node-id="' + nodeId + '"] ' + sel) as HTMLElement | null;
}

async function runLibrarySceneGenerate(nodeId: string, nodeName: string, isGenerated: boolean, extraPrompt?: string): Promise<void> {
  setLibraryPreviewNotice(`<div class="map-library-empty" style="display:flex;align-items:center;justify-content:center;height:100%;">正在${isGenerated ? '重新' : ''}生成「${escapeHtml(nodeName)}」场景图...</div>`);
  const result = await generateMapSceneForLibraryNode(nodeId, extraPrompt);
  if (!result.ok && result.switched) return; // 聊天已切换：结果未写入，静默收口
  const toastr = getToastr();
  if (result.ok) {
    toastr?.success?.(`已${isGenerated ? '重新' : ''}生成「${nodeName}」场景图`, '地图库');
    await renderMapLibrary();
    document.querySelector(`.map-library-item[data-node-id="${nodeId}"]`)?.classList.add('active');
    void previewLibraryNode(nodeId);
  } else {
    setLibraryPreviewNotice(`<div class="map-library-empty">${escapeHtml(result.error || '场景图生成失败')}</div>`);
  }
}

/** 地图库节点地图按钮的短按：原确认流程（无额外提示词）。
 *  U10：从 listEl 的大 click 委托里摘出来，改由 long-press 模块的 onClick 调用（长按走 onLong）。 */
async function shortPressLibraryGenerate(genBtn: HTMLElement): Promise<void> {
  const item = genBtn.closest('.map-library-item') as HTMLElement | null;
  const nodeId = item?.dataset.nodeId || '';
  const nodeName = item?.querySelector('.map-lib-name')?.textContent || '';
  const isGenerated = genBtn.dataset.generated === '1';
  if (!nodeId) return;
  const msg = isGenerated
    ? `重新生成「${nodeName}」的地图？将覆盖现有地图数据。`
    : `为「${nodeName}」生成地图？将搜索世界书中包含该名称的条目作为参考。`;
  if (!await showConfirmDialog({ message: msg })) return;
  await withBtnBusy(genBtn, () => runLibraryGenerate(nodeId, nodeName, isGenerated));
}

/** 地图库生成/重新生成统一流程（短按与长按复用；长按传入 extraPrompt） */
async function runLibraryGenerate(nodeId: string, nodeName: string, isGenerated: boolean, extraPrompt?: string): Promise<void> {
  const listEl = document.getElementById('mapLibraryList');
  listEl?.querySelectorAll('.map-library-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.map-library-item[data-node-id="${nodeId}"]`)?.classList.add('active');
  setLibraryPreviewNotice(`<div class="map-library-empty" style="display:flex;align-items:center;justify-content:center;height:100%;">正在${isGenerated ? '重新' : ''}生成「${escapeHtml(nodeName)}」地图...</div>`);
  let _notFoundHandled = false;
  const node = await generateNodeMapFromLibrary(nodeId, extraPrompt, (msg) => {
    _notFoundHandled = true;
    setLibraryPreviewNotice(`<div class="map-library-empty">${escapeHtml(msg)}</div>`);
  });
  const toastr = getToastr();
  if (node) {
    toastr?.success?.(`已${isGenerated ? '重新' : ''}生成「${nodeName}」地图`, '地图库');
    await renderMapLibrary();
    document.querySelector(`.map-library-item[data-node-id="${nodeId}"]`)?.classList.add('active');
    void previewLibraryNode(nodeId);
  } else if (!_notFoundHandled) {
    setLibraryPreviewNotice('<div class="map-library-empty">地图生成失败</div>');
  }
}

function applyCollapseState(): void {
  const listEl = document.getElementById('mapLibraryList');
  if (!listEl) return;
  const items = listEl.querySelectorAll('.map-library-item');
  items.forEach(item => {
    const itemId = (item as HTMLElement).dataset.nodeId || '';
    const isCollapsed = _collapsedState.get(itemId) === true;
    item.classList.toggle('collapsed', isCollapsed);
    const shouldHide = isUnderCollapsed(itemId);
    item.classList.toggle('hidden', shouldHide);
  });
}

function isUnderCollapsed(nodeId: string): boolean {
  // 从父节点开始检查（不含自身——折叠自身不应导致自身被隐藏）
  let currentId = nodeId;
  const visited = new Set<string>();
  // 先跳到父节点
  const item = document.querySelector(`.map-library-item[data-node-id="${currentId}"]`) as HTMLElement | null;
  if (!item) return false;
  currentId = item.dataset.parentId || '';
  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    if (_collapsedState.get(currentId) === true) return true;
    const parentItem = document.querySelector(`.map-library-item[data-node-id="${currentId}"]`) as HTMLElement | null;
    if (!parentItem) break;
    currentId = parentItem.dataset.parentId || '';
  }
  return false;
}

function toggleCollapse(nodeId: string): void {
  const isCollapsed = _collapsedState.get(nodeId) === true;
  _collapsedState.set(nodeId, !isCollapsed);
  applyCollapseState();
}

async function previewLibraryNode(nodeId: string): Promise<void> {
  const previewEl = document.getElementById('mapLibraryPreview');
  if (!previewEl) return;
  closeInfoDrawer(); // 换节点预览时旧地点信息即过期：关抽屉并清对齐偏移
  const requestId = beginLibraryPreviewRequest(nodeId);
  setLibraryPreviewNotice('<div class="map-library-empty" style="display:flex;align-items:center;justify-content:center;height:100%;">加载中...</div>');
  try {
    const result = await previewMapNodeFull(nodeId);
    if (!isCurrentLibraryPreviewRequest(nodeId, requestId)) return;
    if (!result) {
      setLibraryPreviewNotice('<div class="map-library-empty">节点不存在</div>');
      return;
    }
    if (!result.hasMap || !result.svg) {
      const detail = result.exploreSummary || (result.exploreLog && result.exploreLog.length)
        ? '暂无地图（仅有文字记录，可点 ⋯ → 编辑描述查看）'
        : '暂无地图（待生成）';
      setLibraryPreviewNotice(`<div class="map-library-empty">「${escapeHtml(result.name)}」${detail}</div>`);
      return;
    }
    // 用带 viewport 的结构包装 SVG，支持缩放/拖动；顶部加场景图/SVG 切换；手机端末尾追加全屏「×」关闭钮
    const phone = typeof window.matchMedia === 'function' && window.matchMedia('(max-width:599px)').matches;
    const fullCloseHtml = phone ? `<button class="map-btn map-lib-full-close" type="button" title="关闭预览">${ubIcon('close')}</button>` : '';
    previewEl.setAttribute('data-lib-mode', 'svg');
    previewEl.innerHTML = `<div class="map-library-lib-head">
        <button class="map-btn map-lib-display-toggle" id="ac-map-lib-display-toggle" type="button" title="切换到场景图">${ubIcon('image')} 场景图</button>
      </div>
      <div class="map-library-preview-viewport" id="mapLibViewport">${result.svg}</div>
      <div class="map-library-preview-scene" id="mapLibScene">
        <img id="mapLibSceneImage" alt="场景图" style="display:none;">
        <div class="map-library-empty" id="mapLibSceneEmpty">尚未生成场景图</div>
      </div>
      <div class="map-zoom-controls map-lib-zoom-controls">
        <button class="map-btn map-zoom-btn" id="ac-map-lib-zoom-in" type="button" title="放大">＋</button>
        <button class="map-btn map-zoom-btn" id="ac-map-lib-zoom-out" type="button" title="缩小">－</button>
        <button class="map-btn map-zoom-btn" id="ac-map-lib-zoom-reset" type="button" title="重置缩放">${ubIcon('expand')}</button>
        <button class="map-btn map-zoom-btn" id="ac-map-lib-info" type="button" title="地点信息">ℹ</button>
      </div>` + fullCloseHtml;
    // 初始化缩放交互（复用主地图 zoom state）
    const viewport = document.getElementById('mapLibViewport');
    if (viewport) {
      // 重置 zoom state 给库预览用
      if (_zoomState) resetPanZoom(_zoomState, viewport);
      setupZoomInteraction(previewEl as HTMLElement, viewport);
    }
    // 库预览缩放按钮绑定
    const libZoomIn = document.getElementById('ac-map-lib-zoom-in');
    const libZoomOut = document.getElementById('ac-map-lib-zoom-out');
    const libZoomReset = document.getElementById('ac-map-lib-zoom-reset');
    if (libZoomIn) libZoomIn.addEventListener('click', () => {
      if (!_zoomState) return;
      const vp = document.getElementById('mapLibViewport');
      if (!vp) return;
      const rect = (vp.parentElement as HTMLElement).getBoundingClientRect();
      panZoomBy(_zoomState, 1.3, rect.left + rect.width / 2, rect.top + rect.height / 2, vp, vp.parentElement as HTMLElement);
    });
    if (libZoomOut) libZoomOut.addEventListener('click', () => {
      if (!_zoomState) return;
      const vp = document.getElementById('mapLibViewport');
      if (!vp) return;
      const rect = (vp.parentElement as HTMLElement).getBoundingClientRect();
      panZoomBy(_zoomState, 1 / 1.3, rect.left + rect.width / 2, rect.top + rect.height / 2, vp, vp.parentElement as HTMLElement);
    });
    if (libZoomReset) libZoomReset.addEventListener('click', () => {
      if (!_zoomState) return;
      const vp = document.getElementById('mapLibViewport');
      if (!vp) return;
      resetPanZoom(_zoomState, vp);
    });
    const libInfoBtn = document.getElementById('ac-map-lib-info');
    if (libInfoBtn) libInfoBtn.addEventListener('click', () => {
      fillInfoDrawer(result.explorationDesc || null, result.exploreSummary || null, result.exploreLog || null);
      openInfoDrawer(previewEl);
    });
    // 库预览场景图/SVG 切换
    const libDisplayToggle = document.getElementById('ac-map-lib-display-toggle');
    if (libDisplayToggle) {
      libDisplayToggle.addEventListener('click', function () {
        const current = previewEl.getAttribute('data-lib-mode') === 'scene' ? 'scene' : 'svg';
        void setLibPreviewMode(nodeId, current === 'scene' ? 'svg' : 'scene');
      });
    }
    // 绑定 exit 热点点击（库预览区内切换节点）
    previewEl.querySelectorAll('.map-exit-marker').forEach(marker => {
      marker.addEventListener('click', function (e: Event) {
        e.stopPropagation();
        const targetNodeId = (marker as HTMLElement).dataset.targetNode || '';
        if (!targetNodeId) return;
        // 已在预览此节点则跳过
        if (targetNodeId === _libPreviewNodeId) return;
        void (async () => {
          // 检查目标节点是否已生成
          const generated = await isNodeGenerated(targetNodeId);
          if (!generated) {
            const toastr = getToastr();
            toastr?.info?.('该地点尚未生成地图', '地图库');
            return;
          }
          // 在库预览区内切换到目标节点
          void previewLibraryNode(targetNodeId);
          // 高亮列表中对应行
          const listEl = document.getElementById('mapLibraryList');
          if (listEl) {
            listEl.querySelectorAll('.map-library-item').forEach(el => el.classList.remove('active'));
            const targetItem = listEl.querySelector(`.map-library-item[data-node-id="${targetNodeId}"]`);
            targetItem?.classList.add('active');
            // 滚动到目标行
            (targetItem as HTMLElement)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        })();
      });
    });
  } catch (e) {
    if (!isCurrentLibraryPreviewRequest(nodeId, requestId)) return;
    previewEl.innerHTML = '<div class="map-library-empty">预览失败</div>';
    console.error('[map-library] 预览失败:', e);
  }
}

/** 库预览区场景图/SVG 切换。有场景图显示场景图，无则提示并保持 SVG。 */
async function setLibPreviewMode(nodeId: string, mode: 'svg' | 'scene'): Promise<void> {
  const previewEl = document.getElementById('mapLibraryPreview');
  if (!previewEl) return;
  const requestId = _libPreviewRequestSeq;
  if (!isCurrentLibraryPreviewRequest(nodeId, requestId)) return;
  const toggle = document.getElementById('ac-map-lib-display-toggle');
  if (mode === 'svg') {
    previewEl.setAttribute('data-lib-mode', 'svg');
    if (toggle) { toggle.innerHTML = ubIcon('image') + ' 场景图'; toggle.setAttribute('title', '切换到场景图'); }
    return;
  }
  const record = await readMapSceneImage(nodeId);
  if (!isCurrentLibraryPreviewRequest(nodeId, requestId)) return;
  if (!record || !sceneRecordHasImage(record)) {
    const toastr = getToastr();
    toastr?.info?.('该地点尚未生成场景图', '地图库');
    return;
  }
  previewEl.setAttribute('data-lib-mode', 'scene');
  if (toggle) { toggle.innerHTML = ubIcon('map') + ' SVG地图'; toggle.setAttribute('title', '切换到 SVG 地图'); }
  const img = previewEl.querySelector('#mapLibSceneImage') as HTMLImageElement | null;
  const empty = previewEl.querySelector<HTMLElement>('#mapLibSceneEmpty');
  if (img) { img.src = record.imagePath; img.style.display = ''; }
  if (empty) empty.style.display = 'none';
}

/**
 * 编辑节点探索描述：在预览区显示内联编辑表单（summary/items/directions + 探索记录条目）。
 * 保存后调用 updateMapNodeDesc 写入 __map_node_ 重数据。
 */
async function editNodeDesc(nodeId: string): Promise<void> {
  const previewEl = document.getElementById('mapLibraryPreview');
  if (!previewEl) return;
  previewEl.style.display = 'block';
  previewEl.innerHTML = '<div class="map-library-empty" style="display:flex;align-items:center;justify-content:center;height:100%;">加载中...</div>';
  try {
    const [desc, record] = await Promise.all([readMapNodeDesc(nodeId), readMapNodeExploreRecord(nodeId)]);
    if (!desc) {
      previewEl.innerHTML = '<div class="map-library-empty">节点未生成，无法编辑描述</div>';
      return;
    }
    // 探索记录条目（可编辑副本，倒序展示：最新在上；最多 3 条）
    const logEntries: { time: string; storyHash: string; note: string }[] = (record?.entries || []).slice().reverse().map(e => ({
      time: e.time || '',
      storyHash: e.storyHash || '',
      note: e.note || '',
    }));
    const exploreSummaryText = record?.summary || '';

    const renderLogRows = (): string => logEntries.map((e, i) => `
      <div class="map-edit-log-row" data-idx="${i}">
        <input class="map-edit-log-time" type="text" value="${escapeHtml(e.time)}" placeholder="时间" />
        <textarea class="map-edit-log-note" rows="1" placeholder="探索备注">${escapeHtml(e.note)}</textarea>
        <button class="map-edit-log-del" type="button" title="删除此条">${ubIcon('close')}</button>
      </div>`).join('');

    previewEl.innerHTML = `<div class="map-edit-desc-form">
      <div class="map-edit-desc-head">${ubIcon('memo')} 编辑探索描述</div>
      <div class="map-edit-desc-field">
        <label>简介</label>
        <textarea id="mapEditSummary" rows="3">${escapeHtml(desc.summary || '')}</textarea>
      </div>
      <div class="map-edit-desc-field">
        <label>物品（逗号分隔）</label>
        <textarea id="mapEditItems" rows="2">${escapeHtml((desc.items || []).join('，'))}</textarea>
      </div>
      <div class="map-edit-desc-field">
        <label>方位</label>
        <textarea id="mapEditDirections" rows="2">${escapeHtml(desc.directions || '')}</textarea>
      </div>
      <div class="map-edit-desc-field">
        <label>探索情况总结（提示词目标 ≤200 字）</label>
        <textarea id="mapEditExploreSummary" rows="3">${escapeHtml(exploreSummaryText)}</textarea>
      </div>
      <div class="map-edit-desc-field">
        <label>近期探索记录（最新在上，最多 3 条）</label>
        <div class="map-edit-log-list" id="mapEditLogList">${renderLogRows()}</div>
        <button class="map-edit-log-add" id="mapEditLogAdd" type="button"${logEntries.length >= 3 ? ' disabled' : ''}>+ 新增条目（最多 3 条）</button>
      </div>
      <div class="map-edit-desc-actions">
        <button class="map-btn map-edit-save" type="button">${ubIcon('save')} 保存</button>
        <button class="map-btn map-edit-cancel" type="button">${ubIcon('close')} 取消</button>
      </div>
    </div>`;

    const logListEl = previewEl.querySelector('#mapEditLogList') as HTMLElement | null;
    const addBtn = previewEl.querySelector('#mapEditLogAdd');

    // 同步 DOM 输入回 logEntries（编辑文本框时实时回写，避免删除/新增时丢失未保存输入）
    const syncFromInputs = () => {
      if (!logListEl) return;
      logListEl.querySelectorAll('.map-edit-log-row').forEach(row => {
        const idx = Number((row as HTMLElement).dataset.idx);
        if (Number.isNaN(idx) || !logEntries[idx]) return;
        const timeEl = row.querySelector('.map-edit-log-time') as HTMLInputElement | null;
        const noteEl = row.querySelector('.map-edit-log-note') as HTMLTextAreaElement | null;
        if (timeEl) logEntries[idx].time = timeEl.value;
        if (noteEl) logEntries[idx].note = noteEl.value;
      });
    };

    // 重渲染条目列表（保留当前输入值），同步「新增」按钮的 3 条上限
    const syncAddBtn = () => {
      if (addBtn) (addBtn as HTMLButtonElement).disabled = logEntries.length >= 3;
    };
    const rerenderLogRows = () => {
      syncFromInputs();
      if (logListEl) logListEl.innerHTML = renderLogRows();
      syncAddBtn();
    };

    // 新增条目（最多 3 条）
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        if (logEntries.length >= 3) return;
        syncFromInputs();
        logEntries.unshift({ time: '', storyHash: '', note: '' });
        if (logListEl) logListEl.innerHTML = renderLogRows();
        syncAddBtn();
      });
    }
    // 删除条目（事件委托）
    if (logListEl) {
      logListEl.addEventListener('click', function (e) {
        const delBtn = (e.target as HTMLElement).closest('.map-edit-log-del') as HTMLElement | null;
        if (!delBtn) return;
        const row = delBtn.closest('.map-edit-log-row') as HTMLElement | null;
        if (!row) return;
        const idx = Number(row.dataset.idx);
        if (Number.isNaN(idx) || !logEntries[idx]) return;
        syncFromInputs();
        logEntries.splice(idx, 1);
        rerenderLogRows();
      });
    }

    // 保存/取消
    const saveBtn = previewEl.querySelector('.map-edit-save');
    const cancelBtn = previewEl.querySelector('.map-edit-cancel');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        syncFromInputs();
        const summary = (previewEl.querySelector('#mapEditSummary') as HTMLTextAreaElement)?.value || '';
        const itemsStr = (previewEl.querySelector('#mapEditItems') as HTMLTextAreaElement)?.value || '';
        const directions = (previewEl.querySelector('#mapEditDirections') as HTMLTextAreaElement)?.value || '';
        const exploreSummary = (previewEl.querySelector('#mapEditExploreSummary') as HTMLTextAreaElement)?.value || '';
        const items = itemsStr.split(/[，,、\n]/).map(s => s.trim()).filter(Boolean);
        // 存储顺序：倒序展示的反转回正序（最旧在前），并强制最多 3 条
        const exploreLog = logEntries.slice().reverse()
          .map(e => ({ time: e.time.trim(), storyHash: e.storyHash, note: e.note.trim() }))
          .filter(e => e.note || e.time)
          .slice(-3);
        void (async () => {
          const ok = await updateMapNodeDesc(nodeId, { summary, items, directions, exploreSummary, exploreLog });
          const toastr = getToastr();
          if (ok) toastr?.success?.('描述已保存', '地图库');
          else toastr?.error?.('保存失败', '地图库');
          await previewLibraryNode(nodeId); // 保存后刷新预览
        })();
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        void previewLibraryNode(nodeId);
      });
    }
  } catch (e) {
    previewEl.innerHTML = '<div class="map-library-empty">加载描述失败</div>';
    console.error('[map-library] 编辑描述失败:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// 显示地图弹窗
// ─────────────────────────────────────────────────────────────
export function showMapPopup(style: StyleType, opts?: { skipOpenRefresh?: boolean }): void {
  const config = getConfig();
  if (!config.mapEnabled) return;

  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;

  // Tier1 打开跳过重建：弹窗已开着同一地图 → 不整窗重建（避免闪烁/冲掉旧图/丢历史栈/重播动画），
  // 只走刷新路径。skipOpenRefresh 时也 return——调用方随后 navigateToNode 渲染目标节点。
  if (overlay.classList.contains('show') && overlay.querySelector('#mapContainer') !== null) {
    if (!opts?.skipOpenRefresh) {
      void refreshMap({ force: false });
      void syncCurrentMapSceneImage();
    }
    return;
  }

  const html = buildMapPopupHTML(config);
  if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  overlay.innerHTML = html;
  markPopupShown();
  overlay.classList.add('show');

  // 重置历史栈和折叠状态
  resetHistory();
  _collapsedState.clear();

  // 绑定弹窗内事件
  bindMapEvents($(overlay));

  // 绑定角落浮层 + 地图库事件（原生 addEventListener，避免 jQuery 委托问题）
  setupOverlayAndLibraryEvents();

  // O31③：接管兜底（重复打开先断开旧观察器，见 armMapTakeoverGuard）
  armMapTakeoverGuard(overlay);

  // 初始化缩放/拖动交互
  const mapContainer = document.getElementById('mapContainer');
  const mapViewport = document.getElementById('mapViewport');
  if (mapContainer && mapViewport) {
    setupZoomInteraction(mapContainer, mapViewport);
  }

  // 关闭处理：点击背景或关闭按钮
  overlay.onclick = function (e) {
    if (e.target === overlay || (e.target as HTMLElement).id === 'panelClose') {
      if (guardGhostClick()) return;
      const returningToCaller = closePanelOverlayOrReturn(overlay);
      if (returningToCaller) overlay.onclick = null; // 返回上游弹窗前清掉地图自身的 onclick，避免悬空
      stopMapZoom();
      _zoomState = null;
      // 清理历史栈和折叠状态
      resetHistory();
      _collapsedState.clear();
      // 清理库预览状态
      invalidateLibraryPreview();
      // 移除 CustomEvent 监听器（避免泄漏）
      _mapTakeoverObserver?.disconnect();
      _mapTakeoverObserver = null;
      teardownMapWindowListeners();
      return;
    }
  };

  // 外部定位打开（如召回 <spot> 点击）：跳过打开时的当前地点刷新与面包屑初始化，
  // 由调用方随后 navigateToNode 渲染目标节点并派发 ub-map-navigated（面包屑+历史栈）。
  // 否则 refreshMap 的异步渲染晚于 navigateToNode 完成，会把目标节点地图覆盖成当前地点地图
  // （面包屑已由 ub-map-navigated 更新正确，地图却停在当前地点 → 症状不符）。
  if (opts?.skipOpenRefresh) {
    return;
  }

  // 加载地图（从缓存或触发生成）
  void refreshMap({ force: false });
  void syncCurrentMapSceneImage();

  // 初始化面包屑 + 历史栈（首次打开时把当前地点压入历史栈）
  void (async () => {
    try {
      const loc = getCellByHeader('全局数据表', 1, '当前详细地点')
        || getCellByHeader('全局数据表', 1, '当前位置')
        || '';
      if (loc) {
        const { segments } = parseLocationHierarchy(String(loc).trim());
        if (segments.length > 0) {
          const nodeId = deriveNodeId(segments.join('-'));
          await renderBreadcrumb(nodeId);
          pushHistory(nodeId);
        }
      }
    } catch (e) { /* ignore */ }
  })();
}
