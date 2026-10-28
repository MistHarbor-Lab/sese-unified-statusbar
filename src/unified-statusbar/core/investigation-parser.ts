// ===== 大调查文本解析器 =====
// 将 AI 生成的【字段名】格式文本解析为结构化数据

import { escapeHtml } from './html-escape'; // U2：转义统一出口

/** 评分字段 */
export interface ScoreValue {
  score: number;
  desc: string;
}

/** 性伴名单条目 */
export interface PartnerEntry {
  name: string;
  identity: string;
  relationship: string;
  forced: string;
  percentage: string;
}

/** 饼图数据项 */
export interface PieItem {
  name: string;
  pct: number;
}

/** 解析后的大调查结构化数据 */
export interface InvestigationData {
  name: string;
  sex: string;
  age: string;
  description: string;
  body: string;
  dailyClothes: string;
  privateClothes: string;
  makeup: string;
  orientation: string;
  coreFetishes: string[];
  shameIndex: ScoreValue | null;
  confidenceIndex: ScoreValue | null;
  opennessIndex: ScoreValue | null;
  isVirgin: string;
  defloration: string;
  purityScore: string;
  purityDetails: string;
  sexCount: string;
  partnerCount: string;
  /** 性爱对象男女比原文（如「男19，女18」）；旧档案/AI 未输出时为空 */
  partnerGenderRatio: string;
  partnerList: PartnerEntry[];
  frequency: string;
  positions: string;
  locations: string;
  positionItems: PieItem[];
  locationItems: PieItem[];
  pregnancy: string;
  pregnancyDetails: string;
  impregnate: string;
  impregnateDetails: string;
  devMouth: string;
  devHand: string;
  devFoot: string;
  devBreast: string;
  devPenis: string;
  devVagina: string;
  devAnal: string;
  mastCount: string;
  mastFreq: string;
  mastFirst: string;
  mastWay: string;
  firstExp: string;
  lastExp: string;
  bestExp: string;
  charmTypes: string[];
  pornTags: string[];
  globalRank: string;
  grade: string;
  rankAdvantages: string;
  rankDisadvantages: string;
  bestPart: string;
  voice: string;
  reviews: string;
  protagonistNote: string;
  characterSelfNote: string;
}

// ===== 工具函数 =====

/** 按【分割字段，返回 {字段名: 内容} 映射 */
function splitFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  // 先规范化换行
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // 按【分割（全角左方括号）
  const blocks = normalized.split('【');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const sepIdx = block.indexOf('】');
    if (sepIdx === -1) continue;
    const key = block.substring(0, sepIdx).trim();
    let value = block.substring(sepIdx + 1).trim();
    // 清理末尾可能残留的空格和特殊字符
    value = value.replace(/\s+$/g, '');
    if (key && value) {
      fields[key] = value;
    }
  }
  return fields;
}

/** 提取字段值（支持多别名） */
function getField(fields: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (fields[k]) return fields[k];
  }
  return '';
}

/** 解析评分字段：XX/100 —— 说明 */
function parseScore(value: string): ScoreValue | null {
  if (!value) return null;
  const match = value.match(/^(\d+)\s*\/\s*100\s*(?:——|—|--|：|:)?\s*(.*)/);
  if (match) {
    return { score: parseInt(match[1], 10), desc: match[2].trim() };
  }
  // 兼容只有数字没有说明的情况
  const numMatch = value.match(/^(\d+)/);
  if (numMatch) {
    return { score: parseInt(numMatch[1], 10), desc: '' };
  }
  return null;
}

/** 解析 #标签 格式 */
function parseTags(value: string): string[] {
  if (!value) return [];
  return value
    .split(/[#\s]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0 && t !== '无' && t !== '暂无' && t !== '暂无数据');
}

/** 解析性伴名单：- 姓名，身份，关系，是否强迫，约XX% */
function parsePartnerList(value: string): PartnerEntry[] {
  if (!value) return [];
  const entries: PartnerEntry[] = [];
  // 匹配 - 开头到下一个 - 或结尾之间的内容
  const itemRegex = /-\s*([^-\n]+?)(?=\s*-|$)/g;
  let match;
  while ((match = itemRegex.exec(value)) !== null) {
    const raw = match[1].trim();
    // 用中文逗号分割5个字段
    const parts = raw.split('，');
    if (parts.length >= 3) {
      entries.push({
        name: (parts[0] || '').trim(),
        identity: (parts[1] || '').trim(),
        relationship: (parts[2] || '').trim(),
        forced: (parts[3] || '未知').trim(),
        percentage: (parts[4] || '').trim(),
      });
    }
  }
  return entries;
}

/** 解析列表项文本（保留原始格式用于展示） */
function parseListText(value: string): string {
  if (!value) return '';
  // 清理多余空格，保留列表结构
  return value.replace(/\s{2,}/g, ' ').trim();
}

/** 解析百分比列表：「名称（约40%），名称（约25%）」→ [{name, pct}] */
export function parsePercentageList(text: string): PieItem[] {
  if (!text) return [];
  const items: PieItem[] = [];
  const parts = text.split(/[，,、]/);
  for (const part of parts) {
    const m = part.match(/^(.+?)[（(]约?(\d+\.?\d*)%[）)]/);
    if (m) {
      const pct = parseFloat(m[2]);
      if (!isNaN(pct) && pct > 0) {
        items.push({ name: m[1].trim(), pct });
      }
    }
  }
  return items;
}

function _pe(s: string): string { return escapeHtml(s); } // U2：统一出口

// ===== 统计卡数值提取与性爱对象男女比 =====

/** 字段名归一化别名表（U59 单源：原 investigation-parser 各 getField 内联一份、
 *  investigation-merge.FIELD_ALIASES 一份，逐字段重复、注释自认「新增须同步两处」）。
 *  key=规范字段名，value=别名列表（含规范名）。parser 提取与 merge 差异匹配共用本表。 */
export const FIELD_ALIASES: Record<string, string[]> = {
  name: ['姓名', 'Name', '角色名'],
  sex: ['性别', 'Sex'],
  age: ['年龄', 'Age'],
  description: ['特写', '外貌', '外貌特写'],
  body: ['身材数据', '身材', '身体数据'],
  dailyClothes: ['日常服装风格', '日常服装', '服装风格'],
  privateClothes: ['私密服装风格', '私密服装', '内衣风格'],
  makeup: ['妆容风格', '妆容'],
  orientation: ['性取向'],
  coreFetishes: ['核心性癖', 'XP', '核心XP'],
  shameIndex: ['羞耻指数'],
  confidenceIndex: ['性自信指数', '自信指数'],
  opennessIndex: ['性开放度', '开放度'],
  isVirgin: ['是否为处女/处男', '是否为处女', '是否为处男'],
  defloration: ['破处对象/时间', '破处对象', '破处时间'],
  purityScore: ['纯洁值综合评分', '纯洁值', '综合纯洁值', '纯洁度'],
  purityDetails: ['部位纯洁度明细', '纯洁度明细'],
  sexCount: ['性爱次数', '总次数'],
  partnerCount: ['性爱人数', '人数'],
  partnerGenderRatio: ['对象男女比', '性爱对象男女比', '男女比', '男女人数', '对象性别比', '性爱对象性别比'],
  partnerList: ['主要性爱名单', '性爱名单', '性伴名单'],
  frequency: ['性爱频率', '频率'],
  positions: ['最常使用体位', '常用体位', '体位'],
  locations: ['性爱场所分布', '场所分布', '场所'],
  pregnancy: ['怀孕/生产/打胎次数', '怀孕生产打胎次数', '孕产次数', '孕产'],
  pregnancyDetails: ['详细生育记录', '生育记录', '生育详情'],
  impregnate: ['使人怀孕次数', '使人怀孕'],
  impregnateDetails: ['详细使人怀孕记录', '使人怀孕记录'],
  devMouth: ['口部开发'],
  devHand: ['手部开发'],
  devFoot: ['足部开发'],
  devBreast: ['乳部开发'],
  devPenis: ['阳具开发'],
  devVagina: ['阴部开发'],
  devAnal: ['肛部开发'],
  mastCount: ['自慰总次数', '自慰次数'],
  mastFreq: ['自慰频率'],
  mastFirst: ['第一次自慰', '首次自慰'],
  mastWay: ['常用自慰方式', '自慰方式'],
  firstExp: ['第一次性经历', '第一次', '初体验'],
  lastExp: ['最近一次性经历', '最近一次', '最近经历'],
  bestExp: ['最爽一次性经历', '最爽一次', '最爽经历'],
  charmTypes: ['魅力类型', '魅力标签'],
  pornTags: ['色情分类TAG', '色情TAG', '色情标签'],
  globalRank: ['全球排名', '排名'],
  grade: ['品级评定', '品级', '评级'],
  rankAdvantages: ['排名优势因素', '优势因素', '优势'],
  rankDisadvantages: ['排名劣势因素', '劣势因素', '劣势'],
  bestPart: ['最具性吸引力部位', '最具吸引力部位', '吸引力部位'],
  voice: ['声音档案', '声音魅力', '声音'],
  reviews: ['流言与评价', '异性/同性评价', '评价', '他人评价', '异性评价'],
  protagonistNote: ['使用者备注', '使用者批注', '备注'],
  characterSelfNote: ['人物自评'],
};

/** 【对象男女比】字段名别名（U59 起从 FIELD_ALIASES 派生——与 investigation-worldbook 的模块清单保持一致） */
const OBJECT_GENDER_RATIO_KEYS = FIELD_ALIASES.partnerGenderRatio;

/** 取文本中第一段连续数字（可含一位小数）。统计卡专用：
 *  防「37人19男18女」被整体去非数字后拼成 371918、「120次（其中口交30次）」拼成 12030。 */
export function extractLeadingNumber(raw: string): string {
  if (!raw) return '';
  const m = String(raw).match(/\d+(?:\.\d+)?/);
  return m ? m[0] : '';
}

/** 抓出文本里全部数字串及其下标区间 */
function numberRuns(text: string): { value: number; start: number; end: number }[] {
  const out: { value: number; start: number; end: number }[] = [];
  const re = /\d+(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push({ value: parseFloat(m[0]), start: m.index, end: m.index + m[0].length });
  return out;
}

/** 解析男女比文本 → { male, female }；未提及的一侧为 null。
 *  数字按「就近认领」配给 男/女 标记（同一数字只被认领一次，距离相同取前一个），
 *  故「男19，女18」「19男18女」「男性19人，女性18人」三种语序都能正确配对。 */
export function parseObjectGenderRatio(raw: string): { male: number | null; female: number | null } {
  const text = String(raw || '');
  const runs = numberRuns(text);
  const taken = new Set<number>();
  const pick = (label: string): number | null => {
    for (let m = 0; m < text.length; m++) {
      if (text[m] !== label) continue;
      let best = -1, bestDist = Infinity;
      for (let i = 0; i < runs.length; i++) {
        if (taken.has(i)) continue;
        const r = runs[i];
        const dist = r.end <= m ? m - r.end : (r.start >= m ? r.start - m : 0);
        if (dist < bestDist) { bestDist = dist; best = i; }
      }
      if (best >= 0) { taken.add(best); return Math.round(runs[best].value); }
    }
    return null;
  };
  return { male: pick('男'), female: pick('女') };
}

/** 先读专用字段，缺失时回退从【性爱人数】原文提取（兼容旧档案：AI 曾把男女分列写进人数字段） */
function resolveObjectGenderRatio(ratioRaw: string, partnerCountRaw?: string): { male: number | null; female: number | null } {
  const direct = parseObjectGenderRatio(ratioRaw || '');
  if (direct.male !== null || direct.female !== null) return direct;
  return parseObjectGenderRatio(partnerCountRaw || '');
}

/** 男女比展示文本（如「男19 · 女18」）；无数据返回空串 */
export function objectGenderRatioText(ratioRaw: string, partnerCountRaw?: string): string {
  const g = resolveObjectGenderRatio(ratioRaw, partnerCountRaw);
  const parts: string[] = [];
  if (g.male !== null) parts.push('男' + g.male);
  if (g.female !== null) parts.push('女' + g.female);
  return parts.join(' · ');
}

/** 统计卡「人数」显示数字：优先【性爱人数】首个数字串；无数字时回落男女分列之和，再回落原文（如「无」）。
 *  数值字段被塞进男女分列（如「男19，女18」这种没有总数的写法）时改用分列之和，
 *  否则会把「男19」的 19 当成总人数。 */
export function objectCountNumber(partnerCountRaw: string, ratioRaw?: string): string {
  const raw = String(partnerCountRaw || '');
  const g = resolveObjectGenderRatio(ratioRaw || '', raw);
  const hasRatio = g.male !== null || g.female !== null;
  if (/男/.test(raw) && /女/.test(raw) && hasRatio) return String((g.male || 0) + (g.female || 0));
  const num = extractLeadingNumber(raw);
  if (num) return num;
  if (hasRatio) return String((g.male || 0) + (g.female || 0));
  return raw.trim();
}

/** 统计卡「人数」子行 HTML（男女分列，如「男19 · 女18」）；无数据返回空串。
 *  各主题统一用同一内联样式，避免为一行小字新增主题 CSS。 */
export function objectGenderSubLine(ratioRaw: string, partnerCountRaw?: string): string {
  const text = objectGenderRatioText(ratioRaw, partnerCountRaw);
  if (!text) return '';
  return '<div style="font-size:9.5px;opacity:0.72;margin-top:3px;letter-spacing:0.5px">' + _pe(text) + '</div>';
}

/** 环状图（Donut）— 中空环形，使用 CSS mask 实现真正的透明中心 */
export function renderDonutChart(items: PieItem[], colors: string[], size?: number, centerRatio?: number): string {
  if (!items || items.length === 0) return '';
  size = size || 96;
  centerRatio = centerRatio || 0.44;
  const n = items.length;
  const gradStops: string[] = [];
  let cum = 0;
  for (let i = 0; i < n; i++) {
    const p = items[i].pct;
    gradStops.push(colors[i % colors.length] + ' ' + cum + '% ' + (cum + p) + '%');
    cum += p;
  }
  if (cum < 100) gradStops.push('rgba(128,128,128,0.08) ' + cum + '% 100%');
  const maskPct = Math.round(centerRatio * 100);
  var h = '<div style="display:flex;align-items:center;gap:16px;margin:10px 0">';
  h += '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:conic-gradient(' + gradStops.join(',') + ');flex-shrink:0;';
  h += '-webkit-mask:radial-gradient(circle,transparent ' + maskPct + '%,#000 ' + (maskPct + 1) + '%);mask:radial-gradient(circle,transparent ' + maskPct + '%,#000 ' + (maskPct + 1) + '%);';
  h += 'box-shadow:0 2px 10px rgba(0,0,0,0.06)"></div>';
  h += '<div style="font-size:10px;line-height:1.85;flex:1">';
  for (let i = 0; i < n; i++) {
    const c = colors[i % colors.length];
    h += '<div style="display:flex;align-items:center;gap:7px"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + c + ';flex-shrink:0;box-shadow:0 1px 2px ' + c + '40"></span><span>' + _pe(items[i].name) + ' <b>' + items[i].pct + '%</b></span></div>';
  }
  h += '</div></div>';
  return h;
}

/** 横向堆叠比例条 — 适合古风（水墨笔触风格） */
export function renderStackedBar(items: PieItem[], colors: string[], barHeight?: number): string {
  if (!items || items.length === 0) return '';
  barHeight = barHeight || 22;
  const n = items.length;
  var h = '<div style="margin:10px 0">';
  h += '<div style="display:flex;height:' + barHeight + 'px;border-radius:2px;overflow:hidden;gap:1px;background:rgba(128,128,128,0.06);box-shadow:inset 0 1px 3px rgba(0,0,0,0.04)">';
  for (let i = 0; i < n; i++) {
    const c = colors[i % colors.length];
    h += '<div style="width:' + items[i].pct + '%;background:linear-gradient(180deg,' + c + 'dd,' + c + ' 50%,' + c + 'cc 100%);transition:width 0.6s ease;box-shadow:inset 0 1px 0 rgba(255,255,255,0.12)" title="' + _pe(items[i].name) + ' ' + items[i].pct + '%"></div>';
  }
  h += '</div>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:8px;font-size:10px;line-height:1.6">';
  for (let i = 0; i < n; i++) {
    const c = colors[i % colors.length];
    h += '<span style="display:inline-flex;align-items:center;gap:5px"><span style="display:inline-block;width:9px;height:4px;border-radius:1px;background:' + c + '"></span>' + _pe(items[i].name) + ' <b>' + items[i].pct + '%</b></span>';
  }
  h += '</div></div>';
  return h;
}

/** 终端风格独立比例条（每条一行，霓虹发光）— 适合瑟瑟霓虹 */
export function renderTerminalBars(items: PieItem[], colors: string[], barWidth?: number): string {
  if (!items || items.length === 0) return '';
  barWidth = barWidth || 28;
  const n = items.length;
  var h = '<div style="margin:8px 0;font-size:10.5px;line-height:1.9;font-family:Consolas,\\"Courier New\\",monospace">';
  for (let i = 0; i < n; i++) {
    const pct = items[i].pct;
    const color = colors[i % colors.length];
    const filled = Math.max(1, Math.round(pct * barWidth / 100));
    const empty = barWidth - filled;
    var bar = '';
    for (let j = 0; j < filled; j++) bar += '█';
    for (let j = 0; j < empty; j++) bar += '░';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px"><span style="min-width:72px;text-align:right;opacity:0.65;letter-spacing:1px;font-size:9.5px">' + _pe(items[i].name) + '</span><span style="color:' + color + ';letter-spacing:1px;text-shadow:0 0 6px ' + color + '60">' + bar + '</span><span style="min-width:34px;font-weight:700;font-size:10px;color:' + color + '">' + pct + '%</span></div>';
  }
  h += '</div>';
  return h;
}

/** 极简短线条比例图（萦绕/极简风格）— Swiss Design 数据可视化 */
export function renderThinBars(items: PieItem[], colors: string[]): string {
  if (!items || items.length === 0) return '';
  const n = items.length;
  var h = '<div style="margin:8px 0">';
  for (let i = 0; i < n; i++) {
    const pct = items[i].pct;
    const color = colors[i % colors.length];
    const w = Math.max(pct, 2);
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">';
    h += '<span style="width:58px;font-size:9px;text-align:right;opacity:0.45;letter-spacing:1px;flex-shrink:0;font-weight:500">' + _pe(items[i].name) + '</span>';
    h += '<div style="flex:1;height:3px;background:rgba(128,128,128,0.06);border-radius:2px;position:relative;overflow:hidden">';
    h += '<span style="display:block;height:100%;width:' + w + '%;background:' + color + ';border-radius:2px;transition:width 0.8s ease;position:relative">';
    h += '<span style="position:absolute;right:-5px;top:-3px;width:9px;height:9px;border-radius:50%;background:' + color + ';display:inline-block"></span>';
    h += '</span></div>';
    h += '<span style="font-size:9px;min-width:30px;font-weight:600;opacity:0.5;letter-spacing:0.5px">' + pct + '%</span>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

// ===== 主解析函数 =====

export function parseInvestigation(text: string): InvestigationData | null {
  if (!text || text.trim().length === 0) return null;

  // 如果文本包含 <APP> 标签，先提取内容
  const appMatches = text.match(/<\s*[Aa][Pp][Pp]\s*>([^<]*(?:<(?!\/?\s*[Aa][Pp][Pp]\s*>)[^<]*)*)<\s*\/\s*[Aa][Pp][Pp]\s*>/gi);
  let rawText = text;
  
  if (appMatches && appMatches.length > 0) {
    let longestMatch = '';
    for (const match of appMatches) {
      // 提取标签内的内容
      const contentMatch = match.match(/<\s*[Aa][Pp][Pp]\s*>([\s\S]*?)<\s*\/\s*[Aa][Pp][Pp]\s*>/i);
      if (contentMatch && contentMatch[1].length > longestMatch.length) {
        longestMatch = contentMatch[1];
      }
    }
    rawText = longestMatch || text;
  }

  const fields = splitFields(rawText);

  // 如果没有解析到任何字段，返回 null
  if (Object.keys(fields).length === 0) return null;

  const data: InvestigationData = {
    // 基础档案
    name: getField(fields, FIELD_ALIASES.name),
    sex: getField(fields, FIELD_ALIASES.sex),
    age: getField(fields, FIELD_ALIASES.age),
    description: getField(fields, FIELD_ALIASES.description),
    body: getField(fields, FIELD_ALIASES.body),

    // 外貌风格
    dailyClothes: getField(fields, FIELD_ALIASES.dailyClothes),
    privateClothes: getField(fields, FIELD_ALIASES.privateClothes),
    makeup: getField(fields, FIELD_ALIASES.makeup),

    // 心理性向
    orientation: getField(fields, FIELD_ALIASES.orientation),
    coreFetishes: parseTags(getField(fields, FIELD_ALIASES.coreFetishes)),
    shameIndex: parseScore(getField(fields, FIELD_ALIASES.shameIndex)),
    confidenceIndex: parseScore(getField(fields, FIELD_ALIASES.confidenceIndex)),
    opennessIndex: parseScore(getField(fields, FIELD_ALIASES.opennessIndex)),

    // 纯洁档案
    isVirgin: getField(fields, FIELD_ALIASES.isVirgin),
    defloration: getField(fields, FIELD_ALIASES.defloration),
    purityScore: getField(fields, FIELD_ALIASES.purityScore),
    purityDetails: parseListText(getField(fields, FIELD_ALIASES.purityDetails)),

    // 性爱统计
    sexCount: getField(fields, FIELD_ALIASES.sexCount),
    partnerCount: getField(fields, FIELD_ALIASES.partnerCount),
    partnerGenderRatio: getField(fields, OBJECT_GENDER_RATIO_KEYS),
    partnerList: parsePartnerList(getField(fields, FIELD_ALIASES.partnerList)),
    frequency: getField(fields, FIELD_ALIASES.frequency),
    positions: getField(fields, FIELD_ALIASES.positions),
    locations: getField(fields, FIELD_ALIASES.locations),
    positionItems: parsePercentageList(getField(fields, FIELD_ALIASES.positions)),
    locationItems: parsePercentageList(getField(fields, FIELD_ALIASES.locations)),

    // 生育记录
    pregnancy: getField(fields, FIELD_ALIASES.pregnancy),
    pregnancyDetails: getField(fields, FIELD_ALIASES.pregnancyDetails),
    impregnate: getField(fields, FIELD_ALIASES.impregnate),
    impregnateDetails: getField(fields, FIELD_ALIASES.impregnateDetails),

    // 开发状态
    devMouth: getField(fields, FIELD_ALIASES.devMouth),
    devHand: getField(fields, FIELD_ALIASES.devHand),
    devFoot: getField(fields, FIELD_ALIASES.devFoot),
    devBreast: getField(fields, FIELD_ALIASES.devBreast),
    devPenis: getField(fields, FIELD_ALIASES.devPenis),
    devVagina: getField(fields, FIELD_ALIASES.devVagina),
    devAnal: getField(fields, FIELD_ALIASES.devAnal),

    // 自慰档案
    mastCount: getField(fields, FIELD_ALIASES.mastCount),
    mastFreq: getField(fields, FIELD_ALIASES.mastFreq),
    mastFirst: getField(fields, FIELD_ALIASES.mastFirst),
    mastWay: getField(fields, FIELD_ALIASES.mastWay),

    // 性经历档案
    firstExp: getField(fields, FIELD_ALIASES.firstExp),
    lastExp: getField(fields, FIELD_ALIASES.lastExp),
    bestExp: getField(fields, FIELD_ALIASES.bestExp),

    // 综合魅力评估
    charmTypes: parseTags(getField(fields, FIELD_ALIASES.charmTypes)),
    pornTags: parseTags(getField(fields, FIELD_ALIASES.pornTags)),
    globalRank: getField(fields, FIELD_ALIASES.globalRank),
    grade: getField(fields, FIELD_ALIASES.grade),
    rankAdvantages: parseListText(getField(fields, FIELD_ALIASES.rankAdvantages)),
    rankDisadvantages: parseListText(getField(fields, FIELD_ALIASES.rankDisadvantages)),
    bestPart: getField(fields, FIELD_ALIASES.bestPart),
    voice: getField(fields, FIELD_ALIASES.voice),
    reviews: parseListText(getField(fields, FIELD_ALIASES.reviews)),
    protagonistNote: getField(fields, FIELD_ALIASES.protagonistNote),
    characterSelfNote: getField(fields, FIELD_ALIASES.characterSelfNote),
  };

  return data;
}
