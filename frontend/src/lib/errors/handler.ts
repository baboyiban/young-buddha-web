export class ApiErrorHandler {
  static handle(error: any): void {
    console.error('API Error:', error);

    if (error.message?.includes('CSRF_TOKEN_INVALID')) {
      // CSRF 에러 처리
      this.handleCsrfError();
    } else if (error.message?.includes('UNAUTHORIZED')) {
      // 인증 에러 처리
      this.handleAuthError();
    } else {
      // 일반 에러 처리
      this.handleGenericError(error);
    }
  }

  private static handleCsrfError(): void {
    alert('보안 검증에 실패했습니다. 페이지를 새로고침해주세요.');
    window.location.reload();
  }

  private static handleAuthError(): void {
    alert('세션이 만료되었습니다. 다시 로그인해주세요.');
    window.location.href = '/login';
  }

  private static handleGenericError(error: any): void {
    const errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
    alert(`오류 발생: ${errorMessage}`);
  }

  // React Hook 버전
  static useErrorHandler() {
    return {
      handleError: this.handle.bind(this),
    };
  }
}

// React Hook으로 사용
export function useApiErrorHandler() {
  return {
    handleError: ApiErrorHandler.handle.bind(ApiErrorHandler),
  };
}