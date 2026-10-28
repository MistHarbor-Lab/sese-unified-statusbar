// ===== 物品总览图提示词层：仓库物品清单 → 静物陈列主提示词 =====
// 研究依据 docs/research/2026-08-26-nai-prompt-engineering-upgrade.md：
// 多物品一张图走 still life + object focus + 数量感知排布；负面词防"游戏背包 UI 截图"化，
// 刻意不含 multiple items（多物品正是目标）。

export type ItemOverviewPromptMode = 'tags' | 'natural';
export type ItemOverviewNaturalLanguage = 'en' | 'zh';

export interface ItemOverviewPromptItem {
  name: string;
  type: string;
  qty: string;
  description: string;
}

export interface ItemOverviewPromptRequest {
  system: string;
  userInput: string;
}

/** NAI V4/V4.5 基座约 512 T5 token 上限；40 件已到单图可辨排布极限，超出截断。 */
export const ITEM_OVERVIEW_MAX_ITEMS = 40;

/** 前端确定注入的额外负面词：防 UI 感/图标化/人物；不含 multiple items（多物品是目标）。 */
export const ITEM_OVERVIEW_EXTRA_NEGATIVE =
  'humans, person, hands, character, mascot, holding, worn, wearing, text, logo, watermark, signature, '
  + 'user interface, inventory screen, item icon, tooltip, grid, infographic, chart, multiple views, comic, panel layout';

export function overviewPromptSystem(mode: ItemOverviewPromptMode, language: ItemOverviewNaturalLanguage): string {
  return `你是藏品陈列静物图提示词工程师。根据输入的仓库物品清单（名称/类型/数量/描述），编排一张"多物品总览静物图"的绘图主提示词。

【构图铁律】
- 一张图呈现全部物品：数量多时用 grouped/clustered 排布，禁止只画其中单件；数量感知标签与物品数一致（如 5 objects / assorted items）。
- 无人物：no humans, no hands；物品呈自然陈列状态（neatly arranged / grouped together / spread out），可选承载面（on wooden table / on display shelf / flat lay）与光照（warm lighting / soft daylight）。
- 每件物品翻译为英文 danbooru 标签（小写、空格分隔），保留类型特征（武器→sword/dagger 等、服饰→folded clothes、药瓶→potion bottle、宝石→gemstone、书→book）；数量大于 1 的物品用数量感知标签（multiple/pair/stack of），不逐个重复同一标签。
- 背景与风格：simple background，或与物品气质匹配的环境（如 warehouse interior, treasure hoard, wooden chest）；整图以 still life, object focus 收束。
${mode === 'tags'
    ? '标签模式：只输出英文 danbooru 标签（小写、逗号分隔），允许 {{}} 与 1.5::tag:: 加权；不得输出中文、句子或解释。'
    : language === 'zh'
      ? '自然语言模式：输出中文完整画面描述。'
      : '自然语言模式：输出英文完整画面描述。'}

严格输出：
<ITEM_OVERVIEW_JSON>
{"prompt":"总览图完整主提示词","negative_prompt":"英文负面标签（可空字符串）"}
</ITEM_OVERVIEW_JSON>`;
}

function describeItem(item: ItemOverviewPromptItem, index: number): string {
  const desc = item.description.trim().slice(0, 60);
  const qty = item.qty.trim() && item.qty.trim() !== '1' ? `×${item.qty.trim()}` : '';
  return `${index + 1}. ${item.name.trim()}${qty ? qty : ''}｜类型：${item.type.trim() || '未注明'}${desc ? `｜${desc}` : ''}`;
}

export function buildItemOverviewPromptRequest(
  items: readonly ItemOverviewPromptItem[],
  mode: ItemOverviewPromptMode,
  extraPrompt?: string,
  language: ItemOverviewNaturalLanguage = 'en',
  /** 自定义任务提示词（「生图 AI 请求提示词」板块 image:itemOverview:system）；空串用内置。 */
  systemOverride?: string,
): ItemOverviewPromptRequest {
  const trimmed = items.filter(item => item && item.name?.trim());
  const capped = trimmed.slice(0, ITEM_OVERVIEW_MAX_ITEMS);
  const lines: string[] = [
    '请为以下仓库物品生成一张总览静物图的绘图主提示词。',
  ];
  if (trimmed.length > capped.length) {
    lines.push(`（物品共 ${trimmed.length} 件，仅展示前 ${ITEM_OVERVIEW_MAX_ITEMS} 件入图）`);
  }
  lines.push(...capped.map((item, index) => describeItem(item, index)));
  const extra = extraPrompt?.trim();
  if (extra) {
    lines.push('', '【本次附加要求】', extra);
  }
  return {
    system: systemOverride && systemOverride.trim() ? systemOverride.trim() : overviewPromptSystem(mode, language),
    userInput: lines.join('\n'),
  };
}

export interface ParsedItemOverviewPrompt {
  prompt: string;
  negativePrompt: string;
}

/** 解析 AI 输出：围栏剥离 → <ITEM_OVERVIEW_JSON> 区块 → 括号平衡兜底 → 校验。失败抛错。 */
export function parseItemOverviewPromptOutput(raw: string): ParsedItemOverviewPrompt {
  const text = String(raw || '').replace(/```[a-zA-Z]*\n?/g, '').trim();
  const tagged = text.match(/<ITEM_OVERVIEW_JSON>([\s\S]*?)<\/ITEM_OVERVIEW_JSON>/);
  let candidate = tagged ? tagged[1].trim() : '';
  if (!candidate) {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) candidate = text.slice(first, last + 1);
  }
  if (!candidate) throw new Error('AI 未返回物品总览提示词（缺少 ITEM_OVERVIEW_JSON 区块）');
  let parsed: any;
  try {
    parsed = JSON.parse(candidate);
  } catch (_e) {
    throw new Error('物品总览提示词 JSON 解析失败');
  }
  const prompt = typeof parsed?.prompt === 'string' ? parsed.prompt.trim() : '';
  if (!prompt) throw new Error('物品总览提示词为空');
  const negativePrompt = typeof parsed?.negative_prompt === 'string' ? parsed.negative_prompt.trim() : '';
  return { prompt, negativePrompt };
}
