import { padNumber } from './number';
import { triggerBlobDownload } from './zip-store';
import type { StyleType } from './constants';
import { escapeHtml } from './html-escape';

export type ArchiveKind = 'investigation' | 'interview';
export type ArchiveExportFormat = 'html' | 'png';

export interface ArchiveExportRequest {
  kind: ArchiveKind;
  format: ArchiveExportFormat;
  characterName: string;
  timestamp: string;
  style: StyleType;
  darkMode: boolean;
  fontScale: number;
  sourceElement: HTMLElement;
}

export interface ArchiveExportResult {
  filename: string;
  replacedImageCount: number;
  fileCount: number;
}

export type ArchiveExportErrorCode = 'invalid-size' | 'too-long' | 'snapshot' | 'image' | 'render' | 'download';

export class ArchiveExportError extends Error {
  constructor(
    public readonly code: ArchiveExportErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ArchiveExportError';
  }
}

export const ARCHIVE_HTML_MAX_WIDTH = 1520;
export const ARCHIVE_EXPORT_WIDTH = 440;
export const ARCHIVE_EXPORT_PIXEL_RATIO = 2;
export const ARCHIVE_PNG_SLICE_HEIGHT = 8_000;
export const ARCHIVE_MAX_CANVAS_SIDE = 32_767;
export const ARCHIVE_MAX_CANVAS_PIXELS = 64_000_000;
export const ARCHIVE_IMAGE_CONCURRENCY = 4;
export const ARCHIVE_HTML_AVATAR_MAX_SIDE = 128;
export const ARCHIVE_HTML_AVATAR_QUALITY = 0.82;

export interface ArchiveSnapshot {
  request: ArchiveExportRequest;
  host: HTMLElement;
  root: HTMLElement;
  content: HTMLElement;
  dispose: () => void;
}

export interface ArchivePngSlice {
  offsetY: number;
  height: number;
}

interface ArchiveFilenameMetadata {
  characterName: string;
  kind: ArchiveKind;
  timestamp: string;
  style: StyleType;
  fontScale: number;
}

export function sanitizeArchiveFilenamePart(value: string, fallback: string): string {
  const withoutControls = Array.from(String(value || ''))
    .filter(char => {
      const codePoint = char.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join('');
  const cleaned = withoutControls
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 60);
  return cleaned || fallback;
}

function formatArchiveLocalTime(date: Date): string {
  return `${date.getFullYear()}${padNumber(date.getMonth() + 1)}${padNumber(date.getDate())} ${padNumber(date.getHours())}${padNumber(date.getMinutes())}`;
}

export function buildArchiveFilename(
  metadata: ArchiveFilenameMetadata,
  extension: ArchiveExportFormat,
  now = new Date(),
): string {
  const character = sanitizeArchiveFilenamePart(metadata.characterName, '未命名角色');
  const kind = metadata.kind === 'investigation' ? '大调查' : '大采访';
  const timestamp = sanitizeArchiveFilenamePart(metadata.timestamp, formatArchiveLocalTime(now));
  const style = sanitizeArchiveFilenamePart(metadata.style, 'theme');
  const scale = Math.round((Number.isFinite(metadata.fontScale) ? metadata.fontScale : 1) * 100);
  return `${character}-${kind}-${timestamp}-${style}-${scale}%.${extension}`;
}

export function calculateArchiveThumbnailSize(
  sourceWidth: number,
  sourceHeight: number,
  maxSide = ARCHIVE_HTML_AVATAR_MAX_SIDE,
): { width: number; height: number } {
  if (![sourceWidth, sourceHeight, maxSide].every(value => Number.isFinite(value) && value > 0)) {
    throw new ArchiveExportError('image', '头像尺寸无效，无法压缩');
  }
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

export function calculateArchiveCanvasSize(cssHeight: number): { width: number; height: number } {
  if (!Number.isFinite(cssHeight) || cssHeight <= 0) {
    throw new ArchiveExportError('invalid-size', '档案尺寸无效，无法生成 PNG');
  }
  const width = ARCHIVE_EXPORT_WIDTH * ARCHIVE_EXPORT_PIXEL_RATIO;
  const height = Math.ceil(cssHeight * ARCHIVE_EXPORT_PIXEL_RATIO);
  if (
    width > ARCHIVE_MAX_CANVAS_SIDE
    || height > ARCHIVE_MAX_CANVAS_SIDE
    || width * height > ARCHIVE_MAX_CANVAS_PIXELS
  ) {
    throw new ArchiveExportError('too-long', '档案过长，当前浏览器无法生成单张 PNG；可改用 HTML 导出');
  }
  return { width, height };
}

export function calculateArchivePngSlices(cssHeight: number): ArchivePngSlice[] {
  if (!Number.isFinite(cssHeight) || cssHeight <= 0) {
    throw new ArchiveExportError('invalid-size', '档案尺寸无效，无法生成 PNG');
  }
  const totalHeight = Math.ceil(cssHeight);
  const slices: ArchivePngSlice[] = [];
  for (let offsetY = 0; offsetY < totalHeight; offsetY += ARCHIVE_PNG_SLICE_HEIGHT) {
    slices.push({ offsetY, height: Math.min(ARCHIVE_PNG_SLICE_HEIGHT, totalHeight - offsetY) });
  }
  return slices;
}

export function stripExternalCssImports(css: string): string {
  return css.replace(/@import\s+(?:url\([^;]+\)|["'][^"']+["'])\s*;/gi, '');
}

function normalizeArchiveCss(css: string): string {
  return stripExternalCssImports(css)
    .replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (match, _quote: string, resource: string) => {
      const value = resource.trim();
      return /^(?:data:|#)/i.test(value) ? match : 'none';
    })
    .replace(/body\.dark-mode/g, '.archive-export-root.dark-mode');
}

export function sanitizeArchiveMarkup(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/\s+on[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:src|href)\s*=\s*(["'])https?:\/\/[^"']*\1/gi, '')
    .replace(/<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi, (_match, attributes: string, css: string) => {
      return `<style${attributes}>${normalizeArchiveCss(css)}</style>`;
    });
}

function firstVisibleInitial(label: string): string {
  return Array.from(String(label || '')).find(char => /[\p{L}\p{N}]/u.test(char)) || '？';
}

export function createInitialAvatarDataUrl(label: string): string {
  const initial = firstVisibleInitial(label);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">'
    + '<circle cx="48" cy="48" r="48" fill="#756a62"/>'
    + '<text x="48" y="59" text-anchor="middle" font-family="sans-serif" font-size="36" fill="#f4eee7">'
    + initial
    + '</text></svg>';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function removeUnsafeNodes(root: ParentNode): void {
  root.querySelectorAll('script,link[rel="stylesheet"]').forEach(node => node.remove());
  root.querySelectorAll<HTMLElement>('*').forEach(node => {
    for (const attribute of Array.from(node.attributes)) {
      if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
    }
    if (node.id) node.removeAttribute('id');
  });
  root.querySelectorAll('style').forEach(style => {
    style.textContent = normalizeArchiveCss(style.textContent || '');
  });
}

function copyComputedCustomProperties(source: Element, target: HTMLElement): void {
  const computed = getComputedStyle(source);
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    if (!property.startsWith('--')) continue;
    const value = computed.getPropertyValue(property);
    if (value) target.style.setProperty(property, value);
  }
}

export function createArchiveSnapshot(request: ArchiveExportRequest): ArchiveSnapshot {
  if (!request.sourceElement?.isConnected) {
    throw new ArchiveExportError('snapshot', '当前档案尚未加载，无法导出');
  }
  const content = request.sourceElement.cloneNode(true) as HTMLElement;
  removeUnsafeNodes(content);

  // 离屏宿主只是把克隆留在文档里，让 <img> 的 currentSrc/srcset 在图片内嵌阶段能正常解析；
  // PNG 已不再直接栅格化这个宿主，所以这里不再设置宽度、zoom 或窄屏样式。
  const host = document.createElement('div');
  host.className = 'archive-export-host';
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;z-index:-2147483648;overflow:visible;';
  host.appendChild(content);
  document.body.appendChild(host);

  // 离屏 root 只用于收集主题已解析的 CSS 自定义属性，作为独立 HTML 的 rootStyle；
  // 它本身不进入文档、不参与栅格化。
  const root = document.createElement('div');
  root.className = `archive-export-root panel-overlay${request.darkMode ? ' dark dark-mode' : ''}`;
  root.dataset.archiveKind = request.kind;
  root.dataset.archiveStyle = request.style;
  copyComputedCustomProperties(request.sourceElement, root);

  const scale = Math.min(1.5, Math.max(0.9, Number.isFinite(request.fontScale) ? request.fontScale : 1));
  return {
    request: { ...request, fontScale: scale },
    host,
    root,
    content,
    dispose: () => host.remove(),
  };
}

function waitForFonts(timeoutMs = 1500): Promise<void> {
  if (!document.fonts?.ready) return Promise.resolve();
  return Promise.race([
    document.fonts.ready.then(() => undefined),
    new Promise<void>(resolve => window.setTimeout(resolve, timeoutMs)),
  ]);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new ArchiveExportError('image', '图片读取失败'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

async function fetchImageAsDataUrl(source: string, timeoutMs = 3000): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(source, { signal: controller.signal, credentials: 'same-origin' });
    if (!response.ok) throw new ArchiveExportError('image', `图片请求失败：${response.status}`);
    return await blobToDataUrl(await response.blob());
  } finally {
    window.clearTimeout(timeout);
  }
}

function avatarFallbackLabel(image: HTMLImageElement, request: ArchiveExportRequest): string {
  if (image.alt.trim()) return image.alt;
  if (image.dataset.name?.trim()) return image.dataset.name;
  const person = image.closest<HTMLElement>('.itv-person,.itv-turn,.iv-wrap');
  const nearby = person?.querySelector<HTMLElement>('.itv-speaker,.itv-person-name,.iv-dossier-name');
  return nearby?.textContent?.trim() || request.characterName;
}

async function prepareOneImage(image: HTMLImageElement, request: ArchiveExportRequest): Promise<boolean> {
  const source = image.currentSrc || image.src || image.getAttribute('src') || '';
  if (source.startsWith('data:')) return false;
  try {
    if (!source) throw new ArchiveExportError('image', '图片地址为空');
    image.src = await fetchImageAsDataUrl(source);
    return false;
  } catch {
    image.src = createInitialAvatarDataUrl(avatarFallbackLabel(image, request));
    image.removeAttribute('srcset');
    return true;
  }
}

function canvasToEncodedBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

async function buildArchiveAvatarThumbnail(source: string): Promise<string> {
  if (!source.startsWith('data:image/') || source.startsWith('data:image/svg+xml')) return source;
  const image = await loadArchiveImage(source);
  const size = calculateArchiveThumbnailSize(image.naturalWidth || image.width, image.naturalHeight || image.height);
  if (size.width === image.naturalWidth && size.height === image.naturalHeight) return source;

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) return source;
  context.drawImage(image, 0, 0, size.width, size.height);
  const blob = await canvasToEncodedBlob(canvas, 'image/webp', ARCHIVE_HTML_AVATAR_QUALITY);
  return blob ? blobToDataUrl(blob) : source;
}

async function prepareArchiveHtmlAvatarThumbnails(snapshot: ArchiveSnapshot): Promise<void> {
  const images = Array.from(snapshot.root.querySelectorAll<HTMLImageElement>('.itv-avatar img'));
  const thumbnailBySource = new Map<string, Promise<string>>();
  await Promise.all(images.map(async image => {
    const source = image.getAttribute('src') || image.currentSrc || image.src || '';
    if (!source) return;
    let thumbnail = thumbnailBySource.get(source);
    if (!thumbnail) {
      thumbnail = buildArchiveAvatarThumbnail(source).catch(() => source);
      thumbnailBySource.set(source, thumbnail);
    }
    image.src = await thumbnail;
    image.removeAttribute('srcset');
  }));
}

export async function prepareArchiveAssets(snapshot: ArchiveSnapshot): Promise<number> {
  await waitForFonts();
  const images = Array.from(snapshot.root.querySelectorAll<HTMLImageElement>('img'));
  let nextIndex = 0;
  let replacedImageCount = 0;
  const workers = Array.from({ length: Math.min(ARCHIVE_IMAGE_CONCURRENCY, images.length) }, async () => {
    while (nextIndex < images.length) {
      const image = images[nextIndex];
      nextIndex += 1;
      if (await prepareOneImage(image, snapshot.request)) replacedImageCount += 1;
    }
  });
  await Promise.all(workers);
  if (snapshot.request.format === 'html') await prepareArchiveHtmlAvatarThumbnails(snapshot);
  return replacedImageCount;
}

export interface ArchiveHtmlDocumentInput {
  title: string;
  markup: string;
  darkMode: boolean;
  fontScale: number;
  rootStyle?: string;
  kind?: ArchiveKind;
  style?: StyleType;
  // HTML 导出默认去重重复头像以减小文件体积；PNG 渲染必须保留原始 <img src=data:…>，
  // 因为 html2canvas-pro 渲染替换元素靠的是 src，content:url() 去重写法不会被栅格化。
  deduplicate?: boolean;
}

interface DeduplicatedArchiveImages {
  markup: string;
  css: string;
}

const ARCHIVE_TRANSPARENT_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

export function deduplicateEmbeddedArchiveImages(markup: string): DeduplicatedArchiveImages {
  const imagePattern = /<img\b[^>]*?\bsrc=(['"])(data:image\/[^'"]+)\1[^>]*>/gi;
  const counts = new Map<string, number>();
  for (const match of markup.matchAll(imagePattern)) {
    const source = match[2];
    counts.set(source, (counts.get(source) || 0) + 1);
  }

  const classBySource = new Map<string, string>();
  const cssRules: string[] = [];
  const compactMarkup = markup.replace(imagePattern, (imageTag, _quote: string, source: string) => {
    if ((counts.get(source) || 0) < 2) return imageTag;
    let className = classBySource.get(source);
    if (!className) {
      className = `archive-export-image-${classBySource.size}`;
      classBySource.set(source, className);
      const cssSource = source.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, '');
      cssRules.push(`.${className}{content:url("${cssSource}")}`);
    }

    let compactTag = imageTag.replace(/\bsrc=(['"])(data:image\/[^'"]+)\1/i, `src="${ARCHIVE_TRANSPARENT_IMAGE}"`);
    if (/\bclass=(['"])(.*?)\1/i.test(compactTag)) {
      compactTag = compactTag.replace(/\bclass=(['"])(.*?)\1/i, (_classAttribute: string, quote: string, classes: string) => {
        return `class=${quote}${classes} ${className}${quote}`;
      });
    } else {
      compactTag = compactTag.replace(/^<img\b/i, `<img class="${className}"`);
    }
    return compactTag;
  });

  return { markup: compactMarkup, css: cssRules.join('') };
}

export function buildStandaloneHtmlDocument(input: ArchiveHtmlDocumentInput): string {
  const scale = Math.min(1.5, Math.max(0.9, Number.isFinite(input.fontScale) ? input.fontScale : 1));
  const rootClass = `archive-export-root panel-overlay${input.darkMode ? ' dark dark-mode' : ''}`;
  const rootStyle = sanitizeArchiveMarkup(input.rootStyle || '');
  const sanitizedMarkup = sanitizeArchiveMarkup(input.markup);
  const compact = input.deduplicate === false
    ? { markup: sanitizedMarkup, css: '' }
    : deduplicateEmbeddedArchiveImages(sanitizedMarkup);
  const kindAttribute = input.kind ? ` data-archive-kind="${input.kind}"` : '';
  const styleAttribute = input.style ? ` data-archive-style="${input.style}"` : '';
  return '<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + `<title>${escapeHtml(input.title)}</title>`
    + '<style>:root{--archive-font-scale:' + scale + '}*{box-sizing:border-box}'
    + 'html,body{margin:0;padding:0;width:100%;min-width:0}'
    + 'body{display:flex;justify-content:center;align-items:flex-start;background:transparent}'
    + '.archive-export-root{width:min(100%,' + ARCHIVE_HTML_MAX_WIDTH + 'px)!important;max-width:' + ARCHIVE_HTML_MAX_WIDTH + 'px;overflow:hidden}'
    + '.archive-export-root>*{width:calc(100% / var(--archive-font-scale))!important;max-width:none!important}'
    + compact.css + '</style>'
    + `</head><main class="${rootClass}"${kindAttribute}${styleAttribute}`
    + (rootStyle ? ` style="${escapeHtml(rootStyle)}"` : '')
    + `>${compact.markup}</main></html>`;
}

export function buildStandaloneHtml(snapshot: ArchiveSnapshot): string {
  const kindLabel = snapshot.request.kind === 'investigation' ? '大调查' : '大采访';
  return buildStandaloneHtmlDocument({
    title: `${snapshot.request.characterName || '未命名角色'} · ${kindLabel}`,
    markup: snapshot.content.outerHTML,
    darkMode: snapshot.request.darkMode,
    fontScale: snapshot.request.fontScale,
    rootStyle: snapshot.root.style.cssText,
    kind: snapshot.request.kind,
    style: snapshot.request.style,
  });
}

export function buildStaticExportCss(): string {
  return '.archive-export-root *,.archive-export-root *::before,.archive-export-root *::after{'
    + 'animation:none!important;transition:none!important;caret-color:transparent!important}';
}

function buildNarrowPngCss(): string {
  return '.archive-export-root[data-archive-kind="interview"] .itv-cover{padding:24px 18px 18px}'
    + '.archive-export-root[data-archive-kind="interview"] .itv-cover h2{font-size:22px}'
    + '.archive-export-root[data-archive-kind="interview"] .itv-roster{grid-template-columns:1fr;padding:14px 18px}'
    + '.archive-export-root[data-archive-kind="interview"] .itv-roster-divider{display:none}'
    + '.archive-export-root[data-archive-kind="interview"] .itv-roster-answer{justify-content:flex-start}'
    + '.archive-export-root[data-archive-kind="interview"] .itv-roster-answer .itv-roster-label{text-align:left}'
    + '.archive-export-root[data-archive-kind="interview"] .itv-transcript{padding:20px 16px 28px}'
    + '.archive-export-root[data-archive-kind="interview"] .itv-turn-body{max-width:84%}'
    + '.archive-export-root[data-archive-kind="interview"] .itv-avatar{flex-basis:40px;width:40px;height:40px;font-size:14px}'
    + '.archive-export-root[data-archive-kind="interview"] .itv-narration,.archive-export-root[data-archive-kind="interview"] .itv-scene,.archive-export-root[data-archive-kind="interview"] .itv-sound{margin:18px 16px}'
    + '.archive-export-root[data-archive-kind="interview"] .itv-epilogue{margin:0 16px 18px}';
}

function loadArchiveImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ArchiveExportError('image', '图片解码失败'));
    image.src = source;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new ArchiveExportError('render', 'PNG 生成失败，浏览器未返回图片数据'));
      }, 'image/png');
    } catch (error) {
      reject(new ArchiveExportError('render', 'PNG 生成失败，画布无法读取', { cause: error }));
    }
  });
}

// —— html2canvas-pro 动态加载 ——
// 不做顶层静态 import：ESM 静态导入会把 CDN 拉取变成整个状态栏模块的执行前提（网络慢/
// 不可达 = 状态栏整体不出现）。改为首次导出 PNG 时按需加载（同一会话内缓存），HTML 导出
// 与其余功能完全不依赖它；加载失败只影响 PNG 导出并给出可读提示。
type Html2CanvasFn = typeof import('html2canvas-pro')['html2canvas'];
let _html2canvasFn: Html2CanvasFn | null = null;
async function loadHtml2Canvas(): Promise<Html2CanvasFn> {
  if (_html2canvasFn) return _html2canvasFn;
  try {
    const mod = await import('html2canvas-pro');
    _html2canvasFn = mod.html2canvas;
    return _html2canvasFn;
  } catch (error) {
    throw new ArchiveExportError('render', '截图组件（html2canvas-pro）加载失败，请检查网络后刷新页面重试；HTML 导出不受影响', { cause: error as Error });
  }
}

async function renderArchivePngSlice(
  html2canvas: Html2CanvasFn,
  archiveRoot: HTMLElement,
  cssHeight: number,
  slice: ArchivePngSlice,
): Promise<Blob> {
  calculateArchiveCanvasSize(slice.height);
  try {
    const canvas = await html2canvas(archiveRoot, {
      foreignObjectRendering: false,
      allowTaint: false,
      useCORS: false,
      backgroundColor: null,
      scale: ARCHIVE_EXPORT_PIXEL_RATIO,
      x: 0,
      y: slice.offsetY,
      width: ARCHIVE_EXPORT_WIDTH,
      height: slice.height,
      scrollX: 0,
      scrollY: 0,
      windowWidth: ARCHIVE_EXPORT_WIDTH,
      windowHeight: cssHeight,
      logging: false,
      removeContainer: true,
      imageTimeout: 5_000,
      imageSmoothing: true,
      imageSmoothingQuality: 'high',
    });
    return canvasToPngBlob(canvas);
  } catch (error) {
    if (error instanceof ArchiveExportError) throw error;
    throw new ArchiveExportError('render', 'PNG DOM 绘制失败', { cause: error });
  }
}

export async function renderArchivePng(snapshot: ArchiveSnapshot): Promise<Blob[]> {
  // PNG 不再栅格化活动弹窗的离屏克隆，而是把与 HTML 导出同一份的自包含独立文档写进一个
  // 临时同源 iframe，再用 html2canvas-pro 栅格化 iframe 内的 .archive-export-root。
  // 这样 PNG 的 CSS 上下文与离线 HTML 完全一致、与主文档无关，避免主题变量漂移和 canvas 污染。
  const standaloneHtml = buildStandaloneHtmlDocument({
    title: `${snapshot.request.characterName || '未命名角色'} · ${snapshot.request.kind === 'investigation' ? '大调查' : '大采访'}`,
    markup: snapshot.content.outerHTML,
    darkMode: snapshot.request.darkMode,
    fontScale: snapshot.request.fontScale,
    rootStyle: snapshot.root.style.cssText,
    kind: snapshot.request.kind,
    style: snapshot.request.style,
    deduplicate: false,
  });

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:fixed;left:-100000px;top:0;width:${ARCHIVE_EXPORT_WIDTH}px;height:0;border:0;pointer-events:none;z-index:-2147483648;`;
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new ArchiveExportError('render', '无法创建 PNG 渲染窗口，浏览器可能拦截了 iframe');
    doc.open();
    doc.write(standaloneHtml);
    doc.close();
    if (doc.fonts?.ready) {
      await Promise.race([
        doc.fonts.ready.then(() => undefined),
        new Promise<void>(resolve => window.setTimeout(resolve, 1500)),
      ]);
    }
    const archiveRoot = doc.querySelector<HTMLElement>('.archive-export-root');
    if (!archiveRoot) throw new ArchiveExportError('render', 'PNG 渲染容器缺失，导出中止');
    const exportStyle = doc.createElement('style');
    exportStyle.textContent = buildNarrowPngCss() + buildStaticExportCss();
    archiveRoot.appendChild(exportStyle);
    // 等待注入的 CSS 与 data: 图片解码落定后再测量高度与切片。
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
    const cssHeight = Math.ceil(Math.max(archiveRoot.scrollHeight, archiveRoot.getBoundingClientRect().height));
    const html2canvas = await loadHtml2Canvas();
    const blobs: Blob[] = [];
    for (const slice of calculateArchivePngSlices(cssHeight)) {
      blobs.push(await renderArchivePngSlice(html2canvas, archiveRoot, cssHeight, slice));
    }
    return blobs;
  } finally {
    frame.remove();
  }
}

export function buildArchivePartFilename(filename: string, index: number, fileCount: number): string {
  if (fileCount <= 1) return filename;
  const suffix = String(index + 1).padStart(2, '0');
  return filename.replace(/\.png$/i, `-${suffix}.png`);
}

function downloadArchiveBlob(blob: Blob, filename: string): void {
  // U36：下载收编规范口（triggerBlobDownload 的 click 抛错透传在此包装为导出错误卡片）
  try {
    triggerBlobDownload(blob, filename);
  } catch (error) {
    throw new ArchiveExportError('download', '浏览器阻止了文件保存', { cause: error });
  }
}

export async function exportArchive(request: ArchiveExportRequest): Promise<ArchiveExportResult> {
  const snapshot = createArchiveSnapshot(request);
  try {
    const replacedImageCount = await prepareArchiveAssets(snapshot);
    const filename = buildArchiveFilename(request, request.format);
    if (request.format === 'html') {
      downloadArchiveBlob(new Blob([buildStandaloneHtml(snapshot)], { type: 'text/html;charset=utf-8' }), filename);
      return { filename, replacedImageCount, fileCount: 1 };
    }
    const blobs = await renderArchivePng(snapshot);
    blobs.forEach((blob, index) => downloadArchiveBlob(blob, buildArchivePartFilename(filename, index, blobs.length)));
    return { filename, replacedImageCount, fileCount: blobs.length };
  } finally {
    snapshot.dispose();
  }
}
