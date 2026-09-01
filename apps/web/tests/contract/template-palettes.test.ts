import { describe, expect, it } from "vitest";

import { contrastRatio, relativeLuminance } from "@/lib/contrast";
import {
  PALETTE_CONTRACT,
  PALETTE_ORDER,
  TEMPLATE_PALETTES,
  gradientStops,
  paletteVars,
  type PaletteId,
  type TemplatePalette,
} from "@/card/template-palettes";
import { TOKENS } from "@/lib/tokens";

/**
 * The rule that replaced "no colour outside tokens.css".
 *
 * The previous build guaranteed legibility by forbidding template colour outright, which
 * also forbade template variety — eight templates drawing on the same eight app-chrome
 * tokens produced eight versions of one cream card. This suite lets a palette be as loud
 * as it likes and then proves, arithmetically, that everything on it can still be read.
 *
 * Every ratio is computed from the hex values with `src/lib/contrast.ts`, so a palette
 * edit that breaks a pair fails here rather than in review — or, worse, in production on
 * somebody's card.
 */

const HEX = /^#[0-9A-F]{6}$/;

const entries = Object.entries(TEMPLATE_PALETTES) as [PaletteId, TemplatePalette][];

describe("every palette is well-formed", () => {
  it("registers every id in PALETTE_ORDER exactly once", () => {
    expect([...PALETTE_ORDER].sort()).toEqual(Object.keys(TEMPLATE_PALETTES).sort());
    expect(new Set(PALETTE_ORDER).size).toBe(PALETTE_ORDER.length);
  });

  it.each(entries)("%s keys itself consistently", (id, p) => {
    expect(p.id).toBe(id);
    expect(p.name.length).toBeGreaterThan(0);
  });

  /**
   * Uppercase six-digit hex, uniformly. Three-digit and lowercase forms are both valid CSS
   * and would both work, but a mixed file makes the drift check below unreliable and makes
   * two identical colours look different in a diff.
   */
  it.each(entries)("%s declares every colour as #RRGGBB", (_id, p) => {
    const colours: (keyof TemplatePalette)[] = [
      "ground",
      "ink",
      "inkSoft",
      "line",
      "buttonBg",
      "buttonInk",
      "buttonAltBg",
      "buttonAltInk",
      "buttonAltBorder",
      "markBg",
      "markInk",
    ];
    for (const key of colours) {
      expect(p[key], `${p.id}.${key}`).toMatch(HEX);
    }
    for (const key of ["gradientFrom", "gradientTo"] as const) {
      expect(p[key], `${p.id}.${key}`).toMatch(HEX);
    }
    /* A one-stop "gradient" is a flat fill wearing a gradient's API — and it would pass every
       `allStops` assertion vacuously, since both stops would be the same colour. */
    expect(p.gradientFrom, `${p.id} gradient has no range`).not.toBe(p.gradientTo);
    expect(p.gradientAngle, `${p.id} gradient angle`).toBeGreaterThanOrEqual(0);
    expect(p.gradientAngle, `${p.id} gradient angle`).toBeLessThan(360);

    /* `ground` is the flat representative and must sit inside the gradient's own range, or the
       exporter and the canvas-action fill are painting a colour the card never shows. */
    const lum = (h: string) => relativeLuminance(h);
    const lo = Math.min(lum(p.gradientFrom), lum(p.gradientTo));
    const hi = Math.max(lum(p.gradientFrom), lum(p.gradientTo));
    expect(lum(p.ground), `${p.id}.ground sits outside its own gradient`).toBeGreaterThanOrEqual(
      lo - 0.001,
    );
    expect(lum(p.ground), `${p.id}.ground sits outside its own gradient`).toBeLessThanOrEqual(
      hi + 0.001,
    );

    /* The two nullable slots are either absent or a real colour — never `''`. */
    for (const key of ["groundAlt", "plateBorder"] as const) {
      const v = p[key];
      if (v !== null) expect(v, `${p.id}.${key}`).toMatch(HEX);
    }
  });
});

describe("every palette is legible", () => {
  /**
   * The cross product: eight palettes × eight promised relationships. Named per pair so a
   * failure reads "cobalt — inkSoft on ground: 4.12 < 4.5" instead of naming two hex codes
   * and leaving the reader to work out which is which.
   */
  for (const [id, p] of entries) {
    for (const pair of PALETTE_CONTRACT) {
      it(`${id} — ${pair.label} clears ${pair.min}:1`, () => {
        /* `allStops` evaluates against every gradient stop instead of the ground midpoint.
           This is the assertion that makes the suite gradient-aware: a ground that is legible
           in the middle and illegible at one end passes a midpoint check and fails here. */
        const grounds = pair.allStops === true ? gradientStops(p) : [pair.bg(p)];
        const candidates = pair.fg(p);
        const foregrounds = Array.isArray(candidates) ? candidates : [candidates];

        /* Worst ground, best foreground. Worst ground because every stop is painted; best
           foreground because the `fg`-as-list contract means any one of them may satisfy the
           pair — an outline button is satisfied by its border even though its fill measures
           1.00 against the ground it is drawn on. */
        const perGround = grounds.map((bg) => ({
          bg,
          best: Math.max(...foregrounds.map((fg) => contrastRatio(fg, bg))),
        }));
        const weakest = perGround.reduce((a, b) => (a.best <= b.best ? a : b));

        expect(
          Number(weakest.best.toFixed(2)),
          `${id}: ${pair.label} measured ${weakest.best.toFixed(2)} on its weakest ground ` +
            `(${weakest.bg}), needs ${pair.min}`,
        ).toBeGreaterThanOrEqual(pair.min);
      });
    }
  }

  /**
   * A split-ground template runs the same inks over `groundAlt`, so both inks must clear
   * the floor on it too. Skipped rather than passed vacuously when a palette is single-zone.
   */
  it.each(entries.filter(([, p]) => p.groundAlt !== null))(
    "%s — inks clear 4.5:1 on groundAlt too",
    (id, p) => {
      const alt = p.groundAlt as string;
      expect(Number(contrastRatio(p.ink, alt).toFixed(2)), `${id} ink`).toBeGreaterThanOrEqual(4.5);
      expect(
        Number(contrastRatio(p.inkSoft, alt).toFixed(2)),
        `${id} inkSoft`,
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe("the QR contract is palette-independent", () => {
  /**
   * The single most important assertion in this file. A QR is a functional optical target,
   * not decoration: the plate is an opaque white and the modules near-black on EVERY
   * palette, Carbon included. Many decoders reject inverted symbols outright, so a template
   * is never permitted to tint either one — which is why neither appears in
   * `TemplatePalette` at all, and why this test asserts against `TOKENS` instead.
   */
  it("holds module-to-plate contrast far above the 15:1 floor", () => {
    const ratio = contrastRatio(TOKENS["qr-module"], TOKENS["qr-plate"]);
    expect(ratio).toBeGreaterThanOrEqual(15);
  });

  it("gives no palette a way to tint the plate or the modules", () => {
    for (const [id, p] of entries) {
      const fields = Object.keys(p);
      expect(fields, id).not.toContain("plate");
      expect(fields, id).not.toContain("qrModule");
    }
  });

  /**
   * `plateBorder` exists for exactly one situation: a white plate on a near-white ground,
   * which dissolves without an edge. Any palette whose ground is far enough from white to
   * frame the plate itself must leave it `null`, or the card grows a hairline it does not
   * need. 1.5:1 is the threshold at which the plate stops being self-evident.
   */
  it("sets plateBorder only where a white plate would dissolve into the ground", () => {
    for (const [id, p] of entries) {
      /* Measured against the LIGHTEST stop, which is where a white plate is closest to
         vanishing. The midpoint would let a card whose top end is nearly white pass. */
      const lightest = gradientStops(p).reduce((a, b) =>
        contrastRatio(TOKENS["qr-plate"], a) <= contrastRatio(TOKENS["qr-plate"], b) ? a : b,
      );
      const plateOnGround = contrastRatio(TOKENS["qr-plate"], lightest);
      if (plateOnGround < 1.5) {
        expect(p.plateBorder, `${id}: plate is ${plateOnGround.toFixed(2)} on ground`).not.toBeNull();
      } else {
        expect(p.plateBorder, `${id}: plate is ${plateOnGround.toFixed(2)} on ground`).toBeNull();
      }
    }
  });
});

describe("paletteVars", () => {
  it.each(entries)("%s emits a valid colour for every custom property", (_id, p) => {
    const vars = paletteVars(p);
    for (const [name, value] of Object.entries(vars)) {
      expect(name).toMatch(/^--c-[a-z-]+$/);

      /* `--c-ground-gradient` is a `linear-gradient()`, not a colour — asserted on separately
         below so this sweep stays a colour check rather than a "looks like CSS" check. */
      if (name === "--c-ground-gradient") {
        expect(value, name).toMatch(
          /^linear-gradient\(\d{1,3}deg, #[0-9A-F]{6} 0%, #[0-9A-F]{6} 100%\)$/,
        );
        continue;
      }

      /* `transparent` is the sanctioned non-hex value: an absent plate border must still be
         a valid colour or the `border` shorthand becomes invalid and the browser drops the
         whole declaration, taking the border of the palettes that DO set one with it. */
      expect(value === "transparent" || HEX.test(value), `${name}=${value}`).toBe(true);
    }
  });

  it("falls back to ground when a palette has no groundAlt", () => {
    const solid = entries.find(([, p]) => p.groundAlt === null)?.[1] as TemplatePalette;
    expect(paletteVars(solid)["--c-ground-alt"]).toBe(solid.ground);
  });
});
