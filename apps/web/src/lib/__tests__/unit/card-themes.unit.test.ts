import { describe, expect, it } from "vitest";
import { cardThemeSchema } from "@/lib/card-schema";
import {
  CARD_THEMES,
  backgroundBaseColor,
  backgroundCss,
  findCardTheme,
  readableOn,
  relativeLuminance,
  resolveCardTokens,
  withAlpha,
} from "@/lib/card-themes";

/** WCAG 2.x contrast ratio. */
function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (light + 0.05) / (dark + 0.05);
}

/** Every colour a background actually shows — both ends of a gradient count. */
function backgroundStops(theme: (typeof CARD_THEMES)[number]): string[] {
  if (theme.background.kind === "gradient") {
    return [theme.background.from, theme.background.to];
  }
  if (theme.background.kind === "solid") {
    return [theme.background.color];
  }
  return [];
}

describe("theme library", () => {
  it("ships the full library", () => {
    expect(CARD_THEMES.length).toBeGreaterThanOrEqual(24);
  });

  it("has unique ids — published cards reference these forever", () => {
    const ids = CARD_THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every preset satisfies the snapshot schema", () => {
    for (const { label: _label, ...theme } of CARD_THEMES) {
      const result = cardThemeSchema.safeParse(theme);
      expect(result.success, `${theme.id} failed schema`).toBe(true);
    }
  });

  it("every preset gives body text at least WCAG AA contrast", () => {
    for (const theme of CARD_THEMES) {
      for (const stop of backgroundStops(theme)) {
        const ratio = contrastRatio(theme.textColor, stop);
        expect(
          ratio,
          `${theme.id}: ${theme.textColor} on ${stop} is ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("every preset's button label is legible on its own fill", () => {
    for (const theme of CARD_THEMES) {
      const { button } = resolveCardTokens(theme);
      if (button.background === "transparent") {
        continue;
      }
      // Soft buttons blend the accent into the page, so measure the label
      // against the background it actually sits on.
      const base =
        theme.buttonStyle === "soft"
          ? backgroundBaseColor(theme.background)
          : theme.accent;
      const ratio = contrastRatio(button.color, base);
      expect(ratio, `${theme.id} button ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("finds a theme by id", () => {
    expect(findCardTheme("midnight")?.label).toBe("Midnight");
    expect(findCardTheme("nope")).toBeUndefined();
  });
});

describe("colour helpers", () => {
  it("picks a legible foreground", () => {
    expect(readableOn("#000000")).toBe("#FFFFFF");
    expect(readableOn("#FFFFFF")).toBe("#111111");
    expect(readableOn("#FDE047")).toBe("#111111");
  });

  it("keeps the hue and applies alpha", () => {
    expect(withAlpha("#1B2430", 0.5)).toBe("rgba(27, 36, 48, 0.5)");
  });
});

describe("background resolution", () => {
  it("renders each background kind", () => {
    expect(backgroundCss({ kind: "solid", color: "#FFFFFF" })).toBe("#FFFFFF");
    expect(
      backgroundCss({ kind: "gradient", from: "#000000", to: "#FFFFFF", angle: 90 }),
    ).toBe("linear-gradient(90deg, #000000 0%, #FFFFFF 100%)");
    expect(
      backgroundCss({ kind: "image", url: "https://x/y.jpg", overlay: 0.4 }),
    ).toContain("url(https://x/y.jpg)");
  });

  it("assumes an image background is dark, since the scrim makes that safe", () => {
    const tokens = resolveCardTokens({
      ...CARD_THEMES[0],
      background: { kind: "image", url: "https://x/y.jpg", overlay: 0.4 },
    });
    expect(tokens.isDark).toBe(true);
    expect(tokens.overlay).toBe("rgba(0, 0, 0, 0.4)");
  });

  it("omits the scrim when the overlay is zero", () => {
    const tokens = resolveCardTokens({
      ...CARD_THEMES[0],
      background: { kind: "image", url: "https://x/y.jpg", overlay: 0 },
    });
    expect(tokens.overlay).toBeNull();
  });
});

describe("token derivation", () => {
  it("maps corner settings to radii", () => {
    const corners = ["sharp", "soft", "round", "pill"] as const;
    const radii = corners.map(
      (c) => resolveCardTokens({ ...CARD_THEMES[0], corners: c }).radius,
    );
    expect(radii).toEqual(["0px", "8px", "16px", "999px"]);
  });

  it("gives the shadow style a hard, unblurred offset", () => {
    const tokens = resolveCardTokens({
      ...CARD_THEMES[0],
      buttonStyle: "shadow",
    });
    expect(tokens.button.shadow).toBe("4px 4px 0 0 #F8F7F4");
  });

  it("makes outline buttons carry no fill", () => {
    const tokens = resolveCardTokens({
      ...CARD_THEMES[0],
      buttonStyle: "outline",
    });
    expect(tokens.button.background).toBe("transparent");
  });
});
