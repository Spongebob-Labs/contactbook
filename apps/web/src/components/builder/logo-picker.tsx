"use client";

import { useRef, useState, type ReactElement } from "react";

import { Button } from "@/components/primitives/button";

import { ImageCropDialog, dataUrlToFile } from "@/components/builder/image-crop-dialog";
import { imageToDataUrl } from "@/lib/image-to-data-url";

/**
 * **Logo** — the card's brand mark, and the one control on this screen that sends a file.
 *
 * ## Why it sits in Design and not in Fields
 *
 * A logo is not a field. It has no value the owner could type, it is not part of the curated
 * subset `PUT /cards/{id}/fields` replaces, and it never reaches the `.vcf`. It is the same kind
 * of decision as the colour and the finish — what the card *looks like* — so it belongs in the
 * same panel, under its own group, as the first thing in it: a mark is read before a surface is.
 *
 * ## ⚠ Two commit behaviours, and the owner is not told which one they are in
 *
 * On a card that exists, choosing a file **uploads it immediately**; removing deletes it
 * immediately. On `/cards/new` there is no card to address, so the file is held and travels as
 * the `file` part of `POST /cards`.
 *
 * That split is forced rather than chosen, and it is deliberately invisible: in both cases the
 * preview shows the logo the instant it is picked, and in both cases the owner has done one
 * thing. The screen does not explain the difference because the difference is ours, not theirs —
 * see `builder-client.tsx` for the two code paths and `BuilderState.logoFile` for why a pending
 * state exists at all on a screen whose rule is that nothing pends.
 *
 * ## The control is a real `<input type="file">`
 *
 * `sr-only`, not `hidden`: a hidden input is unreachable by keyboard and unannounced by a screen
 * reader, and the button in front of it would then be a control that only a mouse can operate.
 * The same pattern as the profile photo's — see `identity-block.tsx`, which this deliberately
 * mirrors rather than reinvents, so two uploads on two screens behave identically.
 */

export interface LogoPickerProps {
  /**
   * What to draw in the thumbnail: the uploaded logo, or the object URL of a file waiting to be
   * uploaded. `null` when the card has neither.
   */
  logoUrl: string | null;
  /** A request is in flight — upload or remove. Both controls go inert. */
  busy: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}

/**
 * ⚠ The `accept` list and the API's allow-list are the same three types, and they have to be:
 * a file the picker offers and the API rejects is a `LOGO_TYPE_UNSUPPORTED` the owner was
 * invited to trigger. `accept` is a hint the browser may let a user override, so the API's
 * rejection is still handled — this only stops the obvious case at the file dialog.
 */
const ACCEPT = "image/jpeg,image/png,image/webp";

/* The badge is square on the card (`BADGE × BADGE`, `object-fit: cover`), so the aperture is
   square too — a logo composed in a letterbox would be re-cropped by the badge and the owner
   would never see what they chose. */
const LOGO_ASPECT = 1;
const LOGO_MAX_EDGE = 512;

export function LogoPicker({ logoUrl, busy, onPick, onRemove }: LogoPickerProps): ReactElement {
  const [cropping, setCropping] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div data-logo-picker="" className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        data-logo-input=""
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          /* Reset first: choosing the same file twice must fire `change` both times, and it will
             not while the input still holds the previous selection. That is not a hypothetical
             here — re-picking the file you just cropped is the normal way this control is used a
             second time. */
          event.target.value = "";
          if (file === undefined) return;
          /* Downscale, then compose, then upload the baked square — the raw file never reaches
             `onPick`, so what is uploaded is exactly what the owner framed. */
          setReading(true);
          void imageToDataUrl(file)
            .then((result) => setCropping(result.dataUrl))
            .finally(() => setReading(false));
        }}
      />

      <LogoThumb logoUrl={logoUrl} />

      <div className="flex flex-col items-start gap-1">
        <Button
          variant="secondary"
          data-logo-upload=""
          loading={busy || reading}
          loadingLabel="Uploading…"
          onClick={() => inputRef.current?.click()}
        >
          {logoUrl === null ? "Add logo" : "Replace"}
        </Button>

        {logoUrl === null ? null : (
          <>
            {/* Re-frames the saved square. "Replace" is the way back to the original file — see
                the same note on `CoverPicker`. */}
            <Button
              variant="text-link"
              data-logo-adjust=""
              disabled={busy}
              onClick={() => setCropping(logoUrl)}
            >
              Adjust
            </Button>
            <Button variant="text-link" data-logo-remove="" disabled={busy} onClick={onRemove}>
              Remove
            </Button>
          </>
        )}
      </div>

      <ImageCropDialog
        open={cropping !== null}
        onOpenChange={(next) => {
          if (!next) setCropping(null);
        }}
        src={cropping}
        aspect={LOGO_ASPECT}
        maxEdge={LOGO_MAX_EDGE}
        title="Position your logo"
        onApply={(dataUrl) => {
          onPick(dataUrlToFile(dataUrl, "logo.jpg"));
          setCropping(null);
        }}
      />
    </div>
  );
}

/**
 * The current logo, or the empty box that stands in for one.
 *
 * ⚠ **The box is drawn whether or not there is a logo.** An empty slot that appeared only once
 * something had been uploaded would leave the row with nothing to anchor the buttons against and
 * would shift them sideways the first time a file was picked. It also says, before anything is
 * chosen, what shape the thing being asked for is.
 *
 * `object-contain` on a fixed box, for the same reason the card renders it that way: a logo is a
 * mark with edges somebody drew, and a thumbnail that cropped it would misrepresent what the
 * card is about to show. The checkerboard-free neutral ground is deliberate — a transparent PNG
 * reads against the panel's own surface here, which is close enough to how it will read on a
 * pale card and much closer than a chequerboard would be.
 */
function LogoThumb({ logoUrl }: { logoUrl: string | null }): ReactElement {
  return (
    <span
      data-logo-thumb={logoUrl === null ? "empty" : "set"}
      className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-sunk"
    >
      {logoUrl === null ? (
        <span aria-hidden="true" className="text-overline uppercase text-ink-4">
          Logo
        </span>
      ) : (
        /* A plain <img>: this is an arbitrary storage URL or a `blob:` object URL, and next/image
           optimises neither — a blob URL it cannot fetch server-side at all. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={logoUrl}
          alt=""
          className="size-full object-contain"
        />
      )}
    </span>
  );
}
