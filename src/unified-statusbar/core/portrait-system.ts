import { getConfig } from './config-store';
import { UB_EVENT, emitUbEvent } from './events';
import { topWindowCandidates } from './cross-window';
import { debounce } from './timing';
import { cloneJson } from './external-storage-codec';
import { getTavernHelper, getToastr } from './env';
import { getCustomApiConfig, withTextAiRetry, type TextAiContext } from './api-config';
import { findRowByColumn, getCellByHeader, getSheetByName, invalidateCache, isNsfwPlayActive } from './data-manager';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import { buildPortraitPrompt, parsePromptOutput, buildPromptTextByMode, assembleFinalPrompt } from './portrait-prompts';
import type { PortraitTheme } from './portrait-prompts';
import type { PortraitClothingOverride } from './wardrobe-prompts';
import { generateImage, ImageGenError, sanitizeImageGenRecord, regenerateFromRecord, isRecordReplayable } from './image-gen';
import type { ImageGenRecord, ImageGenRegenPatch } from './image-gen';
import { resolveImageTaskConfig, resolvePromptPresetSlice } from './image-generation-config';
import { resolveImagePromptTemplate } from './image-prompt-templates';
import { imageStorage } from './image-storage';
import type { PortraitComposeMode } from './portrait-config';
import { resolveSizeByOrientation } from './portrait-config';
import type { PortraitSizeOrientation, PortraitGenPreference } from './portrait-config';
import type { StatusBarConfig } from './config-store';
import { isRefillMode } from './refill-mode';
import { readStoryFeature, writeStoryFeature, isStoryStorageReady, getCurrentStoryChatKey, getPortraitDataRevision, PORTRAIT_FEATURE_KEY } from './story-floor-store';
import { consumeAutoGenEntrySkip } from './auto-gen-entry-guard';
import { isLedgerTakeover } from './ledger-takeover';
import { PORTRAIT_PROTAGONIST_KEY, isProtagonistKey, readProtagonistDisplayName, readProtagonistOutfitBaseline } from './portrait-protagonist';

export interface PortraitCharTags {
  /** 外貌段：逗号分隔英文 danbooru tag */
  appearance: string;
  /** 身材段：逗号分隔英文 danbooru tag */
  body: string;
  updatedAt: number;
}

/** 同人身份 tag（原作人物/作品）。AI 识别一次后固化，或由用户在立绘生图界面直接填写；
 *  此后每次生图直接按 1.2::tag:: 拼进最终提示词，不再由 AI 每次请求输出。 */
export interface PortraitFanTags {
  /** 原作人物标准 tag（如 rem_(re:zero)） */
  character: string;
  /** 原作/copyright tag（如 re:zero_kara_hajimeru_isekai_seikatsu） */
  copyright: string;
  updatedAt: number;
}

export interface PortraitEntry {
  path: string;
  filename: string;
  promptText: string;
  negativePrompt: string;
  /** 生成时所用提示词模式；'none' 仅作早期导入/无档案条目的历史标记（勿删，旧数据可读）。 */
  composeMode: PortraitComposeMode | 'none';
  preset: 'avatar' | 'halfbody' | 'fullbody' | 'default';
  theme: PortraitTheme;          // 记录生成时所用主题，便于图库回溯
  extraPrompt: string;
  width: number; height: number;
  createdAt: number;
  /** 生成时快照的角色情绪；undefined=未标注 */
  emotion?: string;
  /** 生成时快照的是否瑟瑟；undefined=未标注 */
  nsfw?: boolean;
  /** 生图档案：生成那一刻实际发出的完整请求快照（最终提示词含 AQT/UCP+全参数+实际 seed）。
   *  undefined=本地导入或采集前的旧条目（详情弹窗显示「未记录」，提示词可手工补记）。 */
  gen?: ImageGenRecord;
}
export interface PortraitIndex {
  name: string;
  portraits: PortraitEntry[];
  current: string | null;
  /** 随机立绘池（path 数组）。有效立绘 ≥2 张时，每次渲染随机选一张展示（覆盖 current）。
   *  可选字段：老索引 JSON 无此键，解析为 undefined 即"未开启随机"。 */
  randomPool?: string[];
  /** 最近一次实际生成的提示词（无论生图成功失败），供生成弹窗预填与重新生图。
   *  可选字段：老索引 JSON 无此键，解析为 undefined 即"尚未生成过"。 */
  lastPrompt?: { promptText: string; negativePrompt: string };
  /** 人物固定特征 tag（外貌/身材）。undefined=尚未生成。 */
  charTags?: PortraitCharTags;
  /** 生图时用 charTags 替代数据库外貌/身材注入。仅 charTags 存在时有意义。 */
  useCharTags?: boolean;
  /** 同人角色标记：该人物是已有作品的同人角色，立绘/正文插图/小手机配图均不注入数据库外貌，
   *  提示词改用原作标准角色标签与作品标签（外貌由生图模型自带）。与 useCharTags 互斥。 */
  fanwork?: boolean;
  /** 同人身份 tag（原作人物/作品）：一次性识别或手填后固化，生图时直接拼进提示词。
   *  两项都填写才算就绪；关闭同人开关时保留数据便于切回。 */
  fanTags?: PortraitFanTags;
}

export type PortraitPreset = 'avatar' | 'halfbody' | 'fullbody' | 'default';

// —— 同步读经 story-floor-store 路由到持久 portrait store（PORTRAIT_FEATURE_KEY）；持久域读永远完整，不再维护独立 _cache ——

// ═══════════════════════════════════════════════════════════════
// 聊天楼层存储（旧世界书条目只读迁移）
// ═══════════════════════════════════════════════════════════════

type PortraitStoryData = Record<string, PersistedPortraitIndex>; // name → 持久化索引

/** 持久化时：剥离死字段，只保留 path + createdAt（+ index 级 name/current/randomPool）+ gen 生图档案 */
interface PersistedPortraitEntry {
  path: string;
  createdAt: number;
  emotion?: string;
  nsfw?: boolean;
  gen?: ImageGenRecord;
}
interface PersistedPortraitIndex {
  name: string;
  current: string | null;
  randomPool?: string[];
  lastPrompt?: { promptText: string; negativePrompt: string };
  charTags?: PortraitCharTags;
  useCharTags?: boolean;
  fanwork?: boolean;
  fanTags?: PortraitFanTags;
  portraits: PersistedPortraitEntry[];
}
function serializeIndex(idx: PortraitIndex): PersistedPortraitIndex {
  return {
    name: idx.name,
    current: idx.current,
    ...(idx.randomPool ? { randomPool: idx.randomPool } : {}),
    ...(idx.lastPrompt ? { lastPrompt: idx.lastPrompt } : {}),
    ...(idx.charTags ? {
      charTags: {
        appearance: idx.charTags.appearance,
        body: idx.charTags.body,
        updatedAt: idx.charTags.updatedAt,
      },
      ...(idx.useCharTags ? { useCharTags: true } : {}),
    } : {}),
    ...(idx.fanwork ? { fanwork: true } : {}),
    ...(idx.fanTags ? {
      fanTags: {
        character: idx.fanTags.character,
        copyright: idx.fanTags.copyright,
        updatedAt: idx.fanTags.updatedAt,
      },
    } : {}),
    portraits: idx.portraits.map((p) => ({
      path: p.path,
      createdAt: p.createdAt,
      ...(p.emotion ? { emotion: p.emotion } : {}),
      ...(p.nsfw !== undefined ? { nsfw: p.nsfw } : {}),
      ...(p.gen ? { gen: p.gen } : {}),
    })),
  };
}

/** 反序列化时：死字段补默认值，保持 PortraitEntry 接口完整 */
function deserializeIndex(raw: any): PortraitIndex | null {
  if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string') return null;
  const portraits: PortraitEntry[] = [];
  if (Array.isArray(raw.portraits)) {
    for (const p of raw.portraits) {
      if (!p || typeof p.path !== 'string') continue;
      portraits.push({
        path: p.path,
        filename: p.path.split('/').pop() || '',
        promptText: '',
        negativePrompt: '',
        composeMode: 'none',
        preset: 'default',
        theme: 'default',
        extraPrompt: '',
        width: 0,
        height: 0,
        createdAt: typeof p.createdAt === 'number' ? p.createdAt : 0,
        ...(typeof p.emotion === 'string' && p.emotion ? { emotion: p.emotion } : {}),
        ...(typeof p.nsfw === 'boolean' ? { nsfw: p.nsfw } : {}),
        // 生图档案（最终提示词/参数/实际 seed）随图持久；损坏数据 sanitize 后丢弃
        ...(p.gen ? (() => { const g = sanitizeImageGenRecord(p.gen); return g ? { gen: g } : {}; })() : {}),
      });
    }
  }
  return {
    name: raw.name,
    portraits,
    current: typeof raw.current === 'string' ? raw.current : null,
    ...(Array.isArray(raw.randomPool) ? { randomPool: raw.randomPool.filter((p: any) => typeof p === 'string') } : {}),
    ...(raw.lastPrompt && typeof raw.lastPrompt === 'object' && typeof raw.lastPrompt.promptText === 'string'
      ? { lastPrompt: { promptText: raw.lastPrompt.promptText, negativePrompt: typeof raw.lastPrompt.negativePrompt === 'string' ? raw.lastPrompt.negativePrompt : '' } }
      : {}),
    ...(raw.charTags && typeof raw.charTags === 'object'
      && typeof raw.charTags.appearance === 'string' && typeof raw.charTags.body === 'string'
      ? {
          charTags: {
            appearance: raw.charTags.appearance,
            body: raw.charTags.body,
            updatedAt: typeof raw.charTags.updatedAt === 'number' ? raw.charTags.updatedAt : 0,
          },
          ...(raw.useCharTags === true ? { useCharTags: true } : {}),
        }
      : {}),
    ...(raw.fanwork === true ? { fanwork: true } : {}),
    ...(raw.fanTags && typeof raw.fanTags === 'object'
      && typeof raw.fanTags.character === 'string' && typeof raw.fanTags.copyright === 'string'
      ? {
          fanTags: {
            character: raw.fanTags.character,
            copyright: raw.fanTags.copyright,
            updatedAt: typeof raw.fanTags.updatedAt === 'number' ? raw.fanTags.updatedAt : 0,
          },
        }
      : {}),
  };
}

/** 读全量立绘索引（经 story-floor-store 路由到持久 portrait store 的同步内存层）。
 *  读取层加速提案 D（2026-09-15）：按 getPortraitDataRevision 令牌缓存反序列化结果——
 *  原实现每次 getPortraitIndex 都整库 cloneJson+全量反序列化（渲染路径每帧多次）。
 *  令牌覆盖全部值转移：写入（overlay 计数）/清 overlay/绕过 write-behind 的 store 直写
 *  （revision 恒参与）/切卡（chatKey 参与）。缓存对象仅模块内部持有；
 *  getPortraitIndex 出口单角色深克隆，调用方改写克隆体安全（写路径 serialize 后落盘）。 */
let _portraitIndexCacheToken: string | null = null;
let _portraitIndexCache: Record<string, PortraitIndex> | null = null;

function readAllPortraits(): Record<string, PortraitIndex> {
  const token = getPortraitDataRevision();
  if (_portraitIndexCacheToken === token && _portraitIndexCache) return _portraitIndexCache;
  const raw = readStoryFeature<Record<string, any>>(PORTRAIT_FEATURE_KEY, {});
  const out: Record<string, PortraitIndex> = {};
  for (const r of Object.values(raw || {})) {
    const idx = deserializeIndex(r);
    if (idx) out[idx.name] = idx;
  }
  _portraitIndexCacheToken = token;
  _portraitIndexCache = out;
  return out;
}


/** 「换」按钮的一次性随机覆盖：npc → 下次 getCurrentPortraitPath 读时消费的临时 path。
 *  只影响下一次读取（"仅本次显示"），不写 current；渲染重建时自然重新摇号或回落到 current。 */
const _oneTimeRandomSwitch = new Map<string, string>();

export interface PortraitRandomFilter { byEmotion: boolean; byNsfw: boolean; }

/** 从随机池摇一张，应用筛选（情绪/瑟瑟精确匹配）。0 命中退化到整个有效池随机。
 *  返回 null 表示无有效池。 */
export function pickPortraitRandom(
  idx: PortraitIndex,
  filter: PortraitRandomFilter,
  excludePath?: string | null,
): string | null {
  const valid = (idx.randomPool || []).filter((p) => idx.portraits.some((e) => e.path === p));
  if (valid.length === 0) return null;

  const currentEmotion = (() => {
    const row = findRowByColumn('在场角色表', '姓名', idx.name);
    return row !== -1 ? (getCellByHeader('在场角色表', row, '情绪') || '').trim() : '';
  })();
  const currentNsfw = isNsfwPlayActive();

  let filtered = valid;
  if (filter.byEmotion) {
    const set = new Set(filtered.filter((p) => {
      const e = idx.portraits.find((x) => x.path === p);
      return e ? (e.emotion || '') === currentEmotion : false;
    }));
    if (set.size > 0) filtered = filtered.filter((p) => set.has(p));
  }
  if (filter.byNsfw) {
    const set = new Set(filtered.filter((p) => {
      const e = idx.portraits.find((x) => x.path === p);
      return e ? (e.nsfw === currentNsfw) : false;
    }));
    if (set.size > 0) filtered = filtered.filter((p) => set.has(p));
  }

  // 0 命中 → 退化全池（保留排除逻辑）
  if (filtered.length === 0) filtered = valid;
  if (excludePath && filtered.length > 1) {
    const rest = filtered.filter((p) => p !== excludePath);
    if (rest.length > 0) filtered = rest;
  }
  return filtered[Math.floor(Math.random() * filtered.length)];
}

/** 有效随机池（path 仍在 portraits 中）≥2 张时，随机摇一张（默认排除当前显示的 excludePath）作为「换」结果。
 *  存入一次性覆盖供下一次 getCurrentPortraitPath 消费；池未开启返回 null（调用方提示）。 */
export function switchPortraitRandom(npc: string, excludePath?: string | null): string | null {
  const idx = getPortraitIndex(npc);
  if (!idx) return null;
  const valid = (idx.randomPool || []).filter((p) => idx.portraits.some((e) => e.path === p));
  if (valid.length < 2) return null;
  const filter = getConfig().portraitRandomFilter || { byEmotion: false, byNsfw: false };
  const chosen = pickPortraitRandom(idx, filter, excludePath);
  if (!chosen) return null;
  _oneTimeRandomSwitch.set(npc, chosen);
  return chosen;
}

// —— 同步读当前立绘 path（buildHTML 用）——
// 随机池开启时（有效 path ≥2 张）每次调用随机选一张；否则返回 current。
// 这是纯同步读处注入随机，不触碰 doRender/签名脏检查/强制渲染等重建逻辑：
// 重建发生时自然重新摇号，不重建就不变（符合"每次重建时随机"且零轮询零定时器）。
export function getCurrentPortraitPath(npc: string): string | null {
  const idx = getPortraitIndex(npc);
  if (!idx) return null;
  // 消费「换」的一次性覆盖（读完即弃，不写 current）
  const oneTime = _oneTimeRandomSwitch.get(npc);
  if (oneTime !== undefined) {
    _oneTimeRandomSwitch.delete(npc);
    if (idx.portraits.some((e) => e.path === oneTime)) return oneTime;
  }
  if (idx.randomPool && idx.randomPool.length >= 2) {
    const filter = getConfig().portraitRandomFilter || { byEmotion: false, byNsfw: false };
    const chosen = pickPortraitRandom(idx, filter);
    if (chosen) return chosen;
  }
  return idx.current;
}
export function getPortraitIndex(npc: string): PortraitIndex | null {
  // 出口单角色深克隆：消灭「单角色取用=整库 clone+全量反序列化」，同时隔离调用方改写
  // （portrait-system 内部多处就地变更 idx 后 writePortraitIndex 落盘，在克隆体上语义不变）。
  const idx = readAllPortraits()[String(npc || '')];
  return idx ? cloneJson(idx) : null;
}

export async function loadAllPortraitIndices(): Promise<void> {
  const cfg = getConfig();
  if (!cfg.portraitEnabled) return;
  const chatKey = getCurrentStoryChatKey();
  if (!chatKey || chatKey.startsWith('unknown-')) return;
  // 持久 portrait store 已在 storage bootstrap 时 load；此处仅触发一次自动补齐。
  requestPortraitAutoGeneration();
}

async function writePortraitIndex(idx: PortraitIndex): Promise<boolean> {
  if (!isStoryStorageReady()) return false;
  const data = readStoryFeature<PortraitStoryData>(PORTRAIT_FEATURE_KEY, {});
  data[idx.name] = serializeIndex(idx);
  return writeStoryFeature(PORTRAIT_FEATURE_KEY, data);
}

/** 记录角色「最近一次」生成的提示词（无论生图成功失败）。写入失败不阻塞生图主流程，下次成功生图会覆盖。
 *  角色尚无索引（如首次自动生图）时先建一个空索引，避免首个生图条目的提示词丢失。 */
async function saveLastPrompt(npc: string, p: { promptText: string; negativePrompt: string }): Promise<boolean> {
  try {
    let idx = getPortraitIndex(npc);
    if (!idx) idx = { name: npc, portraits: [], current: null as string | null };
    idx.lastPrompt = { promptText: p.promptText, negativePrompt: p.negativePrompt };
    return await writePortraitIndex(idx);
  } catch (e) {
    console.warn(`[立绘] 保存「${npc}」最近一次提示词失败:`, e);
    return false;
  }
}

// —— 人物固定特征 tag（外貌/身材一致性锚点）——

export function getPortraitCharTags(npc: string): PortraitCharTags | null {
  return getPortraitIndex(npc)?.charTags || null;
}

export function isUseCharTags(npc: string): boolean {
  const idx = getPortraitIndex(npc);
  return !!(idx?.charTags && idx?.useCharTags);
}

/** tags=null 表示清空（同时强制关闭替代开关） */
export async function savePortraitCharTags(
  npc: string,
  tags: { appearance: string; body: string } | null,
): Promise<boolean> {
  try {
    let idx = getPortraitIndex(npc);
    if (!idx) idx = { name: npc, portraits: [], current: null as string | null };
    if (!tags) {
      delete idx.charTags;
      delete idx.useCharTags;
    } else {
      idx.charTags = {
        appearance: tags.appearance.trim(),
        body: tags.body.trim(),
        updatedAt: Date.now(),
      };
    }
    return await writePortraitIndex(idx);
  } catch (e) {
    console.warn(`[立绘] 保存「${npc}」人物tag失败:`, e);
    return false;
  }
}

export async function setUseCharTags(npc: string, on: boolean): Promise<boolean> {
  try {
    const idx = getPortraitIndex(npc);
    if (!idx || !idx.charTags) return false;
    if (on) {
      idx.useCharTags = true;
      delete idx.fanwork; // 互斥：固定 tag 替代与同人标记二选一（fanwork 无数据依赖，随时可切回）
    } else {
      delete idx.useCharTags;
    }
    return await writePortraitIndex(idx);
  } catch (e) {
    console.warn(`[立绘] 保存「${npc}」人物tag开关失败:`, e);
    return false;
  }
}

// —— 同人角色标记（按角色持久；与固定 tag 替代互斥，同一触发机制）——
// 开启后：立绘/正文插图/小手机配图对该角色不注入数据库外貌/身材，身份由同人身份 tag（fanTags）接管。
// 身份 tag 只在「AI识别」按钮或用户手填时产生一次，此后固化复用，不再由 AI 每次请求输出。主角恒 false。

export function isPortraitFanwork(npc: string): boolean {
  if (!npc || isProtagonistKey(npc)) return false;
  return getPortraitIndex(npc)?.fanwork === true;
}

export async function setPortraitFanwork(npc: string, on: boolean): Promise<boolean> {
  try {
    if (!npc || isProtagonistKey(npc)) return false;
    let idx = getPortraitIndex(npc);
    if (!idx) idx = { name: npc, portraits: [], current: null as string | null };
    if (on) {
      idx.fanwork = true;
      delete idx.useCharTags; // 互斥：同人标记与固定 tag 替代二选一（保留 charTags 数据便于切回）
    } else {
      delete idx.fanwork;     // fanTags 保留：重新开启无需重填
    }
    return await writePortraitIndex(idx);
  } catch (e) {
    console.warn(`[立绘] 保存「${npc}」同人标记失败:`, e);
    return false;
  }
}

// —— 同人身份 tag（原作人物/作品：固化后直接拼进提示词）——

export function getPortraitFanTags(npc: string): PortraitFanTags | null {
  return getPortraitIndex(npc)?.fanTags || null;
}

/** 两项都填写才算就绪：生图把两项按 1.2::tag:: 拼进最终提示词，缺项视为同人配置未完成。 */
export function hasPortraitFanTags(npc: string): boolean {
  const t = getPortraitFanTags(npc);
  return !!t && !!t.character.trim() && !!t.copyright.trim();
}

/** tags=null 表示清空。 */
export async function savePortraitFanTags(
  npc: string,
  tags: { character: string; copyright: string } | null,
): Promise<boolean> {
  try {
    if (!npc || isProtagonistKey(npc)) return false;
    let idx = getPortraitIndex(npc);
    if (!idx) idx = { name: npc, portraits: [], current: null as string | null };
    if (!tags) {
      delete idx.fanTags;
    } else {
      idx.fanTags = {
        character: tags.character.trim(),
        copyright: tags.copyright.trim(),
        updatedAt: Date.now(),
      };
    }
    return await writePortraitIndex(idx);
  } catch (e) {
    console.warn(`[立绘] 保存「${npc}」同人身份tag失败:`, e);
    return false;
  }
}

interface SavePortraitIndexOptions {
  /** 仅 AI 生成路径传 true；本地导入保持默认 false。 */
  addToRandomPool?: boolean;
}

/** 生成/导入时快照当前情绪与瑟瑟状态。情绪读「在场角色表」角色所在行；undefined=未标注。
 *  opts.includeEmotion=false → 不写情绪标签（生图弹窗「包含情绪」未勾选/偏好关闭时，输出图不挂情绪标签）；
 *  nsfw 快照与情绪开关无关，照常写入。导出供测试与未来复用。 */
export function snapshotPortraitTags(npc: string, opts?: { includeEmotion?: boolean }): { emotion?: string; nsfw?: boolean } {
  const row = findRowByColumn('在场角色表', '姓名', npc);
  const emotion = opts?.includeEmotion !== false && row !== -1
    ? (getCellByHeader('在场角色表', row, '情绪') || '').trim()
    : '';
  return {
    ...(emotion ? { emotion } : {}),
    ...{ nsfw: isNsfwPlayActive() },
  };
}

/** L18①(第十二轮)：立绘数据变动 → 通知两侧（本窗 document + 宿主窗口候选），手机据此重建头像快照。
 *  合并 200ms 内的多次写（save + setCurrent 是同一动作的两步）；派发目标是双窗——
 *  手机把桥注册在宿主窗口，只听 document 到不了（跨产物探测同 cross-window 纪律）。 */
function notifyPortraitChangedNow(npc: string, reason: string): void {
  if (typeof document === 'undefined') return; // Node 测试环境（无 DOM）：通知器静默跳过
  const detail = { npc, reason };
  emitUbEvent(UB_EVENT.portraitGenerated, detail, document);
  for (const w of topWindowCandidates() as unknown as Window[]) {
    if (w === window) continue; // 本窗已由上面的 document 派发覆盖
    try { w.dispatchEvent(new CustomEvent(UB_EVENT.portraitGenerated, { detail })); } catch (_e) { /* 跨窗异常忽略 */ }
  }
}
// U34：200ms 尾沿防抖改走规范库（参数取最后一次调用——与原手写「清旧表+带最新参」逐点等价）
const notifyPortraitChanged = debounce(notifyPortraitChangedNow, 200);

export async function savePortraitIndex(npc: string, entry: PortraitEntry, options: SavePortraitIndexOptions = {}): Promise<boolean> {
  const existing = getPortraitIndex(npc) || { name: npc, portraits: [], current: null as string | null };
  // 生成/导入前是否已有立绘：单一（current 已设）或随机（有效随机池 ≥2 张）。
  // 已有 → 只入图库，不替代 current；都没有 → 新图自动设为 current（首张即立绘）。
  const hadSelection = existing.current !== null
    || (!!existing.randomPool
      && existing.randomPool.filter((p) => existing.portraits.some((e) => e.path === p)).length >= 2);
  existing.portraits.push(entry);
  if (!hadSelection) existing.current = entry.path;
  if (options.addToRandomPool) {
    const pool = existing.randomPool ? existing.randomPool.slice() : [];
    if (!pool.includes(entry.path)) pool.push(entry.path);
    existing.randomPool = pool;
  }
  const ok = await writePortraitIndex(existing);
  if (ok) notifyPortraitChanged(npc, 'saved'); // L18①：生成/导入/换图都经此路径
  return ok;
}

export async function setCurrentPortrait(npc: string, path: string): Promise<boolean> {
  const idx = getPortraitIndex(npc);
  if (!idx) return false;
  idx.current = path;
  const ok = await writePortraitIndex(idx);
  if (ok) notifyPortraitChanged(npc, 'current'); // L18①
  return ok;
}

export async function deletePortrait(npc: string, path: string): Promise<boolean> {
  const idx = getPortraitIndex(npc);
  if (!idx) return false;
  idx.portraits = idx.portraits.filter((p) => p.path !== path);
  if (idx.current === path) idx.current = idx.portraits[0]?.path ?? null;
  // 同步清理随机池中该 path，避免残留失效条目（getCurrentPortraitPath 还会再过滤一次兜底）
  if (idx.randomPool) idx.randomPool = idx.randomPool.filter((p) => p !== path);
  const saved = await writePortraitIndex(idx);
  // 同步删本地文件：失败不阻塞索引删除，仅警告（同一文件被多卡引用时由用户手动清理）
  try {
    const del = await imageStorage.deleteStoredImage(path);
    if (!del.ok) {
      const t = getToastr();
      t?.warning?.(`「${npc}」的图片记录已删除，但本地文件删除失败：${del.error || '未知错误'}`, '立绘');
    }
  } catch (e: any) {
    const t = getToastr();
    t?.warning?.(`「${npc}」的图片记录已删除，但本地文件删除失败：${e?.message || e}`, '立绘');
  }
  return saved;
}

/** 编辑单张立绘的标签元数据。emotion 传 undefined 清除标注；nsfw 传 undefined 清除。 */
export async function updatePortraitMeta(
  npc: string,
  path: string,
  meta: { emotion?: string; nsfw?: boolean },
): Promise<boolean> {
  const idx = getPortraitIndex(npc);
  if (!idx) return false;
  const entry = idx.portraits.find((p) => p.path === path);
  if (!entry) return false;
  if (meta.emotion !== undefined) entry.emotion = meta.emotion || undefined;
  else delete (entry as any).emotion;
  if (meta.nsfw !== undefined) entry.nsfw = meta.nsfw;
  else delete (entry as any).nsfw;
  return writePortraitIndex(idx);
}

/** 编辑单张立绘的生图提示词（编辑弹窗保存；模型与参数只读不可改）。
 *  无档案的旧条目/导入图首次编辑时以现存提示词补建档案（provider 'unknown'）。 */
export async function updatePortraitGenText(
  npc: string,
  path: string,
  patch: { prompt?: string; negative?: string },
): Promise<boolean> {
  const idx = getPortraitIndex(npc);
  if (!idx) return false;
  const entry = idx.portraits.find((p) => p.path === path);
  if (!entry) return false;
  if (!entry.gen) {
    entry.gen = {
      provider: 'unknown',
      model: '',
      prompt: entry.promptText || '',
      negative: entry.negativePrompt || '',
      params: {},
    };
  }
  if (patch.prompt !== undefined) {
    entry.gen.prompt = patch.prompt.slice(0, 8000);
    entry.promptText = entry.gen.prompt; // 内存视图同步（旧字段为会话内展示回退）
  }
  if (patch.negative !== undefined) {
    entry.gen.negative = patch.negative.slice(0, 4000);
    entry.negativePrompt = entry.gen.negative;
  }
  return writePortraitIndex(idx);
}

// ===== 按档案重新生图（编辑弹窗「重新生图」）：替换原条目，标注/随机池/current 引用全保留 =====

/** 立绘按档案重绘：改过的提示词/参数仅本次生效（不影响全局设置，seed 默认新随机）。
 *  时序保证失败不毁旧图：新图上传成功 → 原位替换条目（图库位置/current/随机池/情绪瑟瑟标注保留）→ 才删旧图文件；
 *  任何一步失败旧图与旧档案原样可用。 */
export async function regeneratePortraitFromArchive(
  npc: string,
  path: string,
  patch: ImageGenRegenPatch = {},
  signal?: AbortSignal,
): Promise<{ ok: boolean; error?: string }> {
  const cfg = getConfig();
  if (!cfg.portraitEnabled) return { ok: false, error: '立绘功能未开启' };
  const idx = getPortraitIndex(npc);
  if (!idx) return { ok: false, error: '未找到该角色的立绘索引' };
  const i = idx.portraits.findIndex((p) => p.path === path);
  if (i < 0) return { ok: false, error: '立绘条目不存在' };
  const entry = idx.portraits[i];
  const gen = entry.gen;
  if (!gen || !isRecordReplayable(gen)) return { ok: false, error: '该立绘没有可重绘的完整生图档案（旧条目不支持重新生图）' };

  let dataUrl = '';
  let genRecord: ImageGenRecord | undefined;
  try {
    dataUrl = await regenerateFromRecord(gen, patch, { signal }, (r) => { genRecord = r; });
  } catch (e: any) {
    if (e instanceof ImageGenError) return { ok: false, error: `重绘失败：${e.message}` };
    return { ok: false, error: `重绘失败：${e?.message || e}` };
  }
  if (!genRecord) return { ok: false, error: '重绘失败：未取得生图档案' };

  // 新图落盘（主角用显示名，避免文件名出现哨兵 key）
  const displayName = isProtagonistKey(npc) ? readProtagonistDisplayName() : npc;
  const upRes = await imageStorage.uploadGeneratedImage(dataUrl, 'portrait', displayName);
  if (!upRes.path) return { ok: false, error: upRes.error ? `新图保存失败：${upRes.error}` : '新图保存失败（/api/images/upload）' };
  const newPath: string = upRes.path;

  // 原位替换条目：数组位置不变（图库顺序保留）；emotion/nsfw/theme/preset/extraPrompt/composeMode 保留；
  // 提示词/尺寸/生成时间/档案更新为本次实际形态
  idx.portraits[i] = {
    ...entry,
    path: newPath,
    filename: newPath.split('/').pop() || '',
    promptText: genRecord.prompt,
    negativePrompt: genRecord.negative,
    width: genRecord.params.width ?? entry.width,
    height: genRecord.params.height ?? entry.height,
    createdAt: Date.now(),
    gen: genRecord,
  };
  // 随机池与 current 引用同步换新 path（旧 path 不再存在）
  if (idx.randomPool) idx.randomPool = idx.randomPool.map((p) => (p === path ? newPath : p));
  if (idx.current === path) idx.current = newPath;
  const saved = await writePortraitIndex(idx);
  if (!saved) return { ok: false, error: '立绘保存失败（存储未就绪）；新图已上传但索引未更新' };
  // 旧图文件清理（索引已指向新图；删除失败仅警告，文件残留无害）
  try {
    const del = await imageStorage.deleteStoredImage(path);
    if (!del.ok) getToastr()?.warning?.(`新立绘已生效，但旧图文件删除失败：${del.error || '未知错误'}`, '立绘');
  } catch (e: any) {
    getToastr()?.warning?.(`新立绘已生效，但旧图文件删除失败：${e?.message || e}`, '立绘');
  }
  // 成就打点：重绘=一次成功生成（generator 按档案供应商）
  try {
    (window as any).__ubEmitAchievement?.('portrait_generated', {
      charName: npc,
      generator: genRecord.provider,
      theme: entry.theme,
      preset: entry.preset,
      isRegen: true,
      automatic: false,
      whileLewd: isNsfwPlayActive() ? 1 : 0,
      afterFailure: false,
      clothingReplace: 0,
      clothingReplaceMode: '',
    });
  } catch (_e) { /* ignore */ }
  return { ok: true };
}

// —— 随机立绘池：加入/移出某张立绘 ——
export async function togglePortraitInRandomPool(npc: string, path: string): Promise<boolean> {
  const idx = getPortraitIndex(npc);
  if (!idx) return false;
  const pool = idx.randomPool ? idx.randomPool.slice() : [];
  const i = pool.indexOf(path);
  if (i >= 0) pool.splice(i, 1);
  else pool.push(path);
  idx.randomPool = pool;
  return writePortraitIndex(idx);
}

// —— 生成编排 ——
export interface GeneratePortraitArgs {
  preset: PortraitPreset;
  theme: PortraitTheme;          // 主题（传给 buildPortraitPrompt 与 PortraitEntry）
  extraPrompt: string;
  includeStatus: boolean;
  includeEmotion: boolean;
  includeFanwork: boolean;
  /** "包含主角"：主角作为第二人最少出镜/不露脸。默认 false（含自动生图）→ 提示词与原单人逻辑一致 */
  includeProtagonist?: boolean;
  /** 仅本次生图生效的衣柜服装替换；调用前已解析为稳定服饰快照。 */
  clothingOverride?: PortraitClothingOverride;
  signal?: AbortSignal;
  /** 若提供，则跳过文本 AI 步骤，直接用此 prompt 调用生图（用于"重新生图"按钮） */
  prebuiltPrompt?: { promptText: string; negativePrompt: string };
  /** 文本 AI 生成完 prompt 后、调生图前触发（用于回填到弹窗的生图内容显示框） */
  onPromptReady?: (promptText: string, negativePrompt: string) => void;
  /** 自动补齐队列调用时传 true（供 portrait_auto_first 隐藏成就判定） */
  automatic?: boolean;
  /** 立绘生成失败后重试时传 true（供 portrait_retry_success 隐藏成就判定） */
  afterFailure?: boolean;
  /** every-turn 自动更新传 true：落盘后强制把新图设为当前展示立绘（替换 current）。 */
  forceSetCurrent?: boolean;
  /** 本次生图的尺寸方向（覆盖全局任务尺寸；不传则用全局 tasks.portrait 尺寸）。 */
  sizeOrientation?: PortraitSizeOrientation;
}

/** 解析自动更新队列用的生成参数：有偏好按偏好（含尺寸方向），无偏好维持原默认行为（零变化）。
 *  镜像 portrait-panel.ts 的主题强制规则：cinematic→includeStatus 强制 false；emotion→includeEmotion 强制 true。 */
export function resolvePortraitAutoArgs(cfg: StatusBarConfig): {
  preset: PortraitPreset;
  theme: PortraitTheme;
  includeStatus: boolean;
  includeEmotion: boolean;
  includeFanwork: boolean;
  includeProtagonist: boolean;
  extraPrompt: string;
  sizeOrientation?: PortraitSizeOrientation;
} {
  const pref: PortraitGenPreference | undefined = cfg.portraitGenPreference;
  if (!pref) {
    return {
      preset: 'default', theme: 'default',
      includeStatus: true, includeEmotion: true, includeFanwork: false, includeProtagonist: false,
      extraPrompt: '',
    };
  }
  const statusForcedOff = pref.theme === 'cinematic';
  const emotionForcedOn = pref.theme === 'emotion';
  return {
    preset: pref.preset,
    theme: pref.theme,
    includeStatus: statusForcedOff ? false : pref.includeStatus,
    includeEmotion: emotionForcedOn ? true : pref.includeEmotion,
    includeFanwork: pref.includeFanwork,
    includeProtagonist: pref.includeProtagonist,
    extraPrompt: pref.extraPrompt,
    sizeOrientation: pref.sizeOrientation,
  };
}

export async function generatePortrait(npc: string, args: GeneratePortraitArgs): Promise<{ ok: boolean; error?: string }> {
  _portraitAttemptCount += 1;
  const cfg = getConfig();
  if (!cfg.portraitEnabled) return { ok: false, error: '立绘功能未开启' };
  // 主角哨兵 key：索引/取数用哨兵，上传文件名与提示词姓名用主角真名
  const isProtagonist = npc === PORTRAIT_PROTAGONIST_KEY;
  const displayName = isProtagonist ? readProtagonistDisplayName() : npc;
  const ig = resolveImageTaskConfig('portrait', cfg.imageGeneration).provider;

  // F8 聊天代际守卫（与地图 §F5 / 世界演化 §F5 / 剧情生图同款修法）。
  // 本函数跨「文本 AI → 生图 → 上传 → 落盘」多个长耗时 await，期间用户可能切卡；
  // 而 writePortraitIndex 落的是「当前聊天」的立绘库（story-floor-store 按当前聊天路由），
  // 不设守卫就会把本卡角色的立绘写进别卡档案（污染新卡 + 同名角色显示错图 + 白占存储）。
  // 沿用兄弟模块的「发起时捕获身份 + 写入前核对」形态；发起时身份为空（存储未就绪）时不启用
  // 守卫，避免把「加载窗口内发起的手动生成」误判为切卡而丢弃。
  const chatKeyAtStart = getCurrentStoryChatKey();
  const CHAT_SWITCHED_ABORT = { ok: false, error: '聊天已切换，已放弃本次立绘写入' };
  const chatSwitched = (): boolean => {
    const switched = !!chatKeyAtStart && getCurrentStoryChatKey() !== chatKeyAtStart;
    if (switched) console.info('[立绘] 聊天已切换，放弃本次立绘写入', { from: chatKeyAtStart, to: getCurrentStoryChatKey() });
    return switched;
  };

  // 尺寸方向覆盖：若调用方指定方向，按当前供应商解析并就地覆盖（不写回 config）；不传则用全局 tasks.portrait 尺寸
  const effectiveOrientation = args.sizeOrientation;
  if (effectiveOrientation) {
    const sz = resolveSizeByOrientation(ig.apiFormat, effectiveOrientation);
    if (ig.apiFormat === 'openai') {
      ig.openai.aspectRatio = sz.aspectRatio;
    } else if (ig.apiFormat === 'comfyui') {
      ig.comfyui.width = sz.width;
      ig.comfyui.height = sz.height;
    } else {
      ig.novelai.width = sz.width;
      ig.novelai.height = sz.height;
    }
  }

  let promptText: string;
  let negativePrompt: string;

  if (args.prebuiltPrompt && args.prebuiltPrompt.promptText.trim()) {
    // 重新生图：直接使用调用方提供的 prompt，跳过文本 AI
    promptText = args.prebuiltPrompt.promptText;
    negativePrompt = args.prebuiltPrompt.negativePrompt;
  } else {
    // 1. 读角色数据：主角走主角信息表（仅要求姓名非空）；NPC 走恋爱/在场/重要三表
    let loverRow = -1, presenceRow = -1, importantRow = -1, nsfwRow = -1;
    if (isProtagonist) {
      if (!getCellByHeader('主角信息表', 1, '姓名')) return { ok: false, error: '主角信息表尚未填写姓名，无法生成主角立绘' };
    } else {
      loverRow = findRowByColumn('恋爱对象表', '姓名', npc);
      presenceRow = findRowByColumn('在场角色表', '姓名', npc);
      importantRow = findRowByColumn('重要角色表', '姓名', npc);
      nsfwRow = findRowByColumn('NSFW信息表', '姓名', npc);  // 身高/体重、三围/罩杯；-1 表示该角色无 NSFW 档案，跳过即可
      if (loverRow === -1 && presenceRow === -1 && importantRow === -1) return { ok: false, error: `未找到角色"${npc}"的数据` };
    }

    // 2. 同人身份 tag（固化）就绪门控：两项齐备才拼进提示词；缺项直接终止，不降级为数据库外貌
    //    （身份已不再由 AI 每次识别，缺项即配置未完成——在烧文本 AI/生图请求之前拦下）
    let fanTags: PortraitFanTags | null = null;
    if (args.includeFanwork) {
      fanTags = getPortraitFanTags(npc);
      if (!fanTags || !fanTags.character.trim() || !fanTags.copyright.trim()) {
        return { ok: false, error: '同人角色缺少身份 tag：请先在「同人角色」处填写人物tag与作品tag，或点「AI识别身份」' };
      }
    }

    // 3. 组装 prompt
    const { system, userInput } = buildPortraitPrompt({
      npc, loverRow, presenceRow, importantRow, nsfwRow,
      contextCount: cfg.portraitContextCount,
      composeMode: ig.promptComposeMode,
      naturalLanguage: ig.naturalPromptLanguage,
      preset: args.preset,
      theme: args.theme,
      extraPrompt: args.extraPrompt,
      includeStatus: args.includeStatus,
      includeEmotion: args.includeEmotion,
      includeFanwork: args.includeFanwork,
      includeProtagonist: args.includeProtagonist === true,
      clothingOverride: args.clothingOverride,
      charTags: isUseCharTags(npc) ? getPortraitCharTags(npc) : null,
      subject: isProtagonist ? 'protagonist' : 'npc',
      protagonistOutfitBaseline: isProtagonist && cfg.wardrobeEnabled ? readProtagonistOutfitBaseline() : '',
      // 立绘模板来自「生图 AI 请求提示词」板块（image:portrait:tags / :natural）；空 = 内置默认
      formatPromptOverride: resolveImagePromptTemplate(cfg.imageGeneration.promptTemplates, 'portrait', 'tags', ''),
      naturalFormatPromptOverride: resolveImagePromptTemplate(cfg.imageGeneration.promptTemplates, 'portrait', 'natural', ''),
    });

    // 4. 调文本 AI
    const th = getTavernHelper();
    if (!th || typeof th.generateRaw !== 'function') return { ok: false, error: '无法访问 generateRaw' };
    const customApi = getCustomApiConfig('imageGeneration');
    let result: string;
    try {
      const r = await withTextAiRetry('imageGeneration', (ctx: TextAiContext) => th.generateRaw({
        should_silence: true,
        generation_id: ctx.generationId,
        user_input: userInput,
        ordered_prompts: [...getJailbreakHeadPrompts(), { role: 'system', content: system }, 'user_input', ...getJailbreakTailPrompts()],
        custom_api: customApi,
      }), { feature: 'portraitPrompt' });
      result = typeof r === 'string' ? r : '';
    } catch (e: any) {
      return { ok: false, error: `生成 prompt 失败：${e?.message || e}` };
    }
    if (!result) return { ok: false, error: '生成 prompt 失败：AI 返回空' };

    // 5. 解析 + 拍平（同人身份 tag 由固化数据直接拼入，不再依赖 AI 输出）
    const obj = parsePromptOutput(result);
    if (!obj) return { ok: false, error: 'AI 输出格式异常，无法解析为图像 prompt' };
    const slice = resolvePromptPresetSlice(ig);
    promptText = assembleFinalPrompt(
      slice.prefix,
      buildPromptTextByMode(obj, ig.promptComposeMode, fanTags, ig.naturalPromptLanguage, ig.fanTagTransferMode),
      slice.suffix,
      ig.promptComposeMode,
    );
    if (!promptText) return { ok: false, error: '组装出的提示词为空' };
    // 负面词走统一切片（含智慧姬抑制：直连时为空串，由智慧姬用其自身负面预设）
    negativePrompt = slice.negative;
  }

  // 通知调用方 prompt 已就绪（用于回填显示框）
  if (args.onPromptReady) {
    try { args.onPromptReady(promptText, negativePrompt); } catch (e) { /* ignore */ }
  }
  // 记录「最近一次」提示词（无论本次生图成败，都在生图前落盘，供下次打开弹窗预填/重新生图）
  if (chatSwitched()) return CHAT_SWITCHED_ABORT; // F8：切卡后不再写别卡档案
  await saveLastPrompt(npc, { promptText, negativePrompt });

  // 5. 生图（档案回调：捕获最终请求快照，含 AQT/UCP/实际 seed）
  let dataUrl: string;
  let genRecord: ImageGenRecord | undefined;
  try {
    dataUrl = await generateImage(ig, promptText, negativePrompt, args.signal, undefined, undefined, (r) => { genRecord = r; });
  } catch (e: any) {
    if (e instanceof ImageGenError) return { ok: false, error: `生图失败：${e.message}` };
    return { ok: false, error: `生图失败：${e?.message || e}` };
  }

  // 6. 落盘
  const upRes = await imageStorage.uploadGeneratedImage(dataUrl, 'portrait', displayName);
  if (!upRes.path) return { ok: false, error: upRes.error ? `立绘保存失败：${upRes.error}` : '立绘保存失败（/api/images/upload）' };
  const path = upRes.path;

  // 7. 写索引
  const ts = Date.now();
  const entry: PortraitEntry = {
    path,
    filename: path.split('/').pop() || '',
    promptText, negativePrompt,
    composeMode: ig.promptComposeMode,
    preset: args.preset,
    theme: args.theme,
    extraPrompt: args.extraPrompt,
    width: ig.apiFormat === 'openai' ? 0 : ig.apiFormat === 'comfyui' ? ig.comfyui.width : ig.novelai.width,
    height: ig.apiFormat === 'openai' ? 0 : ig.apiFormat === 'comfyui' ? ig.comfyui.height : ig.novelai.height,
    createdAt: ts,
    // 情绪标签跟随本次生图的「包含情绪」开关（主题·情绪特写恒为开；自动生图经 resolvePortraitAutoArgs 同源取偏好）
    ...snapshotPortraitTags(npc, { includeEmotion: args.theme === 'emotion' ? true : args.includeEmotion }),
    ...(genRecord ? { gen: genRecord } : {}),
  };
  if (chatSwitched()) return CHAT_SWITCHED_ABORT; // F8：生图/上传期间切卡 → 不写别卡档案
  const saved = await savePortraitIndex(npc, entry, {
    addToRandomPool: cfg.portraitAutoAddToRandomPool,
  });
  if (!saved) return { ok: false, error: '立绘保存失败（存储未就绪）' };
  // every-turn 自动更新：强制替换 current 为本次新图（图库已累积）
  if (args.forceSetCurrent) {
    if (chatSwitched()) return CHAT_SWITCHED_ABORT; // F8：置 current 前再核一次
    await setCurrentPortrait(npc, path);
  }
  // 成就打点：立绘生成成功（切卡中不再打点，避免记到别卡）
  if (!chatSwitched()) try {
    const _lew = isNsfwPlayActive();
    (window as any).__ubEmitAchievement?.('portrait_generated', {
      charName: npc,
      generator: cfg.portraitImageGen.apiFormat,
      theme: args.theme,
      preset: args.preset,
      isRegen: !!args.prebuiltPrompt,
      automatic: !!args.automatic,
      whileLewd: _lew ? 1 : 0,
      afterFailure: !!args.afterFailure,
      clothingReplace: args.clothingOverride ? 1 : 0,
      clothingReplaceMode: args.clothingOverride?.mode || '',
    });
  } catch (_e) { /* ignore */ }
  return { ok: true };
}

// —— 从本地文件导入立绘（不调 AI，直接落盘 + 入库）——
export async function importLocalPortrait(npc: string, file: File): Promise<{ ok: boolean; error?: string }> {
  const cfg = getConfig();
  if (!cfg.portraitEnabled) return { ok: false, error: '立绘功能未开启' };
  if (!file.type.startsWith('image/')) return { ok: false, error: '请选择图片文件' };
  if (file.size > 20 * 1024 * 1024) return { ok: false, error: '图片过大（>20MB），请压缩后再导入' };

  // 1. 读为 dataURL
  let dataUrl: string;
  try {
    dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('读取文件失败'));
      r.readAsDataURL(file);
    });
  } catch (e: any) {
    return { ok: false, error: e?.message || '读取文件失败' };
  }

  // 2. 落盘到 user/images/<角色卡名>/（主角用显示名，避免文件名出现哨兵 key）
  const upRes = await imageStorage.uploadGeneratedImage(dataUrl, 'portrait', isProtagonistKey(npc) ? readProtagonistDisplayName() : npc);
  if (!upRes.path) return { ok: false, error: upRes.error ? `保存失败：${upRes.error}` : '保存失败' };
  const path = upRes.path;

  // 3. 写索引（无 AI prompt 元数据，标注为本地导入）
  const ts = Date.now();
  const entry: PortraitEntry = {
    path,
    filename: path.split('/').pop() || file.name,
    promptText: '[本地导入]',
    negativePrompt: '',
    composeMode: 'none',
    preset: 'default',
    theme: 'default',
    extraPrompt: '',
    width: 0,
    height: 0,
    createdAt: ts,
    ...snapshotPortraitTags(npc),
  };
  const saved = await savePortraitIndex(npc, entry);
  if (!saved) return { ok: false, error: '立绘保存失败（存储未就绪）' };
  // 成就打点：本地导入立绘
  try { (window as any).__ubEmitAchievement?.('portrait_local_imported', { charName: npc }); } catch (_e) { /* ignore */ }
  return { ok: true };
}

// —— init / refresh / stop ——
// 判轮只有两个来源（都不看正文 hash）：
//   · 数据库模式 every-turn＝「在场角色表内容变化」本身（index.ts 的脏检查触发队列）；
//   · 台账接管 every-turn＝台账「在场角色表本轮落账完成」信号（token 判轮）。
// 失败不落跨轮标记：下一轮触发自然重试。missing-only 仍用中央入场守卫 + 本次在场期间
// 不重试标记（只补缺，不重复扣费）。队列严格串行，避免并发争抢文本 AI / 生图资源。
const _autoAttempted = new Set<string>();

/** 仅供回归测试观测「生图尝试次数」的计数器（移除旧「正在为…立绘」toast 后的替代钩子）。 */
let _portraitAttemptCount = 0;
export function _getPortraitAttemptCountForTests(): number {
  return _portraitAttemptCount;
}
let _autoFillRunning = false;
let _autoFillRequested = false;
/** 数据库 every-turn 的内容型入场基线：切聊天后第一次看到的**非空**在场表只当基线、不生成。
 *  `_portraitEntryMarker`＝入场时的最后一条消息 id，用来区分「加载完成快照」和「入场后真实新轮」
 *  （后者消息 id 已前进）。拿不到 id 时（-1）入场首个非空快照一律按基线处理。 */
let _portraitEntryChatKey = '';
let _portraitEntryMarker = -1;
let _portraitEntryBaselinePending = false;
/** 台账接管 + every-turn：唯一触发源＝台账「在场角色表本轮落账完成」信号
 *  （订阅在应用启动时由 core/ledger-takeover.bindLedgerPresenceSignal 完成，本模块只消费）。
 *  `_pending` 只保留最后一次（同轮重复/多窗口重复信号合并）；`_last` 用于跨窗口重复到达去重。 */
let _pendingLedgerPresenceToken: string | null = null;
let _lastLedgerPresenceToken: string | null = null;

/** 当前聊天最后一条消息的 message_id（入场基线判据）；拿不到返回 -1。 */
function getLastMessageIdSafe(): number {
  try {
    const th = getTavernHelper();
    if (th && typeof th.getLastMessageId === 'function') {
      const id = th.getLastMessageId();
      return typeof id === 'number' && Number.isFinite(id) ? id : -1;
    }
  } catch (_e) { /* ignore */ }
  return -1;
}

/** 清空/重置内容型入场基线。chatKey 传当前值＝「基线已就位」（强制重试）；缺省＝下次进卡重新建基线。 */
function resetPortraitEntryBaseline(chatKey = ''): void {
  _portraitEntryChatKey = chatKey;
  _portraitEntryMarker = -1;
  _portraitEntryBaselinePending = false;
}

function getPresentCharacterNames(): string[] {
  const sheet = getSheetByName('在场角色表');
  if (!sheet?.content?.length) return [];
  const nameCol = sheet.content[0]?.indexOf('姓名') ?? -1;
  if (nameCol < 0) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (let row = 1; row < sheet.content.length; row++) {
    const npc = String(sheet.content[row]?.[nameCol] || '').trim();
    if (!npc || seen.has(npc)) continue;
    seen.add(npc);
    result.push(npc);
  }
  return result;
}

async function runPortraitAutoGenerationQueue(): Promise<void> {
  if (_autoFillRunning) return;
  _autoFillRunning = true;
  try {
    while (_autoFillRequested) {
      _autoFillRequested = false;
      const cfg = getConfig();
      if (!cfg.portraitEnabled || cfg.portraitAutoUpdateMode === 'off') return;

      const chatKey = getCurrentStoryChatKey();
      if (!chatKey || chatKey.startsWith('unknown-')) return;
      const ledgerEveryTurn = isLedgerTakeover() && cfg.portraitAutoUpdateMode === 'every-turn';
      if (ledgerEveryTurn) {
        // 台账 every-turn：只认「在场角色表本轮落账完成」信号。
        // 没有待消费令牌 ⇒ 本次请求来自旧入口（卡入口/配置变更/表格脏检查/防抖），直接退出——
        // 台账下这些入口全部失效，绝不会因其它表的更新或重注入多跑一批。
        const token = _pendingLedgerPresenceToken;
        _pendingLedgerPresenceToken = null;
        if (!token) return;
        if (token === _lastLedgerPresenceToken) return; // 同一信号多窗口到达
        _lastLedgerPresenceToken = token;
        // 台账刚落账：状态栏表缓存最多可能落后一个 300ms tick；本轮立绘必须读刚落账的最新一行。
        invalidateCache();
      } else if (cfg.portraitAutoUpdateMode === 'missing-only' && consumeAutoGenEntrySkip('portrait')) {
        // missing-only 仍用中央入场守卫：每次进卡只补扫一次（避免载入卡时全量补图）。
        // every-turn 走下面的内容型入场基线，不再依赖中央守卫。
        _autoAttempted.clear();
        return;
      }

      const presentNames = getPresentCharacterNames();
      // 尝试标记只服务 missing-only：every-turn 由触发源判轮，不需要这份集合。
      if (cfg.portraitAutoUpdateMode === 'missing-only') {
        const presentSet = new Set(presentNames);
        for (const npc of Array.from(_autoAttempted)) {
          if (!presentSet.has(npc)) _autoAttempted.delete(npc);
        }
      }

      // 数据库 every-turn 的内容型入场基线：切聊天后第一个**非空**在场表快照只当基线、不生成；
      // 若此时最后一条消息 id 已前进（入场后真的产生了新回复），说明这是真实一轮，照常生成。
      // 依据：DB 插件 CHAT_CHANGED 先发空表通知、延迟 1200ms 再发加载完成通知（8.9.x / 龙血玄黄 1.x 同）。
      if (!ledgerEveryTurn && cfg.portraitAutoUpdateMode === 'every-turn') {
        if (chatKey !== _portraitEntryChatKey) {
          _portraitEntryChatKey = chatKey;
          _portraitEntryMarker = getLastMessageIdSafe();
          _portraitEntryBaselinePending = true;
        }
        if (_portraitEntryBaselinePending) {
          if (presentNames.length === 0) return; // 空表（清空通知/新聊天）：继续等第一个非空快照
          const nowMessageId = getLastMessageIdSafe();
          const newRoundSinceEntry = _portraitEntryMarker >= 0 && nowMessageId > _portraitEntryMarker;
          _portraitEntryBaselinePending = false;
          if (!newRoundSinceEntry) return; // 入场加载完成快照：只当基线，不生成
        }
      }

      for (const npc of presentNames) {
        const latestCfg = getConfig();
        if (!latestCfg.portraitEnabled || latestCfg.portraitAutoUpdateMode === 'off') return;
        // F8：切卡立即停手——不再为新卡继续生成/写入（与 generatePortrait 内的写入守卫双保险）
        if (getCurrentStoryChatKey() !== chatKey) return;
        // 只有 missing-only 记「本次在场期间」尝试标记；every-turn 由触发源判轮，失败下一轮再试。
        const trackAttempts = latestCfg.portraitAutoUpdateMode === 'missing-only';
        if (trackAttempts && _autoAttempted.has(npc)) continue;
        // missing-only：跳过已有立绘者；every-turn：无条件重生成
        if (latestCfg.portraitAutoUpdateMode === 'missing-only') {
          if ((getPortraitIndex(npc)?.portraits.length || 0) > 0) continue;
        }
        // 前一名角色生图可能耗时较长；轮到当前角色时重新确认其仍在场，
        // 避免使用队列开始时的旧名单为已经离场的角色继续扣费。
        if (!getPresentCharacterNames().includes(npc)) continue;

        // missing-only 请求前即标记：失败时本次在场期间不再重试（防重复扣费）。
        if (trackAttempts) _autoAttempted.add(npc);
        // 进行中提示由统一 AI 活动注册表负责（自动立绘也不再单独弹 toast）
        const result = await generatePortrait(npc, {
          ...resolvePortraitAutoArgs(latestCfg),
          // 同人标记按角色：自动生图逐角色覆盖全局偏好的同人开关（全局字段已废弃，不再消费）
          includeFanwork: isPortraitFanwork(npc),
          automatic: true,
          forceSetCurrent: latestCfg.portraitAutoUpdateMode === 'every-turn',
        });
        if (result.ok) {
          // missing-only 的成功标记保留（本次在场期间不再补扫）；every-turn 不落标记。
          toastr?.success?.(`已为「${npc}」${latestCfg.portraitAutoUpdateMode === 'every-turn' ? '更新' : '生成'}立绘`, '立绘');
          // L18①：派发已下沉到写路径（savePortraitIndex/setCurrentPortrait），此处不再重复派发
        } else {
          const retryNote = latestCfg.portraitAutoUpdateMode === 'every-turn'
            ? (ledgerEveryTurn ? '；下一轮落账后再试' : '；下一轮表格更新后再试')
            : '；本次在场期间不再重试';
          console.warn(`[立绘] ${latestCfg.portraitAutoUpdateMode === 'every-turn' ? '更新' : '自动生成'}「${npc}」失败${retryNote}:`, result.error || '未知错误');
          toastr?.warning?.(`「${npc}」${latestCfg.portraitAutoUpdateMode === 'every-turn' ? '更新' : '生成'}失败：${result.error || '未知错误'}${retryNote}`, '立绘');
        }
      }
    }
  } finally {
    _autoFillRunning = false;
    // 运行中若又收到表格更新请求，继续处理最新在场名单。
    if (_autoFillRequested) void runPortraitAutoGenerationQueue();
  }
}

/** 安排一次自动补齐扫描。resetAttempts=true 清除 missing-only 的尝试标记并跳过入场基线，
 *  用于「立即重试当前在场角色」（测试/手动强制路径）。
 *  off→非 off 的开关开启路径不传 resetAttempts：入场首个非空快照仍按基线处理。
 *
 *  【台账接管 + every-turn】本函数**不产生任何生成**——该组合的唯一入口是
 *  requestLedgerPresencePortraitUpdate（在场角色表本轮落账完成信号）。 */
export function requestPortraitAutoGeneration(resetAttempts = false): void {
  // 重填模式：立绘自动补齐的唯一入口，整条拦下（提示词 AI 请求 + 生图 + 立绘存储写入）。
  // 本函数会被卡入口（initPortraitSystem/loadAllPortraitIndices）直接调用，不只走
  // runReadyStoryAutomation，故闸门必须落在这里；否则进卡首帧仍会触发生成。
  // 关闭重填模式后由 index.ts 恢复链的 requestRefresh → runReadyStoryAutomation 补跑。
  if (isRefillMode()) return;
  const cfg = getConfig();
  if (!cfg.portraitEnabled || cfg.portraitAutoUpdateMode === 'off') return;
  if (isLedgerTakeover() && cfg.portraitAutoUpdateMode === 'every-turn') return; // 只认落账信号
  if (resetAttempts) {
    _autoAttempted.clear();
    // 强制重试：入场基线标记为「已就位」，下一次扫描立即按真实轮次跑。
    resetPortraitEntryBaseline(getCurrentStoryChatKey());
  }
  _autoFillRequested = true;
  void runPortraitAutoGenerationQueue();
}

/** 台账信号入口：接收「在场角色表本轮落账完成」→ 触发一次在场所角色立绘更新。
 *  台账接管 + every-turn 下的唯一触发源；其它模式/非台账环境直接忽略（零副作用）。 */
export function requestLedgerPresencePortraitUpdate(token: string): void {
  if (isRefillMode()) return;
  const cfg = getConfig();
  if (!cfg.portraitEnabled || cfg.portraitAutoUpdateMode !== 'every-turn') return;
  if (!isLedgerTakeover()) return;
  const t = String(token || '');
  // 同一信号经 自身/parent/top 多窗口到达：待消费与已消费两侧都拦一次。
  if (t && (t === _pendingLedgerPresenceToken || t === _lastLedgerPresenceToken)) return;
  _pendingLedgerPresenceToken = t || '_';
  _autoFillRequested = true;
  void runPortraitAutoGenerationQueue();
}

/** 关闭自动补齐时停止追加任务；正在进行的单张请求自然收尾，不再开始下一张。 */
export function stopPortraitAutoGeneration(): void {
  _autoFillRequested = false;
  _autoAttempted.clear();
  resetPortraitEntryBaseline();
  _pendingLedgerPresenceToken = null;
}

// U34：800ms 尾沿防抖改走规范库（与 map-system.refreshMapDebounced 同款形态）
export const refreshPortraitDebounced = debounce(async () => {
  await loadAllPortraitIndices();
  requestPortraitAutoGeneration();
}, 800);
export async function initPortraitSystem(): Promise<void> {
  const cfg = getConfig();
  if (!cfg.portraitEnabled) return;
  await loadAllPortraitIndices();
  requestPortraitAutoGeneration();
}
export function stopPortraitSystem(): void {
  refreshPortraitDebounced.cancel(); // U34：停机取消在途刷新（原手写句柄的主动取消点）
  stopPortraitAutoGeneration();
  _portraitAttemptCount = 0;
}
