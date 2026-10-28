// ===== 月信与孕育系统 · 渲染层（经期进度条 + 孕周进度条 + CSS 注入） =====
// 详见 docs/经期孕期功能设计.md §5.1（角色卡进度条）/ §5.8（主题化文案）
//
// 自包含 cycle-* class 结构，由 styles/cycle-base.ts 全程主题变量着色，5 主题表现一致。
// cyclePhaseBar 同时供 NPC 角色卡与主角信息区使用（主角传主角信息表姓名，走同一
// roster 解析/孕期条替代/管理弹窗交互）。
// off 真零开销：cycleMode==='off' 时 cyclePhaseBar 返回 ''、injectCycleCSS 移除 style。
import { getConfig } from '../core/config-store';
import { ensureStyleOnce } from './style-once';
import { type StyleType } from '../core/constants';
import {
  type CyclePhase,
  getCycleRenderInfo,
  resolveCycleKeyByCharName,
} from '../core/cycle-engine';
import { CYCLE_BASE_CSS } from '../styles/cycle-base';
import { escapeAttr } from '../core/html-escape';

// ═══════════════════════════════════════════════════════════════
// 主题化文案（§5.8）
// ═══════════════════════════════════════════════════════════════

/** F46(第十二轮)：分区名常量——NPC 位与主角位必须区分，同一产物内分区键唯一。 */
export const CYCLE_SECTION = 'charcycle';
export const PROTAGONIST_CYCLE_SECTION = 'charcycle-protag';

const PHASE_LABEL: Record<StyleType, Record<CyclePhase, string>> = {
  ancient:     { menstrual: '月信',       follicular: '身子清明', ovulation: '氤氲之期',   luteal: '将临月信' },
  flirtatious: { menstrual: '那几天',      follicular: '清明',    ovulation: '想要的日子', luteal: '将临' },
  minimal:     { menstrual: '经期',       follicular: '卵泡期',  ovulation: '易孕期',    luteal: '黄体期' },
  sweet:       { menstrual: '小红的日子',  follicular: '清明',    ovulation: '危险期', luteal: '将临' },
  xianxia:     { menstrual: '红尘劫',      follicular: '清明',    ovulation: '桃花期',    luteal: '将临' },
  bridge:      { menstrual: '周期红区',    follicular: '低风险段', ovulation: '高风险段', luteal: '待机段' },
  ios:         { menstrual: '经期',       follicular: '卵泡期',  ovulation: '易孕期',    luteal: '黄体期' },
};

/** 孕期主题化文案（§5.8 孕期行）。 */
const PREG_LABEL: Record<StyleType, string> = {
  ancient: '有喜',
  flirtatious: '中奖了',
  minimal: '妊娠中',
  sweet: '她有了✨',
  xianxia: '仙胎',
  bridge: '孕程',
  ios: '妊娠中',
};

/** 周期条排卵高危前缀符号（每主题自成语汇）。 */
const HIGH_RISK_SYMBOL: Record<StyleType, string> = {
  ancient: '◆',
  flirtatious: '💗',
  sweet: '💕',
  xianxia: '🌸',
  minimal: '◆',
  bridge: '▲',
  ios: '◆',
};

function cycleManagerLabel(text: string, charName: string): string {
  const safeName = escapeAttr(charName);
  return '<button type="button" class="cycle-label cycle-manage-trigger" data-cycle-name="' + safeName
    + '" aria-label="查看并调整' + safeName + '的经期参数">' + text + '</button>';
}

// ═══════════════════════════════════════════════════════════════
// 角色卡经期进度条
// ═══════════════════════════════════════════════════════════════

/**
 * 周期进度条（NPC 角色卡与主角信息区共用）：验孕确认前只显示玩家认知中的周期条，
 * 确认后由孕期条替代。NPC 传在场角色表姓名、主角传主角信息表姓名，均按姓名键
 * 反查 roster 匹配周期记录（不在 roster 的在场角色不显示，符合「在场 NPC 默认不追踪」）。
 * off / cycleShowBar 关 / 无记录 → 返回空串。
 *
 * F46(第十二轮)：分区名按调用位区分——同一份产物里主角条与 NPC 条同时存在，
 * 若共用一个 data-ub-section 键，分区表的「唯一键数」永远小于「元素数」⇒ 每帧判结构变化
 * ⇒ 整根重建（第十一轮分区渲染的收益全丢）。主角位传 PROTAGONIST_CYCLE_SECTION。
 */
export function cyclePhaseBar(
  activeChar: string | null | undefined,
  style: StyleType,
  sectionKey: string = CYCLE_SECTION,
): string {
  if (getConfig().cycleMode === 'off') return '';
  if (!getConfig().cycleShowBar) return ''; // 用户选择隐藏周期进度条（经期条/孕期条均不显示）
  if (!activeChar) return '';
  const key = resolveCycleKeyByCharName(activeChar);
  if (!key) return '';
  const info = getCycleRenderInfo(key);
  if (!info) return '';

  // getCycleRenderInfo 仅在玩家已验孕确认时暴露 pregnancy。
  if (info.pregnancy) {
    return buildPregnancyBarHtml(info.pregnancy, style, activeChar, sectionKey);
  }

  const label = PHASE_LABEL[style][info.phase];
  const highRiskPrefix = info.isHighRisk ? '<span class="cycle-high-risk">' + HIGH_RISK_SYMBOL[style] + '</span>' : '';
  const pct = Math.max(2, Math.min(100, Math.round((info.daysIntoCycle / info.cycleLength) * 100)));
  const valueText = info.isOnPeriod
    ? `第${info.dayOfPeriod}天 · ${label}`
    : `${info.daysIntoCycle}/${info.cycleLength} · ${label}`;
  const bridgeClass = style === 'bridge' ? ' bridge-cycle-indicator' : '';

  return (
    '<div class="cycle-bar cycle-phase-' + info.phase + bridgeClass + '" data-ub-section="' + sectionKey + '">' +
      cycleManagerLabel(highRiskPrefix + '周期', activeChar) +
      '<div class="cycle-track">' +
        '<div class="cycle-fill" style="width:' + pct + '%"></div>' +
      '</div>' +
      '<span class="cycle-value">' + valueText + '</span>' +
    '</div>'
  );
}

/** 孕周进度条（40 周进度，仅孕期显示）。 */
function buildPregnancyBarHtml(
  p: NonNullable<ReturnType<typeof getCycleRenderInfo>>['pregnancy'],
  style: StyleType,
  charName: string,
  sectionKey: string = CYCLE_SECTION,
): string {
  if (!p) return '';
  const pregLabel = PREG_LABEL[style];
  const pct = Math.max(2, Math.min(100, Math.round((p.weeks / 40) * 100)));
  const trimesterText = p.trimester === 1 ? '孕早期' : p.trimester === 2 ? '孕中期' : '孕晚期';
  const dueText = p.daysToDue > 0
    ? `距预产期${p.daysToDue}天`
    : p.daysToDue === 0
      ? '今日预产期'
      : `已过预产期${-p.daysToDue}天`;
  const valueText = `孕${p.weeks}周 · ${trimesterText} · ${dueText}`;
  const bridgeClass = style === 'bridge' ? ' bridge-cycle-indicator' : '';
  return (
    '<div class="cycle-bar cycle-preg cycle-trimester-' + p.trimester + bridgeClass + '" data-ub-section="' + sectionKey + '">' +
      cycleManagerLabel('🤰' + pregLabel, charName) +
      '<div class="cycle-track">' +
        '<div class="cycle-fill" style="width:' + pct + '%"></div>' +
      '</div>' +
      '<span class="cycle-value">' + valueText + '</span>' +
    '</div>'
  );
}

// ═══════════════════════════════════════════════════════════════
// 经期情绪图标变体（§5.7）：经期内女性角色的 mood-icon 加 modifier class，
// 视觉上区分（红描边+光晕），情绪类型与数量不变。
// ═══════════════════════════════════════════════════════════════

/**
 * 经期情绪图标变体 modifier class（html-builder 5 处 mood 渲染点调用）。
 * 返回 ' is-cycle-period'（含前导空格）或 ''。off 档/无记录/非经期 → 空串。
 *
 * 实现走 cycle-ui 已有路径：activeChar → resolveFingerprintByCharName → getCycleRenderInfo。
 * 仿 cyclePhaseBar 的早退逻辑，保证 off 档零开销（仅一次 getConfig 查询）。
 */
/** O37(第十一轮)：渲染签名专用的周期显示摘要——情绪变体类 + 周期/孕期条的关键量。
 *  与渲染树真实消费的字段同源同鲜度（同一条 getCycleRenderInfo 读路径）：变体类、阶段、
 *  是否经期、天数比、孕期周数。任一变化必翻签名；周期无关的 story 写不再连带重渲。 */
export function cycleDisplayDigest(activeChar: string | null | undefined): string {
  if (getConfig().cycleMode === 'off' || !activeChar) return '';
  const key = resolveCycleKeyByCharName(activeChar);
  if (!key) return '';
  const info = getCycleRenderInfo(key);
  if (!info) return '';
  const preg = info.pregnancy ? `${info.pregnancy.weeks}w${info.pregnancy.trimester}` : '';
  return `${cycleMoodVariantClass(activeChar)}|${info.phase}|${info.isOnPeriod ? 1 : 0}|${info.daysIntoCycle}/${info.cycleLength}|${preg}`;
}

export function cycleMoodVariantClass(activeChar: string | null | undefined): string {
  if (getConfig().cycleMode === 'off') return '';
  if (!activeChar) return '';
  const key = resolveCycleKeyByCharName(activeChar);
  if (!key) return '';
  const info = getCycleRenderInfo(key);
  if (!info || !info.isOnPeriod) return '';
  return ' is-cycle-period';
}

// ═══════════════════════════════════════════════════════════════
// CSS 注入（doRender 每次调用；按 cycleMode 自管理）
// ═══════════════════════════════════════════════════════════════

export function injectCycleCSS(): void {
  const existing = document.getElementById('ub-cycle-css');
  // off：移除已注入的 style（真零开销，DOM 不留 cycle CSS）
  if (getConfig().cycleMode === 'off') {
    if (existing) existing.remove();
    return;
  }
  if (existing) {
    if (existing.textContent !== CYCLE_BASE_CSS) existing.textContent = CYCLE_BASE_CSS;
    return;
  }
  ensureStyleOnce('ub-cycle-css', CYCLE_BASE_CSS); // U35：收编建新分支（off 移除/内容刷新闸保留在上）
}
