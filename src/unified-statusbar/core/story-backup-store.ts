import { isRecord } from './type-guards';
import { checksumValue, checksumOk, cloneJson, sha256Hex, stableStringify } from './external-storage-codec';
import { collectReferencedMapImages } from './map-image-reference-gc';
import type { ServerFileStore } from './server-file-store';
import type { StoryDomainJournal } from './story-domain-store';

export interface BackupMeta {
  file: string;
  createdAt: number;
  reason: 'auto' | 'manual';
  aiTurns: number;
  bytes: number;
  mapImages: string[];
}

export interface StoryBackupIndex {
  schema: 3;
  kind: 'backup-index';
  scopeHash: string;
  revision: number;
  countBase: number;
  backups: BackupMeta[];
  checksum: string;
}

interface StoryBackupSnapshot {
  schema: 3;
  kind: 'backup-snapshot';
  scopeHash: string;
  createdAt: number;
  reason: 'auto' | 'manual' | 'safety';
  aiTurns: number;
  storyCore: StoryDomainJournal;
  storyMap: StoryDomainJournal;
  mapImages: string[];
  checksum: string;
}

export interface StoryBackupStoreDeps {
  files: ServerFileStore;
  storageId?: string;
  /** Temporary test/migration alias. Production passes storageId. */
  chatKey?: string;
  now: () => number;
  makeId: (prefix: string) => string;
  getChat?: () => any[];
  writerId?: string;
}

export interface StoryBackupSnapshotInput {
  reason: 'auto' | 'manual';
  storyCore: StoryDomainJournal;
  storyMap: StoryDomainJournal;
  aiTurns: number;
}

type ApplyResult = boolean | { ok: boolean; confirmed?: boolean; retryable?: boolean; error?: string };

export interface StoryBackupRestoreOperations {
  captureCurrent: () => {
    storyCore: StoryDomainJournal;
    storyMap: StoryDomainJournal;
    aiTurns: number;
  };
  applyCore: (journal: StoryDomainJournal) => Promise<ApplyResult>;
  applyMap: (journal: StoryDomainJournal) => Promise<ApplyResult>;
}

export type StoryBackupRestoreResult =
  | { ok: true; warning?: 'restored-with-index-warning' }
  | { ok: false; error: string; retryable: boolean; compensationFailed?: boolean };

export interface StoryBackupStore {
  load(): Promise<{ state: string; lastError?: string }>;
  getIndex(): StoryBackupIndex;
  listBackups(): BackupMeta[];
  deleteBackup(file: string): Promise<boolean>;
  createSnapshot(input: StoryBackupSnapshotInput): Promise<boolean>;
  shouldAutoBackup(curTurns: number, interval: number): boolean;
  rotate(maxRetain: number): Promise<void>;
  restoreSnapshot(file: string, operations: StoryBackupRestoreOperations): Promise<StoryBackupRestoreResult>;
  referencedMapImages(): string[];
  _internal: { index: StoryBackupIndex; bakidxFile: string };
}

function validJournal(value: unknown): value is StoryDomainJournal {
  return isRecord(value)
    && isRecord(value.baseline)
    && Array.isArray(value.entries)
    && value.entries.every(entry => isRecord(entry)
      && typeof entry.anchor === 'string'
      && Number.isInteger(entry.revision));
}

function normalizeMeta(value: unknown): BackupMeta | null {
  if (!isRecord(value)
    || typeof value.file !== 'string'
    || typeof value.createdAt !== 'number'
    || (value.reason !== 'auto' && value.reason !== 'manual')
    || typeof value.aiTurns !== 'number'
    || typeof value.bytes !== 'number') return null;
  return {
    file: value.file,
    createdAt: value.createdAt,
    reason: value.reason,
    aiTurns: value.aiTurns,
    bytes: value.bytes,
    mapImages: Array.isArray(value.mapImages)
      ? value.mapImages.filter(path => typeof path === 'string')
      : [],
  };
}

function validIndex(value: unknown, scopeHash: string): value is StoryBackupIndex {
  if (!checksumOk(value) || !isRecord(value)) return false;
  if (value.schema !== 3 || value.kind !== 'backup-index' || value.scopeHash !== scopeHash) return false;
  if (!Number.isInteger(value.revision) || Number(value.revision) < 0) return false;
  if (typeof value.countBase !== 'number' || !Array.isArray(value.backups)) return false;
  return value.backups.every(item => normalizeMeta(item) !== null);
}

function validSnapshot(value: unknown, scopeHash: string): value is StoryBackupSnapshot {
  return checksumOk(value)
    && isRecord(value)
    && value.schema === 3
    && value.kind === 'backup-snapshot'
    && value.scopeHash === scopeHash
    && typeof value.createdAt === 'number'
    && (value.reason === 'auto' || value.reason === 'manual' || value.reason === 'safety')
    && typeof value.aiTurns === 'number'
    && validJournal(value.storyCore)
    && validJournal(value.storyMap)
    && Array.isArray(value.mapImages);
}

function withChecksum<T extends Record<string, unknown>>(payload: T): T & { checksum: string } {
  return { ...payload, checksum: checksumValue(payload) };
}

function applyConfirmed(result: ApplyResult): boolean {
  return result === true || (typeof result === 'object' && result.ok && result.confirmed !== false);
}

function applyError(result: ApplyResult): { error: string; retryable: boolean } {
  return typeof result === 'object'
    ? { error: result.error || 'domain-restore-unconfirmed', retryable: result.retryable !== false }
    : { error: 'domain-restore-unconfirmed', retryable: true };
}

export function createStoryBackupStore(deps: StoryBackupStoreDeps): StoryBackupStore {
  const storageId = deps.storageId || deps.chatKey || '';
  const scopeHash = sha256Hex(storageId).slice(0, 24);
  const bakidxFile = `usb_bakidx_${scopeHash}.json`;
  let index = withChecksum({
    schema: 3 as const,
    kind: 'backup-index' as const,
    scopeHash,
    revision: 0,
    countBase: 0,
    backups: [] as BackupMeta[],
  }) as StoryBackupIndex;

  function token(prefix: string): string {
    return String(deps.makeId(prefix)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || prefix;
  }

  /** O36-③(十一轮)：核对复用写入侧已算好的校验和（withChecksum 产物）——只对读回内容做
   * 一次序列化+哈希，省掉对原始值的整份重复 stableStringify 与双串等值比对（各 1× 文件体积，
   * 自动备份每 5 回合对双域快照各付一遍）。未传 checksum 的调用点保持旧双串比对语义。
   * 等价性：读回 checksum 相同 && payload 校验和相同 ⟺ 全信封序列化相等（SHA-256 抗碰撞，
   * 与 withChecksum 自身的信任级别一致）。 */
  async function writeVerified(file: string, value: unknown, checksum?: string): Promise<boolean> {
    const uploaded = await deps.files.uploadJson(file, value);
    const read = await deps.files.readJson<unknown>(file);
    if (!(read.found && read.value)) return false;
    if (checksum !== undefined && isRecord(read.value)) {
      const { checksum: readChecksum, ...payload } = read.value;
      return readChecksum === checksum && checksumValue(payload) === checksum;
    }
    return Boolean((uploaded.ok || read.found)
      && stableStringify(read.value) === stableStringify(value));
  }

  async function saveIndexCandidate(candidate: Omit<StoryBackupIndex, 'checksum'>): Promise<boolean> {
    const next = withChecksum(candidate) as StoryBackupIndex;
    if (!await writeVerified(bakidxFile, next, next.checksum)) return false;
    index = cloneJson(next);
    return true;
  }

  async function createSnapshotFile(input: {
    reason: 'auto' | 'manual' | 'safety';
    storyCore: StoryDomainJournal;
    storyMap: StoryDomainJournal;
    aiTurns: number;
  }): Promise<{ file: string; snapshot: StoryBackupSnapshot; bytes: number } | null> {
    const createdAt = deps.now();
    const prefix = input.reason === 'safety' ? 'restore-safety' : 'snapshot';
    const file = `usb_bak_${scopeHash}_${createdAt}_${token(prefix)}.json`;
    const mapImages = [...collectReferencedMapImages({ journal: input.storyMap })];
    const payload = {
      schema: 3 as const,
      kind: 'backup-snapshot' as const,
      scopeHash,
      createdAt,
      reason: input.reason,
      aiTurns: input.aiTurns,
      storyCore: cloneJson(input.storyCore),
      storyMap: cloneJson(input.storyMap),
      mapImages,
    };
    const snapshot = withChecksum(payload) as StoryBackupSnapshot;
    if (!await writeVerified(file, snapshot, snapshot.checksum)) return null;
    return { file, snapshot, bytes: JSON.stringify(snapshot).length };
  }

  async function createSnapshot(input: StoryBackupSnapshotInput): Promise<boolean> {
    if (!validJournal(input.storyCore) || !validJournal(input.storyMap)) return false;
    const created = await createSnapshotFile(input);
    if (!created) return false;
    const meta: BackupMeta = {
      file: created.file,
      createdAt: created.snapshot.createdAt,
      reason: input.reason,
      aiTurns: input.aiTurns,
      bytes: created.bytes,
      mapImages: [...created.snapshot.mapImages],
    };
    return saveIndexCandidate({
      schema: 3,
      kind: 'backup-index',
      scopeHash,
      revision: index.revision + 1,
      countBase: input.aiTurns,
      backups: [...index.backups, meta],
    });
  }

  async function readSnapshot(file: string): Promise<StoryBackupSnapshot | null> {
    const read = await deps.files.readJson<unknown>(file);
    return read.found && validSnapshot(read.value, scopeHash) ? cloneJson(read.value) : null;
  }

  return {
    async load() {
      const read = await deps.files.readJson<unknown>(bakidxFile);
      if (!read.found) return { state: 'ready' };
      if (validIndex(read.value, scopeHash)) {
        const loaded = cloneJson(read.value);
        loaded.backups = loaded.backups.map(item => normalizeMeta(item) as BackupMeta);
        index = loaded;
        return { state: 'ready' };
      }
      if (read.error) return { state: 'error', lastError: read.error };
      return { state: 'read-only', lastError: '备份索引校验失败' };
    },
    getIndex(): StoryBackupIndex {
      return cloneJson(index);
    },
    listBackups(): BackupMeta[] {
      return cloneJson(index.backups);
    },
    async deleteBackup(file): Promise<boolean> {
      if (!index.backups.some(item => item.file === file)) return false;
      const nextBackups = index.backups.filter(item => item.file !== file);
      if (!await saveIndexCandidate({
        schema: 3,
        kind: 'backup-index',
        scopeHash,
        revision: index.revision + 1,
        countBase: index.countBase,
        backups: nextBackups,
      })) return false;
      try { await deps.files.delete(`/user/files/${file}`); } catch { /* harmless orphan */ }
      return true;
    },
    createSnapshot,
    shouldAutoBackup(curTurns, interval): boolean {
      return curTurns - index.countBase >= interval;
    },
    async rotate(maxRetain): Promise<void> {
      const excess = index.backups.length - Math.max(0, maxRetain);
      if (excess <= 0) return;
      const removed = index.backups.slice(0, excess);
      const kept = index.backups.slice(excess);
      if (!await saveIndexCandidate({
        schema: 3,
        kind: 'backup-index',
        scopeHash,
        revision: index.revision + 1,
        countBase: index.countBase,
        backups: kept,
      })) return;
      for (const item of removed) {
        try { await deps.files.delete(`/user/files/${item.file}`); } catch { /* harmless orphan */ }
      }
    },
    async restoreSnapshot(file, operations): Promise<StoryBackupRestoreResult> {
      if (!index.backups.some(item => item.file === file)) {
        return { ok: false, error: 'backup-not-indexed', retryable: false };
      }
      const target = await readSnapshot(file);
      if (!target) return { ok: false, error: 'backup-invalid', retryable: false };
      const current = operations.captureCurrent();
      const safety = await createSnapshotFile({ reason: 'safety', ...current });
      if (!safety) return { ok: false, error: 'safety-snapshot-unconfirmed', retryable: true };

      let failure: { error: string; retryable: boolean } | null = null;
      try {
        const core = await operations.applyCore(cloneJson(target.storyCore));
        if (!applyConfirmed(core)) failure = applyError(core);
        if (!failure) {
          const map = await operations.applyMap(cloneJson(target.storyMap));
          if (!applyConfirmed(map)) failure = applyError(map);
        }
      } catch (error) {
        failure = { error: error instanceof Error ? error.message : String(error), retryable: true };
      }

      if (failure) {
        let coreCompensated = false;
        let mapCompensated = false;
        try { coreCompensated = applyConfirmed(await operations.applyCore(cloneJson(safety.snapshot.storyCore))); } catch { /* keep safety */ }
        try { mapCompensated = applyConfirmed(await operations.applyMap(cloneJson(safety.snapshot.storyMap))); } catch { /* keep safety */ }
        if (coreCompensated && mapCompensated) {
          try { await deps.files.delete(`/user/files/${safety.file}`); } catch { /* orphan is safe */ }
        }
        return {
          ok: false,
          error: failure.error,
          retryable: failure.retryable,
          ...(!coreCompensated || !mapCompensated ? { compensationFailed: true } : {}),
        };
      }

      const indexSaved = await saveIndexCandidate({
        schema: 3,
        kind: 'backup-index',
        scopeHash,
        revision: index.revision + 1,
        countBase: target.aiTurns,
        backups: index.backups,
      });
      try { await deps.files.delete(`/user/files/${safety.file}`); } catch { /* harmless orphan */ }
      return indexSaved ? { ok: true } : { ok: true, warning: 'restored-with-index-warning' };
    },
    referencedMapImages(): string[] {
      return [...new Set(index.backups.flatMap(item => item.mapImages || []))];
    },
    _internal: {
      get index() { return index; },
      set index(value) { index = value; },
      bakidxFile,
    },
  };
}
