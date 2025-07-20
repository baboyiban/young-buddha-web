export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleError(error: unknown): void {
  if (error instanceof AppError) {
    console.error(`[${error.code}] ${error.message}`, error.details);
  } else if (error instanceof Error) {
    console.error(error.message, error.stack);
  } else {
    console.error('Unknown error:', error);
  }
}

export function createErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  } else if (error instanceof Error) {
    return error.message;
  }
  return '알 수 없는 오류가 발생했습니다.';
}
