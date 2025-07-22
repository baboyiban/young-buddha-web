export interface ApiResponse<T = any> {
  error?: boolean;
  message?: string;
  code?: string;
  data?: T;
}
