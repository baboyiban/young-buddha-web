// 공유 API 스키마 정의
// 백엔드와 프론트엔드 간 일관된 타입 정의

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  errors?: ValidationError[];
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: Record<string, unknown>;
}

// 백엔드와 일관된 에러 응답 타입
export interface ApiErrorResponse {
  error: boolean;
  code: string;
  message: string;
}

// 인증 관련 타입
export interface AuthMeResponse {
  authenticated: boolean;
  email: string;
  name?: string;
  role?: string;
}

export interface AuthCheckResponse {
  authenticated: boolean;
}

// Google Sheets 관련 타입
export interface SheetsResponse {
  success: boolean;
  data?: any[];
  error?: string;
}

export interface SheetsReadParams {
  spreadsheet_id: string;
  gid: string;
  query: string;
}

export interface SheetsWriteParams {
  spreadsheet_id: string;
  gid: string;
  query: string;
}

// 결제 관련 타입
export interface PaymentRequest {
  id: string;
  email: string;
  amount: number;
  status: '대기' | '승인' | '거절';
  created_at: string;
  updated_at?: string;
}

export interface PaymentListResponse {
  data: PaymentRequest[];
  totalCount: number;
}

export interface PaymentUpdateParams {
  id: string;
  status: '승인' | '거절';
}

// 데이터베이스 관련 타입
export interface DatabaseQueryResponse {
  success: boolean;
  data?: any[];
  error?: string;
}

export interface DatabaseQueryParams {
  query: string;
}

// API 엔드포인트 상수
export const API_ENDPOINTS = {
  // 인증
  AUTH: {
    ME: '/auth/me',
    GOOGLE_LOGIN: '/auth/google/login',
    LOGOUT: '/auth/logout',
  },

  // Google Sheets
  SHEETS: {
    READ: '/sheets/read',
    CREATE: '/sheets/create',
    UPDATE: '/sheets/update',
    DELETE: '/sheets/delete',
  },

  // 결제 관리
  PAYMENT: {
    LIST: '/payment/admin',
    UPDATE: '/payment/update',
    BATCH_UPDATE: '/payment/batch-update',
  },

  // 데이터베이스
  DATABASE: {
    QUERY: '/database/query',
  },

  // 헬스체크
  HEALTH: '/health',
} as const;
