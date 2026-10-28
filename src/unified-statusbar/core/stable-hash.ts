// ===== FNV-1a 32 位稳定短哈希（U46 单源） =====
// 全项目曾有 3 份逐字同构的 FNV-1a 循环（character-relation-worldbook.pairHash /
// character-relation-layout 签名 / wardrobe-worldbook.stableActorKeyHash），输出格式各异
// （base36 串 vs 32 位无符号数）——循环收编于此，格式保留在各调用方。
// 零依赖纯函数（小手机侧亦可 import，见跨项目判据：零依赖纯函数/无状态只读）。
export function fnv1a32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** 稳定短哈希的 base36 串形态（pairHash / stableActorKeyHash 共用的输出格式）。 */
export function fnv1a36(input: string): string {
  return fnv1a32(input).toString(36);
}
