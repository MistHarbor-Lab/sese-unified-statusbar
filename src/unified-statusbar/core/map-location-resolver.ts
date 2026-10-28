// ===== 地图地点身份解析（纯逻辑：不写存储、不建节点、不调用 AI） =====

import {
  deriveFullPathFromIndex,
  normalizeLocationPath,
  parseLocationHierarchy,
  type MapTreeIndex,
  type MapTreeNode,
} from './map-tree-store';

export type LocationMatchReason = 'missing-parent-levels' | 'leaf-subset' | 'chain-anchor';

export type AnchorType = 'deeper' | 'shallower' | 'retain';

export interface LocationCandidate {
  nodeId: string;
  fullPath: string;
  reason: LocationMatchReason;
  /** chain-anchor only */
  anchorType?: AnchorType;
  /** chain-anchor only: rebased full path for ensureChainInIndex */
  rebasedPath?: string;
  /** chain-anchor only: 1-indexed match position in typed segments */
  anchorK?: number;
}

export interface ChainAnchor {
  nodeId: string;
  fullPath: string;
  anchorType: AnchorType;
  /** 1-indexed position in typed segments where the name matched */
  k: number;
  rebasedPath: string;
}

export type LocationResolution =
  | { kind: 'empty'; normalizedPath: '' }
  | { kind: 'exact'; normalizedPath: string; nodeId: string; via: 'alias' | 'canonical' | 'final-child' }
  | { kind: 'candidates'; normalizedPath: string; candidates: LocationCandidate[] }
  | { kind: 'new'; normalizedPath: string };

export interface ComparableSegment {
  text: string;
  numbers: number[];
}

const LOCATION_NUMBER_UNITS = '(?:楼|层|幢|栋|号|室|单元|区)';
const LOCATION_NUMBER_RE = new RegExp(`第?([零〇一二两三四五六七八九十百千\\d]+)(?=${LOCATION_NUMBER_UNITS})`, 'g');
const DIGIT: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};
const UNIT: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };

function parseLocationNumber(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number(raw);
  const chars = Array.from(raw);
  if (chars.every(ch => Object.prototype.hasOwnProperty.call(DIGIT, ch))) {
    return Number(chars.map(ch => DIGIT[ch]).join(''));
  }
  let total = 0;
  let current = 0;
  let saw = false;
  for (const ch of chars) {
    if (Object.prototype.hasOwnProperty.call(DIGIT, ch)) {
      current = DIGIT[ch];
      saw = true;
      continue;
    }
    const unit = UNIT[ch];
    if (!unit) return null;
    total += (current || 1) * unit;
    current = 0;
    saw = true;
  }
  return saw ? total + current : null;
}

export function normalizeComparableSegment(segment: string): ComparableSegment {
  const numbers: number[] = [];
  const text = String(segment || '').trim().replace(LOCATION_NUMBER_RE, (full, raw: string) => {
    const parsed = parseLocationNumber(raw);
    if (parsed === null || !Number.isFinite(parsed)) return full;
    numbers.push(parsed);
    return String(parsed);
  });
  return { text, numbers };
}

function sameNumbers(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}

export function equivalentSegment(a: string, b: string): boolean {
  const ca = normalizeComparableSegment(a);
  const cb = normalizeComparableSegment(b);
  return ca.text === cb.text && sameNumbers(ca.numbers, cb.numbers);
}

function strictOrderedSubsequence(shorter: string[], longer: string[]): boolean {
  if (shorter.length >= longer.length || shorter.length < 2) return false;
  if (!equivalentSegment(shorter[0], longer[0])) return false;
  if (!equivalentSegment(shorter[shorter.length - 1], longer[longer.length - 1])) return false;
  let cursor = 0;
  for (const segment of longer) {
    if (cursor < shorter.length && equivalentSegment(shorter[cursor], segment)) cursor++;
  }
  return cursor === shorter.length;
}

function leafSubset(a: string, b: string): boolean {
  const ca = normalizeComparableSegment(a);
  const cb = normalizeComparableSegment(b);
  if (ca.numbers.length > 0 && cb.numbers.length > 0 && !sameNumbers(ca.numbers, cb.numbers)) return false;
  return ca.text.includes(cb.text) || cb.text.includes(ca.text);
}

export function listNodePaths(index: MapTreeIndex): Array<{ nodeId: string; fullPath: string; segments: string[] }> {
  const out: Array<{ nodeId: string; fullPath: string; segments: string[] }> = [];
  for (const nodeId of Object.keys(index.nodes || {})) {
    const fullPath = normalizeLocationPath(deriveFullPathFromIndex(index, nodeId));
    if (!fullPath) continue;
    out.push({ nodeId, fullPath, segments: parseLocationHierarchy(fullPath).segments });
  }
  return out;
}

function exactAliasTarget(index: MapTreeIndex, normalizedPath: string): string | null {
  const raw = index.locationAliases?.[normalizedPath] as any;
  const targetNodeId = typeof raw === 'string' ? raw : raw?.targetNodeId;
  return typeof targetNodeId === 'string' && !!index.nodes[targetNodeId] ? targetNodeId : null;
}

function exactCanonicalTarget(paths: ReturnType<typeof listNodePaths>, normalizedPath: string): string | null {
  return paths.find(item => item.fullPath === normalizedPath)?.nodeId || null;
}

/**
 * 最终子节点下行 walk（软锁定）：沿 segments 用 equivalentSegment 自根/子节点下行；
 * 若走到某 finalChild 节点且后续还有未消费的更深层级 → 返回该 nodeId。
 * 调用方放在规范精确之后，故已存在的显式子节点先被规范精确命中，只有树中不存在的更细地点才归并。
 */
export function finalChildTarget(index: MapTreeIndex, segments: string[]): string | null {
  let cur: MapTreeNode | null = null; // null = 还在根层
  for (let i = 0; i < segments.length; i++) {
    const pool: string[] = cur ? cur.childIds : index.rootNodeIds;
    let next: MapTreeNode | null = null;
    for (const id of pool) {
      const n: MapTreeNode | undefined = index.nodes[id];
      if (n && equivalentSegment(n.name, segments[i])) { next = n; break; }
    }
    if (!next) return null;
    cur = next;
    if (cur.finalChild && i < segments.length - 1) return cur.nodeId;
  }
  return null;
}

function exactParentTarget(index: MapTreeIndex, paths: ReturnType<typeof listNodePaths>, parentPath: string): string | null {
  return exactAliasTarget(index, parentPath) || exactCanonicalTarget(paths, parentPath);
}

function nodeSegments(index: MapTreeIndex, nodeId: string): string[] {
  const fullPath = normalizeLocationPath(deriveFullPathFromIndex(index, nodeId));
  if (!fullPath) return [];
  return parseLocationHierarchy(fullPath).segments;
}

/**
 * 按名锚点搜索（深度容错）：在打字 segments 的非叶位置（及单段特例 k=n=1）
 * 找已有同名节点 X，自匹配名向上逐层比对祖先，通过后按深度差分类：
 *   - 同深度（k-1==j-1）：不产出——rebasedPath 恒等于 S，已由 createCanonicalPath→ensureChainInIndex 处理。
 *   - 更深（k-1<j-1）：X 有多余祖先，丢弃 S 前缀，挂后缀到 X。产出 deeper。
 *   - 更浅（k-1>j-1）：S 有多余前缀，需 reparent X 子树。产出 shallower。
 *   - 单段 retain（n=1）：仅加别名。产出 retain。
 * 同一 nodeId 多位置命中取 k 最大者（复用最多）。
 */
export function findChainAnchors(index: MapTreeIndex, segments: string[]): ChainAnchor[] {
  const n = segments.length;
  if (n === 0) return [];
  const positions: number[] = [];
  for (let k = 1; k <= n - 1; k++) positions.push(k);
  if (n === 1) positions.push(1);

  const byNode = new Map<string, ChainAnchor>();
  for (const k of positions) {
    const sK = segments[k - 1];
    for (const id of Object.keys(index.nodes || {})) {
      const X = index.nodes[id];
      if (!X || !equivalentSegment(X.name, sK)) continue;
      const segs = nodeSegments(index, id);
      if (segs.length === 0 || !equivalentSegment(segs[segs.length - 1], sK)) continue;
      const j = segs.length;
      const ancestors = segs.slice(0, j - 1);
      const m = Math.min(k - 1, j - 1);
      let ok = true;
      for (let t = 1; t <= m; t++) {
        if (!equivalentSegment(segments[k - 1 - t], ancestors[ancestors.length - t])) { ok = false; break; }
      }
      if (!ok) continue;
      const fullPath = normalizeLocationPath(deriveFullPathFromIndex(index, id));
      if (n === 1) {
        if (!byNode.has(id) || k > (byNode.get(id)!.k)) {
          byNode.set(id, { nodeId: id, fullPath, anchorType: 'retain', k, rebasedPath: fullPath });
        }
        continue;
      }
      if (k - 1 === j - 1) continue; // 同深度：已由 createCanonicalPath 处理
      const suffix = segments.slice(k);
      if (k - 1 < j - 1) {
        const rebased = suffix.length ? `${fullPath}-${suffix.join('-')}` : fullPath;
        if (!byNode.has(id) || k > byNode.get(id)!.k) {
          byNode.set(id, { nodeId: id, fullPath, anchorType: 'deeper', k, rebasedPath: rebased });
        }
      } else {
        const rebased = segments.join('-');
        if (!byNode.has(id) || k > byNode.get(id)!.k) {
          byNode.set(id, { nodeId: id, fullPath, anchorType: 'shallower', k, rebasedPath: rebased });
        }
      }
    }
  }
  return Array.from(byNode.values());
}

export function resolveMapLocation(index: MapTreeIndex, rawLocation: string): LocationResolution {
  const normalizedPath = normalizeLocationPath(rawLocation);
  if (!normalizedPath) return { kind: 'empty', normalizedPath: '' };

  const aliasTarget = exactAliasTarget(index, normalizedPath);
  if (aliasTarget) return { kind: 'exact', normalizedPath, nodeId: aliasTarget, via: 'alias' };

  const paths = listNodePaths(index);
  const canonicalTarget = exactCanonicalTarget(paths, normalizedPath);
  if (canonicalTarget) return { kind: 'exact', normalizedPath, nodeId: canonicalTarget, via: 'canonical' };

  const currentSegments = parseLocationHierarchy(normalizedPath).segments;

  // (B+) 最终子节点下行 walk（软锁定）：路径比某 finalChild 节点更深 → 归并到该节点。
  // 放在规范精确之后 = 软锁定：已存在的显式子节点先被规范精确命中，只有树中不存在的更细地点才归并。
  const finalTarget = finalChildTarget(index, currentSegments);
  if (finalTarget) return { kind: 'exact', normalizedPath, nodeId: finalTarget, via: 'final-child' };

  const candidates = new Map<string, LocationCandidate>();

  for (const item of paths) {
    const shorter = currentSegments.length < item.segments.length ? currentSegments : item.segments;
    const longer = currentSegments.length < item.segments.length ? item.segments : currentSegments;
    if (strictOrderedSubsequence(shorter, longer)) {
      candidates.set(item.nodeId, { nodeId: item.nodeId, fullPath: item.fullPath, reason: 'missing-parent-levels' });
    }
  }

  if (currentSegments.length >= 2) {
    const currentParentPath = currentSegments.slice(0, -1).join('-');
    const currentParentId = exactParentTarget(index, paths, currentParentPath);
    if (currentParentId) {
      const currentLeaf = currentSegments[currentSegments.length - 1];
      for (const item of paths) {
        const treeNode = index.nodes[item.nodeId];
        if (!treeNode || treeNode.parentId !== currentParentId || item.segments.length < 2) continue;
        const candidateLeaf = item.segments[item.segments.length - 1];
        if (!leafSubset(currentLeaf, candidateLeaf)) continue;
        if (!candidates.has(item.nodeId)) {
          candidates.set(item.nodeId, { nodeId: item.nodeId, fullPath: item.fullPath, reason: 'leaf-subset' });
        }
      }
    }
  }

  // chain-anchor 候选（按名锚定，深度容错）：用独立 key 前缀，与 fuzzy 候选并存不互覆盖
  const anchors = findChainAnchors(index, currentSegments);
  for (const a of anchors) {
    const key = `anchor:${a.nodeId}`;
    if (!candidates.has(key)) {
      candidates.set(key, {
        nodeId: a.nodeId, fullPath: a.fullPath, reason: 'chain-anchor',
        anchorType: a.anchorType, rebasedPath: a.rebasedPath, anchorK: a.k,
      });
    }
  }

  if (candidates.size > 0) {
    return { kind: 'candidates', normalizedPath, candidates: Array.from(candidates.values()) };
  }
  return { kind: 'new', normalizedPath };
}
