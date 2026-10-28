// core/world-engine/world-worldbook.ts
// 台前摘要 → 世界书投影：专用条目「世界动态」（constant 蓝灯，at_depth order 199）。
// 认知边界总闸：注入内容 = frontDigest（主角可知集合）；worldEnabled 关或内容空时移除条目。
// 角色动态 → 世界书投影：绿色（角色姓名关键词触发）条目族「角色动态-<角色名>」（before_character_definition order 202），
//   含该角色当前真实动向/打算/暗中打算，并附「主角不知情」限制提示——模型掌握真相防剧情冲突，叙事边界由提示守住。
import { getTavernHelper, getToastr } from '../env';
import { STANDARD_RECURSION } from '../constants';
import { dsCachePos, registerManagedWbEntry } from '../wb-position';
import { hasWorldbookProjectionDispatcher, requestWorldbookProjection } from '../worldbook-projection-events';
import { loadWorldState } from './world-store';
import { hasWorldState } from './world-store';
import { charThreadStage } from './world-state';
import { WORLD_FEATURE_KEY, type CharProfile, type WorldState } from './world-types';
import { deleteStoryFeature } from '../story-floor-store';
import { getConfig } from '../config-store';

export const WORLD_WB_NAME = 'UBS-世界演化-世界动态';
export const CHARACTER_DYNAMIC_WB_PREFIX = 'UBS-世界演化-角色动态-';
// O18-A：旧版条目名（`瑟瑟灵感状态栏-*`）兼容已退役——改由 core/legacy-worldbook-entries.ts
// 在投影全量刷新时统一回收；本模块只认当前名。

registerManagedWbEntry({
  match: (e: any) => (e?.comment || e?.name || '') === WORLD_WB_NAME,
  origPos: () => ({ type: 'at_depth', role: 'system', depth: 0, order: 199 }),
});

registerManagedWbEntry({
  match: (e: any) => String(e?.comment || e?.name || '').startsWith(CHARACTER_DYNAMIC_WB_PREFIX),
  origPos: () => ({ type: 'before_character_definition', role: 'system', depth: 0, order: 202 }),
});

export function buildWorldDigestContent(frontDigest: string): string {
  if (!frontDigest.trim()) return '';
  // WS10：入镜事件内容不进世界书蓝灯（主角可知通道）——入镜由「钩子」（玩家发送进输入框）与
  // 角色动态绿条目承载，蓝灯不预泄露。过滤所有「【X 入镜】」行（含在场角色动向行，活动恒空基本不出现）。
  const filtered = frontDigest.split('\n').filter(l => !l.includes('入镜】')).join('\n').trim();
  if (!filtered) return '';
  return `【世界动态】以下为最近幕后演化后、主角可知的世界动态。\n\n${filtered}`;
}

function sameEntry(a: any, b: any): boolean {
  return a?.name === b.name
    && a?.comment === b.comment
    && a?.enabled === b.enabled
    && a?.content === b.content
    && JSON.stringify(a?.strategy) === JSON.stringify(b.strategy)
    && JSON.stringify(a?.position) === JSON.stringify(b.position)
    && JSON.stringify(a?.recursion) === JSON.stringify(b.recursion)
    && a?.addMemo === b.addMemo
    && JSON.stringify(a?.triggers) === JSON.stringify(b.triggers);
}

function buildEntry(content: string): any {
  return {
    name: WORLD_WB_NAME,
    comment: WORLD_WB_NAME,
    enabled: Boolean(content),
    content,
    strategy: { type: 'constant', keys: [] },
    position: dsCachePos({ type: 'at_depth', role: 'system', depth: 0, order: 199 }),
    recursion: STANDARD_RECURSION,
    addMemo: true,
    triggers: [],
  };
}

/** 由投影协调器调用；不得 mutate getWorldbook 返回的原对象。 */
export function reconcileWorldWorldbookEntries(entries: any[], frontDigest?: string): boolean {
  const digest = frontDigest == null ? loadWorldState().frontDigest : frontDigest;
  const content = getConfig().worldEnabled === false ? '' : buildWorldDigestContent(digest);
  const idx = entries.findIndex((e: any) => (e?.comment || e?.name || '') === WORLD_WB_NAME);
  if (idx < 0 && !content) return false;
  if (idx < 0) {
    entries.push(buildEntry(content));
    return true;
  }
  if (!content) {
    entries.splice(idx, 1);
    return true;
  }
  const target = buildEntry(content);
  if (sameEntry(entries[idx], target)) return false;
  entries[idx] = { ...entries[idx], ...target };
  return true;
}

async function getCharWorldbookNames(): Promise<string[]> {
  // 仅无 dispatcher 的兜底路径使用
  const w = getTavernHelper();
  if (!w || typeof w.getCharWorldbookNames !== 'function') return [];
  const names: string[] = [];
  try {
    const cw = w.getCharWorldbookNames('current');
    if (cw?.primary) names.push(cw.primary);
    if (Array.isArray(cw?.additional)) names.push(...cw.additional);
  } catch (_e) { /* ignore */ }
  return names;
}

export async function projectWorldDigest(frontDigest: string): Promise<void> {
  if (hasWorldbookProjectionDispatcher()) {
    requestWorldbookProjection('world', 'data-change');
    return;
  }
  // —— 以下为无 dispatcher 的直写兜底 ——
  const toastr = getToastr();
  const wbNames = await getCharWorldbookNames();
  if (!wbNames.length) return;
  const content = buildWorldDigestContent(frontDigest);
  for (const wbName of wbNames) {
    try {
      const w = getTavernHelper();
      const wb = await w.getWorldbook(wbName);
      if (!Array.isArray(wb)) continue;
      const filtered = wb.filter((e: any) => { const n = (e?.comment || e?.name || ''); return n !== WORLD_WB_NAME; });
      if (content) filtered.push(buildEntry(content));
      await w.replaceWorldbook(wbName, filtered);
    } catch (_e) { /* skip single book */ }
  }
  if (!content) toastr?.info('世界动态已清空（无主角可知内容）', '世界动态');
}

export async function cleanupWorldDigest(): Promise<void> {
  if (hasWorldbookProjectionDispatcher()) {
    requestWorldbookProjection('world', 'config-change');
    return;
  }
  const wbNames = await getCharWorldbookNames();
  for (const wbName of wbNames) {
    try {
      const w = getTavernHelper();
      const wb = await w.getWorldbook(wbName);
      if (!Array.isArray(wb)) continue;
      const filtered = wb.filter((e: any) => { const n = (e?.comment || e?.name || ''); return n !== WORLD_WB_NAME; });
      if (filtered.length !== wb.length) await w.replaceWorldbook(wbName, filtered);
    } catch (_e) { /* skip single book */ }
  }
}

// ═══════════════════════════════════════════════════════════════
// 角色动态（绿灯条目族）—— 用户修正：含暗中打算+「主角不知情」提示；在场角色条目不移除
// ═══════════════════════════════════════════════════════════════

/** 该角色当前入镜事件信息（desc + 是否已触发；无 desc 或无事件返回 null）。
 *  pending=待发生（等待主角触发）；acted=近期已入镜（TTL 两轮内消散）。 */
function arrivalEventInfo(state: WorldState | undefined, name: string): { desc: string; acted: boolean } | null {
  if (!state) return null;
  const it = (state.pendingIntrusions || []).find(i => i.kind === 'character_arrival' && i.refId === name && (i.desc || '').trim());
  if (!it) return null;
  return { desc: it.desc!.trim(), acted: it.status === 'acted' };
}

/** 角色是否有可注入角色动态条目的内容（不构造字符串，仅布尔判定；供 reconcile 判空用）。
 *  动向仅当动向日期（updatedAt）与当前日期（state.lastEvolveDateKey）一致时计入——
 *  旧日期的动向视为过时、不注入；打算/暗中打算/入镜事件不受日期闸影响。 */
function hasCharacterDynamicContent(p: CharProfile, state: WorldState | undefined, currentDate: string): boolean {
  if (currentDate && p.updatedAt === currentDate) return true; // 动向可注入（含「如常」）
  if (p.plans) return true;
  if (p.hiddenGoal) return true;
  if (arrivalEventInfo(state, p.name)) return true;
  return false;
}

/** 角色动态条目：绿色 selective、关键词=角色名、注入角色定义前 order 202、整条替换不可迭代。
 *  首行含「截至 YYYY-MM-DD」（updatedAt 优先、lastEvolveDateKey 回退、都空无前缀）——模型可判断信息新旧。
 *  WS10：入镜事件描述（完整前因后果）随 pendingIntrusions 注入，主角不知情包装承载幕后真相。
 *  动向日期闸：仅当 updatedAt 与当前日期（state.lastEvolveDateKey）一致时注入动向行；
 *  旧日期动向视为过时不注入，但打算/暗中打算/入镜事件仍正常注入。 */
export function buildCharacterDynamicEntry(name: string, p: CharProfile, state?: WorldState): any {
  const currentDate = state?.lastEvolveDateKey || '';
  const parts = characterDynamicParts(p, state, currentDate);
  const asOf = p.updatedAt || state?.lastEvolveDateKey || '';
  const asOfPart = asOf ? `截至 ${asOf} ` : '';
  const content = `以下是${name}${asOfPart}不在主角视野中的真实状态（主角不知情；除非剧情自然推进令其得知，否则不得作为主角已知信息使用）。\n· ${parts.join('\n· ')}`;
  return {
    name: `${CHARACTER_DYNAMIC_WB_PREFIX}${name}`,
    comment: `${CHARACTER_DYNAMIC_WB_PREFIX}${name}`,
    enabled: true,
    content,
    strategy: { type: 'selective', keys: [name] },
    position: dsCachePos({ type: 'before_character_definition', role: 'system', depth: 0, order: 202 }),
    recursion: STANDARD_RECURSION,
    addMemo: true,
    triggers: [],
  };
}

/** 构造角色动态条目正文各字段行（不含包装语）。动向行受日期闸控制，其余字段不受影响。 */
function characterDynamicParts(p: CharProfile, state: WorldState | undefined, currentDate: string): string[] {
  const parts: string[] = [];
  // 动向日期闸：仅当动向日期与当前日期一致时注入；旧日期动向视为过时不注入
  if (currentDate && p.updatedAt === currentDate) {
    parts.push(`动向：${p.activity || '如常'}`);
  }
  if (p.plans) parts.push(`打算：${p.plans}`);
  if (p.hiddenGoal) {
    // WS4：暗中打算线程携带进度/阶段（主角不知情提示保留）；WS9：进展文字说明
    const g = Number(p.goalProgress);
    const threadText = typeof p.goalProgress === 'number'
      ? (g >= 100 ? `暗中打算（已完成）：${p.hiddenGoal}` : `暗中打算（${Math.round(g)}%·${charThreadStage(g)}）：${p.hiddenGoal}${p.goalProgressText ? `——${p.goalProgressText}` : ''}`)
      : `暗中打算：${p.hiddenGoal}`;
    parts.push(threadText);
  }
  const arr = arrivalEventInfo(state, p.name);
  if (arr) parts.push(arr.acted ? `近期已入镜（近两轮内消散）：${arr.desc}` : `待发生事件（等待主角触发）：${arr.desc}`);
  return parts;
}

function sameCharacterEntry(a: any, b: any): boolean {
  return a?.name === b.name
    && a?.content === b.content
    && JSON.stringify(a?.strategy) === JSON.stringify(b.strategy)
    && JSON.stringify(a?.position) === JSON.stringify(b.position)
    && JSON.stringify(a?.recursion) === JSON.stringify(b.recursion)
    && a?.enabled === b.enabled;
}

/** 由投影协调器调用；同步全部「有动向/打算/暗中打算」角色的动态条目（在场不移除，只随变动即时更新内容）。 */
export function reconcileCharacterDynamicEntries(entries: any[], state?: WorldState): boolean {
  const st = state || loadWorldState();
  const currentDate = st.lastEvolveDateKey || '';
  const desired = new Map<string, { entry: any }>();
  for (const p of Object.values(st.profiles)) {
    if (!hasCharacterDynamicContent(p, st, currentDate)) continue; // 无可注入内容不建（旧日期动向不计入）
    const entry = buildCharacterDynamicEntry(p.name, p, st);
    desired.set(entry.name, { entry });
  }
  let changed = false;
  // 移除：本族条目但角色已从追踪表删除/全空
  for (let i = entries.length - 1; i >= 0; i--) {
    const n = String(entries[i]?.comment || entries[i]?.name || '');
    if (n.startsWith(CHARACTER_DYNAMIC_WB_PREFIX) && !desired.has(n)) {
      entries.splice(i, 1);
      changed = true;
    }
  }
  // 新增/替换：需要但缺失或内容不同（不 mutate 原对象）
  for (const { entry } of desired.values()) {
    const idx = entries.findIndex((e: any) => (e?.comment || e?.name || '') === entry.name);
    if (idx < 0) { entries.push(entry); changed = true; }
    else if (!sameCharacterEntry(entries[idx], entry)) { entries[idx] = { ...entries[idx], ...entry }; changed = true; }
  }
  return changed;
}

/** 投影角色动态条目（dispatcher 优先；无 dispatcher 直写兜底）。 */
export async function projectCharacterDynamics(): Promise<void> {
  if (hasWorldbookProjectionDispatcher()) {
    requestWorldbookProjection('character-dynamic', 'data-change');
    return;
  }
  const wbNames = await getCharWorldbookNames();
  for (const wbName of wbNames) {
    try {
      const w = getTavernHelper();
      const wb = await w.getWorldbook(wbName);
      if (!Array.isArray(wb)) continue;
      const changed = reconcileCharacterDynamicEntries(wb, loadWorldState());
      if (changed) await w.replaceWorldbook(wbName, wb);
    } catch (_e) { /* skip single book */ }
  }
}

/** 移除角色动态条目族（无 dispatcher 直写兜底）。 */
export async function cleanupCharacterDynamics(): Promise<void> {
  if (hasWorldbookProjectionDispatcher()) {
    requestWorldbookProjection('character-dynamic', 'config-change');
    return;
  }
  const wbNames = await getCharWorldbookNames();
  for (const wbName of wbNames) {
    try {
      const w = getTavernHelper();
      const wb = await w.getWorldbook(wbName);
      if (!Array.isArray(wb)) continue;
      const filtered = wb.filter((e: any) => { const n = String(e?.comment || e?.name || ''); return !n.startsWith(CHARACTER_DYNAMIC_WB_PREFIX); });
      if (filtered.length !== wb.length) await w.replaceWorldbook(wbName, filtered);
    } catch (_e) { /* skip single book */ }
  }
}

/** 重置世界演化：删除当前聊天世界状态 + 清理世界书注入条目（世界动态 + 角色动态）。 */
export async function resetWorldEvolution(): Promise<{ ok: boolean }> {
  const had = hasWorldState();
  if (had && !(await deleteStoryFeature(WORLD_FEATURE_KEY))) {
    return { ok: false };
  }
  await cleanupWorldDigest();
  await cleanupCharacterDynamics();
  return { ok: true };
}
