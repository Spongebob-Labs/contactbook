/**
 * `cards` — 9 endpoints.
 *
 * A card owns a name, a kind, a curated ordered subset of the owner's profile fields, the seven
 * design axes, and — since the logo pair landed — one uploaded image.
 *
 * ## ⚠ The logo is the one card property that is not a column you can write
 *
 * Every other attribute of a card is set by sending its value. `logoUrl` is not: `POST /cards`
 * and `PATCH /cards/{id}` both **reject it as a plain string**, so there is no
 * `updateCard(id, { logoUrl })` to write and none is offered below. A logo exists only where a
 * file was actually uploaded, through one of exactly two doors:
 *
 * · {@link createCard}'s optional second argument — a card born wearing its logo, and
 * · {@link uploadCardLogo} — a logo added to, or replaced on, a card that already exists.
 *
 * {@link removeCardLogo} is the only way back to none.
 */

import "server-only";

import { authed } from "@/lib/api/server";
import type {
  AudienceResponseDto,
  NotifyCardDto,
  NotifyResultDto,
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

/**
 * Starts empty — a new card has no fields until `setCardFields` runs — and optionally already
 * wearing a logo.
 *
 * ⚠ **Sent as `multipart/form-data`, never JSON**, whether or not a file comes with it. The API
 * declares exactly one encoding for this operation and a single code path is worth more than
 * saving a boundary string on the calls that carry no file: a create that switched encoding
 * based on whether a logo happened to be chosen would be two request shapes, one of which is
 * exercised only by the people who picked a file.
 *
 * ⚠ **A failed logo fails the whole create.** No card is written, so there is no partial
 * "created but logo missing" state for a caller to detect, unwind, or leave behind. That is why
 * a logo belongs on this call at all rather than as a create followed by
 * {@link uploadCardLogo}: that pair has no transaction across it, and its failure mode is a card
 * the owner can see, wearing nothing they chose.
 *
 * @throws `LOGO_TOO_LARGE` (413), `LOGO_TYPE_UNSUPPORTED` (415) — both only when `logo` is given.
 */
export function createCard(body: CreateCardDto, logo?: File): Promise<CardResponseDto> {
  return authed({ method: "POST", path: "/cards", form: toCreateCardForm(body, logo) });
}

/**
 * The create body as form fields.
 *
 * ⚠ **`null` and `undefined` are both omitted**, and on this one endpoint that is correct rather
 * than lossy. `toAppearanceDto` sends an explicit `null` on *update* because a `PATCH` leaves an
 * omitted column alone, so "the owner cleared their custom colour" has to be said out loud. A
 * create has nothing to clear — every column starts null — so the two are indistinguishable
 * here, and the string `"null"` is what a naive `String(value)` would actually put in the
 * column.
 */
function toCreateCardForm(body: CreateCardDto, logo?: File): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    form.set(key, String(value));
  }
  if (logo !== undefined) form.set("file", logo);
  return form;
}

/** Includes the curated field list, resolved and decrypted. @throws `CARD_NOT_FOUND`. */
export function getCard(id: string): Promise<CardResponseDto> {
  return authed({ method: "GET", path: `/cards/${encodeURIComponent(id)}` });
}

/**
 * Name, kind and the seven design axes. **Not the logo** — `logoUrl` is rejected here as a plain
 * string; see the module note. @throws `CARD_NOT_FOUND`.
 */
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
/**
 * Everyone this card is shared with, and how far behind each is on its current version.
 *
 * Read-only and cheap to repeat — it is also the **only** way to learn whether a notify actually
 * landed, since `notifyCard` answers `ENQUEUED` before the send is attempted.
 */
export function getCardAudience(id: string): Promise<AudienceResponseDto> {
  return authed({ method: "GET", path: `/cards/${encodeURIComponent(id)}/audience` });
}

/**
 * Tell the given recipients this card changed.
 *
 * ⚠ All-or-nothing: one id that is not an ACTIVE link on THIS card fails the whole call with
 * `SHARE_LINK_NOT_FOUND`. Validate against a fresh `getCardAudience` first.
 *
 * ⚠ The `ENQUEUED` it returns is a queue receipt, not a delivery — see `NotifyResultDto`.
 */
export function notifyCard(id: string, body: NotifyCardDto): Promise<NotifyResultDto[]> {
  return authed({ method: "POST", path: `/cards/${encodeURIComponent(id)}/notify`, body });
}

export function shareCard(id: string, body: ShareCardDto): Promise<ShareLinkResponseDto> {
  return authed({ method: "POST", path: `/cards/${encodeURIComponent(id)}/share`, body });
}

/* ── the logo ────────────────────────────────────────────────────────────────────────── */

/**
 * Upload this card's logo, or replace the one it has.
 *
 * JPEG / PNG / WebP, up to 20 MB. There is no separate "replace" call and none is needed:
 * uploading over an existing logo deletes the old object from storage as part of the same
 * request, so a caller never has to remove before it uploads — and must not, since a remove
 * that succeeded followed by an upload that failed would leave the card bare.
 *
 * Returns the **whole card**, not a bare URL. That is worth using: the response is the same
 * `CardResponseDto` every other card read returns, so a caller can put it straight back into
 * `toContactCard` rather than patching `logoUrl` into a card object it is already holding and
 * hoping the two agree.
 *
 * @throws `CARD_NOT_FOUND` (404), `LOGO_STORAGE_NOT_CONFIGURED` (409), `LOGO_TOO_LARGE` (413),
 * `LOGO_TYPE_UNSUPPORTED` (415).
 */
export function uploadCardLogo(id: string, file: File): Promise<CardResponseDto> {
  const form = new FormData();
  form.set("file", file);
  return authed({ method: "POST", path: `/cards/${encodeURIComponent(id)}/logo`, form });
}

/**
 * Remove this card's logo. `204`, no body — the card falls back to its text mark everywhere.
 *
 * @throws `CARD_NOT_FOUND` (404), `LOGO_NOT_FOUND` (404 — the card has no logo to remove). The
 * second is reachable by a double-tap or a second tab, and is a state the owner already wanted;
 * `errors.ts` gives it copy that says so rather than reporting a failure that changed nothing.
 */
export function removeCardLogo(id: string): Promise<void> {
  return authed({ method: "DELETE", path: `/cards/${encodeURIComponent(id)}/logo` });
}
