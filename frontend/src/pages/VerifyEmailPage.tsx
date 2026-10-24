import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { verifyEmail } from '@/api/auth.api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  readAuthToken,
  verificationFailureCopy,
  verifyEmailOnce,
} from '@/features/auth/verification-feedback.js';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';
import { ApiError } from '@/types';

type VerifyStatus = 'loading' | 'success' | 'expired' | 'used' | 'invalid' | 'network' | 'missing';

function statusFromError(err: unknown): { status: VerifyStatus; message: string } {
  if (err instanceof ApiError) {
    if (err.status === 0 || err.code === 'NETWORK_ERROR') {
      return {
        status: 'network',
        message: verificationFailureCopy('NETWORK_ERROR'),
      };
    }
    if (err.code === 'EXPIRED_VERIFICATION_TOKEN') {
      return { status: 'expired', message: verificationFailureCopy(err.code) };
    }
    if (err.code === 'USED_VERIFICATION_TOKEN') {
      return { status: 'used', message: verificationFailureCopy(err.code) };
    }
    if (err.code === 'INVALID_VERIFICATION_TOKEN') {
      return { status: 'invalid', message: verificationFailureCopy(err.code) };
    }
    return {
      status: 'invalid',
      message: err.message || 'This verification link is invalid.',
    };
  }
  return {
    status: 'network',
    message: verificationFailureCopy('NETWORK_ERROR'),
  };
}

export function VerifyEmailPage() {
  const setUser = useAuthStore((s) => s.setUser);
  const signedIn = useAuthStore((s) => Boolean(s.token));
  const location = useLocation();
  const [token, setToken] = useState(() => readAuthToken());
  const [status, setStatus] = useState<VerifyStatus>(token ? 'loading' : 'missing');
  const [message, setMessage] = useState(
    token ? 'Verifying your email…' : 'This page needs a verification link. The token is missing.',
  );

  useEffect(() => {
    const next = readAuthToken();
    if (!next || next === token) return;
    setToken(next);
    setStatus('loading');
    setMessage('Verifying your email…');
  }, [location.hash, location.search, token]);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    const onHashChange = () => {
      const next = readAuthToken();
      if (!next) return;
      setToken(next);
      setStatus('loading');
      setMessage('Verifying your email…');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      meta.remove();
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    verifyEmailOnce(token, verifyEmail)
      .then((result) => {
        if (!active) return;
        setStatus('success');
        setMessage(result.message || 'Email verified successfully.');
        const current = useAuthStore.getState().user;
        if (current && current.id === result.user.id) {
          setUser(result.user);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        const failure = statusFromError(err);
        setStatus(failure.status);
        setMessage(failure.message);
      });
    return () => {
      active = false;
    };
  }, [token, setUser]);

  const isError = status !== 'loading' && status !== 'success';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email verification</CardTitle>
        <CardDescription>
          Confirm the email address on your JudgeX account. Verification is not required to sign
          in or submit solutions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="status"
          className={
            isError
              ? 'rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error'
              : status === 'success'
                ? 'rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success'
                : 'rounded-md border border-border px-3 py-2 text-sm text-muted'
          }
        >
          {message}
        </div>
        <div className="flex flex-wrap gap-2">
          {signedIn ? (
            <Link to={paths.profile}>
              <Button variant="secondary" size="sm">
                Profile
              </Button>
            </Link>
          ) : (
            <Link to={paths.login}>
              <Button variant="secondary" size="sm">
                Sign in
              </Button>
            </Link>
          )}
          {isError ? (
            <Link to={signedIn ? paths.profile : paths.resendVerification}>
              <Button size="sm">Request a new link</Button>
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
