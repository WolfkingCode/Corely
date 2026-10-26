import React, { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { parseBlocks, InlineNode } from '../lib/markdown';

const renderInline = (nodes: InlineNode[], keyPrefix: string): React.ReactNode[] =>
  nodes.map((node, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (node.t) {
      case 'text':
        return <React.Fragment key={key}>{node.v}</React.Fragment>;
      case 'code':
        return (
          <code
            key={key}
            dir="ltr"
            className="px-1.5 py-0.5 mx-0.5 rounded-md bg-[var(--input-bg)] border border-[var(--border)] text-[13px] font-mono"
          >
            {node.v}
          </code>
        );
      case 'bold':
        return (
          <strong key={key} className="font-bold">
            {renderInline(node.c, key)}
          </strong>
        );
      case 'italic':
        return (
          <em key={key} className="italic">
            {renderInline(node.c, key)}
          </em>
        );
      case 'link':
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 underline underline-offset-2 hover:text-purple-300 cursor-pointer"
          >
            {renderInline(node.c, key)}
          </a>
        );
      default:
        return null;
    }
  });

const CodeBlock: React.FC<{ lang: string; code: string }> = ({ lang, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div dir="ltr" className="rounded-xl border border-[var(--border)] bg-[var(--input-bg)] overflow-hidden text-left">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] text-[11px] text-[var(--text3)]">
        <span>{lang || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[13px] leading-6 text-[var(--text)] select-text selectable">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const HEADING_CLASSES: Record<number, string> = {
  1: 'text-xl font-bold',
  2: 'text-lg font-bold',
  3: 'text-base font-bold',
  4: 'text-sm font-bold',
};

const MarkdownText: React.FC<{ text: string }> = ({ text }) => {
  const blocks = useMemo(() => parseBlocks(text || ''), [text]);

  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => {
        const key = `b-${idx}`;
        switch (block.t) {
          case 'p':
            return (
              <p key={key} dir="auto" className="whitespace-pre-wrap">
                {renderInline(block.c, key)}
              </p>
            );
          case 'h':
            return (
              <div key={key} dir="auto" className={HEADING_CLASSES[block.level] || HEADING_CLASSES[4]}>
                {renderInline(block.c, key)}
              </div>
            );
          case 'code':
            return <CodeBlock key={key} lang={block.lang} code={block.v} />;
          case 'ul':
            return (
              <ul key={key} dir="auto" className="list-disc ps-6 space-y-1">
                {block.items.map((item, i) => (
                  <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} dir="auto" className="list-decimal ps-6 space-y-1">
                {block.items.map((item, i) => (
                  <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
                ))}
              </ol>
            );
          case 'quote':
            return (
              <blockquote
                key={key}
                dir="auto"
                className="border-s-2 border-purple-500/40 ps-3 text-[var(--text2)] whitespace-pre-wrap"
              >
                {renderInline(block.c, key)}
              </blockquote>
            );
          case 'hr':
            return <hr key={key} className="border-[var(--border)]" />;
          default:
            return null;
        }
      })}
    </div>
  );
};

export default MarkdownText;
