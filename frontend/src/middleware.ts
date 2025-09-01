import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AuthCache } from "@/lib/auth/cache";
import { addCsrfTokenToHeaders } from "@/lib/csrf";
import { buildBackendApiUrl, resolveBackendOrigin } from "@/lib/config/backend";

// 역할 정의 (외부에서 재사용 가능하도록 export)
export const ROLE_USER = "USER";   // 일반 사용자
export const ROLE_ADMIN = "ADMIN"; // 관리자

// 모든 경로의 접근 규칙을 단일 객체로 통합 (외부에서 재사용 가능하도록 export)
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // 미들웨어에서는 rewrites가 보장되지 않으므로, 공용 유틸로 절대 URL 계산
  const backendOrigin = resolveBackendOrigin(request.nextUrl.hostname);

  // 공개 페이지 확인 (빈 배열 = 인증 불필요)
  if (PATH_ACCESS_RULES[pathname] && PATH_ACCESS_RULES[pathname].length === 0) {
    // /login 페이지 접근 시 이미 로그인된 사용자 체크
    if (pathname === "/login") {
      const jwtCookie = request.cookies.get("jwt");
      if (jwtCookie && jwtCookie.value) {
        const token = jwtCookie.value;

        const cached = AuthCache.get(token);
        if (cached && cached.valid) {
          return NextResponse.redirect(new URL("/", request.url));
        } else if (cached && !cached.valid) {
          return NextResponse.next();
        }

        try {
          const meUrl = buildBackendApiUrl("/api/auth/me", request.nextUrl.hostname);
          const headers = addCsrfTokenToHeaders({
            cookie: `jwt=${token}`,
          });

          const res = await fetch(meUrl, {
            method: "GET",
            headers,
            // 타임아웃으로 무한 대기 방지
            signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(4000) : undefined,
          });

          if (res.ok) {
            AuthCache.set(token, { valid: true });
            return NextResponse.redirect(new URL("/", request.url));
          } else {
            AuthCache.set(token, { valid: false });
            return NextResponse.next();
          }
        } catch (err) {
          return NextResponse.next();
        }
      }
    }
    return NextResponse.next();
  }

  // 보호 경로가 아니면 통과 (과도한 me 호출 방지)
  const isProtected =
    (pathname === "/" && PATH_ACCESS_RULES["/"]?.length > 0) ||
    Object.keys(PATH_ACCESS_RULES).some(key =>
      key !== "/" && pathname.startsWith(key) && PATH_ACCESS_RULES[key].length > 0
    );
  if (!isProtected) {
    return NextResponse.next();
  }

  // 보호된 페이지 접근 시 인증 확인
  const jwtCookie = request.cookies.get("jwt");
  const hasJwt = jwtCookie?.value ? "exists" : "missing";

  if (!jwtCookie || !jwtCookie.value) {
    // JWT 쿠키가 없으면 로그인 페이지로 리다이렉트
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const token = jwtCookie.value;

  const cached = AuthCache.get(token);
  const cacheStatus = cached ? "cached" : "not cached";

  if (cached) {
    if (cached.valid) {
      return NextResponse.next();
    } else {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  try {
    const meUrl = buildBackendApiUrl("/api/auth/me", request.nextUrl.hostname);
    const headers = addCsrfTokenToHeaders({
      cookie: `jwt=${token}`,
    });

    const res = await fetch(meUrl, {
      method: "GET",
      headers,
      // 타임아웃으로 무한 대기 방지
      signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(4000) : undefined,
    });

    if (!res.ok) {
      AuthCache.set(token, { valid: false });
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const me = await res.json();
    AuthCache.set(token, { valid: true, data: me });

    // 권한 기반 라우팅 검사
    const userRole = me?.role;
    const userRoles = userRole ? [userRole] : [];
    const hasRequiredRole = (path: string): boolean => {
      // 정확한 경로 매칭 먼저 시도
      if (PATH_ACCESS_RULES[path]) {
        return PATH_ACCESS_RULES[path].some(role => userRoles.includes(role));
      }
      
      // prefix 기반 매칭 (하위 경로용)
      for (const [pathPrefix, requiredRoles] of Object.entries(PATH_ACCESS_RULES)) {
        if (path.startsWith(pathPrefix) && pathPrefix !== "/") {
          return requiredRoles.some(role => userRoles.includes(role));
        }
      }
      
      // 기본 경로에 대한 권한 확인
      if (path === "/") {
        return PATH_ACCESS_RULES["/"].some(role => userRoles.includes(role));
      }
      
      // 권한 정보가 없는 경로는 USER 이상만 접근 가능
      return userRoles.includes(ROLE_USER) || userRoles.includes(ROLE_ADMIN);
    };

    if (!hasRequiredRole(pathname)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    return NextResponse.next();
  } catch (err) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
