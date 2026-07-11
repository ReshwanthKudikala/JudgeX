import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { getFriendlyErrorMessage } from '@/utils/errors';

interface ProblemErrorStateProps {
  error: unknown;
  onRetry: () => void;
}

export function ProblemErrorState({ error, onRetry }: ProblemErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-error/30 bg-error/5 px-6 py-16 text-center"
      role="alert"
    >
      <AlertCircle className="h-8 w-8 text-error" aria-hidden />
      <div>
        <p className="text-base font-medium text-white">Couldn’t load problems</p>
        <p className="mt-1 max-w-md text-sm text-muted">
          {getFriendlyErrorMessage(error, 'Something went wrong while loading the problem list.')}
        </p>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
