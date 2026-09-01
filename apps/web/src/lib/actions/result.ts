/**
 * What a Server Action hands back to a form.
 *
 * ## Why actions return a result instead of throwing
 * A thrown error in a Server Action reaches the client as an opaque "an error occurred" —
 * Next redacts the message in production on purpose, so nothing useful survives. But these
 * failures are not bugs: `OTP_INVALID` is a person mistyping, `OTP_COOLDOWN` is them being
 * early. Both need to render *next to the field*, which means they have to be a value.
 *
 * So the `ApiError` is caught at the action boundary and converted to the same `FixtureError`
 * shape every error surface in the app already renders — plus the machine-readable `code`, so
 * a screen can branch (the OTP screen disables its resend button on `OTP_COOLDOWN`) without
 * matching on prose.
 *
 * Not a `"use server"` module: it exports types and pure helpers, and a `"use server"` file may
 * only export async functions.
 */

import type { FixtureError } from "@/types/domain";
import { isApiError, supportReference, toScreenError, type ApiErrorCode } from "@/lib/api/errors";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      /** Ready to render — sentence case, no jargon, no codes (§6.10). */
      error: FixtureError;
      /** Branch on this, never on `error.title`. */
      code: ApiErrorCode;
      /** The support reference, when the API gave one. Rendered small and secondary. */
      requestId: string | null;
    };

export function succeed<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/** A failure the UI raised itself — a validation message, before any request went out. */
export function failLocally(message: string): ActionResult<never> {
  return {
    ok: false,
    error: { kind: "unknown", title: message, detail: "", retryable: true },
    code: "UNKNOWN",
    requestId: null,
  };
}

/**
 * Convert whatever was thrown into a renderable failure.
 *
 * A non-`ApiError` lands on the generic panel rather than leaking a stack trace — that path is
 * for bugs in our own mapping code, and the user can do nothing with the detail either way.
 */
export function failFrom(thrown: unknown): ActionResult<never> {
  return {
    ok: false,
    error: toScreenError(thrown),
    code: isApiError(thrown) ? thrown.code : "UNKNOWN",
    requestId: supportReference(thrown),
  };
}
