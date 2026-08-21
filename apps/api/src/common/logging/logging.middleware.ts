import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { AppLogger } from './app-logger.service';
import { logContextStorage, type LogContext } from './log-context.storage';

/** GCP passes `TRACE_ID/SPAN_ID;o=1`. */
function parseCloudTrace(header: string | undefined, projectId?: string) {
  if (!header) return {};
  const [traceId, rest] = header.split('/');
  const spanId = rest?.split(';')[0];
  if (!traceId) return {};
  return {
    traceId: projectId ? `projects/${projectId}/traces/${traceId}` : traceId,
    spanId,
  };
}

/**
 * Paths that must not emit a request log line. The uptime check hits
 * /health/live every 60 seconds; left in, it would be ~1,440 lines/day of noise
 * and would dominate any log search.
 *
 * Checked here rather than via MiddlewareConsumer.exclude(): with a global
 * prefix plus URI versioning, exclude() did not match these paths and silently
 * logged everything. An explicit check is visible in the code that implements
 * the behaviour, and is covered by a test.
 */
const UNLOGGED_PATHS = new Set(['/api/v1/health/live', '/api/v1/health/ready']);

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  // Injects AppConfigService rather than a plain projectId string: Nest resolves
  // middleware constructor params by type, and a primitive `string` has no
  // provider token — it fails at boot with "can't resolve dependencies".
  constructor(
    private readonly logger: AppLogger,
    private readonly config: AppConfigService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.header('x-request-id') || randomUUID()).slice(
      0,
      200,
    );
    const store: LogContext = {
      requestId,
      ...parseCloudTrace(
        req.header('x-cloud-trace-context'),
        this.config.gcp.projectId,
      ),
    };

    // Echoed so a user reporting a failure can hand over an id that finds the
    // exact log line. Also included in every error body by the exception filter.
    res.setHeader('X-Request-Id', requestId);

    const startedAt = process.hrtime.bigint();
    // Still inside the ALS context so a health check that DOES fail has a
    // requestId in its error body — only the routine access line is suppressed.
    const silent = UNLOGGED_PATHS.has(req.originalUrl.split('?')[0]);

    logContextStorage.run(store, () => {
      res.on('finish', () => {
        if (silent) return;
        const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const meta = {
          method: req.method,
          path: req.originalUrl.split('?')[0],
          status: res.statusCode,
          latencyMs: Math.round(latencyMs * 100) / 100,
        };
        if (res.statusCode >= 500)
          this.logger.error('http.request', meta, 'HTTP');
        else if (res.statusCode >= 400)
          this.logger.warn('http.request', meta, 'HTTP');
        else this.logger.info('http.request', meta, 'HTTP');
      });

      next();
    });
  }
}
