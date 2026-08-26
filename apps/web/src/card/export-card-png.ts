"use client";

import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import { toBlob } from "html-to-image";

import {
  CARD_DESIGN_HEIGHT,
  CARD_DESIGN_WIDTH,
  ShareFace,
} from "@/card/share-face";
import {
  ExportFailedError,
  isExportFailedError,
  type ExportFailureReason,
} from "@/card/errors";
import type { ResolvedCard } from "@/types/domain";

/**
 * The PNG export — spec §6.8, §7.4, §9.4, §11 E-43/E-44; AC-10.
 *
 * One card, one QR, one file a stranger's phone can still read after it has been through
 * WhatsApp. `<ShareFace mode="export">` is rendered into an offscreen node at the
 * 400 × 860 design canvas and rasterised at `pixelRatio` 2, so the 168 CSS px symbol lands
 * at **336 device px** — comfortably above §8A.3's floor even after a messenger re-encodes it.
 *
 * ## ⚠ The offscreen node is ATTACHED to the document, deliberately
 * Rasterising a detached node is the obvious implementation and it is wrong here. Two things
 * break the moment the node leaves the document:
 *
 *  1. **The QR zone's grid row is a utility class** (`row-start-3` / `row-start-8`,
 *     `card-frame.tsx`). With no stylesheet in scope the zone auto-places into whatever track
 *     is next, which for `bottom-plate` is a collapsed `0px` track — the symbol is clipped to
 *     nothing, with no DOM symptom at all.
 *  2. **`html-to-image` reads computed styles.** A detached subtree computes to initial
 *     values, so the plate loses its opaque fill and the modules lose their colour — §8A.3's
 *     two hardest requirements, both silently.
 *
 * The host is therefore appended to `document.body` and moved off-screen by *position*.
 * Never `display: none`, never `visibility: hidden`, never a zero box: an unrendered node
 * rasterises to an empty PNG, which is the same failure wearing a different hat.
 *
 * ## Why the plate is a flat opaque fill
 * §6.8 and §8A.3 forbid translucent, blurred QR plates inside the card root because that
 * treatment does not survive rasterisation — it looks correct on screen and vanishes from the
 * file. The same reasoning applies to every simulated edge in the card: §8.7's hairlines are
 * real 1px borders precisely so the export keeps them.
 *
 * ## Same-origin only (§7.4)
 * Only `/public` images are rasterised. A remote image taints the canvas and the raster
 * throws; that throw is classified as `image-tainted` rather than swallowed, because a
 * silently blank export is the one outcome worse than a failed one.
 *
 * ## Known limit: the two card-only faces (§8.4, AC-17)
 * The host hangs off `document.body`, not off the route's `cardFontsClassName` wrapper, so
 * Archivo and Bricolage Grotesque resolve to the metric-adjusted fallback stacks
 * `card-frame.tsx` declares — Terminal and Marquee export a shade wider than they render.
 * That is the accepted cost of AC-17's scoping, and it is the same tradeoff `/` and the
 * `(auth)` group already make on screen. Inheriting the wrapper instead would mean either
 * importing `card-fonts.ts` here — which puts both faces into every bundle that can export —
 * or making the export depend on what else happens to be on the page, which is worse.
 * Nothing about the QR changes either way: the symbol is drawn, not typeset.
 *
 * ## What this module is not
 * It does not download anything and it does not toast. The caller owns both, so the screen
 * that knows about the user's tap owns the busy state and the retry (§11 E-43, E-44):
 *
 * ```ts
 * if (isExportInFlight()) return;          // the cheap guard; the module has the backstop
 * setBusy(true);
 * try {
 *   const blob = await exportCardPng(resolved);
 *   save(blob, exportFileName(resolved));  // an object URL + a download anchor, as in §6.9
 * } catch (error) {
 *   if (isExportFailedError(error)) toastRetry(error.reason);  // a busy signal is not a failure
 * } finally {
 *   setBusy(false);                        // E-44: the spinner is always cleared
 * }
 * ```
 */

/* ── the canvas (§6.8) ──────────────────────────────────────────────────────── */

/** 400 CSS px. Re-exported from the frame so the export can never drift from the design. */
/**
 * The export canvas — the face's own design size, which is now a single portrait pair for
 * every template.
 *
 * This was briefly a per-template lookup, back when one composition was landscape. Dropping
 * the landscape composition dropped the need: every card exports to the same raster size,
 * which is also what lets one PNG size serve a wallet pass, a print and a share sheet.
 */
export const CARD_EXPORT_WIDTH = CARD_DESIGN_WIDTH;
/** 860 CSS px, aspect 1 : 2.15. */
export const CARD_EXPORT_HEIGHT = CARD_DESIGN_HEIGHT;

/** §6.8: `2` → 800 × 1720, the size AC-10 decodes. `3` is offered for print, nothing else. */
export type ExportPixelRatio = 2 | 3;
export const DEFAULT_EXPORT_PIXEL_RATIO: ExportPixelRatio = 2;

export const EXPORT_MIME_TYPE = "image/png";

export interface ExportCardPngOptions {
  pixelRatio?: ExportPixelRatio;
}

/** The raster's real pixel size. T27 asserts 800 × 1720 against the decoded PNG's header. */
/** The raster's device-pixel dimensions, for a caller stating the file size up front. */
export function exportPixelSize(
  pixelRatio: ExportPixelRatio = DEFAULT_EXPORT_PIXEL_RATIO,
): { width: number; height: number } {
  return {
    width: CARD_EXPORT_WIDTH * pixelRatio,
    height: CARD_EXPORT_HEIGHT * pixelRatio,
  };
}

/** §6.8's filename. The slug is already `[a-z0-9-]`, ≤ 24 chars (AC-08), so it is safe as-is. */
export function exportFileName(resolved: ResolvedCard): string {
  return `contact-book-${resolved.slug}.png`;
}

/* ── E-43: the in-flight guard ──────────────────────────────────────────────── */

/**
 * Rejected when an export is asked for while one is already running — **E-43, a double tap**.
 *
 * It is deliberately *not* an `ExportFailedError`. Nothing failed: the first export is still
 * producing the one file the user asked for, and E-44's retry toast must not fire on a second
 * tap. A caller that narrows on `isExportFailedError` therefore ignores this by construction,
 * and — the part that matters — never reaches its download line, so exactly one file is saved
 * however carelessly the handler is written.
 */
export class ExportBusyError extends Error {
  /** The card whose export was skipped, so a caller can tell a stale tap from a live one. */
  readonly slug: string;

  constructor(slug: string) {
    super(
      `An export is already in flight; the request for "${slug}" was ignored ` +
        `(spec §11 E-43). Ask again once the running export settles.`,
    );
    this.name = "ExportBusyError";
    this.slug = slug;
  }
}

export function isExportBusyError(value: unknown): value is ExportBusyError {
  return value instanceof ExportBusyError;
}

/**
 * Module scope, not per card: §11 E-43 counts *files downloaded*, not files per card, and one
 * rasteriser working on two 800 × 1720 canvases at once is how the guarantee gets lost.
 * Callers that want to export several cards do it sequentially.
 */
let inFlight = false;

/** For the caller's disabled/busy state (E-43). Always false once the promise settles (E-44). */
export function isExportInFlight(): boolean {
  return inFlight;
}

/* ── the offscreen host ─────────────────────────────────────────────────────── */

/** Far enough off-screen that no scroll position can bring it into view. */
const OFFSCREEN_PX = 10000;

function createHost(size: { width: number; height: number }): HTMLDivElement {
  const host = document.createElement("div");
  host.setAttribute("data-card-export-host", "");
  host.setAttribute("aria-hidden", "true");

  // Off-screen by position only — see the note above on why `display`/`visibility` are fatal.
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = `-${OFFSCREEN_PX}px`;
  host.style.width = `${size.width}px`;
  host.style.height = `${size.height}px`;
  host.style.pointerEvents = "none";

  return host;
}

/* ── the two gates before the raster ────────────────────────────────────────── */

/**
 * Let every same-origin image finish before the raster (§7.4, §11 E-21).
 *
 * A photographic template whose image is still in flight rasterises as an empty zone; one
 * that 404s gets its `onError`, and awaiting here is what gives `<ShareFace>` the chance
 * to fall back to the palette ground *before* the file is written rather than after.
 * A rejected decode is not an export failure — the fallback is the correct render.
 */
async function settleImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      if (typeof image.decode !== "function") return;
      try {
        await image.decode();
      } catch {
        // Handled by the renderer's media fallback; never by failing the export.
      }
    }),
  );
}

/**
 * `await document.fonts.ready` — the plan's one explicit ordering requirement.
 *
 * It runs **after** the mount on purpose: mounting a card is itself what triggers the two
 * card-only faces to load, so waiting first would wait on the wrong thing. A face that swaps
 * mid-raster re-flows the name and the bio inside a file nobody re-checks, which is exactly
 * what `font-not-loaded` names.
 *
 * The second settle is not belt-and-braces: `ready` resolves for the loads known when it was
 * read, and the mount can start one more in that same tick. Two settles is the point at which
 * a still-loading face is a real problem rather than a race, and failing there gives the user
 * E-44's retry instead of a card typeset in a fallback.
 *
 * An environment with no Font Loading API has nothing to wait on and nothing to assert, so it
 * proceeds — refusing to export there would fail every such export permanently.
 */
async function settleFonts(): Promise<void> {
  const fonts: FontFaceSet | undefined = document.fonts;
  if (fonts === undefined) return;

  try {
    await fonts.ready;
    if (fonts.status !== "loading") return;
    await fonts.ready;
  } catch (cause) {
    throw new ExportFailedError("font-not-loaded", cause);
  }

  if (fonts.status === "loading") throw new ExportFailedError("font-not-loaded");
}

/* ── the raster ─────────────────────────────────────────────────────────────── */

/**
 * §7.4's tainted canvas and its neighbours, mapped onto §6.8's three reasons.
 *
 * The rasteriser reports a cross-origin resource as a `SecurityError` from the canvas or as a
 * refusal to embed; both mean the same thing to a user — an image on this card is not
 * same-origin — and both get the reason whose retry copy says so.
 */
const TAINT_MARKERS = ["securityerror", "tainted", "cross-origin", "crossorigin"] as const;

export function exportFailureReasonFor(cause: unknown): ExportFailureReason {
  const error = cause instanceof Error ? cause : null;
  const text = `${error?.name ?? ""} ${error?.message ?? String(cause)}`.toLowerCase();

  if (TAINT_MARKERS.some((marker) => text.includes(marker))) return "image-tainted";
  if (text.includes("font")) return "font-not-loaded";
  return "unknown";
}

async function rasterise(
  node: HTMLElement,
  pixelRatio: ExportPixelRatio,
  size: { width: number; height: number },
): Promise<Blob> {
  let blob: Blob | null;
  try {
    blob = await toBlob(node, {
      // The node is already pinned to the canvas; stating it again keeps the raster
      // independent of anything a page's own layout might do to the host.
      width: size.width,
      height: size.height,
      pixelRatio,
      type: EXPORT_MIME_TYPE,
      cacheBust: false,
    });
  } catch (cause) {
    throw new ExportFailedError(exportFailureReasonFor(cause), cause);
  }

  // The rasteriser resolves `null` when the canvas produced nothing. There is no partial
  // success here: a card without a readable QR is not a card (§8A).
  if (blob === null) throw new ExportFailedError("unknown");
  return blob;
}

async function renderAndRasterise(
  resolved: ResolvedCard,
  pixelRatio: ExportPixelRatio,
): Promise<Blob> {
  if (typeof document === "undefined") throw new ExportFailedError("unknown");

  const size = { width: CARD_EXPORT_WIDTH, height: CARD_EXPORT_HEIGHT };
  const host = createHost(size);
  document.body.appendChild(host);
  let root: Root | null = null;

  try {
    const created = createRoot(host);
    root = created;

    // Synchronous on purpose: the node has to exist, and be laid out, before anything below
    // measures or rasterises it. A concurrent render would hand the rasteriser an empty host.
    flushSync(() => {
      created.render(createElement(ShareFace, { resolved, mode: "export" }));
    });

    const node = host.querySelector<HTMLElement>("[data-card-root]");
    if (node === null) throw new ExportFailedError("unknown");

    await settleImages(node);
    await settleFonts();

    return await rasterise(node, pixelRatio, size);
  } finally {
    root?.unmount();
    host.remove();
  }
}

/**
 * §6.8: render the card offscreen at 400 × 860, rasterise at `pixelRatio` (default `2`), and
 * resolve an `image/png` blob. Rejects with {@link ExportFailedError} carrying a typed reason,
 * or with {@link ExportBusyError} when one is already running (E-43).
 *
 * The busy flag is cleared in a `finally`, so a failed export always leaves a retry and never
 * a spinner (E-44).
 */
export async function exportCardPng(
  resolved: ResolvedCard,
  options: ExportCardPngOptions = {},
): Promise<Blob> {
  if (inFlight) throw new ExportBusyError(resolved.slug);
  inFlight = true;

  try {
    return await renderAndRasterise(
      resolved,
      options.pixelRatio ?? DEFAULT_EXPORT_PIXEL_RATIO,
    );
  } catch (cause) {
    // The rejection contract is closed. Anything the render or the rasteriser throws leaves
    // here as an `ExportFailedError` with one of §6.8's three reasons, so the caller's toast
    // never has to interpret a raw throw and E-44's retry always has copy to show.
    if (isExportFailedError(cause)) throw cause;
    throw new ExportFailedError(exportFailureReasonFor(cause), cause);
  } finally {
    inFlight = false;
  }
}
