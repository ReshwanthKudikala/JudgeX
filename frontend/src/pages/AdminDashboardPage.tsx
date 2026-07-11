import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/common/Skeleton';
import { useAdminDashboard, useAdminMonitoring } from '@/features/admin/hooks/useAdmin';
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

function HealthPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
        ok ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-success' : 'bg-error'}`} />
      {label}
    </span>
  );
}

export function AdminDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useAdminDashboard();
  const monitoring = useAdminMonitoring();

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

  const mon = monitoring.data;
  const depth = mon?.queue.depth;

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
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Platform monitoring</CardTitle>
          <span className="text-xs text-muted">refreshes every 15s</span>
        </CardHeader>
        <CardContent className="space-y-4">
          {monitoring.isLoading && !mon ? (
            <Skeleton className="h-24 w-full rounded-lg" />
          ) : monitoring.isError || !mon ? (
            <p className="text-sm text-error">Could not load live monitoring.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <HealthPill
                  ok={mon.ready && !mon.degraded}
                  label={mon.degraded ? 'degraded' : mon.status}
                />
                <HealthPill ok={mon.checks.postgres.ok} label="Database" />
                <HealthPill ok={mon.checks.redis.ok} label="Redis" />
                <HealthPill ok={mon.checks.bullmq.ok} label="BullMQ" />
                <HealthPill ok={mon.checks.worker.ok} label="Worker" />
                <HealthPill ok={mon.checks.docker.ok} label="Docker" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div>
                  <p className="text-muted">Release</p>
                  <p className="text-foreground">
                    v{mon.version ?? '—'}
                    {mon.build?.gitSha && mon.build.gitSha !== 'unknown'
                      ? ` · ${mon.build.gitSha.slice(0, 7)}`
                      : ''}
                  </p>
                </div>
                <div>
                  <p className="text-muted">Queue depth</p>
                  <p className="text-foreground">
                    waiting {depth?.waiting ?? 0} · active {depth?.active ?? 0} · failed{' '}
                    {depth?.failed ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-muted">Worker uptime</p>
                  <p className="text-foreground">
                    {mon.worker.uptime != null
                      ? `${Math.floor(mon.worker.uptime)}s`
                      : 'offline'}
                    {mon.worker.lastSeenAt
                      ? ` · seen ${new Date(mon.worker.lastSeenAt).toLocaleTimeString()}`
                      : ''}
                  </p>
                </div>
                <div>
                  <p className="text-muted">DB latency</p>
                  <p className="text-foreground">
                    {mon.checks.postgres.latencyMs != null
                      ? `${mon.checks.postgres.latencyMs}ms`
                      : mon.checks.postgres.error || 'n/a'}
                  </p>
                </div>
                <div>
                  <p className="text-muted">Redis latency</p>
                  <p className="text-foreground">
                    {mon.checks.redis.latencyMs != null
                      ? `${mon.checks.redis.latencyMs}ms`
                      : mon.checks.redis.error || 'n/a'}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Recent failures</p>
                {mon.recentFailures.length === 0 ? (
                  <p className="text-xs text-muted">No recent failed jobs.</p>
                ) : (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {mon.recentFailures.slice(0, 5).map((job) => (
                      <li key={job.id} className="truncate">
                        {job.data?.submissionId ?? job.id}: {job.failedReason || 'failed'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
          {data.worker.uptime != null ? ` · uptime ${Math.floor(data.worker.uptime)}s` : ''}
        </CardContent>
      </Card>
    </div>
  );
}
