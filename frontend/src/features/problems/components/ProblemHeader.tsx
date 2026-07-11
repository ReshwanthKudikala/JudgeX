import { memo } from 'react';

import { ProblemMetadata } from '@/features/problems/components/ProblemMetadata';
import type { ProblemDetail } from '@/types/problems';

interface ProblemHeaderProps {
  problem: ProblemDetail;
}

export const ProblemHeader = memo(function ProblemHeader({ problem }: ProblemHeaderProps) {
  return (
    <header className="space-y-3 border-b border-border pb-4">
      <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
        {problem.title}
      </h1>
      <ProblemMetadata problem={problem} />
    </header>
  );
});
