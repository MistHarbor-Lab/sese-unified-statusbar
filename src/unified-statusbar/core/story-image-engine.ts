// ===== 正文插图（自动文生图）：自动触发与编排引擎 =====
// 触发：MESSAGE_RECEIVED（type 过滤 quiet/impersonate/command/extension，与世界演化同模式）
//   → 1600ms 防抖（晚于世界演化的 500ms，避免抢跑）→ maybeGenerateStoryImages。
//   仅在「功能开 + 自动生图开」时臂发；自动生图关时只能走楼层「重新生成插图」按钮手动触发。
// AI 请求：generateRaw 精简自足结构（2026-08-28 用户确认）——ordered_prompts 只剩
//   破限 system + user_input 两段，世界书蓝绿灯/角色卡/persona/场景/对话示例全部不再进入；
//   角色外貌改由「角色资料块」显式注入 user_input：从正文匹配恋爱对象表/重要角色表角色 +
//   主角，按立绘同源格式注入【外貌特征】【身体数据】【当前穿搭（在场角色表，有则注入）】
//   （立绘固定 tag 开启时用 tag 替代外貌/身材描述，姓名/性别/年龄保留）。正文仅以任务素材
//   形式在 user_input 出现一次。资料收集失败不阻塞插图主流程（空资料块照常生图）。
//   文字 API 与其他生图共用 scope 'imageGeneration'。
// 生图：resolveImageTaskConfig 的 storyImage 任务 → generateImage(quiet)（全局间隔闸门+NAI 单并发
//   队列自动生效）→ 逐张串行，生图提示词拼接预设的前缀/后缀 → uploadGeneratedImage → 图库。
// 插入：生成一张插入一张（每张对最新正文重新定位后立即写回 setChatMessages），不等全部完成。
// 终止：常驻通知带「终止」按钮——生图阶段经 AbortSignal 中断，提示词阶段请求返回后丢弃。
import { getTavernHelper, getToastr, stopGenerationById } from './env';
import { debounce } from './timing';
import { makeUniqueId } from './id';
import { getConfig } from './config-store';
import { getCustomApiConfig, validateCustomApiConfig, showPersistentWarning, withTextAiRetry, type TextAiContext } from './api-config';
import { showApiConfigError, genFailureHead } from './notify-presets';
import { resolveImageTaskConfig, resolvePromptPresetSlice } from './image-generation-config';
import { generateImage } from './image-gen';
import { resolveImagePromptTemplate } from './image-prompt-templates';
import { imageStorage } from './image-storage';
import { getCurrentCardName } from './current-card';
import { getCellByHeader, getSheetByName, findRowByColumn } from './data-manager';
import { readCharAgeText } from './birthday';
import { getTodayDateKey } from './calendar-core';
import { getPortraitCharTags, isUseCharTags, isPortraitFanwork, hasPortraitFanTags, getPortraitFanTags, type PortraitCharTags } from './portrait-system';
import { PORTRAIT_PROTAGONIST_KEY, readProtagonistOutfitBaseline } from './portrait-protagonist';
import {
  buildStoryImageInstruction,
  buildStoryImageCharacterSection,
  type StoryImageCharacterProfile,
} from './story-image-prompts';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import { showTaskNotice, type TaskNoticeHandle } from './task-notify';
import { stripWithContextConfig } from './context-strip';
import {
  parseStoryImageBlocks,
  parseMultiCharPrompt,
  splitStoryParagraphs,
  findInsertionParagraphIndex,
  insertImagesIntoMessage,
  buildStoryImageMarkdown,
  stripStoryImageMarkdown,
  removeSingleStoryImageLine,
  buildStoryImagePendingMarker,
  findStoryImagePendingMarkerIds,
  removeStoryImagePendingMarkerLine,
  replaceStoryImagePendingMarkerWithImage,
  stripStoryImagePendingMarkers,
  STORY_IMAGE_PENDING_HREF_PREFIX,
  type StoryImageBlock,
  type StoryImageInsertion,
} from './story-image-parser';
import { countStoryReplyChars } from './story-image-config';
import {
  addStoryImageEntry, readStoryImageGallery, replaceStoryImageEntry, type StoryImageEntry,
} from './story-image-gallery-store';
import { regenerateFromRecord, isRecordReplayable } from './image-gen';
import type { ImageGenRecord, ImageGenRegenPatch } from './image-gen';
import { isRefillMode } from './refill-mode';

/** 发给提示词 AI 的正文上限（字符）——防超长楼层撑爆 token。 */
const STORY_TEXT_MAX_CHARS = 12000;

let _storyImageGenerating = false;
let _lastProcessedKey = '';
let _storyAbortRequested = false;
let _storyAbortController: AbortController | null = null;
let _storyPromptGenerationId = ''; // 提示词 generateRaw 请求标识，终止时用 stopGenerationById 真正中断

// ===== 生图失败占位（点击原位重试）=====
// 生图/上传失败的块在原插入位置写「点击重试」占位行；提示词只存本 Map（会话内存，不持久化）。
// 刷新/重进后缓存清空 → 装载/切聊天时清尸移除死占位行；占位点击走 retryPendingStoryImage。
interface PendingStoryImage {
  id: string;
  /** 占位所在楼层（重试时校验占位行仍在该楼层正文中）。 */
  mesId: number;
  /** 生图提示词（image### 原文，重试时按当前预设拼接前缀/后缀直接生图，跳过提示词 AI）。 */
  promptText: string;
  /** 中文画面描述（随重试生成的新图入库，供悬浮查看）。 */
  description: string;
}
const _pendingStoryImages = new Map<string, PendingStoryImage>();
// 会话内占位缓存上限：失败风暴（生图/上传服务长时间故障、自动生图持续跑）下防无界增长；
// 超限按 Map 插入序淘汰最旧（其占位行随装载/切聊天清尸逻辑自然移除，仅丢该条重试提示词）。
const PENDING_STORY_IMAGES_MAX = 200;

function getSt(): any {
  try {
    const rawSt: any = (window as any).SillyTavern || (window as any).TavernHelper?.SillyTavern;
    if (!rawSt) return null;
    return typeof rawSt.getContext === 'function' ? rawSt.getContext() : rawSt;
  } catch (_e) { return null; }
}

interface LastAiMessage {
  mesId: number;
  mes: string;
  swipeId: number;
}

// ===== 角色资料块收集（立绘同源：两表静态外貌 + NSFW信息表体型；固定 tag 开启时替代描述）=====

/** 立绘固定一致性 tag（useCharTags 开启且有缓存时返回）；主角同时查真名与哨兵键。
 *  导出供 index.ts 挂 window.__ubPortraitCharTags 桥（UBS_phone 独立 bundle 经桥注入）。 */
export function resolvePortraitCharTags(name: string, isProtagonist: boolean): PortraitCharTags | null {
  const keys = isProtagonist ? [name, PORTRAIT_PROTAGONIST_KEY] : [name];
  for (const k of keys) {
    if (k && isUseCharTags(k)) {
      const tags = getPortraitCharTags(k);
      if (tags) return tags;
    }
  }
  return null;
}

/** 主角资料：主角信息表 row 1（姓名/性别/年龄/外貌特征）；无 NSFW 行故无身体数据。
 *  衣着=衣柜穿搭基线（同立绘，wardrobeEnabled 开启且基线非空才注入）；主角不查在场角色表。 */
function readProtagonistProfile(): StoryImageCharacterProfile | null {
  const name = (getCellByHeader('主角信息表', 1, '姓名') || '').trim();
  const appearance = getCellByHeader('主角信息表', 1, '外貌特征') || '';
  if (!name && !appearance) return null;
  const profile: StoryImageCharacterProfile = {
    name: name || '主角',
    gender: getCellByHeader('主角信息表', 1, '性别') || '',
    age: readCharAgeText('主角信息表', 1, getTodayDateKey()),
    appearance,
    body: '',
  };
  const tags = resolvePortraitCharTags(profile.name, true);
  if (tags) { profile.appearance = tags.appearance; profile.body = tags.body; }
  // 衣柜穿搭基线（同立绘 portrait-system：wardrobeEnabled 守卫 + 基线非空才注入）
  if (getConfig().wardrobeEnabled !== false) {
    const baseline = readProtagonistOutfitBaseline();
    if (baseline) profile.outfit = `【当前穿搭（衣柜）】\n${baseline}`;
  }
  return profile;
}

/** 匹配角色资料：两表静态列 + NSFW信息表 身高体重/三围罩杯（'无' 不注入）+ 在场角色表全部衣着（同立绘七项）。
 *  同人角色（立绘索引 fanwork 开关 + 身份 tag 固化就绪）：不收集外貌/身材（资料块整段省略，外貌交给
 *  原作角色标签），衣着照常注入；charTags 替代跳过（同人优先，避免固定 tag 与角色标签两套外貌打架）。
 *  开关开着但身份 tag 未填/未识别时按普通角色出图（不静默产出无身份可依的同人块）。 */
function readNpcProfile(name: string, table: '恋爱对象表' | '重要角色表', row: number): StoryImageCharacterProfile {
  const fanworkFlag = isPortraitFanwork(name);
  const fanTags = fanworkFlag && hasPortraitFanTags(name) ? getPortraitFanTags(name) : null;
  const fanwork = fanTags !== null;
  if (fanworkFlag && !fanwork) {
    console.warn(`[正文插图]「${name}」已标记同人角色但未填写/识别同人身份 tag，本次按普通角色注入外貌`);
  }
  let appearance = '';
  let body = '';
  if (!fanwork) {
    appearance = getCellByHeader(table, row, '外貌特征') || '';
    const nsfwRow = findRowByColumn('NSFW信息表', '姓名', name);
    if (nsfwRow !== -1) {
      const hw = getCellByHeader('NSFW信息表', nsfwRow, '身高/体重') || '';
      const ms = getCellByHeader('NSFW信息表', nsfwRow, '三围/罩杯') || '';
      if (hw && hw !== '无') body = hw;
      if (ms && ms !== '无') body = body ? `${body}　${ms}` : ms;
    }
  }
  // 在场角色表衣着：同立绘读全部七项（当前穿搭+上装/下装/内衣/袜子/鞋子/饰品），拼成衣着块整段注入。
  // charTags 刻意不含衣着，与 tag 替代互补不冲突。七项全为空/无时不注入衣着块（无数据，以正文为准）。
  let outfit = '';
  const presenceRow = findRowByColumn('在场角色表', '姓名', name);
  if (presenceRow !== -1) {
    const cur = (getCellByHeader('在场角色表', presenceRow, '当前穿搭') || '').trim();
    const top = (getCellByHeader('在场角色表', presenceRow, '上装') || '').trim();
    const bottom = (getCellByHeader('在场角色表', presenceRow, '下装') || '').trim();
    const inner = (getCellByHeader('在场角色表', presenceRow, '内衣/内裤') || '').trim();
    const socks = (getCellByHeader('在场角色表', presenceRow, '袜子') || '').trim();
    const shoes = (getCellByHeader('在场角色表', presenceRow, '鞋子') || '').trim();
    const acc = (getCellByHeader('在场角色表', presenceRow, '饰品') || '').trim();
    const has = [cur, top, bottom, inner, socks, shoes, acc].some(v => v && v !== '无');
    if (has) {
      outfit = `【当前穿搭】\n${cur || '未描述'}\n`
        + `【上装】${top || '无'}　【下装】${bottom || '无'}　【内衣】${inner || '无'}　【袜子】${socks || '无'}　【鞋子】${shoes || '无'}　【饰品】${acc || '无'}`;
    }
  }
  const tags = !fanwork ? resolvePortraitCharTags(name, false) : null;
  if (tags) { appearance = tags.appearance; body = tags.body || body; }
  return {
    name,
    gender: getCellByHeader(table, row, '性别') || '',
    age: readCharAgeText(table, row, getTodayDateKey()),
    appearance,
    body,
    ...(fanTags ? { fanwork: true, fanTags: { character: fanTags.character, copyright: fanTags.copyright } } : {}),
    outfit,
  };
}

/**
 * 从正文匹配两表角色并收集资料块：恋爱对象表优先、重要角色表去重兜底（与立绘同优先级）；
 * 名字在正文中子串命中的角色才收录。表缺失/异常由调用方兜底为空资料块。
 */
function collectStoryImageCharacterProfiles(storyText: string): {
  protagonist: StoryImageCharacterProfile | null;
  characters: StoryImageCharacterProfile[];
} {
  const protagonist = readProtagonistProfile();
  const characters: StoryImageCharacterProfile[] = [];
  const seen = new Set<string>(protagonist ? [protagonist.name] : []);
  for (const table of ['恋爱对象表', '重要角色表'] as const) {
    let sheet: any;
    try { sheet = getSheetByName(table); } catch (_e) { continue; }
    if (!sheet || !Array.isArray(sheet.content)) continue;
    for (let i = 1; i < sheet.content.length; i++) {
      const name = (getCellByHeader(table, i, '姓名') || '').trim();
      if (!name || seen.has(name) || !storyText.includes(name)) continue;
      seen.add(name);
      characters.push(readNpcProfile(name, table, i));
    }
  }
  return { protagonist, characters };
}

/** 读最后一条 AI 消息（非 user/system 且非空）；ctx.chat 直读（setChatMessages 同源）。 */
function readLastAiMessage(): LastAiMessage | null {
  const st = getSt();
  const chat = st?.chat;
  if (!Array.isArray(chat) || !chat.length) return null;
  for (let i = chat.length - 1; i >= 0; i--) {
    const msg = chat[i];
    if (!msg || msg.is_user || msg.is_system) continue;
    if (typeof msg.mes === 'string' && msg.mes.trim()) {
      return { mesId: i, mes: msg.mes, swipeId: typeof msg.swipe_id === 'number' ? msg.swipe_id : 0 };
    }
  }
  return null;
}

/** 已处理楼层去重键：楼层号 + swipe 序 + 正文长度（swipe 重掷→新键可重试）。 */
function processedKey(m: LastAiMessage): string {
  return `${m.mesId}|${m.swipeId}|${m.mes.length}`;
}

/** 防抖调度：功能关或自动生图关时不臂（零开销；关自动后仅楼层按钮手动触发）。 */
function scheduleStoryImage(): void {
  // 重填模式：不臂防抖（零开销），杜绝重填期间的插图提示词 AI 请求与生图、图库写入。
  // 只在自动触发路径拦；楼层「重新生成插图」按钮与图库手动入口不经过本函数，照常可用。
  if (isRefillMode()) return;
  const config = getConfig();
  if (config.storyImageEnabled !== true) return;
  if (config.storyImage.autoGenerate !== true) return;
  scheduleStoryImageDebounced(); // U34：1600ms 尾沿防抖改走规范库
}

// U34：二次判定留在防抖体内——窗口内用户可能刚开启重填模式，触发时再查一次避免漏网。
const scheduleStoryImageDebounced = debounce(() => {
  if (isRefillMode()) return;
  void maybeGenerateStoryImages();
}, 1600);

/** 注册自动触发监听（幂等；doInitRender 每次调用）。 */
export function initStoryImageAutoTrigger(): void {
  // F4：window 令牌——同 world-sources/storage-bootstrap（模块重求值防双份 MESSAGE_RECEIVED 调度）
  const w = window as any;
  if (w.__ub_story_image_auto_bound) return;
  w.__ub_story_image_auto_bound = true;
  // 与世界演化同过滤：quiet=本插件自己的静默请求（防自触发循环）、impersonate/command/extension 排除
  const skipQuiet = (type?: string) => type === 'quiet' || type === 'impersonate' || type === 'command' || type === 'extension';
  const onTurn = (_id?: unknown, type?: string) => { if (!skipQuiet(type)) scheduleStoryImage(); };
  try {
    const rawSt: any = (window as any).SillyTavern || (window as any).TavernHelper?.SillyTavern;
    const st: any = typeof rawSt?.getContext === 'function' ? rawSt.getContext() : rawSt;
    const source = st?.eventSource;
    const types = st?.eventTypes || {};
    if (source && typeof source.on === 'function') {
      source.on(types.MESSAGE_RECEIVED || 'message_received', onTurn);
      // 切聊天：新聊天窗口外的旧插图收口 + 失效占位清尸（fire-and-forget；功能关=renderFloors 0 时函数内早退零成本）
      // 重填模式下跳过：这两步都会改写聊天正文（摘除插图 markdown/清占位），属自动写入，重填期间不应触发。
      source.on(types.CHAT_CHANGED || 'chat_changed', () => {
        if (isRefillMode()) return;
        void pruneStoryImagesOutsideRenderWindow();
        void pruneDeadPendingStoryImageMarkers();
      });
    }
  } catch (_e) { /* ignore */ }
  // 装载时的收口同样改写聊天正文（摘除窗外插图 markdown/清死占位）——重填期间跳过，
  // 关闭重填模式后下一次 CHAT_CHANGED 或自动生图收口路径会补做，无残留。
  if (isRefillMode()) return;
  void pruneStoryImagesOutsideRenderWindow(); // 装载时对当前聊天收口一次
  void pruneDeadPendingStoryImageMarkers(); // 装载时提示词缓存必为空 → 清掉上个会话遗留的死占位
}

export function isStoryImageGenerating(): boolean {
  return _storyImageGenerating;
}

/** 正文已含本插件插图标记 → 视为已处理（防重入/防重复插图）。 */
export function messageHasStoryImages(mes: string): boolean {
  return String(mes || '').includes('![正文插图](');
}

function notifyInfo(message: string, title?: string): void {
  const toastr = getToastr();
  if (toastr?.info) { try { toastr.info(message, title || ''); } catch (_e) { /* ignore */ } }
}

function notifyWarn(message: string, title?: string): void {
  const toastr = getToastr();
  if (toastr?.warning) { try { toastr.warning(message, title || ''); } catch (_e) { /* ignore */ } }
}

/** 从异常/对象提取可读失败原因（ImageGenError 带 status 的 message 已含 HTTP 状态）。 */
function describeError(e: unknown): string {
  if (!e) return '未知错误';
  if (e instanceof Error) return e.message || e.name;
  if (typeof e === 'string') return e;
  try { return String(e); } catch (_e) { return '未知错误'; }
}

/** 把多条失败原因拼成通知文案，超长截断避免 toastr 撑爆。 */
function summarizeFailures(failures: string[] | undefined): string {
  if (!failures || !failures.length) return '';
  const joined = failures.join('；');
  return joined.length > 200 ? joined.slice(0, 200) + '…' : joined;
}

function makeEntryId(): string {
  return makeUniqueId('sig');
}

/** 写回正文：优先 TavernHelper.setChatMessages（默认自动重渲染），兜底 ctx.chat 直写。 */
async function writeMessageText(mesId: number, mes: string): Promise<boolean> {
  const th: any = getTavernHelper();
  if (th && typeof th.setChatMessages === 'function') {
    try {
      await th.setChatMessages([{ message_id: mesId, message: mes }]);
      // setChatMessages 只改内存+刷新显示，不落盘（TavernHelper 实测实现无 save 调用）——
      // 删除/插入后直接刷新页面会回滚（症状："删了图但 markdown 又回来了"）。必须显式保存。
      const st = getSt();
      try { if (st && typeof st.saveChatConditional === 'function') await st.saveChatConditional(); } catch (_e) { /* best-effort */ }
      return true;
    } catch (_e) { /* fall through */ }
  }
  const st = getSt();
  if (st && Array.isArray(st.chat) && st.chat[mesId]) {
    st.chat[mesId].mes = mes;
    try { if (typeof st.saveChatConditional === 'function') await st.saveChatConditional(); } catch (_e) { /* ignore */ }
    try {
      st.eventSource?.emit?.(st.eventTypes?.MESSAGE_UPDATED || 'message_updated', mesId);
    } catch (_e) { /* ignore */ }
    return true;
  }
  return false;
}

interface StoryImageRunResult {
  ok: boolean;
  inserted: number;
  failed: number;
  error?: string;
  aborted?: boolean;
  /** 每张失败图的具体原因（生图/上传/定位/写回），用于结果通知展示。 */
  failures?: string[];
}

/** 当前聊天身份标识（切聊天守卫：生图期间聊天切换则放弃写回，图片保留在图库）。 */
function readChatIdentity(): string {
  try {
    const st = getSt();
    return String(st?.chatId || st?.characterId || st?.name2 || '') + '#' + String(st?.chat?.length || 0);
  } catch (_e) { return ''; }
}

/** 生图提示词拼接预设前缀/后缀（与立绘同源取 promptPrefix/promptSuffix，修剪多余逗号）。 */
function composeStoryPrompt(prefix: string, body: string, suffix: string): string {
  return [prefix, body, suffix]
    .map((s) => String(s || '').trim().replace(/^,+/, '').replace(/,+$/, ''))
    .filter(Boolean)
    .join(', ');
}

/** storyImage 任务供应商切片（主流程与占位重试共用）：负向词 + 前缀/后缀 + 多角色结构化前后缀。
 *  前后缀/负面走统一切片出口（含智慧姬抑制：直连时为空串）。 */
function resolveStoryImagePromptParts(config: ReturnType<typeof getConfig>): {
  provider: ReturnType<typeof resolveImageTaskConfig>['provider'];
  negativePrompt: string;
  prefix: string;
  suffix: string;
} {
  const resolved = resolveImageTaskConfig('storyImage', config.imageGeneration);
  const provider = resolved.provider;
  const slice = resolvePromptPresetSlice(provider);
  return { provider, negativePrompt: slice.negative, prefix: slice.prefix, suffix: slice.suffix };
}

/** 编排主流程（守卫已过）：AI 提示词 → 逐张生图 → 每张立即插入写回正文（可终止）。 */
async function runStoryImageGeneration(last: LastAiMessage): Promise<StoryImageRunResult> {
  const config = getConfig();
  const cfg = config.storyImage;
  const th: any = getTavernHelper();
  if (!th || typeof th.generateRaw !== 'function') return { ok: false, inserted: 0, failed: 0, error: '无法访问 generateRaw' };
  const chatIdentity = readChatIdentity();

  // 文字 API 与其他生图（立绘等）共用「图像提示词」预设
  const apiErr = validateCustomApiConfig('imageGeneration');
  if (apiErr) {
    showApiConfigError('正文插图', apiErr);
    return { ok: false, inserted: 0, failed: 0, error: apiErr };
  }

  // 正文注入前先剥离可配置的标签对（与地图/立绘/世界演化/技能同源——自取上下文注入 user_input
  // 的 MANUAL 模式都必须过标签剥离，避免富媒体/渲染标签污染提示词）。markdown 插图 `![]()`
  // 不是 <tag> 对，不受影响；角色姓名在叙事中亦不受影响。剥离后再截断，避免截断切断标签对。
  const strippedMes = stripWithContextConfig(last.mes);
  const storyText = strippedMes.length > STORY_TEXT_MAX_CHARS ? strippedMes.slice(0, STORY_TEXT_MAX_CHARS) : strippedMes;

  // ① 角色资料块：正文匹配两表角色 + 主角，立绘同源格式注入（失败不阻塞，空资料块照常生图）
  let characterSection = '';
  let hasFanworkCharacter = false;
  try {
    const profiles = collectStoryImageCharacterProfiles(storyText);
    characterSection = buildStoryImageCharacterSection(profiles.protagonist, profiles.characters);
    hasFanworkCharacter = profiles.characters.some((c) => c.fanwork === true); // 主角恒非同人
  } catch (_e) { /* 数据库表缺失/异常 → 无资料块 */ }

  // ② 精简自足 AI 请求（破限 system + user_input 两段；角色外貌来自资料块，不依赖酒馆上下文）
  // 提示词阶段走统一 AI 活动（提示条/悬浮钮/统一 toast + 注册表终止）；
  // 生图阶段仍保留 task notice（生图不在本轮统一范围）。
  _storyAbortRequested = false;
  _storyAbortController = new AbortController();
  let notice: TaskNoticeHandle | null = null;
  try {
    let instruction = buildStoryImageInstruction({
      storyText,
      // 覆盖链：板块覆盖 → 旧版功能设置字段（留待迁移） → 内置默认（builder 内回落）
      requirementPrompt: resolveImagePromptTemplate(config.imageGeneration.promptTemplates, 'storyImage', 'requirement', cfg.requirementPrompt || ''),
      structurePrompt: resolveImagePromptTemplate(config.imageGeneration.promptTemplates, 'storyImage', 'structure', ''),
      maxImages: cfg.maxPerRound,
      characterSection,
      hasFanworkCharacter,
    });
    if (typeof th.substitudeMacros === 'function') {
      try { instruction = th.substitudeMacros(instruction); } catch (_e) { /* keep raw */ }
    }
    let resultText = '';
    try {
      const r = await withTextAiRetry('imageGeneration', async (ctx: TextAiContext) => {
        // 终止请求后不再重试：抛「已取消」被 ai-retry 归为 aborted 立即外抛
        if (_storyAbortRequested || ctx.signal.aborted) throw new Error('请求已取消');
        _storyPromptGenerationId = ctx.generationId;
        try {
          return await th.generateRaw({
            should_silence: true,
            generation_id: ctx.generationId,
            user_input: instruction,
            // 精简结构：角色外貌由 user_input 内资料块提供，世界书/角色卡/persona/场景/示例全部不进
            ordered_prompts: [
              ...getJailbreakHeadPrompts(),
              'user_input',
              ...getJailbreakTailPrompts(),
            ],
            custom_api: getCustomApiConfig('imageGeneration'),
          });
        } catch (e) {
          if (_storyAbortRequested || ctx.signal.aborted) throw new Error('请求已取消');
          throw e;
        }
      }, {
        feature: 'storyImagePrompt',
        signal: _storyAbortController.signal,
        onCancel: () => {
          _storyAbortRequested = true;
          try { _storyAbortController?.abort(); } catch (_e) { /* ignore */ }
        },
      });
      resultText = typeof r === 'string' ? r : '';
    } catch (e: any) {
      // 终止（stopGenerationById 中断 generateRaw）会抛错——视为已终止，不报「AI 请求失败」
      if (_storyAbortRequested) return { ok: false, inserted: 0, failed: 0, aborted: true };
      return { ok: false, inserted: 0, failed: 0, error: `AI 请求失败：${e?.message || e}` };
    }
    if (_storyAbortRequested) return { ok: false, inserted: 0, failed: 0, aborted: true };
    if (!resultText) return { ok: false, inserted: 0, failed: 0, error: genFailureHead(resultText) };

    // ③ 解析 <UBS_image> 块
    const blocks = parseStoryImageBlocks(resultText, cfg.maxPerRound);
    if (!blocks.length) return { ok: false, inserted: 0, failed: 0, error: `${genFailureHead(resultText)}，未输出有效的 <UBS_image> 插图块` };

    // ④ 逐张生图 + 立即插入（生图阶段保留 task notice；提示词阶段已结束）
    notice = showTaskNotice('正文插图', `正在生成插图 0/${blocks.length}…`, {
      abortable: true,
      onAbort: () => {
        _storyAbortRequested = true;
        try { _storyAbortController?.abort(); } catch (_e) { /* ignore */ }
        stopGenerationById(_storyPromptGenerationId);
      },
    });
    const { provider, negativePrompt, prefix, suffix } = resolveStoryImagePromptParts(config);
    const charName = getCurrentCardName() || '';
    const stem = charName.replace(/[^\w一-鿿-]/g, '').slice(0, 40) || 'story';
    let currentMes = last.mes;
    let inserted = 0;
    let failed = 0;
    const failures: string[] = [];
    let index = 0;
    // 生图/上传失败的块 → 原插入位置写「点击重试」占位行，提示词入会话缓存（不持久化）。
    // 定位复用与成功插图同源的段落定位；定位未命中兜底正文末尾（与插图 null 分支同语义）。
    const insertPendingMarker = async (block: StoryImageBlock): Promise<void> => {
      try {
        if (readChatIdentity() !== chatIdentity) return; // 聊天已切换，不写正文
        const pendingId = makeEntryId();
        if (_pendingStoryImages.size >= PENDING_STORY_IMAGES_MAX) {
          const _oldest = _pendingStoryImages.keys().next().value;
          if (_oldest !== undefined) _pendingStoryImages.delete(_oldest);
        }
        _pendingStoryImages.set(pendingId, {
          id: pendingId,
          mesId: last.mesId,
          promptText: block.promptText,
          description: block.description || '',
        });
        const paraIdx = findInsertionParagraphIndex(splitStoryParagraphs(currentMes), block.positionQuote);
        const newMes = insertImagesIntoMessage(currentMes, [{ paragraph: paraIdx, markdown: buildStoryImagePendingMarker(pendingId) }]);
        if (newMes === currentMes) return;
        if (await writeMessageText(last.mesId, newMes)) currentMes = newMes;
      } catch (_e) { /* 占位失败不影响主流程 */ }
    };
    for (const block of blocks) {
      if (_storyAbortRequested) break;
      index++;
      notice?.update(`正在生成插图 ${index}/${blocks.length}（服从全局生图间隔）…`);
      let dataUrl: string;
      let genRecord: ImageGenRecord | undefined;
      try {
        // 多角色结构化：NAI V4/V5 走 char_captions/centers/use_coords（经 image-gen buildNovelAiStoryBody）；
        // OpenAI/ComfyUI 经 generateImage 内部 flattenStoryMulti 扁平化。解析失败回退扁平单段。
        const parsedMulti = parseMultiCharPrompt(block.promptText);
        const storyOpts = parsedMulti
          ? { multi: parsedMulti, prefix, suffix }
          : undefined;
        dataUrl = await generateImage(
          provider,
          composeStoryPrompt(prefix, block.promptText, suffix),
          negativePrompt,
          _storyAbortController?.signal,
          true,
          storyOpts,
          (r) => { genRecord = r; }, // 生图档案：生成那一刻的最终请求快照，随图入库
        );
      } catch (_e) {
        if (_storyAbortRequested) break;
        failed++;
        failures.push(`第${index}张生图失败：${describeError(_e)}`);
        notice?.update(`第${index}/${blocks.length} 张生图失败：${describeError(_e)}`);
        await insertPendingMarker(block);
        continue;
      }
      if (_storyAbortRequested) break;
      const upRes = await imageStorage.uploadGeneratedImage(dataUrl, 'story-image', stem);
      if (!upRes.path) { failed++; failures.push(`第${index}张：上传图片失败`); await insertPendingMarker(block); continue; }
      const entry: StoryImageEntry = {
        id: makeEntryId(),
        path: upRes.path,
        filename: upRes.path.split('/').pop() || '',
        charName,
        promptText: block.promptText,
        description: block.description || '',
        ...(genRecord ? { gen: genRecord } : {}),
        createdAt: Date.now(),
      };
      await addStoryImageEntry(entry, cfg.galleryLimit);
      // 定位基于最新正文（可能已插入前几张图；用户中途编辑也跟随最新）
      if (readChatIdentity() !== chatIdentity) {
        return { ok: inserted > 0, inserted, failed: failed + (blocks.length - index + 1), aborted: _storyAbortRequested, failures, error: inserted > 0 ? undefined : '聊天已切换，插图保留在文生图图库（未写入正文）' };
      }
      const paragraphs = splitStoryParagraphs(currentMes);
      const paraIdx = findInsertionParagraphIndex(paragraphs, block.positionQuote);
      const insertion: StoryImageInsertion = { paragraph: paraIdx, markdown: buildStoryImageMarkdown(upRes.path) };
      const newMes = insertImagesIntoMessage(currentMes, [insertion]);
      if (newMes === currentMes) { failed++; failures.push(`第${index}张：定位段落未命中，无法插入`); continue; }
      const written = await writeMessageText(last.mesId, newMes);
      if (!written) { failed++; failures.push(`第${index}张：写回正文失败`); continue; }
      currentMes = newMes;
      inserted++;
    }
    if (!inserted && !failed) return { ok: false, inserted: 0, failed: 0, aborted: true };
    if (!inserted) {
      return { ok: false, inserted: 0, failed, aborted: _storyAbortRequested, failures, error: _storyAbortRequested ? undefined : '全部插图生成失败' };
    }
    return { ok: true, inserted, failed, failures };
  } finally {
    notice?.close();
    _storyAbortRequested = false;
    _storyAbortController = null;
    _storyPromptGenerationId = '';
  }
}

/** 结果通知（自动/手动共用）。失败时附具体原因，便于排查（生图 HTTP 错误/上传/定位/写回）。 */
function notifyRunResult(result: StoryImageRunResult): void {
  const fl = summarizeFailures(result.failures);
  if (result.ok) {
    notifyInfo(
      result.failed > 0
        ? `已插入 ${result.inserted} 张正文插图（${result.failed} 张失败${fl ? '：' + fl : ''}）`
        : `已插入 ${result.inserted} 张正文插图`,
      '正文插图',
    );
  } else if (result.aborted) {
    notifyInfo(result.inserted > 0 ? `已终止：已插入 ${result.inserted} 张正文插图` : '已终止本次正文插图', '正文插图');
  } else if (result.error) {
    // 提示词阶段失败（未进入生图，inserted/failed 全 0，无占位行可原位重试）→ 常驻通知，仅手点关闭；
    // 生图阶段失败正文里已有「点击重试」占位，维持原即时通知。
    if (!result.inserted && !result.failed) {
      showPersistentWarning(fl ? `${result.error}：${fl}` : result.error, '正文插图');
    } else {
      notifyWarn(fl ? `${result.error}：${fl}` : result.error, '正文插图');
    }
  }
}

/** 自动触发入口：守卫链 + 幂等去重。 */
export async function maybeGenerateStoryImages(): Promise<void> {
  const config = getConfig();
  if (config.storyImageEnabled !== true) return;
  if (_storyImageGenerating) return;
  const last = readLastAiMessage();
  if (!last) return;
  // 字数闸：正文过短（寒暄/单行回复）静默跳过
  if (countStoryReplyChars(last.mes) < config.storyImage.minReplyChars) return;
  // 已含插图标记或本楼层已处理过 → 跳过（swipe 重掷会换 key 允许重试）
  if (messageHasStoryImages(last.mes)) { _lastProcessedKey = processedKey(last); return; }
  const key = processedKey(last);
  if (key === _lastProcessedKey) return;
  _lastProcessedKey = key;

  _storyImageGenerating = true;
  let result: StoryImageRunResult;
  try {
    result = await runStoryImageGeneration(last);
  } catch (e: any) {
    result = { ok: false, inserted: 0, failed: 0, error: `正文插图异常：${e?.message || e}` };
  } finally {
    _storyImageGenerating = false;
    void pruneStoryImagesOutsideRenderWindow(); // 渲染楼层窗口收口（新生成后旧楼层出窗；fire-and-forget）
  }
  notifyRunResult(result);
}

/**
 * 手动重新生成插图（楼层「重新生成插图」按钮入口）：
 * 只清除该楼层正文中的插图 markdown（图库与服务器文件保留），随后立即重跑一次正文生图。
 * 手动触发不受自动生图开关/字数闸限制；自动生图关时这是唯一的生图时机。
 */
export async function regenerateStoryImagesForMessage(mesId: number): Promise<void> {
  const config = getConfig();
  if (config.storyImageEnabled !== true) return;
  if (_storyImageGenerating) { notifyWarn('正文插图正在生成中，请等本轮结束后再试', '正文插图'); return; }
  const st = getSt();
  const msg = st?.chat?.[mesId];
  if (!msg || msg.is_user || msg.is_system || typeof msg.mes !== 'string' || !msg.mes.trim()) {
    notifyWarn('该楼层没有可插图的 AI 正文', '正文插图');
    return;
  }
  // 清除本楼层已有插图（只清正文标记，不动图库与服务器文件）
  let mes = msg.mes;
  if (messageHasStoryImages(mes)) {
    const cleared = stripStoryImageMarkdown(mes);
    if (cleared !== mes) {
      const written = await writeMessageText(mesId, cleared);
      if (written) mes = cleared;
    }
  }
  // 整楼重跑前清除本楼占位行（旧占位随重跑作废；写回成功才清缓存，写回失败占位仍可点）
  const strippedPending = stripStoryImagePendingMarkers(mes);
  if (strippedPending.ids.length && strippedPending.mes !== mes) {
    if (await writeMessageText(mesId, strippedPending.mes)) {
      mes = strippedPending.mes;
      for (const pid of strippedPending.ids) _pendingStoryImages.delete(pid);
    }
  }
  _lastProcessedKey = ''; // 允许该楼层重新进入自动处理
  _storyImageGenerating = true;
  let result: StoryImageRunResult;
  try {
    result = await runStoryImageGeneration({ mesId, mes, swipeId: typeof msg.swipe_id === 'number' ? msg.swipe_id : 0 });
  } catch (e: any) {
    result = { ok: false, inserted: 0, failed: 0, error: `正文插图异常：${e?.message || e}` };
  } finally {
    _storyImageGenerating = false;
    // 手动重生成不触发渲染窗口摘除：用户对自己操作的楼层负责，避免"刚生成的图立即被收起"
  }
  notifyRunResult(result);
}

/**
 * 从当前聊天全部楼层移除指定路径的插图 markdown（正文图片删除入口）。
 * 只清正文标记；图库条目与服务器文件由调用方（text-viewer）另行同步删除。返回写回的楼层数。
 */
export async function removeStoryImagesByPath(path: string): Promise<number> {
  const st = getSt();
  const chat = st?.chat;
  if (!Array.isArray(chat) || !path) return 0;
  const norm = path.startsWith('/') ? path.slice(1) : path;
  let count = 0;
  for (let i = 0; i < chat.length; i++) {
    const msg = chat[i];
    if (!msg || typeof msg.mes !== 'string') continue;
    // marker 兼容带/不带前导斜杠（服务器返回 /user/...，markdown 原样写入）
    if (!msg.mes.includes(`![正文插图](${norm})`) && !msg.mes.includes(`![正文插图](/${norm})`)) continue;
    const cleared = removeSingleStoryImageLine(msg.mes, path);
    if (cleared === msg.mes) continue;
    if (await writeMessageText(i, cleared)) count++;
  }
  return count;
}

/** 重新生图：把当前聊天全部楼层中旧路径的插图 markdown 原位替换为新路径（插图位置不变，其余内容逐字保留）。
 *  返回写回的楼层数。 */
export async function replaceStoryImagePathsInMessages(oldPath: string, newPath: string): Promise<number> {
  const st = getSt();
  const chat = st?.chat;
  if (!Array.isArray(chat) || !oldPath || !newPath) return 0;
  const norm = oldPath.startsWith('/') ? oldPath.slice(1) : oldPath;
  const newToken = newPath.startsWith('/') ? newPath : `/${newPath}`;
  let count = 0;
  for (let i = 0; i < chat.length; i++) {
    const msg = chat[i];
    if (!msg || typeof msg.mes !== 'string') continue;
    // marker 兼容带/不带前导斜杠（服务器返回 /user/...，markdown 原样写入）——守卫须同口径，
    // 否则正文的 `!(/user/...)` 形态恒被跳过，重新生图后正文换路径从不执行（刷新后破图）
    if (!msg.mes.includes(`(${norm})`) && !msg.mes.includes(`(/${norm})`)) continue;
    // marker 兼容带/不带前导斜杠（服务器返回 /user/...，markdown 原样写入）
    const next = msg.mes.split(`(/${norm})`).join(`(${newToken})`).split(`(${norm})`).join(`(${newToken})`);
    if (next === msg.mes) continue;
    if (await writeMessageText(i, next)) count++;
  }
  return count;
}

/**
 * 按生图档案重新生成单张正文插图（图库详情弹窗/正文放大「重新生图」入口）：
 * 档案原样重放（弹窗改过的提示词/参数仅本次生效，seed 默认新随机），新图上传成功 → 图库条目替换
 * （path/档案/时间）→ 正文楼层原位换路径 → 删旧图文件。与楼层「重新生成插图」（完整 AI 管线）
 * 互斥（共用占用守卫）。失败不写任何状态：旧图、旧档案、正文引用原样可用。
 */
export async function regenerateStoryImageFromArchive(
  path: string,
  patch: ImageGenRegenPatch = {},
  signal?: AbortSignal,
): Promise<{ ok: boolean; entry?: StoryImageEntry; error?: string; aborted?: boolean }> {
  const config = getConfig();
  if (config.storyImageEnabled !== true) return { ok: false, error: '正文插图功能未开启' };
  if (_storyImageGenerating) return { ok: false, error: '正文插图正在生成中，请等本轮结束后再试' };
  const norm = path.startsWith('/') ? path.slice(1) : path;
  const entry = readStoryImageGallery().find((e) => (e.path.startsWith('/') ? e.path.slice(1) : e.path) === norm);
  if (!entry) return { ok: false, error: '图库中找不到这张插图' };
  const gen = entry.gen;
  if (!gen || !isRecordReplayable(gen)) return { ok: false, error: '该插图没有可重绘的完整生图档案（旧条目不支持重新生图）' };

  _storyImageGenerating = true;
  let abortRequested = false;
  const controller = new AbortController();
  const notice = showTaskNotice('正文插图', '正在按生图档案重新生成插图…', {
    abortable: true,
    onAbort: () => {
      abortRequested = true;
      try { controller.abort(); } catch (_e) { /* ignore */ }
    },
  });
  try {
    let dataUrl = '';
    let genRecord: ImageGenRecord | undefined;
    try {
      dataUrl = await regenerateFromRecord(gen, patch, { signal: signal ?? controller.signal, quiet: true }, (r) => { genRecord = r; });
    } catch (e: any) {
      if (abortRequested) return { ok: false, aborted: true };
      return { ok: false, error: describeError(e) };
    }
    if (abortRequested) return { ok: false, aborted: true };
    if (!genRecord) return { ok: false, error: '重绘失败：未取得生图档案' };

    notice.update('正在保存新插图…');
    const stem = (entry.charName || '').replace(/[^\w一-鿿-]/g, '').slice(0, 40) || 'story';
    const upRes = await imageStorage.uploadGeneratedImage(dataUrl, 'story-image', stem);
    if (!upRes.path) return { ok: false, error: upRes.error ? `新图保存失败：${upRes.error}` : '新图保存失败（/api/images/upload）' };

    const updated: StoryImageEntry = {
      ...entry,
      path: upRes.path,
      filename: upRes.path.split('/').pop() || '',
      createdAt: Date.now(),
      gen: genRecord,
    };
    const stored = await replaceStoryImageEntry(entry.id, { path: updated.path, filename: updated.filename, gen: genRecord, createdAt: updated.createdAt });
    if (!stored) return { ok: false, error: '图库更新失败（存储未就绪或写入失败）' };

    // 正文楼层原位换路径（0 层=图只在图库/其他聊天，属正常）
    await replaceStoryImagePathsInMessages(entry.path, updated.path);
    // 旧图文件清理（引用已全部指向新图；删除失败仅警告，文件残留无害）
    try {
      const del = await imageStorage.deleteStoredImage(entry.path);
      if (!del.ok) notifyWarn(`新插图已生效，但旧图文件删除失败：${del.error || '未知错误'}`, '正文插图');
    } catch (e: any) {
      notifyWarn(`新插图已生效，但旧图文件删除失败：${e?.message || e}`, '正文插图');
    }
    return { ok: true, entry: updated };
  } finally {
    notice.close();
    _storyImageGenerating = false;
  }
}

/** 从当前聊天全部楼层移除指定 id 的占位行（缓存失效点击/清尸共用）；返回写回的楼层数。 */
async function removePendingMarkerEverywhere(id: string): Promise<number> {
  const st = getSt();
  const chat = st?.chat;
  if (!Array.isArray(chat)) return 0;
  let count = 0;
  for (let i = 0; i < chat.length; i++) {
    const msg = chat[i];
    if (!msg || typeof msg.mes !== 'string' || !msg.mes.includes(id)) continue;
    const cleared = removeStoryImagePendingMarkerLine(msg.mes, id);
    if (cleared === msg.mes) continue;
    if (await writeMessageText(i, cleared)) count++;
  }
  _pendingStoryImages.delete(id);
  return count;
}

/**
 * 清尸：移除全部楼层中缓存已失效的占位行。提示词缓存仅会话内存——装载时缓存必为空，
 * 上个会话的占位全部失效；会话内切聊天回来时按缓存逐 id 校验，未失效的占位保留。
 * 与渲染楼层摘除同触发点（装载/切聊天），生成中早退（写回不竞争）。
 */
export async function pruneDeadPendingStoryImageMarkers(): Promise<number> {
  if (_storyImageGenerating) return 0;
  const st = getSt();
  const chat = st?.chat;
  if (!Array.isArray(chat)) return 0;
  let pruned = 0;
  for (let i = 0; i < chat.length; i++) {
    const msg = chat[i];
    if (!msg || typeof msg.mes !== 'string' || !msg.mes.includes('#ub-sig-pending-')) continue;
    let mes = msg.mes;
    for (const id of findStoryImagePendingMarkerIds(mes)) {
      if (_pendingStoryImages.has(id)) continue; // 会话内仍有效（本会话生成、未刷新）
      mes = removeStoryImagePendingMarkerLine(mes, id);
    }
    if (mes !== msg.mes && await writeMessageText(i, mes)) pruned++;
  }
  return pruned;
}

/**
 * 占位重试（点击正文「正文插图生成失败，点击重试」占位）：用会话缓存的提示词直接重跑生图
 * （跳过提示词 AI，前后缀按当前预设拼接），成功后新图入图库并原位把占位行替换为插图行。
 * 与其他生图共用 _storyImageGenerating 互斥；可终止。失败占位保留可再次点击；
 * 缓存已失效（刷新后丢失）→ 清除死占位行并提示改用楼层「重新生成插图」。
 */
export async function retryPendingStoryImage(id: string): Promise<{ ok: boolean; aborted?: boolean; error?: string }> {
  const config = getConfig();
  if (config.storyImageEnabled !== true) return { ok: false, error: '正文插图功能未开启' };
  if (_storyImageGenerating) return { ok: false, error: '正文插图正在生成中，请等本轮结束后再试' };
  const pending = _pendingStoryImages.get(id);
  if (!pending) {
    await removePendingMarkerEverywhere(id);
    return { ok: false, error: '重试缓存已失效（刷新后不保留），请用楼层「重新生成插图」重跑' };
  }
  const st = getSt();
  const msg = st?.chat?.[pending.mesId];
  if (!msg || msg.is_user || msg.is_system || typeof msg.mes !== 'string'
    || !msg.mes.includes(STORY_IMAGE_PENDING_HREF_PREFIX + id)) {
    await removePendingMarkerEverywhere(id);
    return { ok: false, error: '该占位所在楼层已变化，请用楼层「重新生成插图」重跑' };
  }

  _storyImageGenerating = true;
  let abortRequested = false;
  const controller = new AbortController();
  const notice = showTaskNotice('正文插图', '正在重试生成失败的插图…', {
    abortable: true,
    onAbort: () => {
      abortRequested = true;
      try { controller.abort(); } catch (_e) { /* ignore */ }
    },
  });
  try {
    notice.update('正在重试生成插图（服从全局生图间隔）…');
    let dataUrl = '';
    let genRecord: ImageGenRecord | undefined;
    try {
      const { provider, negativePrompt, prefix, suffix } = resolveStoryImagePromptParts(config);
      const parsedMulti = parseMultiCharPrompt(pending.promptText);
      const storyOpts = parsedMulti
        ? { multi: parsedMulti, prefix, suffix }
        : undefined;
      dataUrl = await generateImage(
        provider,
        composeStoryPrompt(prefix, pending.promptText, suffix),
        negativePrompt,
        controller.signal,
        true,
        storyOpts,
        (r) => { genRecord = r; },
      );
    } catch (e: any) {
      if (abortRequested) return { ok: false, aborted: true };
      return { ok: false, error: describeError(e) };
    }
    if (abortRequested) return { ok: false, aborted: true };

    notice.update('正在保存新插图…');
    const charName = getCurrentCardName() || '';
    const stem = charName.replace(/[^\w一-鿿-]/g, '').slice(0, 40) || 'story';
    const upRes = await imageStorage.uploadGeneratedImage(dataUrl, 'story-image', stem);
    if (!upRes.path) return { ok: false, error: upRes.error ? `图片保存失败：${upRes.error}` : '图片保存失败（/api/images/upload）' };
    const entry: StoryImageEntry = {
      id: makeEntryId(),
      path: upRes.path,
      filename: upRes.path.split('/').pop() || '',
      charName,
      promptText: pending.promptText,
      description: pending.description,
      ...(genRecord ? { gen: genRecord } : {}),
      createdAt: Date.now(),
    };
    await addStoryImageEntry(entry, config.storyImage.galleryLimit);

    // 原位换图：占位行 → 插图行（占位位置即原定插入位置）
    const replaced = replaceStoryImagePendingMarkerWithImage(
      String(msg.mes || ''), id, buildStoryImageMarkdown(upRes.path),
    );
    if (!replaced) {
      await removePendingMarkerEverywhere(id);
      return { ok: false, error: '占位行已不在该楼层正文中，新插图已存入图库' };
    }
    if (!await writeMessageText(pending.mesId, replaced)) {
      return { ok: false, error: '写回正文失败（新插图已存入图库）' };
    }
    _pendingStoryImages.delete(id);
    return { ok: true };
  } finally {
    notice.close();
    _storyImageGenerating = false;
  }
}

/**
 * 渲染楼层窗口外的插图 markdown 与生图失败占位行摘除（真减负：从聊天数据删掉 img，浏览器不再
 * 加载/解码/渲染；占位随楼收起一并清理，缓存连带删除——窗外不再提供原位重试）。
 * 窗口 = 最近 renderFloors 个 AI 楼层（0=关闭不摘除）；摘除的图图库条目与服务器文件仍保留。
 * 低频调用（生成完成/设置变更/切聊天/装载），串行写回；无插图/占位或全在窗口内时零写回。
 */
export async function pruneStoryImagesOutsideRenderWindow(): Promise<number> {
  if (_storyImageGenerating) return 0; // 生成中的写回不竞争
  const floors = getConfig().storyImage.renderFloors;
  if (!Number.isFinite(floors) || floors <= 0) return 0;
  const st = getSt();
  const chat = st?.chat;
  if (!Array.isArray(chat)) return 0;
  const aiFloors: number[] = [];
  for (let i = 0; i < chat.length; i++) {
    const msg = chat[i];
    if (!msg || typeof msg.mes !== 'string' || msg.is_user === true || msg.is_system === true) continue;
    aiFloors.push(i);
  }
  const windowStart = aiFloors.length > floors ? aiFloors[aiFloors.length - floors] : 0;
  let pruned = 0;
  for (const i of aiFloors) {
    if (i >= windowStart) break; // aiFloors 升序，后续全在窗口内
    const msg = chat[i];
    if (!msg || typeof msg.mes !== 'string') continue;
    // 快速门双形态：插图 markdown 或占位锚点任一存在才进入改写
    if (!msg.mes.includes('![正文插图](') && !msg.mes.includes(STORY_IMAGE_PENDING_HREF_PREFIX)) continue;
    let cleared = stripStoryImageMarkdown(msg.mes);
    const pending = stripStoryImagePendingMarkers(cleared);
    if (pending.ids.length) cleared = pending.mes;
    if (cleared === msg.mes) continue;
    if (await writeMessageText(i, cleared)) {
      pruned++;
      for (const pid of pending.ids) _pendingStoryImages.delete(pid); // 写回成功才清缓存（失败占位仍可点）
    }
  }
  if (pruned > 0) notifyInfo(`已收起 ${pruned} 层旧楼层插图（渲染楼层 ${floors}，图库仍可查看）`, '正文插图');
  return pruned;
}
