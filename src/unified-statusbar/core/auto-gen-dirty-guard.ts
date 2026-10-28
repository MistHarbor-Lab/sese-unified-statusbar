import { getSheetByName, type SheetContent } from './data-manager';
import { getCurrentStoryChatKey } from './story-floor-store';
import { sha256Hex } from './external-storage-codec';

// ─────────────────────────────────────────────────────────────
// 关键表内容签名守卫
//
// 背景：数据库插件分组填表时，SQLite 模式逐组逐批触发
// `_notifyTableUpdate()`。状态栏每次收到通知都会走 runReadyStoryAutomation 的
// refreshMapDebounced / refreshPortraitDebounced。若先完成的分组不含该功能
// 真正依赖的关键表，此时读到的还是旧数据，会生成过期的立绘/地图。
//
// 这里把「该功能的关键表内容是否真正变化」收拢为单一事实源：
//   - 地图依赖「全局数据表」（当前详细地点/当前位置）；
//   - 立绘依赖「在场角色表」（姓名/状态/穿搭）。
// 两表分开守卫，各管各的——更新全局数据表只触发地图刷新，更新在场角色表只触发立绘刷新。
//
// 分组填表必是一整张表一起更新，表内任何变动都代表该表刷新成功，故签名取整表 content。
// 手动强制刷新（force）不走本守卫——见 isAutoGenDirtyScan。
// ─────────────────────────────────────────────────────────────

export interface AutoGenDirtyGuardDeps {
  /** 该守卫监控的关键表名（'全局数据表' 或 '在场角色表'）。 */
  tableName: string;
  /** 读取表格内容（生产传 data-manager.getSheetByName）。 */
  readSheetContent: (tableName: string) => SheetContent | null;
  /** 当前聊天标识（切卡时重置签名基线）。 */
  getChatKey: () => string;
  /** 签名 hash 函数（生产传 external-storage-codec.sha256Hex）。 */
  hashFn: (text: string) => string;
}

function isWelcomeOrEmpty(chatKey: string): boolean {
  return !chatKey || chatKey.startsWith('unknown-');
}

function computeSignature(
  readSheetContent: AutoGenDirtyGuardDeps['readSheetContent'],
  tableName: string,
  hashFn: AutoGenDirtyGuardDeps['hashFn'],
): string {
  try {
    const sheet = readSheetContent(tableName);
    // 表缺失按空表处理（签名确定，不阻塞首次）；content 为二维数组，直接 JSON 序列化。
    return hashFn(JSON.stringify(sheet?.content ?? []));
  } catch (_e) {
    return hashFn('__no_sheet__');
  }
}

/**
 * 创建关键表内容签名守卫实例。每个实例监控一张关键表、维护自己的签名基线。
 * 测试可用 mock 依赖构造隔离实例。
 */
export function createAutoGenDirtyGuard(deps: AutoGenDirtyGuardDeps) {
  let _activeChatKey = '';
  let _lastSignature: string | null = null;

  /**
   * 自动生成路径调用：若返回 true，表示该功能的关键表内容自上次以来发生了变化
   * （或首次/切卡后尚未建立基线），应放行本次自动刷新；返回 false 表示内容未变，
   * 应抑制本次自动刷新（分组填表逐组触发时的去重）。
   * 手动/强制生成不要调用本函数。
   */
  function consumeAutoGenDirty(_consumer: string): boolean {
    const chatKey = deps.getChatKey();
    if (isWelcomeOrEmpty(chatKey)) return true;
    if (chatKey !== _activeChatKey) {
      // 切卡：重置基线，首次自动扫描放行（由 auto-gen-entry-guard 决定是否真正生成）。
      _activeChatKey = chatKey;
      _lastSignature = null;
    }
    const signature = computeSignature(deps.readSheetContent, deps.tableName, deps.hashFn);
    if (signature === _lastSignature) return false;
    _lastSignature = signature;
    return true;
  }

  /**
   * 判断「本次自动刷新是否属于应被抑制的内容未变扫描」。
   * force=true 的手动刷新一律不是（直接放行，且不消耗/不更新基线）。
   * 自动路径等价于 consumeAutoGenDirty 的查询版（消耗一次额度）。
   */
  function isAutoGenDirtyScan(_consumer: string, opts: { force?: boolean } = {}): boolean {
    if (opts.force) return true;
    return consumeAutoGenDirty(_consumer);
  }

  /** 显式重置签名基线（如存储就绪/切卡联动时主动清空，下次自动扫描放行）。 */
  function resetBaseline(): void {
    _activeChatKey = '';
    _lastSignature = null;
  }

  return { consumeAutoGenDirty, isAutoGenDirtyScan, resetBaseline };
}

/** 地图守卫：只监控「全局数据表」（当前详细地点/当前位置）。 */
export const mapDirtyGuard = createAutoGenDirtyGuard({
  tableName: '全局数据表',
  readSheetContent: getSheetByName,
  getChatKey: getCurrentStoryChatKey,
  hashFn: sha256Hex,
});

/** 立绘守卫：只监控「在场角色表」（姓名/状态/穿搭）。 */
export const portraitDirtyGuard = createAutoGenDirtyGuard({
  tableName: '在场角色表',
  readSheetContent: getSheetByName,
  getChatKey: getCurrentStoryChatKey,
  hashFn: sha256Hex,
});
