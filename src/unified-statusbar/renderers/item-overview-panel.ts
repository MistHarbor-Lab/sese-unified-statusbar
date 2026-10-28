// ===== 物品总览图面板：仓库物品 → 一张静物陈列总览图（生成/编辑重生成/大图/删除） =====
import { type StyleType } from '../core/constants';
import { getToastr } from '../core/env';
import { syncDarkClass, syncDarkClassMinimal, closePanelOverlay, guardGhostClick, markPopupShown, bridgeWindowClass } from './html-builder';
import { showConfirmDialog } from './confirm-dialog';
import { escapeHtml, escapeHtmlAttr } from '../core/html-escape';
import { isSafeStoredImagePath } from '../core/image-storage';
import {
  clearWarehouseOverview, getWarehouseGroups, getWarehouseItems, readWarehouseOverview,
  type WarehouseGroup, type WarehouseOverviewRecord,
} from '../core/warehouse';
import { deleteWarehouseOverviewImage, generateWarehouseOverview, isWarehouseOverviewStale } from '../core/item-overview';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 05 待修：物品总览「点条目→开仓库」与仓库弹窗「切到物品总览」互相打开 ⇒ 改成由调用方注入打开回调即可解
import { showWarehousePopup } from './popup-manager';
import { warehouseLabels } from './warehouse-group-ui';
import { openHostLightbox } from './story-image-text-viewer';

// iframe 内防重复触发（跨 iframe 由全局间隔门 + NAI 单并发队列兜底）
let _iovBusy = false;

function providerLabel(provider: string): string {
  if (provider === 'novelai') return 'NovelAI';
  if (provider === 'comfyui') return 'ComfyUI';
  if (provider === 'openai') return 'OpenAI 兼容';
  return provider || '—';
}

async function resolveOverviewGroup(groupId?: number): Promise<WarehouseGroup | null> {
  const groups = await getWarehouseGroups();
  if (typeof groupId === 'number' && Number.isFinite(groupId)) {
    const found = groups.find(group => group.id === groupId);
    if (found) return found;
  }
  return groups[0] || null;
}

async function deleteItemOverview(style: StyleType, groupId: number, groupName: string): Promise<void> {
  const record = readWarehouseOverview(groupId);
  if (!record) return;
  if (!await showConfirmDialog({ message: `确认删除「${groupName}」的总览图？将同时删除已上传的图片文件。`, danger: true })) return;
  const removed = await deleteWarehouseOverviewImage(record);
  if (!removed.ok) {
    getToastr()?.warning(`图片文件删除失败：${removed.error || '未知错误'}，记录仍将清除`, '物品总览');
  }
  await clearWarehouseOverview(groupId);
  getToastr()?.success('总览图已删除', '物品总览');
  void showItemOverviewPopup(style, groupId);
}

async function runItemOverviewGeneration(style: StyleType, groupId: number): Promise<void> {
  if (_iovBusy) return;
  const promptEl = document.getElementById('iovPrompt') as HTMLTextAreaElement | null;
  const extraEl = document.getElementById('iovExtra') as HTMLInputElement | null;
  const btn = document.getElementById('iovGenBtn') as HTMLButtonElement | null;
  if (!btn) return;
  _iovBusy = true;
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = '生成中…';
  try {
    const result = await generateWarehouseOverview({
      groupId,
      extraPrompt: extraEl?.value?.trim() || undefined,
      editedPrompt: promptEl?.value?.trim() || undefined,
    });
    if (result.ok) {
      getToastr()?.success('仓库总览图已生成', '物品总览');
      if (result.warning) getToastr()?.warning(result.warning, '物品总览');
      void showItemOverviewPopup(style, groupId);
    } else {
      getToastr()?.error(result.error, '物品总览');
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  } catch (error: any) {
    getToastr()?.error(`生图异常：${error?.message || error}`, '物品总览');
    btn.disabled = false;
    btn.textContent = originalLabel;
  } finally {
    _iovBusy = false;
  }
}

export async function showItemOverviewPopup(style: StyleType, groupId?: number): Promise<void> {
  const overlay = document.getElementById('panelOverlay')!;
  const isMinimal = style === 'minimal';
  const group = await resolveOverviewGroup(groupId);
  if (!group) {
    void showWarehousePopup(style);
    return;
  }
  const items = await getWarehouseItems(group.id);
  const record: WarehouseOverviewRecord | null = readWarehouseOverview(group.id);
  const stale = isWarehouseOverviewStale(record, items);
  const hasImage = !!record && isSafeStoredImagePath(record.imagePath);

  const titleLabel = escapeHtml(group.name) + ' · ' + (style === 'ancient' ? '一览图' : '总览图');
  const genLabel = hasImage ? '重新生成' : '生成总览图';

  let bodyHtml = '';
  bodyHtml += '<div class="iov-stage">';
  if (hasImage && record) {
    bodyHtml += '<img src="' + escapeHtmlAttr(record.imagePath) + '" alt="仓库总览图">';
    if (stale) bodyHtml += '<div class="iov-stale">仓库物品已变动，总览图可能过期</div>';
  } else {
    bodyHtml += '<div class="iov-placeholder">' + (items.length === 0
      ? '仓库为空，先往仓库里放些物品吧。'
      : '尚未生成总览图。<br>点击下方「生成总览图」，AI 将把当前仓库物品编排进一张静物陈列图。') + '</div>';
  }
  bodyHtml += '</div>';
  if (record) {
    const createdAt = record.createdAt ? new Date(record.createdAt).toLocaleString() : '—';
    const sizeText = record.width && record.height ? `<span class="iov-chip dim">${escapeHtml(`${record.width}×${record.height}`)}</span>` : '';
    // F86：meta 串拆段芯片（数字 tabular 加重；风格/尺寸弱化 dim 档）
    bodyHtml += '<div class="iov-meta">'
      + `<span class="iov-chip dim">生成于 ${escapeHtml(createdAt)}</span>`
      + `<span class="iov-chip">入图 <b class="num">${Number(record.itemCount) || 0}</b> 件物品</span>`
      + `<span class="iov-chip dim">${escapeHtml(providerLabel(record.provider))}</span>`
      + sizeText
      + '</div>';
  }
  bodyHtml += '<div class="iov-label">主提示词（可编辑后重新生成）</div>';
  bodyHtml += '<textarea id="iovPrompt" class="iov-prompt" placeholder="' + (hasImage ? '' : '生成后此处显示可编辑的主提示词') + '">' + escapeHtml(record?.mainPrompt || '') + '</textarea>';
  bodyHtml += '<input id="iovExtra" class="iov-extra" placeholder="附加要求（仅本次生效，可空）：如 摊在木桌上、暖光、藏宝洞背景">';
  bodyHtml += '<div class="iov-actions">';
  bodyHtml += '<button class="' + (isMinimal ? 'btn-line' : 'item-use-btn') + '" id="iovGenBtn"' + (items.length === 0 ? ' disabled' : '') + '>' + genLabel + '</button>';
  if (hasImage) {
    bodyHtml += '<button class="' + (isMinimal ? 'btn-line' : 'item-use-btn') + '" id="iovZoomBtn">查看大图</button>';
    bodyHtml += '<button class="' + (isMinimal ? 'btn-line item-discard-btn' : 'item-discard-btn') + '" id="iovDelBtn">删除总览图</button>';
  }
  bodyHtml += '</div>';

  let html = '<div class="' + (style === 'bridge' ? bridgeWindowClass('item-overview', 'm') : 'panel-popup ub-popup--m iov-window') + '" data-popup="item-overview">';
  html += '<div class="panel-popup-head"><button class="panel-popup-back" id="panelBack">← 返回' + escapeHtml(warehouseLabels(style).warehouse) + '</button><div class="panel-popup-title">' + titleLabel + '</div><button class="panel-popup-close" id="panelClose">&times;</button></div>';
  html += '<div class="panel-popup-body">' + bodyHtml + '</div></div>';

  if (isMinimal) syncDarkClassMinimal(overlay);
  else syncDarkClass(overlay);
  overlay.innerHTML = html;
  markPopupShown();
  overlay.classList.add('show');
  overlay.onclick = async function (e) {
    if (e.target === overlay || (e.target as HTMLElement).id === 'panelClose') { if (guardGhostClick()) return; closePanelOverlay(overlay); return; }
    const target = e.target as HTMLElement;
    if (target.id === 'panelBack') { showWarehousePopup(style, group.id); return; }
    if (target.id === 'iovGenBtn') { runItemOverviewGeneration(style, group.id); return; }
    if (target.id === 'iovDelBtn') { deleteItemOverview(style, group.id, group.name); return; }
    if (target.id === 'iovZoomBtn' || target.closest('.iov-stage img')) {
      const current = readWarehouseOverview(group.id);
      if (current && isSafeStoredImagePath(current.imagePath)) openHostLightbox({ paths: [current.imagePath] });
      return;
    }
  };
}
