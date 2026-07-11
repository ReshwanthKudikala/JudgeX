import { memo } from 'react';

import { cn } from '@/utils/cn';
import type { LeaderboardEntry } from '@/types/leaderboard';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId?: string | null;
  isFetching?: boolean;
}

function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '—';
  return `${rate % 1 === 0 ? rate.toFixed(0) : rate.toFixed(2)}%`;
}

export const LeaderboardTable = memo(function LeaderboardTable({
  entries,
  currentUserId,
  isFetching = false,
}: LeaderboardTableProps) {
  return (
    <div
      className={cn(
        'relative overflow-x-auto rounded-lg border border-border',
        isFetching && 'opacity-80',
      )}
    >
      <table className="w-full min-w-[720px] caption-bottom border-collapse text-sm">
        <caption className="sr-only">Global leaderboard rankings</caption>
        <thead className="sticky top-0 z-10 border-b border-border bg-[#151820]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              Rank
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              User
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              Solved
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              Accepted
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              Acceptance Rate
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((row) => {
            const isMe = Boolean(currentUserId && row.userId === currentUserId);
            return (
              <tr
                key={row.userId}
                className={cn(
                  'border-b border-border/80 transition-colors',
                  isMe
                    ? 'bg-primary/10 hover:bg-primary/15'
                    : 'hover:bg-white/[0.03]',
                )}
              >
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  #{row.rank}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white"
                      aria-hidden
                    >
                      {row.username.charAt(0).toUpperCase()}
                    </span>
                    <span className="font-medium text-white">
                      {row.username}
                      {isMe ? (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          You
                        </span>
                      ) : null}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  {row.solved}
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  {row.accepted}
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  {formatRate(row.acceptanceRate)}
                </td>
                <td className="px-4 py-3 font-mono font-medium text-white">
                  {row.score}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
