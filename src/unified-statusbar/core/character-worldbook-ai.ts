// ===== 角色世界书 AI 协议：构造请求、严格解析；本模块绝不写入世界书 =====
// 1A 同构三段式：结构头(破限+任务规则) → 原生世界书槽位（触发注入=角色名，激活绿灯；
// 扫描前经 prepareScan 暂停数据库纪要投影条目与被更新条目、预渲染 EJS）→ 角色卡上下文 → user_input
// (创作规则+快照XML) → 结构尾(尾部破限：<safe> 无害化收尾)。max_chat_history:0——取材只走快照。
import { getTavernHelper } from './env';
import { STANDARD_PROMPT_MIDDLE, STANDARD_MAX_CHAT_HISTORY } from './ai-request-pipeline';
import { getCustomApiConfig, validateCustomApiConfig, withTextAiRetry, type TextAiContext } from './api-config';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts, type JailbreakPromptEntry } from './jailbreak-config';
import { withNativeScanWorldbook } from './worldbook-entry';
import { isChronicleEntryName } from './chronicle-blocks';
import { escapeHtmlAttr } from './html-escape'; // U2：转义统一出口（补齐 " ' 转义，XML 属性不再可截断）
import type { CharacterWorldbookSnapshot, WorldbookChange } from './character-worldbook';

export interface CharacterWorldbookAiDeps {
  generateRaw: (request: Record<string, unknown>) => Promise<unknown>;
  validateApi: () => string | null;
  getCustomApi: () => unknown;
  /** 结构头段数组（破限头 + 反八股，见 getJailbreakHeadPrompts）；测试桩可直接返回固定段。 */
  getSystemPrompts: () => JailbreakPromptEntry[];
  /** 可选：绿灯触发注入（position:'none'+should_scan+once）；缺省=不注入（纯 user_input 无法激活绿灯）。 */
  injectPrompts?: (prompts: Record<string, unknown>[], options?: { once?: boolean }) => unknown;
  /** 可选：扫描前世界书准备（暂停自投影+预渲染 EJS）；缺省=原样执行 run。 */
  prepareScan?: <T>(options: { suspend: (entry: any) => boolean }, run: () => Promise<T>) => Promise<T>;
  substitudeMacros?: (text: string) => string;
}

export interface CharacterWorldbookCreationResult {
  raw: string;
  content: string;
}

export interface CharacterWorldbookUpdateResult {
  raw: string;
  changes: WorldbookChange[];
}

type ParseResult<T> = { ok: true } & T | { ok: false; error: string };

function escapeXml(value: unknown): string {
  return escapeHtmlAttr(value); // U2：统一出口（field name/value 坐双引号属性位，" 必须转义）
}

function renderRow(row: Record<string, string>): string {
  return Object.entries(row).map(([key, value]) => '<field name="' + escapeXml(key) + '">' + escapeXml(value) + '</field>').join('');
}

function renderTraitPool(pool: { personality: string[]; nsfw: string[] }): string {
  return '<trait_pool><personality_tags>' + pool.personality.map(escapeXml).join('、') + '</personality_tags>'
    + '<nsfw_tags>' + pool.nsfw.map(escapeXml).join('、') + '</nsfw_tags></trait_pool>';
}

function renderSnapshot(snapshot: CharacterWorldbookSnapshot): string {
  const chronicles = snapshot.chronicles
    .map(row => '<chronicle row_id="' + escapeXml(row.row_id) + '"><summary>' + escapeXml(row.summary) + '</summary><text>'
      + escapeXml(row.chronicle_text) + '</text><dialogue>' + escapeXml(row.key_dialogue) + '</dialogue></chronicle>')
    .join('');
  // 新人物创建：无角色表行，最近纪要取代角色记录成为世界与剧情坐标
  const roleRecords = snapshot.fresh ? '' : ''
    + '<character_record>' + renderRow(snapshot.characterRow || {}) + '</character_record>'
    + '<nsfw_record>' + renderRow(snapshot.nsfwRow || {}) + '</nsfw_record>'
    + '<personality_shift_record>' + renderRow(snapshot.personalityRow || {}) + '</personality_shift_record>';
  const chronicleTag = snapshot.fresh ? 'recent_chronicles' : 'matching_chronicles';
  const traitPoolSection = snapshot.traitPool && (snapshot.traitPool.personality.length || snapshot.traitPool.nsfw.length)
    ? renderTraitPool(snapshot.traitPool) : '';
  // 世界书条目（蓝灯/绿灯）由原生 world_info 槽位承载（触发注入激活），快照不再内嵌
  return '<source_snapshot>'
    + '<character_name>' + escapeXml(snapshot.characterName) + '</character_name>'
    + '<primary_worldbook>' + escapeXml(snapshot.primaryName) + '</primary_worldbook>'
    + roleRecords
    + '<' + chronicleTag + '>' + chronicles + '</' + chronicleTag + '>'
    + traitPoolSection
    + '<user_extra_requirements>' + escapeXml(snapshot.extraRequirements) + '</user_extra_requirements>'
    + '</source_snapshot>';
}

/** 绿灯触发文本：角色名。纪要内容走快照资料（user_input 的 source_snapshot），AM 序号不再注入（用户定案）；user_input 不参与扫描。 */
function buildTriggerText(snapshot: CharacterWorldbookSnapshot): string {
  return snapshot.characterName.trim();
}

export function buildCharacterWorldbookCreationPrompt(snapshot: CharacterWorldbookSnapshot, templateBody: string): string {
  const originParagraph = snapshot.fresh
    ? '【新人物从零创作】这是一位尚未在故事中出场、由用户预先创建的新人物。姓名是唯一硬性设定，必须原样使用；人物的一切——性别、身份、外貌、性格、经历——全部由你凭想象力原创。下方 <source_snapshot> 里的纪要不是关于这个人的资料，而是 TA 所生活的世界与已发生的故事：让人物的出身、处境与前史自然扎根于这个世界（地点、势力、事件可与既有设定勾连），不得与既有世界设定冲突，也不得复制既有角色的名号与经历。TA 将在后续剧情中与主角相遇，但这份档案仍须完全独立于主角存在。'
    : '【NPC 生成：想象为主，来源仅作坐标】这是一次从零开始的角色创作，不是对来源资料的改写或复述。下方 <source_snapshot> 的内容只是创作坐标：不可违背的硬性设定仅限——性别、身份、生理基本情况（含种族、生殖器类型等根本性特征）、性格底色、长期关系——除此之外，所有描写都应由你主动发挥想象力生成。来源里已经写明的具体描写（外貌细节、性格的具体表现方式、背景经历、癖好、说话风格、私密设定等）一律只作参考：不得照搬、不得改写式复述、不得顺着它延展。除非硬性设定不允许，否则要尽量带来与素材明显不同、出乎意料又自洽的感觉——宁可大胆重新演绎、替换、加料，也不要贴着来源生成一个预料之中的人物。来源未提及之处更是自由创作区，人物背景与前史可以天马行空，但必须逻辑自洽、能自然融入这个人物的立体形象，且不得与硬性设定或模板字段冲突。随机仅内化为生成过程，不要在输出中展示任何思考过程、标签池或骰子结果。';
  const pool = snapshot.traitPool;
  const hasPersonality = !!pool?.personality.length;
  const hasNsfw = !!pool?.nsfw.length;
  const poolParagraph = hasPersonality || hasNsfw ? [
    '【性格池与 NSFW 特质池】用户为本次创作随机选定了以下标签，必须把它们尽最大可能融入人物的塑造，这是本次创作的重要目标：',
    hasPersonality ? '性格标签：' + pool!.personality.join('、') + '。融入性格系统各轴与日常言行，保证每种特质都有可观察的具体显现，并与其他特质自然融合、不着痕迹；标签之间看似冲突时，用分层展现（对不同人、不同场合、内外差异）调和出立体感，禁止丢弃任何标签、也禁止只点名不演绎；口味作息癖好类标签要落进日常习惯与生活细节。' : '',
    hasNsfw ? 'NSFW 特质标签：' + pool!.nsfw.join('、') + '。融入性爱参数（敏感点、XP、性经历等）与身体特质，每个标签都要有具体、可落地到互动细节的表现；冲突标签按场景、心境或对象分层调和，不得丢弃。' : '',
    '标签只内化为生成过程，输出中不得罗列标签本身或提及筛选。',
  ].filter(Boolean).join('\n') : '';
  return [
    snapshot.fresh
      ? '执行新人物角色世界书条目创建任务，停止剧情推进。为下方来源记录中指定姓名的人物从零创作一份可写入主世界书的完整角色档案。'
      : '执行角色世界书条目创建任务，停止剧情推进。为下方来源记录中指定的人物创作一份可写入主世界书的完整角色档案。',
    originParagraph,
    '【人设拒绝平淡】生成的人设不得平淡、普通、脸谱化。要主动制造人物亮点与反差：在外貌、性格、背景、癖好中埋入记忆点与戏剧张力，打造与众不同、一眼难忘的亮眼形象（如温柔端庄外表下藏着的极端反差、纤细身形与常年运动练出的体能、平凡职业背后离奇的前史）。亮点与反差须彼此自洽、与硬性设定不矛盾，并如实落入模板对应字段。',
    '【性别与生理】以来源记录确认角色实际性别与生理情况。用户模板中的女性措辞、女性生理字段和示例是描写深度参考：男性或其他实际情况时，须等深度改写为对应的身体、生殖器与亲密信息，不得凭空保留不符合角色实际的女性特征。' + (snapshot.fresh ? '新人物的性别未指定时由你根据世界与人设自行决定，并贯穿全篇保持一致。' : ''),
    '【描写要求】严格遵守下方用户模板的描写要求与字段结构，逐项填充；身体部位与细节按示例的细致程度描写，不得省略，不得自创与模板冲突的结构。模板中的示例内容只作为描写细致程度的参考，不得照抄示例里的具体描写。',
    '【回溯补全，不复述现状】不去重复所给上下文里面的经历、变化、即时性情感和状态。世界书只记录角色的常态、稳定且可持续的事实：持续性外貌与生理特征、性格底色、长期关系模式、稳定偏好、已沉淀的背景与经历。严禁把当前剧情即时信息、单次事件、短期处境、当下心情、临时冲突、可逆状态或尚在变化的关系直接写入条目；若来源只提供此类信息，不得据此扩展成世界书内容。人物背景与前史要往前回溯，补全「为什么会是现在这样」的成因与立体性，而不是复述近期剧情事件。',
    '【完全剥离主角】这份档案描写角色自身在世界中的独立存在，用户扮演的主角在这份档案里不存在：不得出现主角的名字或称谓，不得出现任何以主角为对象、为参照、为成因的内容——包括与主角的关系、对主角的态度、因主角而起的变化、与主角的共同经历、因主角而生的记忆、承诺或习惯。',
    poolParagraph,
    '【输出契约】最终只能交付一个 <ub-entry-content>…</ub-entry-content> 包装，包装内是可直接写入世界书的完整角色档案；不要添加任何解释。',
    renderSnapshot(snapshot),
    '<user_template>\n' + String(templateBody || '').trim() + '\n</user_template>',
    '<output_contract><ub-entry-content>[完整角色世界书条目]</ub-entry-content></output_contract>',
  ].filter(Boolean).join('\n\n');
}

export function buildCharacterWorldbookUpdatePrompt(
  snapshot: CharacterWorldbookSnapshot,
  originalContent: string,
): string {
  return [
    '执行角色世界书条目更新审查，停止剧情推进。来源与原条目共同构成既有现实：不得随意改写角色性格底色、背景身份或既有经历。',
    '只为已经发生、已经沉淀的稳定现实变化（如人物关系、性经历或其他来源明确变化）修正原条目中过时或矛盾的内容。没有明确来源支持的变化不要提出。',
    '更新内容不得包含即时性情感和状态：当下心情、短期情绪、临时处境、单次事件等一律不得写入替换文本；替换文本只能保留角色的常态、稳定、可持续的事实。',
    '每项 old 必须逐字摘自原条目且在原文中只能出现一次；new 为替换后的文本；reason 说明所依据的当前事实。可不给出修改，但不得捏造修改。',
    '最终只能输出 <ub-updates><update><old>…</old><new>…</new><reason>…</reason></update></ub-updates>；不要输出解释、推理或 Markdown。',
    renderSnapshot(snapshot),
    '<selected_original_entry>\n' + String(originalContent || '') + '\n</selected_original_entry>',
  ].join('\n\n');
}

function stripOuterFence(raw: string): string {
  const trimmed = String(raw || '').trim();
  const match = /^```(?:xml|text|markdown)?\s*\n?([\s\S]*?)\n?```$/i.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

function allMatches(source: string, expression: RegExp): RegExpExecArray[] {
  return Array.from(source.matchAll(expression));
}

export function parseCharacterWorldbookCreation(raw: string): ParseResult<{ content: string }> {
  const text = stripOuterFence(raw);
  const matches = allMatches(text, /<ub-entry-content>([\s\S]*?)<\/ub-entry-content>/g);
  if (matches.length !== 1) return { ok: false, error: '未找到唯一的角色世界书内容包装' };
  const content = matches[0][1].trim();
  if (!content) return { ok: false, error: '角色世界书内容为空' };
  return { ok: true, content };
}

export function parseCharacterWorldbookUpdates(raw: string): ParseResult<{ changes: WorldbookChange[] }> {
  const text = stripOuterFence(raw);
  const roots = allMatches(text, /<ub-updates>([\s\S]*?)<\/ub-updates>/g);
  if (roots.length !== 1) return { ok: false, error: '未找到唯一的更新包装' };
  const root = roots[0][1];
  const updates = allMatches(root, /<update>([\s\S]*?)<\/update>/g);
  if (!updates.length) return { ok: false, error: '未找到可审核的更新项' };
  if (root.replace(/<update>[\s\S]*?<\/update>/g, '').trim()) return { ok: false, error: '更新包装中包含未知内容' };
  const changes: WorldbookChange[] = [];
  for (const update of updates) {
    const body = update[1];
    const fields = allMatches(body, /<(old|new|reason)>([\s\S]*?)<\/\1>/g);
    if (fields.length !== 3 || body.replace(/<(old|new|reason)>[\s\S]*?<\/\1>/g, '').trim()) {
      return { ok: false, error: '更新项必须且只能包含 old、new、reason' };
    }
    const values: Record<string, string> = {};
    for (const field of fields) {
      if (values[field[1]] !== undefined) return { ok: false, error: '更新项存在重复字段' };
      values[field[1]] = field[2].trim();
    }
    if (!values.old || !values.new || !values.reason) return { ok: false, error: '更新项的 old、new、reason 均不能为空' };
    changes.push({ old: values.old, next: values.new, reason: values.reason });
  }
  return { ok: true, changes };
}

export function createCharacterWorldbookAi(deps: CharacterWorldbookAiDeps) {
  const request = async (instruction: string, snapshot: CharacterWorldbookSnapshot, suspendUid?: number): Promise<string> => {
    const apiError = deps.validateApi();
    if (apiError) throw new Error(apiError);
    const sub = deps.substitudeMacros || ((s: string) => s);
    const prepare = deps.prepareScan || (async (_o, run) => await run());
    // 重试包在扫描准备之外：一次性注入（once:true）与扫描钩配置只在「下一次生成」生效，
    // 放在里面的话重试那一发会丢掉触发注入。
    const attempt = (ctx: TextAiContext) => prepare(
      {
        // 数据库纪要投影条目与快照纪要段重复；被更新条目与 selected_original_entry 重复（角色名触发会激活它）
        suspend: (entry: any) => {
          const name = String(entry?.comment ?? entry?.name ?? '').trim();
          if (isChronicleEntryName(name)) return true;
          return suspendUid != null && Number(entry?.uid) === suspendUid;
        },
      },
      async () => {
        if (deps.injectPrompts) {
          await deps.injectPrompts([{
            id: 'ub_char_wb_trigger',
            position: 'none',
            depth: 0,
            role: 'system',
            content: buildTriggerText(snapshot),
            should_scan: true,
          }], { once: true });
        }
        const raw = await deps.generateRaw({
          should_silence: true,
          generation_id: ctx.generationId,
          user_input: sub(instruction),
          ordered_prompts: [
            ...deps.getSystemPrompts(),
            ...STANDARD_PROMPT_MIDDLE,
            ...getJailbreakTailPrompts(),
          ],
          max_chat_history: STANDARD_MAX_CHAT_HISTORY,
          custom_api: deps.getCustomApi(),
        });
        if (typeof raw !== 'string') throw new Error('AI 返回不是文本');
        return raw;
      },
    );
    return await withTextAiRetry('characterWorldbook', attempt, { feature: 'characterWorldbook' });
  };
  return {
    async requestCreation(snapshot: CharacterWorldbookSnapshot, templateBody: string): Promise<CharacterWorldbookCreationResult> {
      const raw = await request(buildCharacterWorldbookCreationPrompt(snapshot, templateBody), snapshot);
      const parsed = parseCharacterWorldbookCreation(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      return { raw, content: parsed.content };
    },
    async requestUpdate(snapshot: CharacterWorldbookSnapshot, originalContent: string, options?: { uid?: number }): Promise<CharacterWorldbookUpdateResult> {
      const raw = await request(buildCharacterWorldbookUpdatePrompt(snapshot, originalContent), snapshot, options?.uid);
      const parsed = parseCharacterWorldbookUpdates(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      return { raw, changes: parsed.changes };
    },
  };
}

function defaultDeps(): CharacterWorldbookAiDeps {
  const helper = getTavernHelper();
  if (!helper || typeof helper.generateRaw !== 'function') throw new Error('酒馆文本生成接口不可用');
  return {
    generateRaw: request => helper.generateRaw(request),
    validateApi: () => validateCustomApiConfig('characterWorldbook'),
    getCustomApi: () => getCustomApiConfig('characterWorldbook'),
    getSystemPrompts: () => getJailbreakHeadPrompts({ antiCliche: true }),
    injectPrompts: typeof helper.injectPrompts === 'function'
      ? (prompts, options) => helper.injectPrompts(prompts, options)
      : undefined,
    prepareScan: (options, run) => withNativeScanWorldbook(options, run),
    substitudeMacros: typeof helper.substitudeMacros === 'function' ? (s: string) => helper.substitudeMacros(s) : undefined,
  };
}

export async function requestCharacterWorldbookCreation(snapshot: CharacterWorldbookSnapshot, templateBody: string): Promise<CharacterWorldbookCreationResult> {
  return createCharacterWorldbookAi(defaultDeps()).requestCreation(snapshot, templateBody);
}

export async function requestCharacterWorldbookUpdate(snapshot: CharacterWorldbookSnapshot, originalContent: string, options?: { uid?: number }): Promise<CharacterWorldbookUpdateResult> {
  return createCharacterWorldbookAi(defaultDeps()).requestUpdate(snapshot, originalContent, options);
}
