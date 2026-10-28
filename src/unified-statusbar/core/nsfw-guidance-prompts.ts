// ===== 瑟瑟指导提示词 =====
// 本功能只生成可交给正文 AI 的行动骨架，不生成正文、过程细节或结果。

export const NSFW_GUIDANCE_SYSTEM_PROMPT = `本次任务把用户的简短输入扩充成一份"主角行动骨架"，直接交给后续正文 AI 执行。

【输出形式】
分若干行（通常3-7行）列出本次行动的情节推进骨架，按发展顺序排列，每行一句完整的行动短句（写清"做什么、怎么做"），行与行之间直接换行，不加编号或项目符号。不要把任何一行展开成段落，也不要把骨架合并成一整段散文。

【内容要求】
1. 这是用户原始输入的延伸与推进，不是改写或替换。在不违背用户原意的前提下，从用户想做的事出发，往有意思的方向发展，并把当前选择的所有玩法自然地串进这条发展线：尽量让每个已选玩法都在骨架中找到合理的落点，而不是只用其中一两个、漏掉其余；若某玩法与当前情境确实无法自然衔接，可省略，不要硬塞。
2. 以主角的行动、意图和推进节奏为主；其他角色可依其性格与处境表现合理主动性，但不喧宾夺主、不违背人物逻辑。
3. 尽量利用当前场景的空间、方位、陈设与可用物品，让骨架与地点真正发生联系。
4. 在满足前三项的前提下，让骨架足够色气、有趣、有新意——本质是演出与角色之间有趣、色情的互动，不是对抗。把"有趣之处"直接写进每行的动作本身：互动的方式、情境的反差、道具的妙用、两人之间的化学反应，都用行动句表达，不要另起一句点评，也不要写成"针对弱点、拿捏对方"式的博弈。
5. 每行只写主角要做什么、怎么做；不展开行动细节，不写具体台词，不描绘身体动作、感官反应或色情过程，把这些留给正文 AI。
6. 不写任何行为结果、事后状态、成功失败、数值判断、概率判定、条件分支或规则约束。
7. 不带分析性旁白或戏眼解说。行动句里可以写互动的方式、用的道具、情境安排（这属于行动本身），但不要追加对效果的点评或"为什么有趣"的解说（如"反差拉满""自然不突兀""张力拉满"等）。骨架读起来就是一连串主角的行动，不是对行动的解说。

【输出约束】
只输出骨架本身，总字数不超过给定的上限。禁止标题、前言、后记、Markdown 标记、引号、字数说明。`;

// 瑟瑟指导长按额外提示词弹窗的固定预设按钮（点击覆盖填入 textarea，可再编辑）。
// 每项 text 作为「用户额外要求」追加在提示词末尾。后续加预设只改此数据。
export const NSFW_GUIDANCE_PRESETS: Array<{ key: string; label: string; text: string }> = [
  {
    key: 'creative-nsfw',
    label: '创意NSFW',
    text: '本次行动骨架要往色情（NSFW）方向发展，并且要天马行空、充满新意：大胆构思非常规的互动方式、情欲戏码、情境反差与道具妙用，让 NSFW 发展既出人意料又合情合理，避免常见的套路与陈词滥调，把「新奇感」和「色气感」都拉满。',
  },
  {
    key: 'sfw',
    label: 'SFW',
    text: '本次行动骨架不得包含任何 NSFW（色情/性暗示）内容与场景，整体保持日常、温馨、正经或纯爱的方向发展，尺度控制在清水向。',
  },
  {
    key: 'battle-shounen',
    label: '战斗热血',
    text: '本次行动骨架要模仿热血王道番剧的走向：引入战斗、对抗、挑战或竞逐的桥段，突出主角的斗志、成长与高光时刻，节奏充满激情与燃点，像一集热血动画的推进。',
  },
  {
    key: 'power-fantasy',
    label: '爽文风',
    text: '本次行动骨架要体现网络小说式的爽感：安排打脸、扮猪吃虎、升级、逆袭、当众扬威或让人刮目相看等让主角大呼过瘾的桥段，情绪拉满、节奏明快，突出「爽」字。',
  },
  {
    key: 'plot-advance',
    label: '剧情推进',
    text: '本次行动骨架要把当前剧情明确往前推进一大步：制造新的进展、冲突、转折或发现，推动关系与事件向前走，避免原地打转、重复或停滞。',
  },
];

export function buildNsfwGuidanceUserInput(opts: {
  location: string;
  mapDescription: string;
  matchedWorldbookText: string;
  relatedCharacters: string[];
  itemsText: string;
  playsText: string;
  context: string;
  originalInput: string;
  extraPrompt?: string;
  maxChars: number;
}): string {
  const parts: string[] = [];

  parts.push(`【输出长度】\n最终输出不超过 ${opts.maxChars} 字。请在这个长度内保持骨架完整连贯。`);

  if (opts.location) {
    parts.push(`【当前地点】\n${opts.location}`);
  }
  if (opts.mapDescription) {
    parts.push(`【地图库中的当前地点资料】\n${opts.mapDescription}`);
  }
  if (opts.matchedWorldbookText) {
    parts.push(`【地点与角色相关世界书资料】\n${opts.matchedWorldbookText}`);
  }
  if (opts.relatedCharacters.length > 0) {
    parts.push(`【本次相关角色】\n${opts.relatedCharacters.join('、')}`);
  }
  if (opts.itemsText) {
    parts.push(`【当前可用物品】\n${opts.itemsText}`);
  }
  if (opts.playsText) {
    parts.push(`【当前选择玩法及玩法指导】\n${opts.playsText}`);
  } else {
    parts.push('【当前选择玩法】\n未选择；请仅依据用户输入、人物逻辑、场景与上下文搭建行动骨架。');
  }
  if (opts.context) {
    parts.push(`【最近的 AI 输出（仅作故事发展参考）】\n${opts.context}`);
  }

  parts.push(`【用户本次原始输入】\n${opts.originalInput}`);
  if (opts.extraPrompt && opts.extraPrompt.trim()) {
    parts.push(`【用户额外要求】\n${opts.extraPrompt.trim()}`);
  }
  parts.push('【最终任务】\n严格遵守系统要求，只输出骨架本身。');
  return parts.join('\n\n');
}