// ===== 月信与孕育系统 · 强制决策弹窗（统一决策队列） =====

import { getCurrentStoryChatKey } from '../core/story-floor-store';
import {
  enqueueSystemDecision,
  invalidateSystemDecisions,
  SYSTEM_DECISION_PRIORITY,
} from '../core/system-decision-queue';
import { normalizeCycleName } from '../core/cycle-eligibility';
// eslint-disable-next-line import-x/no-cycle -- cycle-debt: 04 待修：同上（与 cycle-engine 的双向依赖）——本文件从它取跳转摘要合并结果与类型
import { mergeJumpSummariesByName, type JumpSummary } from '../core/cycle-engine';
import type { SystemDecisionView, SystemDecisionViewHost } from './system-decision-popup';
import { escapeHtmlAttr as escapeHtml } from '../core/html-escape';

/** 受孕防护形式。系数见 cycle-engine.protectionFactorForForm。 */
export type SexForm = 'unprotected' | 'withdrawal' | 'condom';

interface JumpSummaryDecisionView extends SystemDecisionView {
  summaries: JumpSummary[];
}

/**
 * 人物失去周期资格时，立即移除其已经 active/pending 的经期决策。
 * 跳跃摘要可能合并多人，因此命中其中一人时整项失效；引擎随后会用持久层中
 * 已过滤的摘要重新入队，避免保留旧人物信息，也不会吞掉其他人物摘要。
 */
export function invalidateCycleDecisionsForName(nameOrKey: string): void {
  const key = normalizeCycleName(nameOrKey);
  if (!key) return;
  invalidateSystemDecisions(item => {
    if (item.key.startsWith('cycle-sex-form:') || item.key.startsWith('cycle-pregnancy:')) {
      return item.key.endsWith(`:${key}`);
    }
    if (!item.key.startsWith('cycle-jump-summary:')) return false;
    const summaries = (item.payload as JumpSummaryDecisionView | undefined)?.summaries;
    return Array.isArray(summaries)
      && summaries.some(summary => normalizeCycleName(summary.name) === key);
  });
}

function decisionKey(kind: string, suffix: string, contextKey: string): string {
  return `cycle-${kind}:${contextKey}:${suffix}`;
}

function bindChoiceButtons(host: SystemDecisionViewHost, selector: string, readChoice: (button: HTMLElement) => unknown): void {
  host.body.querySelectorAll(selector).forEach(element => {
    element.addEventListener('click', () => {
      void host.submit(readChoice(element as HTMLElement));
    });
  });
}

/**
 * 受孕形式确认。进入队列即视为已接管，不能通过点击背景或 Escape 跳过。
 */
export function showSexFormPopup(
  charName: string,
  onResolve: (form: SexForm) => void | Promise<void>,
  stableSuffix = charName,
  isValid: () => boolean = () => true,
): boolean {
  const contextKey = getCurrentStoryChatKey();
  const safeName = escapeHtml(charName);
  const view: SystemDecisionView = {
    title: '亲密记录',
    bodyHtml: `
      <div class="cycle-popup-text">检测到与 <b>${safeName}</b> 的亲密互动。剧情中采取了哪种防护形式？</div>
      <div class="cycle-popup-sub">（仅作前端孕育模拟参考，不影响剧情走向）</div>
      <div class="cycle-form-btns">
        <button class="cycle-form-btn" data-form="condom"><span class="cf-label">安全套</span><span class="cf-note">低风险</span></button>
        <button class="cycle-form-btn" data-form="withdrawal"><span class="cf-label">体外</span><span class="cf-note">中风险</span></button>
        <button class="cycle-form-btn" data-form="unprotected"><span class="cf-label">无防护</span><span class="cf-note">高风险</span></button>
      </div>`,
    bind: host => bindChoiceButtons(host, '.cycle-form-btn[data-form]', button => button.dataset.form as SexForm),
  };
  const status = enqueueSystemDecision<SystemDecisionView, SexForm>({
    key: decisionKey('sex-form', stableSuffix, contextKey),
    contextKey,
    priority: SYSTEM_DECISION_PRIORITY.sexForm,
    payload: view,
    isValid: () => getCurrentStoryChatKey() === contextKey && isValid(),
    resolve: async form => {
      try {
        await onResolve(form);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  });
  return status !== 'ignored';
}

/** 验孕确认。结果已经由引擎落定，本弹窗只负责强制告知。 */
export function showPregnancyTestPopup(
  charName: string,
  onConfirm: () => void,
  stableSuffix = charName,
  isValid: () => boolean = () => true,
): boolean {
  const contextKey = getCurrentStoryChatKey();
  const safeName = escapeHtml(charName);
  const view: SystemDecisionView = {
    title: '月信推迟',
    bodyHtml: `
      <div class="cycle-popup-text"><b>${safeName}</b> 的月信似乎迟迟未至。要确认一下吗？</div>
      <div class="cycle-popup-sub">（结果早已注定，这只是一个知晓的时刻）</div>
      <div class="cycle-form-btns">
        <button class="cycle-form-btn cycle-form-single" data-act="confirm"><span class="cf-label">验孕</span></button>
      </div>`,
    bind: host => bindChoiceButtons(host, '.cycle-form-btn[data-act="confirm"]', () => 'confirm'),
  };
  const status = enqueueSystemDecision<SystemDecisionView, string>({
    key: decisionKey('pregnancy', stableSuffix, contextKey),
    contextKey,
    priority: SYSTEM_DECISION_PRIORITY.pregnancy,
    payload: view,
    isValid: () => getCurrentStoryChatKey() === contextKey && isValid(),
    resolve: () => {
      try {
        onConfirm();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  });
  return status !== 'ignored';
}

function describeMilestones(ids: string[]): string {
  const out: string[] = [];
  if (ids.includes('trimester_2')) out.push('进入孕中期');
  if (ids.includes('first_kick')) out.push('初次胎动');
  if (ids.includes('trimester_3')) out.push('进入孕晚期');
  return out.join(' · ');
}

function buildJumpSummaryView(summaries: JumpSummary[]): JumpSummaryDecisionView {
  const maxGap = Math.max(...summaries.map(summary => summary.gap));
  let rows = '';
  for (const summary of summaries) {
    const parts: string[] = [];
    if (summary.newPeriodStarts.length === 1) {
      parts.push(`<span class="cj-detail">月信自 <span class="cj-date">${escapeHtml(summary.newPeriodStarts[0])}</span></span>`);
    } else if (summary.newPeriodStarts.length > 1) {
      parts.push(`<span class="cj-detail">月信来了 ${summary.newPeriodStarts.length} 次 <span class="cj-date">${escapeHtml(summary.newPeriodStarts[0])} 起</span></span>`);
    }
    if (summary.pregnancyDelta === 'conceived') {
      parts.push(`<span class="cj-detail">悄然受孕（孕 ${summary.pregnancyToWeeks ?? 1} 周）</span>`);
    } else if (summary.pregnancyDelta === 'progressed') {
      const fromWeeks = summary.pregnancyFromWeeks ?? 1;
      const toWeeks = summary.pregnancyToWeeks ?? fromWeeks;
      const milestones = summary.newMilestones.length > 0 ? ` · ${describeMilestones(summary.newMilestones)}` : '';
      parts.push(`<span class="cj-detail">孕期推进 孕${fromWeeks}→${toWeeks}周${milestones}</span>`);
    } else if (summary.pregnancyDelta === 'delivered') {
      parts.push('<span class="cj-detail">分娩（新生命降临）</span>');
    }
    if (parts.length > 0) {
      rows += `<div class="cycle-jump-row"><span class="cj-name">${escapeHtml(summary.name)}</span>${parts.join('')}</div>`;
    }
  }
  return {
    summaries,
    title: '⌛ 时光荏苒',
    bodyHtml: `
      <div class="cycle-jump-intro">这 ${maxGap} 日里，发生了些许变化——</div>
      <div class="cycle-jump-list">${rows}</div>
      <div class="cycle-form-btns">
        <button class="cycle-form-btn cycle-form-single" data-act="acknowledge"><span class="cf-label">知道了</span></button>
      </div>`,
    bind: host => bindChoiceButtons(host, '.cycle-form-btn[data-act="acknowledge"]', () => 'acknowledge'),
  };
}

/** 时间跳跃摘要。同一聊天中的待展示摘要会合并为一个队列项。 */
export function showJumpSummaryPopup(
  summaries: JumpSummary[],
  onAcknowledge: () => void = () => undefined,
  stableSuffix = 'pending',
  isValid: () => boolean = () => true,
): boolean {
  if (!summaries || summaries.length === 0) return false;
  const contextKey = getCurrentStoryChatKey();
  const status = enqueueSystemDecision<JumpSummaryDecisionView, string>({
    key: decisionKey('jump-summary', stableSuffix, contextKey),
    contextKey,
    priority: SYSTEM_DECISION_PRIORITY.jumpSummary,
    payload: buildJumpSummaryView(summaries),
    isValid: () => getCurrentStoryChatKey() === contextKey && isValid(),
    resolve: () => {
      try {
        onAcknowledge();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    merge: (current, incoming) => {
      const combined = mergeJumpSummariesByName([...current.payload!.summaries, ...incoming.payload!.summaries]);
      current.payload = buildJumpSummaryView(combined);
    },
  });
  return status !== 'ignored';
}
