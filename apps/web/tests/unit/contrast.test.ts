import { describe, expect, it } from "vitest";

import {
  AA_NON_TEXT,
  AA_TEXT,
  contrastRatio,
  linearise,
  meetsBodyText,
  meetsNonText,
  parseHex,
  relativeLuminance,
} from "@/lib/contrast";

/**
 * The palette is only as trustworthy as the maths that gates it, so this file pins the
 * helper against values computed independently of it — the WCAG worked example (21:1) and
 * the ratios spec §8.3 tables for our own tokens.
 *
 * `#65756D` is the salvaged muted ink the old build shipped. Asserting that it *fails*
 * (spec AS-09) is what proves the threshold is real rather than decorative.
 */

const TOLERANCE = 0.02;

function expectRatio(a: string, b: string, expected: number): void {
  const actual = contrastRatio(a, b);
  expect(
    Math.abs(actual - expected),
    `contrastRatio(${a}, ${b}) = ${actual.toFixed(4)}, expected ${expected} ±${TOLERANCE}`,
  ).toBeLessThanOrEqual(TOLERANCE);
}

describe("parseHex", () => {
  it("reads six-digit hex", () => {
    expect(parseHex("#14211C")).toEqual([0x14, 0x21, 0x1c]);
  });

  it("expands three-digit shorthand", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("#0a5")).toEqual([0x00, 0xaa, 0x55]);
  });

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    expect(parseHex(" #f7f1e6 ")).toEqual(parseHex("#F7F1E6"));
  });

  it("rejects anything that is not a #RGB or #RRGGBB colour", () => {
    for (const bad of ["14211C", "#12345", "#GGGGGG", "rgb(0,0,0)", "", "#1234567"]) {
      expect(() => parseHex(bad), `should reject "${bad}"`).toThrow();
    }
  });
});

describe("relativeLuminance", () => {
  it("anchors at 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 10);
  });

  it("uses the linear ramp below the 0.03928 knee", () => {
    // 10/255 = 0.0392… which is below the knee, so the divide-by-12.92 branch applies.
    expect(linearise(10)).toBeCloseTo(10 / 255 / 12.92, 12);
    // 20/255 is above the knee and takes the gamma branch.
    expect(linearise(20)).toBeCloseTo(((20 / 255 + 0.055) / 1.055) ** 2.4, 12);
  });

  it("increases monotonically with lightness", () => {
    const ramp = ["#000000", "#14211C", "#55655D", "#7C8B83", "#EFE6D6", "#F7F1E6", "#FFFFFF"];
    const luminances = ramp.map(relativeLuminance);
    for (let i = 1; i < luminances.length; i += 1) {
      expect(luminances[i], `${ramp[i]} should be lighter than ${ramp[i - 1]}`).toBeGreaterThan(
        luminances[i - 1],
      );
    }
  });
});

describe("contrastRatio", () => {
  it("returns 21 for black on white — the WCAG maximum", () => {
    expectRatio("#000000", "#FFFFFF", 21);
  });

  it("returns 1 for a colour against itself", () => {
    expectRatio("#0E5F4F", "#0E5F4F", 1);
  });

  it("is order-independent", () => {
    expect(contrastRatio("#14211C", "#F7F1E6")).toBe(contrastRatio("#F7F1E6", "#14211C"));
  });

  it("reproduces the spec §8.3 ratio for --ink on --canvas", () => {
    expectRatio("#14211C", "#F7F1E6", 14.78);
  });

  it("reproduces the spec §8.3 ratio for the re-derived --ink-3 on --canvas", () => {
    expectRatio("#55655D", "#F7F1E6", 5.48);
  });

  it("reproduces the spec §8.3 ratio for --line-control on --canvas", () => {
    expectRatio("#8F7F66", "#F7F1E6", 3.46);
  });
});

describe("AS-09 · the salvaged #65756D muted ink fails AA and must stay rejected", () => {
  it("measures 4.33:1 on --canvas", () => {
    expectRatio("#65756D", "#F7F1E6", 4.33);
  });

  it("measures 3.93:1 on --surface-sunk", () => {
    expectRatio("#65756D", "#EFE6D6", 3.93);
  });

  it("is refused for body text on both grounds", () => {
    expect(meetsBodyText("#65756D", "#F7F1E6")).toBe(false);
    expect(meetsBodyText("#65756D", "#EFE6D6")).toBe(false);
  });

  it("is beaten by the #55655D replacement on every surface", () => {
    for (const ground of ["#F7F1E6", "#EFE6D6", "#FFFCF6", "#FFFFFF"]) {
      expect(contrastRatio("#55655D", ground)).toBeGreaterThan(contrastRatio("#65756D", ground));
      expect(meetsBodyText("#55655D", ground), `#55655D on ${ground}`).toBe(true);
    }
  });
});

describe("threshold predicates", () => {
  it("exposes the WCAG 2.2 AA bars the design system is held to", () => {
    expect(AA_TEXT).toBe(4.5);
    expect(AA_NON_TEXT).toBe(3);
  });

  it("meetsBodyText is inclusive at exactly 4.5:1", () => {
    // #767676 on #FFFFFF is the canonical 4.54:1 AA boundary grey.
    expect(contrastRatio("#767676", "#FFFFFF")).toBeGreaterThanOrEqual(AA_TEXT);
    expect(meetsBodyText("#767676", "#FFFFFF")).toBe(true);
    // One step lighter drops under the bar.
    expect(meetsBodyText("#777777", "#FFFFFF")).toBe(false);
  });

  it("meetsNonText accepts --line-control and rejects the decorative --line", () => {
    expect(meetsNonText("#8F7F66", "#F7F1E6")).toBe(true);
    expect(meetsNonText("#D8CCB9", "#F7F1E6")).toBe(false);
  });
});
