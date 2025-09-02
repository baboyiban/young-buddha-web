// 접근 규칙과 역할 상수를 중앙화하여 공유 가능한 유틸 파일
export const ROLE_USER = "USER";
export const ROLE_ADMIN = "ADMIN";

export const PATH_ACCESS_RULES: Record<string, string[]> = {
  "/login": [], // 공개 페이지 (인증 불필요)
  "/privacy": [], // 공개 페이지 (인증 불필요)
  "/terms": [], // 공개 페이지 (인증 불필요)
  "/unauthorized": [], // 공개 페이지 (인증 불필요)
  "/": [ROLE_USER, ROLE_ADMIN],
  "/mission": [ROLE_USER, ROLE_ADMIN],
  "/payment": [ROLE_USER, ROLE_ADMIN],
  "/admin": [ROLE_ADMIN],
};

export const isPublicPath = (pathname: string): boolean => {
  return PATH_ACCESS_RULES[pathname] && PATH_ACCESS_RULES[pathname].length === 0;
};

export const hasAccess = (pathname: string, userRoles: string[]): boolean => {
  // 정확한 경로 매칭 먼저 시도
  if (PATH_ACCESS_RULES[pathname]) {
    return PATH_ACCESS_RULES[pathname].some(role => userRoles.includes(role));
  }

  // prefix 기반 매칭 (하위 경로용)
  for (const [pathPrefix, requiredRoles] of Object.entries(PATH_ACCESS_RULES)) {
    if (pathname.startsWith(pathPrefix) && pathPrefix !== "/") {
      return requiredRoles.some(role => userRoles.includes(role));
    }
  }

  // 기본 경로에 대한 권한 확인
  if (pathname === "/") {
    return PATH_ACCESS_RULES["/"].some(role => userRoles.includes(role));
  }

  // 권한 정보가 없는 경로는 USER 이상만 접근 가능
  return userRoles.includes(ROLE_USER) || userRoles.includes(ROLE_ADMIN);
};