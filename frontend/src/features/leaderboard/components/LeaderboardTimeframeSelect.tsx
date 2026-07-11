import {
  TIMEFRAME_LABELS,
  type LeaderboardTimeframe,
} from '@/types/leaderboard';
import { cn } from '@/utils/cn';

const OPTIONS: LeaderboardTimeframe[] = ['all', 'monthly', 'weekly'];

interface LeaderboardTimeframeSelectProps {
  value: LeaderboardTimeframe;
  onChange: (value: LeaderboardTimeframe) => void;
}

export function LeaderboardTimeframeSelect({
  value,
  onChange,
}: LeaderboardTimeframeSelectProps) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-md border border-border bg-[#151820] p-1"
      role="group"
      aria-label="Leaderboard timeframe"
    >
      {OPTIONS.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              'rounded-sm px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'bg-card text-white shadow-card'
                : 'text-muted hover:text-white',
            )}
            aria-pressed={active}
          >
            {TIMEFRAME_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
