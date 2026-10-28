// ===== 轻量 Markdown 渲染（纯 DOM 构建，零 innerHTML） =====
// 供宅仙回答渲染：支持标题/加粗/斜体/行内码/围栏码块/有序无序列表/引用/分隔线/段落。
// 全部经 createElement + textContent 构建，任意输入都不会注入 HTML。

const INLINE_RE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n\s][^*\n]*\*)/;

function appendInline(parent: HTMLElement, text: string): void {
  const parts = String(text || '').split(INLINE_RE);
  for (const part of parts) {
    if (!part) continue;
    if (part.length >= 2 && part.startsWith('`') && part.endsWith('`')) {
      const code = document.createElement('code');
      code.textContent = part.slice(1, -1);
      parent.append(code);
    } else if (part.length >= 4 && part.startsWith('**') && part.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      parent.append(strong);
    } else if (part.length >= 2 && part.startsWith('*') && part.endsWith('*')) {
      const em = document.createElement('em');
      em.textContent = part.slice(1, -1);
      parent.append(em);
    } else {
      parent.append(document.createTextNode(part));
    }
  }
}

interface Block {
  kind: 'p' | 'h' | 'ul' | 'ol' | 'quote' | 'hr' | 'code';
  level?: number;
  lines: string[];
}

/** 块级解析（导出供无 DOM 环境测试）。 */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = String(text || '').split('\n');
  let paragraph: string[] = [];
  const flushParagraph = (): void => {
    if (paragraph.length) {
      blocks.push({ kind: 'p', lines: paragraph });
      paragraph = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```/);
    if (fence) {
      flushParagraph();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) codeLines.push(lines[i++]);
      blocks.push({ kind: 'code', lines: codeLines });
      continue;
    }
    if (!line.trim()) { flushParagraph(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: 'h', level: heading[1].length, lines: [heading[2]] });
      continue;
    }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph();
      blocks.push({ kind: 'hr', lines: [] });
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      const quoteLines: string[] = [quote[1]];
      while (i + 1 < lines.length) {
        const next = lines[i + 1].match(/^\s*>\s?(.*)$/);
        if (!next) break;
        quoteLines.push(next[1]);
        i++;
      }
      blocks.push({ kind: 'quote', lines: quoteLines });
      continue;
    }
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      const items: string[] = [bullet[1]];
      while (i + 1 < lines.length) {
        const next = lines[i + 1].match(/^\s*[-*•]\s+(.*)$/);
        if (!next) break;
        items.push(next[1]);
        i++;
      }
      blocks.push({ kind: 'ul', lines: items });
      continue;
    }
    const ordered = line.match(/^\s*\d+[.、)]\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      const items: string[] = [ordered[1]];
      while (i + 1 < lines.length) {
        const next = lines[i + 1].match(/^\s*\d+[.、)]\s+(.*)$/);
        if (!next) break;
        items.push(next[1]);
        i++;
      }
      blocks.push({ kind: 'ol', lines: items });
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return blocks;
}

/** 把 markdown 文本渲染进容器（先清空容器）。安全：只创建元素与文本节点。 */
export function renderMarkdownInto(container: HTMLElement, text: string): void {
  container.replaceChildren();
  for (const block of parseBlocks(text)) {
    if (block.kind === 'hr') {
      container.append(document.createElement('hr'));
    } else if (block.kind === 'code') {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = block.lines.join('\n');
      pre.append(code);
      container.append(pre);
    } else if (block.kind === 'h') {
      const tag = `h${Math.min((block.level || 1) + 2, 6)}` as 'h3' | 'h4' | 'h5' | 'h6';
      const head = document.createElement(tag);
      appendInline(head, block.lines[0]);
      container.append(head);
    } else if (block.kind === 'quote') {
      const quote = document.createElement('blockquote');
      appendInline(quote, block.lines.join('\n'));
      container.append(quote);
    } else if (block.kind === 'ul' || block.kind === 'ol') {
      const list = document.createElement(block.kind);
      for (const item of block.lines) {
        const li = document.createElement('li');
        appendInline(li, item);
        list.append(li);
      }
      container.append(list);
    } else {
      const p = document.createElement('p');
      appendInline(p, block.lines.join('\n'));
      container.append(p);
    }
  }
}
