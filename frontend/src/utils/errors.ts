import { ApiError } from '@/types';

/** Map HTTP / network failures to friendly user-facing copy. */
export function getFriendlyErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err instanceof ApiError) {
    if (err.status === 0 || err.code === 'NETWORK_ERROR') {
      return 'Unable to reach the server. Check your connection and try again.';
    }
    if (err.status === 401) {
      return err.message || 'Your session has expired. Please sign in again.';
    }
    if (err.status === 403) {
      return err.message || 'You do not have permission to do that.';
    }
    if (err.status === 404) {
      return err.message || 'The requested resource was not found.';
    }
    if (err.status === 429) {
      return err.message || 'Too many requests. Please wait a moment and try again.';
    }
    if (err.status >= 500) {
      return 'The server is temporarily unavailable. Please try again later.';
    }
    return err.message || fallback;
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return fallback;
}

export interface FieldErrorDetail {
  path: string;
  message: string;
}

/** Best-effort extract of `{ path, message }[]` from ApiError.details. */
export function getFieldErrorDetails(err: unknown): FieldErrorDetail[] {
  if (!(err instanceof ApiError) || !Array.isArray(err.details)) return [];
  return err.details.filter(
    (d): d is FieldErrorDetail =>
      Boolean(d) &&
      typeof d === 'object' &&
      typeof (d as FieldErrorDetail).path === 'string' &&
      typeof (d as FieldErrorDetail).message === 'string',
  );
}
