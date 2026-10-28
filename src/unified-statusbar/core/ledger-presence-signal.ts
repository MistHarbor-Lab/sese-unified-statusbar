// core/ledger-presence-signal.ts
// 瑟瑟台账「在场角色表本轮落账完成」信号的**传输层**（订阅 + 跨窗口投递）。
//
// 分层：台账是生产方（sese-ledger 的 scribe 在分组落账成功时派发 UB_EVENT.ledgerPresenceFilled）；
// 本模块只负责把事件收成一个 token 回调；立绘消费者是 portrait-system 的
// requestLedgerPresencePortraitUpdate（内部按 portraitEnabled / every-turn / 台账接管 / 重填自门控）。
//
// **必须在应用启动时绑定一次，不归 initPortraitSystem**：后者只在「首次渲染时已有 chatKey」或
// 用户开启立绘功能时执行；欢迎页→进聊天、切卡/重注入、存储晚就绪都不会补调，而台账 every-turn
// 已让开「在场角色表内容变化」脏检查（没有兜底），漏绑即整条每轮立绘静默停摆。
//
// 拓扑：台账跑在脚本 iframe、状态栏主模块注入父页。台账把同一事件派发到自身 + parent + top；
// 这里按 topWindowCandidates（自身 + globalThis + parent）并显式补 top（深层嵌套时 parent≠top，
// 与 core/config-store 的跨 bundle 派发同口径）各挂一份。同一信号会到达多个候选窗口，
// 消费方按 token 去重。

import { topWindowCandidates } from './cross-window';
import { UB_EVENT } from './events';

/** 订阅台账落账信号（幂等；应用启动时调用一次）。handler 收到 detail.token（缺失时为空串）。 */
export function bindLedgerPresenceSignal(handler: (token: string) => void): void {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  if (!w || typeof handler !== 'function') return;
  // window 标记：脚本重注入 = 新窗口，标记归零后重新绑定；同窗口重复调用只挂一份。
  if (w.__ub_ledger_presence_bound) return;
  w.__ub_ledger_presence_bound = true;
  const onSignal = (ev: Event): void => {
    const detail = (ev as CustomEvent)?.detail;
    try { handler(String(detail?.token || '')); } catch (_e) { /* 消费者故障不阻断其它窗口投递 */ }
  };
  const targets = topWindowCandidates() as unknown as EventTarget[];
  try {
    const top = (w as any).top;
    if (top && targets.indexOf(top as any) < 0) targets.push(top as any);
  } catch (_e) { /* cross-origin */ }
  for (const target of targets) {
    try { target.addEventListener(UB_EVENT.ledgerPresenceFilled, onSignal); } catch (_e) { /* 单个窗口失败不阻断 */ }
  }
}
