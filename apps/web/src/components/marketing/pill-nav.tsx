import Image from "next/image";
import Link from "next/link";

import { mkcn } from "./mk-cn";
import { CONTENT_COLUMN } from "./section";
import { MkButtonLink } from "./type";

/**
 * NOTE — THE WORDMARK IS THE LOGO NOW, 2026-09-28. The client: *"Logo: replace two-word 'Contact
 * Book' banner with revised logo (top left, links to homepage)."* The text wordmark set in the
 * display face is gone; the gold and brown lockup takes its place.
 *
 * The nav uses `contactbook-logo-nav.png` — the lockup with its tagline removed, because "NEVER
 * LOSE CONTACT" at nav height is a line of 5px capitals, which is noise rather than a tagline.
 * The footer uses the full lockup, where there is room for it to be read.
 *
 * `BRAND_NAME` is the image's alt text and therefore the link's accessible name — one word,
 * the way the logo spells it. The footer and the chrome's tests read it from here.
 */
export const BRAND_NAME = "ContactBook";

/** The tagline-free lockup's intrinsic size. The rendered height is set by class. */
const NAV_LOGO = { src: "/brand/contactbook-logo-nav.png", width: 408, height: 81 } as const;

/**
 * The site header — one `position: fixed`, full-width white bar, the same element at every width.
 *
 * Laid out on the page's content column (`CONTENT_COLUMN`, imported rather than restated), so the
 * logo's left edge and the pill's right edge line up with every section beneath. Logo left, no
 * box. Right, the white pill around "Log in" and "Get Started" — the client's 2026-10-06 ask:
 * *"logo larger, top left, out of the box; the box only around Log in and Get Started."*
 *
 * NOTE — 2026-10-06, REBUILT AS ONE BAR. The first cut of that ask was two unrelated layers: from
 * `md` the nav was `absolute`, so the logo scrolled away with the page, while only the pill was
 * `fixed`. Scrolled down, the header was two buttons floating over the content with no logo —
 * read, correctly, as a glitch. Now the bar is fixed and opaque, and everything in it stays.
 *
 * ── Height is a contract with the layout ─────────────────────────────────────────────
 * `h-16` / `md:h-20` here ↔ `pt-16` / `md:pt-20` on `<main>` in `(marketing)/layout.tsx`, and the
 * hero's `lg:min-h-[calc(100svh-5rem)]` assumes the 80px. Move all three together. Sections clear
 * the bar on an anchor jump with their own `scroll-mt-28` (112px), in `section.tsx`.
 *
 * ── Why this may carry elevation when nothing else here can ──────────────────────────
 * The direction is flat-first: a surface in normal flow separates itself with a hairline. This
 * bar is `fixed` — content scrolls under it by construction — so it is the exception the rule
 * allows, claimed through `data-elevation="1"` (whose rule `<OverlayStyles />` in the layout
 * ships), never a declaration of its own. The pill inside it is flat: a second lift on a surface
 * that already floats would be one surface stacked on another. **Nothing else in this directory
 * may take this as licence to elevate.**
 *
 * ── No icons, at all ─────────────────────────────────────────────────────────────────
 * A test asserts zero `<svg>` inside `<main>` outside a card, and the nav holds to the same
 * rule — which is why the centre links were dropped rather than folded behind a hamburger.
 * `SiteFooter` is where the section routes stay reachable.
 *
 * ── The 360px budget ─────────────────────────────────────────────────────────────────
 * Below `md` the row has 312px of content box. The logo drops to 24px tall (~121px wide) and the
 * controls take narrower horizontal padding, so both fit with their full tap targets. Nothing
 * here shrinks a tap target; `tests/e2e/marketing.spec.ts` measures the controls against the
 * row's padding box, because a `fixed` bar's overflow never shows up as a sideways scroll.
 *
 * It is a server component: `MkButtonLink` from `./type` is server-safe, so the loudest chrome
 * in the product ships no hydration payload.
 */

/*
   NOTE - EMPTY ON PURPOSE SINCE 2026-09-20, ON THE CLIENT'S INSTRUCTION: *"in the nav bar, remove
   the example cards. Remove the page of four companies. Remove How it works. Just make it a
   bland nav bar."*

   It held three: `/#how-it-works`, `/templates` (labelled "Example cards") and `/corporate`.
   The bar is now the logo, Log in, and "Get Started" — the one thing the page is asking for.

   NOTE - THE ROUTES STILL EXIST. Only the nav entries are gone. The footer still links
   `/templates`. `/corporate` and `/waitlist` stay on disk, but since 2026-09-28 nothing on the
   homepage or this chrome links to either (the client asked for both to come off the page).

   Kept as an empty list rather than deleted along with the `<ul>` below, because this bar has
   twice had a nav entry orphaned by a section cut (`#faq`, then `#cards`) and the next hand to
   add one should find the seam, the history, and the test that guards it — not rebuild it. */
const SECTION_LINKS: readonly { readonly href: string; readonly label: string }[] = [];

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
      className="fixed inset-x-0 top-0 z-50 h-16 border-b border-mk-hairline bg-mk-white md:h-20"
    >
      <div
        data-pill-nav-row=""
        className={mkcn(CONTENT_COLUMN, "flex h-full items-center gap-2 md:gap-6")}
      >
        {/*
          The logo, top left, home — no box around it. `preload` because it is above the fold on
          every marketing page (it replaced `priority`, deprecated in Next 16). 24px tall on a
          phone (the 360px budget above), 44px from `md`. Under 360px even 24px does not fit, so
          the same image is cropped to its CB mark (`object-cover` + `object-left` on a 28px-wide
          box) — one file, no second request.
        */}
        <Link
          href="/"
          data-pill-nav-logo=""
          className={mkcn(
            "flex shrink-0 items-center rounded-mk-control py-1",
            "transition-opacity duration-[var(--dur-fast)] hover:opacity-80",
          )}
        >
          <Image
            src={NAV_LOGO.src}
            width={NAV_LOGO.width}
            height={NAV_LOGO.height}
            alt={BRAND_NAME}
            preload
            className="h-6 w-auto max-[359px]:w-7 max-[359px]:object-cover max-[359px]:object-left md:h-11"
          />
        </Link>

        {/*
          The `<ul>` renders only when there is something in it: an empty list announces as
          "list, 0 items". Otherwise a plain spacer pushes the controls right, and the list
          takes that job back the moment a link is added.
        */}
        {SECTION_LINKS.length > 0 ? (
          <ul className="mx-auto hidden items-center gap-2 md:flex">
            {SECTION_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={TAB_CLASS}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <span className="mx-auto" aria-hidden="true" />
        )}

        {/* THE PILL — white, hairline, pill radius, around the two controls only. 2026-10-07: a
            slimmer 52px capsule (it was 60px, which left 9px of dead white above and below the
            42px buttons) and the buttons are pills too, so the inner radius matches the outer
            one instead of two 8px-cornered buttons in a round box. The `py-2.5` both inherit
            from `MkButtonLink`'s `md` size is their hittable height and is not touched. */}
        <div
          data-pill-nav-controls=""
          className={mkcn(
            "ml-auto flex shrink-0 items-center gap-1 rounded-mk-pill border border-mk-hairline bg-mk-white p-1",
            "md:ml-0 md:h-[52px] md:gap-1 md:p-1",
          )}
        >
          <MkButtonLink
            href="/signin/phone"
            variant="ghost"
            className="rounded-mk-pill px-3 md:px-5"
          >
            Log in
          </MkButtonLink>
          {/* NOTE — 2026-09-28: was "Join the waitlist" → `/waitlist`, removed on the client's
              word ("join the waitlist copy … need removing"). Phone sign-in is sign-up and log-in
              at once, which is why both controls share a destination; "Log in" stays so a
              returning user does not have to read the CTA as their way back.

              2026-10-06: "Create your card" → "Get Started" — a visitor has no account yet, so
              they cannot create a card from here. Same label as `hero.primary` and `close.cta`. */}
          <MkButtonLink
            href="/signin/phone"
            variant="dark"
            className="rounded-mk-pill px-4 md:px-6"
          >
            Get Started
          </MkButtonLink>
        </div>
      </div>
    </nav>
  );
}
