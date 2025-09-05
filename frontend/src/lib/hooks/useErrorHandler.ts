import { useCallback } from "react";
import toast from "react-hot-toast";
import { MESSAGES } from "@/lib/config/app";

export function useErrorHandler() {
  const handleError = useCallback((error: unknown, customMessage?: string) => {
    let message = customMessage || MESSAGES.ERRORS.GENERIC;

    if (error instanceof Error) {
      if (error.message.includes("401")) {
        message = MESSAGES.ERRORS.AUTH_EXPIRED;
      } else if (error.message.includes("403")) {
        message = MESSAGES.ERRORS.PERMISSION_DENIED;
      } else if (error.message.includes("Network")) {
        message = MESSAGES.ERRORS.NETWORK;
      }
    }

    toast.error(message);

    if (process.env.NODE_ENV === "development") {
      console.error("Error handled by useErrorHandler:", error);
    }
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
