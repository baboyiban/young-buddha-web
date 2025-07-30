// Environment variables configuration
// Vite automatically loads environment variables from .env files
// Variables must be prefixed with VITE_ to be exposed to the frontend

interface Config {
  API_BASE_URL: string;
  IS_DEV: boolean;
  APP_NAME: string;
  ENABLE_PAYMENT_PAGE: boolean;
}

export const CONFIG: Config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
  IS_DEV: import.meta.env.DEV || false,
  APP_NAME: "생활소임 일정표",
  ENABLE_PAYMENT_PAGE: import.meta.env.VITE_ENABLE_PAYMENT_PAGE === "true" || false,
} as const;
