import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import { MulterError } from "multer";

@Catch(MulterError)
export class MulterUploadExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let message = exception.message;
    if (exception.code === "LIMIT_FILE_SIZE") {
      message = "VCF file exceeds the 50 MB limit.";
    } else if (exception.code === "LIMIT_UNEXPECTED_FILE") {
      message =
        'Unexpected multipart field. Use form field name "file" for the VCF upload.';
    }

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
      error: "Bad Request",
    });
  }
}
