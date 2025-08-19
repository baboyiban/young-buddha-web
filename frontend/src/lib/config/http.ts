// Generic HTTP client for API calls
export class HttpClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    let body: any = undefined;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    
    if (!res.ok) {
      const error = new Error(
        body?.message || `API error: ${res.status}`
      );
      (error as any).status = res.status;
      (error as any).data = body;
      throw error;
    }
    
    return body;
  }

  async get<T>(url: string): Promise<T> {
    const res = await fetch(this.baseUrl + url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return this.handleResponse<T>(res);
  }

  async post<T>(url: string, body: any): Promise<T> {
    const res = await fetch(this.baseUrl + url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  async put<T>(url: string, body: any): Promise<T> {
    const res = await fetch(this.baseUrl + url, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  async delete<T>(url: string): Promise<T> {
    const res = await fetch(this.baseUrl + url, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return this.handleResponse<T>(res);
  }
}