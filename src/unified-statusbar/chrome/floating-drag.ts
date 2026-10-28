import { parseJsonWith } from '../core/safe-json';
// ===== 悬浮按钮拖拽（与 UBS_phone renderers/phone-ui.ts 的 bindDrag 同一实现形式）=====
// 齿轮（#ac-persistent-settings）与固定模式折叠按钮（#ac-fixed-toggle）共用。
// 纪律沿用小手机：pointer events 元素级 + setPointerCapture 单轨（鼠标/触摸/笔统一），
// 「移动中 / 落盘 / 恢复」三个写入点全部过 clampToViewport——出界坐标活不过一个拖拽回合，
// 窗口缩小、缩放变化、跨设备存档都在下一次恢复时自愈（小手机自出生起零「拖出屏外」反馈的根因）。
// 拖后的残留 click 用时间戳吞（dragJustEnded），不用一次性捕获监听——后者在拖后不产生 click 时
// 会把紧随其后的第一次正常点击一起吞掉（小手机踩过同款坑后收敛到时间戳法）。

/** 拖拽/手势中断刚结束（默认 600ms 内）的残留 click 识别：调用方在 click 顶部吞掉，防拖完误触。 */
let _lastDragEndAt = 0;
export function dragJustEnded(ms = 600): boolean {
  return Date.now() - _lastDragEndAt < ms;
}

/** 视口钳制：把 left/top 限制在「元素完整落在视口内」的范围内。 */
export function clampToViewport(left: number, top: number, width: number, height: number): { left: number; top: number } {
  const maxLeft = Math.max(0, window.innerWidth - width);
  const maxTop = Math.max(0, window.innerHeight - height);
  return { left: Math.min(Math.max(0, left), maxLeft), top: Math.min(Math.max(0, top), maxTop) };
}

/** 读取拖拽存档（{x,y} 形态，与既有 statusbar-*-pos 键逐字节兼容）；缺失/损坏返回 null。 */
export function readSavedPos(key: string): { x: number; y: number } | null {
  // U33：收编 parseJsonWith（{x,y} 校验保留在调用方）
  const pos = parseJsonWith<{ x?: unknown; y?: unknown } | null>(localStorage.getItem(key) ?? '', null);
  if (pos === null || typeof pos.x !== 'number' || typeof pos.y !== 'number') return null;
  return pos as { x: number; y: number };
}

/** 写入拖拽存档（四舍五入，杜绝小数坐标进 localStorage）。 */
export function writeSavedPos(key: string, x: number, y: number): void {
  try {
    localStorage.setItem(key, JSON.stringify({ x: Math.round(x), y: Math.round(y) }));
  } catch (_e) { /* ignore */ }
}

/** 按视口钳制后的坐标应用元素定位（left/top 模式，清 right/bottom）。 */
export function applyClampedPosition(el: HTMLElement, x: number, y: number, width: number, height: number): void {
  const p = clampToViewport(x, y, width, height);
  el.style.left = `${p.left}px`;
  el.style.top = `${p.top}px`;
  el.style.right = 'auto';
  el.style.bottom = 'auto';
}

export interface FloatingDragOpts {
  /** 拖拽开始（moved 判定前即触发；cursor 切换等外观反馈挂这里）。 */
  onDragStart?(): void;
  /** 拖拽结束（moved=本次是否有位移；cancel 中断时以 moved=false 触发）。 */
  onDragEnd?(moved: boolean): void;
}

/** 通用拖拽绑定（小手机 bindDrag 同款；宽高惰性取值以适配折叠按钮的模式换形 36/40/时间窗药丸）。 */
export function bindFloatingDrag(
  handle: HTMLElement,
  target: HTMLElement,
  posKey: string,
  width: () => number,
  height: () => number,
  opts?: FloatingDragOpts,
): void {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let baseLeft = 0;
  let baseTop = 0;
  let moved = false;
  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = target.getBoundingClientRect();
    baseLeft = rect.left;
    baseTop = rect.top;
    try { handle.setPointerCapture(e.pointerId); } catch (_err) { /* ignore */ }
    e.preventDefault();
    opts?.onDragStart?.();
  });
  handle.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    if (!moved) return;
    applyClampedPosition(target, baseLeft + dx, baseTop + dy, width(), height());
  });
  handle.addEventListener('pointerup', (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    opts?.onDragEnd?.(moved);
    if (moved) {
      // 落盘取钳制后的实际渲染矩形，杜绝出界坐标进 localStorage
      const rect = target.getBoundingClientRect();
      writeSavedPos(posKey, rect.left, rect.top);
      _lastDragEndAt = Date.now();
      e.stopPropagation();
      e.preventDefault();
    }
  });
  // 浏览器接管手势（滚动/文本选择/系统 callout）时中断的拖拽不是点击，同样吞掉残留 click
  handle.addEventListener('pointercancel', () => {
    if (!dragging) return;
    dragging = false;
    opts?.onDragEnd?.(false);
    _lastDragEndAt = Date.now();
  });
}
