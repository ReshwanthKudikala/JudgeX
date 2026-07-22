import type { ReactNode } from 'react';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/utils/cn';

const STORAGE_ID = 'judgex-problem-h-split';
const PANEL_IDS = ['statement', 'editor'] as const;

interface ProblemLayoutProps {
  breadcrumb?: ReactNode;
  statement: ReactNode;
  editor: ReactNode;
  className?: string;
}

/**
 * Split solve workspace:
 * - Desktop (lg+): resizable statement | editor panes (persisted)
 * - Mobile/tablet: stacked panels, no resize
 */
export function ProblemLayout({
  breadcrumb,
  statement,
  editor,
  className,
}: ProblemLayoutProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: STORAGE_ID,
    panelIds: [...PANEL_IDS],
    storage: localStorage,
  });

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col animate-fade-in',
        isDesktop && 'overflow-hidden',
        className,
      )}
    >
      {breadcrumb ? <div className="shrink-0">{breadcrumb}</div> : null}

      {isDesktop ? (
        <Group
          id={STORAGE_ID}
          orientation="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
          className="min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-card"
        >
          <Panel
            id="statement"
            defaultSize="45"
            minSize={350}
            className="min-h-0 min-w-0"
          >
            <section
              className="h-full min-h-0 overflow-y-auto overscroll-contain"
              aria-label="Problem statement"
            >
              {statement}
            </section>
          </Panel>

          <Separator
            className={cn(
              'w-1.5 shrink-0 bg-border transition-colors',
              'hover:bg-primary/50',
              'data-[separator=active]:bg-primary data-[separator=focus]:bg-primary/40',
            )}
            aria-label="Resize problem and editor panels"
          />

          <Panel
            id="editor"
            defaultSize="55"
            minSize={450}
            className="min-h-0 min-w-0"
          >
            <aside
              className="h-full min-h-0 overflow-hidden"
              aria-label="Code editor panel"
            >
              <div className="flex h-full min-h-0 flex-col">{editor}</div>
            </aside>
          </Panel>
        </Group>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4">
          <section
            className="min-h-0 rounded-md border border-border bg-card"
            aria-label="Problem statement"
          >
            {statement}
          </section>
          <aside
            className="min-h-0 rounded-md border border-border bg-card"
            aria-label="Code editor panel"
          >
            <div className="flex min-h-[420px] flex-col">{editor}</div>
          </aside>
        </div>
      )}
    </div>
  );
}
