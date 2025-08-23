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
          return NextResponse.next();
        }
      }
    }
    return NextResponse.next();
  }

  // 보호된 페이지 접근 시 인증 확인
  const jwtCookie = request.cookies.get("jwt");

  if (!jwtCookie || !jwtCookie.value) {
    // JWT 쿠키가 없으면 로그인 페이지로 리다이렉트
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const token = jwtCookie.value;
  const now = Date.now();

  // 캐시 확인
  const cached = tokenCache.get(token);

  if (cached && now - cached.ts < CACHE_TTL) {
    if (cached.valid) {
      return NextResponse.next();
    } else {
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
      tokenCache.set(token, { valid: true, ts: now });
      return NextResponse.next();
    } else {
      tokenCache.set(token, { valid: false, ts: now });
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } catch (err) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
