// core/db-ddl-check-parser.ts
// DDL CHECK 约束解析（枚举/范围/最小长度/最大长度）+ 模板结构强校验。
// 对齐数据库插件存储校验：parseImportedTemplateData_ACU（结构）+ SQLite CHECK 强制（约束）。
// 详见 docs/superpowers/specs/2026-08-04-db-template-repair-strengthen-design.md

export interface LengthLimitRule { columnName: string; maxLength: number; }
export interface MinLengthRule { columnName: string; minLength: number; }
export interface EnumRule { columnName: string; values: string[]; }
export interface RangeRule {
  columnName: string;
  min?: number; max?: number;
  minExclusive?: number; maxExclusive?: number;
}
export interface DdlCheckRules {
  maxLength: LengthLimitRule[];
  minLength: MinLengthRule[];
  enums: EnumRule[];
  ranges: RangeRule[];
}

/** 解析 DDL 的 CHECK 约束并按行尾 `-- 中文列名` 注释映射到中文表头列名。
 *  支持：CHECK(LENGTH(col) <= N) 最大长度、CHECK(LENGTH(col) >= N) 最小长度、
 *       CHECK(col IN ('a','b')) 枚举、CHECK(col >= N) / <= N / > N / < N 范围（含 AND 连接的双边范围）。
 *  每行 DDL 对应一个列（靠行尾 `-- 中文列名` 定位），故行内所有范围子句均归该列。
 *  无法映射中文列名时跳过该规则（不抛）。 */
export function parseDdlCheckRules(ddl: string, headers: string[]): DdlCheckRules {
  const rules: DdlCheckRules = { maxLength: [], minLength: [], enums: [], ranges: [] };
  if (!ddl || !headers || headers.length === 0) return rules;
  const headerSet = new Set(headers);
  for (const line of String(ddl).split('\n')) {
    const commentMatch = /--\s*(.*?)\s*$/.exec(line);
    const columnName = commentMatch?.[1]?.trim() || '';
    if (!columnName || !headerSet.has(columnName)) continue;
    const def = line.replace(/--[^]*$/, '').trim().replace(/,\s*$/, '').trim();

    // 最大长度 LENGTH(col) <= N
    let m = /\bLENGTH\s*\(\s*["`\[]?([A-Za-z_]\w*)["`\]]?\s*\)\s*<=\s*(\d+)/i.exec(def);
    if (m) { rules.maxLength.push({ columnName, maxLength: Number(m[2]) }); continue; }
    // 最小长度 LENGTH(col) >= N
    m = /\bLENGTH\s*\(\s*["`\[]?([A-Za-z_]\w*)["`\]]?\s*\)\s*>=\s*(\d+)/i.exec(def);
    if (m) { rules.minLength.push({ columnName, minLength: Number(m[2]) }); continue; }

    // 枚举 col IN ('a','b',...)
    m = /\b(["`\[]?)([A-Za-z_]\w*)\1\s+IN\s*\(([^)]*)\)/i.exec(def);
    if (m) {
      const values = m[3].split(',').map((s) => s.trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1')).filter((s) => s.length > 0);
      if (values.length > 0) rules.enums.push({ columnName, values });
      continue;
    }

    // 范围：解析行内所有 `col op N` 子句（op ∈ >= <= > <），合并到单条 RangeRule
    const range: RangeRule = { columnName };
    let hasRange = false;
    const clauseRe = /\b(["`\[]?)([A-Za-z_]\w*)\1\s*(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)/g;
    let cm: RegExpExecArray | null;
    while ((cm = clauseRe.exec(def)) !== null) {
      const op = cm[3];
      const n = Number(cm[4]);
      hasRange = true;
      if (op === '>=') range.min = n;
      else if (op === '<=') range.max = n;
      else if (op === '>') range.minExclusive = n;
      else if (op === '<') range.maxExclusive = n;
    }
    if (hasRange) rules.ranges.push(range);
  }
  return rules;
}

/** 强校验 chatSheets 模板结构，与数据库插件的导入校验保持一致。
 *  返回所有错误（不抛），供调用方决定是否中止。 */
export function validateTemplateStructure(t: any): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!t || typeof t !== 'object') return { ok: false, errors: ['不是合法的 JSON 对象'] };
  if (!t.mate || t.mate.type !== 'chatSheets') errors.push('缺少 mate.type="chatSheets"');
  const sheetKeys = Object.keys(t).filter((k) => k.startsWith('sheet_'));
  if (sheetKeys.length === 0) errors.push('模板不含任何 sheet_* 表');
  const seenNames = new Set<string>();
  for (const key of sheetKeys) {
    const s = t[key];
    if (!s || typeof s !== 'object') { errors.push(`表 "${key}" 不是对象`); continue; }
    if (!s.name || !s.content || !s.sourceData) errors.push(`表 "${key}" 结构不完整，缺少 name/content/sourceData`);
    if (s.uid && s.uid !== key) errors.push(`表「${s.name || key}」的 uid「${s.uid}」必须与 key「${key}」一致`);
    const header = Array.isArray(s.content) ? s.content[0] : null;
    if (!Array.isArray(header)) { errors.push(`表「${s.name || key}」的表头必须是数组`); continue; }
    if (header[0] !== 'row_id') errors.push(`表「${s.name || key}」首列必须是 row_id`);
    const normalized = new Set<string>();
    for (let i = 0; i < header.length; i++) {
      const h = String(header[i] ?? '').trim();
      if (!h) errors.push(`表「${s.name || key}」第 ${i + 1} 列列名不能为空`);
      if (normalized.has(h)) errors.push(`表「${s.name || key}」第 ${i + 1} 列与已有列重名：${h}`);
      normalized.add(h);
    }
    if (s.name && seenNames.has(s.name)) errors.push(`表名「${s.name}」重复`);
    if (s.name) seenNames.add(s.name);
  }
  return { ok: errors.length === 0, errors };
}