// ===== 衣柜双源存储：目录全局 + 穿搭聊天级 =====
import { plainClone } from './deep-clone';
import { readStoryFeature, writeStoryFeature } from './story-floor-store';
import { readWardrobeCatalog, writeWardrobeCatalog } from './wardrobe-catalog-store';
import {
  WARDROBE_CATEGORIES,
  emptyOutfitSelection,
  isWardrobeCategory,
  normalizeWardrobeName,
  selectionFromItemIds,
  selectionItemIds,
  wardrobeDedupeKey,
  type OutfitPreset,
  type WardrobeItem,
  type WardrobeActorProfile,
  type WardrobeState,
} from './wardrobe-types';
import {
  PROTAGONIST_ACTOR_KEY,
  createEmptyWardrobeActorProfile,
  isWardrobeActorProfileEmpty,
  normalizeWardrobeActorName,
  wardrobeCharacterActorKey,
} from './wardrobe-actors';

export const WARDROBE_STORY_KEY = 'wardrobe';
export const WARDROBE_PROFILES_STORY_KEY = 'wardrobe.profiles';
export const WARDROBE_GENERATION_STORY_KEY = 'wardrobe.generation';
/** 套装生图模特选项（模式+故事角色），按聊天存储=跟随角色卡；不再写入全局目录 modelGender */
export const WARDROBE_OUTFIT_MODEL_STORY_KEY = 'wardrobe.outfitModel';

/** 单源 persistence（向后兼容：测试/旧调用直接传 {read,write} 读全量 'wardrobe' 键）。 */
export interface WardrobePersistence {
  read<T>(key: string, fallback: T): T;
  write(key: string, value: unknown): Promise<boolean>;
}

/** 双源：目录（items+outfits+模特性别）→ 全局 store；穿搭（actorProfiles）→ story。 */
export interface WardrobeCatalogPersistence {
  read(): { items: WardrobeItem[]; outfits: OutfitPreset[]; modelGender?: 'female' | 'male' };
  write(items: WardrobeItem[], outfits: OutfitPreset[], modelGender?: 'female' | 'male'): Promise<boolean> | boolean;
}
export interface WardrobeProfilePersistence {
  read(fallback: Record<string, WardrobeActorProfile>): Record<string, WardrobeActorProfile>;
  write(profiles: Record<string, WardrobeActorProfile>): Promise<boolean>;
}

export interface WardrobeStore {
  load(): WardrobeState;
  snapshot(): WardrobeState;
  /** O2：只读视图（零克隆，仅供纯读消费方——渲染签名/投影字符串组装）。调用方不得改写。 */
  peek?(): WardrobeState;
  save(state: WardrobeState): Promise<boolean>;
  adoptExternal(state: WardrobeState): WardrobeState;
  subscribe(listener: (state: WardrobeState) => void): () => void;
  resetCache(): void;
}

type WardrobeMutationLockMap = Map<string, Promise<void>>;

const localMutationLocks: WardrobeMutationLockMap = new Map();

function mutationLocks(): WardrobeMutationLockMap {
  try {
    const host = window.parent as any;
    if (!host.__ub_wardrobe_mutation_locks) {
      host.__ub_wardrobe_mutation_locks = new Map<string, Promise<void>>();
    }
    return host.__ub_wardrobe_mutation_locks;
  } catch (_e) {
    return localMutationLocks;
  }
}

export async function withWardrobeMutationLock<T>(
  chatKey: string,
  task: () => Promise<T>,
): Promise<T> {
  const locks = mutationLocks();
  const key = String(chatKey || 'default');
  const previous = locks.get(key) || Promise.resolve();
  let release = (): void => undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const tail = previous.catch(() => undefined).then(() => gate);
  locks.set(key, tail);
  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
    if (locks.get(key) === tail) locks.delete(key);
  }
}

export function isSafeStoredImagePath(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const path = value.trim();
  if (!path || /[\u0000-\u001f\u007f]/.test(path) || /^\/\//.test(path)) return false;
  if (/^(?:javascript|vbscript|data):/i.test(path)) return false;
  const scheme = path.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  return !scheme || scheme === 'http' || scheme === 'https';
}

export function emptyWardrobeState(): WardrobeState {
  return {
    schema: 2,
    items: [],
    outfits: [],
    actorProfiles: {},
    modelGender: 'female',
  };
}

function normalizeItem(raw: any): WardrobeItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? '').trim();
  const name = normalizeWardrobeName(raw.name);
  const description = String(raw.description ?? '').trim();
  if (!id || !name || !description || !isWardrobeCategory(raw.category)) return null;
  const source = typeof raw.source === 'string' && raw.source.trim() ? raw.source.trim().slice(0, 80) : undefined;
  const createdAt = Number.isFinite(raw.createdAt) ? Number(raw.createdAt) : 0;
  const updatedAt = Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : createdAt;
  return {
    id,
    name,
    category: raw.category,
    description,
    ...(source ? { source } : {}),
    ...(typeof raw.tags === 'string' && raw.tags.trim()
      ? { tags: raw.tags.trim().slice(0, 500) }
      : {}),
    ...(isSafeStoredImagePath(raw.imagePath)
      ? { imagePath: raw.imagePath.trim() }
      : {}),
    createdAt,
    updatedAt,
  };
}

function normalizeOutfit(raw: any, items: WardrobeItem[]): OutfitPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? '').trim();
  const name = normalizeWardrobeName(raw.name);
  if (!id || !name) return null;
  const ids = Array.isArray(raw.itemIds) ? raw.itemIds.map(String) : [];
  const selection = selectionFromItemIds(items, ids);
  const createdAt = Number.isFinite(raw.createdAt) ? Number(raw.createdAt) : 0;
  const updatedAt = Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : createdAt;
  return {
    id,
    name,
    ...(typeof raw.description === 'string' && raw.description.trim()
      ? { description: raw.description.trim().slice(0, 300) }
      : {}),
    itemIds: selectionItemIds(selection),
    ...(typeof raw.sourceCard === 'string' && raw.sourceCard.trim() ? { sourceCard: raw.sourceCard.trim().slice(0, 80) } : {}),
    ...(isSafeStoredImagePath(raw.imagePath)
      ? { imagePath: raw.imagePath.trim() }
      : {}),
    createdAt,
    updatedAt,
  };
}

function uniqueExistingIds(raw: unknown, existingIds: ReadonlySet<string>): string[] {
  const normalized: string[] = [];
  for (const value of Array.isArray(raw) ? raw : []) {
    const id = String(value ?? '').trim();
    if (id && existingIds.has(id) && !normalized.includes(id)) normalized.push(id);
  }
  return normalized;
}

function normalizeActorProfile(
  actorKey: string,
  raw: any,
  items: WardrobeItem[],
  outfitIds: ReadonlySet<string>,
  wearableOutfitIds: ReadonlySet<string>,
): WardrobeActorProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  if (actorKey !== PROTAGONIST_ACTOR_KEY
    && (!actorKey.startsWith('character:') || !actorKey.slice('character:'.length).trim())) {
    return null;
  }
  const fallbackName = actorKey === PROTAGONIST_ACTOR_KEY
    ? '主角'
    : actorKey.slice('character:'.length);
  const profile = createEmptyWardrobeActorProfile(
    actorKey,
    actorKey === PROTAGONIST_ACTOR_KEY
      ? fallbackName
      : normalizeWardrobeActorName(raw.displayName) || fallbackName,
  );
  const rawSelection = raw.currentOutfit && typeof raw.currentOutfit === 'object'
    ? raw.currentOutfit
    : emptyOutfitSelection();
  profile.currentOutfit = selectionFromItemIds(items, selectionItemIds({
    slots: rawSelection.slots || {},
    accessories: Array.isArray(rawSelection.accessories) ? rawSelection.accessories : [],
  }));
  profile.outfitPoolIds = uniqueExistingIds(raw.outfitPoolIds, outfitIds);
  profile.randomOutfitIds = uniqueExistingIds(
    raw.randomOutfitIds,
    new Set(profile.outfitPoolIds.filter(id => wearableOutfitIds.has(id))),
  );
  const sourceOutfitId = String(raw.sourceOutfitId ?? '').trim();
  if (sourceOutfitId
    && outfitIds.has(sourceOutfitId)
    && selectionItemIds(profile.currentOutfit).length > 0) {
    profile.sourceOutfitId = sourceOutfitId;
  }
  if (profile.randomOutfitIds.length > 0) {
    profile.autoRandomEnabled = raw.autoRandomEnabled === true;
    const dateKey = String(raw.lastRandomDateKey ?? '').trim();
    if (dateKey) profile.lastRandomDateKey = dateKey;
  }
  return profile;
}

export function normalizeWardrobeState(raw: unknown): WardrobeState {
  if (!raw || typeof raw !== 'object') return emptyWardrobeState();
  const data = raw as any;
  const items: WardrobeItem[] = [];
  const itemIds = new Set<string>();
  const itemKeys = new Set<string>();
  for (const candidate of Array.isArray(data.items) ? data.items : []) {
    const item = normalizeItem(candidate);
    if (!item || itemIds.has(item.id)) continue;
    const key = wardrobeDedupeKey(item.name, item.category);
    if (itemKeys.has(key)) continue;
    itemIds.add(item.id);
    itemKeys.add(key);
    items.push(item);
  }

  const outfits: OutfitPreset[] = [];
  const outfitIds = new Set<string>();
  const wearableOutfitIds = new Set<string>();
  for (const candidate of Array.isArray(data.outfits) ? data.outfits : []) {
    const outfit = normalizeOutfit(candidate, items);
    if (!outfit || outfitIds.has(outfit.id)) continue;
    outfitIds.add(outfit.id);
    if (outfit.itemIds.length > 0) wearableOutfitIds.add(outfit.id);
    outfits.push(outfit);
  }

  const actorProfiles: Record<string, WardrobeActorProfile> = {};
  if (data.schema === 1) {
    const rawSelection = data.protagonistOutfit && typeof data.protagonistOutfit === 'object'
      ? data.protagonistOutfit
      : emptyOutfitSelection();
    const currentOutfit = selectionFromItemIds(items, selectionItemIds({
      slots: rawSelection.slots || {},
      accessories: Array.isArray(rawSelection.accessories) ? rawSelection.accessories : [],
    }));
    if (selectionItemIds(currentOutfit).length > 0) {
      const protagonist = createEmptyWardrobeActorProfile(PROTAGONIST_ACTOR_KEY, '主角');
      protagonist.currentOutfit = currentOutfit;
      actorProfiles[PROTAGONIST_ACTOR_KEY] = protagonist;
    }
  } else if (data.schema === 2 && data.actorProfiles && typeof data.actorProfiles === 'object') {
    const selectedProfiles = new Map<string, {
      rawKey: string;
      rawProfile: unknown;
      canonical: boolean;
    }>();
    for (const [rawKey, rawProfile] of Object.entries(data.actorProfiles)) {
      const actorKey = rawKey === PROTAGONIST_ACTOR_KEY
        ? PROTAGONIST_ACTOR_KEY
        : rawKey.startsWith('character:')
          ? wardrobeCharacterActorKey(rawKey.slice('character:'.length))
          : null;
      if (!actorKey) continue;
      const candidate = {
        rawKey,
        rawProfile,
        canonical: rawKey === actorKey,
      };
      const existing = selectedProfiles.get(actorKey);
      if (!existing
        || (candidate.canonical && !existing.canonical)
        || (candidate.canonical === existing.canonical && candidate.rawKey < existing.rawKey)) {
        selectedProfiles.set(actorKey, candidate);
      }
    }
    for (const [actorKey, selected] of selectedProfiles) {
      const profile = normalizeActorProfile(
        actorKey,
        selected.rawProfile,
        items,
        outfitIds,
        wearableOutfitIds,
      );
      if (profile && !isWardrobeActorProfileEmpty(profile)) actorProfiles[actorKey] = profile;
    }
  }

  return {
    schema: 2,
    items,
    outfits,
    actorProfiles,
    modelGender: data.modelGender === 'male' ? 'male' : 'female',
  };
}

// 双源默认：目录→全局 wardrobe-catalog store；穿搭→story 'wardrobe.profiles'。
const catalogPersistence: WardrobeCatalogPersistence = {
  read: () => readWardrobeCatalog(),
  write: (items, outfits, modelGender) => writeWardrobeCatalog(items, outfits, modelGender),
};
const profilePersistence: WardrobeProfilePersistence = {
  read: fallback => readStoryFeature(WARDROBE_PROFILES_STORY_KEY, fallback),
  write: profiles => writeStoryFeature(WARDROBE_PROFILES_STORY_KEY, profiles),
};

type WardrobePersistenceSource =
  | { kind: 'single'; persistence: WardrobePersistence }
  | { kind: 'dual'; catalog: WardrobeCatalogPersistence; profiles: WardrobeProfilePersistence };

function resolveSources(
  catalog: WardrobeCatalogPersistence | WardrobePersistence | undefined,
  profiles?: WardrobeProfilePersistence,
): WardrobePersistenceSource {
  // 向后兼容：恰传一个 {read,write}（WardrobePersistence）→ 单源全量读 'wardrobe' 键。
  // 传两个（catalog + profiles）或无参 → 双源默认。单源判定以「恰好一个实参」为准，
  // 不能用 read 形参个数（单源 memoryPersistence 的 read 可能是 ()=>… 或 (key,fb)=>…）。
  if (profiles === undefined && catalog && 'read' in catalog && 'write' in catalog) {
    return { kind: 'single', persistence: catalog as WardrobePersistence };
  }
  return {
    kind: 'dual',
    catalog: (catalog || catalogPersistence) as WardrobeCatalogPersistence,
    profiles: profiles || profilePersistence,
  };
}

export function createWardrobeStore(
  catalog?: WardrobeCatalogPersistence | WardrobePersistence,
  profiles?: WardrobeProfilePersistence,
): WardrobeStore {
  const source = resolveSources(catalog, profiles);
  let cache: WardrobeState | null = null;
  const listeners = new Set<(state: WardrobeState) => void>();
  const readState = (): WardrobeState => {
    if (source.kind === 'single') {
      return source.persistence.read(WARDROBE_STORY_KEY, emptyWardrobeState());
    }
    const cat = source.catalog.read();
    const profileRaw = source.profiles.read({});
    return {
      schema: 2 as const,
      items: cat.items,
      outfits: cat.outfits,
      actorProfiles: profileRaw,
      modelGender: cat.modelGender === 'male' ? 'male' : 'female',
    };
  };
  const load = (): WardrobeState => {
    cache = normalizeWardrobeState(readState());   // 净化：跨聊天悬空引用在此兜底
    return plainClone(cache);
  };
  return {
    load,
    snapshot(): WardrobeState {
      return plainClone(cache || load());
    },
    peek(): WardrobeState {
      if (!cache) load();
      return cache as WardrobeState;
    },
    async save(state: WardrobeState): Promise<boolean> {
      const normalized = normalizeWardrobeState(state);
      if (source.kind === 'single') {
        const ok = await source.persistence.write(WARDROBE_STORY_KEY, normalized);
        if (!ok) return false;
      } else {
        const before = cache || load();
        const catalogChanged = JSON.stringify([before.items, before.outfits, before.modelGender])
          !== JSON.stringify([normalized.items, normalized.outfits, normalized.modelGender]);
        const profilesChanged = JSON.stringify(before.actorProfiles) !== JSON.stringify(normalized.actorProfiles);
        if (catalogChanged && !await source.catalog.write(normalized.items, normalized.outfits, normalized.modelGender)) return false;
        if (profilesChanged && !await source.profiles.write(normalized.actorProfiles)) {
          if (catalogChanged) await source.catalog.write(before.items, before.outfits, before.modelGender);
          return false;
        }
      }
      cache = normalized;
      bumpWardrobeContentRev();
      const snapshot = plainClone(normalized);
      for (const listener of listeners) {
        try { listener(plainClone(snapshot)); } catch (_e) { /* isolate subscribers */ }
      }
      return true;
    },
    adoptExternal(state: WardrobeState): WardrobeState {
      cache = normalizeWardrobeState(state);
      bumpWardrobeContentRev();
      const snapshot = plainClone(cache);
      for (const listener of listeners) {
        try { listener(plainClone(snapshot)); } catch (_e) { /* isolate subscribers */ }
      }
      return snapshot;
    },
    subscribe(listener: (state: WardrobeState) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    resetCache(): void {
      cache = null;
    },
  };
}

// O3：衣柜内容代——save/adoptExternal 等一切经本 store 的写入 +1。自动化 tick 的短路键
// 消费它：内容没变、名单没变、日期没变 ⇒ 整条重放链（story 重放+双克隆+全员对账）跳过。
let _wardrobeContentRev = 0;
function bumpWardrobeContentRev(): void { _wardrobeContentRev += 1; }
export function getWardrobeContentRev(): number { return _wardrobeContentRev; }

export const wardrobeStore = createWardrobeStore();

/** O2：默认 store 的只读视图（零克隆；签名/纯字符串组装专用，不得改写返回值）。 */
export function peekWardrobeSnapshot(): WardrobeState {
  return wardrobeStore.peek ? wardrobeStore.peek() : wardrobeStore.snapshot();
}

export function loadWardrobeState(): WardrobeState {
  return wardrobeStore.load();
}

export function getWardrobeSnapshot(): WardrobeState {
  return wardrobeStore.snapshot();
}

export function saveWardrobeState(state: WardrobeState): Promise<boolean> {
  return wardrobeStore.save(state);
}

export function adoptExternalWardrobeState(state: WardrobeState): WardrobeState {
  return wardrobeStore.adoptExternal(state);
}

export function subscribeWardrobe(listener: (state: WardrobeState) => void): () => void {
  return wardrobeStore.subscribe(listener);
}

export { WARDROBE_CATEGORIES };
