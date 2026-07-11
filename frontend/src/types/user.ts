export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt?: string;
}

/** Raw user shape as returned by the backend (snake_case columns). */
export interface UserDto {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function mapUser(dto: UserDto): User {
  return {
    id: dto.id,
    username: dto.username,
    email: dto.email,
    role: dto.role,
    createdAt: dto.createdAt ?? dto.created_at ?? '',
    updatedAt: dto.updatedAt ?? dto.updated_at,
  };
}
