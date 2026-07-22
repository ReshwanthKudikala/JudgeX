import { memo } from 'react';

import { ProblemConstraints } from '@/features/problems/components/ProblemConstraints';
import { ProblemDescription } from '@/features/problems/components/ProblemDescription';
import { ProblemExamples } from '@/features/problems/components/ProblemExamples';
import { SafeRichText } from '@/utils/safe-rich-text';
import type { ProblemDetail } from '@/types/problems';

interface ProblemStatementPanelProps {
  problem: ProblemDetail;
}

/**
 * Description tab body (header + tabs live in ProblemDetailPage).
 */
export const ProblemStatementPanel = memo(function ProblemStatementPanel({
  problem,
}: ProblemStatementPanelProps) {
  const constraints = problem.constraintsText ?? problem.constraints ?? null;
  const examples = problem.examples ?? [];

  return (
    <div className="space-y-5">
      <ProblemDescription statement={problem.statement} />
      <ProblemExamples examples={examples} />
      <ProblemConstraints constraintsText={constraints} />
      {problem.notes ? (
        <section aria-labelledby="problem-notes-heading" className="space-y-2">
          <h2
            id="problem-notes-heading"
            className="text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Notes
          </h2>
          <SafeRichText content={problem.notes} />
        </section>
      ) : null}
    </div>
  );
});
