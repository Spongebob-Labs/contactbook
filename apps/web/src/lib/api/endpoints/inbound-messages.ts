/**
 * `inbound-messages` — one endpoint, and a loud warning attached to it.
 *
 * ⚠ **`GET /inbound-messages` IS NOT OWNERSHIP-SCOPED.** The API says so itself: *"Every message
 * that has hit our WhatsApp number, from anyone … no ownership scoping, this is a raw capture."*
 * It is tagged `webhooks`. Calling the unfiltered form returns other users' phone numbers,
 * WhatsApp display names and message bodies.
 *
 * This module is `server-only`, and that is the enforcement rather than a convention: a
 * `"use client"` file importing it fails the build. The one consumer in this app is
 * `app/api/inbound/connects/route.ts`, which joins against the caller's own contacts on the
 * server and hands the browser only the rows that were already the caller's to see.
 */
import "server-only";

import { authed } from "@/lib/api/server";
import type { InboundMessageResponseDto, ListInboundMessagesQuery } from "@/lib/api/schema";

/** The API's own ceiling. Asking for more is silently capped, so ask for exactly this. */
export const INBOUND_MESSAGE_LIMIT = 500;

/**
 * ⚠ The query goes through `transport`'s own `query` option, not into the path — the house
 * pattern (`profile.listFields`) and load-bearing beyond tidiness: `api-contract.test.ts`
 * reads the `path` string out of these files statically to compare against the OpenAPI
 * snapshot. A template literal with a ternary in it parses as
 * `GET /inbound-messages${qs === "" ? "" :` and the coverage check reports an invented
 * endpoint. `transport` also drops `undefined` values, so no key is sent for an absent option.
 */
export function listInboundMessages(
  query: ListInboundMessagesQuery = {},
): Promise<InboundMessageResponseDto[]> {
  return authed({
    method: "GET",
    path: "/inbound-messages",
    query: { fromPhoneE164: query.fromPhoneE164, limit: query.limit },
  });
}
