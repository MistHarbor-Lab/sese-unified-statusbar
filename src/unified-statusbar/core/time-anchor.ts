// ===== 纪要表 + 备忘录 时间锚定功能 =====
// 在纪要文本/备忘标题前注入「与今天的关系」派生字段
// 当全局数据表「当前时间」日期变动或纪要表/备忘录行更新时，在纪要文本/备忘标题前自动添加时间锚定前缀
//
// SQLite 模式：querySql 读取 + executeSqlBatch 一次性批量写入（极快）
//
// 纪要表：  从「时间跨度」列取左侧开始日期，锚定文本写到「纪要」列
// 备忘录：  从「约定时间」列取日期（为空则跳过），锚定文本写到「备忘标题」列
import {
  queryLogicalTableRows,
  runDbBatch,
} from './data-manager';
import { isGregorianLeapYear } from './calendar-core';
import { getConfig } from './config-store';
import { isRefillMode } from './refill-mode';

// ===== 类型定义 =====
interface ParsedDate {
  year: number;
  monthIndex: number; // 0-11
  day: number;
  daySerial: bigint;  // proleptic Gregorian days since epoch
}

interface TimeAnchorRuntime {
  running: boolean;
  pending: boolean;
  applying: boolean;
  lastInputSignature: string | null;
}

interface ChronicleUpdate {
  dbRowIndex: number;
  newText: string;
}

/** SQL 查询返回的纪要行结构 */
interface ChronicleRowSql {
  row_id: number;
  time_span: string | null;
  chronicle_text: string | null;
}

/** SQL 查询返回的备忘录行结构 */
interface MemoRowSql {
  row_id: number;
  appointed_time: string | null;
  memo_title: string | null;
}

const runtime: TimeAnchorRuntime = {
  running: false,
  pending: false,
  applying: false,
  lastInputSignature: null,
};

let started = false;

// ===== 日期计算工具（仅 Gregorian 日期；闰年判定走 calendar-core 单源 U45） =====

function getMonthDayCounts(year: number): number[] {
  return [31, isGregorianLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
}

/** BigInt 向下取整除法（JS a/b 向零截断，负年份会差天）。 */
function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  const r = a % b;
  return r !== 0n && (r < 0n) !== (b < 0n) ? q - 1n : q;
}

function daysBeforeYear(year: bigint): bigint {
  const y = year - 1n;
  return y * 365n + floorDiv(y, 4n) - floorDiv(y, 100n) + floorDiv(y, 400n);
}

function computeRealDateSerial(year: number, month: number, day: number): bigint | null {
  // month is 1-based, day is 1-based
  if (month < 1 || month > 12 || day < 1) return null;
  const yearBig = BigInt(year);
  const monthDays = getMonthDayCounts(year);
  if (day > monthDays[month - 1]) return null;
  let days = daysBeforeYear(yearBig);
  for (let i = 0; i < month - 1; i++) {
    days += BigInt(monthDays[i]);
  }
  return days + BigInt(day - 1);
}

// ===== 日期解析 =====

function parseDateFromText(text: string | null): ParsedDate | null {
  if (!text) return null;
  const match = String(text).match(/^(-?\d{1,6})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const daySerial = computeRealDateSerial(year, month, day);
  if (daySerial === null) return null;
  return { year, monthIndex: month - 1, day, daySerial };
}

/** 从时间跨度字符串取日期：优先左侧开始日期；首条纪要开始为空（`~ 结束`）时退回右侧结束日期。 */
function parseFirstDateFromTimeSpan(timeSpan: string | null): ParsedDate | null {
  if (!timeSpan) return null;
  const text = String(timeSpan).trim();
  const separatorIdx = text.indexOf('~');
  const leftPart = separatorIdx >= 0 ? text.slice(0, separatorIdx).trim() : text;
  const rightPart = separatorIdx >= 0 ? text.slice(separatorIdx + 1).trim() : '';
  return parseDateFromText(leftPart) || parseDateFromText(rightPart);
}

// ===== 日期差计算 =====

function calculateDateDiffDays(today: ParsedDate, target: ParsedDate): bigint | null {
  if (!today?.daySerial || !target?.daySerial) return null;
  return today.daySerial - target.daySerial;
}

// ===== 中文数字格式化 =====

const CHINESE_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function toChineseSmallInteger(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) return String(n);
  if (n < 10) return CHINESE_DIGITS[n];
  if (n === 10) return '十';
  if (n < 20) return '十' + CHINESE_DIGITS[n % 10];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return CHINESE_DIGITS[tens] + '十' + (ones > 0 ? CHINESE_DIGITS[ones] : '');
  }
  return String(n);
}

function formatWholeUnitCount(count: number, unit: string): string {
  if (unit === '个月') {
    if (count === 1) return '一个月';
    if (count === 2) return '两个月';
    return toChineseSmallInteger(count) + '个月';
  }
  if (unit === '年') {
    return (count === 2 ? '两' : toChineseSmallInteger(count)) + '年';
  }
  return toChineseSmallInteger(count) + unit;
}

function formatHalfStep(count: number, unit: string, direction: string): string {
  if (count === 0) return '半' + unit + direction;
  if (unit === '个月') {
    if (count === 1) return '一个半月' + direction;
    if (count === 2) return '两个半月' + direction;
    return toChineseSmallInteger(count) + '个半月' + direction;
  }
  if (unit === '年') {
    return formatWholeUnitCount(count, '年') + '半' + direction;
  }
  return formatWholeUnitCount(count, unit) + '半' + direction;
}

function formatDayNumber(absDays: number, direction: string): string {
  if (absDays === 0) return '今天';
  if (absDays === 1) return direction === '前' ? '昨天' : '明天';
  if (absDays === 2) return direction === '前' ? '前天' : '后天';
  if (absDays >= 3 && absDays <= 6) return absDays + '天' + direction;
  if (absDays === 7) return '一周' + direction;
  if (absDays >= 8 && absDays <= 14) return absDays + '天' + direction;
  if (absDays === 15) return '半个月' + direction;
  if (absDays >= 16 && absDays <= 20) return absDays + '天' + direction;
  if (absDays === 21) return '三周' + direction;
  if (absDays >= 22 && absDays <= 29) return absDays + '天' + direction;

  // 30-179 天：按月/半月分桶 (15天半步)
  if (absDays >= 30 && absDays <= 179) {
    const bucketStart = Math.floor((absDays - 30) / 15) * 15 + 30;
    const halfSteps = bucketStart / 15;
    const wholeUnits = Math.floor(halfSteps / 2);
    const hasHalf = halfSteps % 2 === 1;
    if (hasHalf) return formatHalfStep(wholeUnits, '个月', direction);
    return formatWholeUnitCount(wholeUnits, '个月') + direction;
  }

  // 180-359 天
  if (absDays >= 180 && absDays <= 359) return '半年' + direction;

  // 360+ 天：按年/半年分桶 (180天半步)
  const bucketStart = Math.floor((absDays - 360) / 180) * 180 + 360;
  const halfSteps = Math.floor(bucketStart / 180);
  const wholeUnits = Math.floor(halfSteps / 2);
  const hasHalf = halfSteps % 2 === 1;
  if (hasHalf) return formatHalfStep(wholeUnits, '年', direction);
  return formatWholeUnitCount(wholeUnits, '年') + direction;
}

/** 导出供往返不变量测试使用：生成端与剥离端必须成对，任何一端改了形式都要一起改。 */
export function formatRelativeDays(diffDays: bigint): string {
  if (diffDays === 0n) return '今天，';
  const direction = diffDays > 0n ? '前' : '后';
  const absDaysBig = diffDays > 0n ? diffDays : -diffDays;
  // 超大天数也走分桶逻辑（BigInt 直接转为 Number 可能溢出，但实际场景极少）
  if (absDaysBig > BigInt(Number.MAX_SAFE_INTEGER)) {
    const bucketStart = ((absDaysBig - 360n) / 180n) * 180n + 360n;
    const halfSteps = Number(bucketStart / 180n);
    const wholeUnits = Math.floor(halfSteps / 2);
    const hasHalf = halfSteps % 2 === 1;
    if (hasHalf) return formatHalfStep(wholeUnits, '年', direction) + '，';
    return formatWholeUnitCount(wholeUnits, '年') + direction + '，';
  }
  return formatDayNumber(Number(absDaysBig), direction) + '，';
}

// ===== 备忘录专用时间锚定格式化（约定时间 - 当前时间） =====
// 与纪要表的 formatRelativeDays 不同，备忘录使用简明日差格式：
//   0 → 今天，1 → 明天，2 → 后天，≥3 → N天后，
//   -1 → 昨天，-2 → 前天，≤-3 → N天前

/** 导出供往返不变量测试使用（同 formatRelativeDays）。 */
export function formatMemoAnchor(diffDays: bigint): string {
  if (diffDays === 0n) return '今天，';
  const direction = diffDays > 0n ? '后' : '前';
  const absDays = diffDays > 0n ? diffDays : -diffDays;
  if (absDays === 1n) return direction === '后' ? '明天，' : '昨天，';
  if (absDays === 2n) return direction === '后' ? '后天，' : '前天，';
  return Number(absDays) + '天' + direction + '，';
}

// ===== 防叠加：检测并剥离已有时间锚定前缀 =====
//
// 生成端（formatRelativeDays / formatMemoAnchor）与剥离端（stripTimeAnchorPrefix）必须共用
// 下面这一份形式定义，任何一头改形式都要同步另一头，并由 tests/time-anchor-prefix 的往返
// 不变量测试兜底。历史事故：年份计数 ≥100 时 toChineseSmallInteger 退化成阿拉伯数字
// （"202年前"），而剥离端只认中文数字 ⇒ 前缀写得进去、删不出来，每轮锚定往前多贴一截，
// 最终纪要正文被几十层前缀淹没。

/** 锚定词单位清单：长者在前（交替优先匹配复合单位，如「年半」先于「年」）。 */
const ANCHOR_UNITS = ['个半月', '年半', '个月', '周', '年', '天'];

/** 「数字」部分的写法：中文数字，或阿拉伯数字（≥100 的年份计数走这一类）。 */
const ANCHOR_NUM = '(?:[一两二三四五六七八九十百千万]+|\\d+)';

/** 不含「数字+单位」结构、只能逐字列举的整体形式。 */
const ANCHOR_WHOLE = [
  '今天', '昨天', '前天', '明天', '后天',
  '半个月前', '半个月后', '半年前', '半年后',
];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTimeAnchorRE(): RegExp {
  const unitPatterns = ANCHOR_UNITS.map(unit => ANCHOR_NUM + escapeRegExp(unit) + '[前后]');
  const alt = ANCHOR_WHOLE.map(escapeRegExp).concat(unitPatterns).join('|');
  return new RegExp('^(?:' + alt + ')(?:，\\s*)?');
}

const TIME_ANCHOR_RE = buildTimeAnchorRE();

/** 剥离已有的时间锚定前缀；循环剥离，使历史上堆叠的多层前缀一次清空。 */
export function stripTimeAnchorPrefix(text: string): string {
  let rest = text;
  for (;;) {
    const m = rest.match(TIME_ANCHOR_RE);
    if (!m || m[0].length === 0) return rest;
    rest = rest.slice(m[0].length);
  }
}

// ===== 通用工具 =====

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

// ===== SQL 辅助函数 =====
//
// 读取必须走 queryTableRows 兼容层按 sheet.name 定位；禁止把中文表名交给 raw
// querySql，否则数据库插件的列名子串替换可能污染未注册的表名。
// 写入直接用当前物理表名（V3.0 起为拼音名），不依赖 mutation rebind 别名。
//
// sqlEscape() 已集中到 data-manager.ts，此处直接引用。

// 读取请求一律中文列名（台账口径）；真数据库后端回物理列名，由 queryLogicalTableRows 按请求顺序归一。
// 本模块内部接口字段名（time_span/chronicle_text/…）保持不变，映射只在这一层做。

/** SQL 读取全局数据表当前时间 */
function sqlReadCurrentTime(): string | null {
  const rows = queryLogicalTableRows({
    tableName: '全局数据表',
    columns: ['当前时间'],
    where: { row_id: 1 },
    limit: 1,
  });
  if (rows === null || rows.length === 0) return null;
  const cur = rows[0]['当前时间'];
  return cur == null ? null : String(cur);
}

/** SQL 读取纪要表所有行 */
function sqlReadChronicleRows(): ChronicleRowSql[] | null {
  const rows = queryLogicalTableRows({
    tableName: '纪要表',
    columns: ['row_id', '时间跨度', '纪要'],
    orderBy: { column: 'row_id', direction: 'ASC' },
  });
  if (rows === null) return null;
  return rows.map(r => ({
    row_id: Number(r.row_id),
    time_span: r['时间跨度'] == null ? null : String(r['时间跨度']),
    chronicle_text: r['纪要'] == null ? null : String(r['纪要']),
  }));
}

/** SQL 读取备忘录表所有行 */
function sqlReadMemoRows(): MemoRowSql[] | null {
  const rows = queryLogicalTableRows({
    tableName: '备忘录',
    columns: ['row_id', '约定时间', '备忘标题'],
    orderBy: { column: 'row_id', direction: 'ASC' },
  });
  if (rows === null) return null;
  return rows.map(r => ({
    row_id: Number(r.row_id),
    appointed_time: r['约定时间'] == null ? null : String(r['约定时间']),
    memo_title: r['备忘标题'] == null ? null : String(r['备忘标题']),
  }));
}

/** SQL 批量更新备忘录表 — 结构化入队，flush 单次 API 调用执行全部 UPDATE */
async function sqlBatchUpdateMemo(updates: ChronicleUpdate[]): Promise<boolean> {
  if (updates.length === 0) return true;
  try {
    return await runDbBatch(updates.map(u => ({
      kind: 'updateCell' as const,
      tableName: '备忘录',
      rowId: u.dbRowIndex,
      colName: '备忘标题',
      value: u.newText,
    })));
  } catch { /* ignore */ }
  return false;
}

/** SQL 批量更新纪要表 — 结构化入队，flush 单次 API 调用执行全部 UPDATE */
async function sqlBatchUpdateChronicle(updates: ChronicleUpdate[]): Promise<boolean> {
  if (updates.length === 0) return true;
  try {
    return await runDbBatch(updates.map(u => ({
      kind: 'updateCell' as const,
      tableName: '纪要表',
      rowId: u.dbRowIndex,
      colName: '纪要',
      value: u.newText,
    })));
  } catch { /* ignore */ }
  return false;
}

// ===== 输入签名 =====

/** 用已读三表数据构建输入签名（主路径共享读：不重复 queryLogicalTableRows）。 */
function buildInputSignatureFromRows(
  currentTime: string,
  chronicleRows: ChronicleRowSql[],
  memoRows: MemoRowSql[],
): string {
  const todayDate = parseDateFromText(currentTime);
  const dateSig = todayDate ? `${todayDate.daySerial}` : '__no_date__';

  const chronicleSigs = chronicleRows.map(r =>
    `${r.row_id}:${normalizeText(r.time_span)}:${normalizeText(r.chronicle_text).slice(0, 30)}`
  );

  const memoSigs = memoRows.map(r =>
    `${r.row_id}:${normalizeText(r.appointed_time)}:${normalizeText(r.memo_title).slice(0, 30)}`
  );

  return `${dateSig}|C:${chronicleSigs.join('\n')}|M:${memoSigs.join('\n')}`;
}

/** 通过 querySql 构建签名（写前校验专用：需重读最新数据） */
function buildInputSignatureSql(): string | null {
  const currentTime = sqlReadCurrentTime();
  if (currentTime === null) return null;
  const chronicleRows = sqlReadChronicleRows();
  if (chronicleRows === null) return null;
  const memoRows = sqlReadMemoRows();
  if (memoRows === null) return null;
  return buildInputSignatureFromRows(currentTime, chronicleRows, memoRows);
}

// ===== 收集需要更新的行 =====

/** 用已读纪要行计算更新（共享读，不重复 queryLogicalTableRows）。 */
function collectUpdatesFromRows(rows: ChronicleRowSql[], todayDate: ParsedDate): ChronicleUpdate[] {
  const updates: ChronicleUpdate[] = [];

  for (const row of rows) {
    const timeSpan = normalizeText(row.time_span);
    if (!timeSpan) continue;

    const targetDate = parseFirstDateFromTimeSpan(timeSpan);
    if (!targetDate) continue;

    const diffDays = calculateDateDiffDays(todayDate, targetDate);
    if (diffDays === null) continue;

    const anchorText = formatRelativeDays(diffDays);
    const currentChronicle = normalizeText(row.chronicle_text);
    const baseText = stripTimeAnchorPrefix(currentChronicle);
    const newText = anchorText + baseText;

    if (newText !== currentChronicle) {
      updates.push({ dbRowIndex: row.row_id, newText });
    }
  }

  return updates;
}

// ===== 备忘录更新收集 =====

/** 用已读备忘录行计算更新（共享读）。备忘录使用「约定时间」列，按 约定时间-当前时间 计算简明日差锚定词
 *  约定时间为空则跳过该行 */
function collectMemoUpdatesFromRows(rows: MemoRowSql[], todayDate: ParsedDate): ChronicleUpdate[] {
  const updates: ChronicleUpdate[] = [];

  for (const row of rows) {
    const appointedTime = normalizeText(row.appointed_time);
    if (!appointedTime) continue;

    const targetDate = parseDateFromText(appointedTime);
    if (!targetDate) continue;

    // 约定时间 - 当前时间（与纪要表的 today-target 方向相反）
    const diffDays = calculateDateDiffDays(targetDate, todayDate);
    if (diffDays === null) continue;

    const anchorText = formatMemoAnchor(diffDays);
    const currentTitle = normalizeText(row.memo_title);
    const baseTitle = stripTimeAnchorPrefix(currentTitle);
    const newTitle = anchorText + baseTitle;

    if (newTitle !== currentTitle) {
      updates.push({ dbRowIndex: row.row_id, newText: newTitle });
    }
  }

  return updates;
}

// ===== 应用更新 =====

/** executeSqlBatch 一次性写入全部行 */
async function applyUpdatesSql(updates: ChronicleUpdate[]): Promise<boolean> {
  if (updates.length === 0) return true;
  runtime.applying = true;
  try {
    return await sqlBatchUpdateChronicle(updates);
  } finally {
    runtime.applying = false;
  }
}

/** executeSqlBatch 一次性写入备忘录全部行 */
async function applyMemoUpdatesSql(updates: ChronicleUpdate[]): Promise<boolean> {
  if (updates.length === 0) return true;
  runtime.applying = true;
  try {
    return await sqlBatchUpdateMemo(updates);
  } finally {
    runtime.applying = false;
  }
}

// ===== 主循环 =====

async function runTimeAnchorInjection(): Promise<void> {
  if (runtime.running) {
    runtime.pending = true;
    return;
  }

  runtime.running = true;
  try {
    do {
      runtime.pending = false;

      // 1. 三表各读一次（签名/收集共享读；旧实现每次全量重读 2-3 遍）
      const currentTime = sqlReadCurrentTime();
      if (currentTime === null) return;
      const todayDate = parseDateFromText(currentTime);
      if (!todayDate) return;

      const chronicleRows = sqlReadChronicleRows();
      if (chronicleRows === null) return;
      const memoRows = sqlReadMemoRows();
      if (memoRows === null) return;

      // 2. 用已读 rows 构建签名，检查是否有变化
      const sig = buildInputSignatureFromRows(currentTime, chronicleRows, memoRows);
      if (sig === runtime.lastInputSignature) return;
      runtime.lastInputSignature = sig;

      // 3. 用已读 rows 收集纪要表和备忘录需要更新的行
      const chronicleUpdates = collectUpdatesFromRows(chronicleRows, todayDate);
      const memoUpdates = collectMemoUpdatesFromRows(memoRows, todayDate);
      if (chronicleUpdates.length === 0 && memoUpdates.length === 0) return;

      // 4. 写前二次校验（仅在确有更新时重读，防止并发写覆盖；无更新无写窗口，无需校验）
      const verifySig = buildInputSignatureSql();
      if (verifySig === null) {
        runtime.lastInputSignature = null;
        return;
      }
      if (verifySig !== sig) {
        runtime.lastInputSignature = null;
        runtime.pending = true;
        continue;
      }

      // 5. 写入更新（同一批次批量操作纪要表和备忘录）
      const chronicleOk = chronicleUpdates.length > 0 ? await applyUpdatesSql(chronicleUpdates) : true;
      const memoOk = memoUpdates.length > 0 ? await applyMemoUpdatesSql(memoUpdates) : true;
      // 写入失败时重置签名，使下一 tick 重新尝试，避免更新被永久丢失
      if (!chronicleOk || !memoOk) runtime.lastInputSignature = null;
    } while (runtime.pending);
  } catch (error) {
    console.warn('[统一状态栏] 时间锚定注入失败:', error);
  } finally {
    runtime.running = false;
    runtime.applying = false;
  }
}

// ===== 公开 API =====

/** 判断数据库回调是否携带已载入的 sheet_* 快照 */
export function hasDatabaseTableSnapshot(tableData: unknown): boolean {
  if (!tableData || typeof tableData !== 'object' || Array.isArray(tableData)) return false;
  return Object.keys(tableData as Record<string, unknown>).some(key => key.startsWith('sheet_'));
}

/** 供 index.ts 的 registerUpdateListener 回调调用 */
export function handleTableUpdate(tableData?: unknown): void {
  if (!started) return;
  // 重填模式：暂停时间锚定对纪要/备忘录的回写（重填正在重写这些行，锚定写入会与之互相覆盖）。
  // 关闭后由 index.ts 恢复链按最新快照补跑一次；本函数输入签名幂等，补跑不会重复写入。
  if (isRefillMode()) return;
  const config = getConfig();
  if (!config.timeAnchorEnabled) return;
  if (!hasDatabaseTableSnapshot(tableData)) return;

  if (runtime.applying) {
    runtime.pending = true;
    return;
  }
  void runTimeAnchorInjection();
}

/** 初始化时调用 */
export function startTimeAnchor(): boolean {
  if (started) return true;
  started = true;
  return true;
}

/** pagehide 时调用 */
export function stopTimeAnchor(): void {
  started = false;
  runtime.running = false;
  runtime.pending = false;
  runtime.applying = false;
  runtime.lastInputSignature = null;
}

/** 重置时间锚定：清空签名缓存并执行一次全量更新 */
export async function resetTimeAnchors(): Promise<void> {
  runtime.lastInputSignature = null;
  await runTimeAnchorInjection();
}

/** 删除纪要表和备忘录中所有的时间锚定前缀 */
export async function deleteTimeAnchors(): Promise<{ success: boolean; count: number }> {
  const chronicleRows = sqlReadChronicleRows();
  if (chronicleRows === null) return { success: false, count: 0 };
  const chronicleToUpdate: ChronicleUpdate[] = [];

  for (const row of chronicleRows) {
    const currentText = normalizeText(row.chronicle_text);
    const stripped = stripTimeAnchorPrefix(currentText);
    if (stripped !== currentText) {
      chronicleToUpdate.push({ dbRowIndex: row.row_id, newText: stripped });
    }
  }

  const memoRows = sqlReadMemoRows();
  if (memoRows === null) return { success: false, count: 0 };
  const memoToUpdate: ChronicleUpdate[] = [];

  for (const row of memoRows) {
    const currentTitle = normalizeText(row.memo_title);
    const stripped = stripTimeAnchorPrefix(currentTitle);
    if (stripped !== currentTitle) {
      memoToUpdate.push({ dbRowIndex: row.row_id, newText: stripped });
    }
  }

  const totalCount = chronicleToUpdate.length + memoToUpdate.length;
  if (totalCount === 0) return { success: true, count: 0 };

  runtime.applying = true;
  try {
    if (chronicleToUpdate.length > 0) await sqlBatchUpdateChronicle(chronicleToUpdate);
    if (memoToUpdate.length > 0) await sqlBatchUpdateMemo(memoToUpdate);
  } finally {
    runtime.applying = false;
  }
  return { success: true, count: totalCount };
}
