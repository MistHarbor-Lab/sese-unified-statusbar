// ===== 玩法选中状态（角色卡变量）=====
// v2（多选翻新）：`__unified_statusbar_play_state_v2` = Array<{name, category}>，
//   顺序即注入顺序（自由多选，不再受「每类一条」限制，上限由 play-library 的
//   nsfwPlayMaxSelected 控制）。写入 v2 的同时把 v1 镜像维护为「每类第一条选中」，
//   旧版产物回滚时最多退化为每类一条，不会全丢。
// v1（旧版兼容读）：`__unified_statusbar_play_state_v1` = Record<类别key, 玩法名>。
//   读侧：v2 缺失/空时自动从 v1 迁移视图（按 playTypes 固定顺序），无需用户操作。
import { playTypes } from './constants';
import { sillyTavernContext } from './env';
import { assignCardVariables, deleteCardVariables, readCardVariables } from './card-variable-store';

export const CHARACTER_PLAY_STATE_KEY = '__unified_statusbar_play_state_v1';
export const CHARACTER_PLAY_STATE_V2_KEY = '__unified_statusbar_play_state_v2';

export type PlayState = Record<string, string>;
export interface SelectedPlay { category: string; name: string }

const VALID_TYPE_KEYS = new Set(playTypes.map(type => type.key));

export function normalizePlayState(raw: unknown): PlayState {
  const normalized: PlayState = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return normalized;
  for (const type of playTypes) {
    const value = (raw as Record<string, unknown>)[type.key];
    if (typeof value !== 'string') continue;
    const name = value.trim();
    if (name) normalized[type.key] = name;
  }
  return normalized;
}

/** v2 数组归一化：条目 trim、缺字段跳过、同名去重（保首个出现位）。 */
export function normalizeSelectedPlaysV2(raw: unknown): SelectedPlay[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SelectedPlay[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    const category = typeof rec.category === 'string' ? rec.category.trim() : '';
    if (!name || !category || seen.has(name)) continue;
    seen.add(name);
    out.push({ category, name });
  }
  return out;
}

// O1：按聊天作用域缓存（角色变量随角色卡切换；写入与切卡都会失效重读）。
// 渲染路径每次 buildHTML 要读多次（chips × 各主题 + 签名），每次 getVariables 都会
// 序列化整份角色变量——纯浪费。取不到聊天标识（测试桩/极早期）时不缓存，保持直读语义。
let _playStateCache: { scope: string; v1: PlayState; v2: SelectedPlay[] } | null = null;

function currentScopeKey(): string {
  try {
    // U32：双窗根探测 + null 解包改走规范口（守卫式调用与 null 解包在此等价）
    const ctx = sillyTavernContext();
    if (ctx) return String(ctx.chatId ?? ctx.chat_metadata?.file_name ?? '');
  } catch (_e) { /* ignore */ }
  return '';
}

export function invalidatePlayStateCache(): void {
  _playStateCache = null;
}

function readRaw(): { v1: PlayState; v2: SelectedPlay[] } {
  const variables = readCardVariables(); // 角色卡变量统一读口：无卡/无 API → {}（不抛错）
  return {
    v1: normalizePlayState(variables?.[CHARACTER_PLAY_STATE_KEY]),
    v2: normalizeSelectedPlaysV2(variables?.[CHARACTER_PLAY_STATE_V2_KEY]),
  };
}

/** v1 Record → v2 数组（按 playTypes 固定顺序；仅 v2 为空时作为迁移视图）。 */
function playsFromV1(v1: PlayState): SelectedPlay[] {
  return playTypes.flatMap(type => {
    const name = v1[type.key];
    return name ? [{ category: type.key, name }] : [];
  });
}

/** v2 数组 → v1 镜像（每类第一条选中；旧版产物回滚兼容）。 */
function v1MirrorFromPlays(plays: SelectedPlay[]): PlayState {
  const mirror: PlayState = {};
  for (const play of plays) {
    if (VALID_TYPE_KEYS.has(play.category) && !mirror[play.category]) mirror[play.category] = play.name;
  }
  return mirror;
}

function loadState(): { v1: PlayState; v2: SelectedPlay[] } {
  const scope = currentScopeKey();
  if (_playStateCache && _playStateCache.scope === scope) {
    return { v1: _playStateCache.v1, v2: _playStateCache.v2 };
  }
  const raw = readRaw();
  // v2 空 = 旧卡从未写过 v2：从 v1 派生迁移视图（只读不写，首次写 v2 时才真正落盘）。
  const state = raw.v2.length > 0 ? raw : { v1: raw.v1, v2: playsFromV1(raw.v1) };
  if (scope) _playStateCache = { scope, ...state };
  return state;
}

export function readPlayState(): PlayState {
  const { v2 } = loadState();
  return v1MirrorFromPlays(v2);
}

export function getPlayStateValue(typeKey: string): string {
  return readPlayState()[typeKey] || '';
}

export function readSelectedPlays(): SelectedPlay[] {
  return [...loadState().v2];
}

export function readSelectedPlayNames(): string[] {
  return loadState().v2.map(play => play.name);
}

export function getPlayStateSignature(): string {
  return loadState().v2.map(play => play.name).join('|');
}

function persist(plays: SelectedPlay[]): boolean {
  if (plays.length === 0) {
    if (!deleteCardVariables([CHARACTER_PLAY_STATE_V2_KEY, CHARACTER_PLAY_STATE_KEY])) return false;
    invalidatePlayStateCache();
    return true;
  }
  if (!assignCardVariables({
    [CHARACTER_PLAY_STATE_V2_KEY]: plays,
    [CHARACTER_PLAY_STATE_KEY]: v1MirrorFromPlays(plays),
  })) return false;
  invalidatePlayStateCache();
  return true;
}

/** 多选主写口：整体替换已选列表（顺序即注入顺序）。失败返回 false 且不伪装成功。 */
export function writeSelectedPlays(plays: SelectedPlay[]): boolean {
  return persist(normalizeSelectedPlaysV2(plays));
}

/** v1 兼容写（旧测试/遗漏调用方）：该类收敛为单条，其余类别保持不变。 */
export function setPlayStateValue(typeKey: string, value: string): boolean {
  if (!VALID_TYPE_KEYS.has(typeKey)) return false;
  const current = readSelectedPlays();
  const name = typeof value === 'string' ? value.trim() : '';
  const firstIndexOfType = current.findIndex(play => play.category === typeKey);
  const withoutType = current.filter(play => play.category !== typeKey);
  if (!name) return persist(withoutType);
  const insertAt = firstIndexOfType >= 0 ? firstIndexOfType : withoutType.length;
  withoutType.splice(insertAt, 0, { category: typeKey, name });
  return persist(withoutType);
}

export function clearPlayState(): boolean {
  return persist([]);
}
