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
import { ApiError } from '@/types';

export function AdminAnalyticsPage() {
  const { data, isLoading, isError, error, refetch } = useAdminAnalytics(14);

  if (isLoading) {
    return <Skeleton className="h-96 w-full rounded-lg" />;
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Daily submissions</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.dailySubmissions}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={{ fill: '#999', fontSize: 11 }} />
              <YAxis tick={{ fill: '#999', fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="submissions" stroke="#60a5fa" strokeWidth={2} />
              <Line type="monotone" dataKey="accepted" stroke="#34d399" strokeWidth={2} />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="language" tick={{ fill: '#999', fontSize: 11 }} />
                <YAxis tick={{ fill: '#999', fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#a78bfa" />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="title" tick={{ fill: '#999', fontSize: 10 }} hide />
                <YAxis tick={{ fill: '#999', fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="participants" fill="#fbbf24" />
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
