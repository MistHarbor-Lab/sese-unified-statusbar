// ===== 从 AI 生成结果中提取 <APP>...</APP> 标签内容 =====
// 匹配所有不包含嵌套 <APP> 标签的对，返回内容最长者（AI 偶发输出多段时取主段）。
// investigation.ts / interview.ts / investigation-parser.ts 共用。

const APP_CONTENT_RE = /<\s*[Aa][Pp][Pp]\s*>([^<]*(?:<(?!\/?\s*[Aa][Pp][Pp]\s*>)[^<]*)*)<\s*\/\s*[Aa][Pp][Pp]\s*>/gi;

export function extractAppContent(text: string): string | null {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = APP_CONTENT_RE.exec(text)) !== null) matches.push(match[1].trim());
  if (!matches.length) return null;
  return matches.reduce((longest, content) => content.length > longest.length ? content : longest, matches[0]);
}
