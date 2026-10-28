import { getToastr } from '../core/env';
import { ubIcon } from '../core/icons';
// renderers/skill-popup.ts
// 技能列表弹窗（响应式 A 紧凑行）+ 头部刷新按钮（短按批量/长按带额外要求）
// + 每技能「天赋树」按钮（短按打开）+「删除」按钮。镜像 showItemPopup / map-panel。
import { getSheetByName, getCellByHeader, deleteRow } from '../core/data-manager';
import { listSkillTrees, deleteSkillTree } from '../core/skill-store';
import { generateAllSkillTrees, previewBatchGeneration } from '../core/skill-tree-engine';
import { syncSkillWorldbook } from '../core/skill-worldbook';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 06 待修：技能列表「点天赋树→开详情」与天赋树详情「关闭→回列表」互相打开 ⇒ 同 05，注入导航回调即可解
import { showSkillTreePopup } from './skill-tree-panel';
import { syncDarkClass, markPopupShown, guardGhostClick, closePanelOverlay } from './html-builder';
import { SKILL_TABLE_NAME, SKILL_COL, SKILL_TREE_GEN_COST } from '../core/skill-types';
import { escapeHtml as esc } from '../core/html-escape';
import { readExtraPromptCache, writeExtraPromptCache, EXTRA_PROMPT_CACHE_KEYS } from '../core/extra-prompt-cache';
import { bindLongPress, swallowGhostClickIfPointerActive } from './long-press';
import { captureScroll } from './dom-update';

let _curStyle = 'ancient';

interface SkillRow { row: number; name: string; type: string; exp: string; desc: string; hasTree: boolean; }
function readSkills(): SkillRow[] {
  const sheet = getSheetByName(SKILL_TABLE_NAME);
  if (!sheet || !Array.isArray(sheet.content)) return [];
  // 一次读天赋树索引（listSkillTrees 读小索引），替代逐技能 hasSkillTree——
  // 后者每次 readStoryFeature 深拷贝整棵天赋树 + validateSkillTree 全量校验（N 技能 = N 次）。
  // index 与树文件由 writeSkillTree/deleteSkillTree 同步维护，语义等价。
  const treeNames = new Set(listSkillTrees());
  const out: SkillRow[] = [];
  for (let i = 1; i < sheet.content.length; i++) {
    const name = getCellByHeader(SKILL_TABLE_NAME, i, SKILL_COL.name);
    if (!name) continue;
    out.push({
      row: i, name: String(name),
      type: String(getCellByHeader(SKILL_TABLE_NAME, i, SKILL_COL.type) || ''),
      exp: String(getCellByHeader(SKILL_TABLE_NAME, i, SKILL_COL.exp) || '0'),
      desc: String(getCellByHeader(SKILL_TABLE_NAME, i, SKILL_COL.desc) || ''),
      hasTree: treeNames.has(String(name)),
    });
  }
  return out;
}

/** 删除技能：删表行 + 删天赋树 + 重算派生常亮条目，再回到技能列表。 */
async function deleteSkill(row: number, skillName: string): Promise<void> {
  const ok = await deleteRow(SKILL_TABLE_NAME, row);
  if (!ok) { getToastr()?.error('删除失败', '技能'); return; }
  try { await deleteSkillTree(skillName); } catch (_e) { /* best-effort */ }
  try { await syncSkillWorldbook(); } catch (_e) { /* best-effort */ }
  getToastr()?.success(`已删除「${skillName}」`, '技能');
  showSkillPopup(_curStyle);
}

export function showSkillPopup(style: string): void {
  _curStyle = style;
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  // 技能列表随弹窗整壳换新（.sk-body 元素被换 ⇒ scrollTop 归零）：删除技能/批量生成后重开时保位。
  // 首次打开时 overlay 里没有 .sk-body，捕获值为 0 ⇒ 天然回顶。
  const restoreScroll = captureScroll(overlay, '.sk-body');
  const skills = readSkills();
  const rows = skills.map((s) => {
    const badge = s.type === '主动' ? 'active' : 'passive';
    const dot = s.hasTree ? 'on' : 'off';
    const stTxt = s.hasTree ? '已生成' : '未生成';
    return `<div class="sk-row"><span class="sk-name">${esc(s.name)}</span><span class="sk-badge ${badge}">${esc(s.type)}</span><span class="sk-exp"><em>经验</em><b class="num">${esc(s.exp)}</b></span><span class="sk-desc">${esc(s.desc)}</span><span class="sk-status"><i class="sk-dot ${dot}"></i>${stTxt}</span><button class="sk-tree-btn" data-tree="${esc(s.name)}">天赋树 ▸</button><button class="sk-del-btn" data-del-row="${s.row}" data-del-name="${esc(s.name)}" title="删除该技能">${ubIcon('trash')}</button></div>`;
  }).join('');
  overlay.innerHTML = `<div class="panel-popup sk-popup ub-popup--m"><div class="sk-head"><span class="sk-title">技能</span><span class="sp"></span><button class="sk-btn ub-lp-hint" id="skRefresh" title="批量生成未成树的天赋树；长按可附加生成要求">${ubIcon('repeat')}</button><button class="sk-btn close" id="panelClose">×</button></div><div class="sk-body"><div class="sk-tip">「天赋树」打开详情 · 删除技能 · 批量生成未成树的天赋树</div>${rows || '<div style="text-align:center;padding:20px;color:var(--text-muted,#888)">暂无技能</div>'}</div></div>`;
  restoreScroll();
  if (style === 'bridge') {
    overlay.querySelector('.sk-popup')?.classList.add('bridge-window', 'bridge-module-skill-detail');
  }
  syncDarkClass(overlay); markPopupShown(); overlay.classList.add('show');
  bindSkillPopupEvents(overlay);
}

function bindSkillPopupEvents(overlay: HTMLElement): void {
  overlay.onclick = (e: MouseEvent) => {
    if (e.target === overlay || (e.target as HTMLElement).id === 'panelClose') {
      if (guardGhostClick()) return; closePanelOverlay(overlay); return;
    }
  };

  // 刷新按钮：短按=批量生成未成树天赋树（带生成中反馈）；长按=弹额外要求框再批量生成（U10：统一走 renderers/long-press）。
  const refresh = overlay.querySelector('#skRefresh') as HTMLElement | null;
  if (refresh) {
    bindLongPress(refresh, {
      onShort: () => doRefreshGenerate(),
      onLong: () => showSkillExtraPromptDialog('批量生成 · 额外要求', (extraReq) => doRefreshGenerate(extraReq)),
    });
  }

  // 天赋树按钮：点击打开（重新生成入口在天赋树界面内的「↻」按钮）
  overlay.querySelectorAll<HTMLButtonElement>('.sk-tree-btn').forEach((btn) => {
    const skillName = btn.getAttribute('data-tree') || '';
    btn.addEventListener('click', (e) => { e.stopPropagation(); showSkillTreePopup(skillName, _curStyle); });
  });

  // 删除按钮：弹确认 → 删除表行+天赋树+派生条目
  overlay.querySelectorAll<HTMLButtonElement>('.sk-del-btn').forEach((btn) => {
    const row = parseInt(btn.getAttribute('data-del-row') || '0', 10);
    const name = btn.getAttribute('data-del-name') || '';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSkillConfirmDialog('删除技能', `确定删除「${name}」吗？将同时删除其天赋树与已激活强化，且不可恢复。`, '删除', () => void deleteSkill(row, name));
    });
  });
}

/** 确认弹窗（删除技能用）。点遮罩可取消；遮罩与按钮 click 都 stopPropagation，防止冒泡到 panelOverlay。 */
function showSkillConfirmDialog(title: string, message: string, confirmLabel: string, onConfirm: () => void): void {
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  const dlg = document.createElement('div');
  dlg.className = 'sk-extra-overlay';
  dlg.innerHTML = `<div class="sk-extra-dialog"><div style="font-weight:600;margin-bottom:8px">${esc(title)}</div><div style="font-size:var(--ub-ui-font-12,12px);color:var(--skill-muted);margin-bottom:10px;line-height:1.5">${esc(message)}</div><div class="acts"><button class="sk-act-btn ghost" id="skConfirmCancel">取消</button><button class="sk-act-btn" id="skConfirmOk">${esc(confirmLabel)}</button></div></div>`;
  overlay.appendChild(dlg);
  syncDarkClass(dlg);
  markPopupShown(); // U8：压返回键守卫（打开即登记，关闭时由 closePanelOverlay 归还）
  // U8：统一收尾——不再裸 remove()，改走 closePanelOverlay（归还返回键守卫 + 清滚动位置记忆 + 刷新徽章）
  const close = (): void => { closePanelOverlay(dlg); dlg.remove(); };
  // U8：遮罩点击补 guardGhostClick——手机上「触摸抬起」后浏览器补发的合成 click 会落在刚出现的遮罩上；
  // 没有这道闸时确认框会「一冒出来就被自己关掉」（同一道闸主弹窗早已在用，此处漏了）。
  dlg.addEventListener('click', (e: Event) => { e.stopPropagation(); if (e.target === dlg) { if (guardGhostClick()) return; close(); } });
  dlg.querySelector('#skConfirmCancel')!.addEventListener('click', (e) => { e.stopPropagation(); close(); });
  dlg.querySelector('#skConfirmOk')!.addEventListener('click', (e) => { e.stopPropagation(); close(); onConfirm(); });
}

/** 批量生成未成树天赋树：先只读预览（全部付得起才继续，否则中止）→ 弹确认框显示总花费 →
 *  确认后置「⏳」并禁用，再调 generateAllSkillTrees。引擎层仍会二次校验防绕过。
 *  修 bug 1：此前 #skRefresh 点击后到 AI 返回（10-30s）期间无任何 UI 反馈，用户以为没点上、又点一次才撞到 _generating 守卫的 toast。 */
function doRefreshGenerate(extraReq?: string): void {
  const pv = previewBatchGeneration();
  if (pv.missing.length === 0) { getToastr()?.info('所有技能已有天赋树', '天赋树'); return; }
  if (!pv.affordable) {
    getToastr()?.error(`经验不足：「${pv.shortSkill}」还需 ${pv.shortNeedSerse} 瑟瑟能量补足（当前 ${pv.curSerse}），已中止批量生成`, '天赋树');
    return;
  }
  const costLine = pv.totalSerseNeed > 0
    ? `经验 ${pv.totalExpDeduct} + 瑟瑟能量 ${pv.totalSerseNeed}`
    : `经验 ${pv.missing.length * SKILL_TREE_GEN_COST}`;
  showSkillConfirmDialog(
    '批量生成天赋树',
    `将为 ${pv.missing.length} 个未成树技能各生成天赋树（每棵 ${SKILL_TREE_GEN_COST} 经验），共消耗 ${costLine}，不足用瑟瑟能量按 1:5 补足。确认生成？`,
    '确认生成',
    () => {
      const btn = document.getElementById('skRefresh') as HTMLButtonElement | null;
      if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
      void generateAllSkillTrees(extraReq).then(() => showSkillPopup(_curStyle));
    },
  );
}

/** 长按额外要求弹窗（复用 .sk-extra-overlay/.sk-extra-dialog + textarea，CSS 已在 skill-base.ts 备好）。
 *  textarea 空时确认键禁用；确认时把 trim 后的额外要求传给 onConfirm。镜像大调查 showInvestigationExtraPromptDialog。 */
export function showSkillExtraPromptDialog(title: string, onConfirm: (extraReq: string) => void): void {
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  const dlg = document.createElement('div');
  dlg.className = 'sk-extra-overlay';
  dlg.innerHTML = `<div class="sk-extra-dialog"><div style="font-weight:600;margin-bottom:6px">${esc(title)}</div><div style="font-size:12px;color:var(--skill-muted);margin-bottom:8px;line-height:1.5">补充本次生成的额外要求（仅本次生效，不保存）</div><textarea id="skExtraInput" placeholder="例如：侧重某发展方向 / 强化某风格 / 补充设定细节"></textarea><div class="acts"><button class="sk-act-btn ghost" id="skExtraCancel">取消</button><button class="sk-act-btn" id="skExtraOk" disabled>开始生成</button></div></div>`;
  overlay.appendChild(dlg);
  syncDarkClass(dlg);
  const input = dlg.querySelector('#skExtraInput') as HTMLTextAreaElement | null;
  const okBtn = dlg.querySelector('#skExtraOk') as HTMLButtonElement | null;
  if (input && okBtn) {
    input.addEventListener('input', () => { okBtn.disabled = !(input.value || '').trim(); });
    const cachedSkill = readExtraPromptCache(EXTRA_PROMPT_CACHE_KEYS.skill);
    if (cachedSkill) { input.value = cachedSkill; okBtn.disabled = false; }
    okBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = (input.value || '').trim();
      writeExtraPromptCache(EXTRA_PROMPT_CACHE_KEYS.skill, val);
      dlg.remove();
      onConfirm(val);
    });
    setTimeout(() => { try { input.focus(); } catch (_e) { /* ignore */ } }, 50);
  }
  dlg.querySelector('#skExtraCancel')!.addEventListener('click', (e) => { e.stopPropagation(); dlg.remove(); });
  // 若 dlg 在 pointer 按下期间显示（长按触发），松手的合成 click target 会落到刚覆盖屏幕的 dlg 上误关弹窗；
  // 按钮上的 click 吞噬对它无效（target 已不在按钮）。U10：统一交给 long-press 模块在 document capture 层吞掉。
  swallowGhostClickIfPointerActive();
  dlg.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    if (e.target === dlg) dlg.remove();
  });
}
