import { getCurrentStoryChatKey } from './story-floor-store';

// ─────────────────────────────────────────────────────────────
// 载入角色卡时的「入场扫描」守卫
//
// 背景：地图/立绘等自动生成功能，在切卡/载入卡瞬间会因会话级基线被重置
// 而把「入场」误判为「地点/剧情变化」，从而在用户还没开始推进剧情时
// 就触发一次无意义的 AI 生成。各模块原本各自维护一份 chatKey + skip 标志，
// 且地图的守卫按模式条件生效（new-location/location-change 两档漏过），
// 与立绘的无条件守卫发散，导致载入卡时地图仍自动更新。
//
// 这里把「这张卡该消费者是否已消耗过入场跳过」收拢为单一事实源：
// 切卡后该消费者的首次自动扫描返回 true（跳过生成），之后该卡内返回 false。
// 欢迎页（无角色卡）恒返回 true，任何自动生成都不会跑。
// 手动强制生成（force）不走本守卫——见 isAutoGenEntryScan。
// ─────────────────────────────────────────────────────────────

let _activeChatKey = '';
const _consumed = new Set<string>();

function isWelcomeOrEmpty(chatKey: string): boolean {
  return !chatKey || chatKey.startsWith('unknown-');
}

/**
 * 自动生成路径调用：若返回 true，表示这是切卡/载入卡后该消费者的首次自动扫描
 * （或欢迎页），应跳过本次自动生成。同一张卡内对同一消费者再次调用返回 false。
 * 手动/强制生成不要调用本函数（否则会白白消耗掉首次跳过额度）。
 */
export function consumeAutoGenEntrySkip(consumer: string): boolean {
  const chatKey = getCurrentStoryChatKey();
  if (isWelcomeOrEmpty(chatKey)) return true;
  if (chatKey !== _activeChatKey) {
    _activeChatKey = chatKey;
    _consumed.clear();
  }
  if (_consumed.has(consumer)) return false;
  _consumed.add(consumer);
  return true;
}

/**
 * 判断「本次 _refreshMap / 立绘队列扫描是否属于应被抑制的入场扫描」。
 * force=true 的手动生成一律不是入场扫描（直接放行，且不消耗额度）。
 * 自动路径等价于 consumeAutoGenEntrySkip 的查询版（消耗一次额度）。
 */
export function isAutoGenEntryScan(consumer: string, opts: { force?: boolean } = {}): boolean {
  if (opts.force) return false;
  return consumeAutoGenEntrySkip(consumer);
}
