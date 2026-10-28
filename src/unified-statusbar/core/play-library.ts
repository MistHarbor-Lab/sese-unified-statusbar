// ===== 瑟瑟玩法库：内置底库 + 自定义层合并、搜索筛选、收藏、隐藏、导入导出 =====
// 内置 458 条来自构建期注入的 window.__ub_play_data（plays_simplified.json，见
// scripts/build-statusbar.cjs）；本模块在其上叠加用户自定义层——自定义类别/条目、
// 内置隐藏清单（可恢复的软删）、收藏——全部存全局配置 nsfwPlayLibrary（跨聊天、
// 跨设备同步）。纯逻辑模块：零 DOM、零监听、零轮询；所有列表函数按需计算，
// 未打开选择器/未触发写入时开销 = 0。
//
// 依赖方向（环约束）：play-library → config-store / constants / play-state-store（单向）。
// config-store 对 nsfwPlayLibrary 只做 unknown 透传，归一化收敛在本模块
// normalizePlayLibraryState，杜绝 config-store → play-library 反向依赖。

import { getConfig, setConfig } from './config-store';
import { playTypes } from './constants';
import { readSelectedPlayNames, type SelectedPlay } from './play-state-store';

/** 自定义玩法条目（存储形态；custom 派生自「是否在 customPlays 里」，不落盘）。 */
export interface CustomPlayRecord { name: string; category: string; content: string }

/** 合并视图里的条目：custom=false 为内置（不可编辑，只能隐藏/收藏），custom=true 可编辑。 */
export interface PlayEntry { name: string; category: string; content: string; custom: boolean }

/** 类别信息（选择器筛选栏 / 管理页共用）：key 为匹配键，label 为显示名。 */
export interface PlayCategoryInfo { key: string; label: string; builtin: boolean; count: number }

/** 用户自定义层（全局配置 nsfwPlayLibrary 的归一化形态）。 */
export interface PlayLibraryState {
  customCategories: string[];
  customPlays: CustomPlayRecord[];
  /** 内置条目隐藏清单（软删，可恢复）：按条目名。 */
  hiddenBuiltinPlays: string[];
  /** 内置类别隐藏清单：按 playTypes.key（兼容存 label 的历史值，匹配时双读）。 */
  hiddenBuiltinCategories: string[];
  /** 收藏（玩法名，跨聊天全局）。 */
  favorites: string[];
}

export const PLAY_LIBRARY_FORMAT = 'ub-play-library';
export const PLAY_LIBRARY_VERSION = 1;
/** 系统类别：承接被删自定义类别的条目；不可删除、不可重命名。 */
export const UNCATEGORIZED_KEY = '__uncategorized__';
export const UNCATEGORIZED_LABEL = '未分类';

export const EMPTY_PLAY_LIBRARY: PlayLibraryState = {
  customCategories: [],
  customPlays: [],
  hiddenBuiltinPlays: [],
  hiddenBuiltinCategories: [],
  favorites: [],
};

// ===== 内置数据读取（与 play-worldbook.getPlayData 同源，但此处独立实现： =====
// ===== 避免引入 play-worldbook 的投影注册副作用）                          =====
interface BuiltinPlayData {
  plays: Array<{ name: string; category: string; content: string }>;
}

function readBuiltinPlayData(): BuiltinPlayData | null {
  try {
    const host: any = window;
    const data = host.__ub_play_data || (host.parent && host.parent.__ub_play_data);
    return data && Array.isArray(data.plays) ? (data as BuiltinPlayData) : null;
  } catch (_e) {
    return null;
  }
}

// ===== 类别工具 =====

const BUILTIN_KEY_TO_LABEL = new Map(playTypes.map(t => [t.key, t.label]));
const BUILTIN_LABEL_TO_KEY = new Map(playTypes.map(t => [t.label, t.key]));

/** 类别色点色板（浅色 8 色；深色亮化版成对，index 对齐）。渲染层按类别在
 *  当前类别清单中的序号取色，保证同屏不撞色且深浅色都可读。 */
const CATEGORY_PALETTE_LIGHT = ['#9050c0', '#d060a0', '#4a90a4', '#c07840', '#7080c8', '#6a9a58', '#a8683c', '#8a70b8'];
const CATEGORY_PALETTE_DARK = ['#b888e0', '#ff8fc0', '#6ab8cc', '#e8a070', '#98a8e8', '#8ac878', '#c88858', '#a890d0'];

export function playCategoryColor(category: string, dark: boolean, lib: PlayLibraryState = getPlayLibrary()): string {
  const key = builtinCategoryKeyOf(category) || category;
  const order = [...playTypes.map(t => t.key), ...lib.customCategories, UNCATEGORIZED_KEY];
  const idx = order.indexOf(key);
  const palette = dark ? CATEGORY_PALETTE_DARK : CATEGORY_PALETTE_LIGHT;
  return palette[(idx >= 0 ? idx : 0) % palette.length];
}

/** 类别键 → 显示名：内置 key 转 label（'multi'→'多人体位'），自定义/未分类原样。 */
export function playCategoryLabel(key: string): string {
  if (key === UNCATEGORIZED_KEY) return UNCATEGORIZED_LABEL;
  return BUILTIN_KEY_TO_LABEL.get(key) || key;
}

/** 显示名/键 → 内置 key；非内置返回 null。label 与 key 都认（导入数据两种都可能出现）。 */
function builtinCategoryKeyOf(cat: string): string | null {
  const trimmed = (cat || '').trim();
  if (BUILTIN_KEY_TO_LABEL.has(trimmed)) return trimmed;
  return BUILTIN_LABEL_TO_KEY.get(trimmed) || null;
}

// ===== 归一化 =====

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const v = item.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function normalizeCustomPlays(raw: unknown): CustomPlayRecord[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CustomPlayRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    const content = typeof rec.content === 'string' ? rec.content : '';
    const rawCat = typeof rec.category === 'string' ? rec.category.trim() : '';
    if (!name || !content || !rawCat) continue; // 坏条目跳过，不炸整库
    const category = builtinCategoryKeyOf(rawCat) || rawCat;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, category, content });
  }
  return out;
}

/** 配置侧 unknown → 归一化 PlayLibraryState。损坏数据一律静默降级为空态（可重新配置）。 */
export function normalizePlayLibraryState(raw: unknown): PlayLibraryState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY_PLAY_LIBRARY };
  const rec = raw as Record<string, unknown>;
  return {
    customCategories: normalizeStringArray(rec.customCategories),
    customPlays: normalizeCustomPlays(rec.customPlays),
    hiddenBuiltinPlays: normalizeStringArray(rec.hiddenBuiltinPlays),
    hiddenBuiltinCategories: normalizeStringArray(rec.hiddenBuiltinCategories),
    favorites: normalizeStringArray(rec.favorites),
  };
}

// ===== 读写 =====

export function getPlayLibrary(): PlayLibraryState {
  return normalizePlayLibraryState(getConfig().nsfwPlayLibrary);
}

export function savePlayLibrary(next: PlayLibraryState): void {
  // 写前再归一化一次：调用方拼装的中间态（含重复/空白）不落盘。
  setConfig('nsfwPlayLibrary', normalizePlayLibraryState(next));
}

/** 同时生效上限（设置可调 1-10，默认 5 = 与翻新前「每类 1 条 × 5 类」一致）。 */
export function getPlayMaxSelected(): number {
  const v = getConfig().nsfwPlayMaxSelected;
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(1, Math.min(10, Math.floor(v))) : 5;
}

// ===== 合并视图 =====

function isBuiltinCategoryHidden(lib: PlayLibraryState, category: string): boolean {
  const key = builtinCategoryKeyOf(category);
  if (!key) return false;
  return lib.hiddenBuiltinCategories.some(h => h === key || h === playCategoryLabel(key));
}

/** 全库可见条目（内置未隐藏 + 自定义），顺序：内置原序在前、自定义按存储序在后。 */
export function listVisiblePlays(lib: PlayLibraryState = getPlayLibrary()): PlayEntry[] {
  const out: PlayEntry[] = [];
  const hiddenPlays = new Set(lib.hiddenBuiltinPlays);
  const builtin = readBuiltinPlayData();
  if (builtin) {
    for (const p of builtin.plays) {
      if (!p || typeof p.name !== 'string') continue;
      const name = p.name.trim();
      if (!name || hiddenPlays.has(name)) continue;
      if (isBuiltinCategoryHidden(lib, p.category || '')) continue;
      out.push({ name, category: p.category || '', content: p.content || '', custom: false });
    }
  }
  for (const p of lib.customPlays) {
    out.push({ name: p.name, category: p.category, content: p.content, custom: true });
  }
  return out;
}

/** 全库找条目（含被隐藏的内置条目——管理页「恢复已隐藏」需要）。 */
export function findPlayAnywhere(name: string, lib: PlayLibraryState = getPlayLibrary()): PlayEntry | null {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const builtin = readBuiltinPlayData();
  const hit = builtin?.plays.find(p => p && typeof p.name === 'string' && p.name.trim() === trimmed);
  if (hit) return { name: hit.name.trim(), category: hit.category || '', content: hit.content || '', custom: false };
  const custom = lib.customPlays.find(p => p.name === trimmed);
  if (custom) return { ...custom, custom: true };
  return null;
}

/** 被隐藏的内置条目（管理页「恢复已隐藏」列表）。 */
export function listHiddenBuiltinPlays(lib: PlayLibraryState = getPlayLibrary()): PlayEntry[] {
  const hidden = new Set(lib.hiddenBuiltinPlays);
  const out: PlayEntry[] = [];
  const builtin = readBuiltinPlayData();
  if (!builtin) return out;
  for (const p of builtin.plays) {
    if (!p || typeof p.name !== 'string') continue;
    const name = p.name.trim();
    if (name && hidden.has(name)) out.push({ name, category: p.category || '', content: p.content || '', custom: false });
  }
  return out;
}

/** 类别清单（选择器筛选栏/管理页）：内置（未隐藏）+ 自定义 + 未分类（仅当有条目时）。 */
export function listCategories(lib: PlayLibraryState = getPlayLibrary()): PlayCategoryInfo[] {
  const visible = listVisiblePlays(lib);
  // 条目归属键：内置类别归一为 playTypes.key，其余按存储名（含未分类哨兵）。
  const ownerKey = (p: PlayEntry): string => builtinCategoryKeyOf(p.category) || p.category;
  const countOf = (key: string): number => visible.filter(p => ownerKey(p) === key).length;
  const out: PlayCategoryInfo[] = [];
  for (const t of playTypes) {
    if (isBuiltinCategoryHidden(lib, t.key)) continue;
    out.push({ key: t.key, label: t.label, builtin: true, count: countOf(t.key) });
  }
  for (const name of lib.customCategories) {
    out.push({ key: name, label: name, builtin: false, count: countOf(name) });
  }
  const uncategorizedCount = countOf(UNCATEGORIZED_KEY);
  if (uncategorizedCount > 0) out.push({ key: UNCATEGORIZED_KEY, label: UNCATEGORIZED_LABEL, builtin: false, count: uncategorizedCount });
  return out;
}

// ===== 搜索 / 筛选（纯函数） =====

export interface PlayFilter {
  query?: string;
  /** '全部' | '★收藏' | 类别 key（内置 key 或自定义名或 UNCATEGORIZED_KEY）。 */
  category?: string;
  favoritesOnly?: boolean;
}

export function filterPlays(list: PlayEntry[], filter: PlayFilter, favorites: ReadonlySet<string>): PlayEntry[] {
  const query = (filter.query || '').trim();
  const cat = (filter.category || '全部').trim();
  return list.filter(p => {
    if (query && p.name.indexOf(query) < 0) return false;
    if (filter.favoritesOnly && !favorites.has(p.name)) return false;
    if (cat === '全部') return true;
    if (cat === '★收藏') return favorites.has(p.name);
    if (cat === UNCATEGORIZED_KEY) return p.category === UNCATEGORIZED_KEY;
    const key = builtinCategoryKeyOf(p.category);
    return key ? key === cat || playCategoryLabel(key) === cat : p.category === cat;
  });
}

/** 随机挑 1 条（排除已选；池空返回 null）。 */
export function pickRandomPlay(pool: PlayEntry[], exclude: ReadonlySet<string>): PlayEntry | null {
  const candidates = pool.filter(p => !exclude.has(p.name));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ===== 已选玩法（角色卡变量 v2 的库侧解析） =====

/** 已选玩法名 → {name, category}（按选择顺序；名字在库里找不到的条目跳过——库被改后自然收敛）。 */
export function getSelectedPlays(): SelectedPlay[] {
  const names = readSelectedPlayNames();
  const out: SelectedPlay[] = [];
  for (const name of names) {
    const entry = findPlayAnywhere(name);
    if (entry) out.push({ name: entry.name, category: entry.category });
  }
  return out;
}

// ===== 收藏 / 隐藏 / 自定义 CRUD =====

export function isFavorite(name: string, lib: PlayLibraryState = getPlayLibrary()): boolean {
  return lib.favorites.includes((name || '').trim());
}

export function toggleFavorite(name: string): void {
  const lib = getPlayLibrary();
  const key = (name || '').trim();
  if (!key) return;
  const favorites = lib.favorites.filter(f => f !== key);
  if (favorites.length === lib.favorites.length) favorites.push(key);
  savePlayLibrary({ ...lib, favorites });
}

export function hideBuiltinPlay(name: string): void {
  const lib = getPlayLibrary();
  const key = (name || '').trim();
  if (!key || !lib.hiddenBuiltinPlays.includes(key)) {
    savePlayLibrary({ ...lib, hiddenBuiltinPlays: [...lib.hiddenBuiltinPlays, key] });
  }
}

export function restoreBuiltinPlay(name: string): void {
  const lib = getPlayLibrary();
  savePlayLibrary({ ...lib, hiddenBuiltinPlays: lib.hiddenBuiltinPlays.filter(n => n !== (name || '').trim()) });
}

export function setBuiltinCategoryHidden(key: string, hidden: boolean): void {
  const lib = getPlayLibrary();
  const normalized = builtinCategoryKeyOf(key) || key;
  const eq = (h: string) => h === normalized || h === playCategoryLabel(normalized);
  const next = hidden
    ? (lib.hiddenBuiltinCategories.some(eq) ? lib.hiddenBuiltinCategories : [...lib.hiddenBuiltinCategories, normalized])
    : lib.hiddenBuiltinCategories.filter(h => !eq(h));
  savePlayLibrary({ ...lib, hiddenBuiltinCategories: next });
}

/** 名称全库唯一校验（内置 + 自定义；excludeSelf 供编辑自身时排除自己）。 */
export function isPlayNameTaken(name: string, excludeSelf?: string): boolean {
  const key = (name || '').trim();
  if (!key) return true;
  if (excludeSelf && key === excludeSelf.trim()) return false;
  return !!findPlayAnywhere(key);
}

/** 新建/编辑自定义条目。重名（与全库冲突，排除自身）返回 false。 */
export function saveCustomPlay(record: CustomPlayRecord, originalName?: string): boolean {
  const lib = getPlayLibrary();
  const name = record.name.trim();
  const content = record.content;
  const category = record.category.trim();
  if (!name || !content || !category) return false;
  if (isPlayNameTaken(name, originalName)) return false;
  const normalizedCat = builtinCategoryKeyOf(category) || category;
  const others = originalName ? lib.customPlays.filter(p => p.name !== originalName.trim()) : [...lib.customPlays];
  savePlayLibrary({ ...lib, customPlays: [...others, { name, category: normalizedCat, content }] });
  return true;
}

export function deleteCustomPlay(name: string): void {
  const lib = getPlayLibrary();
  savePlayLibrary({ ...lib, customPlays: lib.customPlays.filter(p => p.name !== (name || '').trim()) });
}

/** 复制内置条目为自定义（名称加后缀避免全库唯一冲突；后缀已占则递增）。 */
export function duplicateBuiltinAsCustom(name: string): string | null {
  const entry = findPlayAnywhere(name);
  if (!entry || entry.custom) return null;
  let candidate = entry.name + '（自定义）';
  let n = 2;
  while (isPlayNameTaken(candidate)) candidate = `${entry.name}（自定义${n++}）`;
  const lib = getPlayLibrary();
  savePlayLibrary({ ...lib, customPlays: [...lib.customPlays, { name: candidate, category: entry.category, content: entry.content }] });
  return candidate;
}

export function addCustomCategory(label: string): boolean {
  const lib = getPlayLibrary();
  const name = (label || '').trim();
  if (!name || builtinCategoryKeyOf(name) || name === UNCATEGORIZED_LABEL || lib.customCategories.includes(name)) return false;
  savePlayLibrary({ ...lib, customCategories: [...lib.customCategories, name] });
  return true;
}

export function renameCustomCategory(oldName: string, newName: string): boolean {
  const lib = getPlayLibrary();
  const from = (oldName || '').trim();
  const to = (newName || '').trim();
  if (!from || !to || from === to) return false;
  if (builtinCategoryKeyOf(to) || to === UNCATEGORIZED_LABEL || lib.customCategories.includes(to)) return false;
  const categories = lib.customCategories.map(c => (c === from ? to : c));
  const customPlays = lib.customPlays.map(p => (p.category === from ? { ...p, category: to } : p));
  savePlayLibrary({ ...lib, customCategories: categories, customPlays });
  return true;
}

/** 删除自定义类别：条目移入未分类（二次确认由 UI 层负责）。 */
export function deleteCustomCategory(name: string): void {
  const lib = getPlayLibrary();
  const key = (name || '').trim();
  savePlayLibrary({
    ...lib,
    customCategories: lib.customCategories.filter(c => c !== key),
    customPlays: lib.customPlays.map(p => (p.category === key ? { ...p, category: UNCATEGORIZED_KEY } : p)),
  });
}

// ===== 导入 / 导出 =====

export interface PlayImportPayload {
  categories: string[];
  plays: CustomPlayRecord[];
}

export interface PlayImportPreview {
  categoriesToAdd: string[];
  playsTotal: number;
  playsToAdd: number;
  nameConflicts: string[];
}

export interface PlayImportResult {
  added: number;
  skipped: number;
  categoriesAdded: number;
}

/** 解析导入 JSON：识别本插件导出格式（format=ub-play-library）与玩法大全平铺格式。
 *  平铺格式 category 匹配内置 key/label 的归一为内置 key，否则进未分类。
 *  返回 null = 无法识别（非 JSON / 缺 plays）。 */
export function parsePlayLibraryImport(text: string): PlayImportPayload | null {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch (_e) {
    return null;
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.plays)) return null;
  const categories: string[] = [];
  if (Array.isArray(raw.categories)) {
    for (const c of raw.categories) {
      const name = typeof c === 'string' ? c.trim() : (c && typeof c === 'object' && typeof c.name === 'string' ? c.name.trim() : '');
      if (name && !builtinCategoryKeyOf(name) && name !== UNCATEGORIZED_LABEL) categories.push(name);
    }
  }
  const declared = new Set(categories);
  const plays: CustomPlayRecord[] = [];
  const seen = new Set<string>();
  for (const p of raw.plays) {
    if (!p || typeof p !== 'object') continue;
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    const content = typeof p.content === 'string' ? p.content : '';
    const rawCat = typeof p.category === 'string' ? p.category.trim() : '';
    if (!name || !content || !rawCat) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const builtinKey = builtinCategoryKeyOf(rawCat);
    let category: string;
    if (builtinKey) {
      category = builtinKey;
    } else if (declared.has(rawCat)) {
      category = rawCat;
    } else if (rawCat === UNCATEGORIZED_LABEL) {
      category = UNCATEGORIZED_KEY;
    } else {
      // 未声明且非内置：自动建类别，保留作者的分组语义（管理页可改名/删除）。
      category = rawCat;
      declared.add(rawCat);
      categories.push(rawCat);
    }
    plays.push({ name, category, content });
  }
  if (plays.length === 0) return null;
  return { categories, plays };
}

/** 导入预览：新增类别数 / 新增条目数 / 与现有库同名的条目名。 */
export function previewPlayImport(payload: PlayImportPayload): PlayImportPreview {
  const lib = getPlayLibrary();
  const existingCats = new Set([...lib.customCategories, ...playTypes.map(t => t.key)]);
  const categoriesToAdd = payload.categories.filter(c => !existingCats.has(c));
  const nameConflicts: string[] = [];
  let toAdd = 0;
  for (const p of payload.plays) {
    if (isPlayNameTaken(p.name)) nameConflicts.push(p.name);
    else toAdd++;
  }
  return { categoriesToAdd, playsTotal: payload.plays.length, playsToAdd: toAdd, nameConflicts };
}

/** 落库导入。strategy: 'skip' 跳过同名 / 'overwrite' 覆盖同名自定义条目
 *  （与内置同名永远跳过——内置不可改，属约定）。 */
export function applyPlayImport(payload: PlayImportPayload, strategy: 'skip' | 'overwrite'): PlayImportResult {
  const lib = getPlayLibrary();
  const preview = previewPlayImport(payload);
  const categories = [...lib.customCategories];
  for (const c of preview.categoriesToAdd) if (!categories.includes(c)) categories.push(c);
  const customPlays = [...lib.customPlays];
  let added = 0;
  let skipped = 0;
  for (const p of payload.plays) {
    const builtinHit = readBuiltinPlayData()?.plays.some(b => b && typeof b.name === 'string' && b.name.trim() === p.name);
    const idx = customPlays.findIndex(q => q.name === p.name);
    if (idx >= 0 && strategy === 'overwrite' && !builtinHit) {
      customPlays[idx] = { ...p };
      added++;
    } else if (idx >= 0 || builtinHit || isPlayNameTaken(p.name)) {
      skipped++;
    } else {
      customPlays.push({ ...p });
      added++;
    }
  }
  savePlayLibrary({ ...lib, customCategories: categories, customPlays });
  return { added, skipped, categoriesAdded: preview.categoriesToAdd.length };
}

/** 导出。scope='all' 含内置隐藏清单（完整备份可还原）；'custom' 仅自定义部分（分享用）。 */
export function buildPlayLibraryExport(scope: 'all' | 'custom'): string {
  const lib = getPlayLibrary();
  const payload: Record<string, unknown> = {
    format: PLAY_LIBRARY_FORMAT,
    version: PLAY_LIBRARY_VERSION,
    categories: lib.customCategories.map(name => ({ name })),
    plays: lib.customPlays.map(p => ({ name: p.name, category: playCategoryLabel(p.category) === UNCATEGORIZED_LABEL ? UNCATEGORIZED_LABEL : p.category, content: p.content })),
  };
  if (scope === 'all') {
    payload.hiddenBuiltinPlays = [...lib.hiddenBuiltinPlays];
    payload.hiddenBuiltinCategories = [...lib.hiddenBuiltinCategories];
    payload.favorites = [...lib.favorites];
  }
  return JSON.stringify(payload, null, 2);
}

/** 空白模板（含填写说明与 1 个示例条目；_ 前缀字段导入时忽略）。 */
export function buildPlayLibraryTemplate(): string {
  const payload = {
    format: PLAY_LIBRARY_FORMAT,
    version: PLAY_LIBRARY_VERSION,
    _说明: [
      '① plays 数组里放你的自定义玩法，每条必填 name / category / content 三个字段。',
      '② name 全库唯一（不能与内置 458 条重名）；content 是写作指南（YAML 结构），原样注入提示词。',
      '③ categories 声明自定义类别（可省略；category 填内置类别名「体位/多人体位/侍奉/场景/附加玩法」会自动归入）。',
      '④ 填完保存为 .json 文件，在「玩法库管理 → 导入导出」导入即可。',
    ].join('\n'),
    categories: [{ name: '我的私藏玩法' }],
    plays: [{
      name: '示例：病房特护Play（导入前请改名或删除）',
      category: '我的私藏玩法',
      content: '<病房特护Play>\n病房特护Play:\n  description: 以养伤为由的贴身照护场景\n  basics:\n    girl: 病床边俯身，以听诊、擦身等名义贴近\n    boy: 半卧病床，借伤势享受照顾并逐步越界\n  steps:\n    - 擦身时手指「无意」划过敏感部位\n  eroticism_focus: 借护理之名的正当性带来的紧张感',
    }],
  };
  return JSON.stringify(payload, null, 2);
}

/** 完整备份的还原导入（scope=all 导出的文件走 parse → 本函数额外还原隐藏/收藏）。 */
export function applyPlayLibraryBackupRestore(text: string): PlayImportResult | null {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch (_e) {
    return null;
  }
  if (!raw || raw.format !== PLAY_LIBRARY_FORMAT || !Array.isArray(raw.plays)) return null;
  const result = applyPlayImport(parsePlayLibraryImport(text) || { categories: [], plays: [] }, 'overwrite');
  const lib = getPlayLibrary();
  const merged = normalizePlayLibraryState({
    customCategories: lib.customCategories,
    customPlays: lib.customPlays,
    hiddenBuiltinPlays: [...new Set([...lib.hiddenBuiltinPlays, ...normalizeStringArray(raw.hiddenBuiltinPlays)])],
    hiddenBuiltinCategories: [...new Set([...lib.hiddenBuiltinCategories, ...normalizeStringArray(raw.hiddenBuiltinCategories)])],
    favorites: [...new Set([...lib.favorites, ...normalizeStringArray(raw.favorites)])],
  });
  savePlayLibrary(merged);
  return result;
}
