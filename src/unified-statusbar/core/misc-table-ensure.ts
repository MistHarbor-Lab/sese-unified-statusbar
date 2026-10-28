import { getToastr } from './env';
// core/misc-table-ensure.ts
// 镜像 skill-table-ensure.ts：杂表存在则补登聊天表单指南（数据库插件指南权威化）；
// 不存在则**不自动建表**——由调用方决定提示（缺表指引走 ledger-takeover.missingTableRepairHint：
// 真数据库模式指向「设置 → 表格」的模板修复，台账模式指向台账工作台迁移页）。
//
// 为什么仍需"补登指南"——详见 core/skill-table-ensure.ts 同款注释：
//   数据库插件有两套"表清单"：
//     A. currentJsonTableData_ACU（运行时数据）—— exportTableAsJson() 读取。
//     B. chat sheet guide（聊天表单指南）—— 填表工作台/手动填表的表清单来源，按指南过滤。
//   数据库插件 refreshMergedDataAndNotify 重放时 applyGuideStructureBeforeReplay_ACU 用 B 权威覆写
//   A 的每表 updateConfig 与表清单——指南没登记的表会被 getSortedSheetKeys 过滤丢弃。
//   解法：表已存在时，用公开 API importTemplateFromData({scope:'chat'}) 重建指南
//   （封装于 table-manager.syncChatSheetGuide），让指南层也认得这张表。仅传结构、不传数据、不重灌种子、不清现有数据。
//
// 不自动建表：杂表缺失时返回 false，由调用方按 missingTableRepairHint 提示（台账模式下模板修复页已退役）。
// 建表交给该入口，避免在地图开关等被动场景静默自动建表。
import { getAutoCardAPI, invalidateCache } from './data-manager';
import { missingTableRepairHint } from './ledger-takeover';
import { syncChatSheetGuide } from './table-manager';

export const MISC_TABLE_NAME = '杂表';


/** 确保指南层登记了「杂表」：用含杂表的 localData 重建聊天表单指南。
 *  幂等：exportTableAsJson() 经聊天指南过滤，若已能从中读到杂表，说明指南已登记，直接跳过
 *  （避免反复触发 importTemplateFromData 的 chat_override 副作用）；否则用 localData 重建指南。
 *  localData 必须含杂表（由调用方保证表已存在）。
 *  注意：不能用 exportTableAsJson() 作为重建来源——数据库插件经指南过滤已不含未登记的杂表，
 *  重建出来的指南仍会缺杂表。必须用上层已含杂表的 localData。 */
async function ensureMiscTableInGuide(localData: any): Promise<void> {
  const api = getAutoCardAPI();
  if (!api || typeof api.exportTableAsJson !== 'function') return;
  if (!localData || typeof localData !== 'object') return;
  const hasMiscLocal = Object.keys(localData).some(k => k.startsWith('sheet_') && localData[k]?.name === MISC_TABLE_NAME);
  if (!hasMiscLocal) return; // localData 无杂表，无可重建
  // exportTableAsJson() 经聊天指南过滤：若已含杂表，说明指南已登记，无需重建
  let exported: any = null;
  try { exported = api.exportTableAsJson(); } catch { exported = null; }
  const hasMiscInGuide = !!exported && Object.keys(exported).some(k => k.startsWith('sheet_') && exported[k]?.name === MISC_TABLE_NAME);
  if (hasMiscInGuide) return;
  // 指南缺杂表 → 用 localData（含杂表）重建指南层
  await syncChatSheetGuide(localData);
  invalidateCache();
  try { api._notifyTableUpdate?.(); } catch { /* ignore */ }
}

/** 校验「杂表」是否存在并确保指南登记。
 *  - 表存在：补登聊天表单指南（数据库插件指南权威化，每对话首次幂等），返回 true。
 *  - 表不存在：**不自动建表**，返回 false；opts.promptOnMissing=true（功能开启场景）则弹对应提示。
 *  - API 未就绪/读取失败：返回 false；promptOnMissing=true 时弹提示。
 *  被动调用（如地图初始化/刷新）不传 promptOnMissing，保持静默。
 *  被 Task 4 syncMapOverviewToMiscTable 与 Task 8 mapToggle handler 调用。 */
export async function ensureMiscTable(opts?: { promptOnMissing?: boolean }): Promise<boolean> {
  const api = getAutoCardAPI();
  if (!api || typeof api.exportTableAsJson !== 'function') {
    if (opts?.promptOnMissing) getToastr()?.warning('表格后端未就绪（真数据库 / 瑟瑟台账），请稍后再试', '地图');
    return false;
  }
  let data: any = null;
  try { data = api.exportTableAsJson(); } catch (_e) { data = null; }
  if (!data || typeof data !== 'object') {
    if (opts?.promptOnMissing) getToastr()?.warning('读取数据库失败，请稍后再试', '地图');
    return false;
  }
  const exists = Object.values(data).some((s: any) => s && typeof s === 'object' && s.name === MISC_TABLE_NAME);
  if (!exists) {
    if (opts?.promptOnMissing) getToastr()?.warning(`当前无「杂表」，请先${missingTableRepairHint()}后再开启地图`, '地图');
    return false;
  }
  // 表已存在 → 确保指南层也登记了本表（数据库插件指南权威覆写，不重建则杂表被指南过滤丢弃、
  // 工作台/手动填表看不到）。用含杂表的 data 重建指南（幂等）。
  await ensureMiscTableInGuide(data);
  return true;
}