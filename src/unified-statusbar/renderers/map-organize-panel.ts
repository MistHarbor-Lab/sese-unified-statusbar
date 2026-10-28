// ===== AI 地图整理 · 面板与执行 =====
//
// UI 挂在 .map-library 内（与地图合并/移动/别名弹窗同一挂载方式）：
//   加载 → 建议清单 + 变更预览 → 二次确认 → 逐项执行 → 结果。
//
// 执行只复用现有写原语：
//   renameMapNode / moveMapNodeInStorage / mapMergeService.merge / deleteMapNodeByNodeId
// 每步前重新读索引并做 chatKey 守卫；任一步失败即停止后续，不做伪回滚。
//
// 零常驻：只有打开面板时才创建 DOM/监听/MutationObserver；关闭即全部移除。

import { getConfig } from '../core/config-store';
import { getToastr } from '../core/env';
import { escapeHtml } from '../core/html-escape';
import { ubIcon } from '../core/icons';
import {
  MAP_ORGANIZE_MAX_NODES,
  buildMapOrganizeCatalog,
  normalizeMapOrganizeReply,
  planMapOrganize,
  requestMapOrganize,
  type MapOrganizeCatalog,
  type MapOrganizeNormalized,
  type MapOrganizePlan,
  type MapOrganizePlanItem,
  type MapOrganizeRef,
  type MapOrganizeStep,
} from '../core/map-organize';
import {
  collectDescendantNodeIds,
  deleteMapNodeByNodeId,
  deriveFullPathFromIndex,
  moveMapNodeInStorage,
  normalizeLocationPath,
  readMapNodesBatch,
  readTreeIndex,
  type MapNode,
  type MapTreeIndex,
} from '../core/map-tree-store';
import { listMapSceneImages, type MapSceneImageRecord } from '../core/map-scene-store';
import { mapMergeService } from '../core/map-merge';
import { flushStoryStorage, getCurrentStoryChatKey, getStoryWriteBlockReason } from '../core/story-floor-store';
import { getCurrentDisplayNodeId, isMapGenerating, renameMapNode } from '../core/map-system';
import { syncDarkClass } from './html-builder';

export interface MapOrganizePanelOptions {
  host: HTMLElement;
  /** 执行完成后刷新地图库 / 处理当前显示节点；nextCurrentNodeId 为 null 表示已无对应节点。 */
  onApplied?: (nextCurrentNodeId: string | null) => void | Promise<void>;
}

type PanelPhase = 'loading' | 'results' | 'confirm' | 'applying' | 'done' | 'error' | 'empty';

interface AssetInfo {
  hasMap: boolean;
  hasScene: boolean;
  hasDesc: boolean;
}

interface ApplyResult {
  step: MapOrganizeStep;
  status: 'ok' | 'failed' | 'skipped';
  reason?: string;
}

interface PanelState {
  phase: PanelPhase;
  catalog: MapOrganizeCatalog | null;
  normalized: MapOrganizeNormalized | null;
  plan: MapOrganizePlan | null;
  assets: Map<string, AssetInfo>;
  sceneRecords: MapSceneImageRecord[];
  chatKey: string;
  currentPath: string;
  selected: Set<string>;
  renameValues: Record<string, string>;
  mergeChoices: Record<string, { descriptionSourceId: string; visualSourceId: string }>;
  previewMode: 'before' | 'after';
  mobileTab: 'list' | 'preview';
  applyResults: ApplyResult[];
  nextCurrentNodeId: string | null;
  error: string;
  disposed: boolean;
  abort: AbortController | null;
  /** 递增请求代际：重试时旧请求的迟到结果不得覆盖新状态。 */
  requestSerial: number;
}

let _activeOverlay: HTMLElement | null = null;
let _activeCleanup: (() => void) | null = null;

const OP_LABEL: Record<string, string> = { rename: '改名', move: '移动', merge: '合并', delete: '删除' };
const OP_CLASS: Record<string, string> = { rename: 'rename', move: 'move', merge: 'merge', delete: 'delete' };

function esc(value: unknown): string {
  return escapeHtml(value);
}

function recordHasImage(record: MapSceneImageRecord | null | undefined): boolean {
  return !!record?.imagePath && record.status !== 'cleared' && record.status !== 'failed';
}

function descendantsCount(index: MapTreeIndex, nodeId: string): number {
  return collectDescendantNodeIds(index, nodeId).length;
}

function presetLabel(): string {
  const config = getConfig();
  const presetId = config.assistantApiPresetId;
  const presets = Array.isArray(config.customApiPresets) ? config.customApiPresets : [];
  const exists = !!presetId && presets.some(preset => preset.id === presetId);
  return exists ? '宅仙小助手 API 预设' : '跟随酒馆主 API';
}

function storyWriteBlockMessage(): string | null {
  const block = getStoryWriteBlockReason();
  if (block === 'ready') return null;
  if (block === 'deletion-blocked') return '聊天正在删除/恢复，写入暂时被锁定，请稍后重试。';
  if (block === 'no-coordinator') return '存储写入协调器尚未就绪，请稍后重试。';
  return '聊天存储尚未就绪（可能正在载入或切换聊天），请稍后重试。';
}

function opLabel(op: string): string {
  return OP_LABEL[op] || op;
}

function stepSummary(step: MapOrganizeStep): string {
  if (step.op === 'rename') return `${step.targetPath} → ${step.name || step.targetName}`;
  if (step.op === 'move') return `${step.targetPath} → ${step.parentPath || '根级'}`;
  if (step.op === 'merge') return `${step.sourceName || '节点'} 并入 ${step.targetName}`;
  return `${step.targetPath}（${(step.cascadeNodeIds || []).length || 1} 个节点）`;
}

function resolveNodeByAlias(index: MapTreeIndex, nodeId: string, path: string): string | null {
  if (nodeId && index.nodes[nodeId]) return nodeId;
  const normalized = normalizeLocationPath(path || '');
  if (!normalized) return null;
  const alias = index.locationAliases?.[normalized]?.targetNodeId;
  return alias && index.nodes[alias] ? alias : null;
}

function buildDefaultAssets(index: MapTreeIndex): Map<string, AssetInfo> {
  const out = new Map<string, AssetInfo>();
  for (const [nodeId, node] of Object.entries(index.nodes)) {
    out.set(nodeId, { hasMap: node.status === 'generated', hasScene: false, hasDesc: false });
  }
  return out;
}

function mountOverlayMarkup(): string {
  return `<div class="map-organize-modal" role="dialog" aria-modal="true" aria-labelledby="mapOrgTitle">
    <div class="map-organize-head">
      <span class="map-organize-spark" aria-hidden="true">${ubIcon('sparkle')}</span>
      <div class="map-organize-head-text">
        <div class="map-organize-title" id="mapOrgTitle">AI 地图整理</div>
        <div class="map-organize-sub" id="mapOrgSub">正在读取节点名称与层级…</div>
      </div>
      <button class="map-btn map-organize-close" type="button" data-act="close" title="关闭" aria-label="关闭">${ubIcon('close')}</button>
    </div>
    <div class="map-organize-body" id="mapOrgBody"></div>
  </div>`;
}

/**
 * 打开 AI 地图整理面板。同一时间只允许一个；重复调用会聚焦已有面板。
 */
export function showMapOrganizePanel(opts: MapOrganizePanelOptions): void {
  if (_activeOverlay && _activeOverlay.isConnected) {
    (_activeOverlay.querySelector('.map-organize-close') as HTMLElement | null)?.focus?.();
    return;
  }
  if (_activeOverlay) _activeCleanup?.();
  if (!opts.host) return;

  const overlay = document.createElement('div');
  overlay.className = 'map-organize-overlay';
  overlay.innerHTML = mountOverlayMarkup();
  opts.host.appendChild(overlay);
  syncDarkClass(overlay);
  _activeOverlay = overlay;

  const state: PanelState = {
    phase: 'loading',
    catalog: null,
    normalized: null,
    plan: null,
    assets: new Map(),
    sceneRecords: [],
    chatKey: getCurrentStoryChatKey(),
    currentPath: '',
    selected: new Set(),
    renameValues: {},
    mergeChoices: {},
    previewMode: 'after',
    mobileTab: 'list',
    applyResults: [],
    nextCurrentNodeId: null,
    error: '',
    disposed: false,
    abort: null,
    requestSerial: 0,
  };

  const body = overlay.querySelector('#mapOrgBody') as HTMLElement;
  const sub = overlay.querySelector('#mapOrgSub') as HTMLElement;
  const closeBtn = overlay.querySelector('.map-organize-close') as HTMLButtonElement;
  const aiBtn = document.getElementById('ac-map-organize-btn') as HTMLButtonElement | null;
  const popup = opts.host.closest('.map-popup') as HTMLElement | null;
  if (aiBtn) aiBtn.disabled = true;
  // 地图弹窗平时按内容自适应高度；整理面板需要完整高度，打开期间让整个弹窗定高（关闭即恢复）。
  popup?.classList.add('map-organize-open');

  const cleanup = (): void => {
    if (state.disposed) return;
    state.disposed = true;
    state.abort?.abort();
    document.removeEventListener('keydown', onKey, true);
    observer?.disconnect();
    if (overlay.parentElement) overlay.remove();
    popup?.classList.remove('map-organize-open');
    if (_activeOverlay === overlay) {
      _activeOverlay = null;
      _activeCleanup = null;
    }
    const button = document.getElementById('ac-map-organize-btn') as HTMLButtonElement | null;
    if (button) button.disabled = false;
    button?.focus?.();
  };
  _activeCleanup = cleanup;

  const close = (): void => {
    if (state.phase === 'applying') return;
    cleanup();
  };

  let observer: MutationObserver | null = null;
  let onKey: (event: KeyboardEvent) => void = () => {};
  onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    // 捕获阶段先于 html-builder 的全局 ESC（它会把整个地图弹窗关掉）；面板开着时 ESC 只归面板。
    event.preventDefault();
    event.stopImmediatePropagation();
    if (state.phase !== 'applying') close();
  };
  document.addEventListener('keydown', onKey, true);

  observer = new MutationObserver(() => {
    if (!overlay.isConnected) cleanup();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const updateSubtitle = (): void => {
    if (!sub) return;
    if (state.phase === 'loading') {
      sub.textContent = `正在读取节点名称与层级 · ${presetLabel()}`;
      return;
    }
    const count = state.catalog?.refs.length ?? 0;
    const preset = presetLabel();
    sub.textContent = count
      ? `仅发送 ${count} 个节点的名称与层级 · ${preset}`
      : preset;
  };

  const buildPlan = (): MapOrganizePlan => {
    if (!state.catalog || !state.normalized) {
      return {
        items: [], steps: [], finalIndex: state.catalog?.index || ({} as MapTreeIndex),
        preview: { finalIndex: {} as MapTreeIndex, renamed: {}, moved: {}, received: {}, removed: [] },
        counts: { rename: 0, move: 0, merge: 0, delete: 0 }, summary: '',
      };
    }
    return planMapOrganize(state.catalog, state.normalized, {
      selected: state.selected,
      renameValues: state.renameValues,
      mergeChoices: state.mergeChoices,
    });
  };

  const loadAssets = async (normalized: MapOrganizeNormalized): Promise<void> => {
    const catalog = state.catalog!;
    const sceneRecords = await listMapSceneImages();
    const sceneSet = new Set(sceneRecords.filter(recordHasImage).map(record => record.nodeId));
    const mergeIds = new Set<string>();
    for (const suggestion of normalized.suggestions) {
      if (suggestion.op !== 'merge') continue;
      mergeIds.add(suggestion.target.nodeId);
      if (suggestion.source) mergeIds.add(suggestion.source.nodeId);
    }
    let mapNodes: Record<string, MapNode> = {};
    if (mergeIds.size > 0) {
      try {
        mapNodes = readMapNodesBatch(Array.from(mergeIds));
      } catch (_e) {
        mapNodes = {};
      }
    }
    const assets = new Map<string, AssetInfo>();
    for (const ref of catalog.refs) {
      const desc = mapNodes[ref.nodeId]?.explorationDesc;
      assets.set(ref.nodeId, {
        hasMap: catalog.index.nodes[ref.nodeId]?.status === 'generated',
        hasScene: sceneSet.has(ref.nodeId),
        hasDesc: !!(desc && ((desc.summary || '').trim() || (desc.items || []).length > 0 || (desc.directions || '').trim())),
      });
    }
    state.assets = assets;
    state.sceneRecords = sceneRecords;
  };

  const initializeChoices = (normalized: MapOrganizeNormalized): void => {
    const renameValues: Record<string, string> = {};
    const mergeChoices: Record<string, { descriptionSourceId: string; visualSourceId: string }> = {};
    for (const suggestion of normalized.suggestions) {
      if (suggestion.op === 'rename') {
        renameValues[suggestion.id] = suggestion.name || suggestion.target.name;
        continue;
      }
      if (suggestion.op !== 'merge' || !suggestion.source) continue;
      const targetAsset = state.assets.get(suggestion.target.nodeId);
      const sourceAsset = state.assets.get(suggestion.source.nodeId);
      let visualSourceId = suggestion.target.nodeId;
      if (!targetAsset?.hasMap && sourceAsset?.hasMap) visualSourceId = suggestion.source.nodeId;
      else if (!targetAsset?.hasMap && !targetAsset?.hasScene && sourceAsset?.hasScene) visualSourceId = suggestion.source.nodeId;
      let descriptionSourceId = suggestion.target.nodeId;
      if (!targetAsset?.hasDesc && sourceAsset?.hasDesc) descriptionSourceId = suggestion.source.nodeId;
      mergeChoices[suggestion.id] = { descriptionSourceId, visualSourceId };
    }
    state.renameValues = renameValues;
    state.mergeChoices = mergeChoices;
  };

  const start = async (): Promise<void> => {
    const serial = ++state.requestSerial;
    state.abort?.abort();
    const controller = new AbortController();
    state.abort = controller;
    state.phase = 'loading';
    state.catalog = null;
    state.normalized = null;
    state.plan = null;
    state.error = '';
    state.selected = new Set();
    state.renameValues = {};
    state.mergeChoices = {};
    state.assets = new Map();
    state.sceneRecords = [];
    state.applyResults = [];
    state.nextCurrentNodeId = null;
    state.previewMode = 'after';
    state.mobileTab = 'list';
    state.currentPath = '';
    updateSubtitle();
    render();
    try {
      if (!getConfig().mapEnabled) throw new Error('地图功能未启用，请先在设置中开启地图功能。');
      if (isMapGenerating()) throw new Error('地图正在生成，请等生成结束后再整理。');
      const writeBlock = storyWriteBlockMessage();
      if (writeBlock) throw new Error(writeBlock);
      state.chatKey = getCurrentStoryChatKey();
      const index = await readTreeIndex();
      if (state.disposed || serial !== state.requestSerial || controller.signal.aborted) return;
      if (getCurrentStoryChatKey() !== state.chatKey) throw new Error('聊天已切换，请重新整理。');
      const currentId = getCurrentDisplayNodeId();
      const catalog = buildMapOrganizeCatalog(index, currentId);
      if (catalog.refs.length === 0) {
        state.phase = 'empty';
        state.error = '地图库为空，暂无可整理的节点。';
        render();
        return;
      }
      if (catalog.refs.length > MAP_ORGANIZE_MAX_NODES) {
        state.phase = 'error';
        state.error = `节点过多（${catalog.refs.length} > ${MAP_ORGANIZE_MAX_NODES}），请先手动清理后再整理。`;
        render();
        return;
      }
      state.catalog = catalog;
      state.chatKey = getCurrentStoryChatKey();
      state.currentPath = catalog.refs.find(ref => ref.nodeId === catalog.currentNodeId)?.path || '';
      updateSubtitle();
      render();

      const reply = await requestMapOrganize(catalog, controller.signal);
      if (state.disposed || serial !== state.requestSerial || controller.signal.aborted) return;
      if (getCurrentStoryChatKey() !== state.chatKey) throw new Error('聊天已切换，请重新整理。');
      const normalized = normalizeMapOrganizeReply(reply, catalog);
      state.normalized = normalized;

      if (normalized.suggestions.length === 0) {
        state.phase = 'empty';
        state.error = normalized.ignored.length
          ? `AI 没有给出可应用的建议；另有 ${normalized.ignored.length} 条因格式或节点不存在被忽略。`
          : 'AI 认为当前的层级与命名没有需要调整的地方。';
        render();
        return;
      }

      try {
        await loadAssets(normalized);
      } catch (e) {
        console.warn('[map-organize] 读取地图资源状态失败，按索引状态降级:', e);
        state.assets = buildDefaultAssets(catalog.index);
      }
      if (state.disposed || serial !== state.requestSerial) return;
      if (getCurrentStoryChatKey() !== state.chatKey) throw new Error('聊天已切换，请重新整理。');
      initializeChoices(normalized);
      const initialPlan = buildPlan();
      state.selected = new Set(
        initialPlan.items
          .filter(item => item.valid && (item.suggestion.op === 'rename' || item.suggestion.op === 'move'))
          .map(item => item.suggestion.id),
      );
      state.plan = buildPlan();
      state.phase = 'results';
      render();
    } catch (error) {
      if (state.disposed || serial !== state.requestSerial) return;
      state.phase = 'error';
      state.error = error instanceof Error ? error.message : String(error || '整理失败');
      render();
    }
  };

  const countsHTML = (plan: MapOrganizePlan): string => {
    const invalid = plan.items.filter(item => !item.valid).length;
    return [
      `<span class="map-organize-count rename">改名 <b>${plan.counts.rename}</b></span>`,
      `<span class="map-organize-count move">移动 <b>${plan.counts.move}</b></span>`,
      `<span class="map-organize-count merge">合并 <b>${plan.counts.merge}</b></span>`,
      `<span class="map-organize-count delete">删除 <b>${plan.counts.delete}</b></span>`,
      invalid ? `<span class="map-organize-count bad">不可执行 <b>${invalid}</b></span>` : '',
    ].join('');
  };

  const footText = (plan: MapOrganizePlan): string => {
    if (plan.steps.length === 0) return '尚未选择任何变更';
    const destructive = plan.counts.merge + plan.counts.delete;
    if (destructive > 0) {
      return `已选 <b>${plan.steps.length}</b> 项 · <span class="danger">含 ${plan.counts.merge} 组合并 / ${plan.counts.delete} 项删除</span>`;
    }
    return `已选 <b>${plan.steps.length}</b> 项 · 无破坏性操作`;
  };

  const assetText = (ref: MapOrganizeRef): string => {
    const asset = state.assets.get(ref.nodeId);
    if (!asset) return '状态未知';
    const bits = [asset.hasMap ? '有地图' : '无地图', asset.hasScene ? '有场景图' : '无场景图'];
    if (asset.hasDesc) bits.push('有描述');
    return bits.join(' · ');
  };

  const riskTags = (item: MapOrganizePlanItem): string => {
    const suggestion = item.suggestion;
    const cascade = suggestion.op === 'delete'
      ? (item.cascadeNodeIds || [suggestion.target.nodeId])
      : suggestion.op === 'merge' && suggestion.source
        ? [suggestion.target.nodeId, suggestion.source.nodeId]
        : [suggestion.target.nodeId];
    const maps = cascade.filter(nodeId => state.assets.get(nodeId)?.hasMap).length;
    const scenes = cascade.filter(nodeId => state.assets.get(nodeId)?.hasScene).length;
    const tags: string[] = [];
    if (maps) tags.push(`<span class="map-organize-tag map">含 ${maps} 张地图</span>`);
    if (scenes) tags.push(`<span class="map-organize-tag scene">含 ${scenes} 张场景图</span>`);
    const children = suggestion.op === 'delete'
      ? Math.max(0, (item.cascadeNodeIds?.length || 1) - 1)
      : suggestion.op === 'move'
        ? descendantsCount(state.catalog!.index, suggestion.target.nodeId)
        : suggestion.op === 'merge' && suggestion.source
          ? descendantsCount(state.catalog!.index, suggestion.source.nodeId)
          : 0;
    if (children) tags.push(`<span class="map-organize-tag children">${suggestion.op === 'merge' ? '并入 ' : '含 '}${children} 个子节点</span>`);
    const currentId = state.catalog?.currentNodeId;
    const current = currentId ? cascade.includes(currentId) : false;
    if (current) tags.push('<span class="map-organize-tag current">当前地点</span>');
    return tags.join('');
  };

  const deleteImpactHTML = (item: MapOrganizePlanItem): string => {
    const cascade = item.cascadeNodeIds || [item.suggestion.target.nodeId];
    const maps = cascade.filter(nodeId => state.assets.get(nodeId)?.hasMap).length;
    const scenes = cascade.filter(nodeId => state.assets.get(nodeId)?.hasScene).length;
    return [
      `<span class="map-organize-pill">删除 ${cascade.length} 个节点</span>`,
      maps ? `<span class="map-organize-pill">含 ${maps} 张地图</span>` : '<span class="map-organize-pill gray">无地图</span>',
      scenes ? `<span class="map-organize-pill">含 ${scenes} 张场景图</span>` : '',
    ].join('');
  };

  const cardHTML = (item: MapOrganizePlanItem): string => {
    const suggestion = item.suggestion;
    const disabled = !item.valid;
    const checked = item.selected && !disabled;
    const cls = ['map-organize-card', checked ? 'on' : '', disabled ? 'disabled invalid' : ''].filter(Boolean).join(' ');
    const target = suggestion.target;
    let title = '';
    let extra = '';
    if (suggestion.op === 'rename') {
      const value = state.renameValues[suggestion.id] ?? suggestion.name ?? '';
      const inlineError = !item.valid && item.reason
        ? `<span class="map-organize-tag bad map-organize-input-error">${esc(item.reason)}</span>`
        : '';
      title = `<span class="old">${esc(target.name)}</span><span class="arrow">→</span><input class="map-organize-input" data-rename="${esc(suggestion.id)}" value="${esc(value)}" maxlength="20" aria-label="新名称">${inlineError}`;
      extra = `<div class="map-organize-path" data-path="${esc(suggestion.id)}">${esc(target.path)}${item.valid ? `<span class="to"> → ${esc(value)}</span>` : ''}</div>`;
    } else if (suggestion.op === 'move') {
      const parentName = suggestion.parent ? suggestion.parent.name : '根级';
      const newPath = suggestion.parent ? `${suggestion.parent.path}-${target.name}` : target.name;
      title = `<span class="old">${esc(target.name)}</span><span class="arrow">→</span><span class="new">${esc(parentName)}</span>`;
      extra = `<div class="map-organize-path">${esc(target.path)}<span class="to"> → ${esc(newPath)}</span></div>`;
    } else if (suggestion.op === 'merge') {
      const source = suggestion.source!;
      const choice = state.mergeChoices[suggestion.id] || { descriptionSourceId: target.nodeId, visualSourceId: target.nodeId };
      const visualOptions = [target, source].map(ref => `<label><input type="radio" name="v:${esc(suggestion.id)}" value="${esc(ref.nodeId)}" ${choice.visualSourceId === ref.nodeId ? 'checked' : ''} ${disabled ? 'disabled' : ''}>保留「${esc(ref.name)}」</label>`).join('');
      const descOptions = [target, source].map(ref => `<label><input type="radio" name="d:${esc(suggestion.id)}" value="${esc(ref.nodeId)}" ${choice.descriptionSourceId === ref.nodeId ? 'checked' : ''} ${disabled ? 'disabled' : ''}>保留「${esc(ref.name)}」</label>`).join('');
      title = `<span class="old">${esc(source.name)}</span><span class="arrow">并入</span><span class="new">${esc(target.name)}</span>`;
      extra = `<div class="map-organize-merge-line">
          <div class="map-organize-merge-node src"><span class="nm">${esc(source.name)}</span><span class="st">${esc(assetText(source))}</span></div>
          <div class="map-organize-merge-arrow">→</div>
          <div class="map-organize-merge-node dst"><span class="nm">${esc(target.name)}</span><span class="st">${esc(assetText(target))}</span></div>
        </div>
        <div class="map-organize-choice"><span>保留地图/场景图：</span>${visualOptions}</div>
        <div class="map-organize-choice"><span>保留描述：</span>${descOptions}</div>`;
    } else {
      title = `<span class="old">${esc(target.name)}</span>`;
      extra = `<div class="map-organize-path">${esc(target.path)}</div>
        <div class="map-organize-impact" data-impact="${esc(suggestion.id)}">${deleteImpactHTML(item)}</div>`;
    }
    const errorTag = !item.valid && item.reason && suggestion.op !== 'rename'
      ? `<div class="map-organize-note bad">${esc(item.reason)}</div>`
      : '';
    const statusTag = disabled
      ? '<span class="map-organize-tag bad">不可执行</span>'
      : (suggestion.op === 'rename' || suggestion.op === 'move' ? '<span class="map-organize-tag ok">安全项</span>' : '<span class="map-organize-tag">需确认</span>');
    return `<div class="${cls}" data-card="${esc(suggestion.id)}">
      <input class="map-organize-check" type="checkbox" data-check="${esc(suggestion.id)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} aria-label="${esc(opLabel(suggestion.op))}">
      <div class="map-organize-main">
        <div class="map-organize-card-top"><span class="map-organize-op ${esc(OP_CLASS[suggestion.op] || '')}">${esc(opLabel(suggestion.op))}</span><div class="map-organize-title-text">${title}</div></div>
        ${extra}
        <div class="map-organize-reason"><b>AI：</b>${esc(suggestion.reason || '未说明原因')}</div>
        <div class="map-organize-meta">${riskTags(item)}${statusTag}</div>
        ${errorTag}
      </div>
    </div>`;
  };

  const nearestLiveParent = (index: MapTreeIndex, catalog: MapOrganizeCatalog, parentId: string | null): string | null => {
    let current = parentId;
    const guard = new Set<string>();
    while (current && !guard.has(current)) {
      guard.add(current);
      if (index.nodes[current]) return current;
      const ref = catalog.refsByNodeId.get(current);
      if (!ref) return null;
      const alias = index.locationAliases?.[normalizeLocationPath(ref.path)]?.targetNodeId;
      if (alias && index.nodes[alias]) return alias;
      current = ref.parentId;
    }
    return null;
  };

  const beforeTreeHTML = (): string => {
    const catalog = state.catalog!;
    const rows: string[] = [];
    const walk = (nodeId: string, depth: number): void => {
      const node = catalog.index.nodes[nodeId];
      if (!node) return;
      rows.push(`<div class="map-organize-preview-row" style="--depth:${depth}"><span class="map-organize-indent"></span><span class="map-organize-preview-name">${esc(node.name)}</span></div>`);
      for (const childId of node.childIds) walk(childId, depth + 1);
    };
    for (const rootId of catalog.index.rootNodeIds) walk(rootId, 0);
    return rows.join('') || '<div class="map-organize-preview-row"><span class="map-organize-preview-note">暂无节点</span></div>';
  };

  const previewHTML = (plan: MapOrganizePlan): string => {
    const catalog = state.catalog!;
    const isBefore = state.previewMode === 'before';
    if (isBefore) {
      return `<div class="map-organize-preview-head"><span>变更预览</span><div class="map-organize-seg">
          <button class="map-btn on" type="button" data-pv="before">当前</button>
          <button class="map-btn" type="button" data-pv="after">整理后</button>
        </div></div>
        <div class="map-organize-tree">${beforeTreeHTML()}</div>
        <div class="map-organize-preview-legend"><span><span class="map-organize-preview-badge rename">改</span> 改名</span><span><span class="map-organize-preview-badge move">移</span> 移动</span><span><span class="map-organize-preview-badge merge">并</span> 合并</span><span><span class="map-organize-preview-badge delete">删</span> 删除</span></div>`;
    }
    const index = plan.finalIndex;
    const rows: string[] = [];
    const ghostsByParent = new Map<string, typeof plan.preview.removed>();
    for (const removed of plan.preview.removed) {
      const parentId = nearestLiveParent(index, catalog, removed.originalParentId);
      const key = parentId || '__root__';
      const list = ghostsByParent.get(key) || [];
      list.push(removed);
      ghostsByParent.set(key, list);
    }
    const orderOf = (nodeId: string, fallback: number): number => catalog.refsByNodeId.get(nodeId)?.order ?? fallback;
    const walk = (nodeId: string, depth: number): void => {
      const node = index.nodes[nodeId];
      if (!node) return;
      const renamed = plan.preview.renamed[nodeId];
      const moved = plan.preview.moved[nodeId];
      const received = plan.preview.received[nodeId] || [];
      const badges: string[] = [];
      let name = esc(node.name);
      if (renamed) {
        name = `<span class="old">${esc(renamed.from)}</span> → <span class="new">${esc(renamed.to)}</span>`;
        badges.push('<span class="map-organize-preview-badge rename">改</span>');
      }
      if (moved) badges.push('<span class="map-organize-preview-badge move">移</span>');
      if (received.length) badges.push('<span class="map-organize-preview-badge merge">并</span>');
      let note = '';
      if (moved) {
        const fromName = moved.fromParentId
          ? (plan.preview.renamed[moved.fromParentId]?.to || catalog.refsByNodeId.get(moved.fromParentId)?.name || '其他节点')
          : '根级';
        note = `移自 ${fromName}`;
      } else if (received.length) {
        note = `接收 ${received.join('、')}`;
      }
      rows.push(`<div class="map-organize-preview-row" style="--depth:${depth}"><span class="map-organize-indent"></span>${badges.join('')}<span class="map-organize-preview-name" title="${esc(deriveFullPathFromIndex(index, nodeId))}">${name}</span>${note ? `<span class="map-organize-preview-note">${esc(note)}</span>` : ''}</div>`);
      const items: Array<{ kind: 'live'; id: string; order: number } | { kind: 'ghost'; removed: typeof plan.preview.removed[number]; order: number }> = [
        ...node.childIds.map((childId, childIndex) => ({ kind: 'live' as const, id: childId, order: orderOf(childId, childIndex) })),
        ...(ghostsByParent.get(nodeId) || []).map(removed => ({ kind: 'ghost' as const, removed, order: removed.order })),
      ];
      items.sort((a, b) => a.order - b.order);
      for (const item of items) {
        if (item.kind === 'live') walk(item.id, depth + 1);
        else {
          const badge = item.removed.kind === 'merge' ? 'merge' : 'delete';
          rows.push(`<div class="map-organize-preview-row ghost" style="--depth:${depth + 1}"><span class="map-organize-indent"></span><span class="map-organize-preview-badge ${badge}">${item.removed.kind === 'merge' ? '并' : '删'}</span><span class="map-organize-preview-name">${esc(item.removed.name)}</span><span class="map-organize-preview-note">${esc(item.removed.note)}</span></div>`);
        }
      }
    };
    const rootItems: Array<{ kind: 'live'; id: string; order: number } | { kind: 'ghost'; removed: typeof plan.preview.removed[number]; order: number }> = [
      ...index.rootNodeIds.map((nodeId, rootIndex) => ({ kind: 'live' as const, id: nodeId, order: orderOf(nodeId, rootIndex) })),
      ...(ghostsByParent.get('__root__') || []).map(removed => ({ kind: 'ghost' as const, removed, order: removed.order })),
    ];
    rootItems.sort((a, b) => a.order - b.order);
    for (const item of rootItems) {
      if (item.kind === 'live') walk(item.id, 0);
      else {
        const badge = item.removed.kind === 'merge' ? 'merge' : 'delete';
        rows.push(`<div class="map-organize-preview-row ghost" style="--depth:0"><span class="map-organize-indent"></span><span class="map-organize-preview-badge ${badge}">${item.removed.kind === 'merge' ? '并' : '删'}</span><span class="map-organize-preview-name">${esc(item.removed.name)}</span><span class="map-organize-preview-note">${esc(item.removed.note)}</span></div>`);
      }
    }
    return `<div class="map-organize-preview-head"><span>变更预览</span><div class="map-organize-seg">
        <button class="map-btn" type="button" data-pv="before">当前</button>
        <button class="map-btn on" type="button" data-pv="after">整理后</button>
      </div></div>
      <div class="map-organize-tree">${rows.join('') || '<div class="map-organize-preview-row"><span class="map-organize-preview-note">暂无节点</span></div>'}</div>
      <div class="map-organize-preview-legend"><span><span class="map-organize-preview-badge rename">改</span> 改名</span><span><span class="map-organize-preview-badge move">移</span> 移动</span><span><span class="map-organize-preview-badge merge">并</span> 合并</span><span><span class="map-organize-preview-badge delete">删</span> 删除</span></div>`;
  };

  const renderLoading = (): void => {
    body.innerHTML = `<div class="map-organize-state">
      <div class="map-organize-spinner"></div>
      <h3>正在让 AI 审阅地图结构…</h3>
      <p>本次只发送节点名称、层级与当前地点；不发送地图画面、描述或剧情内容。</p>
      <p class="map-organize-state-sub">使用 ${esc(presetLabel())}。</p>
      <button class="map-btn map-organize-btn" type="button" data-act="cancel">取消</button>
    </div>`;
  };

  const renderError = (): void => {
    body.innerHTML = `<div class="map-organize-state">
      <div class="map-organize-state-icon">${ubIcon('warning')}</div>
      <h3>整理没有完成</h3>
      <p>${esc(state.error || '未知错误')}</p>
      <div class="map-organize-state-actions">
        <button class="map-btn map-organize-btn" type="button" data-act="close">关闭</button>
        <button class="map-btn map-organize-btn primary" type="button" data-act="retry">重试</button>
      </div>
    </div>`;
  };

  const renderEmpty = (): void => {
    body.innerHTML = `<div class="map-organize-state">
      <div class="map-organize-state-icon">${ubIcon('info')}</div>
      <h3>没有需要执行的变更</h3>
      <p>${esc(state.error || 'AI 认为当前结构合理。')}</p>
      <div class="map-organize-state-actions">
        <button class="map-btn map-organize-btn" type="button" data-act="close">关闭</button>
        <button class="map-btn map-organize-btn primary" type="button" data-act="retry">重新整理</button>
      </div>
    </div>`;
  };

  const renderResults = (): void => {
    const plan = buildPlan();
    state.plan = plan;
    const ignored = state.normalized?.ignored.length || 0;
    const truncated = state.normalized?.truncated === true;
    const destructive = plan.counts.merge + plan.counts.delete;
    body.innerHTML = `<div class="map-organize-summary">
        <div class="map-organize-judgement"><b>AI 判断：</b>${esc(plan.summary)}</div>
        <div class="map-organize-counts">${countsHTML(plan)}</div>
        ${ignored || truncated ? `<div class="map-organize-summary-note">${truncated ? 'AI 建议过多，已截断到上限。' : ''}${ignored ? ` 有 ${ignored} 条建议因节点不存在或格式不合法被忽略。` : ''}</div>` : ''}
      </div>
      <div class="map-organize-toolbar">
        <span class="map-organize-hint">改名 / 移动默认勾选；合并 / 删除请逐项确认。</span>
        <button class="map-btn map-organize-tool" type="button" data-act="safe">全选安全项</button>
        <button class="map-btn map-organize-tool" type="button" data-act="none">全不选</button>
      </div>
      <div class="map-organize-tabs">
        <button type="button" data-tab="list" class="${state.mobileTab === 'list' ? 'on' : ''}">建议 ${plan.items.length}</button>
        <button type="button" data-tab="preview" class="${state.mobileTab === 'preview' ? 'on' : ''}">变更预览</button>
      </div>
      <div class="map-organize-cols" data-tab="${state.mobileTab}">
        <div class="map-organize-list" id="mapOrgList">${plan.items.map(item => cardHTML(item)).join('')}</div>
        <aside class="map-organize-preview" id="mapOrgPreview">${previewHTML(plan)}</aside>
      </div>
      <div class="map-organize-foot">
        <span class="map-organize-selected" id="mapOrgSelected">${footText(plan)}</span>
        <button class="map-btn map-organize-btn" type="button" data-act="cancel">取消</button>
        <button class="map-btn map-organize-btn ${destructive ? 'danger' : 'primary'}" type="button" data-act="apply" ${plan.steps.length ? '' : 'disabled'}>应用变更${plan.steps.length ? `（${plan.steps.length}）` : ''}</button>
      </div>`;
  };

  const renderConfirm = (): void => {
    const plan = state.plan || buildPlan();
    const deletes = plan.steps.filter(step => step.op === 'delete');
    const merges = plan.steps.filter(step => step.op === 'merge');
    const cascadeIds = Array.from(new Set(deletes.flatMap(step => step.cascadeNodeIds || [])));
    const maps = cascadeIds.filter(nodeId => state.assets.get(nodeId)?.hasMap).length;
    const scenes = cascadeIds.filter(nodeId => state.assets.get(nodeId)?.hasScene).length;
    const destructive = deletes.length + merges.length > 0;
    body.innerHTML = `<div class="map-organize-confirm">
      <h3>确认应用 ${plan.steps.length} 项变更？</h3>
      <p>${destructive ? '本次包含破坏性操作，执行后无法一键撤销。' : '本次只有改名与移动，风险较低。'}</p>
      <div class="map-organize-confirm-list">
        ${plan.steps.map(step => `<div class="map-organize-confirm-row ${step.op === 'delete' ? 'bad' : step.op === 'merge' ? 'warn' : ''}"><span class="dot"></span><span><b>${esc(opLabel(step.op))}</b> · ${esc(stepSummary(step))}</span></div>`).join('')}
      </div>
      ${deletes.length ? `<div class="map-organize-note bad">删除影响：<b>${cascadeIds.length}</b> 个节点${maps ? `，含 <b>${maps}</b> 张地图` : ''}${scenes ? `，含 <b>${scenes}</b> 张场景图` : ''}。删除会连同子树一起移除。</div>` : ''}
      ${merges.length ? '<div class="map-organize-note warn">合并影响：被并节点的地图/场景图会按你选择的来源保留；未被选中的一侧会被丢弃。</div>' : ''}
      <div class="map-organize-confirm-actions">
        <button class="map-btn map-organize-btn" type="button" data-act="back">返回检查</button>
        <button class="map-btn map-organize-btn ${destructive ? 'danger' : 'primary'}" type="button" data-act="confirmApply">确认应用</button>
      </div>
    </div>`;
  };

  const renderApplying = (): void => {
    if (!state.plan) return;
    const steps = state.plan.steps;
    const results = state.applyResults;
    const total = steps.length;
    const pct = total ? Math.round((results.length / total) * 100) : 0;
    body.innerHTML = `<div class="map-organize-progress">
      <h3>正在应用 ${Math.min(results.length, total)}/${total}…</h3>
      <div class="map-organize-bar"><i style="width:${pct}%"></i></div>
      <div class="map-organize-steps">
        ${steps.map((step, index) => {
          const result = results[index];
          const cls = result?.status === 'failed' ? 'failed' : result?.status === 'skipped' ? 'skipped' : result ? 'done' : index === results.length ? 'doing' : '';
          const mark = result?.status === 'ok' ? '✓' : result?.status === 'failed' ? '×' : result?.status === 'skipped' ? '–' : index === results.length ? '' : String(index + 1);
          return `<div class="map-organize-step ${cls}"><span class="map-organize-step-mk">${mark}</span><span>${esc(opLabel(step.op))} · ${esc(stepSummary(step))}</span></div>`;
        }).join('')}
      </div>
      <p class="map-organize-state-sub">逐项复用现有地图写原语；任一步失败会停止后续操作，已成功的项不会回滚。执行中不可关闭。</p>
    </div>`;
  };

  const renderDone = (): void => {
    const results = state.applyResults;
    const steps = state.plan?.steps || [];
    const okCount = results.filter(result => result.status === 'ok').length;
    const failed = results.find(result => result.status === 'failed');
    const skipped = results.filter(result => result.status === 'skipped').length;
    const notRun = steps.slice(results.length);
    body.innerHTML = `<div class="map-organize-done">
      <div class="map-organize-done-icon ${failed ? 'warn' : ''}">${failed ? ubIcon('warning') : ubIcon('check')}</div>
      <h3>${failed ? '部分变更已应用' : `已应用 ${okCount} 项变更`}</h3>
      <p>${failed ? '执行在中途失败，已成功的项不会回滚。' : '地图库已刷新；当前地点已根据整理结果重新定位。'}</p>
      <div class="map-organize-done-list">
        ${results.map(result => `<div class="map-organize-done-row ${result.status}"><span class="mk">${result.status === 'ok' ? '✓' : result.status === 'failed' ? '×' : '–'}</span><span>${esc(opLabel(result.step.op))} · ${esc(stepSummary(result.step))}${result.reason ? `<br><span class="reason">${esc(result.reason)}</span>` : ''}</span></div>`).join('')}
        ${notRun.length ? `<div class="map-organize-done-row skipped"><span class="mk">–</span><span>未执行 ${notRun.length} 项（因前一步失败而停止）</span></div>` : ''}
      </div>
      ${skipped ? `<p class="map-organize-state-sub">有 ${skipped} 项因节点已不存在被跳过。</p>` : ''}
      <div class="map-organize-state-actions">
        <button class="map-btn map-organize-btn ${failed ? '' : 'primary'}" type="button" data-act="done">完成</button>
        ${failed ? '<button class="map-btn map-organize-btn primary" type="button" data-act="retry">重新整理</button>' : ''}
      </div>
    </div>`;
  };

  const render = (): void => {
    if (state.disposed) return;
    updateSubtitle();
    if (closeBtn) closeBtn.disabled = state.phase === 'applying';
    if (state.phase === 'loading') renderLoading();
    else if (state.phase === 'error') renderError();
    else if (state.phase === 'empty') renderEmpty();
    else if (state.phase === 'results') renderResults();
    else if (state.phase === 'confirm') renderConfirm();
    else if (state.phase === 'applying') renderApplying();
    else if (state.phase === 'done') renderDone();
  };

  const refreshDerived = (): void => {
    if (state.phase !== 'results') return;
    const plan = buildPlan();
    state.plan = plan;
    const counts = document.querySelector('.map-organize-counts');
    if (counts) counts.innerHTML = countsHTML(plan);
    const preview = document.getElementById('mapOrgPreview');
    if (preview) {
      const scroll = preview.scrollTop;
      preview.innerHTML = previewHTML(plan);
      preview.scrollTop = scroll;
    }
    const selected = document.getElementById('mapOrgSelected');
    if (selected) selected.innerHTML = footText(plan);
    const apply = body.querySelector('[data-act="apply"]') as HTMLButtonElement | null;
    if (apply) {
      const destructive = plan.counts.merge + plan.counts.delete;
      apply.disabled = plan.steps.length === 0;
      apply.textContent = `应用变更${plan.steps.length ? `（${plan.steps.length}）` : ''}`;
      apply.classList.toggle('danger', destructive > 0);
      apply.classList.toggle('primary', destructive === 0);
    }
    for (const item of plan.items) {
      const suggestion = item.suggestion;
      const card = body.querySelector(`[data-card="${suggestion.id}"]`) as HTMLElement | null;
      const check = body.querySelector(`[data-check="${suggestion.id}"]`) as HTMLInputElement | null;
      if (card) {
        card.classList.toggle('on', item.selected && item.valid);
        card.classList.toggle('disabled', !item.valid);
        card.classList.toggle('invalid', !item.valid);
        const meta = card.querySelector('.map-organize-meta');
        if (meta) {
          const statusTag = !item.valid
            ? '<span class="map-organize-tag bad">不可执行</span>'
            : (suggestion.op === 'rename' || suggestion.op === 'move' ? '<span class="map-organize-tag ok">安全项</span>' : '<span class="map-organize-tag">需确认</span>');
          meta.innerHTML = riskTags(item) + statusTag;
        }
        const impact = card.querySelector('[data-impact]');
        if (impact) impact.innerHTML = deleteImpactHTML(item);
        const path = card.querySelector('[data-path]');
        if (path && suggestion.op === 'rename') {
          const value = state.renameValues[suggestion.id] ?? suggestion.name ?? '';
          path.innerHTML = `${esc(suggestion.target.path)}${item.valid ? `<span class="to"> → ${esc(value)}</span>` : ''}`;
        }
        const input = card.querySelector('[data-rename]') as HTMLInputElement | null;
        if (input) {
          let error = card.querySelector('.map-organize-input-error') as HTMLElement | null;
          if (!item.valid && item.reason) {
            if (!error) {
              error = document.createElement('span');
              error.className = 'map-organize-tag bad map-organize-input-error';
              input.after(error);
            }
            error.textContent = item.reason;
          } else if (error) {
            error.remove();
          }
        }
        const radios = card.querySelectorAll('input[type=radio]');
        radios.forEach(radio => { (radio as HTMLInputElement).disabled = !item.valid; });
      }
      if (check) {
        check.checked = item.selected && item.valid;
        check.disabled = !item.valid;
      }
    }
    document.querySelectorAll('[data-pv]').forEach(button => {
      button.classList.toggle('on', (button as HTMLElement).dataset.pv === state.previewMode);
    });
  };

  const rerenderPreserveScroll = (): void => {
    const list = document.getElementById('mapOrgList');
    const preview = document.getElementById('mapOrgPreview');
    const listScroll = list ? list.scrollTop : 0;
    const previewScroll = preview ? preview.scrollTop : 0;
    render();
    const nextList = document.getElementById('mapOrgList');
    const nextPreview = document.getElementById('mapOrgPreview');
    if (nextList) nextList.scrollTop = listScroll;
    if (nextPreview) nextPreview.scrollTop = previewScroll;
  };

  const resolveCurrentAfter = (index: MapTreeIndex): string | null => {
    const catalog = state.catalog;
    if (!catalog || !catalog.currentNodeId) return null;
    if (index.nodes[catalog.currentNodeId]) return catalog.currentNodeId;
    const direct = resolveNodeByAlias(index, catalog.currentNodeId, state.currentPath);
    if (direct) return direct;
    const currentRef = catalog.refsByNodeId.get(catalog.currentNodeId);
    // 合并源被吞并时，其子节点会迁到保留节点下但 planMapNodeMerge 不给子节点补旧路径别名；
    // 先看“旧父级现在解析到谁”，再在它下面按名称找回当前节点。仅在父级确实被合并时做，
    // 避免“当前节点被单独删除、父级下恰好有同名兄弟”时误认。
    const parentWasMerged = !!currentRef?.parentId
      && !!state.plan?.preview.removed.some(removed => removed.nodeId === currentRef.parentId && removed.kind === 'merge');
    if (parentWasMerged && currentRef?.parentId) {
      const parentRef = catalog.refsByNodeId.get(currentRef.parentId);
      const parentResolved = resolveNodeByAlias(index, currentRef.parentId, parentRef?.path || '');
      const movedChild = parentResolved
        ? (index.nodes[parentResolved]?.childIds || []).find(id => index.nodes[id]?.name === currentRef.name)
        : undefined;
      if (movedChild) return movedChild;
    }
    let parentId = currentRef?.parentId || null;
    const guard = new Set<string>();
    while (parentId && !guard.has(parentId)) {
      guard.add(parentId);
      const ref = catalog.refsByNodeId.get(parentId);
      const resolved = resolveNodeByAlias(index, parentId, ref?.path || '');
      if (resolved) return resolved;
      parentId = ref?.parentId || null;
    }
    return null;
  };

  const applySelected = async (): Promise<void> => {
    const plan = state.plan;
    const catalog = state.catalog;
    if (!plan || !catalog || plan.steps.length === 0) return;
    const writeBlock = storyWriteBlockMessage();
    if (writeBlock) {
      state.phase = 'error';
      state.error = writeBlock;
      render();
      return;
    }
    state.phase = 'applying';
    state.applyResults = [];
    state.nextCurrentNodeId = null;
    render();
    try {
      // 写前先落盘：清掉 pending / 恢复日志占位，避免大图库批量写回撞 512KB 恢复日志上限。
      try { await flushStoryStorage(); } catch (_e) { /* 后续写入失败会带出具体原因 */ }
      const nowIndex = await readTreeIndex();
      if (state.disposed) return;
      const nowCatalog = buildMapOrganizeCatalog(nowIndex, catalog.currentNodeId);
      if (nowCatalog.fingerprint !== catalog.fingerprint) {
        throw new Error('地图在整理期间发生变化（可能有新地点自动生成），请重新整理。');
      }
      if (getCurrentStoryChatKey() !== state.chatKey) {
        throw new Error('聊天已切换，已停止整理。');
      }
      for (const step of plan.steps) {
        let result: ApplyResult;
        try {
          if (getCurrentStoryChatKey() !== state.chatKey) throw new Error('聊天已切换，已停止后续变更');
          const index = await readTreeIndex();
          const targetId = resolveNodeByAlias(index, step.targetNodeId, step.targetPath);
          if (!targetId) {
            result = { step, status: 'skipped', reason: '节点已不存在' };
          } else if (step.op === 'rename') {
            const ok = await renameMapNode(targetId, step.name || step.targetName);
            result = ok ? { step, status: 'ok' } : { step, status: 'failed', reason: '重命名失败' };
          } else if (step.op === 'move') {
            let parentId: string | null = null;
            if (step.parentNodeId) {
              parentId = resolveNodeByAlias(index, step.parentNodeId, step.parentPath || '');
              if (!parentId) throw new Error('目标父级已不存在');
            }
            const moved = await moveMapNodeInStorage(targetId, parentId);
            result = moved.ok ? { step, status: 'ok' } : { step, status: 'failed', reason: moved.error || '移动失败' };
          } else if (step.op === 'merge') {
            const sourceId = resolveNodeByAlias(index, step.sourceNodeId || '', step.sourcePath || '');
            if (!sourceId) throw new Error('被并节点已不存在');
            const descriptionSourceId = step.mergeDescriptionSourceId === step.sourceNodeId ? sourceId : targetId;
            const visualSourceId = step.mergeVisualSourceId === step.sourceNodeId ? sourceId : targetId;
            const merged = await mapMergeService.merge({
              leftNodeId: targetId,
              rightNodeId: sourceId,
              nameSourceId: targetId,
              descriptionSourceId,
              visualSourceId,
            });
            result = merged.ok ? { step, status: 'ok' } : { step, status: 'failed', reason: merged.error || '合并失败' };
          } else {
            const count = await deleteMapNodeByNodeId(targetId);
            result = count > 0 ? { step, status: 'ok' } : { step, status: 'failed', reason: '删除失败' };
          }
        } catch (error) {
          result = { step, status: 'failed', reason: error instanceof Error ? error.message : String(error || '执行失败') };
        }
        state.applyResults.push(result);
        if (!state.disposed) renderApplying();
        if (result.status === 'failed') break;
      }
      let nextId: string | null = null;
      try {
        const afterIndex = await readTreeIndex();
        nextId = resolveCurrentAfter(afterIndex);
      } catch (_e) { /* ignore */ }
      state.nextCurrentNodeId = nextId;
      state.phase = 'done';
      if (!state.disposed) render();
      if (!state.disposed && getCurrentStoryChatKey() === state.chatKey) {
        try { await opts.onApplied?.(nextId); } catch (_e) { /* ignore */ }
      }
      const okCount = state.applyResults.filter(result => result.status === 'ok').length;
      const failed = state.applyResults.find(result => result.status === 'failed');
      const skipped = state.applyResults.filter(result => result.status === 'skipped').length;
      if (failed) {
        getToastr()?.error(`AI 整理部分完成：成功 ${okCount} 项，失败：${failed.reason || '未知错误'}`, '地图库');
      } else if (skipped) {
        getToastr()?.warning(`AI 整理完成：应用 ${okCount} 项，跳过 ${skipped} 项`, '地图库');
      } else {
        getToastr()?.success(`AI 整理完成：应用 ${okCount} 项变更`, '地图库');
      }
    } catch (error) {
      if (state.disposed) return;
      state.phase = 'error';
      state.error = error instanceof Error ? error.message : String(error || '整理失败');
      render();
    }
  };

  const handleAct = (act: string): void => {
    if (act === 'close' || act === 'cancel' || act === 'done') {
      close();
      return;
    }
    if (state.phase === 'applying') return;
    if (act === 'retry') {
      void start();
      return;
    }
    // confirm 阶段的返回/确认必须在 results 守卫之前处理，否则会被下面直接 return 掉。
    if (act === 'back' && state.phase === 'confirm') {
      state.phase = 'results';
      render();
      return;
    }
    if (act === 'confirmApply' && state.phase === 'confirm') {
      void applySelected();
      return;
    }
    if (state.phase !== 'results') return;
    if (act === 'safe') {
      const plan = state.plan || buildPlan();
      state.selected = new Set(
        plan.items
          .filter(item => item.valid && (item.suggestion.op === 'rename' || item.suggestion.op === 'move'))
          .map(item => item.suggestion.id),
      );
      rerenderPreserveScroll();
      return;
    }
    if (act === 'none') {
      state.selected = new Set();
      rerenderPreserveScroll();
      return;
    }
    if (act === 'apply') {
      if (!state.plan || state.plan.steps.length === 0) return;
      state.phase = 'confirm';
      render();
    }
  };

  overlay.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    if (target === overlay) {
      close();
      return;
    }
    const actionEl = target.closest('[data-act]') as HTMLElement | null;
    if (actionEl?.dataset.act) {
      handleAct(actionEl.dataset.act);
      return;
    }
    const tab = target.closest('.map-organize-tabs [data-tab]') as HTMLElement | null;
    if (tab?.dataset.tab) {
      state.mobileTab = tab.dataset.tab === 'preview' ? 'preview' : 'list';
      render();
      return;
    }
    const preview = target.closest('[data-pv]') as HTMLElement | null;
    if (preview?.dataset.pv) {
      state.previewMode = preview.dataset.pv === 'before' ? 'before' : 'after';
      refreshDerived();
    }
  });

  body.addEventListener('change', event => {
    const target = event.target as HTMLInputElement;
    const check = target.closest('[data-check]') as HTMLInputElement | null;
    if (check?.dataset.check) {
      const id = check.dataset.check;
      if (check.checked) state.selected.add(id);
      else state.selected.delete(id);
      rerenderPreserveScroll();
      return;
    }
    const radio = target.closest('input[type=radio]') as HTMLInputElement | null;
    if (radio && radio.name.includes(':')) {
      const [kind, id] = radio.name.split(':');
      if (!state.mergeChoices[id]) return;
      if (kind === 'v') state.mergeChoices[id].visualSourceId = radio.value;
      else if (kind === 'd') state.mergeChoices[id].descriptionSourceId = radio.value;
      state.plan = buildPlan();
    }
  });

  body.addEventListener('input', event => {
    const input = (event.target as HTMLElement).closest('[data-rename]') as HTMLInputElement | null;
    if (!input?.dataset.rename) return;
    state.renameValues[input.dataset.rename] = input.value;
    refreshDerived();
  });

  void start();
  (closeBtn || overlay).focus?.();
}
