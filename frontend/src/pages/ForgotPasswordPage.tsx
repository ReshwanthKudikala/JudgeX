import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';

import { forgotPassword } from '@/api/auth.api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '@/features/auth/schemas/auth.schemas';
import { paths } from '@/routes/paths';
import { applyApiFormErrors } from '@/utils/apply-api-form-errors';

export function ForgotPasswordPage() {
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await forgotPassword(values.email.trim());
      setDoneMessage(result.message);
    } catch (err) {
      applyApiFormErrors(err, setError, 'Unable to send reset email.');
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>
          Enter your account email and we will send a reset link if it exists.
        </CardDescription>
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
            <Link to={paths.login} className="text-sm font-medium text-primary hover:underline">
              Back to sign in
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
            <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                error={Boolean(errors.email)}
                {...register('email')}
              />
            </FormField>
            <Button type="submit" className="w-full" loading={isSubmitting} disabled={isSubmitting}>
              Send reset link
            </Button>
            <p className="text-center text-sm text-muted">
              <Link to={paths.login} className="font-medium text-primary hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
