import { Trophy } from 'lucide-react';

interface ContestsEmptyStateProps {
  filtered?: boolean;
}

export function ContestsEmptyState({ filtered = false }: ContestsEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center shadow-card"
      role="status"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-overlay text-muted">
        <Trophy className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold text-foreground">
        {filtered ? 'No contests in this filter' : 'No contests yet'}
      </h2>
      <p className="max-w-md text-sm text-muted">
        {filtered
          ? 'Try another status tab — contests will appear when their schedule matches.'
          : 'Demo contests will appear here after seeding. Admins can also publish new contests.'}
      </p>
    </div>
  );
}
