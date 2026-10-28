import type { ProjectionBatchTask, ProjectionReconcile, ProjectionRequestOptions } from './worldbook-projection';

export type WorldbookProjectionReason = 'data-change' | 'config-change' | 'phone-online';

export interface RegisteredWorldbookProjection {
  id: string;
  isEnabled(): boolean;
  reconcile: ProjectionReconcile;
}

export interface ProjectionCoordinatorLike {
  request(id: string, reconcile: ProjectionReconcile, options?: ProjectionRequestOptions): Promise<boolean>;
  /** 批次入口（整本读/写各一次）；旧桩/旧版协调器缺失时 refreshAll 自动回退逐项请求。 */
  requestBatch?(tasks: readonly ProjectionBatchTask[]): Promise<void>;
  /** 手工清理等非投影写入的串行入口（旧桩可缺省）。 */
  exclusive?<T>(task: () => Promise<T>): Promise<T>;
  setFeatureEnabled(id: string, enabled: boolean, reconcile: ProjectionReconcile): Promise<void>;
  advanceScope(): void;
  drain(): Promise<void>;
}

export interface WorldbookProjectionRegistryOptions {
  coordinator: ProjectionCoordinatorLike;
  projections: RegisteredWorldbookProjection[];
}

/** 外部描述符形状校验（registry 未初始化时也要先校验再入 pending，防假注册）。 */
export function isValidExternalProjection(projection: unknown): projection is RegisteredWorldbookProjection {
  const candidate = projection as RegisteredWorldbookProjection | null | undefined;
  return !!candidate && typeof candidate.id === 'string' && !!candidate.id
    && typeof candidate.isEnabled === 'function' && typeof candidate.reconcile === 'function';
}

/** Routes lifecycle, feature-toggle, and data-change requests through one coordinator. */
export function createWorldbookProjectionRegistry(options: WorldbookProjectionRegistryOptions) {
  const byId = new Map(options.projections.map(projection => [projection.id, projection]));

  /** 伴生插件（小手机等）经宿主桥注册的外部投影：同 id 幂等覆盖。 */
  function registerExternal(projection: RegisteredWorldbookProjection): boolean {
    if (!isValidExternalProjection(projection)) return false;
    byId.set(projection.id, projection);
    return true;
  }

  /** 注销外部投影（脚本卸载/重注入时调用；内部投影不走这里）。 */
  function unregisterExternal(id: string): boolean {
    return byId.delete(id);
  }

  function get(id: string): RegisteredWorldbookProjection | null {
    return byId.get(id) || null;
  }

  function requestProjection(id: string, _reason: WorldbookProjectionReason): Promise<boolean> {
    const projection = get(id);
    if (!projection || !projection.isEnabled()) return Promise.resolve(false);
    return options.coordinator.request(projection.id, projection.reconcile);
  }

  async function refreshAllForCurrentScope(): Promise<void> {
    // 遍历 byId（含外部注册投影），而非构造时的静态数组——否则 registerExternal 的投影不参与全量刷新
    // 批次化：整本世界书读/克隆/写各一次（原为每个投影各一次）。byId 为 Map ⇒ 顺序=注册顺序且 id 天然唯一。
    const tasks: ProjectionBatchTask[] = [];
    for (const projection of byId.values()) tasks.push({ id: projection.id, reconcile: projection.reconcile });
    if (typeof options.coordinator.requestBatch === 'function') {
      await options.coordinator.requestBatch(tasks);
      return;
    }
    for (const task of tasks) {
      await options.coordinator.request(task.id, task.reconcile, { allowDisabled: true });
    }
  }

  function setFeatureEnabled(id: string, enabled: boolean): Promise<void> {
    const projection = get(id);
    if (!projection) return Promise.resolve();
    return options.coordinator.setFeatureEnabled(id, enabled, projection.reconcile);
  }

  function advanceScope(): void {
    options.coordinator.advanceScope();
  }

  function drain(): Promise<void> {
    return options.coordinator.drain();
  }

  /** 手工清理等非投影写入：有协调器 exclusive 就串行，旧桩直接执行。 */
  function exclusive<T>(task: () => Promise<T>): Promise<T> {
    return options.coordinator.exclusive ? options.coordinator.exclusive(task) : task();
  }

  return { requestProjection, refreshAllForCurrentScope, setFeatureEnabled, advanceScope, drain, registerExternal, unregisterExternal, exclusive };
}
