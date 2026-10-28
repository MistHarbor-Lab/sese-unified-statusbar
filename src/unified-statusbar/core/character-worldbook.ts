// ===== 角色世界书：主世界书状态、取材快照与安全写入 =====
import { isUserEntryName, wbEntryKeys, wbEntryName } from './worldbook-entry';
import { STANDARD_RECURSION } from './constants';
import { getTavernHelper } from './env';
import { getSheetByName } from './data-manager';
import { readChronicleRows, type ChronicleRow } from './chronicle-rows';

export type { ChronicleRow };

export interface CharacterWorldbookHit {
  uid: number;
  name: string;
  keys: string[];
  content: string;
}

export interface CharacterWorldbookStatus {
  primaryName: string;
  hits: CharacterWorldbookHit[];
}

export interface CharacterWorldbookSnapshot {
  characterName: string;
  primaryName: string;
  characterRow: Record<string, string>;
  nsfwRow: Record<string, string>;
  personalityRow: Record<string, string>;
  chronicles: ChronicleRow[];
  extraRequirements: string;
  /** true = 新人物创建模式：人物尚未在故事中出场，无任何角色表数据。 */
  fresh: boolean;
  /** 生成时冻结的性格池/NSFW特质池标签；两池皆空时为 null（不启用）。 */
  traitPool: { personality: string[]; nsfw: string[] } | null;
}

export interface WorldbookChange {
  old: string;
  next: string;
  reason: string;
}

export interface ApprovedWorldbookChange extends WorldbookChange {
  approved: boolean;
}

export interface PreparedCharacterWorldbookUpdate {
  primaryName: string;
  uid: number;
  originalContent: string;
  entry: any;
}

export interface CharacterWorldbookDeps {
  getHelper: () => any;
  getRows: (tableName: string) => Array<Record<string, string>>;
  readChronicles: () => ChronicleRow[] | null;
}

function primaryName(deps: CharacterWorldbookDeps): string {
  const helper = deps.getHelper();
  const value = helper?.getCharWorldbookNames?.('current')?.primary;
  const name = String(value || '').trim();
  if (!name) throw new Error('当前角色卡未绑定主世界书');
  return name;
}

/** 本功能自己创建的角色档案条目：它是「更新已有条目」的主目标，不随受管族一起隐藏。 */
const CHARACTER_ARCHIVE_ENTRY_PREFIX = 'UBS-档案-';

/** 选择面只列用户条目：状态栏受管投影（UBS-）/瑟瑟台账（SeseLedger）/小手机（[UBS手机]）/数据库（TavernDB）
 *  各自由所属功能的 suspend 谓词负责，不该出现在角色世界书的展示与更新候选里。 */
function isSelectableEntryName(entryName: string): boolean {
  const name = String(entryName || '').trim();
  if (!name) return false;
  return name.startsWith(CHARACTER_ARCHIVE_ENTRY_PREFIX) || isUserEntryName(name);
}

function isRelevant(entry: any, name: string): boolean {
  if (!name) return false;
  const entryName = wbEntryName(entry);
  if (!isSelectableEntryName(entryName)) return false;
  if (entryName.includes(name)) return true;
  return wbEntryKeys(entry).some(key => !!key && (key.includes(name) || name.includes(key)));
}

export function countOccurrences(text: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const index = text.indexOf(needle, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + needle.length;
  }
}

// ===== 宏容差定位：AI 看到的是宏展开后的条目，old 里可能写着展开值 =====
// 请求层会把 instruction（含 selected_original_entry）整体过 substitudeMacros，条目里的
// {{user}}/{{char}} 等占位符于是以具体名字到达 AI；AI 逐字复制出来的 old 自然对不上原文。
// 精确匹配失败后把占位符展开再匹配一次，命中位置映射回原文坐标——写回仍用原文片段，
// 不把展开值写死进条目；next 里与命中区间相关的展开值再还原成占位符写法。

export interface MacroTokenPair {
  token: string;
  value: string;
}

export interface LocatedWorldbookChange {
  start: number;
  end: number;
  /** 原文片段（占位符保持原样）；用于写回与 diff 预览。 */
  raw: string;
  /** true = 精确匹配失败后靠宏展开命中。 */
  viaMacro: boolean;
  /** 命中区间内实际涉及的宏，供 restoreMacroTokens 把 next 还原成占位符写法。 */
  macros: MacroTokenPair[];
}

export interface WorldbookChangeMatchOptions {
  /** 宏展开器；缺省用酒馆 substitudeMacros，取不到或抛错时恒等。 */
  resolveMacros?: (text: string) => string;
}

const MACRO_TOKEN_PATTERN = /\{\{[\s\S]{1,160}?\}\}/g;

function resolveWorldbookMacros(text: string): string {
  const helper = getTavernHelper();
  if (!helper || typeof helper.substitudeMacros !== 'function') return text;
  try {
    const value = helper.substitudeMacros(text);
    return typeof value === 'string' ? value : text;
  } catch (_e) { return text; }
}

function macroResolver(options?: WorldbookChangeMatchOptions): (text: string) => string {
  return options?.resolveMacros || resolveWorldbookMacros;
}

interface ExpandedSegments {
  text: string;
  /** 每个展开字符对应的原文起止；宏段映射到整个 token 的原文范围。 */
  rawStarts: number[];
  rawEnds: number[];
  macros: MacroTokenPair[];
}

function expandWithSegments(content: string, resolve: (text: string) => string): ExpandedSegments {
  let text = '';
  const rawStarts: number[] = [];
  const rawEnds: number[] = [];
  const macros: MacroTokenPair[] = [];
  const appendPlain = (chunk: string, rawStart: number): void => {
    for (let i = 0; i < chunk.length; i += 1) {
      rawStarts.push(rawStart + i);
      rawEnds.push(rawStart + i + 1);
    }
    text += chunk;
  };
  let cursor = 0;
  for (const match of content.matchAll(MACRO_TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) appendPlain(content.slice(cursor, start), cursor);
    const token = match[0];
    let value = token;
    try {
      const resolved = resolve(token);
      if (typeof resolved === 'string') value = resolved;
    } catch (_e) { value = token; }
    if (value !== token) macros.push({ token, value });
    const end = start + token.length;
    for (let i = 0; i < value.length; i += 1) {
      rawStarts.push(start);
      rawEnds.push(end);
    }
    text += value;
    cursor = end;
  }
  if (cursor < content.length) appendPlain(content.slice(cursor), cursor);
  return { text, rawStarts, rawEnds, macros };
}

function indexesOf(text: string, needle: string): number[] {
  if (!needle) return [];
  const out: number[] = [];
  let offset = 0;
  while (true) {
    const index = text.indexOf(needle, offset);
    if (index === -1) return out;
    out.push(index);
    offset = index + needle.length;
  }
}

function rawSpanAt(expanded: ExpandedSegments, index: number, length: number): { start: number; end: number } | null {
  if (index < 0 || length <= 0 || index + length > expanded.text.length) return null;
  const start = expanded.rawStarts[index];
  const end = expanded.rawEnds[index + length - 1];
  if (start == null || end == null || end <= start) return null;
  return { start, end };
}

interface WorldbookChangeMatch {
  occurrences: number;
  located: LocatedWorldbookChange | null;
}

function matchWorldbookChange(content: string, old: string, options?: WorldbookChangeMatchOptions): WorldbookChangeMatch {
  const text = String(content || '');
  const needle = String(old || '');
  if (!needle) return { occurrences: 0, located: null };
  const exact = countOccurrences(text, needle);
  if (exact === 1) {
    const start = text.indexOf(needle);
    return { occurrences: 1, located: { start, end: start + needle.length, raw: needle, viaMacro: false, macros: [] } };
  }
  if (exact > 1) return { occurrences: exact, located: null };
  const expanded = expandWithSegments(text, macroResolver(options));
  const hits = indexesOf(expanded.text, needle);
  if (!hits.length) return { occurrences: 0, located: null };
  const candidates = hits
    .map(index => rawSpanAt(expanded, index, needle.length))
    .filter((span): span is { start: number; end: number } => !!span);
  // 展开值可能与原文里的字面量撞车；命中不唯一时一律按多重命中处理，交调用方报「命中 N 处」。
  if (candidates.length !== 1) return { occurrences: hits.length, located: null };
  const span = candidates[0];
  const raw = text.slice(span.start, span.end);
  return {
    occurrences: hits.length,
    located: {
      start: span.start,
      end: span.end,
      raw,
      viaMacro: true,
      macros: expanded.macros.filter(pair => raw.includes(pair.token)),
    },
  };
}

/** 宏容差定位（审核页 diff 预览同样用它，保证卡片显示的是原文里的占位符）。 */
export function locateWorldbookChange(content: string, old: string, options?: WorldbookChangeMatchOptions): LocatedWorldbookChange | null {
  return matchWorldbookChange(content, old, options).located;
}

/** 把 AI 替换文本里的展开值还原成占位符写法（只处理命中区间涉及的宏）。 */
export function restoreMacroTokens(next: string, macros: MacroTokenPair[]): string {
  if (!macros.length) return String(next || '');
  let out = String(next || '');
  for (const pair of [...macros].sort((a, b) => b.value.length - a.value.length)) {
    if (!pair.value || pair.value === pair.token) continue;
    out = out.split(pair.value).join(pair.token);
  }
  return out;
}

function matchingRow(rows: Array<Record<string, string>>, name: string): Record<string, string> | null {
  return rows.find(row => String(row['姓名'] || '').trim() === name) || null;
}

/** 创建条目要求完全剥离主角：主角关联列在取材源头就不进快照（恋爱/重要角色表共有前者，恋爱对象表另有后者）。 */
const PROTAGONIST_LINKED_ROW_COLUMNS = ['对主角态度', '最近亲密互动'];

function stripProtagonistColumns(row: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!PROTAGONIST_LINKED_ROW_COLUMNS.includes(key)) next[key] = value;
  }
  return next;
}

export interface WorldbookChangeOutcome {
  /** 在传入 changes 数组中的下标。 */
  index: number;
  ok: boolean;
  /** 未写入时的原因；写入成功时为空串。 */
  error: string;
  /** true = 精确匹配失败后靠宏展开对齐写入（原文占位符保持不变）。 */
  viaMacro?: boolean;
}

export interface AppliedWorldbookChanges {
  /** 逐条替换后的内容（未勾选/未写入的修改不在其中）。 */
  content: string;
  /** 仅含 approved 的修改，按处理顺序。 */
  outcomes: WorldbookChangeOutcome[];
  applied: number;
  failed: number;
}

/**
 * 逐条结算已勾选的修改：能唯一定位的立刻替换，定位不了的只跳过该条并记下原因。
 * 单条定位失败不再作废整批——旧行为会让一条坏改动把用户所有勾选一起吞掉，且报错指向的
 * old 文本在界面上不可编辑，用户无路可走。审核页的预校验直接复用本函数：对原始内容跑一遍
 * 即得每条是否会写入、以及"前一条写入后把后一条原文吃掉"这类顺序冲突。
 */
export function applyApprovedWorldbookChanges(
  originalContent: string,
  changes: ApprovedWorldbookChange[],
  options?: WorldbookChangeMatchOptions,
): AppliedWorldbookChanges {
  let content = String(originalContent || '');
  const outcomes: WorldbookChangeOutcome[] = [];
  let applied = 0;
  changes.forEach((change, index) => {
    if (!change.approved) return;
    const old = String(change.old || '');
    const next = String(change.next || '');
    if (!old) {
      outcomes.push({ index, ok: false, error: '旧文本为空，无法定位' });
      return;
    }
    const match = matchWorldbookChange(content, old, options);
    if (!match.located) {
      outcomes.push({
        index,
        ok: false,
        error: match.occurrences === 0
          ? '原文中已找不到这段（可能已被前面的修改改写）'
          : `原文中命中 ${match.occurrences} 处，无法唯一定位`,
      });
      return;
    }
    const located = match.located;
    content = content.slice(0, located.start) + restoreMacroTokens(next, located.macros) + content.slice(located.end);
    applied += 1;
    outcomes.push({ index, ok: true, error: '', ...(located.viaMacro ? { viaMacro: true } : {}) });
  });
  return { content, outcomes, applied, failed: outcomes.length - applied };
}

/** 创建流程产物写入世界书条目前，用 <角色名> 标签包裹内容，使条目自述人物归属。 */
export function wrapCharacterWorldbookContent(characterName: string, content: string): string {
  const name = String(characterName || '').trim().replace(/[<>\r\n]+/g, '');
  if (!name) return String(content || '').trim();
  const body = String(content || '').trim();
  return '<' + name + '>\n' + body + '\n</' + name + '>';
}

export function buildDefaultCharacterEntry(name: string, content: string, overrides: Record<string, any> = {}): any {
  const characterName = String(name || '').trim();
  const defaults = {
    name: `UBS-档案-${characterName}`,
    enabled: true,
    strategy: { type: 'selective', keys: [characterName], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' },
    position: { type: 'before_character_definition', role: 'system', depth: 0, order: 200 },
    recursion: STANDARD_RECURSION,
    content: String(content || ''),
  };
  return { ...defaults, ...overrides, strategy: { ...defaults.strategy, ...(overrides.strategy || {}) }, position: { ...defaults.position, ...(overrides.position || {}) }, recursion: { ...defaults.recursion, ...(overrides.recursion || {}) } };
}

export function createCharacterWorldbookService(deps: CharacterWorldbookDeps) {
  const readPrimary = async (): Promise<{ name: string; entries: any[] }> => {
    const name = primaryName(deps);
    const helper = deps.getHelper();
    const entries = await helper?.getWorldbook?.(name);
    if (!Array.isArray(entries)) throw new Error('主世界书读取失败');
    return { name, entries };
  };

  const scanCharacterWorldbook = async (characterName: string): Promise<CharacterWorldbookStatus> => {
    const { name: primaryName, entries } = await readPrimary();
    return {
      primaryName,
      hits: entries.filter(entry => isRelevant(entry, characterName)).map(entry => ({
        uid: Number(entry.uid), name: wbEntryName(entry), keys: wbEntryKeys(entry), content: String(entry.content || ''),
      })),
    };
  };

  const buildCharacterWorldbookSnapshot = async (
    characterName: string,
    chronicleCount: number,
    extraRequirements: string,
  ): Promise<CharacterWorldbookSnapshot> => {
    const { name: primaryName } = await readPrimary();
    const chronicles = deps.readChronicles();
    if (chronicles === null) throw new Error('纪要表读取失败，请稍后重试');
    const count = Math.max(1, Math.min(100, Math.floor(Number(chronicleCount) || 20)));
    const containsName = (row: ChronicleRow): boolean => [row.summary, row.chronicle_text, row.key_dialogue]
      .some(value => String(value || '').includes(characterName));
    const characterRow = matchingRow(deps.getRows('恋爱对象表'), characterName)
      || matchingRow(deps.getRows('重要角色表'), characterName)
      || {};
    return {
      characterName,
      primaryName,
      // 世界书条目（蓝灯/绿灯）由原生 world_info 槽位承载（触发注入激活），快照只收角色表与纪要
      characterRow: stripProtagonistColumns(characterRow),
      nsfwRow: matchingRow(deps.getRows('NSFW信息表'), characterName) || {},
      personalityRow: matchingRow(deps.getRows('人物性格偏移表'), characterName) || {},
      chronicles: [...chronicles].filter(containsName).sort((a, b) => Number(b.row_id) - Number(a.row_id)).slice(0, count),
      extraRequirements: String(extraRequirements || ''),
      fresh: false,
      traitPool: null,
    };
  };

  /** 新人物创建不收角色表：世界书条目走原生槽位（触发注入=最近纪要摘要），最近纪要作剧情坐标。 */
  const buildFreshCharacterWorldbookSnapshot = async (
    characterName: string,
    chronicleCount: number,
    extraRequirements: string,
  ): Promise<CharacterWorldbookSnapshot> => {
    const { name: primaryName } = await readPrimary();
    const chronicles = deps.readChronicles();
    if (chronicles === null) throw new Error('纪要表读取失败，请稍后重试');
    const count = Math.max(1, Math.min(100, Math.floor(Number(chronicleCount) || 20)));
    // 新人物无人可匹配：取最近纪要作剧情坐标，让人物的处境与前史贴合故事走向
    const recentChronicles = [...chronicles].sort((a, b) => Number(b.row_id) - Number(a.row_id)).slice(0, count);
    return {
      characterName,
      primaryName,
      characterRow: {},
      nsfwRow: {},
      personalityRow: {},
      chronicles: recentChronicles,
      extraRequirements: String(extraRequirements || ''),
      fresh: true,
      traitPool: null,
    };
  };

  const prepareCharacterWorldbookUpdate = async (characterName: string, uid: number): Promise<PreparedCharacterWorldbookUpdate> => {
    const status = await scanCharacterWorldbook(characterName);
    const hit = status.hits.find(item => item.uid === uid);
    if (!hit) throw new Error('未找到可更新的角色世界书条目');
    return { primaryName: status.primaryName, uid: hit.uid, originalContent: hit.content, entry: hit };
  };

  const createCharacterWorldbookEntry = async (
    characterName: string,
    content: string,
    overrides: Record<string, any> = {},
    expectedPrimaryName?: string,
  ): Promise<any> => {
    const { name, entries } = await readPrimary();
    // 归属守卫：AI 生成期间切了角色卡 → 主世界书已换人，不得把新人物写进别卡。
    if (expectedPrimaryName && name !== expectedPrimaryName) throw new Error('主世界书已变更，请重新生成');
    const entry = buildDefaultCharacterEntry(characterName, content, overrides);
    const duplicate = entries.some(current => wbEntryName(current) === entry.name && wbEntryKeys(current).some(key => key === characterName));
    if (duplicate) throw new Error('已存在同名且同关键词的角色档案条目，请使用更新功能');
    const helper = deps.getHelper();
    if (typeof helper?.createWorldbookEntries !== 'function') throw new Error('世界书写入接口不可用');
    return helper.createWorldbookEntries(name, [entry], { render: 'immediate' });
  };

  const commitCharacterWorldbookChanges = async (prepared: PreparedCharacterWorldbookUpdate, nextContent: string): Promise<void> => {
    const { name, entries } = await readPrimary();
    if (name !== prepared.primaryName) throw new Error('主世界书已变更，请重新生成');
    const index = entries.findIndex(entry => Number(entry.uid) === prepared.uid);
    if (index === -1) throw new Error('目标世界书条目已不存在');
    if (String(entries[index].content || '') !== prepared.originalContent) throw new Error('世界书条目已被外部修改，请重新生成');
    const nextEntries = entries.slice();
    nextEntries[index] = { ...entries[index], content: String(nextContent || '') };
    const helper = deps.getHelper();
    if (typeof helper?.replaceWorldbook !== 'function') throw new Error('世界书写入接口不可用');
    await helper.replaceWorldbook(name, nextEntries, { render: 'immediate' });
  };

  return { scanCharacterWorldbook, buildCharacterWorldbookSnapshot, buildFreshCharacterWorldbookSnapshot, prepareCharacterWorldbookUpdate, createCharacterWorldbookEntry, commitCharacterWorldbookChanges };
}

function readTableRows(tableName: string): Array<Record<string, string>> {
  const sheet = getSheetByName(tableName);
  if (!sheet?.content?.length) return [];
  const headers = sheet.content[0].map(value => String(value || '').trim());
  return sheet.content.slice(1).map(row => headers.reduce<Record<string, string>>((result, header, index) => {
    if (header) result[header] = String(row[index] ?? '');
    return result;
  }, {}));
}

/** 运行时适配器：仅在用户进入角色档案并触发功能时由界面创建。 */
export function createDefaultCharacterWorldbookService() {
  return createCharacterWorldbookService({
    getHelper: getTavernHelper,
    getRows: readTableRows,
    readChronicles: readChronicleRows,
  });
}
