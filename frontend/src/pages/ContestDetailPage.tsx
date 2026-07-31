import { Link, useParams } from 'react-router-dom';
import {
  CalendarDays,
  Clock,
  Layers,
  ListChecks,
  ScrollText,
} from 'lucide-react';

import { Skeleton } from '@/components/common/Skeleton';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { DifficultyBadge } from '@/features/problems/components/DifficultyBadge';
import { ContestCountdown } from '@/features/contests/components/ContestCountdown';
import { ContestStatusBadge } from '@/features/contests/components/ContestStatusBadge';
import { ContestsErrorState } from '@/features/contests/components/ContestsErrorState';
import { useContest } from '@/features/contests/hooks/useContest';
import { paths } from '@/routes/paths';
import type { ContestProblem, ContestSummary } from '@/types/contests';
import type { ProblemDifficulty } from '@/types/problems';

const STATIC_RULES = [
  'Solve problems within the contest duration.',
  'Each problem has equal weight.',
  'Hidden test cases are used for judging.',
  'Final ranking is based on solved count then submission time.',
];

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function splitDescription(description?: string | null) {
  if (!description) {
    return { blurb: null as string | null };
  }
  const parts = description.split(/\nRules\n/i);
  return { blurb: parts[0]?.trim() || null };
}

function MetaPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/50 px-3 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ContestHero({ contest }: { contest: ContestSummary }) {
  const problemCount = contest.problemCount ?? contest.problems?.length ?? 0;
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
        ? 'Time remaining'
        : undefined;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/15 via-card to-card shadow-card">
      <div className="space-y-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <ContestStatusBadge status={contest.status} />
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {contest.title}
            </h1>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MetaPill
            icon={Clock}
            label="Duration"
            value={`${contest.durationMinutes} minutes`}
          />
          <MetaPill
            icon={Layers}
            label="Problems"
            value={`${problemCount}`}
          />
          <MetaPill
            icon={CalendarDays}
            label="Started"
            value={formatWhen(contest.startTime)}
          />
          <MetaPill
            icon={CalendarDays}
            label={contest.status === 'ended' ? 'Ended' : 'Ends'}
            value={formatWhen(contest.endTime)}
          />
        </div>

        {countdownTarget ? (
          <ContestCountdown targetIso={countdownTarget} label={countdownLabel} />
        ) : (
          <p className="text-sm text-muted">
            This contest ended on {formatWhen(contest.endTime)}.
          </p>
        )}
      </div>
    </section>
  );
}

function ProblemList({ problems }: { problems: ContestProblem[] }) {
  if (problems.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
        No problems attached to this contest.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card shadow-card">
      {problems.map((p, index) => (
        <li
          key={p.problemId}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-overlay"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-overlay font-mono text-xs font-semibold text-muted">
              {String.fromCharCode(65 + index)}
            </span>
            <div className="min-w-0">
              {p.slug ? (
                <Link
                  to={paths.problemDetail(p.slug)}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {p.title ?? 'Problem'}
                </Link>
              ) : (
                <span className="font-medium text-foreground">
                  {p.title ?? 'Problem'}
                </span>
              )}
              <p className="mt-0.5 text-xs text-muted">
                Practice on the standard problem page · equal weight
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {p.difficulty ? (
              <DifficultyBadge difficulty={p.difficulty as ProblemDifficulty} />
            ) : null}
            {p.slug ? (
              <Link to={paths.problemDetail(p.slug)}>
                <Button type="button" size="sm" variant="secondary">
                  Open
                </Button>
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ContestDetailPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const contestQuery = useContest(contestId);
  const contest = contestQuery.data;

  if (contestQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading contest">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
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

  const { blurb } = splitDescription(contest.description);
  const problems = contest.problems ?? [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-sm text-muted">
        <Link to={paths.contests} className="hover:text-foreground">
          Contests
        </Link>
        <span aria-hidden> / </span>
        <span className="text-muted-foreground">{contest.title}</span>
      </div>

      <ContestHero contest={contest} />

      {blurb ? (
        <Card>
          <CardContent className="space-y-2 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <ScrollText className="h-4 w-4" aria-hidden />
              Description
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {blurb}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <ListChecks className="h-4 w-4" aria-hidden />
            Rules
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {STATIC_RULES.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Informational only — this sprint does not run contest-specific judging,
            ratings, or live registration.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Problems
          </h2>
          <p className="text-xs text-muted">
            Links open the standard problem workspace
          </p>
        </div>
        <ProblemList problems={problems} />
      </section>
    </div>
  );
}
