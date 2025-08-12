export interface AuthResponse {
  auth_url: string;
  success?: boolean;
  message?: string;
}

export interface LoginStatus {
  isAuthenticated: boolean;
  user?: any;
  loading: boolean;
}
