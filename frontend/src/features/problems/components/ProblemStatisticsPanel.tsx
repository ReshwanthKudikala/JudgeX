import { Skeleton } from '@/components/common/Skeleton';
import { useProblemStatistics } from '@/features/problems/hooks/useProblemStatistics';

interface ProblemStatisticsPanelProps {
  slug: string;
}

function StatCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border/80 bg-[#12151c] px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function ProblemStatisticsPanel({ slug }: ProblemStatisticsPanelProps) {
  const { data, isLoading, isError } = useProblemStatistics(slug);

  if (isLoading) {
    return (
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="mb-4 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted">
        Statistics unavailable right now.
      </p>
    );
  }

  const empty = data.totalSubmissions === 0;

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatCell
        label="Acceptance"
        value={empty ? '—' : `${data.acceptanceRate.toFixed(1)}%`}
        hint={empty ? 'No submissions yet' : undefined}
      />
      <StatCell
        label="Solved"
        value={empty ? '0' : String(data.acceptedUsers)}
        hint="users"
      />
      <StatCell
        label="Submissions"
        value={data.totalSubmissions.toLocaleString()}
      />
      <StatCell
        label="Average Runtime"
        value={
          data.averageRuntime != null ? `${data.averageRuntime} ms` : '—'
        }
      />
    </div>
  );
}
