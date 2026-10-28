// ===== 货币系统世界书投影（currency-guide）=====
// 内容随余额摘要节流重建（currency.ts persist → requestWorldbookProjection 5s 防抖）；
// 开关开启且有币种才注入；无币种/关闭 → reconcile 以空内容移除条目（关闭由配置面板经
// runtime setFeatureEnabled 的 allowDisabled 通道触发——禁用后数据派发会被注册表闸门丢弃）。
// 格式契约见方案 §5/§6；示例不带任何括号注释（括号会被 AI 误认为格式的一部分）。
import { STANDARD_RECURSION } from './constants';
import { getConfig } from './config-store';
import { currencyDataSnapshot, fmtQty, type CurrencyData } from './currency';
import { dsCachePos, registerManagedWbEntry } from './wb-position';
import { wbEntryName, reconcileSingleManagedEntry } from './worldbook-entry';
import { topWindowCandidates } from './cross-window';

export const CURRENCY_MANAGED_PREFIX = 'UBS-货币-当前货币体系';
export const CURRENCY_MANAGED_DISPLAY_NAME = 'UBS-货币-当前货币体系';

const CURRENCY_ORIG_POS = { type: 'before_character_definition', role: 'system', depth: 2, order: 8126 } as const;

export function isManagedCurrencyEntry(entry: any): boolean {
  const name = wbEntryName(entry);
  return !!(name && name.startsWith(CURRENCY_MANAGED_PREFIX));
}

function makeNewEntry(content: string): any {
  return {
    name: CURRENCY_MANAGED_PREFIX,
    comment: CURRENCY_MANAGED_DISPLAY_NAME,
    enabled: true,
    content,
    strategy: { type: 'constant', keys: [] },
    position: dsCachePos(CURRENCY_ORIG_POS),
    recursion: STANDARD_RECURSION,
    addMemo: true,
  };
}

/** Mutates the coordinator-owned entry copy and reports whether it changed.（同 skill 投影契约） */
export function reconcileCurrencyWorldbookEntries(entries: any[], content: string): boolean {
  return reconcileSingleManagedEntry(entries, { content, isMine: isManagedCurrencyEntry, makeEntry: makeNewEntry });
}

// ─── 内容构建 ────────────────────────────────────────────────

/**
 * 手机在线探测：__ubp_phone_style() 返回当前手机风格字符串；离线/未装载返回空。
 * 手机把桥注册在宿主 window（跨 iframe 拓扑时=本脚本 window.parent），探测必须
 * 覆盖 topWindowCandidates() 全部候选——只查自身 window 会在 iframe 拓扑下永远探空
 * （世界演化探测 __ubp_world_inject 同款教训）。
 */
export function phoneStyleOnline(): '' | 'modern' | 'xianxia' | 'wuxia' | 'fantasy' {
  for (const w of topWindowCandidates()) {
    try {
      const fn = (w as Record<string, unknown>).__ubp_phone_style;
      if (typeof fn !== 'function') continue;
      const v = String((fn as () => string)() || '');
      if ((['modern', 'xianxia', 'wuxia', 'fantasy'] as const).includes(v as never)) return v as never;
    } catch (_e) { /* 下一个候选 */ }
  }
  return '';
}

/**
 * 第 2 条（角色间手机收付）引导句按小手机主题换装：设备与收付名对齐 UBS_phone rich-media
 * 术语（仙侠=传讯玉简·灵石转让/灵石福袋、武侠=天机匣·汇银/赏钱、西幻=传讯水晶·金币转赠/钱袋）。
 * [转账]/[红包] 标签是提取协议（PROSE_TAG_RE），任何主题下都不换装。
 */
const PHONE_TRADE_RULE: Record<'modern' | 'xianxia' | 'wuxia' | 'fantasy', string> = {
  modern: '2. 角色间通过手机转账/发红包时同上要求，格式为：',
  xianxia: '2. 角色间通过传讯玉简做灵石转让/发灵石福袋时同上要求，格式为：',
  wuxia: '2. 角色间通过天机匣汇银/发赏钱时同上要求，格式为：',
  fantasy: '2. 角色间通过传讯水晶转赠金币/送钱袋时同上要求，格式为：',
};

/** 世界书注入内容。开关关闭或无币种 → ''（reconcile 移除条目）。 */
export function buildCurrencyGuideContent(data: CurrencyData = currencyDataSnapshot()): string {
  if (getConfig().currencyEnabled !== true || !data.currencies.length) return '';
  const common = data.currencies.find(c => c.id === data.commonId) || data.currencies[0];
  const allLine = data.currencies
    .map(c => `${c.name}×${fmtQty(c.precision, data.balances[c.id] ?? 0)}`)
    .join('；');
  const lines: string[] = [
    '<货币体系>',
    `常用货币：${common.name}`,
    `全部货币（用户持有）：${allLine}`,
    '记账规则：',
    '1. 涉及买卖、报酬、赏金、赌注、罚款等金钱变动时，必须紧跟相关正文之后用标签记录，正负号必填：+ 表示对方给主角，- 表示主角支出，币种名省略时指常用货币。格式：',
    `[交易]+120 ${common.name}|出售聚灵符十张`,
    '[交易]-50|购凝神丹三枚',
  ];
  const phoneStyle = phoneStyleOnline();
  if (phoneStyle) {
    lines.push(PHONE_TRADE_RULE[phoneStyle]);
    lines.push(`[转账]+200 ${common.name}|符钱结清`);
    lines.push(`[转账]-520 ${common.name}|丹药钱`);
    lines.push(`[红包]+88 ${common.name}|一点心意`);
    lines.push(`[红包]-52 ${common.name}|生日快乐呀`);
  }
  // 手机在线 → 余额不足是第 3 条；离线 → 转账/红包条缺席，重编号为第 2 条
  lines.push(`${phoneStyle ? '3' : '2'}. 余额不足时不要进行该笔交易或转账/红包，改写为另筹钱款、赊欠或放弃等剧情。`);
  lines.push('</货币体系>');
  return lines.join('\n');
}

// ─── 派发 ────────────────────────────────────────────────
// 无需本模块自带签名闸门：数据变更由 currency.ts persist 的 5s 防抖派发（内容未变时
// reconcile 自然返回 false 不写盘），开关翻转由 runtime setFeatureEnabled 直达协调器。

registerManagedWbEntry({ match: entry => isManagedCurrencyEntry(entry), origPos: () => CURRENCY_ORIG_POS });
