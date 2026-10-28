import { getTavernHelper } from './env';
import { STANDARD_PROMPT_MIDDLE, STANDARD_MAX_CHAT_HISTORY } from './ai-request-pipeline';
import { makeUniqueId } from './id';
// ===== 衣柜运行时：AI 设计、CRUD 资源补偿与聊天级串行生图队列 =====
import { getCustomApiConfig, validateCustomApiConfig, withTextAiRetry, type TextAiContext } from './api-config';
import { getConfig } from './config-store';
import { isChatu8Channel, chatu8PromptComposeMode } from './chatu8-bridge';
import { isBaiBaiChannel } from './baibai-bridge';
import { resolveImagePromptTemplate } from './image-prompt-templates';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import { findRowByColumn, getCellByHeader } from './data-manager';
import { deleteStoredImage, type DeleteStoredImageResult } from './image-storage';
import { getPortraitCharTags, isUseCharTags } from './portrait-system';
import { withNativeScanWorldbook } from './worldbook-entry';

import { generateWardrobeTarget, importWardrobeItemImage, type WardrobeGenerationResult, type WardrobeGenerationTarget } from './wardrobe-generation';
import {
  assembleItemDisplayPrompt,
  buildOutfitModelTags,
  buildWardrobeBatchPromptRequest,
  buildWardrobeDesignDossier,
  buildWardrobeDesignRequest,
  buildWardrobeOutfitMetaRequest,
  parseWardrobeBatchPrompts,
  parseWardrobeDesignResult,
  parseWardrobeOutfitMeta,
  type PresentCharacterClothing,
  type WardrobeDesignContext,
  type WardrobeDesignResult,
  type WardrobeOutfitMetaResult,
  type WardrobeExtractionCandidate,
  type WardrobeOutfitModelData,
  type WardrobePromptRequest,
  type WardrobePromptTarget,
} from './wardrobe-prompts';
import {
  createWardrobeQueueController,
  type WardrobeGenerationBatch,
  type WardrobeGenerationTask,
  type WardrobeQueueResult,
} from './wardrobe-queue';
import {
  wardrobeService,
  type AddWardrobeItemDraft,
  type SaveOutfitDraft,
  type WardrobeResult,
} from './wardrobe-service';
import {
  WARDROBE_GENERATION_STORY_KEY,
  wardrobeStore,
  withWardrobeMutationLock,
  type WardrobeStore,
} from './wardrobe-store';
import { getCurrentStoryChatKey, readStoryFeature, writeStoryFeature } from './story-floor-store';
import type { OutfitPreset, WardrobeItem } from './wardrobe-types';

/**
 * 单品展示图提示词形态：智慧姬通道按**插件当前模式**判（SD/NovelAI/ComfyUI/RunningHub 吃标签、
 * Banana 读自然语言）；柏宝绘通道恒为标签（其提示词主字段吃 danbooru tag，自然语言段本通道不代传）；
 * 其余通道返回 undefined 交回 apiFormat 口径（内置行为不变）。
 * 为什么必须特判：外部通道的存储位都钉 openai，只看 apiFormat 会把吃标签的通道也编译成中文自然语言
 * 商品规格 ⇒ 标签形同废纸、单品图与标签对不上（docs/62 §五-3，柏宝绘同源风险）。
 */
function itemDisplayPromptForm(): 'tags' | 'natural' | undefined {
  try {
    const provider = getConfig().imageGeneration.provider;
    if (isBaiBaiChannel(provider)) return 'tags';
    if (!isChatu8Channel(provider)) return undefined;
    return chatu8PromptComposeMode() || undefined;
  } catch (_e) {
    return undefined;
  }
}

export interface WardrobeRuntimeService {
  addItem(draft: AddWardrobeItemDraft): Promise<WardrobeResult<WardrobeItem>>;
  updateItem(
    itemId: string,
    draft: Pick<WardrobeItem, 'name' | 'category' | 'description' | 'tags'>,
  ): Promise<WardrobeResult<WardrobeItem>>;
  saveOutfit(draft: SaveOutfitDraft): Promise<WardrobeResult<OutfitPreset>>;
  deleteItem(itemId: string): Promise<WardrobeResult<WardrobeItem>>;
  deleteOutfit(outfitId: string): Promise<WardrobeResult<OutfitPreset>>;
}

/** 套装生图模特选项：默认男/女用全局「套装生图模特标签」；story 用指定角色的立绘同源外貌资料 */
export interface WardrobeOutfitModelChoice {
  mode: 'female' | 'male' | 'story';
  characterName?: string;
}

export interface WardrobeRuntimeDeps {
  store: WardrobeStore;
  service: WardrobeRuntimeService;
  readBatch(): unknown;
  writeBatch(batch: WardrobeGenerationBatch): Promise<boolean>;
  getChatKey(): string;
  getPromptMode(): 'tags' | 'natural';
  getNaturalPromptLanguage?(): 'en' | 'zh';
  getImageApiFormat(): 'novelai' | 'openai' | 'comfyui';
  generateText(request: WardrobePromptRequest, scope: 'wardrobeExtract' | 'imageGeneration', signal?: AbortSignal): Promise<string>;
  generateDesignText(
    request: WardrobePromptRequest,
    context: WardrobeDesignContext,
    signal?: AbortSignal,
  ): Promise<string>;
  /** 套装「故事中角色」模特资料（立绘同源取数+charTags 替代）；null=该角色无外貌资料 */
  getOutfitModelData(name: string): WardrobeOutfitModelData | null;
  generateTarget(
    target: WardrobeGenerationTarget,
    prompt: string,
    signal?: AbortSignal,
  ): Promise<WardrobeGenerationResult>;
  deleteImage(path: string): Promise<DeleteStoredImageResult>;
  now(): number;
  makeBatchId(): string;
  emitSemanticEvent?(
    event:
      | 'wardrobe_image_generated'
      | 'wardrobe_batch_finished',
    payload: Record<string, number | string>,
  ): void;
}

export interface WardrobeDesignGenerationResult {
  ok: boolean;
  value: WardrobeDesignResult | null;
  error?: string;
}

export interface WardrobeOutfitMetaGenerationResult {
  ok: boolean;
  value: WardrobeOutfitMetaResult | null;
  error?: string;
}

export interface WardrobeExtractionAddResult {
  added: WardrobeItem[];
  errors: Array<{ candidate: WardrobeExtractionCandidate; error: string }>;
}

export type WardrobeMutationResult<T> =
  | ({ ok: true; value: T } & { warning?: string })
  | { ok: false; error: string };

function busyStatus(status: WardrobeGenerationTask['status']): boolean {
  return status === 'waiting_prompt'
    || status === 'queued'
    || status === 'running'
    || status === 'interrupted';
}

/** 套装「故事中角色」模特资料解析：立绘同源——恋爱对象表优先、重要角色表兜底的「外貌特征」
 *  + NSFW 信息表身体数据（仅非"无"值）；角色开了立绘固定标签替代（charTags+useCharTags）时
 *  外貌/身体整体用 charTags。无姓名、或（无 charTags 且外貌特征为空）返回 null=资料缺失。 */
function resolveWardrobeOutfitModelData(name: string): WardrobeOutfitModelData | null {
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;
  const charTags = isUseCharTags(trimmed) ? getPortraitCharTags(trimmed) : null;
  const loverRow = findRowByColumn('恋爱对象表', '姓名', trimmed);
  const importantRow = loverRow === -1 ? findRowByColumn('重要角色表', '姓名', trimmed) : -1;
  const srcTable = loverRow !== -1 ? '恋爱对象表' : (importantRow !== -1 ? '重要角色表' : '');
  const srcRow = loverRow !== -1 ? loverRow : importantRow;
  const gender = srcRow !== -1 ? (getCellByHeader(srcTable, srcRow, '性别') || '') : '';
  if (charTags) {
    return { name: trimmed, gender, appearance: charTags.appearance, body: charTags.body };
  }
  const appearance = srcRow !== -1 ? (getCellByHeader(srcTable, srcRow, '外貌特征') || '') : '';
  if (!appearance.trim()) return null;
  const bodyParts: string[] = [];
  const nsfwRow = findRowByColumn('NSFW信息表', '姓名', trimmed);
  if (nsfwRow !== -1) {
    const heightWeight = getCellByHeader('NSFW信息表', nsfwRow, '身高/体重') || '';
    const measure = getCellByHeader('NSFW信息表', nsfwRow, '三围/罩杯') || '';
    if (heightWeight && heightWeight !== '无') bodyParts.push(`身高/体重：${heightWeight}`);
    if (measure && measure !== '无') bodyParts.push(`三围/罩杯：${measure}`);
  }
  return { name: trimmed, gender, appearance, body: bodyParts.join('　') };
}

function cleanupResult<T>(
  value: T,
  cleanup: DeleteStoredImageResult | null,
): WardrobeMutationResult<T> {
  if (cleanup && !cleanup.ok) {
    return { ok: true, value, warning: `记录已更新，但旧图片删除失败：${cleanup.error || '未知错误'}` };
  }
  return { ok: true, value };
}

export function createWardrobeRuntime(deps: WardrobeRuntimeDeps) {
  let targetType: 'item' | 'outfit' = 'item';
  let outfitModel: WardrobeOutfitModelChoice = { mode: 'female' };
  let prepareMode: 'ai' | 'stored-tags' = 'ai';
  let lastFinishedSignature = '';

  // 单品标签立即落盘（即使后续出图失败也不丢），供套装重组与立绘换装复用
  const persistItemTags = async (tags: Record<string, string>): Promise<void> => {
    const tagIds = Object.keys(tags);
    if (tagIds.length === 0) return;
    await withWardrobeMutationLock(deps.getChatKey(), async () => {
      const state = deps.store.snapshot();
      let changed = false;
      const items = state.items.map(item => {
        const newTags = tags[item.id];
        if (typeof newTags === 'string' && newTags && newTags !== item.tags) {
          changed = true;
          return { ...item, tags: newTags };
        }
        return item;
      });
      if (changed) await deps.store.save({ ...state, items });
    });
  };

  const preparePrompts = async (
    targetIds: string[],
    signal: AbortSignal,
  ) => {
    const mode = deps.getPromptMode();
    // 按现有标签重新生图：跳过文本 AI，直接用存储 tags 拼装展示图 prompt，不写 tags
    if (prepareMode === 'stored-tags') {
      const state = deps.store.snapshot();
      const prompts: Record<string, string> = {};
      const errors: Record<string, string> = {};
      for (const id of targetIds) {
        const item = state.items.find(candidate => candidate.id === id);
        if (!item) { errors[id] = '目标已不存在'; continue; }
        const tags = (item.tags || '').trim();
        if (!tags) { errors[id] = '该服饰未生成标签，无法按现有标签重新生图'; continue; }
        prompts[id] = assembleItemDisplayPrompt({
          apiFormat: deps.getImageApiFormat(),
          mode,
          form: itemDisplayPromptForm(),
          category: item.category,
          name: item.name,
          description: item.description,
          tags,
        });
      }
      return { prompts, errors };
    }
    const state = deps.store.snapshot();
    const targets: WardrobePromptTarget[] = targetType === 'item'
      ? targetIds.map(id => state.items.find(item => item.id === id)).filter((item): item is WardrobeItem => !!item)
        .map(item => ({
          targetId: item.id,
          name: item.name,
          category: item.category,
          description: item.description,
        }))
      : targetIds.map(id => state.outfits.find(outfit => outfit.id === id)).filter((outfit): outfit is OutfitPreset => !!outfit)
        .map(outfit => ({
          targetId: outfit.id,
          name: outfit.name,
          description: outfit.description || '',
          items: outfit.itemIds
            .map(id => state.items.find(item => item.id === id))
            .filter((item): item is WardrobeItem => !!item)
            .map(item => ({
              id: item.id,
              category: item.category,
              name: item.name,
              description: item.description,
              tags: item.tags,
            })),
        }));
    let modelTags: string | undefined;
    let modelIsCharacter = false;
    if (targetType === 'outfit') {
      if (outfitModel.mode === 'story') {
        const characterName = (outfitModel.characterName || '').trim();
        if (!characterName) throw new Error('请先选择模特角色');
        const model = deps.getOutfitModelData(characterName);
        if (!model) {
          throw new Error('所选角色缺少外貌资料，请先在恋爱/重要角色表填写「外貌特征」，或在立绘中生成其固定一致性标签');
        }
        modelTags = buildOutfitModelTags(model);
        modelIsCharacter = true;
      } else {
        modelTags = getConfig().wardrobeModelTags[outfitModel.mode === 'male' ? 'male' : 'female'];
      }
    }
    const request = buildWardrobeBatchPromptRequest(
      targetType, mode, targets, modelTags, deps.getNaturalPromptLanguage?.() ?? 'en', modelIsCharacter,
      // 自定义任务提示词来自「生图 AI 请求提示词」板块（未设置 = 内置，逐字节不变）
      resolveImagePromptTemplate(getConfig().imageGeneration.promptTemplates, targetType === 'item' ? 'wardrobeItem' : 'wardrobeOutfit', 'system', ''),
    );
    const raw = await deps.generateText(request, 'imageGeneration', signal);
    const parsed = parseWardrobeBatchPrompts(raw, targetIds);
    if (targetType === 'item') {
      await persistItemTags(parsed.tags);
      // 前端按类别拼装单品展示图主提示词：AI 只出 tags，框定/类别专属/构图全部前端注入
      const itemById = new Map<string, WardrobeItem>();
      for (const item of state.items) itemById.set(item.id, item);
      const prompts: Record<string, string> = {};
      const errors: Record<string, string> = { ...parsed.errors };
      for (const id of targetIds) {
        if (errors[id]) continue;
        const itemTags = parsed.tags[id];
        if (!itemTags) { errors[id] = '标签缺失'; continue; }
        const item = itemById.get(id);
        if (!item) { errors[id] = '目标类别缺失'; continue; }
        prompts[id] = assembleItemDisplayPrompt({
          apiFormat: deps.getImageApiFormat(),
          mode,
          form: itemDisplayPromptForm(),
          category: item.category,
          name: item.name,
          description: item.description,
          tags: itemTags,
        });
      }
      return { prompts, errors };
    }
    return { prompts: parsed.prompts, errors: parsed.errors };
  };

  const queue = createWardrobeQueueController({
    now: deps.now,
    makeId: deps.makeBatchId,
    chatKey: deps.getChatKey,
    persist: deps.writeBatch,
    preparePrompts,
    async generateOne(task, signal) {
      const state = deps.store.snapshot();
      const record = targetType === 'item'
        ? state.items.find(item => item.id === task.targetId)
        : state.outfits.find(outfit => outfit.id === task.targetId);
      if (!record) throw new Error('生图目标已不存在');
      if (targetType === 'outfit' && (record as OutfitPreset).itemIds.length === 0) {
        throw new Error('套装组成为空，请先修复');
      }
      const generationTarget: WardrobeGenerationTarget = {
        kind: targetType,
        id: record.id,
        name: record.name,
        category: targetType === 'item' ? (record as WardrobeItem).category : undefined,
        imagePath: record.imagePath,
        chatKey: deps.getChatKey(),
      };
      const result = await deps.generateTarget(generationTarget, task.promptText || '', signal);
      if (!result.ok) throw new Error(result.error);
      const snapshot = queue.getSnapshot();
      deps.emitSemanticEvent?.('wardrobe_image_generated', {
        targetType: generationTarget.kind,
        source: (snapshot?.tasks.length || 0) > 1 ? 'batch' : 'single',
        amount: 1,
      });
    },
  });

  const emitFinishedBatch = (): void => {
    const snapshot = queue.getSnapshot();
    if (!snapshot || snapshot.status !== 'completed') return;
    const signature = `${snapshot.id}:${snapshot.tasks.map(task => task.status).join(',')}`;
    if (signature === lastFinishedSignature) return;
    lastFinishedSignature = signature;
    const success = snapshot.tasks.filter(task => task.status === 'success').length;
    const failed = snapshot.tasks.filter(task => task.status === 'failed').length;
    const total = snapshot.tasks.length;
    deps.emitSemanticEvent?.('wardrobe_batch_finished', {
      total,
      success,
      failed,
      clean: failed === 0 && success === total && total > 0 ? 1 : 0,
    });
  };

  const isTargetBusy = (kind: 'item' | 'outfit', id: string): boolean => {
    const snapshot = queue.getSnapshot();
    return !!snapshot
      && snapshot.targetType === kind
      && snapshot.tasks.some(task => task.targetId === id && busyStatus(task.status));
  };

  const rejectBusy = <T>(kind: 'item' | 'outfit', id: string): WardrobeMutationResult<T> | null =>
    isTargetBusy(kind, id)
      ? { ok: false, error: '该目标仍在生图队列中，请先取消或结束对应任务' }
      : null;

  const cleanupMutationImage = async <T>(
    result: WardrobeResult<T>,
  ): Promise<WardrobeMutationResult<T>> => {
    if (!result.ok) return result;
    const cleanup = result.imageToDelete ? await deps.deleteImage(result.imageToDelete) : null;
    return cleanupResult(result.value, cleanup);
  };

  return {
    load(): WardrobeGenerationBatch | null {
      const persisted = deps.readBatch();
      const rawType = (persisted as any)?.targetType;
      targetType = rawType === 'outfit' ? 'outfit' : 'item';
      return queue.load(persisted);
    },

    async switchChat(): Promise<WardrobeGenerationBatch | null> {
      prepareMode = 'ai';
      await queue.interrupt();
      deps.store.resetCache();
      deps.store.load();
      return this.load();
    },

    async startBatch(
      kind: 'item' | 'outfit',
      targetIds: string[],
      model?: WardrobeOutfitModelChoice,
      useStoredTags = false,
    ): Promise<WardrobeQueueResult> {
      const state = deps.store.snapshot();
      const unique = Array.from(new Set(targetIds));
      const list = kind === 'item' ? state.items : state.outfits;
      const missing = unique.find(id => !list.some(candidate => candidate.id === id));
      if (missing) return { ok: false, error: '所选目标已不存在，请刷新衣柜后重试' };
      if (kind === 'outfit') {
        const invalid = unique.find(id => !state.outfits.find(outfit => outfit.id === id)?.itemIds.length);
        if (invalid) return { ok: false, error: '所选套装组成为空，请先修复' };
      }
      // 同类型活动批次走追加排队（不另起新批）；跨类型（单品/套装）仍需等待当前批次结束。
      // targetType/prepareMode 必须在路由判定之后再写：拒绝路径若提前改写 targetType，
      // 活动批次的 generateOne 会按错误类型取目标（它读的是模块变量而非批次快照）。
      const activeSnapshot = queue.getSnapshot();
      const activeBatch = activeSnapshot
        && (activeSnapshot.status === 'preparing' || activeSnapshot.status === 'running')
        ? activeSnapshot
        : null;
      if (activeBatch && activeBatch.targetType !== kind) {
        return {
          ok: false,
          error: kind === 'outfit'
            ? '已有单品生图批次正在进行，请等待其完成后再生成套装'
            : '已有套装生图批次正在进行，请等待其完成后再生成单品',
        };
      }
      targetType = kind;
      prepareMode = (kind === 'item' && useStoredTags) ? 'stored-tags' : 'ai';
      if (kind === 'outfit') {
        // 模特选项随面板事件传入（按卡存储，面板负责回填）；未传兜底默认女模
        outfitModel = {
          mode: model?.mode === 'story' ? 'story' : (model?.mode === 'male' ? 'male' : 'female'),
          characterName: (model?.characterName || '').trim() || undefined,
        };
      }
      const result = activeBatch
        ? await queue.appendToBatch(unique)
        : await queue.startBatch(kind, unique);
      if (result.ok) emitFinishedBatch();
      return result;
    },

    async designCandidates(input: {
      instruction: string;
      presentClothing: readonly PresentCharacterClothing[];
      storyContext: string;
    }): Promise<WardrobeDesignGenerationResult> {
      const instruction = String(input.instruction || '').trim();
      if (!instruction) return { ok: false, value: null, error: '请先输入设计要求' };
      try {
        const request = buildWardrobeDesignRequest(instruction);
        const context: WardrobeDesignContext = {
          instruction,
          presentClothing: input.presentClothing,
          storyContext: input.storyContext,
        };
        const raw = await deps.generateDesignText(request, context);
        const value = parseWardrobeDesignResult(raw);
        if (!value || value.items.length === 0) {
          return { ok: false, value: null, error: 'AI 未返回有效分件，请调整设计要求后重试' };
        }
        return { ok: true, value };
      } catch (error: any) {
        return { ok: false, value: null, error: error?.message || String(error) };
      }
    },

    async suggestOutfitMeta(itemIds: readonly string[]): Promise<WardrobeOutfitMetaGenerationResult> {
      const state = deps.store.snapshot();
      const items = itemIds
        .map(id => state.items.find(candidate => candidate.id === id))
        .filter((item): item is WardrobeItem => !!item);
      if (items.length === 0) return { ok: false, value: null, error: '请先勾选至少一件服饰' };
      try {
        const raw = await deps.generateText(buildWardrobeOutfitMetaRequest(items), 'wardrobeExtract');
        const value = parseWardrobeOutfitMeta(raw);
        if (!value) return { ok: false, value: null, error: 'AI 未返回有效的套装名称或描述，请重试' };
        return { ok: true, value };
      } catch (error: any) {
        return { ok: false, value: null, error: error?.message || String(error) };
      }
    },

    async addExtracted(
      candidates: readonly WardrobeExtractionCandidate[],
    ): Promise<WardrobeExtractionAddResult> {
      const added: WardrobeItem[] = [];
      const errors: WardrobeExtractionAddResult['errors'] = [];
      for (const candidate of candidates) {
        const result = await deps.service.addItem({
          name: candidate.name,
          category: candidate.category,
          description: candidate.description,
        });
        if (result.ok) added.push(result.value);
        else errors.push({ candidate, error: result.error });
      }
      return { added, errors };
    },

    async addItem(draft: AddWardrobeItemDraft): Promise<WardrobeResult<WardrobeItem>> {
      return deps.service.addItem(draft);
    },

    async updateItem(
      itemId: string,
      draft: Pick<WardrobeItem, 'name' | 'category' | 'description' | 'tags'>,
    ): Promise<WardrobeMutationResult<WardrobeItem>> {
      const blocked = rejectBusy<WardrobeItem>('item', itemId);
      if (blocked) return blocked;
      return deps.service.updateItem(itemId, draft);
    },

    async importItemImage(itemId: string, file: File): Promise<WardrobeGenerationResult> {
      const blocked = rejectBusy<WardrobeItem>('item', itemId);
      if (blocked && !blocked.ok) return blocked;
      const item = deps.store.snapshot().items.find(candidate => candidate.id === itemId);
      if (!item) return { ok: false, error: '所选服饰已不存在，请刷新衣柜后重试' };
      return importWardrobeItemImage({
        kind: 'item',
        id: item.id,
        name: item.name,
        category: item.category,
        imagePath: item.imagePath,
        chatKey: deps.getChatKey(),
      }, file);
    },

    async saveOutfit(draft: SaveOutfitDraft): Promise<WardrobeMutationResult<OutfitPreset>> {
      if (draft.id) {
        const blocked = rejectBusy<OutfitPreset>('outfit', draft.id);
        if (blocked) return blocked;
      }
      return cleanupMutationImage(await deps.service.saveOutfit(draft));
    },

    async deleteItem(itemId: string): Promise<WardrobeMutationResult<WardrobeItem>> {
      const blocked = rejectBusy<WardrobeItem>('item', itemId);
      if (blocked) return blocked;
      return cleanupMutationImage(await deps.service.deleteItem(itemId));
    },

    async deleteOutfit(outfitId: string): Promise<WardrobeMutationResult<OutfitPreset>> {
      const blocked = rejectBusy<OutfitPreset>('outfit', outfitId);
      if (blocked) return blocked;
      return cleanupMutationImage(await deps.service.deleteOutfit(outfitId));
    },

    isTargetBusy,
    getSnapshot: queue.getSnapshot,
    subscribe: queue.subscribe,
    isRunning: queue.isRunning,
    cancelBatch: queue.cancelBatch,
    async retryFailed(): Promise<WardrobeQueueResult> {
      const result = await queue.retryFailed();
      if (result.ok) emitFinishedBatch();
      return result;
    },
    async continueInterrupted(): Promise<WardrobeQueueResult> {
      const result = await queue.continueInterrupted();
      if (result.ok) emitFinishedBatch();
      return result;
    },
    interrupt: queue.interrupt,
  };
}

async function generateWardrobeText(
  request: WardrobePromptRequest,
  scope: 'wardrobeExtract' | 'imageGeneration',
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) throw new Error('请求已取消');
  const apiError = validateCustomApiConfig(scope);
  if (apiError) throw new Error(apiError);
  const helper = getTavernHelper();
  if (!helper || typeof helper.generateRaw !== 'function') throw new Error('无法访问 generateRaw');
  // 网络级重试：按设置决定次数与通知（关闭时仅尝试一次）；配置/取消错误立即抛出。
  // 衣柜有专属面板进度：只上状态栏提示条与悬浮钮动效，不弹聚合 toast。
  return withTextAiRetry(scope, async (ctx: TextAiContext) => {
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
      custom_api: getCustomApiConfig(scope),
    });
    if (signal?.aborted) throw new Error('请求已取消');
    if (typeof result !== 'string' || !result.trim()) throw new Error('AI 返回为空');
    return result;
  }, { signal, feature: 'wardrobeExtract', suppressToast: true });
}

/** 「AI 设计穿搭」生成（1A 三段式同构，对照 calendar-ai/investigation 形态）：
 *  1. 结构头 = 破限头（+反八股）；结构尾 = 尾部破限（无害化收尾）；
 *  2. 资料块（after_system，不参与扫描）= 在场角色穿着资料 + 剧情上下文（处理后的上下文）；
 *  3. 触发注入（position:'none'，只参与世界书绿灯扫描）= 设计指令全文——指令点名的角色/地点/物件条目由酒馆原生扫描激活；
 *  4. 原生 world_info 槽位 + max_chat_history:0（原生 chat_history 不带楼层、user_input 不参与绿灯扫描）；
 *  5. 不做过滤豁免（不传 suspend/keep）：[UBS手机] 前缀条目（消息记录/窥私记录/正文联动格式）按内置规则全族剔除，
 *     条目黑名单设置照常生效；数据库纪要条目靠 AM 序号激活、触发注入不含序号，天然不命中，无需 suspend。 */
async function generateWardrobeDesignText(
  request: WardrobePromptRequest,
  context: WardrobeDesignContext,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) throw new Error('请求已取消');
  const apiError = validateCustomApiConfig('wardrobeExtract');
  if (apiError) throw new Error(apiError);
  const helper = getTavernHelper();
  if (!helper || typeof helper.generateRaw !== 'function') throw new Error('无法访问 generateRaw');
  // 网络级重试与提炼同款（按设置决定次数与通知）；配置/取消错误立即抛出。
  return withTextAiRetry('wardrobeExtract', async (ctx: TextAiContext) => {
    // 一次性注入必须随每次尝试重做：once:true 只在下一次生成生效，放在重试之外会让重试那一发丢掉资料块。
    if (typeof helper.injectPrompts === 'function') {
      const trigger = String(context.instruction || '').trim();
      if (trigger) {
        helper.injectPrompts([{
          id: 'wardrobe_design_trigger',
          position: 'none',          // 不发给 AI，只作为世界书绿灯条目的扫描素材
          depth: 0,
          role: 'system',
          content: trigger,
          should_scan: true,
        }], { once: true });
      }
      const dossier = buildWardrobeDesignDossier(context);
      if (dossier) {
        helper.injectPrompts([{
          id: 'wardrobe_design_context',
          position: 'after_system',  // 发给 AI，不参与扫描
          depth: 0,
          role: 'system',
          content: dossier,
          should_scan: false,
        }], { once: true });
      }
    }
    let userInput = `${request.system}\n\n${request.userInput}`;
    try {
      if (typeof helper.substitudeMacros === 'function') userInput = helper.substitudeMacros(userInput);
    } catch (_e) { /* 展宏失败用原文 */ }
    const result = await withNativeScanWorldbook({}, () => helper.generateRaw({
      should_silence: true,
      generation_id: ctx.generationId,
      user_input: userInput,
      ordered_prompts: [
        ...getJailbreakHeadPrompts({ antiCliche: true }),
        ...STANDARD_PROMPT_MIDDLE,
        ...getJailbreakTailPrompts(),
      ],
      max_chat_history: STANDARD_MAX_CHAT_HISTORY,
      custom_api: getCustomApiConfig('wardrobeExtract'),
    }));
    if (signal?.aborted) throw new Error('请求已取消');
    if (typeof result !== 'string' || !result.trim()) throw new Error('AI 返回为空');
    return result;
  }, { signal, feature: 'wardrobeDesign', suppressToast: true });
}

const defaultDeps: WardrobeRuntimeDeps = {
  store: wardrobeStore,
  service: wardrobeService,
  readBatch: () => readStoryFeature(WARDROBE_GENERATION_STORY_KEY, null),
  writeBatch: batch => {
    // 聊天已切换时不能把旧批次写进新聊天；旧聊天遗留的 active 状态下次读取会归一化为 interrupted。
    if (batch.chatKey && batch.chatKey !== getCurrentStoryChatKey()) return Promise.resolve(true);
    return writeStoryFeature(WARDROBE_GENERATION_STORY_KEY, batch);
  },
  getChatKey: getCurrentStoryChatKey,
  getPromptMode: () => getConfig().imageGeneration.provider.promptComposeMode,
  getNaturalPromptLanguage: () => getConfig().imageGeneration.provider.naturalPromptLanguage,
  getImageApiFormat: () => getConfig().imageGeneration.provider.apiFormat,
  generateText: generateWardrobeText,
  generateDesignText: generateWardrobeDesignText,
  getOutfitModelData: resolveWardrobeOutfitModelData,
  generateTarget: (target, prompt, signal) => generateWardrobeTarget(target, prompt, signal),
  deleteImage: deleteStoredImage,
  now: () => Date.now(),
  makeBatchId: () => makeUniqueId('wgb', 9, '_'),
  emitSemanticEvent(event, payload) {
    try { (window as any).__ubEmitAchievement?.(event, payload); } catch (_e) { /* ignore */ }
  },
};

export type WardrobeRuntime = ReturnType<typeof createWardrobeRuntime>;

export interface WardrobeRuntimeOwnerRecord {
  ownerId: string;
  runtime: WardrobeRuntime;
  chatKey: string;
  batchId: string;
  clients: Set<string>;
}

const PARENT_RUNTIME_OWNER_KEY = '__ub_wardrobe_runtime_owner';

export function acquireWardrobeRuntimeOwner(
  host: any,
  ownerId: string,
  createRuntime: () => WardrobeRuntime,
  chatKey: string,
): { record: WardrobeRuntimeOwnerRecord; isOwner: boolean } {
  const existing = host?.[PARENT_RUNTIME_OWNER_KEY] as WardrobeRuntimeOwnerRecord | undefined;
  if (existing?.runtime) {
    if (!(existing.clients instanceof Set)) existing.clients = new Set([existing.ownerId]);
    existing.clients.add(ownerId);
    return { record: existing, isOwner: existing.ownerId === ownerId };
  }
  const record: WardrobeRuntimeOwnerRecord = {
    ownerId,
    runtime: createRuntime(),
    chatKey,
    batchId: '',
    clients: new Set([ownerId]),
  };
  if (host) host[PARENT_RUNTIME_OWNER_KEY] = record;
  return { record, isOwner: true };
}

export function releaseWardrobeRuntimeOwner(host: any, ownerId: string): boolean {
  const existing = host?.[PARENT_RUNTIME_OWNER_KEY] as WardrobeRuntimeOwnerRecord | undefined;
  if (!existing) return false;
  if (!(existing.clients instanceof Set)) existing.clients = new Set([existing.ownerId]);
  existing.clients.delete(ownerId);
  if (existing.ownerId !== ownerId) return false;
  const successor = existing.clients.values().next().value as string | undefined;
  if (successor) {
    existing.ownerId = successor;
    return false;
  }
  try { delete host[PARENT_RUNTIME_OWNER_KEY]; } catch (_e) { host[PARENT_RUNTIME_OWNER_KEY] = undefined; }
  return true;
}

export function createWardrobeRuntimeFollower(owner: WardrobeRuntime): WardrobeRuntime {
  return {
    ...owner,
    // A duplicate iframe initializes its UI from the owner's live snapshot. It must
    // not reload persisted "active" data, which would interrupt the owner's batch.
    load: () => owner.getSnapshot(),
  };
}

function runtimeHost(): any {
  try { return window.parent || window; } catch (_e) { return globalThis as any; }
}

const runtimeInstanceId = makeUniqueId('wardrobe_owner', 9, '_');
let localRuntime: WardrobeRuntime | null = null;
let localOwnsRuntime = false;
let localOwnerUnsubscribe: (() => void) | null = null;

export function getWardrobeRuntime(): WardrobeRuntime {
  if (!localRuntime) {
    const acquired = acquireWardrobeRuntimeOwner(
      runtimeHost(),
      runtimeInstanceId,
      () => createWardrobeRuntime(defaultDeps),
      getCurrentStoryChatKey(),
    );
    localOwnsRuntime = acquired.isOwner;
    localRuntime = localOwnsRuntime
      ? acquired.record.runtime
      : createWardrobeRuntimeFollower(acquired.record.runtime);
    localOwnerUnsubscribe = localRuntime.subscribe(snapshot => {
      acquired.record.chatKey = snapshot?.chatKey || getCurrentStoryChatKey();
      acquired.record.batchId = snapshot?.id || '';
    });
  }
  return localRuntime;
}

export async function disposeWardrobeRuntime(): Promise<void> {
  if (!localRuntime) return;
  const runtime = localRuntime;
  localRuntime = null;
  localOwnerUnsubscribe?.();
  localOwnerUnsubscribe = null;
  const shouldInterrupt = releaseWardrobeRuntimeOwner(runtimeHost(), runtimeInstanceId);
  localOwnsRuntime = false;
  if (shouldInterrupt) await runtime.interrupt();
}
