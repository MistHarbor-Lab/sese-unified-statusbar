// ===== 仓库功能：全局共享存储（usb_g_warehouse_*），跨聊天/设备同步 =====
// 数据形状（v2）：
//   groups: [{ id, name, overview }]   —— 仓库分组，数组顺序即展示顺序
//   items:  [{ uid, groupId, data, sourceCard? }] —— 物品全局唯一，归入某个分组
// 兼容旧形状（只有 items + 顶层 overview）：首次读取时惰性迁移为单个「默认仓库」分组，
// 不主动写库；下一次任何写操作会把 groups/groupId 一并落盘。
import { cloneJson } from './external-storage-codec';
import type { ExternalObjectStore } from './external-object-store';
import {
  getCellByHeader, deleteContentRowSqlFirst, insertContentRowSqlFirst, invalidateCache,
  batchInsertRows,
} from './data-manager';
import { getCurrentCardName } from './current-card';

let _warehouseStore: ExternalObjectStore | null = null;
let _groups: WarehouseGroup[] | null = null;
let _items: WarehouseItem[] | null = null;

export const DEFAULT_WAREHOUSE_GROUP_NAME = '默认仓库';
export const MAX_WAREHOUSE_GROUP_NAME_LENGTH = 24;

export interface WarehouseItem {
  uid: number;
  /** 所属仓库分组 id；旧数据缺失时迁移到第一个分组。 */
  groupId: number;
  data: { 物品名称: string; 类型: string; 数量: string; 描述: string };
  sourceCard?: string;
}

/** 仓库分组。overview 为该分组独立的总览图记录（每组一张，互不影响）。 */
export interface WarehouseGroup {
  id: number;
  name: string;
  overview: WarehouseOverviewRecord | null;
}

/** 仓库物品总览图记录（存全局仓库 store 的分组内；不污染 items）。 */
export interface WarehouseOverviewRecord {
  version: 1;
  imagePath: string;
  /** 生图时装配后的完整提示词（含预设前后缀），仅展示/参考。 */
  prompt: string;
  /** 可编辑的主提示词源（未含预设前后缀）；回填编辑框再生成不会二次叠加。 */
  mainPrompt: string;
  negativePrompt: string;
  fingerprint: string;
  itemCount: number;
  provider: string;
  width: number;
  height: number;
  createdAt: number;
}

export interface WarehouseAddOptions {
  /** 目标分组；缺省落到第一个分组（旧调用保持兼容）。 */
  groupId?: number;
  /** true=复制（保留物品栏原行）；false/缺省=移动（删除物品栏原行）。 */
  copy?: boolean;
}

export interface WarehouseAddResult {
  ok: boolean;
  /** 复制模式下与目标分组（或本批）同名的物品名；非空即整单拒绝。 */
  conflicts?: string[];
  error?: string;
}

export interface WarehouseGroupOpResult {
  ok: boolean;
  /** createWarehouseGroup 成功时返回新分组 id。 */
  id?: number;
  error?: string;
  /** 删除/合并后不再被任何分组引用的总览图；UI 负责删图片文件。 */
  removedOverview?: WarehouseOverviewRecord | null;
}

function normalizeOverview(value: unknown): WarehouseOverviewRecord | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.imagePath !== 'string' || !v.imagePath) return null;
  return {
    version: 1,
    imagePath: v.imagePath,
    prompt: typeof v.prompt === 'string' ? v.prompt : '',
    mainPrompt: typeof v.mainPrompt === 'string' ? v.mainPrompt : '',
    negativePrompt: typeof v.negativePrompt === 'string' ? v.negativePrompt : '',
    fingerprint: typeof v.fingerprint === 'string' ? v.fingerprint : '',
    itemCount: typeof v.itemCount === 'number' && Number.isFinite(v.itemCount) ? v.itemCount : 0,
    provider: typeof v.provider === 'string' ? v.provider : '',
    width: typeof v.width === 'number' && Number.isFinite(v.width) ? v.width : 0,
    height: typeof v.height === 'number' && Number.isFinite(v.height) ? v.height : 0,
    createdAt: typeof v.createdAt === 'number' && Number.isFinite(v.createdAt) ? v.createdAt : 0,
  };
}

function normalizeGroup(value: unknown): WarehouseGroup | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const id = Number(v.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const rawName = typeof v.name === 'string' ? v.name.trim() : '';
  return {
    id,
    name: (rawName || `仓库 ${id}`).slice(0, MAX_WAREHOUSE_GROUP_NAME_LENGTH),
    overview: normalizeOverview(v.overview),
  };
}

/** 归一化分组数组；无 groups 时用旧数据创建默认分组，并把旧顶层 overview 挂在它上面。 */
function normalizeGroups(rawGroups: unknown, legacyOverview: WarehouseOverviewRecord | null): WarehouseGroup[] {
  const groups: WarehouseGroup[] = [];
  const seenIds = new Set<number>();
  if (Array.isArray(rawGroups)) {
    for (const raw of rawGroups) {
      const group = normalizeGroup(raw);
      if (!group || seenIds.has(group.id)) continue;
      seenIds.add(group.id);
      groups.push(group);
    }
  }
  groups.sort((a, b) => a.id - b.id);
  if (groups.length === 0) {
    groups.push({ id: 1, name: DEFAULT_WAREHOUSE_GROUP_NAME, overview: legacyOverview });
    return groups;
  }
  // 只要 groups 已落盘，就以分组内 overview 为唯一事实源：顶层 overview 只用于
  // 「尚无 groups」的旧形状迁移，否则清除默认组总览图后会被旧键复活。
  return groups;
}

function cloneGroups(groups: readonly WarehouseGroup[]): WarehouseGroup[] {
  return groups.map(group => ({
    id: group.id,
    name: group.name,
    overview: group.overview ? cloneJson(group.overview) : null,
  }));
}

function resolveGroup(groups: readonly WarehouseGroup[], groupId?: number): WarehouseGroup | null {
  if (typeof groupId === 'number' && Number.isFinite(groupId)) {
    return groups.find(group => group.id === groupId) || null;
  }
  return groups[0] || null;
}

function resolveTargetGroupId(groups: readonly WarehouseGroup[], groupId?: number): number | null {
  const group = resolveGroup(groups, groupId);
  return group ? group.id : null;
}

/** 由 storage-bootstrap 配置全局仓库 store。 */
export function configureWarehouseStorage(store: ExternalObjectStore | null): void {
  _warehouseStore = store;
  _groups = null;
  _items = null;
}

function loadGroups(): WarehouseGroup[] {
  if (_groups) return _groups;
  const raw = (_warehouseStore?.readAll() || {}) as Record<string, unknown>;
  _groups = normalizeGroups(raw.groups, normalizeOverview(raw.overview));
  return _groups;
}

function normalizeItems(raw: any[], groups: readonly WarehouseGroup[]): WarehouseItem[] {
  if (!Array.isArray(raw)) return [];
  const fallbackGroupId = groups[0]?.id ?? 1;
  const validGroupIds = new Set(groups.map(group => group.id));
  return raw.filter(it => it && typeof it === 'object' && Number.isInteger(it.uid) && it.uid > 0).map(it => {
    const rawGroupId = Number(it.groupId);
    return {
      uid: it.uid,
      groupId: Number.isInteger(rawGroupId) && validGroupIds.has(rawGroupId) ? rawGroupId : fallbackGroupId,
      data: {
        物品名称: String(it.data?.物品名称 ?? ''),
        类型: String(it.data?.类型 ?? ''),
        数量: String(it.data?.数量 ?? '1'),
        描述: String(it.data?.描述 ?? ''),
      },
      ...(typeof it.sourceCard === 'string' && it.sourceCard.trim() ? { sourceCard: it.sourceCard.trim().slice(0, 80) } : {}),
    };
  });
}

function loadItems(): WarehouseItem[] {
  if (_items) return _items;
  const groups = loadGroups();
  const raw = (_warehouseStore?.readAll() || {}) as Record<string, unknown>;
  const list = Array.isArray(raw.items) ? raw.items : [];
  _items = normalizeItems(list, groups).sort((a, b) => a.uid - b.uid);
  return _items;
}

/** 立即落盘（取消防抖）；storage-bootstrap 的 flushStatusbarStorage 与测试用。 */
export async function flushWarehouseStorage(): Promise<void> {
  await _warehouseStore?.flush();
}

/** 单次 patch 同时写 groups/items；成功后原子替换内存缓存。 */
async function saveState(next: { groups?: WarehouseGroup[]; items?: WarehouseItem[] }): Promise<boolean> {
  if (!_warehouseStore) return false;
  let groups: WarehouseGroup[] | undefined;
  let items: WarehouseItem[] | undefined;
  if (next.groups) {
    if (next.groups.length === 0) return false;
    groups = cloneGroups(next.groups);
  }
  if (next.items) {
    items = normalizeItems(next.items, groups || loadGroups()).sort((a, b) => a.uid - b.uid);
  }
  const patch: Record<string, unknown> = {};
  if (groups) patch.groups = cloneJson(groups);
  if (items) patch.items = cloneJson(items);
  if (Object.keys(patch).length === 0) return false;
  const ok = await _warehouseStore.patch(patch);
  if (ok) {
    if (groups) _groups = groups;
    if (items) _items = items;
  }
  return ok;
}

async function saveItems(items: WarehouseItem[]): Promise<boolean> {
  return saveState({ items });
}

/** 读取全部分组（数组顺序即展示顺序）。 */
export async function getWarehouseGroups(): Promise<WarehouseGroup[]> {
  return loadGroups();
}

/** 读取物品；传 groupId 只返回该分组，缺省返回全部（兼容旧调用）。 */
export async function getWarehouseItems(groupId?: number): Promise<WarehouseItem[]> {
  const items = loadItems();
  if (typeof groupId === 'number' && Number.isFinite(groupId)) {
    return items.filter(item => item.groupId === groupId);
  }
  return items;
}

/** 读取某分组的总览图记录；缺省读第一个分组（兼容旧调用）。 */
export function readWarehouseOverview(groupId?: number): WarehouseOverviewRecord | null {
  return resolveGroup(loadGroups(), groupId)?.overview || null;
}

/** 覆盖保存某分组的总览图记录；其它分组与 items 不受影响。 */
export async function persistWarehouseOverview(record: WarehouseOverviewRecord, groupId?: number): Promise<boolean> {
  if (!_warehouseStore) return false;
  const groups = cloneGroups(loadGroups());
  const target = resolveGroup(groups, groupId);
  if (!target) return false;
  target.overview = cloneJson(record);
  return saveState({ groups });
}

/** 清除某分组的总览图记录（不删图片文件，文件删除由编排器负责）。 */
export async function clearWarehouseOverview(groupId?: number): Promise<boolean> {
  if (!_warehouseStore) return false;
  const groups = cloneGroups(loadGroups());
  const target = resolveGroup(groups, groupId);
  if (!target) return false;
  target.overview = null;
  return saveState({ groups });
}

/** 校验分组名：空/超长/重名返回错误文案，合法返回 null。 */
export function validateWarehouseGroupName(name: string, excludeGroupId?: number): string | null {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '仓库名称不能为空';
  if (trimmed.length > MAX_WAREHOUSE_GROUP_NAME_LENGTH) {
    return `仓库名称最多 ${MAX_WAREHOUSE_GROUP_NAME_LENGTH} 个字符`;
  }
  const lower = trimmed.toLocaleLowerCase();
  const duplicated = loadGroups().some(group =>
    group.id !== excludeGroupId && group.name.trim().toLocaleLowerCase() === lower);
  return duplicated ? '已有同名仓库' : null;
}

export async function createWarehouseGroup(name: string): Promise<WarehouseGroupOpResult> {
  if (!_warehouseStore) return { ok: false, error: '仓库存储未就绪' };
  const error = validateWarehouseGroupName(name);
  if (error) return { ok: false, error };
  const trimmed = name.trim();
  const groups = cloneGroups(loadGroups());
  const id = groups.reduce((max, group) => Math.max(max, group.id), 0) + 1;
  groups.push({ id, name: trimmed, overview: null });
  if (!await saveState({ groups })) return { ok: false, error: '仓库写入失败' };
  return { ok: true, id };
}

export async function renameWarehouseGroup(groupId: number, name: string): Promise<WarehouseGroupOpResult> {
  if (!_warehouseStore) return { ok: false, error: '仓库存储未就绪' };
  const groups = cloneGroups(loadGroups());
  const target = resolveGroup(groups, groupId);
  if (!target) return { ok: false, error: '仓库不存在' };
  const error = validateWarehouseGroupName(name, groupId);
  if (error) return { ok: false, error };
  target.name = name.trim();
  if (!await saveState({ groups })) return { ok: false, error: '仓库写入失败' };
  return { ok: true, id: target.id };
}

/** 删除/合并的共用实现：物品转入目标分组，源分组移除；源总览图按规则转移或返回给 UI 删除。 */
async function absorbWarehouseGroup(sourceId: number, targetId: number): Promise<WarehouseGroupOpResult> {
  if (!_warehouseStore) return { ok: false, error: '仓库存储未就绪' };
  const groups = cloneGroups(loadGroups());
  const source = resolveGroup(groups, sourceId);
  const target = resolveGroup(groups, targetId);
  if (!source) return { ok: false, error: '源仓库不存在' };
  if (!target) return { ok: false, error: '目标仓库不存在' };
  if (groups.length <= 1) return { ok: false, error: '至少保留一个仓库' };
  if (source.id === target.id) return { ok: false, error: '源仓库与目标仓库不能相同' };

  const sourceItems = loadItems().filter(item => item.groupId === source.id);
  const sourceHasItems = sourceItems.length > 0;
  let removedOverview: WarehouseOverviewRecord | null = null;
  if (source.overview) {
    if (!target.overview && sourceHasItems) {
      target.overview = cloneJson(source.overview);
    } else {
      removedOverview = cloneJson(source.overview);
    }
  }
  const nextGroups = groups.filter(group => group.id !== source.id);
  const nextItems = loadItems().map(item =>
    item.groupId === source.id ? { ...item, groupId: target.id } : item);
  if (!await saveState({ groups: nextGroups, items: nextItems })) {
    return { ok: false, error: '仓库写入失败' };
  }
  return { ok: true, removedOverview };
}

/** 删除分组：物品必须转移到另一个分组（至少保留一个仓库）。 */
export async function deleteWarehouseGroup(groupId: number, moveToGroupId: number): Promise<WarehouseGroupOpResult> {
  return absorbWarehouseGroup(groupId, moveToGroupId);
}

/** 合并分组：等同把源分组吞噬进目标分组，物品不丢失。 */
export async function mergeWarehouseGroups(sourceGroupId: number, targetGroupId: number): Promise<WarehouseGroupOpResult> {
  return absorbWarehouseGroup(sourceGroupId, targetGroupId);
}

/** 批量转移物品到目标分组；全部已在目标分组时不写盘。 */
export async function moveWarehouseItems(uids: number[], targetGroupId: number): Promise<boolean> {
  if (!Array.isArray(uids) || uids.length === 0) return false;
  const groups = loadGroups();
  if (!groups.some(group => group.id === targetGroupId)) return false;
  const uidSet = new Set(uids);
  const items = loadItems();
  const moving = items.filter(item => uidSet.has(item.uid));
  if (moving.length === 0) return false;
  if (moving.every(item => item.groupId === targetGroupId)) return true;
  const next = items.map(item => uidSet.has(item.uid) ? { ...item, groupId: targetGroupId } : item);
  return saveState({ items: next });
}

// ===== 入库 =====

export type WarehouseBatchRow = { 物品名称: string; 类型: string; 数量: string; 描述: string };

function nextWarehouseUid(items: readonly WarehouseItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.uid), 0) + 1;
}

function sourceCardField(): { sourceCard?: string } {
  const card = getCurrentCardName();
  return card && card.trim() ? { sourceCard: card.trim().slice(0, 80) } : {};
}

function emitWarehouseIn(): void {
  try { (window as any).__ubEmitAchievement?.('warehouse_in', {}); } catch (_e) { /* ignore */ }
  try { (window as any).__ubEmitAchievement?.('action-on-date', { action: 'warehouse_in' }); } catch (_e) { /* ignore */ }
}

/** 复制查重：目标分组已有同名，或本批内同名，都算冲突。移动不受此限制（保持旧行为）。 */
export function findWarehouseCopyConflicts(
  items: readonly WarehouseItem[],
  groupId: number,
  names: readonly string[],
): string[] {
  const existing = new Set(
    items.filter(item => item.groupId === groupId)
      .map(item => item.data.物品名称.trim())
      .filter(Boolean),
  );
  const incoming = new Set<string>();
  const conflicts: string[] = [];
  for (const raw of names) {
    const name = String(raw || '').trim();
    if (!name) continue;
    if ((existing.has(name) || incoming.has(name)) && !conflicts.includes(name)) conflicts.push(name);
    incoming.add(name);
  }
  return conflicts;
}

/** 单件入库（带结果）：copy=true 保留物品栏原行；移动失败会回滚仓库写入。 */
export async function addToWarehouseChecked(
  rowIndex: number,
  options: WarehouseAddOptions = {},
): Promise<WarehouseAddResult> {
  if (!_warehouseStore) return { ok: false, error: '仓库存储未就绪' };
  const name = getCellByHeader('物品表', rowIndex, '物品名称') || '';
  if (!name) return { ok: false, error: '物品名称为空' };
  const groups = loadGroups();
  const groupId = resolveTargetGroupId(groups, options.groupId);
  if (groupId == null) return { ok: false, error: '目标仓库不存在' };

  const items = loadItems();
  if (options.copy) {
    const conflicts = findWarehouseCopyConflicts(items, groupId, [name]);
    if (conflicts.length) return { ok: false, conflicts };
  }
  const next = items.concat({
    uid: nextWarehouseUid(items),
    groupId,
    data: {
      物品名称: name,
      类型: getCellByHeader('物品表', rowIndex, '类型') || '',
      数量: getCellByHeader('物品表', rowIndex, '数量') || '1',
      描述: getCellByHeader('物品表', rowIndex, '描述') || '',
    },
    ...sourceCardField(),
  });
  if (!await saveItems(next)) return { ok: false, error: '仓库写入失败' };
  if (options.copy) {
    emitWarehouseIn();
    return { ok: true };
  }

  const deleted = await deleteContentRowSqlFirst('物品表', rowIndex);
  if (!deleted) {
    // 没有可靠的新插入 row_id 可做精确补偿；保留仓库原件比先删后写更安全。
    await saveItems(items);
    console.error('[warehouse] 物品表原行删除失败，已回滚仓库写入:', name);
    return { ok: false, error: '物品行删除失败，已回滚' };
  }
  invalidateCache();
  emitWarehouseIn();
  return { ok: true };
}

/** 单件入库（兼容旧签名）；需要冲突明细时用 addToWarehouseChecked。 */
export async function addToWarehouse(rowIndex: number, options: WarehouseAddOptions = {}): Promise<boolean> {
  return (await addToWarehouseChecked(rowIndex, options)).ok;
}

/** 批量入库（带结果）：copy=true 只追加不删原行；整单查重，任一冲突则全部不写。 */
export async function addItemsToWarehouseChecked(
  rows: WarehouseBatchRow[],
  options: WarehouseAddOptions = {},
): Promise<WarehouseAddResult> {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: '没有可入库的物品' };
  if (!_warehouseStore) return { ok: false, error: '仓库存储未就绪' };
  const groups = loadGroups();
  const groupId = resolveTargetGroupId(groups, options.groupId);
  if (groupId == null) return { ok: false, error: '目标仓库不存在' };

  const validRows = rows.filter(row => String(row?.物品名称 ?? '').trim());
  if (validRows.length === 0) return { ok: false, error: '物品名称为空' };
  const items = loadItems();
  if (options.copy) {
    const conflicts = findWarehouseCopyConflicts(items, groupId, validRows.map(row => row.物品名称));
    if (conflicts.length) return { ok: false, conflicts };
  }
  let uid = nextWarehouseUid(items);
  const added: WarehouseItem[] = validRows.map(row => ({
    uid: uid++,
    groupId,
    data: {
      物品名称: String(row.物品名称 ?? ''),
      类型: String(row.类型 ?? ''),
      数量: String(row.数量 ?? '1'),
      描述: String(row.描述 ?? ''),
    },
    ...sourceCardField(),
  }));
  if (!await saveItems(items.concat(added))) return { ok: false, error: '仓库写入失败' };
  // 移动模式的物品栏原行由调用方删除（与旧批量链路一致）；复制不碰物品表。
  if (!options.copy) invalidateCache();
  emitWarehouseIn();
  return { ok: true };
}

/** 批量入库（兼容旧签名）。 */
export async function addItemsToWarehouse(
  rows: WarehouseBatchRow[],
  options: WarehouseAddOptions = {},
): Promise<boolean> {
  return (await addItemsToWarehouseChecked(rows, options)).ok;
}

export async function removeFromWarehouse(uid: number): Promise<boolean> {
  const items = loadItems();
  const item = items.find(it => it.uid === uid);
  if (!item) return false;
  const inserted = await insertContentRowSqlFirst('物品表', {
    '物品名称': item.data.物品名称, '类型': item.data.类型,
    '数量': item.data.数量 || '1', '描述': item.data.描述,
  });
  if (!inserted) return false;
  if (!await saveItems(items.filter(it => it.uid !== uid))) {
    // 没有可靠的新插入 row_id 可做精确补偿；保留仓库原件比先删后写更安全。
    console.error('[warehouse] 物品表已写入，但仓库确认删除失败；已保留仓库副本:', item.data.物品名称);
    return false;
  }
  invalidateCache();
  try { (window as any).__ubEmitAchievement?.('warehouse_out', {}); } catch (_e) { /* ignore */ }
  return true;
}

export async function deleteFromWarehouse(uid: number): Promise<boolean> {
  const items = loadItems();
  const next = items.filter(it => it.uid !== uid);
  return next.length !== items.length && await saveItems(next);
}

// ===== 批量版本（长按批量选择用） =====

/** 批量丢弃仓库物品：全局 store 一次性过滤。 */
export async function batchDeleteFromWarehouse(uids: number[]): Promise<boolean> {
  if (!Array.isArray(uids) || uids.length === 0) return false;
  const items = loadItems();
  const uidSet = new Set(uids);
  const next = items.filter(it => !uidSet.has(it.uid));
  if (next.length === items.length) return false;
  return saveItems(next);
}

/** 批量移出仓库：先 SQL 批量 INSERT，再确认删除仓库副本，失败时宁可重复不丢失。 */
export async function batchRemoveFromWarehouse(uids: number[]): Promise<boolean> {
  if (!Array.isArray(uids) || uids.length === 0) return false;
  const items = loadItems();
  const uidSet = new Set(uids);
  const removed = items.filter(it => uidSet.has(it.uid));
  if (removed.length === 0) return false;
  const rest = items.filter(it => !uidSet.has(it.uid));

  const rows = removed.map(it => ({
    '物品名称': it.data.物品名称,
    '类型': it.data.类型,
    '数量': it.data.数量 || '1',
    '描述': it.data.描述,
  }));
  const inserted = await batchInsertRows('物品表', rows);
  if (!inserted) return false;
  if (!await saveItems(rest)) {
    console.error('[warehouse] 物品表已批量写入，但仓库确认删除失败；已保留仓库副本');
    return false;
  }
  invalidateCache();
  try { (window as any).__ubEmitAchievement?.('warehouse_out', {}); } catch (_e) { /* ignore */ }
  return true;
}
