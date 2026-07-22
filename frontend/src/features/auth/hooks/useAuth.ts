import { useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import * as authApi from '@/api/auth.api';
import { useAuthHydration } from '@/hooks/useAuthHydration';
import { paths } from '@/routes/paths';
import { useAuthStore, useToastStore } from '@/store';
import { ApiError } from '@/types';
import type { LoginInput, RegisterInput } from '@/types/auth';
import {
  isProtectedPath,
  setUnauthorizedListener,
} from '@/utils/auth-events';
import { getFriendlyErrorMessage } from '@/utils/errors';

function isAuthSessionFailure(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.status === 401 ||
      err.code === 'TOKEN_EXPIRED' ||
      err.code === 'UNAUTHENTICATED')
  );
}

export function useAuth() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const rememberMe = useAuthStore((s) => s.rememberMe);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isHydrated = useAuthHydration();
  const isValidatingSession = useAuthStore((s) => s.isValidatingSession);
  const setSession = useAuthStore((s) => s.setSession);
  const setLoading = useAuthStore((s) => s.setLoading);
  const logoutStore = useAuthStore((s) => s.logout);
  const pushToast = useToastStore((s) => s.push);

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput & { rememberMe?: boolean }) =>
      authApi.login({ email: input.email, password: input.password }).then((session) => ({
        session,
        rememberMe: input.rememberMe ?? true,
      })),
    onMutate: () => setLoading(true),
    onSuccess: ({ session, rememberMe: remember }) => {
      setSession(session.user, session.accessToken, remember);
      pushToast({
        title: 'Welcome back',
        description: `Signed in as ${session.user.username}`,
        variant: 'success',
      });
    },
    onError: (err: unknown) => {
      setLoading(false);
      pushToast({
        title: 'Login failed',
        description: getFriendlyErrorMessage(err, 'Login failed.'),
        variant: 'error',
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onMutate: () => setLoading(true),
    onSuccess: () => {
      // Sprint 20: account created → Login (discard JWT; do not auto-sign-in).
      setLoading(false);
      pushToast({
        title: 'Account created',
        description: 'Please sign in with your new credentials.',
        variant: 'success',
      });
    },
    onError: (err: unknown) => {
      setLoading(false);
      pushToast({
        title: 'Registration failed',
        description: getFriendlyErrorMessage(err, 'Registration failed.'),
        variant: 'error',
      });
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
    rememberMe,
    isAuthenticated: Boolean(token),
    isLoading: isLoading || loginMutation.isPending || registerMutation.isPending,
    isHydrated,
    isValidatingSession,
    login: async (input: LoginInput & { rememberMe?: boolean }) => {
      const result = await loginMutation.mutateAsync(input);
      return result.session;
    },
    register: async (input: RegisterInput) => {
      await registerMutation.mutateAsync(input);
    },
    logout,
  };
}

/** Wires 401 notifications → toast + redirect only on protected pages. */
export function useUnauthorizedHandler() {
  const navigate = useNavigate();
  const pushToast = useToastStore((s) => s.push);

  useEffect(() => {
    setUnauthorizedListener(({ message }) => {
      pushToast({
        title: 'Session expired',
        description: message,
        variant: 'error',
      });
      if (isProtectedPath(window.location.pathname)) {
        navigate(paths.login, {
          replace: true,
          state: { from: { pathname: window.location.pathname } },
        });
      }
    });
    return () => setUnauthorizedListener(null);
  }, [navigate, pushToast]);
}

/** After persist rehydration, validate the JWT via GET /auth/me. */
export function useSessionBootstrap() {
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthHydration();
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const setValidatingSession = useAuthStore((s) => s.setValidatingSession);
  const pushToast = useToastStore((s) => s.push);

  useEffect(() => {
    if (!isHydrated) return;

    if (!token) {
      setValidatingSession(false);
      return;
    }

    let cancelled = false;
    setValidatingSession(true);

    void (async () => {
      try {
        const user = await authApi.fetchCurrentUser();
        if (!cancelled) {
          setUser(user);
        }
      } catch (err) {
        if (!cancelled) {
          // Only clear the session when the token is actually rejected.
          // Network / 5xx must not wipe a still-valid persisted JWT on refresh.
          if (isAuthSessionFailure(err)) {
            // Interceptor may already have cleared the store on 401.
            if (useAuthStore.getState().token) {
              logout();
            }
            pushToast({
              title: 'Session expired',
              description: getFriendlyErrorMessage(err, 'Please sign in again.'),
              variant: 'error',
            });
          } else {
            pushToast({
              title: 'Could not verify session',
              description: getFriendlyErrorMessage(
                err,
                'You are still signed in. Try again shortly.',
              ),
              variant: 'default',
            });
          }
        }
      } finally {
        if (!cancelled) {
          setValidatingSession(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally only re-run when hydration completes or the token identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set* store actions are stable enough for bootstrap
  }, [isHydrated, token]);
}
