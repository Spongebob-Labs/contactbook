/**
 * The error taxonomy — every `code` the API documents, and the sentence a person reads.
 *
 * ## Why this file exists at all
 * The API's envelope is `{statusCode, code, message, requestId}` and its `message` is
 * written for a developer reading a log. §6.10 says the interface never shows a person a
 * raw code or a developer sentence, so the translation has to happen once, in one place,
 * keyed on the one field the API promises is stable: `code`.
 *
 * ## The reuse that makes this cheap
 * `toScreenError` returns the **existing `FixtureError` shape** the fixture gateway already
 * produced. Every error panel, every retry affordance and every `ScreenStateRoot` in the
 * app already consumes that shape — so the whole error surface keeps working with no
 * component change. The gateway is being replaced; its output contract is not.
 */

import type { FixtureError } from "@/types/domain";
import type { ApiErrorResponseDto } from "@/lib/api/schema";

/**
 * Every documented code, grouped by the tag that raises it. Typed as a union so a `switch`
 * over it is exhaustively checkable and a new code from a spec bump is a compile error at
 * the copy table rather than a blank panel in production.
 */
export type ApiErrorCode =
  // auth
  | "OTP_COOLDOWN"
  | "OTP_RATE_LIMITED"
  | "OTP_NOT_FOUND"
  | "OTP_INVALID"
  | "OTP_ATTEMPTS_EXCEEDED"
  | "REFRESH_MISSING"
  | "REFRESH_INVALID"
  | "REFRESH_REUSE_DETECTED"
  | "UNAUTHENTICATED"
  // profile
  | "ONBOARDING_ALREADY_COMPLETED"
  | "CUSTOM_FIELDS_TOO_MANY"
  | "CUSTOM_FIELD_KEY_TOO_LONG"
  | "CUSTOM_FIELD_VALUE_TOO_LONG"
  | "PROFILE_FIELD_NOT_FOUND"
  | "PROFILE_FIELD_NOT_OWNED"
  | "PROFILE_FIELD_GROUP_NOT_FOUND"
  | "PHOTO_VIA_UPLOAD_ONLY"
  | "FIELD_ENCRYPTION_NOT_CONFIGURED"
  | "PHOTO_STORAGE_NOT_CONFIGURED"
  | "PHOTO_TOO_LARGE"
  | "PHOTO_TYPE_UNSUPPORTED"
  | "PHOTO_NOT_FOUND"
  // contacts
  | "CONTACT_NOT_FOUND"
  // cards
  | "CARD_NOT_FOUND"
  | "DUPLICATE_FIELD_IN_CARD"
  | "PHOTO_NOT_A_CARD_FIELD"
  | "CARD_SHARE_TEMPLATE_NOT_CONFIGURED"
  /**
   * The card logo quartet. Deliberately *not* folded into the `PHOTO_*` codes above even though
   * three of the four say something almost identical: they are different uploads against
   * different endpoints, and a card's logo failing must never render copy about the owner's
   * profile photo. The API keeps them distinct for the same reason.
   */
  | "LOGO_STORAGE_NOT_CONFIGURED"
  | "LOGO_TOO_LARGE"
  | "LOGO_TYPE_UNSUPPORTED"
  | "LOGO_NOT_FOUND"
  // share links
  | "SHARE_LINK_NOT_FOUND"
  /** The owner revoked this link — 410, from resolve and from both connect endpoints. */
  | "SHARE_LINK_REVOKED"
  /**
   * QR-scan connect only: the number typed into "Save & connect" is the card owner's own.
   * Reachable only by an owner scanning their own card, which is a normal thing to do while
   * testing — so it gets real copy rather than degrading to `UNKNOWN`.
   */
  | "CANNOT_CONNECT_TO_SELF"
  // templates
  | "TEMPLATE_ALREADY_REGISTERED"
  | "TEMPLATE_NOT_FOUND"
  /**
   * Undocumented, but real — observed from `POST /auth/otp/request` with a number the API's
   * phone-number library rejects. The spec lists no validation code for any endpoint, so this
   * is the catch-all the NestJS validation pipe actually emits, and every DTO can produce it.
   */
  | "BAD_REQUEST"
  // transport-level, raised by us rather than the API
  | "NOT_FOUND"
  | "NETWORK"
  | "TIMEOUT"
  | "MALFORMED"
  | "UNKNOWN";

/**
 * A failed call, as an exception.
 *
 * `requestId` is carried all the way to the surface on purpose: it is the one thing that
 * turns "it broke" into a log line somebody can actually find, and §6.10's ban on error
 * codes in copy is about *headlines*, not about a quiet support reference.
 */
export class ApiError extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly code: ApiErrorCode;
  /** The API's own developer-facing message. For logs and dev overlays, never for a panel. */
  readonly rawMessage: string;
  readonly requestId: string | null;
  readonly details?: Record<string, unknown>;

  constructor(init: {
    status: number;
    code: ApiErrorCode;
    rawMessage: string;
    requestId?: string | null;
    details?: Record<string, unknown>;
  }) {
    super(`${init.code} (${init.status}): ${init.rawMessage}`);
    this.status = init.status;
    this.code = init.code;
    this.rawMessage = init.rawMessage;
    this.requestId = init.requestId ?? null;
    this.details = init.details;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** Narrows an unknown envelope to `ApiErrorResponseDto` without trusting it. */
export function parseErrorEnvelope(body: unknown): ApiErrorResponseDto | null {
  if (typeof body !== "object" || body === null) return null;
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.code !== "string" || typeof candidate.message !== "string") {
    return null;
  }
  return {
    statusCode: typeof candidate.statusCode === "number" ? candidate.statusCode : 0,
    code: candidate.code,
    message: candidate.message,
    requestId: typeof candidate.requestId === "string" ? candidate.requestId : "",
    details:
      typeof candidate.details === "object" && candidate.details !== null
        ? (candidate.details as Record<string, unknown>)
        : undefined,
  };
}

const KNOWN_CODES = new Set<string>([
  "OTP_COOLDOWN",
  "OTP_RATE_LIMITED",
  "OTP_NOT_FOUND",
  "OTP_INVALID",
  "OTP_ATTEMPTS_EXCEEDED",
  "REFRESH_MISSING",
  "REFRESH_INVALID",
  "REFRESH_REUSE_DETECTED",
  "UNAUTHENTICATED",
  "ONBOARDING_ALREADY_COMPLETED",
  "CUSTOM_FIELDS_TOO_MANY",
  "CUSTOM_FIELD_KEY_TOO_LONG",
  "CUSTOM_FIELD_VALUE_TOO_LONG",
  "PROFILE_FIELD_NOT_FOUND",
  "PROFILE_FIELD_NOT_OWNED",
  "PROFILE_FIELD_GROUP_NOT_FOUND",
  "PHOTO_VIA_UPLOAD_ONLY",
  "FIELD_ENCRYPTION_NOT_CONFIGURED",
  "PHOTO_STORAGE_NOT_CONFIGURED",
  "PHOTO_TOO_LARGE",
  "PHOTO_TYPE_UNSUPPORTED",
  "PHOTO_NOT_FOUND",
  "CONTACT_NOT_FOUND",
  "CARD_NOT_FOUND",
  "DUPLICATE_FIELD_IN_CARD",
  "PHOTO_NOT_A_CARD_FIELD",
  "CARD_SHARE_TEMPLATE_NOT_CONFIGURED",
  "LOGO_STORAGE_NOT_CONFIGURED",
  "LOGO_TOO_LARGE",
  "LOGO_TYPE_UNSUPPORTED",
  "LOGO_NOT_FOUND",
  "SHARE_LINK_NOT_FOUND",
  "SHARE_LINK_REVOKED",
  "CANNOT_CONNECT_TO_SELF",
  "TEMPLATE_ALREADY_REGISTERED",
  "TEMPLATE_NOT_FOUND",
  "BAD_REQUEST",
  "NOT_FOUND",
]);

/** An unrecognised code degrades to `UNKNOWN` rather than throwing — a spec bump must not 500 the UI. */
export function narrowCode(code: string): ApiErrorCode {
  return KNOWN_CODES.has(code) ? (code as ApiErrorCode) : "UNKNOWN";
}

/* ── The copy table ──────────────────────────────────────────────────────────────────── */

type Copy = Pick<FixtureError, "kind" | "title" | "detail" | "retryable">;

/**
 * Sentence case, no jargon, no codes, and a `detail` that says what to do next — the §6.10
 * rules the fixture gateway's two errors were already written to.
 *
 * `retryable` is a claim about whether pressing the same button again could plausibly
 * succeed. `OTP_INVALID` is retryable (type the right digits); `OTP_ATTEMPTS_EXCEEDED` is
 * not (even the correct code is now rejected) — and getting that distinction wrong is how a
 * retry button becomes a lie.
 */
const COPY: Readonly<Record<ApiErrorCode, Copy>> = {
  OTP_COOLDOWN: {
    kind: "unknown",
    title: "Give it a moment",
    detail: "You can ask for another code in under a minute.",
    retryable: false,
  },
  OTP_RATE_LIMITED: {
    kind: "forbidden",
    title: "Too many codes requested",
    detail: "You've hit the hourly limit. Try again later, or use a different number.",
    retryable: false,
  },
  OTP_NOT_FOUND: {
    kind: "not-found",
    title: "That code has expired",
    detail: "Ask for a new one and enter it within a few minutes.",
    retryable: false,
  },
  OTP_INVALID: {
    kind: "unknown",
    title: "That code didn't match",
    detail: "Check the digits and try again.",
    retryable: true,
  },
  OTP_ATTEMPTS_EXCEEDED: {
    kind: "forbidden",
    title: "Too many wrong attempts",
    detail: "For safety, this code no longer works. Ask for a new one.",
    retryable: false,
  },
  REFRESH_MISSING: {
    kind: "forbidden",
    title: "You've been signed out",
    detail: "Sign in again to pick up where you left off.",
    retryable: false,
  },
  REFRESH_INVALID: {
    kind: "forbidden",
    title: "Your session expired",
    detail: "Sign in again to pick up where you left off.",
    retryable: false,
  },
  REFRESH_REUSE_DETECTED: {
    kind: "forbidden",
    title: "We signed you out to be safe",
    detail: "Your session was used from somewhere unexpected. Sign in again.",
    retryable: false,
  },
  UNAUTHENTICATED: {
    kind: "forbidden",
    title: "You've been signed out",
    detail: "Sign in again to pick up where you left off.",
    retryable: false,
  },
  ONBOARDING_ALREADY_COMPLETED: {
    kind: "unknown",
    title: "Your profile is already set up",
    detail: "Edit it from your profile instead.",
    retryable: false,
  },
  CUSTOM_FIELDS_TOO_MANY: {
    kind: "unknown",
    title: "That's too many custom fields",
    detail: "Remove a few and save again.",
    retryable: false,
  },
  CUSTOM_FIELD_KEY_TOO_LONG: {
    kind: "unknown",
    title: "That label is too long",
    detail: "Shorten it and save again.",
    retryable: false,
  },
  CUSTOM_FIELD_VALUE_TOO_LONG: {
    kind: "unknown",
    title: "That value is too long",
    detail: "Shorten it and save again.",
    retryable: false,
  },
  PROFILE_FIELD_NOT_FOUND: {
    kind: "not-found",
    title: "That field is gone",
    detail: "It was removed. Refresh to see your current profile.",
    retryable: false,
  },
  PROFILE_FIELD_NOT_OWNED: {
    kind: "forbidden",
    title: "We couldn't save that order",
    detail: "Refresh your profile and try moving the field again.",
    retryable: true,
  },
  PROFILE_FIELD_GROUP_NOT_FOUND: {
    kind: "not-found",
    title: "That group is gone",
    detail: "It was removed. Refresh to see your current profile.",
    retryable: false,
  },
  PHOTO_VIA_UPLOAD_ONLY: {
    kind: "unknown",
    title: "Photos are added by uploading",
    detail: "Use the photo button on your profile instead.",
    retryable: false,
  },
  FIELD_ENCRYPTION_NOT_CONFIGURED: {
    kind: "unknown",
    title: "Payment details aren't available yet",
    detail: "This is being set up on our side. Try again later.",
    retryable: false,
  },
  PHOTO_STORAGE_NOT_CONFIGURED: {
    kind: "unknown",
    title: "Photo uploads aren't available yet",
    detail: "This is being set up on our side. Try again later.",
    retryable: false,
  },
  PHOTO_TOO_LARGE: {
    kind: "unknown",
    title: "That photo is too large",
    detail: "Pick one under 20 MB, or crop it first.",
    retryable: false,
  },
  PHOTO_TYPE_UNSUPPORTED: {
    kind: "unknown",
    title: "That file type won't work",
    detail: "Use a JPEG, PNG or WebP image.",
    retryable: false,
  },
  PHOTO_NOT_FOUND: {
    kind: "not-found",
    title: "There's no photo to remove",
    detail: "Your profile is already using a monogram.",
    retryable: false,
  },
  CONTACT_NOT_FOUND: {
    kind: "not-found",
    title: "We couldn't find that contact",
    detail: "It may have been removed. Refresh your contacts.",
    retryable: false,
  },
  CARD_NOT_FOUND: {
    kind: "not-found",
    title: "We couldn't find that card",
    detail: "It may have been archived. Refresh your cards.",
    retryable: false,
  },
  DUPLICATE_FIELD_IN_CARD: {
    kind: "unknown",
    title: "That field is already on this card",
    detail: "Each field can appear once. Remove the duplicate and save again.",
    retryable: false,
  },
  PHOTO_NOT_A_CARD_FIELD: {
    kind: "unknown",
    title: "Photos aren't card fields",
    detail: "Your profile photo shows on every card already.",
    retryable: false,
  },
  CARD_SHARE_TEMPLATE_NOT_CONFIGURED: {
    kind: "unknown",
    title: "We couldn't send the WhatsApp message",
    detail: "The link below is live — copy it and send it yourself for now.",
    retryable: false,
  },
  LOGO_STORAGE_NOT_CONFIGURED: {
    kind: "unknown",
    title: "Logo uploads aren't available yet",
    detail: "This is being set up on our side. Try again later.",
    retryable: false,
  },
  LOGO_TOO_LARGE: {
    kind: "unknown",
    title: "That logo is too large",
    detail: "Pick one under 20 MB, or export it smaller first.",
    retryable: false,
  },
  LOGO_TYPE_UNSUPPORTED: {
    kind: "unknown",
    title: "That file type won't work",
    detail: "Use a JPEG, PNG or WebP image.",
    retryable: false,
  },
  LOGO_NOT_FOUND: {
    /* Reachable by removing a logo twice — a double-tap, or two tabs on the same card. The card
       is already in the state the owner asked for, so the copy says that rather than apologising
       for a failure that changed nothing. */
    kind: "not-found",
    title: "There's no logo to remove",
    detail: "This card is already showing its name instead.",
    retryable: false,
  },
  SHARE_LINK_NOT_FOUND: {
    kind: "not-found",
    title: "We couldn't find that link",
    detail: "It may have been removed. Refresh your shared links.",
    retryable: false,
  },
  SHARE_LINK_REVOKED: {
    kind: "forbidden",
    title: "This card is no longer shared",
    detail: "The owner turned this link off. Ask them for a new one.",
    retryable: false,
  },
  CANNOT_CONNECT_TO_SELF: {
    kind: "unknown",
    title: "That's your own card",
    detail: "Use a different number, or share the card with someone else instead.",
    retryable: false,
  },
  TEMPLATE_ALREADY_REGISTERED: {
    kind: "unknown",
    title: "That template is already registered",
    detail: "Edit the existing one instead of adding it again.",
    retryable: false,
  },
  TEMPLATE_NOT_FOUND: {
    kind: "not-found",
    title: "We couldn't find that template",
    detail: "It may have been removed. Refresh the list.",
    retryable: false,
  },
  BAD_REQUEST: {
    kind: "unknown",
    title: "We couldn't accept that",
    detail: "Check what you entered and try again.",
    // Retryable: the same button *can* succeed once the value is corrected, which is the
    // question `retryable` answers. It is not a claim that resubmitting the same value works.
    retryable: true,
  },
  NOT_FOUND: {
    kind: "not-found",
    title: "We couldn't find that",
    detail: "It may have moved or been removed.",
    retryable: false,
  },
  NETWORK: {
    kind: "network",
    title: "You're offline",
    detail: "Check your connection and try again.",
    retryable: true,
  },
  TIMEOUT: {
    kind: "network",
    title: "That took too long",
    detail: "The connection is slow right now. Try again in a moment.",
    retryable: true,
  },
  MALFORMED: {
    kind: "unknown",
    title: "Something went wrong",
    detail: "We couldn't read the response. Try again in a moment.",
    retryable: true,
  },
  UNKNOWN: {
    kind: "unknown",
    title: "Something went wrong",
    detail: "We couldn't load this just now. Try again in a moment.",
    retryable: true,
  },
};

/**
 * An `ApiError` as the shape every existing error panel already renders.
 *
 * Anything that is not an `ApiError` — a thrown string, a bug in our own mapper — lands on
 * `UNKNOWN` rather than leaking a stack trace into the interface.
 */
export function toScreenError(error: unknown): FixtureError {
  const code: ApiErrorCode = isApiError(error) ? error.code : "UNKNOWN";
  if (code === "NETWORK" && !browserSaysOffline()) return { ...UNREACHABLE };
  return { ...COPY[code] };
}

/**
 * ⚠ **`NETWORK` means `fetch` threw — not that the device is offline.**
 *
 * A request the browser blocks (a cross-origin call with no `Access-Control-Allow-Origin`), a
 * DNS failure or a server that drops the connection all throw the same `TypeError` as a dead
 * Wi-Fi link. Telling a user with a working connection "You're offline" sent them to check their
 * network over what was a direct call to the API being blocked by CORS — the bug that shipped
 * with the `/contacts` bypass. So "offline" is claimed only when the browser itself says so.
 */
const UNREACHABLE: Copy = {
  kind: "network",
  title: "We couldn't reach ContactBook",
  detail: "Your connection looks fine, but our server didn't answer. Try again in a moment.",
  retryable: true,
};

/** `false` on the server, where there is no `navigator.onLine` to consult. */
function browserSaysOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** The support reference, when there is one. Rendered small and secondary, never as a headline. */
export function supportReference(error: unknown): string | null {
  return isApiError(error) ? error.requestId : null;
}

/** True when signing in again is the only way forward — the router uses this to redirect. */
export function isSessionExpired(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return (
    error.code === "UNAUTHENTICATED" ||
    error.code === "REFRESH_MISSING" ||
    error.code === "REFRESH_INVALID" ||
    error.code === "REFRESH_REUSE_DETECTED"
  );
}
