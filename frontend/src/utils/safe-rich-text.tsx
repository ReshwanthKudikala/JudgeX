import { memo, useMemo, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

/**
 * Safe, limited rich-text renderer for problem statements.
 * Supports paragraphs, line breaks, lists, inline code, and fenced code blocks.
 * Does NOT execute HTML — React text nodes escape automatically.
 */
function renderSafeRichText(raw: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  if (!normalized) return nodes;

  // Split on fenced code blocks first.
  const fenceSplit = normalized.split(/(```[\s\S]*?```)/g);

  fenceSplit.forEach((chunk, chunkIndex) => {
    if (!chunk) return;

    if (chunk.startsWith('```') && chunk.endsWith('```')) {
      const inner = chunk.slice(3, -3).replace(/^\w*\n/, '');
      nodes.push(
        <pre
          key={`code-${chunkIndex}`}
          className="my-3.5 overflow-x-auto rounded-md border border-border/70 bg-[#0c0e12] p-3 font-mono text-[13px] leading-relaxed text-muted-foreground"
        >
          <code>{inner.replace(/^\n/, '').replace(/\n$/, '')}</code>
        </pre>,
      );
      return;
    }

    const blocks = chunk.split(/\n{2,}/);
    blocks.forEach((block, blockIndex) => {
      const lines = block.split('\n').map((l) => l.trimEnd());
      const isList = lines.every(
        (l) => !l.trim() || /^[-*•]\s+/.test(l.trim()) || /^\d+\.\s+/.test(l.trim()),
      ) && lines.some((l) => /^[-*•]\s+/.test(l.trim()) || /^\d+\.\s+/.test(l.trim()));

      if (isList) {
        const ordered = lines.some((l) => /^\d+\.\s+/.test(l.trim()));
        const ListTag = ordered ? 'ol' : 'ul';
        nodes.push(
          <ListTag
            key={`list-${chunkIndex}-${blockIndex}`}
            className={cn(
              'my-3.5 space-y-1.5 pl-5 text-[15px] leading-7 text-muted-foreground',
              ordered ? 'list-decimal' : 'list-disc',
            )}
          >
            {lines
              .filter((l) => l.trim())
              .map((line, i) => (
                <li key={i}>
                  {renderInline(
                    line.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, ''),
                  )}
                </li>
              ))}
          </ListTag>,
        );
        return;
      }

      nodes.push(
        <p
          key={`p-${chunkIndex}-${blockIndex}`}
          className="my-3.5 text-[15px] leading-[1.75] text-muted-foreground whitespace-pre-wrap"
        >
          {lines.map((line, i) => (
            <span key={i}>
              {i > 0 ? <br /> : null}
              {renderInline(line)}
            </span>
          ))}
        </p>,
      );
    });
  });

  return nodes;
}

/** Inline: `code` only — all other text is escaped. */
function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={i}
          className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[13px] text-primary"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    // React text nodes are escaped automatically — never inject raw HTML.
    return <span key={i}>{part}</span>;
  });
}

interface SafeRichTextProps {
  content: string;
  className?: string;
}

export const SafeRichText = memo(function SafeRichText({
  content,
  className,
}: SafeRichTextProps) {
  const nodes = useMemo(() => renderSafeRichText(content), [content]);
  return <div className={cn('max-w-none', className)}>{nodes}</div>;
});
