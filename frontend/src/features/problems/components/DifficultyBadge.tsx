import { memo } from 'react';

import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';
import type { ProblemDifficulty } from '@/types/problems';

const LABELS: Record<ProblemDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

/** LeetCode-like difficulty colors: Easy green, Medium yellow, Hard red. */
const CLASS: Record<ProblemDifficulty, string> = {
  easy: 'border-success/30 bg-success/15 text-success',
  medium: 'border-amber-400/40 bg-amber-400/15 text-amber-300',
  hard: 'border-error/30 bg-error/15 text-error',
};

interface DifficultyBadgeProps {
  difficulty: ProblemDifficulty;
  className?: string;
}

export const DifficultyBadge = memo(function DifficultyBadge({
  difficulty,
  className,
}: DifficultyBadgeProps) {
  return (
    <Badge
      variant="default"
      className={cn(CLASS[difficulty], 'capitalize', className)}
    >
      {LABELS[difficulty]}
    </Badge>
  );
});
