import { useCountdown } from '@/hooks/useCountdown';
import { cn } from '@/utils/cn';

interface ContestCountdownProps {
  targetIso: string | null | undefined;
  label?: string;
  className?: string;
}

export function ContestCountdown({
  targetIso,
  label = 'Starts in',
  className,
}: ContestCountdownProps) {
  const { label: timeLabel, expired } = useCountdown(targetIso);

  return (
    <div className={cn('rounded-lg border border-border bg-[#12151b] px-4 py-3', className)}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
        {expired ? 'Time' : label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
        {expired ? 'Started' : timeLabel}
      </p>
    </div>
  );
}
