/**
 * core/chat-relocation.ts — 一键搬家
 *
 * 把当前聊天最后 N 层 AI 楼层复制成一个新聊天文件（同角色目录），新聊天自带：
 *  - 数据库：切割层（倒数第 N 层）完整状态固化为 full checkpoint（数据库插件 V2 帧），后续 N-1 层增量帧原样复制；
 *  - 外部存储：全新 storageId，journal 压缩到切割点（baseline 折叠到切割层含本层，保留切割层之后 entries），portrait 域全量复制；
 *  - 聊天级元数据：完整继承父聊天 `ctx.chatMetadata`（备注/定时世界书/台账身份等），写入 ST chatHeader 首行。
 *    伴生插件（小手机、瑟瑟台账）经 __ubStorageRelocation 注册复制器，可同时把自己的存储改签到新身份。
 *
 * 原聊天与原外部存储完全不动：不调 saveChat、不写原 file_name、不动原 storageId 域文件。
 * 性能：模块仅静态导出函数，按钮点击才执行；未触发时零开销。
 *
 * 兜底（切割层回放不出基线）：数据库模板修复的收敛步骤会把整库折叠成「最新 AI 楼层一个 full
 * checkpoint」，其之前所有楼层的帧被删除（core/db-checkpoint-converge.ts）。若切割层落在这个
 * 回放根之前，`exportFullCheckpointAtMessageIndex(切割层)` 就找不到基线、返回错误——修复过的
 * 聊天便再也搬不了家。此时改用「父聊天末层」的整库快照作切割层状态：新聊天内容是切割层…父
 * 聊天末层，该快照恰等于新聊天末层应有的状态（净效果与原路径等价：两条路径回放到末尾都得到
 * 父聊天末层的状态），代价是新聊天只留末层状态、不再有逐层增量，故尾段帧随之下沉（见
 * clearRelocatedTailDbFrames），避免其增量在同一份状态上重复应用。
 */

import { padNumber } from './number';
import { isAnchorCandidate, activeStoryReplayAnchors } from './external-story-store';
import {
  type ChatOwner,
  type ChatStorageDomain,
  type ChatStorageMeta,
  createChatStorageUuid,
  normalizeChatStorageMeta,
} from './chat-storage-identity';
import {
  type StoryDomainJournal,
  type StoryDomainJournalEntry,
  createStoryDomainStore,
} from './story-domain-store';
import { createPortraitPersistentStore } from './portrait-persistent-store';
import { runStorageRelocationCopiers } from './storage-relocation-bridge';
import { cloneJson } from './external-storage-codec';
import { serverFileStore } from './server-file-store';
import { getAutoCardAPI } from './data-manager';
import { LEGACY_V1_FIELDS } from './db-checkpoint-converge';

export interface RelocateResult {
  ok: boolean;
  newChatId?: string;
  error?: string;
  /** 切割层已在数据库回放根之前（模板修复收敛过历史帧）→ 兜底取父聊天末层整库快照作切割层状态，
   *  新聊天数据库只保留末层状态、无逐层增量。调用方可据此给用户额外说明。 */
  historyFlattened?: boolean;
}

interface StContext {
  chat: any[];
  chatId: string;
  characterId: number | string;
  characters: any[];
  chatMetadata: Record<string, unknown> | null;
  groupId?: string | null;
  getRequestHeaders?: () => Record<string, string>;
  openCharacterChat?: (file_name: string) => Promise<void>;
}

function getStContext(): StContext | null {
  const candidates: any[] = [];
  try { candidates.push((window as any).SillyTavern); } catch (_e) { /* ignore */ }
  try { candidates.push((window.parent as any).SillyTavern); } catch (_e) { /* cross-origin */ }
  try { candidates.push((window as any).TavernHelper?.SillyTavern); } catch (_e) { /* ignore */ }
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const ctx = typeof candidate.getContext === 'function' ? candidate.getContext() : candidate;
      if (ctx && Array.isArray(ctx.chat) && typeof ctx.chatId === 'string') return ctx as StContext;
    } catch (_e) { /* next */ }
  }
  return null;
}

function defaultHeaders(ctx: StContext | null): Record<string, string> {
  if (ctx && typeof ctx.getRequestHeaders === 'function') {
    const h = ctx.getRequestHeaders();
    if (h && typeof h === 'object') return h;
  }
  return { 'Content-Type': 'application/json' };
}

/** 本地生成 SillyTavern 风格时间戳 YYYY-MM-DD@hh-mm-ss，用作新聊天文件名片段。 */
function humanizedDateTimeLocal(d = new Date()): string {
  return `${d.getFullYear()}-${padNumber(d.getMonth() + 1)}-${padNumber(d.getDate())}@${padNumber(d.getHours())}-${padNumber(d.getMinutes())}-${padNumber(d.getSeconds())}`;
}

/**
 * 从 chat 末尾往前数 AI 楼层，返回倒数第 N 层 AI 消息在 chat 数组中的下标。
 * user 消息不计数；不足 N 层返回 -1。
 */
export function findCutMessageIndex(chat: any[], layers: number): number {
  if (!Array.isArray(chat) || layers < 1) return -1;
  let count = 0;
  for (let i = chat.length - 1; i >= 0; i--) {
    if (isAnchorCandidate(chat[i])) {
      count++;
      if (count === layers) return i;
    }
  }
  return -1;
}

/**
 * 一键搬家楼层重映射：把复制帧里携带的原聊天绝对 AI 楼层号改写到新聊天的楼层坐标系。
 *
 * 数据库 V2 帧的 checkpoint/perSheetCheckpoints.scheduleSummary.lastFilledAiFloor、
 * lastChangedAiFloor 与 logEntries[].aiFloor 在写入时记录的是原聊天的绝对楼层号。
 * 搬家后新聊天从切割层起重新从 1 计数；若不重映射，调度器（update-scheduler 经
 * table-history.v2FrameTrackedUpdateFloor_ACU）读到的「上次更新楼层」仍是原聊天的大数
 * （如 100），而新聊天只有 N 层（如 10），effectiveUnrecordedFloors 恒为 0 → 永不自动更新。
 *
 * offset = 切割层在原聊道的 AI 楼层号 - 1（切割层在新聊天 = 第 1 层）。
 * newFloor = max(1, originalFloor - offset)：切割层及之前的历史全部折叠到第 1 层，
 * 切割层之后的层按原间距顺延。仅重映射 > 0 的有效值，0/undefined 视作未设置不动。
 */
export function remapRelocatedFrameFloors(frame: any, offset: number): void {
  if (!frame || typeof frame !== 'object' || offset <= 0) return;
  const remap = (n: number): number => Math.max(1, Math.floor(n) - offset);
  const remapSummary = (summary: any): void => {
    if (!summary || typeof summary !== 'object') return;
    if (typeof summary.lastFilledAiFloor === 'number' && summary.lastFilledAiFloor > 0) {
      summary.lastFilledAiFloor = remap(summary.lastFilledAiFloor);
    }
    if (typeof summary.lastChangedAiFloor === 'number' && summary.lastChangedAiFloor > 0) {
      summary.lastChangedAiFloor = remap(summary.lastChangedAiFloor);
    }
  };

  const checkpoint = frame.checkpoint;
  if (checkpoint?.scheduleSummary && typeof checkpoint.scheduleSummary === 'object') {
    for (const summary of Object.values(checkpoint.scheduleSummary)) remapSummary(summary);
  }
  const perSheetCheckpoints = frame.perSheetCheckpoints;
  if (perSheetCheckpoints && typeof perSheetCheckpoints === 'object') {
    for (const sheetCp of Object.values(perSheetCheckpoints)) {
      remapSummary((sheetCp as any)?.scheduleSummary);
    }
  }
  if (Array.isArray(frame.logEntries)) {
    for (const entry of frame.logEntries) {
      if (entry && typeof entry === 'object' && typeof entry.aiFloor === 'number' && entry.aiFloor > 0) {
        entry.aiFloor = remap(entry.aiFloor);
      }
    }
  }
  const refill = frame.manualRefillProgress;
  if (refill && typeof refill === 'object'
    && typeof refill.targetAiFloor === 'number' && refill.targetAiFloor > 0) {
    refill.targetAiFloor = remap(refill.targetAiFloor);
  }
}

/**
 * 外部存储 journal 压缩到切割点（纯函数，可单测）。
 * - newBaseline = 把 anchorsUpToCut（含切割层）命中的 entry 按 revision 升序折叠进原 baseline；
 * - newEntries = anchorsAfterCut（切割层之后）命中的 entry，按 revision 升序保留；
 * - 其余 entry（已删锚点 / 不在任一保留集）丢弃。
 */
export function compactStoryDomainJournalToCut(
  journal: StoryDomainJournal,
  anchorsUpToCut: ReadonlySet<string>,
  anchorsAfterCut: ReadonlySet<string>,
): StoryDomainJournal {
  const baseline = cloneJson(journal.baseline || {});
  const ordered = [...(journal.entries || [])].sort((l, r) => l.revision - r.revision);
  const retained: StoryDomainJournalEntry[] = [];
  for (const entry of ordered) {
    if (anchorsAfterCut.has(entry.anchor)) {
      retained.push(cloneJson(entry));
      continue;
    }
    if (anchorsUpToCut.has(entry.anchor)) {
      if (entry.sets) for (const [k, v] of Object.entries(entry.sets)) baseline[k] = cloneJson(v);
      if (entry.deletes) for (const k of entry.deletes) delete baseline[k];
      continue;
    }
    // 锚点失联（漂移）的 entry → 一并折叠进底账（升序迭代中按原位应用，语义与重放一致），
    // 不丢弃——丢弃会把父聊天刚写入的状态在搬家时清掉。
    if (entry.sets) for (const [k, v] of Object.entries(entry.sets)) baseline[k] = cloneJson(v);
    if (entry.deletes) for (const k of entry.deletes) delete baseline[k];
  }
  const out: StoryDomainJournal = { baseline, entries: retained };
  return out;
}

async function postChatSave(url: string, body: unknown, headers: Record<string, string>): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    cache: 'no-cache',
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${url} 请求失败（HTTP ${response.status}）`);
}

/** 数据库插件 V2 tag data 判据（与 db-checkpoint-converge.ts 同口径）：storageFrame.version===2 + logEntries 数组。 */
function isV2FrameTagData(tagData: unknown): boolean {
  if (!tagData || typeof tagData !== 'object') return false;
  const frame = (tagData as any).storageFrame;
  return !!frame && typeof frame === 'object' && frame.version === 2 && Array.isArray(frame.logEntries);
}

/**
 * 扫描聊天，返回最靠后的整库 full checkpoint 帧（指定隔离键时只看该键；不指定时任意键）。
 * 判据来自插件 storage-frame-v2-replay.ts：回放先按 maxMessageIndex 过滤帧，再在过滤结果里取
 * 最新的 full checkpoint——因此「最新 full checkpoint 的楼层 > 切割层」即意味着切割层及之前
 * 已无任何回放基线（模板修复收敛删帧的后果），搬家必须走兜底。
 */
export function findNewestFullCheckpoint(
  chat: unknown[],
  isolationKey?: string,
): { messageIndex: number; isolationKey: string } | null {
  if (!Array.isArray(chat)) return null;
  for (let index = chat.length - 1; index >= 0; index -= 1) {
    const message = chat[index] as any;
    if (!message || typeof message !== 'object' || message.is_user) continue;
    const container = message.TavernDB_ACU_IsolatedData;
    if (!container || typeof container !== 'object' || Array.isArray(container)) continue;
    const keys = isolationKey ? [isolationKey] : Object.keys(container);
    for (const key of keys) {
      const tagData = (container as any)[key];
      if (isV2FrameTagData(tagData) && (tagData as any).storageFrame.checkpoint?.kind === 'full') {
        return { messageIndex: index, isolationKey: key };
      }
    }
  }
  return null;
}

/**
 * 兜底搬家用：下沉 fromIndex 起（切割层之后）楼层的数据库帧——删除该隔离槽位、清空陈旧向量索引
 * 字段引用与 legacy v1 字段。这些帧的增量已被折叠进切割层的整库快照，保留会在同一份状态上重复
 * 应用（同一行二次插入/删除被撤销）。向量索引外置文件与父聊天共享，只清引用、绝不删文件。
 * 返回被清理的楼层数。
 */
export function clearRelocatedTailDbFrames(chat: unknown[], fromIndex: number, isolationKey: string): number {
  if (!Array.isArray(chat) || !isolationKey) return 0;
  let cleared = 0;
  for (let index = Math.max(0, fromIndex); index < chat.length; index += 1) {
    const message = chat[index] as any;
    if (!message || typeof message !== 'object' || message.is_user) continue;
    let touched = false;
    const container = message.TavernDB_ACU_IsolatedData;
    if (container && typeof container === 'object' && !Array.isArray(container) && isolationKey in container) {
      const tagData = container[isolationKey];
      if (isV2FrameTagData(tagData)) {
        // 只清字段、不删外置文件（文件属父聊天资产，搬家不得触碰）。
        if ('summaryVectorIndexState' in tagData) tagData.summaryVectorIndexState = null;
        if ('summaryVectorIndexManifest' in tagData) tagData.summaryVectorIndexManifest = null;
        delete container[isolationKey];
        if (Object.keys(container).length === 0) delete message.TavernDB_ACU_IsolatedData;
        touched = true;
      }
    }
    for (const field of LEGACY_V1_FIELDS) {
      if (field in message) { delete message[field]; touched = true; }
    }
    if (touched) cleared += 1;
  }
  return cleared;
}

/** 检查当前数据库插件是否具备一键搬家所需 API（exportFullCheckpointAtMessageIndex）。 */
export function isRelocationSupported(): boolean {
  const api = getAutoCardAPI();
  return !!api && typeof api.exportFullCheckpointAtMessageIndex === 'function';
}

/**
 * 一键搬家主入口。layers = 保留最后 N 层 AI 楼层（1-999）。
 * autoOpen = 搬家成功后是否直接切换进入新聊天（调用 SillyTavern openCharacterChat）。
 */
export async function relocateChat(layers: number, autoOpen = false): Promise<RelocateResult> {
  const ctx = getStContext();
  if (!ctx) return { ok: false, error: '无法获取当前聊天上下文（请在角色卡聊天中使用）' };
  if (ctx.groupId) return { ok: false, error: '一键搬家暂不支持群组聊天' };

  const chat = ctx.chat;
  if (!Array.isArray(chat) || chat.length === 0) return { ok: false, error: '当前聊天为空' };

  const cutMsgIdx = findCutMessageIndex(chat, layers);
  if (cutMsgIdx < 0) return { ok: false, error: `当前聊天 AI 楼层不足 ${layers} 层` };

  // 起始下标：带上触发切割层的前置 user 消息，保持对话连贯
  const startIdx = (cutMsgIdx > 0 && chat[cutMsgIdx - 1] && chat[cutMsgIdx - 1].is_user === true)
    ? cutMsgIdx - 1
    : cutMsgIdx;

  // 切割层在原聊天中的 AI 楼序号（1 起；数据库插件口径＝非 user 消息计数，与帧写入时一致）
  let cutOrigFloor = 0;
  for (let i = 0; i <= cutMsgIdx && i < chat.length; i++) {
    if (chat[i] && chat[i].is_user !== true) cutOrigFloor += 1;
  }
  const floorOffset = cutOrigFloor - 1;

  const character = ctx.characters?.[Number(ctx.characterId)];
  const avatar = character?.avatar;
  const characterName = (typeof character?.name === 'string' && character.name.trim()) ? character.name.trim() : (avatar || 'Character');
  if (!avatar || typeof avatar !== 'string') return { ok: false, error: '无法解析当前角色 avatar' };

  const currentChatId = ctx.chatId;
  const parentOwner: ChatOwner = { kind: 'character', avatar, chatId: currentChatId };

  // 1) 数据库 full checkpoint（数据库插件重放切割层含本层状态）
  if (!isRelocationSupported()) {
    return { ok: false, error: '当前数据库版本不支持一键搬家，仅最新定制版数据库支持' };
  }
  const api = getAutoCardAPI();
  let checkpoint: any = null;
  let isoKey = '';
  let historyFlattened = false;
  let snapshotError: string | null = null;
  try {
    const r = await api.exportFullCheckpointAtMessageIndex(cutMsgIdx);
    if (r && !r.error && r.checkpoint) {
      checkpoint = r.checkpoint;
      isoKey = typeof r.isolationKey === 'string' ? r.isolationKey : '';
    } else {
      snapshotError = `数据库快照失败：${r?.error || '未知错误'}`;
      // 切割层落在数据库回放根之前（模板修复收敛删过历史帧）→ 改取父聊天末层的整库快照。
      const newest = findNewestFullCheckpoint(chat);
      if (newest && newest.messageIndex > cutMsgIdx) {
        const fb = await api.exportFullCheckpointAtMessageIndex(chat.length - 1);
        if (fb && !fb.error && fb.checkpoint) {
          checkpoint = fb.checkpoint;
          isoKey = typeof fb.isolationKey === 'string' ? fb.isolationKey : newest.isolationKey;
          historyFlattened = true;
        }
      }
    }
  } catch (e: any) {
    snapshotError = `数据库快照异常：${e?.message || String(e)}`;
  }
  if (!checkpoint) return { ok: false, error: snapshotError || '数据库快照返回为空' };

  // 2) 新 storageId + 外部存储压缩复制
  const newStorageId = createChatStorageUuid();
  const newChatId = `${characterName} - ${humanizedDateTimeLocal()} 搬家`;
  const newOwner: ChatOwner = { kind: 'character', avatar, chatId: newChatId };
  const now = () => Date.now();

  const beforeChat = chat.slice(0, cutMsgIdx + 1);          // 含切割层
  const afterChat = chat.slice(cutMsgIdx + 1);              // 切割层之后
  const anchorsUpToCut = new Set(activeStoryReplayAnchors(beforeChat));
  const anchorsAfterCut = new Set(activeStoryReplayAnchors(afterChat));

  const parentMeta = normalizeChatStorageMeta(ctx.chatMetadata?.unifiedStatusbar);
  const copiedDomains: ChatStorageDomain[] = [];
  let forkSource: ChatStorageMeta['forkSource'] = undefined;

  if (parentMeta && parentMeta.storageId) {
    forkSource = {
      storageId: parentMeta.storageId,
      owner: cloneJson(parentOwner),
      domainsCreated: [...parentMeta.domainsCreated],
      hasAnchoredHistory: parentMeta.hasAnchoredHistory,
    };

    for (const domain of ['story-core', 'story-map'] as const) {
      if (!parentMeta.domainsCreated.includes(domain)) continue;
      try {
        const parentStore = createStoryDomainStore({
          files: serverFileStore, storageId: parentMeta.storageId, domain,
          owner: parentOwner, domainCreated: true, hasAnchoredHistory: parentMeta.hasAnchoredHistory,
          getActiveAnchors: () => anchorsUpToCut, now,
          onDomainCreated: async () => true, onAnchoredHistory: async () => true,
        });
        const pStatus = await parentStore.load();
        if (pStatus.state !== 'ready') continue; // 父域缺失/损坏 → 跳过该域（best-effort）
        const compacted = compactStoryDomainJournalToCut(parentStore.exportJournal(), anchorsUpToCut, anchorsAfterCut);
        const targetStore = createStoryDomainStore({
          files: serverFileStore, storageId: newStorageId, domain,
          owner: newOwner, domainCreated: false, hasAnchoredHistory: false,
          getActiveAnchors: () => anchorsAfterCut, now,
          onDomainCreated: async () => true, onAnchoredHistory: async () => true,
        });
        await targetStore.load();
        const committed = await targetStore.replaceJournal(compacted);
        if (committed.ok && committed.confirmed) copiedDomains.push(domain);
      } catch (_e) { /* best-effort：单域失败跳过，不中断整体搬家 */ }
    }

    if (parentMeta.domainsCreated.includes('portraits')) {
      try {
        const pParent = createPortraitPersistentStore({
          files: serverFileStore, storageId: parentMeta.storageId,
          owner: parentOwner, domainCreated: true, now, onDomainCreated: async () => true,
        });
        const pStatus = await pParent.load();
        if (pStatus.state === 'ready') {
          const pTarget = createPortraitPersistentStore({
            files: serverFileStore, storageId: newStorageId,
            owner: newOwner, domainCreated: false, now, onDomainCreated: async () => true,
          });
          await pTarget.load();
          if (await pTarget.replaceAll(pParent.readAll())) copiedDomains.push('portraits');
        }
      } catch (_e) { /* best-effort */ }
    }
  }

  // 2b) 新聊天消息数组（先建好：复制器要按锚点计算各自数据要结转到的楼层）
  const newChat: any[] = cloneJson(chat.slice(startIdx));
  if (newChat.length === 0) return { ok: false, error: '切片后聊天为空' };

  // 2c) 伴生插件自有存储域复制（小手机 usb_phone_*、瑟瑟台账 sl_* 等）：搬家只识别主项目三域，
  // 插件经 window.__ubStorageRelocation 注册复制器，把自有域改签到新 storageId / 新聊天身份。
  // best-effort：单个复制器失败/抛错不阻断搬家（复制不成功时插件侧按自己的兜底语义处理）。
  // 复制器可往 chatMetadataPatch 写自己的元数据（如台账新 storageId），随后并入新聊天首行。
  const chatMetadataPatch: Record<string, unknown> = {};
  // 无条件执行：复制器可能不依赖主项目 storageId（台账身份在它自己的存储里），
  // 主项目域没建过的聊天也要能搬。没有注册复制器时是空循环、零开销。
  await runStorageRelocationCopiers({
    parentStorageId: (parentMeta && parentMeta.storageId) || '',
    parentOwner: cloneJson(parentOwner),
    newStorageId,
    newOwner: cloneJson(newOwner),
    newChatId,
    cutMessageIndex: cutMsgIdx,
    retainedChat: newChat,
    chatMetadataPatch,
  });

  const newMeta: ChatStorageMeta = {
    storageId: newStorageId,
    schema: 3,
    domainsCreated: copiedDomains,
    // 复制了 story 域即代表携带了折叠后的真实历史底账（anchored）；仅 portrait 域或无域时为 false。
    hasAnchoredHistory: copiedDomains.some(d => d !== 'portraits'),
    ...(forkSource ? { forkSource } : {}),
  };

  // 新聊天首行＝ST 的 chatHeader（加载时 ST 会 shift 掉首行、只把它当 chat_metadata）。
  // 元数据必须取自 live `ctx.chatMetadata`：ctx.chat 里的消息数组**不含** header，
  // 读 chat[0].chat_metadata 会永远为空——那会丢掉台账身份（seseLedger）等全部聊天级元数据，
  // 新聊天首次打开只能按「全新聊天」建一本空账。
  const orig0 = chat[0] || {};
  const liveMetadata = (ctx.chatMetadata && typeof ctx.chatMetadata === 'object')
    ? ctx.chatMetadata
    : (orig0.chat_metadata && typeof orig0.chat_metadata === 'object' ? orig0.chat_metadata : {});
  const origMetadata = cloneJson(liveMetadata);
  // 清掉数据库插件 owner 标记，让新聊天采纳 SheetGuide/ScopedConfig 容器
  delete origMetadata['TavernDB_ACU_InternalSheetGuide__chatId'];
  delete origMetadata['TavernDB_ACU_ScopedConfig__chatId'];
  Object.assign(origMetadata, chatMetadataPatch);
  origMetadata.unifiedStatusbar = cloneJson(newMeta);
  const chatHeader = {
    chat_metadata: origMetadata,
    user_name: 'unused',
    character_name: 'unused',
  };

  // 切割 AI 层写 full checkpoint 帧（清空 logEntries，checkpoint 已含本层状态）
  const cutIdxInNew = cutMsgIdx - startIdx;
  const cutMsg = newChat[cutIdxInNew];
  if (cutMsg) {
    const iso = (cutMsg.TavernDB_ACU_IsolatedData && typeof cutMsg.TavernDB_ACU_IsolatedData === 'object')
      ? cloneJson(cutMsg.TavernDB_ACU_IsolatedData) : {};
    const existingTag = (iso[isoKey] && typeof iso[isoKey] === 'object') ? iso[isoKey] : {};
    iso[isoKey] = { ...existingTag, _acu_storage_version: 2, storageFrame: { version: 2, checkpoint, logEntries: [] } };
    cutMsg.TavernDB_ACU_IsolatedData = iso;
  }

  // 兜底路径：尾段帧的增量已折叠进切割层整库快照，先整体下沉再重映射楼层，
  // 否则同一份状态上还会再叠一遍这些增量（且它们的原绝对楼层号已无意义）。
  if (historyFlattened) clearRelocatedTailDbFrames(newChat, cutIdxInNew + 1, isoKey);

  // 楼层重映射：复制帧携带原聊天绝对 AI 楼层号，新聊天从切割层起重新从 1 计数。
  // 不重映射则调度器读到的「上次更新楼层」仍是原大数，新聊天楼层够不着 → 永不自动更新。
  // cutOrigFloor/floorOffset 已在切割点确定后按数据库插件口径算出。
  if (floorOffset > 0) {
    for (let i = cutIdxInNew; i < newChat.length; i++) {
      const msg = newChat[i];
      if (!msg || msg.is_user === true) continue;
      const isoData = msg.TavernDB_ACU_IsolatedData;
      if (!isoData || typeof isoData !== 'object') continue;
      const slot = isoData[isoKey];
      if (slot && typeof slot === 'object' && slot.storageFrame) {
        remapRelocatedFrameFloors(slot.storageFrame, floorOffset);
      }
    }
  }

  // 4) 保存新聊天文件（POST /api/chats/save，新 file_name 即创建新 jsonl）
  //    首行必须是 chatHeader（元数据行），不能塞进真实消息——ST 加载时会把首行 shift 掉。
  try {
    await postChatSave('/api/chats/save', {
      ch_name: characterName,
      file_name: newChatId,
      avatar_url: avatar,
      chat: [chatHeader, ...newChat],
      force: false,
    }, defaultHeaders(ctx));
  } catch (e: any) {
    return { ok: false, error: `保存新聊天失败：${e?.message || String(e)}` };
  }

  // 搬家成功后直接切换进入新聊天（openCharacterChat 会触发 CHAT_CHANGED 重放新聊天帧/外部存储）
  if (autoOpen && typeof ctx.openCharacterChat === 'function') {
    try {
      await ctx.openCharacterChat(newChatId);
    } catch (e: any) {
      // 切换失败不影响搬家结果，只提示用户手动打开
      return {
        ok: true,
        newChatId,
        error: `搬家成功但切换新聊天失败，请到该角色聊天列表手动打开「${newChatId}」：${e?.message || String(e)}`,
        ...(historyFlattened ? { historyFlattened: true } : {}),
      };
    }
  }

  return historyFlattened ? { ok: true, newChatId, historyFlattened: true } : { ok: true, newChatId };
}