import { cn } from '@/utils/cn';
import type { ProblemDifficulty } from '@/types/problems';

const OPTIONS: Array<{ value: ProblemDifficulty | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

interface ProblemFiltersProps {
  difficulty: ProblemDifficulty | 'all';
  onDifficultyChange: (value: ProblemDifficulty | 'all') => void;
  className?: string;
}

export function ProblemFilters({
  difficulty,
  onDifficultyChange,
  className,
}: ProblemFiltersProps) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-1', className)}
      role="group"
      aria-label="Filter by difficulty"
    >
      {OPTIONS.map((opt) => {
        const active = difficulty === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onDifficultyChange(opt.value)}
            aria-pressed={active}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
              active
                ? 'bg-primary-muted text-primary'
                : 'text-muted hover:bg-white/5 hover:text-white',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
