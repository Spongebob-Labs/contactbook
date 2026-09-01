/**
 * `share-links` — 2 endpoints.
 *
 * This is the closest thing the API has to analytics, and it is the backbone of both the
 * dashboard and the per-contact view: every link carries `viewCount`, `firstViewedAt` and
 * `lastViewedAt`, so "who has actually opened your card" is answerable without a new
 * endpoint.
 *
 * ⚠ There is no `GET /share-links/{id}` and no create — links are minted only by
 * `shareCard()`. Revoke/restore is the entire mutation surface.
 */

import "server-only";

import { authed } from "@/lib/api/server";
import type { ShareLinkResponseDto, UpdateShareLinkDto } from "@/lib/api/schema";

/** Every link across every card, unpaginated. Join on `cardId` / `contactId` client-side. */
export function listShareLinks(): Promise<ShareLinkResponseDto[]> {
  return authed({ method: "GET", path: "/share-links" });
}

/**
 * `REVOKED` immediately 410s the public link. `ACTIVE` restores **the same token**, so a
 * revoke is reversible and a previously-sent WhatsApp message starts working again — which
 * is a genuine surprise, and the confirm copy should say "you can restore this later"
 * rather than implying it is permanent.
 *
 * @throws `SHARE_LINK_NOT_FOUND`.
 */
export function updateShareLink(
  id: string,
  body: UpdateShareLinkDto,
): Promise<ShareLinkResponseDto> {
  return authed({ method: "PATCH", path: `/share-links/${encodeURIComponent(id)}`, body });
}
