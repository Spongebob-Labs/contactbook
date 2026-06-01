import { AsyncLocalStorage } from "node:async_hooks";

export interface LogContextStore {
  traceId?: string;
  spanId?: string;
  requestId: string;
  userId?: string;
}

export const logContextStorage = new AsyncLocalStorage<LogContextStore>();
