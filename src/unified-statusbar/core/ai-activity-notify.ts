// ===== 文字 AI 请求统一酒馆通知（聚合单条 toast） =====
// 订阅活动注册表，只维护一条聚合 toast：
//   · 单条：大调查 · 请求中（第 1/2 次）
//   · 多条：3 项 AI 请求进行中：大调查、采访、瑟瑟指导
// 持久化由 aiNoticePersist 决定（默认关 = 3 秒自动隐去；下一次阶段变化重新出现）。
// 点击 toast 本体 = 终止第一条请求；关闭按钮 = 只关通知（主界面提示条是常驻取消入口）。
// 失败/空回/格式错误仍走 showPersistentError/Warning，不受该开关影响。
import { getToastr } from './env';
import { getConfig } from './config-store';
import { cancelAiActivity, listCurrentChatAiActivities, subscribeAiActivities, type AiActivityEntry } from './ai-activity';
import { aiPhaseText } from './ai-text-features';

const TOAST_TITLE = 'AI 请求';
const AUTO_HIDE_MS = 3000;

let _inited = false;
let _toastEl: any = null;
let _toastText: Text | null = null;

function _hostDoc(): Document | null {
  try { return (window.parent as any).document || document; } catch (_e) { return document; }
}

function _toastAlive(el: any): boolean {
  try {
    const node = el?.[0] ?? el;
    return !!(node && node.isConnected !== false && node.parentNode);
  } catch (_e) { return false; }
}

function _closeToast(): void {
  const el = _toastEl;
  _toastEl = null;
  _toastText = null;
  if (!el) return;
  const toastr: any = getToastr();
  try { if (toastr && typeof toastr.clear === 'function') toastr.clear(el, { force: true }); } catch (_e) { /* ignore */ }
  try { el.remove?.(); } catch (_e) { /* ignore */ }
}

function _noticeText(entries: AiActivityEntry[]): string {
  if (entries.length === 0) return '';
  if (entries.length > 1) {
    const names = entries.slice(0, 3).map(e => e.label).join('、');
    const more = entries.length > 3 ? ' 等' : '';
    return `${entries.length} 项 AI 请求进行中：${names}${more}（点击终止）`;
  }
  const e = entries[0];
  const phase = aiPhaseText({ phase: e.phase, attempt: e.attempt, maxAttempts: e.maxAttempts });
  return `${e.label} · ${phase}${e.cancelable ? '（点击终止）' : ''}`;
}

function _ensureToast(text: string): any {
  const toastr: any = getToastr();
  if (!toastr || typeof toastr.info !== 'function') return null;
  const persist = getConfig().aiNoticePersist === true;
  const opts = {
    timeOut: persist ? 0 : AUTO_HIDE_MS,
    extendedTimeOut: 0,
    tapToDismiss: false,
    closeButton: true,
    progressBar: !persist,
  };
  let el: any = null;
  try { el = toastr.info(text, TOAST_TITLE, opts); } catch (_e) { return null; }
  _toastEl = el;
  const doc = _hostDoc();
  const container: HTMLElement | undefined = el?.find?.('.toast-message')?.get?.(0);
  if (container && doc) {
    container.textContent = '';
    _toastText = doc.createTextNode(text);
    container.appendChild(_toastText);
  } else {
    _toastText = null;
  }
  // 点击 toast 本体终止第一条；关闭按钮只关通知
  const node: HTMLElement | undefined = el?.[0];
  if (node) {
    node.addEventListener('click', (ev: Event) => {
      const target = ev.target as HTMLElement | null;
      if (target && target.closest && target.closest('.toast-close-button')) return;
      const list = listCurrentChatAiActivities().filter(e => e.cancelable && e.phase !== 'terminating');
      if (list.length > 0) cancelAiActivity(list[0].id);
    });
  }
  return el;
}

function _render(): void {
  const entries = listCurrentChatAiActivities().filter(e => e.suppressToast !== true);
  if (entries.length === 0) {
    _closeToast();
    return;
  }
  const text = _noticeText(entries);
  if (!text) { _closeToast(); return; }
  if (_toastEl && _toastText && _toastAlive(_toastEl)) {
    _toastText.nodeValue = text;
    return;
  }
  _closeToast();
  _ensureToast(text);
}

/** 初始化统一通知（幂等）：订阅注册表，首次有活动时才创建 toast。 */
export function initAiActivityNotify(): void {
  if (_inited) return;
  _inited = true;
  subscribeAiActivities(() => _render());
}

/** 切聊天/重注入后主动重算一次（chatKey 过滤依赖当前聊天，注册表本身不会因此发事件）。 */
export function refreshAiActivityNotify(): void {
  if (!_inited) return;
  _render();
}

/** 测试用：重置内部句柄（不主动创建/销毁 toastr）。 */
export function _resetAiActivityNotifyForTest(): void {
  _inited = false;
  _toastEl = null;
  _toastText = null;
}
