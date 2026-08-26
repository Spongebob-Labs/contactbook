import { createElement } from "react";
import { PNG } from "pngjs";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "../helpers/render";
import { decodeQrPng, decodeWithRetry } from "../helpers/qr-decode";
import {
  clusterLuminance,
  contrastBetween,
  medianLuminance,
  parseColor,
  pixelFamilyShare,
  readPng,
} from "../helpers/pixels";
import {
  ALL_STATES,
  DATA_SCREEN_STATES,
  ROUTE_MANIFEST,
  STATE_QUERIES,
  fillParams,
  routeById,
  withState,
} from "../helpers/routes";

/**
 * The harness proving itself. 31 tracks import `tests/helpers/**` and none of them may edit
 * it (plan §1.2), so the helpers are verified here, once, before anyone depends on them.
 */

/** Paint an RGBA PNG buffer from a per-pixel function. */
function makePng(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number],
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (width * y + x) * 4;
      const [r, g, b] = paint(x, y);
      png.data[index] = r;
      png.data[index + 1] = g;
      png.data[index + 2] = b;
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

describe("vitest + happy-dom + jest-dom", () => {
  it("runs vitest assertions", () => {
    expect(1 + 1).toBe(2);
  });

  it("renders React and exposes @testing-library/jest-dom matchers", () => {
    renderWithProviders(createElement("span", { "data-testid": "harness" }, "harness ok"));
    expect(screen.getByTestId("harness")).toBeInTheDocument();
    expect(screen.getByTestId("harness")).toHaveTextContent("harness ok");
  });
});

describe("qr-decode — the ground truth (spec §8A.7, R-2)", () => {
  it("decodes a real QR symbol out of a raw PNG buffer", async () => {
    const payload = "https://contactbook.example/c/prya-hq";
    const buffer = await QRCode.toBuffer(payload, {
      type: "png",
      errorCorrectionLevel: "H",
      margin: 4,
      scale: 8,
    });

    expect(decodeQrPng(buffer)).toBe(payload);
  });

  it("returns null rather than throwing when there is no symbol", () => {
    const blank = makePng(64, 64, () => [255, 255, 255]);
    expect(decodeQrPng(blank)).toBeNull();
  });

  it("stops retrying the moment a decode succeeds", async () => {
    let calls = 0;
    const result = await decodeWithRetry(() => {
      calls += 1;
      return calls === 2 ? "payload" : null;
    });

    expect(result).toBe("payload");
    expect(calls).toBe(2);
  });

  it("gives up after three attempts — a third failure is real, not flake", async () => {
    let calls = 0;
    const result = await decodeWithRetry(() => {
      calls += 1;
      return null;
    });

    expect(result).toBeNull();
    expect(calls).toBe(3);
  });
});

describe("pixels — the contrast and 80/20 primitives", () => {
  it("parses hex and rgb() colours", () => {
    expect(parseColor("#FFF")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor("#14211C")).toEqual({ r: 0x14, g: 0x21, b: 0x1c });
    expect(parseColor("rgb(247, 241, 230)")).toEqual({ r: 247, g: 241, b: 230 });
  });

  it("computes the WCAG anchor pair exactly", () => {
    expect(contrastBetween({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5);
  });

  it("reads a median luminance off a solid field", () => {
    expect(medianLuminance(makePng(20, 20, () => [255, 255, 255]))).toBeCloseTo(1, 5);
    expect(medianLuminance(makePng(20, 20, () => [0, 0, 0]))).toBeCloseTo(0, 5);
  });

  it("separates glyph pixels from the ground beneath them by luminance clustering", () => {
    // 100×100 light field with a 100×20 dark band standing in for a text glyph run.
    const buffer = makePng(100, 100, (_x, y) => (y < 20 ? [20, 20, 20] : [247, 241, 230]));
    const { background, foreground, foregroundShare } = clusterLuminance(buffer);

    expect(foregroundShare).toBeCloseTo(0.2, 2);
    expect(background).toBeGreaterThan(foreground);
    expect(background).toBeCloseTo(medianLuminance(buffer, { y: 20 }), 5);
  });

  it("honours a region so a caller can sample one text node's box", () => {
    const buffer = makePng(40, 40, (x) => (x < 20 ? [0, 0, 0] : [255, 255, 255]));
    expect(medianLuminance(buffer, { x: 0, width: 20 })).toBeCloseTo(0, 5);
    expect(medianLuminance(buffer, { x: 20, width: 20 })).toBeCloseTo(1, 5);
  });

  it("reports colour-family shares for the 80/20 audit (AC-16)", () => {
    // 80% paper, 20% ink — the ratio AC-16 gates on.
    const buffer = makePng(100, 100, (_x, y) =>
      y < 80 ? [247, 241, 230] : [20, 33, 28],
    );
    const { shares, unclassified, total } = pixelFamilyShare(buffer, {
      ground: ["#F7F1E6"],
      accent: ["#14211C"],
    });

    expect(total).toBe(10_000);
    expect(shares.ground).toBeCloseTo(0.8, 5);
    expect(shares.accent).toBeCloseTo(0.2, 5);
    expect(unclassified).toBe(0);
  });

  it("parses a PNG once and reports its true dimensions (QR-T6 needs 800×1720)", () => {
    const bitmap = readPng(makePng(8, 17, () => [0, 0, 0]));
    expect(bitmap.width).toBe(8);
    expect(bitmap.height).toBe(17);
  });
});

describe("routes — the spec §6.1 manifest", () => {
  it("carries all 19 rows with unique ids", () => {
    expect(ROUTE_MANIFEST).toHaveLength(19);
    expect(new Set(ROUTE_MANIFEST.map((r) => r.id)).size).toBe(19);
    expect(ROUTE_MANIFEST[0].id).toBe("R-01");
    expect(ROUTE_MANIFEST[18].id).toBe("R-19");
  });

  it("expands the five `?state=` values and the six data-screen-state values", () => {
    expect(STATE_QUERIES).toHaveLength(5);
    expect(DATA_SCREEN_STATES).toHaveLength(6);
    expect(ALL_STATES).toEqual(STATE_QUERIES);
  });

  it("keeps `/cards/new` static and `/cards/[cardId]` dynamic (AC-05)", () => {
    expect(routeById("R-11").render).toBe("static");
    expect(routeById("R-12").render).toBe("dynamic");
    expect(routeById("R-12").params).toEqual(["cardId"]);
  });

  it("fills params and appends the state switch", () => {
    expect(fillParams("/cards/[cardId]", { cardId: "card_prya_hq" })).toBe(
      "/cards/card_prya_hq",
    );
    expect(withState("/cards", "loading")).toBe("/cards?state=loading");
    expect(withState("/cards?q=ac", "error")).toBe("/cards?q=ac&state=error");
  });

  it("throws loudly on a missing param rather than emitting a broken URL", () => {
    expect(() => fillParams("/cards/[cardId]", {})).toThrow(/no value for "cardId"/);
  });
});
