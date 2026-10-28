// core/ai-request-pipeline.ts
// U13：三段式 AI 请求的标准装配序列（零 DOM 依赖常量 + 纯函数；generateRaw 各站共用）。
// 收编口径：只收「各站逐字节一致」的部分——九元素中段；各站首尾（破限头 / 尾部破限 / 任务 system
// 段）、custom_api、一次性注入块差异保留在站内。
// 破限头与尾部破限统一走 core/jailbreak-config 的段数组解析器（...getJailbreakHeadPrompts() /
// ...getJailbreakTailPrompts()），本模块不再提供字符串版整串装配（旧装配函数已删，只留中段与上下文常量）。

/** 九元素中段：world_info_before → user_input（原生槽位序列，全部 generateRaw 站共用）。 */
export const STANDARD_PROMPT_MIDDLE = [
  'world_info_before',
  'persona_description',
  'char_description',
  'char_personality',
  'scenario',
  'world_info_after',
  'dialogue_examples',
  'chat_history',
  'user_input',
] as const;

/** 标准请求的 max_chat_history：0 上下文（原生 chat_history 不带楼层，剧情上下文走资料块注入）。 */
export const STANDARD_MAX_CHAT_HISTORY = 0;

/**
 * 一次性「触发注入 + 剧情上下文资料块」（calendar / shop-story 孪生站逐字节同形，收编为共享件）：
 * triggerId/position:none/should_scan:true 喂激活素材；contextId/after_system/should_scan:false
 * 走资料块（发给 AI 不参与扫描）。storyContext 由调用方解析后传入（各站上下文条数配置不同）。
 * 必须放在每次重试尝试内执行：once:true 只对下一次生成生效，重试若在注入之外会丢素材。
 */
export function injectTriggerAndContext(
  th: { injectPrompts?: (prompts: unknown[], opts?: { once?: boolean }) => unknown },
  opts: { triggerId: string; contextId: string; storyContext: string; extraPrompt?: string; charNames: string[] },
): void {
  if (typeof th?.injectPrompts !== 'function') return;
  const { triggerId, contextId, storyContext, extraPrompt, charNames } = opts;
  if (charNames.length > 0 || storyContext) {
    th.injectPrompts([{
      id: triggerId,
      position: 'none',
      depth: 0,
      role: 'system',
      content: [charNames.join(' '), extraPrompt?.trim() || '', storyContext].filter(Boolean).join('\n\n'),
      should_scan: true,
    }], { once: true });
  }
  // 资料块注入（after_system，发给 AI 不参与扫描）：与触发注入共用同一份剧情上下文（1A 三段式统一结构）。
  if (storyContext) {
    th.injectPrompts([{
      id: contextId,
      position: 'after_system',
      depth: 0,
      role: 'system',
      content: '【剧情上下文（最近剧情的 AI 回复节选，供与既有剧情保持一致）】\n' + storyContext,
      should_scan: false,
    }], { once: true });
  }
}
