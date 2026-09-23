import { describe, expect, it } from "vitest";

import { cardPalette, cardPalettes } from "@/card/card-palette";
import { contrastRatio } from "@/lib/contrast";
import { TEMPLATES } from "@/card/templates";
import { fixtureCards } from "@/fixtures";
import type { ContactCard } from "@/types/domain";

const card = (over: Partial<ContactCard> = {}): ContactCard => ({
  id: "card-1",
  userId: "u-1",
  name: "My Card",
  type: "PERSONAL",
  isSensitive: false,
  publicUrl: null,
  templateId: "marigold",
  fieldIds: ["f-1"],
  updatedAt: "2026-09-19T10:00:00.000Z",
  ...over,
});

describe("cardPalette", () => {
  /**
   * ⚠ The precedence is `resolve-card.ts`'s, and it matters on the dashboard specifically: a
   * chart that ranked `paletteId` above `groundHex` would paint a bar in the preset colour of a
   * card the owner has since recoloured by hand, and disagree with the card beside it.
   */
  it("lets a hand-picked ground beat the preset it was picked over", () => {
    const withBoth = card({ groundHex: "#0D3C2E", paletteId: "oxblood" });
    const presetOnly = card({ paletteId: "oxblood" });

    expect(cardPalette(withBoth).ground).not.toBe(cardPalette(presetOnly).ground);
    expect(cardPalette(presetOnly).id).toBe("oxblood");
  });

  it("falls back to the template's default when the card chose nothing", () => {
    const bare = card({ paletteId: undefined, templateId: "marigold" });
    expect(cardPalette(bare).id).toBe(TEMPLATES.marigold.paletteId);
  });

  /**
   * ⚠ Returns a colour rather than throwing, unlike `resolveCard`, and the difference is the
   * caller. A bad id must cost a grey bar on the owner's own dashboard, never a thrown error
   * that takes the whole screen down — `resolveCard` throws because an unresolvable card must
   * not reach a recipient, which is not what a decorative swatch is.
   */
  it("degrades to a colour instead of throwing on an unknown id", () => {
    const broken = card({ templateId: "nope" as never, paletteId: undefined });
    expect(() => cardPalette(broken)).not.toThrow();
    expect(cardPalette(broken).ground).toMatch(/^#[0-9A-F]{6}$/i);
  });

  /**
   * ⚠ THE REASON THE DASHBOARD USES `canvasActionBg` AND NEVER `ground`.
   *
   * Card grounds come in two tiers. A LIGHT ground is legible with near-black ink *on the card*
   * and nearly invisible *on the white app canvas* — Pistachio `#BFD48C` measures about 1.6:1
   * there, well under 1.4.11's 3:1 for a graphical object that carries meaning. A reach bar in
   * `ground` would therefore vanish for four of the palettes.
   *
   * `canvasActionBg` is the slot designed for a card colour drawn on the app canvas, and
   * `PALETTE_CONTRACT` proves it against `#FFFFFF`. This asserts the property the dashboard
   * actually relies on, over every card the fixtures ship, so a new palette or a new fixture
   * cannot quietly reintroduce an invisible bar.
   */
  it("gives every fixture card a colour that is visible on the white app canvas", () => {
    for (const fixture of fixtureCards) {
      const palette = cardPalette(fixture);
      const ratio = contrastRatio(palette.canvasActionBg, "#FFFFFF");
      expect(ratio, `${fixture.name} (${palette.id}) on canvas`).toBeGreaterThanOrEqual(3);
    }
  });

  it("maps every card once, keyed by id", () => {
    const map = cardPalettes([card({ id: "a" }), card({ id: "b", paletteId: "emerald" })]);
    expect([...map.keys()]).toEqual(["a", "b"]);
    expect(map.get("b")?.id).toBe("emerald");
  });
});
