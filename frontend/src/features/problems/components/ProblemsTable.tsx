import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { ProblemRow } from '@/features/problems/components/ProblemRow';
import { cn } from '@/utils/cn';
import type {
  ProblemSortField,
  ProblemSummary,
  SortDirection,
} from '@/types/problems';

interface ProblemsTableProps {
  problems: ProblemSummary[];
  showAcceptance: boolean;
  showTags: boolean;
  sortField: ProblemSortField | null;
  sortDir: SortDirection;
  onSort: (field: ProblemSortField) => void;
  isFetching?: boolean;
}

export function ProblemsTable({
  problems,
  showAcceptance,
  showTags,
  sortField,
  sortDir,
  onSort,
  isFetching = false,
}: ProblemsTableProps) {
  return (
    <div
      className={cn(
        'relative overflow-x-auto rounded-lg border border-border',
        isFetching && 'opacity-80',
      )}
    >
      <table className="w-full min-w-[520px] caption-bottom border-collapse text-sm">
        <caption className="sr-only">JudgeX problem catalog</caption>
        <thead className="sticky top-0 z-10 border-b border-border bg-[#151820]">
          <tr>
            <th
              scope="col"
              className="w-14 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted"
            >
              Status
            </th>
            <SortableHead
              label="Title"
              field="title"
              active={sortField}
              dir={sortDir}
              onSort={onSort}
            />
            <SortableHead
              label="Difficulty"
              field="difficulty"
              active={sortField}
              dir={sortDir}
              onSort={onSort}
            />
            {showAcceptance ? (
              <SortableHead
                label="Acceptance"
                field="acceptance"
                active={sortField}
                dir={sortDir}
                onSort={onSort}
                className="hidden sm:table-cell"
              />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {problems.map((problem, index) => (
            <ProblemRow
              key={problem.id}
              problem={problem}
              index={index}
              showAcceptance={showAcceptance}
              showTags={showTags}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableHead({
  label,
  field,
  active,
  dir,
  onSort,
  className,
}: {
  label: string;
  field: ProblemSortField;
  active: ProblemSortField | null;
  dir: SortDirection;
  onSort: (field: ProblemSortField) => void;
  className?: string;
}) {
  const isActive = active === field;
  const Icon = !isActive ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-sm transition-colors',
          'hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
          isActive && 'text-white',
        )}
        aria-label={`Sort by ${label}${isActive ? `, currently ${dir}ending` : ''}`}
      >
        {label}
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </button>
    </th>
  );
}
