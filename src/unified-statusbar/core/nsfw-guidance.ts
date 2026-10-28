import { getTavernHelper } from './env';
// ===== 瑟瑟指导 =====
// 按需读取输入、玩法、地图、角色世界书、Persona 与 AI 历史，生成行动框架并回填输入框。
// 模块顶层无 DOM 操作、无轮询；所有 I/O 仅在用户点击按钮后发生。

import { getConfig } from './config-store';
import { readSelectedPlays } from './play-state-store';
import { getCellByHeader, getSheetByName, sendMessageToChat } from './data-manager';
import { getCustomApiConfig, validateCustomApiConfig, withTextAiRetry, isAiAbortError, type TextAiContext } from './api-config';
import { playTypes } from './constants';
import { getJailbreakHeadPrompts, getJailbreakTailPrompts } from './jailbreak-config';
import { deriveNodeId, parseLocationHierarchy, readMapNode } from './map-tree-store';
import { stripWithContextConfig } from './context-strip';
import { getPlayData, isManagedPlayEntry } from './play-worldbook';
import { buildNsfwGuidanceUserInput, NSFW_GUIDANCE_SYSTEM_PROMPT } from './nsfw-guidance-prompts';
import { wbEntryName, wbEntryKeysMatchAny, wbEntryMatchedKeywords } from './worldbook-entry';
import { captureChatScope } from './story-floor-store';

export interface SelectedNsfwGuidancePlay {
  category: string;
  name: string;
}

interface MatchedWorldbookEntry {
  worldbook: string;
  comment: string;
  content: string;
  locationHits: string[];
  characterHits: string[];
}

let _isGenerating = false;


export function isNsfwGuidanceGenerating(): boolean {
  return _isGenerating;
}

export function getNsfwGuidanceInputText(): string {
  try {
    const input = (window.parent as any).document?.getElementById('send_textarea') as HTMLTextAreaElement | null;
    return String(input?.value || '').trim();
  } catch (_e) {
    return '';
  }
}

export function getSelectedNsfwGuidancePlays(): SelectedNsfwGuidancePlay[] {
  const labels = new Map(playTypes.map(type => [type.key, type.label]));
  return readSelectedPlays().map(play => ({
    category: labels.get(play.category) || play.category,
    name: play.name,
  }));
}

function getCurrentLocation(): string {
  return String(
    getCellByHeader('全局数据表', 1, '当前详细地点')
      || getCellByHeader('全局数据表', 1, '当前位置')
      || '',
  ).trim();
}

async function getCurrentMapDescription(location: string): Promise<string> {
  if (!location) return '';
  try {
    const parsed = parseLocationHierarchy(location);
    if (!parsed.fullPath) return '';
    const node = await readMapNode(deriveNodeId(parsed.fullPath));
    if (!node) return '';
    const desc = node.explorationDesc;
    const parts: string[] = [];
    if (desc?.summary) parts.push(`介绍：${desc.summary}`);
    if (Array.isArray(desc?.items) && desc.items.length > 0) parts.push(`物品与陈设：${desc.items.join('、')}`);
    if (desc?.directions) parts.push(`方位：${desc.directions}`);
    return parts.join('\n');
  } catch (e) {
    console.warn('[瑟瑟指导] 读取地图库描述失败:', e);
    return '';
  }
}

function collectTableNames(tableName: string): string[] {
  const sheet = getSheetByName(tableName);
  if (!sheet || !Array.isArray(sheet.content) || sheet.content.length < 2) return [];
  const nameIndex = sheet.content[0].indexOf('姓名');
  if (nameIndex < 0) return [];
  const names: string[] = [];
  for (let i = 1; i < sheet.content.length; i++) {
    const name = String(sheet.content[i]?.[nameIndex] || '').trim();
    if (name) names.push(name);
  }
  return names;
}

function getRecentAiOutputs(maxTurns: number): string[] {
  const limit = Math.max(1, Math.floor(maxTurns));
  const th = getTavernHelper();
  if (th && typeof th.getChatMessages === 'function' && typeof th.getLastMessageId === 'function') {
    try {
      const lastId = th.getLastMessageId();
      if (typeof lastId === 'number' && lastId >= 0) {
        const outputs: string[] = [];
        const batchSize = Math.max(20, limit * 3);
        let endId = lastId;
        while (endId >= 0 && outputs.length < limit) {
          const startId = Math.max(0, endId - batchSize + 1);
          const messages = th.getChatMessages(startId + '-' + endId, {
            role: 'assistant',
            hide_state: 'all',
            include_swipes: false,
          }) as any[];
          if (Array.isArray(messages)) {
            for (let i = messages.length - 1; i >= 0 && outputs.length < limit; i--) {
              const text = String(messages[i]?.message || '').trim();
              if (text) outputs.push(text);
            }
          }
          if (startId === 0) break;
          endId = startId - 1;
        }
        if (outputs.length > 0) return outputs.reverse();
      }
    } catch (e) {
      console.warn('[瑟瑟指导] getChatMessages 调用失败，回退到 SillyTavern.chat:', e);
    }
  }

  try {
    const chat = (typeof parent !== 'undefined' && (parent as any).SillyTavern?.chat)
      ? (parent as any).SillyTavern.chat as any[]
      : (window as any).SillyTavern?.chat as any[] | undefined;
    if (!Array.isArray(chat)) return [];
    const outputs: string[] = [];
    for (let i = chat.length - 1; i >= 0 && outputs.length < limit; i--) {
      const message = chat[i];
      if (!message || message.is_user || message.is_system || message.extra?.api === 'nomes') continue;
      const text = String(message.mes || '').trim();
      if (text) outputs.push(text);
    }
    return outputs.reverse();
  } catch (_e) {
    return [];
  }
}

function formatAiContext(outputs: string[]): string {
  return outputs.map(text => 'AI：' + text).join('\n\n');
}

function collectRelatedCharacters(originalInput: string, lastAiOutput: string): string[] {
  const candidates = new Set<string>([
    ...collectTableNames('重要角色表'),
    ...collectTableNames('恋爱对象表'),
  ]);
  const related = new Set<string>();
  const matchText = `${lastAiOutput}\n${originalInput}`;
  for (const name of candidates) {
    if (matchText.includes(name)) related.add(name);
  }
  for (const name of collectTableNames('在场角色表')) related.add(name);
  return Array.from(related);
}

function getLocationKeywords(location: string): string[] {
  const segments = parseLocationHierarchy(location).segments;
  return segments.slice(Math.max(0, segments.length - 2));
}

async function loadCharacterWorldbooks(th: any): Promise<Array<{ name: string; entries: any[] }>> {
  try {
    const bound = th.getCharWorldbookNames?.('current');
    const names = new Set<string>();
    if (bound?.primary) names.add(String(bound.primary));
    if (Array.isArray(bound?.additional)) {
      for (const name of bound.additional) if (name) names.add(String(name));
    }
    const loaded = await Promise.all(Array.from(names).map(async name => {
      try {
        const entries = await th.getWorldbook(name);
        return { name, entries: Array.isArray(entries) ? entries : [] };
      } catch (e) {
        console.warn('[瑟瑟指导] 读取角色绑定世界书失败:', name, e);
        return { name, entries: [] };
      }
    }));
    return loaded;
  } catch (e) {
    console.warn('[瑟瑟指导] 获取角色绑定世界书失败:', e);
    return [];
  }
}

function matchWorldbookEntries(
  books: Array<{ name: string; entries: any[] }>,
  locationKeywords: string[],
  characterKeywords: string[],
  maxEntries: number,
): MatchedWorldbookEntry[] {
  const matched: MatchedWorldbookEntry[] = [];
  const seen = new Set<string>();
  // 地点关键词搜索用「末两段拼串」做双向子串（如 B家-C房间），名字搜索仍按末两段逐段。
  const joinedLoc = locationKeywords.join('-');
  for (const book of books) {
    for (const entry of book.entries) {
      const comment = wbEntryName(entry);
      if (!comment || comment.startsWith('UBS-地图-') || comment.startsWith('__map_')) continue;
      // 排除 play-worldbook 按选注入的聚合玩法/物品使用条目（已进提示词，勿重复计入地点/角色匹配）。
      if (isManagedPlayEntry(comment)) continue;
      // 地点：条目名含末两段任一段（逐段），或触发关键词与末两段拼串双向子串命中。
      const locNameHits = locationKeywords.filter(seg => comment.includes(seg));
      const locKeyHit = joinedLoc !== '' && wbEntryKeysMatchAny(entry, [joinedLoc]);
      const locationHits = locNameHits.length > 0 ? locNameHits : (locKeyHit ? [joinedLoc] : []);
      // 角色：条目名或触发关键词含任一角色名（角色非路径，逐名双向子串）。
      const characterHits = wbEntryMatchedKeywords(entry, characterKeywords);
      if (locationHits.length === 0 && characterHits.length === 0) continue;
      const content = String(entry?.content || '').trim();
      const identity = `${book.name}\u0000${comment}\u0000${content}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      matched.push({ worldbook: book.name, comment, content, locationHits, characterHits });
      if (matched.length >= maxEntries) return matched;
    }
  }
  return matched;
}

function formatMatchedWorldbooks(entries: MatchedWorldbookEntry[]): string {
  return entries.map(entry => {
    const labels: string[] = [];
    if (entry.locationHits.length > 0) labels.push(`地点：${entry.locationHits.join('、')}`);
    if (entry.characterHits.length > 0) labels.push(`角色：${entry.characterHits.join('、')}`);
    return `【${entry.comment}｜${labels.join('；')}】\n${entry.content}`;
  }).join('\n\n');
}

function getItemsText(): string {
  if (!getConfig().itemUseEnabled) return '';
  const sheet = getSheetByName('物品表');
  if (!sheet || !Array.isArray(sheet.content) || sheet.content.length < 2) return '';
  const headers = sheet.content[0];
  const nameIndex = headers.indexOf('物品名称');
  const descIndex = headers.indexOf('描述');
  if (nameIndex < 0) return '';
  const lines: string[] = [];
  for (let i = 1; i < sheet.content.length; i++) {
    const name = String(sheet.content[i]?.[nameIndex] || '').trim();
    if (!name) continue;
    const desc = descIndex >= 0 ? String(sheet.content[i]?.[descIndex] || '').trim() : '';
    lines.push(desc ? `- ${name}：${desc}` : `- ${name}`);
  }
  return lines.join('\n');
}

function getPlayGuidanceText(plays: SelectedNsfwGuidancePlay[]): string {
  if (plays.length === 0) return '';
  // 玩法正文来自内联精简数据（__ub_play_data.plays，键为干净玩法名，无「玩法-」前缀），
  // 不再读全局「玩法大全」世界书（已改为按选注入角色卡 WB）。
  const data = getPlayData();
  const byName = data ? new Map(data.plays.map(p => [p.name, String(p.content || '').trim()])) : null;
  return plays.map(play => {
    const content = byName?.get(play.name) || '';
    return content
      ? `【${play.category}：${play.name}】\n${content}`
      : `【${play.category}：${play.name}】`;
  }).join('\n\n');
}

function normalizeOutput(raw: string): string {
  let text = String(raw || '').trim();
  const fenced = text.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  if (fenced) text = fenced[1].trim();
  text = text.replace(/^(?:扩充后的用户输入|行动框架|骨架|输出内容|输出)\s*[：:]\s*/i, '').trim();
  return text;
}

export async function performNsfwGuidance(originalInput: string, plays: SelectedNsfwGuidancePlay[], extraPrompt?: string): Promise<string | null> {
  if (_isGenerating) throw new Error('瑟瑟指导正在生成中，请稍候');
  const input = String(originalInput || '').trim();
  if (!input) throw new Error('请先在输入框中写下本次行动');

  const th = getTavernHelper();
  if (!th || typeof th.generateRaw !== 'function') throw new Error('无法访问 generateRaw 函数');
  const apiError = validateCustomApiConfig('nsfwGuidance');
  if (apiError) throw new Error(apiError);

  // 聊天归属守卫：结果返回后要覆盖当前聊天的输入框；请求期间切聊天 → 整体丢弃。
  const scope = captureChatScope('瑟瑟指导');

  _isGenerating = true;
  try {
    const config = getConfig();
    const contextCount = Math.max(1, Math.min(20, Math.floor(config.nsfwGuidanceContextCount || 2)));
    const maxChars = Number.isFinite(config.nsfwGuidanceMaxChars) && config.nsfwGuidanceMaxChars > 0
      ? Math.floor(config.nsfwGuidanceMaxChars)
      : 200;
    const maxWorldbookEntries = Math.max(1, Math.min(50, Math.floor(config.nsfwGuidanceMaxWorldbookEntries || 20)));
    const location = getCurrentLocation();
    const recentAiOutputs = getRecentAiOutputs(contextCount);
    const cleanContext = stripWithContextConfig(formatAiContext(recentAiOutputs));
    const lastAiOutput = stripWithContextConfig(recentAiOutputs[recentAiOutputs.length - 1] || '');
    const relatedCharacters = collectRelatedCharacters(input, lastAiOutput);
    const locationKeywords = getLocationKeywords(location);

    const [mapDescription, characterWorldbooks, playsText] = await Promise.all([
      getCurrentMapDescription(location),
      loadCharacterWorldbooks(th),
      Promise.resolve(getPlayGuidanceText(plays)),
    ]);
    const matchedEntries = matchWorldbookEntries(
      characterWorldbooks,
      locationKeywords,
      relatedCharacters,
      maxWorldbookEntries,
    );
    const userInput = buildNsfwGuidanceUserInput({
      location,
      mapDescription,
      matchedWorldbookText: formatMatchedWorldbooks(matchedEntries),
      relatedCharacters,
      itemsText: getItemsText(),
      playsText,
      context: cleanContext,
      originalInput: input,
      extraPrompt,
      maxChars,
    });

    const result = await withTextAiRetry('nsfwGuidance', (ctx: TextAiContext) => th.generateRaw({
      should_silence: true,
      generation_id: ctx.generationId,
      user_input: userInput,
      ordered_prompts: [
        ...getJailbreakHeadPrompts({ antiCliche: true, task: NSFW_GUIDANCE_SYSTEM_PROMPT }),
        'persona_description',
        'user_input',
        ...getJailbreakTailPrompts(),
      ],
      custom_api: getCustomApiConfig('nsfwGuidance'),
    }), { feature: 'nsfwGuidance' });
    if (typeof result !== 'string') throw new Error('模型未返回可用文本');
    const output = normalizeOutput(result);
    if (!output) throw new Error('模型返回内容为空');
    // 聊天归属守卫（写前核对）：切走后不覆盖新聊天的输入框，静默丢弃。
    if (!scope.isCurrent()) return null;
    // 用户已明确要求：请求期间即使输入框发生变化，结果返回后仍强制覆盖。
    sendMessageToChat(output);
    return output;
  } catch (error) {
    // 聊天已切换：旧聊天的失败也不该在新聊天弹错误。
    if (!scope.isCurrent()) return null;
    if (isAiAbortError(error)) return null; // 用户终止：静默收口
    throw error;
  } finally {
    _isGenerating = false;
  }
}
