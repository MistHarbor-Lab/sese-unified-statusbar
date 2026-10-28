// ═════════════════════════════════════════════════════════════════════
// ★★★ 临时迁移工具：生日列「XX岁」残留 → 随机生日（未来版本稳定后整体删除） ★★★
// ═════════════════════════════════════════════════════════════════════
// 背景：V3.2.0/V3.3.0 起标准模板把 主角信息表/恋爱对象表/重要角色表 的「年龄」列替换为
// 「生日」列（YYYY-MM-DD）；「数据库模板修复」迁移旧库时按原样迁入，因此部分旧库存量行
// 的生日格里残留“20岁”这类年龄文本（前端由 birthday.ts 旧年龄兜底兼容显示，见其「未来
// 删除」标注）。本模块提供 设置 → 表格「年龄->生日转换」按钮的执行层：把三张角色表生日
// 列中所有年龄形态的残留值，按剧情当前日期（全局数据表「当前时间」，与前端年龄显示同源，
// 缺失时回退真实系统日期）加该年龄反推出一个随机生日写回替换，使前端/日历/世界书生日
// 链路恢复完整。
// ★删除指引：本模块为一次性迁移工具，新库全面覆盖（生日列不再有年龄残留）后，连同
//   config-panel.ts 里的「年龄->生日转换」按钮与点击处理一起整体删除。
import { getCellByHeader, getSheetByName, updateCell } from './data-manager';
import { computeAgeAt } from './birthday';
import { getTodayDateKey, formatYear } from './calendar-core';

/** 参与转换的三张角色表（与 birthday.ts 的 BIRTHDAY_TABLES 同一份名单）。 */
const AGE_MIGRATION_TABLES = ['主角信息表', '恋爱对象表', '重要角色表'] as const;

/** 各月天数上限（2 月按 28 收，刻意避开 02-29 的闰年落日口径）。 */
const MONTH_DAY_CAPS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface AgeToBirthdayResult {
  ok: boolean;
  /** 成功替换的单元格数 */
  changed: number;
  /** 解析成功但生成/写入失败的单元格数 */
  failed: number;
  /** 逐条「表·姓名：旧值 → 新值」明细（同时输出到 console 便于回溯） */
  details: string[];
}

/** 判定残留年龄文本：纯「XX岁」或纯数字（前端兼容显示同样把纯数字当年龄）。
 *  返回整数年龄；非年龄形态（含已是日期的生日值）返回 null 不动。 */
export function parseResidualAgeText(value: unknown): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.match(/^(\d{1,3})(?:\.\d+)?\s*岁?$/);
  if (!match) return null;
  const age = parseInt(match[1], 10);
  return Number.isFinite(age) && age > 0 && age <= 999 ? age : null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 由「当前日期 + 年龄」生成生日（规范 YYYY-MM-DD）：月日在全年随机，
 *  出生年份取「今年 - 年龄」（随机月日尚未到时再减一岁），使反推周岁恰等于原年龄。
 *  极端边界兜底：随机结果校验不过时退「生日=今天」的确定解（周岁必恰等），再不过返回 null。 */
export function generateBirthdayFromAge(age: number, todayKey: string): string | null {
  const t = String(todayKey).match(/^(-?\d{1,6})-(\d{2})-(\d{2})$/);
  if (!t) return null;
  const todayYear = parseInt(t[1], 10);
  const todayMd = `${t[2]}-${t[3]}`;
  // （U32：本地 formatYear 副本已收编为 calendar-core 正版 import，调用点直接用）

  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * MONTH_DAY_CAPS[month - 1]);
  const md = `${pad2(month)}-${pad2(day)}`;
  const randomAttempt = `${formatYear(todayYear - age - (md > todayMd ? 1 : 0))}-${md}`;
  if (computeAgeAt(randomAttempt, todayKey) === age) return randomAttempt;

  // 确定解兜底：生日=今年同月同日 → 今年已过生日，周岁必然恰等于年龄
  const fallback = `${formatYear(todayYear - age)}-${todayMd}`;
  return computeAgeAt(fallback, todayKey) === age ? fallback : null;
}

/** 扫描三张角色表，把生日列中所有「XX岁」残留替换为按当前日期+年龄随机生成的生日。
 *  逐格走 updateCell（写回队列/SQLite 参数化路径同前端手动改格），只动残留格，
 *  已是日期的生日值原样保留。 */
export async function convertResidualAgeToBirthday(): Promise<AgeToBirthdayResult> {
  const details: string[] = [];
  let changed = 0;
  let failed = 0;
  const todayKey = getTodayDateKey();
  if (!todayKey) {
    // F3：不兜底现实日期——现实年份一旦写进生日列并持久化，虚构纪年到达后年龄推算
    // 永久错乱（脏数据，无法事后修复）。取消转换并明确告知。
    return {
      ok: false,
      changed: 0,
      failed: 0,
      details: ['游戏日期尚未建立（AI 未填写「当前时间」），已取消转换；填写后重试'],
    };
  }

  for (const table of AGE_MIGRATION_TABLES) {
    let sheet: ReturnType<typeof getSheetByName>;
    try { sheet = getSheetByName(table); } catch (_e) { continue; }
    if (!sheet || !Array.isArray(sheet.content) || sheet.content.length < 2) continue;
    if (sheet.content[0].indexOf('生日') === -1) continue; // 无生日列（未跑模板修复的旧库）整表跳过

    for (let row = 1; row < sheet.content.length; row++) {
      const raw = getCellByHeader(table, row, '生日');
      const age = parseResidualAgeText(raw);
      if (age == null) continue;
      const name = String(getCellByHeader(table, row, '姓名') || '').trim() || `第${row}行`;
      const birthday = generateBirthdayFromAge(age, todayKey);
      if (!birthday) {
        failed++;
        details.push(`${table}·${name}：${String(raw).trim()} → 生日生成失败（已跳过）`);
        continue;
      }
      const ok = await updateCell(table, row, '生日', birthday);
      if (ok) {
        changed++;
        details.push(`${table}·${name}：${String(raw).trim()} → ${birthday}`);
      } else {
        failed++;
        details.push(`${table}·${name}：${String(raw).trim()} → 写入失败`);
      }
    }
  }

  for (const line of details) console.info(`[年龄->生日转换] ${line}`);
  return { ok: failed === 0, changed, failed, details };
}
