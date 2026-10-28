export interface PrimaryWorldbookHelper {
  getCharWorldbookNames?(scope: 'current'): { primary?: string | null } | null | undefined;
  getWorldbookNames?(): string[] | null | undefined;
  getWorldbook(name: string): Promise<unknown>;
  replaceWorldbook(name: string, entries: any[]): Promise<void>;
}

export interface ProjectionContext {
  scopeEpoch: number;
  featureEpoch: number;
  isCurrent(): boolean;
}

export type ProjectionReconcile = (
  entries: any[],
  context: ProjectionContext,
) => boolean | Promise<boolean>;

export interface WorldbookProjectionDeps {
  getHelper(): PrimaryWorldbookHelper | null | undefined;
}

export interface ProjectionRequestOptions {
  allowDisabled?: boolean;
}

export interface ProjectionBatchTask {
  id: string;
  reconcile: ProjectionReconcile;
}

function cloneEntries(entries: any[]): any[] {
  if (typeof structuredClone === 'function') return structuredClone(entries);
  return entries.map(entry => ({ ...entry }));
}

/** Returns only the current character card's existing primary worldbook. */
export function resolveCurrentPrimaryWorldbook(helper: PrimaryWorldbookHelper | null | undefined): string | null {
  if (!helper || typeof helper.getCharWorldbookNames !== 'function' || typeof helper.getWorldbookNames !== 'function') return null;
  try {
    const primary = String(helper.getCharWorldbookNames('current')?.primary || '').trim();
    if (!primary) return null;
    const names = helper.getWorldbookNames() || [];
    return names.includes(primary) ? primary : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Serializes whole-worldbook read/modify/write operations. Every failed or stale
 * operation is intentionally silent, so a later trigger can retry from scratch.
 */
export function createWorldbookProjectionCoordinator(deps: WorldbookProjectionDeps) {
  let scopeEpoch = 0;
  let tail: Promise<void> = Promise.resolve();
  const featureEpoch = new Map<string, number>();
  const featureEnabled = new Map<string, boolean>();
  // O6 同 id 合并：队列中已有「尚未起跑」的同 id 任务时，后续请求直接搭车——
  // 任务执行时才读世界书（读到的是最新值），重复入队只会多付一次整书读+全量克隆。
  // 窗口只到任务起跑：起跑后再来的请求照常入队（能捕获运行期间的数据变化）。
  const queuedTasks = new Map<string, Promise<boolean>>();

  const epochOf = (id: string): number => featureEpoch.get(id) || 0;
  const enabledOf = (id: string): boolean => featureEnabled.get(id) !== false;

  /** 执行一次整书投影。返回值：true=任务实际跑过（含「比对无变化」），
   *  false=跳过/无世界书/读写异常——供需要准确提示的调用方（台账）使用。 */
  function enqueue(
    id: string,
    reconcile: ProjectionReconcile,
    options: ProjectionRequestOptions = {},
  ): Promise<boolean> {
    const expectedScope = scopeEpoch;
    const expectedFeature = epochOf(id);
    const queued = queuedTasks.get(id);
    if (queued) return queued;
    const task: Promise<boolean> = tail.then(async (): Promise<boolean> => {
      queuedTasks.delete(id);
      const isCurrent = (): boolean => scopeEpoch === expectedScope && epochOf(id) === expectedFeature;
      const willRun = isCurrent() && (options.allowDisabled || enabledOf(id));
      if (!willRun) return false;
      const helper = deps.getHelper();
      const worldbookName = resolveCurrentPrimaryWorldbook(helper);
      if (!helper || !worldbookName) return false;
      const rawEntries = await helper.getWorldbook(worldbookName);
      if (!Array.isArray(rawEntries) || !isCurrent()) return false;
      const entries = cloneEntries(rawEntries);
      const changed = await reconcile(entries, {
        scopeEpoch: expectedScope,
        featureEpoch: expectedFeature,
        isCurrent,
      });
      if (!isCurrent()) return false;
      if (!changed) return true;
      await helper.replaceWorldbook(worldbookName, entries);
      return true;
    }).catch((e) => {
      try { console.warn('[ub-wb] dequeue', id, 'THREW', e); } catch (_e) { /* diag */ }
      return false;
    });
    queuedTasks.set(id, task);
    void task.finally(() => {
      if (queuedTasks.get(id) === task) queuedTasks.delete(id);
    });
    tail = task.then(() => undefined, () => undefined);
    return task;
  }

  function request(
    id: string,
    reconcile: ProjectionReconcile,
    options: ProjectionRequestOptions = {},
  ): Promise<boolean> {
    return enqueue(id, reconcile, options);
  }

  /**
   * 批次投影：整本世界书只读一次、只写一次，批内按给定顺序逐项 reconcile。
   *
   * 「按项隔离副本」设计（对齐旧路径的逐项语义，非共享单副本）：
   * - 每项在自己的副本上 reconcile；返回 true 才采纳为新基底，返回 false 则**整份丢弃**
   *   ⇒ 「返回 false 却改动了数组」的未上报副作用不会被落盘（旧路径同样丢弃）；
   * - reconcile 期间 feature 代际变更 ⇒ 该项结果丢弃（旧路径在写前有 isCurrent 检查，同样不落盘）；
   * - 抛错项丢弃其副本（等价「本次未跑」，下次触发重试）；
   * - allowDisabled 语义（同 refreshAll）：批内不按 featureEnabled 过滤，禁用项也跑清理。
   *
   * 相对旧路径（每投影各一次读/克隆/写）省掉的是 **N-1 次整本读 + N-1 次整本写**；
   * 克隆次数保持 N 次未变（有意保留以换取与旧路径的严格等价）。
   */
  function enqueueBatch(tasks: readonly ProjectionBatchTask[]): Promise<void> {
    const seen = new Set<string>();
    const items: ProjectionBatchTask[] = [];
    for (const task of tasks) {
      if (!task || typeof task.id !== 'string' || !task.id || typeof task.reconcile !== 'function') continue;
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      items.push(task);
    }
    if (!items.length) return tail;
    const expectedScope = scopeEpoch;
    const expectedFeatures = items.map(item => epochOf(item.id));
    const batch = tail.then(async () => {
      const isScopeCurrent = (): boolean => scopeEpoch === expectedScope;
      const itemCurrent = (index: number): boolean => isScopeCurrent() && epochOf(items[index].id) === expectedFeatures[index];
      const helper = deps.getHelper();
      const worldbookName = resolveCurrentPrimaryWorldbook(helper);
      if (!helper || !worldbookName) return;
      const rawEntries = await helper.getWorldbook(worldbookName);
      if (!Array.isArray(rawEntries) || !isScopeCurrent()) return;
      let working = cloneEntries(rawEntries);
      let anyChanged = false;
      for (let index = 0; index < items.length; index += 1) {
        if (!itemCurrent(index)) continue;
        const candidate = cloneEntries(working);
        let changed = false;
        try {
          changed = (await items[index].reconcile(candidate, {
            scopeEpoch: expectedScope,
            featureEpoch: expectedFeatures[index],
            isCurrent: () => itemCurrent(index),
          })) === true;
        } catch (e) {
          try { console.warn('[ub-wb] batch-item', items[index].id, 'THREW', e); } catch (_e) { /* diag */ }
          continue;
        }
        if (changed && itemCurrent(index)) {
          working = candidate;
          anyChanged = true;
        }
      }
      if (anyChanged && isScopeCurrent()) await helper.replaceWorldbook(worldbookName, working);
    }).catch((e) => { try { console.warn('[ub-wb] batch-dequeue THREW', e); } catch (_e) { /* diag */ } });
    tail = batch;
    return batch;
  }

  function setFeatureEnabled(id: string, enabled: boolean, reconcile: ProjectionReconcile): Promise<void> {
    featureEpoch.set(id, epochOf(id) + 1);
    featureEnabled.set(id, enabled);
    return enqueue(id, reconcile, { allowDisabled: true }).then(() => undefined);
  }

  /** 手工清理等非投影写入的串行入口：与所有投影共用同一条 tail，
   *  避免 sweep 的 read-modify-write 与在途投影互相覆盖。 */
  function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task);
    tail = run.then(() => undefined, () => undefined);
    return run;
  }

  function advanceScope(): void {
    scopeEpoch++;
  }

  function drain(): Promise<void> {
    return tail;
  }

  return { request, requestBatch: enqueueBatch, setFeatureEnabled, exclusive, advanceScope, drain };
}
