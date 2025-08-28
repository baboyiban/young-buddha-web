// Custom error type for API errors
export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Generic HTTP client for API calls
export class HttpClient {
  private baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    let body: any = undefined;
    try {
      body = await res.json();
    } catch (e) {
      /* ignore */
    }

    if (!res.ok) {
      const error = new ApiError(
        body?.message || `API error: ${res.status}`,
        res.status,
        body,
      );

      // 401 에러인 경우 더 명확한 메시지 추가
      if (res.status === 401) {
        error.message = `시트 쿼리 실패: ${res.status} Unauthorized`;
      }

      throw error;
    }

    return body as T;
  }

  private buildUrl(url: string): string {
    return url.startsWith("/")
      ? `${this.baseUrl}${url}`
      : `${this.baseUrl}/${url}`;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    // HttpOnly 쿠키만 사용 → 명시적 Authorization 헤더 제거
    return {};
  }

  private getCsrfHeader(): Record<string, string> {
    if (typeof document === "undefined") return {};
    const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
    if (!match) return {};
    try {
      const token = decodeURIComponent(match[1]);
      if (token) return { "X-CSRF-Token": token };
    } catch (_) {}
    return {};
  }

  async get<T>(url: string): Promise<T> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(this.buildUrl(url), {
      method: "GET",
      credentials: "include",
      headers,
      cache: "no-store",
    });
    return this.handleResponse<T>(res);
  }

  async post<T>(url: string, body: object): Promise<T> {
    const fullUrl = this.buildUrl(url);
    const headers = await this.getAuthHeaders();
    const csrf = this.getCsrfHeader();
    const res = await fetch(fullUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        ...headers,
        ...csrf,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return this.handleResponse<T>(res);
  }

  async put<T>(url: string, body: object): Promise<T> {
    const headers = await this.getAuthHeaders();
    const csrf = this.getCsrfHeader();
    const res = await fetch(this.buildUrl(url), {
      method: "PUT",
      credentials: "include",
      headers: {
        ...headers,
        ...csrf,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return this.handleResponse<T>(res);
  }

  async delete<T>(url: string): Promise<T> {
    const headers = await this.getAuthHeaders();
    const csrf = this.getCsrfHeader();
    const res = await fetch(this.buildUrl(url), {
      method: "DELETE",
      credentials: "include",
      headers: {
        ...headers,
        ...csrf,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    return this.handleResponse<T>(res);
  }
}

// ApiError 타입을 활용하면 catch에서 아래처럼 타입 체크가 가능합니다:
// try { ... } catch (error) {
//   if (error instanceof ApiError) { ... }
// }
