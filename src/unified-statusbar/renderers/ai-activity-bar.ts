// ===== 主界面常驻 AI 提示条（7 主题共用） =====
// 空壳随主题 HTML 一起产出（稳定 DOM，不进入 composeRenderSignature）；
// 活动变化时只改 bar/list 内部文本与 hidden，不触发整页重建。
// 只显示当前聊天的活动；跨聊天请求由各自守卫收口，不在此展示。
import { escapeHtml, escapeAttr } from '../core/html-escape';
import {
  cancelAiActivity, cancelAllAiActivities, listCurrentChatAiActivities,
  subscribeAiActivities, type AiActivityEntry,
} from '../core/ai-activity';
import { aiPhaseText } from '../core/ai-text-features';

const BAR_SELECTOR = '[data-ub-ai-bar]';
const LIST_SELECTOR = '[data-ub-ai-list]';

/** 稳定空壳：bar + list 两个平级节点。插入主题根容器的首个子节点位置。 */
export function aiActivityBarHtml(): string {
  return '<div class="ub-ai-bar" data-ub-ai-bar hidden>'
    + '<span class="ub-ai-dot"></span>'
    + '<span class="ub-ai-title">AI 请求进行中</span>'
    + '<span class="ub-ai-req" data-ub-ai-req></span>'
    + '<span class="ub-ai-count" data-ub-ai-count hidden></span>'
    + '<span class="ub-ai-actions">'
    + '<button class="ub-ai-manage" type="button" data-ub-ai-manage hidden>管理</button>'
    + '<button class="ub-ai-stop" type="button" data-ub-ai-stop>终止</button>'
    + '</span>'
    + '</div>'
    + '<div class="ub-ai-list" data-ub-ai-list hidden></div>';
}

let _inited = false;
let _listOpen = false;
/** 每个提示条实例各自记签名：主题切换时 ac-content 壳与萦绕静态壳可能同时在 DOM 里，
 *  共用一份签名会让第二个壳被误判「未变化」而停在旧内容。 */
const _lastSigByBar = new WeakMap<Element, string>();

function _listOfBar(bar: Element): HTMLElement | null {
  let node = bar.nextElementSibling;
  if (node && node.matches(LIST_SELECTOR)) return node as HTMLElement;
  // 兜底：同容器内唯一 list（主题重建后顺序被移动的极端情况）
  const root = bar.parentElement;
  return root ? (root.querySelector(LIST_SELECTOR) as HTMLElement | null) : null;
}

function _renderBar(bar: HTMLElement, list: HTMLElement | null, entries: AiActivityEntry[]): void {
  const single = entries.length === 1;
  const first = entries[0];
  const phase = aiPhaseText({ phase: first.phase, attempt: first.attempt, maxAttempts: first.maxAttempts });
  const reqHtml = single
    ? '<b>' + escapeHtml(first.label) + '</b><span class="ub-ai-sub">' + escapeHtml(phase) + '</span>'
    : '<b>' + escapeHtml(first.label) + '</b><span class="ub-ai-sub">等 ' + entries.length + ' 项</span>';
  const countText = single ? '' : entries.length + ' 项';
  const manageText = _listOpen ? '收起' : '管理';
  const stopText = single ? '终止' : '全部终止';
  const listVisible = !single && _listOpen;
  const rowsHtml = listVisible
    ? entries.map((e) => {
      const done = e.phase === 'terminating';
      const sub = done ? '已终止，正在收尾' : aiPhaseText({ phase: e.phase, attempt: e.attempt, maxAttempts: e.maxAttempts });
      return '<div class="ub-ai-row' + (done ? ' done' : '') + '">'
        + '<span class="r-dot"></span>'
        + '<b>' + escapeHtml(e.label) + '</b>'
        + '<span class="r-sub">' + escapeHtml(sub) + '</span>'
        + (done ? '' : '<button class="stop" type="button" data-ub-ai-cancel="' + escapeAttr(e.id) + '">终止</button>')
        + '</div>';
    }).join('')
    : '';

  const sig = reqHtml + '|' + countText + '|' + manageText + '|' + stopText + '|' + (listVisible ? '1' : '0') + '|' + rowsHtml;
  if (_lastSigByBar.get(bar) === sig) return;
  _lastSigByBar.set(bar, sig);

  const req = bar.querySelector('[data-ub-ai-req]') as HTMLElement | null;
  if (req) req.innerHTML = reqHtml;
  const count = bar.querySelector('[data-ub-ai-count]') as HTMLElement | null;
  if (count) {
    count.textContent = countText;
    count.hidden = single;
  }
  const manage = bar.querySelector('[data-ub-ai-manage]') as HTMLButtonElement | null;
  if (manage) {
    manage.textContent = manageText;
    manage.hidden = single;
  }
  const stop = bar.querySelector('[data-ub-ai-stop]') as HTMLButtonElement | null;
  if (stop) stop.textContent = stopText;
  if (list) {
    list.innerHTML = rowsHtml;
    list.hidden = !listVisible;
  }
}

/** 按当前聊天活动刷新提示条；无条目隐藏。内容签名不变则不写 DOM。 */
export function syncAiActivityBar(root?: ParentNode): void {
  const scope = root || (typeof document !== 'undefined' ? document : null);
  if (!scope) return;
  const bars = Array.prototype.slice.call(scope.querySelectorAll(BAR_SELECTOR)) as HTMLElement[];
  if (bars.length === 0) return;
  const entries = listCurrentChatAiActivities();
  if (entries.length === 0) {
    _listOpen = false;
    bars.forEach((bar) => {
      _lastSigByBar.delete(bar);
      bar.hidden = true;
      const list = _listOfBar(bar);
      if (list) { list.hidden = true; list.innerHTML = ''; }
    });
    return;
  }
  if (entries.length <= 1) _listOpen = false;
  bars.forEach((bar) => {
    bar.hidden = false;
    _renderBar(bar, _listOfBar(bar), entries);
  });
}

/** 绑定一次点击委托（幂等）。提示条是稳定壳，事件只需一次 document 级委托。 */
export function initAiActivityBar(): void {
  if (_inited) return;
  _inited = true;
  subscribeAiActivities(() => syncAiActivityBar());
  if (typeof document === 'undefined') return;
  document.addEventListener('click', (ev: Event) => {
    const target = ev.target as HTMLElement | null;
    if (!target || !target.closest) return;
    const barHost = target.closest(BAR_SELECTOR) as HTMLElement | null;
    const listHost = target.closest(LIST_SELECTOR) as HTMLElement | null;
    if (!barHost && !listHost) return;
    const cancelBtn = target.closest('[data-ub-ai-cancel]') as HTMLElement | null;
    if (cancelBtn) {
      ev.preventDefault();
      ev.stopPropagation();
      const id = cancelBtn.getAttribute('data-ub-ai-cancel') || '';
      if (id) cancelAiActivity(id);
      return;
    }
    if (target.closest('[data-ub-ai-manage]')) {
      ev.preventDefault();
      ev.stopPropagation();
      _listOpen = !_listOpen;
      syncAiActivityBar();
      return;
    }
    if (target.closest('[data-ub-ai-stop]')) {
      ev.preventDefault();
      ev.stopPropagation();
      const entries = listCurrentChatAiActivities();
      if (entries.length <= 1) {
        if (entries[0]) cancelAiActivity(entries[0].id);
      } else {
        cancelAllAiActivities(e => e.cancelable && e.phase !== 'terminating');
      }
    }
  });
}
