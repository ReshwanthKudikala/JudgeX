import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/common/Skeleton';
import { ContestCountdown } from '@/features/contests/components/ContestCountdown';
import { ContestStatusBadge } from '@/features/contests/components/ContestStatusBadge';
import { ContestsErrorState } from '@/features/contests/components/ContestsErrorState';
import {
  useContest,
  useContestProblems,
  useJoinContest,
} from '@/features/contests/hooks/useContest';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';
import { ApiError } from '@/types';

export function ContestDetailPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const { success, error: errorToast } = useToast();

  const contestQuery = useContest(contestId);
  const contest = contestQuery.data;
  const problemsQuery = useContestProblems(
    contestId,
    Boolean(contest) && contest?.status !== 'upcoming',
  );
  const joinMutation = useJoinContest(contestId);

  if (contestQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (contestQuery.isError || !contest) {
    return (
      <ContestsErrorState
        error={contestQuery.error}
        onRetry={() => void contestQuery.refetch()}
      />
    );
  }

  const countdownTarget =
    contest.status === 'upcoming'
      ? contest.startTime
      : contest.status === 'running'
        ? contest.endTime
        : null;
  const countdownLabel =
    contest.status === 'upcoming'
      ? 'Starts in'
      : contest.status === 'running'
        ? 'Ends in'
        : undefined;

  const handleJoin = async () => {
    if (!token) {
      errorToast('Sign in required', 'Please sign in to join this contest.');
      navigate(paths.login, {
        state: { from: { pathname: paths.contestDetail(contest.id) } },
      });
      return;
    }
    try {
      const result = await joinMutation.mutateAsync();
      success(
        result.alreadyJoined ? 'Already joined' : 'Joined contest',
        result.alreadyJoined
          ? 'You are already registered.'
          : 'Good luck — problems unlock when the contest starts.',
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not join contest.';
      errorToast('Join failed', message);
    }
  };

  const problems = problemsQuery.data?.problems ?? [];
  const problemsHidden =
    contest.status === 'upcoming' ||
    problemsQuery.data?.hidden ||
    (problemsQuery.isError &&
      problemsQuery.error instanceof ApiError &&
      problemsQuery.error.status === 403);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-white">{contest.title}</h1>
            <ContestStatusBadge status={contest.status} />
          </div>
          {contest.description ? (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground whitespace-pre-wrap">
              {contest.description}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted">
            Duration {contest.durationMinutes} min · {contest.participantCount}{' '}
            participants
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {contest.status !== 'ended' ? (
            <Button
              type="button"
              size="sm"
              disabled={contest.joined || joinMutation.isPending}
              onClick={() => void handleJoin()}
            >
              {contest.joined ? 'Joined' : 'Join contest'}
            </Button>
          ) : null}
          <Link to={paths.contestScoreboard(contest.id)}>
            <Button type="button" variant="secondary" size="sm">
              Scoreboard
            </Button>
          </Link>
        </div>
      </div>

      {countdownTarget ? (
        <ContestCountdown targetIso={countdownTarget} label={countdownLabel} />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Problems
        </h2>
        {problemsHidden ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            {contest.status === 'upcoming'
              ? 'Problems are hidden until the contest starts.'
              : contest.joined
                ? 'Loading problems…'
                : 'Join the contest to view problems while it is running.'}
          </p>
        ) : problemsQuery.isError ? (
          <ContestsErrorState
            error={problemsQuery.error}
            onRetry={() => void problemsQuery.refetch()}
          />
        ) : problemsQuery.isLoading ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : problems.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            No problems attached to this contest.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {problems.map((p, index) => (
              <li
                key={p.problemId}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <span className="mr-2 font-mono text-xs text-muted">
                    {String.fromCharCode(65 + index)}
                  </span>
                  {p.slug ? (
                    <Link
                      to={paths.problemDetail(p.slug)}
                      className="font-medium text-white hover:text-primary"
                    >
                      {p.title}
                    </Link>
                  ) : (
                    <span className="font-medium text-white">{p.title}</span>
                  )}
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {p.points} pts
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
