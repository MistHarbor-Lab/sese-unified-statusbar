import { getConfig } from './config-store';
import { playTypes , STANDARD_RECURSION } from './constants';
import { readSelectedPlays, type SelectedPlay } from './play-state-store';
import { getPlayLibrary } from './play-library';
import { dsCachePos, registerManagedWbEntry } from './wb-position';
import { requestWorldbookProjection } from './worldbook-projection-events';

export const PLAY_WB_NAME = 'UBS-玩法-清单（请勿手动开启）';
export const ITEM_USE_HEAD_WB_NAME = 'UBS-玩法-物品使用（头）';
export const ITEM_USE_TAIL_WB_NAME = 'UBS-玩法-物品使用（尾）';
const MANAGED_PREFIX = 'UBS-玩法-';
// O18-A：旧版条目名（`瑟瑟灵感状态栏-*`）兼容已退役——改由 core/legacy-worldbook-entries.ts
// 在投影全量刷新时统一回收旧名条目；本模块只认当前名。
function isEntryNamed(entry: any, name: string): boolean {
  return (entry?.comment || entry?.name || '') === name;
}

export function isManagedPlayEntry(comment: string): boolean {
  return typeof comment === 'string' && comment.startsWith(MANAGED_PREFIX);
}

interface PlayData {
  plays: Array<{ name: string; category: string; content: string }>;
  markers: { positionStart: string; positionEnd: string; itemHead: string; itemTail: string };
}

export function getPlayData(): PlayData | null {
  try {
    const host: any = window;
    const data = host.__ub_play_data || (host.parent && host.parent.__ub_play_data);
    return data && Array.isArray(data.plays) && data.markers ? data as PlayData : null;
  } catch (_e) {
    return null;
  }
}

const categoryOrder = new Map(playTypes.map((type, index) => [type.key, index]));
void categoryOrder;

/** 聚合内容：markers 头尾之间按「选择顺序」拼接各玩法写作指南（多选翻新后顺序即用户意图顺序；
 *  类别排序已废——mockup 审核定稿）。content 来源 = 内置库 + 自定义玩法（play-library）。 */
function buildPlayContent(data: PlayData, selected: SelectedPlay[]): string {
  const contentByName = new Map(data.plays.map(play => [play.name, play.content]));
  for (const custom of getPlayLibrary().customPlays) contentByName.set(custom.name, custom.content);
  return [data.markers.positionStart, ...selected.map(item => contentByName.get(item.name) || '').filter(Boolean), data.markers.positionEnd].join('\n');
}

function makePlayEntry(content: string, position: string, depth: number): any {
  return {
    name: PLAY_WB_NAME,
    comment: PLAY_WB_NAME,
    enabled: true,
    content,
    strategy: { type: 'constant', keys: [] },
    position: { type: position, depth, role: 'system', order: 801 },
    recursion: STANDARD_RECURSION,
    addMemo: true,
    triggers: [],
  };
}

function makeItemEntry(name: string, content: string, order: number): any {
  return {
    name,
    comment: name,
    enabled: true,
    content,
    strategy: { type: 'constant', keys: [] },
    position: dsCachePos({ type: 'at_depth', depth: 10000, role: 'system', order }),
    recursion: STANDARD_RECURSION,
    addMemo: true,
    triggers: [],
  };
}

export interface PlayWorldbookProjectionInput {
  position: string;
  depth: number;
  data: PlayData | null;
}

export function getPlayWorldbookProjectionInput(): PlayWorldbookProjectionInput {
  const cfg = getConfig();
  const target = dsCachePos({ type: cfg.nsfwPlayWorldbookPosition, role: 'system', depth: cfg.nsfwPlayWorldbookDepth, order: 801 });
  return { position: target.type, depth: target.depth, data: getPlayData() };
}

/** Mutates the coordinator-owned copy and reports whether it changed. */
export function reconcilePlayWorldbookEntries(entries: any[], selected: SelectedPlay[], input: PlayWorldbookProjectionInput): boolean {
  const index = entries.findIndex(entry => isEntryNamed(entry, PLAY_WB_NAME));
  if (selected.length === 0) {
    if (index < 0) return false;
    entries.splice(index, 1);
    return true;
  }
  if (!input.data) return false;
  const next = makePlayEntry(buildPlayContent(input.data, selected), input.position, input.depth);
  if (index < 0) {
    entries.push(next);
    return true;
  }
  const current = entries[index];
  if (current.content === next.content && current.enabled === true && current.position?.type === input.position && current.position?.depth === input.depth && current.position?.order === 801) return false;
  entries[index] = { ...current, ...next };
  return true;
}

/** Mutates the coordinator-owned copy and reports whether it changed. */
export function reconcileItemUseWorldbookEntries(entries: any[], active: boolean, data: PlayData | null): boolean {
  let changed = false;
  for (const [name, content, order] of [
    [ITEM_USE_HEAD_WB_NAME, data?.markers.itemHead || '', 8120],
    [ITEM_USE_TAIL_WB_NAME, data?.markers.itemTail || '', 8122],
  ] as Array<[string, string, number]>) {
    const index = entries.findIndex(entry => isEntryNamed(entry, name));
    if (active && data && content) {
      const next = makeItemEntry(name, content, order);
      if (index < 0) {
        entries.push(next);
        changed = true;
      } else if (entries[index].content !== content || entries[index].enabled !== true) {
        entries[index] = { ...entries[index], ...next };
        changed = true;
      }
    } else if (index >= 0) {
      entries.splice(index, 1);
      changed = true;
    }
  }
  return changed;
}

let latestSelected: SelectedPlay[] | null = null;
let latestItemUseActive: boolean | null = null;

export function syncPlayWorldbook(selected?: SelectedPlay[]): void {
  latestSelected = [...(selected ?? readSelectedPlays())];
  requestWorldbookProjection('play', 'data-change');
}

export function disablePlayWorldbook(): void {
  syncPlayWorldbook([]);
}

export function syncItemUseEntries(active: boolean): void {
  latestItemUseActive = active;
  requestWorldbookProjection('item-use', 'data-change');
}

export function disableItemUseEntries(): void {
  syncItemUseEntries(false);
}

export function resetPlayWorldbookCache(): void {
  latestSelected = null;
  latestItemUseActive = null;
}

export function getLatestPlayWorldbookSelection(): SelectedPlay[] {
  return latestSelected ? [...latestSelected] : readSelectedPlays();
}

export function getLatestItemUseWorldbookActive(): boolean {
  return latestItemUseActive ?? getConfig().itemUseEnabled;
}

registerManagedWbEntry({
  match: entry => isEntryNamed(entry, PLAY_WB_NAME),
  origPos: () => ({ type: getConfig().nsfwPlayWorldbookPosition, role: 'system', depth: getConfig().nsfwPlayWorldbookDepth, order: 801 }),
});
registerManagedWbEntry({ match: entry => isEntryNamed(entry, ITEM_USE_HEAD_WB_NAME), origPos: () => ({ type: 'at_depth', role: 'system', depth: 10000, order: 8120 }) });
registerManagedWbEntry({ match: entry => isEntryNamed(entry, ITEM_USE_TAIL_WB_NAME), origPos: () => ({ type: 'at_depth', role: 'system', depth: 10000, order: 8122 }) });
