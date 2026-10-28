// ===== 弹窗壳复用助手：已开着的弹窗刷新时只换数据容器，不重建壳/头 =====
// 设计要点：换「body 元素」而非「innerHTML」——旧 body 元素上的事件绑定（如 bindBatchSelect
// 的委托与选择态）随元素销毁自动失效，新 body 重建后由调用方重新绑定，无需清理旧闭包。

/** 检测 overlay 是否正开着指定弹窗（.panel-popup 带 data-popup="<key>" 标记）。 */
export function isPopupOpen(overlay: HTMLElement | null, popupKey: string): boolean {
  return !!overlay && overlay.classList.contains('show')
    && overlay.querySelector('.panel-popup')?.getAttribute('data-popup') === popupKey;
}

// ===== 列表→详情 跨渲染滚动记忆：详情返回/操作后整窗重开列表时不再回顶 =====
// 生命周期：列表跳详情前 remember；列表全量重开后 recall（取回即删）；
// overlay 关闭时 clear，避免残留记忆污染下一次全新打开。

const _popupScrollMem = new Map<string, number>();

/** 记录指定弹窗键当前 body 滚动位置（0 时清除记忆）。 */
export function rememberPopupScroll(overlay: HTMLElement | null, key: string): void {
  const st = overlay?.querySelector<HTMLElement>('.panel-popup-body')?.scrollTop ?? 0;
  if (st > 0) _popupScrollMem.set(key, st);
  else _popupScrollMem.delete(key);
}

/** 取回并清除指定弹窗键的滚动记忆，恢复到 overlay 当前 body 上。 */
export function recallPopupScroll(overlay: HTMLElement | null, key: string): void {
  const st = _popupScrollMem.get(key) ?? 0;
  _popupScrollMem.delete(key);
  if (st > 0 && overlay) {
    const fresh = overlay.querySelector<HTMLElement>('.panel-popup-body');
    if (fresh) fresh.scrollTop = Math.min(st, Math.max(0, fresh.scrollHeight - fresh.clientHeight));
  }
}

/** 清空全部滚动记忆（弹窗关闭时调用）。 */
export function clearPopupScrollMem(): void {
  _popupScrollMem.clear();
}

/** 只替换弹窗数据容器（保留壳/头），返回新容器或 null。preserveScroll 时 rAF 恢复滚动。 */
export function replacePopupBody(
  overlay: HTMLElement | null,
  bodyClass: string,
  html: string,
  opts?: { preserveScroll?: boolean },
): HTMLElement | null {
  if (!overlay) return null;
  const old = overlay.querySelector<HTMLElement>('.' + bodyClass);
  if (!old) return null;
  const top = opts?.preserveScroll ? old.scrollTop : 0;
  const fresh = document.createElement('div');
  fresh.className = bodyClass;
  fresh.innerHTML = html;
  old.replaceWith(fresh);
  if (opts?.preserveScroll && top > 0) {
    requestAnimationFrame(() => {
      fresh.scrollTop = Math.min(top, fresh.scrollHeight - fresh.clientHeight);
    });
  }
  return fresh;
}

// ===== 就地保位：整壳/整块重建（innerHTML 换血、容器元素被换新）前的滚动记忆 =====
// 实测口径（headless Chromium）：容器元素本身被换新 ⇒ 新元素 scrollTop/scrollLeft 归零；
// 容器保留、只换它的 innerHTML ⇒ 位置本来就在（内容变矮时由浏览器夹紧）。所以只有
// 「重建把滚动容器元素一起换掉」的路径需要显式记忆。用法：
//   const restore = captureScroll(overlay, '.x-list'); …重建…; restore();
/** 记下 scope 内 <selector> 当前的 scrollTop/scrollLeft，返回「重建后回填」的回调（没有则 no-op）。 */
export function captureScroll(scope: ParentNode | null, selector: string): () => void {
  const el = scope?.querySelector<HTMLElement>(selector) ?? null;
  const top = el ? el.scrollTop : 0;
  const left = el ? el.scrollLeft : 0;
  return () => {
    if (!top && !left) return;
    const target = scope?.querySelector<HTMLElement>(selector);
    if (!target) return;
    // 超出新内容高度的部分由浏览器夹紧（与重建前的手动滚动上限同一口径）
    if (top) target.scrollTop = top;
    if (left) target.scrollLeft = left;
  };
}
