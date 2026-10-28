// core/skill-store.ts
// 天赋树 story-floor-store 读写 + 宽松校验。镜像 map-tree-store.ts。
// 注：writeStoryFeatures / deleteStoryFeature 为 async，本模块写函数均 async。
import {
  SKILL_TREE_SCHEMA, SKILL_TREE_INDEX_SCHEMA, SKILL_STORY_KEY_PREFIX, SKILL_INDEX_STORY_KEY, SKILL_STYLE_MAX_LEN,
  type SkillTalentTree, type SkillTreeIndex, type TalentNode, type SkillMainLine,
} from './skill-types';
import {
  readStoryFeature, writeStoryFeatures, deleteStoryFeature,
} from './story-floor-store';

function treeKey(skillName: string): string {
  return SKILL_STORY_KEY_PREFIX + skillName;
}

function emptyIndex(): SkillTreeIndex {
  return { version: 1, schema: SKILL_TREE_INDEX_SCHEMA, entries: {} };
}

function readIndex(): SkillTreeIndex {
  const raw = readStoryFeature<SkillTreeIndex | null>(SKILL_INDEX_STORY_KEY, null);
  if (!raw || raw.schema !== SKILL_TREE_INDEX_SCHEMA) return emptyIndex();
  if (!raw.entries || typeof raw.entries !== 'object') return emptyIndex();
  return raw as SkillTreeIndex;
}

/** 宽松校验：≥1 主线（用户额外要求可只生 1 条）、每主线 ≥2 节点、cost 非负、无孤儿（孤儿 parentId 置 null）。返回规范化树或 null。 */
export function validateSkillTree(raw: any): SkillTalentTree | null {
  try {
    if (!raw || typeof raw !== 'object') return null;
    const nodes: Record<string, TalentNode> = raw.nodes || {};
    if (!raw.rootId || !nodes[raw.rootId]) return null;
    if (!Array.isArray(raw.mainLines) || raw.mainLines.length < 1) return null;
    for (const ml of raw.mainLines as SkillMainLine[]) {
      if (!ml || !Array.isArray(ml.nodeIds) || ml.nodeIds.length < 2) return null;
      if (!ml.nodeIds.every((id: string) => nodes[id])) return null;
    }
    for (const id of Object.keys(nodes)) {
      const n = nodes[id];
      if (!n || typeof n.cost !== 'number' || n.cost < 0) return null;
      if (n.kind === 'side') {
        const anchor = typeof n.requires === 'string' ? nodes[n.requires] : null;
        if (!anchor || anchor.kind !== 'main' || anchor.lineId !== n.lineId) return null;
        const parent = n.parentId ? nodes[n.parentId] : null;
        if (!parent || (parent.kind === 'main' && parent.id !== n.requires)) {
          n.parentId = anchor.id;
        } else if (parent.kind === 'side' && (parent.lineId !== n.lineId || parent.requires !== n.requires)) {
          return null;
        }
      }
      if (n.parentId != null && !nodes[n.parentId]) n.parentId = null; // 孤儿容忍
    }
    const activated: string[] = Array.isArray(raw.activated)
      ? (raw.activated as string[]).filter((id) => nodes[id])
      : [];
    const chosen: string | null =
      raw.chosenMainLine && (raw.mainLines as SkillMainLine[]).some((m) => m.id === raw.chosenMainLine)
        ? String(raw.chosenMainLine)
        : null;
    const accentColor = typeof raw.accentColor === 'string'
      && /^rgb\(\s*(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\s*\)$/.test(raw.accentColor)
      ? raw.accentColor
      : (typeof raw.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.accentColor) ? raw.accentColor : undefined);
    // F29：风味标签落库（此前 AI 写了 style 但在这一步被丢掉，白花 token）。
    // 归一化：空白串折叠成单空格（去换行/缩进）→ 截断到 SKILL_STYLE_MAX_LEN；空串/非字符串 ⇒ 不落键（旧树字节形态不变）。
    const styleText = typeof raw.style === 'string' ? raw.style.replace(/\s+/g, ' ').trim() : '';
    const style = styleText ? styleText.slice(0, SKILL_STYLE_MAX_LEN) : undefined;
    const tree: SkillTalentTree = {
      version: 1,
      schema: SKILL_TREE_SCHEMA,
      skillName: String(raw.skillName || ''),
      storyHash: String(raw.storyHash || ''),
      rootId: String(raw.rootId),
      nodes,
      mainLines: raw.mainLines,
      activated,
      chosenMainLine: chosen,
      accentColor,
      style,
      editOperationCount: Math.max(0, Math.floor(Number(raw.editOperationCount) || 0)),
    };
    // 基础节点默认已激活
    if (!tree.activated.includes(tree.rootId)) tree.activated.push(tree.rootId);
    return tree;
  } catch (_e) {
    return null;
  }
}

export function readSkillTree(skillName: string): SkillTalentTree | null {
  if (!skillName) return null;
  const raw = readStoryFeature<SkillTalentTree | null>(treeKey(skillName), null);
  if (!raw || raw.schema !== SKILL_TREE_SCHEMA) return null;
  return validateSkillTree(raw);
}

export function hasSkillTree(skillName: string): boolean {
  return !!readSkillTree(skillName);
}

export function listSkillTrees(): string[] {
  return Object.keys(readIndex().entries);
}

/** 写入天赋树+索引。返回 writeStoryFeatures 的落盘结果——调用方必须检查：
 *  存储只读/未就绪时返回 false 而非抛错，吞掉会导致「扣了费但树没写进去」。 */
export async function writeSkillTree(tree: SkillTalentTree): Promise<boolean> {
  const idx = readIndex();
  idx.entries[tree.skillName] = { skillName: tree.skillName, storyHash: tree.storyHash || '' };
  return writeStoryFeatures(
    { [treeKey(tree.skillName)]: tree, [SKILL_INDEX_STORY_KEY]: idx },
    [],
  );
}

export async function deleteSkillTree(skillName: string): Promise<void> {
  if (!skillName) return;
  await deleteStoryFeature(treeKey(skillName));
  const idx = readIndex();
  if (idx.entries[skillName]) {
    delete idx.entries[skillName];
    await writeStoryFeatures({ [SKILL_INDEX_STORY_KEY]: idx }, []);
  }
}

export async function clearAllSkillTrees(): Promise<void> {
  const idx = readIndex();
  const names = Object.keys(idx.entries);
  for (const n of names) await deleteStoryFeature(treeKey(n));
  await deleteStoryFeature(SKILL_INDEX_STORY_KEY);
}
