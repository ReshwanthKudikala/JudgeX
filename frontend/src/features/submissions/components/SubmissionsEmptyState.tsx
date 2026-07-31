import { History, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { paths } from '@/routes/paths';

interface SubmissionsEmptyStateProps {
  filtered?: boolean;
  problemScoped?: boolean;
}

export function SubmissionsEmptyState({
  filtered = false,
  problemScoped = false,
}: SubmissionsEmptyStateProps) {
  const Icon = filtered ? SearchX : History;

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center shadow-card"
      role="status"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-overlay text-muted">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold text-foreground">
        {filtered ? 'No matching submissions' : 'No submissions yet'}
      </h2>
      <p className="max-w-md text-sm text-muted">
        {filtered
          ? 'Try clearing filters or searching a different problem title.'
          : problemScoped
            ? 'Submit a solution from the editor to see it here.'
            : 'Solve a problem to build your submission history.'}
      </p>
      {!filtered && !problemScoped ? (
        <Link to={paths.problems} className="mt-2">
          <Button size="sm">Browse problems</Button>
        </Link>
      ) : null}
    </div>
  );
}
