import { useNavigate, Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Skeleton } from '@/components/common/Skeleton';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { VerdictBadge } from '@/features/submissions/components/VerdictBadge';
import { useDashboard } from '@/features/dashboard/hooks/useDashboard';
import { useAuthHydration } from '@/hooks/useAuthHydration';
import { paths } from '@/routes/paths';
import { ApiError } from '@/types';
import {
  LANGUAGE_LABELS,
  type SubmissionLanguage,
  type SubmissionSummary,
} from '@/types/submissions';
import { useAuthStore } from '@/store';
import { cn } from '@/utils/cn';

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#34d399',
  medium: '#fbbf24',
  hard: '#f87171',
};

const VERDICT_COLORS: Record<string, string> = {
  accepted: '#34d399',
  failed: '#f87171',
};

function formatWhen(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums text-white">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function RecentActivityTable({
  submissions,
}: {
  submissions: SubmissionSummary[];
}) {
  const navigate = useNavigate();

  if (submissions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
        No submissions yet.{' '}
        <Link to={paths.problems} className="text-primary hover:underline">
          Browse problems
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="border-b border-border bg-[#151820]">
          <tr>
            {['Verdict', 'Problem', 'Language', 'Runtime', 'Time'].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {submissions.map((row) => {
            const id = row.submissionId ?? row.id;
            const runtime = row.runtime ?? row.runtimeMs ?? null;
            const title = row.problem?.title ?? row.problemTitle ?? '—';
            return (
              <tr
                key={id}
                role="link"
                tabIndex={0}
                className="cursor-pointer border-b border-border/80 transition-colors hover:bg-white/[0.03]"
                onClick={() => navigate(paths.submissionDetail(id))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(paths.submissionDetail(id));
                  }
                }}
              >
                <td className="px-4 py-3">
                  <VerdictBadge verdict={row.verdict} status={row.status} />
                </td>
                <td className="px-4 py-3 font-medium text-white">{title}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {LANGUAGE_LABELS[row.language as SubmissionLanguage] ??
                    row.language}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {runtime != null ? `${runtime} ms` : '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatWhen(row.submittedAt ?? row.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthHydration();
  const isValidatingSession = useAuthStore((s) => s.isValidatingSession);
  const { data, isLoading, isError, error, refetch } = useDashboard();

  if (!isHydrated || isValidatingSession || isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-error">
          {error instanceof ApiError
            ? error.message
            : 'Failed to load dashboard.'}{' '}
          <button type="button" className="underline" onClick={() => void refetch()}>
            Retry
          </button>
        </p>
      </div>
    );
  }

  const { summary, recentSubmissions, charts } = data;
  const difficultyData = charts.difficultyBreakdown.map((d) => ({
    ...d,
    label: d.difficulty.charAt(0).toUpperCase() + d.difficulty.slice(1),
  }));
  const verdictData = charts.verdictBreakdown.map((v) => ({
    ...v,
    name: v.label ?? v.verdict,
  }));
  const hasDifficulty = difficultyData.some((d) => d.count > 0);
  const hasVerdict = verdictData.some((v) => v.count > 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {user
              ? `Your progress overview, ${user.username}.`
              : 'Your progress overview.'}
          </p>
        </div>
        <Link to={paths.problems}>
          <Button size="sm" variant="secondary">
            Solve problems
          </Button>
        </Link>
      </div>

      <section aria-labelledby="summary-heading" className="space-y-3">
        <h2
          id="summary-heading"
          className="text-sm font-medium uppercase tracking-wide text-muted"
        >
          Summary
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Problems Solved" value={String(summary.solved)} />
          <SummaryCard label="Easy Solved" value={String(summary.easySolved)} />
          <SummaryCard label="Medium Solved" value={String(summary.mediumSolved)} />
          <SummaryCard label="Hard Solved" value={String(summary.hardSolved)} />
          <SummaryCard
            label="Accepted Submissions"
            value={String(summary.acceptedSubmissions)}
          />
          <SummaryCard
            label="Total Submissions"
            value={String(summary.totalSubmissions)}
          />
          <SummaryCard
            label="Acceptance Rate"
            value={`${summary.acceptanceRate.toFixed(1)}%`}
          />
          <SummaryCard
            label="Current Streak"
            value={
              summary.currentStreak != null
                ? String(summary.currentStreak)
                : '—'
            }
            hint="Coming soon"
          />
        </div>
      </section>

      <section aria-labelledby="activity-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="activity-heading"
            className="text-sm font-medium uppercase tracking-wide text-muted"
          >
            Recent Activity
          </h2>
          <Link
            to={paths.submissions}
            className="text-xs text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <RecentActivityTable submissions={recentSubmissions} />
      </section>

      <section aria-labelledby="charts-heading" className="space-y-3">
        <h2
          id="charts-heading"
          className="text-sm font-medium uppercase tracking-wide text-muted"
        >
          Charts
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Problems solved by difficulty</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {hasDifficulty ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={difficultyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="label" tick={{ fill: '#999', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#999', fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {difficultyData.map((entry) => (
                        <Cell
                          key={entry.difficulty}
                          fill={DIFFICULTY_COLORS[entry.difficulty] ?? '#60a5fa'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="Solve a problem to see difficulty breakdown." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accepted vs Failed</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {hasVerdict ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={verdictData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {verdictData.map((entry) => (
                        <Cell
                          key={entry.verdict}
                          fill={VERDICT_COLORS[entry.verdict] ?? '#60a5fa'}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="Submit a solution to see accepted vs failed." />
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div
      className={cn(
        'flex h-full items-center justify-center rounded-md border border-dashed border-border px-4 text-center text-sm text-muted',
      )}
    >
      {message}
    </div>
  );
}
