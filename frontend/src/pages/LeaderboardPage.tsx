import { Pagination } from '@/components/ui/Pagination';
import { LeaderboardEmptyState } from '@/features/leaderboard/components/LeaderboardEmptyState';
import { LeaderboardErrorState } from '@/features/leaderboard/components/LeaderboardErrorState';
import { LeaderboardSkeleton } from '@/features/leaderboard/components/LeaderboardSkeleton';
import { LeaderboardTable } from '@/features/leaderboard/components/LeaderboardTable';
import { LeaderboardTimeframeSelect } from '@/features/leaderboard/components/LeaderboardTimeframeSelect';
import { useLeaderboard } from '@/features/leaderboard/hooks/useLeaderboard';
import { useAuthStore } from '@/store';
import { TIMEFRAME_LABELS } from '@/types/leaderboard';

export function LeaderboardPage() {
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  const {
    entries,
    pagination,
    page,
    timeframe,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    onTimeframeChange,
    onPageChange,
  } = useLeaderboard();

  const showInitialSkeleton = isLoading && entries.length === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Leaderboard</h1>
          <p className="mt-1 text-sm text-muted">
            Global rankings by problems solved, acceptance rate, and score.
          </p>
        </div>
        <LeaderboardTimeframeSelect
          value={timeframe}
          onChange={onTimeframeChange}
        />
      </div>

      {isError ? (
        <LeaderboardErrorState error={error} onRetry={() => void refetch()} />
      ) : showInitialSkeleton ? (
        <LeaderboardSkeleton />
      ) : entries.length === 0 ? (
        <LeaderboardEmptyState timeframeLabel={TIMEFRAME_LABELS[timeframe]} />
      ) : (
        <div className="space-y-4">
          <LeaderboardTable
            entries={entries}
            currentUserId={currentUserId}
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
