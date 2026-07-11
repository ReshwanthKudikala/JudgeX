import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { useAuthStore } from '@/store/auth.store';
import { ApiError, type ApiEnvelope } from '@/types';

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
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    const code = body?.error?.code ?? (status === 401 ? 'UNAUTHENTICATED' : 'REQUEST_FAILED');
    const message =
      body?.error?.message ||
      error.message ||
      'Something went wrong. Please try again.';

    if (status === 401) {
      useAuthStore.getState().logout();
    }

    return Promise.reject(
      new ApiError(status, code, message, body?.error?.details),
    );
  },
);

/** Unwrap the standard `{ success, data }` envelope. */
export async function unwrapData<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
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
