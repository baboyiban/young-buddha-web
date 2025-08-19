import { AuthResponse } from "@/types/auth";
import { User } from "@/types/user";
import { HttpClient } from "@/lib/config/http";

type ApiResponse<T> = {
  data: T;
  error?: string;
  message?: string;
};

export class AuthService {
  private baseUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://your-production-api.com"
      : "http://localhost:8080");
  private useMockAuth =
    process.env.NEXT_PUBLIC_USE_MOCK_AUTH === "true" ||
    process.env.NODE_ENV !== "production";
  private httpClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient(this.baseUrl);
  }

  async getCurrentUser(): Promise<User> {
    if (this.useMockAuth) {
      return this.getMockUser();
    }
    try {
      const resp = await this.httpClient.get<ApiResponse<User>>(`/api/auth/me`);
      if (resp.error) throw new Error(resp.error);
      return resp.data;
    } catch (error: any) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async getGoogleAuthUrl(): Promise<string> {
    if (this.useMockAuth) {
      return this.mockGoogleAuth();
    }
    const resp = await this.httpClient.post<ApiResponse<AuthResponse>>(
      `/api/auth/google`,
      {
        redirect_uri: window.location.origin + "/login",
      },
    );
    if (!resp.data?.auth_url) {
      throw new Error(resp.error || "인증 URL을 받지 못했습니다");
    }
    return resp.data.auth_url;
  }

  async logout(shouldRedirect = true): Promise<void> {
    try {
      await this.httpClient.delete(`/api/auth/logout`);
    } catch (error) {
      console.error("로그아웃 중 오류:", error);
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
    if (this.useMockAuth) {
      return this.getMockAuthStatus();
    }
    try {
      const resp = await this.httpClient.get<ApiResponse<User>>(`/api/auth/me`);
      if (resp.error) throw new Error(resp.error);
      return true;
    } catch (error) {
      this.clearAuthData();
      return false;
    }
  }

  private handleAuthError(error: any): void {
    console.error("Auth error:", error);
    const status = error?.status || error?.response?.status;
    if (status === 401 || status === 403) {
      this.clearAuthData();
    }
  }

  // Mock 메서드들 (개발 환경용)
  private getMockUser(): User {
    return {
      id: "mock-user-1",
      email: "test@example.com",
      name: "테스트 사용자",
      picture: "https://via.placeholder.com/40",
      roles: ["user"],
    };
  }

  private async mockGoogleAuth(): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    document.cookie = "jwt=mock-jwt-token; path=/";
    return window.location.origin + "/login?login=success";
  }

  private getMockAuthStatus(): boolean {
    return AuthService.getJwtFromCookie() === "mock-jwt-token";
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
