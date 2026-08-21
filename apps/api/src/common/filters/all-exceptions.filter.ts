import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppLogger } from '../logging/app-logger.service';
import { currentLogContext } from '../logging/log-context.storage';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
}

/**
 * Registered ONCE via APP_FILTER, never with @UseFilters per controller — that
 * pattern silently leaves public endpoints and webhooks on framework defaults,
 * which is exactly what happened in the previous implementation.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = currentLogContext()?.requestId ?? 'unknown';

    const body = this.toBody(exception, requestId);

    // Never omitted: without it a user-reported bug cannot be traced to a log
    // line. This was the concrete gap in the previous implementation.
    const meta = {
      status: body.statusCode,
      code: body.code,
      method: req.method,
      path: req.originalUrl.split('?')[0],
    };

    if (body.statusCode >= 500) {
      this.logger.error(
        'http.unhandled_error',
        { ...meta, err: exception },
        'ExceptionFilter',
      );
    } else {
      this.logger.warn('http.client_error', meta, 'ExceptionFilter');
    }

    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, requestId: string): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();

      if (typeof raw === 'string') {
        return {
          statusCode: status,
          code: this.fallbackCode(status),
          message: raw,
          requestId,
        };
      }

      const obj = raw as Record<string, unknown>;
      const message = Array.isArray(obj.message)
        ? (obj.message as string[]).join('; ') // class-validator returns an array
        : ((obj.message as string) ?? exception.message);

      return {
        statusCode: status,
        code: (obj.code as string) ?? this.fallbackCode(status),
        message,
        requestId,
        ...(obj.details ? { details: obj.details } : {}),
      };
    }

    // Unknown throwable: never leak internals to the client. The stack is in the
    // log line, findable by requestId.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our end.',
      requestId,
    };
  }

  private fallbackCode(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHENTICATED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 410:
        return 'GONE';
      case 429:
        return 'RATE_LIMITED';
      default:
        return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
    }
  }
}
