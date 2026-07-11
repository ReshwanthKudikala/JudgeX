export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
  updatedAt?: string;
}

/** Raw user shape as returned by the backend (snake_case columns). */
export interface UserDto {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  email_verified?: boolean;
  emailVerified?: boolean;
  email_verified_at?: string | null;
  emailVerifiedAt?: string | null;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function mapUser(dto: UserDto): User {
  const verified =
    dto.emailVerified ??
    dto.email_verified ??
    Boolean(dto.emailVerifiedAt ?? dto.email_verified_at);
  return {
    id: dto.id,
    username: dto.username,
    email: dto.email,
    role: dto.role,
    emailVerified: Boolean(verified),
    createdAt: dto.createdAt ?? dto.created_at ?? '',
    updatedAt: dto.updatedAt ?? dto.updated_at,
  };
}
