// ===== 商店衣柜商品原子购买事务 =====
import { getConfig } from './config-store';
import { makeUniqueId } from './id';
import { getCurrentCardName } from './current-card';
import { readSerseEnergy, adjustSerseEnergy } from './energy-payment'; // U31：能量读写统一出口（data-manager 依赖随之退役）
import {
  loadShopData,
  normalizeShopData,
  SHOP_STORY_KEY,
  type ShopData,
  type ShopRegularItem,
  type ShopStoryWardrobeItem,
} from './shop-store';
import { mergeCatalogItems, mergeOutfits } from './catalog-migration';
import { getCurrentStoryChatKey, readStoryFeature, writeStoryFeatures } from './story-floor-store';
import { flushWardrobeCatalog, writeWardrobeCatalog } from './wardrobe-catalog-store';
import {
  adoptExternalWardrobeState,
  loadWardrobeState,
  normalizeWardrobeState,
  withWardrobeMutationLock,
  WARDROBE_PROFILES_STORY_KEY,
  WARDROBE_STORY_KEY,
} from './wardrobe-store';
import {
  wardrobeDedupeKey,
  type OutfitPreset,
  type WardrobeItem,
  type WardrobeState,
} from './wardrobe-types';

export type ShopWardrobeSource = 'regular' | 'story';

type WardrobeShopProduct = (ShopRegularItem | ShopStoryWardrobeItem) & {
  kind: 'wardrobe';
  category: WardrobeItem['category'];
};

export interface ShopWardrobePurchaseDeps {
  loadShop(): Promise<ShopData>;
  loadWardrobe(): WardrobeState;
  readEnergy(): number;
  /** 能量增量写（delta，不是目标值）：并发下由引擎逐行取当前值计算，不丢增减。 */
  adjustEnergy(delta: number): Promise<boolean>;
  writeBoth(shop: ShopData, wardrobe: WardrobeState): Promise<boolean>;
  now(): number;
  makeId(): string;
  getSourceCard?(): string;
  isEnabled?(): boolean;
  locks?: Set<string>;
  getChatKey?(): string;
  adoptWardrobe?(state: WardrobeState): void;
  withMutationLock?<T>(task: () => Promise<T>): Promise<T>;
}

export type ShopWardrobePurchaseResult =
  | {
    ok: true;
    item: WardrobeItem;
    shop: ShopData;
    wardrobe: WardrobeState;
  }
  | { ok: false; error: string };

function productFrom(
  shop: ShopData,
  source: ShopWardrobeSource,
  productId: string,
): WardrobeShopProduct | null {
  const list = source === 'regular' ? shop.regular.items : shop.storySpecials;
  const product = list.find(item => item.id === productId);
  if (!product || product.kind !== 'wardrobe' || !product.category) return null;
  return product as WardrobeShopProduct;
}

export function createShopWardrobePurchase(deps: ShopWardrobePurchaseDeps) {
  const locks = deps.locks || new Set<string>();
  return async function purchase(
    source: ShopWardrobeSource,
    productId: string,
  ): Promise<ShopWardrobePurchaseResult> {
    const currentChatKey = (): string => deps.getChatKey?.() || getCurrentStoryChatKey();
    const ownerChatKey = currentChatKey();
    const serialize = deps.withMutationLock
      || (<T>(task: () => Promise<T>) =>
        withWardrobeMutationLock(ownerChatKey, task));
    return serialize(async () => {
    if (currentChatKey() !== ownerChatKey) {
      return { ok: false, error: '聊天已切换，本次购买已取消' };
    }
    const lockKey = `${source}:${productId}`;
    if (locks.has(lockKey)) return { ok: false, error: '该商品正在购买中，请勿重复操作' };
    locks.add(lockKey);
    try {
      if (deps.isEnabled && !deps.isEnabled()) return { ok: false, error: '衣柜功能已关闭，无法购买该商品' };
      const shop = normalizeShopData(await deps.loadShop());
      const product = productFrom(shop, source, productId);
      if (!product) return { ok: false, error: '该衣柜商品已售出或不存在' };
      const wardrobe = normalizeWardrobeState(deps.loadWardrobe());
      const key = wardrobeDedupeKey(product.name, product.category);
      if (wardrobe.items.some(item => wardrobeDedupeKey(item.name, item.category) === key)) {
        return { ok: false, error: '衣柜中已拥有同名同类别服饰' };
      }
      const energy = Math.max(0, Math.trunc(deps.readEnergy())); // 钳制语义保持（U31 出口不吞调用方钳制）
      if (energy < product.price) return { ok: false, error: `瑟瑟能量不足（当前 ${energy} / 需要 ${product.price}）` }; // U31 文案对齐
      if (!(await deps.adjustEnergy(-product.price))) return { ok: false, error: '扣除能量失败' };

      const at = deps.now();
      const sourceCard = (deps.getSourceCard?.() || '').trim();
      const item: WardrobeItem = {
        id: deps.makeId(),
        name: product.name.trim(),
        category: product.category,
        description: product.desc.trim(),
        ...(sourceCard ? { source: sourceCard } : {}),
        createdAt: at,
        updatedAt: at,
      };
      const nextWardrobe = normalizeWardrobeState({
        ...wardrobe,
        items: wardrobe.items.concat(item),
      });
      const nextShop: ShopData = source === 'regular'
        ? {
          ...shop,
          regular: {
            ...shop.regular,
            items: shop.regular.items.filter(candidate => candidate.id !== productId),
          },
        }
        : {
          ...shop,
          storySpecials: shop.storySpecials.filter(candidate => candidate.id !== productId),
        };
      if (!(await deps.writeBoth(nextShop, nextWardrobe))) {
        const refunded = await deps.adjustEnergy(product.price);
        return {
          ok: false,
          error: refunded
            ? '购买保存失败，能量已返还'
            : '购买保存失败且能量返还失败，请立即手动检查存档',
        };
      }
      deps.adoptWardrobe?.(nextWardrobe);
      return { ok: true, item, shop: nextShop, wardrobe: nextWardrobe };
    } finally {
      locks.delete(lockKey);
    }
    });
  };
}

function getParentPurchaseLocks(): Set<string> {
  try {
    const host = window.parent as any;
    if (!host.__ub_shop_wardrobe_locks) host.__ub_shop_wardrobe_locks = new Set<string>();
    return host.__ub_shop_wardrobe_locks;
  } catch (_e) {
    return new Set<string>();
  }
}

const defaultPurchase = createShopWardrobePurchase({
  loadShop: loadShopData,
  loadWardrobe: loadWardrobeState,
  readEnergy: () => readSerseEnergy(), // U31：统一出口
  adjustEnergy: delta => adjustSerseEnergy(delta), // U31：统一出口（直写通道；增量写）
  writeBoth: async (shop, wardrobe) => {
    // 自愈：历史版本曾把衣柜商品写入已废弃的 story 'wardrobe' 键（目录全局化后无人读取），
    // 迁移又只跑一次不会重跑，滞留在该键的购买物会永久丢失。购买时把残留并入目录再清键。
    const stranded = readStoryFeature<{
      schema?: number;
      items?: WardrobeItem[];
      outfits?: OutfitPreset[];
    } | undefined>(WARDROBE_STORY_KEY, undefined);
    const strandedItems = stranded && typeof stranded === 'object' && Array.isArray(stranded.items)
      ? stranded.items : [];
    const clearStranded = strandedItems.length > 0;
    let items = wardrobe.items;
    let outfits = wardrobe.outfits;
    if (clearStranded) {
      const merged = mergeCatalogItems(items, strandedItems);
      items = merged.items;
      outfits = mergeOutfits(outfits, stranded && Array.isArray(stranded.outfits) ? stranded.outfits : [], merged.idMap);
    }
    if (!await writeWardrobeCatalog(items, outfits)) return false;
    await flushWardrobeCatalog();
    return writeStoryFeatures(
      {
        [SHOP_STORY_KEY]: normalizeShopData(shop),
        [WARDROBE_PROFILES_STORY_KEY]: wardrobe.actorProfiles,
      },
      clearStranded ? [WARDROBE_STORY_KEY] : [],
    );
  },
  now: () => Date.now(),
  makeId: () => makeUniqueId('wi', 9, '_'),
  getSourceCard: getCurrentCardName,
  isEnabled: () => getConfig().wardrobeEnabled,
  locks: getParentPurchaseLocks(),
  getChatKey: getCurrentStoryChatKey,
  adoptWardrobe: adoptExternalWardrobeState,
});

export async function purchaseShopWardrobeItem(
  source: ShopWardrobeSource,
  productId: string,
): Promise<ShopWardrobePurchaseResult> {
  return defaultPurchase(source, productId);
}
