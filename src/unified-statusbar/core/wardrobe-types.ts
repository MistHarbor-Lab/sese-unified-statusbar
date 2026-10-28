// ===== 衣柜领域纯类型与规则 =====
// 不依赖 DOM、酒馆 API 或 story-floor；所有入口必须复用这里的类别、去重和槽位规则。

export const WARDROBE_CATEGORIES = [
  '上装', '下装', '连体服', '外套', '文胸',
  '内裤', '袜类', '鞋靴', '头饰', '配饰',
] as const;

export type WardrobeCategory = typeof WARDROBE_CATEGORIES[number];

export const WARDROBE_SINGLE_CATEGORIES = [
  '上装', '下装', '连体服', '外套', '文胸',
  '内裤', '袜类', '鞋靴', '头饰',
] as const;

export type WardrobeSingleCategory = typeof WARDROBE_SINGLE_CATEGORIES[number];

export const WARDROBE_DISPLAY_ORDER: readonly WardrobeCategory[] = [
  '文胸', '内裤', '上装', '下装', '连体服',
  '外套', '袜类', '鞋靴', '头饰', '配饰',
];

export interface WardrobeItem {
  id: string;
  name: string;
  category: WardrobeCategory;
  description: string;
  /** 衣物本身标签（tags 模式=英文 danbooru 标签串；natural 模式=简洁衣物视觉属性，语言随 naturalPromptLanguage 设置）。
   *  生成单品展示图时同一次 AI 调用产出，供套装重组与立绘衣着替换复用以保证衣物一致性。 */
  tags?: string;
  source?: string;
  imagePath?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OutfitPreset {
  id: string;
  name: string;
  description?: string;
  itemIds: string[];
  sourceCard?: string;
  imagePath?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OutfitSelection {
  slots: Partial<Record<WardrobeSingleCategory, string>>;
  accessories: string[];
}

export type WardrobeActorKey = string;

export interface WardrobeActorProfile {
  actorKey: WardrobeActorKey;
  displayName: string;
  currentOutfit: OutfitSelection;
  sourceOutfitId?: string;
  outfitPoolIds: string[];
  randomOutfitIds: string[];
  autoRandomEnabled: boolean;
  lastRandomDateKey?: string;
}

export interface WardrobeState {
  schema: 2;
  items: WardrobeItem[];
  outfits: OutfitPreset[];
  actorProfiles: Record<WardrobeActorKey, WardrobeActorProfile>;
  /** 套装展示图模特性别（全局目录级，跨聊天共享；缺省=女模）。 */
  modelGender?: 'female' | 'male';
}

export interface WardrobeItemDraft {
  name: string;
  category: WardrobeCategory | string;
  description: string;
  source?: string;
}

export interface WardrobeResolvedItem {
  id: string;
  category: WardrobeCategory;
  name: string;
  description: string;
  tags?: string;
}

export type WardrobeValidation =
  | { ok: true; value: { name: string; category: WardrobeCategory; description: string } }
  | { ok: false; error: string };

const CATEGORY_SET = new Set<string>(WARDROBE_CATEGORIES);
const SINGLE_SET = new Set<string>(WARDROBE_SINGLE_CATEGORIES);
const INVENTORY_TYPE_ALIASES: Record<string, WardrobeCategory> = {
  服装: '连体服',
  衣服: '连体服',
  衣物: '连体服',
  饰品: '配饰',
  配件: '配饰',
};

export function isWardrobeCategory(value: unknown): value is WardrobeCategory {
  return typeof value === 'string' && CATEGORY_SET.has(value);
}

export function isWardrobeSingleCategory(value: unknown): value is WardrobeSingleCategory {
  return typeof value === 'string' && SINGLE_SET.has(value);
}

export function normalizeWardrobeName(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function wardrobeDedupeKey(name: unknown, category: WardrobeCategory): string {
  return `${category}:${normalizeWardrobeName(name).toLocaleLowerCase()}`;
}

export function mapInventoryTypeToWardrobeCategory(value: unknown): WardrobeCategory | null {
  const text = normalizeWardrobeName(value);
  if (isWardrobeCategory(text)) return text;
  return INVENTORY_TYPE_ALIASES[text] || null;
}

export function emptyOutfitSelection(): OutfitSelection {
  return { slots: {}, accessories: [] };
}

function cloneSelection(selection: OutfitSelection): OutfitSelection {
  return {
    slots: { ...(selection?.slots || {}) },
    accessories: Array.isArray(selection?.accessories) ? selection.accessories.slice() : [],
  };
}

export function applyItemToSelection(
  current: OutfitSelection,
  item: Pick<WardrobeItem, 'id' | 'category'>,
): OutfitSelection {
  const next = cloneSelection(current);
  if (!item?.id || !isWardrobeCategory(item.category)) return next;
  if (item.category === '配饰') {
    if (!next.accessories.includes(item.id)) next.accessories.push(item.id);
    return next;
  }
  if (!isWardrobeSingleCategory(item.category)) return next;
  if (item.category === '连体服') {
    delete next.slots['上装'];
    delete next.slots['下装'];
  } else if (item.category === '上装' || item.category === '下装') {
    delete next.slots['连体服'];
  }
  next.slots[item.category] = item.id;
  return next;
}

export function removeItemFromSelection(current: OutfitSelection, itemId: string): OutfitSelection {
  const next = cloneSelection(current);
  for (const category of WARDROBE_SINGLE_CATEGORIES) {
    if (next.slots[category] === itemId) delete next.slots[category];
  }
  next.accessories = next.accessories.filter(id => id !== itemId);
  return next;
}

export function selectionFromItemIds(
  items: readonly WardrobeItem[],
  itemIds: readonly string[],
): OutfitSelection {
  const byId = new Map(items.map(item => [item.id, item]));
  let selection = emptyOutfitSelection();
  const seen = new Set<string>();
  for (const id of itemIds || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const item = byId.get(id);
    if (item) selection = applyItemToSelection(selection, item);
  }
  return selection;
}

export function selectionItemIds(selection: OutfitSelection): string[] {
  const ids: string[] = [];
  for (const category of WARDROBE_DISPLAY_ORDER) {
    if (category === '配饰') {
      for (const id of selection?.accessories || []) {
        if (id && !ids.includes(id)) ids.push(id);
      }
      continue;
    }
    const id = selection?.slots?.[category];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function validateWardrobeItemDraft(draft: WardrobeItemDraft): WardrobeValidation {
  const name = normalizeWardrobeName(draft?.name);
  if (!name) return { ok: false, error: '服饰名称不能为空' };
  if (name.length > 40) return { ok: false, error: '服饰名称不能超过40字' };
  if (!isWardrobeCategory(draft?.category)) return { ok: false, error: '服饰类别无效' };
  const description = String(draft?.description ?? '').trim();
  if (!description) return { ok: false, error: '服饰描述不能为空' };
  return { ok: true, value: { name, category: draft.category, description } };
}

// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 01 待修：文件尾的兼容性再导出（见 wardrobe-actors 那条）——保留是为了既有 `from './wardrobe-types'` 导入不破，解开需一并改调用点
export {
  PROTAGONIST_ACTOR_KEY,
  actorCurrentOutfitLabel,
  createEmptyWardrobeActorProfile,
  isWardrobeActorProfileEmpty,
  normalizeWardrobeActorName,
  wardrobeCharacterActorKey,
} from './wardrobe-actors';
