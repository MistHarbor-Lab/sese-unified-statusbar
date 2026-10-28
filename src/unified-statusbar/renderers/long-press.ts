// renderers/long-press.ts
// U10：全项目唯一的长按绑定器。
//
// 此前「长按」在 8 个文件里各手搓一份 timer/flag（大调查 / 瑟瑟指导 / 批量选择 / 角色中枢 /
// 日历 / 商店 / 地图两处 / 技能三处），彼此在「短按走 pointerup 还是 click」「长按后合成 click
// 怎么吞」「计时器状态放模块级还是闭包」上互有差异，且 index.ts 用模块级单例 timer 同时服务
// 两个容器（#ac-content / .minimal-container）——一个容器按下、另一个容器抬起会互相踩。
//
// 两个入口，同一套三段式语义：
//   bindLongPress(target, opts)                 —— 元素直绑
//   bindLongPressDelegated(container, sel, opts) —— 容器事件委托，WeakMap 记每元素状态
// 三段式：
//   pointerdown  启动 LONG_PRESS_MS 计时 + setPointerCapture（防移动端手指漂移误触发 pointerleave，
//                小图标按钮热区小于指腹时尤为重要）
//   计时到时     onLong；此后浏览器补发的合成 click 被本模块吞掉
//   pointerup    < LONG_PRESS_MS 抬起 ⇒ onShort（未传 onShort 则交给元素/外层的 click 语义）
//   pointerleave / pointercancel 清理计时
//
// 长按弹出的弹窗必须调用 swallowGhostClickIfPointerActive()：手指仍按下时弹出的遮罩会接住松手
// 补发的合成 click（target 已不在按钮上，按钮自身的 click 吞噬无效），该函数在 document capture
// 阶段把这枚合成 click 一次性吞掉——与落点无关，故对「弹窗任意位置」都成立。
//
// 本模块只在绑定/调用时触碰 document（node 测试可注入假 document）。

/** 全项目唯一的长按判定时长。 */
export const LONG_PRESS_MS = 500;

export interface LongPressHandle { stop(): void; }

export interface LongPressOptions<E extends HTMLElement> {
  /** 短按（< LONG_PRESS_MS 抬起）。省略时短按交给元素自身 click / 外层委托处理。 */
  onShort?: (el: E, e: PointerEvent) => void;
  /** 长按触发。 */
  onLong: (el: E, e: PointerEvent) => void;
  /** 返回 false 则本次不进入长按计时（如 disabled / 生成中 / 已进入批量模式）。 */
  canStart?: (el: E) => boolean;
  /** 委托模式：未被长按吞掉的普通点击（选择器命中）回调。 */
  onClick?: (el: E, e: MouseEvent) => void;
}

// pointer 是否仍处于按下状态。pointerdown 置 true；document capture 级 pointerup/pointercancel
// 置 false（覆盖长按弹窗出现后 target 已不在按钮上的情况）。
let _pointerActive = false;
let _ptrTracked = false;

function ensurePointerTrack(): void {
  if (_ptrTracked) return;
  if (typeof document === 'undefined') return;
  _ptrTracked = true;
  const finish = (): void => { _pointerActive = false; };
  try {
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', finish, true);
  } catch (_e) { /* ignore */ }
}

/**
 * 若指针仍按下（即弹窗是在长按计时中弹出的），在 document capture 阶段一次性吞掉
 * 紧随的合成 click。带 2s 兜底移除，避免指针序列以 pointercancel 结束时不留下常驻监听。
 */
export function swallowGhostClickIfPointerActive(): void {
  if (!_pointerActive) return;
  if (typeof document === 'undefined') return;
  const swallow = (ev: Event): void => {
    ev.stopPropagation();
    ev.preventDefault();
    try { document.removeEventListener('click', swallow, true); } catch (_e) { /* ignore */ }
  };
  try { document.addEventListener('click', swallow, true); } catch (_e) { return; }
  setTimeout(() => {
    try { document.removeEventListener('click', swallow, true); } catch (_e) { /* ignore */ }
  }, 2000);
}

/** 元素直绑长按。返回句柄，`stop()` 解绑全部监听（AbortController 语义）。 */
export function bindLongPress<E extends HTMLElement>(target: E, opts: LongPressOptions<E>): LongPressHandle {
  ensurePointerTrack();
  const ac = new AbortController();
  const signal = ac.signal;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let longPressed = false;
  const clear = (): void => { if (timer) { clearTimeout(timer); timer = null; } };

  target.addEventListener('pointerdown', (e: PointerEvent) => {
    // 每次按下先清长按标记：上一次长按后若合成 click 落在弹窗上（没经过本元素），标记会残留，
    // 若不重置，下一次不满足 canStart 的普通短按会被误吞。
    longPressed = false;
    if (opts.canStart && !opts.canStart(target)) return;
    _pointerActive = true;
    clear();
    try { target.setPointerCapture(e.pointerId); } catch (_e) { /* 老环境无 pointer capture */ }
    timer = setTimeout(() => {
      timer = null;
      longPressed = true;
      opts.onLong(target, e);
    }, LONG_PRESS_MS);
  }, { signal });

  target.addEventListener('pointerup', (e: PointerEvent) => {
    if (!timer) return;
    clear();
    if (opts.onShort) { e.stopPropagation(); opts.onShort(target, e); }
  }, { signal });

  const cancel = (): void => { clear(); };
  target.addEventListener('pointerleave', cancel, { signal });
  target.addEventListener('pointercancel', cancel, { signal });

  target.addEventListener('click', (e: MouseEvent) => {
    if (longPressed) { e.preventDefault(); e.stopPropagation(); longPressed = false; }
  }, { signal });

  return { stop: (): void => { clear(); ac.abort(); } };
}

interface LpCell { timer: ReturnType<typeof setTimeout> | null; longPressed: boolean; }

/**
 * 容器级委托长按。计时器/longPressed 按命中元素存于 WeakMap，互不干扰：
 * 多个容器（$ac / $mc、多个弹窗）或多按钮（角色中枢一屏多张卡）同时挂载也各自独立，
 * 修掉旧代码「模块级单例 timer/flag」跨容器互踩的隐患。
 */
export function bindLongPressDelegated<E extends HTMLElement>(
  container: EventTarget, selector: string, opts: LongPressOptions<E>,
): LongPressHandle {
  ensurePointerTrack();
  const ac = new AbortController();
  const signal = ac.signal;
  const cells = new WeakMap<E, LpCell>();
  // 本次指针序列起始的命中元素（pointer capture 会把 pointerup 重定向到它；capture 失败时也靠它兜底）
  let activeEl: E | null = null;

  const cellOf = (el: E): LpCell => {
    let c = cells.get(el);
    if (!c) { c = { timer: null, longPressed: false }; cells.set(el, c); }
    return c;
  };
  const clearCell = (el: E | null): void => {
    if (!el) return;
    const c = cells.get(el);
    if (c?.timer) { clearTimeout(c.timer); c.timer = null; }
  };
  const match = (e: Event): E | null => {
    const t = e.target as unknown as { closest?: (s: string) => unknown } | null;
    if (!t || typeof t.closest !== 'function') return null;
    return (t.closest(selector) as E | null) ?? null;
  };

  container.addEventListener('pointerdown', (e: Event) => {
    const ev = e as PointerEvent;
    const el = match(ev);
    if (!el) return;
    const c = cellOf(el);
    // 同直接绑定：每次按下先清长按标记，避免上一次长按的吞点击标记残留误吞本次短按。
    c.longPressed = false;
    activeEl = el;
    if (opts.canStart && !opts.canStart(el)) return;
    _pointerActive = true;
    clearCell(el);
    try { el.setPointerCapture(ev.pointerId); } catch (_e) { /* 老环境无 pointer capture */ }
    c.timer = setTimeout(() => {
      c.timer = null;
      c.longPressed = true;
      opts.onLong(el, ev);
    }, LONG_PRESS_MS);
  }, { signal });

  container.addEventListener('pointerup', (e: Event) => {
    const down = activeEl;
    activeEl = null;
    if (!down) return;
    const c = cells.get(down);
    if (!c || !c.timer) return;
    clearTimeout(c.timer);
    c.timer = null;
    // 只有「抬起仍在起始元素上」才算短按：pointer capture 会把 pointerup 重定向到起始元素；
    // capture 失败（老环境）时若手指抬到别的行上，不得把 A 的按下当成 B 的点击。
    const up = match(e);
    if (up !== down) return;
    if (opts.onShort) { (e as PointerEvent).stopPropagation(); opts.onShort(down, e as PointerEvent); }
  }, { signal });

  container.addEventListener('pointercancel', () => {
    clearCell(activeEl);
    activeEl = null;
  }, { signal });

  container.addEventListener('pointerleave', () => { clearCell(activeEl); }, { signal });

  container.addEventListener('click', (e: Event) => {
    const el = match(e);
    if (!el) return;
    const c = cells.get(el);
    if (c && c.longPressed) {
      e.preventDefault();
      e.stopPropagation();
      c.longPressed = false;
      return;
    }
    if (opts.onClick) opts.onClick(el, e as MouseEvent);
  }, { signal });

  return { stop: (): void => { clearCell(activeEl); activeEl = null; ac.abort(); } };
}
