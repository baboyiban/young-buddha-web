export interface User {
  name: string;
  email: string;
  role: string;
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
}

export interface SpreadsheetConfig {
  spreadsheetId: string;
  range: string;
}

export interface SpreadsheetData {
  values: string[][];
}

export interface PageInfo {
  title: string;
  file: string;
  roles?: string[];
  bindFn?: () => void | Promise<void>;
}
