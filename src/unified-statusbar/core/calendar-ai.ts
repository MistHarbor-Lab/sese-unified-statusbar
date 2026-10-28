import { getTavernHelper, getToastr } from './env';
import { STANDARD_PROMPT_MIDDLE, STANDARD_MAX_CHAT_HISTORY, injectTriggerAndContext } from './ai-request-pipeline';
// ===== 日历 AI 生成模块 =====
import { getConfig } from './config-store';
import { setButtonBusy } from './busy-state';
import { getCustomApiConfig, validateCustomApiConfig, withTextAiRetry, isAiAbortError, type TextAiContext } from './api-config';
import {
  showEnvNotReady, showGenCatchError, showGenOutputError, showApiConfigError,
} from './notify-presets';
import { readSerseEnergy, adjustSerseEnergy, warnSerseEnergyShort } from './energy-payment';
import { getCellByHeader, getSheetByName } from './data-manager';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import { getAiReplyContext } from './map-system';
import { withNativeScanWorldbook } from './worldbook-entry';
import { captureChatScope } from './story-floor-store';
import { readStoryClockRaw,
  getTodayDateKey,
  parseCurrentTimeToDateTime,
  compareDateKey,
  loadCalendarData,
  saveWeather,
  appendFutureEvents,
  parseCalendarYaml,
  type CalendarEvent,
} from './calendar-core';

// ═══════════════════════════════════════════════════════════════
// 生成状态追踪
// ═══════════════════════════════════════════════════════════════

/** 正在生成中的角色集合 */
const generatingSet = new Set<string>();

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════



// ═══════════════════════════════════════════════════════════════
// 提示词构建
// ═══════════════════════════════════════════════════════════════

/** 从重要角色表和恋爱对象表中随机选取最多3个姓名 */
function getRandomCharNames(): string[] {
  try {
    const tableNames = ['重要角色表', '恋爱对象表'];
    const allNames: string[] = [];
    for (const tableName of tableNames) {
      const sheet = getSheetByName(tableName);
      if (sheet && sheet.content && sheet.content.length > 1) {
        for (let i = 1; i < sheet.content.length; i++) {
          const name = getCellByHeader(tableName, i, '姓名') || '';
          if (name && name.trim()) allNames.push(name.trim());
        }
      }
    }
    // 随机取出最多3个
    const count = Math.min(3, allNames.length);
    const picked: string[] = [];
    const pool = [...allNames];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return picked;
  } catch (e) {
    return [];
  }
}

/** 构建完整的日历生成指令（包含已有事件信息和备忘录排除列表） */
async function buildFullInstruction(): Promise<string> {
  const currentTime = readStoryClockRaw();
  const parsed = parseCurrentTimeToDateTime(currentTime);

  let timeInfo = currentTime;
  if (parsed) {
    timeInfo = parsed.fullText || `${parsed.dateKey} ${parsed.weekday}`;
    if (!timeInfo.includes('周') && parsed.weekday) {
      timeInfo = `${parsed.dateKey} ${parsed.weekday}`;
    }
  }
  // 负年份（公元前）世界观：提示 AI 事件日期用带负号 ISO 格式，避免写成正年份
  const negYearHint = parsed && parsed.dateKey.startsWith('-')
    ? '\n注意：当前世界观年份为负数（公元前），事件日期请使用带负号的 ISO 格式，如 -0500-03-12。'
    : '';

  const { future } = await loadCalendarData();
  const existingEvents = parseCalendarYaml(future.calendar);

  let memoTitles = '';
  try {
    const memos = getSheetByName('备忘录');
    if (memos && memos.content && memos.content.length > 1) {
      const titles: string[] = [];
      for (let i = 1; i < memos.content.length; i++) {
        const appointedTime = getCellByHeader('备忘录', i, '约定时间') || '';
        if (appointedTime && /-?\d{1,6}-\d{1,2}-\d{1,2}/.test(appointedTime)) {
          const title = getCellByHeader('备忘录', i, '备忘标题') || '';
          if (title) titles.push(title);
        }
      }
      if (titles.length > 0) {
        memoTitles = '备忘录中已有以下事件，请不要重复：\n' + titles.map(t => `  - ${t}`).join('\n');
      }
    }
  } catch (e) { /* ignore */ }

  const baseInstruction = `你是一个世界事件生成器。根据当前故事世界观和时代背景以及上下文，生成要求内容：

- 当前时间：${timeInfo}${negYearHint}

【生成要求】
生成两部分内容，天气和日历事件，依次包裹在<weather>和<calendar>标签对中，天气和日历事件要求如下：
1.天气
- 格式为“大类:描述”
- 大类仅从以下选择：常见：[晴、多云、阴、雨] 罕见：[雪、雾、沙尘、冰雹、台风] 选择天气时考虑当前季节和出现概率
- 描述为10-30字感官描述（程度、温度、风速等，避免具体化数字，采用偏向感官的描述），
- 天气描述全天情况，不要针对当前时刻
- 示例：雨:大雨时停时下，温度偏低，风吹的撑不住伞

2、日历事件（10-15个，覆盖未来15天）
事件分类：
-世界事件【总共1-4条，全局性事件】
这类事件是世界观设定的一部分，所有角色都会受到影响，id以world开头，如“world_1”
-大型事件【总共1-4条，区域性/社会性事件】
这类事件是剧情中的重要事件，主角和多个重要角色都会参与或受影响，不宜过于频繁。id以major开头，如"major_2"
-角色事件【总共1-7条，与特定角色相关的事件】
这类事件是与某个角色强相关的计划或动向，比如角色打算做的事、安排好的行程、预定出现的场合等，基于世界观和角色人设的合理推测。id以char开头，如”char_3”
具体每个事件的必备内容参考示例。
注意，日历是计划而非预言：角色事件只描述”谁打算/计划在何时何地做什么”，是尚未发生、尚未确定结果的安排，绝不写出结果、结局或事后状态（不得出现”已……””结果……””最终……””导致了……”等表述）。也不要替角色拍板他必然会做什么，只给出主角可以去介入、验证或偶遇的动向线索，把发展与结果留给主角在剧情中揭示。

要求：
-根据故事背景和上下文内容，设计按剧情可能发生的事件，创建一些符合世界观的额外事件
-加上之前已存在事件，总事件数为10-15个，可安排最近15天内的事项，最远跨度不超过15天，优先安排本周事件
-今日明日必须有事件，今日事件不可发生在当前时间点之前。
-不更新在原有日历和备忘录中已有体现的事件。
-每次更新时先参考前面十五天已更新的内容，在此数量和内容基础上增量更新。确保更新后总数绝不超过15个，如果原来数量已足够，可以不新增。宁缺毋滥。只体现增量内容即可。`;

  const baseEnd = `

【示例】
<weather>
大类:描述
</weather>

<calendar>
- id: "world_{{序号}}"
  date: {{日期，格式: YYYY-MM-DD}}
  title: {{事件标题，如: 春节、圣诞节、世界读书日}}
  description: {{事件描述，约20-50字}}

- id: "major_{{序号}}"
  date: {{日期，格式: YYYY-MM-DD}}
  startTime: "{{开始时间，和结束时间成对出现，格式: HH:MM，可选}}"
  endTime: "{{结束时间，格式: HH:MM，可选}}"
  title: {{事件标题，如: 学校运动会、夏日祭、音乐节}}
  description: {{事件描述，约30-80字}}
  location: {{事件地点}}
  participants: {{参与者，如: 全校师生、社区居民}}

- id: "char_{{序号}}"
  date: {{日期，格式: YYYY-MM-DD}}
  time: "{{时间，格式: HH:MM，可选}}"
  title: {{事件标题，如: XXX生日、某某计划去某处、某某预定的行程等，只写计划/动向，不写结果}}
  description: {{事件描述，约20-50字}}
  character: {{关联角色姓名}}
  location: {{地点，可选}}
</calendar>`;

  const endLine = `
除天气、日历以外，不输出其他正文、思考、或者任何无关内容！`;

  let instruction = baseInstruction;
  instruction += baseEnd;
  instruction += endLine;

  let fullInstruction = instruction;

  if (existingEvents.length > 0) {
    const recentEvents = existingEvents
      .filter(e => compareDateKey(e.date, getTodayDateKey() || '0000-00-00') >= 0)
      .map(e => `  - [${e.date}] ${e.title}`)
      .join('\n');
    if (recentEvents) {
      fullInstruction += '\n\n【前面十五天已更新的内容（在此基础上增量更新，只输出新增/变更事件）】\n' + recentEvents;
    }
  }

  if (memoTitles) {
    fullInstruction += '\n\n【' + memoTitles + '】';
  }

  return fullInstruction;
}

// ═══════════════════════════════════════════════════════════════
// 内容提取
// ═══════════════════════════════════════════════════════════════

/** 从 AI 回复中提取天气和日历原始文本 */
function extractCalendarContent(text: string): {
  weatherText: string;
  calendarText: string;
} | null {
  let weatherText = '';
  let calendarText = '';

  const weatherMatch = text.match(/<weather>([\s\S]*?)<\/weather>/i);
  if (weatherMatch) {
    const content = weatherMatch[1]
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
    const lines = content.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length > 0) {
      weatherText = lines[0];
    }
  }

  const calMatch = text.match(/<calendar>([\s\S]*?)<\/calendar>/i);
  if (calMatch) {
    calendarText = calMatch[1].trim();
  }

  if (!weatherText && !calendarText) return null;
  return { weatherText, calendarText };
}

// ═══════════════════════════════════════════════════════════════
// 主生成流程
// ═══════════════════════════════════════════════════════════════

export interface CalendarGenerationResult {
  calendarEvents: CalendarEvent[];
}

/**
 * 执行日历 AI 生成
 * extraPrompt：长按输入的额外要求，不持久化，仅本次注入到指令末尾。
 * cost：本次生成扣除的瑟瑟能量（短按 0 / 长按 3）。失败返还扣除的能量。
 */
export async function performCalendarGeneration(
  btnElement?: HTMLButtonElement,
  extraPrompt?: string,
  cost: number = 0,
): Promise<CalendarGenerationResult | null> {
  const th = getTavernHelper();
  const generateRaw = th?.generateRaw;
  const toastr = getToastr();

  if (!generateRaw) {
    showEnvNotReady('日历');
    return null;
  }

  // 校验自定义 API 配置（若启用自定义 API 但必填项缺失，则提前失败）
  const apiErr = validateCustomApiConfig('calendar');
  if (apiErr) {
    showApiConfigError('日历生成', apiErr);
    return null;
  }

  // 并发守卫：generatingSet 此前**只写不读**（无任何 .has 判定）⇒ 自动链与手动按钮可同时发起
  // 两次 AI 请求，且都基于同一份能量快照扣返（竞态）。此处补读闸。
  // 「检查→置位」之间无 await（下方能量/配置读取均为同步），故单线程下原子。
  const genKey = 'calendar_gen';
  if (generatingSet.has(genKey)) {
    toastr?.warning('日历正在生成中，请稍候', '日历');
    return null;
  }

  // 长按收费：前置能量校验（不扣），不足直接拦截，不进入生成流程
  if (cost > 0) {
    const energyNow = readSerseEnergy(); // U31：统一出口
    if (energyNow < cost) {
      warnSerseEnergyShort('日历', cost, energyNow);
      return null;
    }
  }

  const config = getConfig();
  const contextCount = config.calendarContextCount || 10;

  // 忙碌视觉走 setButtonBusy（F22）；原 disabled 态仍需自行保存恢复（busy 前按钮可能本就禁用）
  const originalDisabled = btnElement?.disabled || false;

  if (btnElement) setButtonBusy(btnElement, true, '生成中...');
  generatingSet.add(genKey);

  // 长按收费：扣能量（前置校验已过；此处并发竞态致不足时回退）
  let deducted = false;
  if (cost > 0) {
    const energyNow = readSerseEnergy(); // U31：统一出口
    if (energyNow < cost) {
      warnSerseEnergyShort('日历', cost, energyNow);
      generatingSet.delete(genKey);
      if (btnElement) { setButtonBusy(btnElement, false, ''); btnElement.disabled = originalDisabled; }
      return null;
    }
    const ok = await adjustSerseEnergy(-cost); // U31：直写通道（先扣后做；增量写）
    if (!ok) {
      toastr?.error('扣除能量失败', '日历');
      generatingSet.delete(genKey);
      if (btnElement) { setButtonBusy(btnElement, false, ''); btnElement.disabled = originalDisabled; }
      return null;
    }
    deducted = true;
  }

  const refundIfDeducted = async (): Promise<void> => {
    if (!deducted) return;
    await adjustSerseEnergy(cost); // U31：直写通道返还（增量写，省一次读）
  };

  // 聊天归属守卫：AI 返回后还要写天气/未来事件（当前聊天 story）并打成就；
  // 请求期间切聊天 → 结果属于旧聊天，整体丢弃（能量返还，不弹错误）。
  const scope = captureChatScope('日历');

  try {
    let rawInstruction = await buildFullInstruction();
    // 长按额外要求：追加到指令末尾，仅本次生效（与大调查/剧情特卖一致）
    if (extraPrompt && extraPrompt.trim()) {
      rawInstruction += '\n\n---\n## 用户额外要求\n' + extraPrompt.trim() + '\n';
    }

    let instruction = rawInstruction;
    if (typeof th.substitudeMacros === 'function') {
      instruction = th.substitudeMacros(rawInstruction);
    }

    // 进行中提示由统一 AI 活动注册表负责，这里不再单独弹 toast

    // 触发注入（position:'none'，只参与世界书扫描）：随机角色名 + 长按额外要求 + 剧情上下文正文。
    // max_chat_history 置 0 后原生 chat_history 不携带楼层、user_input 不参与绿灯扫描（小手机管线契约）——
    // 关键词条目的激活素材必须全部由本注入显式喂入。
    // 每次尝试都要重做「一次性注入 + 扫描准备 + 生成」：once:true 只在下一次生成生效，
    // 重试若在注入之内会丢掉资料块与触发素材。
    const runCalendarRequest = async (ctx: TextAiContext) => {
    injectTriggerAndContext(th, {
      triggerId: 'calendar_gen_trigger', contextId: 'calendar_gen_context',
      storyContext: getAiReplyContext(contextCount), extraPrompt, charNames: getRandomCharNames(),
    });

    return await withNativeScanWorldbook({}, () => generateRaw({
      should_silence: true,
      generation_id: ctx.generationId,
      user_input: instruction,
      ordered_prompts: [
        ...getJailbreakHeadPrompts({ antiCliche: true }),
        ...STANDARD_PROMPT_MIDDLE,
        ...getJailbreakTailPrompts(),
      ],
      max_chat_history: STANDARD_MAX_CHAT_HISTORY,
      // 自定义 API（undefined 时使用酒馆当前 API）
      custom_api: getCustomApiConfig('calendar'),
    }));
    };
    const result = await withTextAiRetry('calendar', runCalendarRequest, { feature: 'calendar' });

    // 聊天归属守卫（写前核对）：切走后不写入新聊天、不打成就，静默丢弃。
    // 不返还能量：返还是写当前聊天（此时已是新聊天）——返还等于给新聊天白送能量，可被反复切卡刷；
    // 旧聊天为这次已发出的 token 付费，语义上也说得通。
    if (!scope.isCurrent()) return null;

    if (typeof result === 'string') {
      const extracted = extractCalendarContent(result);
      if (extracted) {
        if (extracted.weatherText) {
          await saveWeather(extracted.weatherText);
        }
        if (extracted.calendarText) {
          await appendFutureEvents(extracted.calendarText);
        }
        // 成就打点：日历生成成功（提取到天气/事件任一即算）
        try { (window as any).__ubEmitAchievement?.('calendar_generated', {}); } catch (_e) { /* ignore */ }
        const parsedCount = parseCalendarYaml(extracted.calendarText).length;
        if (parsedCount > 0) {
          toastr?.success(`日历更新完毕，${parsedCount} 个事件`, '日历提示');
        } else {
          showGenOutputError('日历', result, { level: 'warning', title: '日历提示', suffix: '事件已保存但解析到 0 条' });
        }
        return { calendarEvents: parseCalendarYaml(extracted.calendarText) };
      } else {
        showGenOutputError('日历', result);
        await refundIfDeducted();
      }
    } else {
      showGenOutputError('日历', result);
      await refundIfDeducted();
    }
  } catch (e) {
    // 聊天已切换：旧聊天的失败也不该在新聊天弹错误（不返还能量，理由同成功分支）。
    if (!scope.isCurrent()) return null;
    if (isAiAbortError(e)) { await refundIfDeducted(); return null; } // 用户终止：静默返还能量
    showGenCatchError('日历', e, deducted ? '瑟瑟能量已返还。' : undefined);
    await refundIfDeducted();
  } finally {
    if (btnElement) {
      setButtonBusy(btnElement, false, '');
      btnElement.disabled = originalDisabled;
    }
    generatingSet.delete(genKey);
  }

  return null;
}
