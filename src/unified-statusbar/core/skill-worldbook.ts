import { getSheetByName, getCellByHeader } from './data-manager';
import { STANDARD_RECURSION } from './constants';
import { readSkillTree } from './skill-store';
import { rebuildSkillDesc } from './skill-desc';
import { SKILL_TABLE_NAME, SKILL_COL, SKILL_MANAGED_PREFIX, SKILL_MANAGED_DISPLAY_NAME, type SkillTalentTree } from './skill-types';
import { isManagedSkillEntry, reconcileSingleManagedEntry } from './worldbook-entry';
import { dsCachePos, registerManagedWbEntry } from './wb-position';
import { requestWorldbookProjection } from './worldbook-projection-events';
import { getCurrentStoryChatKey } from './story-floor-store';

export { isManagedSkillEntry };

let _accentColorMap: Record<string, string> = {};
export function getSkillAccentColorMap(): Record<string, string> { return _accentColorMap; }

type SkillTagColorSyncListener = () => void;
let _colorSyncListener: SkillTagColorSyncListener | null = null;
export function setSkillTagColorSyncListener(fn: SkillTagColorSyncListener | null): void { _colorSyncListener = fn; }

function buildContent(): string {
  const colorMap: Record<string, string> = {};
  let body = '';
  const sheet = getSheetByName(SKILL_TABLE_NAME);
  if (sheet && Array.isArray(sheet.content) && sheet.content.length >= 2) {
    const lines: string[] = [];
    for (let row = 1; row < sheet.content.length; row++) {
      const name = getCellByHeader(SKILL_TABLE_NAME, row, SKILL_COL.name);
      if (!name) continue;
      const type = getCellByHeader(SKILL_TABLE_NAME, row, SKILL_COL.type) || '';
      const storedDescription = String(getCellByHeader(SKILL_TABLE_NAME, row, SKILL_COL.desc) || '');
      const tree = readSkillTree(String(name));
      const description = skillDisplayDesc(storedDescription, tree);
      // 节点 title 同色（与所属技能一致）：AI 用节点名标注【技能发动：节点名】时标签也有色
      if (tree?.accentColor) {
        colorMap[name] = tree.accentColor;
        const nodes = (tree as any).nodes || {};
        for (const id of Object.keys(nodes)) {
          const title = nodes[id]?.title;
          if (title && !colorMap[title]) colorMap[title] = tree.accentColor;
        }
      }
      lines.push(`· ${name}（${type}）：${description}`);
    }
    if (lines.length) {
      body = `【主角当前技能】\n格式要求：当正文中出现受技能效果影响的情况时，在受影响内容前加上前缀[技能发动：技能名]（技能名必须与下方清单中的技能名完全一致，不得改写、不得添加类别或括号）。\n当主角在剧情中初次学会一项下方清单之外的全新技能时，在学会的情节之后另起一行用标签记录：[技能新增]技能名|类别|技能描述。类别只能是「主动」或「被动」；技能描述为 10-50 字、一句具体可演绎的效果；同名技能不得重复记录，清单中已有的技能一律不再记录。\n${lines.join('\n')}`;
    }
  }
  _accentColorMap = colorMap;
  _colorSyncListener?.();
  return body;
}

/** 技能显示描述口径（与构建世界书同源）：树激活≥2 节点用派生强化描述，否则用表内基础描述。 */
export function skillDisplayDesc(storedDescription: string, tree: SkillTalentTree | null): string {
  return tree && tree.activated.length > 1 ? rebuildSkillDesc(tree) : storedDescription;
}

export interface SkillDisplayInfo { skillName: string; type: string; desc: string; }

/** 卡片展开时取效果文本（纯读）：技能名命中技能表行；未命中回退扫天赋树节点 title（节点效果也可标注）。 */
export function resolveSkillDisplayDesc(text: string): SkillDisplayInfo | null {
  const name = String(text || '').trim();
  if (!name) return null;
  const sheet = getSheetByName(SKILL_TABLE_NAME);
  if (!sheet || !Array.isArray(sheet.content)) return null;
  for (let row = 1; row < sheet.content.length; row++) {
    const skill = String(getCellByHeader(SKILL_TABLE_NAME, row, SKILL_COL.name) || '').trim();
    if (!skill) continue;
    const type = String(getCellByHeader(SKILL_TABLE_NAME, row, SKILL_COL.type) || '');
    if (skill === name) {
      const stored = String(getCellByHeader(SKILL_TABLE_NAME, row, SKILL_COL.desc) || '');
      return { skillName: skill, type, desc: skillDisplayDesc(stored, readSkillTree(skill)) };
    }
    const tree = readSkillTree(skill);
    if (tree) {
      const nodes = (tree as any).nodes || {};
      for (const id of Object.keys(nodes)) {
        if (nodes[id]?.title === name) {
          return { skillName: skill, type, desc: String(nodes[id]?.desc || '') };
        }
      }
    }
  }
  return null;
}

const SKILL_ORIG_POS = { type: 'before_character_definition', role: 'system', depth: 2, order: 8124 } as const;

function makeNewEntry(content: string): any {
  return {
    name: SKILL_MANAGED_PREFIX,
    comment: SKILL_MANAGED_DISPLAY_NAME,
    enabled: true,
    content,
    strategy: { type: 'constant', keys: [] },
    position: dsCachePos(SKILL_ORIG_POS),
    recursion: STANDARD_RECURSION,
    addMemo: true,
  };
}

/** Mutates the coordinator-owned entry copy and reports whether it changed. */
export function reconcileSkillWorldbookEntries(entries: any[], content: string): boolean {
  return reconcileSingleManagedEntry(entries, { content, isMine: isManagedSkillEntry, makeEntry: makeNewEntry });
}

export function getSkillWorldbookContent(): string {
  return buildContent();
}

// O6 签名闸门：技能投影是唯一每表格推送 tick 都无条件派发的投影（char-relations 同链有签名
// 幂等早退），而协调器按 id 零去重——每次派发都整本读世界书+全量 structuredClone。
// 签名源=技能表内容 + 聊天键；内容没变 ⇒ 连派发都不发生。
// O28 收窄：原第二项是 journal 全局令牌（含 pendingSeq），任何无关 story 写都会令它变化 →
// 每 300ms tick 重开闸门（整本读+克隆白做）。技能投影真实依赖只有技能表与聊天身份 ⇒ 换聊天键。
let _lastDispatchSignature: string | null = null;

/** 强制下次 tick 重新派发（测试用/外部直写世界书后补救）。 */
export function resetSkillWorldbookSignature(): void {
  _lastDispatchSignature = null;
}

export async function syncSkillWorldbook(): Promise<void> {
  const sheet = getSheetByName(SKILL_TABLE_NAME);
  const sheetSig = sheet && Array.isArray(sheet.content)
    ? `${sheet.content.length}|${JSON.stringify(sheet.content)}`
    : 'none';
  const signature = `${getCurrentStoryChatKey()}|${sheetSig}`;
  if (signature === _lastDispatchSignature) return;
  _lastDispatchSignature = signature;
  requestWorldbookProjection('skills', 'data-change');
}

registerManagedWbEntry({ match: entry => isManagedSkillEntry(entry), origPos: () => SKILL_ORIG_POS });
