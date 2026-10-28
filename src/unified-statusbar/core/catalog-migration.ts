// ===== 衣柜目录并集合并 =====
// 购买事务里把 stranded（旧聊天残留/跨全局未并入）的衣柜条目与套装并入全局 store：
// 目录按 wardrobeDedupeKey 去重、套装按 id 幂等，并给出旧 id → 保留 id 映射。
// 纯逻辑 + 无宿主依赖：不 import storage-bootstrap（bootstrap↔本模块循环依赖）。
import {
  wardrobeDedupeKey,
  isWardrobeCategory,
  type OutfitPreset,
  type WardrobeItem,
} from './wardrobe-types';

const LEGACY_SOURCE_ENUMS = new Set(['inventory', 'shop_regular', 'shop_story', 'ai_extract', 'manual']);

function stripLegacySource(item: WardrobeItem): WardrobeItem {
  if (item && LEGACY_SOURCE_ENUMS.has(item.source as string)) {
    const { source, ...rest } = item;
    return rest as WardrobeItem;
  }
  return item;
}

/**
 * 衣柜目录并集去重：按 wardrobeDedupeKey(name, category) 合并。描述长者优先；平手保留先到者。
 * 保留 winner 的 id 避免已有引用漂移；内容取描述更长者。返回合并后的 items + 旧 id → 保留 id 映射。
 */
export function mergeCatalogItems(
  existing: WardrobeItem[],
  incoming: WardrobeItem[],
): { items: WardrobeItem[]; idMap: Map<string, string> } {
  const items = [...existing];
  const byKey = new Map<string, number>();
  const idMap = new Map<string, string>();
  for (let i = 0; i < items.length; i++) {
    if (isWardrobeCategory(items[i].category)) byKey.set(wardrobeDedupeKey(items[i].name, items[i].category), i);
  }
  for (const raw of incoming || []) {
    if (!raw || typeof raw !== 'object' || !raw.id) continue;
    const candidate = stripLegacySource(raw);
    if (!isWardrobeCategory(candidate.category)) {
      // 类别不合法：无法去重，原样加入（normalize 兜底）。
      if (!items.some(it => it.id === candidate.id)) items.push(candidate);
      continue;
    }
    const key = wardrobeDedupeKey(candidate.name, candidate.category);
    const existingIdx = byKey.get(key);
    if (existingIdx === undefined) {
      byKey.set(key, items.length);
      items.push(candidate);
      continue;
    }
    const keeper = items[existingIdx];
    idMap.set(candidate.id, keeper.id);
    const keepNew = (candidate.description?.length || 0) > (keeper.description?.length || 0);
    if (keepNew) items[existingIdx] = { ...candidate, id: keeper.id };
  }
  return { items, idMap };
}

/** outfits 并集 + idMap 引用改写；同 id 已存在则跳过（幂等，套装以先到为准）。 */
export function mergeOutfits(
  existing: OutfitPreset[],
  incoming: OutfitPreset[],
  idMap: Map<string, string>,
): OutfitPreset[] {
  const byId = new Map(existing.map(o => [o.id, o]));
  for (const outfit of incoming || []) {
    if (!outfit || typeof outfit !== 'object' || !outfit.id) continue;
    if (byId.has(outfit.id)) continue;
    const itemIds = Array.isArray(outfit.itemIds)
      ? outfit.itemIds
          .map(id => idMap.get(id) || id)
          .filter((id, idx, arr) => arr.indexOf(id) === idx)
      : [];
    byId.set(outfit.id, { ...outfit, itemIds });
  }
  return [...byId.values()];
}
