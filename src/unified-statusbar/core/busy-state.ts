// core/busy-state.ts
// F22 统一 AI 等待态：按钮内置旋转指示 + 禁用 + 原内容保存/恢复。
// 各 AI 弹窗原有的「按钮换字 / 状态行 / 灰字」等待呈现各说各话（全项目零 spinner），
// 本零件只接管「触发按钮」这一层：视觉统一为 ub-busy-spin + 文案，disabled 语义与各站原逻辑一致。
// 位置在 core（供 calendar-ai / shop-story-ai 等 core 模块使用，避免 core→renderers 反向依赖；
// 小型 DOM 工具入 core 有 dom-refs.ts 先例）。旋转指示的 CSS 在 styles/base.ts（.ub-busy-spin）。

import { escapeHtml } from './html-escape';

const BUSY_ORIG = new WeakMap<HTMLElement, string>();

/** 旋转指示片段（供 HTML 串期拼装与自定义流程使用；aria-hidden 装饰语义）。 */
export function busySpinnerHtml(): string {
  return '<span class="ub-busy-spin" aria-hidden="true"></span>';
}

/**
 * 把按钮置为忙碌态（保存原内容、禁用、注入旋转指示+文案）；busy=false 恢复。
 * restoreText 可选：恢复时不取保存前的内容，而是显式指定文案（供忙碌期间语义变化的按钮，
 * 如立绘面板 start/regen 两态文案）。
 */
type Disableable = HTMLElement & { disabled: boolean };

function asDisableable(el: HTMLElement | null): Disableable | null {
  return el && 'disabled' in el ? (el as Disableable) : null;
}

export function setButtonBusy(btn: HTMLElement | null, busy: boolean, busyLabel: string, restoreText?: string): void {
  const b = asDisableable(btn);
  if (!btn) return;
  if (busy) {
    if (!BUSY_ORIG.has(btn)) BUSY_ORIG.set(btn, btn.innerHTML);
    if (b) b.disabled = true;
    btn.innerHTML = busySpinnerHtml() + escapeHtml(busyLabel);
  } else {
    const orig = BUSY_ORIG.get(btn);
    BUSY_ORIG.delete(btn);
    if (orig != null) btn.innerHTML = orig;
    if (restoreText != null) btn.textContent = restoreText;
    if (b) b.disabled = false;
  }
}
