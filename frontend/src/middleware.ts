import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /login 페이지 접근 시 JWT 쿠키 확인
  if (pathname === "/login") {
    const jwtCookie = request.cookies.get("jwt");

    if (jwtCookie && jwtCookie.value) {
      // JWT 쿠키가 있으면 메인 페이지로 리다이렉트
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login"],
};
