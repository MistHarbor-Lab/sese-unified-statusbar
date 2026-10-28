// ===== 货币宿主桥（状态栏 → 小手机 bundle）=====
// 小手机内嵌的 story-floor-store 副本永不 bootstrap，其进程内直接 import 主扩展 currency
// 模块只会读到空 store。手机侧一切货币数据与记账经本桥：注册在 topWindowCandidates() 的
// 每个 window 上（键 CURRENCY_HOST_BRIDGE_KEY），snapshot 即取即真（现读主扩展 currency
// store），adjust 回写主扩展单一事实源——与正文提取/钱包弹窗同一账本，不会双计。
import { getConfig } from './config-store';
import { requestWorldbookProjection } from './worldbook-projection-events';
import { adjust, currencyDataSnapshot, type CurrencySource } from './currency';
import { phoneStyleOnline } from './currency-worldbook';
import { CURRENCY_HOST_BRIDGE_KEY, PHONE_ONLINE_EVENT, topWindowCandidates } from './cross-window';

export interface CurrencyHostSnapshot {
  enabled: true;
  currencies: ReturnType<typeof currencyDataSnapshot>['currencies'];
  balances: Record<string, number>;
  commonId: string | null;
}

/** 桥快照：货币关闭/无币种/存储未就绪 → null（手机侧统一视为联动未激活）。 */
export function buildCurrencyHostSnapshot(): CurrencyHostSnapshot | null {
  try {
    if (getConfig().currencyEnabled !== true) return null;
    const data = currencyDataSnapshot();
    if (!data.currencies.length) return null;
    return { enabled: true, currencies: data.currencies, balances: data.balances, commonId: data.commonId };
  } catch (_e) {
    return null;
  }
}

/** 桥记账：id 必须是已存在币种（防手机侧陈旧快照写入幽灵账目）。 */
function bridgeAdjust(id: string, delta: number, source: CurrencySource, note: string): boolean {
  try {
    if (getConfig().currencyEnabled !== true) return false;
    if (!currencyDataSnapshot().currencies.some(c => c.id === id)) return false;
    return adjust(id, delta, source, note) !== null;
  } catch (_e) {
    return false;
  }
}

/**
 * 注册桥 + 监听手机上线。脚本重跑（酒馆助手不刷新页面重跑脚本）时桥对象由最新实例
 * 无条件接管（旧实例闭包指向已销毁存储，留着会静默失效——bindWorldPhoneBridge 同规）；
 * 上线监听用 remove+add 换手，防重复注册叠听。
 */
export function bindCurrencyHostBridge(): void {
  for (const w of topWindowCandidates()) {
    try {
      w[CURRENCY_HOST_BRIDGE_KEY] = { v: 1, snapshot: buildCurrencyHostSnapshot, adjust: bridgeAdjust };
    } catch (_e) { /* 只读窗口忽略 */ }
    try {
      if (typeof w.addEventListener !== 'function' || typeof w.removeEventListener !== 'function') continue;
      const prev = w.__ub_currency_host_online_handler;
      if (typeof prev === 'function') w.removeEventListener(PHONE_ONLINE_EVENT, prev as never);
      const handler = (): void => {
        // 手机（重）上线：货币世界书条目按在线分支重建（追加/撤下转账红包格式段）
        try { requestWorldbookProjection('currency', 'phone-online'); } catch (_e) { /* 投影未初始化 */ }
      };
      w.__ub_currency_host_online_handler = handler;
      w.addEventListener(PHONE_ONLINE_EVENT, handler as never);
    } catch (_e) { /* ignore */ }
  }
  // 追平启动竞态：手机先于宿主完成绑定时，其 ub-phone-online 派发无人接听。
  // 绑定完成后主动探测一次，手机已在线（含现代主题显式 'modern'）就立即重投影。
  if (phoneStyleOnline()) {
    try { requestWorldbookProjection('currency', 'phone-online'); } catch (_e) { /* 投影未初始化 */ }
  }
}
