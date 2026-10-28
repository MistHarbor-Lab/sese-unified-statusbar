// ===== 新人物创建：待相遇人物登记（角色中枢占位符的数据层） =====
// 「新人物创建」写入世界书后，人物姓名登记到待相遇名单；角色中枢目录页据此渲染占位卡。
// 名单按主世界书名分桶——主世界书与角色卡绑定，用它作卡级作用域，换卡/换世界书不串档。
import { getTavernHelper } from './env';
import { getConfig, setConfig } from './config-store';

export type PendingEncounterMap = Record<string, string[]>;

/** 归一化整份名单：剥空白、去重、丢空名；结构非法返回空表。 */
export function normalizePendingEncounters(value: unknown): PendingEncounterMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: PendingEncounterMap = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const bucketKey = String(key || '').trim();
    if (!bucketKey || !Array.isArray(raw)) continue;
    const seen = new Set<string>();
    const names: string[] = [];
    for (const item of raw) {
      const name = String(item || '').trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      names.push(name);
    }
    if (names.length) out[bucketKey] = names;
  }
  return out;
}

/** 纯函数：登记一个待相遇姓名（幂等）；返回新名单。 */
export function addPendingEncounterName(map: PendingEncounterMap, worldbookKey: string, name: string): PendingEncounterMap {
  const bucketKey = String(worldbookKey || '').trim();
  const clean = String(name || '').trim();
  if (!bucketKey || !clean) return map;
  const current = map[bucketKey] || [];
  if (current.includes(clean)) return map;
  return { ...map, [bucketKey]: [...current, clean] };
}

/** 纯函数：移除一个待相遇姓名；桶空则连桶删。返回新名单。 */
export function removePendingEncounterName(map: PendingEncounterMap, worldbookKey: string, name: string): PendingEncounterMap {
  const bucketKey = String(worldbookKey || '').trim();
  const clean = String(name || '').trim();
  if (!bucketKey || !clean || !map[bucketKey]) return map;
  const next = map[bucketKey].filter(item => item !== clean);
  if (next.length === map[bucketKey].length) return map;
  const out = { ...map };
  if (next.length) out[bucketKey] = next; else delete out[bucketKey];
  return out;
}

/** 待展示名单：剔除已出现在角色表里的人物（已相遇即毕业，占位符让位真实卡片）。 */
export function filterPendingEncounters(map: PendingEncounterMap, worldbookKey: string, metNames: readonly string[]): string[] {
  const bucketKey = String(worldbookKey || '').trim();
  if (!bucketKey || !map[bucketKey]) return [];
  const met = new Set(metNames.map(name => String(name || '').trim()).filter(Boolean));
  return map[bucketKey].filter(name => !met.has(name));
}

/** 当前角色卡主世界书名（作卡级作用域键）；取不到返回 ''（功能整体静默不可用）。 */
export function getCurrentWorldbookScopeKey(): string {
  try {
    const helper = getTavernHelper();
    const value = helper?.getCharWorldbookNames?.('current')?.primary;
    return String(value || '').trim();
  } catch (_e) {
    return '';
  }
}

function readMap(): PendingEncounterMap {
  return normalizePendingEncounters((getConfig() as unknown as Record<string, unknown>).characterWorldbookPendingEncounters);
}

/** 登记并落盘（worldbookKey 取不到时静默跳过，世界书写入不受影响）。 */
export function commitPendingEncounter(name: string): boolean {
  const key = getCurrentWorldbookScopeKey();
  const clean = String(name || '').trim();
  if (!key || !clean) return false;
  const next = addPendingEncounterName(readMap(), key, clean);
  setConfig('characterWorldbookPendingEncounters', next);
  return true;
}

/** 移除并落盘。 */
export function dropPendingEncounter(name: string): boolean {
  const key = getCurrentWorldbookScopeKey();
  const clean = String(name || '').trim();
  if (!key || !clean) return false;
  const next = removePendingEncounterName(readMap(), key, clean);
  setConfig('characterWorldbookPendingEncounters', next);
  return true;
}

/** 当前卡待展示的待相遇名单（已相遇者自动隐藏，不落盘）。 */
export function listPendingEncounters(metNames: readonly string[]): string[] {
  return filterPendingEncounters(readMap(), getCurrentWorldbookScopeKey(), metNames);
}
