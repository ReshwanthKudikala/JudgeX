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
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-white">
        {filtered ? 'No matching submissions' : 'No submissions yet'}
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted">
        {filtered
          ? 'Try clearing filters or searching a different problem title.'
          : problemScoped
            ? 'Submit a solution from the editor to see it here.'
            : 'Solve a problem to build your submission history.'}
      </p>
      {!filtered && !problemScoped ? (
        <Link to={paths.problems} className="mt-6">
          <Button size="sm">Browse problems</Button>
        </Link>
      ) : null}
    </div>
  );
}
