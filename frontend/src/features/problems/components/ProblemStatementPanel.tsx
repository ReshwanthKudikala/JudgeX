import { memo } from 'react';

import { ProblemConstraints } from '@/features/problems/components/ProblemConstraints';
import { ProblemDescription } from '@/features/problems/components/ProblemDescription';
import { ProblemExamples } from '@/features/problems/components/ProblemExamples';
import { ProblemHeader } from '@/features/problems/components/ProblemHeader';
import { SafeRichText } from '@/utils/safe-rich-text';
import type { ProblemDetail } from '@/types/problems';

interface ProblemStatementPanelProps {
  problem: ProblemDetail;
}

/**
 * Left panel body: header + description + optional examples/constraints/notes.
 */
export const ProblemStatementPanel = memo(function ProblemStatementPanel({
  problem,
}: ProblemStatementPanelProps) {
  const constraints = problem.constraintsText ?? problem.constraints ?? null;
  const examples = problem.examples ?? [];

  return (
    <div className="space-y-6">
      <ProblemHeader problem={problem} />
      <ProblemDescription statement={problem.statement} />
      <ProblemExamples examples={examples} />
      <ProblemConstraints constraintsText={constraints} />
      {problem.notes ? (
        <section aria-labelledby="problem-notes-heading" className="space-y-2">
          <h2
            id="problem-notes-heading"
            className="text-sm font-semibold uppercase tracking-wide text-muted"
          >
            Notes
          </h2>
          <SafeRichText content={problem.notes} />
        </section>
      ) : null}
    </div>
  );
});
