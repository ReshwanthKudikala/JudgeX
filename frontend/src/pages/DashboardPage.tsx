import { Link } from 'react-router-dom';
import { BookOpen, Trophy, User } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/common/Skeleton';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isValidatingSession = useAuthStore((s) => s.isValidatingSession);

  if (!isHydrated || isValidatingSession) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white">
          {user ? (
            <>
              Welcome back, <span className="text-primary">{user.username}</span>
            </>
          ) : (
            'Welcome to JudgeX'
          )}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {user
            ? 'Pick up where you left off — solve problems and climb the ranks.'
            : 'Practice problems, submit solutions, and climb the leaderboard.'}
        </p>
      </div>

      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Quick actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="transition-colors hover:border-primary/40">
            <CardHeader>
              <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-md bg-primary-muted text-primary">
                <BookOpen className="h-4 w-4" aria-hidden />
              </div>
              <CardTitle>Problems</CardTitle>
              <CardDescription>Browse and solve coding challenges</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to={paths.problems}>
                <Button variant="secondary" size="sm">
                  View Problems
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/40">
            <CardHeader>
              <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-md bg-primary-muted text-primary">
                <Trophy className="h-4 w-4" aria-hidden />
              </div>
              <CardTitle>Leaderboard</CardTitle>
              <CardDescription>See how you rank against others</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to={paths.leaderboard}>
                <Button variant="secondary" size="sm">
                  Open leaderboard
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="transition-colors hover:border-primary/40">
            <CardHeader>
              <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-md bg-primary-muted text-primary">
                <User className="h-4 w-4" aria-hidden />
              </div>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account and stats</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to={token ? paths.profile : paths.login}>
                <Button variant="secondary" size="sm">
                  {token ? 'View profile' : 'Sign in to view'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
