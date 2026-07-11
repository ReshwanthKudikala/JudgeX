import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

interface ProblemLayoutProps {
  breadcrumb?: ReactNode;
  statement: ReactNode;
  editor: ReactNode;
  className?: string;
}

/**
 * LeetCode-style split layout:
 * - Desktop/tablet: statement | editor side-by-side
 * - Mobile: statement stacked above editor
 */
export function ProblemLayout({
  breadcrumb,
  statement,
  editor,
  className,
}: ProblemLayoutProps) {
  return (
    <div className={cn('flex min-h-0 flex-col animate-fade-in', className)}>
      {breadcrumb}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2 lg:gap-0 lg:overflow-hidden lg:rounded-lg lg:border lg:border-border">
        <section
          className="min-h-0 overflow-y-auto rounded-lg border border-border bg-card p-4 sm:p-5 lg:rounded-none lg:border-0 lg:border-r lg:border-border"
          aria-label="Problem statement"
        >
          {statement}
        </section>

        <aside
          className="min-h-0 lg:overflow-y-auto lg:bg-card"
          aria-label="Code editor panel"
        >
          <div className="h-full min-h-[420px] lg:min-h-[calc(100vh-11rem)]">
            {editor}
          </div>
        </aside>
      </div>
    </div>
  );
}
