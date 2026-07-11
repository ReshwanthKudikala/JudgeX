import { memo } from 'react';

import { PollingIndicator } from '@/features/submissions/components/PollingIndicator';
import { VerdictBadge } from '@/features/submissions/components/VerdictBadge';
import type { Submission } from '@/types/submissions';
import { cn } from '@/utils/cn';

interface SubmissionStatusProps {
  submission: Submission | null;
  isSubmitting?: boolean;
  isPolling?: boolean;
  className?: string;
}

export const SubmissionStatusBar = memo(function SubmissionStatusBar({
  submission,
  isSubmitting = false,
  isPolling = false,
  className,
}: SubmissionStatusProps) {
  if (!submission && !isSubmitting) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-t border-border px-3 py-2',
        className,
      )}
      aria-live="polite"
    >
      {isSubmitting ? (
        <PollingIndicator active label="Submitting…" />
      ) : (
        <>
          <VerdictBadge
            verdict={submission?.verdict}
            status={submission?.status}
          />
          <PollingIndicator active={isPolling} />
        </>
      )}
    </div>
  );
});

/** Sprint deliverable alias. */
export { SubmissionStatusBar as SubmissionStatus };
