import { AUTH_ENDPOINTS } from "@/lib/config/api";
import { AuthError } from "@/lib/errors";

export const getGoogleLoginUrl = () => AUTH_ENDPOINTS.googleLogin();

export const getLogoutUrl = () => AUTH_ENDPOINTS.logout();

export const getMe = async (headers: HeadersInit = {}) => {
  const response = await fetch(AUTH_ENDPOINTS.me(), { headers });

  if (!response.ok) {
    if (response.status === 401) {
      return null;
    }
    throw new AuthError("Failed to fetch user data", response.status);
  }

  return response.json();
};
