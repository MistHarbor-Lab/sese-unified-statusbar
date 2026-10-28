// ===== 商店数据存储层：聊天楼层为唯一事实源 =====
import { readStoryFeature, writeStoryFeature } from './story-floor-store';
import { normalizeStoryProduct, type ShopStoryItem } from './shop-story-product';
import { mapInventoryTypeToWardrobeCategory, type WardrobeCategory } from './wardrobe-types';

export type {
  ShopStoryItem, ShopStoryRegularItem, ShopStorySkillItem, ShopStoryWardrobeItem,
  ShopSkillType, ShopSkillStrength,
} from './shop-story-product';

export const SHOP_STORY_KEY = 'shop';
const GACHA_DRAWN_KEY = 'gacha.drawn';

export interface ShopRegularItem {
  id: string; name: string; type: string; quality: string;
  price: number; originalPrice?: number; discount?: number; desc: string;
  // 通用技能书（常规售卖混入）：kind='skill' 时启用下列字段。
  // 默认 'item'；旧存档无 kind 视为普通道具。
  kind?: 'item' | 'skill' | 'wardrobe';
  skillType?: '主动' | '被动';
  strength?: '基础' | '实用' | '强力' | '稀有';
  category?: WardrobeCategory;
}
export interface ShopData {
  regular: { date: string; items: ShopRegularItem[] };
  storySpecials: ShopStoryItem[];
}

/**
 * 衣柜关闭时，常规商店只隐藏衣柜商品；其他商品的购买、预留或刷新不能顺带删除这些持久条目。
 * 衣柜开启时 nextItems 已是完整橱窗，直接返回，避免恢复已被正常刷新替换的旧商品。
 */
export function preserveHiddenRegularWardrobeItems(
  nextItems: readonly ShopRegularItem[],
  persistedItems: readonly ShopRegularItem[],
  wardrobeEnabled: boolean,
): ShopRegularItem[] {
  if (wardrobeEnabled) return nextItems.slice();
  const result = nextItems.slice();
  const ids = new Set(result.map(item => item.id));
  for (const item of persistedItems) {
    if (item.kind !== 'wardrobe' || ids.has(item.id)) continue;
    result.push(item);
    ids.add(item.id);
  }
  return result;
}

export function emptyShopData(): ShopData {
  return { regular: { date: '', items: [] }, storySpecials: [] };
}

function normalizeRegular(raw: any): ShopRegularItem | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
  const base: ShopRegularItem = {
    id: raw.id, name: String(raw.name ?? ''), type: String(raw.type ?? '道具'),
    quality: String(raw.quality ?? '普通'), price: Number(raw.price) || 0,
    originalPrice: typeof raw.originalPrice === 'number' ? raw.originalPrice : undefined,
    discount: typeof raw.discount === 'number' ? raw.discount : undefined,
    desc: String(raw.desc ?? ''),
  };
  if (raw.kind === 'skill') {
    base.kind = 'skill';
    base.skillType = raw.skillType === '主动' || raw.skillType === '被动' ? raw.skillType : '被动';
    base.strength = ['基础', '实用', '强力', '稀有'].includes(raw.strength) ? raw.strength : '基础';
  } else if (raw.kind === 'wardrobe') {
    const category = mapInventoryTypeToWardrobeCategory(raw.category || raw.type);
    if (!category) return null;
    base.kind = 'wardrobe';
    base.category = category;
  }
  return base;
}

function normalizeStory(raw: any): ShopStoryItem | null {
  return normalizeStoryProduct(raw);
}

export function normalizeShopData(raw: any): ShopData {
  const data = emptyShopData();
  if (!raw || typeof raw !== 'object') return data;
  data.regular.date = String(raw.regular?.date ?? '');
  if (Array.isArray(raw.regular?.items)) {
    data.regular.items = raw.regular.items.map(normalizeRegular)
      .filter((x: ShopRegularItem | null): x is ShopRegularItem => x !== null);
  }
  if (Array.isArray(raw.storySpecials)) {
    data.storySpecials = raw.storySpecials.map(normalizeStory)
      .filter((x: ShopStoryItem | null): x is ShopStoryItem => x !== null);
  }
  return data;
}

export async function loadShopData(): Promise<ShopData> {
  const data = normalizeShopData(readStoryFeature(SHOP_STORY_KEY, emptyShopData()));
  const drawn = new Set(readStoryFeature<string[]>(GACHA_DRAWN_KEY, []));
  if (drawn.size && data.regular.items.length) {
    const filtered = data.regular.items.filter(it => !drawn.has(it.id));
    if (filtered.length !== data.regular.items.length) {
      data.regular.items = filtered;
      void writeStoryFeature(SHOP_STORY_KEY, data);
    }
  }
  return data;
}

export async function saveShopData(data: ShopData): Promise<boolean> {
  return writeStoryFeature(SHOP_STORY_KEY, normalizeShopData(data));
}
