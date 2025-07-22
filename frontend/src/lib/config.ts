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
  JWT_COOKIE_NAME: "jwt",
} as const;

export const ROLES = {
  USER: "user",
  ADMIN: "admin",
} as const;

export const STORAGE_KEYS = {
  TOKEN: "token",
  USER: "user",
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    ME: "/api/auth/me",
    GOOGLE: "/api/auth/google",
    CALLBACK: "/api/auth/google/callback",
    LOGOUT: "/api/auth/logout",
  },
  SHEETS: {
    BASE: "/api/sheets",
    READ: "/api/sheet/read",
    WRITE: "/api/sheet/write",
  },
} as const;
