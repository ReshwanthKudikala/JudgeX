import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  loginSchema,
  type LoginFormValues,
} from '@/features/auth/schemas/auth.schemas';
import { paths } from '@/routes/paths';
import { applyApiFormErrors } from '@/utils/apply-api-form-errors';
import { cn } from '@/utils/cn';

export function LoginForm() {
  const { login, isLoading, rememberMe } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    paths.home;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      emailOrUsername: '',
      password: '',
      rememberMe: rememberMe ?? true,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login({
        email: values.emailOrUsername.trim(),
        password: values.password,
        rememberMe: values.rememberMe,
      });
      navigate(from, { replace: true });
    } catch (err) {
      applyApiFormErrors(err, setError, 'Invalid email or password.');
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to JudgeX</CardTitle>
        <CardDescription>Continue solving problems and climbing the ranks.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {errors.root?.message ? (
            <div
              role="alert"
              className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error"
            >
              {errors.root.message}
            </div>
          ) : null}

          <FormField
            label="Email or username"
            htmlFor="emailOrUsername"
            error={errors.emailOrUsername?.message}
            hint="Use the email address you registered with."
            required
          >
            <Input
              id="emailOrUsername"
              type="text"
              autoComplete="username"
              autoFocus
              aria-invalid={Boolean(errors.emailOrUsername)}
              error={Boolean(errors.emailOrUsername)}
              {...register('emailOrUsername')}
            />
          </FormField>

          <FormField
            label="Password"
            htmlFor="password"
            error={errors.password?.message}
            required
          >
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              error={Boolean(errors.password)}
              {...register('password')}
            />
          </FormField>

          <div className="flex items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className={cn(
                  'h-4 w-4 rounded border-border bg-background text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                )}
                {...register('rememberMe')}
              />
              Remember me
            </label>
            <Link
              to={paths.forgotPassword}
              className="text-sm font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={isLoading} disabled={isLoading}>
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          New to JudgeX?{' '}
          <Link to={paths.register} className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
