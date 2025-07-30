// Load environment variables from root .env file
const getEnvVar = (key: string, defaultValue: string): string => {
  // In Vite, environment variables are loaded automatically
  // This function provides a consistent way to access them
  return import.meta.env[key] || defaultValue;
};

export const CONFIG = {
  API_BASE_URL: getEnvVar('VITE_API_BASE_URL', "http://localhost:8080"),
  IS_DEV: import.meta.env.DEV,
  APP_NAME: "생활소임 일정표",
} as const;
