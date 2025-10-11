import { getApiUrl } from "@/lib/config/api";
import { getCsrfTokenFromCookie } from "@/lib/csrf";

const NON_MUTATING_METHODS = ["get", "head", "options"];

export const apiClient = {
  async request(url: string, options: RequestInit = {}) {
    const fullUrl = getApiUrl(url);

    // CSRF 토큰 추가
    if (!NON_MUTATING_METHODS.includes((options.method || "get").toLowerCase())) {
      const csrfToken = getCsrfTokenFromCookie();
      if (csrfToken) {
        options.headers = {
          ...options.headers,
          "X-CSRF-Token": csrfToken,
        };
      }
    }

    const response = await fetch(fullUrl, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      // 구조화된 에러 응답 처리
      let errorMessage = `HTTP error! status: ${response.status}`;

      try {
        const errorData = await response.json();
        if (errorData.error && errorData.code && errorData.message) {
          // 백엔드의 구조화된 에러 응답을 JSON 문자열로 변환
          errorMessage = JSON.stringify(errorData);
        }
      } catch {
        // JSON 파싱 실패 시 기본 에러 메시지 사용
      }

      throw new Error(errorMessage);
    }

    return response;
  },

  get(url: string, options?: RequestInit) {
    return this.request(url, { ...options, method: "GET" });
  },

  post(url: string, data?: any, options?: RequestInit) {
    return this.request(url, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  put(url: string, data?: any, options?: RequestInit) {
    return this.request(url, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  delete(url: string, options?: RequestInit) {
    return this.request(url, { ...options, method: "DELETE" });
  },
};
