// Custom error type for API errors
class ApiError extends Error {
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
    } catch {
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

  async get<T>(url: string): Promise<T> {
    const res = await fetch(this.buildUrl(url), {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return this.handleResponse<T>(res);
  }

  async post<T>(url: string, body: object): Promise<T> {
    const res = await fetch(this.buildUrl(url), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  async put<T>(url: string, body: object): Promise<T> {
    const res = await fetch(this.buildUrl(url), {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  async delete<T>(url: string): Promise<T> {
    const res = await fetch(this.buildUrl(url), {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return this.handleResponse<T>(res);
  }
}

// ApiError 타입을 활용하면 catch에서 아래처럼 타입 체크가 가능합니다:
// try { ... } catch (error) {
//   if (error instanceof ApiError) { ... }
// }
