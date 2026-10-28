// ===== 物品总览图编排：仓库物品清单 → 文本AI提示词 → 生图 → 上传 → 全局记录 → 旧图回收 =====
import { getTavernHelper } from './env';
import { getCustomApiConfig, validateCustomApiConfig, withTextAiRetry, type TextAiContext } from './api-config';
import { getConfig } from './config-store';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import { generateImage } from './image-gen';
import { isChatu8Channel } from './chatu8-bridge';
import { isBaiBaiChannel } from './baibai-bridge';
import { resolveImagePromptTemplate } from './image-prompt-templates';
import { deleteStoredImage, isSafeStoredImagePath, uploadGeneratedImage, type DeleteStoredImageResult, type ImageStorageResult } from './image-storage';
import { resolveImageTaskConfig, resolvePromptPresetSlice, type ImageGenerationConfig } from './image-generation-config';
import { assembleFinalPrompt } from './portrait-prompts';
import {
  buildItemOverviewPromptRequest,
  parseItemOverviewPromptOutput,
  ITEM_OVERVIEW_EXTRA_NEGATIVE,
  type ItemOverviewPromptItem,
  type ItemOverviewPromptRequest,
} from './item-overview-prompts';
import {
  getWarehouseItems,
  persistWarehouseOverview,
  readWarehouseOverview,
  type WarehouseItem,
  type WarehouseOverviewRecord,
} from './warehouse';
import type { PortraitImageGen } from './portrait-config';

/** 双种子 FNV-1a → 16 位 hex；物品增删/改名/改数量/改描述任一变化都会改变指纹。 */
export function computeWarehouseFingerprint(items: readonly WarehouseItem[]): string {
  const text = items
    .map(it => `${it.uid}|${it.data.物品名称}|${it.data.数量}|${it.data.类型}|${it.data.描述}`)
    .join('\n');
  const hash = (seed: number): string => {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  return hash(0x811c9dc5) + hash(0x9747b28c);
}

export function warehouseItemsToPromptItems(items: readonly WarehouseItem[]): ItemOverviewPromptItem[] {
  return items.map(it => ({
    name: it.data.物品名称,
    type: it.data.类型,
    qty: it.data.数量,
    description: it.data.描述,
  }));
}

export function isWarehouseOverviewStale(
  record: WarehouseOverviewRecord | null,
  items: readonly WarehouseItem[],
): boolean {
  if (!record) return false;
  return record.fingerprint !== computeWarehouseFingerprint(items);
}

export interface PreparedItemOverviewGeneration {
  config: PortraitImageGen;
  promptText: string;
  negativePrompt: string;
}

/** 装配：主提示词 → 预设前后缀包裹（tags 模式走 st-chatu8 对齐连接）+ 三层负面合并。 */
export function prepareItemOverviewGeneration(
  imageGeneration: ImageGenerationConfig,
  mainPrompt: string,
  aiNegativePrompt?: string,
): PreparedItemOverviewGeneration {
  const resolved = resolveImageTaskConfig('itemOverview', imageGeneration);
  const config = resolved.provider;
  // 前后缀/负面走统一切片出口（含智慧姬抑制）；AI 返回负面与「防 UI 化」任务专属负面始终保留
  const slice = resolvePromptPresetSlice(config);
  const promptText = assembleFinalPrompt(
    slice.prefix,
    mainPrompt,
    slice.suffix,
    config.promptComposeMode,
  );
  // OpenAI 兼容走自然语言无负面通道（智慧姬/柏宝绘通道除外：支持负面词透传，按 NAI 同源合并）；NAI/ComfyUI 合并预设负面 + AI 负面 + 总览专属负面
  const negativePrompt = config.apiFormat === 'openai' && !isChatu8Channel(config) && !isBaiBaiChannel(config)
    ? ''
    : [slice.negative, aiNegativePrompt?.trim(), ITEM_OVERVIEW_EXTRA_NEGATIVE]
      .filter(value => value && value.trim())
      .join(', ');
  return { config, promptText, negativePrompt };
}

export type ItemOverviewGenerationResult =
  | { ok: true; record: WarehouseOverviewRecord; warning?: string }
  | { ok: false; error: string };

export interface ItemOverviewGenerationOptions {
  /** 目标仓库分组；缺省走第一个分组（旧调用兼容）。 */
  groupId?: number;
  /** 附加要求（仅本次，进文本 AI 输入）。 */
  extraPrompt?: string;
  /** 编辑框回填的主提示词：非空时跳过文本 AI 直接装配生图（重新生成路径）。 */
  editedPrompt?: string;
  signal?: AbortSignal;
}

export interface ItemOverviewDeps {
  getItems(groupId?: number): Promise<WarehouseItem[]>;
  getImageGeneration(): ImageGenerationConfig;
  generateText(request: ItemOverviewPromptRequest, signal?: AbortSignal): Promise<string>;
  generateImage(config: PortraitImageGen, promptText: string, negativePrompt: string, signal?: AbortSignal): Promise<string>;
  uploadGeneratedImage(dataUrl: string, namespace: string, filenameStem: string): Promise<ImageStorageResult>;
  readOverview(groupId?: number): WarehouseOverviewRecord | null;
  persistOverview(record: WarehouseOverviewRecord, groupId?: number): Promise<boolean>;
  deleteStoredImage(path: string): Promise<DeleteStoredImageResult>;
  now(): number;
}

export function createItemOverviewOrchestrator(deps: ItemOverviewDeps) {
  return {
    async generateOverview(options: ItemOverviewGenerationOptions = {}): Promise<ItemOverviewGenerationResult> {
      const signal = options.signal;
      if (signal?.aborted) return { ok: false, error: '生图任务已取消' };
      const groupId = options.groupId;
      const items = await deps.getItems(groupId);
      if (items.length === 0) return { ok: false, error: '仓库为空，没有可入图的物品' };

      const imageGeneration = deps.getImageGeneration();
      // 按任务解析取模式/语言（提示词模式为全局设置，经解析链取用）
      const resolvedProvider = resolveImageTaskConfig('itemOverview', imageGeneration).provider;

      let mainPrompt = options.editedPrompt?.trim() || '';
      let aiNegativePrompt = '';
      if (!mainPrompt) {
        const mode = resolvedProvider.promptComposeMode;
        const language = resolvedProvider.naturalPromptLanguage;
        const request = buildItemOverviewPromptRequest(
          warehouseItemsToPromptItems(items),
          mode === 'natural' ? 'natural' : 'tags',
          options.extraPrompt,
          language === 'zh' ? 'zh' : 'en',
          // 自定义任务提示词来自「生图 AI 请求提示词」板块（未设置 = 内置，逐字节不变）
          resolveImagePromptTemplate(imageGeneration.promptTemplates, 'itemOverview', 'system', ''),
        );
        let raw: string;
        try {
          raw = await deps.generateText(request, signal);
        } catch (error: any) {
          return { ok: false, error: `提示词生成失败：${error?.message || error}` };
        }
        if (signal?.aborted) return { ok: false, error: '生图任务已取消' };
        try {
          const parsed = parseItemOverviewPromptOutput(raw);
          mainPrompt = parsed.prompt;
          aiNegativePrompt = parsed.negativePrompt;
        } catch (error: any) {
          return { ok: false, error: error?.message || String(error) };
        }
      }

      const prepared = prepareItemOverviewGeneration(imageGeneration, mainPrompt, aiNegativePrompt);
      let dataUrl: string;
      try {
        dataUrl = await deps.generateImage(prepared.config, prepared.promptText, prepared.negativePrompt, signal);
      } catch (error: any) {
        return { ok: false, error: `生图失败：${error?.message || error}` };
      }
      if (signal?.aborted) return { ok: false, error: '生图任务已取消' };

      const uploaded = await deps.uploadGeneratedImage(
        dataUrl,
        'item-overview',
        groupId == null ? 'warehouse' : `warehouse-${groupId}`,
      );
      if (!uploaded.path) return { ok: false, error: `图片保存失败：${uploaded.error || '上传接口未返回路径'}` };

      // 旧记录须在覆盖前读取（persist 之后 readOverview 只会看到新记录）
      const previous = deps.readOverview(groupId);

      const record: WarehouseOverviewRecord = {
        version: 1,
        imagePath: uploaded.path,
        prompt: prepared.promptText,
        mainPrompt,
        negativePrompt: prepared.negativePrompt,
        fingerprint: computeWarehouseFingerprint(items),
        itemCount: items.length,
        provider: prepared.config.apiFormat,
        width: prepared.config.apiFormat === 'openai' ? 0 : prepared.config.novelai.width,
        height: prepared.config.apiFormat === 'openai' ? 0 : prepared.config.novelai.height,
        createdAt: deps.now(),
      };
      if (!await deps.persistOverview(record, groupId)) {
        await deps.deleteStoredImage(uploaded.path);
        return { ok: false, error: '总览图记录保存失败，新上传图片已清理' };
      }

      const previousRecord = previous;
      if (previousRecord?.imagePath && previousRecord.imagePath !== uploaded.path) {
        const removed = await deps.deleteStoredImage(previousRecord.imagePath);
        if (!removed.ok) {
          return { ok: true, record, warning: `新图已保存，但旧图删除失败：${removed.error}` };
        }
      }
      return { ok: true, record };
    },
  };
}

async function generateItemOverviewText(
  request: ItemOverviewPromptRequest,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) throw new Error('请求已取消');
  const apiError = validateCustomApiConfig('imageGeneration');
  if (apiError) throw new Error(apiError);
  const helper = getTavernHelper();
  if (!helper || typeof helper.generateRaw !== 'function') throw new Error('无法访问 generateRaw');
  // 网络级重试：按设置决定次数与通知（关闭时仅尝试一次）；配置/取消错误立即抛出。
  return withTextAiRetry('imageGeneration', async (ctx: TextAiContext) => {
    const result = await helper.generateRaw({
      should_silence: true,
      generation_id: ctx.generationId,
      user_input: request.userInput,
      ordered_prompts: [
        ...getJailbreakHeadPrompts(),
        { role: 'system', content: request.system },
        'user_input',
        ...getJailbreakTailPrompts(),
      ],
      custom_api: getCustomApiConfig('imageGeneration'),
    });
    if (signal?.aborted) throw new Error('请求已取消');
    if (typeof result !== 'string' || !result.trim()) throw new Error('AI 返回为空');
    return result;
  }, { signal, feature: 'itemOverview' });
}

const defaultOrchestrator = createItemOverviewOrchestrator({
  getItems: (groupId) => getWarehouseItems(groupId),
  getImageGeneration: () => getConfig().imageGeneration,
  generateText: generateItemOverviewText,
  generateImage: (config, promptText, negativePrompt, signal) => generateImage(config, promptText, negativePrompt, signal, true),
  uploadGeneratedImage,
  readOverview: (groupId) => readWarehouseOverview(groupId),
  persistOverview: (record, groupId) => persistWarehouseOverview(record, groupId),
  deleteStoredImage,
  now: () => Date.now(),
});

/** 删除某分组总览图对应的已上传图片（记录清理由调用方负责）。 */
export async function deleteWarehouseOverviewImage(
  record: WarehouseOverviewRecord | null,
): Promise<DeleteStoredImageResult> {
  if (!record?.imagePath) return { ok: true };
  if (!isSafeStoredImagePath(record.imagePath)) return { ok: false, error: '图片路径不安全' };
  return deleteStoredImage(record.imagePath);
}

/** 默认接线入口：仓库面板生成按钮直接调用。 */
export function generateWarehouseOverview(options: ItemOverviewGenerationOptions = {}): Promise<ItemOverviewGenerationResult> {
  return defaultOrchestrator.generateOverview(options);
}
