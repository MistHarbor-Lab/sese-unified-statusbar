// ===== 正文插图（自动文生图）：全局图库弹窗 =====
// 参照立绘图库（portrait-panel）交互：网格卡片 + 点开全屏左右滑动浏览 + 单张删除。
// 全屏浏览走共用组件 story-image-lightbox（立绘机制同款、独立 sig- 类名——
// 不复用立绘放大弹窗入口：其 portrait_zoomed 成就埋点语义属立绘；立绘 lightbox 类随立绘开关注卸）。
// 全局图库不分角色卡，卡片以「来源卡标签」标注出处；删除连带服务器文件。
import { padNumber } from '../core/number';
import { ubIcon } from '../core/icons';
import type { StyleType } from '../core/constants';
import {
  closePanelOverlay, markPopupShown, guardGhostClick, syncDarkClass, syncDarkClassMinimal,
} from './html-builder';
import { showConfirmDialog } from './confirm-dialog';
import { escapeHtml, escapeAttr } from '../core/html-escape';
import {
  readStoryImageGallery, deleteStoryImageEntry, updateStoryImageEntry, type StoryImageEntry, type StoryImageGenRecord,
} from '../core/story-image-gallery-store';
import { mountStoryLightbox } from './story-image-lightbox';
import { showStoryImageImportPopup } from './story-image-import';
import { copyTextToClipboard, genParamsEditHtml, readGenParamsPatch } from './html-builder';
import { getToastr } from '../core/env';
import { regenerateStoryImageFromArchive } from '../core/story-image-engine';
import { isRecordReplayable } from '../core/image-gen';
import type { ImageGenRegenPatch } from '../core/image-gen';

function getOverlay(): HTMLElement | null { return document.getElementById('panelOverlay'); }

function formatDate(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${padNumber(d.getMonth() + 1)}-${padNumber(d.getDate())}`;
}

function bridgeClass(style: StyleType): string {
  return style === 'bridge' ? ' bridge-window bridge-module-imaging' : '';
}

/** 卡片悬浮 tooltip：图片描述（AI desc 行）+ 来源卡 + 日期。 */
function cardTooltip(entry: StoryImageEntry): string {
  const parts: string[] = [];
  if (entry.description) parts.push(entry.description);
  if (entry.charName) parts.push('来源：' + entry.charName);
  if (entry.createdAt) parts.push(formatDate(entry.createdAt));
  return parts.join('\n') || '点击放大浏览';
}

function galleryCardHtml(entry: StoryImageEntry): string {
  return '<div class="sig-card" data-id="' + escapeAttr(entry.id) + '" title="' + escapeAttr(cardTooltip(entry)) + '">'
    + '<div class="sig-img-wrap"><img src="' + escapeAttr(entry.path) + '" alt="正文插图" loading="lazy">'
    + (entry.charName ? '<span class="sig-char-tag">' + ubIcon('book') + escapeHtml(entry.charName) + '</span>' : '')
    + '<button class="sig-import" data-act="import" title="转入角色图库">' + ubIcon('plus') + '</button>'
    + '<button class="sig-edit" data-act="edit" title="查看/编辑生图信息">' + ubIcon('pencil') + '</button>'
    + '<button class="sig-del" data-act="del" title="删除这张插图">' + ubIcon('trash') + '</button>'
    + '</div>'
    + (entry.createdAt ? '<div class="sig-date">' + formatDate(entry.createdAt) + '</div>' : '')
    + '</div>';
}

/** 图库主弹窗（入口：设置-统一生图 API / 功能页正文插图卡）。 */
export function showStoryImageGalleryPopup(style: StyleType): void {
  const overlay = getOverlay();
  if (!overlay) return;
  const entries = readStoryImageGallery();

  let html = '<div class="panel-popup story-image-popup ub-popup--xl' + bridgeClass(style) + '">';
  html += '<div class="portrait-popup-header sig-header">';
  html += '<div class="portrait-popup-title">' + ubIcon('image') + '文生图图库 <span class="sig-count" id="sigCount">(' + entries.length + ' 张)</span></div>';
  html += '<div class="sig-header-actions">'
    + '<button class="pg-filter-btn" id="sigClose" title="关闭">' + ubIcon('close') + '</button>'
    + '</div></div>';
  html += '<div class="sig-subtitle">所有聊天自动生成的正文插图（按时间新→旧）；删除会同时清理服务器文件。</div>';
  html += '<div class="sig-grid" id="sigGrid">';
  if (!entries.length) {
    html += '<div class="sig-empty">还没有插图。开启「正文插图（自动文生图）」后，AI 正文生成结束会自动挑选精彩片段生成插图。</div>';
  } else {
    for (const entry of entries) html += galleryCardHtml(entry);
  }
  html += '</div></div>';

  overlay.innerHTML = html;
  if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  markPopupShown();
  overlay.classList.add('show');

  const $o = $(overlay);
  const close = (): void => closePanelOverlay(overlay);
  $o.find('#sigClose').on('click', close);
  overlay.onclick = (e: MouseEvent) => {
    if (e.target === overlay) { if (guardGhostClick()) return; close(); }
  };

  const refreshGrid = (): void => {
    const fresh = readStoryImageGallery();
    const $grid = $o.find('#sigGrid');
    if (!fresh.length) {
      $grid.html('<div class="sig-empty">图库已清空。</div>');
    } else {
      let cards = '';
      for (const entry of fresh) cards += galleryCardHtml(entry);
      $grid.html(cards);
    }
    $o.find('#sigCount').text('(' + fresh.length + ' 张)');
  };

  /** F24：删除后的原位移除——不整格重建（整格 innerHTML 会重挂载全部 <img> 造成闪烁并丢滚动位置）。
   *  仅当网格清空时才回落为空态文案。 */
  const removeCardInPlace = (id: string): void => {
    const cards = $o.find('#sigGrid .sig-card').toArray() as HTMLElement[];
    const card = cards.find(c => c.dataset.id === id);
    const remaining = readStoryImageGallery();
    if (!card) { refreshGrid(); return; }
    if (!remaining.length) {
      refreshGrid(); // 空态文案分支
      return;
    }
    card.classList.add('is-removed');
    window.setTimeout(() => card.remove(), 260);
    $o.find('#sigCount').text('(' + remaining.length + ' 张)');
  };

  $o.find('#sigGrid').on('click', '.sig-card', async function (this: HTMLElement, e: JQuery.ClickEvent) {
    const act = $(e.target).closest('[data-act]').attr('data-act') || '';
    const id = $(this).attr('data-id') || '';
    const entriesNow = readStoryImageGallery();
    if (act === 'del') {
      const target = entriesNow.find(en => en.id === id);
      if (!target) return;
      const ok = await showConfirmDialog({
        message: '删除这张正文插图？将同时删除服务器上的图片文件，聊天正文中的插图引用会失效。',
        title: '删除插图',
        okText: '删除',
        danger: true,
      });
      if (!ok) return;
      const deleted = await deleteStoryImageEntry(id);
      if (!deleted) {
        const toastr = getToastr();
        if (toastr?.warning) toastr.warning('删除失败：图库存储不可用或写入失败', '文生图图库');
        return;
      }
      removeCardInPlace(id);
      return;
    }
    // 转入角色图库（复制一份到所选角色立绘图库；弹窗叠加不关图库，原图库条目不动）
    if (act === 'import') {
      const target = entriesNow.find(en => en.id === id);
      if (target) showStoryImageImportPopup(target);
      return;
    }
    // 查看/编辑生图信息（详情弹窗；关闭后重开图库，同立绘编辑链式模式）
    if (act === 'edit') {
      const target = entriesNow.find(en => en.id === id);
      if (!target) return;
      showStoryImageDetailPopup(target, style, () => showStoryImageGalleryPopup(style));
      return;
    }
    // 点卡片本体 → 全屏滑动浏览（从点选图开始，返回时回图库）
    showStoryImageZoomPopup(id, style, () => showStoryImageGalleryPopup(style), entriesNow);
  });
}

// ---------------------------------------------------------------------------
// 插图详情/编辑弹窗（生图档案展示：时间/描述/提示词可改，模型与参数只读）
// ---------------------------------------------------------------------------

const SIG_GEN_PROVIDER_LABEL: Record<string, string> = {
  novelai: 'NovelAI', openai: 'OpenAI 兼容', comfyui: 'ComfyUI', unknown: '未知',
};

function genModelLine(gen: StoryImageGenRecord | undefined): string {
  if (!gen) return '未记录（旧条目）';
  const line = [SIG_GEN_PROVIDER_LABEL[gen.provider] || gen.provider, gen.model].filter(Boolean).join(' · ');
  return line || '—';
}

function genParamsLine(gen: StoryImageGenRecord | undefined): string {
  if (!gen) return '未记录';
  const p = gen.params || {};
  const bits: string[] = [];
  if (p.width && p.height) bits.push(`${p.width}×${p.height}`);
  if (p.aspectRatio) bits.push(`比例 ${p.aspectRatio}`);
  if (typeof p.seed === 'number' && Number.isFinite(p.seed)) bits.push(`seed ${p.seed}`);
  if (p.sampler) bits.push(p.scheduler ? `${p.sampler}/${p.scheduler}` : String(p.sampler));
  if (p.steps) bits.push(`${p.steps}步`);
  if (typeof p.cfg === 'number' && p.cfg) bits.push(`CFG ${p.cfg}`);
  if (typeof p.cfgRescale === 'number' && p.cfg) bits.push(`rescale ${p.cfgRescale}`);
  if (gen.characters?.length) bits.push(`多角色×${gen.characters.length}`);
  if (gen.provider === 'comfyui' && gen.workflow) bits.push('最终工作流已存档');
  return bits.join(' · ') || '—';
}

/** 折叠区明文（全参数/多角色 UC/工作流）。工作流可能上百 KB，展示截断（完整内容仍在存储里）。 */
function genDetailPre(gen: StoryImageGenRecord | undefined): string {
  if (!gen) return '';
  const payload: Record<string, unknown> = { params: gen.params };
  if (gen.characters?.length) { payload.characters = gen.characters; payload.useCoords = gen.useCoords === true; }
  if (gen.workflow) {
    payload.workflow = gen.workflow.length > 20000
      ? gen.workflow.slice(0, 20000) + '\n…（展示截断，完整工作流仍在存档中）'
      : gen.workflow;
  }
  try { return JSON.stringify(payload, null, 2); } catch (_e) { return ''; }
}

export function showStoryImageDetailPopup(
  entry: StoryImageEntry,
  style: StyleType,
  onDone?: () => void,
): void {
  const overlay = getOverlay();
  if (!overlay) return;
  const gen = entry.gen;
  const initial = {
    description: entry.description || '',
    prompt: gen?.prompt || '',
    raw: entry.promptText || '',
    negative: gen?.negative || '',
  };
  const detailPre = genDetailPre(gen);
  // 重新生图：仅对档案完备的条目开放（旧条目/unknown 不渲染按钮与参数编辑）
  const replayable = isRecordReplayable(gen);
  let html = '<div class="panel-popup story-image-popup sig-detail-wrap' + bridgeClass(style) + '">';
  html += '<div class="portrait-popup-header sig-header">';
  html += '<div class="portrait-popup-title">' + ubIcon('pencil') + '插图详情</div>';
  html += '<div class="sig-header-actions"><button class="pg-filter-btn" id="sigDetailClose" title="关闭">' + ubIcon('close') + '</button></div></div>';
  html += '<div class="sig-detail-body">';
  html += '<div class="sig-detail-preview"><img src="' + escapeAttr(entry.path) + '" alt="正文插图"></div>';
  html += '<div class="sig-detail-fields">';
  html += '<div><div class="sig-detail-label">生成时间</div><div class="sig-detail-value">' + (entry.createdAt ? escapeHtml(new Date(entry.createdAt).toLocaleString()) : '未记录') + '</div></div>';
  html += '<div><div class="sig-detail-label">来源卡</div><div class="sig-detail-value">' + (entry.charName ? escapeHtml(entry.charName) : '未记录') + '</div></div>';
  html += '<div><div class="sig-detail-label">模型（只读）</div><div class="sig-detail-value">' + escapeHtml(genModelLine(gen)) + '</div></div>';
  html += replayable
    ? '<div><div class="sig-detail-label">生图参数（可改，仅重新生图生效）</div>' + genParamsEditHtml(gen, 'sd') + '</div>'
    : '<div><div class="sig-detail-label">参数（只读）</div><div class="sig-detail-value">' + escapeHtml(genParamsLine(gen)) + '</div></div>';
  html += '<div><div class="sig-detail-label">图片描述<button type="button" class="sig-detail-copy" data-copy="sigDetailDesc">复制</button></div>'
    + '<textarea class="sig-detail-textarea" id="sigDetailDesc" rows="2" placeholder="空=未记录">' + escapeHtml(initial.description) + '</textarea></div>';
  html += '<div><div class="sig-detail-label">正向提示词（实际发送形态，可改）<button type="button" class="sig-detail-copy" data-copy="sigDetailPrompt">复制</button></div>'
    + '<textarea class="sig-detail-textarea" id="sigDetailPrompt" rows="5" placeholder="空=未记录（旧条目）">' + escapeHtml(initial.prompt) + '</textarea></div>';
  html += '<div><div class="sig-detail-label">AI 原始提示词块（可改）<button type="button" class="sig-detail-copy" data-copy="sigDetailRaw">复制</button></div>'
    + '<textarea class="sig-detail-textarea" id="sigDetailRaw" rows="4" placeholder="空=未记录">' + escapeHtml(initial.raw) + '</textarea></div>';
  html += '<div><div class="sig-detail-label">负面提示词（可改）<button type="button" class="sig-detail-copy" data-copy="sigDetailNegative">复制</button></div>'
    + '<textarea class="sig-detail-textarea" id="sigDetailNegative" rows="2" placeholder="空=未记录（旧条目）">' + escapeHtml(initial.negative) + '</textarea></div>';
  if (detailPre) {
    html += '<details class="sig-detail-details"><summary>完整档案（参数/多角色结构/工作流）</summary><pre>'
      + escapeHtml(detailPre) + '</pre></details>';
  }
  html += '</div></div>';
  html += '<div class="sig-detail-actions">';
  html += '<button type="button" class="sig-detail-btn cancel" id="sigDetailCancel">取消</button>';
  if (replayable) html += '<button type="button" class="sig-detail-btn regen" id="sigDetailRegen" title="按生图档案重放（可先用上方字段微调）">重新生图</button>';
  html += '<button type="button" class="sig-detail-btn save" id="sigDetailSave">保存</button>';
  html += '</div></div>';

  overlay.innerHTML = html;
  if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  markPopupShown();
  overlay.classList.add('show');

  const $o = $(overlay);
  const close = (): void => {
    if (onDone) onDone();
    else closePanelOverlay(overlay);
  };
  $o.find('#sigDetailClose').on('click', close);
  $o.find('#sigDetailCancel').on('click', close);
  $o.on('click', '.sig-detail-copy', async function (this: HTMLElement) {
    const targetId = $(this).attr('data-copy') || '';
    const ta = $o.find('#' + targetId).get(0) as HTMLTextAreaElement | undefined;
    if (!ta) return;
    const ok = await copyTextToClipboard(ta.value);
    const toastr = getToastr();
    if (ok) toastr?.success?.('已复制到剪贴板', '文生图图库');
    else toastr?.warning?.('复制失败，请手动选择文本复制', '文生图图库');
  });
  // 重新生图（按档案重放）：改过的提示词/参数仅本次生效；任务通知带终止（core 编排内建）
  $o.find('#sigDetailRegen').on('click', async function () {
    const prompt = String($o.find('#sigDetailPrompt').val() || '');
    const negative = String($o.find('#sigDetailNegative').val() || '');
    const patch: ImageGenRegenPatch = {
      ...(prompt.trim() ? { prompt } : {}),
      ...(negative.trim() ? { negative } : {}),
      params: readGenParamsPatch('sd'),
    };
    const toastr = getToastr();
    const $btn = $o.find('#sigDetailRegen');
    $btn.prop('disabled', true).text('生成中…');
    $o.find('#sigDetailSave').prop('disabled', true);
    const r = await regenerateStoryImageFromArchive(entry.path, patch);
    if (!r.ok) {
      if (r.aborted) toastr?.info?.('已终止本次重新生图', '文生图图库');
      else toastr?.error?.(r.error || '重新生图失败', '文生图图库');
      $btn.prop('disabled', false).text('重新生图');
      $o.find('#sigDetailSave').prop('disabled', false);
      return;
    }
    toastr?.success?.('已按生图档案重新生成该插图', '文生图图库');
    closePanelOverlay(overlay);
    if (onDone) onDone();
  });
  $o.find('#sigDetailSave').on('click', async function () {
    const description = String($o.find('#sigDetailDesc').val() || '');
    const prompt = String($o.find('#sigDetailPrompt').val() || '');
    const raw = String($o.find('#sigDetailRaw').val() || '');
    const negative = String($o.find('#sigDetailNegative').val() || '');
    const changed = description !== initial.description || prompt !== initial.prompt
      || raw !== initial.raw || negative !== initial.negative;
    if (changed) {
      const saved = await updateStoryImageEntry(entry.id, {
        description, promptText: raw,
        genPrompt: prompt, genNegative: negative,
      });
      const toastr = getToastr();
      if (!saved) {
        if (toastr?.warning) toastr.warning('保存失败：图库存储不可用或写入失败', '文生图图库');
        return;
      }
      if (toastr?.success) toastr.success('插图信息已保存', '文生图图库');
    }
    closePanelOverlay(overlay);
    if (onDone) onDone();
  });
  overlay.onclick = (e: MouseEvent) => {
    if (e.target === overlay) { if (guardGhostClick()) return; close(); }
  };
}

// ---------------------------------------------------------------------------
// 全屏三槽滑动浏览（共用组件 story-image-lightbox：立绘同款机制与视觉，独立 sig- 类名）
// ---------------------------------------------------------------------------

/** 全屏浏览（iframe 图库入口）：从点选图开始，可翻页/拖拽/删除，退出时回图库。 */
export function showStoryImageZoomPopup(
  startId: string,
  style: StyleType,
  onBack?: () => void,
  entriesArg?: StoryImageEntry[],
): void {
  const overlay = getOverlay();
  if (!overlay) return;
  const entries = (entriesArg && entriesArg.length ? entriesArg : readStoryImageGallery()).slice();
  if (!entries.length) return;
  const startIndex = Math.max(0, entries.findIndex(en => en.id === startId));

  overlay.innerHTML = '<div class="portrait-lightbox sig-lightbox" id="sigLightbox"></div>';
  if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  markPopupShown();
  overlay.classList.add('show');
  overlay.onclick = null; // 交互统一收口到 lightbox 根元素（其覆盖整个 overlay）

  const root = overlay.querySelector('#sigLightbox') as HTMLElement;
  mountStoryLightbox({
    doc: document,
    root,
    entries,
    startIndex,
    onDelete: async (entry) => {
      const ok = await showConfirmDialog({
        message: '删除这张正文插图？将同时删除服务器上的图片文件，聊天正文中的插图引用会失效。',
        title: '删除插图',
        okText: '删除',
        danger: true,
      });
      if (!ok) return false;
      const deleted = await deleteStoryImageEntry(entry.id);
      if (!deleted) {
        const toastr = getToastr();
        if (toastr?.warning) toastr.warning('删除失败：图库存储不可用或写入失败', '文生图图库');
      }
      return deleted;
    },
    onImport: (entry) => showStoryImageImportPopup(entry),
    onDone: () => {
      if (onBack) onBack();
      else closePanelOverlay(overlay);
    },
  });
}
