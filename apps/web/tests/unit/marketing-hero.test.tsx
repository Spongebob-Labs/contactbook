import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen, within } from "../helpers/render";
import { Hero } from "@/components/marketing/hero";
import { hero, heroCard } from "@/fixtures/marketing";

/**
 * The rebuilt hero (`docs/landing-integration.md`, agent A's pass).
 *
 * ⚠ happy-dom has no layout engine and no compiled Tailwind sheet (spec §14.6, restated in
 * `tests/helpers/render.tsx`): nothing here asserts geometry or a computed colour. Two kinds of
 * assertion instead:
 *
 *   1. **Structure**, through Testing Library — the proof row is really four items, the frame
 *      really wraps the card, the headline really carries both clauses.
 *   2. **Source contracts**, through `readFileSync` on the files this pass owns — no colour
 *      literal, no `motion` import, no `scale(` near the card, and the frame's entrance
 *      animation is provably inert outside `prefers-reduced-motion: no-preference`. A rendered
 *      DOM cannot tell you what a stylesheet does off-screen; the text of the stylesheet can.
 */

const SRC = resolve(__dirname, "../../src");

function source(relative: string): string {
  return readFileSync(resolve(SRC, relative), "utf8");
}

/** Strips comments before a "no literal" scan, so a comment citing a hex value for
 *  documentation — which this codebase does throughout, e.g. `hero.tsx`'s own accent note —
 *  cannot fail a check that is really about rendered CSS/className values. */
function withoutComments(sourceText: string): string {
  return sourceText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

const HERO_TSX = "components/marketing/hero.tsx";
const PHONE_FRAME_TSX = "components/marketing/phone-frame.tsx";
const HERO_CSS = "styles/marketing-hero.css";

const OWNED_SOURCES = [HERO_TSX, PHONE_FRAME_TSX, HERO_CSS] as const;

/** A hex triplet/sextet, or an `rgb(`/`rgba(`/`hsl(`/`hsla(` literal — never a `var(--mk-*)`. */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|(?<!--mk-\w*-)\b(?:rgb|rgba|hsl|hsla)\(/;

/**
 * Extracts the single `@media (prefers-reduced-motion: no-preference) { ... }` block from a
 * stylesheet by counting braces from its own opening one, rather than a regex — nesting inside
 * that block (the `.mk-phone-frame` rule) would otherwise close a naively-matched `}` early.
 */
function reducedMotionBlock(css: string): string {
  const marker = "@media (prefers-reduced-motion: no-preference)";
  const markerAt = css.indexOf(marker);
  expect(markerAt, "expected a `prefers-reduced-motion: no-preference` guard").toBeGreaterThanOrEqual(0);

  const braceStart = css.indexOf("{", markerAt);
  let depth = 0;
  for (let i = braceStart; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(braceStart, i + 1);
    }
  }
  throw new Error("unterminated prefers-reduced-motion block");
}

describe("Hero — structure", () => {
  it("renders the eyebrow, both headline clauses, and the copy block", () => {
    renderWithProviders(<Hero />);

    expect(screen.getByText(hero.eyebrow)).toBeInTheDocument();

    const heading = document.getElementById("hero-headline");
    expect(heading, "expected #hero-headline (the <Display> h1)").not.toBeNull();
    // Both clauses must be present. Each clause is its own `display: block` <span> (the wipe's
    // per-line clip needs one clause per element) so, unlike a normal sentence, there is no text
    // NODE holding a space between them — `textContent` legitimately concatenates them, and a
    // test asserting the literal, space-joined sentence would be wrong about the DOM it reads.
    const headingText = heading!.textContent ?? "";
    expect(headingText).toContain("Never lose");
    expect(headingText).toContain("contact.");

    expect(screen.getByText(hero.subhead)).toBeInTheDocument();
    expect(screen.getByText(hero.lead)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hero.primary.label })).toHaveAttribute(
      "href",
      hero.primary.href,
    );
    expect(screen.getByRole("link", { name: hero.secondary.label })).toHaveAttribute(
      "href",
      hero.secondary.href,
    );
  });

  it("renders the proof row as a real list of exactly hero.proof.length items", () => {
    expect(hero.proof.length, "the reference's proof row is a 4-up").toBe(4);

    renderWithProviders(<Hero />);

    const list = document.querySelector("[data-hero-proof]");
    expect(list, "expected [data-hero-proof]").not.toBeNull();
    expect(list!.tagName).toBe("UL");

    const items = within(list as HTMLElement).getAllByRole("listitem");
    expect(items).toHaveLength(hero.proof.length);

    hero.proof.forEach((claim, i) => {
      const item = items[i]!;
      expect(within(item).getByText(claim.title)).toBeInTheDocument();
      expect(within(item).getByText(claim.body)).toBeInTheDocument();
      // One icon per item, decorative — the badge, not the SVG, carries `aria-hidden`.
      expect(item.querySelector("svg")).not.toBeNull();
    });
  });

  it("sets each proof item's title in the display serif, and keeps its caption sans", () => {
    // The reference's whole "editorial, not a feature grid" read comes from this contrast
    // (`hero.tsx`'s 2026-09-20 note) — a regression here is invisible in a plain text diff, so
    // it is asserted on the rendered className rather than left to a screenshot.
    renderWithProviders(<Hero />);

    const list = document.querySelector("[data-hero-proof]") as HTMLElement;
    const items = within(list).getAllByRole("listitem");

    hero.proof.forEach((claim, i) => {
      const item = items[i]!;
      const title = within(item).getByText(claim.title);
      const caption = within(item).getByText(claim.body);

      expect(title.className, `"${claim.title}" should be set in the display face`).toMatch(
        /\bfont-mk-display\b/,
      );
      expect(
        caption.className,
        `"${claim.body}" should stay sans, not follow the title into the serif`,
      ).not.toMatch(/\bfont-mk-display\b/);
    });
  });

  /**
   * ⚠ REPLACED 2026-09-21, SAME DAY IT WAS WRITTEN — IT PINNED THE DEFECT.
   *
   * This asserted that the title reserved two lines' worth of height and the caption three,
   * "win or lose the wrap". That mechanism did align the four items' baselines — and it also
   * left a full empty line under every title at every width where the titles do NOT wrap,
   * which is most of them. The client marked that dead space in a screenshot: "so much of a
   * gap between them that it is looking unprofessional and very vague."
   *
   * The reservation is gone. What is asserted now is the property that actually keeps the row
   * from going ragged, and which a reservation was only a crude proxy for: **every item is
   * built from the identical classes.** Four items that differ only in their words cannot
   * drift apart through per-item styling, and at the two widths where the longest title wraps
   * it carries its own caption with it — a far smaller defect than a permanent hole.
   *
   * happy-dom has no layout engine (see this file's header), so the rendered y-positions are
   * measured against a real browser in this round's report; this guards the construction.
   */
  it("builds all four proof claims from identical classes, reserving no dead space", () => {
    renderWithProviders(<Hero />);

    const items = [...document.querySelectorAll("[data-hero-proof] li")];
    expect(items).toHaveLength(hero.proof.length);

    const titleClasses = new Set<string>();
    const captionClasses = new Set<string>();

    hero.proof.forEach((claim, i) => {
      const item = items[i]!;
      const title = within(item as HTMLElement).getByText(claim.title);
      const caption = within(item as HTMLElement).getByText(claim.body);

      titleClasses.add(title.className);
      captionClasses.add(caption.className);

      /* The reservation must not come back by accident: a `min-h` multiple of the line-height
         is exactly what put the gap there, and it reads as a harmless alignment tweak in a
         diff. If a future pass genuinely needs it, it should delete this assertion knowingly. */
      expect(
        title.className,
        `"${claim.title}" reserves fixed lines again — that is what produced the gap the ` +
          "client rejected; align the row without padding it",
      ).not.toMatch(/\bmin-h-\[calc\(\d+\*var\(--mk-text-/);
      expect(caption.className).not.toMatch(/\bmin-h-\[calc\(\d+\*var\(--mk-text-/);
    });

    expect(
      titleClasses.size,
      `the four proof titles use ${titleClasses.size} different class strings; they must be ` +
        "identical or the row can go ragged one item at a time",
    ).toBe(1);
    expect(captionClasses.size, "the four proof captions must share one class string").toBe(1);
  });

  it("gives the subhead and the lead the same treatment, and the primary control a trailing icon", () => {
    // 2026-09-20: the two sentences under the headline read as one sans paragraph in the
    // reference, not a tagline over a caption — so they must carry the identical className,
    // not merely the same visible colour by coincidence.
    renderWithProviders(<Hero />);

    const subhead = screen.getByText(hero.subhead);
    const lead = screen.getByText(hero.lead);
    expect(subhead.className).toBe(lead.className);

    const primary = screen.getByRole("link", { name: hero.primary.label });
    expect(
      primary.querySelector("svg"),
      "the reference's primary control ends in an arrow glyph",
    ).not.toBeNull();

    // The secondary control keeps its label but is never a video control — there is no video
    // for it to open (`docs/landing-integration.md`, Agent E section).
    const secondary = screen.getByRole("link", { name: hero.secondary.label });
    expect(secondary.querySelector("video")).toBeNull();
  });

  it("wraps the card in the phone frame, which wraps the real (static) card preview", () => {
    // 2026-09-20: Agent F's parallel pass replaced the flip with a single, still `<CardPage>` —
    // `[data-hero-card]` now marks a plain, `inert` box rather than a `<button>`
    // (`hero-card.tsx`'s own header). `<Hero>` still owns nothing about that box's internals; it
    // only has to still be inside the frame this file renders.
    renderWithProviders(<Hero />);

    const frame = document.querySelector("[data-hero-phone-frame]");
    expect(frame, "expected [data-hero-phone-frame]").not.toBeNull();

    const card = frame!.querySelector("[data-hero-card]");
    expect(card, "the frame must wrap the real card preview, not a copy of it").not.toBeNull();
    expect(card, "the card is a static preview now, not a press").not.toHaveAttribute(
      "role",
      "button",
    );

    // Decorative dynamic island: present, and inert to assistive tech.
    const island = frame!.querySelector(".mk-phone-frame__island");
    expect(island).not.toBeNull();
    expect(island).toHaveAttribute("aria-hidden", "true");
  });

  /**
   * ⚠ ADDED 2026-09-20, THE CLIENT'S DEVICE PASS — *"the iPhone kind of lining is not there."*
   *
   * `phone-frame.tsx` gained a status bar, three case buttons and the dynamic island above. All
   * four are decorative case/glass chrome, not content, so the structural claim is the same one
   * the island already made: present, and invisible to assistive tech. This does not assert
   * geometry (happy-dom has no layout engine, per this file's own header) — the pixel proportions
   * are verified against a real browser in this round's report instead.
   */
  it("draws the status bar and the case buttons, all decorative", () => {
    renderWithProviders(<Hero />);

    const frame = document.querySelector("[data-hero-phone-frame]")!;

    const status = frame.querySelector(".mk-phone-frame__status");
    expect(status, "expected a status bar on the screen").not.toBeNull();
    expect(status).toHaveAttribute("aria-hidden", "true");
    expect(status?.textContent?.trim()).toBe("9:41");

    /**
     * ⚠ **THE SIGNAL BARS AND THE Wi-Fi FAN ARE GONE, AND THEY MUST NOT COME BACK AS BOXES.**
     *
     * They were four 2–3px bars and two `clip-path`-halved circles — correct geometry, and
     * unreadable at the size this device renders: `--mk-phone-zoom` takes the frame well under
     * 1, so a 1.4px arc border landed on a fraction of a device pixel and resolved as a grey
     * smear beside the battery. Removed at the client's instruction, who read exactly that.
     *
     * Asserted because "add the missing status glyphs" is the obvious-looking improvement for
     * anybody who has not seen it rendered. If they are ever genuinely wanted, they have to be
     * single vector paths, at which point this assertion is the place to say so.
     */
    expect(frame.querySelector(".mk-phone-frame__signal")).toBeNull();
    expect(frame.querySelector(".mk-phone-frame__wifi")).toBeNull();
    expect(
      frame.querySelector(".mk-phone-frame__battery"),
      "the battery is the one glyph the row keeps",
    ).not.toBeNull();

    const buttons = frame.querySelectorAll(".mk-phone-frame__button");
    expect(buttons, "expected the volume pair and the power key").toHaveLength(3);
    for (const button of buttons) {
      expect(button).toHaveAttribute("aria-hidden", "true");
    }
  });

  /**
   * ⚠ ADDED 2026-09-21, THE CLIENT'S FIFTH REVIEW — *"I want exactly this border of the design
   * of the mobile … the design, the side buttons, and the upper bar of this iPhone."*
   *
   * The rebuild that answered it is mostly stylesheet work, but two parts of it are STRUCTURAL
   * and are the parts a later "simplify this markup" pass would quietly undo, because neither
   * holds content and both look like wrappers for nothing:
   *
   *   · **The rail/bezel pair.** A phone is metal around a black mask around glass. Collapsing
   *     `.mk-phone-frame__body` back into its parent takes the two-material read with it and
   *     returns the flat rounded rectangle the client rejected twice. The nesting ORDER is the
   *     claim, not the element count — the keys have to be the rail's children (outside the
   *     bezel) or they cannot protrude past the silhouette.
   *   · **The lens.** One disc at the island's right end. Without it the island is a plain pill,
   *     which is an older notch's shape rather than the thing the reference draws.
   *
   * Geometry is still not asserted here (happy-dom has no layout engine, per this file's own
   * header); the measured footprint lives in `tests/e2e/marketing.spec.ts`'s "the hero's card
   * holds a fixed, zoomed 269px width".
   */
  it("builds the device as a rail around a bezel around the glass, keys on the rail", () => {
    renderWithProviders(<Hero />);

    const rail = document.querySelector("[data-hero-phone-frame]")!;
    const bezel = rail.querySelector(":scope > .mk-phone-frame__body");
    expect(bezel, "expected the bezel to be a direct child of the rail").not.toBeNull();

    const screen_ = bezel!.querySelector(":scope > .mk-phone-frame__screen");
    expect(screen_, "expected the glass inside the bezel, not beside it").not.toBeNull();

    // The keys sit on the rail. Inside the bezel they would be clipped to the black mask and
    // could never read as hardware protruding from the case.
    const keysOnRail = rail.querySelectorAll(":scope > .mk-phone-frame__button");
    expect(keysOnRail, "the keys belong to the rail, not the bezel").toHaveLength(3);

    const lens = rail.querySelector(".mk-phone-frame__island .mk-phone-frame__island-lens");
    expect(lens, "expected the camera lens inside the island").not.toBeNull();

    /**
     * ⚠ **THE SCREEN HAS A FOOT, AND IT IS A FIX FOR A REPORTED DEFECT.**
     *
     * The screen is a fixed 9/19.5 window and `<CardPage>` is taller than it — the clip is the
     * message ("there is more card") and is not the bug. Where it landed was: straight through
     * the middle of the social strip's 36px icon discs, leaving four half-circles pressed flat
     * against the bottom bezel. Reported as the icons "overlapping with the frame".
     *
     * The veil dissolves whatever row meets the boundary and the home indicator gives the
     * screen the ending a real one has. Both are asserted because deleting either restores the
     * severed row, and the failure looks like a styling choice rather than a regression.
     */
    expect(
      rail.querySelector(".mk-phone-frame__veil"),
      "expected the screen's bottom veil — without it the clip severs a row of icons",
    ).not.toBeNull();
    expect(
      rail.querySelector(".mk-phone-frame__home"),
      "expected the home indicator",
    ).not.toBeNull();
  });

  it("no longer renders the flip-era hint or labels, now that the card does not flip", () => {
    // `hero.cardHint` ("Turns on its own — or press it."), `cardFrontLabel` and `cardBackLabel`
    // described a press that no longer exists (`hero-card.tsx`'s header, and the comment in
    // `hero.tsx` where this used to render). They stay in the fixture for history; asserting
    // their absence here is what keeps a future edit from reviving a sentence that is actively
    // wrong about the current, static card rather than merely old copy.
    renderWithProviders(<Hero />);
    expect(screen.queryByText(hero.cardHint)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: hero.cardFrontLabel })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: hero.cardBackLabel })).not.toBeInTheDocument();
  });

  /**
   * ⚠ ADDED 2026-09-21 — THE COVER PHOTO'S LCP HINT.
   *
   * `<CardCover>` (`@/card/card-page`, read-only from here) draws the actual `<img>` with no
   * `loading`/`fetchPriority` of its own — see `hero.tsx`'s own comment at the `preload()` call
   * site for why that file cannot carry one. This is the one property this file CAN assert: the
   * hint reaches `<head>` at all, points at the same URL the card resolves
   * (`heroCard.coverUrl`), and asks for high priority rather than the browser's default guess.
   */
  it("preloads the card's cover photo as a high-priority image resource", () => {
    renderWithProviders(<Hero />);
    const link = document.head.querySelector('link[rel="preload"][as="image"]');
    expect(link, "expected a <link rel=preload as=image> in <head>").not.toBeNull();
    expect(link).toHaveAttribute("href", heroCard.coverUrl);
    expect(link).toHaveAttribute("fetchpriority", "high");
  });

  /**
   * ⚠ ADDED 2026-09-21 — THE MARGIN FIX'S OWN REGRESSION GUARD.
   *
   * happy-dom cannot see that this closes the 360px flush-right defect (this file's own header
   * has the measured before/after); it CAN see that the mechanism — a negative margin that fully
   * cancels the column's own `px-6` rather than half-cancelling it — is still the one in the
   * markup, and that is what a future "simplify this" edit would touch without necessarily
   * re-deriving the arithmetic first.
   */
  it("cancels the card column's own gutter outright on mobile, not by half", () => {
    renderWithProviders(<Hero />);
    // The frame's own root is `.mk-phone-frame` (`phone-frame.tsx`); its PARENT is the column
    // this file draws the negative margin on. `<HeroCard>`'s own `mx-auto` (`hero-card.tsx`,
    // not this file's className to read) sits one level further IN and is not the wrapper this
    // test is about — closest("[class*=mx-]") from the card would find that one first.
    const frame = document.querySelector("[data-hero-phone-frame]");
    const column = frame!.parentElement;
    expect(column, "expected the card column wrapper").not.toBeNull();
    expect(column!.className).toMatch(/-mx-6\b/);
    expect(column!.className).not.toMatch(/-mx-3\b/);
  });
});

describe("Hero — source contracts", () => {
  it.each(OWNED_SOURCES)("%s reads only --mk-* tokens, never a colour literal", (relative) => {
    const clean = withoutComments(source(relative));
    const match = clean.match(COLOUR_LITERAL);
    expect(match, `found a colour literal in ${relative}: ${match?.[0]}`).toBeNull();
  });

  it.each([HERO_TSX, PHONE_FRAME_TSX])("%s imports no animation runtime", (relative) => {
    const src = source(relative);
    expect(src).not.toMatch(/from ["']motion(\/react)?["']/);
    expect(src, "the hero's load sequence is CSS-only").not.toMatch(/\buse client\b/);
  });

  it("never wires up the unused hero video loop", () => {
    // `public/hero/hero-loop.{mp4,webm}` sits unused on purpose (`docs/landing-integration.md`,
    // Agent E section): the reference's secondary control is a "Watch Video" play button and
    // this build has no video to open. A future pass reaching for that asset to make the
    // secondary control look more like the reference would reintroduce a control that opens
    // nothing, which the brief calls worse than no play button at all.
    expect(withoutComments(source(HERO_TSX))).not.toMatch(/hero-loop|<video/);
  });

  it("never scales the card or an ancestor of it", () => {
    // The hard constraint: a phone frame that shrinks the 336px face breaks the QR decode floor
    // (`qr-geometry.ts`, `tests/e2e/qr-scannability.spec.ts`). `scale(` must not appear anywhere
    // in the two files that can reach the card's ancestry.
    expect(withoutComments(source(HERO_TSX))).not.toContain("scale(");
    expect(withoutComments(source(PHONE_FRAME_TSX))).not.toContain("scale(");
    expect(withoutComments(source(HERO_CSS))).not.toContain("scale(");
  });

  it("renders the phone frame's chrome at every viewport, with no breakpoint gate", () => {
    // 2026-09-20: this used to require a `min-width: 1024px` gate, because the wallet pass's
    // QR could not be scaled below `MIN_QR_SIZE_PX` and desktop was the only place there was
    // room to add bezel padding without shrinking it. `<CardPage>` (the hero's card as of the
    // same round) has never carried a QR, and the client's own complaint was that the gate left
    // mobile with an invisible wrapper — so the true property today is the opposite of what
    // this test used to assert, not a relaxation of it.
    const css = source(HERO_CSS);
    expect(css).not.toContain("@media (min-width: 1024px)");
    // Belt-and-braces on the "never scales the card" constraint above: no width/height is ever
    // set on the frame, which is what keeps the card's own intrinsic box untouched.
    expect(css).not.toMatch(/\.mk-phone-frame\s*{[^}]*\bwidth:\s*\d/);
  });

  it("keeps the frame's final state the default, with motion gated behind reduced-motion", () => {
    const css = source(HERO_CSS);
    const guarded = reducedMotionBlock(css);

    expect(guarded, "the rise animation should live inside the guard").toContain("animation:");

    const guardedAt = css.indexOf(guarded);
    const unguarded = css.slice(0, guardedAt) + css.slice(guardedAt + guarded.length);

    // Outside the guard, nothing may apply the animation or park the frame invisible — a
    // reader with scripting off, or `prefers-reduced-motion: reduce`, must see it at rest.
    expect(unguarded).not.toContain("animation");
    expect(unguarded).not.toMatch(/opacity:\s*0\b/);
  });
});
