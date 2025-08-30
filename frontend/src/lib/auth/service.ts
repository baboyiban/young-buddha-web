import { User } from "@/lib/types/user";
import { apiClient } from "@/lib/api/client";
import { HTTPError } from "ky";
import { AUTH_ENDPOINTS } from "@/lib/config/api";
import { AuthCache } from "@/lib/auth/cache";
import { AuthError } from "@/lib/errors";

export class AuthService {
  async getCurrentUser(): Promise<User> {
    try {
      const jwt = AuthService.getJwtFromCookie();
      if (jwt) {
        const cached = AuthCache.get(jwt);
        if (cached?.valid && cached.data) {
          return cached.data;
        }
      }

      const resp = await apiClient.get("auth/me").json<{
        authenticated: boolean;
        email: string;
        name?: string;
        role?: string;
      }>();

      if (!resp.authenticated) {
        throw new AuthError("User not authenticated", 401);
      }

      const email = resp.email;
      const name = resp.name || email?.split("@")[0] || "User";
      const role = resp.role;
      const user: User = {
        id: email,
        email,
        name,
        roles: role ? [role] : undefined,
      };

      if (jwt) {
        AuthCache.set(jwt, { valid: true, data: user });
      }

      return user;
    } catch (error: any) {
      this.handleAuthError(error);
      throw error;
    }
  }

  getGoogleAuthUrl(): string {
    return AUTH_ENDPOINTS.googleLogin();
  }

  // 호환성을 위한 별칭 메서드
  startGoogleAuth(): string {
    return this.getGoogleAuthUrl();
  }

  async logout(shouldRedirect = true): Promise<void> {
    try {
      await apiClient.get("auth/logout");
    } catch (error) {
      // 실패하더라도 로그아웃 처리는 계속 진행
    }
    this.clearAuthData();
    if (shouldRedirect && typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }

  clearAuthData(): void {
    if (typeof window === "undefined") return;
    const storageKeys = [
      "user",
      "token",
      "auth",
      "jwt",
      "access_token",
      "refresh_token",
    ];
    storageKeys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    const cookiesToClear = [
      "jwt",
      "csrf_token", // csrf_token도 제거
      "auth",
      "token",
      "access_token",
      "refresh_token",
    ];
    cookiesToClear.forEach((name) => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${window.location.hostname}`;
    });
  }

  static getJwtFromCookie(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp("(^| )jwt=([^;]+)"));
    return match ? match[2] : null;
  }

  async checkAuthStatus(): Promise<boolean> {
    try {
      const jwt = AuthService.getJwtFromCookie();
      if (jwt) {
        const cached = AuthCache.get(jwt);
        if (cached && cached.valid) {
          return true;
        }
      }

      const resp = await apiClient
        .get("auth/me")
        .json<{ authenticated: boolean }>();

      if (!resp.authenticated) {
        throw new AuthError("unauthenticated", 401);
      }

      if (jwt) {
        AuthCache.set(jwt, { valid: true });
      }

      return true;
    } catch (error) {
      this.clearAuthData();
      return false;
    }
  }

  private handleAuthError(error: any): void {
    let status = 0;
    if (error instanceof HTTPError) {
      status = error.response.status;
    } else if (error instanceof AuthError && error.status) {
      status = error.status;
    }

    if (status === 401 || status === 403) {
      this.clearAuthData();
      const jwt = AuthService.getJwtFromCookie();
      if (jwt) {
        AuthCache.delete(jwt);
      }
    }
  }

  async testJwtExpiry(): Promise<void> {
    try {
      await this.getCurrentUser();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await this.getCurrentUser();
    } catch (error) {
      // Silent error handling
    }
  }
}

export const authService = new AuthService();

if (typeof window !== "undefined") {
  (window as any).authService = authService;
  (window as any).testJwtExpiry = () => authService.testJwtExpiry();
}
