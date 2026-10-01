/**
 * The `/welcome` walkthrough's rules, as data — no React, so a unit test can hold every one.
 *
 * Three steps, each skippable, each editing one part of the card the API made at onboarding:
 *
 *     1 photo    the cover            POST /cards/{id}/cover  (a baked crop, never the raw file)
 *     2 about    position + bio       PATCH /cards/{id} {headline} / {bio}
 *     3 colour   the palette          PATCH /cards/{id} {paletteId, groundHex: null}
 *
 * The step lives in `?step=` so the browser's own Back moves between steps and a reload lands on
 * the step it left, and so each one is addressable for review.
 */

import type { PaletteId } from "@/card/template-palettes";
import type { ContactCard } from "@/types/domain";

export type WelcomeStepId = "photo" | "about" | "colour";

export interface WelcomeStep {
  /** 1-based — what `?step=` carries and what the progress row prints. */
  index: number;
  id: WelcomeStepId;
  /** The page's `<h1>`. A label, not a sentence: the card below it is the instruction. */
  title: string;
}

export const WELCOME_STEPS: readonly WelcomeStep[] = [
  { index: 1, id: "photo", title: "Add a photo" },
  { index: 2, id: "about", title: "Add your role and bio" },
  { index: 3, id: "colour", title: "Pick a colour" },
];

export const WELCOME_STEP_COUNT = WELCOME_STEPS.length;

export const WELCOME_PATH = "/welcome";

/**
 * `?step=` → a step. Anything unreadable is step 1 rather than an error: the param is a
 * convenience, and a hand-typed `?step=9` should land somewhere useful, never on a blank page.
 */
export function welcomeStepFor(param: string | null | undefined): WelcomeStep {
  const n = Number(param);
  return WELCOME_STEPS.find((step) => step.index === n) ?? WELCOME_STEPS[0];
}

export function welcomeHref(step: WelcomeStep): string {
  return step.index === 1 ? WELCOME_PATH : `${WELCOME_PATH}?step=${step.index}`;
}

/**
 * The name `POST /profile/onboarding` gives the card it creates
 * (`apps/api/src/profile/profile-onboarding.service.ts`, `createDefaultCard`).
 */
export const STARTER_CARD_NAME = "My Card";

/**
 * The card this walkthrough edits: the one onboarding made, found by the name it was given.
 *
 * Falls back to the first card the API lists, so an owner who renamed it — or who reached
 * `/welcome` again later with a card set of their own — still gets a card to work on rather
 * than an empty state. `null` only when there is no card at all.
 */
export function pickStarterCard(cards: readonly ContactCard[]): ContactCard | null {
  const named = cards.find(
    (card) => card.name.trim().toLowerCase() === STARTER_CARD_NAME.toLowerCase(),
  );
  return named ?? cards[0] ?? null;
}

/**
 * The colours offered on step 3 — six, so the row fits one line at a 390px phone with 44px
 * targets (6 × 44 + 5 × 12 = 324 ≤ 358). Three light grounds, three deep, in that order.
 *
 * ⚠ Amber is here because it is what a `PERSONAL` card — the starter card's kind — wears by
 * default (`appearanceForKind`), so the owner's current colour is always one of the choices.
 * The green grounds (Emerald, Pistachio, Mint) are left out of this row, matching the Atelier
 * rule of no green in the product's own surfaces; all eleven remain in the builder.
 */
export const WELCOME_PALETTES: readonly PaletteId[] = [
  "amber",
  "ivory",
  "periwinkle",
  "sapphire",
  "oxblood",
  "onyx",
];

/** `Card.headline` is ≤ 80 characters server-side. */
export const HEADLINE_MAX = 80;

/** `Card.bio` is ≤ 280 characters server-side. */
export const BIO_MAX = 280;

/**
 * What a committed inline edit should send, or `undefined` when there is nothing to send.
 *
 * `shown` is the text the line displayed when editing began — the card's own value, or the
 * derived one it falls back to (a mapped `JOB_TITLE`, say). Committing it unchanged sends
 * nothing, so tapping in and out of a derived line never pins the derivation as the owner's own
 * words. Empty becomes `null`, which is how `PATCH` clears a column.
 */
export function textPatchValue(
  raw: string,
  shown: string,
  own: string | null | undefined,
): string | null | undefined {
  const next = raw.trim();
  if (next === shown.trim()) return undefined;
  if (next === "") return (own ?? "").trim() === "" ? undefined : null;
  return next;
}
