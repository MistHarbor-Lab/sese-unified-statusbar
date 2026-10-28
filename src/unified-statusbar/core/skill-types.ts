// core/skill-types.ts
// 主角技能天赋树类型与常量。纯类型，无 DOM。

export const SKILL_TABLE_NAME = '主角技能表';
export const SKILL_COL = {
  name: '技能名称',
  type: '技能类别',
  exp: '技能经验值',
  desc: '技能描述',
} as const;

/** 受管常亮条目「主角当前技能」标记：name/comment 前缀，生成时排除 */
export const SKILL_MANAGED_PREFIX = 'UBS-技能-主角当前技能';
export const SKILL_MANAGED_DISPLAY_NAME = 'UBS-技能-主角当前技能';

export const SKILL_TREE_SCHEMA = 'skill_talent_tree';
export const SKILL_TREE_INDEX_SCHEMA = 'skill_tree_index';
export const SKILL_STORY_KEY_PREFIX = 'skill.tree:';
export const SKILL_INDEX_STORY_KEY = 'skill.tree.index';

/** 1 瑟瑟能量 = N 技能经验值 */
export const SERSE_TO_EXP_RATIO = 5;

/** 生成天赋树的经验消耗（首次生成 / 批量生成每棵）；不足用瑟瑟能量按 1:5 补足 */
export const SKILL_TREE_GEN_COST = 10;
/** 「重置当前技能」返还已消耗经验的比例（保留树结构，仅取消激活） */
export const SKILL_RESET_REFUND_RATIO = 0.75;
/** 「重新生成天赋树」退还已消耗经验的比例（重新生成新树） */
export const SKILL_REGEN_REFUND_RATIO = 0.5;

export type TalentNodeKind = 'base' | 'main' | 'side';

export interface TalentNode {
  id: string;
  kind: TalentNodeKind;
  lineId: string;        // base=''; main/side=所属主线 id
  tier: number;          // base=0; main 1..N; side 1..N（支线自身深度）
  title: string;
  desc: string;          // 节点效果描述（具体可演绎）
  cost: number;          // 经验值消耗（base=0）
  parentId: string | null;  // base=null; main=上一 tier 或 base; side=挂靠主线节点或支线上一节点
  requires?: string;     // 支线：挂靠主线节点 id
  iconHint?: string;     // AI 视觉提示（可选）
  colorHint?: string;
}

export interface SkillMainLine {
  id: string;
  name: string;
  nodeIds: string[];
}

export interface SkillTalentTree {
  version: 1;
  schema: 'skill_talent_tree';
  skillName: string;
  storyHash: string;
  rootId: string;
  nodes: Record<string, TalentNode>;
  mainLines: SkillMainLine[];
  /** Number of successful node edits, additions, or deletions since this tree was created. */
  editOperationCount: number;
  activated: string[];            // 已激活节点 id
  chosenMainLine: string | null;   // 已承诺主线 id（锁兄弟主线）
  accentColor?: string;  // AI 生成的主题色，格式 rgb(r,g,b) 或 #rrggbb；缺失/非法 → 标签落回白色
  /** AI 生成的风味标签（4-8 字技能气质短语，例：寒锋·孤高）；缺失/空 → 树头不显示挂签（F29）。 */
  style?: string;
}

/** 风味标签入库上限（字符数）：契约要求 4-8 字，这里是防御性截断（AI 偶尔会写长句）。 */
export const SKILL_STYLE_MAX_LEN = 16;

export type SkillTreeEditCommand =
  | { kind: 'update'; nodeId: string; title: string; desc: string; cost?: number; requires?: string; parentId?: string | null }
  | { kind: 'appendMain'; lineId: string; title: string; desc: string; cost: number }
  | { kind: 'appendSide'; lineId: string; requires: string; parentId: string; title: string; desc: string; cost: number }
  | { kind: 'delete'; nodeId: string };

export interface SkillTreeIndexEntry {
  skillName: string;
  storyHash: string;
}

export interface SkillTreeIndex {
  version: 1;
  schema: 'skill_tree_index';
  entries: Record<string, SkillTreeIndexEntry>; // by skillName
}
