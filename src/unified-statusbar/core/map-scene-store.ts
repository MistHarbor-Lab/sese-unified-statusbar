import { sameStringArray } from './type-guards';
import {
  deleteStoredImage,
  isSafeStoredImagePath,
  type DeleteStoredImageResult,
} from './image-storage';
import { requestMapImageCleanup } from './map-image-reference-gc';
import {
  readStoryFeature,
  hasStoryFeature,
  writeStoryFeature,
  writeStoryFeatures,
} from './story-floor-store';

export type MapSceneImageStatus =
  | 'prompting'
  | 'generating'
  | 'ready'
  | 'stale'
  | 'failed'
  | 'cleared';

export interface MapSceneImageError {
  code: string;
  message: string;
  at: number;
}

export interface MapSceneImageRecord {
  version: 1;
  schema: 'map_scene_image';
  nodeId: string;
  canonicalPath: string;
  locationLabel: string;
  sourceMapHash: string;
  status: MapSceneImageStatus;
  imagePath: string;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  provider: 'novelai' | 'openai' | 'comfyui';
  imagePromptApiPresetId: string;
  createdAt: number;
  updatedAt: number;
  lastAttemptAt: number;
  error?: MapSceneImageError;
  cleanupPendingPath?: string;
}

export const MAP_SCENE_IMAGE_INDEX_KEY = 'map.scene-image.index';
export const MAP_SCENE_IMAGE_KEY_PREFIX = 'map.scene-image:';

export interface MapSceneStoreDeps {
  readFeature: <T>(key: string, fallback: T) => T;
  hasFeature: (key: string) => boolean;
  writeFeature: (key: string, value: unknown) => Promise<boolean>;
  writeFeatures: (updates: Record<string, unknown>, deletes?: string[]) => Promise<boolean>;
  deleteStoredImage: (path: string) => Promise<DeleteStoredImageResult>;
  cleanupImages: (paths: readonly string[]) => Promise<{ failedPaths: string[] }>;
  now: () => number;
}

export interface MapSceneStore {
  readMapSceneImage(nodeId: string): Promise<MapSceneImageRecord | null>;
  writeMapSceneImage(record: MapSceneImageRecord): Promise<boolean>;
  clearMapSceneImage(nodeId: string): Promise<boolean>;
  listMapSceneImages(): Promise<MapSceneImageRecord[]>;
  clearAllMapSceneImages(): Promise<{ cleared: number; failed: number }>;
}

export interface MapSceneMergePlan {
  upserts: MapSceneImageRecord[];
  deleteNodeIds: string[];
  cleanup: Array<{ recordNodeId: string; imagePath: string }>;
  pendingNodeId?: string;
}

const DEFAULT_WIDTH = 1216;
const DEFAULT_HEIGHT = 832;
const MAX_NODE_ID_LENGTH = 256;
const MAX_TEXT_LENGTH = 50_000;
const VALID_STATUSES = new Set<MapSceneImageStatus>([
  'prompting',
  'generating',
  'ready',
  'stale',
  'failed',
  'cleared',
]);

function safeText(value: unknown, fallback = '', maxLength = MAX_TEXT_LENGTH): string {
  if (typeof value !== 'string') return fallback;
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, maxLength);
}

function normalizeNodeId(value: unknown): string {
  const nodeId = safeText(value).trim();
  if (!nodeId || nodeId.length > MAX_NODE_ID_LENGTH) return '';
  return nodeId;
}

function safeImagePath(value: unknown): string {
  const path = safeText(value).trim();
  return isSafeStoredImagePath(path) ? path : '';
}

function safeTimestamp(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

function safeDimension(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(8192, Math.max(64, Math.floor(value)));
}

function normalizeError(value: unknown): MapSceneImageError | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  const code = safeText(candidate.code).trim();
  const message = safeText(candidate.message).trim();
  if (!code && !message) return undefined;
  return {
    code: code || 'unknown',
    message: message || '场景图生成失败',
    at: safeTimestamp(candidate.at, 0),
  };
}

function normalizeRecord(input: unknown, nodeIdHint = '', now = Date.now()): MapSceneImageRecord | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const nodeId = normalizeNodeId(value.nodeId) || normalizeNodeId(nodeIdHint);
  if (!nodeId) return null;

  const createdAt = safeTimestamp(value.createdAt, now);
  const updatedAt = safeTimestamp(value.updatedAt, createdAt);
  const lastAttemptAt = safeTimestamp(value.lastAttemptAt, createdAt);
  const status = VALID_STATUSES.has(value.status as MapSceneImageStatus)
    ? value.status as MapSceneImageStatus
    : 'failed';
  const provider = value.provider === 'openai' || value.provider === 'comfyui'
    ? value.provider
    : 'novelai';

  const record: MapSceneImageRecord = {
    version: 1,
    schema: 'map_scene_image',
    nodeId,
    canonicalPath: safeText(value.canonicalPath, nodeId).trim() || nodeId,
    locationLabel: safeText(value.locationLabel, nodeId).trim() || nodeId,
    sourceMapHash: safeText(value.sourceMapHash).trim(),
    status,
    imagePath: safeImagePath(value.imagePath),
    prompt: safeText(value.prompt),
    negativePrompt: safeText(value.negativePrompt),
    width: safeDimension(value.width, DEFAULT_WIDTH),
    height: safeDimension(value.height, DEFAULT_HEIGHT),
    provider,
    imagePromptApiPresetId: safeText(value.imagePromptApiPresetId).trim(),
    createdAt,
    updatedAt,
    lastAttemptAt,
  };

  const error = normalizeError(value.error);
  if (error) record.error = error;
  const cleanupPendingPath = safeImagePath(value.cleanupPendingPath);
  if (cleanupPendingPath) record.cleanupPendingPath = cleanupPendingPath;
  return record;
}

function sceneKey(nodeId: string): string {
  return `${MAP_SCENE_IMAGE_KEY_PREFIX}${nodeId}`;
}

function normalizeIndex(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const nodeId = normalizeNodeId(item);
    if (!nodeId || seen.has(nodeId)) continue;
    seen.add(nodeId);
    result.push(nodeId);
  }
  return result;
}

function defaultDeps(): MapSceneStoreDeps {
  return {
    readFeature: readStoryFeature,
    hasFeature: hasStoryFeature,
    writeFeature: writeStoryFeature,
    writeFeatures: writeStoryFeatures,
    deleteStoredImage,
    cleanupImages: async paths => requestMapImageCleanup(paths),
    now: () => Date.now(),
  };
}

function addCleanupPath(
  cleanup: Array<{ recordNodeId: string; imagePath: string }>,
  seen: Set<string>,
  recordNodeId: string,
  imagePath: string | undefined,
  retainedPaths: Set<string>,
): void {
  if (!imagePath || retainedPaths.has(imagePath) || seen.has(imagePath)) return;
  seen.add(imagePath);
  cleanup.push({ recordNodeId, imagePath });
}

export function planMapSceneMerge(input: {
  records: MapSceneImageRecord[];
  leftNodeId: string;
  rightNodeId: string;
  finalNodeId: string;
  visualSourceId: string;
  idMigration: Map<string, string>;
  canonicalPath: string;
  locationLabel: string;
}): MapSceneMergePlan {
  const recordsById = new Map(input.records.map((record) => [record.nodeId, record]));
  const leftRecord = recordsById.get(input.leftNodeId);
  const rightRecord = recordsById.get(input.rightNodeId);
  const visualRecord = recordsById.get(input.visualSourceId);
  const rootIds = new Set([input.leftNodeId, input.rightNodeId]);
  const upserts: MapSceneImageRecord[] = [];
  const deleteNodeIds: string[] = [];

  if (visualRecord) {
    upserts.push({
      ...visualRecord,
      nodeId: input.finalNodeId,
      canonicalPath: input.canonicalPath,
      locationLabel: input.locationLabel,
      updatedAt: visualRecord.updatedAt,
    });
  }

  for (const record of input.records) {
    if (rootIds.has(record.nodeId)) continue;
    const mappedId = input.idMigration.get(record.nodeId);
    if (mappedId) upserts.push({ ...record, nodeId: mappedId });
  }

  for (const nodeId of rootIds) {
    if (recordsById.has(nodeId) && nodeId !== input.finalNodeId) deleteNodeIds.push(nodeId);
  }
  if (visualRecord && input.visualSourceId !== input.finalNodeId && !deleteNodeIds.includes(input.visualSourceId)) {
    deleteNodeIds.push(input.visualSourceId);
  }

  const retainedPaths = new Set(upserts.map((record) => record.imagePath).filter(Boolean));
  const cleanup: Array<{ recordNodeId: string; imagePath: string }> = [];
  const seenCleanupPaths = new Set<string>();
  for (const record of [leftRecord, rightRecord]) {
    if (!record) continue;
    addCleanupPath(cleanup, seenCleanupPaths, record.nodeId, record.imagePath, retainedPaths);
    addCleanupPath(cleanup, seenCleanupPaths, record.nodeId, record.cleanupPendingPath, retainedPaths);
  }

  return { upserts, deleteNodeIds, cleanup, pendingNodeId: input.finalNodeId };
}

export async function cleanupMapSceneMerge(
  plan: MapSceneMergePlan,
): Promise<{ failedPaths: string[] }> {
  const cleanup = await requestMapImageCleanup(plan.cleanup.map(item => item.imagePath));
  return { failedPaths: cleanup.failedPaths };
}

export function createMapSceneStore(overrides: Partial<MapSceneStoreDeps> = {}): MapSceneStore {
  const deps: MapSceneStoreDeps = { ...defaultDeps(), ...overrides };
  if (!overrides.cleanupImages && overrides.deleteStoredImage) {
    // Explicit test/embedding adapters retain direct behavior. Production has
    // no override and always goes through reference-aware GC.
    deps.cleanupImages = async paths => {
      const failedPaths: string[] = [];
      for (const path of paths) {
        const result = await deps.deleteStoredImage(path);
        if (!result.ok) failedPaths.push(path);
      }
      return { failedPaths };
    };
  }

  async function readIndex(persistNormalized = true): Promise<string[]> {
    const raw = deps.readFeature<unknown>(MAP_SCENE_IMAGE_INDEX_KEY, []);
    const index = normalizeIndex(raw);
    if (persistNormalized && (!Array.isArray(raw) || !sameStringArray(raw as string[], index))) {
      await deps.writeFeature(MAP_SCENE_IMAGE_INDEX_KEY, index);
    }
    return index;
  }

  async function writeRecordAndIndex(record: MapSceneImageRecord, index: string[]): Promise<boolean> {
    const updates = {
      [sceneKey(record.nodeId)]: record,
      [MAP_SCENE_IMAGE_INDEX_KEY]: index,
    };
    return deps.writeFeatures(updates, []);
  }

  async function clearRecord(nodeIdInput: string): Promise<{ cleared: boolean; cleanupFailed: boolean }> {
    const nodeId = normalizeNodeId(nodeIdInput);
    if (!nodeId) return { cleared: false, cleanupFailed: false };
    const current = await store.readMapSceneImage(nodeId);
    if (!current) return { cleared: false, cleanupFailed: false };

    const now = deps.now();
    const imagePaths = [...new Set(
      [current.imagePath, current.cleanupPendingPath].filter((value): value is string => Boolean(value)),
    )];
    const clearedRecord: MapSceneImageRecord = {
      ...current,
      status: 'cleared',
      imagePath: '',
      updatedAt: now,
    };
    delete clearedRecord.error;
    delete clearedRecord.cleanupPendingPath;

    const index = await readIndex();
    if (!await writeRecordAndIndex(clearedRecord, index)) {
      return { cleared: false, cleanupFailed: false };
    }

    const cleanup = await deps.cleanupImages(imagePaths);
    return { cleared: true, cleanupFailed: cleanup.failedPaths.length > 0 };
  }

  const store: MapSceneStore = {
    async readMapSceneImage(nodeIdInput: string): Promise<MapSceneImageRecord | null> {
      const nodeId = normalizeNodeId(nodeIdInput);
      if (!nodeId) return null;
      await readIndex();
      const raw = deps.readFeature<unknown>(sceneKey(nodeId), null);
      // 读取旧/半成品记录时使用稳定的 0 作为缺省时间，避免同一条记录在连续读取间发生“幽灵更新”。
      return normalizeRecord(raw, nodeId, 0);
    },

    async writeMapSceneImage(input: MapSceneImageRecord): Promise<boolean> {
      const record = normalizeRecord(input, '', deps.now());
      if (!record) return false;
      const index = await readIndex();
      if (!index.includes(record.nodeId)) index.push(record.nodeId);
      return writeRecordAndIndex(record, index);
    },

    async clearMapSceneImage(nodeId: string): Promise<boolean> {
      const result = await clearRecord(nodeId);
      return result.cleared;
    },

    async listMapSceneImages(): Promise<MapSceneImageRecord[]> {
      const index = await readIndex();
      const records: MapSceneImageRecord[] = [];
      // 内联读单条记录：不走 store.readMapSceneImage（其内部每次重复 readIndex），
      // 批量列举时索引只读一次，避免 N 次重复读索引（地图库列表渲染的卡顿源之一）。
      for (const nodeId of index) {
        const raw = deps.readFeature<unknown>(sceneKey(nodeId), null);
        const record = normalizeRecord(raw, nodeId, 0);
        if (record) records.push(record);
      }
      return records;
    },

    async clearAllMapSceneImages(): Promise<{ cleared: number; failed: number }> {
      const index = await readIndex();
      let cleared = 0;
      let failed = 0;
      for (const nodeId of index) {
        const result = await clearRecord(nodeId);
        if (result.cleared) cleared++;
        if (result.cleanupFailed) failed++;
      }
      return { cleared, failed };
    },
  };

  return store;
}

export const mapSceneStore = createMapSceneStore();

export function readMapSceneImage(nodeId: string): Promise<MapSceneImageRecord | null> {
  return mapSceneStore.readMapSceneImage(nodeId);
}

export function writeMapSceneImage(record: MapSceneImageRecord): Promise<boolean> {
  return mapSceneStore.writeMapSceneImage(record);
}

export function clearMapSceneImage(nodeId: string): Promise<boolean> {
  return mapSceneStore.clearMapSceneImage(nodeId);
}

export function listMapSceneImages(): Promise<MapSceneImageRecord[]> {
  return mapSceneStore.listMapSceneImages();
}

export function clearAllMapSceneImages(): Promise<{ cleared: number; failed: number }> {
  return mapSceneStore.clearAllMapSceneImages();
}
