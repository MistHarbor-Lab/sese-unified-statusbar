// ===== 人物关系网：确定性力导向布局（纯函数，同数据同布局） =====
// 不用 Math.random——种子来自关系数据本身的 FNV 哈希，保证同一份关系数据每次打开布局稳定不跳变。
// 画布坐标系固定（默认 1000×640），渲染端按 viewBox 缩放。
import { fnv1a32 } from './stable-hash';

export interface RelationLayoutEdgeInput {
  a: string;
  b: string;
}

export interface RelationLayoutInput {
  names: string[];
  edges: RelationLayoutEdgeInput[];
  width?: number;
  height?: number;
  /** 整数种子（通常来自 relationLayoutSeed）。 */
  seed?: number;
  iterations?: number;
}

export interface RelationLayoutPosition {
  x: number;
  y: number;
}

/** 数据指纹种子：节点名 ∪ 无序边排序后 FNV-1a 32 位。 */
export function relationLayoutSeed(names: readonly string[], edges: readonly RelationLayoutEdgeInput[]): number {
  const parts = [
    ...[...names].slice().sort(),
    ...edges.map(e => (e.a < e.b ? `${a2(e.a, e.b)}` : `${a2(e.b, e.a)}`)).sort(),
  ].join('\u0001');
  return fnv1a32(parts);
}

function a2(x: string, y: string): string {
  return `${x}\u0000${y}`;
}

/** mulberry32：确定性 PRNG。 */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 计算布局。节点数 ≤3 退化为手工排布；否则黄金角螺旋初始化 + 斥力/弹簧/向心力模拟。
 * 返回 name → 位置（画布坐标）。
 */
export function computeRelationLayout(input: RelationLayoutInput): Map<string, RelationLayoutPosition> {
  const width = input.width && input.width > 100 ? input.width : 1000;
  const height = input.height && input.height > 100 ? input.height : 640;
  const names = [...new Set(input.names.filter(Boolean))];
  const positions = new Map<string, RelationLayoutPosition>();
  const n = names.length;
  if (n === 0) return positions;
  const cx = width / 2, cy = height / 2;
  if (n === 1) { positions.set(names[0], { x: cx, y: cy }); return positions; }
  if (n === 2) {
    positions.set(names[0], { x: cx - width * 0.18, y: cy });
    positions.set(names[1], { x: cx + width * 0.18, y: cy });
    return positions;
  }
  if (n === 3) {
    const r = Math.min(width, height) * 0.22;
    names.forEach((name, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
      positions.set(name, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    });
    return positions;
  }

  const rng = mulberry32((input.seed ?? relationLayoutSeed(names, input.edges)) >>> 0);
  const pad = Math.max(46, Math.min(width, height) * 0.09);
  const maxR = Math.min(width, height) / 2 - pad;
  const px = new Float64Array(n), py = new Float64Array(n), vx = new Float64Array(n), vy = new Float64Array(n);
  const degree = new Float64Array(n);
  const index = new Map<string, number>(names.map((name, i) => [name, i]));
  const edgePairs: Array<[number, number]> = [];
  for (const edge of input.edges) {
    const ia = index.get(edge.a), ib = index.get(edge.b);
    if (ia === undefined || ib === undefined || ia === ib) continue;
    edgePairs.push([ia, ib]);
    degree[ia]++; degree[ib]++;
  }
  // 黄金角螺旋 + 少量种子抖动，避免对称数据导致的规则网格
  const GOLDEN = 2.399963229728653;
  for (let i = 0; i < n; i++) {
    const angle = i * GOLDEN + rng() * 0.6;
    const radius = maxR * Math.sqrt((i + 0.5) / n) * (0.92 + rng() * 0.16);
    px[i] = cx + radius * Math.cos(angle);
    py[i] = cy + radius * Math.sin(angle) * 0.82; // 椭圆化适配宽画布
  }

  const iterations = input.iterations ?? (n <= 30 ? 300 : n <= 60 ? 200 : 140);
  const REPULSION = 90000;
  const restLength = Math.max(110, Math.min(230, (Math.min(width, height) * 0.42) / (1 + Math.log2(1 + n / 8))));
  const SPRING = 0.06;
  const maxStep = 34;

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 1 - iter / iterations;
    const fx = new Float64Array(n), fy = new Float64Array(n);
    // 斥力（全体对）
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = px[i] - px[j], dy = py[i] - py[j];
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = 0.5 + rng() * 0.1; dy = 0.5; d2 = dx * dx + dy * dy; }
        if (d2 > 1000000) continue; // >1000px 视为不相邻，忽略（大图剪枝）
        const f = Math.min(REPULSION / d2, 40);
        const d = Math.sqrt(d2);
        const ux = dx / d, uy = dy / d;
        fx[i] += ux * f; fy[i] += uy * f;
        fx[j] -= ux * f; fy[j] -= uy * f;
      }
    }
    // 弹簧（边）
    for (const [ia, ib] of edgePairs) {
      const dx = px[ib] - px[ia], dy = py[ib] - py[ia];
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = (d - restLength) * SPRING;
      const ux = dx / d, uy = dy / d;
      fx[ia] += ux * f; fy[ia] += uy * f;
      fx[ib] -= ux * f; fy[ib] -= uy * f;
    }
    // 向心力（度数高者更靠中心；弱于斥力，防整体塌缩）
    for (let i = 0; i < n; i++) {
      const g = 0.0055 * (1 + degree[i] * 0.3);
      fx[i] += (cx - px[i]) * g;
      fy[i] += (cy - py[i]) * g;
    }
    for (let i = 0; i < n; i++) {
      vx[i] = (vx[i] + fx[i]) * 0.82;
      vy[i] = (vy[i] + fy[i]) * 0.82;
      const sx = Math.max(-maxStep, Math.min(maxStep, vx[i] * temp));
      const sy = Math.max(-maxStep, Math.min(maxStep, vy[i] * temp));
      px[i] = Math.max(pad, Math.min(width - pad, px[i] + sx));
      py[i] = Math.max(pad, Math.min(height - pad, py[i] + sy));
    }
  }

  // 归一化：力模拟决定拓扑（谁挨谁），这里按 X/Y 两轴各自等比撑满画布
  // （防参数失衡导致挤成一团；4.2 倍上限防微小团被过度拉伸）。
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, px[i]); maxX = Math.max(maxX, px[i]);
    minY = Math.min(minY, py[i]); maxY = Math.max(maxY, py[i]);
  }
  const spanX = Math.max(1, maxX - minX), spanY = Math.max(1, maxY - minY);
  const scaleX = Math.min(4.2, (width - 2 * pad) / spanX);
  const scaleY = Math.min(4.2, (height - 2 * pad) / spanY);
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
  for (let i = 0; i < n; i++) {
    px[i] = Math.max(pad, Math.min(width - pad, cx + (px[i] - midX) * scaleX));
    py[i] = Math.max(pad, Math.min(height - pad, cy + (py[i] - midY) * scaleY));
  }

  // 最小间距保障：把小于 MIN_SEP 的节点对沿连线方向推开（确定性，d≈0 时按索引奇偶定方向）。
  const MIN_SEP = 96;
  for (let round = 0; round < 40; round++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = px[j] - px[i], dy = py[j] - py[i];
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d >= MIN_SEP) continue;
        if (d < 0.5) { dx = 1; dy = (i + j) % 2 === 0 ? 0.25 : -0.25; d = Math.sqrt(dx * dx + dy * dy); }
        const push = (MIN_SEP - d) / 2;
        const ux = dx / d, uy = dy / d;
        px[i] = Math.max(pad, Math.min(width - pad, px[i] - ux * push));
        py[i] = Math.max(pad, Math.min(height - pad, py[i] - uy * push));
        px[j] = Math.max(pad, Math.min(width - pad, px[j] + ux * push));
        py[j] = Math.max(pad, Math.min(height - pad, py[j] + uy * push));
        moved = true;
      }
    }
    if (!moved) break;
  }

  names.forEach((name, i) => positions.set(name, { x: px[i], y: py[i] }));
  return positions;
}
