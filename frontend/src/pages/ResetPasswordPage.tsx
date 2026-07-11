import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';

import { resetPassword } from '@/api/auth.api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '@/features/auth/schemas/auth.schemas';
import { paths } from '@/routes/paths';
import { applyApiFormErrors } from '@/utils/apply-api-form-errors';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const tokenFromUrl = params.get('token')?.trim() || '';
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: tokenFromUrl,
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await resetPassword({
        token: values.token.trim(),
        newPassword: values.newPassword,
      });
      setDoneMessage(result.message);
    } catch (err) {
      applyApiFormErrors(err, setError, 'Unable to reset password.');
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Choose a new password for your JudgeX account.</CardDescription>
      </CardHeader>
      <CardContent>
        {doneMessage ? (
          <div className="space-y-4">
            <div
              role="status"
              className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
            >
              {doneMessage}
            </div>
            <Link to={paths.login}>
              <Button className="w-full">Sign in</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {errors.root?.message ? (
              <div
                role="alert"
                className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error"
              >
                {errors.root.message}
              </div>
            ) : null}
            {!tokenFromUrl ? (
              <FormField label="Reset token" htmlFor="token" error={errors.token?.message} required>
                <Input id="token" error={Boolean(errors.token)} {...register('token')} />
              </FormField>
            ) : (
              <input type="hidden" {...register('token')} />
            )}
            <FormField
              label="New password"
              htmlFor="newPassword"
              error={errors.newPassword?.message}
              required
            >
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                error={Boolean(errors.newPassword)}
                {...register('newPassword')}
              />
            </FormField>
            <FormField
              label="Confirm password"
              htmlFor="confirmPassword"
              error={errors.confirmPassword?.message}
              required
            >
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                error={Boolean(errors.confirmPassword)}
                {...register('confirmPassword')}
              />
            </FormField>
            <Button type="submit" className="w-full" loading={isSubmitting} disabled={isSubmitting}>
              Update password
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
