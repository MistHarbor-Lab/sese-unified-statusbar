// ===== 过往经历时间轴 HTML 构建器 =====
// 生成左侧轴竖向时间轴 HTML：背景介绍块置顶 + 按日期分组 + 每条记录独立卡片各带圆点。
// 仅产 HTML 字符串，不碰 DOM。主题差异由 CSS（styles/*.ts 的 pe-* 规则）承担。
import { parsePastExperience } from '../core/past-experience-parser';
import type { StyleType } from '../core/constants';
import { escapeHtml as esc } from '../core/html-escape';

export function buildPastExperienceHTML(charName: string, style: StyleType, pastExp: string): string {
  const { intro, days } = parsePastExperience(pastExp);
  const titleSuffix = style === 'ancient' ? ' 的往事' : style === 'bridge' ? ' 的航行档案' : ' 的过往经历';

  let html = '<div class="panel-popup ub-popup--l'
    + (style === 'bridge' ? ' bridge-window bridge-module-timeline bridge-timeline' : '') + '">';
  html += '<div class="panel-popup-head"><div class="panel-popup-title">' + esc(charName) + titleSuffix + '</div><button class="panel-popup-close" id="panelClose">&times;</button></div>';
  html += '<div class="panel-popup-body">';

  if (intro) {
    html += '<div class="pe-intro"><div class="pe-intro-label">人物背景</div><p class="pe-intro-text">' + esc(intro) + '</p></div>';
  }

  if (days.length > 0) {
    html += '<div class="pe-rail">';
    for (const day of days) {
      html += '<div class="pe-daygroup"><div class="pe-date">' + esc(day.dateLabel) + '</div>';
      for (const entry of day.entries) {
        if (!entry) continue;
        html += '<div class="pe-node"><div class="pe-dot"></div><div class="pe-card"><p>' + esc(entry) + '</p></div></div>';
      }
      html += '</div>';
    }
    html += '</div>';
  }

  html += '</div></div>';
  return html;
}
