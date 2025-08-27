import { User } from "@/lib/types/user";
import { HttpClient } from "@/lib/config/http";

type ApiResponse<T> = {
  data: T;
  error?: string;
  message?: string;
};

export class AuthService {
  // 기본적으로 상대 경로를 사용해 Next.js 리라이트를 타도록 설정
  // (브라우저에서 내부 도커 호스트를 직접 호출하지 않도록 함)
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  private httpClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient(this.baseUrl);
  }

  async getCurrentUser(): Promise<User> {
    try {
      // 백엔드 응답: { authenticated, email, name, role }
      const resp = await this.httpClient.get<{
        authenticated: boolean;
        email: string;
        name?: string;
        role?: string;
      }>(`/auth/me`);
      const email = resp.email;
      const name = resp.name || email?.split("@")[0] || "User";
      const role = resp.role;
      const user: User = {
        id: email,
        email,
        name,
        roles: role ? [role] : undefined,
      };
      return user;
    } catch (error: any) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async getGoogleAuthUrl(): Promise<string> {
    return `${this.baseUrl}/auth/google/login`;
  }

  // 호환성을 위한 별칭 메서드
  async startGoogleAuth(): Promise<string> {
    return this.getGoogleAuthUrl();
  }

  async logout(shouldRedirect = true): Promise<void> {
    try {
      await this.httpClient.delete(`/auth/logout`);
    } catch (error) {}
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
      const resp = await this.httpClient.get<{ authenticated: boolean }>(`/auth/me`);
      if (!resp.authenticated) throw new Error("unauthenticated");
      return true;
    } catch (error) {
      this.clearAuthData();
      return false;
    }
  }

  private handleAuthError(error: any): void {
    const status = error?.status || error?.response?.status;
    if (status === 401 || status === 403) {
      this.clearAuthData();
    }
  }

  async testJwtExpiry(): Promise<void> {
    try {
      const user1 = await this.getCurrentUser();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const user2 = await this.getCurrentUser();
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
