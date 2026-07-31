import { BookOpen, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/Button';

interface ProblemEmptyStateProps {
  filtered?: boolean;
  onClearFilters?: () => void;
}

export function ProblemEmptyState({
  filtered = false,
  onClearFilters,
}: ProblemEmptyStateProps) {
  const Icon = filtered ? SearchX : BookOpen;

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center shadow-card"
      role="status"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-overlay text-muted">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="text-base font-medium text-foreground">
        {filtered ? 'No problems match your filters' : 'No problems available'}
      </p>
      <p className="max-w-sm text-sm text-muted">
        {filtered
          ? 'Try clearing the search or difficulty filter.'
          : 'Check back later — new challenges will appear here.'}
      </p>
      {filtered && onClearFilters ? (
        <Button size="sm" variant="secondary" onClick={onClearFilters}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
