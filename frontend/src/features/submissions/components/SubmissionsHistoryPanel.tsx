import { SubmissionsEmptyState } from '@/features/submissions/components/SubmissionsEmptyState';
import { SubmissionsErrorState } from '@/features/submissions/components/SubmissionsErrorState';
import { SubmissionsFilters } from '@/features/submissions/components/SubmissionsFilters';
import { SubmissionsSkeleton } from '@/features/submissions/components/SubmissionsSkeleton';
import { SubmissionsTable } from '@/features/submissions/components/SubmissionsTable';
import { useSubmissions } from '@/features/submissions/hooks/useSubmissions';
import { Pagination } from '@/components/ui/Pagination';

interface SubmissionsHistoryPanelProps {
  problemId?: string;
  /** Compact chrome for embedding under problem tabs. */
  embedded?: boolean;
  enabled?: boolean;
}

/**
 * Shared list + filters + pagination used by /submissions and problem Submissions tab.
 */
export function SubmissionsHistoryPanel({
  problemId,
  embedded = false,
  enabled = true,
}: SubmissionsHistoryPanelProps) {
  const {
    submissions,
    pagination,
    page,
    verdict,
    language,
    search,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    onVerdictChange,
    onLanguageChange,
    onSearchChange,
    onPageChange,
    isFiltered,
  } = useSubmissions({ problemId, enabled });

  const showInitialSkeleton = isLoading && submissions.length === 0;

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      <SubmissionsFilters
        verdict={verdict}
        language={language}
        search={search}
        onVerdictChange={onVerdictChange}
        onLanguageChange={onLanguageChange}
        onSearchChange={onSearchChange}
        hideSearch={Boolean(problemId)}
      />

      {isError ? (
        <SubmissionsErrorState error={error} onRetry={() => void refetch()} />
      ) : showInitialSkeleton ? (
        <SubmissionsSkeleton />
      ) : submissions.length === 0 ? (
        <SubmissionsEmptyState
          filtered={isFiltered}
          problemScoped={Boolean(problemId)}
        />
      ) : (
        <div className="space-y-4">
          <SubmissionsTable
            submissions={submissions}
            isFetching={isFetching && !isLoading}
            hideProblemColumn={Boolean(problemId)}
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
