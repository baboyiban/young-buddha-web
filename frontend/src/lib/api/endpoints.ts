export const API_ENDPOINTS = {
  AUTH: {
    ME: "/api/auth/me",
    GOOGLE: "/api/auth/google",
    CALLBACK: "/api/auth/google/callback",
    LOGOUT: "/api/auth/logout",
  },
  SHEETS: {
    BASE: "/api/sheets",
    READ: "/api/sheets/read",
    WRITE: "/api/sheets/write",
    QUERY: "/api/sheets/query",
  },
  PAYMENT: {
    BASE: "/api/payment",
  },
} as const;
