import { apiClient, unwrapData } from '@/api/client';
import { mapUser, type ApiEnvelope, type User, type UserDto } from '@/types';
import type { LoginInput, RegisterInput } from '@/types/auth';

interface AuthSessionDto {
  user: UserDto;
  accessToken: string;
}

interface MeDto {
  user: UserDto;
}

export interface AuthSession {
  user: User;
  accessToken: string;
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const data = await unwrapData(
    apiClient.post<ApiEnvelope<AuthSessionDto>>('/auth/login', input),
  );
  return {
    user: mapUser(data.user),
    accessToken: data.accessToken,
  };
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  const data = await unwrapData(
    apiClient.post<ApiEnvelope<AuthSessionDto>>('/auth/register', input),
  );
  return {
    user: mapUser(data.user),
    accessToken: data.accessToken,
  };
}

export async function fetchCurrentUser(): Promise<User> {
  const data = await unwrapData(apiClient.get<ApiEnvelope<MeDto>>('/auth/me'));
  return mapUser(data.user);
}
