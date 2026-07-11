import { memo } from 'react';

import type { AiCompileExplanation } from '@/types/submissions';
import { Spinner } from '@/components/common/Spinner';

interface AiExplanationProps {
  explanation: AiCompileExplanation | null;
  loading?: boolean;
  unavailable?: boolean;
}

export const AiExplanation = memo(function AiExplanation({
  explanation,
  loading = false,
  unavailable = false,
}: AiExplanationProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" label="Generating explanation…" />
      </div>
    );
  }

  if (unavailable || !explanation) {
    return (
      <p className="text-xs text-muted">
        AI explanation is unavailable right now.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <Section title="Likely Cause">{explanation.likelyCause}</Section>
      <Section title="Explanation">{explanation.explanation}</Section>
      <Section title="Possible Fix">{explanation.possibleFix}</Section>
    </div>
  );
});

function Section({ title, children }: { title: string; children: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </p>
      <p className="mt-1 leading-relaxed text-muted-foreground whitespace-pre-wrap">
        {children}
      </p>
    </div>
  );
}
