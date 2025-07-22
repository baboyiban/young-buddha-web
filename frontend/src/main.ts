import { loadMissionData } from "./pages/mission";
import { pageInfo, router } from "./lib/router";
import { authService } from "./lib/auth";
import { ROUTES } from "./lib/config";
import { layoutManager, LayoutType } from "./layouts";

// 페이지별 초기화 함수 할당
pageInfo[ROUTES.HOME].bindFn = loadMissionData;

// 앱 초기화
async function initApp(): Promise<void> {
  try {
    console.log("앱 초기화 시작");

    // 인증 상태 확인
    const isAuthenticated = await authService.checkAuthStatus();
    console.log("인증 상태:", isAuthenticated);

    if (isAuthenticated) {
      // 인증된 사용자: 앱 레이아웃 로드
      console.log("앱 레이아웃 로드 중...");
      await layoutManager.loadLayout(LayoutType.APP);
      await determineInitialRoute();
    } else {
      // 인증되지 않은 사용자: 로그인 레이아웃 로드
      console.log("로그인 레이아웃 로드 중...");
      await layoutManager.loadLayout(LayoutType.LOGIN);
      location.hash = `#${ROUTES.LOGIN}`;
      console.log("라우터 실행 중...");
      await router();
    }

    console.log("앱 초기화 완료");
  } catch (error) {
    console.error("앱 초기화 중 오류:", error);
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
    } else if (currentPath === ROUTES.LOGIN) {
      await router();
    }
  }
}

// 앱 시작
initApp();
window.addEventListener("hashchange", handleRouteChange);
