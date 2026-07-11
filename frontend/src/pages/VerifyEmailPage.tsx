import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { verifyEmail } from '@/api/auth.api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';
import { ApiError } from '@/types';
import { getFriendlyErrorMessage } from '@/utils/errors';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() || '';
  const setUser = useAuthStore((s) => s.setUser);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    token ? 'loading' : 'error',
  );
  const [message, setMessage] = useState(
    token ? 'Verifying your email…' : 'Missing verification token.',
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await verifyEmail(token);
        if (cancelled) return;
        setStatus('success');
        setMessage(result.message || 'Email verified successfully.');
        const current = useAuthStore.getState().user;
        if (current && current.id === result.user.id) {
          setUser(result.user);
        }
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(
          err instanceof ApiError
            ? getFriendlyErrorMessage(err)
            : 'This verification link is invalid or has expired.',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, setUser]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email verification</CardTitle>
        <CardDescription>Confirm the email address on your JudgeX account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="status"
          className={
            status === 'error'
              ? 'rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error'
              : status === 'success'
                ? 'rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success'
                : 'rounded-md border border-border px-3 py-2 text-sm text-muted'
          }
        >
          {message}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={paths.login}>
            <Button variant="secondary" size="sm">
              Sign in
            </Button>
          </Link>
          {status === 'error' ? (
            <Link to={paths.resendVerification}>
              <Button size="sm">Resend verification</Button>
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
