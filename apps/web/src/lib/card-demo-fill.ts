import type { ContactCard } from "@/types/domain";

/**
 * ⚠ **A DEMO STAND-IN FOR THE SLOTS THE API CANNOT HOLD. DELETE WITH `card-local-draft.ts`.**
 *
 * ## What it does and why it exists
 *
 * `headline` and `bio` have no API column, so a card the owner has not opened in the builder on
 * *this browser* has neither — and the redesigned card page then shows a name over a button with
 * a gap where its voice should be. On `/cards` that made every tile look unfinished, which is
 * what this was asked for: fill them with something so the design can be judged.
 *
 * It fills **only what is still empty**, after `withLocalCardDraft` has had its turn. A card the
 * owner has actually written a bio for is untouched.
 *
 * ## ⚠ IT MUST NEVER REACH A SHARED CARD, AND THAT IS ENFORCED BY WHERE IT IS CALLED
 *
 * This writes words the owner did not write. On the owner's own screens that is a visible
 * placeholder they can replace in the builder. On `/c/{slug}` it would be a stranger reading an
 * invented sentence as though the owner had said it — about themselves, on a card they hand to
 * people at events. That is not a cosmetic difference.
 *
 * The guard is structural rather than a rule to remember: `/c/{slug}` is server-rendered and
 * resolves through `parsePublicCard`, which never calls this. The three call sites are all
 * owner-facing client surfaces — the cards list, the card detail screen, the builder — and each
 * is marked. **Do not call this from anything a recipient can open.**
 *
 * ## Why there is no stand-in cover
 *
 * `resolveCover` already falls back to the owner's mapped `PHOTO` and then to `User.avatarUrl`,
 * and with neither the cover paints the card's own gradient — a designed empty state, not a gap.
 * Putting a bundled photograph there would be showing somebody a stranger's face on their own
 * card, which is worse than an honest gradient by a wide margin.
 */

/**
 * Deliberately generic, and true of any card.
 *
 * It is not trying to sound like the owner — a stand-in that impersonates a voice is harder to
 * notice and therefore likelier to be shared by accident. This reads as a default, which is what
 * it is.
 */
const DEMO_BIO = "Always happy to connect — here is the easiest way to reach me.";

/** Only used when the card maps no `JOB_TITLE` either; `resolveHeadline` tries that first. */
const DEMO_HEADLINE = "Contact Book member";

export function withDemoFill(card: ContactCard): ContactCard {
  const hasHeadline = typeof card.headline === "string" && card.headline.trim() !== "";
  const hasBio = typeof card.bio === "string" && card.bio.trim() !== "";
  if (hasHeadline && hasBio) return card;

  return {
    ...card,
    /* ⚠ `headline` is left alone unless the card has nothing at all, because `resolveHeadline`
       falls back to the first mapped `JOB_TITLE` — a real value the owner typed — and filling
       here would pre-empt it with a worse one. `undefined` keeps that fallback alive; a string
       would win over it. */
    headline: hasHeadline ? card.headline : undefined,
    bio: hasBio ? card.bio : DEMO_BIO,
  };
}

/**
 * The headline stand-in, for a surface that wants one even when no `JOB_TITLE` exists.
 *
 * Exported rather than applied above for the reason in that comment: the resolver's own fallback
 * is better than this, and this must not get in front of it.
 */
export { DEMO_HEADLINE };
