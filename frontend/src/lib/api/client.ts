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
      throw new Error(`HTTP error! status: ${response.status}`);
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
