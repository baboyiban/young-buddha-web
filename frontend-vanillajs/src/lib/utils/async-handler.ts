import { PageStateManager } from "./page-state";
import { AppError } from "../error";

/**
 * 비동기 작업을 안전하게 처리하는 유틸리티
 */
export class AsyncHandler {
  /**
   * 페이지 상태와 함께 비동기 작업을 처리합니다
   */
  static async handleWithPageState<T>(
    pageState: PageStateManager,
    operation: () => Promise<T>,
    options: {
      loadingMessage?: string;
      emptyCheck?: (result: T) => boolean;
      emptyMessage?: string;
      onSuccess?: (result: T) => void;
      onError?: (error: unknown) => void;
    } = {}
  ): Promise<T | null> {
    const { loadingMessage, emptyCheck, emptyMessage, onSuccess, onError } =
      options;

    if (pageState.getIsLoading()) return null;

    try {
      pageState.showLoading(loadingMessage);
      const result = await operation();

      if (emptyCheck && emptyCheck(result)) {
        pageState.showEmpty(emptyMessage);
        return result;
      }

      onSuccess?.(result);
      return result;
    } catch (error) {
      pageState.showError(error);
      onError?.(error);
      throw error;
    }
  }

  /**
   * 인증이 필요한 작업을 처리합니다
   */
  static async handleWithAuth<T>(
    pageState: PageStateManager,
    authCheck: () => Promise<boolean>,
    operation: () => Promise<T>,
    options: {
      loadingMessage?: string;
      loginMessage?: string;
      onSuccess?: (result: T) => void;
    } = {}
  ): Promise<T | null> {
    const { loadingMessage, loginMessage, onSuccess } = options;

    try {
      const isAuthenticated = await authCheck();
      if (!isAuthenticated) {
        pageState.showLoginPrompt(loginMessage);
        return null;
      }

      return await this.handleWithPageState(pageState, operation, {
        loadingMessage,
        onSuccess,
      });
    } catch (error) {
      pageState.showError(error);
      throw error;
    }
  }

  /**
   * 폼 제출을 처리합니다
   */
  static async handleFormSubmit<T>(
    form: HTMLFormElement,
    operation: (data: Record<string, string>) => Promise<T>,
    options: {
      onSuccess?: (result: T) => void;
      onError?: (error: unknown) => void;
      successMessage?: string;
      resetForm?: boolean;
    } = {}
  ): Promise<T | null> {
    const { onSuccess, onError, successMessage, resetForm = true } = options;

    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries()) as Record<
        string,
        string
      >;

      const result = await operation(data);

      if (successMessage) {
        alert(successMessage);
      }

      if (resetForm) {
        form.reset();
      }

      onSuccess?.(result);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof AppError
          ? error.message
          : "작업 중 오류가 발생했습니다";

      alert(errorMessage);
      onError?.(error);
      console.error("Form submission failed:", error);
      throw error;
    }
  }

  /**
   * 재시도 로직이 포함된 비동기 작업을 처리합니다
   */
  static async handleWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          throw error;
        }

        // 지수 백오프로 대기
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }

    throw lastError;
  }
}
