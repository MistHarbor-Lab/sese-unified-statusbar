// ===== 过往经历文本解析器 =====
// 将「过往经历」原文拆分为：背景介绍（intro）+ 按日期分组的时间轴条目（days）。
// 纯函数，无 DOM 依赖，可被 node 直跑自检。
// 支持两种日期格式：「（XX年）X月X日」（含【】/［］包裹+可选标题，中文或阿拉伯数字）
// 与「（YYYY-）MM-DD」。同日多条归一组但每条独立 entry（永不合并正文）。日期统一「YYYY年M月D日」。

export type DayGroup = { dateLabel: string; entries: string[] };
export type PastExperienceData = { intro: string; days: DayGroup[] };

// 中文数字 → 阿拉伯（支持 1-31 月日范围常见值；十/廿/卅 简化处理为常见月份与日期）
const CN_DIGITS: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15, '十六': 16, '十七': 17, '十八': 18, '十九': 19,
  '二十': 20, '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24, '二十五': 25, '二十六': 26, '二十七': 27, '二十八': 28, '二十九': 29,
  '三十': 30, '三十一': 31,
};

function cnToInt(s: string): number | undefined {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return CN_DIGITS[s];
}

// 日期标记正则（全局）。两个分支：
//  中文式：(可选【】/［］) (可选 年份) 月 日  —— 捕获组 1=年 2=月 3=日
//  ISO 式：(可选 年份-)-月-日              —— 捕获组 4=年 5=月 6=日
// 匹配时吞掉可选的【】/［］（不保留到正文）；其后的「标题」（如 【..】序章·..）
// 自然成为该条正文的前缀——body 从整个日期标记之后切起，标题即正文开头。
const DATE_RE = /(?:【|［)?(?:(\d{1,6})年)?\s*(\d{1,2}|[一二三四五六七八九十]{1,3})月(\d{1,2}|[一二三四五六七八九十]{1,3})日(?:】|］)?|(\d{4,6})-(\d{1,2})-(\d{1,2})/g;

interface Match {
  index: number;
  rawLen: number;       // 日期标记本身的字符长度（含可选【】/［］）
  year: string | undefined;  // 原始年份字符串（保留前导零，如 "001"）
  month: number;
  day: number;
}

function collectMatches(raw: string): Match[] {
  const out: Match[] = [];
  DATE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DATE_RE.exec(raw)) !== null) {
    let year: string | undefined;
    let month: number | undefined;
    let day: number | undefined;
    if (m[4] !== undefined) {
      // ISO 分支
      year = m[4];
      month = parseInt(m[5], 10);
      day = parseInt(m[6], 10);
    } else {
      // 中文式分支
      if (m[1] !== undefined) year = m[1];
      month = cnToInt(m[2]);
      day = cnToInt(m[3]);
    }
    if (month === undefined || day === undefined) continue; // 解析失败跳过
    out.push({ index: m.index, rawLen: m[0].length, year, month, day });
  }
  return out;
}

function makeLabel(year: string | undefined, month: number, day: number): string {
  return (year !== undefined ? year + '年' : '') + month + '月' + day + '日';
}

function keyOf(mm: Match): string {
  return (mm.year !== undefined ? parseInt(mm.year, 10) + '|' : '') + mm.month + '|' + mm.day;
}

export function parsePastExperience(raw: string): PastExperienceData {
  if (!raw || !raw.trim()) return { intro: '', days: [] };
  const matches = collectMatches(raw);
  if (matches.length === 0) {
    return { intro: raw.trim(), days: [] };
  }
  const first = matches[0];
  const intro = raw.slice(0, first.index).trim();

  // 逐条切分：每条 = 该标记起 到 下一个标记起 之前。
  type Entry = { mm: Match; text: string };
  const entries: Entry[] = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    // 从整个日期标记之后切起（含可选【】，故用 rawLen）。
    // 若标记后被【】包裹且紧跟标题（如 【..】序章·..），标题即正文开头，自然并入前缀。
    const start = cur.index + cur.rawLen;
    const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    // 标记后紧跟可能的 ：/: ，,。.；;、 或换行/空白，剥离掉这些前导分隔标点
    const body = raw.slice(start, end).replace(/^[\s：:，,。.；;、]+/, '').trim();
    entries.push({ mm: cur, text: body });
  }

  // 按日期分组（归一键），保持首次出现顺序；每条独立 entry，不合并正文。
  const order: string[] = [];
  const byKey = new Map<string, DayGroup>();
  for (const e of entries) {
    const k = keyOf(e.mm);
    if (!byKey.has(k)) {
      byKey.set(k, { dateLabel: makeLabel(e.mm.year, e.mm.month, e.mm.day), entries: [] });
      order.push(k);
    }
    byKey.get(k)!.entries.push(e.text);
  }
  const days = order.map((k) => byKey.get(k)!);
  return { intro, days };
}
