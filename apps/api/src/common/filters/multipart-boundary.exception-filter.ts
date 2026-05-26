import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import type { Response } from "express";

const BOUNDARY_HINT =
  "Multipart upload is missing the boundary parameter. Do not set Content-Type manually; use curl --form (or FormData in the browser) so the client adds multipart/form-data with a boundary.";

@Catch()
export class MultipartBoundaryExceptionFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  catch(exception: unknown, host: ArgumentsHost): void {
    const message =
      exception instanceof Error ? exception.message : String(exception);
    if (/boundary not found/i.test(message)) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: BOUNDARY_HINT,
        error: "Bad Request",
      });
      return;
    }
    super.catch(exception, host);
  }
}
