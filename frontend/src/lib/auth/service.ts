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
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080");
  private useMockAuth = false; // 강제로 실제 인증 사용
  private httpClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient(this.baseUrl);
  }

  async getCurrentUser(): Promise<User> {
    if (this.useMockAuth) {
      return this.getMockUser();
    }

    try {
      return await this.httpClient.get<User>(`/api/auth/me`);
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  async startGoogleAuth(): Promise<string> {
    if (this.useMockAuth) {
      return this.mockGoogleAuth();
    }

    const data: AuthResponse = await this.httpClient.post<AuthResponse>(`/api/auth/google`, {
      redirect_uri: window.location.origin + "/login",
    });

    if (!data.auth_url) {
      throw new Error("인증 URL을 받지 못했습니다");
    }

    return data.auth_url;
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
    // 로컬 스토리지 정리 (보안상 모든 인증 관련 데이터 제거)
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

    // 쿠키 정리 (HttpOnly 쿠키는 JavaScript로 직접 삭제 불가하므로 서버에서 처리)
    // 하지만 혹시 모를 클라이언트 쿠키들은 정리
    const cookiesToClear = [
      "jwt",
      "auth",
      "token",
      "access_token",
      "refresh_token",
    ];
    cookiesToClear.forEach((name) => {
      // 다양한 경로와 도메인에서 쿠키 삭제 시도
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
      // HttpOnly 쿠키는 JavaScript에서 읽을 수 없으므로
      // 직접 /api/auth/me를 호출해서 인증 상태 확인
      await this.httpClient.get<User>(`/api/auth/me`);
      return true;
    } catch (error) {
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

  // JWT 만료 테스트용 디버깅 함수
  async testJwtExpiry(): Promise<void> {
    try {
      // 즉시 호출
      const user1 = await this.getCurrentUser();

      // 2초 후 호출 (JWT가 1초로 설정되어 있으므로 실패해야 함)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const user2 = await this.getCurrentUser();
    } catch (error) {
      // Silent error handling
    }
  }
}

export const authService = new AuthService();

// 개발 환경에서 디버깅용으로 전역 접근 가능하게 설정
if (typeof window !== "undefined") {
  (window as any).authService = authService;
  (window as any).testJwtExpiry = () => authService.testJwtExpiry();
}
