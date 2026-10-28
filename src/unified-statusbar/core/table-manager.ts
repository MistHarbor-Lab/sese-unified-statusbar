// ===== 表格管理：读取/开关数据库各表的运行状态 =====
// 详见 docs/superpowers/specs/2026-07-14-tables-tab-design.md
//
// 背景：数据库插件有两套数据源：
//   1. TABLE_TEMPLATE_ACU（模板）—— getTableTemplate() 读取
//   2. currentJsonTableData_ACU（运行时数据）—— exportTableAsJson() 读取（返回引用）
//
// 持久化关键：V2 模式下 refreshMergedDataAndNotify_ACU 从聊天楼层 checkpoint 重放
// 数据，mergedData 非空时直接用重放结果，不参考模板的 updateConfig。
// 因此仅改模板（importTemplateFromData）或仅改内存（exportTableAsJson 引用）
// 都无法在切换角色卡/刷新后存活。必须用 importTableAsJson 写入新 V2 checkpoint，
// 使重放结果包含新 updateConfig。

import { getAutoCardAPI, invalidateCache } from './data-manager';
import { plainClone } from './deep-clone';
import { getConfig } from './config-store';
import { getStandardSheetByName, getStandardDbTemplate, getStandardDbTemplateOrNull, ensureStandardTemplate } from './db-standard-template';
import { prepareTableDataForPersistentImport } from './db-import-compat';

/** 表名 → 初始 groupId（「分组版」切换时各表恢复到此预设分组；缺失兜底为 1）
 *  本映射保留 1/2 划分以使「分组版/非分组版」切换有可见差异，与模板 updateConfig.groupId
 *  （标准模板出厂全为 1）刻意解耦——勿因模板改版而同步覆盖本映射。 */
const INITIAL_GROUP_ID: Record<string, number> = {
  '主角信息表': 2,
  '恋爱对象表': 2,
  '重要角色表': 2,
  '人物关系表': 2,
  '角色里程碑表': 2,
  'NSFW信息表': 2,
  '人物性格偏移表': 2,
  '在场角色表': 2,
  '即时生理反应表': 2,
  '恋爱日记表': 2,
  '全局数据表': 1,
  '备忘录': 1,
  '物品表': 1,
  '检定建议表': 1,
  '纪要表': 1,
  '瑟瑟任务表': 1,
};

export function getInitialGroupId(tableName: string): number {
  return INITIAL_GROUP_ID[tableName] ?? 1;
}

/** 分组版标准模板：标准模板副本 + 各「未关闭」表 groupId 按预设映射改写（已关闭表跳过）。
 *  供「模板导入为全局预设」的分组版变体共用，与 setAllTableGroups 的 grouped 恢复口径一致。
 *  惰性装载（O39）：标准模板未就绪时派生的是空模板，只返回不缓存（缓存会让空模板永久固化）。 */
let _groupedTemplate: any = null;
export function buildGroupedStandardTemplate(): any {
  if (_groupedTemplate) return _groupedTemplate;
  const clone = plainClone(getStandardDbTemplate());
  for (const key of Object.keys(clone)) {
    if (!key.startsWith('sheet_')) continue;
    const uc = clone[key]?.updateConfig;
    if (!uc) continue;
    const freq = Number(uc.updateFrequency ?? -1);
    if (freq === 0) continue; // 已关闭表不参与分组（与 setAllTableGroups 一致）
    uc.groupId = getInitialGroupId(clone[key].name || key);
  }
  if (!getStandardDbTemplateOrNull()) return clone;
  return (_groupedTemplate = clone);
}

/** 当前分组模式下，某张表「开启态」应落入的 groupId。
 *  flat 模式恒为 1；grouped 模式为该表预设分组（getInitialGroupId）。
 *  供 setTableClosed 开启、setAllTableGroups 分组版恢复共用。 */
function resolveOpenGroupId(name: string): number {
  return getConfig().tableGroupMode === 'flat' ? 1 : getInitialGroupId(name);
}

/** 该表在标准模板里的默认「注入到世界书条目」状态。
 *  exportConfig.injectIntoWorldbook 缺省（undefined）或 true 视为默认注入；显式 false 才算默认不注入。
 *  供 setTableClosed 判定开关时是否同步切换注入（默认不注入的表保持原仅改 updateConfig 的逻辑）。
 *  ⚠ 依赖标准模板已装载（惰性装载 O39）：未就绪时按表名查不到 sheet，会把「默认不注入」误判为默认注入。
 *  同步函数无法等待装载，故调用方（setTableClosed）必须先 `await ensureStandardTemplate()`。 */
function isDefaultInjected(name: string): boolean {
  const std = getStandardSheetByName(name);
  return std?.exportConfig?.injectIntoWorldbook !== false;
}

/** 关闭某张表后影响的功能列表（关闭确认弹窗 + 警告 emoji 悬停共用） */
const CLOSE_IMPACT: Record<string, string[]> = {
  '主角信息表': [
    '状态栏主角卡（姓名/近况/瑟瑟能量）将空白',
    '抽卡系统无法消耗/获得瑟瑟能量',
    '日历/地图/经期孕期生成缺少主角身份信息',
    '相关成就（主角维度）无法统计',
  ],
  '恋爱对象表': [
    '状态栏角色卡无恋爱对象介绍/生日（年龄）/态度数据',
    '经期孕期引擎无法遍历恋爱对象，受孕/孕期推进失效',
    '立绘生成缺恋爱对象外貌',
    '相关成就（恋爱对象数量/年龄（生日推算）/性爱次数/调教值跨表统计）无法计算',
  ],
  '重要角色表': [
    '立绘生成回退读取重要角色数据缺失',
    '日历生成缺少重要角色信息',
    '相关成就（重要角色数量/年龄（生日推算）统计）无法计算',
  ],
  '人物关系表': [
    'AI 失去人物间成对关系的世界书注入，关系描写可能前后矛盾',
    '角色中枢「人物关系」页与人物关系网无数据可展示',
    '前端功能无其他直接依赖（该表主要经世界书注入与人物网可视化使用）',
  ],
  '角色里程碑表': [
    'AI 失去角色里程碑时间线的世界书注入，人物回溯与塑造能力下降',
    '前端功能无直接依赖（该表仅经世界书注入供 AI 使用）',
  ],
  'NSFW信息表': [
    '状态栏调教值显示为 0',
    '经期孕期引擎无性爱次数基准',
    '相关成就（性爱次数/调教值跨表统计）无法计算',
  ],
  '人物性格偏移表': [
    'AI 失去角色性格偏移上下文，角色扮演可能偏离设定',
    '前端功能无直接影响（该表仅经世界书注入供 AI 使用）',
  ],
  '在场角色表': [
    '状态栏角色卡（状态/打算/情绪/穿搭/各部位生理反应）空白',
    '地图生成缺少在场角色信息',
    '立绘生成缺少当前状态/情绪/穿搭',
  ],
  '即时生理反应表': [
    '状态栏各部位（胸部/下体/口穴/菊穴/其他）生理反应不显示',
    'NSFW 场景状态栏失去即时反应细节',
  ],
  '恋爱日记表': [
    '状态栏日记徽章归零',
    '恋爱日记弹窗空白',
    '状态栏日记列表不显示',
    '相关成就（日记篇数统计）无法计算',
  ],
  '全局数据表': [
    '状态栏时间/当前位置/当前详细地点/NSFW场景 全部空白',
    '日历生成失去当前时间基准',
    '地图生成失去当前详细地点/当前位置',
    '经期孕期失去时间基准',
    '大调查失去当前时间',
    '⚠ 影响面最广：几乎所有依赖时间地点的功能连锁失效',
  ],
  '备忘录': [
    '状态栏备忘录徽章归零',
    '备忘录弹窗空白',
    '日历生成失去备忘录约定时间/标题/内容提醒',
    '经期孕期事件无法写入备忘录（写入目标消失）',
  ],
  '物品表': [
    '状态栏物品徽章归零',
    '物品弹窗空白',
    '抽卡获得的物品无法写入',
    '相关成就（物品维度统计）无法计算',
  ],
  '检定建议表': [
    '选项栏无剧情选项可显示',
  ],
  '纪要表': [
    '时间锚定失去纪要基准，纪要前缀剥离/重写失效',
    '相关成就（纪要行数统计）无法计算',
  ],
  '瑟瑟任务表': [
    '状态栏瑟瑟任务徽章归零',
    '瑟瑟任务弹窗空白',
    '任务无法完成/删除/结算',
    '相关成就（任务完成统计）无法计算',
  ],
};

export function getCloseImpact(tableName: string): string[] {
  return CLOSE_IMPACT[tableName] ?? ['该表关闭后相关数据将不再更新'];
}

export interface TableStatusRow {
  sheetKey: string;
  name: string;
  updateFrequency: number;
  groupId: number;
  initialGroupId: number;
  isClosed: boolean;
  isInconsistent: boolean;
}

/** 读取当前运行时所有表状态
 *
 * 从 exportTableAsJson()（currentJsonTableData_ACU 引用）读取，
 * 与 buildAutoUpdatePlan_ACU 实际使用的数据源一致，确保读取值
 * 与实际运行行为吻合。
 */
export function readTableStatuses(): TableStatusRow[] {
  const api = getAutoCardAPI();
  if (!api || typeof api.exportTableAsJson !== 'function') return [];
  let data: any;
  try {
    data = api.exportTableAsJson();
  } catch {
    return [];
  }
  if (!data) return [];
  const rows: TableStatusRow[] = [];
  for (const key of Object.keys(data)) {
    if (!key.startsWith('sheet_')) continue;
    const sheet = data[key];
    const uc = sheet?.updateConfig;
    if (!uc) continue;
    const groupId = Number(uc.groupId ?? 1);
    const freq = Number(uc.updateFrequency ?? -1);
    const isClosed = groupId === 3;
    const isInconsistent = (groupId === 3 && freq !== 0) || (freq === 0 && groupId !== 3);
    const name = sheet.name || key;
    rows.push({
      sheetKey: key,
      name,
      updateFrequency: freq,
      groupId,
      initialGroupId: getInitialGroupId(name),
      isClosed,
      isInconsistent,
    });
  }
  rows.sort((a, b) => {
    const oa = Number(data[a.sheetKey]?.orderNo ?? 0);
    const ob = Number(data[b.sheetKey]?.orderNo ?? 0);
    return oa - ob;
  });
  return rows;
}

/** 由运行时数据构建「仅结构」模板：每表只取表头 content[0] + 元数据（+ seedRows），
 *  供 importTemplateFromData({scope:'chat'}) 重建聊天表单指南。不带数据行，避免把全量数据
 *  灌进聊天模板快照；指南只关心 sheet 键集合与每表结构，与数据行无关。保留 seedRows 以免
 *  重建指南时丢失种子行（影响后续空表重灌种）。
 *
 *  与 core/db-template-repair.ts 的 structureOnly、原 skill-table-ensure.ts 实现一致；
 *  统一从此处导出供三处调用方复用。 */
export function buildStructureOnlyTemplate(data: any): any {
  const mate = (data?.mate && typeof data.mate === 'object') ? { ...data.mate } : {};
  mate.type = 'chatSheets';
  if (!Number.isFinite(mate.version)) mate.version = 1;
  const tpl: any = { mate };
  for (const key of Object.keys(data || {})) {
    if (!key.startsWith('sheet_')) continue;
    const s = data[key];
    if (!s || typeof s !== 'object') continue;
    const headers = Array.isArray(s.content) && Array.isArray(s.content[0]) ? s.content[0] : [];
    const sheetTpl: any = {
      uid: s.uid || key,
      name: s.name || key,
      content: [headers.slice()],
      sourceData: s.sourceData || {},
      updateConfig: s.updateConfig || {},
      exportConfig: s.exportConfig || {},
      orderNo: typeof s.orderNo === 'number' ? s.orderNo : 0,
    };
    if (Array.isArray(s.seedRows)) sheetTpl.seedRows = s.seedRows;
    tpl[key] = sheetTpl;
  }
  return tpl;
}

/** 重建当前聊天的「聊天表单指南」以对齐 data 中的结构与每表 updateConfig。
 *
 *  数据库插件：运行时 currentJsonTableData_ACU 的每表 updateConfig（groupId/
 *  updateFrequency）与表清单均由「聊天表单指南」在 refreshMergedDataAndNotify 重放时权威覆写
 *  （applyGuideStructureBeforeReplay_ACU；v5.1.6 无此覆写）。因此仅用 importTableAsJson 写数据层
 *  （V2 checkpoint）不足以让 updateConfig 变更或新增表存活过下一次重放——必须再用公开 API
 *  importTemplateFromData({scope:'chat'}) 重建指南，让指南层也认得新结构/新 updateConfig。
 *  仅传结构模板（buildStructureOnlyTemplate），不清数据、不重灌种子。
 *
 *  副作用：会把当前聊天钉到「聊天级模板覆写(chat_override)」——之后切全局模板预设不会自动作用到
 *  本对话；用户可在数据库插件设置手动解除覆写。不影响数据正确性。这是"不改数据库插件源码"的代价，
 *  与 core/skill-table-ensure.ts、core/db-template-repair.ts 同一模式。
 *
 *  失败仅 console.warn 不抛（数据层写入由调用方先完成，指南层重建为尽力而为）；返回是否成功。
 *  v5.1.6 下同样可用（重建指南无害，updateConfig 以 checkpoint 为准）。 */
export async function syncChatSheetGuide(data: any): Promise<boolean> {
  const api = getAutoCardAPI();
  if (!api || typeof (api as any).importTemplateFromData !== 'function') return false;
  if (!data || typeof data !== 'object') return false;
  try {
    const tpl = buildStructureOnlyTemplate(data);
    const result = await (api as any).importTemplateFromData(JSON.stringify(tpl), { scope: 'chat' });
    return !!(result && result.success !== false);
  } catch (e) {
    console.warn('[表格] 重建聊天表单指南异常:', e);
    return false;
  }
}

/** 开关某张表
 *
 * 通过 importTableAsJson 持久化到 V2 checkpoint：
 *   importTableAsJson → importTableJsonThroughCommit_ACU → runTableUpdateCommit_ACU
 *   创建新 V2 checkpoint（data_replace），随后内部 refreshMergedDataAndNotifyWithUI_ACU
 *   从新 checkpoint 重放，currentJsonTableData_ACU 自动获得新 updateConfig。
 *
 * 数据库插件：重放时 applyGuideStructureBeforeReplay_ACU 会用「聊天表单指南」的 updateConfig
 *   权威覆写运行时，故仅写 checkpoint 不够——必须再 syncChatSheetGuide 重建指南，把新
 *   updateConfig 写进指南层，覆写后才不回退。详见 syncChatSheetGuide 注释。
 *
 * 不用 importTemplateFromData：它只改 TABLE_TEMPLATE_ACU（模板），而
 * refreshMergedDataAndNotify_ACU 在有 V2 历史数据时直接用重放结果，不参考模板的
 * updateConfig，导致切换角色卡/刷新后配置丢失。
 *
 * 默认注入的表（标准模板 exportConfig.injectIntoWorldbook !== false）开关时同步切换
 *   「注入到世界书条目」（关闭→false，开启→true）并 refreshDataAndWorldbook 刷新注入；
 *   默认不注入的表（显式 false）不动 exportConfig，保持原仅改 updateConfig 的逻辑。
 */
export async function setTableClosed(sheetKey: string, closed: boolean): Promise<{ ok: boolean; error?: string }> {
  const api = getAutoCardAPI();
  if (!api || typeof api.exportTableAsJson !== 'function' || typeof api.importTableAsJson !== 'function') {
    return { ok: false, error: '数据库 API 不可用' };
  }

  // exportTableAsJson 返回运行时引用；先深拷贝，避免导入预检失败时内存配置已被提前修改。
  // 数据库插件会拒绝表头外单元格，但数据库自身会为合并纪要追加 auto_merged 内部尾标记；
  // 持久化前仅移除该内部标记，其他真实溢出值保留并继续交给上游安全审计。
  let data: any;
  try {
    const prepared = prepareTableDataForPersistentImport(api.exportTableAsJson());
    data = prepared.data;
    if (prepared.removedAutoMergedMarkers > 0) {
      console.debug(`[表格] 持久化前移除 ${prepared.removedAutoMergedMarkers} 个数据库内部 auto_merged 标记。`);
    }
  } catch (e: any) {
    return { ok: false, error: '读取运行时数据失败：' + String(e?.message || e) };
  }
  if (!data || !data[sheetKey]) return { ok: false, error: '未找到该表' };

  const name = data[sheetKey].name || sheetKey;
  const newGroupId = closed ? 3 : resolveOpenGroupId(name);
  const newFreq = closed ? 0 : -1;
  // 惰性装载（O39）：默认注入判定按标准模板的表名索引查表，未就绪会误判默认不注入的表 ⇒ 先等就绪。
  await ensureStandardTemplate();

  // 修改深拷贝后的持久化 payload，不污染 exportTableAsJson 的运行时引用。
  if (!data[sheetKey].updateConfig) data[sheetKey].updateConfig = {};
  data[sheetKey].updateConfig.groupId = newGroupId;
  data[sheetKey].updateConfig.updateFrequency = newFreq;

  // 默认注入的表：开关时同步切换「注入到世界书条目」（关闭→不注入，开启→注入）。
  // 默认不注入的表（即时生理反应表/恋爱日记表/检定建议表/瑟瑟任务表/主角技能表）
  // 不动 exportConfig，保持原仅改 updateConfig 的逻辑。
  const toggledInject = isDefaultInjected(name);
  if (toggledInject) {
    if (!data[sheetKey].exportConfig) data[sheetKey].exportConfig = {};
    data[sheetKey].exportConfig.injectIntoWorldbook = !closed;
  }

  // 持久化到 V2 checkpoint
  try {
    const ok = await api.importTableAsJson(JSON.stringify(data));
    if (!ok) return { ok: false, error: '持久化失败' };
  } catch (e: any) {
    return { ok: false, error: '持久化失败：' + String(e?.message || e) };
  }

  // 数据库插件：重建聊天表单指南，使新 updateConfig 及 exportConfig.injectIntoWorldbook 存活过重放
  // （applyGuideStructureBeforeReplay_ACU 会用指南覆写运行时 updateConfig/exportConfig）。失败仅告警不回滚。
  await syncChatSheetGuide(data);

  // 默认注入的表：切换后刷新世界书注入，让条目立即按新配置收敛（关闭移除/开启重建）。
  // refreshDataAndWorldbook 从 checkpoint 过新指南重放 + 更新世界书，确保运行时拿到新 exportConfig 再注入。
  if (toggledInject && typeof api.refreshDataAndWorldbook === 'function') {
    try { await api.refreshDataAndWorldbook(); } catch { /* ignore */ }
  }

  invalidateCache();
  try { api._notifyTableUpdate?.(); } catch { /* ignore */ }
  return { ok: true };
}

/** 修正不一致状态 → 关闭态（分组3, 频率0） */
export async function fixInconsistent(sheetKey: string): Promise<{ ok: boolean; error?: string }> {
  return setTableClosed(sheetKey, true);
}

/** 批量切换所有「未关闭」表的分组模式。
 *
 * - flat：所有 updateFrequency≠0 的表 groupId 设为 1
 * - grouped：所有 updateFrequency≠0 的表 groupId 恢复为各自预设（getInitialGroupId）
 *
 * 只改 groupId，不动 updateFrequency；频率为 0（已关闭）的表整表跳过、不参与切换。
 * 持久化路径同 setTableClosed：exportTableAsJson → 深拷贝并兼容清理 → importTableAsJson 写 V2 checkpoint。
 * 返回 changed = 实际改动了 groupId 的表数量。 */
export async function setAllTableGroups(mode: 'grouped' | 'flat'): Promise<{ ok: true; changed: number } | { ok: false; error: string }> {
  const api = getAutoCardAPI();
  if (!api || typeof api.exportTableAsJson !== 'function' || typeof api.importTableAsJson !== 'function') {
    return { ok: false, error: '数据库 API 不可用' };
  }

  let data: any;
  try {
    const prepared = prepareTableDataForPersistentImport(api.exportTableAsJson());
    data = prepared.data;
    if (prepared.removedAutoMergedMarkers > 0) {
      console.debug(`[表格] 持久化前移除 ${prepared.removedAutoMergedMarkers} 个数据库内部 auto_merged 标记。`);
    }
  } catch (e: any) {
    return { ok: false, error: '读取运行时数据失败：' + String(e?.message || e) };
  }
  if (!data) return { ok: false, error: '运行时数据为空' };

  let changed = 0;
  for (const key of Object.keys(data)) {
    if (!key.startsWith('sheet_')) continue;
    const sheet = data[key];
    const uc = sheet?.updateConfig;
    if (!uc) continue;
    // 频率为 0（已关闭）的表不参与切换
    const freq = Number(uc.updateFrequency ?? -1);
    if (freq === 0) continue;
    const name = sheet.name || key;
    const targetGroupId = mode === 'flat' ? 1 : getInitialGroupId(name);
    if (Number(uc.groupId) !== targetGroupId) {
      uc.groupId = targetGroupId;
      changed++;
    }
  }

  // 持久化到 V2 checkpoint（即使 changed=0 也写一次，保证状态与运行态一致）
  try {
    const ok = await api.importTableAsJson(JSON.stringify(data));
    if (!ok) return { ok: false, error: '持久化失败' };
  } catch (e: any) {
    return { ok: false, error: '持久化失败：' + String(e?.message || e) };
  }

  // 数据库插件：重建聊天表单指南，使 groupId 切换存活过重放（指南权威覆写运行时 updateConfig）。
  // 即使 changed=0 也重建一次，保证指南层与运行态一致；失败仅告警。
  await syncChatSheetGuide(data);

  invalidateCache();
  try { api._notifyTableUpdate?.(); } catch { /* ignore */ }
  return { ok: true, changed };
}
