import { APP_CONFIG } from "../config/app";

// lib/utils/async.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = APP_CONFIG.API.RETRY_COUNT,
  delay: number = APP_CONFIG.API.RETRY_DELAY,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        throw lastError;
      }

      // 지수 백오프 적용
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      await sleep(backoffDelay);
    }
  }

  throw lastError!;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number = APP_CONFIG.UI.DEBOUNCE_DELAY,
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}
