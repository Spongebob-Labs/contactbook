import type { Metadata } from "next";

import { Close } from "@/components/marketing/close";
import { Hero } from "@/components/marketing/hero";
import { IntroCurtain } from "@/components/marketing/intro-curtain";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Problem } from "@/components/marketing/problem";
import { Solution } from "@/components/marketing/solution";
import { pageMeta } from "@/fixtures/marketing";

import "@/styles/marketing-motion.css";
import "@/styles/marketing-intro.css";

/**
 * `/` — the one-scroll homepage.
 *
 * Rebuilt 2026-09-08 against the client's written website brief and the voice note with it.
 * The plan, the section order, and the four places the brief, the 2018 investor deck and the
 * previous build disagreed with each other are in `plan.md` at the repo root. Read that first.
 *
 * ## ⚠ WHAT WAS HERE BEFORE, AND WHY NONE OF IT SURVIVED AS A SECTION
 *
 * Seven sections: `hero`, `problem`, `step-list`, `broadcast`, `trust`, `faq`, `final-cta`, on
 * a page built as a wallet — the hero a sheet of ruled contact-book paper, every section after
 * it an inset pass with its own coloured ground and its own shadow, riding 44px over the lip of
 * the one above.
 *
 * The client's note was that the structure was never designed: *"we just randomly added text
 * and designed it anyway, right? That's not how things work."* He was right, and the specific
 * fault was not the writing — most of it was good — it was that **no argument ran through the
 * page**. A visitor was told what the product was careful about (`broadcast`, `trust`) before
 * being told what it was (`trust` was, unnamed, the brief's Solution section, sitting three
 * screens too low).
 *
 * So each section now answers the question the previous one raises:
 *
 *     hero      what is this?              ← the card in a phone, type beside it
 *     problem   why do I care?             ← the deck's before/after, rebuilt
 *     solution  what is the fix?           ← the pinned sequence; the page's one big moment
 *     how       what do I actually do?     ← five steps on a drawn rail
 *     start     right, what now?           ← the only dark surface, and the inline capture
 *
 * ## ⚠ THREE SECTIONS WERE CUT ON 2026-09-19, AND THAT WAS A CLIENT-SIDE DECISION
 *
 * `cards` (six example grounds), `corporate` (a teaser for `/corporate`) and `belief` (a
 * type-only manifesto) were removed. This DIVERGES from the written brief's eight-section
 * structure — the brief is still the record of what was agreed, and this is a later,
 * deliberate departure from it, not a drift.
 *
 * Two consequences that are easy to miss:
 *
 * 1. **Nothing on this page shows that a card comes in more than one design any more.** That
 *    was `cards`' only job and it is a real differentiator — every competitor ships one look.
 *    The cheapest recovery is inside `how-it-works` step 02, whose copy already says "give it
 *    a colour": its still can swap ground rather than sit static. That is a section's worth of
 *    argument recovered for the price of one extra state.
 * 2. **`/corporate` still exists as a route and still uses the `corporate` fixture.** Only the
 *    homepage teaser went. Do not delete that fixture — `(marketing)/corporate/page.tsx` reads
 *    it, and it is the one page with real depth behind it. The nav link is now the only way in.
 *
 * Ten components were deleted, not refactored: `broadcast`, `trust`, `faq-accordion`,
 * `handover-flow`, `bento`, `demo-cells`, `card-studio`, `problem`, `step-list`, `final-cta`.
 * Where each argument went is recorded in `fixtures/marketing.ts`'s header and in the new
 * section that absorbed it.
 *
 * ## The grounds alternate, and that is the only separator
 * White, wash, white, wash, deep — strict, all the way down. Flat and full-bleed — no inset, no
 * radius, no shadow, no overlap, because the brief asks for a page that "just scrolls down" and
 * overlapping passes make every boundary a visual event. `marketing.spec.ts` asserts that no
 * two ADJACENT sections share a ground: on a flat page an alternation bug does not look like a
 * bug, it looks like one very long section.
 *
 * ⚠ **Alternation is NOT what makes this page readable, and it is worth knowing why.** The
 * strict white/wash rhythm shipped in September and the page still read as flat and
 * undifferentiated — because five of its eight sections rendered no visual object at all, and
 * a rhythm of empty things is still empty. The fix is the object in each section, not the
 * ground under it. Keep the alternation; do not expect it to carry anything.
 *
 * The last pair is the one place it does more than separate: the wash under `how` ramps into
 * the deep ground of `start`, so the final step and the call to action read as one ending
 * rather than two sections.
 *
 * ## Every page in the brief now exists
 * `/corporate`, `/waitlist` and `/contact` are built, so the hero, the close and the nav carry
 * the brief's own controls. Where a form submission goes is `LEAD_WEBHOOK_URL` — configuration
 * rather than code, documented in `src/lib/leads.ts`. With none set, both forms say so and
 * offer an email address instead of a tick they have not earned.
 */

export const metadata: Metadata = {
  title: { absolute: "Contact Book — never lose contact" },
  description: pageMeta.description,
  /**
   * The direction contract, emitted into the built HTML.
   *
   * It also exists as a comment in `(marketing)/layout.tsx`, but React strips JSX comments from
   * its output — the first attempt survived only in a sourcemap, which is not somewhere anyone
   * audits. A contract the build erases is a contract nobody can check, so it ships as a meta
   * tag and `grep design-contract .next` finds it.
   */
  other: {
    "design-contract":
      "THESIS: contact details expire, and a card that reads live data is the only kind that does not; this page is a five-section argument in which every section carries one object, because the version before it alternated grounds correctly and still read flat — a rhythm of empty things is still empty. " +
      "OWN-WORLD: ONE layout wearing TWO skins, switched by a single attribute and never by a second component. Both are the same system measured — a ~2.2:1 brand tint on a near-white ground plus one dark closing surface — so the contract is five roles and the skin supplies the hue: tint (decorative only, never text), display (>=3:1, headline clauses at display size), ink (>=4.5:1, small text and control edges), deep (the one dark ground), and a soft ink on that ground. `verdant` is the client's deck at hue 168 (#69C0B0 / #15A185 / #0C7560, deep #0A5A4A); `atelier` is the reference hero sampled pixel-exact (#C1A88A / #A48157 / #816544, deep #0D1C25, ground #FCFAF8). Every rung is derived against the WASH, not the paper, because a colour that clears its threshold on one ground fails on the other. Instrument Serif at weight 400 over Geist — one weight, never a synthetic bold on a high-contrast serif. Radii 8/14/18. Flat full-bleed sections whose only separator is a change of ground. " +
      "STORY: their details rot in other people's phones; no app can fix that silently; a card that resolves live can; so make the card. " +
      "FIRST VIEWPORT: the card held in a phone on the left (frame >=1024px only — the card is rigid at 336px against a 140px QR floor, and a frame that scaled it would break a decode this build keeps passing), a small-caps eyebrow and a serif display headline on the right with its second clause in the skin's display ink, then four proof claims on a single row. Load is one orchestrated sequence — eyebrow, headline masked line by line, phone rising 12px, proof row staggered — transform and opacity only, complete on the server before any script runs. " +
      "MOTION: ONE load sequence, in the hero, and nothing else that touches the scrollbar. `solution` used to pin for 240dvh and advance three beats on scroll progress; the client rejected it outright — \"how the scroll is whole glitching\" — and it is deleted, not tuned. Its argument is made at rest instead: two panes, the owner's whole profile against the one card's subset, with the asymmetry visible before anything is pressed and a segmented control to change which card. Nothing on this page is scroll-driven, sticky, or time-driven. Reduced motion is the final state instantly, never an absence. " +
      "FINISH: unreviewed and undocumented is unfinished; DESIGN.md carries what this build superseded and why.",
  },
};

export default function MarketingPage() {
  return (
    <>
      {/* ⚠ FIRST IN SOURCE ORDER, AND IT CHANGES NOTHING UNDERNEATH IT. The curtain is a
          `position: fixed` sibling, not a wrapper: `<Hero />` and every section below it render,
          stream and get crawled exactly as they did before it existed. It is mounted on THIS
          route only — the front door — rather than in the marketing layout, so `/templates`,
          `/corporate`, `/waitlist` and `/contact` never carry one. See its own header for the
          session gate, the reduced-motion contract, and the case for why a splash is defensible
          here at all. */}
      <IntroCurtain />
      <Hero />
      <Problem />
      <Solution />
      <HowItWorks />
      <Close />
    </>
  );
}
