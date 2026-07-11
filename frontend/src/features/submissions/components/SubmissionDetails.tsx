import { memo } from 'react';

import type { Submission } from '@/types/submissions';

interface SubmissionDetailsProps {
  submission: Submission;
}

export const SubmissionDetails = memo(function SubmissionDetails({
  submission,
}: SubmissionDetailsProps) {
  return (
    <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      <Detail
        label="Runtime"
        value={
          submission.runtimeMs != null ? `${submission.runtimeMs} ms` : '—'
        }
      />
      <Detail
        label="Memory"
        value={
          submission.memoryKb != null ? `${submission.memoryKb} KB` : '—'
        }
      />
      <Detail
        label="Execution time"
        value={
          submission.runtimeMs != null ? `${submission.runtimeMs} ms` : '—'
        }
      />
      <Detail
        label="Failed test"
        value={
          submission.failedTestIndex != null
            ? `#${submission.failedTestIndex}`
            : '—'
        }
      />
    </dl>
  );
});

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted/80">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-muted-foreground">{value}</dd>
    </div>
  );
}
