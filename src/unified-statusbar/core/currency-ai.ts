// ===== 货币系统 · AI 币种生成 =====
// 「✦ AI 生成货币」按钮：结合当前世界书/角色卡世界观产出 1~3 个货币提案（JSON），
// 前端确认后入库（按名称去重、初始数量 0）。
// 1A 同构三段式（结构对齐 shop-story / calendar 站）：结构头(基础破限) → 原生世界书槽位
// → user_input(任务规则) → 结构尾(无害化收尾)；扫描前经 withNativeScanWorldbook 做黑名单
// 剔除/EJS 预渲染。max_chat_history:0 后原生 chat_history 不带楼层、user_input 不参与绿灯
// 扫描——激活素材只由注入喂入。注入内容（用户定案 2026-10-05）：
//   触发注入 = 仅扫描词「货币 金钱」两个词（position:none，只扫描不发给 AI）；
//   资料块   = 最近 2 层 AI 回复正文（过上下文标签剥离，标题仅【剧情上下文】，
//              position:after_system）。
// 触发与资料两块内容不同源，不走共享的孪生注入件，按 interview 站先例手工双注入。
// API 独立设置与宅仙小助手共用一个绑定（assistantApiPresetId，不走全局 apiMode 分配），
// 重试作用域同为 assistant。
import { getTavernHelper } from './env';
import { parseJsonWith } from './safe-json';
import { getAssistantApiConfig, validateAssistantApiConfig, withTextAiRetry, type TextAiContext } from './api-config';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import { STANDARD_PROMPT_MIDDLE, STANDARD_MAX_CHAT_HISTORY } from './ai-request-pipeline';
import { withNativeScanWorldbook } from './worldbook-entry';
import { getAiReplyContext } from './map-system';
import { CURRENCY_ICONS, type CurrencyIcon, type CurrencyMeta, makeCurrencyId } from './currency';

export interface CurrencyProposal {
  name: string;
  desc: string;
  icon: CurrencyIcon;
  precision: 0 | 2;
}

/** 触发注入扫描词：仅「货币 金钱」两个词，激活关键词命中它们的绿灯条目。 */
const CURRENCY_SCAN_TERMS = '货币 金钱';

/** 资料块取最近 2 层 AI 回复正文（getAiReplyContext 自带上下文标签剥离）。 */
const CURRENCY_CONTEXT_TURNS = 2;

function buildProposalInstruction(): string {
  return [
    '执行货币体系设计任务，停止剧情推进。请根据当前世界书与角色卡的世界观，为该世界设计 1~3 种流通货币。',
    '要求：货币名称贴合世界观（仙侠/武侠/现代/西幻等，按上下文实际背景），每种货币附一句 ≤40 字的描述；',
    '名称不得与上下文中已出现的货币重复；现代现实背景用人民币等法币（precision=2），古代/幻想背景用整数货币（precision=0）。',
    '只输出 JSON 数组，不要输出任何其他文字或代码围栏。格式：',
    '[{"name":"货币名","desc":"一句描述","icon":"coin|coin-jade|coin-gold|coin-ingot|coin-copper|coin-cash","precision":0}]',
  ].join('\n');
}

/** 剥代码围栏 + 括号平衡截取首个 JSON 数组。 */
function extractJsonArray(raw: string): unknown[] | null {
  let text = String(raw ?? '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('[');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        // U33：收编 parseJsonWith
        const parsed = parseJsonWith<unknown>(text.slice(start, i + 1), null);
        return Array.isArray(parsed) ? parsed : null;
      }
    }
  }
  return null;
}

function normalizeProposal(raw: unknown): CurrencyProposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const name = String(v.name ?? '').trim();
  if (!name || name.length > 20) return null;
  const iconRaw = String(v.icon ?? 'coin');
  const icon = ((CURRENCY_ICONS as readonly string[]).includes(iconRaw) ? iconRaw : 'coin') as CurrencyIcon;
  return {
    name,
    desc: String(v.desc ?? '').slice(0, 60),
    icon,
    precision: v.precision === 2 ? 2 : 0,
  };
}

/** 请求 AI 货币提案（1~3 个）。失败抛错由调用方 toast。 */
export async function requestCurrencyProposals(signal?: AbortSignal): Promise<CurrencyProposal[]> {
  if (signal?.aborted) throw new Error('请求已取消');
  const apiError = validateAssistantApiConfig();
  if (apiError) throw new Error(apiError);
  const helper = getTavernHelper();
  if (!helper || typeof helper.generateRaw !== 'function') throw new Error('无法访问 generateRaw');

  let instruction = buildProposalInstruction();
  if (typeof helper.substitudeMacros === 'function') {
    instruction = helper.substitudeMacros(instruction);
  }

  const raw = await withTextAiRetry('assistant', async (ctx: TextAiContext) => {
    // 每次尝试都要重做「一次性注入 + 扫描准备 + 生成」：once:true 只对下一次生成生效，
    // 重试若在注入之外会丢掉触发素材与资料块。
    if (typeof helper.injectPrompts === 'function') {
      helper.injectPrompts([{
        id: 'currency_gen_trigger',
        position: 'none',        // 不发给 AI，只作为世界书绿灯条目的扫描素材
        depth: 0,
        role: 'system',
        content: CURRENCY_SCAN_TERMS,
        should_scan: true,
      }], { once: true });
      const storyContext = getAiReplyContext(CURRENCY_CONTEXT_TURNS);
      if (storyContext) {
        helper.injectPrompts([{
          id: 'currency_gen_context',
          position: 'after_system', // 发给 AI，不参与扫描
          depth: 0,
          role: 'system',
          content: '【剧情上下文】\n' + storyContext,
          should_scan: false,
        }], { once: true });
      }
    }
    const result = await withNativeScanWorldbook({}, () => helper.generateRaw({
      should_silence: true,
      generation_id: ctx.generationId,
      user_input: instruction,
      ordered_prompts: [
        ...getJailbreakHeadPrompts(),
        ...STANDARD_PROMPT_MIDDLE,
        ...getJailbreakTailPrompts(),
      ],
      max_chat_history: STANDARD_MAX_CHAT_HISTORY,
      custom_api: getAssistantApiConfig(),
    }));
    if (signal?.aborted) throw new Error('请求已取消');
    if (typeof result !== 'string' || !result.trim()) throw new Error('AI 返回为空');
    return result;
  }, { signal, feature: 'currencyProposal' });
  const arr = extractJsonArray(raw);
  if (!arr) throw new Error('AI 返回格式无法解析');
  const proposals = arr.map(normalizeProposal).filter((x): x is CurrencyProposal => x !== null).slice(0, 3);
  if (!proposals.length) throw new Error('AI 未给出有效提案');
  return proposals;
}

/** 提案 → 可入库 CurrencyMeta（id 现生成；去重由 addCurrencyToData 按名称负责）。 */
export function proposalToMeta(p: CurrencyProposal): CurrencyMeta {
  return { id: makeCurrencyId(), name: p.name, desc: p.desc, icon: p.icon, precision: p.precision };
}
