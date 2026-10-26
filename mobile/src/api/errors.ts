/**
 * Transport and configuration failures share one type so screens can show the
 * backend's own message, its HTTP status, and its stable error code.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code?: string,
  ) {
    super(message);
  }
}
