import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Clock, Layers } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ContestStatusBadge } from '@/features/contests/components/ContestStatusBadge';
import { paths } from '@/routes/paths';
import type { ContestSummary } from '@/types/contests';
import { cn } from '@/utils/cn';

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function excerpt(text?: string | null, max = 140) {
  if (!text) return 'Timed practice set with curated problems.';
  const plain = text.replace(/\s+/g, ' ').trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1)}…`;
}

function contestPath(c: ContestSummary) {
  return paths.contestDetail(c.slug || c.id);
}

function actionLabel(status: ContestSummary['status']) {
  if (status === 'running') return 'Enter contest';
  if (status === 'upcoming') return 'View details';
  return 'Review contest';
}

interface ContestCardProps {
  contest: ContestSummary;
}

export function ContestCard({ contest }: ContestCardProps) {
  const href = contestPath(contest);
  const problemCount = contest.problemCount ?? contest.problems?.length ?? 0;

  return (
    <Card
      className={cn(
        'group h-full overflow-hidden transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
      )}
    >
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
            <Link to={href} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
              {contest.title}
            </Link>
          </h2>
          <ContestStatusBadge status={contest.status} />
        </div>

        <p className="line-clamp-3 text-sm text-muted-foreground">
          {excerpt(contest.description)}
        </p>

        <dl className="mt-auto grid grid-cols-1 gap-2 text-xs text-muted sm:grid-cols-3">
          <div className="flex items-center gap-1.5 rounded-md bg-overlay px-2.5 py-2">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <div>
              <dt className="uppercase tracking-wide">Start</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {formatDate(contest.startTime)}
              </dd>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-overlay px-2.5 py-2">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <div>
              <dt className="uppercase tracking-wide">Duration</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {contest.durationMinutes} min
              </dd>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-overlay px-2.5 py-2">
            <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <div>
              <dt className="uppercase tracking-wide">Problems</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {problemCount}
              </dd>
            </div>
          </div>
        </dl>

        <div className="pt-1">
          <Link to={href}>
            <Button
              type="button"
              size="sm"
              variant={contest.status === 'running' ? 'primary' : 'secondary'}
              className="w-full sm:w-auto"
            >
              {actionLabel(contest.status)}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

interface ContestCardsProps {
  contests: ContestSummary[];
  isFetching?: boolean;
}

export function ContestCards({ contests, isFetching = false }: ContestCardsProps) {
  return (
    <div
      className={cn(
        'grid gap-4 sm:grid-cols-2 xl:grid-cols-3',
        isFetching && 'opacity-80 transition-opacity duration-150',
      )}
    >
      {contests.map((c) => (
        <ContestCard key={c.id} contest={c} />
      ))}
    </div>
  );
}
