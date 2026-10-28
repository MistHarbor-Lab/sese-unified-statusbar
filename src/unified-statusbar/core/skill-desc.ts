// core/skill-desc.ts
// 据已激活节点重算 skill_desc = 基础信息 + 主线强化（按 tier 累加）+ 支线天赋。纯函数，无 I/O。
// 抽到独立模块以避免 skill-activation ↔ skill-worldbook 循环依赖。
//
// 设计（2026-07-18 调整）：主线不再"覆盖"基础与前 tier，而是"累加"——
//   基础节点 desc（技能初始描述）始终保留为第一段；
//   主线节点按 tier 升序，每条为本 tier 相对前 tier 的【增量强化】（承接基础与前 tier，信息只增不减），
//   系统不再取"最高 tier 覆盖"，而是把各 tier 强化按序拼接，确保前后强化等级信息连贯；
//   支线按 requires 分组，每组取最高已激活 tier 节点 → 一条 `　（标题）：描述` 条款（支线强化替换该组条款）。
import { type SkillTalentTree, type TalentNode } from './skill-types';

export function rebuildSkillDesc(tree: SkillTalentTree): string {
  const nodes = tree.nodes;
  const parts: string[] = [];

  // 基础信息：技能初始描述，永不被覆盖
  const base = nodes[tree.rootId];
  if (base && base.desc) parts.push(base.desc);

  // 主线强化：按 tier 升序累加（每 tier 为相对前 tier 的增量强化，信息只增不减、前后连贯）
  for (const line of tree.mainLines) {
    const highest = (Object.values(nodes) as TalentNode[])
      .filter((n) => n.kind === 'main' && n.lineId === line.id && tree.activated.includes(n.id))
      .sort((a, b) => b.tier - a.tier)[0];
    if (highest?.desc?.trim()) parts.push(`【${line.name || line.id}】${highest.desc.trim()}`);
  }

  // 支线天赋：按 requires 分组，每组取最高已激活 tier（支线强化替换该组条款）
  const sideGroups = new Map<string, TalentNode[]>();
  for (const n of Object.values(nodes) as TalentNode[]) {
    if (n.kind !== 'side' || !tree.activated.includes(n.id)) continue;
    const key = n.requires || n.id;
    if (!sideGroups.has(key)) sideGroups.set(key, []);
    sideGroups.get(key)!.push(n);
  }
  for (const grp of Array.from(sideGroups.values())) {
    grp.sort((a, b) => b.tier - a.tier);
    const top = grp[0];
    parts.push(`　（${top.title}）：${top.desc}`);
  }

  return parts.filter(Boolean).join('\n');
}
