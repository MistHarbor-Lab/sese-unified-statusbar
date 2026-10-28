// ===== 统一状态栏 · 存储彻底重置（兜底自救）=====
//
// 等价于 docs/reference/ub-storage-reset.cjs 的模式 B，但在插件内通过酒馆 API 完成：
//   1. 清除所有聊天（含群组）chat_metadata.unifiedStatusbar
//   2. 删除 user/files 下所有可推导的 usb_* 外部存储文件
// 只能在欢迎页（未加载角色卡）执行：已打开的聊天由酒馆持有内存副本，
// 会在下一次保存时覆盖回磁盘，导致清理不生效。
//
// 与离线脚本的差异：酒馆无「列出 user/files 目录」的 API，文件名只能按
// 命名规则从各聊天 metadata 的 storageId、全局命名空间与固定名推导，
// 再用 /api/files/verify 批量确认存在后删除。极少数游离文件（如手工拷贝的
// 未知命名产物）可能遗漏——那种场景仍可用离线脚本兜底。

import { isRecord } from './type-guards';
import { sha256Hex } from './external-storage-codec';
import { verifyAndDeleteUserFiles, serverFileStore, type ServerFileStore } from './server-file-store';
import type { MigrationChatRecord } from './storage-v3-silly-host';
import { GLOBAL_STORAGE_NAMESPACES } from './storage-namespaces';
import { chatStorageHash } from './chat-storage-identity';
import { sillyTavernContextOrRoot } from './env';

export interface StorageHardResetReport {
  chatsScanned: number;
  chatsStripped: number;
  chatsFailed: number;
  filesDeleted: number;
  filesFailed: number;
  errors: string[];
}

export type StorageHardResetProgress = (message: string, current: number, total: number) => void;

export interface StorageHardResetDeps {
  files: ServerFileStore;
  listChats: () => Promise<MigrationChatRecord[]>;
  /** 把 record.chat（已去掉 unifiedStatusbar）写回酒馆并确认读回无该键。 */
  saveChatWithoutMeta: (record: MigrationChatRecord) => Promise<boolean>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function storageIdsFromRecord(record: MigrationChatRecord): string[] {
  const ids: string[] = [];
  const raw = isRecord(record.metadata) ? record.metadata.unifiedStatusbar : undefined;
  if (isRecord(raw)) {
    if (typeof raw.storageId === 'string' && UUID_RE.test(raw.storageId)) ids.push(raw.storageId);
    const fork = isRecord(raw.forkSource) ? raw.forkSource : undefined;
    if (fork && typeof fork.storageId === 'string' && UUID_RE.test(fork.storageId)) ids.push(fork.storageId);
  }
  return ids;
}

/** 各聊天旧版（V2）chatKey 候选：与 story-floor-store getStoryContext 的 `${stableId}::${chatId}` 同构。 */
function legacyChatKeys(record: MigrationChatRecord): string[] {
  if (record.owner.kind !== 'character') return [];
  const keys = new Set<string>();
  for (const stable of [record.owner.avatar, record.characterName || '']) {
    if (stable) keys.add(`${stable}::${record.owner.chatId}`);
  }
  return [...keys];
}

// F7：以 core/storage-namespaces.ts 单一登记处为准——曾因这份手写清单漏登记 story-images，
// 一键清空后图库文件残留。导出名保留（兼容既有引用），内容改由登记处派生。
export const HARD_RESET_GLOBAL_NAMESPACES = GLOBAL_STORAGE_NAMESPACES;
const FIXED_FILES = ['usb_registry_v1.json', 'usb_migration_manifest_v3.json', 'usb_storage_index_v1.json'];

interface LegacyGlobalHead {
  snapshotFile?: unknown;
  segments?: unknown;
  obsoleteFiles?: unknown;
}

function stringsFrom(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** 纯函数：从聊天记录推导全部候选文件名（存在与否由 verify 阶段确认）。 */
export function buildHardResetCandidateFiles(records: MigrationChatRecord[]): string[] {
  const files = new Set<string>(FIXED_FILES);
  for (const namespace of HARD_RESET_GLOBAL_NAMESPACES) {
    const scopeHash = sha256Hex(`global:${namespace}`).slice(0, 24);
    const oldHash = sha256Hex(namespace).slice(0, 16);
    files.add(`usb_global_${namespace}_${scopeHash}.json`);
    files.add(`usb_g_${namespace}_${oldHash}.json`);
    files.add(`usb_g_${namespace}_${oldHash}_head_v1.json`);
  }
  for (const record of records) {
    for (const storageId of storageIdsFromRecord(record)) {
      const hash = sha256Hex(storageId).slice(0, 24);
      files.add(`usb_story_core_${hash}.json`);
      files.add(`usb_story_map_${hash}.json`);
      files.add(`usb_portraits_${hash}.json`);
      files.add(`usb_portraits_${hash}.bak.json`);
      files.add(`usb_bakidx_${hash}.json`);
      // F63(第十二轮)：手机域纳入重置——此前清单只推主项目文件，重置后手机数据仍在磁盘但
      // 聊天元数据已被清（storageId 重铸）⇒ 旧 usb_phone_* 变成谁也读不到的孤儿文件，
      // 且共享索引被删 ⇒ 连「全局手机存储管理」也列不出来。补两条后与「彻底重置」的承诺、
      // 以及离线脚本 ub-storage-reset.cjs 模式 B（删所有 usb_*）语义一致。
      files.add(`usb_phone_${chatStorageHash(storageId)}.json`);
      files.add(`usb_phonebakidx_${hash}.json`);
    }
    for (const chatKey of legacyChatKeys(record)) {
      const hash = sha256Hex(chatKey).slice(0, 24);
      files.add(`usb_story_${hash}.json`);
      files.add(`usb_bakidx_${hash}.json`);
    }
  }
  return [...files];
}

/** 追加从引用文件里挖出的二级文件名（manifest.remainingFiles、legacy head 的快照/分段、备份索引清单）。 */
export function mergeReferencedFiles(candidates: string[], reads: {
  manifest?: { remainingFiles?: unknown } | null;
  legacyHeads?: LegacyGlobalHead[];
  backupIndexes?: { backups?: unknown }[];
}): string[] {
  const files = new Set<string>(candidates);
  const manifest = reads.manifest;
  if (manifest && Array.isArray(manifest.remainingFiles)) {
    for (const name of manifest.remainingFiles) {
      if (typeof name === 'string' && name.startsWith('usb_')) files.add(name);
    }
  }
  for (const head of reads.legacyHeads || []) {
    for (const name of [...stringsFrom(head.snapshotFile ? [head.snapshotFile] : []), ...stringsFrom(head.segments), ...stringsFrom(head.obsoleteFiles)]) {
      if (name) files.add(name);
    }
  }
  for (const index of reads.backupIndexes || []) {
    if (!Array.isArray(index.backups)) continue;
    for (const backup of index.backups) {
      if (isRecord(backup) && typeof backup.file === 'string') files.add(backup.file);
    }
  }
  return [...files];
}

async function readJsonOrNull<T>(files: ServerFileStore, filename: string): Promise<T | null> {
  const result = await files.readJson<T>(filename);
  return result.found ? (result.value ?? null) : null;
}

export function createStorageHardResetDeps(overrides: Partial<StorageHardResetDeps> = {}): StorageHardResetDeps {
  const post = async (url: string, body: unknown): Promise<any> => {
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      // U32：双窗根探测收编（st 解包变体走 contextOrRoot；getContext 抛错仍归本处 catch）
      const context = sillyTavernContextOrRoot();
      if (typeof context?.getRequestHeaders === 'function') headers = context.getRequestHeaders();
    } catch (_e) { /* fallback headers */ }
    const response = await fetch(url, {
      method: 'POST', headers, cache: 'no-cache', body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${url} 请求失败（HTTP ${response.status}）`);
    return response.json();
  };
  const readChat = async (owner: MigrationChatRecord['owner']): Promise<unknown[]> => {
    const payload = owner.kind === 'character'
      ? await post('/api/chats/get', { avatar_url: owner.avatar, file_name: owner.chatId })
      : await post('/api/chats/group/get', { id: owner.chatId });
    if (!Array.isArray(payload)) throw new Error(`聊天 ${owner.chatId} 格式无效`);
    return payload;
  };
  return {
    files: serverFileStore,
    listChats: async () => {
      const { createStorageV3SillyHost } = await import('./storage-v3-silly-host');
      return createStorageV3SillyHost().listChats();
    },
    saveChatWithoutMeta: async (record) => {
      const chat = record.chat;
      if (!Array.isArray(chat) || !isRecord(chat[0])) return false;
      const metadata = isRecord(chat[0].chat_metadata) ? chat[0].chat_metadata : {};
      if ('unifiedStatusbar' in metadata) return false;
      const url = record.owner.kind === 'character' ? '/api/chats/save' : '/api/chats/group/save';
      const body = record.owner.kind === 'character'
        ? {
            ch_name: record.characterName || record.owner.avatar,
            file_name: record.owner.chatId,
            avatar_url: record.owner.avatar,
            chat,
            force: false,
          }
        : { id: record.owner.chatId, chat, force: false };
      await post(url, body);
      const readback = await readChat(record.owner);
      return isRecord(readback[0]) && isRecord(readback[0].chat_metadata)
        && !('unifiedStatusbar' in readback[0].chat_metadata);
    },
    ...overrides,
  };
}

export async function runStorageHardReset(
  options: { onProgress?: StorageHardResetProgress; deps?: Partial<StorageHardResetDeps> } = {},
): Promise<StorageHardResetReport> {
  const deps = createStorageHardResetDeps(options.deps);
  const progress = options.onProgress || (() => {});
  const report: StorageHardResetReport = {
    chatsScanned: 0, chatsStripped: 0, chatsFailed: 0,
    filesDeleted: 0, filesFailed: 0, errors: [],
  };

  // 1. 枚举所有聊天（含群组），边枚举边清 unifiedStatusbar。
  progress('枚举聊天', 0, 0);
  const records = await deps.listChats();
  report.chatsScanned = records.length;
  const stripTargets = records.filter(record => isRecord(record.metadata) && 'unifiedStatusbar' in record.metadata);
  progress('清除聊天标记', 0, stripTargets.length);
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (isRecord(record.metadata) && 'unifiedStatusbar' in record.metadata) {
      const chat = record.chat;
      if (Array.isArray(chat) && isRecord(chat[0]) && isRecord(chat[0].chat_metadata)) {
        delete chat[0].chat_metadata.unifiedStatusbar;
      }
      try {
        if (await deps.saveChatWithoutMeta(record)) report.chatsStripped += 1;
        else {
          report.chatsFailed += 1;
          report.errors.push(`聊天 ${record.owner.chatId} 标记写回未确认`);
        }
      } catch (error) {
        report.chatsFailed += 1;
        report.errors.push(`聊天 ${record.owner.chatId} 标记清除失败：${error instanceof Error ? error.message : String(error)}`);
      }
      progress('清除聊天标记', report.chatsStripped + report.chatsFailed, stripTargets.length);
    }
  }

  // 2. 推导候选文件 → 二级引用补全 → verify 批量确认 → 逐个删除。
  progress('收集存储文件', 0, 0);
  let candidates = buildHardResetCandidateFiles(records);
  const legacyHeads: LegacyGlobalHead[] = [];
  const backupIndexes: { backups?: unknown }[] = [];
  for (const filename of candidates) {
    // F63：手机备份索引（usb_phonebakidx_*）与主项目备份索引同形（backups[].file），一并读入补全二级文件名
    if (!filename.endsWith('_head_v1.json')
      && !filename.startsWith('usb_bakidx_')
      && !filename.startsWith('usb_phonebakidx_')) continue;
    const value = await readJsonOrNull<any>(deps.files, filename);
    if (!value) continue;
    if (filename.includes('_head_')) legacyHeads.push(value as LegacyGlobalHead);
    else backupIndexes.push(value);
  }
  const manifest = await readJsonOrNull<{ remainingFiles?: unknown }>(deps.files, 'usb_migration_manifest_v3.json');
  candidates = mergeReferencedFiles(candidates, { manifest, legacyHeads, backupIndexes });

  // U50：verify→filter→delete 三件套收编 server-file-store.verifyAndDeleteUserFiles（progress 语义不变）
  const deletion = await verifyAndDeleteUserFiles(deps.files, candidates, (step, done, total) => {
    progress(step === 'verify' ? '确认文件存在' : '删除存储文件', done, total);
  });
  report.filesDeleted += deletion.deleted;
  report.filesFailed += deletion.failed;
  report.errors.push(...deletion.errors);
  return report;
}
