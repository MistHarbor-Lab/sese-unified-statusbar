// core/skill-activation.ts
// 激活逻辑：消耗计算、扣费、锁主线、同步派生条目（2026-07-21 变更：不再回写数据库 skill_desc，强化仅经派生条目反映）。
import { readSkillTree, writeSkillTree } from './skill-store';
import {
  getCellByHeader, getSheetByName, resolveRowIdFromCache, runDbBatch,
  isNsfwPlayActive,
  type DbWriteOp,
} from './data-manager';
import { readSerseEnergy, serseIncrementOp } from './energy-payment';
import { syncSkillWorldbook } from './skill-worldbook';
import {
  SERSE_TO_EXP_RATIO, SKILL_TABLE_NAME, SKILL_COL,
  type SkillTalentTree,
} from './skill-types';

export type NodeState = 'activated' | 'activatable' | 'locked';

export function isMainLineMaxed(tree: SkillTalentTree, lineId: string): boolean {
  const line = tree.mainLines.find((item) => item.id === lineId);
  const lastId = line?.nodeIds[line.nodeIds.length - 1];
  return !!lastId && tree.activated.includes(lastId);
}

export function isLineAvailable(tree: SkillTalentTree, lineId: string): boolean {
  if (!tree.chosenMainLine || tree.chosenMainLine === lineId) return true;
  return isMainLineMaxed(tree, tree.chosenMainLine);
}

export function getNodeActivationCost(tree: SkillTalentTree, nodeId: string): number {
  const node = tree.nodes[nodeId];
  if (!node) return 0;
  return tree.chosenMainLine && node.lineId !== tree.chosenMainLine ? node.cost * 3 : node.cost;
}

/** Read-only cost preview using the same multi-main-line multiplier as activation. */
export function previewNodeActivationCost(skillName: string, tree: SkillTalentTree, nodeId: string, rowIdx?: number): SkillCostPreview {
  return previewSkillCost(skillName, getNodeActivationCost(tree, nodeId), rowIdx);
}

export function getNodeState(tree: SkillTalentTree, nodeId: string): NodeState {
  const n = tree.nodes[nodeId];
  if (!n) return 'locked';
  if (tree.activated.includes(nodeId)) return 'activated';
  if (n.kind === 'main') {
    if (!isLineAvailable(tree, n.lineId)) return 'locked';
    if (n.parentId && !tree.activated.includes(n.parentId)) return 'locked';
    return 'activatable';
  }
  if (n.kind === 'side') {
    if (!tree.chosenMainLine || !isLineAvailable(tree, n.lineId)) return 'locked';
    if (n.requires && !tree.activated.includes(n.requires)) return 'locked';
    if (n.parentId && !tree.activated.includes(n.parentId)) return 'locked';
    return 'activatable';
  }
  return 'locked';
}

export function getLockReason(tree: SkillTalentTree, nodeId: string): string {
  const pending = tree.nodes[nodeId];
  if (pending?.kind === 'main' && !isLineAvailable(tree, pending.lineId)) return '需先将首修主线升至最高阶';
  if (pending?.kind === 'side' && !tree.chosenMainLine) return '需先激活其挂靠主线';
  if (pending?.kind === 'side' && !isLineAvailable(tree, pending.lineId)) return '需先将首修主线升至最高阶';
  const n = tree.nodes[nodeId];
  if (!n) return '未知节点';
  if (n.parentId && !tree.activated.includes(n.parentId)) return `前置「${tree.nodes[n.parentId]?.title || ''}」未激活`;
  if (n.kind === 'side' && n.requires && !tree.activated.includes(n.requires)) return `挂靠主线节点「${tree.nodes[n.requires]?.title || ''}」未激活`;
  return '';
}

function findRow(skillName: string): number {
  const sh = getSheetByName(SKILL_TABLE_NAME);
  if (!sh || !Array.isArray(sh.content)) return 1;
  for (let i = 1; i < sh.content.length; i++) {
    if (getCellByHeader(SKILL_TABLE_NAME, i, SKILL_COL.name) === skillName) return i;
  }
  return 1;
}

export interface SkillCostPreview {
  cost: number;
  curExp: number;
  curSerse: number;
  needExp: number;      // 经验缺口 max(0, cost - curExp)
  needSerse: number;    // 瑟瑟能量缺口 ceil(needExp / 5)
  expDeduct: number;    // 实扣经验 min(cost, curExp)
  affordable: boolean;  // 瑟瑟能量是否足以补足缺口
}

/** 只读预览：扣费前判断是否付得起 + 给确认框展示明细（不写库）。rowIdx 可选，省去重复查行。 */
export function previewSkillCost(skillName: string, cost: number, rowIdx?: number): SkillCostPreview {
  const row = rowIdx ?? findRow(skillName);
  const curExp = parseInt(getCellByHeader(SKILL_TABLE_NAME, row, SKILL_COL.exp) || '0', 10) || 0;
  const curSerse = readSerseEnergy(); // U31：统一出口
  const needExp = Math.max(0, cost - curExp);
  const needSerse = needExp > 0 ? Math.ceil(needExp / SERSE_TO_EXP_RATIO) : 0;
  const expDeduct = Math.min(cost, curExp);
  return { cost, curExp, curSerse, needExp, needSerse, expDeduct, affordable: needSerse <= curSerse };
}

/** 实扣：技能经验值优先，差额瑟瑟能量按 1:5 补足（单批写回队列；失败整批回滚）。
 *  不足则不扣费直接返回失败。激活 / 生成 共用此扣费。 */
export async function deductSkillExpWithSerseFallback(
  skillName: string, cost: number, rowIdx?: number,
): Promise<{ ok: boolean; costExp: number; costSerse: number; reason?: string }> {
  const p = previewSkillCost(skillName, cost, rowIdx);
  if (!p.affordable) {
    // U31：文案对齐规范口径（保留经验缺口信息；措辞变更已经用户批准）
    return { ok: false, costExp: 0, costSerse: 0, reason: `经验不足 ${p.needExp}，瑟瑟能量不足（当前 ${p.curSerse} / 需要 ${p.needSerse}）` };
  }
  const row = rowIdx ?? findRow(skillName);
  const skillRowId = resolveRowIdFromCache(SKILL_TABLE_NAME, row);
  const ops: DbWriteOp[] = [];
  if (p.expDeduct > 0) {
    if (skillRowId === null) return { ok: false, costExp: 0, costSerse: 0, reason: '扣费失败' };
    ops.push({ kind: 'incrementCell', tableName: '主角技能表', rowId: skillRowId, colName: SKILL_COL.exp, delta: -p.expDeduct });
  }
  if (p.needSerse > 0) {
    ops.push(serseIncrementOp(-p.needSerse)); // U31：统一出口（增量写：并发下不丢扣减）
  }

  const ok = await runDbBatch(ops);
  if (!ok) return { ok: false, costExp: 0, costSerse: 0, reason: '扣费失败' };
  return { ok: true, costExp: p.expDeduct, costSerse: p.needSerse };
}

/** Best-effort compensation for a charged operation whose tree persistence failed. */
export async function refundSkillCost(skillName: string, costExp: number, costSerse: number): Promise<void> {
  const exp = Math.max(0, Math.floor(costExp || 0));
  const serse = Math.max(0, Math.floor(costSerse || 0));
  if (!exp && !serse) return;
  const row = findRow(skillName);
  const skillRowId = resolveRowIdFromCache(SKILL_TABLE_NAME, row);
  const ops: DbWriteOp[] = [];
  if (exp && skillRowId !== null) {
    ops.push({ kind: 'incrementCell', tableName: '主角技能表', rowId: skillRowId, colName: SKILL_COL.exp, delta: exp });
  }
  if (serse) {
    ops.push(serseIncrementOp(serse)); // U31：统一出口（增量写）
  }
  // best-effort 补偿：runDbBatch 失败返回 false 不抛错，结果忽略。
  if (ops.length > 0) await runDbBatch(ops);
}

export interface ActivateResult {
  ok: boolean;
  reason?: string;
  costExp?: number;
  costSerse?: number;
}

/** 激活节点：校验→扣费（共用 deductSkillExpWithSerseFallback，经验值优先，差额瑟瑟能量 1:5）→标记激活（主线锁兄弟）→同步派生条目（不写库，强化仅经派生条目反映）。 */
export async function activateNode(skillName: string, nodeId: string): Promise<ActivateResult> {
  const tree = readSkillTree(skillName);
  if (!tree) return { ok: false, reason: '无天赋树' };
  const n = tree.nodes[nodeId];
  if (!n) return { ok: false, reason: '未知节点' };
  if (tree.activated.includes(nodeId)) return { ok: false, reason: '已激活' };
  if (getNodeState(tree, nodeId) !== 'activatable') return { ok: false, reason: getLockReason(tree, nodeId) || '锁定' };

  const r = await deductSkillExpWithSerseFallback(skillName, getNodeActivationCost(tree, nodeId), findRow(skillName));
  if (!r.ok) return { ok: false, reason: r.reason };

  // 标记激活；首次选主线则锁兄弟
  tree.activated.push(nodeId);
  if (n.kind === 'main' && !tree.chosenMainLine) tree.chosenMainLine = n.lineId;
  // 写盘失败（只读/未就绪返回 false 而非抛错）：激活态未持久化，退回已扣费用，避免白扣。
  const saved = await writeSkillTree(tree).catch(() => false);
  if (!saved) {
    await refundSkillCost(skillName, r.costExp, r.costSerse);
    return { ok: false, reason: '保存天赋树失败，费用已退回' };
  }

  // 强化形态仅经派生常亮条目「主角当前技能」反映给 AI；不回写数据库 skill_desc（2026-07-21 变更）
  await syncSkillWorldbook();
  // 成就打点：技能激活 + 条件主线满阶
  try {
    const _lew = isNsfwPlayActive();
    (window as any).__ubEmitAchievement?.('skill_activated', { kind: n.kind, skillName, whileLewd: _lew ? 1 : 0 });
    const _ml = tree.chosenMainLine ? tree.mainLines.find(m => m.id === tree.chosenMainLine) : null;
    if (_ml && _ml.nodeIds.every((id: string) => tree.activated.includes(id))) (window as any).__ubEmitAchievement?.('skill_maxed', { skillName, lineId: tree.chosenMainLine });
  } catch (_e) { /* ignore */ }
  return { ok: true, costExp: r.costExp, costSerse: r.costSerse };
}
