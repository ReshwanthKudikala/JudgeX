import { memo, useMemo } from 'react';
import { Play, Send } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

function modKeyLabel() {
  if (typeof navigator === 'undefined') return 'Ctrl';
  return /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
}

interface EditorActionsProps {
  onRun: () => void;
  onSubmit: () => void;
  runDisabled?: boolean;
  runLoading?: boolean;
  submitDisabled?: boolean;
  submitLoading?: boolean;
  className?: string;
}

export const EditorActions = memo(function EditorActions({
  onRun,
  onSubmit,
  runDisabled = false,
  runLoading = false,
  submitDisabled = false,
  submitLoading = false,
  className,
}: EditorActionsProps) {
  const mod = useMemo(() => modKeyLabel(), []);

  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-1.5', className)}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-7 px-2.5 text-xs"
        disabled={runDisabled || runLoading}
        loading={runLoading}
        onClick={onRun}
        aria-label={`Run code (${mod}+Shift+Enter)`}
        title={`Run (${mod}+Shift+Enter)`}
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
        aria-label={`Submit solution (${mod}+Enter)`}
        title={`Submit (${mod}+Enter)`}
      >
        <Send className="h-3.5 w-3.5" aria-hidden />
        Submit
      </Button>
    </div>
  );
});
