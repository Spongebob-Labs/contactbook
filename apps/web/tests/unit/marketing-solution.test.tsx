import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { solution } from "@/fixtures/marketing";

import { Solution } from "@/components/marketing/solution";
import { renderWithProviders, screen, within } from "../helpers/render";

/**
 * The solution section, rebuilt again 2026-09-21 — see `solution.tsx`'s own header for the full
 * account of what changed (the segmented control is gone; a CSS-only loop demonstrates the
 * edit/sync/revoke story the tabs never showed) and why.
 *
 * Two kinds of assertion, the same convention `marketing-hero.test.tsx` established:
 *
 *   1. **Structure and content**, through Testing Library — the asymmetry is still real, the
 *      private field still never lights up, the demoed row's real (settled) value is
 *      accessible text, and its decorative flashback is not.
 *   2. **Source contracts**, through `readFileSync` — no colour literal, no `motion` import, no
 *      `"use client"` directive (the whole point of the CSS-only loop is that this stays a
 *      server component), and the segmented control it replaced is provably gone rather than
 *      merely unused.
 *
 * ⚠ No `matchMedia` mock and no `motion` mock. There is no JS motion of any kind here — the loop
 * is `@keyframes` plus `animation-iteration-count: infinite`, entirely in `marketing-solution
 * .css` — so there is nothing for either mock to stand in for, and happy-dom (which does not run
 * a cascade at all) cannot see the loop either way. What CAN be asserted in this environment is
 * the markup the loop and the reduced-motion default both read from, which is what the tests
 * below cover; the loop's own visual behaviour is `tests/e2e/marketing.spec.ts`'s to own.
 */

const DEMO_CARD = solution.cards[0]!;
const PRIVATE_FIELD = solution.profile.find((field) => "private" in field && field.private);

describe("Solution", () => {
  it("sets the heading and lead from the fixture", () => {
    renderWithProviders(<Solution />);
    expect(
      screen.getByRole("heading", { name: /Live contact cards, shared your way\./ }),
    ).toBeInTheDocument();
    expect(screen.getByText(solution.lead)).toBeInTheDocument();
  });

  it("renders both of the section's own paragraphs", () => {
    renderWithProviders(<Solution />);
    for (const paragraph of solution.paragraphs) {
      expect(screen.getByText(paragraph)).toBeInTheDocument();
    }
  });

  it("keeps the honesty paragraph — the fixture marks it load-bearing", () => {
    renderWithProviders(<Solution />);
    expect(screen.getByText(solution.honesty.term)).toBeInTheDocument();
    expect(screen.getByText(solution.honesty.detail)).toBeInTheDocument();
  });

  /**
   * ⚠ REWRITTEN 2026-09-21 (FIFTH). The exhibit is no longer a matrix — it is one band of
   * twelve labelled chips and three REAL `<CardPage>` renders beneath it. See `solution.tsx`'s
   * header for why a comparison grid was the wrong genre for this claim rather than a badly
   * drawn one.
   *
   * ⚠ **"ZERO BUTTONS" BECAME "NOTHING FOCUSABLE", AND THAT IS A CHANGE OF LETTER.** The rule
   * exists because attempt 2 failed by making a reader press something before the section meant
   * anything, and that intent is asserted below exactly as before. But the exhibit now renders
   * the product, and the product draws a real action and a real link per row — so "zero
   * buttons" can no longer express the rule without also banning the card. `<CardPageThumb>`
   * renders its whole subtree `inert`, which takes every control out of the tab order and the
   * accessibility tree together, so what a reader can actually reach is unchanged: nothing.
   */
  it("shows every card's asymmetry at rest, with no control to press first", () => {
    renderWithProviders(<Solution />);
    const exhibit = document.querySelector("[data-solution-exhibit]") as HTMLElement;
    expect(exhibit).not.toBeNull();

    // Nothing to operate: a reader who presses nothing must still understand the section.
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryAllByRole("tabpanel")).toHaveLength(0);

    const reachable = [...exhibit.querySelectorAll("a, button, input, select, textarea")].filter(
      (node) => node.closest("[inert]") === null,
    );
    expect(reachable, "the exhibit must hold nothing a reader can reach").toEqual([]);

    // One chip per profile field — the band is the WHOLE profile, and it is the first list.
    const [profileList] = within(exhibit).getAllByRole("list");
    expect(within(profileList).getAllByRole("listitem")).toHaveLength(solution.profile.length);

    // One card object per fixture card, all three present at once.
    const cards = exhibit.querySelectorAll("[data-solution-card]");
    expect(cards, "one card object per fixture card").toHaveLength(solution.cards.length);

    // The claim itself, not just the count: fewer on the card than in the profile, every time.
    for (const card of solution.cards) {
      expect(
        card.fields.length,
        `${card.name} carries the whole profile — the filter claim is empty for it`,
      ).toBeLessThan(solution.profile.length);
    }
  });

  /**
   * ⚠ THE EXHIBIT RENDERS THE PRODUCT, NOT A PICTURE OF IT — and this is the assertion the
   * whole rebuild turns on.
   *
   * Four previous passes drew the cards: two lists of words, then a segmented control, then one
   * card, then a grid of dots. All four were diagrams. `exampleCardSpecs` has carried three
   * finished, renderable cards matching these three palettes the whole time, and
   * `how-it-works.tsx` has rendered them for a month.
   *
   * `[data-card-root]` is `<CardPage>`'s own hook, so its presence inside each
   * `[data-solution-card]` is proof the real component rendered rather than a look-alike. The
   * three `data-palette-id` values must differ, because three repaints of one card would
   * satisfy every count above while showing nothing.
   */
  it("renders three real, genuinely different card pages — not a diagram of them", () => {
    renderWithProviders(<Solution />);
    const cards = [...document.querySelectorAll("[data-solution-card]")];

    const palettes = cards.map((card) => {
      const root = card.querySelector("[data-card-root]");
      expect(root, "a card column rendered no real card page").not.toBeNull();
      expect(root).toHaveAttribute("data-card-variant", "page");
      return root!.getAttribute("data-palette-id");
    });

    expect(new Set(palettes).size, "three repaints of one card is not three cards").toBe(
      solution.cards.length,
    );
  });

  /**
   * The band's whole argument is that the three cards DIFFER, so the one way this could go
   * silently wrong is every chip rendering the same membership while still looking plausible.
   * `Mobile` is on all three cards and `Bank account` is on none; between them they pin both
   * ends of the range, which no single chip can.
   */
  it("draws each card's own subset, not one subset repeated three times", () => {
    renderWithProviders(<Solution />);
    const chips = [...document.querySelectorAll("li[data-field-state]")];

    const chipFor = (label: string) => chips.find((li) => li.textContent?.includes(label));

    // Every card carries `mobile`, so its chip names all three in its screen-reader sentence
    // and stacks one lit overlay per card.
    const shared = chipFor("Mobile");
    expect(shared, "no Mobile chip").toBeTruthy();
    for (const card of solution.cards) {
      expect(shared!.textContent).toContain(card.name);
    }
    expect(shared!.querySelectorAll("[data-mk-walk-col]")).toHaveLength(solution.cards.length);

    // No card carries the private field, so its chip names none of them and never lights.
    const none = chipFor(PRIVATE_FIELD!.label);
    expect(none!.textContent).toContain("On no cards.");
    expect(none!.querySelectorAll("[data-mk-walk-col]")).toHaveLength(0);
  });

  /**
   * ⚠ The lit overlays duplicate their chip's own label so the fill can be a real painted box
   * rather than an animated colour — `@keyframes` here may only touch `opacity` and
   * `transform`. That duplication must never reach assistive tech, or a screen reader reads the
   * profile up to four times over.
   */
  it("keeps every lit overlay decorative, and one per card that carries the field", () => {
    renderWithProviders(<Solution />);

    const overlays = [...document.querySelectorAll("li[data-field-state] [data-mk-walk-col]")];
    // Derived from the fixture, never typed: the total is the sum of every card's field count.
    const expected = solution.cards.reduce((n, card) => n + card.fields.length, 0);
    expect(overlays).toHaveLength(expected);
    for (const node of overlays) {
      expect(node).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("tags the private field and never marks it included", () => {
    renderWithProviders(<Solution />);
    expect(PRIVATE_FIELD, "the fixture is expected to carry one private field").toBeTruthy();
    expect(DEMO_CARD.fields).not.toContain(PRIVATE_FIELD!.id);

    const chips = [...document.querySelectorAll("li[data-field-state]")];
    const privateChip = chips.find((li) => li.textContent?.includes(PRIVATE_FIELD!.label));
    expect(privateChip, "no private chip found").toBeTruthy();
    expect(privateChip).toHaveAttribute("data-field-state", "private");
    // The tag renders, unconditionally — the strongest trust claim on the page.
    expect(screen.getByText(solution.privateTag)).toBeInTheDocument();
  });

  /** Once per card — each carries its own count, computed against the whole profile rather
   *  than typed, so a fixture edit cannot make it lie. */
  it("computes every card's field count against the whole profile, never hand-typed", () => {
    renderWithProviders(<Solution />);
    for (const card of solution.cards) {
      expect(
        screen.getByText(`${card.fields.length} of ${solution.profile.length}`),
        `no count rendered for ${card.name}`,
      ).toBeInTheDocument();
    }
  });

  /**
   * ⚠ THE EDIT AND REVOKE BEATS ARE GONE, AND THIS ASSERTS THAT RATHER THAN MOURNING IT.
   *
   * Both lived in the matrix and both were performed on 8px dots: a value flickering to an
   * older one, a cell taking a struck line and an "Off" pill. Neither was legible, and between
   * them they were most of the eleven beats that produced "what are these dots".
   *
   * They are removed, not lost. `solution.paragraphs[1]` still makes the live claim in prose,
   * `honesty` qualifies it, and `how-it-works` steps 04 and 05 are about exactly those two
   * things. An exhibit that tries to carry three claims lands none — which is the lesson of
   * attempts 1 and 4 both. The live edit deserves an object of its own.
   */
  it("no longer performs the edit or revoke beats inside this exhibit", () => {
    renderWithProviders(<Solution />);
    for (const hook of [
      "[data-mk-demo-value]",
      "[data-mk-demo-flash]",
      "[data-mk-demo-strike]",
      "[data-mk-demo-off-pill]",
      "[data-mk-demo-dim]",
    ]) {
      expect(document.querySelectorAll(hook), `${hook} survived the rebuild`).toHaveLength(0);
    }
  });

  it("no longer ships a segmented control, a pinned runway or scroll-linked beats", () => {
    const { container } = renderWithProviders(<Solution />);
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.querySelector(".mk-solution-runway")).toBeNull();
    expect(container.querySelectorAll("[data-beat]")).toHaveLength(0);
  });
});

describe("source hygiene", () => {
  const MARKETING_DIR = resolve(process.cwd(), "src/components/marketing");
  const source = readFileSync(resolve(MARKETING_DIR, "solution.tsx"), "utf8");
  const css = readFileSync(resolve(process.cwd(), "src/styles/marketing-solution.css"), "utf8");

  /** Strips comments before a "no literal" scan — this codebase cites token names, not hex
   *  values, in its comments, but the guard is cheap and matches `marketing-hero.test.tsx`. */
  function withoutComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
  }

  const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|(?<!--mk-\w*-)\b(?:rgb|rgba|hsl|hsla)\(/;

  it("never writes a colour literal — every colour is read from an `--mk-*` token", () => {
    expect(withoutComments(source)).not.toMatch(COLOUR_LITERAL);
    expect(withoutComments(css)).not.toMatch(COLOUR_LITERAL);
  });

  it("does not import the app's `cn` or reach for an app-chrome colour utility", () => {
    expect(source).not.toMatch(/from "@\/lib\/cn"/);
    expect(source).not.toMatch(
      /\b(?:text|bg|border)-(?:ink|ink-2|ink-3|ink-4|canvas|surface|surface-sunk|accent|line)\b/,
    );
  });

  it("stays a server component — the loop is CSS, not `motion/react`, so no `\"use client\"` is needed", () => {
    expect(source).not.toMatch(/^\s*["']use client["'];?\s*$/m);
    expect(source).not.toMatch(/from "motion"/);
    expect(source).not.toMatch(/from "motion\/react"/);
  });

  it("no longer ships the segmented control or the pinned sequence either replaced", () => {
    expect(
      existsSync(resolve(MARKETING_DIR, "pinned-sequence.tsx")),
      "pinned-sequence.tsx should be deleted, not left as a dead component",
    ).toBe(false);
    expect(source).not.toMatch(/from ".\/pinned-sequence"/);
    expect(source).not.toMatch(/role="tab"/);
    // Comments are stripped first — header prose *describes* mechanisms this file replaced,
    // in words, which would otherwise trip these exact checks on themselves.
    expect(withoutComments(source)).not.toMatch(/position:\s*sticky/);
    expect(withoutComments(css)).not.toMatch(/position:\s*sticky/);
  });

  it("keeps every animated property to transform or opacity, and gates travel behind reduced motion", () => {
    const body = withoutComments(css);
    // Crude but effective: strip the two legal properties out of every declaration block and
    // make sure nothing else is being *animated* — i.e. no other property sits inside an
    // `@keyframes` block.
    const keyframeBlocks = [...body.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)].map((m) => m[1]!);
    for (const block of keyframeBlocks) {
      const declared = [...block.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const prop of declared) {
        expect(["opacity", "transform"]).toContain(prop);
      }
    }
    expect(body).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
  });
});
