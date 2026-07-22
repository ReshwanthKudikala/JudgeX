import { memo } from 'react';
import { Play, Send } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

interface EditorActionsProps {
  onRun: () => void;
  onSubmit: () => void;
  /** Disables Run (placeholder stays clickable unless true). */
  runDisabled?: boolean;
  /** Disables Submit while submitting/polling. */
  submitDisabled?: boolean;
  submitLoading?: boolean;
  className?: string;
}

/**
 * Run / Submit actions.
 * Run remains a Sprint-23 placeholder; Submit is wired in Sprint 24.
 */
export const EditorActions = memo(function EditorActions({
  onRun,
  onSubmit,
  runDisabled = false,
  submitDisabled = false,
  submitLoading = false,
  className,
}: EditorActionsProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-1.5', className)}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-7 px-2.5 text-xs"
        disabled={runDisabled}
        onClick={onRun}
        aria-label="Run code"
      >
        <Play className="h-3.5 w-3.5" aria-hidden />
        Run
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-7 px-2.5 text-xs"
        disabled={submitDisabled || submitLoading}
        loading={submitLoading}
        onClick={onSubmit}
        aria-label="Submit solution"
      >
        <Send className="h-3.5 w-3.5" aria-hidden />
        Submit
      </Button>
    </div>
  );
});
