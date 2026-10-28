// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 07 待修：同上（四元环中的 map-scene-prompts → portrait-prompts：只为借 assembleFinalPrompt）
import { assembleFinalPrompt } from './portrait-prompts';
import { parseAiJsonObject } from './ai-parse';
import type { NaturalPromptLanguage, PortraitComposeMode, PortraitImageGen } from './portrait-config';
import { resolvePromptPresetSlice } from './image-generation-config';

export interface MapScenePromptInput {
  nodeId: string;
  canonicalPath: string;
  locationLabel: string;
  sourceMapHash: string;
  summary?: string;
  items?: string[];
  directions?: string;
  mapFeatures?: string[];
  extraPrompt?: string;
}

export interface MapScenePromptRequest {
  system: string;
  userInput: string;
}

export interface ParsedMapScenePrompt {
  prompt: string;
  negativePrompt: string;
  shotPlan?: MapSceneShotPlan;
}

export interface MapSceneShotPlan {
  sceneKind: string;
  camera: string;
  primaryAnchor: string;
  foreground: string[];
  midground: string[];
  background: string[];
  lightingAtmosphere: string;
  discardedFacts: string[];
}

export interface MapSceneImageConfig {
  provider: PortraitImageGen;
  width?: number;
  height?: number;
  imagePromptApiPresetId?: string;
}

export interface PreparedMapSceneImagePrompt extends ParsedMapScenePrompt {
  promptText: string;
  width: number;
  height: number;
}

/** 硬性无人物负面词：生活痕迹可以存在，但画面中不能出现人物或人物替代物。 */
export const MAP_SCENE_NO_HUMAN_NEGATIVE = [
  'people', 'person', 'human', 'man', 'woman', 'girl', 'boy', 'child', 'character', 'crowd',
  'pedestrian', 'traveler', 'soldier', 'face', 'head', 'hands', 'feet', 'body parts',
  'human silhouette', 'human shadow', 'humanoid', 'mannequin', 'doll', 'statue', 'portrait',
  'bust', 'living creature', 'animal', 'pet', 'text', 'logo', 'watermark', 'caption',
].join(', ');

/** 场景图必须是单一可见平面，避免模型退回 SVG/平面地图或把全局资料拼贴在一张图里。 */
export const MAP_SCENE_NO_MAP_COMPOSITION_NEGATIVE = [
  'floor plan', 'blueprint', 'isometric map', "bird's-eye map", 'aerial map',
  'infographic', 'collage', 'split screen', 'multiple rooms', 'cross section',
  '360 panorama', 'fisheye', 'map legend', 'UI screenshot',
].join(', ');

const MAP_SCENE_EMPTY_ENVIRONMENT_APPENDIX = [
  'empty environment',
  'architecture and objects only',
  'no visible people',
  'no human or humanoid figures',
  'no character silhouettes',
  'life traces may be present as abandoned belongings, tools, food, footprints or signs of recent use',
].join(', ');

function cleanText(value: unknown, maxLength = 20_000): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, maxLength);
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => cleanText(item, 2_000)).filter(Boolean).slice(0, 100);
}

function jsonSection(label: string, value: unknown): string {
  return `${label}\n${JSON.stringify(value, null, 2)}`;
}

/** 地图场景任务提示词（内置默认；编辑器展示与注入点同源）。mode/language 决定输出形态说明。 */
export function mapSceneSystemPrompt(mode: PortraitComposeMode, language: NaturalPromptLanguage): string {
  const outputMode = mode === 'natural' ? 'natural' : 'tags';
  const outputInstruction = outputMode === 'natural'
    ? language === 'zh'
      ? '“prompt” 必须为纯自然语言：一段简洁的中文环境描述，不是标签列表。'
      : 'The "prompt" value must be natural-language-only: one concise English environmental description, not a tag list.'
    : 'The "prompt" value must be tag-only: concise English comma-separated image tags, not prose sentences.';
  // 自然语言中文模式：prompt 用中文描述；negative_prompt 恒为英文逗号分隔标签（各模型负面词通用英文）
  const promptLanguageLine = outputMode === 'natural' && language === 'zh'
    ? 'prompt 使用中文、简洁而具体，优先描述地点主锚点、镜头、前中后景、材质、光线和空间关系；negative_prompt 使用英文逗号分隔。'
    : 'prompt 使用英文、简洁而具体，优先描述地点主锚点、镜头、前中后景、材质、光线和空间关系；negative_prompt 使用英文逗号分隔。';
  return `你是场景概念设计与生图提示词工程师。请根据地点、地图结构、物品和方位，先选择一个最有代表性的单一可见镜头，再输出一段用于场景生图的提示词。

输出必须是严格 JSON，不能有 Markdown、解释或额外字段：
{"shot_plan":{"scene_kind":"...","camera":"...","primary_anchor":"...","foreground":["..."],"midground":["..."],"background":["..."],"lighting_atmosphere":"...","discarded_facts":["..."]},"prompt":"...","negative_prompt":"..."}

场景图规则：
- 先在内部完成取景：场景图只表现一个单一镜头（one camera）、一个画幅和一个可见平面；不要试图覆盖完整地图、360 度空间或所有房间/出口。primary_anchor 只能有一个，foreground 最多一个，midground 最多两个，background 最多一个。无法与当前视线同时成立的资料写入 discarded_facts，不得进入 prompt。
- 优先选择最能让人认出该地点的视觉记忆点。室内优先入口/角落的斜向眼平镜头和一条纵深轴线；路径优先沿路的消失点；地标优先外观建立镜头。方向关系只用于判断什么在视野里，不能机械平铺为 north/east/west 的画面坐标。
- 禁止鸟瞰、平面地图、等距地图、蓝图、楼层平面、多房间剖面、拼贴、分屏、鱼眼或 360° 全景；不要输出 SVG、UI 截图或地图图例。
- 画面主体是空的环境、建筑、道路、房间和物品，追求真实、立体、有空间纵深的电影感现场；不要输出 SVG、平面地图、等距地图、蓝图或 UI 截图。
- 强制不出现 people、person、human、man、woman、girl、boy、child、character、crowd、pedestrian、traveler、soldier、face、head、hands、feet、body parts、human silhouette、human shadow、humanoid、mannequin、doll、statue、portrait、animal 或 pet。
- 生活痕迹允许存在，例如用过的餐具、散落工具、脚印、余温、未整理的床铺、门锁和痕迹，但这些痕迹不能变成人物、人体部位、人物剪影或动物。
- 必须把地点特征、地图中明确物品、方向关系和空间层次转化为当前镜头真正可见的建筑与物件；禁止凭空添加人物作为叙事捷径。
- ${promptLanguageLine}${outputInstruction}
- 如果输入里出现人物信息，只能把它转译为无人环境留下的物证，不得在 prompt 中保留人物主体词。

请记住：生活痕迹不等于人物。场景必须像刚有人使用过，但此刻明确无人。`;
}

export function buildMapScenePromptRequest(
  input: MapScenePromptInput,
  mode: PortraitComposeMode = 'tags',
  language: NaturalPromptLanguage = 'en',
  /** 自定义任务提示词（「生图 AI 请求提示词」板块 image:mapScene:system）；空串用内置。 */
  systemOverride?: string,
): MapScenePromptRequest {
  const builtinSystem = mapSceneSystemPrompt(mode, language);
  const system = systemOverride && systemOverride.trim() ? systemOverride.trim() : builtinSystem;
  const outputMode = mode === 'natural' ? 'natural' : 'tags';
  const payload = {
    location: cleanText(input.locationLabel || input.canonicalPath, 500),
    canonical_path: cleanText(input.canonicalPath, 2_000),
    environment_summary: cleanText(input.summary),
    visible_objects: cleanList(input.items),
    directional_relationships: cleanText(input.directions, 4_000),
    map_features: cleanList(input.mapFeatures),
    extra_scene_direction: cleanText(input.extraPrompt, 4_000),
    output_mode: outputMode,
  };
  const userInput = [
    jsonSection('SCENE INPUT', payload),
    'Generate one empty, cinematic, spatially coherent environment prompt from this input.',
  ].join('\n\n');
  return { system, userInput };
}

function extractJsonObject(value: string): Record<string, unknown> | null {
  // 共享解析管线（ai-parse）：平衡片段提取（末尾优先）+ 引号/尾逗号/截断修复链。
  return parseAiJsonObject(value).value;
}

function parseShotPlanList(value: unknown): string[] | null {
  if (typeof value === 'string') value = [value];
  if (!Array.isArray(value)) return null;
  const list = value.map(item => cleanText(item, 1_000));
  return list.every(Boolean) ? list : null;
}

function parseMapSceneShotPlan(value: unknown): MapSceneShotPlan | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const sceneKind = cleanText(input.scene_kind, 1_000);
  const camera = cleanText(input.camera, 1_000);
  const primaryAnchor = cleanText(input.primary_anchor, 1_000);
  const lightingAtmosphere = cleanText(input.lighting_atmosphere, 1_000);
  const foreground = parseShotPlanList(input.foreground);
  const midground = parseShotPlanList(input.midground);
  const background = parseShotPlanList(input.background);
  const discardedFacts = parseShotPlanList(input.discarded_facts ?? []);
  if (!sceneKind || !camera || !primaryAnchor || !lightingAtmosphere
    || !foreground || !midground || !background || !discardedFacts) return null;
  return {
    sceneKind,
    camera,
    primaryAnchor,
    foreground,
    midground,
    background,
    lightingAtmosphere,
    discardedFacts,
  };
}

export function parseMapScenePromptResult(result: string): ParsedMapScenePrompt | null {
  const value = extractJsonObject(String(result || ''));
  if (!value) return null;
  const prompt = cleanText(value.prompt, 20_000);
  const negativePrompt = cleanText(value.negative_prompt ?? value.negativePrompt, 20_000);
  if (!prompt) return null;
  const hasShotPlan = Object.prototype.hasOwnProperty.call(value, 'shot_plan');
  const shotPlan = hasShotPlan ? parseMapSceneShotPlan(value.shot_plan) : undefined;
  return shotPlan ? { prompt, negativePrompt, shotPlan } : { prompt, negativePrompt };
}

function providerConfig(config: MapSceneImageConfig | PortraitImageGen): {
  provider: PortraitImageGen;
  width: number;
  height: number;
} {
  const resolved = config as MapSceneImageConfig;
  const provider = (resolved.provider || config) as PortraitImageGen;
  const subConfig = provider.apiFormat === 'openai'
    ? provider.openai
    : provider.apiFormat === 'comfyui'
      ? provider.comfyui
      : provider.novelai;
  const width = typeof resolved.width === 'number' && resolved.width > 0
    ? Math.floor(resolved.width)
    : Math.floor(Number((subConfig as any).width) || 1216);
  const height = typeof resolved.height === 'number' && resolved.height > 0
    ? Math.floor(resolved.height)
    : Math.floor(Number((subConfig as any).height) || 832);
  return { provider, width, height };
}

export function prepareMapSceneImagePrompt(
  parsed: ParsedMapScenePrompt,
  config: MapSceneImageConfig | PortraitImageGen,
): PreparedMapSceneImagePrompt {
  const resolved = providerConfig(config);
  const mode = resolved.provider.promptComposeMode as PortraitComposeMode;
  // 前后缀/负面走统一切片出口（含智慧姬抑制）；任务专属负面（无人物/防平面地图）与 AI 返回负面始终保留
  const slice = resolvePromptPresetSlice(resolved.provider);
  const promptText = assembleFinalPrompt(
    slice.prefix,
    `${parsed.prompt}, ${MAP_SCENE_EMPTY_ENVIRONMENT_APPENDIX}`,
    slice.suffix,
    mode,
  );
  return {
    ...parsed,
    promptText,
    negativePrompt: [
      slice.negative,
      parsed.negativePrompt,
      MAP_SCENE_NO_HUMAN_NEGATIVE,
      MAP_SCENE_NO_MAP_COMPOSITION_NEGATIVE,
    ]
      .filter(value => value && value.trim()).join(', '),
    width: resolved.width,
    height: resolved.height,
  };
}
