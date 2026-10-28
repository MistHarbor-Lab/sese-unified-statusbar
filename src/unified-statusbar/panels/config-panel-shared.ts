// panels/config-panel-shared.ts
// 设置面板跨 tab 共用的纯工具（无模块级状态、无宿主依赖）。
// 从 config-panel.ts 下沉（S3-2/S3-4），供壳与各 tab 模块共同引用。

// U2：转义统一出口（实体集与原实现一致）
import { escapeAttr } from '../core/html-escape';

/** 跨风格 CSS 变量级联：确保 select/input 在各风格下都有颜色 */
export function sv(): { bg: string; text: string; border: string } {
  // 链式 fallback：先查通用 --card，没有则查 sweet/xianxia 专用变量
  return {
    bg: 'var(--card,var(--sweet-card,var(--jade-surface-1,#fff)))',
    text: 'var(--text,var(--sweet-text,#111))',
    border: 'var(--divider,var(--sweet-border,var(--divider,#ccc)))',
  };
}

/** 转义字符串以安全地用于 HTML 属性值 */
export function escAttr(s: string): string {
  return escapeAttr(s);
}
/**
 * 绑定「模型」组合框：可手输的文本框 + ▼ 下拉按钮弹出已加载模型浮层。
 *
 * 取代旧 fillModelSelect（原生 <select> 必须先加载才能选）。
 * - 文本框始终可自由手输，不加载也能填、能保存；
 * - ▼ 点击在该行下方弹出/关闭浮层，浮层每次打开从 loaded.current 实时渲染；
 *   未加载时显示「请先点加载模型」空态；
 * - 浮层用自定义绝对定位 div（非原生 datalist / select），移动端正常弹出，
 *   避开 datalist 渲染成输入法建议条的问题；
 * - 点浮层外 / Escape 关闭；点 item 填入文本框并关闭。
 *
 * @returns setLoaded(models) 加载后写入列表（若浮层开着则重渲染）；
 *          reset() 清空列表 + 关浮层（切换/删除预设时调用）。
 */
export function bindModelCombobox(opts: {
  inputId: string;
  toggleBtnId: string;
  popoverId: string;
  loaded: { current: string[] };
}): { setLoaded(models: string[]): void; reset(): void } {
  const inputEl = document.getElementById(opts.inputId) as HTMLInputElement | null;
  const toggleEl = document.getElementById(opts.toggleBtnId) as HTMLButtonElement | null;
  const popoverEl = document.getElementById(opts.popoverId) as HTMLDivElement | null;
  const noop = { setLoaded(_models: string[]): void { /* 元素缺失：空操作 */ }, reset(): void { /* 元素缺失：空操作 */ } };
  if (!inputEl || !toggleEl || !popoverEl) return noop;
  // 绑定到 narrowed 的非空引用：TS 不在闭包里保留 const 的 null 收窄，
  // 故先 guard 再赋给新 const，闭包内才不会退回 possibly-null。
  const input = inputEl;
  const toggleBtn = toggleEl;
  const popover = popoverEl;

  let isOpen = false;
  let onDocClick: ((e: MouseEvent) => void) | null = null;
  let onDocKey: ((e: KeyboardEvent) => void) | null = null;

  function renderItems(): void {
    const models = opts.loaded.current;
    popover.innerHTML = '';
    if (!models.length) {
      const empty = document.createElement('div');
      empty.className = 'ub-model-popover-empty';
      empty.textContent = '请先点「加载模型」获取列表';
      popover.appendChild(empty);
      return;
    }
    for (const m of models) {
      const item = document.createElement('div');
      item.className = 'ub-model-popover-item';
      item.setAttribute('data-model', m);
      item.textContent = m;
      popover.appendChild(item);
    }
  }

  function close(): void {
    if (!isOpen) return;
    isOpen = false;
    popover.classList.remove('is-open');
    if (onDocClick) { document.removeEventListener('click', onDocClick, true); onDocClick = null; }
    if (onDocKey) { document.removeEventListener('keydown', onDocKey, true); onDocKey = null; }
  }

  function openPopover(): void {
    if (isOpen) return;
    isOpen = true;
    renderItems();
    popover.classList.add('is-open');
    onDocClick = (e: MouseEvent): void => {
      const target = e.target as Node | null;
      if (target && !popover.contains(target) && !toggleBtn.contains(target)) close();
    };
    onDocKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    // 捕获阶段挂监听：当前 ▼ 点击的冒泡不会触达（挂时已在冒泡中），
    // 后续任意点击先于目标处理，配合 contains 判定关闭浮层。
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onDocKey, true);
  }

  toggleBtn.addEventListener('click', function () {
    if (isOpen) close(); else openPopover();
  });

  // 浮层点选（事件委托）：点 item 填入文本框并关闭
  popover.addEventListener('click', function (e) {
    const t = e.target as HTMLElement | null;
    const item = t ? (t.closest('.ub-model-popover-item') as HTMLElement | null) : null;
    if (!item) return;
    input.value = item.getAttribute('data-model') || '';
    input.dispatchEvent(new Event('input'));
    close();
  });

  return {
    setLoaded(models: string[]): void {
      opts.loaded.current = models.slice();
      if (isOpen) renderItems();
    },
    reset(): void {
      opts.loaded.current = [];
      close();
    },
  };
}
