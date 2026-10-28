// ===== 地图树存储层（纯逻辑，无 DOM 无 AI 调用） =====
//
// 职责：
//   - 类型定义（MapTreeIndex / MapNode / MapLarge 等，全模块共享）
//   - nodeId 派生 + 地点层级解析（normalize / parseLocationHierarchy / buildAncestorChain）
//   - initMapTreeStore：启动占位（旧平面缓存迁移已移除）
//
// 依赖纪律：本模块不得 import './map-system'（期2 起 map-system 反过来 import 本模块，
// 避免循环依赖）。
//
// 关联 spec：docs/superpowers/specs/2026-07-10-map-system-overhaul-design.md §3/§4/§9

import {
  type MapStyle,
} from './constants';
import type { MapRole } from './map-renderer';
import { deleteStoryFeature, exportStoryFeatures, readStoryFeature, readStoryFeaturesBatch, writeStoryFeature, writeStoryFeatures } from './story-floor-store';
import { listMapSceneImages, MAP_SCENE_IMAGE_INDEX_KEY, MAP_SCENE_IMAGE_KEY_PREFIX } from './map-scene-store';

// ─────────────────────────────────────────────────────────────
// 类型定义（全模块共享，期2-4 各模块 import）
// ─────────────────────────────────────────────────────────────
export type { MapStyle } from './constants';

export type MapNodeStatus = 'generated' | 'pending' | 'text-only';

export interface MapTreeNode {
  nodeId: string;
  name: string;
  parentId: string | null;
  childIds: string[];
  status: MapNodeStatus;
  lastStoryHash: string;
  updatedAt: number;
  /** 是否为最终子节点（软锁定）：更细在场地点自动归并到该节点。缺字段视为 false。 */
  finalChild?: boolean;
}

export interface MapLocationAlias {
  targetNodeId: string;
  createdAt: number;
}

export interface MapTreeIndex {
  version: 1;
  schema: 'map_tree_index';
  defaultStyle: MapStyle;
  rootNodeIds: string[];
  nodes: Record<string, MapTreeNode>;
  favorites: string[];
  /** 非规范地点表述 → 规范地图节点。规范路径由树拓扑实时派生，不在此重复存储。 */
  locationAliases: Record<string, MapLocationAlias>;
}

export interface MapExit {
  id: string;
  label: string;
  targetNodeId: string;
  kind: 'parent' | 'child' | 'sibling';
  x: number;
  y: number;
}

export interface MapNodeRoom {
  id: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type?: 'room' | 'corridor' | 'landmark';
}

export interface MapNodeDoor {
  from?: string;
  to?: string;
  x: number;
  y: number;
}

export interface MapNodeCharacter {
  name: string;
  role?: MapRole;
  roomId?: string;
  x?: number;
  y?: number;
}

export interface MapNodeStructure {
  mapSize: { width: number; height: number };
  rooms: MapNodeRoom[];
  doors: MapNodeDoor[];
  exits: MapExit[];
  characters: MapNodeCharacter[];
}

export interface ExplorationDesc {
  summary: string;
  items: string[];
  directions: string;
}

export interface ExploreLogEntry {
  time: string;
  storyHash: string;
  note: string;
}

export interface MapNode {
  version: 1;
  schema: 'map_node';
  nodeId: string;
  structure: MapNodeStructure;
  svg: string;
  explorationDesc: ExplorationDesc;
  /** 探索情况总结：滚动压缩的旧记录。提示词要求 ≤200 字；前端不做硬截断。缺省视为空串。 */
  exploreSummary?: string;
  /** 最近探索增量记录，最多保留 3 条（见 EXPLORE_LOG_KEEP_LATEST）。 */
  exploreLog: ExploreLogEntry[];
}

// ─────────────────────────────────────────────────────────────
// 地点归一化与 nodeId 派生（spec §3.4 / §4.2）
// ─────────────────────────────────────────────────────────────
/** 层级分隔符：半角 - 全角 － 破折号 — – 短破折号 –（空白另行删除，见 normalizeLocationPath） */
const SEP_RE = /[-－—–]+/g;

/** 归一化地点为 fullPath：删空白 + 横杠类→半角 - + 合并连续 - + 去首尾 - */
export function normalizeLocationPath(location: string): string {
  return String(location || '')
    .replace(/\s+/g, '')    // 方案B：删所有空白，空白不作层级分隔符也不残留
    .replace(SEP_RE, '-')   // 横杠类 → 半角 -
    .replace(/-+/g, '-')    // 合并连续 -
    .replace(/^-|-$/g, ''); // 去首尾 -
}

/** djb2 哈希（spec §3.4），返回 base36 字符串 */
function djb2Hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h & h; // 转 32 位有符号
  }
  return (h >>> 0).toString(36); // 转无符号再 base36
}

/** nodeId 派生：'n_' + djb2hash(normalize(fullPath))。前端生成，AI 不参与。 */
export function deriveNodeId(fullPath: string): string {
  const norm = normalizeLocationPath(fullPath);
  return 'n_' + djb2Hash(norm);
}

/** 地点 → 层级解析：返回 segments（每段名）与归一化 fullPath */
export function parseLocationHierarchy(location: string): { segments: string[]; fullPath: string } {
  const norm = normalizeLocationPath(location);
  if (!norm) return { segments: [], fullPath: '' };
  const segments = norm.split('-').filter(Boolean);
  return { segments, fullPath: segments.join('-') };
}

/** 对每个前缀 i∈[1..n] 生成祖先链项（含叶子）。spec §4.2 步骤3。 */
export interface ChainEntry {
  fullPath: string;
  nodeId: string;
  name: string;
  /** 是否当前叶子节点（i === segments.length） */
  isLeaf: boolean;
}

export function buildAncestorChain(segments: string[]): ChainEntry[] {
  const chain: ChainEntry[] = [];
  for (let i = 1; i <= segments.length; i++) {
    const fp = segments.slice(0, i).join('-');
    chain.push({
      fullPath: fp,
      nodeId: deriveNodeId(fp),
      name: segments[i - 1],
      isLeaf: i === segments.length,
    });
  }
  return chain;
}

/** 从 index 拓扑（parentId 链）实时派生 fullPath。spec §2.3：fullPath 不冗余存储。 */
export function deriveFullPathFromIndex(index: MapTreeIndex, nodeId: string): string {
  const parts: string[] = [];
  let cur: MapTreeNode | undefined = index.nodes[nodeId];
  const guard = new Set<string>();
  while (cur && !guard.has(cur.nodeId)) {
    guard.add(cur.nodeId);
    parts.unshift(cur.name);
    cur = cur.parentId ? index.nodes[cur.parentId] : undefined;
  }
  return parts.join('-');
}

/** 空索引构造（迁移/初始化用） */
export function createEmptyIndex(): MapTreeIndex {
  return {
    version: 1,
    schema: 'map_tree_index',
    defaultStyle: 'auto',
    rootNodeIds: [],
    nodes: {},
    favorites: [],
    locationAliases: {},
  };
}

/** 构造空 pending 节点（拓扑占位，无重数据） */
export function createPendingNode(nodeId: string, name: string, parentId: string | null): MapTreeNode {
  return {
    nodeId,
    name,
    parentId,
    childIds: [],
    status: 'pending',
    lastStoryHash: '',
    updatedAt: 0,
    finalChild: false,
  };
}

// ─────────────────────────────────────────────────────────────
// 聊天楼层存储（story feature key）
// ─────────────────────────────────────────────────────────────
const MAP_INDEX_STORY_KEY = 'map.index';
export const MAP_NODE_STORY_PREFIX = 'map.node:';

// ─────────────────────────────────────────────────────────────
// 地图树变更监听器：4 个写原语（writeTreeIndex / writeMapNode /
// writeMapNodeAndIndex / deleteMapNode）成功后触发。
// 派生同步（概览行 map-overview-sync / 节点世界书条目 map-worldbook-inject）
// 各注册一个防抖回调。回调自行防抖+签名幂等。
// **map-tree-store 不 import 派生模块**，避免循环依赖——派生模块 import 本模块
// 并在模块加载时调用 registerMapTreeChangeListener 注册自身。
// ─────────────────────────────────────────────────────────────
type MapTreeChangeListener = () => void;
const MAP_TREE_LISTENERS: MapTreeChangeListener[] = [];
export function registerMapTreeChangeListener(cb: MapTreeChangeListener): void {
  if (typeof cb === 'function' && !MAP_TREE_LISTENERS.includes(cb)) MAP_TREE_LISTENERS.push(cb);
}
function fireMapTreeChange(): void {
  for (const cb of MAP_TREE_LISTENERS) {
    try { cb(); } catch (_e) { /* ignore listener error */ }
  }
}


export async function readTreeIndex(): Promise<MapTreeIndex> {
  const raw = readStoryFeature<any>(MAP_INDEX_STORY_KEY, null);
  if (raw && raw.schema === 'map_tree_index') {
    const nodes = raw.nodes && typeof raw.nodes === 'object' ? raw.nodes as Record<string, MapTreeNode> : {};
    const locationAliases: Record<string, MapLocationAlias> = {};
    if (raw.locationAliases && typeof raw.locationAliases === 'object') {
      for (const [path, aliasRaw] of Object.entries(raw.locationAliases as Record<string, any>)) {
        const normalizedPath = normalizeLocationPath(path);
        const targetNodeId = typeof aliasRaw === 'string'
          ? aliasRaw
          : typeof aliasRaw?.targetNodeId === 'string' ? aliasRaw.targetNodeId : '';
        if (!normalizedPath || !targetNodeId || !nodes[targetNodeId]) continue;
        locationAliases[normalizedPath] = {
          targetNodeId,
          createdAt: Number(aliasRaw?.createdAt) || 0,
        };
      }
    }
    return { ...raw, nodes, locationAliases } as MapTreeIndex;
  }
  return createEmptyIndex();
}

export async function writeTreeIndex(index: MapTreeIndex): Promise<boolean> {
  const ok = await writeStoryFeature(MAP_INDEX_STORY_KEY, index);
  if (ok) fireMapTreeChange();
  return ok;
}

function mapNodeStoryKey(nodeId: string): string {
  return MAP_NODE_STORY_PREFIX + nodeId;
}

export async function readMapNode(nodeId: string): Promise<MapNode | null> {
  const raw = readStoryFeature<any>(mapNodeStoryKey(nodeId), null);
  return raw && raw.schema === 'map_node' ? raw as MapNode : null;
}

/** 批量读多个节点（单次合并视图，逐存在键深拷贝；返回 nodeId → MapNode，非法/缺失不出现）。 */
export function readMapNodesBatch(nodeIds: readonly string[]): Record<string, MapNode> {
  const raws = readStoryFeaturesBatch(nodeIds.map(mapNodeStoryKey));
  const out: Record<string, MapNode> = {};
  for (const [key, raw] of Object.entries(raws)) {
    if (raw && (raw as any).schema === 'map_node') out[key.slice(MAP_NODE_STORY_PREFIX.length)] = raw as MapNode;
  }
  return out;
}

export async function writeMapNode(node: MapNode): Promise<boolean> {
  const ok = await writeStoryFeature(mapNodeStoryKey(node.nodeId), node);
  if (ok) fireMapTreeChange();
  return ok;
}

export async function writeMapNodeAndIndex(node: MapNode, index: MapTreeIndex): Promise<boolean> {
  const ok = await writeStoryFeatures({
    [mapNodeStoryKey(node.nodeId)]: node,
    [MAP_INDEX_STORY_KEY]: index,
  });
  if (ok) fireMapTreeChange();
  return ok;
}

export async function deleteMapNode(nodeId: string): Promise<boolean> {
  const ok = await deleteStoryFeature(mapNodeStoryKey(nodeId));
  if (ok) fireMapTreeChange();
  return ok;
}

// ─────────────────────────────────────────────────────────────
// 树拓扑维护（在内存 index 上操作，调用方负责 writeTreeIndex 落盘）
// ─────────────────────────────────────────────────────────────

/**
 * nodeId 碰撞消解（spec §14 风险对策）：若 baseNodeId 已存在但身份（name+parentId）
 * 与预期不符，追加 -2/-3... 后缀直到不冲突或命中同身份节点。
 * 返回最终应使用的 nodeId。
 */
export function resolveNodeIdCollision(
  index: MapTreeIndex,
  baseNodeId: string,
  expectedName: string,
  expectedParentId: string | null,
): string {
  let nodeId = baseNodeId;
  let suffix = 1;
  while (true) {
    const existing = index.nodes[nodeId];
    if (!existing) return nodeId; // 空位
    if (existing.name === expectedName && existing.parentId === expectedParentId) {
      return nodeId; // 同身份节点，复用
    }
    // 碰撞：换后缀重派
    suffix++;
    nodeId = `${baseNodeId}-${suffix}`;
  }
}

/**
 * 把一段地点的祖先链（含叶子）确保入 index 拓扑。
 * - 祖先（非叶子）：不存在则建 pending 节点；存在则确保 childIds 连通
 * - 叶子：不存在则建 pending；存在则不动其 status（由 markNodeGenerated 单独置 generated）
 * 返回 { index, leafNodeId, changed }。调用方仅在 changed 时写入 index。
 */
export function ensureChainInIndex(
  index: MapTreeIndex,
  segments: string[],
): { index: MapTreeIndex; leafNodeId: string | null; changed: boolean } {
  const chain = buildAncestorChain(segments);
  if (chain.length === 0) return { index, leafNodeId: null, changed: false };

  let prevId: string | null = null;
  let leafNodeId: string | null = null;
  let changed = false;

  for (const item of chain) {
    const parentId: string | null = prevId;
    const resolved = resolveNodeIdCollision(index, item.nodeId, item.name, parentId);
    let node = index.nodes[resolved];
    if (!node) {
      node = createPendingNode(resolved, item.name, parentId);
      index.nodes[resolved] = node;
      changed = true;
      if (parentId == null) {
        if (!index.rootNodeIds.includes(resolved)) {
          index.rootNodeIds.push(resolved);
          changed = true;
        }
      } else {
        const parent: MapTreeNode | undefined = index.nodes[parentId];
        if (parent && !parent.childIds.includes(resolved)) {
          parent.childIds.push(resolved);
          changed = true;
        }
      }
    } else if (parentId != null) {
      // 已存在：确保父子连通（移动/合并后可能 parentId 变化，此处仅补 childIds）
      const parent: MapTreeNode | undefined = index.nodes[parentId];
      if (parent && !parent.childIds.includes(resolved)) {
        parent.childIds.push(resolved);
        changed = true;
      }
    }
    prevId = resolved;
    if (item.isLeaf) leafNodeId = resolved;
  }

  return { index, leafNodeId, changed };
}

/**
 * 把某节点标记为指定状态并更新 lastStoryHash/updatedAt。
 * 调用方负责 writeTreeIndex(index)。
 */
export function markNodeStatus(
  index: MapTreeIndex,
  nodeId: string,
  storyHash: string,
  status: MapNodeStatus,
): void {
  const node = index.nodes[nodeId];
  if (!node) return;
  node.status = status;
  node.lastStoryHash = storyHash;
  node.updatedAt = Date.now();
}

/** 把某节点标记为 generated（已有地图画面）。 */
export function markNodeGenerated(
  index: MapTreeIndex,
  nodeId: string,
  storyHash: string,
): void {
  markNodeStatus(index, nodeId, storyHash, 'generated');
}

/** 把某节点标记为 text-only（只有文字记录，尚无地图画面）。 */
export function markNodeTextOnly(
  index: MapTreeIndex,
  nodeId: string,
  storyHash: string,
): void {
  markNodeStatus(index, nodeId, storyHash, 'text-only');
}

// ─────────────────────────────────────────────────────────────
// 清除操作（供 map-system.ts 的 clearCurrentMapCache / clearAllMapCache 调用）
// ─────────────────────────────────────────────────────────────

/**
 * 清除指定规范节点 id 的地图重数据 + 在索引中重置为 pending。
 * 保留树拓扑（父节点/兄弟节点不受影响），仅丢弃该节点的地图数据。
 */
export async function clearMapNodeByNodeId(nodeId: string): Promise<boolean> {
  const index = await readTreeIndex();
  if (!index.nodes[nodeId]) return false;
  return clearNodeRecord(nodeId);
}

async function clearNodeRecord(nodeId: string): Promise<boolean> {
  const index = await readTreeIndex();
  const node = index.nodes[nodeId];
  if (node) {
    node.status = 'pending';
    node.lastStoryHash = '';
    node.updatedAt = 0;
  }
  const ok = await writeStoryFeatures({ [MAP_INDEX_STORY_KEY]: index }, [mapNodeStoryKey(nodeId)]);
  if (ok) fireMapTreeChange();
  return ok;
}

/**
 * 清除指定地点对应的节点重数据 + 在索引中重置为 pending。
 * 保留树拓扑（父节点/兄弟节点不受影响），仅丢弃该节点的地图数据。
 */
export async function clearMapNodeByLocation(location: string): Promise<boolean> {
  const normalized = normalizeLocationPath(location);
  if (!normalized) return false;
  const nodeId = deriveNodeId(normalized);
  return clearNodeRecord(nodeId);
}

/** 清空当前聊天全部地图节点与拓扑，一次 saveChat 完成。 */
export async function clearAllMapNodes(): Promise<boolean> {
  const features = exportStoryFeatures();
  const deletes = Object.keys(features).filter(key => key.startsWith(MAP_NODE_STORY_PREFIX));
  const ok = await writeStoryFeatures({ [MAP_INDEX_STORY_KEY]: createEmptyIndex() }, deletes);
  if (ok) fireMapTreeChange();
  return ok;
}

// ─────────────────────────────────────────────────────────────
// 上下文收集（供 generateMap 拼装 user_input 用）
// ─────────────────────────────────────────────────────────────

/**
 * 收集父节点探索描述文本（仅直接父节点，不读祖父）。
 * 父节点已有探索记录（generated/text-only）时返回 summary + directions；否则返回 null。
 */
export async function gatherParentContext(index: MapTreeIndex, nodeId: string): Promise<string | null> {
  const node = index.nodes[nodeId];
  if (!node || !node.parentId) return null;
  const parent = index.nodes[node.parentId];
  if (!parent || parent.status === 'pending') return null;
  const parentData = await readMapNode(parent.nodeId);
  if (!parentData) return null;
  const desc = parentData.explorationDesc;
  const lines: string[] = [];
  if (desc.summary) lines.push(`概述：${desc.summary}`);
  if (desc.directions) lines.push(`方位：${desc.directions}`);
  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * 收集已探索的直接子节点探索描述（generated/text-only 的 child）。
 * 返回每个子节点的 name + summary，或 null（无已探索子节点）。
 */
export async function gatherChildContext(index: MapTreeIndex, nodeId: string): Promise<string | null> {
  const node = index.nodes[nodeId];
  if (!node || !node.childIds.length) return null;
  // 批量读：子节点一次取回，替代逐子节点串行 readMapNode（每读曾=全量重放）
  const generated = node.childIds
    .map(childId => index.nodes[childId])
    .filter((child): child is MapTreeNode => Boolean(child) && child.status !== 'pending');
  if (!generated.length) return null;
  const nodesById = readMapNodesBatch(generated.map(child => child.nodeId));
  const lines: string[] = [];
  for (const child of generated) {
    const childData = nodesById[child.nodeId];
    if (!childData) continue;
    const summary = childData.explorationDesc.summary || '';
    lines.push(`${child.name}：${summary}`);
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * 收集当前节点的直接邻接节点清单（上级/同级/子级，各带 已探索/未探索 状态）。
 * 供地图更新提示词注入。
 * status='generated' / 'text-only' → 已探索；'pending'（及缺省）→ 未探索。
 * nodeId 不在 index 返回 null。
 */
export function gatherNodeNeighborhood(
  index: MapTreeIndex,
  nodeId: string,
): { text: string; names: string[] } | null {
  const node = index.nodes[nodeId];
  if (!node) return null;
  const path = deriveFullPathFromIndex(index, nodeId) || node.name;
  const names: string[] = [];
  const statusLabel = (s?: MapNodeStatus): string => (s === 'generated' || s === 'text-only' ? '已探索' : '未探索');
  const lines = [`当前地点路径：${path}`];

  const parent = node.parentId ? index.nodes[node.parentId] : null;
  if (parent) {
    names.push(parent.name);
    lines.push(`- 上级地点：${parent.name}（${statusLabel(parent.status)}）`);
  } else {
    lines.push('- 上级地点：（无）');
  }

  const siblingLines: string[] = [];
  if (parent) {
    for (const cid of parent.childIds) {
      if (cid === nodeId) continue;
      const sib = index.nodes[cid];
      if (!sib) continue;
      siblingLines.push(`${sib.name}（${statusLabel(sib.status)}）`);
      names.push(sib.name);
    }
  }
  lines.push(`- 同级地点：${siblingLines.length ? siblingLines.join('、') : '（无）'}`);

  const childLines: string[] = [];
  for (const cid of node.childIds) {
    const child = index.nodes[cid];
    if (!child) continue;
    childLines.push(`${child.name}（${statusLabel(child.status)}）`);
    names.push(child.name);
  }
  lines.push(`- 下级地点：${childLines.length ? childLines.join('、') : '（无）'}`);

  return { text: lines.join('\n'), names };
}

// ─────────────────────────────────────────────────────────────
// exits 解析：AI 输出的 targetName → targetNodeId（前端转换）
// ─────────────────────────────────────────────────────────────

/**
 * 把 AI 输出的 exits（含 targetName）转换为前端 exits（含 targetNodeId）。
 * - kind=parent：targetName 填上级最后一段名，targetNodeId 直接取当前节点 parentId
 * - kind=child：targetName 填子地点短名，前端用 currentFullPath + '-' + targetName 派生 nodeId，
 *   并确保子节点入树（pending），连通当前节点 childIds
 * - kind=sibling：targetName 填同级地点短名（同父节点下的兄弟），前端用 parentFullPath + '-' + targetName
 *   派生 nodeId，确保兄弟节点入树（pending），连通 parent.childIds。无父节点时跳过（不构成 exit）。
 *   注：仅影响地图生成时的出口热点标注，不改变存储结构。
 * 返回 { exits, index }。调用方负责 writeTreeIndex(index)。
 */
export function resolveExits(
  index: MapTreeIndex,
  nodeId: string,
  aiExits: Array<{ id: string; label: string; targetName: string; kind: string; x: number; y: number }>,
): { exits: MapExit[]; index: MapTreeIndex } {
  const node = index.nodes[nodeId];
  if (!node) return { exits: [], index };

  const currentFullPath = deriveFullPathFromIndex(index, nodeId);
  const exits: MapExit[] = [];

  for (const ae of aiExits) {
    const kind: MapExit['kind'] = ae.kind === 'parent' ? 'parent' : ae.kind === 'sibling' ? 'sibling' : 'child';
    let targetNodeId = '';

    if (kind === 'parent' && node.parentId) {
      targetNodeId = node.parentId;
    } else if (kind === 'child') {
      // 子节点 fullPath = 当前 fullPath + '-' + targetName
      const childFullPath = currentFullPath ? `${currentFullPath}-${ae.targetName}` : ae.targetName;
      const childNodeId = deriveNodeId(childFullPath);
      // 确保子节点入树（pending），连通当前节点 childIds
      const resolved = resolveNodeIdCollision(index, childNodeId, ae.targetName, nodeId);
      if (!index.nodes[resolved]) {
        index.nodes[resolved] = createPendingNode(resolved, ae.targetName, nodeId);
      }
      // 无论新建还是已存在：确保连通
      if (!node.childIds.includes(resolved)) node.childIds.push(resolved);
      targetNodeId = resolved;
    } else if (kind === 'sibling') {
      // 同级节点：必须有父节点，否则跳过（无父级则无法定位兄弟）
      if (!node.parentId) continue;
      const parent = index.nodes[node.parentId];
      if (!parent) continue;
      // sibling fullPath = parent fullPath + '-' + targetName
      const parentFullPath = deriveFullPathFromIndex(index, node.parentId);
      const siblingFullPath = parentFullPath ? `${parentFullPath}-${ae.targetName}` : ae.targetName;
      const siblingNodeId = deriveNodeId(siblingFullPath);
      // 确保兄弟节点入树（pending），与当前节点共享 parent
      const resolved = resolveNodeIdCollision(index, siblingNodeId, ae.targetName, node.parentId);
      if (!index.nodes[resolved]) {
        index.nodes[resolved] = createPendingNode(resolved, ae.targetName, node.parentId);
      }
      // 连通 parent.childIds
      if (!parent.childIds.includes(resolved)) parent.childIds.push(resolved);
      targetNodeId = resolved;
    }

    exits.push({
      id: ae.id,
      label: ae.label,
      targetNodeId,
      kind,
      x: ae.x,

      y: ae.y,
    });
  }

  return { exits, index };
}

// ─────────────────────────────────────────────────────────────
// exploreLog 拼装：AI 输出 exploreNote + 前端填 time/storyHash
// ─────────────────────────────────────────────────────────────

/**
 * 拼装 exploreLog 条目。
 * - time：由调用方读全局数据表传入（map-system 用 data-manager.getCellByHeader，
 *   因本模块为避循环依赖不 import data-manager；原生 AutoCardUpdaterAPI 无 getCellByHeader 方法）
 * - storyHash：前端填（传入）
 * - note：AI 输出的 exploreNote
 */
export function buildExploreLogEntry(note: string, storyHash: string, time: string): ExploreLogEntry {
  return {
    time: time || '',
    storyHash,
    note: note || '',
  };
}

// ─────────────────────────────────────────────────────────────
// 探索记录滚动结构：1 段情况总结 + 最多 3 条增量
// ─────────────────────────────────────────────────────────────
export const EXPLORE_LOG_KEEP_LATEST = 3;

export interface ExploreRecordView {
  summary: string;
  entries: ExploreLogEntry[];
}

/** 把旧总结与若干旧条目拼成临时总结（AI 未返回有效总结时的兜底；不做硬截断）。 */
export function mergeExploreSummaryText(summary: string, entries: ExploreLogEntry[]): string {
  const parts = [
    String(summary || '').trim(),
    ...entries.map(entry => String(entry?.note || '').trim()),
  ].filter(Boolean);
  return Array.from(new Set(parts)).join('；');
}

/**
 * 读取展示视图：旧数据没有 exploreSummary 时，把超出最近 3 条的旧记录本地并入临时总结。
 * 只影响展示/注入，不写盘；下一次地图更新再由 AI 正式压缩。
 */
export function readExploreRecordView(node: MapNode | null | undefined): ExploreRecordView {
  const entries = Array.isArray(node?.exploreLog) ? node!.exploreLog : [];
  let summary = typeof node?.exploreSummary === 'string' ? node.exploreSummary : '';
  if (!summary && entries.length > EXPLORE_LOG_KEEP_LATEST) {
    summary = mergeExploreSummaryText('', entries.slice(0, entries.length - EXPLORE_LOG_KEEP_LATEST));
  }
  return { summary, entries: entries.slice(-EXPLORE_LOG_KEEP_LATEST) };
}

/** 把任意条数的记录收敛成「总结 + 最多 3 条」：超出部分本地并入总结（合并/迁移兜底，不写提示词）。 */
export function collapseExploreRecord(summary: string, entries: ExploreLogEntry[]): ExploreRecordView {
  const overflow = entries.slice(0, Math.max(0, entries.length - EXPLORE_LOG_KEEP_LATEST));
  return {
    summary: mergeExploreSummaryText(String(summary || ''), overflow),
    entries: entries.slice(-EXPLORE_LOG_KEEP_LATEST),
  };
}

export interface ExploreRecordPlan {
  duplicate: boolean;
  oldSummary: string;
  /** 需要并入总结的旧条目：已有 3 条时＝最旧的多余条目；旧数据可能多条。 */
  overflow: ExploreLogEntry[];
  /** 本次保留的旧条目（最多 2 条，给新条目留位置）。 */
  kept: ExploreLogEntry[];
  /** 写回后的条目（最多 3 条）。 */
  nextEntries: ExploreLogEntry[];
  needsCompression: boolean;
}

/**
 * 规划一次增量写入：
 * - 同一 storyHash 视为重复，不追加、不压缩；
 * - 已有 3 条时，最旧的多余条目进入 overflow，交给 AI 与旧总结一起压缩；
 * - 保留最新 2 条 + 本次新增，写回后最多 3 条。
 */
export function planExploreRecordUpdate(
  node: MapNode | null | undefined,
  entry: ExploreLogEntry,
): ExploreRecordPlan {
  const oldEntries = Array.isArray(node?.exploreLog) ? node!.exploreLog : [];
  const oldSummary = typeof node?.exploreSummary === 'string' ? node.exploreSummary : '';
  const duplicate = !!entry.storyHash && oldEntries.some(item => item.storyHash === entry.storyHash);
  const overflowCount = Math.max(0, oldEntries.length - (EXPLORE_LOG_KEEP_LATEST - 1));
  const overflow = oldEntries.slice(0, overflowCount);
  const kept = oldEntries.slice(overflowCount);
  const nextEntries = duplicate
    ? oldEntries.slice(-EXPLORE_LOG_KEEP_LATEST)
    : [...kept, entry].slice(-EXPLORE_LOG_KEEP_LATEST);
  return {
    duplicate,
    oldSummary,
    overflow: duplicate ? [] : overflow,
    kept,
    nextEntries,
    needsCompression: !duplicate && overflow.length > 0,
  };
}

/**
 * 应用规划：
 * - 重复 → 保留旧记录（仍收敛到最多 3 条）；
 * - 需要压缩 → 优先用 AI 返回的 exploreSummary，缺失则把旧总结 + overflow 本地拼接兜底；
 * - 不需要压缩 → 总结保持不变。
 */
export function applyExploreRecordPlan(
  node: MapNode,
  plan: ExploreRecordPlan,
  aiSummary?: string,
): void {
  node.exploreLog = plan.nextEntries;
  if (plan.duplicate) return;
  if (plan.needsCompression) {
    const ai = String(aiSummary || '').trim();
    node.exploreSummary = ai || mergeExploreSummaryText(plan.oldSummary, plan.overflow);
  } else {
    node.exploreSummary = plan.oldSummary;
  }
}

// ─────────────────────────────────────────────────────────────
// 地图库编辑 UI 辅助（基础版：树形列表 + 删除）
// ─────────────────────────────────────────────────────────────

export interface MapLibNodeInfo {
  nodeId: string;
  name: string;
  parentId: string | null;
  depth: number;
  status: MapNodeStatus;
  fullPath: string;
  finalChild: boolean;
}

/**
 * 列出索引中所有节点，按树拓扑深度优先遍历，带 depth 用于缩进显示。
 * 返回扁平数组（已按 rootNodeIds → childIds 递归序排列）。
 */
export function listAllNodesForUI(index: MapTreeIndex): MapLibNodeInfo[] {
  const out: MapLibNodeInfo[] = [];
  const visited = new Set<string>();
  const walk = (nodeId: string, depth: number) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = index.nodes[nodeId];
    if (!node) return;
    out.push({
      nodeId,
      name: node.name,
      parentId: node.parentId,
      depth,
      status: node.status,
      fullPath: deriveFullPathFromIndex(index, nodeId),
      finalChild: !!node.finalChild,
    });
    for (const childId of node.childIds) walk(childId, depth + 1);
  };
  for (const rootId of index.rootNodeIds) walk(rootId, 0);
  return out;
}


/**
 * 按 nodeId 删除节点（级联删除所有子节点）。
 * - 删除 __map_node_<nodeId> 世界书条目（含子节点）
 * - 从索引中移除节点（含子节点），并从父节点 childIds / rootNodeIds 中摘除
 * 返回删除的节点数。调用方负责刷新 UI。
 */
export async function deleteMapNodeByNodeId(nodeId: string): Promise<number> {
  const index = await readTreeIndex();
  const toDelete: string[] = [];
  const collect = (id: string) => {
    const node = index.nodes[id];
    if (!node) return;
    toDelete.push(id);
    for (const childId of node.childIds) collect(childId);
  };
  collect(nodeId);
  if (!toDelete.length) return 0;
  const deletedIds = new Set(toDelete);
  for (const id of toDelete) {
    const node = index.nodes[id];
    if (node?.parentId && index.nodes[node.parentId]) {
      index.nodes[node.parentId].childIds = index.nodes[node.parentId].childIds.filter(cid => cid !== id);
    }
    index.rootNodeIds = index.rootNodeIds.filter(rid => rid !== id);
    index.favorites = index.favorites.filter(fid => fid !== id);

    delete index.nodes[id];
  }
  index.locationAliases = Object.fromEntries(
    Object.entries(index.locationAliases || {}).filter(([, alias]) => !deletedIds.has(alias.targetNodeId)),
  );
  const features = exportStoryFeatures();
  const updates: Record<string, unknown> = { [MAP_INDEX_STORY_KEY]: index };
  for (const [key, raw] of Object.entries(features)) {
    if (!key.startsWith(MAP_NODE_STORY_PREFIX)) continue;
    const id = key.slice(MAP_NODE_STORY_PREFIX.length);
    if (deletedIds.has(id)) continue;
    const mapNode = raw as MapNode;
    if (!mapNode || mapNode.schema !== 'map_node') continue;
    const exits = (mapNode.structure?.exits || []).filter(exit => !deletedIds.has(exit.targetNodeId));
    if (exits.length !== (mapNode.structure?.exits || []).length) {
      updates[key] = { ...mapNode, structure: { ...mapNode.structure, exits } };
    }
  }
  const ok = await writeStoryFeatures(updates, toDelete.map(mapNodeStoryKey));
  if (ok) fireMapTreeChange();
  return ok ? toDelete.length : 0;
}

// ─────────────────────────────────────────────────────────────
// 大地图辅助（期4）
// ─────────────────────────────────────────────────────────────

/**
 * 递归收集 rootId 的所有后代 nodeId（不含 rootId 自身），含 pending 节点。
 * 用于大地图生成时遍历区域内的全部子地点。
 * 带环路保护（guard set），异常拓扑不会无限递归。
 */
export function collectDescendantNodeIds(index: MapTreeIndex, rootId: string): string[] {
  const out: string[] = [];
  const guard = new Set<string>();
  const walk = (id: string) => {
    const node = index.nodes[id];
    if (!node) return;
    for (const childId of node.childIds) {
      if (guard.has(childId)) continue;
      guard.add(childId);
      out.push(childId);
      walk(childId);
    }
  };
  walk(rootId);
  return out;
}

// ─────────────────────────────────────────────────────────────
// 收藏 + 编辑器辅助（期4 创意增强 + 编辑器）
// ─────────────────────────────────────────────────────────────

/**
 * 切换节点收藏状态（index.favorites 增删 nodeId）。
 * 调用方负责 writeTreeIndex(index)。
 */
export function toggleFavorite(index: MapTreeIndex, nodeId: string): boolean {
  const i = index.favorites.indexOf(nodeId);
  if (i >= 0) {
    index.favorites.splice(i, 1);
    return false; // 取消收藏
  }
  index.favorites.push(nodeId);
  return true; // 已收藏
}

/** 判断节点是否已收藏 */
export function isFavorite(index: MapTreeIndex, nodeId: string): boolean {
  return index.favorites.includes(nodeId);
}

/** 设置节点是否为最终子节点（软锁定）。调用方负责 writeTreeIndex(index)。 */
export function setNodeFinalChild(index: MapTreeIndex, nodeId: string, value: boolean): boolean {
  const node = index.nodes[nodeId];
  if (!node) return false;
  node.finalChild = value;
  node.updatedAt = Date.now();
  return true;
}

/**
 * 重命名节点（仅改 index.nodes[nodeId].name，不改 nodeId）。
 * 注意：nodeId 由 fullPath 派生，重命名后 nodeId 与新 fullPath 不一致，
 * 但 nodeId 作为稳定身份标识保持不变（spec §2.3 决策）。
 * 调用方负责 writeTreeIndex(index)。
 */
export function renameNode(index: MapTreeIndex, nodeId: string, newName: string): boolean {
  const node = index.nodes[nodeId];
  if (!node) return false;
  const name = String(newName || '').trim();
  if (!name) return false;
  node.name = name;
  node.updatedAt = Date.now();
  return true;
}

/**
 * 手动新增子节点（pending 状态）。
 * - parentId 必须存在
 * - name 不能与父节点已有子节点重名
 * - nodeId 由 parentFullPath + '-' + name 派生，带碰撞消解
 * 返回新节点 nodeId，失败返回 null。调用方负责 writeTreeIndex(index)。
 */
export function addChildNode(index: MapTreeIndex, parentId: string, name: string): string | null {
  const parent = index.nodes[parentId];
  if (!parent) return null;
  const childName = String(name || '').trim();
  if (!childName) return null;
  // 重名检查
  for (const cid of parent.childIds) {
    const existing = index.nodes[cid];
    if (existing && existing.name === childName) return null;
  }
  // 派生 nodeId
  const parentFullPath = deriveFullPathFromIndex(index, parentId);
  const childFullPath = parentFullPath ? `${parentFullPath}-${childName}` : childName;
  const baseNodeId = deriveNodeId(childFullPath);
  const resolved = resolveNodeIdCollision(index, baseNodeId, childName, parentId);
  // 创建 pending 节点
  index.nodes[resolved] = createPendingNode(resolved, childName, parentId);
  if (!parent.childIds.includes(resolved)) parent.childIds.push(resolved);
  return resolved;
}

/**
 * 更新节点的 explorationDesc（编辑器手动修正）。
 * 需要节点已有 __map_node_ 重数据。
 * 可选传入 exploreSummary / exploreLog 整体替换探索记录。
 */
export async function updateNodeExplorationDesc(
  nodeId: string,
  desc: { summary?: string; items?: string[]; directions?: string; exploreSummary?: string; exploreLog?: ExploreLogEntry[] },
): Promise<boolean> {
  const node = await readMapNode(nodeId);
  if (!node) return false;
  if (desc.summary !== undefined) node.explorationDesc.summary = desc.summary;
  if (desc.items !== undefined) node.explorationDesc.items = desc.items;
  if (desc.directions !== undefined) node.explorationDesc.directions = desc.directions;
  if (desc.exploreSummary !== undefined) node.exploreSummary = desc.exploreSummary;
  if (desc.exploreLog !== undefined) node.exploreLog = desc.exploreLog;
  return writeMapNode(node);
}

/**
 * 校验某节点是否可以移动到指定父节点之下（纯逻辑，不修改数据）。
 * 供 UI 层在选择目标时实时判断哪些节点可选、哪些应灰掉。
 */
export function checkCanMoveTo(
  index: MapTreeIndex,
  nodeId: string,
  targetParentId: string | null,
): { ok: boolean; reason?: string } {
  const srcNode = index.nodes[nodeId];
  if (!srcNode) return { ok: false, reason: '源节点不存在' };

  // 不能移到自身
  if (targetParentId === nodeId) return { ok: false, reason: '不能移动到自己之下' };

  // 不能移到当前父节点下（无操作）
  if (targetParentId === srcNode.parentId) return { ok: false, reason: '已在目标节点之下' };

  // 不能移到后代节点下：从 targetParentId 沿 parentId 链上溯，若经过 nodeId 则拒绝
  if (targetParentId !== null) {
    let cur: string | null = targetParentId;
    const visited = new Set<string>();
    while (cur) {
      if (visited.has(cur)) break; // 环路保护
      visited.add(cur);
      if (cur === nodeId) return { ok: false, reason: '不能移动到子节点之下' };
      const curNode: MapTreeNode | undefined = index.nodes[cur];
      if (!curNode) break;
      cur = curNode.parentId;
    }
  }

  // 目标下已有同名子节点则拒绝
  if (targetParentId !== null) {
    const targetParent = index.nodes[targetParentId];
    if (targetParent) {
      const srcName = srcNode.name;
      for (const cid of targetParent.childIds) {
        const child = index.nodes[cid];
        if (child && child.name === srcName) {
          return { ok: false, reason: '目标下已有同名节点' };
        }
      }
    }
  }

  return { ok: true };
}

/**
 * 在索引中移动一个节点及其整个子树到新的父节点之下。
 * 原地修改 index，返回旧→新 nodeId 迁移映射表供存储层使用。
 *

 * 约束：
 * - 不涉及世界书读写（纯索引操作）
 * - 调用方负责 writeTreeIndex + 存储层迁移
 */
export function moveSubtreeInIndex(
  index: MapTreeIndex,
  nodeId: string,
  newParentId: string | null,
): { index: MapTreeIndex; migration: Map<string, string>; movedCount: number } | { error: string } {
  // ── 1. 校验 ──
  const check = checkCanMoveTo(index, nodeId, newParentId);
  if (!check.ok) return { error: check.reason || '不允许的移动操作' };

  const srcNode = index.nodes[nodeId]!; // checkCanMoveTo 已保证存在

  // ── 2. 收集子树节点（先根遍历序） ──
  const subtreeIds: string[] = [];
  const collectSubtree = (id: string, visited: Set<string>) => {
    if (visited.has(id)) return;
    visited.add(id);
    subtreeIds.push(id);
    const n = index.nodes[id];
    if (n) {
      for (const cid of n.childIds) collectSubtree(cid, visited);
    }
  };
  collectSubtree(nodeId, new Set<string>());

  // ── 3. 从旧父摘除 ──
  if (srcNode.parentId === null) {
    index.rootNodeIds = index.rootNodeIds.filter(rid => rid !== nodeId);
  } else {
    const oldParent = index.nodes[srcNode.parentId];
    if (oldParent) {
      oldParent.childIds = oldParent.childIds.filter(cid => cid !== nodeId);
    }
  }

  // ── 4. 计算旧/新 fullPath → 派发新 nodeId ──
  const oldMovedFullPath = deriveFullPathFromIndex(index, nodeId);

  // 新父 fullPath
  let newParentFullPath = '';
  if (newParentId !== null) {
    newParentFullPath = deriveFullPathFromIndex(index, newParentId);
  }

  // 移动节点本身的新 fullPath
  const movedNodeNewFullPath = newParentFullPath
    ? `${newParentFullPath}-${srcNode.name}`
    : srcNode.name;

  // 构建旧→新 nodeId 映射
  const migration = new Map<string, string>();
  for (const oldId of subtreeIds) {
    const subNode = index.nodes[oldId];
    if (!subNode) continue;

    // 该节点在子树中的相对路径 = oldFullPath 去掉 movedNode 旧 fullPath 前缀
    const oldFullPath = deriveFullPathFromIndex(index, oldId);
    let relativePath = oldFullPath;
    if (oldFullPath === oldMovedFullPath) {
      relativePath = '';
    } else if (oldFullPath.startsWith(oldMovedFullPath + '-')) {
      relativePath = oldFullPath.slice(oldMovedFullPath.length); // 含开头的 '-'
    } else {
      // 子树节点的 fullPath 理应以前缀开头；若不是则视为异常，跳过
      continue;
    }

    const newFullPath = relativePath
      ? `${movedNodeNewFullPath}${relativePath}`

      : movedNodeNewFullPath;

    const baseNewId = deriveNodeId(newFullPath);
    // 碰撞消解：确定此节点在新位置下的预期 parentId
    let expectedParentId: string | null;
    if (oldId === nodeId) {
      expectedParentId = newParentId;
    } else {
      const oldParentId = subNode.parentId;
      expectedParentId = oldParentId ? (migration.get(oldParentId) || oldParentId) : null;
    }
    const resolvedNewId = resolveNodeIdCollision(index, baseNewId, subNode.name, expectedParentId);
    migration.set(oldId, resolvedNewId);
  }

  // ── 5. 更新 index.nodes 拓扑 ──
  // 需要暂存旧节点数据（因为会原地修改 index.nodes 键名）
  const subtreeNodes: MapTreeNode[] = [];
  for (const oldId of subtreeIds) {
    const n = index.nodes[oldId];
    if (n) subtreeNodes.push({ ...n });
  }


  // 删旧键

  for (const oldId of subtreeIds) {
    delete index.nodes[oldId];
  }


  // 插新键 + 更新内部引用
  for (const oldNode of subtreeNodes) {
    const newId = migration.get(oldNode.nodeId)!;
    const newNode: MapTreeNode = {
      ...oldNode,
      nodeId: newId,
      // 更新 parentId

      parentId: oldNode.nodeId === nodeId
        ? newParentId
        : (oldNode.parentId ? (migration.get(oldNode.parentId) || oldNode.parentId) : null),
      // 更新 childIds 引用
      childIds: oldNode.childIds.map(cid => migration.get(cid) || cid),
    };
    index.nodes[newId] = newNode;
  }

  // 新父的 childIds 加入新根
  if (newParentId !== null) {
    const newParent = index.nodes[newParentId]!;
    const newRootId = migration.get(nodeId)!;
    if (!newParent.childIds.includes(newRootId)) {
      newParent.childIds.push(newRootId);
    }
  } else {
    const newRootId = migration.get(nodeId)!;
    if (!index.rootNodeIds.includes(newRootId)) {
      index.rootNodeIds.push(newRootId);
    }
  }

  // ── 6. 更新 favorites 列表 ──
  index.favorites = index.favorites.map(fid => migration.get(fid) || fid);

  return { index, migration, movedCount: subtreeIds.length };
}

// ─────────────────────────────────────────────────────────────
// 节点移动存储编排（单次读-改-写世界书）
// ─────────────────────────────────────────────────────────────

/**
 * 移动节点及其子树的完整存储操作（单次读-改-写世界书）：
 * 1. 读索引 → moveSubtreeInIndex（内存中更新拓扑）
 * 2. 读世界书全部条目 → 在内存中迁移 __map_node_<oldId> → __map_node_<newId>
 * 3. 扫描非迁移节点的 exits 引用，替换 targetNodeId 旧→新
 * 4. 一次性写回世界书 + 写回索引
 *
 * 失败回退：若任何步骤失败，不写回 index 也不写回 entries（内存修改被丢弃）。
 */
export async function moveMapNodeInStorage(
  nodeId: string,
  newParentId: string | null,
): Promise<{ ok: boolean; movedCount: number; error?: string }> {
  const index = await readTreeIndex();
  if (!index.nodes[nodeId]) return { ok: false, movedCount: 0, error: '源节点不存在' };
  const movingIds = [nodeId, ...collectDescendantNodeIds(index, nodeId)];
  const oldPaths = new Map(movingIds.map(id => [id, normalizeLocationPath(deriveFullPathFromIndex(index, id))]));
  const result = moveSubtreeInIndex(index, nodeId, newParentId);
  if ('error' in result) return { ok: false, movedCount: 0, error: result.error };

  const features = exportStoryFeatures();
  const updates: Record<string, unknown> = { [MAP_INDEX_STORY_KEY]: index };
  const deletes: string[] = [];
  const migration = result.migration;
  const nextAliases: Record<string, MapLocationAlias> = {};
  for (const [path, alias] of Object.entries(index.locationAliases || {})) {
    const targetNodeId = migration.get(alias.targetNodeId) || alias.targetNodeId;
    if (index.nodes[targetNodeId]) nextAliases[path] = { ...alias, targetNodeId };
  }
  const now = Date.now();
  for (const [oldId, newId] of migration) {
    const oldPath = oldPaths.get(oldId);
    const newPath = normalizeLocationPath(deriveFullPathFromIndex(index, newId));
    if (oldPath && oldPath !== newPath) nextAliases[oldPath] = { targetNodeId: newId, createdAt: now };
  }
  index.locationAliases = nextAliases;

  for (const [key, raw] of Object.entries(features)) {
    if (!key.startsWith(MAP_NODE_STORY_PREFIX)) continue;
    const oldId = key.slice(MAP_NODE_STORY_PREFIX.length);
    const node = raw as MapNode;
    if (!node || node.schema !== 'map_node') continue;
    let changed = false;
    const newId = migration.get(oldId);
    if (newId) { node.nodeId = newId; changed = true; }
    for (const exit of node.structure?.exits || []) {
      const mapped = migration.get(exit.targetNodeId);
      if (mapped) { exit.targetNodeId = mapped; changed = true; }
    }
    if (!changed) continue;
    const targetId = newId || oldId;
    updates[mapNodeStoryKey(targetId)] = node;
    if (targetId !== oldId) deletes.push(key);
  }

  // 场景图记录随节点 id 迁移（与 map-merge 的场景处理同规则）：只迁 map.node: 会让
  // 场景图挂在旧 id 下成孤儿——地图库看不到、图片文件也永无 GC 候选。移动不删节点，
  // 纯 re-key，imagePath 不变、无文件清理。
  if (migration.size > 0) {
    const sceneRecords = await listMapSceneImages();
    if (sceneRecords.some(record => migration.has(record.nodeId))) {
      const nextIds: string[] = [];
      for (const record of sceneRecords) {
        const newId = migration.get(record.nodeId);
        if (!newId) { nextIds.push(record.nodeId); continue; }
        const newPath = normalizeLocationPath(deriveFullPathFromIndex(index, newId));
        updates[MAP_SCENE_IMAGE_KEY_PREFIX + newId] = {
          ...record,
          nodeId: newId,
          canonicalPath: newPath || record.canonicalPath,
        };
        if (newId !== record.nodeId) deletes.push(MAP_SCENE_IMAGE_KEY_PREFIX + record.nodeId);
        nextIds.push(newId);
      }
      updates[MAP_SCENE_IMAGE_INDEX_KEY] = [...new Set(nextIds)];
    }
  }

  const ok = await writeStoryFeatures(updates, deletes);
  if (ok) fireMapTreeChange();
  return ok
    ? { ok: true, movedCount: result.movedCount }
    : { ok: false, movedCount: 0, error: '写回聊天楼层失败' };
}
