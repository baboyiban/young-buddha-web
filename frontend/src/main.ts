import { loadMissionData } from "./pages/mission";
import { routes } from "./lib/router";
import { routeManager } from "./lib/router/route-manager";
import { ROUTES } from "./lib/config";

// 페이지별 초기화 함수 할당
routes[ROUTES.HOME].bindFn = loadMissionData;

// 앱 초기화 및 시작
async function startApp(): Promise<void> {
  try {
    await routeManager.initialize();

    // 라우트 변경 이벤트 리스너 등록
    window.addEventListener("hashchange", () => {
      routeManager.handleRouteChange().catch((error) => {
        console.error("라우트 변경 처리 중 오류:", error);
      });
    });
  } catch (error) {
    console.error("앱 시작 중 오류:", error);
  }
}

// 앱 시작
startApp();
