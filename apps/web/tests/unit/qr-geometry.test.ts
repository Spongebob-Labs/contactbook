import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";

import QRCode from "qrcode";
import { describe, expect, it } from "vitest";

import { contrastRatio, relativeLuminance } from "@/lib/contrast";
import {
  ECC_LEVEL,
  ENCODER_MARGIN,
  MARK_MAX_SIDE_RATIO,
  MAX_MARK_AREA_RATIO,
  MAX_PAYLOAD_BYTES,
  MAX_PLATE_RADIUS_PX,
  MAX_QR_SIZE_PX,
  MIN_MARK_CLEARANCE_MODULES,
  MIN_MODULE_CONTRAST,
  MIN_QR_SIZE_PX,
  MIN_QUIET_ZONE_PX,
  MODULE_COLOUR,
  PLATE_COLOUR,
  QR_WIDTH_RATIO,
  QUIET_ZONE_MODULES,
  hasMarkClearance,
  isMarkWithinBudget,
  markClearancePx,
  markMaxSide,
  modulePx,
  payloadByteLength,
  qrGeometry,
  qrSizePx,
  quietZonePx,
  reservedBox,
  safeMarkSide,
} from "@/card/qr-geometry";
import { QrZone } from "@/card/qr-zone";
import { decodeQrBitmap } from "../helpers/qr-decode";
import { render, screen } from "../helpers/render";

/**
 * Spec §8A is the one contract in this build that can be **objectively wrong**: a card whose
 * QR does not decode is a dead card. This file pins the half of §8A that is pure arithmetic
 * plus the DOM shape that carries it.
 *
 * ⚠ happy-dom has no layout engine (spec §14.6). NOTHING here reads a bounding box. The
 * rendered-pixel clauses — QR-T1's measured boxes, QR-T2's computed styles, QR-T3's overlap,
 * QR-T5's decode — belong to T27 in Playwright. What this file proves is that the numbers
 * those tests will measure are the numbers §8A.3 specifies, and that the elements they will
 * query exist and are shaped correctly.
 */

const PAYLOAD = "http://localhost:3000/c/priyanka-sharma";

/** The real module count for `PAYLOAD` at ECC H — version 5, 37×37. Never a guess. */
const MODULES = QRCode.create(PAYLOAD, { errorCorrectionLevel: "H" }).modules.size;

/** The largest symbol the ≤60-byte payload cap can produce at ECC H — version 7, 45×45. */
const MODULES_MAX = QRCode.create("x".repeat(MAX_PAYLOAD_BYTES), {
  errorCorrectionLevel: "H",
}).modules.size;

/* ─────────────────────────────────────────────────────────────────────────────
   §8A.3 — the geometry table
   ───────────────────────────────────────────────────────────────────────────── */

describe("the §8A.3 constants themselves", () => {
  /**
   * Every other assertion in this file is written in terms of these constants, so on its
   * own the suite is happy to prove that 120px is "the floor". It is not: 140 is the
   * number spec §8A.3 states, and this block is the only place it is pinned to a literal.
   *
   * The comparisons are **directional**, not exact, because §16.1 R-2 explicitly sanctions
   * raising the symbol floor to 160px if a decode ever proves marginal — and forbids
   * relaxing anything. Tightening a safety margin passes here. Loosening one does not.
   */
  it("may be tightened, never loosened", () => {
    expect(MIN_QR_SIZE_PX).toBeGreaterThanOrEqual(140);
    expect(MIN_QUIET_ZONE_PX).toBeGreaterThanOrEqual(16);
    expect(QUIET_ZONE_MODULES).toBeGreaterThanOrEqual(4);
    expect(MIN_MARK_CLEARANCE_MODULES).toBeGreaterThanOrEqual(2);
    expect(MIN_MODULE_CONTRAST).toBeGreaterThanOrEqual(15);
    expect(MAX_MARK_AREA_RATIO).toBeLessThanOrEqual(0.2);
    expect(MARK_MAX_SIDE_RATIO).toBeLessThanOrEqual(0.447);
    expect(MAX_PLATE_RADIUS_PX).toBeLessThanOrEqual(4);
    expect(MAX_PAYLOAD_BYTES).toBeLessThanOrEqual(60);
  });

  it("pins the two values that are neither a floor nor a ceiling", () => {
    expect(QR_WIDTH_RATIO).toBe(0.42);
    expect(MAX_QR_SIZE_PX).toBe(200);
  });

  it("renders a symbol of at least 140 literal CSS px at every card width", () => {
    for (const width of [0, 200, 336, 360, 400, 600, 2000]) {
      expect(qrSizePx(width), `cardWidth=${width}`).toBeGreaterThanOrEqual(140);
    }
  });

  it("keeps a quiet zone of at least 16 literal CSS px on all four sides", () => {
    for (const width of [0, 336, 400, 600]) {
      const size = qrSizePx(width);
      expect((reservedBox(width, MODULES) - size) / 2, `cardWidth=${width}`).toBeGreaterThanOrEqual(
        16,
      );
    }
  });
});

describe("qrSizePx — max(140, min(0.42 × cardWidth, 200))", () => {
  it("matches the §8A.3 table at every stated width", () => {
    expect(qrSizePx(336)).toBe(141.12); // the 336×722 minimum card
    expect(qrSizePx(400)).toBe(168); // the 400×860 design canvas
    expect(qrSizePx(600)).toBe(MAX_QR_SIZE_PX); // ceiling
    expect(qrSizePx(200)).toBe(MIN_QR_SIZE_PX); // floor
  });

  it("never returns below the 140px floor, for any width in range", () => {
    for (let width = 0; width <= 2000; width += 1) {
      const size = qrSizePx(width);
      expect(size, `cardWidth=${width}`).toBeGreaterThanOrEqual(MIN_QR_SIZE_PX);
      expect(size, `cardWidth=${width}`).toBeLessThanOrEqual(MAX_QR_SIZE_PX);
    }
  });

  it("falls back to the floor when the card has not been measured yet", () => {
    // A ResizeObserver reports 0 before first layout; a detached node reports NaN. Neither
    // may be allowed to produce a sub-140 symbol, which is why this is a guard and not a
    // bare `Math.max` over the raw input.
    for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(qrSizePx(width), `cardWidth=${String(width)}`).toBe(MIN_QR_SIZE_PX);
    }
  });

  it("uses the 0.42 ratio between the floor and the ceiling", () => {
    expect(qrSizePx(400)).toBe(QR_WIDTH_RATIO * 400);
  });
});

describe("quietZonePx — max(16, ceil(4 × qrSizePx / moduleCount)), all four sides", () => {
  it("takes the 16px floor when four modules measure less", () => {
    expect(quietZonePx(140, 41)).toBe(16); // ceil(560/41) = 14 -> floored to 16
    expect(quietZonePx(168, MODULES_MAX)).toBe(16); // ceil(672/45) = 15 -> floored to 16
  });

  it("takes the four-module branch when four modules measure more", () => {
    expect(quietZonePx(168, MODULES)).toBe(19); // ceil(672/37) = 19
    expect(quietZonePx(200, 21)).toBe(39); // ceil(800/21) = 39, a version-1 symbol
  });

  it("is never below the 16px floor, for every module count a QR can have", () => {
    for (let version = 1; version <= 40; version += 1) {
      const count = 17 + 4 * version;
      expect(quietZonePx(MIN_QR_SIZE_PX, count), `modules=${count}`).toBeGreaterThanOrEqual(
        MIN_QUIET_ZONE_PX,
      );
    }
  });

  it("falls back to the 16px floor when the module count is unusable", () => {
    for (const count of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(quietZonePx(168, count), `modules=${String(count)}`).toBe(MIN_QUIET_ZONE_PX);
    }
  });

  it("is at least QUIET_ZONE_MODULES modules wide whenever the floor is not binding", () => {
    const size = 200;
    const zone = quietZonePx(size, 21);
    expect(zone).toBeGreaterThanOrEqual(QUIET_ZONE_MODULES * modulePx(size, 21));
  });
});

describe("reservedBox — qrSizePx + 2 × quietZonePx, square", () => {
  it("matches the §8A.3 arithmetic", () => {
    expect(reservedBox(400, MODULES_MAX)).toBe(168 + 32);
    expect(reservedBox(400, MODULES)).toBe(168 + 38);
    expect(reservedBox(336, MODULES)).toBe(141.12 + 32);
  });

  it("is exactly the symbol plus a quiet zone on each side, at any width", () => {
    for (const width of [200, 336, 360, 400, 512, 600]) {
      const size = qrSizePx(width);
      expect(reservedBox(width, MODULES)).toBe(size + 2 * quietZonePx(size, MODULES));
    }
  });

  it("exceeds the symbol by at least 16px on all four sides (AC-09b)", () => {
    for (const width of [200, 336, 400, 600]) {
      const size = qrSizePx(width);
      expect((reservedBox(width, MODULES) - size) / 2).toBeGreaterThanOrEqual(16);
    }
  });
});

describe("centre mark budget — ≤ 20% of the symbol, ≥ 2 modules clearance", () => {
  it("markMaxSide is 0.447 × qrSize", () => {
    expect(markMaxSide(168)).toBeCloseTo(75.096, 6);
    expect(markMaxSide(168)).toBe(MARK_MAX_SIDE_RATIO * 168);
  });

  it("the 0.447 side ratio really does keep the area under 20%", () => {
    // The spec states both bounds; if the ratio were ever nudged up they would disagree.
    expect(MARK_MAX_SIDE_RATIO ** 2).toBeLessThanOrEqual(MAX_MARK_AREA_RATIO);
    expect(markMaxSide(168) ** 2 / 168 ** 2).toBeLessThanOrEqual(MAX_MARK_AREA_RATIO);
  });

  it("isMarkWithinBudget rejects a mark one pixel over the side cap", () => {
    expect(isMarkWithinBudget(markMaxSide(168), 168)).toBe(true);
    expect(isMarkWithinBudget(markMaxSide(168) + 1, 168)).toBe(false);
    expect(isMarkWithinBudget(0, 168)).toBe(false);
  });

  it("markClearancePx is two modules wide", () => {
    expect(markClearancePx(168, MODULES)).toBe(MIN_MARK_CLEARANCE_MODULES * (168 / MODULES));
  });

  it("hasMarkClearance fails a mark that leaves less than two modules of plate", () => {
    const size = 168;
    const safe = safeMarkSide(size, MODULES);
    expect(hasMarkClearance(safe, size, MODULES)).toBe(true);
    expect(hasMarkClearance(markMaxSide(size), size, MODULES)).toBe(false);
  });

  it("safeMarkSide keeps the mark AND its clearance pad inside the 20% budget", () => {
    for (const width of [336, 400, 600]) {
      const size = qrSizePx(width);
      const mark = safeMarkSide(size, MODULES);
      const pad = mark + 2 * markClearancePx(size, MODULES);
      expect(isMarkWithinBudget(mark, size), `width=${width}`).toBe(true);
      expect(pad ** 2 / size ** 2, `width=${width}`).toBeLessThanOrEqual(MAX_MARK_AREA_RATIO);
    }
  });
});

describe("qrGeometry — the aggregate T13/T15/T18/T27 consume", () => {
  it("agrees with every individual function", () => {
    const g = qrGeometry(400, MODULES);
    expect(g).toEqual({
      cardWidth: 400,
      moduleCount: MODULES,
      qrSizePx: qrSizePx(400),
      modulePx: modulePx(qrSizePx(400), MODULES),
      quietZonePx: quietZonePx(qrSizePx(400), MODULES),
      reservedPx: reservedBox(400, MODULES),
      plateRadiusPx: MAX_PLATE_RADIUS_PX,
      markMaxSidePx: markMaxSide(qrSizePx(400)),
      markClearancePx: markClearancePx(qrSizePx(400), MODULES),
    });
  });

  it("holds the §8A floors at the 360px viewport worst case (E-25, AC-35)", () => {
    const g = qrGeometry(336, MODULES);
    expect(g.qrSizePx).toBeGreaterThanOrEqual(MIN_QR_SIZE_PX);
    expect(g.quietZonePx).toBeGreaterThanOrEqual(MIN_QUIET_ZONE_PX);
    expect(g.reservedPx).toBeLessThanOrEqual(336); // the reserved square must fit the card
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
   §8A.3 — the optical constants
   ───────────────────────────────────────────────────────────────────────────── */

describe("optical constants", () => {
  const TOKENS_CSS = resolve(process.cwd(), "src/styles/tokens.css");

  function cssToken(name: string): string {
    if (!existsSync(TOKENS_CSS)) throw new Error(`tokens.css not found at ${TOKENS_CSS}`);
    const match = readFileSync(TOKENS_CSS, "utf8").match(
      new RegExp(`${name}\\s*:\\s*([^;]+);`),
    );
    if (match === null) throw new Error(`${name} is not declared in tokens.css`);
    return match[1].trim();
  }

  it("references the tokens rather than restating a colour literal (F-01)", () => {
    expect(MODULE_COLOUR).toBe("var(--qr-module)");
    expect(PLATE_COLOUR).toBe("var(--qr-plate)");
    for (const value of [MODULE_COLOUR, PLATE_COLOUR]) {
      expect(value).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(/i);
    }
  });

  it("clears the 15:1 module/plate contrast floor (AC-09d)", () => {
    const ratio = contrastRatio(cssToken("--qr-module"), cssToken("--qr-plate"));
    expect(MIN_MODULE_CONTRAST).toBe(15);
    expect(ratio).toBeGreaterThanOrEqual(MIN_MODULE_CONTRAST);
    expect(ratio).toBeCloseTo(19.68, 1); // the measured value in §8A.3
  });

  it("is never inverted — the plate is lighter than the module (AC-09d)", () => {
    expect(relativeLuminance(cssToken("--qr-plate"))).toBeGreaterThan(
      relativeLuminance(cssToken("--qr-module")),
    );
  });

  it("pins the encoder options §8A.6 requires", () => {
    expect(ECC_LEVEL).toBe("H");
    expect(ENCODER_MARGIN).toBe(0);
    expect(MAX_PLATE_RADIUS_PX).toBe(4);
    expect(MAX_PAYLOAD_BYTES).toBe(60);
  });

  it("payloadByteLength counts octets, not characters", () => {
    expect(payloadByteLength(PAYLOAD)).toBe(PAYLOAD.length);
    expect(payloadByteLength("é")).toBe(2);
    expect(payloadByteLength(PAYLOAD)).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
   <QrZone> — DOM shape only. Geometry assertions are T27's, in a real browser.
   ───────────────────────────────────────────────────────────────────────────── */

type ZoneProps = Parameters<typeof QrZone>[0];

function renderZone(overrides: Partial<ZoneProps> = {}) {
  return render(
    createElement(QrZone, {
      payload: PAYLOAD,
      anchor: "above-actions",
      caption: null,
      decorate: "none",
      cardWidth: 400,
      mode: "full",
      ...overrides,
    } as ZoneProps),
  );
}

describe("<QrZone> — full mode", () => {
  it("renders exactly one [data-qr-zone] (I-3, AC-11)", () => {
    const { container } = renderZone();
    expect(container.querySelectorAll("[data-qr-zone]")).toHaveLength(1);
  });

  it("renders a plate and a real inline <svg> symbol", () => {
    const { container } = renderZone();
    const plate = container.querySelector("[data-qr-plate]");
    const symbol = container.querySelector("[data-qr-symbol]");
    expect(plate).not.toBeNull();
    expect(symbol).not.toBeNull();
    expect(symbol?.tagName.toLowerCase()).toBe("svg");
    expect(plate?.contains(symbol as Node)).toBe(true);
  });

  it("publishes the geometry it used, so the pixel suite need not re-derive it", () => {
    const { container } = renderZone({ cardWidth: 400 });
    const zone = container.querySelector("[data-qr-zone]");
    const g = qrGeometry(400, MODULES);
    expect(zone?.getAttribute("data-qr-mode")).toBe("full");
    expect(zone?.getAttribute("data-qr-modules")).toBe(String(MODULES));
    expect(zone?.getAttribute("data-qr-size")).toBe(String(g.qrSizePx));
    expect(zone?.getAttribute("data-qr-quiet")).toBe(String(g.quietZonePx));
    expect(zone?.getAttribute("data-qr-reserved")).toBe(String(g.reservedPx));
  });

  it("sizes the symbol to qrSizePx and the plate to the reserved box", () => {
    const { container } = renderZone({ cardWidth: 400 });
    const g = qrGeometry(400, MODULES);
    const symbol = container.querySelector("[data-qr-symbol]") as SVGElement;
    const plate = container.querySelector("[data-qr-plate]") as HTMLElement;
    expect(symbol.getAttribute("width")).toBe(String(g.qrSizePx));
    expect(symbol.getAttribute("height")).toBe(String(g.qrSizePx));
    expect(symbol.getAttribute("viewBox")).toBe(`0 0 ${MODULES} ${MODULES}`);
    expect(plate.style.width).toBe(`${g.reservedPx}px`);
    expect(plate.style.height).toBe(`${g.reservedPx}px`);
  });

  it("holds the 140px floor when the card width has not been measured", () => {
    const { container } = renderZone({ cardWidth: 0 });
    const symbol = container.querySelector("[data-qr-symbol]") as SVGElement;
    expect(Number(symbol.getAttribute("width"))).toBeGreaterThanOrEqual(MIN_QR_SIZE_PX);
  });

  it("paints an opaque solid plate — no alpha, no gradient, no backdrop-filter (AC-09c)", () => {
    const { container } = renderZone();
    const plate = container.querySelector("[data-qr-plate]") as HTMLElement;
    expect(plate.style.backgroundColor).toBe(PLATE_COLOUR);
    expect(plate.getAttribute("style")).not.toMatch(/gradient|backdrop|opacity|filter/i);
    expect(plate.style.borderRadius).toBe(`${MAX_PLATE_RADIUS_PX}px`);
  });

  it("isolates the zone so no sibling can paint above it (§8A.4)", () => {
    const { container } = renderZone();
    const zone = container.querySelector("[data-qr-zone]") as HTMLElement;
    expect(zone.style.isolation).toBe("isolate");
  });

  it("encodes at ECC H with no encoder margin, so the plate owns the quiet zone", () => {
    // Same payload, same options -> the symbol we render must be the symbol the spec
    // describes. A silent drop to ECC 'M' would still render and still decode, and would
    // quietly delete the recovery budget that legalises the centre mark.
    const { container } = renderZone();
    const zone = container.querySelector("[data-qr-zone]") as HTMLElement;
    expect(zone.getAttribute("data-qr-ecc")).toBe(ECC_LEVEL);
    expect(zone.getAttribute("data-qr-modules")).toBe(
      String(QRCode.create(PAYLOAD, { errorCorrectionLevel: ECC_LEVEL }).modules.size),
    );
  });

  it("renders no centre mark unless one is asked for (AC-09f)", () => {
    const { container } = renderZone();
    expect(container.querySelectorAll("[data-qr-mark]")).toHaveLength(0);
  });

  it("renders at most one centre mark, sized inside the budget", () => {
    const { container } = renderZone({ mark: { glyph: "CB" } });
    const marks = container.querySelectorAll("[data-qr-mark]");
    expect(marks).toHaveLength(1);
    const side = Number((marks[0] as HTMLElement).dataset.qrMarkSide);
    const g = qrGeometry(400, MODULES);
    expect(isMarkWithinBudget(side, g.qrSizePx)).toBe(true);
    expect(hasMarkClearance(side, g.qrSizePx, MODULES)).toBe(true);
  });
});

describe("<QrZone> — caption and decoration (§8A.4)", () => {
  it("renders the caption below the plate, outside the reserved region", () => {
    const { container } = renderZone({ caption: "Scan to save" });
    const plate = container.querySelector("[data-qr-plate]") as HTMLElement;
    const caption = container.querySelector("[data-qr-caption]") as HTMLElement;
    expect(caption).not.toBeNull();
    expect(caption.textContent).toBe("Scan to save");
    expect(plate.contains(caption)).toBe(false);
    expect(plate.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("omits the caption element entirely when there is none", () => {
    const { container } = renderZone({ caption: null });
    expect(container.querySelector("[data-qr-caption]")).toBeNull();
  });

  it("decorates strictly outside the plate, never inside it", () => {
    for (const decorate of ["corner-marks", "rule-above"] as const) {
      const { container, unmount } = renderZone({ decorate });
      const plate = container.querySelector("[data-qr-plate]") as HTMLElement;
      const decorations = [...container.querySelectorAll("[data-qr-decoration]")];
      expect(decorations.length, decorate).toBeGreaterThan(0);
      for (const node of decorations) {
        expect(plate.contains(node), `${decorate} decoration must not sit inside the plate`).toBe(
          false,
        );
      }
      unmount();
    }
  });

  it("renders no decoration for 'none'", () => {
    const { container } = renderZone({ decorate: "none" });
    expect(container.querySelectorAll("[data-qr-decoration]")).toHaveLength(0);
  });
});

describe("<QrZone> — thumb mode encodes a dummy payload, never the real one", () => {
  it("renders a real symbol rather than an abstract glyph", () => {
    /* A thumbnail is transform-scaled to roughly 200px, putting the symbol near 80px — well
       below the 140px floor a camera can read — so it can never be a working QR.

       It is still a REAL, dense symbol. It used to be a sparse corner-and-dots glyph, which
       was honest about being decorative and useless for the job a gallery actually does:
       showing what the finished card looks like. Every tile read as a wireframe. */
    const { container } = renderZone({ mode: "thumb" });
    const zone = container.querySelector("[data-qr-zone]") as HTMLElement;
    expect(zone.getAttribute("data-qr-mode")).toBe("thumb");
    expect(zone.getAttribute("data-qr-preview")).toBe("true");
    expect(zone.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("[data-qr-symbol]")).not.toBeNull();
    expect(container.querySelector("[data-qr-glyph]")).toBeNull();
  });

  it("carries no trace of the real payload in its markup", () => {
    /* The assertion that matters most about a preview symbol: scanning a gallery tile must
       not resolve to somebody real card. The pattern is genuine; the payload is a constant. */
    const { container } = renderZone({ mode: "thumb" });
    expect(container.innerHTML).not.toContain("priyanka-sharma");
    expect(container.innerHTML).not.toContain(PAYLOAD);
    expect(container.querySelector("[data-qr-zone]")?.getAttribute("data-qr-modules")).toBeNull();
  });
});

describe("<QrZone> — export mode", () => {
  it("is functional, exactly like full mode (AC-10)", () => {
    const { container } = renderZone({ mode: "export" });
    expect(container.querySelector("[data-qr-symbol]")).not.toBeNull();
    expect(container.querySelector("[data-qr-zone]")?.getAttribute("data-qr-mode")).toBe("export");
  });
});

describe("<QrZone> — encoder failure (E-30, §9.4)", () => {
  // 4 296 alphanumeric characters is the absolute QR ceiling; well past it, `qrcode`
  // throws. This is the real throw path, not a mocked one.
  const UNENCODABLE = "x".repeat(8000);

  it("renders an opaque plate reading 'QR unavailable' instead of a blank", () => {
    const { container } = renderZone({ payload: UNENCODABLE });
    const zone = container.querySelector("[data-qr-zone]") as HTMLElement;
    const plate = container.querySelector("[data-qr-plate]") as HTMLElement;
    expect(zone).not.toBeNull();
    expect(zone.getAttribute("data-qr-error")).toBe("true");
    expect(plate.style.backgroundColor).toBe(PLATE_COLOUR);
    expect(screen.getByText("QR unavailable")).toBeInTheDocument();
  });

  it("renders no symbol and keeps the reserved box, so the card never reflows", () => {
    const { container } = renderZone({ payload: UNENCODABLE, cardWidth: 400 });
    const plate = container.querySelector("[data-qr-plate]") as HTMLElement;
    expect(container.querySelector("[data-qr-symbol]")).toBeNull();
    expect(plate.style.width).toBe(`${qrSizePx(400) + 2 * MIN_QUIET_ZONE_PX}px`);
  });

  it("still renders exactly one [data-qr-zone] (AC-11 holds through the failure path)", () => {
    const { container } = renderZone({ payload: UNENCODABLE });
    expect(container.querySelectorAll("[data-qr-zone]")).toHaveLength(1);
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
   The one decode proof that does not need a browser
   ───────────────────────────────────────────────────────────────────────────── */

describe("the rendered symbol actually decodes", () => {
  /**
   * QR-T5 — screenshot the zone and decode it — is T27's, and it needs a real browser.
   * But the raster is only half the risk: the other half is that `<QrZone>` builds its
   * `<path>` by run-length-merging each row, and a bug there would emit a *beautiful*,
   * plausible, undecodable symbol. That failure would then surface in wave 8 as a P0.
   *
   * So: read back the `d` this component actually rendered, rebuild the module grid from
   * it, and put it through the same `jsqr` the ground-truth suite uses. No browser, no
   * screenshot, no anti-aliasing — which means no flake, and a real answer now.
   */

  const SCALE = 8;
  const QUIET_MODULES = 4;

  /** Rebuild the grid from the emitted `M{col} {row}h{run}v1h-{run}z` run segments. */
  function gridFromPath(d: string, moduleCount: number): boolean[][] {
    const grid = Array.from({ length: moduleCount }, () => Array<boolean>(moduleCount).fill(false));
    for (const [, col, row, run] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
      for (let i = 0; i < Number(run); i += 1) grid[Number(row)][Number(col) + i] = true;
    }
    return grid;
  }

  function rasterise(grid: boolean[][]) {
    const moduleCount = grid.length;
    const dim = (moduleCount + 2 * QUIET_MODULES) * SCALE;
    const data = Buffer.alloc(dim * dim * 4, 0xff); // opaque plate, exactly as §8A.3 paints it
    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {
        if (!grid[row][col]) continue;
        for (let y = 0; y < SCALE; y += 1) {
          for (let x = 0; x < SCALE; x += 1) {
            const px = (col + QUIET_MODULES) * SCALE + x;
            const py = (row + QUIET_MODULES) * SCALE + y;
            const at = (py * dim + px) * 4;
            data[at] = 0x0b;
            data[at + 1] = 0x0b;
            data[at + 2] = 0x0b;
          }
        }
      }
    }
    return { width: dim, height: dim, data };
  }

  function renderedGrid(payload: string): boolean[][] {
    const { container } = renderZone({ payload });
    const d = container.querySelector("[data-qr-symbol] path")?.getAttribute("d") ?? "";
    expect(d.length).toBeGreaterThan(0);
    const modules = Number(
      container.querySelector("[data-qr-zone]")?.getAttribute("data-qr-modules"),
    );
    return gridFromPath(d, modules);
  }

  it("emits a path that is module-for-module the encoder's own matrix", () => {
    const expected = QRCode.create(PAYLOAD, { errorCorrectionLevel: ECC_LEVEL }).modules;
    const actual = renderedGrid(PAYLOAD);
    expect(actual).toHaveLength(expected.size);
    for (let row = 0; row < expected.size; row += 1) {
      for (let col = 0; col < expected.size; col += 1) {
        expect(actual[row][col], `module (${row}, ${col})`).toBe(expected.get(row, col) === 1);
      }
    }
  });

  it("decodes to exactly the payload, with no inversion attempt needed", () => {
    const decoded = decodeQrBitmap(rasterise(renderedGrid(PAYLOAD)), {
      inversionAttempts: "dontInvert",
    });
    expect(decoded).toBe(PAYLOAD);
  });

  it("decodes for a payload at the full 60-byte cap", () => {
    const longest = `http://localhost:3000/c/${"a".repeat(MAX_PAYLOAD_BYTES - 25)}`;
    expect(payloadByteLength(longest)).toBe(MAX_PAYLOAD_BYTES - 1);
    expect(decodeQrBitmap(rasterise(renderedGrid(longest)))).toBe(longest);
  });
});
