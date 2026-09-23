import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { hero } from "@/fixtures/marketing";

import { IntroCurtain } from "@/components/marketing/intro-curtain";
import { renderWithProviders } from "../helpers/render";

/**
 * The landing page's intro curtain — see `intro-curtain.tsx`'s own header for what it is and,
 * more importantly, what it must never become.
 *
 * ⚠ ALMOST EVERYTHING WORTH GUARDING HERE IS A SOURCE CONTRACT, NOT A RENDERED FACT, and that
 * is unusual enough to say why. happy-dom has no cascade and no animation clock, so it cannot
 * observe the one behaviour that matters: that this panel *goes away*. What it CAN observe is
 * the text of the stylesheet, and every mechanism that makes the panel go away is written
 * there — the default is `display: none`, the only rule that shows it also animates it, and
 * that rule is inside the reduced-motion guard. A curtain that fails any of those is a blank
 * page over a working site, which is the worst failure this repository can ship, so the checks
 * below are deliberately paranoid about the mechanism rather than the look.
 */

const SRC = resolve(__dirname, "../../src");
const read = (relative: string): string => readFileSync(resolve(SRC, relative), "utf8");

const CURTAIN_TSX = "components/marketing/intro-curtain.tsx";
const CURTAIN_CSS = "styles/marketing-intro.css";
const ROOT_LAYOUT = "app/layout.tsx";
const LANDING_PAGE = "app/(marketing)/page.tsx";

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|(?<!--mk-\w*-)\b(?:rgb|rgba|hsl|hsla)\(/;

describe("IntroCurtain — structure", () => {
  it("renders the brand lockup from the fixture, never from retyped copy", () => {
    const { container } = renderWithProviders(<IntroCurtain />);
    const curtain = container.querySelector("[data-intro-curtain]");
    expect(curtain, "expected [data-intro-curtain]").not.toBeNull();

    expect(curtain!.textContent).toContain(hero.eyebrow);
    // The headline is split on spaces for the per-word turn, so the DOM holds it as several
    // nodes. Normalising whitespace is what lets this assert the whole sentence rather than
    // its pieces — and asserting the whole sentence is the point: the curtain and the hero's
    // own <h1> must be incapable of disagreeing about the brand's locked line.
    expect(curtain!.textContent?.replace(/\s+/g, " ").trim()).toContain(hero.headline);
  });

  it("gives every word its own turning plane and its own index", () => {
    const { container } = renderWithProviders(<IntroCurtain />);
    const words = [...container.querySelectorAll(".mk-intro__word")];
    expect(words).toHaveLength(hero.headline.split(" ").length);

    words.forEach((word, index) => {
      // The stagger is `calc(var(--mk-intro-i) * ...)` in the stylesheet, so a missing index
      // silently collapses the whole line onto one beat rather than failing loudly.
      expect(word.getAttribute("style")).toContain(`--mk-intro-i: ${index}`);
    });
  });

  /**
   * ⚠ THE SPACES ARE A REAL REGRESSION THIS FILE HAS ALREADY CAUGHT ONCE.
   * A word needs `display: inline-block` to have a box `rotateX` can turn, and an inline-block
   * collapses its own trailing whitespace — so a space written INSIDE the span renders as
   * nothing. The first cut read "Neverlosecontact." on screen while looking perfectly correct
   * in the JSX, which is exactly the class of defect a unit test should own.
   */
  it("keeps the spaces between words outside the turning spans", () => {
    const { container } = renderWithProviders(<IntroCurtain />);
    const line = container.querySelector(".mk-intro__line")!;
    for (const word of line.querySelectorAll(".mk-intro__word")) {
      expect(word.textContent, "a word span must hold the word and nothing else").toBe(
        word.textContent?.trim(),
      );
    }
    expect(line.textContent).toBe(hero.headline);
  });

  it("is inert to assistive tech — every word of it is already on the page below", () => {
    const { container } = renderWithProviders(<IntroCurtain />);
    const curtain = container.querySelector("[data-intro-curtain]")!;
    expect(curtain).toHaveAttribute("aria-hidden", "true");
    // Nothing focusable can hide behind an `aria-hidden` ancestor — that is a WCAG violation
    // in its own right, and a splash is the easiest place in a codebase to commit it.
    expect(
      curtain.querySelectorAll("a, button, input, select, textarea, [tabindex]"),
    ).toHaveLength(0);
  });
});

describe("IntroCurtain — the contracts that make it go away", () => {
  /**
   * ⚠ COMMENTS ARE STRIPPED BEFORE EVERY SCAN IN THIS BLOCK, AND THAT IS LOAD-BEARING RATHER
   * THAN TIDY. This stylesheet's own header *describes* its reduced-motion contract in prose,
   * so a naive `indexOf("@media (prefers-reduced-motion: no-preference)")` finds the sentence
   * about the guard, tens of lines above the guard, and every "is this rule inside the guard?"
   * check below then answers against the wrong offset — passing or failing for a reason that
   * has nothing to do with the CSS. `marketing-hero.test.tsx` has the same trap live in it
   * today, where it makes a real assertion vacuous.
   */
  const css = withoutComments(read(CURTAIN_CSS));
  const tsx = read(CURTAIN_TSX);

  it("defaults to no curtain at all, with `display: none` and no media query", () => {
    // The literal default. If this rule ever becomes `display: flex`, a reduced-motion reader
    // gets a permanent cream panel over the site.
    expect(css).toMatch(/\.mk-intro\s*\{\s*display:\s*none;\s*\}/);
  });

  it("only ever shows the panel inside the reduced-motion guard, and only while animating", () => {
    const guardAt = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(guardAt, "expected a `prefers-reduced-motion: no-preference` guard").toBeGreaterThan(-1);

    // Every rule that reveals the panel must sit after the guard opens...
    for (const match of css.matchAll(/display:\s*(flex|block|grid)/g)) {
      expect(
        match.index,
        `a rule reveals the curtain outside the reduced-motion guard: "${match[0]}"`,
      ).toBeGreaterThan(guardAt);
    }
    // ...and the rule that reveals it must also be the rule that animates it away.
    const reveal = css.slice(guardAt).match(/\.mk-intro\s*\{[^}]*\}/);
    expect(reveal, "no `.mk-intro` rule inside the guard").not.toBeNull();
    expect(reveal![0], "the rule that shows the curtain must also lift it").toContain(
      "animation: mk-intro-lift",
    );
  });

  it("never lets the curtain swallow a press, in any state", () => {
    // Declared unconditionally, outside the guard — in the frames where this is fully opaque it
    // is sitting over the hero's own call to action.
    expect(css).toContain("pointer-events: none");
  });

  it("animates transform and opacity only", () => {
    // A curtain is the one element guaranteed to be animating during the browser's busiest
    // moment — first paint, font swap, image decode — so a property that costs a layout here
    // is paid for at the worst possible time.
    for (const block of css.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)) {
      for (const declaration of block[1]!.matchAll(/([a-z-]+)\s*:/g)) {
        expect(["opacity", "transform"]).toContain(declaration[1]);
      }
    }
  });

  it("stays a server component and imports no animation runtime", () => {
    expect(tsx).not.toMatch(/^\s*["']use client["'];?\s*$/m);
    expect(tsx).not.toMatch(/from "motion(\/react)?"/);
    // A timer-driven curtain is a blank page forever if the script throws or never hydrates.
    expect(withoutComments(tsx)).not.toMatch(/setTimeout|useEffect|useState/);
  });

  it("reads colour from `--mk-*` tokens, never a literal", () => {
    expect(withoutComments(tsx)).not.toMatch(COLOUR_LITERAL);
    expect(withoutComments(css)).not.toMatch(COLOUR_LITERAL);
  });
});

describe("IntroCurtain — how it is wired in", () => {
  const layout = read(ROOT_LAYOUT);
  const page = read(LANDING_PAGE);

  /**
   * ⚠ `document.body`, NOT `document.documentElement`. Setting the gate attribute on `<html>`
   * logged a React hydration mismatch on every load — React diffs the served shell against the
   * client tree and explicitly "won't patch up" an attribute the server never wrote. `<body>`
   * already carries `suppressHydrationWarning` for precisely this.
   */
  it("gates on the session from a blocking inline script that writes to <body>", () => {
    expect(layout).toContain("cb-intro-gate");
    expect(layout).toContain("sessionStorage");
    expect(layout).toContain("document.body.setAttribute('data-intro','play')");
    expect(
      layout,
      "writing the gate to <html> reopens the hydration mismatch this moved to fix",
    ).not.toContain("document.documentElement.setAttribute('data-intro'");
  });

  it("costs every other route one string comparison and nothing else", () => {
    // The script lives in the ROOT layout so it precedes the fixed nav as well as the page,
    // which means it also runs on the app and the auth flow. This is the early return.
    expect(layout).toContain("if(location.pathname!=='/')return;");
  });

  it("can be replayed on demand with `/?intro`, so it is reviewable", () => {
    // Without this the curtain is visible exactly once per browser session, which makes it
    // effectively impossible to review or demo. The switch reads the URL and persists nothing.
    expect(layout).toContain("/[?&]intro(=|&|$)/.test(location.search)");
  });

  it("can never leave a panel over the page when storage or scripting fails", () => {
    // A `catch` that swallows means the attribute is simply never set, the selector never
    // matches, and the reader gets the hero. Private-mode Safari and a locked-down enterprise
    // profile both land here.
    expect(layout).toMatch(/catch\s*\(\s*e\s*\)\s*\{\s*\}/);
  });

  it("mounts on the landing route only, and never as a Next.js loading.tsx", () => {
    expect(page).toContain("<IntroCurtain />");
    // `tests/e2e/marketing.spec.ts` asserts `/` ships no loading.tsx — "it is the one static
    // route" — and a splash is the single most tempting reason to add one.
    expect(page).not.toContain("loading.tsx");
  });
});
