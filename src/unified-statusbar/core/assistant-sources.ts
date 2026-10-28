// ===== 宅仙只读 AI 小助手 · 安全资料目录与按需读取 =====
import { buildHelpCatalog, readHelpSections } from './assistant-help';
import { isLedgerTakeover } from './ledger-takeover';
import { exportExternalizableConfig } from './config-store';
import { redactExternalStorageSecrets } from './external-storage-secret-redaction';
import { ensureSheetsCacheWarm, getCachedSheetsSnapshot, type SheetContent } from './data-manager';
import { getTavernHelper } from './env';
import { tryEvalWorldbookEjs } from './ejs-bridge';
import { exportStoryFeatures, getCurrentStoryChatKey } from './story-floor-store';
import { readMapNode, readTreeIndex } from './map-tree-store';
import { getWardrobeSnapshot } from './wardrobe-store';
import { listSkillTrees, readSkillTree } from './skill-store';
import { readPlayState } from './play-state-store';
import { getAllCycleRecords } from './cycle-store';
import { loadWorldState } from './world-engine/world-store';
import type { CharProfile, WorldState } from './world-engine/world-types';
import {
  isManagedSkillEntry,
  wbEntryIsConstant,
  wbEntryKeys,
  wbEntryMatchedKeywords,
  wbEntryName,
} from './worldbook-entry';

export interface AssistantSourceCatalogItem {
  id: string;
  title: string;
  family: 'help' | 'worldbook' | 'story' | 'table' | 'plugin' | 'settings';
  keywords: string[];
  available: boolean;
  metadata?: Record<string, unknown>;
}

export interface AssistantSourcePayload {
  id: string;
  title: string;
  text: string;
  codePoints: number;
  messageCount?: number;
}

export interface AssistantSourceFailure {
  id: string;
  code: 'unavailable' | 'read_error' | 'too_large';
  message: string;
}

export interface AssistantSourceReadResult {
  payloads: AssistantSourcePayload[];
  failures: AssistantSourceFailure[];
  totalCodePoints: number;
}

export interface SourceSelection {
  sources: string[];
  terms: string[];
  question?: string;
  budget?: number;
  /** 「最近剧情」来源读取的楼层数（1-50）；缺省 10。只影响剧情资料深度，不影响世界书绿灯扫描深度。 */
  storyDepth?: number;
}

export interface AssistantSourceHost {
  getChatKey(): string;
  getCachedSheets(): SheetContent[];
  getWorldbookBindings(): { primary?: string | null; additional?: string[] } | null;
  getWorldbook(name: string): Promise<any[]>;
  getRawStoryMessages(): any[];
  getMapSnapshot(): Promise<unknown>;
  getWardrobeSnapshot(): unknown;
  getSkillSnapshot(): unknown;
  getPlayState(): unknown;
  getCycleRecords(): unknown;
  getJournalSnapshot(): unknown;
  /** L6：本地世界演化状态（`core/world-engine/world-store.ts` 的 loadWorldState()）。
   *  只读，且仅在用户勾选「世界动态」并提问时读取 ⇒ 空闲零开销、零 AI 请求。 */
  getWorldStateSnapshot(): unknown;
  /** 返回已脱敏的插件当前设置快照（密钥/凭证已剔除，仅读）。 */
  getSettingsSnapshot(): unknown;
}

const SENSITIVE_COLUMN_RE = /(?:api[_ -]?key|key|token|secret|password|authorization|密码|密钥|令牌|口令|凭证|授权码)/i;
const UNSAFE_TABLE_NAME_RE = /(?:api.{0,8}(?:key|密钥)|oauth|auth(?:entication|orization)?|token|secret|password|authorization|credential|认证|鉴权|密码|密钥|令牌|口令|凭证|授权码|备份|backup|image|图片|图像|路径|path|外部存储|external.{0,4}storage)/i;
const PLUGIN_SOURCE_META: ReadonlyArray<[string, string, string[]]> = [
  ['plugin:map', '地图快照', ['地图', '地点', '探索']],
  ['plugin:wardrobe', '衣柜快照', ['衣柜', '服饰', '套装', '穿搭']],
  ['plugin:skills', '技能树快照', ['技能', '天赋', '技能树']],
  ['plugin:play-state', '玩法选择快照', ['玩法', 'Play']],
  ['plugin:cycle', '经期孕期快照', ['经期', '孕期', '周期', '怀孕']],
  ['plugin:journal', '故事记录摘要', ['调查', '采访', '记录']],
  // L6（原 F19）：这里原本是「日报快照」——日报功能早已被世界演化取代，`exportStoryFeatures()` 里
  // 早就不再有 newspapers 字段 ⇒ 该源是恒空壳（消费者还在、生产者已无）。原位换名换源为「世界动态」，
  // 读本地世界演化状态（传闻 / 台前幕后动向 / 入镜事件 / 演化纪事）。列表项数不变（换名非增项）。
  ['plugin:world-state', '世界动态', ['世界', '世界动态', '世界情况', '传闻', '风声', '幕后', '台前', '入镜', '演化', '动向']],
];

let catalogCache = new Map<string, AssistantSourceCatalogItem[]>();

function cloneCatalog(items: AssistantSourceCatalogItem[]): AssistantSourceCatalogItem[] {
  return items.map(item => ({
    ...item,
    keywords: [...item.keywords],
    metadata: item.metadata ? { ...item.metadata } : undefined,
  }));
}

function safeTableColumns(sheet: SheetContent): { indexes: number[]; headers: string[] } {
  const row = Array.isArray(sheet.content?.[0]) ? sheet.content[0] : [];
  const indexes: number[] = [];
  const headers: string[] = [];
  row.forEach((header, index) => {
    const name = String(header ?? '').trim();
    if (!name || SENSITIVE_COLUMN_RE.test(name)) return;
    indexes.push(index);
    headers.push(name);
  });
  return { indexes, headers };
}

function boundWorldbookNames(bindings: ReturnType<AssistantSourceHost['getWorldbookBindings']>): string[] {
  if (!bindings) return [];
  return Array.from(new Set([
    bindings.primary,
    ...(Array.isArray(bindings.additional) ? bindings.additional : []),
  ].filter((name): name is string => typeof name === 'string' && !!name.trim()).map(name => name.trim())));
}

export function invalidateAssistantSourceCatalog(chatKey?: string): void {
  if (chatKey) catalogCache.delete(chatKey);
  else catalogCache = new Map();
}

/** 只列安全元数据；不得在此调用任何插件快照或世界书正文读取。 */
export async function buildAssistantSourceCatalog(host: AssistantSourceHost = defaultAssistantSourceHost): Promise<AssistantSourceCatalogItem[]> {
  const chatKey = String(host.getChatKey() || '');
  const cached = catalogCache.get(chatKey);
  if (cached) return cloneCatalog(cached);

  const helpItems: AssistantSourceCatalogItem[] = buildHelpCatalog().map(item => ({
    id: item.id,
    title: item.title,
    family: 'help',
    keywords: [...item.keywords],
    available: true,
  }));
  const worldbookNames = boundWorldbookNames(host.getWorldbookBindings());
  const baseItems: AssistantSourceCatalogItem[] = [
    {
      id: 'worldbook', title: '当前角色世界书', family: 'worldbook',
      keywords: ['世界书', '设定', '绿灯'], available: worldbookNames.length > 0,
      metadata: { books: worldbookNames },
    },
    {
      id: 'story', title: '最近剧情原文', family: 'story',
      keywords: ['剧情', '最近', '对话', '发生'], available: !!chatKey,
    },
    {
      id: 'settings', title: '当前设置快照', family: 'settings',
      keywords: ['设置', '配置', '设定'], available: true,
    },
  ];
  const tableItems = host.getCachedSheets().filter(sheet => !UNSAFE_TABLE_NAME_RE.test(String(sheet.name || ''))).map(sheet => {
    const { headers } = safeTableColumns(sheet);
    return {
      id: `table:${sheet.name}`,
      title: `数据表：${sheet.name}`,
      family: 'table' as const,
      keywords: [sheet.name, ...headers],
      available: true,
      metadata: { tableName: sheet.name, headers, rowCount: Math.max(0, (sheet.content?.length || 0) - 1) },
    };
  });
  const pluginItems = PLUGIN_SOURCE_META.map(([id, title, keywords]) => ({
    id, title, family: 'plugin' as const, keywords: [...keywords], available: true,
  }));
  const result = [...helpItems, ...baseItems, ...tableItems, ...pluginItems];
  catalogCache.set(chatKey, cloneCatalog(result));
  return cloneCatalog(result);
}

function getSillyTavernChat(): any[] {
  try {
    const local = (window as any).SillyTavern?.chat;
    if (Array.isArray(local)) return local;
    const parentChat = (window.parent as any).SillyTavern?.chat;
    return Array.isArray(parentChat) ? parentChat : [];
  } catch (_e) {
    return [];
  }
}

function safeJournalFeatures(): Record<string, unknown> {
  const all = exportStoryFeatures();
  const result: Record<string, unknown> = {};
  for (const key of ['interview', 'investigation', 'chronicle.mergeMarkers']) {
    if (Object.prototype.hasOwnProperty.call(all, key)) result[key] = all[key];
  }
  return result;
}

export const defaultAssistantSourceHost: AssistantSourceHost = {
  getChatKey: getCurrentStoryChatKey,
  getCachedSheets() {
    // 冷缓存（用户未打开过数据库面板）时主动暖一次；目录按 chatKey 记忆化 ⇒ 每聊天至多一次
    const cached = getCachedSheetsSnapshot();
    if (cached.length) return cached;
    return ensureSheetsCacheWarm() ? getCachedSheetsSnapshot() : [];
  },
  getWorldbookBindings() {
    const helper = getTavernHelper();
    try { return helper?.getCharWorldbookNames?.('current') || null; } catch (_e) { return null; }
  },
  async getWorldbook(name) {
    const helper = getTavernHelper();
    if (!helper?.getWorldbook) throw new Error('世界书接口不可用');
    return helper.getWorldbook(name);
  },
  getRawStoryMessages() {
    const helper = getTavernHelper();
    try {
      const lastId = helper?.getLastMessageId?.();
      if (Number.isInteger(lastId) && lastId >= 0 && typeof helper?.getChatMessages === 'function') {
        const rows = helper.getChatMessages(`0-${lastId}`, {
          role: 'all', hide_state: 'all', include_swipes: false,
        });
        if (Array.isArray(rows)) return rows;
      }
    } catch (_e) { /* fall through to raw SillyTavern.chat */ }
    return getSillyTavernChat();
  },
  async getMapSnapshot() {
    const index = await readTreeIndex();
    const nodeIds = Object.keys(index?.nodes || {});
    const nodes = (await Promise.all(nodeIds.map(id => readMapNode(id)))).filter(Boolean);
    return { index, nodes };
  },
  getWardrobeSnapshot,
  getSkillSnapshot() {
    return listSkillTrees().map(skillName => readSkillTree(skillName)).filter(Boolean);
  },
  getPlayState: readPlayState,
  getCycleRecords: getAllCycleRecords,
  getJournalSnapshot: safeJournalFeatures,
  getWorldStateSnapshot: loadWorldState,
  getSettingsSnapshot() {
    // exportExternalizableConfig 走 _stripExternalSecrets → redactExternalStorageSecrets，
    // 已剔除 customApiKey / 各预设 key / customHeaders / bodyParams / 各类 token·password·secret；
    // serializeSettings 再强制删一次 customApiKey 作为兜底。
    return exportExternalizableConfig();
  },
};

const PLUGIN_OMIT_KEY_RE = /(?:api[_ -]?key|key|token|secret|password|authorization|密码|密钥|令牌|口令|凭证|授权码|image|path|svg|checksum|revision|generation|writer|storyhash|laststoryhash|updatedat|createdat|write|queue)/i;

function countCodePoints(text: string): number {
  return Array.from(text).length;
}

/** 把脱敏配置快照序列化成给模型的可读文本；再次经红action 兜底剔除密钥/凭证。 */
function serializeSettings(snapshot: unknown): string {
  const safe = redactExternalStorageSecrets(
    (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) ? snapshot : {},
  );
  const json = JSON.stringify(safe, null, 2) || '{}';
  return '统一状态栏当前设置快照（密钥、Token、密码等敏感凭证已剔除）：\n' + json;
}

function uniqueTerms(selection: SourceSelection): string[] {
  const fromQuestion = String(selection.question || '').split(/[\s,，。；;：:！？!?、/\\|]+/);
  return Array.from(new Set([...selection.terms, ...fromQuestion]
    .map(term => String(term || '').trim().toLocaleLowerCase())
    .filter(Boolean)));
}

function tableByName(host: AssistantSourceHost, name: string): SheetContent | null {
  if (UNSAFE_TABLE_NAME_RE.test(String(name || ''))) return null;
  return host.getCachedSheets().find(sheet => sheet.name === name) || null;
}

/** 表格匹配行输出上限（按命中词数排序取前 N，超出部分在头部显式披露）。 */
const TABLE_ROW_CAP = 30;
/** 零命中时给出的开头样例行数（标注"非全部"，供"表里有什么"类结构问题作答）。 */
const TABLE_SAMPLE_ROWS = 5;

function serializeTable(sheet: SheetContent, terms: string[]): string {
  const { indexes, headers } = safeTableColumns(sheet);
  const allRows = (sheet.content || []).slice(1);
  const scored = allRows.map((row, order) => {
    const safe = indexes.map(index => String(row?.[index] ?? ''));
    const haystack = safe.join('\n').toLocaleLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    return { safe, score, order };
  });
  const matched = scored.filter(row => row.score > 0).sort((a, b) => b.score - a.score || a.order - b.order);
  const head = `数据表：${sheet.name}\n列：${headers.join('｜') || '（无可公开列）'}\n总行数：${allRows.length}`;
  if (!matched.length) {
    const sample = scored.slice(0, TABLE_SAMPLE_ROWS).map(row => row.safe.join('｜'));
    if (!sample.length) return `${head}\n未找到本地关键词匹配。`;
    return `${head}\n未命中本地关键词；以下为前 ${sample.length} 行样例（非全部数据）：\n${sample.join('\n')}`;
  }
  const capped = matched.slice(0, TABLE_ROW_CAP);
  const capNote = matched.length > capped.length ? `（共 ${matched.length} 行匹配，按命中词数排序列出前 ${capped.length} 行）` : '';
  return `${head}\n匹配行${capNote}：\n${capped.map(row => row.safe.join('｜')).join('\n')}`;
}

/** 绿灯匹配文本的安全上限（取拼接尾部，防超长楼层全文参与匹配；正常聊天远达不到）。 */
const GREEN_MATCH_TEXT_MAX_CODE_POINTS = 100_000;
/** 绿灯剧情尾窗的最大预留条数（酒馆 Scan Depth 设置上限为 100 条）。 */
const GREEN_STORY_WINDOW_MAX_MESSAGES = 100;
/** 酒馆全局世界书扫描深度（World Info → Scan Depth）读取失败时的默认值（酒馆出厂默认 2）。 */
const GREEN_SCAN_DEPTH_FALLBACK = 2;

/** 酒馆全局世界书扫描深度：优先 getContext().worldInfoSettings.world_info_depth，其次 DOM 输入框，兜底 2。 */
function tavernGlobalScanDepth(): number {
  try {
    const st = (typeof window !== 'undefined' ? (window as any).SillyTavern : undefined);
    const ctx = typeof st?.getContext === 'function' ? st.getContext() : st;
    const depth = Number(ctx?.worldInfoSettings?.world_info_depth);
    if (Number.isInteger(depth) && depth > 0) return Math.min(depth, GREEN_STORY_WINDOW_MAX_MESSAGES);
  } catch (_e) { /* fall through */ }
  try {
    if (typeof document !== 'undefined') {
      const value = Number((document.getElementById('world_info_depth') as HTMLInputElement | null)?.value);
      if (Number.isInteger(value) && value > 0) return Math.min(value, GREEN_STORY_WINDOW_MAX_MESSAGES);
    }
  } catch (_e) { /* fall through */ }
  return GREEN_SCAN_DEPTH_FALLBACK;
}

/** 条目有效扫描深度：条目自身 scan_depth 为正整数时优先（normalized strategy.scan_depth / raw scan_depth），
 *  'same_as_global'、null、undefined 等语义都回落到全局深度——对齐酒馆原生激活判定。 */
function entryScanDepth(entry: any, globalDepth: number): number {
  for (const value of [entry?.strategy?.scan_depth, entry?.scan_depth]) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return Math.min(value, GREEN_STORY_WINDOW_MAX_MESSAGES);
    }
  }
  return globalDepth;
}

function recentStoryTexts(host: AssistantSourceHost): string[] {
  const custom = (host as { getRecentStoryTexts?: () => unknown }).getRecentStoryTexts;
  if (typeof custom === 'function') {
    try {
      const texts = custom.call(host);
      if (Array.isArray(texts)) return texts.map(text => String(text || '')).filter(Boolean);
    } catch (_e) { /* fall through to in-memory chat */ }
  }
  // SillyTavern.chat 是内存数组，尾窗读取零成本；不经 host.getRawStoryMessages 的全量序列化路径。
  // 预留最大扫描窗口，具体取几条由条目自身/全局 Scan Depth 决定。
  return getSillyTavernChat()
    .slice(-GREEN_STORY_WINDOW_MAX_MESSAGES)
    .map(selectedMessageText)
    .filter(Boolean);
}

/** 绿灯触发判定用文本：按有效扫描深度取最近 N 条楼层拼接（截尾到安全上限）。问题侧命中走 terms。 */
function greenMatchTextForDepth(storyTexts: string[], depth: number): string {
  const joined = storyTexts.slice(-Math.max(1, depth)).join('\n');
  return Array.from(joined).slice(-GREEN_MATCH_TEXT_MAX_CODE_POINTS).join('');
}

/**
 * 世界书按酒馆原生激活语义序列化：蓝灯（常驻）条目全文；绿灯（关键词触发）条目在
 * 「问题 terms 双向命中」或「按其有效扫描深度取最近 N 条剧情文本包含其关键词」时任一满足给全文；
 * 扫描深度=条目自身 scan_depth（正整数）优先，否则酒馆全局 Scan Depth 设置；禁用/未命中/受管
 * 条目只进名字清单（保持"没读到≠不存在"的诚实性）。选中内容不截断。
 */
async function serializeWorldbooks(host: AssistantSourceHost, terms: string[]): Promise<string> {
  const names = boundWorldbookNames(host.getWorldbookBindings());
  if (!names.length) throw new Error('当前角色没有绑定可读世界书');
  const storyTexts = recentStoryTexts(host);
  const globalDepth = tavernGlobalScanDepth();
  const matchTextCache = new Map<number, string>();
  const matchTextFor = (depth: number): string => {
    let text = matchTextCache.get(depth);
    if (text === undefined) {
      text = greenMatchTextForDepth(storyTexts, depth);
      matchTextCache.set(depth, text);
    }
    return text;
  };
  const sections: string[] = [];
  for (const bookName of names) {
    const entries = await host.getWorldbook(bookName);
    if (!Array.isArray(entries)) throw new Error(`世界书“${bookName}”返回了无效数据`);
    if (!entries.length) {
      sections.push(`世界书：${bookName}\n（空世界书）`);
      continue;
    }
    const opened: string[] = [];
    const listed: string[] = [];
    for (const entry of entries) {
      const name = wbEntryName(entry) || '未命名条目';
      if (isManagedSkillEntry(entry)) {
        listed.push(`${name}（受管投影条目）`);
        continue;
      }
      if (entry?.enabled === false) {
        listed.push(`${name}（禁用）`);
        continue;
      }
      if (wbEntryIsConstant(entry)) {
        opened.push([
          `世界书：${bookName}`,
          `条目：${name}`,
          `触发：蓝灯（常驻）`,
          `内容：${await tryEvalWorldbookEjs(entry?.content)}`,
        ].join('\n'));
        continue;
      }
      const matchedTerms = wbEntryMatchedKeywords(entry, terms);
      const keys = wbEntryKeys(entry);
      const matchText = matchTextFor(entryScanDepth(entry, globalDepth));
      const storyKey = matchText ? keys.find(key => key && matchText.includes(key)) : undefined;
      if (matchedTerms.length || storyKey) {
        const trigger = matchedTerms.length
          ? `绿灯（命中关键词：${matchedTerms.slice(0, 5).join('、')}）`
          : `绿灯（近期剧情触发：${storyKey}）`;
        opened.push([
          `世界书：${bookName}`,
          `条目：${name}`,
          `触发：${trigger}`,
          `内容：${await tryEvalWorldbookEjs(entry?.content)}`,
        ].join('\n'));
      } else {
        const keyNote = keys.length ? `，关键词：${keys.slice(0, 5).join('、')}` : '，无关键词';
        listed.push(`${name}（绿灯未触发${keyNote}）`);
      }
    }
    const parts: string[] = [];
    if (opened.length) parts.push(opened.join('\n\n---\n\n'));
    if (listed.length) parts.push(`未翻开条目（仅列名）：${listed.join('、')}`);
    sections.push([`世界书：${bookName}`, ...parts].filter(Boolean).join('\n'));
  }
  return sections.join('\n\n---\n\n');
}

function selectedMessageText(message: any): string {
  if (typeof message?.message === 'string') return message.message;
  if (typeof message?.mes === 'string') {
    const swipeId = Number(message?.swipe_id);
    if (Array.isArray(message?.swipes) && Number.isInteger(swipeId) && typeof message.swipes[swipeId] === 'string') {
      return message.swipes[swipeId];
    }
    return message.mes;
  }
  const swipeId = Number(message?.swipe_id);
  if (Array.isArray(message?.swipes) && Number.isInteger(swipeId) && typeof message.swipes[swipeId] === 'string') {
    return message.swipes[swipeId];
  }
  return '';
}

function messageRole(message: any): 'user' | 'assistant' | 'system' {
  if (message?.role === 'user' || message?.role === 'assistant' || message?.role === 'system') return message.role;
  if (message?.is_user === true) return 'user';
  if (message?.is_system === true) return 'system';
  return 'assistant';
}

function serializeStory(messages: any[], depth: number): { text: string; messageCount: number } {
  const keep = Math.max(1, Math.min(50, Number.isInteger(depth) ? depth : 10));
  const selected = (Array.isArray(messages) ? messages : [])
    .map(message => ({ message, text: selectedMessageText(message) }))
    .filter(item => item.text)
    .slice(-keep);
  if (!selected.length) return { text: '最近剧情：没有可读取的原始消息。', messageCount: 0 };
  return {
    text: selected.map(({ message, text }) => {
      const id = Number.isInteger(message?.message_id) ? `#${message.message_id} ` : '';
      const name = String(message?.name || '').trim();
      return `${id}[${messageRole(message)}]${name ? ` ${name}` : ''}\n${text}`;
    }).join('\n\n'),
    messageCount: selected.length,
  };
}

function sanitizePluginValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  if (seen.has(value as object)) return '[循环引用已省略]';
  seen.add(value as object);
  if (Array.isArray(value)) return value.map(item => sanitizePluginValue(item, seen));
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (PLUGIN_OMIT_KEY_RE.test(key)) continue;
    out[key] = sanitizePluginValue(child, seen);
  }
  return out;
}

function pluginTitle(id: string): string {
  return PLUGIN_SOURCE_META.find(item => item[0] === id)?.[1] || id;
}

// ─── L6「世界动态」：把本地 WorldState 收敛成给模型的可读摘要 ───
// 为什么不直接把整份 WorldState 丢给 sanitizePluginValue + JSON.stringify：
// ①列表可长期累积（传闻上限 60、纪事 50、角色不限），整份塞进去会顶爆 60k code points 的额外资料预算，
//   而预算超限的语义是「整项拒绝」——那等于又变回空壳；
// ②原始结构里带一批内部记账键（updatedAt / lastEvolveDateKey / goalProgress 等），对回答没用；
// ③等级/状态是英文枚举，翻成中文模型更好用。
// 所以按「最有信息量在前」截取并在 truncated 里显式披露截断（与 serializeTable 的 TABLE_ROW_CAP 同思路）。
// ★字段名刻意避开 sanitizePluginValue 的 PLUGIN_OMIT_KEY_RE（含 `key`/`at` 等 token），
//   否则 dateKey/createdAt 这类会被脱敏器当成敏感键剥掉。
const WORLD_RUMOR_CAP = 15;
const WORLD_PROFILE_CAP = 12;
const WORLD_INTRUSION_CAP = 8;
const WORLD_CHRONICLE_CAP = 10;
const RUMOR_LEVEL_LABEL: Record<string, string> = { known: '已知', heard: '听闻', vague: '模糊' };

function worldProfileDigest(p: CharProfile): Record<string, unknown> {
  const out: Record<string, unknown> = { name: p.name, activity: p.activity, plans: p.plans };
  if (p.hiddenGoal) {
    out.hiddenGoal = p.hiddenGoal;
    if (typeof p.goalProgress === 'number') out.goalProgress = p.goalProgress;
    if (p.goalProgressText) out.goalProgressText = p.goalProgressText;
    if (p.goalDone) out.goalDone = p.goalDone;
  }
  if (p.relation) out.relation = p.relation;
  if (p.arrivalCondition) out.arrivalCondition = p.arrivalCondition;
  return out;
}

/** WorldState → 面向问答的摘要对象（纯函数，无 IO）。空/残缺输入一律降级为空摘要，不抛。 */
export function buildWorldStateDigest(raw: unknown): Record<string, unknown> {
  const state = (raw && typeof raw === 'object' ? raw : {}) as Partial<WorldState>;
  const profiles = Object.values(state.profiles || {}).filter(
    (p): p is CharProfile => !!p && typeof (p as CharProfile).name === 'string',
  );
  const rumors = Array.isArray(state.rumors) ? state.rumors : [];
  const intrusions = Array.isArray(state.pendingIntrusions) ? state.pendingIntrusions : [];
  const chronicle = Array.isArray(state.chronicle) ? state.chronicle : [];
  const notes: string[] = [];
  const take = <T,>(list: T[], cap: number, what: string): T[] => {
    if (list.length <= cap) return list;
    notes.push(`${what}共 ${list.length} 条，此处只给前 ${cap} 条`);
    return list.slice(0, cap);
  };
  const onStage = profiles.filter(p => p.onStage);
  const offStage = profiles.filter(p => !p.onStage);
  const digest: Record<string, unknown> = {
    lastEvolve: state.lastEvolveDateKey || '（尚未演化过）',
    evolveRound: state.lastEvolveRound || 0,
    frontDigest: state.frontDigest || '',
    onStage: onStage.map(worldProfileDigest),
    offStage: take(offStage, WORLD_PROFILE_CAP, '幕后角色动向').map(worldProfileDigest),
    rumors: take(rumors, WORLD_RUMOR_CAP, '传闻').map(r => ({
      topic: r.topic,
      level: RUMOR_LEVEL_LABEL[String(r.level)] || String(r.level || ''),
      progress: r.progress,
      dissipation: typeof r.dissipation === 'number' ? r.dissipation : null,
      content: r.content,
      appearedOn: r.createdAt,
    })),
    intrusions: take(intrusions, WORLD_INTRUSION_CAP, '入镜事件').map(i => ({
      title: i.title,
      status: i.status === 'acted' ? '已触发（你还没看见）' : '待处理',
      date: i.dateKey,
      hook: i.hook || '',
      desc: i.desc || '',
    })),
    chronicle: take(chronicle, WORLD_CHRONICLE_CAP, '演化纪事').map(c => ({
      date: c.dateKey,
      scale: c.kind === 'big' ? '大演化' : '小演化',
      summary: c.summary,
    })),
    evolveExcluded: Array.isArray(state.evolveExcluded) ? state.evolveExcluded : [],
  };
  if (notes.length) digest.truncated = notes;
  return digest;
}

async function readPluginSource(host: AssistantSourceHost, id: string): Promise<string> {
  let raw: unknown;
  if (id === 'plugin:map') raw = await host.getMapSnapshot();
  else if (id === 'plugin:wardrobe') raw = host.getWardrobeSnapshot();
  else if (id === 'plugin:skills') raw = host.getSkillSnapshot();
  else if (id === 'plugin:play-state') raw = host.getPlayState();
  else if (id === 'plugin:cycle') raw = host.getCycleRecords();
  else if (id === 'plugin:journal') raw = host.getJournalSnapshot();
  else if (id === 'plugin:world-state') raw = buildWorldStateDigest(host.getWorldStateSnapshot());
  else throw new Error('未注册的插件资料来源');
  return `${pluginTitle(id)}：\n${JSON.stringify(sanitizePluginValue(raw), null, 2)}`;
}

async function readOneSource(
  host: AssistantSourceHost,
  id: string,
  terms: string[],
  storyDepth: number,
): Promise<Omit<AssistantSourcePayload, 'codePoints'>> {
  if (id.startsWith('help:')) {
    const item = readHelpSections([id])[0];
    if (!item) throw new Error('未注册的帮助条目');
    // 帮助库按真数据库写；台账模式下「设置 → 表格」页已退役，补一行环境说明，
    // 否则小助手会照着帮助把用户指向已失效的入口（台账侧能力与去向见 core/ledger-takeover.ts）。
    const envNote = isLedgerTakeover()
      ? '\n\n【当前环境：瑟瑟台账已接管】主项目「设置 → 表格」页已整体退役；表结构模板、分组调度、手动填表、存量迁移与数据回滚请在“瑟瑟台账工作台”（表格 / 填表 / 迁移 / 时光机页）操作。'
      : '';
    return { id, title: item.title, text: `${item.title}\n${item.body}${envNote}` };
  }
  if (id === 'worldbook') return { id, title: '当前角色世界书', text: await serializeWorldbooks(host, terms) };
  if (id === 'story') {
    const story = serializeStory(host.getRawStoryMessages(), storyDepth);
    return { id, title: `最近剧情原文（最近 ${story.messageCount} 条）`, ...story };
  }
  if (id === 'settings') return { id, title: '当前设置快照', text: serializeSettings(host.getSettingsSnapshot()) };
  if (id.startsWith('table:')) {
    const tableName = id.slice('table:'.length);
    const sheet = tableByName(host, tableName);
    if (!sheet) throw new Error(`数据表“${tableName}”不在已暖缓存中`);
    return { id, title: `数据表：${tableName}`, text: serializeTable(sheet, terms) };
  }
  if (id.startsWith('plugin:')) return { id, title: pluginTitle(id), text: await readPluginSource(host, id) };
  throw new Error('未注册的资料来源');
}

/**
 * 只读取 selection 中明确列出的白名单来源。世界书保持完整且不计入额外资料预算；
 * 其余来源累计超过预算（默认 60,000 Unicode code points）时整项拒绝，绝不静默截断。
 */
export async function readAssistantSources(
  host: AssistantSourceHost = defaultAssistantSourceHost,
  selection: SourceSelection,
): Promise<AssistantSourceReadResult> {
  const payloads: AssistantSourcePayload[] = [];
  const failures: AssistantSourceFailure[] = [];
  const terms = uniqueTerms(selection);
  const budget = Math.max(0, Number.isFinite(selection.budget) ? Math.floor(selection.budget as number) : 60_000);
  const storyDepth = Math.max(1, Math.min(50, Math.floor(Number(selection.storyDepth) || 10)));
  let extraUsed = 0;
  for (const id of Array.from(new Set(selection.sources.map(value => String(value || '').trim()).filter(Boolean)))) {
    try {
      const raw = await readOneSource(host, id, terms, storyDepth);
      const codePoints = countCodePoints(raw.text);
      if (id !== 'worldbook' && extraUsed + codePoints > budget) {
        failures.push({
          id,
          code: 'too_large',
          message: `资料“${raw.title}”会使额外资料超过 ${budget} 个 Unicode code points，已停止读取该项。`,
        });
        continue;
      }
      if (id !== 'worldbook') extraUsed += codePoints;
      payloads.push({ ...raw, codePoints });
    } catch (error) {
      failures.push({
        id,
        code: /未注册|不在已暖缓存|没有绑定|不可用/.test(String((error as Error)?.message || error)) ? 'unavailable' : 'read_error',
        message: String((error as Error)?.message || error || '资料读取失败'),
      });
    }
  }
  return {
    payloads,
    failures,
    totalCodePoints: payloads.reduce((sum, item) => sum + item.codePoints, 0),
  };
}
