// ===== 衣柜业务服务 =====
import {
  applyItemToSelection,
  emptyOutfitSelection,
  normalizeWardrobeName,
  removeItemFromSelection,
  selectionFromItemIds,
  selectionItemIds,
  validateWardrobeItemDraft,
  wardrobeDedupeKey,
  type OutfitSelection,
  type OutfitPreset,
  type WardrobeActorProfile,
  type WardrobeItem,
  type WardrobeItemDraft,
  type WardrobeState,
} from './wardrobe-types';
import { getCurrentCardName } from './current-card';
import { makeUniqueId } from './id';
import {
  PROTAGONIST_ACTOR_KEY,
  createEmptyWardrobeActorProfile,
  isWardrobeActorProfileEmpty,
  wardrobeCharacterActorKey,
} from './wardrobe-actors';
import {
  pickWearableRandomOutfit,
  planWardrobeDateRandomization,
} from './wardrobe-random';
import {
  reconcileWardrobeProfiles,
  type WardrobeRosterEntry,
} from './wardrobe-roster';
import { cloneJson } from './external-storage-codec';
import { getCurrentStoryChatKey } from './story-floor-store';
import {
  wardrobeStore,
  withWardrobeMutationLock,
  type WardrobeStore,
} from './wardrobe-store';

export type WardrobeResult<T> =
  | ({ ok: true; value: T } & { imageToDelete?: string })
  | { ok: false; error: string };

export interface WardrobeServiceDeps {
  now: () => number;
  makeId: (prefix: 'wi' | 'wo') => string;
  getChatKey?: () => string;
}

export interface AddWardrobeItemDraft extends WardrobeItemDraft {
  imagePath?: string;
  tags?: string;
}

export interface SaveOutfitDraft {
  id?: string;
  name: string;
  description?: string;
  itemIds: string[];
  imagePath?: string;
}

function defaultId(prefix: 'wi' | 'wo'): string {
  return makeUniqueId(prefix, 9, '_');
}

function success<T>(value: T, imageToDelete?: string): WardrobeResult<T> {
  return { ok: true, value, ...(imageToDelete ? { imageToDelete } : {}) };
}

function failure<T>(error: string): WardrobeResult<T> {
  return { ok: false, error };
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

/** 归一化衣物 tags：非字符串或纯空白 → undefined（删字段）；否则 trim 后截断到 500（与 store 落盘规则一致）。 */
function normalizeItemTags(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 500) : undefined;
}

function normalizeDateKey(value: unknown): string | undefined {
  const dateKey = String(value ?? '').trim();
  const match = /^(-?\d{4,6})-(\d{2})-(\d{2})$/.exec(dateKey); // F52：负年份（公元前）同样合法
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? dateKey
    : undefined;
}

function normalizeReferencedIds(
  values: readonly string[],
  allowedIds: ReadonlySet<string>,
): string[] {
  const normalized: string[] = [];
  for (const value of values || []) {
    const id = String(value ?? '').trim();
    if (id && allowedIds.has(id) && !normalized.includes(id)) normalized.push(id);
  }
  return normalized;
}

function canonicalActorKey(value: unknown): string | null {
  const actorKey = String(value ?? '').trim();
  if (actorKey === PROTAGONIST_ACTOR_KEY) return PROTAGONIST_ACTOR_KEY;
  const prefix = 'character:';
  if (!actorKey.startsWith(prefix)) return null;
  return wardrobeCharacterActorKey(actorKey.slice(prefix.length));
}

export function createWardrobeService(
  store: WardrobeStore = wardrobeStore,
  deps: WardrobeServiceDeps = { now: () => Date.now(), makeId: defaultId },
) {
  const currentChatKey = (): string => deps.getChatKey?.() || getCurrentStoryChatKey();
  const serialized = <T>(
    task: () => Promise<WardrobeResult<T>>,
  ): Promise<WardrobeResult<T>> => {
    const ownerChatKey = currentChatKey();
    return withWardrobeMutationLock(ownerChatKey, () =>
      currentChatKey() === ownerChatKey
        ? task()
        : Promise.resolve(failure('聊天已切换，本次衣柜操作已取消')));
  };

  const persist = async <T>(state: WardrobeState, value: T, imageToDelete?: string): Promise<WardrobeResult<T>> => {
    if (!(await store.save(state))) return failure('衣柜保存失败');
    return success(value, imageToDelete);
  };

  const findDuplicate = (
    state: WardrobeState,
    name: string,
    category: WardrobeItem['category'],
    excludeId?: string,
  ): WardrobeItem | undefined => {
    const key = wardrobeDedupeKey(name, category);
    return state.items.find(item => item.id !== excludeId && wardrobeDedupeKey(item.name, item.category) === key);
  };

  const fallbackActorName = (actorKey: string): string =>
    actorKey === PROTAGONIST_ACTOR_KEY ? '主角' : actorKey.replace(/^character:/, '');

  const mutateActor = (
    actorKey: string,
    displayName: string,
    mutate: (
      profile: WardrobeActorProfile,
      state: WardrobeState,
    ) => WardrobeResult<WardrobeActorProfile>,
  ): Promise<WardrobeResult<WardrobeActorProfile>> => {
    const normalizedActorKey = canonicalActorKey(actorKey);
    if (!normalizedActorKey) return Promise.resolve(failure('角色标识无效'));
    return serialized(async () => {
    const state = store.load();
    const current = state.actorProfiles[normalizedActorKey]
      || createEmptyWardrobeActorProfile(
        normalizedActorKey,
        normalizedActorKey === PROTAGONIST_ACTOR_KEY ? '主角' : displayName,
      );
    const result = mutate(cloneJson(current), state);
    if (!result.ok) return result;
    const actorProfiles = { ...state.actorProfiles };
    if (isWardrobeActorProfileEmpty(result.value)) delete actorProfiles[normalizedActorKey];
    else actorProfiles[normalizedActorKey] = result.value;
    return persist({ ...state, actorProfiles }, result.value);
    });
  };

  const applyItemToActor = (
    actorKey: string,
    displayName: string,
    itemId: string,
  ): Promise<WardrobeResult<WardrobeActorProfile>> =>
    mutateActor(actorKey, displayName, (profile, state) => {
      const item = state.items.find(candidate => candidate.id === itemId);
      if (!item) return failure('服饰不存在');
      return success({
        ...profile,
        currentOutfit: applyItemToSelection(profile.currentOutfit, item),
      });
    });

  const applyOutfitToActor = (
    actorKey: string,
    displayName: string,
    outfitId: string,
  ): Promise<WardrobeResult<WardrobeActorProfile>> =>
    mutateActor(actorKey, displayName, (profile, state) => {
      const outfit = state.outfits.find(candidate => candidate.id === outfitId);
      if (!outfit) return failure('套装不存在');
      const currentOutfit = selectionFromItemIds(state.items, outfit.itemIds);
      if (selectionItemIds(currentOutfit).length === 0) return failure('套装需要先修复组成');
      return success({
        ...profile,
        currentOutfit,
        sourceOutfitId: outfit.id,
      });
    });

  const removeActorItem = (
    actorKey: string,
    itemId: string,
  ): Promise<WardrobeResult<WardrobeActorProfile>> =>
    mutateActor(actorKey, fallbackActorName(actorKey), profile => {
      const currentOutfit = removeItemFromSelection(profile.currentOutfit, itemId);
      return success({
        ...profile,
        currentOutfit,
        sourceOutfitId: selectionItemIds(currentOutfit).length > 0
          ? profile.sourceOutfitId
          : undefined,
      });
    });

  const clearActorOutfit = (
    actorKey: string,
  ): Promise<WardrobeResult<WardrobeActorProfile>> =>
    mutateActor(actorKey, fallbackActorName(actorKey), profile => success({
      ...profile,
      currentOutfit: emptyOutfitSelection(),
      sourceOutfitId: undefined,
    }));

  const setActorOutfitPool = (
    actorKey: string,
    displayName: string,
    outfitIds: readonly string[],
  ): Promise<WardrobeResult<WardrobeActorProfile>> =>
    mutateActor(actorKey, displayName, (profile, state) => {
      const existingIds = new Set(state.outfits.map(outfit => outfit.id));
      const outfitPoolIds = normalizeReferencedIds(outfitIds, existingIds);
      const poolSet = new Set(outfitPoolIds);
      const randomOutfitIds = profile.randomOutfitIds.filter(id => poolSet.has(id));
      const hasRandom = randomOutfitIds.length > 0;
      return success({
        ...profile,
        outfitPoolIds,
        randomOutfitIds,
        autoRandomEnabled: hasRandom && profile.autoRandomEnabled,
        lastRandomDateKey: hasRandom ? profile.lastRandomDateKey : undefined,
      });
    });

  const setActorRandomOutfits = (
    actorKey: string,
    displayName: string,
    outfitIds: readonly string[],
  ): Promise<WardrobeResult<WardrobeActorProfile>> =>
    mutateActor(actorKey, displayName, profile => {
      const poolSet = new Set(profile.outfitPoolIds);
      const randomOutfitIds = normalizeReferencedIds(outfitIds, poolSet);
      const hasRandom = randomOutfitIds.length > 0;
      return success({
        ...profile,
        randomOutfitIds,
        autoRandomEnabled: hasRandom && profile.autoRandomEnabled,
        lastRandomDateKey: hasRandom ? profile.lastRandomDateKey : undefined,
      });
    });

  const setActorAutoRandom = (
    actorKey: string,
    displayName: string,
    enabled: boolean,
    currentDateKey?: string,
  ): Promise<WardrobeResult<WardrobeActorProfile>> =>
    mutateActor(actorKey, displayName, profile => {
      if (enabled && profile.randomOutfitIds.length === 0) {
        return failure('请先选择至少一套随机候选');
      }
      if (!enabled) {
        return success({
          ...profile,
          autoRandomEnabled: false,
          lastRandomDateKey: undefined,
        });
      }
      const dateKey = normalizeDateKey(currentDateKey);
      return success({
        ...profile,
        autoRandomEnabled: true,
        ...(dateKey ? { lastRandomDateKey: dateKey } : {}),
      });
    });

  const randomizeActorOutfit = (
    actorKey: string,
    rng: () => number = Math.random,
  ): Promise<WardrobeResult<WardrobeActorProfile>> =>
    mutateActor(actorKey, fallbackActorName(actorKey), (profile, state) => {
      const outfit = pickWearableRandomOutfit(state, profile, rng);
      if (!outfit) return failure('没有可穿的随机套装候选');
      return success({
        ...profile,
        currentOutfit: selectionFromItemIds(state.items, outfit.itemIds),
        sourceOutfitId: outfit.id,
      });
    });

  const processWardrobeAutomationTick = (
    roster: readonly WardrobeRosterEntry[],
    dateKey: string,
    rng: () => number = Math.random,
  ): Promise<WardrobeResult<{
    changed: boolean;
    removedActorKeys: string[];
    baselineActorKeys: string[];
    dressedActorKeys: string[];
    skippedActorKeys: string[];
  }>> =>
    serialized(async () => {
      const state = store.load();
      const reconciled = reconcileWardrobeProfiles(state, roster);
      const plan = planWardrobeDateRandomization(reconciled.state, dateKey, rng);
      const value = {
        changed: reconciled.changed || plan.changed,
        removedActorKeys: reconciled.removedActorKeys,
        baselineActorKeys: plan.baselineActorKeys,
        dressedActorKeys: plan.dressedActorKeys,
        skippedActorKeys: plan.skippedActorKeys,
      };
      return value.changed ? persist(plan.state, value) : success(value);
    });

  const profileResultToSelection = async (
    result: Promise<WardrobeResult<WardrobeActorProfile>>,
  ): Promise<WardrobeResult<OutfitSelection>> => {
    const resolved = await result;
    return resolved.ok ? success(resolved.value.currentOutfit) : resolved;
  };

  return {
    async addItem(draft: AddWardrobeItemDraft): Promise<WardrobeResult<WardrobeItem>> {
      return serialized(async () => {
      const checked = validateWardrobeItemDraft(draft);
      if (!checked.ok) return failure(checked.error);
      const state = store.load();
      if (findDuplicate(state, checked.value.name, checked.value.category)) {
        return failure('同名同类别服饰已存在');
      }
      const at = deps.now();
      const itemTags = normalizeItemTags(draft.tags);
      const item: WardrobeItem = {
        id: deps.makeId('wi'),
        ...checked.value,
        source: getCurrentCardName(),   // 无条件写当前卡名，来源不演化
        ...(draft.imagePath?.trim() ? { imagePath: draft.imagePath.trim() } : {}),
        ...(itemTags !== undefined ? { tags: itemTags } : {}),
        createdAt: at,
        updatedAt: at,
      };
      return persist({ ...state, items: state.items.concat(item) }, item);
      });
    },

    async updateItem(
      itemId: string,
      draft: Pick<WardrobeItem, 'name' | 'category' | 'description' | 'tags'>,
    ): Promise<WardrobeResult<WardrobeItem>> {
      return serialized(async () => {
      const checked = validateWardrobeItemDraft(draft);
      if (!checked.ok) return failure(checked.error);
      const state = store.load();
      const index = state.items.findIndex(item => item.id === itemId);
      if (index < 0) return failure('服饰不存在');
      if (findDuplicate(state, checked.value.name, checked.value.category, itemId)) {
        return failure('同名同类别服饰已存在');
      }
      const updated: WardrobeItem = {
        ...state.items[index],
        ...checked.value,
        // 传空串 → tags 置 undefined（覆盖旧值实现删除）；不传 → 保留现有 tags
        ...(typeof draft.tags === 'string' ? { tags: normalizeItemTags(draft.tags) } : {}),
        updatedAt: deps.now(),
      };
      const items = state.items.slice();
      items[index] = updated;
      return persist({ ...state, items }, updated);
      });
    },

    async saveOutfit(draft: SaveOutfitDraft): Promise<WardrobeResult<OutfitPreset>> {
      return serialized(async () => {
      const name = normalizeWardrobeName(draft.name);
      if (!name) return failure('套装名称不能为空');
      if (name.length > 40) return failure('套装名称不能超过40字');
      const description = String(draft.description ?? '').trim();
      if (description.length > 300) return failure('套装描述不能超过300字');
      const state = store.load();
      const duplicate = state.outfits.find(outfit =>
        outfit.id !== draft.id
        && normalizeWardrobeName(outfit.name).toLocaleLowerCase() === name.toLocaleLowerCase());
      if (duplicate) return failure('同名套装已存在');
      const normalizedIds = selectionItemIds(selectionFromItemIds(state.items, draft.itemIds || []));
      if (normalizedIds.length === 0) return failure('套装至少需要一件服饰');
      const existingIndex = draft.id ? state.outfits.findIndex(outfit => outfit.id === draft.id) : -1;
      if (draft.id && existingIndex < 0) return failure('套装不存在');
      const existing = existingIndex >= 0 ? state.outfits[existingIndex] : null;
      const at = deps.now();
      const descriptionChanged = !!existing && String(existing.description || '') !== description;
      const componentsChanged = !!existing && !sameIds(existing.itemIds, normalizedIds);
      const imageToDelete = (descriptionChanged || componentsChanged) ? existing?.imagePath : undefined;
      const preservedImage = existing?.imagePath && !imageToDelete ? existing.imagePath : undefined;
      const outfit: OutfitPreset = {
        id: existing?.id || deps.makeId('wo'),
        name,
        ...(description ? { description } : {}),
        itemIds: normalizedIds,
        ...(existing ? (existing.sourceCard ? { sourceCard: existing.sourceCard } : {}) : { sourceCard: getCurrentCardName() }),
        ...((draft.imagePath || preservedImage) ? { imagePath: draft.imagePath || preservedImage } : {}),
        createdAt: existing?.createdAt ?? at,
        updatedAt: at,
      };
      const outfits = state.outfits.slice();
      if (existingIndex >= 0) outfits[existingIndex] = outfit;
      else outfits.push(outfit);
      return persist({ ...state, outfits }, outfit, imageToDelete);
      });
    },

    applyItemToActor,
    applyOutfitToActor,
    removeActorItem,
    clearActorOutfit,
    setActorOutfitPool,
    setActorRandomOutfits,
    setActorAutoRandom,
    randomizeActorOutfit,
    processWardrobeAutomationTick,

    async applyItemToProtagonist(itemId: string): Promise<WardrobeResult<OutfitSelection>> {
      return profileResultToSelection(
        applyItemToActor(PROTAGONIST_ACTOR_KEY, '主角', itemId),
      );
    },

    async applyOutfitToProtagonist(outfitId: string): Promise<WardrobeResult<OutfitSelection>> {
      return profileResultToSelection(
        applyOutfitToActor(PROTAGONIST_ACTOR_KEY, '主角', outfitId),
      );
    },

    async removeProtagonistItem(itemId: string): Promise<WardrobeResult<OutfitSelection>> {
      return profileResultToSelection(removeActorItem(PROTAGONIST_ACTOR_KEY, itemId));
    },

    async clearProtagonistOutfit(): Promise<WardrobeResult<OutfitSelection>> {
      return profileResultToSelection(clearActorOutfit(PROTAGONIST_ACTOR_KEY));
    },

    async deleteItem(itemId: string): Promise<WardrobeResult<WardrobeItem>> {
      return serialized(async () => {
      const state = store.load();
      const item = state.items.find(candidate => candidate.id === itemId);
      if (!item) return failure('服饰不存在');
      const outfitRefs = state.outfits
        .filter(outfit => outfit.itemIds.includes(itemId))
        .map(outfit => outfit.name);
      const actorRefs = Object.values(state.actorProfiles)
        .filter(profile => selectionItemIds(profile.currentOutfit).includes(itemId))
        .map(profile => profile.displayName);
      if (outfitRefs.length > 0 || actorRefs.length > 0) {
        const refs = [
          ...(outfitRefs.length > 0 ? [`套装：${outfitRefs.join('、')}`] : []),
          ...(actorRefs.length > 0 ? [`当前穿搭：${actorRefs.join('、')}`] : []),
        ];
        return failure(`该服饰仍被引用：${refs.join('；')}`);
      }
      return persist({ ...state, items: state.items.filter(candidate => candidate.id !== itemId) }, item, item.imagePath);
      });
    },

    async deleteOutfit(outfitId: string): Promise<WardrobeResult<OutfitPreset>> {
      return serialized(async () => {
      const state = store.load();
      const outfit = state.outfits.find(candidate => candidate.id === outfitId);
      if (!outfit) return failure('套装不存在');
      const actorProfiles: WardrobeState['actorProfiles'] = {};
      for (const [actorKey, profile] of Object.entries(state.actorProfiles)) {
        const randomOutfitIds = profile.randomOutfitIds.filter(id => id !== outfitId);
        const hasRandom = randomOutfitIds.length > 0;
        const nextProfile: WardrobeActorProfile = {
          ...profile,
          outfitPoolIds: profile.outfitPoolIds.filter(id => id !== outfitId),
          randomOutfitIds,
          sourceOutfitId: profile.sourceOutfitId === outfitId
            ? undefined
            : profile.sourceOutfitId,
          autoRandomEnabled: hasRandom && profile.autoRandomEnabled,
          lastRandomDateKey: hasRandom ? profile.lastRandomDateKey : undefined,
        };
        if (!isWardrobeActorProfileEmpty(nextProfile)) actorProfiles[actorKey] = nextProfile;
      }
      return persist(
        {
          ...state,
          outfits: state.outfits.filter(candidate => candidate.id !== outfitId),
          actorProfiles,
        },
        outfit,
        outfit.imagePath,
      );
      });
    },

    resolveItems(itemIds: readonly string[]): WardrobeItem[] {
      const state = store.snapshot();
      const byId = new Map(state.items.map(item => [item.id, item]));
      return itemIds.map(id => byId.get(id)).filter((item): item is WardrobeItem => !!item);
    },
  };
}

export const wardrobeService = createWardrobeService();

export const addWardrobeItem = wardrobeService.addItem;
/** 对外别名（U18-3）：全库无内部引用，按「可能是给外部项目用的」口径保留——**勿当死代码删除**。 */
export const saveOutfitPreset = wardrobeService.saveOutfit;
export const applyItemToActor = wardrobeService.applyItemToActor;
export const applyOutfitToActor = wardrobeService.applyOutfitToActor;
export const removeActorItem = wardrobeService.removeActorItem;
export const clearActorOutfit = wardrobeService.clearActorOutfit;
export const setActorOutfitPool = wardrobeService.setActorOutfitPool;
export const setActorRandomOutfits = wardrobeService.setActorRandomOutfits;
export const setActorAutoRandom = wardrobeService.setActorAutoRandom;
export const randomizeActorOutfit = wardrobeService.randomizeActorOutfit;
export const processWardrobeAutomationTick = wardrobeService.processWardrobeAutomationTick;
export const applyItemToProtagonist = wardrobeService.applyItemToProtagonist;
export const applyOutfitToProtagonist = wardrobeService.applyOutfitToProtagonist;
export const removeProtagonistItem = wardrobeService.removeProtagonistItem;
export const clearProtagonistOutfit = wardrobeService.clearProtagonistOutfit;
export const deleteWardrobeItem = wardrobeService.deleteItem;
export const resolveWardrobeItems = wardrobeService.resolveItems;
