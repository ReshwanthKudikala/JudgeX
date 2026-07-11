import type { User } from '@/types';

export interface AuthTokensPayload {
  user: User;
  accessToken: string;
}

/** Payload sent to POST /auth/login (backend requires email). */
export interface LoginInput {
  email: string;
  password: string;
}

/** Payload sent to POST /auth/register. */
export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}
