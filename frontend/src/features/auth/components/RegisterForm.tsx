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

export function RegisterForm() {
  const { register: registerUser, isLoading } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerUser({
        username: values.username,
        email: values.email,
        password: values.password,
      });
      navigate(paths.home, { replace: true });
    } catch {
      /* toast handled in useAuth */
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
          <FormField
            label="Username"
            htmlFor="username"
            error={errors.username?.message}
            required
          >
            <Input
              id="username"
              autoComplete="username"
              error={Boolean(errors.username)}
              {...register('username')}
            />
          </FormField>

          <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
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
              error={Boolean(errors.confirmPassword)}
              {...register('confirmPassword')}
            />
          </FormField>

          <Button type="submit" className="w-full" loading={isLoading}>
            Create account
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to={paths.login} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
