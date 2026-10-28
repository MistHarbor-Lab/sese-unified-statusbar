// renderers/confirm-dialog.ts
// 主题化 confirm/prompt 弹窗：复用 .panel-popup 框架（base.ts 常驻注入），
// 自身样式完全由 .ub-confirm-* CSS（styles/base.ts，同样常驻）驱动，
// 不依赖 portrait-base.ts（其 CSS 随 portraitEnabled 开关注入/移除）。
import { getConfig } from '../core/config-store';
import {
  closePanelOverlay, guardGhostClick, markPopupShown, bridgeWindowClass,
  syncDarkClass, syncDarkClassMinimal,
} from './html-builder';
import { escapeHtml as esc } from '../core/html-escape';

export interface ConfirmDialogOptions {
  message: string;
  title?: string;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
}

/** 适配 core 层 DI 的 `(message: string) => Promise<boolean>` 确认回调签名。 */
export function confirmMessage(message: string): Promise<boolean> {
  return showConfirmDialog({ message });
}
export interface PromptDialogOptions {
  message: string;
  defaultValue?: string;
  placeholder?: string;
  title?: string;
  okText?: string;
  cancelText?: string;
}

function isSelf(e: Event, el: HTMLElement): boolean {
  return (e.target as HTMLElement) === el;
}

/** 渲染一个叠加在 body 上的主题化弹窗，返回其状态句柄（关闭时自移除）。
 *  导出供需要自定义内容（如下拉选择）的轻量弹窗复用同一框架。 */
export function openDialog(bodyHtml: string, opts: { focusSel?: string }): { overlay: HTMLElement; dialog: HTMLElement } {
  const style = getConfig().style;
  const overlay = document.createElement('div');
  overlay.className = 'panel-overlay ub-confirm-overlay';
  overlay.style.zIndex = '10025';
  document.body.appendChild(overlay);
  if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  overlay.innerHTML = bodyHtml;
  markPopupShown();
  overlay.classList.add('show');
  const dialog = overlay.firstElementChild as HTMLElement;
  if (opts.focusSel) {
    const el = overlay.querySelector<HTMLElement>(opts.focusSel);
    requestAnimationFrame(() => el?.focus());
  }
  return { overlay, dialog };
}

export function closeDialog(overlay: HTMLElement): void {
  closePanelOverlay(overlay);
  overlay.remove();
}

export function showConfirmDialog(opts: ConfirmDialogOptions): Promise<boolean> {
  const style = getConfig().style;
  const title = esc(opts.title ?? '提示');
  const message = esc(opts.message);
  const okText = esc(opts.okText ?? '确定');
  const cancelText = esc(opts.cancelText ?? '取消');
  const dialogClass = style === 'bridge' ? bridgeWindowClass('confirm','s') : 'panel-popup ub-popup--s';
  const body =
    '<div class="' + dialogClass + ' ub-confirm-dialog">' +
      '<div class="ub-confirm-title">' + title + '</div>' +
      '<div class="ub-confirm-message">' + message + '</div>' +
      '<div class="ub-confirm-btns">' +
        '<button type="button" class="ub-confirm-btn ub-confirm-btn-cancel">' + cancelText + '</button>' +
        '<button type="button" class="ub-confirm-btn ub-confirm-btn-ok' + (opts.danger ? ' ub-confirm-btn-danger' : '') + '">' + okText + '</button>' +
      '</div>' +
    '</div>';
  const { overlay } = openDialog(body, {});
  return new Promise((resolve) => {
    let done = false;
    const finish = (result: boolean): void => {
      if (done) return;
      done = true;
      closeDialog(overlay);
      resolve(result);
    };
    overlay.onclick = (e) => {
      if (isSelf(e, overlay)) { if (guardGhostClick()) return; finish(false); return; }
      if ((e.target as HTMLElement).closest('.ub-confirm-btn-cancel')) { finish(false); return; }
      if ((e.target as HTMLElement).closest('.ub-confirm-btn-ok')) { finish(true); return; }
    };
    overlay.onkeydown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); return; }
      if (e.key === 'Enter') { e.preventDefault(); finish(true); return; }
    };
  });
}

export function showPromptDialog(opts: PromptDialogOptions): Promise<string | null> {
  const style = getConfig().style;
  const title = esc(opts.title ?? '输入');
  const message = esc(opts.message);
  const okText = esc(opts.okText ?? '确定');
  const cancelText = esc(opts.cancelText ?? '取消');
  const dialogClass = style === 'bridge' ? bridgeWindowClass('confirm','s') : 'panel-popup ub-popup--s';
  const body =
    '<div class="' + dialogClass + ' ub-confirm-dialog">' +
      '<div class="ub-confirm-title">' + title + '</div>' +
      '<div class="ub-confirm-message">' + message + '</div>' +
      '<div class="ub-confirm-field">' +
        '<input class="ub-confirm-input" value="' + esc(opts.defaultValue ?? '') + '" placeholder="' + esc(opts.placeholder ?? '') + '" autocomplete="off">' +
      '</div>' +
      '<div class="ub-confirm-btns">' +
        '<button type="button" class="ub-confirm-btn ub-confirm-btn-cancel">' + cancelText + '</button>' +
        '<button type="button" class="ub-confirm-btn ub-confirm-btn-ok">' + okText + '</button>' +
      '</div>' +
    '</div>';
  const { overlay } = openDialog(body, { focusSel: '.ub-confirm-input' });
  const input = overlay.querySelector<HTMLInputElement>('.ub-confirm-input');
  return new Promise((resolve) => {
    let done = false;
    const finish = (result: string | null): void => {
      if (done) return;
      done = true;
      closeDialog(overlay);
      resolve(result);
    };
    overlay.onclick = (e) => {
      if (isSelf(e, overlay)) { if (guardGhostClick()) return; finish(null); return; }
      if ((e.target as HTMLElement).closest('.ub-confirm-btn-cancel')) { finish(null); return; }
      if ((e.target as HTMLElement).closest('.ub-confirm-btn-ok')) { finish(input?.value ?? ''); return; }
    };
    overlay.onkeydown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(null); return; }
      if (e.key === 'Enter') { e.preventDefault(); finish(input?.value ?? ''); return; }
    };
  });
}

/** 超长帮助说明（>~120 字）点「?」打开的说明面板：hover 气泡（260px 定宽）装不下的多段教程改走这里。
 *  复用 openDialog 框架（主题化/深色/幽灵点击防护白拿），内容可滚动，按钮/遮罩/ESC 关闭。 */
export function showHelpPanel(text: string): void {
  const style = getConfig().style;
  const dialogClass = style === 'bridge' ? bridgeWindowClass('confirm', 's') : 'panel-popup ub-popup--s';
  const body =
    '<div class="' + dialogClass + ' ub-confirm-dialog">' +
      '<div class="ub-confirm-title">说明</div>' +
      '<div class="ub-confirm-message" style="max-height:60vh;overflow-y:auto;text-align:left;white-space:pre-wrap;">' + esc(text.replace(/\\n/g, '\n')) + '</div>' +
      '<div class="ub-confirm-btns"><button type="button" class="ub-confirm-btn ub-confirm-btn-ok">知道了</button></div>' +
    '</div>';
  const { overlay } = openDialog(body, {});
  overlay.onclick = (e) => {
    if (isSelf(e, overlay)) { if (guardGhostClick()) return; closeDialog(overlay); return; }
    if ((e.target as HTMLElement).closest('.ub-confirm-btn-ok')) closeDialog(overlay);
  };
  overlay.onkeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeDialog(overlay); }
  };
}
