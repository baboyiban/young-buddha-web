export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class AuthError extends ApiError {
  constructor(message: string, status?: number) {
    super(message, status, "AUTH_ERROR");
    this.name = "AuthError";
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, status?: number) {
    super(message, status, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export const handleApiError = (error: unknown): never => {
  if (error instanceof ApiError) {
    throw error;
  }
  
  if (error instanceof Error) {
    throw new ApiError(error.message);
  }
  
  throw new ApiError("Unknown error occurred");
};