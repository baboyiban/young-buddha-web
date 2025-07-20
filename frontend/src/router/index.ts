import { requireRole } from "../auth/guard";
import type { PageInfo } from "../types";

export const pageInfo: Record<string, PageInfo> = {
  "/": {
    title: "생활소임 일정표",
    file: "/pages/mission.html",
    roles: ["user", "admin"],
  },
  "/login": {
    title: "로그인",
    file: "/pages/login.html",
    roles: [],
  },
  "/payment": {
    title: "일정불참 결재시트",
    file: "/pages/payment.html",
    roles: ["user", "admin"],
  },
  "/privacy": {
    title: "개인정보 처리방침",
    file: "/pages/privacy.html",
    roles: [],
  },
  "/term": {
    title: "이용 약관",
    file: "/pages/term.html",
    roles: [],
  },
};

let currentPath = "";

export async function router(): Promise<void> {
  const hash = location.hash.replace(/^#/, "") || "/";
  const info = pageInfo[hash];

  // 이미 같은 페이지에 있다면 중복 로드 방지
  if (hash === currentPath) {
    return;
  }

  if (!info) {
    document.title = "404 Not Found";
    const titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.textContent = "404 Not Found";
    document.getElementById("page-content")!.innerHTML =
      "<h2>페이지를 찾을 수 없습니다.</h2>";
    return;
  }

  document.title = info.title;
  const titleEl = document.getElementById("page-title");
  if (titleEl) titleEl.textContent = info.title;

  // 권한 체크
  if (info.roles && info.roles.length > 0) {
    try {
      await requireRole(info.roles);
    } catch (error) {
      return; // requireRole에서 이미 리다이렉트 처리됨
    }
  }

  // 페이지 로드
  try {
    const response = await fetch(info.file);
    const html = await response.text();
    document.getElementById("page-content")!.innerHTML = html;

    // 현재 경로 업데이트
    currentPath = hash;

    // 페이지별 초기화 함수 실행
    if (info.bindFn) {
      info.bindFn();
    }
  } catch (error) {
    document.getElementById("page-content")!.innerHTML =
      "<h2>페이지를 로드할 수 없습니다.</h2>";
  }
}
