// ===== 世界演化风格库（全局自定义风格 + 按角色卡的选择）=====
//
// 职责边界（本模块唯一的分工）：
//   · 自定义风格库 = 全局共享，条目存全局偏好文件（config-store 的 worldEvolveStyleLibrary）；
//   · 「哪张角色卡选了哪条」= **角色卡变量**（`__unified_statusbar_world_evolve_style_v1`）：
//     随角色卡同步（多设备）、删除角色卡即随卡消失，不占本项目存储。旧版设备本地
//     localStorage 映射（ub_world_evolve_style_per_card）已退役，不做迁移（用户定案：旧缓存忽略）。
//   · 群聊 / 欢迎页没有单一角色卡 ⇒ 取不到按卡选择，直接走全局默认（与「未单独设置」同路）。
// 注入侧零改动：本模块只把「按卡选择 → 全局默认 → 通用」解析回既有的 { style, custom } 二元组，
// 原样交给 world-evolution.ts#buildStyleDirectionRule（提示词与分支一行不动）。
//
// 依赖纪律：不 import core/config-store（否则与它反向依赖成环）——角色卡变量走统一的
// card-variable-store（只依赖 env）。

import { assignCardVariables, deleteCardVariables, readCardVariables } from '../card-variable-store';

export interface WorldEvolveStyleEntry {
  /** 唯一标识；风格选择值 = `custom:<id>`。 */
  id: string;
  name: string;
  text: string;
}

/** 预设风格键（与 buildStyleDirectionRule 既有分支一一对应；旧值 'custom' 由旧字段承载文本）。 */
export const WORLD_EVOLVE_PRESET_KEYS = ['general', 'sweet', 'intrigue', 'surprise'] as const;
/** 自定义风格选择值前缀。 */
export const WORLD_EVOLVE_CUSTOM_PREFIX = 'custom:';
/** 风格库条目上限（超出丢弃，防配置无限膨胀）。 */
export const WORLD_EVOLVE_LIBRARY_MAX = 20;
export const WORLD_EVOLVE_STYLE_NAME_MAX = 24;
export const WORLD_EVOLVE_STYLE_TEXT_MAX = 2000;
/** 旧「自由要求」文本迁进库时的默认条目名。 */
export const WORLD_EVOLVE_LIBRARY_SEED_NAME = '我的自定义';
/** 按角色卡保存的选择值：角色卡变量键。 */
export const WORLD_EVOLVE_STYLE_CARD_KEY = '__unified_statusbar_world_evolve_style_v1';

/** 归一化整份风格库：丢无 id/无名的坏项、去重 id、裁长、截上限；结构非法一律空表。 */
export function normalizeWorldEvolveStyleLibrary(value: unknown): WorldEvolveStyleEntry[] {
  if (!Array.isArray(value)) return [];
  const out: WorldEvolveStyleEntry[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const id = String(item.id ?? '').trim();
    const name = String(item.name ?? '').trim().slice(0, WORLD_EVOLVE_STYLE_NAME_MAX);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, text: String(item.text ?? '').slice(0, WORLD_EVOLVE_STYLE_TEXT_MAX) });
    if (out.length >= WORLD_EVOLVE_LIBRARY_MAX) break;
  }
  return out;
}

/** 新条目 id：时间戳 + 随机后缀，够用且无依赖。 */
export function nextWorldEvolveStyleId(): string {
  return 'ws' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** 选择值是否为「某条自定义风格」。 */
export function isWorldEvolveCustomKey(value: unknown): boolean {
  return typeof value === 'string' && value.slice(0, WORLD_EVOLVE_CUSTOM_PREFIX.length) === WORLD_EVOLVE_CUSTOM_PREFIX && value.length > WORLD_EVOLVE_CUSTOM_PREFIX.length;
}

/** 选择值 → 库条目 id（非自定义值返回空串）。 */
export function worldEvolveCustomEntryId(value: unknown): string {
  return isWorldEvolveCustomKey(value) ? String(value).slice(WORLD_EVOLVE_CUSTOM_PREFIX.length) : '';
}

/** 库条目 id → 选择值。 */
export function worldEvolveCustomKey(id: string): string {
  return WORLD_EVOLVE_CUSTOM_PREFIX + id;
}

/**
 * 选择值 → buildStyleDirectionRule 的入参二元组。
 * 未知值 / 悬空的自定义 id（条目已被删除）一律归 general：不注入该段，与旧「自定义留空」行为一致。
 */
export function resolveWorldEvolveStyle(
  selection: unknown,
  library: readonly WorldEvolveStyleEntry[],
  legacyCustomText?: string,
): { style: string; custom: string } {
  const value = typeof selection === 'string' ? selection : '';
  if (isWorldEvolveCustomKey(value)) {
    const id = worldEvolveCustomEntryId(value);
    const entry = library.find(item => item.id === id);
    return entry ? { style: 'custom', custom: entry.text } : { style: 'general', custom: '' };
  }
  if (value === 'custom') return { style: 'custom', custom: String(legacyCustomText || '').trim() };
  if (value === 'sweet' || value === 'intrigue' || value === 'surprise') return { style: value, custom: '' };
  return { style: 'general', custom: '' };
}

/**
 * 选择值是否可用：预设四值 / 库里的自定义条目 / 旧值 'custom'（文本在旧字段，仍可用）。
 * 悬空的自定义 id（条目已被删除）返回 false —— 调用方据此回落到全局默认或通用。
 */
export function hasWorldEvolveStyle(selection: unknown, library: readonly WorldEvolveStyleEntry[]): boolean {
  const value = typeof selection === 'string' ? selection : '';
  if (value === 'general' || value === 'sweet' || value === 'intrigue' || value === 'surprise') return true;
  if (value === 'custom') return true;
  if (isWorldEvolveCustomKey(value)) return library.some(item => item.id === worldEvolveCustomEntryId(value));
  return false;
}

/** 读当前角色卡的选择值（无卡/无 API/抛错 → ''）。 */
export function readCardWorldEvolveStyle(): string {
  const raw = readCardVariables()[WORLD_EVOLVE_STYLE_CARD_KEY];
  return typeof raw === 'string' ? raw.trim() : '';
}

/** 写当前角色卡的选择值（空值 = 删键，不留空壳）。返回是否成功。 */
export function writeCardWorldEvolveStyle(selection: string): boolean {
  const value = String(selection || '').trim();
  if (!value) return deleteCardVariables([WORLD_EVOLVE_STYLE_CARD_KEY]);
  return assignCardVariables({ [WORLD_EVOLVE_STYLE_CARD_KEY]: value });
}

/** 生效风格：按卡选择（角色卡变量）→ 全局默认 → 通用。演化请求取配置时调这里。 */
export function resolveWorldEvolveStyleForCurrentCard(cfg: {
  worldEvolveStyle?: unknown;
  worldEvolveStyleCustom?: unknown;
  worldEvolveStyleLibrary?: unknown;
}): { style: string; custom: string } {
  const library = normalizeWorldEvolveStyleLibrary(cfg.worldEvolveStyleLibrary);
  const own = readCardWorldEvolveStyle();
  const selection = hasWorldEvolveStyle(own, library) ? own : cfg.worldEvolveStyle;
  return resolveWorldEvolveStyle(
    selection,
    library,
    typeof cfg.worldEvolveStyleCustom === 'string' ? cfg.worldEvolveStyleCustom : '',
  );
}

/** 旧「自由要求」文本 → 风格库种子条目（纯函数；返回 null = 无需迁移）。
 *  只有「库为空 且 旧文本非空」才迁移一次；全局默认若原为 'custom' 则改指该条目，旧文本字段保留不动。 */
export function planWorldEvolveStyleMigration(
  library: readonly WorldEvolveStyleEntry[],
  selection: unknown,
  legacyCustomText: unknown,
): { library: WorldEvolveStyleEntry[]; selection: string } | null {
  if (library.length) return null;
  const text = String(legacyCustomText || '').trim();
  if (!text) return null;
  const entry: WorldEvolveStyleEntry = { id: nextWorldEvolveStyleId(), name: WORLD_EVOLVE_LIBRARY_SEED_NAME, text };
  const next = selection === 'custom'
    ? worldEvolveCustomKey(entry.id)
    : (typeof selection === 'string' && selection ? selection : 'general');
  return { library: [entry], selection: next };
}
