// ===== 周期/孕育对外 API · 事件总线（零依赖） =====
//
// 供拓展项目订阅引擎状态变化（window.__ubCycleAPI.on(...)，见 core/cycle-external-api.ts）。
//
// 性能纪律（unified-statusbar-perf-resource-discipline）：
// - 本模块不 import 任何项目模块，引擎侧只静态 import 本模块（无循环依赖）。
// - 无订阅者时 emit 是一次 Map.get + size 判断即返回，热路径（300ms tick）零负担；
//   派发点全部位于「确有状态变化」的分支内，而非每 tick 无条件派发。
// - handler 异常隔离：单个订阅者抛错不影响引擎与其他订阅者。

export type CycleApiEvent =
  | 'cycle-state-changed'
  | 'cycle-progressed'
  | 'conceived'
  | 'pregnancy-confirmed'
  | 'pregnancy-terminated'
  | 'pregnancy-cancelled'
  | 'capability-changed'
  | 'delivery'
  | 'recovered'
  | 'period-start'
  | 'excluded-changed'
  | 'decision-pending'
  | 'decision-resolved';

export type CycleApiEventHandler = (payload: any) => void;

const _handlers = new Map<string, Set<CycleApiEventHandler>>();

/** 是否存在某事件的订阅者。引擎侧的派生计算（如 cycle-progressed 的阶段比对）用它做零开销守卫。 */
export function hasCycleApiListeners(event: string): boolean {
  const set = _handlers.get(event);
  return !!set && set.size > 0;
}

export function subscribeCycleApiEvent(event: string, handler: CycleApiEventHandler): () => void {
  if (typeof handler !== 'function') return () => undefined;
  let set = _handlers.get(event);
  if (!set) {
    set = new Set();
    _handlers.set(event, set);
  }
  set.add(handler);
  return () => { set!.delete(handler); };
}

export function unsubscribeCycleApiEvent(event: string, handler?: CycleApiEventHandler): void {
  const set = _handlers.get(event);
  if (!set) return;
  if (handler) set.delete(handler);
  else _handlers.delete(event);
}

/** 派发事件。无订阅者直接返回；handler 异常逐一隔离。 */
export function emitCycleApiEvent(event: CycleApiEvent, payload: Record<string, unknown>): void {
  const set = _handlers.get(event);
  if (!set || set.size === 0) return;
  for (const handler of Array.from(set)) {
    try { handler(payload); } catch (_e) { /* 订阅者隔离 */ }
  }
}

// ═══════════════════════════════════════════════════════════════
// 受孕 meta 透传（决策 resolveDecision 的 result.meta → conceived 事件 payload）
//
// 拓展方通过 resolveDecision(key, { method, meta }) 提交避孕选择时，可附 meta（如「本次对象」）。
// 引擎不解析、不落地 meta，只在该次提交触发真实受孕时原样并入 conceived 事件的 payload，
// 供拓展方把扩展数据精确关联到这次受孕（规格 §E resolveDecision）。
// ═══════════════════════════════════════════════════════════════

let _nextConceiveMeta: unknown = undefined;

export function setNextConceiveMeta(meta: unknown): void {
  _nextConceiveMeta = meta;
}

/** 取走并清空暂存的 meta（一次性）。无论是否触发受孕，读取方都必须在提交路径 finally 清空。 */
export function takeNextConceiveMeta(): unknown {
  const meta = _nextConceiveMeta;
  _nextConceiveMeta = undefined;
  return meta;
}

export function clearNextConceiveMeta(): void {
  _nextConceiveMeta = undefined;
}
