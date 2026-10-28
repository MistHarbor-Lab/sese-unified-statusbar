// ===== 系统必选决策队列（纯调度，不依赖 DOM） =====

export const SYSTEM_DECISION_PRIORITY = {
  pregnancy: 400,
  sexForm: 300,
  mapLocation: 200,
  jumpSummary: 100,
  worldEvolve: 90,
} as const;

export interface SystemDecisionResult {
  ok: boolean;
  error?: string;
  stale?: boolean;
}

export interface SystemDecisionItem<TPayload = unknown, TChoice = unknown> {
  key: string;
  priority: number;
  contextKey: string;
  createdAt?: number;
  payload?: TPayload;
  isValid: () => boolean;
  resolve: (choice: TChoice) => Promise<SystemDecisionResult> | SystemDecisionResult;
  merge?: (current: SystemDecisionItem<TPayload, TChoice>, incoming: SystemDecisionItem<TPayload, TChoice>) => void;
}

export type SystemDecisionEnqueueStatus = 'enqueued' | 'merged' | 'ignored';
type QueueListener = () => void;

export class SystemDecisionQueue {
  private _active: SystemDecisionItem | null = null;
  private _pending: SystemDecisionItem[] = [];
  private _resolving = false;
  private _listeners = new Set<QueueListener>();
  private readonly _scheduleMicrotask: (fn: () => void) => void;

  constructor(scheduleMicrotask: (fn: () => void) => void = fn => queueMicrotask(fn)) {
    this._scheduleMicrotask = scheduleMicrotask;
  }

  get activeItem(): SystemDecisionItem | null {
    return this._active;
  }

  get pendingItems(): SystemDecisionItem[] {
    return [...this._pending];
  }

  get resolving(): boolean {
    return this._resolving;
  }

  subscribe(listener: QueueListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this._listeners) {
      try { listener(); } catch (_e) { /* listener isolation */ }
    }
  }

  private sortPending(): void {
    this._pending.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }

  private activateNext(): void {
    if (this._active) return;
    while (this._pending.length > 0) {
      const next = this._pending.shift()!;
      if (!next.isValid()) continue;
      this._active = next;
      break;
    }
    this.notify();
  }

  enqueue<TPayload, TChoice>(incoming: SystemDecisionItem<TPayload, TChoice>): SystemDecisionEnqueueStatus {
    if (!incoming || !incoming.key || !incoming.isValid()) return 'ignored';
    if (!incoming.createdAt) incoming.createdAt = Date.now();
    const existing = this._active?.key === incoming.key
      ? this._active
      : this._pending.find(item => item.key === incoming.key);
    if (existing) {
      const merge = existing.merge as SystemDecisionItem<TPayload, TChoice>['merge'] | undefined;
      if (merge) merge(existing as SystemDecisionItem<TPayload, TChoice>, incoming);
      this.notify();
      return 'merged';
    }
    if (!this._active) {
      this._active = incoming as SystemDecisionItem;
      this.notify();
      return 'enqueued';
    }
    this._pending.push(incoming as SystemDecisionItem);
    this.sortPending();
    this.notify();
    return 'enqueued';
  }

  async submitActive(choice: unknown): Promise<SystemDecisionResult> {
    const active = this._active;
    if (!active) return { ok: false, error: '没有待处理决策' };
    if (this._resolving) return { ok: false, error: '决策正在处理中' };
    if (!active.isValid()) {
      this._active = null;
      this.notify();
      this._scheduleMicrotask(() => this.activateNext());
      return { ok: false, stale: true, error: '决策上下文已失效' };
    }
    this._resolving = true;
    this.notify();
    try {
      const result = await active.resolve(choice);
      if (!result.ok) return result;
      this._active = null;
      this._scheduleMicrotask(() => this.activateNext());
      return result;
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      this._resolving = false;
      this.notify();
    }
  }

  pruneInvalid(): void {
    const before = this._pending.length;
    this._pending = this._pending.filter(item => item.isValid());
    const activeInvalid = !!this._active && !this._active.isValid();
    if (activeInvalid) this._active = null;
    // 无变化不 notify：flushSystemDecisionQueue 在 300ms tick 与每次剧情落盘事件都会跑，
    // 若无条件 notify，活动弹窗 DOM 会被整棵重建（bind 重挂 + 300ms 点击闸 _shownAt 反复归零）。
    // 对齐 invalidate 的无变化静默语义；真正丢弃/激活路径各自 notify。
    if (this._pending.length === before && !activeInvalid) return;
    this.sortPending();
    if (!this._active) this.activateNext();
    else this.notify();
  }

  invalidate(predicate?: (item: SystemDecisionItem) => boolean): void {
    const shouldRemove = predicate || (() => true);
    const before = this._pending.length;
    this._pending = this._pending.filter(item => !shouldRemove(item));
    let changed = this._pending.length !== before;
    if (this._active && shouldRemove(this._active)) { this._active = null; changed = true; }
    // 无变化不 notify：周期引擎每 300ms tick 会对失格角色重复 invalidate，
    // 若无条件 notify，决策弹窗 innerHTML 每 tick 重建、按钮点击闸反复归零（症状=按钮锁死）。
    if (!changed) return;
    this.sortPending();
    if (!this._active) this.activateNext();
    else this.notify();
  }
}

export const systemDecisionQueue = new SystemDecisionQueue();

export function enqueueSystemDecision<TPayload, TChoice>(item: SystemDecisionItem<TPayload, TChoice>): SystemDecisionEnqueueStatus {
  return systemDecisionQueue.enqueue(item);
}

export function invalidateSystemDecisions(predicate?: (item: SystemDecisionItem) => boolean): void {
  systemDecisionQueue.invalidate(predicate);
}

export function flushSystemDecisionQueue(): void {
  systemDecisionQueue.pruneInvalid();
}
