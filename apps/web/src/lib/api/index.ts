/**
 * The API client's public surface.
 *
 * Import from here, not from the files underneath: the split between `endpoints/*` and
 * `transport.ts` is an implementation detail, and keeping one entry point means a future
 * change of transport (a generated client, a proxy) touches this file and nothing else.
 *
 * ⚠ Everything re-exported here is server-only. Client components reach the API through the
 * Server Actions in `@/lib/actions/*`, never directly.
 */

export * as auth from "@/lib/api/endpoints/auth";
export * as profile from "@/lib/api/endpoints/profile";
export * as contacts from "@/lib/api/endpoints/contacts";
export * as cards from "@/lib/api/endpoints/cards";
export * as shareLinks from "@/lib/api/endpoints/share-links";
export * as templates from "@/lib/api/endpoints/templates";

export { ApiError, isApiError, isSessionExpired, supportReference, toScreenError } from "@/lib/api/errors";
export type { ApiErrorCode } from "@/lib/api/errors";
export { hasSession } from "@/lib/api/server";
export { readSession, writeSession, clearSession } from "@/lib/api/session";
export type * from "@/lib/api/schema";
