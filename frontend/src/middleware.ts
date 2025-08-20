import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 토큰별 캐시: { valid, ts }
const tokenCache = new Map<string, { valid: boolean; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30분

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /login 페이지 접근 시 JWT 쿠키 확인 및 서버 검증(캐시 사용)
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
        // 캐시가 있고 invalid이면 /login 허용
        return NextResponse.next();
      }

      // 캐시가 없거나 만료된 경우 백엔드로 검증 요청
      try {
        // 내부 도커 네트워크의 백엔드로 직접 호출하여 TLS 문제 회피
        const backendOrigin =
          process.env.NEXT_PUBLIC_API_URL || "http://backend:8080";
        const meUrl = `${backendOrigin.replace(/\/$/, "")}/api/v1/auth/me`;
        const res = await fetch(meUrl, {
          method: "GET",
          headers: {
            // 백엔드는 cookie에서 jwt를 읽으므로 쿠키 헤더로 전달
            cookie: `jwt=${token}`,
          },
        });

        if (res.ok) {
          tokenCache.set(token, { valid: true, ts: now });
          return NextResponse.redirect(new URL("/", request.url));
        } else {
          // 토큰이 유효하지 않음(401 등)
          tokenCache.set(token, { valid: false, ts: now });
          return NextResponse.next();
        }
      } catch (err) {
        // 검증 요청 실패 시 안전하게 로그인 페이지로 진행시키거나 임시 허용
        console.error("Auth validation failed in middleware:", err);
        return NextResponse.next();
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login"],
};
