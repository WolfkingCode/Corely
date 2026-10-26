export type InlineNode =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'bold'; c: InlineNode[] }
  | { t: 'italic'; c: InlineNode[] }
  | { t: 'link'; href: string; c: InlineNode[] };

export type BlockNode =
  | { t: 'p'; c: InlineNode[] }
  | { t: 'h'; level: number; c: InlineNode[] }
  | { t: 'code'; lang: string; v: string }
  | { t: 'ul'; items: InlineNode[][] }
  | { t: 'ol'; items: InlineNode[][] }
  | { t: 'quote'; c: InlineNode[] }
  | { t: 'hr' };

const INLINE_RE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\s][^*\n]*\*)|(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;

export function parseInline(src: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(INLINE_RE.source, 'g');
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) nodes.push({ t: 'text', v: src.slice(last, m.index) });
    const token = m[0];
    if (m[1]) {
      nodes.push({ t: 'code', v: token.slice(1, -1) });
    } else if (m[2]) {
      nodes.push({ t: 'bold', c: parseInline(token.slice(2, -2)) });
    } else if (m[3]) {
      nodes.push({ t: 'italic', c: parseInline(token.slice(1, -1)) });
    } else if (m[4]) {
      const close = token.indexOf('](');
      nodes.push({
        t: 'link',
        href: token.slice(close + 2, -1),
        c: parseInline(token.slice(1, close)),
      });
    }
    last = m.index + token.length;
  }
  if (last < src.length) nodes.push({ t: 'text', v: src.slice(last) });
  return nodes;
}

export function parseBlocks(src: string): BlockNode[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: BlockNode[] = [];
  let i = 0;

  const isSpecial = (line: string) =>
    /^\s*```/.test(line) ||
    /^#{1,4}\s+/.test(line) ||
    /^\s*([-*•]|\d+[.)])\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*(-{3,}|\*{3,})\s*$/.test(line);

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    const fence = line.match(/^\s*```\s*([\w+-]*)/);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ t: 'code', lang: fence[1] || '', v: code.join('\n') });
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ t: 'h', level: heading[1].length, c: parseInline(heading[2].trim()) });
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ t: 'hr' });
      i++;
      continue;
    }

    if (/^\s*([-*•])\s+/.test(line)) {
      const items: InlineNode[][] = [];
      while (i < lines.length && /^\s*([-*•])\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\s*([-*•])\s+/, '')));
        i++;
      }
      blocks.push({ t: 'ul', items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: InlineNode[][] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\s*\d+[.)]\s+/, '')));
        i++;
      }
      blocks.push({ t: 'ol', items });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoted.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ t: 'quote', c: parseInline(quoted.join('\n')) });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !isSpecial(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    if (para.length === 0) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ t: 'p', c: parseInline(para.join('\n')) });
  }

  return blocks;
}
