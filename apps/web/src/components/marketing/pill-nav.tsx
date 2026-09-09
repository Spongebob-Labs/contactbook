import Link from "next/link";

import { mkcn } from "./mk-cn";
import { MkButtonLink } from "./type";

/**
 * The floating pill bar — the most visible single component in the build, and the one place
 * in `src/components/marketing/**` that leaves the flat plane.
 *
 * The shape is design.md's: a rounded bar of pure white floating over the paper ground,
 * wordmark left, the three section links in the space between, and two controls right — a
 * ghost "Log in" and a dark filled "Get started".
 *
 * ── Why this may carry elevation when nothing else here can ──────────────────────────
 * The direction is flat-first: a surface in normal flow separates itself with a hairline, not
 * a shadow. This bar is `position: fixed` — it floats over the page content by construction —
 * so it is the exception the rule allows for.
 *
 * It claims that through `data-elevation="1"`, never a shadow declaration of its own.
 * That attribute's rule ships inside the overlay layer's hoisted stylesheet, which is why
 * `<OverlayStyles />` in `(marketing)/layout.tsx` is load-bearing rather than decorative —
 * without it this bar sits flat on the paper. **Nothing else in this directory may take this
 * as licence to elevate.**
 *
 * ── No icons, at all ─────────────────────────────────────────────────────────────────
 * The marketing page uses no icons above the footer, and a test asserts zero `<svg>` inside
 * `<main>` outside a card. That is why the mobile layout *drops* the three centre links
 * rather than folding them behind a hamburger — the glyph would be the first icon on the
 * page. The links stay reachable at every width from `SiteFooter`, which is why the footer
 * carries the full section list rather than a token two.
 *
 * ── NOTE — IT OVERFLOWED ITS OWN PILL BELOW 390px, AND THE FIX IS FOUR VALUES ─────────────
 * At 360px the bar needed roughly 380px of content and had 336px of room, so "Get started" ran
 * out past the pill's right edge and lost its last characters — the loudest chrome in the
 * product, clipped, on the width most visitors arrive at. It never showed up as a horizontal
 * scrollbar because the bar is `position: fixed`, so its overflow does not extend the document's
 * scroll width: the page's "never scrolls sideways" test was green the whole time it was broken.
 * `tests/e2e/marketing.spec.ts` now measures the controls against the bar's own padding box,
 * which is the thing that was actually wrong.
 *
 * The fix spends nothing that matters at 360px and nothing at all above it:
 *
 *   · the wordmark drops from 24px to the 18px step — a name still set in the display face, and
 *     the single biggest line item at ~50px saved. It returns to 24px at `md`.
 *   · the bar's own inset and padding tighten from 12px to 8px, giving back 16px of viewport.
 *   · the gap between the wordmark and the controls goes 12px → 8px.
 *   · both buttons take narrower horizontal padding, and only below `md`.
 *
 * That leaves ~30px of slack at 360px rather than a 44px deficit, and the desktop bar is
 * byte-for-byte what it was. What was NOT done is worth recording: nothing here shrinks the
 * TAP TARGETS. Vertical padding, the two controls and their labels are untouched — a bar that
 * fits because its buttons became too small to hit is the same defect wearing a different hat.
 *
 * ── It is a server component again, and that is a real saving ────────────────────────
 * The previous version was `"use client"` for one reason: it called `buttonClassName` from
 * the product's `<Button>`, which lives in a client module, and a server component that calls
 * into one throws before rendering. It now uses `MkButtonLink` from `./type`, which is a
 * plain server-safe module — so the six static links in the loudest chrome in the product no
 * longer ship a hydration payload to say nothing.
 */

const SECTION_LINKS = [
  // `/#…` targets are sections of `/`. The ids are part of the chrome contract:
  // `(marketing)/page.tsx` must keep exposing `how-it-works` and `pricing`.
  /* NOTE - REPOINTED 2026-09-08. It was `/#how-it-works` and `/#faq`; the FAQ section is
     deleted, so `#faq` was a nav link to nothing. The spec's anchor test reads its targets off
     the rendered nav for exactly this reason, and caught it.

     This file is under an emoji lock (`marketing-chrome.test.tsx`), which is why these notes
     carry the word NOTE rather than the warning glyph the rest of the layer uses. The brief's suggested nav is "How it works / For individuals / For companies / About /
     Join waitlist"; `For individuals` is dropped because the whole homepage is for individuals
     and it would link to the page you are already on, and `For companies` plus the waitlist
     arrive with their routes. */
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#cards", label: "Example cards" },
  { href: "/corporate", label: "For companies" },
] as const;

/**
 * design.md's Pill Nav Tab: transparent, 14px Geist at medium weight, 8px radius, and a
 * paper fill on hover. "Nav reads as a row of whispers, not shouts" — so these are quieter
 * than the buttons beside them and quieter than the wordmark.
 */
const TAB_CLASS = mkcn(
  "rounded-mk-control px-3 py-1.5 font-mk-sans text-mk-body-sm text-mk-stone",
  "transition-colors duration-[var(--dur-fast)] hover:bg-mk-paper hover:text-mk-ink",
);

export function PillNav() {
  return (
    <nav
      aria-label="Primary"
      data-pill-nav=""
      data-elevation="1"
      className={mkcn(
        "fixed inset-x-2 top-3 z-50 mx-auto flex max-w-mk-page items-center gap-2",
        "rounded-mk-pill border border-mk-hairline bg-mk-white px-2 py-2",
        "md:inset-x-6 md:top-4 md:gap-6 md:px-4",
      )}
    >
      {/*
        The wordmark is the one place in the chrome that uses the display face. It is a
        name, not a label, and setting it in the display face is what tells a visitor within
        one glance that this is a wordmark rather than a nav item.

        NOTE: That face used to be Fraunces, and the sentence here used to read "the same company
        but not the same room" — a serif wordmark on the marketing site and a grotesque one in
        the product. It is Space Grotesk on both now: the rooms are still separate (different
        ground, different scale, different palette layer) but the NAME is the one thing that
        must not change between them, and a name set in two typefaces is two names.
      */}
      <Link
        href="/"
        className={mkcn(
          // NOTE — Two steps, not one. 24px "Contact Book" in the display face is ~155px wide and is
          // what pushed the bar past 360px on its own. The 18px step is still the display face
          // and still a name rather than a label — it is the same wordmark, set smaller on a
          // small screen, which is what every wordmark does.
          "shrink-0 whitespace-nowrap rounded-mk-control px-1 md:px-2",
          "font-mk-display text-mk-subheading text-mk-ink md:text-mk-heading-sm",
          "transition-colors duration-[var(--dur-fast)] hover:text-mk-sapphire-ink",
        )}
      >
        Contact Book
      </Link>

      <ul className="mx-auto hidden items-center gap-2 md:flex">
        {SECTION_LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={TAB_CLASS}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* NOTE — Horizontal padding only. The `py-2.5` both controls inherit from `MkButtonLink`'s
          `md` size is what gives them a hittable height, and shrinking a bar by shrinking its
          tap targets is not a fix. */}
      <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0 md:gap-2">
        <MkButtonLink href="/signin/phone" variant="ghost" className="px-2.5 md:px-4">
          Log in
        </MkButtonLink>
        {/* The brief's own nav control. It was "Get started" → `/signup/first-name`, which is
            the right control for a launched product and the wrong one for a pre-launch site:
            the page's whole ask is the waitlist, and a nav that sends people somewhere else is
            a nav competing with its own page. Sign-in stays, quietly, because there is a real
            app behind this and existing users need a door. */}
        <MkButtonLink href="/waitlist" variant="dark" className="px-3 md:px-5">
          Join the waitlist
        </MkButtonLink>
      </div>
    </nav>
  );
}
