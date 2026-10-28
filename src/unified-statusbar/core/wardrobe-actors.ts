// ===== 衣柜角色档案纯规则 =====
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 01 待修：wardrobe-types 文件尾再导出 wardrobe-actors 的运行时工具（actorCurrentOutfitLabel 等），而本文件要用 wardrobe-types 的类型与默认值 ⇒ 把运行时工具整体搬到依赖更少的一侧即可解
import {
  emptyOutfitSelection,
  normalizeWardrobeName,
  selectionFromItemIds,
  selectionItemIds,
  type WardrobeActorKey,
  type WardrobeActorProfile,
  type WardrobeState,
} from './wardrobe-types';

export const PROTAGONIST_ACTOR_KEY = 'protagonist';

export function normalizeWardrobeActorName(value: unknown): string {
  return normalizeWardrobeName(value);
}

export function wardrobeCharacterActorKey(name: unknown): string | null {
  const normalized = normalizeWardrobeActorName(name);
  return normalized ? `character:${normalized.toLocaleLowerCase()}` : null;
}

export function createEmptyWardrobeActorProfile(
  actorKey: WardrobeActorKey,
  displayName: string,
): WardrobeActorProfile {
  return {
    actorKey,
    displayName: normalizeWardrobeActorName(displayName),
    currentOutfit: emptyOutfitSelection(),
    outfitPoolIds: [],
    randomOutfitIds: [],
    autoRandomEnabled: false,
  };
}

export function isWardrobeActorProfileEmpty(profile: WardrobeActorProfile): boolean {
  return selectionItemIds(profile.currentOutfit).length === 0
    && !profile.sourceOutfitId
    && profile.outfitPoolIds.length === 0
    && profile.randomOutfitIds.length === 0
    && !profile.autoRandomEnabled
    && !profile.lastRandomDateKey;
}

function sameItemIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function actorCurrentOutfitLabel(
  state: WardrobeState,
  profile: WardrobeActorProfile,
): string {
  const currentIds = selectionItemIds(
    selectionFromItemIds(state.items, selectionItemIds(profile.currentOutfit)),
  );
  if (currentIds.length === 0) return '尚未设置衣柜穿搭';
  const outfit = profile.sourceOutfitId
    ? state.outfits.find(candidate => candidate.id === profile.sourceOutfitId)
    : undefined;
  if (!outfit) return '自由搭配';
  const sourceIds = selectionItemIds(selectionFromItemIds(state.items, outfit.itemIds));
  return sameItemIds(currentIds, sourceIds) ? outfit.name : `${outfit.name}（已调整）`;
}
