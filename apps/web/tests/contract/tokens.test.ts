import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BODY_TEXT_INKS,
  DECORATIVE_ONLY,
  TEXT_GROUNDS,
  TOKENS,
  cssVar,
  type ColourToken,
} from "@/lib/tokens";
import { contrastRatio } from "@/lib/contrast";

/**
 * `tokens.css` and `tokens.ts` must not drift.
 *
 * The stylesheet is what the browser paints. The TypeScript mirror is what the contrast
 * tests, the OpenGraph route (Satori resolves no custom properties) and the PNG exporter
 * read. Two sources of truth for one palette is a bug waiting to happen, so this suite makes
 * them one source with a compiler between them.
 *
 * The check runs in both directions deliberately:
 *   forward — every entry in `TOKENS` resolves to the same colour in the stylesheet;
 *   reverse — every colour literal declared in the stylesheet appears in `TOKENS`.
 *
 * Without the reverse leg someone could add `--brand: #7C3AED` to the stylesheet and no test
 * would notice, which is exactly the drift this exists to prevent.
 *
 * Scope note: this file covers APP CHROME only. Template colour lives in
 * `src/card/template-palettes.ts` and has its own, stricter suite — the two systems are
 * separate on purpose, and the previous build's mistake was merging them.
 */

// Vitest's root is `apps/web`, so a cwd-relative path is stable whether the suite is launched
// from the package or through `pnpm --filter web`.
const TOKENS_CSS = resolve(process.cwd(), "src/styles/tokens.css");
if (!existsSync(TOKENS_CSS)) {
  throw new Error(`tokens.css not found at ${TOKENS_CSS} — is the test running from apps/web?`);
}
const css = readFileSync(TOKENS_CSS, "utf8");

/** `--name: #RRGGBB;` — hex declarations only. Aliases and non-colours are handled below. */
const HEX_DECL = /^\s*--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{3,8})\s*;/gm;

function declaredHexes(): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, name, value] of css.matchAll(HEX_DECL)) {
    found.set(name, value.toUpperCase());
  }
  return found;
}

/** `--name: var(--other);` — the one level of aliasing the stylesheet uses. */
function declaredAliases(): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, name, target] of css.matchAll(/^\s*--([a-z0-9-]+):\s*var\(--([a-z0-9-]+)\)\s*;/gm)) {
    found.set(name, target);
  }
  return found;
}

const hexes = declaredHexes();
const aliases = declaredAliases();

/** Resolves one level of aliasing, which is all `tokens.css` ever uses. */
function resolveToken(name: string): string | undefined {
  const direct = hexes.get(name);
  if (direct !== undefined) return direct;
  const alias = aliases.get(name);
  return alias === undefined ? undefined : hexes.get(alias);
}

const entries = Object.entries(TOKENS) as [ColourToken, string][];

describe("tokens.ts mirrors tokens.css", () => {
  it.each(entries)("%s is declared in the stylesheet with the same value", (name, value) => {
    const declared = resolveToken(name);
    expect(declared, `--${name} is missing from tokens.css`).toBeDefined();
    expect(declared).toBe(value.toUpperCase());
  });

  /**
   * The reverse leg. Names listed here are declared in the stylesheet and deliberately absent
   * from the mirror, each for a stated reason — anything else appearing in the stylesheet
   * fails, which is what makes an undeclared new colour impossible to sneak in.
   */
  it("declares no colour in the stylesheet that the mirror does not know about", () => {
    const NOT_MIRRORED = new Set([
      // Focus rings are composed from --ink and white; neither is a new colour.
      "focus-offset",
    ]);

    const known = new Set<string>(Object.keys(TOKENS));
    const unexplained = [...hexes.keys()].filter(
      (name) => !known.has(name) && !NOT_MIRRORED.has(name),
    );

    expect(unexplained, `undeclared colours in tokens.css: ${unexplained.join(", ")}`).toEqual([]);
  });

  it("exposes every token as a custom-property reference", () => {
    for (const [name] of entries) {
      expect(cssVar(name)).toBe(`var(--${name})`);
    }
  });
});

describe("the app chrome is legible", () => {
  /**
   * Every ink the system permits for body text, on every ground it permits, at AA. This is
   * the cross product rather than a spot check, because the failure mode is always the pair
   * nobody thought to check — `--ink-3` on `--surface-sunk` rather than on white.
   */
  for (const ink of BODY_TEXT_INKS) {
    for (const ground of TEXT_GROUNDS) {
      it(`${ink} on ${ground} clears 4.5:1`, () => {
        const ratio = contrastRatio(TOKENS[ink], TOKENS[ground]);
        expect(Number(ratio.toFixed(2))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("keeps the accent's own label legible on it", () => {
    expect(contrastRatio(TOKENS["accent-ink"], TOKENS.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(TOKENS["accent-ink"], TOKENS["accent-hover"])).toBeGreaterThanOrEqual(4.5);
  });

  it("holds control boundaries at the 3:1 non-text floor", () => {
    // WCAG 1.4.11. `--line` is exempt and is asserted NOT to be used here — see below.
    for (const ground of TEXT_GROUNDS) {
      const ratio = contrastRatio(TOKENS["line-control"], TOKENS[ground]);
      expect(Number(ratio.toFixed(2)), `line-control on ${ground}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps every signal colour readable on its own wash", () => {
    const pairs: [ColourToken, ColourToken][] = [
      ["danger", "danger-wash"],
      ["warning-ink", "warning-wash"],
      ["success", "success-wash"],
    ];
    for (const [ink, wash] of pairs) {
      const ratio = contrastRatio(TOKENS[ink], TOKENS[wash]);
      expect(Number(ratio.toFixed(2)), `${ink} on ${wash}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * The guard on the two colours that look usable and are not. `--ink-4` measures 2.53:1 on
   * white and `--line` 1.24:1; both are correct for what they do (disabled states, decorative
   * hairlines) and both would fail as text. Naming them here means a future edit that promotes
   * one to body ink has to delete an assertion to do it.
   */
  it("keeps decorative-only colours out of the body-text set", () => {
    for (const name of DECORATIVE_ONLY) {
      expect(BODY_TEXT_INKS as readonly string[]).not.toContain(name);
      expect(contrastRatio(TOKENS[name], TOKENS.canvas)).toBeLessThan(4.5);
    }
  });
});

describe("the QR optical constants", () => {
  it("clear the 15:1 module-to-plate floor with room to spare", () => {
    // Far above WCAG, deliberately: scanners binarise the image, and margin is cheap.
    expect(contrastRatio(TOKENS["qr-module"], TOKENS["qr-plate"])).toBeGreaterThanOrEqual(15);
  });

  it("keep the plate white, never inverted", () => {
    // Not a stylistic preference. Many decoder implementations reject a symbol with light
    // modules on a dark plate outright, so the plate is white on every template including
    // Midnight, whose ground is black.
    expect(TOKENS["qr-plate"]).toBe("#FFFFFF");
  });
});
