import { isRecord } from './type-guards';
import {
  configureAchievementStorage,
  flushNow as flushAchievementBook,
  loadAchievementStore,
} from './achievement-store';
import {
  configureConfigStorage,
  flushConfigStorage,
  getConfig,
  invalidateConfigCache,
} from './config-store';
import {
  activeStoryAnchors,
  activeStoryReplayAnchors,
} from './external-story-store';
import {
  createExternalObjectStore,
  type ExternalObjectStore,
} from './external-object-store';
import { checksumValue, cloneJson, stableStringify } from './external-storage-codec';
import { UB_EVENT, emitUbEvent } from './events';
import { makeUniqueId } from './id';
import { serverFileStore, type ServerFileStore } from './server-file-store';
import { createPortraitPersistentStore } from './portrait-persistent-store';
import {
  chatStorageHash,
  createChatStorageUuid,
  markAnchoredHistory,
  markChatDomainCreated,
  normalizeChatStorageMeta,
  resolveChatStorageIdentity,
  saveChatStorageMeta,
  type ChatOwner,
  type ChatStorageIdentityHost,
  type ChatStorageIdentityResult,
  type ChatStorageMeta,
} from './chat-storage-identity';
import { forkChatStorage, prepareChatStorageFork } from './chat-storage-fork';
import { touchStorageIndex } from './storage-global-index';
import { createSillyChatMetadataHost } from './silly-chat-metadata-host';
import { createStoryDomainStore, type StoryDomainJournal } from './story-domain-store';
import { createStoryBundleV3 } from './story-bundle-v3';
import {
  configureMapImageReferenceGc,
  requestMapImageCleanup,
} from './map-image-reference-gc';
import { createStoryBackupStore, type BackupMeta } from './story-backup-store';
import { configureWarehouseStorage, flushWarehouseStorage } from './warehouse';
import {
  configureWardrobeCatalogStorage,
  flushWardrobeCatalog,
} from './wardrobe-catalog-store';
import {
  configureStoryImageGalleryStorage,
  flushStoryImageGallery,
} from './story-image-gallery-store';
import { GLOBAL_STORAGE_NAMESPACES } from './storage-namespaces';
import {
  beginStoryStorageTransition,
  configureStoryStorage,
  configureStoryMapDeletionGc,
  flushStoryStorage,
  getCurrentStoryChatKey,
  getCurrentStoryStorageId,
  getStoryBundle,
  runStoryStorageBarrier,
} from './story-floor-store';
import type {
  ExternalStoreStatus,
} from './external-storage-types';

export interface StorageBootstrapOptions {
  files?: ServerFileStore;
  writerId?: string;
  now?: () => number;
  makeId?: (prefix: string) => string;
  bindEvents?: boolean;
  identityHost?: ChatStorageIdentityHost;
  makeUuid?: () => string;
}

export interface StatusbarStorageStatus {
  initialized: boolean;
  chatKey: string;
  identity: ChatStorageIdentityResult;
  story: {
    external: ExternalStoreStatus | null;
  };
  global: {
    preferences: ExternalStoreStatus | null;
    achievements: ExternalStoreStatus | null;
    warehouse: ExternalStoreStatus | null;
    wardrobeCatalog: ExternalStoreStatus | null;
  };
}

export const STATUSBAR_STORAGE_READY_EVENT = 'ub-statusbar-storage-ready';

export interface StatusbarStorageReadyDetail {
  trigger: 'chat-changed';
  status: StatusbarStorageStatus;
}

let _files: ServerFileStore = serverFileStore;
let _preferenceStore: ExternalObjectStore | null = null;
let _achievementStore: ExternalObjectStore | null = null;
let _warehouseStore: ExternalObjectStore | null = null;
let _wardrobeCatalogStore: ExternalObjectStore | null = null;
let _options: Required<Omit<StorageBootstrapOptions, 'files' | 'identityHost' | 'makeUuid'>> | null = null;
let _initialized = false;
let _identityHost: ChatStorageIdentityHost | null = null;
let _initializing: Promise<StatusbarStorageStatus> | null = null;
let _requestGeneration = 0;
let _requestedOptions: StorageBootstrapOptions = {};
let _identity: ChatStorageIdentityResult = { kind: 'no-context' };
let _globalInitializing: Promise<void> | null = null;
let _storyLoadStatus: ExternalStoreStatus | null = null;

function runtimeContext(): any {
  const candidates: any[] = [];
  try { candidates.push((window as any).SillyTavern); } catch (_e) { /* ignore */ }
  try { candidates.push((window.parent as any).SillyTavern); } catch (_e) { /* cross-origin */ }
  try { candidates.push((window as any).TavernHelper?.SillyTavern); } catch (_e) { /* ignore */ }
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const context = typeof candidate.getContext === 'function' ? candidate.getContext() : candidate;
      if (context) return context;
    } catch (_e) { /* next */ }
  }
  return null;
}

// 全局外部存储索引的角色名快照（角色卡被删后仍可展示）。仅 storage 创建时调用一次。
function characterNameFromContext(): string | undefined {
  const ctx = runtimeContext();
  if (!ctx || ctx.groupId) return undefined;
  const cid = ctx.characterId;
  if (cid === undefined || cid === null || cid === '') return undefined;
  const chars = Array.isArray(ctx.characters) ? ctx.characters : [];
  const ch = chars[Number(cid)];
  const name = ch?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : undefined;
}

function randomToken(prefix: string): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }
  } catch (_e) { /* fallback */ }
  return makeUniqueId(prefix, 10);
}

function makeDefaults(
  options: StorageBootstrapOptions,
): Required<Omit<StorageBootstrapOptions, 'files' | 'identityHost' | 'makeUuid'>> {
  return {
    writerId: options.writerId || randomToken('writer'),
    now: options.now || (() => Date.now()),
    makeId: options.makeId || randomToken,
    bindEvents: options.bindEvents !== false,
  };
}

function createGlobalStore(namespace: string): ExternalObjectStore {
  const options = _options!;
  return createExternalObjectStore({
    files: _files,
    namespace,
    now: options.now,
    makeId: options.makeId,
    writerId: options.writerId,
  });
}

function successfulLoad(status: ExternalStoreStatus): boolean {
  return status.state === 'ready' || status.state === 'uninitialized';
}

function validOwner(value: unknown): value is ChatOwner {
  if (!isRecord(value) || typeof value.chatId !== 'string' || !value.chatId) return false;
  if (value.kind === 'group') return true;
  return value.kind === 'character' && typeof value.avatar === 'string' && Boolean(value.avatar);
}

function inspectEnvelopeOwner(raw: unknown, kind: string, scopeId: string): ChatOwner {
  if (!isRecord(raw) || typeof raw.checksum !== 'string') throw new Error('invalid stored envelope');
  const { checksum, ...payload } = raw;
  if (checksum !== checksumValue(payload)
    || raw.schema !== 3
    || raw.kind !== kind
    || raw.scopeId !== scopeId
    || !validOwner(raw.owner)) {
    throw new Error('invalid stored envelope owner');
  }
  return cloneJson(raw.owner);
}

async function inspectStoredChatOwner(meta: ChatStorageMeta): Promise<ChatOwner | null> {
  const hash = chatStorageHash(meta.storageId);
  const candidates: Array<{ domain: ChatStorageMeta['domainsCreated'][number]; kind: string; filename: string }> = [
    { domain: 'story-core', kind: 'story-core', filename: `usb_story_core_${hash}.json` },
    { domain: 'story-map', kind: 'story-map', filename: `usb_story_map_${hash}.json` },
    { domain: 'portraits', kind: 'portraits', filename: `usb_portraits_${hash}.json` },
  ];
  // O5：老卡冷启动原是串行 await 最多 3 个域文件（逐个网络回合）；并行读完后按候选顺序
  // 取首个命中，语义不变（error 抛出/found 跳过/顺序优先）。
  const reads = await Promise.all(candidates
    .filter(candidate => meta.domainsCreated.includes(candidate.domain))
    .map(async candidate => ({ candidate, read: await _files.readJson<unknown>(candidate.filename) })));
  for (const { candidate, read } of reads) {
    if (read.error) throw new Error(read.error);
    if (!read.found) continue;
    return inspectEnvelopeOwner(read.value, candidate.kind, meta.storageId);
  }
  return null;
}

async function initializeGlobalStores(options: StorageBootstrapOptions): Promise<void> {
  if (_initialized) return;
  if (_globalInitializing) return _globalInitializing;
  _globalInitializing = (async () => {
    _files = options.files || _files || serverFileStore;
    _options = _options
      ? { ..._options, ...makeDefaults(options), bindEvents: options.bindEvents ?? _options.bindEvents }
      : makeDefaults(options);

    // F7：全局命名空间以 core/storage-namespaces.ts 单一登记处为准装配——新增全局域只登记一处，
    // hard-reset 候选推导读同一张表，不会再出现「注册了但重置漏扫」的清单漂移。
    const globalStores = new Map<string, ExternalObjectStore>();
    for (const namespace of GLOBAL_STORAGE_NAMESPACES) {
      globalStores.set(namespace, createGlobalStore(namespace));
    }
    await Promise.all([...globalStores.values()].map(store => store.load()));
    const preferenceStore = globalStores.get('preferences')!;
    const achievementStore = globalStores.get('achievements')!;
    const warehouseStore = globalStores.get('warehouse')!;
    const wardrobeCatalogStore = globalStores.get('wardrobe-catalog')!;
    const storyImageGalleryStore = globalStores.get('story-images')!;
    _preferenceStore = preferenceStore;
    _achievementStore = achievementStore;
    _warehouseStore = warehouseStore;
    _wardrobeCatalogStore = wardrobeCatalogStore;
    configureConfigStorage('external', preferenceStore);
    configureAchievementStorage(achievementStore);
    configureWarehouseStorage(warehouseStore);
    configureWardrobeCatalogStorage(wardrobeCatalogStore);
    configureStoryImageGalleryStorage(storyImageGalleryStore);
    loadAchievementStore();
    invalidateConfigCache();
    _initialized = true;
  })().finally(() => { _globalInitializing = null; });
  return _globalInitializing;
}
function bindStorageEvents(): void {
  // F4：window 令牌替代模块级布尔——宿主 eventSource 是全局 EventEmitter，模块重求值后
  // 旧闭包仍在，模块布尔挡不住第二份注册（每次切卡会驱动两份存储 transition）。
  const w = window as any;
  if (w.__ub_storage_events_bound || !_options?.bindEvents) return;
  const context = runtimeContext();
  const source = context?.eventSource;
  if (!source || typeof source.on !== 'function') return;
  w.__ub_storage_events_bound = true;
  const types = context.eventTypes || {};
  source.on(types.CHAT_CHANGED || 'chat_id_changed', async () => {
    await beginStoryStorageTransition('');
    const status = await initializeStatusbarStorage({ ..._requestedOptions, files: _files, bindEvents: true });
    try {
      window.dispatchEvent(new CustomEvent<StatusbarStorageReadyDetail>(
        STATUSBAR_STORAGE_READY_EVENT,
        { detail: { trigger: 'chat-changed', status } },
      ));
    } catch (_e) { /* non-browser tests */ }
  });
}
// ===== 备份编排层 =====
let _backupStore: ReturnType<typeof createStoryBackupStore> | null = null;
let _backupStoreChatKey = '';
let _backupInitializing: { chatKey: string; promise: Promise<void> } | null = null;
let _backupQueue: Promise<unknown> = Promise.resolve();
const STORY_BACKUP_RETAIN = 10;
export function _setStoryBackupStoreForTest(v: typeof _backupStore, chatKey = getCurrentStoryChatKey()): void {
  _backupStore = v;
  _backupStoreChatKey = v ? chatKey : '';
}
interface BackupSnapshotDataV3 {
  storyCore: StoryDomainJournal;
  storyMap: StoryDomainJournal;
  aiTurns: number;
}
let _backupDataProvider: (() => BackupSnapshotDataV3) | null = null;
export function _setBackupDataProviderForTest(fn: typeof _backupDataProvider): void { _backupDataProvider = fn; }

export async function initStoryBackupSystem(chatKey: string): Promise<void> {
  const bundle = getStoryBundle();
  if (!chatKey || !bundle?.domains) {
    if (_backupStoreChatKey === chatKey || !chatKey) {
      _backupStore = null;
      _backupStoreChatKey = '';
    }
    configureMapImageReferenceGc(null);
    return;
  }
  if (_backupStore && _backupStoreChatKey === chatKey) return;
  if (_backupInitializing?.chatKey === chatKey) return _backupInitializing.promise;

  const promise = (async () => {
    const store = createStoryBackupStore({
      files: _files,
      storageId: chatKey,
      now: _options!.now,
      makeId: _options!.makeId,
    });
    const loaded = await store.load();
    if (loaded.state === 'ready' && getCurrentStoryChatKey() === chatKey) {
      _backupStore = store;
      _backupStoreChatKey = chatKey;
      configureMapImageReferenceGc({
        getStorageId: getCurrentStoryStorageId,
        getSources: () => {
          const current = getStoryBundle();
          const map = current?.domains?.map;
          const backupReferences = store.referencedMapImages().map(imagePath => ({
            schema: 'map_scene_image',
            imagePath,
          }));
          return map
            ? [map.exportJournal(), map.replay(), backupReferences]
            : [backupReferences];
        },
      });
      configureStoryMapDeletionGc(async candidates => { await requestMapImageCleanup(candidates); });
    }
  })();
  _backupInitializing = { chatKey, promise };
  try {
    await promise;
  } finally {
    if (_backupInitializing?.promise === promise) _backupInitializing = null;
  }
}

const backupCurTurns = (): number => activeStoryAnchors(runtimeContext()?.chat || []).length;
/**
 * O11：仅供「是否到自动备份间隔」判断的廉价回合数。
 * 原实现先 backupSnapshotData() 整份深拷贝两域日志、再只看其中 aiTurns 决定要不要备份；
 * 默认间隔 5 ⇒ 每 5 条回复有 4 条白克隆两份完整 journal（备份那次 runBackup 还会再克隆一遍）。
 * 这里只算回合数即返回；测试注入 provider 时沿用其 aiTurns，与实现语义完全一致。
 */
const backupTurnGateValue = (): number => (_backupDataProvider ? _backupDataProvider().aiTurns : backupCurTurns());
const backupSnapshotData = (): BackupSnapshotDataV3 => {
  if (_backupDataProvider) return _backupDataProvider();
  const domains = getStoryBundle()?.domains;
  return {
    storyCore: domains?.core.exportJournal() || { baseline: {}, entries: [] },
    storyMap: domains?.map.exportJournal() || { baseline: {}, entries: [] },
    aiTurns: backupCurTurns(),
  };
};

async function runBackup(reason: 'auto' | 'manual'): Promise<boolean> {
  if (!_backupStore) return false;
  // flushStoryStorage 内部自带 isStoryStorageReady 守卫，测试环境无 bundle 时会 no-op
  await flushStoryStorage();
  const data = backupSnapshotData();
  const ok = await _backupStore.createSnapshot({ reason, ...data });
  if (ok) await _backupStore.rotate(STORY_BACKUP_RETAIN);
  return ok;
}

function enqueueBackup(operation: () => Promise<boolean>): Promise<boolean> {
  const result = _backupQueue.then(operation, operation);
  _backupQueue = result.then(() => undefined, () => undefined);
  return result;
}

export async function maybeAutoBackupStory(): Promise<boolean> {
  return enqueueBackup(async () => {
    const chatKey = getCurrentStoryChatKey() || _backupStoreChatKey;
    if (!_backupStore || _backupStoreChatKey !== chatKey) await initStoryBackupSystem(chatKey);
    if (!_backupStore || _backupStoreChatKey !== chatKey) return false;
    if (!_backupStore.shouldAutoBackup(backupTurnGateValue(), getConfig().storyBackupInterval)) return false;
    return runBackup('auto');
  });
}
export async function manualBackupStory(): Promise<boolean> {
  return enqueueBackup(async () => {
    const chatKey = getCurrentStoryChatKey();
    await initStoryBackupSystem(chatKey);
    if (!_backupStore || _backupStoreChatKey !== chatKey) return false;
    return runBackup('manual');
  });
}
export async function listStoryBackups(): Promise<{ list: BackupMeta[]; ready: boolean }> {
  const chatKey = getCurrentStoryChatKey();
  if (!_backupStore || _backupStoreChatKey !== chatKey) await initStoryBackupSystem(chatKey);
  const ready = !!_backupStore && _backupStoreChatKey === chatKey;
  return { list: ready ? _backupStore!.listBackups() : [], ready };
}
export async function deleteStoryBackup(file: string): Promise<boolean> {
  const chatKey = getCurrentStoryChatKey();
  if (!_backupStore || _backupStoreChatKey !== chatKey) await initStoryBackupSystem(chatKey);
  return _backupStore && _backupStoreChatKey === chatKey ? _backupStore.deleteBackup(file) : false;
}
export async function restoreStoryBackup(file: string): Promise<boolean> {
  const chatKey = getCurrentStoryChatKey();
  if (!_backupStore || _backupStoreChatKey !== chatKey) await initStoryBackupSystem(chatKey);
  if (!_backupStore || _backupStoreChatKey !== chatKey || !getStoryBundle()) return false;
  return runStoryStorageBarrier(async () => {
    const bundle = getStoryBundle();
    if (!bundle?.domains || !_backupStore) return false;
    const result = await _backupStore.restoreSnapshot(file, {
      captureCurrent: () => ({
        storyCore: bundle.domains!.core.exportJournal(),
        storyMap: bundle.domains!.map.exportJournal(),
        aiTurns: backupCurTurns(),
      }),
      applyCore: journal => bundle.domains!.core.restoreJournal(journal),
      applyMap: journal => bundle.domains!.map.restoreJournal(journal),
    });
    if (result.ok) {
      emitUbEvent(UB_EVENT.storyStateInvalidated);
    }
    return result.ok;
  });
}

export function initializeStatusbarStorage(
  options: StorageBootstrapOptions = {},
): Promise<StatusbarStorageStatus> {
  _requestedOptions = { ..._requestedOptions, ...options };
  const generation = ++_requestGeneration;
  const requested = { ..._requestedOptions };
  const run = (async (): Promise<StatusbarStorageStatus> => {
    await beginStoryStorageTransition('');
    _storyLoadStatus = null;
    await initializeGlobalStores(requested);

    const host = requested.identityHost || createSillyChatMetadataHost();
    _identityHost = host;
    const descriptor = host.getCurrent();
    const existingMeta = descriptor
      ? normalizeChatStorageMeta(descriptor.metadata?.unifiedStatusbar)
      : null;
    let identity = await resolveChatStorageIdentity(host, {
      ...(requested.makeUuid ? { makeUuid: requested.makeUuid } : {}),
      ...(existingMeta && existingMeta.domainsCreated.length
        ? { inspectOwner: async () => inspectStoredChatOwner(existingMeta) }
        : {}),
    });

    if (generation !== _requestGeneration) return getStatusbarStorageStatus();
    // 重放/保留用扩展集（含多变体消息的消息级锚点）；写入绑定锚点单独派生。
    // 锚点体系角色无关（V3 起唯一体系）：恒走 activeStoryReplayAnchors 轻量派生。
    const activeAnchors = (): ReadonlySet<string> => {
      const chat = runtimeContext()?.chat || [];
      return new Set(activeStoryReplayAnchors(chat));
    };
    // fork 复制父 journal（一次性、非热路径）：恒用重放锚点集保证父 journal 中 entry 可达（复制）。
    const forkActiveAnchors = (): ReadonlySet<string> => new Set(activeStoryReplayAnchors(runtimeContext()?.chat || []));
    const activeWriteAnchor = (): string | null => {
      const anchors = activeStoryAnchors(runtimeContext()?.chat || []);
      return anchors[anchors.length - 1] || null;
    };
    _identity = identity;
    if (identity.kind === 'fork-required') {
      const prepared = await prepareChatStorageFork(
        host,
        identity,
        requested.makeUuid || createChatStorageUuid,
      );
      if (!prepared.ok) {
        _identity = { kind: 'read-only', error: prepared.error };
        configureStoryStorage(null, '');
        bindStorageEvents();
        return getStatusbarStorageStatus();
      }
      const copied = await forkChatStorage({
        files: _files,
        host,
        meta: prepared.meta,
        owner: identity.currentOwner,
        // fork 复制父 journal 用重放锚点集（forkActiveAnchors）：父 journal 中的角色无关锚点
        // entry 必须可达（复制）；旧格式不兼容数据不自动迁移，走设置-存储重置清除。
        activeAnchors: forkActiveAnchors(),
        now: _options!.now,
      });
      const copiedDescriptor = host.getCurrent();
      const copiedMeta = copiedDescriptor
        ? normalizeChatStorageMeta(copiedDescriptor.metadata?.unifiedStatusbar)
        : null;
      if (!copied.ok || !copiedMeta || copiedMeta.forkSource) {
        _identity = { kind: 'read-only', error: copied.ok ? 'fork-copy-pending' : copied.error };
        configureStoryStorage(null, '');
        bindStorageEvents();
        return getStatusbarStorageStatus();
      }
      identity = {
        kind: 'ready',
        storageId: copiedMeta.storageId,
        meta: copiedMeta,
        owner: identity.currentOwner,
        ownerAction: 'created',
      };
      _identity = identity;
    }
    if (identity.kind !== 'ready') {
      configureStoryStorage(null, '');
      // 域文件校验失败（inspect-owner 只读，携带 storageId）：文件损坏/不可读，身份无法继续，
      // 但用户应能通过「重置聊天存储」自救——合成只读状态让设置-存储面板展示重置入口。
      if (identity.kind === 'read-only' && identity.storageId) {
        _storyLoadStatus = {
          state: 'read-only',
          revision: 0,
          generation: identity.storageId,
          pendingWrites: 0,
          lastError: identity.error,
        };
      }
      bindStorageEvents();
      return getStatusbarStorageStatus();
    }
    if (identity.meta.forkSource) {
      const copied = await forkChatStorage({
        files: _files,
        host,
        meta: identity.meta,
        owner: identity.owner,
        activeAnchors: forkActiveAnchors(),
        now: _options!.now,
      });
      const copiedDescriptor = host.getCurrent();
      const copiedMeta = copiedDescriptor
        ? normalizeChatStorageMeta(copiedDescriptor.metadata?.unifiedStatusbar)
        : null;
      if (!copied.ok || !copiedMeta || copiedMeta.forkSource) {
        _identity = { kind: 'read-only', error: copied.ok ? 'fork-copy-pending' : copied.error };
        configureStoryStorage(null, '');
        bindStorageEvents();
        return getStatusbarStorageStatus();
      }
      identity = { ...identity, storageId: copiedMeta.storageId, meta: copiedMeta };
      _identity = identity;
    }

    const storageId = identity.storageId;
    let metadataQueue: Promise<unknown> = Promise.resolve();
    const serializeMetadataUpdate = (update: () => Promise<boolean>): Promise<boolean> => {
      const result = metadataQueue.then(update, update);
      metadataQueue = result.then(() => undefined, () => undefined);
      return result;
    };
    const core = createStoryDomainStore({
      files: _files,
      storageId,
      domain: 'story-core',
      owner: identity.owner,
      domainCreated: identity.meta.domainsCreated.includes('story-core'),
      hasAnchoredHistory: identity.meta.hasAnchoredHistory,
      getActiveAnchors: activeAnchors,
      now: _options!.now,
      onDomainCreated: () => serializeMetadataUpdate(
        () => markChatDomainCreated(host, storageId, 'story-core'),
      ),
      onAnchoredHistory: () => serializeMetadataUpdate(() => markAnchoredHistory(host, storageId)),
    });
    const map = createStoryDomainStore({
      files: _files,
      storageId,
      domain: 'story-map',
      owner: identity.owner,
      domainCreated: identity.meta.domainsCreated.includes('story-map'),
      hasAnchoredHistory: identity.meta.hasAnchoredHistory,
      getActiveAnchors: activeAnchors,
      now: _options!.now,
      onDomainCreated: () => serializeMetadataUpdate(
        () => markChatDomainCreated(host, storageId, 'story-map'),
      ),
      onAnchoredHistory: () => serializeMetadataUpdate(() => markAnchoredHistory(host, storageId)),
    });
    const portraits = createPortraitPersistentStore({
      files: _files,
      storageId,
      owner: identity.owner,
      domainCreated: identity.meta.domainsCreated.includes('portraits'),
      now: _options!.now,
      onDomainCreated: () => serializeMetadataUpdate(
        () => markChatDomainCreated(host, storageId, 'portraits'),
      ),
    });
    const [coreStatus, mapStatus, portraitStatus] = await Promise.all([
      core.load(),
      map.load(),
      portraits.load(),
    ]);

    const current = host.getCurrent();
    const currentMeta = current ? normalizeChatStorageMeta(current.metadata?.unifiedStatusbar) : null;
    const currentOwner: ChatOwner | null = current
      ? current.kind === 'character'
        ? { kind: 'character', avatar: current.avatar, chatId: current.chatId }
        : { kind: 'group', chatId: current.chatId }
      : null;
    const stillCurrent = generation === _requestGeneration
      && currentMeta?.storageId === storageId
      && stableStringify(currentOwner) === stableStringify(identity.owner);
    if (!stillCurrent) return getStatusbarStorageStatus();

    const allReady = successfulLoad(coreStatus)
      && successfulLoad(mapStatus)
      && successfulLoad(portraitStatus);
    if (allReady) {
      const bundle = createStoryBundleV3({ core, map, portraits, getWriteAnchor: activeWriteAnchor });
      configureStoryStorage(bundle, storageId);
      _storyLoadStatus = bundle.journal.status();
    } else {
      _storyLoadStatus = [coreStatus, mapStatus, portraitStatus].find(status => !successfulLoad(status)) || null;
      configureStoryStorage(null, storageId);
    }
    bindStorageEvents();
    // 前瞻式全局外部存储索引：仅在 storage 创建（全新或 fork）时 best-effort、fire-and-forget
    // 记录一条。绝不挂在写入热路径，失败/不可达静默跳过，不阻塞初始化、不影响游玩性能。
    // 作用：聊天元数据后来完全丢失的纯孤儿仍可被「全局聊天外部存储管理」列出与恢复。
    if (identity.ownerAction === 'created') {
      const charName = characterNameFromContext();
      void touchStorageIndex(_files, {
        storageId: identity.storageId,
        owner: identity.owner,
        ...(charName ? { characterName: charName } : {}),
        createdAt: _options!.now(),
        domainsCreated: identity.meta.domainsCreated,
      }).catch(() => { /* best-effort：索引不可达不影响存储初始化 */ });
    }
    return getStatusbarStorageStatus();
  })();
  _initializing = run;
  void run.finally(() => {
    if (_initializing === run) _initializing = null;
  });
  return run;
}

export async function flushStatusbarStorage(): Promise<void> {
  await flushConfigStorage();
  await flushAchievementBook();
  await flushStoryStorage();
  await Promise.all([
    _preferenceStore?.flush(),
    _achievementStore?.flush(),
    _warehouseStore?.flush(),
    _wardrobeCatalogStore?.flush(),
  ]);
  await flushWarehouseStorage();
  await flushWardrobeCatalog();
  await flushStoryImageGallery();
}

/**
 * 重置当前聊天的外部存储（用户主动操作）：
 * 删除本聊天的剧情/地图/立绘三个域文件，清除「域已创建」与「有锚点历史」标记，
 * 再重新初始化——三个域按未创建加载（uninitialized），首次写入重建文件。
 * 用于数据文件损坏（invalid-atomic-envelope / inspect-owner 失败）导致的只读保护死锁；
 * 全局偏好/成就/仓库/衣柜目录与备份快照不受影响。
 * 允许身份 ready 或「本聊天域文件校验失败」（read-only 且携带本聊天 storageId）；
 * fork-required / 元数据不可推导等场景拒绝（storageId 可能属于父聊天，重置会误删）。
 */
export async function resetCurrentChatStoryStorage(): Promise<{ ok: boolean; error?: string }> {
  await flushStoryStorage();
  const host = _identityHost || createSillyChatMetadataHost();
  let storageId = '';
  if (_identity.kind === 'ready') {
    storageId = _identity.storageId;
  } else if (_identity.kind === 'read-only' && _identity.storageId) {
    storageId = _identity.storageId;
  }
  if (!storageId) {
    return { ok: false, error: '当前聊天存储身份未就绪，无法重置' };
  }

  // 1. 删除三个域文件（server-file-store.delete 对 404 幂等：已缺失视为删除成功）。
  const hash = chatStorageHash(storageId);
  const filenames = [
    `usb_story_core_${hash}.json`,
    `usb_story_map_${hash}.json`,
    `usb_portraits_${hash}.json`,
  ];
  for (const filename of filenames) {
    // server-file-store.delete 仅接受 /user/files/ 前缀路径（isSafeUserFileApiPath），裸文件名恒被拒
    const deleted = await _files.delete(`/user/files/${filename}`);
    if (!deleted.ok) {
      return { ok: false, error: `删除 ${filename} 失败：${deleted.error || '未知错误'}` };
    }
  }

  // 2. 清除域创建/锚点历史标记（保留 storageId：文件重建后聊天身份连续）。
  const resetMeta: ChatStorageMeta = {
    storageId,
    schema: 3,
    domainsCreated: [],
    hasAnchoredHistory: false,
  };
  const saved = await saveChatStorageMeta(host, storageId, resetMeta);
  if (!saved) {
    return { ok: false, error: '重置聊天元数据失败（保存后未确认一致）' };
  }

  // 3. 重新初始化：三个域文件已删除、标记已清 → 全部按未创建加载，bundle 就绪。
  await initializeStatusbarStorage({ ..._requestedOptions, files: _files, bindEvents: true });

  // 4. 通知就绪：清除「存档同步中/失败」指示并补跑剧情自动化。
  try {
    window.dispatchEvent(new CustomEvent<StatusbarStorageReadyDetail>(
      STATUSBAR_STORAGE_READY_EVENT,
      { detail: { trigger: 'chat-changed', status: getStatusbarStorageStatus() } },
    ));
  } catch (_e) { /* non-browser tests */ }
  return { ok: true };
}

/**
 * 重置当前聊天的全部相关存储（用户主动操作，比 resetCurrentChatStoryStorage 更彻底）：
 * 删除本聊天的剧情/地图/立绘三个域文件，**并清除本聊天的全部备份快照**（备份索引 + 各份备份文件），
 * 清除「域已创建」与「有锚点历史」标记后重新初始化——三个域按未创建加载，首次写入重建文件。
 *
 * 与 resetCurrentChatStoryStorage 的差异：后者只删三域文件、保留备份（损坏后可恢复）；
 * 本函数连备份一并清除，用于「确定不要这个聊天的任何状态栏数据、从头来过」的场景。
 *
 * 全局存储（偏好/成就/仓库/衣柜目录/正文图库）与其他聊天的存储完全不受影响。
 * 允许身份 ready 或「本聊天域文件校验失败」（read-only 且携带本聊天 storageId）。
 */
export async function resetCurrentChatThoroughly(): Promise<{ ok: boolean; error?: string }> {
  await flushStoryStorage();
  const host = _identityHost || createSillyChatMetadataHost();
  let storageId = '';
  if (_identity.kind === 'ready') {
    storageId = _identity.storageId;
  } else if (_identity.kind === 'read-only' && _identity.storageId) {
    storageId = _identity.storageId;
  }
  if (!storageId) {
    return { ok: false, error: '当前聊天存储身份未就绪，无法重置' };
  }

  const hash = chatStorageHash(storageId);

  // 1. 删除三个域文件 + 备份索引 + 各份备份文件（server-file-store.delete 对 404 幂等）。
  const filenames: string[] = [
    `usb_story_core_${hash}.json`,
    `usb_story_map_${hash}.json`,
    `usb_portraits_${hash}.json`,
    `usb_bakidx_${hash}.json`,
  ];
  // 读备份索引，把各份备份文件名也列入删除清单（索引缺失则无备份可删）。
  const bakidxRead = await _files.readJson<{ backups?: Array<{ file?: unknown }> }>(`usb_bakidx_${hash}.json`);
  if (bakidxRead.found && Array.isArray(bakidxRead.value?.backups)) {
    for (const backup of bakidxRead.value.backups) {
      if (backup && typeof backup.file === 'string') filenames.push(backup.file);
    }
  }
  for (const filename of filenames) {
    // server-file-store.delete 仅接受 /user/files/ 前缀路径（isSafeUserFileApiPath），裸文件名恒被拒
    const deleted = await _files.delete(`/user/files/${filename}`);
    if (!deleted.ok) {
      return { ok: false, error: `删除 ${filename} 失败：${deleted.error || '未知错误'}` };
    }
  }

  // 2. 清除域创建/锚点历史标记（保留 storageId：文件重建后聊天身份连续）。
  const resetMeta: ChatStorageMeta = {
    storageId,
    schema: 3,
    domainsCreated: [],
    hasAnchoredHistory: false,
  };
  const saved = await saveChatStorageMeta(host, storageId, resetMeta);
  if (!saved) {
    return { ok: false, error: '重置聊天元数据失败（保存后未确认一致）' };
  }

  // 3. 重新初始化 + 通知就绪（与 resetCurrentChatStoryStorage 同口径）。
  await initializeStatusbarStorage({ ..._requestedOptions, files: _files, bindEvents: true });
  try {
    window.dispatchEvent(new CustomEvent<StatusbarStorageReadyDetail>(
      STATUSBAR_STORAGE_READY_EVENT,
      { detail: { trigger: 'chat-changed', status: getStatusbarStorageStatus() } },
    ));
  } catch (_e) { /* non-browser tests */ }
  return { ok: true };
}

export function getStatusbarStorageStatus(): StatusbarStorageStatus {
  const chatKey = getCurrentStoryStorageId();
  return {
    initialized: _initialized,
    chatKey,
    identity: cloneJson(_identity),
    story: {
      external: getStoryBundle()?.journal.status() || _storyLoadStatus,
    },
    global: {
      preferences: _preferenceStore?.status() || null,
      achievements: _achievementStore?.status() || null,
      warehouse: _warehouseStore?.status() || null,
      wardrobeCatalog: _wardrobeCatalogStore?.status() || null,
    },
  };
}
