export interface AuthResponse {
  auth_url: string;
  success?: boolean;
  message?: string;
}

export interface User {
  email: string;
  name: string;
  role: string;
}

export interface LoginStatus {
  isAuthenticated: boolean;
  user?: User;
  loading: boolean;
}
