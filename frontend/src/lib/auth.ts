import { apiClient } from "./api";
import { API_ENDPOINTS, STORAGE_KEYS } from "./config";
import { handleAuthError } from "./error";
import type { AuthResponse, User } from "./types";

export class AuthService {
  async getCurrentUser(): Promise<User> {
    try {
      return await apiClient.get<User>(API_ENDPOINTS.AUTH.ME);
    } catch (error) {
      handleAuthError(error, this);
      throw error;
    }
  }

  async startGoogleAuth(): Promise<string> {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.GOOGLE,
      { redirect_uri: window.location.origin + "/#/login" },
    );
    if (!response.auth_url) throw new Error("인증 URL을 받지 못했습니다");
    return response.auth_url;
  }

  async logout(): Promise<void> {
    try {
      await apiClient.delete(API_ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      console.error("로그아웃 중 오류:", error);
    }
    this.clearAuthData();
    location.hash = "#/login";
  }

  clearAuthData(): void {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    document.cookie.split(";").forEach((cookie) => {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      if (name.includes("token") || name.includes("auth") || name === "jwt") {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      }
    });
  }

  static getJwtFromCookie(): string | null {
    const match = document.cookie.match(new RegExp("(^| )jwt=([^;]+)"));
    return match ? match[2] : null;
  }

  async checkAuthStatus(): Promise<boolean> {
    try {
      const jwt = AuthService.getJwtFromCookie();
      if (!jwt) {
        this.clearAuthData();
        return false;
      }
      try {
        await this.getCurrentUser();
      } catch {
        this.clearAuthData();
        return false;
      }
      return true;
    } catch {
      this.clearAuthData();
      return false;
    }
  }
}

export const authService = new AuthService();

export function hasRequiredRole(user: User, requiredRoles?: string[]): boolean {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (!user || !user.role) return false;
  return requiredRoles.includes(user.role);
}

export async function requireAuth(): Promise<User> {
  try {
    return await authService.getCurrentUser();
  } catch (error) {
    location.hash = "#/login";
    throw error;
  }
}

export async function requireRole(roles: string[]): Promise<User> {
  const user = await requireAuth();
  if (!hasRequiredRole(user, roles)) throw new Error("권한이 부족합니다");
  return user;
}

export function setupGoogleLogin(): void {
  const loginBtn = document.getElementById(
    "google-login-btn",
  ) as HTMLButtonElement | null;
  if (!loginBtn) return;
  loginBtn.addEventListener("click", async () => {
    try {
      const authUrl = await authService.startGoogleAuth();
      window.location.href = authUrl;
    } catch {
      alert("로그인을 시작할 수 없습니다. 다시 시도해주세요.");
    }
  });
  const urlParams = new URLSearchParams(window.location.search);
  const loginStatus = urlParams.get("login");
  if (loginStatus === "success") {
    window.history.replaceState({}, document.title, window.location.pathname);
    location.hash = "#/";
    location.reload();
  } else if (loginStatus === "error") {
    alert("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}
