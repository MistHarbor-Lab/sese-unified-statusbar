import {
  type ChatOwner,
  type ChatStorageDomain,
  type ChatStorageIdentityHost,
  type ChatStorageIdentityResult,
  type ChatStorageMeta,
  markAnchoredHistory,
  markChatDomainCreated,
  normalizeChatStorageMeta,
  saveChatStorageMeta,
} from './chat-storage-identity';
import { cloneJson } from './external-storage-codec';
import { createPortraitPersistentStore } from './portrait-persistent-store';
import { createStoryDomainStore, type StoryDomainJournal } from './story-domain-store';
import type { StoryDomain } from './story-domain-router';
import type { ServerFileStore } from './server-file-store';

export type ForkChatStorageResult =
  | { ok: true; storageId: string }
  | { ok: false; retryable: boolean; error: string };

export type PrepareChatStorageForkResult =
  | { ok: true; meta: ChatStorageMeta }
  | { ok: false; retryable: boolean; error: string };

export interface ForkChatStorageDeps {
  files: ServerFileStore;
  host: ChatStorageIdentityHost;
  meta: ChatStorageMeta;
  owner: ChatOwner;
  activeAnchors: ReadonlySet<string>;
  now: () => number;
}

function failure(error: string, retryable = true): ForkChatStorageResult {
  return { ok: false, retryable, error };
}

function currentMeta(host: ChatStorageIdentityHost): ChatStorageMeta | null {
  return normalizeChatStorageMeta(host.getCurrent()?.metadata?.unifiedStatusbar);
}

export async function prepareChatStorageFork(
  host: ChatStorageIdentityHost,
  result: Extract<ChatStorageIdentityResult, { kind: 'fork-required' }>,
  makeUuid: () => string,
): Promise<PrepareChatStorageForkResult> {
  const next: ChatStorageMeta = {
    storageId: String(makeUuid()).toLowerCase(),
    schema: 3,
    domainsCreated: [],
    hasAnchoredHistory: false,
    forkSource: {
      storageId: result.parentStorageId,
      owner: cloneJson(result.parentOwner),
      domainsCreated: [...result.meta.domainsCreated],
      hasAnchoredHistory: result.meta.hasAnchoredHistory,
    },
  };
  const normalized = normalizeChatStorageMeta(next);
  if (!normalized || normalized.storageId === result.parentStorageId) {
    return { ok: false, retryable: false, error: 'invalid fork target UUID' };
  }
  if (!await saveChatStorageMeta(host, result.parentStorageId, normalized)) {
    return { ok: false, retryable: true, error: 'unable to persist forkSource metadata' };
  }
  return { ok: true, meta: normalized };
}

function reachableJournal(
  journal: StoryDomainJournal,
  activeAnchors: ReadonlySet<string>,
): StoryDomainJournal {
  return {
    baseline: cloneJson(journal.baseline),
    entries: journal.entries
      .filter(entry => activeAnchors.has(entry.anchor))
      .sort((left, right) => left.revision - right.revision)
      .map(entry => cloneJson(entry)),
  };
}

async function copyStoryDomain(
  deps: ForkChatStorageDeps,
  domain: StoryDomain,
  sourceMeta: NonNullable<ChatStorageMeta['forkSource']>,
): Promise<ForkChatStorageResult | null> {
  const markerDomain: ChatStorageDomain = domain;
  const latest = currentMeta(deps.host);
  if (!latest || latest.storageId !== deps.meta.storageId || !latest.forkSource) {
    return failure('fork metadata changed during copy', false);
  }

  const target = createStoryDomainStore({
    files: deps.files,
    storageId: latest.storageId,
    domain,
    owner: deps.owner,
    domainCreated: latest.domainsCreated.includes(markerDomain),
    // forkSource is the only authority allowed to initialize a still-uncreated
    // target domain after another copied domain has already raised the shared marker.
    hasAnchoredHistory: false,
    getActiveAnchors: () => deps.activeAnchors,
    now: deps.now,
    onDomainCreated: () => markChatDomainCreated(deps.host, latest.storageId, markerDomain),
    onAnchoredHistory: () => markAnchoredHistory(deps.host, latest.storageId),
  });
  const targetStatus = await target.load();
  if (targetStatus.state === 'ready') {
    const repaired = currentMeta(deps.host);
    return repaired?.domainsCreated.includes(markerDomain)
      ? null
      : failure(`${domain} target marker repair failed`);
  }
  if (targetStatus.state !== 'uninitialized') {
    return failure(targetStatus.lastError || `${domain} target is not writable`, false);
  }

  const parent = createStoryDomainStore({
    files: deps.files,
    storageId: sourceMeta.storageId,
    domain,
    owner: sourceMeta.owner,
    domainCreated: true,
    hasAnchoredHistory: sourceMeta.hasAnchoredHistory,
    getActiveAnchors: () => deps.activeAnchors,
    now: deps.now,
    onDomainCreated: async () => true,
    onAnchoredHistory: async () => true,
  });
  const parentStatus = await parent.load();
  if (parentStatus.state !== 'ready') {
    return failure(parentStatus.lastError || `${domain} parent domain is missing`, false);
  }
  const copied = reachableJournal(parent.exportJournal(), deps.activeAnchors);
  const committed = await target.replaceJournal(copied);
  if (!committed.ok || !committed.confirmed) {
    return failure(committed.error || `${domain} copy failed`, committed.retryable);
  }
  const marked = currentMeta(deps.host);
  return marked?.domainsCreated.includes(markerDomain)
    ? null
    : failure(`${domain} domain marker was not confirmed`);
}

async function copyPortraits(
  deps: ForkChatStorageDeps,
  sourceMeta: NonNullable<ChatStorageMeta['forkSource']>,
): Promise<ForkChatStorageResult | null> {
  const latest = currentMeta(deps.host);
  if (!latest || latest.storageId !== deps.meta.storageId || !latest.forkSource) {
    return failure('fork metadata changed during portrait copy', false);
  }
  const target = createPortraitPersistentStore({
    files: deps.files,
    storageId: latest.storageId,
    owner: deps.owner,
    domainCreated: latest.domainsCreated.includes('portraits'),
    now: deps.now,
    onDomainCreated: () => markChatDomainCreated(deps.host, latest.storageId, 'portraits'),
  });
  const targetStatus = await target.load();
  if (targetStatus.state === 'ready') {
    const repaired = currentMeta(deps.host);
    return repaired?.domainsCreated.includes('portraits')
      ? null
      : failure('portraits target marker repair failed');
  }
  if (targetStatus.state !== 'uninitialized') {
    return failure(targetStatus.lastError || 'portraits target is not writable', false);
  }

  const parent = createPortraitPersistentStore({
    files: deps.files,
    storageId: sourceMeta.storageId,
    owner: sourceMeta.owner,
    domainCreated: true,
    now: deps.now,
    onDomainCreated: async () => true,
  });
  const parentStatus = await parent.load();
  if (parentStatus.state !== 'ready') {
    return failure(parentStatus.lastError || 'parent portraits domain is missing', false);
  }
  if (!await target.replaceAll(parent.readAll())) return failure('portrait copy failed');
  const marked = currentMeta(deps.host);
  return marked?.domainsCreated.includes('portraits')
    ? null
    : failure('portraits domain marker was not confirmed');
}

export async function forkChatStorage(
  deps: ForkChatStorageDeps,
): Promise<ForkChatStorageResult> {
  const normalized = normalizeChatStorageMeta(deps.meta);
  if (!normalized?.forkSource) return failure('forkSource metadata is missing', false);
  const source = normalized.forkSource;

  for (const domain of ['story-core', 'story-map'] as const) {
    if (!source.domainsCreated.includes(domain)) continue;
    const failed = await copyStoryDomain({ ...deps, meta: normalized }, domain, source);
    if (failed) return failed;
  }
  if (source.domainsCreated.includes('portraits')) {
    const failed = await copyPortraits({ ...deps, meta: normalized }, source);
    if (failed) return failed;
  }

  const latest = currentMeta(deps.host);
  if (!latest || latest.storageId !== normalized.storageId || !latest.forkSource) {
    return failure('fork metadata changed before finalize', false);
  }
  for (const domain of source.domainsCreated) {
    if (!latest.domainsCreated.includes(domain)) return failure(`fork domain incomplete: ${domain}`);
  }
  const finalized: ChatStorageMeta = {
    storageId: latest.storageId,
    schema: 3,
    domainsCreated: [...latest.domainsCreated],
    hasAnchoredHistory: latest.hasAnchoredHistory || source.hasAnchoredHistory,
  };
  if (!await saveChatStorageMeta(deps.host, latest.storageId, finalized)) {
    return failure('unable to clear forkSource metadata');
  }
  return { ok: true, storageId: latest.storageId };
}
