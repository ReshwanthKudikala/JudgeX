import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/common/Skeleton';
import { useAdminDashboard } from '@/features/admin/hooks/useAdmin';
import { ApiError } from '@/types';

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function AdminDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useAdminDashboard();

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-8 text-center">
        <p className="text-sm text-error">
          {error instanceof ApiError ? error.message : 'Could not load dashboard.'}
        </p>
        <button
          type="button"
          className="mt-3 text-xs text-muted hover:text-foreground"
          onClick={() => void refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={data.users.total} />
        <StatCard
          label="Active users"
          value={data.users.active7d}
          hint={`${data.users.active30d} in last 30d`}
        />
        <StatCard
          label="Problems"
          value={data.problems.total}
          hint={`${data.problems.published} published`}
        />
        <StatCard
          label="Editorials"
          value={data.editorials.total}
          hint={`${data.editorials.published} published`}
        />
        <StatCard label="Discussions" value={data.discussions} />
        <StatCard label="Contests" value={data.contests} />
        <StatCard
          label="Submissions"
          value={data.submissions.total}
          hint={`${data.submissions.accepted} accepted (${data.submissions.acceptanceRate}%)`}
        />
        <StatCard
          label="Queue health"
          value={data.queue.healthy ? 'OK' : 'Down'}
          hint={
            data.queue.counts
              ? `waiting ${data.queue.counts.waiting ?? 0} · active ${data.queue.counts.active ?? 0} · failed ${data.queue.counts.failed ?? 0}`
              : data.queue.error || 'unavailable'
          }
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Worker</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Status:{' '}
          <span className={data.worker.healthy ? 'text-success' : 'text-error'}>
            {data.worker.healthy ? 'healthy' : 'unhealthy'}
          </span>
          {' · '}
          active {data.worker.activeJobs}, waiting {data.worker.waitingJobs}, failed{' '}
          {data.worker.failedJobs}
        </CardContent>
      </Card>
    </div>
  );
}
