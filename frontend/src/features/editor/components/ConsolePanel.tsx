import { memo, type ReactNode } from 'react';

import type { ConsoleState } from '@/features/editor/types';
import { cn } from '@/utils/cn';

interface ConsolePanelProps {
  state: ConsoleState;
  className?: string;
}

/**
 * Output console placeholders.
 * Sprint 24 fills output / error / time / memory from judge results.
 */
export const ConsolePanel = memo(function ConsolePanel({
  state,
  className,
}: ConsolePanelProps) {
  const hasOutput = Boolean(state.output);
  const hasError = Boolean(state.error);

  return (
    <div
      className={cn('border-t border-border bg-[#0c0e12] px-3 py-2', className)}
      aria-label="Execution console"
      role="region"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Console</p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <ConsoleField label="Output">
          <pre className="min-h-[2.5rem] whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
            {hasOutput ? state.output : '—'}
          </pre>
        </ConsoleField>

        <ConsoleField label="Error">
          <pre
            className={cn(
              'min-h-[2.5rem] whitespace-pre-wrap break-words font-mono text-xs',
              hasError ? 'text-error' : 'text-muted-foreground',
            )}
          >
            {hasError ? state.error : '—'}
          </pre>
        </ConsoleField>

        <ConsoleField label="Execution Time">
          <p className="font-mono text-xs text-muted-foreground">
            {state.executionTimeMs != null ? `${state.executionTimeMs} ms` : '—'}
          </p>
        </ConsoleField>

        <ConsoleField label="Memory">
          <p className="font-mono text-xs text-muted-foreground">
            {state.memoryKb != null ? `${state.memoryKb} KB` : '—'}
          </p>
        </ConsoleField>
      </div>
    </div>
  );
});

function ConsoleField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted/80">
        {label}
      </p>
      {children}
    </div>
  );
}
