// ===== 衣柜即时与日期驱动随机换装纯逻辑 =====
import {
  selectionFromItemIds,
  selectionItemIds,
  type OutfitPreset,
  type WardrobeActorProfile,
  type WardrobeState,
} from './wardrobe-types';

export interface WardrobeRandomPlan {
  state: WardrobeState;
  changed: boolean;
  baselineActorKeys: string[];
  dressedActorKeys: string[];
  skippedActorKeys: string[];
}

function isValidDateKey(value: string): boolean {
  const match = /^(-?\d{4,6})-(\d{2})-(\d{2})$/.exec(value); // F52：负年份（公元前）同样合法
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function pickWearableRandomOutfit(
  state: WardrobeState,
  profile: WardrobeActorProfile,
  rng: () => number,
): OutfitPreset | null {
  const poolIds = new Set(profile.outfitPoolIds);
  const outfitById = new Map(state.outfits.map(outfit => [outfit.id, outfit]));
  const candidates: OutfitPreset[] = [];
  const seen = new Set<string>();
  for (const outfitId of profile.randomOutfitIds) {
    if (seen.has(outfitId) || !poolIds.has(outfitId)) continue;
    seen.add(outfitId);
    const outfit = outfitById.get(outfitId);
    if (!outfit) continue;
    const selection = selectionFromItemIds(state.items, outfit.itemIds);
    if (selectionItemIds(selection).length === 0) continue;
    candidates.push(outfit);
  }
  if (candidates.length === 0) return null;

  const randomValue = rng();
  const clampedRng = Number.isFinite(randomValue)
    ? Math.max(0, Math.min(1, randomValue))
    : 0;
  const index = Math.min(
    candidates.length - 1,
    Math.floor(clampedRng * candidates.length),
  );
  return candidates[index];
}

export function planWardrobeDateRandomization(
  state: WardrobeState,
  dateKey: string,
  rng: () => number,
): WardrobeRandomPlan {
  const baselineActorKeys: string[] = [];
  const dressedActorKeys: string[] = [];
  const skippedActorKeys: string[] = [];
  if (!isValidDateKey(dateKey)) {
    return {
      state,
      changed: false,
      baselineActorKeys,
      dressedActorKeys,
      skippedActorKeys,
    };
  }

  let actorProfiles = state.actorProfiles;
  for (const [actorKey, profile] of Object.entries(state.actorProfiles)) {
    if (!profile.autoRandomEnabled || profile.lastRandomDateKey === dateKey) continue;

    if (actorProfiles === state.actorProfiles) {
      actorProfiles = { ...state.actorProfiles };
    }
    if (!profile.lastRandomDateKey) {
      actorProfiles[actorKey] = { ...profile, lastRandomDateKey: dateKey };
      baselineActorKeys.push(actorKey);
      continue;
    }

    const outfit = pickWearableRandomOutfit(state, profile, rng);
    if (!outfit) {
      actorProfiles[actorKey] = { ...profile, lastRandomDateKey: dateKey };
      skippedActorKeys.push(actorKey);
      continue;
    }
    actorProfiles[actorKey] = {
      ...profile,
      currentOutfit: selectionFromItemIds(state.items, outfit.itemIds),
      sourceOutfitId: outfit.id,
      lastRandomDateKey: dateKey,
    };
    dressedActorKeys.push(actorKey);
  }

  const changed = actorProfiles !== state.actorProfiles;
  return {
    state: changed ? { ...state, actorProfiles } : state,
    changed,
    baselineActorKeys,
    dressedActorKeys,
    skippedActorKeys,
  };
}
