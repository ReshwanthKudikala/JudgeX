import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/common/Skeleton';
import { useAdminAnalytics } from '@/features/admin/hooks/useAdmin';
import { useChartTheme } from '@/hooks/useChartTheme';
import { ApiError } from '@/types';

export function AdminAnalyticsPage() {
  const { data, isLoading, isError, error, refetch } = useAdminAnalytics(14);
  const chartTheme = useChartTheme();

  if (isLoading) {
    return (
      <div aria-busy="true" aria-label="Loading analytics">
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-error">
        {error instanceof ApiError ? error.message : 'Failed to load analytics.'}{' '}
        <button type="button" className="underline" onClick={() => void refetch()}>
          Retry
        </button>
      </p>
    );
  }

  const tooltipStyle = {
    backgroundColor: chartTheme.tooltip.background,
    border: `1px solid ${chartTheme.tooltip.border}`,
    borderRadius: 8,
    color: chartTheme.tooltip.color,
  };
  const tick = { fill: chartTheme.tick, fontSize: 11 };

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Daily submissions</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.dailySubmissions}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="date" tick={tick} />
              <YAxis tick={tick} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line
                type="monotone"
                dataKey="submissions"
                stroke={chartTheme.series.blue}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="accepted"
                stroke={chartTheme.series.green}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Language usage</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.languageUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="language" tick={tick} />
                <YAxis tick={tick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={chartTheme.series.purple} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contest participation</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.contestParticipation}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="title" tick={{ fill: chartTheme.tick, fontSize: 10 }} hide />
                <YAxis tick={tick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="participants" fill={chartTheme.difficulty.medium} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most solved problems</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.mostSolvedProblems.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="text-foreground">{p.title}</span>
                  <span className="text-muted">{p.solvedCount}</span>
                </li>
              ))}
              {data.mostSolvedProblems.length === 0 ? (
                <li className="text-muted">No data yet.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              Most active users · acceptance {data.acceptanceRate}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.mostActiveUsers.map((u) => (
                <li key={u.id} className="flex justify-between gap-2">
                  <span className="text-foreground">@{u.username}</span>
                  <span className="text-muted">
                    {u.submissionCount} subs · {u.problemsSolved} solved
                  </span>
                </li>
              ))}
              {data.mostActiveUsers.length === 0 ? (
                <li className="text-muted">No data yet.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
