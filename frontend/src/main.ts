import "./style.css";
import { router, pageInfo } from "./router";
import { includeComponent } from "./lib";
import { updateNavbarActive } from "./lib/navbar";
import { updateLayoutVisibilityForRoute } from "./lib/visibility";
import { setupGoogleLogin } from "./auth";
import { loadMissionData } from "./pages/mission";
import { authService } from "./auth/service";
import { ROUTES } from "./config";

// 페이지별 초기화 함수 할당
pageInfo[ROUTES.HOME].bindFn = loadMissionData;
pageInfo[ROUTES.LOGIN].bindFn = setupGoogleLogin;

// 컴포넌트 로드
includeComponent("navbar", "navbar.html", updateNavbarActive);
includeComponent("footer", "footer.html", updateNavbarActive);
includeComponent("payment", "payment.html", updateNavbarActive);

// 앱 초기화
async function initApp(): Promise<void> {
  const currentPath = location.hash.replace(/^#/, "") || ROUTES.HOME;
  const currentPageInfo = pageInfo[currentPath];

  // 권한 체크 및 리다이렉션
  if (
    currentPath !== ROUTES.LOGIN &&
    currentPageInfo?.roles && currentPageInfo.roles.length > 0
  ) {
    const isAuthenticated = await authService.checkAuthStatus();
    if (!isAuthenticated) {
      location.hash = `#${ROUTES.LOGIN}`;
      return;
    }
  }

  await router();
  updateLayoutVisibilityForRoute();
  updateNavbarActive();
}

// 앱 시작
initApp();

// 라우트 변경 감지
window.addEventListener("hashchange", initApp);
