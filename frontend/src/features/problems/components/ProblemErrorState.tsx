import { AlertCircle, FileQuestion } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { paths } from '@/routes/paths';
import { getFriendlyErrorMessage } from '@/utils/errors';

interface ProblemErrorStateProps {
  error?: unknown;
  onRetry?: () => void;
  /** When true, render a dedicated not-found state (HTTP 404). */
  notFound?: boolean;
  title?: string;
  fallbackMessage?: string;
}

/**
 * Shared error / empty-problem state for list and detail pages.
 */
export function ProblemErrorState({
  error,
  onRetry,
  notFound = false,
  title,
  fallbackMessage,
}: ProblemErrorStateProps) {
  if (notFound) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card px-6 py-16 text-center"
        role="alert"
      >
        <FileQuestion className="h-8 w-8 text-muted" aria-hidden />
        <div>
          <p className="text-base font-medium text-white">Problem not found</p>
          <p className="mt-1 max-w-md text-sm text-muted">
            This problem may have been removed or the link is incorrect.
          </p>
        </div>
        <Link to={paths.problems}>
          <Button variant="secondary" size="sm">
            Back to Problems
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-error/30 bg-error/5 px-6 py-16 text-center"
      role="alert"
    >
      <AlertCircle className="h-8 w-8 text-error" aria-hidden />
      <div>
        <p className="text-base font-medium text-white">
          {title ?? 'Couldn’t load problems'}
        </p>
        <p className="mt-1 max-w-md text-sm text-muted">
          {getFriendlyErrorMessage(
            error,
            fallbackMessage ??
              'Something went wrong while loading the problem list.',
          )}
        </p>
      </div>
      {onRetry ? (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
