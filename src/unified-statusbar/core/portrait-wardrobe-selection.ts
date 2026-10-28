// ===== 角色立绘服装替换：衣柜选择解析（纯逻辑） =====
import type { PortraitClothingOverride } from './wardrobe-prompts';
import {
  selectionFromItemIds,
  selectionItemIds,
  type WardrobeItem,
  type WardrobeState,
} from './wardrobe-types';

export interface PortraitWardrobeSelectionDraft {
  enabled: boolean;
  source: 'outfit' | 'custom';
  outfitId?: string;
  itemIds?: string[];
  mode: 'partial' | 'full';
}

export type PortraitWardrobeSelectionResult =
  | { ok: true; value?: PortraitClothingOverride }
  | { ok: false; error: string };

export function resolvePortraitWardrobeSelection(
  state: WardrobeState,
  draft: PortraitWardrobeSelectionDraft,
): PortraitWardrobeSelectionResult {
  if (!draft.enabled) return { ok: true };
  const requested = draft.source === 'outfit'
    ? state.outfits.find(outfit => outfit.id === draft.outfitId)?.itemIds || []
    : draft.itemIds || [];
  const normalizedIds = selectionItemIds(selectionFromItemIds(state.items, requested));
  const byId = new Map(state.items.map(item => [item.id, item]));
  const items = normalizedIds
    .map(id => byId.get(id))
    .filter((item): item is WardrobeItem => !!item)
    .map(item => ({
      id: item.id,
      category: item.category,
      name: item.name,
      description: item.description,
      tags: item.tags,
    }));
  if (items.length === 0) {
    return { ok: false, error: draft.source === 'outfit' ? '请选择一个有效套装' : '请至少选择一件服饰' };
  }
  return {
    ok: true,
    value: {
      mode: draft.mode === 'full' ? 'full' : 'partial',
      items,
    },
  };
}

export function getFullReplacementWarning(
  items: readonly Pick<WardrobeItem, 'category'>[],
): string {
  const categories = new Set(items.map(item => item.category));
  const hasOuterCoverage = categories.has('连体服')
    || (categories.has('上装') && categories.has('下装'));
  return hasOuterCoverage
    ? ''
    : '全部替换未覆盖“连体服”或“上装＋下装”，未指定槽位不会恢复旧衣，人物可能裸露。是否继续？';
}
