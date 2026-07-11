import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  registerSchema,
  type RegisterFormValues,
} from '@/features/auth/schemas/auth.schemas';
import { paths } from '@/routes/paths';
import { applyApiFormErrors } from '@/utils/apply-api-form-errors';

export function RegisterForm() {
  const { register: registerUser, isLoading } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      // `name` is collected for UX; the backend register contract has no name field.
      await registerUser({
        username: values.username,
        email: values.email,
        password: values.password,
      });
      navigate(paths.login, { replace: true });
    } catch (err) {
      applyApiFormErrors(err, setError, 'Registration failed.');
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Join JudgeX and start practicing today.</CardDescription>
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

          <FormField label="Name" htmlFor="name" error={errors.name?.message} required>
            <Input
              id="name"
              autoComplete="name"
              autoFocus
              aria-invalid={Boolean(errors.name)}
              error={Boolean(errors.name)}
              {...register('name')}
            />
          </FormField>

          <FormField
            label="Username"
            htmlFor="username"
            error={errors.username?.message}
            required
          >
            <Input
              id="username"
              autoComplete="username"
              aria-invalid={Boolean(errors.username)}
              error={Boolean(errors.username)}
              {...register('username')}
            />
          </FormField>

          <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              error={Boolean(errors.email)}
              {...register('email')}
            />
          </FormField>

          <FormField
            label="Password"
            htmlFor="password"
            error={errors.password?.message}
            hint="At least 8 characters"
            required
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              error={Boolean(errors.password)}
              {...register('password')}
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
              aria-invalid={Boolean(errors.confirmPassword)}
              error={Boolean(errors.confirmPassword)}
              {...register('confirmPassword')}
            />
          </FormField>

          <Button type="submit" className="w-full" loading={isLoading} disabled={isLoading}>
            Create account
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to={paths.login} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-muted">
          Didn&apos;t get a verification email?{' '}
          <Link
            to={paths.resendVerification}
            className="font-medium text-primary hover:underline"
          >
            Resend verification
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
