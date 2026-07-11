import { Button } from '@/components/ui/Button';
import { ApiError } from '@/types';
import { getFriendlyErrorMessage } from '@/utils/errors';

export function ContestsErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message =
    error instanceof ApiError
      ? error.message
      : getFriendlyErrorMessage(error, 'Could not load contests.');

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-error/30 bg-error/5 px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-white">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button type="button" size="sm" className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
