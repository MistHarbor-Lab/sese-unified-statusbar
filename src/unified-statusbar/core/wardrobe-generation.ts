// ===== 衣柜物品/套装单图生成与替换事务 =====
import { getConfig } from './config-store';
import { deleteStoredImage, uploadGeneratedImage, type DeleteStoredImageResult, type ImageStorageResult } from './image-storage';
import { generateImage } from './image-gen';
import { isChatu8Channel } from './chatu8-bridge';
import { isBaiBaiChannel } from './baibai-bridge';
import type { PortraitImageGen } from './portrait-config';
import { assembleFinalPrompt } from './portrait-prompts';
import type { PortraitComposeMode } from './portrait-config';
import { resolveImageTaskConfig, resolvePromptPresetSlice, type ImageGenerationConfig } from './image-generation-config';
import { getCurrentStoryChatKey } from './story-floor-store';
import { wardrobeStore, withWardrobeMutationLock } from './wardrobe-store';
import type { WardrobeCategory } from './wardrobe-types';

// 单品共用负面词仅限制场景与人体，不使用会与袜子/鞋靴“成双商品单位”冲突的 multiple items/pair/two；
// 末尾 toy 组防静物玩具化（NAI 对 plush/figurine 误渲染的高发倾向）。
export const WARDROBE_ITEM_EXTRA_NEGATIVE =
  'human, hands, feet, legs, arms, face, skin, person, mannequin, body, torso, head, partial body, worn, wearing, person wearing, clothes hanger, hanger, display stand, packaging, box, furniture, props, text, logo, watermark, multiple views, extra limbs, extra digit, toy, plush, figurine, doll';
// 套装：模特有身体，不屏蔽人体，只防重复衣物与坏解剖；cropped/cut off legs 补强全身取景（避免被上装细节拉成半身/裁腿）
export const WARDROBE_OUTFIT_EXTRA_NEGATIVE =
  'duplicate clothing, multiple items, extra limbs, extra digit, bad anatomy, cropped, cut off legs';

export function buildWardrobeItemExtraNegative(category?: WardrobeCategory): string {
  const quantityNegative = category === '袜类'
    ? 'single sock, 3 socks, 4 socks, mismatched socks, extra socks, additional product'
    : category === '鞋靴'
      ? 'single shoe, 3 shoes, 4 shoes, mismatched footwear, extra shoes, additional product'
      : 'duplicate product, second item, additional item, extra product, multiple products';
  return `${WARDROBE_ITEM_EXTRA_NEGATIVE}, ${quantityNegative}`;
}

export type WardrobeGenerationTargetKind = 'item' | 'outfit';

// tags 模式给"全身"取景词加权：套装构图词只是众多上装/脸发细节标签里的一个无权重标签，
// 易被高密度细节牵拉成半身取景。加权 1.2::full body:: 放大全身信号；缺失时兜底补上保证强制全身。
// 仅 NovelAI 支持 1.2::..:: 加权语法；ComfyUI/OpenAI 不加权也不兜底，避免工作流里混入字面量。
function enforceOutfitFullBodyWeight(prompt: string, mode: PortraitComposeMode, apiFormat: string): string {
  if (mode !== 'tags' || apiFormat !== 'novelai') return prompt;
  const withFullBody = prompt.includes('full body') ? prompt : `${prompt}, full body`;
  return `${withFullBody}, 1.2::full body::`;
}

export interface WardrobeGenerationTarget {
  kind: WardrobeGenerationTargetKind;
  id: string;
  name: string;
  category?: WardrobeCategory;
  imagePath?: string;
  chatKey?: string;
}

export interface WardrobeGeneratedPrompt {
  promptText: string;
  negativePrompt: string;
}

export interface PreparedWardrobeImageGeneration extends WardrobeGeneratedPrompt {
  config: PortraitImageGen;
}

export function prepareWardrobeImageGeneration(
  imageGeneration: ImageGenerationConfig,
  target: WardrobeGenerationTarget,
  mainPrompt: string,
): PreparedWardrobeImageGeneration {
  const task = target.kind === 'item' ? 'wardrobeItem' : 'wardrobeOutfit';
  const config = resolveImageTaskConfig(task, imageGeneration).provider;
  // 前后缀/负面走统一切片出口（含智慧姬抑制：直连时不拼前后缀、不发预设负面）
  const slice = resolvePromptPresetSlice(config);
  const promptText = target.kind === 'item'
    ? mainPrompt.trim()
    : enforceOutfitFullBodyWeight(
      assembleFinalPrompt(
        slice.prefix,
        mainPrompt,
        slice.suffix,
        config.promptComposeMode,
      ),
      config.promptComposeMode,
      config.apiFormat,
    );
  const extraNegative = target.kind === 'item'
    ? buildWardrobeItemExtraNegative(target.category)
    : WARDROBE_OUTFIT_EXTRA_NEGATIVE;
  // 任务专属负面词属于任务正确性，任何通道都发送；预设立负面由切片抑制（智慧姬/柏宝绘直连时为空）
  const negativePrompt = config.apiFormat === 'openai' && !isChatu8Channel(config) && !isBaiBaiChannel(config)
    ? ''
    : [slice.negative, extraNegative].filter(value => value?.trim()).join(', ');
  return { config, promptText, negativePrompt };
}

export type WardrobeGenerationResult =
  | { ok: true; path: string; warning?: string }
  | { ok: false; error: string };

export interface WardrobeGenerationDeps {
  generateImage(promptText: string, negativePrompt: string, signal?: AbortSignal): Promise<string>;
  uploadGeneratedImage(dataUrl: string, namespace: string, filenameStem: string): Promise<ImageStorageResult>;
  persistImagePath(target: WardrobeGenerationTarget, path: string): Promise<boolean>;
  deleteStoredImage(path: string): Promise<DeleteStoredImageResult>;
}

export interface WardrobeLocalImageImportDeps {
  readFileAsDataUrl(file: File): Promise<string>;
  uploadGeneratedImage(dataUrl: string, namespace: string, filenameStem: string): Promise<ImageStorageResult>;
  persistImagePath(target: WardrobeGenerationTarget, path: string): Promise<boolean>;
  deleteStoredImage(path: string): Promise<DeleteStoredImageResult>;
}

export function canPersistWardrobeGenerationTarget(
  target: Pick<WardrobeGenerationTarget, 'chatKey'>,
  currentChatKey: string,
): boolean {
  return !target.chatKey || target.chatKey === currentChatKey;
}

export function createWardrobeGenerationOrchestrator(deps: WardrobeGenerationDeps) {
  return {
    async generateWardrobeTarget(
      target: WardrobeGenerationTarget,
      prompt: WardrobeGeneratedPrompt,
      signal?: AbortSignal,
    ): Promise<WardrobeGenerationResult> {
      if (signal?.aborted) return { ok: false, error: '生图任务已取消' };
      let dataUrl: string;
      try {
        dataUrl = await deps.generateImage(prompt.promptText, prompt.negativePrompt, signal);
      } catch (error: any) {
        return { ok: false, error: `生图失败：${error?.message || error}` };
      }
      if (signal?.aborted) return { ok: false, error: '生图任务已取消' };

      const uploaded = await deps.uploadGeneratedImage(
        dataUrl,
        target.kind === 'item' ? 'wardrobe-item' : 'wardrobe-outfit',
        target.name,
      );
      if (!uploaded.path) return { ok: false, error: `图片保存失败：${uploaded.error || '上传接口未返回路径'}` };

      let persisted = false;
      try {
        persisted = await deps.persistImagePath(target, uploaded.path);
      } catch (_e) {
        persisted = false;
      }
      if (!persisted) {
        await deps.deleteStoredImage(uploaded.path);
        return { ok: false, error: '衣柜图片路径保存失败，新上传图片已清理' };
      }

      if (target.imagePath && target.imagePath !== uploaded.path) {
        const removed = await deps.deleteStoredImage(target.imagePath);
        if (!removed.ok) {
          return {
            ok: true,
            path: uploaded.path,
            warning: `新图已保存，但旧图删除失败：${removed.error}`,
          };
        }
      }
      return { ok: true, path: uploaded.path };
    },
  };
}

export function createWardrobeLocalImageImportOrchestrator(deps: WardrobeLocalImageImportDeps) {
  return {
    async importLocalImage(
      target: WardrobeGenerationTarget,
      file: File,
    ): Promise<WardrobeGenerationResult> {
      if (!file.type.startsWith('image/')) return { ok: false, error: '请选择图片文件' };
      if (file.size > 20 * 1024 * 1024) return { ok: false, error: '图片过大（最大 20MB），请压缩后再导入' };

      let dataUrl: string;
      try {
        dataUrl = await deps.readFileAsDataUrl(file);
      } catch (error: any) {
        return { ok: false, error: error?.message || '读取文件失败' };
      }

      const uploaded = await deps.uploadGeneratedImage(dataUrl, 'wardrobe-item', target.name);
      if (!uploaded.path) return { ok: false, error: `图片保存失败：${uploaded.error || '上传接口未返回路径'}` };

      let persisted = false;
      try {
        persisted = await deps.persistImagePath(target, uploaded.path);
      } catch (_e) {
        persisted = false;
      }
      if (!persisted) {
        await deps.deleteStoredImage(uploaded.path);
        return { ok: false, error: '衣柜图片路径保存失败，新上传图片已清理' };
      }

      if (target.imagePath && target.imagePath !== uploaded.path) {
        const removed = await deps.deleteStoredImage(target.imagePath);
        if (!removed.ok) {
          return {
            ok: true,
            path: uploaded.path,
            warning: `新图已保存，但旧图删除失败：${removed.error}`,
          };
        }
      }
      return { ok: true, path: uploaded.path };
    },
  };
}

async function persistWardrobeImagePath(
  target: WardrobeGenerationTarget,
  path: string,
): Promise<boolean> {
  const ownerChatKey = target.chatKey || getCurrentStoryChatKey();
  return withWardrobeMutationLock(ownerChatKey, async () => {
    if (!canPersistWardrobeGenerationTarget(target, getCurrentStoryChatKey())) return false;
    const state = wardrobeStore.load();
    const list = target.kind === 'item' ? state.items.slice() : state.outfits.slice();
    const index = list.findIndex(candidate => candidate.id === target.id);
    if (index < 0) return false;
    list[index] = { ...list[index], imagePath: path, updatedAt: Date.now() };
    return target.kind === 'item'
      ? wardrobeStore.save({ ...state, items: list as typeof state.items })
      : wardrobeStore.save({ ...state, outfits: list as typeof state.outfits });
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

export async function importWardrobeItemImage(
  target: WardrobeGenerationTarget,
  file: File,
): Promise<WardrobeGenerationResult> {
  const orchestrator = createWardrobeLocalImageImportOrchestrator({
    readFileAsDataUrl,
    uploadGeneratedImage,
    persistImagePath: persistWardrobeImagePath,
    deleteStoredImage,
  });
  return orchestrator.importLocalImage(target, file);
}

export async function generateWardrobeTarget(
  target: WardrobeGenerationTarget,
  mainPrompt: string,
  signal?: AbortSignal,
): Promise<WardrobeGenerationResult> {
  const imageGeneration = getConfig().imageGeneration;
  const prepared = prepareWardrobeImageGeneration(imageGeneration, target, mainPrompt);
  const orchestrator = createWardrobeGenerationOrchestrator({
    generateImage: (promptText, negativePrompt, requestSignal) =>
      generateImage(prepared.config, promptText, negativePrompt, requestSignal, true),
    uploadGeneratedImage,
    persistImagePath: persistWardrobeImagePath,
    deleteStoredImage,
  });
  return orchestrator.generateWardrobeTarget(
    target,
    { promptText: prepared.promptText, negativePrompt: prepared.negativePrompt },
    signal,
  );
}
