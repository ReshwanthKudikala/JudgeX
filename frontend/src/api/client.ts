import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { useAuthStore } from '@/store/auth.store';
import { ApiError, type ApiEnvelope } from '@/types';
import { notifyUnauthorized } from '@/utils/auth-events';
import { getFriendlyErrorMessage } from '@/utils/errors';

const baseURL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  'http://localhost:4000/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiEnvelope<unknown>>) => {
    // Network / CORS / offline — no HTTP response.
    if (!error.response) {
      return Promise.reject(
        new ApiError(
          0,
          'NETWORK_ERROR',
          'Unable to reach the server. Check your connection and try again.',
        ),
      );
    }

    const status = error.response.status;
    const body = error.response.data;
    const code =
      body?.error?.code ??
      (status === 401
        ? 'UNAUTHENTICATED'
        : status === 403
          ? 'FORBIDDEN'
          : status === 404
            ? 'NOT_FOUND'
            : 'REQUEST_FAILED');

    const message =
      body?.error?.message ||
      getFriendlyErrorMessage(
        new ApiError(status, code, ''),
        error.message || 'Something went wrong. Please try again.',
      );

    // Skip auto-logout for credential failures on login/register themselves.
    const requestUrl = error.config?.url ?? '';
    const isAuthCredentialRequest =
      requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');
    const isSessionProbe = requestUrl.includes('/auth/me');

    if (status === 401 && !isAuthCredentialRequest) {
      const hadSession = Boolean(useAuthStore.getState().token);
      useAuthStore.getState().logout();
      // Session probe handles its own toast; avoid double notifications.
      if (hadSession && !isSessionProbe) {
        notifyUnauthorized(message || 'Your session has expired. Please sign in again.');
      }
    }

    return Promise.reject(
      new ApiError(status, code, message, body?.error?.details),
    );
  },
);

/** Unwrap the standard `{ success, data }` envelope. */
export async function unwrapData<T>(
  promise: Promise<{ data: ApiEnvelope<T> }>,
): Promise<T> {
  const { data: envelope } = await promise;
  if (!envelope.success) {
    throw new ApiError(
      0,
      envelope.error?.code ?? 'REQUEST_FAILED',
      envelope.error?.message ?? 'Request failed.',
      envelope.error?.details,
    );
  }
  return envelope.data;
}
