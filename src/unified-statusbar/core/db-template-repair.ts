// core/db-template-repair.ts
// 数据库模板修复：以 标准模板 为标准，比对当前对话数据库，
// 生成修复计划（纯函数 buildRepairPlan）并执行（applyRepairPlan，Task 4 追加）。
// 详见 docs/superpowers/specs/2026-07-18-db-template-repair-design.md
import { getStandardDbTemplate, getStandardDbTemplateOrNull, ensureStandardTemplate } from './db-standard-template';
import { plainClone } from './deep-clone';
import { DB_TEMPLATE_VERSION, DB_TEMPLATE_PRESET_NAME } from './constants';
import { getAutoCardAPI, invalidateCache } from './data-manager';
import { buildGroupedStandardTemplate } from './table-manager';
import { setConfig } from './config-store';
import { getHostChatContext, rebuildChatCheckpoints } from './db-checkpoint-converge';
import { prepareTableDataForPersistentImport } from './db-import-compat';
import { parseDdlCheckRules, validateTemplateStructure } from './db-ddl-check-parser';
import { serverFileStore } from './server-file-store';
import { cleanupPluginWrapperEntries } from './db-plugin-worldbook-cleanup';

export type SheetCase = 1 | 2 | 3 | 4;

export interface SheetPlan {
  sheetKey: string;          // Case1/2/4: 标准侧 sheet_*；Case3: 当前侧 sheet_*
  standardName?: string;     // Case1/2/4: 标准表名
  currentName?: string;      // Case1/2/3: 当前表名
  case: SheetCase;
  cols?: { standard: string[]; current: string[]; kept: string[]; dropped: string[]; missing: string[]; aliases?: [string, string][] };
  migratedRowCount?: number; // Case1/2 保留数据行数（不含表头）
  keep?: boolean;            // Case3 用户决定，默认 true
}

export interface RepairPlan {
  version: string;
  sheets: SheetPlan[];
  summary: { case1: number; case2: number; case3: number; case4: number; rowsKept: number; droppedColumnCount: number };
  lengthOverflow: LengthOverflowSummary;
}

/** 一次修复所对齐的"标准"：目标模板 + 显示用副标题 + 是否存为全局预设并设为默认。
 *  标准修复用 STANDARD_REPAIR；无角色过滤修复用 NO_FILTER_REPAIR；导入修复运行时构造（saveAsGlobalPreset:false）。 */
export interface RepairStandard {
  template: any;
  subtitle: string;
  saveAsGlobalPreset: boolean;
  presetName?: string;
}

export const LENGTH_SAFETY_FACTOR = 0.95;

export interface LengthLimitRule {
  columnName: string;
  maxLength: number;
}

export interface LengthOverflowItem {
  sheetName: string;
  columnName: string;
  rowCount: number;
}

export interface LengthOverflowSummary {
  rowCount: number;
  items: LengthOverflowItem[];
}

/** SQLite LENGTH() counts Unicode code points rather than UTF-16 code units. */
export function unicodeLength(value: string): number {
  const text = String(value ?? '');
  const nulIndex = text.indexOf('\0');
  return Array.from(nulIndex >= 0 ? text.slice(0, nulIndex) : text).length;
}

/** Only over-limit values are shortened, leaving a 5% safety margin after truncation. */
export function truncateToDdlLimit(value: string, maxLength: number): { value: string; truncated: boolean } {
  const text = String(value ?? '');
  const nulIndex = text.indexOf('\0');
  const chars = Array.from(nulIndex >= 0 ? text.slice(0, nulIndex) : text);
  if (chars.length <= maxLength) return { value: text, truncated: false };
  const targetLength = Math.floor(maxLength * LENGTH_SAFETY_FACTOR);
  return { value: chars.slice(0, targetLength).join(''), truncated: true };
}

/** Extract DDL CHECK(LENGTH(physical_column) <= N) rules and map them to Chinese headers. */
export function parseDdlMaxLengthRules(ddl: string, headers: string[]): LengthLimitRule[] {
  if (!ddl) return [];
  const headerSet = new Set(headers);
  const rules: LengthLimitRule[] = [];
  for (const line of String(ddl).split('\n')) {
    const limitMatch = /\bLENGTH\s*\(\s*["`\[]?([A-Za-z_]\w*)["`\]]?\s*\)\s*<=\s*(\d+)/i.exec(line);
    if (!limitMatch) continue;
    const commentMatch = /--\s*(.*?)\s*$/.exec(line);
    const columnName = commentMatch?.[1]?.trim() || '';
    if (!columnName || !headerSet.has(columnName)) {
      console.warn(`[数据库模板修复] 无法映射 DDL 长度约束列 ${limitMatch[1]} → ${columnName || '(无中文列注释)'}`);
      continue;
    }
    rules.push({ columnName, maxLength: Number(limitMatch[2]) });
  }
  return rules;
}

/** 列名别名（旧列名 → 新列名）：数据库模板改版后，旧库中已存在的旧列名在修复时按别名迁移到新列。
 *  仅在本表需要从旧版迁移数据时补充；标准模板 V3.0.5 起这些列已用新名，不受影响。 */
export const COLUMN_ALIASES: Record<string, string> = {
  // NSFW信息表 V3.0.1 → V3.0.5 重命名
  '后庭与肛门状态': '后庭状态',
  '叫床风格': '床上淫语风格',
  '敏感/XP倾向': '性爱接受度和XP倾向',
  '声线/床上淫语风格': '床上淫语风格',
};

/** 表级列名别名（标准表名 → 旧列名→新列名）：仅该表特有的列改版迁移，不影响其他表的同名列。
 *  V3.2.0 把恋爱对象表/重要角色表、V3.3.0 把主角信息表的「年龄」列替换为「生日」列，
 *  故不能用全局 COLUMN_ALIASES。★旧年龄兜底迁移：旧值（如“20岁”）原样迁入生日列，由前端
 *  兼容透传显示；新库存量全面覆盖后未来删除本别名。 */
const SHEET_COLUMN_ALIASES: Record<string, Record<string, string>> = {
  '主角信息表': { '年龄': '生日' },
  '恋爱对象表': { '年龄': '生日' },
  '重要角色表': { '年龄': '生日' },
};

/** 由 COLUMN_ALIASES 派生出的反向映射（新列名 → 旧列名数组），供标准列名未命中时回溯旧列。一个新列名可能有多个旧名（如「床上淫语风格」旧名「叫床风格」/「声线/床上淫语风格」）。 */
const COLUMN_ALIAS_REVERSE: Record<string, string[]> = {};
for (const [legacy, neu] of Object.entries(COLUMN_ALIASES)) {
  (COLUMN_ALIAS_REVERSE[neu] = COLUMN_ALIAS_REVERSE[neu] || []).push(legacy);
}
const SHEET_COLUMN_ALIAS_REVERSE: Record<string, Record<string, string[]>> = {};
for (const [sheetName, aliases] of Object.entries(SHEET_COLUMN_ALIASES)) {
  const reverse: Record<string, string[]> = {};
  for (const [legacy, neu] of Object.entries(aliases)) {
    (reverse[neu] = reverse[neu] || []).push(legacy);
  }
  SHEET_COLUMN_ALIAS_REVERSE[sheetName] = reverse;
}

/** 标准表 stdHeader 列的旧列名候选（全局别名 + 本表别名）。 */
function legacyNamesFor(stdSheet: any, stdHeader: string): string[] {
  const sheetAliases = SHEET_COLUMN_ALIAS_REVERSE[String(stdSheet?.name || '')] || {};
  return [...(sheetAliases[stdHeader] || []), ...(COLUMN_ALIAS_REVERSE[stdHeader] || [])];
}

function sheetKeys(obj: any): string[] {
  return Object.keys(obj || {}).filter((k) => k.startsWith('sheet_'));
}
function headersOf(sheet: any): string[] {
  return (sheet && Array.isArray(sheet.content) && Array.isArray(sheet.content[0])) ? sheet.content[0].slice() : [];
}

function standardToCurrentIndexes(currentSheet: any, stdSheet: any): Record<string, number> {
  const curHeaders = headersOf(currentSheet);
  const directIndexes: Record<string, number> = {};
  curHeaders.forEach((header, index) => { directIndexes[header] = index; });
  const indexes: Record<string, number> = {};
  for (const standardHeader of headersOf(stdSheet)) {
    if (directIndexes[standardHeader] != null) {
      indexes[standardHeader] = directIndexes[standardHeader];
      continue;
    }
    // 旧列名别名：标准列未直接命中时，通过反向别名映射（新列名→旧列名们）回溯当前表的旧列
    for (const legacyName of legacyNamesFor(stdSheet, standardHeader)) {
      if (directIndexes[legacyName] != null) {
        indexes[standardHeader] = directIndexes[legacyName];
        break;
      }
    }
  }
  return indexes;
}

/** Scan one matched current/standard table pair without retaining any cell contents. */
export function analyzeLengthOverflows(currentSheet: any, stdSheet: any): LengthOverflowSummary {
  const rules = parseDdlMaxLengthRules(stdSheet?.sourceData?.ddl || '', headersOf(stdSheet));
  const currentIndexes = standardToCurrentIndexes(currentSheet, stdSheet);
  const itemCounts = new Map<string, number>();
  let rowCount = 0;
  const rows = Array.isArray(currentSheet?.content) ? currentSheet.content.slice(1) : [];
  for (const row of rows) {
    let rowOverflowed = false;
    for (const rule of rules) {
      const index = currentIndexes[rule.columnName];
      if (index == null) continue;
      if (unicodeLength(String(row?.[index] ?? '')) <= rule.maxLength) continue;
      rowOverflowed = true;
      itemCounts.set(rule.columnName, (itemCounts.get(rule.columnName) || 0) + 1);
    }
    if (rowOverflowed) rowCount++;
  }
  const sheetName = String(stdSheet?.name || '');
  return {
    rowCount,
    items: rules
      .filter((rule) => (itemCounts.get(rule.columnName) || 0) > 0)
      .map((rule) => ({ sheetName, columnName: rule.columnName, rowCount: itemCounts.get(rule.columnName) || 0 })),
  };
}

// ===== 修复标准：标准版 / 无角色过滤版 / 导入版 =====

/** 角色相关表：其 sendRowsSqlTemplate 用 `<if seed="角色名">` 做"角色过滤"（仅当剧情提到该角色名才把该角色数据发给填表 AI）。
 *  无角色过滤版 = 标准模板副本 + 删除这些表的 sendRowsSqlTemplate（回退到插件最原始的"按最新行数发整表"），兼容不支持该过滤的老版本数据库插件。 */
const NO_FILTER_SHEET_KEYS = ['sheet_romance_targets', 'sheet_important_non_romance', 'sheet_nsfw_info', 'sheet_tqa6vvmad', 'sheet_character_milestones'];
let _noFilterTemplate: any = null;
export function getNoFilterTemplate(): any {
  if (_noFilterTemplate) return _noFilterTemplate;
  const clone = plainClone(getStandardDbTemplate());
  for (const k of NO_FILTER_SHEET_KEYS) {
    if (clone[k]?.updateConfig) delete clone[k].updateConfig.sendRowsSqlTemplate;
  }
  // 惰性装载未就绪时派生的是空模板：只返回不缓存（缓存会让"空标准"永久固化，O39 回归）
  if (!getStandardDbTemplateOrNull()) return clone;
  return (_noFilterTemplate = clone);
}

/** 标准修复标准。`template` 用 getter 实时读取——惰性装载（O39）下不得在模块顶层把结果固化。 */
export const STANDARD_REPAIR: RepairStandard = {
  get template() { return getStandardDbTemplate(); },
  subtitle: `标准版 ${DB_TEMPLATE_VERSION}`,
  saveAsGlobalPreset: true,
  presetName: DB_TEMPLATE_PRESET_NAME,
};

export const NO_FILTER_REPAIR: RepairStandard = {
  get template() { return getNoFilterTemplate(); },
  subtitle: `无角色过滤版 ${DB_TEMPLATE_VERSION}`,
  saveAsGlobalPreset: true,
  presetName: `${DB_TEMPLATE_PRESET_NAME}（无角色过滤）`,
};

/** 校验导入的模板是否为合法 chatSheets 模板（强校验，对齐插件 parseImportedTemplateData_ACU）。 */
export function validateImportedTemplate(t: any): { ok: boolean; error?: string } {
  const r = validateTemplateStructure(t);
  if (r.ok) return { ok: true };
  return { ok: false, error: r.errors.join('；') };
}

// ===== 纯模板导入（不做修复）：把标准模板变体存为全局预设并设为默认，不碰当前对话数据 =====

export interface TemplateImportVariant {
  grouped: boolean;
  noFilter: boolean;
}

/** 变体 → 全局预设名。前两个与既有修复功能的预设名保持一致；分组版为新增命名。 */
export function templateImportPresetName(v: TemplateImportVariant): string {
  if (v.grouped && v.noFilter) return `${DB_TEMPLATE_PRESET_NAME}（分组·无角色过滤）`;
  if (v.grouped) return `${DB_TEMPLATE_PRESET_NAME}（分组）`;
  if (v.noFilter) return `${DB_TEMPLATE_PRESET_NAME}（无角色过滤）`;
  return DB_TEMPLATE_PRESET_NAME;
}

export function templateImportSubtitle(v: TemplateImportVariant): string {
  const g = v.grouped ? '分组版' : '非分组版';
  const n = v.noFilter ? ' · 无角色过滤（8.9.2以下适配）' : ' · 标准版';
  return `${g}${n} ${DB_TEMPLATE_VERSION}`;
}

function buildImportTemplate(v: TemplateImportVariant): any {
  let tpl: any;
  if (v.grouped && v.noFilter) {
    tpl = plainClone(buildGroupedStandardTemplate());
    for (const k of NO_FILTER_SHEET_KEYS) {
      if (tpl[k]?.updateConfig) delete tpl[k].updateConfig.sendRowsSqlTemplate;
    }
  } else if (v.grouped) {
    tpl = buildGroupedStandardTemplate();
  } else if (v.noFilter) {
    tpl = getNoFilterTemplate();
  } else {
    tpl = getStandardDbTemplate();
  }
  return tpl;
}

/** 纯导入：校验模板 → 存为数据库全局预设（同名跳过保存）→ 设为默认全局预设。
 *  与 applyRepairPlan 不同：不比对、不迁移、不改当前对话任何数据，也不动状态栏配置。 */
export async function importTemplateAsGlobalPreset(
  v: TemplateImportVariant,
): Promise<{ ok: true; presetName: string; subtitle: string } | { ok: false; error: string }> {
  const api = getAutoCardAPI();
  if (!api || typeof api.importTemplateFromData !== 'function') {
    return { ok: false, error: '数据库 API 不可用或版本过低（不支持 importTemplateFromData）' };
  }
  await ensureStandardTemplate(); // 惰性装载：三个变体都从标准模板派生，未就绪会导出空模板
  const tpl = buildImportTemplate(v);
  const check = validateImportedTemplate(tpl);
  if (!check.ok) return { ok: false, error: check.error || '模板校验失败' };
  const presetName = templateImportPresetName(v);
  try {
    await trySetStandardTemplateAsDefaultGlobalPreset(api, tpl, presetName);
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
  return { ok: true, presetName, subtitle: templateImportSubtitle(v) };
}

/** 模板所有「未关闭」sheet 的 updateConfig.groupId 均为 1 或缺省 → 出厂非分组，修复后 tableGroupMode 应置 flat。
 *  频率为 0（已关闭）的 sheet 不参与分组切换（与 setAllTableGroups 一致），故不计入本判定。分组模板返回 false（不强制）。 */
function allSheetsFlat(tpl: any): boolean {
  for (const k of Object.keys(tpl)) {
    if (!k.startsWith('sheet_')) continue;
    const uc = tpl[k]?.updateConfig;
    if (!uc) continue; // 缺省 updateConfig 视为非分组
    if (Number(uc.updateFrequency ?? -1) === 0) continue; // 已关闭表（频率0）不参与分组，跳过
    const g = uc.groupId;
    if (g !== undefined && g !== 1) return false;
  }
  return true;
}

/** 纯函数：比对当前数据与标准模板，生成修复计划（只读不改）。 */
export function buildRepairPlan(currentData: any, standard: any = getStandardDbTemplate()): RepairPlan {
  const summary = { case1: 0, case2: 0, case3: 0, case4: 0, rowsKept: 0, droppedColumnCount: 0 };
  const lengthOverflow: LengthOverflowSummary = { rowCount: 0, items: [] };
  const sheets: SheetPlan[] = [];
  if (!currentData || typeof currentData !== 'object') currentData = {};
  if (!standard || typeof standard !== 'object') standard = {};

  // 当前表按 name 索引
  const currentByName: Record<string, { key: string; sheet: any }> = {};
  for (const k of sheetKeys(currentData)) {
    const s = currentData[k];
    if (s && s.name) currentByName[s.name] = { key: k, sheet: s };
  }
  const matchedCurrentKeys = new Set<string>();

  // 遍历标准表
  for (const stdKey of sheetKeys(standard)) {
    const stdSheet = standard[stdKey];
    const stdName = stdSheet?.name || stdKey;
    const stdHeaders = headersOf(stdSheet);
    // 当前侧匹配：同名
    const curEntry = currentByName[stdName];
    if (curEntry) {
      matchedCurrentKeys.add(curEntry.key);
      const overflow = analyzeLengthOverflows(curEntry.sheet, stdSheet);
      lengthOverflow.rowCount += overflow.rowCount;
      lengthOverflow.items.push(...overflow.items);
      const curHeaders = headersOf(curEntry.sheet);
      const stdSet = new Set(stdHeaders);
      const curSet = new Set(curHeaders);
      // 旧列名别名解析：标准新列未直接命中时，若当前表存在其旧列名（全局或本表别名），该旧列按别名迁移，不算丢弃
      const aliasMatchedCurrent = new Set<string>();
      const stdByAlias: Record<string, string> = {}; // 标准列名 → 命中它的当前旧列名
      for (const stdH of stdHeaders) {
        for (const legacyName of legacyNamesFor(stdSheet, stdH)) {
          if (curSet.has(legacyName)) {
            stdByAlias[stdH] = legacyName;
            aliasMatchedCurrent.add(legacyName);
            break;
          }
        }
      }
      const stdCovered = new Set(stdHeaders.filter((h) => curSet.has(h) || stdByAlias[h]));
      const kept = stdHeaders.filter((h) => stdCovered.has(h));
      const missing = stdHeaders.filter((h) => !stdCovered.has(h));
      const dropped = curHeaders.filter((h) => !stdSet.has(h) && !aliasMatchedCurrent.has(h));
      const aliases: [string, string][] = stdHeaders
        .filter((h) => stdByAlias[h])
        .map((h) => [stdByAlias[h], h]);
      const dataRows = Array.isArray(curEntry.sheet.content) ? Math.max(0, curEntry.sheet.content.length - 1) : 0;
      // 别名迁移也算「列调整」：当前表用了旧列名，需按别名改名迁移（弹窗 Case2 展示 ⇄ 映射）
      if (dropped.length === 0 && missing.length === 0 && aliases.length === 0) {
        sheets.push({ sheetKey: stdKey, standardName: stdName, currentName: curEntry.sheet.name, case: 1, cols: { standard: stdHeaders, current: curHeaders, kept, dropped, missing, aliases }, migratedRowCount: dataRows });
        summary.case1++; summary.rowsKept += dataRows;
      } else {
        sheets.push({ sheetKey: stdKey, standardName: stdName, currentName: curEntry.sheet.name, case: 2, cols: { standard: stdHeaders, current: curHeaders, kept, dropped, missing, aliases }, migratedRowCount: dataRows });
        summary.case2++; summary.rowsKept += dataRows; summary.droppedColumnCount += dropped.length;
      }
    } else {
      sheets.push({ sheetKey: stdKey, standardName: stdName, case: 4 });
      summary.case4++;
    }
  }

  // 当前未被匹配的 → Case3（默认删除）
  for (const k of sheetKeys(currentData)) {
    if (matchedCurrentKeys.has(k)) continue;
    const s = currentData[k];
    sheets.push({ sheetKey: k, currentName: s?.name || k, case: 3, keep: false });
    summary.case3++;
  }

  // 排序：1/2/4 按标准 orderNo，3 放最后
  sheets.sort((a, b) => {
    const ord = (sp: SheetPlan) => (sp.case === 3 ? 9999 : Number(standard[sp.sheetKey]?.orderNo ?? 0));
    return ord(a) - ord(b);
  });

  return { version: DB_TEMPLATE_VERSION, sheets, summary, lengthOverflow };
}

/** 便捷入口：读取当前对话运行时数据并生成计划。可传入自定义标准模板（无角色过滤/导入）。返回 null 时附带 error。
 *  惰性装载（O39）：标准模板未就绪时**拒绝出计划**——空标准在比对语义里等于「所有表都是多余表」，
 *  一旦用户顺手确认就整库删除，故此处必须门禁而不是照常出计划。 */
export function buildRepairPlanFromCurrent(standardTemplate?: any): { plan: RepairPlan | null; error?: string } {
  const api = getAutoCardAPI();
  if (!api || typeof api.exportTableAsJson !== 'function') return { plan: null, error: '数据库 API 不可用' };
  const standard = standardTemplate ?? getStandardDbTemplate();
  if (sheetKeys(standard).length === 0) return { plan: null, error: '标准模板未就绪，请稍后重试' };
  let data: any = null;
  try { data = api.exportTableAsJson(); } catch (e: any) { return { plan: null, error: '读取运行时数据失败：' + String(e?.message || e) }; }
  if (!data) return { plan: null, error: '运行时数据为空' };
  // 全空落库防线（坑7 的「当前数据侧」对应物）：空对象是 truthy，放行会得出「全部待建、
  // 零行保留」的计划，确认后即整库写成空表。数据未装载完成 / 插件版本不兼容（读侧返回 {}）
  // 都命中此形态，一律拒绝出计划。
  if (sheetKeys(data).length === 0) {
    return { plan: null, error: '数据库当前没有读到任何表格（可能尚未加载完成或插件版本不兼容），已拒绝生成修复计划' };
  }
  return { plan: buildRepairPlan(data, standard) };
}

// ===== 迁移与写入（applyRepairPlan，Task 4 追加） =====

/** 解析标准表 DDL，取某中文列名的默认填充值（缺失列用）。 */
export function ddlColumnDefault(ddl: string, chineseColName: string): string {
  if (!ddl || !chineseColName) return '';
  for (const line of String(ddl).split('\n')) {
    // 行尾 `-- 中文列名` 注释定位列（DDL 物理名是英文，content[0] 是中文，靠注释桥接）
    const cm = line.match(/--\s*([^\n-]+?)\s*$/);
    if (!cm || cm[1].trim() !== chineseColName) continue;
    const def = line.replace(/--[^]*$/, '').trim().replace(/,\s*$/, '').trim();
    const dm = /DEFAULT\s+('([^']*)'|"([^"]*)"|([0-9.]+)|([A-Za-z_]\w*))/i.exec(def);
    if (dm) return dm[2] ?? dm[3] ?? dm[4] ?? dm[5] ?? '';
    if (/NOT\s+NULL/i.test(def)) return /\b(INT|INTEGER|REAL|NUMERIC|DECIMAL)\b/i.test(def) ? '0' : '无';
    return ''; // 可空
  }
  return ''; // 兜底可空
}

export interface MigrationResult {
  content: string[][];
  truncation: LengthOverflowSummary;
  checkFixes: { enumFixed: number; rangeClamped: number; minLengthPadded: number };
}

/** 按列名迁移当前表数据行到标准列结构，并按标准 DDL 修正 CHECK 约束违规 + 截断超限字段（Case1/2 共用）。 */
export function migrateContent(currentSheet: any, stdSheet: any): MigrationResult {
  const stdHeaders = headersOf(stdSheet);
  const currentIndexes = standardToCurrentIndexes(currentSheet, stdSheet);
  const ddl = stdSheet?.sourceData?.ddl || '';
  const checks = parseDdlCheckRules(ddl, stdHeaders);
  const limitsByColumn = new Map(checks.maxLength.map((r) => [r.columnName, r.maxLength]));
  const minLengthByColumn = new Map(checks.minLength.map((r) => [r.columnName, r.minLength]));
  const enumByColumn = new Map(checks.enums.map((r) => [r.columnName, r.values]));
  const rangeByColumn = new Map(checks.ranges.map((r) => [r.columnName, r]));
  const itemCounts = new Map<string, number>();
  let truncatedRowCount = 0;
  let enumFixed = 0, rangeClamped = 0, minLengthPadded = 0;
  const newContent: string[][] = [stdHeaders.slice()];
  const curRows = Array.isArray(currentSheet?.content) ? currentSheet.content.slice(1) : [];
  for (const row of curRows) {
    const newRow: string[] = [];
    let rowTruncated = false;
    for (let j = 0; j < stdHeaders.length; j++) {
      const h = stdHeaders[j];
      const currentIndex = currentIndexes[h];
      let value = currentIndex != null ? String(row?.[currentIndex] ?? '') : (h === 'row_id' ? '' : ddlColumnDefault(ddl, h));

      // 枚举 CHECK：违规值填 DDL DEFAULT 或枚举首项
      const allowed = enumByColumn.get(h);
      if (allowed && !allowed.includes(value)) {
        const def = ddlColumnDefault(ddl, h);
        value = (def && allowed.includes(def)) ? def : (allowed[0] ?? value);
        enumFixed++;
      }

      // 范围 CHECK：数值越界 clamp 到边界
      const range = rangeByColumn.get(h);
      if (range) {
        const num = Number(value);
        if (Number.isFinite(num)) {
          let clamped = num;
          if (range.min != null && clamped < range.min) clamped = range.min;
          if (range.max != null && clamped > range.max) clamped = range.max;
          if (range.minExclusive != null && clamped <= range.minExclusive) clamped = range.minExclusive + 1;
          if (range.maxExclusive != null && clamped >= range.maxExclusive) clamped = range.maxExclusive - 1;
          if (clamped !== num) { value = String(clamped); rangeClamped++; }
        }
      }

      // 最小长度 CHECK：过短补齐（用列默认值或全角空格）
      const minLen = minLengthByColumn.get(h);
      if (minLen != null && unicodeLength(value) < minLen) {
        const pad = ddlColumnDefault(ddl, h) || '　';
        while (unicodeLength(value) < minLen) value += pad;
        minLengthPadded++;
      }

      // 最大长度截断
      const maxLength = limitsByColumn.get(h);
      if (maxLength != null) {
        const truncated = truncateToDdlLimit(value, maxLength);
        value = truncated.value;
        if (truncated.truncated) {
          rowTruncated = true;
          itemCounts.set(h, (itemCounts.get(h) || 0) + 1);
        }
      }
      newRow[j] = value;
    }
    if (rowTruncated) truncatedRowCount++;
    newContent.push(newRow);
  }
  const sheetName = String(stdSheet?.name || '');
  return {
    content: newContent,
    truncation: {
      rowCount: truncatedRowCount,
      items: checks.maxLength
        .filter((rule) => (itemCounts.get(rule.columnName) || 0) > 0)
        .map((rule) => ({ sheetName, columnName: rule.columnName, rowCount: itemCounts.get(rule.columnName) || 0 })),
    },
    checkFixes: { enumFixed, rangeClamped, minLengthPadded },
  };
}

/** Case3 保留表预检：对齐插件 assertPersistableRowIdentities_ACU + inspectRows_ACU。
 *  - 行宽对齐表头：溢出截断（保留前 N 列）、短行尾部 padding null
 *  - row_id 去重（首次保留，重复丢弃）+ 空值保留（让插件自增）
 *  - 非数组行丢弃
 *  不修改传入 sheet，返回新 sheet 副本。 */
export function sanitizeCase3Sheet(sheet: any): { sheet: any; fixedRows: number; droppedRows: number } {
  if (!sheet || !Array.isArray(sheet.content) || !Array.isArray(sheet.content[0])) {
    return { sheet, fixedRows: 0, droppedRows: 0 };
  }
  const header = sheet.content[0];
  const headerLen = header.length;
  const seenRowIds = new Set<string>();
  const newRows: any[][] = [header.slice()];
  let fixedRows = 0;
  let droppedRows = 0;
  for (let i = 1; i < sheet.content.length; i++) {
    const row = sheet.content[i];
    if (!Array.isArray(row)) { droppedRows++; continue; }
    const rowId = String(row[0] ?? '');
    if (rowId !== '' && seenRowIds.has(rowId)) { droppedRows++; continue; }
    if (rowId !== '') seenRowIds.add(rowId);
    let newRow: any[] = row.slice();
    let fixed = false;
    if (newRow.length > headerLen) { newRow = newRow.slice(0, headerLen); fixed = true; }
    else if (newRow.length < headerLen) { while (newRow.length < headerLen) newRow.push(null); fixed = true; }
    if (fixed) fixedRows++;
    newRows.push(newRow);
  }
  return { sheet: { ...sheet, content: newRows }, fixedRows, droppedRows };
}

/** 仅结构模板（每表 content=[headers]，不带数据行），供 importTemplateFromData 重建指南层。镜像 skill-table-ensure.ts:39。 */
function structureOnly(data: any): any {
  const mate = (data?.mate && typeof data.mate === 'object') ? { ...data.mate } : {};
  mate.type = 'chatSheets';
  if (!Number.isFinite(mate.version)) mate.version = 1;
  const tpl: any = { mate };
  for (const key of Object.keys(data || {})) {
    if (!key.startsWith('sheet_')) continue;
    const s = data[key];
    if (!s || typeof s !== 'object') continue;
    const headers = Array.isArray(s.content) && Array.isArray(s.content[0]) ? s.content[0] : [];
    tpl[key] = {
      uid: s.uid || key,
      name: s.name || key,
      content: [headers.slice()],
      sourceData: s.sourceData || {},
      updateConfig: s.updateConfig || {},
      exportConfig: s.exportConfig || {},
      orderNo: typeof s.orderNo === 'number' ? s.orderNo : 0,
      ...(Array.isArray(s.seedRows) ? { seedRows: s.seedRows } : {}),
    };
  }
  return tpl;
}

/** 把标准模板存为数据库「全局模板预设」（同名已存在则跳过保存），并设为默认（当前）全局预设。
 *  仅在 applyRepairPlan 成功写回数据后调用；任何失败仅 console.warn，不影响修复结果。
 *  - 保存：getTemplatePresetNames() 判重 → importTemplateFromData({scope:'global',presetName}) upsert 入库。
 *  - 设默认：switchTemplatePreset({scope:'global'}) 把全局 currentTemplatePresetName 设为该预设。
 *    scope:'global' + persistChatScope:false 只改全局默认选择，不覆盖当前聊天修复建立的 chat_override
 *    （修复写回的数据/Case3 自定义表保留）。旧版插件无 switchTemplatePreset 则仅保存、跳过设默认。 */
async function trySetStandardTemplateAsDefaultGlobalPreset(api: any, template: any, presetName: string): Promise<void> {
  if (!presetName || !api || !template) return;
  if (typeof api.getTemplatePresetNames !== 'function' || typeof api.importTemplateFromData !== 'function') return;
  try {
    const names = api.getTemplatePresetNames();
    const exists = Array.isArray(names) && names.some((n: any) => String(n) === presetName);
    if (exists) {
      console.info(`[数据库模板修复] 全局预设「${presetName}」已存在，跳过保存。`);
    } else {
      const result = await api.importTemplateFromData(JSON.stringify(template), { scope: 'global', presetName });
      if (result && result.success === false) {
        console.warn(`[数据库模板修复] 保存全局预设「${presetName}」未成功：${result.message || ''}`);
        return; // 预设未入库 → 不切默认，避免切到不存在的预设
      }
      console.info(`[数据库模板修复] 已把模板存为全局预设「${presetName}」。`);
    }
    if (typeof api.switchTemplatePreset !== 'function') {
      console.warn(`[数据库模板修复] 当前插件版本不支持 switchTemplatePreset，已保存但未设为默认全局预设。`);
      return;
    }
    try {
      const sw = await api.switchTemplatePreset(presetName, { scope: 'global' });
      if (sw && sw.success === false) {
        console.warn(`[数据库模板修复] 设默认全局预设「${presetName}」未成功：${sw.message || ''}`);
      } else {
        console.info(`[数据库模板修复] 已把「${presetName}」设为默认全局预设。`);
      }
    } catch (e) {
      console.warn(`[数据库模板修复] 设默认全局预设异常（不影响修复）：`, e);
    }
  } catch (e) {
    console.warn('[数据库模板修复] 保存/设默认全局预设异常（不影响修复）：', e);
  }
}

function findCurrentSheetByName(current: any, name: string): any {
  if (!name) return null;
  for (const k of Object.keys(current)) {
    if (k.startsWith('sheet_') && current[k]?.name === name) return current[k];
  }
  return null;
}

/** 执行修复：构造 newData（标准配置 + 迁移数据 + 保留的 Case3）→ importTableAsJson 权威写入 → importTemplateFromData 重建指南层。
 *  standard 决定对齐的模板、是否存为全局预设并设为默认、tableGroupMode 是否重置为 flat。默认 STANDARD_REPAIR 与原行为一致。 */
export async function applyRepairPlan(
  plan: RepairPlan,
  standard: RepairStandard = STANDARD_REPAIR,
  confirm?: (message: string) => boolean | Promise<boolean>,
): Promise<{ ok: boolean; error?: string; truncation?: LengthOverflowSummary; case3Fixes?: { fixedRows: number; droppedRows: number }; warnings?: string[] }> {
  // 惰性装载（O39）：先等标准模板就绪再读 standard.template——STANDARD_REPAIR/NO_FILTER_REPAIR 的
  // template 是 getter，此处读到的才是已装载的模板；未就绪读到空模板会删光所有表。
  await ensureStandardTemplate();
  const stdTpl = standard.template;
  const stdSheets: Record<string, any> = Object.fromEntries(
    Object.keys(stdTpl).filter((k) => k.startsWith('sheet_')).map((k) => [k, stdTpl[k]]),
  );
  // 写前兜底：空标准 = 修复结果只剩 Case3 保留表 + mate，其余表全被 data_replace 丢弃 ⇒ 直接中止。
  if (Object.keys(stdSheets).length === 0) {
    return { ok: false, error: '标准模板未就绪，已中止修复（避免误删所有表）' };
  }
  const api = getAutoCardAPI();
  if (!api || typeof api.exportTableAsJson !== 'function' || typeof api.importTableAsJson !== 'function' || typeof api.importTemplateFromData !== 'function') {
    return { ok: false, error: '数据库 API 不可用' };
  }
  let current: any;
  try { current = plainClone(api.exportTableAsJson()); } catch (e: any) { return { ok: false, error: '读取运行时数据失败：' + String(e?.message || e) }; }
  if (!current) return { ok: false, error: '运行时数据为空' };
  // 同出计划侧门禁：确认弹窗到执行之间读侧状态可能变化（数据未装载/插件不兼容返回空对象），
  // 执行前重读仍为空即中止——写回是全量替换，放行等于把整库写成只有表头的空表。
  if (sheetKeys(current).length === 0) {
    return { ok: false, error: '数据库当前没有读到任何表格（可能尚未加载完成），已中止修复以避免清空整库' };
  }

  const newData: any = {
    mate: stdTpl.mate ? plainClone(stdTpl.mate) : { type: 'chatSheets', version: 1 },
  };
  const truncation: LengthOverflowSummary = { rowCount: 0, items: [] };
  const warnings: string[] = [];

  // 标准表（Case1/2/4）：标准配置 + 迁移后 content
  for (const sp of plan.sheets) {
    if (sp.case === 3) continue;
    const stdSheet = stdSheets[sp.sheetKey];
    if (!stdSheet) continue;
    let curSheet: any = null;
    if (sp.case === 1 || sp.case === 2) curSheet = findCurrentSheetByName(current, sp.currentName || sp.standardName || '');
    const migration = curSheet
      ? migrateContent(curSheet, stdSheet)
      : { content: [headersOf(stdSheet).slice()], truncation: { rowCount: 0, items: [] }, checkFixes: { enumFixed: 0, rangeClamped: 0, minLengthPadded: 0 } };
    truncation.rowCount += migration.truncation.rowCount;
    truncation.items.push(...migration.truncation.items);
    newData[sp.sheetKey] = {
      uid: stdSheet.uid || sp.sheetKey,
      name: stdSheet.name || sp.standardName || sp.sheetKey,
      sourceData: stdSheet.sourceData || {},
      updateConfig: stdSheet.updateConfig || {},
      exportConfig: stdSheet.exportConfig || {},
      orderNo: typeof stdSheet.orderNo === 'number' ? stdSheet.orderNo : 0,
      content: migration.content,
      ...(Array.isArray(stdSheet.seedRows) ? { seedRows: stdSheet.seedRows } : {}),
    };
  }

  // Case3 保留的表：预检行宽/row_id 后原样塞回（删除的不塞，被 data_replace 丢弃）
  const case3Fixes = { fixedRows: 0, droppedRows: 0 };
  for (const sp of plan.sheets) {
    if (sp.case !== 3 || !sp.keep) continue;
    const cur = current[sp.sheetKey];
    if (!cur) continue;
    const sanitized = sanitizeCase3Sheet(plainClone(cur));
    newData[sp.sheetKey] = sanitized.sheet;
    case3Fixes.fixedRows += sanitized.fixedRows;
    case3Fixes.droppedRows += sanitized.droppedRows;
  }

  // 1. 数据层权威写入（V2 checkpoint，data_replace）。
  // 数据库插件严格导入审计会拒绝表头外单元格，但数据库自身会为合并纪要追加
  // auto_merged 内部尾标记；仅移除该内部标记，其他真实溢出值保留给上游安全审计。
  const prepared = prepareTableDataForPersistentImport(newData);
  const importData = prepared.data;
  if (prepared.removedAutoMergedMarkers > 0) {
    console.debug(`[数据库模板修复] 持久化前移除 ${prepared.removedAutoMergedMarkers} 个数据库内部 auto_merged 标记。`);
  }
  try {
    const importResult = await api.importTableAsJson(JSON.stringify(importData));
    if (importResult && typeof importResult === 'object' && importResult.postCommitWarning) {
      warnings.push(String(importResult.postCommitWarning));
    }
    if (importResult === false || (importResult && importResult.success === false)) {
      return { ok: false, error: importResult?.error || '写入失败（importTableAsJson 返回 false）' };
    }
  } catch (e: any) {
    return { ok: false, error: '写入异常：' + String(e?.message || e) };
  }

  // 2. 指南层重建（仅结构，让工作台/Case4 新表被认得）
  try {
    const guideResult = await api.importTemplateFromData(JSON.stringify(structureOnly(importData)), { scope: 'chat' });
    if (guideResult && typeof guideResult === 'object' && guideResult.postCommitWarning) {
      warnings.push(String(guideResult.postCommitWarning));
    }
  } catch (e) {
    console.warn('[数据库模板修复] 重建指南层异常（不影响数据）：', e);
  }

  // 2.5 重建整库 full checkpoint：在最新 AI 楼层写入 canonical full checkpoint（data = 修复后完整数据），
  //     清空其之前所有楼层的 storageFrame + 陈旧向量索引（字段清零 + 外置文件删除）+ legacy v1 字段 + chat[0] 表头清单。
  //     新 checkpoint 楼层向量索引保留（importTableAsJson 已刷新）。宿主拿不到（纯测试环境）时静默跳过；失败仅告警不阻断。
  try {
    const hostCtx = getHostChatContext();
    if (hostCtx) {
      await rebuildChatCheckpoints(hostCtx.chat, hostCtx.saveChat, importData, {
        reason: 'import',
        deleteExternalFile: (p) => serverFileStore.delete(p),
        confirm,
      });
    }
  } catch (e) {
    console.warn('[数据库模板修复] 重建整库 checkpoint 失败（不影响修复数据）：', e);
  }

  // 2.6 清理插件注入到角色世界书的陈旧 Wrapper/PersonsHeader/Memory 条目（对齐 delete-all 的 cleanupWorldbookEntriesAfterDataDeletion）。
  //     只删插件注入条目（comment 后缀匹配 TavernDB-ACU-*），不碰状态栏自有的经期/立绘/地图/日历/成就世界书条目。best-effort，失败仅 warn。
  try {
    await cleanupPluginWrapperEntries();
  } catch (e) {
    console.warn('[数据库模板修复] 清理插件 lorebook 条目异常（不影响修复）：', e);
  }

  // 3. 顺便把本次修复所对齐的模板存为数据库全局预设并设为默认（同名跳过；失败不阻断修复）。
  //    标准修复/无角色过滤修复存为各自全局预设并设默认；导入修复 saveAsGlobalPreset=false，只修当前对话，不动全局默认。
  if (standard.saveAsGlobalPreset) {
    await trySetStandardTemplateAsDefaultGlobalPreset(api, stdTpl, standard.presetName || '');
  }

  // 4. 把「表格分组模式」按钮与修复后数据对齐：模板出厂「未关闭」sheet 的 updateConfig.groupId 全为 1（或缺省）时
  //    置 flat（按钮与全分组1数据一致）；分组模板不强制，避免把分组按钮错排成非分组。已关闭表（频率0）不计入。失败仅告警，不阻断修复。
  if (allSheetsFlat(stdTpl)) {
    try { setConfig('tableGroupMode', 'flat'); } catch (e) { console.warn('[数据库模板修复] 重置表格分组模式失败（不影响修复）：', e); }
  }

  invalidateCache();
  try { api._notifyTableUpdate?.(); } catch { /* ignore */ }
  return { ok: true, truncation, case3Fixes, warnings };
}
