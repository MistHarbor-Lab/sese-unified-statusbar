// ===== 地图地点身份事务（纯计划 + 单次故事楼层提交） =====

import { plainClone } from './deep-clone';
import {
  deriveFullPathFromIndex,
  deriveNodeId,
  ensureChainInIndex,
  normalizeLocationPath,
  parseLocationHierarchy,
  readTreeIndex,
  resolveNodeIdCollision,
  collapseExploreRecord,
  type MapLocationAlias,
  type MapNode,
  type MapTreeIndex,
  type MapTreeNode,
} from './map-tree-store';
import { equivalentSegment } from './map-location-resolver';
import { exportStoryFeatures, writeStoryFeatures } from './story-floor-store';
import { listMapSceneImages, MAP_SCENE_IMAGE_INDEX_KEY, MAP_SCENE_IMAGE_KEY_PREFIX, type MapSceneImageRecord } from './map-scene-store';
import { requestMapImageCleanup } from './map-image-reference-gc';

const MAP_INDEX_STORY_KEY = 'map.index';
const MAP_NODE_STORY_PREFIX = 'map.node:';

export interface MapIdentitySnapshot {
  index: MapTreeIndex;
  mapNodes: Record<string, MapNode>;
}

export type MapLocationChoice = 'retain-existing' | 'adopt-current' | 'create-new';

export type IdentityPlanResult =
  | { ok: true; snapshot: MapIdentitySnapshot; canonicalNodeId: string; deletedNodeIds: string[]; movedIdMap?: Record<string, string> }
  | { ok: false; error: string; requiresConfirmation?: boolean; collision?: boolean };

function aliases(index: MapTreeIndex): Record<string, MapLocationAlias> {
  if (!index.locationAliases || typeof index.locationAliases !== 'object') index.locationAliases = {};
  return index.locationAliases;
}

function collectSubtreeIds(index: MapTreeIndex, rootId: string): string[] {
  const out: string[] = [];
  const visited = new Set<string>();
  const walk = (id: string) => {
    if (visited.has(id) || !index.nodes[id]) return;
    visited.add(id);
    out.push(id);
    for (const childId of index.nodes[id].childIds || []) walk(childId);
  };
  walk(rootId);
  return out;
}

function detachNode(index: MapTreeIndex, nodeId: string): string | null {
  const node = index.nodes[nodeId];
  if (!node) return null;
  const oldParentId = node.parentId;
  if (oldParentId) {
    const parent = index.nodes[oldParentId];
    if (parent) parent.childIds = parent.childIds.filter(id => id !== nodeId);
  } else {
    index.rootNodeIds = index.rootNodeIds.filter(id => id !== nodeId);
  }
  return oldParentId;
}

function deleteIds(snapshot: MapIdentitySnapshot, ids: Set<string>): void {
  for (const id of ids) {
    delete snapshot.index.nodes[id];
    delete snapshot.mapNodes[id];
  }
  snapshot.index.rootNodeIds = snapshot.index.rootNodeIds.filter(id => !ids.has(id));
  snapshot.index.favorites = snapshot.index.favorites.filter(id => !ids.has(id));
  for (const node of Object.values(snapshot.index.nodes)) {
    node.childIds = (node.childIds || []).filter(id => !ids.has(id));
    if (node.parentId && ids.has(node.parentId)) node.parentId = null;
  }
}

function mergeExploreLogs(selected: MapNode | undefined, loser: MapNode | undefined): MapNode['exploreLog'] {
  const out: MapNode['exploreLog'] = [];
  const seen = new Set<string>();
  for (const entry of [...(selected?.exploreLog || []), ...(loser?.exploreLog || [])]) {
    const key = String(entry?.storyHash || '');
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(plainClone(entry));
  }
  return out;
}

function capturePaths(index: MapTreeIndex, ids: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const id of ids) {
    const path = normalizeLocationPath(deriveFullPathFromIndex(index, id));
    if (path) out.set(id, path);
  }
  return out;
}

function findCanonicalNodeId(index: MapTreeIndex, fullPath: string, excluded = new Set<string>()): string | null {
  const normalized = normalizeLocationPath(fullPath);
  for (const id of Object.keys(index.nodes)) {
    if (excluded.has(id)) continue;
    if (normalizeLocationPath(deriveFullPathFromIndex(index, id)) === normalized) return id;
  }
  return null;
}

function ensureParentPath(index: MapTreeIndex, parentSegments: string[]): string | null {
  if (parentSegments.length === 0) return null;
  return ensureChainInIndex(index, parentSegments).leafNodeId;
}

function rekeySubtree(
  snapshot: MapIdentitySnapshot,
  oldRootId: string,
  newParentId: string | null,
  newRootName?: string,
): Map<string, string> {
  const sourceIds = collectSubtreeIds(snapshot.index, oldRootId);
  const sourceSet = new Set(sourceIds);
  const sourceFavorites = sourceIds.filter(id => snapshot.index.favorites.includes(id));
  const sourceNodes = new Map<string, MapTreeNode>();
  const sourceMaps = new Map<string, MapNode>();
  for (const id of sourceIds) {
    sourceNodes.set(id, plainClone(snapshot.index.nodes[id]));
    if (snapshot.mapNodes[id]) sourceMaps.set(id, plainClone(snapshot.mapNodes[id]));
  }
  detachNode(snapshot.index, oldRootId);
  deleteIds(snapshot, sourceSet);

  const mapping = new Map<string, string>();
  const insert = (oldId: string, parentId: string | null, parentPath: string): string => {
    const oldNode = sourceNodes.get(oldId)!;
    const name = oldId === oldRootId && newRootName ? newRootName : oldNode.name;
    const fullPath = parentPath ? `${parentPath}-${name}` : name;
    const baseId = deriveNodeId(fullPath);
    const newId = resolveNodeIdCollision(snapshot.index, baseId, name, parentId);
    mapping.set(oldId, newId);
    const next: MapTreeNode = { ...oldNode, nodeId: newId, name, parentId, childIds: [] };
    snapshot.index.nodes[newId] = next;
    if (parentId) {
      const parent = snapshot.index.nodes[parentId];
      if (parent && !parent.childIds.includes(newId)) parent.childIds.push(newId);
    } else if (!snapshot.index.rootNodeIds.includes(newId)) {
      snapshot.index.rootNodeIds.push(newId);
    }
    const mapData = sourceMaps.get(oldId);
    if (mapData) snapshot.mapNodes[newId] = { ...mapData, nodeId: newId };
    for (const childId of oldNode.childIds || []) insert(childId, newId, fullPath);
    return newId;
  };

  const parentPath = newParentId ? deriveFullPathFromIndex(snapshot.index, newParentId) : '';
  insert(oldRootId, newParentId, parentPath);
  for (const oldFavoriteId of sourceFavorites) {
    const newFavoriteId = mapping.get(oldFavoriteId);
    if (newFavoriteId && !snapshot.index.favorites.includes(newFavoriteId)) snapshot.index.favorites.push(newFavoriteId);
  }
  return mapping;
}

function updateReferences(
  snapshot: MapIdentitySnapshot,
  mapping: Map<string, string>,
  deleted: Set<string>,
  oldPaths: Map<string, string>,
  now: number,
): void {
  const nextAliases: Record<string, MapLocationAlias> = {};
  for (const [path, alias] of Object.entries(aliases(snapshot.index))) {
    if (deleted.has(alias.targetNodeId) && !mapping.has(alias.targetNodeId)) continue;
    const targetNodeId = mapping.get(alias.targetNodeId) || alias.targetNodeId;
    if (snapshot.index.nodes[targetNodeId]) nextAliases[normalizeLocationPath(path)] = { ...alias, targetNodeId };
  }
  for (const [oldId, newId] of mapping) {
    const oldPath = oldPaths.get(oldId);
    if (!oldPath || !snapshot.index.nodes[newId]) continue;
    const newPath = normalizeLocationPath(deriveFullPathFromIndex(snapshot.index, newId));
    if (oldPath !== newPath) nextAliases[oldPath] = { targetNodeId: newId, createdAt: now };
  }
  snapshot.index.locationAliases = nextAliases;

  for (const mapNode of Object.values(snapshot.mapNodes)) {
    mapNode.structure.exits = (mapNode.structure.exits || []).flatMap(exit => {
      const mapped = mapping.get(exit.targetNodeId);
      if (mapped) return [{ ...exit, targetNodeId: mapped }];
      if (deleted.has(exit.targetNodeId)) return [];
      return [exit];
    });
  }
}

function cleanupEmptyAncestors(snapshot: MapIdentitySnapshot, startId: string | null): void {
  let currentId = startId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = snapshot.index.nodes[currentId];
    if (!node) break;
    const hasAlias = Object.values(aliases(snapshot.index)).some(alias => alias.targetNodeId === currentId);
    const removable = node.status === 'pending'
      && !snapshot.mapNodes[currentId]
      && node.childIds.length === 0
      && !snapshot.index.favorites.includes(currentId)
      && !hasAlias;
    if (!removable) break;
    const parentId = node.parentId;
    detachNode(snapshot.index, currentId);
    delete snapshot.index.nodes[currentId];
    currentId = parentId;
  }
}

export function planRetainExistingLocation(
  input: MapIdentitySnapshot,
  currentPath: string,
  selectedNodeId: string,
  now = Date.now(),
): IdentityPlanResult {
  const snapshot = plainClone(input);
  const path = normalizeLocationPath(currentPath);
  if (!path) return { ok: false, error: '当前地点为空' };
  if (!snapshot.index.nodes[selectedNodeId]) return { ok: false, error: '候选节点不存在' };
  aliases(snapshot.index)[path] = { targetNodeId: selectedNodeId, createdAt: now };
  return { ok: true, snapshot, canonicalNodeId: selectedNodeId, deletedNodeIds: [] };
}

/**
 * deeper 锚点：把打字路径重基到锚点真实路径（X.fullPath + 后缀），ensureChainInIndex 复用锚点链并建后缀，
 * 加别名 rawPath→叶子。单 snapshot 原子。
 */
export function planAnchorAttach(
  input: MapIdentitySnapshot,
  rawPath: string,
  candidate: { nodeId: string; rebasedPath: string },
  now = Date.now(),
): IdentityPlanResult {
  const snapshot = plainClone(input);
  const rebased = normalizeLocationPath(candidate.rebasedPath);
  const segments = parseLocationHierarchy(rebased).segments;
  if (segments.length === 0) return { ok: false, error: '重基路径为空' };
  if (!snapshot.index.nodes[candidate.nodeId]) return { ok: false, error: '锚点节点不存在' };
  const ensured = ensureChainInIndex(snapshot.index, segments);
  const leafNodeId = ensured.leafNodeId;
  if (!leafNodeId) return { ok: false, error: '无法建立重基链' };
  aliases(snapshot.index)[normalizeLocationPath(rawPath)] = { targetNodeId: leafNodeId, createdAt: now };
  return { ok: true, snapshot, canonicalNodeId: leafNodeId, deletedNodeIds: [] };
}

/**
 * shallower 锚点：把锚点子树 reparent 到新前缀 S[1..k] 下，再建后缀 S[k+1..n]。
 * 步骤：建前缀 → 冲突检测 → rekeySubtree（rekey index+mapNodes）→ updateReferences（exits+别名）
 * → ensureChainInIndex(完整 S) 建后缀 → 加别名。单 snapshot 原子。
 * 冲突（新父下已有同名子节点≠锚点）返回 {ok:false, collision:true}，由派发层升级弹窗。
 */
export function planAnchorAbsorb(
  input: MapIdentitySnapshot,
  rawPath: string,
  candidate: { nodeId: string; anchorK: number },
  now = Date.now(),
): IdentityPlanResult {
  const snapshot = plainClone(input);
  const normalized = normalizeLocationPath(rawPath);
  const segments = parseLocationHierarchy(normalized).segments;
  const k = candidate.anchorK;
  if (segments.length === 0 || k < 1 || k >= segments.length) return { ok: false, error: '参数无效' };
  const anchorNodeId = candidate.nodeId;
  if (!snapshot.index.nodes[anchorNodeId]) return { ok: false, error: '锚点节点不存在' };

  // 1. 建前缀 S[1..k-1]
  const prefixEnsured = ensureChainInIndex(snapshot.index, segments.slice(0, k - 1));
  const newParentId = prefixEnsured.leafNodeId;
  if (!newParentId) return { ok: false, error: '无法建立前缀链' };

  // 2. 冲突检测：新父下已有同名子节点（非锚点本身）
  const sK = segments[k - 1];
  const newParent = snapshot.index.nodes[newParentId];
  if (newParent) {
    for (const cid of newParent.childIds) {
      if (cid === anchorNodeId) continue;
      const child = snapshot.index.nodes[cid];
      if (child && equivalentSegment(child.name, sK)) {
        return { ok: false, error: '目标父节点下已有同名子节点', collision: true };
      }
    }
  }

  // 3. rekey 锚点子树到新父（index + mapNodes）
  const oldPaths = capturePaths(snapshot.index, collectSubtreeIds(snapshot.index, anchorNodeId));
  const moved = rekeySubtree(snapshot, anchorNodeId, newParentId);

  // 4. 修 exits 引用 + 别名
  updateReferences(snapshot, moved, new Set<string>(), oldPaths, now);

  // 5. 建后缀：ensureChainInIndex(完整 S) 复用前缀 + rekey 后锚点 + 建 S[k+1..n]
  const fullEnsured = ensureChainInIndex(snapshot.index, segments);
  const leafNodeId = fullEnsured.leafNodeId;
  if (!leafNodeId) return { ok: false, error: '无法建立后缀链' };

  // 6. 别名 rawPath → leafNodeId（rawPath=canonical，harmless if equal）
  aliases(snapshot.index)[normalized] = { targetNodeId: leafNodeId, createdAt: now };
  return { ok: true, snapshot, canonicalNodeId: leafNodeId, deletedNodeIds: [], movedIdMap: Object.fromEntries(moved) };
}

export function planAdoptCurrentLocation(
  input: MapIdentitySnapshot,
  selectedNodeId: string,
  currentPath: string,
  now = Date.now(),
): IdentityPlanResult {
  const snapshot = plainClone(input);
  const normalizedPath = normalizeLocationPath(currentPath);
  const segments = parseLocationHierarchy(normalizedPath).segments;
  if (!normalizedPath || segments.length === 0) return { ok: false, error: '当前地点为空' };
  if (!snapshot.index.nodes[selectedNodeId]) return { ok: false, error: '候选节点不存在' };

  const selectedIds = collectSubtreeIds(snapshot.index, selectedNodeId);
  const selectedSet = new Set(selectedIds);
  const oldPaths = capturePaths(snapshot.index, selectedIds);
  const existingTargetId = findCanonicalNodeId(snapshot.index, normalizedPath, selectedSet);
  const oldParentId = snapshot.index.nodes[selectedNodeId].parentId;
  const parentId = ensureParentPath(snapshot.index, segments.slice(0, -1));
  const mapping = new Map<string, string>();
  const deleted = new Set<string>();
  let canonicalNodeId: string;

  if (!existingTargetId) {
    const moved = rekeySubtree(snapshot, selectedNodeId, parentId, segments[segments.length - 1]);
    for (const [from, to] of moved) mapping.set(from, to);
    canonicalNodeId = moved.get(selectedNodeId)!;
  } else {
    const selectedRoot = snapshot.index.nodes[selectedNodeId];
    const selectedMap = snapshot.mapNodes[selectedNodeId] ? plainClone(snapshot.mapNodes[selectedNodeId]) : undefined;
    const targetMap = snapshot.mapNodes[existingTargetId] ? plainClone(snapshot.mapNodes[existingTargetId]) : undefined;
    const selectedChildren = [...selectedRoot.childIds];

    detachNode(snapshot.index, selectedNodeId);
    delete snapshot.index.nodes[selectedNodeId];
    delete snapshot.mapNodes[selectedNodeId];
    mapping.set(selectedNodeId, existingTargetId);
    canonicalNodeId = existingTargetId;

    const targetNode = snapshot.index.nodes[existingTargetId];
    const selectedHasMap = !!(selectedMap && (selectedMap.svg || (Array.isArray(selectedMap.structure?.rooms) && selectedMap.structure.rooms.length > 0)));
    targetNode.status = selectedHasMap ? 'generated' : selectedRoot.status;
    targetNode.lastStoryHash = selectedRoot.lastStoryHash;
    targetNode.updatedAt = Math.max(targetNode.updatedAt, selectedRoot.updatedAt, now);
    if (selectedMap) {
      const mergedSummary = [selectedMap.exploreSummary, targetMap?.exploreSummary]
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .join('；');
      const recordView = collapseExploreRecord(mergedSummary, mergeExploreLogs(selectedMap, targetMap));
      snapshot.mapNodes[existingTargetId] = {
        ...selectedMap,
        nodeId: existingTargetId,
        exploreSummary: recordView.summary,
        exploreLog: recordView.entries,
      };
    }
    if (snapshot.index.favorites.includes(selectedNodeId) || snapshot.index.favorites.includes(existingTargetId)) {
      snapshot.index.favorites = snapshot.index.favorites.filter(id => id !== selectedNodeId && id !== existingTargetId);
      snapshot.index.favorites.push(existingTargetId);
    }

    for (const selectedChildId of selectedChildren) {
      const selectedChild = snapshot.index.nodes[selectedChildId];
      if (!selectedChild) continue;
      const sameNameTargetId = targetNode.childIds.find(id => snapshot.index.nodes[id]?.name === selectedChild.name);
      let deletedSameNameRoot: string | null = null;
      if (sameNameTargetId) {
        deletedSameNameRoot = sameNameTargetId;
        const loserIds = collectSubtreeIds(snapshot.index, sameNameTargetId);
        for (const id of loserIds) deleted.add(id);
        detachNode(snapshot.index, sameNameTargetId);
        deleteIds(snapshot, new Set(loserIds));
      }
      const moved = rekeySubtree(snapshot, selectedChildId, existingTargetId);
      for (const [from, to] of moved) mapping.set(from, to);
      if (deletedSameNameRoot) mapping.set(deletedSameNameRoot, moved.get(selectedChildId)!);
    }
  }

  for (const id of selectedIds) if (!mapping.has(id)) deleted.add(id);
  updateReferences(snapshot, mapping, deleted, oldPaths, now);
  cleanupEmptyAncestors(snapshot, oldParentId);
  return { ok: true, snapshot, canonicalNodeId, deletedNodeIds: Array.from(deleted), movedIdMap: Object.fromEntries(mapping) };
}

export type AddAliasResult =
  | { ok: true }
  | { ok: false; reason: string; conflictNodeId?: string; needsConfirm?: boolean };

/**
 * 给节点添加一条地点别名（规范化表述 → 本节点）。校验：
 * 1 空/目标节点不存在 → 拒；2 == 本节点规范路径 → 拒（无需）；
 * 3 == 其他节点规范路径 → 拒（防影子，force 不可绕过）；
 * 4 已存在且指向本节点 → 提示已存在（无操作）；
 * 5 已存在且指向他节点 → 返回 needsConfirm+conflictNodeId（force=true 则覆盖）；
 * 6 通过 → 写入。纯函数，调用方负责 writeTreeIndex(index)。
 */
export function addLocationAliasToIndex(
  index: MapTreeIndex,
  rawPath: string,
  targetNodeId: string,
  force = false,
): AddAliasResult {
  const path = normalizeLocationPath(rawPath);
  if (!path) return { ok: false, reason: '别名不能为空' };
  const target = index.nodes[targetNodeId];
  if (!target) return { ok: false, reason: '目标节点不存在' };
  const ownCanonical = normalizeLocationPath(deriveFullPathFromIndex(index, targetNodeId));
  if (path === ownCanonical) return { ok: false, reason: '该表述是本节点的规范路径，无需设为别名' };
  // 防影子：不得把别的节点的规范路径设为别名（force 也不可绕过）
  for (const id of Object.keys(index.nodes)) {
    if (id === targetNodeId) continue;
    if (normalizeLocationPath(deriveFullPathFromIndex(index, id)) === path) {
      return { ok: false, reason: `该表述是节点「${index.nodes[id].name}」的规范路径，不能作为别名` };
    }
  }
  const existing = aliases(index)[path];
  if (existing) {
    if (existing.targetNodeId === targetNodeId) {
      return { ok: false, reason: '该表述已映射到本节点，无需重复添加' };
    }
    if (!force) {
      return { ok: false, reason: '该表述当前映射到其他节点', conflictNodeId: existing.targetNodeId, needsConfirm: true };
    }
    // force=true：落到下面覆盖写入
  }
  index.locationAliases[path] = { targetNodeId, createdAt: Date.now() };
  return { ok: true };
}

export function removeLocationAliasFromIndex(index: MapTreeIndex, rawPath: string): boolean {
  const path = normalizeLocationPath(rawPath);
  if (!path || !aliases(index)[path]) return false;
  delete index.locationAliases[path];
  return true;
}

export function deleteLocationSubtreeFromSnapshot(input: MapIdentitySnapshot, nodeId: string): {
  snapshot: MapIdentitySnapshot;
  deletedCount: number;
} {
  const snapshot = plainClone(input);
  if (!snapshot.index.nodes[nodeId]) return { snapshot, deletedCount: 0 };
  const ids = new Set(collectSubtreeIds(snapshot.index, nodeId));
  detachNode(snapshot.index, nodeId);
  deleteIds(snapshot, ids);
  updateReferences(snapshot, new Map(), ids, new Map(), Date.now());
  return { snapshot, deletedCount: ids.size };
}

function snapshotFromFeatures(index: MapTreeIndex, features: Record<string, unknown>): MapIdentitySnapshot {
  const mapNodes: Record<string, MapNode> = {};
  for (const [key, raw] of Object.entries(features)) {
    if (!key.startsWith(MAP_NODE_STORY_PREFIX)) continue;
    const node = raw as MapNode;
    if (node?.schema === 'map_node') mapNodes[key.slice(MAP_NODE_STORY_PREFIX.length)] = plainClone(node);
  }
  return { index: plainClone(index), mapNodes };
}

async function commitSnapshot(
  beforeFeatures: Record<string, unknown>,
  snapshot: MapIdentitySnapshot,
  movedIdMap?: Record<string, string>,
  deletedNodeIds: readonly string[] = [],
): Promise<boolean> {
  const updates: Record<string, unknown> = { [MAP_INDEX_STORY_KEY]: snapshot.index };
  const deletes: string[] = [];
  for (const [id, node] of Object.entries(snapshot.mapNodes)) updates[`${MAP_NODE_STORY_PREFIX}${id}`] = node;
  for (const key of Object.keys(beforeFeatures)) {
    if (key.startsWith(MAP_NODE_STORY_PREFIX) && !updates[key]) deletes.push(key);
  }
  // 场景图记录随节点 id 迁移（与 moveMapNodeInStorage / map-merge 同规则）：只迁 map.node:
  // 会让场景图挂在旧 id 下成孤儿——地图库看不到、图片文件也永无 GC 候选。
  // 两趟处理：先按 movedIdMap/删除名单算终态记录集（同终位多源时后写覆盖先写，与 index 顺序
  // 一致），再差分落盘；被淘汰记录（被删/被覆盖）的 imagePath 交 requestMapImageCleanup，
  // 由其按引用保护裁决（仍被引用的文件不会被删）。
  const hasSceneChanges = (!!movedIdMap && Object.keys(movedIdMap).length > 0) || deletedNodeIds.length > 0;
  if (hasSceneChanges) {
    const records = await listMapSceneImages();
    const moved = movedIdMap || {};
    const deletedSet = new Set(deletedNodeIds);
    type SceneSlot = { record: MapSceneImageRecord; sourceId: string };
    const finalSet = new Map<string, SceneSlot>();
    for (const record of records) {
      if (deletedSet.has(record.nodeId) && !moved[record.nodeId]) continue;
      const finalId = moved[record.nodeId] || record.nodeId;
      finalSet.set(finalId, { record, sourceId: record.nodeId });
    }
    const winnerPaths = new Set(
      [...finalSet.values()].map(slot => slot.record.imagePath).filter(Boolean),
    );
    const gcCandidates: string[] = [];
    const nextIds: string[] = [];
    for (const record of records) {
      const finalId = moved[record.nodeId] || record.nodeId;
      const isDropped = deletedSet.has(record.nodeId) && !moved[record.nodeId];
      if (!isDropped) {
        if (!nextIds.includes(finalId)) nextIds.push(finalId);
        const slot = finalSet.get(finalId)!;
        if (slot.sourceId !== record.nodeId) {
          updates[MAP_SCENE_IMAGE_KEY_PREFIX + finalId] = { ...slot.record, nodeId: finalId };
          deletes.push(MAP_SCENE_IMAGE_KEY_PREFIX + record.nodeId);
        }
      }
      const displaced = isDropped || (finalSet.get(finalId)?.sourceId !== record.nodeId);
      if (displaced && record.imagePath && !winnerPaths.has(record.imagePath)) {
        gcCandidates.push(record.imagePath);
      }
    }
    updates[MAP_SCENE_IMAGE_INDEX_KEY] = nextIds;
    if (gcCandidates.length) void requestMapImageCleanup(gcCandidates).catch(() => { /* 清理尽力而为 */ });
  }
  return writeStoryFeatures(updates, deletes);
}

export async function applyLocationChoice(
  choice: Exclude<MapLocationChoice, 'create-new'>,
  currentPath: string,
  selectedNodeId: string,
): Promise<{ ok: boolean; canonicalNodeId?: string; error?: string }> {
  const index = await readTreeIndex();
  const features = exportStoryFeatures();
  const input = snapshotFromFeatures(index, features);
  const plan = choice === 'retain-existing'
    ? planRetainExistingLocation(input, currentPath, selectedNodeId)
    : planAdoptCurrentLocation(input, selectedNodeId, currentPath);
  if (!plan.ok) return { ok: false, error: plan.error };
  const ok = await commitSnapshot(features, plan.snapshot, plan.movedIdMap, plan.deletedNodeIds);
  return ok ? { ok: true, canonicalNodeId: plan.canonicalNodeId } : { ok: false, error: '写回聊天楼层失败' };
}

/**
 * 锚点匹配落盘：deeper→planAnchorAttach、shallower→planAnchorAbsorb、retain→planRetainExistingLocation。
 * 单次读-改-写。collision 时返回 {ok:false, collision:true}，由派发层升级弹窗。
 */
export async function applyAnchorChoice(
  action: 'anchor-attach' | 'anchor-absorb' | 'anchor-retain',
  currentPath: string,
  candidate: { nodeId: string; rebasedPath?: string; anchorK?: number },
): Promise<{ ok: boolean; canonicalNodeId?: string; error?: string; collision?: boolean }> {
  const index = await readTreeIndex();
  const features = exportStoryFeatures();
  const input = snapshotFromFeatures(index, features);
  let plan: IdentityPlanResult;
  if (action === 'anchor-retain') {
    plan = planRetainExistingLocation(input, currentPath, candidate.nodeId);
  } else if (action === 'anchor-attach') {
    if (!candidate.rebasedPath) return { ok: false, error: '缺少 rebasedPath' };
    plan = planAnchorAttach(input, currentPath, { nodeId: candidate.nodeId, rebasedPath: candidate.rebasedPath });
  } else {
    if (candidate.anchorK == null) return { ok: false, error: '缺少 anchorK' };
    plan = planAnchorAbsorb(input, currentPath, { nodeId: candidate.nodeId, anchorK: candidate.anchorK });
  }
  if (!plan.ok) return { ok: false, error: plan.error, collision: plan.collision };
  const ok = await commitSnapshot(features, plan.snapshot, plan.movedIdMap, plan.deletedNodeIds);
  return ok ? { ok: true, canonicalNodeId: plan.canonicalNodeId } : { ok: false, error: '写回聊天楼层失败' };
}

export async function removeLocationAlias(rawPath: string): Promise<boolean> {
  const index = await readTreeIndex();
  if (!removeLocationAliasFromIndex(index, rawPath)) return false;
  return writeStoryFeatures({ [MAP_INDEX_STORY_KEY]: index });
}
