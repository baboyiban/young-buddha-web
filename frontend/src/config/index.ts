export const CONFIG = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
  IS_DEV: import.meta.env.DEV,
  APP_NAME: "생활소임 일정표",
} as const;

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  PAYMENT: "/payment",
  PRIVACY: "/privacy",
  TERM: "/term",
} as const;

export const ROLES = {
  USER: "user",
  ADMIN: "admin",
} as const;

// 에러 코드도 여기서 관리 가능
export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  SERVER_ERROR: "SERVER_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_TOKEN: "INVALID_TOKEN",
  NO_TOKEN: "NO_TOKEN",
} as const;

export const STORAGE_KEYS = {
  TOKEN: "token",
  USER: "user",
} as const;
