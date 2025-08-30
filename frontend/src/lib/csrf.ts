export const getCsrfTokenFromCookie = (): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch (_) {
    return null;
  }
};

export const addCsrfTokenToHeaders = (headers: HeadersInit = {}): HeadersInit => {
  const csrfToken = getCsrfTokenFromCookie();
  if (!csrfToken) return headers;
  
  const headersObj = new Headers(headers);
  headersObj.set("X-CSRF-Token", csrfToken);
  return headersObj;
};