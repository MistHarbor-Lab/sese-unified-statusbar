import { plainClone } from './deep-clone';
import {
  deriveFullPathFromIndex,
  moveSubtreeInIndex,
  normalizeLocationPath,
  readTreeIndex,
  collapseExploreRecord,
  MAP_NODE_STORY_PREFIX,
  type MapNode,
  type MapExit,
  type MapTreeIndex,
} from './map-tree-store';
import {
  cleanupMapSceneMerge,
  MAP_SCENE_IMAGE_INDEX_KEY,
  MAP_SCENE_IMAGE_KEY_PREFIX,
  planMapSceneMerge,
  listMapSceneImages,
  type MapSceneImageRecord,
  type MapSceneMergePlan,
} from './map-scene-store';
import {
  exportStoryFeatures,
  flushStoryStorage,
  getStoryWriteBlockReason,
  getStoryWriteLastError,
  writeStoryFeatures,
} from './story-floor-store';

export interface MapMergeSelection {
  leftNodeId: string;
  rightNodeId: string;
  nameSourceId: string;
  descriptionSourceId: string;
  visualSourceId: string;
}

export interface MapMergeSnapshot {
  index: MapTreeIndex;
  mapNodes: Record<string, MapNode>;
  sceneRecords?: Record<string, MapSceneImageRecord>;
}

export interface MapMergeInspection {
  ok: boolean;
  reason?: string;
  conflicts: Array<{ name: string; leftChildId: string; rightChildId: string }>;
}

export interface MapMergePlan {
  snapshot: MapMergeSnapshot;
  finalNodeId: string;
  discardedNodeId: string;
  discardedPath: string;
  movedIdMap: Record<string, string>;
}

export type MapMergePlanResult =
  | { ok: true; plan: MapMergePlan }
  | { ok: false; error: string; conflicts: string[] };

export interface MapMergeResult {
  ok: boolean;
  finalNodeId?: string;
  discardedNodeId?: string;
  movedCount?: number;
  cleanupFailedPaths?: string[];
  error?: string;
}

export interface MapMergeStorageDeps {
  readIndex: () => Promise<MapTreeIndex>;
  exportFeatures: () => Record<string, unknown>;
  readSceneRecords: () => Promise<MapSceneImageRecord[]>;
  writeFeatures: (updates: Record<string, unknown>, deletes?: string[]) => Promise<boolean>;
  /** 写前落盘，清掉 pending / 恢复日志占位，降低大图库合并撞 512KB 上限的概率。 */
  flush?: () => Promise<void>;
  cleanupScene: (plan: MapSceneMergePlan) => Promise<{ failedPaths: string[] }>;
  now: () => number;
}

const MAP_INDEX_KEY = 'map.index';

// 节点重数据走聊天楼层存储键 map.node:（MAP_NODE_STORY_PREFIX）。旧世界书前缀 __map_node_
// 只存在于历史 comment，生产 exportStoryFeatures 里按它过滤永远拿空集（合并静默失效）。
function mapNodeKey(nodeId: string): string {
  return `${MAP_NODE_STORY_PREFIX}${nodeId}`;
}

function sceneKey(nodeId: string): string {
  return `${MAP_SCENE_IMAGE_KEY_PREFIX}${nodeId}`;
}

function defaultMergeStorageDeps(): MapMergeStorageDeps {
  return {
    readIndex: readTreeIndex,
    exportFeatures: exportStoryFeatures,
    readSceneRecords: listMapSceneImages,
    writeFeatures: writeStoryFeatures,
    flush: flushStoryStorage,
    cleanupScene: cleanupMapSceneMerge,
    now: () => Date.now(),
  };
}

const EMPTY_STRUCTURE = {
  mapSize: { width: 800, height: 600 },
  rooms: [],
  doors: [],
  exits: [],
  characters: [],
};

interface MapMergeValidation {
  canMerge: boolean;
  reason?: string;
  winnerId?: string;
  loserId?: string;
  conflicts?: Array<{ winnerChildId: string; loserChildId: string; name: string }>;
}

function nodeExists(index: MapTreeIndex, nodeId: string): boolean {
  return Boolean(index.nodes[nodeId]);
}

function pathToRoot(index: MapTreeIndex, nodeId: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = nodeId;
  while (current && !seen.has(current)) {
    seen.add(current);
    result.push(current);
    current = index.nodes[current]?.parentId ?? undefined;
  }
  return result;
}

function isAncestorOrDescendant(index: MapTreeIndex, leftId: string, rightId: string): boolean {
  const leftPath = new Set(pathToRoot(index, leftId));
  const rightPath = new Set(pathToRoot(index, rightId));
  return leftPath.has(rightId) || rightPath.has(leftId);
}

function directChildConflicts(
  index: MapTreeIndex,
  winnerId: string,
  loserId: string,
): Array<{ winnerChildId: string; loserChildId: string; name: string }> {
  const winner = index.nodes[winnerId];
  const loser = index.nodes[loserId];
  if (!winner || !loser) return [];
  const winnerNames = new Map<string, string>();
  for (const childId of winner.childIds) {
    const child = index.nodes[childId];
    if (child) winnerNames.set(child.name.trim(), childId);
  }
  const conflicts: Array<{ winnerChildId: string; loserChildId: string; name: string }> = [];
  for (const childId of loser.childIds) {
    const child = index.nodes[childId];
    const winnerChildId = child ? winnerNames.get(child.name.trim()) : undefined;
    if (child && winnerChildId) {
      conflicts.push({ winnerChildId, loserChildId: childId, name: child.name.trim() });
    }
  }
  return conflicts;
}

function validateSelection(index: MapTreeIndex, selection: MapMergeSelection): MapMergeValidation {
  const { leftNodeId, rightNodeId, nameSourceId } = selection;
  if (!nodeExists(index, leftNodeId) || !nodeExists(index, rightNodeId)) {
    return { canMerge: false, reason: '合并节点不存在' };
  }
  if (leftNodeId === rightNodeId) {
    return { canMerge: false, reason: '不能合并同一个节点' };
  }
  if (nameSourceId !== leftNodeId && nameSourceId !== rightNodeId) {
    return { canMerge: false, reason: '名称来源必须是参与合并的节点' };
  }
  for (const sourceId of [selection.descriptionSourceId, selection.visualSourceId]) {
    if (sourceId !== leftNodeId && sourceId !== rightNodeId) {
      return { canMerge: false, reason: '内容来源必须是参与合并的节点' };
    }
  }
  if (isAncestorOrDescendant(index, leftNodeId, rightNodeId)) {
    return { canMerge: false, reason: '不能合并父子关系节点' };
  }
  const loserId = nameSourceId === leftNodeId ? rightNodeId : leftNodeId;
  const conflicts = directChildConflicts(index, nameSourceId, loserId);
  if (conflicts.length > 0) {
    return {
      canMerge: false,
      reason: `子节点名称冲突：${conflicts.map((item) => item.name).join('、')}`,
      winnerId: nameSourceId,
      loserId,
      conflicts,
    };
  }
  return { canMerge: true, winnerId: nameSourceId, loserId, conflicts: [] };
}

export function inspectMapNodeMerge(
  snapshot: MapMergeSnapshot,
  leftNodeId: string,
  rightNodeId: string,
): MapMergeInspection {
  const left = validateSelection(snapshot.index, {
    leftNodeId,
    rightNodeId,
    nameSourceId: leftNodeId,
    descriptionSourceId: leftNodeId,
    visualSourceId: leftNodeId,
  });
  const right = validateSelection(snapshot.index, {
    leftNodeId,
    rightNodeId,
    nameSourceId: rightNodeId,
    descriptionSourceId: rightNodeId,
    visualSourceId: rightNodeId,
  });
  const conflicts = [
    ...(left.conflicts ?? []).map((item) => ({
      name: item.name,
      leftChildId: item.winnerChildId,
      rightChildId: item.loserChildId,
    })),
    ...(right.conflicts ?? []).map((item) => ({
      name: item.name,
      leftChildId: item.loserChildId,
      rightChildId: item.winnerChildId,
    })),
  ].filter((item, index, items) =>
    items.findIndex((candidate) => candidate.name === item.name) === index);
  const structuralFailure = !left.canMerge && !left.reason?.startsWith('子节点名称冲突')
    ? left
    : !right.canMerge && !right.reason?.startsWith('子节点名称冲突')
      ? right
      : undefined;
  return {
    ok: !structuralFailure && conflicts.length === 0,
    reason: structuralFailure?.reason ?? (conflicts.length ? '子节点名称冲突' : undefined),
    conflicts,
  };
}

function parseTime(value: string): number | undefined {
  const direct = Date.parse(value);
  if (Number.isFinite(direct)) return direct;
  const chinese = value.match(/(\d{4,6})年\s*(\d{1,2})月\s*(\d{1,2})日(?:\s*(\d{1,2})(?:时|点|:)\s*(\d{1,2})(?:分|:)?(?:\s*(\d{1,2})秒?)?)?/);
  if (chinese) {
    return Date.UTC(
      Number(chinese[1]),
      Number(chinese[2]) - 1,
      Number(chinese[3]),
      Number(chinese[4] || 0),
      Number(chinese[5] || 0),
      Number(chinese[6] || 0),
    );
  }
  const normalized = value
    .replace(/[年./]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/时/g, ':')
    .replace(/分/g, ':')
    .replace(/秒/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mergeExploreLogs(
  nameSource: MapNode | undefined,
  otherSource: MapNode | undefined,
): MapNode['exploreLog'] {
  const entries = [
    ...(nameSource?.exploreLog ?? []).map((entry, index) => ({ entry, source: 0, index })),
    ...(otherSource?.exploreLog ?? []).map((entry, index) => ({ entry, source: 1, index })),
  ];
  const seenHashes = new Set<string>();
  const deduped = entries.filter(({ entry }) => {
    if (!entry.storyHash) return true;
    if (seenHashes.has(entry.storyHash)) return false;
    seenHashes.add(entry.storyHash);
    return true;
  });
  return deduped
    .sort((left, right) => {
      const leftTime = parseTime(left.entry.time);
      const rightTime = parseTime(right.entry.time);
      if (leftTime !== undefined && rightTime !== undefined && leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      if (leftTime !== undefined && rightTime === undefined) return -1;
      if (leftTime === undefined && rightTime !== undefined) return 1;
      return left.source - right.source || left.index - right.index;
    })
    .map(({ entry }) => plainClone(entry));
}

function mapReferenceId(targetId: string, movedIdMap: Record<string, string>, loserId: string, winnerId: string): string {
  if (targetId === loserId) return winnerId;
  return movedIdMap[targetId] ?? targetId;
}

function remapExits(
  mapNode: MapNode,
  index: MapTreeIndex,
  movedIdMap: Record<string, string>,
  loserId: string,
  winnerId: string,
): MapNode {
  const result = plainClone(mapNode);
  result.structure.exits = (result.structure.exits ?? []).flatMap((exit: MapExit) => {
    const targetId = typeof exit.targetNodeId === 'string'
      ? mapReferenceId(exit.targetNodeId, movedIdMap, loserId, winnerId)
      : undefined;
    if (targetId && !index.nodes[targetId]) return [];
    return [{ ...exit, ...(targetId ? { targetNodeId: targetId } : {}) }];
  }) as MapNode['structure']['exits'];
  return result;
}

function migrateChildRecords(
  source: Record<string, MapNode>,
  index: MapTreeIndex,
  movedIdMap: Record<string, string>,
  loserId: string,
  winnerId: string,
): Record<string, MapNode> {
  const result: Record<string, MapNode> = {};
  for (const [nodeId, mapNode] of Object.entries(source)) {
    if (nodeId === loserId || nodeId === winnerId) continue;
    const mappedId = movedIdMap[nodeId] ?? nodeId;
    result[mappedId] = remapExits({ ...plainClone(mapNode), nodeId: mappedId }, index, movedIdMap, loserId, winnerId);
  }
  return result;
}

function migrateChildSceneRecords(
  source: Record<string, MapSceneImageRecord> | undefined,
  movedIdMap: Record<string, string>,
  loserId: string,
  winnerId: string,
): Record<string, MapSceneImageRecord> | undefined {
  if (!source) return undefined;
  const result: Record<string, MapSceneImageRecord> = {};
  for (const [nodeId, record] of Object.entries(source)) {
    if (nodeId === loserId || nodeId === winnerId) continue;
    const mappedId = movedIdMap[nodeId] ?? nodeId;
    result[mappedId] = { ...plainClone(record), nodeId: mappedId };
  }
  return result;
}

function removeNodeFromTopology(index: MapTreeIndex, nodeId: string): void {
  const node = index.nodes[nodeId];
  if (!node) return;
  if (node.parentId && index.nodes[node.parentId]) {
    index.nodes[node.parentId].childIds = index.nodes[node.parentId].childIds.filter((id) => id !== nodeId);
  } else {
    index.rootNodeIds = index.rootNodeIds.filter((id) => id !== nodeId);
  }
  delete index.nodes[nodeId];
}

function remapAliases(
  index: MapTreeIndex,
  oldDiscardedPath: string,
  loserId: string,
  winnerId: string,
  movedIdMap: Record<string, string>,
  now: number,
): void {
  const aliases = index.locationAliases ?? {};
  const remapped: typeof aliases = {};
  for (const [alias, targetId] of Object.entries(aliases)) {
    const mappedTarget = mapReferenceId(targetId.targetNodeId, movedIdMap, loserId, winnerId);
    if (index.nodes[mappedTarget]) {
      remapped[alias] = { targetNodeId: mappedTarget, createdAt: index.locationAliases[alias]?.createdAt ?? now };
    }
  }
  const normalizedDiscardedPath = normalizeLocationPath(oldDiscardedPath);
  const normalizedWinnerPath = normalizeLocationPath(deriveFullPathFromIndex(index, winnerId));
  if (normalizedDiscardedPath && normalizedDiscardedPath !== normalizedWinnerPath) {
    remapped[normalizedDiscardedPath] = { targetNodeId: winnerId, createdAt: now };
  }
  index.locationAliases = remapped;
}

function combineRootMapNodes(
  source: Record<string, MapNode>,
  selection: MapMergeSelection,
  winnerId: string,
  loserId: string,
  index: MapTreeIndex,
  movedIdMap: Record<string, string>,
): Record<string, MapNode> {
  const nameMap = source[selection.nameSourceId];
  const descriptionMap = source[selection.descriptionSourceId];
  const visualMap = source[selection.visualSourceId];
  const otherId = selection.nameSourceId === selection.leftNodeId ? selection.rightNodeId : selection.leftNodeId;
  const otherMap = source[otherId];
  const merged: Record<string, MapNode> = migrateChildRecords(source, index, movedIdMap, loserId, winnerId);
  const hasAnyRootMap = Boolean(nameMap || descriptionMap || visualMap || otherMap);
  if (!hasAnyRootMap) return merged;
  const visualStructure = visualMap?.structure ?? EMPTY_STRUCTURE;
  const mergedSummary = [nameMap?.exploreSummary, otherMap?.exploreSummary]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join('；');
  const recordView = collapseExploreRecord(mergedSummary, mergeExploreLogs(nameMap, otherMap));
  const result: MapNode = {
    ...(plainClone(descriptionMap ?? visualMap ?? nameMap ?? otherMap) as MapNode),
    nodeId: winnerId,
    structure: plainClone(visualStructure),
    svg: visualMap?.svg ?? '',
    explorationDesc: plainClone(descriptionMap?.explorationDesc ?? { summary: '', items: [], directions: [] }),
    exploreSummary: recordView.summary,
    exploreLog: recordView.entries,
  };
  merged[winnerId] = remapExits(result, index, movedIdMap, loserId, winnerId);
  return merged;
}

export function planMapNodeMerge(
  input: MapMergeSnapshot,
  selection: MapMergeSelection,
  now = Date.now(),
): MapMergePlanResult {
  const inspection = validateSelection(input.index, selection);
  if (!inspection.canMerge || !inspection.winnerId || !inspection.loserId) {
    return {
      ok: false,
      error: inspection.reason ?? '当前节点不能合并',
      conflicts: inspection.conflicts?.map((item) => item.name) ?? [],
    };
  }
  const winnerId = inspection.winnerId;
  const loserId = inspection.loserId;
  const index = plainClone(input.index);
  const mapNodes = plainClone(input.mapNodes);
  const sceneRecords = plainClone(input.sceneRecords);
  const discardedPath = deriveFullPathFromIndex(index, loserId);
  const loserChildren = [...(index.nodes[loserId]?.childIds ?? [])];
  const movedIdMap: Record<string, string> = {};
  for (const childId of loserChildren) {
    const moveResult = moveSubtreeInIndex(index, childId, winnerId);
    if ('error' in moveResult) {
      return { ok: false, error: moveResult.error, conflicts: [] };
    }
    for (const [oldId, newId] of moveResult.migration.entries()) {
      movedIdMap[oldId] = newId;
    }
  }
  const winner = index.nodes[winnerId];
  const loser = input.index.nodes[loserId];
  if (winner && loser) {
    winner.finalChild = Boolean(winner.finalChild || loser.finalChild);
    if ((loser.updatedAt || 0) > (winner.updatedAt || 0)) {
      winner.updatedAt = loser.updatedAt;
      winner.lastStoryHash = loser.lastStoryHash;
    } else {
      winner.updatedAt = winner.updatedAt || loser.updatedAt;
      winner.lastStoryHash = winner.lastStoryHash || loser.lastStoryHash;
    }
  }
  removeNodeFromTopology(index, loserId);
  if (index.favorites) {
    if (input.index.favorites.includes(loserId)) index.favorites.push(winnerId);
    index.favorites = [...new Set(index.favorites.filter((id) => id !== loserId))];
  }
  remapAliases(index, discardedPath, loserId, winnerId, movedIdMap, now);
  const nextMapNodes = combineRootMapNodes(mapNodes, selection, winnerId, loserId, index, movedIdMap);
  if (index.nodes[winnerId]) {
    const mergedMap = nextMapNodes[winnerId];
    const mergedHasMap = !!(mergedMap && (mergedMap.svg || (Array.isArray(mergedMap.structure?.rooms) && mergedMap.structure.rooms.length > 0)));
    index.nodes[winnerId].status = mergedMap
      ? (mergedHasMap ? 'generated' : 'text-only')
      : index.nodes[winnerId].status;
  }
  const nextSceneRecords = migrateChildSceneRecords(sceneRecords, movedIdMap, loserId, winnerId);
  for (const mapNode of Object.values(nextMapNodes)) {
    const remapped = remapExits(mapNode, index, movedIdMap, loserId, winnerId);
    nextMapNodes[remapped.nodeId] = remapped;
  }
  return {
    ok: true,
    plan: {
      snapshot: { index, mapNodes: nextMapNodes, sceneRecords: nextSceneRecords },
      finalNodeId: winnerId,
      discardedNodeId: loserId,
      discardedPath,
      movedIdMap,
    },
  };
}

export function createMapMergeService(
  overrides: Partial<MapMergeStorageDeps> = {},
): { merge: (selection: MapMergeSelection) => Promise<MapMergeResult> } {
  const deps: MapMergeStorageDeps = { ...defaultMergeStorageDeps(), ...overrides };

  return {
    async merge(selection: MapMergeSelection): Promise<MapMergeResult> {
      try {
      await deps.flush?.();
      const [index, features, sceneRecords] = await Promise.all([
        deps.readIndex(),
        Promise.resolve(deps.exportFeatures()),
        deps.readSceneRecords(),
      ]);
      const mapNodes: Record<string, MapNode> = {};
      for (const [key, value] of Object.entries(features)) {
        if (!key.startsWith(MAP_NODE_STORY_PREFIX) || !value || typeof value !== 'object') continue;
        const candidate = value as MapNode;
        if (typeof candidate.nodeId !== 'string') continue;
        mapNodes[candidate.nodeId] = plainClone(candidate);
      }
      const sceneRecordMap = Object.fromEntries(sceneRecords.map((record) => [record.nodeId, record]));
      const planned = planMapNodeMerge({ index, mapNodes, sceneRecords: sceneRecordMap }, selection, deps.now());
      if (!planned.ok) {
        return { ok: false, error: planned.error };
      }

      const { plan } = planned;
      const finalNode = plan.snapshot.index.nodes[plan.finalNodeId];
      const scenePlan = planMapSceneMerge({
        records: sceneRecords,
        leftNodeId: selection.leftNodeId,
        rightNodeId: selection.rightNodeId,
        finalNodeId: plan.finalNodeId,
        visualSourceId: selection.visualSourceId,
        idMigration: new Map(Object.entries(plan.movedIdMap)),
        canonicalPath: deriveFullPathFromIndex(plan.snapshot.index, plan.finalNodeId),
        locationLabel: finalNode?.name ?? plan.finalNodeId,
      });

      const updates: Record<string, unknown> = {
        [MAP_INDEX_KEY]: plan.snapshot.index,
        [MAP_SCENE_IMAGE_INDEX_KEY]: [],
      };
      for (const [nodeId, mapNode] of Object.entries(plan.snapshot.mapNodes)) {
        // 只写真正变化的节点：合并会把所有节点的 exits 过一遍，但绝大多数节点没变。
        // 全量回写会轻易超过写入协调器 512KB 的恢复日志上限（症状：合并写回直接失败）。
        const original = mapNodes[nodeId];
        if (original && JSON.stringify(original) === JSON.stringify(mapNode)) continue;
        updates[mapNodeKey(nodeId)] = mapNode;
      }
      const existingSceneIds = sceneRecords.map((record) => record.nodeId);
      const migratedSceneIds = new Set(
        Object.keys(plan.movedIdMap).filter((nodeId) => existingSceneIds.includes(nodeId)),
      );
      const sceneDeletes = new Set([...scenePlan.deleteNodeIds, ...migratedSceneIds]);
      const nextSceneIds = existingSceneIds
        .filter((nodeId) => !sceneDeletes.has(nodeId))
        .concat(scenePlan.upserts.map((record) => record.nodeId));
      updates[MAP_SCENE_IMAGE_INDEX_KEY] = [...new Set(nextSceneIds)];
      for (const record of scenePlan.upserts) updates[sceneKey(record.nodeId)] = record;

      const originalMapKeys = Object.keys(mapNodes).map(mapNodeKey);
      const nextMapKeys = new Set(Object.keys(plan.snapshot.mapNodes).map(mapNodeKey));
      const deletes = new Set<string>([
        ...originalMapKeys.filter((key) => !nextMapKeys.has(key)),
        ...[...sceneDeletes].map(sceneKey),
      ]);
      const written = await deps.writeFeatures(updates, [...deletes]);
      if (!written) {
        const block = getStoryWriteBlockReason();
        const lastError = getStoryWriteLastError();
        const detail = block === 'not-ready'
          ? '聊天存储尚未就绪（可能正在载入或切换聊天）'
          : block === 'deletion-blocked'
            ? '聊天正在删除/恢复，写入暂时被锁定'
            : block === 'no-coordinator'
              ? '存储写入协调器尚未就绪'
              : lastError
                ? `存储拒绝写入：${lastError}`
                : '存储拒绝写入（可能正在落盘，请稍后重试）';
        console.warn('[map-merge] 写入失败:', detail, {
          finalNodeId: plan.finalNodeId,
          discardedNodeId: plan.discardedNodeId,
          updates: Object.keys(updates).length,
          deletes: deletes.size,
          approxBytes: (() => {
            try { return JSON.stringify(updates).length + JSON.stringify([...deletes]).length; } catch (_e) { return null; }
          })(),
        });
        return { ok: false, error: `地图合并元数据写入失败：${detail}` };
      }

      const cleanup = await deps.cleanupScene(scenePlan);
      return {
        ok: true,
        finalNodeId: plan.finalNodeId,
        discardedNodeId: plan.discardedNodeId,
        movedCount: Object.keys(plan.movedIdMap).length,
        cleanupFailedPaths: cleanup.failedPaths,
      };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : '地图合并失败',
        };
      }
    },
  };
}

export const mapMergeService = createMapMergeService();
