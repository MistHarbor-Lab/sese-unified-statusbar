// 数据库插件持久化导入兼容：
// 上游会把 auto_merged 作为表头外的纪要合并内部标记，但严格导入审计又会把它判为
// upgrade_overflow_cells。本模块只从全量导入副本中移除该内部尾标记；其他真实溢出值保留。

export interface PersistentImportPreparation {
  data: any;
  removedAutoMergedMarkers: number;
}

/** 创建持久化全量导入副本，并移除表头外的数据库内部 auto_merged 尾标记。
 *  不修改传入快照；不截断或修复其他溢出单元格。 */
export function prepareTableDataForPersistentImport(input: unknown): PersistentImportPreparation {
  const serialized = JSON.stringify(input);
  const data = serialized === undefined ? input : JSON.parse(serialized);
  let removedAutoMergedMarkers = 0;

  if (!data || typeof data !== 'object') {
    return { data, removedAutoMergedMarkers };
  }

  for (const [sheetKey, sheet] of Object.entries(data as Record<string, any>)) {
    if (!sheetKey.startsWith('sheet_') || !sheet || typeof sheet !== 'object') continue;
    const content = Array.isArray(sheet.content) ? sheet.content : null;
    const header = content && Array.isArray(content[0]) ? content[0] : null;
    if (!content || !header) continue;

    for (let rowIndex = 1; rowIndex < content.length; rowIndex++) {
      const row = content[rowIndex];
      if (!Array.isArray(row)) continue;
      if (row.length > header.length && row[row.length - 1] === 'auto_merged') {
        row.pop();
        removedAutoMergedMarkers++;
      }
    }
  }

  return { data, removedAutoMergedMarkers };
}
