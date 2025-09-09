import type { UserRole } from "@/lib/types/user";

export const ROLE_USER: UserRole = "USER";
export const ROLE_ADMIN: UserRole = "ADMIN";

export const PATH_ACCESS_RULES: Record<string, UserRole[]> = {
  "/login": [],
  "/privacy": [],
  "/terms": [],
  "/unauthorized": [],
  "/": [ROLE_USER, ROLE_ADMIN],
  "/mission": [ROLE_USER, ROLE_ADMIN],
  "/payment": [ROLE_USER, ROLE_ADMIN],
   "/approval": [ROLE_ADMIN],
};

export const isPublicPath = (pathname: string): boolean => {
  return (
    PATH_ACCESS_RULES[pathname] && PATH_ACCESS_RULES[pathname].length === 0
  );
};

export const hasAccess = (pathname: string, userRoles: UserRole[]): boolean => {
  if (PATH_ACCESS_RULES[pathname]) {
    return PATH_ACCESS_RULES[pathname].some((role) => userRoles.includes(role));
  }
  for (const [pathPrefix, requiredRoles] of Object.entries(PATH_ACCESS_RULES)) {
    if (pathname.startsWith(pathPrefix) && pathPrefix !== "/") {
      return requiredRoles.some((role) => userRoles.includes(role));
    }
  }
  if (pathname === "/") {
    return PATH_ACCESS_RULES["/"].some((role) => userRoles.includes(role));
  }
  return userRoles.includes("USER") || userRoles.includes("ADMIN");
};
