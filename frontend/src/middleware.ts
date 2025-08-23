import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 토큰별 캐시: { valid, ts }
const tokenCache = new Map<string, { valid: boolean; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30분

// 공개 페이지 목록 (인증 불필요)
const PUBLIC_PATHS = ["/login", "/privacy", "/terms"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 공개 페이지는 인증 확인 생략
  if (PUBLIC_PATHS.includes(pathname)) {
    // /login 페이지 접근 시 이미 로그인된 사용자 체크
    if (pathname === "/login") {
      const jwtCookie = request.cookies.get("jwt");
      if (jwtCookie && jwtCookie.value) {
        const token = jwtCookie.value;
        const now = Date.now();

        const cached = tokenCache.get(token);
        if (cached && now - cached.ts < CACHE_TTL) {
          if (cached.valid) {
            return NextResponse.redirect(new URL("/", request.url));
          }
          return NextResponse.next();
        }

        // 캐시가 없거나 만료된 경우 백엔드로 검증 요청
        try {
          const backendOrigin =
            process.env.NEXT_PUBLIC_API_URL || "http://backend:8080";
          const meUrl = `${backendOrigin.replace(/\/$/, "")}/auth/me`;
          const res = await fetch(meUrl, {
            method: "GET",
            headers: {
              cookie: `jwt=${token}`,
              Authorization: `Bearer ${token}`,
            },
          });

          if (res.ok) {
            tokenCache.set(token, { valid: true, ts: now });
            return NextResponse.redirect(new URL("/", request.url));
          } else {
            tokenCache.set(token, { valid: false, ts: now });
            return NextResponse.next();
          }
        } catch (err) {
          console.error("Auth validation failed in middleware:", err);
          return NextResponse.next();
        }
      }
    }
    return NextResponse.next();
  }

  // 보호된 페이지 접근 시 인증 확인
  const jwtCookie = request.cookies.get("jwt");
  console.log(
    "Middleware - JWT Cookie:",
    jwtCookie?.value ? "exists" : "not found",
  );
  console.log("Middleware - Path:", pathname);

  if (!jwtCookie || !jwtCookie.value) {
    // JWT 쿠키가 없으면 로그인 페이지로 리다이렉트
    console.log("Middleware - Redirecting to login: No JWT cookie");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const token = jwtCookie.value;
  const now = Date.now();

  // 캐시 확인
  const cached = tokenCache.get(token);
  console.log("Middleware - Token cache:", cached ? "exists" : "not found");

  if (cached && now - cached.ts < CACHE_TTL) {
    if (cached.valid) {
      console.log("Middleware - Using cached valid token");
      return NextResponse.next();
    } else {
      console.log(
        "Middleware - Using cached invalid token, redirecting to login",
      );
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // 캐시가 없거나 만료된 경우 백엔드로 검증 요청
  try {
    const backendOrigin =
      process.env.NEXT_PUBLIC_API_URL || "http://backend:8080";
    const meUrl = `${backendOrigin.replace(/\/$/, "")}/auth/me`;
    const res = await fetch(meUrl, {
      method: "GET",
      headers: {
        cookie: `jwt=${token}`,
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      console.log("Middleware - Backend validation successful");
      tokenCache.set(token, { valid: true, ts: now });
      return NextResponse.next();
    } else {
      console.log(
        "Middleware - Backend validation failed, status:",
        res.status,
      );
      tokenCache.set(token, { valid: false, ts: now });
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } catch (err) {
    console.error("Auth validation failed in middleware:", err);
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
