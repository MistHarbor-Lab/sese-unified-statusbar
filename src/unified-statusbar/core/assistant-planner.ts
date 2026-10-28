// ===== 宅仙只读 AI 小助手 · 受约束资料规划 =====
import { buildPlannerInstruction } from './assistant-persona';
import type { AssistantSourceCatalogItem, SourceSelection } from './assistant-sources';

export interface PlannerReply {
  sources: string[];
  terms: string[];
  reason: string;
}

export interface ManualSourceOverride {
  include: string[];
  exclude: string[];
  tableNames: string[];
}

export interface ResolvedSourceSelection extends SourceSelection {
  reason: string;
  usedFallback: boolean;
}

const MAX_EXTRA_SOURCES = 8;
const MAX_TERMS = 12;
const MAX_TERM_CODE_POINTS = 48;
const MAX_REASON_CODE_POINTS = 240;

function clipCodePoints(value: unknown, max: number): string {
  return Array.from(String(value ?? '').trim()).slice(0, max).join('');
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function uniqueStrings(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

/** 只接受无额外字段的宿主协议；Markdown fence、解释文字和错误类型一律判无效。 */
export function parsePlannerReply(raw: string): PlannerReply | null {
  try {
    const parsed = JSON.parse(String(raw ?? '').trim());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const keys = Object.keys(parsed).sort();
    if (keys.join('|') !== 'reason|sources|terms') return null;
    if (!Array.isArray(parsed.sources) || !parsed.sources.every((value: unknown) => typeof value === 'string')) return null;
    if (!Array.isArray(parsed.terms) || !parsed.terms.every((value: unknown) => typeof value === 'string')) return null;
    if (typeof parsed.reason !== 'string') return null;
    return { sources: [...parsed.sources], terms: [...parsed.terms], reason: parsed.reason };
  } catch (_e) {
    return null;
  }
}

function availableCatalog(catalog: readonly AssistantSourceCatalogItem[]): AssistantSourceCatalogItem[] {
  return catalog.filter(item => item && item.available !== false && typeof item.id === 'string');
}

/** 白名单求交、去重和硬上限；reason 从不参与选择。 */
export function validatePlan(
  plan: PlannerReply | null | undefined,
  catalog: readonly AssistantSourceCatalogItem[],
): PlannerReply {
  const allowed = new Set(availableCatalog(catalog).map(item => item.id));
  const sources: string[] = [];
  let extraCount = 0;
  for (const id of uniqueStrings(plan?.sources || [])) {
    if (!allowed.has(id)) continue;
    if (!id.startsWith('help:')) {
      if (extraCount >= MAX_EXTRA_SOURCES) continue;
      extraCount += 1;
    }
    sources.push(id);
  }
  const terms = uniqueStrings(plan?.terms || [])
    .map(term => clipCodePoints(term, MAX_TERM_CODE_POINTS))
    .filter(Boolean)
    .slice(0, MAX_TERMS);
  return {
    sources,
    terms,
    reason: clipCodePoints(plan?.reason || '', MAX_REASON_CODE_POINTS),
  };
}

function questionTerms(question: string): string[] {
  return uniqueStrings(String(question || '').split(/[\s,，。；;：:！？!?、/\\|]+/))
    .map(term => clipCodePoints(term, MAX_TERM_CODE_POINTS))
    .filter(Boolean)
    .slice(0, MAX_TERMS);
}

export { questionTerms };

function itemMatchesQuestion(item: AssistantSourceCatalogItem, questionNorm: string): boolean {
  if (!questionNorm) return false;
  const candidates = [item.title, ...item.keywords].map(normalize).filter(Boolean);
  return candidates.some(candidate => questionNorm.includes(candidate));
}

/** 纯本地、确定性的保守降级：只选命中的少量来源，从不“全选”。 */
export function fallbackSourceSelection(
  question: string,
  catalog: readonly AssistantSourceCatalogItem[],
): PlannerReply {
  const available = availableCatalog(catalog);
  const q = normalize(question);
  const selected: string[] = [];
  const add = (id: string) => { if (!selected.includes(id)) selected.push(id); };

  for (const item of available) {
    if (item.id.startsWith('help:') && itemMatchesQuestion(item, q)) add(item.id);
  }
  // 当前设置状态类问题：本地降级也读脱敏设置快照（显式设置词，或 当前状态标记+设置域名词）
  if (available.some(item => item.id === 'settings')
    && (/(?:我的|现在|当前|目前|此刻|读取|看看|查看)(?:设置|配置|设定)|(?:设置|配置)(?:情况|成了|值|内容|有哪些|都)/.test(q)
      || (/现在|目前|当前|此刻|我的|我/.test(q) && /设置|配置|风格|主题|样式|模式|布局|界面|状态栏|口吻|开关|能量|数值|档位|字号|折叠|深色|浅色|暗色|宽度|高度|方案|尺寸|上下文/.test(q)))) {
    add('settings');
  }
  if (/(?:剧情|故事|最近|发生|关系|人物关系|地点|场景)/.test(q) && available.some(item => item.id === 'story')) add('story');
  if (/(?:世界书|设定卷|设定|绿灯)/.test(q) && available.some(item => item.id === 'worldbook')) add('worldbook');
  for (const item of available) {
    if (item.id.startsWith('table:')) {
      const tableName = normalize(item.metadata?.tableName || item.id.slice('table:'.length));
      if (tableName && q.includes(tableName)) add(item.id);
    } else if (item.id.startsWith('plugin:') && itemMatchesQuestion(item, q)) {
      add(item.id);
    }
  }
  const validated = validatePlan({
    sources: selected,
    terms: questionTerms(question),
    reason: '规划输出无效，已按问题关键词在本地选择资料。',
  }, available);
  return validated;
}

function tableIdsForExactNames(
  names: readonly string[],
  catalog: readonly AssistantSourceCatalogItem[],
): string[] {
  const wanted = new Set(names.map(normalize).filter(Boolean));
  if (!wanted.size) return [];
  return availableCatalog(catalog).filter(item => {
    if (!item.id.startsWith('table:')) return false;
    const tableName = normalize(item.metadata?.tableName || item.id.slice('table:'.length));
    return wanted.has(tableName);
  }).map(item => item.id);
}

/** 层级帮助锚点：命中 help:<feature>:<topic> 细节条目时自动附带其父总览（存在才附）。 */
function expandHelpAnchors(sources: readonly string[], catalog: readonly AssistantSourceCatalogItem[]): string[] {
  const allowed = new Set(availableCatalog(catalog).map(item => item.id));
  const out = [...sources];
  for (const id of sources) {
    const match = /^help:([^:]+):/.exec(id);
    if (!match) continue;
    const parent = `help:${match[1]}`;
    if (allowed.has(parent) && !out.includes(parent)) out.push(parent);
  }
  return out;
}

/** 用户排除是最终否决；include/tableNames 只能强制加入已登记且可用的来源。 */
export function resolveSourceSelection(
  plan: PlannerReply | null | undefined,
  catalog: readonly AssistantSourceCatalogItem[],
  override: ManualSourceOverride = { include: [], exclude: [], tableNames: [] },
  question = '',
): ResolvedSourceSelection {
  const usedFallback = !plan;
  const base = usedFallback ? fallbackSourceSelection(question, catalog) : validatePlan(plan, catalog);
  const allowed = new Set(availableCatalog(catalog).map(item => item.id));
  const excluded = new Set(uniqueStrings(override.exclude || []).filter(id => allowed.has(id)));
  const forcedTables = tableIdsForExactNames(override.tableNames || [], catalog);
  const forcedIncludes = uniqueStrings(override.include || []).filter(id => allowed.has(id));
  const combined = uniqueStrings([...base.sources, ...forcedTables, ...forcedIncludes]).filter(id => !excluded.has(id));
  const anchored = expandHelpAnchors(combined, catalog).filter(id => !excluded.has(id));
  const validated = validatePlan({ ...base, sources: anchored }, catalog);
  return { ...validated, usedFallback };
}

/** 只把安全目录元数据交给模型规划器；帮助条目只传 id+标题（关键词对固定 27 条目录是重复注入）。 */
export function buildPlannerPrompt(catalog: readonly AssistantSourceCatalogItem[]): string {
  return buildPlannerInstruction(availableCatalog(catalog).map(item => (
    item.family === 'help'
      ? { id: item.id, title: item.title }
      : { id: item.id, title: item.title, keywords: item.keywords, metadata: item.metadata }
  )));
}
