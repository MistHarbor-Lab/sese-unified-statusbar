// ===== 备忘录「AI 规划目标」（1A 三段式同构，对照 wardrobe-runtime 设计请求形态） =====
// 触发注入（position:'none'，仅世界书绿灯扫描）= 玩家要求 + 随机 3 人物名；
// 资料块（after_system，不参与扫描）= 最近 20 条纪要（免名过滤）+ 最近 1 段处理后正文；
// 设置项组合成规则段；输出 <MEMO_GOALS_JSON> 由前端解析，用户勾选后写入备忘录表。
// API 走 'nsfwGuidance' scope（与瑟瑟指导共用独立预设，不设独立 scope）。
import { readStoryClockRaw } from './calendar-core';
import { extractFencedJson } from './text-fence';
import { STANDARD_PROMPT_MIDDLE, STANDARD_MAX_CHAT_HISTORY } from './ai-request-pipeline';
import { getTavernHelper } from './env';
import { getCustomApiConfig, validateCustomApiConfig, withTextAiRetry, type TextAiContext } from './api-config';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import { withNativeScanWorldbook, wbEntryName } from './worldbook-entry';
import { formatChronicleBlocks, isChronicleEntryName } from './chronicle-blocks';
import { readChronicleRows } from './chronicle-rows';
import { getAiReplyContext } from './map-system';
import { collectOutfitModelCandidates } from './wardrobe-roster';
import { looseJsonParse } from './ai-parse';

// ── 风格预设 ──

export interface MemoGoalStyle {
  id: string;
  label: string;
  hint: string;
}

export const MEMO_GOAL_STYLES: readonly MemoGoalStyle[] = [
  { id: 'nsfw', label: 'NSFW欲望', hint: '肉体关系、猎艳、禁忌逾越等欲望向目标' },
  { id: 'growth', label: '自我成长', hint: '实力、技艺、身体、心智的锤炼' },
  { id: 'travel', label: '游历结识', hint: '探索地点、见识风物、结识新人物' },
  { id: 'wealth', label: '财富经营', hint: '金钱、产业、生意与资源积累' },
  { id: 'power', label: '权势名望', hint: '地位、声望、组织与势力经营' },
  { id: 'bond', label: '情感羁绊', hint: '深化与既有角色的关系、情缘进展' },
  { id: 'secret', label: '秘闻探索', hint: '传闻求证、隐藏事件、世界真相与谜团' },
  { id: 'risk', label: '危机冒险', hint: '险途、试炼、战斗与生死挑战' },
];

const MEMO_GOAL_KINDS = ['长期目标', '短期目标', '人物目标'] as const;
export type MemoGoalKind = (typeof MEMO_GOAL_KINDS)[number];

export interface MemoGoalCandidate {
  kind: MemoGoalKind;
  title: string;
  targetDate: string;
  relatedChar: string;
  detail: string;
}

export interface MemoGoalsSettings {
  longCount: number;
  shortCount: number;
  charCount: number;
  styles: string[];
  requirement: string;
}

export const MEMO_GOALS_DEFAULT_SETTINGS: MemoGoalsSettings = {
  longCount: 2,
  shortCount: 3,
  charCount: 3,
  styles: [],
  requirement: '',
};

// ── 随机人物（请求时前端自行随机，用户不感知） ──

export function pickRandomGoalNames(pool: readonly string[], count: number): string[] {
  const names = Array.from(new Set(pool.map(n => String(n || '').trim()).filter(Boolean)));
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names.slice(0, Math.max(0, count));
}

// ── 提示词组装 ──

const MEMO_GOALS_COUNT_KEYS: Array<[keyof Pick<MemoGoalsSettings, 'longCount' | 'shortCount' | 'charCount'>, MemoGoalKind]> = [
  ['longCount', '长期目标'],
  ['shortCount', '短期目标'],
  ['charCount', '人物目标'],
];

function clampGoalCount(value: number): number {
  const n = Math.floor(Number(value) || 0);
  return Math.min(5, Math.max(0, n));
}

/** 设置项 + 随机人物 + 当前游戏时间 → 规则段（system）与玩家段（userInput）。 */
export function buildMemoGoalsRequest(
  settings: MemoGoalsSettings,
  names: readonly string[],
  currentTimeText: string,
): { system: string; userInput: string } {
  const counts = MEMO_GOALS_COUNT_KEYS.map(([key, kind]) => `${clampGoalCount(settings[key])} 个${kind}`).join('、');
  const styleLabels = MEMO_GOAL_STYLES.filter(style => settings.styles.includes(style.id));
  const stylesText = styleLabels.length
    ? `本次限定在以下方向内取材：${styleLabels.map(style => `${style.label}（${style.hint}）`).join('；')}。`
    : '本次不限方向，自由取材。';
  const nsfwSelected = settings.styles.includes('nsfw');
  const namesText = names.length ? names.join('、') : '（暂无，使用剧情与世界书中其他真实人物）';
  const system = `你是「目标规划师」。你的任务不是续写剧情，而是为玩家设计在这个世界里值得追求的目标——当玩家不知道接下来该做什么时，这些目标就是方向。

【本次任务】生成 ${counts}（某类数量为 0 就不输出该类）。

【三类目标的定义】
- 长期目标：横跨多段剧情、需要长期投入的大追求，是一段弧线而不是一件事。
- 短期目标：当前就能着手、近期剧情内可完成或明显推进的事。
- 人物相关目标：以一个具体角色为核心展开的目标，relatedChar 必填该角色姓名。

【创作铁律】
1. 目标必须脱离主角当前的剧情线：不复述、不延续最近剧情正在发生的事件，假设玩家想找点别的事做。
2. 目标必须扎根世界观：从世界书、纪要与最近剧情中取材（地点、组织、习俗、人物、传闻、未解之处），让目标像这个世界里真实存在的机会。
3. 禁止空泛目标：不要「变强」「赚钱」这类口号，要给出具体的、有画面感的、最好出人意料的实现路径。
4. 每条目标的详细内容写清来龙去脉与达成方式：为什么值得做、具体怎么做、怎样算达成。
5. 风格方向：${stylesText}${nsfwSelected ? '选中了 NSFW欲望，目标可以直白露骨。' : '未选中 NSFW欲望，避免露骨内容。'}
6. 目标日期（targetDate）：参考当前游戏内日期「${currentTimeText || '未知'}」合理推算，短期目标尽量给出；长期目标可以留空。日期沿用该世界观自身的纪年写法。

【输出契约】标签外不得有任何文字，严格输出：
<MEMO_GOALS_JSON>
{"goals":[{"kind":"长期目标|短期目标|人物目标","title":"目标名，不超过20字","targetDate":"目标日期，可留空","relatedChar":"人物目标的角色名，其余留空","detail":"目标详情，60~150字"}]}
</MEMO_GOALS_JSON>`;
  const requirement = String(settings.requirement || '').trim();
  const userInput = `【玩家要求】
${requirement || '（无特别要求，自由发挥）'}

【可选人物素材】${namesText}
人物相关目标优先从以上人物中取材，也可使用剧情与世界书中其他真实存在的人物。

请严格按输出契约生成目标。`;
  return { system, userInput };
}

/** 触发注入内容（仅作世界书绿灯扫描素材，不发给 AI）：玩家要求 + 随机人物名。 */
export function buildMemoGoalsTrigger(requirement: string, names: readonly string[]): string {
  return [
    names.length ? `随机指派人物：${names.join('、')}` : '',
    requirement ? `玩家要求：${requirement}` : '',
  ].filter(Boolean).join('\n');
}

// ── 解析 ──

function parseTaggedGoalsJson(result: string): any | null {
  if (!result) return null;
  const match = result.match(/<MEMO_GOALS_JSON>([\s\S]*?)<\/MEMO_GOALS_JSON>/i);
  const raw = extractFencedJson(match ? match[1] : result);
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_e) {
    // 修复链兜底（ai-parse）：未转义引号/尾逗号/截断也能恢复。
    const repaired = looseJsonParse(raw);
    return repaired.ok && repaired.value && typeof repaired.value === 'object' ? repaired.value : null;
  }
}

/** 解析 AI 输出 → 候选目标。kind 白名单校验、字段截断、按 kind+标题去重、逐类按请求数量封顶。 */
export function parseMemoGoalsResult(
  result: string,
  settings: MemoGoalsSettings,
): MemoGoalCandidate[] {
  const parsed = parseTaggedGoalsJson(result);
  if (!parsed || !Array.isArray(parsed.goals)) return [];
  const caps: Record<MemoGoalKind, number> = {
    '长期目标': clampGoalCount(settings.longCount),
    '短期目标': clampGoalCount(settings.shortCount),
    '人物目标': clampGoalCount(settings.charCount),
  };
  const seen = new Set<string>();
  const out: MemoGoalCandidate[] = [];
  for (const raw of parsed.goals) {
    if (!raw || typeof raw !== 'object') continue;
    const kind = String(raw.kind ?? '').trim() as MemoGoalKind;
    if (!MEMO_GOAL_KINDS.includes(kind)) continue;
    if (out.filter(g => g.kind === kind).length >= caps[kind]) continue;
    const title = String(raw.title ?? '').trim().slice(0, 40);
    const detail = String(raw.detail ?? '').trim().slice(0, 800);
    if (!title || !detail) continue;
    const key = `${kind}\u0001${title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      kind,
      title,
      targetDate: String(raw.targetDate ?? '').trim().slice(0, 40),
      relatedChar: kind === '人物目标' ? String(raw.relatedChar ?? '').trim().slice(0, 30) : '',
      detail,
    });
  }
  return out;
}

// ── 写入映射 ──

/** 候选 → 备忘录表行（记录时间=前端生成的游戏内日期 YYYY-MM-DD，可空）。 */
export function buildMemoRecord(goal: MemoGoalCandidate, recordTime: string): Record<string, string> {
  const record: Record<string, string> = {
    '备忘标题': goal.title,
    '类型': goal.kind,
    '详细内容': goal.detail,
    '当前状态': '未开始',
  };
  if (goal.kind === '人物目标' && goal.relatedChar) record['相关角色'] = goal.relatedChar;
  if (goal.targetDate) record['约定时间'] = goal.targetDate;
  if (recordTime) record['记录时间'] = recordTime;
  return record;
}

// ── 1A 三段式请求 ──

const MEMO_GOALS_CHRONICLE_COUNT = 20;

function buildMemoGoalsDossier(chronicleBlocks: string, storyContext: string): string {
  const parts: string[] = [];
  if (chronicleBlocks) parts.push(`【剧情纪要（从旧到新，世界与人物的前史坐标）】\n${chronicleBlocks}`);
  if (storyContext) parts.push(`【剧情上下文（最近剧情的 AI 回复节选，目标须脱离这段当前剧情）】\n${storyContext}`);
  return parts.join('\n\n');
}

function readLatestChronicleBlocks(total: number): string {
  const rows = readChronicleRows();
  if (!rows || !rows.length) return '';
  const latest = [...rows]
    .sort((a, b) => Number(b.row_id) - Number(a.row_id))
    .slice(0, Math.max(1, total))
    .map(row => ({
      timeSpan: row.time_span,
      summary: row.summary,
      chronicleText: row.chronicle_text,
      keyDialogue: row.key_dialogue,
    }))
    .reverse(); // 展示从旧到新（时间正序，全用方统一定案）
  const blocks = formatChronicleBlocks(latest, { overview: 0, full: latest.length });
  return blocks === '（暂无纪要）' ? '' : blocks;
}

/**
 * 生成目标候选（1A 三段式）。成功返回候选列表（可能少于请求数量），失败抛错由 UI 呈现。
 * 不做过滤豁免（不传 keep）：[UBS手机] 前缀条目按内置规则全族剔除；数据库纪要条目因纪要
 * 已走资料块而按请求 suspend，防止重复回喂。
 */
export async function generateMemoGoals(
  settings: MemoGoalsSettings,
  signal?: AbortSignal,
): Promise<MemoGoalCandidate[]> {
  if (signal?.aborted) throw new Error('请求已取消');
  // 与瑟瑟指导共用独立 API 预设（用户定案：不设独立 scope）
  const apiError = validateCustomApiConfig('nsfwGuidance');
  if (apiError) throw new Error(apiError);
  const helper = getTavernHelper();
  if (!helper || typeof helper.generateRaw !== 'function') throw new Error('无法访问 generateRaw');

  const names = pickRandomGoalNames(collectOutfitModelCandidates() ?? [], 3);
  const chronicleBlocks = readLatestChronicleBlocks(MEMO_GOALS_CHRONICLE_COUNT);
  const storyContext = getAiReplyContext(1);
  let currentTimeText = '';
  try { currentTimeText = readStoryClockRaw(); } catch (_e) { /* ignore */ }

  const trigger = buildMemoGoalsTrigger(String(settings.requirement || ''), names);
  const dossier = buildMemoGoalsDossier(chronicleBlocks, storyContext);
  const request = buildMemoGoalsRequest(settings, names, currentTimeText);
  return withTextAiRetry('nsfwGuidance', async (ctx: TextAiContext) => {
    // 一次性注入必须随每次尝试重做：once:true 只在下一次生成生效，放在重试之外会让重试那一发丢掉资料块。
    if (trigger && typeof helper.injectPrompts === 'function') {
      helper.injectPrompts([{
        id: 'memo_goals_trigger',
        position: 'none',          // 不发给 AI，只作为世界书绿灯条目的扫描素材
        depth: 0,
        role: 'system',
        content: trigger,
        should_scan: true,
      }], { once: true });
    }
    if (dossier && typeof helper.injectPrompts === 'function') {
      helper.injectPrompts([{
        id: 'memo_goals_context',
        position: 'after_system',  // 发给 AI，不参与扫描
        depth: 0,
        role: 'system',
        content: dossier,
        should_scan: false,
      }], { once: true });
    }
    let userInput = `${request.system}\n\n${request.userInput}`;
    try {
      if (typeof helper.substitudeMacros === 'function') userInput = helper.substitudeMacros(userInput);
    } catch (_e) { /* 展宏失败用原文 */ }
    const result = await withNativeScanWorldbook(
      { suspend: entry => isChronicleEntryName(wbEntryName(entry)) },
      () => helper.generateRaw({
        should_silence: true,
        generation_id: ctx.generationId,
        user_input: userInput,
        ordered_prompts: [
          ...getJailbreakHeadPrompts({ antiCliche: true }),
          ...STANDARD_PROMPT_MIDDLE,
          ...getJailbreakTailPrompts(),
        ],
        max_chat_history: STANDARD_MAX_CHAT_HISTORY,
        custom_api: getCustomApiConfig('nsfwGuidance'),
      }),
    );
    if (signal?.aborted) throw new Error('请求已取消');
    if (typeof result !== 'string' || !result.trim()) throw new Error('AI 返回为空');
    const goals = parseMemoGoalsResult(result, settings);
    if (!goals.length) throw new Error('未能从 AI 输出中解析出有效目标，请重试');
    return goals;
  }, { signal, feature: 'memoGoals' });
}
