import { ProblemEmptyState } from '@/features/problems/components/ProblemEmptyState';
import { ProblemErrorState } from '@/features/problems/components/ProblemErrorState';
import { ProblemFilters } from '@/features/problems/components/ProblemFilters';
import { ProblemSearch } from '@/features/problems/components/ProblemSearch';
import { ProblemStats } from '@/features/problems/components/ProblemStats';
import { ProblemsSkeleton } from '@/features/problems/components/ProblemsSkeleton';
import { ProblemsTable } from '@/features/problems/components/ProblemsTable';
import { useProblems } from '@/features/problems/hooks/useProblems';
import { Pagination } from '@/components/ui/Pagination';

export function ProblemsPage() {
  const {
    problems,
    pagination,
    stats,
    hasAcceptance,
    hasTags,
    page,
    difficulty,
    search,
    sortField,
    sortDir,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    onDifficultyChange,
    onSearchChange,
    onSort,
    onPageChange,
  } = useProblems();

  const isFiltered = difficulty !== 'all' || search.trim().length > 0;
  const showInitialSkeleton = isLoading && problems.length === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white">Problems</h1>
        <p className="mt-1 text-sm text-muted">
          Browse the catalog and open a problem to start solving.
        </p>
      </div>

      {!isError ? (
        <ProblemStats
          total={stats.total}
          easy={stats.easy}
          medium={stats.medium}
          hard={stats.hard}
          scope={stats.scope}
        />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ProblemFilters difficulty={difficulty} onDifficultyChange={onDifficultyChange} />
        <ProblemSearch value={search} onChange={onSearchChange} className="sm:ml-auto" />
      </div>

      {isError ? (
        <ProblemErrorState error={error} onRetry={() => void refetch()} />
      ) : showInitialSkeleton ? (
        <ProblemsSkeleton />
      ) : problems.length === 0 ? (
        <ProblemEmptyState filtered={isFiltered} />
      ) : (
        <div className="space-y-4">
          <ProblemsTable
            problems={problems}
            showAcceptance={hasAcceptance}
            showTags={hasTags}
            sortField={sortField}
            sortDir={sortDir}
            onSort={onSort}
            isFetching={isFetching && !isLoading}
          />
          <Pagination
            page={pagination.page || page}
            pageSize={pagination.limit}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
