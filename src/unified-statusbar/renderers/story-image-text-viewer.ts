// ===== 正文插图：正文图片点击放大 + 悬浮删除 + 悬浮描述 =====
// 正文插图是酒馆原生渲染的 markdown <img>（在宿主页 #chat 内，非 iframe），本模块经
// window.parent.document 委托交互（楼层按钮同款模式）：
//   点击图片   → 宿主页全屏放大（story-image-lightbox 共用组件；浏览序列＝文生图图库全部，新→旧）；
//   悬浮图片   → 右上角浮现小×（点击确认后：删正文 markdown + 同步删图库条目与服务器文件）；
//                有描述（AI desc 行）时设置原生 title tooltip（懒设置，每图一次）。
// 开关守卫：storyImageEnabled 关时不劫持点击/不显示×/不设 tooltip（监听器常驻但先查开关，零交互成本）。
// 宿主页 CSS 按需懒注入 <style id="ub-story-host-css">（STORY_IMAGE_HOST_CSS，固定深色玻璃配色）。
import { getConfig } from '../core/config-store';
import { ensureStyleOnce } from './style-once';
import { getToastr } from '../core/env';
import { isOwnedStoryImagePath } from '../core/image-storage';
import { STORY_IMAGE_DEFAULT_WIDTH_PERCENT } from '../core/story-image-config';
import {
  readStoryImageGallery, deleteStoryImageEntry, type StoryImageEntry,
} from '../core/story-image-gallery-store';
import { removeStoryImagesByPath, regenerateStoryImageFromArchive, retryPendingStoryImage } from '../core/story-image-engine';
import { showStoryImageGalleryPopup } from './story-image-gallery';
import { showStoryImageImportPopup } from './story-image-import';
import { STORY_IMAGE_HOST_CSS, STORY_IMAGE_PENDING_CSS } from '../styles/story-image-base';
import { mountStoryLightbox } from './story-image-lightbox';
import { ubIcon } from '../core/icons';

let _bound = false;
let _hoverDel: HTMLElement | null = null;
let _hideTimer: ReturnType<typeof setTimeout> | null = null;

function hostDocument(): Document | null {
  try { return (window.parent as any).document || document; } catch (_e) { return document; }
}

/** 目标元素是否本插件正文插图；返回所有权校验通过的原始路径（保留服务器返回的前导斜杠形态，
 *  与图库 entry.path / 正文 markdown 一致——剥斜杠会导致匹配与删除 marker 对不上）。
 *  tagName 判定（宿主页元素对 iframe 侧 instanceof HTMLImageElement 恒 false，跨 realm 陷阱）。 */
function storyImgPath(el: EventTarget | null): string | null {
  if (!el || (el as HTMLElement).tagName !== 'IMG') return null;
  const img = el as HTMLImageElement;
  const candidates: string[] = [img.getAttribute('src') || ''];
  try {
    if (img.currentSrc) {
      const base = String(img.ownerDocument?.defaultView?.location || window.location);
      candidates.push(new URL(img.currentSrc, base).pathname);
    }
  } catch (_e) { /* keep raw */ }
  for (let c of candidates) {
    if (!c) continue;
    try { c = decodeURIComponent(c); } catch (_e) { /* keep raw */ }
    if (isOwnedStoryImagePath(c)) return c;
  }
  return null;
}

/** 路径等价比较（带/不带前导斜杠视为同一路径）。 */
function sameImagePath(a: string, b: string): boolean {
  const na = a.startsWith('/') ? a.slice(1) : a;
  const nb = b.startsWith('/') ? b.slice(1) : b;
  return na === nb;
}

function injectHostCss(doc: Document): void {
  ensureStyleOnce('ub-story-host-css', STORY_IMAGE_HOST_CSS, doc); // U35：收编幂等注入（目标＝宿主文档）
}

/** 宿主页轻量确认弹窗（深色玻璃固定配色，不依赖 iframe 内主题弹窗）。 */
function hostConfirm(doc: Document, message: string, title: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = doc.createElement('div');
    overlay.className = 'ub-host-confirm';
    const card = doc.createElement('div');
    card.className = 'ub-host-confirm-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    const titleEl = doc.createElement('div');
    titleEl.className = 'ub-host-confirm-title';
    titleEl.textContent = title;
    const msgEl = doc.createElement('div');
    msgEl.textContent = message; // textContent 赋值（message 可能含正文摘录，天然防注入）
    const actions = doc.createElement('div');
    actions.className = 'ub-host-confirm-actions';
    const cancel = doc.createElement('button');
    cancel.type = 'button';
    cancel.textContent = '取消';
    const ok = doc.createElement('button');
    ok.type = 'button';
    ok.className = 'ub-host-confirm-ok';
    ok.textContent = '删除';
    actions.append(cancel, ok);
    card.append(titleEl, msgEl, actions);
    overlay.appendChild(card);
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') { ev.preventDefault(); close(false); }
    };
    const close = (v: boolean): void => {
      doc.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(v);
    };
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(false); });
    cancel.addEventListener('click', () => close(false));
    ok.addEventListener('click', () => close(true));
    doc.body.appendChild(overlay);
    doc.addEventListener('keydown', onKey, true);
    ok.focus();
  });
}

/** 删除一张正文插图：确认 → 删全部楼层该图 markdown → 同步删图库条目与服务器文件。 */
async function deleteStoryImageInteractive(doc: Document, path: string): Promise<boolean> {
  const ok = await hostConfirm(doc, '删除这张正文插图？将同时删除图库记录与服务器上的图片文件。', '删除插图');
  if (!ok) return false;
  const floors = await removeStoryImagesByPath(path);
  const entry = readStoryImageGallery().find(en => sameImagePath(en.path, path));
  if (entry) await deleteStoryImageEntry(entry.id);
  const toastr = getToastr();
  try {
    if (toastr?.info) {
      toastr.info(
        floors > 0 ? (floors > 1 ? `已删除正文插图（${floors} 处引用），图库同步清理` : '已删除正文插图，图库同步清理') : '已删除图库中的这张插图（当前聊天正文没有它的引用）',
        '正文插图',
      );
    }
  } catch (_e) { /* ignore */ }
  return true;
}

/** 点正文图片 → 宿主页全屏放大（浏览序列＝图库全部，新→旧；图库中已不存在的图退化为单张）。 */
function openTextLightbox(doc: Document, path: string): void {
  injectHostCss(doc);
  const entries = readStoryImageGallery();
  const index = entries.findIndex(en => sameImagePath(en.path, path));
  const list: StoryImageEntry[] = index >= 0
    ? entries
    : [{ id: '', path, filename: '', charName: '', promptText: '', description: '', createdAt: 0 }];
  const root = doc.createElement('div');
  root.className = 'sig-lightbox ub-story-host-zoom';
  doc.body.appendChild(root);
  // onOpenGallery：先关宿主放大（done→root.remove），再在 iframe 打开图库弹窗（text-viewer 本身在
  // iframe 上下文运行，showStoryImageGalleryPopup 操作 iframe #panelOverlay）。
  mountStoryLightbox({
    doc,
    root,
    entries: list,
    startIndex: Math.max(0, index),
    onDelete: (entry) => deleteStoryImageInteractive(doc, entry.path),
    // 转入角色图库：宿主页深色选择卡（doc≠document 自动分流），复制一份到所选角色立绘图库
    onImport: (entry) => showStoryImageImportPopup(entry, { doc }),
    onOpenGallery: () => { showStoryImageGalleryPopup(getConfig().style); },
    onRegenerate: async (entry) => {
      const toastr = getToastr();
      const r = await regenerateStoryImageFromArchive(entry.path);
      if (!r.ok) {
        if (r.aborted) toastr?.info?.('已终止本次重新生图', '正文插图');
        else toastr?.warning?.(r.error || '重新生图失败', '正文插图');
        return null;
      }
      toastr?.success?.('已按生图档案重新生成该插图', '正文插图');
      return r.entry || null;
    },
    onDone: () => root.remove(),
  });
}

/** 宿主页全屏图片放大（通用桥入口）：复用正文图片放大的宿主页 fixed 层 + sig-lightbox 组件，
 *  视觉交互与立绘放大对齐。供 window.__ub_openLightbox 桥（UBS_phone 等）及主项目内单图放大复用。
 *  onRegenerate 提供时渲染底部「重新生图」（regenLabel 可覆写文案）：回调在子模块内完成重绘并返回新路径
 *  （未变更/失败返回 null，提示由回调负责），放大页里所有指向旧路径的槽位随之原位换到新图；
 *  不传该回调＝纯浏览（旧调用方语义不变，老版本子模块也照此降级）。 */
export function openHostLightbox(args: {
  paths: string[];
  startIndex?: number;
  onDone?: () => void;
  onRegenerate?: (ctx: { path: string }) => Promise<{ path: string } | null>;
  regenLabel?: string;
}): void {
  const doc = hostDocument();
  if (!doc || !args.paths.length) return;
  injectHostCss(doc);
  const entries: StoryImageEntry[] = args.paths.map(p => ({
    id: '', path: p, filename: '', charName: '', promptText: '', description: '', createdAt: 0,
  }));
  const root = doc.createElement('div');
  root.className = 'sig-lightbox ub-story-host-zoom';
  doc.body.appendChild(root);
  const phoneRegen = args.onRegenerate;
  mountStoryLightbox({
    doc,
    root,
    entries,
    startIndex: Math.max(0, args.startIndex || 0),
    ...(phoneRegen ? {
      onRegenerate: async (entry: StoryImageEntry): Promise<StoryImageEntry | null> => {
        const r = await phoneRegen({ path: entry.path });
        if (!r || !r.path || r.path === entry.path) return null;
        // 重绘是全机引用替换（同 path 可能占多个槽位/多个条目）：整条序列一并换到新图
        for (let i = 0; i < entries.length; i++) if (entries[i].path === entry.path) entries[i] = { ...entries[i], path: r.path };
        return { ...entry, path: r.path };
      },
      regenLabel: args.regenLabel,
    } : {}),
    onDone: () => { root.remove(); args.onDone?.(); },
  });
}

// —— 悬浮小×（单例浮动按钮，fixed 跟随 hover 图片右上角；无 DOM 侵入）——

function ensureHoverDel(doc: Document): HTMLElement {
  if (_hoverDel && _hoverDel.isConnected) return _hoverDel;
  const del = doc.createElement('button');
  del.type = 'button';
  del.className = 'ub-story-hover-del';
  del.title = '删除这张插图';
  del.innerHTML = ubIcon('trash');
  del.addEventListener('mouseenter', () => { if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; } });
  del.addEventListener('mouseleave', hideHoverDel);
  del.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const path = del.getAttribute('data-path') || '';
    hideHoverDel();
    if (path) void deleteStoryImageInteractive(doc, path);
  });
  doc.body.appendChild(del);
  _hoverDel = del;
  return del;
}

function hideHoverDel(): void {
  if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
  _hoverDel?.classList.remove('show');
}

function scheduleHideHoverDel(): void {
  if (_hideTimer) clearTimeout(_hideTimer);
  _hideTimer = setTimeout(() => { _hideTimer = null; _hoverDel?.classList.remove('show'); }, 200);
}

function showHoverDel(doc: Document, img: HTMLImageElement, path: string): void {
  const del = ensureHoverDel(doc);
  const rect = img.getBoundingClientRect();
  del.style.left = Math.max(4, rect.right - 30) + 'px';
  del.style.top = Math.max(4, rect.top + 4) + 'px';
  del.setAttribute('data-path', path);
  if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
  del.classList.add('show');
}

/** 悬浮正文插图 → 显示小× + 懒设置描述 tooltip（每图一次）。
 *  热路径纪律：非 <img> 目标只做一次 tagName 比较（零分配——getConfig 每次浅拷贝，不得挂在每次 mouseover 上）；
 *  img 目标先做 story-image_ 文件名前缀粗筛（所有权判定的必要条件——isOwnedStoryImagePath 只认
 *  story-image_ 开头路径），头像等无关图片一次字符串比较即收尾，同样不读配置。 */
function onMouseOver(e: Event): void {
  const target = e.target;
  if (target === _hoverDel) { if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; } return; }
  const img = (target as HTMLElement)?.tagName === 'IMG' ? target as HTMLImageElement : null;
  if (!img) {
    if (_hoverDel?.classList.contains('show')) scheduleHideHoverDel();
    return;
  }
  const _srcRaw = img.getAttribute('src') || '';
  if (!_srcRaw.includes('story-image_') && !String(img.currentSrc || '').includes('story-image_')) {
    scheduleHideHoverDel();
    return;
  }
  if (getConfig().storyImageEnabled !== true) { hideHoverDel(); return; }
  const path = storyImgPath(img);
  if (!path) { scheduleHideHoverDel(); return; }
  const doc = img.ownerDocument || document;
  showHoverDel(doc, img, path);
  if (img.dataset.ubStoryTip === undefined) {
    img.dataset.ubStoryTip = '1';
    const entry = readStoryImageGallery().find(en => sameImagePath(en.path, path));
    if (entry?.description) img.title = entry.description;
  }
}

/** 点击目标是否生图失败占位链接（markdown 渲染的 <a href="#ub-sig-pending-<id>">）；返回占位 id。
 *  closest 容错点在锚内任意位置；宿主页元素跨 realm 判定一律用属性选择器（不用 instanceof）。 */
function pendingMarkerId(target: EventTarget | null): string | null {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return null;
  const anchor = el.closest('a[href^="#ub-sig-pending-"]') as HTMLAnchorElement | null;
  if (!anchor) return null;
  const m = (anchor.getAttribute('href') || '').match(/#ub-sig-pending-([a-z0-9-]+)/);
  return m ? m[1] : null;
}

/** 点击生图失败占位 → 用会话缓存的提示词原位重试生图（引擎缓存失效时自动清占位并提示）。 */
function retryPendingMarker(id: string): void {
  const toastr = getToastr();
  const warn = (msg: string): void => {
    try { toastr?.warning?.(msg, '正文插图'); } catch (_e) { /* ignore */ }
  };
  retryPendingStoryImage(id).then((r) => {
    try {
      if (r.ok) toastr?.success?.('已重新生成并插入原位置的插图', '正文插图');
      else if (r.aborted) toastr?.info?.('已终止本次重试', '正文插图');
      else warn(r.error || '重试失败，占位保留可再次点击');
    } catch (_e) { /* ignore */ }
  }, () => warn('重试失败，占位保留可再次点击'));
}

/** 点击正文插图 → 全屏放大（捕获阶段拦截，防其他扩展的图片默认行为）；占位链接 → 原位重试。 */
function onClickCapture(e: Event): void {
  if (getConfig().storyImageEnabled !== true) return;
  const pid = pendingMarkerId(e.target);
  if (pid) {
    e.preventDefault();
    e.stopPropagation();
    retryPendingMarker(pid);
    return;
  }
  const path = storyImgPath(e.target);
  if (!path) return;
  e.preventDefault();
  e.stopPropagation();
  hideHoverDel();
  const doc = (e.target as HTMLElement)?.ownerDocument || hostDocument();
  if (doc) openTextLightbox(doc, path);
}

/** F4：整组宿主监听（document 捕获 click + mouseover + 悬浮删除按钮）的统一拆卸。
 *  清单挂 window——模块重求值时新副本 init 先拆旧副本（旧实现每轮重求值会在宿主 body
 *  多残留一枚 .ub-story-hover-del 连同其监听，且委托监听叠加）。 */
export function stopStoryImageTextViewer(): void {
  const w = window as any;
  if (typeof w.__ub_stv_teardown === 'function') {
    try { w.__ub_stv_teardown(); } catch (_e) { /* ignore */ }
  }
}

/** 装载（幂等；doInitRender 每次调用）：宿主页委托监听一次绑定，处理器内部查开关。 */
export function initStoryImageTextViewer(): void {
  const doc = hostDocument();
  if (!doc || _bound) return;
  const w = window as any;
  // F4：先拆旧副本（若有），再以本副本绑定
  if (typeof w.__ub_stv_teardown === 'function') {
    try { w.__ub_stv_teardown(); } catch (_e) { /* ignore */ }
  }
  _bound = true;
  doc.addEventListener('click', onClickCapture, true);
  doc.addEventListener('mouseover', onMouseOver);
  // 占位按钮样式装载即注入（幂等 id）：失败占位要在首次出现时就呈现为可点按钮，不等首次交互
  ensureStyleOnce('ub-story-pending-css', STORY_IMAGE_PENDING_CSS, doc); // U35：收编幂等注入（目标＝宿主文档）
  applyStoryImageHostWidth(getConfig().storyImage.insertWidthPercent);
  w.__ub_stv_teardown = () => {
    doc.removeEventListener('click', onClickCapture, true);
    doc.removeEventListener('mouseover', onMouseOver);
    if (_hoverDel?.isConnected) _hoverDel.remove();
    _hoverDel = null;
    if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
    _bound = false;
    w.__ub_stv_teardown = null;
  };
}

/** 应用插图显示宽度（20-100%，相对消息正文区域，默认 80≈未加此样式时的观感；不影响生成分辨率）+ 水平对齐。
 *  宿主页注入一条规则（.mes_text 内 img[src*=story-image_]），拖动设置滑块/切换对齐即实时生效；无监听无轮询。
 *  对齐从配置读取（宽度仍由参数传入，保持既有调用形态）；left 不追加声明=与历史规则逐字节一致。 */
export function applyStoryImageHostWidth(percent: number): void {
  const doc = hostDocument();
  if (!doc) return;
  const v = Math.max(20, Math.min(100, Math.floor(percent) || STORY_IMAGE_DEFAULT_WIDTH_PERCENT));
  const cfgAlign = getConfig().storyImage.insertAlign;
  const align = cfgAlign === 'center' || cfgAlign === 'right' ? cfgAlign : 'left';
  let css = '.mes_text img[src*="story-image_"]{width:' + v + '%;';
  if (align === 'center') css += 'display:block;margin-left:auto;margin-right:auto;';
  else if (align === 'right') css += 'display:block;margin-left:auto;';
  css += '}';
  let style = doc.getElementById('ub-story-img-width') as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = 'ub-story-img-width';
    doc.head.appendChild(style);
  }
  style.textContent = css;
}
