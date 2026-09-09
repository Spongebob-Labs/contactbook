import type { Metadata } from "next";

import { Belief } from "@/components/marketing/belief";
import { Close } from "@/components/marketing/close";
import { Corporate } from "@/components/marketing/corporate";
import { ExampleCards } from "@/components/marketing/example-cards";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Problem } from "@/components/marketing/problem";
import { Solution } from "@/components/marketing/solution";
import { pageMeta } from "@/fixtures/marketing";

import "@/styles/marketing-motion.css";

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
 *     hero      what is this?              ← type left, the animated card right
 *     problem   why do I care?             ← the deck's before/after, rebuilt
 *     solution  what is the fix?           ← an exhibit a reader can press
 *     cards     what will mine look like?  ← six of the product's own grounds
 *     how       what do I actually do?     ← five steps, and the page's quiet stretch
 *     corporate is this for my company?    ← four sentences on the deep green, then out
 *     belief    why should I trust you?    ← type, no object
 *     start     right, what now?           ← the only dark surface, wearing the brand green
 *
 * Ten components were deleted, not refactored: `broadcast`, `trust`, `faq-accordion`,
 * `handover-flow`, `bento`, `demo-cells`, `card-studio`, `problem`, `step-list`, `final-cta`.
 * Where each argument went is recorded in `fixtures/marketing.ts`'s header and in the new
 * section that absorbed it.
 *
 * ## The grounds alternate, and that is the only separator
 * White, wash, white, wash, white, deep, wash, deep — strict, all the way down. Flat and
 * full-bleed — no inset, no radius, no
 * shadow, no overlap, because the brief asks for a page that "just scrolls down" and eight
 * overlapping passes make every boundary a visual event. `marketing.spec.ts` asserts that no
 * two ADJACENT sections share a ground: on a flat page an alternation bug does not look like a
 * bug, it looks like one very long section.
 *
 * The last two are the one place the alternation does more than separate: the near-white green
 * wash under `belief` ramps into the deep green of `start`, so the closing statement and the
 * call to action read as one ending rather than two sections.
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
      "THESIS: contact details expire, and a card that reads live data is the only kind that does not; this page is the client's own eight-section argument, in the brand's own white and green, with one object per section and no furniture between them. " +
      "OWN-WORLD: white #ffffff and a brand-green wash #f2faf8 alternating, ink Onyx #181a1f, the brand green as a five-level ladder derived against the WASH rather than white (#5ABCA9 decorative, #419F8D display 3.01:1, #337F70 ink 4.51:1, #286257 as the one dark ground), the product's own nine card grounds worn by the example tiles and nothing else, Space Grotesk over Geist at negative display tracking, radii 8/14/18, flat full-bleed sections whose only separator is a change of ground. " +
      "STORY: their details rot in other people's phones; no app can fix that silently; a card that resolves live can; so make the card. " +
      "FIRST VIEWPORT: white, an 88px display headline ranged left with its second clause in the brand green, and a contact card beside it that goes out of date and repairs itself in four beats — one fixed size for the whole lap, transform and opacity only, complete on the server before any script runs. " +
      "FINISH: unreviewed and undocumented is unfinished; DESIGN.md carries what this build superseded and why.",
  },
};

export default function MarketingPage() {
  return (
    <>
      <Hero />
      <Problem />
      <Solution />
      <ExampleCards />
      <HowItWorks />
      <Corporate />
      <Belief />
      <Close />
    </>
  );
}
