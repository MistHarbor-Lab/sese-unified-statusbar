// ===== 正文插图 → 角色图库（立绘）转入：下拉选角色 + 复制图片 + 写立绘索引 =====
// 入口三处共用：文生图图库卡片、图库放大视图、正文图片放大（宿主页）——前两者走 iframe 主题化弹窗
// （复用 confirm-dialog 的 body 级 overlay 框架，不吞所在弹窗），宿主页走固定深色玻璃卡
// （类名复用 STORY_IMAGE_HOST_CSS 的 .ub-host-confirm-*，仅补 select 规则）。
// 复制语义：转入=把服务器图片复制一份进立绘目录（portrait_ 命名，与本地导入同链路），
// 两边独立、可分别删除，互不影响；文生图图库原图与条目不动。
import { getConfig } from '../core/config-store';
import { getToastr } from '../core/env';
import { getSheetByName, getCellByHeader } from '../core/data-manager';
import { uploadGeneratedImage } from '../core/image-storage';
import { savePortraitIndex } from '../core/portrait-system';
import { sortCharactersMatchedFirst, buildImportedPortraitEntry } from '../core/story-image-import';
import type { StoryImageEntry } from '../core/story-image-gallery-store';
import { ubIcon } from '../core/icons';
import { openDialog, closeDialog } from './confirm-dialog';
import { bridgeWindowClass } from './html-builder';
import { escapeHtml, escapeAttr } from '../core/html-escape';

/** 读两表角色名（恋爱对象表在前、按姓名去重）并按描述匹配排序。表缺失/异常→空列表。 */
export function readImportCandidates(description: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const table of ['恋爱对象表', '重要角色表'] as const) {
    let sheet: ReturnType<typeof getSheetByName>;
    try { sheet = getSheetByName(table); } catch (_e) { continue; }
    if (!sheet || !Array.isArray(sheet.content)) continue;
    for (let i = 1; i < sheet.content.length; i++) {
      const name = String(getCellByHeader(table, i, '姓名') || '').trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      names.push(name);
    }
  }
  return sortCharactersMatchedFirst(names, description);
}

/** 复制图片文件（fetch 原图→dataURL→uploadGeneratedImage 存 portrait_ 新文件）并写入该角色立绘索引。 */
export async function importStoryImageToPortrait(entry: StoryImageEntry, npc: string): Promise<{ ok: boolean; error?: string }> {
  let dataUrl: string;
  try {
    const res = await fetch(entry.path);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const blob = await res.blob();
    dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('读取图片失败'));
      r.readAsDataURL(blob);
    });
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
  const up = await uploadGeneratedImage(dataUrl, 'portrait', npc);
  if (!up.path) return { ok: false, error: up.error || '复制失败' };
  const saved = await savePortraitIndex(npc, buildImportedPortraitEntry(entry, up.path, up.path.split('/').pop() || ''));
  if (!saved) return { ok: false, error: '立绘保存失败（存储未就绪）' };
  return { ok: true };
}

function importHint(): string {
  return '把这张插图复制一份到所选角色的立绘图库（两边独立、可分别删除；文生图图库原图不受影响）。';
}

/** 统一入口。传 opts.doc = 强制宿主深色卡（正文放大入口），不传 = iframe 主题化弹窗（图库入口）。
 *  禁用 document 比较分流：importer 与 text-viewer 同文档时 doc===document 恒真，正文入口会误落
 *  iframe 壳（z-index 10025 被宿主放大视图 100000 盖住，症状=弹窗不可见、须关闭放大才能操作）。 */
export function showStoryImageImportPopup(entry: StoryImageEntry, opts: { doc?: Document } = {}): void {
  if (opts.doc) showImportPickerOnHost(opts.doc, entry);
  else showImportPickerInIframe(entry);
}

// —— iframe：主题化弹窗（confirm-dialog 同框架，叠加在图库/放大视图之上不吞后者）——

function showImportPickerInIframe(entry: StoryImageEntry): void {
  const toastr = getToastr();
  const desc = String(entry.description || '');
  const candidates = readImportCandidates(desc);
  if (!candidates.length) {
    toastr?.warning?.('恋爱对象表和重要角色表中没有可转入的角色', '转入角色图库');
    return;
  }
  const matched = new Set(candidates.filter(n => desc.includes(n)));
  const options = candidates.map(n => {
    const label = matched.has(n) ? n + '（描述匹配）' : n;
    return '<option value="' + escapeAttr(n) + '">' + escapeHtml(label) + '</option>';
  }).join('');
  const dialogClass = getConfig().style === 'bridge' ? bridgeWindowClass('confirm', 's') : 'panel-popup ub-popup--s';
  const body = '<div class="' + dialogClass + ' ub-confirm-dialog">'
    + '<div class="ub-confirm-title">' + ubIcon('plus') + ' 转入角色图库</div>'
    + '<div class="ub-confirm-message">' + importHint()
    + (desc ? '\n图片描述：' + escapeHtml(desc) : '')
    + '\n匹配到的角色已排在最上面。</div>'
    + '<div class="ub-confirm-field"><select class="ub-confirm-input" id="ubImportNpc">' + options + '</select></div>'
    + '<div class="ub-confirm-btns">'
    + '<button type="button" class="ub-confirm-btn ub-confirm-btn-cancel">取消</button>'
    + '<button type="button" class="ub-confirm-btn ub-confirm-btn-ok">转入</button>'
    + '</div></div>';
  const { overlay, dialog } = openDialog(body, { focusSel: '#ubImportNpc' });
  const select = dialog.querySelector('#ubImportNpc') as HTMLSelectElement;
  const finish = (): void => closeDialog(overlay);
  const okBtn = dialog.querySelector('.ub-confirm-btn-ok') as HTMLButtonElement;
  const run = async (): Promise<void> => {
    const npc = select.value;
    if (!npc) return;
    okBtn.disabled = true;
    okBtn.textContent = '转入中…';
    const r = await importStoryImageToPortrait(entry, npc).catch(e => ({ ok: false, error: e?.message || String(e) }));
    if (r.ok) toastr?.success?.('已转入「' + npc + '」的立绘图库', '转入角色图库');
    else toastr?.warning?.('转入失败：' + (r.error || '未知错误'), '转入角色图库');
    finish();
  };
  dialog.querySelector('.ub-confirm-btn-cancel')?.addEventListener('click', finish);
  okBtn.addEventListener('click', () => { void run(); });
  overlay.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
    if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName !== 'SELECT') { e.preventDefault(); void run(); }
  });
  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) finish();
  });
}

// —— 宿主页：固定深色玻璃卡（复用 .ub-host-confirm-* 样式；正文放大视图之上）——

function showImportPickerOnHost(doc: Document, entry: StoryImageEntry): void {
  const toastr = getToastr();
  const desc = String(entry.description || '');
  const candidates = readImportCandidates(desc);
  if (!candidates.length) {
    toastr?.warning?.('恋爱对象表和重要角色表中没有可转入的角色', '转入角色图库');
    return;
  }
  const matched = new Set(candidates.filter(n => desc.includes(n)));
  const overlay = doc.createElement('div');
  overlay.className = 'ub-host-confirm';
  const card = doc.createElement('div');
  card.className = 'ub-host-confirm-card';
  const titleEl = doc.createElement('div');
  titleEl.className = 'ub-host-confirm-title';
  titleEl.textContent = '转入角色图库';
  const msgEl = doc.createElement('div');
  msgEl.textContent = importHint() + (desc ? '\n图片描述：' + desc : '') + '\n匹配到的角色已排在最上面。';
  const select = doc.createElement('select');
  select.className = 'ub-host-select';
  for (const n of candidates) {
    const opt = doc.createElement('option');
    opt.value = n;
    opt.textContent = matched.has(n) ? n + '（描述匹配）' : n;
    select.appendChild(opt);
  }
  const actions = doc.createElement('div');
  actions.className = 'ub-host-confirm-actions';
  const cancel = doc.createElement('button');
  cancel.type = 'button';
  cancel.textContent = '取消';
  const ok = doc.createElement('button');
  ok.type = 'button';
  ok.className = 'ub-host-confirm-ok ub-host-confirm-import';
  ok.textContent = '转入';
  actions.append(cancel, ok);
  card.append(titleEl, msgEl, select, actions);
  overlay.appendChild(card);
  const close = (): void => {
    doc.removeEventListener('keydown', onKey, true);
    overlay.remove();
  };
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') { ev.preventDefault(); close(); }
  };
  const run = async (): Promise<void> => {
    const npc = select.value;
    if (!npc) return;
    (ok as HTMLButtonElement).disabled = true;
    ok.textContent = '转入中…';
    const r = await importStoryImageToPortrait(entry, npc).catch(e => ({ ok: false, error: e?.message || String(e) }));
    if (r.ok) toastr?.success?.('已转入「' + npc + '」的立绘图库', '转入角色图库');
    else toastr?.warning?.('转入失败：' + (r.error || '未知错误'), '转入角色图库');
    close();
  };
  cancel.addEventListener('click', close);
  ok.addEventListener('click', () => { void run(); });
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
  doc.body.appendChild(overlay);
  doc.addEventListener('keydown', onKey, true);
  (select as HTMLSelectElement).focus();
}
