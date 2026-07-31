import { Clock3, Flag, PlayCircle, Trophy } from 'lucide-react';

import { cn } from '@/utils/cn';
import {
  CONTEST_STATUS_LABELS,
  type ContestStatus,
} from '@/types/contests';

const CONFIG: Record<
  ContestStatus,
  { icon: typeof Trophy; className: string; label: string }
> = {
  upcoming: {
    icon: Clock3,
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300',
    label: 'Upcoming',
  },
  running: {
    icon: PlayCircle,
    className:
      'border-primary/40 bg-primary-muted text-primary animate-pulse',
    label: 'Running',
  },
  ended: {
    icon: Flag,
    className: 'border-muted/40 bg-overlay text-muted-foreground',
    label: 'Past',
  },
};

export function ContestStatusBadge({
  status,
  className,
}: {
  status: ContestStatus;
  className?: string;
}) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors duration-150',
        cfg.className,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {cfg.label || CONTEST_STATUS_LABELS[status]}
    </span>
  );
}
