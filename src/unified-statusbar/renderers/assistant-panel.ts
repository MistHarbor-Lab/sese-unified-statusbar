// ===== 宅仙只读 AI 小助手 · 悬浮入口与对话面板 =====
import { ubIcon } from '../core/icons';
import { createAssistantRuntime, type AssistantAskResult } from '../core/assistant-runtime';
import { deleteAssistantSession, loadAssistantBook, saveAssistantBook, selectRecentSessions, truncateAssistantSession } from '../core/assistant-store';
import type { AssistantBook, AssistantMessage, AssistantSession } from '../core/assistant-types';
import { getConfig, setConfig } from '../core/config-store';
import type { ManualSourceOverride } from '../core/assistant-planner';
import { invalidateAssistantSourceCatalog } from '../core/assistant-sources';
import { syncDarkClass, syncDarkClassMinimal } from './html-builder';
import { showConfirmDialog } from './confirm-dialog';
import { renderMarkdownInto } from './markdown-lite';
import { ensureAssistantStyles, removeAssistantStyles } from '../styles/assistant-base';

const SOURCE_CHOICES = [
  ['help:settings', '功能帮助'], ['worldbook', '世界书'], ['story', '最近剧情'],
  ['plugin:map', '地图'], ['plugin:wardrobe', '衣柜'], ['plugin:skills', '技能'],
  ['plugin:play-state', '玩法'], ['plugin:cycle', '周期'], ['plugin:journal', '记录'],
  ['plugin:world-state', '世界动态'],
] as const;
const QUICK_PROMPTS = ['状态栏设置在哪里？', '概括最近发生的剧情', '结合现有资料给我下一步建议'];

let floatButton: HTMLButtonElement | null = null;
let overlay: HTMLDivElement | null = null;
let runtime: ReturnType<typeof createAssistantRuntime> | null = null;
let book: AssistantBook = { schema: 1, sessions: [] };
let activeSessionId = '';
let pendingDeleteId = '';
let manualOverride: ManualSourceOverride = emptyManualOverride();
let requestActive = false;
let requestSerial = 0;
let dragCleanup: (() => void) | null = null;
let pendingAnswerCard: HTMLElement | null = null;
let pendingAnswerNode: HTMLElement | null = null;
let pendingTypingLabel: HTMLElement | null = null;
// 后台生成状态：关闭面板不取消请求，重开面板时按这些态重建进行中的对话卡片
let pendingQuestionText = '';
let streamedDisplay = '';
let pendingPhase = 'selecting';
// 上一问的资料家族与所属会话：用于同会话内话题大幅切换时提醒可新开会话
let lastAnswerFamilies: string[] = [];
let lastAnswerSessionId = '';

const FAMILY_LABELS: Record<string, string> = {
  help: '功能帮助', worldbook: '世界书', story: '剧情', table: '数据表', plugin: '插件快照',
};

function familyOfSource(id: string): string {
  if (id.startsWith('help:')) return 'help';
  if (id.startsWith('table:')) return 'table';
  if (id.startsWith('plugin:')) return 'plugin';
  return id;
}

/** 同会话内两轮资料家族完全不相交时给一句轻提醒（不阻断，仅提示可新开会话）。 */
function shouldSuggestNewSession(prevFamilies: string[], nextFamilies: string[]): boolean {
  if (!prevFamilies.length || !nextFamilies.length) return false;
  return prevFamilies.every(family => !nextFamilies.includes(family));
}

function showTopicHint(prevFamilies: string[], nextFamilies: string[]): void {
  if (!overlay) return;
  const hint = overlay.querySelector<HTMLElement>('[data-assistant-topic-hint]');
  if (!hint) return;
  const label = (family: string) => FAMILY_LABELS[family] || family;
  const textNode = hint.querySelector<HTMLElement>('[data-assistant-topic-text]');
  if (textNode) {
    textNode.textContent = `本轮资料从「${label(prevFamilies[0])}」切换到了「${label(nextFamilies[0])}」；新话题建议新开会话，上下文更干净。`;
  }
  hint.hidden = false;
}

function hideTopicHint(): void {
  if (!overlay) return;
  const hint = overlay.querySelector<HTMLElement>('[data-assistant-topic-hint]');
  if (hint) hint.hidden = true;
}

function resetTopicTracking(): void {
  lastAnswerFamilies = [];
  lastAnswerSessionId = '';
  hideTopicHint();
}

function emptyManualOverride(): ManualSourceOverride {
  return { include: [], exclude: [], tableNames: [] };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const FLOAT_BUTTON_SIZE = 44;

function viewportSafeFloatPosition(position: { right: number; bottom: number }): { right: number; bottom: number } {
  const maxRight = Math.max(0, window.innerWidth - FLOAT_BUTTON_SIZE);
  const maxBottom = Math.max(0, window.innerHeight - FLOAT_BUTTON_SIZE);
  return {
    right: Math.max(0, Math.min(maxRight, Number(position.right) || 0)),
    bottom: Math.max(0, Math.min(maxBottom, Number(position.bottom) || 0)),
  };
}

/**
 * 移动端 SillyTavern 给 <html> 加 transform/perspective，使 position:fixed 的 right/bottom
 * 相对被折叠成极小高度的 html containing block 计算，把悬浮球顶出屏幕（与 overlay 塌缩同源）。
 * 与 overlay 修复一致（top:0;left:0 在 identity transform 下左上角对齐视口），改用 top/left 定位。
 */
function applyFloatPosition(button: HTMLButtonElement, position: { right: number; bottom: number }): void {
  const safe = viewportSafeFloatPosition(position);
  button.style.left = `${Math.max(0, window.innerWidth - FLOAT_BUTTON_SIZE - safe.right)}px`;
  button.style.top = `${Math.max(0, window.innerHeight - FLOAT_BUTTON_SIZE - safe.bottom)}px`;
  button.style.right = '';
  button.style.bottom = '';
}

function actionButton(label: string, action: string, className = ''): HTMLButtonElement {
  const button = el('button', className);
  // ubIcon() 返回 <svg>…</svg> 标记，须走 innerHTML 才能渲染成图标；textContent 会把它当纯文本转义成代码串溢出。
  if (label.startsWith('<svg')) button.innerHTML = label;
  else button.textContent = label;
  button.type = 'button';
  button.dataset.assistantAction = action;
  return button;
}

function currentSession(): AssistantSession | null {
  return book.sessions.find(session => session.id === activeSessionId) || null;
}

function cancelActiveRequest(): void {
  requestSerial += 1;
  requestActive = false;
  runtime?.cancel();
  pendingAnswerCard?.remove();
  pendingAnswerCard = null;
  pendingAnswerNode = null;
  pendingTypingLabel = null;
  pendingQuestionText = '';
  streamedDisplay = '';
  syncFloatBusy();
}

/** 悬浮球忙碌指示：面板关闭后仍有请求在后台生成时给一个轻量脉冲提示。 */
function syncFloatBusy(): void {
  floatButton?.classList.toggle('is-busy', requestActive);
}

/** 回复前的“正在回复中”动态指示；首个流式增量到达或回答完成时移除。 */
function attachTypingIndicator(card: HTMLElement): void {
  const typing = el('div', 'assistant-typing');
  const label = el('span', 'assistant-typing-text', phaseBusyLabel());
  label.dataset.assistantTypingText = '';
  const dots = el('span', 'assistant-typing-dots');
  dots.append(el('i', 'assistant-typing-dot'), el('i', 'assistant-typing-dot'), el('i', 'assistant-typing-dot'));
  typing.append(label, dots);
  card.append(typing);
  pendingTypingLabel = label;
}

function phaseBusyLabel(): string {
  return pendingPhase === 'selecting' ? '宅仙正在翻阅卷宗' : '宅仙正在回复中';
}

function removeTypingIndicator(): void {
  pendingTypingLabel?.closest('.assistant-typing')?.remove();
  pendingTypingLabel = null;
}

/** 构建进行中的对话卡片（发送时与后台生成中重开面板共用一条路径）。 */
function appendPendingConversation(messages: HTMLElement): void {
  messages.querySelector('.assistant-welcome')?.remove();
  if (pendingQuestionText) {
    messages.append(messageCard({ id: 'local-user', role: 'user', text: pendingQuestionText, at: Date.now() }));
  }
  const card = el('article', 'assistant-message assistant-message-assistant');
  const answerNode = el('div', 'assistant-message-text');
  if (streamedDisplay) answerNode.textContent = streamedDisplay;
  card.append(answerNode);
  pendingAnswerCard = card;
  pendingAnswerNode = answerNode;
  attachTypingIndicator(card);
  messages.append(card);
  messages.scrollTop = messages.scrollHeight;
}

function sourceState(id: string): 'auto' | 'include' | 'exclude' {
  if (manualOverride.include.includes(id)) return 'include';
  if (manualOverride.exclude.includes(id)) return 'exclude';
  return 'auto';
}

function cycleSource(id: string): void {
  const state = sourceState(id);
  manualOverride.include = manualOverride.include.filter(item => item !== id);
  manualOverride.exclude = manualOverride.exclude.filter(item => item !== id);
  if (state === 'auto') manualOverride.include.push(id);
  else if (state === 'include') manualOverride.exclude.push(id);
}

function renderSessionRail(): void {
  if (!overlay) return;
  const list = overlay.querySelector<HTMLElement>('[data-assistant-session-list]');
  if (!list) return;
  list.replaceChildren();
  for (const session of selectRecentSessions(book, 6)) {
    if (pendingDeleteId === session.id) {
      const confirm = el('div', 'assistant-session-confirm');
      confirm.append(el('span', '', `删除“${session.title}”？`));
      const actions = el('div', 'assistant-session-confirm-actions');
      const yes = actionButton('删除', 'confirm-delete');
      yes.dataset.sessionId = session.id;
      actions.append(yes, actionButton('取消', 'cancel-delete'));
      confirm.append(actions);
      list.append(confirm);
      continue;
    }
    const row = el('div', 'assistant-session-row');
    const open = actionButton(session.title || '未命名会话', 'switch-session', 'assistant-session-open');
    open.dataset.sessionId = session.id;
    open.title = session.title;
    if (session.id === activeSessionId) open.classList.add('is-active');
    const remove = actionButton('×', 'delete-session', 'assistant-session-delete');
    remove.dataset.sessionId = session.id;
    remove.setAttribute('aria-label', `删除会话 ${session.title}`);
    row.append(open, remove);
    list.append(row);
  }
}

function appendSourceLabels(card: HTMLElement, result: AssistantAskResult): void {
  if (!result.successfulSources.length && !result.unavailableSources.length) return;
  const labels = el('div', 'assistant-source-labels');
  for (const source of result.successfulSources) labels.append(el('span', 'assistant-source-label', source.title));
  for (const source of result.unavailableSources) labels.append(el('span', 'assistant-source-label is-unavailable', `不可用：${source.message}`));
  card.append(labels);
}

function messageCard(message: AssistantMessage): HTMLElement {
  const roleClass = message.role === 'user' ? 'assistant-message-user' : message.role === 'error' ? 'assistant-message-error' : 'assistant-message-assistant';
  const card = el('article', `assistant-message ${roleClass}`);
  const text = el('div', 'assistant-message-text');
  if (message.role === 'assistant') renderMarkdownInto(text, message.text);
  else text.textContent = message.text;
  card.append(text);
  if (message.sources?.length) {
    const labels = el('div', 'assistant-source-labels');
    for (const source of message.sources) labels.append(el('span', 'assistant-source-label', source.ref));
    card.append(labels);
  }
  // 每条消息的悬停操作（小 emoji 贴在气泡外侧，不占气泡布局空间）：用户消息可重新编辑/删除，助手消息可重新回答/删除
  if (message.role === 'user' || message.role === 'assistant') {
    const actions = el('div', 'assistant-message-actions');
    if (message.role === 'user') {
      actions.append(actionButton(ubIcon('pencil'), 'edit-message'), actionButton(ubIcon('trash'), 'delete-message'));
    } else {
      actions.append(actionButton(ubIcon('refresh'), 'reanswer-message'), actionButton(ubIcon('trash'), 'delete-message'));
    }
    for (const button of actions.querySelectorAll<HTMLButtonElement>('button')) {
      button.dataset.messageId = message.id;
      const label = button.dataset.assistantAction === 'edit-message' ? '重新编辑'
        : button.dataset.assistantAction === 'reanswer-message' ? '重新回答' : '删除';
      button.title = label;
      button.setAttribute('aria-label', label);
    }
    card.append(actions);
  }
  return card;
}

function renderWelcome(messages: HTMLElement): void {
  const welcome = el('section', 'assistant-welcome');
  welcome.append(el('h3', '', '宅仙在此'), el('p', '', '我只读当前聊天中你明确选择的资料，可以讲功能、核对数据、梳理剧情或给出建议。'));
  const quick = el('div', 'assistant-quick-prompts');
  for (const prompt of QUICK_PROMPTS) {
    const button = actionButton(prompt, 'quick-prompt');
    button.dataset.prompt = prompt;
    quick.append(button);
  }
  welcome.append(quick);
  messages.append(welcome);
}

function renderConversation(options: { retainScroll?: boolean } = {}): void {
  if (!overlay) return;
  const messages = overlay.querySelector<HTMLElement>('[data-assistant-messages]');
  if (!messages) return;
  const oldScroll = messages.scrollTop;
  messages.replaceChildren();
  const session = currentSession();
  if (!session || session.messages.length === 0) renderWelcome(messages);
  else for (const message of session.messages) messages.append(messageCard(message));
  if (options.retainScroll) messages.scrollTop = oldScroll;
  else messages.scrollTop = messages.scrollHeight;
  const title = overlay.querySelector<HTMLElement>('[data-assistant-title]');
  if (title) title.textContent = session?.title || '新会话';
}

function refreshSourceControls(): void {
  if (!overlay) return;
  overlay.querySelectorAll<HTMLButtonElement>('[data-assistant-source-id]').forEach(button => {
    const state = sourceState(button.dataset.assistantSourceId || '');
    button.dataset.state = state;
    button.setAttribute('aria-pressed', state === 'auto' ? 'false' : 'true');
    button.title = state === 'auto' ? '自动选择' : state === 'include' ? '下次强制包含' : '下次排除';
  });
  const summary = overlay.querySelector<HTMLElement>('[data-assistant-source-summary]');
  if (summary) summary.textContent = manualOverride.include.length || manualOverride.exclude.length || manualOverride.tableNames.length ? '下次提问有手动范围' : '自动选择';
}

function refreshStreamingToggle(): void {
  if (!overlay) return;
  const toggle = overlay.querySelector<HTMLButtonElement>('[data-assistant-streaming]');
  if (!toggle) return;
  const streaming = getConfig().assistantStreaming !== false;
  toggle.textContent = streaming ? '流式' : '整段';
  toggle.classList.toggle('is-active', streaming);
  toggle.setAttribute('aria-pressed', streaming ? 'true' : 'false');
  toggle.title = streaming ? '回答逐字流式输出（点击切换为整段）' : '回答整段返回后一次渲染（点击切换为流式）';
}

function setBusy(active: boolean, status = ''): void {
  requestActive = active;
  syncFloatBusy();
  if (!overlay) return;
  const send = overlay.querySelector<HTMLButtonElement>('[data-assistant-action="send"]');
  const cancels = overlay.querySelectorAll<HTMLButtonElement>('[data-assistant-action="cancel"]');
  const input = overlay.querySelector<HTMLTextAreaElement>('[data-assistant-input]');
  if (send) send.disabled = active;
  if (input) input.disabled = active;
  cancels.forEach(cancel => { cancel.hidden = !active; });
  const statusNode = overlay.querySelector<HTMLElement>('[data-assistant-status]');
  if (statusNode) statusNode.textContent = status;
}

function buildShell(): HTMLDivElement {
  const shell = el('div', `assistant-shell assistant-theme-${getConfig().style}`) as HTMLDivElement;
  const rail = el('aside', 'assistant-session-rail');
  const railHead = el('div', 'assistant-rail-head');
  railHead.append(el('span', 'assistant-rail-title', '会话'), actionButton('＋', 'new-session'));
  const sessionList = el('div', 'assistant-session-list');
  sessionList.dataset.assistantSessionList = '';
  rail.append(railHead, sessionList);

  const dialogue = el('main', 'assistant-dialogue');
  const head = el('header', 'assistant-dialogue-head');
  const mobileSessions = actionButton('会话', 'toggle-sessions', 'assistant-mobile-sessions');
  const title = el('span', 'assistant-dialogue-title', '新会话');
  title.dataset.assistantTitle = '';
  const headerActions = el('div', 'assistant-header-actions');
  const headerCancel = actionButton('取消生成', 'cancel', 'assistant-cancel');
  headerCancel.hidden = true;
  headerActions.append(headerCancel, actionButton('关闭', 'close'));
  head.append(mobileSessions, title, headerActions);

  const sourceWrap = el('section', 'assistant-source-wrap');
  const sourceHead = el('div', 'assistant-source-head');
  // Static action contracts: data-assistant-action="new-session" data-assistant-action="cancel" data-assistant-action="toggle-sources"
  const sourceToggle = actionButton('资料范围', 'toggle-sources');
  const sourceSummary = el('span', 'assistant-source-summary', '自动选择');
  sourceSummary.dataset.assistantSourceSummary = '';
  sourceHead.append(sourceToggle, sourceSummary);
  const sourcePanel = el('div', 'assistant-source-panel');
  sourcePanel.dataset.assistantSourcePanel = '';
  sourcePanel.hidden = true;
  const chips = el('div', 'assistant-source-chips');
  for (const [id, label] of SOURCE_CHOICES) {
    const chip = actionButton(label, 'cycle-source', 'assistant-source-chip');
    chip.dataset.assistantSourceId = id;
    chips.append(chip);
  }
  const tableField = el('label', 'assistant-table-field');
  tableField.append(el('span', '', '指定表格'));
  const tableInput = el('input') as HTMLInputElement;
  tableInput.type = 'text';
  tableInput.placeholder = '输入完整表名；发送后才解析';
  tableInput.setAttribute('data-assistant-table-name', '');
  tableField.append(tableInput);
  sourcePanel.append(chips, tableField);
  sourceWrap.append(sourceHead, sourcePanel);

  const topicHint = el('div', 'assistant-topic-hint');
  topicHint.hidden = true;
  topicHint.dataset.assistantTopicHint = '';
  const topicText = el('span', 'assistant-topic-text');
  topicText.dataset.assistantTopicText = '';
  topicHint.append(topicText, actionButton('新会话', 'new-session'));

  const messages = el('section', 'assistant-messages');
  messages.dataset.assistantMessages = '';
  const composer = el('footer', 'assistant-composer');
  const input = el('textarea', 'assistant-input') as HTMLTextAreaElement;
  input.rows = 3;
  input.placeholder = '问宅仙……';
  input.dataset.assistantInput = '';
  const composerActions = el('div', 'assistant-composer-actions');
  const status = el('span', 'assistant-status');
  status.dataset.assistantStatus = '';
  const streamingToggle = actionButton('流式', 'toggle-streaming', 'assistant-streaming-toggle');
  streamingToggle.dataset.assistantStreaming = '';
  const cancel = actionButton('取消', 'cancel', 'assistant-cancel');
  cancel.hidden = true;
  composerActions.append(status, streamingToggle, cancel, actionButton('发送', 'send', 'assistant-send'));
  composer.append(input, composerActions);
  dialogue.append(head, sourceWrap, topicHint, messages, composer);
  shell.append(rail, dialogue);
  return shell;
}

async function deleteSession(sessionId: string): Promise<void> {
  const next = deleteAssistantSession(book, sessionId);
  if (next === book) return;
  if (!await saveAssistantBook(next)) return;
  book = next;
  if (activeSessionId === sessionId) activeSessionId = selectRecentSessions(book, 1)[0]?.id || '';
  pendingDeleteId = '';
  renderSessionRail();
  renderConversation();
}

/** 核心问答流程：发送新问题、重新编辑、重新回答共用此路径。 */
async function askQuestion(text: string, sessionId: string, tableNames: string[] = []): Promise<void> {
  if (!overlay || requestActive) return;
  const messages = overlay.querySelector<HTMLElement>('[data-assistant-messages]');
  if (!messages) return;
  const requestOverride: ManualSourceOverride = {
    include: [...manualOverride.include], exclude: [...manualOverride.exclude], tableNames,
  };
  manualOverride = emptyManualOverride();
  refreshSourceControls();
  hideTopicHint();
  // 后台生成状态先行落模块态：关闭面板后请求继续，重开面板按这些态重建进行中的卡片
  pendingQuestionText = text;
  streamedDisplay = '';
  pendingPhase = 'selecting';
  appendPendingConversation(messages);

  const serial = ++requestSerial;
  requestActive = true;
  syncFloatBusy();
  setBusy(true, '选择资料中');
  let streamedText = '';
  let result: AssistantAskResult;
  try {
    result = await (runtime ||= createAssistantRuntime()).ask({
      text,
      sessionId,
      override: requestOverride,
      onPhase: phase => {
        if (serial !== requestSerial) return;
        pendingPhase = phase;
        if (pendingTypingLabel) pendingTypingLabel.textContent = phaseBusyLabel();
        if (overlay) setBusy(true, phase === 'selecting' ? '选择资料中' : '整理回答中');
      },
      onAnswerChunk: answerText => {
        if (serial !== requestSerial) return;
        streamedDisplay = answerText;
        if (!overlay || !pendingAnswerNode) return;
        removeTypingIndicator();
        if (answerText.startsWith(streamedText)) {
          const delta = answerText.slice(streamedText.length);
          if (delta) pendingAnswerNode.append(document.createTextNode(delta));
        } else {
          pendingAnswerNode.textContent = answerText;
        }
        streamedText = answerText;
        messages.scrollTop = messages.scrollHeight;
      },
    });
  } catch (error) {
    if (serial !== requestSerial) return;
    setBusy(false, '');
    const errorMessage = `宅仙请求失败：${String((error as Error)?.message || error || '未知错误')}`;
    if (!overlay || !pendingAnswerCard) { pendingQuestionText = ''; streamedDisplay = ''; return; }
    pendingAnswerCard.classList.add('assistant-message-error');
    pendingAnswerNode!.textContent = errorMessage;
    return;
  }
  if (serial !== requestSerial) return;
  setBusy(false, '');
  const pendingCard = pendingAnswerCard;
  const answerNode = pendingAnswerNode;
  const wasClosed = !overlay || !pendingCard || !answerNode;
  pendingAnswerCard = null;
  pendingAnswerNode = null;
  pendingQuestionText = '';
  streamedDisplay = '';
  // 后台完成（面板曾被关闭）：会话已由运行时落库，重开面板即从存储读到完整问答
  if (wasClosed) { book = loadAssistantBook(); return; }
  removeTypingIndicator();
  if (result.kind === 'cancelled') {
    pendingCard!.remove();
  } else if (result.kind === 'success') {
    renderMarkdownInto(answerNode!, result.answer);
    appendSourceLabels(pendingCard!, result);
    const nextFamilies = Array.from(new Set(result.sources.map(familyOfSource)));
    if (result.sessionId && result.sessionId === lastAnswerSessionId
      && shouldSuggestNewSession(lastAnswerFamilies, nextFamilies)) {
      showTopicHint(lastAnswerFamilies, nextFamilies);
    }
    lastAnswerFamilies = nextFamilies;
    lastAnswerSessionId = result.sessionId;
    activeSessionId = result.sessionId;
    book = loadAssistantBook();
    renderSessionRail();
  } else {
    pendingCard!.classList.add('assistant-message-error');
    answerNode!.textContent = result.message || '宅仙暂时无法回答。';
    appendSourceLabels(pendingCard!, result);
    if (result.sessionId) book = loadAssistantBook();
    renderSessionRail();
  }
}

async function submitQuestion(): Promise<void> {
  if (!overlay || requestActive) return;
  const input = overlay.querySelector<HTMLTextAreaElement>('[data-assistant-input]');
  const messages = overlay.querySelector<HTMLElement>('[data-assistant-messages]');
  if (!input || !messages) return;
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  const tableName = overlay.querySelector<HTMLInputElement>('[data-assistant-table-name]')?.value.trim() || '';
  const tableBox = overlay.querySelector<HTMLInputElement>('[data-assistant-table-name]');
  if (tableBox) tableBox.value = '';
  input.value = '';
  await askQuestion(text, activeSessionId, tableName ? [tableName] : []);
}

/** 截断会话到指定消息下标并落库；失败返回 false。 */
async function truncateSessionAt(sessionId: string, fromIndex: number): Promise<boolean> {
  const next = truncateAssistantSession(book, sessionId, fromIndex);
  if (next === book) return false;
  if (!await saveAssistantBook(next)) return false;
  book = next;
  renderConversation();
  return true;
}

/** 重新回答：截断到该回答前的用户提问，再以同一问题重跑。 */
async function reanswerMessage(messageId: string): Promise<void> {
  if (requestActive) return;
  const session = currentSession();
  if (!session) return;
  const idx = session.messages.findIndex(message => message.id === messageId);
  if (idx < 0) return;
  let userIdx = idx;
  while (userIdx >= 0 && session.messages[userIdx].role !== 'user') userIdx -= 1;
  if (userIdx < 0) return;
  const question = session.messages[userIdx].text;
  if (!await truncateSessionAt(session.id, userIdx)) return;
  await askQuestion(question, session.id);
}

/** 重新编辑：截断到该用户提问，把原文放回输入框，发送后以新文本重跑。 */
function editMessage(messageId: string): void {
  if (requestActive) return;
  const session = currentSession();
  if (!session) return;
  const idx = session.messages.findIndex(message => message.id === messageId);
  if (idx < 0) return;
  const message = session.messages[idx];
  if (message.role !== 'user') return;
  void truncateSessionAt(session.id, idx).then(ok => {
    if (!ok || !overlay) return;
    const input = overlay.querySelector<HTMLTextAreaElement>('[data-assistant-input]');
    if (input) { input.value = message.text; input.focus(); }
  });
}

/** 删除单条消息及其之后所有消息。 */
async function deleteMessage(messageId: string): Promise<void> {
  if (requestActive) return;
  const session = currentSession();
  if (!session) return;
  const idx = session.messages.findIndex(message => message.id === messageId);
  if (idx < 0) return;
  // 截断式删除：确认文案必须说明会连带删除之后的所有消息
  if (!await showConfirmDialog({
    title: '删除消息',
    message: `将删除该条消息及其之后的全部消息（共 ${session.messages.length - idx} 条），不可恢复。`,
    okText: '删除',
    danger: true,
  })) return;
  await truncateSessionAt(session.id, idx);
}

function handleClick(event: MouseEvent): void {
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-assistant-action]');
  if (!target || !overlay?.contains(target)) return;
  const action = target.dataset.assistantAction;
  if (action === 'close') closeAssistantPanel();
  else if (action === 'cancel') { cancelActiveRequest(); setBusy(false, ''); }
  else if (action === 'new-session') {
    cancelActiveRequest(); activeSessionId = ''; pendingDeleteId = ''; manualOverride = emptyManualOverride(); resetTopicTracking();
    renderSessionRail(); renderConversation(); refreshSourceControls();
  } else if (action === 'switch-session') {
    cancelActiveRequest(); activeSessionId = target.dataset.sessionId || ''; pendingDeleteId = ''; resetTopicTracking();
    renderSessionRail(); renderConversation();
  } else if (action === 'delete-session') {
    pendingDeleteId = target.dataset.sessionId || ''; renderSessionRail();
  } else if (action === 'cancel-delete') {
    pendingDeleteId = ''; renderSessionRail();
  } else if (action === 'confirm-delete') {
    cancelActiveRequest();
    setBusy(false, '');
    void deleteSession(target.dataset.sessionId || '');
  }
  else if (action === 'toggle-sessions') overlay.querySelector('.assistant-shell')?.classList.toggle('is-rail-open');
  else if (action === 'toggle-streaming') {
    setConfig('assistantStreaming', getConfig().assistantStreaming === false);
    refreshStreamingToggle();
  } else if (action === 'toggle-sources') {
    const panel = overlay.querySelector<HTMLElement>('[data-assistant-source-panel]');
    if (panel) panel.hidden = !panel.hidden;
  } else if (action === 'cycle-source') {
    cycleSource(target.dataset.assistantSourceId || ''); refreshSourceControls();
  } else if (action === 'quick-prompt') {
    const input = overlay.querySelector<HTMLTextAreaElement>('[data-assistant-input]');
    if (input) { input.value = target.dataset.prompt || ''; input.focus(); }
  } else if (action === 'edit-message') {
    editMessage(target.dataset.messageId || '');
  } else if (action === 'reanswer-message') {
    void reanswerMessage(target.dataset.messageId || '');
  } else if (action === 'delete-message') {
    void deleteMessage(target.dataset.messageId || '');
  } else if (action === 'send') void submitQuestion();
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') { closeAssistantPanel(); return; }
  if (event.key === 'Enter' && !event.shiftKey && (event.target as HTMLElement | null)?.matches('[data-assistant-input]')) {
    if (event.isComposing || event.keyCode === 229) return;
    event.preventDefault(); void submitQuestion();
  }
}

function installDrag(button: HTMLButtonElement): void {
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    dragCleanup?.();
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = button.getBoundingClientRect();
    let moved = false;
    const onPointerMove = (move: PointerEvent): void => {
      const left = Math.max(0, Math.min(window.innerWidth - FLOAT_BUTTON_SIZE, rect.left + (move.clientX - startX)));
      const top = Math.max(0, Math.min(window.innerHeight - FLOAT_BUTTON_SIZE, rect.top + (move.clientY - startY)));
      moved ||= Math.abs(move.clientX - startX) + Math.abs(move.clientY - startY) > 4;
      button.style.left = `${left}px`;
      button.style.top = `${top}px`;
    };
    const cleanup = (): void => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
      if (dragCleanup === cleanup) dragCleanup = null;
    };
    const onPointerUp = (): void => {
      if (moved) {
        const left = Number.parseFloat(button.style.left) || 20;
        const top = Number.parseFloat(button.style.top) || 88;
        setConfig('assistantFloatPosition', {
          right: Math.max(0, window.innerWidth - FLOAT_BUTTON_SIZE - left),
          bottom: Math.max(0, window.innerHeight - FLOAT_BUTTON_SIZE - top),
        });
        button.dataset.suppressClick = 'true';
        // 抑制标志只该吃掉本次拖拽尾随的那一次 click；若指针在按钮外释放（或 pointercancel），
        // click 不会派发、标志就永久残留，下一次点击会被误吞成「点了没反应」。
        // click 恒在 pointerup 同一输入管线内、先于零延时定时器派发，定时器只兜底清残留。
        window.setTimeout(() => { delete button.dataset.suppressClick; }, 0);
      }
      cleanup();
    };
    dragCleanup = cleanup;
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
  });
}

export function mountAssistantEntry(): void {
  if (!getConfig().assistantEnabled) { destroyAssistantUI(); return; }
  ensureAssistantStyles();
  if (document.getElementById('assistantFloatButton')) {
    floatButton = document.getElementById('assistantFloatButton') as HTMLButtonElement;
    applyFloatPosition(floatButton, getConfig().assistantFloatPosition);
    syncFloatBusy();
    return;
  }
  const position = getConfig().assistantFloatPosition;
  const button = el('button', 'assistant-float-button', '仙') as HTMLButtonElement;
  button.id = 'assistantFloatButton';
  button.type = 'button';
  button.title = '打开宅仙助手';
  button.setAttribute('aria-label', '打开宅仙助手');
  button.style.width = '44px'; button.style.height = '44px';
  applyFloatPosition(button, viewportSafeFloatPosition(position));
  button.addEventListener('click', () => {
    if (button.dataset.suppressClick === 'true') { delete button.dataset.suppressClick; return; }
    openAssistantPanel();
  });
  installDrag(button);
  document.body.appendChild(button);
  floatButton = button;
}

export function openAssistantPanel(): void {
  if (!getConfig().assistantEnabled) return;
  // 不自动聚焦输入框：移动端 focus 会立刻拉起软键盘盖住半屏聊天，由用户点输入框再拉起
  if (overlay?.isConnected) return;
  ensureAssistantStyles();
  document.getElementById('assistantOverlay')?.remove();
  overlay = el('div', 'panel-overlay assistant-overlay') as HTMLDivElement;
  overlay.id = 'assistantOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', '宅仙只读 AI 助手');
  overlay.append(buildShell());
  overlay.addEventListener('click', handleClick);
  overlay.addEventListener('keydown', handleKeydown);
  document.body.appendChild(overlay);
  syncDarkClass(overlay);
  syncDarkClassMinimal(overlay);
  runtime ||= createAssistantRuntime();
  book = loadAssistantBook();
  activeSessionId = selectRecentSessions(book, 1)[0]?.id || '';
  pendingDeleteId = '';
  manualOverride = emptyManualOverride();
  renderSessionRail();
  renderConversation();
  refreshSourceControls();
  refreshStreamingToggle();
  // 上次关闭面板时仍在后台生成的请求：重建进行中的对话卡片并恢复忙碌态
  if (requestActive) {
    const messages = overlay.querySelector<HTMLElement>('[data-assistant-messages]');
    if (messages) appendPendingConversation(messages);
    setBusy(true, pendingPhase === 'selecting' ? '选择资料中' : '整理回答中');
  }
}

export function closeAssistantPanel(): void {
  // 关闭面板不取消生成：请求在后台继续，完成后由运行时落库；悬浮球 is-busy 提示进行中
  overlay?.removeEventListener('click', handleClick);
  overlay?.removeEventListener('keydown', handleKeydown);
  overlay?.remove();
  overlay = null;
  pendingAnswerCard = null;
  pendingAnswerNode = null;
  pendingTypingLabel = null;
}

export function destroyAssistantUI(): void {
  cancelActiveRequest();
  closeAssistantPanel();
  dragCleanup?.();
  dragCleanup = null;
  floatButton?.remove();
  document.getElementById('assistantFloatButton')?.remove();
  floatButton = null;
  runtime = null;
  removeAssistantStyles();
}

export function invalidateAssistantUIForChatChange(): void {
  runtime?.invalidateForChatChange();
  invalidateAssistantSourceCatalog();
  requestSerial += 1;
  requestActive = false;
  syncFloatBusy();
  pendingAnswerCard = null;
  pendingAnswerNode = null;
  pendingTypingLabel = null;
  pendingQuestionText = '';
  streamedDisplay = '';
  activeSessionId = '';
  pendingDeleteId = '';
  manualOverride = emptyManualOverride();
  resetTopicTracking();
  if (overlay?.isConnected) {
    book = loadAssistantBook();
    activeSessionId = selectRecentSessions(book, 1)[0]?.id || '';
    setBusy(false, '');
    renderSessionRail();
    renderConversation();
    refreshSourceControls();
  }
}
