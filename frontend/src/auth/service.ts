import { apiClient } from "../api/client";
import { ApiError } from "../types";
import { API_ENDPOINTS, STORAGE_KEYS } from "../lib/constants";
import type { AuthResponse, User } from "../types";

export class AuthService {
  async getCurrentUser(): Promise<User> {
    try {
      return await apiClient.get<User>(API_ENDPOINTS.AUTH.ME);
    } catch (error) {
      if (error instanceof ApiError) {
        // 토큰 만료나 무효한 토큰인 경우 자동으로 정리
        if (error.code === "TOKEN_EXPIRED" || error.code === "INVALID_TOKEN") {
          this.clearAuthData();
        }
      }
      throw error;
    }
  }

  async startGoogleAuth(): Promise<string> {
    const response = await apiClient.post<AuthResponse>(API_ENDPOINTS.AUTH.GOOGLE);
    if (!response.auth_url) {
      throw new Error("인증 URL을 받지 못했습니다");
    }
    return response.auth_url;
  }

  async logout(): Promise<void> {
    try {
      await apiClient.delete(API_ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      // 에러는 무시하고 계속 진행
    } finally {
      this.clearAuthData();
      this.redirectToLogin();
    }
  }

  clearAuthData(): void {
    // 로컬 스토리지 정리
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    // 쿠키 정리 (httpOnly 쿠키는 서버에서 처리)
    document.cookie.split(";").forEach((cookie) => {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      if (name.includes("token") || name.includes("auth")) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      }
    });
  }

  redirectToLogin(): void {
    location.hash = "#/login";
    // 페이지 새로고침으로 상태 초기화
    setTimeout(() => {
      location.reload();
    }, 100);
  }

  async checkAuthStatus(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch {
      this.clearAuthData();
      return false;
    }
  }
}

export const authService = new AuthService();
