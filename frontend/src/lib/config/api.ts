export const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const getApiUrl = (path = "") => {
  const baseUrl = API_URL.replace(/\/$/, "");
  const normalizedPath = path.replace(/^\//, "");

  // baseUrl이 "/api"인 경우와 "http://..."인 경우 모두 처리
  if (baseUrl.startsWith("/")) {
    // 상대 경로인 경우 - baseUrl을 포함해야 함
    return normalizedPath ? `${baseUrl}/${normalizedPath}` : baseUrl;
  } else {
    // 절대 URL인 경우
    return normalizedPath ? `${baseUrl}/${normalizedPath}` : baseUrl;
  }
};
