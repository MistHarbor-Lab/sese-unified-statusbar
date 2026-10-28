export interface StoryReadinessCoordinatorDeps {
  isReady: () => boolean;
  runStoryRefresh: () => void | Promise<void>;
  setLoading: (loading: boolean) => void;
  /** 可选：长时间无法就绪时返回用户可读的失败原因（返回 null 则不升级为失败态）。 */
  getStuckReason?: () => string | null;
  /** 可选：渲染升级后的失败提示（传 null 清除）。 */
  setStuck?: (reason: string | null) => void;
}

export interface StoryReadinessCoordinator {
  requestRefresh(): Promise<boolean>;
  notifyReady(): Promise<boolean>;
  hasPendingRefresh(): boolean;
}

/** 加载指示升级阈值：超过此时长仍未就绪，视为非瞬态失败（不再无限转圈）。 */
const LOADING_STUCK_MS = 15_000;

/**
 * 将加载窗口内的剧情自动业务合并为一次补跑。
 * 数据库只读渲染不经过这里，因而不会被外部存档 I/O 阻塞。
 *
 * 防无限挂起：requestRefresh 在外部存档非瞬态失败（如数据文件损坏）时也会反复触发，
 * 若永不就绪则「存档同步中」会无限转圈且无恢复提示。超过 LOADING_STUCK_MS 仍未就绪时
 * 升级为失败态（getStuckReason/setStuck 可选依赖，缺省则静默清除加载指示）；
 * storage-ready 到达后（notifyReady）清除失败态并照常补跑。
 */
export function createStoryReadinessCoordinator(
  deps: StoryReadinessCoordinatorDeps,
): StoryReadinessCoordinator {
  let pendingRefresh = false;
  let loadingVisible = false;
  let escalationTimer: ReturnType<typeof setTimeout> | null = null;

  const setLoading = (loading: boolean): void => {
    if (loadingVisible === loading) return;
    loadingVisible = loading;
    deps.setLoading(loading);
  };

  const clearEscalation = (): void => {
    if (escalationTimer !== null) {
      clearTimeout(escalationTimer);
      escalationTimer = null;
    }
  };

  const armEscalation = (): void => {
    if (escalationTimer !== null) return;
    escalationTimer = setTimeout(() => {
      escalationTimer = null;
      if (!loadingVisible || deps.isReady()) return;
      const reason = deps.getStuckReason?.();
      setLoading(false);
      deps.setStuck?.(reason || null);
    }, LOADING_STUCK_MS);
  };

  const run = async (): Promise<boolean> => {
    await deps.runStoryRefresh();
    return true;
  };

  return {
    async requestRefresh(): Promise<boolean> {
      if (deps.isReady()) return run();
      pendingRefresh = true;
      setLoading(true);
      armEscalation();
      return false;
    },

    async notifyReady(): Promise<boolean> {
      if (!deps.isReady()) return false;
      clearEscalation();
      setLoading(false);
      deps.setStuck?.(null);
      if (!pendingRefresh) return false;
      pendingRefresh = false;
      return run();
    },

    hasPendingRefresh(): boolean {
      return pendingRefresh;
    },
  };
}
