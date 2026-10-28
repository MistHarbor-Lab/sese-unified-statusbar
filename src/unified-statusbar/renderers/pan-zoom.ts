// ===== 共用「缩放 / 拖动」引擎（U6）=====
// 地图面板与技能树面板曾各写一套**逐字节同形**的实现（约 90 行 ×2），只有
// ① 缩放范围（地图 0.5–4 / 技能树 0.6–3）②「哪些元素不该触发拖动」两处不同。
// 这里收拢为一份，两个面板各自传参。以后改缩放手感只改这里一次，不会一边修好一边漏掉。
//
// 行为逐字保持：四个纯函数与原实现逐字节等价；绑定器的监听顺序、`{passive}`/`signal` 选项、
//   光标反馈（grab ↔ grabbing）都与原实现一致。
// document 级 mousemove/mouseup 不会随 DOM 替换回收，必须显式 abort（容器内监听随元素回收）。
//   本模块把 AbortController 收在闭包里，通过返回的 `stop()` 暴露，任意时刻最多存活一组监听。
//
// 放 renderers/ 而非 core/：它是 DOM 交互绑定器（core 保持纯逻辑）。纯函数部分若将来需要
// 无 DOM 复用，可再上提。

export interface PanZoomState {
  scale: number;
  x: number;
  y: number;
  minScale: number;
  maxScale: number;
  dragging: boolean;
  lastX: number;
  lastY: number;
  pinchDist: number;
  pinchScale: number;
}

export function createPanZoomState(minScale: number, maxScale: number): PanZoomState {
  return { scale: 1, x: 0, y: 0, minScale, maxScale, dragging: false, lastX: 0, lastY: 0, pinchDist: 0, pinchScale: 1 };
}

export function clampPanZoomScale(s: PanZoomState, ns: number): number {
  return Math.max(s.minScale, Math.min(s.maxScale, ns));
}

export function applyPanZoomTransform(el: HTMLElement, s: PanZoomState): void {
  el.style.transform = `translate(${s.x}px, ${s.y}px) scale(${s.scale})`;
}

/** 围绕 (originX, originY)（视口坐标，通常是鼠标位置或容器中心）缩放：调整 translate 使该点保持不动。 */
export function panZoomBy(
  s: PanZoomState, factor: number, originX: number, originY: number,
  viewport: HTMLElement, container: HTMLElement,
): void {
  const oldScale = s.scale;
  const newScale = clampPanZoomScale(s, oldScale * factor);
  if (newScale === oldScale) return;
  // 围绕鼠标/中心点缩放：调整 translate 使缩放点保持不动
  const rect = container.getBoundingClientRect();
  const cx = originX - rect.left;
  const cy = originY - rect.top;
  // 当前点在 viewport 原始坐标中的位置
  const vx = (cx - s.x) / oldScale;
  const vy = (cy - s.y) / oldScale;
  s.scale = newScale;
  s.x = cx - vx * newScale;
  s.y = cy - vy * newScale;
  applyPanZoomTransform(viewport, s);
}

export function resetPanZoom(s: PanZoomState, viewport: HTMLElement): void {
  s.scale = 1; s.x = 0; s.y = 0;
  applyPanZoomTransform(viewport, s);
}

export interface PanZoomOptions {
  minScale: number;
  maxScale: number;
  /** 命中这些元素时不进入拖动（节点/按钮自身要能点）。可传选择器列表，等价于逐条 closest 判断。 */
  ignoreSelector: string;
}

export interface PanZoomBinding {
  state: PanZoomState;
  /** 停用本组监听（关闭弹窗 / 绑定下一组前调用）。幂等。 */
  stop: () => void;
}

/** 绑定滚轮缩放 + 鼠标拖动 + 单指拖动 + 双指捏合。调用方负责在绑定前停掉上一组。 */
export function bindPanZoom(container: HTMLElement, viewport: HTMLElement, opts: PanZoomOptions): PanZoomBinding {
  const ac = new AbortController();
  const s = createPanZoomState(opts.minScale, opts.maxScale);

  // 滚轮缩放
  container.addEventListener('wheel', function (e: WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    panZoomBy(s, factor, e.clientX, e.clientY, viewport, container);
  }, { passive: false, signal: ac.signal });

  // 鼠标拖动
  container.addEventListener('mousedown', function (e: MouseEvent) {
    if ((e.target as HTMLElement).closest(opts.ignoreSelector)) return;
    s.dragging = true;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    container.style.cursor = 'grabbing';
  }, { signal: ac.signal });
  document.addEventListener('mousemove', function (e: MouseEvent) {
    if (!s.dragging) return;
    s.x += e.clientX - s.lastX;
    s.y += e.clientY - s.lastY;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    applyPanZoomTransform(viewport, s);
  }, { signal: ac.signal });
  document.addEventListener('mouseup', function () {
    if (s.dragging) { s.dragging = false; container.style.cursor = 'grab'; }
  }, { signal: ac.signal });

  // 触摸：单指拖动 + 双指捏合缩放
  container.addEventListener('touchstart', function (e: TouchEvent) {
    if (e.touches.length === 1) {
      s.dragging = true;
      s.lastX = e.touches[0].clientX;
      s.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      s.dragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      s.pinchDist = Math.hypot(dx, dy);
      s.pinchScale = s.scale;
    }
  }, { passive: true, signal: ac.signal });
  container.addEventListener('touchmove', function (e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 1 && s.dragging) {
      s.x += e.touches[0].clientX - s.lastX;
      s.y += e.touches[0].clientY - s.lastY;
      s.lastX = e.touches[0].clientX;
      s.lastY = e.touches[0].clientY;
      applyPanZoomTransform(viewport, s);
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (s.pinchDist > 0) {
        const factor = dist / s.pinchDist;
        const newScale = clampPanZoomScale(s, s.pinchScale * factor);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = container.getBoundingClientRect();
        const vx = (cx - rect.left - s.x) / s.scale;
        const vy = (cy - rect.top - s.y) / s.scale;
        s.scale = newScale;
        s.x = (cx - rect.left) - vx * newScale;
        s.y = (cy - rect.top) - vy * newScale;
        applyPanZoomTransform(viewport, s);
      }
    }
  }, { passive: false, signal: ac.signal });
  container.addEventListener('touchend', function (e: TouchEvent) {
    if (e.touches.length === 0) { s.dragging = false; s.pinchDist = 0; }
  }, { passive: true, signal: ac.signal });

  container.style.cursor = 'grab';
  return {
    state: s,
    stop: () => { try { ac.abort(); } catch (_e) { /* ignore */ } },
  };
}
