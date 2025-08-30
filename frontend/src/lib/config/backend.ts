// Backend origin resolver used across environments
// Priority:
// 1) BACKEND_INTERNAL_URL (container-to-container)
// 2) NEXT_PUBLIC_BACKEND_URL (local dev without Docker)
// 3) Fallback by hostname: localhost -> http://localhost:8080, else -> http://backend:8080

export function resolveBackendOrigin(hostname?: string): string {
  const env = process.env || {};
  const internal = env.BACKEND_INTERNAL_URL;
  if (internal && internal.trim()) return internal;

  const publicBackend = env.NEXT_PUBLIC_BACKEND_URL;
  if (publicBackend && publicBackend.trim()) return publicBackend;

  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocalHost) return "http://localhost:8080";

  // default for docker-compose dev networks
  return "http://backend:8080";
}

// Build full API URL from a path
export function buildBackendApiUrl(path: string, hostname?: string): string {
  const base = resolveBackendOrigin(hostname).replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
