/**
 * The QR contract as arithmetic — spec §8A.3 and §8A.6.
 *
 * A QR code is a functional optical target and the only element in this design system that
 * can be *objectively wrong*. Every number below is transcribed from §8A.3, not derived, not
 * rounded and not tuned by eye. `<QrZone>` is the only component that may compute a QR box;
 * a template declares an anchor and nothing else (§8A.4).
 *
 * Pure module: no React, no DOM, no `window`. That is deliberate — `tests/unit`, the
 * Playwright suites in T27 and the export path in T15 all need these numbers, and two of
 * those three have no browser.
 *
 * ⚠ If a decode ever proves marginal, the sanctioned fix is to raise `MIN_QR_SIZE_PX` from
 * 140 to 160 (spec §16.1 R-2). It is NEVER to relax an assertion downstream.
 */

/* ── the geometry table (§8A.3) ─────────────────────────────────────────────── */

/** Share of the card width the symbol claims, between the floor and the ceiling. */
export const QR_WIDTH_RATIO = 0.42;

/** Hard floor. 140 CSS px is the smallest reliable arm's-length scan off a phone screen. */
export const MIN_QR_SIZE_PX = 140;

/** Hard ceiling. Past this the symbol starts eating the action row's vertical budget. */
export const MAX_QR_SIZE_PX = 200;

/** Absolute quiet-zone floor, all four sides. Below it scanners fail outright. */
export const MIN_QUIET_ZONE_PX = 16;

/** The QR specification's own quiet-zone minimum, in modules. */
export const QUIET_ZONE_MODULES = 4;

/** `--radius-xs`. A larger radius clips the quiet zone at the plate's corners. */
export const MAX_PLATE_RADIUS_PX = 4;

/** Centre occlusion budget, as a share of the symbol's area. ECC H recovers ~30%. */
export const MAX_MARK_AREA_RATIO = 0.2;

/** The side ratio §8A.3 states alongside the area cap: 0.447² = 0.199809 ≤ 0.2. */
export const MARK_MAX_SIDE_RATIO = 0.447;

/** Plate-coloured clearance required around a centre mark, in modules. */
export const MIN_MARK_CLEARANCE_MODULES = 2;

/** Module-to-plate contrast floor. Far above WCAG: scanners binarise and margin is cheap. */
export const MIN_MODULE_CONTRAST = 15;

/**
 * The optical constants, as token references rather than literals.
 *
 * `--qr-module` on `--qr-plate` measures 19.68:1. Both values live in
 * `src/styles/tokens.css` and only there — F-01 forbids a colour literal anywhere else, and
 * duplicating them here would create exactly the drift AC-12 exists to catch.
 */
export const MODULE_COLOUR = "var(--qr-module)";
export const PLATE_COLOUR = "var(--qr-plate)";

/* ── the encoder contract (§8A.6) ───────────────────────────────────────────── */

/** ECC H (~30% recovery). This is what legalises centre occlusion at all. */
export const ECC_LEVEL = "H" as const;

/** The encoder draws no margin: `<QrZone>` paints the quiet zone so the plate owns it. */
export const ENCODER_MARGIN = 0;

/** 60 bytes at ECC H keeps the symbol small enough to stay well above the camera threshold. */
export const MAX_PAYLOAD_BYTES = 60;

/** The three render modes of `<ShareFace>` (spec §6.5). */
export type QrRenderMode = "full" | "thumb" | "export";

/* ── the functions ──────────────────────────────────────────────────────────── */

function isUsable(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * `qrSizePx = max(140, min(0.42 × cardWidth, 200))`.
 *
 * An unmeasured card — a `ResizeObserver` reporting 0 before first layout, or a detached
 * node reporting `NaN` — resolves to the floor rather than to a nonsense value. The floor is
 * never negotiated downward, not even by a measurement bug.
 */
export function qrSizePx(cardWidth: number): number {
  if (!isUsable(cardWidth)) return MIN_QR_SIZE_PX;
  return Math.max(MIN_QR_SIZE_PX, Math.min(QR_WIDTH_RATIO * cardWidth, MAX_QR_SIZE_PX));
}

/** Rendered size of a single module, in CSS px. */
export function modulePx(qrSize: number, moduleCount: number): number {
  if (!isUsable(moduleCount)) return 0;
  return qrSize / moduleCount;
}

/**
 * `quietZonePx = max(16, ceil(4 × qrSizePx / moduleCount))`, on all four sides.
 *
 * Note the `ceil` wraps the whole product, per §8A.3 — rounding the module size first and
 * multiplying afterwards yields a different, smaller number.
 */
export function quietZonePx(qrSize: number, moduleCount: number): number {
  if (!isUsable(moduleCount)) return MIN_QUIET_ZONE_PX;
  return Math.max(MIN_QUIET_ZONE_PX, Math.ceil((QUIET_ZONE_MODULES * qrSize) / moduleCount));
}

/** The reserved region: the symbol plus a quiet zone on every side. Always square. */
export function reservedBox(cardWidth: number, moduleCount: number): number {
  const size = qrSizePx(cardWidth);
  return size + 2 * quietZonePx(size, moduleCount);
}

/** The largest side §8A.3 permits a centre mark: `0.447 × qrSize` (0.447² ≤ 20% area). */
export function markMaxSide(qrSize: number): number {
  return MARK_MAX_SIDE_RATIO * qrSize;
}

/** Two modules of plate-coloured clearance, in CSS px. */
export function markClearancePx(qrSize: number, moduleCount: number): number {
  return MIN_MARK_CLEARANCE_MODULES * modulePx(qrSize, moduleCount);
}

/**
 * The largest mark whose **clearance pad** — not merely the mark — still fits the 20% budget.
 *
 * §8A.3 caps the mark's own area and separately requires ≥ 2 modules of clearance, but it is
 * the pad that actually occludes modules. Sizing from the pad inward is the stricter reading,
 * and `<QrZone>` uses it so an in-budget mark is a structural property rather than a caller's
 * responsibility.
 */
export function safeMarkSide(qrSize: number, moduleCount: number): number {
  return Math.max(0, markMaxSide(qrSize) - 2 * markClearancePx(qrSize, moduleCount));
}

/** AC-09f: a mark's area is at most 20% of the symbol's. */
export function isMarkWithinBudget(markSide: number, qrSize: number): boolean {
  if (!isUsable(markSide) || !isUsable(qrSize)) return false;
  return markSide <= markMaxSide(qrSize) && markSide ** 2 / qrSize ** 2 <= MAX_MARK_AREA_RATIO;
}

/** AC-09f: the mark plus its clearance pad still fits the occlusion budget. */
export function hasMarkClearance(
  markSide: number,
  qrSize: number,
  moduleCount: number,
): boolean {
  if (!isUsable(markSide) || !isUsable(qrSize) || !isUsable(moduleCount)) return false;
  const pad = markSide + 2 * markClearancePx(qrSize, moduleCount);
  return pad ** 2 / qrSize ** 2 <= MAX_MARK_AREA_RATIO;
}

/** UTF-8 octets, which is what the ≤ 60-byte payload cap counts (§8A.6, AC-08). */
export function payloadByteLength(payload: string): number {
  return new TextEncoder().encode(payload).length;
}

/**
 * Every number a renderer, an exporter or a pixel test needs, computed once.
 *
 * `moduleCount` is a required argument, never defaulted: the quiet zone is four *modules*
 * wide, so a guessed module count silently changes the reserved box. The encoder always
 * knows the real count and `<QrZone>` publishes it as `data-qr-modules`.
 */
export interface QrGeometry {
  cardWidth: number;
  moduleCount: number;
  qrSizePx: number;
  modulePx: number;
  quietZonePx: number;
  reservedPx: number;
  plateRadiusPx: number;
  markMaxSidePx: number;
  markClearancePx: number;
}

export function qrGeometry(cardWidth: number, moduleCount: number): QrGeometry {
  const size = qrSizePx(cardWidth);
  return {
    cardWidth,
    moduleCount,
    qrSizePx: size,
    modulePx: modulePx(size, moduleCount),
    quietZonePx: quietZonePx(size, moduleCount),
    reservedPx: size + 2 * quietZonePx(size, moduleCount),
    plateRadiusPx: MAX_PLATE_RADIUS_PX,
    markMaxSidePx: markMaxSide(size),
    markClearancePx: markClearancePx(size, moduleCount),
  };
}
