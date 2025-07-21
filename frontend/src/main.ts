import "./style.css";
import { loadMissionData } from "./pages/mission";
import { pageInfo, router } from "./lib/router";
import { authService } from "./lib/auth";
import { ROUTES } from "./lib/config";
import { layoutManager, LayoutType } from "./lib/layout";

// 페이지별 초기화 함수 할당
pageInfo[ROUTES.HOME].bindFn = loadMissionData;

// 앱 초기화
async function initApp(): Promise<void> {
  // 인증 상태 확인
  const isAuthenticated = await authService.checkAuthStatus();

  if (isAuthenticated) {
    // 인증된 사용자: 앱 레이아웃 로드
    await layoutManager.loadLayout(LayoutType.APP);
    await determineInitialRoute();
  } else {
    // 인증되지 않은 사용자: 로그인 레이아웃 로드
    await layoutManager.loadLayout(LayoutType.LOGIN);
  }
}

// 초기 라우팅 결정
async function determineInitialRoute(): Promise<void> {
  const currentPath = location.hash.replace(/^#/, "") || ROUTES.HOME;

  // 인증 상태 확인
  const isAuthenticated = await authService.checkAuthStatus();

  if (isAuthenticated) {
    // 인증된 사용자
    if (currentPath === ROUTES.LOGIN) {
      location.hash = `#${ROUTES.HOME}`;
    }
  } else {
    // 인증되지 않은 사용자
    if (currentPath !== ROUTES.LOGIN) {
      location.hash = `#${ROUTES.LOGIN}`;
    }
  }

  // 라우터 실행
  await router();
}

// 해시 변경 시 레이아웃 전환 처리
async function handleRouteChange(): Promise<void> {
  const isAuthenticated = await authService.checkAuthStatus();
  const currentPath = location.hash.replace(/^#/, "") || ROUTES.HOME;

  if (isAuthenticated && currentPath !== ROUTES.LOGIN) {
    // 인증된 사용자가 앱 페이지에 접근
    if (layoutManager.getCurrentLayout() !== LayoutType.APP) {
      await layoutManager.loadLayout(LayoutType.APP);
    }
    await router();
  } else if (!isAuthenticated || currentPath === ROUTES.LOGIN) {
    // 인증되지 않은 사용자이거나 로그인 페이지 접근
    if (layoutManager.getCurrentLayout() !== LayoutType.LOGIN) {
      await layoutManager.loadLayout(LayoutType.LOGIN);
    }
    if (!isAuthenticated && currentPath !== ROUTES.LOGIN) {
      location.hash = `#${ROUTES.LOGIN}`;
    }
  }
}

// 앱 시작
initApp();
window.addEventListener("hashchange", handleRouteChange);
