"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isExportFailedError, type ExportFailureReason } from "@/card/errors";
import { exportCardPng, exportFileName, isExportInFlight } from "@/card/export-card-png";
import { Button } from "@/components/primitives/button";
import { useToast } from "@/components/overlay";
import type { ResolvedCard } from "@/types/domain";

/**
 * "Export PNG" on `/cards/[cardId]` — spec §6.8, §6.9, §11 E-43 / E-44, plan T22.
 *
 * ## The handler, and why its shape is the whole contract
 * T15 designed `exportCardPng` so that a *careless* caller still cannot download two files.
 * This is the shape that design assumes, and it is worth stating why each line is there:
 *
 * ```ts
 * if (isExportInFlight()) return;   // E-43: the second tap does nothing, visibly
 * setBusy(true);
 * try   { save(await exportCardPng(resolved), exportFileName(resolved)); }
 * catch { if (isExportFailedError(e)) toastRetry(e.reason); }
 * finally { setBusy(false); }       // E-44: the spinner is always cleared
 * ```
 *
 * · **`isExportInFlight()` is read, never re-implemented.** T15's guard is module-global
 *   because E-43 counts *files downloaded*, not files per card. A local `busy` boolean would
 *   miss a second tap that arrives before React has re-rendered — which is precisely the
 *   window a double tap lands in.
 * · **`ExportBusyError` is deliberately NOT an `ExportFailedError`.** Nothing failed: the
 *   first export is still producing the one file the user asked for. Narrowing the catch on
 *   `isExportFailedError` therefore shows nothing for a double tap **and never reaches the
 *   download line**, so "exactly one file downloads" holds even if the in-flight guard above
 *   were deleted. Do not "handle" it — surfacing a busy rejection as an error is the one way
 *   to turn a correct double tap into a false failure report.
 * · **`finally` is E-44 in one word.** An export that fails must leave a retry and never a
 *   spinner; a `setBusy(false)` in the happy path only is the bug that row exists to name.
 *
 * ## Three reasons, three sentences
 * §6.8 types the failure with a reason, so the retry copy can say what actually went wrong
 * instead of "something went wrong". `error.message` is never rendered anywhere (§13.1) —
 * only the reason, mapped to copy written for a person.
 */

/** The toast title. One sentence, no error code, no jargon (§6.10). */
export const EXPORT_FAILED_TITLE = "We couldn't export that card";

/** §6.8's three reasons, each with copy that says what to do next (§11 E-44). */
export const EXPORT_RETRY_COPY: Record<ExportFailureReason, string> = {
  "font-not-loaded":
    "The card's typefaces hadn't finished loading, so the image would have come out wrong. Try again in a moment.",
  "image-tainted":
    "An image on this card couldn't be read for export. Try again, or pick a template without a photograph.",
  unknown: "Something went wrong while drawing the image. Try again.",
};

/** §6.9's shape, reused for the raster: object URL → anchor → click → revoke. */
const REVOKE_AFTER_MS = 30_000;

export interface ExportPngButtonProps {
  /** The one `ResolvedCard` the preview, the `.vcf` and the PNG all share (I-5). */
  resolved: ResolvedCard;
  className?: string;
}

export function ExportPngButton({ resolved, className }: ExportPngButtonProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  /** Revoke ids → their object URLs, so a navigation mid-export cannot leak either. */
  const revokes = useRef(new Map<number, string>());
  /** Whether this component is still mounted — a raster outlives a fast navigation. */
  const alive = useRef(true);
  /** The retry the toast action calls. Held in a ref so the handler can offer itself. */
  const retry = useRef<() => void>(() => {});

  useEffect(() => {
    const pending = revokes.current;
    alive.current = true;
    return () => {
      alive.current = false;
      for (const [timer, url] of pending) {
        window.clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      pending.clear();
    };
  }, []);

  const save = useCallback((blob: Blob, fileName: string) => {
    // The blob already carries `image/png` from the rasteriser (§6.8); re-wrapping it would
    // copy 1.4 MB for nothing.
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();

    const revoke = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      revokes.current.delete(revoke);
    }, REVOKE_AFTER_MS);
    revokes.current.set(revoke, url);
  }, []);

  const run = useCallback(async () => {
    // E-43. T15's guard is the module's, not a second copy of it.
    if (isExportInFlight()) return;

    setBusy(true);
    try {
      const blob = await exportCardPng(resolved);
      save(blob, exportFileName(resolved));
    } catch (error) {
      // A busy rejection lands here and is deliberately ignored: it is not a failure, and
      // this branch is also what keeps the `save` above out of reach on a double tap.
      if (isExportFailedError(error) && alive.current) {
        toast({
          tone: "danger",
          title: EXPORT_FAILED_TITLE,
          description: EXPORT_RETRY_COPY[error.reason],
          action: {
            label: "Try again",
            onClick: () => {
              retry.current();
            },
          },
        });
      }
    } finally {
      // E-44: unconditionally, on every path, success and failure alike.
      if (alive.current) setBusy(false);
    }
  }, [resolved, save, toast]);

  useEffect(() => {
    retry.current = () => {
      void run();
    };
  }, [run]);

  return (
    <Button
      variant="secondary"
      data-card-detail-action="export"
      data-export-png=""
      loading={busy}
      loadingLabel="Exporting…"
      className={className}
      onClick={() => {
        void run();
      }}
    >
      Export PNG
    </Button>
  );
}
