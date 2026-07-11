import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/utils/cn';

interface ProblemStatsProps {
  total: number;
  easy: number;
  medium: number;
  hard: number;
  /** When 'page', counts are from the current page only (API limitation). */
  scope: 'page' | 'global';
  className?: string;
}

export function ProblemStats({
  total,
  easy,
  medium,
  hard,
  scope,
  className,
}: ProblemStatsProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Problems" value={total} valueClassName="text-white" />
        <StatCard label="Easy" value={easy} valueClassName="text-success" />
        <StatCard label="Medium" value={medium} valueClassName="text-amber-300" />
        <StatCard label="Hard" value={hard} valueClassName="text-error" />
      </div>
      {scope === 'page' ? (
        <p className="text-xs text-muted">
          Easy / Medium / Hard counts reflect the current page only — the list API
          does not yet expose global difficulty totals. Total Problems uses the
          server pagination total.
        </p>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className={cn('mt-1 text-2xl font-semibold tabular-nums', valueClassName)}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
