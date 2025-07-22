import { apiClient } from "../api";
import { API_ENDPOINTS } from "../api/endpoints";
import { STORAGE_KEYS } from "../config";
import { handleAuthError } from "../error";
import type { AuthResponse } from "../../types/auth";
import type { User } from "../../types/user";

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

    // 로그인 레이아웃으로 전환
    const appContainer = document.getElementById("app-container");
    if (appContainer) {
      fetch("/layouts/login-layout.html")
        .then((response) => response.text())
        .then((html) => {
          appContainer.innerHTML = html;
          location.hash = "#/login";
        })
        .catch(() => {
          location.hash = "#/login";
        });
    } else {
      location.hash = "#/login";
    }
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
