// ===== 成就系统 · 段位（收藏度）单一来源（第九轮 L12）=====
// 段位 = 已解锁点数 / 总点数，5% 一档共 20 档（档位名沿用既有统计条文案，逐字未改）。
// 本模块是全系统**唯一**的段位计算处，两个消费者：
//   ① 成就簿统计条（renderers/achievement-ui.ts）——「第 N 档 · 名字」+ 进度条
//   ② 段位勋章成就求值（core/achievement-engine.ts 的 tier-at-least）
// 之前该计算只写在 achievement-ui.ts 内部（RARITY_POINTS / TIER_NAMES），引擎与其他模块都拿不到。
//
// ★ 口径（防「集齐勋章才升档」自循环）：
//   - 分母/分子只统计**核心成就**（排除内部条目 `_` 与段位勋章 `tier_`）⇒ 勋章自身不影响段位。
//   - 与既有统计条显示口径逐字一致（含 completion=1 时进度按 100% 处理）。
//
// ★ 性能（用户口径：成就添加不得带来过度性能负担）：
//   - 全量计算按成就簿「修订令牌」记忆：只有解锁/重置才推进令牌，扫描期重复调用零重算；
//   - 核心成就列表在首次调用时构建一次（ACHIEVEMENTS 为静态数据，之后零成本复用）。
import { getAchievements } from './achievement-catalog';
import { isUnlocked, getBookRevision } from './achievement-store';
import { rarityPointsOf } from './achievement-rarity';
import type { AchievementDef } from './achievement-types';

/** 20 档段位名（逐字抄自原 achievement-ui.ts，全局一套、不随主题变） */
export const TIER_NAMES = [
  '刚入门', '往兜里揣', '囤零碎', '有点囤癖', '分门别类',
  '收藏夹满', '仓鼠属性', '图鉴点亮', '贴上标签', '仓库扩容',
  '小集邮客', '满坑满谷', '早晚会塞爆', '收集癖晚期', '归档完毕',
  '私人博物馆', '得建索引', '她都记不过来', '半个世界', '全图鉴收官',
];
export const TIER_COUNT = TIER_NAMES.length;
/** 每档宽度（5%） */
export const TIER_STEP = 0.05;

/** 段位勋章 id 判定（分母排除用；勋章命名空间 `tier_`） */
export function isTierMedalId(id: string): boolean {
  return typeof id === 'string' && id.startsWith('tier_');
}

/** 第 tier 档（1-20）的收藏度门槛（百分比整数）。口径 = 统计条：floor(completion/5%)+1 = tier ⇒ completion ≥ 5%×(tier-1)。 */
export function tierThresholdPercent(tier: number): number {
  const t = Math.max(1, Math.min(TIER_COUNT, Math.trunc(tier) || 1));
  return 5 * (t - 1);
}

export interface TierSnapshot {
  /** 核心成就总点数（排除内部条目与段位勋章） */
  totalPoints: number;
  /** 已解锁核心成就点数 */
  unlockedPoints: number;
  /** 核心成就总数（统计条「N/总数」用） */
  totalCount: number;
  /** 已解锁核心成就数（统计条「N/总数」用） */
  unlockedCount: number;
  /** 收藏度（0-1） */
  completion: number;
  /** 0-based 档位索引（显示为「第 tier+1 档」，与既有统计条一致） */
  tier: number;
  /** 当前档内进度（0-100 整数） */
  tierPct: number;
}

let _core: AchievementDef[] | null = null;
/** 核心成就（统计条/段位口径）：排除内部推进条目与段位勋章。静态数据，构建一次。 */
export function coreAchievements(): AchievementDef[] {
  if (!_core) {
    _core = getAchievements().filter(a => !a.id.startsWith('_') && !isTierMedalId(a.id));
  }
  return _core;
}

let _memoRev = -1;
let _memo: TierSnapshot | null = null;

/** 当前段位快照（按成就簿修订令牌记忆；扫描期重复调用零重算）。 */
export function computeTierSnapshot(): TierSnapshot {
  const rev = getBookRevision();
  if (_memo && _memoRev === rev) return _memo;
  const list = coreAchievements();
  let totalPoints = 0;
  let unlockedPoints = 0;
  let unlockedCount = 0;
  for (const a of list) {
    const p = rarityPointsOf(a);
    totalPoints += p;
    if (isUnlocked(a.id)) { unlockedPoints += p; unlockedCount++; }
  }
  const completion = totalPoints > 0 ? unlockedPoints / totalPoints : 0;
  const tier = Math.min(TIER_COUNT - 1, Math.floor(completion / TIER_STEP));
  // completion=1 时 floor 会得到 20（越界），既有 UI 用特判按 100% 显示，此处保持一致
  const tierProgress = completion < 1 ? (completion - tier * TIER_STEP) / TIER_STEP : 1;
  _memo = {
    totalPoints,
    unlockedPoints,
    totalCount: list.length,
    unlockedCount,
    completion,
    tier,
    tierPct: Math.round(tierProgress * 100),
  };
  _memoRev = rev;
  return _memo;
}
