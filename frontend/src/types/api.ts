export interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: ApiErrorBody | null;
  meta?: {
    correlationId?: string | null;
    [key: string]: unknown;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
