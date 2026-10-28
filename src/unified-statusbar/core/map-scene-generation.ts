import { getConfig } from './config-store';
import { getCustomApiConfig, withTextAiRetry, type TextAiContext } from './api-config';
import { getTavernHelper } from './env';
import { beginAiActivity, endAiActivity, updateAiActivity, readAiActivityChatKey } from './ai-activity';
import { AI_TEXT_FEATURE_LABEL } from './ai-text-features';
import { generateImage } from './image-gen';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 07 待修：与 map-scene-prompts 双向（本文件用它的提示词构建/解析；它反向经 portrait-prompts 拿到 assembleFinalPrompt，而 portrait-prompts 又要 map-system 的 getCleanChatHistory，map-system 再回来调本文件的 generateMapScene）⇒ 把「取干净剧情上下文」下沉成独立 chat-context 模块可一次断环
import {
  buildMapScenePromptRequest,
  parseMapScenePromptResult,
  prepareMapSceneImagePrompt,
  type MapSceneImageConfig,
  type MapScenePromptInput,
} from './map-scene-prompts';
import {
  readMapSceneImage,
  writeMapSceneImage,
  type MapSceneImageRecord,
} from './map-scene-store';
import { resolveImageTaskConfig } from './image-generation-config';
import { resolveImagePromptTemplate } from './image-prompt-templates';
import {
  deleteStoredImage,
  uploadGeneratedImage,
  type DeleteStoredImageResult,
  type ImageStorageResult,
} from './image-storage';
import { requestMapImageCleanup } from './map-image-reference-gc';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import { withAiParseRetry } from './ai-retry';
import type { ParsedMapScenePrompt } from './map-scene-prompts';
import { captureChatScope } from './story-floor-store';

export type MapSceneGenerationResult =
  | { ok: true; path: string; warning?: string; record: MapSceneImageRecord }
  | { ok: false; error: string; switched?: boolean };

export interface MapSceneGenerationDeps {
  getImageProvider: () => MapSceneImageConfig;
  generatePrompt: (request: { system: string; userInput: string }, signal?: AbortSignal, generationId?: string) => Promise<string>;
  generateImage: (provider: MapSceneImageConfig, promptText: string, negativePrompt: string, signal?: AbortSignal) => Promise<string>;
  uploadGeneratedImage: (dataUrl: string, namespace: string, filenameStem: string) => Promise<ImageStorageResult>;
  readScene: (nodeId: string) => Promise<MapSceneImageRecord | null>;
  writeScene: (record: MapSceneImageRecord) => Promise<boolean>;
  deleteStoredImage: (path: string) => Promise<DeleteStoredImageResult>;
  cleanupImages: (paths: readonly string[]) => Promise<{ failedPaths: string[] }>;
  now: () => number;
}

function providerFromConfig(config: MapSceneImageConfig): MapSceneImageConfig {
  return config.provider ? config : { provider: config as any };
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : String((error as any)?.message || error || fallback);
}

function makeBaseRecord(input: MapScenePromptInput, previous: MapSceneImageRecord | null, config: MapSceneImageConfig, now: number): MapSceneImageRecord {
  const provider = providerFromConfig(config);
  const base = previous || {
    version: 1 as const,
    schema: 'map_scene_image' as const,
    nodeId: input.nodeId,
    canonicalPath: input.canonicalPath,
    locationLabel: input.locationLabel,
    sourceMapHash: input.sourceMapHash,
    status: 'prompting' as const,
    imagePath: '',
    prompt: '',
    negativePrompt: '',
    width: 1216,
    height: 832,
    provider: provider.provider.apiFormat,
    imagePromptApiPresetId: provider.imagePromptApiPresetId || '',
    createdAt: now,
    updatedAt: now,
    lastAttemptAt: now,
  };
  return {
    ...base,
    nodeId: input.nodeId,
    canonicalPath: input.canonicalPath,
    locationLabel: input.locationLabel,
    sourceMapHash: input.sourceMapHash,
    provider: provider.provider.apiFormat,
    imagePromptApiPresetId: provider.imagePromptApiPresetId || base.imagePromptApiPresetId || '',
    updatedAt: now,
    lastAttemptAt: now,
  };
}

function withFailure(record: MapSceneImageRecord, code: string, message: string, now: number): MapSceneImageRecord {
  return {
    ...record,
    status: 'failed',
    updatedAt: now,
    error: { code, message, at: now },
  };
}

function isCancelled(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

async function defaultGeneratePrompt(
  request: { system: string; userInput: string },
  _signal?: AbortSignal,
  generationId?: string,
): Promise<string> {
  const helper = getTavernHelper();
  if (!helper || typeof helper.generateRaw !== 'function') throw new Error('无法访问 generateRaw');
  const result = await helper.generateRaw({
    should_silence: true,
    generation_id: generationId,
    user_input: request.userInput,
    ordered_prompts: [
      ...getJailbreakHeadPrompts(),
      { role: 'system', content: request.system },
      'user_input',
      ...getJailbreakTailPrompts(),
    ],
    custom_api: getCustomApiConfig('imageGeneration'),
  });
  return typeof result === 'string' ? result : '';
}

function defaultImageProvider(): MapSceneImageConfig {
  const config = getConfig();
  const resolved = resolveImageTaskConfig('mapScene', config.imageGeneration);
  return {
    provider: resolved.provider,
    width: resolved.width,
    height: resolved.height,
    imagePromptApiPresetId: config.imageGeneration.imagePromptApiPresetId,
  };
}

const defaultDeps: MapSceneGenerationDeps = {
  getImageProvider: defaultImageProvider,
  generatePrompt: defaultGeneratePrompt,
  generateImage: (config, promptText, negativePrompt, signal) =>
    generateImage(config.provider, promptText, negativePrompt, signal, true),
  uploadGeneratedImage,
  readScene: readMapSceneImage,
  writeScene: writeMapSceneImage,
  deleteStoredImage,
  cleanupImages: async paths => requestMapImageCleanup(paths),
  now: () => Date.now(),
};

export function createMapSceneGenerationOrchestrator(overrides: Partial<MapSceneGenerationDeps> = {}) {
  const deps: MapSceneGenerationDeps = { ...defaultDeps, ...overrides };
  if (!overrides.cleanupImages && overrides.deleteStoredImage) {
    deps.cleanupImages = async paths => {
      const failedPaths: string[] = [];
      for (const path of paths) {
        const result = await deps.deleteStoredImage(path);
        if (!result.ok) failedPaths.push(path);
      }
      return { failedPaths };
    };
  }

  return {
    async generateScene(input: MapScenePromptInput, signal?: AbortSignal): Promise<MapSceneGenerationResult> {
      if (!input.nodeId || !input.locationLabel) return { ok: false, error: '场景图缺少地图节点或地点名称' };
      if (isCancelled(signal)) return { ok: false, error: '场景图生成任务已取消' };

      // 聊天归属守卫：场景图记录写当前聊天的 story；请求期间切聊天 → 不写新聊天、不标记失败态。
      const scope = captureChatScope('地图场景');
      const switched = (): boolean => !scope.isCurrent();
      const discarded = (): MapSceneGenerationResult => ({ ok: false, error: '聊天已切换，本次场景图未写入', switched: true });

      let config: MapSceneImageConfig;
      let previous: MapSceneImageRecord | null;
      try {
        config = providerFromConfig(deps.getImageProvider());
        previous = await deps.readScene(input.nodeId);
      } catch (error) {
        return { ok: false, error: `读取场景图配置失败：${errorText(error, 'unknown error')}` };
      }
      if (switched()) return discarded();
      const now = deps.now();
      let attempt = makeBaseRecord(input, previous, config, now);
      attempt.status = 'prompting';
      delete attempt.error;
      if (!await deps.writeScene(attempt)) return { ok: false, error: '场景图状态无法保存，已停止生成' };

      // 统一 AI 活动：覆盖「提示词 + 解析重试」整个阶段；内层 withTextAiRetry 复用同一条目，
      // 避免解析重试两次请求之间条目闪断。取消 = abort 场景请求信号（内层再补 stopGenerationById）。
      const promptAbort = new AbortController();
      const forwardPromptAbort = (): void => { try { promptAbort.abort(); } catch (_e) { /* ignore */ } };
      if (signal) {
        if (signal.aborted) promptAbort.abort();
        else {
          try { signal.addEventListener('abort', forwardPromptAbort); } catch (_e) { /* ignore */ }
        }
      }
      const promptActivity = beginAiActivity({
        label: AI_TEXT_FEATURE_LABEL.mapScenePrompt,
        phase: 'preparing',
        chatKey: readAiActivityChatKey(),
        cancelable: true,
        cancel: () => {
          updateAiActivity(promptActivity.id, { phase: 'terminating' });
          forwardPromptAbort();
        },
      });
      let parsed;
      try {
        const request = buildMapScenePromptRequest(
          input, config.provider.promptComposeMode, config.provider.naturalPromptLanguage,
          // 自定义任务提示词来自「生图 AI 请求提示词」板块（未设置 = 内置，逐字节不变）
          resolveImagePromptTemplate(getConfig().imageGeneration.promptTemplates, 'mapScene', 'system', ''),
        );
        // 两层重试（ai-retry）：网络/空响应错误按分类器重试；解析失败时把修正提示
        // 回注到下一次生成请求（错误回注自愈闭环）。
        const outcome = await withAiParseRetry<ParsedMapScenePrompt>({
          signal: promptAbort.signal,
          generate: (_attempt, retryHint) => withTextAiRetry(
            'imageGeneration',
            async (ctx: TextAiContext) => {
              if (promptAbort.signal.aborted) throw new Error('请求已取消');
              const r = await deps.generatePrompt(
                retryHint
                  ? { ...request, userInput: `${request.userInput}\n\n${retryHint}` }
                  : request,
                promptAbort.signal,
                ctx.generationId,
              );
              if (promptAbort.signal.aborted) throw new Error('请求已取消');
              return r;
            },
            {
              signal: promptAbort.signal,
              feature: 'mapScenePrompt',
              activityId: promptActivity.id,
              onCancel: forwardPromptAbort,
            },
          ),
          parse: raw => parseMapScenePromptResult(raw),
          onRetry: attempt => console.info(`[地图场景] 提示词解析失败（第${attempt}次），携带修正提示重新生成`),
        });
        if (isCancelled(promptAbort.signal)) throw new Error('场景图生成任务已取消');
        parsed = outcome.value;
        if (!parsed) throw new Error('文本 API 返回的场景提示词格式无效');
      } catch (error) {
        if (switched()) return discarded();
        const failed = withFailure(attempt, isCancelled(promptAbort.signal) ? 'cancelled' : 'prompt_failed', errorText(error, '文本 API 失败'), deps.now());
        await deps.writeScene(failed);
        return { ok: false, error: `场景提示词生成失败：${failed.error?.message || 'unknown error'}` };
      } finally {
        if (signal) {
          try { signal.removeEventListener('abort', forwardPromptAbort); } catch (_e) { /* ignore */ }
        }
        endAiActivity(promptActivity.id);
      }
      if (switched()) return discarded();

      const prepared = prepareMapSceneImagePrompt(parsed, config);
      attempt = {
        ...attempt,
        status: 'generating',
        prompt: prepared.promptText,
        negativePrompt: prepared.negativePrompt,
        width: prepared.width,
        height: prepared.height,
        provider: config.provider.apiFormat,
        updatedAt: deps.now(),
        lastAttemptAt: deps.now(),
      };
      delete attempt.error;
      if (!await deps.writeScene(attempt)) {
        return { ok: false, error: '场景图生成状态无法保存，已停止生成' };
      }

      let dataUrl: string;
      try {
        if (isCancelled(signal)) throw new Error('场景图生成任务已取消');
        dataUrl = await deps.generateImage(config, prepared.promptText, prepared.negativePrompt, signal);
        if (isCancelled(signal)) throw new Error('场景图生成任务已取消');
      } catch (error) {
        if (switched()) return discarded();
        const failed = withFailure(attempt, isCancelled(signal) ? 'cancelled' : 'image_failed', errorText(error, '图片 API 失败'), deps.now());
        await deps.writeScene(failed);
        return { ok: false, error: `场景图生成失败：${failed.error?.message || 'unknown error'}` };
      }

      const uploaded = await deps.uploadGeneratedImage(dataUrl, 'map-scene', input.locationLabel || input.nodeId);
      if (!uploaded.path) {
        if (switched()) return discarded();
        const failed = withFailure(attempt, 'upload_failed', uploaded.error || '图片上传失败', deps.now());
        await deps.writeScene(failed);
        return { ok: false, error: `场景图保存失败：${failed.error?.message || '图片上传失败'}` };
      }
      if (switched()) {
        await deps.deleteStoredImage(uploaded.path);
        return discarded();
      }
      if (isCancelled(signal)) {
        await deps.deleteStoredImage(uploaded.path);
        const failed = withFailure(attempt, 'cancelled', '场景图生成任务已取消', deps.now());
        await deps.writeScene(failed);
        return { ok: false, error: '场景图生成任务已取消' };
      }

      const oldPath = previous?.imagePath && previous.imagePath !== uploaded.path ? previous.imagePath : '';
      const ready: MapSceneImageRecord = {
        ...attempt,
        status: 'ready',
        imagePath: uploaded.path,
        updatedAt: deps.now(),
        lastAttemptAt: deps.now(),
      };
      delete ready.error;
      delete ready.cleanupPendingPath;
      if (!await deps.writeScene(ready)) {
        await deps.deleteStoredImage(uploaded.path);
        const failed = withFailure(attempt, 'persist_failed', '场景图记录保存失败，新上传图片已清理', deps.now());
        await deps.writeScene(failed);
        return { ok: false, error: failed.error?.message || '场景图记录保存失败' };
      }

      let warning = '';
      if (oldPath) {
        const cleanup = await deps.cleanupImages([oldPath]);
        if (cleanup.failedPaths.length) {
          warning = '新场景图已保存，旧图已进入安全清理重试队列';
          return { ok: true, path: uploaded.path, warning, record: ready };
        }
      }
      return { ok: true, path: uploaded.path, record: ready };
    },
  };
}

export const mapSceneGenerationOrchestrator = createMapSceneGenerationOrchestrator();

export async function generateMapScene(
  input: MapScenePromptInput,
  signal?: AbortSignal,
): Promise<MapSceneGenerationResult> {
  return mapSceneGenerationOrchestrator.generateScene(input, signal);
}
