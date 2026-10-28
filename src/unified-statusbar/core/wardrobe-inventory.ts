// ===== 物品表服饰 → 衣柜模板事务 =====
import {
  deleteContentRowSqlFirst,
  findRowByColumn,
  getCellByHeader,
  getSheetByName,
  insertContentRowSqlFirst,
  invalidateCache,
} from './data-manager';
import {
  addWardrobeItem,
  deleteWardrobeItem,
  type WardrobeResult,
} from './wardrobe-service';
import {
  mapInventoryTypeToWardrobeCategory,
  normalizeWardrobeName,
  type WardrobeItem,
} from './wardrobe-types';

export interface InventoryWardrobeRow {
  rowId: string;
  name: string;
  type: string;
  description: string;
}

export interface WardrobeInventoryTransferDeps {
  readRow(rowIndex: number): InventoryWardrobeRow | null;
  findRowById(rowId: string): number;
  deleteRow(rowIndex: number): Promise<boolean>;
  addItem(draft: {
    name: string;
    category: WardrobeItem['category'];
    description: string;
  }): Promise<WardrobeResult<WardrobeItem>>;
  deleteItem(itemId: string): Promise<WardrobeResult<WardrobeItem>>;
  invalidate(): void;
}

export type WardrobeInventoryTransferResult =
  | { ok: true; item: WardrobeItem }
  | { ok: false; error: string };

export function createWardrobeInventoryTransfer(deps: WardrobeInventoryTransferDeps) {
  return async function transferInventoryItem(
    rowIndex: number,
  ): Promise<WardrobeInventoryTransferResult> {
    const row = deps.readRow(rowIndex);
    if (!row?.rowId || !row.name || !row.description) return { ok: false, error: '物品行数据不完整' };
    const category = mapInventoryTypeToWardrobeCategory(row.type);
    if (!category) return { ok: false, error: '该物品类型不能加入衣柜' };
    const added = await deps.addItem({
      name: row.name,
      category,
      description: row.description,
    });
    if (!added.ok) return { ok: false, error: added.error };

    deps.invalidate();
    const refreshedIndex = deps.findRowById(row.rowId);
    if (refreshedIndex < 1 || !(await deps.deleteRow(refreshedIndex))) {
      const rollback = await deps.deleteItem(added.value.id);
      return {
        ok: false,
        error: rollback.ok
          ? '物品表原行删除失败，衣柜新增已回滚'
          : `物品表原行删除失败，且衣柜回滚失败：${rollback.error}`,
      };
    }
    deps.invalidate();
    return { ok: true, item: added.value };
  };
}

const runtimeTransfer = createWardrobeInventoryTransfer({
  readRow(rowIndex) {
    const rowId = getCellByHeader('物品表', rowIndex, 'row_id') || '';
    return {
      rowId: String(rowId),
      name: getCellByHeader('物品表', rowIndex, '物品名称') || '',
      type: getCellByHeader('物品表', rowIndex, '类型') || '',
      description: getCellByHeader('物品表', rowIndex, '描述') || '',
    };
  },
  findRowById: rowId => findRowByColumn('物品表', 'row_id', rowId),
  deleteRow: rowIndex => deleteContentRowSqlFirst('物品表', rowIndex),
  addItem: addWardrobeItem,
  deleteItem: deleteWardrobeItem,
  invalidate: invalidateCache,
});

export async function addInventoryItemToWardrobe(
  rowIndex: number,
): Promise<WardrobeInventoryTransferResult> {
  const result = await runtimeTransfer(rowIndex);
  if (result.ok) {
    try {
      (window as any).__ubEmitAchievement?.('wardrobe_item_added', {
        category: result.item.category,
        amount: 1,
      });
    } catch (_e) { /* ignore */ }
  }
  return result;
}

// ===== 衣柜单品 → 物品表提取（复制，不删除衣柜原件） =====

export interface WardrobeItemInventoryExportDraft {
  name: string;
  category: string;
  description: string;
}

export type WardrobeItemInventoryExportResult =
  | { ok: true }
  | { ok: false; error: string };

export interface WardrobeItemInventoryExportDeps {
  /** 返回物品表中「同名同类型」行的行号（≥1）；无则返回 -1。 */
  findExistingRow(name: string, category: string): number;
  insertRow(values: Record<string, string>): Promise<boolean>;
}

export function createWardrobeItemInventoryExport(deps: WardrobeItemInventoryExportDeps) {
  return async function exportWardrobeItemToInventory(
    draft: WardrobeItemInventoryExportDraft,
  ): Promise<WardrobeItemInventoryExportResult> {
    const name = normalizeWardrobeName(draft?.name);
    const category = normalizeWardrobeName(draft?.category);
    if (!name || !category) return { ok: false, error: '服饰资料不完整，无法提取至物品栏' };
    if (deps.findExistingRow(name, category) >= 1) {
      return { ok: false, error: `物品栏已存在同名同类型的「${name}」，未重复提取` };
    }
    const inserted = await deps.insertRow({
      '物品名称': name,
      '类型': category,
      '数量': '1',
      '描述': String(draft?.description ?? '').trim(),
    });
    if (!inserted) return { ok: false, error: '物品表写入失败，请稍后重试' };
    invalidateCache();
    return { ok: true };
  };
}

const runtimeInventoryExport = createWardrobeItemInventoryExport({
  findExistingRow(name, category) {
    const sheet = getSheetByName('物品表');
    const rowCount = sheet ? sheet.content.length : 1;
    for (let row = 1; row < rowCount; row++) {
      const rowName = normalizeWardrobeName(getCellByHeader('物品表', row, '物品名称'));
      const rowType = normalizeWardrobeName(getCellByHeader('物品表', row, '类型'));
      if (rowName === name && rowType === category) return row;
    }
    return -1;
  },
  insertRow: values => insertContentRowSqlFirst('物品表', values),
});

/** 提取衣柜单品到物品栏（物品表新增一行；衣柜原件保留不动）。 */
export async function exportWardrobeItemToInventory(
  item: Pick<WardrobeItem, 'name' | 'category' | 'description'>,
): Promise<WardrobeItemInventoryExportResult> {
  return runtimeInventoryExport(item);
}
