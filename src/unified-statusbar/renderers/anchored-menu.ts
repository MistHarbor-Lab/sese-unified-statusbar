// ===== 锚定浮层定位（地图库行 ⋯ 二级菜单 / 立绘 ⋮ 快捷菜单共用） =====
// 纯几何：只吃矩形数值、不碰 DOM（调用方各自量好 rect 与菜单尺寸后一次性定位）。
// 规则：默认在锚点下方展开；下方放不下且上方空间更大则翻到锚点上方；两侧都放不下时
// 限高 + 内部滚动（上限取空间更大一侧 ⇒ 菜单整体落在容器内、块内可滚）；水平右对齐锚点
// 并夹在容器左右边缘内。
// 病根形态（勿回退）：只按 rect.bottom 定位时，锚行靠底 + 菜单高（手机端 ⋯ 菜单 11 项 ≈330px）
// 会让菜单下部落到容器（视口层）之外——不可见、不可滚、点不到。

export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** 定位容器（菜单的包含块：满视口的 fixed 浮层）；DOMRect 可直接传入。 */
export interface ContainerRect extends AnchorRect {
  width: number;
  height: number;
}

export interface MenuSize {
  width: number;
  height: number;
}

export interface AnchoredMenuPlacement {
  /** 写入 style.left（相对容器左上角）。 */
  left: number;
  /** 写入 style.top（相对容器左上角）。 */
  top: number;
  /** 非 null 时写入 style.maxHeight，并配合 overflow-y:auto。 */
  maxHeight: number | null;
}

export interface AnchoredMenuOptions {
  /** 锚点与菜单之间的缝（px），同时作为贴容器上边的最小留白。默认 2。 */
  gap?: number;
  /** 容器左右边缘留白（px）。默认 8。 */
  edge?: number;
}

export function placeAnchoredMenu(
  anchor: AnchorRect,
  container: ContainerRect,
  menu: MenuSize,
  opts: AnchoredMenuOptions = {},
): AnchoredMenuPlacement {
  const gap = opts.gap ?? 2;
  const edge = opts.edge ?? 8;
  // 可用空间都先扣掉缝：限高直接取它，菜单就不会压到容器边缘
  const roomBelow = Math.max(0, container.bottom - anchor.bottom - gap);
  const roomAbove = Math.max(0, anchor.top - container.top - gap);
  // 下方放得下、或上方更挤 → 保持向下（桌面端行离容器底很远，等价于旧行为）
  const openBelow = menu.height <= roomBelow || roomBelow >= roomAbove;
  const height = Math.min(menu.height, openBelow ? roomBelow : roomAbove);
  const top = openBelow
    ? anchor.bottom - container.top + gap
    : Math.max(gap, anchor.top - container.top - height - gap);
  // 水平：右对齐锚点；越出容器右边缘或比容器还宽时夹回边缘内
  let left = anchor.right - container.left - menu.width;
  const maxLeft = container.width - menu.width - edge;
  if (left > maxLeft) left = maxLeft;
  if (left < edge) left = edge;
  return { left, top, maxHeight: height < menu.height ? height : null };
}
