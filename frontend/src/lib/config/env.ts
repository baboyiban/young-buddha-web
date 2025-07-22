export const CONFIG = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
  IS_DEV: import.meta.env.DEV,
  APP_NAME: "생활소임 일정표",
} as const;
