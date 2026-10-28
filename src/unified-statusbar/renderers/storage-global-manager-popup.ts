// renderers/storage-global-manager-popup.ts
// 全局聊天外部存储管理弹窗：复用 #panelOverlay。视觉沿用 ub-* token，五主题深色适配。
// 列表项：角色卡/群组名 · 保留层数 · 累计楼层 · 上次更新 · storageId 末段 · 当前聊天标记 · 引用聊天数。
// 操作：恢复到此聊天（头像优先+同名兜底；全量快照折叠进当前 baseline）/ 删除（删域文件+备份+清引用聊天标记+清索引）。

import { ubIcon } from '../core/icons';
import { UB_EVENT, emitUbEvent } from '../core/events';
import { escapeHtml as esc } from '../core/html-escape';
import { getToastr } from '../core/env';
import { serverFileStore } from '../core/server-file-store';
import { syncDarkClass, closePanelOverlay, markPopupShown, guardGhostClick } from './html-builder';
import { showConfirmDialog } from './confirm-dialog';
import {
  type ExternalStorageInfo,
  type CharacterRef,
  type ListExternalStoragesDeps,
  listExternalStorages,
  deleteExternalStorage,
  restoreExternalStorageIntoCurrentChat,
  matchCharacterOwner,
} from '../core/storage-global-manager';
import { getCurrentStoryStorageId } from '../core/story-floor-store';

function toastr(): any { return getToastr(); }

function sillyContext(): any {
  try {
    const w = window as any;
    return (w.SillyTavern || w.parent?.SillyTavern)?.getContext?.() || null;
  } catch (_e) { return null; }
}

function nonEmpty(v: unknown): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).trim();
  return s ? s : null;
}

/** 当前聊天的 storageId / owner / 角色名（用于 isCurrent 判定与重关联前置校验）。 */
function currentChatInfo(): { storageId: string | null; ownerKind: 'character' | 'group' | null; avatar: string | null; name: string | null } {
  const ctx = sillyContext();
  const storageId = getCurrentStoryStorageId() || null;
  if (!ctx) return { storageId, ownerKind: null, avatar: null, name: null };
  const groupId = nonEmpty(ctx.groupId);
  if (groupId) return { storageId, ownerKind: 'group', avatar: null, name: null };
  const cid = ctx.characterId;
  if (cid === undefined || cid === null || cid === '') return { storageId, ownerKind: null, avatar: null, name: null };
  const chars = Array.isArray(ctx.characters) ? ctx.characters : [];
  const ch = chars[Number(cid)];
  return {
    storageId,
    ownerKind: 'character',
    avatar: nonEmpty(ch?.avatar),
    name: nonEmpty(ch?.name),
  };
}

async function fetchCharacters(): Promise<CharacterRef[]> {
  // /api/characters/all 载荷大（含头像 base64），短 TTL 记忆：两相渲染第二次调用与恢复校验复用同一份
  const now = Date.now();
  if (_charactersCache && now - _charactersCacheAt < CHARACTERS_CACHE_MS) return _charactersCache;
  const ctx = sillyContext();
  const headers: Record<string, string> = typeof ctx?.getRequestHeaders === 'function'
    ? ctx.getRequestHeaders() : { 'Content-Type': 'application/json' };
  try {
    const response = await fetch('/api/characters/all', { method: 'POST', headers, credentials: 'same-origin' });
    if (!response.ok) return [];
    const list = await response.json();
    if (!Array.isArray(list)) return [];
    const out: CharacterRef[] = [];
    for (const c of list) {
      if (!c || typeof c !== 'object') continue;
      const avatar = nonEmpty((c as any).avatar);
      const name = nonEmpty((c as any).name);
      if (avatar && name) out.push({ avatar, name });
    }
    _charactersCache = out;
    _charactersCacheAt = now;
    return out;
  } catch (_e) { return []; }
}

let _charactersCache: CharacterRef[] | null = null;
let _charactersCacheAt = 0;
const CHARACTERS_CACHE_MS = 10_000;

// 与 createStorageV3SillyHost 相同的 listChats / saveChatWithoutMeta（删除时清引用聊天标记）。
async function listChats() {
  const { createStorageV3SillyHost } = await import('../core/storage-v3-silly-host');
  return createStorageV3SillyHost().listChats();
}
// 复用 hard-reset 已测试的 saveChatWithoutMeta（聊天已删 unifiedStatusbar 后写回并读回确认）。
async function saveChatWithoutMeta(record: any) {
  const { createStorageHardResetDeps } = await import('../core/storage-hard-reset');
  return createStorageHardResetDeps().saveChatWithoutMeta(record);
}

function fmtTime(updatedAt: number | null): string {
  if (updatedAt == null || !Number.isFinite(updatedAt)) return '—';
  return new Date(updatedAt).toLocaleString();
}

function renderRows(storages: ExternalStorageInfo[]): string {
  if (!storages.length) {
    return '<div class="ub-gm-empty">未发现任何外部存储。纯孤儿（聊天元数据完全丢失且索引建立前创建）无法经 API 列出，可用离线脚本兜底。</div>';
  }
  return storages.map(s => {
    const idTail = s.storageId.slice(-8);
    const refCount = s.referencedByChatId.length;
    const refLabel = refCount ? `· 引用 ${refCount} 聊天` : '· 无聊天引用（孤儿）';
    const currentBadge = s.isCurrent ? '<span class="ub-gm-badge current">当前</span>' : '';
    const restoreDisabled = s.isCurrent || !s.domainsCreated.length || !s.filesExist;
    const deleteDisabled = s.isCurrent;
    return `<div class="ub-gm-row${s.isCurrent ? ' is-current' : ''}" data-sid="${esc(s.storageId)}">
      <div class="ub-gm-row-main">
        <span class="ub-gm-name">${s.isGroup ? ubIcon('folder') : ubIcon('book')}${esc(s.characterName)}${currentBadge}</span>
        <span class="ub-gm-meta"><span class="gm-chip">保留 <b class="num">${s.retainedLayers}</b> 层</span><span class="gm-chip">累计 <b class="num">${s.cumulativeLayers}</b> 楼</span><span class="gm-chip dim">${refLabel}</span></span>
        <span class="ub-gm-meta"><span class="gm-chip dim">更新 ${esc(fmtTime(s.updatedAt))}</span>${s.domainsCreated.length ? `<span class="gm-chip dim">${esc(s.domainsCreated.join('/'))}</span>` : ''}<span class="gm-chip dim">id …${esc(idTail)}</span></span>
      </div>
      <div class="ub-gm-row-actions">
        <button class="ub-gm-btn restore"${restoreDisabled ? ' disabled' : ''} data-act="restore">恢复到此聊天</button>
        <button class="ub-gm-btn delete danger"${deleteDisabled ? ' disabled' : ''} data-act="delete">删除</button>
      </div>
    </div>`;
  }).join('');
}

function shellHtml(rowsOrLoading: string, loading: boolean): string {
  const head = loading ? '全局聊天外部存储管理 · 加载中…' : '全局聊天外部存储管理';
  return `<div class="panel-popup ub-gm-popup" id="ubGmOverlay">
    <style scoped>
      #ubGmOverlay{max-width:620px;margin:8px auto;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:10px;overflow:hidden;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));max-height:88vh;max-height:88dvh;display:flex;flex-direction:column}
      #ubGmOverlay .ub-gm-head{display:flex;align-items:center;gap:6px;padding:10px 12px;background:var(--text,var(--sweet-text,#111));color:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)))}
      #ubGmOverlay .ub-gm-title{font-size:14px;font-weight:600;flex:1}
      #ubGmOverlay .ub-gm-head .settings-popup-close{color:inherit;background:transparent;border:none;font-size:18px;cursor:pointer}
      #ubGmOverlay .ub-gm-intro{font-size:11px;line-height:1.6;color:var(--text-muted,var(--sweet-text-muted,#999));padding:8px 12px 4px}
      #ubGmOverlay .ub-gm-tools{display:flex;gap:8px;padding:4px 12px 8px}
      #ubGmOverlay .ub-gm-refresh{font-size:11px;padding:5px 12px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:6px;cursor:pointer;background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111))}
      #ubGmOverlay .ub-gm-body{padding:0 12px 10px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:6px}
      #ubGmOverlay .ub-gm-empty{font-size:11px;color:var(--text-muted,var(--sweet-text-muted,#999));padding:12px 4px;line-height:1.6}
      #ubGmOverlay .ub-gm-row{border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:8px}
      #ubGmOverlay .ub-gm-row.is-current{border-color:var(--accent,#2e7d32)}
      #ubGmOverlay .ub-gm-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
      #ubGmOverlay .ub-gm-name{font-size:12px;font-weight:600;color:var(--text,var(--sweet-text,#111));display:flex;align-items:center;gap:4px}
      #ubGmOverlay .ub-gm-meta{font-size:10px;color:var(--text-muted,var(--sweet-text-muted,#999));display:flex;flex-wrap:wrap;gap:4px}
      #ubGmOverlay .gm-chip{padding:0 6px;border-radius:4px;font-size:10px;background:var(--bg-alt,rgba(128,128,128,.08));border:1px solid var(--divider-light,var(--divider,#e0e0e0));color:var(--text-sub,var(--text,var(--sweet-text,#111)))}
      #ubGmOverlay .gm-chip.dim{color:var(--text-muted,var(--sweet-text-muted,#999))}
      #ubGmOverlay .gm-chip b.num{color:var(--accent,var(--sweet-pink,#c26a8a));font-variant-numeric:tabular-nums}
      #ubGmOverlay .ub-gm-badge{font-size:9px;padding:1px 6px;border-radius:8px;font-weight:600}
      #ubGmOverlay .ub-gm-badge.current{background:var(--accent,#2e7d32);color:#fff}
      #ubGmOverlay .ub-gm-row-actions{display:flex;flex-direction:column;gap:4px;flex:none}
      #ubGmOverlay .ub-gm-btn{font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));white-space:nowrap}
      #ubGmOverlay .ub-gm-btn:disabled{opacity:.45;cursor:default}
      #ubGmOverlay .ub-gm-btn.danger{color:#e53935;border-color:#e53935}
      #ubGmOverlay .ub-gm-btn.danger:not(:disabled){background:#e53935;color:#fff}
      #ubGmOverlay.dark .ub-gm-name{color:var(--text,#eee)}
      #ubGmOverlay.dark .ub-gm-btn{background:var(--card,#222);color:var(--text,#eee)}
    </style>
    <div class="ub-gm-head"><span class="ub-gm-title">${esc(head)}</span><button class="settings-popup-close" id="ubGmClose">×</button></div>
    <div class="ub-gm-intro">浏览所有聊天的外部存储（剧情/地图/立绘）。「恢复到此聊天」把目标全量状态折叠进当前聊天底账，绕开锚点不一致；前置头像相同或同名角色卡。「删除」清域文件、备份与引用聊天标记。纯孤儿（聊天元数据全丢且索引建立前创建）无法经 API 列出。</div>
    <div class="ub-gm-tools"><button class="ub-gm-refresh" id="ubGmRefresh">${ubIcon('refresh')} 刷新</button></div>
    <div class="ub-gm-body" id="ubGmBody">${rowsOrLoading}</div>
  </div>`;
}

export async function showStorageGlobalManagerPopup(): Promise<void> {
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  // 本弹窗临时把常驻 #panelOverlay 的 z-index 提到 10003（盖过普通面板）；
  // 关闭必须走 closeGmOverlay 还原内联值，否则之后所有弹窗 z-index 永久变 10003
  // （同 db-template-repair-popup 的 closeDbRepairOverlay 教训）。
  const closeGmOverlay = (): void => { overlay.style.zIndex = ''; closePanelOverlay(overlay); };
  overlay.innerHTML = shellHtml('<div class="ub-gm-empty">正在枚举所有聊天与外部存储…</div>', true);
  syncDarkClass(overlay); markPopupShown(); overlay.style.zIndex = '10003'; overlay.classList.add('show');

  let storages: ExternalStorageInfo[] = [];

  function renderList(): void {
    const body = document.getElementById('ubGmBody');
    if (body) body.innerHTML = renderRows(storages);
  }

  /** 乐观移除一行（删除/恢复后删除源时用），避免全量重新枚举的漫长等待。 */
  function removeSid(sid: string): void {
    storages = storages.filter(s => s.storageId !== sid);
    renderList();
  }

  // const 箭头（非提升函数声明）：才能吃到上方 !overlay 守卫的空值收窄
  const refresh = async (): Promise<void> => {
    const body = document.getElementById('ubGmBody');
    const title = overlay.querySelector<HTMLElement>('.ub-gm-title');
    if (body) body.innerHTML = '<div class="ub-gm-empty">正在枚举所有聊天与外部存储…</div>';
    const current = currentChatInfo();
    const baseDeps: Omit<ListExternalStoragesDeps, 'listChats'> = {
      files: serverFileStore,
      getCharacters: fetchCharacters,
      currentChat: () => ({
        storageId: current.storageId,
        owner: current.ownerKind === 'character' && current.avatar
          ? { kind: 'character' as const, avatar: current.avatar, chatId: '' }
          : current.ownerKind === 'group' ? { kind: 'group' as const, chatId: '' } : null,
        characterName: current.name,
      }),
    };
    // 快相：索引 + 批量 verify + 并发信封读取（秒级），先上屏可看可操作
    try {
      const fast = await listExternalStorages(baseDeps);
      storages = fast.storages;
      renderList();
    } catch (error) {
      if (body) body.innerHTML = `<div class="ub-gm-empty">枚举失败：${esc(error instanceof Error ? error.message : String(error))}</div>`;
      if (title) title.textContent = '全局聊天外部存储管理';
      return;
    }
    // 慢相：枚举全部聊天（并发池化）补「引用 N 聊天」与索引外发现；失败保留快相结果
    if (title) title.textContent = '全局聊天外部存储管理 · 正在核对聊天引用…';
    try {
      const records = await listChats();
      const full = await listExternalStorages({ ...baseDeps, listChats: async () => records });
      storages = full.storages;
      renderList();
    } catch (_e) { /* 快相结果仍完整可用，仅引用计数缺失 */ }
    if (title) title.textContent = '全局聊天外部存储管理';
  };

  await refresh();

  overlay.querySelector('#ubGmClose')?.addEventListener('click', () => closeGmOverlay());
  overlay.querySelector('#ubGmRefresh')?.addEventListener('click', () => { void refresh(); });

  overlay.querySelector('#ubGmBody')?.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const btn = target.closest<HTMLButtonElement>('button[data-act]');
    if (!btn) return;
    if (guardGhostClick()) return;
    const row = btn.closest<HTMLElement>('.ub-gm-row');
    const sid = row?.dataset.sid;
    if (!sid) return;
    const info = storages.find(s => s.storageId === sid);
    if (!info) return;
    const act = btn.dataset.act;
    if (act === 'delete') { void handleDelete(info, removeSid, refresh); }
    else if (act === 'restore') { void handleRestore(info, removeSid); }
  });
}

async function handleDelete(
  info: ExternalStorageInfo,
  onRemoved: (sid: string) => void,
  onFullRefresh: () => Promise<void>,
): Promise<void> {
  if (info.isCurrent) { toastr()?.error('不能删除当前聊天的存储', '外部存储'); return; }
  const name = info.characterName || (info.isGroup ? '群组' : '未知');
  if (!await showConfirmDialog({
    message: `确定删除「${name}」的外部存储（id …${info.storageId.slice(-8)}）？\n\n将删除其剧情、地图、立绘文件与备份快照，并清除仍引用它的聊天的状态栏标记。此操作不可恢复。\n\n若该存储仍被某个聊天使用，那个聊天的状态栏数据将清空（建议先用「恢复到此聊天」迁移到当前聊天再删源）。`,
    danger: true,
    okText: '确认删除',
  })) return;
  try {
    const current = currentChatInfo();
    const report = await deleteExternalStorage(info.storageId, {
      files: serverFileStore,
      listChats,
      saveChatWithoutMeta,
      currentStorageId: current.storageId,
    });
    const t = toastr();
    if (report.ok) {
      t?.success(`已删除 ${report.filesDeleted} 个文件${report.chatsStripped ? `、清除 ${report.chatsStripped} 个聊天标记` : ''}`, '外部存储');
      onRemoved(info.storageId); // 乐观移除：避免删除后全量重新枚举的漫长等待，可连续删除
      return;
    }
    t?.warning(`删除部分失败：删文件 ${report.filesDeleted}/${report.filesDeleted + report.filesFailed}、清标记 ${report.chatsStripped}/${report.chatsStripped + report.chatsFailed}`, '外部存储');
  } catch (error) {
    toastr()?.error(`删除失败：${error instanceof Error ? error.message : String(error)}`, '外部存储');
  }
  // 失败/部分失败时才全量刷新对账
  await onFullRefresh();
}

async function handleRestore(info: ExternalStorageInfo, onRemoved: (sid: string) => void): Promise<void> {
  if (info.isCurrent) { toastr()?.error('当前聊天的存储无需恢复', '外部存储'); return; }
  if (!info.filesExist || !info.domainsCreated.length) { toastr()?.error('目标存储无可用文件', '外部存储'); return; }

  const current = currentChatInfo();
  const characters = await fetchCharacters();
  const targetOwner = info.owner;
  if (!targetOwner) { toastr()?.error('无法读取目标存储的归属，拒绝恢复', '外部存储'); return; }
  const match = matchCharacterOwner(
    current.ownerKind === 'character'
      ? { kind: 'character', avatar: current.avatar || '', name: current.name || '' }
      : current.ownerKind === 'group' ? { kind: 'group' } : null,
    targetOwner,
    characters,
  );
  if (!match.ok) { toastr()?.error(match.reason, '外部存储'); return; }

  const name = info.characterName || (info.isGroup ? '群组' : '未知');
  const warnLine = match.warn ? `\n\n⚠️ ${match.warn}` : '';
  if (!await showConfirmDialog({
    message: `确定把「${name}」的外部存储恢复到当前聊天？\n\n会把目标的全量状态（底账+全部楼层）折叠成快照写入当前聊天的底账，覆盖当前聊天存储数据，不可撤销。建议先备份当前聊天。${warnLine}`,
    danger: true,
    okText: '确认恢复',
  })) return;

  try {
    const { flushStatusbarStorage } = await import('../core/storage-bootstrap');
    await flushStatusbarStorage();
    const { getStoryBundle } = await import('../core/story-floor-store');
    const result = await restoreExternalStorageIntoCurrentChat(info.storageId, {
      files: serverFileStore,
      getBundle: () => getStoryBundle() as any,
      now: () => Date.now(),
    });
    const t = toastr();
    if (result.ok) {
      t?.success(`已恢复 ${result.restoredDomains.join('/')} 到当前聊天`, '外部存储');
      emitUbEvent(UB_EVENT.storyStateInvalidated);
      try { (window as any).__ubTriggerRender?.(); } catch (_e) { /* ignore */ }
      if (await showConfirmDialog({ message: '恢复成功。是否删除源存储（已不再需要）？', okText: '删除源', cancelText: '保留' })) {
        await deleteExternalStorage(info.storageId, {
          files: serverFileStore, listChats, saveChatWithoutMeta, currentStorageId: current.storageId,
        });
        onRemoved(info.storageId); // 乐观移除源行，不触发全量重新枚举
      }
    } else {
      t?.error(result.error || '恢复失败', '外部存储');
    }
  } catch (error) {
    toastr()?.error(`恢复失败：${error instanceof Error ? error.message : String(error)}`, '外部存储');
  }
  // 不再全量刷新：恢复不改变列表结构（源存储若已删则上面乐观移除），可继续操作其他行
}