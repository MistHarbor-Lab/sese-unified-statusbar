// ===== 文本 inline diff：token 级 LCS，纯逻辑无 DOM =====

export interface DiffSegment {
  type: 'equal' | 'del' | 'ins';
  text: string;
}

/** LCS token 数乘积上限，超限直接退化为整段删+增，保证渲染不卡。 */
const MAX_TOKEN_PRODUCT = 250_000;

/**
 * 分词：CJK 逐字；ASCII 字母连续整词、数字连续成段（两者互不混合，如 163cm → 163|cm）；
 * 其余（空白/标点/全角符号）按连续同类段聚合。
 * 拉丁词整词对齐避免词内字母噪声，中文逐字对齐获得最小改动粒度。
 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const letter = /[A-Za-z]/;
  const digit = /[0-9]/;
  let index = 0;
  while (index < text.length) {
    const char = text[index]!;
    const start = index;
    if (letter.test(char) || digit.test(char)) {
      const isDigit = digit.test(char);
      index += 1;
      while (index < text.length && (isDigit ? digit.test(text[index]!) : letter.test(text[index]!))) index += 1;
    } else {
      index += 1;
    }
    tokens.push(text.slice(start, index));
  }
  return tokens;
}

function lcsBacktrack(oldTokens: string[], nextTokens: string[]): Array<{ type: 'equal' | 'del' | 'ins'; count: number }> {
  const oldCount = oldTokens.length;
  const nextCount = nextTokens.length;
  // dp[i][j] = oldTokens[i:] 与 nextTokens[j:] 的 LCS token 数；Int32Array 扁平化省内存
  const width = nextCount + 1;
  const dp = new Int32Array((oldCount + 1) * width);
  for (let i = oldCount - 1; i >= 0; i -= 1) {
    for (let j = nextCount - 1; j >= 0; j -= 1) {
      dp[i * width + j] = oldTokens[i] === nextTokens[j]
        ? dp[(i + 1) * width + j + 1] + 1
        : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
    }
  }
  const ops: Array<{ type: 'equal' | 'del' | 'ins'; count: number }> = [];
  let i = 0;
  let j = 0;
  while (i < oldCount && j < nextCount) {
    if (oldTokens[i] === nextTokens[j]) {
      ops.push({ type: 'equal', count: 1 });
      i += 1; j += 1;
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      ops.push({ type: 'del', count: 1 });
      i += 1;
    } else {
      ops.push({ type: 'ins', count: 1 });
      j += 1;
    }
  }
  if (i < oldCount) ops.push({ type: 'del', count: oldCount - i });
  if (j < nextCount) ops.push({ type: 'ins', count: nextCount - j });
  return ops;
}

/** 相邻同 type 的 op/token 合并成段；同一位置的 del 与 ins 相邻时 del 在前（视觉先红后绿）。 */
function toSegments(ops: Array<{ type: 'equal' | 'del' | 'ins'; count: number }>, oldTokens: string[], nextTokens: string[]): DiffSegment[] {
  const segments: DiffSegment[] = [];
  let oldIndex = 0;
  let nextIndex = 0;
  const push = (type: DiffSegment['type'], text: string): void => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.type === type) last.text += text;
    else segments.push({ type, text });
  };
  // 回溯产生的 del/ins 已天然 del-before-ins（每步只发一种），逐 op 落段即可
  for (const op of ops) {
    if (op.type === 'equal') {
      push('equal', oldTokens.slice(oldIndex, oldIndex + op.count).join(''));
      oldIndex += op.count;
      nextIndex += op.count;
    } else if (op.type === 'del') {
      push('del', oldTokens.slice(oldIndex, oldIndex + op.count).join(''));
      oldIndex += op.count;
    } else {
      push('ins', nextTokens.slice(nextIndex, nextIndex + op.count).join(''));
      nextIndex += op.count;
    }
  }
  return segments;
}

/** old→next 的 inline diff：equal/del/ins 段序列，空串段自动省略。 */
export function diffText(oldText: string, nextText: string): DiffSegment[] {
  const old = String(oldText || '');
  const next = String(nextText || '');
  if (!old && !next) return [];
  if (!old) return [{ type: 'ins', text: next }];
  if (!next) return [{ type: 'del', text: old }];
  if (old === next) return [{ type: 'equal', text: old }];
  const oldTokens = tokenize(old);
  const nextTokens = tokenize(next);
  if (oldTokens.length * nextTokens.length > MAX_TOKEN_PRODUCT) {
    return [{ type: 'del', text: old }, { type: 'ins', text: next }];
  }
  return toSegments(lcsBacktrack(oldTokens, nextTokens), oldTokens, nextTokens);
}
