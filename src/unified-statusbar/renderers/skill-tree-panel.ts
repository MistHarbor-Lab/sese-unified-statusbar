import { getToastr } from '../core/env';
import { ubIcon } from '../core/icons';
import { bindPanZoom, panZoomBy, resetPanZoom, type PanZoomState } from './pan-zoom';
// renderers/skill-tree-panel.ts
// 天赋树 SVG 渲染（前端按 JSON）+ 节点详情 + 激活确认弹窗 + 缩放。镜像 map-panel.ts。
import { flashInlineHint } from './effects';
import { readSkillTree } from '../core/skill-store';
import { getNodeState, getLockReason, activateNode, previewNodeActivationCost, type NodeState } from '../core/skill-activation';
import { applyTreeEdit, previewTreeEditCost, validateTreeEdit } from '../core/skill-tree-edit';
import {
  regenerateSkillTree, resetAndRegenerateSkillTree, resetSkillActivations,
} from '../core/skill-tree-engine';
import { getCellByHeader, getSheetByName } from '../core/data-manager';
import {
  SKILL_TABLE_NAME, SKILL_COL, SKILL_TREE_GEN_COST, SKILL_RESET_REFUND_RATIO, SKILL_REGEN_REFUND_RATIO,
  type SkillTalentTree, type TalentNode,
} from '../core/skill-types';
import { escapeHtml as esc } from '../core/html-escape';
import { syncDarkClass, markPopupShown } from './html-builder';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 06 待修：同上（与 skill-popup 的双向入口）
import { showSkillPopup, showSkillExtraPromptDialog } from './skill-popup';
import { bindLongPress } from './long-press';

let _curStyle = 'ancient';
function markBridgeSkillPanel(overlay: HTMLElement, moduleClass: 'bridge-module-skill-tree' | 'bridge-module-skill-detail'): void {
  if (_curStyle !== 'bridge') return;
  overlay.querySelector('.panel-popup')?.classList.add('bridge-window', moduleClass);
}

// ── 缩放（U6：与地图面板共用 `renderers/pan-zoom.ts`——原先两处逐字节同形，现各传自己的参数） ──
// 本面板参数：缩放范围 0.6–3；忽略 `.sk-zoom-btn` / `.skill-node`（按钮与节点自身要能点）。
const SKILL_PAN_ZOOM_OPTS = {
  minScale: 0.6,
  maxScale: 3,
  ignoreSelector: '.sk-zoom-btn, .skill-node',
};
// document 级 mousemove/mouseup 不会随 DOM 替换回收，必须显式 abort；每次打开树视图重建一组监听。
let _zoomStop: (() => void) | null = null;

/** F4：停用当前缩放监听（返回技能列表/树间切换时调用——原先只在下一棵树 setup 时
 *  间接 abort，中途退出会残留一对 document mousemove/mouseup 空转到下一棵树才被清）。幂等。 */
function stopSkillTreeZoom(): void {
  if (_zoomStop) { _zoomStop(); _zoomStop = null; }
}

/** 绑定滚轮/拖动/双指缩放。返回本次的缩放状态（按钮用）。每次调用先停掉上一组 document 监听。 */
function setupSkillTreeZoom(container: HTMLElement, vp: HTMLElement): PanZoomState {
  stopSkillTreeZoom();
  const bound = bindPanZoom(container, vp, SKILL_PAN_ZOOM_OPTS);
  _zoomStop = bound.stop;
  return bound.state;
}
function findRow(skillName: string): number {
  const sh = getSheetByName(SKILL_TABLE_NAME);
  if (!sh || !Array.isArray(sh.content)) return 1;
  for (let i = 1; i < sh.content.length; i++) {
    if (getCellByHeader(SKILL_TABLE_NAME, i, SKILL_COL.name) === skillName) return i;
  }
  return 1;
}

/** 布局：base 底部居中，主线纵列上行，支线从挂靠主线节点侧伸（向外优先，多条支线交替扩散，避免重叠）。 */
function layoutTree(tree: SkillTalentTree): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  const W = 360, baseY = 410, colY0 = 330, dy = 78, center = W / 2;
  pos[tree.rootId] = { x: center, y: baseY };
  const lines = tree.mainLines;
  const n = lines.length || 1;
  lines.forEach((ml, li) => {
    const cx = (W * (li + 1)) / (n + 1);
    ml.nodeIds.forEach((id, ti) => { pos[id] = { x: cx, y: colY0 - ti * dy }; });
  });
  // 支线 tier-1 根：沿 parentId 上行到非 side 节点
  const sideRootOf = (nd: TalentNode): TalentNode => {
    let cur = nd;
    while (cur.parentId && tree.nodes[cur.parentId] && tree.nodes[cur.parentId].kind === 'side') {
      cur = tree.nodes[cur.parentId];
    }
    return cur;
  };
  // 按挂靠主线节点分组支线（每条支线 = 一个 tier-1 根）
  const sidesByMain = new Map<string, { root: TalentNode; nodes: TalentNode[] }[]>();
  for (const nd of Object.values(tree.nodes) as TalentNode[]) {
    if (nd.kind !== 'side') continue;
    const root = sideRootOf(nd);
    const mainId = root.parentId && tree.nodes[root.parentId] ? root.parentId : (nd.requires || root.parentId || '');
    if (!mainId) continue;
    if (!sidesByMain.has(mainId)) sidesByMain.set(mainId, []);
    let entry = sidesByMain.get(mainId)!.find((e) => e.root.id === root.id);
    if (!entry) { entry = { root, nodes: [] }; sidesByMain.get(mainId)!.push(entry); }
    entry.nodes.push(nd);
  }
  for (const [mainId, sls] of sidesByMain) {
    const mainPos = pos[mainId];
    if (!mainPos) continue;
    const mainX = mainPos.x;
    const ml = lines.find((m) => m.nodeIds.includes(mainId));
    const mainIdx = ml ? lines.indexOf(ml) : 0;
    const baseDir = mainX < center ? -1 : mainX > center ? +1 : (mainIdx % 2 === 0 ? -1 : +1);
    sls.forEach((sl, j) => {
      const dir = (j % 2 === 0) ? baseDir : -baseDir;
      const off = 64 + Math.floor(j / 2) * 64;
      const slotX = mainX + dir * off;
      for (const nd of sl.nodes) {
        pos[nd.id] = { x: slotX, y: mainPos.y - (nd.tier - 1) * 52 };
      }
    });
  }
  return pos;
}

/** 由节点位置计算 viewBox（含留白），确保所有节点完整可见、顶层不被截断。 */
// 属性/变量名勿用裸 h（unplugin-auto-import 误注入 import {h} from 'vue' → 全局 Vue 外部引用）
function boundsOf(pos: Record<string, { x: number; y: number }>): { x: number; y: number; w: number; height: number } {
  const xs = Object.values(pos).map((p) => p.x);
  const ys = Object.values(pos).map((p) => p.y);
  const padX = 36, padY = 26;
  const minX = Math.min(...xs) - padX, maxX = Math.max(...xs) + padX;
  const minY = Math.min(...ys) - padY, maxY = Math.max(...ys) + padY;
  return { x: minX, y: minY, w: maxX - minX, height: maxY - minY };
}

function shapeKind(): 'rect' | 'circle' | 'gem' | 'capsule' {
  const s = getComputedStyle(document.documentElement).getPropertyValue('--skill-shape').trim();
  if (s === 'circle' || s === 'gem' || s === 'capsule') return s;
  return 'rect';
}
function connKind(): 'ortho' | 'bezier' {
  return getComputedStyle(document.documentElement).getPropertyValue('--skill-conn').trim() === 'bezier' ? 'bezier' : 'ortho';
}
function stateClass(st: NodeState): string {
  return st === 'activated' ? 'sk-n-act' : st === 'activatable' ? 'sk-n-can' : 'sk-n-lock';
}
function fillSpec(st: NodeState): string {
  if (st === 'activated') return `fill="var(--skill-act-bg)" stroke="var(--skill-gold)"`;
  if (st === 'activatable') return `fill="color-mix(in srgb,var(--skill-accent) 20%,var(--skill-bg2))" stroke="var(--skill-accent)" stroke-dasharray="3 2"`;
  return `fill="color-mix(in srgb,var(--skill-edge) 45%,var(--skill-lock))" stroke="var(--skill-edge)"`;
}

function buildNodeSvg(n: TalentNode, p: { x: number; y: number }, st: NodeState, next = false): string {
  const sh = shapeKind();
  const cls = stateClass(st) + (next && st === 'activatable' ? ' sk-n-next' : '');
  const label = esc(n.title || n.id);
  if (sh === 'circle') {
    const r = n.kind === 'base' ? 16 : 13;
    return `<g class="skill-node ${cls}" data-id="${esc(n.id)}"><circle cx="${p.x}" cy="${p.y}" r="${r}" ${fillSpec(st)} stroke-width="1.3"/><text x="${p.x}" y="${p.y + 3}" text-anchor="middle" font-size="9">${label}</text></g>`;
  }
  if (sh === 'gem') {
    const s = n.kind === 'base' ? 16 : 13;
    const pts = `${p.x},${p.y - s} ${p.x + s},${p.y} ${p.x},${p.y + s} ${p.x - s},${p.y}`;
    return `<g class="skill-node ${cls}" data-id="${esc(n.id)}"><polygon points="${pts}" ${fillSpec(st)} stroke-width="1.3"/><text x="${p.x}" y="${p.y + 3}" text-anchor="middle" font-size="9">${label}</text></g>`;
  }
  const w = 56, nh = 24, rx = sh === 'capsule' ? 12 : 5;
  return `<g class="skill-node ${cls}" data-id="${esc(n.id)}"><rect x="${p.x - w / 2}" y="${p.y - nh / 2}" width="${w}" height="${nh}" rx="${rx}" ${fillSpec(st)} stroke-width="1.3"/><text x="${p.x}" y="${p.y + 3}" text-anchor="middle" font-size="9">${label}</text></g>`;
}

function buildEdgesSvg(tree: SkillTalentTree, pos: Record<string, { x: number; y: number }>): string {
  const out: string[] = [];
  const conn = connKind();
  for (const n of Object.values(tree.nodes) as TalentNode[]) {
    if (!n.parentId) continue;
    const a = pos[n.parentId], b = pos[n.id];
    if (!a || !b) continue;
    const parentAct = tree.activated.includes(n.parentId);
    const stroke = parentAct ? 'var(--skill-accent)' : 'var(--skill-edge)';
    const d = conn === 'bezier'
      ? `M${a.x},${a.y} Q${(a.x + b.x) / 2},${(a.y + b.y) / 2} ${b.x},${b.y}`
      : `M${a.x},${a.y} L${b.x},${b.y}`;
    out.push(`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.4" opacity="0.85"/>`);
  }
  return out.join('');
}

/** 打开某技能天赋树视图（无树则占位+生成入口）。关闭→返回技能列表，不退出主界面。
 *  highlightNext：激活成功回树时高亮第一个可激活节点（sk-n-next 光晕）。 */
export function showSkillTreePopup(skillName: string, style: string, highlightNext = false): void {
  _curStyle = style;
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  const tree = readSkillTree(skillName);
  if (!tree) {
    overlay.innerHTML = `<div class="panel-popup"><div class="panel-popup-head"><div class="panel-popup-title">${ubIcon('sprout')} ${esc(skillName)} 天赋树</div><span style="flex:1"></span><button class="panel-popup-close" id="panelClose">×</button></div><div class="panel-popup-body"><div style="text-align:center;padding:30px 10px;color:var(--text-muted,#888)">尚未生成天赋树<div style="margin-top:12px"><button class="sk-act-btn" id="skGenOne">生成天赋树</button></div><div style="margin-top:8px;font-size:var(--ub-ui-font-11,11px)">生成消耗 ${SKILL_TREE_GEN_COST} 经验值（不足可用瑟瑟能量按 1:5 补足）</div></div></div></div>`;
    markBridgeSkillPanel(overlay, 'bridge-module-skill-tree');
    syncDarkClass(overlay); markPopupShown(); overlay.classList.add('show');
    overlay.onclick = (e: MouseEvent) => {
      if (e.target === overlay || (e.target as HTMLElement).id === 'panelClose') { stopSkillTreeZoom(); showSkillPopup(_curStyle); return; }
    };
    // 「生成天赋树」按钮：短按=生成（扣 10 经验）；长按=弹额外要求框再生成（镜像大调查）
    const genOneBtn = overlay.querySelector('#skGenOne') as HTMLElement | null;
    if (genOneBtn) {
      const doGen = (extraReq?: string): void => {
        const btn = document.getElementById('skGenOne') as HTMLButtonElement | null;
        const origText = btn?.textContent ?? '';
        if (btn) { btn.disabled = true; btn.textContent = '生成中…'; }
        let _notFoundHandled = false;
        void regenerateSkillTree(skillName, extraReq, true, (msg) => {
          _notFoundHandled = true;
          if (btn) { btn.disabled = false; btn.textContent = origText; flashInlineHint(btn, msg); }
        }).then((ok) => {
          if (ok) showSkillTreePopup(skillName, _curStyle);
          else if (!_notFoundHandled && btn) { btn.disabled = false; btn.textContent = origText; }
        });
      };
      bindLongPress(genOneBtn, {
        onShort: () => doGen(),
        onLong: () => showSkillExtraPromptDialog(`生成「${skillName}」天赋树 · 额外要求`, (extraReq) => doGen(extraReq)),
      });
    }
    return;
  }
  const pos = layoutTree(tree);
  const vb = boundsOf(pos);
  const nextId = highlightNext
    ? ((Object.values(tree.nodes) as TalentNode[]).find((n) => getNodeState(tree, n.id) === 'activatable')?.id ?? null)
    : null;
  const nodesSvg = (Object.values(tree.nodes) as TalentNode[]).map((n) => buildNodeSvg(n, pos[n.id], getNodeState(tree, n.id), n.id === nextId)).join('');
  const themesSvg = tree.mainLines.map((line, index) => {
    const first = pos[line.nodeIds[0]];
    return first ? `<text class="skill-main-line-theme" x="${first.x}" y="${first.y + 35}" text-anchor="middle">${esc(line.name || `主线 ${index + 1}`)}</text>` : '';
  }).join('');
  const edgesSvg = buildEdgesSvg(tree, pos);
  // F29 变体 A：AI 风味标签挂签——树头标题右侧一枚小签，取技能自身主题色（--skill-accent）；
  // 旧树/未输出 style ⇒ 空串（不占位、不升头栏，零视觉变化）。
  const flavorTag = tree.style ? `<em class="sk-flavor" title="技能气质（生成时随树存档）">${esc(tree.style)}</em>` : '';
  overlay.innerHTML = `<div class="panel-popup skill-tree-popup ub-popup--xl"><div class="panel-popup-head"><div class="panel-popup-title">${ubIcon('sprout')} ${esc(skillName)} 天赋树${flavorTag}</div><span style="flex:1"></span><button class="sk-btn" id="skEditTree" title="编辑天赋树">${ubIcon('pencil')}</button>${tree.activated.some((id) => id !== tree.rootId) ? '<button class="sk-btn" id="skResetAct" title="重置当前技能（取消激活，返还 75% 经验）">' + ubIcon('undo') + '</button>' : ''}<button class="sk-btn" id="skRegenTree" title="重新生成天赋树（退还经验）">${ubIcon('refresh')}</button><button class="panel-popup-close" id="panelClose">×</button></div><div class="panel-popup-body"><div class="skill-tree-container"><div class="skill-tree-viewport" id="skTreeViewport"><svg class="skill-tree-svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.height}" preserveAspectRatio="xMidYMid meet">${edgesSvg}${themesSvg}${nodesSvg}</svg></div><div class="skill-tree-zoom-controls"><button class="sk-btn sk-zoom-btn" id="skZoomIn" title="放大" type="button">＋</button><button class="sk-btn sk-zoom-btn" id="skZoomOut" title="缩小" type="button">－</button><button class="sk-btn sk-zoom-btn" id="skZoomReset" title="重置缩放" type="button">⟳</button></div></div><div class="sk-legend"><span><i style="background:var(--skill-accent)"></i>已激活</span><span><i style="background:color-mix(in srgb,var(--skill-accent) 20%,var(--skill-bg2));border:1.2px dashed var(--skill-accent)"></i>可激活</span><span><i style="background:color-mix(in srgb,var(--skill-edge) 45%,var(--skill-lock))"></i>锁定</span></div></div></div>`;
  markBridgeSkillPanel(overlay, 'bridge-module-skill-tree');
  if (tree.accentColor) {
    const popup = overlay.querySelector('.panel-popup') as HTMLElement | null;
    popup?.style.setProperty('--skill-accent', tree.accentColor);
  }
  syncDarkClass(overlay); markPopupShown(); overlay.classList.add('show');

  const container = overlay.querySelector('.skill-tree-container') as HTMLElement | null;
  const vp = overlay.querySelector('#skTreeViewport') as HTMLElement | null;
  if (container && vp) {
    const s = setupSkillTreeZoom(container, vp);
    const center = () => {
      const r = container.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const bindZoom = (id: string, fn: () => void) => {
      const b = overlay.querySelector(id) as HTMLButtonElement | null;
      b?.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    };
    bindZoom('#skZoomIn', () => { const c = center(); panZoomBy(s, 1.25, c.x, c.y, vp, container); });
    bindZoom('#skZoomOut', () => { const c = center(); panZoomBy(s, 1 / 1.25, c.x, c.y, vp, container); });
    bindZoom('#skZoomReset', () => resetPanZoom(s, vp));
  }

  overlay.onclick = (e: MouseEvent) => {
    const id = (e.target as HTMLElement).id;
    if (e.target === overlay || id === 'panelClose') { stopSkillTreeZoom(); showSkillPopup(_curStyle); return; }
    const g = (e.target as HTMLElement).closest('.skill-node') as HTMLElement | null;
    if (g) { const nid = g.getAttribute('data-id'); if (nid) showNodeDetail(skillName, nid); }
  };
  // 「↻ 重新生成」按钮：短按=重置确认（退还经验）；长按=额外要求框 → 仍走重置确认（不可逆操作双重确认）
  const regenBtn = overlay.querySelector('#skRegenTree') as HTMLElement | null;
  if (regenBtn) {
    bindLongPress(regenBtn, {
      onShort: () => showSkillRegenConfirm(skillName),
      onLong: () => showSkillExtraPromptDialog(`重新生成「${skillName}」天赋树 · 额外要求`, (extraReq) => showSkillRegenConfirm(skillName, extraReq)),
    });
  }
  // 「↺ 重置当前技能」按钮：短按=重置确认（返还 75% 经验，保留树结构）；重置不接额外要求故仅短按
  const resetActBtn = overlay.querySelector('#skResetAct') as HTMLElement | null;
  if (resetActBtn) {
    resetActBtn.addEventListener('click', (e) => { e.stopPropagation(); showSkillResetConfirm(skillName); });
  }
  const editTreeBtn = overlay.querySelector('#skEditTree') as HTMLElement | null;
  if (editTreeBtn) editTreeBtn.addEventListener('click', () => showSkillTreeEditMenu(skillName));
}

function showSkillTreeEditMenu(skillName: string): void {
  const tree = readSkillTree(skillName);
  const overlay = document.getElementById('panelOverlay');
  if (!tree || !overlay) return;
  const cost = previewTreeEditCost(tree);
  overlay.innerHTML = `<div class="panel-popup"><div class="panel-popup-head"><div class="panel-popup-title">编辑天赋树</div><span style="flex:1"></span><button class="panel-popup-close" id="panelClose">×</button></div><div class="panel-popup-body"><div class="sk-edit-summary">已累计 ${tree.editOperationCount} 次操作；本次成功操作消耗 ${cost} 经验。</div><div class="sk-edit-actions"><button class="sk-act-btn" id="skAddNode">＋ 添加节点</button></div><div class="sk-edit-node-list">${Object.values(tree.nodes).filter((n) => n.kind !== 'base').map((n) => `<button class="sk-btn" data-edit-node="${esc(n.id)}">${esc(n.title)}</button>`).join(' ')}</div></div></div>`;
  syncDarkClass(overlay); markPopupShown(); overlay.classList.add('show');
  overlay.onclick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.id === 'panelClose' || e.target === overlay) return showSkillTreePopup(skillName, _curStyle);
    const nodeId = target.getAttribute('data-edit-node');
    if (nodeId) return showSkillTreeNodeEditor(skillName, nodeId);
    if (target.id === 'skAddNode') return showSkillTreeAddNodeForm(skillName);
  };
}

/** 支线挂靠候选：所选主线的全部主线节点。 */
function anchorCandidatesOf(tree: SkillTalentTree, lineId: string): TalentNode[] {
  const line = tree.mainLines.find((item) => item.id === lineId);
  if (!line) return [];
  return line.nodeIds.map((id) => tree.nodes[id]).filter(Boolean);
}

/** 支线前置合法候选：挂靠节点本身 + 其支线链上的 side 节点（requires===anchorId）。 */
function parentCandidatesOf(tree: SkillTalentTree, lineId: string, anchorId: string): TalentNode[] {
  const out: TalentNode[] = [];
  const anchor = tree.nodes[anchorId];
  if (anchor) out.push(anchor);
  for (const n of Object.values(tree.nodes) as TalentNode[]) {
    if (n.kind === 'side' && n.lineId === lineId && n.requires === anchorId) out.push(n);
  }
  return out;
}

function nodeOption(n: TalentNode, mode: 'anchor' | 'parent'): string {
  const label = mode === 'parent'
    ? (n.kind === 'side' ? `· 支线：${esc(n.title)}` : `${esc(n.title)}（挂靠节点）`)
    : `${esc(n.title)}（tier ${n.tier}）`;
  return `<option value="${esc(n.id)}">${label}</option>`;
}

const ADD_FORM_SUMMARY = (tree: SkillTalentTree, cost: number): string =>
  `<div class="sk-edit-summary">已累计 ${tree.editOperationCount} 次操作 · 本次成功操作消耗 <b style="color:var(--skill-accent)">${cost}</b> 经验</div>`;

/** 添加节点表单：分段按钮切换主线/支线，主线/挂靠/前置全部下拉选择，单表单一次提交。 */
function showSkillTreeAddNodeForm(skillName: string): void {
  const tree = readSkillTree(skillName);
  const overlay = document.getElementById('panelOverlay');
  if (!tree || !overlay) return;
  const cost = previewTreeEditCost(tree);
  const lineOptions = tree.mainLines.map((line) => `<option value="${esc(line.id)}">${esc(line.name || line.id)}</option>`).join('');
  overlay.innerHTML = `<div class="panel-popup"><div class="panel-popup-head"><div class="panel-popup-title">${ubIcon('sprout')} 添加节点</div><span style="flex:1"></span><button class="panel-popup-close" id="panelClose">×</button></div><div class="panel-popup-body">${ADD_FORM_SUMMARY(tree, cost)}<div class="sk-edit-form"><div class="sk-seg" id="skAddKindSeg"><button type="button" data-kind="main" class="seg-active">追加主线</button><button type="button" data-kind="side">添加支线</button></div><label id="skAddLineField"><span>所属主线</span><select id="skAddLine">${lineOptions}</select><div class="sk-field-hint" id="skLineHint">新节点将追加到所选主线的最顶层</div></label><label id="skAnchorField" style="display:none"><span>挂靠主线节点</span><select id="skAnchorSel"></select><div class="sk-field-hint">支线将从此节点向外延伸</div></label><label id="skParentField" style="display:none"><span>直接前置</span><select id="skParentSel"></select><div class="sk-field-hint">只能是挂靠节点本身或其支线链上的节点（随上方选择联动）</div></label><label><span>节点标题</span><input id="skNodeTitle" placeholder="如：剑意化虹"></label><label><span>完整效果描述</span><textarea id="skNodeDesc" placeholder="描述该节点激活后的具体效果…"></textarea></label><label><span>经验消耗</span><input id="skNodeCost" type="number" min="0" value="0"></label></div><div class="sk-form-actions"><button class="sk-act-btn ghost" id="skAddCancel">取消</button><button class="sk-act-btn" id="skAddSubmit">确认添加（${cost} 经验）</button></div></div></div>`;
  syncDarkClass(overlay); markPopupShown(); overlay.classList.add('show');

  let kind: 'main' | 'side' = 'main';
  const lineSel = overlay.querySelector('#skAddLine') as HTMLSelectElement;
  const anchorSel = overlay.querySelector('#skAnchorSel') as HTMLSelectElement;
  const parentSel = overlay.querySelector('#skParentSel') as HTMLSelectElement;
  const anchorField = overlay.querySelector('#skAnchorField') as HTMLElement;
  const parentField = overlay.querySelector('#skParentField') as HTMLElement;
  const lineHint = overlay.querySelector('#skLineHint') as HTMLElement;

  const refreshSideSelects = (): void => {
    const lineId = lineSel.value;
    const anchors = anchorCandidatesOf(tree, lineId);
    anchorSel.innerHTML = anchors.map((n) => nodeOption(n, 'anchor')).join('');
    refreshParentOptions();
  };
  const refreshParentOptions = (): void => {
    const candidates = parentCandidatesOf(tree, lineSel.value, anchorSel.value);
    parentSel.innerHTML = candidates.map((n) => nodeOption(n, 'parent')).join('');
  };
  const syncKindFields = (): void => {
    const side = kind === 'side';
    anchorField.style.display = side ? '' : 'none';
    parentField.style.display = side ? '' : 'none';
    lineHint.textContent = side ? '支线将挂靠到所选主线的某个节点上' : '新节点将追加到所选主线的最顶层';
    if (side) refreshSideSelects();
  };

  overlay.querySelector('#skAddKindSeg')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button[data-kind]') as HTMLElement | null;
    if (!btn) return;
    kind = btn.getAttribute('data-kind') as 'main' | 'side';
    for (const b of Array.from(overlay.querySelectorAll('#skAddKindSeg button'))) b.classList.toggle('seg-active', b === btn);
    syncKindFields();
  });
  lineSel.addEventListener('change', () => { if (kind === 'side') refreshSideSelects(); });
  anchorSel.addEventListener('change', refreshParentOptions);

  const closeBack = (): void => showSkillTreeEditMenu(skillName);
  overlay.onclick = (e: MouseEvent) => {
    const id = (e.target as HTMLElement).id;
    if (id === 'panelClose' || e.target === overlay || id === 'skAddCancel') closeBack();
  };
  overlay.querySelector('#skAddSubmit')!.addEventListener('click', () => {
    const title = (overlay.querySelector('#skNodeTitle') as HTMLInputElement).value;
    const desc = (overlay.querySelector('#skNodeDesc') as HTMLTextAreaElement).value;
    const costVal = Number((overlay.querySelector('#skNodeCost') as HTMLInputElement).value);
    let command: any;
    if (kind === 'main') command = { kind: 'appendMain', lineId: lineSel.value, title, desc, cost: costVal };
    else command = { kind: 'appendSide', lineId: lineSel.value, requires: anchorSel.value, parentId: parentSel.value, title, desc, cost: costVal };
    const check = validateTreeEdit(tree, command);
    if (!check.ok) return getToastr()?.warning(check.reason, '天赋树');
    void applyTreeEdit(skillName, command).then((result) => {
      if (!result.ok) return getToastr()?.warning(result.reason || '添加失败', '天赋树');
      if (result.syncWarning) getToastr()?.warning('节点已保存，技能世界书同步失败，将在后续同步时重试', '天赋树');
      showSkillTreePopup(skillName, _curStyle);
    });
  });
}

function showSkillTreeNodeEditor(skillName: string, nodeId: string): void {
  const tree = readSkillTree(skillName); const node = tree?.nodes[nodeId];
  if (!tree || !node) return showSkillTreeEditMenu(skillName);
  const overlay = document.getElementById('panelOverlay'); if (!overlay) return;
  const frozen = tree.activated.includes(nodeId);
  const isSide = node.kind === 'side';
  // 未激活支线可下拉改挂靠/前置；候选限定同主线（update 命令不支持跨主线迁移）
  const anchorOpts = isSide && !frozen
    ? anchorCandidatesOf(tree, node.lineId).map((n) => `<option value="${esc(n.id)}" ${n.id === node.requires ? 'selected' : ''}>${esc(n.title)}（tier ${n.tier}）</option>`).join('')
    : '';
  overlay.innerHTML = `<div class="panel-popup"><div class="panel-popup-head"><div class="panel-popup-title">${ubIcon('pencil')} 编辑节点 · ${esc(node.title)}</div><span style="flex:1"></span><button class="panel-popup-close" id="panelClose">×</button></div><div class="panel-popup-body"><div class="sk-edit-form"><label><span>节点标题</span><input id="skNodeTitle" value="${esc(node.title)}"></label><label><span>完整效果描述</span><textarea id="skNodeDesc">${esc(node.desc)}</textarea></label>${frozen ? '<div class="sk-field-hint">已激活节点的费用和前置关系已冻结，仅可修改标题和效果描述。</div>' : `${isSide ? '' : '<label><span>经验消耗</span><input id="skNodeCost" type="number" min="0" value="' + node.cost + '"></label>'}${isSide && !frozen ? `<label><span>经验消耗</span><input id="skNodeCost" type="number" min="0" value="${node.cost}"></label><label><span>挂靠主线节点</span><select id="skAnchorSel">${anchorOpts}</select></label><label><span>直接前置</span><select id="skParentSel"></select><div class="sk-field-hint">改动挂靠/前置会重排支线位置</div></label>` : isSide ? `<label><span>经验消耗</span><input id="skNodeCost" type="number" min="0" value="${node.cost}"></label>` : ''}`}<div class="sk-form-actions"><button class="sk-act-btn ghost" id="skDeleteNode">删除节点</button><button class="sk-act-btn" id="skEditNode">保存（${previewTreeEditCost(tree)} 经验）</button></div></div></div></div>`;
  syncDarkClass(overlay); markPopupShown(); overlay.classList.add('show');

  const anchorSel = overlay.querySelector('#skAnchorSel') as HTMLSelectElement | null;
  const parentSel = overlay.querySelector('#skParentSel') as HTMLSelectElement | null;
  const refreshParentOptions = (selected?: string): void => {
    if (!anchorSel || !parentSel) return;
    const candidates = parentCandidatesOf(tree, node.lineId, anchorSel.value);
    parentSel.innerHTML = candidates.map((n) => {
      const sel = selected !== undefined ? n.id === selected : n.id === node.parentId;
      return `<option value="${esc(n.id)}" ${sel ? 'selected' : ''}>${n.kind === 'side' ? `· 支线：${esc(n.title)}` : `${esc(n.title)}（挂靠节点）`}</option>`;
    }).join('');
  };
  if (isSide && !frozen) {
    refreshParentOptions();
    anchorSel!.addEventListener('change', () => refreshParentOptions());
  }

  overlay.onclick = (e: MouseEvent) => {
    const id = (e.target as HTMLElement).id;
    if (id === 'panelClose' || e.target === overlay) return showSkillTreeEditMenu(skillName);
    if (id === 'skDeleteNode') {
      const check = validateTreeEdit(tree, { kind: 'delete', nodeId });
      if (!check.ok) return getToastr()?.warning(check.reason, '天赋树');
      void applyTreeEdit(skillName, { kind: 'delete', nodeId }).then((r) => r.ok ? showSkillTreePopup(skillName, _curStyle) : getToastr()?.warning(r.reason || '删除失败', '天赋树'));
    }
    if (id === 'skEditNode') {
      const title = (overlay.querySelector('#skNodeTitle') as HTMLInputElement).value;
      const desc = (overlay.querySelector('#skNodeDesc') as HTMLTextAreaElement).value;
      const costInput = overlay.querySelector('#skNodeCost') as HTMLInputElement | null;
      const command: any = { kind: 'update', nodeId, title, desc };
      if (costInput) command.cost = Number(costInput.value);
      if (anchorSel && parentSel) { command.requires = anchorSel.value; command.parentId = parentSel.value; }
      const check = validateTreeEdit(tree, command);
      if (!check.ok) return getToastr()?.warning(check.reason, '天赋树');
      void applyTreeEdit(skillName, command).then((r) => r.ok ? showSkillTreePopup(skillName, _curStyle) : getToastr()?.warning(r.reason || '保存失败', '天赋树'));
    }
  };
}

/** 节点详情浮层（含 激活 按钮 / 已激活 / 锁定原因）。关闭→返回天赋树，不退出主界面。 */
function showNodeDetail(skillName: string, nodeId: string): void {
  const tree = readSkillTree(skillName); if (!tree) return;
  const n = tree.nodes[nodeId]; if (!n) return;
  const st = getNodeState(tree, nodeId);
  const costPreview = previewNodeActivationCost(skillName, tree, nodeId, findRow(skillName));
  const { cost: activationCost, curExp, curSerse, needExp, needSerse, affordable: serseEnough } = costPreview;
  const overlay = document.getElementById('panelOverlay')!;
  const kindLabel = n.kind === 'main' ? '主线' : n.kind === 'side' ? '支线' : '基础';
  const prereq = n.parentId ? tree.nodes[n.parentId]?.title : '';
  let actionBlock: string;
  if (st === 'activatable') {
    actionBlock = `<div style="text-align:center;margin-top:8px"><button class="sk-act-btn" id="skActivate">激　活</button></div>`;
  } else if (st === 'activated') {
    actionBlock = `<div class="sk-d-state activated">● 已激活</div>`;
  } else {
    actionBlock = `<div class="sk-d-state lock">${ubIcon('lock')} ${esc(getLockReason(tree, nodeId))}</div>`;
  }
  const warn = st === 'activatable'
    ? `<div class="sk-d-warn">${ubIcon('warning')} 消耗 <b>${activationCost}</b> 经验${needExp > 0 ? `（不足 ${needExp}，另耗 ${needSerse} 瑟瑟能量${serseEnough ? '' : '·不足'}）` : '（充足）'}；${tree.chosenMainLine && n.lineId !== tree.chosenMainLine ? '该副修主线及其支线按 3 倍经验计算；' : ''}不可逆，技能描述将升级。</div>`
    : '';
  overlay.innerHTML = `<div class="panel-popup"><div class="panel-popup-head"><div class="panel-popup-title">${esc(n.title)}</div><span style="flex:1"></span><button class="panel-popup-close" id="panelClose">×</button></div><div class="panel-popup-body"><div class="sk-detail"><div class="bd"><div class="sk-d-title">${esc(n.title)} <span class="sk-badge active">${kindLabel}</span><span class="sk-badge passive">第 <b class="num">${n.tier}</b> 层</span></div>${prereq ? `<div class="sk-d-line">前置：${esc(prereq)}<span class="sk-d-pre ${tree.activated.includes(n.parentId!) ? 'on' : 'off'}">${tree.activated.includes(n.parentId!) ? '已激活' : '未激活'}</span></div>` : ''}<div class="sk-d-desc">${esc(n.desc)}</div><div class="sk-d-stat"><span>消耗：经验 <b style="color:var(--skill-accent)">${activationCost}</b>${activationCost !== n.cost ? `（基础 ${n.cost} × 3）` : ''}</span><span class="sk-have" title="当前经验 / 瑟瑟能量">${ubIcon('book')}<b class="num">${curExp}</b>${ubIcon('bolt')}<b class="num">${curSerse}</b></span></div>${warn}${actionBlock}</div></div></div></div>`;
  markBridgeSkillPanel(overlay, 'bridge-module-skill-detail');
  syncDarkClass(overlay); markPopupShown(); overlay.classList.add('show');
  overlay.onclick = (e: MouseEvent) => {
    if (e.target === overlay || (e.target as HTMLElement).id === 'panelClose') { showSkillTreePopup(skillName, _curStyle); return; }
    if ((e.target as HTMLElement).closest('#skActivate')) {
      // 两步行内确认（对齐日历原位确认模式）：首点原位变「确认激活？」2.5s 未点自动复原，再点执行
      const btn = overlay.querySelector<HTMLButtonElement>('#skActivate');
      if (!btn || btn.dataset.busy === '1') return;
      if (btn.dataset.armed !== '1') {
        if (!serseEnough) { getToastr()?.warning('瑟瑟能量不足，无法激活', '天赋树'); return; }
        btn.dataset.armed = '1';
        btn.textContent = '确认激活？';
        window.setTimeout(() => {
          if (btn.isConnected && btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.textContent = '激　活'; }
        }, 2500);
        return;
      }
      btn.dataset.busy = '1';
      btn.disabled = true;
      btn.textContent = '激活中…';
      void activateNode(skillName, nodeId).then((r) => {
        if (r.ok) {
          getToastr()?.success(`已激活「${n.title}」${r.costExp ? `，扣 ${r.costExp} 经验` : ''}${r.costSerse ? ` -${r.costSerse} 瑟瑟能量` : ''}`, '天赋树');
          showSkillTreePopup(skillName, _curStyle, true);
        } else {
          getToastr()?.warning(r.reason || '激活失败', '天赋树');
          showNodeDetail(skillName, nodeId);
        }
      });
    }
  };
}

/** 重新生成天赋树确认：退还已消耗经验的 50%（1:5 折算下等值）+ 恢复初始描述 + 重生（不另收生成费）。
 *  取消/关闭→返回天赋树。 */
function showSkillRegenConfirm(skillName: string, extraReq?: string): void {
  const tree = readSkillTree(skillName);
  let consumed = 0;
  if (tree) for (const id of tree.activated) if (id !== tree.rootId) consumed += Number(tree.nodes[id]?.cost || 0);
  const refund = Math.round(consumed * SKILL_REGEN_REFUND_RATIO);
  const pct = Math.round(SKILL_REGEN_REFUND_RATIO * 100);
  const extra = extraReq && extraReq.trim();
  const extraLine = extra
    ? `<div class="sk-d-line" style="color:var(--skill-accent);margin-top:4px">· 本次附带额外要求：${esc(extra.length > 60 ? extra.slice(0, 60) + '…' : extra)}</div>`
    : '';
  const overlay = document.getElementById('panelOverlay')!;
  overlay.innerHTML = `<div class="panel-popup"><div class="panel-popup-head"><div class="panel-popup-title">重新生成 · ${esc(skillName)}</div><span style="flex:1"></span><button class="panel-popup-close" id="panelClose">×</button></div><div class="panel-popup-body"><div class="sk-confirm"><div class="bd"><div class="sk-d-desc">将重置该技能天赋树为初始状态并重新生成（旧树作废）。</div>${extraLine}<div class="sk-d-stat"><span>已消耗经验：<b class="num">${consumed}</b></span><span>退还：<b style="color:var(--skill-accent)">+${refund}</b> 到该技能（${pct}%）</span></div><div class="sk-d-warn">${ubIcon('warning')} 退还已消耗经验的 ${pct}%（共 ${refund}，1:5 折算下等值），恢复技能描述为初始形态后重新生成天赋树。重新生成不另收生成费。操作不可撤销。</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px"><button class="sk-act-btn ghost" id="skRegenCancel">取　消</button><button class="sk-act-btn" id="skRegenOk">确认重新生成</button></div></div></div></div></div>`;
  markBridgeSkillPanel(overlay, 'bridge-module-skill-detail');
  syncDarkClass(overlay); markPopupShown(); overlay.classList.add('show');
  overlay.onclick = async (e: MouseEvent) => {
    const id = (e.target as HTMLElement).id;
    if (id === 'skRegenOk') {
      const btn = document.getElementById('skRegenOk') as HTMLButtonElement | null;
      if (btn) { btn.disabled = true; btn.textContent = '生成中…'; }
      const ok = await resetAndRegenerateSkillTree(skillName, extraReq);
      if (ok) { getToastr()?.success(`已重新生成「${skillName}」天赋树` + (refund ? `，退还 ${refund} 经验` : ''), '天赋树'); showSkillTreePopup(skillName, _curStyle); }
      else { getToastr()?.warning('重新生成失败', '天赋树'); showSkillTreePopup(skillName, _curStyle); }
      return;
    }
    if (id === 'skRegenCancel' || id === 'panelClose' || e.target === overlay) { showSkillTreePopup(skillName, _curStyle); return; }
  };
}

/** 重置当前技能确认：取消所有已激活节点（含主线选择），<b>保留天赋树结构</b>，返还已消耗经验的 75%。 */
function showSkillResetConfirm(skillName: string): void {
  const tree = readSkillTree(skillName);
  if (!tree) { showSkillTreePopup(skillName, _curStyle); return; }
  let consumed = 0;
  for (const id of tree.activated) if (id !== tree.rootId) consumed += Number(tree.nodes[id]?.cost || 0);
  const refund = Math.round(consumed * SKILL_RESET_REFUND_RATIO);
  const pct = Math.round(SKILL_RESET_REFUND_RATIO * 100);
  const overlay = document.getElementById('panelOverlay')!;
  overlay.innerHTML = `<div class="panel-popup"><div class="panel-popup-head"><div class="panel-popup-title">重置当前技能 · ${esc(skillName)}</div><span style="flex:1"></span><button class="panel-popup-close" id="panelClose">×</button></div><div class="panel-popup-body"><div class="sk-confirm"><div class="bd"><div class="sk-d-desc">将取消该技能所有已激活节点（含主线选择），<b>保留天赋树结构</b>，可重新选择主线/支线。</div><div class="sk-d-stat"><span>已消耗经验：<b class="num">${consumed}</b></span><span>返还：<b style="color:var(--skill-accent)">+${refund}</b> 到该技能（${pct}%）</span></div><div class="sk-d-warn">${ubIcon('warning')} 返还已消耗经验的 ${pct}%（共 ${refund}，1:5 折算下等值）。天赋树结构不变，仅清空激活回基础节点，可重新激活。操作不可撤销。</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px"><button class="sk-act-btn ghost" id="skResetCancel">取　消</button><button class="sk-act-btn" id="skResetOk">确认重置</button></div></div></div></div></div>`;
  markBridgeSkillPanel(overlay, 'bridge-module-skill-detail');
  syncDarkClass(overlay); markPopupShown(); overlay.classList.add('show');
  overlay.onclick = async (e: MouseEvent) => {
    const id = (e.target as HTMLElement).id;
    if (id === 'skResetOk') {
      const btn = document.getElementById('skResetOk') as HTMLButtonElement | null;
      if (btn) { btn.disabled = true; btn.textContent = '重置中…'; }
      const r = await resetSkillActivations(skillName);
      if (r.ok) { getToastr()?.success(`已重置「${skillName}」激活` + (r.refund ? `，返还 ${r.refund} 经验` : ''), '天赋树'); showSkillTreePopup(skillName, _curStyle); }
      else { getToastr()?.warning(r.reason || '重置失败', '天赋树'); showSkillTreePopup(skillName, _curStyle); }
      return;
    }
    if (id === 'skResetCancel' || id === 'panelClose' || e.target === overlay) { showSkillTreePopup(skillName, _curStyle); return; }
  };
}
