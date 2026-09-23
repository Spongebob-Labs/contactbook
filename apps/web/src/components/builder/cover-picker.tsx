"use client";

import { useRef, useState, type ReactElement } from "react";

import { COVER_RATIO } from "@/card/card-page";
import { ImageCropDialog } from "@/components/builder/image-crop-dialog";

import { Button } from "@/components/primitives/button";
import { dataUrlToFile, imageToDataUrl } from "@/lib/image-to-data-url";

/**
 * THE COVER PICKER — the photograph behind the card's hero.
 *
 * ## ⚠ THE COVER IS PERSISTED NOW, THROUGH AN UPLOAD — NOT THROUGH SAVE
 *
 * `Card.coverUrl` is a real column, written by `POST /cards/{id}/cover` and by nothing else:
 * `PATCH /cards/{id}` rejects any actual URL string and accepts only `null`, to remove one. So
 * this component is shaped like `LogoPicker` — it hands the composed bytes up and the builder
 * uploads them immediately, exactly as the logo does, rather than letting Save carry them.
 *
 * The warning this row used to carry ("not saved yet") is gone with the limitation it described.
 *
 * ## ⚠ THE CROP IS BAKED IN BEFORE THE UPLOAD, AND THE API DEPENDS ON IT
 *
 * The API performs **no** server-side crop, resize or recompress — it stores and serves exactly
 * the bytes it is sent. So the file that goes up is the one the crop dialog composed (1:0.7
 * aperture, ≤1280px long edge), never the original the owner picked. Wiring this straight to a
 * raw file picker would render a full-length photograph as a head crop on the card, the builder
 * preview and the public page at once — the exact bug the cover feature exists to fix.
 *
 * `imageToDataUrl` downscales to 1280px *first*, so the dialog composes against a bounded bitmap
 * and the result lands well inside the endpoint's 5MB cap. `dataUrlToFile` turns the composed
 * string into the request body; the same string is what the preview paints, so what the owner
 * approves and what a recipient downloads cannot diverge.
 */
export interface CoverPickerProps {
  /** The cover currently on the card — the server's URL, or a crop composed this session. */
  coverUrl: string | null;
  /** True while an upload or a removal is in flight, so the control reports it. */
  busy?: boolean;
  /**
   * The composed crop: the bytes to upload, and the string to preview. Both, because the
   * builder needs the file for `POST .../cover` and the reducer needs the data URL to draw with
   * until the server answers.
   */
  onPick: (file: File, previewUrl: string) => void;
  onRemove: () => void;
}

/**
 * ⚠ Deliberately the same three types the logo accepts. When the cover gets an endpoint it will
 * get the same server-side allow-list, and a picker that offered HEIC today would be teaching
 * owners a habit the API is going to reject.
 */
const ACCEPT = "image/jpeg,image/png,image/webp";

/** The card's own aperture, as width ÷ height. Imported so the two cannot drift. */
const COVER_ASPECT = 1 / COVER_RATIO.photo;

/** Longest edge of the baked cover. 1280 matches what `imageToDataUrl` already downscales to. */
const COVER_MAX_EDGE = 1280;

export function CoverPicker({
  coverUrl,
  busy: uploading = false,
  onPick,
  onRemove,
}: CoverPickerProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* The image being composed, held between "file chosen" and "crop applied". Never the saved
     value: nothing reaches the card until the owner presses Use this crop. */
  const [cropping, setCropping] = useState<string | null>(null);

  return (
    <div data-cover-picker="" className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        data-cover-input=""
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          /* Reset first: choosing the same file twice must fire `change` both times, and it will
             not while the input still holds the previous selection. */
          event.target.value = "";
          if (file === undefined) return;
          setError(null);
          setBusy(true);
          void imageToDataUrl(file)
            /* ⚠ Downscale FIRST, then crop. `imageToDataUrl` caps the long edge at 1280, so the
               dialog composes against a bounded bitmap rather than a 12-megapixel phone
               photograph — which is what keeps the drag smooth on a phone and keeps the source
               held in memory during composition small. Cropping a 1280px source to a 1280px
               cover is still a real crop, because the aperture takes a sub-rectangle of it. */
            .then((result) => setCropping(result.dataUrl))
            .catch(() =>
              /* A file the browser could not decode. The owner's mistake, said plainly, rather
                 than a throw that reaches an error boundary and blanks the panel. */
              setError("That image could not be read. Try a JPEG, PNG or WebP."),
            )
            .finally(() => setBusy(false));
        }}
      />

      <CoverThumb coverUrl={coverUrl} />

      <div className="flex flex-col items-start gap-1">
        <Button
          variant="secondary"
          data-cover-upload=""
          /* Both waits, one affordance: decoding the chosen file, then the upload of the crop.
             The owner does not distinguish them and neither should the control. */
          loading={busy || uploading}
          loadingLabel={busy ? "Reading…" : "Uploading…"}
          onClick={() => inputRef.current?.click()}
        >
          {coverUrl === null ? "Add cover" : "Replace"}
        </Button>

        {coverUrl === null ? null : (
          <>
            {/* ⚠ Re-opens the cropper on the SAVED image, not on the original file, which is
                gone once the picker unmounts. Cropping a crop cannot recover what was thrown
                away, so this adjusts within what is left — and "Replace" is the honest route
                back to the full photograph. The copy says Adjust rather than Crop for exactly
                that reason. */}
            <Button
              variant="text-link"
              data-cover-adjust=""
              onClick={() => setCropping(coverUrl)}
            >
              Adjust
            </Button>
            <Button
              variant="text-link"
              data-cover-remove=""
              disabled={uploading}
              onClick={onRemove}
            >
              Remove
            </Button>
          </>
        )}
        </div>
      </div>

      <ImageCropDialog
        open={cropping !== null}
        onOpenChange={(next) => {
          if (!next) setCropping(null);
        }}
        src={cropping}
        aspect={COVER_ASPECT}
        maxEdge={COVER_MAX_EDGE}
        title="Position your cover"
        onApply={(dataUrl) => {
          /* ⚠ The COMPOSED bytes, never the original file — see the ⚠ in the module note. The
             extension matches the encoding `imageToDataUrl`/the dialog actually produce (JPEG),
             so the name the API stores does not contradict the content type it is sent. */
          onPick(dataUrlToFile(dataUrl, "cover.jpg"), dataUrl);
          setCropping(null);
        }}
      />

      {error === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The chosen cover, or the empty box that stands in for one.
 *
 * ⚠ **`object-cover` on a 4:3 box, and not `object-contain` like the logo's thumbnail.** The two
 * are drawn differently because the card draws them differently: a logo is a mark that must not
 * be cropped, and a cover IS a crop — it fills the hero edge to edge. A thumbnail that letterboxed
 * the photograph would be showing the owner a framing the card will not use, which is the one
 * thing a preview must never do.
 *
 * The box is drawn whether or not there is a cover, so picking one does not shift the buttons
 * sideways, and so the empty state says what shape is being asked for.
 */
function CoverThumb({ coverUrl }: { coverUrl: string | null }): ReactElement {
  if (coverUrl === null) {
    return (
      <span
        data-cover-thumb="empty"
        aria-hidden="true"
        className="grid h-14 w-[74px] shrink-0 place-items-center rounded-md border border-dashed border-line bg-surface text-[10px] tracking-wide text-ink-4 uppercase"
      >
        Cover
      </span>
    );
  }

  return (
    <span
      data-cover-thumb="set"
      className="block h-14 w-[74px] shrink-0 overflow-hidden rounded-md border border-line bg-surface"
    >
      {/* A plain img element rather than next/image: the source is a `blob:` object URL, which
          next/image's optimiser cannot fetch. (Written without the literal tag in the prose:
          `impeccable`'s broken-image rule is a text regex.) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={coverUrl} alt="" className="h-full w-full object-cover" />
    </span>
  );
}
