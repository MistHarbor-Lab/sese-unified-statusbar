// core/skill-manual.ts
// 手动补录技能（正文 [技能新增] 卡片上的「手动添加」按钮 → 弹窗 → 入库）的纯逻辑。
// 定位：技能入库的正常路径 = 填表 AI 按技能表 insert 规则（空表按正文生成初始技能；
// 非空表正文明确提到获得/学会新技能时新增，经验值写 0、同名不重复插入）：
// 前端不再有自动提取监听；本模块只服务「填表漏写」时的人工补录。
// 宽度口径与显示正则 docs/regex-技能正文卡片V1.json 的捕获组对齐（名 ≤24；描述沿用旧提取器上限 80）。

/** 技能名宽度上限（与显示正则 name 组同宽，超长两侧都不认）。 */
export const SKILL_NAME_MAX = 24;
/** 技能描述宽度上限（表内 note 口径 10-50 字，此处只防超长粘帖）。 */
export const SKILL_DESC_MAX = 80;

export interface SkillManualInput {
  name: string;
  type: string;
  desc: string;
}

export interface SkillManualPlan {
  name: string;
  type: '主动' | '被动';
  desc: string;
}

/**
 * 归一（纯函数）：三段裁剪 + 类别判定；名称为空 → null（不构成可入库输入）。
 * 类别口径沿用原自动提取器：含「主动」且不含「被动」→ 主动，其余一律被动（对齐商店购买默认）。
 * 描述两端的全/半角括号容忍并剥除（标签里加了括号也不坏）。
 */
export function normalizeSkillManualInput(raw: SkillManualInput | null | undefined): SkillManualPlan | null {
  const name = String(raw?.name ?? '').trim().slice(0, SKILL_NAME_MAX);
  if (!name) return null;
  const rawType = String(raw?.type ?? '').trim();
  const type: SkillManualPlan['type'] = /主动/.test(rawType) && !/被动/.test(rawType) ? '主动' : '被动';
  const desc = String(raw?.desc ?? '')
    .trim()
    .replace(/^[（(]+/, '')
    .replace(/[）)]+$/, '')
    .trim()
    .slice(0, SKILL_DESC_MAX);
  return { name, type, desc };
}

/** 查重（纯函数）：技能表 skill_name 全表唯一 —— 同名一律拒绝补录（避免静默忽略、用户以为没生效）。 */
export function skillNameExists(existing: ReadonlySet<string>, name: string): boolean {
  return existing.has(String(name ?? '').trim());
}
