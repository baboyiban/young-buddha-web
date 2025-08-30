export const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const ENV = {
  API_URL,
  NODE_ENV: process.env.NODE_ENV || "development",
  IS_PRODUCTION: process.env.NODE_ENV === "production",
  IS_DEVELOPMENT: process.env.NODE_ENV === "development",
};