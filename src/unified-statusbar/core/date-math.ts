// ===== 日期天数差单源（U40 立出口） =====
// 全项目「dateKey → 天数差」原有 6 套实现、4 条算法路线（本地时区 Date 差值 / Date.UTC+setUTCFullYear
// 技巧 / Hinnant 纯算术 civilDays / BigInt 序数），各有容错口径与返回类型、无逐字同构对——
// 本出口立「Hinnant 纯算术」为标准路线（纯整数、无 Date 对象、天然免疫 0-99 年 1900 偏移与负年份、
// 无时区参与），供此后新代码使用。存量 5 处旧路线各自有测试锁定、行为等价性未经逐字节证明，
// 暂不强行搬迁（见 docs/unification/PLAN.md U40 状态）；character-hub-popup 的 civilDays/dayDiff
// 已迁入本模块（原实现逐字）。
// 零依赖纯函数。
export function civilDays(year: number, month: number, day: number): number {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400; // [0,399]
  const mp = (month + (month > 2 ? -3 : 9) + 12) % 12; // 3月=0…2月=11
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1; // [0,365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; // [0,146096]
  return era * 146097 + doe - 719468;
}

/** dateKey（YYYY-MM-DD，年份 1-6 位可负）之差 b - a 的天数；任一不合法返回 0（与既有调用方口径一致）。 */
export function dateKeyDayDiff(aKey: string, bKey: string): number {
  const a = /^(-?\d{4,6})-(\d{2})-(\d{2})$/.exec(aKey), b = /^(-?\d{4,6})-(\d{2})-(\d{2})$/.exec(bKey);
  if (!a || !b) return 0;
  return civilDays(+b[1], +b[2], +b[3]) - civilDays(+a[1], +a[2], +a[3]);
}
