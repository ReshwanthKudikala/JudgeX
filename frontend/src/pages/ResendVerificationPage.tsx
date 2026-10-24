import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';

import { resendVerification } from '@/api/auth.api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  resendVerificationSchema,
  type ResendVerificationFormValues,
} from '@/features/auth/schemas/auth.schemas';
import { paths } from '@/routes/paths';
import { applyApiFormErrors } from '@/utils/apply-api-form-errors';

export function ResendVerificationPage() {
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResendVerificationFormValues>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await resendVerification(values.email.trim());
      setDoneMessage(result.message);
    } catch (err) {
      applyApiFormErrors(err, setError, 'Unable to resend verification email.');
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resend verification</CardTitle>
        <CardDescription>
          If an unverified account exists for this address, a new verification message is
          requested. This page does not say whether the address is registered.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {doneMessage ? (
          <div className="space-y-4">
            <div
              role="status"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
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
              Request verification message
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
