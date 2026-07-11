import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { changePassword, resendVerificationMe } from '@/api/auth.api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/common/Skeleton';
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '@/features/auth/schemas/auth.schemas';
import { useUserRank } from '@/features/leaderboard/hooks/useUserRank';
import { SubmissionsErrorState } from '@/features/submissions/components/SubmissionsErrorState';
import { SubmissionsTable } from '@/features/submissions/components/SubmissionsTable';
import { VerdictBadge } from '@/features/submissions/components/VerdictBadge';
import { useSubmissionStats } from '@/features/submissions/hooks/useSubmissionStats';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';
import { LANGUAGE_LABELS, type SubmissionLanguage } from '@/types/submissions';
import { applyApiFormErrors } from '@/utils/apply-api-form-errors';
import { getFriendlyErrorMessage } from '@/utils/errors';

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

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const body = (
    <div className="rounded-lg border border-border bg-[#12151b] px-4 py-3 transition-colors hover:border-primary/40">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
  if (href) {
    return (
      <Link to={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
        {body}
      </Link>
    );
  }
  return body;
}

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const rememberMe = useAuthStore((s) => s.rememberMe);
  const isValidatingSession = useAuthStore((s) => s.isValidatingSession);

  const statsQuery = useSubmissionStats(Boolean(token));
  const rankQuery = useUserRank(user?.id, Boolean(token));

  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

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
  const progress = statsQuery.data;
  const favourite =
    progress?.favouriteLanguage &&
    (LANGUAGE_LABELS[progress.favouriteLanguage as SubmissionLanguage] ??
      progress.favouriteLanguage);

  const rankDisplay =
    rankQuery.data?.rank != null ? `#${rankQuery.data.rank}` : 'Unranked';

  const onResend = async () => {
    setResendLoading(true);
    setResendError(null);
    setResendMessage(null);
    try {
      const result = await resendVerificationMe();
      setResendMessage(result.message);
    } catch (err) {
      setResendError(getFriendlyErrorMessage(err, 'Unable to resend verification email.'));
    } finally {
      setResendLoading(false);
    }
  };

  const onChangePassword = passwordForm.handleSubmit(async (values) => {
    setPasswordMessage(null);
    try {
      const result = await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setSession(result.user, result.accessToken, rememberMe);
      setPasswordMessage(result.message);
      passwordForm.reset();
    } catch (err) {
      applyApiFormErrors(err, passwordForm.setError, 'Unable to change password.');
    }
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-[#1a1a1a]"
              aria-hidden
            >
              {user.username.charAt(0).toUpperCase()}
            </span>
            <Button variant="secondary" size="sm" disabled title="Coming soon">
              Change Profile Picture
              <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted">
                Coming Soon
              </span>
            </Button>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">{user.username}</h1>
            <p className="mt-0.5 text-sm text-muted">{user.email}</p>
          </div>
        </div>
        <Link
          to={paths.leaderboard}
          className="text-sm font-medium text-primary hover:underline"
        >
          View leaderboard →
        </Link>
      </div>

      {statsQuery.isError ? (
        <SubmissionsErrorState
          error={statsQuery.error}
          onRetry={() => void statsQuery.refetch()}
        />
      ) : statsQuery.isLoading || rankQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Current rank"
            value={rankDisplay}
            href={paths.leaderboard}
          />
          <StatCard
            label="Problems solved"
            value={progress?.problemsSolved ?? rankQuery.data?.solved ?? 0}
          />
          <StatCard
            label="Acceptance rate"
            value={`${progress?.acceptanceRate ?? rankQuery.data?.acceptanceRate ?? 0}%`}
          />
        </div>
      )}

      {progress && !statsQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total submissions" value={progress.totalSubmissions} />
          <StatCard label="Accepted" value={progress.totalAccepted} />
          <StatCard label="Favourite language" value={favourite || '—'} />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your JudgeX identity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex items-center justify-between border-b border-border py-3">
            <span className="text-muted">Username</span>
            <span className="font-medium text-white">{user.username}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3">
            <span className="text-muted">Email</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">{user.email}</span>
              {user.emailVerified ? (
                <Badge variant="success">Verified</Badge>
              ) : (
                <Badge variant="default">Unverified</Badge>
              )}
            </div>
          </div>
          {!user.emailVerified ? (
            <div className="space-y-2 border-b border-border py-3">
              <p className="text-muted">
                Verify your email to unlock the full account experience.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={resendLoading}
                disabled={resendLoading}
                onClick={() => void onResend()}
              >
                Resend verification email
              </Button>
              {resendMessage ? (
                <p className="text-sm text-success" role="status">
                  {resendMessage}
                </p>
              ) : null}
              {resendError ? (
                <p className="text-sm text-error" role="alert">
                  {resendError}
                </p>
              ) : null}
            </div>
          ) : null}
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

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Requires your current password. Other sessions will be signed out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onChangePassword} className="max-w-md space-y-4" noValidate>
            {passwordForm.formState.errors.root?.message ? (
              <div
                role="alert"
                className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error"
              >
                {passwordForm.formState.errors.root.message}
              </div>
            ) : null}
            {passwordMessage ? (
              <div
                role="status"
                className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
              >
                {passwordMessage}
              </div>
            ) : null}
            <FormField
              label="Current password"
              htmlFor="currentPassword"
              error={passwordForm.formState.errors.currentPassword?.message}
              required
            >
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                error={Boolean(passwordForm.formState.errors.currentPassword)}
                {...passwordForm.register('currentPassword')}
              />
            </FormField>
            <FormField
              label="New password"
              htmlFor="newPassword"
              error={passwordForm.formState.errors.newPassword?.message}
              required
            >
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                error={Boolean(passwordForm.formState.errors.newPassword)}
                {...passwordForm.register('newPassword')}
              />
            </FormField>
            <FormField
              label="Confirm new password"
              htmlFor="confirmPassword"
              error={passwordForm.formState.errors.confirmPassword?.message}
              required
            >
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                error={Boolean(passwordForm.formState.errors.confirmPassword)}
                {...passwordForm.register('confirmPassword')}
              />
            </FormField>
            <Button
              type="submit"
              loading={passwordForm.formState.isSubmitting}
              disabled={passwordForm.formState.isSubmitting}
            >
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Recent submissions
          </h2>
          <Link to={paths.submissions} className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        {progress?.recentSubmissions?.length ? (
          <SubmissionsTable submissions={progress.recentSubmissions} />
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            No submissions yet.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Recent accepted problems
        </h2>
        {progress?.recentAcceptedProblems?.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {progress.recentAcceptedProblems.map((item) => (
              <li
                key={item.problemId}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <Link
                  to={paths.problemDetail(item.slug)}
                  className="font-medium text-white hover:text-primary"
                >
                  {item.title}
                </Link>
                <div className="flex items-center gap-2">
                  <VerdictBadge verdict="accepted" />
                  <Link
                    to={paths.submissionDetail(item.submissionId)}
                    className="text-xs text-muted hover:text-white"
                  >
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            No accepted problems yet.
          </p>
        )}
      </section>
    </div>
  );
}
