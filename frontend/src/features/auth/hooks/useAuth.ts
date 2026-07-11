import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as authApi from '@/api/auth.api';
import { useAuthStore, useToastStore } from '@/store';
import { ApiError } from '@/types';
import type { LoginInput, RegisterInput } from '@/types/auth';

export function useAuth() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const setSession = useAuthStore((s) => s.setSession);
  const setLoading = useAuthStore((s) => s.setLoading);
  const logoutStore = useAuthStore((s) => s.logout);
  const pushToast = useToastStore((s) => s.push);

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onMutate: () => setLoading(true),
    onSuccess: (session) => {
      setSession(session.user, session.accessToken);
      pushToast({
        title: 'Welcome back',
        description: `Signed in as ${session.user.username}`,
        variant: 'success',
      });
    },
    onError: (err: unknown) => {
      setLoading(false);
      const message = err instanceof ApiError ? err.message : 'Login failed.';
      pushToast({ title: 'Login failed', description: message, variant: 'error' });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onMutate: () => setLoading(true),
    onSuccess: (session) => {
      setSession(session.user, session.accessToken);
      pushToast({
        title: 'Account created',
        description: `Welcome, ${session.user.username}`,
        variant: 'success',
      });
    },
    onError: (err: unknown) => {
      setLoading(false);
      const message = err instanceof ApiError ? err.message : 'Registration failed.';
      pushToast({ title: 'Registration failed', description: message, variant: 'error' });
    },
  });

  const logout = useCallback(() => {
    logoutStore();
    queryClient.clear();
    pushToast({ title: 'Signed out', variant: 'default' });
  }, [logoutStore, pushToast, queryClient]);

  return {
    user,
    token,
    isAuthenticated: Boolean(token),
    isLoading: isLoading || loginMutation.isPending || registerMutation.isPending,
    isHydrated,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout,
  };
}
