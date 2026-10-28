// ===== 人物关系网（人物网）：SVG 力导向关系图弹窗 =====
// 数据源：人物关系表（成对关系，不含主角对）+ 角色名册（恋爱对象/重要角色/主角）。
// 名册成员与主角的连线来自角色表「对主角态度」列（关系段），边详情展示态度段。
// 布局确定性（同数据同布局）；节点融入立绘；边色按关系类别；与角色中枢深链互通。
import type { StyleType } from '../core/constants';
import { getInitials, getSheetByName } from '../core/data-manager';
import { missingTableRepairHint } from '../core/ledger-takeover';
import { escapeHtml, escapeHtmlAttr } from '../core/html-escape';
import { buildCharacterHubRoster, buildProtagonistRecord } from '../core/character-hub-model';
import {
  dedupeCharacterRelations,
  parseCharacterRelationRows,
  buildCharacterRelationGraph,
  relationCategoryClass as catClass,
  RELATION_CATEGORIES,
  type CharacterRelation,
  type RelationCategory,
} from '../core/character-relation-model';
import { computeRelationLayout, relationLayoutSeed, type RelationLayoutPosition } from '../core/character-relation-layout';
import { ubIcon } from '../core/icons';
import { bridgeWindowClass, closePanelOverlay, guardGhostClick, markPopupShown, setPopupReturnTo, syncDarkClass, syncDarkClassMinimal } from './html-builder';

export interface CharacterRelationGraphPopupArgs {
  style: StyleType;
  /** 打开即聚焦的人物名（从角色详情跳入）。 */
  initialFocus?: string;
  onClosed?: () => void;
}

const CHAR_RELATION_TABLE = '人物关系表';
const CANVAS_W = 1000;
const CANVAS_H = 640;
const SVG_NS = 'http://www.w3.org/2000/svg';

function titleForStyle(style: StyleType): string {
  if (style === 'minimal') return 'RELATION WEB';
  if (style === 'bridge') return 'RELATION CHART';
  if (style === 'ancient') return '关系图谱';
  if (style === 'xianxia') return '因缘之网';
  return '人物关系网';
}

/** 姓名散列稳定色相（与角色中枢色点同源）。 */
function charHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % 360;
}

function pairKeyOf(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

function kindLabel(kind: string): string {
  if (kind === 'protagonist') return '主角';
  if (kind === 'romance') return '恋爱对象';
  if (kind === 'important') return '重要角色';
  return '未归档';
}

function appendHtml(parent: Element, html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  parent.append(template.content);
}

function replaceHtml(parent: Element, html: string): void {
  parent.replaceChildren();
  appendHtml(parent, html);
}

export function showCharacterRelationGraphPopup(args: CharacterRelationGraphPopupArgs): void {
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;

  // ── 数据组装 ──
  const sheet = getSheetByName(CHAR_RELATION_TABLE);
  const relationRows = parseCharacterRelationRows(sheet);
  const roster = buildCharacterHubRoster();
  const protagonist = buildProtagonistRecord();
  const graph = buildCharacterRelationGraph(
    relationRows,
    roster.map(r => ({ name: r.name, kind: r.kind, portraitPath: r.portraitPath, briefIntro: r.briefIntro || r.identity, attitudeCell: r.attitude })),
    protagonist ? { name: protagonist.name } : null,
  );
  const nodeByName = new Map(graph.nodes.map(n => [n.name, n]));
  const edgeByPair = new Map(graph.edges.map(e => [pairKeyOf(e.a, e.b), e]));
  const duplicates = dedupeCharacterRelations(relationRows).duplicates;

  // ── 状态 ──
  type Selection = { type: 'node'; name: string } | { type: 'edge'; pairKey: string; from: string | null } | null;
  let selection: Selection = null;
  let filter: RelationCategory | null = null;
  let positions = new Map<string, RelationLayoutPosition>();

  const popupClass = args.style === 'bridge'
    ? `${bridgeWindowClass('char-relation', 'xl')} char-relation-popup`
    : 'panel-popup char-relation-popup ub-popup--xl';
  if (args.style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  const root = document.createElement('div');
  root.className = `${popupClass} char-hub-theme-${args.style}`;
  appendHtml(root, `<div class="panel-popup-head"><div class="panel-popup-title">${escapeHtml(titleForStyle(args.style))}</div><button class="panel-popup-close" id="panelClose" type="button">&times;</button></div><div class="cr-shell"><div class="cr-toolbar" data-cr-toolbar></div><div class="cr-main"><div class="cr-canvas-wrap" data-cr-canvas></div><aside class="cr-panel" data-cr-panel></aside></div></div>`);
  overlay.replaceChildren(root);
  const toolbarRoot = root.querySelector<HTMLElement>('[data-cr-toolbar]');
  const canvasRoot = root.querySelector<HTMLElement>('[data-cr-canvas]');
  const panelRoot = root.querySelector<HTMLElement>('[data-cr-panel]');
  if (!toolbarRoot || !canvasRoot || !panelRoot) return;

  // ═══ 工具栏 / 开关 / 返回栈（空态与常态共用，全部先于空态块定义） ═══
  const renderToolbar = (isEmpty = false): void => {
    if (isEmpty) { replaceHtml(toolbarRoot, ''); return; }
    const chips = RELATION_CATEGORIES
      .map(cat => {
        const count = graph.stats.categoryCounts[cat] || 0;
        if (!count) return '';
        const active = filter === cat ? ' active' : '';
        return `<button class="cr-chip cat-${catClass(cat)}${active}" data-cr-filter="${cat}" type="button"><i></i>${cat}<em>${count}</em></button>`;
      })
      .join('');
    const allActive = !filter ? ' active' : '';
    replaceHtml(toolbarRoot, `<div class="cr-stats"><b>${graph.stats.nodeCount}</b><span>位人物</span><b>${graph.stats.edgeCount}</b><span>段关系</span></div><div class="cr-chips">${chips ? `<button class="cr-chip cr-chip-all${allActive}" data-cr-filter="" type="button">全部</button>${chips}` : ''}</div><button class="cr-reset" data-cr-reset type="button" title="清除选中与筛选，恢复自动布局">重置视角</button>`);
  };
  const onOverlayClick = (event: MouseEvent): void => {
    if (event.target === overlay && !guardGhostClick()) closeGraph();
  };
  const restoreGraph = (): void => {
    overlay.onclick = null;
    overlay.replaceChildren(root);
    markPopupShown();
    overlay.classList.add('show');
    overlay.addEventListener('click', onOverlayClick);
  };
  const dispose = (): void => {
    overlay.removeEventListener('click', onOverlayClick);
    setPopupReturnTo(null);
  };
  const closeGraph = (): void => {
    dispose();
    if (args.onClosed) args.onClosed(); else closePanelOverlay(overlay);
  };
  const finishOpen = (): void => {
    markPopupShown();
    overlay.classList.add('show');
    overlay.onclick = null;
    overlay.oninput = null;
    overlay.onsubmit = null;
    overlay.addEventListener('click', onOverlayClick);
  };
  const handoffToHub = (name: string): void => {
    if (!(window as any).__ub_showCharacterHub) return;
    overlay.removeEventListener('click', onOverlayClick);
    setPopupReturnTo(restoreGraph);
    (window as any).__ub_showCharacterHub(name);
  };

  // ═══ 空态：表缺失 / 无数据（主角边也算数据：态度列有格式化内容即可成图） ═══
  if (!graph.edges.length) {
    renderToolbar(true);
    replaceHtml(canvasRoot, '');
    panelRoot.innerHTML = !sheet
      ? `<div class="panel-empty cr-empty">当前聊天还没有「人物关系表」。<br>请${missingTableRepairHint()}（V3.1.0+）后使用。</div>`
      : `<div class="panel-empty cr-empty">还没有任何关系记录。<br><br>当两名已登记人物产生互动（交谈/照面/共处一幕）且本表尚无该对人物的行时，AI 填表会自动记录；<br>角色与主角的关系随角色表「对主角态度」列（关系：XX；态度：YY）生成连线。</div>`;
    finishOpen();
    return;
  }

  // ═══ 布局 ═══
  const layoutAll = (): void => {
    positions = computeRelationLayout({
      names: graph.nodes.map(n => n.name),
      edges: graph.edges.map(e => ({ a: e.a, b: e.b })),
      width: CANVAS_W,
      height: CANVAS_H,
      seed: relationLayoutSeed(graph.nodes.map(n => n.name), graph.edges.map(e => ({ a: e.a, b: e.b }))),
    });
  };
  layoutAll();

  // ═══ SVG 渲染 ═══
  let svgEl: SVGSVGElement | null = null;
  const nodeEls = new Map<string, SVGGElement>();
  const edgeEls = new Map<string, { group: SVGGElement; line: SVGPathElement; hit: SVGPathElement; label: SVGGElement }>();

  const edgeVisible = (category: RelationCategory): boolean => !filter || filter === category;

  const edgePath = (a: string, b: string): string => {
    const pa = positions.get(a) || { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    const pb = positions.get(b) || { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    // 轻微弧度（成对哈希奇偶定向），直线上略作起伏增加有机感
    const bend = (pairKeyOf(a, b).length % 2 === 0 ? 1 : -1) * Math.min(26, dist * 0.1);
    const cx = mx - (dy / dist) * bend, cy = my + (dx / dist) * bend;
    return `M ${pa.x.toFixed(1)} ${pa.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${pb.x.toFixed(1)} ${pb.y.toFixed(1)}`;
  };

  const nodeRadius = (degree: number): number => 34 + Math.min(12, degree * 2);

  const buildSvg = (): void => {
    canvasRoot.replaceChildren();
    nodeEls.clear();
    edgeEls.clear();
    const sv = svg('svg', { viewBox: `0 0 ${CANVAS_W} ${CANVAS_H}`, preserveAspectRatio: 'xMidYMid meet', class: 'cr-svg' });
    const defs = svg('defs');
    graph.nodes.forEach((node, i) => {
      if (!node.portraitPath) return;
      const clipId = `crClip${i}`;
      const clip = svg('clipPath', { id: clipId });
      const r = nodeRadius(node.degree) - 2;
      clip.append(svg('circle', { cx: 0, cy: 0, r }));
      defs.append(clip);
    });
    sv.append(defs);
    const edgesGroup = svg('g', { class: 'cr-edges' });
    const nodesGroup = svg('g', { class: 'cr-nodes' });
    sv.append(edgesGroup, nodesGroup);

    graph.nodes.forEach((node, i) => {
      const p = positions.get(node.name) || { x: CANVAS_W / 2, y: CANVAS_H / 2 };
      const r = nodeRadius(node.degree);
      const hue = charHue(node.name);
      const g = svg('g', { class: `cr-node kind-${node.kind}`, 'data-cr-node': node.name, transform: `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})` });
      g.append(svg('circle', { class: 'cr-node-halo', r: r + 8 }));
      g.append(svg('circle', { class: 'cr-node-disc', r, fill: `hsl(${hue},48%,40%)` }));
      if (node.portraitPath) {
        const img = svg('image', {
          class: 'cr-node-portrait', href: node.portraitPath,
          x: -(r - 2), y: -(r - 2), width: (r - 2) * 2, height: (r - 2) * 2,
          preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#crClip${i})`,
        });
        g.append(img);
      } else {
        const initials = svg('text', { class: 'cr-node-initials', 'text-anchor': 'middle', dy: '0.36em' });
        initials.textContent = getInitials(node.name);
        g.append(initials);
      }
      g.append(svg('circle', { class: 'cr-node-ring', r: r + 2.5, fill: 'none', stroke: `hsl(${hue},70%,60%)` }));
      if (node.kind === 'protagonist') {
        g.append(svg('circle', { class: 'cr-node-crown', r: r + 7, fill: 'none' }));
      }
      const label = svg('text', { class: 'cr-node-label', y: r + 17, 'text-anchor': 'middle' });
      label.textContent = node.name;
      g.append(label);
      nodeEls.set(node.name, g);
      nodesGroup.append(g);
    });

    graph.edges.forEach(edge => {
      const pairKey = pairKeyOf(edge.a, edge.b);
      const group = svg('g', { class: `cr-edge cat-${catClass(edge.category)}`, 'data-cr-edge': pairKey });
      const hit = svg('path', { class: 'cr-edge-hit', d: edgePath(edge.a, edge.b) });
      const line = svg('path', { class: 'cr-edge-line', d: edgePath(edge.a, edge.b) });
      const label = svg('g', { class: 'cr-edge-label' });
      const labelText = svg('text', { 'text-anchor': 'middle' });
      labelText.textContent = edge.relation.relationType || '关系';
      // 胶囊底衬：CJK≈1em、ASCII≈0.6em 估宽（脱离 DOM 时 getBBox 不可靠）
      const fontSize = 20;
      const estWidth = [...labelText.textContent].reduce((w, ch) => w + (ch.charCodeAt(0) > 0xFF ? fontSize : fontSize * 0.62), 0);
      const rectH = fontSize * 1.2 + 4;
      label.append(svg('rect', { x: -(estWidth / 2 + 8), y: -(rectH / 2 + fontSize * 0.18), width: estWidth + 16, height: rectH, rx: rectH / 2 }), labelText);
      group.append(hit, line, label);
      edgeEls.set(pairKey, { group, line, hit, label });
      edgesGroup.append(group);
    });

    svgEl = sv;
    canvasRoot.append(sv, zoomControls);
    applyVisualState();
    applyView();
  };

  /** 选中/筛选视觉态：节点高亮或淡出、边同理；标签按需显示。 */
  const applyVisualState = (): void => {
    const selName = selection?.type === 'node' ? selection.name : null;
    const selPair = selection?.type === 'edge' ? selection.pairKey : null;
    const adjacentNames = new Set<string>();
    if (selName) {
      for (const edge of graph.edges) {
        if (edge.a === selName) adjacentNames.add(edge.b);
        if (edge.b === selName) adjacentNames.add(edge.a);
      }
    }
    for (const node of graph.nodes) {
      const el = nodeEls.get(node.name);
      if (!el) continue;
      const isAdj = adjacentNames.has(node.name);
      el.classList.toggle('is-selected', selName === node.name);
      el.classList.toggle('is-adjacent', isAdj);
      el.classList.toggle('is-dim', !!selName && node.name !== selName && !isAdj);
    }
    for (const edge of graph.edges) {
      const pairKey = pairKeyOf(edge.a, edge.b);
      const els = edgeEls.get(pairKey);
      if (!els) continue;
      const visible = edgeVisible(edge.category);
      const selected = selPair === pairKey;
      const adjacent = !!selName && (edge.a === selName || edge.b === selName);
      els.group.classList.toggle('is-filtered', !visible);
      els.group.classList.toggle('is-selected', selected);
      els.group.classList.toggle('is-adjacent', adjacent && !selected);
      els.group.classList.toggle('is-dim', (!!selName && !adjacent && !selected) || (!!filter && !visible && !selected));
      // 标签：选中边 / 选中节点的邻边 / 小图常显
      const showLabel = visible && (selected || adjacent || (!selName && graph.edges.length <= 8));
      els.label.classList.toggle('is-shown', showLabel);
      if (showLabel) positionEdgeLabel(els);
    }
  };

  const positionEdgeLabel = (els: { line: SVGPathElement; label: SVGGElement }): void => {
    // 二次贝塞尔中点 = 0.25P0 + 0.5C + 0.25P1
    const d = els.line.getAttribute('d') || '';
    const nums = d.match(/-?[\d.]+/g);
    if (!nums || nums.length < 6) return;
    const [x0, y0, cx, cy, x1, y1] = nums.map(Number);
    const mx = 0.25 * x0 + 0.5 * cx + 0.25 * x1;
    const my = 0.25 * y0 + 0.5 * cy + 0.25 * y1;
    els.label.setAttribute('transform', `translate(${mx.toFixed(1)},${(my - 6).toFixed(1)})`);
  };

  const updatePositionsAfterDrag = (name: string): void => {
    const el = nodeEls.get(name);
    const p = positions.get(name);
    if (el && p) el.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`);
    for (const edge of graph.edges) {
      if (edge.a !== name && edge.b !== name) continue;
      const els = edgeEls.get(pairKeyOf(edge.a, edge.b));
      if (!els) continue;
      const d = edgePath(edge.a, edge.b);
      els.line.setAttribute('d', d);
      els.hit.setAttribute('d', d);
      if (els.label.classList.contains('is-shown')) positionEdgeLabel(els);
    }
  };

  // ═══ 画布自由缩放/平移（模仿地图弹窗：滚轮缩放+空白拖拽平移+双指捏合+角落按钮） ═══
  const CR_MIN_SCALE = 0.5;
  const CR_MAX_SCALE = 4;
  const view = { scale: 1, x: 0, y: 0 };
  let panState: { lastX: number; lastY: number; moved: boolean } | null = null;
  let pinchDist = 0;
  let suppressNextClick = false;
  const activePointers = new Set<number>();

  const applyView = (): void => {
    if (svgEl) svgEl.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.scale})`;
  };
  const resetView = (): void => {
    view.scale = 1; view.x = 0; view.y = 0;
    applyView();
  };
  const zoomViewBy = (factor: number, originX: number, originY: number): void => {
    if (!svgEl) return;
    const oldScale = view.scale;
    const newScale = Math.max(CR_MIN_SCALE, Math.min(CR_MAX_SCALE, oldScale * factor));
    if (newScale === oldScale) return;
    // 围绕指定屏幕点缩放：调整平移使该点在缩放前后保持不动（与地图 zoomBy 同式，transform-origin 0 0）
    const rect = canvasRoot.getBoundingClientRect();
    const cx = originX - rect.left;
    const cy = originY - rect.top;
    const vx = (cx - view.x) / oldScale;
    const vy = (cy - view.y) / oldScale;
    view.scale = newScale;
    view.x = cx - vx * newScale;
    view.y = cy - vy * newScale;
    applyView();
  };

  canvasRoot.addEventListener('wheel', (event: WheelEvent) => {
    event.preventDefault();
    zoomViewBy(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX, event.clientY);
  }, { passive: false });

  // ═══ 拖拽（pointer events，桌面/触摸统一；节点=挪节点，空白=平移视角） ═══
  let dragName: string | null = null;
  let dragMoved = false;
  const toCanvasCoords = (clientX: number, clientY: number): RelationLayoutPosition => {
    const rect = svgEl?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((clientY - rect.top) / rect.height) * CANVAS_H,
    };
  };
  const onPointerDown = (event: PointerEvent): void => {
    suppressNextClick = false; // 新一轮按压开始，废弃上一次未被 click 消费的平移标记
    activePointers.add(event.pointerId);
    if (activePointers.size > 1) { // 进入捏合：取消单指手势
      dragName = null; dragMoved = false; panState = null;
      canvasRoot.classList.remove('is-panning');
      return;
    }
    const target = event.target as Element;
    if (target.closest?.('.cr-zoom-btn')) return;
    const name = target.closest?.('g.cr-node')?.getAttribute('data-cr-node') || null;
    try { (event.target as HTMLElement).setPointerCapture?.(event.pointerId); } catch { /* 老环境 */ }
    if (!name) {
      panState = { lastX: event.clientX, lastY: event.clientY, moved: false };
      canvasRoot.classList.add('is-panning');
      return;
    }
    dragName = name;
    dragMoved = false;
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (dragName) {
      const p = toCanvasCoords(event.clientX, event.clientY);
      const clamped = {
        x: Math.max(40, Math.min(CANVAS_W - 40, p.x)),
        y: Math.max(40, Math.min(CANVAS_H - 40, p.y)),
      };
      const prev = positions.get(dragName);
      if (prev && Math.abs(prev.x - clamped.x) < 0.5 && Math.abs(prev.y - clamped.y) < 0.5) return;
      positions.set(dragName, clamped);
      dragMoved = true;
      updatePositionsAfterDrag(dragName);
      return;
    }
    if (!panState || activePointers.size > 1) return;
    const dx = event.clientX - panState.lastX;
    const dy = event.clientY - panState.lastY;
    if (!panState.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    panState.lastX = event.clientX;
    panState.lastY = event.clientY;
    panState.moved = true;
    view.x += dx;
    view.y += dy;
    applyView();
  };
  const onPointerUp = (event: PointerEvent): void => {
    activePointers.delete(event.pointerId);
    try { (event.target as HTMLElement).releasePointerCapture?.(event.pointerId); } catch { /* ignore */ }
    if (dragName) {
      const wasDrag = dragMoved;
      const clickedName = dragName;
      dragName = null;
      dragMoved = false;
      if (!wasDrag && clickedName) selectNode(clickedName);
      return;
    }
    if (panState) {
      suppressNextClick = panState.moved; // 平移过的释放不再触发点选/取消选中
      panState = null;
      canvasRoot.classList.remove('is-panning');
    }
  };
  canvasRoot.addEventListener('pointerdown', onPointerDown);
  canvasRoot.addEventListener('pointermove', onPointerMove);
  canvasRoot.addEventListener('pointerup', onPointerUp);
  canvasRoot.addEventListener('pointercancel', () => {
    dragName = null; dragMoved = false; panState = null;
    activePointers.clear();
    canvasRoot.classList.remove('is-panning');
  });

  // 触摸双指捏合（单指走 pointer 平移路径；捏合期间单指手势已被 activePointers 守卫取消）
  canvasRoot.addEventListener('touchstart', (event: TouchEvent) => {
    if (event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      pinchDist = Math.hypot(dx, dy);
    }
  }, { passive: true });
  canvasRoot.addEventListener('touchmove', (event: TouchEvent) => {
    if (!pinchDist || event.touches.length !== 2) return;
    event.preventDefault();
    const dist = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
    if (dist > 0) {
      zoomViewBy(dist / pinchDist, (event.touches[0].clientX + event.touches[1].clientX) / 2, (event.touches[0].clientY + event.touches[1].clientY) / 2);
      pinchDist = dist;
    }
  }, { passive: false });
  canvasRoot.addEventListener('touchend', () => { pinchDist = 0; }, { passive: true });

  // 缩放按钮：buildSvg 重建画布时随 svg 一并重新挂载
  const zoomControls = document.createElement('div');
  zoomControls.className = 'cr-zoom-controls';
  zoomControls.innerHTML = `<button class="cr-zoom-btn" data-cr-zoom="in" type="button" title="放大">＋</button><button class="cr-zoom-btn" data-cr-zoom="out" type="button" title="缩小">－</button><button class="cr-zoom-btn" data-cr-zoom="reset" type="button" title="重置缩放">${ubIcon('expand')}</button>`;

  // ═══ 侧栏内容 ═══
  const rosterOrder = [protagonist?.name || '', ...roster.map(r => r.name)].filter(Boolean);
  const avatarHtml = (name: string): string => {
    const node = nodeByName.get(name);
    const hue = charHue(name);
    if (node?.portraitPath) return `<span class="cr-avatar" style="--hue:${hue}"><img src="${escapeHtmlAttr(node.portraitPath)}" alt=""></span>`;
    return `<span class="cr-avatar" style="--hue:${hue}">${escapeHtml(getInitials(name))}</span>`;
  };

  const relationCardHtml = (name: string, partner: string, relation: CharacterRelation, category: RelationCategory): string => {
    return `<button class="cr-rel-card cat-${catClass(category)}" data-cr-pair="${escapeHtmlAttr(pairKeyOf(name, partner))}" data-cr-from="${escapeHtmlAttr(name)}" type="button">${avatarHtml(partner)}<span class="cr-rel-copy"><b>${escapeHtml(partner)}</b><i class="cr-rel-type">${escapeHtml(relation.relationType || '关系')}</i>${relation.currentStatus ? `<small>${escapeHtml(relation.currentStatus)}</small>` : ''}</span><span class="cr-rel-arrow" aria-hidden="true">›</span></button>`;
  };

  const renderPanelOverview = (): void => {
    const legend = RELATION_CATEGORIES
      .map(cat => {
        const count = graph.stats.categoryCounts[cat] || 0;
        return count ? `<span class="cr-legend-item cat-${catClass(cat)}"><i></i>${cat} ×${count}</span>` : '';
      })
      .join('');
    replaceHtml(panelRoot, `<div class="cr-panel-view cr-overview"><span class="char-hub-section-kicker">全景</span>${legend ? `<div class="cr-legend">${legend}</div>` : ''}${duplicates.length ? `<p class="cr-dup-warn">检测到 ${duplicates.length} 对重复关系（A/B 顺序颠倒重插），已按首次登记去重显示。</p>` : ''}<p class="cr-hint">点击人物查看 TA 的全部关系<br>点击连线查看关系详情<br>拖拽节点可自定义布局<br>滚轮／＋－按钮缩放 · 拖空白处平移视角</p></div>`);
  };

  const renderPanelNode = (name: string): void => {
    const node = nodeByName.get(name);
    // 统一走 graph.edges（表内边 + 主角边），按名册顺序排对方
    const orderIdx = (n: string): number => {
      const i = rosterOrder.indexOf(n);
      return i < 0 ? 9999 : i;
    };
    const list = graph.edges
      .filter(edge => edge.a === name || edge.b === name)
      .map(edge => ({ edge, partner: edge.a === name ? edge.b : edge.a }))
      .sort((x, y) => orderIdx(x.partner) - orderIdx(y.partner));
    const cards = list.map(({ edge, partner }) => relationCardHtml(name, partner, edge.relation, edge.category)).join('');
    replaceHtml(panelRoot, `<div class="cr-panel-view cr-node-view"><header class="cr-node-head">${avatarHtml(name)}<div class="cr-node-head-copy"><b>${escapeHtml(name)}</b><small>${escapeHtml(kindLabel(node?.kind || 'unknown'))} · ${list.length} 段关系</small></div><button class="cr-hub-link" data-cr-open="${escapeHtmlAttr(name)}" type="button">查看档案</button></header>${cards || '<div class="panel-empty cr-empty-slim">还没有记录在案的关系</div>'}${node && node.briefIntro ? `<p class="cr-node-brief">${escapeHtml(node.briefIntro)}</p>` : ''}</div>`);
  };

  const renderPanelEdge = (pairKey: string, from: string | null): void => {
    const edge = edgeByPair.get(pairKey);
    if (!edge) { selection = null; renderPanelOverview(); return; }
    const r = edge.relation;
    const backBtn = from ? `<button class="cr-back" data-cr-node-back="${escapeHtmlAttr(from)}" type="button">← 返回${escapeHtml(from)}的关系</button>` : '<button class="cr-back" data-cr-clear type="button">← 返回全景</button>';
    const row = (label: string, value: string): string => value ? `<div class="cr-detail-row"><span>${escapeHtml(label)}</span><p>${escapeHtml(value)}</p></div>` : '';
    // 主角边：详情=态度段（来自角色表「对主角态度」列）；表内边：三字段
    const detailRows = edge.protagonistAttitude !== undefined
      ? row('对主角的态度', edge.protagonistAttitude)
      : row('相互看法', r.mutualView) + row('起因备注', r.originNote) + row('关系状态', r.currentStatus);
    replaceHtml(panelRoot, `<div class="cr-panel-view cr-edge-view">${backBtn}<div class="cr-edge-head">${avatarHtml(r.charA)}<span class="cr-edge-x" aria-hidden="true">×</span>${avatarHtml(r.charB)}</div><div class="cr-edge-names"><button data-cr-open="${escapeHtmlAttr(r.charA)}" type="button">${escapeHtml(r.charA)}</button><i>·</i><button data-cr-open="${escapeHtmlAttr(r.charB)}" type="button">${escapeHtml(r.charB)}</button></div><i class="cr-rel-type cr-edge-type cat-${catClass(edge.category)}">${escapeHtml(r.relationType || '关系')}</i><div class="cr-detail-rows">${detailRows}</div></div>`);
  };

  const renderPanel = (): void => {
    if (!selection) renderPanelOverview();
    else if (selection.type === 'node') renderPanelNode(selection.name);
    else renderPanelEdge(selection.pairKey, selection.from);
  };

  const selectNode = (name: string): void => {
    selection = { type: 'node', name };
    applyVisualState();
    renderPanel();
  };
  const selectEdge = (pairKey: string, from: string | null): void => {
    selection = { type: 'edge', pairKey, from };
    applyVisualState();
    renderPanel();
  };
  const clearSelection = (): void => {
    selection = null;
    applyVisualState();
    renderPanel();
  };

  // ═══ 事件（委托） ═══
  root.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    if (target.closest('#panelClose')) { if (!guardGhostClick()) closeGraph(); return; }
    const filterBtn = target.closest<HTMLElement>('[data-cr-filter]');
    if (filterBtn) {
      const value = filterBtn.dataset.crFilter || '';
      filter = value ? (value as RelationCategory) : null;
      renderToolbar();
      applyVisualState();
      return;
    }
    if (target.closest('[data-cr-reset]')) {
      filter = null;
      selection = null;
      resetView();
      layoutAll();
      buildSvg();
      renderToolbar();
      renderPanel();
      return;
    }
    const openBtn = target.closest<HTMLElement>('[data-cr-open]');
    if (openBtn) { handoffToHub(openBtn.dataset.crOpen || ''); return; }
    const backNode = target.closest<HTMLElement>('[data-cr-node-back]');
    if (backNode) { selectNode(backNode.dataset.crNodeBack || ''); return; }
    if (target.closest('[data-cr-clear]')) { clearSelection(); return; }
    const relCard = target.closest<HTMLElement>('[data-cr-pair]');
    if (relCard) {
      selectEdge(relCard.dataset.crPair || '', relCard.dataset.crFrom || null);
      return;
    }
    const zoomBtn = target.closest<HTMLElement>('[data-cr-zoom]');
    if (zoomBtn) {
      const rect = canvasRoot.getBoundingClientRect();
      if (zoomBtn.dataset.crZoom === 'in') zoomViewBy(1.3, rect.left + rect.width / 2, rect.top + rect.height / 2);
      else if (zoomBtn.dataset.crZoom === 'out') zoomViewBy(1 / 1.3, rect.left + rect.width / 2, rect.top + rect.height / 2);
      else resetView();
      return;
    }
    if (suppressNextClick) { suppressNextClick = false; return; } // 平移释放后的合成点击不触发选中
    const edgeHit = (target as Element).closest?.('g.cr-edge');
    if (edgeHit) {
      const pairKey = edgeHit.getAttribute('data-cr-edge') || '';
      if (edgeByPair.has(pairKey)) {
        selectEdge(pairKey, selection?.type === 'node' ? selection.name : null);
        return;
      }
    }
    // 点击画布空白处 → 取消选中
    if (target.closest('.cr-svg') && !target.closest('g.cr-node') && !target.closest('g.cr-edge')) clearSelection();
  });

  // ═══ 首次渲染 ═══
  renderToolbar();
  buildSvg();
  renderPanel();
  finishOpen();

  if (args.initialFocus && nodeByName.has(args.initialFocus)) selectNode(args.initialFocus);
}
