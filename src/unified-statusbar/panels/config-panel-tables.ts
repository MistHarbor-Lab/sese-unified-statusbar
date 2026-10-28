// panels/config-panel-tables.ts
// 「表格」标签页内容渲染（自 config-panel.ts 迁出，S3-1；纯函数：按当前表格状态返回 HTML 字符串）。
//
// 台账模式（SeseLedgerAPI 接管、真数据库不在场）下本页整体退役：模板/分组调度/表格开关/
// 数据库模板修复/存量迁移都已在台账工作台实现，此处再操作会与台账模板定义互相覆盖。
// 退役页见 renderLedgerRetiredPage（core/ledger-takeover.ts 提供判据与工作台入口）。

import { DB_TEMPLATE_VERSION } from '../core/constants';
import { getConfig } from '../core/config-store';
import { readTableStatuses } from '../core/table-manager';
import { ensureStandardTemplate } from '../core/db-standard-template';
import { ubIcon } from '../core/icons';
import { helpTipButton } from '../renderers/html-builder';
import { isLedgerTakeover } from '../core/ledger-takeover';
import { escAttr as _escAttr, sv } from './config-panel-shared';

/** 台账模式的退役页：只说明去向，不提供任何表格操作。 */
function renderLedgerRetiredPage(): string {
  const V = sv();
  let html = '<div style="padding:14px 10px;display:flex;flex-direction:column;gap:10px;font-size:12px;color:' + V.text + ';">';
  html += '<div style="font-size:13px;font-weight:600;">' + ubIcon('warning') + ' 表格功能已退役（瑟瑟台账接管）</div>';
  html += '<div style="line-height:1.7;">检测到瑟瑟台账已接管表格后端：本页原有的表结构模板、分组调度、表格开关、数据库模板修复、存量迁移已全部由台账工作台承担，继续在此操作会与台账的模板定义互相覆盖，故整体退役。</div>';
  html += '<div style="line-height:1.9;color:var(--text-muted,var(--sweet-text-muted,#999));">';
  html += '· 表结构 / 模板编辑 → 台账 · 表格<br>';
  html += '· 分组与更新节奏 → 台账 · 表格（分组）<br>';
  html += '· 手动填表 / 范围填表 → 台账 · 填表<br>';
  html += '· 剧情推进 → 台账 · 推进<br>';
  html += '· 查看 / 否决 / 回滚数据 → 台账 · 时光机<br>';
  html += '· 存量数据迁移 → 台账 · 迁移';
  html += '</div>';
  html += '<div><button id="ubLedgerWorkbenchBtn" style="font-size:12px;padding:6px 14px;border:1px solid ' + V.border + ';border-radius:6px;cursor:pointer;background:' + V.bg + ';color:' + V.text + ';">打开瑟瑟台账工作台</button></div>';
  html += '<div style="font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));">真数据库（AutoCardUpdater 插件）在场时本页自动恢复为原有功能。</div>';
  html += '</div>';
  return html;
}

/**
 * 渲染「表格」标签页内容。
 *
 * 设计要点：
 * - 台账模式（isLedgerTakeover）→ 直接出退役页，其余分支全部不可达；
 * - CSS 用 `<style>` 内联块作用域到 #tab-tables，避免污染其他标签页；
 * - 全部用 CSS 变量做主题兼容（var(--card)→var(--sweet-card)→var(--jade-surface-1)→#fff 链式回退）；
 * - 懒加载：仅在用户首次切到该 tab 时调用本函数；
 * - 状态灯：分组1=绿、2=黄、3=红；
 * - 不一致（分组3且频率≠0，或频率0且分组≠3）→ 显示 警告图标，点击 confirm 后调用 fixInconsistent；
 * - 关闭按钮：先 confirm 弹出 getCloseImpact 的功能影响清单，确认后 setTableClosed(true)。
 */
export function renderTablesTab(): string {
  if (isLedgerTakeover()) return renderLedgerRetiredPage();
  // O39 惰性装载兜底点火：本 tab 的「标准修复/无过滤修复/模板导入」三个按钮都要标准模板，
  // 渲染时即预装（毫秒级、包内动态 import 零网络），用户点按钮时已就绪。
  void ensureStandardTemplate();
  const rows = readTableStatuses();
  if (!rows.length) {
    return '<div style="padding:12px;color:var(--text-muted,#999);font-size:12px;">数据库 API 不可用或未加载模板</div>';
  }

  let html = '<style>';
  html += '#tab-tables .tbl-list{display:flex;flex-direction:column;gap:0;}';
  html += '#tab-tables .tbl-row{display:flex;align-items:center;gap:6px;padding:6px 4px;border-bottom:1px solid var(--divider,var(--sweet-border,#e0e0e0));font-size:12px;}';
  html += '#tab-tables .tbl-light{font-size:11px;line-height:1;flex-shrink:0;}';
  html += '#tab-tables .tbl-light-green{color:#4caf50;}';
  html += '#tab-tables .tbl-light-yellow{color:#ffb300;}';
  html += '#tab-tables .tbl-light-red{color:var(--danger,#e53935);}';
  html += '#tab-tables .tbl-warn-emoji{cursor:pointer;font-size:13px;flex-shrink:0;}';
  html += '#tab-tables .tbl-warn-placeholder{display:inline-block;width:13px;flex-shrink:0;}';
  html += '#tab-tables .tbl-name{flex:1;color:var(--text,var(--sweet-text,#111));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}';
  html += '#tab-tables .tbl-meta{font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));white-space:nowrap;flex-shrink:0;}';
  html += '#tab-tables .tbl-toggle{font-size:11px;padding:3px 10px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:4px;cursor:pointer;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));flex-shrink:0;}';
  html += '#tab-tables .tbl-toggle:disabled{opacity:0.6;cursor:default;}';
  html += '#tab-tables .tbl-toggle-off{color:var(--danger,#e53935);}';
  html += '#tab-tables .tbl-toggle-on{color:#4caf50;}';
  // 分组模式分段开关
  html += '#tab-tables .tbl-mode-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 4px;border-bottom:1px solid var(--divider,var(--sweet-border,#e0e0e0));margin-bottom:6px;}';
  html += '#tab-tables .tbl-mode-label{font-size:12px;color:var(--text,var(--sweet-text,#111));display:flex;align-items:center;gap:4px;}';
  html += '#tab-tables .tbl-mode-seg{display:inline-flex;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:6px;overflow:hidden;}';
  html += '#tab-tables .tbl-mode-btn{font-size:11px;padding:4px 12px;border:none;line-height:1.5;cursor:pointer;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-right:1px solid var(--divider,var(--sweet-border,#e0e0e0));}';
  html += '#tab-tables .tbl-mode-btn:last-child{border-right:none;}';
  html += '#tab-tables .tbl-mode-btn.active{background:var(--text,var(--sweet-text,#111));color:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));font-weight:600;}';
  html += '#tab-tables .tbl-mode-btn:disabled{opacity:0.6;cursor:default;}';
  html += '#tab-tables .tbl-mode-desc{font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));width:100%;line-height:1.5;}';
  html += '</style>';

  // 分组模式切换（分组版 / 非分组版）
  const groupMode = getConfig().tableGroupMode;
  html += '<div class="tbl-mode-row">';
  html += '<span class="tbl-mode-label">表格分组模式' + (helpTipButton('表格分组模式：\\n分组版：每张表使用各自预设分组（部分表分组1、部分表分组2），按不同节奏更新。\\n非分组版：所有未关闭的表统一归到分组1。\\n已关闭的表（更新频率为0）不参与切换。\\n切换只改分组，不改更新频率。') ) + '</span>';
  html += '<div class="tbl-mode-seg">';
  html += '<button class="tbl-mode-btn' + (groupMode === 'grouped' ? ' active' : '') + '" data-mode="grouped">分组版</button>';
  html += '<button class="tbl-mode-btn' + (groupMode === 'flat' ? ' active' : '') + '" data-mode="flat">非分组版</button>';
  html += '</div>';
  html += `<span class="tbl-mode-desc">当前模板版本号：${DB_TEMPLATE_VERSION}，非分组版：所有表归分组1；分组版：恢复各表预设分组。已关闭的表不参与。</span>`;
  html += '</div>';

  // 模板导入（纯导入全局预设，不做修复、不碰当前对话数据）——与下方修复区块严格区分
  html += '<div class="tbl-repair-row" style="padding:8px 4px;border-bottom:1px solid var(--divider,var(--sweet-border,#e0e0e0))">';
  html += '<div style="font-size:11px;font-weight:600;color:var(--text,var(--sweet-text,#111));margin-bottom:6px;">' + ubIcon('download') + ' 模板导入为全局预设' + (helpTipButton('把状态栏标准模板存为数据库插件的全局模板预设并设为默认。\\n可选择分组版/非分组版与标准版/8.9.2以下适配版（无角色过滤）。\\n仅导入预设，不修复不迁移，不影响当前对话数据和状态栏设置；新开对话才使用新模板。') ) + '</div>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
  html += '<button class="tbl-repair-btn" id="ubTplPresetImportBtn" style="font-size:11px;padding:5px 12px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:6px;cursor:pointer;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));">' + ubIcon('download') + ' 导入模板为全局预设…</button>';
  html += '</div>';
  html += '<div style="font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));margin-top:6px;">安全操作：只把模板存为数据库「全局模板预设」并设为默认，不影响当前对话的任何数据。</div>';
  html += '</div>';

  html += '<div class="tbl-repair-row" style="padding:8px 4px;border-bottom:1px solid var(--divider,var(--sweet-border,#e0e0e0))">';
  html += '<div style="font-size:11px;font-weight:600;color:var(--danger,#e53935);margin-bottom:6px;">' + ubIcon('warning') + ' 数据库模板修复 —— 会覆盖并迁移当前对话数据，不可撤销</div>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
  html += `<button class="tbl-repair-btn" id="ubDbRepairBtn" style="font-size:11px;padding:5px 12px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:6px;cursor:pointer;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));" title="以标准模板（${DB_TEMPLATE_VERSION}）为基准比对当前数据库并迁移数据，覆盖当前对话。角色过滤功能仅定制版和8.8.2以上版本支持">${ubIcon('wrench')} 标准修复（带角色过滤）</button>`;
  html += `<button class="tbl-repair-btn" id="ubDbRepairNoFilterBtn" style="font-size:11px;padding:5px 12px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:6px;cursor:pointer;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));" title="以无角色过滤版模板为基准比对迁移（清空恋爱对象/重要角色/NSFW信息/人物性格偏移/角色里程碑的发送模板，兼容老版插件）；其他版本选择此表；修复后把无角色过滤版模板存为全局默认预设">${ubIcon('wrench')} 无角色过滤修复（8.9.2以下适配）</button>`;
  html += `<button class="tbl-repair-btn" id="ubDbRepairImportBtn" style="font-size:11px;padding:5px 12px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:6px;cursor:pointer;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));" title="从本地 JSON 文件或已有模板预设导入任意模板作为修复标准，覆盖当前对话数据库（仅当前对话，不改全局默认）">${ubIcon('wrench')} 导入任意模板修复</button>`;
  html += '</div>';
  html += '</div>';

  // ── 临时工具：年龄->生日转换（旧库存量「XX岁」残留迁移用）──
  // 临时功能（未来删除）：新库全面覆盖后，连同本区块与下方点击处理、core/age-to-birthday-migration.ts 一起删除。
  html += '<div class="tbl-repair-row" style="padding:8px 4px;border-bottom:1px solid var(--divider,var(--sweet-border,#e0e0e0))">';
  html += '<div style="font-size:11px;font-weight:600;color:var(--text,var(--sweet-text,#111));margin-bottom:6px;">' + ubIcon('wrench') + ' 年龄-&gt;生日转换（临时）' + (helpTipButton('把主角信息表/恋爱对象表/重要角色表三张表生日列里残留的“XX岁”年龄文本，按剧情当前日期（全局数据表当前时间，缺失时用现实日期）+ 该年龄随机生成一个生日（YYYY-MM-DD）替换写回。\\n只动年龄形态的残留格，已是日期的生日值原样保留。\\n适用于先跑了旧版模板、后经「数据库模板修复」迁到生日列的旧存档。\\n临时迁移工具，未来版本稳定后移除。') ) + '</div>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
  html += '<button class="tbl-repair-btn" id="ubAgeToBirthdayBtn" style="font-size:11px;padding:5px 12px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:6px;cursor:pointer;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));">' + ubIcon('wrench') + ' 年龄-&gt;生日转换</button>';
  html += '</div>';
  html += '<div style="font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));margin-top:6px;">把三张角色表生日列残留的“XX岁”按当前日期+年龄随机生成生日替换。已是日期的值不动。</div>';
  html += '</div>';

  html += '<div class="group-title">数据库表格状态</div>';
  html += '<div class="tbl-list">';
  for (const r of rows) {
    const lightClass = r.groupId === 1 ? 'green' : r.groupId === 2 ? 'yellow' : 'red';
    const lightTitle = '分组 ' + r.groupId + (r.isClosed ? '（已关闭）' : '');
    html += '<div class="tbl-row" data-sheet-key="' + _escAttr(r.sheetKey) + '">';
    html += '<span class="tbl-light tbl-light-' + lightClass + '" title="' + _escAttr(lightTitle) + '">●</span>';
    if (r.isInconsistent) {
      html += '<span class="tbl-warn-emoji" data-sheet-key="' + _escAttr(r.sheetKey) + '" title="状态不一致，点击修正">' + ubIcon('warning') + '</span>';
    } else {
      html += '<span class="tbl-warn-placeholder"></span>';
    }
    html += '<span class="tbl-name">' + _escAttr(r.name) + '</span>';
    html += '<span class="tbl-meta">分组 ' + r.groupId + ' · 频率 ' + r.updateFrequency + '</span>';
    if (r.isClosed) {
      html += '<button class="tbl-toggle tbl-toggle-on" data-action="open" data-sheet-key="' + _escAttr(r.sheetKey) + '">开启</button>';
    } else {
      html += '<button class="tbl-toggle tbl-toggle-off" data-action="close" data-sheet-key="' + _escAttr(r.sheetKey) + '">关闭</button>';
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}
