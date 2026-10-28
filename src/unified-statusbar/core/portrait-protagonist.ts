// —— 主角立绘：身份/素材/文案纯函数单元（spec 2026-08-23-protagonist-portrait-design §2/§3/§5）——
import { getCellByHeader } from './data-manager';
import { escapeAttr } from './html-escape';
import { getWardrobeSnapshot } from './wardrobe-store';
import { selectionItemIds } from './wardrobe-types';

/** 立绘索引哨兵 key：主角占用固定 key，改名不丢图（与衣柜 PROTAGONIST_ACTOR_KEY 同哲学）。 */
export const PORTRAIT_PROTAGONIST_KEY = '__protagonist__';

export function isProtagonistKey(npc: string): boolean {
  return npc === PORTRAIT_PROTAGONIST_KEY;
}

export function resolveProtagonistDisplayName(nameCell: string): string {
  const n = String(nameCell || '').trim();
  return n || '主角';
}

export function readProtagonistDisplayName(): string {
  try {
    return resolveProtagonistDisplayName(getCellByHeader('主角信息表', 1, '姓名') || '');
  } catch (_e) {
    return '主角';
  }
}

/** 弹窗/菜单标题用显示名；NPC 用原名。 */
export function portraitLabel(npc: string): string {
  return isProtagonistKey(npc) ? readProtagonistDisplayName() : npc;
}

/** 主角立绘框 HTML（结构 1:1 对齐 buildPortraitBoxHtml；data-portrait-name 恒为哨兵 key）。 */
export function renderProtagonistPortraitMarkup(path: string | null, displayName: string): string {
  const key = PORTRAIT_PROTAGONIST_KEY;
  const actions = '<div class="portrait-actions"><span data-act="generate">生成</span><span data-act="switch">换</span><span data-act="gallery">浏览</span></div>'
    + '<span class="portrait-menu-trigger" data-act="menu" title="立绘操作">⋮</span>';
  // F55(第十二轮)：姓名来自主角信息表（AI/用户可写）、path 来自立绘索引——属性位必须转义，
  // 与 NPC 版（html-builder 的 escapeAttr(npc)/escapeAttr(path)）逐字对齐。
  const safeName = escapeAttr(displayName);
  const safePath = escapeAttr(path || '');
  if (path) {
    return '<div class="portrait-box has-real-portrait" data-portrait-name="' + key + '" title="' + safeName + '（主角）">'
      + '<img src="' + safePath + '" alt="' + safeName + '" onerror="this.parentNode.classList.remove(\'has-real-portrait\');this.parentNode.classList.add(\'portrait-empty\');this.remove();">'
      + actions + '</div>';
  }
  return '<div class="portrait-box portrait-empty" data-portrait-name="' + key + '" title="' + safeName + '（主角）">' + actions + '</div>';
}

/** 衣柜主角当前穿搭 → 生图基线行（与 formatClothingOverride 同格式；tags 整段保留不 split）。 */
export function resolveProtagonistOutfitBaseline(state: {
  items: Array<{ id: string; name: string; category: string; description: string; tags?: string }>;
  actorProfiles?: Record<string, { currentOutfit?: { slots: Record<string, string>; accessories: string[] } } | undefined>;
} | null): string {
  const sel = state?.actorProfiles?.['protagonist']?.currentOutfit;
  if (!sel) return '';
  const byId = new Map(state!.items.map(it => [it.id, it]));
  const lines: string[] = [];
  for (const id of selectionItemIds(sel as never)) {
    const it = byId.get(id);
    if (!it) continue;
    const tags = (it.tags || '').trim();
    lines.push(tags ? `- ${it.category}：${it.name}——${it.description}｜标签：${tags}` : `- ${it.category}：${it.name}——${it.description}`);
  }
  return lines.join('\n');
}

export function readProtagonistOutfitBaseline(): string {
  try {
    return resolveProtagonistOutfitBaseline(getWardrobeSnapshot() as never);
  } catch (_e) {
    return '';
  }
}

/** 生图弹窗「生成依据」主角版文案（对齐 NPC 版 .portrait-gen-preview 结构）。 */
export function buildProtagonistGenBasisHtml(contextCount: number): string {
  return '· 主角信息表：姓名/性别/年龄（按生日与当前日期推算）/外貌特征（含日常穿衣风格）/身份背景<br>'
    + '· 主角信息表：近况（勾选「包含当前状态」时注入）<br>'
    + '· 衣柜：主角当前穿搭（单品标签优先）<br>'
    + `· 最近 ${contextCount} 段 AI 回复（上下文）`;
}
