import { getConfig } from '../core/config-store';
import { ensureStyleOnce } from './style-once';
import { debounce } from '../core/timing';
import { pushBackGuard, popBackGuard, registerBackClosers } from '../core/back-guard';
import { UB_EVENT, emitUbEvent } from '../core/events';
import { ubIcon, type IconName } from '../core/icons';
import {
  WARDROBE_CATEGORIES,
  WARDROBE_DISPLAY_ORDER,
  selectionFromItemIds,
  selectionItemIds,
  type OutfitPreset,
  type WardrobeActorProfile,
  type WardrobeItem,
  type WardrobeState,
} from '../core/wardrobe-types';
import {
  actorCurrentOutfitLabel,
  createEmptyWardrobeActorProfile,
  PROTAGONIST_ACTOR_KEY,
} from '../core/wardrobe-actors';
import { collectOutfitModelCandidates, collectWardrobeRoster, type WardrobeRosterEntry } from '../core/wardrobe-roster';
import {
  getWardrobeSnapshot,
  isSafeStoredImagePath,
  loadWardrobeState,
  subscribeWardrobe,
  WARDROBE_OUTFIT_MODEL_STORY_KEY,
} from '../core/wardrobe-store';
import { readStoryFeature, writeStoryFeature } from '../core/story-floor-store';
import type {
  WardrobeGenerationBatch,
} from '../core/wardrobe-queue';
import type { WardrobeExtractionCandidate } from '../core/wardrobe-prompts';
import type { StyleType } from '../core/constants';
import { WARDROBE_BASE_CSS } from '../styles/wardrobe-base';
import { getCellByHeader, getSheetByName } from '../core/data-manager';
import { escapeHtmlAttr as escapeHtml } from '../core/html-escape';
import { openHostLightbox } from './story-image-text-viewer';

export type WardrobeRoute = 'items' | 'outfits' | 'actors' | 'queue';

export interface WardrobePanelView {
  route?: WardrobeRoute;
  category?: string;
  toolbarCollapsed?: boolean;
  actorItemPickerOpen?: boolean;
  actorOutfitPickerOpen?: boolean;
  actorPoolAddOpen?: boolean;
  pickerCategory?: string;
  pickerSearch?: string;
  detailId?: string;
  outfitDetailId?: string;
  selectedIds?: string[];
  outfitModelMode?: 'female' | 'male' | 'story';
  outfitModelCharacter?: string;
  outfitModelCharacters?: string[];
  editorOpen?: boolean;
  editorOutfitId?: string;
  editorItemIds?: string[];
  editorStep?: 1 | 2 | 3;
  presentCharacters?: string[];
  npcTarget?: string;
  itemFormOpen?: boolean;
  itemFormId?: string;
  extractionCandidates?: WardrobeExtractionCandidate[];
  confirmAction?: string;
  confirmId?: string;
  confirmIds?: string[];
  search?: string;
  editorSearch?: string;
  editorCategory?: string;
  itemDraft?: { name: string; category: string; description: string; tags?: string };
  outfitDraft?: { name: string; description: string };
  extractionSelected?: number[];
  actorRoster?: WardrobeRosterEntry[];
  actorKey?: string;
  actorSearch?: string;
  wearTargetActorKey?: string;
  poolTargetActorKey?: string;
  poolManagerOpen?: boolean;
  poolDraftIds?: string[];
  poolSearch?: string;
  designDialogOpen?: boolean;
  designBusy?: boolean;
  designPrompt?: string;
  designCreateOutfit?: boolean;
  designOutfitMeta?: { name: string; description: string } | null;
  outfitMetaLoading?: boolean;
}

export interface WardrobeQueueUiController {
  getSnapshot(): WardrobeGenerationBatch | null;
  subscribe(listener: (snapshot: WardrobeGenerationBatch | null) => void): () => void;
  cancelBatch?(): Promise<void>;
  retryFailed?(): Promise<unknown>;
  continueInterrupted?(): Promise<unknown>;
}

export interface WardrobePanelRefreshAdapter {
  isOpen(): boolean;
  getState(): WardrobeState;
  getQueue(): WardrobeGenerationBatch | null;
  getRoster(): readonly WardrobeRosterEntry[];
  getPresentCharacters(): readonly string[];
  getView(): WardrobePanelView;
  commit(
    state: WardrobeState,
    queue: WardrobeGenerationBatch | null,
    view: WardrobePanelView,
  ): void;
}

const CSS_ID = 'ub-wardrobe-css';
const ROUTE_LABELS: Record<WardrobeRoute, string> = {
  items: '单品',
  outfits: '套装',
  actors: '角色穿搭',
  queue: '生成队列',
};
const CATEGORY_ICONS: Record<string, IconName> = {
  上装: 'shirt', 下装: 'pants', 连体服: 'dress', 外套: 'jacket', 文胸: 'bow',
  内裤: 'underwear', 袜类: 'socks', 鞋靴: 'shoes', 头饰: 'hat', 配饰: 'ring',
};

let _style: StyleType = 'ancient';
let _state: WardrobeState | null = null;
let _queueSnapshot: WardrobeGenerationBatch | null = null;
let _queueController: WardrobeQueueUiController | null = null;
let _view: Required<Pick<WardrobePanelView, 'route' | 'category' | 'editorStep'>> & WardrobePanelView = {
  route: 'items',
  category: '全部',
  editorStep: 1,
};
let _storeUnsubscribe: (() => void) | null = null;
let _queueUnsubscribe: (() => void) | null = null;
let _restoreFocus: HTMLElement | null = null;
let _openedAt = 0;
/** 五个搜索框统一防抖：inBody=true 走 body 级局部刷新（refreshWardrobeContent），false（弹窗内）走整窗 rerender */
const WARDROBE_SEARCH_KEYS: Record<string, { key: 'search' | 'editorSearch' | 'actorSearch' | 'poolSearch' | 'pickerSearch'; inBody: boolean }> = {
  wardrobeSearch: { key: 'search', inBody: true },
  wardrobeEditorSearch: { key: 'editorSearch', inBody: true },
  wardrobeActorSearch: { key: 'actorSearch', inBody: true },
  wardrobePoolSearch: { key: 'poolSearch', inBody: false },
  wardrobePickerSearch: { key: 'pickerSearch', inBody: false },
};
const WARDROBE_SEARCH_DEBOUNCE_MS = 180;
// U34：搜索输入去抖（参数取最后一次调用——与原手写「清旧表+闭包最新值」逐点等价；
// 触发后如焦点被重绘顶掉，回填焦点与光标到输入尾）。
const refreshWardrobeSearchDebounced = debounce(
  (searchHit: (typeof WARDROBE_SEARCH_KEYS)[string], targetId: string, overlay: HTMLElement) => {
    if (searchHit.inBody) refreshWardrobeContent(); else rerender();
    const searchInput = overlay.querySelector<HTMLInputElement>('#' + targetId);
    if (searchInput && document.activeElement !== searchInput) {
      searchInput.focus();
      searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }
  },
  WARDROBE_SEARCH_DEBOUNCE_MS,
);
// 模特性别切换的落盘串行链：快速连点两次时后一次基于前一次完成后的快照，避免竞态写回旧值
let _genderSaveChain: Promise<unknown> = Promise.resolve();

/** 套装模特选项按卡持久化（wardrobe.outfitModel story-feature 键）；串行链防止并发写覆盖 */
function persistOutfitModelChoice(): void {
  const mode = _view.outfitModelMode === 'story' ? 'story' : (_view.outfitModelMode === 'male' ? 'male' : 'female');
  const choice = {
    mode,
    ...(mode === 'story' ? { character: String(_view.outfitModelCharacter || '').trim() } : {}),
  };
  _genderSaveChain = _genderSaveChain
    .then(() => writeStoryFeature(WARDROBE_OUTFIT_MODEL_STORY_KEY, choice))
    .catch(() => undefined);
}

/** 读取按卡存储的模特选项；为空或非法值一律默认「默认女」（旧全局 modelGender 偏好已废弃不读） */
function readStoredOutfitModelChoice(): { mode: 'female' | 'male' | 'story'; character: string } {
  const raw = readStoryFeature<{ mode?: unknown; character?: unknown } | null>(WARDROBE_OUTFIT_MODEL_STORY_KEY, null);
  const mode = raw?.mode === 'story' ? 'story' : (raw?.mode === 'male' ? 'male' : 'female');
  return { mode, character: typeof raw?.character === 'string' ? raw.character : '' };
}

function renderImage(item: Pick<WardrobeItem, 'name' | 'category' | 'imagePath'>): string {
  if (isSafeStoredImagePath(item.imagePath)) {
    return `<img src="${escapeHtml(item.imagePath)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async">`;
  }
  return `<span class="wardrobe-placeholder" aria-hidden="true">${ubIcon(CATEGORY_ICONS[item.category] || 'dress')}</span>`;
}

function routeButton(route: WardrobeRoute, current: WardrobeRoute): string {
  return `<button type="button" class="wardrobe-route" role="tab" data-wardrobe-route="${route}" aria-selected="${route === current}">${ROUTE_LABELS[route]}</button>`;
}

function itemCard(item: WardrobeItem, selectedIds: readonly string[], generating = false): string {
  return `<article class="wardrobe-card${generating ? ' is-generating' : ''}" data-wardrobe-item-id="${escapeHtml(item.id)}">
    ${generating ? '<span class="wardrobe-generating-overlay">生成中…</span>' : ''}
    <input class="wardrobe-card-select" type="checkbox" aria-label="选择${escapeHtml(item.name)}" data-wardrobe-select-item="${escapeHtml(item.id)}"${selectedIds.includes(item.id) ? ' checked' : ''}>
    <button type="button" class="wardrobe-card-button" data-wardrobe-detail="${escapeHtml(item.id)}">
      <span class="wardrobe-card-image wardrobe-item-image">${renderImage(item)}</span>
      <span class="wardrobe-card-copy">
        <span class="wardrobe-card-name">${escapeHtml(item.name)}</span>
        <span class="wardrobe-card-meta">${wardrobeItemMetaHtml(item.category, item.source)}</span>
      </span>
    </button>
  </article>`;
}

function protagonistProfile(state: WardrobeState): WardrobeActorProfile {
  return state.actorProfiles[PROTAGONIST_ACTOR_KEY]
    || createEmptyWardrobeActorProfile(PROTAGONIST_ACTOR_KEY, '主角');
}

/** F85：单品卡 meta → 分类芯片 + 来源尾注（分类/来源各自成签，不再一串文字）。 */
function wardrobeItemMetaHtml(category: string, source?: string): string {
  return `<span class="wb-cat">${escapeHtml(category)}</span><span class="wb-src">来自 ${escapeHtml(source || '—')}</span>`;
}

/** F85：套装卡 meta → 件数徽章 + 来源尾注。 */
function wardrobeOutfitMetaHtml(count: number, sourceCard?: string): string {
  return `<span class="wb-count"><b class="num">${count}</b> 件</span>${sourceCard ? `<span class="wb-src">来自 ${escapeHtml(sourceCard)}</span>` : ''}`;
}

function sortedActorRoster(view: WardrobePanelView): WardrobeRosterEntry[] {
  return (view.actorRoster || []).slice().sort((left, right) => {
    if (left.kind === 'protagonist' && right.kind !== 'protagonist') return -1;
    if (right.kind === 'protagonist' && left.kind !== 'protagonist') return 1;
    return 0;
  });
}

export function resolveWardrobePanelActorKey(
  roster: readonly WardrobeRosterEntry[],
  existingActorKey: unknown,
): string {
  const normalizedKey = String(existingActorKey || '').trim();
  return roster.some(actor => actor.actorKey === normalizedKey)
    ? normalizedKey
    : PROTAGONIST_ACTOR_KEY;
}

export function reconcileWardrobePanelRosterView(
  view: WardrobePanelView,
  roster: readonly WardrobeRosterEntry[],
  presentCharacters: readonly string[],
): WardrobePanelView {
  const actorKey = resolveWardrobePanelActorKey(roster, view.actorKey);
  const validTarget = (candidate: unknown): string => {
    const normalizedKey = String(candidate || '').trim();
    return roster.some(actor => actor.actorKey === normalizedKey)
      ? normalizedKey
      : actorKey;
  };
  const normalizedPresent = Array.from(new Set(
    presentCharacters.map(name => String(name || '').trim()).filter(Boolean),
  ));
  const npcTarget = normalizedPresent.includes(String(view.npcTarget || '').trim())
    ? String(view.npcTarget).trim()
    : normalizedPresent[0] || '';
  const actorChanged = actorKey !== view.actorKey;
  const next: WardrobePanelView = {
    ...view,
    actorRoster: roster.slice(),
    actorKey,
    wearTargetActorKey: validTarget(view.wearTargetActorKey),
    poolTargetActorKey: validTarget(view.poolTargetActorKey),
    presentCharacters: normalizedPresent,
    npcTarget,
  };
  if (actorChanged) {
    next.poolManagerOpen = false;
    next.actorItemPickerOpen = false;
    next.actorOutfitPickerOpen = false;
    next.actorPoolAddOpen = false;
    delete next.poolDraftIds;
    delete next.poolSearch;
    delete next.pickerSearch;
    if (next.confirmAction === 'actor-remove-outfit-from-pool') {
      delete next.confirmAction;
      delete next.confirmId;
    }
  }
  return next;
}

function actorTargetOptions(
  view: WardrobePanelView,
  selectedActorKey: string | undefined,
): { roster: WardrobeRosterEntry[]; selected: WardrobeRosterEntry } {
  const roster = sortedActorRoster(view);
  if (roster.length === 0) {
    const protagonist: WardrobeRosterEntry = {
      actorKey: PROTAGONIST_ACTOR_KEY,
      displayName: '主角',
      kind: 'protagonist',
      present: true,
    };
    return { roster: [protagonist], selected: protagonist };
  }
  const selected = roster.find(actor => actor.actorKey === selectedActorKey)
    || roster.find(actor => actor.kind === 'protagonist')
    || roster[0];
  return { roster, selected };
}

function normalizedActorTargetView(view: WardrobePanelView): WardrobePanelView {
  const actor = actorTargetOptions(view, view.actorKey).selected;
  const wearTarget = actorTargetOptions(view, view.wearTargetActorKey).selected;
  const poolTarget = actorTargetOptions(view, view.poolTargetActorKey).selected;
  return {
    ...view,
    actorKey: actor.actorKey,
    wearTargetActorKey: wearTarget.actorKey,
    poolTargetActorKey: poolTarget.actorKey,
  };
}

export function buildWardrobeActionDetail(
  view: WardrobePanelView,
  action: string,
  id = '',
  payload?: unknown,
): { action: string; id: string; view: WardrobePanelView; payload?: unknown } {
  return {
    action,
    id,
    view: normalizedActorTargetView(view),
    payload,
  };
}

function renderActorTargetPicker(
  view: WardrobePanelView,
  id: 'wardrobeWearTarget' | 'wardrobePoolTarget',
  selectedActorKey: string | undefined,
  label: string,
): { html: string; selected: WardrobeRosterEntry } {
  const { roster, selected } = actorTargetOptions(view, selectedActorKey);
  return {
    selected,
    html: `<label class="wardrobe-muted">${escapeHtml(label)}
      <select id="${id}" aria-label="${escapeHtml(label)}">${roster.map(actor => `<option value="${escapeHtml(actor.actorKey)}"${actor.actorKey === selected.actorKey ? ' selected' : ''}>${escapeHtml(actor.displayName)}</option>`).join('')}</select>
    </label>`,
  };
}

function actorWearHint(state: WardrobeState, profile: WardrobeActorProfile, item: WardrobeItem): string {
  if (item.category === '配饰') {
    return '将加入现有配饰，可与其他配饰同时穿戴。';
  }
  const existingId = profile.currentOutfit.slots[item.category];
  if (existingId === item.id) {
    return profile.actorKey === PROTAGONIST_ACTOR_KEY
      ? '这件服饰已在主角当前穿搭中。'
      : '这件服饰已在当前穿搭中。';
  }
  const existing = state.items.find(candidate => candidate.id === existingId);
  return existing
    ? `将替换当前${item.category}：${existing.name}`
    : `将占用${item.category}槽位。`;
}

function renderItemDetail(state: WardrobeState, view: WardrobePanelView): string {
  const item = state.items.find(candidate => candidate.id === view.detailId);
  if (!item) return '';
  const wearTarget = renderActorTargetPicker(view, 'wardrobeWearTarget', view.wearTargetActorKey, '直接穿戴角色');
  const wearProfile = state.actorProfiles[wearTarget.selected.actorKey]
    || createEmptyWardrobeActorProfile(wearTarget.selected.actorKey, wearTarget.selected.displayName);
  return `<aside class="wardrobe-detail" aria-label="${escapeHtml(item.name)}详情">
    <div class="wardrobe-detail-head"><strong class="wardrobe-detail-title">${escapeHtml(item.name)}</strong><button type="button" class="wardrobe-close" data-wardrobe-action="close-detail" aria-label="关闭详情">×</button></div>
    <div class="wardrobe-detail-image wardrobe-item-image">${renderImage(item)}</div>
    <div class="wardrobe-card-meta">${wardrobeItemMetaHtml(item.category, item.source)}</div>
    <p class="wardrobe-detail-description">${escapeHtml(item.description)}</p>
    <section class="wardrobe-detail-section">
      <h3>资料与图片</h3>
      <div class="wardrobe-detail-actions">
        <button type="button" class="wardrobe-btn" data-wardrobe-action="edit-item" data-id="${escapeHtml(item.id)}">编辑资料</button>
        <button type="button" class="wardrobe-btn primary" data-wardrobe-action="generate-item" data-id="${escapeHtml(item.id)}">${isSafeStoredImagePath(item.imagePath) ? '重新生图' : '生成图片'}</button>
        <button type="button" class="wardrobe-btn" data-wardrobe-action="generate-item-by-tags" data-id="${escapeHtml(item.id)}"${(item.tags || '').trim() ? ' title="直接用已存储的标签重新出图，不重新生成标签"' : ' title="该服饰未生成标签，无法按现有标签重新生图" disabled'}>按现有标签重新生图</button>
        <button type="button" class="wardrobe-btn" data-wardrobe-action="import-item-image" data-id="${escapeHtml(item.id)}">导入图片</button>
        <button type="button" class="wardrobe-btn" data-wardrobe-action="export-item-inventory" data-id="${escapeHtml(item.id)}" title="复制到物品表，衣柜保留这件服饰">提取至物品栏</button>
      </div>
    </section>
    <section class="wardrobe-detail-section">
      <h3>穿戴</h3>
      <div class="wardrobe-wear-option">
        <div class="wardrobe-wear-copy"><strong>直接穿戴</strong><span>${escapeHtml(actorWearHint(state, wearProfile, item))}</span></div>
        <div class="wardrobe-npc-controls">
          ${wearTarget.html}
          <button type="button" class="wardrobe-btn primary" data-wardrobe-action="wear-item" data-id="${escapeHtml(item.id)}">给${escapeHtml(wearTarget.selected.displayName)}穿</button>
        </div>
      </div>
      <div class="wardrobe-wear-option">${renderNpcWearControls(view, 'item', item.id)}</div>
    </section>
    <section class="wardrobe-detail-section wardrobe-danger-zone">
      <h3>危险操作</h3>
      <button type="button" class="wardrobe-btn danger" data-wardrobe-action="delete-item" data-id="${escapeHtml(item.id)}">删除这件服饰</button>
    </section>
  </aside>`;
}

function outfitWearHint(state: WardrobeState, outfit: OutfitPreset): string {
  const items = outfit.itemIds
    .map(id => state.items.find(candidate => candidate.id === id))
    .filter((candidate): candidate is WardrobeItem => !!candidate);
  if (items.length === 0) return '这个套装是空的，穿戴不会改变当前穿搭。';
  return '将用这套服饰完整替换当前穿搭，包括现有配饰。';
}

function renderOutfitDetail(state: WardrobeState, view: WardrobePanelView): string {
  const outfit = state.outfits.find(candidate => candidate.id === view.outfitDetailId);
  if (!outfit) return '';
  const wearTarget = renderActorTargetPicker(view, 'wardrobeWearTarget', view.wearTargetActorKey, '直接穿戴角色');
  const poolTarget = renderActorTargetPicker(view, 'wardrobePoolTarget', view.poolTargetActorKey, '套装池角色');
  const resolvedItems = outfit.itemIds
    .map(id => state.items.find(candidate => candidate.id === id))
    .filter((candidate): candidate is WardrobeItem => !!candidate);
  const orderedItems = WARDROBE_DISPLAY_ORDER
    .flatMap(cat => resolvedItems.filter(item => item.category === cat));
  const first = resolvedItems[0];
  const imageLike = { name: outfit.name, category: first?.category || '连体服', imagePath: outfit.imagePath } as WardrobeItem;
  return `<aside class="wardrobe-detail" aria-label="${escapeHtml(outfit.name)}详情">
    <div class="wardrobe-detail-head"><strong class="wardrobe-detail-title">${escapeHtml(outfit.name)}</strong><button type="button" class="wardrobe-close" data-wardrobe-action="close-outfit-detail" aria-label="关闭详情">×</button></div>
    <div class="wardrobe-detail-image wardrobe-outfit-image">${renderImage(imageLike)}</div>
    <div class="wardrobe-card-meta">${wardrobeOutfitMetaHtml(outfit.itemIds.length, outfit.sourceCard)}</div>
    ${outfit.description ? `<p class="wardrobe-detail-description">${escapeHtml(outfit.description)}</p>` : ''}
    <section class="wardrobe-detail-section">
      <h3>套装组成</h3>
      <ul class="wardrobe-outfit-items">${orderedItems.length ? orderedItems.map(item => `<li><strong>${escapeHtml(item.category)}</strong> · ${escapeHtml(item.name)}</li>`).join('') : '<li class="wardrobe-muted">（空套装）</li>'}</ul>
    </section>
    <section class="wardrobe-detail-section">
      <h3>套装操作</h3>
      <div class="wardrobe-detail-actions">
        <button type="button" class="wardrobe-btn primary" data-wardrobe-action="edit-outfit" data-id="${escapeHtml(outfit.id)}">套装编辑</button>
        <button type="button" class="wardrobe-btn" data-wardrobe-action="generate-outfit" data-id="${escapeHtml(outfit.id)}">${isSafeStoredImagePath(outfit.imagePath) ? '重新生图' : '生成图片'}</button>
      </div>
    </section>
    <section class="wardrobe-detail-section">
      <h3>穿戴</h3>
      <div class="wardrobe-wear-option">
        <div class="wardrobe-wear-copy"><strong>直接穿戴</strong><span>${escapeHtml(outfitWearHint(state, outfit))}</span></div>
        <div class="wardrobe-npc-controls">
          ${wearTarget.html}
          <button type="button" class="wardrobe-btn primary" data-wardrobe-action="wear-outfit" data-id="${escapeHtml(outfit.id)}">给${escapeHtml(wearTarget.selected.displayName)}穿</button>
        </div>
      </div>
      <div class="wardrobe-wear-option">
        <div class="wardrobe-wear-copy"><strong>加入套装池</strong><span>加入后可在角色穿搭页选择每日随机候选。</span></div>
        <div class="wardrobe-npc-controls">
          ${poolTarget.html}
          <button type="button" class="wardrobe-btn" data-wardrobe-action="add-outfit-to-pool" data-id="${escapeHtml(outfit.id)}">加入套装池</button>
        </div>
      </div>
      <div class="wardrobe-wear-option">${renderNpcWearControls(view, 'outfit', outfit.id)}</div>
    </section>
    <section class="wardrobe-detail-section wardrobe-danger-zone">
      <h3>危险操作</h3>
      <button type="button" class="wardrobe-btn danger" data-wardrobe-action="delete-outfit" data-id="${escapeHtml(outfit.id)}">删除这个套装</button>
    </section>
  </aside>`;
}

/** 当前分类+搜索过滤下的可见单品（renderItems 与「全选」动作共用同一筛选口径） */
function visibleItems(state: WardrobeState, view: WardrobePanelView): WardrobeItem[] {
  const category = view.category || '全部';
  const search = String(view.search || '').trim().toLocaleLowerCase();
  return state.items.filter(item => {
    if (category !== '全部' && item.category !== category) return false;
    if (!search) return true;
    return [item.name, item.description, item.category, item.source]
      .some(value => String(value || '').toLocaleLowerCase().includes(search));
  });
}

function renderItems(
  state: WardrobeState,
  view: WardrobePanelView,
  queue: WardrobeGenerationBatch | null,
): string {
  const category = view.category || '全部';
  const selectedIds = view.selectedIds || [];
  const visible = visibleItems(state, view);
  const allSelected = visible.length > 0 && visible.every(item => selectedIds.includes(item.id));
  const counts = new Map<string, number>([['全部', state.items.length]]);
  for (const item of state.items) counts.set(item.category, (counts.get(item.category) || 0) + 1);
  const filters = ['全部', ...WARDROBE_CATEGORIES].map(candidate =>
    `<button type="button" class="wardrobe-filter" data-wardrobe-category="${escapeHtml(candidate)}" aria-pressed="${candidate === category}">${escapeHtml(candidate)}（${counts.get(candidate) || 0}）</button>`,
  ).join('');
  const generatingIds = new Set(
    queue?.targetType === 'item'
      ? queue.tasks.filter(task => ['waiting_prompt', 'queued', 'running'].includes(task.status)).map(task => task.targetId)
      : [],
  );
  const unimaged = state.items.filter(item => !isSafeStoredImagePath(item.imagePath));
  const toolbarCollapsed = view.toolbarCollapsed === true;
  return `${renderProtagonistOutfit(state, toolbarCollapsed)}
  ${toolbarCollapsed ? '' : `<div class="wardrobe-toolbar wardrobe-toolbar-items"><label class="wardrobe-search">搜索<input id="wardrobeSearch" value="${escapeHtml(view.search || '')}" placeholder="名称、描述、类别或来源"></label>
    <div class="wardrobe-filter-row">${filters}</div>
    <span class="wardrobe-toolbar-spacer"></span>
    <div class="wardrobe-actions-row">
    <button type="button" class="wardrobe-btn" data-wardrobe-action="add-item">＋ 手动添加</button>
    <button type="button" class="wardrobe-btn" data-wardrobe-action="design-items">AI 设计穿搭</button>
    <button type="button" class="wardrobe-btn primary" data-wardrobe-action="generate-unimaged"${unimaged.length ? '' : ' disabled'}>无图单品生图${unimaged.length ? `（${unimaged.length}）` : ''}</button>
    <button type="button" class="wardrobe-btn" data-wardrobe-action="toggle-select-all"${visible.length ? '' : ' disabled'}>${allSelected ? '取消全选' : '全选'}</button>
    <button type="button" class="wardrobe-btn primary" data-wardrobe-action="generate-selected"${selectedIds.length ? '' : ' disabled'}>批量生图${selectedIds.length ? `（${selectedIds.length}）` : ''}</button>
    <button type="button" class="wardrobe-btn danger" data-wardrobe-action="delete-selected"${selectedIds.length ? '' : ' disabled'}>批量删除${selectedIds.length ? `（${selectedIds.length}）` : ''}</button>
    </div>
  </div>`}
  <div class="wardrobe-content">${visible.length
    ? `<div class="wardrobe-grid">${visible.map(item => itemCard(item, selectedIds, generatingIds.has(item.id))).join('')}</div>`
    : '<div class="wardrobe-empty">这个分类还没有服饰</div>'}</div>
  ${renderItemDetail(state, view)}`;
}

function renderProtagonistOutfit(state: WardrobeState, toolbarCollapsed: boolean): string {
  const ids = selectionItemIds(protagonistProfile(state).currentOutfit);
  const items = ids.map(id => state.items.find(item => item.id === id)).filter((item): item is WardrobeItem => !!item);
  return `<div class="wardrobe-current-outfit">
    <button type="button" class="wardrobe-collapse-btn" data-wardrobe-action="toggle-toolbar" aria-expanded="${!toolbarCollapsed}" aria-label="${toolbarCollapsed ? '展开工具栏' : '折叠工具栏'}" title="${toolbarCollapsed ? '展开工具栏' : '折叠工具栏'}">${toolbarCollapsed ? '▸' : '▾'}</button>
    <strong>主角当前穿搭</strong>
    <div class="wardrobe-current-items">${items.length
      ? items.map(item => `<button type="button" class="wardrobe-current-chip" data-wardrobe-action="unwear-item" data-id="${escapeHtml(item.id)}" title="点击卸下">${escapeHtml(item.name)} ×</button>`).join('')
      : '<span class="wardrobe-muted">未设置</span>'}</div>
    <button type="button" class="wardrobe-btn" data-wardrobe-action="clear-protagonist-outfit"${items.length ? '' : ' disabled'}>一键清空</button>
  </div>`;
}

function renderNpcWearControls(view: WardrobePanelView, kind: 'item' | 'outfit', id: string): string {
  const names = view.presentCharacters || [];
  if (names.length === 0) {
    return `<div class="wardrobe-wear-copy"><strong>追加剧情换装指令</strong><span>给在场角色穿；当前没有可选择的在场角色</span></div>
      <div class="wardrobe-npc-controls">
        <label>选择角色<select aria-label="选择在场角色" disabled><option>暂无在场角色</option></select></label>
        <button type="button" class="wardrobe-btn" data-wardrobe-action="wear-npc-${kind}" data-id="${escapeHtml(id)}" disabled>追加穿戴指令</button>
      </div>
      <div class="wardrobe-wear-help">只会追加到输入框，不会自动发送。</div>`;
  }
  return `<div class="wardrobe-wear-copy"><strong>追加剧情换装指令</strong><span>给在场角色穿，让角色在后续回复中自行演化穿着状态。</span></div>
    <div class="wardrobe-npc-controls">
      ${renderNpcTargetPicker(view)}
      <button type="button" class="wardrobe-btn" data-wardrobe-action="wear-npc-${kind}" data-id="${escapeHtml(id)}">追加穿戴指令</button>
    </div>
    <div class="wardrobe-wear-help">只会追加到输入框，不会自动发送。</div>`;
}

function renderNpcTargetPicker(view: WardrobePanelView): string {
  const names = view.presentCharacters || [];
  if (names.length === 0) return '<span class="wardrobe-muted">当前没有可选择的在场角色</span>';
  const selected = names.includes(view.npcTarget || '') ? view.npcTarget! : names[0];
  return `<label class="wardrobe-muted">给角色穿
    <select id="wardrobeNpcTarget" aria-label="选择在场角色">${names.map(name => `<option value="${escapeHtml(name)}"${name === selected ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select>
  </label>`;
}

/** 套装模特选项：默认男/默认女/故事中角色；选故事角色时旁边出角色下拉（恋爱对象表∪重要角色表）。
 *  选项按卡存储（wardrobe.outfitModel story-feature 键），不再写全局目录 modelGender。 */
function renderOutfitModelPicker(view: WardrobePanelView): string {
  const mode = view.outfitModelMode === 'story' ? 'story' : (view.outfitModelMode === 'male' ? 'male' : 'female');
  const picker = `<span class="wardrobe-search"><span>模特</span>
    <select id="wardrobeOutfitGender" aria-label="选择套装生图模特">
      <option value="male"${mode === 'male' ? ' selected' : ''}>默认男</option>
      <option value="female"${mode === 'female' ? ' selected' : ''}>默认女</option>
      <option value="story"${mode === 'story' ? ' selected' : ''}>故事中角色</option>
    </select></span>`;
  if (mode !== 'story') return picker;
  const names = view.outfitModelCharacters || [];
  if (names.length === 0) return `${picker}<span class="wardrobe-muted">恋爱/重要角色表中没有可选角色</span>`;
  const current = String(view.outfitModelCharacter || '');
  const selected = names.includes(current) ? current : names[0];
  return `${picker}<span class="wardrobe-search"><select id="wardrobeOutfitModelCharacter" aria-label="选择模特角色">${names.map(name => `<option value="${escapeHtml(name)}"${name === selected ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></span>`;
}

function renderOutfitEditor(state: WardrobeState, view: WardrobePanelView): string {
  if (!view.editorOpen) return '';
  const outfit = view.editorOutfitId ? state.outfits.find(candidate => candidate.id === view.editorOutfitId) : null;
  const requested = view.editorItemIds || outfit?.itemIds || [];
  const normalizedIds = selectionItemIds(selectionFromItemIds(state.items, requested));
  const selected = new Set(normalizedIds);
  const editorCategory = view.editorCategory || '全部';
  const editorSearch = String(view.editorSearch || '').trim().toLocaleLowerCase();
  const editorVisible = state.items.filter(item => {
    if (editorCategory !== '全部' && item.category !== editorCategory) return false;
    if (!editorSearch) return true;
    return [item.name, item.description, item.category, item.source]
      .some(value => String(value || '').toLocaleLowerCase().includes(editorSearch));
  });
  const editorCounts = new Map<string, number>([['全部', state.items.length]]);
  for (const item of state.items) editorCounts.set(item.category, (editorCounts.get(item.category) || 0) + 1);
  const resolved = WARDROBE_DISPLAY_ORDER.flatMap(category =>
    state.items.filter(item => selected.has(item.id) && item.category === category));
  const step = view.editorStep || 1;
  const draft = view.outfitDraft || {
    name: outfit?.name || '',
    description: outfit?.description || '',
  };
  return `<section class="wardrobe-content">
    <div class="wardrobe-mobile-steps" aria-label="套装编辑步骤">
      ${[1, 2, 3].map(value => `<button type="button" class="wardrobe-mobile-step" data-wardrobe-editor-step="${value}"${value === step ? ' aria-current="step"' : ''}>${value}. ${value === 1 ? '选衣' : value === 2 ? '预览' : '保存'}</button>`).join('')}
    </div>
    <div class="wardrobe-outfit-editor" data-mobile-step="${step}">
      <div class="wardrobe-editor-column wardrobe-editor-library">
        <div class="wardrobe-editor-title">选择服饰</div>
        <div class="wardrobe-editor-filters">
          <label class="wardrobe-search wardrobe-editor-search">搜索<input id="wardrobeEditorSearch" value="${escapeHtml(view.editorSearch || '')}" placeholder="名称、描述、类别或来源"></label>
          ${['全部', ...WARDROBE_CATEGORIES].map(candidate => `<button type="button" class="wardrobe-filter" data-wardrobe-editor-category="${escapeHtml(candidate)}" aria-pressed="${candidate === editorCategory}">${escapeHtml(candidate)}（${editorCounts.get(candidate) || 0}）</button>`).join('')}
        </div>
        <div class="wardrobe-editor-list">${editorVisible.length ? editorVisible.map(item => `<label class="wardrobe-editor-option">
          <input type="checkbox" data-wardrobe-editor-item="${escapeHtml(item.id)}"${selected.has(item.id) ? ' checked' : ''}>
          <span><strong>${escapeHtml(item.name)}</strong><br><span class="wardrobe-muted">${escapeHtml(item.category)} · ${escapeHtml(item.description)}</span></span>
        </label>`).join('') : '<div class="wardrobe-empty">没有匹配的服饰</div>'}</div>
      </div>
      <div class="wardrobe-editor-column wardrobe-editor-preview">
        <div class="wardrobe-editor-title">搭配预览</div>
        ${(resolved.length && resolved.some(item => !(item.tags || '').trim())) ? '<div class="wardrobe-muted" style="margin-bottom:6px;font-size:var(--ub-ui-font-11,11px);line-height:1.5;">提示：部分单品尚未生成展示图（缺标签），套装生图将回退用描述、一致性略降。建议先生成单品图。</div>' : ''}
        <div class="wardrobe-editor-preview-list">${resolved.length ? resolved.map(item => `<div class="wardrobe-editor-preview-item"><strong>${escapeHtml(item.category)} · ${escapeHtml(item.name)}</strong><div class="wardrobe-muted">${escapeHtml(item.description)}</div></div>`).join('') : '<div class="wardrobe-empty">从左侧选择服饰</div>'}</div>
      </div>
      <div class="wardrobe-editor-column wardrobe-editor-meta">
        <div class="wardrobe-editor-title">${outfit ? '编辑套装' : '保存新套装'}</div>
        <label class="wardrobe-field">名称<input id="wardrobeOutfitName" maxlength="40" value="${escapeHtml(draft.name)}"></label>
        <label class="wardrobe-field">描述<textarea id="wardrobeOutfitDescription" maxlength="300">${escapeHtml(draft.description)}</textarea></label>
        <button type="button" class="wardrobe-btn" data-wardrobe-action="suggest-outfit-meta" title="根据已选服饰生成套装名称和描述"${normalizedIds.length && !view.outfitMetaLoading ? '' : ' disabled'}>${view.outfitMetaLoading ? '生成中…' : '生成名称/描述'}</button>
        <button type="button" class="wardrobe-btn primary" data-wardrobe-action="save-outfit" data-id="${escapeHtml(outfit?.id || '')}">保存套装</button>
        <button type="button" class="wardrobe-btn" data-wardrobe-action="close-editor">取消</button>
      </div>
    </div>
  </section>`;
}

function renderOutfits(
  state: WardrobeState,
  view: WardrobePanelView,
  queue: WardrobeGenerationBatch | null,
): string {
  if (view.editorOpen) return renderOutfitEditor(state, view);
  const generatingIds = new Set(
    queue?.targetType === 'outfit'
      ? queue.tasks.filter(task => ['waiting_prompt', 'queued', 'running'].includes(task.status)).map(task => task.targetId)
      : [],
  );
  // 列表页不留「给角色穿」选择器：追加剧情的穿戴目标只属于详情抽屉（下拉与「追加穿戴指令」成对出现）
  return `<div class="wardrobe-toolbar">
    <button type="button" class="wardrobe-btn primary" data-wardrobe-action="new-outfit">＋ 新建套装</button>
    ${renderOutfitModelPicker(view)}
  </div><div class="wardrobe-content">${state.outfits.length
    ? `<div class="wardrobe-grid">${state.outfits.map(outfit => {
      const first = state.items.find(item => outfit.itemIds.includes(item.id));
      const imageLike = { name: outfit.name, category: first?.category || '连体服', imagePath: outfit.imagePath };
      const generating = generatingIds.has(outfit.id);
      return `<article class="wardrobe-card${generating ? ' is-generating' : ''}" data-wardrobe-outfit-id="${escapeHtml(outfit.id)}">
        ${generating ? '<span class="wardrobe-generating-overlay">生成中…</span>' : ''}
        <button type="button" class="wardrobe-card-button" data-wardrobe-outfit-detail="${escapeHtml(outfit.id)}">
          <span class="wardrobe-card-image wardrobe-outfit-image">${renderImage(imageLike as WardrobeItem)}</span>
          <span class="wardrobe-card-copy"><span class="wardrobe-card-name">${escapeHtml(outfit.name)}</span><span class="wardrobe-card-meta">${wardrobeOutfitMetaHtml(outfit.itemIds.length, outfit.sourceCard)}</span></span>
        </button>
      </article>`;
    }).join('')}</div>`
    : '<div class="wardrobe-empty">还没有套装预设</div>'}</div>${renderOutfitDetail(state, view)}`;
}

function actorContext(
  state: WardrobeState,
  view: WardrobePanelView,
): { roster: WardrobeRosterEntry[]; actor: WardrobeRosterEntry | null; profile: WardrobeActorProfile | null } {
  const roster = sortedActorRoster(view);
  if (roster.length === 0) return { roster, actor: null, profile: null };
  const actor = roster.find(candidate => candidate.actorKey === view.actorKey)
    || roster.find(candidate => candidate.kind === 'protagonist')
    || roster[0];
  const profile = state.actorProfiles[actor.actorKey]
    || createEmptyWardrobeActorProfile(actor.actorKey, actor.displayName);
  return {
    roster,
    actor,
    profile: { ...profile, displayName: actor.displayName },
  };
}

function isWearableOutfit(state: WardrobeState, outfit: OutfitPreset | undefined): outfit is OutfitPreset {
  return !!outfit
    && selectionItemIds(selectionFromItemIds(state.items, outfit.itemIds)).length > 0;
}

function renderActorCurrentOutfit(
  state: WardrobeState,
  actor: WardrobeRosterEntry,
  profile: WardrobeActorProfile,
): string {
  const currentIds = new Set(selectionItemIds(profile.currentOutfit));
  const currentItems = WARDROBE_DISPLAY_ORDER.flatMap(category =>
    state.items.filter(item => currentIds.has(item.id) && item.category === category));
  const randomPoolIds = new Set(profile.outfitPoolIds);
  const hasRandomCandidate = profile.randomOutfitIds.some(outfitId => (
    randomPoolIds.has(outfitId)
      && isWearableOutfit(state, state.outfits.find(outfit => outfit.id === outfitId))
  ));
  return `<section class="wardrobe-actor-current" aria-labelledby="wardrobeActorCurrentTitle">
    <div class="wardrobe-actor-section-head">
      <div>
        <h2 id="wardrobeActorCurrentTitle">${escapeHtml(actor.displayName)}当前穿搭</h2>
        <div class="wardrobe-actor-source">${escapeHtml(actorCurrentOutfitLabel(state, profile))}</div>
      </div>
      <button type="button" class="wardrobe-btn" data-wardrobe-action="actor-random-now" data-actor-key="${escapeHtml(actor.actorKey)}"${hasRandomCandidate ? '' : ' disabled'}>立即随机</button>
    </div>
    <div class="wardrobe-actor-current-items">${currentItems.length
      ? currentItems.map(item => `<button type="button" class="wardrobe-current-chip" data-wardrobe-action="actor-unwear-item" data-actor-key="${escapeHtml(actor.actorKey)}" data-id="${escapeHtml(item.id)}" aria-label="卸下${escapeHtml(item.name)}"><span>${escapeHtml(item.category)}</span>${escapeHtml(item.name)} ×</button>`).join('')
      : '<div class="wardrobe-actor-empty">尚未设置衣柜穿搭</div>'}</div>
    <div class="wardrobe-actor-current-actions">
      <button type="button" class="wardrobe-btn" data-wardrobe-action="actor-browse-items" data-actor-key="${escapeHtml(actor.actorKey)}">选择单品</button>
      <button type="button" class="wardrobe-btn" data-wardrobe-action="actor-browse-outfits" data-actor-key="${escapeHtml(actor.actorKey)}">选择套装</button>
      <button type="button" class="wardrobe-btn danger" data-wardrobe-action="actor-clear-outfit" data-actor-key="${escapeHtml(actor.actorKey)}"${currentItems.length ? '' : ' disabled'}>清空穿搭</button>
    </div>
  </section>`;
}

function renderActorPool(
  state: WardrobeState,
  actor: WardrobeRosterEntry,
  profile: WardrobeActorProfile,
): string {
  const poolOutfits = profile.outfitPoolIds
    .map(outfitId => state.outfits.find(outfit => outfit.id === outfitId))
    .filter((outfit): outfit is OutfitPreset => !!outfit);
  const randomIds = new Set(profile.randomOutfitIds);
  const hasRandomCandidate = poolOutfits.some(outfit => randomIds.has(outfit.id) && isWearableOutfit(state, outfit));
  return `<section class="wardrobe-actor-pool" aria-labelledby="wardrobeActorPoolTitle">
    <div class="wardrobe-actor-section-head">
      <div><h2 id="wardrobeActorPoolTitle">每日套装池</h2><div class="wardrobe-muted">从已加入的套装中挑选每日随机候选。</div></div>
      <div class="wardrobe-actor-section-actions">
        <button type="button" class="wardrobe-btn" data-wardrobe-action="actor-open-pool-add" data-actor-key="${escapeHtml(actor.actorKey)}">加入套装</button>
        <button type="button" class="wardrobe-btn" data-wardrobe-action="actor-open-pool-manager" data-actor-key="${escapeHtml(actor.actorKey)}">管理套装池</button>
      </div>
    </div>
    <label class="wardrobe-auto-random${hasRandomCandidate ? '' : ' is-disabled'}">
      <span><strong>日期变化自动随机</strong><small>${hasRandomCandidate ? '进入新日期时，从随机候选中换上一套。' : '请先把至少一个可穿套装加入随机候选。'}</small></span>
      <button type="button" class="wardrobe-switch" role="switch" aria-checked="${profile.autoRandomEnabled}" data-wardrobe-action="actor-set-auto-random" data-actor-key="${escapeHtml(actor.actorKey)}" data-enabled="${!profile.autoRandomEnabled}"${hasRandomCandidate ? '' : ' disabled'}><span aria-hidden="true"></span><span class="sr-only">${profile.autoRandomEnabled ? '关闭' : '开启'}日期变化自动随机</span></button>
    </label>
    <div class="wardrobe-actor-pool-list">${poolOutfits.length ? poolOutfits.map(outfit => {
      const random = randomIds.has(outfit.id);
      const first = state.items.find(item => outfit.itemIds.includes(item.id));
      const imageLike = { name: outfit.name, category: first?.category || '连体服', imagePath: outfit.imagePath } as WardrobeItem;
      return `<article class="wardrobe-pool-card" data-wardrobe-pool-card="${escapeHtml(outfit.id)}">
        <div class="wardrobe-pool-card-image wardrobe-outfit-image">${renderImage(imageLike)}</div>
        <div class="wardrobe-pool-card-copy">
          <div class="wardrobe-pool-card-title"><strong>${escapeHtml(outfit.name)}</strong>${random ? '<span class="wardrobe-random-badge">随机 ✓</span>' : ''}</div>
          ${outfit.description ? `<p>${escapeHtml(outfit.description)}</p>` : ''}
          <div class="wardrobe-pool-card-actions">
            <button type="button" class="wardrobe-btn primary" data-wardrobe-action="wear-outfit" data-actor-key="${escapeHtml(actor.actorKey)}" data-id="${escapeHtml(outfit.id)}">穿上</button>
            <button type="button" class="wardrobe-btn" data-wardrobe-action="actor-toggle-random-candidate" data-actor-key="${escapeHtml(actor.actorKey)}" data-id="${escapeHtml(outfit.id)}">${random ? '移出随机' : '加入随机'}</button>
            <button type="button" class="wardrobe-btn danger" data-wardrobe-action="actor-remove-outfit-from-pool" data-actor-key="${escapeHtml(actor.actorKey)}" data-id="${escapeHtml(outfit.id)}">移出套装池</button>
          </div>
        </div>
      </article>`;
    }).join('') : '<div class="wardrobe-actor-empty">套装池还是空的，点击“管理套装池”添加套装。</div>'}</div>
  </section>`;
}

function renderActorWorkbench(state: WardrobeState, view: WardrobePanelView): string {
  const { roster, actor, profile } = actorContext(state, view);
  const search = String(view.actorSearch || '').trim().toLocaleLowerCase();
  const visibleRoster = roster.filter(entry => !search
    || entry.displayName.toLocaleLowerCase().includes(search));
  if (!actor || !profile) {
    return `<div class="wardrobe-content wardrobe-actor-content">
      <div class="wardrobe-actor-workbench">
        <aside class="wardrobe-actor-rail" aria-label="衣柜角色">
          <label class="wardrobe-search wardrobe-actor-search">搜索角色<input id="wardrobeActorSearch" value="${escapeHtml(view.actorSearch || '')}" placeholder="角色名"></label>
          <div class="wardrobe-actor-empty">暂无可管理角色</div>
        </aside>
      </div>
    </div>`;
  }
  // 「选择单品」弹窗刻意排在 body 内容里（其余弹窗在 body 外）：点击即穿的「当前」徽标读 _state，
  // 必须随数据 tick 走 refreshWardrobeContent 的局部重画；其余弹窗只管自己的表单，留在 body 外避免被 tick 打断。
  return `<div class="wardrobe-content wardrobe-actor-content">
    <div class="wardrobe-actor-workbench">
      <aside class="wardrobe-actor-rail" aria-label="衣柜角色">
        <label class="wardrobe-search wardrobe-actor-search">搜索角色<input id="wardrobeActorSearch" value="${escapeHtml(view.actorSearch || '')}" placeholder="角色名"></label>
        <div class="wardrobe-actor-list" role="listbox" aria-label="选择衣柜角色">${visibleRoster.length
          ? visibleRoster.map(entry => `<button type="button" class="wardrobe-actor-option" role="option" data-wardrobe-actor="${escapeHtml(entry.actorKey)}" aria-selected="${entry.actorKey === actor.actorKey}">
            <span>${escapeHtml(entry.displayName)}</span><small>${entry.kind === 'protagonist' ? '主角' : entry.present ? '在场' : '角色'}</small>
          </button>`).join('')
          : '<div class="wardrobe-actor-empty">没有匹配的角色</div>'}</div>
      </aside>
      ${renderActorCurrentOutfit(state, actor, profile)}
      ${renderActorPool(state, actor, profile)}
    </div>
    ${renderActorItemPicker(state, view)}
  </div>`;
}

function renderPoolManager(
  state: WardrobeState,
  view: WardrobePanelView,
): string {
  if (!view.poolManagerOpen) return '';
  const { actor, profile } = actorContext(state, view);
  if (!actor || !profile) return '';
  const search = String(view.poolSearch || '').trim().toLocaleLowerCase();
  const visibleOutfits = state.outfits.filter(outfit => !search
    || [outfit.name, outfit.description].some(value =>
      String(value || '').toLocaleLowerCase().includes(search)));
  const draftIds = new Set(view.poolDraftIds || profile.outfitPoolIds);
  return `<div class="wardrobe-modal-backdrop">
    <section class="wardrobe-modal wardrobe-pool-manager" role="dialog" aria-modal="true" aria-label="管理${escapeHtml(actor.displayName)}的套装池">
      <div class="wardrobe-detail-head"><div><strong>管理套装池</strong><div class="wardrobe-muted">${escapeHtml(actor.displayName)}</div></div><button type="button" class="wardrobe-close" data-wardrobe-action="actor-cancel-pool" aria-label="关闭套装池管理">×</button></div>
      <label class="wardrobe-search wardrobe-pool-search">搜索套装<input id="wardrobePoolSearch" value="${escapeHtml(view.poolSearch || '')}" placeholder="名称或描述"></label>
      <div class="wardrobe-pool-manager-list">${visibleOutfits.length ? visibleOutfits.map(outfit => `<label class="wardrobe-pool-manager-option">
        <input type="checkbox" data-wardrobe-pool-outfit="${escapeHtml(outfit.id)}"${draftIds.has(outfit.id) ? ' checked' : ''}>
        <span><strong>${escapeHtml(outfit.name)}</strong>${outfit.description ? `<small>${escapeHtml(outfit.description)}</small>` : ''}</span>
      </label>`).join('') : '<div class="wardrobe-actor-empty">没有匹配的套装</div>'}</div>
      <div class="wardrobe-detail-actions wardrobe-pool-manager-actions">
        <button type="button" class="wardrobe-btn" data-wardrobe-action="actor-cancel-pool">取消</button>
        <button type="button" class="wardrobe-btn primary" data-wardrobe-action="actor-save-pool" data-actor-key="${escapeHtml(actor.actorKey)}">保存套装池</button>
      </div>
    </section>
  </div>`;
}

function renderActorItemPicker(state: WardrobeState, view: WardrobePanelView): string {
  if (!view.actorItemPickerOpen) return '';
  const { actor, profile } = actorContext(state, view);
  if (!actor || !profile) return '';
  const category = view.pickerCategory || '全部';
  const search = String(view.pickerSearch || '').trim().toLocaleLowerCase();
  const wornIds = new Set(selectionItemIds(profile.currentOutfit));
  const visible = state.items.filter(item => {
    if (category !== '全部' && item.category !== category) return false;
    if (!search) return true;
    return [item.name, item.description, item.category, item.source]
      .some(value => String(value || '').toLocaleLowerCase().includes(search));
  });
  const counts = new Map<string, number>([['全部', state.items.length]]);
  for (const item of state.items) counts.set(item.category, (counts.get(item.category) || 0) + 1);
  const cats = ['全部', ...WARDROBE_CATEGORIES].map(candidate =>
    `<button type="button" class="wardrobe-picker-cat" data-wardrobe-picker-category="${escapeHtml(candidate)}" aria-pressed="${candidate === category}">${escapeHtml(candidate)}（${counts.get(candidate) || 0}）</button>`,
  ).join('');
  return `<div class="wardrobe-modal-backdrop">
    <section class="wardrobe-modal wardrobe-picker" role="dialog" aria-modal="true" aria-label="给${escapeHtml(actor.displayName)}选择单品">
      <div class="wardrobe-detail-head"><strong>给${escapeHtml(actor.displayName)}选择单品</strong><button type="button" class="wardrobe-close" data-wardrobe-action="actor-close-picker" aria-label="关闭">×</button></div>
      <div class="wardrobe-picker-cats">${cats}</div>
      <label class="wardrobe-search wardrobe-picker-search">搜索<input id="wardrobePickerSearch" value="${escapeHtml(view.pickerSearch || '')}" placeholder="名称、描述、类别或来源"></label>
      <div class="wardrobe-picker-list">${visible.length ? visible.map(item => {
        const worn = wornIds.has(item.id);
        return `<button type="button" class="wardrobe-picker-item${worn ? ' is-worn' : ''}" data-wardrobe-action="actor-pick-item" data-actor-key="${escapeHtml(actor.actorKey)}" data-id="${escapeHtml(item.id)}">
          <span class="wardrobe-picker-name">${escapeHtml(item.name)}</span>
          <span class="wardrobe-picker-meta">${wardrobeItemMetaHtml(item.category, item.source)}</span>
          ${worn ? '<span class="wardrobe-picker-worn">当前</span>' : ''}
        </button>`;
      }).join('') : '<div class="wardrobe-empty">这个部位还没有服饰</div>'}</div>
    </section>
  </div>`;
}

function renderActorOutfitPicker(state: WardrobeState, view: WardrobePanelView): string {
  if (!view.actorOutfitPickerOpen) return '';
  const { actor, profile } = actorContext(state, view);
  if (!actor || !profile) return '';
  const search = String(view.pickerSearch || '').trim().toLocaleLowerCase();
  const visible = state.outfits.filter(outfit => !search
    || [outfit.name, outfit.description].some(value =>
      String(value || '').toLocaleLowerCase().includes(search)));
  return `<div class="wardrobe-modal-backdrop">
    <section class="wardrobe-modal wardrobe-picker" role="dialog" aria-modal="true" aria-label="给${escapeHtml(actor.displayName)}选择套装">
      <div class="wardrobe-detail-head"><strong>给${escapeHtml(actor.displayName)}选择套装</strong><button type="button" class="wardrobe-close" data-wardrobe-action="actor-close-picker" aria-label="关闭">×</button></div>
      <label class="wardrobe-search wardrobe-picker-search">搜索<input id="wardrobePickerSearch" value="${escapeHtml(view.pickerSearch || '')}" placeholder="名称或描述"></label>
      <div class="wardrobe-picker-list">${visible.length ? visible.map(outfit => `<button type="button" class="wardrobe-picker-item" data-wardrobe-action="actor-pick-outfit" data-actor-key="${escapeHtml(actor.actorKey)}" data-id="${escapeHtml(outfit.id)}">
        <span class="wardrobe-picker-name">${escapeHtml(outfit.name)}</span>
        <span class="wardrobe-picker-meta">${wardrobeOutfitMetaHtml(outfit.itemIds.length, outfit.sourceCard)}</span>
      </button>`).join('') : '<div class="wardrobe-empty">还没有套装预设</div>'}</div>
    </section>
  </div>`;
}

function renderActorPoolAdd(state: WardrobeState, view: WardrobePanelView): string {
  if (!view.actorPoolAddOpen) return '';
  const { actor, profile } = actorContext(state, view);
  if (!actor || !profile) return '';
  const search = String(view.pickerSearch || '').trim().toLocaleLowerCase();
  const poolIds = new Set(profile.outfitPoolIds);
  const visible = state.outfits.filter(outfit => !search
    || [outfit.name, outfit.description].some(value =>
      String(value || '').toLocaleLowerCase().includes(search)));
  return `<div class="wardrobe-modal-backdrop">
    <section class="wardrobe-modal wardrobe-picker" role="dialog" aria-modal="true" aria-label="加入套装池">
      <div class="wardrobe-detail-head"><div><strong>加入套装池</strong><div class="wardrobe-muted">${escapeHtml(actor.displayName)}</div></div><button type="button" class="wardrobe-close" data-wardrobe-action="actor-close-picker" aria-label="关闭">×</button></div>
      <label class="wardrobe-search wardrobe-picker-search">搜索<input id="wardrobePickerSearch" value="${escapeHtml(view.pickerSearch || '')}" placeholder="名称或描述"></label>
      <div class="wardrobe-picker-list">${visible.length ? visible.map(outfit => {
        const inPool = poolIds.has(outfit.id);
        return `<label class="wardrobe-picker-check${inPool ? ' is-in-pool' : ''}">
          <input type="checkbox" data-wardrobe-pool-add="${escapeHtml(outfit.id)}"${inPool ? ' checked disabled' : ''}>
          <span class="wardrobe-picker-name">${escapeHtml(outfit.name)}</span>
          <span class="wardrobe-picker-meta">${outfit.itemIds.length} 件</span>
          ${inPool ? '<span class="wardrobe-picker-worn">已加入</span>' : ''}
        </label>`;
      }).join('') : '<div class="wardrobe-empty">还没有套装预设</div>'}</div>
      <div class="wardrobe-detail-actions wardrobe-picker-actions">
        <button type="button" class="wardrobe-btn" data-wardrobe-action="actor-close-picker">取消</button>
        <button type="button" class="wardrobe-btn primary" data-wardrobe-action="actor-submit-pool-add" data-actor-key="${escapeHtml(actor.actorKey)}">加入套装池</button>
      </div>
    </section>
  </div>`;
}

function batchStatusText(batch: WardrobeGenerationBatch): string {
  const labels: Record<string, string> = {
    preparing: '正在批量生成提示词',
    running: '正在生成图片',
    completed: '批次已完成',
    cancelled: '批次已取消',
    interrupted: '批次已中断',
  };
  return labels[batch.status] || batch.status;
}

function taskStatusText(status: string): string {
  return ({
    waiting_prompt: '等待提示词', queued: '排队中', running: '生成中',
    success: '已完成', failed: '失败', cancelled: '已取消', interrupted: '已中断',
  } as Record<string, string>)[status] || status;
}

function renderQueue(state: WardrobeState, batch: WardrobeGenerationBatch | null): string {
  if (!batch) return '<div class="wardrobe-content"><div class="wardrobe-empty">暂无生图任务</div></div>';
  const byId = new Map([
    ...state.items.map(item => [item.id, item.name] as const),
    ...state.outfits.map(outfit => [outfit.id, outfit.name] as const),
  ]);
  return `<div class="wardrobe-content">
    <div class="wardrobe-queue-summary"><strong>${escapeHtml(batchStatusText(batch))}</strong>
      <span class="wardrobe-toolbar-spacer"></span>
      <button type="button" class="wardrobe-btn danger" data-wardrobe-action="cancel-batch">取消批次</button>
      <button type="button" class="wardrobe-btn" data-wardrobe-action="retry-failed">重试失败项</button>
      ${batch.status === 'interrupted' ? '<button type="button" class="wardrobe-btn primary" data-wardrobe-action="continue-batch">继续剩余项</button>' : ''}
    </div>
    ${batch.error ? `<div class="wardrobe-task-error">${escapeHtml(batch.error)}</div>` : ''}
    <div class="wardrobe-queue-list">${batch.tasks.map(task => `<div class="wardrobe-task">
      <span>${escapeHtml(byId.get(task.targetId) || task.targetId)}</span>
      <strong class="wardrobe-status-${escapeHtml(task.status)}">${escapeHtml(taskStatusText(task.status))}</strong>
      ${task.error ? `<span class="wardrobe-task-error">${escapeHtml(task.error)}</span>` : ''}
    </div>`).join('')}</div>
  </div>`;
}

function renderItemForm(state: WardrobeState, view: WardrobePanelView): string {
  if (!view.itemFormOpen) return '';
  const item = view.itemFormId ? state.items.find(candidate => candidate.id === view.itemFormId) : null;
  const title = item ? '编辑服饰' : '手动添加服饰';
  const draft = view.itemDraft || {
    name: item?.name || '',
    category: item?.category || WARDROBE_CATEGORIES[0],
    description: item?.description || '',
    tags: item?.tags || '',
  };
  return `<div class="wardrobe-modal-backdrop">
    <section class="wardrobe-modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="wardrobe-detail-head"><strong>${title}</strong><button type="button" class="wardrobe-close" data-wardrobe-action="cancel-dialog" aria-label="关闭">×</button></div>
      <label class="wardrobe-field">名称<input id="wardrobeItemName" maxlength="40" value="${escapeHtml(draft.name)}"></label>
      <label class="wardrobe-field">类别<select id="wardrobeItemCategory">${WARDROBE_CATEGORIES.map(category => `<option value="${category}"${draft.category === category ? ' selected' : ''}>${category}</option>`).join('')}</select></label>
      <label class="wardrobe-field">纯服饰视觉描述<textarea id="wardrobeItemDescription">${escapeHtml(draft.description)}</textarea></label>
      ${item
        ? `<label class="wardrobe-field">标签 tags<textarea id="wardrobeItemTags" maxlength="500" placeholder="生成单品展示图时产出，供套装重组与立绘换装复用">${escapeHtml(draft.tags || '')}</textarea></label>
      <p class="wardrobe-muted">由生成单品展示图时产出；清空后保存，该服饰视为未生成标签。</p>`
        : ''}
      ${item?.imagePath ? '<p class="wardrobe-muted">修改资料会保留旧图；若图片与新资料不一致，请自行重新生成。</p>' : ''}
      <div class="wardrobe-detail-actions">
        <button type="button" class="wardrobe-btn" data-wardrobe-action="cancel-dialog">取消</button>
        <button type="button" class="wardrobe-btn primary" data-wardrobe-action="submit-item" data-id="${escapeHtml(item?.id || '')}">保存</button>
      </div>
    </section>
  </div>`;
}

function renderExtractionReview(view: WardrobePanelView): string {
  const candidates = view.extractionCandidates;
  if (!candidates) return '';
  const selected = new Set(view.extractionSelected || candidates.map((_candidate, index) => index));
  return `<div class="wardrobe-modal-backdrop">
    <section class="wardrobe-modal wardrobe-extraction-review" role="dialog" aria-modal="true" aria-label="AI 设计审核">
      <div class="wardrobe-detail-head"><strong>AI 设计审核</strong><button type="button" class="wardrobe-close" data-wardrobe-action="cancel-dialog" aria-label="关闭">×</button></div>
      <p class="wardrobe-muted">确认、编辑并选择要保存的分件；这些单品不会自动绑定任何人物。</p>
      <div class="wardrobe-extraction-list">${candidates.map((candidate, index) => `<div class="wardrobe-extraction-row no-source">
        <input type="checkbox" data-wardrobe-extract-index="${index}" aria-label="选择${escapeHtml(candidate.name)}"${selected.has(index) ? ' checked' : ''}>
        <input data-wardrobe-extract-name="${index}" maxlength="40" aria-label="服饰名称" value="${escapeHtml(candidate.name)}">
        <select data-wardrobe-extract-category="${index}" aria-label="服饰类别">${WARDROBE_CATEGORIES.map(category => `<option value="${category}"${candidate.category === category ? ' selected' : ''}>${category}</option>`).join('')}</select>
        <textarea data-wardrobe-extract-description="${index}" aria-label="服饰描述">${escapeHtml(candidate.description)}</textarea>
      </div>`).join('')}</div>
      <div class="wardrobe-detail-actions">
        <button type="button" class="wardrobe-btn" data-wardrobe-action="extract-select-all">全选/全不选</button>
        <button type="button" class="wardrobe-btn" data-wardrobe-action="cancel-dialog">取消</button>
        <button type="button" class="wardrobe-btn primary" data-wardrobe-action="submit-extraction">加入衣柜</button>
      </div>
    </section>
  </div>`;
}

/** 「AI 设计穿搭」设计指令弹窗（双用途：设计新服饰 / 整理在场角色既有穿着）。 */
function renderDesignDialog(view: WardrobePanelView): string {
  if (!view.designDialogOpen) return '';
  const busy = view.designBusy === true;
  return `<div class="wardrobe-modal-backdrop">
    <section class="wardrobe-modal" role="dialog" aria-modal="true" aria-label="AI 设计穿搭">
      <div class="wardrobe-detail-head"><strong>AI 设计穿搭</strong>${busy ? '' : '<button type="button" class="wardrobe-close" data-wardrobe-action="cancel-dialog" aria-label="关闭">×</button>'}</div>
      <p class="wardrobe-muted">输入希望生成的穿搭要求。AI 会参考在场角色资料、世界书与最近剧情，拆成不绑定具体人物的独立单品；也可输入「整理在场角色的当前穿搭」提取既有穿着。</p>
      <label class="wardrobe-field">设计要求<textarea id="wardrobeDesignPrompt" maxlength="500" style="min-height:120px;resize:vertical" placeholder="例如：&#10;· 设计一套冬季校服&#10;· 设计一款婚戒&#10;· 给珞花设计一套约会装&#10;· 整理在场角色的当前穿搭">${escapeHtml(view.designPrompt || '')}</textarea></label>
      <label class="wardrobe-picker-check"><input type="checkbox" id="wardrobeDesignCreateOutfit"${view.designCreateOutfit ? ' checked' : ''}><span>分件保存后继续保存为套装</span></label>
      <p class="wardrobe-muted">单品会先加入衣柜；随后即使取消套装编辑，单品也会保留。</p>
      <div class="wardrobe-detail-actions">
        <button type="button" class="wardrobe-btn" data-wardrobe-action="cancel-dialog"${busy ? ' disabled' : ''}>取消</button>
        <button type="button" class="wardrobe-btn primary" data-wardrobe-action="submit-design"${busy ? ' disabled aria-busy="true"' : ''}>${busy ? '正在生成…' : '生成分件'}</button>
      </div>
    </section>
  </div>`;
}

function renderConfirmation(view: WardrobePanelView): string {
  if (!view.confirmAction) return '';
  const isPoolRemoval = view.confirmAction === 'actor-remove-outfit-from-pool';
  const isItem = view.confirmAction === 'delete-item-confirmed';
  const isBatchDelete = view.confirmAction === 'delete-selected-confirmed';
  if (isPoolRemoval) {
    return `<div class="wardrobe-modal-backdrop">
      <section class="wardrobe-modal wardrobe-confirm" role="alertdialog" aria-modal="true" aria-label="确认移出套装池">
        <strong>确认移出套装池？</strong>
        <p>只会从当前角色的套装池与每日随机候选中移除，不会删除套装或图片。</p>
        <div class="wardrobe-detail-actions">
          <button type="button" class="wardrobe-btn" data-wardrobe-action="cancel-dialog">取消</button>
          <button type="button" class="wardrobe-btn danger" data-wardrobe-action="actor-remove-outfit-from-pool" data-actor-key="${escapeHtml(view.actorKey || '')}" data-id="${escapeHtml(view.confirmId || '')}" data-confirmed="true">确认移出</button>
        </div>
      </section>
    </div>`;
  }
  if (isBatchDelete) {
    const count = view.confirmIds?.length || 0;
    return `<div class="wardrobe-modal-backdrop">
      <section class="wardrobe-modal wardrobe-confirm" role="alertdialog" aria-modal="true" aria-label="确认批量删除">
        <strong>确认删除选中的 ${count} 件服饰？</strong>
        <p>记录会先从当前聊天移除，关联的唯一图片随后删除；被套装或角色当前穿搭引用的服饰会自动跳过。</p>
        <div class="wardrobe-detail-actions">
          <button type="button" class="wardrobe-btn" data-wardrobe-action="cancel-dialog">取消</button>
          <button type="button" class="wardrobe-btn danger" data-wardrobe-action="delete-selected-confirmed">确认删除</button>
        </div>
      </section>
    </div>`;
  }
  return `<div class="wardrobe-modal-backdrop">
    <section class="wardrobe-modal wardrobe-confirm" role="alertdialog" aria-modal="true" aria-label="确认删除">
      <strong>确认删除${isItem ? '这件服饰' : '这个套装'}？</strong>
      <p>记录会先从当前聊天移除，关联的唯一图片随后删除。图片删除失败不会恢复记录。</p>
      <div class="wardrobe-detail-actions">
        <button type="button" class="wardrobe-btn" data-wardrobe-action="cancel-dialog">取消</button>
        <button type="button" class="wardrobe-btn danger" data-wardrobe-action="${escapeHtml(view.confirmAction)}" data-id="${escapeHtml(view.confirmId || '')}">确认删除</button>
      </div>
    </section>
  </div>`;
}

export function renderWardrobePanelHtml(
  style: StyleType,
  state: WardrobeState,
  queue: WardrobeGenerationBatch | null,
  view: WardrobePanelView = {},
): string {
  const route = view.route || 'items';
  const content = renderWardrobeContent(state, queue, view);
  return `<section class="wardrobe-window wardrobe-theme-${escapeHtml(style)}" role="dialog" aria-modal="true" aria-label="衣柜">
    <header class="wardrobe-head">
      <div class="wardrobe-title">衣柜</div>
      <nav class="wardrobe-routes" role="tablist" aria-label="衣柜页面">${routeButton('items', route)}${routeButton('outfits', route)}${routeButton('actors', route)}${routeButton('queue', route)}</nav>
      <button type="button" class="wardrobe-close" data-wardrobe-action="close-panel" aria-label="关闭衣柜">×</button>
    </header>
    <div class="wardrobe-body" role="tabpanel">${content}</div>
    ${renderItemForm(state, view)}
    ${renderExtractionReview(view)}
    ${renderDesignDialog(view)}
    ${renderConfirmation(view)}
    ${renderPoolManager(state, view)}
    ${renderActorOutfitPicker(state, view)}
    ${renderActorPoolAdd(state, view)}
  </section>`;
}

// 数据内容区（.wardrobe-body 内）——数据级局部刷新与整窗渲染共用同一事实源。
function renderWardrobeContent(
  state: WardrobeState,
  queue: WardrobeGenerationBatch | null,
  view: WardrobePanelView,
): string {
  const route = view.route || 'items';
  return route === 'items'
    ? renderItems(state, view, queue)
    : route === 'outfits'
      ? renderOutfits(state, view, queue)
      : route === 'actors'
        ? renderActorWorkbench(state, view)
        : renderQueue(state, queue);
}

export function injectWardrobeCss(enabled = getConfig().wardrobeEnabled): void {
  if (!enabled) return;
  ensureStyleOnce(CSS_ID, WARDROBE_BASE_CSS); // U35：收编幂等注入（enabled 闸保留；removeWardrobeCss 不变）
}

export function removeWardrobeCss(): void {
  if (typeof document === 'undefined') return;
  document.getElementById(CSS_ID)?.remove();
}

export function setWardrobeQueueController(controller: WardrobeQueueUiController | null): void {
  _queueUnsubscribe?.();
  _queueUnsubscribe = null;
  _queueController = controller;
  _queueSnapshot = controller?.getSnapshot() || null;
  const overlay = typeof document !== 'undefined' ? document.getElementById('panelOverlay') : null;
  if (controller && overlay?.classList.contains('wardrobe-overlay')) {
    _queueUnsubscribe = controller.subscribe(snapshot => {
      _queueSnapshot = snapshot;
      refreshWardrobePanel();
    });
  }
}

function dispatchAction(action: string, id = '', payload?: unknown): void {
  if (typeof window === 'undefined') return;
  const detail = buildWardrobeActionDetail(_view, action, id, payload);
  _view.actorKey = detail.view.actorKey;
  _view.wearTargetActorKey = detail.view.wearTargetActorKey;
  _view.poolTargetActorKey = detail.view.poolTargetActorKey;
  emitUbEvent(UB_EVENT.wardrobeAction, detail);
}

function currentOverlay(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.getElementById('panelOverlay');
}

function collectPresentCharacterNames(): string[] {
  const presenceSheet = getSheetByName('在场角色表');
  const presentCharacters: string[] = [];
  for (let row = 1; row < (presenceSheet?.content?.length || 1); row++) {
    const name = getCellByHeader('在场角色表', row, '姓名');
    if (name && !presentCharacters.includes(name)) presentCharacters.push(name);
  }
  return presentCharacters;
}

function refreshWardrobeRosterView(): void {
  _view = reconcileWardrobePanelRosterView(
    _view,
    collectWardrobeRoster() ?? [],
    collectPresentCharacterNames(),
  ) as typeof _view;
  // 模特角色候选随名册刷新；story 模式下所选角色不在候选时回落第一个（角色表变动/切卡自愈）
  _view.outfitModelCharacters = collectOutfitModelCandidates() ?? [];
  if (_view.outfitModelMode === 'story') {
    const names = _view.outfitModelCharacters;
    const current = String(_view.outfitModelCharacter || '');
    if (names.length && !names.includes(current)) _view.outfitModelCharacter = names[0];
  }
}

let _lastWardrobeBodyHtml = '';

// 整窗 innerHTML 重建会清掉所有滚动容器的位置（角色列表/单品网格/抽屉…），而绝大多数点击
// （选角色、开合抽屉与弹窗、勾选）只是局部换状态，用户不该被拽回顶部 ⇒ 默认保位。
// 只有「换主体」的操作才显式传 false 回顶：切页签 setRoute / 换分类筛选 / 换搜索词。
function rerender(preserveScroll = true): void {
  const overlay = currentOverlay();
  if (!overlay || !_state || !overlay.classList.contains('wardrobe-overlay')) return;
  const scrolls = preserveScroll ? collectScrollPositions(overlay) : null;
  _lastWardrobeBodyHtml = renderWardrobeContent(_state, _queueSnapshot, _view);
  overlay.innerHTML = renderWardrobePanelHtml(_style, _state, _queueSnapshot, _view);
  if (scrolls) restoreScrollPositions(overlay, scrolls);
}

// 数据级局部刷新：store/队列等数据 tick 时只换 .wardrobe-body 内容，
// 壳/header/模态/overlay 级委托全保留（委托在 overlay 上不随 body 重建丢失）。
// 内容未变则零触碰——用上次渲染的字符串缓存比对（同源字符串比较，非 innerHTML 序列化比对）。
function refreshWardrobeContent(): void {
  const overlay = currentOverlay();
  if (!overlay || !_state || !overlay.classList.contains('wardrobe-overlay')) return;
  const body = overlay.querySelector<HTMLElement>('.wardrobe-body');
  if (!body) return;
  const html = renderWardrobeContent(_state, _queueSnapshot, _view);
  if (_lastWardrobeBodyHtml === html) return;
  _lastWardrobeBodyHtml = html;
  const scrolls = collectScrollPositions(body);
  body.innerHTML = html;
  if (scrolls.length) restoreScrollPositions(body, scrolls);
}

// 重建前保存各滚动容器的索引路径 + scrollTop，重建后按同路径回填（内容变矮时浏览器自行夹紧）。
export function collectScrollPositions(root: HTMLElement): Array<{ path: number[]; scrollTop: number }> {
  const results: Array<{ path: number[]; scrollTop: number }> = [];
  const collect = (element: HTMLElement, path: number[]): void => {
    if (element.scrollHeight > element.clientHeight) results.push({ path, scrollTop: element.scrollTop });
    for (let index = 0; index < element.children.length; index++) {
      collect(element.children[index] as HTMLElement, [...path, index]);
    }
  };
  collect(root, []);
  return results;
}

export function restoreScrollPositions(root: HTMLElement, scrolls: Array<{ path: number[]; scrollTop: number }>): void {
  for (const { path, scrollTop } of scrolls) {
    let element = root;
    for (const index of path) {
      element = element.children[index] as HTMLElement;
      if (!element) break;
    }
    if (element && element !== root && element.scrollTop !== undefined) {
      element.scrollTop = scrollTop;
    }
  }
}

/** 关掉右侧详情抽屉；返回是否真的关了一层（供「点暗区」判断该退一层还是整壳关闭）。 */
function closeWardrobeDetailDrawer(): boolean {
  if (!_view.detailId && !_view.outfitDetailId) return false;
  delete _view.detailId;
  delete _view.outfitDetailId;
  rerender();
  return true;
}

/** 详情抽屉大图 → 宿主全屏放大（与正文插图/立绘/物品总览共用同一 lightbox 组件）。
 *  读 `getAttribute('src')` 保归一化时的相对路径形态；再过一次安全门（无图时渲染的是占位符、没有 img 节点，天然不响应）。 */
function openWardrobeDetailZoom(image: HTMLImageElement): void {
  const path = image.getAttribute('src') || '';
  if (!isSafeStoredImagePath(path)) return;
  openHostLightbox({ paths: [path] });
}

/** 抽屉没有遮罩：点抽屉以外任何空白都算「退一层」（与 ESC／安卓返回键同语义）。
 *  抽屉内空白、压住抽屉的弹窗内部、以及工具条上的输入/下拉/按钮都不算「点空白」，抽屉保持打开。 */
function closeWardrobeDetailOnOutsideClick(target: HTMLElement): void {
  if (!_view.detailId && !_view.outfitDetailId) return;
  if (target.closest('.wardrobe-detail') || target.closest('.wardrobe-modal-backdrop')) return;
  if (target.closest('input,select,textarea,label,button')) return;
  closeWardrobeDetailDrawer();
}

function setRoute(route: WardrobeRoute): void {
  _view.route = route;
  delete _view.detailId;
  delete _view.outfitDetailId;
  _view.editorOpen = false;
  delete _view.outfitDraft;
  _view.poolManagerOpen = false;
  delete _view.poolDraftIds;
  delete _view.poolSearch;
  rerender(false); // 换页签＝换主体：滚动容器同路径但内容全换，保位会把上一页的偏移搬过来
}

function bindOverlayEvents(overlay: HTMLElement): void {
  overlay.onclick = event => {
    const target = event.target as HTMLElement;
    if (target === overlay) {
      if (Date.now() - _openedAt >= 300) {
        // 衣柜外暗区：抽屉打开时先退一层（与 ESC 同语义），没抽屉才关整个衣柜
        if (!closeWardrobeDetailDrawer()) closeWardrobePanel();
      }
      return;
    }
    if (target.classList.contains('wardrobe-modal-backdrop')) {
      // 选择器弹窗（无脏数据）：遮罩=关闭
      if (_view.actorItemPickerOpen || _view.actorOutfitPickerOpen || _view.actorPoolAddOpen) {
        _view.actorItemPickerOpen = false;
        _view.actorOutfitPickerOpen = false;
        _view.actorPoolAddOpen = false;
        delete _view.pickerSearch;
        rerender();
        return;
      }
      // 确认弹窗：遮罩=取消
      if (_view.confirmAction) {
        delete _view.confirmAction;
        delete _view.confirmId;
        delete _view.confirmIds;
        rerender();
        return;
      }
      // 单品表单未输入过（itemDraft 只在用户键入后才存在）：遮罩=关闭；已输入则防误触，须走关闭/取消按钮
      if (_view.itemFormOpen && !_view.itemDraft) {
        _view.itemFormOpen = false;
        delete _view.itemFormId;
        rerender();
        return;
      }
      return;
    }
    const route = target.closest<HTMLElement>('[data-wardrobe-route]')?.dataset.wardrobeRoute as WardrobeRoute | undefined;
    if (route) { setRoute(route); return; }
    const category = target.closest<HTMLElement>('[data-wardrobe-category]')?.dataset.wardrobeCategory;
    if (category) { _view.category = category; delete _view.detailId; rerender(false); return; }
    const editorCat = target.closest<HTMLElement>('[data-wardrobe-editor-category]')?.dataset.wardrobeEditorCategory;
    if (editorCat) { _view.editorCategory = editorCat; rerender(false); return; }
    const pickerCat = target.closest<HTMLElement>('[data-wardrobe-picker-category]')?.dataset.wardrobePickerCategory;
    if (pickerCat) { _view.pickerCategory = pickerCat; rerender(false); return; }
    const detailId = target.closest<HTMLElement>('[data-wardrobe-detail]')?.dataset.wardrobeDetail;
    if (detailId) { _view.detailId = detailId; rerender(); return; }
    const outfitDetailId = target.closest<HTMLElement>('[data-wardrobe-outfit-detail]')?.dataset.wardrobeOutfitDetail;
    if (outfitDetailId) { _view.outfitDetailId = outfitDetailId; rerender(); return; }
    const actorKey = target.closest<HTMLElement>('[data-wardrobe-actor]')?.dataset.wardrobeActor;
    if (actorKey) {
      _view.actorKey = actorKey;
      _view.wearTargetActorKey = actorKey;
      _view.poolTargetActorKey = actorKey;
      delete _view.detailId;
      delete _view.outfitDetailId;
      _view.poolManagerOpen = false;
      delete _view.poolDraftIds;
      delete _view.poolSearch;
      rerender();
      return;
    }
    const step = Number(target.closest<HTMLElement>('[data-wardrobe-editor-step]')?.dataset.wardrobeEditorStep);
    if (step >= 1 && step <= 3) { _view.editorStep = step as 1 | 2 | 3; rerender(); return; }
    const zoomImage = target.closest<HTMLImageElement>('.wardrobe-detail-image img');
    if (zoomImage) { openWardrobeDetailZoom(zoomImage); return; }
    const actionEl = target.closest<HTMLElement>('[data-wardrobe-action]');
    if (!actionEl) {
      // 落在窗口（工具栏／卡片间隙／当前穿搭条等）但没有具体操作的点击 = 点空白 → 关抽屉
      closeWardrobeDetailOnOutsideClick(target);
      return;
    }
    const action = actionEl.dataset.wardrobeAction || '';
    const id = actionEl.dataset.id || '';
    const actionActorKey = actionEl.dataset.actorKey || '';
    if (actionActorKey) _view.actorKey = actionActorKey;
    if (action === 'close-panel') { closeWardrobePanel(); return; }
    if (action === 'toggle-toolbar') {
      _view.toolbarCollapsed = !(_view.toolbarCollapsed === true);
      rerender();
      return;
    }
    if (action === 'close-detail') { delete _view.detailId; rerender(); return; }
    if (action === 'close-outfit-detail') { delete _view.outfitDetailId; rerender(); return; }
    if (action === 'actor-browse-items' || action === 'actor-browse-outfits') {
      _view.wearTargetActorKey = actionActorKey || _view.actorKey;
      if (action === 'actor-browse-items') {
        _view.actorItemPickerOpen = true;
        _view.pickerCategory = '全部';
      } else {
        _view.actorOutfitPickerOpen = true;
      }
      delete _view.pickerSearch;
      rerender();
      return;
    }
    if (action === 'actor-open-pool-add') {
      _view.actorPoolAddOpen = true;
      delete _view.pickerSearch;
      rerender();
      return;
    }
    if (action === 'actor-close-picker') {
      _view.actorItemPickerOpen = false;
      _view.actorOutfitPickerOpen = false;
      _view.actorPoolAddOpen = false;
      delete _view.pickerSearch;
      rerender();
      return;
    }
    if (action === 'actor-pick-item') {
      if (actionActorKey) _view.wearTargetActorKey = actionActorKey;
      const profile = _state?.actorProfiles[actionActorKey || _view.actorKey || ''];
      const worn = profile ? selectionItemIds(profile.currentOutfit).includes(id) : false;
      dispatchAction(worn ? 'actor-unwear-item' : 'wear-item', id);
      return;
    }
    if (action === 'actor-pick-outfit') {
      _view.actorOutfitPickerOpen = false;
      delete _view.pickerSearch;
      if (actionActorKey) _view.wearTargetActorKey = actionActorKey;
      dispatchAction('wear-outfit', id);
      rerender();
      return;
    }
    if (action === 'actor-submit-pool-add') {
      const checked = Array.from(overlay.querySelectorAll<HTMLInputElement>('[data-wardrobe-pool-add]:checked'))
        .map(box => box.dataset.wardrobePoolAdd || '')
        .filter(Boolean);
      const existing = _state?.actorProfiles[actionActorKey || _view.actorKey || '']?.outfitPoolIds || [];
      _view.actorPoolAddOpen = false;
      delete _view.pickerSearch;
      dispatchAction('actor-save-pool', '', { outfitPoolIds: Array.from(new Set([...existing, ...checked])) });
      rerender();
      return;
    }
    if (action === 'actor-open-pool-manager') {
      const profile = _state?.actorProfiles[actionActorKey || _view.actorKey || ''];
      _view.poolDraftIds = profile?.outfitPoolIds.slice() || [];
      _view.poolManagerOpen = true;
      delete _view.poolSearch;
      rerender();
      return;
    }
    if (action === 'actor-cancel-pool') {
      _view.poolManagerOpen = false;
      delete _view.poolDraftIds;
      delete _view.poolSearch;
      rerender();
      return;
    }
    if (action === 'actor-save-pool') {
      dispatchAction(action, '', { outfitPoolIds: (_view.poolDraftIds || []).slice() });
      return;
    }
    if (action === 'actor-set-auto-random') {
      dispatchAction(action, '', { enabled: actionEl.dataset.enabled === 'true' });
      return;
    }
    if (action === 'actor-remove-outfit-from-pool' && actionEl.dataset.confirmed !== 'true') {
      _view.confirmAction = action;
      _view.confirmId = id;
      rerender();
      return;
    }
    if (action === 'wear-outfit' && _view.route === 'actors') {
      _view.wearTargetActorKey = actionActorKey || _view.actorKey;
    }
    if (action === 'add-item') {
      _view.itemFormOpen = true;
      delete _view.itemFormId;
      _view.itemDraft = { name: '', category: WARDROBE_CATEGORIES[0], description: '' };
      rerender();
      return;
    }
    if (action === 'edit-item') {
      _view.itemFormOpen = true;
      _view.itemFormId = id;
      const item = _state?.items.find(candidate => candidate.id === id);
      _view.itemDraft = {
        name: item?.name || '',
        category: item?.category || WARDROBE_CATEGORIES[0],
        description: item?.description || '',
        tags: item?.tags || '',
      };
      rerender();
      return;
    }
    if (action === 'delete-item' || action === 'delete-outfit') {
      _view.confirmAction = action + '-confirmed';
      _view.confirmId = id;
      rerender();
      return;
    }
    if (action === 'delete-selected') {
      _view.confirmAction = 'delete-selected-confirmed';
      _view.confirmIds = (_view.selectedIds || []).slice();
      rerender();
      return;
    }
    if (action === 'delete-selected-confirmed') {
      dispatchAction(action, '', { itemIds: (_view.confirmIds || []).slice() });
      _view.selectedIds = [];
      delete _view.confirmIds;
      rerender();
      return;
    }
    if (action === 'cancel-dialog') {
      _view.itemFormOpen = false;
      delete _view.itemFormId;
      delete _view.itemDraft;
      delete _view.extractionCandidates;
      delete _view.extractionSelected;
      delete _view.designDialogOpen;
      delete _view.designBusy;
      delete _view.designPrompt;
      delete _view.designCreateOutfit;
      delete _view.designOutfitMeta;
      delete _view.confirmAction;
      delete _view.confirmId;
      delete _view.confirmIds;
      rerender();
      return;
    }
    if (action === 'design-items') {
      _view.designDialogOpen = true;
      delete _view.designBusy;
      rerender();
      return;
    }
    if (action === 'submit-design') {
      const instruction = (overlay.querySelector<HTMLTextAreaElement>('#wardrobeDesignPrompt')?.value || '').trim();
      _view.designCreateOutfit = overlay.querySelector<HTMLInputElement>('#wardrobeDesignCreateOutfit')?.checked === true;
      _view.designPrompt = instruction;
      if (!instruction || _view.designBusy) return;
      _view.designBusy = true;
      rerender();
      dispatchAction('submit-design', '', { instruction, createOutfit: _view.designCreateOutfit === true });
      return;
    }
    if (action === 'suggest-outfit-meta') {
      if (_view.outfitMetaLoading || !(_view.editorItemIds || []).length) return;
      _view.outfitMetaLoading = true;
      rerender();
      dispatchAction('suggest-outfit-meta', '', { itemIds: (_view.editorItemIds || []).slice() });
      return;
    }
    if (action === 'submit-item') {
      dispatchAction(action, id, {
        name: (overlay.querySelector<HTMLInputElement>('#wardrobeItemName')?.value || '').trim(),
        category: overlay.querySelector<HTMLSelectElement>('#wardrobeItemCategory')?.value || '',
        description: (overlay.querySelector<HTMLTextAreaElement>('#wardrobeItemDescription')?.value || '').trim(),
        tags: overlay.querySelector<HTMLTextAreaElement>('#wardrobeItemTags')?.value || '',
      });
      return;
    }
    if (action === 'extract-select-all') {
      const boxes = Array.from(overlay.querySelectorAll<HTMLInputElement>('[data-wardrobe-extract-index]'));
      const next = boxes.some(box => !box.checked);
      boxes.forEach(box => { box.checked = next; });
      _view.extractionSelected = next
        ? boxes.map(box => Number(box.dataset.wardrobeExtractIndex))
        : [];
      return;
    }
    if (action === 'submit-extraction') {
      const candidates = Array.from(overlay.querySelectorAll<HTMLInputElement>('[data-wardrobe-extract-index]'))
        .filter(box => box.checked)
        .map(box => {
          const index = Number(box.dataset.wardrobeExtractIndex);
          return {
            name: (overlay.querySelector<HTMLInputElement>(`[data-wardrobe-extract-name="${index}"]`)?.value || '').trim(),
            category: overlay.querySelector<HTMLSelectElement>(`[data-wardrobe-extract-category="${index}"]`)?.value || '',
            description: (overlay.querySelector<HTMLTextAreaElement>(`[data-wardrobe-extract-description="${index}"]`)?.value || '').trim(),
          };
        });
      dispatchAction(action, '', {
        candidates,
        design: {
          createOutfit: _view.designCreateOutfit === true,
          outfit: _view.designOutfitMeta ? { ..._view.designOutfitMeta } : null,
        },
      });
      return;
    }
    if (action === 'new-outfit') {
      _view.editorOpen = true;
      delete _view.editorOutfitId;
      delete _view.outfitDetailId;
      _view.editorItemIds = [];
      _view.editorStep = 1;
      _view.outfitDraft = { name: '', description: '' };
      rerender();
      return;
    }
    if (action === 'edit-outfit') {
      const outfit = _state?.outfits.find(candidate => candidate.id === id);
      _view.editorOpen = true;
      _view.editorOutfitId = id;
      _view.editorItemIds = outfit?.itemIds.slice() || [];
      _view.editorStep = 1;
      _view.outfitDraft = {
        name: outfit?.name || '',
        description: outfit?.description || '',
      };
      rerender();
      return;
    }
    if (action === 'close-editor') {
      _view.editorOpen = false;
      delete _view.outfitDraft;
      rerender();
      return;
    }
    if (action === 'save-outfit') {
      dispatchAction(action, id, {
        name: (overlay.querySelector<HTMLInputElement>('#wardrobeOutfitName')?.value || '').trim(),
        description: (overlay.querySelector<HTMLTextAreaElement>('#wardrobeOutfitDescription')?.value || '').trim(),
        itemIds: (_view.editorItemIds || []).slice(),
      });
      return;
    }
    if (action === 'toggle-select-all') {
      if (!_state) return;
      const ids = visibleItems(_state, _view).map(item => item.id);
      const allSelected = ids.length > 0 && ids.every(id => (_view.selectedIds || []).includes(id));
      _view.selectedIds = allSelected ? [] : ids;
      rerender();
      return;
    }
    if (action === 'generate-selected') {
      dispatchAction(action, '', { itemIds: (_view.selectedIds || []).slice() });
      return;
    }
    if (action === 'import-item-image') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.onchange = () => {
        const file = input.files?.[0];
        input.remove();
        if (file) dispatchAction(action, id, { file });
      };
      document.body.appendChild(input);
      input.click();
      return;
    }
    if (action === 'cancel-batch') { void _queueController?.cancelBatch?.(); return; }
    if (action === 'retry-failed') { void _queueController?.retryFailed?.(); return; }
    if (action === 'continue-batch') { void _queueController?.continueInterrupted?.(); return; }
    dispatchAction(action, id);
  };

  overlay.onchange = event => {
    const target = event.target as HTMLInputElement;
    if (target.id === 'wardrobeNpcTarget') {
      _view.npcTarget = target.value;
      return;
    }
    if (target.id === 'wardrobeWearTarget') {
      // 目标写进 _view（行为本就按新目标执行），并立即重画——按钮「给X穿」与槽位提示都按新目标算
      _view.wearTargetActorKey = target.value;
      rerender(true);
      return;
    }
    if (target.id === 'wardrobePoolTarget') {
      _view.poolTargetActorKey = target.value;
      return;
    }
    if (target.id === 'wardrobeOutfitGender') {
      const mode = target.value === 'story' ? 'story' : (target.value === 'male' ? 'male' : 'female');
      _view.outfitModelMode = mode;
      if (mode === 'story') {
        const names = _view.outfitModelCharacters || [];
        if (names.length && !names.includes(String(_view.outfitModelCharacter || ''))) {
          _view.outfitModelCharacter = names[0];
        }
      }
      persistOutfitModelChoice();
      rerender(true);
      return;
    }
    if (target.id === 'wardrobeOutfitModelCharacter') {
      _view.outfitModelCharacter = target.value;
      persistOutfitModelChoice();
      return;
    }
    if (target.id === 'wardrobeDesignCreateOutfit') {
      _view.designCreateOutfit = target.checked === true;
      return;
    }
    const selectedId = target.dataset.wardrobeSelectItem;
    if (selectedId) {
      const selected = new Set(_view.selectedIds || []);
      if (target.checked) selected.add(selectedId); else selected.delete(selectedId);
      _view.selectedIds = Array.from(selected);
      rerender(true);
      return;
    }
    if (target.dataset.wardrobeExtractIndex !== undefined) {
      const index = Number(target.dataset.wardrobeExtractIndex);
      const selected = new Set(_view.extractionSelected || []);
      if (target.checked) selected.add(index); else selected.delete(index);
      _view.extractionSelected = Array.from(selected);
      return;
    }
    const editorItemId = target.dataset.wardrobeEditorItem;
    if (editorItemId && _state) {
      const selected = new Set(_view.editorItemIds || []);
      if (target.checked) selected.add(editorItemId); else selected.delete(editorItemId);
      _view.editorItemIds = selectionItemIds(selectionFromItemIds(_state.items, Array.from(selected)));
      rerender(true);
      return;
    }
    const poolOutfitId = target.dataset.wardrobePoolOutfit;
    if (poolOutfitId) {
      const selected = new Set(_view.poolDraftIds || []);
      if (target.checked) selected.add(poolOutfitId); else selected.delete(poolOutfitId);
      _view.poolDraftIds = Array.from(selected);
      rerender(true);
    }
  };
  overlay.oninput = event => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const searchHit = WARDROBE_SEARCH_KEYS[target.id];
    if (searchHit) {
      const input = target as HTMLInputElement;
      _view[searchHit.key] = input.value;
      if ((event as InputEvent).isComposing) return; // IME 合成中只存值不刷新，合成结束的 input 事件会再触发
      refreshWardrobeSearchDebounced(searchHit, target.id, overlay); // U34：尾沿防抖改走规范库
      return;
    }
    if (target.id === 'wardrobeDesignPrompt') {
      // 只存值不刷新（防抖无必要）：生成中 rerender 后输入内容不丢
      _view.designPrompt = target.value;
      return;
    }
    if (target.id === 'wardrobeItemName' || target.id === 'wardrobeItemCategory' || target.id === 'wardrobeItemDescription' || target.id === 'wardrobeItemTags') {
      _view.itemDraft = {
        name: overlay.querySelector<HTMLInputElement>('#wardrobeItemName')?.value || '',
        category: overlay.querySelector<HTMLSelectElement>('#wardrobeItemCategory')?.value || WARDROBE_CATEGORIES[0],
        description: overlay.querySelector<HTMLTextAreaElement>('#wardrobeItemDescription')?.value || '',
        tags: overlay.querySelector<HTMLTextAreaElement>('#wardrobeItemTags')?.value || '',
      };
      return;
    }
    if (target.id === 'wardrobeOutfitName' || target.id === 'wardrobeOutfitDescription') {
      _view.outfitDraft = {
        name: overlay.querySelector<HTMLInputElement>('#wardrobeOutfitName')?.value || '',
        description: overlay.querySelector<HTMLTextAreaElement>('#wardrobeOutfitDescription')?.value || '',
      };
      return;
    }
    const extractIndex = target.getAttribute('data-wardrobe-extract-name')
      ?? target.getAttribute('data-wardrobe-extract-category')
      ?? target.getAttribute('data-wardrobe-extract-description');
    if (extractIndex !== null && _view.extractionCandidates) {
      const index = Number(extractIndex);
      const candidate = _view.extractionCandidates[index];
      if (!candidate) return;
      candidate.name = overlay.querySelector<HTMLInputElement>(`[data-wardrobe-extract-name="${index}"]`)?.value || '';
      candidate.category = (overlay.querySelector<HTMLSelectElement>(`[data-wardrobe-extract-category="${index}"]`)?.value || candidate.category) as WardrobeItem['category'];
      candidate.description = overlay.querySelector<HTMLTextAreaElement>(`[data-wardrobe-extract-description="${index}"]`)?.value || '';
    }
  };
}

export function refreshWardrobePanel(): void {
  const overlay = currentOverlay();
  refreshWardrobePanelWithAdapter({
    isOpen: () => !!overlay?.classList.contains('wardrobe-overlay'),
    getState: getWardrobeSnapshot,
    getQueue: () => _queueController?.getSnapshot() || _queueSnapshot,
    getRoster: () => collectWardrobeRoster() ?? [],
    getPresentCharacters: collectPresentCharacterNames,
    getView: () => _view,
    commit: (state, queue, view) => {
      _state = state;
      _queueSnapshot = queue;
      _view = view as typeof _view;
      refreshWardrobeContent();
    },
  });
}

export function refreshWardrobePanelWithAdapter(
  adapter: WardrobePanelRefreshAdapter,
): boolean {
  if (!adapter.isOpen()) return false;
  const state = adapter.getState();
  const queue = adapter.getQueue();
  const view = reconcileWardrobePanelRosterView(
    adapter.getView(),
    adapter.getRoster(),
    adapter.getPresentCharacters(),
  );
  adapter.commit(state, queue, view);
  return true;
}

/** 设计请求成功：关设计弹窗、清忙碌态，进入候选审核（outfit=AI 套装建议，createOutfit=弹窗勾选态）。 */
export function showWardrobeDesignReview(
  candidates: WardrobeExtractionCandidate[],
  outfit: { name: string; description: string } | null,
  createOutfit: boolean,
): void {
  const overlay = currentOverlay();
  if (!overlay?.classList.contains('wardrobe-overlay')) return;
  _view.designDialogOpen = false;
  delete _view.designBusy;
  _view.extractionCandidates = candidates.map(candidate => ({ ...candidate }));
  _view.extractionSelected = candidates.map((_candidate, index) => index);
  _view.designCreateOutfit = createOutfit === true;
  _view.designOutfitMeta = outfit ? { ...outfit } : null;
  rerender();
  bindOverlayEvents(overlay);
  requestAnimationFrame(() => overlay.querySelector<HTMLElement>('.wardrobe-extraction-review input')?.focus());
}

/** 设计请求失败：恢复「生成分件」按钮，弹窗保留（指令可改后重试）。 */
export function failWardrobeDesign(): void {
  if (!_view.designDialogOpen) return;
  delete _view.designBusy;
  rerender();
  const overlay = currentOverlay();
  if (overlay) bindOverlayEvents(overlay);
}

/** 分件保存完成且勾选「保存为套装」：切到套装页打开编辑器，预选刚保存单品并预填 AI 建议名称/描述。 */
export function openWardrobeOutfitEditorForDesign(
  itemIds: readonly string[],
  outfitName: string,
  outfitDescription: string,
): void {
  const overlay = currentOverlay();
  if (!overlay?.classList.contains('wardrobe-overlay')) return;
  _view.route = 'outfits';
  delete _view.detailId;
  delete _view.outfitDetailId;
  _view.editorOpen = true;
  delete _view.editorOutfitId;
  _view.editorItemIds = Array.from(itemIds);
  _view.editorStep = 1;
  _view.outfitDraft = { name: outfitName || '', description: outfitDescription || '' };
  delete _view.extractionCandidates;
  delete _view.extractionSelected;
  delete _view.designCreateOutfit;
  delete _view.designOutfitMeta;
  rerender(false); // 与 setRoute 同理：跨页签换主体，不搬上一页的滚动偏移
  bindOverlayEvents(overlay);
}

/** 套装编辑器「生成名称/描述」完成：填栏并恢复按钮。 */
export function applyWardrobeOutfitMetaSuggestion(name: string, description: string): void {
  _view.outfitMetaLoading = false;
  _view.outfitDraft = { name: name || '', description: description || '' };
  rerender();
  const overlay = currentOverlay();
  if (overlay) bindOverlayEvents(overlay);
}

/** 套装元数据请求失败：恢复「生成名称/描述」按钮。 */
export function failWardrobeOutfitMeta(): void {
  _view.outfitMetaLoading = false;
  rerender();
  const overlay = currentOverlay();
  if (overlay) bindOverlayEvents(overlay);
}

export function closeWardrobeDialog(): void {
  const overlay = currentOverlay();
  if (!overlay?.classList.contains('wardrobe-overlay')) return;
  _view.itemFormOpen = false;
  delete _view.itemFormId;
  delete _view.itemDraft;
  delete _view.extractionCandidates;
  delete _view.extractionSelected;
  delete _view.designDialogOpen;
  delete _view.designBusy;
  delete _view.designPrompt;
  delete _view.designCreateOutfit;
  delete _view.designOutfitMeta;
  delete _view.confirmAction;
  delete _view.confirmId;
  delete _view.confirmIds;
  rerender();
  bindOverlayEvents(overlay);
}

/** F54(第十二轮)：返回键/ESC 的「退一层」一步（注册进全局分发，栈顶优先）。
 *  返回 true = 已消费（关掉了一层）；false = 无内层可退，交给全局链按整壳关闭语义处理。 */
let _backCloserRegistered = false;
function wardrobeBackStep(): boolean {
  const overlay = currentOverlay();
  if (!overlay || !overlay.classList.contains('wardrobe-overlay')) return false;
  const step = (mutate: () => void): boolean => { mutate(); rerender(); bindOverlayEvents(overlay); return true; };
  if (_view.actorItemPickerOpen || _view.actorOutfitPickerOpen || _view.actorPoolAddOpen) {
    return step(() => {
      _view.actorItemPickerOpen = false;
      _view.actorOutfitPickerOpen = false;
      _view.actorPoolAddOpen = false;
      delete _view.pickerSearch;
    });
  }
  if (_view.poolManagerOpen) {
    return step(() => {
      _view.poolManagerOpen = false;
      delete _view.poolDraftIds;
      delete _view.poolSearch;
    });
  }
  if (_view.itemFormOpen || _view.extractionCandidates || _view.confirmAction) {
    closeWardrobeDialog();
    return true;
  }
  if (_view.editorOpen) return step(() => { _view.editorOpen = false; delete _view.outfitDraft; });
  if (_view.detailId) return step(() => { delete _view.detailId; });
  if (_view.outfitDetailId) return step(() => { delete _view.outfitDetailId; });
  return false; // 无内层：整壳关闭交给全局链（closePanelOverlay + 接管观察器清理）
}

export function closeWardrobePanel(): void {
  const overlay = currentOverlay();
  // F54：关闭即归还守卫记录（push/pop 成对；幂等——未压过时 popBackGuard 自身早退）
  popBackGuard();
  _storeUnsubscribe?.();
  _queueUnsubscribe?.();
  _storeUnsubscribe = null;
  _queueUnsubscribe = null;
  if (overlay?.classList.contains('wardrobe-overlay')) {
    overlay.classList.remove('show', 'wardrobe-overlay');
    overlay.innerHTML = '';
    overlay.onclick = null;
    overlay.onchange = null;
    overlay.oninput = null;
  }
  const focus = _restoreFocus;
  _restoreFocus = null;
  try { focus?.focus(); } catch (_e) { /* ignore */ }
}

export function showWardrobePanel(style: StyleType, initialRoute: WardrobeRoute = 'items'): void {
  const config = getConfig();
  if (!config.wardrobeEnabled) return;
  const overlay = currentOverlay();
  if (!overlay) return;
  const existingActorKey = _view.actorKey;
  closeWardrobePanel();
  // F54：全屏壳打开即压守卫（安卓返回键此前从不关衣柜）；与手机关机/开机同款 push/pop 对，
  // 不 import html-builder（那会把整条 DOM 装配链拉进无 DOM 的测试环境）。
  pushBackGuard();
  injectWardrobeCss(true);
  _restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  _style = style;
  _state = loadWardrobeState();
  _queueSnapshot = _queueController?.getSnapshot() || null;
  const presentCharacters = collectPresentCharacterNames();
  const actorRoster = collectWardrobeRoster() ?? [];
  const defaultActorKey = resolveWardrobePanelActorKey(actorRoster, existingActorKey);
  const storedModel = readStoredOutfitModelChoice();
  _view = {
    route: initialRoute,
    category: '全部',
    editorStep: 1,
    toolbarCollapsed: window.innerWidth <= 720,
    selectedIds: [],
    presentCharacters,
    npcTarget: presentCharacters[0] || '',
    actorRoster,
    actorKey: defaultActorKey,
    wearTargetActorKey: defaultActorKey,
    poolTargetActorKey: defaultActorKey,
    outfitModelMode: storedModel.mode,
    outfitModelCharacter: storedModel.character,
    outfitModelCharacters: collectOutfitModelCandidates() ?? [],
  };
  overlay.classList.add('panel-overlay', 'wardrobe-overlay');
  overlay.classList.toggle('dark', config.darkTheme);
  rerender();
  bindOverlayEvents(overlay);
  overlay.classList.add('show');
  _openedAt = Date.now();
  _storeUnsubscribe = subscribeWardrobe(state => {
    _state = state;
    refreshWardrobeRosterView();
    refreshWardrobeContent();
  });
  if (_queueController) {
    _queueUnsubscribe = _queueController.subscribe(snapshot => {
      _queueSnapshot = snapshot;
      refreshWardrobeRosterView();
      refreshWardrobeContent();
    });
  }
  // F54(第十二轮)：不再自挂 window 级 ESC —— document 冒泡早于 window，全局链（F27 的
  // dispatchBackClosers）会先跑，而它在 #panelOverlay 上找不到 #panelClose（衣柜关闭钮是
  // .wardrobe-close）⇒ 直接关掉整个面板（退一层变整壳消失）。改为注册 closer：ESC 与安卓返回键
  // 共用同一分发，衣柜从栈顶先响应「退一层」，无内层时返回 false 交给全局链整壳关闭（含状态清理）。
  if (!_backCloserRegistered) {
    _backCloserRegistered = true;
    registerBackClosers([wardrobeBackStep]);
  }
  requestAnimationFrame(() => overlay.querySelector<HTMLElement>('.wardrobe-route[aria-selected="true"]')?.focus());
  // F2（弹窗接管泄漏）：面板内容被其它弹窗直接重写（innerHTML 接管且 show 类保持）时，
  // 订阅/键盘监听没有清理时机（index 侧 class 观察器只覆盖 remove('show') 的关闭路径）。
  // childList 兜底：.wardrobe-window 不在 overlay 内即按关闭语义清理（closeWardrobePanel 幂等；
  // rerender 每次重建 innerHTML 但 .wardrobe-window 恒在，观察器空转一次查询即返回）。
  const wardrobeTakeover = new MutationObserver(() => {
    if (overlay.querySelector('.wardrobe-window')) return;
    wardrobeTakeover.disconnect();
    closeWardrobePanel();
  });
  wardrobeTakeover.observe(overlay, { childList: true });
}
