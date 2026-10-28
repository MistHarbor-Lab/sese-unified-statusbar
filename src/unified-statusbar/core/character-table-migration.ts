// ===== 恋爱对象表 ⇄ 重要角色表人物迁移（仅 SQLite） =====
import {
  getAutoCardAPI,
  invalidateCache,
  sqlEscape,
  queryLogicalTableRows,
} from './data-manager';
import { sqlColumnName, sqlTableName } from './db-schema-map';
import {
  captureCharacterMigrationAchievementSnapshot,
  preserveAchievementProgressAcrossCharacterMigration,
} from './achievement-engine';

export type CharacterMigrationTable = '恋爱对象表' | '重要角色表';
export type CharacterMigrationCode =
  | 'migrated'
  | 'unsupported_mode'
  | 'invalid_table'
  | 'read_failed'
  | 'source_changed'
  | 'target_conflict'
  | 'constraint_failed'
  | 'write_failed'
  | 'verification_failed';

interface FieldDef {
  header: string;
  column: string;
}

/** 「年龄/生日」列两代格式：V3.2.0 模板起为生日列（birthday），旧库为年龄列（age）。
 *  同一聊天内两表来自同一模板，格式恒一致；按源表实际表头解析，快照记下所用列随 SQL 迁移。 */
const AGE_FIELD: FieldDef = { header: '年龄', column: 'age' };
const BIRTHDAY_FIELD: FieldDef = { header: '生日', column: 'birthday' };
type AgeColumn = 'age' | 'birthday';

function resolveAgeField(headers: string[]): FieldDef {
  return headers.includes(BIRTHDAY_FIELD.header) ? BIRTHDAY_FIELD : AGE_FIELD;
}

/** 迁移时随行携带的共享列（age 位置按快照解析的代际插入列 3）。 */
function sharedFieldsFor(ageColumn: AgeColumn): FieldDef[] {
  const ageField = ageColumn === 'birthday' ? BIRTHDAY_FIELD : AGE_FIELD;
  return [
    { header: '姓名', column: 'name' },
    { header: '性别', column: 'gender' },
    ageField,
    { header: '一句话介绍', column: 'brief_intro' },
    { header: '外貌特征', column: 'appearance' },
    { header: '身份', column: 'identity_text' },
    { header: '对主角态度', column: 'attitude_to_protagonist' },
    { header: '过往经历', column: 'past_experience' },
  ];
}

interface TableDef {
  logicalName: CharacterMigrationTable;
  sheetKey: string;
}

// 表/列名一律走适配器（台账后端＝中文名；真数据库后端＝物理名），本处不再维护第二份名字。
const TABLES: Record<CharacterMigrationTable, TableDef> = {
  '恋爱对象表': { logicalName: '恋爱对象表', sheetKey: 'sheet_romance_targets' },
  '重要角色表': { logicalName: '重要角色表', sheetKey: 'sheet_important_non_romance' },
};

/** 某表的 SQL 列名（真数据库后端翻物理名）。 */
function sqlColumnOf(table: CharacterMigrationTable, field: FieldDef): string {
  return sqlColumnName(table, field.header) ?? field.header;
}

/** 某表的完整读取字段（恋爱对象表多一列最近亲密互动）。 */
function fieldsFor(table: CharacterMigrationTable, ageColumn: AgeColumn): FieldDef[] {
  const fields = sharedFieldsFor(ageColumn);
  return table === '恋爱对象表'
    ? [...fields, { header: '最近亲密互动', column: 'recent_interactions' }]
    : fields;
}

export interface CharacterMigrationSnapshot {
  sourceTable: CharacterMigrationTable;
  targetTable: CharacterMigrationTable;
  rowId: number;
  name: string;
  /** 源表使用的年龄/生日物理列（同代迁移到目标表同名列）。 */
  ageColumn: AgeColumn;
  values: Record<string, string>;
}

export interface CharacterMigrationResult {
  ok: boolean;
  code: CharacterMigrationCode;
  name: string;
  sourceTable: CharacterMigrationTable;
  targetTable: CharacterMigrationTable;
  error?: string;
}

function normalizeValue(value: unknown): string {
  return value == null ? '' : String(value);
}

function result(
  snapshot: CharacterMigrationSnapshot,
  code: CharacterMigrationCode,
  error?: unknown,
): CharacterMigrationResult {
  return {
    ok: code === 'migrated',
    code,
    name: snapshot.name,
    sourceTable: snapshot.sourceTable,
    targetTable: snapshot.targetTable,
    ...(error == null ? {} : { error: String((error as any)?.message || error) }),
  };
}

export function isCharacterMigrationTable(name: string): name is CharacterMigrationTable {
  return name === '恋爱对象表' || name === '重要角色表';
}

export function getCharacterMigrationTarget(name: string): CharacterMigrationTable | null {
  if (name === '恋爱对象表') return '重要角色表';
  if (name === '重要角色表') return '恋爱对象表';
  return null;
}

export function createCharacterMigrationSnapshot(
  tableName: string,
  headers: string[],
  row: string[],
): CharacterMigrationSnapshot | null {
  if (!isCharacterMigrationTable(tableName)) return null;
  const targetTable = getCharacterMigrationTarget(tableName);
  if (!targetTable) return null;

  const rowIdIndex = headers.findIndex(header => {
    const h = normalizeValue(header).trim().toLowerCase();
    return h === 'row_id' || h === 'rowid' || h === '行号';
  });
  if (rowIdIndex < 0) return null;
  const rowId = Number.parseInt(normalizeValue(row[rowIdIndex]), 10);
  if (!Number.isInteger(rowId) || rowId <= 0) return null;

  const ageField = resolveAgeField(headers);
  const values: Record<string, string> = { row_id: String(rowId) };
  for (const field of fieldsFor(tableName, ageField.column as AgeColumn)) {
    const index = headers.indexOf(field.header);
    if (index < 0) return null;
    values[field.header] = normalizeValue(row[index]);
  }
  const name = values['姓名'].trim();
  if (!name) return null;

  return {
    sourceTable: tableName, targetTable, rowId, name,
    ageColumn: ageField.column as AgeColumn,
    values,
  };
}

function sourceReadColumns(source: CharacterMigrationTable, ageColumn: AgeColumn): string[] {
  return ['row_id', ...fieldsFor(source, ageColumn).map(field => field.header)];
}

function sourceMatchesSnapshot(
  source: CharacterMigrationTable,
  ageColumn: AgeColumn,
  row: any,
  snapshot: CharacterMigrationSnapshot,
): boolean {
  if (!row) return false;
  if (normalizeValue(row.row_id) !== String(snapshot.rowId)) return false;
  for (const field of fieldsFor(source, ageColumn)) {
    if (normalizeValue(row[field.header]) !== normalizeValue(snapshot.values[field.header])) return false;
  }
  return true;
}

function sqlValue(value: string): string {
  return `'${sqlEscape(value)}'`;
}

function sourceSnapshotPredicates(
  source: CharacterMigrationTable,
  ageColumn: AgeColumn,
  snapshot: CharacterMigrationSnapshot,
): string {
  const predicates = [`row_id = ${snapshot.rowId}`];
  for (const field of fieldsFor(source, ageColumn)) {
    predicates.push(`COALESCE(${sqlColumnOf(source, field)}, '') = ${sqlValue(snapshot.values[field.header] ?? '')}`);
  }
  return predicates.join('\n  AND ');
}

export function buildCharacterMigrationSql(snapshot: CharacterMigrationSnapshot): string {
  const { sourceTable, targetTable, ageColumn } = snapshot;
  const source = TABLES[sourceTable];
  const target = TABLES[targetTable];
  const sharedFields = sharedFieldsFor(ageColumn);
  const targetSqlTable = sqlTableName(target.logicalName);
  const sourceSqlTable = sqlTableName(source.logicalName);
  const nameColumn = sqlColumnOf(target.logicalName, { header: '姓名', column: 'name' });
  const insertColumns = ['row_id', ...sharedFields.map(field => sqlColumnOf(target.logicalName, field))];
  const selectValues = [
    `(SELECT COALESCE(MAX(row_id), 0) + 1 FROM ${targetSqlTable})`,
    ...sharedFields.map(field => sqlColumnOf(source.logicalName, field)),
  ];
  if (target.logicalName === '恋爱对象表') {
    insertColumns.push(sqlColumnOf('恋爱对象表', { header: '最近亲密互动', column: 'recent_interactions' }));
    selectValues.push(sqlValue('无'));
  }
  const escapedName = sqlValue(snapshot.name);
  const sourcePredicates = sourceSnapshotPredicates(sourceTable, ageColumn, snapshot);

  return [
    `INSERT INTO ${targetSqlTable} (${insertColumns.join(', ')})`,
    `SELECT ${selectValues.join(', ')}`,
    `FROM ${sourceSqlTable}`,
    `WHERE ${sourcePredicates}`,
    `  AND NOT EXISTS (SELECT 1 FROM ${targetSqlTable} WHERE ${nameColumn} = ${escapedName});`,
    `DELETE FROM ${sourceSqlTable}`,
    `WHERE row_id = ${snapshot.rowId}`,
    `  AND ${nameColumn} = ${escapedName}`,
    `  AND changes() = 1;`,
  ].join('\n');
}

function classifyWriteFailure(response: any): CharacterMigrationCode {
  const text = JSON.stringify(response?.errors || response?.error || response || '').toLowerCase();
  return /constraint|not null|check failed|unique/.test(text) ? 'constraint_failed' : 'write_failed';
}

export async function migrateCharacter(
  snapshot: CharacterMigrationSnapshot,
): Promise<CharacterMigrationResult> {
  if (
    !isCharacterMigrationTable(snapshot.sourceTable)
    || !isCharacterMigrationTable(snapshot.targetTable)
    || getCharacterMigrationTarget(snapshot.sourceTable) !== snapshot.targetTable
  ) {
    return result(snapshot, 'invalid_table');
  }

  const source = TABLES[snapshot.sourceTable];
  const target = TABLES[snapshot.targetTable];
  const api = getAutoCardAPI();
  if (!api || typeof api.querySql !== 'function' || typeof api.executeSqlBatch !== 'function') {
    return result(snapshot, 'unsupported_mode');
  }

  try {
    // 读取用 logicalName 交给 queryTableRows 按 sheet.name 定位，禁止回退 raw
    // querySql（8.7.3 存在表名/列名子串误替换）；列名一律中文，写 SQL 时由 db-schema-map
    // 适配器按后端决定是否翻物理名（台账后端直接用中文）。
    const sourceRows = queryLogicalTableRows({
      tableName: source.logicalName,
      columns: sourceReadColumns(source.logicalName, snapshot.ageColumn),
      where: { row_id: snapshot.rowId },
      limit: 1,
    });
    if (sourceRows === null) return result(snapshot, 'read_failed');
    if (sourceRows.length !== 1 || !sourceMatchesSnapshot(source.logicalName, snapshot.ageColumn, sourceRows[0], snapshot)) {
      invalidateCache();
      return result(snapshot, 'source_changed');
    }

    const conflictRows = queryLogicalTableRows({
      tableName: target.logicalName,
      columns: ['row_id'],
      where: { 姓名: snapshot.name },
      limit: 1,
    });
    if (conflictRows === null) return result(snapshot, 'read_failed');
    if (conflictRows.length > 0) {
      invalidateCache();
      return result(snapshot, 'target_conflict');
    }

    const achievementBefore = captureCharacterMigrationAchievementSnapshot();
    const response = await api.executeSqlBatch({
      sql: buildCharacterMigrationSql(snapshot),
      targetSheetKeys: [source.sheetKey, target.sheetKey],
      silent: true,
    });
    if (!response?.success) return result(snapshot, classifyWriteFailure(response), response);

    invalidateCache();
    const sourceAfter = queryLogicalTableRows({
      tableName: source.logicalName,
      columns: sourceReadColumns(source.logicalName, snapshot.ageColumn),
      where: { row_id: snapshot.rowId },
      limit: 1,
    });
    const targetAfter = queryLogicalTableRows({
      tableName: target.logicalName,
      columns: ['row_id', '姓名'],
      where: { 姓名: snapshot.name },
      limit: 2,
    });
    if (sourceAfter === null || targetAfter === null) return result(snapshot, 'read_failed');
    if (sourceAfter.length !== 0 || targetAfter.length !== 1) {
      if (sourceAfter.length === 1) {
        if (!sourceMatchesSnapshot(source.logicalName, snapshot.ageColumn, sourceAfter[0], snapshot)) {
          return result(snapshot, 'source_changed');
        }
        if (targetAfter.length > 0) return result(snapshot, 'target_conflict');
      }
      console.error('[character migration] verification failed', {
        snapshot, sourceAfter, targetAfter, response,
      });
      return result(snapshot, 'verification_failed');
    }

    preserveAchievementProgressAcrossCharacterMigration(achievementBefore);
    try { api._notifyTableUpdate?.(); } catch { /* ignore */ }
    return result(snapshot, 'migrated');
  } catch (error) {
    console.error('[character migration] failed:', error);
    return result(snapshot, 'write_failed', error);
  }
}
