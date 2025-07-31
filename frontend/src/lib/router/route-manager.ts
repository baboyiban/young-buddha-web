import { authService } from "../auth";
import { layoutManager, LayoutType } from "../../layouts";
import { NavigationUtils } from "../utils/navigation";
import { router } from "./router";

/**
 * 라우팅과 레이아웃 상태를 관리하는 클래스
 */
export class RouteManager {
  private isInitialized = false;

  /**
   * 앱을 초기화합니다
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const isAuthenticated = await authService.checkAuthStatus();

      if (isAuthenticated) {
        await this.loadAuthenticatedState();
      } else {
        await this.loadUnauthenticatedState();
      }

      this.isInitialized = true;
    } catch (error) {
      console.error("앱 초기화 중 오류:", error);
      throw error;
    }
  }

  /**
   * 라우트 변경을 처리합니다
   */
  async handleRouteChange(): Promise<void> {
    const isAuthenticated = await authService.checkAuthStatus();

    if (isAuthenticated && !NavigationUtils.isLoginPage()) {
      await this.handleAuthenticatedRoute();
    } else if (!isAuthenticated || NavigationUtils.isLoginPage()) {
      await this.handleUnauthenticatedRoute(isAuthenticated);
    }
  }

  /**
   * 인증된 사용자 상태를 로드합니다
   */
  private async loadAuthenticatedState(): Promise<void> {
    await layoutManager.loadLayout(LayoutType.APP);
    await this.determineInitialRoute();
  }

  /**
   * 인증되지 않은 사용자 상태를 로드합니다
   */
  private async loadUnauthenticatedState(): Promise<void> {
    await layoutManager.loadLayout(LayoutType.LOGIN);
    NavigationUtils.navigateToLogin();
    await router();
  }

  /**
   * 초기 라우트를 결정합니다
   */
  private async determineInitialRoute(): Promise<void> {
    const isAuthenticated = await authService.checkAuthStatus();

    if (isAuthenticated) {
      if (NavigationUtils.isLoginPage()) {
        NavigationUtils.navigateToHome();
      }
    } else {
      if (!NavigationUtils.isLoginPage()) {
        NavigationUtils.navigateToLogin();
      }
    }

    await router();
  }

  /**
   * 인증된 사용자의 라우트를 처리합니다
   */
  private async handleAuthenticatedRoute(): Promise<void> {
    if (layoutManager.getCurrentLayout() !== LayoutType.APP) {
      await layoutManager.loadLayout(LayoutType.APP);
    }
    await router();
  }

  /**
   * 인증되지 않은 사용자의 라우트를 처리합니다
   */
  private async handleUnauthenticatedRoute(
    isAuthenticated: boolean
  ): Promise<void> {
    if (layoutManager.getCurrentLayout() !== LayoutType.LOGIN) {
      await layoutManager.loadLayout(LayoutType.LOGIN);
    }

    if (!isAuthenticated && !NavigationUtils.isLoginPage()) {
      NavigationUtils.navigateToLogin();
    } else if (NavigationUtils.isLoginPage()) {
      await router();
    }
  }
}

export const routeManager = new RouteManager();
