// ===== 大调查接续：增量合并纯逻辑（无 DOM/浏览器依赖） =====
// 由 core/investigation.ts 在接续模式下调用：把 AI 输出的 <DIFF>/<NEW> 增量合并到基线档案文本。
import { FIELD_ALIASES } from './investigation-parser'; // U59：字段别名单源（原两份逐字段重复、注释自认须手工同步）

/** 基线档案切分为有序字段表，保留各字段原始 content 文本与原始字段名/顺序（不做空白归一化）。 */
export function splitFieldsOrdered(text: string): { name: string; content: string }[] {
  const out: { name: string; content: string }[] = [];
  if (!text) return out;
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split('【');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const sepIdx = block.indexOf('】');
    if (sepIdx === -1) continue;
    const name = block.substring(0, sepIdx).trim();
    // content 取到下一个【之前；仅 trim 首尾空白，保留内部换行/结构
    const content = block.substring(sepIdx + 1).replace(/^\n+/, '').replace(/\s+$/, '');
    if (name && content) out.push({ name, content });
  }
  return out;
}

/** 从 AI 结果中抽取 <DIFF>…</DIFF> 与 <NEW>…</NEW>。两者皆缺返回 null（触发兜底）。 */
export function extractDiffContent(result: string): { diff: string; neu: string } | null {
  if (typeof result !== 'string') return null;
  const diffMatch = result.match(/<\s*[Dd][Ii][Ff][Ff]\s*>([\s\S]*?)<\s*\/\s*[Dd][Ii][Ff][Ff]\s*>/);
  const newMatch = result.match(/<\s*[Nn][Ee][Ww]\s*>([\s\S]*?)<\s*\/\s*[Nn][Ee][Ww]\s*>/);
  if (!diffMatch && !newMatch) return null;
  return { diff: diffMatch ? diffMatch[1].trim() : '', neu: newMatch ? newMatch[1].trim() : '' };
}

/**
 * 已知百分比列表字段——NEW 追加会破坏百分比归一，对这些字段强制按 replace 语义。
 * 取自 investigation-parser.ts 的 parsePercentageList/parsePartnerList 所覆盖的字段别名。
 */
const PERCENTAGE_LIST_FIELDS = new Set([
  '主要性爱名单', '性爱名单', '性伴名单',
  '最常使用体位', '常用体位', '体位',
  '性爱场所分布', '场所分布', '场所',
]);

// 反向映射：别名 → 规范键
const ALIAS_TO_CANON: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [canon, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const a of aliases) m.set(a, canon);
  }
  return m;
})();

function canonKey(fieldName: string): string | undefined {
  return ALIAS_TO_CANON.get(fieldName);
}

/**
 * 文本级字段合并：基线档案 + DIFF(替换) + NEW(追加) → 完整 <APP>...</APP> 文本。
 * - DIFF 字段：匹配基线字段则替换 content；未匹配则追加为新字段。
 * - NEW 字段：匹配基线字段则追加（\n 分隔）；若目标是百分比列表字段则改替换（安全网）；未匹配则追加为新字段。
 * - 保留基线未变字段的原始 content 与顺序。
 */
export function mergeInvestigationDiff(baselineContent: string, diffText: string, newText: string): string {
  const baseFields = splitFieldsOrdered(baselineContent);
  const appendFields: { name: string; content: string }[] = [];
  // 规范键/原始名 → 字段引用（基线字段 或 本次追加的新字段）。
  // F48(第十二轮)：原实现把「追加后的合并下标」写进同一张 canonIndex，消费侧却拿它索引 baseFields——
  // 越界后对 undefined 赋值抛 TypeError，调用方 catch 后判「输出截断」把整轮结果丢弃。
  // 现在引用自带归属（base/append），追加字段的再次命中会正确落到 appendFields。
  const refs = new Map<string, { list: 'base' | 'append'; idx: number }>();
  const fieldOf = (ref: { list: 'base' | 'append'; idx: number }) =>
    ref.list === 'base' ? baseFields[ref.idx] : appendFields[ref.idx];
  const pushAppended = (name: string, content: string, key: string): void => {
    appendFields.push({ name, content });
    refs.set(key, { list: 'append', idx: appendFields.length - 1 });
  };
  baseFields.forEach((f, i) => {
    const ck = canonKey(f.name);
    if (ck && !refs.has(ck)) refs.set(ck, { list: 'base', idx: i });
    if (!refs.has(f.name)) refs.set(f.name, { list: 'base', idx: i });
  });

  // 1. DIFF：替换（未匹配基线 → 追加为新字段）
  for (const d of splitFieldsOrdered(diffText)) {
    const ck = canonKey(d.name) || d.name;
    const ref = refs.get(ck);
    if (ref) fieldOf(ref).content = d.content;
    else pushAppended(d.name, d.content, ck);
  }

  // 2. NEW：追加（百分比列表字段改替换；未匹配基线 → 追加为新字段）
  for (const n of splitFieldsOrdered(newText)) {
    const ck = canonKey(n.name) || n.name;
    const ref = refs.get(ck);
    if (!ref) { pushAppended(n.name, n.content, ck); continue; }
    const field = fieldOf(ref);
    field.content = PERCENTAGE_LIST_FIELDS.has(n.name)
      ? n.content                                  // 安全网：整列替换
      : field.content + '\n' + n.content;          // 追加
  }

  // 3. 重新序列化（基线原顺序 + 末尾追加新字段）
  const all = [...baseFields, ...appendFields];
  const body = all.map(f => '【' + f.name + '】' + f.content).join('\n');
  return '<APP>\n' + body + '\n</APP>';
}