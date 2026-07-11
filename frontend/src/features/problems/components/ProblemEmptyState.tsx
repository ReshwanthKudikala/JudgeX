import { BookOpen } from 'lucide-react';

interface ProblemEmptyStateProps {
  filtered?: boolean;
}

export function ProblemEmptyState({ filtered = false }: ProblemEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-6 py-16 text-center"
      role="status"
    >
      <BookOpen className="h-8 w-8 text-muted" aria-hidden />
      <p className="text-base font-medium text-white">
        {filtered ? 'No problems match your filters.' : 'No problems available.'}
      </p>
      <p className="max-w-sm text-sm text-muted">
        {filtered
          ? 'Try clearing the search or difficulty filter.'
          : 'Check back later — new challenges will appear here.'}
      </p>
    </div>
  );
}
