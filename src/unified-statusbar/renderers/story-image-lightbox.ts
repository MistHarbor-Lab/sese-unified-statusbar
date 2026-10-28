// ===== 正文插图：全屏三槽滑动浏览（共用组件） =====
// 机制与视觉完全对齐立绘放大弹窗（portrait-panel.ts 的三槽轨道实现）：三槽轨道 [cur-1, cur, cur+1]、
// 指针拖拽跟手 1:1、到头 0.35 阻尼、边缘渐变翻页热区（仅悬停显示）、底部居中页码胶囊（首次翻页后显示）、
// ESC/点图/点空白退出、拖拽后吞合成 click。差异三处：
//   ① 透明底透出所在环境的遮罩（iframe 图库＝#panelOverlay 主题遮罩；宿主页＝.ub-story-host-zoom 自带遮罩）；
//   ② 右上角删除按钮（onDelete 提供时显示，确认交互由调用方实现）；
//   ③ 底部信息栏（onOpenGallery 或 onRegenerate 任一提供时显示：当前图描述 + 「进入图库」入口（仅正文图片放大传）
//      + 「重新生图」按钮（文案可用 regenLabel 覆写——子模块如 UBS_phone 传自己的皮肤词表）；
//   ④ 右上角「转入角色图库」按钮（onImport 提供时显示，与删除按钮同在 .sig-zoom-actions 操作组并排：复制当前图到所选角色立绘图库，图库/正文两处放大共用）。
// 独立 sig- 类名（CSS 在 styles/story-image-base.ts 常驻注入，不依赖随立绘开关注卸的立绘 lightbox 类）；
// doc 参数化：既挂 iframe document（图库），也挂宿主 parent.document（正文图片）。
import { ubIcon } from '../core/icons';
import { guardGhostClick } from './html-builder';
import type { StoryImageEntry } from '../core/story-image-gallery-store';

export interface StoryLightboxArgs {
  /** 目标文档（iframe 或宿主页）。 */
  doc: Document;
  /** 全屏根元素（已 append 到目标文档；类含 sig-lightbox）。 */
  root: HTMLElement;
  /** 浏览序列（删除成功时就地 splice，调用方传可变数组）。 */
  entries: StoryImageEntry[];
  /** 起始下标。 */
  startIndex: number;
  /** 删除回调（内部含确认弹窗）；返回 true = 已删除，组件就地移出序列。 */
  onDelete?: (entry: StoryImageEntry) => Promise<boolean>;
  /** 「进入图库」入口回调（提供时渲染底部信息栏：当前图描述 + 图库入口按钮）；图库放大不传。 */
  onOpenGallery?: () => void;
  /** 「重新生图」便捷入口（提供时在信息栏渲染按钮，位于进入图库右侧）：按生图档案重放当前图。
   *  返回更新后的条目（组件就地刷新当前图）；null = 未变更（失败/无档案，提示由回调负责）。 */
  onRegenerate?: (entry: StoryImageEntry) => Promise<StoryImageEntry | null>;
  /** 「重新生图」按钮文案（缺省「重新生图」；子模块传自己的词表，如小手机「换一张」）。 */
  regenLabel?: string;
  /** 「转入角色图库」入口（提供时渲染右上按钮，与删除并排）：复制一份当前图到所选角色立绘图库，不关闭放大。 */
  onImport?: (entry: StoryImageEntry) => void;
  /** 统一收口（图库＝回图库；宿主页＝移除根元素）。 */
  onDone: () => void;
}

/** 挂载三槽滑动浏览（立绘 lightbox 同款交互）。 */
export function mountStoryLightbox(args: StoryLightboxArgs): void {
  const { doc, root, entries, onDelete, onOpenGallery, onRegenerate, onImport } = args;
  if (!entries.length) return;

  // DOM：三槽轨道 + 页码 + 删除按钮（nav 热区每槽都建，仅中间槽可见——与立绘同约定）
  // 底部信息栏：onOpenGallery（正文图片进入图库）或 onRegenerate（子模块重绘）任一提供即渲染。
  const hasInfo = Boolean(onOpenGallery || onRegenerate);
  const regenLabel = args.regenLabel || '重新生图';
  const html = '<div class="sig-track">'
    + Array.from({ length: 3 }, () =>
      '<div class="sig-slide"><div class="sig-frame"><img alt="正文插图" draggable="false">'
      + '<span class="sig-nav sig-nav-prev" data-sig-nav="prev" title="前一张">' + ubIcon('arrow-left') + '</span>'
      + '<span class="sig-nav sig-nav-next" data-sig-nav="next" title="后一张">' + ubIcon('arrow-right') + '</span>'
      + '</div></div>').join('')
    + '</div>'
    + '<div class="sig-counter"></div>'
    + (hasInfo ? '<div class="sig-info"><span class="sig-desc"></span>'
      + (onOpenGallery ? '<button type="button" class="sig-gallery-btn">' + ubIcon('image') + '进入图库</button>' : '')
      + (onRegenerate ? '<button type="button" class="sig-regen-btn" title="按生图档案重新生成这张插图">' + ubIcon('refresh') + regenLabel + '</button>' : '')
      + '</div>' : '')
    + ((onImport || onDelete) ? '<div class="sig-zoom-actions">'
      + (onImport ? '<button type="button" class="sig-import-zoom" title="把这张插图复制一份到角色立绘图库">' + ubIcon('plus') + '转入角色图库</button>' : '')
      + (onDelete ? '<button type="button" class="sig-del-zoom" title="删除这张插图">' + ubIcon('trash') + '删除</button>' : '')
      + '</div>' : '');
  root.innerHTML = html;

  const trackEl = root.querySelector('.sig-track') as HTMLElement;
  const counterEl = root.querySelector('.sig-counter') as HTMLElement;
  const descEl = hasInfo ? (root.querySelector('.sig-desc') as HTMLElement) : null;
  const slots = Array.from(trackEl.children) as HTMLElement[];
  let cur = Math.max(0, Math.min(entries.length - 1, Math.floor(args.startIndex) || 0));
  let lastTX = 0;              // 内联 transform 的最后目标值（拖拽/base 参照）
  let suppressClick = false;   // 拖拽后吞掉浏览器合成 click，防误触发退出
  let dragging = false, dragMoved = false, startX = 0, baseTX = 0;
  let counterShown = false;    // 页码角标只在真正发生过翻页后显示（立绘同款）
  let doneCalled = false;
  let deleting = false;

  const w = (): number => trackEl.clientWidth || 1;
  const entryAt = (i: number): StoryImageEntry | null => (i >= 0 && i < entries.length) ? entries[i] : null;
  const setTX = (px: number, animate: boolean): void => {
    trackEl.style.transition = animate ? '' : 'none';
    trackEl.style.transform = 'translateX(' + px + 'px)';
    lastTX = px;
  };
  const fillSlot = (slot: HTMLElement, en: StoryImageEntry | null): void => {
    const img = slot.querySelector('img') as HTMLImageElement;
    const p = en ? en.path : null;
    if (p) {
      if (img.getAttribute('src') !== p) img.src = p;
      img.style.display = '';
    } else {
      img.removeAttribute('src');
      img.style.display = 'none';
    }
  };
  const preload = (en: StoryImageEntry | null): void => { if (en) { const im = new Image(); im.src = en.path; } };
  // 导航热区只在物理中间槽显示；到头那侧隐藏（不可点击）
  const syncNav = (): void => {
    slots.forEach((s, i) => {
      const prev = s.querySelector('.sig-nav-prev') as HTMLElement;
      const next = s.querySelector('.sig-nav-next') as HTMLElement;
      prev.style.display = (i === 1 && cur > 0) ? '' : 'none';
      next.style.display = (i === 1 && cur < entries.length - 1) ? '' : 'none';
    });
  };
  const updateCounter = (): void => {
    if (counterShown) counterEl.textContent = (cur + 1) + ' / ' + entries.length;
  };
  // 底部信息栏：当前图描述（随翻页更新；无描述时留空，信息栏仍显示图库入口按钮）
  const updateInfo = (): void => {
    if (!descEl) return;
    const en = entryAt(cur);
    descEl.textContent = en && en.description ? en.description : '';
    descEl.style.display = descEl.textContent ? '' : 'none';
  };
  const settle = (): void => {
    fillSlot(slots[0], entryAt(cur - 1));
    fillSlot(slots[1], entryAt(cur));
    fillSlot(slots[2], entryAt(cur + 1));
    setTX(-w(), false);   // 无过渡复位：中间槽即当前图
    syncNav();
    preload(entryAt(cur - 1));
    preload(entryAt(cur + 1));
    if (!counterShown) { counterShown = true; counterEl.classList.add('sig-show'); }
    updateCounter();
    updateInfo();
  };
  const goTo = (d: 1 | -1): void => {
    const t = cur + d;
    if (t < 0 || t >= entries.length) return;   // 到头：不翻，只由拖拽呈现回弹
    cur = t;
    fillSlot(d === 1 ? slots[2] : slots[0], entryAt(t));
    preload(entryAt(t + d));
    const target = -w() * (1 + d);              // +1 → -2w（第三槽居中）；-1 → 0（第一槽居中）
    if (Math.abs(lastTX - target) < 1) { settle(); return; }  // 已在目标位（如同向连点）：直接落位
    setTX(target, true);
  };

  // 初始三槽 + 预热相邻两张（保证拖拽露出的下一张立即可见）
  fillSlot(slots[0], entryAt(cur - 1));
  fillSlot(slots[1], entryAt(cur));
  fillSlot(slots[2], entryAt(cur + 1));
  syncNav();
  setTX(-w(), false);
  preload(entryAt(cur - 1));
  preload(entryAt(cur + 1));
  updateInfo();

  const done = (): void => {
    if (doneCalled) return;
    doneCalled = true;
    doc.removeEventListener('keydown', onKey, true);
    args.onDone();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); done(); }
  };
  doc.addEventListener('keydown', onKey, true);

  const handleDelete = async (): Promise<void> => {
    if (deleting || !onDelete) return;
    const entry = entryAt(cur);
    if (!entry) return;
    deleting = true;
    let ok = false;
    try { ok = await onDelete(entry); } catch (_e) { ok = false; }
    deleting = false;
    if (!ok) return;
    entries.splice(cur, 1);
    if (!entries.length) { done(); return; }
    if (cur >= entries.length) cur = entries.length - 1;
    counterShown = true;
    settle();
  };

  // 重新生图（按生图档案重放当前图）：成功就地刷新当前槽与描述；进行中按钮禁用
  let regenBusy = false;
  const handleRegenerate = async (): Promise<void> => {
    if (regenBusy || !onRegenerate) return;
    const idx = cur;                       // 定格发起时的槽位：生图期间用户翻页/关闭都不打扰当前视图
    const entry = entryAt(idx);
    if (!entry) return;
    regenBusy = true;
    const btn = root.querySelector('.sig-regen-btn') as HTMLElement | null;
    btn?.classList.add('sig-busy');
    let updated: StoryImageEntry | null = null;
    try { updated = await onRegenerate(entry); } catch (_e) { updated = null; }
    regenBusy = false;
    btn?.classList.remove('sig-busy');
    if (!updated) return;
    entries[idx] = updated;
    if (idx !== cur || !root.isConnected) return;   // 已翻到别张 / 放大已关闭：只更新序列，不动当前视图
    counterShown = true;
    settle();
  };

  // 指针拖拽（鼠标+触摸统一）：跟手 1:1，到头 0.35 阻尼，松手超 1/4 屏宽翻页否则回弹
  const winOf = (el: HTMLElement): Window => (el.ownerDocument?.defaultView as Window) || window;
  const onPointerDown = (e: PointerEvent): void => {
    if (dragging || (e.target as HTMLElement).closest('.sig-nav')) return;   // 导航热区是按钮语义，不启拖
    const m = winOf(trackEl).getComputedStyle(trackEl).transform;
    // m41 = matrix(a,b,c,d,e,f) 的第 5 个数 = x 平移量（不能用第一个数 a=缩放系数！）
    baseTX = (m && m !== 'none') ? (new DOMMatrixReadOnly(m).m41 || 0) : lastTX;
    dragging = true;
    dragMoved = false;
    startX = e.clientX;
    try { trackEl.setPointerCapture(e.pointerId); } catch (_e) { /* ignore */ }
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (!dragMoved) {
      if (Math.abs(dx) < 8) return;
      dragMoved = true;
      trackEl.style.transition = 'none';   // 拖拽接管：进行中的过渡不 settle（释放时以 goTo/回弹收尾）
    }
    let tx = baseTX + dx;
    if ((cur === 0 && dx > 0) || (cur === entries.length - 1 && dx < 0)) tx = baseTX + dx * 0.35;
    trackEl.style.transform = 'translateX(' + tx + 'px)';
    lastTX = tx;
  };
  const onPointerUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    const dx = e.clientX - startX;
    if (!dragMoved) return;   // 纯点击：轨道不动，后续 click 正常走退出/导航
    suppressClick = true;     // 拖过（≥8px）即吞合成 click，防误关
    if (Math.abs(dx) > w() / 4) {
      const d: 1 | -1 = dx < 0 ? 1 : -1;
      if (cur + d < 0 || cur + d >= entries.length) setTX(-w(), true);
      else goTo(d);
    } else {
      setTX(-w(), true);      // 回弹
    }
  };
  const onPointerCancel = (): void => {
    if (!dragging) return;
    dragging = false;
    suppressClick = true;
    setTX(-w(), true);        // 中断（来电/手势冲突）一律回弹复位
  };
  trackEl.addEventListener('pointerdown', onPointerDown);
  trackEl.addEventListener('pointermove', onPointerMove);
  trackEl.addEventListener('pointerup', onPointerUp);
  trackEl.addEventListener('pointercancel', onPointerCancel);
  trackEl.addEventListener('transitionend', (e: TransitionEvent) => {
    if (e.target !== trackEl) return;   // 只认轨道自身 transform 过渡
    settle();
  });
  // 捕获期拦截拖拽后的合成 click（吞掉，不落到下方退出判定）
  trackEl.addEventListener('click', (e: MouseEvent) => {
    if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); }
  }, true);

  // 点击：导航＝翻页；删除按钮＝删除；进入图库按钮＝关闭放大并打开图库；点图体/空白＝退出（空白沿用防幽灵点击）
  root.addEventListener('click', function (e: MouseEvent) {
    const t = e.target as HTMLElement;
    const nav = t.closest('.sig-nav');
    if (nav) { goTo((nav as HTMLElement).getAttribute('data-sig-nav') === 'prev' ? -1 : 1); return; }
    if (t.closest('.sig-del-zoom')) { e.preventDefault(); e.stopPropagation(); void handleDelete(); return; }
    if (onImport && t.closest('.sig-import-zoom')) {
      e.preventDefault(); e.stopPropagation();
      const en = entryAt(cur);
      if (en) onImport(en);
      return;
    }
    if (onRegenerate && t.closest('.sig-regen-btn')) { e.preventDefault(); e.stopPropagation(); void handleRegenerate(); return; }
    if (onOpenGallery && t.closest('.sig-gallery-btn')) { e.preventDefault(); e.stopPropagation(); done(); onOpenGallery(); return; }
    if (!t.closest('.sig-frame') && guardGhostClick()) return;
    done();
  });
}
