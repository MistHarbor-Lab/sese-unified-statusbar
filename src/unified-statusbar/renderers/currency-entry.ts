// ===== 四风格钱包入口（甜蜜 / 撩人 / 萦绕 / 舰桥）=====
// 背景（缺陷修复）：货币入口原本只在灵动玻璃、古风、仙侠三种风格渲染，这四种风格下
// 货币系统完全不可达——看不到余额，也点不开钱包。
// 口径（2026-10-05 用户定）：
//   · 入口紧贴「瑟瑟能量」显示（各风格各自锚点，见 html-builder / bridge-statusbar / index.html）；
//   · 只显示**常用货币**一种（无「+N 币种」；其他币种在钱包弹窗里看）；
//   · 负余额只把数字染红；一个币种都没有 → 弱化占位（虚线描边），仍可点开钱包；
//   · 配色一律走各风格既有变量（深色随各风格既有深色类自动适配，无硬编码色）。
// 货币未开启（config.currencyEnabled=false）时返回空串 / 隐藏，行为与灵动玻璃 chip 一致。
import { getConfig } from '../core/config-store';
import { escapeAttr, escapeHtml } from '../core/html-escape';
import { balanceOf, commonCurrency, currencyIconSvg, fmtQtyShort } from '../core/currency';

export type WalletEntryStyle = 'sweet' | 'flirtatious' | 'minimal' | 'bridge';

interface EntryState {
  enabled: boolean;
  name: string;
  icon: string;
  qtyText: string;
  neg: boolean;
  empty: boolean;
  title: string;
}

function entryState(): EntryState {
  const enabled = getConfig().currencyEnabled === true;
  const meta = enabled ? commonCurrency() : null;
  const qty = meta ? balanceOf(meta.id) : 0;
  return {
    enabled,
    name: meta ? meta.name : '货币',
    icon: meta ? meta.icon : 'coin-copper',
    qtyText: meta ? fmtQtyShort(meta.precision, qty) : '——',
    neg: !!meta && qty < 0,
    empty: !meta,
    title: meta ? `${meta.name}（点击打开钱包）` : '货币系统：点击生成币种',
  };
}

function qtyHtml(s: EntryState): string {
  return '<b' + (s.neg ? ' class="neg"' : '') + '>' + s.qtyText + '</b>';
}

/** 萦绕（minimal）静态 DOM 的内芯：图标 + 余额（币名在 title 里，那排最挤）。 */
export function walletEntryInnerHtml(): string {
  const s = entryState();
  return currencyIconSvg(s.icon, 12) + qtyHtml(s);
}

/**
 * 钱包入口按钮标记。
 * 萦绕风格的外壳在 index.html 静态 DOM 里（只同步内芯，见 syncWalletEntryMinimal）；
 * 其余三种风格整枚随状态栏 HTML 重建输出。
 */
export function walletEntryHtml(style: WalletEntryStyle): string {
  const s = entryState();
  if (!s.enabled) return '';
  const cls = 'ub-wallet-entry' + (s.empty ? ' ub-wallet-empty' : '');
  if (style === 'bridge') {
    return '<button class="' + cls + '" id="ac-wallet-btn" type="button" title="' + escapeAttr(s.title) + '">'
      + '<span class="bridge-en-label">FUNDS</span>'
      + '<strong>' + currencyIconSvg(s.icon, 11) + ' ' + escapeHtml(s.name) + ' ' + qtyHtml(s) + '</strong></button>';
  }
  if (style === 'minimal') {
    return '<button class="' + cls + '" id="ac-wallet-btn-minimal" type="button" title="' + escapeAttr(s.title) + '">'
      + walletEntryInnerHtml() + '</button>';
  }
  const inline = style === 'sweet' ? ' style="font-size:11px;"' : '';
  return '<button class="' + cls + '" id="ac-wallet-btn" type="button" title="' + escapeAttr(s.title) + '"' + inline + '>'
    + currencyIconSvg(s.icon, 13) + ' ' + escapeHtml(s.name) + ' ' + qtyHtml(s) + '</button>';
}

/** 萦绕静态 DOM 同步（状态栏刷新链路里调用；其余风格随 HTML 重建，无需调用）。 */
export function syncWalletEntryMinimal(): void {
  const el = document.getElementById('ac-wallet-btn-minimal') as HTMLElement | null;
  if (!el) return;
  const s = entryState();
  el.style.display = s.enabled ? '' : 'none';
  if (!s.enabled) return;
  el.classList.toggle('ub-wallet-empty', s.empty);
  el.setAttribute('title', s.title);
  el.innerHTML = walletEntryInnerHtml();
}
