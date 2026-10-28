// core/world-engine/world-sources.ts
// 世界演化的真实数据源 + 双轨触发注册（v1.1：独立文件，避免 Task 7 测试加载整个 map-system）。
import { getConfig } from '../config-store';
import { getCellByHeader, getSheetByName } from '../data-manager';
import { parseProtagonistAttitude, parseCharacterRelationRows, formatRelationInjectionLines } from '../character-relation-model';
import { getCleanChatHistory, getRecentStoryContext } from '../map-system';
import { stripWithContextConfig } from '../context-strip';
import { getTodayDateKey } from '../calendar-core';
import { getTavernHelper } from '../env';
import {
  configureWorldEvolutionSources,
  isWorldPhoneBridgeAvailable,
  lastAiReplyText,
  maybeEvolve,
  type EvolutionSources,
} from './world-evolution';
import { formatChronicleBlocks, readChronicleRowsForNames } from '../chronicle-blocks';
import { decideEvolve, gapDaysBetween, selectFocusSubset, type RosterCandidate } from './world-state';
import type { CharProfile, WorldState } from './world-types';
import { DEFAULT_CHRONICLE_TOTAL } from './world-types';
import { isRefillMode } from '../refill-mode';
import { resolveWorldEvolveStyleForCurrentCard } from './world-style-library';

function readRosterCandidates(): RosterCandidate[] {
  const seen = new Set<string>();
  const out: RosterCandidate[] = [];
  let protagonist = '';
  try { protagonist = (getCellByHeader('主角信息表', 1, '姓名') || '').trim(); } catch (_e) { /* ignore */ }
  const push = (table: '重要角色表' | '恋爱对象表') => {
    const sheet = getSheetByName(table);
    if (!sheet || !Array.isArray(sheet.content)) return;
    for (let i = 1; i < sheet.content.length; i++) {
      const name = (getCellByHeader(table, i, '姓名') || '').trim();
      if (!name || name === protagonist || seen.has(name)) continue;
      seen.add(name);
      // 与主角的关系：角色表「对主角态度」列的关系段（人物关系表不再记录主角对）
      const relation = parseProtagonistAttitude(getCellByHeader(table, i, '对主角态度')).relation;
      out.push({ name, relation });
    }
  };
  push('重要角色表');
  push('恋爱对象表');
  return out;
}

function readOnStageNames(): string[] {
  const names: string[] = [];
  try {
    const sheet = getSheetByName('在场角色表');
    if (sheet && Array.isArray(sheet.content)) {
      for (let i = 1; i < sheet.content.length; i++) {
        const n = getCellByHeader('在场角色表', i, '姓名');
        if (n && String(n).trim()) names.push(String(n).trim());
      }
    }
  } catch (_e) { /* ignore */ }
  return names;
}

function readRecentNames(): string[] {
  const context = getRecentStoryContext(8);
  if (!context) return [];
  return readRosterCandidates().map(c => c.name).filter(name => context.includes(name));
}

/** 最新 AI 回复文本：优先酒馆助手 getChatMessages（纯文本、与 generateRaw 同源）；回退 SillyTavern.chat 尾部扫描。 */
function readLatestAiReply(): string {
  const th = getTavernHelper();
  if (th && typeof th.getChatMessages === 'function' && typeof th.getLastMessageId === 'function') {
    try {
      const lastId = th.getLastMessageId();
      if (typeof lastId === 'number' && lastId >= 0) {
        const msgs = th.getChatMessages(`${lastId}-${lastId}`, { role: 'assistant', hide_state: 'all', include_swipes: false }) as any[];
        const msg = Array.isArray(msgs) ? msgs[msgs.length - 1] : undefined;
        if (msg && typeof msg.message === 'string') return msg.message;
      }
    } catch (_e) { /* ignore */ }
  }
  try {
    const rawSt: any = (window as any).SillyTavern || (window as any).TavernHelper?.SillyTavern
      || (typeof parent !== 'undefined' ? (parent as any).SillyTavern : undefined);
    if (Array.isArray(rawSt?.chat)) return lastAiReplyText(rawSt.chat);
  } catch (_e) { /* ignore */ }
  return '';
}

/** 两次日期键之间的游戏内天数：已上移 world-state.ts（gapDaysBetween，线程时间差分档共用），此处 import 复用。 */

function describeTimeGap(a: string, b: string): string {
  const days = gapDaysBetween(a, b);
  if (days <= 0) return '数小时';
  if (days === 1) return '1 天';
  if (days < 7) return `${days} 天`;
  if (days < 30) return `${Math.round(days / 7)} 周`;
  return `${Math.round(days / 30)} 月`;
}

export async function readEvolutionSources(focus: CharProfile[], _state: WorldState): Promise<EvolutionSources> {
  const cfg = getConfig();
  const chronicleTotal = cfg.worldChronicleTotal ?? DEFAULT_CHRONICLE_TOTAL;
  // 纪要统一走资料块（用户定案 V3.710）：概览 70% + 完整 30%（用户确认的拆分比例）；
  // 展示统一从旧到新（时间正序，chronicle-blocks 共享层翻转）→ 前段（较旧）概览、末段（较新）完整。
  const overviewCount = Math.round(chronicleTotal * 0.7);
  const chronicleBlocks = formatChronicleBlocks(
    readChronicleRowsForNames(focus.map(p => p.name), chronicleTotal),
    { overview: overviewCount, full: chronicleTotal - overviewCount },
  );
  const recentChat = stripWithContextConfig(getCleanChatHistory(cfg.worldContextCount || 2));
  // 焦点人物之间的关系行（人物关系表；至少一侧是焦点，另一侧不限）
  const relationLines = formatRelationInjectionLines(
    parseCharacterRelationRows(getSheetByName('人物关系表')),
    { involve: focus.map(p => p.name), limit: 20 },
  );
  return { chronicleBlocks, recentChat, relations: relationLines };
}

let _evolveTimer: ReturnType<typeof setTimeout> | null = null;

/** 演化触发（防抖）：消息事件共用一个 500ms 重臂防抖。 */
function scheduleEvolve(): void {
  // 重填模式：不臂防抖（零开销），杜绝重填期间的世界演化 AI 请求与落盘。
  // 只在自动触发路径拦；世界窗口「手动演化」不经过本函数，照常可用。
  if (isRefillMode()) return;
  // 自动更新关：不臂防抖（零开销）。只拦自动触发，世界窗口「手动演化」不受影响。
  if (getConfig().worldAutoUpdate === false) return;
  if (_evolveTimer) clearTimeout(_evolveTimer);
  _evolveTimer = setTimeout(() => {
    _evolveTimer = null;
    // 二次判定：防抖窗口内（500ms）用户可能刚开启重填模式，此处再查一次避免漏网。
    if (isRefillMode()) return;
    void maybeEvolve();
  }, 500);
}

export function initWorldEvolution(): void {
  configureWorldEvolutionSources({
    round: () => {
      try {
        const ctx = (window as any).SillyTavern?.getContext?.() || (window.parent as any).SillyTavern?.getContext?.();
        return Array.isArray(ctx?.chat) ? ctx.chat.length : 0;
      } catch { return 0; }
    },
    date: () => getTodayDateKey() || '',
    enabled: () => getConfig().worldEnabled !== false,
    config: () => {
      const c = getConfig();
      // 演化风格方向：按角色卡保存（设备本地）→ 全局默认 → 通用；解析回既有的 { style, custom } 二元组
      const evolveStyle = resolveWorldEvolveStyleForCurrentCard(c);
      return {
        evolveEveryTurns: c.worldEvolveEveryTurns,
        focusMax: c.worldFocusMax,
        rotationBatch: c.worldRotationBatch,
        worldContextCount: c.worldContextCount,
        worldEvolveStyle: evolveStyle.style,
        worldEvolveStyleCustom: evolveStyle.custom,
        evolveMinReply: c.worldEvolveMinReply,
        // 小手机联动 = 用户开关 且 宿主桥在线（瑟瑟小手机正在运行）——手机不在时不注入提示词，零开销
        worldPhoneLink: c.worldPhoneLink === true && isWorldPhoneBridgeAvailable(),
      };
    },
    decide: decideEvolve,
    select: selectFocusSubset,
    onStage: readOnStageNames,
    recent: readRecentNames,
    roster: readRosterCandidates,
    gap: describeTimeGap,
    latestReply: readLatestAiReply,
    sources: readEvolutionSources,
  });

  // F4：window 令牌——模块重求值后旧闭包仍挂在宿主 eventSource 上，模块布尔挡不住第二份
  // 注册（重求值后每条 AI 回复会驱动两份演化调度 = 双倍 AI 请求风险）
  const w = window as any;
  if (w.__ub_world_evolution_bound) return;
  w.__ub_world_evolution_bound = true;
  // first_message = 酒馆在打开/新建只有开场白的聊天时（getChatResult/createNewGroupChat）对开场白
  // 发出的 MESSAGE_RECEIVED——删当前聊天（delChat→replaceCurrentChat）与开新聊天都会落到这条路，
  // 不是真实剧情回复，跳过；首轮真实回复到达后自然会触发演化。
  const skipQuiet = (type?: string) => type === 'quiet' || type === 'impersonate' || type === 'command' || type === 'extension' || type === 'first_message';
  // 只在 AI 回复（MESSAGE_RECEIVED）时触发演化——「用户消息→AI 回复」一轮完成的信号。
  // 不监听 MESSAGE_SENT：它无 type 参数无法被 skipQuiet 过滤，且在任何消息发送瞬间都触发
  // （含数据库剧情推进/自动循环点击发送按钮生成的用户输入），此时 AI 回复尚未产生，
  // 世界会在不完整的一轮上提前演化。轮数水位（decideEvolve 的 round-lastRound）本就按
  // chat.length 数，等 AI 回复到达再演化计数等价，只是不再抢在回复前跑。
  const onTurn = (_id?: unknown, type?: string) => { if (!skipQuiet(type)) { scheduleEvolve(); } };
  try {
    const rawSt: any = (window as any).SillyTavern || (window as any).TavernHelper?.SillyTavern;
    const st: any = typeof rawSt?.getContext === 'function' ? rawSt.getContext() : rawSt;
    const source = st?.eventSource;
    const types = st?.eventTypes || {};
    if (source && typeof source.on === 'function') {
      source.on(types.MESSAGE_RECEIVED || 'message_received', onTurn);
    }
  } catch (_e) { /* ignore */ }
}
