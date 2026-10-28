// core/db-checkpoint-converge.ts
// 数据库模板修复后的整库 full checkpoint 重建 + 残留清除（对齐插件 deleteLocalDataInChatCoreInner_ACU）。
//
// 背景：V2 存储回放只从最新 full checkpoint 开始（loadTableStateFromFramesV2Detailed_ACU 的
// replayStartMessageIndex 守卫，之前的楼层一律 continue 跳过）。同一 isolationKey 若存在多个
// full checkpoint，手动重填提交最终快照会 fail closed（数据库插件「存在多个整库 full checkpoint，
// 必须先完成完整性修复」）。
//
// 本模块在模板修复成功后：
// 1. 在最新 AI 楼层写 canonical full checkpoint（data = 修复后完整数据）作回放根；
// 2. 删除其之前所有楼层的该隔离槽位（旧 checkpoint + 增量日志一并移除，容器清空则整体删 TavernDB_ACU_IsolatedData）。
//    刻意不残留 {version:2, logEntries:[]} 的空 V2 frame：插件数据清理的边界 checkpoint 会把
//    「边界前存在 V2 槽位但无法恢复」判为失败并中止清理（无法在 boundaryAnchorIndex 前恢复 V2 数据）。
//    删除槽位后边界前不再被识别为 V2，清理正常进行；完整数据已由最新楼层的 full checkpoint 承载。
// 3. 清空前置楼层的陈旧向量索引字段 + 删外置文件（对齐 deleteVectorIndexManifestFromTagData_ACU）；
// 4. 清除所有 AI 楼层 legacy v1 字段（TavernDB_ACU_Data/SummaryData/IndependentData/Identity/ModifiedKeys/UpdateGroupKeys）；
// 5. 清除 chat[0] 旧版表头清单（TavernDB_ACU_TableHeaderGuide）。
// 新 checkpoint 楼层的向量索引保留（importTableAsJson 已刷新）。
//
// 填表前沿保留：重建会清空旧 frame 的追踪标记（event.filledSheetKeys / scheduleSummary /
// modifiedKeys / updateGroupKeys），若新 checkpoint 不携带 scheduleSummary，插件自动填表调度器
// （resolveTableHistoryStatesFromChat_ACU → lastTrackedUpdateAiFloor）会把所有表的前沿视为 0，
// 修复后下一楼层触发从第 1 楼全量重填。因此重建前先按插件调度器语义收集每张表的最后填写楼层，
// 写入新 checkpoint 的 scheduleSummary（对齐插件自身写 checkpoint 时 collectScheduleSummaryFromFramesV2_ACU 的行为）。
//
// 兼容性：7.9 与 8.8.2 的 isV2TagData_ACU 逐字一致，storageFrame.checkpoint 是两端共同的原生 V2 格式，
// 因此只写 V2 canonical checkpoint（不写 legacy 字段——写了会让 8.8.2 判成 legacy-v1 触发自动迁移）。
// 详见 docs/superpowers/specs/2026-08-04-db-template-repair-strengthen-design.md

import { plainClone } from './deep-clone';
/** 插件 V2 tag data 的判据：对象 + storageFrame.version===2 + Array.isArray(storageFrame.logEntries)。 */
function isV2TagData(tagData: unknown): boolean {
  if (!tagData || typeof tagData !== 'object') return false;
  const frame = (tagData as any).storageFrame;
  return !!frame && typeof frame === 'object' && frame.version === 2 && Array.isArray(frame.logEntries);
}

/** legacy v1 字段：清除以避免触发 ensureLegacyStorageMigratedBeforeWrite_ACU 自动迁移（对齐 deleteLocalDataInChatCoreInner_ACU）。
 *  导出给一键搬家复用：兜底路径下沉尾段帧时同样要清掉这些字段，否则旧数据会在下次写入时被自动迁移复活。 */
export const LEGACY_V1_FIELDS = [
  'TavernDB_ACU_Data', 'TavernDB_ACU_SummaryData', 'TavernDB_ACU_IndependentData',
  'TavernDB_ACU_Identity', 'TavernDB_ACU_ModifiedKeys', 'TavernDB_ACU_UpdateGroupKeys',
];
const LEGACY_TABLE_HEADER_GUIDE_FIELD = 'TavernDB_ACU_TableHeaderGuide';

/** 从向量索引 manifest 提取所有外置文件路径（对齐插件 collectManifestFilePaths_ACU / collectManifestReachableFiles_ACU）。 */
function collectManifestFilePaths(manifest: any): string[] {
  if (!manifest || typeof manifest !== 'object') return [];
  const paths = new Set<string>();
  const push = (p: any) => { const s = String(p || '').trim(); if (s) paths.add(s); };
  push(manifest.manifestFile);
  push(manifest.rowsFile);
  push(manifest.tombstoneFile);
  if (Array.isArray(manifest.files)) manifest.files.forEach((f: any) => push(f?.path));
  if (Array.isArray(manifest.batchRefs)) manifest.batchRefs.forEach((b: any) => (b?.files || []).forEach((f: any) => push(f?.path)));
  const ca = manifest.contentAddressed;
  if (ca && Array.isArray(ca.packRefs)) ca.packRefs.forEach((r: any) => push(r?.path));
  return [...paths];
}

/** 清除单个 tagData 上的向量索引字段，返回应删的外置文件路径列表。 */
function clearVectorIndexFields(tagData: any): string[] {
  if (!tagData || typeof tagData !== 'object') return [];
  const manifest = tagData.summaryVectorIndexManifest || tagData.summaryVectorIndexState?.manifest || null;
  const paths = manifest ? collectManifestFilePaths(manifest) : [];
  if ('summaryVectorIndexState' in tagData) tagData.summaryVectorIndexState = null;
  if ('summaryVectorIndexManifest' in tagData) tagData.summaryVectorIndexManifest = null;
  return paths;
}

/** 遍历聊天，返回存在 V2 frame 的隔离键集合（含该键是否已有 full checkpoint）。 */
export function collectIsolationKeysWithV2Frames(chat: unknown[]): string[] {
  const keys = new Set<string>();
  if (!Array.isArray(chat)) return [];
  for (const message of chat) {
    if (!message || typeof message !== 'object' || (message as any).is_user) continue;
    const isolatedData = (message as any).TavernDB_ACU_IsolatedData;
    if (!isolatedData || typeof isolatedData !== 'object' || Array.isArray(isolatedData)) continue;
    for (const isolationKey of Object.keys(isolatedData)) {
      if (isV2TagData(isolatedData[isolationKey])) keys.add(isolationKey);
    }
  }
  return [...keys];
}

/** 填表前沿：每张表最后一次被填写的 AI 楼层（对齐插件 checkpoint.scheduleSummary 格式）。 */
export interface FillFrontierSummary {
  [sheetKey: string]: { lastFilledAiFloor: number };
}

/**
 * 构造重建后的 storageFrame：含一个 canonical full checkpoint（kind:'full'），logEntries 清空。
 * data 必须是修复后的完整表格数据（含 mate + 全部 sheet_*）。
 * scheduleSummary 可选：非空时写入 checkpoint（插件调度器据此判断哪些楼层已处理）。
 */
export function buildRebuiltStorageFrame(
  data: unknown,
  options: { createdAt: number; reason: string; scheduleSummary?: FillFrontierSummary },
): { version: 2; logEntries: never[]; checkpoint: { kind: 'full'; createdAt: number; reason: string; data: unknown; scheduleSummary?: FillFrontierSummary } } {
  const checkpoint: { kind: 'full'; createdAt: number; reason: string; data: unknown; scheduleSummary?: FillFrontierSummary } = {
    kind: 'full',
    createdAt: options.createdAt,
    reason: options.reason,
    data: plainClone(data),
  };
  if (options.scheduleSummary && Object.keys(options.scheduleSummary).length > 0) {
    checkpoint.scheduleSummary = plainClone(options.scheduleSummary);
  }
  return { version: 2, logEntries: [], checkpoint };
}

/**
 * 收集填表前沿：扫描 targetMessageIndex 及之前所有 AI 楼层的 V2 frame，取每张表最后一次被填写的
 * AI 楼层。语义对齐插件调度器（v2ScheduleFilledFloor_ACU / v2EventTracksFill_ACU /
 * getTrackedUpdateFloorInMessage_ACU 的 V2 frame 部分）：
 * - checkpoint / perSheetCheckpoints 的 scheduleSummary[sheetKey].lastFilledAiFloor；
 * - checkpoint.event / perSheetCheckpoints[sheetKey].event / logEntries 的 filledSheetKeys+groupKeys
 *   （logEntries 优先用 entry.aiFloor，缺省用所在楼层）；
 * - tagData 顶层 modifiedKeys / updateGroupKeys。
 * 只收集 data 中存在的 sheet_*（被修复模板丢弃的表不产生前沿）。返回空对象表示无任何追踪
 * （新表按插件设计从第 1 楼补填）。只读，不改 chat。
 *
 * 前沿值一律钳制到目标楼层为止的 AI 楼层总数：搬家/导入复制的旧帧携带原聊天的楼层序号
 * （如 301 层原聊天搬到 26 层后 scheduleSummary/entry.aiFloor 仍为 301），调度器按
 * 「未填层数 = 总层数 - lastFilledAiFloor」计算会得负数，自动填表永久失效，用户只能手动
 * 大范围重填；而重填基底取「范围首楼层-1」的回放，跨越本次重建的 checkpoint 边界时会把
 * 修复时已删除的行按原 row_id 复活（实机确认：在场角色表已删角色反复回涌）。checkpoint
 * 楼层之前的历史已全部物化进新回放根，钳制到当前楼层数即「全部已处理」，语义精确。
 */
export function collectFillFrontierFromChat(
  chat: unknown[],
  isolationKey: string,
  targetMessageIndex: number,
  sheetKeys: string[],
): FillFrontierSummary {
  const frontier: Record<string, number> = {};
  let aiFloor = 0;
  for (let index = 0; index <= targetMessageIndex && index < chat.length; index += 1) {
    const message = chat[index];
    if (!message || typeof message !== 'object' || (message as any).is_user) continue;
    aiFloor += 1;
    const tagData = (message as any).TavernDB_ACU_IsolatedData?.[isolationKey];
    if (!isV2TagData(tagData)) continue;
    const frame = tagData.storageFrame;
    const track = (sheetKey: string, floor: number) => {
      if (sheetKeys.includes(sheetKey)) frontier[sheetKey] = Math.max(frontier[sheetKey] || 0, floor);
    };
    const trackEvent = (event: any, floor: number) => {
      if (!event || typeof event !== 'object') return;
      for (const sheetKey of [...(event.filledSheetKeys || []), ...(event.groupKeys || [])]) track(sheetKey, floor);
    };
    // 1. checkpoint / perSheetCheckpoints 的 scheduleSummary.lastFilledAiFloor
    const fullSummary = frame.checkpoint?.scheduleSummary;
    if (fullSummary && typeof fullSummary === 'object') {
      for (const sheetKey of sheetKeys) {
        const floor = fullSummary[sheetKey]?.lastFilledAiFloor;
        if (Number.isFinite(floor) && floor > 0) track(sheetKey, floor);
      }
    }
    const perSheet = frame.perSheetCheckpoints;
    if (perSheet && typeof perSheet === 'object') {
      for (const sheetKey of sheetKeys) {
        const floor = perSheet[sheetKey]?.scheduleSummary?.lastFilledAiFloor;
        if (Number.isFinite(floor) && floor > 0) track(sheetKey, floor);
      }
    }
    // 2. event 追踪（checkpoint.event / perSheetCheckpoints.event / logEntries）
    trackEvent(frame.checkpoint?.event, aiFloor);
    if (perSheet && typeof perSheet === 'object') {
      for (const sheetKey of sheetKeys) trackEvent(perSheet[sheetKey]?.event, aiFloor);
    }
    for (const entry of frame.logEntries || []) {
      const entryFloor = Number(entry?.aiFloor);
      trackEvent(entry, Number.isFinite(entryFloor) && entryFloor > 0 ? entryFloor : aiFloor);
    }
    // 3. tagData 顶层 modifiedKeys / updateGroupKeys
    for (const sheetKey of sheetKeys) {
      if ((Array.isArray(tagData.modifiedKeys) && tagData.modifiedKeys.includes(sheetKey))
        || (Array.isArray(tagData.updateGroupKeys) && tagData.updateGroupKeys.includes(sheetKey))) {
        track(sheetKey, aiFloor);
      }
    }
  }
  const summary: FillFrontierSummary = {};
  for (const [sheetKey, floor] of Object.entries(frontier)) {
    summary[sheetKey] = { lastFilledAiFloor: Math.min(floor, aiFloor) };
  }
  return summary;
}

/**
 * 规划重建：找聊天里最新 AI 楼层（重建 checkpoint 的落点），收集它之前所有含该隔离键 V2 frame 的楼层。
 * 该键无任何 V2 frame 时返回 null（空白聊天，importTableAsJson 自会写 init checkpoint，不需重建）。
 * 只读，不改 chat。
 */
export function planCheckpointRebuild(
  chat: unknown[],
  isolationKey: string,
): { targetMessageIndex: number; clearIndices: number[] } | null {
  if (!Array.isArray(chat)) return null;
  // 该键是否已有 V2 frame（有才重建；无则跳过）
  let hasV2 = false;
  // 最新 AI 楼层
  let targetMessageIndex = -1;
  for (let index = 0; index < chat.length; index += 1) {
    const message = chat[index];
    if (!message || typeof message !== 'object') continue;
    if (!(message as any).is_user) targetMessageIndex = index;
    const tagData = (message as any).TavernDB_ACU_IsolatedData?.[isolationKey];
    if (isV2TagData(tagData)) hasV2 = true;
  }
  if (!hasV2 || targetMessageIndex < 0) return null;
  // 收集目标楼层之前所有含该隔离键 V2 frame 的楼层
  const clearIndices: number[] = [];
  for (let index = 0; index < targetMessageIndex; index += 1) {
    const message = chat[index];
    if (!message || typeof message !== 'object' || (message as any).is_user) continue;
    const tagData = (message as any).TavernDB_ACU_IsolatedData?.[isolationKey];
    if (isV2TagData(tagData)) clearIndices.push(index);
  }
  return { targetMessageIndex, clearIndices };
}

/** 宿主探测：从 iframe 拿 SillyTavern getContext() 的 chat + saveChat。拿不到返回 null。 */
export function getHostChatContext(): { chat: unknown[]; saveChat: () => Promise<void> } | null {
  if (typeof window === 'undefined') return null;
  const candidates: any[] = [];
  try { candidates.push((window as any).SillyTavern); } catch (_e) { /* ignore */ }
  try { candidates.push((window as any).parent?.SillyTavern); } catch (_e) { /* ignore */ }
  for (const st of candidates) {
    if (!st) continue;
    try {
      const ctx = typeof st.getContext === 'function' ? st.getContext() : st;
      if (ctx && Array.isArray(ctx.chat) && typeof ctx.saveChat === 'function') {
        return { chat: ctx.chat, saveChat: () => ctx.saveChat() };
      }
    } catch (_e) { /* try next */ }
  }
  return null;
}

/** 深度克隆单个消息的可变字段（供失败回滚快照）。覆盖 IsolatedData + legacy v1 字段 + 表头清单。 */
function snapshotMessage(msg: unknown): any {
  const m = msg as any;
  const snap: any = {
    hadIsolatedData: Object.prototype.hasOwnProperty.call(m || {}, 'TavernDB_ACU_IsolatedData'),
    isolatedData: m?.TavernDB_ACU_IsolatedData ? plainClone(m.TavernDB_ACU_IsolatedData) : undefined,
    legacy: {},
  };
  for (const f of LEGACY_V1_FIELDS) {
    if (m && Object.prototype.hasOwnProperty.call(m, f)) snap.legacy[f] = plainClone(m[f]);
  }
  if (m && Object.prototype.hasOwnProperty.call(m, LEGACY_TABLE_HEADER_GUIDE_FIELD)) {
    snap.legacy[LEGACY_TABLE_HEADER_GUIDE_FIELD] = plainClone(m[LEGACY_TABLE_HEADER_GUIDE_FIELD]);
  }
  return snap;
}

function restoreMessageSnapshot(msg: unknown, snapshot: any): void {
  if (!msg || typeof msg !== 'object') return;
  const m = msg as any;
  if (snapshot.hadIsolatedData) {
    m.TavernDB_ACU_IsolatedData = snapshot.isolatedData;
  } else {
    delete m.TavernDB_ACU_IsolatedData;
  }
  for (const f of [...LEGACY_V1_FIELDS, LEGACY_TABLE_HEADER_GUIDE_FIELD]) {
    if (snapshot.legacy && Object.prototype.hasOwnProperty.call(snapshot.legacy, f)) {
      m[f] = snapshot.legacy[f];
    } else if (f in m) {
      delete m[f];
    }
  }
}

export interface ConvergeOptions {
  /** 确认回调，默认用全局 confirm()。测试可注入。 */
  confirm?: (message: string) => boolean | Promise<boolean>;
}

export interface RebuildSummary {
  rebuilt: boolean;
  targetMessageIndex: number;
  clearedCount: number;
  legacyCleared: number;
  vectorFilesDeleted: number;
  headerGuideCleared: boolean;
}

/**
 * 执行器：对每个已有 V2 frame 的隔离键，在最新 AI 楼层重建 canonical full checkpoint（data = 提供的完整数据），
 * 清空目标楼层之前所有含该键 V2 frame 的楼层 storageFrame + 陈旧向量索引字段（+ 删外置文件），
 * 清除所有 AI 楼层 legacy v1 字段，清除 chat[0] 旧版表头清单。
 * 新 checkpoint 楼层向量索引保留（importTableAsJson 已刷新）。
 * 需要重建时先 confirm（默认原生 confirm），确认后逐楼层快照→改写→saveChat；失败恢复快照并抛出。
 * 无需重建（无 V2 frame / 无目标楼层）时零操作。options.deleteExternalFile 注入外置文件删除器（不传则只清字段）。
 */
export async function rebuildChatCheckpoints(
  chat: unknown[],
  saveChat: () => Promise<void>,
  data: unknown,
  options: ConvergeOptions & { reason?: string; createdAt?: number; deleteExternalFile?: (path: string) => Promise<{ ok: boolean; error?: string }> } = {},
): Promise<RebuildSummary> {
  const summary: RebuildSummary = { rebuilt: false, targetMessageIndex: -1, clearedCount: 0, legacyCleared: 0, vectorFilesDeleted: 0, headerGuideCleared: false };
  if (!Array.isArray(chat) || chat.length === 0) return summary;
  const keys = collectIsolationKeysWithV2Frames(chat);
  if (keys.length === 0) return summary;

  const plans: { isolationKey: string; targetMessageIndex: number; clearIndices: number[] }[] = [];
  for (const isolationKey of keys) {
    const plan = planCheckpointRebuild(chat, isolationKey);
    if (plan) plans.push({ isolationKey, ...plan });
  }
  if (plans.length === 0) return summary;

  const totalCleared = plans.reduce((sum, p) => sum + p.clearIndices.length, 0);
  const doConfirm = options.confirm ?? ((message: string) => {
    try { return typeof (window as any).confirm === 'function' && (window as any).confirm(message); }
    catch (_e) { return false; }
  });
  const ok = await doConfirm(
    `数据库模板修复已完成。是否在最新 AI 楼层重建整库全量快照，并清空其之前所有楼层的旧数据库数据（检查点 + 增量日志 + 陈旧向量索引及其外置文件 + 旧版兼容字段）？` +
    '该操作以修复后的完整数据建立新的回放根，之前的模板残留不再影响当前内容。继续？',
  );
  if (!ok) return summary;

  // 防御：数据库插件手动编辑可能有待落盘的 V2 log entry 已在内存 chat 数组上、尚未 saveChat。
  // 改写 IsolatedData 前先 flush，避免其延迟 saveChat 在本修复 saveChat 之后触发覆盖（last-writer-wins）。
  // 只认真数据库：本条链仅由「设置 → 表格」的模板修复入口触发，而台账模式下该页整体退役
  // （core/ledger-takeover.ts isLedgerTakeover），台账的外部存储快照不经过本通道。
  try {
    const api = (window as any).AutoCardUpdaterAPI || null;
    if (api?.hasPendingSaves?.()) await api.flushPendingSaves();
  } catch (_) { /* flush 失败不阻断修复 */ }

  // 快照所有 AI 楼层 + chat[0]（legacy v1 清除触及所有 AI 楼层；表头清单在 chat[0]）
  const snapshots = new Map<number, any>();
  for (let i = 0; i < chat.length; i++) {
    const m = chat[i];
    if (!m || typeof m !== 'object') continue;
    if (i === 0 || !(m as any).is_user) snapshots.set(i, snapshotMessage(m));
  }

  const createdAt = options.createdAt ?? Date.now();
  const reason = options.reason ?? 'import';
  try {
    for (const plan of plans) {
      // 0. 重建前收集填表前沿：重建会清空旧 frame 的追踪标记，不收集则修复后所有表前沿归零，
      //    插件自动填表会把旧楼层全部视为未处理（从第 1 楼全量重填）。
      const sheetKeys = Object.keys(data || {}).filter((k) => k.startsWith('sheet_'));
      const scheduleSummary = collectFillFrontierFromChat(chat, plan.isolationKey, plan.targetMessageIndex, sheetKeys);
      // 1. 重建：最新 AI 楼层写入 canonical full checkpoint（保留其向量索引——importTableAsJson 已刷新）
      const targetMsg = chat[plan.targetMessageIndex];
      if (targetMsg && typeof targetMsg === 'object') {
        const isolatedData = (targetMsg as any).TavernDB_ACU_IsolatedData;
        if (isolatedData && typeof isolatedData === 'object' && !Array.isArray(isolatedData)) {
          const existing = isolatedData[plan.isolationKey] || {};
          isolatedData[plan.isolationKey] = {
            ...existing,
            _acu_storage_version: 2,
            storageFrame: buildRebuiltStorageFrame(data, { createdAt, reason, scheduleSummary }),
          };
        }
      }
      // 2. 清空目标楼层之前所有含该键 V2 frame 的楼层：删除该隔离槽位 + 向量索引字段（+ 删外置文件）。
      //    不残留 {version:2, logEntries:[]} 的空 V2 frame——插件数据清理的边界 checkpoint 会把
      //    「边界前存在 V2 槽位但无法恢复」判为失败并中止清理（无法在 boundaryAnchorIndex 前恢复 V2 数据）。
      //    直接删除槽位后，边界前不再被识别为有 V2 数据，清理可正常进行；完整数据已由最新楼层的 full checkpoint 承载。
      for (const index of plan.clearIndices) {
        const msg = chat[index];
        if (!msg || typeof msg !== 'object') continue;
        const tagData = (msg as any).TavernDB_ACU_IsolatedData?.[plan.isolationKey];
        if (!isV2TagData(tagData)) continue;
        const paths = clearVectorIndexFields(tagData);
        const container = (msg as any).TavernDB_ACU_IsolatedData;
        if (container && typeof container === 'object' && !Array.isArray(container)) {
          delete container[plan.isolationKey];
          if (typeof container === 'object' && Object.keys(container).length === 0) {
            delete (msg as any).TavernDB_ACU_IsolatedData;
          }
        }
        if (paths.length > 0 && typeof options.deleteExternalFile === 'function') {
          for (const p of paths) {
            try { await options.deleteExternalFile(p); summary.vectorFilesDeleted++; }
            catch (e) { console.warn('[数据库模板修复] 删向量索引外置文件失败：', p, e); }
          }
        }
      }
    }
    // 3. 清除所有 AI 楼层 legacy v1 字段（对齐 deleteLocalDataInChatCoreInner_ACU）
    for (const msg of chat) {
      if (!msg || typeof msg !== 'object' || (msg as any).is_user) continue;
      let cleared = false;
      for (const f of LEGACY_V1_FIELDS) {
        if (f in (msg as any)) { delete (msg as any)[f]; cleared = true; }
      }
      if (cleared) summary.legacyCleared++;
    }
    // 4. 清除 chat[0] 旧版表头清单（全范围语义，对齐 clearLegacyTableHeaderGuide_ACU mode='all'）
    const first = chat[0];
    if (first && typeof first === 'object' && LEGACY_TABLE_HEADER_GUIDE_FIELD in (first as any)) {
      delete (first as any)[LEGACY_TABLE_HEADER_GUIDE_FIELD];
      summary.headerGuideCleared = true;
    }
    await saveChat();
    const firstTarget = plans[0];
    return {
      rebuilt: true,
      targetMessageIndex: firstTarget ? firstTarget.targetMessageIndex : -1,
      clearedCount: totalCleared,
      legacyCleared: summary.legacyCleared,
      vectorFilesDeleted: summary.vectorFilesDeleted,
      headerGuideCleared: summary.headerGuideCleared,
    };
  } catch (error) {
    for (const [index, snapshot] of snapshots) restoreMessageSnapshot(chat[index], snapshot);
    throw error;
  }
}
