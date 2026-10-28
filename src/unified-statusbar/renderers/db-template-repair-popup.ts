import { getToastr } from '../core/env';
import { triggerBlobDownload } from '../core/zip-store';
import { ubIcon } from '../core/icons';
// renderers/db-template-repair-popup.ts
// 数据库模板修复检测报告弹窗。复用 #panelOverlay。视觉按 Task 6 mockup 定稿（ub-repair-* 为基线）。
import type { RepairPlan, RepairStandard, SheetPlan } from '../core/db-template-repair';
import { applyRepairPlan, validateImportedTemplate, STANDARD_REPAIR } from '../core/db-template-repair';
import { getAutoCardAPI } from '../core/data-manager';
import { getConfig } from '../core/config-store';
import { syncDarkClass, closePanelOverlay, guardGhostClick, markPopupShown } from './html-builder';
import { confirmMessage } from './confirm-dialog';
import { escapeHtml as esc } from '../core/html-escape';

// 本弹窗族临时把常驻 #panelOverlay 的 z-index 提到 10003；关闭时须还原内联值，
// 否则之后所有弹窗的 z-index 永久变为 10003，破坏与 db 行详情(10010)/确认层(10020)的层级。
function closeDbRepairOverlay(overlay: HTMLElement): void {
  overlay.style.zIndex = '';
  closePanelOverlay(overlay);
}

function renderCase1(sheets: SheetPlan[]): string {
  const list = sheets.filter((s) => s.case === 1);
  if (!list.length) return '';
  return `<details class="ub-repair-case"><summary>${ubIcon('check')} 一致（${list.length}）——全数据保留</summary><div class="ub-repair-case-body">${
    list.map((s) => `<div class="ub-repair-row">${esc(s.currentName)} · 保留 ${s.migratedRowCount ?? 0} 行</div>`).join('')
  }</div></details>`;
}

function renderCase2(sheets: SheetPlan[]): string {
  const list = sheets.filter((s) => s.case === 2);
  if (!list.length) return '';
  return `<details class="ub-repair-case" open><summary>${ubIcon('warning')} 列调整（${list.length}）——保留可用数据</summary><div class="ub-repair-case-body">${
    list.map((s) => {
      const c = s.cols!;
      return `<div class="ub-repair-row ub-repair-c2">
        <div class="ub-repair-name">${esc(s.standardName)} · 保留 ${s.migratedRowCount ?? 0} 行 · 丢弃 ${c.dropped.length} 列内容</div>
        <div class="ub-repair-cols">
          ${c.missing.length ? `<span class="ub-repair-col add">+ ${esc(c.missing.join(', '))}</span>` : ''}
          ${c.dropped.length ? `<span class="ub-repair-col drop">− ${esc(c.dropped.join(', '))}</span>` : ''}
          ${(c.aliases && c.aliases.length) ? c.aliases.map(([cur, std]) => `<span class="ub-repair-col alias">⇄ ${esc(cur)} → ${esc(std)}</span>`).join('') : ''}
        </div></div>`;
    }).join('')
  }</div></details>`;
}

function renderCase3(sheets: SheetPlan[]): string {
  const list = sheets.filter((s) => s.case === 3);
  if (!list.length) return '';
  return `<details class="ub-repair-case" open><summary>${ubIcon('plus')} 多余表（${list.length}）——由你决定去留</summary>
    <div class="ub-repair-case-body">
      <div class="ub-repair-bulk"><button class="ub-repair-bulk-btn" id="ubDbRepairKeepAll">全部保留</button><button class="ub-repair-bulk-btn" id="ubDbRepairDelAll">全部删除</button></div>
      ${list.map((s) => `<div class="ub-repair-row ub-repair-c3" data-sheet-key="${esc(s.sheetKey)}"><span class="ub-repair-name">${esc(s.currentName)}</span><span class="ub-repair-sp"></span><button class="ub-repair-toggle ${s.keep ? 'on' : 'off'}" data-sheet-key="${esc(s.sheetKey)}">${s.keep ? '保留' : '删除'}</button></div>`).join('')}
    </div></details>`;
}

function renderCase4(sheets: SheetPlan[]): string {
  const list = sheets.filter((s) => s.case === 4);
  if (!list.length) return '';
  return `<details class="ub-repair-case"><summary>🆕 待建空表（${list.length}）</summary><div class="ub-repair-case-body">${
    list.map((s) => `<div class="ub-repair-row">${esc(s.standardName)}</div>`).join('')
  }</div></details>`;
}

function renderLengthOverflow(plan: RepairPlan): string {
  const overflow = plan.lengthOverflow;
  if (!overflow.rowCount) return '<div class="ub-repair-length-none">字数超限：无</div>';
  return `<details class="ub-repair-case ub-repair-length" open>
    <summary>${ubIcon('warning')} 字数超限（共 ${overflow.rowCount} 行）——修复时将自动截断</summary>
    <div class="ub-repair-case-body">${overflow.items.map((item) =>
      `<div class="ub-repair-row">${esc(item.sheetName)} / ${esc(item.columnName)}：${item.rowCount} 行</div>`
    ).join('')}</div>
  </details>`;
}

export function showDbRepairPopup(plan: RepairPlan, standard: RepairStandard = STANDARD_REPAIR): void {
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  const sm = plan.summary;
  let backedUp = false;
  const confirmLabel = '未导出备份，确认修复';
  const setConfirmLabel = () => {
    const btn = document.getElementById('ubDbRepairConfirm') as HTMLButtonElement | null;
    if (btn) btn.textContent = backedUp ? '确认修复' : '未导出备份，确认修复';
  };
  const bridgeClass = getConfig().style === 'bridge' ? ' bridge-window bridge-module-db-repair' : '';
  overlay.innerHTML = `<div class="panel-popup ub-repair-popup${bridgeClass}" id="ubDbRepairOverlay">
    <style scoped>
      #ubDbRepairOverlay{max-width:560px;margin:8px auto;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:10px;overflow:hidden;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));max-height:88vh;max-height:88dvh;display:flex;flex-direction:column}
      #ubDbRepairOverlay .ub-repair-head{display:flex;align-items:center;gap:6px;padding:10px 12px;background:var(--text,var(--sweet-text,#111));color:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)))}
      #ubDbRepairOverlay .ub-repair-title{font-size:14px;font-weight:600;flex:1}
      #ubDbRepairOverlay .ub-repair-warn{margin:8px 10px;padding:8px 10px;background:rgba(229,57,53,.12);border:1px solid #e53935;border-radius:6px;color:#e53935;font-size:11px;line-height:1.5}
      #ubDbRepairOverlay .ub-repair-tools{display:flex;gap:8px;padding:0 10px 4px}
      #ubDbRepairOverlay .ub-repair-backup{font-size:11px;padding:5px 10px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:6px;cursor:pointer;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111))}
      #ubDbRepairOverlay .ub-repair-backup:disabled{opacity:.5;cursor:default}
      #ubDbRepairOverlay .ub-repair-summary{font-size:11px;color:var(--text-muted,var(--sweet-text-muted,#999));padding:4px 12px 6px}
      #ubDbRepairOverlay .ub-repair-body{padding:0 10px 8px;overflow:auto;flex:1}
      #ubDbRepairOverlay .ub-repair-length-none{padding:5px 2px;font-size:11px;color:var(--text-muted,var(--sweet-text-muted,#999))}
      #ubDbRepairOverlay .ub-repair-case{border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:6px;margin:6px 0}
      #ubDbRepairOverlay .ub-repair-case summary{padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;color:var(--text,var(--sweet-text,#111))}
      #ubDbRepairOverlay .ub-repair-case-body{padding:4px 10px 8px}
      #ubDbRepairOverlay .ub-repair-row{display:flex;align-items:center;gap:6px;padding:4px 2px;font-size:11px;color:var(--text,var(--sweet-text,#111));border-bottom:1px dashed var(--divider,var(--sweet-border,#e0e0e0))}
      #ubDbRepairOverlay .ub-repair-row.ub-repair-c2{flex-direction:column;align-items:stretch;gap:4px}
      #ubDbRepairOverlay .ub-repair-row.ub-repair-c2 .ub-repair-name{flex:none}
      #ubDbRepairOverlay .ub-repair-col.alias{color:#3a5a7a}
      #ubDbRepairOverlay .ub-repair-row:last-child{border-bottom:none}
      #ubDbRepairOverlay .ub-repair-sp{flex:1}
      #ubDbRepairOverlay .ub-repair-name{flex:1}
      #ubDbRepairOverlay .ub-repair-cols{display:flex;gap:8px;flex-wrap:wrap;font-size:10px}
      #ubDbRepairOverlay .ub-repair-col.add{color:#2e7d32}#ubDbRepairOverlay .ub-repair-col.drop{color:#e53935}
      #ubDbRepairOverlay .ub-repair-alias{font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999))}
      #ubDbRepairOverlay .ub-repair-bulk{display:flex;gap:8px;margin-bottom:4px}
      #ubDbRepairOverlay .ub-repair-bulk-btn{font-size:11px;padding:3px 10px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:5px;cursor:pointer;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111))}
      #ubDbRepairOverlay .ub-repair-toggle{font-size:11px;padding:3px 10px;border-radius:5px;cursor:pointer;border:1px solid}
      #ubDbRepairOverlay .ub-repair-toggle.on{background:#2e7d32;color:#fff;border-color:#2e7d32}
      #ubDbRepairOverlay .ub-repair-toggle.off{background:#e53935;color:#fff;border-color:#e53935}
      /* 深色：alias 深蓝/add 深绿/drop 深红在深色底对比不足，提亮 */
      #ubDbRepairOverlay.dark .ub-repair-col.alias{color:#5a8aaa}
      #ubDbRepairOverlay.dark .ub-repair-col.add{color:#4caf50}
      #ubDbRepairOverlay.dark .ub-repair-col.drop{color:#ef5350}
      #ubDbRepairOverlay .ub-repair-foot{display:flex;gap:8px;justify-content:flex-end;padding:8px 12px;border-top:1px solid var(--divider,var(--sweet-border,#e0e0e0))}
      #ubDbRepairOverlay .ub-repair-btn{font-size:12px;padding:6px 16px;border-radius:6px;cursor:pointer;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111))}
      #ubDbRepairOverlay #ubDbRepairConfirm{background:#e53935;color:#fff;border-color:#e53935}
    </style>
    <div class="ub-repair-head"><span class="ub-repair-title">数据库模板修复 · ${esc(standard.subtitle)}</span><button class="settings-popup-close" id="panelClose" style="color:inherit;background:transparent;border:none;font-size:18px;cursor:pointer">×</button></div>
    <div class="ub-repair-warn">${ubIcon('warning')} 此操作将覆盖当前对话数据库，不可撤销。建议先导出备份。</div>
    <div class="ub-repair-tools"><button class="ub-repair-backup" id="ubDbRepairBackup">${ubIcon('download')} 先导出备份</button></div>
    <div class="ub-repair-summary">检测 ${plan.sheets.length} 张表 · 一致 ${sm.case1} · 列调整 ${sm.case2} · 多余 ${sm.case3} · 待建 ${sm.case4} · 保留 ${sm.rowsKept} 行 · 丢弃 ${sm.droppedColumnCount} 列内容 · 字数超限 ${plan.lengthOverflow.rowCount ? plan.lengthOverflow.rowCount + ' 行' : '无'}</div>
    <div class="ub-repair-body">
      ${renderLengthOverflow(plan)}
      ${renderCase1(plan.sheets)}
      ${renderCase2(plan.sheets)}
      ${renderCase3(plan.sheets)}
      ${renderCase4(plan.sheets)}
    </div>
    <div class="ub-repair-foot"><button class="ub-repair-btn" id="ubDbRepairCancel">取消</button><button class="ub-repair-btn" id="ubDbRepairConfirm">${confirmLabel}</button></div>
  </div>`;
  syncDarkClass(overlay); markPopupShown(); overlay.style.zIndex = '10003'; overlay.classList.add('show');

  const planRef = plan; // Case3 keep 状态直接改 plan.sheets 引用

  overlay.onclick = async (e: MouseEvent) => {
    if (e.target === overlay || (e.target as HTMLElement).id === 'panelClose') {
      if (guardGhostClick()) return; closeDbRepairOverlay(overlay); return;
    }
    const el = e.target as HTMLElement;
    if (el.closest('#ubDbRepairCancel') || el.id === 'ubDbRepairCancel') { closeDbRepairOverlay(overlay); return; }
    if (el.closest('#ubDbRepairBackup') || el.id === 'ubDbRepairBackup') {
      const api = getAutoCardAPI();
      if (api && typeof api.exportJsonData === 'function') {
        try { await api.exportJsonData(); (el.closest('#ubDbRepairBackup') as HTMLButtonElement).disabled = true; (el.closest('#ubDbRepairBackup') as HTMLButtonElement).textContent = '已导出备份'; backedUp = true; setConfirmLabel(); } catch (err) { getToastr()?.warning('导出失败：' + String(err)); }
      } else {
        // V-B 兜底：Blob 下载 exportTableAsJson
        try {
          const data = api?.exportTableAsJson ? api.exportTableAsJson() : null;
          if (!data) { getToastr()?.warning('导出失败：无数据'); return; }
          const blob = new (window as any).Blob([JSON.stringify(data)], { type: 'application/json' });
          triggerBlobDownload(blob, '统一状态栏-数据库备份.json'); // U36：下载收编规范口
          (el.closest('#ubDbRepairBackup') as HTMLButtonElement).disabled = true; (el.closest('#ubDbRepairBackup') as HTMLButtonElement).textContent = '已导出备份'; backedUp = true; setConfirmLabel();
        } catch (err) { getToastr()?.warning('导出失败：' + String(err)); }
      }
      return;
    }
    if (el.closest('#ubDbRepairKeepAll') || el.id === 'ubDbRepairKeepAll') {
      planRef.sheets.filter((s) => s.case === 3).forEach((s) => s.keep = true);
      overlay.querySelectorAll<HTMLButtonElement>('.ub-repair-toggle').forEach((b) => { b.classList.add('on'); b.classList.remove('off'); b.textContent = '保留'; });
      return;
    }
    if (el.closest('#ubDbRepairDelAll') || el.id === 'ubDbRepairDelAll') {
      planRef.sheets.filter((s) => s.case === 3).forEach((s) => s.keep = false);
      overlay.querySelectorAll<HTMLButtonElement>('.ub-repair-toggle').forEach((b) => { b.classList.remove('on'); b.classList.add('off'); b.textContent = '删除'; });
      return;
    }
    const toggle = el.closest('.ub-repair-toggle') as HTMLElement | null;
    if (toggle) {
      const key = toggle.getAttribute('data-sheet-key') || '';
      const sp = planRef.sheets.find((s) => s.sheetKey === key && s.case === 3);
      if (sp) { sp.keep = !sp.keep; toggle.classList.toggle('on', sp.keep); toggle.classList.toggle('off', !sp.keep); toggle.textContent = sp.keep ? '保留' : '删除'; }
      return;
    }
    if (el.closest('#ubDbRepairConfirm') || el.id === 'ubDbRepairConfirm') {
      const btn = (document.getElementById('ubDbRepairConfirm') as HTMLButtonElement);
      if (btn) { btn.disabled = true; btn.textContent = '修复中…'; }
      const r = await applyRepairPlan(planRef, standard, confirmMessage);
      if (r.ok) {
        const truncatedRows = r.truncation?.rowCount || 0;
        getToastr()?.success(
          truncatedRows > 0 ? `数据库已对齐 ${standard.subtitle}，已自动截断 ${truncatedRows} 行超限数据` : `数据库已对齐 ${standard.subtitle}`,
          '数据库模板修复',
        );
        // 显式化插件 postCommitWarning（SQLite 运行时重建/刷新等非阻断告警），不静默吞
        if (r.warnings && r.warnings.length > 0) {
          getToastr()?.warning(r.warnings.join('；'), '数据库模板修复 · 插件告警');
        }
        closeDbRepairOverlay(overlay);
        // 清空表格 tab → 下次切到表格 tab 触发懒加载重渲（renderTablesTab 在 config-panel 内部自调）
        const tbl = document.getElementById('tab-tables');
        if (tbl) tbl.innerHTML = '';
      } else {
        getToastr()?.error(r.error || '修复失败', '数据库模板修复');
        if (btn) { btn.disabled = false; setConfirmLabel(); }
      }
      return;
    }
  };
}

/** 纯模板导入弹窗：两组分段选择（分组版/非分组版 × 标准版/无角色过滤）+ 说明 + 确认。
 *  只把所选模板存为数据库全局预设并设为默认，不做任何修复/迁移，不碰当前对话数据。 */
export function showTemplateImportPresetPopup(
  onConfirm: (variant: { grouped: boolean; noFilter: boolean }, subtitle: string) => void,
): void {
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  let grouped = false;
  let noFilter = false;
  const bridgeClass = getConfig().style === 'bridge' ? ' bridge-window bridge-module-db-repair' : '';
  overlay.innerHTML = `<div class="panel-popup ub-repair-popup${bridgeClass}" id="ubTplPresetOverlay">
    <style scoped>
      #ubTplPresetOverlay{max-width:460px;margin:8px auto;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:10px;overflow:hidden;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));max-height:88vh;max-height:88dvh;display:flex;flex-direction:column}
      #ubTplPresetOverlay .ub-repair-head{display:flex;align-items:center;gap:6px;padding:10px 12px;background:var(--text,var(--sweet-text,#111));color:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)))}
      #ubTplPresetOverlay .ub-repair-title{font-size:14px;font-weight:600;flex:1}
      #ubTplPresetOverlay .ub-import-body{padding:12px;display:flex;flex-direction:column;gap:12px;overflow:auto;flex:1}
      #ubTplPresetOverlay .ub-imp-label{font-size:12px;font-weight:600;color:var(--text,var(--sweet-text,#111));margin-bottom:6px}
      #ubTplPresetOverlay .ub-imp-seg{display:inline-flex;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:6px;overflow:hidden;width:100%}
      #ubTplPresetOverlay .ub-imp-btn{flex:1;font-size:11px;padding:6px 8px;border:none;line-height:1.5;cursor:pointer;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-right:1px solid var(--divider,var(--sweet-border,#e0e0e0))}
      #ubTplPresetOverlay .ub-imp-btn:last-child{border-right:none}
      #ubTplPresetOverlay .ub-imp-btn.active{background:var(--text,var(--sweet-text,#111));color:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));font-weight:600}
      #ubTplPresetOverlay .ub-imp-desc{font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));margin-top:4px;line-height:1.5}
      #ubTplPresetOverlay .ub-imp-note{font-size:11px;color:var(--text-muted,var(--sweet-text-muted,#999));line-height:1.5;padding:8px 10px;border:1px dashed var(--divider,var(--sweet-border,#e0e0e0));border-radius:6px}
      #ubTplPresetOverlay .ub-repair-btn{font-size:12px;padding:6px 16px;border-radius:6px;cursor:pointer;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111))}
      #ubTplPresetOverlay .ub-repair-btn:disabled{opacity:.5;cursor:default}
      #ubTplPresetOverlay #ubTplPresetConfirm{background:#2e7d32;color:#fff;border-color:#2e7d32}
      #ubTplPresetOverlay .ub-repair-foot{display:flex;gap:8px;justify-content:flex-end;padding:8px 12px;border-top:1px solid var(--divider,var(--sweet-border,#e0e0e0))}
    </style>
    <div class="ub-repair-head"><span class="ub-repair-title">模板导入为全局预设</span><button class="settings-popup-close" id="panelClose" style="color:inherit;background:transparent;border:none;font-size:18px;cursor:pointer">×</button></div>
    <div class="ub-import-body">
      <div>
        <div class="ub-imp-label">表格分组</div>
        <div class="ub-imp-seg">
          <button class="ub-imp-btn${grouped ? '' : ' active'}" data-grouped="0">非分组版</button>
          <button class="ub-imp-btn${grouped ? ' active' : ''}" data-grouped="1">分组版</button>
        </div>
        <div class="ub-imp-desc">非分组版：所有表归分组1，按同一节奏更新。分组版：角色相关表（主角/恋爱对象/重要角色等9张）归分组2、其余归分组1，按不同节奏更新。</div>
      </div>
      <div>
        <div class="ub-imp-label">兼容版本</div>
        <div class="ub-imp-seg">
          <button class="ub-imp-btn${noFilter ? '' : ' active'}" data-nofilter="0">标准版</button>
          <button class="ub-imp-btn${noFilter ? ' active' : ''}" data-nofilter="1">8.9.2以下适配版</button>
        </div>
        <div class="ub-imp-desc">标准版带角色过滤（仅定制版和8.8.2以上插件支持）。适配版清空5张角色相关表的发送模板（回退为整表发送），兼容不支持角色过滤的老版本插件；不确定时选这个。</div>
      </div>
      <div class="ub-imp-note">仅把所选模板存为数据库「全局模板预设」并设为当前默认，<b>不影响当前对话的任何数据</b>，也不改动状态栏设置。新开对话才会使用新模板。</div>
    </div>
    <div class="ub-repair-foot"><button class="ub-repair-btn" id="ubTplPresetCancel">取消</button><button class="ub-repair-btn" id="ubTplPresetConfirm">导入</button></div>
  </div>`;
  syncDarkClass(overlay); markPopupShown(); overlay.style.zIndex = '10003'; overlay.classList.add('show');

  const refreshSeg = () => {
    overlay.querySelectorAll<HTMLButtonElement>('.ub-imp-btn[data-grouped]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-grouped') === (grouped ? '1' : '0')));
    overlay.querySelectorAll<HTMLButtonElement>('.ub-imp-btn[data-nofilter]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-nofilter') === (noFilter ? '1' : '0')));
  };

  overlay.onclick = (e: MouseEvent) => {
    if (e.target === overlay || (e.target as HTMLElement).id === 'panelClose') { if (guardGhostClick()) return; closeDbRepairOverlay(overlay); return; }
    const el = e.target as HTMLElement;
    const gBtn = el.closest('.ub-imp-btn[data-grouped]') as HTMLElement | null;
    if (gBtn) { grouped = gBtn.getAttribute('data-grouped') === '1'; refreshSeg(); return; }
    const nBtn = el.closest('.ub-imp-btn[data-nofilter]') as HTMLElement | null;
    if (nBtn) { noFilter = nBtn.getAttribute('data-nofilter') === '1'; refreshSeg(); return; }
    if (el.closest('#ubTplPresetCancel') || el.id === 'ubTplPresetCancel') { closeDbRepairOverlay(overlay); return; }
    if (el.closest('#ubTplPresetConfirm') || el.id === 'ubTplPresetConfirm') {
      const subtitle = `${grouped ? '分组版' : '非分组版'}${noFilter ? ' · 无角色过滤' : ' · 标准版'}`;
      closeDbRepairOverlay(overlay);
      onConfirm({ grouped, noFilter }, subtitle);
      return;
    }
  };
}

/** 按钮 2「导入任意模板修复」的选择器弹窗：本地 JSON 文件 / 已有模板预设。
 *  选好并校验通过后回调 onChosen(template, subtitle)，由调用方继续走 buildRepairPlanFromCurrent → showDbRepairPopup。 */
export function showDbImportChooserPopup(onChosen: (template: any, subtitle: string) => void): void {
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  const bridgeClass = getConfig().style === 'bridge' ? ' bridge-window bridge-module-db-repair' : '';
  overlay.innerHTML = `<div class="panel-popup ub-repair-popup${bridgeClass}" id="ubDbImportOverlay">
    <style scoped>
      #ubDbImportOverlay{max-width:460px;margin:8px auto;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:10px;overflow:hidden;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));max-height:88vh;max-height:88dvh;display:flex;flex-direction:column}
      #ubDbImportOverlay .ub-repair-head{display:flex;align-items:center;gap:6px;padding:10px 12px;background:var(--text,var(--sweet-text,#111));color:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)))}
      #ubDbImportOverlay .ub-repair-title{font-size:14px;font-weight:600;flex:1}
      #ubDbImportOverlay .ub-repair-warn{margin:8px 10px;padding:8px 10px;background:rgba(229,57,53,.12);border:1px solid #e53935;border-radius:6px;color:#e53935;font-size:11px;line-height:1.5}
      #ubDbImportOverlay .ub-repair-body{padding:10px 12px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:10px}
      #ubDbImportOverlay .ub-import-section{border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:8px;padding:10px}
      #ubDbImportOverlay .ub-import-label{font-size:12px;font-weight:600;color:var(--text,var(--sweet-text,#111));margin-bottom:6px}
      #ubDbImportOverlay .ub-import-hint{font-size:11px;color:var(--text-muted,var(--sweet-text-muted,#999));margin-top:4px}
      #ubDbImportOverlay .ub-import-row{display:flex;gap:6px;align-items:center}
      #ubDbImportOverlay select{flex:1;font-size:11px;padding:4px 6px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:6px;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111))}
      #ubDbImportOverlay .ub-repair-btn{font-size:12px;padding:6px 12px;border-radius:6px;cursor:pointer;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111))}
      #ubDbImportOverlay .ub-repair-btn:disabled{opacity:.5;cursor:default}
      #ubDbImportOverlay .ub-repair-foot{display:flex;gap:8px;justify-content:flex-end;padding:8px 12px;border-top:1px solid var(--divider,var(--sweet-border,#e0e0e0))}
    </style>
    <div class="ub-repair-head"><span class="ub-repair-title">导入模板修复 · 选择模板来源</span><button class="settings-popup-close" id="panelClose" style="color:inherit;background:transparent;border:none;font-size:18px;cursor:pointer">×</button></div>
    <div class="ub-repair-warn">${ubIcon('warning')} 导入的模板将作为本次修复的"标准"，覆盖当前对话数据库。请确认来源可信（ORM/SQL 模板可执行，勿导入陌生来源）。</div>
    <div class="ub-repair-body">
      <div class="ub-import-section">
        <div class="ub-import-label">方式一：选择本地 JSON 文件</div>
        <div class="ub-import-row"><button class="ub-repair-btn" id="ubImportFile">${ubIcon('folder')} 选择文件…</button></div>
        <div class="ub-import-hint">数据库模板导出的 .json（chatSheets 结构）。</div>
        <input type="file" id="ubImportFileInput" accept=".json,application/json" style="display:none">
      </div>
      <div class="ub-import-section">
        <div class="ub-import-label">方式二：从已有模板预设选择</div>
        <div class="ub-import-row">
          <select id="ubImportPreset"></select>
          <button class="ub-repair-btn" id="ubImportPresetConfirm">使用该预设</button>
        </div>
        <div class="ub-import-hint">来自数据库插件全局模板预设库。</div>
      </div>
    </div>
    <div class="ub-repair-foot"><button class="ub-repair-btn" id="ubImportCancel">取消</button></div>
  </div>`;

  const api = getAutoCardAPI();
  const sel = overlay.querySelector<HTMLSelectElement>('#ubImportPreset');
  const presetConfirmBtn = overlay.querySelector<HTMLButtonElement>('#ubImportPresetConfirm');
  const names = (api && typeof api.getTemplatePresetNames === 'function') ? (api.getTemplatePresetNames() || []) : null;
  if (!names || !names.length) {
    if (sel) { sel.innerHTML = '<option value="">（无可用的全局预设）</option>'; sel.disabled = true; }
    if (presetConfirmBtn) presetConfirmBtn.disabled = true;
  } else {
    for (const n of names) { const o = document.createElement('option'); o.value = String(n); o.textContent = String(n); sel?.appendChild(o); }
  }

  syncDarkClass(overlay); markPopupShown(); overlay.style.zIndex = '10003'; overlay.classList.add('show');

  const finish = (tpl: any, subtitle: string) => { closeDbRepairOverlay(overlay); onChosen(tpl, subtitle); };

  overlay.onclick = (e: MouseEvent) => {
    if (e.target === overlay || (e.target as HTMLElement).id === 'panelClose') { if (guardGhostClick()) return; closeDbRepairOverlay(overlay); return; }
    const el = e.target as HTMLElement;
    if (el.closest('#ubImportCancel') || el.id === 'ubImportCancel') { closeDbRepairOverlay(overlay); return; }
    if (el.closest('#ubImportFile') || el.id === 'ubImportFile') {
      overlay.querySelector<HTMLInputElement>('#ubImportFileInput')?.click();
      return;
    }
    if (el.closest('#ubImportPresetConfirm') || el.id === 'ubImportPresetConfirm') {
      const name = sel?.value || '';
      if (!name) { getToastr()?.warning('请先选择一个预设'); return; }
      // getTableTemplate({scope:'global',presetName}) 读取指定预设的模板数据，无切换/重放副作用。
      // 注：presetName 选项在数据库插件公开 API 未文档化但受支持；旧版插件若忽略该参数会回退返回当前生效模板。
      const tpl = (api && typeof api.getTableTemplate === 'function') ? api.getTableTemplate({ scope: 'global', presetName: name }) : null;
      if (!tpl) { getToastr()?.error('读取预设失败：' + name); return; }
      const v = validateImportedTemplate(tpl);
      if (!v.ok) { getToastr()?.error(v.error || '预设不是合法模板'); return; }
      finish(tpl, `导入模板：${name}`);
      return;
    }
  };

  overlay.querySelector<HTMLInputElement>('#ubImportFileInput')?.addEventListener('change', async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const tpl = JSON.parse(text);
      const v = validateImportedTemplate(tpl);
      if (!v.ok) { getToastr()?.error(v.error || '文件不是合法模板'); return; }
      finish(tpl, `导入模板：${file.name.replace(/\.json$/i, '')}`);
    } catch (err: any) {
      getToastr()?.error('读取/解析文件失败：' + String(err?.message || err));
    }
  });
}
