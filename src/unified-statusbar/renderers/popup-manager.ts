// ===== 弹窗管理模块 =====
import { ubIcon } from '../core/icons';
import { getToastr } from '../core/env';
import {
  getSheetByName, getCellByHeader, findRowByColumn,
  getInitials, appendMessageToChat,
  deleteRow, updateRow, invalidateCache, isSqliteMode,
  getAutoCardAPI, runDbBatch, type DbWriteOp,
  deleteContentRowSqlFirstDetailed, insertContentRowSqlFirst, isSqlPilotTableName,
  getTableLockState, setRowLock, setCellLock, type TableLockState,
  isNsfwPlayActive,
} from '../core/data-manager';
import { readSerseEnergy, serseIncrementOp } from '../core/energy-payment';
import { type StyleType } from '../core/constants';
import { syncDarkClass, syncDarkClassMinimal, helpTipButton, closePanelOverlay, guardGhostClick, markPopupShown, bridgeWindowClass, readCharPastExp } from './html-builder';
import { setButtonBusy } from '../core/busy-state';
import { showConfirmDialog, showPromptDialog } from './confirm-dialog';
import { getConfig, setConfig } from '../core/config-store';
// [LEGACY-MERGE · DB-ONLY] 状态栏合并/一键修复仅真数据库模式可用。
// 瑟瑟台账接管时入口隐藏，合并走台账工作台「纪要合并」标签；本组导入与下方入口在后续版本移除。
import { openChronicleMerge, openChronicleRepair, showChronicleMergeResumePrompt } from './chronicle-merge-popup';
import { abortCurrentMerge, isChronicleMergeActive } from '../core/chronicle-merge-engine';
import { getMergedCountForCells, getCurrentChatKeyOrNull } from '../core/chronicle-merge-markers';
import { isLedgerTakeover, ledgerSupportsSummaryMerge, openLedgerWorkbench } from '../core/ledger-takeover';
import {
  getInvestigationHistory, hasInvestigation, performInvestigation,
  deleteInvestigation, updateInvestigationContent, beautifyInvestigationContent, isInvestigating,
  type DossierEntry, type InvestigationContinueRef,
} from '../core/investigation';
import {
  INVESTIGATION_MODULE_DEFS, getPresentModules, buildDossierWorldbookContent,
  addDossierToWorldbook,
} from '../core/investigation-worldbook';
import {
  buildLocationInjection, deleteInterview, hasInterview, isInterviewing, loadInterview, performInterview,
  updateInterviewContent,
  type InterviewConfig, type InterviewContinueRef, type InterviewEntry,
} from '../core/interview';
import { parseInterview } from '../core/interview-parser';
import { collectAllCharacterNames } from '../core/character-hub-model';
import { listMapLibraryNodes } from '../core/map-system';
import { deriveNodeId, readMapNode, type MapLibNodeInfo } from '../core/map-tree-store';
import { getCurrentPortraitPath } from '../core/portrait-system';
import { renderThemedInterview } from './interview-themed';
import { exportArchive, type ArchiveExportFormat, type ArchiveKind } from '../core/archive-export';
import {
  getWarehouseGroups, getWarehouseItems,
  addToWarehouseChecked, addItemsToWarehouseChecked,
  removeFromWarehouse, deleteFromWarehouse,
  batchRemoveFromWarehouse, batchDeleteFromWarehouse,
  moveWarehouseItems, createWarehouseGroup, renameWarehouseGroup,
  deleteWarehouseGroup, mergeWarehouseGroups, validateWarehouseGroupName,
  findWarehouseCopyConflicts,
  type WarehouseGroup, type WarehouseItem, type WarehouseBatchRow, type WarehouseOverviewRecord,
} from '../core/warehouse';
import { deleteWarehouseOverviewImage, isWarehouseOverviewStale } from '../core/item-overview';
import { isSafeStoredImagePath } from '../core/image-storage';
import {
  warehouseLabels, buildWarehouseGroupBar, buildWarehouseImageCard, showWarehouseTargetDialog,
} from './warehouse-group-ui';
import { getPlayImageList } from '../core/play-images';
import { isNewItem, isNewMission, isNewMemo, clearNewHighlights } from './notification-badge';
import { buildPastExperienceHTML } from './past-experience-html';
import { classifyTableSafety, filterRows, buildHighlight, isRowIdColumn, sortRows, type SortDir, type DbSortState, isRowLocked, isCellLocked, hasAnyLock } from '../core/db-crud';
import {
  createCharacterMigrationSnapshot, getCharacterMigrationTarget, migrateCharacter,
  type CharacterMigrationSnapshot,
} from '../core/character-table-migration';
import { readCharAgeText } from '../core/birthday';
import { getTodayDateKey } from '../core/calendar-core';
import { addInventoryItemToWardrobe } from '../core/wardrobe-inventory';
import { mapInventoryTypeToWardrobeCategory } from '../core/wardrobe-types';
import { applyBatchDeleteToTable } from '../core/data-manager';
import { bindBatchSelect } from './batch-select-ui';
import { showMemoGoalsDialog } from './memo-goals-popup';
import { isPopupOpen, replacePopupBody, rememberPopupScroll, recallPopupScroll, captureScroll } from './dom-update';
import { escapeHtml, escapeHtmlAttr } from '../core/html-escape';
import { diaryPlainText, sanitizeDiaryHtml } from '../core/diary-sanitizer';
import { readExtraPromptCache, writeExtraPromptCache, EXTRA_PROMPT_CACHE_KEYS } from '../core/extra-prompt-cache';
import { NSFW_GUIDANCE_PRESETS } from '../core/nsfw-guidance-prompts';
import { showCharacterHubPopup } from './character-hub-popup';
import { showRawTextEditor } from './raw-text-editor';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 05 待修：同上（与 item-overview-panel 的双向入口）
import { showItemOverviewPopup } from './item-overview-panel';
import { ensureStyleOnce } from './style-once';

// ===== 新内容高亮 =====
/** 扫描容器中匹配的条目名，对命中行添加呼吸高亮。
 *  物品/备忘录：首次查看后清除标记（一次性提示）。
 *  任务：持续高亮直到已完成条目被删除（与基于状态的 newNames 一致，不清除）。 */
function applyNewHighlights(container: HTMLElement, type: 'item'|'mission'|'memo', style: StyleType): void {
  const checkFn = type === 'item' ? isNewItem : type === 'mission' ? isNewMission : isNewMemo;
  const sel = type === 'item' ? '.item-name' : type === 'mission' ? '.mission-name' : '.memo-title';
  const rowSel = type === 'item' ? '.item-list-item' : type === 'mission' ? '.mission-list-item' : '.memo-list-item';
  let hit = false;
  container.querySelectorAll(sel).forEach(function (el) {
    const name = (el.textContent || '').trim();
    if (name && checkFn(name)) {
      const row = el.closest(rowSel);
      if (row) { row.classList.add('ub-new-highlight', 'ub-hl-' + style); hit = true; }
    }
  });
  // 任务类型：持续高亮，不清除标记（与基于状态的 newNames 一致）
  if (hit && type !== 'mission') clearNewHighlights(type);
}

// 弹窗基础辅助（closePanelOverlay / guardGhostClick / markPopupShown / bridgeWindowClass）
// 已下沉到 html-builder.ts，此处复用导入。

// ===== 共享渲染辅助（消除 isMinimal 分支重复） =====

/** 详情行：minimal 用 info-row，其他用 detail-row */
function detailRow(label: string, value: string, isMinimal: boolean): string {
  const v = escapeHtml(value);
  return isMinimal
    ? '<div class="info-row"><span class="info-label">' + label + '</span><span class="info-value">' + v + '</span></div>'
    : '<div class="detail-row"><span class="dl">' + label + '</span><span class="dv">' + v + '</span></div>';
}

/** 详情内容区：minimal 用 dc-label/dc-text，其他用 dl/dc */
function detailContent(label: string, content: string, isMinimal: boolean): string {
  const c = escapeHtml(content);
  return isMinimal
    ? '<div class="detail-content"><span class="dc-label">' + label + '</span><p class="dc-text">' + c + '</p></div>'
    : '<div class="detail-content"><span class="dl">' + label + '</span><p class="dc">' + c + '</p></div>';
}

// ===== 备忘录弹窗 =====
export function showMemoPopup(style: StyleType): void {
  const overlay = document.getElementById('panelOverlay')!;
  const sheet = getSheetByName('备忘录');
  const count = sheet ? (sheet.content.length - 1) : 0;
  const isMinimal = style === 'minimal';
  const bodyHtml = buildMemoBodyHtml(style);

  // 已开着同一弹窗 → 只换数据容器（保留壳/头），滚动保持；旧 body 元素销毁使旧事件绑定自动失效
  if (isPopupOpen(overlay, 'memo')) {
    const body = replacePopupBody(overlay, 'panel-popup-body', bodyHtml, { preserveScroll: true });
    if (body) bindMemoPopupBody(style, body, count);
    applyNewHighlights(overlay, 'memo', style);
    return;
  }

  let html = '<div class="' + (style === 'bridge' ? bridgeWindowClass('memo','m') : 'panel-popup ub-popup--m') + '" data-popup="memo">';
  const memoTitle = isMinimal ? '备忘录' : (style === 'ancient' ? '手札' : style === 'bridge' ? '舰桥日志' : '备忘录');
  const memoGoalsTip = '让 AI 结合世界书、纪要与最近剧情生成游玩目标（长期/短期/人物相关），勾选后写入备忘录；不知道接下来做什么时用来找方向。';
  html += '<div class="panel-popup-head"><div style="display:flex;align-items:center;gap:4px;flex:1;min-width:0;"><div class="panel-popup-title" style="flex:none">' + memoTitle + '</div>' + (getConfig().showHelpTips ? helpTipButton(memoGoalsTip) : '') + '</div><button class="panel-popup-warehouse-toggle" id="memoGoalsBtn">AI 规划</button><button class="panel-popup-close" id="panelClose">&times;</button></div>';
  html += '<div class="panel-popup-body">' + bodyHtml + '</div></div>';

  if (isMinimal) syncDarkClassMinimal(overlay);
  else syncDarkClass(overlay);
  overlay.innerHTML = html;
  applyNewHighlights(overlay, 'memo', style);
  markPopupShown();
  overlay.classList.add('show');
  overlay.onclick = function (e) {
    if (popupDismissHit(e)) { dismissPopupShell(overlay); return; }
    const item = (e.target as HTMLElement).closest('.memo-list-item');
    if (item) {
      const row = parseInt((item as HTMLElement).dataset.row!);
      rememberPopupScroll(overlay, 'memo');
      showMemoDetail(row, style);
    }
  };
  const memoBody = overlay.querySelector<HTMLElement>('.panel-popup-body');
  if (memoBody) bindMemoPopupBody(style, memoBody, count);
  const memoGoalsBtn = overlay.querySelector<HTMLElement>('#memoGoalsBtn');
  if (memoGoalsBtn) memoGoalsBtn.addEventListener('click', () => showMemoGoalsDialog({ style, onExit: () => showMemoPopup(style) }));
  recallPopupScroll(overlay, 'memo');
}

/** F79：备忘录状态语义三态（进行中/已完成/已放弃）；词表外返回 '' = 现状灰底。
 *  只做包含匹配的固定小词表，不猜自由文本语义。 */
function memoStatusTone(status: string): string {
  const s = status || '';
  if (s.includes('已完成') || s.includes('已达成') || s === '完成') return 'done';
  if (s.includes('已放弃') || s.includes('已取消') || s.includes('已作废')) return 'gone';
  if (s.includes('进行中') || s.includes('未完成') || s.includes('待办') || s.includes('处理中') || s.includes('推进中')) return 'doing';
  return '';
}

/** 备忘录列表 body 内容（空态或条目列表）。 */
function buildMemoBodyHtml(style: StyleType): string {
  const sheet = getSheetByName('备忘录');
  const count = sheet ? (sheet.content.length - 1) : 0;
  let html = '';
  if (count === 0) {
    html += '<div class="panel-empty">' + (style === 'ancient' ? '暂无手札记录' : style === 'bridge' ? '舰桥日志暂无记录' : '暂无备忘事项') + '</div>';
  } else {
    for (let i = count; i >= 1; i--) {
      const title = getCellByHeader('备忘录', i, '备忘标题') || '未命名';
      const type = getCellByHeader('备忘录', i, '类型') || '';
      const status = getCellByHeader('备忘录', i, '当前状态') || '';
      const ch = getCellByHeader('备忘录', i, '相关角色') || '';
      const recordTime = getCellByHeader('备忘录', i, '记录时间') || '';
      const appointedTime = getCellByHeader('备忘录', i, '约定时间') || '';
      const tone = memoStatusTone(status);
      html += '<div class="memo-list-item" data-row="' + i + '">';
      html += '<div class="memo-item-top"><span class="memo-title">' + escapeHtml(title) + '</span><span class="memo-type">' + escapeHtml(type) + '</span></div>';
      html += '<div class="memo-item-sub"><span class="memo-status' + (tone ? ' st-' + tone : '') + '">' + escapeHtml(status) + '</span>';
      if (ch) html += '<span class="memo-char">' + escapeHtml(ch) + '</span>';
      if (recordTime) html += '<span class="memo-time-badge">' + escapeHtml(recordTime) + '</span>';
      if (appointedTime) html += '<span class="memo-time-badge memo-appointed">' + escapeHtml(appointedTime) + '</span>';
      html += '</div></div>';
    }
  }
  return html;
}

/** 备忘录 body 批量操作绑定（全量打开与刷新共用）。 */
function bindMemoPopupBody(style: StyleType, bodyEl: HTMLElement, count: number): void {
  if (count <= 0) return;
  bindBatchSelect(bodyEl, {
    rowSelector: '.memo-list-item',
    getRowId: el => parseInt((el as HTMLElement).dataset.row || '0', 10),
    onRefresh: () => showMemoPopup(style),
    confirmText: ids => `确认删除选中的 ${ids.length} 条备忘事项？`,
    buildActions: () => '<button class="ub-batch-action" data-batch-action="delete">删除</button>',
    runAction: async (_action, ids) => {
      const res = await applyBatchDeleteToTable('备忘录', ids);
      return res.ok
        ? { ok: true, message: `已删除 ${res.deleted} 条备忘事项${res.skipped ? `（跳过 ${res.skipped} 条）` : ''}` }
        : { ok: false, message: '删除失败，请刷新后重试' };
    },
  });
}

/** 地图角色标记点击弹窗：按姓名在 恋爱对象表/重要角色表/主角信息表 反查，
 * UI 参照角色信息弹窗的卡片样式（无标签页、无来源字段）。
 * onClose：关闭时回调（用于返回地图弹窗）。 */
export function showMapCharPopup(name: string, style: StyleType, onClose?: () => void, detail?: string): void {
  const overlay = document.getElementById('panelOverlay')!;
  const isMinimal = style === 'minimal';

  // 反查角色信息（年龄=生日列按当前游戏日期推算，旧库年龄列兼容透传）
  let cardData: CharInfoCardData | null = null;
  const ageToday = getTodayDateKey();

  // 恋爱对象表
  const loverIdx = findRowByColumn('恋爱对象表', '姓名', name);
  if (loverIdx >= 0) {
    cardData = {
      name,
      age: readCharAgeText('恋爱对象表', loverIdx, ageToday),
      intro: getCellByHeader('恋爱对象表', loverIdx, '一句话介绍') || '',
      identity: getCellByHeader('恋爱对象表', loverIdx, '身份') || '',
      extraLabel: '最近亲密互动',
      extraValue: getCellByHeader('恋爱对象表', loverIdx, '最近亲密互动') || '',
    };
  } else {
    const impIdx = findRowByColumn('重要角色表', '姓名', name);
    if (impIdx >= 0) {
      cardData = {
        name,
        gender: getCellByHeader('重要角色表', impIdx, '性别') || '',
        age: readCharAgeText('重要角色表', impIdx, ageToday),
        intro: getCellByHeader('重要角色表', impIdx, '一句话介绍') || '',
        identity: getCellByHeader('重要角色表', impIdx, '身份') || '',
      };
    } else {
      const protName = getCellByHeader('主角信息表', 1, '姓名') || '';
      if (protName === name) {
        cardData = {
          name,
          age: readCharAgeText('主角信息表', 1, ageToday),
          appearance: getCellByHeader('主角信息表', 1, '外貌特征') || '',
          identity: getCellByHeader('主角信息表', 1, '身份背景') || '',
        };
      }
    }
  }

  // 构建 HTML（复用 char-info-popup 样式，无标签页）
  const titleText = isMinimal ? 'CHARACTER' : (style === 'ancient' ? '人物' : style === 'xianxia' ? '仙缘' : style === 'bridge' ? '人员档案' : '角色信息');
  let html = '<div class="' + (style === 'bridge' ? bridgeWindowClass('character','m') + ' char-info-popup' : 'panel-popup char-info-popup ub-popup--m') + '">';
  html += '<div class="panel-popup-head"><div class="panel-popup-title">' + titleText + '</div><button class="panel-popup-close" id="panelClose">&times;</button></div>';
  html += '<div class="char-info-body"><div class="char-info-panel active">';
  if (cardData) {
    html += buildCharInfoCard(cardData, isMinimal);
    if (findRowByColumn('恋爱对象表', '姓名', name) !== -1 || findRowByColumn('重要角色表', '姓名', name) !== -1) {
      html += '<button class="char-hub-map-link" data-char-hub-map-open="' + escapeHtmlAttr(name) + '" type="button">查看完整档案</button>';
    }
  } else if (detail) {
    // 数据库找不到角色信息，fallback 展示 AI 输出的 detail
    const escDetail = escapeHtmlAttr(detail);
    html += '<div class="char-info-card">';
    html += '<div class="char-info-card-name">' + escapeHtml(name || '—') + '</div>';
    html += '<div class="char-info-card-rows">';
    html += detailRow('身份/行为', escDetail, isMinimal);
    html += '</div></div>';
  } else {
    html += '<div class="panel-empty">未找到该角色信息</div>';
  }
  html += '</div></div></div>';

  if (isMinimal) syncDarkClassMinimal(overlay);
  else syncDarkClass(overlay);
  overlay.innerHTML = html;
  markPopupShown();
  overlay.classList.add('show');
  overlay.onclick = function (e) {
    const hubLink = (e.target as HTMLElement).closest<HTMLElement>('[data-char-hub-map-open]');
    if (hubLink) {
      closePanelOverlay(overlay);
      showCharacterInfoPopup(style, hubLink.dataset.charHubMapOpen || '');
      return;
    }
    if (popupDismissHit(e)) { dismissPopupShell(overlay, onClose); return; }
  };
}

export function showMemoDetail(row: number, style: StyleType): void {
  const overlay = document.getElementById('panelOverlay')!;
  const title = getCellByHeader('备忘录', row, '备忘标题') || '未命名';
  const type = getCellByHeader('备忘录', row, '类型') || '';
  const ch = getCellByHeader('备忘录', row, '相关角色') || '';
  const detail = getCellByHeader('备忘录', row, '详细内容') || '无';
  const status = getCellByHeader('备忘录', row, '当前状态') || '';
  const recordTime = getCellByHeader('备忘录', row, '记录时间') || '';
  const appointedTime = getCellByHeader('备忘录', row, '约定时间') || '';
  const result = getCellByHeader('备忘录', row, '后续结果') || '';
  const isMinimal = style === 'minimal';

  let html = '<div class="' + (style === 'bridge' ? bridgeWindowClass('memo','m') : 'panel-popup ub-popup--m') + '">';
  html += '<div class="panel-popup-head"><button class="panel-popup-back" id="panelBack">← 返回</button><div class="panel-popup-title">' + escapeHtml(title) + '</div><button class="panel-popup-close" id="panelClose">&times;</button></div>';
  html += '<div class="panel-popup-body">';
  if (isMinimal) {
    html += '<div class="detail-content"><span class="dc-label">详细内容</span><p class="dc-text">' + escapeHtml(detail) + '</p></div>';
    if (recordTime) html += '<div class="info-row" style="margin-top:12px;"><span class="info-label">记录时间</span><span class="info-value">' + escapeHtml(recordTime) + '</span></div>';
    if (status) html += '<div class="info-row" style="margin-top:4px;"><span class="info-label">当前状态</span><span class="info-value">' + escapeHtml(status) + '</span></div>';
    if (appointedTime) html += '<div class="info-row" style="margin-top:4px;"><span class="info-label">约定时间</span><span class="info-value">' + escapeHtml(appointedTime) + '</span></div>';
    if (result) html += '<div class="detail-content"><span class="dc-label">后续结果</span><p class="dc-text">' + escapeHtml(result) + '</p></div>';
  } else {
    html += '<div class="detail-row"><span class="dl">类型</span><span class="dv">' + escapeHtml(type) + '</span></div>';
    const memoTone = memoStatusTone(status);
    html += '<div class="detail-row"><span class="dl">状态</span><span class="dv"><span class="memo-status' + (memoTone ? ' st-' + memoTone : '') + '">' + escapeHtml(status) + '</span></span></div>';
    if (ch) html += '<div class="detail-row"><span class="dl">相关角色</span><span class="dv">' + escapeHtml(ch) + '</span></div>';
    if (recordTime) html += '<div class="detail-row"><span class="dl">记录时间</span><span class="dv">' + escapeHtml(recordTime) + '</span></div>';
    if (appointedTime) html += '<div class="detail-row"><span class="dl">约定时间</span><span class="dv">' + escapeHtml(appointedTime) + '</span></div>';
    html += '<div class="detail-content"><span class="dl">详细内容</span><p class="dc">' + escapeHtml(detail) + '</p></div>';
    if (result) html += '<div class="detail-content"><span class="dl">后续结果</span><p class="dc">' + escapeHtml(result) + '</p></div>';
  }
  html += '<div class="item-detail-actions">';
  html += '<button class="' + (isMinimal ? 'btn-line' : 'item-discard-btn') + '" id="memoDeleteBtn" data-row="' + row + '">' + (style === 'ancient' ? '焚毁' : '删除') + '</button>';
  html += '</div>';
  html += '</div></div>';

  overlay.innerHTML = html;
  overlay.onclick = async function (e) {
    if (popupDismissHit(e)) { dismissPopupShell(overlay); return; }
    if ((e.target as HTMLElement).id === 'panelBack') showMemoPopup(style);
    if ((e.target as HTMLElement).id === 'memoDeleteBtn') {
      const rowIdx = parseInt((e.target as HTMLElement).dataset.row!);
      if (await showConfirmDialog({ message: style === 'ancient' ? '确认焚毁此手札？' : '确认删除该备忘事项？', okText: style === 'ancient' ? '焚毁' : '删除', danger: true })) {
        const result = await deleteContentRowSqlFirstDetailed('备忘录', rowIdx);
        if (!result.ok) {
          getToastr()?.error(result.failure.message, style === 'ancient' ? '手札提示' : '备忘录提示');
          return;
        }
        getToastr()?.success(
          style === 'ancient' ? '手札已焚毁' : '备忘事项已删除',
          style === 'ancient' ? '手札提示' : '备忘录提示',
        );
        showMemoPopup(style);
      }
    }
  };
}

// ===== 物品弹窗 =====
export function showItemPopup(style: StyleType): void {
  const overlay = document.getElementById('panelOverlay')!;
  const sheet = getSheetByName('物品表');
  const count = sheet ? (sheet.content.length - 1) : 0;
  const isMinimal = style === 'minimal';
  const bodyHtml = buildItemBodyHtml(style);

  // 已开着同一弹窗 → 只换数据容器（保留壳/头），滚动保持；旧 body 元素销毁使旧事件绑定自动失效
  if (isPopupOpen(overlay, 'item')) {
    const body = replacePopupBody(overlay, 'panel-popup-body', bodyHtml, { preserveScroll: true });
    if (body) bindItemPopupBody(style, body, count);
    applyNewHighlights(overlay, 'item', style);
    return;
  }

  const whLabel = warehouseLabels(style).warehouse;
  const itemTitleLabel = warehouseLabels(style).inventory;
  let html = '<div class="' + (style === 'bridge' ? bridgeWindowClass('item','m') : 'panel-popup ub-popup--m') + '" data-popup="item">';
  const itemHelpText = '仓库中的物品不会出现在数据库中，也不会影响正文内容。入库时可选择移动（从物品栏移除）或复制（保留原件）。如果想在上下文中体现该物品，请从仓库移出。';
  html += '<div class="panel-popup-head"><button class="panel-popup-warehouse-toggle" id="whToggle">' + whLabel + '</button><div style="display:flex;align-items:center;gap:4px;flex:1;min-width:0;"><div class="panel-popup-title" style="flex:none">' + itemTitleLabel + '</div>' + (getConfig().showHelpTips ? helpTipButton(itemHelpText) : '') + '</div><button class="panel-popup-close" id="panelClose">&times;</button></div>';
  html += '<div class="panel-popup-body">' + bodyHtml + '</div></div>';

  if (isMinimal) syncDarkClassMinimal(overlay);
  else syncDarkClass(overlay);
  overlay.innerHTML = html;
  applyNewHighlights(overlay, 'item', style);
  markPopupShown();
  overlay.classList.add('show');
  overlay.onclick = function (e) {
    if (popupDismissHit(e)) { dismissPopupShell(overlay); return; }
    if ((e.target as HTMLElement).id === 'whToggle') { showWarehousePopup(style); return; }
    const item = (e.target as HTMLElement).closest('.item-list-item');
    if (item) {
      const row = parseInt((item as HTMLElement).dataset.row!);
      rememberPopupScroll(overlay, 'item');
      showItemDetail(row, style);
    }
  };
  const itemBody = overlay.querySelector<HTMLElement>('.panel-popup-body');
  if (itemBody) bindItemPopupBody(style, itemBody, count);
  recallPopupScroll(overlay, 'item');
}

/** 物品列表 body 内容（空态或条目列表）。 */
function buildItemBodyHtml(style: StyleType): string {
  const sheet = getSheetByName('物品表');
  const count = sheet ? (sheet.content.length - 1) : 0;
  let html = '';
  if (count === 0) {
    html += '<div class="panel-empty">' + escapeHtml(warehouseLabels(style).emptyInventory) + '</div>';
  } else {
    for (let i = 1; i <= count; i++) {
      const name = getCellByHeader('物品表', i, '物品名称') || '未命名';
      const type = getCellByHeader('物品表', i, '类型') || '';
      const qty = getCellByHeader('物品表', i, '数量') || '1';
      const desc = getCellByHeader('物品表', i, '描述') || '';
      html += '<div class="item-list-item" data-row="' + i + '">';
      html += '<div class="item-top">';
      html += '<span class="item-name">' + escapeHtml(name) + '</span>';
      if (qty && qty !== '1') html += '<span class="item-qty">×' + escapeHtml(qty) + '</span>';
      if (type) html += '<span class="item-type">' + escapeHtml(type) + '</span>';
      if (getConfig().wardrobeEnabled && mapInventoryTypeToWardrobeCategory(type)) html += '<span class="item-wardrobe-badge">衣柜</span>';
      html += '</div>';
      if (desc) html += '<div class="item-desc">' + escapeHtml(desc) + '</div>';
      html += '</div>';
    }
  }
  return html;
}

/** 物品弹窗 body 的批量操作绑定（全量打开与刷新共用）。 */
function bindItemPopupBody(style: StyleType, bodyEl: HTMLElement, count: number): void {
  if (count <= 0) return;
  bindBatchSelect(bodyEl, {
    rowSelector: '.item-list-item',
    getRowId: el => parseInt((el as HTMLElement).dataset.row || '0', 10),
    onRefresh: () => showItemPopup(style),
    confirmText: () => null,
    buildActions: () => {
      let html = '<button class="ub-batch-action" data-batch-action="warehouse">' + escapeHtml(warehouseLabels(style).put) + '</button>';
      if (getConfig().wardrobeEnabled) html += '<button class="ub-batch-action" data-batch-action="wardrobe">加入衣柜</button>';
      html += '<button class="ub-batch-action" data-batch-action="delete">丢弃</button>';
      return html;
    },
    runAction: async (action, ids) => {
      if (action === 'delete') {
        if (!await showConfirmDialog({ message: `确认丢弃选中的 ${ids.length} 件物品？`, danger: true })) return { ok: false, message: '' };
        const res = await applyBatchDeleteToTable('物品表', ids);
        try { if (res.ok) (window as any).__ubEmitAchievement?.('item_discard', {}); } catch (_e) {}
        return res.ok
          ? { ok: true, message: `已丢弃 ${res.deleted} 件${res.skipped ? `（跳过 ${res.skipped} 件）` : ''}` }
          : { ok: false, message: '删除失败，请刷新后重试' };
      }
      if (action === 'warehouse') {
        return putInventoryRowsIntoWarehouse(style, ids);
      }
      if (action === 'wardrobe') {
        if (!await showConfirmDialog({ message: `确认将选中的 ${ids.length} 件衣物加入衣柜？` })) return { ok: false, message: '' };
        let okCount = 0; let fail = 0;
        for (const i of ids) {
          if (!mapInventoryTypeToWardrobeCategory(getCellByHeader('物品表', i, '类型') || '')) { fail++; continue; }
          const r = await addInventoryItemToWardrobe(i);
          if (r.ok) okCount++; else fail++;
        }
        return okCount > 0
          ? { ok: true, message: `已加入衣柜 ${okCount} 件${fail ? `（${fail} 件跳过/失败）` : ''}` }
          : { ok: false, message: `无衣物可加入衣柜${fail ? `（${fail} 件失败）` : ''}` };
      }
      return { ok: false, message: '未知操作' };
    },
  });
}

export function showItemDetail(row: number, style: StyleType): void {
  const overlay = document.getElementById('panelOverlay')!;
  const name = getCellByHeader('物品表', row, '物品名称') || '未命名';
  const type = getCellByHeader('物品表', row, '类型') || '';
  const qty = getCellByHeader('物品表', row, '数量') || '1';
  const desc = getCellByHeader('物品表', row, '描述') || '无';
  const isMinimal = style === 'minimal';

  let html = '<div class="' + (style === 'bridge' ? bridgeWindowClass('item','m') : 'panel-popup ub-popup--m') + '">';
  html += '<div class="panel-popup-head"><button class="panel-popup-back" id="panelBack">← 返回</button><div class="panel-popup-title">' + escapeHtml(name) + '</div><button class="panel-popup-close" id="panelClose">&times;</button></div>';
  html += '<div class="panel-popup-body">';
  html += detailRow('类型', type, isMinimal);
  html += detailRow('数量', qty, isMinimal);
  html += detailContent('描述', desc, isMinimal);
  html += '<div class="item-detail-actions">';
  html += '<button class="' + (isMinimal ? 'btn-line' : 'item-use-btn') + '" id="itemUseBtn" data-name="' + escapeHtmlAttr(name) + '">' + (style === 'ancient' ? '启用' : '使用') + '</button>';
  if (getConfig().wardrobeEnabled && mapInventoryTypeToWardrobeCategory(type)) {
    html += '<button class="' + (isMinimal ? 'btn-line' : 'item-warehouse-btn') + '" id="itemToWardrobeBtn" data-row="' + row + '">' + (style === 'ancient' ? '收入衣橱' : style === 'bridge' ? '登记衣柜' : '加入衣柜') + '</button>';
  }
  html += '<button class="' + (isMinimal ? 'btn-line' : 'item-warehouse-btn') + '" id="itemToWarehouseBtn" data-row="' + row + '">' + escapeHtml(warehouseLabels(style).put) + '</button>';
  html += '<button class="' + (isMinimal ? 'btn-line item-discard-btn' : 'item-discard-btn') + '" id="itemDiscardBtn" data-row="' + row + '">' + (style === 'ancient' ? '弃置' : '丢弃') + '</button>';
  html += '</div>';
  html += '</div></div>';

  overlay.innerHTML = html;
  overlay.onclick = async function (e) {
    if (popupDismissHit(e)) { dismissPopupShell(overlay); return; }
    if ((e.target as HTMLElement).id === 'panelBack') showItemPopup(style);
    if ((e.target as HTMLElement).id === 'itemUseBtn') {
      const itemName = (e.target as HTMLElement).dataset.name!;
      appendMessageToChat('使用' + itemName);
      closePanelOverlay(overlay);
      getToastr()?.success('已放入输入框: 使用' + itemName,
        style === 'ancient' ? '随身提示' : '物品系统提示');
      // 成就打点：使用物品；色色态下使用 / 物品超载时使用 触发对应隐藏成就
      try {
        (window as any).__ubEmitAchievement?.('item_use', {});
        if (isNsfwPlayActive()) {
          (window as any).__ubEmitAchievement?.('item_use_while_lewd', {});
        }
        const itemRows = (getSheetByName('物品表')?.content?.length || 1) - 1;
        if (itemRows > 20) (window as any).__ubEmitAchievement?.('item_use_overloaded', {});
      } catch (_e) { /* ignore */ }
    }
    if ((e.target as HTMLElement).id === 'itemToWarehouseBtn') {
      const rowIdx = parseInt((e.target as HTMLElement).dataset.row!);
      const result = await putInventoryRowsIntoWarehouse(style, [rowIdx]);
      if (result.ok) {
        getToastr()?.success(result.message, style === 'ancient' ? '随身提示' : '物品系统提示');
        showItemPopup(style);
      } else if (result.message) {
        getToastr()?.error(result.message, '仓库提示');
      }
    }
    if ((e.target as HTMLElement).id === 'itemToWardrobeBtn') {
      const rowIdx = parseInt((e.target as HTMLElement).dataset.row!);
      if (await showConfirmDialog({ message: '确认将该服饰作为可复用模板加入衣柜？加入成功后会从物品表移除原整行。' })) {
        const button = e.target as HTMLButtonElement;
        button.disabled = true;
        const result = await addInventoryItemToWardrobe(rowIdx);
        if (result.ok) {
          getToastr()?.success('服饰已加入衣柜', '衣柜');
          showItemPopup(style);
        } else {
          button.disabled = false;
          getToastr()?.error(result.error, '衣柜');
        }
      }
    }
    if ((e.target as HTMLElement).id === 'itemDiscardBtn') {
      const rowIdx = parseInt((e.target as HTMLElement).dataset.row!);
      if (await showConfirmDialog({ message: style === 'ancient' ? '确认弃置此物？' : '确认丢弃该物品？', okText: style === 'ancient' ? '弃置' : '丢弃', danger: true })) {
        const result = await deleteContentRowSqlFirstDetailed('物品表', rowIdx);
        if (!result.ok) {
          getToastr()?.error(result.failure.message, style === 'ancient' ? '随身提示' : '物品系统提示');
          return;
        }
        getToastr()?.success(
          style === 'ancient' ? '物品已弃置' : '物品已丢弃',
          style === 'ancient' ? '随身提示' : '物品系统提示',
        );
        try { (window as any).__ubEmitAchievement?.('item_discard', {}); } catch (_e) { /* ignore */ }
        showItemPopup(style);
      }
    }
  };
}

// ===== 仓库弹窗 =====
let _warehouseActiveGroupId: number | null = null;

function resolveWarehouseGroup(groups: readonly WarehouseGroup[], groupId?: number): WarehouseGroup | null {
  if (typeof groupId === 'number' && Number.isFinite(groupId)) {
    const found = groups.find(group => group.id === groupId);
    if (found) return found;
  }
  return groups[0] || null;
}

function warehouseGroupCount(items: readonly WarehouseItem[], groupId: number): number {
  return items.reduce((count, item) => count + (item.groupId === groupId ? 1 : 0), 0);
}

function warehouseGroupOptions(groups: readonly WarehouseGroup[], items: readonly WarehouseItem[], excludeGroupId?: number): Array<{ id: number; name: string; count: number }> {
  return groups
    .filter(group => group.id !== excludeGroupId)
    .map(group => ({ id: group.id, name: group.name, count: warehouseGroupCount(items, group.id) }));
}

function warehouseImageNote(
  source: WarehouseGroup,
  target: WarehouseGroup | undefined,
  items: readonly WarehouseItem[],
): string {
  if (!source.overview || !target) return '';
  const sourceHasItems = items.some(item => item.groupId === source.id);
  if (!target.overview && sourceHasItems) {
    return `「${source.name}」的总览图将转移给「${target.name}」。`;
  }
  return `「${source.name}」的总览图将一并删除。`;
}

function copyConflictMessage(conflicts: readonly string[]): string {
  return `存在同名物品：${conflicts.join('、')}，复制已取消`;
}

function warehouseActiveIdFromDom(overlay: HTMLElement): number | null {
  const popup = overlay.querySelector<HTMLElement>('.panel-popup[data-popup="warehouse"]');
  const raw = popup?.getAttribute('data-wh-active-group');
  const id = raw == null ? NaN : Number(raw);
  return Number.isFinite(id) ? id : null;
}

function buildWarehouseItemsBody(
  style: StyleType,
  groups: readonly WarehouseGroup[],
  items: readonly WarehouseItem[],
  activeGroupId: number,
): string {
  const labels = warehouseLabels(style);
  const active = resolveWarehouseGroup(groups, activeGroupId);
  if (!active) return '<div class="panel-empty">' + escapeHtml(labels.emptyWarehouse) + '</div>';
  const activeItems = items.filter(item => item.groupId === active.id);
  let html = buildWarehouseGroupBar(
    groups.map(group => ({ id: group.id, name: group.name, count: warehouseGroupCount(items, group.id) })),
    active.id,
    labels.newGroup,
  );
  const record = active.overview;
  const hasImage = !!record && isSafeStoredImagePath(record.imagePath);
  const stale = hasImage && isWarehouseOverviewStale(record!, activeItems);
  html += buildWarehouseImageCard({
    imageSrc: hasImage ? record!.imagePath : null,
    emptyHint: style === 'ancient' ? '生成一览图' : '生成总览图',
    stale,
  });
  if (activeItems.length === 0) {
    html += '<div class="panel-empty">' + escapeHtml(labels.emptyWarehouse) + '</div>';
    return html;
  }
  for (const item of activeItems) {
    const name = item.data.物品名称 || '未命名';
    const type = item.data.类型 || '';
    const qty = item.data.数量 || '1';
    const desc = item.data.描述 || '';
    html += '<div class="item-list-item" data-uid="' + item.uid + '">';
    html += '<div class="item-top">';
    html += '<span class="item-name">' + escapeHtml(name) + '</span>';
    if (qty && qty !== '1') html += '<span class="item-qty">×' + escapeHtml(qty) + '</span>';
    if (type) html += '<span class="item-type">' + escapeHtml(type) + '</span>';
    html += '</div>';
    if (desc) html += '<div class="item-desc">' + escapeHtml(desc) + '</div>';
    const srcCard = item.sourceCard || '';
    html += '<div class="item-desc">来自 ' + escapeHtml(srcCard || '—') + '</div>';
    html += '</div>';
  }
  return html;
}

function buildWarehouseManageBody(
  style: StyleType,
  groups: readonly WarehouseGroup[],
  items: readonly WarehouseItem[],
  activeGroupId: number,
): string {
  const labels = warehouseLabels(style);
  let html = '<div class="wh-manage-note">分组只改变仓库的展示方式，物品仍是全局共享的。删除或合并仓库不会丢弃物品；物品会自动转移到你指定的仓库。至少保留一个仓库。</div>';
  html += '<div class="wh-group-list">';
  const onlyOne = groups.length <= 1;
  for (const group of groups) {
    const groupItems = items.filter(item => item.groupId === group.id);
    const count = groupItems.length;
    const stale = !!group.overview && isWarehouseOverviewStale(group.overview, groupItems);
    const imageText = group.overview ? (stale ? '总览图可能过期' : '总览图已生成') : '未生成总览图';
    const isActive = group.id === activeGroupId;
    html += '<div class="wh-group-row' + (isActive ? ' active' : '') + '">';
    html += '<div class="wh-group-row-main">';
    html += '<div class="wh-group-row-name">' + escapeHtml(group.name)
      + (isActive ? '<span class="wh-badge">当前</span>' : '') + '</div>';
    html += '<div class="wh-group-row-meta">' + count + ' 件物品 · ' + escapeHtml(imageText) + '</div>';
    html += '</div>';
    html += '<div class="wh-group-row-actions">';
    html += '<button class="panel-popup-warehouse-toggle wh-group-act" data-wh-group-act="rename" data-wh-group-id="'
      + group.id + '">重命名</button>';
    html += '<button class="panel-popup-warehouse-toggle wh-group-act" data-wh-group-act="merge" data-wh-group-id="'
      + group.id + '"' + (onlyOne ? ' disabled' : '') + '>合并</button>';
    html += '<button class="panel-popup-warehouse-toggle wh-group-act danger" data-wh-group-act="delete" data-wh-group-id="'
      + group.id + '"' + (onlyOne ? ' disabled' : '') + '>' + escapeHtml(labels.deleteGroup) + '</button>';
    html += '</div></div>';
  }
  html += '</div>';
  html += '<button class="wh-add-group" data-wh-action="add-group">＋ ' + escapeHtml(labels.newGroup) + '</button>';
  return html;
}

export async function showWarehousePopup(
  style: StyleType,
  groupId?: number,
  opts: { view?: 'items' | 'manage'; resetScroll?: boolean } = {},
): Promise<void> {
  const overlay = document.getElementById('panelOverlay')!;
  const isMinimal = style === 'minimal';
  const groups = await getWarehouseGroups();
  const items = await getWarehouseItems();
  const active = resolveWarehouseGroup(groups, groupId ?? _warehouseActiveGroupId ?? undefined);
  if (!active) return;
  _warehouseActiveGroupId = active.id;
  const view = opts.view === 'manage' ? 'manage' : 'items';
  const bodyHtml = view === 'manage'
    ? buildWarehouseManageBody(style, groups, items, active.id)
    : buildWarehouseItemsBody(style, groups, items, active.id);

  // 同视图刷新只换 body（保留壳/头）；切视图/换弹窗走整壳重建。
  const currentPopup = overlay.querySelector<HTMLElement>('.panel-popup');
  const sameView = isPopupOpen(overlay, 'warehouse') && currentPopup?.getAttribute('data-wh-view') === view;
  if (sameView) {
    currentPopup?.setAttribute('data-wh-active-group', String(active.id));
    const body = replacePopupBody(overlay, 'panel-popup-body', bodyHtml, { preserveScroll: !opts.resetScroll });
    if (body && view === 'items') {
      bindWarehousePopupBody(style, body, active.id, groups, items);
    }
    return;
  }

  const labels = warehouseLabels(style);
  const whHelpText = view === 'manage'
    ? '新建、重命名、合并或删除仓库分组。删除或合并时物品会转移到你指定的仓库，不会丢失；至少保留一个仓库。'
    : '仓库中的物品不会出现在数据库中，也不会影响正文。分组只影响仓库展示。入库时可选择移动或复制；长按条目可批量操作。';
  let html = '<div class="'
    + (style === 'bridge' ? bridgeWindowClass('warehouse','m') : 'panel-popup ub-popup--m')
    + '" data-popup="warehouse" data-wh-view="' + view + '" data-wh-active-group="' + active.id + '">';
  if (view === 'manage') {
    html += '<div class="panel-popup-head"><button class="panel-popup-back" id="whManageBack">← 返回'
      + escapeHtml(labels.warehouse) + '</button>'
      + '<div style="display:flex;align-items:center;gap:4px;flex:1;min-width:0;">'
      + '<div class="panel-popup-title" style="flex:none">' + escapeHtml(labels.groupsManage) + '</div>'
      + (getConfig().showHelpTips ? helpTipButton(whHelpText) : '')
      + '</div><button class="panel-popup-close" id="panelClose">&times;</button></div>';
  } else {
    html += '<div class="panel-popup-head"><button class="panel-popup-warehouse-toggle" id="whToggleBack">'
      + escapeHtml(labels.backToInventory) + '</button>'
      + '<div style="display:flex;align-items:center;gap:4px;flex:1;min-width:0;">'
      + '<div class="panel-popup-title" style="flex:none">' + escapeHtml(labels.warehouse) + '</div>'
      + (getConfig().showHelpTips ? helpTipButton(whHelpText) : '')
      + '</div><button class="panel-popup-warehouse-toggle" id="whGroupsBtn">'
      + escapeHtml(labels.groupsManage) + '</button>'
      + '<button class="panel-popup-close" id="panelClose">&times;</button></div>';
  }
  html += '<div class="panel-popup-body">' + bodyHtml + '</div></div>';

  if (isMinimal) syncDarkClassMinimal(overlay);
  else syncDarkClass(overlay);
  overlay.innerHTML = html;
  markPopupShown();
  overlay.classList.add('show');
  overlay.onclick = async function (e) {
    if (popupDismissHit(e)) { dismissPopupShell(overlay); return; }
    const target = e.target as HTMLElement;
    if (target.id === 'whToggleBack') { showItemPopup(style); return; }
    if (target.id === 'whManageBack') {
      const activeId = warehouseActiveIdFromDom(overlay) ?? active.id;
      await showWarehousePopup(style, activeId, { resetScroll: true });
      return;
    }
    if (target.id === 'whGroupsBtn') {
      const activeId = warehouseActiveIdFromDom(overlay) ?? active.id;
      await showWarehousePopup(style, activeId, { view: 'manage' });
      return;
    }
    const groupEl = target.closest<HTMLElement>('[data-wh-group]');
    if (groupEl) {
      const nextId = Number(groupEl.getAttribute('data-wh-group'));
      if (Number.isFinite(nextId)) await showWarehousePopup(style, nextId, { resetScroll: true });
      return;
    }
    const actionEl = target.closest<HTMLElement>('[data-wh-action]');
    if (actionEl) {
      const action = actionEl.getAttribute('data-wh-action');
      if (action === 'add-group') { await addWarehouseGroup(style); return; }
      if (action === 'overview') {
        const activeId = warehouseActiveIdFromDom(overlay) ?? active.id;
        await showItemOverviewPopup(style, activeId);
        return;
      }
      return;
    }
    const groupActEl = target.closest<HTMLElement>('[data-wh-group-act]');
    if (groupActEl) {
      if ((groupActEl as HTMLButtonElement).disabled) return;
      const act = groupActEl.getAttribute('data-wh-group-act');
      const groupId = Number(groupActEl.getAttribute('data-wh-group-id'));
      if (!Number.isFinite(groupId)) return;
      if (act === 'rename') { await renameWarehouseGroupUi(style, groupId); return; }
      if (act === 'merge') { await mergeWarehouseGroupUi(style, groupId); return; }
      if (act === 'delete') { await deleteWarehouseGroupUi(style, groupId); return; }
      return;
    }
    const item = target.closest('.item-list-item');
    if (item && view === 'items') {
      const uid = parseInt((item as HTMLElement).dataset.uid!);
      const activeId = warehouseActiveIdFromDom(overlay) ?? active.id;
      rememberPopupScroll(overlay, 'warehouse');
      showWarehouseDetail(uid, style, activeId);
    }
  };
  const whBody = overlay.querySelector<HTMLElement>('.panel-popup-body');
  if (whBody && view === 'items') bindWarehousePopupBody(style, whBody, active.id, groups, items);
  if (view === 'items' && !opts.resetScroll) recallPopupScroll(overlay, 'warehouse');
}

/** 仓库 body 批量操作绑定（全量打开与刷新共用）。 */
function bindWarehousePopupBody(
  style: StyleType,
  bodyEl: HTMLElement,
  activeGroupId: number,
  groups: readonly WarehouseGroup[],
  items: readonly WarehouseItem[],
): void {
  const activeItems = items.filter(item => item.groupId === activeGroupId);
  if (activeItems.length === 0) return;
  const labels = warehouseLabels(style);
  const activeGroup = resolveWarehouseGroup(groups, activeGroupId);
  bindBatchSelect(bodyEl, {
    rowSelector: '.item-list-item',
    getRowId: el => parseInt((el as HTMLElement).dataset.uid || '0', 10),
    onRefresh: () => { void showWarehousePopup(style, activeGroupId); },
    confirmText: () => null,
    buildActions: () => {
      let html = '<button class="ub-batch-action" data-batch-action="restore">' + escapeHtml(labels.remove) + '</button>';
      if (groups.length > 1) html += '<button class="ub-batch-action" data-batch-action="transfer">转移到…</button>';
      html += '<button class="ub-batch-action" data-batch-action="discard">' + escapeHtml(labels.discard) + '</button>';
      return html;
    },
    runAction: async (action, uids) => {
      if (action === 'restore') {
        if (!await showConfirmDialog({
          message: `确认将选中的 ${uids.length} 件移出「${activeGroup?.name || ''}」（放回${labels.inventory}）？`,
          okText: labels.remove,
        })) return { ok: false, message: '' };
        const ok = await batchRemoveFromWarehouse(uids);
        return ok
          ? { ok: true, message: `已移出 ${uids.length} 件` }
          : { ok: false, message: '移出仓库失败，已回滚' };
      }
      if (action === 'transfer') {
        const others = warehouseGroupOptions(groups, items, activeGroupId);
        const target = await showWarehouseTargetDialog({
          title: '转移物品',
          message: `已选 ${uids.length} 件物品`,
          groups: others,
          selectedId: others[0]?.id,
          allowCopy: false,
          okText: '转移',
          note: '转移只在仓库分组之间移动，不会回到' + labels.inventory + '。',
        });
        if (!target) return { ok: false, message: '' };
        const targetGroup = groups.find(group => group.id === target.groupId);
        const ok = await moveWarehouseItems(uids, target.groupId);
        return ok
          ? { ok: true, message: `已转移 ${uids.length} 件到「${targetGroup?.name || ''}」` }
          : { ok: false, message: '转移失败，请重试' };
      }
      if (action === 'discard') {
        if (!await showConfirmDialog({ message: `确认丢弃选中的 ${uids.length} 件？`, danger: true })) return { ok: false, message: '' };
        const ok = await batchDeleteFromWarehouse(uids);
        try { if (ok) (window as any).__ubEmitAchievement?.('item_discard', {}); } catch (_e) { /* ignore */ }
        return ok
          ? { ok: true, message: `已丢弃 ${uids.length} 件` }
          : { ok: false, message: '丢弃失败，请重试' };
      }
      return { ok: false, message: '未知操作' };
    },
  });
}

/** 物品栏 → 仓库：单件/批量共用同一个目标仓库 + 移动/复制弹窗。 */
async function putInventoryRowsIntoWarehouse(
  style: StyleType,
  rowIndexes: number[],
): Promise<{ ok: boolean; message: string }> {
  if (!Array.isArray(rowIndexes) || rowIndexes.length === 0) return { ok: false, message: '' };
  const labels = warehouseLabels(style);
  const rows: WarehouseBatchRow[] = [];
  for (const rowIndex of rowIndexes) {
    const name = getCellByHeader('物品表', rowIndex, '物品名称') || '';
    if (!name) return { ok: false, message: '部分物品无法读取，请刷新后重试' };
    rows.push({
      物品名称: name,
      类型: getCellByHeader('物品表', rowIndex, '类型') || '',
      数量: getCellByHeader('物品表', rowIndex, '数量') || '1',
      描述: getCellByHeader('物品表', rowIndex, '描述') || '',
    });
  }
  const groups = await getWarehouseGroups();
  const items = await getWarehouseItems();
  const names = rows.map(row => row.物品名称);
  const pick = await showWarehouseTargetDialog({
    title: labels.put,
    message: rows.length === 1
      ? `${rows[0].物品名称} ×${rows[0].数量 || '1'}`
      : `已选 ${rows.length} 件物品`,
    groups: groups.map(group => ({
      id: group.id,
      name: group.name,
      count: warehouseGroupCount(items, group.id),
    })),
    selectedId: _warehouseActiveGroupId ?? groups[0]?.id,
    allowCopy: true,
    copyDefault: false,
    okText: labels.put,
    note: '同名物品不会自动合并；复制模式下目标仓库（或本批选择）已有同名物品会被拦截。',
    copyConflictsFor: (groupId) => findWarehouseCopyConflicts(items, groupId, names),
  });
  if (!pick) return { ok: false, message: '' };
  const target = groups.find(group => group.id === pick.groupId);
  if (!target) return { ok: false, message: '目标仓库不存在' };

  if (rowIndexes.length === 1 && !pick.copy) {
    const outcome = await addToWarehouseChecked(rowIndexes[0], { groupId: pick.groupId, copy: false });
    if (!outcome.ok) {
      return {
        ok: false,
        message: outcome.conflicts?.length ? copyConflictMessage(outcome.conflicts) : (outcome.error || '入库失败'),
      };
    }
  } else {
    const outcome = await addItemsToWarehouseChecked(rows, { groupId: pick.groupId, copy: pick.copy });
    if (!outcome.ok) {
      return {
        ok: false,
        message: outcome.conflicts?.length ? copyConflictMessage(outcome.conflicts) : (outcome.error || '入库失败'),
      };
    }
    if (!pick.copy) {
      const deleted = await applyBatchDeleteToTable('物品表', rowIndexes);
      if (!deleted.ok) return { ok: false, message: '物品行删除失败，已入仓库但原行可能残留' };
    }
  }
  _warehouseActiveGroupId = pick.groupId;
  return {
    ok: true,
    message: pick.copy
      ? `已复制 ${rows.length} 件到「${target.name}」`
      : `已移入 ${rows.length} 件到「${target.name}」`,
  };
}

async function promptWarehouseGroupName(opts: {
  title: string;
  message: string;
  value?: string;
  excludeGroupId?: number;
}): Promise<string | null> {
  let value = opts.value || '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const input = await showPromptDialog({
      title: opts.title,
      message: attempt === 0
        ? opts.message
        : '名称不能为空、不能超过 24 个字符，也不能与已有仓库重名。请重新输入：',
      defaultValue: value,
      okText: '确定',
    });
    if (input == null) return null;
    const error = validateWarehouseGroupName(input, opts.excludeGroupId);
    if (!error) return input.trim();
    getToastr()?.error(error, '仓库分组');
    value = input;
  }
  return null;
}

async function addWarehouseGroup(style: StyleType): Promise<void> {
  const labels = warehouseLabels(style);
  const name = await promptWarehouseGroupName({
    title: labels.newGroup,
    message: '给新仓库起一个名字：',
  });
  if (!name) return;
  const result = await createWarehouseGroup(name);
  if (!result.ok || result.id == null) {
    getToastr()?.error(result.error || '新建仓库失败', '仓库分组');
    return;
  }
  _warehouseActiveGroupId = result.id;
  await showWarehousePopup(style, result.id, { resetScroll: true });
  getToastr()?.success(`已新建「${name}」`, '仓库分组');
}

async function renameWarehouseGroupUi(style: StyleType, groupId: number): Promise<void> {
  const groups = await getWarehouseGroups();
  const group = groups.find(item => item.id === groupId);
  if (!group) return;
  const name = await promptWarehouseGroupName({
    title: '重命名仓库',
    message: '输入新的仓库名称：',
    value: group.name,
    excludeGroupId: group.id,
  });
  if (!name) return;
  const result = await renameWarehouseGroup(group.id, name);
  if (!result.ok) {
    getToastr()?.error(result.error || '重命名失败', '仓库分组');
    return;
  }
  await showWarehousePopup(style, group.id, { view: 'manage' });
  getToastr()?.success(`已重命名为「${name}」`, '仓库分组');
}

async function deleteWarehouseOverviewFile(record: WarehouseOverviewRecord | null): Promise<void> {
  const result = await deleteWarehouseOverviewImage(record);
  if (!result.ok) getToastr()?.warning(`旧总览图删除失败：${result.error || '未知错误'}`, '仓库分组');
}

async function mergeWarehouseGroupUi(style: StyleType, sourceGroupId: number): Promise<void> {
  const groups = await getWarehouseGroups();
  const items = await getWarehouseItems();
  const source = groups.find(group => group.id === sourceGroupId);
  if (!source) return;
  const others = warehouseGroupOptions(groups, items, source.id);
  if (others.length === 0) {
    getToastr()?.error('至少保留一个仓库', '仓库分组');
    return;
  }
  const count = warehouseGroupCount(items, source.id);
  const pick = await showWarehouseTargetDialog({
    title: `合并「${source.name}」`,
    message: `将「${source.name}」的 ${count} 件物品合并到所选仓库。\n合并后源仓库会被删除，物品不会丢失。`,
    groups: others,
    selectedId: others[0].id,
    allowCopy: false,
    okText: '合并',
    noteFor: (targetId) => warehouseImageNote(source, groups.find(group => group.id === targetId), items),
  });
  if (!pick) return;
  const target = groups.find(group => group.id === pick.groupId);
  if (!target) return;
  const result = await mergeWarehouseGroups(source.id, target.id);
  if (!result.ok) {
    getToastr()?.error(result.error || '合并失败', '仓库分组');
    return;
  }
  if (result.removedOverview) await deleteWarehouseOverviewFile(result.removedOverview);
  _warehouseActiveGroupId = target.id;
  await showWarehousePopup(style, target.id, { view: 'manage' });
  getToastr()?.success(`已合并到「${target.name}」`, '仓库分组');
}

async function deleteWarehouseGroupUi(style: StyleType, groupId: number): Promise<void> {
  const labels = warehouseLabels(style);
  const groups = await getWarehouseGroups();
  const items = await getWarehouseItems();
  const source = groups.find(group => group.id === groupId);
  if (!source) return;
  if (groups.length <= 1) {
    getToastr()?.error('至少保留一个仓库', '仓库分组');
    return;
  }
  const count = warehouseGroupCount(items, source.id);
  const others = warehouseGroupOptions(groups, items, source.id);
  if (others.length === 0) return;
  let targetId: number | null = null;

  if (count === 0) {
    const target = groups.find(group => group.id === others[0].id);
    if (!target) return;
    const note = warehouseImageNote(source, target, items);
    const ok = await showConfirmDialog({
      title: labels.deleteGroup,
      message: `删除空仓库「${source.name}」？${note ? `\n${note}` : ''}\n仓库删除后不可恢复。`,
      okText: '删除',
      danger: true,
    });
    if (!ok) return;
    targetId = target.id;
  } else {
    const pick = await showWarehouseTargetDialog({
      title: `${labels.deleteGroup}「${source.name}」`,
      message: `该仓库内有 ${count} 件物品。\n请选择这些物品要转移到的仓库；仓库本身会被删除。`,
      groups: others,
      selectedId: others[0].id,
      allowCopy: false,
      okText: '删除并转移',
      danger: true,
      noteFor: (targetIdValue) => warehouseImageNote(source, groups.find(group => group.id === targetIdValue), items),
    });
    if (!pick) return;
    targetId = pick.groupId;
  }
  if (targetId == null) return;
  const target = groups.find(group => group.id === targetId);
  if (!target) return;
  const result = await deleteWarehouseGroup(source.id, target.id);
  if (!result.ok) {
    getToastr()?.error(result.error || '删除失败', '仓库分组');
    return;
  }
  if (result.removedOverview) await deleteWarehouseOverviewFile(result.removedOverview);
  _warehouseActiveGroupId = target.id;
  await showWarehousePopup(style, target.id, { view: 'manage' });
  getToastr()?.success(`已删除「${source.name}」，${count} 件物品已转移`, '仓库分组');
}

export function showWarehouseDetail(uid: number, style: StyleType, groupId?: number): void {
  const overlay = document.getElementById('panelOverlay')!;
  const isMinimal = style === 'minimal';
  const labels = warehouseLabels(style);

  getWarehouseItems().then(async (items) => {
    const found = items.find(it => it.uid === uid);
    if (!found) { await showWarehousePopup(style, groupId); return; }
    const groups = await getWarehouseGroups();
    const group = groups.find(item => item.id === found.groupId) || groups[0] || null;
    const itemGroupId = found.groupId;
    const name = found.data.物品名称 || '未命名';
    const type = found.data.类型 || '';
    const qty = found.data.数量 || '1';
    const desc = found.data.描述 || '无';

    let html = '<div class="' + (style === 'bridge' ? bridgeWindowClass('warehouse','m') : 'panel-popup ub-popup--m') + '">';
    html += '<div class="panel-popup-head"><button class="panel-popup-back" id="panelBack">← 返回</button><div class="panel-popup-title">' + escapeHtml(name) + '</div><button class="panel-popup-close" id="panelClose">&times;</button></div>';
    html += '<div class="panel-popup-body">';
    html += detailRow('类型', type, isMinimal);
    html += detailRow('数量', qty, isMinimal);
    html += detailRow('所在仓库', group?.name || '—', isMinimal);
    html += detailRow('来源', found.sourceCard || '—', isMinimal);
    html += detailContent('描述', desc, isMinimal);
    html += '<div class="item-detail-actions">';
    html += '<button class="' + (isMinimal ? 'btn-line' : 'item-use-btn') + '" id="whRemoveBtn" data-uid="' + uid + '">' + escapeHtml(labels.remove) + '</button>';
    if (groups.length > 1) {
      html += '<button class="' + (isMinimal ? 'btn-line' : 'item-warehouse-btn') + '" id="whTransferBtn" data-uid="' + uid + '">转移</button>';
    }
    html += '<button class="' + (isMinimal ? 'btn-line item-discard-btn' : 'item-discard-btn') + '" id="whDiscardBtn" data-uid="' + uid + '">' + escapeHtml(labels.discard) + '</button>';
    html += '</div>';
    html += '</div></div>';

    if (isMinimal) syncDarkClassMinimal(overlay);
    else syncDarkClass(overlay);
    overlay.innerHTML = html;
    overlay.onclick = async function (e) {
      if (popupDismissHit(e)) { dismissPopupShell(overlay); return; }
      const target = e.target as HTMLElement;
      if (target.id === 'panelBack') { await showWarehousePopup(style, itemGroupId); return; }
      if (target.id === 'whRemoveBtn') {
        if (await showConfirmDialog({ message: `确认取出「${name}」？`, okText: labels.remove })) {
          const ok = await removeFromWarehouse(uid);
          if (ok) {
            getToastr()?.success(`物品已取出`, style === 'ancient' ? '随身提示' : '物品系统提示');
            await showWarehousePopup(style, itemGroupId);
          } else {
            getToastr()?.error('操作失败', '仓库提示');
          }
        }
        return;
      }
      if (target.id === 'whTransferBtn') {
        const others = warehouseGroupOptions(groups, items, itemGroupId);
        const pick = await showWarehouseTargetDialog({
          title: '转移物品',
          message: `${name} ×${qty || '1'}`,
          groups: others,
          selectedId: others[0]?.id,
          allowCopy: false,
          okText: '转移',
          note: '转移只在仓库分组之间移动，不会回到' + labels.inventory + '。',
        });
        if (!pick) return;
        const targetGroup = groups.find(groupItem => groupItem.id === pick.groupId);
        const ok = await moveWarehouseItems([uid], pick.groupId);
        if (ok) {
          getToastr()?.success(`已转移到「${targetGroup?.name || ''}」`, '仓库提示');
          await showWarehousePopup(style, itemGroupId);
        } else {
          getToastr()?.error('转移失败，请重试', '仓库提示');
        }
        return;
      }
      if (target.id === 'whDiscardBtn') {
        if (await showConfirmDialog({ message: `确认${labels.discard}「${name}」？`, okText: labels.discard, danger: true })) {
          const ok = await deleteFromWarehouse(uid);
          if (ok) {
            getToastr()?.success(`物品已${labels.discard}`, style === 'ancient' ? '随身提示' : '物品系统提示');
            try { (window as any).__ubEmitAchievement?.('item_discard', {}); } catch (_e) { /* ignore */ }
            await showWarehousePopup(style, itemGroupId);
          } else {
            getToastr()?.error('操作失败', '仓库提示');
          }
        }
      }
    };
  });
}

// ===== 日记弹窗 =====


export function showDiaryPopup(charName: string, style: StyleType): void {
  const overlay = document.getElementById('panelOverlay')!;
  const sheet = getSheetByName('恋爱日记表');
  const count = sheet ? (sheet.content.length - 1) : 0;
  const diaries: { row: number; time: string; content: string }[] = [];

  if (count > 0) {
    for (let i = 1; i <= count; i++) {
      const writer = getCellByHeader('恋爱日记表', i, '写作角色');
      if (writer === charName) {
        diaries.push({
          row: i,
          time: getCellByHeader('恋爱日记表', i, '发生时间') || '',
          content: getCellByHeader('恋爱日记表', i, '日记内容') || '',
        });
      }
    }
  }

  const isMinimal = style === 'minimal';
  let html = '<div class="' + (style === 'bridge' ? bridgeWindowClass('diary','m') : 'panel-popup ub-popup--m') + '">';
  html += '<div class="panel-popup-head"><div class="panel-popup-title">' + escapeHtml(charName) + (style === 'ancient' ? ' 的情笺' : style === 'bridge' ? ' 的人员日志' : ' 的恋爱日记') + '</div><button class="panel-popup-close" id="panelClose">&times;</button></div>';
  html += '<div class="panel-popup-body">';
  if (diaries.length === 0) {
    html += '<div class="panel-empty">' + (style === 'ancient' ? '暂无情笺' : '暂无恋爱日记') + '</div>';
  } else {
    for (let j = diaries.length - 1; j >= 0; j--) {
      const d = diaries[j];
      html += '<div class="diary-list-item" data-row="' + d.row + '">';
      html += '<div class="diary-item-top"><span class="diary-time">' + escapeHtml(d.time) + '</span></div>';
      const plainText = diaryPlainText(d.content);
      html += '<div class="diary-item-content">' + escapeHtml(plainText.length > 60 ? plainText.substring(0, 60) + '...' : plainText) + '</div>';
      html += '</div>';
    }
  }
  html += '</div></div>';

  if (isMinimal) syncDarkClassMinimal(overlay);
  else syncDarkClass(overlay);
  overlay.innerHTML = html;
  markPopupShown();
  overlay.classList.add('show');
  (overlay as any)._charName = charName;
  recallPopupScroll(overlay, 'diary');
  overlay.onclick = function (e) {
    if (popupDismissHit(e)) { dismissPopupShell(overlay); return; }
    const item = (e.target as HTMLElement).closest('.diary-list-item');
    if (item) {
      const row = parseInt((item as HTMLElement).dataset.row!);
      rememberPopupScroll(overlay, 'diary');
      showDiaryDetail(row, style);
    }
  };
}

export function showDiaryDetail(row: number, style: StyleType, animate = false): void {
  const overlay = document.getElementById('panelOverlay')!;
  const charName = (overlay as any)._charName || '';

  // 该角色全部日记行（行序 = 时间序，与列表弹窗一致）
  const sheet = getSheetByName('恋爱日记表');
  const writerOf = getCellByHeader('恋爱日记表', row, '写作角色') || '';
  const rows: number[] = [];
  if (sheet) {
    for (let i = 1; i < sheet.content.length; i++) {
      if (getCellByHeader('恋爱日记表', i, '写作角色') === writerOf) rows.push(i);
    }
  }
  if (rows.length === 0) { showDiaryPopup(charName, style); return; }
  // 当前行已被删则跳到最早一篇
  const cur = Math.max(rows.indexOf(row), 0);
  const curRow = rows[cur];
  const writer = getCellByHeader('恋爱日记表', curRow, '写作角色') || '';
  const content = getCellByHeader('恋爱日记表', curRow, '日记内容') || '';
  const time = getCellByHeader('恋爱日记表', curRow, '发生时间') || '';
  const isMinimal = style === 'minimal';
  const hasNav = rows.length > 1;

  let html = '<div class="' + (style === 'bridge' ? bridgeWindowClass('diary','l') + ' diary-detail-popup' : 'panel-popup diary-detail-popup ub-popup--l') + '">';
  html += '<div class="panel-popup-head"><button class="panel-popup-back" id="panelBack">← 返回</button><div class="panel-popup-title">恋爱日记</div><button class="panel-popup-close" id="panelClose">&times;</button></div>';
  html += '<div class="panel-popup-body' + (animate ? ' diary-detail-fade' : '') + '">';
  html += '<div class="diary-detail-writer">';
  if (hasNav) html += '<button class="diary-nav-btn diary-nav-prev" data-dir="-1"' + (cur === 0 ? ' disabled' : '') + '>◀</button>';
  html += '<span>' + escapeHtml(writer) + (style === 'ancient' ? ' 的手记' : ' 的日记') + '</span>';
  if (hasNav) html += '<button class="diary-nav-btn diary-nav-next" data-dir="1"' + (cur === rows.length - 1 ? ' disabled' : '') + '>▶</button>';
  html += '</div>';
  html += detailRow('时间', time, isMinimal);
  html += '<div class="diary-notebook"><div class="diary-notebook-lines"></div><div class="diary-content"><p class="dc">' + sanitizeDiaryHtml(content) + '</p></div></div>';
  if (hasNav) html += '<div class="diary-nav-indicator">第 ' + (cur + 1) + ' 篇 / 共 ' + rows.length + ' 篇</div>';
  html += '</div></div>';

  overlay.innerHTML = html;
  overlay.onclick = function (e) {
    if (popupDismissHit(e)) { dismissPopupShell(overlay); return; }
    if ((e.target as HTMLElement).id === 'panelBack') { showDiaryPopup(charName, style); return; }
    const nav = (e.target as HTMLElement).closest('.diary-nav-btn');
    if (nav && !(nav as HTMLButtonElement).disabled) {
      const dir = parseInt((nav as HTMLElement).dataset.dir!);
      const next = rows[cur + dir];
      if (next !== undefined) showDiaryDetail(next, style, true);
    }
  };
}

// ===== 任务弹窗 =====
export function showMissionPopup(style: StyleType): void {
  const overlay = document.getElementById('panelOverlay')!;
  const isMinimal = style === 'minimal';
  const bodyHtml = buildMissionBodyHtml(style);

  // 已开着同一弹窗 → 只换数据容器（保留壳/头），滚动保持；onclick 委托在 overlay 上不受影响
  if (isPopupOpen(overlay, 'mission')) {
    replacePopupBody(overlay, 'panel-popup-body', bodyHtml, { preserveScroll: true });
    applyNewHighlights(overlay, 'mission', style);
    return;
  }

  let html = '<div class="' + (style === 'bridge' ? bridgeWindowClass('mission','m') : 'panel-popup ub-popup--m') + '" data-popup="mission">';
  html += '<div class="panel-popup-head"><div class="panel-popup-title">' + (style === 'ancient' ? '差事' : style === 'bridge' ? '任务队列' : '瑟瑟任务') + '</div><button class="panel-popup-close" id="panelClose">&times;</button></div>';
  html += '<div class="panel-popup-body">' + bodyHtml + '</div></div>';

  if (isMinimal) syncDarkClassMinimal(overlay);
  else syncDarkClass(overlay);
  overlay.innerHTML = html;
  applyNewHighlights(overlay, 'mission', style);
  markPopupShown();
  overlay.classList.add('show');
  overlay.onclick = async function (e) {
    if (popupDismissHit(e)) { dismissPopupShell(overlay); return; }

    const descEl = (e.target as HTMLElement).closest('.mission-desc-clickable');
    if (descEl) {
      e.stopPropagation();
      appendMessageToChat((descEl as HTMLElement).dataset.desc!);
      getToastr()?.success('已放入输入框', style === 'ancient' ? '差事提示' : '任务系统提示');
      return;
    }

    const deleteBtn = (e.target as HTMLElement).closest('.mission-delete');
    if (deleteBtn) {
      const rowIdx = parseInt((deleteBtn as HTMLElement).dataset.row!);
      if (!await showConfirmDialog({ message: style === 'ancient' ? '确认销去此差事？销去后不可恢复。' : '确认删除该任务？删除后不可恢复。', okText: style === 'ancient' ? '销去' : '删除', danger: true })) return;
      const result = await deleteContentRowSqlFirstDetailed('瑟瑟任务表', rowIdx);
      if (!result.ok) {
        getToastr()?.error(result.failure.message,
          style === 'ancient' ? '差事提示' : '任务系统提示');
        return;
      }
      getToastr()?.success(style === 'ancient' ? '差事已销去' : '任务已删除',
        style === 'ancient' ? '差事提示' : '任务系统提示');
      try { (window as any).__ubEmitAchievement?.('mission_delete', {}); } catch (_e) { /* ignore */ }
      showMissionPopup(style);
      return;
    }

    const statusEl = (e.target as HTMLElement).closest('.mission-status');
    if (statusEl) {
      const row = parseInt((statusEl!.closest('.mission-list-item') as HTMLElement).dataset.row!);
      const status = getCellByHeader('瑟瑟任务表', row, '完成情况');
      if (status === '已完成') {
        settleMission(row, style);
      } else {
        if (await showConfirmDialog({ message: style === 'ancient' ? '是否确认此差事已了结并结算？' : '是否确认当前任务已完成并结算？' })) {
          settleMission(row, style);
        }
      }
      return;
    }
  };
}

/** 瑟瑟任务列表 body 内容（空态或条目列表）。 */
function buildMissionBodyHtml(style: StyleType): string {
  const sheet = getSheetByName('瑟瑟任务表');
  const count = sheet ? Math.max(0, sheet.content.length - 1) : 0;
  let html = '';
  if (count === 0) {
    html += '<div class="panel-empty">' + (style === 'ancient' ? '暂无差事' : '暂无任务') + '</div>';
  } else {
    for (let i = 1; i <= count; i++) {
      const name = getCellByHeader('瑟瑟任务表', i, '任务名称') || '未命名';
      const desc = getCellByHeader('瑟瑟任务表', i, '任务描述') || '';
      const objective = getCellByHeader('瑟瑟任务表', i, '任务目标') || '';
      const status = getCellByHeader('瑟瑟任务表', i, '完成情况') || '未完成';
      const isCompleted = status === '已完成';
      html += '<div class="mission-list-item ' + (isCompleted ? 'completed' : '') + '" data-row="' + i + '">';
      html += '<button class="mission-delete" data-row="' + i + '">&times;</button>';
      html += '<div class="mission-name">' + escapeHtml(name) + '</div>';
      if (desc) html += '<div class="mission-desc mission-desc-clickable" data-desc="' + escapeHtmlAttr(desc) + '">' + escapeHtml(desc) + '</div>';
      if (objective) html += '<div class="mission-objective">' + escapeHtml(objective) + '</div>';
      html += '<div class="mission-status ' + (isCompleted ? 'completed' : 'pending') + '">' + (isCompleted ? (style === 'ancient' ? '已了结 ✓' : '已完成 ✓') : (style === 'ancient' ? '未了结' : '未完成')) + '</div>';
      html += '</div>';
    }
  }
  return html;
}

async function settleMission(rowIndex: number, style: StyleType): Promise<void> {
  const api = getAutoCardAPI();
  if (!api) {
    getToastr()?.error('结算失败，API 不可用',
      style === 'ancient' ? '差事提示' : '任务系统提示');
    return;
  }
  invalidateCache();
  // 奖励 2-8 点随机，10% 概率暴击翻倍
  const baseGain = 2 + Math.floor(Math.random() * 7);
  const isCrit = Math.random() < 0.1;
  const gain = isCrit ? baseGain * 2 : baseGain;
  readSerseEnergy(); // U31：统一出口（保持打点前的强制读缓存口径）
  // 读取任务行的 row_id（content[rowIndex][0]，首列为 row_id 主键）
  const missionSheet = getSheetByName('瑟瑟任务表');
  const missionRowIdRaw = missionSheet?.content?.[rowIndex]?.[0];
  const missionRowId = parseInt(String(missionRowIdRaw ?? '')) || 0;

  // 批量写入：加能量 + 删任务（结构化入队，flush 单次 SQL 批量；失败整体失败，无原生回退）
  const ops: DbWriteOp[] = [
    serseIncrementOp(gain), // U31：统一出口（增量写：并发下不丢入账）
  ];
  if (missionRowId > 0) {
    ops.push({ kind: 'deleteRow', tableName: '瑟瑟任务表', rowId: missionRowId });
  }
  const batchOk = await runDbBatch(ops);
  if (!batchOk) {
    getToastr()?.error('结算失败，瑟瑟能量更新失败',
      style === 'ancient' ? '差事提示' : '任务系统提示');
    return;
  }
  // 成就打点：累计获得瑟瑟能量（2-8 随机，10% 暴击翻倍）
  try { (window as any).__ubEmitAchievement?.('energy_gain', { amount: gain }); } catch (_e) { /* ignore */ }
  const settleText = style === 'ancient' ? '差事已了结' : '任务已结算删除';
  if (isCrit) {
    getToastr()?.success('★暴击！瑟瑟能量+' + gain + '（' + baseGain + ' 点×2），' + settleText,
      style === 'ancient' ? '差事暴击' : '暴击结算');
  } else {
    getToastr()?.success('瑟瑟能量+' + gain + '，' + settleText,
      style === 'ancient' ? '差事提示' : '任务系统提示');
  }
  try { (window as any).__ubEmitAchievement?.('mission_done', {}); } catch (_e) { /* ignore */ }
  try { (window as any).__ubEmitAchievement?.('action-on-date', { action: 'mission_done' }); } catch (_e) { /* ignore */ }
  showMissionPopup(style);
}

// ===== 过往经历弹窗 =====
export function showPastExperiencePopup(charName: string, style: StyleType, onClosed?: () => void): void {
  const overlay = document.getElementById('panelOverlay')!;
  const isMinimal = style === 'minimal';

  const pastExp = readCharPastExp(charName);

  if (!pastExp) return;

  // 解析为时间轴 HTML（解析失败则退化为仅背景介绍块，不渲染空时间轴）。
  const html = buildPastExperienceHTML(charName, style, pastExp);

  // 成就打点：查阅恋爱对象过往经历。
  try { (window as any).__ubEmitAchievement?.('past_experience_viewed', {}); } catch (e) { /* ignore */ }

  if (isMinimal) syncDarkClassMinimal(overlay);
  else syncDarkClass(overlay);
  overlay.innerHTML = html;
  markPopupShown();
  overlay.classList.add('show');
  overlay.onclick = function (e) {
    if (popupDismissHit(e)) { dismissPopupShell(overlay, onClosed); return; }
  };
}

// ===== 大调查弹窗 =====
export async function showInvestigationPopup(charName: string, style: StyleType, btnElement?: HTMLButtonElement, extraPrompt?: string, continueRef?: InvestigationContinueRef, onClosed?: () => void): Promise<void> {
  const hasExtra = !!(extraPrompt && extraPrompt.trim());
  const has = await hasInvestigation(charName);
  // 无档案 → 生成新的；有档案 + 长按带额外提示词 → 重新生成；接续模式 → 强制生成；有档案 + 短按 → 直接展示既有档案
  if (!has || hasExtra || continueRef) {
    const content = await performInvestigation(charName, btnElement, extraPrompt, continueRef);
    if (content) {
      await showInvestigationContent(charName, style, undefined, onClosed);
    } else if (onClosed) {
      onClosed();
    }
    return;
  }

  // 有档案，展示
  await showInvestigationContent(charName, style, undefined, onClosed);
}

/** 大调查长按弹框：输入额外提示词 + 可选接续往期调查后发起（均不持久化，仅本次生效） */
export async function showInvestigationExtraPromptDialog(charName: string, style: StyleType, btnElement: HTMLButtonElement, onClosed?: () => void): Promise<void> {
  const overlay = document.getElementById('panelOverlay')!;
  const safeName = escapeHtml(charName);

  // 接续往期调查状态（每次打开重置：默认关、不预选）
  let continueMode = false;
  let continueSelected: number | null = null;
  const pastDossiers = await getInvestigationHistory(charName);
  const dialogClass = style === 'bridge' ? bridgeWindowClass('guidance') : 'panel-popup';
  const cachedExtra = readExtraPromptCache(EXTRA_PROMPT_CACHE_KEYS.investigation);
  let firstRender = true;

  const escIv = (s: string): string => escapeHtml(s);

  const updateOkState = (): void => {
    const $input = $(overlay).find('#ivExtraInput');
    const hasText = !!($input.val() as string || '').trim();
    const hasBaseline = continueMode && continueSelected !== null;
    $(overlay).find('#ivExtraOk').prop('disabled', !(hasText || hasBaseline));
  };

  const render = (): void => {
    // 保留 textarea 当前值与滚动位置；首次打开时预填上次长按确认的额外要求
    const $existing = $(overlay).find('#ivExtraInput');
    const prevVal = $existing.length ? (($existing.val() as string) || '') : (firstRender ? cachedExtra : '');
    const prevScroll = $existing.length ? ($existing[0] as HTMLTextAreaElement).scrollTop : 0;

    const continueListHtml = (() => {
      if (!continueMode) return '';
      if (pastDossiers.length === 0) {
        return '<div class="iv-cont-empty">该角色暂无往期调查可接续</div>';
      }
      const items: string[] = [];
      for (let i = pastDossiers.length - 1; i >= 0; i--) {
        const d = pastDossiers[i];
        const shortTime = d.timestamp.length > 14 ? d.timestamp.slice(-14) : d.timestamp;
        const sel = continueSelected === i;
        items.push(
          '<div class="iv-cont-sel-item' + (sel ? ' sel' : '') + '" data-iv-cont-index="' + i + '">'
          + '<div class="iv-cont-radio"></div>'
          + '<span class="iv-cont-sel-time">' + escIv(shortTime) + '</span>'
          + (sel ? '<span class="iv-cont-sel-tag">基线</span>' : '')
          + '</div>'
        );
      }
      return '<div class="iv-cont-sel-list">' + items.join('') + '</div>'
        + '<div class="iv-cont-foot"><span class="iv-cont-warn">' + ubIcon('warning') + ' 基线全文注入 / AI 只出变化+新增</span></div>';
    })();

    const toggleCopy = continueMode
      ? '<b>开 · ' + (continueSelected !== null ? '已选基线' : '请选择基线') + '</b><br>将在所选往期档案基础上，结合当前剧情变化生成增量档案；AI 只输出变化字段+新增内容，合并入基线。'
      : '<b>关 · 独立新卷</b><br>开启后可选择一份往期档案作基线，AI 只输出变化与新增内容，合并生成演进后的新档案。';

    const btnLabel = (continueMode && continueSelected !== null) ? '开始接续调查 →' : '开始调查';

    // 复用 portrait-base.ts 已有 CSS 类（.portrait-gen-textarea / .portrait-gen-btn-primary 等），
    // 这些类用 var(--card-bg) / var(--text) / var(--divider) 等在 5 主题浅色/深色模式均有定义的变量。
    const html =
      '<div class="' + dialogClass + ' portrait-popup portrait-gen-wrap" style="max-width:520px;">' +
        '<div class="portrait-popup-header">' +
            '<span class="portrait-popup-title">额外调查要求 — ' + safeName + '</span>' +
            '<span class="portrait-popup-close" id="ivExtraClose">' + ubIcon('close') + '</span>' +
          '</div>' +
          '<div class="portrait-gen-field">' +
            '<div class="portrait-gen-label">补充对本角色的额外要求（仅本次调查生效，不保存）</div>' +
            '<textarea class="portrait-gen-textarea" id="ivExtraInput" rows="5" ' +
              'style="min-height:110px;resize:vertical;line-height:1.6;" ' +
              'placeholder="例如：&#10;· 要求古风写作风格&#10;· 侧重心理描写&#10;· 增加某段特殊经历的描述"></textarea>' +
          '</div>' +
          '<div class="iv-cont-section">' +
            '<div class="iv-cont-section-title">接续往期调查 <small>仅本次生效</small></div>' +
            '<div class="iv-cont-toggle-row">' +
              '<button class="iv-cont-toggle' + (continueMode ? ' on' : '') + '" data-iv-cont-action="toggle" type="button" aria-label="接续往期调查开关"></button>' +
              '<div class="iv-cont-toggle-copy">' + toggleCopy + '</div>' +
            '</div>' +
            continueListHtml +
          '</div>' +
          '<div class="portrait-gen-btns">' +
            '<button class="portrait-gen-btn-cancel" id="ivExtraCancel">取消</button>' +
            '<button class="portrait-gen-btn-primary" id="ivExtraOk">' + btnLabel + '</button>' +
          '</div>' +
      '</div>';

    overlay.innerHTML = html;
    if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
    markPopupShown();
    overlay.classList.add('show');

    // 回填 textarea 值与滚动
    const $input = $(overlay).find('#ivExtraInput');
    if (prevVal && $input.length) {
      ($input[0] as HTMLTextAreaElement).value = prevVal;
      ($input[0] as HTMLTextAreaElement).scrollTop = prevScroll;
    }
    updateOkState();
    firstRender = false;
  };

  render();

  const $o = $(overlay);
  // 关闭时清理常驻 #panelOverlay 上的命名空间事件，防止残留 handler 在其他弹窗点击遮罩时误触发旧闭包
  const close = (): void => { $o.off('.ivExtra .ivExtraClick'); if (onClosed) onClosed(); else closePanelOverlay(overlay); };

  // 输入变化更新启用态
  $o.off('.ivExtra').on('input.ivExtra', '#ivExtraInput', function () { updateOkState(); });

  // 委托点击：遮罩 / 开关 / 列表项 / 关闭 / 确认
  $o.off('.ivExtraClick').on('click.ivExtraClick', function (e) {
    const target = e.target as HTMLElement;
    if (target === overlay) { if (guardGhostClick()) return; close(); return; }
    const toggle = target.closest('[data-iv-cont-action="toggle"]');
    if (toggle) {
      continueMode = !continueMode;
      if (!continueMode) continueSelected = null;
      render();
      return;
    }
    const item = target.closest('[data-iv-cont-index]') as HTMLElement | null;
    if (item) {
      const idx = parseInt(item.dataset.ivContIndex || '', 10);
      if (!Number.isNaN(idx)) {
        continueSelected = (continueSelected === idx) ? null : idx;
        render();
      }
      return;
    }
    if (target.id === 'ivExtraClose' || target.id === 'ivExtraCancel') { if (guardGhostClick()) return; close(); return; }
    if (target.id === 'ivExtraOk') {
      if (guardGhostClick()) return;
      const val = ($o.find('#ivExtraInput').val() as string || '').trim();
      const hasText = !!val;
      const hasBaseline = continueMode && continueSelected !== null;
      if (!hasText && !hasBaseline) return;
      const continueRef: InvestigationContinueRef | undefined = hasBaseline && continueSelected !== null
        ? { content: pastDossiers[continueSelected].content, timestamp: pastDossiers[continueSelected].timestamp }
        : undefined;
      writeExtraPromptCache(EXTRA_PROMPT_CACHE_KEYS.investigation, val);
      $o.off('.ivExtra .ivExtraClick');
      closePanelOverlay(overlay);
      void showInvestigationPopup(charName, style, btnElement, hasText ? val : undefined, continueRef, onClosed);
      return;
    }
  });

  // 自动聚焦输入框
  setTimeout(() => { $(overlay).find('#ivExtraInput').trigger('focus'); }, 50);
}

/** 瑟瑟指导长按弹框：输入额外指导要求（5 个固定预设点击覆盖填入），确认后回调 onConfirm(extraPrompt)。
 *  样式用 base.ts 常驻 .ub-nsfw-extra-* CSS，不依赖立绘开关（portrait-base 随 portraitEnabled 注入/移除）。 */
export function showNsfwGuidanceExtraPromptDialog(onConfirm: (extraPrompt: string) => void): void {
  const overlay = document.getElementById('panelOverlay')!;
  const style = getConfig().style;
  const cached = readExtraPromptCache(EXTRA_PROMPT_CACHE_KEYS.nsfwGuidance);
  const dialogClass = style === 'bridge' ? bridgeWindowClass('guidance') : 'panel-popup';

  const presetBtns = NSFW_GUIDANCE_PRESETS.map(p =>
    '<button type="button" class="ub-nsfw-extra-preset-btn" data-nsfw-preset="' + escapeHtmlAttr(p.key) + '">' + escapeHtml(p.label) + '</button>'
  ).join('');

  const html =
    '<div class="' + dialogClass + ' ub-nsfw-extra-dialog">' +
      '<div class="ub-nsfw-extra-head">' +
        '<span class="ub-nsfw-extra-title">额外指导要求</span>' +
        '<button type="button" class="ub-nsfw-extra-close" id="nsfwExtraClose" aria-label="关闭">' + ubIcon('close') + '</button>' +
      '</div>' +
      '<div class="ub-nsfw-extra-sub">补充本次瑟瑟指导的额外要求（仅本次生效，不保存）。长按才带额外要求，短按直接生成不带。</div>' +
      '<div class="ub-nsfw-extra-presets">' + presetBtns + '</div>' +
      '<div class="ub-nsfw-extra-field">' +
        '<textarea class="ub-nsfw-extra-textarea" id="nsfwExtraInput" rows="5" placeholder="例如：&#10;· 侧重与某角色的互动&#10;· 指定某种叙事风格&#10;· 提出具体的发展方向"></textarea>' +
      '</div>' +
      '<div class="ub-nsfw-extra-btns">' +
        '<button type="button" class="ub-nsfw-extra-btn" id="nsfwExtraCancel">取消</button>' +
        '<button type="button" class="ub-nsfw-extra-btn ub-nsfw-extra-btn-primary" id="nsfwExtraOk" disabled>开始生成</button>' +
      '</div>' +
    '</div>';

  overlay.innerHTML = html;
  if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  markPopupShown();
  overlay.classList.add('show');

  const input = document.getElementById('nsfwExtraInput') as HTMLTextAreaElement | null;
  const okBtn = document.getElementById('nsfwExtraOk') as HTMLButtonElement | null;
  const close = (): void => closePanelOverlay(overlay);
  const updateOk = (): void => { if (okBtn) okBtn.disabled = !((input?.value || '').trim()); };

  if (input && cached) { input.value = cached; updateOk(); }
  if (input) input.addEventListener('input', updateOk);

  // 预设按钮：点击覆盖替换 textarea 内容（可继续编辑）
  overlay.querySelectorAll<HTMLButtonElement>('[data-nsfw-preset]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const preset = NSFW_GUIDANCE_PRESETS.find(p => p.key === btn.dataset.nsfwPreset);
      if (input && preset) { input.value = preset.text; updateOk(); }
    });
  });

  overlay.onclick = function (e) {
    const target = e.target as HTMLElement;
    if (target === overlay) { if (guardGhostClick()) return; close(); return; }
    if (target.id === 'nsfwExtraClose' || target.id === 'nsfwExtraCancel') { if (guardGhostClick()) return; close(); return; }
    if (target.id === 'nsfwExtraOk') {
      if (guardGhostClick()) return;
      const val = (input?.value || '').trim();
      if (!val) return;
      writeExtraPromptCache(EXTRA_PROMPT_CACHE_KEYS.nsfwGuidance, val);
      close();
      onConfirm(val);
    }
  };

  setTimeout(() => { try { input?.focus(); } catch (_e) { /* ignore */ } }, 50);
}

/** 生成大调查历史列表HTML */
function buildInvestigationHistoryList(history: DossierEntry[], style: StyleType, activeIndex?: number): string {
  if (history.length === 0) return '';

  let html = '<div class="iv-hist-topbar"><span class="iv-hist-title">' + (style === 'ancient' ? '过往卷宗' : style === 'xianxia' ? '往昔仙籍' : style === 'flirtatious' ? 'NEON_LOG' : style === 'sweet' ? '情书记录' : style === 'bridge' ? '航行档案' : '历史档案') + '</span></div>';

  for (let i = history.length - 1; i >= 0; i--) {
    const d = history[i];
    const isActive = activeIndex === i || (activeIndex === undefined && i === history.length - 1);
    const shortTime = d.timestamp.length > 14 ? d.timestamp.slice(-14) : d.timestamp;
    html += '<div class="iv-hist-item' + (isActive ? ' active' : '') + '" data-idx="' + i + '">';
    html += '<span class="iv-hist-time">' + escapeHtml(shortTime) + '</span>';
    html += '<button class="iv-hist-del" data-idx="' + i + '" title="删除">×</button>';
    html += '</div>';
  }
  return html;
}

/** 计算字号步进后的新倍率：dec/inc 每步 0.1，reset 回到 1；钳制到 [0.9, 1.5] 并圆整到 0.1。 */
function nextFontScale(cur: number, action: 'dec' | 'inc' | 'reset'): number {
  if (action === 'reset') return 1;
  const raw = action === 'dec' ? cur - 0.1 : cur + 0.1;
  const clamped = Math.min(1.5, Math.max(0.9, raw));
  return Math.round(clamped * 10) / 10;
}

/** 回填字号读数与三按钮 disabled 态；选择器兼容大调查(.iv-*)与大采访(.itv-*)两套前缀。 */
function applyFontScaleUI(overlay: HTMLElement, scale: number): void {
  const valEl = overlay.querySelector<HTMLElement>('.iv-font-val, .itv-font-val');
  if (valEl) valEl.textContent = Math.round(scale * 100) + '%';
  const dec = overlay.querySelectorAll<HTMLButtonElement>('[data-iv-font="dec"], [data-itv-content-action="font-dec"]');
  const inc = overlay.querySelectorAll<HTMLButtonElement>('[data-iv-font="inc"], [data-itv-content-action="font-inc"]');
  const reset = overlay.querySelectorAll<HTMLButtonElement>('[data-iv-font="reset"], [data-itv-content-action="font-reset"]');
  dec.forEach(b => { b.disabled = scale <= 0.9; });
  inc.forEach(b => { b.disabled = scale >= 1.5; });
  reset.forEach(b => { b.disabled = scale === 1; });
}

/** 原始文本「编辑」按钮的随主题文案 */
function rawEditLabel(style: StyleType): string {
  return style === 'ancient' ? '改卷' : style === 'xianxia' ? '改录' : style === 'flirtatious' ? 'EDIT' : style === 'sweet' ? '修改' : style === 'bridge' ? '改记' : '编辑';
}

/** 大调查/大采访「编辑当前条目」弹窗标题的随主题前缀 */
function rawEditTitlePrefix(style: StyleType): string {
  return style === 'ancient' ? '编辑卷宗 · ' : style === 'xianxia' ? '编辑仙籍 · ' : style === 'flirtatious' ? 'EDIT DOSSIER · ' : style === 'sweet' ? '修改情书 · ' : style === 'bridge' ? '改记 · ' : '编辑档案 · ';
}

let archiveExportBusy = false;

// 暂时关闭大调查/大采访的「导出 ▾」入口——PNG 管线仍需调整，先不向用户暴露。
// 恢复时把 ARCHIVE_EXPORT_ENABLED 改回 true 即可，菜单 HTML 与事件处理逻辑均原样保留。
const ARCHIVE_EXPORT_ENABLED = false;

function archiveExportMenuHtml(kind: ArchiveKind, buttonClass: string): string {
  if (!ARCHIVE_EXPORT_ENABLED) return '';
  return '<span class="archive-export-control">'
    + '<button type="button" class="' + buttonClass + ' archive-export-trigger" data-archive-export-trigger="' + kind + '" aria-label="导出当前档案" aria-expanded="false">'
    + '<span class="archive-export-label">导出</span><span class="archive-export-icon" aria-hidden="true">⇩</span><span class="archive-export-caret" aria-hidden="true">⌄</span></button>'
    + '<span class="archive-export-menu" role="menu">'
    + '<button type="button" data-archive-export-format="html" role="menuitem">网页 HTML</button>'
    + '<button type="button" data-archive-export-format="png" role="menuitem">长图 PNG（过长自动分段）</button>'
    + '</span></span>';
}

function closeArchiveExportMenus(overlay: HTMLElement): void {
  overlay.querySelectorAll<HTMLElement>('.archive-export-control.open').forEach(control => control.classList.remove('open'));
  overlay.querySelectorAll<HTMLElement>('[data-archive-export-trigger]').forEach(button => button.setAttribute('aria-expanded', 'false'));
}

function toggleArchiveExportMenu(trigger: HTMLElement): void {
  const control = trigger.closest<HTMLElement>('.archive-export-control');
  if (!control || archiveExportBusy) return;
  const open = !control.classList.contains('open');
  control.closest('.panel-overlay')?.querySelectorAll<HTMLElement>('.archive-export-control.open').forEach(item => item.classList.remove('open'));
  control.classList.toggle('open', open);
  trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
}

interface PopupArchiveExportInput {
  overlay: HTMLElement;
  kind: ArchiveKind;
  format: ArchiveExportFormat;
  characterName: string;
  timestamp: string;
  style: StyleType;
  fontScale: number;
  sourceElement: HTMLElement | null;
}

async function runPopupArchiveExport(input: PopupArchiveExportInput): Promise<void> {
  if (archiveExportBusy) return;
  if (!input.sourceElement) {
    getToastr()?.error('当前档案尚未加载，无法导出', '档案导出');
    return;
  }
  archiveExportBusy = true;
  const trigger = input.overlay.querySelector<HTMLButtonElement>('[data-archive-export-trigger="' + input.kind + '"]');
  const options = input.overlay.querySelectorAll<HTMLButtonElement>('[data-archive-export-format]');
  const originalHtml = trigger?.innerHTML || '';
  if (trigger) {
    trigger.disabled = true;
    trigger.textContent = '导出中…';
  }
  options.forEach(option => { option.disabled = true; });
  closeArchiveExportMenus(input.overlay);
  try {
    const result = await exportArchive({
      kind: input.kind,
      format: input.format,
      characterName: input.characterName,
      timestamp: input.timestamp,
      style: input.style,
      darkMode: input.overlay.classList.contains('dark') || document.body.classList.contains('dark-mode'),
      fontScale: input.fontScale,
      sourceElement: input.sourceElement,
    });
    try { (window as any).__ubEmitAchievement?.('archive_exported', { kind: input.kind, format: input.format }); } catch (_e) { /* ignore */ }
    const typeLabel = input.kind === 'investigation' ? '大调查' : '大采访';
    const exportedLabel = result.fileCount > 1 ? `${result.fileCount} 张分段 PNG` : result.filename;
    if (result.replacedImageCount > 0) {
      getToastr()?.warning(`已导出 ${exportedLabel}；${result.replacedImageCount} 张图片已替换为首字头像`, `${typeLabel}导出`);
    } else {
      getToastr()?.success(`已导出 ${exportedLabel}`, `${typeLabel}导出`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '导出失败，请稍后重试';
    getToastr()?.error(message, '档案导出');
  } finally {
    archiveExportBusy = false;
    if (trigger?.isConnected) {
      trigger.disabled = false;
      trigger.innerHTML = originalHtml;
    }
    options.forEach(option => { if (option.isConnected) option.disabled = false; });
  }
}

async function showInvestigationContent(charName: string, style: StyleType, dossierIndex?: number, onClosed?: () => void): Promise<void> {
  const overlay = document.getElementById('panelOverlay')!;

  const history = await getInvestigationHistory(charName);
  if (history.length === 0) {
    if (onClosed) onClosed(); else closePanelOverlay(overlay);
    return;
  }

  const idx = dossierIndex !== undefined ? dossierIndex : history.length - 1;
  const dossier = history[idx];
  if (!dossier) {
    if (onClosed) onClosed(); else closePanelOverlay(overlay);
    return;
  }

  const content = dossier.content;
  const safeName = escapeHtml(charName);
  const isInv = isInvestigating(charName);
  const beautifiedContent = content ? beautifyInvestigationContent(content, charName, style, isInv) : '';
  const historyItemsHTML = buildInvestigationHistoryList(history, style, idx);
  const hasHistory = !!historyItemsHTML;
  // 侧边栏折叠仅由用户点 ◀/▶ 控制；切换不同历史档案重渲时从持久化值恢复，不自动展开
  const sidebarCollapsed = getConfig().investigationSidebarCollapsed;

  const themeClass = 'iv-theme-' + style;
  const isMinimal = style === 'minimal';

  // 暗色模式：复用已有的 syncDarkClass 逻辑（与设置面板完全一致）
  if (isMinimal) {
    syncDarkClassMinimal(overlay);
  } else {
    syncDarkClass(overlay);
  }

  // 顶栏：角色名 + 折叠按钮 + 操作按钮 + 关闭
  const topBarLabel = style==='ancient'?'卷宗':style==='xianxia'?'玉简':style==='flirtatious'?'DOSSIER':style==='sweet'?'情书':style==='bridge'?'航行档案':'档案';
  let topBarHTML = '<div class="iv-top-bar iv-top-bar-' + style + '">';
  topBarHTML += '<span class="iv-top-name">' + safeName + '</span>';
  topBarHTML += '<span class="iv-top-label">' + topBarLabel + '</span>';
  topBarHTML += '<div class="iv-top-btns">';
  // 折叠按钮放在顶栏（有历史列表时显示）
  if (hasHistory) {
    topBarHTML += '<button class="iv-sidebar-toggle" title="' + (sidebarCollapsed ? '展开侧栏' : '折叠侧栏') + '">' + (sidebarCollapsed ? '▶' : '◀') + '</button>';
  }
  var regenLabel = isInv ? (style==='ancient'?'拟卷中...':style==='xianxia'?'推演中...':'调查中...') : (style==='ancient'?'再次拟卷':style==='xianxia'?'再次推演':'再次生成');
  topBarHTML += '<button class="iv-top-btn" id="investigationRegenerateBtn" data-name="' + safeName + '"' + (isInv?' disabled':'') + '>' + (isInv?'<span class="ub-busy-spin" aria-hidden="true"></span>':'') + regenLabel + '</button>';
  topBarHTML += helpTipButton('大调查功能说明：\\n【再次生成/拟卷/推演】重新让AI分析当前聊天内容并生成调查档案。每次调查会基于最近的聊天记录重新梳理情报。\\n【清除全部档案/焚毁卷宗/抹去天机】删除当前角色的所有历史调查记录，清空后不可恢复。\\n【加入世界书/入册/铭刻】把当前档案的部分模块写入角色世界书(角色定义前,角色名触发),让AI在涉及该角色时参考。\\n【折叠按钮 ◀】隐藏或显示左侧历史档案列表，方便在不同档案之间切换查看。\\n调查过程中按钮会显示"调查中..."并禁用，请等待AI回复完成后再操作。');
  topBarHTML += '<button class="iv-top-btn" id="investigationWorldbookBtn" data-name="' + safeName + '">' + (style==='ancient'?'入册':style==='xianxia'?'铭刻':style==='flirtatious'?'INJECT':style==='sweet'?'寄存':'加入世界书') + '</button>';
  topBarHTML += '<button class="iv-top-btn" id="investigationDeleteBtn" data-name="' + safeName + '">' + (style==='ancient'?'焚毁卷宗':style==='xianxia'?'抹去天机':style==='flirtatious'?'PURGE':'清除全部档案') + '</button>';
  topBarHTML += '<button class="iv-top-btn" id="investigationEditBtn" data-name="' + safeName + '"' + (isInv?' disabled':'') + '>' + rawEditLabel(style) + '</button>';
  topBarHTML += archiveExportMenuHtml('investigation', 'iv-top-btn');
  topBarHTML += '<span class="iv-font-scale"><button class="iv-top-btn" data-iv-font="dec" title="缩小字号">A-</button><span class="iv-font-val">100%</span><button class="iv-top-btn" data-iv-font="inc" title="放大字号">A+</button><button class="iv-top-btn" data-iv-font="reset" title="复位到100%">↺</button></span>';
  topBarHTML += '<button class="iv-top-close" id="panelClose">&times;</button>';
  topBarHTML += '</div></div>';

  // 构建完整弹窗：顶栏 + 历史列表(可折叠) + 档案内容
  let fullHTML = '<div class="investigation-popup ' + themeClass + '">';
  fullHTML += topBarHTML;
  fullHTML += '<div class="investigation-body">';
  if (hasHistory) {
    fullHTML += '<div class="iv-layout' + (sidebarCollapsed ? ' iv-collapsed' : '') + '">';
    fullHTML += '<div class="iv-hist-sidebar"><div class="iv-hist-list iv-hist-' + style + '">';
    fullHTML += historyItemsHTML;
    fullHTML += '</div></div>';
    fullHTML += '<div class="iv-main"><div class="iv-main-inner">' + beautifiedContent + '</div></div>';
    fullHTML += '</div>';
  } else {
    fullHTML += '<div class="iv-main-inner">' + beautifiedContent + '</div>';
  }
  fullHTML += '</div></div>';

  // 侧栏历史列表在整壳重建里被换新（元素一起换 ⇒ scrollTop 归零）：同一份档案内切条目/删条目时保位，
  // 换角色＝换主体则回顶。删条目导致列表变短时由浏览器夹紧。
  const restoreIvScroll = (overlay as any)._ivCharName === charName
    ? captureScroll(overlay, '.iv-hist-list')
    : null;
  overlay.innerHTML = fullHTML;
  restoreIvScroll?.();
  // 平板/窄屏适配：约束弹窗宽度不超过状态栏包裹器（避免内容超出状态栏边缘）
  var wrapper = document.getElementById('ac-statusbar-wrapper');
  var popup = overlay.querySelector('.investigation-popup') as HTMLElement;
  if (wrapper && popup) {
    var wrapperW = wrapper.offsetWidth;
    // 取状态栏宽度与 900px 中的较小值，留 16px 呼吸边距
    var maxW = Math.min(wrapperW - 16, 900);
    if (maxW > 320) popup.style.maxWidth = maxW + 'px';
  }
  // 字号缩放：读持久化倍率，应用于正文容器并回填顶栏读数与按钮 disabled 态
  const invFontScale = getConfig().investigationFontScale;
  const invContentEl = overlay.querySelector<HTMLElement>('.iv-main-inner');
  if (invContentEl) invContentEl.style.zoom = String(invFontScale);
  applyFontScaleUI(overlay, invFontScale);
  markPopupShown();
  overlay.classList.add('show');
  (overlay as any)._ivCharName = charName;
  (overlay as any)._ivStyle = style;
  (overlay as any)._ivIndex = idx;

  overlay.onclick = async function (e) {
    const target = e.target as HTMLElement;
    if (e.target === overlay || target.id === 'panelClose' || target.closest('.iv-top-close')) {
      if (guardGhostClick()) return;
      if (onClosed) onClosed(); else closePanelOverlay(overlay);
      return;
    }

    const archiveTrigger = target.closest<HTMLElement>('[data-archive-export-trigger="investigation"]');
    if (archiveTrigger) {
      toggleArchiveExportMenu(archiveTrigger);
      return;
    }
    const archiveOption = target.closest<HTMLElement>('[data-archive-export-format]');
    if (archiveOption) {
      const format = archiveOption.dataset.archiveExportFormat as ArchiveExportFormat;
      await runPopupArchiveExport({
        overlay,
        kind: 'investigation',
        format,
        characterName: charName,
        timestamp: dossier.timestamp,
        style,
        fontScale: getConfig().investigationFontScale,
        sourceElement: overlay.querySelector<HTMLElement>('.iv-main-inner'),
      });
      return;
    }
    closeArchiveExportMenus(overlay);

    // 字号缩放按钮（A- / A+ / ↺）— 即时更新 zoom + 读数 + 持久化，不重渲染弹窗
    const ivFontBtn = target.closest<HTMLElement>('[data-iv-font]');
    if (ivFontBtn) {
      const action = ivFontBtn.dataset.ivFont as 'dec' | 'inc' | 'reset';
      const cur = getConfig().investigationFontScale;
      const next = nextFontScale(cur, action);
      if (next !== cur) {
        const contentEl = overlay.querySelector<HTMLElement>('.iv-main-inner');
        if (contentEl) contentEl.style.zoom = String(next);
        applyFontScaleUI(overlay, next);
        setConfig('investigationFontScale', next);
      }
      return;
    }

    // 折叠/展开侧栏按钮（在顶栏中）
    if (target.closest('.iv-sidebar-toggle')) {
      const layout = overlay.querySelector('.iv-layout') as HTMLElement;
      if (layout) {
        const collapsed = layout.classList.toggle('iv-collapsed');
        const btn = target.closest('.iv-sidebar-toggle') as HTMLElement;
        if (btn) btn.innerHTML = collapsed ? '▶' : '◀';
        if (btn) btn.title = collapsed ? '展开侧栏' : '折叠侧栏';
        setConfig('investigationSidebarCollapsed', collapsed);
      }
      return;
    }

    // 历史列表删除按钮（必须在 .iv-hist-item 之前检查，因为 X 按钮在 .iv-hist-item 内部）
    const histDel = target.closest('.iv-hist-del');
    if (histDel) {
      const delIdx = parseInt((histDel as HTMLElement).dataset.idx!);
      if (!isNaN(delIdx)) {
        const confirmMsg = style === 'ancient' ? '确认删除此卷宗？' : style === 'xianxia' ? '确认抹去此天机推演？' : style === 'flirtatious' ? 'DELETE this log?' : style === 'sweet' ? '确认删除此情书？' : '确认删除此档案？';
        if (!await showConfirmDialog({ message: confirmMsg })) return;
        await deleteInvestigation(charName, delIdx);
        const remaining = await getInvestigationHistory(charName);
        if (remaining.length === 0) {
          if (onClosed) onClosed(); else closePanelOverlay(overlay);
          getToastr()?.success('档案已全部清除', '大调查提示');
        } else {
          const newIdx = Math.min(delIdx, remaining.length - 1);
          await showInvestigationContent(charName, style, newIdx, onClosed);
        }
      }
      return;
    }

    // 历史列表项点击
    const histItem = target.closest('.iv-hist-item');
    if (histItem) {
      const newIdx = parseInt((histItem as HTMLElement).dataset.idx!);
      if (!isNaN(newIdx) && newIdx !== (overlay as any)._ivIndex) {
        await showInvestigationContent(charName, style, newIdx, onClosed);
      }
      return;
    }

    // 再次生成按钮
    if (target.id === 'investigationRegenerateBtn') {
      const name = target.dataset.name!;
      if (isInvestigating(name)) return;
      // 显示加载状态，不关闭弹窗（F22：统一按钮自旋 + 禁用）
      const btn = target as HTMLButtonElement;
      const busyLabel = style === 'ancient' ? '拟卷中...' : style === 'xianxia' ? '推演中...' : '调查中...';
      setButtonBusy(btn, true, busyLabel);
      const newContent = await performInvestigation(name);
      if (newContent) {
        await showInvestigationContent(name, style, undefined, onClosed);
      } else {
        // 恢复按钮状态
        setButtonBusy(btn, false, '');
      }
      return;
    }

    // 加入世界书按钮
    if (target.id === 'investigationWorldbookBtn') {
      await openInvestigationWorldbookDialog(charName, dossier, style);
      return;
    }

    // 清除全部档案按钮
    if (target.id === 'investigationDeleteBtn') {
      const name = target.dataset.name!;
      if (await showConfirmDialog({ message: style === 'ancient' ? '确认焚毁此角色全部卷宗？' : style === 'xianxia' ? '确认抹去此角色全部天机推演？' : '确认清除此角色全部大调查档案？', okText: style === 'ancient' ? '焚毁' : style === 'xianxia' ? '抹去' : '清除', danger: true })) {
        await deleteInvestigation(name);
        getToastr()?.success('大调查档案已全部清除', '大调查提示');
        if (onClosed) onClosed(); else closePanelOverlay(overlay);
      }
      return;
    }

    // 编辑当前档案按钮（原始文本编辑器，保存后就地覆盖该条并重渲染）
    if (target.id === 'investigationEditBtn') {
      const name = target.dataset.name!;
      const idx = (overlay as any)._ivIndex as number;
      const entry = (await getInvestigationHistory(name))[idx];
      if (!entry) return;
      showRawTextEditor({
        title: rawEditTitlePrefix(style) + name,
        initialContent: entry.content,
        style,
        onSave: async (content) => { await updateInvestigationContent(name, idx, content); },
        afterSave: () => { void showInvestigationContent(name, style, idx, onClosed); },
      });
      return;
    }
  };
}

// ===== 大调查档案加入世界书:模块多选对话框 =====
// 独立叠加 overlay(置顶 z-index),调查弹窗(#panelOverlay)之上,模态套模态。

const INVESTIGATION_WB_DIALOG_CSS = `/* 基底变量 = 古风既有棕金衬线配色(古风行为不变);其余主题用 .iv-wb-<style> 覆盖 */
.iv-wb-dialog{--ivw-bg:#1b1b1d;--ivw-head-bg:#27272a;--ivw-mod-bg:#1f1f22;--ivw-mod-bg-hover:#27272a;--ivw-text:#e0dcd0;--ivw-muted:#9a8cac;--ivw-line:#333235;--ivw-accent:#8a6040;--ivw-accent-soft:rgba(138,96,64,.14);--ivw-accent-on:#fff;--ivw-preview-bg:#16131140;--ivw-preview-text:#b0a080;--ivw-font:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;--ivw-radius:4px}
.iv-wb-overlay{display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
.iv-wb-dialog{width:min(560px,100%);max-height:88vh;max-height:88dvh;display:flex;flex-direction:column;background:var(--ivw-bg);border:1px solid var(--ivw-line);color:var(--ivw-text);font-family:var(--ivw-font);box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden}
.panel-overlay.dark .iv-wb-dialog,body.dark-mode .iv-wb-dialog{background:#241f20;border-color:#514344}
.iv-wb-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--ivw-line);background:var(--ivw-head-bg)}
.panel-overlay.dark .iv-wb-head,body.dark-mode .iv-wb-head{border-bottom-color:#514344;background:#1e1815}
.iv-wb-title{flex:1;font-size:15px;font-weight:700;letter-spacing:2px}
.iv-wb-meta{padding:9px 18px;font-size:10.5px;line-height:1.7;color:var(--ivw-muted);border-bottom:1px solid var(--ivw-line)}
.panel-overlay.dark .iv-wb-meta,body.dark-mode .iv-wb-meta{border-bottom-color:#514344}
.iv-wb-body{flex:1;overflow-y:auto;padding:12px 18px}
.iv-wb-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.iv-wb-toolbar .iv-wb-count{font-size:10.5px;opacity:.7}
.iv-wb-modules{display:flex;flex-direction:column;gap:4px}
.iv-wb-mod{display:flex;align-items:center;gap:9px;padding:7px 9px;border:1px solid var(--ivw-line);background:var(--ivw-mod-bg);cursor:pointer;font-size:12.5px;transition:background .15s}
.iv-wb-mod:hover{background:var(--ivw-mod-bg-hover)}
.iv-wb-mod.checked{border-color:var(--ivw-accent);background:var(--ivw-accent-soft)}
.iv-wb-mod input{margin:0;cursor:pointer;accent-color:var(--ivw-accent)}
.iv-wb-mod .iv-wb-mod-lbl{flex:1}
.iv-wb-mod .iv-wb-mod-hint{font-size:10px;opacity:.5}
.iv-wb-preview-wrap{border-top:1px solid var(--ivw-line);padding:11px 18px;background:rgba(0,0,0,.18)}
.panel-overlay.dark .iv-wb-preview-wrap,body.dark-mode .iv-wb-preview-wrap{border-top-color:#514344}
.iv-wb-preview-lbl{font-size:10px;letter-spacing:2px;opacity:.7;margin-bottom:5px}
.iv-wb-preview{max-height:120px;overflow-y:auto;font-size:11px;line-height:1.7;white-space:pre-wrap;color:var(--ivw-preview-text);background:var(--ivw-preview-bg);border:1px solid var(--ivw-line);padding:8px 10px}
.panel-overlay.dark .iv-wb-preview,body.dark-mode .iv-wb-preview{border-color:#514344}
.iv-wb-foot{display:flex;justify-content:flex-end;gap:8px;padding:11px 18px;border-top:1px solid var(--ivw-line);background:var(--ivw-head-bg)}
.panel-overlay.dark .iv-wb-foot,body.dark-mode .iv-wb-foot{border-top-color:#514344;background:#1e1815}
.iv-wb-btn{font-family:inherit;font-size:11px;letter-spacing:1px;padding:6px 16px;cursor:pointer;transition:all .2s;background:transparent;border:1px solid var(--ivw-line);color:var(--ivw-text);border-radius:var(--ivw-radius)}
.iv-wb-btn:hover{border-color:var(--ivw-accent);color:var(--ivw-accent)}
.iv-wb-btn.primary{background:var(--ivw-accent);border-color:var(--ivw-accent);color:var(--ivw-accent-on)}
.iv-wb-btn.primary:hover{filter:brightness(1.12)}
.iv-wb-btn:disabled{opacity:.4;cursor:default}

/* 瑟瑟 — 霓虹粉紫终端 */
.iv-wb-flirtatious{--ivw-bg:#0d0a18;--ivw-head-bg:#171126;--ivw-mod-bg:#15102a;--ivw-mod-bg-hover:#1d1638;--ivw-text:#f4edff;--ivw-muted:#9a8cac;--ivw-line:#4f356d;--ivw-accent:#ff6a9e;--ivw-accent-soft:rgba(255,106,158,.14);--ivw-accent-on:#1a0a14;--ivw-preview-bg:#0a0612;--ivw-preview-text:#c8b0d8;--ivw-font:"Courier New",ui-monospace,monospace;--ivw-radius:2px}

/* 萦绕 — 机密情报极简(深色靠 body.dark-mode) */
.iv-wb-minimal{--ivw-bg:#ededeb;--ivw-head-bg:#fff;--ivw-mod-bg:#fafafa;--ivw-mod-bg-hover:#f0f0ee;--ivw-text:#171717;--ivw-muted:#666;--ivw-line:#aaa;--ivw-accent:#b22038;--ivw-accent-soft:rgba(178,32,56,.10);--ivw-accent-on:#fff;--ivw-preview-bg:#f4f4f2;--ivw-preview-text:#444;--ivw-font:"Courier New",ui-monospace,monospace;--ivw-radius:0}
body.dark-mode .iv-wb-minimal.iv-wb-dialog,body.dark-mode .iv-wb-overlay.iv-wb-minimal .iv-wb-dialog{background:#1a1a1a;border-color:#444}
body.dark-mode .iv-wb-overlay.iv-wb-minimal .iv-wb-head,body.dark-mode .iv-wb-overlay.iv-wb-minimal .iv-wb-foot{background:#222;border-color:#333}
body.dark-mode .iv-wb-overlay.iv-wb-minimal .iv-wb-mod{background:#222;border-color:#333}

/* 甜恋糖果 — 粉红 */
.iv-wb-sweet{--ivw-bg:var(--sweet-bg,#fff0f5);--ivw-head-bg:var(--sweet-card,#fffafd);--ivw-mod-bg:#fff6f9;--ivw-mod-bg-hover:#ffe9f1;--ivw-text:var(--sweet-text,#572d42);--ivw-muted:var(--sweet-text-soft,#9b7386);--ivw-line:var(--sweet-border,#efb6c9);--ivw-accent:#d64e7c;--ivw-accent-soft:rgba(214,78,124,.12);--ivw-accent-on:#fff;--ivw-preview-bg:#fff5f8;--ivw-preview-text:#7a4558;--ivw-font:"Noto Sans SC","Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif;--ivw-radius:14px}

/* 云海仙踪 — 青蓝 */
.iv-wb-xianxia{--ivw-bg:#e8f4f0;--ivw-head-bg:#f7fbf8;--ivw-mod-bg:#f0f7f4;--ivw-mod-bg-hover:#dff0e9;--ivw-text:#243d38;--ivw-muted:#708c85;--ivw-line:#a7c7be;--ivw-accent:#278c82;--ivw-accent-soft:rgba(39,140,130,.12);--ivw-accent-on:#e8f4f0;--ivw-preview-bg:#f4f9f6;--ivw-preview-text:#3a6048;--ivw-font:"Noto Serif SC","Noto Serif CJK SC","Songti SC","SimSun",serif;--ivw-radius:6px}

/* 深空舰桥 — 复古未来(映射 --bridge-*) */
.iv-wb-bridge{--ivw-bg:var(--bridge-panel,#eef3f5);--ivw-head-bg:var(--bridge-screen,#152b32);--ivw-mod-bg:var(--bridge-panel-alt,#dde8eb);--ivw-mod-bg-hover:var(--bridge-panel-inset,#cdd9dc);--ivw-text:var(--bridge-text,#16222c);--ivw-muted:var(--bridge-muted,#62757c);--ivw-line:var(--bridge-line,#91a5ad);--ivw-accent:var(--bridge-signal,#0a7189);--ivw-accent-soft:var(--bridge-signal-soft,rgba(10,113,137,.14));--ivw-accent-on:var(--bridge-signal-contrast,#fff);--ivw-preview-bg:var(--bridge-panel-inset,#152b32);--ivw-preview-text:var(--bridge-text,#16222c);--ivw-font:var(--bridge-font-ui,"Microsoft YaHei","PingFang SC",sans-serif);--ivw-radius:0}
.iv-wb-bridge .iv-wb-title::after{content:" / WORLDBOOK UPLINK";font:8px var(--bridge-font-data,"Consolas",monospace);letter-spacing:1.2px;color:var(--bridge-screen-muted,#a3c2c9)}

/* === 深色模式：sweet/xianxia/minimal 浅色对话框的 --ivw-* 翻深（H2：深色下 vars 未翻转致 mod 卡/正文/预览文字不可读） === */
.panel-overlay.dark .iv-wb-sweet,body.dark-mode .iv-wb-sweet{--ivw-bg:var(--sweet-bg,#241c28);--ivw-head-bg:var(--sweet-card,#2a1c2a);--ivw-mod-bg:#241c28;--ivw-mod-bg-hover:#2e2230;--ivw-text:var(--sweet-text,#e8d8e0);--ivw-muted:var(--sweet-text-soft,#b898a0);--ivw-line:var(--sweet-border,#3a2a38);--ivw-preview-bg:#1a141c;--ivw-preview-text:#d0a0b0}
.panel-overlay.dark .iv-wb-xianxia,body.dark-mode .iv-wb-xianxia{--ivw-bg:#19241e;--ivw-head-bg:#1f2e26;--ivw-mod-bg:#1a2820;--ivw-mod-bg-hover:#223028;--ivw-text:#cfe8df;--ivw-muted:#8aa89e;--ivw-line:#2a4038;--ivw-preview-bg:#14201a;--ivw-preview-text:#a0c8b8}
.panel-overlay.dark .iv-wb-minimal,body.dark-mode .iv-wb-minimal{--ivw-bg:#1a1a1a;--ivw-head-bg:#222;--ivw-mod-bg:#1f1f1f;--ivw-mod-bg-hover:#2a2a2a;--ivw-text:#f0f0f0;--ivw-muted:#999;--ivw-line:#444;--ivw-preview-bg:#161616;--ivw-preview-text:#ccc}

@media(max-width:599px){.iv-wb-overlay{padding:0}.iv-wb-overlay .iv-wb-dialog{width:100%;height:100vh;height:100dvh;max-height:none}}
`;

/** 打开「加入世界书」模块多选对话框。
 *  charName:角色名;dossier:当前显示的档案;style:主题。 */
async function openInvestigationWorldbookDialog(
  charName: string, dossier: DossierEntry, style: StyleType,
): Promise<void> {
  const content = dossier.content || '';
  const presentIds = getPresentModules(content);
  if (presentIds.length === 0) {
    getToastr()?.warning('当前档案没有可解析的字段,无法加入世界书', '大调查提示');
    return;
  }

  // 默认全选有数据的模块;若已存在同名条目,提示将覆盖
  const selected = new Set<string>(presentIds);
  // 当前档案有哪些模块,供渲染(只显示有数据的)
  const presentDefs = INVESTIGATION_MODULE_DEFS.filter((d) => presentIds.includes(d.id));

  const dlg = document.createElement('div');
  dlg.className = 'panel-overlay iv-wb-overlay iv-wb-' + style + ' show';
  dlg.style.zIndex = '10025';
  if (style === 'minimal') syncDarkClassMinimal(dlg); else syncDarkClass(dlg);

  const safeName = escapeHtml(charName);
  const ts = escapeHtml(dossier.timestamp || '未知时间');

  function renderHTML(): string {
    const modRows = presentDefs.map((d) => {
      const checked = selected.has(d.id);
      // 模块内命中的字段名列表(预览用)
      const hint = INVESTIGATION_MODULE_DEFS.find((m) => m.id === d.id)?.label || d.label;
      return '<label class="iv-wb-mod' + (checked ? ' checked' : '') + '">'
        + '<input type="checkbox" data-mod="' + d.id + '"' + (checked ? ' checked' : '') + '>'
        + '<span class="iv-wb-mod-lbl">' + escapeHtml(d.label) + '</span>'
        + '<span class="iv-wb-mod-hint">' + escapeHtml(hint) + '</span>'
        + '</label>';
    }).join('');
    const previewText = buildDossierWorldbookContent(content, Array.from(selected), charName, dossier.timestamp);
    return '<div class="iv-wb-dialog">'
      + '<div class="iv-wb-head"><span class="iv-wb-title">加入世界书 · ' + safeName + '</span></div>'
      + '<div class="iv-wb-meta">插入位置:<b>角色定义前</b> · 顺序 100 · 触发关键词:<b>' + safeName + '</b>(绿灯) · 档案时间:' + ts + '<br>再次加入会<b>覆盖</b>该角色已有的「大调查档案」条目。该操作不可逆。</div>'
      + '<div class="iv-wb-body">'
      + '<div class="iv-wb-toolbar">'
      + '<button type="button" class="iv-wb-btn" id="ivWbAll">全选</button>'
      + '<button type="button" class="iv-wb-btn" id="ivWbNone">全不选</button>'
      + '<span class="iv-wb-count" id="ivWbCount"></span>'
      + '</div>'
      + '<div class="iv-wb-modules">' + modRows + '</div>'
      + '</div>'
      + '<div class="iv-wb-preview-wrap">'
      + '<div class="iv-wb-preview-lbl">写入预览</div>'
      + '<div class="iv-wb-preview">' + escapeHtml(previewText || '(未选择任何模块)') + '</div>'
      + '</div>'
      + '<div class="iv-wb-foot">'
      + '<button type="button" class="iv-wb-btn" id="ivWbCancel">取消</button>'
      + '<button type="button" class="iv-wb-btn primary" id="ivWbOk">确定加入</button>'
      + '</div>'
      + '</div>';
  }

  ensureStyleOnce('ub-iv-wb-dialog-css', INVESTIGATION_WB_DIALOG_CSS); // F44(十一轮)：样式一次注入常驻
  dlg.innerHTML = renderHTML();
  document.body.appendChild(dlg);

  function refreshPreview(): void {
    const previewEl = dlg.querySelector('.iv-wb-preview');
    if (previewEl) {
      const text = buildDossierWorldbookContent(content, Array.from(selected), charName, dossier.timestamp);
      previewEl.textContent = text || '(未选择任何模块)';
    }
    const countEl = dlg.querySelector('#ivWbCount');
    if (countEl) countEl.textContent = '已选 ' + selected.size + ' / ' + presentDefs.length;
    const okBtn = dlg.querySelector('#ivWbOk') as HTMLButtonElement;
    if (okBtn) okBtn.disabled = selected.size === 0;
  }

  function toggleMod(id: string, checked: boolean): void {
    if (checked) selected.add(id); else selected.delete(id);
    const mod = dlg.querySelector('.iv-wb-mod input[data-mod="' + id + '"]');
    if (mod) {
      mod.closest('.iv-wb-mod')?.classList.toggle('checked', checked);
    }
    refreshPreview();
  }

  dlg.querySelector('.iv-wb-modules')!.addEventListener('change', function (e) {
    const input = e.target as HTMLInputElement;
    const id = input.dataset.mod;
    if (id) toggleMod(id, input.checked);
  });
  dlg.querySelector('#ivWbAll')!.addEventListener('click', function () {
    for (const d of presentDefs) {
      selected.add(d.id);
      const input = dlg.querySelector('.iv-wb-mod input[data-mod="' + d.id + '"]') as HTMLInputElement;
      if (input) { input.checked = true; input.closest('.iv-wb-mod')?.classList.add('checked'); }
    }
    refreshPreview();
  });
  dlg.querySelector('#ivWbNone')!.addEventListener('click', function () {
    for (const d of presentDefs) {
      selected.delete(d.id);
      const input = dlg.querySelector('.iv-wb-mod input[data-mod="' + d.id + '"]') as HTMLInputElement;
      if (input) { input.checked = false; input.closest('.iv-wb-mod')?.classList.remove('checked'); }
    }
    refreshPreview();
  });
  dlg.querySelector('#ivWbCancel')!.addEventListener('click', function () { dlg.remove(); });

  const okBtn = dlg.querySelector('#ivWbOk') as HTMLButtonElement;
  okBtn.addEventListener('click', async function () {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const confirmed = await showConfirmDialog({ message: '该操作不可逆:\n所选档案将写入角色世界书,并覆盖「' + charName + '」已有的「大调查档案」条目。\n\n确认加入?' });
    if (!confirmed) return;
    okBtn.disabled = true;
    okBtn.textContent = '写入中...';
    const result = await addDossierToWorldbook(charName, content, ids, dossier.timestamp);
    dlg.remove();
    if (result.ok) {
      getToastr()?.success(result.msg, '大调查提示');
    } else {
      getToastr()?.error(result.msg, '大调查错误');
    }
  });

  refreshPreview();
  markPopupShown();
}

// ===== 大采访配置与档案弹窗 =====

const INTERVIEW_POPUP_CSS = `.interview-config-popup,.interview-popup{--itvc-bg:#f5ecdc;--itvc-card:#fffaf0;--itvc-text:#38271c;--itvc-muted:#806d5d;--itvc-line:#d4b98d;--itvc-accent:#9d463b;position:relative;overflow:hidden;border:1px solid var(--itvc-line);border-radius:8px;background:var(--itvc-bg);color:var(--itvc-text);box-shadow:0 20px 60px rgba(0,0,0,.35);font-family:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",sans-serif;box-sizing:border-box;overscroll-behavior:contain}
.interview-config-popup{width:min(900px,100%);max-height:88vh;max-height:88dvh}
/* 纵向 flex：头部/底部按自身实际高度占位，正文 flex:1 1 auto + min-height:0 吃剩余高度。
   ★勿退回「正文 max-height:calc(88dvh - 112px)」的块级写法：112px 是按 PC 单行头部(≈57px)+底部
   (≈56px) 估的常量，≤600px 头部因 flex-wrap 换行而涨到 ≈88px，且正文自身 padding 在 content-box 下
   不计入 max-height ⇒ 内容比弹窗盒高约 52px，被 overflow:hidden 从底部裁掉——「取消/开始采访」整条
   按钮消失且无滚动路径可达（PC 只裁掉按钮下半）。行高继承自宿主页，故该常量本质上不可预测。 */
.interview-config-popup{display:flex;flex-direction:column}
.interview-popup{max-width:900px;width:100%;max-height:85vh;max-height:85dvh;display:flex;flex-direction:column}
.itv-config-flirtatious{--itvc-bg:#0d0a18;--itvc-card:#171126;--itvc-text:#f4edff;--itvc-muted:#9a8cac;--itvc-line:#4f356d;--itvc-accent:#ff4f9f;font-family:"Courier New",monospace}.itv-config-minimal{--itvc-bg:#ededeb;--itvc-card:#fff;--itvc-text:#171717;--itvc-muted:#666;--itvc-line:#aaa;--itvc-accent:#b22038;font-family:"Courier New",monospace}.itv-config-sweet{--itvc-bg:var(--sweet-bg,#fff0f5);--itvc-card:var(--sweet-card,#fffafd);--itvc-text:var(--sweet-text,#572d42);--itvc-muted:var(--sweet-text-soft,#9b7386);--itvc-line:var(--sweet-border,#efb6c9);--itvc-accent:#d64e7c}.itv-config-xianxia{--itvc-bg:#e8f1ee;--itvc-card:#f7fbf8;--itvc-text:#243d38;--itvc-muted:#708c85;--itvc-line:#a7c7be;--itvc-accent:#278c82}.itv-config-bridge{--itvc-bg:var(--bridge-panel);--itvc-card:var(--bridge-panel-alt);--itvc-text:var(--bridge-text);--itvc-muted:var(--bridge-muted);--itvc-line:var(--bridge-line);--itvc-accent:var(--bridge-signal);border-radius:0;font-family:var(--bridge-font-ui)}.itv-config-ios{--itvc-bg:#f2f2f7;--itvc-card:#ffffff;--itvc-text:#1c1c1e;--itvc-muted:rgba(60,60,67,.62);--itvc-line:rgba(60,60,67,.12);--itvc-accent:#007aff;border-radius:20px;border:none;box-shadow:0 14px 44px rgba(0,0,0,.22);font-family:var(--ios-font,-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei UI',sans-serif)}
.itv-config-ios .itv-config-section{border-radius:14px}
.itv-config-ios .itv-config-close,.itv-config-ios .itv-top-action,.itv-config-ios .itv-sidebar-toggle{border:none;border-radius:999px;background:rgba(120,120,128,.1)}
.itv-config-ios .itv-config-close:hover,.itv-config-ios .itv-top-action:hover{background:rgba(120,120,128,.18)}
.itv-config-ios .itv-custom-row input,.itv-config-ios .itv-candidate-search,.itv-config-ios .itv-location-select,.itv-config-ios .itv-extra-prompt{border:none;border-radius:9px;background:rgba(120,120,128,.08)}
.itv-config-ios .itv-custom-row button,.itv-config-ios .itv-config-secondary,.itv-config-ios .itv-location-mode{border:none;border-radius:999px;background:rgba(120,120,128,.1)}
.itv-config-ios .itv-config-primary,.itv-config-ios .itv-location-mode.active{border:none;border-radius:999px;background:var(--itvc-accent)}
.itv-config-ios .itv-history-item,.itv-config-ios .itv-continue-item{border-radius:12px}
.itv-config-ios .itv-toggle{border:none;background:rgba(120,120,128,.24)}
.itv-config-ios .itv-toggle.on{background:color-mix(in srgb,var(--itvc-accent) 30%,transparent)}
.panel-overlay.dark .itv-config-ios,body.dark-mode .itv-config-ios{--itvc-bg:#1c1c1e;--itvc-card:#2c2c2e;--itvc-text:#f2f2f7;--itvc-muted:rgba(235,235,245,.62);--itvc-line:rgba(235,235,245,.12);--itvc-accent:#0a84ff}
.panel-overlay.dark .interview-config-popup,.panel-overlay.dark .interview-popup,body.dark-mode .interview-config-popup,body.dark-mode .interview-popup{--itvc-bg:#181515;--itvc-card:#241f20;--itvc-text:#f0e7e4;--itvc-muted:#b29fa0;--itvc-line:#514344}
/* === 深色模式按主题提亮 --itvc-accent（通用深色块未覆盖 accent，ancient/minimal 深色 accent 对比不足） === */
.panel-overlay.dark .itv-config-ancient,body.dark-mode .itv-config-ancient{--itvc-accent:#d06858}
.panel-overlay.dark .itv-config-minimal,body.dark-mode .itv-config-minimal{--itvc-accent:#e8506a}
.panel-overlay.dark .itv-config-sweet,body.dark-mode .itv-config-sweet{--itvc-accent:#ff8fab}
.panel-overlay.dark .itv-config-xianxia,body.dark-mode .itv-config-xianxia{--itvc-accent:#5ac0b0}
.itv-config-head,.itv-content-topbar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--itvc-line);background:var(--itvc-card);flex-shrink:0}.itv-config-title,.itv-content-title{flex:1;font-size:15px;font-weight:700;letter-spacing:2px}.itv-config-sub{color:var(--itvc-muted);font-size:11px}.itv-config-close,.itv-top-action{border:1px solid var(--itvc-line);border-radius:4px;background:transparent;color:var(--itvc-text);cursor:pointer;padding:4px 9px;font:inherit;font-size:11px}.itv-config-close{border:0;font-size:18px;padding:0 4px}.itv-config-body{flex:1 1 auto;min-height:0;overflow:auto;padding:14px 16px}.itv-config-section{margin-bottom:12px;padding:11px;border:1px solid var(--itvc-line);border-radius:6px;background:var(--itvc-card)}.itv-section-title{display:flex;align-items:center;gap:6px;margin-bottom:8px;color:var(--itvc-accent);font-size:11px;font-weight:700;letter-spacing:1px}.itv-section-title small{color:var(--itvc-muted);font-weight:400;letter-spacing:0}.itv-selected-tray,.itv-candidate-pool{display:flex;flex-wrap:wrap;gap:6px}.itv-selected-chip,.itv-candidate{display:inline-flex;align-items:center;gap:5px;padding:3px 7px 3px 3px;border:1px solid var(--itvc-line);border-radius:999px;background:var(--itvc-bg);font-size:11px}.itv-selected-chip button,.itv-candidate button{border:0;background:transparent;color:var(--itvc-accent);cursor:pointer;font:inherit;font-size:10px;padding:1px 3px}.itv-candidate button:disabled{opacity:.3;cursor:default}.itv-mini-avatar{display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;overflow:hidden;border-radius:50%;background:color-mix(in srgb,var(--itvc-accent) 15%,var(--itvc-card));color:var(--itvc-accent);font-size:10px;font-weight:700}.itv-mini-avatar img{width:100%;height:100%;object-fit:cover}.itv-lock{color:var(--itvc-accent);font-size:9px}.itv-custom-row,.itv-location-row,.itv-candidate-head{display:flex;gap:7px;align-items:center;margin-top:8px}.itv-custom-row input,.itv-candidate-search,.itv-location-select,.itv-extra-prompt{min-width:0;border:1px solid var(--itvc-line);border-radius:4px;background:var(--itvc-bg);color:var(--itvc-text);font:inherit;font-size:11px;padding:6px 8px}.itv-custom-row input,.itv-candidate-search{flex:1}.itv-custom-row button,.itv-config-primary,.itv-config-secondary,.itv-location-mode{border:1px solid var(--itvc-line);border-radius:4px;background:var(--itvc-bg);color:var(--itvc-text);cursor:pointer;font:inherit;font-size:11px;padding:6px 10px}.itv-candidate-head{margin:0 0 8px}.itv-candidate-count{color:var(--itvc-muted);font-size:10px}.itv-candidate-pool{max-height:148px;overflow-y:auto;padding-right:3px}.itv-location-row{flex-wrap:wrap}.itv-location-mode.active,.itv-config-primary{border-color:var(--itvc-accent);background:var(--itvc-accent);color:#fff}.itv-location-select{flex:1}.itv-location-preview{margin-top:8px;padding:8px 10px;border-left:3px solid var(--itvc-accent);background:var(--itvc-bg);font-size:10px;color:var(--itvc-muted);white-space:pre-wrap}.itv-location-preview b{color:var(--itvc-text)}.itv-location-excluded{margin-top:5px;opacity:.72}.itv-toggle-row{display:flex;align-items:flex-start;gap:9px}.itv-toggle{position:relative;flex:0 0 38px;width:38px;height:21px;border:1px solid var(--itvc-line);border-radius:999px;background:var(--itvc-bg);cursor:pointer}.itv-toggle::after{content:"";position:absolute;left:2px;top:2px;width:15px;height:15px;border-radius:50%;background:var(--itvc-muted);transition:.2s}.itv-toggle.on{background:color-mix(in srgb,var(--itvc-accent) 25%,var(--itvc-bg));border-color:var(--itvc-accent)}.itv-toggle.on::after{left:18px;background:var(--itvc-accent)}.itv-toggle-copy{font-size:10px;color:var(--itvc-muted);line-height:1.55}.itv-extra-prompt{width:100%;box-sizing:border-box;resize:vertical}.itv-config-foot{display:flex;justify-content:flex-end;gap:8px;flex:0 0 auto;padding:10px 16px;border-top:1px solid var(--itvc-line);background:var(--itvc-card)}
.itv-content-shell{display:flex;gap:0;flex:1;min-height:0;overflow:hidden}.itv-history{flex:0 0 190px;min-width:0;max-width:42%;overflow:auto;border-right:1px solid var(--itvc-line);background:var(--itvc-card);padding:8px}.itv-content-shell.itv-collapsed .itv-history{flex:0 0 0;max-width:0;padding:0;border-right:0;overflow:hidden}.itv-sidebar-toggle{width:26px;height:26px;border:1px solid var(--itvc-line);background:transparent;color:var(--itvc-text);cursor:pointer;font-size:11px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:4px;line-height:1;flex-shrink:0}.itv-history-item{display:flex;gap:4px;align-items:center;margin-bottom:5px;border:1px solid var(--itvc-line);border-radius:4px;padding:5px;background:var(--itvc-bg);font-size:10px;cursor:pointer}.itv-history-item.active{border-color:var(--itvc-accent)}.itv-history-item span{flex:1}.itv-history-delete{border:0;background:transparent;color:var(--itvc-accent);cursor:pointer}.itv-content-main{flex:1;min-width:0;min-height:0;overflow:auto}.itv-fallback{margin:0;padding:20px;white-space:pre-wrap;color:var(--itvc-text)}
@media(max-width:600px){.interview-config-popup{width:100%}.interview-config-popup.itv-config-bridge,.interview-popup.itv-config-bridge{height:calc(100vh - var(--ub-ol-pad-total,80px));height:calc(100dvh - var(--ub-ol-pad-total,80px));max-height:none}.itv-config-head{flex-wrap:wrap}.itv-config-sub{order:3;width:100%}.itv-config-body{padding:10px}.itv-content-topbar{flex-wrap:wrap;gap:6px;padding:8px}.itv-content-topbar .itv-content-title{flex:1 1 auto;min-width:0}.itv-top-action{padding:3px 6px}.itv-history{flex-basis:172px;max-width:none}}
.itv-font-scale{display:inline-flex;align-items:center;gap:4px}
.itv-font-val{display:inline-block;min-width:30px;text-align:center;font-size:11px;opacity:.7;padding:0 2px}
.itv-font-scale .itv-top-action:disabled{opacity:.4;cursor:default}
.interview-config-popup{font-size:13px}
.interview-config-popup .itv-config-title{font-size:17px}
.interview-config-popup .itv-config-sub{font-size:13px}
.interview-config-popup .itv-config-close{font-size:20px}
.interview-config-popup .itv-section-title{font-size:13px}
.interview-config-popup .itv-selected-chip,.interview-config-popup .itv-candidate{font-size:13px}
.interview-config-popup .itv-selected-chip button,.interview-config-popup .itv-candidate button{font-size:12px}
.interview-config-popup .itv-mini-avatar{font-size:12px}
.interview-config-popup .itv-lock{font-size:11px}
.interview-config-popup .itv-custom-row input,.interview-config-popup .itv-candidate-search,.interview-config-popup .itv-location-select,.interview-config-popup .itv-extra-prompt{font-size:13px}
.interview-config-popup .itv-custom-row button,.interview-config-popup .itv-config-primary,.interview-config-popup .itv-config-secondary,.interview-config-popup .itv-location-mode{font-size:13px}
.interview-config-popup .itv-candidate-count{font-size:12px}
.interview-config-popup .itv-location-preview{font-size:12px}
.interview-config-popup .itv-toggle-copy{font-size:12px}
.interview-config-popup .itv-continue-list{display:flex;flex-direction:column;gap:6px;margin-top:10px}.interview-config-popup .itv-continue-item{display:flex;gap:9px;align-items:flex-start;padding:8px 10px;border:1px solid var(--itvc-line);border-radius:6px;background:var(--itvc-bg);cursor:pointer;transition:.15s}.interview-config-popup .itv-continue-item:hover{border-color:color-mix(in srgb,var(--itvc-accent) 60%,var(--itvc-line))}.interview-config-popup .itv-continue-item.sel{border-color:var(--itvc-accent);background:color-mix(in srgb,var(--itvc-accent) 10%,var(--itvc-bg))}.interview-config-popup .itv-cbox{flex:0 0 16px;width:16px;height:16px;margin-top:1px;border:1.5px solid var(--itvc-muted);border-radius:3px;position:relative;transition:.15s}.interview-config-popup .itv-continue-item.sel .itv-cbox{border-color:var(--itvc-accent);background:var(--itvc-accent)}.interview-config-popup .itv-continue-item.sel .itv-cbox::after{content:"✓";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;line-height:1}.interview-config-popup .itv-ci-body{flex:1;min-width:0}.interview-config-popup .itv-ci-title{font-size:13px;font-weight:700;color:var(--itvc-text);letter-spacing:.5px}.interview-config-popup .itv-ci-meta{font-size:12px;color:var(--itvc-muted);margin-top:2px;line-height:1.5}.interview-config-popup .itv-ci-meta b{color:var(--itvc-accent);font-weight:400}.interview-config-popup .itv-continue-foot{display:flex;align-items:center;justify-content:space-between;margin-top:9px;padding-top:8px;border-top:1px dashed var(--itvc-line)}.interview-config-popup .itv-continue-count{font-size:12px;color:var(--itvc-muted)}.interview-config-popup .itv-continue-count b{color:var(--itvc-accent);font-weight:700}.interview-config-popup .itv-continue-warn{font-size:12px;color:var(--itvc-muted);opacity:.85}.interview-config-popup .itv-continue-empty{padding:14px;text-align:center;color:var(--itvc-muted);font-size:12px;border:1px dashed var(--itvc-line);border-radius:6px}
`;

interface InterviewConfigPopupState {
  interviewers: string[];
  interviewees: string[];
  candidates: string[];
  locationMode: 'current' | 'library';
  selectedNodeId: string;
  readDossier: boolean;
  extraPrompt: string;
  locationPreview: string;
  continueMode: boolean;
  continueSelected: number[];
}

function escInterview(value: unknown): string {
  return escapeHtmlAttr(value);
}

function interviewMiniAvatar(name: string): string {
  const portrait = getCurrentPortraitPath(name);
  return portrait
    ? '<span class="itv-mini-avatar"><img src="' + escInterview(portrait) + '" alt="' + escInterview(name) + '"></span>'
    : '<span class="itv-mini-avatar">' + escInterview(getInitials(name) || name.slice(0, 1) || '?') + '</span>';
}

function interviewLocationPreview(injection: string): string {
  if (!injection) return '';
  const escaped = escInterview(injection).replace(/\r?\n/g, '<br>');
  return '<div class="itv-location-preview"><b>▸ 将作为地点参考注入</b><br><span style="opacity:.72;">地点描述 · 物品元素 · 探索记录</span><br>' + escaped
    + '<div class="itv-location-excluded">（方位、坐标等其余字段不注入上下文）</div></div>';
}

// 导出供回归测试直接调用真实产物（2026-10-07 CSS 文本泄漏事故：只做正则守在源码上，拼接换个形态就漏）
export function configPopupHtml(
  state: InterviewConfigPopupState,
  primaryInterviewee: string,
  currentLocation: string,
  nodes: MapLibNodeInfo[],
  style: StyleType,
  pastInterviews: InterviewEntry[],
): string {
  const tray = (names: string[], role: 'interviewer' | 'interviewee'): string => names.map(name => {
    const locked = role === 'interviewee' && name === primaryInterviewee;
    return '<span class="itv-selected-chip">' + interviewMiniAvatar(name) + '<span>' + escInterview(name) + '</span>'
      + (locked ? '<span class="itv-lock">★必选</span>' : '<button data-itv-action="remove-person" data-role="' + role + '" data-person="' + encodeURIComponent(name) + '" title="移除">×</button>')
      + '</span>';
  }).join('');
  const candidates = state.candidates.map(name => {
    const inQ = state.interviewers.includes(name);
    const inA = state.interviewees.includes(name);
    return '<span class="itv-candidate" data-search-name="' + escInterview(name.toLocaleLowerCase()) + '">' + interviewMiniAvatar(name)
      + '<span>' + escInterview(name) + '</span>'
      + '<button data-itv-action="add-interviewer" data-person="' + encodeURIComponent(name) + '"' + (inQ ? ' disabled' : '') + '>+问</button>'
      + '<button data-itv-action="add-interviewee" data-person="' + encodeURIComponent(name) + '"' + (inA ? ' disabled' : '') + '>+答</button></span>';
  }).join('');
  const options = nodes.map(node => '<option value="' + escInterview(node.nodeId) + '"' + (node.nodeId === state.selectedNodeId ? ' selected' : '') + '>' + escInterview(node.fullPath) + '</option>').join('');

  const continueListHtml = (() => {
    if (!state.continueMode) return '';
    if (!pastInterviews.length) return '<div class="itv-continue-empty">该角色暂无往期采访可接续</div>';
    const items = pastInterviews.map((entry, i) => {
      const parsed = entry.parsedData || parseInterview(entry.content);
      const title = [parsed?.title, parsed?.subtitle].filter(Boolean).join(' · ') || `记录 ${i + 1}`;
      const ts = entry.timestamp || `记录 ${i + 1}`;
      const qs = (parsed?.interviewers || []).join('，') || '未记录';
      const as = (parsed?.interviewees || []).join('，') || '未记录';
      const sel = state.continueSelected.includes(i);
      return '<div class="itv-continue-item' + (sel ? ' sel' : '') + '" data-itv-continue-index="' + i + '"><div class="itv-cbox"></div><div class="itv-ci-body"><div class="itv-ci-title">' + escInterview(title) + '</div><div class="itv-ci-meta">' + escInterview(ts) + ' · <b>问</b>' + escInterview(qs) + ' → <b>答</b>' + escInterview(as) + '</div></div></div>';
    }).join('');
    const count = '已选 <b>' + state.continueSelected.length + '</b> / ' + pastInterviews.length + ' 段 · 注入按选中顺序拼接';
    return '<div class="itv-continue-list">' + items + '</div><div class="itv-continue-foot"><span class="itv-continue-count">' + count + '</span><span class="itv-continue-warn">' + ubIcon('warning') + ' 全文不裁剪</span></div>';
  })();
  const continueCopy = state.continueMode
    ? '所选采访全文将注入提示词作为接续参考；不裁剪，留意 token 用量。'
    : '开启后可选择该角色已存在的一段或多段采访注入提示词，AI 将顺着往期内容延伸/启发新话题，不重复已采访内容。';
  const continueStateLabel = state.continueMode ? '开 · 接续往期采访' : '关 · 独立新采';

  // ★勿在返回值前拼 INTERVIEW_POPUP_CSS：常量已无 <style> 包裹（F44 改 ensureStyleOnce 注入），
  //   拼进去会变成 overlay 里的纯文本节点，整段 CSS 直接铺在页面上（2026-10-07 事故）。
  return '<div class="interview-config-popup itv-config-' + style + (style === 'bridge' ? ' bridge-window bridge-module-interview-config' : '') + '">'
    + '<div class="itv-config-head"><span class="itv-config-title">色情采访 · 配置</span><span class="itv-config-sub">必选被采访者：' + escInterview(primaryInterviewee) + '</span><button class="itv-config-close" data-itv-action="close">×</button></div>'
    + '<div class="itv-config-body">'
    + '<section class="itv-config-section"><div class="itv-section-title">1 · 采访者 <small>已选，可多选，默认主角</small></div><div class="itv-selected-tray">' + tray(state.interviewers, 'interviewer') + '</div><div class="itv-custom-row"><input id="itv-custom-interviewer" placeholder="+ 自定义采访者姓名"><button data-itv-action="custom-interviewer">加为采访者</button></div></section>'
    + '<section class="itv-config-section"><div class="itv-section-title">2 · 被采访者 <small>点选角色锁定，可追加</small></div><div class="itv-selected-tray">' + tray(state.interviewees, 'interviewee') + '</div><div class="itv-custom-row"><input id="itv-custom-interviewee" placeholder="+ 自定义被采访者姓名"><button data-itv-action="custom-interviewee">加为被采访者</button></div></section>'
    + '<section class="itv-config-section"><div class="itv-candidate-head"><span class="itv-section-title" style="margin:0;">3 · 候选人物</span><span class="itv-candidate-count">主角 · 恋爱对象 · 重要角色，共 ' + state.candidates.length + ' 人</span><input class="itv-candidate-search" placeholder="搜索姓名"></div><div class="itv-candidate-pool">' + (candidates || '<span class="itv-candidate-count">暂无候选，可使用自定义姓名</span>') + '</div></section>'
    + '<section class="itv-config-section"><div class="itv-section-title">4 · 采访地点 <small>默认当前地点，可从地图库任选</small></div><div class="itv-location-row"><button class="itv-location-mode' + (state.locationMode === 'current' ? ' active' : '') + '" data-itv-action="location-current">当前地点：' + escInterview(currentLocation || '未记录') + '</button><button class="itv-location-mode' + (state.locationMode === 'library' ? ' active' : '') + '" data-itv-action="location-library">从地图库选择</button>'
    + (state.locationMode === 'library' ? '<select class="itv-location-select"><option value="">请选择地点</option>' + options + '</select>' : '') + '</div>' + interviewLocationPreview(state.locationPreview) + '</section>'
    + '<section class="itv-config-section"><div class="itv-section-title">5 · 引用大调查档案</div><div class="itv-toggle-row"><button class="itv-toggle' + (state.readDossier ? ' on' : '') + '" data-itv-action="toggle-dossier" aria-label="切换引用大调查档案"></button><div class="itv-toggle-copy"><b>' + (state.readDossier ? '开 · 仅读最新一篇' : '关 · 完全不读') + '</b><br>为每一位被采访者读取最新大调查档案，作为被采访者状态参考注入；仅供 AI 保持表现一致，非剧中采访者所知。</div></div></section>'
    + '<section class="itv-config-section"><div class="itv-section-title">6 · 接续往期采访 <small>仅本次生效</small></div><div class="itv-toggle-row"><button class="itv-toggle' + (state.continueMode ? ' on' : '') + '" data-itv-action="toggle-continue" aria-label="切换接续往期采访"></button><div class="itv-toggle-copy"><b>' + continueStateLabel + '</b><br>' + continueCopy + '</div></div>' + continueListHtml + '</section>'
    + '<section class="itv-config-section"><div class="itv-section-title">7 · 额外要求 <small>仅本次采访生效 · 自动保留上次填写</small></div><textarea class="itv-extra-prompt" rows="3" placeholder="补充本次采访的特殊要求……">' + escInterview(state.extraPrompt) + '</textarea></section>'
    + '</div><div class="itv-config-foot"><button class="itv-config-secondary" data-itv-action="close">取消</button><button class="itv-config-primary" data-itv-action="start">' + (state.continueMode ? '开始接续采访 →' : '开始采访 →') + '</button></div></div>';
}

export async function showInterviewConfigPopup(primaryInterviewee: string, style: StyleType, btnElement?: HTMLButtonElement, onClosed?: () => void): Promise<void> {
  if (!primaryInterviewee || isInterviewing(primaryInterviewee)) return;
  const overlay = document.getElementById('panelOverlay')!;
  const currentLocation = getCellByHeader('全局数据表', 1, '当前详细地点') || getCellByHeader('全局数据表', 1, '当前位置') || '';
  const nodes = await listMapLibraryNodes();
  const currentNode = nodes.find(node => node.fullPath === currentLocation || node.nodeId === deriveNodeId(currentLocation));
  const protagonistName = getCellByHeader('主角信息表', 1, '姓名') || '主角';
  const pastInterviews = loadInterview(primaryInterviewee);
  const state: InterviewConfigPopupState = {
    interviewers: [protagonistName],
    interviewees: [primaryInterviewee],
    candidates: Array.from(new Set([protagonistName, ...collectAllCharacterNames()])),
    locationMode: 'current',
    selectedNodeId: currentNode?.nodeId || '',
    readDossier: getConfig().interviewReadDossier,
    extraPrompt: readExtraPromptCache(EXTRA_PROMPT_CACHE_KEYS.interview),
    locationPreview: currentNode ? buildLocationInjection(await readMapNode(currentNode.nodeId)) : '',
    continueMode: false,
    continueSelected: [],
  };

  const render = (): void => {
    const prevBody = overlay.querySelector('.itv-config-body') as HTMLElement | null;
    const prevScrollTop = prevBody?.scrollTop ?? 0;
    ensureStyleOnce('ub-iv-popup-css', INTERVIEW_POPUP_CSS); // F44(十一轮)：样式一次注入常驻（本入口亦须保证在正文之前就位）
    overlay.innerHTML = configPopupHtml(state, primaryInterviewee, currentLocation, nodes, style, pastInterviews);
    if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
    const newBody = overlay.querySelector('.itv-config-body') as HTMLElement | null;
    if (newBody && prevScrollTop > 0) newBody.scrollTop = prevScrollTop;
    const search = overlay.querySelector('.itv-candidate-search') as HTMLInputElement | null;
    if (search) search.oninput = function () {
      const query = search.value.trim().toLocaleLowerCase();
      overlay.querySelectorAll<HTMLElement>('.itv-candidate[data-search-name]').forEach(item => {
        item.style.display = !query || String(item.dataset.searchName || '').includes(query) ? '' : 'none';
      });
    };
    const extra = overlay.querySelector('.itv-extra-prompt') as HTMLTextAreaElement | null;
    if (extra) extra.oninput = () => { state.extraPrompt = extra.value; };
    const select = overlay.querySelector('.itv-location-select') as HTMLSelectElement | null;
    if (select) select.onchange = async () => {
      state.selectedNodeId = select.value;
      state.locationPreview = select.value ? buildLocationInjection(await readMapNode(select.value)) : '';
      render();
    };
  };

  render();
  markPopupShown();
  overlay.classList.add('show');
  overlay.onclick = async function (event) {
    const target = event.target as HTMLElement;
    if (event.target === overlay) {
      if (guardGhostClick()) return;
      if (onClosed) onClosed(); else closePanelOverlay(overlay);
      return;
    }
    const continueItem = target.closest<HTMLElement>('[data-itv-continue-index]');
    if (continueItem) {
      const idx = parseInt(continueItem.dataset.itvContinueIndex || '', 10);
      if (!Number.isNaN(idx)) {
        state.continueSelected = state.continueSelected.includes(idx)
          ? state.continueSelected.filter(x => x !== idx)
          : [...state.continueSelected, idx];
        render();
      }
      return;
    }
    const actionElement = target.closest<HTMLElement>('[data-itv-action]');
    if (!actionElement) return;
    const action = actionElement.dataset.itvAction || '';
    if (action === 'close') { if (onClosed) onClosed(); else closePanelOverlay(overlay); return; }
    if (action === 'add-interviewer' || action === 'add-interviewee') {
      const name = decodeURIComponent(actionElement.dataset.person || '').trim();
      const list = action === 'add-interviewer' ? state.interviewers : state.interviewees;
      if (name && !list.includes(name)) list.push(name);
      render();
      return;
    }
    if (action === 'remove-person') {
      const name = decodeURIComponent(actionElement.dataset.person || '').trim();
      if (actionElement.dataset.role === 'interviewer') state.interviewers = state.interviewers.filter(item => item !== name);
      else if (name !== primaryInterviewee) state.interviewees = state.interviewees.filter(item => item !== name);
      render();
      return;
    }
    if (action === 'custom-interviewer' || action === 'custom-interviewee') {
      const inputId = action === 'custom-interviewer' ? 'itv-custom-interviewer' : 'itv-custom-interviewee';
      const input = overlay.querySelector('#' + inputId) as HTMLInputElement | null;
      const name = input?.value.trim() || '';
      const list = action === 'custom-interviewer' ? state.interviewers : state.interviewees;
      if (name && !list.includes(name)) list.push(name);
      render();
      return;
    }
    if (action === 'location-current') {
      state.locationMode = 'current';
      state.selectedNodeId = currentNode?.nodeId || '';
      state.locationPreview = currentNode ? buildLocationInjection(await readMapNode(currentNode.nodeId)) : '';
      render();
      return;
    }
    if (action === 'location-library') { state.locationMode = 'library'; render(); return; }
    if (action === 'toggle-dossier') {
      state.readDossier = !state.readDossier;
      setConfig('interviewReadDossier', state.readDossier);
      render();
      return;
    }
    if (action === 'toggle-continue') {
      state.continueMode = !state.continueMode;
      if (!state.continueMode) state.continueSelected = [];
      render();
      return;
    }
    if (action !== 'start') return;
    if (!state.interviewers.length) {
      getToastr()?.warning('请至少选择一名采访者', '大采访配置');
      return;
    }
    if (!state.interviewees.includes(primaryInterviewee)) state.interviewees.unshift(primaryInterviewee);
    const selectedNode = nodes.find(node => node.nodeId === state.selectedNodeId);
    if (state.locationMode === 'library' && !selectedNode) {
      getToastr()?.warning('请从地图库选择采访地点', '大采访配置');
      return;
    }
    writeExtraPromptCache(EXTRA_PROMPT_CACHE_KEYS.interview, state.extraPrompt);
    const config: InterviewConfig = {
      primaryInterviewee,
      interviewers: [...state.interviewers],
      interviewees: [...state.interviewees],
      locationName: selectedNode?.name || currentLocation || '当前地点',
      locationLabel: selectedNode?.fullPath || currentLocation || '当前地点',
      ...(state.selectedNodeId ? { locationNodeId: state.selectedNodeId } : {}),
      readDossier: state.readDossier,
      extraPrompt: state.extraPrompt.trim(),
      continueRefs: state.continueMode
        ? state.continueSelected
            .slice()
            .sort((a, b) => a - b)
            .map(i => pastInterviews[i])
            .filter((e): e is InterviewEntry => !!e)
            .map((e): InterviewContinueRef => {
              const parsed = e.parsedData || parseInterview(e.content);
              return {
                content: e.content,
                timestamp: e.timestamp,
                title: parsed?.title || '',
                subtitle: parsed?.subtitle || '',
                interviewers: parsed?.interviewers || [],
                interviewees: parsed?.interviewees || [],
              };
            })
        : [],
    };
    const previousLatestIndex = loadInterview(primaryInterviewee).length - 1;
    closePanelOverlay(overlay);
    const interviewTask = performInterview(config, btnElement);
    if (previousLatestIndex >= 0) {
      await showInterviewContent(primaryInterviewee, style, previousLatestIndex, onClosed);
    }
    const content = await interviewTask;
    if (!content) { if (!overlay.classList.contains('show') && onClosed) onClosed(); return; }
    const popup = overlay.querySelector<HTMLElement>('.interview-popup');
    if (popup?.dataset.itvPrimary === primaryInterviewee) {
      const activeIndex = parseInt(popup.dataset.itvActiveIndex || '', 10);
      const nextIndex = !Number.isNaN(activeIndex) && activeIndex !== previousLatestIndex ? activeIndex : undefined;
      await showInterviewContent(primaryInterviewee, style, nextIndex, onClosed);
    } else if (previousLatestIndex < 0 && !overlay.classList.contains('show')) {
      await showInterviewContent(primaryInterviewee, style, undefined, onClosed);
    }
  };
}

function interviewHistoryHtml(history: InterviewEntry[], activeIndex: number): string {
  return history.map((entry, index) => '<div class="itv-history-item' + (index === activeIndex ? ' active' : '') + '" data-itv-history-index="' + index + '"><span>' + escInterview(entry.timestamp || `记录 ${index + 1}`) + '</span><button class="itv-history-delete" data-itv-delete-index="' + index + '" title="删除">×</button></div>').reverse().join('');
}

export async function showInterviewContent(primaryInterviewee: string, style: StyleType, requestedIndex?: number, onClosed?: () => void): Promise<void> {
  const overlay = document.getElementById('panelOverlay')!;
  if (!hasInterview(primaryInterviewee)) { if (onClosed) onClosed(); else closePanelOverlay(overlay); return; }
  const history = loadInterview(primaryInterviewee);
  const index = requestedIndex === undefined ? history.length - 1 : Math.max(0, Math.min(requestedIndex, history.length - 1));
  const entry = history[index];
  const parsed = entry.parsedData || parseInterview(entry.content);
  const body = parsed ? renderThemedInterview(parsed, primaryInterviewee, style) : '<pre class="itv-fallback">' + escInterview(entry.content) + '</pre>';
  const busy = isInterviewing(primaryInterviewee);
  // 侧边栏折叠仅由用户点 ◀/▶ 控制；重渲（选不同历史采访/删除某篇）时从持久化值恢复，不自动展开
  const sidebarCollapsed = !getConfig().interviewSidebarOpen;
  ensureStyleOnce('ub-iv-popup-css', INTERVIEW_POPUP_CSS); // F44(十一轮)：样式一次注入常驻
  // 侧栏历史在整壳重建里被换新（元素一起换 ⇒ scrollTop 归零）：同一份档案内切条目/删条目时保位，
  // 换角色＝换主体则回顶（读重建前的 data-itv-primary 判断）。
  const prevItvPrimary = overlay.querySelector('.interview-popup')?.getAttribute('data-itv-primary') || '';
  const restoreItvScroll = prevItvPrimary === primaryInterviewee ? captureScroll(overlay, '.itv-history') : null;
  overlay.innerHTML = '<div class="interview-popup itv-config-' + style + (style === 'bridge' ? ' bridge-window bridge-module-interview' : '') + '" data-itv-primary="' + escInterview(primaryInterviewee) + '" data-itv-active-index="' + index + '">'
    + '<div class="itv-content-topbar"><button class="itv-sidebar-toggle" title="' + (sidebarCollapsed ? '展开侧栏' : '折叠侧栏') + '" aria-label="' + (sidebarCollapsed ? '展开侧栏' : '折叠侧栏') + '">' + (sidebarCollapsed ? '▶' : '◀') + '</button><span class="itv-content-title">' + escInterview(primaryInterviewee) + ' · 采访档案</span><button class="itv-top-action" data-itv-content-action="replay"' + (busy ? ' disabled' : '') + '>' + (busy ? '<span class="ub-busy-spin" aria-hidden="true"></span>采访中…' : '再次采访') + '</button><button class="itv-top-action" data-itv-content-action="clear">清录</button><button class="itv-top-action" data-itv-content-action="edit"' + (busy ? ' disabled' : '') + '>' + rawEditLabel(style) + '</button>' + archiveExportMenuHtml('interview', 'itv-top-action') + '<span class="itv-font-scale"><button class="itv-top-action" data-itv-content-action="font-dec" title="缩小字号">A-</button><span class="itv-font-val">100%</span><button class="itv-top-action" data-itv-content-action="font-inc" title="放大字号">A+</button><button class="itv-top-action" data-itv-content-action="font-reset" title="复位到100%">↺</button></span><button class="itv-config-close" data-itv-content-action="close">×</button></div>'
    + '<div class="itv-content-shell' + (sidebarCollapsed ? ' itv-collapsed' : '') + '"><aside class="itv-history">' + interviewHistoryHtml(history, index) + '</aside><div class="itv-content-main">' + body + '</div></div></div>';
  restoreItvScroll?.();
  if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  const wrapper = document.getElementById('ac-statusbar-wrapper');
  const popup = overlay.querySelector('.interview-popup') as HTMLElement | null;
  if (wrapper && popup) {
    const maxWidth = Math.min(wrapper.offsetWidth - 16, 900);
    if (maxWidth > 320) popup.style.maxWidth = maxWidth + 'px';
  }
  // 字号缩放：读持久化倍率，应用于正文容器并回填顶栏读数与按钮 disabled 态
  const itvFontScale = getConfig().interviewFontScale;
  const itvContentEl = overlay.querySelector<HTMLElement>('.itv-content-main');
  if (itvContentEl) itvContentEl.style.zoom = String(itvFontScale);
  applyFontScaleUI(overlay, itvFontScale);
  markPopupShown();
  overlay.classList.add('show');
  overlay.onclick = async function (event) {
    const target = event.target as HTMLElement;
    if (event.target === overlay) { if (guardGhostClick()) return; if (onClosed) onClosed(); else closePanelOverlay(overlay); return; }
    const archiveTrigger = target.closest<HTMLElement>('[data-archive-export-trigger="interview"]');
    if (archiveTrigger) {
      toggleArchiveExportMenu(archiveTrigger);
      return;
    }
    const archiveOption = target.closest<HTMLElement>('[data-archive-export-format]');
    if (archiveOption) {
      const format = archiveOption.dataset.archiveExportFormat as ArchiveExportFormat;
      await runPopupArchiveExport({
        overlay,
        kind: 'interview',
        format,
        characterName: primaryInterviewee,
        timestamp: entry.timestamp,
        style,
        fontScale: getConfig().interviewFontScale,
        sourceElement: overlay.querySelector<HTMLElement>('.itv-content-main'),
      });
      return;
    }
    closeArchiveExportMenus(overlay);
    // 折叠/展开侧栏按钮（与大调查保持同级 flex 布局，按钮始终在顶栏中）
    if (target.closest('.itv-sidebar-toggle')) {
      const layout = overlay.querySelector('.itv-content-shell') as HTMLElement;
      if (layout) {
        const collapsed = layout.classList.toggle('itv-collapsed');
        const btn = target.closest('.itv-sidebar-toggle') as HTMLElement;
        if (btn) btn.innerHTML = collapsed ? '▶' : '◀';
        if (btn) {
          btn.title = collapsed ? '展开侧栏' : '折叠侧栏';
          btn.setAttribute('aria-label', btn.title);
        }
        setConfig('interviewSidebarOpen', !collapsed);
      }
      return;
    }
    const deleteButton = target.closest<HTMLElement>('[data-itv-delete-index]');
    if (deleteButton) {
      const index = parseInt(deleteButton.dataset.itvDeleteIndex || '', 10);
      if (!Number.isNaN(index) && await showConfirmDialog({ message: '确认删除此条采访记录？' })) {
        await deleteInterview(primaryInterviewee, index);
        const remaining = loadInterview(primaryInterviewee);
        if (remaining.length) await showInterviewContent(primaryInterviewee, style, Math.min(index, remaining.length - 1), onClosed);
        else { if (onClosed) onClosed(); else closePanelOverlay(overlay); }
      }
      return;
    }
    const historyItem = target.closest<HTMLElement>('[data-itv-history-index]');
    if (historyItem) {
      const nextIndex = parseInt(historyItem.dataset.itvHistoryIndex || '', 10);
      if (!Number.isNaN(nextIndex)) await showInterviewContent(primaryInterviewee, style, nextIndex, onClosed);
      return;
    }
    const action = target.closest<HTMLElement>('[data-itv-content-action]')?.dataset.itvContentAction;
    if (action === 'font-dec' || action === 'font-inc' || action === 'font-reset') {
      const cur = getConfig().interviewFontScale;
      const next = nextFontScale(cur, action === 'font-dec' ? 'dec' : action === 'font-inc' ? 'inc' : 'reset');
      if (next !== cur) {
        const contentEl = overlay.querySelector<HTMLElement>('.itv-content-main');
        if (contentEl) contentEl.style.zoom = String(next);
        applyFontScaleUI(overlay, next);
        setConfig('interviewFontScale', next);
      }
      return;
    }
    if (action === 'close') { if (onClosed) onClosed(); else closePanelOverlay(overlay); return; }
    if (action === 'edit') {
      const entry = history[index];
      if (!entry) return;
      showRawTextEditor({
        title: '编辑采访 · ' + primaryInterviewee,
        initialContent: entry.content,
        style,
        onSave: async (content) => { await updateInterviewContent(primaryInterviewee, index, content); },
        afterSave: () => { void showInterviewContent(primaryInterviewee, style, index, onClosed); },
      });
      return;
    }
    if (action === 'replay') { closePanelOverlay(overlay); await showInterviewConfigPopup(primaryInterviewee, style, undefined, onClosed); return; }
    if (action === 'clear' && await showConfirmDialog({ message: '确认清除此角色全部采访记录？' })) {
      await deleteInterview(primaryInterviewee);
      getToastr()?.success('采访记录已清除', '大采访提示');
      if (onClosed) onClosed(); else closePanelOverlay(overlay);
    }
  };
}

// ===== 角色信息弹窗 =====
export function showCharacterInfoPopup(style: StyleType, initialCharacter?: string): void {
  showCharacterHubPopup({
    style,
    initialCharacter,
    openPastExperience: (name, onClosed) => showPastExperiencePopup(name, style, onClosed),
    openInvestigation: (name, btn, onClosed) => showInvestigationPopup(name, style, btn, undefined, undefined, onClosed),
    openInvestigationExtraPrompt: (name, btn, onClosed) => showInvestigationExtraPromptDialog(name, style, btn, onClosed),
    openInterview: (name, btn, onClosed) => hasInterview(name) ? showInterviewContent(name, style, undefined, onClosed) : showInterviewConfigPopup(name, style, btn, onClosed),
    investigationEnabled: !!getConfig().investigationEnabled,
    interviewEnabled: !!getConfig().interviewEnabled,
  });
}

// --- 辅助：构建角色信息卡片 HTML ---
interface CharInfoCardData {
  name: string;
  age: string;
  appearance?: string;
  identity: string;
  intro?: string;
  gender?: string;
  extraLabel?: string;
  extraValue?: string;
}

function buildCharInfoCard(data: CharInfoCardData, isMinimal: boolean): string {
  let card = '<div class="char-info-card">';

  // 姓名行（标题）
  card += '<div class="char-info-card-name">' + escapeHtml(data.name || '—') + '</div>';

  // 信息行
  card += '<div class="char-info-card-rows">';
  if (data.gender) {
    card += (isMinimal
      ? '<div class="info-row"><span class="info-label">性别</span><span class="info-value">' + escapeHtml(data.gender || '—') + '</span></div>'
      : '<div class="detail-row"><span class="dl">性别</span><span class="dv">' + escapeHtml(data.gender || '—') + '</span></div>');
  }
  card += (isMinimal
    ? '<div class="info-row"><span class="info-label">年龄</span><span class="info-value">' + escapeHtml(data.age || '—') + '</span></div>'
    : '<div class="detail-row"><span class="dl">年龄</span><span class="dv">' + escapeHtml(data.age || '—') + '</span></div>');
  if (data.intro) {
    card += (isMinimal
      ? '<div class="info-row"><span class="info-label">简介</span><span class="info-value">' + escapeHtml(data.intro) + '</span></div>'
      : '<div class="detail-row"><span class="dl">简介</span><span class="dv">' + escapeHtml(data.intro) + '</span></div>');
  }
  if (data.appearance) {
    card += (isMinimal
      ? '<div class="info-row"><span class="info-label">外貌</span><span class="info-value">' + escapeHtml(data.appearance) + '</span></div>'
      : '<div class="detail-row"><span class="dl">外貌</span><span class="dv">' + escapeHtml(data.appearance) + '</span></div>');
  }
  card += (isMinimal
    ? '<div class="info-row"><span class="info-label">身份</span><span class="info-value">' + escapeHtml(data.identity || '—') + '</span></div>'
    : '<div class="detail-row"><span class="dl">身份</span><span class="dv">' + escapeHtml(data.identity || '—') + '</span></div>');
  if (data.extraLabel && data.extraValue) {
    card += (isMinimal
      ? '<div class="info-row"><span class="info-label">' + escapeHtml(data.extraLabel) + '</span><span class="info-value">' + escapeHtml(data.extraValue) + '</span></div>'
      : '<div class="detail-row"><span class="dl">' + escapeHtml(data.extraLabel) + '</span><span class="dv">' + escapeHtml(data.extraValue) + '</span></div>');
  }
  card += '</div>'; // .char-info-card-rows

  card += '</div>'; // .char-info-card
  return card;
}

// ===== 玩法示意图弹窗 =====
/** 显示某玩法的示意图（支持多图左右翻页） */
export function showPlayImagePopup(playName: string, style: StyleType): void {
  const imgs = getPlayImageList(playName);
  if (imgs.length === 0) {
    getToastr()?.warning('该玩法暂无示意图', '示意图');
    return;
  }
  const overlay = document.getElementById('panelOverlay')!;
  const isMinimal = style === 'minimal';

  let idx = 0;
  const total = imgs.length;

  function renderFrame(): string {
    const img = imgs[idx];
    const safeName = escapeHtml(playName.trim());
    const safeUrl = escapeHtmlAttr(img.imageUrl);
    let body = '<div class="' + (style === 'bridge' ? bridgeWindowClass('guidance') + ' play-img-popup' : 'panel-popup play-img-popup') + '">';
    body += '<div class="panel-popup-head">';
    body += '<div class="panel-popup-title">' + ubIcon('image') + ' ' + safeName + ' 示意图</div>';
    body += '<button class="panel-popup-close" id="panelClose">&times;</button>';
    body += '</div>';
    body += '<div class="panel-popup-body" style="text-align:center;">';
    body += '<div class="play-img-wrap">';
    body += '<img class="play-img" id="playImgEl" src="' + safeUrl + '" alt="' + safeName + '" />';
    body += '<div class="play-img-error" id="playImgError" style="display:none;">图片加载失败<br><span style="font-size:var(--ub-ui-font-11,11px);opacity:.7;">' + escapeHtml(img.imageUrl) + '</span></div>';
    body += '</div>';
    if (total > 1) {
      body += '<div class="play-img-nav">';
      body += '<button class="play-img-arrow" id="playImgPrev" ' + (idx === 0 ? 'disabled' : '') + '>‹</button>';
      body += '<span class="play-img-counter">' + (idx + 1) + ' / ' + total + '</span>';
      body += '<button class="play-img-arrow" id="playImgNext" ' + (idx === total - 1 ? 'disabled' : '') + '>›</button>';
      body += '</div>';
    }
    body += '</div>';
    body += '</div>';
    return body;
  }

  overlay.innerHTML = renderFrame();
  markPopupShown();
  if (isMinimal) syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  overlay.classList.add('show');

  // 图片加载失败处理
  const imgEl = overlay.querySelector('#playImgEl') as HTMLImageElement | null;
  const errEl = overlay.querySelector('#playImgError') as HTMLElement | null;
  if (imgEl && errEl) {
    imgEl.onerror = function () { imgEl.style.display = 'none'; errEl.style.display = 'block'; };
  }

  overlay.onclick = function (e) {
    const target = e.target as HTMLElement;
    if (e.target === overlay || target.id === 'panelClose') {
      if (guardGhostClick()) return;
      closePanelOverlay(overlay);
      return;
    }
    if (target.id === 'playImgPrev' && idx > 0) {
      idx--; overlay.innerHTML = renderFrame();
      const ni = overlay.querySelector('#playImgEl') as HTMLImageElement | null;
      const ne = overlay.querySelector('#playImgError') as HTMLElement | null;
      if (ni && ne) ni.onerror = function () { ni.style.display = 'none'; ne.style.display = 'block'; };
    } else if (target.id === 'playImgNext' && idx < total - 1) {
      idx++; overlay.innerHTML = renderFrame();
      const ni = overlay.querySelector('#playImgEl') as HTMLImageElement | null;
      const ne = overlay.querySelector('#playImgError') as HTMLElement | null;
      if (ni && ne) ni.onerror = function () { ni.style.display = 'none'; ne.style.display = 'block'; };
    }
  };
}

// ===== 数据库表格查看（只读总览 + 点击行查看/编辑详情） =====
// 直接读取 AutoCardUpdaterAPI.exportTableAsJson() 原始全集，不写常驻缓存；
// _dbTables 仅在弹窗打开期间存在，关闭即清空，满足「无额外资源占用」约束。
interface DbTableView { name: string; headers: string[]; rows: string[][]; sheetKey: string; lockState: TableLockState | null; }
let _dbTables: DbTableView[] = [];
let _dbCurrentTab = 0;        // 当前激活的表索引
let _dbListOverlay: HTMLElement | null = null;  // 总览 overlay 引用（供详情保存后刷新）
let _dbSearchKw = '';        // 当前表搜索词（切表/关弹窗重置为 ''）
let _dbSort: Record<number, DbSortState> = {};  // 各 tab 排序状态（开/关弹窗重置 {}）
// O30：长表首屏渲染上限（纪要等几百行表逐行建卡+每键击整列重建会卡）。
// 打开/切表/搜索/排序时重置为首屏；「加载更多」按批递增；编辑/删除后重渲染保持当前上限不重置。
const DB_RENDER_BATCH = 200;
let _dbRenderLimit = DB_RENDER_BATCH;

/** U14 弹窗壳统一接线：点遮罩或关闭钮 = 关闭意图（各弹窗 onclick 首行共用判定）。 */
/** U70 导出：弹窗「点遮罩空白或关闭按钮(x)关闭」的统一判定（23 文件 47 处手写同款判断，后续批次逐处迁移）。 */
export function popupDismissHit(e: Event): boolean {
  return e.target === e.currentTarget || (e.target as HTMLElement).id === 'panelClose';
}

/** U14 弹窗壳统一关闭：吞长按后补发的合成点击；有 onClose 回调则交给回调（含自行关窗语义），否则走统一关闭。 */
function dismissPopupShell(overlay: HTMLElement, onClose?: () => void): void {
  if (guardGhostClick()) return;
  if (onClose) onClose(); else closePanelOverlay(overlay);
}

/** HTML 转义，防止表内容里的 < > & " 破坏 DOM */
function escDb(s: string): string {
  return escapeHtml(s);
}

/** 锁图标 SVG：未锁=空心锁（锁身描边），已锁=实心锁（锁身填充）。颜色由 CSS .db-lock-icon / .is-locked 的 currentColor 控制。 */
function dbLockIcon(locked: boolean): string {
  const cls = locked ? 'db-lock-icon is-locked' : 'db-lock-icon';
  const bodyFill = locked ? 'currentColor' : 'none';
  return '<svg class="' + cls + '" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">'
    + '<path d="M7 10V8a5 5 0 0 1 10 0v2" fill="none" stroke="currentColor" stroke-width="2"/>'
    + '<rect x="5" y="10" width="14" height="10" rx="2" fill="' + bodyFill + '" stroke="currentColor" stroke-width="2"/>'
    + '</svg>';
}

/** 拼某张表的卡片 HTML。
 *  filteredIdx = 经 filterRows 命中的 displayIdx 数组（空 kw 时为全部行 idx）。
 *  kw 非空时对卡片标题/字段值命中片段插 <mark class="db-hit">（文本须先 escDb 转义）。
 *  每张卡右上加操作区；两张人物表显示迁移按钮，全部表保留 × 删除按钮。 */
function buildDbCardsHtml(t: DbTableView, filteredIdx: number[], kw: string): string {
  const k = (kw || '').trim().toLowerCase();
  const isChronicle = t.sheetKey === 'sheet_summary' || t.name === '纪要表';
  // [LEGACY-MERGE · DB-ONLY] 台账接管时不在状态栏数据库面板显示「N合一」徽章；
  // 几合一由台账工作台「纪要合并」标签展示。后续移除状态栏合并时本段一并删除。
  const mergeChatKey = !isLedgerTakeover() && isChronicle ? getCurrentChatKeyOrNull() : null;
  let h = '<div class="db-cards">';
  if (filteredIdx.length === 0) {
    h += '<div class="db-card db-card-empty">' + (k ? '（无匹配记录）' : '（空表）') + '</div>';
  } else {
    for (let ii = 0; ii < filteredIdx.length; ii++) {
      const i = filteredIdx[ii];
      const row = t.rows[i];
      // 标题 = 第一个有值的列；记录其下标，正文跳过该列避免重复
      let title = '';
      let titleCol = -1;
      for (let c = 0; c < t.headers.length; c++) {
        const v = row[c] != null ? String(row[c]) : '';
        if (v.trim()) { title = v; titleCol = c; break; }
      }
      const migrationTarget = getCharacterMigrationTarget(t.name);
      const rowLockOn = isRowLocked(t.lockState, i + 1);          // i=displayIdx(0-based)，rowIndex=i+1(content 下标)
      const anyLock = hasAnyLock(t.lockState, i + 1);             // 有任意锁→禁删/禁迁
      const actDisabled = anyLock ? ' disabled' : '';
      // 合并产物徽章（仅纪要表 + 当前 chatKey 有效 + 命中标记 store）
      let mergeMark = '';
      if (mergeChatKey) {
        const cnt = getMergedCountForCells(mergeChatKey, t.headers, row);
        if (cnt != null) {
          const label = cnt >= 2 ? (cnt + '合一') : '合并产物';
          const tip = cnt >= 2 ? ('AI 合并产物（' + cnt + ' 条原始纪要压缩）') : 'AI 合并产物（单条压缩）';
          mergeMark = '<span class="db-merge-mark" title="' + escDb(tip) + '">' + ubIcon('link') + escDb(label) + '</span>';
        }
      }
      let actions = '<div class="db-card-actions">';
      if (migrationTarget) {
        const migTitle = anyLock ? '该行有锁定，先解锁再迁移' : ('迁移至' + escDb(migrationTarget));
        actions += '<button class="db-card-migrate" data-migrate="' + i + '" title="' + migTitle + '"' + actDisabled + '>&#8644;</button>';
      }
      actions += '<button class="db-card-lock" data-lock="' + i + '" title="' + (rowLockOn ? '解锁该行' : '锁定该行') + '">' + dbLockIcon(rowLockOn) + '</button>';
      actions += '<button class="db-card-del" data-del="' + i + '" title="' + (anyLock ? '该行有锁定，先解锁再删除' : '删除该记录') + '"' + actDisabled + '>&times;</button></div>';
      h += '<div class="db-card" data-row="' + i + '">';
      h += '<div class="db-card-head">'
        + mergeMark
        + '<div class="db-card-title">' + buildHighlight(escDb(title || '（无标题）'), kw) + '</div>'
        + actions
        + '</div>';
      h += '<div class="db-card-fields">';
      for (let c = 0; c < t.headers.length; c++) {
        if (c === titleCol) continue;             // 标题列不重复
        const v = row[c] != null ? String(row[c]) : '';
        h += '<div class="db-card-field">'
          + '<span class="db-card-label">' + escDb(t.headers[c]) + '</span>'
          + '<span class="db-card-value' + (v.trim() ? '' : ' is-empty') + '">'
          + buildHighlight(escDb(v || '—'), kw) + '</span>'
          + '</div>';
      }
      h += '</div>';
      h += '<div class="db-card-hint">点击查看完整字段 ›</div>';
      h += '</div>';
    }
  }
  h += '</div>';
  return h;
}

/** 第一个非 row_id 列的下标；全表只有 row_id 时回退 0。 */
function firstContentCol(t: DbTableView): number {
  for (let c = 0; c < t.headers.length; c++) {
    if (!isRowIdColumn(t.headers[c])) return c;
  }
  return 0;
}

/** 默认排序：首列升序。 */
function defaultSort(t: DbTableView): DbSortState {
  return { col: firstContentCol(t), dir: 'asc' };
}

/** 排序列下拉：首项「原始顺序」= row_id 列，其后列出其余各列。 */
function buildSortSelectHtml(t: DbTableView, sort: DbSortState): string {
  let rowIdCol = 0;
  for (let c = 0; c < t.headers.length; c++) {
    if (isRowIdColumn(t.headers[c])) { rowIdCol = c; break; }
  }
  let h = '<select class="db-sort-select" id="dbSortSelect">';
  h += '<option value="' + rowIdCol + '"' + (sort.col === rowIdCol ? ' selected' : '') + '>原始顺序</option>';
  for (let c = 0; c < t.headers.length; c++) {
    if (c === rowIdCol) continue;
    h += '<option value="' + c + '"' + (sort.col === c ? ' selected' : '') + '>'
      + escDb(t.headers[c] || ('列' + (c + 1))) + '</option>';
  }
  h += '</select>';
  return h;
}

/** 排序方向钮：显示当前方向，点击翻转。 */
function buildSortDirHtml(dir: SortDir): string {
  return '<button class="db-sort-dir" data-dir="' + dir + '" title="切换升/降序">'
    + (dir === 'asc' ? '↑' : '↓') + '</button>';
}

/** 渲染第 idx 张表到内容区（按 _dbSearchKw 筛选 + 当前排序 + 高亮，含工具栏：新增/排序/计数） */
function renderDbTable(overlay: HTMLElement, idx: number): void {
  const panel = overlay.querySelector('.db-tab-panel') as HTMLElement | null;
  if (!panel || !_dbTables[idx]) return;
  // 卡片条（.db-cards）随面板整块换新、元素被换 ⇒ 双向滚动位置须显式记忆：
  // 「加载更多」加行、行锁、排序方向都是就地刷新，用户滚到哪就留在哪。
  const restoreDbCards = captureScroll(panel, '.db-cards');
  const t = _dbTables[idx];
  if (!_dbSort[idx]) _dbSort[idx] = defaultSort(t);            // 懒填默认排序
  const f = filterRows(t.rows, t.headers, _dbSearchKw);
  const sortedIdx = sortRows(t.rows, t.headers, f.idx, _dbSort[idx]);
  // O30：首屏只渲染 _dbRenderLimit 行，剩余走「加载更多」批递增
  const shownIdx = sortedIdx.length > _dbRenderLimit ? sortedIdx.slice(0, _dbRenderLimit) : sortedIdx;
  let h = '<div class="db-toolbar">'
    + '<button class="db-add-btn" id="dbAddRow"><span class="db-add-icon">＋</span> 新增</button>'
    // [LEGACY-MERGE · DB-ONLY] 台账接管：只留一个纯导航入口（不执行合并）；数据库模式保留合并/一键修复。
    + (t.name === '纪要表'
        ? (isLedgerTakeover()
            ? (ledgerSupportsSummaryMerge() ? '<button class="db-add-btn" id="dbOpenLedgerMerge" type="button">⇉ 去台账合并</button>' : '')
            : '<button class="db-add-btn db-merge-btn" id="dbMergeChronicle"' + (isSqliteMode() ? '' : ' disabled title="需要数据库插件 SQLite 模式"') + '>'+ ubIcon('gear') + ' 合并纪要</button>'
              + '<button class="db-add-btn db-repair-btn" id="dbRepairChronicle"' + (isSqliteMode() ? '' : ' disabled title="需要数据库插件 SQLite 模式"') + '>' + ubIcon('wrench') + ' 一键修复</button>')
        : '')
    + buildSortSelectHtml(t, _dbSort[idx])
    + buildSortDirHtml(_dbSort[idx].dir)
    + '<span class="db-count' + (_dbSearchKw.trim() ? '' : ' is-hidden') + '">'
    + f.hits + ' / ' + t.rows.length + '</span>'
    + '</div>';
  h += buildDbCardsHtml(t, shownIdx, _dbSearchKw);
  if (sortedIdx.length > shownIdx.length) {
    h += '<div class="db-load-more-wrap"><button id="dbLoadMore" class="db-add-btn" type="button">加载更多（还有 '
      + (sortedIdx.length - shownIdx.length) + ' 行）</button></div>';
  }
  panel.innerHTML = h;
  restoreDbCards();
}

/** 保存后重新读取单张表并刷新总览对应面板 */
function reloadDbTable(idx: number): void {
  const t = _dbTables[idx];
  if (!t) return;
  const sheet = getSheetByName(t.name);
  if (!sheet || !Array.isArray(sheet.content)) return;
  const headers = (sheet.content[0] || []).map((h: string, i: number) =>
    String(h == null ? '' : h).trim() || ('列' + (i + 1)));
  const rows = sheet.content.slice(1).map((r: string[]) => Array.isArray(r) ? r : []);
  _dbTables[idx] = { name: t.name, headers, rows, sheetKey: t.sheetKey, lockState: t.lockState };
}

/** 刷新两张人物表、标签数量和当前面板；保留当前标签与搜索词。 */
function refreshDbCharacterTables(overlay: HTMLElement): void {
  for (let i = 0; i < _dbTables.length; i++) {
    if (getCharacterMigrationTarget(_dbTables[i].name)) reloadDbTable(i);
  }
  overlay.querySelectorAll('.db-tab').forEach(function (tabEl) {
    const tab = tabEl as HTMLElement;
    const idx = parseInt(tab.dataset.tab || '-1', 10);
    const badge = tab.querySelector('.db-tab-badge');
    if (badge && idx >= 0 && _dbTables[idx]) badge.textContent = String(_dbTables[idx].rows.length);
  });
  renderDbTable(overlay, _dbCurrentTab);
}

/** 三按钮保存确认（保存修改 / 不保存 / 继续编辑），Promise */
function dbConfirmUnsaved(style: StyleType): Promise<'save' | 'discard' | 'keep'> {
  return new Promise(function (resolve) {
    const cov = document.createElement('div');
    cov.className = 'panel-overlay db-confirm-overlay show';
    cov.style.zIndex = '10020';
    let ch = '<div class="' + (style === 'bridge' ? bridgeWindowClass('confirm','s') + ' db-confirm-popup' : 'panel-popup db-confirm-popup ub-popup--s') + '">';
    ch += '<div class="panel-popup-head"><div class="panel-popup-title">未保存的修改</div></div>';
    ch += '<div class="db-confirm-body">该行有未保存的修改，是否保存？<br><span style="font-size:var(--ub-ui-font-11,11px);opacity:.7">「不保存」将丢弃修改并关闭</span></div>';
    ch += '<div class="db-confirm-actions">';
    ch += '<button class="db-edit-btn primary" id="dbCfSave">保存修改</button>';
    ch += '<button class="db-edit-btn" id="dbCfDiscard">不保存</button>';
    ch += '<button class="db-edit-btn" id="dbCfKeep">继续编辑</button>';
    ch += '</div></div>';
    if (style === 'minimal') syncDarkClassMinimal(cov); else syncDarkClass(cov);
    cov.innerHTML = ch;
    document.body.appendChild(cov);
    markPopupShown(); // U8：压返回键守卫（打开即登记，关闭时由 closePanelOverlay 归还）
    function done(v: 'save' | 'discard' | 'keep'): void { closePanelOverlay(cov); cov.remove(); resolve(v); }
    cov.querySelector('#dbCfSave')!.addEventListener('click', function () { done('save'); });
    cov.querySelector('#dbCfDiscard')!.addEventListener('click', function () { done('discard'); });
    cov.querySelector('#dbCfKeep')!.addEventListener('click', function () { done('keep'); });
  });
}

/** 解锁二次确认（防误解锁导致数据被 AI 覆盖）。复用 db-confirm-popup 样式。 */
function dbConfirmUnlock(style: StyleType, message: string): Promise<boolean> {
  return new Promise(function (resolve) {
    const cov = document.createElement('div');
    cov.className = 'panel-overlay db-confirm-overlay show';
    cov.style.zIndex = '10020';
    let ch = '<div class="' + (style === 'bridge' ? bridgeWindowClass('confirm','s') + ' db-confirm-popup' : 'panel-popup db-confirm-popup ub-popup--s') + '">';
    ch += '<div class="panel-popup-head"><div class="panel-popup-title">确认解锁</div></div>';
    ch += '<div class="db-confirm-body">' + escDb(message) + '<br><span style="font-size:var(--ub-ui-font-11,11px);opacity:.7">解锁后 AI 自动填表可再次修改该数据</span></div>';
    ch += '<div class="db-confirm-actions">';
    ch += '<button class="db-edit-btn primary" id="dbUnlockConfirm">确认解锁</button>';
    ch += '<button class="db-edit-btn" id="dbUnlockCancel">取消</button>';
    ch += '</div></div>';
    if (style === 'minimal') syncDarkClassMinimal(cov); else syncDarkClass(cov);
    cov.innerHTML = ch;
    document.body.appendChild(cov);
    markPopupShown(); // U8：压返回键守卫（打开即登记，关闭时由 closePanelOverlay 归还）
    function done(v: boolean): void { closePanelOverlay(cov); cov.remove(); resolve(v); }
    cov.querySelector('#dbUnlockConfirm')!.addEventListener('click', function () { done(true); });
    cov.querySelector('#dbUnlockCancel')!.addEventListener('click', function () { done(false); });
  });
}

/** 人物表迁移确认弹窗。写库期间禁用操作，结果由核心模块统一判定。 */
function showDbMigrationConfirm(snapshot: CharacterMigrationSnapshot, style: StyleType): void {
  const cov = document.createElement('div');
  cov.className = 'panel-overlay db-confirm-overlay show';
  cov.style.zIndex = '10020';
  let ch = '<div class="' + (style === 'bridge' ? bridgeWindowClass('confirm','s') + ' db-confirm-popup' : 'panel-popup db-confirm-popup ub-popup--s') + '">';
  ch += '<div class="panel-popup-head"><div class="panel-popup-title">迁移人物</div></div>';
  ch += '<div class="db-confirm-body">是否确认将「' + escDb(snapshot.name) + '」迁移至'
    + escDb(snapshot.targetTable) + '？</div>';
  ch += '<div class="db-confirm-actions">';
  ch += '<button class="db-edit-btn primary" id="dbMigrateConfirm">确认迁移</button>';
  ch += '<button class="db-edit-btn" id="dbMigrateCancel">取消</button>';
  ch += '</div></div>';
  if (style === 'minimal') syncDarkClassMinimal(cov); else syncDarkClass(cov);
  cov.innerHTML = ch;
  document.body.appendChild(cov);
  markPopupShown(); // U8：压返回键守卫（打开即登记，关闭时由 closePanelOverlay 归还）

  const confirmBtn = cov.querySelector('#dbMigrateConfirm') as HTMLButtonElement;
  const cancelBtn = cov.querySelector('#dbMigrateCancel') as HTMLButtonElement;
  confirmBtn.addEventListener('click', function () {
    void (async function () {
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      confirmBtn.textContent = '迁移中…';
      const migrationResult = await migrateCharacter(snapshot);
      const toastr = getToastr();
      if (migrationResult.code === 'migrated') {
        toastr?.success('已将「' + snapshot.name + '」迁移至' + snapshot.targetTable, '数据库');
      } else if (migrationResult.code === 'target_conflict') {
        toastr?.warning(snapshot.targetTable + '已存在「' + snapshot.name + '」，无法迁移', '数据库');
      } else if (migrationResult.code === 'source_changed') {
        toastr?.warning('该记录已被外部修改，已刷新', '数据库');
      } else if (migrationResult.code === 'unsupported_mode') {
        toastr?.error('当前数据库模式不支持人物迁移', '数据库');
      } else if (migrationResult.code === 'read_failed') {
        toastr?.error('数据库读取失败，请重试', '数据库');
      } else if (migrationResult.code === 'constraint_failed') {
        toastr?.error('迁移失败：请检查人物字段是否满足目标表约束', '数据库');
      } else {
        toastr?.error('迁移失败，请重试', '数据库');
      }
      if (
        _dbListOverlay
        && migrationResult.code !== 'unsupported_mode'
        && migrationResult.code !== 'invalid_table'
      ) {
        refreshDbCharacterTables(_dbListOverlay);
      }
      closePanelOverlay(cov); cov.remove();
    })();
  });
  cancelBtn.addEventListener('click', function () { closePanelOverlay(cov); cov.remove(); });
}
/** 删除确认弹窗。系统表二次确认（按钮变红）+ 风险红字；普通表单次确认。
 *  fromDetailOverlay 非空表示从行详情页入口触发，删除成功后需一并关闭该详情 overlay。 */
function showDbDeleteConfirm(
  table: DbTableView,
  displayIdx: number,
  style: StyleType,
  fromDetailOverlay?: HTMLElement,
): void {
  const isSystem = classifyTableSafety(table.name) === 'system';

  const cov = document.createElement('div');
  cov.className = 'panel-overlay db-confirm-overlay show';
  cov.style.zIndex = '10020';
  // 实体用字符串拼接写出，避免源码被工具解码
  const WARN = ubIcon('warning');   // warning 图标
  let ch = '<div class="' + (style === 'bridge' ? bridgeWindowClass('confirm','s') + ' db-confirm-popup' : 'panel-popup db-confirm-popup ub-popup--s') + '">';
  ch += '<div class="panel-popup-head"><div class="panel-popup-title">删除记录</div></div>';
  ch += '<div class="db-confirm-body">确定删除该记录？此操作不可撤销。</div>';
  if (isSystem) {
    ch += '<div class="db-del-confirm-warn">' + WARN + ' 这是系统表，删除可能影响状态栏显示与游戏逻辑</div>';
  }
  ch += '<div class="db-confirm-actions">';
  ch += '<button class="db-edit-btn primary db-danger" id="dbDelConfirm">删除</button>';
  ch += '<button class="db-edit-btn" id="dbDelCancel">取消</button>';
  ch += '</div></div>';
  if (style === 'minimal') syncDarkClassMinimal(cov); else syncDarkClass(cov);
  cov.innerHTML = ch;
  document.body.appendChild(cov);
  markPopupShown(); // U8：压返回键守卫（打开即登记，关闭时由 closePanelOverlay 归还）

  const confirmBtn = cov.querySelector('#dbDelConfirm') as HTMLButtonElement;
  const cancelBtn = cov.querySelector('#dbDelCancel') as HTMLButtonElement;
  let armed = false;   // 系统表二次确认 armed 标志

  async function doDelete(): Promise<void> {
    confirmBtn.disabled = true; cancelBtn.disabled = true;
    confirmBtn.textContent = '删除中…';
    // 行号校验：取该行首个非空列值定位，防快照过期删错行
    const t = _dbTables[_dbCurrentTab];
    if (!t || t.name !== table.name) { closePanelOverlay(cov); cov.remove(); return; }   // 表已切走，放弃
    const snapRow = table.rows[displayIdx];
    let locateCol = -1, locateVal = '';
    for (let c = 0; c < table.headers.length; c++) {
      const v = snapRow != null && snapRow[c] != null ? String(snapRow[c]) : '';
      if (v.trim()) { locateCol = c; locateVal = v; break; }
    }
    const realIdx = displayIdx + 1;
    if (locateCol >= 0) {
      const found = findRowByColumn(table.name, table.headers[locateCol], locateVal);
      if (found !== realIdx) {
        getToastr()?.warning('该记录已被外部修改，已刷新', '数据库');
        invalidateCache();
        if (_dbListOverlay) { reloadDbTable(_dbCurrentTab); renderDbTable(_dbListOverlay, _dbCurrentTab); }
        closePanelOverlay(cov); cov.remove();
        return;   // 中止删除（安全行为）
      }
    }
    // 试点三表按稳定 row_id 走 SQL 优先；其他表保持原生按行索引删除。
    let ok: boolean;
    let failureMessage = '';
    if (isSqlPilotTableName(table.name)) {
      const result = await deleteContentRowSqlFirstDetailed(table.name, realIdx);
      ok = result.ok;
      if (!result.ok) failureMessage = result.failure.message;
    } else {
      ok = await deleteRow(table.name, realIdx);
    }
    closePanelOverlay(cov); cov.remove();
    if (ok) {
      getToastr()?.success('已删除', '数据库');
      if (_dbListOverlay) { reloadDbTable(_dbCurrentTab); renderDbTable(_dbListOverlay, _dbCurrentTab); }
      if (fromDetailOverlay) fromDetailOverlay.remove();
    } else {
      getToastr()?.error(failureMessage || '删除失败', '数据库');
    }
  }

  confirmBtn.addEventListener('click', function () {
    if (isSystem && !armed) {
      armed = true;
      confirmBtn.textContent = '再次确认删除';
      confirmBtn.classList.add('db-danger-armed');   // 变红
      return;
    }
    void doDelete();
  });
  cancelBtn.addEventListener('click', function () { closePanelOverlay(cov); cov.remove(); });
}

/** 在一个独立 overlay 中显示某行详情（可只读/可编辑，编辑保存需确认，仅确认才写库）。
 *  mode='new' 时进入"新增记录"模式：全字段预填空、直接编辑态、保存调 insertRow。 */
function showDbRowDetail(table: DbTableView, displayIdx: number, style: StyleType, mode?: 'new'): void {
  const headers = table.headers;
  const isNew = mode === 'new';
  const contentRowIndex = isNew ? -1 : displayIdx + 1; // 新建无行号；编辑沿用 content 数组下标（1=首条数据行）
  const rowTitle = isNew ? '新增记录' : '第 ' + (displayIdx + 1) + ' 行';
  const btnLabel = isNew ? '＋ 创建' : ubIcon('pencil') + ' 编辑';

  // 原始值（只读基准，用于脏检查与保存）：编辑态取该行；新建态全空字符串（不解析 DDL）
  let original: string[] = isNew
    ? headers.map(function () { return ''; })
    : headers.map(function (_, c) {
        return String(table.rows[displayIdx] != null && table.rows[displayIdx][c] != null ? table.rows[displayIdx][c] : '');
      });
  let editing = isNew;   // 新建直接进入编辑态

  const ov = document.createElement('div');
  ov.className = 'panel-overlay db-row-detail-overlay show';
  ov.style.zIndex = '10010';
  document.body.appendChild(ov);
  markPopupShown();

  let html = '<div class="' + (style === 'bridge' ? bridgeWindowClass('database','l') + ' db-row-detail-popup' : 'panel-popup db-row-detail-popup ub-popup--l') + '">';
  html += '<div class="panel-popup-head"><div class="panel-popup-title">' + escDb(table.name) + ' · ' + rowTitle + '</div>';
  html += '<div class="db-edit-actions">';
  if (!isNew) {
    html += '<button class="db-edit-btn db-danger" id="dbRowDelete" title="删除该记录">' + ubIcon('trash') + ' 删除</button>';
    // 行锁按钮：初始未锁态，refreshLockUi 会按当前锁状态修正图标/文案/disabled
    html += '<button class="db-edit-btn db-row-lock-btn" id="dbRowLock" title="锁定该行">' + dbLockIcon(false) + '<span>锁定该行</span></button>';
  }
  html += '<button class="db-edit-btn" id="dbRowEdit">' + btnLabel + '</button>';
  html += '<button class="panel-popup-close" id="dbRowClose">&times;</button>';
  html += '</div></div>';
  html += '<div class="panel-popup-body" id="dbRowBody"></div>';
  html += '</div>';

  if (style === 'minimal') syncDarkClassMinimal(ov); else syncDarkClass(ov);
  ov.innerHTML = html;

  const body = ov.querySelector('#dbRowBody') as HTMLElement;
  const editBtn = ov.querySelector('#dbRowEdit') as HTMLElement;

  /** 只读视图：列名 → 值（行未锁时字段标签旁附单元格锁按钮） */
  function renderRead(): void {
    const rowLocked = isRowLocked(table.lockState, contentRowIndex);
    let h = '';
    for (let c = 0; c < headers.length; c++) {
      const isRowId = isRowIdColumn(headers[c]);
      const showCellLock = !isRowId && !rowLocked;
      const cellLocked = showCellLock && isCellLocked(table.lockState, contentRowIndex, c);
      const lockBtn = showCellLock
        ? '<button class="db-cell-lock-btn" data-cell-lock="' + c + '" title="' + (cellLocked ? '解锁该字段' : '锁定该字段') + '">' + dbLockIcon(cellLocked) + '</button>'
        : '';
      h += '<div class="db-row-field"><span class="db-row-field-label">' + lockBtn + escDb(headers[c]) + '</span>';
      if (isRowId) {
        h += '<div class="db-row-field-value db-row-field-readonly">' + escDb(original[c]) + ' <span class="db-readonly-hint">系统主键</span></div></div>';
      } else {
        h += '<div class="db-row-field-value">' + escDb(original[c]) + '</div></div>';
      }
    }
    if (headers.length === 0) h = '<div class="panel-empty">（无字段）</div>';
    body.innerHTML = h;
    editBtn.innerHTML = isNew ? btnLabel : ubIcon('pencil') + ' 编辑';
    if (!isNew) refreshLockUi();
  }

  /** 编辑视图：列名 → textarea（预填当前值；被锁单元格 readonly） */
  function renderEdit(): void {
    const rowLocked = !isNew && isRowLocked(table.lockState, contentRowIndex);
    let h = '';
    for (let c = 0; c < headers.length; c++) {
      const isRowId = isRowIdColumn(headers[c]);
      const showCellLock = !isNew && !isRowId && !rowLocked;
      const cellLocked = showCellLock && isCellLocked(table.lockState, contentRowIndex, c);
      const lockBtn = showCellLock
        ? '<button class="db-cell-lock-btn" data-cell-lock="' + c + '" disabled title="' + (cellLocked ? '编辑态下不可解锁，先保存或取消编辑' : '编辑态下不可锁定，先保存或取消编辑') + '">' + dbLockIcon(cellLocked) + '</button>'
        : '';
      h += '<div class="db-row-field' + (cellLocked ? ' is-cell-locked' : '') + '"><span class="db-row-field-label">' + lockBtn + escDb(headers[c]) + '</span>';
      if (isRowId) {
        // row_id 是系统自增主键（MAX(row_id)+1），不可填写/不可修改：只读展示
        const hint = isNew ? '（系统自动分配）' : (escDb(original[c]) + ' <span class="db-readonly-hint">系统主键·不可修改</span>');
        h += '<div class="db-row-field-value db-row-field-readonly">' + hint + '</div></div>';
      } else if (cellLocked) {
        // 被锁单元格：只读 textarea，不可编辑（commitSave 也会跳过写该字段，避免触发原生锁）
        h += '<textarea data-col="' + c + '" readonly>' + escDb(original[c]) + '</textarea></div>';
      } else {
        h += '<textarea data-col="' + c + '">' + escDb(original[c]) + '</textarea></div>';
      }
    }
    if (headers.length === 0) h = '<div class="panel-empty">（无字段）</div>';
    body.innerHTML = h;
    editBtn.innerHTML = isNew ? '＋ 创建' : ubIcon('save') + ' 保存';
    if (!isNew) refreshLockUi();
  }

  /** 读取当前编辑区值 */
  function readEdited(): string[] {
    const vals = original.slice();
    body.querySelectorAll('textarea[data-col]').forEach(function (ta) {
      const c = parseInt((ta as HTMLTextAreaElement).dataset.col || '0', 10);
      vals[c] = (ta as HTMLTextAreaElement).value;
    });
    return vals;
  }

  /** 是否有改动 */
  function isDirty(): boolean {
    if (!editing) return false;
    const cur = readEdited();
    for (let c = 0; c < original.length; c++) {
      if (cur[c] !== original[c]) return true;
    }
    return false;
  }

  /** 真正写库（仅此处写） */
  async function commitSave(): Promise<boolean> {
    const cur = readEdited();
    const data: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      if (isRowIdColumn(headers[c])) continue;   // row_id 由系统自增分配，不可写入
      if (!isNew && isCellLocked(table.lockState, contentRowIndex, c)) continue;  // 被锁单元格跳过，避免写时触发原生锁
      data[headers[c]] = cur[c];
    }
    if (isNew) {
      let created = false;
      if (isSqlPilotTableName(table.name)) {
        created = await insertContentRowSqlFirst(table.name, data);
      } else {
        // 非试点表保留原生 insertRow，以拿返回值精确判断是否创建成功。
        const api = getAutoCardAPI();
        if (!api || typeof api.insertRow !== 'function') {
          getToastr()?.error('新增失败：数据库未连接', '数据库');
          return false;
        }
        try {
          const rowIndex = await api.insertRow(table.name, data);
          created = rowIndex != null && rowIndex >= 0;
        } catch (e) {
          console.error('insertRow threw:', e);
        }
        if (created) invalidateCache();
      }
      if (!created) {
        getToastr()?.error('新增失败：请检查字段是否满足表约束', '数据库');
        return false;
      }
      original = cur;
      getToastr()?.success('已新增记录', '数据库');
      if (_dbListOverlay && _dbTables[_dbCurrentTab] && _dbTables[_dbCurrentTab].name === table.name) {
        reloadDbTable(_dbCurrentTab);
        renderDbTable(_dbListOverlay, _dbCurrentTab);   // 搜索态非空时 renderDbTable 内自动重跑 filterRows
      }
      return true;
    }
    // 编辑：沿用 updateRow
    const ok = await updateRow(table.name, contentRowIndex, data);
    if (ok) {
      original = cur;          // 更新基准，保存后即"无改动"
      getToastr()?.success('已保存修改', '数据库');
      // 刷新总览对应表
      if (_dbListOverlay && _dbTables[_dbCurrentTab] && _dbTables[_dbCurrentTab].name === table.name) {
        reloadDbTable(_dbCurrentTab);
        renderDbTable(_dbListOverlay, _dbCurrentTab);
      }
    } else {
      getToastr()?.error('保存失败，请重试', '数据库');
    }
    return ok;
  }

  /** 关闭详情（含脏检查） */
  async function closeDetail(): Promise<void> {
    if (isDirty()) {
      const choice = await dbConfirmUnsaved(style);
      if (choice === 'keep') return;            // 留在编辑态
      if (choice === 'save') {
        const ok = await commitSave();
        if (!ok) return;                         // 保存失败，不关闭
      }
      // discard：直接关闭
    }
    ov.remove();
  }

  /** 刷新头部按钮的锁态：行锁按钮图标/文案/disabled、删除/编辑按钮 disabled。 */
  function refreshLockUi(): void {
    const rowLocked = isRowLocked(table.lockState, contentRowIndex);
    const anyLock = hasAnyLock(table.lockState, contentRowIndex);
    const lockBtn = ov.querySelector('#dbRowLock') as HTMLButtonElement | null;
    if (lockBtn) {
      lockBtn.disabled = editing;            // 编辑态禁用行锁按钮（避免编辑态+行锁复杂交互）
      if (!editing) {
        lockBtn.title = rowLocked ? '解锁该行' : '锁定该行';
        lockBtn.innerHTML = dbLockIcon(rowLocked) + '<span>' + (rowLocked ? '解锁该行' : '锁定该行') + '</span>';
      }
    }
    const delBtn = ov.querySelector('#dbRowDelete') as HTMLButtonElement | null;
    if (delBtn) {
      delBtn.disabled = anyLock;
      delBtn.title = anyLock ? '该行有锁定，先解锁再删除' : '删除该记录';
    }
    const editBtnEl = ov.querySelector('#dbRowEdit') as HTMLButtonElement | null;
    if (editBtnEl) {
      if (editing) {
        editBtnEl.disabled = false;          // 编辑态=保存按钮，保持可用
      } else {
        editBtnEl.disabled = rowLocked;
        editBtnEl.title = rowLocked ? '该行已锁定，先解锁再操作' : '';
      }
    }
  }

  /** toggle 行锁：锁定直接生效，解锁需二次确认。成功后更新本地 lockState + 重渲染（保持 editing 态）。 */
  async function toggleRowLock(): Promise<void> {
    if (isNew) return;
    const rowIndex = contentRowIndex;
    const wasLocked = isRowLocked(table.lockState, rowIndex);
    const willLock = !wasLocked;
    if (!willLock) {
      const ok = await dbConfirmUnlock(style, '确认解锁该行？');
      if (!ok) return;
    }
    const success = await setRowLock(table.sheetKey, rowIndex, willLock);
    if (!success) {
      getToastr()?.error('锁定操作失败，请重试', '数据库');
      return;
    }
    if (table.lockState) {
      const arr = table.lockState.rows;
      const pos = arr.indexOf(rowIndex);
      if (willLock && pos < 0) arr.push(rowIndex);
      else if (!willLock && pos >= 0) arr.splice(pos, 1);
    } else if (willLock) {
      table.lockState = { rows: [rowIndex], cols: [], cells: [] };
    }
    if (editing) renderEdit(); else renderRead();
  }

  /** toggle 单元格锁：仅在只读态触发（编辑态按钮 disabled）。锁定直接生效，解锁需二次确认。 */
  async function toggleCellLock(colIndex: number): Promise<void> {
    if (isNew) return;
    const rowIndex = contentRowIndex;
    const cellKey = rowIndex + ':' + colIndex;
    const wasLocked = !!(table.lockState && Array.isArray(table.lockState.cells) && table.lockState.cells.indexOf(cellKey) >= 0);
    const willLock = !wasLocked;
    if (!willLock) {
      const ok = await dbConfirmUnlock(style, '确认解锁该字段？');
      if (!ok) return;
    }
    const success = await setCellLock(table.sheetKey, rowIndex, colIndex, willLock);
    if (!success) {
      getToastr()?.error('锁定操作失败，请重试', '数据库');
      return;
    }
    if (table.lockState) {
      const arr = table.lockState.cells;
      const pos = arr.indexOf(cellKey);
      if (willLock && pos < 0) arr.push(cellKey);
      else if (!willLock && pos >= 0) arr.splice(pos, 1);
    } else if (willLock) {
      table.lockState = { rows: [], cols: [], cells: [cellKey] };
    }
    renderRead();
  }

  // 新建态直接进编辑视图；编辑态先只读视图
  if (isNew) renderEdit(); else renderRead();

  // 点击遮罩或关闭按钮 = 关闭（走脏检查）；编辑按钮切换编辑态/保存
  ov.addEventListener('click', function (e: MouseEvent) {
    if (guardGhostClick()) return;
    if (e.target === ov) { void closeDetail(); return; }
    const t = e.target as HTMLElement;
    if (t.closest('#dbRowClose')) { void closeDetail(); return; }
    // 单元格锁按钮（仅只读态可点，编辑态 disabled）
    const cellLockEl = t.closest('.db-cell-lock-btn') as HTMLElement | null;
    if (cellLockEl) {
      const c = parseInt(cellLockEl.dataset.cellLock || '-1', 10);
      if (c >= 0) void toggleCellLock(c);
      return;
    }
    if (t.closest('#dbRowLock') && !isNew) {
      void toggleRowLock();
      return;
    }
    if (t.closest('#dbRowDelete') && !isNew) {
      // 行详情入口删除：弹确认；删除成功后由 showDbDeleteConfirm 关闭详情 overlay
      // 防御：有任意锁时删除按钮已 disabled，二次确认前再校验
      if (hasAnyLock(table.lockState, contentRowIndex)) {
        getToastr()?.warning('该行有锁定，先解锁再删除', '数据库');
        return;
      }
      showDbDeleteConfirm(table, displayIdx, style, ov);
      return;
    }
    if (t.closest('#dbRowEdit')) {
      if (!editing) {
        if (!isNew && isRowLocked(table.lockState, contentRowIndex)) {
          getToastr()?.warning('该行已锁定，先解锁再操作', '数据库');
          return;
        }
        editing = true;
        renderEdit();
      } else {
        // 编辑/新建态下按钮即"保存/创建"
        void (async function () {
          const ok = await commitSave();
          if (ok) {
            if (isNew) { ov.remove(); }       // 新建成功直接关闭详情
            else { editing = false; renderRead(); }
          }
        })();
      }
    }
  });
}

export function showDatabasePopup(style: StyleType): void {
  const overlay = document.getElementById('panelOverlay')!;
  const isMinimal = style === 'minimal';

  // 取原始全集（不写 _allSheetsCache）
  const API = getAutoCardAPI();
  const all = API ? API.exportTableAsJson() : {};
  const tables: DbTableView[] = [];
  for (const key in all) {
    if (!key.startsWith('sheet_')) continue;
    const sheet = all[key];
    if (!sheet || !Array.isArray(sheet.content)) continue;
    const headers = (sheet.content[0] || []).map((h: string, i: number) =>
      String(h == null ? '' : h).trim() || ('列' + (i + 1)));
    const rows = sheet.content.slice(1).map((r: string[]) => Array.isArray(r) ? r : []);
    const sheetKey = String(sheet.key || key);   // sheet_xxx，锁定 API 需要
    tables.push({ name: String(sheet.name || key), headers, rows, sheetKey, lockState: getTableLockState(sheetKey) });
  }
  tables.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  _dbTables = tables;
  _dbCurrentTab = 0;
  _dbSearchKw = '';            // 每次打开重置搜索
  _dbSort = {};                // 每次打开重置排序
  _dbRenderLimit = DB_RENDER_BATCH;   // O30：首屏上限重置
  _dbListOverlay = overlay;

  let html = '<div class="' + (style === 'bridge' ? bridgeWindowClass('database','l') + ' db-viewer-popup' : 'panel-popup db-viewer-popup ub-popup--l') + '">';
  html += '<div class="panel-popup-head">';
  html += '<div class="panel-popup-title">数据库总览</div>';
  html += '<input class="db-search" type="search" id="dbSearchInput" placeholder="搜索当前表…" autocomplete="off" value="' + escDb(_dbSearchKw) + '">';
  html += '<button class="panel-popup-close" id="panelClose">&times;</button>';
  html += '</div>';
  html += '<div class="panel-popup-body">';
  if (tables.length === 0) {
    html += '<div class="panel-empty">数据库未连接或暂无表格</div>';
  } else {
    html += '<div class="db-tabs">';
    for (let i = 0; i < tables.length; i++) {
      html += '<button class="db-tab" data-tab="' + i + '"' + (i === 0 ? ' data-active="1"' : '') + '>'
        + '<span class="db-tab-name">' + escDb(tables[i].name) + '</span>'
        + '<span class="db-tab-badge">' + tables[i].rows.length + '</span>'
        + '</button>';
    }
    html += '</div>';
    html += '<div class="db-tab-panel"></div>';
  }
  html += '</div></div>';

  if (isMinimal) syncDarkClassMinimal(overlay);
  else syncDarkClass(overlay);
  overlay.innerHTML = html;
  markPopupShown();
  overlay.classList.add('show');

  if (tables.length > 0) renderDbTable(overlay, 0);

  // [LEGACY-MERGE · DB-ONLY] 台账接管：状态栏合并停用——中断仍在跑的旧会话（防止继续写库），不显示恢复提示。
  if (isLedgerTakeover()) {
    if (isChronicleMergeActive()) abortCurrentMerge();
  } else if (tables.length > 0 && !isChronicleMergeActive()) {
    showChronicleMergeResumePrompt();
  }

  // 搜索框：150ms 节流，输入即按当前表筛选重渲染
  const searchInput = overlay.querySelector('#dbSearchInput') as HTMLInputElement | null;
  if (searchInput) {
    let timer: number | null = null;
    searchInput.addEventListener('input', function () {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        if (!overlay.isConnected) return;   // 弹窗已关闭，丢弃本次节流回调
        _dbSearchKw = searchInput.value;
        _dbRenderLimit = DB_RENDER_BATCH;   // O30：新搜索从头翻页
        renderDbTable(overlay, _dbCurrentTab);
      }, 150);
    });
  }

  // 列下拉：切换排序列，保留当前方向。属性赋值：常驻 overlay 每次打开覆盖旧 handler，避免累积
  overlay.onchange = function (e) {
    const sel = (e.target as HTMLElement).closest('.db-sort-select') as HTMLSelectElement | null;
    if (!sel || !overlay.isConnected) return;
    const t = _dbTables[_dbCurrentTab];
    if (!t) return;
    const col = parseInt(sel.value, 10);
    const cur = _dbSort[_dbCurrentTab];
    _dbSort[_dbCurrentTab] = { col, dir: cur ? cur.dir : 'asc' };
    _dbRenderLimit = DB_RENDER_BATCH;   // O30：新排序从头翻页
    renderDbTable(overlay, _dbCurrentTab);
  };

  overlay.onclick = function (e) {
    if (e.target === overlay || (e.target as HTMLElement).id === 'panelClose') {
      if (guardGhostClick()) return;
      _dbTables = [];
      _dbSearchKw = '';
      _dbSort = {};
      _dbRenderLimit = DB_RENDER_BATCH;   // O30：关闭重置首屏上限
      _dbListOverlay = null;
      closePanelOverlay(overlay);
      return;
    }
    const tab = (e.target as HTMLElement).closest('.db-tab') as HTMLElement | null;
    if (tab) {
      const idx = parseInt(tab.dataset.tab || '0', 10);
      overlay.querySelectorAll('.db-tab').forEach(function (el) { el.removeAttribute('data-active'); });
      tab.setAttribute('data-active', '1');
      _dbCurrentTab = idx;
      _dbRenderLimit = DB_RENDER_BATCH;   // O30：切表从头翻页
      // 切表保留搜索词：搜索是对"当前表"的跨列筛选, 同一词可继续在另一张表里命中,
      // 用户切表对比时无需重输。renderDbTable 用当前 _dbSearchKw 对新表筛选(空则全表)。
      renderDbTable(overlay, idx);
      return;
    }
    // 新增按钮 → 当前表新建一行
    if ((e.target as HTMLElement).closest('#dbAddRow')) {
      const t = _dbTables[_dbCurrentTab];
      if (t) showDbRowDetail(t, -1, style, 'new');
      return;
    }
    // O30：加载更多 → 追加下一批（不重置上限）
    if ((e.target as HTMLElement).closest('#dbLoadMore')) {
      _dbRenderLimit += DB_RENDER_BATCH;
      renderDbTable(overlay, _dbCurrentTab);
      return;
    }
    // [LEGACY-MERGE · DB-ONLY] 台账接管：导航到台账「纪要合并」标签（只跳转，不执行）。
    if ((e.target as HTMLElement).closest('#dbOpenLedgerMerge')) {
      openLedgerWorkbench('merge');
      return;
    }
    // 纪要合并按钮 → 有活跃后台任务则恢复视图，否则警告→配置（仅数据库模式）
    if ((e.target as HTMLElement).closest('#dbMergeChronicle')) {
      if (isLedgerTakeover()) return;
      const mb = (e.target as HTMLElement).closest('#dbMergeChronicle') as HTMLButtonElement | null;
      if (mb && !mb.disabled) {
        openChronicleMerge();
      }
      return;
    }
    // 纪要一键修复按钮 → 二次确认弹窗（仅数据库模式）
    if ((e.target as HTMLElement).closest('#dbRepairChronicle')) {
      if (isLedgerTakeover()) return;
      const rb = (e.target as HTMLElement).closest('#dbRepairChronicle') as HTMLButtonElement | null;
      if (rb && !rb.disabled) {
        openChronicleRepair();
      }
      return;
    }
    // 排序方向钮 → 翻转升/降
    const dirEl = (e.target as HTMLElement).closest('.db-sort-dir') as HTMLElement | null;
    if (dirEl) {
      const cur = _dbSort[_dbCurrentTab];
      if (cur) {
        _dbSort[_dbCurrentTab] = { col: cur.col, dir: cur.dir === 'asc' ? 'desc' : 'asc' };
        _dbRenderLimit = DB_RENDER_BATCH;   // O30：新排序从头翻页
        renderDbTable(overlay, _dbCurrentTab);
      }
      return;
    }
    // 卡片右上锁按钮 → toggle 行锁（锁定直接生效，解锁二次确认）
    const lockEl = (e.target as HTMLElement).closest('.db-card-lock') as HTMLElement | null;
    if (lockEl) {
      const ri = parseInt(lockEl.dataset.lock || '-1', 10);
      const t = _dbTables[_dbCurrentTab];
      if (t && ri >= 0 && ri < t.rows.length) {
        void (async function () {
          const rowIndex = ri + 1;                       // displayIdx(0-based) → content 下标(1-based)
          const wasLocked = isRowLocked(t.lockState, rowIndex);
          const willLock = !wasLocked;
          if (!willLock) {
            const ok = await dbConfirmUnlock(style, '确认解锁该行？');
            if (!ok) return;
          }
          const success = await setRowLock(t.sheetKey, rowIndex, willLock);
          if (!success) {
            getToastr()?.error('锁定操作失败，请重试', '数据库');
            return;
          }
          if (t.lockState) {
            const arr = t.lockState.rows;
            const pos = arr.indexOf(rowIndex);
            if (willLock && pos < 0) arr.push(rowIndex);
            else if (!willLock && pos >= 0) arr.splice(pos, 1);
          } else if (willLock) {
            t.lockState = { rows: [rowIndex], cols: [], cells: [] };
          }
          renderDbTable(overlay, _dbCurrentTab);
        })();
      }
      return;
    }
    // 两张人物表卡片右上迁移按钮（先于删除/卡片详情处理，避免冒泡打开详情）
    const migrateEl = (e.target as HTMLElement).closest('.db-card-migrate') as HTMLElement | null;
    if (migrateEl) {
      const ri = parseInt(migrateEl.dataset.migrate || '-1', 10);
      const t = _dbTables[_dbCurrentTab];
      if (t && ri >= 0 && ri < t.rows.length) {
        const snapshot = createCharacterMigrationSnapshot(t.name, t.headers, t.rows[ri]);
        if (snapshot) showDbMigrationConfirm(snapshot, style);
        else getToastr()?.error('无法读取该人物记录，请刷新后重试', '数据库');
      }
      return;
    }
    // 卡片右上 × 删除
    const delEl = (e.target as HTMLElement).closest('.db-card-del') as HTMLElement | null;
    if (delEl) {
      const ri = parseInt(delEl.dataset.del || '-1', 10);
      const t = _dbTables[_dbCurrentTab];
      if (t && ri >= 0 && ri < t.rows.length) showDbDeleteConfirm(t, ri, style);
      return;
    }
    // 点击卡片 → 弹出行详情
    const rowEl = (e.target as HTMLElement).closest('.db-card[data-row]') as HTMLElement | null;
    if (rowEl) {
      const ri = parseInt(rowEl.dataset.row || '-1', 10);
      const t = _dbTables[_dbCurrentTab];
      if (t && ri >= 0 && ri < t.rows.length) {
        showDbRowDetail(t, ri, style);
      }
    }
  };
}
