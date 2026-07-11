import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Sign in to view your profile.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to={paths.login}>
            <Button size="sm">Sign in</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white">{user.username}</h1>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Basic identity from the auth session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-border py-2">
            <span className="text-muted">Role</span>
            <Badge variant={user.role === 'admin' ? 'primary' : 'default'}>{user.role}</Badge>
          </div>
          <div className="flex items-center justify-between border-b border-border py-2">
            <span className="text-muted">User ID</span>
            <span className="font-mono text-xs text-muted-foreground">{user.id}</span>
          </div>
          {user.createdAt ? (
            <div className="flex items-center justify-between py-2">
              <span className="text-muted">Joined</span>
              <span className="text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stats</CardTitle>
          <CardDescription>Solved counts and submission history come later.</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="default">Placeholder</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
