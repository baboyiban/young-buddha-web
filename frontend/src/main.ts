import "./style.css";
import { pageInfo, router } from "./router";
import { includeComponent } from "./lib/components";
import { updateNavbarActive } from "./lib/navbar";
import { updateLayoutVisibilityForRoute } from "./lib/visibility";
import { setupGoogleLogin } from "./auth";
import { loadMissionData } from "./pages/mission";
import { authService } from "./auth/service";

const isDev = false; // 개발 모드

// 개발 모드에서는 roles를 모두 []로 변경
if (isDev) {
  for (const key in pageInfo) {
    pageInfo[key].roles = [];
  }
}

// 페이지별 초기화 함수 할당
pageInfo["/"].bindFn = loadMissionData;
pageInfo["/login"].bindFn = setupGoogleLogin;

// 컴포넌트 로드
includeComponent("navbar", "navbar.html", () => {
  updateNavbarActive();
});
includeComponent("footer", "footer.html", () => {
  updateNavbarActive();
});
includeComponent("payment", "payment.html", () => {
  updateNavbarActive();
});

// 앱 초기화
async function initApp(): Promise<void> {
  // 현재 경로가 로그인 페이지가 아니고, 권한이 필요한 페이지라면 인증 상태 체크
  const currentPath = location.hash.replace(/^#/, "") || "/";
  const currentPageInfo = pageInfo[currentPath];

  if (
    currentPath !== "/login" &&
    currentPageInfo?.roles &&
    currentPageInfo.roles.length > 0
  ) {
    const isAuthenticated = await authService.checkAuthStatus();
    if (!isAuthenticated) {
      location.hash = "#/login";
    }
  }

  await router();
  updateLayoutVisibilityForRoute();
  updateNavbarActive();
}

// 앱 시작
initApp();

// 라우트 변경 감지
window.addEventListener("hashchange", async () => {
  await router();
  updateLayoutVisibilityForRoute();
  updateNavbarActive();
});
