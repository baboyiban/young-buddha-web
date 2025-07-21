export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  picture?: string | null;
}

export interface ApiResponse<T = any> {
  error?: boolean;
  message?: string;
  code?: string;
  data?: T;
}

export interface AuthResponse {
  auth_url?: string;
  success?: boolean;
  error?: boolean;
  message?: string;
}

export interface SpreadsheetConfig {
  spreadsheetId: string;
  range: string;
  values?: string[][];
}

export interface SpreadsheetData {
  values: string[][];
}

export interface PageInfo {
  title: string;
  file: string;
  roles?: string[];
  bindFn?: () => void | Promise<void>;
  authRequired?: boolean;
}
