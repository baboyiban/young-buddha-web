import { useCallback } from "react";
import toast from "react-hot-toast";
import { MESSAGES } from "@/lib/config/app";

interface ApiErrorResponse {
  error: boolean;
  code: string;
  message: string;
}

export function useErrorHandler() {
  const handleError = useCallback((error: unknown, customMessage?: string) => {
    let message = customMessage || MESSAGES.ERRORS.GENERIC;
    let errorCode = "UNKNOWN_ERROR";

    if (error instanceof Error) {
      // 백엔드 API 에러 응답 처리
      try {
        const errorData = JSON.parse(error.message) as ApiErrorResponse;
        if (errorData.error && errorData.code && errorData.message) {
          message = errorData.message;
          errorCode = errorData.code;
        }
      } catch {
        // JSON 파싱 실패 시 기존 로직 사용
        if (error.message.includes("401")) {
          message = MESSAGES.ERRORS.AUTH_EXPIRED;
          errorCode = "AUTH_ERROR";
        } else if (error.message.includes("403")) {
          message = MESSAGES.ERRORS.PERMISSION_DENIED;
          errorCode = "PERMISSION_DENIED";
        } else if (error.message.includes("Network")) {
          message = MESSAGES.ERRORS.NETWORK;
          errorCode = "NETWORK_ERROR";
        }
      }
    }

    // 구조화된 에러 로깅
    if (process.env.NODE_ENV === "development") {
      console.error(`[${errorCode}] ${message}`, error);
    }

    toast.error(message);
  }, []);

  const handleSuccess = useCallback((message: string) => {
    toast.success(message);
  }, []);

  const handleWarning = useCallback((message: string) => {
    toast.custom(message, { icon: "⚠️" });
  }, []);

  const handleInfo = useCallback((message: string) => {
    toast.custom(message, { icon: "ℹ️" });
  }, []);

  return {
    handleError,
    handleSuccess,
    handleWarning,
    handleInfo,
  };
}
