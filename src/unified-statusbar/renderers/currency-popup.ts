// ===== 货币弹窗（唯一管理入口；设计口径见 claude_memory/currency-system.md 钱包场景）=====
// 交互：AI 生成提案确认流 / 手动新建 / 点余额调账（正收负支+原因）/ 点图标换 SVG /
//       ★ 设常用货币 / 删除（余额非 0 二次确认）/ 流水（长按一行删除该笔并把余额反冲回去）。
import { PATHS, ubIcon } from '../core/icons';
import { escapeHtml } from '../core/html-escape';
import { getToastr } from '../core/env';
import { type StyleType } from '../core/constants';
import { syncDarkClass, syncDarkClassMinimal, markPopupShown, closePanelOverlay, bridgeWindowClass } from './html-builder';
import { showConfirmDialog } from './confirm-dialog';
import { bindLongPressDelegated, swallowGhostClickIfPointerActive, type LongPressHandle } from './long-press';
import { captureScroll } from './dom-update';
import {
  CURRENCY_ICONS, addCurrency, adjust, currencyDataSnapshot, emitCurrencyAiMinted, fmtQtyShort, ledgerEntryKey,
  removeCurrency, removeLedgerEntry, setCommonCurrency, setCurrencyIcon,
  type CurrencyData, type CurrencyIcon as CurrencyIconType, type CurrencyLedgerEntry, type CurrencyMeta,
} from '../core/currency';
import { requestCurrencyProposals, proposalToMeta, type CurrencyProposal } from '../core/currency-ai';

// ─── 风格文案包（THEME_COPY，§3.1）────────────────────────────

type WalletSkin = 'ios' | 'ancient' | 'xianxia' | 'sweet' | 'minimal' | 'flirtatious' | 'bridge';

const SKIN_BY_STYLE: Record<StyleType, WalletSkin> = {
  ios: 'ios', ancient: 'ancient', xianxia: 'xianxia', sweet: 'sweet',
  minimal: 'minimal', flirtatious: 'flirtatious', bridge: 'bridge',
};

// sub = 标题行里的副题（F37a：与标题/按钮/关闭同一行；按用户意见去掉「· 每聊天独立」等尾注）
const THEME_COPY: Record<StyleType, { title: string; sub: string; empty: string }> = {
  ios: { title: '钱包', sub: '流水与余额', empty: '这个聊天还没有任何货币' },
  ancient: { title: '钱袋', sub: '收支簿', empty: '囊中羞涩——尚无货币' },
  xianxia: { title: '灵钱袋', sub: '灵钱账目', empty: '身无灵石' },
  sweet: { title: '小金库', sub: '收支记录', empty: '小金库还是空的' },
  flirtatious: { title: '小金库', sub: '收支记录', empty: '小金库还是空的' },
  minimal: { title: 'WALLET', sub: 'LEDGER', empty: 'NO CURRENCY' },
  bridge: { title: '舰桥金库', sub: '资金账目', empty: '资金账户未建档' },
};

const ICON_COLORS: Record<CurrencyIconType, string> = {
  coin: '#8a8f99', 'coin-jade': '#2fa47e', 'coin-gold': '#d99a1e',
  'coin-ingot': '#7f8ea3', 'coin-copper': '#b96f3e', 'coin-cash': '#3f9c60',
};
const ICON_LABELS: Record<CurrencyIconType, string> = {
  coin: '通用', 'coin-jade': '灵石', 'coin-gold': '金币', 'coin-ingot': '元宝',
  'coin-copper': '铜钱', 'coin-cash': '钞票',
};

const LEDGER_SRC_LABEL: Record<CurrencyLedgerEntry['source'], string> = {
  prose: '剧情正文', 'phone-out': '手机转账', 'phone-in': '手机转账', 'rp-open': '红包拆开', shop: '商城消费', manual: '手动调整',
};

function iconSvg(icon: CurrencyIconType, size: number, color: string): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[icon]}</svg>`;
}

function badge(icon: CurrencyIconType, size: number): string {
  const col = ICON_COLORS[icon] || '#8a8f99';
  return `<span class="wk-badge" style="width:${size}px;height:${size}px;background:${col}22">${iconSvg(icon, Math.round(size * 0.58), col)}</span>`;
}

// ─── 视图状态（弹窗内部切换，不弹二级窗）────────────────────────

interface WalletView {
  mode: 'list' | 'ai' | 'new' | 'edit' | 'icon';
  id?: string;
  picked?: Record<number, boolean>;
  proposals?: CurrencyProposal[];
  aiLoading?: boolean;
}
let _view: WalletView = { mode: 'list' };

// 流水行长按删除的绑定句柄：容器（overlay）常驻而复用，重开弹窗必须先解绑上一次，
// 否则同一个 overlay 上会叠两份委托（一次长按弹两个确认框）。
let _ledgerLp: LongPressHandle | null = null;

// ─── AI 生成请求：令牌作废 + 中止 ──────────────────────────────
// 每次发起自增令牌；返回/关闭/改走其它视图即作废在途请求并 abort（底层重试循环随之中止）。
// 收尾必须核对令牌，否则陈旧完成会把用户当前视图拽回提案面板，或让已关闭的弹窗"自己弹回来"。
let _aiReqSeq = 0;
let _aiAbort: AbortController | null = null;

function cancelAiRequest(): void {
  _aiReqSeq++;
  try { _aiAbort?.abort(); } catch (_e) { /* ignore */ }
  _aiAbort = null;
}

// ─── 渲染 ────────────────────────────────────────────────────

export function showCurrencyPopup(style: StyleType): void {
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  const shellCls = style === 'bridge' ? bridgeWindowClass('currency', 'm') : 'panel-popup ub-popup--m';
  // F37a：不再输出壳自己的 panel-popup-head——标题行合并进钱包体（.wk-head），关闭按钮同处最右
  const html = `<div class="${shellCls}" data-popup="currency">`
    + `<div class="panel-popup-body"><div class="ub-wallet" data-skin="${SKIN_BY_STYLE[style]}">${buildWalletBody(style)}</div></div></div>`;
  if (style === 'minimal') syncDarkClassMinimal(overlay);
  else syncDarkClass(overlay);
  overlay.innerHTML = html;
  markPopupShown();
  overlay.classList.add('show');
  bindWalletEvents(overlay, style);
}

/** 只换 body（AI 提案回填/视图切换复用，保留滚动）。
 *  ★.ub-wallet 自身保留但内层全部换新 ⇒ 流水区（.wk-ledger）元素被换、scrollTop 会归零，
 *  点行内 ★/删除/调账这类就地操作必须显式回填（切到编辑/新建视图时无 ledger，回填自动 no-op）。 */
function refreshWalletBody(style: StyleType): void {
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  const restoreLedgerScroll = captureScroll(overlay, '.wk-ledger');
  const wallet = overlay.querySelector<HTMLElement>('.ub-wallet');
  if (!wallet) {
    // 弹窗已被关闭：静默放弃本次刷新。原实现在此处 showCurrencyPopup 补建——AI 请求在关闭后
    // 完成会把钱包"自己弹回来"；仅当弹窗仍在显示（body 被其它弹窗清掉）时才补建。
    if (!overlay.classList.contains('show')) return;
    showCurrencyPopup(style);
    return;
  }
  wallet.innerHTML = buildWalletBody(style);
  wallet.dataset.skin = SKIN_BY_STYLE[style];
  restoreLedgerScroll();
}

function buildWalletBody(style: StyleType): string {
  const data = currencyDataSnapshot();
  const copy = THEME_COPY[style];
  // F37a 标题行：钱袋图标 · 标题 · 副题 · AI 生成 · 手动新建 · 关闭（原先标题被壳与体拆成两处）
  let h = `<div class="wk-head">`
    + `<span class="wk-head-icon">${ubIcon('wallet', 'wk-head-ic')}</span>`
    + `<span class="wk-title">${escapeHtml(copy.title)}</span>`
    + `<span class="wk-sub">${escapeHtml(copy.sub)}</span>`
    + `<button class="wk-btn ai" data-wk="ai"${_view.mode === 'ai' && _view.aiLoading ? ' disabled' : ''}>${_view.mode === 'ai' && _view.aiLoading ? '✦ 生成中…' : '✦ AI 生成货币'}</button>`
    + `<button class="wk-btn new" data-wk="new">＋ 手动新建</button>`
    + `<button class="panel-popup-close wk-close" id="panelClose" type="button" aria-label="关闭">&times;</button></div>`;

  if (_view.mode === 'ai') h += buildAiPanel(data);
  else if (_view.mode === 'new') h += buildNewPanel();
  else if (_view.mode === 'edit' && _view.id) h += buildEditPanel(data, _view.id);
  else if (_view.mode === 'icon' && _view.id) h += buildIconPanel(data, _view.id);

  if (!data.currencies.length) {
    h += `<div class="wk-empty">${iconSvg('coin', 30, 'currentColor')}<br>${copy.empty}<br><span style="font-size:11.5px">让 AI 按世界观生成，或手动添加</span></div>`;
    return h;
  }
  h += '<div class="wk-list">' + buildCurrencyRows(data) + '</div>';
  h += '<div class="wk-sect">收支流水<span class="wk-sect-hint">长按可删除</span></div><div class="wk-ledger">' + buildLedger(data) + '</div>';
  return h;
}

function buildCurrencyRows(data: CurrencyData): string {
  let h = '';
  for (const c of data.currencies) {
    const isCommon = c.id === data.commonId;
    const qty = data.balances[c.id] ?? 0;
    h += `<div class="wk-cur${isCommon ? ' wk-primary' : ''}">`
      + `<span class="wk-icon" data-wk="icon" data-id="${c.id}" title="点击更换图标">${badge(c.icon, 34)}</span>`
      + `<span class="wk-info" data-wk="edit" data-id="${c.id}" title="点击调整余额"><b>${escapeHtml(c.name)}</b>`
      + `<span class="wk-subline">${isCommon ? '<span class="wk-ptag">★ 常用</span>' : ''}<span>${escapeHtml(c.desc || '')}</span></span></span>`
      + `<span class="wk-qty${qty < 0 ? ' neg' : ''}" data-wk="edit" data-id="${c.id}">${fmtQtyShort(c.precision, qty)}</span>`
      + (qty < 0 ? '<span class="wk-negtag">欠款</span>' : '')
      + `<button class="wk-star${isCommon ? ' on' : ''}" data-wk="star" data-id="${c.id}" title="设为常用货币">★</button>`
      + `<button class="wk-del" data-wk="del" data-id="${c.id}" title="删除">🗑</button></div>`;
  }
  return h;
}

function buildLedger(data: CurrencyData): string {
  if (!data.ledger.length) return '<div style="padding:20px;text-align:center;color:var(--wk-sub);font-size:12px">暂无流水</div>';
  const byId = new Map(data.currencies.map(c => [c.id, c]));
  let h = '';
  for (const e of data.ledger.slice(0, 30)) {
    const prec = byId.get(e.currencyId)?.precision ?? (Number.isInteger(e.delta) ? 0 : 2);
    const color = e.delta >= 0 ? '#2e9e52' : '#e0483c';
    const src = LEDGER_SRC_LABEL[e.source];
    // 长按删除：行身份 = ledgerEntryKey 签名（同一毫秒建的流水撞 ts，下标还会随新流水漂移，都不足以认行）。
    // title 保留备注原文（行内被 ellipsis 截断时鼠标可悬停看全）＋操作提示。
    h += `<div class="wk-led" data-led-key="${escapeHtml(ledgerEntryKey(e))}" title="${e.note ? escapeHtml(e.note) + ' · ' : ''}长按删除这条流水">`
      + `<span class="wk-ledsrc" style="background:${color}18">${iconSvg('coin', 16, color)}</span>`
      + `<span class="wk-ledmain"><b>${escapeHtml(e.note)}</b><span>${src} · ${escapeHtml(e.currencyName)} · ${escapeHtml(e.storyTime || '')}</span></span>`
      + `<span class="wk-ledamt ${e.delta >= 0 ? 'in' : 'out'}">${e.delta >= 0 ? '+' : ''}${fmtQtyShort(prec, e.delta)}</span></div>`;
  }
  return h;
}

function buildAiPanel(data: CurrencyData): string {
  if (_view.aiLoading || !_view.proposals) {
    // 生成中也要留出口：返回=取消本次生成并回列表（原先无返回按钮，请求一旦久挂就"卡住"）
    return '<div class="wk-panel"><div class="wk-ptitle">✦ AI 生成货币</div><div class="wk-phint">正在结合当前世界书与角色卡世界观设计提案…</div>'
      + '<div style="padding:18px 0;text-align:center;color:var(--wk-sub);font-size:12px">生成中，请稍候…</div>'
      + '<div class="wk-actions"><button class="wk-mini" data-wk="back">返回</button></div></div>';
  }
  let cards = '';
  _view.proposals.forEach((p, i) => {
    const exists = !!data.currencies.find(c => c.name.toLowerCase() === p.name.toLowerCase());
    const picked = !!_view.picked?.[i] && !exists;
    cards += `<label class="wk-prop${picked ? ' pick' : ''}${exists ? ' exists' : ''}">`
      + `<input type="checkbox" data-wk="prop" data-idx="${i}"${picked ? ' checked' : ''}${exists ? ' disabled' : ''}>`
      + badge(p.icon, 34)
      + `<span class="wk-pbody"><b>${escapeHtml(p.name)}${exists ? ' <span class="wk-ptag" style="color:var(--wk-sub);background:var(--wk-btn)">已存在 · 去重跳过</span>' : ''}</b>`
      + `<span class="wk-pdesc">${escapeHtml(p.desc)}</span>`
      + `<span class="wk-pmeta">建议图标：${ICON_LABELS[p.icon]} · 精度：${p.precision ? '0.01' : '整数'}</span></span></label>`;
  });
  return `<div class="wk-panel"><div class="wk-ptitle">✦ AI 生成货币</div>`
    + '<div class="wk-phint">AI 返回 1~3 个提案 · 勾选确认后添加（按名称去重 · 初始数量 0）</div>'
    + cards
    + '<div class="wk-actions"><button class="wk-mini pri" data-wk="ai-add">确认添加所选</button><button class="wk-mini" data-wk="back">返回</button></div></div>';
}

function buildNewPanel(): string {
  const iconOpts = CURRENCY_ICONS.map(k => `<option value="${k}">${ICON_LABELS[k]}</option>`).join('');
  return `<div class="wk-panel"><div class="wk-ptitle">＋ 手动新建货币</div>`
    + '<div class="wk-row"><label>名称</label><input class="wk-input" id="wk-np-name" style="flex:1;min-width:120px" maxlength="20" placeholder="如：下品灵石 / 铜币"></div>'
    + '<div class="wk-row"><label>描述</label><input class="wk-input" id="wk-np-desc" style="flex:1;min-width:120px" maxlength="60" placeholder="一句世界观描述（选填）"></div>'
    + `<div class="wk-row"><label>图标</label><select class="wk-input" id="wk-np-icon">${iconOpts}</select><label>精度</label><select class="wk-input" id="wk-np-prec"><option value="0">整数</option><option value="2">两位小数（现代币）</option></select></div>`
    + '<div class="wk-phint" style="margin-top:8px">初始数量为 0，添加后点击余额数字即可调整</div>'
    + '<div class="wk-actions"><button class="wk-mini pri" data-wk="new-add">添加</button><button class="wk-mini" data-wk="back">返回</button></div></div>';
}

function buildEditPanel(data: CurrencyData, id: string): string {
  const meta = data.currencies.find(c => c.id === id);
  if (!meta) return '';
  const qty = data.balances[id] ?? 0;
  return `<div class="wk-panel"><div class="wk-ptitle">调整 · ${escapeHtml(meta.name)}<span style="font-weight:400;font-size:11px;color:var(--wk-sub)">当前 ${fmtQtyShort(meta.precision, qty)}</span></div>`
    + '<div class="wk-phint">正数收入 / 负数支出 · 变动原因写入流水 · 时间自动取全局数据表的故事时间</div>'
    + '<div class="wk-row"><input class="wk-input" id="wk-ed-amt" style="width:120px" inputmode="decimal" placeholder="±金额"><input class="wk-input" id="wk-ed-note" style="flex:1;min-width:140px" maxlength="80" placeholder="变动原因，如：购凝神丹三枚"></div>'
    + '<div class="wk-actions"><button class="wk-mini pri" data-wk="edit-ok" data-id="' + id + '">确认</button><button class="wk-mini" data-wk="back">返回</button></div></div>';
}

function buildIconPanel(data: CurrencyData, id: string): string {
  const meta = data.currencies.find(c => c.id === id);
  if (!meta) return '';
  const cells = CURRENCY_ICONS.map(k =>
    `<button class="wk-icon-cell${meta.icon === k ? ' on' : ''}" data-wk="set-icon" data-id="${id}" data-icon="${k}">${badge(k, 30)}<span>${ICON_LABELS[k]}</span></button>`).join('');
  return `<div class="wk-panel"><div class="wk-ptitle">更换图标 · ${escapeHtml(meta.name)}</div>`
    + `<div class="wk-icon-grid">${cells}</div>`
    + '<div class="wk-actions"><button class="wk-mini" data-wk="back">返回</button></div></div>';
}

// ─── 事件绑定（单 overlay 委托）───────────────────────────────

function bindWalletEvents(overlay: HTMLElement, style: StyleType): void {
  overlay.onclick = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.id === 'panelClose' || target === overlay) {
      cancelAiRequest(); // 关闭即中止在途 AI 请求：避免其收尾刷新把钱包重新拉起
      _view = { mode: 'list' };
      // F70：走统一关闭口（第四轮日历同款病灶）——归还返回键守卫 + 防幽灵点击 + 滚动记忆 + 延迟清空（F38）。
      closePanelOverlay(overlay);
      return;
    }
    const el = target.closest<HTMLElement>('[data-wk]');
    if (!el) return;
    void handleWalletAction(el.dataset.wk || '', el, overlay, style);
  };
  overlay.onchange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset?.wk === 'prop') {
      const idx = Number(input.dataset.idx);
      if (!_view.picked) _view.picked = {};
      _view.picked[idx] = input.checked;
      input.closest('.wk-prop')?.classList.toggle('pick', input.checked);
    }
  };
  // 流水行长按删除（U10：统一走 long-press 模块）：overlay 常驻、行随 body 重建 ⇒ 容器委托。
  _ledgerLp?.stop();
  _ledgerLp = bindLongPressDelegated<HTMLElement>(overlay, '.wk-led', {
    onLong: (el) => { void removeLedgerRow(el, style); },
  });
}

/** 长按流水行 → 确认后删除该条并把余额反冲回去（＝把这笔记账退回去）。 */
async function removeLedgerRow(el: HTMLElement, style: StyleType): Promise<void> {
  const key = el.dataset.ledKey || '';
  const data = currencyDataSnapshot();
  const entry = data.ledger.find(e => ledgerEntryKey(e) === key);
  if (!entry) { refreshWalletBody(style); return; }
  const meta = data.currencies.find(c => c.id === entry.currencyId);
  const prec = meta?.precision ?? (Number.isInteger(entry.delta) ? 0 : 2);
  const amount = `${entry.delta >= 0 ? '+' : ''}${fmtQtyShort(prec, entry.delta)} ${entry.currencyName}`;
  const after = meta ? fmtQtyShort(meta.precision, (data.balances[entry.currencyId] ?? 0) - entry.delta) : '';
  // 长按触发时手指仍按下：松手补发的合成 click 会落在刚出现的确认弹窗上（可能误点「确定」），
  // 由 long-press 模块在 document capture 层一次性吞掉（同日历/商店/地图先例）。
  swallowGhostClickIfPointerActive();
  const ok = await showConfirmDialog({
    message: `删除这条流水？${entry.note ? `「${entry.note}」` : ''}${amount}`
      + (meta ? `，余额将回退为 ${after}` : '（该币种已删除，仅删除记录）'),
    danger: true,
  });
  if (!ok) return;
  // 按签名删：确认期间若流水被改动/删除（正文提取、别的窗口调账），签名落空 ⇒ 只提示重试，不猜下标
  if (!removeLedgerEntry(key)) {
    refreshWalletBody(style);
    getToastr()?.warning('流水已变动，未删除，请重试', '货币系统');
    return;
  }
  refreshWalletBody(style);
  getToastr()?.success(`已删除 1 条流水${meta ? ` · 余额已回退为 ${after}` : ''}`, '货币系统');
}

async function handleWalletAction(action: string, el: HTMLElement, overlay: HTMLElement, style: StyleType): Promise<void> {
  const id = el.dataset.id || '';
  const toastr = getToastr();
  // 除「发起生成」外的任何动作都代表离开 AI 生成流程（返回/手动新建/点行内…）：
  // 作废并中止在途请求；否则其收尾回填会把用户刚切到的视图拽回提案面板（"返回点不动"）。
  // 生成中的面板同时退场（_view 回列表），不留"已作废但还写着生成中"的僵尸面板。
  if (action !== 'ai') {
    cancelAiRequest();
    if (_view.mode === 'ai' && _view.aiLoading) _view = { mode: 'list' };
  }
  switch (action) {
    case 'ai': {
      cancelAiRequest(); // 重新发起前先作废上一笔在途请求
      const seq = _aiReqSeq;
      const ac = typeof AbortController === 'function' ? new AbortController() : null;
      _aiAbort = ac;
      _view = { mode: 'ai', aiLoading: true };
      refreshWalletBody(style);
      let proposals: CurrencyProposal[];
      try {
        proposals = await requestCurrencyProposals(ac?.signal);
      } catch (err: any) {
        if (seq !== _aiReqSeq) return; // 已作废（用户返回/关闭/重发）：静默丢弃，含用户取消
        _aiAbort = null;
        _view = { mode: 'list' };
        refreshWalletBody(style);
        toastr?.error(err?.message || 'AI 生成失败', '货币系统');
        return;
      }
      if (seq !== _aiReqSeq) return; // 陈旧完成：不得改写当前视图/重渲染
      _aiAbort = null;
      _view = { mode: 'ai', proposals, picked: {} };
      refreshWalletBody(style);
      return;
    }
    case 'ai-add': {
      const proposals = _view.proposals || [];
      const picked = _view.picked || {};
      let added = 0; let deduped = 0;
      proposals.forEach((p, i) => {
        if (!picked[i]) return;
        const res = addCurrency(proposalToMeta(p), 0);
        if (res.created) added++; else deduped++;
      });
      _view = { mode: 'list' };
      refreshWalletBody(style);
      if (added) {
        emitCurrencyAiMinted(); // L13 成就「凭空造钱」
        toastr?.success(`已添加 ${added} 种货币 · 初始数量 0，点余额数字调整`, '货币系统');
      } else if (deduped) toastr?.warning('所选币种均已存在（按名称去重）', '货币系统');
      return;
    }
    case 'new':
      _view = { mode: 'new' };
      refreshWalletBody(style);
      overlay.querySelector<HTMLInputElement>('#wk-np-name')?.focus();
      return;
    case 'new-add': {
      const name = overlay.querySelector<HTMLInputElement>('#wk-np-name')?.value.trim() || '';
      const desc = overlay.querySelector<HTMLInputElement>('#wk-np-desc')?.value.trim() || '';
      const icon = (overlay.querySelector<HTMLSelectElement>('#wk-np-icon')?.value || 'coin') as CurrencyIconType;
      const precision = overlay.querySelector<HTMLSelectElement>('#wk-np-prec')?.value === '2' ? 2 : 0;
      if (!name) { toastr?.warning('请填写货币名称', '货币系统'); return; }
      const res = addCurrency({ name, desc, icon, precision }, 0); // id 由数据层分配（唯一性契约）
      _view = { mode: 'list' };
      refreshWalletBody(style);
      toastr?.[res.created ? 'success' : 'warning'](res.created ? `已添加「${name}」×0（初始数量 0）` : `「${name}」已存在（按名称去重）`, '货币系统');
      return;
    }
    case 'edit':
      if (!currencyExists(id)) { refreshWalletBody(style); return; } // 币种已被并发移除：刷回列表而非弹空面板
      _view = { mode: 'edit', id };
      refreshWalletBody(style);
      return;
    case 'edit-ok': {
      const amt = parseFloat(overlay.querySelector<HTMLInputElement>('#wk-ed-amt')?.value || '');
      const note = overlay.querySelector<HTMLInputElement>('#wk-ed-note')?.value.trim() || '';
      if (!Number.isFinite(amt) || amt === 0) { toastr?.warning('请输入非零金额（正收负支）', '货币系统'); return; }
      const entry = adjust(id, amt, 'manual', note || '手动调整');
      _view = { mode: 'list' };
      refreshWalletBody(style);
      if (entry) {
        const prec = currencyDataSnapshot().currencies.find(c => c.id === id)?.precision ?? 0;
        const after = entry.balanceAfter;
        toastr?.success(`${amt > 0 ? '+' : ''}${fmtQtyShort(prec, amt)} · 余额 ${fmtQtyShort(prec, after)}${after < 0 ? '（欠款）' : ''}`, '货币系统');
      }
      return;
    }
    case 'icon':
      if (!currencyExists(id)) { refreshWalletBody(style); return; }
      _view = { mode: 'icon', id };
      refreshWalletBody(style);
      return;
    case 'set-icon': {
      const icon = (el.dataset.icon || 'coin') as CurrencyIconType;
      setCurrencyIcon(id, icon);
      _view = { mode: 'list' };
      refreshWalletBody(style);
      toastr?.success(`图标已更换为「${ICON_LABELS[icon]}」`, '货币系统');
      return;
    }
    case 'star': {
      if (!setCommonCurrency(id)) return; // id 失配（币种已删）不报成功
      refreshWalletBody(style);
      toastr?.success('★ 常用货币已切换', '货币系统');
      return;
    }
    case 'del': {
      const data = currencyDataSnapshot();
      const meta: CurrencyMeta | undefined = data.currencies.find(c => c.id === id);
      if (!meta) return;
      const qty = data.balances[id] ?? 0;
      if (qty !== 0) {
        const ok = await showConfirmDialog({ message: `「${meta.name}」余额为 ${fmtQtyShort(meta.precision, qty)}，确定删除？（流水保留币种名快照）`, danger: true });
        if (!ok) return;
      }
      removeCurrency(id);
      if (_view.mode === 'edit' || _view.mode === 'icon') _view = { mode: 'list' };
      refreshWalletBody(style);
      toastr?.success(`已删除「${meta.name}」`, '货币系统');
      return;
    }
    case 'back':
      _view = { mode: 'list' };
      refreshWalletBody(style);
      return;
    default:
      return;
  }
}


/** 行内动作的 id 校验：币种可能已被并发移除（另一窗口/切聊天），miss 时刷回列表而非弹空面板。 */
function currencyExists(id: string): boolean {
  return currencyDataSnapshot().currencies.some(c => c.id === id);
}
