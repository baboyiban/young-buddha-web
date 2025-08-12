import { AuthResponse } from "@/types/auth";
import { User } from "@/types/user";

export class AuthService {
  private baseUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080");
  private useMockAuth = false; // 강제로 실제 인증 사용

  constructor() {
    // 디버깅용 로그
    console.log("AuthService initialized:", {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_USE_REAL_AUTH: process.env.NEXT_PUBLIC_USE_REAL_AUTH,
      useMockAuth: this.useMockAuth,
      baseUrl: this.baseUrl,
    });
  }

  async getCurrentUser(): Promise<User> {
    if (this.useMockAuth) {
      return this.getMockUser();
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/me`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to get current user");
      }

      return await response.json();
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async startGoogleAuth(): Promise<string> {
    if (this.useMockAuth) {
      return this.mockGoogleAuth();
    }

    const response = await fetch(`${this.baseUrl}/api/auth/google`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        redirect_uri: window.location.origin + "/login",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to start Google auth");
    }

    const data: AuthResponse = await response.json();

    if (!data.auth_url) {
      throw new Error("인증 URL을 받지 못했습니다");
    }

    return data.auth_url;
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/auth/logout`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch (error) {
      console.error("로그아웃 중 오류:", error);
    }

    this.clearAuthData();
    window.location.href = "/login";
  }

  clearAuthData(): void {
    // 로컬 스토리지 정리
    const storageKeys = ["user", "token", "auth"];
    storageKeys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    // 쿠키 정리
    document.cookie.split(";").forEach((cookie) => {
      const eqPos = cookie.indexOf("=");
      const name =
        eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      if (name.includes("token") || name.includes("auth") || name === "jwt") {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      }
    });
  }

  static getJwtFromCookie(): string | null {
    if (typeof document === "undefined") return null;

    const match = document.cookie.match(new RegExp("(^| )jwt=([^;]+)"));
    return match ? match[2] : null;
  }

  async checkAuthStatus(): Promise<boolean> {
    console.log("checkAuthStatus called, useMockAuth:", this.useMockAuth);
    console.log("All cookies:", document.cookie);

    if (this.useMockAuth) {
      return this.getMockAuthStatus();
    }

    try {
      // HttpOnly 쿠키는 JavaScript에서 읽을 수 없으므로
      // 직접 /api/auth/me를 호출해서 인증 상태 확인
      console.log("Making request to:", `${this.baseUrl}/api/auth/me`);
      const user = await this.getCurrentUser();
      console.log("User data retrieved:", user);
      return true;
    } catch (error) {
      console.log("Failed to get current user:", error);
      this.clearAuthData();
      return false;
    }
  }

  private handleAuthError(error: any): void {
    console.error("Auth error:", error);
    // 인증 에러 처리 로직
    if (error.status === 401 || error.status === 403) {
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
    // 목업 로그인 - 즉시 성공으로 처리
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 대기

    // 목업 JWT 쿠키 설정
    document.cookie = "jwt=mock-jwt-token; path=/";

    // 로그인 성공 페이지로 리다이렉트
    return window.location.origin + "/login?login=success";
  }

  private getMockAuthStatus(): boolean {
    // 목업 JWT가 있으면 인증된 것으로 처리
    return AuthService.getJwtFromCookie() === "mock-jwt-token";
  }
}

export const authService = new AuthService();
