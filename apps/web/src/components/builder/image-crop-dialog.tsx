"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";

import { Button } from "@/components/primitives/button";
import { Dialog } from "@/components/overlay";
import {
  MAX_SCALE,
  centre,
  clampOffset,
  coverTransform,
  displaySize,
  outputSize,
  panBy,
  sourceRect,
  zoomTo,
  type CropFrame,
  type CropSource,
  type CropTransform,
} from "@/lib/image-crop";
import { cn } from "@/lib/cn";

/**
 * THE CROP DIALOG — "which part of this photograph is the picture?"
 *
 * ## What it is for
 *
 * Uploading a cover used to be the whole interaction: the file was downscaled and handed
 * straight to the card, which drew it `object-fit: cover` at a fixed `object-position: 50% 28%`.
 * For the client's own upload that took a full-length photograph and rendered a head. The card
 * was not wrong — one fixed position cannot be right for every photograph — it simply had no
 * way to be told what to keep.
 *
 * So this opens **after the file is chosen and before anything is saved**, showing the aperture
 * the image will actually land in, and the owner composes into it.
 *
 * ## ⚠ The frame's aspect is the DESTINATION's, never a generic square
 *
 * A cropper that shows a square while the card shows a 1:0.7 letterbox has not solved the
 * problem, it has moved it: the owner composes a picture they never see. `aspect` is passed in
 * by the caller from the real geometry — `COVER_RATIO.photo` for the cover, 1 for the badge —
 * so what is inside the rectangle here is exactly what appears on the card.
 *
 * ## ⚠ Why the crop is BAKED into the saved image rather than stored as a transform
 *
 * Keeping `{scale, x, y}` beside the URL and re-applying it at render is the tidier model, and
 * it is the wrong one here, for reasons that are about this codebase rather than about croppers:
 *
 * 1. The card renders on **four** surfaces — the builder preview, `/cards/{id}`, the public
 *    `/c/{slug}` page and the PNG export. A transform has to reach all four intact, and the
 *    public page is served from the API, which has no column for it. The cover would compose
 *    correctly for its owner and revert to the old bad crop for the person it was sent to.
 * 2. `html-to-image` serialises the DOM for the PNG export. A baked image is one `<img>` that
 *    survives that; a transform inside an overflow-hidden frame is two elements whose
 *    relationship has to survive it.
 *
 * A baked image is correct on every surface by construction, and costs a re-crop rather than an
 * adjust if the owner later changes their mind. {@link outputSize} keeps the baked result inside
 * the `localStorage` budget the cover shares with the rest of the app.
 *
 * ## The grid
 *
 * Thirds, drawn over the aperture. It is not decoration: the thing an owner is almost always
 * doing here is deciding how much headroom to leave, and a thirds grid is the standard tool for
 * exactly that judgement. It is `aria-hidden` — it guides the eye and says nothing a screen
 * reader needs.
 */

export interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The image being composed. A data URL, so the canvas is never tainted. */
  src: string | null;
  /** Output aspect as width ÷ height. The card's real geometry, not a guess. */
  aspect: number;
  /** Longest edge of the baked result, in pixels. */
  maxEdge: number;
  title: string;
  description?: string;
  /** Applied with the baked image. The caller decides where it is stored. */
  onApply: (dataUrl: string) => void;
}

/**
 * A baked crop as a `File`, for the one consumer that uploads rather than stores inline.
 *
 * ⚠ The logo and the cover take **different things**: `CoverPicker` keeps a data URL in the
 * local draft, while `LogoPicker` hands a `File` to a real multipart upload. The dialog emits
 * the data URL because that is what it can produce without knowing either destination, and this
 * converts for the uploading side — rather than the dialog growing a second output mode, or the
 * logo path losing the crop because the shapes did not line up.
 */
export function dataUrlToFile(dataUrl: string, name: string): File {
  const comma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, comma);
  const type = /:(.*?);/.exec(meta)?.[1] ?? "image/jpeg";
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type });
}

/** JPEG rather than PNG: a photograph, and the cover shares a ~5MB `localStorage` budget. */
const QUALITY = 0.86;

export function ImageCropDialog({
  open,
  onOpenChange,
  src,
  aspect,
  maxEdge,
  title,
  description,
  onApply,
}: ImageCropDialogProps): ReactElement {
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);

  /* Carries the `src` it was decoded from, so a stale source from the previous image can never
     be used to compose the next one — the sizes differ and the crop would be silently wrong. */
  const [source, setSource] = useState<({ src: string } & CropSource) | null>(null);
  const [frame, setFrame] = useState<CropFrame>({ width: 0, height: 0 });
  /**
   * ⚠ `null` means "not composed yet", and is resolved to {@link coverTransform} at render.
   *
   * Seating it from an effect instead is the obvious shape and is wrong twice over: it is
   * derived state, which `react-hooks/set-state-in-effect` rejects, and it costs a render at
   * exactly the moment the dialog opens — so the first painted frame is an unseated crop and
   * the image visibly jumps. Resolving at render means the first frame is already correct, and
   * it makes Reset a one-liner: drop back to `null`.
   */
  const [transform, setTransform] = useState<CropTransform | null>(null);
  const [failed, setFailed] = useState(false);
  const [baking, setBaking] = useState(false);

  /* ── Load the source and read its natural size ─────────────────────────────────────────
     Through an `Image` rather than the rendered element, because the transform has to be
     computable before anything is painted — `naturalWidth` on a not-yet-decoded `<img>` is 0,
     which the geometry treats as degenerate and would open the dialog blank. */
  useEffect(() => {
    /* No `setState` in this body — only in the decode callbacks, which are asynchronous. A
       synchronous reset here would cascade a render on every open, and the render-time guards
       below already ignore a source that does not belong to the current `src`. */
    if (!open || src === null) return;
    let active = true;
    const img = new window.Image();
    img.onload = () => {
      if (!active) return;
      imageRef.current = img;
      setSource({ src, width: img.naturalWidth, height: img.naturalHeight });
      /* A new image is a new composition; drop back to its own cover crop. */
      setTransform(null);
      setFailed(false);
    };
    img.onerror = () => {
      if (active) setFailed(true);
    };
    img.src = src;
    return () => {
      active = false;
    };
  }, [open, src]);

  /**
   * ── Measure the aperture ──────────────────────────────────────────────────────────────
   *
   * ⚠ **A callback ref, NOT a `useLayoutEffect` keyed on `open`** — and this is a fix, not a
   * preference. The dialog's content is portalled and Radix mounts it only while open, so on the
   * render where `open` flips true the effect could run before the node attached: it read
   * `frameRef.current === null`, returned early, and never tried again. The frame stayed 0 wide
   * for the life of the dialog, which made `displaySize` return 0×0 — so the image rendered at
   * zero size and "Use this crop" sat permanently disabled. The dialog looked completely correct
   * and did nothing, which is the worst shape a bug can take.
   *
   * A callback ref fires exactly when the node attaches, whenever that is, and React 19 runs the
   * returned function on detach — so there is no ordering to get wrong.
   */
  const measureFrame = useCallback(
    (el: HTMLDivElement | null) => {
      frameRef.current = el;
      if (el === null) return;
      const measure = () => {
        const width = el.clientWidth;
        if (width > 0) setFrame({ width, height: width / aspect });
      };
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      return () => observer.disconnect();
    },
    [aspect],
  );

  /* The source only counts once it belongs to the `src` currently being composed. */
  const live = source !== null && source.src === src ? source : null;
  const seated: CropTransform =
    transform ?? (live !== null && frame.width > 0 ? coverTransform(live, frame) : { scale: 1, x: 0, y: 0 });

  const update = useCallback(
    (next: (t: CropTransform) => CropTransform) => {
      if (live === null || frame.width <= 0) return;
      setTransform((current) => {
        const from = current ?? coverTransform(live, frame);
        return clampOffset(next(from), live, frame);
      });
    },
    [live, frame],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (live === null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.id !== event.pointerId || live === null) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    update((t) => panBy(t, live, frame, dx, dy));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.id === event.pointerId) dragRef.current = null;
  };

  /* Keyboard parity for the drag. A pointer-only cropper is unusable without a mouse, and the
     arrows are the obvious expectation once the aperture has focus. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (live === null) return;
    const step = event.shiftKey ? 24 : 6;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move === undefined) return;
    event.preventDefault();
    update((t) => panBy(t, live, frame, move[0], move[1]));
  };

  const displayed = live === null ? { width: 0, height: 0 } : displaySize(live, frame, seated.scale);

  const apply = async () => {
    const img = imageRef.current;
    if (img === null || live === null || frame.width <= 0) return;
    setBaking(true);
    try {
      const rect = sourceRect(seated, live, frame);
      const out = outputSize(frame, maxEdge);
      const canvas = document.createElement("canvas");
      canvas.width = out.width;
      canvas.height = out.height;
      const ctx = canvas.getContext("2d");
      if (ctx === null) throw new Error("no 2d context");
      /* White beneath, for the same reason `image-to-data-url.ts` does it: a PNG with
         transparency flattened into JPEG comes out black otherwise. */
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, out.width, out.height);
      onApply(canvas.toDataURL("image/jpeg", QUALITY));
      onOpenChange(false);
    } catch {
      setFailed(true);
    } finally {
      setBaking(false);
    }
  };

  const ready = live !== null && frame.width > 0 && !failed;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description ?? "Drag to move, and use the slider to zoom. What you see inside the frame is what the card shows."}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="text-link"
            data-crop-reset=""
            disabled={!ready}
            onClick={() => setTransform(null)}
          >
            Reset
          </Button>
          <Button variant="secondary" data-crop-cancel="" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-crop-apply=""
            disabled={!ready}
            loading={baking}
            loadingLabel="Saving…"
            onClick={() => void apply()}
          >
            Use this crop
          </Button>
        </div>
      }
    >
      <div data-image-crop="" className="flex flex-col gap-4">
        {failed ? (
          <p className="rounded-md border border-line bg-surface px-4 py-6 text-center text-sm text-ink-3">
            That image could not be read. Try a JPEG, PNG or WebP.
          </p>
        ) : (
          <>
            {/* The aperture. `touch-none` so a drag composes the picture instead of scrolling
                the dialog on a phone — without it the control is unusable on the device most
                covers are uploaded from. */}
            <div
              ref={measureFrame}
              data-crop-frame=""
              role="application"
              aria-label="Drag to reposition the image. Arrow keys nudge, shift for larger steps."
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onKeyDown}
              className={cn(
                "relative w-full touch-none overflow-hidden rounded-lg border border-line",
                "bg-surface-sunk select-none",
                live === null ? "" : "cursor-grab active:cursor-grabbing",
              )}
              style={{ aspectRatio: `${aspect}` }}
            >
              {src === null || live === null ? null : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: `${displayed.width}px`,
                    height: `${displayed.height}px`,
                    transform: `translate(${seated.x}px, ${seated.y}px)`,
                    maxWidth: "none",
                    display: "block",
                  }}
                />
              )}

              {/* Thirds. Pure guidance — see the note above on why it earns its place. */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                {[1, 2].map((n) => (
                  <span
                    key={`v${n}`}
                    className="absolute top-0 bottom-0 w-px bg-canvas/40"
                    style={{ left: `${(n * 100) / 3}%` }}
                  />
                ))}
                {[1, 2].map((n) => (
                  <span
                    key={`h${n}`}
                    className="absolute right-0 left-0 h-px bg-canvas/40"
                    style={{ top: `${(n * 100) / 3}%` }}
                  />
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3">
              <span className="text-overline uppercase text-ink-3">Zoom</span>
              <input
                type="range"
                data-crop-zoom=""
                min={1}
                max={MAX_SCALE}
                step={0.01}
                value={seated.scale}
                disabled={!ready}
                aria-label="Zoom"
                className="h-1 w-full flex-1 cursor-pointer appearance-none rounded-full bg-surface-sunk accent-accent"
                onChange={(event) => {
                  if (live === null) return;
                  const next = Number(event.target.value);
                  setTransform((t) => zoomTo(t ?? coverTransform(live, frame), live, frame, next));
                }}
              />
              <span className="w-10 text-right text-sm tabular-nums text-ink-3">
                {seated.scale.toFixed(1)}×
              </span>
            </label>

            <Button
              variant="text-link"
              data-crop-centre=""
              disabled={!ready}
              onClick={() => live !== null && setTransform((t) => centre(t ?? coverTransform(live, frame), live, frame))}
              className="self-start"
            >
              Centre the image
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
}
