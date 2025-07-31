import { DOMUtils } from "./dom";

/**
 * 페이지 상태 관리를 위한 유틸리티
 */
export class PageStateManager {
  private containerId: string;
  private isLoading = false;

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  /**
   * 로딩 상태를 표시합니다
   */
  showLoading(message = "데이터를 불러오는 중..."): void {
    this.isLoading = true;
    DOMUtils.setContent(this.containerId, this.createLoadingHTML(message));
  }

  /**
   * 에러 상태를 표시합니다
   */
  showError(error: unknown, fallbackMessage = "오류가 발생했습니다"): void {
    this.isLoading = false;
    const message = error instanceof Error ? error.message : fallbackMessage;
    DOMUtils.setContent(this.containerId, this.createErrorHTML(message));
  }

  /**
   * 빈 상태를 표시합니다
   */
  showEmpty(message = "데이터가 없습니다"): void {
    this.isLoading = false;
    DOMUtils.setContent(this.containerId, this.createEmptyHTML(message));
  }

  /**
   * 콘텐츠를 표시합니다
   */
  showContent(content: string): void {
    this.isLoading = false;
    DOMUtils.setContent(this.containerId, content);
  }

  /**
   * 로그인 프롬프트를 표시합니다
   */
  showLoginPrompt(
    message = "로그인이 필요합니다",
    buttonText = "로그인하기"
  ): void {
    this.isLoading = false;
    DOMUtils.setContent(
      this.containerId,
      this.createLoginPromptHTML(message, buttonText)
    );
  }

  /**
   * 현재 로딩 상태인지 확인합니다
   */
  getIsLoading(): boolean {
    return this.isLoading;
  }

  /**
   * 안전하게 비동기 작업을 실행합니다
   */
  async executeWithState<T>(
    operation: () => Promise<T>,
    loadingMessage?: string
  ): Promise<T | null> {
    if (this.isLoading) return null;

    try {
      this.showLoading(loadingMessage);
      const result = await operation();
      return result;
    } catch (error) {
      this.showError(error);
      throw error;
    }
  }

  private createLoadingHTML(message: string): string {
    return `
      <div class="flex items-center justify-center p-4">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
        <span>${message}</span>
      </div>
    `;
  }

  private createErrorHTML(message: string): string {
    return `
      <div class="text-center p-4 text-red-600">
        <div class="text-2xl mb-2">⚠️</div>
        <div>오류 발생: ${message}</div>
      </div>
    `;
  }

  private createEmptyHTML(message: string): string {
    return `
      <div class="text-center p-4 text-gray-500">
        <div class="text-2xl mb-2">📭</div>
        <div>${message}</div>
      </div>
    `;
  }

  private createLoginPromptHTML(message: string, buttonText: string): string {
    return `
      <div class="text-center p-4">
        <p class="mb-4">${message}</p>
        <button onclick="location.hash='#/login'" 
                class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
          ${buttonText}
        </button>
      </div>
    `;
  }
}
