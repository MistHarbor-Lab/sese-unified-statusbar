// ===== 玩法示意图映射读取 =====
// 数据来源：build-statusbar.cjs 在打包时将 dist/worldbooks/image_map_final.json 的 imageMap
// 嵌入分发包，并暴露为 window.__ub_play_images（iframe 下取 parent）。
// 结构：{ 玩法名(已 trim): [{ sourceNumber, imageUrl }, ...] }

export interface PlayImageEntry {
  sourceNumber: number;
  imageUrl: string;
}

/** 获取玩法示意图映射表（玩法名→图片列表） */
export function getPlayImages(): Record<string, PlayImageEntry[]> {
  try {
    const d = (window as any).__ub_play_images;
    if (d) return d as Record<string, PlayImageEntry[]>;
  } catch (e) { /* ignore */ }
  try {
    const d = (parent as any).__ub_play_images;
    if (d) return d as Record<string, PlayImageEntry[]>;
  } catch (e) { /* cross-origin */ }
  return {};
}

/** 取某个玩法名对应的示意图列表。playName 可能带前后空格（playLists 中如此），自动 trim 后匹配。无图返回 []。 */
export function getPlayImageList(playName: string): PlayImageEntry[] {
  if (!playName) return [];
  const map = getPlayImages();
  const key = playName.trim();
  return (map[key] as PlayImageEntry[]) || [];
}
