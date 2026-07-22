import { memo } from 'react';

import { DifficultyBadge } from '@/features/problems/components/DifficultyBadge';
import type { ProblemDetail } from '@/types/problems';

interface ProblemMetadataProps {
  problem: ProblemDetail;
}

export const ProblemMetadata = memo(function ProblemMetadata({
  problem,
}: ProblemMetadataProps) {
  const showAcceptance = typeof problem.acceptanceRate === 'number';

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      <DifficultyBadge difficulty={problem.difficulty} className="px-1.5 py-0 text-[11px]" />
      {showAcceptance ? (
        <span className="text-muted">
          Acceptance{' '}
          <span className="tabular-nums text-muted-foreground">
            {problem.acceptanceRate.toFixed(1)}%
          </span>
        </span>
      ) : null}
      {typeof problem.totalSubmissions === 'number' && problem.totalSubmissions > 0 ? (
        <span className="text-muted">
          Submissions{' '}
          <span className="tabular-nums text-muted-foreground">
            {problem.totalSubmissions.toLocaleString()}
          </span>
        </span>
      ) : null}
    </div>
  );
});
