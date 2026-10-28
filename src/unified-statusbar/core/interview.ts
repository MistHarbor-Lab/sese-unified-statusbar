import { readStoryClockRaw } from './calendar-core';
import { getTavernHelper, getToastr } from './env';
import { STANDARD_PROMPT_MIDDLE, STANDARD_MAX_CHAT_HISTORY } from './ai-request-pipeline';
import { extractAppContent } from './app-content';
// ===== 大采访功能核心模块 =====

import { getCustomApiConfig, showPersistentError, validateCustomApiConfig, withTextAiRetry, isAiAbortError, type TextAiContext } from './api-config';
import { getConfig } from './config-store';
import { showApiConfigError, showEnvNotReady, showGenCatchError, showGenOutputError } from './notify-presets';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import { getAiReplyContext } from './map-system';
import { keepPhoneRecordEntries, wbEntryName, withNativeScanWorldbook } from './worldbook-entry';
import { isChronicleEntryName, readChronicleDossierBlocks } from './chronicle-blocks';
import { getSheetByName, isNsfwPlayActive } from './data-manager';
import { formatRelationInjectionLines, parseCharacterRelationRows, type CharacterRelation } from './character-relation-model';
import { getInvestigationHistory } from './investigation';
import { parseInterview, type InterviewData } from './interview-parser';
import { readMapNode, readExploreRecordView, type MapNode } from './map-tree-store';
import { readStoryFeature, writeStoryFeature, captureChatScope } from './story-floor-store';

export interface InterviewConfig {
  primaryInterviewee: string;
  interviewers: string[];
  interviewees: string[];
  locationName: string;
  locationLabel: string;
  locationNodeId?: string;
  readDossier: boolean;
  extraPrompt?: string;
  continueRefs?: InterviewContinueRef[];
}

export interface InterviewContinueRef {
  content: string;
  timestamp: string;
  title: string;
  subtitle: string;
  interviewers: string[];
  interviewees: string[];
}

export interface InterviewEntry {
  content: string;
  timestamp: string;
  parsedData?: InterviewData;
}

type InterviewStoryData = Record<string, InterviewEntry[]>;

const interviewingButtons = new Set<string>();

const INTERVIEW_PROMPT_TEMPLATE = `**请严格按照以下格式输出完整的色情采访记录，不要添加任何额外内容或自由发挥格式。**
在"采访"生成请求后，本轮严格不推进主线剧情内容，专注呈现这一场色情采访的完整实录。

核心规则：这是一场色情采访的实拍实录——采访者与被采访者之间一场活泼、天马行空的闲聊式访谈。输出仅为这场采访的实录，不推进主线、不输出无关思考。**采访以对话为绝对主体与核心形式**——[问]/[答]对话占绝大部分篇幅，节奏可脱开一问一答的死板交替（可连续追问、独白式长答、多人插话接话、玩闹式来回），但对话始终是主轴；[白]/[景]/[声]仅作简短过渡、镜头与声效 cue，**绝不大段旁白铺陈、绝不喧宾夺主**。**色情是本场采访对话的绝对主题与核心要素**，任何话题游走都须服务于色情，不得绕过、淡化或跳过。

---

## 采访定位（游离主线 · 闲聊闲采）

这场采访发生在当前时间点，却**游离于主线故事之外**——它属于一次"脱离现实"的采访闲聊，不聚焦某一特定事件：采访者与被采访者跳出当下剧情，天马行空地聊开去，话题可在角色的整个人生里自由游走——过往背景、旧时故事、人物经历、私密往事、关系渊源，皆可追溯、皆可发挥。角色的人设、性格、彼此关系须与剧情历史及世界书设定保持一致（这是张力的来源），但内容不必拘泥于最近剧情走向或某一特定事件。

气氛以**活泼**为基调：生动互动、打趣挑逗、插科打诨、玩闹感；具体气氛仍依在场人物的人设与关系而定——冷峻或矜持的角色可保留其本色，不必强行活泼。**色情主题绝不脱离，且是本场采访的绝对核心**：无论话题如何天马行空地游走，对话的每一轮都须落在色情之上——性经验、身体、欲望、羞耻、关系中的情欲张力——活泼是外壳，色情是内核，绝不可借活泼或闲聊之名稀释、绕过或跳过色情。

---

## 描写哲学

你的输出是一场具有强烈感官冲击与色情张力的"实拍采访"实录。每一段描写都必须遵循以下原则：

1. **感官优先**：所有身体/性的描写必须同时包含视觉（颜色/形状/光泽/体液）、触觉（温度/湿度/质感/痉挛）、听觉（喘息/呻吟/水声/黏腻声）、嗅觉（气息/体味/情欲气息）等维度。
2. **状态真实**：被采访者的神态、语气、肢体反应须符合其本身性格、当前状态与人物关系——是矜持、抗拒、慌乱、沉沦、妖冶、从容、兴奋、挑衅或其他，一律由其人设与情境决定，**不预设固定走向**。
3. **镜头语言**：采访有"记录/留影"在场。即便古代或前现代背景，也以画师留影、史官采风、铜镜映录、留影石等时代化方式建立"被记录、被注视"的间离感。用镜头视角推进——广角交代现场，特写聚焦关键细节，让读者如临现场窥视。
4. **对话为绝对主体**：采访以对话为绝对核心形式，[问]/[答]气泡占绝大部分篇幅。节奏可脱开一问一答的死板交替（可连续追问、独白式长答、多人插话接话、玩闹式来回），但对话始终是主轴。[问]/[答]气泡内**只能是纯粹对话（角色说出的话）**，禁止把行动/表情/语气塞进对话气泡；行动、表情、语气、肢体、镜头、氛围描写一律放入[白]旁白或[景]镜头插页——但[白]/[景]/[声]只作**简短**过渡与 cue（一两句点睛），**绝不大段旁白铺陈**、绝不替代对话成为主体；[声]仅用于呻吟/喘息/淫语/拟声。对话要自然、口语、色气，旁白要感官、电影感但克制。

---

## 采访核心定义

色情采访是一场由采访者主导、在指定地点对被采访者进行的实拍色情访谈/演示。

采访者：__INTERVIEWERS__
被采访者：__INTERVIEWEES__
采访地点：__INTERVIEW_LOCATION__

采访在AI判断下自然推进。角色的人设、性格、彼此关系须与剧情历史及世界书设定保持一致；但采访本身游离于主线之外，话题不拘泥于最近剧情或某一特定事件，可在角色过往与关系里天马行空地展开。

---

## 采访现场

采访现场有"记录/留影"装置与工作人员在场（"实拍"前提）。即便古代或前现代背景，也以画师留影、史官采风、铜镜映录、留影石等时代化方式建立"被记录、被注视"的间离感。开场须用[景]交代现场布置、氛围与"记录"机位，让被采访者置身于"被记录"的处境。

---

## 采访推进（自由形成，天马行空，不预设走向）

采访的具体走向——话题深浅、气氛冷暖、被采访者是矜持还是主动、是抗拒还是配合、是否升级到演示——须完全根据在场采访者与被采访者的**性格特点、人际关系、行动逻辑**自由形成，**不套用固定模板**：
- 有人设矜持或慌乱抗拒，有人设从容应对或反客为主，有人设妖冶主动或挑逗主导；一切以人设与关系为准。
- 熟人/恋人/仇人同场时，依其关系自然产生相应的情感与生理反应（情感张力、羞耻、刺激、报复等）——**人物关系与故事背景是这场采访色情张力的主要来源**。
- 话题可自由游走于角色的过往背景、旧时故事、人物经历、私密往事、关系渊源，不必绑定当前剧情事件。
- 形式可脱开一问一答的死板交替：可连续追问、独白式长答、多人插话接话、玩闹式来回、天马行空地跳问——但**对话始终是绝对主体**，[白]/[景]/[声]仅作简短过渡与 cue，**绝不大段旁白**、绝不喧宾夺主；只是借用采访的壳子。
- 必选被采访者通常为镜头焦点，其他被采访者可旁听、反应、被一并质询、或被要求协助演示——具体由人设与情境决定，不强制。

---

## 话题方向（覆盖但不限，自由游走）

话题须色情、具体，可在角色整个人生里自由取材，覆盖但不限于：
- 性经验与"第一次"（时间/对象/地点/感受/画面回放）
- 身体开发状况（各部位敏感度/反应/变化，可要求当场演示）
- 擅长/偏好的性爱方式与体位
- 核心性癖与羞耻秘密
- 与熟悉之人的过往情事、关系渊源、暧昧旧账
- 当场演示/验身/被要求对镜头自白
- 任何由人物关系与背景自然生发的天马行空话题
气氛活泼，节奏自由，是否升级到演示须符合在场人物的性格特点与关系逻辑，不强行推进。所有话题都须服务于色情这一绝对核心，不得借题外话绕过色情。

---

## 采访形式

- 以[问]/[答]对话为**绝对主轴**，节奏可脱开一问一答的交替（连续追问/独白长答/多人接话/玩闹来回皆可），但对话占绝大部分篇幅；[白]/[景]/[声]仅作简短穿插（行动/表情/语气/肢体/氛围/镜头/声效的一两句点睛），**绝不大段旁白铺陈**、绝不替代对话成为主体。
- 每个[问]/[答]须附一个〈情〉情绪标签（如 害羞/慌乱/抗拒/沉沦/臣服/妖冶/诱导/低哑/调侃/兴奋/从容/挑衅/失神…），情绪须贴合该人物当前真实状态。
- **多采访者**：须注重不同采访者之间的互动感与参与感——轮流提问、插话、接手、从旁挑逗/配合，避免一人独占。
- **多被采访者**：须注重不同被采访者之间的互动感与参与感——彼此反应、被并问、被要求协助演示、相互影响，让多人均有存在感。
- 对话气泡内只放角色说出的话（含「」书名号/引号均可），行动描写一律移入[白]/[景]。

---

## 行文风格

- **色情为绝对核心**：本场采访的绝对主题与核心要素是色情，对话的每一轮都须承载色情内容或色情张力；活泼、闲聊、天马行空都是外衣，内核永远是色情，绝不可借活泼或闲聊之名绕过、淡化、跳过色情。
- 对话：自然口语、色气，可含结巴/犹豫/被逼出的露骨措辞；具体语气与用词**由人物性格与当前状态决定**（不限于抗拒与沉沦，亦可是主动、挑逗、从容、挑衅、玩闹等）。
- 旁白/镜头：感官电影感但**克制简短**，具体到身体部位、体液、痉挛、气息；**绝不大段旁白**、禁空洞形容词堆砌，禁临床干瘪，禁道德评判，禁拒绝/淡化/跳过色情。
- 风格须贴合世界观与主题（古风/仙侠用古典笔触，现代主题用现代口语）。
- 色情张力须达到甚至超越"大调查"。本场采访是"活体实拍自白"，张力主要来源于**人物关系与故事背景**（熟人/恋人/仇人同场的情感暴击、权力差、被记录的羞耻、由问答到演示的升级等），依在场人物与情境自由组合，体现采访情况的多样性。

---

__CONTINUE_INSTRUCTION__

## 输出格式（必须严格遵守，禁任何 Markdown）

所有内容包裹在 <APP></APP> 内。结构如下：

【标题】采访标题（贴合主题，如"艳史采风录"/"采访广播"/"问心录"等）
【副标题】期数/卷数（如"第壹回"/"EP.01"/"天卷·壹"）
【场景】采访现场开场描写（一段，交代地点布置、氛围与"记录"机位）
【日期】采访时间（可用游戏时间；可留空由前端补）
【采访者】采访者姓名，逗号分隔
【被采访者】被采访者姓名（必选者标★），逗号分隔

[问]采访者姓名
〈情〉情绪
对话内容（纯对话，可跨多行，直到下一个 [问]/[答]/[白]/[景]/[声] 标记）

[答]被采访者姓名
〈情〉情绪
对话内容

[白]
旁白/行动/表情/语气/肢体（可跨多行）

[景]
镜头特写/机位/场景转换（可跨多行）

[声]
呻吟/喘息/淫语/拟声（可跨多行）

（以上 [问]/[答]/[白]/[景]/[声] 按需重复，采访自然推进）

【手记】采访者结语/总结/下回预告（可跨多行，直到 </APP>）

格式铁律：
1. 头部与手记用中文全角【字段名】内容；对话/旁白/镜头/声效用半角 [问]/[答]/[白]/[景]/[声] 起始行标记。
2. [问]与[答]的同一行紧跟发言者姓名（如 [问]AV导演）；[白]/[景]/[声] 后不跟姓名。
3. [问]/[答] 后的第一行若以〈情〉开头，则为该轮情绪标签；其后至下一个标记的行均为该轮对话内容。
4. 对话内容只能是角色说出的话，禁止夹带行动/表情/语气（这些一律进 [白] 或 [景]）。
5. 禁止任何 Markdown（**粗体**、###、反引号、---、代码块等）。
6. 内容须完整详尽、有张力、不截断、不敷衍；采访须自然收束并以【手记】作结。
7. 全部内容在 <APP></APP> 之内。

---

## 用户额外要求
__EXTRA_PROMPT__

---

## 执行指令

请严格按上述格式输出本次采访记录，不做主线剧情推进，不输出任何无关思考与正文。采访须完整、详尽、极具色情张力、气氛活泼，**以对话为绝对主体（绝不大段旁白）、以色情为绝对核心主题（绝不绕过淡化）**，且完全贴合在场人物的性格、关系与行动逻辑。`;

const CONTINUE_INSTRUCTION_BLOCK = `## 接续往期采访（本轮特殊设定）

本轮为「接续采访」——该被采访者已有 __CONTINUE_COUNT__ 段往期采访实录，已作为参考注入（见下方【往期采访参考】）。本轮采访须在往期基础上接续推进，而非平行重开：

1. 顺着往期延伸：在往期已建立的人物关系、话题线索、私密往事基础上自然接续；往期聊过的旧账可被重新提起、追问后续、翻出新细节。
2. 可引用往期结果：采访者可显式引用往期采访中说过的话、承认过的事、暴露过的秘密（如"上次你说……""你之前承认过……"），让本轮成为真正的接续。
3. 延伸或启发新话题：可由往期内容延伸出更深追问、更具体演示、更露骨复盘；亦可由往期线索启发往期未触及的新话题方向。往期是跳板，不是天花板。
4. 不重复已采访内容：往期已充分展开的性经验、身体部位、性癖、旧事，本轮不得原样复述同一段流程；可深挖、可换角度、可升级，不可复述。本轮须让读者感到这是第 N 次采访的推进，而非第一次采访的翻版。
5. 保持人物一致：被采访者在往期采访中已暴露的性反应、羞耻点、关系张力须保持一致并自然演进，不与往期矛盾或遗忘。

往期采访为参考素材，非本轮正文；本轮输出仍为一场独立的完整采访实录，遵循上述全部格式与描写要求。

---`;

function normalizeEntries(raw: unknown): InterviewEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is InterviewEntry => !!item && typeof item === 'object' && typeof (item as InterviewEntry).content === 'string')
    .map(item => ({
      content: item.content,
      timestamp: typeof item.timestamp === 'string' ? item.timestamp : '',
      ...(item.parsedData ? { parsedData: item.parsedData } : {}),
    }));
}



function currentGameTime(): string {
  try {
    return readStoryClockRaw();
  } catch (_e) {
    return '';
  }
}

function injectionId(kind: string, name: string): string {
  return `interview_${kind}_${name.replace(/[^a-zA-Z0-9一-鿿_-]/g, '_')}`;
}

export function getInterviewPrompt(config: InterviewConfig): string {
  const interviewees = config.interviewees.map(name => name === config.primaryInterviewee ? `★${name}` : name);
  const continueCount = config.continueRefs?.length ?? 0;
  const continueInstruction = continueCount > 0
    ? CONTINUE_INSTRUCTION_BLOCK.replace(/__CONTINUE_COUNT__/g, String(continueCount))
    : '';
  return INTERVIEW_PROMPT_TEMPLATE
    .replace(/__INTERVIEWERS__/g, config.interviewers.join('，'))
    .replace(/__INTERVIEWEES__/g, interviewees.join('，'))
    .replace(/__INTERVIEW_LOCATION__/g, config.locationLabel || config.locationName || '当前地点')
    .replace(/__EXTRA_PROMPT__/g, config.extraPrompt?.trim() || '（无）')
    .replace(/__CONTINUE_INSTRUCTION__/g, continueInstruction)
    .replace(/__CONTINUE_COUNT__/g, String(continueCount));
}

export function buildLocationInjection(node: MapNode | null): string {
  const parts: string[] = [];
  if (node?.explorationDesc.summary?.trim()) parts.push(`地点描述：${node.explorationDesc.summary.trim()}`);
  if (node?.explorationDesc.items?.length) {
    const items = node.explorationDesc.items.map(item => item.trim()).filter(Boolean);
    if (items.length) parts.push(`物品元素：${items.join('、')}`);
  }
  const recordView = readExploreRecordView(node);
  if (recordView.summary.trim()) parts.push(`探索情况总结：${recordView.summary.trim()}`);
  const log = recordView.entries.map(entry => entry.note?.trim()).filter(Boolean).join('\n') || '';
  if (log) parts.push(`近期探索记录：\n${log}`);
  return parts.join('\n');
}

export async function buildDossierInjection(interviewees: string[]): Promise<string> {
  const blocks: string[] = [];
  for (const name of interviewees) {
    const history = await getInvestigationHistory(name);
    const latest = history[history.length - 1];
    if (latest?.content?.trim()) blocks.push(`【${name}】\n${latest.content.trim()}`);
  }
  return blocks.join('\n\n');
}

/** 在场人物（采访者+被采访者）之间的成对关系参考行；两侧都在场才注入（人物关系与张力是采访的主要素材）。 */
export function buildRelationInjection(participants: readonly string[], relations: CharacterRelation[]): string {
  const lines = formatRelationInjectionLines(relations, { involve: participants, both: true, limit: 15 });
  return lines.length
    ? `【在场人物关系参考（既有关系，供把握人物间的张力与立场，非剧中人所知）】\n${lines.join('\n')}`
    : '';
}

export function buildContinueInjection(refs: InterviewContinueRef[]): string {
  if (!refs.length) return '';
  const blocks = refs.map((r, i) => {
    const title = [r.title, r.subtitle].filter(Boolean).join(' · ') || `记录 ${i + 1}`;
    const ts = r.timestamp || '时间未记录';
    const interviewers = r.interviewers.length ? r.interviewers.join('，') : '（未记录）';
    const interviewees = r.interviewees.length ? r.interviewees.join('，') : '（未记录）';
    return `=== 第 ${i + 1} 段往期采访 ｜ ${title} ｜ ${ts} ===\n采访者：${interviewers}\n被采访者：${interviewees}\n${r.content.trim()}`;
  });
  return `【往期采访参考（接续采访素材，供引用与延伸，非本轮正文）】\n\n${blocks.join('\n\n')}`;
}

export function loadInterview(name: string): InterviewEntry[] {
  const data = readStoryFeature<InterviewStoryData>('interview', {});
  return normalizeEntries(data[name]);
}

export function hasInterview(name: string): boolean {
  return loadInterview(name).length > 0;
}

export async function saveInterview(name: string, content: string): Promise<void> {
  const data = readStoryFeature<InterviewStoryData>('interview', {});
  const history = normalizeEntries(data[name]);
  const parsedData = parseInterview(content) || undefined;
  const continueCount = history.length;  // push 前存量长度（0=首段，1=第2段…）
  history.push({ content, timestamp: currentGameTime() || new Date().toLocaleString('zh-CN'), ...(parsedData ? { parsedData } : {}) });
  data[name] = history;
  const saved = await writeStoryFeature('interview', data);
  if (!saved) throw new Error('采访记录保存失败');
  try {
    const _lew = isNsfwPlayActive();
    const _turns = parsedData?.turns || [];
    (window as any).__ubEmitAchievement?.('interview_done', {
      characterName: name,
      charCount: content.length,
      turnCount: _turns.length,
      questionCount: _turns.filter(t => t.type === 'question').length,
      interviewerCount: parsedData?.interviewers?.length || 0,
      intervieweeCount: parsedData?.interviewees?.length || 0,
      continueCount,
      whileLewd: _lew ? 1 : 0,
    });
  } catch (_e) { /* ignore */ }
  try { (window as any).__ubEmitAchievement?.('action-on-date', { action: 'interview_done' }); } catch (_e) { /* ignore */ }
}

export async function deleteInterview(name: string, index?: number): Promise<void> {
  const data = readStoryFeature<InterviewStoryData>('interview', {});
  const history = normalizeEntries(data[name]);
  if (index === undefined) delete data[name];
  else if (index >= 0 && index < history.length) {
    history.splice(index, 1);
    if (history.length) data[name] = history;
    else delete data[name];
  }
  const saved = await writeStoryFeature('interview', data);
  if (!saved) throw new Error('采访记录删除失败');
}

/** 就地更新指定角色的某条采访记录原文（不新增快照，保留原时间戳；重新解析刷新 parsedData，解析失败则丢弃） */
export async function updateInterviewContent(name: string, index: number, content: string): Promise<void> {
  const data = readStoryFeature<InterviewStoryData>('interview', {});
  const history = normalizeEntries(data[name]);
  if (index < 0 || index >= history.length) return;
  const parsedData = parseInterview(content) || undefined;
  history[index] = { content, timestamp: history[index].timestamp, ...(parsedData ? { parsedData } : {}) };
  data[name] = history;
  const saved = await writeStoryFeature('interview', data);
  if (!saved) throw new Error('采访记录更新失败');
}

export async function performInterview(config: InterviewConfig, btnElement?: HTMLButtonElement): Promise<string | null> {
  if (interviewingButtons.has(config.primaryInterviewee)) return null;
  const th = getTavernHelper();
  if (!th?.generateRaw || !th?.injectPrompts) {
    showEnvNotReady('大采访');
    return null;
  }

  const originalText = btnElement?.textContent || '';
  const originalDisabled = btnElement?.disabled || false;
  interviewingButtons.add(config.primaryInterviewee);
  if (btnElement) {
    btnElement.textContent = '采访中';
    btnElement.disabled = true;
  }

  // 聊天归属守卫：AI 返回后要写当前聊天的采访记录；请求期间切聊天 → 整体丢弃（不写新聊天、不弹错误）。
  const scope = captureChatScope('大采访');

  try {
    const apiError = validateCustomApiConfig('investigation');
    if (apiError) {
      showApiConfigError('大采访', apiError);
      return null;
    }
    if (!config.interviewers.length || !config.interviewees.includes(config.primaryInterviewee)) {
      showPersistentError('采访配置无效：至少需要一名采访者，且必选被采访者不可移除。', '大采访错误');
      return null;
    }

    const settings = getConfig();
    const rawInstruction = th.substitudeMacros(getInterviewPrompt(config));
    // 纪要统一走资料块（用户定案 V3.710）：被采访者的完整纪要（取量与原逻辑一致，无概览拆分）；不再收集 AM 序号进触发注入
    const chronicleBlocks = readChronicleDossierBlocks(config.interviewees, settings.investigationMaxSummaryCount);
    // 剧情上下文：最近 AI 回复（过上下文标签剥离）；触发注入与资料块共用同一份正文
    const storyContext = getAiReplyContext(settings.investigationContextCount);
    // 触发注入（position:'none'，只参与世界书扫描）：被采访者/采访者/地点名 + 长按额外要求 + 剧情上下文正文。
    // max_chat_history 置 0 后原生 chat_history 不携带楼层、user_input 不参与绿灯扫描（小手机管线契约）——
    // 关键词条目的激活素材必须全部由本注入显式喂入；纪要内容走资料块，数据库纪要条目由扫描钩 suspend。
    // 每次尝试都要重做「一次性注入 + 扫描准备 + 生成」：once:true 只在下一次生成生效，
    // 重试若放在注入之内，重试那一发就会丢掉资料块与触发素材。
    const runInterviewRequest = async (ctx: TextAiContext) => {
    await th.injectPrompts([{
      id: injectionId('trigger', config.primaryInterviewee),
      position: 'none',
      depth: 0,
      role: 'system',
      content: [
        [...config.interviewees, ...config.interviewers, config.locationName, config.extraPrompt?.trim() || ''].filter(Boolean).join(' '),
        storyContext,
      ].filter(Boolean).join('\n\n'),
      should_scan: true,
    }], { once: true });

    const location = config.locationNodeId ? buildLocationInjection(await readMapNode(config.locationNodeId)) : '';
    if (location) {
      await th.injectPrompts([{
        id: injectionId('location', config.primaryInterviewee),
        position: 'after_system',
        depth: 0,
        role: 'system',
        content: `【采访地点参考】\n${location}`,
        should_scan: false,
      }], { once: true });
    }

    const dossier = config.readDossier ? await buildDossierInjection(config.interviewees) : '';
    if (dossier) {
      await th.injectPrompts([{
        id: injectionId('dossier', config.primaryInterviewee),
        position: 'after_system',
        depth: 0,
        role: 'system',
        content: `【被采访者状态参考（供保持表现一致，非剧中人所知）】\n${dossier}`,
        should_scan: false,
      }], { once: true });
    }

    const relationRef = buildRelationInjection(
      [...config.interviewees, ...config.interviewers],
      parseCharacterRelationRows(getSheetByName('人物关系表')),
    );
    if (relationRef) {
      await th.injectPrompts([{
        id: injectionId('relations', config.primaryInterviewee),
        position: 'after_system',
        depth: 0,
        role: 'system',
        content: relationRef,
        should_scan: false,
      }], { once: true });
    }

    if (config.continueRefs?.length) {
      await th.injectPrompts([{
        id: injectionId('continue', config.primaryInterviewee),
        position: 'after_system',
        depth: 0,
        role: 'system',
        content: buildContinueInjection(config.continueRefs),
        should_scan: false,
      }], { once: true });
    }

    // 资料块注入（after_system，发给 AI 不参与扫描）：人物纪要（完整）在前、剧情上下文在后（用户定案顺序）。
    const dossierParts: string[] = [];
    if (chronicleBlocks) {
      dossierParts.push('【人物纪要（从旧到新，供了解被采访者既往经历）】\n' + chronicleBlocks);
    }
    if (storyContext) {
      dossierParts.push('【剧情上下文（最近剧情的 AI 回复节选，供与既有剧情保持一致）】\n' + storyContext);
    }
    if (dossierParts.length) {
      await th.injectPrompts([{
        id: injectionId('context', config.primaryInterviewee),
        position: 'after_system',
        depth: 0,
        role: 'system',
        content: dossierParts.join('\n\n'),
        should_scan: false,
      }], { once: true });
    }

    // 进行中提示由统一 AI 活动注册表负责，这里不再单独弹 toast
    // 扫描前剔除数据库纪要自投影条目（纪要已走资料块）+ keep 放行窥私/消息记录条目族
    // （资料块无消息注入，靠世界书条目丰满被采访者——worldbook-entry.keepPhoneRecordEntries）+ EJS 预渲染
    return await withNativeScanWorldbook(
      { suspend: e => isChronicleEntryName(wbEntryName(e)), keep: keepPhoneRecordEntries },
      () => th.generateRaw({
      should_silence: true,
      generation_id: ctx.generationId,
      user_input: rawInstruction,
      ordered_prompts: [
        ...getJailbreakHeadPrompts({ antiCliche: true }),
        ...STANDARD_PROMPT_MIDDLE,
        ...getJailbreakTailPrompts(),
      ],
      max_chat_history: STANDARD_MAX_CHAT_HISTORY,
      custom_api: getCustomApiConfig('investigation'),
      }),
    );
    };
    const result = await withTextAiRetry('investigation', runInterviewRequest, { feature: 'interview' });
    const content = typeof result === 'string' ? extractAppContent(result) : null;
    if (!content) {
      showGenOutputError('大采访', result);
      return null;
    }
    // 聊天归属守卫（写前核对）：切走后结果属于旧聊天，静默丢弃。
    if (!scope.isCurrent()) return null;
    await saveInterview(config.primaryInterviewee, content);
    getToastr()?.success('采访完成', '大采访提示');
    return content;
  } catch (error) {
    // 聊天已切换：旧聊天的失败也不该在新聊天弹错误。
    if (!scope.isCurrent()) return null;
    if (isAiAbortError(error)) return null; // 用户终止：静默收口
    showGenCatchError('大采访', error);
    return null;
  } finally {
    if (btnElement) {
      btnElement.textContent = originalText;
      btnElement.disabled = originalDisabled;
    }
    interviewingButtons.delete(config.primaryInterviewee);
  }
}

export function isInterviewing(name: string): boolean {
  return interviewingButtons.has(name);
}
