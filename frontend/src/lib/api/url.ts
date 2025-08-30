export const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const getApiUrl = (path = "") => {
  const baseUrl = API_URL.replace(/\/$/, "");
  const normalizedPath = path.replace(/^\//, "");
  return normalizedPath ? `${baseUrl}/${normalizedPath}` : baseUrl;
};

export const AUTH_ENDPOINTS = {
  me: () => getApiUrl("auth/me"),
  googleLogin: () => getApiUrl("auth/google/login"),
  logout: () => getApiUrl("auth/logout"),
};