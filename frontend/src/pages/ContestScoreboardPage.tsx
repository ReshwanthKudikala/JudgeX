import { Link, useParams } from 'react-router-dom';

import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/common/Skeleton';
import { ContestScoreboardTable } from '@/features/contests/components/ContestScoreboardTable';
import { ContestStatusBadge } from '@/features/contests/components/ContestStatusBadge';
import { ContestsErrorState } from '@/features/contests/components/ContestsErrorState';
import { useContest } from '@/features/contests/hooks/useContest';
import { useContestScoreboard } from '@/features/contests/hooks/useContestScoreboard';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';

export function ContestScoreboardPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  const contestQuery = useContest(contestId);
  const live = contestQuery.data?.status === 'running';
  const board = useContestScoreboard(contestId, { live });

  if (contestQuery.isLoading) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }

  if (contestQuery.isError || !contestQuery.data) {
    return (
      <ContestsErrorState
        error={contestQuery.error}
        onRetry={() => void contestQuery.refetch()}
      />
    );
  }

  const contest = contestQuery.data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Scoreboard</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            <Link
              to={paths.contestDetail(contest.id)}
              className="hover:text-primary"
            >
              {contest.title}
            </Link>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ContestStatusBadge status={contest.status} />
            <span className="text-xs text-muted">
              {board.participantCount} participants
              {live ? ' · auto-refresh 30s' : null}
            </span>
          </div>
        </div>
        <Link
          to={paths.contestDetail(contest.id)}
          className="text-sm text-primary hover:underline"
        >
          ← Contest details
        </Link>
      </div>

      {board.isError ? (
        <ContestsErrorState
          error={board.error}
          onRetry={() => void board.refetch()}
        />
      ) : board.isLoading && board.entries.length === 0 ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : board.entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted">
          No scoreboard entries yet.
        </p>
      ) : (
        <div className="space-y-4">
          <ContestScoreboardTable
            entries={board.entries}
            currentUserId={currentUserId}
            isFetching={board.isFetching && !board.isLoading}
          />
          <Pagination
            page={board.pagination.page || board.page}
            pageSize={board.pagination.limit}
            total={board.pagination.total}
            totalPages={board.pagination.totalPages}
            onPageChange={board.onPageChange}
          />
        </div>
      )}
    </div>
  );
}
