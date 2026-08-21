import { AsyncLocalStorage } from 'node:async_hooks';

export interface LogContext {
  requestId: string;
  traceId?: string;
  spanId?: string;
  /** Written by the auth guard AFTER it verifies the token, so every subsequent
   *  log line in the request is attributable without threading it through calls. */
  userId?: string;
  /** First 6 chars of a share token, for correlating public-page requests.
   *  Never the full token — that is a bearer credential. */
  linkTokenPrefix?: string;
}

export const logContextStorage = new AsyncLocalStorage<LogContext>();

export function currentLogContext(): LogContext | undefined {
  return logContextStorage.getStore();
}

/** Mutates the active store in place. Safe: each request gets its own object. */
export function setLogContext(patch: Partial<LogContext>): void {
  const store = logContextStorage.getStore();
  if (store) Object.assign(store, patch);
}
