// ===== 点击特效模块 =====
import { type StyleType, drifts, isFollowBottomActive } from '../core/constants';

// 特效文本按风格分类
const heartsByStyle: Record<StyleType, string[]> = {
  ancient: ['❀', '✿', '❁', '⚘', '✧', '~', '❋', '❊'],
  flirtatious: ['♥', '♡', '❤', '💕', '💖', '✧', '~', '♡'],
  minimal: ['♥', '♡', '❤', '✧', '~'],
  sweet: ['💕', '💖', '💗', '💘', '💝', '🩷', '🎀', '🌸', '✨', '💫', '🧸', '🍰'],
  xianxia: ['✨', '💫', '⚘', '❋', '☯', '◈', '✦', '❊', '🌊', '⛰', '🌸', '🍃'],
  bridge: ['⌖'],
  ios: ['✨', '💫', '⭐️', '🫧', '♥', '♡', '✧', '◌'],
};

const textsByStyle: Record<StyleType, string[]> = {
  ancient: [
    '嗯~', '啊❀', '嘻嘻~', '好热...', '别...', '嗯❀', '不要~', '好舒服~',
    '呀...❀', '湿了...', '好深~', '哈❀', '受不了...', '快点...', '好棒~❀',
    '要坏了~', '嗯啊~❀',
  ],
  flirtatious: [
    '嗯~', '啊♥', '哈哈~', '好热...', '别...', '嗯♥', '不要~', '好舒服~',
    '呀...♥', '湿了...', '好深~', '哈♥', '受不了...', '快点...', '好棒~♥',
    '要坏了~', '嗯啊~♥',
  ],
  minimal: [
    '嗯~', '啊♥', '哈哈~', '好热...', '别...', '嗯♥', '不要~', '好舒服~',
    '呀...♥', '湿了...', '好深~', '哈♥', '受不了...', '快点...', '好棒~♥',
    '要坏了~', '嗯啊~♥',
  ],
  sweet: [
    '嗯~💕', '啊💗', '嘻嘻~💖', '好热...🔥', '别...🥺', '嗯💘', '不要~🩷', '好舒服~✨',
    '呀...💝', '湿了...💦', '好深~💫', '哈💕', '受不了...😳', '快点...💓', '好棒~🎀',
    '要坏了~💔', '嗯啊~🌸', '前辈...💌', '好害羞...🧸',
  ],
  xianxia: [
    '嗯~✨', '啊💫', '道心...', '好热...', '别...☯', '嗯⚘', '不要~', '好舒服~',
    '呀...✨', '湿了...', '灵力...', '哈💫', '受不了...', '快点...', '好棒~⚘',
    '要坏了~', '嗯啊~✨', '仙长...💫', '饶了我吧...',
  ],
  bridge: ['SIGNAL ACQUIRED'],
  ios: [
    '嗯~', '啊♥', '嘻嘻~', '好热...', '别...', '嗯♥', '不要~', '好舒服~',
    '呀...', '湿了...', '好深~', '哈~', '受不了...', '快点...', '好棒~',
    '要坏了~', '嗯啊~',
  ],
};


function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function spawnBridgeReticle(x: number, y: number): void {
  const reticle = document.createElement('div');
  reticle.className = 'bridge-reticle';
  reticle.setAttribute('aria-hidden', 'true');
  reticle.style.left = x + 'px';
  reticle.style.top = y + 'px';
  document.body.appendChild(reticle);
  setTimeout(() => reticle.remove(), 520);
}

export function spawnClickHeart(x: number, y: number, style: StyleType): void {
  if (isFollowBottomActive()) return;
  if (style === 'bridge') {
    spawnBridgeReticle(x, y);
    return;
  }
  const hearts = heartsByStyle[style] || heartsByStyle.ancient;
  const el = document.createElement('div');
  el.className = 'click-heart';
  el.textContent = randomItem(hearts);
  el.style.left = (x + (Math.random() * 20 - 10)) + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

export function spawnClickText(
  x: number,
  y: number,
  style: StyleType,
  pool?: string[],
): void {
  if (isFollowBottomActive()) return;
  if (style === 'bridge') return;
  const arr = pool || textsByStyle[style] || textsByStyle.ancient;
  const el = document.createElement('div');
  el.className = 'click-text';
  el.textContent = randomItem(arr);
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.setProperty('--drift-x', randomItem(drifts) + 'px');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

export function spawnEroticBurst(x: number, y: number, style: StyleType): void {
  if (isFollowBottomActive()) return;
  if (style === 'bridge') {
    spawnBridgeReticle(x, y);
    return;
  }
  for (let i = 0; i < 2; i++) {
    setTimeout(() => {
      spawnClickText(x + Math.random() * 40 - 20, y + Math.random() * 20 - 10, style);
    }, i * 200);
  }
}

export function spawnTabRipple(tab: HTMLElement, style: StyleType): void {
  if (isFollowBottomActive()) return;
  if (style === 'bridge') {
    const rect = tab.getBoundingClientRect();
    spawnBridgeReticle(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return;
  }
  const rip = document.createElement('div');
  rip.className = 'tab-ripple';
  tab.style.position = 'relative';
  tab.appendChild(rip);
  setTimeout(() => rip.remove(), 600);
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      spawnClickHeart(
        tab.getBoundingClientRect().left + tab.offsetWidth * (i / 2),
        tab.getBoundingClientRect().top,
        style,
      );
    }, i * 100);
  }
  if (Math.random() > 0.3) {
    spawnClickText(tab.getBoundingClientRect().right - 20, tab.getBoundingClientRect().top, style);
  }
}

export function spawnInkSparks(x: number, y: number, count: number): void {
  if (isFollowBottomActive()) return;
  for (let s = 0; s < count; s++) {
    const spark = document.createElement('div');
    spark.className = 'ink-spark';
    spark.style.left = (x + Math.random() * 30 - 15) + 'px';
    spark.style.top = (y + Math.random() * 10 - 5) + 'px';
    spark.style.setProperty('--sx', (Math.random() * 50 - 25) + 'px');
    spark.style.setProperty('--sy', (Math.random() * 40 - 30) + 'px');
    document.body.appendChild(spark);
    setTimeout(() => spark.remove(), 500);
  }
}

export function spawnDrips(x: number, y: number, count: number): void {
  if (isFollowBottomActive()) return;
  for (let d = 0; d < count; d++) {
    setTimeout(() => {
      const drop = document.createElement('div');
      drop.className = 'drip';
      drop.style.left = (x + (Math.random() * 10 - 5)) + 'px';
      drop.style.top = (y + 5) + 'px';
      document.body.appendChild(drop);
      setTimeout(() => drop.remove(), 1500);
    }, d * 180);
  }
}

// 创建鼠标光晕元素（仅桌面端启用）
export function createMouseGlow(): HTMLElement {
  const glow = document.createElement('div');
  glow.className = 'mouse-glow';
  document.body.appendChild(glow);
  return glow;
}

// 缓存 book 容器的 rect，避免 mousemove 高频触发 getBoundingClientRect
let _bookRectCache: DOMRect | null = null;
let _bookRectTimer: ReturnType<typeof setTimeout> | null = null;

function getCachedBookRect(): DOMRect | null {
  if (_bookRectCache) return _bookRectCache;
  const book = document.querySelector('.book, .minimal-container');
  if (!book) return null;
  _bookRectCache = book.getBoundingClientRect();
  // 2秒后自动失效，避免缓存过期
  if (_bookRectTimer) clearTimeout(_bookRectTimer);
  _bookRectTimer = setTimeout(() => { _bookRectCache = null; _bookRectTimer = null; }, 2000);
  return _bookRectCache;
}

// 节流：限制 mousemove 回调频率，减少 DOM 操作
let _glowRafPending = false;
export function updateMouseGlow(glow: HTMLElement, e: JQuery.MouseMoveEvent): void {
  // 跟随底部模式：不追踪鼠标、隐藏光晕，省去高频 mousemove 的 DOM 写入
  if (isFollowBottomActive()) {
    if (glow.classList.contains('active')) glow.classList.remove('active');
    return;
  }
  if (_glowRafPending) return;
  _glowRafPending = true;
  requestAnimationFrame(() => {
    _glowRafPending = false;
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
    const r = getCachedBookRect();
    if (r) {
      const isInside = e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom;
      glow.classList.toggle('active', isInside);
    }
  });
}

// ===== 原位 inline 提示（替代 toast，不打扰）=====
// 在触发元素上短暂闪现一条提示：按钮/一般元素临时把文本改成 message + 红框高亮；
// input/textarea 只闪红框（不改值）。内联样式 + !important 临时压过主题样式，duration 后清回原值。
// 无 CSS 依赖、无轮询；未触发时零开销。用于「未选中/未找到/空内容」类不打扰的操作提示。
export function flashInlineHint(el: HTMLElement | null | undefined, message?: string, duration = 1400): void {
  if (!el) return;
  const tag = el.tagName.toLowerCase();
  const isInputLike = tag === 'input' || tag === 'textarea';
  const prevBorder = el.style.getPropertyValue('border-color');
  const prevBoxShadow = el.style.getPropertyValue('box-shadow');
  let prevText: string | null = null;
  el.style.setProperty('border-color', '#ff7b7b', 'important');
  el.style.setProperty('box-shadow', '0 0 0 2px rgba(255,123,123,.32)', 'important');
  if (message && !isInputLike) { prevText = el.textContent; el.textContent = message; }
  window.setTimeout(() => {
    if (prevBorder) el.style.setProperty('border-color', prevBorder, 'important');
    else el.style.removeProperty('border-color');
    if (prevBoxShadow) el.style.setProperty('box-shadow', prevBoxShadow, 'important');
    else el.style.removeProperty('box-shadow');
    if (prevText !== null) el.textContent = prevText;
  }, duration);
}
