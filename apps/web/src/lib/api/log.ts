import "server-only";

/**
 * One line per API call, in the server terminal.
 *
 * ## Why this exists
 * Every call to the ContactBook API is **server→server** (see `session.ts` for why), so the
 * browser's Network tab never shows one — it shows Next.js's own RSC payloads instead, which look
 * like `3:I["[project]/node_modules/…"` and are easy to mistake for a broken API response.
 *
 * That left no way to watch the integration work, which is a real problem when the whole question
 * is "is it calling the API properly". This is the answer: the calls are visible where they
 * actually happen.
 *
 * ```
 * [api] GET    /profile/fields                      200   142ms  req=2469d34c
 * [api] POST   /auth/otp/verify                     409    88ms  req=8c3afe78  OTP_INVALID
 * [api] DELETE /profile/fields/clx8f2n0a0001        204    61ms  req=d8494d54
 * ```
 *
 * ## ⚠ What is deliberately never logged
 * **No request bodies, no response bodies, no headers, no tokens, no cookies.** A log line carries
 * the method, the path, the status, the duration, the API's `requestId` and — on a failure — the
 * stable error code. Nothing else.
 *
 * That is not caution for its own sake: request bodies here contain OTP codes, phone numbers and
 * decrypted bank account numbers, and a terminal log is the easiest place in the system for one of
 * those to end up somewhere it should not. The `requestId` is what makes a line actionable anyway
 * — it matches the API's own logs exactly.
 *
 * Query strings *are* included, because this API's five query parameters (`category`,
 * `includeArchived`, `purpose`) carry no personal data. A parameter that ever does would need
 * stripping here first.
 */

/**
 * On in development, off in production, overridable either way.
 *
 * `API_LOG=0` silences it locally; `API_LOG=1` turns it on in a deployed environment, which is
 * occasionally what you want while chasing something on staging.
 */
function enabled(): boolean {
  const flag = process.env.API_LOG;
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/** Right-pad, so the columns line up and the eye can scan a burst of calls. */
function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

export interface ApiLogEntry {
  method: string;
  /** Path relative to `/api/v1`, query included. */
  path: string;
  /** HTTP status, or `0` for a call that never got a response. */
  status: number;
  durationMs: number;
  requestId?: string | null;
  /** The stable error code on a failure, or the transport's own (`NETWORK`, `TIMEOUT`). */
  code?: string;
}

export function logApiCall(entry: ApiLogEntry): void {
  if (!enabled()) return;

  const status = entry.status === 0 ? "---" : String(entry.status);
  const duration = `${Math.round(entry.durationMs)}ms`;

  const parts = [
    "[api]",
    pad(entry.method, 6),
    pad(entry.path, 44),
    pad(status, 4),
    pad(duration.padStart(6), 7),
  ];

  if (entry.requestId) parts.push(`req=${entry.requestId.slice(0, 8)}`);
  if (entry.code !== undefined) parts.push(entry.code);

  const line = parts.join(" ");

  // `console.error` for a failure so it survives a log level that filters info, and so it is
  // visibly different in a terminal that colours stderr.
  if (entry.status === 0 || entry.status >= 400) console.error(line);
  else console.log(line);
}
