// ===== 系统必选决策专用 overlay（不复用 #panelOverlay） =====

import { getConfig } from '../core/config-store';
import { systemDecisionQueue, invalidateSystemDecisions, type SystemDecisionResult } from '../core/system-decision-queue';

export interface SystemDecisionViewHost {
  body: HTMLElement;
  submit: (choice: unknown) => Promise<SystemDecisionResult>;
  setError: (message: string) => void;
}

export interface SystemDecisionView {
  title: string;
  bodyHtml: string;
  /** 开启后在弹窗右上角显示 ✕ 退出按钮（仅用于可放弃的决策，如地图归属确认） */
  dismissible?: boolean;
  bind?: (host: SystemDecisionViewHost) => void;
}

let _initialized = false;
let _shownAt = 0;
let _activeKey = '';
let _lastError = '';

function syncDecisionDarkClass(overlay: HTMLElement): void {
  // plugin 模式：darkTheme 配置即事实源。决策弹窗常先于主面板渲染打开，
  // 锚点未挂主题类时 DOM 镜像不可靠（折叠态/首启），读配置保证弹窗配色自洽。
  overlay.classList.toggle('dark', getConfig().darkTheme);
}

export function ensureDecisionOverlay(): HTMLElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  let overlay = document.getElementById('ubDecisionOverlay') as HTMLElement | null;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ubDecisionOverlay';
    overlay.className = 'ub-decision-overlay';
    overlay.setAttribute('role', 'presentation');
    document.body.appendChild(overlay);
  } else if (overlay.parentElement !== document.body) {
    document.body.appendChild(overlay);
  }
  return overlay;
}

function renderQueueState(): void {
  const overlay = ensureDecisionOverlay();
  if (!overlay) return;
  const item = systemDecisionQueue.activeItem;
  if (!item) {
    _activeKey = '';
    _lastError = '';
    overlay.classList.remove('show', 'is-busy');
    overlay.innerHTML = '';
    return;
  }
  if (_activeKey !== item.key) {
    _activeKey = item.key;
    _lastError = '';
  }
  const view = item.payload as SystemDecisionView | undefined;
  if (!view || typeof view.bodyHtml !== 'string') return;
  // 空候选防御：地图归属类依赖候选列表（bodyHtml 含 data-map-location-action 且有候选 radio）。
  // 若 body 是地图归属决策但候选 radio 数为零（候选为空），弹窗会变成「无选项、按钮全失效、
  // 只能 ✕ 退出」的死弹窗。直接丢弃该决策，不渲染。非地图决策（孕期/受孕形式/跳跃摘要）不受影响。
  if (/data-map-location-action/.test(view.bodyHtml) && !/name="mapLocationCandidate"/.test(view.bodyHtml)) {
    invalidateSystemDecisions(i => i === item);
    return;
  }
  const style = getConfig().style;
  const isBridge = style === 'bridge';
  syncDecisionDarkClass(overlay);
  overlay.classList.toggle('bridge-module-decision-queue', isBridge);
  const themeClass = isBridge ? '' : ` ub-decision-theme-${style}`;
  overlay.innerHTML = `<div class="ub-decision-dialog${isBridge ? ' bridge-window bridge-module-decision-queue' : ''}${themeClass}" role="dialog" aria-modal="true" aria-labelledby="ubDecisionTitle" tabindex="-1">
    <div class="ub-decision-head"><div class="ub-decision-title" id="ubDecisionTitle"></div>${view.dismissible ? '<button type="button" class="ub-decision-close" data-decision-close aria-label="退出">✕</button>' : ''}</div>
    <div class="ub-decision-body"></div>
    <div class="ub-decision-error" role="alert" aria-live="polite"></div>
  </div>`;
  const title = overlay.querySelector('.ub-decision-title') as HTMLElement;
  const body = overlay.querySelector('.ub-decision-body') as HTMLElement;
  const errorEl = overlay.querySelector('.ub-decision-error') as HTMLElement;
  title.innerHTML = view.title;
  body.innerHTML = view.bodyHtml;
  _shownAt = Date.now();
  overlay.classList.add('show');
  overlay.classList.toggle('is-busy', systemDecisionQueue.resolving);

  const setError = (message: string): void => {
    _lastError = message || '';
    errorEl.textContent = _lastError;
    errorEl.classList.toggle('show', !!_lastError);
  };
  setError(_lastError);
  const submit = async (choice: unknown): Promise<SystemDecisionResult> => {
    if (Date.now() - _shownAt < 300) return { ok: false, error: '请稍候再选择' };
    if (systemDecisionQueue.resolving) return { ok: false, error: '正在处理，请稍候' };
    overlay.classList.add('is-busy');
    setError('');
    const buttons = Array.from(overlay.querySelectorAll('button')) as HTMLButtonElement[];
    buttons.forEach(button => { button.disabled = true; });
    const result = await systemDecisionQueue.submitActive(choice);
    if (!result.ok && !result.stale) {
      _lastError = result.error || '处理失败，请重试';
      renderQueueState();
    }
    return result;
  };
  view.bind?.({ body, submit, setError });
  overlay.querySelector<HTMLElement>('[data-decision-close]')?.addEventListener('click', () => {
    if (systemDecisionQueue.resolving) return;
    invalidateSystemDecisions(item => item === systemDecisionQueue.activeItem);
  });
  (overlay.querySelector('.ub-decision-dialog') as HTMLElement)?.focus({ preventScroll: true });
}

export function initSystemDecisionPopup(): void {
  if (_initialized) {
    ensureDecisionOverlay();
    renderQueueState();
    return;
  }
  _initialized = true;
  systemDecisionQueue.subscribe(renderQueueState);
  ensureDecisionOverlay();
  renderQueueState();
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && systemDecisionQueue.activeItem) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}
