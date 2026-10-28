// renderers/skill-gain-dialog.ts
// 正文 [技能新增] 卡片 →「手动添加」按钮的补录弹窗。
// 定位：技能入库的正常路径 = 填表 AI 按技能表 insert 规则（空表按正文生成初始技能；
// 非空表正文明确提到获得/学会新技能时新增，见 docs/色色灵感数据库模板V3.3.4.json 的 insertNode）；
// 本弹窗只在填表漏写时人工补录。
// 弹窗壳复用 renderers/confirm-dialog 的 openDialog（body 直挂 panel-overlay + .ub-confirm-overlay
// 标记类 + z-index 10025）⇒ 返回键/ESC/深色/幽灵点击防护与其余确认弹窗同源，零新增 CSS。
import { getConfig } from '../core/config-store';
import { addRow, getCellByHeader, getSheetByName } from '../core/data-manager';
import { setButtonBusy } from '../core/busy-state';
import { getToastr } from '../core/env';
import { escapeHtml as esc } from '../core/html-escape';
import { normalizeSkillManualInput, skillNameExists } from '../core/skill-manual';
import { SKILL_COL, SKILL_TABLE_NAME } from '../core/skill-types';
import { syncSkillWorldbook } from '../core/skill-worldbook';
import { closeDialog, openDialog } from './confirm-dialog';
import { bridgeWindowClass, guardGhostClick } from './html-builder';

/** 卡片自述数据（名称/类别/描述都取自卡片自身——标签是唯一事实源，不重新解析正文）。 */
export interface SkillGainCardData {
  name: string;
  type: string;
  desc: string;
}

/** 技能表已有技能名集合（读缓存，不触发 I/O）。 */
function readSkillNameSet(): Set<string> {
  const names = new Set<string>();
  const sheet = getSheetByName(SKILL_TABLE_NAME);
  if (sheet && Array.isArray(sheet.content)) {
    for (let row = 1; row < sheet.content.length; row++) {
      const n = getCellByHeader(SKILL_TABLE_NAME, row, SKILL_COL.name);
      if (n) names.add(String(n).trim());
    }
  }
  return names;
}

/** 手动补录技能弹窗（幂等可重开；技能开关关闭时直接忽略 —— 卡片本就不该存在）。 */
export function showSkillGainDialog(card: SkillGainCardData): void {
  if (getConfig().skillEnabled !== true) return;
  const style = getConfig().style;
  const init = normalizeSkillManualInput(card) ?? { name: '', type: '被动' as const, desc: '' };
  const dialogClass = style === 'bridge' ? bridgeWindowClass('confirm', 's') : 'panel-popup ub-popup--s';
  const label = 'style="display:block;font-size:var(--ub-ui-font-11,11px);opacity:.72;margin:0 0 4px"';
  const body =
    '<div class="' + dialogClass + ' ub-confirm-dialog">' +
      '<div class="ub-confirm-title">手动添加技能</div>' +
      '<div class="ub-confirm-message" style="max-height:26vh;padding-bottom:2px">仅当填表没有把这个技能写进技能表时，才用这里手动补录。\n正常情况技能由填表 AI 按正文明确提到的获得/学会自动入库（有 [技能新增] 标签时优先）；技能表里已有同名技能时会拒绝添加。</div>' +
      '<div class="ub-confirm-field"><span ' + label + '>技能名称</span>' +
        '<input class="ub-confirm-input" id="skGainName" maxlength="24" autocomplete="off" placeholder="照抄标签第一段（≤24字）" value="' + esc(init.name) + '"></div>' +
      '<div class="ub-confirm-field"><span ' + label + '>类别</span>' +
        '<select class="ub-confirm-input" id="skGainType">' +
          '<option value="主动"' + (init.type === '主动' ? ' selected' : '') + '>主动</option>' +
          '<option value="被动"' + (init.type === '被动' ? ' selected' : '') + '>被动</option>' +
        '</select></div>' +
      '<div class="ub-confirm-field"><span ' + label + '>技能描述</span>' +
        '<textarea class="ub-confirm-input" id="skGainDesc" maxlength="80" spellcheck="false" style="min-height:62px;max-height:20vh;resize:vertical;line-height:1.6" placeholder="照抄标签的第三段（≤80字）">' + esc(init.desc) + '</textarea></div>' +
      '<div class="ub-confirm-btns">' +
        '<button type="button" class="ub-confirm-btn ub-confirm-btn-cancel">取消</button>' +
        '<button type="button" class="ub-confirm-btn ub-confirm-btn-ok">添加到技能表</button>' +
      '</div>' +
    '</div>';
  const { overlay } = openDialog(body, { focusSel: '#skGainName' });
  const nameEl = overlay.querySelector('#skGainName') as HTMLInputElement | null;
  const typeEl = overlay.querySelector('#skGainType') as HTMLSelectElement | null;
  const descEl = overlay.querySelector('#skGainDesc') as HTMLTextAreaElement | null;
  const okBtn = overlay.querySelector('.ub-confirm-btn-ok') as HTMLButtonElement | null;
  const syncOkDisabled = (): void => { if (okBtn) okBtn.disabled = !(nameEl?.value || '').trim(); };
  syncOkDisabled();
  nameEl?.addEventListener('input', syncOkDisabled);

  const submit = async (): Promise<void> => {
    const plan = normalizeSkillManualInput({
      name: nameEl?.value || '',
      type: typeEl?.value || '',
      desc: descEl?.value || '',
    });
    if (!plan) return;
    if (skillNameExists(readSkillNameSet(), plan.name)) {
      getToastr()?.warning(`技能表中已有「${plan.name}」，未重复添加`, '技能');
      return;
    }
    if (okBtn) setButtonBusy(okBtn, true, '添加中');
    const ok = await addRow(SKILL_TABLE_NAME, {
      [SKILL_COL.name]: plan.name,
      [SKILL_COL.type]: plan.type,
      [SKILL_COL.exp]: '0',
      [SKILL_COL.desc]: plan.desc,
    });
    if (!ok) {
      if (okBtn) setButtonBusy(okBtn, false, '');
      getToastr()?.error('添加失败（技能表不可用？）', '技能');
      return;
    }
    try { await syncSkillWorldbook(); } catch (_e) { /* best-effort：世界书同步失败不阻断入库 */ }
    getToastr()?.success(`✦ 已添加技能：${plan.name}（${plan.type}）`, '技能');
    closeDialog(overlay);
  };

  overlay.onclick = (e) => {
    if ((e.target as HTMLElement) === overlay) { if (guardGhostClick()) return; closeDialog(overlay); return; }
    if ((e.target as HTMLElement).closest('.ub-confirm-btn-cancel')) { closeDialog(overlay); return; }
    if ((e.target as HTMLElement).closest('.ub-confirm-btn-ok')) { void submit(); return; }
  };
  overlay.onkeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeDialog(overlay); return; }
    // 描述框里的回车属于换行；名称/类别上回车=确认
    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); void submit(); }
  };
}
