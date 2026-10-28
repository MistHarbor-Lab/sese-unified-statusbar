// ===== 主角当前穿搭：story-floor → 角色世界书派生投影 =====
import { sameStringArray } from './type-guards';
import { STANDARD_RECURSION } from './constants';
import { fnv1a36 } from './stable-hash';
import { getWardrobeSnapshot } from './wardrobe-store';
import {
  PROTAGONIST_ACTOR_KEY,
  WARDROBE_DISPLAY_ORDER,
  selectionItemIds,
  type WardrobeActorProfile,
  type WardrobeItem,
  type WardrobeState,
} from './wardrobe-types';
import {
  type WardrobeRosterEntry,
} from './wardrobe-roster';
import { dsCachePos, registerManagedWbEntry } from './wb-position';
import { requestWorldbookProjection } from './worldbook-projection-events';

export const WARDROBE_PROTAGONIST_ENTRY_NAME = 'UBS-衣柜-主角当前穿搭';
export const WARDROBE_PROTAGONIST_ENTRY_COMMENT = '主角当前穿搭';
export const WARDROBE_PROTAGONIST_ENTRY_ORDER = 8125;
export const WARDROBE_CHARACTER_ENTRY_PREFIX = 'UBS-衣柜-角色当前穿搭-';
const WARDROBE_CHARACTER_ENTRY_ORDER = WARDROBE_PROTAGONIST_ENTRY_ORDER + 1;
const WARDROBE_PERSISTENCE_PARAGRAPH = '除非用户在对话中明确要求脱下、更换、损坏或丢弃，后续叙事应保持这些服饰，不要无故恢复旧穿搭或新增未列出的衣物。';

export interface WardrobeWorldbookBindings {
  primary?: string | null;
  additional?: string[];
}

export interface WardrobeWorldbookSyncResult {
  ok: boolean;
  error?: string;
  stale?: boolean;
}

export interface WardrobeWorldbookSyncOptions {
  isCurrent?: () => boolean;
}

export type WardrobeProjectionMutationResult =
  | { ok: true; value: { changed: boolean } }
  | { ok: false; error: string };

export interface WardrobeProjectionOrchestrationDeps {
  isEnabled(): boolean;
  getProjectionIdentity(): string;
  /** 名单表未暖缓存时返回 null=名单不可用；null 时本编排直接跳过（绝不能当空名单处理）。 */
  collectRoster(): readonly WardrobeRosterEntry[] | null;
  process(
    roster: readonly WardrobeRosterEntry[],
    dateKey: string,
    rng: () => number,
  ): Promise<WardrobeProjectionMutationResult>;
  getSnapshot(): WardrobeState;
  project(
    state: WardrobeState,
    roster: readonly WardrobeRosterEntry[],
    enabled: true,
    originIdentity: string,
  ): Promise<WardrobeWorldbookSyncResult>;
  disable(originIdentity: string): Promise<WardrobeWorldbookSyncResult>;
}

export interface WardrobeProjectionOrchestrationOptions {
  dateKey?: string;
  rng?: () => number;
  originIdentity?: string;
}

export interface WardrobeProjectionOrchestrationResult extends WardrobeWorldbookSyncResult {
  changed: boolean;
}

export function createWardrobePanelOpenCoordinator(
  getActivePopup: () => string | null,
) {
  let generation = 0;
  return {
    invalidate(): void {
      generation++;
    },
    async open(
      prepare: () => Promise<boolean>,
      show: () => void,
    ): Promise<boolean> {
      const requestGeneration = ++generation;
      const ready = await prepare();
      if (!ready
        || requestGeneration !== generation
        || getActivePopup() !== 'wardrobe') {
        return false;
      }
      show();
      return true;
    },
  };
}

export function createWardrobeProjectionOrchestrator(
  deps: WardrobeProjectionOrchestrationDeps,
) {
  return async function orchestrateWardrobeProjection(
    options: WardrobeProjectionOrchestrationOptions = {},
  ): Promise<WardrobeProjectionOrchestrationResult> {
    const originIdentity = options.originIdentity || deps.getProjectionIdentity();
    if (deps.getProjectionIdentity() !== originIdentity) {
      return {
        ok: false,
        stale: true,
        error: '聊天已切换，本次衣柜协调已取消',
        changed: false,
      };
    }
    if (!deps.isEnabled()) {
      return {
        ...(await deps.disable(originIdentity)),
        changed: false,
      };
    }
    const roster = deps.collectRoster();
    if (!roster) {
      // 名单表不可读（冷启动/切卡窗口）：跳过本 tick——把 null 当空名单喂给 reconcile
      // 会把全部 NPC 穿搭档案误判为「已移出名单」而持久化删除。表暖后下个 tick 自动重试。
      return { ok: true, changed: false };
    }
    const mutation = await deps.process(
      roster,
      options.dateKey || '',
      options.rng || Math.random,
    );
    if (!mutation.ok) {
      return { ok: false, error: mutation.error, changed: false };
    }
    return {
      ...(await deps.project(deps.getSnapshot(), roster, true, originIdentity)),
      changed: mutation.value.changed,
    };
  };
}

function resolvedOutfitItems(
  state: WardrobeState,
  profile: WardrobeActorProfile | undefined,
): WardrobeItem[] {
  if (!profile) return [];
  const byId = new Map(state.items.map(item => [item.id, item]));
  return selectionItemIds(profile.currentOutfit)
    .map(id => byId.get(id))
    .filter((item): item is WardrobeItem => !!item);
}

export function buildActorOutfitContent(
  state: WardrobeState,
  profile: WardrobeActorProfile,
): string {
  const items = resolvedOutfitItems(state, profile);
  if (items.length === 0) return '';
  const lines = [
    `【${profile.actorKey === PROTAGONIST_ACTOR_KEY ? '主角' : profile.displayName}当前穿搭｜持续事实】`,
    WARDROBE_PERSISTENCE_PARAGRAPH,
  ];
  for (const category of WARDROBE_DISPLAY_ORDER) {
    const group = items.filter(item => item.category === category);
    if (group.length === 0) continue;
    if (category === '配饰') {
      lines.push('配饰：', ...group.map(item => `· ${item.name}——${item.description}`));
    } else {
      const item = group[0];
      lines.push(`${category}：${item.name}——${item.description}`);
    }
  }
  return lines.join('\n');
}

function protagonistProfile(state: WardrobeState): WardrobeActorProfile | undefined {
  return state.actorProfiles?.[PROTAGONIST_ACTOR_KEY];
}

export function buildProtagonistOutfitContent(state: WardrobeState): string {
  const profile = protagonistProfile(state);
  return profile ? buildActorOutfitContent(state, profile) : '';
}

export function buildProtagonistOutfitItems(state: WardrobeState): string {
  const items = resolvedOutfitItems(state, protagonistProfile(state));
  if (items.length === 0) return '';
  const singles = items.filter(item => item.category !== '配饰').map(item => item.name);
  const accessories = items.filter(item => item.category === '配饰').map(item => item.name);
  return [...singles, ...accessories].join('、');
}

export function buildProtagonistOutfitSummary(state: WardrobeState): string {
  const items = buildProtagonistOutfitItems(state);
  return items ? `当前穿搭：${items}` : '当前穿搭：未设置';
}

// O18-A：旧条目名/前缀（`__wardrobe_protagonist_current` / `__wardrobe_character_current_`）
// 兼容已退役——改由 core/legacy-worldbook-entries.ts 在投影全量刷新时统一回收；本模块只认当前名。

function protagonistManagedEntry(entry: any): boolean {
  const display = String(entry?.comment || entry?.name || '').trim();
  return display === WARDROBE_PROTAGONIST_ENTRY_COMMENT
    || display === WARDROBE_PROTAGONIST_ENTRY_NAME;
}

function characterManagedEntry(entry: any): boolean {
  const comment = String(entry?.comment || '').trim();
  const name = String(entry?.name || '').trim();
  return comment.startsWith(WARDROBE_CHARACTER_ENTRY_PREFIX)
    || name.startsWith(WARDROBE_CHARACTER_ENTRY_PREFIX);
}

function managedEntry(entry: any): boolean {
  return protagonistManagedEntry(entry) || characterManagedEntry(entry);
}

const WARDROBE_ORIG_POS = { type: 'before_character_definition', role: 'system', depth: 2, order: WARDROBE_PROTAGONIST_ENTRY_ORDER } as const;
const WARDROBE_CHARACTER_ORIG_POS = { type: 'before_character_definition', role: 'system', depth: 2, order: WARDROBE_CHARACTER_ENTRY_ORDER } as const;

function makeEntry(content: string): any {
  return {
    name: WARDROBE_PROTAGONIST_ENTRY_NAME,
    comment: WARDROBE_PROTAGONIST_ENTRY_COMMENT,
    enabled: true,
    content,
    strategy: { type: 'constant', keys: [] },
    position: dsCachePos(WARDROBE_ORIG_POS),
    recursion: STANDARD_RECURSION,
    addMemo: true,
    triggers: [],
  };
}

function stableActorKeyHash(value: string): string {
  return fnv1a36(value);
}

function makeCharacterEntry(profile: WardrobeActorProfile, content: string): any {
  return {
    name: `${WARDROBE_CHARACTER_ENTRY_PREFIX}${stableActorKeyHash(profile.actorKey)}`,
    comment: `${profile.displayName}当前穿搭`,
    enabled: true,
    content,
    strategy: { type: 'selective', keys: [profile.displayName] },
    position: dsCachePos(WARDROBE_CHARACTER_ORIG_POS),
    recursion: STANDARD_RECURSION,
    addMemo: true,
    triggers: [],
  };
}

function sameExpectedManagedEntry(entry: any, target: any): boolean {
  return entry?.name === target.name
    && entry?.comment === target.comment
    && entry?.enabled === true
    && entry?.content === target.content
    && entry?.strategy?.type === target.strategy.type
    && sameStringArray(entry?.strategy?.keys, target.strategy.keys)
    && entry?.position?.type === target.position.type
    && entry?.position?.role === target.position.role
    && entry?.position?.depth === target.position.depth
    && entry?.position?.order === target.position.order
    && entry?.recursion?.prevent_incoming === true
    && entry?.recursion?.prevent_outgoing === true
    && entry?.recursion?.delay_until == null
    && entry?.addMemo === true
    && sameStringArray(entry?.triggers, target.triggers);
}

// 保留原主角比较助手的形状，既兼容既有 DS 缓存回归，也继续按当前配置构造目标 position。
function sameManagedEntry(entry: any, content: string): boolean {
  const target = makeEntry(content);
  return sameExpectedManagedEntry(entry, target);
}

function desiredManagedEntries(
  state: WardrobeState,
  roster: readonly WardrobeRosterEntry[],
  enabled: boolean,
): any[] {
  if (!enabled) return [];
  const desired: any[] = [];
  const protagonist = protagonistProfile(state);
  if (protagonist) {
    const content = buildActorOutfitContent(state, protagonist);
    if (content) desired.push(makeEntry(content));
  }
  const seenActorKeys = new Set<string>();
  for (const actor of roster) {
    if (actor.kind !== 'character' || seenActorKeys.has(actor.actorKey)) continue;
    seenActorKeys.add(actor.actorKey);
    const profile = state.actorProfiles?.[actor.actorKey];
    if (!profile) continue;
    const content = buildActorOutfitContent(state, profile);
    if (content) desired.push(makeCharacterEntry(profile, content));
  }
  return desired;
}

function sameManagedRun(
  current: any[],
  managedIndices: readonly number[],
  desired: readonly any[],
): boolean {
  if (managedIndices.length !== desired.length) return false;
  if (desired.length === 0) return true;
  const firstIndex = managedIndices[0];
  return managedIndices.every((entryIndex, index) => (
    entryIndex === firstIndex + index
    && (
      desired[index].name === WARDROBE_PROTAGONIST_ENTRY_NAME
        ? sameManagedEntry(current[entryIndex], desired[index].content)
        : sameExpectedManagedEntry(current[entryIndex], desired[index])
    )
  ));
}

/** Mutates the coordinator-owned entry copy and reports whether it changed. */
export function reconcileWardrobeWorldbookEntries(
  entries: any[],
  state: WardrobeState,
  roster: readonly WardrobeRosterEntry[],
  enabled: boolean,
): boolean {
  const desired = desiredManagedEntries(state, roster, enabled);
  const managedIndices = entries
    .map((entry, index) => managedEntry(entry) ? index : -1)
    .filter(index => index >= 0);
  if (sameManagedRun(entries, managedIndices, desired)) return false;
  const insertionIndex = managedIndices[0] ?? entries.length;
  const next = entries.filter(entry => !managedEntry(entry));
  next.splice(Math.min(insertionIndex, next.length), 0, ...desired);
  entries.splice(0, entries.length, ...next);
  return true;
}


export function createWardrobeProjectionCoordinator(
  getCurrentChatKey: () => string,
) {
  let tail: Promise<void> = Promise.resolve();
  return function coordinateWardrobeProjection(
    originChatKey: string,
    project: (
      isCurrent: () => boolean,
    ) => Promise<WardrobeWorldbookSyncResult>,
  ): Promise<WardrobeWorldbookSyncResult> {
    const expectedChatKey = String(originChatKey || '');
    const isCurrent = (): boolean => getCurrentChatKey() === expectedChatKey;
    const run = tail.catch(() => undefined).then(() => (
      isCurrent()
        ? project(isCurrent)
        : {
          ok: false,
          stale: true,
          error: '聊天已切换，本次衣柜世界书投影已取消',
        }
    ));
    tail = run.then(() => undefined, () => undefined);
    return run;
  };
}


export async function syncWardrobeWorldbook(
  _state?: WardrobeState,
  _roster?: readonly WardrobeRosterEntry[],
  _enabled?: boolean,
  _options?: WardrobeWorldbookSyncOptions,
): Promise<WardrobeWorldbookSyncResult> {
  // 投影统一走事件驱动的 worldbook projection registry（scope+feature epoch 守卫，
  // 读后/写后 isCurrent recheck，切卡由 advanceWorldbookProjectionScope 作废在途任务）。
  requestWorldbookProjection('wardrobe', 'data-change');
  return { ok: true };
}

export function disableWardrobeWorldbook(
  options?: WardrobeWorldbookSyncOptions,
): Promise<WardrobeWorldbookSyncResult> {
  return syncWardrobeWorldbook(getWardrobeSnapshot(), [], false, options);
}


// DS 缓存优化：分别登记主角 constant 与 NPC selective 受管条目。
registerManagedWbEntry({ match: protagonistManagedEntry, origPos: () => WARDROBE_ORIG_POS });
registerManagedWbEntry({ match: characterManagedEntry, origPos: () => WARDROBE_CHARACTER_ORIG_POS });
