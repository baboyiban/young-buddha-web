// 사용자 관련 타입
export interface User {
  name: string;
  email: string;
  role: string;
}

// API 응답 타입
export interface ApiResponse<T = any> {
  error?: boolean;
  message?: string;
  code?: string;
  data?: T;
}

// 인증 관련 타입
export interface AuthResponse {
  auth_url?: string;
  success?: boolean;
}

// 스프레드시트 관련 타입
export interface SpreadsheetConfig {
  spreadsheetId: string;
  range: string;
}

export interface SpreadsheetData {
  values: string[][];
}

// 페이지 정보 타입
export interface PageInfo {
  title: string;
  file: string;
  roles?: string[];
  bindFn?: () => void;
}

// 에러 타입
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}
