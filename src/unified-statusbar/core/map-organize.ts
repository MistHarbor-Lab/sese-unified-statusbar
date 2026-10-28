// ===== AI 地图整理（纯逻辑 + 一次 AI 请求）=====
//
// 职责：
//   - 把地图树压成「M1..Mn + 名称/层级/当前地点」的 AI 输入（不发送地图内容）；
//   - 调宅仙小助手同一 API 预设，拿回严格 JSON 建议；
//   - 归一化 AI 输出（编号/路径/名称 → 真实节点，过滤未知与重复）；
//   - 在内存索引副本上按 rename → move → merge → delete 顺序试算，
//     产出每条建议的可用性、执行步骤与预览数据。
//
// 纪律：
//   - 本模块不写存储、不碰 DOM；执行在 renderers/map-organize-panel.ts。
//   - 只使用现有树操作原语（renameNode / moveSubtreeInIndex / planMapNodeMerge / 纯移树），
//     不复制地图合并的存储编排。
//   - AI 输入只含名称与层级；描述/地图/场景图仅由前端本地读取用于风险标注与合并来源默认值。

import { getTavernHelper } from './env';
import { getAssistantApiConfig, validateAssistantApiConfig, withTextAiRetry, type TextAiContext } from './api-config';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import { parseAiJsonObject } from './ai-parse';
import { plainClone } from './deep-clone';
import {
  checkCanMoveTo,
  collectDescendantNodeIds,
  deriveFullPathFromIndex,
  listAllNodesForUI,
  moveSubtreeInIndex,
  normalizeLocationPath,
  renameNode,
  type MapNodeStatus,
  type MapTreeIndex,
} from './map-tree-store';
import { inspectMapNodeMerge, planMapNodeMerge } from './map-merge';

export const MAP_ORGANIZE_MAX_NODES = 500;
export const MAP_ORGANIZE_MAX_CHANGES = 60;

export type MapOrganizeOpType = 'rename' | 'move' | 'merge' | 'delete';

export interface MapOrganizeRef {
  ref: string;
  nodeId: string;
  name: string;
  parentId: string | null;
  path: string;
  depth: number;
  order: number;
  status: MapNodeStatus;
  finalChild: boolean;
}

export interface MapOrganizeInputNode {
  id: string;
  level: number;
  path: string;
  final: boolean;
}

export interface MapOrganizeInput {
  count: number;
  current?: string;
  nodes: MapOrganizeInputNode[];
}

export interface MapOrganizeCatalog {
  index: MapTreeIndex;
  refs: MapOrganizeRef[];
  refsByRef: Map<string, MapOrganizeRef>;
  refsByNodeId: Map<string, MapOrganizeRef>;
  paths: Map<string, MapOrganizeRef[]>;
  names: Map<string, MapOrganizeRef[]>;
  input: MapOrganizeInput;
  /** 节点身份/名称/父级/状态/终点标记的稳定指纹；应用前比对，防止 AI 思考期间树变了。 */
  fingerprint: string;
  currentNodeId: string | null;
}

export interface MapOrganizeRawChange {
  op?: unknown;
  target?: unknown;
  source?: unknown;
  parent?: unknown;
  name?: unknown;
  reason?: unknown;
}

export interface MapOrganizeReply {
  summary: string;
  changes: MapOrganizeRawChange[];
  raw: string;
}

export interface MapOrganizeSuggestion {
  id: string;
  order: number;
  op: MapOrganizeOpType;
  target: MapOrganizeRef;
  source?: MapOrganizeRef;
  /** move 专用：null = 移到根级。 */
  parent?: MapOrganizeRef | null;
  /** rename 专用。 */
  name?: string;
  reason: string;
  raw: MapOrganizeRawChange;
}

export interface MapOrganizeIgnored {
  id: string;
  op: string;
  reason: string;
  raw: MapOrganizeRawChange;
}

export interface MapOrganizeNormalized {
  summary: string;
  suggestions: MapOrganizeSuggestion[];
  ignored: MapOrganizeIgnored[];
  truncated: boolean;
}

export interface MapOrganizePlanOptions {
  selected: Iterable<string>;
  renameValues?: Record<string, string>;
  mergeChoices?: Record<string, { descriptionSourceId?: string; visualSourceId?: string }>;
  now?: number;
}

export interface MapOrganizePlanItem {
  suggestion: MapOrganizeSuggestion;
  selected: boolean;
  valid: boolean;
  reason?: string;
  cascadeNodeIds?: string[];
}

export interface MapOrganizeStep {
  suggestionId: string;
  op: MapOrganizeOpType;
  targetNodeId: string;
  /** 操作完成后的节点 ID（move 会因路径变化重派生；用于删除时判断它是否仍落在被删子树里）。 */
  targetNodeIdAfter?: string;
  targetPath: string;
  targetName: string;
  parentNodeId?: string | null;
  parentPath?: string;
  sourceNodeId?: string;
  sourcePath?: string;
  sourceName?: string;
  name?: string;
  reason: string;
  mergeDescriptionSourceId?: string;
  mergeVisualSourceId?: string;
  cascadeNodeIds?: string[];
}

export interface MapOrganizePreviewRemoved {
  nodeId: string;
  name: string;
  kind: 'merge' | 'delete';
  note: string;
  originalParentId: string | null;
  order: number;
  cascadeCount: number;
}

export interface MapOrganizePreview {
  finalIndex: MapTreeIndex;
  renamed: Record<string, { from: string; to: string }>;
  moved: Record<string, { fromParentId: string | null }>;
  received: Record<string, string[]>;
  removed: MapOrganizePreviewRemoved[];
}

export interface MapOrganizePlan {
  items: MapOrganizePlanItem[];
  steps: MapOrganizeStep[];
  finalIndex: MapTreeIndex;
  preview: MapOrganizePreview;
  counts: Record<MapOrganizeOpType, number>;
  summary: string;
}

const OP_ORDER: Record<MapOrganizeOpType, number> = { rename: 0, move: 1, merge: 2, delete: 3 };
const ALLOWED_OPS = new Set<string>(['rename', 'move', 'merge', 'delete']);
const NAME_SEPARATOR_RE = /[-－—–\s]/;
const NAME_CONTROL_RE = /[\u0000-\u001f\u007f]/;

function isRootToken(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const text = String(value).trim().toLowerCase();
  return text === '' || text === 'root' || text === '__root__' || text === 'null' || text === 'none';
}

/** 构建 AI 输入 + 引用表 + 指纹；只读取索引里的名称/层级，不读地图内容。 */
export function buildMapOrganizeCatalog(index: MapTreeIndex, currentNodeId?: string | null): MapOrganizeCatalog {
  const uiNodes = listAllNodesForUI(index);
  const refs: MapOrganizeRef[] = uiNodes.map((node, order) => ({
    ref: `M${order + 1}`,
    nodeId: node.nodeId,
    name: node.name,
    parentId: node.parentId,
    path: node.fullPath,
    depth: node.depth,
    order,
    status: node.status,
    finalChild: node.finalChild,
  }));
  const refsByRef = new Map(refs.map(ref => [ref.ref, ref]));
  const refsByNodeId = new Map(refs.map(ref => [ref.nodeId, ref]));
  const paths = new Map<string, MapOrganizeRef[]>();
  const names = new Map<string, MapOrganizeRef[]>();
  for (const ref of refs) {
    const pathKey = normalizeLocationPath(ref.path);
    const pathList = paths.get(pathKey) || [];
    pathList.push(ref);
    paths.set(pathKey, pathList);
    const nameList = names.get(ref.name.trim()) || [];
    nameList.push(ref);
    names.set(ref.name.trim(), nameList);
  }
  const currentRef = currentNodeId ? refsByNodeId.get(currentNodeId) : undefined;
  const input: MapOrganizeInput = {
    count: refs.length,
    ...(currentRef ? { current: currentRef.ref } : {}),
    nodes: refs.map(ref => ({
      id: ref.ref,
      level: ref.depth,
      path: ref.path,
      final: ref.finalChild,
    })),
  };
  const fingerprint = refs
    .slice()
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId))
    .map(ref => [ref.nodeId, ref.name, ref.parentId || '', ref.status, ref.finalChild ? '1' : '0'].join('|'))
    .join('\n');
  return {
    index,
    refs,
    refsByRef,
    refsByNodeId,
    paths,
    names,
    input,
    fingerprint,
    currentNodeId: currentRef?.nodeId || null,
  };
}

const PROMPT_RULES = [
  '你是地图库结构审校器。输入是当前地图树的全部节点，只含编号、层级、路径名称和是否终点；不含地图画面、描述或剧情。',
  '请只依据名称含义与层级关系，找出：',
  '1) 层级错误：节点挂在不合逻辑的父级下，或只是无意义的中间容器；',
  '2) 名称不当：错别字、口语残片、临时编号、与同层命名风格不一致；',
  '3) 重复：同一地点以不同名称或层级出现多次。',
  '',
  '只输出一个 JSON 对象，不要 Markdown 围栏、不要解释：',
  '{"summary":"一句话总体判断","changes":[...]}',
  '',
  '操作格式：',
  '{"op":"rename","target":"M3","name":"新名称","reason":"不超过40字"}',
  '{"op":"move","target":"M5","parent":"M2","reason":"不超过40字"}   // parent 为 null 表示移到根级',
  '{"op":"merge","target":"M6","source":"M9","reason":"不超过40字"}  // target 为保留节点，source 并入后删除',
  '{"op":"delete","target":"M10","reason":"不超过40字"}              // 删除会连同所有子节点一起删除',
  '',
  '规则：',
  '1. 只能使用输入 nodes 中出现的编号；不得编造节点。',
  '2. 拿不准就不要改；结构合理时 changes 为空数组。',
  '3. 同一节点最多一个结构操作（move/merge/delete）；rename 可以另外叠加。',
  '4. 合并只支持两两；target 是保留节点，source 并入后删除。父子节点不能合并；若同层有重名子节点，先不要提出合并。',
  '5. 删除会连同其所有子节点一起删除；若只是想清理无意义容器，请先用 move 把它的子节点移到上一层，再 delete 该容器。',
  '6. 名称不得包含 -、－、—、–、空白或换行；长度 1~20 字。',
  '7. reason 不超过 40 字。',
  '8. 当前地点用 current 标出；不要因为它是“当前”就强行保留坏名字。',
].join('\n');

export function buildMapOrganizePrompt(catalog: MapOrganizeCatalog): string {
  return `${PROMPT_RULES}\n\n输入：\n${JSON.stringify(catalog.input)}`;
}

/** 一次 AI 请求。API 与宅仙小助手共用（assistantApiPresetId），重试作用域同为 assistant。 */
export async function requestMapOrganize(
  catalog: MapOrganizeCatalog,
  signal?: AbortSignal,
): Promise<MapOrganizeReply> {
  const apiError = validateAssistantApiConfig();
  if (apiError) throw new Error(apiError);
  const helper = getTavernHelper();
  if (!helper || typeof helper.generateRaw !== 'function') {
    throw new Error('无法访问 generateRaw，请检查酒馆助手版本');
  }
  const prompt = buildMapOrganizePrompt(catalog);
  const raw = await withTextAiRetry('assistant', async (ctx: TextAiContext) => {
    const result = await helper.generateRaw({
      should_silence: true,
      generation_id: ctx.generationId,
      user_input: prompt,
      ordered_prompts: [
        ...getJailbreakHeadPrompts(),
        'user_input',
        ...getJailbreakTailPrompts(),
      ],
      max_chat_history: 0,
      custom_api: getAssistantApiConfig(),
    });
    if (signal?.aborted) throw new Error('请求已取消');
    if (typeof result !== 'string' || !result.trim()) throw new Error('AI 返回为空');
    return result;
  }, { signal, feature: 'mapOrganize' });
  const parsed = parseAiJsonObject(raw);
  if (!parsed.value) throw new Error(parsed.error || 'AI 返回格式无法解析');
  const summary = String(parsed.value.summary ?? '').trim().slice(0, 200);
  const changes = Array.isArray(parsed.value.changes)
    ? (parsed.value.changes as MapOrganizeRawChange[])
    : [];
  return { summary, changes, raw };
}

function resolveRefToken(token: unknown, catalog: MapOrganizeCatalog): MapOrganizeRef | null {
  const text = String(token ?? '').trim();
  if (!text) return null;
  const direct = catalog.refsByRef.get(text) || catalog.refsByRef.get(text.toUpperCase());
  if (direct) return direct;
  const byNodeId = catalog.refsByNodeId.get(text);
  if (byNodeId) return byNodeId;
  const pathMatches = catalog.paths.get(normalizeLocationPath(text)) || [];
  if (pathMatches.length === 1) return pathMatches[0];
  const nameMatches = catalog.names.get(text) || [];
  if (nameMatches.length === 1) return nameMatches[0];
  return null;
}

function normalizedReason(value: unknown): string {
  return String(value ?? '').trim().slice(0, 80);
}

/** AI 输出归一化：编号 → 真实节点；未知/重复/缺字段进 ignored，不阻断其它建议。 */
export function normalizeMapOrganizeReply(
  reply: MapOrganizeReply,
  catalog: MapOrganizeCatalog,
): MapOrganizeNormalized {
  const suggestions: MapOrganizeSuggestion[] = [];
  const ignored: MapOrganizeIgnored[] = [];
  const seen = new Set<string>();
  const changes = reply.changes.slice(0, MAP_ORGANIZE_MAX_CHANGES);
  const truncated = reply.changes.length > MAP_ORGANIZE_MAX_CHANGES;
  changes.forEach((raw, index) => {
    const id = `s${index + 1}`;
    const opText = String(raw?.op ?? '').trim().toLowerCase();
    if (!ALLOWED_OPS.has(opText)) {
      ignored.push({ id, op: opText, reason: `不支持的操作：${opText || '空'}`, raw });
      return;
    }
    const op = opText as MapOrganizeOpType;
    const target = resolveRefToken(raw.target, catalog);
    if (!target) {
      ignored.push({ id, op, reason: `找不到目标节点：${String(raw.target ?? '空')}`, raw });
      return;
    }
    let source: MapOrganizeRef | undefined;
    let parent: MapOrganizeRef | null | undefined;
    if (op === 'merge') {
      source = resolveRefToken(raw.source, catalog) || undefined;
      if (!source) {
        ignored.push({ id, op, reason: `找不到并入节点：${String(raw.source ?? '空')}`, raw });
        return;
      }
      if (source.nodeId === target.nodeId) {
        ignored.push({ id, op, reason: '不能把节点并入自身', raw });
        return;
      }
    }
    if (op === 'move') {
      if (isRootToken(raw.parent)) parent = null;
      else {
        parent = resolveRefToken(raw.parent, catalog) || undefined;
        if (!parent) {
          ignored.push({ id, op, reason: `找不到目标父级：${String(raw.parent ?? '空')}`, raw });
          return;
        }
      }
    }
    let name: string | undefined;
    if (op === 'rename') {
      name = String(raw.name ?? '').trim();
      if (!name) {
        ignored.push({ id, op, reason: '缺少新名称', raw });
        return;
      }
    }
    const dedupeKey = [op, target.nodeId, source?.nodeId || '', op === 'move' ? (parent?.nodeId || 'root') : ''].join('|');
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    suggestions.push({
      id,
      order: index,
      op,
      target,
      ...(source ? { source } : {}),
      ...(op === 'move' ? { parent: parent || null } : {}),
      ...(name ? { name } : {}),
      reason: normalizedReason(raw.reason),
      raw,
    });
  });
  return {
    summary: reply.summary || 'AI 已完成审阅',
    suggestions,
    ignored,
    truncated,
  };
}

function validateName(index: MapTreeIndex, nodeId: string, value: string): string | null {
  const name = String(value || '').trim();
  if (!name) return '名称不能为空';
  if (Array.from(name).length > 20) return '名称最多 20 字';
  if (NAME_SEPARATOR_RE.test(name)) return '名称不能包含横杠或空白（- 是层级分隔符）';
  if (NAME_CONTROL_RE.test(name)) return '名称包含非法控制字符';
  const node = index.nodes[nodeId];
  if (!node) return '节点不存在';
  const siblingIds = node.parentId
    ? (index.nodes[node.parentId]?.childIds || [])
    : index.rootNodeIds;
  for (const id of siblingIds) {
    if (id !== nodeId && index.nodes[id]?.name.trim() === name) return '与同层节点重名';
  }
  return null;
}

function removeSubtree(index: MapTreeIndex, nodeId: string): string[] {
  const node = index.nodes[nodeId];
  if (!node) return [];
  const ids = [nodeId, ...collectDescendantNodeIds(index, nodeId)];
  const removed = new Set(ids);
  if (node.parentId && index.nodes[node.parentId]) {
    index.nodes[node.parentId].childIds = index.nodes[node.parentId].childIds.filter(id => id !== nodeId);
  }
  index.rootNodeIds = index.rootNodeIds.filter(id => id !== nodeId);
  index.favorites = (index.favorites || []).filter(id => !removed.has(id));
  for (const id of ids) delete index.nodes[id];
  index.locationAliases = Object.fromEntries(
    Object.entries(index.locationAliases || {}).filter(([, alias]) => !removed.has(alias.targetNodeId)),
  );
  return ids;
}

function markInvalid(item: MapOrganizePlanItem, reason: string): void {
  item.valid = false;
  item.reason = reason;
}

/**
 * 在索引副本上按 rename → move → merge → delete 试算。
 *
 * 未勾选的建议也会检查（用于展示“可执行/冲突”），但只有勾选且合法的才写入副本并产出 steps。
 * 删除排在最后：若某删除范围包含前面的合并保留节点 → 该删除不可执行；
 * 若包含前面的改名/移动目标 → 那些操作标记为“将被删除”，并从执行步骤中移除。
 */
export function planMapOrganize(
  catalog: MapOrganizeCatalog,
  normalized: MapOrganizeNormalized,
  options: MapOrganizePlanOptions,
): MapOrganizePlan {
  let index = plainClone(catalog.index);
  const selected = new Set(options.selected);
  const now = options.now ?? Date.now();
  const idByRef = new Map(catalog.refs.map(ref => [ref.ref, ref.nodeId]));
  const items: MapOrganizePlanItem[] = normalized.suggestions.map(suggestion => ({
    suggestion,
    selected: selected.has(suggestion.id),
    valid: true,
  }));
  const itemBySuggestionId = new Map(items.map(item => [item.suggestion.id, item]));
  const ordered = items
    .slice()
    .sort((a, b) => OP_ORDER[a.suggestion.op] - OP_ORDER[b.suggestion.op] || a.suggestion.order - b.suggestion.order);
  const steps: MapOrganizeStep[] = [];
  const preview: MapOrganizePreview = {
    finalIndex: index,
    renamed: {},
    moved: {},
    received: {},
    removed: [],
  };
  const mergeSurvivors = new Set<string>();
  const movedRefs = new Set<string>();

  const resolveLive = (nodeId: string): string | null => (index.nodes[nodeId] ? nodeId : null);

  for (const item of ordered) {
    const suggestion = item.suggestion;
    const targetId = idByRef.get(suggestion.target.ref) || suggestion.target.nodeId;
    if (!resolveLive(targetId)) {
      markInvalid(item, '节点已不存在');
      continue;
    }
    if (suggestion.op === 'rename') {
      const name = String(options.renameValues?.[suggestion.id] ?? suggestion.name ?? '').trim();
      const nameError = validateName(index, targetId, name);
      if (nameError) {
        markInvalid(item, nameError);
        continue;
      }
      if (name === index.nodes[targetId].name) {
        markInvalid(item, '名称未变化');
        continue;
      }
      if (!item.selected) continue;
      const oldName = index.nodes[targetId].name;
      const oldPath = deriveFullPathFromIndex(index, targetId);
      if (!renameNode(index, targetId, name)) {
        markInvalid(item, '重命名失败');
        continue;
      }
      preview.renamed[targetId] = { from: oldName, to: name };
      steps.push({
        suggestionId: suggestion.id,
        op: 'rename',
        targetNodeId: targetId,
        targetPath: oldPath,
        targetName: name,
        name,
        reason: suggestion.reason,
      });
      continue;
    }
    if (suggestion.op === 'move') {
      const parentRef = suggestion.parent;
      const parentId = parentRef ? (idByRef.get(parentRef.ref) || parentRef.nodeId) : null;
      if (parentRef && !resolveLive(parentId as string)) {
        markInvalid(item, '目标父级已不存在');
        continue;
      }
      const check = checkCanMoveTo(index, targetId, parentId);
      if (!check.ok) {
        markInvalid(item, check.reason || '不允许的移动');
        continue;
      }
      if (parentId === null) {
        const movingName = (index.nodes[targetId]?.name || '').trim();
        const duplicateRoot = index.rootNodeIds.some(id => id !== targetId && (index.nodes[id]?.name || '').trim() === movingName);
        if (duplicateRoot) {
          markInvalid(item, '根级已有同名节点');
          continue;
        }
      }
      if (!item.selected) continue;
      if (movedRefs.has(suggestion.target.ref)) {
        markInvalid(item, '同一节点有多个移动建议');
        continue;
      }
      movedRefs.add(suggestion.target.ref);
      const oldParentId = index.nodes[targetId].parentId;
      const oldPath = deriveFullPathFromIndex(index, targetId);
      const oldName = index.nodes[targetId].name;
      const moved = moveSubtreeInIndex(index, targetId, parentId);
      if ('error' in moved) {
        markInvalid(item, moved.error);
        continue;
      }
      index = moved.index;
      for (const [oldId, newId] of moved.migration.entries()) {
        const ref = catalog.refs.find(candidate => idByRef.get(candidate.ref) === oldId);
        if (ref) idByRef.set(ref.ref, newId);
        // 先改名后移动：预览标注的键要从旧 nodeId 跟到新 nodeId，否则右侧看不到“改/移”叠加。
        if (preview.renamed[oldId]) {
          preview.renamed[newId] = preview.renamed[oldId];
          delete preview.renamed[oldId];
        }
        if (preview.moved[oldId]) {
          preview.moved[newId] = preview.moved[oldId];
          delete preview.moved[oldId];
        }
        if (preview.received[oldId]) {
          preview.received[newId] = preview.received[oldId];
          delete preview.received[oldId];
        }
        // 后续删除判断用“最终 ID”：前面的改名/再次移动也要跟到新 ID。
        for (const prior of steps) {
          if (prior.op === 'rename' && prior.targetNodeId === oldId) prior.targetNodeIdAfter = newId;
          if (prior.op === 'move' && (prior.targetNodeIdAfter || prior.targetNodeId) === oldId) prior.targetNodeIdAfter = newId;
        }
      }
      const newId = moved.migration.get(targetId) || targetId;
      if (!preview.moved[newId]) preview.moved[newId] = { fromParentId: oldParentId };
      steps.push({
        suggestionId: suggestion.id,
        op: 'move',
        targetNodeId: targetId,
        targetNodeIdAfter: newId,
        targetPath: oldPath,
        targetName: oldName,
        parentNodeId: parentId,
        parentPath: parentId ? deriveFullPathFromIndex(index, parentId) : '',
        reason: suggestion.reason,
      });
      continue;
    }
    if (suggestion.op === 'merge') {
      const sourceId = idByRef.get(suggestion.source!.ref) || suggestion.source!.nodeId;
      if (!resolveLive(sourceId)) {
        markInvalid(item, '并入节点已不存在');
        continue;
      }
      const inspection = inspectMapNodeMerge(
        { index, mapNodes: {}, sceneRecords: {} },
        targetId,
        sourceId,
      );
      if (!inspection.ok) {
        markInvalid(item, inspection.reason || '这两个节点不能合并');
        continue;
      }
      if (!item.selected) continue;
      const planned = planMapNodeMerge(
        { index, mapNodes: {}, sceneRecords: {} },
        {
          leftNodeId: targetId,
          rightNodeId: sourceId,
          nameSourceId: targetId,
          descriptionSourceId: targetId,
          visualSourceId: targetId,
        },
        now,
      );
      if (!planned.ok) {
        markInvalid(item, planned.error || '这两个节点不能合并');
        continue;
      }
      const choice = options.mergeChoices?.[suggestion.id];
      const descriptionSourceId = choice?.descriptionSourceId === sourceId ? sourceId : targetId;
      const visualSourceId = choice?.visualSourceId === sourceId ? sourceId : targetId;
      const sourceName = index.nodes[sourceId]?.name || suggestion.source!.name;
      const sourceParentId = index.nodes[sourceId]?.parentId ?? null;
      const sourcePath = deriveFullPathFromIndex(index, sourceId);
      const targetName = index.nodes[targetId]?.name || suggestion.target.name;
      index = planned.plan.snapshot.index;
      for (const [oldId, newId] of Object.entries(planned.plan.movedIdMap)) {
        const ref = catalog.refs.find(candidate => idByRef.get(candidate.ref) === oldId);
        if (ref) idByRef.set(ref.ref, newId);
      }
      mergeSurvivors.add(targetId);
      (preview.received[targetId] = preview.received[targetId] || []).push(sourceName);
      preview.removed.push({
        nodeId: sourceId,
        name: sourceName,
        kind: 'merge',
        note: `并入 ${targetName}`,
        originalParentId: sourceParentId,
        order: suggestion.source!.order,
        cascadeCount: 1,
      });
      steps.push({
        suggestionId: suggestion.id,
        op: 'merge',
        targetNodeId: targetId,
        targetPath: deriveFullPathFromIndex(index, targetId),
        targetName,
        sourceNodeId: sourceId,
        sourcePath,
        sourceName,
        reason: suggestion.reason,
        mergeDescriptionSourceId: descriptionSourceId,
        mergeVisualSourceId: visualSourceId,
      });
      continue;
    }

    // delete
    const subtree = [targetId, ...collectDescendantNodeIds(index, targetId)];
    item.cascadeNodeIds = subtree;
    if (subtree.some(id => mergeSurvivors.has(id))) {
      markInvalid(item, '删除范围包含本次合并的保留节点');
      continue;
    }
    if (!item.selected) continue;
    const targetName = index.nodes[targetId]?.name || suggestion.target.name;
    const targetPath = deriveFullPathFromIndex(index, targetId);
    const parentId = index.nodes[targetId]?.parentId ?? null;
    const removedIds = removeSubtree(index, targetId);
    preview.removed.push({
      nodeId: targetId,
      name: targetName,
      kind: 'delete',
      note: removedIds.length > 1 ? `删除 ${removedIds.length} 个节点` : '删除',
      originalParentId: parentId,
      order: suggestion.target.order,
      cascadeCount: removedIds.length,
    });
    steps.push({
      suggestionId: suggestion.id,
      op: 'delete',
      targetNodeId: targetId,
      targetPath,
      targetName,
      reason: suggestion.reason,
      cascadeNodeIds: removedIds,
    });
    // 删除排在最后：此前落在该子树里的改名/移动不会生效，标记失效并从执行步骤移除。
    const removedSet = new Set(removedIds);
    for (let i = steps.length - 2; i >= 0; i--) {
      const prior = steps[i];
      if (prior.op !== 'rename' && prior.op !== 'move') continue;
      const afterId = prior.targetNodeIdAfter || prior.targetNodeId;
      if (!removedSet.has(afterId)) continue;
      const priorItem = itemBySuggestionId.get(prior.suggestionId);
      if (priorItem) markInvalid(priorItem, '该节点将被删除，操作不会生效');
      steps.splice(i, 1);
    }
  }

  const finalIndex = index;
  preview.finalIndex = finalIndex;
  const counts: Record<MapOrganizeOpType, number> = { rename: 0, move: 0, merge: 0, delete: 0 };
  for (const step of steps) counts[step.op] += 1;
  return {
    items,
    steps,
    finalIndex,
    preview,
    counts,
    summary: normalized.summary,
  };
}
