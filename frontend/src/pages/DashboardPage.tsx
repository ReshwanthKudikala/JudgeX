import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white">
          {user ? `Welcome back, ${user.username}` : 'Welcome to JudgeX'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Practice problems, submit solutions, and climb the leaderboard.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Problems</CardTitle>
            <CardDescription>Browse the problem set</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="medium">Coming next sprint</Badge>
            <div className="mt-4">
              <Link to={paths.problems}>
                <Button variant="secondary" size="sm">
                  View problems
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leaderboard</CardTitle>
            <CardDescription>See top solvers</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="default">Placeholder</Badge>
            <div className="mt-4">
              <Link to={paths.leaderboard}>
                <Button variant="secondary" size="sm">
                  Open leaderboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your stats and submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="primary">Auth ready</Badge>
            <div className="mt-4">
              <Link to={paths.profile}>
                <Button variant="secondary" size="sm">
                  View profile
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
