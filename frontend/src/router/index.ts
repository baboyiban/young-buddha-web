import { requireRole } from "../auth/guard";
import { routes } from "./routes";

let currentPath = "";

export async function router(): Promise<void> {
  const hash = location.hash.replace(/^#/, "") || "/";
  const route = routes[hash];

  // 이미 같은 페이지에 있다면 중복 로드 방지
  if (hash === currentPath) {
    return;
  }

  if (!route) {
    document.title = "404 Not Found";
    const titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.textContent = "404 Not Found";
    document.getElementById("page-content")!.innerHTML =
      "<h2>페이지를 찾을 수 없습니다.</h2>";
    return;
  }

  document.title = route.title;
  const titleEl = document.getElementById("page-title");
  if (titleEl) titleEl.textContent = route.title;

  // 권한 체크
  if (route.roles && route.roles.length > 0) {
    try {
      await requireRole(route.roles);
    } catch (error) {
      return; // requireRole에서 이미 리다이렉트 처리됨
    }
  }

  // 페이지 로드
  try {
    const response = await fetch(route.file);
    const html = await response.text();
    document.getElementById("page-content")!.innerHTML = html;

    // 현재 경로 업데이트
    currentPath = hash;

    // 페이지별 초기화 함수 실행
    if (route.bindFn) {
      route.bindFn();
    }
  } catch (error) {
    document.getElementById("page-content")!.innerHTML =
      "<h2>페이지를 로드할 수 없습니다.</h2>";
  }
}

export { routes as pageInfo };
