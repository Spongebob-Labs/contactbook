import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  ExecutionContext,
} from "@nestjs/common";
import { Request, Response } from "express";
import {
  RECIPIENT_INITIATION_REQUIRED,
  WhatsappProviderError,
} from "../../messaging/whatsapp-errors";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. Get Controller Class and Method Context
    const context = host as unknown as ExecutionContext;
    let className = "UnknownController";
    if (typeof context.getClass === "function") {
      const controller = context.getClass();
      if (controller && typeof controller === "function") {
        className = controller.name;
      }
    }

    let handlerName = "UnknownHandler";
    if (typeof context.getHandler === "function") {
      const handler = context.getHandler();
      if (handler && typeof handler === "function") {
        handlerName = handler.name;
      }
    }

    const logger = new Logger(className);

    // 2. Resolve Status Code and Exception Message
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : exception instanceof WhatsappProviderError
          ? exception.code === RECIPIENT_INITIATION_REQUIRED
            ? HttpStatus.CONFLICT
            : HttpStatus.BAD_GATEWAY
          : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof Error ? exception.message : "Unknown error";

    // 3. Resolve Response Body to keep default API structures intact
    let responseBody: unknown;
    if (exception instanceof HttpException) {
      responseBody = exception.getResponse();
    } else if (exception instanceof WhatsappProviderError) {
      responseBody = {
        statusCode: status,
        code: exception.code,
        message: exception.message,
        ...exception.details,
      };
    } else {
      responseBody = {
        statusCode: status,
        message: "Internal server error",
        error: "Internal Server Error",
      };
    }

    // 4. Sanitize Request Parameters for Security (Redact passwords/tokens/codes/secrets)
    const sanitizedBody = this.sanitizeObject(request.body);
    const sanitizedQuery = this.sanitizeObject(request.query);
    const user = (request as Request & { user?: { sub?: string } }).user;

    // 5. Contextual Log Emitting
    if (status >= 500) {
      logger.error(
        {
          message: `Exception caught in ${className}.${handlerName}: ${message}`,
          method: request.method,
          url: request.originalUrl || request.url,
          body: sanitizedBody,
          query: sanitizedQuery,
          params: request.params,
          userId: user?.sub,
        },
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      logger.warn({
        message: `Client error in ${className}.${handlerName}: ${message}`,
        method: request.method,
        url: request.originalUrl || request.url,
        body: sanitizedBody,
        query: sanitizedQuery,
        params: request.params,
        userId: user?.sub,
        statusCode: status,
      });
    }

    // 6. Return response
    response
      .status(status)
      .json(
        typeof responseBody === "string"
          ? { statusCode: status, message: responseBody }
          : (responseBody as Record<string, unknown>),
      );
  }

  private sanitizeObject(obj: unknown): unknown {
    if (typeof obj !== "object" || obj === null) {
      return obj;
    }
    const sensitiveKeys = [
      "password",
      "token",
      "code",
      "accessToken",
      "refreshToken",
      "appSpecificPassword",
      "secret",
      "key",
      "authorization",
      "signature",
      "accountNumber",
      "routingNumber",
      "ssn",
      "taxId",
      "cvv",
      "pin",
      "card",
      "creditCard",
      "salary",
      "balance",
    ];
    if (Array.isArray(obj)) {
      const sanitized: unknown[] = [];
      for (const item of obj) {
        sanitized.push(this.sanitizeObject(item));
      }
      return sanitized;
    }

    const dict = obj as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const key of Object.keys(dict)) {
      const val = dict[key];
      if (
        sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))
      ) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof val === "object" && val !== null) {
        sanitized[key] = this.sanitizeObject(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }
}
