// ===== 宅仙只读 AI 小助手 · 本地意图路由（快路径） =====
// 在规划器模型调用之前做确定性分流：明确意图的问题直接给出资料选择，省一次调用；
// 模糊、复合或零命中时返回 null 交规划器（planner 路径与本地降级保持原样）。
//
// 路由原则（保守优先，宁走慢路径不误路由）：
//   - 功能使用类问句且帮助目录命中 → 只选帮助条目。用法词分两档：
//     强词（怎么/如何/用法…）直接优先帮助；弱词（在哪/哪里…）只有在没有任何
//     数据家族命中时才优先帮助（“地图探索到哪里了”是状态问句，不是功能问句）；
//   - 状态/数据类问句按唯一命中家族路由（剧情→剧情+世界书、表名精确、插件关键词）；
//   - 任意多家族同时命中或零命中 → null（规划器决策）。
import { questionTerms } from './assistant-planner';
import type { PlannerReply } from './assistant-planner';
import type { AssistantSourceCatalogItem } from './assistant-sources';

const STRONG_USAGE_RE = /怎么|怎样|如何|用法|使用|操作|设置|开启|关闭|启用|禁用|是什么|介绍|帮助|教程|功能|入口|按钮/;
const WEAK_USAGE_RE = /在哪|哪里|哪儿|哪个/;
const STORY_RE = /剧情|故事|最近|刚才|之前|上文|聊天记录|发生了|发生过|说了什么|人物关系|关系进展|当前场景/;
const WORLDBOOK_RE = /世界书|设定卷|设定|蓝灯|绿灯|lorebook/i;
/** 当前设置状态类问句：问的是"现在设置/配置成什么样"。 */
const SETTINGS_LITERAL_RE = /(?:我的|现在|当前|目前|此刻|读取|看看|查看)(?:设置|配置|设定)|(?:设置|配置)(?:情况|成了|值|内容|有哪些|都)/;
/** 当前状态标记：提到"现在/当前/我的"等，说明在问当前值而非用法。 */
const SETTINGS_MARKER_RE = /现在|目前|当前|此刻|我的|我/;
/** 设置域名词：主题/风格/模式/开关/能量/字号/布局等，命中即可能是当前设置值问题。 */
const SETTINGS_NOUN_RE = /设置|配置|风格|主题|样式|模式|布局|界面|状态栏|口吻|开关|能量|数值|档位|字号|折叠|深色|浅色|暗色|宽度|高度|方案|尺寸|上下文/;

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function availableItems(catalog: readonly AssistantSourceCatalogItem[]): AssistantSourceCatalogItem[] {
  return catalog.filter(item => item && item.available !== false && typeof item.id === 'string');
}

/** 条目标题或关键词被问题包含（与 planner 降级同款命中口径）。 */
function itemMatchesQuestion(item: AssistantSourceCatalogItem, questionNorm: string): boolean {
  if (!questionNorm) return false;
  return [item.title, ...item.keywords]
    .map(normalize)
    .filter(Boolean)
    .some(candidate => questionNorm.includes(candidate));
}

function routed(sources: string[], question: string, reason: string): PlannerReply {
  return { sources, terms: questionTerms(question), reason };
}

/**
 * 本地意图路由：返回明确意图的资料选择；null 表示意图不明确，须走规划器。
 * 输出是 PlannerReply 形状，仍经 resolveSourceSelection 合并手动覆盖并过 validatePlan 限额。
 */
export function routeQuestion(
  question: string,
  catalog: readonly AssistantSourceCatalogItem[],
): PlannerReply | null {
  const q = normalize(question);
  if (!q) return null;
  const available = availableItems(catalog);

  // 数据家族命中统计（帮助家族不参与状态路由：功能知识不是数据）
  const storyHit = STORY_RE.test(q) && available.some(item => item.id === 'story');
  const worldbookHit = WORLDBOOK_RE.test(q) && available.some(item => item.id === 'worldbook');
  const tableHits = available
    .filter(item => item.family === 'table' && q.includes(normalize(item.metadata?.tableName || item.id.slice('table:'.length))))
    .map(item => item.id);
  const pluginHits = available
    .filter(item => item.family === 'plugin' && itemMatchesQuestion(item, q))
    .map(item => item.id);
  const hasDataHit = storyHit || worldbookHit || tableHits.length > 0 || pluginHits.length > 0;

  // 0) 当前设置状态类：明确读"现在设置/配置成什么样"，给脱敏设置快照数据
  //    （放在帮助家族之前，避免 "我的设置是什么/我现在用的是什么风格" 被用法路由抢走）
  //    命中口径：显式设置词，或（当前状态标记 + 设置域名词）且未命中明确数据家族。
  const settingsAvailable = available.some(item => item.id === 'settings');
  if (settingsAvailable && (SETTINGS_LITERAL_RE.test(q) || (SETTINGS_MARKER_RE.test(q) && SETTINGS_NOUN_RE.test(q) && !hasDataHit))) {
    return routed(['settings'], question, '本地路由：当前设置/配置状态查询，已选脱敏设置快照。');
  }

  // 1) 功能使用类：强用法词直接优先帮助；弱用法词仅在没有数据命中时优先帮助
  const helpHits = available
    .filter(item => item.family === 'help' && itemMatchesQuestion(item, q))
    .map(item => item.id);
  // 帮助库为两层条目制（~80 条）：一次命中过多说明问题宽泛，快路径不裁决，交规划器精选
  if (helpHits.length && helpHits.length <= 4 && (STRONG_USAGE_RE.test(q) || (WEAK_USAGE_RE.test(q) && !hasDataHit))) {
    return routed(helpHits, question, '本地路由：功能使用类问题，已匹配帮助条目。');
  }

  // 2) 状态/数据类：唯一命中家族才路由，多家族或零命中交规划器
  const families: string[] = [];
  if (storyHit) families.push('story');
  if (worldbookHit) families.push('worldbook');
  if (tableHits.length) families.push('table');
  if (pluginHits.length) families.push('plugin');
  if (!families.length) return null;

  const only = (...wanted: string[]) => families.length === wanted.length && families.every(f => wanted.includes(f));
  if (only('story')) {
    // 剧情类问题附上世界书（蓝灯全量+绿灯按近期剧情触发），等价于模型在该卡上下文本能看到的内容
    const worldbookReady = available.some(item => item.id === 'worldbook');
    const sources = worldbookReady ? ['story', 'worldbook'] : ['story'];
    return routed(sources, question, '本地路由：剧情类问题，已选最近剧情与激活世界书。');
  }
  if (only('worldbook')) return routed(['worldbook'], question, '本地路由：世界书/设定类问题。');
  if (only('story', 'worldbook')) return routed(['story', 'worldbook'], question, '本地路由：剧情与设定类问题。');
  if (only('table')) return routed(tableHits, question, '本地路由：命中数据表名。');
  if (only('plugin')) return routed(pluginHits, question, '本地路由：命中插件资料关键词。');
  return null;
}
