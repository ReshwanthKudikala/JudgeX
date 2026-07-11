import { memo } from 'react';
import { Play, Send } from 'lucide-react';

import { Button } from '@/components/ui/Button';

interface EditorActionsProps {
  onRun: () => void;
  onSubmit: () => void;
  /** When true, buttons stay visually enabled but still call placeholders. */
  disabled?: boolean;
}

/**
 * Run / Submit actions.
 * Sprint 24: wire these to POST /submissions + polling — keep this API stable.
 */
export const EditorActions = memo(function EditorActions({
  onRun,
  onSubmit,
  disabled = false,
}: EditorActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-3 py-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={onRun}
        aria-label="Run code"
      >
        <Play className="h-3.5 w-3.5" aria-hidden />
        Run
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        onClick={onSubmit}
        aria-label="Submit solution"
      >
        <Send className="h-3.5 w-3.5" aria-hidden />
        Submit
      </Button>
    </div>
  );
});
