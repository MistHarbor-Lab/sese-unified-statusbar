import { getCellByHeader } from './data-manager';
import { readCharAgeText } from './birthday';
import { getTodayDateKey } from './calendar-core';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 07 待修：同上（四元环中的 portrait-prompts → map-system：只为借 getCleanChatHistory，应下沉成独立模块）
import { getCleanChatHistory } from './map-system';
import { stripWithContextConfig } from './context-strip';
import type { NaturalPromptLanguage, PortraitComposeMode } from './portrait-config';
import type { PortraitClothingOverride } from './wardrobe-prompts';
import { PORTRAIT_PRESET_TAGS, buildPortraitSystemPromptNatural, buildPortraitSystemPromptTags } from './portrait-prompt-text';

// 纯函数层（system prompt 模板 / JSON 解析 / 标签拍平 / 前后缀拼装）已拆至 portrait-prompt-text.ts，
// 这里整体转发导出，既有引用方（portrait-system / wardrobe / item-overview / map-scene / 测试）无需改动。
export * from './portrait-prompt-text';

// —— 立绘生成主题（写死 6 套，不持久化；与构图正交）——
export type PortraitTheme = 'default' | 'cinematic' | 'allure' | 'nsfw' | 'emotion' | 'fashion';

export const PORTRAIT_THEME_OPTIONS: ReadonlyArray<{ id: PortraitTheme; label: string }> = [
  { id: 'default',   label: '立绘' },
  { id: 'cinematic', label: '精彩瞬间捕捉' },
  { id: 'allure',    label: '角色最强魅力' },
  { id: 'nsfw',      label: 'NSFW情节展示' },
  { id: 'emotion',   label: '情绪特写强化' },
  { id: 'fashion',   label: '服装与细节展示' },
];

// —— 各主题的 System Prompt 增补段（拼接到主 System Prompt 之后；default 为空保持原行为）——
export const PORTRAIT_THEME_PROMPTS: Record<PortraitTheme, string> = {
  default: '',
  cinematic: `【主题：精彩瞬间捕捉】
优先从【最近剧情上下文】中识别最具视觉张力、最适合静态画面表现的单一瞬间，并将其定格为立绘。
围绕所选瞬间统一构建人物动作、姿态、表情、视线、环境、光影与镜头语言，避免拼接多个不同时间点的内容。
composition 可按实际场景补充 cinematic, dramatic angle, dynamic pose, depth of field 等标签，但不得为了戏剧效果添加上下文中不存在的事件。
background 应与所选瞬间发生的地点和氛围一致。
若上下文没有明确的高张力瞬间，则回退为基于剧情现场的自然立绘，不强行制造高潮。`,
  allure: `【主题：角色魅力】
在角色 DNA 一致性前提下，按以下优先级强化魅力元素：
1. 神态：{{alluring gaze}}, {{smirk}}, half-closed eyes, parted lips, blush
2. 姿态：contrapposto, hand on hip, arm raised, looking back, over shoulder
3. 服饰贴合：skin tight, clothing cutout, side-tie, navel, collarbone, bare shoulders
4. 光影氛围：soft lighting, rim light, back lighting, bokeh, cinematic lighting
5. 构图张力：rule of thirds, dutch angle, low angle（仰拍显腿长）
禁止添加 nsfw/性器官标签，除非剧情明确触发（遵循原 NSFW 处理逻辑）。
background 优先选择氛围场景：bedroom, sunset, moonlight, neon lights, golden hour。`,
  nsfw: `【主题：NSFW情节展示】
本主题明确允许并强化 NSFW 内容输出，仅用于剧情明确涉及亲密/裸露情境时：
1. 优先从【最近剧情上下文】与已提供的【当前状态】判断 NSFW 程度（暗示 / 半裸 / 全裸 / 性行为）。
2. 按顺序拆解并构建：总体姿势和身体朝向；四肢位置、躯干弯曲和重心；人物之间的接触部位与前后位置；与剧情一致的标准姿势或体位标签。
3. action 与 interaction 字段必须优先使用标准 danbooru 姿势、体位、身体朝向和接触关系标签，避免只输出笼统的 sex。
4. body_parts_visible 字段只补充当前构图中实际可见的躯体部位。
5. outfit 字段描述与姿势相符的衣物脱落、掀起或裸露状态；若完全裸露则留空或仅保留画面实际可见的散落衣物。
6. background 优先选择与剧情一致的私密场景。
7. 姿势、体位、人物朝向和镜头方向必须互相兼容，不得同时输出互斥姿势；单人画面不得生成需要第二人的交互或体位。
8. 不输出构图范围之外不可见的身体细节。
仍遵循角色 DNA 一致性（发型/发色/瞳色/身材/肤色不因 NSFW 而改变）。
若剧情未涉及 NSFW，仍输出标准立绘，不要强行添加 NSFW 标签。`,
  emotion: `【主题：情绪特写强化】
以角色【情绪】字段与上下文推断的核心情绪为中心，放大面部与微表情表现：
- 喜悦：{{smile}}, {{happy}}, eyes closed, open mouth, raised eyebrows
- 害羞：{{blush}}, looking away, downcast eyes, biting lip, hands covering face
- 愤怒：{{angry}}, furrowed eyebrows, clenched teeth, serious, glaring
- 哀伤：{{tears}}, crying, sad, downcast eyes, wet eyes
- 诱惑：{{half-closed eyes}}, smirk, tongue out, seductive smile, parted lips
- 冷漠：expressionless, deadpan, cold gaze, closed mouth
所有情绪 tag 须 {{}} 双层加权。
composition 视情绪补 mood lighting, color wash（暖色喜 / 冷色哀 / 红色怒）。
action 字段优先输出与情绪匹配的微动作（如 fist clenched / hand on chest / wiping tears）。`,
  fashion: `【主题：服装与细节展示】
outfit 字段优先级提升至最高，按以下规则强化穿搭细节：
1. 每件衣物标签前加 {{}}：{{black pleated skirt}}, {{white thighhighs}}
2. 补充材质/剪裁 tag：silk, lace, denim, leather, pleated, frilled
3. 补充穿着状态 tag：loose, tight, slightly lifted, unbuttoned, asymmetric
4. composition 补 fashion pose, detailed clothing
5. background 优先用 fashion studio, white background, runway 强化展示感
6. action 字段优先输出展示性姿态（hands on hips, one leg forward, turning around）
traits 字段保持角色 DNA，不因服装展示而改变外貌。`,
};

// —— 同人生成附加选项（可与任意主题叠加）——
// 身份 tag 已固化在立绘索引（fanTags，见 portrait-system），不再由 AI 识别输出；本段只保留"禁外貌"指令，
// 注入顺序仍在 theme 之后，权威覆盖主题里"保持外貌/角色 DNA"的措辞（同人角色外貌由原作角色标签自带）。
export function buildFanworkPrompt(mode: 'tags' | 'natural', language: NaturalPromptLanguage = 'en'): string {
  if (mode === 'natural') {
    if (language === 'zh') {
      return `【附加选项：同人生成】
【人物外貌由角色身份识别，不要描述外貌】人物外貌、身材、面部、发型、瞳色等固有外观完全交由系统注入的角色标签让模型自带；traits 只描述视线与神态，不要描述外貌/身材。服装仍按【当前穿搭】输出。`;
    }
    return `【Additional option: fanwork generation】
【Appearance is identified by character identity, do not describe appearance】The character's inherent appearance (face, body, hair, eye color, etc.) is fully handled by the system-injected character tag and provided by the model itself; traits only describes gaze and expression, not appearance or body. Clothing is still output per the current outfit.`;
  }
  return `【附加选项：同人生成】
【人物外貌由角色标签识别，不要输出外貌标签】人物外貌、身材、面部、发型、瞳色等固有外观完全交由系统注入的角色标签让模型自带；traits 只写视线与神态，不要写外貌/身材标签。服装仍按【当前穿搭】输出。`;
}

// —— "包含主角"选项：画面额外出现主角作为第二人，最少出镜/不露脸，用于互动/NSFW 场景 ——
// 实现为"变量分支"：var=1 时先就地改写 base/theme 中写死 solo/单人的矛盾句，再追加这段不含 solo 的短增补；
// var=0 时 buildPortraitPrompt 既不调用 applyProtagonistRewrites 也不追加本段，输出与现状逐字相同。
export const PORTRAIT_PROTAGONIST_ADDENDUM = `【附加选项：包含主角（第二人）】
1. 焦点：当前角色仍是画面绝对主体与视觉焦点；主角始终作为次要/陪衬角色，不得喧宾夺主。
2. 最少出镜：主角以最少方式出现，优先级「仅部分肢体（手/臂/躯干/腿）＞ 半身 ＞ 全身」——能只露手就不露半身，能半身就不全身，以增强代入感。
3. 不露脸：主角头部尽量不出现在画面内（head out of frame / 画面裁切到肩部以下 / 仅肢体入画）。若剧情确实需要主角头部出现，必须以背影（from behind）、无脸（faceless / anonymous / headless）等方式呈现，且【绝不刻画主角的眼睛与五官】。
4. 外观一致：主角露出的肢体（肤色、体型、毛发等）必须与下方【主角信息】一致，不得添加【主角信息】中没有的显著特征。`;

// 改写表：(原句唯一锚点, 替换句)。split().join() 字面替换，规避 （）"" 等字符的 regex 转义问题。
// R1/R2 锚点仅存在于 TAGS base；R3 锚点仅存在于 nsfw 主题。对 natural base、非 nsfw 主题调用为安全 no-op。
const PROTAGONIST_SYSTEM_REWRITES: Array<[string, string]> = [
  [
    '与【性别】一致的单人数量标签 + solo + 构图视角（严格遵循【构图要求】）',
    '与【性别】一致的当前角色数量标签 + 按【主角性别】补充的主角数量标签（两人构图，不得使用 solo）+ 构图视角（严格遵循【构图要求】）',
  ],
  [
    '"composition":"solo, upper body, looking away"',
    '"composition":"1girl, 1boy, upper body, looking away"',
  ],
  [
    '单人画面不得生成需要第二人的交互或体位',
    '画面含主角作为第二人时，允许生成当前角色与主角之间的互动/体位标签（如拥抱、牵手、sex 及具体体位），由 interaction/action 字段承载，且须与姿势、朝向、接触关系相互兼容',
  ],
];

function applyProtagonistRewrites(s: string): string {
  let out = s;
  for (const [from, to] of PROTAGONIST_SYSTEM_REWRITES) out = out.split(from).join(to);
  return out;
}

// —— 组装 generateRaw 的 user_input ——
export interface BuildPortraitPromptArgs {
  npc: string;
  loverRow: number;       // findRowByColumn('恋爱对象表','姓名',npc)
  presenceRow: number;    // findRowByColumn('在场角色表','姓名',npc)
  importantRow: number;   // findRowByColumn('重要角色表','姓名',npc) —— 非恋爱对象时回退读取
  nsfwRow: number;        // findRowByColumn('NSFW信息表','姓名',npc) —— 身高/体重、三围/罩杯；-1 则跳过
  contextCount: number;
  composeMode: PortraitComposeMode;
  naturalLanguage?: NaturalPromptLanguage; // 自然语言模式输出语言（默认 en；tags 模式忽略）
  preset: 'avatar' | 'halfbody' | 'fullbody' | 'default';
  theme: PortraitTheme;   // 主题（仅影响 system prompt，不注入 user_input）
  extraPrompt: string;    // 用户一次性额外词
  includeStatus: boolean;
  includeEmotion: boolean;
  includeFanwork: boolean;
  includeProtagonist: boolean;   // "包含主角"：主角作为第二人最少出镜/不露脸（var=0 时完全不影响提示词）
  clothingOverride?: PortraitClothingOverride;
  /** 人物固定特征 tag（外貌/身材一致性锚点）。非空时替代数据库外貌/身材注入这两段。 */
  charTags?: { appearance: string; body: string } | null;
  /** 生图对象：npc（默认，走恋爱/在场/重要三表）或 protagonist（走主角信息表+近况+衣柜穿搭基线）。 */
  subject?: 'npc' | 'protagonist';
  /** 主角穿搭基线（resolveProtagonistOutfitBaseline 产出；空=衣柜未设置，省略穿搭块）。 */
  protagonistOutfitBaseline?: string;
  /** 自定义立绘格式规范（标签模式，来自「生图 AI 请求提示词」板块 image:portrait:tags）。
   *  非空时整体替换 tags 模式内置 system prompt 的 base 段，主题/同人禁外貌/主角/服装替换/固定标签各段仍照常追加；
   *  natural 模式不受影响。空=用内置默认。 */
  formatPromptOverride?: string;
  /** 自定义立绘格式规范（自然语言模式，来自 image:portrait:natural）：非空时替换 natural 内置 base 段
   *  （不再按同人开关/输出语言自动分支）；同人禁外貌仍由追加段兜底。空=用内置默认。 */
  naturalFormatPromptOverride?: string;
}

function formatClothingOverride(override: PortraitClothingOverride): string {
  return override.items.map(item => {
    const tags = (item.tags || '').trim();
    return tags
      ? `- ${item.category}：${item.name}——${item.description}｜标签：${tags}`
      : `- ${item.category}：${item.name}——${item.description}`;
  }).join('\n');
}

function clothingOverrideAddendum(override: PortraitClothingOverride): string {
  const modeRule = override.mode === 'full'
    ? '全部替换：忽略所有旧穿着；未指定槽位保持未着装或不可见，不得恢复旧衣或擅自补齐。'
    : '部分替换：只覆盖明确选择的槽位，其余槽位继续使用当前穿着。选择配饰时替换原饰品槽；未选择配饰时保留原饰品。';
  // natural 与 tags 现在共用英文键 outfit，字段子句不再按模式分支
  const fieldClause = '须在 outfit 字段中原样复用这些标签';
  return `【最高优先级：本次替换服装】
本块高于角色DNA中的默认服装、同人原作服装、服装主题和剧情上下文中的旧穿着。
人物的脸、发型、发色、瞳色、体型与身份保持不变，只改变服装。
严格使用下方选择的物件名称与描述，不自行改款；若物件附带“标签”，${fieldClause}，以保证衣物与衣柜单品展示图一致。
${modeRule}
文胸/内裤或头饰只替换其中一项时，从原组合字段中保留未替换部分，禁止重复。`;
}

const CHAR_TAGS_RULE = `\n【最高优先级：人物固定一致性标签】\n输入中【外貌特征】与【身体数据】为该人物的固定一致性标签，是此人外貌与身材的唯一事实源。根据本次构图需要从中选用相关标签（如半身像无需腿部标签）；未被涉及的部位不得自行发明描述，不得改写、增删或翻译这些标签。`;

export function buildPortraitPrompt(args: BuildPortraitPromptArgs): { system: string; userInput: string } {
  const {
    npc, loverRow, presenceRow, importantRow, nsfwRow, contextCount,
    composeMode, naturalLanguage, preset, theme, extraPrompt, includeStatus, includeEmotion, includeFanwork, includeProtagonist,
    clothingOverride, charTags, subject, protagonistOutfitBaseline, formatPromptOverride, naturalFormatPromptOverride,
  } = args;
  // 主角信息（"包含主角"选项）。主角姓名缺失、或生图对象即主角本人时不触发，避免注入无名主角 / 自指第二人。
  const pName = getCellByHeader('主角信息表', 1, '姓名') || '';
  const pGender = getCellByHeader('主角信息表', 1, '性别') || '';
  const pAge = readCharAgeText('主角信息表', 1, getTodayDateKey());
  const pAppearance = getCellByHeader('主角信息表', 1, '外貌特征') || '';
  const pIdentity = getCellByHeader('主角信息表', 1, '身份背景') || '';
  const pCondition = getCellByHeader('主角信息表', 1, '近况') || '';
  // 主角生图对象（哨兵 key 经 portrait-system 转为 subject 分支）：素材走主角信息表，不走三表
  const isProtagonist = subject === 'protagonist';
  const protagonistOn = !isProtagonist && includeProtagonist && !!pName && npc !== pName;
  // 基础 system prompt：按 composeMode 选 tags/natural，再按 includeFanwork 决定是否禁外观（同人 base 不含外貌生成指令、画师名行已分支）。
  // tags 模式下预设带自定义格式规范时整体替换 base 段（同人/非同人同用一份覆盖文本，同人禁外貌铁律由追加的 fanwork 段兜底）。
  const promptMode: 'tags' | 'natural' = composeMode === 'natural' ? 'natural' : 'tags';
  const promptLanguage = naturalLanguage ?? 'en';
  const formatOverride = typeof formatPromptOverride === 'string' ? formatPromptOverride.trim() : '';
  const naturalOverride = typeof naturalFormatPromptOverride === 'string' ? naturalFormatPromptOverride.trim() : '';
  const baseSystemRaw = composeMode === 'natural'
    ? (naturalOverride || buildPortraitSystemPromptNatural(includeFanwork, promptLanguage))
    : (formatOverride || buildPortraitSystemPromptTags(includeFanwork));
  // protagonistOn 时就地改写 base/theme 中写死 solo/单人的矛盾句（R1/R2/R3），再追加主角增补段；否则原样不变。
  const baseSystem = protagonistOn ? applyProtagonistRewrites(baseSystemRaw) : baseSystemRaw;
  const themeSeg = protagonistOn ? applyProtagonistRewrites(PORTRAIT_THEME_PROMPTS[theme]) : PORTRAIT_THEME_PROMPTS[theme];
  const system = baseSystem + themeSeg
    + (includeFanwork ? buildFanworkPrompt(promptMode, promptLanguage) : '')
    + (protagonistOn ? PORTRAIT_PROTAGONIST_ADDENDUM : '')
    + (clothingOverride ? clothingOverrideAddendum(clothingOverride) : '')
    + (charTags ? CHAR_TAGS_RULE : '');
  const effectiveIncludeStatus = theme === 'cinematic' ? false : includeStatus;
  const effectiveIncludeEmotion = theme === 'emotion' ? true : includeEmotion;

  // 读恋爱对象表（静态资料）；若不在恋爱对象表而在重要角色表，则回退读取后者对应列
  const isLover = loverRow !== -1;
  const isImportant = !isLover && importantRow !== -1;
  const srcTable = isLover ? '恋爱对象表' : (isImportant ? '重要角色表' : '');
  const srcRow = isLover ? loverRow : (isImportant ? importantRow : -1);
  const gender = srcRow !== -1 ? (getCellByHeader(srcTable, srcRow, '性别') || '') : '';
  // 年龄：生日列按当前游戏日期推算；旧库年龄列兼容透传
  const age = srcRow !== -1 ? readCharAgeText(srcTable, srcRow, getTodayDateKey()) : '';
  const appearance = srcRow !== -1 ? (getCellByHeader(srcTable, srcRow, '外貌特征') || '') : '';
  const intro = srcRow !== -1 ? (getCellByHeader(srcTable, srcRow, '一句话介绍') || '') : '';

  // 读 NSFW信息表（身高/体重、三围/罩杯）—— 体型静态资料，仅当行存在且有值时注入
  const nsfwHeightWeight = nsfwRow !== -1 ? (getCellByHeader('NSFW信息表', nsfwRow, '身高/体重') || '') : '';
  const nsfwMeasure = nsfwRow !== -1 ? (getCellByHeader('NSFW信息表', nsfwRow, '三围/罩杯') || '') : '';

  // 读在场角色表（动态状态+衣着）
  const status = presenceRow !== -1 ? (getCellByHeader('在场角色表', presenceRow, '当前状态') || '') : '';
  const emotion = presenceRow !== -1 ? (getCellByHeader('在场角色表', presenceRow, '情绪') || '') : '';
  const outfit = presenceRow !== -1 ? (getCellByHeader('在场角色表', presenceRow, '当前穿搭') || '') : '';
  const top = presenceRow !== -1 ? (getCellByHeader('在场角色表', presenceRow, '上装') || '') : '';
  const bottom = presenceRow !== -1 ? (getCellByHeader('在场角色表', presenceRow, '下装') || '') : '';
  const inner = presenceRow !== -1 ? (getCellByHeader('在场角色表', presenceRow, '内衣/内裤') || '') : '';
  const socks = presenceRow !== -1 ? (getCellByHeader('在场角色表', presenceRow, '袜子') || '') : '';
  const shoes = presenceRow !== -1 ? (getCellByHeader('在场角色表', presenceRow, '鞋子') || '') : '';
  const acc = presenceRow !== -1 ? (getCellByHeader('在场角色表', presenceRow, '饰品') || '') : '';

  // MANUAL 模式专属：注入前剥离可配置的标签（默认 <image>...</image>），避免污染提示词。
  const context = stripWithContextConfig(getCleanChatHistory(contextCount));

  const parts: string[] = [];
  if (isProtagonist) {
    // —— 主角：素材全部来自主角信息表 + 近况 + 衣柜穿搭基线（spec §3）——
    parts.push(`【角色姓名】\n${pName || npc}`);
    parts.push(`【性别】\n${pGender || '未知'}`);
    parts.push(`【年龄】\n${pAge || '未知'}`);
    parts.push(charTags ? `【外貌特征】\n${charTags.appearance}` : `【外貌特征】\n${pAppearance || '未描述'}`);
    if (charTags) parts.push(`【身体数据】\n${charTags.body}`);
    parts.push(`【身份背景】\n${pIdentity || '无'}`);
    if (effectiveIncludeStatus) parts.push(`【当前状态】\n${pCondition || '未描述'}`);
    // 主角无情绪列：不注入【情绪】（弹窗已置灰）；「情绪特写」主题由 AI 从近况与上下文推断情绪基调
    if (clothingOverride?.mode !== 'full' && protagonistOutfitBaseline) {
      parts.push(`【当前穿搭（衣柜）】\n${protagonistOutfitBaseline}`);
    }
    if (clothingOverride) {
      parts.push(`【本次替换服装（${clothingOverride.mode === 'full' ? '全部替换' : '部分替换'}）】\n${formatClothingOverride(clothingOverride)}`);
    }
    if (context) parts.push(`【最近剧情上下文】\n${context}`);
    const ppCompReq = [PORTRAIT_PRESET_TAGS[preset], theme === 'default' ? 'portrait' : ''].filter(Boolean).join(', ');
    if (ppCompReq) parts.push(`【构图要求】\n${ppCompReq}`);
    if (extraPrompt) parts.push(`【用户额外要求】\n${extraPrompt}`);
    parts.push(`请根据以上信息生成立绘提示词。`);
    return { system, userInput: parts.join('\n\n') };
  }
  parts.push(`【角色姓名】\n${npc}`);
  parts.push(`【性别】\n${gender || '未知'}`);
  parts.push(`【年龄】\n${age || '未知'}`);
  if (!includeFanwork) parts.push(charTags ? `【外貌特征】\n${charTags.appearance}` : `【外貌特征】\n${appearance || '未描述'}`);
  // 身体数据（身高/体重、三围/罩杯，来自 NSFW信息表；仅当有值且非"无"时注入，AI 据此选择体型/罩杯标签）
  if (!includeFanwork) {
    if (charTags) {
      parts.push(`【身体数据】\n${charTags.body}`);
    } else {
      const bodyData: string[] = [];
      if (nsfwHeightWeight && nsfwHeightWeight !== '无') bodyData.push(`身高/体重：${nsfwHeightWeight}`);
      if (nsfwMeasure && nsfwMeasure !== '无') bodyData.push(`三围/罩杯：${nsfwMeasure}`);
      if (bodyData.length) parts.push(`【身体数据】\n${bodyData.join('　')}`);
    }
  }
  parts.push(`【一句话介绍】\n${intro || '无'}`);
  if (protagonistOn) {
    parts.push(`【主角信息（第二人，最少出镜/不露脸）】\n姓名：${pName}\n性别：${pGender || '未知'}\n年龄：${pAge || '未知'}\n外貌特征：${pAppearance || '未描述'}\n身份背景：${pIdentity || '无'}`);
  }
  if (effectiveIncludeStatus) parts.push(`【当前状态】\n${status || '未描述'}`);
  if (effectiveIncludeEmotion) parts.push(`【情绪】\n${emotion || '未描述'}`);
  if (clothingOverride?.mode !== 'full') {
    parts.push(`【当前穿搭】\n${outfit || '未描述'}`);
    parts.push(`【上装】${top || '无'}　【下装】${bottom || '无'}　【内衣】${inner || '无'}　【袜子】${socks || '无'}　【鞋子】${shoes || '无'}　【饰品】${acc || '无'}`);
  }
  if (clothingOverride) {
    parts.push(`【本次替换服装（${clothingOverride.mode === 'full' ? '全部替换' : '部分替换'}）】\n${formatClothingOverride(clothingOverride)}`);
  }
  if (context) parts.push(`【最近剧情上下文】\n${context}`);
  // 构图预设只负责人数与取景；portrait 由"立绘"(default)主题独占附加。
  // protagonistOn 时去掉开头 solo（双人数标签由 system prompt 负责）；若最终为空则省略整个构图要求块。
  const presetCompReq = protagonistOn
    ? PORTRAIT_PRESET_TAGS[preset].replace(/^solo,?\s*/, '')
    : PORTRAIT_PRESET_TAGS[preset];
  const themeCompTag = theme === 'default' ? 'portrait' : '';
  const compReq = [presetCompReq, themeCompTag].filter(Boolean).join(', ');
  if (compReq) parts.push(`【构图要求】\n${compReq}`);
  if (extraPrompt) parts.push(`【用户额外要求】\n${extraPrompt}`);
  parts.push(`请根据以上信息生成立绘提示词。`);

  return { system, userInput: parts.join('\n\n') };
}
