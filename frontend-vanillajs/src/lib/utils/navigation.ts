import { ROUTES } from "../config";

/**
 * 네비게이션 관련 유틸리티
 */
export class NavigationUtils {
  /**
   * 현재 경로를 가져옵니다
   */
  static getCurrentPath(): string {
    return location.hash.replace(/^#/, "") || ROUTES.HOME;
  }

  /**
   * 경로로 이동합니다
   */
  static navigateTo(path: string): void {
    location.hash = `#${path}`;
  }

  /**
   * 로그인 페이지로 이동합니다
   */
  static navigateToLogin(): void {
    this.navigateTo(ROUTES.LOGIN);
  }

  /**
   * 홈 페이지로 이동합니다
   */
  static navigateToHome(): void {
    this.navigateTo(ROUTES.HOME);
  }

  /**
   * 현재 경로가 특정 경로인지 확인합니다
   */
  static isCurrentPath(path: string): boolean {
    return this.getCurrentPath() === path;
  }

  /**
   * 로그인 페이지인지 확인합니다
   */
  static isLoginPage(): boolean {
    return this.isCurrentPath(ROUTES.LOGIN);
  }

  /**
   * 인증이 필요한 페이지인지 확인합니다
   */
  static isAuthRequiredPage(): boolean {
    const currentPath = this.getCurrentPath();
    return (
      currentPath !== ROUTES.LOGIN &&
      currentPath !== ROUTES.PRIVACY &&
      currentPath !== ROUTES.TERM
    );
  }

  /**
   * URL 쿼리 파라미터를 파싱합니다
   */
  static getQueryParams(): URLSearchParams {
    return new URLSearchParams(location.search);
  }

  /**
   * 특정 쿼리 파라미터 값을 가져옵니다
   */
  static getQueryParam(key: string): string | null {
    return this.getQueryParams().get(key);
  }
}
