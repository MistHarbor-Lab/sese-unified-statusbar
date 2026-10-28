// ===== 衣柜持久串行生图队列 =====
import { plainClone } from './deep-clone';

export type WardrobeGenerationTaskStatus =
  | 'waiting_prompt'
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export type WardrobeGenerationBatchStatus =
  | 'preparing'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'interrupted';

export interface WardrobeGenerationTask {
  targetId: string;
  promptText?: string;
  negativePrompt?: string;
  status: WardrobeGenerationTaskStatus;
  error?: string;
}

export interface WardrobeGenerationBatch {
  schema: 1;
  id: string;
  chatKey: string;
  targetType: 'item' | 'outfit';
  createdAt: number;
  status: WardrobeGenerationBatchStatus;
  error?: string;
  tasks: WardrobeGenerationTask[];
}

export interface PreparedWardrobePrompts {
  prompts: Record<string, string>;
  errors: Record<string, string>;
  negativePrompts?: Record<string, string>;
}

export interface WardrobeQueueDeps {
  now: () => number;
  makeId: () => string;
  chatKey?: () => string;
  persist: (batch: WardrobeGenerationBatch) => Promise<boolean>;
  preparePrompts: (targetIds: string[], signal: AbortSignal) => Promise<PreparedWardrobePrompts>;
  generateOne: (task: WardrobeGenerationTask, signal: AbortSignal) => Promise<void>;
}

export interface WardrobeQueueResult {
  ok: boolean;
  error?: string;
  /** 仅追加路径返回：本次实际进入队列的任务数；0 表示所选目标已全部在队列中 */
  appended?: number;
}

function isActive(status: WardrobeGenerationBatchStatus): boolean {
  return status === 'preparing' || status === 'running';
}

export function normalizePersistedWardrobeBatch(raw: unknown): WardrobeGenerationBatch | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as any;
  if (data.schema !== 1 || typeof data.id !== 'string' || !Array.isArray(data.tasks)) return null;
  const active = isActive(data.status);
  const tasks: WardrobeGenerationTask[] = [];
  for (const candidate of data.tasks) {
    if (!candidate || typeof candidate.targetId !== 'string') continue;
    const status: WardrobeGenerationTaskStatus =
      candidate.status === 'success' || candidate.status === 'failed' || candidate.status === 'cancelled'
        ? candidate.status
        : active || candidate.status === 'running' || candidate.status === 'queued' || candidate.status === 'waiting_prompt'
          ? 'interrupted'
          : candidate.status === 'interrupted' ? 'interrupted' : 'failed';
    tasks.push({
      targetId: candidate.targetId,
      ...(typeof candidate.promptText === 'string' ? { promptText: candidate.promptText } : {}),
      ...(typeof candidate.negativePrompt === 'string' ? { negativePrompt: candidate.negativePrompt } : {}),
      status,
      ...(typeof candidate.error === 'string' ? { error: candidate.error } : {}),
    });
  }
  const status: WardrobeGenerationBatchStatus = active
    ? 'interrupted'
    : ['completed', 'cancelled', 'interrupted'].includes(data.status) ? data.status : 'interrupted';
  return {
    schema: 1,
    id: data.id,
    chatKey: String(data.chatKey ?? ''),
    targetType: data.targetType === 'outfit' ? 'outfit' : 'item',
    createdAt: Number.isFinite(data.createdAt) ? Number(data.createdAt) : 0,
    status,
    ...(typeof data.error === 'string' && data.error ? { error: data.error } : {}),
    tasks,
  };
}

export function createWardrobeQueueController(deps: WardrobeQueueDeps) {
  let batch: WardrobeGenerationBatch | null = null;
  let abortController: AbortController | null = null;
  let execution: Promise<WardrobeQueueResult> | null = null;
  let executionEpoch = 0;
  const listeners = new Set<(snapshot: WardrobeGenerationBatch | null) => void>();

  const notify = (): void => {
    const snapshot = batch ? plainClone(batch) : null;
    for (const listener of listeners) {
      try { listener(snapshot ? plainClone(snapshot) : null); } catch (_e) { /* isolate */ }
    }
  };
  const persist = async (): Promise<boolean> => {
    if (!batch) return false;
    const ok = await deps.persist(plainClone(batch));
    if (ok) notify();
    return ok;
  };
  const persistRequired = async (): Promise<boolean> => {
    if (await persist()) return true;
    if (!batch) return false;
    executionEpoch++;
    abortController?.abort();
    const terminal = batch.status === 'cancelled';
    if (!terminal) batch.status = 'interrupted';
    batch.error = '队列保存失败，已停止生成';
    for (const task of batch.tasks) {
      if (task.status === 'waiting_prompt' || task.status === 'queued' || task.status === 'running') {
        task.status = 'interrupted';
        task.error = '队列保存失败，任务已中断';
      }
    }
    try { await deps.persist(plainClone(batch)); } catch (_e) { /* retain the recoverable in-memory snapshot */ }
    notify();
    return false;
  };
  // TypeScript narrows batch.status across await too aggressively; read through a function so async cancel/interrupt is visible.
  const currentStatus = (): WardrobeGenerationBatchStatus | undefined => batch?.status;
  const runQueued = async (epoch: number): Promise<WardrobeQueueResult> => {
    if (!batch || !abortController) return { ok: false, error: '队列未初始化' };
    const signal = abortController.signal;
    while (batch.status === 'running' && epoch === executionEpoch) {
      const task = batch.tasks.find(candidate => candidate.status === 'queued');
      if (!task) break;
      task.status = 'running';
      delete task.error;
      if (!(await persistRequired())) return { ok: false, error: '队列保存失败，已停止生成' };
      try {
        await deps.generateOne(plainClone(task), signal);
        if (epoch !== executionEpoch) return { ok: true };
        const settledStatus = currentStatus();
        if (settledStatus === 'cancelled') task.status = 'cancelled';
        else if (settledStatus === 'interrupted') task.status = 'interrupted';
        else task.status = 'success';
      } catch (error: any) {
        if (epoch !== executionEpoch) return { ok: true };
        const failedStatus = currentStatus();
        if (failedStatus === 'cancelled') task.status = 'cancelled';
        else if (failedStatus === 'interrupted') task.status = 'interrupted';
        else {
          task.status = 'failed';
          task.error = error?.message || String(error);
        }
      }
      if (!(await persistRequired())) return { ok: false, error: '队列保存失败，已停止生成' };
      if (batch.status !== 'running') break;
      const hasNext = batch.tasks.some(candidate => candidate.status === 'queued');
      if (!hasNext) break;
    }
    if (batch.status === 'running') {
      batch.status = 'completed';
      if (!(await persistRequired())) return { ok: false, error: '队列保存失败，已停止生成' };
    }
    return { ok: true };
  };

  const prepareAndRun = async (targetIds: string[], epoch: number): Promise<WardrobeQueueResult> => {
    if (!batch || !abortController) return { ok: false, error: '队列未初始化' };
    let prepared: PreparedWardrobePrompts;
    try {
      prepared = await deps.preparePrompts(targetIds, abortController.signal);
      if (epoch !== executionEpoch) return { ok: true };
    } catch (error: any) {
      if (epoch !== executionEpoch) return { ok: true };
      if (batch.status === 'cancelled' || batch.status === 'interrupted') return { ok: true };
      batch.status = 'completed';
      for (const task of batch.tasks) {
        if (task.status === 'waiting_prompt') {
          task.status = 'failed';
          task.error = error?.message || String(error);
        }
      }
      if (!(await persistRequired())) return { ok: false, error: '队列保存失败，已停止生成' };
      return { ok: false, error: error?.message || String(error) };
    }
    if (batch.status !== 'preparing') return { ok: true };
    for (const task of batch.tasks) {
      const prompt = prepared.prompts[task.targetId];
      if (prompt) {
        task.promptText = prompt;
        task.negativePrompt = prepared.negativePrompts?.[task.targetId] || '';
        task.status = 'queued';
      } else {
        task.status = 'failed';
        task.error = prepared.errors[task.targetId] || '提示词缺失';
      }
    }
    batch.status = 'running';
    if (!(await persistRequired())) return { ok: false, error: '队列保存失败，已停止生成' };
    return runQueued(epoch);
  };

  return {
    async startBatch(
      targetType: 'item' | 'outfit',
      targetIds: string[],
    ): Promise<WardrobeQueueResult> {
      if (targetIds.length === 0) return { ok: false, error: '请至少选择一项' };
      if (targetIds.length > 20) return { ok: false, error: '每批最多选择20项' };
      if (batch && isActive(batch.status)) return { ok: false, error: '已有生图批次正在进行' };
      const uniqueIds = Array.from(new Set(targetIds));
      batch = {
        schema: 1,
        id: deps.makeId(),
        chatKey: deps.chatKey?.() || '',
        targetType,
        createdAt: deps.now(),
        status: 'preparing',
        tasks: uniqueIds.map(targetId => ({ targetId, status: 'waiting_prompt' })),
      };
      abortController = new AbortController();
      const epoch = ++executionEpoch;
      if (!(await persist())) {
        batch = null;
        abortController = null;
        return { ok: false, error: '队列保存失败' };
      }
      execution = prepareAndRun(uniqueIds, epoch);
      const result = await execution;
      execution = null;
      abortController = null;
      return result;
    },

    async cancelBatch(): Promise<void> {
      if (!batch || (!isActive(batch.status) && batch.status !== 'interrupted')) return;
      batch.status = 'cancelled';
      executionEpoch++;
      for (const task of batch.tasks) {
        if (task.status !== 'success' && task.status !== 'failed') task.status = 'cancelled';
      }
      abortController?.abort();
      await persistRequired();
    },

    /** 批次进行中把新目标追加进同一队列排队：先以 waiting_prompt 落盘，再单独补提示词转 queued；
     *  串行循环每次取任务都会重新扫描 queued，若补提示词期间循环已收尾（completed），在此重启一轮消费剩余任务。 */
    async appendToBatch(targetIds: string[]): Promise<WardrobeQueueResult> {
      if (targetIds.length === 0) return { ok: true, appended: 0 };
      if (targetIds.length > 20) return { ok: false, error: '每批最多选择20项' };
      if (!batch || !abortController || !isActive(batch.status)) return { ok: false, error: '没有进行中的生图批次' };
      const epoch = executionEpoch;
      const existing = new Set(batch.tasks.map(task => task.targetId));
      const fresh = Array.from(new Set(targetIds)).filter(id => !existing.has(id));
      if (fresh.length === 0) return { ok: true, appended: 0 };
      batch.tasks.push(...fresh.map(targetId => ({ targetId, status: 'waiting_prompt' as const })));
      if (!(await persistRequired())) return { ok: false, error: '队列保存失败，已停止生成', appended: 0 };
      if (epoch !== executionEpoch) return { ok: true, appended: 0 };
      let prepared: PreparedWardrobePrompts;
      try {
        prepared = await deps.preparePrompts(fresh, abortController.signal);
        if (epoch !== executionEpoch) return { ok: true, appended: 0 };
      } catch (error: any) {
        if (epoch !== executionEpoch) return { ok: true, appended: 0 };
        const failedStatus = currentStatus();
        for (const task of batch.tasks) {
          if (task.status !== 'waiting_prompt' || !fresh.includes(task.targetId)) continue;
          if (failedStatus === 'cancelled' || failedStatus === 'interrupted') {
            task.status = failedStatus;
          } else {
            task.status = 'failed';
            task.error = error?.message || String(error);
          }
        }
        if (!(await persistRequired())) return { ok: false, error: '队列保存失败，已停止生成', appended: 0 };
        return { ok: true, appended: 0 };
      }
      let appended = 0;
      for (const targetId of fresh) {
        const task = batch.tasks.find(candidate => candidate.targetId === targetId && candidate.status === 'waiting_prompt');
        if (!task) continue;
        const prompt = prepared.prompts[targetId];
        if (prompt) {
          task.promptText = prompt;
          task.negativePrompt = prepared.negativePrompts?.[targetId] || '';
          task.status = 'queued';
          appended++;
        } else {
          task.status = 'failed';
          task.error = prepared.errors[targetId] || '提示词缺失';
        }
      }
      if (!(await persistRequired())) return { ok: false, error: '队列保存失败，已停止生成', appended };
      // 追加任务若赶在循环取任务前转 queued 会被活动循环直接消费；
      // 循环已收尾则在此重启，消费剩余 queued 任务。
      if (execution) await execution;
      if (batch.status === 'completed' && batch.tasks.some(task => task.status === 'queued')) {
        batch.status = 'running';
        delete batch.error;
        abortController = new AbortController();
        const nextEpoch = ++executionEpoch;
        if (!(await persistRequired())) {
          abortController = null;
          return { ok: false, error: '队列保存失败，已停止生成', appended };
        }
        execution = runQueued(nextEpoch);
        const result = await execution;
        execution = null;
        abortController = null;
        return result.ok ? { ok: true, appended } : { ok: false, error: result.error, appended };
      }
      return { ok: true, appended };
    },

    async interrupt(): Promise<void> {
      if (!batch || !isActive(batch.status)) return;
      batch.status = 'interrupted';
      executionEpoch++;
      for (const task of batch.tasks) {
        if (task.status !== 'success' && task.status !== 'failed' && task.status !== 'cancelled') {
          task.status = 'interrupted';
        }
      }
      abortController?.abort();
      await persistRequired();
    },

    async retryFailed(): Promise<WardrobeQueueResult> {
      if (!batch) return { ok: false, error: '没有可重试的批次' };
      if (isActive(batch.status)) return { ok: false, error: '已有生图批次正在进行' };
      const retryable = batch.tasks.filter(task => task.status === 'failed' && !!task.promptText);
      if (retryable.length === 0) return { ok: false, error: '没有可重试的失败任务' };
      for (const task of retryable) {
        task.status = 'queued';
        delete task.error;
      }
      batch.status = 'running';
      delete batch.error;
      abortController = new AbortController();
      const epoch = ++executionEpoch;
      if (!(await persistRequired())) {
        abortController = null;
        return { ok: false, error: '队列保存失败，已停止生成' };
      }
      execution = runQueued(epoch);
      const result = await execution;
      execution = null;
      abortController = null;
      return result;
    },

    async continueInterrupted(): Promise<WardrobeQueueResult> {
      if (!batch || batch.status !== 'interrupted') return { ok: false, error: '没有可继续的中断批次' };
      const remaining = batch.tasks.filter(task => task.status === 'interrupted');
      if (remaining.length === 0) return { ok: false, error: '没有剩余任务' };
      const missingPromptIds: string[] = [];
      for (const task of remaining) {
        if (task.promptText) {
          task.status = 'queued';
          delete task.error;
        } else {
          task.status = 'waiting_prompt';
          missingPromptIds.push(task.targetId);
        }
      }
      abortController = new AbortController();
      const epoch = ++executionEpoch;
      if (missingPromptIds.length > 0) {
        batch.status = 'preparing';
        delete batch.error;
        if (!(await persistRequired())) {
          abortController = null;
          return { ok: false, error: '队列保存失败，已停止生成' };
        }
        let prepared: PreparedWardrobePrompts;
        try {
          prepared = await deps.preparePrompts(missingPromptIds, abortController.signal);
          if (epoch !== executionEpoch) return { ok: true };
        } catch (error: any) {
          if (epoch !== executionEpoch) return { ok: true };
          const failedStatus = currentStatus();
          if (failedStatus === 'cancelled' || failedStatus === 'interrupted') {
            abortController = null;
            return { ok: true };
          }
          for (const task of batch.tasks) {
            if (task.status === 'waiting_prompt') {
              task.status = 'failed';
              task.error = error?.message || String(error);
            }
          }
          batch.status = 'completed';
          if (!(await persistRequired())) {
            abortController = null;
            return { ok: false, error: '队列保存失败，已停止生成' };
          }
          abortController = null;
          return { ok: false, error: error?.message || String(error) };
        }
        if (batch.status !== 'preparing') {
          abortController = null;
          return { ok: true };
        }
        for (const task of batch.tasks) {
          if (task.status !== 'waiting_prompt') continue;
          const prompt = prepared.prompts[task.targetId];
          if (prompt) {
            task.promptText = prompt;
            task.negativePrompt = prepared.negativePrompts?.[task.targetId] || '';
            task.status = 'queued';
          } else {
            task.status = 'failed';
            task.error = prepared.errors[task.targetId] || '提示词缺失';
          }
        }
      }
      batch.status = 'running';
      delete batch.error;
      if (!(await persistRequired())) {
        abortController = null;
        return { ok: false, error: '队列保存失败，已停止生成' };
      }
      execution = runQueued(epoch);
      const result = await execution;
      execution = null;
      abortController = null;
      return result;
    },

    load(raw: unknown): WardrobeGenerationBatch | null {
      executionEpoch++;
      abortController?.abort();
      batch = normalizePersistedWardrobeBatch(raw);
      abortController = null;
      execution = null;
      notify();
      return batch ? plainClone(batch) : null;
    },

    getSnapshot(): WardrobeGenerationBatch | null {
      return batch ? plainClone(batch) : null;
    },

    subscribe(listener: (snapshot: WardrobeGenerationBatch | null) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    isRunning(): boolean {
      return !!batch && isActive(batch.status);
    },
  };
}
