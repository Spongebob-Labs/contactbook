import {
  ArrowRight,
  Link2,
  RefreshCw,
  SlidersHorizontal,
  Undo2,
  type LucideIcon,
} from "lucide-react";

import { hero } from "@/fixtures/marketing";

import { HeroCard } from "./hero-card";
import { mkcn } from "./mk-cn";
import { Arrival } from "./mk-motion";
import { CONTENT_COLUMN, Section } from "./section";
import { accented, Display, Eyebrow, MkButtonLink, Prose } from "./type";

/**
 * The first viewport.
 *
 * ## 2026-09-29 — the phone is the client's reference, measured
 *
 * The client rejected the phone card against their reference render — its font, content,
 * icons, colours, spacing, photo, logo and device — and asked for the reference itself. The
 * card is now a still drawing of that reference (`hero-card.tsx`), in a rebuilt device
 * (`phone-frame.tsx`), and it no longer cycles or highlights anything. Two consequences here:
 *
 *   1. **No `preload()`.** It existed because `<CardCover>` drew the cover `<img>` and could not
 *      carry `fetchPriority`. The card now draws its own `<img fetchPriority="high">`, which is
 *      the direct form of the same hint.
 *   2. **The phone is larger** (the client: "could be a little increased so that each and every
 *      field is properly visible"). The device is 363×827 unzoomed; `--mk-phone-zoom` below.
 *
 * ## 2026-09-28 — the client's feedback pass, and what it changed here
 *
 *   1. **The controls.** "Join the waitlist" and "For companies" are gone from the homepage
 *      (*"still showing old version … need removing"*). The primary is "Create your card" to
 *      phone sign-in and the secondary is "See how it works", an in-page link. Both labels and
 *      targets live in `hero.primary` / `hero.secondary`.
 *   2. **The phone is smaller** (*"shrink the center phone graphic or remove it"*), and the whole
 *      hero, card included, now fits a 13" laptop window: 1280×720 and 1440×700 as well as 900.
 *      Two mechanisms, both in this file's classes: `--mk-phone-zoom` steps down at `lg`, and a
 *      short-window band (`[@media(max-height:820px)]`, `lg` only) trims the headline size and
 *      the vertical gaps. Still `zoom`, never `scale(` — see `phone-frame.tsx`.
 *   3. **The card is Maya Lauren's and it moves.** `<HeroCard>` now owns the phone and the pause
 *      control beside it; see that file and `live-card.tsx`. The card column is `relative` so
 *      the control can sit beside the phone without taking any space.
 *
 * The notes below are the history of this section, kept because each one records a rejected
 * version. Where one names the old controls or the old zoom factor, point 1 or 2 above wins.
 *
 * ## ⚠ THE RULED SHEET IS GONE, AND SO IS "THE HERO IS TYPE-ONLY"
 *
 * This hero was, in order: a coloured gradient with centred type, a gradient with a big tilted
 * card, a gradient with a silent film, a sheet of ruled contact-book paper with a fan of three
 * real cards, and then that same sheet with nothing on it at all. Four objects were rejected
 * and the rule written afterwards was "the hero is type-only; do not put an object on that
 * sheet."
 *
 * It now carries an animated card, on the client's own brief — *"the opening page I'm
 * picturing is very clean and clear, with a little bit of text (large text) explaining what
 * this is, and then a visual of contact cards being updated"* — and with sign-off. The reason
 * this is a different proposition rather than a fifth attempt at the same mistake: the four
 * rejected objects were **pictures of a card**, placed in the empty half of the screen to fill
 * it. `<LiveCard>` is the product's single claim, performed. A stranger who reads nothing has
 * still watched a contact card go out of date and repair itself, which is the sentence beside
 * it.
 *
 * The ruling went with it. Two reasons, and the second is the real one: the brief asks for
 * white space, calm and minimal in three separate places — and a texture underneath a moving
 * object is two things competing for the same attention. `--mk-ledger-*` is retained in
 * `marketing.css` and nothing renders it; `--mk-ledger-lead` is still this file's top padding,
 * which is why the token could not simply be deleted.
 *
 * ## 2026-09-19 — the reference redesign
 * The client supplied a reference layout and three things about the composition change with
 * it, all scoped to this file and its two new siblings (`phone-frame.tsx`, `marketing-hero.css`):
 *
 *   1. **The columns mirror.** Card left, type right, at `lg` — the opposite of the order this
 *      section shipped with. The DOM keeps type first (so a screen reader, and a phone that
 *      never reaches `lg`, meets the sentence before the picture); `lg:order-first` on the
 *      card's column is what flips the visual order without a second markup.
 *   2. **A phone bezel appears around the card, at `lg` only.** See `phone-frame.tsx`'s header
 *      for why it is a padding-only wrapper and never a scale.
 *   3. **A 4-up proof row** sits under the controls — the four claims the rest of the page each
 *      spends a section proving, stated once so a reader can decide to keep scrolling before
 *      reading any of it. See `hero.proof` in the fixture for the copy and the reasoning.
 *
 * ## The composition
 * Type ranged against its column, card beside it, and the headline is DELIBERATELY narrow — the
 * two clauses stack, which is what gives the eye an axis to return to. Below `lg` the card drops
 * under the copy rather than shrinking beside it: a 360px card next to a headline in a 400px
 * column is two things fighting, and the card is the one that loses legibility.
 *
 * ## Motion here is all LOAD, never scroll
 * Nobody scrolls to the first thing they see, and DESIGN.md forbids arming above-the-fold
 * content — a reader would watch the hero jump on every load, and a stuck observer would
 * present as "the top of the page is broken". So: the eyebrow fades up, `line` wipes the two
 * headline clauses on, `copy` raises everything under them (the proof row included), the frame
 * rises into place at `lg`, and the card itself is simply present from the first frame and
 * starts its own loop after mount. Nothing in this section waits for an IntersectionObserver.
 *
 * ⚠ THE SHARED 1100ms HEADLINE WIPE MEANS "THE WHOLE THING SETTLES BY ~900ms" IS OPTIMISTIC.
 * The reference asks for the full cascade to read as roughly a beat, then still. Every element
 * below STARTS within the first ~900ms of load (see the `--mk-arrive-offset` on each block), but
 * `[data-mk-arrive="line"]`'s own 1100ms duration — declared once in `marketing.css`, and not
 * this file's to retune — means the headline's second clause is still finishing shortly after
 * that. Retuning the shared duration is a `marketing.css` change and out of scope here; what
 * this file controls is the ORDER things begin in, which is what actually reads as a sequence
 * rather than a slideshow.
 *
 * ## 2026-09-20 — matching the re-sent reference, line by line
 * The client re-sent the same layout and asked for a closer type match. Three real changes,
 * scoped to this file (`phone-frame.tsx`/`hero-card.tsx` are a parallel pass, not this one):
 *
 *   1. **The subhead and the lead now read as one paragraph.** They were two registers —
 *      `hero.subhead` at the lead size in `tone="ink"` (a tagline), `hero.lead` at body size in
 *      `tone="stone"` (support copy). The reference shows one block of sans body copy, so both
 *      are now `size="lead" tone="stone"`, tightened to `mt-2` from `mt-4` so the two sentences
 *      read as one paragraph rather than a headline under the headline. `hero.subhead`'s own
 *      identity — the line under the wordmark on the deck's cover — is unchanged; only its
 *      colour and its distance from the next line moved.
 *   2. **The primary control gained the reference's trailing arrow** (`lucide-react`'s
 *      `ArrowRight`, `aria-hidden`) and its exact fill. `variant="dark"` is `--mk-ink`, the
 *      site's general-purpose near-black; the reference's own CTA was sampled into a second,
 *      purpose-built token for exactly this control — `--mk-accent-deep` (compat name
 *      `--mk-green-deep`), `docs/landing-integration.md`'s "the primary action fill, and the
 *      one dark ground". The override is a `className` on this one call site — `type.tsx` is
 *      untouched, and every other `variant="dark"` control on the site keeps `--mk-ink`.
 *   3. **The proof row turned 90 degrees and its title changed families.** Icon-left/text-right
 *      became icon-top/text-centred, and the title is now the display serif. `<Prose>`
 *      hardcodes `font-mk-sans` (`type.tsx`), and `type.tsx` has no small-serif primitive, so
 *      the title is composed directly from the same `--mk-*` steps that primitive builds from
 *      rather than through it. The serif title over a sans caption is most of why the row now
 *      reads as editorial rather than as a four-icon feature grid.
 *
 * What did NOT change: the headline keeps its brand accent clause (`accented()`, below). The
 * reference's own headline is plain, but the accent is a considered, documented, site-wide move
 * — every headline on the client's deck sets one word in it — and undoing that was outside this
 * pass's brief. The secondary control also stays `variant="line"` rather than chasing the
 * reference's circled play glyph; see `hero.secondary`'s own comment below for why.
 *
 * A fourth change landed from the other side of the seam: Agent F's parallel pass rebuilt
 * `<HeroCard>` around the product's real card page and removed the flip, and with it the props
 * this file used to pass (`face`, `frontLabel`, `backLabel`, `caption`) — see that file's own
 * header for the full account and `<HeroCard />`'s call site below for the edit it left for this
 * file to make. `hero.cardHint`, `cardFrontLabel` and `cardBackLabel` are unused as a result;
 * see the comment where the hint used to render for why they stay in the fixture regardless.
 *
 * ## 2026-09-20, later the same day — the client's device pass
 * The client rejected the reference match outright: *"not even 1% looking professional...
 * How is the phone so big... The iPhone kind of lining is not there."* Measured, not argued:
 *
 *   1. **The headline's leading was 1.02** — 44px type on a 44.88px line box, so "Never lose"
 *      and "contact." nearly touched. `--mk-text-display-lh` (`marketing.css`) is shared with
 *      `/corporate`, `/waitlist` and `/contact`'s own `<Display>` calls, so it is not this
 *      file's to retune for everyone. The headline below now carries its own `lineHeight`
 *      instead, inline — the same mechanism `hero-card.tsx` already uses for a hard pixel value
 *      one instance needs and a shared token cannot express without moving three other pages.
 *      See `HEADLINE_LINE_HEIGHT` below for the exact value and why it is safe against
 *      `[data-mk-arrive="line"]`'s own clip-path.
 *   2. **The phone ran past the fold.** At 1440×900 this section's `pt-[var(--mk-ledger-lead)]`
 *      (still 80px at `md` and up — a value written for a ruled sheet that no longer renders
 *      here) put the frame's bottom edge at 934px, 34px below the viewport. `--mk-ledger-lead`
 *      was doing nothing for this file beyond that inherited number, so the section now sets
 *      its own top padding instead of borrowing a token named for a ruling that is gone (see
 *      the grid wrapper below). Paired with `phone-frame.tsx`'s own shorter bezel, the frame's
 *      bottom now measures comfortably inside 900px at 1440 — see this round's report for the
 *      before/after.
 *   3. **The phone read as a dark slab, not a device.** That fix belongs to `phone-frame.tsx`
 *      and `marketing-hero.css` — a status bar, a dynamic island, side buttons and an even
 *      bezel. This file's only stake in it is point 2 above: a shorter frame needed less top
 *      clearance to begin with.
 *
 * `-mx-3` on the card's column (below) is untouched by this pass: `hero-card.tsx`'s
 * `SCREEN_WIDTH` is still a fixed 336px in a file this round does not own, and it is most of
 * why the phone still reads as wide at 375px even with a properly proportioned case around it
 * — flagged in the report rather than guessed around, same as `marketing-hero.css` already
 * flags its own half of this arithmetic.
 *
 * ## 2026-09-21 — the cover photo, the margin, and the proof row's ragged captions
 * A fourth client rejection, three things fixed, all still scoped to this file plus the one
 * line of `fixtures/marketing.ts` this round owns (`HERO_COVER_URL`):
 *
 *   1. **The cover photo is on.** `HERO_COVER_URL` now points at the real
 *      `public/marketing/hero-cover.jpg` the client supplied, replacing the authored-SVG
 *      understudy that constant's own comment benched. `<CardCover>` (`@/card/card-page`, read
 *      through and not edited) reads it as a plain `<img>` with no `loading`/`fetchPriority` of
 *      its own — that file exists to be exported to PNG and deliberately avoids `next/image`'s
 *      markup for that reason (its own header). This file cannot add an attribute to a tag it
 *      does not render, so the LCP hint moves to the one mechanism that reaches an image from
 *      OUTSIDE the component that draws it: `react-dom`'s `preload()`, called during this
 *      server component's render, emits `<link rel="preload" as="image" fetchpriority="high">`
 *      into `<head>` regardless of where in the tree the `<img>` itself ends up. Layout shift is
 *      not this call's job either way — `CardCover`'s own wrapper already reserves the photo's
 *      box with `aspect-ratio` before the image decodes, which is a `src/card/**` fact this file
 *      only relies on, not one it sets.
 *   2. **The phone gained real, SYMMETRIC margin, and the fix is arithmetic, not taste.** The
 *      paragraph above already named the defect (348px in 375px, "flagged... rather than
 *      guessed around"); measuring it in a real browser turned up something worse than tight —
 *      at exactly 360px (the `vp-360` project's own width) the frame's RIGHT edge sat flush with
 *      the viewport, zero margin on that one side, because `-mx-3` (12px a side) claws back
 *      less than the 348px frame needs from the 24px-padded column beneath it: the box this
 *      column actually offers the frame was 336px wide there, 12px short, so `margin-inline:
 *      auto` had nothing left to distribute and gave the whole deficit to one edge. `-mx-6`
 *      cancels the column's `px-6` outright instead of half-cancelling it, so at `w` the frame
 *      now centres inside the FULL viewport width rather than inside a box already 24px
 *      narrower than it — `margin-inline: auto` (already `phone-frame.tsx`'s own rule, untouched)
 *      does the rest. This does not, and cannot, make the phone smaller: `SCREEN_WIDTH` (336,
 *      `hero-card.tsx`) plus this frame's own 6px bezel (`marketing-hero.css`, untouched — a real
 *      device edge is not the thing to thin further) is a 348px floor this file does not own
 *      either side of. What changes is where the remaining slack goes: at 360px that slack is
 *      12px total, now split 6/6 instead of 12/0; at 375px it was already centred (13.5px a
 *      side) and stays there; every wider viewport only gains. See this round's report for the
 *      full table — the residual tightness at 360px is real and is arithmetic, not an oversight.
 *   3. **The proof row's captions no longer set their own baseline.** Measured across ten
 *      widths from 320px to 1920px, the four captions wrap to either 2 or 3 lines depending on
 *      viewport AND on which claim is longest at that width — "Edit once. Everyone holding your
 *      card sees it." is the long one and tips to 3 lines earlier than its three siblings, so
 *      the row's four items do not share a bottom edge at most widths tested (the client's own
 *      "not properly aligned"). The grid cell is the actual width constraint here, not the
 *      caption's own `max-w-mk-measure-xs` — a flex item under `align-items: center` (the
 *      column wrapper each item already uses) is clamped to its container's cross size
 *      regardless of a larger `max-width`, confirmed by forcing one to 600px in a live page and
 *      watching the rendered width not move. Widening the grid cell enough to force every
 *      caption to 2 lines needs the LONGEST claim to gain ~25px it does not have without either
 *      eating into the phone's new margin or shrinking `lg:gap-8`'s own rhythm; forcing every
 *      caption to 3 lines instead needs 118px cells this row has never had. Both are cross-
 *      breakpoint tuning exercises that would need re-deriving at every width. Reserving three
 *      lines' worth of height on every caption — the measured maximum, at every width tried —
 *      sidesteps the tuning question entirely: whatever a caption's own line count is, the row's
 *      four items still end at the same y, which is the actual property "shared baseline grid"
 *      asks for.
 */

/**
 * ⚠ THE LINE BREAK IS A TYPOGRAPHIC DECISION AND STAYS HARDCODED HERE, BUT THE WORDS THEMSELVES
 * NOW COME FROM THE FIXTURE.
 *
 * This used to be a second, hand-typed copy of the headline (`HEADLINE_LINES`), kept in sync
 * with `hero.headline` by hand — which is exactly the kind of duplication that drifts. Splitting
 * `hero.headline` on `HEADLINE_ACCENT` gets the same two-clause layout the wipe needs (see
 * `type.tsx`'s `Arrival variant="line"`) from the one string the fixture owns, while the CHOICE
 * of where to break — after "lose", not after "Never" — still lives here, because that choice is
 * about this line's shape on the page, not about the copy.
 *
 * `accented()` (`type.tsx`) is reused for the colour rather than a hand-rolled `<span>`: it is
 * the one place `--mk-green-display` (the compatibility name for `--mk-accent-display`, see
 * `marketing-skins.css`) is spelled, so a future rename of that ladder only has one call site to
 * find. Passed `(HEADLINE_ACCENT, HEADLINE_ACCENT)` — the clause as both its own "heading" and
 * its own "accent" — it wraps the whole clause, which is what a single-clause line needs.
 */
const HEADLINE_ACCENT = "contact.";
const HEADLINE_ACCENT_AT = hero.headline.lastIndexOf(HEADLINE_ACCENT);
const HEADLINE_LEAD =
  HEADLINE_ACCENT_AT >= 0 ? hero.headline.slice(0, HEADLINE_ACCENT_AT).trim() : hero.headline;

/**
 * ⚠ AN INLINE STYLE, NOT A UTILITY CLASS — AND THAT IS THE POINT, NOT A SHORTCUT.
 *
 * `text-mk-display` (`type.tsx`'s `<Display>`) bundles font-size, line-height AND
 * letter-spacing into one Tailwind v4 utility, generated from `marketing.css`'s
 * `--mk-text-display-lh: 1.02`. That token is shared with `/corporate`, `/waitlist` and
 * `/contact`'s own `<Display>` calls (`grep`'d, not assumed), so retuning it in `marketing.css`
 * would change three pages nobody asked to touch — and this pass is the hero's alone.
 *
 * An inline `style` wins over any class-based rule regardless of Tailwind's own layer order,
 * which a second, more-specific utility class (`leading-[…]`) is not guaranteed to: Tailwind
 * v4 emits `text-mk-display`'s bundled line-height and a plain `leading-*` utility as two
 * separate classes of equal specificity, and which one wins would depend on generation order
 * rather than anything declared here. `hero-card.tsx` already reaches for a plain `style` prop
 * for the same reason — one instance needing a hard value a shared token cannot express without
 * moving everyone who reads it.
 *
 * 1.08 sits inside the 1.06–1.12 an 88px-to-44px serif needs so a descender ("contact."'s `t`
 * is fine; it is the ascender/descender PAIR across both clauses that was crowding) clears the
 * line above it, per the client's own measurement. It does not endanger
 * `[data-mk-arrive="line"]`'s `-35%` clip-path inset (`marketing.css`) — that inset was already
 * sized for MORE overflow than 1.02 produces (Space Grotesk's ascender+descender is ~1.23em; a
 * 1.02em box overflows by ~10% of its own height, the -35% clip clears more than triple that),
 * so a taller line box only widens the margin the clip already had. Scoped to this one heading
 * via `style`, not a second class, because a class living beside `text-mk-display` in this
 * file's own `className` string would still need one of the two cascade mechanisms above to
 * actually win.
 */
const HEADLINE_LINE_HEIGHT = 1.08;

/**
 * `hero.proof[].icon` is a string, not a component — `fixtures/marketing.ts`'s own comment
 * explains why (the fixture stays copy-only so `fixture-hygiene.test.ts` can sweep it without
 * pulling in React). This is the one place that string is resolved back to a real icon, so a
 * name that stops matching a `lucide-react` export degrades to "no icon" instead of a crash.
 */
const PROOF_ICONS: Record<string, LucideIcon | undefined> = {
  RefreshCw,
  SlidersHorizontal,
  Link2,
  Undo2,
};

export function Hero() {

  return (
    <Section id="hero" bare tone="white" labelledBy="hero-headline" className="bg-mk-white">
      <div
        className={mkcn(
          CONTENT_COLUMN,
          // ⚠ NO LONGER `pt-[var(--mk-ledger-lead)]` — 2026-09-20, THE DEVICE PASS.
          // That token is `.mk-ledger`'s own rhythm (`marketing.css`), a ruling this section
          // stopped drawing before the reference redesign; borrowing it here only meant "80px
          // at `md` and up" with no ruling left to stay in register with. At 1440×900 that
          // 80px, stacked under `<main>`'s own 80px clearance, was most of why the phone's
          // bottom edge landed 34px below the fold (this file's own header has the full
          // account). 40/64px is this section's own rhythm now — still generous under the
          // fixed nav, and small enough that the shorter frame `phone-frame.tsx` now draws
          // clears 900px with room rather than by a couple of pixels.
          //
          // ⚠ `lg:pt-5` IS GONE, 2026-09-21 (LATER) — A FIXED TOP OFFSET WAS ALWAYS THE WRONG
          // INSTRUMENT FOR "CENTRE THIS IN THE SCREEN".
          //
          // It shipped that morning to stop the phone overflowing a short laptop window, and it
          // worked — by pinning the row 20px under the nav, which is what the client then
          // rejected: *"the margin from the top needs to be increased a little bit so that this
          // whole view we are viewing should be in the center of the screen."* Measured on
          // their own window (1512×907, taken from the screenshot's 5:3 ratio): the row ran
          // 110→786 inside the 827px below the nav — 30px of air above it and 121px below. Not
          // a missing 90px of padding; a composition anchored to the top of a box it does not
          // fill.
          //
          // A bigger `pt-*` cannot fix that, because the right number is a function of the
          // window's height and of how tall the copy column happens to render. So the two
          // things that ARE constant get declared instead — the box is the screen below the
          // fixed nav (`100svh` less `<main>`'s own `pt-20`, and `svh` rather than `vh` so a
          // mobile browser's collapsing toolbar cannot make this taller than the glass), and
          // the content sits in the middle of it (`lg:content-center`, i.e. `align-content`,
          // which is the grid-track axis — `items-start` below still governs how the two
          // columns sit inside their shared row). At 907 that lands 89px above and 98px below;
          // at a 780px window the content is taller than the box, `min-height` stops applying
          // and the page simply scrolls, with `lg:pt-10` still doubling the clearance the old
          // `lg:pt-5` gave. There is no third case: `align-content` cannot overflow upward out
          // of a box it is not centring in.
          //
          // Mobile and the 768–1023px band are UNCHANGED (`pt-10`/`md:pt-16`). Neither stacks
          // the phone beside the copy, both are far taller than one screen, and a `min-height`
          // that can never bind is a lie in the markup.
          "relative pt-10 pb-20 md:pt-16 md:pb-28 lg:min-h-[calc(100svh-5rem)] lg:pt-10 lg:pb-12 lg:content-center",
          // NOTE — 2026-09-28: a 13" laptop window (1280×720, 1440×700) is under 820px tall, and
          // there the section's own padding is the first thing to give. See the module note.
          "lg:[@media(max-height:820px)]:pt-6 lg:[@media(max-height:820px)]:pb-6",
          /* ⚠ WAS `items-center` UNTIL 2026-09-21 — SEE THE MODULE HEADER FOR THE OLD ARGUMENT
             AND WHY IT NO LONGER APPLIES. That comment protected against a card whose height was
             still unbounded (the 1019–2007px era the header's own numbers describe); the frame
             has drawn a FIXED 740px window since the device pass, so "how far the card hangs
             into the section below" is now a known, bounded number rather than a risk to guard
             against blind. Measured at 1440px with the old `items-center`: the frame's top sat
             ~49px ABOVE the eyebrow's own top, floating rather than anchored to anything a
             reader's eye had already found — the type block starts the page and the phone
             should start reading FROM there, not float independently of it.

             `items-start` costs nothing to reach for: the frame is the taller of the two
             columns, so it was ALREADY the one sizing this grid row under `items-center` too —
             an item exactly as tall as its own row fills that row under any `align-items` value,
             centred or not. What actually moves is the type column, from centred inside that
             740px row (51px of empty space above the eyebrow, 51px below the proof row) to
             flush with its top edge — the frame's own top and bottom are unchanged (measured:
             146px→147px and 886px→887px at 1440, both within rounding), so the section's total
             height does not grow by switching this keyword. */
          "grid grid-cols-1 items-start lg:grid-cols-12 lg:gap-10",
        )}
      >
        {/* NOTE — `max-lg:contents` — BELOW `lg` THIS COLUMN DISSOLVES INTO THE GRID, 2026-09-24.
            Stacked, the phone came after all four proof tiles, so a phone visitor read two
            screens of type before seeing the product at all. Dissolving the column makes its
            children grid items, which lets `order` put the phone straight after the buttons
            (`max-lg:order-1`) and the tiles after the phone (`max-lg:order-2`). The grid has no
            row gap below `lg` for the same reason — the children keep the margins they already
            had, so the type's own rhythm is unchanged. From `lg` up this is the 7-column type
            column exactly as before. */}
        <div className="max-lg:contents lg:col-span-7">
          {/*
            ⚠ THIS IS A KICKER OVER A HEADLINE, WHICH `type.tsx`'S `Eyebrow` DOCUMENTS AS BANNED
            — READ WITH THAT CONTEXT, NOT AS AN OVERSIGHT.

            `Eyebrow`'s own comment forbids exactly this shape above a SECTION heading, because a
            kicker over a mid-page `<h2>` reads as the page apologising for it before it argues
            anything. The hero is not a section, it is the page's masthead, and "Contact Book"
            set above the one `<h1>` on the page is naming the product rather than introducing a
            claim — the same distinction that comment draws for the footer's nav labels. The
            client's reference draws the eyebrow here explicitly, and the fixture already carries
            `hero.eyebrow` for exactly this use. Treat this as a scoped, deliberate exception; the
            rule stays intact for every section below this one.
          */}
          <Arrival index={0} className="mb-4 md:mb-5">
            <Eyebrow as="p">{hero.eyebrow}</Eyebrow>
          </Arrival>

          {/*
            ⚠ EVERY MEASURE STAYS ON THE TYPE ELEMENT, NEVER ON THE `<Arrival>` AROUND IT.

            The measures are in `ch`, and `ch` resolves against the font-size of the element the
            rule lands on. Moved up one level onto a wrapper, `max-w-mk-measure-display` stops
            being 24 characters of an 88px headline and becomes 24 characters of inherited 16px
            body copy — which renders the headline one word per line, with the correct class in
            the markup and the correct value in the stylesheet. It cost a build once.
          */}
          {/*
            ⚠ THE CLIP LIVES ON EACH CLAUSE, NOT ON A WRAPPER AROUND THE HEADING.

            Two clauses appearing one after the other reads as writing; one clipped `<h1>` reads
            as a curtain. `<Arrival as="span">` exists for this — a `<div>` inside an `<h1>` is
            invalid HTML, and hand-rolling the attribute here would put a motion decision in a
            section file instead of in the vocabulary.

            The `--mk-arrive-offset` set here (inherited by both clauses, since neither
            overrides it) gives the eyebrow above a beat to register before the wipe starts —
            it is inherited rather than re-declared per clause for the same reason the block
            below sets it once.
          */}
          <Display
            id="hero-headline"
            data-hero-headline=""
            /* The short-window step (2026-09-28): 88px → 68px only where the window is under
               820px tall. Still far above the large-text bar the accent clause needs. */
            className="max-w-mk-measure-display lg:[@media(max-height:820px)]:text-[4.25rem]"
            style={{
              ["--mk-arrive-offset" as string]: "150ms",
              lineHeight: HEADLINE_LINE_HEIGHT,
            }}
          >
            <Arrival as="span" variant="line" index={0} className="block">
              {HEADLINE_LEAD}
            </Arrival>
            {HEADLINE_ACCENT_AT >= 0 ? (
              /**
               * ⚠ THE ACCENT IS THE BRAND, AND IT IS LEGAL AT THIS SIZE ONLY.
               *
               * Every headline on the client's deck sets one word in the brand green — "How it
               * *Works*", "This Week's Example: *Charlie Moretti*" — and it is the single thing
               * that makes a white page read as ContactBook instead of as any white page.
               * `accented()` sets `--mk-green-display`, which measures 3.01:1 on white — that
               * clears the large-text bar of 3:1 and NOTHING ELSE: this clause is 88px at the
               * top of the clamp and 44px at the bottom, both comfortably "large". The brand
               * value itself (`--mk-accent-tint`, #5ABCA9 under `verdant`) is ~2.2:1 and may
               * never be a word at any size. Do not copy this pattern down to a paragraph or a
               * label — `--mk-accent-ink` (`--mk-green-ink`) is the level for those.
               */
              <Arrival as="span" variant="line" index={1} className="block">
                {accented(HEADLINE_ACCENT, HEADLINE_ACCENT)}
              </Arrival>
            ) : null}
          </Display>

          {/*
            One offset for the whole block below the headline, inherited. `display: contents` so
            the wrapper generates no box and every margin below still resolves against the copy
            column exactly as it did.

            570ms keeps the gap this block has always kept from the headline (420ms) once the
            150ms eyebrow offset above is added back in: clause two starts at 150+140=290ms and
            its 1100ms wipe is visibly complete well before it ends, so the lead begins while the
            headline is still settling rather than after it has stopped. A sequence that waits
            for each step to finish reads as a slideshow.
          */}
          <div style={{ display: "contents", ["--mk-arrive-offset" as string]: "570ms" }}>
            {/* The brand's own functional explainer, one step down from the headline. It is the
                line that appears under the wordmark on the deck's cover, so it is the one piece
                of copy on this page that is load-bearing as identity rather than as argument —
                that does not change below. What changes is that it is now styled IDENTICALLY to
                `hero.lead` (`size="lead" tone="stone"`, both `max-w-mk-measure`) rather than one
                step darker and one step down in size: the reference draws these two sentences
                as a single sans paragraph, not a tagline over a caption, and `mt-2` (not the
                previous `mt-4`) closes the gap between them to match. */}
            <Arrival index={0} className="mt-6 md:mt-8 lg:[@media(max-height:820px)]:mt-5">
              <Prose size="lead" tone="stone" className="max-w-mk-measure">
                {hero.subhead}
              </Prose>
            </Arrival>

            <Arrival index={1} className="mt-2">
              <Prose size="lead" tone="stone" className="max-w-mk-measure">
                {hero.lead}
              </Prose>
            </Arrival>

            <Arrival
              index={2}
              /* Stacked full-width on a phone: two buttons of different widths, one under the
                 other, read as a layout that ran out of room rather than a pair. */
              className="mt-9 flex flex-wrap items-center gap-3 max-sm:flex-col max-sm:items-stretch md:mt-11 md:gap-4 lg:[@media(max-height:820px)]:mt-7"
            >
              {/* ⚠ THE FILL IS `--mk-accent-deep`, NOT `variant="dark"`'S OWN `--mk-ink`.
                  Both are near-black; `--mk-accent-deep` (`--mk-green-deep`) is the one sampled
                  from the reference's own CTA (`#0D1C25` under atelier — see
                  `docs/landing-integration.md`'s palette table, "the primary action fill, and
                  the one dark ground"), so this one call site overrides the fill via
                  `className` rather than by touching `type.tsx`'s shared `dark` variant, which
                  every other control on the site keeps unchanged. The trailing arrow is the
                  reference's own — `aria-hidden` because the label already says what a press
                  does. */}
              <MkButtonLink
                href={hero.primary.href}
                variant="dark"
                size="lg"
                data-hero-cta=""
                className="gap-2 bg-mk-green-deep hover:bg-mk-green-deep/90"
              >
                {hero.primary.label}
                <ArrowRight aria-hidden="true" size={18} strokeWidth={2} />
              </MkButtonLink>
              {/* ⚠ NOT A PLAY BUTTON. The reference's own secondary control is a circled play
                  glyph plus a label — "Watch Video" — and this page has no video to open
                  (`public/hero/` holds a 5MB loop nothing in `src/` references; a control that
                  opens nothing is worse than none). `hero.secondary` ("See how it works", an
                  in-page link since 2026-09-28) keeps this slot instead, and `variant="line"` is
                  already the reference's REGISTER for it: no fill, a hairline ring, beside the
                  pill rather than a second one of it.
                  `type.tsx`'s own comment on `line` explains it was added for exactly this
                  hero — a light-ground control a sighted reader can still find (WCAG 1.4.11) —
                  so this does not soften further to `ghost`, which has no boundary at rest. */}
              <MkButtonLink href={hero.secondary.href} variant="line" size="lg">
                {hero.secondary.label}
              </MkButtonLink>
            </Arrival>

            {/* Tighter to the controls than the controls are to the copy — it is a footnote ON
                the buttons, not a fourth statement.

                RESOLVED 2026-09-19 — `hero.aside` IS NO LONGER RENDERED HERE.

                It read "Nothing to install for the person you hand it to. It opens in their
                browser," which is near-verbatim what `hero.proof[2]` now says one row below it,
                on the same screen. The duplication is ours, not the client's: the aside is the
                original line and the proof row was added around it, so the row is what gives
                way — except the row also carries an icon, a heading and three siblings making
                the same shape of promise, and cutting it to keep a loose sentence under the
                buttons would be the worse page.

                The client's words are NOT deleted. `hero.aside` stays in the fixture with a
                note recording that this claim now reaches the reader through `proof[2]`, so
                nothing of theirs is lost and the page stops saying it twice. */}
          </div>

          {/*
            ── The 4-up proof row, added 2026-09-19, re-composed 2026-09-20 ─────────────────
            A real `<ul>`: four discrete, parallel claims, and a screen reader announcing "list
            of 4" is the correct description of what this is. `Arrival` only renders `div`/`span`
            (`mk-motion.tsx`), so each item's own animated node is the `<li>`'s child, not the
            `<li>` itself.

            900ms is where the reference's "then the proof row staggers" beat lands: by then the
            frame (below, `lg` only) has been rising for ~480ms of its 720ms settle and the
            controls above have already started, so this reads as the sequence's last beat
            rather than a fifth thing competing for attention on load. Each item's OWN
            `--mk-arrive-step` is overridden to 60ms — inline, because `[data-mk-arrive]`
            (`marketing.css`) sets that custom property on the element itself, which beats
            anything set on an ancestor; the site-wide 70ms cadence lives one level up, on
            `--mk-arrive-offset`, which nothing here redeclares.

            ⚠ EACH ITEM IS A COLUMN, NOT A ROW, AND THE TITLE IS SERIF — both re-sent-reference
            changes, not a restyle for its own sake. It was icon-left/text-right in `--mk-ink`
            sans; the reference stacks icon-over-title-over-caption, everything centred under
            the badge, and sets the title in the display face. `<Prose>` cannot do the last part
            — it hardcodes `font-mk-sans` (`type.tsx`) — so the title below is a plain `<p>`
            carrying the same `--mk-*` steps `type.tsx`'s own primitives are built from, sized at
            `text-mk-subheading` (18px) because `type.tsx` has nothing smaller in the serif and a
            heading step here would out-weigh the badge above it. The caption keeps `<Prose>` and
            moves from `tone="stone"` to `text-mk-pebble`: `marketing-skins.css` names that rung
            "captions, eyebrows" specifically, and `--mk-stone` next to it is "secondary body
            copy" — the reference's own two greys (body vs. caption) are exactly this pair.
          */}
          <ul
            data-hero-proof=""
            className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 max-lg:order-2 lg:mt-14 lg:grid-cols-4 lg:gap-8 lg:[@media(max-height:820px)]:mt-9"
            style={{ ["--mk-arrive-offset" as string]: "900ms" }}
          >
            {hero.proof.map((item, i) => {
              const Icon = PROOF_ICONS[item.icon];
              return (
                <li key={item.title}>
                  <Arrival
                    index={i}
                    className="flex flex-col items-center text-center"
                    style={{ ["--mk-arrive-step" as string]: "60ms" }}
                  >
                    {/* Decorative: the title and body already say what the claim is; reading
                        the icon out too would be the same fact twice. Thin stroke rather than
                        the default 2px — the reference's icons are line-art, not glyphs drawn
                        for a 24px toolbar. */}
                    <span
                      aria-hidden="true"
                      className="flex size-12 shrink-0 items-center justify-center rounded-mk-pill bg-mk-wash text-[var(--mk-accent-ink)]"
                    >
                      {Icon ? <Icon size={20} strokeWidth={1.5} /> : null}
                    </span>
                    {/* ⚠ THE `min-h-[2 lines]` RESERVATION THAT WAS HERE IS GONE, 2026-09-21.

                        It existed to keep four titles' baselines in register at the two widths
                        where the longest one wraps (320px, and the 1024-1100px band just past
                        `lg`). It worked — and it cost a full empty line under EVERY title at
                        every other width, which is most of them. The client marked that dead
                        space directly: "so much of a gap between them that it is looking
                        unprofessional and very vague."

                        Reserving against a rare case at the expense of the common one is the
                        wrong trade. The titles now take their natural height, so the badge,
                        title and caption read as one block; at the two pinch widths a single
                        title wraps and carries its own caption down with it, which is a far
                        smaller defect than a permanent gap. */}
                    <p className="mt-3.5 max-w-mk-measure-xs-head font-mk-display font-mk-editorial text-mk-subheading text-mk-ink">
                      {item.title}
                    </p>
                    {/* The caption's own 3-line reservation is gone for the same reason. It aligned
                        the four captions' BOTTOM edges, which is the edge nobody looks at —
                        nothing sits below them but whitespace — while padding the visible gap
                        above. Ragged bottoms on a centred row read as normal; a hole between a
                        heading and its own sentence does not. */}
                    <Prose
                      as="p"
                      size="small"
                      className="mt-2 max-w-mk-measure-xs text-mk-pebble"
                    >
                      {item.body}
                    </Prose>
                  </Arrival>
                </li>
              );
            })}
          </ul>
        </div>

        {/*
          The card carries no arrival move of its own — the frame around it does, at `lg`, and
          only there. See `phone-frame.tsx` and `marketing-hero.css` for why: below `lg` the card
          is present and complete from the first frame exactly as before, because `<HeroCard>` is
          a plain server component with no client state to hydrate.

          ⚠ `<HeroCard>` RENDERS ITSELF AND TAKES NO PROPS — since 2026-09-29 it is a still
          drawing of the client's reference card (`hero-card.tsx`), so there is no pause control
          to place beside it and nothing for this file to hand down.
        */}
        {/*
          ⚠ `-mx-6`, NOT `-mx-3` — CHANGED 2026-09-21, AND IT IS STILL THE CARD SCREEN'S OWN
          BUDGET RATHER THAN A NUDGE, JUST A CORRECTED ONE.

          The screen is 330px wide and the device `phone-frame.tsx` draws adds 16.5px a side (an
          11.85px bezel inside a 4.65px rail), so the object this column has to hold is 363px
          before `--mk-phone-zoom` shrinks it. This
          column's own `px-6` costs it 24px a side. `-mx-3` used to give back only 12 of those
          24, leaving a box narrower than the frame it held — and `margin-inline: auto` cannot
          centre a box already wider than the room it is given, so at exactly 360px the whole
          deficit landed on ONE edge and the frame sat flush right with 12px on the left. That
          is the "edge to edge" the client's third rejection named. `-mx-6` cancels `px-6`
          outright: the box is the FULL viewport width below `md`, which is wider than the
          ~305px the device now renders at, so there is real slack for it to centre inside.

          ⚠ `flex justify-center` IS THE BELT TO THAT BRACES, ADDED 2026-09-21 AFTER THE CLIENT
          REPORTED IT LEFT-ALIGNED ON A PHONE — AND IT IS NOT REDUNDANT WITH THE AUTO MARGIN.
          Three separate mechanisms were being asked to agree that this object is centred:
          `<HeroCard>`'s `mx-auto`, `.mk-phone-frame`'s own `margin-inline: auto`, and this
          column's width. All three are auto-margin centring on a `width: fit-content` box, and
          auto margins silently resolve to ZERO — i.e. flush left — the moment the box does not
          fit, which is precisely the failure that was reported and precisely the one that
          reproduces only at widths nobody happened to measure. A flex container with
          `justify-content: center` does not have that failure mode: it centres the overflow
          too, so the worst case is symmetric bleed rather than a frame pinned to one edge.
          Cheap, and it removes the whole class of defect rather than the one instance of it.

          ⚠ `--mk-phone-zoom` IS SET HERE BECAUSE THE BREAKPOINT IS THIS FILE'S TO OWN.
          `marketing-hero.css` reads it and is otherwise free of media queries by contract
          (`tests/unit/marketing-hero.test.tsx` asserts it carries no `min-width` gate, after
          one shipped that left mobile with an invisible wrapper). Four steps since 2026-09-29, when
          the client asked for the phone to grow again so every field reads (the device is
          363×827 unzoomed, the reference's own proportions):
            · below `lg`, 0.84 — ~305×695. Stacked under the copy there is no fold to fit, and
              360px still keeps ~27px of margin a side.
            · at `lg`, 0.86 — ~312×711, which with the section's padding fits a 900px window.
            · at `lg` in a window under 820px tall, 0.7 — ~254×579, so the hero still fits
              1280×720 and 1440×700 with the section's short-window padding.
            · at `lg` in a window 1000px or taller, 0.98 — ~356×810, near the reference's own
              size, where there is room for it.

          ⚠ `flex-col items-center` KEEPS THE CENTRING ABOVE. `align-items: center` centres an
          overflowing item as symmetrically as `justify-content` did.

          ⚠ `lg:order-first` IS THE WHOLE COLUMN MIRROR. The DOM keeps type before card (mobile
          stacks type-first, unchanged, and a screen reader meets the sentence before the
          picture at every width); this pulls the card to the FRONT of source order only inside
          the `lg` grid, which is what makes it render in the grid's first five columns instead
          of its last. `lg:col-span-5` is untouched, so the type column still takes the wider
          seven.

          The phone and its card both come from `<HeroCard>`, which renders no wrapper element of
          its own — so `.mk-phone-frame`'s parent is still this column.
        */}
        <div className="relative -mx-6 flex flex-col items-center [--mk-phone-zoom:0.84] max-lg:order-1 max-lg:mt-12 md:mx-0 lg:order-first lg:col-span-5 lg:[--mk-phone-zoom:0.86] lg:[@media(max-height:820px)]:[--mk-phone-zoom:0.7] lg:[@media(min-height:1000px)]:[--mk-phone-zoom:0.98]">
          <HeroCard />
          {/* 2026-09-20 — THE SIGHTED HINT BELOW THE CARD LEFT WITH THE FLIP IT DESCRIBED.
              `hero.cardHint` ("Turns on its own — or press it.") told a sighted reader they
              could press the card to flip it. Agent F's rewrite made the hero's card a single,
              still, `inert` preview with no press to invite (`hero-card.tsx`'s header) — so
              rendering that sentence here would be actively wrong now, not merely stale. It
              follows `hero.aside` into "kept in the fixture, deliberately not rendered": restore
              it if the hero ever gets an interactive card again. `hero.cardFrontLabel` and
              `cardBackLabel` are unused for the same reason and are equally left in place. */}
        </div>
      </div>
    </Section>
  );
}
