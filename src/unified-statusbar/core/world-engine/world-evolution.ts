// core/world-engine/world-evolution.ts
// 演化指令组装（纯函数）+ 演化编排（doEvolve/parse/apply/chronicle）。I/O 走 configureWorldEvolutionSources 注入点。
import { ubIcon } from '../icons';
import { STANDARD_PROMPT_MIDDLE, STANDARD_MAX_CHAT_HISTORY } from '../ai-request-pipeline';
import { plainClone } from '../deep-clone';
import type {
  WorldState, CharProfile, EvolveKind, EvolveConfig,
  ChronicleEntry, ChronicleDelta, Intrusion, Rumor, WorldPhoneEvent,
} from './world-types';
import {
  CHRONICLE_MAX, DEFAULT_EVOLVE_MIN_REPLY, INTRUSION_ACT_TTL, INTRUSION_QUEUE_MAX, RUMOR_KEEP_MAX, DEFAULT_EVOLVE_EVERY_TURNS, DEFAULT_FOCUS_MAX, DEFAULT_ROTATION_BATCH,
  INTRUSION_FREE_PER_ROUND, INTRUSION_COOLDOWN_ROUNDS, INTRUSION_FREE_PENDING_MAX, ARRIVAL_CONDITION_TTL_ROUNDS, INTRUSION_DESC_MIN,
  WORLD_PHONE_EVENTS_MAX, WORLD_PHONE_MESSAGE_CHARS, WORLD_PHONE_CALL_LINES, WORLD_PHONE_LINE_CHARS, WORLD_PHONE_THOUGHT_CHARS,
  WORLD_SOCIAL_COMMENTS_MAX, WORLD_SOCIAL_LIKES_MAX, WORLD_SOCIAL_TITLE_CHARS, WORLD_SOCIAL_COMMENT_CHARS, WORLD_SOCIAL_IMAGE_CHARS,
} from './world-types';
import { loadWorldState, saveWorldState } from './world-store';
import {
  advanceCharThread, buildFrontDigest, buildKnownSet, charThreadStage, decideEvolve, findSameSourceRumor, gapDaysBetween, isRumorRestatingKnown, rollTwistTag, selectFocusSubset, syncWorldRoster, tickRumor,
  RUMOR_LEVEL_LABEL,
  type KnownSet, type RosterCandidate, type TwistTag,
} from './world-state';
import { enqueueIntrusion, fillIntrusionHook, triggerIntrusion } from './world-intrusion';
import { projectCharacterDynamics, projectWorldDigest } from './world-worldbook';
import { compareDateKey } from '../calendar-core';
import { getTavernHelper, getToastr } from '../env';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from '../jailbreak-config';
import { keepPhoneRecordEntries, wbEntryName, withNativeScanWorldbook } from '../worldbook-entry';
import { isChronicleEntryName } from '../chronicle-blocks';
import { WORLD_WB_NAME, CHARACTER_DYNAMIC_WB_PREFIX } from './world-worldbook';
import { getCustomApiConfig, validateCustomApiConfig, showPersistentError, withTextAiRetry, type TextAiContext } from '../api-config';
import { showGenOutputError } from '../notify-presets';
import { isStoryStorageReady, getCurrentStoryChatKey, isStoryContextKeyValid } from '../story-floor-store';
import { escapeHtml } from '../html-escape';
import { enqueueSystemDecision, invalidateSystemDecisions, SYSTEM_DECISION_PRIORITY, type SystemDecisionEnqueueStatus } from '../system-decision-queue';
import type { SystemDecisionView } from '../../renderers/system-decision-popup';

// 纪要共享层（读取/选取/概览完整分块）迁至 chronicle-blocks.ts（大调查/大采访/小手机共用）；
// 此处 re-export 兼容既有调用点与测试。
export { formatChronicleBlocks, selectChronicleRows, rowsFromChronicleSheet } from '../chronicle-blocks';
export type { ChronicleRow } from '../chronicle-blocks';
export const GREENLIGHT_TERMS_MAX = 25;

/** 字符计数（纯函数）：剥 HTML 标签 + 去全部空白后统计字符数。 */
export function countReplyChars(text: string): number {
  return String(text || '').replace(/<\/?[^>]+>/g, '').replace(/\s+/g, '').length;
}

/** 自动更新字数闸：最新 AI 回复字符数低于阈值 → 跳过本次自动演化。纯函数；手动演化不受限。 */
export function isReplyBelowMin(replyText: string, min?: number): boolean {
  const threshold = Number(min) > 0 ? Math.floor(Number(min)) : DEFAULT_EVOLVE_MIN_REPLY;
  return countReplyChars(replyText) < threshold;
}

/** 从聊天数组尾部向前取最后一条 AI 回复文本（跳 is_user / is_system / 空白）。返回 '' 表示无。 */
export function lastAiReplyText(chat: any[]): string {
  if (!Array.isArray(chat)) return '';
  for (let i = chat.length - 1; i >= 0; i--) {
    const msg = chat[i];
    if (!msg || msg.is_user || msg.is_system) continue;
    if (typeof msg.mes === 'string' && msg.mes.trim()) return msg.mes;
  }
  return '';
}

export interface EvolutionSources {
  chronicleBlocks: string;
  recentChat: string;
  /** 焦点人物之间的成对关系行（人物关系表紧凑行，world-sources 组装）；缺省/空不注入。 */
  relations?: string[];
}

export interface ParsedWorldDelta {
  profiles?: Record<string, Partial<CharProfile>>;
  /** 流言增量：id 有则更新（主题固定/内容渐进重写）；新 id 同源则合并；无 id 新创建。
   *  progressDelta=本阶段发展度增量、dissipationDelta=消散度减量（台前必填，幕后可选，均 0-100 整数）。 */
  rumors?: Array<{ id?: string; topic: string; content: string; progressDelta?: number; dissipationDelta?: number }>;
  threads?: Array<{ name: string; goal?: string; stageDesc?: string; abandon?: boolean }>;
  intrusions?: Array<{ kind: Intrusion['kind']; refId: string; title: string; hook?: string; desc?: string; aiTriggered?: boolean }>;
  /** WS8：世界掠影（60-100 字，仅展示不进注入世界书；写进纪事摘要主文）。 */
  vignette?: string;
  /** 小手机联动：焦点角色主动联系事件（<phone> 块；落盘后经宿主桥推入瑟瑟小手机）。 */
  phoneEvents?: WorldPhoneEvent[];
}

/** 线程推进计划（doEvolve 算，引擎掷波折；注入提示词 + 应用回 state）。 */
export interface ThreadPlan {
  name: string;
  goal: string;
  progress: number;
  nextProgress: number;
  tw: TwistTag;
  stage: string;
}

/** 世界书结构段剔除纪要前缀条目（与专属纪要段重复）。 */
export function filterManagedChronicleEntries(
  entries: Array<{ comment: string; content: string }>,
): Array<{ comment: string; content: string }> {
  return entries.filter(e => !isChronicleEntryName(e.comment));
}

/** 绿灯匹配词表 = 焦点角色名（有界，非全部追踪名）。v1.1：总量封顶 25。 */
export function buildGreenlightTerms(focus: CharProfile[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (name: string) => {
    if (!name || seen.has(name) || out.length >= GREENLIGHT_TERMS_MAX) return;
    seen.add(name);
    out.push(name);
  };
  for (const p of focus) push(p.name);
  return out;
}

/** 演化风格方向 prompt 注入块：按配置织入对世界演化方向的额外要求；general 返回 ''（不加要求）。 */
export function buildStyleDirectionRule(style?: string, custom?: string): string {
  const s = style || '';
  const customText = String(custom || '').trim();
  if (s === 'sweet') {
    return '演化风格方向（甜蜜恋爱）：本轮幕后世界的演化与动向，整体氛围向「甜蜜恋爱」倾斜——多酝酿心动、暧昧、思念、为彼此准备用心的小事、久别重逢与温柔以待；恋爱情节是主线的重要养分，不得削弱主角与各角色的情感联结。';
  }
  if (s === 'intrigue') {
    return '演化风格方向（权谋宫斗）：本轮幕后世界的演化与动向，整体向「权谋宫斗」倾斜——多酝酿势力博弈、人心算计、暗流涌动、拉拢背刺、家族或朝堂的明暗交锋；关系推进与事件发展带权谋张力，各角色的行动多出于立场与利益考量。';
  }
  if (s === 'surprise') {
    return '演化风格方向（出其不意）：本轮幕后世界的演化与动向，尽量「出其不意」——多给反套路、出人意料的反转与惊喜，但须自洽、不违背既有设定与前情；让主角与玩家的预期落空又合理（例如：看似危险的来意其实是善意、看似小事的筹备藏着大心意、看似安稳的日常突然转弯）。';
  }
  if (s === 'custom') {
    if (customText) {
      return `演化风格方向（用户自定义要求）：请严格按下述用户要求的方向演化幕后世界——\n${customText}`;
    }
    return '';
  }
  return ''; // general 及其他：不加额外要求
}

/** 小手机联动规则文案（按小手机当前聊天风格换装；协议行结构不变，四平台全风格产出——docs/15 §5）。 */
const PHONE_LINK_RULES: Record<string, string> = {
  '': '小手机联动（主角手机）：本轮至少产出 1 份、至多 3 份「小手机内容」，从下列两类中按剧情合理性自然选择（可混搭），禁止全部缺席：① 相熟角色主动联系主角——发微信消息或打电话（每轮最多 1 位角色、最多 1 次联系；消息像真人发的微信，短句、符合角色语言风格，可拆 2-3 条连发；电话给 2-4 句接通后的口语开场白）；已在 <intrusions> 安排入镜的角色本轮不要再主动联系。② 角色或路人在社交媒体发帖——朋友圈（熟人半公开的日常闲话）、贴吧（在某个兴趣吧发帖盖楼讨论）、微博（公开发言、吃瓜、蹭话题热议）、小红书（标题党式的种草/记录笔记）；帖子内容取材于焦点角色的动向/暗中打算/传闻/世界变化（如传闻在贴吧发酵、动向以朋友圈流露、路人微博议论世界事件）；发帖人=焦点角色或贴合世界观的普通路人（路人帖适合承载传闻与市井氛围），每份帖子必须自带 2-6 条评论（评论者=焦点角色或路人，可楼中楼回复），朋友圈可另给 0-4 个点赞人名；帖子正文≥30字、评论≥10字；可选给一个图片画面描述（无图也可）。严禁以主角本人的身份发帖、评论或点赞；消息与来电只允许焦点角色发起。社媒允许贴合世界观的普通路人出镜，但发帖人/评论者/点赞者中凡是有名有姓的角色，一律只能是本轮焦点角色。',
  xianxia: '小手机联动（主角传讯玉简）：本轮至少产出 1 份、至多 3 份「传讯玉简内容」，从下列两类中按剧情合理性自然选择（可混搭），禁止全部缺席：① 相熟角色主动联系主角——传符讯或神识传音（每轮最多 1 位角色、最多 1 次联系；符讯像真人刻下的短句、符合角色语言风格，可拆 2-3 条连发；传音给 2-4 句接通后的口语开场白）；已在 <intrusions> 安排入镜的角色本轮不要再主动联系。② 角色或路人在社媒发帖——百晓阁（天下风闻汇聚的公开阁榜，公开发言、吃瓜、蹭风闻榜热议）、论道坛（在某个坛里灌水盖楼论道）、云笈录（标题党式的好物/攻略分享，录成一笈）、浮生帖（道友间半公开的近况闲话）；帖子内容取材于焦点角色的动向/暗中打算/传闻/世界变化（如传闻在风闻榜发酵、动向以浮生帖流露、论道坛议论世界事件）；发帖人=焦点角色或贴合世界观的普通路人（路人帖适合承载传闻与市井氛围），每份帖子必须自带 2-6 条回应（回应者=焦点角色或路人，可楼中楼回复），浮生帖可另给 0-4 个道好人名；帖子正文≥30字、回应≥10字；可选给一个留影画面描述（无图也可）。严禁以主角本人的身份发帖、回应或道好；符讯与传音只允许焦点角色发起。百晓阁/论道坛/云笈录允许贴合世界观的普通路人出镜，但发帖人/回应者中凡是有名有姓的角色，一律只能是本轮焦点角色。',
  wuxia: '小手机联动（主角天机匣）：本轮至少产出 1 份、至多 3 份「天机匣内容」，从下列两类中按剧情合理性自然选择（可混搭），禁止全部缺席：① 相熟角色主动联系主角——递飞鸽书信或千里传声（每轮最多 1 位角色、最多 1 次联系；书信像真人手写的短笺、符合角色语言风格，可拆 2-3 条连发；传声给 2-4 句接通后的口语开场白）；已在 <intrusions> 安排入镜的角色本轮不要再主动联系。② 角色或路人在社媒发帖——悦来茶馆（江湖风声汇聚的百年茶楼，公开发言、吃瓜、蹭今日书目热议）、英雄楼（在某个堂里灌水盖楼议江湖）、风物志（标题党式的风物/行旅分享，录成一篇图志）、故人笺（故人间半公开的近况闲话）；帖子内容取材于焦点角色的动向/暗中打算/传闻/世界变化（如传闻上了今日书目、动向以故人笺流露、英雄楼议论世界事件）；发帖人=焦点角色或贴合世界观的普通路人（路人帖适合承载传闻与市井氛围），每份帖子必须自带 2-6 条回应（回应者=焦点角色或路人，可楼中楼回复），故人笺可另给 0-4 个称善人名；帖子正文≥30字、回应≥10字；可选给一个写真画面描述（无图也可）。严禁以主角本人的身份发帖、回应或称善；书信与传声只允许焦点角色发起。悦来茶馆/英雄楼/风物志允许贴合世界观的普通路人出镜，但发帖人/回应者中凡是有名有姓的角色，一律只能是本轮焦点角色。',
  fantasy: '小手机联动（主角传讯水晶）：本轮至少产出 1 份、至多 3 份「传讯水晶内容」，从下列两类中按剧情合理性自然选择（可混搭），禁止全部缺席：① 相熟角色主动联系主角——发晶讯或施展远语（每轮最多 1 位角色、最多 1 次联系；晶讯像真人落笔的短句、符合角色语言风格，可拆 2-3 条连发；远语给 2-4 句接通后的口语开场白）；已在 <intrusions> 安排入镜的角色本轮不要再主动联系。② 角色或路人在社媒发帖——吟游诗社（歌谣与见闻汇聚的行吟者集社，公开发言、吃瓜、蹭传唱榜热议）、行会大厅（在某个行会里灌水盖楼议事）、藏宝图鉴（标题党式的好物/冒险攻略分享，录成一篇图鉴）、篝火手记（同伴间半公开的近况闲话）；帖子内容取材于焦点角色的动向/暗中打算/传闻/世界变化（如传闻上了传唱榜、动向以篝火手记流露、行会大厅议论世界事件）；发帖人=焦点角色或贴合世界观的普通路人（路人帖适合承载传闻与市井氛围），每份帖子必须自带 2-6 条回应（回应者=焦点角色或路人，可楼中楼回复），篝火手记可另给 0-4 个喝彩人名；帖子正文≥30字、回应≥10字；可选给一个记影画面描述（无图也可）。严禁以主角本人的身份发帖、回应或喝彩；晶讯与远语只允许焦点角色发起。吟游诗社/行会大厅/藏宝图鉴允许贴合世界观的普通路人出镜，但发帖人/回应者中凡是有名有姓的角色，一律只能是本轮焦点角色。',
};

/** <phone> 块输出格式说明（按风格换装；行协议与字段枚举跨风格不变）。 */
const PHONE_LINK_FORMAT: Record<string, string> = {
  '': '主动联系与社媒内容都输出在 <phone> 块内（<world> 标签内）：微信消息每行「message|角色名|内容」（同一角色连续多行=连发多条）；来电先一行「call|角色名|TA此刻内心想法」，随后每行「call_line|接通后的一句开场白」（2-4 行）；社媒帖第一行「post|平台|作者|标题|正文|图片描述|吧名」（平台=moments 朋友圈/tieba 贴吧/weibo 微博/xhs 小红书；贴吧、小红书标题必填，朋友圈、微博标题留空；图片描述可空；吧名仅贴吧必填，如「临江大学吧」），随后每行「comment|评论者|评论内容」（2-6 条，楼中楼回复写「comment|评论者|评论内容|被回复者」），朋友圈可另加「like|点赞者」（0-4 行）。字段内不要使用竖线 |；没有对应内容就不要输出对应行。',
  xianxia: '主动联系与社媒内容都输出在 <phone> 块内（<world> 标签内）：符讯每行「message|角色名|内容」（同一角色连续多行=连发多条）；传音先一行「call|角色名|TA此刻内心想法」，随后每行「call_line|接通后的一句开场白」（2-4 行）；社媒帖第一行「post|平台|作者|标题|正文|图片描述|吧名」（平台=weibo 百晓阁/tieba 论道坛/xhs 云笈录/moments 浮生帖；坛帖与云笈标题必填，风闻、近况标题留空；图片描述可空；吧名仅坛帖必填，如「问道坛」），随后每行「comment|回应者|回应内容」（2-6 条，楼中楼回复写「comment|回应者|回应内容|被回复者」），浮生帖可另加「like|道好者」（0-4 行）。字段内不要使用竖线 |；没有对应内容就不要输出对应行。',
  wuxia: '主动联系与社媒内容都输出在 <phone> 块内（<world> 标签内）：书信每行「message|角色名|内容」（同一角色连续多行=连发多条）；传声先一行「call|角色名|TA此刻内心想法」，随后每行「call_line|接通后的一句开场白」（2-4 行）；社媒帖第一行「post|平台|作者|标题|正文|图片描述|吧名」（平台=weibo 悦来茶馆/tieba 英雄楼/xhs 风物志/moments 故人笺；楼帖与图志标题必填，风声、笺文标题留空；图片描述可空；吧名仅楼帖必填，如「斗剑堂」），随后每行「comment|回应者|回应内容」（2-6 条，楼中楼回复写「comment|回应者|回应内容|被回复者」），故人笺可另加「like|称善者」（0-4 行）。字段内不要使用竖线 |；没有对应内容就不要输出对应行。',
  fantasy: '主动联系与社媒内容都输出在 <phone> 块内（<world> 标签内）：晶讯每行「message|角色名|内容」（同一角色连续多行=连发多条）；远语先一行「call|角色名|TA此刻内心想法」，随后每行「call_line|接通后的一句开场白」（2-4 行）；社媒帖第一行「post|平台|作者|标题|正文|图片描述|吧名」（平台=weibo 吟游诗社/tieba 行会大厅/xhs 藏宝图鉴/moments 篝火手记；榜文与图鉴标题必填，见闻、手记标题留空；图片描述可空；吧名仅榜文必填，如「药师行会」），随后每行「comment|回应者|回应内容」（2-6 条，楼中楼回复写「comment|回应者|回应内容|被回复者」），篝火手记可另加「like|喝彩者」（0-4 行）。字段内不要使用竖线 |；没有对应内容就不要输出对应行。',
};

/** 三段式（1A 同构）演化请求各段（纯函数组装）。threadPlans=线程推进计划（引擎掷波折，WS4）；known=主角已知集合（Task 3 去重闸第二层提示词）。
 *  段落分工：task 接破限后作结构头；worldbook 条目由原生 world_info 槽位承载（触发注入见 trigger）；dossier=资料块（纪要/世界状态/近期剧情）；
 *  userInput=规则与格式约束。I/O 组装见 doEvolve 的 injectPrompts + ordered_prompts。 */
export interface EvolutionPromptParts {
  task: string;
  dossier: string;
  userInput: string;
  /** 仅用于绿灯扫描的触发文本（position:'none'，不发给 AI）：焦点角色名（纪要走资料块，不再注入 AM 序号）。 */
  trigger: string;
}

export function buildEvolutionInstructionParts(
  kind: EvolveKind,
  state: WorldState,
  focus: CharProfile[],
  cfg: EvolveConfig,
  round: number,
  dateKey: string,
  timeGap: string,
  src: EvolutionSources,
  threadPlans: ThreadPlan[] = [],
  known?: KnownSet,
): EvolutionPromptParts {

  const focusBlock = focus.length
    ? focus.map(p => {
        // WS4 5.5：带线程角色展示「进度%」（不喂阶段词，防 AI 回显进 <thread> 输出）；WS9：进展文字说明
        const threadPart = p.hiddenGoal
          ? typeof p.goalProgress === 'number' && Number(p.goalProgress) < 100
            ? `；暗中打算（进度 ${Math.round(Number(p.goalProgress))}%）：${p.hiddenGoal}${p.goalProgressText ? `——${p.goalProgressText}` : ''}`
            : `；暗中打算「${p.hiddenGoal}」`
          : '';
        return [
          `- ${p.name}：动向「${p.activity || '如常'}」；打算「${p.plans || '无'}」` +
            threadPart +
            (p.relation ? `；与主角关系「${p.relation}」` : ''),
        ].join('');
      }).join('\n')
    : '（本轮无焦点角色，全部生活如常）';

  const rumorsBlock = state.rumors.length
    ? state.rumors.slice(0, 20) // v1.1：请求内只带最新 20 条传闻
      .map(r => `- ${r.id} ${r.topic}（${r.level === 'vague' ? '幕后' : '台前'}·发展度 ${r.progress ?? 1}/100${r.level !== 'vague' ? `·消散度 ${r.dissipation ?? 100}/100` : ''}）：${r.content}`).join('\n')
    : '（暂无传闻）';

  const rulesBlock = kind === 'big'
    ? '本轮为大演化（游戏内日期已推进）：焦点角色动向大更新；传闻明显新增/消散。'
    : `本轮为小演化（轮数推进）：小幅更新焦点角色动向（参考时间差「${timeGap}」调整变动幅度）；可新增/消散传闻。`;

  const rulesParts: string[] = [rulesBlock];
  rulesParts.push('本轮只演化离场/幕后角色；已在「在场角色表」的角色不演化，其动向由主线剧情推进，不要为它们产出动向/打算/暗中打算。');
  rulesParts.push('角色动向更新（<profiles> 与 <thread>）只针对本轮「焦点角色」清单内的角色：不要为焦点之外的其他角色产出动向/打算/暗中打算。');
  rulesParts.push('入镜事件不由本轮类型强制决定：请根据「当前世界状态」里的角色动向，自行判断是否有不在场角色应当在近期入镜（有理由接近主角，非凭空出现）；若有则生成入镜事件。');
  // 流言「传播线」规则：主题固定 + 内容渐进重写 + 发展度/消散度增量 + 同源不新建
  rulesParts.push('传闻 = 主角尚未直接目睹/亲历的外围信息，或大众对已知事件的「新反应/歪曲/余波」，必须有新的信息增量；禁止原样复述主角已知事实（对照「当前世界状态」的「主角已知集合」）。');
  rulesParts.push('世界级事件与秘密的蛛丝马迹（战争酝酿、势力变动、诅咒、阴谋等）同样以传闻形式承载——传闻不限于市井八卦，也包括尚未公开的暗流在台前的蛛丝马迹与大众议论；涉及具体角色的秘密行动则作为该角色的暗中打算线程承载。');
  rulesParts.push('每个流言的主题固定不变：更新已有流言时沿用其 id 与原主题，只在原有内容基础上渐进重写（保留已确立的信息，补充本轮新增的细节/议论/反转），禁止丢头重写、禁止仅换说法。');
  rulesParts.push('每轮为已有流言给出发展度增量（0-100 的整数）：增量大小参考距上次演化经过的游戏内时间与这条流言的传播势头；发展度每个阶段从 1 重新走到 100，满 100 晋级下一阶段（幕后→台前→实锤）。新流言默认从幕后开始；若明显值得广泛流传（当街公告、闹市热议），给一个大发展度增量让它尽快传开。');
  rulesParts.push('台前（heard/known）流言每轮必须给出消散度减量（0-100 的整数），反映热度消退速度；幕后（vague）流言若想让它悄然沉寂也可以给出消散值。流言进台前那一刻消散度重置为 100，此后连续衰减、不随阶段变化刷新；消散归 0 即消亡。');
  rulesParts.push('新流言若与某条已有流言是同一件事/同一群人/同一地的后续（同主题同事件），必须作为那条已有流言的延续（沿用其 id 输出），不得新建第二条；只有全新的事件/对象才创建新流言。');
  rulesParts.push('传闻必须与主角本人无关：禁止描写主角本人行动、去向或主角直接参与的事件（如「主角去了哪里/主角在做什么/主角身边发生了什么」）；只写其他角色的互动、市井传言、世界变化与事件。主角相关事件由主线剧情呈现，写进传闻即失去意义。');
  rulesParts.push('传闻的主题与内容一律不得携带具体时间期限（禁止写"本周五""三天后""X月X日""月底"这类具体日期/星期/天数/时刻）——传闻的传开与消散由发展度/消散度数值驱动，内容钉死截止日，游戏时间越过期限后它会与发展进度自相矛盾。只写当前流传的状态与余波（"这几日街头都在传""据说筹备已久"），时限类信息留给主线剧情。');
  // WS4 5.3/5.5：线程推进强制指示（引擎掷波折；完成必须产出入镜事件）
  for (const t of threadPlans) {
    if (t.nextProgress >= 100) {
      rulesParts.push(`「${t.name}」的暗中打算进度已走满（完成），本轮必须为其产出 character_arrival 入镜事件：标题+钩子+事件描述（事件描述=这次打算的完整前因后果：为什么做、怎么做、最终结果、为何此刻来见主角，40-120字、禁明确时间期限；钩子=完成时刻的动作，如「打电话给主角，礼物准备好了想见你」）。三项必须齐全，缺任何一项该事件都会被拦截，计划会保留到下次演化再触发。`);
    } else {
      rulesParts.push(`「${t.name}」的暗中打算本轮波折标记：${t.tw}。文案必须体现这一波折（措辞/情节随进度与本次波折动态变化），不得写成与上一轮相同的进度描述。`);
    }
  }
  if (threadPlans.length) {
    rulesParts.push('焦点角色的暗中打算是持久目标：除非完成/放弃，不得改写成别的目标；文案只能围绕它当前阶段的推进来深化。');
  }
  rulesParts.push('若焦点角色中有适合建立个人目标者（筹备惊喜/攒钱/修炼/经营生计/暗中调查/秘密谋划等），为其中 1-2 个目前没有暗中打算的角色建立暗中打算线程——即使焦点中已有带暗中打算的角色，也优先为无线程者新建；已有线程的角色本轮只深化推进，不改写目标。无合适角色可少建或不建。');
  rulesParts.push('暗中打算的目标、进展文案、完成收尾文案与事件描述一律不得携带具体时间期限（禁止具体日期/星期/天数/时刻，如"下周五""三天后"）——暗中打算由演化轮次驱动推进，钉死截止日游戏时间一过设定即作废。用无时限的相对表达（"等筹备妥当""眼前正紧""还差一点"）或数量进度（"已攒六十两，还差四十两"），时间感交给阶段（筹备/推进/收尾）。');
  rulesParts.push('一次性的事件约定/活动邀约（如「下周五之约」「放学后见面」）不是暗中打算线程——暗中打算是持续推进的个人目标（筹备惊喜/攒钱/修炼/谋划等）。主角已知的一次性约定走主线或传闻承载，不要为它建立线程。');
  // WS8 11.1：vignette 世界掠影指示（仅展示不进注入世界书）
  rulesParts.push('额外：在 <world> 块内输出一个 <vignette>…</vignette> 块（60-100 字世界掠影，用台前可感知的角度描述「这一轮世界怎么动了」：风向、市井痕迹、某处传来的说辞、远方的一封信…；禁止提及主角本人，禁止剧透未过认知边界的信息——未入镜角色的暗中打算；没有实质变化可不输出）。<vignette> 必须在 <world> 标签内。');
  rulesParts.push('世界掠影同样不得携带具体时间期限，用相对阶段推进（"酝酿已久""日渐逼近""就要浮出水面"）。');
  // 演化风格方向（v3）：对世界演化方向的额外要求（general 返回 '' 不注入）
  const styleRule = buildStyleDirectionRule(cfg.worldEvolveStyle, cfg.worldEvolveStyleCustom);
  if (styleRule) rulesParts.push(styleRule);
  // 小手机联动：主动联系（消息/来电）+ 社媒内容产出（朋友圈/贴吧/微博/小红书），<phone> 块承载；
  // 皮肤风格（小手机 __ubp_phone_style 桥探测）：术语与平台限定换装，隐藏 App 不产帖省 token（docs/11 §7.4、docs/12 §6）
  if (cfg.worldPhoneLink) {
    const phoneStyle = findHostPhoneStyle();
    rulesParts.push(PHONE_LINK_RULES[phoneStyle] || PHONE_LINK_RULES['']);
  }
  // WS8 11.2：文案质量引导段（Stitches 提炼）
  rulesParts.push('文案质量（角色动向/打算/暗中打算/传闻均适用）：\n'
    + '- 反标签与流水账：从角色的生活细节出发，具体到「因为什么、在哪儿、正在做什么」；空洞套话（"处理事务/一切如常/有条不紊"）不算内容，宁缺毋滥。\n'
    + '- 情绪与动机平实：后台变化不必都是戏剧性大事件，日常的小谋划同样有分量（攒钱买礼物、准备一顿饭、打点店面）；变化要有动机来源（个人线/身份习惯/近期事件），不许凭空调头到全新方向。\n'
    + '- 反阴谋倾向：幕后不限于阴谋与谋划，大部分角色的日常是普通生活与个人目标（养家/修炼/筹备惊喜/经营生计）；除非角色设定或前情表明其工于心计，否则不要默认角色在暗中算计。\n'
    + '- 生活感：幕后行动要有空间与时间观感，像「铁匠有自己开了十几年的店、会抱怨铁价、会提及街坊」。');

  // Task 3（WS2）：主角已知集合（去重闸第二层提示词对照表）
  const knownBlock = known && known.entities.size
    ? [...known.entities].map(e => `- ${e}：${known.facts[e] || '（主角已知其存在）'}`).join('\n')
    : '（暂无）';

  // 焦点人物之间的既有关系（人物关系表）：动向/打算/暗中打算须与关系现状自洽
  const relationBlock = src.relations?.length
    ? `【人物关系】（焦点人物之间的既有关系，演化须与之自洽）\n${src.relations.join('\n')}`
    : '';

  const task = '## 角色与任务\n你是世界演化引擎。以下世界书条目是世界观设定，当前世界状态与最近剧情是演化素材：请据此推进幕后世界。只输出结构化内容，不写闲话。';

  const dossier = [
    `## 最新纪要\n${src.chronicleBlocks}`,
    '## 当前世界状态\n'
      + `【焦点角色】\n${focusBlock}`
      + (relationBlock ? `\n\n${relationBlock}` : '')
      + `\n\n【传闻】\n${rumorsBlock}`
      + `\n\n【台前摘要（主角已知）】\n${state.frontDigest || '（暂无）'}`
      + `\n\n【主角已知集合】（创建新传闻时对照，禁止复述其中事实）\n${knownBlock}`,
    `## 近期剧情上下文\n${src.recentChat || '（暂无）'}`,
  ].join('\n\n');

  // 绿灯触发文本（position:'none'，不发给 AI，也不进提示词）：焦点角色名。
  // 纪要统一走资料块（概览→完整→近期剧情，用户定案 V3.710）——纪要条目已被本请求 suspend，
  // 注入 AM 序号也激活不了任何东西；user_input 与资料块均不参与绿灯扫描，触发素材全部由本注入喂入。
  const trigger = focus.map(p => p.name).filter(Boolean).join('\n');

  const userInput = [
    '## 演化规则',
    ...rulesParts,

    '## 输出格式',
    '输出一个 <world> 结构化块，按字段分派：<profiles>（焦点角色更新）、<rumors>、<thread>（暗中打算线程）、<intrusions>（入镜事件）、<vignette>（世界掠影，见演化规则）。只输出有变化的字段。所有标签（含 <vignette>）都在 <world> 内。',
    ...(cfg.worldPhoneLink
      ? [PHONE_LINK_FORMAT[findHostPhoneStyle()] || PHONE_LINK_FORMAT['']]
      : []),
      '字段格式（每行一条，字段内不要使用竖线 |）：<profiles> 每行「角色名|动向|打算（可留空）|入镜条件（可留空）」；<rumors> 每行「id|主题|内容|发展度增量0-100|消散度减量0-100」（创建新流言用新 id+主题；更新已有流言沿用其 id 与主题、内容渐进重写，消散度台前必填、幕后可选）；<thread> 每行「角色名|暗中打算|阶段描述|放弃(true/false)」（<thread> 与 <profiles> 的暗中打算二选一即可，<thread> 优先）；<intrusions> 每行「character_arrival|角色名|标题|钩子|事件描述|aiTriggered(可选)」（事件描述=完整前因后果40-120字，禁明确时间期限；钩子=玩家放入聊天框的动作一句话）。',
      '<profiles> 的「打算」= 该角色近期的个人盘算（公开/半公开性质，与暗中打算区分）；「入镜条件」= 该角色会主动来找主角的**前置状态**（如「伤势痊愈」「攒够钱」「风波平息」），与角色现状自洽、禁具体时间期限。留空 = 不更新该字段，写「无」= 清除该字段。',
      '<thread> 的阶段描述 = 进展文字说明：体现目标推进的具体情况（数量/相对进度，如「已经攒了 60 两银子，还差 40 两」；禁止具体时间期限），与动向（公开活动）区分。',
      '<thread> 每行恰好 4 个竖线字段，最后一位「放弃」= true 表示你判定这条暗中打算已提前做成、或已失去完成意义（过期/无必要），引擎会直接删掉它、不再推进；false = 线程继续推进。入镜事件由「进度走满」或该角色的 arrivalCondition 驱动，不要在「放弃」栏承担入镜职责。',
      '主动入镜必须判断当前正文发展是否合适：只有在【近期剧情上下文】表明此刻合适（主角得空、场景能接上、氛围不冲突）时才产出 character_arrival；事件描述必须写明这次入镜接续了哪一段剧情、为什么是现在。若近期剧情不合适，宁可不产出，等下一轮。',
      '每一轮最多为一位「非线程完成」的角色产出主动入镜；同一角色两次入镜之间至少间隔若干轮（引擎另有硬性限制，请勿尝试绕过）。线程进度走满的强制入镜不受此限。',
      '字段字数下限（不足需重写，宁缺毋滥）：角色动向≥30字、角色打算≥24字、暗中打算≥24字、传闻内容≥30字。',
      '字段字数上限（超限即精简重写，「越长越好」不是目标，具体与信息密度才是）：动向≤90、打算≤80、暗中打算≤80、传闻≤90。',
      '演化禁句：避免「暗流涌动/筹划已久/密谋/悄然/冥冥中」等堆砌；避免「仿佛/似乎/渐渐/微微」叠用；不用「命运的齿轮/暗涌/山雨欲来」式陈词。',

    `## 演化元信息\n轮次 ${round} · 日期 ${dateKey}${timeGap ? ` · 距上次演化 ${timeGap}` : ''}`,
  ].join('\n\n');

  return { task, dossier, userInput, trigger };
}

function stripBullet(s: string): string {
  return s.replace(/^\s*-\s*/, '').trim();
}

function parsePipeLines<T>(block: string, parse: (parts: string[]) => T | null): T[] {
  const out: T[] = [];
  for (const raw of block.split(/\r?\n/)) {
    const line = stripBullet(raw);
    if (!line) continue;
    const parts = line.split('|').map(p => p.trim());
    const item = parse(parts);
    if (item) out.push(item);
  }
  return out;
}

/** F28：<profiles> 管道段语义——留空 = 不更新该字段（返回 undefined，调用方省略键）；写「无」= 清空（写空串）。 */
function pipeFieldOrClear(part?: string): string | undefined {
  const v = (part || '').trim();
  if (!v) return undefined;
  return v === '无' ? '' : v;
}

/** 社媒平台别名归一（中英文都接受；未知平台丢行；皮肤社媒名容错映射——docs/15：四平台全风格恢复 + 别名 +9）。 */
const PHONE_PLATFORM_ALIASES: Record<string, WorldPhoneEvent['platform']> = {
  moments: 'moments', 朋友圈: 'moments', 浮生帖: 'moments', 故人笺: 'moments', 篝火手记: 'moments',
  tieba: 'tieba', 贴吧: 'tieba', 论道坛: 'tieba', 英雄楼: 'tieba', 行会大厅: 'tieba',
  weibo: 'weibo', 微博: 'weibo', 百晓阁: 'weibo', 悦来茶馆: 'weibo', 茶馆: 'weibo', 吟游诗社: 'weibo', 诗社: 'weibo',
  xhs: 'xhs', 小红书: 'xhs', 云笈录: 'xhs', 风物志: 'xhs', 藏宝图鉴: 'xhs',
};

/** 小手机联动：<phone> 块行解析（纯函数）。message|角色名|内容 / call|角色名|想法 + call_line|台词；
 *  社媒帖 post|平台|作者|标题|正文|图片描述|吧名（后两段可空）+ comment|评论者|内容|被回复者 + like|点赞者。
 *  孤儿 call_line/comment/like 丢弃；无开场白 call 丢弃；tieba 无吧名丢弃；超限截断。 */
export function parsePhoneEventLines(block: string): WorldPhoneEvent[] {
  const out: WorldPhoneEvent[] = [];
  let cur: WorldPhoneEvent | null = null;
  for (const raw of block.split(/\r?\n/)) {
    const line = stripBullet(raw);
    if (!line) continue;
    const sep = line.indexOf('|');
    if (sep < 0) continue;
    const tag = line.slice(0, sep).trim().toLowerCase();
    const rest = line.slice(sep + 1);
    if (tag === 'message') {
      const p = rest.split('|');
      const name = (p[0] || '').trim().slice(0, 60);
      const text = p.slice(1).join('|').trim().slice(0, WORLD_PHONE_MESSAGE_CHARS); // 内容含竖线时拼回
      if (!name || !text) continue;
      cur = null;
      out.push({ kind: 'message', name, text });
    } else if (tag === 'call') {
      const p = rest.split('|');
      const name = (p[0] || '').trim().slice(0, 60);
      if (!name) continue;
      const thought = (p[1] || '').trim().slice(0, WORLD_PHONE_THOUGHT_CHARS);
      cur = { kind: 'call', name, lines: [], ...(thought ? { thought } : {}) };
      out.push(cur);
    } else if (tag === 'call_line') {
      const text = rest.trim().slice(0, WORLD_PHONE_LINE_CHARS);
      if (!text || !cur || cur.kind !== 'call' || cur.lines!.length >= WORLD_PHONE_CALL_LINES) continue;
      cur.lines!.push(text);
    } else if (tag === 'post') {
      const p = rest.split('|');
      const platform = PHONE_PLATFORM_ALIASES[(p[0] || '').trim().toLowerCase()];
      const name = (p[1] || '').trim().slice(0, 60);
      let title = (p[2] || '').trim().slice(0, WORLD_SOCIAL_TITLE_CHARS);
      const text = (p[3] || '').trim().slice(0, WORLD_PHONE_MESSAGE_CHARS);
      const image = (p[4] || '').trim().slice(0, WORLD_SOCIAL_IMAGE_CHARS);
      const bar = (p[5] || '').trim().slice(0, 24);
      if (!platform || !name || !text) continue;
      if (!title && (platform === 'tieba' || platform === 'xhs')) title = text.slice(0, 24); // 标题缺失兜底：取正文开头
      if (platform === 'tieba' && !bar) continue; // 吧名是贴吧数据模型硬必填
      cur = {
        kind: 'social', name, platform, text,
        ...((platform === 'tieba' || platform === 'xhs') && title ? { title } : {}),
        ...(platform === 'tieba' && bar ? { bar } : {}),
        ...(image && image.toLowerCase() !== 'none' ? { image } : {}),
        comments: [],
      };
      out.push(cur);
    } else if (tag === 'comment') {
      const p = rest.split('|');
      const name = (p[0] || '').trim().slice(0, WORLD_SOCIAL_TITLE_CHARS);
      const text = (p[1] || '').trim().slice(0, WORLD_SOCIAL_COMMENT_CHARS);
      const replyTo = (p[2] || '').trim().slice(0, WORLD_SOCIAL_TITLE_CHARS);
      if (!name || !text || !cur || cur.kind !== 'social' || cur.comments!.length >= WORLD_SOCIAL_COMMENTS_MAX) continue;
      cur.comments!.push(replyTo ? { name, text, replyTo } : { name, text });
    } else if (tag === 'like') {
      const name = rest.trim().slice(0, WORLD_SOCIAL_TITLE_CHARS);
      if (!name || !cur || cur.kind !== 'social' || cur.platform !== 'moments') continue;
      if ((cur.likes || (cur.likes = [])).length >= WORLD_SOCIAL_LIKES_MAX) continue;
      cur.likes.push(name);
    }
  }
  return out.filter(e => e.kind === 'message' || e.kind === 'social' || (e.lines && e.lines.length)).slice(0, WORLD_PHONE_EVENTS_MAX);
}

export function parseWorldBlock(raw: string): ParsedWorldDelta | null {
  const match = raw.match(/<world>([\s\S]*?)<\/world>/i);
  if (!match) return null;
  const body = match[1];
  const delta: ParsedWorldDelta = {};

  const profilesMatch = body.match(/<profiles>([\s\S]*?)<\/profiles>/i);
  if (profilesMatch) {
    delta.profiles = {};
    for (const rawLine of profilesMatch[1].split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      // F28：管道式「角色名|动向|打算（可留空）|入镜条件（可留空）」；旧「角色名：动向描述」冒号式仍可解析。
      // 判定=「第一个竖线在第一个冒号之前」——旧式动向里混进竖线也不会被误切（姓名不含冒号/竖线）。
      const firstColon = line.search(/[：:]/);
      const firstPipe = line.indexOf('|');
      if (firstPipe >= 0 && (firstColon < 0 || firstPipe < firstColon)) {
        const parts = line.split('|');
        const name = (parts[0] || '').trim();
        if (!name) continue;
        const upd: Partial<CharProfile> = {};
        const activity = pipeFieldOrClear(parts[1]);
        const plans = pipeFieldOrClear(parts[2]);
        const arrival = pipeFieldOrClear(parts[3]);
        if (activity !== undefined) upd.activity = activity;
        if (plans !== undefined) upd.plans = plans;
        if (arrival !== undefined) upd.arrivalCondition = arrival;
        if (Object.keys(upd).length) delta.profiles[name] = upd; // 全空行=无更新，不写（免白刷 updatedAt）
        continue;
      }
      const mm = /^([^\n：:]+)[：:]\s*(.+)$/.exec(line);
      if (!mm) continue;
      const name = mm[1].trim();
      if (name) delta.profiles[name] = { activity: mm[2].trim() };
    }
  }

  const rumorsMatch = body.match(/<rumors>([\s\S]*?)<\/rumors>/i);
  if (rumorsMatch) {
    delta.rumors = parsePipeLines(rumorsMatch[1], parts => {
      if (parts.length < 2) return null;
      const [id, topic, content, progressRaw, dissipationRaw] = parts;
      if (!topic || !content) return null;
      const parseDelta = (s?: string) => s ? Math.max(0, Math.min(100, parseInt(s, 10) || 0)) : undefined;
      return { id: id || undefined, topic, content, progressDelta: parseDelta(progressRaw), dissipationDelta: parseDelta(dissipationRaw) };
    });
  }

  const intrusionsMatch = body.match(/<intrusions>([\s\S]*?)<\/intrusions>/i);
  if (intrusionsMatch) {
    delta.intrusions = parsePipeLines(intrusionsMatch[1], parts => {
      if (parts.length < 3) return null;
      const [kindRaw, refId, title, hook, desc, aiRaw] = parts;
      if (kindRaw !== 'character_arrival' || !refId || !title) return null;
      return { kind: kindRaw, refId, title, hook: hook || undefined, desc: desc || undefined, aiTriggered: aiRaw === 'false' ? false : true };
    });
  }

  // WS4：暗中打算线程块（优先级高于 <profiles> 的暗中打算段）
  const threadMatch = body.match(/<thread>([\s\S]*?)<\/thread>/i);
  if (threadMatch) {
    delta.threads = parsePipeLines(threadMatch[1], parts => {
      if (parts.length < 2) return null;
      const [name, goal, stageDesc, abandonRaw] = parts;
      if (!name) return null;
      return {
        name: name.trim(),
        goal: (goal || '').trim(),
        stageDesc: (stageDesc || '').trim(),
        abandon: abandonRaw === 'true' || abandonRaw === '是',
      };
    });
  }

  // WS8：世界掠影（非结构化段，空/缺失忽略）。匹配在 raw 上而非 body——AI 常把 <vignette> 放在 </world> 之后，只查 body 会整段丢失（纪事摘要回退差分摘要）。
  const vignetteMatch = raw.match(/<vignette>([\s\S]*?)<\/vignette>/i);
  if (vignetteMatch) {
    const v = vignetteMatch[1].trim();
    if (v) delta.vignette = v;
  }

  // 小手机联动：<phone> 块（同 vignette 在 raw 上匹配，容忍放在 </world> 之后）
  const phoneMatch = raw.match(/<phone>([\s\S]*?)<\/phone>/i);
  if (phoneMatch) {
    const events = parsePhoneEventLines(phoneMatch[1]);
    if (events.length) delta.phoneEvents = events;
  }

  if (!delta.profiles && !delta.rumors && !delta.threads && !delta.intrusions && !delta.vignette && !delta.phoneEvents) return null;
  return delta;
}

function idFor(prefix: string, dateKey: string, n: number): string {
  return `${prefix}_${dateKey || 'undated'}_${n}`;
}

export function applyWorldDelta(
  state: WorldState,
  delta: ParsedWorldDelta,
  ctx: { round: number; dateKey: string; threadAdvances?: Record<string, { nextProgress: number }>; focusNames?: string[] },
): WorldState {
  const next: WorldState = plainClone(state);

  if (delta.profiles) {
    for (const [name, upd] of Object.entries(delta.profiles)) {
      const base = next.profiles[name];
      if (!base) continue; // v1.1：实体协议——AI 只能更新引擎持有的 roster 角色
      if (base.onStage) continue; // 在场角色不演化（他们由主线剧情处理，世界演化只推进幕后/离场角色）
      const allowed: Partial<CharProfile> = {};
      for (const k of ['activity', 'plans', 'hiddenGoal', 'relation', 'arrivalCondition'] as const) {
        const v = upd[k];
        if (typeof v !== 'string') continue;
        if (k === 'hiddenGoal') {
          // WS4 5.2 持久性：已激活线程（goalProgress>0）禁止静默换目标（防链条断裂）
          const g = Number(base.goalProgress) || 0;
          if (g > 0 && v !== base.hiddenGoal) continue;
          allowed[k] = v;
          continue;
        }
        allowed[k] = v;
      }
      next.profiles[name] = { ...base, ...allowed, name, updatedAt: ctx.dateKey, lastEvolveRound: ctx.round };
      // F28：入镜条件写入即刷新计时（AI 允许每轮重写 ⇒ 有效期顺延）；写「无」= 清空条件与计时。
      if (typeof allowed.arrivalCondition === 'string') {
        if (allowed.arrivalCondition.trim()) next.profiles[name].arrivalConditionAt = ctx.round;
        else { delete next.profiles[name].arrivalCondition; delete next.profiles[name].arrivalConditionAt; }
      }
      // 新线程建立（原本无目标 → AI 首给 hiddenGoal）：进度 0 + 清旧完成留痕
      if (!base.hiddenGoal && typeof allowed.hiddenGoal === 'string') {
        next.profiles[name].goalProgress = 0;
        delete next.profiles[name].goalDone;
        delete next.profiles[name].goalProgressText; // 防御：清遗留进展文字
      }
    }
  }

  // WS4：暗中打算线程块（优先级高于 <profiles> 的暗中打算段）
  if (delta.threads) {
    for (const t of delta.threads) {
      const p = next.profiles[t.name];
      if (!p || p.onStage) continue; // 实体协议 + 在场不演化
      if (t.abandon) {
        delete p.hiddenGoal; delete p.goalProgress; delete p.goalProgressText; // 放弃/提前收尾：清线程不留痕
        p.updatedAt = ctx.dateKey;
        continue;
      }
      const g = Number(p.goalProgress) || 0;
      if (g > 0 && t.goal && t.goal !== p.hiddenGoal) continue; // 持久性：已激活不许换目标
      if (!p.hiddenGoal) {
        p.hiddenGoal = t.goal || ''; // 新线程建立
        p.goalProgress = 0;
        delete p.goalDone;
        delete p.goalProgressText;
      } else if (t.goal) {
        p.hiddenGoal = t.goal;
      }
      if (t.stageDesc) p.goalProgressText = t.stageDesc; // AI 按进度写进展文字说明（不再覆盖动向）
      p.updatedAt = ctx.dateKey; // 线程更新也刷新信息时间（时间前缀依赖）
    }
  }

  // WS4 5.3：引擎推进应用（只对仍激活的线程；AI 已完成/放弃的已在上方清除；新建线程本轮不推进）
  if (ctx.threadAdvances) {
    for (const [name, adv] of Object.entries(ctx.threadAdvances)) {
      const p = next.profiles[name];
      if (!p || p.onStage) continue;
      if (!p.hiddenGoal || (Number(p.goalProgress) || 0) >= 100) continue;
      p.goalProgress = Math.min(100, Number(adv.nextProgress) || 0);
    }
  }

  // D2 圈外线程离场补偿：未进焦点的激活线程每次演化固定 +1（掷波折只对焦点线程执行，
  // 圈外线程原被完全冻结）。不刷 updatedAt——该字段语义是「上次被 AI 写过动向/线程的时间」，
  // 供 D3 时间差分档（>1 天翻倍）使用。
  if (ctx.focusNames) {
    const focusSet = new Set(ctx.focusNames);
    for (const p of Object.values(next.profiles)) {
      if (p.onStage || !p.hiddenGoal) continue;
      const g = Number(p.goalProgress) || 0;
      if (g >= 100 || focusSet.has(p.name)) continue;
      p.goalProgress = Math.min(100, g + 1);
    }
  }

  const touched = new Set<string>(); // 本轮被 AI 处理过的流言（不再走引擎默认消散 tick）
  if (delta.rumors) {
    // 流言「传播线」：创建（默认幕后/进度1）+ 已有 id 演进（主题固定/内容渐进重写）+ 同源合并。
    const known = buildKnownSet(next, { dateKey: ctx.dateKey }); // 创建去重闸（复述主角已知事实丢弃）
    let seq = next.rumors.length;
    for (const r of delta.rumors) {
      if (!r.topic || !r.content) continue;
      // ① 已有 id → 演进更新（主题固定：忽略 AI 的主题变更；内容渐进重写）
      let target = r.id ? next.rumors.find(x => x.id === r.id) : undefined;
      // ② 新 id → 同源闸：与全库流言（含同批已创建的）比对，同源合并非新建（不丢内容、不产生重复条目）
      if (!target) { const sameSource = findSameSourceRumor(r, next.rumors); if (sameSource) target = sameSource; }
      if (target) {
        const t = tickRumor(target, { progressDelta: r.progressDelta, dissipationDelta: r.dissipationDelta });
        touched.add(target.id);
        const ti = next.rumors.findIndex(x => x.id === target.id);
        if (t.deleted) { if (ti >= 0) next.rumors.splice(ti, 1); continue; }
        const updated = t.rumor!;
        updated.content = r.content; // 渐进重写；topic 保持原值（tickRumor spread 保留 target.topic）
        if (ti >= 0) next.rumors[ti] = updated;
        continue;
      }
      // ③ 创建去重闸：复述主角已知事实直接丢弃（高门槛：实体名命中 + ≥2 token 事实重叠）
      if (isRumorRestatingKnown(r, known)) continue;
      // ④ 创建新流言（默认幕后 vague / 进度 1；AI 大 progressDelta 可表达热闻→立即上台）
      const created: Rumor = {
        id: r.id || idFor('rumor', ctx.dateKey, ++seq),
        topic: r.topic,
        content: r.content,
        level: 'vague',
        progress: 1,
        createdAt: ctx.dateKey,
      };
      const ct = tickRumor(created, { progressDelta: r.progressDelta }); // 创建只应用发展度增量（消散值不适用于新生流言）
      if (ct.deleted) continue;
      touched.add(created.id);
      next.rumors.unshift(ct.rumor!);
    }
  }
  // 台前流言未被本轮 AI 处理的 → 引擎默认消散兜底（每次演化都执行，防永远不散）；幕后不衰减、发展度仅 AI 驱动
  const kept: Rumor[] = [];
  for (const r of next.rumors) {
    if (touched.has(r.id)) { kept.push(r); continue; }
    const t = tickRumor(r, {});
    if (t.deleted) continue;
    kept.push(t.rumor!);
  }
  next.rumors = kept.slice(0, RUMOR_KEEP_MAX);

  const validArrivals = new Set<string>(); // 本轮合法入队的角色（完成清空唯一依据）
  if (delta.intrusions) {
    // 入镜 id 用单调计数器：从当前队列长度起步逐步递增，队列满（cap 裁剪）也不会重复。
    let intrusionSeq = next.pendingIntrusions.length;
    // F28 配额闸基数：队列中「pending 且走自由通道」的条数（线程完成通道不占额）
    let freeUsed = 0;
    const freePending = next.pendingIntrusions.filter(
      i => i.kind === 'character_arrival' && i.status === 'pending' && i.freeArrival === true,
    ).length;
    for (const it of delta.intrusions) {
      const refId = it.refId.trim();
      const title = it.title.trim();
      if (!refId || !title) continue;
      const profile = next.profiles[refId];
      if (!profile || profile.onStage) continue; // 实体协议 + 在场不演化
      const g = Number(profile.goalProgress) || 0;
      const threadComplete = g >= 100 && !!profile.hiddenGoal; // 线程完成通道（强制入镜）
      // 闸①条件闸：线程完成 或 有 arrivalCondition（自由通道的唯一凭证）
      if (!threadComplete && !(profile.arrivalCondition || '').trim()) continue;
      if (!threadComplete) {
        // 闸②冷却闸：同一角色两次自由入镜之间至少间隔 INTRUSION_COOLDOWN_ROUNDS 轮
        const lastArrival = Number(profile.lastArrivalRound) || 0;
        if (lastArrival > 0 && ctx.round - lastArrival < INTRUSION_COOLDOWN_ROUNDS) continue;
        // 闸③配额闸：每轮自由通道 ≤ INTRUSION_FREE_PER_ROUND；队列 pending 自由入镜 ≤ INTRUSION_FREE_PENDING_MAX
        if (freeUsed >= INTRUSION_FREE_PER_ROUND) continue;
        if (freePending + freeUsed >= INTRUSION_FREE_PENDING_MAX) continue;
      }
      // 闸④内容闸：标题/钩子/事件描述三项全非空 + 描述字数 ≥ INTRUSION_DESC_MIN（与提示词 40-120 字一致）；
      // 拦截语义不变：不清计划，下次演化重触发
      const hook = (it.hook || '').trim();
      const d = (it.desc || '').trim();
      if (!hook || !d) continue;
      if (d.length < INTRUSION_DESC_MIN) continue;
      validArrivals.add(refId);
      intrusionSeq += 1;
      const intrusion: Intrusion = {
        id: idFor('in_character_arrival', ctx.dateKey, intrusionSeq),
        kind: 'character_arrival',
        refId,
        title,
        hook,
        desc: d,
        dateKey: ctx.dateKey,
        status: 'pending',
        aiTriggered: it.aiTriggered !== false,
        ...(threadComplete ? {} : { freeArrival: true }),
      };
      next.pendingIntrusions = enqueueIntrusion(next, intrusion).pendingIntrusions;
      if (!threadComplete) {
        // 闸⑤消费：入队即清条件（根治「条件永久有效 ⇒ 台前长期驻留同一角色」的幽灵待办）；
        // 并记冷却起点。条件允许 AI 每轮重写（写则刷新计时），故消费后仍可重新声明。
        freeUsed += 1;
        delete profile.arrivalCondition;
        delete profile.arrivalConditionAt;
        profile.lastArrivalRound = ctx.round;
      }
    }
  }

  // 完成处理：只有本轮合法 character_arrival 入队才清空计划；被拦截（缺内容/漏写）→ 计划保留，
  // 进度≥100 回退 99（selectFocusSubset 只挑 <100 的线程角色，否则永远卡死无法重触发）。
  for (const p of Object.values(next.profiles)) {
    if (p.onStage) continue;
    if (!p.hiddenGoal) continue;
    const g = Number(p.goalProgress) || 0;
    const isCompleted = g >= 100;
    if (!isCompleted) continue;
    if (validArrivals.has(p.name)) {
      if (!p.goalDone) p.goalDone = ctx.dateKey; // 完成留痕（窗口展示「已完成（dateKey）」）
      delete p.hiddenGoal;
      delete p.goalProgress;
      delete p.goalProgressText;
    } else {
      if (g >= 100) p.goalProgress = 99; // 拦截：回退，保留计划，下次演化再触发
    }
    p.updatedAt = ctx.dateKey;
  }

  // F28：入镜条件过期——写入超过 ARRIVAL_CONDITION_TTL_ROUNDS 轮仍未被消费即清空（防旧条件与新剧情脱节，
  // 需 AI 重新确认）。旧数据无时间戳的条件先补计时（从现在起算，不立即销毁）。
  for (const p of Object.values(next.profiles)) {
    if (!(p.arrivalCondition || '').trim()) continue;
    const at = Number(p.arrivalConditionAt) || 0;
    if (at <= 0) { p.arrivalConditionAt = ctx.round; continue; }
    if (ctx.round - at > ARRIVAL_CONDITION_TTL_ROUNDS) {
      delete p.arrivalCondition;
      delete p.arrivalConditionAt;
    }
  }

  // acted 入镜 TTL 递减：事件已由钩子带进主线，保留两轮演化后自然消散（归 0 删除）。
  // 放在 buildFrontDigest 之前——到期项当轮即从台前摘要消失。
  next.pendingIntrusions = next.pendingIntrusions
    .map(i => i.status === 'acted' ? { ...i, ttl: (Number(i.ttl) || INTRUSION_ACT_TTL) - 1 } : i)
    .filter(i => !(i.status === 'acted' && (Number(i.ttl) || 0) <= 0));

  next.frontDigest = buildFrontDigest(next, ctx.dateKey);
  next.lastEvolveRound = ctx.round;
  next.lastEvolveDateKey = ctx.dateKey;
  if (next.chronicle.length > CHRONICLE_MAX) next.chronicle = next.chronicle.slice(0, CHRONICLE_MAX);
  if (next.pendingIntrusions.length > INTRUSION_QUEUE_MAX) next.pendingIntrusions = next.pendingIntrusions.slice(0, INTRUSION_QUEUE_MAX);
  return next;
}

/** 回廊差分每轮上限：控制纪事体积（CHRONICLE_MAX 条 × 每项上限）。 */
const ARC_PROFILE_MAX = 6;
const ARC_RUMOR_MAX = 6;
const ARC_THREAD_MAX = 4;
const ARC_INTRUSION_MAX = 3;

/**
 * 回廊差分：对 prev→next 本地求差，产出「这一轮到底什么变了」的结构化快照。
 * 纯函数、零 AI 输出（不额外烧 token）——这是回廊能做到零 token 增量的全部原因。
 * 任何字段缺失都安全降级：没有 prev 侧角色则不产动向行，非数值进度则不产线程行。
 */
export function buildChronicleDelta(prev: WorldState, next: WorldState): ChronicleDelta {
  const deltas: ChronicleDelta = {};

  const profiles: NonNullable<ChronicleDelta['profiles']> = [];
  const plans: NonNullable<ChronicleDelta['plans']> = [];
  const threads: NonNullable<ChronicleDelta['threads']> = [];
  for (const [name, np] of Object.entries(next.profiles || {})) {
    const pp = (prev.profiles || {})[name];
    if (!pp) continue; // 本轮新登场的角色：无旧值可比，不进差分（由「入镜」承载）
    const fromAct = String(pp.activity || '如常');
    const toAct = String(np.activity || '如常');
    if (fromAct !== toAct) profiles.push({ name, from: fromAct, to: toAct });
    // 打算变化：判据与 changedProfiles 里的 plans 一项逐字对齐（同取 String 归一，缺省空串）
    const fromPlan = String(pp.plans || '');
    const toPlan = String(np.plans || '');
    if (fromPlan !== toPlan) plans.push({ name, from: fromPlan, to: toPlan });
    if (typeof np.goalProgress === 'number' && typeof pp.goalProgress === 'number'
      && Math.round(np.goalProgress) !== Math.round(pp.goalProgress)) {
      const row: { name: string; from: number; to: number; goal?: string } = {
        name, from: Math.round(pp.goalProgress), to: Math.round(np.goalProgress),
      };
      // 目标全文：只有确实有 hiddenGoal 时才挂这个键（别落一个 goal:undefined 进存档 JSON）
      if (np.hiddenGoal) row.goal = np.hiddenGoal;
      threads.push(row);
    }
  }
  if (profiles.length) deltas.profiles = profiles.slice(0, ARC_PROFILE_MAX);
  if (plans.length) deltas.plans = plans.slice(0, ARC_PROFILE_MAX);
  if (threads.length) deltas.threads = threads.slice(0, ARC_THREAD_MAX);

  const prevRumorById = new Map((prev.rumors || []).map(r => [r.id, r]));
  const rumors: NonNullable<ChronicleDelta['rumors']> = [];
  for (const r of next.rumors || []) {
    const p = prevRumorById.get(r.id);
    const toProgress = Math.round(Number(r.progress) || 0);
    if (!p) { rumors.push({ topic: r.topic, toLevel: r.level, toProgress }); continue; }
    const fromProgress = Math.round(Number(p.progress) || 0);
    if (fromProgress === toProgress && p.level === r.level) continue;
    rumors.push({ topic: r.topic, fromLevel: p.level, toLevel: r.level, fromProgress, toProgress });
  }
  if (rumors.length) deltas.rumors = rumors.slice(0, ARC_RUMOR_MAX);

  const prevIntrusionIds = new Set((prev.pendingIntrusions || []).map(i => i.id));
  const intrusions = (next.pendingIntrusions || [])
    .filter(i => !prevIntrusionIds.has(i.id))
    .map(i => {
      const row: { refId: string; title?: string; hook?: string } = { refId: i.refId };
      // 只有确实有值才挂键，保持旧纪事的字节形态（没有 hook 的入镜行与以前逐字一致）
      if (i.title) row.title = i.title;
      if (i.hook) row.hook = i.hook;
      return row;
    });
  if (intrusions.length) deltas.intrusions = intrusions.slice(0, ARC_INTRUSION_MAX);

  return deltas;
}

export function generateChronicle(
  prev: WorldState,
  next: WorldState,
  kind: EvolveKind,
  dateKey: string,
  vignette?: string,
): ChronicleEntry {
  const changedProfiles = Object.keys(next.profiles).filter(n =>
    prev.profiles[n]?.activity !== next.profiles[n]?.activity ||
    prev.profiles[n]?.plans !== next.profiles[n]?.plans ||
    prev.profiles[n]?.hiddenGoal !== next.profiles[n]?.hiddenGoal ||
    prev.profiles[n]?.goalProgressText !== next.profiles[n]?.goalProgressText);
  const prevRumors = new Set(prev.rumors.map(r => `${r.topic}\u0000${r.content}`));
  const changedRumorRows = next.rumors.filter(r => !prevRumors.has(`${r.topic}\u0000${r.content}`));
  const changedRumors = changedRumorRows.map(r => r.id);
  // 摘要文案用 topic（人话）；changed.rumors 存 id（既有形态，勿改——回廊按当前册反查标题显示）
  const changedRumorTopics = changedRumorRows.map(r => r.topic);
  // 传闻等级跃迁（幕后→台前=传开，台前→实锤）：纪事摘要人性化标注（有 vignette 时仍由 changed 承载）
  const prevRumorById = new Map(prev.rumors.map(r => [r.id, r]));
  const levelUps = next.rumors
    .filter(r => { const p = prevRumorById.get(r.id); return p && p.level !== r.level && r.level !== 'vague'; })
    .map(r => `「${r.topic}」${r.level === 'heard' ? '传开' : '实锤'}`);
  // 传闻消散：prev 有、next 无（消散归 0/手动删除）——纪事记录 topic 供窗口显示
  const nextRumorIds = new Set(next.rumors.map(r => r.id));
  const goneRumors = prev.rumors.filter(r => !nextRumorIds.has(r.id)).map(r => r.topic);
  // WS8：vignette 世界掠影为主文（窗口展示提升报纸质感）；引擎差分摘要作兜底（AI 未给时）
  let summary = '';
  if (vignette && vignette.trim()) {
    summary = vignette.trim();
  } else {
    const summaryParts: string[] = [];
    if (changedProfiles.length) summaryParts.push(`角色动向更新：${changedProfiles.slice(0, 5).join('、')}${changedProfiles.length > 5 ? ' 等' : ''}`);
    if (changedRumorTopics.length) summaryParts.push(`传闻变化：${changedRumorTopics.slice(0, 3).join('、')}`);
    if (levelUps.length) summaryParts.push(`传闻${levelUps.slice(0, 3).join('、')}`);
    if (goneRumors.length) summaryParts.push(`传闻消散：${goneRumors.slice(0, 3).join('、')}`);
    if (!summaryParts.length) summaryParts.push('世界平静如常');
    summary = summaryParts.join('；');
  }
  return {
    id: `ce_${dateKey}_${kind}_${next.chronicle.length}`,
    dateKey,
    kind,
    summary,
    changed: { profiles: changedProfiles, rumors: changedRumors, rumorsGone: goneRumors },
    // 回廊差分（本地求差，零 token）；空差分不下发字段，保持旧纪事字节形态一致
    ...(() => { const d = buildChronicleDelta(prev, next); return Object.keys(d).length ? { deltas: d } : {}; })(),
  };
}

let _generating = false;
let _evolveAbortRequested = false; // 「终止」按钮请求：置位后本次演化输出被丢弃（generateRaw 本身不可中断）

/** 本次演化新入队的入镜项（next 中存在但 prev 没有的 id）。供落盘后合并弹窗。 */
export function findNewIntrusions(prev: WorldState, next: WorldState): Intrusion[] {
  const prevIds = new Set(prev.pendingIntrusions.map(i => i.id));
  return next.pendingIntrusions.filter(i => !prevIds.has(i.id));
}

/** 本次演化「浮现到台前」的传闻：新创建且非 vague（AI 直接放行 heard/known），或从 vague 升级到 heard/known（成长节拍/AI override）。
 *  vague 幕后流言主角听不到，不算浮现。纯函数。 */
export function findSurfacedRumors(prev: WorldState, next: WorldState): Rumor[] {
  const prevById = new Map(prev.rumors.map(r => [r.id, r]));
  return next.rumors.filter(r => {
    if (r.level === 'vague') return false;
    const before = prevById.get(r.id);
    return !before || before.level === 'vague';
  });
}

export interface WorldEvolveChoice {
  action: 'fill' | 'defer' | 'ack';
  id?: string;
}

/** 世界演化结果弹窗的 payload：SystemDecisionView + 原始数据（merge 重组 bodyHtml 用）。 */
export interface WorldEvolvePopupPayload extends SystemDecisionView {
  intrusions: Intrusion[];
  rumors: Rumor[];
}

/** 构造演化结果弹窗视图：入镜事件带「放入聊天框/忽略」选项，传闻浮现带「知道了」确认。纯函数。 */
export function buildWorldEvolveDecisionView(intrusions: Intrusion[], rumors: Rumor[]): WorldEvolvePopupPayload {
  const parts: string[] = [];
  if (rumors.length) {
    parts.push('<div class="ww-decision-block">传闻浮出水面</div>');
    for (const r of rumors) {
      parts.push(`<div class="ww-decision-row"><span class="ww-decision-tag ww-tag-${escapeHtml(r.level)}">${escapeHtml(RUMOR_LEVEL_LABEL[r.level] || r.level)}</span><span class="ww-decision-text"><b>${escapeHtml(r.topic)}</b>　${escapeHtml(r.content)}</span></div>`);
    }
  }
  if (intrusions.length) {
    parts.push('<div class="ww-decision-block">入镜事件</div>');
    for (const it of intrusions) {
      // 主行只显示钩子（「X似乎有事要发生：（钩子）」）；desc 行补全前因后果供决策参考
      const text = `<b>${escapeHtml(it.refId)}</b>似乎有事要发生：（${escapeHtml(it.hook || it.title)}）`;
      const descPart = it.desc ? `<div class="ww-decision-desc">【${escapeHtml(it.title)}】${escapeHtml(it.desc)}</div>` : '';
      parts.push(`<div class="ww-decision-row"><span class="ww-decision-text">${text}${descPart}</span><span class="ww-decision-actions"><button type="button" class="ww-decision-btn ww-decision-fill" data-id="${escapeHtml(it.id)}">放入聊天框</button><button type="button" class="ww-decision-btn ww-decision-dismiss" data-id="${escapeHtml(it.id)}">暂缓</button></span></div>`);
    }
  } else {
    parts.push('<div class="ww-decision-actions"><button type="button" class="ww-decision-btn ww-decision-ack">知道了</button></div>');
  }
  return {
    intrusions,
    rumors,
    title: intrusions.length ? ubIcon('globe') + ' 世界动态 · 入镜' : ubIcon('globe') + ' 世界动态 · 新传闻',
    bodyHtml: parts.join(''),
    bind: host => {
      host.body.querySelectorAll<HTMLElement>('.ww-decision-fill').forEach(btn => {
        btn.addEventListener('click', () => { void host.submit({ action: 'fill', id: btn.dataset.id }); });
      });
      host.body.querySelectorAll<HTMLElement>('.ww-decision-dismiss').forEach(btn => {
        btn.addEventListener('click', () => { void host.submit({ action: 'defer', id: btn.dataset.id }); });
      });
      const ack = host.body.querySelector<HTMLElement>('.ww-decision-ack');
      ack?.addEventListener('click', () => { void host.submit({ action: 'ack' }); });
    },
  };
}

/** 演化结果决策弹窗入队（落盘成功后调用）：入镜 + 传闻浮现合并为一次系统决策弹窗（不自动消失、必须手点）；
 *  同 key 决策滞留未处理时 merge 追加新内容。 */
export function enqueueWorldEvolutionPopup(intrusions: Intrusion[], rumors: Rumor[]): SystemDecisionEnqueueStatus {
  if (!intrusions.length && !rumors.length) return 'ignored';
  const contextKey = getCurrentStoryChatKey();
  const view = buildWorldEvolveDecisionView(intrusions, rumors);
  return enqueueSystemDecision<WorldEvolvePopupPayload, WorldEvolveChoice>({
    key: 'world-evolve-popup',
    contextKey,
    priority: SYSTEM_DECISION_PRIORITY.worldEvolve,
    payload: view,
    isValid: () => isStoryContextKeyValid(contextKey),
    merge: (cur, incoming) => {
      const curP = cur.payload as WorldEvolvePopupPayload;
      const incP = incoming.payload as WorldEvolvePopupPayload;
      curP.intrusions = [...curP.intrusions, ...incP.intrusions];
      curP.rumors = [...curP.rumors, ...incP.rumors];
      const rebuilt = buildWorldEvolveDecisionView(curP.intrusions, curP.rumors);
      curP.title = rebuilt.title;
      curP.bodyHtml = rebuilt.bodyHtml;
    },
    resolve: async choice => {
      if (choice.action === 'fill') {
        // 存储切换/未就绪期间拒绝执行（否则 loadWorldState 读到空态、triggerIntrusion 落空、
        // saveWorldState 失败——钩子已进输入框而 acted 态永远没落盘，弹窗却当成功关闭）。
        // 返回 ok:false 弹窗保持打开并显示错误行，用户稍后重试。
        if (!isStoryStorageReady()) return { ok: false, error: '存档同步中，请稍候再试' };
        // 读活 payload 而非首入队闭包数组：merge 追加的新入镜项只存在于 cur.payload（=== view），
        // 闭包数组搜不到会让「放入聊天框」静默失效、acted+TTL 永不落盘。
        const target = view.intrusions.find(i => i.id === choice.id);
        if (target) {
          fillIntrusionHook(target);
          // 放入聊天框=已触发：标 acted+TTL 并落盘（修旧版只填不标不存的缺陷；两轮演化后自然消散）
          const st = triggerIntrusion(loadWorldState(), target.id);
          await saveWorldState(st);
        }
        return { ok: true };
      }
      // defer（暂缓）= no-op：不撤台前、不改状态，事件保留待以后再考虑
      return { ok: true };
    },
  });
}

// ─── 小手机联动桥（演化落盘成功后把主动联系事件推入瑟瑟小手机） ───

let _phoneBridgeOverride: ((events: WorldPhoneEvent[]) => number) | null = null;
let _phoneStyleOverride: (() => string) | null = null;

/** 宿主桥探测：瑟瑟小手机运行时在宿主 window 注册 __ubp_world_inject（本层与 parent 各查一次，兼容 iframe 形态）。 */
function findHostPhoneBridge(): ((events: WorldPhoneEvent[]) => number) | null {
  const candidates: unknown[] = [];
  try { candidates.push((globalThis as any).__ubp_world_inject); } catch (_e) { /* ignore */ }
  try {
    const w = typeof window !== 'undefined' ? (window as any) : null;
    const parent = w?.parent;
    if (parent && parent !== window) candidates.push(parent.__ubp_world_inject);
  } catch (_e) { /* cross-origin */ }
  for (const c of candidates) {
    if (typeof c === 'function') return c as (events: WorldPhoneEvent[]) => number;
  }
  return null;
}

/** 瑟瑟小手机当前聊天风格探测（宿主 window.__ubp_phone_style 只读桥；未注册/脏值=现代）。 */
function findHostPhoneStyle(): '' | 'xianxia' | 'wuxia' | 'fantasy' {
  const probe = _phoneStyleOverride || (() => {
    const candidates: unknown[] = [];
    try { candidates.push((globalThis as any).__ubp_phone_style); } catch (_e) { /* ignore */ }
    try {
      const w = typeof window !== 'undefined' ? (window as any) : null;
      const parent = w?.parent;
      if (parent && parent !== window) candidates.push(parent.__ubp_phone_style);
    } catch (_e) { /* cross-origin */ }
    for (const c of candidates) {
      if (typeof c === 'function') return c as () => string;
    }
    return null;
  })();
  try {
    const v = probe?.();
    return v === 'xianxia' || v === 'wuxia' || v === 'fantasy' ? v : '';
  } catch (_e) {
    return '';
  }
}

/** 小手机联动可用性：配置开关开启时由 config 源调用（桥不存在=不注入提示词，零开销）。 */
export function isWorldPhoneBridgeAvailable(): boolean {
  return _phoneBridgeOverride !== null || findHostPhoneBridge() !== null;
}

/** @internal 测试注入：替换宿主桥（传 null 恢复）。 */
export function __setWorldPhoneBridgeForTests(fn: ((events: WorldPhoneEvent[]) => number) | null): void {
  _phoneBridgeOverride = fn;
}

/** @internal 测试注入：替换风格探测（传 null 恢复）。 */
export function __setWorldPhoneStyleForTests(fn: (() => string) | null): void {
  _phoneStyleOverride = fn;
}

/** 主动联系 / 社媒帖事件推送：实体协议（消息/来电只放行本轮焦点角色名，防幻觉；社媒帖作者允许路人——
 *  公共平台本就有路人生态，主角名屏蔽在小手机落库层执行）→ 宿主桥 → 小手机。返回投递条数。 */
export function dispatchWorldPhoneEvents(events: WorldPhoneEvent[] | undefined, focusNames: readonly string[]): number {
  if (!events || !events.length || !focusNames.length) return 0;
  const allow = new Set(focusNames);
  const valid = events.filter(e => e.name && (e.kind === 'social' || allow.has(e.name)));
  if (!valid.length) return 0;
  const bridge = _phoneBridgeOverride || findHostPhoneBridge();
  if (!bridge) return 0;
  try {
    return Math.max(0, bridge(valid) || 0);
  } catch (_e) {
    return 0;
  }
}

// —— 撤回上一轮演化：内存单槽快照（会话级，不落盘、零 IO）——
// 捕获时机=doEvolve 落盘成功后；持有 base 引用即可（applyWorldDelta 深拷贝出 next，base 此后不被改动）。
let _undoSnapshot: { chatKey: string; state: WorldState } | null = null;

/** 最近一次成功演化的撤销快照（只读窥视；null=无可撤回）。 */
export function peekWorldEvolveUndo(): Readonly<{ chatKey: string; state: WorldState }> | null {
  return _undoSnapshot;
}

/** 撤回按钮态：有快照且仍处于同一聊天才可撤回（与 undoLastEvolve 的守卫口径一致，用于窗口打开时置灰）。 */
export function isWorldEvolveUndoAvailable(): boolean {
  const snap = _undoSnapshot;
  return !!snap && snap.chatKey === getCurrentStoryChatKey();
}

/** @internal 测试钩子：播种撤销快照。 */
export function __setWorldEvolveUndoForTests(snap: { chatKey: string; state: WorldState }): void {
  _undoSnapshot = snap;
}

/** @internal 测试钩子：清空撤销快照。 */
export function __resetWorldEvolveUndoForTests(): void {
  _undoSnapshot = null;
}

/** 撤回上一轮世界演化：整状态回滚到演化前快照并按快照重投影世界书（纪事/入镜/传闻随状态一并回滚）。
 *  快照仅存内存（刷新即失）；跨聊天切换视为失效（拒绝并清空）。同时清掉未处理的本轮「世界动态」决策弹窗。 */
export async function undoLastEvolve(): Promise<boolean> {
  const toastr = getToastr();
  if (_generating) return false;
  const snap = _undoSnapshot;
  if (!snap) { toastr?.info('没有可撤回的演化（仅保留本次会话内最近一轮）', '世界动态'); return false; }
  if (getCurrentStoryChatKey() !== snap.chatKey) {
    _undoSnapshot = null; // 已切换聊天：快照永久失效，防止把 A 聊天的状态写进 B 聊天
    toastr?.info('已切换聊天，上一轮演化快照失效', '世界动态');
    return false;
  }
  if (!isStoryStorageReady()) { toastr?.error('存档尚未就绪，稍后再试', '世界动态'); return false; }
  const ok = await saveWorldState(snap.state);
  if (!ok) { toastr?.error('世界状态保存失败，撤回未生效', '世界动态'); return false; } // 失败保留快照可重试
  _undoSnapshot = null;
  invalidateSystemDecisions(item => item.key === 'world-evolve-popup'); // 弹窗内容已随回滚失效
  await projectWorldDigest(snap.state.frontDigest);
  await projectCharacterDynamics();
  toastr?.success('已撤回上一轮世界演化', '世界动态');
  return true;
}

export async function maybeEvolve(): Promise<void> {
  if (!_enabledSource() || _generating || !isStoryStorageReady()) return; // v1.1 三重守卫
  const state = loadWorldState();
  const round = getCurrentRound();
  const dateKey = getTodayDateKeyLocal();
  const cfg = getEvolveConfig();
  if (isReplyBelowMin(getLatestReply(), cfg.evolveMinReply)) return; // 最新 AI 回复过短：静默跳过本次自动演化（手动演化不受限）
  const kind = decideEvolveLocal(state, round, dateKey, cfg);
  if (!kind) return;
  await doEvolve(kind);
}

/** WS5 手动演化：不走 decideEvolve（不看轮数/日期是否到期），守卫同 doEvolve（_generating 天然防与自动重叠）。 */
export async function manualEvolve(): Promise<boolean> {
  if (!_enabledSource() || _generating || !isStoryStorageReady()) return false;
  const st = loadWorldState();
  const dateKey = getTodayDateKeyLocal();
  // 日期已推进 → 大演化；否则小演化（与 decideEvolve 的 big 判定同口径）
  const kind: EvolveKind = (st.lastEvolveDateKey && dateKey && compareDateKey(dateKey, st.lastEvolveDateKey) > 0) ? 'big' : 'small';
  return await doEvolve(kind);
}

export async function doEvolve(kind: EvolveKind): Promise<boolean> {
  if (!_enabledSource() || _generating || !isStoryStorageReady()) return false;
  _generating = true;
  _evolveAbortRequested = false;
  // F5 代际守卫：演化请求耗时可达分钟级，期间切聊天则结果属于旧聊天——落盘/投影前核对身份，
  // 不一致整体放弃（对齐 story-image-engine readChatIdentity 先例）；撤销槽同样按发起时刻记账。
  const chatKeyAtStart = getCurrentStoryChatKey();
  const toastr = getToastr();
  try {
    const th = getTavernHelper();
    const generateRaw = th?.generateRaw;
    if (!generateRaw) return false;
    const apiErr = validateCustomApiConfig('world');
    if (apiErr) { toastr?.error(`世界演化：${apiErr}`, '世界动态'); return false; }

    const prev = loadWorldState();
    const round = getCurrentRound();
    const dateKey = getTodayDateKeyLocal();
    const cfg = getEvolveConfig();
    const onStage = readOnStageNames();
    // v1.1：先同步 roster（重要角色表+恋爱对象表→侧写；在场角色表→onStage）
    const base = syncWorldRoster(prev, readRosterCandidates(), onStage, round);
    const recent = readRecentNames(); // 仅供 buildKnownSet（焦点选择不再用提及名单）
    const { profiles: focus } = selectFocusSubsetLocal(base, onStage, cfg);
    const timeGap = kind === 'small' ? describeTimeGap(base.lastEvolveDateKey, dateKey) : '';
    const src = await readEvolutionSources(focus, base);

    // Task 3（WS2）：主角已知集合（去重闸第二层提示词对照，每次演化算一次）
    const known = buildKnownSet(base, { dateKey, recentNames: recent });
    // WS4 5.3：线程推进计划（引擎掷波折；只对焦点离场、有线程、未满角色；只升不降封顶 100）
    const threadPlans: ThreadPlan[] = focus
      .filter(p => p.hiddenGoal && (Number(p.goalProgress) || 0) < 100)
      .map(p => {
        const tw = rollTwistTag(Math.random());
        // D3 时间差分档：>1 天（含 2 天整）未演化的焦点线程增量翻倍；updatedAt 空=新侧写按正常档
        const gap = gapDaysBetween(p.updatedAt, dateKey);
        const mult = gap > 1 ? 2 : 1;
        const advanced = advanceCharThread(p, { tw, kind, mult });
        return {
          name: p.name,
          goal: p.hiddenGoal as string,
          progress: Number(p.goalProgress) || 0,
          nextProgress: Number(advanced.goalProgress) || 0,
          tw,
          stage: charThreadStage(Number(advanced.goalProgress) || 0),
        };
      });
    const threadAdvances: Record<string, { nextProgress: number }> = {};
    for (const t of threadPlans) threadAdvances[t.name] = { nextProgress: t.nextProgress };
    const parts = buildEvolutionInstructionParts(kind, base, focus, cfg, round, dateKey, timeGap, src, threadPlans, known);
    const sub = (s: string): string => (typeof th.substitudeMacros === 'function' ? th.substitudeMacros(s) : s);

    // 统一 AI 活动：终止由注册表 cancel（stopGenerationById + abort）处理；
    // 兜底标志 _evolveAbortRequested 在请求返回后丢弃输出（防 stopGenerationById 未命中）
    // 每次尝试都要重做「一次性注入 + 扫描准备 + 生成」：once:true 只在下一次生成生效，
    // 重试若放在注入之内会丢掉触发注入与资料块。
    const runEvolveRequest = async (ctx: TextAiContext) => {
    // ① 绿灯触发注入：user_input 与资料块均不参与绿灯扫描（小手机契约），触发素材全部由这里喂入
    if (typeof th.injectPrompts === 'function') {
      await th.injectPrompts([{
        id: 'ub_world_evolve_trigger',
        position: 'none',
        depth: 0,
        role: 'system',
        content: parts.trigger,
        should_scan: true,
      }], { once: true });
      // ② 资料块注入：纪要/世界状态/近期剧情（发给 AI，不参与扫描）
      await th.injectPrompts([{
        id: 'ub_world_evolve_dossier',
        position: 'after_system',
        depth: 0,
        role: 'system',
        content: sub(parts.dossier),
        should_scan: false,
      }], { once: true });
    }

    return await withNativeScanWorldbook(
      {
        // 自投影条目暂停：世界动态（蓝灯 at_depth）与角色动态（绿灯=焦点名）内容与本请求资料块
        // 重复，且是演化自身的输出——回喂会锚定 AI 照抄旧文；数据库纪要条目与资料块纪要段重复。
        suspend: e => {
          const name = wbEntryName(e);
          return name === WORLD_WB_NAME
            || name.startsWith(CHARACTER_DYNAMIC_WB_PREFIX)
            || isChronicleEntryName(name);
        },
        // keep 放行窥私/消息记录条目族：资料块无消息注入，焦点角色的角色间/主角侧近期记录
        // 靠世界书条目进上下文，丰满人物动向（worldbook-entry.keepPhoneRecordEntries）。
        keep: keepPhoneRecordEntries,
      },
      () => generateRaw({
        should_silence: true,
        generation_id: ctx.generationId,
        user_input: sub(parts.userInput),
        // 1A 同构三段式：结构头(破限+防八股+角色与任务) → 原生世界书槽位（触发注入激活绿灯条目，
        // 扫描前经 withNativeScanWorldbook 暂停自投影并预渲染 EJS）→ 角色卡上下文 → 资料块(after_system 注入)
        // → user_input(规则/格式) → 结构尾(防截断)。max_chat_history:0——上下文只走资料块。
        ordered_prompts: [
          ...getJailbreakHeadPrompts({ antiCliche: true, task: sub(parts.task) }),
          ...STANDARD_PROMPT_MIDDLE,
          ...getJailbreakTailPrompts(),
        ],
        max_chat_history: STANDARD_MAX_CHAT_HISTORY,
        custom_api: getCustomApiConfig('world'),
      }),
    );
    };
    // 终止请求后不再重试：抛「已取消」被 ai-retry 归为 aborted 立即外抛
    const result = await withTextAiRetry('world', async (ctx: TextAiContext) => {
      if (_evolveAbortRequested || ctx.signal.aborted) throw new Error('请求已取消');
      try {
        return await runEvolveRequest(ctx);
      } catch (e) {
        if (_evolveAbortRequested || ctx.signal.aborted) throw new Error('请求已取消');
        throw e;
      }
    }, {
      feature: 'worldEvolution',
      onCancel: () => { _evolveAbortRequested = true; },
    });
    if (_evolveAbortRequested) { toastr?.info('已终止本次世界演化', '世界动态'); return false; }

    // 生成不达预期：空回（回复不足 50 字）/ 格式错误（<WORLD> 块解析不出）按原始回复内容量细分
    const delta = typeof result === 'string' ? parseWorldBlock(result) : null;
    if (!delta) {
      showGenOutputError('世界演化', result, { title: '世界动态', suffix: '本次已放弃' });
      return false;
    }
    toastr?.success('世界演化生成完成', '世界动态'); // 生成完成通知

    let next = applyWorldDelta(base, delta, { round, dateKey, threadAdvances, focusNames: focus.map(p => p.name) }); // 流言生命周期（发展/晋级/消散）在 applyWorldDelta 内完成

    next.chronicle.unshift(generateChronicle(base, next, kind, dateKey, delta.vignette)); // WS8：vignette 优先作纪事主文
    next.chronicle = next.chronicle.slice(0, CHRONICLE_MAX);

    // F5 代际守卫：AI 请求期间聊天已切换 → 本次结果属于旧聊天，整体放弃（静默，不打扰新聊天）
    if (getCurrentStoryChatKey() !== chatKeyAtStart) {
      console.info('[ub-world] evolve aborted: chat switched during generation');
      return false;
    }
    // v1.1：先原子落盘，成功后再投影（dispatcher 从已落盘 state 重算 frontDigest）
    const saved = await saveWorldState(next);
    if (!saved) { showPersistentError('世界状态保存失败，本次演化未生效', '世界动态'); return false; }
    _undoSnapshot = { chatKey: chatKeyAtStart, state: base }; // 撤回单槽：仅成功演化后覆盖（key 取发起时刻）
    // 通知改造：入镜 + 传闻浮现合并为一次系统决策弹窗（落盘成功后，不自动消失、必须手点）。
    const newArrivals = findNewIntrusions(base, next);
    const surfacedRumors = findSurfacedRumors(base, next);
    if (newArrivals.length || surfacedRumors.length) {
      enqueueWorldEvolutionPopup(newArrivals, surfacedRumors);
    }
    // 小手机联动：主动联系/社媒帖事件推入瑟瑟小手机（微信红点/来电界面/社媒信息流）；消息与来电走实体协议=只放行本轮焦点角色
    if (delta.phoneEvents?.length && cfg.worldPhoneLink) {
      dispatchWorldPhoneEvents(delta.phoneEvents, focus.map(p => p.name));
    }
    await projectWorldDigest(next.frontDigest);
    await projectCharacterDynamics(); // 离场/在场角色动向绿灯条目投影（含暗中打算+主角不知情提示）
    return true;
  } catch (e) {
    // 终止（stopGenerationById 中断 generateRaw）会抛错——视为已终止，不报「世界演化失败」
    if (_evolveAbortRequested) { toastr?.info('已终止本次世界演化', '世界动态'); return false; }
    // 失败通知常驻（用户拍板：演化失败必须手点掉才消失，不自动过期）
    showPersistentError('世界演化失败：' + String((e as Error)?.message || e), '世界动态');
    return false;
  } finally {
    _generating = false;
    _evolveAbortRequested = false;
  }
}

// —— 依赖注入点（v1.1 增加 enabled / roster）——
let _roundSource: () => number = () => 0;
let _dateSource: () => string = () => '';
let _cfgSource: () => EvolveConfig = () => ({ evolveEveryTurns: DEFAULT_EVOLVE_EVERY_TURNS, focusMax: DEFAULT_FOCUS_MAX, rotationBatch: DEFAULT_ROTATION_BATCH });
let _enabledSource: () => boolean = () => true;
let _decide: typeof decideEvolve = () => null;
let _select: typeof selectFocusSubset = () => ({ profiles: [], remainderCount: 0 });
let _onStageSource: () => string[] = () => [];
let _recentSource: () => string[] = () => [];
let _rosterSource: () => RosterCandidate[] = () => [];
let _gapSource: (a: string, b: string) => string = () => '';
let _latestReplySource: () => string = () => '';
let _sourcesReader: (focus: CharProfile[], state: WorldState) => Promise<EvolutionSources> = async () => ({ blue: [], green: [], chronicleBlocks: '', recentChat: '' });

function getCurrentRound(): number { return _roundSource(); }
function getTodayDateKeyLocal(): string { return _dateSource(); }
function getEvolveConfig(): EvolveConfig { return _cfgSource(); }
function getLatestReply(): string { return _latestReplySource(); }
function decideEvolveLocal(state: WorldState, round: number, dateKey: string, cfg: EvolveConfig): EvolveKind | null {
  return _decide(state.lastEvolveRound, state.lastEvolveDateKey, round, dateKey, cfg);
}
function selectFocusSubsetLocal(state: WorldState, onStage: string[], cfg: EvolveConfig) {
  return _select(state, onStage, cfg);
}
function readOnStageNames(): string[] { return _onStageSource(); }
function readRecentNames(): string[] { return _recentSource(); }
function readRosterCandidates(): RosterCandidate[] { return _rosterSource(); }
function describeTimeGap(a: string, b: string): string { return _gapSource(a, b); }
async function readEvolutionSources(focus: CharProfile[], state: WorldState): Promise<EvolutionSources> {
  return await _sourcesReader(focus, state);
}

export function configureWorldEvolutionSources(deps: {
  round: () => number;
  date: () => string;
  config: () => EvolveConfig;
  enabled?: () => boolean;
  decide: typeof decideEvolve;
  select: typeof selectFocusSubset;
  onStage: () => string[];
  recent: () => string[];
  roster?: () => RosterCandidate[];
  gap: (a: string, b: string) => string;
  /** 最新 AI 回复文本源（自动更新字数闸用；缺省空串=拦截）。 */
  latestReply?: () => string;
  sources: (focus: CharProfile[], state: WorldState) => Promise<EvolutionSources>;
}): void {
  _roundSource = deps.round;
  _dateSource = deps.date;
  _cfgSource = deps.config;
  if (deps.enabled) _enabledSource = deps.enabled;
  _decide = deps.decide;
  _select = deps.select;
  _onStageSource = deps.onStage;
  _recentSource = deps.recent;
  if (deps.roster) _rosterSource = deps.roster;
  _gapSource = deps.gap;
  if (deps.latestReply) _latestReplySource = deps.latestReply;
  _sourcesReader = deps.sources;
}
