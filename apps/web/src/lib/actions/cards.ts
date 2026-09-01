"use server";

/**
 * Card mutations — all seven card endpoints plus share-link revoke/restore.
 *
 * ## ⚠ Every export must be an async function
 * A `"use server"` directive turns each export into a callable server endpoint, so a synchronous
 * helper here is a **build error** rather than a type error. Pure helpers live in `map.ts`.
 *
 * ## The two writes behind one Save button
 * The builder edits two different things at once, and they belong to different endpoints:
 *
 * · **which fields the card shares** → `PUT /cards/{id}/fields` (a full replace, not a patch)
 * · **the value of one of those fields** → `PATCH /profile/fields/{id}`, because a value belongs
 *   to the *profile*, not to the card. Changing it here changes it on every card that maps it —
 *   which is §5.3 working as intended, and the reason the Save toast has to say so.
 *
 * `saveCardAction` performs them in that order and reports what actually happened.
 *
 * ## What Save cannot persist
 * Appearance. `templateId`, `paletteId`, `groundHex`, `finish`, `texture` — none has a column
 * (`docs/INTEGRATION.md` ask #2), so the builder's design panel is read-only against the API and
 * nothing here pretends to store it. A card's look is derived from its `kind`.
 */

import { revalidatePath } from "next/cache";

import { cards, profile, shareLinks } from "@/lib/api";
import { toApiCardKind, toCardFieldEntries } from "@/lib/api/map";
import type { ApiShareLinkStatus, CardResponseDto } from "@/lib/api/schema";
import type { CardType } from "@/types/domain";
import { failFrom, failLocally, succeed, type ActionResult } from "@/lib/actions/result";

const CARDS_PATH = "/cards";

function revalidateCard(cardId: string): void {
  revalidatePath(CARDS_PATH);
  revalidatePath(`${CARDS_PATH}/${cardId}`);
  revalidatePath(`${CARDS_PATH}/${cardId}/edit`);
}

/* ── Create ──────────────────────────────────────────────────────────────────────────── */

export interface CreateCardOutcome {
  cardId: string;
}

/**
 * Create a card, then give it its starting fields.
 *
 * Two calls, because `POST /cards` is documented as starting with **no fields** — there is no way
 * to create a populated card in one request. The seed comes from the template's preset resolved
 * against the owner's profile, which is what makes a template's blurb ("starts with your work
 * number and work email") true rather than aspirational.
 *
 * ⚠ If the field write fails the card still exists, empty. That is deliberately not rolled back:
 * there is no transaction across two endpoints, and deleting a just-created card to tidy up a
 * partial failure risks destroying a card the user can see. The outcome reports the card id
 * either way, so the builder opens on it and the owner can finish the job.
 */
export async function createCardAction(input: {
  name: string;
  type: CardType;
  fieldIds: readonly string[];
}): Promise<ActionResult<CreateCardOutcome>> {
  const name = input.name.trim();
  if (name.length === 0) return failLocally("Give the card a name.");

  let created: CardResponseDto;
  try {
    created = await cards.createCard({ name, kind: toApiCardKind(input.type) });
  } catch (thrown) {
    return failFrom(thrown);
  }

  if (input.fieldIds.length > 0) {
    try {
      await cards.setCardFields(created.id, { fields: toCardFieldEntries(input.fieldIds) });
    } catch (thrown) {
      // The card exists; only its fields did not land. Report the failure *and* the id, so the
      // caller can navigate to a real card rather than losing it.
      revalidateCard(created.id);
      return failFrom(thrown);
    }
  }

  revalidateCard(created.id);
  return succeed({ cardId: created.id });
}

/* ── Save (the builder's one button) ─────────────────────────────────────────────────── */

export interface SaveCardOutcome {
  /** How many profile field values were rewritten. Drives the "two writes" half of the toast. */
  valuesChanged: number;
}

/**
 * Persist a builder session.
 *
 * @param fieldIds the complete set the card should end up with, in display order — `PUT
 * /cards/{id}/fields` replaces rather than merges, so a partial list silently strips the rest.
 * @param values profile field values the owner edited inside the builder. Empty on most saves.
 */
export async function saveCardAction(
  cardId: string,
  input: {
    name: string;
    type: CardType;
    fieldIds: readonly string[];
    values: ReadonlyArray<{ fieldId: string; label: string; value: string }>;
  },
): Promise<ActionResult<SaveCardOutcome>> {
  const name = input.name.trim();
  if (name.length === 0) return failLocally("Give the card a name.");

  try {
    // Name and kind first: cheap, and it is the change most likely to be what the owner meant.
    await cards.updateCard(cardId, { name, kind: toApiCardKind(input.type) });

    // All-or-nothing upstream — one foreign or archived id and nothing changes.
    await cards.setCardFields(cardId, { fields: toCardFieldEntries(input.fieldIds) });

    // Sequential rather than concurrent: these are writes to the same profile, and a burst of
    // parallel PATCHes against one row ordering is a race nobody needs for a handful of fields.
    for (const edit of input.values) {
      await profile.updateField(edit.fieldId, { label: edit.label, value: edit.value });
    }

    revalidateCard(cardId);
    // The profile changed too, so its screen must not serve a stale read.
    revalidatePath("/profile");
    return succeed({ valuesChanged: input.values.length });
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/** Rename or re-kind a card from outside the builder. */
export async function updateCardAction(
  cardId: string,
  input: { name: string; type: CardType },
): Promise<ActionResult<undefined>> {
  const name = input.name.trim();
  if (name.length === 0) return failLocally("Give the card a name.");

  try {
    await cards.updateCard(cardId, { name, kind: toApiCardKind(input.type) });
    revalidateCard(cardId);
    return succeed(undefined);
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/* ── Archive ─────────────────────────────────────────────────────────────────────────── */

/**
 * Archive a card.
 *
 * ⚠ It also **revokes every active share link on it** — everyone who was sent this card gets a
 * 410 rather than a link that quietly still works. That is the part nobody would guess, so the
 * confirm dialog in front of this has to say it in the owner's own terms.
 */
export async function archiveCardAction(cardId: string): Promise<ActionResult<undefined>> {
  try {
    await cards.archiveCard(cardId);
    revalidateCard(cardId);
    revalidatePath("/contacts");
    return succeed(undefined);
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/* ── Share ───────────────────────────────────────────────────────────────────────────── */

export interface ShareOutcome {
  /** The live link. Real and resolvable whether or not the WhatsApp message went out. */
  url: string;
  shareLinkId: string;
  /**
   * True when the WhatsApp send could not be enqueued because no approved `CARD_SHARE` template
   * is registered. The link is still valid — the UI should offer it to copy rather than apologise.
   */
  templateMissing: boolean;
}

/**
 * Send a card to a contact.
 *
 * Two things worth knowing before wiring a button to this:
 *
 * 1. **It is idempotent per (card, contact) pair.** Calling it twice does not mint a second link,
 *    so a double tap is harmless and an "already shared" check is unnecessary.
 * 2. **The WhatsApp send is the optional half.** It needs an approved `CARD_SHARE` template
 *    (`POST /templates`); without one the call fails with `CARD_SHARE_TEMPLATE_NOT_CONFIGURED`
 *    — *but the returned url is real and live regardless*. That is why this action does not treat
 *    that code as an error: it succeeds, flags `templateMissing`, and lets the UI hand over the
 *    link. Treating it as a failure would hide a working link behind an apology.
 */
export async function shareCardAction(
  cardId: string,
  contactId: string,
): Promise<ActionResult<ShareOutcome>> {
  if (contactId.length === 0) return failLocally("Choose who to send this card to.");

  try {
    const link = await cards.shareCard(cardId, { contactId });
    revalidateCard(cardId);
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${contactId}`);
    return succeed({ url: link.url, shareLinkId: link.id, templateMissing: false });
  } catch (thrown) {
    // The one error that is not a failure. The link exists; only the message did not go out.
    // ⚠ The url is not in the error body, so it cannot be recovered here — the caller refreshes
    // and reads it from the card's share list instead.
    if (
      typeof thrown === "object" &&
      thrown !== null &&
      "code" in thrown &&
      thrown.code === "CARD_SHARE_TEMPLATE_NOT_CONFIGURED"
    ) {
      revalidateCard(cardId);
      revalidatePath("/contacts");
      return succeed({ url: "", shareLinkId: "", templateMissing: true });
    }
    return failFrom(thrown);
  }
}

/**
 * Revoke or restore one share link.
 *
 * `REVOKED` immediately 410s the public link. `ACTIVE` restores **the same token**, so a
 * previously-sent WhatsApp message starts working again — which is a genuine surprise, and the
 * reason the confirm copy says "you can restore this later" rather than implying permanence.
 */
export async function setShareLinkStatusAction(
  shareLinkId: string,
  status: ApiShareLinkStatus,
  cardId: string,
): Promise<ActionResult<undefined>> {
  try {
    await shareLinks.updateShareLink(shareLinkId, { status });
    revalidateCard(cardId);
    revalidatePath("/contacts");
    return succeed(undefined);
  } catch (thrown) {
    return failFrom(thrown);
  }
}
