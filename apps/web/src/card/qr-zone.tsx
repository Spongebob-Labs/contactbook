import type { CSSProperties, ReactElement } from "react";

import QRCode from "qrcode";

import {
  ECC_LEVEL,
  MAX_PLATE_RADIUS_PX,
  MIN_QUIET_ZONE_PX,
  MODULE_COLOUR,
  PLATE_COLOUR,
  hasMarkClearance,
  isMarkWithinBudget,
  markClearancePx,
  qrGeometry,
  qrSizePx,
  safeMarkSide,
  type QrRenderMode,
} from "@/card/qr-geometry";

/**
 * The component that makes spec §8A unbreakable.
 *
 * A template declares only what may decorate *around* the zone. It cannot influence a single
 * number: the symbol size, the quiet zone and the reserved box are computed here, from the
 * measured face width, and nowhere else.
 *
 * There is no longer an anchor to declare. The share face carries no field list, so the QR
 * has nothing to negotiate vertical space with, and `faceLayout` already determines where in
 * the composition the symbol sits.
 *
 * **The reserved region is `[data-qr-plate]`'s border box.** That is the rectangle nothing
 * else in the card may paint into, and the rectangle QR-T3 measures. The zone root is taller
 * than it whenever there is a caption, because §8A.3 puts the caption *below* the plate and
 * outside the reserved region.
 *
 * Why the plate is a flat opaque fill rather than the frosted panel it visually wants to be:
 * a frosted-glass blur does not rasterise in `html-to-image`, so such a plate would look
 * correct on screen and **vanish from the PNG export** (§6.8, E-27). Four of the six
 * reference templates — water, dark concrete, a cyan court and Lane's magenta→blue mesh —
 * would destroy a translucent scrim outright (§8A.1).
 *
 * Rendered as inline SVG, never canvas: crisp at any device pixel ratio and it rasterises
 * reliably in `html-to-image`. `shape-rendering="crispEdges"` suppresses the anti-aliasing
 * that is the documented flake source in the decode suite (spec §16.1 R-2).
 */

/** A centre mark is optional and nothing in the template schema can request one today. */
export interface QrMark {
  /** One or two characters. Sized by `safeMarkSide`, so it cannot exceed the ECC budget. */
  glyph: string;
}

export interface QrZoneProps {
  /**
   * `resolved.qrPayload`, computed once in `resolveCard` and never re-derived (§8A.6).
   *
   * `null` means the card has no public URL yet — it has not been saved, so the API has not
   * minted its `publicToken`. That renders the pending plate below, never a symbol: a QR that
   * looks live and resolves to nothing is worse than a visible absence, because the person
   * holding the phone has no way to tell the difference until it fails.
   */
  payload: string | null;
  /**
   * A line BELOW the plate, outside the reserved region. Not template-driven any more — the
   * face never captions its symbol, and the scan page passes its own copy.
   */
  caption?: string | null;
  /** Decoration around the plate. Never template-driven; the face passes nothing. */
  decorate?: "none" | "corner-marks" | "rule-above";
  /** The measured card width. `<ShareFace>` measures; container queries, never scale. */
  cardWidth: number;
  mode: QrRenderMode;
  mark?: QrMark | null;
  className?: string;
}

/* ── encoding ───────────────────────────────────────────────────────────────── */

interface EncodedSymbol {
  moduleCount: number;
  /** A single `<path>` `d`. One path, not N rects: adjacent rects leave hairline seams. */
  path: string;
}

/**
 * Encoding is pure and the builder re-renders on every keystroke, so the result is cached by
 * payload. Module scope, not `useMemo` — this component takes no hooks so it renders in a
 * server component as happily as in the client bundle.
 */
const SYMBOL_CACHE = new Map<string, EncodedSymbol | null>();
const SYMBOL_CACHE_LIMIT = 64;

function toPath(modules: QRCode.BitMatrix): string {
  const size = modules.size;
  const parts: string[] = [];
  for (let row = 0; row < size; row += 1) {
    let col = 0;
    while (col < size) {
      if (modules.get(row, col) === 0) {
        col += 1;
        continue;
      }
      let run = 1;
      while (col + run < size && modules.get(row, col + run) === 1) run += 1;
      parts.push(`M${col} ${row}h${run}v1h-${run}z`);
      col += run;
    }
  }
  return parts.join("");
}

/** `null` means the encoder refused the payload — E-30, handled, never thrown at the card. */
function encode(payload: string): EncodedSymbol | null {
  const cached = SYMBOL_CACHE.get(payload);
  if (cached !== undefined) return cached;

  let symbol: EncodedSymbol | null;
  try {
    const qr = QRCode.create(payload, { errorCorrectionLevel: ECC_LEVEL });
    symbol = { moduleCount: qr.modules.size, path: toPath(qr.modules) };
  } catch {
    symbol = null;
  }

  if (SYMBOL_CACHE.size >= SYMBOL_CACHE_LIMIT) SYMBOL_CACHE.clear();
  SYMBOL_CACHE.set(payload, symbol);
  return symbol;
}

/* ── shared styling ─────────────────────────────────────────────────────────── */

/** Distance between the plate edge and a corner tick. Decoration never touches the plate. */
const TICK_GAP_PX = 12;
const TICK_SIZE_PX = 8;

const ROOT_STYLE: CSSProperties = {
  // The zone owns its own stacking context, so no sibling's z-index can lift template art
  // above the symbol. `isolation` creates the context; `position: relative` is what makes a
  // z-index comparison against siblings meaningful at all.
  isolation: "isolate",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--space-2)",
  width: "fit-content",
};

function plateStyle(side: number): CSSProperties {
  return {
    // Solid, fully opaque, no image, no blur (§8A.3). QR-T2 fails on any of those.
    backgroundColor: PLATE_COLOUR,
    // `--c-plate-border` resolves to `transparent` on every palette dark or saturated
    // enough to frame the plate itself, so this is safe to declare unconditionally — and
    // it must be declared unconditionally, because a conditional `border` shorthand that
    // resolves to an invalid value makes the browser drop the whole declaration.
    border: "1px solid var(--c-plate-border, transparent)",
    borderRadius: `${MAX_PLATE_RADIUS_PX}px`,
    width: `${side}px`,
    height: `${side}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    flexShrink: 0,
  };
}

const CAPTION_STYLE: CSSProperties = {
  fontSize: "var(--text-xs)",
  lineHeight: "var(--text-xs-lh)",
  letterSpacing: "var(--text-xs-tracking)",
  textAlign: "center",
  color: "currentColor",
};

/* ── decoration — strictly outside the reserved region (§8A.4) ───────────────── */

const TICK_CORNERS = [
  { key: "tl", top: 0, left: 0, borderTop: true, borderLeft: true },
  { key: "tr", top: 0, right: 0, borderTop: true, borderRight: true },
  { key: "bl", bottom: 0, left: 0, borderBottom: true, borderLeft: true },
  { key: "br", bottom: 0, right: 0, borderBottom: true, borderRight: true },
] as const;

function cornerTicks(): ReactElement[] {
  return TICK_CORNERS.map((corner) => (
    <span
      key={corner.key}
      data-qr-decoration="corner-mark"
      aria-hidden="true"
      style={{
        position: "absolute",
        top: "top" in corner ? corner.top : undefined,
        right: "right" in corner ? corner.right : undefined,
        bottom: "bottom" in corner ? corner.bottom : undefined,
        left: "left" in corner ? corner.left : undefined,
        width: `${TICK_SIZE_PX}px`,
        height: `${TICK_SIZE_PX}px`,
        borderTop: "borderTop" in corner ? "1px solid currentColor" : undefined,
        borderRight: "borderRight" in corner ? "1px solid currentColor" : undefined,
        borderBottom: "borderBottom" in corner ? "1px solid currentColor" : undefined,
        borderLeft: "borderLeft" in corner ? "1px solid currentColor" : undefined,
      }}
    />
  ));
}

function hairline(position: "above" | "below", width: number): ReactElement {
  return (
    <span
      data-qr-decoration={`rule-${position}`}
      aria-hidden="true"
      style={{
        // A real 1px border, never a simulated edge — CSS shadows vanish on export (§8.7).
        display: "block",
        width: `${width}px`,
        borderTop: "1px solid currentColor",
      }}
    />
  );
}

/* ── the modes ──────────────────────────────────────────────────────────────── */

function QrSymbol({
  symbol,
  size,
}: {
  symbol: EncodedSymbol;
  size: number;
}): ReactElement {
  return (
    <svg
      data-qr-symbol=""
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="QR code for this contact card"
      width={size}
      height={size}
      viewBox={`0 0 ${symbol.moduleCount} ${symbol.moduleCount}`}
      // Anti-aliased module edges are what makes a decode marginal. Turn them off.
      shapeRendering="crispEdges"
      style={{ display: "block" }}
    >
      <path d={symbol.path} style={{ fill: MODULE_COLOUR }} />
    </svg>
  );
}

function CentreMark({
  mark,
  qrSize,
  moduleCount,
}: {
  mark: QrMark;
  qrSize: number;
  moduleCount: number;
}): ReactElement | null {
  const side = safeMarkSide(qrSize, moduleCount);
  // Sized from the clearance pad inward, so this is a belt-and-braces check rather than a
  // real branch — but §8A.3 is the one place in this build worth asserting twice.
  if (!isMarkWithinBudget(side, qrSize) || !hasMarkClearance(side, qrSize, moduleCount)) {
    return null;
  }
  const pad = side + 2 * markClearancePx(qrSize, moduleCount);
  return (
    <span
      data-qr-mark-pad=""
      aria-hidden="true"
      style={{
        position: "absolute",
        width: `${pad}px`,
        height: `${pad}px`,
        backgroundColor: PLATE_COLOUR,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        data-qr-mark=""
        data-qr-mark-side={side}
        style={{
          width: `${side}px`,
          height: `${side}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: MODULE_COLOUR,
          fontSize: `${side * 0.5}px`,
          fontWeight: 500,
          lineHeight: 1,
        }}
      >
        {mark.glyph}
      </span>
    </span>
  );
}

/**
 * The `thumb` placeholder (§8A.5).
 *
 * A thumbnail is `transform: scale()`-ed to 0.24–0.5, which would put a real symbol at
 * 34–70px — unscannable. Rendering one there would be a lie, so this encodes **nothing**.
 * The rings are deliberately 1:1:1:1:1 rather than a finder pattern's 1:1:3:1:1, so no
 * decoder can even locate a symbol here. AC-09(h) asserts exactly that.
 */
function PlaceholderGlyph({ size }: { size: number }): ReactElement {
  const ring = (x: number, y: number) => (
    <>
      <path
        key={`${x}-${y}-ring`}
        d={`M${x} ${y}h5v5h-5zM${x + 1} ${y + 1}v3h3v-3z`}
        fillRule="evenodd"
      />
      <path key={`${x}-${y}-dot`} d={`M${x + 2} ${y + 2}h1v1h-1z`} />
    </>
  );
  return (
    <svg
      data-qr-glyph=""
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 21 21"
      shapeRendering="crispEdges"
      style={{ display: "block", fill: MODULE_COLOUR }}
    >
      {ring(0, 0)}
      {ring(16, 0)}
      {ring(0, 16)}
      <path d="M8 2h1v1h-1zM10 4h1v1h-1zM8 6h1v1h-1zM12 8h1v1h-1zM2 9h1v1h-1zM6 10h1v1h-1zM10 10h1v1h-1zM14 11h1v1h-1zM18 9h1v1h-1zM8 13h1v1h-1zM12 14h1v1h-1zM16 15h1v1h-1zM9 17h1v1h-1zM13 18h1v1h-1zM17 19h1v1h-1zM11 20h1v1h-1z" />
    </svg>
  );
}

/* ── the component ──────────────────────────────────────────────────────────── */

export function QrZone({
  payload,
  caption = null,
  decorate = "none",
  cardWidth,
  mode,
  mark = null,
  className,
}: QrZoneProps): ReactElement {
  const size = qrSizePx(cardWidth);

  /**
   * thumb — the card's **real** payload, at thumbnail scale.
   *
   * This used to encode a fixed `CONTACT-BOOK-TEMPLATE-PREVIEW` string on the reasoning that a
   * tile is `transform: scale()`-ed to roughly 200px, putting the symbol near 80px, below the
   * 140px floor for a reliable arm's-length phone scan — so it could never work anyway, and a
   * scanned gallery tile "must not resolve to somebody's real card".
   *
   * Both halves were wrong in practice. The card in a tile is the viewer's **own**, so
   * resolving to it is correct rather than a leak; and a symbol that encodes a lie is worse
   * than a small true one, because a tile enlarged, zoomed or exported then decodes to a
   * string that means nothing. Every QR in this product now carries the card's own URL.
   *
   * The size caveat stands as a physical fact — a tile is not a scanning target, the card page
   * is. What changed is that the tile no longer *pretends* otherwise by carrying fake data.
   */
  if (mode === "thumb") {
    const plateSide = size + 2 * MIN_QUIET_ZONE_PX;
    const preview = payload === null ? null : encode(payload);
    return (
      <div
        data-qr-zone=""
        data-qr-mode="thumb"
        data-qr-pending={payload === null ? "true" : undefined}
        aria-hidden="true"
        className={className}
        style={ROOT_STYLE}
      >
        <div data-qr-plate="" style={plateStyle(plateSide)}>
          {preview === null ? (
            /* No URL yet, or an encoder refusal. A shape rather than a hole — and, unlike a
               fixed dummy string, nothing a decoder can read a false destination out of. */
            <PlaceholderGlyph size={size} />
          ) : (
            <QrSymbol symbol={preview} size={size} />
          )}
        </div>
      </div>
    );
  }

  /* Not saved yet — nothing to encode. An explicit, legible absence, sharing the error plate's
     geometry so the card's composition does not reflow the moment the card is saved. */
  if (payload === null) {
    const plateSide = size + 2 * MIN_QUIET_ZONE_PX;
    return (
      <div
        data-qr-zone=""
        data-qr-mode={mode}
        data-qr-pending="true"
        className={className}
        style={ROOT_STYLE}
      >
        <div data-qr-plate="" style={plateStyle(plateSide)}>
          <span
            style={{
              color: MODULE_COLOUR,
              fontSize: "var(--text-xs)",
              lineHeight: "var(--text-xs-lh)",
              textAlign: "center",
              padding: "var(--space-3)",
              opacity: 0.6,
            }}
          >
            Save the card to activate its QR
          </span>
        </div>
        {caption === null ? null : (
          <span data-qr-caption="" style={{ ...CAPTION_STYLE, maxWidth: `${plateSide}px` }}>
            {caption}
          </span>
        )}
      </div>
    );
  }

  const symbol = encode(payload);

  /* E-30 — the encoder refused. An opaque plate, never a blank; the buttons still work. */
  if (symbol === null) {
    const plateSide = size + 2 * MIN_QUIET_ZONE_PX;
    return (
      <div
        data-qr-zone=""
        data-qr-mode={mode}
        data-qr-error="true"
        className={className}
        style={ROOT_STYLE}
      >
        <div data-qr-plate="" style={plateStyle(plateSide)}>
          <span
            style={{
              color: "var(--danger)",
              fontSize: "var(--text-xs)",
              lineHeight: "var(--text-xs-lh)",
              textAlign: "center",
              padding: "var(--space-3)",
            }}
          >
            QR unavailable
          </span>
        </div>
        {caption === null ? null : (
          <span data-qr-caption="" style={{ ...CAPTION_STYLE, maxWidth: `${plateSide}px` }}>
            {caption}
          </span>
        )}
      </div>
    );
  }

  const geometry = qrGeometry(cardWidth, symbol.moduleCount);
  const marked = decorate === "corner-marks";

  return (
    <div
      data-qr-zone=""
      data-qr-mode={mode}
      data-qr-ecc={ECC_LEVEL}
      /* The width the geometry was derived from. Published because it is no longer inferable
         from the card root: the share face is 360px wide and equals its own host, but the scan
         page is full-bleed and sizes the symbol from its content column instead of the
         viewport. A test that reads the root's width measures the wrong box. */
      data-qr-host={cardWidth}
      data-qr-modules={geometry.moduleCount}
      data-qr-size={geometry.qrSizePx}
      data-qr-quiet={geometry.quietZonePx}
      data-qr-reserved={geometry.reservedPx}
      className={className}
      style={ROOT_STYLE}
    >
      {decorate === "rule-above" ? hairline("above", geometry.reservedPx) : null}

      <div
        style={{
          position: "relative",
          // Ticks live in this padding, so they are outside the plate by construction.
          padding: marked ? `${TICK_GAP_PX}px` : undefined,
        }}
      >
        {marked ? cornerTicks() : null}
        <div data-qr-plate="" style={plateStyle(geometry.reservedPx)}>
          <QrSymbol symbol={symbol} size={geometry.qrSizePx} />
          {mark === null ? null : (
            <CentreMark
              mark={mark}
              qrSize={geometry.qrSizePx}
              moduleCount={geometry.moduleCount}
            />
          )}
        </div>
      </div>

      {caption === null ? null : (
        <span data-qr-caption="" style={{ ...CAPTION_STYLE, maxWidth: `${geometry.reservedPx}px` }}>
          {caption}
        </span>
      )}
    </div>
  );
}
