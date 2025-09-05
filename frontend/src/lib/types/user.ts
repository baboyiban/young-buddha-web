// lib/types/user.ts (개선된 버전)
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  roles: UserRole[];
  createdAt?: string;
  lastLoginAt?: string;
}

export type UserRole = "USER" | "ADMIN";

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  token?: string;
}
