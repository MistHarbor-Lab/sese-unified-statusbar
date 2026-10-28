import { getToastr } from './env';
// core/skill-table-ensure.ts
// 校验「主角技能表」是否已存在：存在则补登聊天表单指南（数据库插件指南权威化）；
// 不存在则**不自动建表**——由调用方决定提示与是否禁止开启（见 panels/config-panel.ts 总开关）。
//
// 为什么仍需"补登指南"——详见 docs/superpowers/plans/2026-07-18-skill-table-workbench-fix.md：
//   数据库插件有两套"表清单"：
//     A. currentJsonTableData_ACU（运行时数据）—— exportTableAsJson() 读取。
//     B. chat sheet guide（聊天表单指南）—— 填表工作台/手动填表的表清单来源，按指南过滤。
//   数据库插件 refreshMergedDataAndNotify 重放时 applyGuideStructureBeforeReplay_ACU 用 B 权威覆写
//   A 的每表 updateConfig 与表清单——指南没登记的表会被 getSortedSheetKeys 过滤丢弃。
//   解法：表已存在时，用公开 API importTemplateFromData({scope:'chat'}) 重建指南
//   （封装于 table-manager.syncChatSheetGuide），让指南层也认得这张表。仅传结构、不传数据、不重灌种子、不清现有数据。
//
// 取消自动建表（2026-07-18）：原 !exists 分支会 importTableAsJson 自动添加技能表，但用户希望
// 无表时改为提示「请进行表格修复」并禁止开启功能，而非静默自动建表。建表交给「数据库模板修复」入口。
import { getAutoCardAPI, invalidateCache } from './data-manager';
import { missingTableRepairHint } from './ledger-takeover';
import { setTableClosed, syncChatSheetGuide } from './table-manager';
import { SKILL_TABLE_NAME } from './skill-types';


/** 确保指南层登记了「主角技能表」：用含技能表的 localData 重建聊天表单指南。
 *  幂等：exportTableAsJson() 经聊天指南过滤，若已能从中读到技能表，说明指南已登记，直接跳过
 *  （避免反复触发 importTemplateFromData 的 chat_override 副作用）；否则用 localData 重建指南。
 *  localData 必须含技能表（由调用方保证表已存在）。
 *  注意：不能用 exportTableAsJson() 作为重建来源——数据库插件经指南过滤已不含未登记的技能表，
 *  重建出来的指南仍会缺技能表。必须用上层已含技能表的 localData。 */
async function ensureSkillTableInGuide(localData: any): Promise<void> {
  const api = getAutoCardAPI();
  if (!api || typeof api.exportTableAsJson !== 'function') return;
  if (!localData || typeof localData !== 'object') return;
  const hasSkillLocal = Object.keys(localData).some(k => k.startsWith('sheet_') && localData[k]?.name === SKILL_TABLE_NAME);
  if (!hasSkillLocal) return; // localData 无技能表，无可重建
  // exportTableAsJson() 经聊天指南过滤：若已含技能表，说明指南已登记，无需重建
  let exported: any = null;
  try { exported = api.exportTableAsJson(); } catch { exported = null; }
  const hasSkillInGuide = !!exported && Object.keys(exported).some(k => k.startsWith('sheet_') && exported[k]?.name === SKILL_TABLE_NAME);
  if (hasSkillInGuide) return;
  // 指南缺技能表 → 用 localData（含技能表）重建指南层
  await syncChatSheetGuide(localData);
  invalidateCache();
  try { api._notifyTableUpdate?.(); } catch { /* ignore */ }
}

/** 校验「主角技能表」是否存在并确保指南登记。
 *  - 表存在：补登聊天表单指南（数据库插件指南权威化，每对话首次幂等），返回 true。
 *  - 表不存在：**不自动建表**，返回 false；opts.promptOnMissing=true（功能开启场景）则弹对应提示。
 *  - API 未就绪/读取失败：返回 false；promptOnMissing=true 时弹提示。
 *  被动调用（index.ts 渲染/聊天切换）不传 promptOnMissing，保持静默。 */
export async function ensureSkillTable(opts?: { promptOnMissing?: boolean }): Promise<boolean> {
  const api = getAutoCardAPI();
  if (!api || typeof api.exportTableAsJson !== 'function') {
    if (opts?.promptOnMissing) getToastr()?.warning('表格后端未就绪（真数据库 / 瑟瑟台账），请稍后再试', '技能');
    return false;
  }
  let data: any = null;
  try { data = api.exportTableAsJson(); } catch (_e) { data = null; }
  if (!data || typeof data !== 'object') {
    if (opts?.promptOnMissing) getToastr()?.warning('读取数据库失败，请稍后再试', '技能');
    return false;
  }
  const exists = Object.values(data).some((s: any) => s && typeof s === 'object' && s.name === SKILL_TABLE_NAME);
  if (!exists) {
    if (opts?.promptOnMissing) getToastr()?.warning(`当前无「主角技能表」，请先${missingTableRepairHint()}后再开启`, '技能');
    return false;
  }
  // 表已存在 → 确保指南层也登记了本表（数据库插件指南权威覆写，不重建则技能表被指南过滤丢弃、
  // 工作台/手动填表看不到）。用含技能表的 data 重建指南（幂等）。
  await ensureSkillTableInGuide(data);
  return true;
}

/** 开/关「主角技能表」自动更新（关闭=分组3频率0；开启=恢复分组与频率-1，对齐 table-manager.setTableClosed）。
 *  表不存在时 setTableClosed 安全跳过。数据库插件 setTableClosed 内部已重建指南，开关状态存活过重放。 */
export async function setSkillTableEnabled(enabled: boolean): Promise<void> {
  try {
    await setTableClosed('sheet_protagonist_skills', !enabled);
  } catch (e) {
    console.warn('[技能] 切换表格开关异常:', e);
  }
}