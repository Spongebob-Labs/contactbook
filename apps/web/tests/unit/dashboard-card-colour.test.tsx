import { describe, expect, it } from "vitest";

import { renderWithProviders } from "../helpers/render";

import { cardPalettes, cardSwatch } from "@/card/card-palette";
import { TEMPLATE_PALETTES, PALETTE_ORDER } from "@/card/template-palettes";
import { AttentionList } from "@/components/dashboard/attention-list";
import { ReachBars } from "@/components/dashboard/reach-bars";
import { contrastRatio } from "@/lib/contrast";
import type { ContactCard } from "@/types/domain";

const base = {
  userId: "u",
  isSensitive: false,
  publicUrl: null,
  updatedAt: "2026-09-19T10:00:00.000Z",
} as const;

/** One card per palette, so the sweeps below cover the whole colour space and not two hues. */
const CARDS = PALETTE_ORDER.map(
  (paletteId, i) =>
    ({
      ...base,
      id: `card-${i}`,
      name: `Card ${i}`,
      type: "PERSONAL",
      templateId: "marigold",
      paletteId,
      fieldIds: ["f-1"],
    }) as unknown as ContactCard,
);

const PALETTES = cardPalettes(CARDS);

const bgOf = (el: Element | null) => (el as HTMLElement | null)?.style.backgroundColor ?? "";

describe("a card is one colour everywhere on the dashboard", () => {
  /**
   * ⚠ THE BUG THIS EXISTS FOR, AND IT SHIPPED ONCE.
   *
   * The reach bars filled with `palette.ground` while the attention list's rule used
   * `palette.canvasActionBg`, so a Marigold card rendered **ochre in the chart and deep brown
   * in the queue** — one card, two colours, both visible on one screen without scrolling. A
   * reader matching a row to a bar had no way to know they were the same card.
   *
   * Neither component was wrong on its own, which is exactly why a unit test of either would
   * have passed. The agreement is the property, so the test has to render both.
   */
  it("paints the same card the same colour in the bars and in the attention list", () => {
    /* ⚠ EVERY palette, not one — and the first version of this test is why. It asserted a
       single card, and `PALETTE_ORDER[0]` is Onyx, the one neutral in the set, whose `ground`
       and `canvasActionBg` are the same colour. The test passed against the bug it was written
       to catch. The disagreement only exists on the LIGHT tier, where the two slots are an
       ochre and a deep brown, so the sweep has to reach those palettes to mean anything. */
    const mismatches: string[] = [];

    for (const card of CARDS) {
      const bars = renderWithProviders(
        <ReachBars
          rows={[{ cardId: card.id, cardName: card.name, opens: 5, recipients: 1 }]}
          palettes={PALETTES}
        />,
      );
      const barFill = bgOf(bars.container.querySelector("[data-reach-bar]"));
      bars.unmount();

      const list = renderWithProviders(
        <AttentionList
          rows={[{ kind: "behind", cardId: card.id, cardName: card.name, count: 2 }]}
          palettes={PALETTES}
        />,
      );
      const markerFill = bgOf(list.container.querySelector("[data-attention-marker]"));
      list.unmount();

      if (barFill === "") mismatches.push(`${card.paletteId}: bar drew no colour`);
      if (markerFill === "") mismatches.push(`${card.paletteId}: marker drew no colour`);
      if (barFill !== markerFill) {
        mismatches.push(`${card.paletteId}: bar ${barFill} vs marker ${markerFill}`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  /**
   * The swatch is `{ fill, edge }` and the edge is what keeps a light ground legible. Asserted
   * over every palette rather than the two the fixtures happen to use, so adding a tenth colour
   * cannot quietly ship an invisible bar.
   */
  it("gives every palette an edge that is discernible on the white app canvas", () => {
    for (const id of PALETTE_ORDER) {
      const { fill, edge } = cardSwatch(TEMPLATE_PALETTES[id]);
      expect(fill).toBe(TEMPLATE_PALETTES[id].ground);
      expect(contrastRatio(edge, "#FFFFFF"), `${id} edge on canvas`).toBeGreaterThanOrEqual(3);
    }
  });

  /**
   * Both components take `palettes` optionally so existing callers keep compiling. Neither may
   * throw or render an empty marker when it is absent — a dashboard that blanks because a
   * colour map was not threaded is a worse failure than a grey one.
   */
  it("still renders both components with no palettes at all", () => {
    const card = CARDS[0]!;

    expect(() =>
      renderWithProviders(
        <ReachBars rows={[{ cardId: card.id, cardName: card.name, opens: 5, recipients: 1 }]} />,
      ),
    ).not.toThrow();

    const list = renderWithProviders(
      <AttentionList rows={[{ kind: "behind", cardId: card.id, cardName: card.name, count: 2 }]} />,
    );
    expect(bgOf(list.container.querySelector("[data-attention-marker]"))).not.toBe("");
  });
});
