// ===== 衣柜 AI 请求提示词与结构化解析 =====
import { extractFencedJson } from './text-fence';
import type { NaturalPromptLanguage } from './portrait-config';
import { looseJsonParse } from './ai-parse';
import {
  WARDROBE_CATEGORIES,
  isWardrobeCategory,
  normalizeWardrobeName,
  type WardrobeCategory,
  type WardrobeResolvedItem,
} from './wardrobe-types';

export interface PresentCharacterClothing {
  name: string;
  currentOutfit: string;
  top: string;
  bottom: string;
  inner: string;
  socks: string;
  shoes: string;
  accessories: string;
}

export interface WardrobeExtractionCandidate {
  name: string;
  category: WardrobeCategory;
  description: string;
}

export interface WardrobeDesignResult {
  items: WardrobeExtractionCandidate[];
  outfit: { name: string; description: string } | null;
}

export interface WardrobeOutfitMetaResult {
  name: string;
  description: string;
}

/** 设计上下文：由调用方（index）收集，运行时只做装配与请求。 */
export interface WardrobeDesignContext {
  /** 触发注入素材（世界书绿灯扫描）；不进资料块。 */
  instruction: string;
  presentClothing: readonly PresentCharacterClothing[];
  storyContext: string;
}

/** 资料块注入内容（after_system，不参与扫描）：在场角色穿着 + 剧情上下文；全空返回空串省略注入。 */
export function buildWardrobeDesignDossier(context: WardrobeDesignContext): string {
  const parts: string[] = [];
  if (context.presentClothing.length) {
    const blocks = context.presentClothing.map(character => `<character name="${String(character.name || '').trim()}">
当前穿搭：${character.currentOutfit || ''}
上装：${character.top || ''}
下装：${character.bottom || ''}
内衣/内裤：${character.inner || ''}
袜子：${character.socks || ''}
鞋子：${character.shoes || ''}
饰品：${character.accessories || ''}
</character>`);
    parts.push(`【在场角色穿着资料】\n${blocks.join('\n')}`);
  }
  const story = String(context.storyContext || '').trim();
  if (story) parts.push(`【剧情上下文（最近剧情的 AI 回复节选，供与既有剧情保持一致）】\n${story}`);
  return parts.join('\n\n');
}

export interface WardrobePromptRequest {
  system: string;
  userInput: string;
}

export interface WardrobePromptTarget {
  targetId: string;
  name: string;
  category?: WardrobeCategory;
  description?: string;
  items?: WardrobeResolvedItem[];
}

/** 套装「故事中角色」模特资料（立绘同源：恋爱/重要角色表外貌特征 + NSFW身体数据，或 charTags 替代） */
export interface WardrobeOutfitModelData {
  name: string;
  gender?: string;
  appearance?: string;
  body?: string;
}

export interface PortraitClothingOverride {
  mode: 'partial' | 'full';
  items: WardrobeResolvedItem[];
}

const NON_ITEMS = new Set(['无', '没有', '未穿', '裸露', '裸足', '看不清', '未知', 'none', 'n/a']);

function parseTaggedJson(result: string, tag: string): any | null {
  if (!result) return null;
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = result.match(pattern);
  const raw = extractFencedJson(match ? match[1] : result);
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_e) {
    // 修复链兜底（ai-parse）：未转义引号/尾逗号/截断也能恢复。
    const repaired = looseJsonParse(raw);
    return repaired.ok && repaired.value && typeof repaired.value === 'object'
      ? repaired.value
      : null;
  }
}

/** 「AI 设计穿搭」请求（1A 三段式的 system/userInput 段；1A 装配在 wardrobe-runtime）。
 *  双用途：设计新服饰 / 按指令整理在场角色既有穿着（穿着资料由资料块注入）。 */
export function buildWardrobeDesignRequest(instruction: string): WardrobePromptRequest {
  const system = `你是服饰搭配设计器。根据玩家指令，并参考请求中提供的角色资料、世界书与最近剧情，自行判断本次设计范围，生成符合需求的单件或多件服饰，再把结果作为可独立复用的服装与配饰单品输出。不要为了凑成完整穿搭而添加与指令无关的单品。
若指令是整理或提炼既有穿着，只拆分角色资料中真实出现的服饰，不编造资料外的物件；但可基于该物件类别与已提及的属性，合理补充视觉细节。
本次只设计物件，不续写剧情，不描写人物身体、动作或裸体，也不得把单品绑定给任何具体人物。
允许类别仅为：${WARDROBE_CATEGORIES.join('、')}。每件单品只能使用一个允许类别；鞋袜成对仍算一个单品，文胸与内裤分别输出。
【name】简短可区分的物件名，不超过约 12 字。
【description】面向图像生成的详尽视觉描述，不少于 20 字，至少覆盖颜色、材质、剪裁、结构、花纹或整体风格中的三项。
【outfit.name】为本次生成的整组设计给出简洁名称，不超过 20 字；即使只有一件单品也要填写。
【outfit.description】概括整组设计的用途、风格与搭配关系，不超过 150 字；不得虚构未生成的单品。
严格输出：
<WARDROBE_DESIGN_JSON>
{"items":[{"name":"名称","category":"允许类别","description":"详尽视觉描述"}],"outfit":{"name":"套装名称","description":"套装整体描述"}}
</WARDROBE_DESIGN_JSON>`;
  return {
    system,
    userInput: `【玩家穿搭设计指令】\n${instruction}\n\n请根据上述指令自行判断需要生成的单品数量与类别，严格按上述 JSON 输出。`,
  };
}

/** 解析设计响应：items 校验与类别白名单同门，上限 20 件（提炼多角色场景宽松闸）；outfit 缺失/非法为 null。 */
export function parseWardrobeDesignResult(result: string): WardrobeDesignResult | null {
  const parsed = parseTaggedJson(result, 'WARDROBE_DESIGN_JSON');
  if (!parsed || !Array.isArray(parsed.items)) return null;
  const items: WardrobeExtractionCandidate[] = [];
  for (const raw of parsed.items.slice(0, 20)) {
    if (!raw || typeof raw !== 'object' || !isWardrobeCategory(raw.category)) continue;
    const name = normalizeWardrobeName(raw.name);
    const description = String(raw.description ?? '').trim();
    if (!name || !description) continue;
    if (NON_ITEMS.has(name.toLocaleLowerCase()) || NON_ITEMS.has(description.toLocaleLowerCase())) continue;
    items.push({
      name: name.slice(0, 40),
      category: raw.category,
      description,
    });
  }
  const outfitRaw = parsed.outfit && typeof parsed.outfit === 'object' ? parsed.outfit : null;
  const outfit = outfitRaw
    ? {
      name: normalizeWardrobeName(outfitRaw.name).slice(0, 40),
      description: String(outfitRaw.description ?? '').trim().slice(0, 300),
    }
    : null;
  return { items, outfit };
}

/** 套装编辑器「生成名称/描述」请求（裸通道，与提炼同 scope；↻ 通用能力）。 */
export function buildWardrobeOutfitMetaRequest(items: readonly WardrobeResolvedItem[]): WardrobePromptRequest {
  const system = `你是套装命名与描述生成器。根据输入的已选服饰清单，为这组搭配生成套装名称与整体描述。
【name】简洁名称，不超过约 20 字。
【description】概括整组搭配的用途、风格与单品间搭配关系，不超过 150 字；不得虚构清单外的单品。
严格输出：
<WARDROBE_OUTFIT_META_JSON>
{"name":"套装名称","description":"套装整体描述"}
</WARDROBE_OUTFIT_META_JSON>`;
  const lines = items.map(item => `${item.category} · ${item.name}：${item.description}`);
  return {
    system,
    userInput: `【已选服饰清单】\n${lines.join('\n')}\n\n请严格按上述 JSON 输出。`,
  };
}

export function parseWardrobeOutfitMeta(result: string): WardrobeOutfitMetaResult | null {
  const parsed = parseTaggedJson(result, 'WARDROBE_OUTFIT_META_JSON');
  if (!parsed) return null;
  const name = normalizeWardrobeName(parsed.name).slice(0, 40);
  const description = String(parsed.description ?? '').trim().slice(0, 300);
  if (!name && !description) return null;
  return { name, description };
}

// 类别出词规范只随 tags 模式注入（danbooru 标签词汇约束；natural 模式输出自然语言属性不适用）
const ITEM_TAG_RULES_SHARED = `【全品类标签规范】
- 同一维度只保留一个标签（颜色、长度、花纹、材质各自唯一），不并列同维度近义词；
- 优先 danbooru 复合标签（如 lace-trimmed thighhighs、black pantyhose），不拆成多个单标签。`;

const ITEM_TAG_RULES_BY_CATEGORY: Partial<Record<WardrobeCategory, string>> = {
  '袜类': `【袜类标签规范】
- 长度五选一：socks（短袜）／kneehighs（及膝）／over-kneehighs（过膝）／thighhighs（大腿）／hiphighs（腿根以上）；连体裤袜用 pantyhose，不再另输出长度标签；
- 格纹三选一互斥：混色小方格＝gingham、单色方格＝checkered、塔特格纹＝plaid，禁止并列两个格纹词；
- 蕾丝并入品类复合标签（lace-trimmed thighhighs／lace-trimmed socks／ruffled socks），禁止散落的 lace、lace trim、white lace 单标签；
- 材质只写视觉可见标签（knit／ribbed／fishnet／shiny／see-through），禁止 cotton、wool 等成分词；
- 禁止输出画面无法验证的结构词（如 elastic cuff）。
理想输出示例：pink gingham thighhighs, lace-trimmed thighhighs`,
  '鞋靴': `【鞋靴标签规范】
- 优先具体鞋型标签（mary janes／loafers／platform footwear／lace-up boots／thighhigh boots 等）；boots／shoes 泛称仅在原文无更具体信息时使用。`,
};

function itemCategoryRuleSections(categories: readonly WardrobeCategory[] | undefined): string {
  const sections = [ITEM_TAG_RULES_SHARED];
  if (categories) {
    for (const category of new Set(categories)) {
      const section = ITEM_TAG_RULES_BY_CATEGORY[category];
      if (section) sections.push(section);
    }
  }
  return sections.join('\n\n');
}

export function itemPromptSystem(
  mode: 'tags' | 'natural',
  language: NaturalPromptLanguage = 'en',
  categories?: readonly WardrobeCategory[],
): string {
  const categoryRules = mode === 'tags' ? `\n${itemCategoryRuleSections(categories)}\n` : '';
  return `你是服饰标签翻译器。为每个 targetId，把该件衣物的中文名称与描述翻译成纯净的该衣物本体标签，供前端拼装单品展示图主提示词。

【标签范围】只描述该单件商品本体视觉特征：颜色、材质/面料、剪裁/版型、花纹/图案、结构细节（领型、袖型、长度、口袋、扣件、鞋跟等）、品类。保留并展开物件固有细节，不编造未出现的物件。
第一项必须是最具体的物品品类或“颜色＋品类”（如 white socks、combat boots、silver anklet、pink hoodie），后续每项只写一个独立属性。
${categoryRules}
【严禁输出】
- 展示框定词：clothes_focus、no_humans、object_focus、simple_background、white_background（由前端注入）；
- 构图词：flat_lay、hanging、standing、folded、on_hanger 等（由前端按类别注入）；
- 人体词：human、hands、feet、legs、arms、face、body、skin、person、mannequin、worn、wearing 等；
- 数量词：pair_of、couple、set_of、two、double、pair（数量由前端按类别注入）；
- 不得描述重复的第二件不同物件。
${mode === 'tags'
    ? '【标签模式】tags 必须是 JSON 字符串数组；只输出英文 NovelAI/Danbooru 标签，每个数组元素恰好一个标签，不混中文。保留合法加权语法 {{tag}} 与 1.5::tag::。'
    : language === 'zh'
      ? '【自然语言模式】tags 必须是 JSON 字符串数组；每个数组元素是一条简洁中文衣物视觉属性，不含白底、平铺、悬挂等框定。'
      : '【自然语言模式】tags 必须是 JSON 字符串数组；每个数组元素是一条简洁英文衣物视觉属性，不含白底、平铺、悬挂等框定。'}
严格输出：
<WARDROBE_PROMPTS_JSON>
{"prompts":[{"targetId":"原ID","tags":["最具体品类标签","颜色/材质/结构标签"]}]}
</WARDROBE_PROMPTS_JSON>`;
}

const ITEM_TAG_FORBIDDEN = [
  /\b(?:human|person|girl|boy|woman|man|mannequin)\b/i,
  /\b(?:hands?|feet|legs?|arms?|face|skin|body|torso|head|partial body)\b/i,
  /\b(?:worn|wearing|standing|hanging|flat lay|on hanger|folded)\b/i,
  /\b(?:white background|simple background|object focus|clothes focus|footwear focus|still life)\b/i,
  /\b(?:pair of|set of|couple|two|double|multiple items?)\b/i,
];

function splitWardrobeTagValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(part => String(part ?? ''));
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  if (raw.includes(',')) return raw.split(',');
  if (!/[\u3400-\u9fff]/.test(raw) && raw.includes('_')) return raw.split(/\s+/);
  return [raw];
}

export function normalizeWardrobeItemTags(value: unknown): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rawPart of splitWardrobeTagValue(value)) {
    const tag = rawPart.trim().replace(/_/g, ' ').replace(/\s+/g, ' ');
    if (!tag || ITEM_TAG_FORBIDDEN.some(pattern => pattern.test(tag))) continue;
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out.join(', ');
}

const ITEM_UNWORN_ANCHOR: Partial<Record<WardrobeCategory, string>> = {
  '上装': 'unworn clothes',
  '下装': 'unworn clothes',
  '连体服': 'unworn clothes',
  '外套': 'unworn clothes',
  '文胸': 'unworn bra',
  '内裤': 'unworn panties',
  '袜类': 'unworn socks',
  '鞋靴': 'unworn shoes',
  '头饰': 'unworn headwear',
};

const JEWELRY_TAG = /\b(?:jewelry|anklet|necklace|bracelet|earrings?|ring|brooch|pendant|chain)\b/i;

export interface WardrobeItemDisplayPromptInput {
  apiFormat: 'novelai' | 'openai' | 'comfyui';
  mode: 'tags' | 'natural';
  category: WardrobeCategory;
  name: string;
  description: string;
  tags: string;
  /**
   * 形态覆盖（**智慧姬通道专用**）：智慧姬的存储位钉 openai，光看 apiFormat 会把「吃标签」的
   * SD/NAI/ComfyUI 模式也编译成中文自然语言商品规格 ⇒ 标签形同废纸、单品图与标签对不上（docs/62 §五-3）。
   * 调用方按智慧姬当前模式传 'tags'/'natural'；''（模式未选）或缺省时按 apiFormat 兜底（内置口径）。
   */
  form?: 'tags' | 'natural';
}

function itemSubjectZh(input: WardrobeItemDisplayPromptInput): string {
  if (input.category === '袜类' || input.category === '鞋靴') {
    return `恰好一双匹配的${input.name}（两只），完整可见`;
  }
  return `恰好一件${input.name}，完整可见`;
}

/**
 * 按图片供应商编译单品展示图主提示词。
 * NovelAI 使用已知标签与未穿戴锚点；OpenAI 兼容接口使用结构化自然语言商品规格。
 * input.form 优先（智慧姬按插件当前模式判形态），缺省时才看 apiFormat。
 */
export function assembleItemDisplayPrompt(
  input: WardrobeItemDisplayPromptInput,
): string {
  const itemTags = normalizeWardrobeItemTags(input.tags);
  const natural = input.form ? input.form === 'natural' : input.apiFormat === 'openai';
  if (natural) {
    const appearance = [input.description.trim(), itemTags].filter(Boolean).join('；');
    return [
      '用途：独立电商目录商品图。',
      `主体：${itemSubjectZh(input)}。`,
      `外观：${appearance || input.name}。`,
      '构图：商品居中，正面或轻微俯视，四周留有均匀空白。',
      '背景：纯白无缝背景，只允许轻微接触阴影。',
      '硬约束：画面中只能出现上述商品。不得出现人物、皮肤、肢体、穿戴状态、模特、衣架、支架、包装、家具、其他商品、装饰物、文字、标志或水印。',
    ].join('\n');
  }

  const anchor = input.category === '配饰' && JEWELRY_TAG.test(itemTags)
    ? 'unworn jewelry'
    : ITEM_UNWORN_ANCHOR[input.category];
  const unit = input.category === '袜类'
    ? '2 socks, matching pair, side-by-side'
    : input.category === '鞋靴'
      ? '2 shoes, matching pair, side-by-side'
      : 'single item';
  const parts = [
    'no humans',
    'object focus',
    'still life',
    anchor,
    itemTags,
    unit,
    'fully visible',
    'centered',
    'straight-on',
    'simple background',
    'white background',
    'subtle contact shadow',
    'no text',
  ].filter(Boolean);
  return parts.join(', ');
}

export function outfitPromptSystem(mode: 'tags' | 'natural', language: NaturalPromptLanguage = 'en', modelIsCharacter = false): string {
  const modelRule = modelIsCharacter
    ? '严格复用输入的 modelTags 中【角色姓名】【性别】【外貌特征】【身体数据】的内容，不得改动其发色、瞳色、肤色、体型等外貌标签；模特即输入指定的故事角色本人，必须按其外貌绘制，不得替换为他人或匿名模特。'
    : '严格复用输入的 modelTags，不得改动其发色、瞳色、肤色、体型、性别数量标签；模特为固定外貌的匿名展示模特，不得赋予特定角色身份或剧情动作。';
  return `你是服饰商品图提示词工程师。为每个 targetId，依据给定的模特标签（modelTags）与该套装每件单品的标签，重组出全身套装展示绘图主提示词。

【模特一致性（铁律）】
${modelRule}

【衣物重组】
- 逐件保留输入中每件单品标签，不得替换、删减或自行补齐未提供的衣物。
- 按叠穿关系组织：内衣→上装→下装→袜→鞋→配饰；外层（外套/连衣裙/连体服/大衣）完全遮挡内衣时，不输出 bra/panties/underwear 等内衣标签，避免衣物穿透。
- 选一个适合展示全身衣物的姿势（如 standing, fashion model pose, one leg forward, turning around, hands on hips），姿势须与衣物展示兼容，不得生成需要第二人的交互。

【构图】
全身商品展示构图：solo, full body；简洁影棚或中性背景（simple background, studio lighting）；不裁切鞋靴和头饰；不添加文字、水印、品牌标识。
${mode === 'tags'
    ? '标签模式：只输出英文 danbooru 标签（小写、空格分隔、不混中文），保留合法加权语法 {{}} 与 1.5::tag::。'
    : language === 'zh'
      ? '自然语言模式：输出中文完整画面描述。'
      : '自然语言模式：输出英文完整画面描述。'}
严格输出：
<WARDROBE_PROMPTS_JSON>
{"prompts":[{"targetId":"原ID","prompt":"全身套装展示完整主提示词"}]}
</WARDROBE_PROMPTS_JSON>`;
}

export function buildWardrobeBatchPromptRequest(
  targetType: 'item' | 'outfit',
  mode: 'tags' | 'natural',
  targets: readonly WardrobePromptTarget[],
  modelTags?: string,
  language: NaturalPromptLanguage = 'en',
  modelIsCharacter = false,
  /** 自定义任务提示词（「生图 AI 请求提示词」板块 image:wardrobeItem/Outfit:system）；空串用内置。 */
  systemOverride?: string,
): WardrobePromptRequest {
  const compact = targets.map(target => targetType === 'item'
    ? {
      targetId: target.targetId,
      category: target.category,
      name: target.name,
      description: target.description || '',
    }
    : {
      targetId: target.targetId,
      name: target.name,
      description: target.description || '',
      items: (target.items || []).map(item => ({
        category: item.category,
        name: item.name,
        // 优先用单品存盘标签；缺标签时回退描述，保证套装可重组（一致性略降）
        tags: (item.tags || '').trim() || item.description,
      })),
    });
  const userInput = targetType === 'outfit'
    ? JSON.stringify({ mode, modelTags: modelTags || '', targets: compact })
    : JSON.stringify({ mode, targets: compact });
  // 只把涉及类别的出词规范注入 system（token 最省）；类别缺失的目标仅享受全品类共享规范
  const itemCategories = targetType === 'item'
    ? Array.from(new Set(targets
      .map(target => target.category)
      .filter((category): category is WardrobeCategory => !!category)))
    : undefined;
  const builtinSystem = targetType === 'item'
    ? itemPromptSystem(mode, language, itemCategories)
    : outfitPromptSystem(mode, language, modelIsCharacter);
  return {
    system: systemOverride && systemOverride.trim() ? systemOverride.trim() : builtinSystem,
    userInput,
  };
}

/** 「故事中角色」模特块：立绘同源字段拼装（【角色姓名】/【性别】/【外貌特征】/【身体数据】）。
 *  取值（数据库列或 charTags 替代）由调用方解析，这里只负责拼装；全空返回空串。 */
export function buildOutfitModelTags(model: WardrobeOutfitModelData): string {
  const parts: string[] = [];
  const name = String(model.name || '').trim();
  if (name) parts.push(`【角色姓名】\n${name}`);
  const gender = String(model.gender || '').trim();
  if (gender) parts.push(`【性别】\n${gender}`);
  const appearance = String(model.appearance || '').trim();
  if (appearance) parts.push(`【外貌特征】\n${appearance}`);
  const body = String(model.body || '').trim();
  if (body) parts.push(`【身体数据】\n${body}`);
  return parts.join('\n\n');
}

export function parseWardrobeBatchPrompts(
  result: string,
  expectedIds: readonly string[],
): { prompts: Record<string, string>; errors: Record<string, string>; tags: Record<string, string> } {
  const prompts: Record<string, string> = {};
  const errors: Record<string, string> = {};
  const tags: Record<string, string> = {};
  const expected = new Set(expectedIds);
  const parsed = parseTaggedJson(result, 'WARDROBE_PROMPTS_JSON');
  const seen = new Set<string>();
  if (parsed && Array.isArray(parsed.prompts)) {
    for (const raw of parsed.prompts) {
      const id = String(raw?.targetId ?? '');
      if (!expected.has(id)) continue;
      if (seen.has(id)) {
        delete prompts[id];
        delete tags[id];
        errors[id] = '提示词返回了重复目标 ID';
        continue;
      }
      seen.add(id);
      const prompt = String(raw?.prompt ?? '').trim();
      const rawTags = raw?.tags;
      const hasRawTags = Array.isArray(rawTags)
        ? rawTags.some(value => String(value ?? '').trim())
        : !!String(rawTags ?? '').trim();
      const tagStr = normalizeWardrobeItemTags(rawTags);
      // 放宽：prompt 或 tags 任一非空即接受（item 路径 AI 只回 tags，outfit 路径 AI 回 prompt）
      if (!prompt && !tagStr) {
        errors[id] = hasRawTags ? '未获得有效物品标签' : '提示词为空';
        continue;
      }
      if (prompt) prompts[id] = prompt;
      if (tagStr) tags[id] = tagStr.slice(0, 500);
    }
  }
  for (const id of expectedIds) {
    if (!prompts[id] && !tags[id] && !errors[id]) errors[id] = '提示词缺失';
  }
  return { prompts, errors, tags };
}
