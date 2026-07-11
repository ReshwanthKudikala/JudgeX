import { memo } from 'react';

import {
  STATUS_LABELS,
  VERDICT_LABELS,
  type SubmissionStatus,
  type SubmissionVerdict,
} from '@/types/submissions';
import { cn } from '@/utils/cn';

const VERDICT_CLASS: Record<SubmissionVerdict, string> = {
  accepted: 'border-success/40 bg-success/15 text-success',
  wrong_answer: 'border-error/40 bg-error/15 text-error',
  tle: 'border-amber-400/40 bg-amber-400/15 text-amber-300',
  runtime_error: 'border-error/40 bg-error/15 text-error',
  compile_error: 'border-orange-400/40 bg-orange-400/15 text-orange-300',
  memory_limit_exceeded: 'border-amber-400/40 bg-amber-400/15 text-amber-300',
  internal_error: 'border-error/40 bg-error/15 text-error',
};

const STATUS_CLASS: Record<SubmissionStatus, string> = {
  queued: 'border-border bg-white/5 text-muted-foreground',
  running: 'border-primary/40 bg-primary-muted text-primary',
  completed: 'border-border bg-white/5 text-muted-foreground',
  error: 'border-error/40 bg-error/15 text-error',
};

interface VerdictBadgeProps {
  verdict?: SubmissionVerdict | null;
  status?: SubmissionStatus | null;
  className?: string;
}

export const VerdictBadge = memo(function VerdictBadge({
  verdict,
  status,
  className,
}: VerdictBadgeProps) {
  if (verdict) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold',
          VERDICT_CLASS[verdict],
          className,
        )}
      >
        {VERDICT_LABELS[verdict]}
      </span>
    );
  }

  if (status) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold',
          STATUS_CLASS[status],
          className,
        )}
      >
        {STATUS_LABELS[status]}
      </span>
    );
  }

  return null;
});
