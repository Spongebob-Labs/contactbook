/**
 * `cards` — 7 endpoints.
 *
 * A card owns a name, a kind, and a curated ordered subset of the owner's profile fields.
 * It owns **no appearance** and **no slug**: see `CardResponseDto` for the list of UI
 * properties with no column behind them, and `map.ts` for how appearance is derived from
 * `kind` until they exist.
 */

import "server-only";

import { authed } from "@/lib/api/server";
import type {
  CardResponseDto,
  CreateCardDto,
  SetCardFieldsDto,
  ShareCardDto,
  ShareLinkResponseDto,
  UpdateCardDto,
} from "@/lib/api/schema";

export function listCards(options?: { includeArchived?: boolean }): Promise<CardResponseDto[]> {
  return authed({
    method: "GET",
    path: "/cards",
    query: { includeArchived: options?.includeArchived },
  });
}

/** Starts empty — a new card has no fields until `setCardFields` runs. */
export function createCard(body: CreateCardDto): Promise<CardResponseDto> {
  return authed({ method: "POST", path: "/cards", body });
}

/** Includes the curated field list, resolved and decrypted. @throws `CARD_NOT_FOUND`. */
export function getCard(id: string): Promise<CardResponseDto> {
  return authed({ method: "GET", path: `/cards/${encodeURIComponent(id)}` });
}

/** Name and kind only — appearance has nowhere to go. @throws `CARD_NOT_FOUND`. */
export function updateCard(id: string, body: UpdateCardDto): Promise<CardResponseDto> {
  return authed({ method: "PATCH", path: `/cards/${encodeURIComponent(id)}`, body });
}

/**
 * ⚠ Archives the card **and revokes every active share link on it** — recipients get a 410,
 * not a link that quietly still works. The confirm dialog has to say that, because it is the
 * part a person will not guess.
 *
 * @throws `CARD_NOT_FOUND`.
 */
export function archiveCard(id: string): Promise<void> {
  return authed({ method: "DELETE", path: `/cards/${encodeURIComponent(id)}` });
}

/**
 * ⚠ REPLACES the entire curated set. Send every field to keep, in display order — a PATCH-
 * shaped call that sends only what changed will silently strip the rest.
 *
 * All-or-nothing: every `fieldId` must be one of your own, non-archived, non-`PHOTO` fields.
 *
 * @throws `CARD_NOT_FOUND`, `PROFILE_FIELD_NOT_FOUND`, `DUPLICATE_FIELD_IN_CARD`,
 * `PHOTO_NOT_A_CARD_FIELD`.
 */
export function setCardFields(id: string, body: SetCardFieldsDto): Promise<CardResponseDto> {
  return authed({ method: "PUT", path: `/cards/${encodeURIComponent(id)}/fields`, body });
}

/**
 * Mint (or reuse) the share link for this `(card, contact)` pair and enqueue a WhatsApp send.
 *
 * Two things worth knowing before wiring a button to this:
 * 1. It is **idempotent per pair** — calling it twice does not create a second link, so a
 *    double-tap is harmless and a "already shared" check is unnecessary.
 * 2. The WhatsApp send needs an approved `CARD_SHARE` template. Without one it fails with
 *    `CARD_SHARE_TEMPLATE_NOT_CONFIGURED` — **but the returned `url` is real and live
 *    regardless**, so the UI should always show the link and treat the send as the optional
 *    half. That is why the copy for that code points at the link rather than apologising.
 *
 * @throws `CARD_NOT_FOUND`, `CONTACT_NOT_FOUND`.
 */
export function shareCard(id: string, body: ShareCardDto): Promise<ShareLinkResponseDto> {
  return authed({ method: "POST", path: `/cards/${encodeURIComponent(id)}/share`, body });
}
