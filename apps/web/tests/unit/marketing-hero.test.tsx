import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen, within } from "../helpers/render";
import { Hero } from "@/components/marketing/hero";
import { hero, heroPhone } from "@/fixtures/marketing";

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
const HERO_CARD_TSX = "components/marketing/hero-card.tsx";
const HERO_GLYPHS_TSX = "components/marketing/hero-phone-glyphs.tsx";
const HERO_MEDALLION_TSX = "components/marketing/hero-medallion.tsx";
const HERO_CSS = "styles/marketing-hero.css";

const OWNED_SOURCES = [
  HERO_TSX,
  PHONE_FRAME_TSX,
  HERO_CARD_TSX,
  HERO_GLYPHS_TSX,
  HERO_MEDALLION_TSX,
  HERO_CSS,
] as const;

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

  /**
   * ⚠ REWRITTEN 2026-09-29 — THE DEVICE IS THE CLIENT'S REFERENCE PHONE, MEASURED.
   *
   * The client rejected the previous device (a Dynamic Island phone, three keys, a status bar cut
   * down to the time and a battery) against their reference render, which is a different phone:
   * a notch with a speaker and camera, four keys, a three-ring rail, and a full iOS status bar.
   * These assert the STRUCTURE that makes it that phone — the parts a later "simplify this
   * markup" pass would quietly undo because none of them holds content. Geometry is not asserted
   * (happy-dom has no layout engine); the measured numbers live in `marketing-hero.css`.
   */
  it("wraps the reference card in the phone frame, inert and captioned", () => {
    renderWithProviders(<Hero />);

    const frame = document.querySelector("[data-hero-phone-frame]");
    expect(frame, "expected [data-hero-phone-frame]").not.toBeNull();

    const card = frame!.querySelector("[data-hero-card]");
    expect(card, "the frame must wrap the card").not.toBeNull();
    expect(card, "a picture of a card, removed from tab order and the a11y tree").toHaveAttribute(
      "inert",
    );
    expect(card).not.toHaveAttribute("role", "button");

    const figure = card!.closest("figure");
    expect(figure, "the card is a <figure>, so the caption can stand in for it").not.toBeNull();
    expect(within(figure!).getByText(heroPhone.caption)).toHaveClass("sr-only");
  });

  it("draws a notch — not an island — with its speaker and camera, all decorative", () => {
    renderWithProviders(<Hero />);
    const frame = document.querySelector("[data-hero-phone-frame]")!;

    expect(frame.querySelector(".mk-phone-frame__island"), "the reference has a notch").toBeNull();
    const notch = frame.querySelector(".mk-phone-frame__notch");
    expect(notch).toHaveAttribute("aria-hidden", "true");
    expect(notch!.querySelector(".mk-phone-frame__speaker")).not.toBeNull();
    expect(notch!.querySelector(".mk-phone-frame__camera")).not.toBeNull();
  });

  /**
   * ⚠ THE SIGNAL BARS AND THE Wi-Fi FAN ARE BACK — AS VECTOR SHAPES, WHICH IS THE CLAIM.
   *
   * They were removed on 2026-09-21 because they were drawn as 2–3px CSS boxes, which smeared
   * into grey under `--mk-phone-zoom`, and this test used to assert their absence with a note
   * that they could return only as single vector paths. The reference draws the full bar, so
   * they are back on exactly that condition: each glyph is an `<svg>`, never a stack of spans.
   */
  it("draws the full status bar, every glyph an <svg> rather than CSS boxes", () => {
    renderWithProviders(<Hero />);
    const status = document.querySelector("[data-hero-phone-frame] .mk-phone-frame__status")!;
    expect(status).toHaveAttribute("aria-hidden", "true");
    expect(status.textContent?.trim()).toBe("9:41");

    for (const glyph of ["signal", "wifi", "battery"]) {
      const node = status.querySelector(`.mk-phone-frame__${glyph}`);
      expect(node?.tagName.toLowerCase(), `the ${glyph} glyph must be a vector`).toBe("svg");
    }
  });

  it("builds the device as rail, bezel, glass — with four keys beside the rail", () => {
    renderWithProviders(<Hero />);
    const frame = document.querySelector("[data-hero-phone-frame]")!;

    /* The nesting ORDER is the claim: metal around a black mask around glass. The rail's three
       rings live on ONE box (band as background, hairline and graphite as inset shadows) —
       nested ring boxes were tried and snapped to device pixels, losing the 1px graphite ring
       top and bottom at 2×. */
    const glass = frame.querySelector(
      ":scope > .mk-phone-frame__rail > .mk-phone-frame__body > .mk-phone-frame__screen",
    );
    expect(glass, "expected the rail, then the bezel, then the glass").not.toBeNull();

    /* Four keys, not three — the reference has an action key above the volume pair. They are
       siblings of the rail so they can sit under the silhouette and show only their proud edge. */
    const keys = [...frame.querySelectorAll(":scope > .mk-phone-frame__button")];
    expect(
      keys.map((k) => [...k.classList].find((c) => c.includes("--"))?.split("--")[1]),
    ).toEqual(["action", "volume-up", "volume-down", "power"]);
    for (const key of keys) expect(key).toHaveAttribute("aria-hidden", "true");

    /* The card fills the screen exactly now, so there is no clip to disguise — and the
       reference draws no home indicator. */
    expect(frame.querySelector(".mk-phone-frame__veil")).toBeNull();
    expect(frame.querySelector(".mk-phone-frame__home")).toBeNull();
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
   * ⚠ REWRITTEN 2026-09-29 — THE CARD DRAWS ITS OWN `<img>`, SO THE HINT MOVED ONTO IT.
   *
   * `hero.tsx` used to call `preload()` because `<CardCover>` drew the cover `<img>` and could not
   * carry `fetchPriority`. The card now draws the portrait itself, which is the direct form of
   * the same hint — and a preload as well would be the same request twice.
   */
  it("loads the cover portrait at high priority, at 2× and 3× the design width", () => {
    renderWithProviders(<Hero />);
    const img = document.querySelector("[data-hero-card] img");
    expect(img, "expected the cover portrait").not.toBeNull();
    expect(img).toHaveAttribute("fetchpriority", "high");
    expect(img, "decorative — the caption describes the card").toHaveAttribute("alt", "");
    expect(img!.getAttribute("srcset")).toContain(`${heroPhone.portrait.x2} 2x`);
    expect(img!.getAttribute("srcset")).toContain(`${heroPhone.portrait.x3} 3x`);
    expect(document.head.querySelector('link[rel="preload"][as="image"]')).toBeNull();
  });

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

  it.each([HERO_TSX, PHONE_FRAME_TSX, HERO_CARD_TSX])("%s imports no animation runtime", (relative) => {
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
    // The card is laid out once at its 330px design width and sized only through `zoom`, which
    // re-rasterises; a `scale(` anywhere in its ancestry would resample rasterised text instead.
    for (const file of [HERO_TSX, PHONE_FRAME_TSX, HERO_CARD_TSX, HERO_CSS]) {
      expect(withoutComments(source(file)), file).not.toContain("scale(");
    }
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

/* ── The hero card — the client's reference, 2026-09-29 ──────────────────────────────────── */

/** Strips CSS comments, so a rule is only found where it is really declared. */
function cssWithoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Every real `@media (prefers-reduced-motion: no-preference) { … }` block, comments excluded. */
function guardedBlocks(css: string): string[] {
  const clean = cssWithoutComments(css);
  const marker = "@media (prefers-reduced-motion: no-preference)";
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const at = clean.indexOf(marker, from);
    if (at < 0) break;
    const open = clean.indexOf("{", at);
    let depth = 0;
    let end = open;
    for (let i = open; i < clean.length; i++) {
      if (clean[i] === "{") depth++;
      else if (clean[i] === "}" && --depth === 0) {
        end = i;
        break;
      }
    }
    blocks.push(clean.slice(open, end + 1));
    from = end + 1;
  }
  return blocks;
}

/** The glyphs the reference draws FILLED; the rest of its row icons are outline. */
const FILLED_ROW_GLYPHS: ReadonlySet<string> = new Set(["phone", "pin"]);

describe("the hero card — the client's reference, word for word", () => {
  it("prints every line of the reference card, in the reference's order", () => {
    renderWithProviders(<Hero />);
    const text = document.querySelector("[data-hero-card]")!.textContent ?? "";
    const lines = [
      ...heroPhone.script,
      heroPhone.brand,
      heroPhone.name,
      heroPhone.role,
      heroPhone.company,
      ...heroPhone.bio,
      heroPhone.action,
      ...heroPhone.sections.flatMap((s) => [s.label, ...s.rows.map((r) => r.value)]),
      heroPhone.socialLabel,
    ];
    let at = 0;
    for (const line of lines) {
      const found = text.indexOf(line, at);
      expect(found, `"${line}" is missing or out of order`).toBeGreaterThanOrEqual(0);
      at = found + line.length;
    }
  });

  /**
   * The client asked for the reference's content exactly. Two strings cannot be exact: the
   * reference prints `.com` domains that are not ours, and `fixture-hygiene.test.ts` admits only
   * reserved ones. This pins the departure to exactly those two, and to the TLD alone — the
   * reference's rows are transcribed here once, as the requirement, not restated from the fixture.
   */
  it("departs from the reference's rows only where a domain moves to .example", () => {
    const REFERENCE_ROWS = [
      "+44 7700 900123",
      "maya@contactbook.com",
      "Lisbon, Portugal",
      "Maya Partners",
      "www.mayapartners.com",
    ];
    const ours = heroPhone.sections.flatMap((s) => s.rows.map((r) => r.value));
    expect(ours).toEqual(REFERENCE_ROWS.map((v) => v.replace(/\.com$/, ".example")));
  });

  /* 2026-09-29: `heroPhone` reads these from `marketing-identity.ts`, which every section below
     shares, so an edit made there for another section must not quietly move the reference. */
  it("keeps the reference's name, role, company and bio, whatever the identity file says", () => {
    expect([heroPhone.name, heroPhone.role, heroPhone.company, ...heroPhone.bio]).toEqual([
      "Maya Laurent",
      "Founder & CEO",
      "Maya Partners",
      "Connecting people, ideas and opportunities",
      "to create lasting impact.",
    ]);
  });

  /* Drawing all five row icons in one monoline weight is what made the old rows read flat; the
     reference mixes filled (phone, pin) with outline (envelope, building, link). */
  it("mixes filled and outline row glyphs, as the reference does", () => {
    renderWithProviders(<Hero />);
    const drawn = [...document.querySelectorAll("[data-hero-card] .mk-hc__disc svg")].map((g) =>
      g.classList.contains("mk-hc-glyph--fill") ? "fill" : "line",
    );
    const expected = heroPhone.sections.flatMap((s) =>
      s.rows.map((r) => (FILLED_ROW_GLYPHS.has(r.icon) ? "fill" : "line")),
    );
    expect(drawn).toEqual(expected);
  });

  it("draws one filled brand mark per social platform", () => {
    renderWithProviders(<Hero />);
    const discs = document.querySelectorAll("[data-hero-card] .mk-hc__social-disc");
    expect(discs).toHaveLength(heroPhone.social.length);
    for (const disc of discs) expect(disc.querySelector("svg.mk-hc-mark")).not.toBeNull();
  });

  /**
   * ⚠ THE CLIENT DID NOT ASK FOR THE CARD TO MOVE. From 2026-09-28 it cross-faded between four
   * cities and tinted and tagged each changed line "Updated", on a timer, with a pause control.
   * The client called that highlighting unrequested. Nothing on the card may move or mark itself.
   */
  it("never moves, cycles or marks anything on the card", () => {
    renderWithProviders(<Hero />);
    const card = document.querySelector("[data-hero-card]")!;
    expect(card.querySelector("[data-changed], [data-hero-layer], [data-hero-enter]")).toBeNull();
    expect(card.textContent).not.toContain("Updated");
    expect(screen.queryByRole("button", { name: /animation/i }), "no pause control").toBeNull();

    const guarded = guardedBlocks(source(HERO_CSS)).join("\n");
    expect(guarded, "only the device's one-shot rise is animated").not.toContain(".mk-hc");
  });

  it("gates every animated rule behind prefers-reduced-motion: no-preference", () => {
    /* Read with comments stripped, so a guard written in a comment cannot pass for a real one. */
    const css = cssWithoutComments(source(HERO_CSS));
    const blocks = guardedBlocks(source(HERO_CSS));
    const outside = blocks.reduce((rest, block) => rest.replace(block, ""), css);
    expect(blocks.join("\n"), "no real reduced-motion guard in marketing-hero.css").toContain(
      "animation:",
    );
    expect(outside, "an animation is applied outside the reduced-motion guard").not.toMatch(
      /animation\s*:/,
    );
  });
});
