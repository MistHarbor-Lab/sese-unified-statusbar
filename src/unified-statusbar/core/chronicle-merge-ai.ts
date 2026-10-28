import { getTavernHelper } from './env';
// ===== 纪要合并 AI 请求（照搬 calendar-ai.ts 骨架） =====
// [LEGACY-MERGE · DB-ONLY] 仅真数据库模式可用；台账接管时由台账 core/summary-merge.ts 接管。
// 计划后续版本随状态栏合并一起移除（台账侧提示词/解析是独立实现，不受影响）。
// 单次请求 + 解析 + 字数校验；重试由 chronicle-merge-engine.ts 的段循环控制。
// 设计文档：docs/superpowers/specs/2026-07-26-chronicle-merge-design.md §3.4

import { getCustomApiConfig, validateCustomApiConfig } from './api-config';
import { showEnvNotReady, showGenOutputError, showApiConfigError } from './notify-presets';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import { stripTailSafeBlock } from './ai-parse';
import type { ChronicleRow, MergeAttemptResult } from './chronicle-merge-engine';


function mergeRules(maxWords: number): string {
  return `
[合并规则]
1. 概览(summary)：一句话概括这N条合并后的整体内容，必须体现涉及的互动角色名、地点、重要事件或变化伏笔。≤80字。
2. 纪要正文(chronicle_text)：以无损压缩体重述这N条纪要的全部信息。必须保留：
   - 所有延续到后文的约定、计划、伏笔
   - 状态变化（人物关系变化、身份/态度变化、关系里程碑）
   - 重大转折与因果关系
   - 重要数字（金额、次数、时间点、数量等）
   - 每一个重要角色的出场与互动
   - 推动剧情的关键行为
   移除所有修辞与对话原文。不加评论，不抒情，不升华。行文生活化，用词直白，文字基调积极向上。避免「达成协议」「确立计划」等正式措辞。
   结尾必须保持开放，不得归纳状态、给出结论性评价或封闭式收束，在事件自然流动中结束。
   禁止内容：极端情绪、夸张、比喻、升华、情绪总结、支配欲、掌控欲、总结性收尾。
   ≤${maxWords}字。
3. 重要对话(key_dialogue)：每行使用“说话人：原文台词”格式，最多5条。仅从所有原重要对话中挑选直接推动剧情转折、揭示关键信息、改变人物关系/决策、构成承诺/誓约/约定的最重要1-3句原文台词。排除寒暄、重复、情绪感叹。宁少勿滥——无足够信息量则留空。

[NSFW规范]
涉及性行为的场景，纪要仅记录「行为事实」，严禁记录「感官过程」：
必须记录：谁主动发起/引导、发生了什么行为、体位、高潮次数及强度、身体里程碑（破处/初次后庭/中出等）、过程中的关键对话、事后反应和态度变化。
严禁记录：体液细节、声音/呻吟、节奏力度变化、肌肤触感温度、生殖器交合的文学描写。
本质：把 NSFW 当「性行为事实清单」而非「情色小说摘抄」。

[核心原则]
合并目标=「提供给后续 AI 扮演时不出现记忆错乱或缺失的、保留最大信息量的压缩」。压缩后前因后果与剧情依旧连贯。重要信息=有助于后续剧情推进时给 AI 做参考的内容（人物关系变化、重大转折、重要约定等）。宁可略微啰嗦也不要丢失重要信息。
`;
}

/** 把 N 条纪要拼进提示词的 <entries> 块，返回完整 user_input。 */
export function buildMergeInstruction(entries: ChronicleRow[], maxWords: number): string {
  const entryXml = entries
    .map((e, i) => '<entry n="' + (i + 1) + '"><summary>' + e.summary + '</summary><text>' + e.chronicle_text + '</text><dialogue>' + e.key_dialogue + '</dialogue></entry>')
    .join('\n');
  const n = entries.length;
  return (
    '[System]\n' +
    '你是一个严谨的「客观记忆记录枢纽」与「无损信息压缩器」。任务：把同一故事中按时间顺序排列的 ' +
    n +
    ' 条纪要合并成 1 条，在最大限度保留对后续剧情推进有帮助的信息的前提下进行压缩。合并后必须保证前因后果连贯、剧情不断裂。\n\n' +
    '[Input] 待合并的 ' +
    n +
    ' 条纪要（按时间顺序）：\n' +
    '<entries>\n' +
    entryXml +
    '\n</entries>\n\n' +
    '[Output] 严格遵守以下标签格式，标签外不得有任何文字：\n' +
    '<chronicle>\n' +
    '<summary>合并后概览（≤80字，一句话，体现关键角色名/地点/重要事件或变化伏笔）</summary>\n' +
    '<text>合并后纪要正文（≤' + maxWords + '字，宁可少写不要超出）</text>\n' +
    '<dialogue>从所有原重要对话中挑选最重要、信息量最大的1-3句原文台词；每行使用“说话人：原文台词”格式，最多5条；如原重要对话均无推动剧情价值，留空输出 <dialogue></dialogue></dialogue>\n' +
    '</chronicle>\n\n' + mergeRules(maxWords)
  );
}

/**
 * 从 AI 返回文本提取 <chronicle> 块及三子标签，校验字数。
 * 返回 {ok, data} 或 {ok:false, error}。
 */
export function extractChronicle(text: string): MergeAttemptResult {
  const chron = text.match(/<chronicle>([\s\S]*?)<\/chronicle>/i);
  if (!chron) return { ok: false, error: '未找到 <chronicle> 标签' };
  const inner = chron[1];
  const sumM = inner.match(/<summary>([\s\S]*?)<\/summary>/i);
  const textM = inner.match(/<text>([\s\S]*?)<\/text>/i);
  const dlgM = inner.match(/<dialogue>([\s\S]*?)<\/dialogue>/i);
  if (!sumM || !textM || !dlgM) return { ok: false, error: '缺少 summary/text/dialogue 子标签' };
  const summary = sumM[1].trim();
  const chronicle_text = textM[1].trim();
  const key_dialogue = dlgM[1].trim();
  if (summary.length > 80) return { ok: false, error: '概览超长（' + summary.length + ' > 80）' };
  if (chronicle_text.length > 750) return { ok: false, error: '纪要超长（' + chronicle_text.length + ' > 750）' };
  return { ok: true, data: { summary, chronicle_text, key_dialogue } };
}

/**
 * 单次合并请求（不含重试；重试由 engine 的段循环控制）。
 * 1. 校验 API 配置；2. 组装 user_input + 宏替换；3. generateRaw；4. 解析 + 字数校验。
 */
export async function requestMerge(
  entries: ChronicleRow[],
  maxWords: number,
  ctx?: { generationId?: string; signal?: AbortSignal },
): Promise<MergeAttemptResult> {
  if (entries.length === 0) return { ok: false, error: '空段' };
  if (ctx?.signal?.aborted) return { ok: false, error: '请求已取消' };
  const th = getTavernHelper();
  const generateRaw = th?.generateRaw;
  if (!generateRaw) {
    showEnvNotReady('纪要合并');
    return { ok: false, error: 'generateRaw 不可用' };
  }
  const apiErr = validateCustomApiConfig('chronicleMerge');
  if (apiErr) {
    showApiConfigError('纪要合并', apiErr);
    return { ok: false, error: apiErr };
  }

  try {
    const rawInstruction = buildMergeInstruction(entries, maxWords);
    const instruction = th.substitudeMacros(rawInstruction);
    // 刻意不接「自动重试」：调用方 chronicle-merge-engine 的 runMergeSession 已有
    // 每段独立的重试次数（合并弹窗内设置），再包一层会变成两重重试（段重试 × 网络重试）。
    // 也因此不经统一文本出口，需在本站自行剥掉尾部破限的 <safe> 收尾段。
    const result = await generateRaw({
      should_silence: true,
      generation_id: ctx?.generationId,
      user_input: instruction,
      ordered_prompts: [
        ...getJailbreakHeadPrompts({ antiCliche: true }),
        'user_input',
        ...getJailbreakTailPrompts(),
      ],
      max_chat_history: 0,
      custom_api: getCustomApiConfig('chronicleMerge'),
    });
    if (typeof result !== 'string') {
      showGenOutputError('纪要合并', result);
      return { ok: false, error: 'AI 返回非字符串' };
    }
    return extractChronicle(stripTailSafeBlock(result));
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

