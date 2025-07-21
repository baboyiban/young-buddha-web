import "./style.css";
import { updateLayoutVisibilityForRoute } from "./lib/visibility";
import { loadMissionData } from "./pages/mission";
import { includeComponent } from "./lib/components";
import { updateNavbarActive } from "./components/navbar";
import { pageInfo, router } from "./lib/router";
import { authService, setupGoogleLogin } from "./lib/auth";
import { ROUTES } from "./lib/config";

// 페이지별 초기화 함수 할당
pageInfo[ROUTES.HOME].bindFn = loadMissionData;
pageInfo[ROUTES.LOGIN].bindFn = setupGoogleLogin;

// 컴포넌트 로드
includeComponent("navbar", "navbar.html", updateNavbarActive);
includeComponent("footer", "footer.html", updateNavbarActive);

// 앱 초기화
async function initApp(): Promise<void> {
  const currentPath = location.hash.replace(/^#/, "") || ROUTES.HOME;
  const currentPageInfo = pageInfo[currentPath];
  if (
    currentPath !== ROUTES.LOGIN &&
    currentPageInfo?.roles &&
    currentPageInfo.roles.length > 0
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
window.addEventListener("hashchange", initApp);
