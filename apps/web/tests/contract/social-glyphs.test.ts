import { describe, expect, it } from "vitest";

import { GENERIC_GLYPH, SOCIAL_GLYPHS, socialGlyph } from "@/card/social-glyphs";
import { SOCIAL_PLATFORMS } from "@/lib/format";

/**
 * THE SOCIAL STRIP'S TWO TABLES MUST AGREE.
 *
 * `SOCIAL_PLATFORMS` maps hostnames to product names; `SOCIAL_GLYPHS` maps those product names
 * to marks. They are edited at opposite ends of the codebase and nothing in the type system ties
 * them together — `SOCIAL_GLYPHS` is a `Record<string, ReactElement>`, because its keys are
 * values of the other table rather than a union.
 *
 * Both drift directions are silent, which is why both are asserted:
 *
 *  · A platform the parser NAMES and the glyph table MISSES falls through to the generic mark.
 *    Nothing throws; the card just shows an `@` where LinkedIn should be, and only somebody
 *    who happens to have that platform on a card ever sees it.
 *  · A glyph keyed to a name no host produces is unreachable code that looks like coverage.
 */
describe("the social glyph table and the platform table", () => {
  const platformNames = new Set(Object.values(SOCIAL_PLATFORMS));

  it("draws a real mark for every platform the parser names", () => {
    for (const name of platformNames) {
      expect(SOCIAL_GLYPHS[name], `${name} has no glyph and would render the generic mark`)
        .toBeDefined();
    }
  });

  it("has no glyph for a name no hostname produces", () => {
    for (const key of Object.keys(SOCIAL_GLYPHS)) {
      expect(platformNames.has(key), `${key} is keyed to no host in SOCIAL_PLATFORMS`).toBe(true);
    }
  });

  /**
   * The E-23 path, which is the one that must never be a hole: an unrecognised host keeps its
   * bare hostname as its `platform`, misses the table, and still gets a mark — so the strip
   * shows a disc rather than an empty gap.
   */
  it("falls back to the generic mark and never to nothing", () => {
    expect(socialGlyph("some-niche-network.example")).toBe(GENERIC_GLYPH);
    expect(socialGlyph("")).toBe(GENERIC_GLYPH);
  });

  /**
   * Exact match only. `parseSocialLink` returns either a value straight out of
   * `SOCIAL_PLATFORMS` or a bare hostname, so a case-insensitive lookup would only ever change
   * behaviour for a hostname that happened to spell a brand — the one case where guessing is
   * actively wrong.
   */
  it("does not match a platform name case-insensitively", () => {
    expect(socialGlyph("linkedin")).toBe(GENERIC_GLYPH);
    expect(socialGlyph("LinkedIn")).not.toBe(GENERIC_GLYPH);
  });
});
