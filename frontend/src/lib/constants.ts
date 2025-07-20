// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    ME: '/api/auth/me',
    GOOGLE: '/api/auth/google',
    LOGOUT: '/api/auth/current',
  },
  SHEETS: {
    BASE: '/api/sheets',
    DATA: '/api/sheets/data',
  },
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
} as const;

// UI Constants
export const UI_CONSTANTS = {
  NAVBAR_HEIGHT: 48,
  MOBILE_BREAKPOINT: 768,
} as const;

// Error Codes
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;
