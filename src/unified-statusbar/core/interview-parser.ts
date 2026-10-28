// ===== 大采访输出解析 =====

export type InterviewTurnType = 'question' | 'answer' | 'narration' | 'scene' | 'sound';

export interface InterviewTurn {
  type: InterviewTurnType;
  speaker?: string;
  emotion?: string;
  content: string;
}

export interface InterviewData {
  title: string;
  subtitle: string;
  scene: string;
  date: string;
  interviewers: string[];
  interviewees: string[];
  turns: InterviewTurn[];
  epilogue: string;
  raw?: string;
}

const MARKER_RE = /^\s*\[([^\]]+)\]\s*(.*)$/;
const HEADER_RE = /^\s*【([^】]+)】\s*(.*)$/;

function extractInner(text: string): string {
  const matches = Array.from(text.matchAll(/<\s*APP\s*>([\s\S]*?)<\s*\/\s*APP\s*>/gi));
  if (matches.length === 0) return text.trim();
  return matches.reduce((longest, match) => {
    const content = match[1] || '';
    return content.length > longest.length ? content : longest;
  }, '').trim();
}

function parseNames(value: string): string[] {
  return value
    .split(/[，、,]/)
    .map(item => item.replace(/★/g, '').trim())
    .filter(Boolean);
}

function markerType(marker: string): InterviewTurnType {
  if (marker === '问') return 'question';
  if (marker === '答') return 'answer';
  if (marker === '景') return 'scene';
  if (marker === '声') return 'sound';
  return 'narration';
}

export function parseInterview(text: string): InterviewData | null {
  const raw = extractInner(String(text || ''));
  if (!raw) return null;

  const data: InterviewData = {
    title: '',
    subtitle: '',
    scene: '',
    date: '',
    interviewers: [],
    interviewees: [],
    turns: [],
    epilogue: '',
    raw,
  };
  let current: InterviewTurn | null = null;
  let inEpilogue = false;

  const flush = (): void => {
    if (current && current.content.trim()) {
      data.turns.push({ ...current, content: current.content.trim() });
    }
    current = null;
  };

  for (const line of raw.split(/\r?\n/)) {
    const header = line.match(HEADER_RE);
    if (header && header[1] === '手记') {
      flush();
      inEpilogue = true;
      data.epilogue = header[2].trim();
      continue;
    }
    if (inEpilogue) {
      data.epilogue += (data.epilogue ? '\n' : '') + line;
      continue;
    }

    const marker = line.match(MARKER_RE);
    if (marker) {
      flush();
      const type = markerType(marker[1].trim());
      current = { type, content: '' };
      if (type === 'question' || type === 'answer') {
        current.speaker = marker[2].trim() || undefined;
      } else if (marker[2].trim()) {
        current.content = marker[2].trim();
      }
      continue;
    }

    if (current) {
      const emotion = line.match(/^\s*〈情〉\s*(.+)$/);
      if ((current.type === 'question' || current.type === 'answer') && !current.content && emotion) {
        current.emotion = emotion[1].trim();
      } else {
        current.content += (current.content ? '\n' : '') + line;
      }
      continue;
    }

    if (!header) continue;
    const value = header[2].trim();
    if (header[1] === '标题') data.title = value;
    else if (header[1] === '副标题') data.subtitle = value;
    else if (header[1] === '场景') data.scene = value;
    else if (header[1] === '日期') data.date = value;
    else if (header[1] === '采访者') data.interviewers = parseNames(value);
    else if (header[1] === '被采访者') data.interviewees = parseNames(value);
  }

  flush();
  data.epilogue = data.epilogue.trim();
  return data.title || data.subtitle || data.scene || data.turns.length > 0 ? data : null;
}
