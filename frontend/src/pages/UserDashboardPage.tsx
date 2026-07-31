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
import {
  Award,
  CheckCircle2,
  CircleDot,
  Flame,
  Layers,
  Percent,
  Send,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { Skeleton } from '@/components/common/Skeleton';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { VerdictBadge } from '@/features/submissions/components/VerdictBadge';
import { useDashboard } from '@/features/dashboard/hooks/useDashboard';
import { useAuthHydration } from '@/hooks/useAuthHydration';
import { useChartTheme } from '@/hooks/useChartTheme';
import { paths } from '@/routes/paths';
import { ApiError } from '@/types';
import {
  LANGUAGE_LABELS,
  type SubmissionLanguage,
  type SubmissionSummary,
} from '@/types/submissions';
import { useAuthStore } from '@/store';
import { cn } from '@/utils/cn';

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
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <Card className="group overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="relative pb-2">
        <div
          className={cn(
            'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100',
            accent,
          )}
          aria-hidden
        />
        <div className="relative flex items-start justify-between gap-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted">
            {label}
          </CardTitle>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-overlay text-muted transition-colors duration-150 group-hover:text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        </div>
      </CardHeader>
      <CardContent className="relative">
        <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
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
      <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted shadow-card">
        No submissions yet.{' '}
        <Link to={paths.problems} className="text-primary hover:underline">
          Browse problems
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border shadow-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 border-b border-border bg-surface">
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
                className="cursor-pointer border-b border-border/80 transition-colors duration-150 hover:bg-overlay focus-visible:bg-overlay focus-visible:outline-none"
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
                <td className="px-4 py-3 font-medium text-foreground">{title}</td>
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
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
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
  const chartTheme = useChartTheme();

  if (!isHydrated || isValidatingSession || isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
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

  const tooltipStyle = {
    backgroundColor: chartTheme.tooltip.background,
    border: `1px solid ${chartTheme.tooltip.border}`,
    borderRadius: 8,
    color: chartTheme.tooltip.color,
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
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
          <SummaryCard
            label="Problems Solved"
            value={String(summary.solved)}
            icon={Award}
            accent="bg-gradient-to-br from-primary/10 to-transparent"
          />
          <SummaryCard
            label="Easy Solved"
            value={String(summary.easySolved)}
            icon={CircleDot}
            accent="bg-gradient-to-br from-success/10 to-transparent"
          />
          <SummaryCard
            label="Medium Solved"
            value={String(summary.mediumSolved)}
            icon={Zap}
            accent="bg-gradient-to-br from-warning/10 to-transparent"
          />
          <SummaryCard
            label="Hard Solved"
            value={String(summary.hardSolved)}
            icon={Layers}
            accent="bg-gradient-to-br from-error/10 to-transparent"
          />
          <SummaryCard
            label="Accepted Submissions"
            value={String(summary.acceptedSubmissions)}
            icon={CheckCircle2}
            accent="bg-gradient-to-br from-success/10 to-transparent"
          />
          <SummaryCard
            label="Total Submissions"
            value={String(summary.totalSubmissions)}
            icon={Send}
            accent="bg-gradient-to-br from-primary/10 to-transparent"
          />
          <SummaryCard
            label="Acceptance Rate"
            value={`${summary.acceptanceRate.toFixed(1)}%`}
            icon={Percent}
            accent="bg-gradient-to-br from-primary/10 to-transparent"
          />
          <SummaryCard
            label="Current Streak"
            value={
              summary.currentStreak != null
                ? String(summary.currentStreak)
                : '—'
            }
            hint="Coming soon"
            icon={Flame}
            accent="bg-gradient-to-br from-warning/10 to-transparent"
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
          <Card className="transition-shadow duration-200 hover:shadow-md">
            <CardHeader>
              <CardTitle>Problems solved by difficulty</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {hasDifficulty ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={difficultyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: chartTheme.tick, fontSize: 11 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: chartTheme.tick, fontSize: 11 }}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {difficultyData.map((entry) => (
                        <Cell
                          key={entry.difficulty}
                          fill={
                            chartTheme.difficulty[
                              entry.difficulty as keyof typeof chartTheme.difficulty
                            ] ?? chartTheme.series.blue
                          }
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

          <Card className="transition-shadow duration-200 hover:shadow-md">
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
                          fill={
                            chartTheme.verdict[
                              entry.verdict as keyof typeof chartTheme.verdict
                            ] ?? chartTheme.series.blue
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
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
