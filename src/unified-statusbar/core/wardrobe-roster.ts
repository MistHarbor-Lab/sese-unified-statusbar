// ===== 衣柜现有角色名单与档案协调 =====
import { getCellByHeader, getSheetByName } from './data-manager';
import {
  PROTAGONIST_ACTOR_KEY,
  normalizeWardrobeActorName,
  wardrobeCharacterActorKey,
} from './wardrobe-actors';
import type {
  WardrobeActorKey,
  WardrobeActorProfile,
  WardrobeState,
} from './wardrobe-types';

export interface WardrobeRosterEntry {
  actorKey: WardrobeActorKey;
  displayName: string;
  kind: 'protagonist' | 'character';
  present: boolean;
}

export interface WardrobeRosterSources {
  protagonistName: string;
  romanceNames: string[];
  importantNames: string[];
  presentNames: string[];
}

export function buildWardrobeRoster(
  sources: WardrobeRosterSources,
): WardrobeRosterEntry[] {
  const presentActorKeys = new Set<WardrobeActorKey>();
  for (const name of sources.presentNames) {
    const actorKey = wardrobeCharacterActorKey(name);
    if (actorKey) presentActorKeys.add(actorKey);
  }

  const roster: WardrobeRosterEntry[] = [{
    actorKey: PROTAGONIST_ACTOR_KEY,
    displayName: normalizeWardrobeActorName(sources.protagonistName),
    kind: 'protagonist',
    present: true,
  }];
  const seenActorKeys = new Set<WardrobeActorKey>([PROTAGONIST_ACTOR_KEY]);

  const appendNames = (names: readonly string[]): void => {
    for (const name of names) {
      const actorKey = wardrobeCharacterActorKey(name);
      if (!actorKey || seenActorKeys.has(actorKey)) continue;
      seenActorKeys.add(actorKey);
      roster.push({
        actorKey,
        displayName: normalizeWardrobeActorName(name),
        kind: 'character',
        present: presentActorKeys.has(actorKey),
      });
    }
  };

  appendNames(sources.romanceNames);
  appendNames(sources.importantNames);
  appendNames(sources.presentNames);
  return roster;
}

/** 读单张名单表的姓名列；表未暖缓存（getSheetByName null）或无「姓名」列时返回 null=名单不可用。
 *  绝不能返回 []——空数组会被 reconcile 误判为「全部角色已移出名单」而删除 NPC 档案。 */
function collectSheetNames(tableName: string): string[] | null {
  const sheet = getSheetByName(tableName);
  const nameColumn = sheet?.content[0]?.indexOf('姓名') ?? -1;
  if (!sheet || nameColumn < 0) return null;
  return sheet.content.slice(1).map(row => String(row[nameColumn] ?? ''));
}

/** 读四张名单表的原始姓名（主角 + 恋爱对象表 ∪ 重要角色表 ∪ 在场角色表）。
 *  任一表不可读时返回 null=名单不可用——调用方必须跳过删除型消费（reconcile/投影重排）；
 *  展示型调用点可 `?? []` 降级。抽成独立一步，供 O14 预闸与名单构建共用同一次读表。 */
export function readWardrobeRosterSources(): WardrobeRosterSources | null {
  const romanceNames = collectSheetNames('恋爱对象表');
  const importantNames = collectSheetNames('重要角色表');
  const presentNames = collectSheetNames('在场角色表');
  if (!romanceNames || !importantNames || !presentNames) return null;
  return {
    protagonistName: getCellByHeader('主角信息表', 1, '姓名') || '',
    romanceNames,
    importantNames,
    presentNames,
  };
}

/** 名单来源指纹（O14 修正）：名单 = f(来源)，故「指纹未变 ⇒ 名单必未变」。
 *  用 JSON 序列化而非分隔符拼接——姓名里出现分隔符字符也不会碰撞；
 *  比 buildWardrobeRoster + 序列化整份名单便宜（省去归一化/actorKey/条目对象）。 */
export function wardrobeRosterSourcesFingerprint(sources: WardrobeRosterSources | null): string {
  if (!sources) return 'unreadable';
  return JSON.stringify([
    sources.protagonistName,
    sources.romanceNames,
    sources.importantNames,
    sources.presentNames,
  ]);
}

/**
 * 收集衣柜名单（主角 + 恋爱对象表 ∪ 重要角色表 ∪ 在场角色表）。
 * 三张名单表任一不可读时返回 null=「名单不可用」——调用方必须跳过删除型消费
 * （reconcile/投影重排）；展示型调用点可 `?? []` 降级。
 * sources 可传入 readWardrobeRosterSources() 的结果以复用同一次读表（O14 预闸路径）；
 * 省略时自行读取，行为与改造前逐字节一致。
 */
export function collectWardrobeRoster(
  sources?: WardrobeRosterSources | null,
): WardrobeRosterEntry[] | null {
  const resolved = sources === undefined ? readWardrobeRosterSources() : sources;
  if (!resolved) return null;
  return buildWardrobeRoster(resolved);
}

/** 套装生图「故事中角色」模特候选：恋爱对象表 ∪ 重要角色表 的姓名列（按角色 key 去重，恋爱在前）。
 *  任一名单表不可读时返回 null（与名单不可用同语义），调用方自行降级为空列表。 */
export function collectOutfitModelCandidates(): string[] | null {
  const romanceNames = collectSheetNames('恋爱对象表');
  const importantNames = collectSheetNames('重要角色表');
  if (!romanceNames || !importantNames) return null;
  const seen = new Set<WardrobeActorKey>();
  const candidates: string[] = [];
  for (const name of [...romanceNames, ...importantNames]) {
    const trimmed = String(name || '').trim();
    const actorKey = wardrobeCharacterActorKey(trimmed);
    if (!actorKey || seen.has(actorKey)) continue;
    seen.add(actorKey);
    candidates.push(trimmed);
  }
  return candidates;
}

export function reconcileWardrobeProfiles(
  state: WardrobeState,
  roster: readonly WardrobeRosterEntry[],
): {
  state: WardrobeState;
  changed: boolean;
  removedActorKeys: string[];
} {
  const rosterByActorKey = new Map(roster.map(entry => [entry.actorKey, entry]));
  const rosterActorKeys = new Set(rosterByActorKey.keys());
  const removedActorKeys = Object.keys(state.actorProfiles).filter(actorKey => (
    actorKey !== PROTAGONIST_ACTOR_KEY && !rosterActorKeys.has(actorKey)
  ));
  const renamedActorKeys = Object.keys(state.actorProfiles).filter(actorKey => {
    if (actorKey === PROTAGONIST_ACTOR_KEY) return false;
    const rosterEntry = rosterByActorKey.get(actorKey);
    return !!rosterEntry && state.actorProfiles[actorKey].displayName !== rosterEntry.displayName;
  });
  if (removedActorKeys.length === 0 && renamedActorKeys.length === 0) {
    return { state, changed: false, removedActorKeys };
  }

  const actorProfiles: Record<WardrobeActorKey, WardrobeActorProfile> = {
    ...state.actorProfiles,
  };
  for (const actorKey of removedActorKeys) delete actorProfiles[actorKey];
  for (const actorKey of renamedActorKeys) {
    actorProfiles[actorKey] = {
      ...actorProfiles[actorKey],
      displayName: rosterByActorKey.get(actorKey)!.displayName,
    };
  }
  return {
    state: { ...state, actorProfiles },
    changed: true,
    removedActorKeys,
  };
}
