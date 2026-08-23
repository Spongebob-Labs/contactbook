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
 *
 * This class is ALSO wired as Nest's own internal logger (main.ts's
 * app.useLogger(logger)) — Nest's framework messages (NestFactory,
 * InstanceLoader, RoutesResolver, ...) call .log(message, context) with a
 * bare CONTEXT STRING in the second position, not a meta object the way
 * every call site in this app's own code does. Spreading a string into an
 * object (`{...'NestFactory'}`) silently explodes it into character-indexed
 * keys ({"0":"N","1":"e",...}) instead of throwing — that shape only ever
 * showed up in production JSON logging (pretty mode's string interpolation
 * papered over it), which is why it went unnoticed through every dev-mode
 * boot this whole project. normalizeArgs() below is what tells the two
 * calling conventions apart.
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

  /**
   * This app's own call sites always pass an object: logger.info('event',
   * {field: value}). Nest's internal logger always passes a bare string in
   * the same position: this.logger.log(message, 'SomeContext') — and for
   * .error specifically, a THIRD string argument for context, with the
   * SECOND being a stack trace. Tell them apart by type, not by call site,
   * since this class can't know which convention called it.
   */
  private normalizeArgs(
    isErrorMethod: boolean,
    metaOrContext?: Record<string, unknown> | string,
    maybeContext?: string,
  ): { meta?: Record<string, unknown>; context?: string } {
    if (typeof metaOrContext === 'string') {
      return isErrorMethod
        ? { meta: { trace: metaOrContext }, context: maybeContext }
        : { context: metaOrContext };
    }
    return { meta: metaOrContext, context: maybeContext };
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

  error(
    message: string,
    metaOrTrace?: Record<string, unknown> | string,
    context?: string,
  ) {
    const n = this.normalizeArgs(true, metaOrTrace, context);
    this.write('error', message, n.meta, n.context);
  }
  warn(
    message: string,
    metaOrContext?: Record<string, unknown> | string,
    context?: string,
  ) {
    const n = this.normalizeArgs(false, metaOrContext, context);
    this.write('warn', message, n.meta, n.context);
  }
  log(
    message: string,
    metaOrContext?: Record<string, unknown> | string,
    context?: string,
  ) {
    const n = this.normalizeArgs(false, metaOrContext, context);
    this.write('info', message, n.meta, n.context);
  }
  info(
    message: string,
    metaOrContext?: Record<string, unknown> | string,
    context?: string,
  ) {
    const n = this.normalizeArgs(false, metaOrContext, context);
    this.write('info', message, n.meta, n.context);
  }
  debug(
    message: string,
    metaOrContext?: Record<string, unknown> | string,
    context?: string,
  ) {
    const n = this.normalizeArgs(false, metaOrContext, context);
    this.write('debug', message, n.meta, n.context);
  }
  verbose(
    message: string,
    metaOrContext?: Record<string, unknown> | string,
    context?: string,
  ) {
    const n = this.normalizeArgs(false, metaOrContext, context);
    this.write('debug', message, n.meta, n.context);
  }
}
