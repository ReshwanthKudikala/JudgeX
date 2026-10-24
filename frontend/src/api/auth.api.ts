import { apiClient, unwrapData } from '@/api/client';
import { mapUser, type ApiEnvelope, type User, type UserDto } from '@/types';
import type { LoginInput, RegisterInput } from '@/types/auth';

interface AuthSessionDto {
  user: UserDto;
  accessToken: string;
  verification?: VerificationNoticeDto;
}

interface VerificationNoticeDto {
  outcome: 'logged' | 'submitted' | 'already_verified' | 'recent' | 'accepted' | 'failed';
  delivery: 'console' | 'smtp' | null;
  message: string;
  user?: UserDto;
}

export interface VerificationNotice {
  outcome: VerificationNoticeDto['outcome'];
  delivery: 'console' | 'smtp' | null;
  message: string;
  user?: User;
}

interface MeDto {
  user: UserDto;
}

interface MessageDto {
  message: string;
  user?: UserDto;
  accessToken?: string;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  verification?: VerificationNotice;
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const data = await unwrapData(
    apiClient.post<ApiEnvelope<AuthSessionDto>>('/auth/login', {
      email: input.email,
      password: input.password,
    }),
  );
  return {
    user: mapUser(data.user),
    accessToken: data.accessToken,
  };
}

/**
 * Creates an account. Backend returns a JWT; callers may discard it when the
 * product flow redirects to Login instead of auto-signing-in.
 */
export async function register(input: RegisterInput): Promise<AuthSession> {
  const data = await unwrapData(
    apiClient.post<ApiEnvelope<AuthSessionDto>>('/auth/register', {
      username: input.username,
      email: input.email,
      password: input.password,
    }),
  );
  return {
    user: mapUser(data.user),
    accessToken: data.accessToken,
    verification: data.verification
      ? {
          outcome: data.verification.outcome,
          delivery: data.verification.delivery,
          message: data.verification.message,
        }
      : undefined,
  };
}

export async function fetchCurrentUser(): Promise<User> {
  const data = await unwrapData(apiClient.get<ApiEnvelope<MeDto>>('/auth/me'));
  return mapUser(data.user);
}

export async function verifyEmail(token: string): Promise<{ message: string; user: User }> {
  const data = await unwrapData(
    apiClient.post<ApiEnvelope<{ message: string; user: UserDto }>>('/auth/verify-email', { token }),
  );
  return { message: data.message, user: mapUser(data.user) };
}

function mapNotice(data: VerificationNoticeDto): VerificationNotice {
  return {
    outcome: data.outcome,
    delivery: data.delivery ?? null,
    message: data.message,
    user: data.user ? mapUser(data.user) : undefined,
  };
}

export async function resendVerification(email: string): Promise<VerificationNotice> {
  const data = await unwrapData(
    apiClient.post<ApiEnvelope<VerificationNoticeDto>>('/auth/resend-verification', { email }),
  );
  return mapNotice(data);
}

export async function resendVerificationMe(): Promise<VerificationNotice> {
  const data = await unwrapData(
    apiClient.post<ApiEnvelope<VerificationNoticeDto>>('/auth/resend-verification/me'),
  );
  return mapNotice(data);
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return unwrapData(
    apiClient.post<ApiEnvelope<MessageDto>>('/auth/forgot-password', { email }),
  );
}

export async function resetPassword(input: {
  token: string;
  newPassword: string;
}): Promise<{ message: string }> {
  return unwrapData(
    apiClient.post<ApiEnvelope<MessageDto>>('/auth/reset-password', input),
  );
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ message: string; user: User; accessToken: string }> {
  const data = await unwrapData(
    apiClient.post<ApiEnvelope<MessageDto & { user: UserDto; accessToken: string }>>(
      '/auth/change-password',
      input,
    ),
  );
  return {
    message: data.message,
    user: mapUser(data.user),
    accessToken: data.accessToken,
  };
}
