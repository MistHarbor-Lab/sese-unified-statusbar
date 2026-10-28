// renderers/beyond-lens.ts
// 主界面「镜头之外」视图（2026-08-21 设计确认）：
// 页签行末尾 ◉ 镜头之外 按钮 + 面板（演化纪事最新 1 条 + 离场角色动向≤3 + 暗中打算 + 传闻≤3 + 换一批）。
// 纯 HTML 构建可单测；主题质感靠 beyond-theme-${style} 类由 beyond-lens-base.ts 差异化。
import { type StyleType } from '../core/constants';
import { getConfig } from '../core/config-store';
import { compareDateKey, monthDayOfDateKey } from '../core/calendar-core';
import { escapeHtml } from '../core/html-escape';
import { deriveRumorStatusText, timeBadgeHtml, RUMOR_LEVEL_LABEL } from '../core/world-engine/world-state';
import { loadWorldState } from '../core/world-engine/world-store';
import { type WorldState } from '../core/world-engine/world-types';

export const BEYOND_RUMOR_MAX = 3;
export const BEYOND_CHAR_MAX = 3;

/** 区标题小字（各主题氛围，纯展示文案）。 */
export const BEYOND_LABELS: Record<StyleType, { chronicleSec: string; rumorSec: string; charSec: string }> = {
  ancient: { chronicleSec: '岁月留痕', rumorSec: '市井之声', charSec: '镜头之外' },
  flirtatious: { chronicleSec: '小本记事', rumorSec: '街头八卦', charSec: '镜头之外' },
  minimal: { chronicleSec: '纪事', rumorSec: '市井', charSec: '镜头之外' },
  sweet: { chronicleSec: '甜事记', rumorSec: '街头小话', charSec: '镜头之外' },
  xianxia: { chronicleSec: '仙踪志', rumorSec: '市井流言', charSec: '镜外' },
  bridge: { chronicleSec: 'LOG', rumorSec: 'INTEL', charSec: 'OFF-SCREEN' },
  ios: { chronicleSec: '演化纪事', rumorSec: '传闻', charSec: '镜头之外' },
};

/** 镜头之外视图是否激活（index.ts 维护 window._activeBeyond；node 下返回 false）。 */
export function beyondViewActive(): boolean {
  return typeof window !== 'undefined' && !!(window as any)._activeBeyond;
}

/** 当前批次角色名（index.ts 维护 window._beyondBatch）。 */
export function beyondBatchNames(): string[] {
  if (typeof window === 'undefined') return [];
  const b = (window as any)._beyondBatch;
  return Array.isArray(b) ? b : [];
}

/** 各主题人物切换按钮的样式类（镜头之外按钮完全复用，形制/深浅色适配随主题 CSS 继承）。 */
const BEYOND_TAB_CLASS: Record<StyleType, string> = {
  ancient: 'ub-char-tab spine-label',
  flirtatious: 'tab',
  minimal: 'char-select-btn',
  sweet: 'tab',
  xianxia: 'ub-char-tab xx-char-pill',
  bridge: 'tab bridge-role-chip',
  ios: 'tab ios-persona-chip',
};

/** 镜头之外是否有可看内容（纯函数）：演化纪事、已传开传闻（heard/known）或存在离场角色。 */
export function hasBeyondContent(state: WorldState): boolean {
  if ((state.chronicle || []).length > 0) return true;
  const rumor = (state.rumors || []).some(r => r.level === 'heard' || r.level === 'known');
  const offStage = Object.values(state.profiles || {}).some(p => !p?.onStage);
  return rumor || offStage;
}

/** 镜头之外入口是否可见：世界演化开启 且 有可看内容（关闭或内容为空时隐藏按钮并退出视图）。 */
export function beyondAvailable(): boolean {
  if (getConfig().worldEnabled === false) return false;
  return hasBeyondContent(loadWorldState());
}

/** ◉ 镜头之外 页签按钮（角色页签行末尾；与人物按钮同形制，仅 ub-beyond-tab 做间距微调）。
 *  available=false（世界演化关闭或内容为空）时返回空串，按钮不渲染。 */
export function buildBeyondTabButton(style: StyleType, active: boolean, available = true): string {
  if (!available) return '';
  const base = BEYOND_TAB_CLASS[style] || 'tab';
  return `<button type="button" class="${base} ub-beyond-tab beyond-theme-${style}${active ? ' active' : ''}" data-beyond aria-label="镜头之外">◉ 镜头之外</button>`;
}

/** 镜头之外面板（替换角色档案区）。batch=批次角色名（保持此顺序，忽略不在 profiles 的名）。 */
export function buildBeyondLensHtml(style: StyleType, state: WorldState, today: string, batch: string[]): string {
  const labels = BEYOND_LABELS[style] || BEYOND_LABELS.ancient;
  // 演化纪事区：只显示最新一条（chronicle[0]，unshift 头插即最新）
  const latest = (state.chronicle || [])[0];
  const chronicleBlock = latest
    ? `<div class="ub-beyond-sec"><div class="ub-beyond-sec-title">演化纪事<em>${escapeHtml(labels.chronicleSec)}</em></div>
      <div class="ub-beyond-rumor" role="button" tabindex="0" title="打开世界窗口·台前"><div class="ub-beyond-rumor-body">${escapeHtml(latest.summary)}</div></div>
    </div>`
    : '';
  // 传闻区：只已传开（heard/known），createdAt 倒序，≤3
  const rumors = (state.rumors || [])
    .filter(r => r.level === 'heard' || r.level === 'known')
    .sort((a, b) => compareDateKey(b.createdAt || '', a.createdAt || ''))
    .slice(0, BEYOND_RUMOR_MAX);
  const rumorsBlock = rumors.length
    ? `<div class="ub-beyond-sec"><div class="ub-beyond-sec-title">传闻<em>${escapeHtml(labels.rumorSec)}</em></div>
      ${rumors.map(r => `<div class="ub-beyond-rumor" role="button" tabindex="0" title="打开世界窗口·台前"><div class="ub-beyond-rumor-top"><span class="ub-beyond-level ub-beyond-level-${escapeHtml(r.level)}">${escapeHtml(RUMOR_LEVEL_LABEL[r.level] || r.level)}</span><b>${escapeHtml(r.topic)}</b>${r.createdAt ? `<em class="ub-beyond-rumor-time">自 ${escapeHtml(monthDayOfDateKey(r.createdAt) || '')}</em>` : ''}</div><div class="ub-beyond-rumor-body">${escapeHtml(r.content)}</div><div class="ub-beyond-rumor-status">${escapeHtml(deriveRumorStatusText(r.level, Number(r.progress) || 1, typeof r.dissipation === 'number' ? r.dissipation : undefined))}</div></div>`).join('')}
    </div>`
    : '';
  // 角色动向区：仅离场池；换一批按钮仅在池>3 时显示
  // 角色动向区：仅离场池；换一批按钮仅在池>3 时显示
  const pool = Object.values(state.profiles || {}).filter(p => !p.onStage);
  const chars = batch.map(n => (state.profiles || {})[n]).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const charsBlock = chars.length
    ? `<div class="ub-beyond-sec"><div class="ub-beyond-sec-title">角色动向<em>${escapeHtml(labels.charSec)}</em>${pool.length > BEYOND_CHAR_MAX ? '<button type="button" class="ub-beyond-reshuffle" data-beyond-reshuffle>↻ 换一批</button>' : ''}</div>
      ${chars.map(p => {
        const thread = p.hiddenGoal
          ? `<div class="ub-beyond-thread"><b>暗中打算</b><span class="ub-beyond-thread-text">${escapeHtml(p.hiddenGoal)}</span>${typeof p.goalProgress === 'number' ? `<span class="ub-beyond-bar"><span style="width:${Math.max(2, Math.min(100, p.goalProgress))}%"></span></span><em class="ub-beyond-pct">${Math.round(p.goalProgress)}%</em>` : ''}</div>${p.goalProgressText ? `<div class="ub-beyond-thread-progress">${escapeHtml(p.goalProgressText)}</div>` : ''}`
          : '';
        return `<div class="ub-beyond-char" data-beyond-char-card="${escapeHtml(p.name)}" role="button" tabindex="0" title="打开世界窗口·幕后"><div class="ub-beyond-char-head"><button type="button" class="ub-beyond-char-name" data-beyond-char="${escapeHtml(p.name)}">${escapeHtml(p.name)}</button>${timeBadgeHtml(p.updatedAt, today)}</div><div class="ub-beyond-char-act">${p.activity ? escapeHtml(p.activity) : '<em class="ub-beyond-idle">如常</em>'}</div>${thread}</div>`;
      }).join('')}
    </div>`
    : '';
  const empty = !latest && !rumors.length && !chars.length
    ? '<div class="ub-beyond-empty">镜头之外，一片安静</div>'
    : '';
  return `<section class="ub-beyond-panel beyond-theme-${style}" data-ub-section="beyond">${chronicleBlock}${charsBlock}${rumorsBlock}${empty}</section>`;
}
