import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/common/Skeleton';
import { useAuthStore } from '@/store';

function formatJoinedDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const isValidatingSession = useAuthStore((s) => s.isValidatingSession);

  if (isValidatingSession || !user) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  const joined = formatJoinedDate(user.createdAt);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-[#1a1a1a]"
          aria-hidden
        >
          {user.username.charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-white">{user.username}</h1>
          <p className="mt-0.5 text-sm text-muted">{user.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your JudgeX identity (read-only).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex items-center justify-between border-b border-border py-3">
            <span className="text-muted">Username</span>
            <span className="font-medium text-white">{user.username}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border py-3">
            <span className="text-muted">Email</span>
            <span className="text-muted-foreground">{user.email}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border py-3">
            <span className="text-muted">Role</span>
            <Badge variant={user.role === 'admin' ? 'primary' : 'default'}>{user.role}</Badge>
          </div>
          {joined ? (
            <div className="flex items-center justify-between py-3">
              <span className="text-muted">Joined</span>
              <span className="text-muted-foreground">{joined}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
