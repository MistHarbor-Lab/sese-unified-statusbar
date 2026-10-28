// ===== 日记手账标记白名单消毒渲染 =====
// 数据库模板教 AI 在日记内容里写 7 种 <span class="..."> 手账标记（划掉/黄高亮/波浪线/粉红强调/
// 手写体/慌乱手写/涂黑），各主题 CSS 已就绪。为既不一刀切 escapeHtml 也不开放任意 HTML，
// 这里做字符串级白名单扫描（不依赖 DOMParser，node 可直跑自检）：
//   · 仅放行整标签只有一个 class 属性且值精确命中白名单的 <span>，输出标签逐字符重建
//   · 其余任何标签一律剥壳保文（unwrap），文本节点逐段 escapeHtml，游离的 < 也转义
import { escapeHtml } from './html-escape';

export const DIARY_MARKER_CLASSES = [
  'strikethrough', 'highlight', 'underline', 'emphasis', 'handwritten', 'messy', 'censored',
] as const;

const ALLOWED_CLASSES = new Set<string>(DIARY_MARKER_CLASSES);

// <span class="X">：整个开标签只允许 class 一个属性；引号可省，但值必须精确命中白名单类名。
const SPAN_OPEN_RE = /^span\s+class\s*=\s*(?:"([^"\s>]+)"|'([^'\s>]+)'|([^\s>]+))\s*>/i;
const SPAN_CLOSE_RE = /^\/span\s*>/i;
// 其余任意标签（含带属性的恶意标签）整体剥掉，内部文本保留。
const ANY_TAG_RE = /^\/?[a-zA-Z][^<>]*>/;

function allowedClassOf(restAfterLt: string): string | null {
  const m = SPAN_OPEN_RE.exec(restAfterLt);
  if (!m) return null;
  const value = (m[1] || m[2] || m[3] || '').toLowerCase();
  return ALLOWED_CLASSES.has(value) ? value : null;
}

/** 日记正文 → 安全 HTML：仅 7 类手账 span 保留（只带 class），其余内容转义为纯文本。 */
export function sanitizeDiaryHtml(raw: string): string {
  const source = String(raw == null ? '' : raw);
  let out = '';
  let i = 0;
  const openStack: string[] = [];
  while (i < source.length) {
    const lt = source.indexOf('<', i);
    if (lt < 0) { out += escapeHtml(source.slice(i)); break; }
    out += escapeHtml(source.slice(i, lt));
    const rest = source.slice(lt + 1);
    const close = SPAN_CLOSE_RE.exec(rest);
    if (close) {
      // 游离的 </span>（无对应开标签）直接丢弃，不输出
      if (openStack.length > 0) { openStack.pop(); out += '</span>'; }
      i = lt + 1 + close[0].length;
      continue;
    }
    const cls = allowedClassOf(rest);
    if (cls) {
      openStack.push(cls);
      out += '<span class="' + cls + '">';
      i = lt + 1 + SPAN_OPEN_RE.exec(rest)![0].length;
      continue;
    }
    const anyTag = ANY_TAG_RE.exec(rest);
    if (anyTag) { i = lt + 1 + anyTag[0].length; continue; }
    out += '&lt;'; // 不是合法标签的裸 < 按文本转义
    i = lt + 1;
  }
  // 未闭合的白名单 span 在文末补齐，防 DOM 结构跨条目泄漏
  while (openStack.length > 0) { openStack.pop(); out += '</span>'; }
  return out;
}

/** 日记预览用纯文本：剥掉所有标签（含白名单 span）保留内部文本；裸 < 原样保留，由调用方转义。 */
export function diaryPlainText(raw: string): string {
  const source = String(raw == null ? '' : raw);
  let out = '';
  let i = 0;
  while (i < source.length) {
    const lt = source.indexOf('<', i);
    if (lt < 0) { out += source.slice(i); break; }
    out += source.slice(i, lt);
    const rest = source.slice(lt + 1);
    const close = SPAN_CLOSE_RE.exec(rest);
    if (close) { i = lt + 1 + close[0].length; continue; }
    if (allowedClassOf(rest)) { i = lt + 1 + SPAN_OPEN_RE.exec(rest)![0].length; continue; }
    const anyTag = ANY_TAG_RE.exec(rest);
    if (anyTag) { i = lt + 1 + anyTag[0].length; continue; }
    out += '<';
    i = lt + 1;
  }
  return out;
}
