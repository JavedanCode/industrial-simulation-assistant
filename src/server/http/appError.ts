export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * An error that is safe to expose to API clients.
 *
 * Errors that are not `AppError` instances are treated as unexpected and
 * returned as a generic 500 response.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    details?: unknown,
  ) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.") {
    super(404, message, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}
