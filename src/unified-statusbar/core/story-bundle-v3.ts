import type { AtomicCommitResult } from './atomic-envelope-store';
import { cloneJson } from './external-storage-codec';
import type { ExternalStoreStatus } from './external-storage-types';
import type { PortraitPersistentStore } from './portrait-persistent-store';
import type { StoryDomainStore } from './story-domain-store';
import {
  appendStoryFeaturePatch,
  storyDomainForFeatureKey,
} from './story-domain-router';

export interface StoryJournalFacadeV3 {
  load(): Promise<ExternalStoreStatus>;
  read<T>(key: string, fallback: T): T;
  readAll(): Record<string, unknown>;
  write(updates: Record<string, unknown>, deletes?: string[]): Promise<boolean>;
  flush(): Promise<void>;
  status(): ExternalStoreStatus;
}

export interface StoryBundleV3 {
  journal: StoryJournalFacadeV3;
  portraits: PortraitPersistentStore;
  domains: {
    core: StoryDomainStore;
    map: StoryDomainStore;
  };
}

export interface StoryBundleV3Deps {
  core: StoryDomainStore;
  map: StoryDomainStore;
  portraits: PortraitPersistentStore;
  /** 写入绑定用当前稳定锚点（activeStoryAnchors 最后元素）。重放不做锚点过滤（全量重放，删除回退由删除事务负责）。 */
  getWriteAnchor: () => string | null;
}

function mergeStatuses(core: ExternalStoreStatus, map: ExternalStoreStatus): ExternalStoreStatus {
  const priority: ExternalStoreStatus['state'][] = ['read-only', 'conflict', 'error', 'ready', 'uninitialized'];
  const state = priority.find(candidate => core.state === candidate || map.state === candidate) || 'uninitialized';
  return {
    state,
    revision: Math.max(core.revision, map.revision),
    generation: core.generation || map.generation,
    pendingWrites: core.pendingWrites + map.pendingWrites,
    ...(core.lastError || map.lastError ? { lastError: core.lastError || map.lastError } : {}),
    ...(core.lastWarning || map.lastWarning ? { lastWarning: core.lastWarning || map.lastWarning } : {}),
  };
}

function commitOk(result: AtomicCommitResult | undefined): boolean {
  return !result || (result.ok && result.confirmed);
}

export function createStoryBundleV3(deps: StoryBundleV3Deps): StoryBundleV3 {
  const currentFeatures = (): Record<string, unknown> => ({
    ...deps.core.replay(),
    ...deps.map.replay(),
  });

  const journal: StoryJournalFacadeV3 = {
    async load(): Promise<ExternalStoreStatus> {
      const [core, map] = await Promise.all([deps.core.load(), deps.map.load()]);
      return mergeStatuses(core, map);
    },
    read<T>(key: string, fallback: T): T {
      const source = storyDomainForFeatureKey(key) === 'story-map' ? deps.map : deps.core;
      const value = source.replay();
      return Object.prototype.hasOwnProperty.call(value, key)
        ? cloneJson(value[key] as T)
        : cloneJson(fallback);
    },
    readAll: currentFeatures,
    async write(updates, deletes = []): Promise<boolean> {
      const anchor = deps.getWriteAnchor();
      if (!anchor) return false;
      const results = await appendStoryFeaturePatch(
        { 'story-core': deps.core, 'story-map': deps.map },
        anchor,
        cloneJson(updates || {}),
        [...deletes],
      );
      const ok = commitOk(results['story-core']) && commitOk(results['story-map']);
      return ok;
    },
    async flush(): Promise<void> {
      await Promise.all([deps.core.flush(), deps.map.flush()]);
    },
    status(): ExternalStoreStatus {
      return mergeStatuses(deps.core.status(), deps.map.status());
    },
  };

  return {
    journal,
    portraits: deps.portraits,
    domains: { core: deps.core, map: deps.map },
  };
}
