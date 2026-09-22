import { describe, expect, it } from "vitest";

import { LEGIBILITY_DEAD_BAND, FINISH_ORDER, type SurfaceStyle } from "@/card/card-surface";
import { derivePalette } from "@/card/derive-palette";
import {
  PALETTE_CONTRACT,
  PALETTE_ORDER,
  TEMPLATE_PALETTES,
  gradientStops,
  type PalettePair,
  type TemplatePalette,
} from "@/card/template-palettes";
import { contrastRatio, parseHex, relativeLuminance } from "@/lib/contrast";

/**
 * The proof behind "the owner may pick any colour".
 *
 * `tests/contract/template-palettes.test.ts` proves nine hand-authored palettes are legible.
 * That is nine points. This file proves the *engine* is legible — that `derivePalette` cannot
 * produce an unreadable card from any input at all — because free colour turns a finite set of
 * reviewed palettes into a continuous space nobody can review.
 *
 * The headline is the sweep below. Everything after it is a guard on one specific way the
 * search could be wrong while still passing the sweep.
 *
 * Ratios are measured with the real `contrastRatio`, never with anything the module under test
 * exports, and compared **raw** rather than rounded to two decimals the way the preset suite
 * does. A derived palette should clear its contract outright, so tightening the preset suite
 * later cannot retroactively invalidate colours already on people's cards.
 *
 * ## What this suite was proven to catch
 *
 * Three guards in `derive-palette.ts` were deliberately broken and the suite re-run. Recorded
 * here because the third result is the reason a whole `describe` block exists that looks, at
 * first reading, like it duplicates `PALETTE_CONTRACT`:
 *
 * | broken guard | caught by |
 * |---|---|
 * | the clamp — dead-band colours passed straight through | 11 tests: all five sweeps, the byte-resolution walk, and every clamp assertion |
 * | the `inkSoft` search — scored *nearest* to `ink` instead of furthest | 8 tests, **all of them in "the two ink levels stay two ink levels"** |
 * | the legal window on the stops — span spent without a cap | 6 tests: all five sweeps and the byte-resolution walk |
 *
 * The middle row is the finding. Collapsing `inkSoft` onto `ink` produced a card whose role tag
 * is the same colour as the name, and **every pair in `PALETTE_CONTRACT` still passed** — the
 * contract only ever compares a foreground to a background, so a secondary ink that has become
 * the primary satisfies it perfectly. Without the block below, the sweep would have declared
 * that palette legible.
 */

/* ── The grid ────────────────────────────────────────────────────────────────────────── */

/**
 * An independent HSL→hex, written here rather than imported.
 *
 * The module under test converts colour spaces too. Importing its conversion to build the
 * inputs would let one bug cancel itself out: a skewed `hslToRgb` would generate skewed test
 * colours and then be handed exactly the colours it is wrong about. Two implementations that
 * agree is evidence; one implementation checking itself is not.
 */
function hslHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const sector = Math.floor(h / 60) % 6;
  const rgb: [number, number, number] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sector] as [number, number, number];
  return (
    "#" +
    rgb
      .map((v) =>
        Math.min(255, Math.max(0, Math.round((v + m) * 255)))
          .toString(16)
          .toUpperCase()
          .padStart(2, "0"),
      )
      .join("")
  );
}

/**
 * Hue × saturation × lightness, walked by a pure loop.
 *
 * No `Math.random`. A randomised sweep finds a failure once and then cannot reproduce it, which
 * is the worst possible property for the test that decides whether a colour system is safe to
 * ship. Every axis is chosen to cross a boundary the engine cares about:
 *
 * · **Hues** every 30°, so each of the six RGB sectors is entered and left. Sector arithmetic is
 *   where a hue conversion goes wrong.
 * · **Saturations** include 0 — a pure grey, where hue is undefined and every derived ray
 *   collapses to a neutral ramp — and 1, where a ray has the least room to move before it clips.
 * · **Lightnesses** straddle the dead band from both directions and include near-black and
 *   near-white, the two ends where a stop or a search has nowhere left to go.
 */
const HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const SATURATIONS = [0, 0.25, 0.55, 0.85, 1];
const LIGHTNESSES = [
  0.02, 0.06, 0.12, 0.18, 0.24, 0.3, 0.35, 0.4, 0.45, 0.52, 0.6, 0.68, 0.78, 0.88, 0.96,
];

const SWEEP: readonly string[] = Object.freeze(
  HUES.flatMap((h) => SATURATIONS.flatMap((s) => LIGHTNESSES.map((l) => hslHex(h, s, l)))),
);

/* ── The contract, evaluated exactly as the preset suite evaluates it ────────────────── */

interface Measurement {
  ratio: number;
  ground: string;
}

/**
 * Worst ground, best foreground — the same reduction `template-palettes.test.ts` performs.
 *
 * Worst ground because every stop is painted and the weak end is the one that fails in the
 * wild. Best foreground because `PalettePair.fg` may return a list, and a list means "any one
 * of these satisfies the pair" — an outline button's fill measures 1.00 against the ground it
 * is drawn on and is satisfied entirely by its border.
 */
function measure(pair: PalettePair, p: TemplatePalette): Measurement {
  const grounds = pair.allStops === true ? gradientStops(p) : [pair.bg(p)];
  const candidates = pair.fg(p);
  const foregrounds = Array.isArray(candidates) ? candidates : [candidates as string];
  return grounds
    .map((ground) => ({
      ground,
      ratio: Math.max(...foregrounds.map((fg) => contrastRatio(fg, ground))),
    }))
    .reduce((a, b) => (a.ratio <= b.ratio ? a : b));
}

function contractFailures(p: TemplatePalette, label: string): string[] {
  const failures: string[] = [];
  for (const pair of PALETTE_CONTRACT) {
    const m = measure(pair, p);
    if (!(m.ratio >= pair.min)) {
      failures.push(
        `${label}: "${pair.label}" measured ${m.ratio.toFixed(3)} on ${m.ground}, needs ${pair.min}`,
      );
    }
  }
  return failures;
}

const HEX6 = /^#[0-9A-F]{6}$/;

/** Every slot that must be an uppercase six-digit hex, with no nullable slots among them. */
const OPAQUE_SLOTS: readonly (keyof TemplatePalette)[] = [
  "ground",
  "gradientFrom",
  "gradientTo",
  "ink",
  "inkSoft",
  "line",
  "buttonBg",
  "buttonInk",
  "buttonAltBg",
  "buttonAltInk",
  "buttonAltBorder",
  "canvasActionBg",
  "canvasActionInk",
  "markBg",
  "markInk",
];

/**
 * The structural promises, restated from `template-palettes.test.ts` so a derived palette is
 * held to the same shape as an authored one — and so `derivePalette` can be handed straight to
 * `paletteVars` without a renderer discovering the difference.
 */
function shapeFailures(p: TemplatePalette, label: string): string[] {
  const failures: string[] = [];
  for (const key of OPAQUE_SLOTS) {
    if (!HEX6.test(p[key] as string)) failures.push(`${label}: ${key} is "${String(p[key])}"`);
  }
  for (const key of ["faceBorder", "plateBorder", "groundAlt"] as const) {
    const v = p[key];
    if (v !== null && !HEX6.test(v)) failures.push(`${label}: ${key} is "${String(v)}"`);
  }
  /* A one-stop gradient is a flat fill wearing a gradient's API, and it would satisfy every
     `allStops` pair vacuously by having only one stop to satisfy. */
  if (p.gradientFrom === p.gradientTo) failures.push(`${label}: gradient has no range`);
  if (!(p.gradientAngle >= 0 && p.gradientAngle < 360)) {
    failures.push(`${label}: gradient angle ${p.gradientAngle}`);
  }
  /* `ground` is the flat representative — the PNG exporter and the canvas-action fill paint it —
     so a ground outside its own gradient means those two paint a colour the card never shows. */
  const lo = Math.min(relativeLuminance(p.gradientFrom), relativeLuminance(p.gradientTo));
  const hi = Math.max(relativeLuminance(p.gradientFrom), relativeLuminance(p.gradientTo));
  const g = relativeLuminance(p.ground);
  if (g < lo || g > hi) {
    failures.push(`${label}: ground L=${g.toFixed(4)} outside gradient [${lo.toFixed(4)}, ${hi.toFixed(4)}]`);
  }
  return failures;
}

/* ── The headline ────────────────────────────────────────────────────────────────────── */

describe("the sweep — every colour, every style, every pair", () => {
  it("covers 900 colours across the whole cube", () => {
    expect(SWEEP.length).toBe(HUES.length * SATURATIONS.length * LIGHTNESSES.length);
    expect(SWEEP.length).toBe(900);
    /* The grid has to actually straddle the band, or the clamp is never exercised by it. */
    const inBand = SWEEP.filter((hex) => {
      const l = relativeLuminance(hex);
      return l > LEGIBILITY_DEAD_BAND.min && l < LEGIBILITY_DEAD_BAND.max;
    });
    expect(inBand.length).toBeGreaterThan(50);
  });

  /**
   * 900 colours × 5 styles = 4,500 palettes × 11 contract pairs, every ratio measured.
   *
   * Reported as one assertion per finish rather as fifty thousand test cases: a failure list
   * names the colour, the pair and the measurement, which is what a person needs, and a sweep
   * that took a minute to *report* would be a sweep someone eventually shrinks.
   */
  it.each(FINISH_ORDER)("%s — every derived palette satisfies PALETTE_CONTRACT", (finish) => {
    const failures: string[] = [];
    for (const hex of SWEEP) {
      const { palette } = derivePalette(hex, finish);
      failures.push(...contractFailures(palette, `${hex}/${finish}`));
      failures.push(...shapeFailures(palette, `${hex}/${finish}`));
    }
    expect(failures.slice(0, 12), `${failures.length} failures`).toEqual([]);
  });

  /**
   * The same promise at byte resolution, where the engine has the least room.
   *
   * A grid can step straight over the two lightnesses at which a hue crosses the dead band, and
   * those crossings are exactly where the clamp, the legal window and the stop placement all
   * bind at once. This walk cannot step over them: it visits every 1/256 of the lightness axis
   * on six hues at two saturations, so each crossing is sampled from both sides at the finest
   * resolution the 8-bit ray has. The first version of the engine derived the stops from the
   * clamped ground's re-measured saturation instead of the ray it was clamped along, and that
   * bug lived in exactly this neighbourhood.
   *
   * ⚠ **An explicit 20s budget, because the CONTRACT grew and this walk pays for all of it.**
   * It derives 3,084 palettes and evaluates every `PALETTE_CONTRACT` pair against each. The
   * 2026-09-18 card rebuild added five pairs — the sheet's two app inks, the two accents and the
   * action fill, all measured on the paper each card is actually read on — which is roughly a
   * third more work per palette and took the walk past vitest's 5s default.
   *
   * The budget is raised rather than the walk narrowed. Byte resolution is the point of this
   * test: the crossings it exists to sample are one 1/256 step wide, and a coarser sweep steps
   * straight over the neighbourhood the engine's first real bug lived in. Trading that coverage
   * for seconds would be trading the only thing here that has ever caught anything.
   */
  it("holds at byte resolution straight through both band edges", () => {
    const failures: string[] = [];
    let walked = 0;
    for (const h of [0, 60, 120, 180, 240, 300]) {
      for (const s of [0.4, 1]) {
        for (let i = 0; i <= 256; i++) {
          const hex = hslHex(h, s, i / 256);
          const { palette } = derivePalette(hex, "gradient");
          walked += 1;
          failures.push(...contractFailures(palette, hex));
          failures.push(...shapeFailures(palette, hex));
        }
      }
    }
    expect(walked).toBe(6 * 2 * 257);
    expect(failures.slice(0, 12), `${failures.length} failures`).toEqual([]);
  }, 20_000);
});

/* ── The one promise PALETTE_CONTRACT cannot make ────────────────────────────────────── */

describe("the two ink levels stay two ink levels", () => {
  /**
   * ⚠ This is the hole in `PALETTE_CONTRACT`, and the reason it needs covering here.
   *
   * The contract asks `inkSoft` to clear 4.5 on every stop. Setting `inkSoft = ink` satisfies
   * that perfectly — the primary clears 7 — and produces a card whose role tag, labels and bio
   * are the same colour as the name. Every pair passes and the type hierarchy the format depends
   * on is gone. The contract cannot catch it because it only ever compares a foreground to a
   * background, never one foreground to another.
   *
   * So `inkSoft` is asserted two ways. **Separated:** it must be visibly a second level.
   * **Extremal:** its own measurement on its worst stop must sit *just* above 4.5, because any
   * headroom it has left over is headroom it should have spent moving further from the primary.
   * A search that returned a safe middle colour would clear the floor by a mile and fail here —
   * which is the whole difference between "derive by search" and "derive by a formula that
   * happens to work".
   */
  const probes = ["#142C63", "#0D3C2E", "#181A1F", "#E1AA40", "#B4C1EC", "#BFD48C", "#FFFFFF"];

  it.each(probes)("%s keeps the name and the role tag apart", (hex) => {
    const p = derivePalette(hex, "gradient").palette;
    expect(p.inkSoft).not.toBe(p.ink);
    /* Onyx, the most separated preset, runs 3.28; Clay, the least, runs 1.52. */
    expect(contrastRatio(p.ink, p.inkSoft)).toBeGreaterThanOrEqual(1.4);
  });

  it("spends inkSoft's whole allowance across the sweep", () => {
    const failures: string[] = [];
    let worstSlack = 0;
    for (const hex of SWEEP) {
      const p = derivePalette(hex, "gradient").palette;
      const measured = measure(
        PALETTE_CONTRACT.find((c) => c.label.startsWith("inkSoft")) as PalettePair,
        p,
      ).ratio;
      if (measured < 4.5) failures.push(`${hex}: inkSoft measured ${measured.toFixed(3)}`);
      /* The slack is bounded by the ray's own resolution: one 8-bit step is the smallest move
         the search can make, so it cannot land exactly on 4.500. Anything much beyond that is
         a search that stopped early. */
      if (measured - 4.5 > worstSlack) worstSlack = measured - 4.5;
      if (measured > 4.7) failures.push(`${hex}: inkSoft left ${(measured - 4.5).toFixed(3)} unspent`);
      if (p.inkSoft === p.ink) failures.push(`${hex}: inkSoft collapsed onto ink`);
    }
    expect(failures.slice(0, 12), `${failures.length} failures`).toEqual([]);
    expect(worstSlack, "measured 0.070 across the sweep when written").toBeLessThan(0.15);
  });
});

/* ── The clamp ───────────────────────────────────────────────────────────────────────── */

const inBand = (hex: string) => {
  const l = relativeLuminance(hex);
  return l > LEGIBILITY_DEAD_BAND.min && l < LEGIBILITY_DEAD_BAND.max;
};

describe("the clamp — freedom with a floor", () => {
  const banded = SWEEP.filter(inBand);
  const legal = SWEEP.filter((hex) => {
    const l = relativeLuminance(hex);
    /* A hair inside each edge. The engine adds a margin to every threshold so a ground cannot
       sit one floating-point ULP on the wrong side of 7:1, which makes a sliver about one
       hundred-thousandth of the luminance axis wide near the deep edge behave as banded. This
       filter keeps the "unchanged" promise about colours an owner could actually distinguish. */
    return l < LEGIBILITY_DEAD_BAND.min - 0.001 || l > LEGIBILITY_DEAD_BAND.max + 0.001;
  });

  it("has both populations to test against", () => {
    expect(banded.length).toBeGreaterThan(50);
    expect(legal.length).toBeGreaterThan(300);
  });

  it("moves every dead-band colour out of the band and says so", () => {
    const failures: string[] = [];
    for (const hex of banded) {
      const d = derivePalette(hex, "gradient");
      if (!d.clamped) failures.push(`${hex}: not clamped`);
      if (d.clampNote.length === 0) failures.push(`${hex}: clamped silently`);
      const l = relativeLuminance(d.groundHex);
      if (l > LEGIBILITY_DEAD_BAND.min && l < LEGIBILITY_DEAD_BAND.max) {
        failures.push(`${hex}: landed at L=${l.toFixed(4)}, still in the band`);
      }
      if (d.groundHex === hex.toUpperCase()) failures.push(`${hex}: reported clamped but unmoved`);
    }
    expect(failures.slice(0, 12), `${failures.length} failures`).toEqual([]);
  });

  it("leaves a legal colour exactly as it was asked for", () => {
    const failures: string[] = [];
    for (const hex of legal) {
      const d = derivePalette(hex, "gradient");
      if (d.clamped) failures.push(`${hex}: clamped when it did not need to be`);
      if (d.clampNote !== "") failures.push(`${hex}: note "${d.clampNote}" on an unclamped colour`);
      if (d.groundHex !== hex) failures.push(`${hex}: became ${d.groundHex}`);
      if (d.palette.ground !== d.groundHex) {
        failures.push(`${hex}: palette.ground ${d.palette.ground} != groundHex ${d.groundHex}`);
      }
    }
    expect(failures.slice(0, 12), `${failures.length} failures`).toEqual([]);
  });

  it("moves to the nearer edge, measured in the band's own unit", () => {
    /* A colour just inside the deep edge must come out deep; one just inside the light edge
       must come out light. Getting this backwards would still be legible and would still pass
       the sweep — it would just hand the owner a colour from the other end of the range. */
    const justAboveDeep = "#6E6E6E"; /* L ≈ 0.15, nearer the 0.100 edge */
    const justBelowLight = "#A6A6A6"; /* L ≈ 0.38 — legal already, so step in a shade */
    const nearLight = "#9C9C9C"; /* L ≈ 0.33, nearer the 0.339 edge */

    const deep = derivePalette(justAboveDeep, "gradient");
    expect(deep.clamped).toBe(true);
    expect(relativeLuminance(deep.groundHex)).toBeLessThanOrEqual(LEGIBILITY_DEAD_BAND.min);
    expect(deep.clampNote).toContain("deeper");

    const light = derivePalette(nearLight, "gradient");
    expect(light.clamped).toBe(true);
    expect(relativeLuminance(light.groundHex)).toBeGreaterThanOrEqual(LEGIBILITY_DEAD_BAND.max);
    expect(light.clampNote).toContain("lighter");

    expect(derivePalette(justBelowLight, "gradient").clamped).toBe(false);
  });

  it("writes the note in the owner's language, not the system's", () => {
    const note = derivePalette("#7F7F7F", "gradient").clampNote;
    expect(note.length).toBeGreaterThan(0);
    /* No jargon and no thresholds: the owner is told the consequence, not the arithmetic. */
    for (const jargon of ["luminance", "contrast", "WCAG", "ratio", "0.1", "0.339", "7:1", "#"]) {
      expect(note.toLowerCase(), `note leaks "${jargon}"`).not.toContain(jargon.toLowerCase());
    }
    expect(note.split(".").filter((s) => s.trim().length > 0)).toHaveLength(1);
  });

  it("flips the ink polarity with the clamped ground, never with the requested one", () => {
    /* The defect this catches: choosing the ink from the colour the owner asked for and then
       painting it on the colour we actually used. A mid grey clamps deep, so its ink is white. */
    const d = derivePalette("#6E6E6E", "gradient");
    expect(d.palette.ink).toBe("#FFFFFF");
    expect(derivePalette("#9C9C9C", "gradient").palette.ink).toBe("#0F1114");
  });
});

/* ── Hue survives the clamp ──────────────────────────────────────────────────────────── */

/** Hue angle in degrees, independently derived — see `hslHex` for why it is not imported. */
function hueOf(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return Number.NaN;
  let h: number;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  return h < 0 ? h + 360 : h;
}

function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

describe("a clamp changes depth and nothing else", () => {
  /**
   * The owner picked a colour, not a luminance. If the clamp shifted hue the product would be
   * answering "your blue is unreadable" with a green, which is a worse failure than the one it
   * is fixing. Saturated inputs only: at low saturation the hue angle is 8-bit rounding noise
   * and comparing it measures the quantiser, not the clamp.
   */
  const saturated = HUES.flatMap((h) =>
    [0.55, 0.85, 1].flatMap((s) =>
      [0.16, 0.28, 0.4, 0.5].map((l) => ({ h, hex: hslHex(h, s, l) })),
    ),
  ).filter(({ hex }) => inBand(hex));

  it("has saturated dead-band colours to test", () => {
    expect(saturated.length).toBeGreaterThan(20);
  });

  it("preserves the hue angle through the clamp", () => {
    const failures: string[] = [];
    for (const { hex } of saturated) {
      const before = hueOf(hex);
      const after = hueOf(derivePalette(hex, "gradient").groundHex);
      if (Number.isNaN(before)) continue;
      if (!(hueGap(before, after) <= 1.5)) {
        failures.push(`${hex}: hue ${before.toFixed(1)}° became ${after.toFixed(1)}°`);
      }
    }
    expect(failures.slice(0, 12), `${failures.length} failures`).toEqual([]);
  });

  it("keeps the whole palette inside the ground's hue family", () => {
    /* Every derived value is found along the ground's own hue ray, so a palette can never grow
       a second accent colour nobody chose. Checked on the two most visible slots. */
    const d = derivePalette("#1B3B80", "gradient").palette;
    const ground = hueOf(d.ground);
    for (const slot of [d.buttonBg, d.inkSoft, d.line, d.buttonAltBorder]) {
      const h = hueOf(slot);
      if (Number.isNaN(h)) continue;
      expect(hueGap(ground, h), `${slot} left the hue family`).toBeLessThanOrEqual(12);
    }
  });
});

/* ── The presets must not regress ────────────────────────────────────────────────────── */

describe("the nine presets", () => {
  it.each(PALETTE_ORDER)("%s still satisfies the contract, untouched", (id) => {
    expect(contractFailures(TEMPLATE_PALETTES[id], id)).toEqual([]);
    expect(shapeFailures(TEMPLATE_PALETTES[id], id)).toEqual([]);
  });

  /**
   * Handing a preset's own ground back to the engine must produce a palette of the same
   * character — same ink polarity, same borrowed id. It will not reproduce the preset's
   * hand-picked button hexes and is not supposed to; what has to hold is that a curated colour
   * and a freely chosen one land in the same place.
   */
  it.each(PALETTE_ORDER)("%s's ground is accepted unclamped and keeps its own id", (id) => {
    const preset = TEMPLATE_PALETTES[id];
    const d = derivePalette(preset.ground, "gradient");
    expect(d.clamped, `${id} ground ${preset.ground} was clamped`).toBe(false);
    expect(d.groundHex).toBe(preset.ground);
    expect(d.palette.ink).toBe(preset.ink);
    expect(d.palette.id).toBe(id);
  });
});

/* ── Purity ──────────────────────────────────────────────────────────────────────────── */

describe("purity", () => {
  it("returns an equal value for the same input, every time", () => {
    for (const hex of ["#1B3B80", "#7F7F7F", "#E1AA40", "#000000", "#FFFFFF"]) {
      for (const finish of FINISH_ORDER) {
        expect(derivePalette(hex, finish)).toEqual(derivePalette(hex, finish));
      }
    }
  });

  it("returns a fresh object each call, so a caller cannot poison the next one", () => {
    const a = derivePalette("#1B3B80", "gradient");
    const b = derivePalette("#1B3B80", "gradient");
    expect(a).not.toBe(b);
    expect(a.palette).not.toBe(b.palette);
    a.palette.ink = "#FF00FF";
    expect(derivePalette("#1B3B80", "gradient").palette.ink).toBe("#FFFFFF");
  });

  it("accepts the short hex form and normalises the answer to uppercase #RRGGBB", () => {
    expect(derivePalette("#123", "flat").groundHex).toBe(derivePalette("#112233", "flat").groundHex);
    expect(derivePalette("#1b3b80", "flat").groundHex).toBe("#1B3B80");
  });

  it("refuses a colour it cannot parse rather than inventing one", () => {
    expect(() => derivePalette("teal", "flat")).toThrow();
    expect(() => derivePalette("#12345", "flat")).toThrow();
  });
});

/* ── Stops, per style ────────────────────────────────────────────────────────────────── */

describe("the gradient each finish asks for", () => {
  const probes = ["#1B3B80", "#0A0A0A", "#E1AA40", "#FFFFFF", "#7F7F7F", "#808000"];

  it.each(FINISH_ORDER)("%s gives two distinct stops on every probe", (finish) => {
    for (const hex of probes) {
      const p = derivePalette(hex, finish).palette;
      expect(p.gradientFrom, `${hex}/${finish}`).not.toBe(p.gradientTo);
      /* `from` is the lighter stop on every preset, and consumers read it that way. */
      expect(relativeLuminance(p.gradientFrom)).toBeGreaterThanOrEqual(
        relativeLuminance(p.gradientTo),
      );
    }
  });

  it("keeps flat's two stops indistinguishable, and everything else's real", () => {
    for (const hex of probes) {
      const flat = derivePalette(hex, "flat").palette;
      /* Measured in **bytes**, not in contrast ratio. A ratio is luminance-relative, so the same
         invisible step reads as 1.01 on a light ground and 1.06 on a deep one, and an assertion
         written in ratios would be asserting something different at each end of the range. A
         handful of 8-bit levels is the same non-difference everywhere. */
      const a = parseHex(flat.gradientFrom);
      const b = parseHex(flat.gradientTo);
      const apart = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
      expect(apart, `flat on ${hex} spans ${apart} byte levels`).toBeLessThanOrEqual(6);
      expect(apart, `flat on ${hex} has no range at all`).toBeGreaterThan(0);
    }
    /* And the decorated styles have to actually spend their span, or the whole axis is a lie. */
    for (const style of ["gradient", "mesh"] satisfies SurfaceStyle[]) {
      const p = derivePalette("#1B3B80", style).palette;
      expect(contrastRatio(p.gradientFrom, p.gradientTo), style).toBeGreaterThan(1.3);
    }
  });

  it("widens the contract rather than relaxing it — mesh is the strictest style", () => {
    /* The point of §3: every `allStops` pair is judged on both ends, so a wider gradient is a
       harder promise. If mesh's weak stop were not deeper than flat's, the span would be
       decorative and the sweep would be proving less than it looks like it proves. */
    const flat = derivePalette("#1B3B80", "flat").palette;
    const mesh = derivePalette("#1B3B80", "mesh").palette;
    expect(contrastRatio(mesh.gradientFrom, mesh.gradientTo)).toBeGreaterThan(
      contrastRatio(flat.gradientFrom, flat.gradientTo),
    );
  });
});

/* ── The slots that only some grounds need ───────────────────────────────────────────── */

describe("the borders a near-white ground needs and a deep one must not grow", () => {
  it("gives a near-white ground a plate edge and a face edge", () => {
    const p = derivePalette("#FFFFFF", "flat").palette;
    expect(p.plateBorder).not.toBeNull();
    expect(p.faceBorder).not.toBeNull();
    /* A boundary, so 1.4.11's 3:1 against the surface it separates from. */
    expect(contrastRatio(p.plateBorder as string, "#FFFFFF")).toBeGreaterThanOrEqual(3);
  });

  it("leaves both null on a ground that frames itself", () => {
    const p = derivePalette("#142C63", "gradient").palette;
    expect(p.plateBorder).toBeNull();
    expect(p.faceBorder).toBeNull();
  });
});
