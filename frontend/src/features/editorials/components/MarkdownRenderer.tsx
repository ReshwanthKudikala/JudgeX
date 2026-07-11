import { lazy, Suspense, memo } from 'react';

import { cn } from '@/utils/cn';

const MarkdownBody = lazy(() =>
  import('@/features/editorials/components/MarkdownBody').then((m) => ({
    default: m.MarkdownBody,
  })),
);

interface MarkdownRendererProps {
  markdown: string;
  className?: string;
}

/**
 * Lazy-loaded Markdown renderer (GFM + syntax highlighting).
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  markdown,
  className,
}: MarkdownRendererProps) {
  return (
    <Suspense
      fallback={
        <div className={cn('animate-pulse space-y-2 py-2', className)}>
          <div className="h-4 w-2/3 rounded bg-muted/30" />
          <div className="h-4 w-full rounded bg-muted/20" />
          <div className="h-4 w-5/6 rounded bg-muted/20" />
        </div>
      }
    >
      <MarkdownBody markdown={markdown} className={className} />
    </Suspense>
  );
});
