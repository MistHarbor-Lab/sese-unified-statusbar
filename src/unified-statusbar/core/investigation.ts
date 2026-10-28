import { readStoryClockRaw } from './calendar-core';
import { getTavernHelper, getToastr } from './env';
import { STANDARD_PROMPT_MIDDLE, STANDARD_MAX_CHAT_HISTORY } from './ai-request-pipeline';
import { escapeHtml } from './html-escape';
import { extractAppContent } from './app-content';
// ===== 大调查功能核心模块 =====

import { parseInvestigation } from './investigation-parser';
import { extractDiffContent, mergeInvestigationDiff } from './investigation-merge';
import { renderInvestigationHTML } from './investigation-renderer';
import { renderThemedDossier } from '../renderers/investigation-themed';
import type { StyleType } from './constants';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import { getConfig } from './config-store';
import { getAiReplyContext } from './map-system';
import { keepPhoneRecordEntries, wbEntryName, withNativeScanWorldbook } from './worldbook-entry';
import { isChronicleEntryName, readChronicleDossierBlocks } from './chronicle-blocks';
import { getCustomApiConfig, validateCustomApiConfig, withTextAiRetry, isAiAbortError, type TextAiContext } from './api-config';
import { readStoryFeature, writeStoryFeature, captureChatScope } from './story-floor-store';
import { showEnvNotReady, showApiConfigError, showGenOutputError, showGenCatchError } from './notify-presets';

const investigatingButtons: Set<string> = new Set(); // 跟踪正在调查的按钮

// 单条档案记录
export interface DossierEntry {
  content: string;
  timestamp: string; // 取自全局数据表"当前时间"列
  parsedData?: any;
}

// 接续往期调查：所选基线档案引用（只读复用 getInvestigationHistory，不新增存储）
export interface InvestigationContinueRef {
  content: string;     // 基线档案全文（<APP>...</APP> 提取后的 content）
  timestamp: string;   // 基线档案时间戳
}

// ═══════════════════════════════════════════════════════════════
// 聊天楼层存储
// ═══════════════════════════════════════════════════════════════

const INVESTIGATION_STORY_KEY = 'investigation';
type InvestigationStoryData = Record<string, DossierEntry[]>;

function normalizeDossiers(raw: any): DossierEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x: any) => x && typeof x.content === 'string').map((x: any) => ({
    content: x.content,
    timestamp: typeof x.timestamp === 'string' ? x.timestamp : '',
    ...(x.parsedData !== undefined ? { parsedData: x.parsedData } : {}),
  }));
}

async function loadDossiersFromStory(charName: string): Promise<DossierEntry[]> {
  const data = readStoryFeature<InvestigationStoryData>(INVESTIGATION_STORY_KEY, {});
  return normalizeDossiers(data[charName]);
}

async function saveDossiersToStory(charName: string, dossiers: DossierEntry[]): Promise<boolean> {
  const data = readStoryFeature<InvestigationStoryData>(INVESTIGATION_STORY_KEY, {});
  data[charName] = normalizeDossiers(dossiers);
  return writeStoryFeature(INVESTIGATION_STORY_KEY, data);
}




/** 获取全局数据表中的当前时间 */
function getCurrentGameTime(): string {
  try {
    const time = readStoryClockRaw();
    return time || '';
  } catch (e) {
    return '';
  }
}

/** 获取指定角色的全部大调查历史档案（按时间排序） */
export async function getInvestigationHistory(charName: string): Promise<DossierEntry[]> {
  return await loadDossiersFromStory(charName);
}

/** 保存大调查档案（追加到历史，不删除旧档案） */
export async function saveInvestigation(charName: string, content: string): Promise<void> {
  const history = await loadDossiersFromStory(charName);
  const gameTime = getCurrentGameTime() || new Date().toLocaleString('zh-CN');
  history.push({
    content,
    timestamp: gameTime,
  });
  await saveDossiersToStory(charName, history);
  // 成就打点：大调查完成（每次保存推进 investigations 计数器）。
  try { (window as any).__ubEmitAchievement?.('investigation_done', {}); } catch (e) { /* ignore */ }
  try { (window as any).__ubEmitAchievement?.('action-on-date', { action: 'investigation_done' }); } catch (e) { /* ignore */ }
}

/**
 * 删除指定角色的某条大调查档案（index 为历史数组索引）。
 * 三种入参语义必须严格区分，**不可混同**：
 *   - index 省略   → 清空全部
 *   - index 在界内 → 只删该条
 *   - index 越界   → 列表与存储失步（并发删除 / 双开弹窗 / 列表未刷新），按「找不到」处理并提示，**直接返回不落盘**
 * 旧写法把「未给索引」与「索引越界」并入同一个 else ⇒ 越界时会清空该角色**全部**档案（不可逆数据丢失）。
 */
export async function deleteInvestigation(charName: string, index?: number): Promise<void> {
  const history = await loadDossiersFromStory(charName);
  if (index === undefined) {
    history.length = 0;
  } else if (index >= 0 && index < history.length) {
    history.splice(index, 1);
  } else {
    getToastr()?.warning('该条档案已不存在（列表可能已刷新），未做任何改动。', '大调查');
    return;
  }
  await saveDossiersToStory(charName, history);
}

/** 就地更新指定角色的某条大调查档案原文（不新增快照，保留原时间戳；丢弃过期 parsedData，渲染时按需重新解析） */
export async function updateInvestigationContent(charName: string, index: number, content: string): Promise<void> {
  const history = await loadDossiersFromStory(charName);
  if (index < 0 || index >= history.length) return;
  history[index] = { content, timestamp: history[index].timestamp };
  await saveDossiersToStory(charName, history);
}

/** 检查是否已有大调查档案 */
export async function hasInvestigation(charName: string): Promise<boolean> {
  const history = await getInvestigationHistory(charName);
  return history.length > 0;
}

// 接续往期调查：主模板条件指令（仅 continueRef 存在时注入到 __CONTINUE_INSTRUCTION__ 占位）
const CONTINUE_INSTRUCTION_BLOCK = `
---

## 接续往期调查（本轮特殊设定）

本轮为「接续调查」——已提供该角色一份往期档案作为基线（见下方【往期档案基线】）。本轮**不输出完整档案**，而是输出增量两部分，由系统合并到基线上生成新档案：

1. <DIFF>……</DIFF>：仅列出相对基线**发生变化或需更新**的字段，每项格式为【字段名】新值（给出该字段完整新值，替换基线对应字段）。包括：
   - 数值/状态字段演进（纯洁值、性爱次数、性伴人数、对象男女比、各项指数、开发度、自慰次数、品级、排名、最近/最佳经历、评语、备注等）；
   - 百分比列表字段（性伴名单、常用体位、常用场所）若分布变化，**整列替换**为新完整列表（百分比重新归一）；
   - 关联字段必须一并输出（如纯洁值变化则纯洁度明细同步；性爱次数变化则性伴名单/频率/体位等同步），保持档案内部自洽。
2. <NEW>……</NEW>：仅列出基线中**不存在的新增条目**，每项格式为【字段名】新条目，系统将**追加**到基线对应列表。仅用于纯 additive 列表（评语、性癖、魅力类型、色情标签、纯洁度明细等）；百分比列表不得用 NEW 追加（须走 DIFF 整列替换）。

要求：
- 结合当前剧情进展与角色状态变化演进基线，数值字段反映当前状态——不复制基线、不无视基线、不重述未变字段。
- 字段名沿用基线档案的【字段名】写法。
- 不要在 DIFF/NEW 中重 emit 未变化字段（本轮目的即省 token）。
- 仍须遵循上述全部描写与格式要求。
`;

/** 接续调查：构建基线档案全文的 after_system 注入块（不裁剪，AI 必须看到才能 diff） */
// 参数名勿用裸 ref：会被 unplugin-auto-import 误注入 import {ref} from 'vue' → 全局 Vue 外部引用
export function buildContinueInjection(baseline: InvestigationContinueRef): string {
  const ts = baseline.timestamp || '时间未记录';
  return '【往期档案基线（接续调查基线，供增量更新，非本轮正文）】\n\n=== 往期档案 ｜ ' + ts + ' ===\n' + baseline.content.trim();
}

// 获取大调查提示词
export async function getInvestigationPrompt(continueRef?: InvestigationContinueRef): Promise<string> {
  const continueInstruction = continueRef ? CONTINUE_INSTRUCTION_BLOCK : '';
  return `**请严格按照以下格式输出完整的大调查报告，不要添加任何额外内容或自由发挥格式。**
在输入"大调查app"或"打开大调查app"后，本轮严格不推进剧情内容，专注描写大调查app显示的数据

核心规则：大调查app的显示与使用是面向屏幕前的使用者（即"你"）的上帝视角工具。你必须绝对禁止描写剧情推进、角色反应或任何叙事性内容，专注于详细、完整地呈现app所显示的数据。

---

## 描写哲学

你的输出是一份具有强烈感官冲击的机密档案。每一段描述文字都必须遵循以下原则：

1. **感官优先**：每个身体部位的描述必须同时包含视觉（颜色/形状/光泽）、触觉（温度/湿度/质感）、嗅觉（气息类型/浓淡）等维度。
2. **状态对比**：任何部位的描述必须涵盖「日常状态」与「发情/开发后状态」的视觉对比变化。如：乳头的颜色从日常的色泽变为兴奋时的充血深色，乳房从自然垂坠变为饱满挺翘。
3. **镜头语言**：使用电影镜头式的描写视角——先用广角勾勒整体，再用特写聚焦关键细节，引导读者想象正在透过镜头窥视。
4. **禁忌感**：档案本身是「不应存在的机密」，阅读者正在偷窥不应被知晓的私密数据。这种窥视的背德感应渗透到每一句话中。

---

## 大调查App核心定义

大调查app是一款神秘数据查询工具，其核心功能是查询指定角色的全部真实性经验、性经历、身体数据、外表风格及深层心理特质。

**性别适配原则**：大调查app支持对男/女角色的查询。AI 必须先判断角色性别，再根据性别选用对应的字段和描述模板：
- **女性角色**：使用全部女性专属字段（阴部开发、阴道相关数据、子宫相关数据、怀孕/生产记录等）。
- **男性角色**：使用全部男性专属字段（阳具开发、阴茎相关数据、睾丸相关数据、使人怀孕记录等）。跳过不适用字段（阴部开发、子宫相关数据、怀孕/生产记录等）。

---

## 大调查App功能详解

### 1. 使用触发与权限
- 查询对象：根据输入要求查询指定角色。
- 神秘力量：大调查app的力量是不可被阻挡、绝对真实的。无论角色有何种能力、防护或隐秘，数据均能被完整获取。
- 色情感：确保查询报告的色情感（包括未经人事的青春感和各类反差感）

### 2. 查询数据展示结构
每次启动查询后，必须按以下结构完整输出所有要素

**核心规则：AI 必须严格遵守以下格式，每次输出保持一致，不得使用任何 Markdown 语法。**
---
## 格式强制规则（必须遵守）

1. **所有字段** 使用 \`【字段名】内容\` 格式。字段名用中文全角方括号 \`【】\` 包裹，后直接跟内容（可选的冒号 \`：\` 也接受）。
2. **禁止使用任何 Markdown 语法**：禁止 \`**粗体**\`、\`*斜体*\`、\`### 标题\`、反引号、\`~~删除线~~\`、\`---\` 分隔线、代码块等。
3. **多行内容**：字段内容可以跨多行，直到遇到下一个 \`【字段名】\` 或两个连续换行为止。
4. **列表项**：每行一条，以 \`- \` 开头。
5. **标签**：使用 \`#标签名\` 格式，空格分隔。
6. **进度条**：使用格式 \`XX/100 —— 说明文字\`（XX为0-100的数字）。
7. **身体部位数据**：第一行为数据统计行（包含次数、人数等量化数据）。⚠️ **铁律**：第一行统计数据必须独占一行，只包含数字统计信息（如"口交X次，让对方射精X次"），后续描述文字必须从下一行开始。**绝对禁止**将统计数据与描述文字放在同一行或同一段落中！两者之间必须有换行符分隔。否则会导致解析崩溃！
正确格式（✓）：
【口部开发】口交X次，让对方射精X次
描述文字从第二行开始，描写唇形变化、口腔敏感度……
错误格式（✗）：
【口部开发】口交X次，让对方射精X次。描述文字……（绝对禁止这种同一行的写法！）
8. **百分比格式**：体位和场所的每条数据后需标注百分比，格式为「名称（约XX%）」，各条目用顿号或逗号分隔，百分比之和应为100%。
9. **不要输出** \`====================================\` 等装饰性分隔线。
10. **不要输出** \`机密档案\` 等标题装饰。
11. **性别专属字段**：根据角色性别输出对应字段。女性输出阴部开发、子宫相关数据、怀孕/生产记录；男性输出阳具开发、使人怀孕记录；

---

## 报告内容模板

请严格按照以下字段顺序输出。每个字段都必须出现，如无相关信息则填「无」或「未开发」。若字段对当前性别不适用，填「不适用」并整体跳过该模块。

### 【基础档案】
【姓名】角色全名
【性别】男/女
【年龄】数字岁（可带一位小数，如18.5岁）
【特写】人物背景和形象的详细文字描述。现说明人物身份背景和特点，然后捕捉最具代表性的形象（应使用独立于当前剧情的角色代表性形象），包含面部特征、气质、表情、着装风格、妆容、背景元素及暗示的角色特质等。
【身材数据】身高XXcm，体重XXkg。
女性：三围XX-XX-XXcm，罩杯X。
男性：阴茎勃起长度XXcm，疲软长度XXcm，龟头直径XXcm，睾丸体积XX毫升。
特殊身体特征（疤痕、纹身、穿孔、胎记等）在此注明。

### 【外貌风格档案】
【日常服装风格】详细描述最常穿着的服装风格类型（如：学院风、街头潮流、复古文艺、职业正装、运动休闲、洛丽塔、哥特、森系、极简等）。包含典型搭配示例、常用单品、颜色偏好、材质倾向。注明是反映真实性格还是刻意伪装。
【私密服装风格】详细描述内衣裤偏好风格（如：纯棉可爱、蕾丝性感、运动简约、绑带情趣、无痕裸感、复古束身、平角/三角/丁字/不穿等）。包含常用颜色、是否成套穿着、材质与视觉的取舍。特殊癖好（丁字裤、C字裤、开裆款、不穿内衣、不穿内裤等）在此注明。
【妆容风格】详细描述日常妆容类型（如：裸妆、清纯淡妆、韩系水光、日系软萌、欧美浓妆、烟熏、伪素颜、完全素颜等）。包含底妆偏好、眉形特征、眼妆深度、腮红风格、唇妆常用色号。不同场合的妆容切换须说明。男性若无化妆习惯则填「素颜」并描述原生面容特征。

### 【心理性向档案】
【性取向】百分比描述（如：异性恋80%，双性恋20%）
【核心性癖】内心最深处的核心性癖关键词，用#标签格式，空格分隔（如：#被支配 #露出 #内射成瘾 #深喉 #后宫 #榨精 #逆推 #足交）
【羞耻指数】XX/100 —— 说明文字（0为完全无感，100为极度羞耻）
【性自信指数】XX/100 —— 说明文字（0为完全不自信，100为极度自信）
【性开放度】XX/100 —— 说明文字（0为极度保守，100为完全开放）

### 【纯洁档案】
【是否为处女/处男】是/否
【破处对象/时间】若非处，注明破处时间、对象姓名及身份、发生地点、是否自愿。若为处则填「无」。
【纯洁值综合评分】XX%（100%为完全未被任何形式开发过的原生状态。数值越低，被开发维度越多、程度越深。不区分性别，纯洁值对男女通用。）
【部位纯洁度明细】（根据角色性别输出对应条目，每种性别只输出一套，不可重复输出两套）
女性专属：
- 口腔纯洁：已失（被X次口交/被X根不同肉棒进入）/ 未失
- 胸部纯洁：已失（被X次乳交/被X人揉捏）/ 未失
- 阴部纯洁：已失（被X次性交/处女膜XXXX年XX月XX日破裂）/ 未失
- 肛门纯洁：已失（被X次肛交/被X根不同肉棒进入）/ 未失
- 触碰纯洁：已失（被人用手猥亵X次）/ 未失
- 目视纯洁：已失（被X人看过裸体/裸照被传播至X人）/ 未失
- 颜面纯洁：已失（被颜射X次/被体液接触X次）/ 未失
男性专属：
- 口腔纯洁：已失（被X次口交/被X根不同肉棒进入）/ 未失
- 手交纯洁：已失（被人用手打飞机X次/被X人撸过）/ 未失
- 阴茎纯洁：已失（插入阴道/口腔/肛门X次/首次射精XXXX年XX月XX日）/ 未失
- 肛门纯洁：已失（被X次肛交/被X根不同肉棒进入）/ 未失
- 触碰纯洁：已失（被人用手猥亵X次）/ 未失
- 目视纯洁：已失（被X人看过裸体/裸照被传播至X人）/ 未失
- 颜面纯洁：已失（被颜射X次/被体液接触X次）/ 未失

### 【性爱统计】
【性爱次数】具体数字（包含主动插入、被插入、口交、肛交、手交等所有射精/被射精行为，数据避免过分夸张）
【性爱人数】只输出总人数数字（纯数字，不写「人」等单位、不附加任何说明文字，禁止在本字段内写男女分列）
【对象男女比】男X，女Y（X/Y 为该角色的性爱对象中男性与女性的数量，均为整数；两者之和应等于【性爱人数】；某一性别为 0 时照写 0；若从未有性经历则填「无」）
【主要性爱名单】每行格式「- 姓名，身份，关系，是否强迫，约XX%」。严格以中文逗号「，」分隔五个字段，字段顺序不可颠倒。
⚠️ 格式铁律（违反将导致解析崩溃，必须逐字遵守）：
1. 分隔符只能用「，」（中文逗号），禁止使用「、」「/」「|」等任何其他符号作为字段分隔。
2. 所有字段值内**绝对禁止**出现任何括号「（）」「()」及其中的注释内容。包括但不限于：说明原因、补充人数、描述情况、备注等。如需额外说明，请在报告其他部分展开，不得污染此名单。
3. 是否强迫字段**只能且必须**填以下三个值之一：「是」「否」「半推半就」。禁止填写「部分强迫」「非自愿」「表面自愿」「被诱导」等任何变体或长句。
4. 占比格式为「约XX%」（XX为整数），放在每行最后。百分比之和应接近100%。
5. 每行恰好5个字段，用「，」分隔。若某字段无信息，填「未知」占位，不可跳过。
示例（严格遵守，不允许任何偏差）：
- 张三，学长，前男友，半推半就，约45%
- 李四，大学同学，炮友，否，约20%
- 王五，酒吧认识，一夜情，否，约5%
- 赵六，同事，现任男友，否，约5%
- 其他，酒吧搭讪，炮友们，否，约25%
【性爱频率】最近一年内平均频率（如：每周3次）及频率变化趋势（增加/减少/稳定）
【最常使用体位】每种体位后标注百分比，格式如「后入式（约40%），传教士（约25%），骑乘位（约20%），侧入式（约10%），其他（约5%）」。百分比之和为100%。可根据角色性角色（主动方/被动方/均可）调整体位类型。
【性爱场所分布】每种场所后标注百分比，格式如「酒店（约50%），出租屋（约25%），其他（约25%）」。百分比之和为100%。

### 【生育记录】
（根据角色性别输出对应条目）
女性专属：
【怀孕/生产/打胎次数】怀孕X次，生产X次，打胎X次
【详细生育记录】每次怀孕的时间、对象、结果（生产/流产/打胎）。若为生产，注明子女信息。若无则填「无」。
男性专属：
【使人怀孕次数】使人怀孕X次，已知子女X名
【详细使人怀孕记录】每次使人怀孕的时间、对象、结果（生产/流产/打胎）。若为生产，注明子女信息。若无则填「无」。

### 【开发状态】
（各部位第一行为量化数据行，该数值应克制、真实，避免过度夸张。后续为描述文字。描述应通过身体变化展现使用历史。）

【口部开发】口交X次，让对方射精X次
描述嘴唇、口腔、咽喉的变化：唇形变化、唇色深浅、口腔敏感度、深喉适应程度与吞咽反射状况、味觉偏好形成等。

【手部开发】手交X次，让对方射精X次（女）/被手交至射精X次（男）
描述手部及手指变化、手淫技巧熟练程度特征；手掌皮肤是否因接触精液/体液频繁而改变。

【足部开发】
足交X次，让对方射精X次（女）/被足交至射精X次（男），被舔足X次，足部高潮X次
描述足部变化：足弓弧度与足型美感、脚趾灵活度与抓握力、足底皮肤柔软度与色泽（是否因频繁摩擦产生茧子或角质变化）、足部护理习惯（美甲、去角质、保养品使用）、足部气味特征、被舔足或足交时的敏感度反应。若从未足交则填「未曾开发」并描述原生状态（如天然足型、日常护理情况等）。

【乳部开发】（女性适用；男性若不适用则填「不适用」并跳过）
乳交X次，乳头高潮X次
描述乳房及乳头变化：乳型演变、乳晕颜色与大小、乳头长度与敏感度、乳房柔软度与弹性、是否因频繁揉捏出现形态改变。

【阳具开发】（男性适用；女性若不适用则填「不适用」并跳过）
主动插入X次，被口X次，被手X次，射精总次数X次，累计射精总量XX毫升
描述阴茎变化：龟头色泽与角化程度、冠状沟敏感度、阴茎表皮色素沉着、勃起硬度与持久力变化、射精量变化趋势与控制力评估、睾丸大小与下垂程度、精液特征。

【阴部开发】（女性适用；男性若不适用则填「不适用」并跳过）
性交X次，高潮X次，潮吹X次，内射X次，阴道/子宫内被内射精液总容量XX毫升
描述阴部及阴道变化：阴唇形态与颜色、阴道紧致度与弹性、阴道壁皱褶状况、子宫口状态、阴蒂大小与敏感度、分泌物特征与气味、是否易潮吹体质。参考：处女=粉嫩紧闭；偶有性行为=略有色泽加深但紧致；频繁=颜色变深弹性增加阴唇微张；多次生育或长期高频=明显松弛色泽暗沉阴唇外翻。

【肛部开发】肛交X次（被插入X次/主动插入X次），肛门高潮X次，肠道射精X次（被内射X次/射入他人X次），肠道内被内射精液总容量XX毫升
描述肛门变化：肛门褶皱形态、括约肌紧致度、肛内黏膜状态、肛周色泽、自行收缩能力、是否可扩张。若从未肛交则填「未曾开发」并描述原生状态。男性需注明前列腺敏感度。

### 【自慰档案】
【自慰总次数】具体数字（包含达到高潮/射精的自慰行为次数）
【自慰频率】最近一年内平均自慰频率（如：每周5次）及频率变化趋势（增加/减少/稳定）
【第一次自慰】详细描写时间（年龄）、地点、触发原因、使用方式、感受与事后心理。若从未自慰则填「无」。
【常用自慰方式】以第一人称自白口吻，生动描述角色最常用的自慰方式、习惯、场景，不需要心理。

### 【性经历档案】
【第一次性经历】详细描写时间、地点、对象、过程概述、角色当时的感受与事后心理。注明角色在其中的性角色（主动/被动/互攻）。必须包含一段「画面回放」：挑选该次经历中最色气的一个瞬间（约5秒片段），用慢镜头笔触逐帧描写身体反应与表情变化。这是整段经历的情绪高潮，不可平淡带过。
【最近一次性经历】详细描写时间、地点、对象、过程概述、角色感受。必须包含一段「画面回放」，同上要求。
【最爽一次性经历】详细描写时间、地点、对象、过程亮点、角色达到的高潮体验级别（如多重高潮/潮吹/失神/连续射精/干性高潮/前列腺高潮等）。必须包含一段「画面回放」，同上要求。

### 【综合魅力评估】
【魅力类型】#标签1 #标签2 #标签3 #标签4…（如女：#清纯初恋 #御姐 #野猫 #邻家小妹 #文学少女；如男：#霸道总裁 #狼狗系 #温柔学长 #禁欲系 #小奶狗
【色情分类TAG】#标签1 #标签2 #标签3 #标签4 …（涵盖身体特征、行为倾向、使用评价、发情特征等）
【全球排名】第XX名
【品级评定】X级（SSR/SS级/S级/A级/B级/C级/D级/E级）（仅输出等级不需要在这里解释）
【排名优势因素】
- 因素1（具体说明稀有度或突出程度）
- 因素2
- 因素3
【排名劣势因素】
- 因素1（具体说明如何拉低排名）
- 因素2
【最具性吸引力部位】部位名称及特征描述
【声音档案】分四阶段描写此角色的声音全貌：
- 日常说话：音色、语调、口头禅，说话时唇齿间的韵律
- 被撩拨时：呼吸变促、压抑的轻哼、开始发颤的音节
- 快感累积时：呻吟与喘息的变化轨迹（从压抑到逐步失控的渐进过程）、无意识发出的词汇、音量与气息节奏
- 高潮瞬间：爆发式的叫喊或窒息般的无声、喉音震颤、声带极限、事后嗓音的沙哑质变
【流言与评价】
以「传闻」「某人回忆」「圈内流传」「事后感叹」等不同来源视角，收集6条以上关于此角色性张力/性表现的第三方评价。每条应有不同的来源身份（前任/炮友/偷窥者/闺蜜/竞争对手/暗恋者等），使用自然口语化表达，像是酒桌上的窃窃私语等。可用句号结尾。
每行一条，以「（来源者）：」开头。
示例：\`前任炮友：她体力是真的好，一晚上能来三次。\`
【使用者备注】以{{user}}的第一人称口吻，用一句话（不超过100字）对调查对象做出私人点评或态度。口吻应体现{{user}}对此角色的真实态度（如迷恋/欣赏/不屑/好奇/畏惧等），像是写在档案最后一页的随手批注。
【人物自评】以被调查角色的第一人称口吻，用一句话（不超过100字）对调查报告的内容做出私人点评或态度。口吻应体现被调查角色对该档案的看法和想法，应当贴合人物自身性格思考其看到档案时的真实反应。

---|

## 输出格式规范

所有请求的输出必须被包裹在以下结构中：
<APP>
[完整的App数据内容]
</APP>

---
## 特殊指令
- 若查询对象为处女/处男，则性经历档案、性爱统计、生育记录等字段自动填充为"暂无数据"。开发状态仍须描述各部位原生状态，所有纯洁度明细标注为"未失"。
- 若查询对象无某项开发经历（如从未肛交），则该部位标注"未曾开发"并描写原生状态。
- 若某部位对当前性别不适用（如女性的阳具开发、男性的乳部开发/阴部开发），则该部位标注"不适用"并整体跳过。
- 所有数据须与剧情历史保持绝对一致性，且符合故事世界观和时代背景，不可出现矛盾。
- 描写语气须保持客观，避免带入主观道德评判。
- 所有输出内容均需完整详尽，禁止因字数等原因省略任何模块或描述。
${continueInstruction}
  ---

  ## 执行指令

  请严格参考格式要求调查__CHARNAME__，不做剧情推进，不输出任何无关思考和正文。`;
}

// 使用解析器+渲染器美化大调查内容
// content: 存储在当前聊天楼层中的原始大调查文本
// charName: 角色名称，用于弹出框标题
export function beautifyInvestigationContent(content: string, charName: string, style?: StyleType, isInvestigating?: boolean): string {
  try {
    const data = parseInvestigation(content);
    if (!data) {
      console.warn('[大调查] 解析失败，回退到原始文本显示');
      return fallbackHTML(content, charName, isInvestigating);
    }
    if (style) {
      return renderThemedDossier(data, charName, style);
    }
    return renderInvestigationHTML(data, charName, isInvestigating);
  } catch (e) {
    console.error('[大调查] 渲染失败:', e);
    return fallbackHTML(content, charName, isInvestigating);
  }
}

// 解析失败时的回退显示（保留重新生成和清除档案按钮，确保用户始终可以操作）
function fallbackHTML(content: string, charName: string, isInvestigating?: boolean): string {
  var safe = escapeHtml(content).replace(/\n/g, '<br>'); // U2：统一出口（补齐 " 转义）
  var safeName = escapeHtml(charName);
  return '<style>.iv-popup{display:flex;flex-direction:column;max-width:860px;width:100%;max-height:88vh;background:#1b1b1d;border:1px solid #333235;overflow:hidden;font-family:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;box-sizing:border-box}' +
    '.iv-popup-body{flex:1;overflow-y:auto;color:#e0dcd0;line-height:1.8;font-size:13px;}' +
    '.iv-top-bar{display:flex;align-items:center;justify-content:space-between;padding:14px 22px;border-bottom:2px solid #333235;background:#27272a;position:sticky;top:0;z-index:5;}' +
    '.iv-top-bar .iv-name{font-size:15px;font-weight:700;color:#e0dcd0;letter-spacing:3px;}' +
    '.iv-top-bar .iv-btns{display:flex;gap:8px;align-items:center;}' +
    '.iv-top-btn{font-family:inherit;font-size:10.5px;letter-spacing:2px;padding:5px 14px;cursor:pointer;transition:all 0.2s;background:transparent;border:1px solid #333235;color:#706860;white-space:nowrap;}' +
    '.iv-top-btn:hover{border-color:#c41e3a;color:#c41e3a;}' +
    '.iv-top-close{width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid #333235;color:#706860;font-size:14px;cursor:pointer;padding:0;}' +
    '.iv-top-close:hover{color:#c41e3a;border-color:#c41e3a;}' +
    '</style>' +
    '<div class="iv-popup"><div class="iv-popup-body">' +
    '<div class="iv-top-bar"><span class="iv-name">' + safeName + '</span><div class="iv-btns"><button class="iv-top-btn" id="investigationRegenerateBtn" data-name="' + safeName + '"' + (isInvestigating?' disabled':'') + '>' + (isInvestigating?'调查中...':'再次生成') + '</button><button class="iv-top-btn" id="investigationDeleteBtn" data-name="' + safeName + '">清除全部档案</button><button class="iv-top-close" id="panelClose">&times;</button></div></div>' +
    '<pre style="white-space:pre-wrap;padding:24px;">' + safe + '</pre>' +
    '</div></div>';
}

// 获取TavernHelper对象

// 获取toastr对象

// 执行大调查生成（使用 generateRaw，不使用预设）
//
// 当前策略（1A 三段式统一结构）：
// 1. 结构头（破限+防八股）= ordered_prompts 首个 system；系统指令拼入 user_input，确保出现在消息末尾
// 2. 剧情上下文不进 chat_history（max_chat_history 置 0），走 after_system 资料块注入：
//    最近 N 条 AI 回复（N=用户设置 contextCount，过上下文标签剥离）
// 3. 纪要统一走资料块（用户定案）：完整纪要在前、剧情上下文在后（chronicle-blocks 共享层，
//    取多少条/要不要概览与原逻辑一致——大调查取「内容含名」最新 N 条全部完整，无概览拆分）；
//    数据库纪要世界书条目由扫描钩 suspend，触发注入不再注入 AM 序号
// 4. 世界书绿灯由阶段F触发注入喂入扫描素材（角色名/长按额外要求/剧情上下文正文）
// 5. 宏替换 {{user}} 由 substitudeMacros 处理，__CHARNAME__ 由 JS 变量 charName 替换
export async function performInvestigation(charName: string, btnElement?: HTMLButtonElement, extraPrompt?: string, continueRef?: InvestigationContinueRef): Promise<string | null> {
  // ═══════════════════════════════════════════════════════════
  // 阶段A：获取所需API
  // ═══════════════════════════════════════════════════════════

  const th = getTavernHelper();
  const generateRaw = th?.generateRaw;     // raw生成函数（不使用预设）
  const toastr = getToastr();              // toastr通知组件

  if (!generateRaw) {
    showEnvNotReady('大调查');
    return null;
  }

  // 校验自定义 API 配置（若启用自定义 API 但必填项缺失，则提前失败）
  const apiErr = validateCustomApiConfig('investigation');
  if (apiErr) {
    showApiConfigError('大调查', apiErr);
    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // 阶段B：读取用户设置的上下文条目数
  // ═══════════════════════════════════════════════════════════

  const config = getConfig();
  const contextCount = config.investigationContextCount || 20;  // 设置默认 10，此处为兜底
  const maxSummaryCount = config.investigationMaxSummaryCount ?? 5;  // 纪要资料块条数（与原「最大注入纪要数」同一取量逻辑）

  // ═══════════════════════════════════════════════════════════
  // 阶段C：保存按钮状态（finally 中恢复）
  // ═══════════════════════════════════════════════════════════

  const originalText = btnElement?.textContent || '';
  const originalDisabled = btnElement?.disabled || false;

  if (btnElement) {
    btnElement.textContent = '调查中';
    btnElement.disabled = true;
  }
  // 进行中登记必须与 btnElement 解耦：「再次生成」入口以 performInvestigation(name) 无按钮调用，
  // 旧写法只在此 if 内登记 ⇒ isInvestigating() 恒 false，守卫失效、同角色可并发双发 AI 请求。
  investigatingButtons.add(charName);

  // 聊天归属守卫：AI 返回后要写当前聊天的调查档案；请求期间切聊天 → 整体丢弃（不写新聊天、不弹错误）。
  const scope = captureChatScope('大调查');

  // ═══════════════════════════════════════════════════════════
  // 阶段D–G：准备提示词、注入触发器、调用 generateRaw
  // ═══════════════════════════════════════════════════════════

  try {
    // D1. 获取原始提示词（约4000+字，包含完整的输出格式、字段模板等）
    let rawInstruction = await getInvestigationPrompt(continueRef);

    // D1.5. 追加用户额外要求（长按输入，不持久化，仅本次调查生效）
    if (extraPrompt && extraPrompt.trim()) {
      rawInstruction += '\n\n---\n## 用户额外要求\n' + extraPrompt.trim() + '\n';
    }

    // D2. 酒馆宏替换：将 {{user}}、{{char}} 等宏替换为实际值
    //     不再应用正则，指令原文直接作为 user_input
    const instruction = th.substitudeMacros(rawInstruction).replace(/__CHARNAME__/g, charName);

    // ═══════════════════════════════════════════════════════════
    // 阶段E：人物纪要 + 剧情上下文（1A 三段式：资料块承载，不进 chat_history）
    //
    // max_chat_history 置 0——原生 chat_history 槽位不再带楼层。纪要统一走资料块（用户定案）：
    // 完整纪要在前，最近剧情（最近 N 条 AI 回复，过上下文标签剥离）在后；
    // 同一份上下文正文也作为阶段F触发注入的扫描素材（user_input 不参与绿灯触发）。
    // ═══════════════════════════════════════════════════════════
    const chronicleBlocks = readChronicleDossierBlocks([charName], maxSummaryCount);
    const storyContext = getAiReplyContext(contextCount);

    // ═══════════════════════════════════════════════════════════
    // 阶段F：注入触发提示词以主动触发世界书扫描
    // ═══════════════════════════════════════════════════════════

    // max_chat_history 置 0 后原生 chat_history 不携带楼层，user_input 也不参与绿灯扫描
    // （小手机管线契约）——绿灯条目的触发素材必须全部由本注入显式喂入。
    // 纪要不再注入 AM 序号（用户定案）：纪要内容已走资料块，数据库纪要条目由扫描钩 suspend。
    //
    // position='none'  → 不包含在发给AI的消息数组中
    // should_scan=true → 世界书绿灯条目扫描这条文本中是否包含关键字
    // once: true       → 仅下一次生成请求有效，生成后自动移除
    // 每次尝试都要重做「一次性注入 + 扫描准备 + 生成」：once:true 的语义是「只在下一次请求生成中
    // 生效」，若把重试放在注入之内，重试那一发就会丢掉资料块与触发素材（产出残缺结果还照样存库）。
    const runInvestigationRequest = async (ctx: TextAiContext) => {
    const injectionContent = [
      [charName, extraPrompt?.trim() || ''].filter(Boolean).join(' '),
      storyContext,
    ].filter(Boolean).join('\n\n');
    th.injectPrompts([{
      id: 'investigation_trigger_' + charName.replace(/[^a-zA-Z0-9一-鿿_-]/g, '_'),
      position: 'none',          // 不发给AI
      depth: 0,
      role: 'system',
      content: injectionContent, // 角色名 + 额外要求 + 剧情上下文正文
      should_scan: true,         // 加入世界书绿灯条目扫描
    }], { once: true });

    // 接续调查：注入基线档案全文（after_system，供 AI 增量更新参考，不参与扫描）
    if (continueRef) {
      th.injectPrompts([{
        id: 'investigation_continue_' + charName.replace(/[^a-zA-Z0-9一-鿿_-]/g, '_'),
        position: 'after_system', depth: 0, role: 'system',
        content: buildContinueInjection(continueRef),
        should_scan: false,
      }], { once: true });
    }

    // 资料块注入（after_system，发给 AI 不参与扫描）：人物纪要（完整）在前、剧情上下文在后（用户定案顺序）。
    const dossierParts: string[] = [];
    if (chronicleBlocks) {
      dossierParts.push('【人物纪要（从旧到新，供了解该角色既往经历）】\n' + chronicleBlocks);
    }
    if (storyContext) {
      dossierParts.push('【剧情上下文（最近剧情的 AI 回复节选，供与既有剧情保持一致）】\n' + storyContext);
    }
    if (dossierParts.length) {
      th.injectPrompts([{
        id: 'investigation_context_' + charName.replace(/[^a-zA-Z0-9一-鿿_-]/g, '_'),
        position: 'after_system', depth: 0, role: 'system',
        content: dossierParts.join('\n\n'),
        should_scan: false,
      }], { once: true });
    }
    // ═══════════════════════════════════════════════════════════
    // 阶段G：调用 generateRaw
    // ═══════════════════════════════════════════════════════════

    // 进行中提示由统一 AI 活动注册表（withTextAiRetry + 主界面提示条）负责，这里不再单独弹 toast

    //
    // 策略变更（修复系统提示词消失问题）：
    // 1. 不再使用 injectPrompts 注入系统指令（旧版本兼容性不可靠）
    // 2. 不再使用 overrides.chat_history（与 ordered_prompts 同时使用会被忽略）
    // 3. 不再过滤 user 消息
    // 4. 系统指令直接作为 user_input，确保它一定会出现在 AI 收到的消息末尾
    //

    // G1. 系统提示词直接作为 user_input
    // G2. 调用 generateRaw
    //     custom_api：当用户在设置→API 中选择「自定义API」时，
    //     getCustomApiConfig() 返回自定义 API 参数；否则返回 undefined，
    //     使用酒馆当前 API。上下文结构与提示词内容保持不变。
    // 扫描前准备：剔除数据库纪要自投影条目（纪要已走资料块，防重复回喂）+ keep 放行窥私/消息记录条目族
    // （资料块无消息注入，靠世界书条目丰满人物——worldbook-entry.keepPhoneRecordEntries）+ EJS 预渲染；
    // <safe> 无害化收尾段已收编为共享尾部破限（见 getJailbreakTailPrompts），指令正文不再内嵌
    return await withNativeScanWorldbook(
      { suspend: e => isChronicleEntryName(wbEntryName(e)), keep: keepPhoneRecordEntries },
      () => generateRaw({
      should_silence: true,
      generation_id: ctx.generationId,
      user_input: instruction,
      ordered_prompts: [
        ...getJailbreakHeadPrompts({ antiCliche: true }),
        ...STANDARD_PROMPT_MIDDLE,
        ...getJailbreakTailPrompts(),
      ],
      // 0 上下文：原生 chat_history 不带楼层（剧情上下文走资料块注入），世界书扫描靠上方触发注入
      max_chat_history: STANDARD_MAX_CHAT_HISTORY,
      // 自定义 API（undefined 时使用酒馆当前 API）
      custom_api: getCustomApiConfig('investigation'),
      }),
    );
    };
    const result = await withTextAiRetry('investigation', runInvestigationRequest, { feature: 'investigation' });

    // ═══════════════════════════════════════════════════════
    // 阶段G：处理生成结果
    // ═══════════════════════════════════════════════════════

    if (typeof result === 'string') {
      let toSave: string | null = null;
      if (continueRef) {
        const diff = extractDiffContent(result);
        if (diff) {
          try {
            toSave = mergeInvestigationDiff(continueRef.content, diff.diff, diff.neu);
          } catch (e) {
            console.warn('[大调查] 增量合并失败，回退全量:', e);
            toSave = extractAppContent(result);
          }
        } else {
          // 兜底：AI 未按 diff 格式输出，按全量档案处理
          toSave = extractAppContent(result);
        }
      } else {
        toSave = extractAppContent(result);
      }
      if (toSave) {
        // 聊天归属守卫（写前核对）：切走后结果属于旧聊天，静默丢弃。
        if (!scope.isCurrent()) return null;
        // 保存到历史（追加为新快照）
        await saveInvestigation(charName, toSave);
        toastr?.success(continueRef ? '接续调查完成' : '大调查完成', '大调查提示');
        return toSave;
      } else {
        showGenOutputError('大调查', result);
      }
    } else {
      // result 不是字符串（可能是 tool_calls 结构等）
      showGenOutputError('大调查', result);
    }

  } catch (e) {
    // 聊天已切换：旧聊天的失败也不该在新聊天弹错误。
    if (!scope.isCurrent()) return null;
    if (isAiAbortError(e)) return null; // 用户终止：静默收口
    showGenCatchError('大调查', e);

  } finally {
    // ═══════════════════════════════════════════════════════
    // 阶段H：无论成功或失败，恢复按钮状态
    // ═══════════════════════════════════════════════════════
    if (btnElement) {
      btnElement.textContent = originalText;
      btnElement.disabled = originalDisabled;
    }
    investigatingButtons.delete(charName);
  }

  return null;
}

// 检查角色是否正在调查中
export function isInvestigating(charName: string): boolean {
  return investigatingButtons.has(charName);
}
