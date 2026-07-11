import { Link } from 'react-router-dom';

import { ContestStatusBadge } from '@/features/contests/components/ContestStatusBadge';
import { paths } from '@/routes/paths';
import type { ContestSummary } from '@/types/contests';
import { cn } from '@/utils/cn';

interface ContestsTableProps {
  contests: ContestSummary[];
  isFetching?: boolean;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ContestsTable({ contests, isFetching = false }: ContestsTableProps) {
  return (
    <div
      className={cn(
        'relative overflow-x-auto rounded-lg border border-border',
        isFetching && 'opacity-80',
      )}
    >
      <table className="w-full min-w-[640px] caption-bottom border-collapse text-sm">
        <caption className="sr-only">Contests</caption>
        <thead className="sticky top-0 z-10 border-b border-border bg-[#151820]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              Contest
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              Start
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              Duration
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              Participants
            </th>
          </tr>
        </thead>
        <tbody>
          {contests.map((c) => (
            <tr
              key={c.id}
              className="border-b border-border/80 transition-colors hover:bg-white/[0.03]"
            >
              <td className="px-4 py-3">
                <Link
                  to={paths.contestDetail(c.id)}
                  className="font-medium text-white hover:text-primary"
                >
                  {c.title}
                </Link>
              </td>
              <td className="px-4 py-3">
                <ContestStatusBadge status={c.status} />
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatWhen(c.startTime)}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {c.durationMinutes} min
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {c.participantCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
