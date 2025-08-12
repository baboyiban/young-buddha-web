export interface Config {
  API_BASE_URL: string;
  IS_DEV: boolean;
  APP_NAME: string;
}

export interface EnvVariables {
  VITE_API_BASE_URL?: string;
  DEV?: boolean;
  [key: string]: string | boolean | undefined;
}
