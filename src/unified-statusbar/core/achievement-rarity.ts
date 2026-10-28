// ===== 成就系统 · 稀有度单一来源（第九轮 U19）=====
// 全系统「稀有度」只有这一份定义：点数、名称、主色。消费方三处：
//   ① 解锁弹卡（renderers/achievement-notify.ts）——四档标签文案 + 主色（CSS 由本模块拼）
//   ② 成就簿卡片（renderers/achievement-ui.ts）——左侧色条 + 名牌签
//   ③ 段位收藏度计算（core/achievement-tier.ts）——点数
// 既有设计原则（notify CSS 原注释）：**稀有度配色跨主题统一，主题只改风格** ⇒ 色值刻意不随主题走。
import type { AchievementDef } from './achievement-types';

/** rarity 档位 → 点数（spec §2.1：常见 1 / 罕见 3 / 史诗 5 / 传说 8） */
export const RARITY_POINTS = [1, 3, 5, 8] as const;
/** rarity 档位 → 名称（弹卡/簿子同字） */
export const RARITY_LABEL = ['常见', '罕见', '史诗', '传说'] as const;
/** rarity 档位 → 主色（跨主题统一的四档识别色；装饰性渐变的浅色/深色由各消费方就地取值） */
export const RARITY_COLOR = ['#6c757d', '#3a86ff', '#9d4edd', '#ffd700'] as const;

/** 取成就稀有度档位（0-3）。缺省/非法回退 0（与既有 statHTML / notify 口径逐字一致）。 */
export function rarityOf(def: Pick<AchievementDef, 'rarity'> | undefined | null): number {
  const r = def && typeof def.rarity === 'number' && def.rarity >= 0 && def.rarity <= 3 ? def.rarity : 0;
  return Math.trunc(r);
}

/** 取成就稀有度点数。 */
export function rarityPointsOf(def: Pick<AchievementDef, 'rarity'> | undefined | null): number {
  return RARITY_POINTS[rarityOf(def)];
}

function clampTier(r: number): number { return r >= 0 && r <= 3 ? Math.trunc(r) : 0; }
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
/** 四档主色的 RGB 分量（构建一次；CSS 里写 rgba(...) 的消费方由此取值，避免手抄色值） */
export const RARITY_RGB: ReadonlyArray<readonly [number, number, number]> = RARITY_COLOR.map(hexToRgb);

/** 主色的半透明形式（如 rarityRgba(1, .4) → "rgba(58,136,255,0.4)"） */
export function rarityRgba(rarity: number, alpha: number): string {
  const [r, g, b] = RARITY_RGB[clampTier(rarity)];
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 主色 + 两位十六进制透明度的 8 位色（如 rarityHexA(2, 'cc') → "#9d4eddcc"） */
export function rarityHexA(rarity: number, alphaHex: string): string {
  return RARITY_COLOR[clampTier(rarity)] + alphaHex;
}
