import { readStoryClockRaw } from './calendar-core';
import { stripOuterFence } from './text-fence';
import { getTavernHelper, getToastr } from './env';
import { UB_EVENT, emitUbEvent } from './events';
import { escapeHtml } from './html-escape';
import { debounce } from './timing';
import { beginMapRefreshTrace, recordMapRefreshTrace } from './map-refresh-trace';
// ===== 地图生成系统（逻辑层） =====
//
// 职责：
//   - MapCache：地图缓存读写（当前聊天 AI 楼层中的增量状态帧）
//   - searchLocationEntries：按地点「-」层级末两段，在角色绑定世界书搜条目名（逐段）或触发关键词（末两段拼串双向子串）命中的条目（排除 __map_）
//   - generateRaw 编排：单阶段 / 两阶段 × 无缓存 / 有缓存（增量）
//   - refreshMap / forceRefreshMap / clearCurrentMapCache / clearAllMapCache
//   - generateNodeMapFromLibrary（库路径生成节点地图）/ navigateToNode（exit 热点导航）
//
// 缓存条目命名：comment = `${MAP_CACHE_PREFIX}json_<地点>` / `${MAP_CACHE_PREFIX}svg_<地点>`
// （JSON 始终缓存；SVG 仅两阶段模式缓存。元数据 storyHash/updatedAt 放进 JSON 自身字段。）

import { getConfig } from './config-store';
import { getCurrentStoryChatKey } from './story-floor-store';
import { looseJsonParse, parseAiJsonObject } from './ai-parse';
import { getCellByHeader, getSheetByName, getAutoCardAPI } from './data-manager';
import { getCustomApiConfig, validateCustomApiConfig, withTextAiRetry, isAiAbortError, type TextAiContext } from './api-config';
import { showEnvNotReady, showApiConfigError, showGenOutputError, genFailureHead } from './notify-presets';
import { type MapStyle } from './constants';
import { consumeAutoGenEntrySkip } from './auto-gen-entry-guard';
import {
  clearMapNodeByLocation, clearMapNodeByNodeId, clearAllMapNodes,
  readTreeIndex, writeTreeIndex, readMapNode, writeMapNodeAndIndex,
  markNodeGenerated, markNodeTextOnly, resolveExits,
  gatherParentContext, gatherChildContext, gatherNodeNeighborhood,
  buildExploreLogEntry, planExploreRecordUpdate, applyExploreRecordPlan, readExploreRecordView,
  deriveNodeId, normalizeLocationPath, parseLocationHierarchy,
  deriveFullPathFromIndex,
  listAllNodesForUI, deleteMapNodeByNodeId,
  collectDescendantNodeIds,
  toggleFavorite, isFavorite,
  renameNode, addChildNode, updateNodeExplorationDesc,
  moveMapNodeInStorage,
  type MapNode, type ExplorationDesc, type ExploreLogEntry,
  type MapLibNodeInfo, type MapExit, type MapTreeIndex,
} from './map-tree-store';
import { stripWithContextConfig } from './context-strip';
import { resolveMapLocationForRefresh } from './map-location-decision';
import { removeLocationAlias, addLocationAliasToIndex } from './map-location-identity';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 07 待修：同上（四元环中的 map-system → map-scene-generation：调用场景图生成）
import { generateMapScene, type MapSceneGenerationResult } from './map-scene-generation';
import { clearAllMapSceneImages, clearMapSceneImage, readMapSceneImage } from './map-scene-store';
import {
  inspectMapNodeMerge as inspectMapNodeMergePlan,
  mapMergeService,
  type MapMergeInspection,
  type MapMergeResult,
  type MapMergeSelection,
} from './map-merge';
import { buildMapSceneInputFromNode, shouldAutoGenerateMapSceneImage, type MapSceneNodeIdentity } from './map-scene-integration';
import { wbEntryName, wbEntryNameContainsAny, wbEntryKeysMatchAny } from './worldbook-entry';
import { tryEvalWorldbookEjs } from './ejs-bridge';
import {
  buildMapPrompt,
  MAP_INPUT_SECTIONS,
  buildLargeMapPrompt,
  LARGE_MAP_INPUT_SECTIONS,
  buildMapTextUpdatePrompt,
  computeMapSize,
} from './map-prompts';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import {
  renderLocalSVG,
  generateDefaultMapSVG,
  generatingMapSVG,
  applyAIPositions,
  renderFullMapSVG,
  namespaceSvgIds,
  updateMapDisplay,
  DEFAULT_MAP_SIZE,
  type MapStructure,
  type MapCharacter,
  type MapRole,
} from './map-renderer';

// ─────────────────────────────────────────────────────────────
// 运行时状态
// ─────────────────────────────────────────────────────────────
const MapState = {
  isGenerating: false,
  lastLocation: '' as string,
  lastCanonicalNodeId: '' as string,
  lastCanonicalPath: '' as string,
  lastStoryHash: '' as string,
  /** 最近一次渲染时间戳，用于去抖 */
  lastRenderAt: 0,
};

/** 地图生成锁只读查询（供地图库等入口做门禁，不暴露 MapState 本体）。 */
export function isMapGenerating(): boolean {
  return MapState.isGenerating;
}

// 场景图与 SVG 地图使用独立的任务锁：场景图等待文本/图片 API 时，不阻塞 SVG 刷新。
const _mapSceneTasks = new Map<string, Promise<MapSceneGenerationResult>>();

function emitMapSceneState(nodeId: string, status: string, result?: MapSceneGenerationResult): void {
  emitUbEvent(UB_EVENT.mapSceneState, { nodeId, status, result });
}

function buildMapSceneNodeIdentity(
  nodeId: string,
  canonicalPath: string,
  fallbackLabel: string,
  sourceMapHash: string,
): MapSceneNodeIdentity {
  const parts = String(canonicalPath || fallbackLabel).split('-').filter(Boolean);
  return {
    nodeId,
    canonicalPath: canonicalPath || fallbackLabel,
    locationLabel: parts[parts.length - 1] || fallbackLabel,
    sourceMapHash,
  };
}

async function runMapSceneTask(
  node: MapNode,
  identity: MapSceneNodeIdentity,
  extraPrompt?: string,
): Promise<MapSceneGenerationResult> {
  const existingTask = _mapSceneTasks.get(identity.nodeId);
  if (existingTask) return existingTask;
  const input = buildMapSceneInputFromNode(node, identity, extraPrompt);
  let task!: Promise<MapSceneGenerationResult>;
  task = (async () => {
    emitMapSceneState(identity.nodeId, 'generating');
    const label = identity.locationLabel || '当前地点';
    // 提示词阶段由统一 AI 活动通知；生图阶段由场景状态（generating/ready/failed）与下述成功/失败通知承载
    try {
      const result = await generateMapScene(input);
      // 聊天归属守卫：切走后场景图未写入（图已清理），静默收口，不在新聊天弹错误。
      if (!result.ok && result.switched) return result;
      emitMapSceneState(identity.nodeId, result.ok ? 'ready' : 'failed', result);
      if (result.ok) {
        getToastr()?.success(`「${label}」场景图生成完成`, '地图');
      } else if (!isAiAbortError(result.error)) {
        getToastr()?.error(`场景图生成失败：${result.error || '未知错误'}`, '地图');
      }
      return result;
    } catch (error: any) {
      const result: MapSceneGenerationResult = { ok: false, error: error?.message || String(error) };
      emitMapSceneState(identity.nodeId, 'failed', result);
      if (!isAiAbortError(result.error)) getToastr()?.error(`场景图生成失败：${result.error}`, '地图');
      return result;
    } finally {
      if (_mapSceneTasks.get(identity.nodeId) === task) _mapSceneTasks.delete(identity.nodeId);
    }
  })();
  _mapSceneTasks.set(identity.nodeId, task);
  return task;
}

async function scheduleFirstMapSceneGeneration(
  node: MapNode,
  identity: MapSceneNodeIdentity,
): Promise<void> {
  if (!getConfig().mapAutoGenSceneImage) return; // 用户未开启自动跟随 → 跳过，仅手动点场景图按钮可生成
  const record = await readMapSceneImage(identity.nodeId);
  if (!shouldAutoGenerateMapSceneImage(record)) return;
  void runMapSceneTask(node, identity);
}

/** 当前节点的场景图手动刷新；只触发场景图，不触碰 SVG 地图记录。 */
export async function forceRefreshMapScene(extraPrompt?: string): Promise<MapSceneGenerationResult> {
  const display = await resolveCurrentDisplayNode();
  if (display) {
    const node = await readMapNode(display.nodeId);
    if (!node || !hasMapContent(node)) return { ok: false, error: '当前显示地点还没有成功生成 SVG 地图' };
    const treeNode = display.index.nodes[display.nodeId];
    const sourceMapHash = treeNode?.lastStoryHash || hashText(JSON.stringify(node));
    const nodeIdentity = buildMapSceneNodeIdentity(
      display.nodeId,
      display.canonicalPath || display.label,
      display.label,
      sourceMapHash,
    );
    return runMapSceneTask(node, nodeIdentity, extraPrompt);
  }
  // 无显示节点（折叠态）→ 按数据库当前地点解析（保持旧行为）
  const location = getCurrentLocation();
  if (!location) return { ok: false, error: '当前没有可生成场景图的地点' };
  const config = getConfig();
  const identity = await resolveMapLocationForRefresh(
    location,
    config.mapLocationConflictStrategy || 'always-ask',
    () => getCurrentLocation() === location,
    () => { /* map identity confirmation is handled by the existing map refresh path */ },
  );
  if (identity.status === 'pending') return { ok: false, error: '正在等待地点归属确认' };
  const node = await readMapNode(identity.nodeId);
  if (!node || !hasMapContent(node)) return { ok: false, error: '当前地点还没有成功生成 SVG 地图' };
  const treeNode = identity.index.nodes[identity.nodeId];
  const sourceMapHash = treeNode?.lastStoryHash || hashText(JSON.stringify(node));
  const nodeIdentity = buildMapSceneNodeIdentity(
    identity.nodeId,
    identity.canonicalPath || location,
    location,
    sourceMapHash,
  );
  return runMapSceneTask(node, nodeIdentity, extraPrompt);
}

/** 为地图库中的指定节点生成/重新生成场景图；目标始终由 nodeId 决定，不依赖当前剧情地点。 */
export async function generateMapSceneForLibraryNode(
  nodeId: string,
  extraPrompt?: string,
): Promise<MapSceneGenerationResult> {
  if (!getConfig().mapEnabled) return { ok: false, error: '地图功能未启用' };
  const index = await readTreeIndex();
  const treeNode = index.nodes[nodeId];
  if (!treeNode) return { ok: false, error: '未找到该地点' };
  const node = await readMapNode(nodeId);
  if (!node || !hasMapContent(node)) return { ok: false, error: '该地点还没有生成 SVG 地图' };
  const canonicalPath = deriveFullPathFromIndex(index, nodeId) || treeNode.name;
  const sourceMapHash = treeNode.lastStoryHash || hashText(JSON.stringify(node));
  const identity = buildMapSceneNodeIdentity(nodeId, canonicalPath, treeNode.name, sourceMapHash);
  return runMapSceneTask(node, identity, extraPrompt);
}

/** 解析主视图当前显示节点（DOM 即真相 → 上次 SVG 刷新簿记）；无则返回 null */
async function resolveCurrentDisplayNode(): Promise<{ nodeId: string; index: MapTreeIndex; canonicalPath: string; label: string } | null> {
  const index = await readTreeIndex();
  const displayNodeId = getCurrentDisplayNodeId();
  const nodeId = (displayNodeId && index.nodes[displayNodeId])
    ? displayNodeId
    : MapState.lastCanonicalNodeId;
  if (nodeId && index.nodes[nodeId]) {
    const canonicalPath = deriveFullPathFromIndex(index, nodeId);
    const label = canonicalPath.split('-').filter(Boolean).pop() || canonicalPath || '当前地点';
    return { nodeId, index, canonicalPath, label };
  }
  return null;
}

export async function clearCurrentMapScene(
  confirm?: (message: string) => boolean | Promise<boolean>,
): Promise<boolean> {
  const display = await resolveCurrentDisplayNode();
  if (display) {
    if (!await (confirm ?? window.confirm)(`确定要清除「${display.canonicalPath || display.label}」的场景图吗？`)) return false;
    const ok = await clearMapSceneImage(display.nodeId);
    if (ok) emitMapSceneState(display.nodeId, 'cleared');
    return ok;
  }
  // 折叠态回退旧行为（按数据库当前地点）
  const location = getCurrentLocation();
  if (!location) return false;
  if (!await (confirm ?? window.confirm)(`确定要清除「${location}」的场景图吗？`)) return false;
  const config = getConfig();
  const identity = await resolveMapLocationForRefresh(
    location,
    config.mapLocationConflictStrategy || 'always-ask',
    () => getCurrentLocation() === location,
    () => { /* existing map flow owns confirmation re-entry */ },
  );
  if (identity.status === 'pending') return false;
  const ok = await clearMapSceneImage(identity.nodeId);
  if (ok) emitMapSceneState(identity.nodeId, 'cleared');
  return ok;
}

export async function clearAllMapSceneCache(
  confirm?: (message: string) => boolean | Promise<boolean>,
): Promise<{ cleared: number; failed: number }> {
  if (!await (confirm ?? window.confirm)('确定要清空所有地点的场景图吗？')) {
    return { cleared: 0, failed: 0 };
  }
  const result = await clearAllMapSceneImages();
  emitUbEvent(UB_EVENT.mapSceneState, { status: 'cleared-all', result });
  return result;
}

/** 地图弹窗只读当前节点的场景图记录；不会因为打开弹窗而自动补生成旧地图。 */
export async function getCurrentMapSceneImage(): Promise<{ nodeId: string; record: Awaited<ReturnType<typeof readMapSceneImage>> } | null> {
  const display = await resolveCurrentDisplayNode();
  if (display) {
    return { nodeId: display.nodeId, record: await readMapSceneImage(display.nodeId) };
  }
  const location = getCurrentLocation();
  if (!location) return null;
  const { segments } = parseLocationHierarchy(location);
  if (segments.length === 0) return null;
  const fallbackNodeId = deriveNodeId(segments.join('-'));
  return { nodeId: fallbackNodeId, record: await readMapSceneImage(fallbackNodeId) };
}

// ─────────────────────────────────────────────────────────────
// 框架对象获取
// ─────────────────────────────────────────────────────────────


/** 取角色卡绑定世界书名（primary 优先，其次 additional）。
 *  无角色世界书时返回 null——不再回退 getOrCreateChatWorldbook，
 *  那会为每张新角色卡自动新建一本聊天世界书。 */
export async function getStorageWorldbookName(): Promise<string | null> {
  const th = getTavernHelper();
  if (!th) return null;
  try {
    if (typeof th.getCharWorldbookNames === 'function') {
      const charWbs = th.getCharWorldbookNames('current');
      if (charWbs) {
        const allNames: string[] = th.getWorldbookNames ? th.getWorldbookNames() : [];
        if (charWbs.primary && allNames.includes(charWbs.primary)) return charWbs.primary;
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 当前地点 & 剧情上下文
// ─────────────────────────────────────────────────────────────
function getCurrentLocation(): string {
  try {
    const v = getCellByHeader('全局数据表', 1, '当前详细地点');
    if (v && String(v).trim()) return String(v).trim();
    // 兼容字段名差异
    const v2 = getCellByHeader('全局数据表', 1, '当前位置');
    if (v2 && String(v2).trim()) return String(v2).trim();
  } catch (e) { /* ignore */ }
  return '';
}

export function getRecentStoryContext(maxTurns: number): string {
  const api = getAutoCardAPI();
  try {
    if (api && typeof api.getStoryContext === 'function') {
      const ctx = api.getStoryContext(maxTurns);
      if (ctx) return String(ctx);
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof parent !== 'undefined' && (parent as any).SillyTavern && (parent as any).SillyTavern.chat) {
      const chat = (parent as any).SillyTavern.chat as any[];
      const ai: string[] = [];
      let turns = 0;
      for (let i = chat.length - 1; i >= 0 && turns < maxTurns; i--) {
        const m = chat[i];
        if (m && !m.is_user && m.mes) { ai.unshift(m.mes); turns++; }
      }
      return ai.join('\n\n');
    }
  } catch (e) { /* ignore */ }
  return '';
}

/** 资料块上下文：最近 N 层 AI 回复，过「上下文标签剥离」设置。三段式 AI 请求的资料块正文段专用。 */
export function getAiReplyContext(maxTurns: number): string {
  return stripWithContextConfig(getCleanChatHistory(maxTurns || 0));
}

/**
 * 获取纯净聊天历史（仅 AI 消息，含隐藏楼层，不含世界书深度条目、不含用户消息）。
 * 优先使用酒馆助手框架接口 getChatMessages（与 generateRaw 同源，iframe 内稳定可用，
 * 不依赖跨域访问 parent.SillyTavern.chat），避免 'chat_history' 占位符注入的世界书条目。
 * 回退：直接访问 SillyTavern.chat 原始数组。
 */
export function getCleanChatHistory(maxTurns: number): string {
  const th = getTavernHelper();
  if (th && typeof th.getChatMessages === 'function' && typeof th.getLastMessageId === 'function') {
    try {
      const lastId = th.getLastMessageId();
      if (typeof lastId === 'number' && lastId >= 0) {
        const startId = Math.max(0, lastId - maxTurns + 1);
        const range = `${startId}-${lastId}`;
        const messages = th.getChatMessages(range, {
          role: 'assistant',
          hide_state: 'all',
          include_swipes: false,
        }) as any[];
        if (Array.isArray(messages) && messages.length > 0) {
          const lines: string[] = [];
          let turns = 0;
          for (let i = messages.length - 1; i >= 0 && turns < maxTurns; i--) {
            const m = messages[i];
            if (!m || !m.message) continue;
            lines.unshift(`AI：${String(m.message).trim()}`);
            turns++;
          }
          if (lines.length > 0) return lines.join('\n\n');
        }
      }
    } catch (e) {
      console.warn('[地图] getChatMessages 调用失败，回退到 SillyTavern.chat:', e);
    }
  }
  try {
    const chatObj = (typeof parent !== 'undefined' && (parent as any).SillyTavern && (parent as any).SillyTavern.chat)
      ? (parent as any).SillyTavern.chat as any[]
      : ((window as any).SillyTavern && (window as any).SillyTavern.chat)
        ? (window as any).SillyTavern.chat as any[]
        : null;
    if (!chatObj || !Array.isArray(chatObj)) return '';
    const lines: string[] = [];
    let turns = 0;
    for (let i = chatObj.length - 1; i >= 0 && turns < maxTurns; i--) {
      const m = chatObj[i];
      if (!m || !m.mes) continue;
      if (m.is_user) continue;
      if (m.is_system || m.extra?.api === 'nomes') continue;
      lines.unshift(`AI：${String(m.mes).trim()}`);
      turns++;
    }
    return lines.join('\n\n');
  } catch (e) { /* ignore */ }
  return '';
}

export function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ─────────────────────────────────────────────────────────────
// 缓存键 / 大类（仅认半角 - 与全角 －）
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// 世界书条目搜索（排除缓存条目）
// ─────────────────────────────────────────────────────────────
async function searchLocationEntries(location: string, maxEntries: number): Promise<{ comment: string; content: string }[]> {
  const th = getTavernHelper();
  // 取「-」层级的末两段：名字搜索按末两段逐段子串，关键词搜索按末两段拼串做双向子串。
  // 单节点（大地图，如 "A小区"）末两段即其自身，拼串也是自身 → 名字与关键词都用它，自动统一。
  const last2 = parseLocationHierarchy(location).segments.slice(-2);
  if (!th || last2.length === 0) return [];
  const nameTerms = last2;
  const keyTerm = last2.join('-');
  const matched: { comment: string; content: string }[] = [];
  const seenComments = new Set<string>();
  try {
    const charWbs = th.getCharWorldbookNames('current');
    const wbs: string[] = [];
    if (charWbs) {
      if (charWbs.primary) wbs.push(charWbs.primary);
      if (Array.isArray(charWbs.additional)) wbs.push(...charWbs.additional);
    }
    for (const wbName of wbs) {
      try {
        const entries = await th.getWorldbook(wbName);
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
          const comment = wbEntryName(entry);
          // 排除本功能自写的所有条目（UBS-地图- 前缀 / 旧版 __map_tree_index / __map_node_ / __map_large_ / __map_cache_）
          if (!comment || comment.startsWith('UBS-地图-') || comment.startsWith('__map_')) continue;
          if (seenComments.has(comment)) continue;
          // 条目名含末两段任一段，或触发关键词与末两段拼串双向子串命中。
          const nameHit = wbEntryNameContainsAny(entry, nameTerms);
          const keyHit = keyTerm !== '' && wbEntryKeysMatchAny(entry, [keyTerm]);
          if (nameHit || keyHit) {
            seenComments.add(comment);
            matched.push({ comment, content: await tryEvalWorldbookEjs(entry.content) });
            if (matched.length >= maxEntries) return matched;
          }
        }
      } catch (e) { /* 单本世界书读取失败跳过 */ }
    }
  } catch (e) {
    console.warn('[地图] 世界书条目搜索失败:', e);
  }
  return matched;
}

// ─────────────────────────────────────────────────────────────
// 角色汇总
// ─────────────────────────────────────────────────────────────
interface GatheredChar { name: string; role: MapRole; detail?: string; }

function gatherCharacters(): GatheredChar[] {
  const out: GatheredChar[] = [];
  const seen = new Set<string>();
  const push = (c: GatheredChar) => {
    const n = c.name.trim();
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push({ ...c, name: n });
  };

  try {
    const protName = getCellByHeader('主角信息表', 1, '姓名');
    if (protName) {
      const near = getCellByHeader('主角信息表', 1, '近况') || '';
      push({ name: String(protName), role: 'protagonist', detail: near || undefined });
    }
  } catch (e) { /* ignore */ }

  // 在场角色表。旧表名只由 data-manager 的一版兼容别名处理。
  try {
    const sheet = getSheetByName('在场角色表');
    if (sheet && Array.isArray(sheet.content)) {
      for (let i = 1; i < sheet.content.length; i++) {
        const name = getCellByHeader('在场角色表', i, '姓名');
        if (!name) continue;
        const status = getCellByHeader('在场角色表', i, '当前状态') || '';
        const emotion = getCellByHeader('在场角色表', i, '情绪') || '';
        const detail = [status, emotion].filter(Boolean).join('；');
        push({ name: String(name), role: 'ally', detail: detail || undefined });
      }
    }
  } catch (e) { /* ignore */ }

  return out;
}

function extractJsonFromResult(result: string): MapStructure | null {
  // 共享解析管线（ai-parse）：平衡片段提取 + 修复链，替代旧贪心正则
  // `\{[\s\S]*\}`（首尾对象间夹散文即失败、无修复能力）。
  const parsed = parseAiJsonObject(result);
  return parsed.value as MapStructure | null;
}

function extractSvgFromResult(result: string): string | null {
  if (!result) return null;
  const m = result.match(/<svg[\s\S]*?<\/svg>/i);
  if (!m) return null;
  return stripOuterFence(m[0]);
}
/** 两阶段增量输出：同时抽 <MAP_JSON> 与 <MAP_SVG> 与 <MAP_DESC> */
function extractIncrFromResult(result: string): { structure: MapStructure | null; svg: string | null; desc: ExplorationDesc | null; exploreSummary: string; exploreNote: string } {
  let structure: MapStructure | null = null;
  let svg: string | null = null;
  let desc: ExplorationDesc | null = null;
  let exploreSummary = '';
  let exploreNote = '';
  if (!result) return { structure, svg, desc, exploreSummary, exploreNote };
  const jsonTag = result.match(/<MAP_JSON>([\s\S]*?)<\/MAP_JSON>/i);
  if (jsonTag) {
    const parsed = looseJsonParse(jsonTag[1]);
    if (parsed.ok && parsed.value && typeof parsed.value === 'object') {
      structure = parsed.value as MapStructure;
    }
  }
  const svgTag = result.match(/<MAP_SVG>([\s\S]*?)<\/MAP_SVG>/i);
  if (svgTag) {
    svg = stripOuterFence(svgTag[1].match(/<svg[\s\S]*?<\/svg>/i)?.[0] || svgTag[1]);
  }
  const descTag = result.match(/<MAP_DESC>([\s\S]*?)<\/MAP_DESC>/i);
  if (descTag) {
    const parsed = looseJsonParse(descTag[1]);
    if (parsed.ok && parsed.value && typeof parsed.value === 'object') {
      const v = parsed.value as Record<string, unknown>;
      desc = {
        summary: String(v.summary || ''),
        items: Array.isArray(v.items) ? v.items.map(String) : [],
        directions: String(v.directions || ''),
      };
      exploreSummary = String(v.exploreSummary || '');
      exploreNote = String(v.exploreNote || '');
    }
  }
  // 退化：标签缺失时尝试整段正则
  if (!structure) structure = extractJsonFromResult(result);
  if (!svg) svg = extractSvgFromResult(result);
  return { structure, svg, desc, exploreSummary, exploreNote };
}

/**
 * 把上一版 structure.exits（含内部 targetNodeId）转成 AI 认识的 targetName 形式：
 * targetNodeId → 树节点短名；节点已删/改名（查不到）视为过时项丢弃。
 * 无有效连接返回 null。
 */
function buildCurrentExitsText(index: MapTreeIndex, exits: MapExit[] | undefined): string | null {
  if (!Array.isArray(exits) || exits.length === 0) return null;
  const list: unknown[] = [];
  for (const e of exits) {
    const targetName = e.targetNodeId ? (index.nodes[e.targetNodeId]?.name || '') : '';
    if (!targetName) continue;
    list.push({ id: e.id, label: e.label, targetName, kind: e.kind, x: e.x, y: e.y });
  }
  return list.length ? JSON.stringify(list) : null;
}

// ─────────────────────────────────────────────────────────────
// AI 调用（generateRaw）
// ─────────────────────────────────────────────────────────────
async function callGenerateRaw(userInput: string, contextCount: number): Promise<string | null> {
  const th = getTavernHelper();
  if (!th || typeof th.generateRaw !== 'function') {
    showEnvNotReady('地图');
    return null;
  }
  // 手动获取纯净聊天历史（不含世界书深度条目），注入到 user_input 中，
  // 避免 'chat_history' 占位符自动注入世界书条目。
  // MANUAL 模式专属：注入前剥离可配置的标签（默认 <image>...</image>），避免污染提示词。
  const cleanHistory = stripWithContextConfig(getCleanChatHistory(contextCount));
  const fullUserInput = cleanHistory
    ? `【剧情上下文】\n${cleanHistory}\n\n${userInput}`
    : userInput;
  try {
    // 网络级重试：按设置决定次数与通知（关闭时仅尝试一次）；鉴权/取消不重试。
    const result = await withTextAiRetry('map', async (ctx: TextAiContext) => {
      const r = await th.generateRaw({
        should_silence: true,
        generation_id: ctx.generationId,
        user_input: fullUserInput,
        ordered_prompts: [
          ...getJailbreakHeadPrompts({ antiCliche: true }),
          'user_input',
          ...getJailbreakTailPrompts(),
        ],
        custom_api: getCustomApiConfig('map'),
      });
      if (typeof r !== 'string' || !r.trim()) throw new Error('AI 返回为空');
      return r;
    }, { feature: 'map' });
    return result;
  } catch (e) {
    console.warn('[地图] generateRaw 调用异常:', e);
    return null;
  }
}

/** 宏替换：仅对用户长按输入的额外提示词生效（地图基础提示词保持不替换，避免改变既有行为）。
 *  对齐大调查 performInvestigation 的 substitudeMacros 用法，让 {{char}}/{{user}} 等宏展开。 */
function expandMacros(text: string): string {
  const th = getTavernHelper() as any;
  if (!th || typeof th.substitudeMacros !== 'function') return text;
  try {
    return th.substitudeMacros(text) as string;
  } catch (_e) {
    return text;
  }
}

// ─────────────────────────────────────────────────────────────
// user_input 组装
// ─────────────────────────────────────────────────────────────
function assembleUserInput(opts: {
  libraryText: string;
  parentDescText: string | null;
  childDescText: string | null;
  currentDescText: string | null;
  currentRecordText: string | null;
  overflowRecordText: string | null;
  recentRecordText: string | null;
  cachedJson: string | null;
  cachedSvg: string | null;
  neighborhoodText: string | null;
  currentExitsText: string | null;
  promptText: string;
  characters: GatheredChar[];
  extraPrompt?: string;
}): string {
  const parts: string[] = [];
  if (opts.libraryText) {
    parts.push(`${MAP_INPUT_SECTIONS.libraryHeader}\n${opts.libraryText}`);

  }
  if (opts.parentDescText) {
    parts.push(`${MAP_INPUT_SECTIONS.parentDescHeader}\n${opts.parentDescText}`);
  }
  if (opts.childDescText) {
    parts.push(`${MAP_INPUT_SECTIONS.childDescHeader}\n${opts.childDescText}`);
  }
  if (opts.currentDescText) {
    parts.push(`${MAP_INPUT_SECTIONS.currentDescHeader}\n${opts.currentDescText}`);
  }
  if (opts.currentRecordText) {
    parts.push(`${MAP_INPUT_SECTIONS.currentRecordHeader}\n${opts.currentRecordText}`);
  }
  if (opts.overflowRecordText) {
    parts.push(`${MAP_INPUT_SECTIONS.overflowRecordHeader}\n${opts.overflowRecordText}`);
  }
  if (opts.recentRecordText) {
    parts.push(`${MAP_INPUT_SECTIONS.recentRecordHeader}\n${opts.recentRecordText}`);
  }
  if (opts.cachedJson) {
    parts.push(`${MAP_INPUT_SECTIONS.cacheJsonHeader}\n${opts.cachedJson}`);
  }
  if (opts.cachedSvg) {
    parts.push(`${MAP_INPUT_SECTIONS.cacheSvgHeader}\n${opts.cachedSvg}`);
  }
  if (opts.neighborhoodText) {
    parts.push(`${MAP_INPUT_SECTIONS.neighborhoodHeader}\n${opts.neighborhoodText}`);
  }
  if (opts.currentExitsText) {
    parts.push(`${MAP_INPUT_SECTIONS.currentExitsHeader}\n${opts.currentExitsText}`);
  }
  if (opts.characters.length) {
    parts.push(MAP_INPUT_SECTIONS.characterHeader + '\n' + JSON.stringify(opts.characters));
  }
  parts.push(opts.promptText);
  // 长按额外提示词：宏展开后追加在末尾（对齐大调查"末尾作为附加约束"，不干扰核心格式指令）
  if (opts.extraPrompt) {
    parts.push(MAP_INPUT_SECTIONS.extraHeader + '\n' + expandMacros(opts.extraPrompt.trim()));
  }
  return parts.join('\n\n');
}

// ─────────────────────────────────────────────────────────────
// 纯文字更新辅助
// ─────────────────────────────────────────────────────────────
/** 节点是否已有可渲染的地图画面（SVG 或房间结构）。 */
function hasMapContent(node: MapNode | null | undefined): boolean {
  if (!node) return false;
  return !!node.svg || (Array.isArray(node.structure?.rooms) && node.structure.rooms.length > 0);
}

/** 把探索记录条目拼成提示词段落（带时间，最多 3 条）。 */
function formatExploreEntries(entries: ExploreLogEntry[] | null | undefined): string | null {
  const lines = (entries || [])
    .filter(entry => String(entry?.note || '').trim())
    .map(entry => `[${entry.time || '未知时间'}] ${String(entry.note).trim()}`);
  return lines.length ? lines.join('\n') : null;
}

/** 无地图的纯文字节点占位：显示占位图 + 状态，并填充地点信息抽屉。 */
function renderTextOnlyPlaceholder(
  container: HTMLElement,
  nodeId: string,
  location: string,
  node: MapNode | null | undefined,
  statusText: string,
): void {
  const target = getSVGTarget() || container;
  target.innerHTML = generateDefaultMapSVG(location);
  clearRealMapMark(target);
  markDisplayNodeId(nodeId);
  const recordView = readExploreRecordView(node);
  fillInfoDrawer(node?.explorationDesc, recordView.summary, recordView.entries);
  const statusDiv = document.getElementById('mapStatus');
  if (statusDiv) statusDiv.innerHTML = `<span class="status-indicator"></span><span>${escapeHtml(statusText)}</span>`;
}

// ─────────────────────────────────────────────────────────────
// 生成（按分支）
// ─────────────────────────────────────────────────────────────
interface GenContext {
  location: string;
  characters: GatheredChar[];
  libraryText: string;
  contextCount: number;
  style: MapStyle;

  parentDescText: string | null;
  childDescText: string | null;
  currentDescText: string | null;
  currentRecordText: string | null;
  overflowRecordText: string | null;
  recentRecordText: string | null;
  cachedJson: string | null;
  cachedSvg: string | null;
  neighborhoodText: string | null;
  currentExitsText: string | null;
  mapSize: { width: number; height: number };
  extraPrompt?: string;
}

/** 统一生成函数：单次 AI 调用同时输出 JSON + SVG + DESC */

async function generateMap(ctx: GenContext): Promise<{ structure: MapStructure | null; svg: string | null; desc: ExplorationDesc | null; exploreSummary: string; exploreNote: string; raw: string | null }> {
  const hasCache = !!(ctx.cachedJson || ctx.cachedSvg);
  const prompt = buildMapPrompt({ locationName: ctx.location, hasCache, style: ctx.style, mapSize: ctx.mapSize });
  const userInput = assembleUserInput({
    libraryText: ctx.libraryText,
    parentDescText: ctx.parentDescText,
    childDescText: ctx.childDescText,
    currentDescText: ctx.currentDescText,
    currentRecordText: ctx.currentRecordText,
    overflowRecordText: ctx.overflowRecordText,
    recentRecordText: ctx.recentRecordText,
    cachedJson: ctx.cachedJson,
    cachedSvg: ctx.cachedSvg,
    neighborhoodText: ctx.neighborhoodText,
    currentExitsText: ctx.currentExitsText,
    promptText: prompt,
    characters: ctx.characters,
    extraPrompt: ctx.extraPrompt,
  });
  const result = await callGenerateRaw(userInput, ctx.contextCount);
  const { structure, svg, desc, exploreSummary, exploreNote } = extractIncrFromResult(result || '');
  return { structure, svg, desc, exploreSummary, exploreNote, raw: result };
}

/** 去掉元数据字段，避免把 storyHash/updatedAt/region 回传给 AI */
function stripMetaFromStructure(s: MapStructure): MapStructure {
  const { storyHash: _sh, updatedAt: _u, region: _r, ...rest } = s as any;
  return rest;
}

// ─────────────────────────────────────────────────────────────
// 渲染
// ─────────────────────────────────────────────────────────────
/** 获取 SVG 注入目标：优先 #mapViewport（弹窗模式），回退到 #mapContainer */
function getSVGTarget(): HTMLElement | null {
  return document.getElementById('mapViewport') || document.getElementById('mapContainer');
}

/**
 * 主视图当前显示节点：渲染/导航时写入 #mapViewport 的 data-map-node-id（DOM 即真相）。
 * 场景图读取/刷新/删除缓存都以此为准，保证弹窗内导航到别的点后操作不错位。
 */
export function markDisplayNodeId(nodeId: string): void {
  const target = getSVGTarget();
  if (target) target.dataset.mapNodeId = nodeId;
}

/** 读取主视图当前显示节点；折叠态（无弹窗 DOM）返回 null */
export function getCurrentDisplayNodeId(): string | null {
  const target = getSVGTarget();
  return target?.dataset.mapNodeId || null;
}

// ─────────────────────────────────────────────────────────────
// 真图标记：DOM 即真相，容器带 has-real-map 类 + data-map-loc=<地点>
// 仅在写入真图/占位的瞬间读写，按需触发、零常驻开销（无定时器/监听/额外 DOM 节点）
// ─────────────────────────────────────────────────────────────
/** 容器当前是否已显示 loc 地点的真图（非占位） */
function hasRealMapFor(loc: string): boolean {
  const target = getSVGTarget();
  return !!target && target.classList.contains('has-real-map') && target.dataset.mapLoc === loc;
}

/** 标记容器已显示 loc 地点真图 */
function markRealMap(target: HTMLElement, loc: string): void {
  target.classList.add('has-real-map');
  target.dataset.mapLoc = loc;
}

/** 清除真图标记（写入占位前调用） */
function clearRealMapMark(target: HTMLElement): void {
  target.classList.remove('has-real-map');
  delete target.dataset.mapLoc;
  delete target.dataset.mapNodeId;
}

/** 强制显占位并清标记：清缓存等"明确要丢弃旧图"的动作调用 */
function forcePlaceholder(location: string, statusHtml: string): void {
  const target = getSVGTarget();
  if (!target) return;
  target.innerHTML = generateDefaultMapSVG(location);
  clearRealMapMark(target);
  const statusDiv = document.getElementById('mapStatus');
  if (statusDiv) statusDiv.innerHTML = statusHtml;
}

/**
 * 生成进行中（当前地点或库大地图）时从缓存渲染当前显示节点的地图（零 AI）。
 * 返回是否渲染成功。打开弹窗/切回地图时若命中此路径，不再卡「暂无地图数据」占位。
 */
async function tryRenderDisplayMapFromCache(): Promise<boolean> {
  const target = getSVGTarget();
  if (!target) return false;
  const display = await resolveCurrentDisplayNode();
  if (!display) return false;
  const node = await readMapNode(display.nodeId);
  if (!node || !node.structure) return false;
  if (!hasMapContent(node)) {
    renderTextOnlyPlaceholder(target, display.nodeId, display.canonicalPath, node, '仅记录文字信息');
    return true;
  }
  const aiChars = (node.structure.characters || []) as MapCharacter[];
  const chars = gatherCharacters();
  renderIntoContainer(target, display.nodeId, node.structure, node.svg, chars, aiChars, display.canonicalPath, node.explorationDesc, node.exploreSummary, node.exploreLog);
  const statusDiv = document.getElementById('mapStatus');
  if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator"></span><span>就绪</span>';
  return true;
}

function renderIntoContainer(
  container: HTMLElement,
  nodeId: string,
  structure: MapStructure | null,
  svg: string | null,
  characters: GatheredChar[],
  aiCharacters: MapCharacter[] | null,
  location: string,
  desc?: ExplorationDesc | null,
  exploreSummary?: string | null,
  exploreLog?: ExploreLogEntry[] | null,
): void {
  const size = (structure && structure.mapSize) || DEFAULT_MAP_SIZE;
  let baseSvg: string;
  if (svg) {
    baseSvg = svg; // 两阶段手绘 SVG
  } else if (structure) {
    baseSvg = renderLocalSVG(structure); // 单阶段本地渲染
  } else {
    baseSvg = generateDefaultMapSVG(location);
  }
  const rooms = (structure && Array.isArray(structure.rooms)) ? structure.rooms : undefined;
  const exits = (structure && Array.isArray(structure.exits)) ? structure.exits : undefined;
  const positions = applyAIPositions(characters, aiCharacters, size, rooms);
  const fullSvg = renderFullMapSVG(baseSvg, positions, exits, size);
  const target = getSVGTarget() || container;
  target.innerHTML = fullSvg;
  markRealMap(target, location); // 标记为真图，供后续刷新/复用判定保留
  markDisplayNodeId(nodeId); // 记录主视图当前显示节点（场景图/删缓存以此为准）
  updateMapDisplay(target, (name, _role, detail) => {
    onMarkerClick(name, detail);
  });
  // 填充地点信息抽屉：summary + items + directions + 探索概况 + 最近记录
  fillInfoDrawer(desc, exploreSummary, exploreLog);
}

/** 填充地点信息抽屉（简介 + 物品 + 方位 + 探索情况总结 + 最近探索记录） */
export function fillInfoDrawer(
  desc?: ExplorationDesc | null,
  exploreSummary?: string | null,
  exploreLog?: ExploreLogEntry[] | null,
): void {
  const summaryEl = document.getElementById('mapInfoSummary');
  const itemsEl = document.getElementById('mapInfoItems');
  const directionsEl = document.getElementById('mapInfoDirections');
  const exploreSummaryEl = document.getElementById('mapInfoExploreSummary');
  const logEl = document.getElementById('mapInfoLog');

  if (summaryEl) summaryEl.textContent = (desc && desc.summary) ? desc.summary : '—';
  if (itemsEl) {
    itemsEl.textContent = (desc && desc.items && desc.items.length > 0) ? desc.items.join('、') : '—';
  }
  if (directionsEl) directionsEl.textContent = (desc && desc.directions) ? desc.directions : '—';
  if (exploreSummaryEl) exploreSummaryEl.textContent = exploreSummary ? exploreSummary : '—';
  if (logEl) {
    const entries = Array.isArray(exploreLog) ? exploreLog.slice(-3) : [];
    if (entries.length > 0) {
      // 倒序显示（最新的在最上面）
      logEl.innerHTML = entries.slice().reverse().map(e => {
        const timeStr = e.time ? `<span class="map-info-log-time">[${escapeHtml(e.time)}]</span> ` : '';
        return `<div class="map-info-log-item">${timeStr}${escapeHtml(e.note || '')}</div>`;
      }).join('');
    } else {
      logEl.textContent = '—';
    }
  }
}

/** 标记点击 → 弹窗（复用 popup-manager 的 panelOverlay）。detail 为 AI 输出的身份简述，数据库找不到角色时 fallback 展示 */
function onMarkerClick(name: string, detail?: string): void {
  // 触发自定义事件，由 index.ts 绑定实际弹窗逻辑（保持渲染层无 DOM 弹窗依赖）
  emitUbEvent(UB_EVENT.mapMarkerClick, { name, detail }, document);
}

// ─────────────────────────────────────────────────────────────
// 主刷新流程
// ─────────────────────────────────────────────────────────────
async function _refreshMap(opts: { force?: boolean; reason?: 'open'; extraPrompt?: string; allowAutoGenerate?: boolean } = {}): Promise<void> {
  const config = getConfig();
  if (!config.mapEnabled) return;
  const traceRunId = beginMapRefreshTrace({
    force: !!opts.force,
    reason: opts.reason || (opts.allowAutoGenerate ? 'table' : 'ui'),
    mode: config.mapAutoUpdateMode || 'off',
  }, new Error().stack || '');
  // 渲染目标可能不存在（折叠态/弹窗未开）。生成+落盘无 DOM 依赖，始终执行；
  // 仅渲染相关步骤在 hasDom 为 true 时进行。
  const svgTarget = getSVGTarget();
  const hasDom = !!svgTarget;
  // 生成进行中（当前地点刷新或库大地图生成共用 isGenerating 锁，整段 AI 期间为 true）：
  // 不重复调 AI。但弹窗开且当前显示节点已有缓存真图时，仍从缓存渲染（零 AI），
  // 避免生成期间打开弹窗/切回地图时 #mapViewport 卡「暂无地图数据」占位到生成结束。
  if (MapState.isGenerating) {
    recordMapRefreshTrace(traceRunId, 'lock-hit');
    if (hasDom) await tryRenderDisplayMapFromCache();
    return;
  }

  const statusDiv = document.getElementById('mapStatus');

  const location = getCurrentLocation();
  if (!location) {
    // 无地点：本就无图可生成；弹窗开显「等待数据」占位，折叠态直接返回。
    // 必须早于入场扫描判定：进卡初始化期数据库逐表加载，全局数据表（当前详细地点）
    // 可能晚于其他表就绪，此时 location 为空。若先消耗入场跳过额度，location 就绪后
    // 的首次扫描不再被跳过 → 按模式误触发一次自动 AI 更新。location 为空时不消耗额度。
    if (hasDom) {
      svgTarget!.innerHTML = generateDefaultMapSVG('等待数据');
      clearRealMapMark(svgTarget!);
      if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator"></span><span>就绪</span>';
    }
    return;
  }

  // 入场扫描判定（切卡/载入卡后该消费者的首次自动扫描）：由中央守卫统一裁决，
  // 避免地图与立绘各自维护 chatKey 检测而发散。入场时须重置会话级基线，
  // 否则换卡后残留的 lastLocation/lastStoryHash 会把入场误判为「地点/剧情变化」。
  const isEntryScan = !opts.force && opts.allowAutoGenerate && consumeAutoGenEntrySkip('map');
  if (isEntryScan) {
    MapState.lastLocation = '';
    MapState.lastCanonicalNodeId = '';
    MapState.lastCanonicalPath = '';
    MapState.lastStoryHash = '';
  }

  // 去抖：同地点 2s 内不重复渲染（reason:'open' 打开弹窗时旁路，避免重建占位图后卡死）
  const now = Date.now();
  if (!opts.force && opts.reason !== 'open' && location === MapState.lastLocation && now - MapState.lastRenderAt < 2000) {
    return;
  }

  const identity = await resolveMapLocationForRefresh(
    location,
    config.mapLocationConflictStrategy || 'always-ask',
    () => getCurrentLocation() === location,
    () => { MapState.lastRenderAt = 0; void _refreshMap({ reason: 'open', allowAutoGenerate: opts.allowAutoGenerate }); },
  );
  if (identity.status === 'pending') {
    recordMapRefreshTrace(traceRunId, 'identity-pending', { location });
    if (statusDiv) statusDiv.textContent = '等待确认地点归属';
    return;
  }
  if (identity.autoMergeNote) {
    getToastr()?.info(identity.autoMergeNote, '地图');
  }

  const idx = identity.index;
  const leafNodeId = identity.nodeId;
  const canonicalPath = identity.canonicalPath || location;
  const contextCount = config.mapContextCount || 20;
  const storyContext = getRecentStoryContext(contextCount);
  const storyHash = hashText(storyContext + canonicalPath);
  const treeEntry = idx.nodes[leafNodeId] || null;
  const existingNode = await readMapNode(leafNodeId);

  const locChanged = leafNodeId !== MapState.lastCanonicalNodeId;
  const hashChanged = storyHash !== MapState.lastStoryHash;
  const mapChanged = locChanged || hashChanged;
  const shouldCommitRefreshBaseline = !!opts.force || !!opts.allowAutoGenerate;

  // 决策是否需要调 AI（自动更新时机 + 是否重绘地图画面）
  let needGen = false;   // 重新生成地图画面（含文字记录）
  let needText = false;  // 只更新文字记录
  const mode = config.mapAutoUpdateMode || 'off';
  const redraw = config.mapAutoRedraw !== false;
  if (opts.force) {
    // 手动刷新/长按强制刷新始终生图，不受重绘开关影响
    needGen = true;
  } else {
    switch (mode) {
      case 'off':
        break;
      case 'new-location':
        // 仅新地点（还没有节点重数据）才触发
        if (locChanged && !existingNode) {
          if (redraw) needGen = true;
          else needText = true;
        }
        break;
      case 'location-change':
        // 地点字符串变化就触发
        if (locChanged) {
          if (redraw) needGen = true;
          else needText = true;
        }
        break;
      case 'every-turn':
        // loc 或 hash 变化都触发；同一 storyHash 已处理则跳过（generated/text-only 都算已处理）
        if (mapChanged) {
          const handled = !!(treeEntry && treeEntry.status !== 'pending' && treeEntry.lastStoryHash === storyHash);
          if (!handled) {
            if (redraw) needGen = true;
            else needText = true;
          }
        }
        break;
    }
  }

  // 入场扫描（切卡/载入卡后首次自动刷新）无条件不调 AI：换卡瞬间基线已重置，
  // 任何模式都会把入场误判为变化，故所有 mapAutoUpdateMode 档一律跳过，
  // 等用户真正推进剧情（再次触发刷新）再按各档语义生成。手动 force 路径不受此限。
  if (isEntryScan) {
    needGen = false;
    needText = false;
  }

  // 只有全局数据表变动的防抖入口可自动调 AI。地图弹窗、地点按钮和面包屑重置
  // 仅用于读取并渲染缓存，即使其间剧情哈希已变化也不得补触发探索记录。
  if (!opts.force && !opts.allowAutoGenerate) {
    needGen = false;
    needText = false;
  }

  recordMapRefreshTrace(traceRunId, 'decision', {
    location,
    nodeId: leafNodeId,
    canonicalPath,
    storyHash,
    needGen,
    needText,
    redraw,
    entryScan: isEntryScan,
  });

  if (!needGen && !needText && existingNode) {
    // 命中新存储：弹窗开则渲染，折叠态仅更新簿记（gatherCharacters 只为渲染服务，移进守卫省开销）
    if (hasDom) {
      if (!hasMapContent(existingNode)) {
        renderTextOnlyPlaceholder(svgTarget!, leafNodeId, canonicalPath, existingNode, '仅记录文字信息');
      } else {
        const aiChars = (existingNode.structure.characters || []) as MapCharacter[];
        const chars = gatherCharacters();
        renderIntoContainer(svgTarget!, leafNodeId, existingNode.structure, existingNode.svg, chars, aiChars, canonicalPath, existingNode.explorationDesc, existingNode.exploreSummary, existingNode.exploreLog);
        if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator"></span><span>就绪</span>';
      }
    }
    if (shouldCommitRefreshBaseline) {
      MapState.lastLocation = location;
      MapState.lastCanonicalNodeId = leafNodeId;
      MapState.lastCanonicalPath = canonicalPath;
      MapState.lastStoryHash = storyHash;
      MapState.lastRenderAt = now;
    }
    return;
  }

  // 自动更新关闭、非强制刷新、且无可用缓存 → 不调 AI；弹窗开则显占位图，折叠态仅更新簿记
  if (!needGen && !needText && !existingNode) {
    if (hasDom) {
      if (hasRealMapFor(canonicalPath)) {
        if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator"></span><span>就绪</span>';
      } else {
        svgTarget!.innerHTML = generateDefaultMapSVG(location);
        clearRealMapMark(svgTarget!);
        if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator"></span><span>点刷新按钮手动生成</span>';
      }
    }
    if (shouldCommitRefreshBaseline) {
      MapState.lastLocation = location;
      MapState.lastCanonicalNodeId = leafNodeId;
      MapState.lastCanonicalPath = canonicalPath;
      MapState.lastStoryHash = storyHash;
      MapState.lastRenderAt = now;
    }
    return;
  }

  // ===== 纯文字更新分支（自动更新关闭重绘 / 新地点只建记录）=====
  if (needText) {
    try {
      MapState.isGenerating = true;
      const mapChatKeyAtStart = getCurrentStoryChatKey(); // F5 代际守卫：发起时的聊天身份
      recordMapRefreshTrace(traceRunId, 'ai-start', { kind: 'text', storyHash, nodeId: leafNodeId });
      if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator loading"></span><span>正在更新地点记录...</span>';
      const apiErr = validateCustomApiConfig('map');
      if (apiErr) { showApiConfigError('地图更新', apiErr); throw new Error(apiErr); }

      const hasMap = hasMapContent(existingNode);
      // 地图树邻接清单 + 现有连接参考（directions 与冻结结构保持一致）
      const neighborhood = leafNodeId ? gatherNodeNeighborhood(idx, leafNodeId) : null;
      const neighborhoodText = neighborhood ? neighborhood.text : null;
      const currentExitsText = existingNode ? buildCurrentExitsText(idx, existingNode.structure.exits) : null;
      // 本次写入前先规划：已有 3 条时最旧条目进入 overflow，交给 AI 与旧总结一起压缩
      const previewEntry = buildExploreLogEntry('', storyHash, '');
      const recordPlan = planExploreRecordUpdate(existingNode, previewEntry);
      const currentRecordText = existingNode?.exploreSummary || null;
      const overflowRecordText = formatExploreEntries(recordPlan.overflow);
      const recentRecordText = formatExploreEntries(recordPlan.kept);
      const currentDescText = existingNode ? JSON.stringify(existingNode.explorationDesc) : null;
      const libEntries = await searchLocationEntries(location, config.mapMaxEntries || 8);
      const libraryText = libEntries.map(e => `【条目：${e.comment}】\n${e.content}`).join('\n\n');
      const prompt = buildMapTextUpdatePrompt({ locationName: location, hasExistingMap: hasMap });
      const userInput = assembleUserInput({
        libraryText,
        parentDescText: null,
        childDescText: null,
        currentDescText,
        currentRecordText,
        overflowRecordText,
        recentRecordText,
        cachedJson: null,
        cachedSvg: null,
        neighborhoodText,
        currentExitsText,
        promptText: prompt,
        characters: [],
      });
      const result = await callGenerateRaw(userInput, contextCount);
      const parsed = extractIncrFromResult(result || '');

      if (!result || !parsed.desc) {
        // 解析失败：保留已有地图/记录；无图则显占位
        if (hasDom) {
          if (hasMap && hasRealMapFor(canonicalPath)) {
            if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator error"></span><span>地点记录更新失败，保留旧图</span>';
          } else {
            renderTextOnlyPlaceholder(svgTarget!, leafNodeId, canonicalPath, existingNode, '地点记录更新失败');
          }
        }
        getToastr()?.warning('地点记录更新失败，已保留原有记录', '地图');
        return;
      }

      // F5 代际守卫：AI 请求期间切聊天 → 本结果属于旧聊天，不写入新聊天
      if (getCurrentStoryChatKey() !== mapChatKeyAtStart) {
        recordMapRefreshTrace(traceRunId, 'chat-switched-abort', { kind: 'text', storyHash, nodeId: leafNodeId });
        return;
      }

      const node: MapNode = existingNode ? { ...existingNode } : {
        version: 1,
        schema: 'map_node',
        nodeId: leafNodeId || deriveNodeId(normalizeLocationPath(canonicalPath)),
        structure: { mapSize: DEFAULT_MAP_SIZE, rooms: [], doors: [], exits: [], characters: [] },
        svg: '',
        explorationDesc: { summary: '', items: [], directions: '' },
        exploreSummary: '',
        exploreLog: [],
      };
      // 文字字段：AI 有值就用，缺省保留旧值（全新节点用空值）
      node.explorationDesc = {
        summary: parsed.desc.summary || existingNode?.explorationDesc.summary || '',
        items: (parsed.desc.items && parsed.desc.items.length) ? parsed.desc.items : (existingNode?.explorationDesc.items || []),
        directions: parsed.desc.directions || existingNode?.explorationDesc.directions || '',
      };
      const currentTime = readStoryClockRaw();
      const logEntry = buildExploreLogEntry(parsed.exploreNote, storyHash, currentTime);
      if (logEntry.note.trim()) {
        // 用真实 entry 重新规划，确保 nextEntries 里是本次新增量而非调用前的占位 entry
        applyExploreRecordPlan(node, planExploreRecordUpdate(existingNode, logEntry), parsed.exploreSummary);
      } else {
        // AI 未给出新增量：不追加，但仍把旧数据收敛到「总结 + 最多 3 条」
        const view = readExploreRecordView(existingNode);
        node.exploreSummary = view.summary;
        node.exploreLog = view.entries;
      }
      recordMapRefreshTrace(traceRunId, 'explore-log-write', { kind: 'text', storyHash, nodeId: node.nodeId, hasNote: !!logEntry.note });
      if (hasMap) markNodeGenerated(idx, leafNodeId, storyHash);
      else markNodeTextOnly(idx, leafNodeId, storyHash);
      await writeMapNodeAndIndex(node, idx);
      recordMapRefreshTrace(traceRunId, 'map-write', { kind: 'text', storyHash, nodeId: node.nodeId });

      if (hasDom) {
        if (hasMap) {
          const chars = gatherCharacters();
          renderIntoContainer(svgTarget!, node.nodeId, node.structure, node.svg, chars, (node.structure.characters || []) as MapCharacter[], canonicalPath, node.explorationDesc, node.exploreSummary, node.exploreLog);
          if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator"></span><span>就绪</span>';
        } else {
          renderTextOnlyPlaceholder(svgTarget!, node.nodeId, canonicalPath, node, '已记录文字信息');
        }
      }
      // 纯文字更新可能每轮触发，不弹 success toast 避免刷屏
    } catch (e) {
      console.error('[地图] 文字更新错误:', e);
      const hasMap = hasMapContent(existingNode);
      if (hasDom) {
        if (hasMap && hasRealMapFor(canonicalPath)) {
          if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator error"></span><span>更新失败，保留旧图</span>';
        } else {
          renderTextOnlyPlaceholder(svgTarget!, leafNodeId, canonicalPath, existingNode, '地点记录更新失败');
        }
      }
      getToastr()?.warning('地点记录更新失败，已保留原有记录', '地图');
    } finally {
      MapState.isGenerating = false;
      recordMapRefreshTrace(traceRunId, 'finished', { kind: 'text', storyHash, nodeId: leafNodeId });
      MapState.lastLocation = location;
      MapState.lastCanonicalNodeId = leafNodeId;
      MapState.lastCanonicalPath = canonicalPath;
      MapState.lastStoryHash = storyHash;
      MapState.lastRenderAt = Date.now();
    }
    return;
  }

  // 需要生成：弹窗开则先显「生成中」占位，折叠态直接进入生成（无渲染目标）
  if (hasDom && !hasRealMapFor(canonicalPath)) {
    svgTarget!.innerHTML = generatingMapSVG(location);
    clearRealMapMark(svgTarget!);
  }

  try {
    MapState.isGenerating = true;
    const mapChatKeyAtStart = getCurrentStoryChatKey(); // F5 代际守卫：发起时的聊天身份
    recordMapRefreshTrace(traceRunId, 'ai-start', { kind: 'full', storyHash, nodeId: leafNodeId });
    if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator loading"></span><span>正在生成地图...</span>';
    // 进行中提示由统一 AI 活动注册表负责（#mapStatus 专属状态保留）
    const apiErr = validateCustomApiConfig('map');
    if (apiErr) { showApiConfigError('地图生成', apiErr); throw new Error(apiErr); }


    const characters = gatherCharacters();
    const libEntries = await searchLocationEntries(location, config.mapMaxEntries || 8);
    const libraryText = libEntries.map(e => `【条目：${e.comment}】\n${e.content}`).join('\n\n');


    // 收集上下级探索描述（仅直接相邻）
    const parentDesc = leafNodeId ? await gatherParentContext(idx, leafNodeId) : null;
    const childDesc = leafNodeId ? await gatherChildContext(idx, leafNodeId) : null;
    // 当前节点旧描述（增量时注入）
    const currentDesc = existingNode ? [
      existingNode.explorationDesc.summary,
      existingNode.explorationDesc.directions,
    ].filter(Boolean).join('\n') : null;
    // 旧结构 JSON（去掉 meta + exits，AI 每次重新生成 exits）
    // 纯文字节点没有地图画面，不当作「增量改写」的缓存，按全新地图生成。
    let cachedJson: string | null = null;
    if (existingNode && hasMapContent(existingNode)) {
      const stripped = stripMetaFromStructure(existingNode.structure);
      const { exits: _exits, ...rest } = stripped as any;
      cachedJson = JSON.stringify(rest);
    }
    const cachedSvg = existingNode && hasMapContent(existingNode) ? existingNode.svg : null;
    // 地图树邻接清单 + 现有连接参考（树即真相：连接以树为准，exits 对账用）
    const neighborhood = leafNodeId ? gatherNodeNeighborhood(idx, leafNodeId) : null;
    const neighborhoodText = neighborhood ? neighborhood.text : null;
    const currentExitsText = existingNode ? buildCurrentExitsText(idx, existingNode.structure.exits) : null;
    // 探索记录：先规划本次写入；已有 3 条时最旧条目进入 overflow，交给 AI 与旧总结一起压缩
    const previewEntry = buildExploreLogEntry('', storyHash, '');
    const recordPlan = planExploreRecordUpdate(existingNode, previewEntry);
    const currentRecordText = existingNode?.exploreSummary || null;
    const overflowRecordText = formatExploreEntries(recordPlan.overflow);
    const recentRecordText = formatExploreEntries(recordPlan.kept);
    const style: MapStyle = idx.defaultStyle || 'auto';
    // 子节点超过5个时 SVG 阶梯扩大（≤5:800×600; 6-10:1000×750; >10:1200×900）
    const childCount = treeEntry?.childIds?.length || 0;
    const mapSize = computeMapSize(childCount);

    const ctx: GenContext = {
      location, characters, libraryText, contextCount,
      style, parentDescText: parentDesc, childDescText: childDesc,
      currentDescText: currentDesc,
      currentRecordText, overflowRecordText, recentRecordText,
      cachedJson, cachedSvg,
      neighborhoodText, currentExitsText, mapSize,
      extraPrompt: opts.extraPrompt,
    };

    const result = await generateMap(ctx);

    if (!result.structure) {
      // 弹窗开：有旧图保留旧图，否则显占位；折叠态：无 DOM 可写，仅 toastr
      const keepOld = hasDom && hasRealMapFor(canonicalPath);
      if (hasDom) {
        if (keepOld) {
          if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator error"></span><span>生成失败，保留旧图</span>';
          showGenOutputError('地图', result.raw, { level: 'warning', title: '地图提示', suffix: '已保留当前地图' });
        } else {
          svgTarget!.innerHTML = generateDefaultMapSVG(location);
          clearRealMapMark(svgTarget!);
          if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator error"></span><span>地图生成失败</span>';
          showGenOutputError('地图', result.raw, { level: 'warning', title: '地图提示', suffix: '已显示占位图' });
        }
      }
      getToastr()?.error(`${genFailureHead(result.raw)}，${keepOld ? '已保留旧图' : '地图生成失败'}`, '地图');
      return;
    }

    // exits 解析：AI 输出的 targetName → targetNodeId，确保子节点入树
    const aiExits = Array.isArray((result.structure as any).exits) ? (result.structure as any).exits : [];
    const { exits: resolvedExits, index: idx2 } = leafNodeId
      ? resolveExits(idx, leafNodeId, aiExits)
      : { exits: [], index: idx };

    // 组装 MapNode（补全 MapNodeStructure 必需字段）
    const node: MapNode = {
      version: 1,
      schema: 'map_node',
      nodeId: leafNodeId || deriveNodeId(normalizeLocationPath(canonicalPath)),
      structure: {
        mapSize: result.structure.mapSize || DEFAULT_MAP_SIZE,
        rooms: result.structure.rooms || [],
        doors: result.structure.doors || [],
        exits: resolvedExits,
        characters: result.structure.characters || [],
      },
      svg: result.svg || '',
      explorationDesc: result.desc || { summary: '', items: [], directions: '' },
      exploreSummary: existingNode?.exploreSummary || '',
      exploreLog: existingNode ? [...existingNode.exploreLog] : [],
    };
    // F5 代际守卫：AI 请求期间切聊天 → 本结果属于旧聊天，不写入新聊天
    if (getCurrentStoryChatKey() !== mapChatKeyAtStart) {
      recordMapRefreshTrace(traceRunId, 'chat-switched-abort', { kind: 'full', storyHash, nodeId: leafNodeId });
      return;
    }
    // 拼装探索记录：本次新增 1 条；已有 3 条时最旧条目并入总结（AI 返回 exploreSummary）
    const currentTime = readStoryClockRaw();
    const logEntry = buildExploreLogEntry(result.exploreNote, storyHash, currentTime);
    if (logEntry.note.trim()) {
      // 用真实 entry 重新规划，确保 nextEntries 里是本次新增量而非调用前的占位 entry
      applyExploreRecordPlan(node, planExploreRecordUpdate(existingNode, logEntry), result.exploreSummary);
    } else {
      // AI 未给出新增量：不追加，但仍把旧数据收敛到「总结 + 最多 3 条」
      const view = readExploreRecordView(existingNode);
      node.exploreSummary = view.summary;
      node.exploreLog = view.entries;
    }
    recordMapRefreshTrace(traceRunId, 'explore-log-write', { kind: 'full', storyHash, nodeId: node.nodeId, hasNote: !!result.exploreNote });

    // 写入新存储
    markNodeGenerated(idx2, node.nodeId, storyHash);
    const mapSaved = await writeMapNodeAndIndex(node, idx2);
    recordMapRefreshTrace(traceRunId, 'map-write', { kind: 'full', storyHash, nodeId: node.nodeId, mapSaved });
    if (mapSaved) {
      void scheduleFirstMapSceneGeneration(
        node,
        buildMapSceneNodeIdentity(node.nodeId, canonicalPath, location, storyHash),
      );
    }

    // 成就打点
    try { (window as any).__ubEmitAchievement?.('map_generated', {}); } catch (_e) { /* ignore */ }
    try { (window as any).__ubEmitAchievement?.('action-on-date', { action: 'map_generated' }); } catch (_e) { /* ignore */ }

    // 弹窗开则渲染新图；折叠态已落盘，下次开窗命中缓存。toastr 照日历始终弹
    if (hasDom) {
      renderIntoContainer(svgTarget!, node.nodeId, node.structure, node.svg, characters, (node.structure.characters || []) as MapCharacter[], canonicalPath, node.explorationDesc, node.exploreSummary, node.exploreLog);
      if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator"></span><span>就绪</span>';
    }
    getToastr()?.success('地图生成完成', '地图');
  } catch (e) {
    console.error('[地图] 生成错误:', e);
    const keepOld = hasDom && hasRealMapFor(canonicalPath);
    if (hasDom) {
      if (keepOld) {
        if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator error"></span><span>生成失败，保留旧图</span>';
      } else {
        svgTarget!.innerHTML = generateDefaultMapSVG(location);
        clearRealMapMark(svgTarget!);
        if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator error"></span><span>地图生成失败</span>';
      }
    }
    getToastr()?.error(keepOld ? '地图生成失败，已保留旧图' : '地图生成失败', '地图');
  } finally {
    MapState.isGenerating = false;
    recordMapRefreshTrace(traceRunId, 'finished', { kind: 'full', storyHash, nodeId: leafNodeId });
    MapState.lastLocation = location;
    MapState.lastCanonicalNodeId = leafNodeId;
    MapState.lastCanonicalPath = canonicalPath;
    MapState.lastStoryHash = storyHash;
    MapState.lastRenderAt = Date.now();
  }
}

/** 供地图 UI 读取/渲染当前缓存；不授予智能更新权限。 */
export const refreshMap = (opts?: { force?: boolean; reason?: 'open' }) => { void _refreshMap({ ...(opts || {}), allowAutoGenerate: false }); };

/** 强制刷新：清当前地点缓存后重生（带缓存→增量；实际是直接重算，因为缓存还在则走增量） */
export async function forceRefreshMap(extraPrompt?: string): Promise<void> {
  // 强制刷新：保留缓存以走增量改写；若想全新可在设置里先清缓存
  await _refreshMap({ force: true, extraPrompt });
}

export async function clearCurrentMapCache(
  onInline?: (msg: string) => void,
  confirm?: (message: string) => boolean | Promise<boolean>,
): Promise<void> {
  // 优先主视图当前显示节点（DOM 即真相）；折叠态回退上次 SVG 刷新簿记/数据库当前地点
  const display = await resolveCurrentDisplayNode();
  let targetNodeId = '';
  let label = '';
  if (display) {
    targetNodeId = display.nodeId;
    label = display.canonicalPath || display.label;
  } else {
    label = MapState.lastLocation || getCurrentLocation();
  }
  if (!label) { if (onInline) onInline('当前没有选中任何地点'); else console.warn('[map] clearCurrentMapCache: 当前没有选中任何地点'); return; }
  if (!await (confirm ?? window.confirm)(`确定要清除「${label}」的地图缓存吗？`)) return;
  // 清除旧缓存（兼容未迁移场景）+ 新节点数据 + 索引重置
  const ok = targetNodeId
    ? await clearMapNodeByNodeId(targetNodeId)
    : await clearMapNodeByLocation(label);
  if (ok) {
    getToastr()?.success(`已清除「${label}」的地图缓存`, '地图');
  } else {
    getToastr()?.error('清除缓存失败', '地图');
    return;
  }
  // 清缓存=明确丢弃旧图：先立即显占位并清掉 has-real-map 标记，再刷新（不调 AI）。
  // 这样 _refreshMap 不会因标记残留而保留旧图——清缓存必须显占位，不保留旧图。
  // 保持 lastLocation/lastStoryHash 不变，使自动更新仅在地点真正变更时触发
  forcePlaceholder(label, '<span class="status-indicator"></span><span>点刷新按钮手动生成</span>');
  MapState.lastRenderAt = 0;
  await _refreshMap({ force: false });
}

export async function clearAllMapCache(
  confirm?: (message: string) => boolean | Promise<boolean>,
): Promise<void> {
  if (!await (confirm ?? window.confirm)('确定要清空所有地图缓存吗？')) return;
  // 清除旧缓存（兼容未迁移场景）+ 新节点数据 + 索引重置
  const ok = await clearAllMapNodes();
  if (ok) {
    getToastr()?.success('已清空所有地图缓存', '地图');
  } else {
    getToastr()?.error('清空缓存失败', '地图');
    return;
  }
  const loc = MapState.lastLocation || getCurrentLocation() || '';
  forcePlaceholder(loc, loc ? '<span class="status-indicator"></span><span>点刷新按钮手动生成</span>' : '<span class="status-indicator"></span><span>就绪</span>');
  MapState.lastRenderAt = 0;
  await _refreshMap({ force: false });
}

/** 防抖刷新（表格更新时调用） */
export const refreshMapDebounced = debounce(() => { void _refreshMap({ allowAutoGenerate: true }); }, 800);

// ─────────────────────────────────────────────────────────────
// 地图库编辑 UI（基础版：列表 + 预览 + 删除）
// ─────────────────────────────────────────────────────────────

/** 列出地图库所有节点（树形扁平化，带 depth） */
export async function listMapLibraryNodes(): Promise<MapLibNodeInfo[]> {
  const index = await readTreeIndex();
  return listAllNodesForUI(index);
}

/**
 * 库预览专用：返回完整渲染的 SVG（含 exit 热点，不含角色标记）。
 * 供 map-panel 库预览区点击行后展示，exit 热点可点击在库内切换节点。
 * 返回值含 exits 数组供前端判断导航目标。
 */
export async function previewMapNodeFull(nodeId: string): Promise<{ svg: string; name: string; fullPath: string; hasMap: boolean; exits: MapExit[]; nodeId: string; explorationDesc?: ExplorationDesc; exploreSummary?: string; exploreLog?: ExploreLogEntry[] } | null> {
  const index = await readTreeIndex();
  const treeNode = index.nodes[nodeId];
  if (!treeNode) return null;
  const fullPath = deriveFullPathFromIndex(index, nodeId);
  const node = await readMapNode(nodeId);
  if (!node) {
    return { svg: '', name: treeNode.name, fullPath, hasMap: false, exits: [], nodeId };
  }
  if (!hasMapContent(node)) {
    // 纯文字节点：没有地图画面，但仍返回文字记录供信息抽屉/库预览提示使用
    return {
      svg: '', name: treeNode.name, fullPath, hasMap: false, exits: [], nodeId,
      explorationDesc: node.explorationDesc,
      exploreSummary: node.exploreSummary,
      exploreLog: node.exploreLog,
    };
  }
  const baseSvg = node.svg || renderLocalSVG(node.structure);
  const size = (node.structure && node.structure.mapSize) || DEFAULT_MAP_SIZE;
  const exits = (node.structure && Array.isArray(node.structure.exits)) ? node.structure.exits : [];
  // 只叠加 exit 热点，不叠加角色标记（库预览模式不需要角色）
  // 命名空间隔离 id：库预览 SVG 与主地图 SVG 同时在 DOM，避免 AI <defs> 渐变/图案 id 撞车
  //   致库预览 url(#bg) 解析到主地图的 def、背景/渐变填充缺失。exit 热点用 data-* 不受影响。
  const fullSvg = namespaceSvgIds(renderFullMapSVG(baseSvg, [], exits, size), 'mpl-');
  return { svg: fullSvg, name: treeNode.name, fullPath, hasMap: true, exits, nodeId, explorationDesc: node.explorationDesc, exploreSummary: node.exploreSummary, exploreLog: node.exploreLog };
}

/**
 * 主弹窗 exit 热点导航（§10.1）：点击出口热点 → 把目标节点地图载入主视图。
 *
 * 经 renderIntoContainer 渲染——带角色标记 + exits，故导航到的地图仍可继续点 exit 前进。
 *
 * 返回值供调用方决定 toast：
 * - generated 且有重数据 → 渲染到 #mapViewport，navigated=true
 * - status=pending（或索引标记 generated 却无重数据）→ pending=true，不渲染
 * - 索引无此 nodeId（exit 引用失效）→ navigated=false / pending=false（调用方弹警告）
 *
 * opts.skipHistory=true 时不入历史栈（如历史栈回退导航，避免重复压栈）。
 * 渲染完成后派发 UB_EVENT.mapNavigated CustomEvent，供 map-panel 更新面包屑和历史栈
 * （避免 core 反向依赖 renderers）。
 */
export async function navigateToNode(
  nodeId: string,
  opts?: { skipHistory?: boolean },
): Promise<{ navigated: boolean; name: string; pending: boolean }> {
  const index = await readTreeIndex();
  const treeNode = index.nodes[nodeId];
  if (!treeNode) return { navigated: false, name: '', pending: false };
  const name = treeNode.name;
  const container = document.getElementById('mapContainer');
  const fullPath = deriveFullPathFromIndex(index, nodeId);
  if (treeNode.status === 'text-only') {
    // 纯文字节点：渲染占位并填充信息抽屉；面包屑/历史栈照常推进
    const textNode = await readMapNode(nodeId);
    if (container && textNode) {
      renderTextOnlyPlaceholder(container, nodeId, fullPath, textNode, '仅记录文字信息');
      emitUbEvent(UB_EVENT.mapNavigated, { nodeId, fullPath, skipHistory: opts?.skipHistory === true });
      return { navigated: true, name, pending: false };
    }
    return { navigated: false, name, pending: true };
  }
  if (treeNode.status !== 'generated') {
    return { navigated: false, name, pending: true };
  }
  const node = await readMapNode(nodeId);
  if (!node) {
    // 索引标记 generated 但无重数据（异常）→ 视作未生成，提示需先进入
    return { navigated: false, name, pending: true };
  }

  if (!container) return { navigated: false, name, pending: false };
  const aiChars = (node.structure.characters || []) as MapCharacter[];
  // 非当前节点不注入当前场景在场人物：gatherCharacters() 只反映「当前场景」数据库在场表，
  // 用于别的节点会把当前场景人物摆到 generateDefaultPositions 的固定默认布局上，且不随节点变化
  // （上级大地图 structure.characters 为空时尤其明显——人物永远在同一批默认坐标）。
  // 这里只渲染该节点 structure.characters 里存的人物，在他们存的坐标上；
  // 上级大地图该字段为空→不画角色（符合 buildLargeMapPrompt「俯瞰图不含 characters」的约定）。
  const chars: GatheredChar[] = [];
  renderIntoContainer(container, nodeId, node.structure, node.svg, chars, aiChars, fullPath, node.explorationDesc, node.exploreSummary, node.exploreLog);
  // 通过 CustomEvent 通知 map-panel 更新面包屑和历史栈（避免 core 反向依赖 renderers）
  emitUbEvent(UB_EVENT.mapNavigated, { nodeId, fullPath, skipHistory: opts?.skipHistory === true });
  return { navigated: true, name, pending: false };
}

/** 从地图库删除节点（级联删除子树），返回删除的节点数 */
export async function deleteMapNodeFromLibrary(nodeId: string): Promise<number> {
  return deleteMapNodeByNodeId(nodeId);
}

export async function inspectMapNodeMerge(
  leftNodeId: string,
  rightNodeId: string,
): Promise<MapMergeInspection> {
  const index = await readTreeIndex();
  return inspectMapNodeMergePlan({ index, mapNodes: {}, sceneRecords: {} }, leftNodeId, rightNodeId);
}

export async function mergeMapNodes(selection: MapMergeSelection): Promise<MapMergeResult> {
  const result = await mapMergeService.merge(selection);
  if (!result.ok) {
    getToastr()?.error(result.error || '地图节点合并失败', '地图库');
    return result;
  }
  if (result.cleanupFailedPaths && result.cleanupFailedPaths.length > 0) {
    getToastr()?.warning(`节点已合并，但有 ${result.cleanupFailedPaths.length} 个场景图文件待清理`, '地图库');
  } else {
    getToastr()?.success('地图节点合并完成', '地图库');
  }
  emitUbEvent(UB_EVENT.mapMerged, {
    finalNodeId: result.finalNodeId,
    discardedNodeId: result.discardedNodeId,
  });
  return result;
}

// ─────────────────────────────────────────────────────────────
// 收藏 + 编辑器操作（期4 创意增强 + 编辑器）
// ─────────────────────────────────────────────────────────────

/** 切换节点收藏状态，返回 true=已收藏 false=取消收藏 */
export async function toggleNodeFavorite(nodeId: string): Promise<boolean> {
  const index = await readTreeIndex();
  const fav = toggleFavorite(index, nodeId);

  await writeTreeIndex(index);
  return fav;
}

/** 判断节点是否已收藏 */
export async function isNodeFavorite(nodeId: string): Promise<boolean> {
  const index = await readTreeIndex();

  return isFavorite(index, nodeId);
}

/** 切换节点最终子节点状态，返回新状态；节点不存在或写回失败返回 null。 */
export async function toggleMapNodeFinalChild(nodeId: string): Promise<boolean | null> {
  const index = await readTreeIndex();
  const node = index.nodes[nodeId];
  if (!node) return null;
  const next = !node.finalChild;
  node.finalChild = next;
  node.updatedAt = Date.now();
  const ok = await writeTreeIndex(index);
  return ok ? next : null;
}

/** 查看一个规范节点当前绑定的全部非规范地点表述。 */
export async function listNodeLocationAliases(nodeId: string): Promise<{ canonicalPath: string; aliases: string[] } | null> {
  const index = await readTreeIndex();
  if (!index.nodes[nodeId]) return null;
  return {
    canonicalPath: deriveFullPathFromIndex(index, nodeId),
    aliases: Object.entries(index.locationAliases || {})
      .filter(([, alias]) => alias.targetNodeId === nodeId)
      .map(([path]) => path)
      .sort((a, b) => a.localeCompare(b, 'zh-CN')),
  };
}

/** 解除一条地点别名；不会删除规范节点或地图。 */
export async function removeMapLocationAlias(rawPath: string): Promise<boolean> {
  return removeLocationAlias(rawPath);
}

/** 给节点添加一条地点别名。force=true 时覆盖已指向他节点的别名（需 UI 二次确认后调用）。 */
export async function addMapLocationAlias(
  nodeId: string,
  aliasText: string,
  force = false,
): Promise<{ ok: boolean; reason?: string; conflictNodeName?: string }> {
  const index = await readTreeIndex();
  const result = addLocationAliasToIndex(index, aliasText, nodeId, force);
  if (!result.ok) {
    if (result.needsConfirm && result.conflictNodeId) {
      return { ok: false, reason: result.reason, conflictNodeName: index.nodes[result.conflictNodeId]?.name };
    }
    return { ok: false, reason: result.reason };
  }
  const ok = await writeTreeIndex(index);
  return ok ? { ok: true } : { ok: false, reason: '写回聊天楼层失败' };
}

/** 重命名节点并把旧路径保留为别名，子树旧路径同步指向原身份节点。 */
export async function renameMapNode(nodeId: string, newName: string): Promise<boolean> {
  const index = await readTreeIndex();
  const affectedIds = [nodeId, ...collectDescendantNodeIds(index, nodeId)];
  const oldPaths = new Map(affectedIds.map(id => [id, normalizeLocationPath(deriveFullPathFromIndex(index, id))]));
  const ok = renameNode(index, nodeId, newName);
  if (!ok) return false;
  const now = Date.now();
  for (const id of affectedIds) {
    const oldPath = oldPaths.get(id);
    const newPath = normalizeLocationPath(deriveFullPathFromIndex(index, id));
    if (oldPath && oldPath !== newPath) index.locationAliases[oldPath] = { targetNodeId: id, createdAt: now };
  }
  return writeTreeIndex(index);
}

/** 手动新增子节点（pending 状态），返回新节点 nodeId，失败返回 null */
export async function addChildMapNode(parentId: string, name: string): Promise<string | null> {
  const index = await readTreeIndex();
  const newId = addChildNode(index, parentId, name);
  if (!newId) return null;
  const ok = await writeTreeIndex(index);
  return ok ? newId : null;
}

/** 更新节点探索描述（编辑器手动修正），成功返回 true */
export async function updateMapNodeDesc(
  nodeId: string,
  desc: { summary?: string; items?: string[]; directions?: string; exploreSummary?: string; exploreLog?: ExploreLogEntry[] },
): Promise<boolean> {
  return updateNodeExplorationDesc(nodeId, desc);
}

/** 读取节点的探索描述（供编辑器加载） */
export async function readMapNodeDesc(nodeId: string): Promise<ExplorationDesc | null> {
  const node = await readMapNode(nodeId);
  if (!node) return null;
  return node.explorationDesc;
}

/** 读取节点的探索记录视图（情况总结 + 最近最多 3 条，供编辑器/信息抽屉加载） */
export async function readMapNodeExploreRecord(nodeId: string): Promise<{ summary: string; entries: ExploreLogEntry[] } | null> {
  const node = await readMapNode(nodeId);
  if (!node) return null;
  return readExploreRecordView(node);
}

// ─────────────────────────────────────────────────────────────
// 节点地图生成（库路径）
// ─────────────────────────────────────────────────────────────
// 流程（spec §5.3）：
//   读 index → 收集后代 nodeId → 批量读子节点 explorationDesc
//   → 搜索世界书条目（含节点名称的条目，用户关键要求）
//   → 组装提示词 → 调 AI
//   → 解析三段输出 <MAP_JSON> + <MAP_SVG> + <MAP_DESC>
//   → resolveExits（子节点入树）→ 写 __map_node_<id> → 更新 index
//
// 大地图 = 父节点地图：存储统一后，父节点和叶子节点都用 MapNode 结构。
// 库路径与剧情路径（_refreshMap）的区别：不含剧情上下文、exploreNote 留空、
// 不追加 exploreLog（保留旧 exploreLog 不被空数据覆盖）、explorationDesc 增量覆盖。

/**
 * 库路径生成节点地图（原 generateLargeMap）。
 *
 * 与 _refreshMap（剧情路径）的区别：
 * - 提示词不含剧情上下文（buildLargeMapPrompt）
 * - exploreNote 留空，不追加 exploreLog（保留旧 exploreLog 不被空数据覆盖）
 * - explorationDesc 读旧值注入提示词 → AI 修改 → 覆盖旧值
 *
 * 生成结果为标准 MapNode 结构，与剧情路径生成的节点地图统一存储。
 */
export async function generateNodeMapFromLibrary(nodeId: string, extraPrompt?: string, onInline?: (msg: string) => void): Promise<MapNode | null> {
  const config = getConfig();
  if (!config.mapEnabled) return null;
  if (MapState.isGenerating) return null;

  const index = await readTreeIndex();
  const treeNode = index.nodes[nodeId];
  if (!treeNode) {
    if (onInline) onInline('未找到该节点');
    else console.warn('[map-library] generateNodeMapFromLibrary: 未找到该节点 ' + nodeId);
    return null;
  }
  const nodeName = treeNode.name;

  // 1. 收集所有后代 nodeId + 组装「该区域已探索地点」文本
  const descendantIds = collectDescendantNodeIds(index, nodeId);
  const childLines: string[] = [];
  for (const childId of descendantIds) {
    const childNode = index.nodes[childId];
    if (!childNode) continue;
    if (childNode.status === 'pending') {
      childLines.push(`${childNode.name}：（未探索）`);
      continue;
    }
    const data = await readMapNode(childId);
    if (!data) {
      childLines.push(`${childNode.name}：（未探索）`);
      continue;
    }
    const desc = data.explorationDesc;
    const parts: string[] = [childNode.name];
    if (desc.summary) parts.push(desc.summary);
    if (desc.items && desc.items.length > 0) parts.push(`物件：${desc.items.join('、')}`);
    if (desc.directions) parts.push(`方位：${desc.directions}`);
    childLines.push(parts.join('｜'));
  }
  const childDescText = childLines.length > 0 ? childLines.join('\n') : null;

  // 2. 搜索世界书条目
  const libEntries = await searchLocationEntries(nodeName, config.mapMaxEntries || 8);
  const libraryText = libEntries.map(e => `【条目：${e.comment}】\n${e.content}`).join('\n\n');

  // 3. 读现有节点数据（增量时注入提示词）
  const existingNode = await readMapNode(nodeId);
  const hasCache = hasMapContent(existingNode);
  const cachedJson = hasCache ? JSON.stringify({ ...existingNode!.structure, characters: undefined }) : '';
  const cachedSvg = hasCache ? existingNode!.svg : '';
  const cachedDesc = existingNode ? JSON.stringify(existingNode.explorationDesc) : '';

  // 4. 组装提示词
  const style: MapStyle = index.defaultStyle || 'auto';
  const prompt = buildLargeMapPrompt({ rootName: nodeName, style, hasCache, mapSize: computeMapSize(descendantIds.length) });

  // 5. 组装 user_input
  const userInput = assembleNodeMapLibraryUserInput({
    libraryText,
    childDescText,
    cachedJson,
    cachedSvg,
    cachedDesc,
    promptText: prompt,
    extraPrompt,
  });

  // 6. 状态提示 + API 校验（进行中提示由统一 AI 活动注册表负责）
  const apiErr = validateCustomApiConfig('map');
  if (apiErr) { showApiConfigError('地图生成', apiErr); return null; }

  // 7. 标记生成中
  MapState.isGenerating = true;
  const mapChatKeyAtStart = getCurrentStoryChatKey(); // F5 代际守卫：发起时的聊天身份
  const statusDiv = document.getElementById('mapStatus');
  if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator loading"></span><span>生成中...</span>';

  try {
    // 8. 调用 AI
    const contextCount = config.mapContextCount || 20;
    const result = await callGenerateRaw(userInput, contextCount);
    if (!result) {
      getToastr()?.error('地图生成失败：AI 无响应', '地图库');
      return null;
    }

    // 9. 解析三段输出（复用 extractIncrFromResult）
    const parsed = extractIncrFromResult(result);
    if (!parsed.structure || !parsed.svg) {
      getToastr()?.error('地图生成失败：未解析到 JSON 或 SVG', '地图库');
      return null;
    }

    // 10. resolveExits（确保子节点入树）
    // AI 输出的 exits 含 targetName（运行时存在但 MapExit 类型未声明），用 as any 绕过类型检查
    const aiExits = Array.isArray((parsed.structure as any).exits) ? (parsed.structure as any).exits : [];
    const { exits: resolvedExits, index: idx2 } = resolveExits(index, nodeId, aiExits);

    // 11. 构建 MapNode
    // 库路径无实际探索环节：不新增记录，只保留/收敛现有探索记录（旧数据超过 3 条时本地并入概况）
    const recordView = readExploreRecordView(existingNode);
    const node: MapNode = {
      version: 1,
      schema: 'map_node',
      nodeId,
      structure: {
        mapSize: parsed.structure.mapSize || DEFAULT_MAP_SIZE,
        rooms: parsed.structure.rooms || [],
        doors: parsed.structure.doors || [],
        exits: resolvedExits,
        characters: [],
      },
      svg: parsed.svg,
      explorationDesc: parsed.desc || { summary: '', items: [], directions: '' },
      exploreSummary: recordView.summary,
      exploreLog: recordView.entries,
    };

    // 12. 写入存储
    // F5 代际守卫：AI 请求期间切聊天 → 本结果属于旧聊天，不写入新聊天
    if (getCurrentStoryChatKey() !== mapChatKeyAtStart) {
      console.info('[map-system] library generate aborted: chat switched during generation');
      return null;
    }
    markNodeGenerated(idx2, nodeId, hashText(nodeName));
    const mapSaved = await writeMapNodeAndIndex(node, idx2);
    if (mapSaved) {
      void scheduleFirstMapSceneGeneration(
        node,
        buildMapSceneNodeIdentity(
          node.nodeId,
          deriveFullPathFromIndex(idx2, node.nodeId) || nodeName,
          nodeName,
          hashText(nodeName + JSON.stringify(node.explorationDesc)),
        ),
      );
    }

    // 成就打点
    try { (window as any).__ubEmitAchievement?.('map_large_generated', {}); } catch (_e) { /* ignore */ }
    try { (window as any).__ubEmitAchievement?.('action-on-date', { action: 'map_large_generated' }); } catch (_e) { /* ignore */ }

    getToastr()?.success(`「${nodeName}」地图生成完成`, '地图库');
    return node;
  } catch (e) {
    console.error('[map-system] generateNodeMapFromLibrary 失败:', e);
    getToastr()?.error('地图生成失败', '地图库');
    return null;
  } finally {
    MapState.isGenerating = false;
    if (statusDiv) statusDiv.innerHTML = '<span class="status-indicator"></span><span>就绪</span>';
  }
}

/** 组装库路径 user_input（地点相关条目库 + 已探索地点 + 现有介绍 + 现有 JSON + 现有 SVG + 提示词） */
function assembleNodeMapLibraryUserInput(opts: {
  libraryText: string;
  childDescText: string | null;
  cachedJson: string;
  cachedSvg: string;
  cachedDesc: string;
  promptText: string;
  extraPrompt?: string;
}): string {
  const parts: string[] = [];
  if (opts.libraryText) {
    parts.push(`${LARGE_MAP_INPUT_SECTIONS.libraryHeader}\n${opts.libraryText}`);
  }
  if (opts.childDescText) {
    parts.push(`${LARGE_MAP_INPUT_SECTIONS.childDescHeader}\n${opts.childDescText}`);
  }
  if (opts.cachedDesc) {
    parts.push(`${LARGE_MAP_INPUT_SECTIONS.currentDescHeader}\n${opts.cachedDesc}`);
  }
  if (opts.cachedJson) {
    parts.push(`${LARGE_MAP_INPUT_SECTIONS.cacheJsonHeader}\n${opts.cachedJson}`);
  }
  if (opts.cachedSvg) {
    parts.push(`${LARGE_MAP_INPUT_SECTIONS.cacheSvgHeader}\n${opts.cachedSvg}`);
  }
  parts.push(opts.promptText);
  // 长按额外提示词：宏展开后追加在末尾（对齐大调查"末尾作为附加约束"，不干扰核心格式指令）
  if (opts.extraPrompt) {
    parts.push(LARGE_MAP_INPUT_SECTIONS.extraHeader + '\n' + expandMacros(opts.extraPrompt.trim()));
  }
  return parts.join('\n\n');
}

/**
 * 判断节点是否已生成地图（替代原 hasLargeMap）。
 * 存储统一后，父节点和叶子节点统一用此判断。
 */
export async function isNodeGenerated(nodeId: string): Promise<boolean> {
  const index = await readTreeIndex();
  const node = index.nodes[nodeId];
  return !!node && node.status === 'generated';
}

// ─────────────────────────────────────────────────────────────
// 初始化
// ─────────────────────────────────────────────────────────────
export async function initMapSystem(): Promise<void> {
  if (MapState.isGenerating) return;
  await _refreshMap();
}

/**

 * 移动地图库节点及其子树到另一个父节点之下。
 *
 * 委托到 map-tree-store 的 moveMapNodeInStorage 执行完整存储迁移，
 * 并附带 toastr 通知。
 *
 * @param nodeId 要移动的节点 ID
 * @param newParentId 目标父节点 ID，null 表示移至根级别
 */
export async function moveMapNode(
  nodeId: string,
  newParentId: string | null,
): Promise<{ ok: boolean; movedCount: number; error?: string }> {
  const result = await moveMapNodeInStorage(nodeId, newParentId);
  const t = getToastr();
  if (result.ok) {

    t?.success(`已移动 ${result.movedCount} 个节点`, '地图库');
  } else {
    t?.error(result.error || '移动失败', '地图库');
  }
  return result;
}
