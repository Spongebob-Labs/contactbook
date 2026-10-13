import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Every deliberate failure carries a stable machine-readable `code` alongside
 * the human message, so clients branch on the code and not on wording.
 */
export class ApiError extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }

  static badRequest(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    return new ApiError(code, message, HttpStatus.BAD_REQUEST, details);
  }
  static notFound(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    return new ApiError(code, message, HttpStatus.NOT_FOUND, details);
  }
  static conflict(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    return new ApiError(code, message, HttpStatus.CONFLICT, details);
  }
  static forbidden(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    return new ApiError(code, message, HttpStatus.FORBIDDEN, details);
  }
  /** The share link exists but the owner revoked it. 410, never 404 — the
   *  recipient should understand what happened. */
  static gone(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    return new ApiError(code, message, HttpStatus.GONE, details);
  }
}
