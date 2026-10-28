// ===== 长按批量选择（备忘录/物品/仓库通用） =====
// U10：长按判定统一走 renderers/long-press 的 bindLongPressDelegated（三段式：pointerdown 启动
// 500ms 计时 → 到时进入批量模式并选中该项；pointerup<500ms → 短按）。
// 批量模式外的短按走 onShort（onRowTap 原有详情）；批量模式内切换选中走 onClick。
// 全部事件委托到容器，进入批量模式才渲染操作栏——普通浏览零额外开销。

import { showConfirmDialog } from './confirm-dialog';
import { getToastr } from '../core/env';
import { bindLongPressDelegated } from './long-press';

export interface BatchSelectOptions {
  rowSelector: string;
  getRowId(el: HTMLElement): number;
  onRefresh(): void;
  /** 返回操作栏按钮 HTML，按钮需带 data-batch-action="<action>"。 */
  buildActions(ctx: { count: number }): string;
  runAction(action: string, ids: number[]): Promise<{ ok: boolean; message: string }>;
  /** 确认文案；返回 null 表示不弹确认直接执行。 */
  confirmText(ids: number[]): string | null;
  /** 可选：短按行回调（批量模式外，进入详情等原有默认行为）。 */
  onRowTap?(el: HTMLElement): void;
}

export function bindBatchSelect(container: HTMLElement, opts: BatchSelectOptions): () => void {
  let active = false;
  let selected = new Set<number>();

  const rows = (): HTMLElement[] => Array.from(container.querySelectorAll<HTMLElement>(opts.rowSelector));

  const renderCheckboxes = (): void => {
    for (const el of rows()) {
      let check = el.querySelector<HTMLElement>('.ub-batch-check');
      if (!check) {
        check = document.createElement('span');
        check.className = 'ub-batch-check';
        el.insertBefore(check, el.firstChild);
      }
      check.textContent = selected.has(opts.getRowId(el)) ? '✓' : '';
      el.classList.toggle('ub-batch-item', true);
      el.classList.toggle('selected', selected.has(opts.getRowId(el)));
    }
  };

  const renderBar = (): void => {
    let bar = container.querySelector<HTMLElement>('.ub-batch-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'ub-batch-bar';
      container.appendChild(bar);
    }
    bar.innerHTML = '<span class="ub-batch-count">已选 ' + selected.size + '</span>'
      + '<button class="ub-batch-action" data-batch-all>全选</button>'
      + '<button class="ub-batch-action" data-batch-clear>取消全选</button>'
      + opts.buildActions({ count: selected.size })
      + '<button class="ub-batch-action" data-batch-exit>退出</button>';
  };

  const enter = (el: HTMLElement): void => {
    if (active) return;
    active = true;
    container.classList.add('ub-batch-mode');
    selected = new Set<number>([opts.getRowId(el)]);
    renderCheckboxes();
    renderBar();
  };

  const exit = (): void => {
    active = false;
    selected = new Set<number>();
    container.classList.remove('ub-batch-mode');
    for (const el of rows()) {
      el.querySelector('.ub-batch-check')?.remove();
      el.classList.remove('ub-batch-item', 'selected');
    }
    container.querySelector('.ub-batch-bar')?.remove();
  };

  const toggle = (el: HTMLElement): void => {
    const id = opts.getRowId(el);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    renderCheckboxes();
    renderBar();
  };

  // 长按（进入批量模式并选中该行）与短按（批量模式外走 onRowTap）统一交给 long-press 模块：
  // 批量模式内 pointerdown 不再启动计时（canStart=false），点击切换选中走 onClick——
  // 与旧实现「pointerup 只吞事件、切换交给 click」等价，且长按后的合成 click 由模块统一吞掉。
  bindLongPressDelegated(container, opts.rowSelector, {
    canStart: () => !active,
    onShort: (el) => { if (opts.onRowTap) opts.onRowTap(el); },
    onLong: (el) => enter(el),
    onClick: (el, e) => { if (active) { e.preventDefault(); e.stopPropagation(); toggle(el); } },
  });

  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const barBtn = target.closest<HTMLElement>('.ub-batch-bar .ub-batch-action');
    if (barBtn) {
      e.preventDefault();
      e.stopPropagation();
      const action = barBtn.dataset.batchAll !== undefined ? 'all'
        : barBtn.dataset.batchClear !== undefined ? 'clear'
        : barBtn.dataset.batchExit !== undefined ? 'exit'
        : barBtn.dataset.batchAction || '';
      if (action === 'all') {
        selected = new Set(rows().map(el => opts.getRowId(el)));
        renderCheckboxes(); renderBar();
      } else if (action === 'clear') {
        selected = new Set<number>();
        renderCheckboxes(); renderBar();
      } else if (action === 'exit') {
        exit();
      } else if (action) {
        void runAction(action);
      }
    }
  });

  async function runAction(action: string): Promise<void> {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const text = opts.confirmText(ids);
    if (text != null && !await showConfirmDialog({ message: text, danger: true })) return;
    const result = await opts.runAction(action, ids);
    if (result.ok) {
      if (result.message) getToastr()?.success(result.message);
      opts.onRefresh();
    } else if (result.message) {
      getToastr()?.error(result.message);
    }
  }

  return exit;
}
