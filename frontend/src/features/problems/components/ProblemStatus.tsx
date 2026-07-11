import { memo } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { cn } from '@/utils/cn';

export type SolveStatus = 'solved' | 'unsolved' | 'unknown';

interface ProblemStatusProps {
  /**
   * Plug-in point for future `solvedByMe` from the API.
   * - true  → solved (green check)
   * - false → unsolved (empty)
   * - undefined/null → unknown / not yet available (empty, same as unsolved)
   */
  solved?: boolean | null;
  className?: string;
}

function resolveSolveStatus(solved?: boolean | null): SolveStatus {
  if (solved === true) return 'solved';
  if (solved === false) return 'unsolved';
  return 'unknown';
}

/**
 * Status cell designed so solved state can be wired later without rewriting the table.
 * Today the backend list does not return `solvedByMe`, so this renders empty.
 */
export const ProblemStatus = memo(function ProblemStatus({
  solved,
  className,
}: ProblemStatusProps) {
  const status = resolveSolveStatus(solved);

  if (status === 'solved') {
    return (
      <span
        className={cn('inline-flex text-success', className)}
        title="Solved"
        aria-label="Solved"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex h-4 w-4 items-center justify-center rounded-full border border-border',
        className,
      )}
      title={status === 'unsolved' ? 'Unsolved' : 'Solve status unavailable'}
      aria-label={status === 'unsolved' ? 'Unsolved' : 'Solve status unavailable'}
    />
  );
});
