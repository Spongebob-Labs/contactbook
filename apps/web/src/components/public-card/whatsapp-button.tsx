import { whatsappHref } from "@/lib/format";
import type { ResolvedCard, ResolvedField } from "@/types/domain";

/**
 * The secondary action of `/c/[slug]` — "Message on WhatsApp" (spec §6.9, §8A.2, §11 E-56).
 *
 * ## Why this file holds a rule and not a button
 * `<ShareFace>` paints **both** action controls inside the card skeleton, because the
 * action row is part of §8B.1's invariant anatomy and AC-20 counts exactly two of them per
 * `full` card. A second pair rendered by this page would be an immediate AC-20 failure.
 * What the page still owns is the *contract* — where the deep link points, and the rule
 * that decides whether the action exists at all — so it lives here, in one place, where a
 * test and a reader can both find it.
 *
 * ## The rule, and why "disabled" is the wrong answer
 * **No mapped `PHONE` ⇒ no action.** Not greyed out, not a tooltip explaining itself:
 * absent (E-56). A dead control is worse than no control — it advertises a capability the
 * card does not have and costs a tap to discover that. The action row then collapses from
 * two buttons to one full-width button with no gap left behind, which is why the renderer
 * builds the row from a list rather than from two fixed slots.
 *
 * ## Deliberately free of React
 * No component, no hook, no `"use client"`. It is a pure function over the one
 * `ResolvedCard` the page already resolved (I-5) so the page, its metadata and any test can
 * all ask the same question without dragging a client boundary along.
 */

/** The deep-link host. `wa.me` opens the app when installed and the web client otherwise. */
export const WHATSAPP_HOST = "wa.me";

export interface WhatsAppAction {
  /** `https://wa.me/{e164 without +}` (§6.9). */
  href: string;
  /**
   * Always `true`: the destination leaves the application, so the anchor carries
   * `target="_blank"` **and** `rel="noopener noreferrer"` (§7.3, AC-32).
   */
  external: true;
}

/**
 * The first mapped `PHONE`, or `undefined`.
 *
 * "First" is first in `ResolvedCard.fields`, which §6.4 already ordered deterministically —
 * so a card mapping both a work and a personal number always messages the same one, and the
 * `.vcf` and the card agree about which is primary.
 */
function primaryPhone(resolved: ResolvedCard): ResolvedField | undefined {
  return resolved.fields.find((field) => field.type === "PHONE");
}

/** The WhatsApp deep link for this card, or `null` when the card maps no `PHONE` (E-56). */
export function whatsappActionFor(resolved: ResolvedCard): WhatsAppAction | null {
  const phone = primaryPhone(resolved);
  if (phone === undefined) return null;
  return { href: whatsappHref(phone.value), external: true };
}

/** Whether the secondary action exists at all. The negative case is E-56. */
export function hasWhatsAppAction(resolved: ResolvedCard): boolean {
  return primaryPhone(resolved) !== undefined;
}
