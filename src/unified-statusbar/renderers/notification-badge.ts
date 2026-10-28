// ===== 通知徽章系统 v4 =====
// v4: 会话型未读——按聊天键控重锚 + 按行身份（row_id）判定新增，取代旧「行数差值累计」。
// 修复三病根：①模块态无聊天维度，切卡把旧卡基线差值当新卡新增（凭空亮徽章）；
// ②过渡期空快照把基线锚成 0，真实数据到达后凭空跳 N（重进/切卡乱跳）；
// ③行数差值模型按「表末尾 N 行」取新名单：中间插入错标旧行、备忘漏报、
//   先删后增序列虚增、删除不回冲致数字虚高。
// 语义（2026-09-12 用户拍板）：会话型不持久化——刷新/切卡重锚，存量不计新增；
// 任务保留状态型（已完成未结算持续显示直到结算删除，只反映当前卡）；既有行修改不触发。
import { getSheetByName, getSheetCacheChatKey } from '../core/data-manager';
import { getCurrentStoryChatKey } from '../core/story-floor-store';
import { type StyleType } from '../core/constants';

// ===== 单表未读状态（会话内存态，切卡即重锚，不持久化） =====
interface TableUnread {
  /** 徽章数字 = 当前存在且未读的行身份集合；clearBadge（点开弹窗）清空。 */
  count: Set<string>;
  /** 弹窗高亮行身份集合；clearNewHighlights（弹窗渲染后）清空——与 count 清除时机不同，故独立。 */
  highlight: Set<string>;
  /** 上一有效 tick 的行身份快照，增量判定基准。 */
  lastIds: Set<string>;
}

const _unread: Record<'item' | 'memo', TableUnread> = {
  item: { count: new Set(), highlight: new Set(), lastIds: new Set() },
  memo: { count: new Set(), highlight: new Set(), lastIds: new Set() },
};

// 任务保留状态型：已完成未结算计数 + 名单，每个有效 tick 按当前表全量重算（无「已看」概念）
let _missionCount = 0;
const _missionNames = new Set<string>();

// 已锚定的聊天键（'' = 尚未锚定/欢迎页）
let _badgeChatKey = '';

// 未读行→名称 的派生缓存：isNewX 在弹窗渲染中逐行调用，全表现扫每次 O(N) 会放大成
// O(N²)；缓存使每次弹窗渲染只现扫一次。失效点 = checkNotifications 每 tick 开头 +
// clearNewHighlights（两处都是 highlight 集合的唯一变更点，缓存不可能越过它们变陈旧）。
const _hlNamesCache: Partial<Record<'item' | 'memo', Set<string>>> = {};

/** 行身份：首列 row_id（整数主键，insertNode 恒 MAX+1）优先；缺失/非法时回退整行内容指纹。 */
function rowIdentity(row: string[]): string {
  const cell = String((row || [])[0] ?? '').trim();
  if (/^\d+$/.test(cell)) return 'r' + cell;
  return 'f' + (row || []).join('\x01');
}

function currentRowIds(sheetName: string): Set<string> {
  const sheet = getSheetByName(sheetName);
  const rows = sheet ? sheet.content : [];
  const ids = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i]) continue;
    ids.add(rowIdentity(rows[i]));
  }
  return ids;
}

/** 切卡/首载重锚：新卡存量不计新增（对齐成就系统 rebaseAchievementBaselines 哲学）。 */
function anchorTable(sheetName: string, state: TableUnread): void {
  state.lastIds = currentRowIds(sheetName);
  state.count.clear();
  state.highlight.clear();
}

/** 身份增量判定：新增行入未读，消失行从未读修剪（徽章数恒 = 当前真实存在且未读的行数）。 */
function diffUnread(sheetName: string, state: TableUnread): void {
  const current = currentRowIds(sheetName);
  for (const id of current) {
    if (!state.lastIds.has(id)) {
      state.count.add(id);
      state.highlight.add(id);
    }
  }
  for (const id of state.count) {
    if (!current.has(id)) state.count.delete(id);
  }
  for (const id of state.highlight) {
    if (!current.has(id)) state.highlight.delete(id);
  }
  state.lastIds = current;
}

/** 任务状态重算：与旧版逐字同语义（名称非空且完成情况==='已完成'）。
 *  O7：列索引解析一次（此前每行 2 次 getCellByHeader = 每行 2 次 headers.indexOf 全列扫描）。 */
function recomputeMission(): void {
  _missionCount = 0;
  _missionNames.clear();
  const sheet = getSheetByName('瑟瑟任务表');
  const rows = sheet ? sheet.content : [];
  if (rows.length < 2) return;
  const headers = rows[0] || [];
  const nameIdx = headers.indexOf('任务名称');
  const statusIdx = headers.indexOf('完成情况');
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const name = (nameIdx >= 0 ? row[nameIdx] : null) || '';
    const status = (statusIdx >= 0 ? row[statusIdx] : null) || '';
    if (name && status === '已完成') {
      _missionCount++;
      _missionNames.add(name);
    }
  }
}

/** O7 表指纹：行数 + 首末行身份。row_id 表的中间行编辑不改变任何行身份 ⇒ 指纹不变 ⇔
 *  行身份集合必然未变，可安全跳过全表重扫（首末行身份已覆盖增/删/换行形态）。
 *  仅无 row_id 回退整行指纹的异常行才依赖中间内容——该路径编辑不再亮徽章，
 *  与「既有行修改不触发」的 v4 语义同向。 */
function tableFingerprint(sheetName: string): string {
  const sheet = getSheetByName(sheetName);
  const rows = sheet ? sheet.content : [];
  if (!rows || rows.length < 2) return String(rows ? rows.length : 0);
  return `${rows.length}|${rowIdentity(rows[1])}|${rowIdentity(rows[rows.length - 1])}`;
}

let _itemFingerprint = '';
let _memoFingerprint = '';

/** 检测变动并更新徽章。仅在「缓存确属当前聊天」的有效快照下判定：
 *  欢迎页/过渡期（chatKey 暂空）与旧卡残留缓存（打标键不一致）一律零开销早退，
 *  杜绝把过渡期数据锚成基线。 */
export function checkNotifications(): void {
  try {
    _hlNamesCache.item = undefined;
    _hlNamesCache.memo = undefined;
    const chatKey = getCurrentStoryChatKey();
    if (!chatKey || getSheetCacheChatKey() !== chatKey) return;
    if (chatKey !== _badgeChatKey) {
      _badgeChatKey = chatKey;
      anchorTable('物品表', _unread.item);
      anchorTable('备忘录', _unread.memo);
      _itemFingerprint = tableFingerprint('物品表');
      _memoFingerprint = tableFingerprint('备忘录');
    } else {
      // O7：指纹未变 ⇒ 行身份集合必然未变，跳过全表重扫（diffUnread 此时必为零变化）
      const itemFp = tableFingerprint('物品表');
      const memoFp = tableFingerprint('备忘录');
      if (itemFp !== _itemFingerprint) {
        _itemFingerprint = itemFp;
        diffUnread('物品表', _unread.item);
      }
      if (memoFp !== _memoFingerprint) {
        _memoFingerprint = memoFp;
        diffUnread('备忘录', _unread.memo);
      }
    }
    recomputeMission();
  } catch (e) { /* 静默 */ }
}

/** 获取徽章计数 */
export function getBadgeCount(type: string): number {
  if (type === 'mission') return _missionCount;
  return _unread[type as 'item' | 'memo']?.count.size || 0;
}

/** 从未读行身份现查名称（每次现扫当前表，名单永不腐烂——旧行为是检测时快照、会残留已删/改名行）。 */
function unreadHighlightNames(sheetName: string, nameCols: string[], fallback: string, ids: Set<string>): Set<string> {
  const names = new Set<string>();
  if (ids.size === 0) return names;
  const sheet = getSheetByName(sheetName);
  if (!sheet) return names;
  const headers = sheet.content[0] || [];
  const colIdx: number[] = [];
  for (const col of nameCols) {
    const idx = headers.indexOf(col);
    if (idx !== -1) colIdx.push(idx);
  }
  for (let i = 1; i < sheet.content.length; i++) {
    const row = sheet.content[i];
    if (!row || !ids.has(rowIdentity(row))) continue;
    let name = '';
    for (const ci of colIdx) {
      const v = row[ci];
      if (v) { name = v; break; }
    }
    names.add(name || fallback);
  }
  return names;
}

/** 判断名称是否为新增（未读高亮）——派生缓存使弹窗逐行查询为 O(1) */
export function isNewItem(name: string): boolean {
  if (!_hlNamesCache.item) _hlNamesCache.item = unreadHighlightNames('物品表', ['物品名称'], '未知物品', _unread.item.highlight);
  return _hlNamesCache.item.has(name);
}
export function isNewMission(name: string): boolean {
  return _missionNames.has(name);
}
export function isNewMemo(name: string): boolean {
  if (!_hlNamesCache.memo) _hlNamesCache.memo = unreadHighlightNames('备忘录', ['备忘标题', '事件名称', '名称'], '未命名', _unread.memo.highlight);
  return _hlNamesCache.memo.has(name);
}

/** 清除徽章计数（保留高亮供弹窗渲染使用；任务为状态驱动无可清） */
export function clearBadge(type: string): void {
  if (type === 'mission') return;
  _unread[type as 'item' | 'memo']?.count.clear();
}
/** 清除新内容名单（弹窗关闭后调用，确保下次打开不再高亮；任务高亮持续到条目删除） */
export function clearNewHighlights(type: string): void {
  if (type === 'mission') return;
  _unread[type as 'item' | 'memo']?.highlight.clear();
  _hlNamesCache[type as 'item' | 'memo'] = undefined;
}

// ===== 徽章 HTML =====

function badgeMarkup(count: number, className: string): string {
  if (count <= 0) return '';
  return '<span class="ub-badge ' + className + '">' + (count > 99 ? '99+' : count) + '</span>';
}

const _badgeClass: Record<string, string> = {
  ancient: 'ub-badge-ancient', flirtatious: 'ub-badge-flirtatious',
  minimal: 'ub-badge-minimal', sweet: 'ub-badge-sweet', xianxia: 'ub-badge-xianxia',
  bridge: 'ub-badge-bridge', ios: 'ub-badge-ios',
};

export function itemBadgeHTML(style: StyleType): string {
  return badgeMarkup(getBadgeCount('item'), _badgeClass[style] || _badgeClass.ancient);
}
export function missionBadgeHTML(style: StyleType): string {
  return badgeMarkup(getBadgeCount('mission'), _badgeClass[style] || _badgeClass.ancient);
}
export function memoBadgeHTML(style: StyleType): string {
  return badgeMarkup(getBadgeCount('memo'), _badgeClass[style] || _badgeClass.ancient);
}
