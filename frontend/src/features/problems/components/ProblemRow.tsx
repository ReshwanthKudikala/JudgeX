import { memo, useCallback, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/Badge';
import { DifficultyBadge } from '@/features/problems/components/DifficultyBadge';
import { ProblemStatus } from '@/features/problems/components/ProblemStatus';
import { paths } from '@/routes/paths';
import { cn } from '@/utils/cn';
import type { ProblemSummary } from '@/types/problems';

interface ProblemRowProps {
  problem: ProblemSummary;
  index: number;
  showAcceptance: boolean;
  showTags: boolean;
}

export const ProblemRow = memo(function ProblemRow({
  problem,
  index,
  showAcceptance,
  showTags,
}: ProblemRowProps) {
  const navigate = useNavigate();

  const go = useCallback(() => {
    navigate(paths.problemDetail(problem.slug));
  }, [navigate, problem.slug]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        go();
      }
    },
    [go],
  );

  return (
    <tr
      tabIndex={0}
      role="link"
      aria-label={`${problem.title}, ${problem.difficulty}`}
      onClick={go}
      onKeyDown={onKeyDown}
      className={cn(
        'cursor-pointer border-b border-border transition-colors last:border-0',
        'hover:bg-white/[0.04] focus-visible:bg-white/[0.06]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50',
        index % 2 === 1 ? 'bg-white/[0.015]' : undefined,
      )}
    >
      <td className="w-14 px-4 py-3.5 align-middle">
        <ProblemStatus solved={problem.solvedByMe} />
      </td>
      <td className="px-4 py-3.5 align-middle">
        <div className="min-w-0">
          <span className="font-medium text-white transition-colors group-hover:text-primary">
            {problem.title}
          </span>
          {showTags && problem.tags && problem.tags.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {problem.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="default" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3.5 align-middle">
        <DifficultyBadge difficulty={problem.difficulty} />
      </td>
      {showAcceptance ? (
        <td className="hidden px-4 py-3.5 align-middle tabular-nums text-muted sm:table-cell">
          {formatAcceptance(problem.acceptanceRate)}
        </td>
      ) : null}
    </tr>
  );
});

function formatAcceptance(rate: number): string {
  if (!Number.isFinite(rate)) return '—';
  return `${rate.toFixed(1)}%`;
}
