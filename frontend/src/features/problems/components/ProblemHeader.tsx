import { memo } from 'react';

import { ProblemMetadata } from '@/features/problems/components/ProblemMetadata';
import type { ProblemDetail } from '@/types/problems';

interface ProblemHeaderProps {
  problem: ProblemDetail;
}

/** Compact sticky chrome — parent sticky wrapper owns stickiness on the solve page. */
export const ProblemHeader = memo(function ProblemHeader({ problem }: ProblemHeaderProps) {
  return (
    <header className="space-y-2 px-3 pb-2 pt-3 sm:px-4">
      <h1 className="text-lg font-semibold leading-snug tracking-tight text-white sm:text-xl">
        {problem.title}
      </h1>
      <ProblemMetadata problem={problem} />
    </header>
  );
});
