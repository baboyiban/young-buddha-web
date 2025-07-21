// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    ME: "/api/auth/me",
    GOOGLE: "/api/auth/google",
    LOGOUT: "/api/auth/current",
  },
  SHEETS: {
    BASE: "/api/sheets",
    DATA: "/api/sheets/data",
  },
} as const;

// UI Constants
export const UI_CONSTANTS = {
  NAVBAR_HEIGHT: 48,
  MOBILE_BREAKPOINT: 768,
} as const;
