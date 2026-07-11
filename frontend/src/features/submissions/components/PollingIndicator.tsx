import { Loader2 } from 'lucide-react';

import { cn } from '@/utils/cn';

interface PollingIndicatorProps {
  active: boolean;
  label?: string;
  className?: string;
}

export function PollingIndicator({
  active,
  label = 'Judging…',
  className,
}: PollingIndicatorProps) {
  if (!active) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs text-primary',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      {label}
    </span>
  );
}
