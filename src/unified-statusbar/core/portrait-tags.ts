import { findRowByColumn, getCellByHeader } from './data-manager';
import { readCharAgeText } from './birthday';
import { getTodayDateKey } from './calendar-core';
import { getCustomApiConfig, withTextAiRetry, type TextAiContext } from './api-config';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import { getTavernHelper } from './env';
import { iterBoundEntries, wbEntryMatchedKeywords, isManagedSkillEntry, wbEntryName } from './worldbook-entry';
import { savePortraitCharTags, savePortraitFanTags } from './portrait-system';
import { PORTRAIT_PROTAGONIST_KEY } from './portrait-protagonist';
import { captureChatScope } from './story-floor-store';

const WB_CONTENT_MAX = 4000;

// —— 取数：数据库静态资料 ——
export function collectDbTraits(npc: string): Record<string, string> {
  const out: Record<string, string> = {};
  const loverRow = findRowByColumn('恋爱对象表', '姓名', npc);
  const importantRow = findRowByColumn('重要角色表', '姓名', npc);
  const srcTable = loverRow !== -1 ? '恋爱对象表' : importantRow !== -1 ? '重要角色表' : '';
  const srcRow = loverRow !== -1 ? loverRow : importantRow;
  if (srcTable && srcRow !== undefined && srcRow !== -1) {
    out['性别'] = getCellByHeader(srcTable, srcRow, '性别') || '';
    out['年龄'] = readCharAgeText(srcTable, srcRow, getTodayDateKey());
    out['外貌特征'] = getCellByHeader(srcTable, srcRow, '外貌特征') || '';
    out['一句话介绍'] = getCellByHeader(srcTable, srcRow, '一句话介绍') || '';
  }
  // 主角本人（哨兵 key，或直呼主角真名且不在恋爱/重要角色表时）回退读主角信息表
  if (!srcTable) {
    const pName = getCellByHeader('主角信息表', 1, '姓名') || '';
    if (pName && (npc === PORTRAIT_PROTAGONIST_KEY || npc === pName)) {
      out['性别'] = getCellByHeader('主角信息表', 1, '性别') || '';
      out['年龄'] = readCharAgeText('主角信息表', 1, getTodayDateKey());
      out['外貌特征'] = getCellByHeader('主角信息表', 1, '外貌特征') || '';
      out['身份背景'] = getCellByHeader('主角信息表', 1, '身份背景') || '';
    }
  }
  const nsfwRow = findRowByColumn('NSFW信息表', '姓名', npc);
  if (nsfwRow !== -1) {
    const hw = getCellByHeader('NSFW信息表', nsfwRow, '身高/体重') || '';
    const ms = getCellByHeader('NSFW信息表', nsfwRow, '三围/罩杯') || '';
    if (hw && hw !== '无') out['身高/体重'] = hw;
    if (ms && ms !== '无') out['三围/罩杯'] = ms;
  }
  return out;
}

// —— 取数：世界书触发关键词命中角色名的条目（一次性，点击生成时才执行）——
async function collectWorldbookEntries(npc: string): Promise<{ comment: string; content: string }[]> {
  const out: { comment: string; content: string }[] = [];
  const seen = new Set<string>();
  await iterBoundEntries((entry) => {
    if (isManagedSkillEntry(entry)) return;
    if (wbEntryMatchedKeywords(entry, [npc]).length === 0) return;
    const comment = wbEntryName(entry);
    if (!comment || seen.has(comment)) return;
    seen.add(comment);
    out.push({ comment, content: String(entry.content || '') });
  });
  return out.slice(0, 20);
}

function buildTagGenUserInput(
  npc: string,
  traits: Record<string, string>,
  wbEntries: { comment: string; content: string }[],
  instruction: string,
): string {
  const parts: string[] = [];
  parts.push(`【人物】\n${npc}`);
  const traitLines = Object.entries(traits).filter(([, v]) => v).map(([k, v]) => `${k}：${v}`).join('\n');
  parts.push(`【数据库资料】\n${traitLines || '无'}`);
  if (wbEntries.length) {
    let budget = WB_CONTENT_MAX;
    const lines: string[] = [];
    for (const e of wbEntries) {
      if (budget <= 0) break;
      const content = e.content.length > budget ? e.content.slice(0, budget) : e.content;
      budget -= content.length;
      lines.push(`【条目：${e.comment}】\n${content}`);
    }
    parts.push(`【世界书中与该人物相关的条目】\n${lines.join('\n\n')}`);
  }
  parts.push(instruction);
  return parts.join('\n\n');
}

const TAG_GEN_SYSTEM = `你是一名精通 NovelAI/danbooru 标签体系的角色设定师。任务：根据提供的人物资料，提炼一份该人物的「固定一致性标签」，用于在后续每次图像生成中保持该人物长相稳定。

输出格式（严格遵守，不要输出其他任何内容）：
<APPEARANCE>逗号分隔的英文 danbooru 标签</APPEARANCE>
<BODY>逗号分隔的英文danbooru标签</BODY>

要求：
- APPEARANCE 段详尽覆盖永久性外貌：脸型、发型、发色发长、瞳色瞳孔、眉毛、睫毛、肤色、雀斑/痣/疤痕/纹身等永久标记、耳型等。
- BODY 段详尽覆盖永久性身材：体格体型、身高体重印象、肩宽、胸的大小与形状、腰、臀、腿形、手足特征等。
- 全部使用标准英文 danbooru 标签写法（如 long hair, blue eyes, large breasts, slim, pale skin），可对关键特征使用 NAI 加权语法 1.2::tag::。
- 只提取资料中明确或强烈暗示的特征；资料未提及的部位按最常见合理值给出通用标签，但不得发明独特标记（如资料未提的纹身/疤）。
- 严禁包含：衣着服饰、表情、姿势、动作、场景背景、构图、画质词、人数词。`;

function parseTagOutput(result: string): { appearance: string; body: string } | null {
  const app = result.match(/<APPEARANCE>([\s\S]*?)<\/APPEARANCE>/i);
  const body = result.match(/<BODY>([\s\S]*?)<\/BODY>/i);
  if (!app || !body) return null;
  const appearance = app[1].trim();
  const b = body[1].trim();
  if (!appearance || !b) return null;
  return { appearance, body: b };
}

/** 生成人物固定 tag 并落盘。成功后调用方应打开编辑窗供用户确认修改。
 *  switched=true＝生成期间切了聊天，结果未落盘（调用方应静默跳过，不要再弹错误）。 */
export async function generateCharTags(npc: string): Promise<{ ok: boolean; tags?: { appearance: string; body: string }; error?: string; switched?: boolean }> {
  // 主角哨兵 key：数据库取数/落盘用哨兵，世界书匹配与【人物】行用真名（世界书条目以真名为触发关键词）
  const matchName = npc === PORTRAIT_PROTAGONIST_KEY ? (getCellByHeader('主角信息表', 1, '姓名') || '') : npc;
  if (npc === PORTRAIT_PROTAGONIST_KEY && !matchName) return { ok: false, error: '主角信息表尚未填写姓名，无法生成人物tag' };
  const traits = collectDbTraits(npc);
  if (!Object.keys(traits).length) return { ok: false, error: `未找到角色"${npc}"的外貌相关数据` };

  // 聊天归属守卫：tag 落的是当前聊天的立绘库；请求期间切聊天 → 不写入新聊天。
  const scope = captureChatScope('人物tag');

  const wbEntries = await collectWorldbookEntries(matchName);

  const th = getTavernHelper();
  if (!th || typeof th.generateRaw !== 'function') return { ok: false, error: '无法访问 generateRaw' };
  const customApi = getCustomApiConfig('imageGeneration');

  let result = '';
  try {
    // 网络级重试：按设置决定次数与通知（关闭时仅尝试一次）；取消/配置错误立即返回。
    result = await withTextAiRetry('imageGeneration', async (ctx: TextAiContext) => {
      const r = await th.generateRaw({
        should_silence: true,
        generation_id: ctx.generationId,
        user_input: buildTagGenUserInput(matchName, traits, wbEntries, '请根据以上信息生成该人物的固定外貌与身材标签。'),
        ordered_prompts: [
          ...getJailbreakHeadPrompts(),
          { role: 'system', content: TAG_GEN_SYSTEM },
          'user_input',
          ...getJailbreakTailPrompts(),
        ],
        custom_api: customApi,
      });
      const text = typeof r === 'string' ? r : '';
      if (!text.trim()) throw new Error('AI 返回为空');
      return text;
    }, { feature: 'portraitCharTags' });
  } catch (e: any) {
    if (!scope.isCurrent()) return { ok: false, switched: true, error: '' };
    return { ok: false, error: `生成人物tag失败：${e?.message || e}` };
  }
  const tags = result ? parseTagOutput(result) : null;
  if (!tags) return { ok: false, error: 'AI 输出格式异常，未找到 <APPEARANCE>/<BODY> 两段，请重试' };

  // 聊天归属守卫（写前核对）：切走后不把旧聊天的 tag 写进新聊天的立绘库。
  if (!scope.isCurrent()) return { ok: false, switched: true, error: '聊天已切换，本次人物tag未保存' };
  const saved = await savePortraitCharTags(npc, tags);
  if (!saved) return { ok: false, error: '人物tag保存失败（存储未就绪）' };
  return { ok: true, tags };
}

// —— 同人身份 tag：识别一次即固化（此后生图直接拼进提示词，不再调 AI）——

const FAN_TAG_GEN_SYSTEM = `你是一名精通 ACG 同人资料与 danbooru 标签体系的设定师。任务：根据提供的人物资料，判断该人物是否为某部已有作品（动漫/游戏/小说等）中的同人角色，并给出其标准身份标签。

输出格式（严格遵守，不要输出其他任何内容）：
<CHARACTER>该人物的标准 danbooru 角色标签</CHARACTER>
<COPYRIGHT>该原作的标准 danbooru 作品/copyright 标签</COPYRIGHT>

要求：
- 两段都用 danbooru 标准写法：小写、词间下划线，人物标签带作品消歧义括号（如 rem_(re:zero)、hatsune_miku、saber_(fate)）；作品标签用原作标准 copyright（如 re:zero_kara_hajimeru_isekai_seikatsu、fate_(series)）。
- 只在资料能明确指向某个已有作品时输出；无法可靠判断时两段都留空，不要猜一个无关作品、不要编造。
- 严禁输出画师名（artist）、自创角色标签或外貌/身材/服装/表情/姿势标签。`;

function parseFanTagOutput(result: string): { character: string; copyright: string } | null {
  const character = result.match(/<CHARACTER>([\s\S]*?)<\/CHARACTER>/i);
  const copyright = result.match(/<COPYRIGHT>([\s\S]*?)<\/COPYRIGHT>/i);
  if (!character || !copyright) return null;
  // 两段都留空=AI 判定不是同人角色（可重试或手填），按失败上报以免静默写入空值
  const c = character[1].trim();
  const w = copyright[1].trim();
  if (!c || !w) return null;
  return { character: c, copyright: w };
}

/** 识别同人身份（人物/作品 tag）并落盘固化。成功后调用方应把两值回填到界面供用户确认修改。
 *  主角为自创角色，恒不可用；switched=true＝生成期间切了聊天，结果未落盘。 */
export async function generateFanTags(npc: string): Promise<{ ok: boolean; tags?: { character: string; copyright: string }; error?: string; switched?: boolean }> {
  if (!npc || npc === PORTRAIT_PROTAGONIST_KEY) return { ok: false, error: '主角为自创角色，没有同人原型' };
  const traits = collectDbTraits(npc);
  if (!Object.keys(traits).length) return { ok: false, error: `未找到角色"${npc}"的资料，无法识别同人身份` };

  // 聊天归属守卫：tag 落的是当前聊天的立绘库；请求期间切聊天 → 不写入新聊天。
  const scope = captureChatScope('同人身份tag');

  const wbEntries = await collectWorldbookEntries(npc);

  const th = getTavernHelper();
  if (!th || typeof th.generateRaw !== 'function') return { ok: false, error: '无法访问 generateRaw' };
  const customApi = getCustomApiConfig('imageGeneration');

  let result = '';
  try {
    result = await withTextAiRetry('imageGeneration', async (ctx: TextAiContext) => {
      const r = await th.generateRaw({
        should_silence: true,
        generation_id: ctx.generationId,
        user_input: buildTagGenUserInput(npc, traits, wbEntries, '请判断该人物是否出自某部已有作品，并输出其标准人物标签与作品标签。'),
        ordered_prompts: [
          ...getJailbreakHeadPrompts(),
          { role: 'system', content: FAN_TAG_GEN_SYSTEM },
          'user_input',
          ...getJailbreakTailPrompts(),
        ],
        custom_api: customApi,
      });
      const text = typeof r === 'string' ? r : '';
      if (!text.trim()) throw new Error('AI 返回为空');
      return text;
    }, { feature: 'portraitFanTags' });
  } catch (e: any) {
    if (!scope.isCurrent()) return { ok: false, switched: true, error: '' };
    return { ok: false, error: `识别同人身份失败：${e?.message || e}` };
  }
  const tags = result ? parseFanTagOutput(result) : null;
  if (!tags) return { ok: false, error: 'AI 未能识别出同人身份（未找到 <CHARACTER>/<COPYRIGHT> 或判定不是同人角色），可手动填写或重试' };

  // 聊天归属守卫（写前核对）：切走后不把旧聊天的身份 tag 写进新聊天的立绘库。
  if (!scope.isCurrent()) return { ok: false, switched: true, error: '聊天已切换，本次同人身份tag未保存' };
  const saved = await savePortraitFanTags(npc, tags);
  if (!saved) return { ok: false, error: '同人身份tag保存失败（存储未就绪）' };
  return { ok: true, tags };
}
