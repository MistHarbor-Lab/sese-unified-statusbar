// ===== 剧情特卖商品纯数据层 =====
// 不依赖 DOM / 数据库，集中处理判别联合、AI YAML 容错解析与技能本地定价。
import { clampIntNumberTrunc } from './number';

export type ShopSkillType = '主动' | '被动';
export type ShopSkillStrength = '基础' | '实用' | '强力' | '稀有';

interface ShopStoryBase {
  id: string;
  name: string;
  price: number;
  desc: string;
}

export interface ShopStoryRegularItem extends ShopStoryBase {
  kind: 'item';
  type: string;
}

export interface ShopStorySkillItem extends ShopStoryBase {
  kind: 'skill';
  type: '技能';
  skillType: ShopSkillType;
  strength: ShopSkillStrength;
}

export type ShopWardrobeCategory =
  | '上装' | '下装' | '连体服' | '外套' | '文胸'
  | '内裤' | '袜类' | '鞋靴' | '头饰' | '配饰';

export interface ShopStoryWardrobeItem extends ShopStoryBase {
  kind: 'wardrobe';
  type: string;
  category: ShopWardrobeCategory;
}

export type ShopStoryItem = ShopStoryRegularItem | ShopStorySkillItem | ShopStoryWardrobeItem;

const WARDROBE_CATEGORIES = new Set<ShopWardrobeCategory>([
  '上装', '下装', '连体服', '外套', '文胸', '内裤', '袜类', '鞋靴', '头饰', '配饰',
]);

function normalizeWardrobeCategory(value: unknown): ShopWardrobeCategory | null {
  const text = cleanText(value);
  return WARDROBE_CATEGORIES.has(text as ShopWardrobeCategory) ? text as ShopWardrobeCategory : null;
}

const SKILL_STRENGTHS: readonly ShopSkillStrength[] = ['基础', '实用', '强力', '稀有'];
const SKILL_PRICE_RANGES: Record<ShopSkillStrength, readonly [number, number]> = {
  基础: [20, 27],
  实用: [28, 35],
  强力: [36, 43],
  稀有: [44, 50],
};

function cleanText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeStrength(value: unknown): ShopSkillStrength {
  const text = cleanText(value) as ShopSkillStrength;
  return SKILL_STRENGTHS.includes(text) ? text : '基础';
}

function normalizeSkillType(value: unknown): ShopSkillType | null {
  const text = cleanText(value);
  return text === '主动' || text === '被动' ? text : null;
}

/** 旧存档缺少 kind 时按普通剧情商品读取。 */
export function normalizeStoryProduct(raw: unknown): ShopStoryItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const id = cleanText(data.id);
  if (!id) return null;
  const name = cleanText(data.name);
  const desc = cleanText(data.desc ?? data.description);
  if (data.kind === 'wardrobe') {
    const category = normalizeWardrobeCategory(data.category);
    if (!name || !desc || !category) return null;
    return {
      kind: 'wardrobe',
      id,
      name,
      type: cleanText(data.type) || category,
      category,
      price: clampIntNumberTrunc(data.price, 5, 20, 5),
      desc,
    };
  }
  if (data.kind !== 'skill') {
    return {
      kind: 'item',
      id,
      name,
      type: cleanText(data.type) || '奇物',
      price: Number(data.price) || 0,
      desc,
    };
  }

  const skillType = normalizeSkillType(data.skillType ?? data.skill_type);
  if (!name || !desc || !skillType) return null;
  return {
    kind: 'skill',
    id,
    name,
    type: '技能',
    price: clampIntNumberTrunc(data.price, 20, 50, 20),
    desc,
    skillType,
    strength: normalizeStrength(data.strength),
  };
}

export function canonicalSkillName(name: unknown): string {
  return cleanText(name).replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function storyProductDedupeKey(item: Pick<ShopStoryItem, 'kind' | 'name'>): string {
  return item.kind + ':' + canonicalSkillName(item.name);
}

export function randomSkillPrice(strength: unknown, random: () => number = Math.random): number {
  const [min, max] = SKILL_PRICE_RANGES[normalizeStrength(strength)];
  const sample = Math.max(0, Math.min(0.999999999999, Number(random()) || 0));
  return min + Math.floor(sample * (max - min + 1));
}

/** 技能关闭时返回与旧版本等价的纯道具提示词。 */
export function buildSaleInstruction(
  skillEnabled: boolean,
  wardrobeEnabled = false,
  genCount = 10,
): string {
  const commonHead = [
    '你是一个剧情商品生成器。根据当前故事世界观、时代背景、剧情上下文，生成要求内容：',
    '',
    '【生成要求】',
  ];
  const outputHead = [
    '',
    '【输出格式】',
    '所有商品依次包裹在 <sale> 和 </sale> 标签对中，用同一个 YAML 列表：',
    '<sale>',
  ];
  if (!skillEnabled && !wardrobeEnabled) {
    return commonHead.concat([
      '生成 ' + genCount + ' 件与当前世界观紧密关联、能为主角剧情发展提供帮助或带来沉浸式剧情乐趣的道具。',
      '每件道具包含：id、name、type、price、description。',
      '- id：从 sale_1 到 sale_' + genCount,
      '- name：道具名（与物品表已有物品不可重名）',
      '- type：物品类型（如奇物/符箓/秘药/信物/兵器等）',
      '- price：5-20 的整数，按对主角剧情作用大小与重要程度标价',
      '- description：≤80 字的道具描述',
    ], outputHead, [
      '- id: "sale_1"',
      '  name: "{{道具名}}"',
      '  type: "{{类型}}"',
      '  price: {{5-20}}',
      '  description: "{{≤80字描述}}"',
      '- id: "sale_2"',
      '  ...',
      '</sale>',
      '',
      '除 <sale> 标签内容外，不输出其他正文、思考或任何无关内容！',
    ]).join('\n');
  }

  if (skillEnabled && !wardrobeEnabled) {
    return commonHead.concat([
    '总共生成 10 件商品：9 件剧情道具和 1 件技能商品。所有商品放在同一个列表中。',
    '剧情道具字段：id、kind、name、type、price、description。',
    '- 剧情道具 kind 固定为 item；price 为 5-20 的整数；description 不超过 80 字。',
    '技能商品字段：id、kind、name、skill_type、strength、description。',
    '- 技能商品 kind 固定为 skill。',
    '- name：符合当前世界观与主角经历的技能名称。',
    '- skill_type：只能是“主动”或“被动”。',
    '- strength：只能是“基础”“实用”“强力”“稀有”之一，按基础效果强度判断。',
    '- description：技能的基础效果描述，清晰说明可直接获得的效果。',
    '- 技能商品无需输出 price，价格由系统根据 strength 决定。',
  ], outputHead, [
    '- id: "sale_1"',
    '  kind: "item"',
    '  name: "{{道具名}}"',
    '  type: "{{类型}}"',
    '  price: {{5-20}}',
    '  description: "{{≤80字描述}}"',
    '- id: "sale_10"',
    '  kind: "skill"',
    '  name: "{{技能名称}}"',
    '  skill_type: "{{主动或被动}}"',
    '  strength: "{{基础/实用/强力/稀有}}"',
    '  description: "{{技能基础效果描述}}"',
    '</sale>',
    '',
    '除 <sale> 标签内容外，不输出其他正文、思考或任何无关内容！',
    ]).join('\n');
  }

  const ordinaryCount = skillEnabled ? 8 : 9;
  return commonHead.concat([
    `总共生成 10 件商品：${ordinaryCount} 件普通道具、1 件衣柜商品${skillEnabled ? '、1 件技能商品' : ''}。所有商品放在同一个列表中。`,
    '普通道具字段：id、kind、name、type、price、description；kind 固定为 item。',
    '衣柜商品字段：id、kind、name、category、price、description。',
    '- 衣柜商品 kind 固定为 wardrobe；category 只能是上装、下装、连体服、外套、文胸、内裤、袜类、鞋靴、头饰、配饰。',
    '- 衣柜商品 price 为 5-20 的整数；description 不超过 120 字，只描述服饰本体的颜色、材质、剪裁、花纹和结构。',
    '- 衣柜商品不得描述穿着者身体、动作、汗湿、体液、临时破损、掀起或脱落状态。',
    ...(skillEnabled ? [
      '技能商品字段：id、kind、name、skill_type、strength、description；kind 固定为 skill。',
      '- skill_type 只能是“主动”或“被动”；strength 只能是“基础”“实用”“强力”“稀有”之一；技能价格由系统计算。',
    ] : []),
  ], outputHead, [
    '- id: "sale_1"',
    '  kind: "item"',
    '  name: "{{道具名}}"',
    '  type: "{{类型}}"',
    '  price: {{5-20}}',
    '  description: "{{≤80字描述}}"',
    `- id: "sale_${ordinaryCount + 1}"`,
    '  kind: "wardrobe"',
    '  name: "{{服饰名}}"',
    '  category: "{{上装/下装/连体服/外套/文胸/内裤/袜类/鞋靴/头饰/配饰}}"',
    '  price: {{5-20}}',
    '  description: "{{≤120字纯服饰视觉描述}}"',
    ...(skillEnabled ? [
      '- id: "sale_10"',
      '  kind: "skill"',
      '  name: "{{技能名称}}"',
      '  skill_type: "{{主动或被动}}"',
      '  strength: "{{基础/实用/强力/稀有}}"',
      '  description: "{{技能基础效果描述}}"',
    ] : []),
    '</sale>',
    '',
    '除 <sale> 标签内容外，不输出其他正文、思考或任何无关内容！',
  ]).join('\n');
}

function readYamlScalar(block: string, key: string): string {
  const pattern = new RegExp('^\\s*(?:-\\s*)?' + key + '\\s*:\\s*(.*)$', 'mi');
  const match = block.match(pattern);
  if (!match) return '';
  const value = match[1].trim();
  if (value.length >= 2) {
    const first = value.charAt(0);
    const last = value.charAt(value.length - 1);
    if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
      return value.slice(1, -1).trim();
    }
  }
  return value;
}

/** 条目级容错：无效条目跳过，最多接受前 maxItems 条有效商品。 */
export function parseSaleYaml(
  yaml: string,
  random: () => number = Math.random,
  maxItems = 10,
): ShopStoryItem[] {
  if (!yaml || maxItems <= 0) return [];
  const products: ShopStoryItem[] = [];
  const blocks = yaml.trim().split(/\n(?=\s*-\s*(?:id|kind|name)\s*:)/i);
  for (const block of blocks) {
    if (products.length >= maxItems) break;
    const rawKind = readYamlScalar(block, 'kind').toLocaleLowerCase();
    const kind = rawKind === 'skill' ? 'skill' : rawKind === 'wardrobe' ? 'wardrobe' : 'item';
    const id = readYamlScalar(block, 'id') || 'sale_' + (products.length + 1);
    const name = readYamlScalar(block, 'name');
    const desc = readYamlScalar(block, 'description');
    if (!name) continue;

    if (kind === 'skill') {
      const skillType = normalizeSkillType(
        readYamlScalar(block, 'skill_type') || readYamlScalar(block, 'skillType'),
      );
      if (!skillType || !desc) continue;
      const strength = normalizeStrength(readYamlScalar(block, 'strength'));
      products.push({
        kind: 'skill',
        id,
        name,
        type: '技能',
        price: randomSkillPrice(strength, random),
        desc,
        skillType,
        strength,
      });
      continue;
    }

    if (kind === 'wardrobe') {
      const category = normalizeWardrobeCategory(readYamlScalar(block, 'category'));
      const priceText = readYamlScalar(block, 'price');
      if (!category || !desc || !priceText || !Number.isFinite(Number.parseInt(priceText, 10))) continue;
      products.push({
        kind: 'wardrobe',
        id,
        name,
        type: category,
        category,
        price: clampIntNumberTrunc(Number.parseInt(priceText, 10), 5, 20, 5),
        desc: desc.slice(0, 120),
      });
      continue;
    }

    const priceText = readYamlScalar(block, 'price');
    if (!priceText || !Number.isFinite(Number.parseInt(priceText, 10))) continue;
    products.push({
      kind: 'item',
      id,
      name,
      type: readYamlScalar(block, 'type') || '奇物',
      price: clampIntNumberTrunc(Number.parseInt(priceText, 10), 5, 20, 5),
      desc,
    });
  }
  return products;
}
