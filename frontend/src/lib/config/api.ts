export const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const getApiUrl = (path = "") => {
  const baseUrl = API_URL.replace(/\/$/, "");
  const normalizedPath = path.replace(/^\//, "");

  if (!normalizedPath) {
    return baseUrl;
  }

  // 이미 /api/ 로 시작하는 경로는 그대로 사용
  if (normalizedPath.startsWith("api/")) {
    return `/${normalizedPath}`;
  }

  // 상대 경로인 경우
  if (baseUrl.startsWith("/")) {
    return `${baseUrl}/${normalizedPath}`;
  }

  // 절대 URL인 경우
  return `${baseUrl}/${normalizedPath}`;
};
