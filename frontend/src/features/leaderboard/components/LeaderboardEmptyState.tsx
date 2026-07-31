import { Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { paths } from '@/routes/paths';

interface LeaderboardEmptyStateProps {
  timeframeLabel?: string;
}

export function LeaderboardEmptyState({
  timeframeLabel = 'this period',
}: LeaderboardEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center shadow-card"
      role="status"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-overlay text-muted">
        <Trophy className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold text-foreground">No rankings yet</h2>
      <p className="max-w-md text-sm text-muted">
        No judged submissions for {timeframeLabel}. Solve a problem to appear on
        the board.
      </p>
      <Link to={paths.problems} className="mt-2">
        <Button size="sm">Browse problems</Button>
      </Link>
    </div>
  );
}
