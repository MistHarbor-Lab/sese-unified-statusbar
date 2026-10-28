// ===== 货币正文提取器（[交易]/[转账]/[红包] → 记账 + 手机消息注入）=====
// 方案 §6 标签契约（方向符号：+ = 对方给主角，- = 主角支出）：
//   [交易]±金额 币种|备注      → 提取时直接入账（source='prose'）
//   [转账]+/-金额 币种|留言    → 提取时入账（in: phone-in / out: phone-out）+ 注入手机消息
//   [红包]+金额 币种|祝词      → 注入手机待拆红包（拆开才入账）
//   [红包]-金额 币种|祝词      → 发出即扣款 + 注入我发出的红包消息
// 幂等：楼层键（chatKey#mesId）记入 extractedFloors；单楼层上限 20 笔。
// 金额可带千分位逗号（100,000,000）；币种缺省回落常用货币；transfer/rp 无符号按"收到"兜底，交易无符号按"支出"兜底。
import { readStoryClockRaw } from './calendar-core';
import { getConfig } from './config-store';
import { topWindowCandidates } from './cross-window';
import { getTavernHelper } from './env';
import {
  currencyDataSnapshot, currentCurrencyFloorKey, persistCurrency, resolveCurrencyByName,
  adjustInData, pruneExtractedFloors, type CurrencyData,
} from './currency';

/** 单楼层标签上限（超出忽略并告警）。 */
const PROSE_TAGS_MAX = 20;
/** 金额上限（超出忽略并告警）：只挡「明显不是金额的长数字」（编号/时间戳被写成金额），
 *  亿级剧情金额必须能入账——旧值 100 万把 100,000,000 这类大额静默丢弃。 */
const PROSE_AMOUNT_MAX = 1e12;

/** 金额文本 → 数值：先剥千分位逗号（AI 写大额普遍带逗号，Number('100,000') 是 NaN）。 */
function parseAmountText(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

export interface CurrencyProseTag {
  kind: 'tx' | 'transfer' | 'rp';
  /** 带方向的实际记账金额（收入为正 / 支出为负；[交易] 无符号按支出兜底）。 */
  delta: number;
  /** 标签里的币种名（可空 = 常用货币）。 */
  currencyName: string;
  note: string;
}

// 备注组在句读（。，！？；、）、方括号（下一标签开始）、换行处终止，防止贪婪吞掉后续标签
// 金额组允许千分位逗号（100,000,000）——半角逗号不在币种名/备注的排除集里，旧式组会把
// 「,000,000 上品灵石」整块当成币种名 ⇒ 金额被截成 100 且币种回落到常用货币（静默记错账）。
const PROSE_TAG_RE = /\[(交易|转账|红包)\]\s*([+-]?\d[\d,]*(?:\.\d+)?)\s*([^\|\[\]\n。，！？；、]*?)\s*\|([^\[\]\n。，！？；、]*)/g;

/** 楼层正文 → 货币标签列表（纯函数；顺序 = 正文出现顺序，上限 20 笔）。 */
export function extractCurrencyTags(text: string): CurrencyProseTag[] {
  if (!text) return [];
  const out: CurrencyProseTag[] = [];
  PROSE_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PROSE_TAG_RE.exec(text)) !== null) {
    if (out.length >= PROSE_TAGS_MAX) {
      console.warn('[currency] 单楼层货币标签超过 20 笔，超出部分忽略');
      break;
    }
    const kindRaw = m[1];
    const signed = parseAmountText(m[2]);
    // m[2] 带方向符号：非法校验按绝对值判（0 丢弃；超上限只挡明显不是金额的长数字）
    if (!Number.isFinite(signed) || signed === 0) continue;
    if (Math.abs(signed) >= PROSE_AMOUNT_MAX) {
      console.warn('[currency] 标签金额超出可识别上限（1 万亿），已忽略：', m[2]);
      continue;
    }
    const currencyName = String(m[3] ?? '').trim().slice(0, 20);
    const note = String(m[4] ?? '').trim().slice(0, 80);
    const explicit = /^[+-]/.test(m[2]);
    const magnitude = Math.abs(signed);
    if (kindRaw === '交易') {
      // 无符号按支出兜底（worldbook 要求显式符号，此处仅容错）
      out.push({ kind: 'tx', delta: explicit && signed > 0 ? magnitude : -magnitude, currencyName, note });
    } else if (kindRaw === '转账') {
      // 无符号按"收到"兜底
      const incoming = explicit ? signed > 0 : true;
      out.push({ kind: 'transfer', delta: incoming ? magnitude : -magnitude, currencyName, note });
    } else {
      const incoming = explicit ? signed > 0 : true;
      out.push({ kind: 'rp', delta: incoming ? magnitude : -magnitude, currencyName, note });
    }
  }
  return out;
}

export interface ProseApplyContext {
  storyTime?: string;
  /** 楼层键（chatKey#mesId）——幂等 + 流水溯源。 */
  floorId: string;
  /** 正文说话角色（转账/红包消息注入手机时的对方名；空 = "对方"）。 */
  speaker?: string;
}

export interface ProseApplyResult {
  data: CurrencyData;
  /** 实际入账笔数（tx 全部；transfer 双向；rp 仅发出方向——收到的红包拆开才入账）。 */
  bookedCount: number;
  incomeCount: number;
  outcomeCount: number;
  /** 需注入手机的消息事件（经 __ubp_world_inject 'money' 通道）。 */
  moneyEvents: CurrencyProseTag2MoneyEvent[];
}

/** 与 UBS_phone world-link 'money' 事件同构（host 侧独立声明，禁止反向依赖手机模块）。 */
export interface CurrencyProseTag2MoneyEvent {
  kind: 'money';
  name: string;
  moneyKind: 'transfer' | 'redpacket';
  direction: 'in' | 'out';
  amount: number;
  currency?: string;
  note?: string;
}

/** 标签列表 → 数据变更 + 手机事件（纯函数；调用方负责幂等检查与持久化）。 */
export function applyProseTags(
  data: CurrencyData,
  tags: readonly CurrencyProseTag[],
  ctx: ProseApplyContext,
): ProseApplyResult {
  const speaker = (ctx.speaker || '对方').slice(0, 20);
  const result: ProseApplyResult = { data, bookedCount: 0, incomeCount: 0, outcomeCount: 0, moneyEvents: [] };
  for (const tag of tags) {
    const meta = resolveCurrencyByName(data, tag.currencyName)
      || data.currencies.find(c => c.id === data.commonId)
      || data.currencies[0]
      || null;
    if (!meta) continue;
    if (tag.kind === 'tx') {
      adjustInData(data, meta.id, tag.delta, 'prose', tag.note || '剧情变动', { storyTime: ctx.storyTime, floorId: ctx.floorId });
      result.bookedCount++;
      if (tag.delta > 0) result.incomeCount++; else result.outcomeCount++;
      continue;
    }
    if (tag.kind === 'transfer') {
      const incoming = tag.delta > 0;
      adjustInData(data, meta.id, tag.delta, incoming ? 'phone-in' : 'phone-out',
        incoming ? `转账 · 来自${speaker}（正文提取）` : `转账 · 转给${speaker}（正文提取）`,
        { storyTime: ctx.storyTime, floorId: ctx.floorId });
      result.bookedCount++;
      if (incoming) result.incomeCount++; else result.outcomeCount++;
      result.moneyEvents.push({
        kind: 'money', name: speaker, moneyKind: 'transfer', direction: incoming ? 'in' : 'out',
        amount: Math.abs(tag.delta), currency: meta.name, note: tag.note,
      });
      continue;
    }
    // 红包：收到→注入待拆（拆开入账）；发出→发出即扣款
    const incoming = tag.delta > 0;
    if (incoming) {
      result.moneyEvents.push({
        kind: 'money', name: speaker, moneyKind: 'redpacket', direction: 'in',
        amount: Math.abs(tag.delta), currency: meta.name, note: tag.note,
      });
    } else {
      adjustInData(data, meta.id, tag.delta, 'phone-out', `红包 · 发给${speaker}（正文提取）`,
        { storyTime: ctx.storyTime, floorId: ctx.floorId });
      result.outcomeCount++;
      result.bookedCount++;
      result.moneyEvents.push({
        kind: 'money', name: speaker, moneyKind: 'redpacket', direction: 'out',
        amount: Math.abs(tag.delta), currency: meta.name, note: tag.note,
      });
    }
  }
  return result;
}

// ─── IO 层：MESSAGE_RECEIVED 防抖触发（模式对齐 index.ts 玩法自动清空监听）──────

interface LatestFloor { mesId: string; text: string; name: string }

/** 最新一条 AI 楼层（技能提取器等复用；三层兜底：助手 API → SillyTavern.chat → null）。 */
export function readLatestAssistantFloor(): LatestFloor | null {
  try {
    const th = getTavernHelper();
    if (th && typeof th.getLastMessageId === 'function' && typeof th.getChatMessages === 'function') {
      const lastId = th.getLastMessageId();
      if (typeof lastId === 'number' && lastId >= 0) {
        const messages = th.getChatMessages(`${lastId}-${lastId}`, { role: 'assistant', hide_state: 'all', include_swipes: false }) as any[];
        const m = Array.isArray(messages) ? messages[0] : null;
        if (m && typeof m.message === 'string' && m.message.trim()) {
          return { mesId: String(lastId), text: m.message, name: String((m as any).name || '') };
        }
      }
    }
  } catch (_e) { /* fallthrough */ }
  try {
    const chat = (window as any).SillyTavern?.chat;
    if (Array.isArray(chat)) {
      for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i];
        if (m && !m.is_user && typeof m.mes === 'string' && m.mes.trim()) {
          return { mesId: String(i), text: m.mes, name: String(m.name || '') };
        }
      }
    }
  } catch (_e) { /* ignore */ }
  return null;
}

/** 单轮提取：最新 AI 楼层 → 标签解析 → 记账 + 手机注入（幂等；无标签零写入）。 */
export async function runCurrencyProseExtraction(): Promise<void> {
  if (getConfig().currencyEnabled !== true) return;
  const floor = readLatestAssistantFloor();
  if (!floor) return;
  const data = currencyDataSnapshot();
  const floorKey = currentCurrencyFloorKey(floor.mesId);
  if (data.extractedFloors[floorKey]) return;
  const tags = extractCurrencyTags(floor.text);
  if (!tags.length) return; // 无标签：不标记、不写入（解析 O(正文) 且无副作用）
  let storyTime: string | undefined;
  try {
    const t = readStoryClockRaw();
    if (t) storyTime = String(t).slice(0, 60);
  } catch (_e) { /* ignore */ }
  const result = applyProseTags(data, tags, { storyTime, floorId: floorKey, speaker: floor.name });
  result.data.extractedFloors[floorKey] = true;
  pruneExtractedFloors(result.data); // F39(十一轮)：滚动窗口 10 层，标记不再无界增长
  persistCurrency(result.data);
  if (result.moneyEvents.length) injectMoneyEvents(result.moneyEvents);
  if (result.bookedCount || result.moneyEvents.length) {
    console.info(`[currency] 正文提取：入账 ${result.bookedCount} 笔（收入 ${result.incomeCount} / 支出 ${result.outcomeCount}），手机消息 ${result.moneyEvents.length} 条`);
  }
}

/** 注入手机（'money' 事件经既有 world-link 通道落库；手机未装载=静默跳过）。
 *  F65(第十二轮)：改双窗探测（本层 + 宿主窗口候选）——原单窗 `window.__ubp_world_inject` 在
 *  「状态栏在 iframe、手机把桥注册在 parent」的拓扑下永远探空，而记账在前 ⇒ 账本有这笔、
 *  手机聊天里没有这条（静默不一致）。同仓先例：world-evolution 的探测、currency-worldbook 的探测。 */
function injectMoneyEvents(events: readonly CurrencyProseTag2MoneyEvent[]): void {
  const payload = events.slice(0, 8);
  for (const w of topWindowCandidates()) {
    try {
      const inject = (w as { __ubp_world_inject?: (e: unknown) => void }).__ubp_world_inject;
      if (typeof inject === 'function') { inject(payload); return; }
    } catch (_e) { /* 跨窗异常：继续试下一个候选 */ }
  }
}

/** MESSAGE_RECEIVED 监听注册（幂等；currencyEnabled 关闭时回调首行即返，零成本常驻）。 */
export function initCurrencyProseTrigger(): void {
  const w = window as any;
  if (w.__ub_currency_prose_bound) return;
  try {
    const rawSt = w.SillyTavern || w.TavernHelper?.SillyTavern;
    const st: any = typeof rawSt?.getContext === 'function' ? rawSt.getContext() : rawSt;
    const eventSource = st?.eventSource;
    const eventTypes = st?.eventTypes;
    const msgReceived = eventTypes?.MESSAGE_RECEIVED as string | undefined;
    if (!eventSource || typeof eventSource.on !== 'function' || !msgReceived) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    eventSource.on(msgReceived, (_messageId: number, type: string) => {
      if (type === 'quiet' || type === 'impersonate' || type === 'command' || type === 'extension') return;
      if (getConfig().currencyEnabled !== true) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void runCurrencyProseExtraction().catch(e => console.warn('[currency] 正文提取失败:', e?.message || e));
      }, 800);
    });
    w.__ub_currency_prose_bound = true;
  } catch (_e) { /* 宿主事件 API 不可用时保持未绑定 */ }
}
