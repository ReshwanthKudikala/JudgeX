import { memo } from 'react';

import type { Submission } from '@/types/submissions';

interface SubmissionDetailsProps {
  submission: Submission;
}

export const SubmissionDetails = memo(function SubmissionDetails({
  submission,
}: SubmissionDetailsProps) {
  const runtime =
    submission.executionTime ?? submission.runtimeMs ?? null;
  const passed =
    submission.passedTests != null && submission.totalTests != null
      ? `${submission.passedTests} / ${submission.totalTests}`
      : submission.passedTests != null
        ? String(submission.passedTests)
        : '—';
  const failedCase =
    submission.failedTestIndex != null
      ? `#${submission.failedTestIndex + 1}`
      : '—';
  const sampleNumber =
    submission.failedTestIndex != null
      ? String(submission.failedTestIndex + 1)
      : '—';

  return (
    <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
      <Detail
        label="Runtime"
        value={runtime != null ? `${runtime} ms` : '—'}
      />
      <Detail
        label="Memory"
        value={
          submission.memoryKb != null ? `${submission.memoryKb} KB` : '—'
        }
      />
      <Detail label="Passed tests" value={passed} />
      <Detail label="Failed testcase" value={failedCase} />
      <Detail label="Sample testcase number" value={sampleNumber} />
      <Detail
        label="Execution time"
        value={runtime != null ? `${runtime} ms` : '—'}
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
