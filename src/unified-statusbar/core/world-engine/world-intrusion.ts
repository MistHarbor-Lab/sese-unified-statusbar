// core/world-engine/world-intrusion.ts
// 入镜队列（两态 pending/acted）：pending 去重覆盖更新、触发（acted+TTL）、直接删除、钩子填入输入框。

import { INTRUSION_ACT_TTL, INTRUSION_QUEUE_MAX, type Intrusion, type WorldState } from './world-types';
import { plainClone } from '../deep-clone';
import { appendMessageToChat } from '../data-manager'; // v1.1

export { INTRUSION_ACT_TTL } from './world-types';

export function enqueueIntrusion(state: WorldState, intrusion: Intrusion): WorldState {
  const next: WorldState = plainClone(state);
  // 判重只对 pending：同角色已有待处理项 → 覆盖更新（刷新标题/钩子/描述，保留原 id 与 pending 态）。
  // acted 项在 TTL 内自然消散，不挡新事件——同角色可「已触发·剩N轮」与「待处理」并存。
  const dup = next.pendingIntrusions.find(i => i.kind === intrusion.kind && i.refId === intrusion.refId && i.status === 'pending');
  if (dup) {
    Object.assign(dup, {
      title: intrusion.title,
      hook: intrusion.hook,
      desc: intrusion.desc,
      dateKey: intrusion.dateKey,
      aiTriggered: intrusion.aiTriggered,
    });
    return next;
  }
  next.pendingIntrusions.unshift(intrusion);
  if (next.pendingIntrusions.length > INTRUSION_QUEUE_MAX) {
    next.pendingIntrusions = next.pendingIntrusions.slice(0, INTRUSION_QUEUE_MAX);
  }
  return next;
}

export function markIntrusionStatus(
  state: WorldState,
  id: string,
  status: Intrusion['status'],
): WorldState {
  const next: WorldState = plainClone(state);
  const item = next.pendingIntrusions.find(i => i.id === id);
  if (item) item.status = status;
  return next;
}

/** 触发入镜事件：置 acted + TTL（放入聊天框后事件已带进主线，保留两轮演化后自然消散）。 */
export function triggerIntrusion(state: WorldState, id: string): WorldState {
  const next: WorldState = plainClone(state);
  const item = next.pendingIntrusions.find(i => i.id === id);
  if (item) {
    item.status = 'acted';
    item.ttl = INTRUSION_ACT_TTL;
  }
  return next;
}

/** 直接删除入镜事件（窗口「删除」按钮）。 */
export function removeIntrusion(state: WorldState, id: string): WorldState {
  const next: WorldState = plainClone(state);
  const idx = next.pendingIntrusions.findIndex(i => i.id === id);
  if (idx >= 0) next.pendingIntrusions.splice(idx, 1);
  return next;
}

export function pendingIntrusions(state: WorldState): Intrusion[] {
  return state.pendingIntrusions.filter(i => i.status === 'pending');
}

/** 放入聊天框的最终文本：钩子不含角色名时补【角色名行动】前缀。
 *  主 AI 靠这行认出是谁；角色动态绿灯条目也按角色名触发（纯代词钩子会连 desc 一起丢）。 */
export function composeIntrusionFillText(intrusion: Intrusion): string {
  const hook = (intrusion.hook || '').trim();
  if (!hook) return '';
  const name = (intrusion.refId || '').trim();
  if (!name || hook.includes(name)) return hook;
  return `【${name}行动】${hook}`;
}

/** v1.1：把入镜钩子追加到酒馆输入框（复用 appendMessageToChat 的原生 setter + input 事件）。 */
export function fillIntrusionHook(intrusion: Intrusion): boolean {
  const text = composeIntrusionFillText(intrusion);
  if (!text) return false;
  try {
    appendMessageToChat(text);
    return true;
  } catch (_e) {
    return false;
  }
}
