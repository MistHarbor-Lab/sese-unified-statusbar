// ===== 角色中枢：只读数据模型与容错解析 =====
import { getSheetByName, getCellByHeader, getNsfwGenitalsColumn, type SheetContent } from './data-manager';
import { getCurrentPortraitPath } from './portrait-system';
import { parseBirthday, formatAgeCellText, readCharAgeText } from './birthday';
import { getTodayDateKey, compareDateKey, formatYear } from './calendar-core';

export type CharacterHubKind = 'romance' | 'important';

export interface RecentSexRecord {
  date: string;
  description: string;
  ongoing: boolean;
  /** 仅无法识别格式时保留原文，展示层不得丢弃。 */
  raw?: string;
}

export interface MilestoneEntry {
  /** 'YYYY-MM-DD'，月日补零；无法解析时为 ''。 */
  dateKey: string;
  /** 原始补零年月日，供主题化格式化；raw 条目为 null。 */
  dateParts: { y: string; m: string; d: string } | null;
  description: string;
  /** 新格式【】内精确命中的类别；旧格式条目不设。 */
  category?: MilestoneCategory;
  /** 仅无法识别格式时保留整条原文，展示层不得丢弃。 */
  raw?: string;
}

export const MILESTONE_CATEGORIES = ['初体验', '关系', '状况'] as const;
export type MilestoneCategory = (typeof MILESTONE_CATEGORIES)[number];

export interface PersonalityEntry {
  title?: string;
  meaning?: string;
  guard?: string;
  raw?: string;
}

export interface PersonalityTrait {
  trait?: string;
  detail?: string;
  raw?: string;
}

export interface WarningComparison {
  left: string;
  right: string;
}

export interface PersonalityShift {
  emotion: string;
  interactions: PersonalityEntry[];
  strengthened: PersonalityTrait[];
  weakened: PersonalityTrait[];
  behavior: PersonalityEntry[];
  warnings: string[];
}

export interface IntimacyRecord {
  sexCount: string;
  records: RecentSexRecord[];
}

export interface CharacterHubRecord {
  name: string;
  kind: CharacterHubKind;
  gender: string;
  age: string;
  /** 规范 YYYY-MM-DD；旧库年龄格式（“20岁”）或缺失为 ''。 */
  birthday: string;
  briefIntro: string;
  appearance: string;
  identity: string;
  speechStyle: string;
  attitude: string;
  pastExperience: string;
  recentInteraction: string;
  portraitPath: string | null;
  personality: PersonalityShift | null;
  intimacy: IntimacyRecord | null;
  nsfw: NsfwArchive | null;
  milestones: MilestoneEntry[];
}

export interface ProtagonistRecord {
  name: string;
  gender: string;
  age: string;
  /** 规范 YYYY-MM-DD；旧库年龄格式或缺失为 ''。 */
  birthday: string;
  appearance: string;
  identity: string;
}

/** 读主角信息表 row_id=1 的 5 个静态字段；表缺/行缺/姓名空 → null。不读近况、瑟瑟能量。 */
export function buildProtagonistRecord(): ProtagonistRecord | null {
  const name = String(getCellByHeader('主角信息表', 1, '姓名') || '').trim();
  if (!name) return null;
  return {
    name,
    gender: String(getCellByHeader('主角信息表', 1, '性别') || '').trim(),
    age: readCharAgeText('主角信息表', 1, getTodayDateKey()),
    birthday: parseBirthday(getCellByHeader('主角信息表', 1, '生日')) || '',
    appearance: String(getCellByHeader('主角信息表', 1, '外貌特征') || '').trim(),
    identity: String(getCellByHeader('主角信息表', 1, '身份背景') || '').trim(),
  };
}

function emptyRecord(row: Partial<CharacterHubRecord>): CharacterHubRecord {
  return {
    name: String(row.name || '').trim(),
    kind: row.kind === 'romance' ? 'romance' : 'important',
    gender: row.gender || '', age: row.age || '', birthday: row.birthday || '', briefIntro: row.briefIntro || '',
    appearance: row.appearance || '', identity: row.identity || '', speechStyle: row.speechStyle || '',
    attitude: row.attitude || '',
    pastExperience: row.pastExperience || '', recentInteraction: row.recentInteraction || '',
    portraitPath: row.portraitPath || null, personality: row.personality || null, intimacy: row.intimacy || null,
    nsfw: row.nsfw ?? null,
    milestones: row.milestones || [],
  };
}

/** 恋爱对象优先；空姓名不进入目录。纯函数，便于测试与复用。 */
export function mergeCharacterRows(
  romance: Partial<CharacterHubRecord>[],
  important: Partial<CharacterHubRecord>[],
): CharacterHubRecord[] {
  const out: CharacterHubRecord[] = [];
  const names = new Set<string>();
  for (const source of [romance, important]) {
    for (const row of source) {
      const record = emptyRecord(row);
      if (!record.name || names.has(record.name)) continue;
      names.add(record.name);
      out.push(record);
    }
  }
  return out;
}

function stripOrdinal(value: string): string {
  return value.trim().replace(/^(?:\d+[.、）)]|[-•])\s*/, '').trim();
}

function splitEntries(value: string): string[] {
  return String(value || '')
    .split(/(?:\r?\n|[；;]|。(?=\s*\d+[.、）)]))/)
    .map(stripOrdinal)
    .filter(Boolean);
}

function parseBehaviorEntry(value: string): PersonalityEntry {
  const source = stripOrdinal(value);
  const formula = source.match(/^([^=|：:]+?)\s*=\s*([^|]+?)(?:\s*\|\s*(.+))?$/);
  if (!formula) return { raw: source };
  return {
    title: formula[1].trim(),
    meaning: formula[2].trim(),
    ...(formula[3]?.trim() ? { guard: formula[3].trim() } : {}),
  };
}

function parseTraits(value: string): PersonalityTrait[] {
  return splitEntries(value).map(entry => {
    const m = entry.match(/^([^:：]+?)\s*[:：]\s*(.+)$/);
    return m ? { trait: m[1].trim(), detail: m[2].trim() } : { raw: entry };
  });
}

/** 仅按模板分号与首个冒号拆分（旧「人际关系」列遗留数据兼容读取已随该列一并移除 V3.1.0）。 */

/** `≠` 是不等同边界；任一侧为空时不强行结构化。 */
export function parseWarningComparison(raw: string): WarningComparison | null {
  const source = String(raw || '');
  const separator = source.indexOf('≠');
  if (separator < 0) return null;
  const left = source.slice(0, separator).trim();
  const right = source.slice(separator + 1).trim();
  return left && right ? { left, right } : null;
}

/**
 * 只按模板已有格式做展示拆分；未知片段完整保留为 raw，绝不臆测。
 * 警示项来自 `【禁止臆测】` 段：一个标记后可跟多条 `；;` 分隔的警示（数据库常把
 * 多条警示用分号串在一行）。必须取整段再按分号拆条，否则 `≠` 等靠后的警示会被
 * 第一个分号截断而丢失。警示段遇到换行即结束，其后文本回归行为正文。
 */
export function parsePersonalityShift(row: Record<string, string>): PersonalityShift {
  const behaviorSource = String(row['行为模式变化'] || '');
  const markerSplit = behaviorSource.split(/【禁止臆测】/);
  let behaviorText = markerSplit[0];
  const warnings: string[] = [];
  for (const part of markerSplit.slice(1)) {
    const newlineEnd = part.indexOf('\n');
    const section = newlineEnd < 0 ? part : part.slice(0, newlineEnd);
    const tail = newlineEnd < 0 ? '' : part.slice(newlineEnd + 1);
    for (const item of section.split(/[；;]/)) {
      const trimmed = item.trim().replace(/^[:：]/, '').trim();
      if (trimmed) warnings.push(trimmed);
    }
    if (tail) behaviorText += tail;
  }
  return {
    emotion: String(row['近期情绪状态'] || '').trim(),
    interactions: splitEntries(row['对主角的交互逻辑'] || '').map(parseBehaviorEntry),
    strengthened: parseTraits(row['被强化的性格侧面'] || ''),
    weakened: parseTraits(row['被弱化的性格侧面'] || ''),
    behavior: splitEntries(behaviorText).map(parseBehaviorEntry),
    warnings,
  };
}

/** 新格式为 日期/描述；兼容旧的 对象/日期/描述，最多展示两条。 */
export function parseRecentSexRecords(raw: string): RecentSexRecord[] {
  const parts = String(raw || '').split(/[；;]/).map(v => v.trim()).filter(Boolean).slice(0, 2);
  return parts.map(part => {
    const ongoing = /[（(]未结束[）)]/.test(part);
    const clean = part.replace(/\s*[（(]未结束[）)]\s*/g, '').trim();
    const modern = clean.match(/^(-?\d{1,6}-\d{1,2}-\d{1,2})\s*\/\s*(.+)$/);
    if (modern) return { date: modern[1], description: modern[2].trim(), ongoing };
    const legacy = clean.match(/^[^/]+\/\s*(-?\d{1,6}-\d{1,2}-\d{1,2})\s*\/\s*(.+)$/);
    if (legacy) return { date: legacy[1], description: legacy[2].trim(), ongoing };
    return { date: '', description: part, ongoing, raw: part };
  });
}

/** 模板格式 `YYYY-MM-DD：【初体验/关系/状况】描述`；按「；;」拆条。拆不动的整条进 raw，绝不丢弃；不排序、不去重、不校验日期合法性。
 *  旧格式 `：（描述）` 无类别，category 不设，向后兼容。 */
export function parseMilestoneEvents(raw: string): MilestoneEntry[] {
  return String(raw || '')
    .split(/[；;\r\n]+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const m = part.match(/^(-?\d{1,6})-(\d{1,2})-(\d{1,2})\s*[：:]\s*(.+)$/);
      if (!m) return { dateKey: '', dateParts: null, description: part, raw: part };
      // U32：拼装收编 formatDateKey（口径一致）；y/mo/d 变量继续供 dateParts 使用
      const y = formatYear(parseInt(m[1], 10));
      const mo = m[2].padStart(2, '0');
      const d = m[3].padStart(2, '0');
      let description = m[4].trim();
      let category: MilestoneCategory | undefined;
      const catMatch = description.match(/^[【\[]([^】\]]+)[】\]]\s*/);
      if (catMatch) {
        const word = catMatch[1].trim();
        if ((MILESTONE_CATEGORIES as readonly string[]).includes(word)) {
          category = word as MilestoneCategory;
          description = description.slice(catMatch[0].length).trim();
        }
      }
      const open = description.match(/^（/), close = description.match(/）$/);
      if ((open && close) || (/^\(/.test(description) && /\)$/.test(description))) {
        description = description.slice(1, -1).trim();
      }
      const entry: MilestoneEntry = { dateKey: `${y}-${mo}-${d}`, dateParts: { y, m: mo, d }, description };
      if (category) entry.category = category;
      return entry;
    });
}

/**
 * 删除第 index 条里程碑事件：按模板分隔符拆回原文片段、去掉目标片段后以「；」重连。
 * 未删除的片段逐字保留（不重新序列化，避免丢失半角冒号/括号等原始格式）。
 * index 越界或空原文时返回原串不变。
 */
export function removeMilestoneEvent(raw: string, index: number): string {
  const parts = String(raw || '').split(/[；;\r\n]+/).map(part => part.trim()).filter(Boolean);
  if (!Number.isInteger(index) || index < 0 || index >= parts.length) return String(raw || '');
  parts.splice(index, 1);
  return parts.join('；');
}

export interface BodyVitals {
  heightCm?: string;
  weightKg?: string;
  heightWeightDesc?: string;
  rawHeightWeight?: string;
}

export interface BodyMeasurements {
  bust?: string;
  cup?: string;
  waist?: string;
  hip?: string;
  measurementsDesc?: string;
  rawMeasurements?: string;
}

/** 身高/体重："165cm / 52kg,(体感描述)"。只按模板格式拆，未命中整串进 rawHeightWeight。 */
export function parseBodyVitals(raw: string): BodyVitals | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{2,3})\s*cm\s*[/／]\s*(\d{2,3})\s*kg\s*[，,]?\s*(.*)$/i);
  if (!m) return { rawHeightWeight: s };
  const desc = m[3].trim().replace(/^[（(]/, '').replace(/[)）]$/, '').trim();
  return { heightCm: m[1], weightKg: m[2], heightWeightDesc: desc || undefined };
}

/** 三围/罩杯："B86(D杯)-W58-H88,(视觉描述)"。只按模板格式拆，未命中整串进 rawMeasurements。 */
export function parseBodyMeasurements(raw: string): BodyMeasurements | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(/^B\s*(\d{2,3})\s*[（(]\s*([^)）]+?)\s*[)）]\s*-\s*W\s*(\d{2,3})\s*-\s*H\s*(\d{2,3})\s*[，,]?\s*(.*)$/i);
  if (!m) return { rawMeasurements: s };
  const desc = m[5].trim().replace(/^[（(]/, '').replace(/[)）]$/, '').trim();
  return { bust: m[1], cup: m[2].trim(), waist: m[3], hip: m[4], measurementsDesc: desc || undefined };
}

export interface NsfwArchive {
  vitals: BodyVitals | null;
  measurements: BodyMeasurements | null;
  bodyFeatures: string;
  eroticDisposition: string;
  experienceLevel: string;
  genitalsStatus: string;
  analStatus: string;
  lactationStatus: string;
  voiceStyle: string;
  trainingValue: number | null;
  addressProtagonist: string;
}

/** 从 NSFW信息表 一行解析完整档案；genitalsCol 为已解析的下体列名（由调用方走 getNsfwGenitalsColumn）。 */
export function parseNsfwArchive(row: Record<string, string>, genitalsCol: string): NsfwArchive {
  const tvRaw = String(row['调教值'] ?? '').trim();
  let trainingValue: number | null = null;
  if (tvRaw && /^\d+$/.test(tvRaw)) {
    const n = parseInt(tvRaw, 10);
    if (n >= 0 && n <= 1000) trainingValue = n;
  }
  return {
    vitals: parseBodyVitals(row['身高/体重'] || ''),
    measurements: parseBodyMeasurements(row['三围/罩杯'] || ''),
    bodyFeatures: String(row['身材与特异性征'] || '').trim(),
    eroticDisposition: String(row['性爱接受度和XP倾向'] || '').trim(),
    experienceLevel: String(row['性经验程度'] || '').trim(),
    genitalsStatus: String(row[genitalsCol] || '').trim(),
    analStatus: String(row['后庭状态'] || '').trim(),
    lactationStatus: String(row['泌乳/体液状态'] || '').trim(),
    voiceStyle: String(row['床上淫语风格'] || '').trim(),
    trainingValue,
    addressProtagonist: String(row['对主角的称呼'] || '').trim(),
  };
}

function tableRows(sheet: SheetContent | null): Array<Record<string, string>> {
  if (!sheet?.content?.length) return [];
  const headers = sheet.content[0].map(v => String(v || '').trim());
  return sheet.content.slice(1).map(cells => Object.fromEntries(headers.map((header, index) => [header, String(cells[index] || '')])));
}

/** 重要角色表 + 恋爱对象表全部姓名（Set 去重，重要角色表在前）。供大采访候选人物名单等复用。 */
export function collectAllCharacterNames(): string[] {
  const names = new Set<string>();
  for (const table of ['重要角色表', '恋爱对象表']) {
    for (const row of tableRows(getSheetByName(table))) {
      const name = String(row['姓名'] || '').trim();
      if (name) names.add(name);
    }
  }
  return Array.from(names);
}

function toCharacter(row: Record<string, string>, kind: CharacterHubKind, todayKey: string | null): CharacterHubRecord {
  const name = String(row['姓名'] || '').trim();
  // 年龄：生日列按当前游戏日期推算周岁；旧库/残留旧值（“20岁”）原样透传
  const birthdayRaw = String(row['生日'] || '').trim();
  const birthday = parseBirthday(birthdayRaw) || '';
  const age = birthday ? formatAgeCellText(birthday, todayKey) : formatAgeCellText(birthdayRaw || String(row['年龄'] || ''), todayKey);
  return emptyRecord({
    name, kind,
    gender: row['性别'] || '', age, birthday,
    briefIntro: row['一句话介绍'] || '',
    appearance: row['外貌特征'] || '', identity: row['身份'] || '', speechStyle: row['语言风格和口癖'] || '',
    attitude: row['对主角态度'] || '',
    pastExperience: row['过往经历'] || '', recentInteraction: row['最近亲密互动'] || '',
    portraitPath: name ? getCurrentPortraitPath(name) : null,
  });
}

/** 打开角色中枢时调用；不读取主角和即时人物表。 */
export function buildCharacterHubRoster(): CharacterHubRecord[] {
  const todayKey = getTodayDateKey();
  const romance = tableRows(getSheetByName('恋爱对象表')).map(row => toCharacter(row, 'romance', todayKey));
  const important = tableRows(getSheetByName('重要角色表')).map(row => toCharacter(row, 'important', todayKey));
  const personalityByName = new Map(tableRows(getSheetByName('人物性格偏移表')).map(row => [String(row['姓名'] || '').trim(), row]));
  const intimacyByName = new Map(tableRows(getSheetByName('NSFW信息表')).map(row => [String(row['姓名'] || '').trim(), row]));
  const milestonesByName = new Map(tableRows(getSheetByName('角色里程碑表')).map(row => [String(row['姓名'] || '').trim(), row]));
  const genitalsCol = getNsfwGenitalsColumn();
  return mergeCharacterRows(romance, important).map(record => {
    const personalityRow = personalityByName.get(record.name);
    const intimacyRow = intimacyByName.get(record.name);
    const sexCount = String(intimacyRow?.['性爱次数'] || '').trim();
    const recentSex = String(intimacyRow?.['最近性行为'] || '').trim();
    return {
      ...record,
      personality: personalityRow ? parsePersonalityShift(personalityRow) : null,
      intimacy: sexCount || recentSex ? { sexCount, records: parseRecentSexRecords(recentSex) } : null,
      nsfw: intimacyRow ? parseNsfwArchive(intimacyRow, genitalsCol) : null,
      milestones: parseMilestoneEvents(String(milestonesByName.get(record.name)?.['里程碑事件'] || '')),
    };
  });
}

// ===== 故事编年史：全员里程碑聚合（纯函数，零模板改动） =====

export interface ChronicleEvent {
  name: string;
  kind: CharacterHubKind;
  description: string;
  /** 'YYYY-MM-DD'；无法解析日期的条目为 ''。 */
  dateKey: string;
  dateParts: { y: string; m: string; d: string } | null;
  category?: MilestoneCategory;
  /** 仅无法识别格式时保留整条原文，展示层不得丢弃。 */
  raw?: string;
}

export interface ChronicleDay {
  dateKey: string;
  dateParts: { y: string; m: string; d: string };
  /** 同日各角色的事件，按名册顺序（恋爱对象优先）保持。 */
  events: ChronicleEvent[];
}

export interface StoryChronicle {
  /** 按日期键升序。 */
  days: ChronicleDay[];
  /** 无日期的 raw 条目，保持名册顺序，不参与时间轴。 */
  undated: ChronicleEvent[];
  /** 至少有一条里程碑的角色数。 */
  characterCount: number;
  eventCount: number;
  /** 首末日期差（天）；有效日期不足两个时为 0。 */
  spanDays: number;
}

function utcDays(keyA: string, keyB: string): number {
  const parse = (key: string): number | null => {
    const m = /^(-?\d{1,6})-(\d{2})-(\d{2})$/.exec(key);
    if (!m) return null;
    // Date.UTC 对 0-99 年会补 1900：整体垫 400 年再减掉（400 年整完一个闰周期，日历完全一致）
    const year = Number(m[1]);
    return (Date.UTC(year + 400, Number(m[2]) - 1, Number(m[3])) - Date.UTC(400, 0, 1)) / 86_400_000;
  };
  const a = parse(keyA);
  const b = parse(keyB);
  if (a === null || b === null) return 0;
  return Math.abs(b - a);
}

/** 打开角色中枢时由展示层调用：把全员里程碑按日期归并成编年史，不读表（入参即名册）。 */
export function buildStoryChronicle(records: CharacterHubRecord[]): StoryChronicle {
  const byDate = new Map<string, ChronicleDay>();
  const undated: ChronicleEvent[] = [];
  const names = new Set<string>();
  let minKey = '';
  let maxKey = '';
  let eventCount = 0;
  for (const record of records) {
    for (const entry of record.milestones) {
      eventCount++;
      names.add(record.name);
      const event: ChronicleEvent = {
        name: record.name,
        kind: record.kind,
        description: entry.description,
        dateKey: entry.dateKey,
        dateParts: entry.dateParts,
        ...(entry.category ? { category: entry.category } : {}),
        ...(entry.raw ? { raw: entry.raw } : {}),
      };
      if (!entry.dateParts) { undated.push(event); continue; }
      let day = byDate.get(entry.dateKey);
      if (!day) {
        day = { dateKey: entry.dateKey, dateParts: entry.dateParts, events: [] };
        byDate.set(entry.dateKey, day);
      }
      day.events.push(event);
      // F10：负年份（公元前）不能用字符串字典序比较（"-0501" 会被排到 "-0500" 之后），
      // 必须数值比较——与 calendar-core:compareDateKey 同源（其注释即为此坑）。
      if (!minKey || compareDateKey(entry.dateKey, minKey) < 0) minKey = entry.dateKey;
      if (!maxKey || compareDateKey(entry.dateKey, maxKey) > 0) maxKey = entry.dateKey;
    }
  }
  const days = [...byDate.values()].sort((a, b) => compareDateKey(a.dateKey, b.dateKey));
  return { days, undated, characterCount: names.size, eventCount, spanDays: days.length > 1 ? utcDays(minKey, maxKey) : 0 };
}
