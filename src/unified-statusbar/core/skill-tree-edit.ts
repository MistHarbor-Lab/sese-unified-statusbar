import { type SkillTalentTree, type SkillTreeEditCommand } from './skill-types';
import { plainClone } from './deep-clone';
import { readSkillTree, writeSkillTree } from './skill-store';
import { deductSkillExpWithSerseFallback, refundSkillCost } from './skill-activation';
import { syncSkillWorldbook } from './skill-worldbook';

/** The Nth successful edit in a tree costs N × 5 skill experience. */
export function previewTreeEditCost(tree: SkillTalentTree): number {
  return 5 * (Math.max(0, Math.floor(tree.editOperationCount || 0)) + 1);
}

export type TreeEditValidation = { ok: true; tree: SkillTalentTree } | { ok: false; reason: string };

export function validateTreeEdit(tree: SkillTalentTree, command: SkillTreeEditCommand): TreeEditValidation {
  const next = plainClone(tree) as SkillTalentTree;
  if (command.kind === 'appendMain') {
    const line = next.mainLines.find((item) => item.id === command.lineId);
    const title = String(command.title || '').trim();
    const desc = String(command.desc || '').trim();
    const cost = Number(command.cost);
    if (!line || !title || !desc || !Number.isFinite(cost) || cost < 0) return { ok: false, reason: '主线节点信息无效' };
    const parentId = line.nodeIds[line.nodeIds.length - 1];
    const tier = line.nodeIds.length + 1;
    let id = `${line.id}_main_${tier}`;
    let suffix = 2;
    while (next.nodes[id]) id = `${line.id}_main_${tier}_${suffix++}`;
    next.nodes[id] = { id, kind: 'main', lineId: line.id, tier, title, desc, cost: Math.floor(cost), parentId };
    line.nodeIds.push(id);
    return { ok: true, tree: next };
  }
  if (command.kind === 'appendSide') {
    const line = next.mainLines.find((item) => item.id === command.lineId);
    const anchor = next.nodes[command.requires];
    const parent = next.nodes[command.parentId];
    const title = String(command.title || '').trim();
    const desc = String(command.desc || '').trim();
    const cost = Number(command.cost);
    if (!line || !anchor || anchor.kind !== 'main' || anchor.lineId !== line.id || !parent || !title || !desc || !Number.isFinite(cost) || cost < 0) {
      return { ok: false, reason: '支线挂靠信息无效' };
    }
    const validParent = parent.id === anchor.id || (parent.kind === 'side' && parent.lineId === line.id && parent.requires === anchor.id);
    if (!validParent) return { ok: false, reason: '支线前置必须是挂靠节点或同一支线节点' };
    const tier = parent.kind === 'side' ? parent.tier + 1 : 1;
    let id = `${line.id}_side_${anchor.id}_${tier}`;
    let suffix = 2;
    while (next.nodes[id]) id = `${line.id}_side_${anchor.id}_${tier}_${suffix++}`;
    next.nodes[id] = {
      id, kind: 'side', lineId: line.id, tier, title, desc, cost: Math.floor(cost),
      parentId: parent.id, requires: anchor.id,
    };
    return { ok: true, tree: next };
  }
  const node = next.nodes[command.nodeId];
  if (!node) return { ok: false, reason: '未知节点' };
  if (command.kind === 'delete') {
    if (node.id === next.rootId || next.activated.includes(node.id)) return { ok: false, reason: '已激活或基础节点不能删除' };
    const hasDependent = Object.values(next.nodes).some((item) => item.parentId === node.id || item.requires === node.id);
    if (hasDependent) return { ok: false, reason: '节点仍有后继依赖，不能删除' };
    if (node.kind === 'main') {
      const line = next.mainLines.find((item) => item.id === node.lineId);
      if (!line || line.nodeIds.length <= 2 || line.nodeIds[line.nodeIds.length - 1] !== node.id) return { ok: false, reason: '主线节点不能从此位置删除' };
      line.nodeIds.pop();
    }
    delete next.nodes[node.id];
    return { ok: true, tree: next };
  }
  const title = String(command.title || '').trim();
  const desc = String(command.desc || '').trim();
  if (!title || !desc) return { ok: false, reason: '标题和效果描述不能为空' };
  const changesPaidFields = command.cost !== undefined || command.requires !== undefined || command.parentId !== undefined;
  if (next.activated.includes(node.id) && changesPaidFields) return { ok: false, reason: '已激活节点仅可修改标题和效果描述' };
  node.title = title;
  node.desc = desc;
  if (command.cost !== undefined) {
    const cost = Number(command.cost);
    if (!Number.isFinite(cost) || cost < 0) return { ok: false, reason: '经验消耗必须是非负数' };
    node.cost = Math.floor(cost);
  }
  if (node.kind === 'side' && (command.requires !== undefined || command.parentId !== undefined)) {
    const requires = command.requires ?? node.requires;
    const parentId = command.parentId ?? node.parentId;
    const anchor = requires ? next.nodes[requires] : null;
    const parent = parentId ? next.nodes[parentId] : null;
    if (!anchor || anchor.kind !== 'main' || anchor.lineId !== node.lineId || !parent) {
      return { ok: false, reason: '支线挂靠或前置无效' };
    }
    const validParent = parent.id === anchor.id || (parent.kind === 'side' && parent.lineId === node.lineId && parent.requires === anchor.id);
    if (!validParent) return { ok: false, reason: '支线前置必须是挂靠节点或同一支线节点' };
    node.requires = anchor.id;
    node.parentId = parent.id;
    node.tier = parent.kind === 'side' ? parent.tier + 1 : 1;
  }
  return { ok: true, tree: next };
}

export interface TreeEditResult {
  ok: boolean;
  reason?: string;
  costExp?: number;
  costSerse?: number;
  operationCount?: number;
  syncWarning?: boolean;
}

export async function applyTreeEdit(skillName: string, command: SkillTreeEditCommand): Promise<TreeEditResult> {
  const tree = readSkillTree(skillName);
  if (!tree) return { ok: false, reason: '无天赋树' };
  const validation = validateTreeEdit(tree, command);
  if (!validation.ok) return validation;
  const charge = await deductSkillExpWithSerseFallback(skillName, previewTreeEditCost(tree));
  if (!charge.ok) return { ok: false, reason: charge.reason };
  const next = validation.tree;
  next.editOperationCount = tree.editOperationCount + 1;
  // writeSkillTree 失败返回 false 而非抛错（catch 兜意外抛路径），必须判布尔退款才真实可达。
  const saved = await writeSkillTree(next).catch(() => false);
  if (!saved) {
    await refundSkillCost(skillName, charge.costExp, charge.costSerse);
    return { ok: false, reason: '保存天赋树失败，费用已退回' };
  }
  try {
    await syncSkillWorldbook();
    return { ok: true, costExp: charge.costExp, costSerse: charge.costSerse, operationCount: next.editOperationCount };
  } catch (_error) {
    return { ok: true, costExp: charge.costExp, costSerse: charge.costSerse, operationCount: next.editOperationCount, syncWarning: true };
  }
}
