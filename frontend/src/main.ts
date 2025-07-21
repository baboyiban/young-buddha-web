import "./style.css";
import { updateLayoutVisibilityForRoute } from "./lib/visibility";
import { loadMissionData } from "./pages/mission";
import { includeComponent } from "./lib/components";
import { setupNavbar, updateNavbarActiveState } from "./components/navbar";
import { pageInfo, router } from "./lib/router";
import { authService, setupGoogleLogin } from "./lib/auth";
import { ROUTES } from "./lib/config";

// 페이지별 초기화 함수 할당
pageInfo[ROUTES.HOME].bindFn = loadMissionData;
pageInfo[ROUTES.LOGIN].bindFn = setupGoogleLogin;

// 앱 초기화
async function initApp(): Promise<void> {
  // 먼저 인증 상태를 확인하고 적절한 페이지로 라우팅
  await determineInitialRoute();

  // 라우팅 완료 후 UI 업데이트
  updateLayoutVisibilityForRoute();
  updateNavbarActiveState();
}

// 초기 라우팅 결정
async function determineInitialRoute(): Promise<void> {
  const currentPath = location.hash.replace(/^#/, "") || ROUTES.HOME;
  const currentPageInfo = pageInfo[currentPath];

  // 인증이 필요한 페이지인지 확인
  const requiresAuth =
    currentPageInfo?.authRequired ||
    (currentPageInfo?.roles && currentPageInfo.roles.length > 0);

  if (requiresAuth) {
    // 인증 상태 확인
    const isAuthenticated = await authService.checkAuthStatus();

    if (!isAuthenticated) {
      // 인증되지 않았으면 로그인 페이지로
      location.hash = `#${ROUTES.LOGIN}`;
    }
  } else if (currentPath === ROUTES.LOGIN) {
    // 로그인 페이지에 있는데 이미 인증되어 있다면 홈으로
    const isAuthenticated = await authService.checkAuthStatus();
    if (isAuthenticated) {
      location.hash = `#${ROUTES.HOME}`;
    }
  }

  // 라우터 실행
  await router();
}

// 컴포넌트 로드 후 앱 시작
Promise.all([
  includeComponent("navbar", "navbar.html", setupNavbar),
  includeComponent("footer", "footer.html"),
]).then(() => {
  initApp();
  window.addEventListener("hashchange", () => {
    router().then(() => {
      updateLayoutVisibilityForRoute();
      updateNavbarActiveState();
    });
  });
});
