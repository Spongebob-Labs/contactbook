import type { Metadata } from "next";

import { Broadcast } from "@/components/marketing/broadcast";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { Problem } from "@/components/marketing/problem";
import { StepList } from "@/components/marketing/step-list";
import { Trust } from "@/components/marketing/trust";
import { pageMeta } from "@/fixtures/marketing";

import "@/styles/marketing-motion.css";

/**
 * `/` — the marketing one-pager. THE WALLET DECK.
 *
 * Direction and rationale: `.impeccable/surfaces/src-app-marketing-page-tsx.md`.
 * Why the previous rendition failed and which rules it was following:
 * `docs/decisions/2026-08-24-marketing-micro-direction.md`.
 *
 * ## The structure
 * The page is a wallet. The hero is the ruled sheet the deck lies on; every section after it is
 * a pass, inset, with its own ground and its own shadow, riding over the lip of the one above.
 * The reader scrolls down a stack of the product's own object.
 *
 * ## The ground sequence is composed, not alternated
 * Nine passes, and the colour order is a decision: white and paper carry the argument, the two
 * emotional peaks take a wash (`broadcast` on Pistachio, `trust` on Clay), the roadmap sits on
 * Periwinkle so it reads as a different kind of claim, and the close inverts to Onyx so the last
 * thing on the page is the only dark surface on it. Alternating two greys would have been the
 * safe version and is what made the previous build read as a document.
 *
 * ## The cards live in the bento, and the hero holds none
 * The hero was a card, then a card around a film, then a film; all three are gone at the
 * client's word and it is now type on paper with no object in it at all. The page's live card
 * renders are the two in the bento's studio cell. Every other section was previously
 * illustrated with one — nine in the template strip alone — which is what the brief stopped.
 *
 * ## ⚠ SEVEN SECTIONS, DOWN FROM NINE — and no pricing
 * The client's note was that the page is *"so text-heavy… just to the point, crisp, and just
 * relevant information."* Two passes were cut outright rather than trimmed:
 *
 *   · **`assistant`** — 154 words plus a disclosure paragraph explaining that the feature does
 *     not exist. A section whose most important sentence is "not built yet" is the slowest
 *     thing on a landing page to read, and removing it removes the disclosure obligation with
 *     it. Nothing on the page now describes an unshipped capability.
 *   · **`fields`** — a 21-item inventory grid. The bento's first cell already shows real
 *     profile rows with real private masking, so the catalogue was proving a point the page
 *     had already demonstrated, in list form.
 *
 * The remaining copy was compressed by roughly half against the same standard: every claim
 * kept, every sentence that restated one dropped. `trust` and `faq` overlapped on three of
 * seven answers — the QR's contents, private fields, and deleting a card — so the FAQ now
 * answers only what `trust` does not.
 *
 * Pricing stays out: every figure that was here was invented.
 */

export const metadata: Metadata = {
  title: { absolute: "Contact Book — hand over one card, keep it true for years" },
  description: pageMeta.description,
  /**
   * The direction contract, emitted into the built HTML.
   *
   * It also exists as a comment in `(marketing)/layout.tsx` for whoever opens that file, but
   * React strips JSX comments from its output — the first attempt survived only in a
   * sourcemap, which is not somewhere anyone audits. A contract the build erases is a contract
   * nobody can check, so it ships as a meta tag and `grep 142f0967 .next` finds it.
   */
  other: {
    "design-contract":
      "THESIS: a contact book is maintenance, not storage; this page is a stack of the product's own passes, and it refuses the flat hairline document the category ships. " +
      "OWN-WORLD: the product's own card grounds, not a second palette — paper #f5f5f5 ruled with 1px Onyx at 7% on a rhythm derived from the display line box, an Oxblood #5b1626 margin rule, ink Onyx #181a1f, Space Grotesk over Geist at negative display tracking, four card-ground washes (Clay #e3a28a, Pistachio #bfd48c, Periwinkle #b4c1ec, Amber #e1aa40), Amber #e1aa40 legal only on a dark ground and now used once (the close), Onyx as the primary action on light, radii 8/14/18, passes riding 44px over each other's lip on a two-layer Sapphire-tinted shadow. " +
      "STORY: their details rot in other people's phones; no app can fix that silently; this one sends an update they accept; so make the card. " +
      "FIRST VIEWPORT: a full-bleed sheet of ruled contact-book paper, no object on it — an 88px display headline in Onyx ranged left against an Oxblood margin rule, set as its two clauses on two ruled rows, clearing 13.95:1 where it crosses a rule; an Onyx primary and a hairline-ringed secondary; the margin rule drawing down on load as the page's one authored moment. " +
      "FORM: The Wallet Deck, candidate 6 of 7, seed 142f0967 (surface scope, persuade). " +
      "FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.",
  },
};

export default function MarketingPage() {
  return (
    <>
      <Hero />
      <Problem />
      <StepList />
      <Broadcast />
      <Trust />
      <FaqAccordion />
      <FinalCta />
    </>
  );
}
