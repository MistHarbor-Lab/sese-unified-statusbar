// ===== 宅仙只读 AI 小助手 · chat 作用域会话簿存储 =====
//
// 纯函数会话变更 + 单一 story feature key 持久化适配器。
// 仅 saveAssistantBook 触碰存储；UI 在真实用户动作后调用它。
// 变更全部返回新对象（不可变），测试可用假持久化适配器。
import type { AssistantBook, AssistantMessage, AssistantSession } from './assistant-types';
import {
  getCurrentStoryChatKey,
  isStoryStorageReady,
  readStoryFeature,
  writeStoryFeature,
} from './story-floor-store';

/** 当前聊天故事楼层中存放助手会话簿的唯一键。 */
export const ASSISTANT_STORY_KEY = 'assistant.v1';

/** 空会话簿（schema 1，无会话）。 */
export function emptyAssistantBook(): AssistantBook {
  return { schema: 1, sessions: [] };
}

// ─── ID 生成 ─────────────────────────────────────────────
function genId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 标题取自首问，按可见码点裁剪到 28 个。 */
function deriveTitle(question: string): string {
  const points = Array.from(question);
  return points.slice(0, 28).join('');
}

// ─── 读取 / 持久化 ────────────────────────────────────────
/** 从当前聊天故事楼层读入助手会话簿。无 chat key 或存储未就绪时返回空簿。 */
export function loadAssistantBook(): AssistantBook {
  if (!getCurrentStoryChatKey() || !isStoryStorageReady()) return emptyAssistantBook();
  return readStoryFeature<AssistantBook>(ASSISTANT_STORY_KEY, emptyAssistantBook());
}

/** 写入助手会话簿到当前聊天故事楼层。唯一触碰存储的函数；由 UI 在用户动作后调用。 */
export async function saveAssistantBook(book: AssistantBook): Promise<boolean> {
  return await writeStoryFeature(ASSISTANT_STORY_KEY, book);
}

// ─── 会话变更（纯函数，返回新 book） ─────────────────────
/** 新建会话。首问用作标题（裁剪到 28 可见码点）。插入第 7 个会话后仅删除最旧的一个，保留 6 个。 */
export function createAssistantSession(
  book: AssistantBook,
  question: string,
  at: number,
): { book: AssistantBook; id: string } {
  const id = genId();
  const session: AssistantSession = {
    id,
    title: deriveTitle(question),
    summary: '',
    createdAt: at,
    updatedAt: at,
    messages: [],
  };
  const sessions = [...book.sessions, session];
  while (sessions.length > 6) sessions.shift();
  return { book: { schema: book.schema, sessions }, id };
}

/** 向会话追加一条消息（用户提问 / 助手回答 / 错误态）。会话不存在时原样返回。 */
export function appendAssistantExchange(
  book: AssistantBook,
  sessionId: string,
  message: Omit<AssistantMessage, 'id'>,
): { book: AssistantBook; messageId: string } {
  const idx = book.sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return { book, messageId: '' };
  const messageId = genId();
  const msg: AssistantMessage = { id: messageId, ...message };
  const sessions = book.sessions.slice();
  const old = sessions[idx];
  sessions[idx] = {
    ...old,
    messages: [...old.messages, msg],
    updatedAt: Math.max(old.updatedAt, message.at),
  };
  return { book: { schema: book.schema, sessions }, messageId };
}

/** 删除指定会话。不存在的 id 原样返回。 */
export function deleteAssistantSession(book: AssistantBook, sessionId: string): AssistantBook {
  const idx = book.sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return book;
  const sessions = book.sessions.slice();
  sessions.splice(idx, 1);
  return { schema: book.schema, sessions };
}

/** 从指定消息下标起截断会话（删除该条及之后所有消息）。会话不存在或下标越界时原样返回。 */
export function truncateAssistantSession(book: AssistantBook, sessionId: string, fromIndex: number): AssistantBook {
  const idx = book.sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return book;
  const old = book.sessions[idx];
  if (!Number.isInteger(fromIndex) || fromIndex <= 0 || fromIndex >= old.messages.length) return book;
  const sessions = book.sessions.slice();
  sessions[idx] = {
    ...old,
    messages: old.messages.slice(0, fromIndex),
  };
  return { schema: book.schema, sessions };
}

/** 返回最近 limit 个会话（按 updatedAt 降序），默认 6。返回浅拷贝数组，不影响原 book。 */
export function selectRecentSessions(book: AssistantBook, limit = 6): AssistantSession[] {
  return book.sessions
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, Math.max(0, limit));
}