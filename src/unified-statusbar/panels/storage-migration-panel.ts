import type { StatusbarStorageStatus } from '../core/storage-bootstrap';
import { getConfig } from '../core/config-store';
import type { BackupMeta } from '../core/story-backup-store';
import type { StoryFloorDiagnostics } from '../core/story-floor-diagnostics';
// U2：转义统一出口（本面板原局部实现为 5 实体集=escapeHtmlAttr，别名保留调用点不变）
import { escapeHtmlAttr as escapeHtml } from '../core/html-escape';

export interface StorageHardResetUiState {
  phase?: 'idle' | 'running' | 'done' | 'error';
  message?: string;
  error?: string;
  reportSummary?: string;
}

function storageStateLabel(state: string | undefined): string {
  const labels: Record<string, string> = {
    ready: '正常',
    uninitialized: '等待首次写入',
    'read-only': '只读保护',
    conflict: '检测到冲突',
    error: '错误',
  };
  return labels[state || ''] || state || '未知';
}

export function renderStorageMigrationPanel(
  status: StatusbarStorageStatus,
  backupState?: { backups: BackupMeta[]; ready: boolean },
  inCharacterCard?: boolean,
  floorDiag?: StoryFloorDiagnostics,
  hardResetUi?: StorageHardResetUiState,
  thoroughResetUi?: StorageHardResetUiState,
): string {
  const story = status.story;
  const global = status.global;
  const button = (id: string, text: string, disabled = false, danger = false) =>
    `<button id="${id}" class="settings-action-btn ub-storage-action${danger ? ' danger' : ''}"${disabled ? ' disabled' : ''}>${text}</button>`;

  let html = '<div class="group-title">存储</div>';
  html += '<div class="ub-storage-intro">';
  html += '状态栏数据保存到酒馆服务器的用户文件中，电脑与手机读取同一份数据。';
  html += '剧情与地图按聊天分域增量保存；立绘独立持久，偏好、成就簿、仓库与衣柜目录属于全局数据。';
  html += 'API 密钥不写入外部文件，独立保留在酒馆 secrets 中。';
  html += '</div>';

  html += '<div class="settings-section ub-storage-section">';
  html += `<div class="settings-label">当前聊天：外部存储 · ${storageStateLabel(story.external?.state)}</div>`;
  if (floorDiag) {
    const cur = floorDiag.currentFloor === null ? '—' : `第 ${floorDiag.currentFloor} 层`;
    // 底账非空时 null ≠ 无数据：删除当前楼层回退到的是底账快照（更早楼层的写入已折叠保存），
    // 显示「底账（已折叠）」而非「—」，避免误读为存储异常。
    const last = floorDiag.lastSavedFloor === null
      ? (floorDiag.hasFoldedBaseline ? '底账（已折叠）' : '—')
      : `第 ${floorDiag.lastSavedFloor} 层`;
    // 与 html-builder 的 helpTipButton 同款标记（面板不 import html-builder——其模块加载依赖 document，node 测试环境不可用）
    const tip = getConfig().showHelpTips
      ? '<span class="help-tip-btn" data-tooltip="' + escapeHtml('当前楼层：当前聊天中 AI 消息的层数（与备份列表「第N层」同口径）。\\n压缩阈值：存储保留最近 N 层的增量记录，更早的数据合并进底账（baseline），删楼层不会回退到底账之前。\\n上一个保存数据：删除当前楼层后，数据回退到这一层为止。\\n「底账（已折叠）」= 更早楼层的写入已合并进底账保存，不会因删除当前楼层全部丢失；逐层回退点以现存条目为准。') + '" tabindex="0" onmouseover="window.__ubShowHelpTip(this)" onmouseout="window.__ubHideHelpTip()" onfocus="window.__ubShowHelpTip(this)" onblur="window.__ubHideHelpTip()">?</span>'
      : '';
    html += `<div class="settings-label" style="font-size:11px;color:var(--text-muted,var(--sweet-text-muted,#999));">当前楼层：${cur} · 压缩阈值：保留最近 ${floorDiag.retainedLayers} 层 · 上一个保存数据：${last}${tip}</div>`;
  }
  html += '</div>';

  // 数据文件损坏/无法读取（只读保护、冲突、错误）且聊天身份可重置时，提供手动重置出口，
  // 避免「存档同步中」永久挂起且无自救手段。全局数据与备份快照不受重置影响。
  const storyState = story.external?.state;
  const resetable = status.identity.kind === 'ready'
    || (status.identity.kind === 'read-only' && !!status.identity.storageId);
  if ((storyState === 'read-only' || storyState === 'error' || storyState === 'conflict') && resetable) {
    html += '<div class="settings-section ub-storage-section">';
    html += '<div class="ub-storage-intro">当前聊天的存储文件无法读取，处于只读保护。可以重置本聊天存储：删除剧情/地图/立绘文件并从空档重新开始。备份快照不受影响，仍可恢复。</div>';
    html += '<div class="ub-storage-actions">';
    html += button('ubStorageResetStory', '重置聊天存储', false, true);
    html += '</div>';
    html += '</div>';
  }

  html += '<div class="settings-section ub-storage-section">';
  html += `<div class="settings-label">全局偏好与成就簿：外部存储 · 偏好 ${storageStateLabel(global.preferences?.state)} · 成就 ${storageStateLabel(global.achievements?.state)}</div>`;
  html += `<div class="settings-label">全局仓库与衣柜目录：外部存储 · 仓库 ${storageStateLabel(global.warehouse?.state)} · 衣柜目录 ${storageStateLabel(global.wardrobeCatalog?.state)}</div>`;
  html += '</div>';

  // 全局聊天外部存储管理：浏览/删除/恢复到当前聊天所有现存外部存储（剧情/地图/立绘）。
  // 用于酒馆数据丢失后从备份捞回聊天、却无法关联上之前外部存储的场景。
  html += '<div class="settings-section ub-storage-section">';
  html += '<div class="ub-storage-intro">浏览所有聊天的外部存储（来自哪个角色卡、保留多少层、上次更新时间），可删除，或把某份外部存储的全量状态恢复到当前聊天（前置头像相同或同名角色卡）。酒馆数据丢失后从备份捞回聊天却关联不上旧外部存储时，可在此手动恢复。</div>';
  html += '<div class="ub-storage-actions">';
  html += button('ubStorageGlobalManage', '全局聊天外部存储管理');
  html += '</div>';
  html += '</div>';

  // ===== 备份管理区块 =====
  const backups = backupState?.backups || [];
  const backupReady = !!backupState?.ready;
  const interval = getConfig().storyBackupInterval;
  html += '<div class="group-title">备份快照</div>';
  html += '<div class="ub-storage-intro">每 N 层 AI 回复自动保存当前聊天的剧情与地图状态；自动与手动备份合计只保留最近 10 份。恢复不会改动立绘、全局衣柜、仓库、偏好或成就。</div>';
  html += '<div class="settings-section ub-storage-section">';
  html += '<div class="ub-storage-actions">';
  html += '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted,var(--sweet-text-muted,#999));">每 <input id="ubBackupIntervalInput" type="number" min="1" max="999" value="' + interval + '" style="width:52px;padding:3px 4px;font-size:11px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:3px;text-align:center;"> 层 AI 回复自动备份</label>';
  html += button('ubBackupNowBtn', '立即备份', !backupReady);
  html += '</div>';
  html += '<div id="ubBackupList" style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">';
  if (!backups.length) {
    html += '<div style="font-size:11px;color:var(--text-muted,var(--sweet-text-muted,#999));padding:4px 0;">暂无备份</div>';
  } else {
    for (const b of backups) {
      const when = new Date(b.createdAt).toLocaleString();
      const reason = b.reason === 'auto' ? '自动' : '手动';
      const size = b.bytes >= 1024 ? `${(b.bytes / 1024).toFixed(1)}KB` : `${b.bytes}B`;
      html += `<div class="ub-backup-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));border-radius:6px;font-size:11px;color:var(--text,var(--sweet-text,#111));">`;
      html += `<span>${when} · ${reason} · 第${b.aiTurns}层 · ${size}</span>`;
      html += `<span style="display:flex;gap:6px;">`;
      html += `<button id="ubBackupRestore-${b.file}" class="settings-action-btn ub-storage-action">恢复</button>`;
      html += `<button id="ubBackupDelete-${b.file}" class="settings-action-btn ub-storage-action danger">删除</button>`;
      html += `</span></div>`;
    }
  }
  html += '</div></div>';

  // ===== 一键搬家区块 =====
  const moveLayers = getConfig().moveLayers;
  const moveAutoOpen = getConfig().moveChatAutoOpen;
  html += '<div class="group-title">一键搬家</div>';
  html += '<div class="ub-storage-intro">把当前聊天最后 N 层 AI 楼层复制成一个新聊天文件，新聊天带全新外部存储并压缩到切割点（数据库固化为一个完整快照 + 外部存储底账折叠到切割层）。原聊天与原外部存储完全不动。勾选下方「搬家后直接进入新聊天」可在完成后自动切换到新聊天，否则请到该角色的聊天列表里打开新聊天。</div>';
  html += '<div class="settings-section ub-storage-section">';
  html += '<div class="ub-storage-actions">';
  html += '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted,var(--sweet-text-muted,#999));">保留最后 <input id="ubMoveLayersInput" type="number" min="1" max="999" value="' + moveLayers + '" style="width:52px;padding:3px 4px;font-size:11px;font-family:inherit;border:1px solid var(--divider,var(--sweet-border,#e0e0e0));background:var(--card,var(--sweet-card,var(--jade-surface-1,#fff)));color:var(--text,var(--sweet-text,#111));border-radius:3px;text-align:center;"> 层 AI 楼层</label>';
  html += button('ubMoveChatBtn', '一键搬家');
  html += '</div>';
  html += '<div class="ub-storage-actions" style="margin-top:6px;">';
  html += '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text,var(--sweet-text,#111));cursor:pointer;"><input id="ubMoveAutoOpenInput" type="checkbox"' + (moveAutoOpen ? ' checked' : '') + ' style="margin:0;cursor:pointer;"> 搬家后直接进入新聊天</label>';
  html += '</div>';
  html += '</div>';

  // ===== 当前聊天彻底重置（只清当前聊天，保全局）=====
  // 介于「重置聊天存储」（只删三域文件，保留备份，仅损坏时出现）与「彻底重置外部存储」
  // （清所有聊天 + 全局）之间的中间档：删当前聊天的三域文件 + 本聊天全部备份快照，
  // 清域标记后重新初始化。全局偏好/成就/仓库/衣柜目录/正文图库与其他聊天完全不动。
  const trPhase = thoroughResetUi?.phase || 'idle';
  const trReady = status.identity.kind === 'ready'
    || (status.identity.kind === 'read-only' && !!status.identity.storageId);
  html += '<div class="group-title">当前聊天重置</div>';
  html += '<div class="settings-section ub-storage-section">';
  if (trPhase === 'running') {
    html += `<div class="ub-storage-footnote">正在重置当前聊天… ${escapeHtml(thoroughResetUi?.message || '')}。请不要切换页面。</div>`;
  } else if (trPhase === 'done') {
    html += `<div class="ub-storage-footnote" style="color:var(--good,#2a8);">✓ 当前聊天的状态栏数据已清空并重新初始化。</div>`;
  } else if (trPhase === 'error') {
    html += `<div class="ub-storage-footnote" style="color:var(--danger,#c44);">重置遇到问题：${escapeHtml(thoroughResetUi?.error || '未知错误')}</div>`;
  } else {
    html += '<div class="ub-storage-intro">只重置当前聊天的状态栏数据：删除本聊天的剧情、地图、立绘存储文件，并清除本聊天的全部备份快照，然后从空档重新开始。全局偏好、成就簿、仓库、衣柜目录、正文图库，以及其他聊天的数据都不受影响。不可恢复。</div>';
    if (!trReady) {
      html += '<div class="ub-storage-footnote" style="color:var(--text-muted,var(--sweet-text-muted,#999));">当前没有可重置的聊天存储（请先打开一个角色卡聊天）。</div>';
    }
    html += '<div class="ub-storage-actions">';
    html += button('ubStorageResetStoryThorough', '重置当前聊天（含备份）', !trReady, true);
    html += '</div>';
  }
  html += '</div>';

  // ===== 存储彻底重置（兜底自救）=====
  const hrPhase = hardResetUi?.phase || 'idle';
  html += '<div class="group-title">存储重置</div>';
  html += '<div class="settings-section ub-storage-section">';
  if (hrPhase === 'running') {
    html += `<div class="ub-storage-footnote">正在重置… ${escapeHtml(hardResetUi?.message || '')}。请不要关闭或切换页面。</div>`;
  } else if (hrPhase === 'done') {
    html += `<div class="ub-storage-footnote" style="color:var(--good,#2a8);">✓ ${escapeHtml(hardResetUi?.reportSummary || '重置完成')}。请现在刷新酒馆（按 F5）重新开始。</div>`;
  } else if (hrPhase === 'error') {
    html += `<div class="ub-storage-footnote" style="color:var(--danger,#c44);">重置遇到问题：${escapeHtml(hardResetUi?.error || '未知错误')}</div>`;
  } else {
    const blocked = inCharacterCard;
    html += '<div class="ub-storage-intro">出现无法自愈的存储问题时使用的兜底措施：清除所有聊天中的状态栏标记，并删除全部已存在的外部存储文件（剧情、地图、立绘、备份、偏好、成就簿、仓库、衣柜目录），之后全新开始。不影响酒馆聊天记录本身与 API 密钥。此操作不可恢复。</div>';
    if (blocked) {
      html += '<div class="ub-storage-footnote" style="color:var(--danger,#c44);">检测到您正在角色卡中。请先回到酒馆欢迎页（关掉当前角色卡并刷新），再回来执行——否则当前聊天的内存副本会把标记写回，导致清理不生效。</div>';
    }
    html += '<div class="ub-storage-actions">';
    html += button('ubStorageHardReset', '彻底重置外部存储', blocked, true);
    html += '</div>';
  }
  html += '</div>';

  html += '<div class="ub-storage-footnote">API 密钥不会写入外部文件，恢复备份也不会丢失本机 secrets。</div>';
  return html;
}
