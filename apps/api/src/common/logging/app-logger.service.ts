import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { currentLogContext } from './log-context.storage';
import { redact } from './redact';

type Level = 'error' | 'warn' | 'info' | 'debug';

const SEVERITY: Record<Level, string> = {
  error: 'ERROR',
  warn: 'WARNING',
  info: 'INFO',
  debug: 'DEBUG',
};

const RANK: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };

/**
 * One JSON object per line to stdout. On the VM the Google Cloud Ops Agent tails
 * Docker's log stream and ships these to Cloud Logging.
 *
 * Message names are dotted event names (`broadcast.enqueued`), never sentences —
 * that is what makes a log-based metric a one-line filter.
 */
@Injectable({ scope: Scope.DEFAULT })
export class AppLogger implements LoggerService {
  private threshold: number = RANK.info;

  constructor(
    private readonly pretty: boolean = false,
    level: Level = 'info',
  ) {
    this.threshold = RANK[level];
  }

  setLevel(level: Level): void {
    this.threshold = RANK[level];
  }

  private write(
    level: Level,
    message: string,
    meta?: Record<string, unknown>,
    context?: string,
  ) {
    if (RANK[level] > this.threshold) return;

    const ctx = currentLogContext();
    const payload = {
      severity: SEVERITY[level],
      message,
      time: new Date().toISOString(),
      ...(context ? { context } : {}),
      ...(ctx?.requestId ? { requestId: ctx.requestId } : {}),
      ...(ctx?.userId ? { userId: ctx.userId } : {}),
      ...(ctx?.linkTokenPrefix ? { linkTokenPrefix: ctx.linkTokenPrefix } : {}),
      ...(ctx?.traceId ? { 'logging.googleapis.com/trace': ctx.traceId } : {}),
      ...(ctx?.spanId ? { 'logging.googleapis.com/spanId': ctx.spanId } : {}),
      ...((redact(meta ?? {}) as Record<string, unknown>) ?? {}),
    };

    const line = this.pretty
      ? `${SEVERITY[level].padEnd(7)} ${message} ${meta ? JSON.stringify(redact(meta)) : ''}`
      : JSON.stringify(payload);

    // ERROR and above to stderr so container tooling separates them correctly.
    if (level === 'error') process.stderr.write(line + '\n');
    else process.stdout.write(line + '\n');
  }

  error(message: string, meta?: Record<string, unknown>, context?: string) {
    this.write('error', message, meta, context);
  }
  warn(message: string, meta?: Record<string, unknown>, context?: string) {
    this.write('warn', message, meta, context);
  }
  log(message: string, meta?: Record<string, unknown>, context?: string) {
    this.write('info', message, meta, context);
  }
  info(message: string, meta?: Record<string, unknown>, context?: string) {
    this.write('info', message, meta, context);
  }
  debug(message: string, meta?: Record<string, unknown>, context?: string) {
    this.write('debug', message, meta, context);
  }
  verbose(message: string, meta?: Record<string, unknown>, context?: string) {
    this.write('debug', message, meta, context);
  }
}
