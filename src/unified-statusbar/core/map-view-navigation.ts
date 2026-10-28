// ===== 地图弹窗内视图决策纯函数 =====
//
// 弹窗内导航到某节点后，决定该展示场景图还是 SVG 地图。纯函数零依赖，
// 便于 ts-node 单测；UI 层（map-panel）负责读真实状态后调用。

export type MapNodeViewAction =
  | { action: 'show-scene' }
  | { action: 'show-svg' }
  | { action: 'hint'; reason: 'no-scene-no-svg' };

/**
 * 决定弹窗内导航到某节点后应呈现的内容。
 * 场景图模式下「有场景图优先」：目标有场景图就直接显示场景图（无需 SVG）；
 * 无场景图但有 SVG 则切 SVG；都无则提示。SVG 模式下保持优先 SVG，仅当无 SVG 有场景图时才切场景图。
 */
export function decideMapNodeView(
  hasScene: boolean,
  hasSvg: boolean,
  currentMode: 'svg' | 'scene',
): MapNodeViewAction {
  if (currentMode === 'scene') {
    if (hasScene) return { action: 'show-scene' };
    if (hasSvg) return { action: 'show-svg' };
    return { action: 'hint', reason: 'no-scene-no-svg' };
  }
  if (hasSvg) return { action: 'show-svg' };
  if (hasScene) return { action: 'show-scene' };
  return { action: 'hint', reason: 'no-scene-no-svg' };
}
