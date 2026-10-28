import { readTreeIndex, listAllNodesForUI, readMapNodesBatch, deriveFullPathFromIndex, registerMapTreeChangeListener, readExploreRecordView, type MapTreeIndex } from './map-tree-store';
import { STANDARD_RECURSION } from './constants';
import { getConfig } from './config-store';
import { dsCachePos, registerManagedWbEntry, type WbPosSpec } from './wb-position';
import { wbEntryName } from './worldbook-entry';
import { debounce } from './timing';
import { requestWorldbookProjection } from './worldbook-projection-events';

const MAP_NODE_WB_PREFIX = 'UBS-地图-节点-';
// O18-A：旧版地图节点前缀（`__map_node_`）兼容已退役——改由 core/legacy-worldbook-entries.ts
// 在投影全量刷新时统一回收；本模块只认当前前缀。
const MAP_NODE_WB_ORDER_BASE = 8007;

export function parseExcludePattern(value: string): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  return Array.from(new Set(value.split(/[,，、]/).map(part => part.trim()).filter(Boolean)));
}

export function resolveNodeKeyword(index: MapTreeIndex, nodeId: string, excludes: string[]): string {
  const node = index.nodes[nodeId];
  if (!node) return '';
  if (!excludes.includes(node.name)) return node.name;
  return node.parentId && index.nodes[node.parentId] ? index.nodes[node.parentId].name : node.name;
}

function buildNodeContent(
  fullPath: string,
  summary: string,
  items: string[],
  directions: string,
  exploreSummary: string,
  exploreLog: { time?: string; note: string }[],
): string {
  const lines = [`<${fullPath}>`, `地点名称：${fullPath}`, `简介：${summary}`, `物品：${items.join('、')}`, `方位：${directions}`];
  if (exploreSummary) lines.push(`探索情况总结：${exploreSummary}`);
  const recent = exploreLog.slice(-3).filter(item => String(item?.note || '').trim());
  if (recent.length) {
    lines.push('近期探索记录：');
    for (const item of recent) {
      lines.push(`- [${item.time || '未知时间'}] ${String(item.note).trim()}`);
    }
  }
  lines.push(`</${fullPath}>`);
  return lines.join('\n');
}

function makeNodeEntry(nodeId: string, keyword: string, content: string, index: number): any {
  const original: WbPosSpec = { type: 'before_character_definition', role: 'system', depth: 0, order: MAP_NODE_WB_ORDER_BASE + index };
  return {
    name: MAP_NODE_WB_PREFIX + nodeId,
    comment: MAP_NODE_WB_PREFIX + nodeId,
    enabled: true,
    content,
    strategy: { type: 'selective', keys: [keyword], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' },
    position: dsCachePos(original),
    recursion: STANDARD_RECURSION,
    addMemo: true,
  };
}

export interface MapNodeWorldbookTarget {
  nodeId: string;
  entry: any;
}

/** Mutates the coordinator-owned entry copy and reports whether it changed. */
export function reconcileMapNodeWorldbookEntries(entries: any[], targets: readonly MapNodeWorldbookTarget[]): boolean {
  const targetIds = new Set(targets.map(target => target.nodeId));
  const next = entries.filter(entry => {
    const name = wbEntryName(entry);
    if (!name.startsWith(MAP_NODE_WB_PREFIX)) return true;
    return targetIds.has(name.slice(MAP_NODE_WB_PREFIX.length));
  });
  let changed = next.length !== entries.length;
  for (const target of targets) {
    const name = MAP_NODE_WB_PREFIX + target.nodeId;
    const index = next.findIndex(entry => wbEntryName(entry) === name);
    if (index < 0) {
      next.push(target.entry);
      changed = true;
    } else {
      const replacement = { ...next[index], ...target.entry };
      if (JSON.stringify(next[index]) !== JSON.stringify(replacement)) {
        next[index] = replacement;
        changed = true;
      }
    }
  }
  if (changed) entries.splice(0, entries.length, ...next);
  return changed;
}

export async function buildMapNodeWorldbookTargets(): Promise<MapNodeWorldbookTarget[]> {
  const config = getConfig();
  if (config.mapEnabled !== true) return [];
  const tree = await readTreeIndex();
  const excludes = parseExcludePattern(config.mapExcludePattern);
  const targets: MapNodeWorldbookTarget[] = [];
  // 批量读：已探索节点（有地图或只有文字记录）一次取回，替代逐节点串行 readMapNode（每读曾=全量重放）
  const explored = listAllNodesForUI(tree).filter(info => info.status === 'generated' || info.status === 'text-only');
  const nodesById = readMapNodesBatch(explored.map(info => info.nodeId));
  for (const info of explored) {
    const node = nodesById[info.nodeId];
    if (!node) continue;
    const recordView = readExploreRecordView(node);
    const content = buildNodeContent(
      deriveFullPathFromIndex(tree, info.nodeId),
      node.explorationDesc.summary,
      node.explorationDesc.items,
      node.explorationDesc.directions,
      recordView.summary,
      recordView.entries,
    );
    targets.push({
      nodeId: info.nodeId,
      entry: makeNodeEntry(info.nodeId, resolveNodeKeyword(tree, info.nodeId, excludes), content, targets.length),
    });
  }
  return targets;
}

export async function syncMapNodeWorldbookEntries(): Promise<void> {
  requestWorldbookProjection('map-nodes', 'data-change');
}

registerMapTreeChangeListener(debounce(() => { void syncMapNodeWorldbookEntries(); }, 500));
registerManagedWbEntry({
  match: entry => wbEntryName(entry).startsWith(MAP_NODE_WB_PREFIX),
  origPos: () => ({ type: 'before_character_definition', role: 'system', depth: 0, order: 0 }) as WbPosSpec,
});
