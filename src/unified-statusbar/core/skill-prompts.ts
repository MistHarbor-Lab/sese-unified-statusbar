import { getTavernHelper } from './env';
// core/skill-prompts.ts
// 天赋树 AI 生成：system prompt + schema 描述 + 1A 同构三段式分部装配 + 多树块解析。
// 世界书条目由原生 world_info 槽位承载（触发注入激活绿灯，见 buildSkillTreePromptParts.trigger）。
import { getJailbreakHeadPrompts, type JailbreakPromptEntry } from './jailbreak-config';
import { looseJsonParse } from './ai-parse';
import { getCellByHeader } from './data-manager';
import { readCharAgeText } from './birthday';
import { getTodayDateKey } from './calendar-core';
import { getCleanChatHistory } from './map-system';
import { stripWithContextConfig } from './context-strip';


export const SKILL_TREE_JSON_SCHEMA_DESC = `输出一棵天赋树的 JSON 结构（不含基础节点——基础形态即技能初始描述，由系统提供）：
{
  "skillName": "技能名",
  "style": "4-8 字技能气质短语（可选），例：寒锋·孤高 / 市井·机变",
  "accentColor": "技能主题色，格式 rgb(r,g,b)（0-255 整数），贴合技能主题与效果气质",
  "nodes": { "<id>": { "id","kind":"main|side","lineId","tier","title","desc","cost","parentId","requires?" } },
  "mainLines": [ { "id","name","nodeIds":[] } ]
}
规则：不要生成 base 节点、不要输出 rootId。2-3 条主线（kind='main'，各自 lineId 不同；每条主线的 name 必须是简短明确的主线主题名；每主线 3-5 节点 tier1-5；每条主线第一个节点 parentId 设为 null，系统自动接到基础节点；其后节点 parentId 指向上一 tier）。每个主线节点可挂 1-3 条支线（kind='side'，lineId=其挂靠主线 id，requires=挂靠主线节点 id，parentId=挂靠主线节点或支线上一节点，1-3 节点）。主线 cost 按 tier 递增约 10/20/35/55/80，±20% 浮动；支线 cost ≈ 挂靠主线节点 60-80%，支线延伸 ×1.5。desc 为具体可演绎的效果描述（非数值），按世界观校准强度。每个主线节点的 desc 必须以一至两句独立理解地说明该 tier 的完整当前形态：不得依赖前 tier，不写“在此前基础上”“进一步”等承接词，不机械复述低阶清单或写成长篇总表。支线 desc = 附加/强化效果，与主线可叠加不冲突。`;

/**
 * 技能树站点任务段（设计师规则）：拼在破限头各段之后（getJailbreakHeadPrompts 的 task 参数）。
 * 破限 + 防八股前缀不再内嵌——由共享解析器按用户设置（默认/空/自定义）统一提供。
 */
export const TALENT_TREE_TASK_PROMPT = `你同时承担：资深游戏天赋树设计师 + 叙事强化设计师。
任务：为输入清单中的每一个技能，各设计一棵独立的天赋树。技能广义——生活技能/职业技能/战斗技能都算技能；即便日常技能，也应在天赋树强化下获得匹配世界观的特殊效果（现代背景→微妙实用；奇幻→张扬），既特殊又不突兀。

【结构规则】
${SKILL_TREE_JSON_SCHEMA_DESC}

【设计原则】
- 每棵树独立、互不引用；树间风格/分叉可不同。
- 基础形态（技能初始描述）由系统提供，你不得生成 base 节点、无需输出 rootId；主线/支线在基础之上延伸，每条主线第一节点 parentId 设为 null（系统自动接到基础节点）。
- 主线 = 技能的不同发展方向，分叉有真实取舍；每条主线必须有不同的主线主题名、解法和氛围；支线 = 强化/附加效果，依附主线，给玩家真实价值。
- 强度通过文字描述体现（纯数值无意义）：tier 越深是更强的当前形态；支线为附加/强化。
- 按角色卡/世界书/主角信息推断世界观并校准强度。
- 不得在节点标题或描述中出现主角或任何人物的姓名。
- desc 聚焦技能功能本身，简洁直接；禁止过度说明、禁止举例、禁止叙事铺陈。
- 主线节点（kind='main'）的 desc 必须是该 tier 可独立理解的完整当前形态，限制一至两句；不要引用前 tier、不要使用必须结合前文才能理解的承接词，也不要逐项复述低阶效果。高 tier 应体现升级后的能力，但保持简洁。
- 为每棵树生成一个 accentColor 主题色（格式 rgb(r,g,b)，0-255 整数），颜色需贴合技能主题与效果气质（如火焰系偏红橙、治愈系偏青绿、暗影系偏紫蓝）；禁止使用白色、黑色、灰色等无彩色，保证在深色聊天背景上可见。
- 只输出 <TREE_JSON skill="技能名">…</TREE_JSON> 块，每个技能一块，无其它文字。
- <TREE_JSON> 的 skill 属性必须严格使用清单中【】内标注的技能名原样，严禁添加类别、括号、后缀或任何修改（清单每条格式为「· 【技能名】（类别：…）：描述」，skill 只取【】内的部分，例如「【某技能】（类别：被动）」对应 skill="某技能"，不得写成 skill="某技能（被动）」）。`;

export interface SkillTreePromptParts {
  /** 结构头段数组：破限头（+反八股+设计师规则段），直接展开进 ordered_prompts 最上端。 */
  head: JailbreakPromptEntry[];
  /** 规则与任务（user_input 槽位；不参与绿灯扫描）。 */
  userInput: string;
  /** 资料块（after_system 注入：主角信息+剧情上下文；不参与扫描）。 */
  dossier: string;
  /** 绿灯触发文本（position:'none' 注入；仅扫描，不发给 AI）。 */
  trigger: string;
}

export interface AssembleSkillTreeCtx {
  skills: { name: string; type: string; desc: string }[];
  extraReq?: string;
  contextCount: number;
}

/** 1A 同构三段式分部装配：世界书条目不再自扫自拼（原生槽位承载），技能名/额外要求/剧情正文进触发注入。 */
export async function buildSkillTreePromptParts(ctx: AssembleSkillTreeCtx): Promise<SkillTreePromptParts> {
  // 主角信息（不含姓名——禁止在生成上下文与天赋树中出现主角名称）
  const pGender = getCellByHeader('主角信息表', 1, '性别') || '';
  const pAge = readCharAgeText('主角信息表', 1, getTodayDateKey());
  const pApp = getCellByHeader('主角信息表', 1, '外貌特征') || '';
  const pBg = getCellByHeader('主角信息表', 1, '身份背景') || '';
  const pNow = getCellByHeader('主角信息表', 1, '近况') || '';
  const pInfo = [pGender && `性别：${pGender}`, pAge && `年龄：${pAge}`,
    pApp && `外貌：${pApp}`, pBg && `身份：${pBg}`, pNow && `近况：${pNow}`].filter(Boolean).join('\n');

  // 剧情上下文（资料块；仅 AI 回复 + 标签剥离）
  const hist = stripWithContextConfig(getCleanChatHistory(ctx.contextCount));

  const dossier = [
    pInfo ? '【主角信息】\n' + pInfo : '',
    hist ? '【剧情上下文】\n' + hist : '',
  ].filter(Boolean).join('\n\n');

  // 待生成技能清单
  const skillBlocks = ctx.skills.map(s => `· 【${s.name}】（类别：${s.type}）：${s.desc}`);
  const skillList = '【待生成技能清单】（每条描述为该技能初始形态=基础节点，已由系统提供；你只生成其上的主线与支线，不得生成基础节点、无需输出 rootId）\n' + skillBlocks.join('\n\n');

  // 额外要求（长按）
  let extraBlock = '';
  let expandedExtra = '';
  if (ctx.extraReq && ctx.extraReq.trim()) {
    const w = getTavernHelper();
    expandedExtra = (w && typeof w.substitudeMacros === 'function')
      ? w.substitudeMacros(ctx.extraReq.trim())
      : ctx.extraReq.trim();
    extraBlock = '【用户额外要求】\n' + expandedExtra;
  }

  const userInput = [
    skillList,
    extraBlock,
    '【最终任务】只为上述【待生成技能清单】中列出的技能生成天赋树——清单列出几个技能就只生成几棵，每棵一块 <TREE_JSON skill="技能名">…</TREE_JSON>，严格遵循结构规则与 schema。<TREE_JSON> 的 skill 必须严格等于清单中【】内标注的技能名原样，不得添加类别/括号/后缀（清单格式「· 【技能名】（类别：…）：描述」，skill 只取【】内部分）。禁止生成清单之外的任何技能的天赋树（即便世界书条目或「主角当前技能」中出现了其它技能名，也不得为它们生成）。',
  ].filter(Boolean).join('\n\n');

  // 绿灯触发文本：技能名 + 额外要求 + 剧情正文（user_input 不参与扫描，触发素材必须全在这里）
  const trigger = [
    ctx.skills.map(s => s.name).join(' '),
    expandedExtra,
    hist,
  ].filter(Boolean).join('\n');

  return { head: getJailbreakHeadPrompts({ antiCliche: true, task: TALENT_TREE_TASK_PROMPT }), userInput, dossier, trigger };
}

/** 正则逐块提取 <TREE_JSON skill="…">…</TREE_JSON>，去 markdown fence + 回退整段 JSON + 修复链兜底。 */
export function parseTreeJsonBlocks(raw: string): { skillName: string; json: any }[] {
  const out: { skillName: string; json: any }[] = [];
  const re = /<TREE_JSON\s+skill="([^"]+)">([\s\S]*?)<\/TREE_JSON\s*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const skillName = m[1];
    let body = m[2].trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      out.push({ skillName, json: JSON.parse(body) });
    } catch (_e) {
      // 修复链兜底（ai-parse）：未转义引号/尾逗号/截断的块也能恢复。
      const repaired = looseJsonParse(body);
      if (!repaired.ok) {
        const start = body.indexOf('{');
        const end = body.lastIndexOf('}');
        if (start >= 0 && end > start) {
          const fallback = looseJsonParse(body.slice(start, end + 1));
          if (fallback.ok) out.push({ skillName, json: fallback.value });
        }
      } else {
        out.push({ skillName, json: repaired.value });
      }
    }
  }
  return out;
}
