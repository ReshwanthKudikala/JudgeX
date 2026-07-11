import { cn } from '@/utils/cn';
import type { ScoreboardEntry } from '@/types/contests';

interface ContestScoreboardTableProps {
  entries: ScoreboardEntry[];
  currentUserId?: string | null;
  isFetching?: boolean;
}

export function ContestScoreboardTable({
  entries,
  currentUserId,
  isFetching = false,
}: ContestScoreboardTableProps) {
  return (
    <div
      className={cn(
        'relative overflow-x-auto rounded-lg border border-border',
        isFetching && 'opacity-80',
      )}
    >
      <table className="w-full min-w-[560px] caption-bottom border-collapse text-sm">
        <caption className="sr-only">Contest scoreboard</caption>
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
              Penalty
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
                  'border-b border-border/80',
                  isMe ? 'bg-primary/10' : 'hover:bg-white/[0.03]',
                )}
              >
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  #{row.rank}
                </td>
                <td className="px-4 py-3 font-medium text-white">
                  {row.username}
                  {isMe ? (
                    <span className="ml-2 text-[10px] uppercase text-primary">You</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  {row.solved}
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  {row.penalty}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
