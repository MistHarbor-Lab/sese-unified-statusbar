import { clampIntParseInt } from './number';

/**
 * 经期/孕期系统的人物姓名键。
 * 姓名是同一聊天内的唯一人物标识；去首尾空白并忽略英文大小写。
 */
export function normalizeCycleName(name: unknown): string {
  return String(name ?? '').trim().toLowerCase();
}

/** 从“24岁”“约24岁”等文本中提取首个非负数字；未知或非法值返回 null。 */
export function parseCycleAge(value: unknown): number | null {
  const match = String(value ?? '').match(/(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const age = Number(match[1]);
  return Number.isFinite(age) && age >= 0 ? age : null;
}

/**
 * 钳制为 [lo, hi] 内的整数；非法值回退 def。
 * ★U7：实现已收拢到 `core/number.ts#clampIntParseInt`（**parseInt 语义**：number 走 floor，
 * 否则 `parseInt(v, 10)` ⇒ `'5abc'`→5；`true` / `null` → 回退）。此处保留导出名与参数顺序，
 * 既有调用点（cycle-engine / cycle-store 等）零改动沿用、行为逐字节不变。
 */
export function clampInt(v: any, lo: number, hi: number, def: number): number {
  return clampIntParseInt(v, lo, hi, def);
}
