import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import * as crypto from "node:crypto";
import { logContextStorage, LogContextStore } from "./logging-context.storage";

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime();

    // 1. Generate Request ID
    const requestId = crypto.randomUUID();

    // Set custom header on the response so the client knows their Request ID
    res.setHeader("X-Request-Id", requestId);

    // 2. Parse GCP Cloud Trace Context header
    // Format: X-Cloud-Trace-Context: TRACE_ID/SPAN_ID;o=TRACE_TRUE
    const traceHeader = req.headers["x-cloud-trace-context"];
    let traceId: string | undefined;
    let spanId: string | undefined;

    if (typeof traceHeader === "string" && traceHeader.trim().length > 0) {
      const [traceAndSpan] = traceHeader.split(";");
      if (traceAndSpan) {
        const parts = traceAndSpan.split("/");
        traceId = parts[0];
        spanId = parts[1];
      }
    }

    // Fallback traceId locally (must be 32-char hex string for GCP tracing compatibility)
    if (!traceId) {
      traceId = crypto.randomUUID().replace(/-/g, "");
    }

    const store: LogContextStore = {
      requestId,
      traceId,
      spanId,
    };

    // 3. Bind properties to express request object if needed for filters
    const extendedReq = req as Request & {
      requestId?: string;
      traceId?: string;
    };
    extendedReq.requestId = requestId;
    extendedReq.traceId = traceId;

    // 4. Run downstream handler in the AsyncLocalStorage context
    logContextStorage.run(store, () => {
      // Log incoming request
      this.logger.log({
        message: `Incoming request: ${req.method} ${req.originalUrl || req.url}`,
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // Track response finish
      res.on("finish", () => {
        const diff = process.hrtime(start);
        const latencyMs = Math.round(diff[0] * 1e3 + diff[1] * 1e-6);

        const logMsg = `Request completed: ${req.method} ${req.originalUrl || req.url} ${res.statusCode} in ${latencyMs}ms`;

        // If status code is 5xx, log as error; if 4xx, log as warning; otherwise log
        if (res.statusCode >= 500) {
          this.logger.error({
            message: logMsg,
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            latencyMs,
          });
        } else if (res.statusCode >= 400) {
          this.logger.warn({
            message: logMsg,
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            latencyMs,
          });
        } else {
          this.logger.log({
            message: logMsg,
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            latencyMs,
          });
        }
      });

      next();
    });
  }
}
