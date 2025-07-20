import { ApiError } from "../types";
import type { ApiResponse } from "../types";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const responseText = await response.text();

      if (!response.ok) {
        // 에러 응답 처리
        let errorData: ApiResponse = {};
        try {
          errorData = JSON.parse(responseText);
        } catch {
          // JSON 파싱 실패 시 기본 에러
        }

        throw new ApiError(
          errorData.message || `HTTP ${response.status}`,
          response.status,
          errorData.code
        );
      }

      // 성공 응답 처리
      if (responseText.trim() === "") {
        return {} as T;
      }

      try {
        return JSON.parse(responseText);
      } catch {
        // JSON이 아닌 경우 텍스트 그대로 반환
        return responseText as unknown as T;
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError("Network error", 0);
    }
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
