"use client";

import type { ReactElement } from "react";

import { selectedLook, type CardLook } from "@/card/card-looks";
import type { Finish } from "@/card/card-surface";
import type { PaletteId } from "@/card/template-palettes";

import { Input } from "@/components/primitives/input";
import { TextArea } from "@/components/primitives/textarea";

import { CoverPicker } from "./cover-picker";
import { LogoPicker } from "./logo-picker";
import { LookPicker } from "./look-picker";
import { PanelGroup, PanelRow } from "./panel-row";

/**
 * The **Design** section — the card's mark, its colour, and how that colour is painted.
 *
 * ## Three groups, and the logo is the one that is not a material axis
 *
 * Colour and Surface are the material system: six axes that all resolve into one painted ground.
 * Brand is a single row holding a file, and it is grouped separately rather than dropped in
 * beside Background because "what image is on this card" and "what colour is this card" are not
 * comparable decisions — putting them under one heading would say they were.
 *
 * ## ⚠ Header layout moved out, and it is now the Layout section
 *
 * This panel used to carry all four axes. Three of them answer one question — *what colour is
 * this card and how is it painted* — and the fourth answers a different one: *how much of it do
 * you see*. Reading four `<h3>`s down one box gave no clue which of them were the same decision,
 * and it is the single biggest reason this screen read as cluttered.
 *
 * The rail's three stops are now the three real questions — Fields, Design, Layout — and
 * `HeaderLayoutPicker` is rendered by `builder-client.tsx` under the Layout heading. **Nothing
 * about the control changed**: same component, same reducer action, same live preview. Only
 * which heading it sits under.
 *
 * ## Why Colour folded in here rather than sitting beside it
 *
 * The column was **Fields, then Colour**. The obvious move was **Fields, Design, Colour** — and
 * it is wrong, because "Colour" and this panel's first control are the same axis. An owner
 * choosing a background would have met the nine presets in one section and the colour input in
 * another, with one selected state split across two boxes and no way to tell from the screen
 * which of the two the card was actually wearing. One axis, one control, one tick.
 *
 * So Design opens on Background, and the order inside it is the order the decisions depend on
 * each other: the colour is the input to everything below it — a wallpaper is a way of painting
 * *that colour*, and a pattern is tinted from the ink derived from *that colour*.
 *
 * ## Every control is live, and none of them is a mode
 *
 * There is no apply, no preview button and no wizard step; the single commit affordance on this
 * screen is Save, in the header, and it commits the card rather than the design. Each control
 * dispatches a reducer action and the pinned card page re-renders from the same state on the
 * next frame — which is why the behaviour is tested in `tests/unit/builder-reducer.test.ts`
 * without a browser, and why this file is composition and prose and nothing else.
 *
 * ## The one resolution (I-5) reaches every cell
 *
 * `palette` below is the card's own palette out of the screen's single `resolveCard` — curated
 * when the card is on a preset, derived when the owner has picked their own colour. Every cell
 * in every control paints from it, so the panel cannot come to disagree with the card about what
 * colour the card is. **Nothing here re-resolves a card.** The nine-live-cards colour picker,
 * which was I-5's one documented exception, is gone with the ShareFace thumbnails; the only
 * derivation left in the panel is the `derivePalette` call in `background-picker.tsx` that asks
 * whether a colour was clamped, and it paints nothing at all.
 */

export interface DesignPanelProps {
  /**
   * The mark to show in the Logo row — the uploaded logo, or the object URL of a file waiting
   * for `POST /cards`. The panel does not know or care which; see `LogoPicker`.
   */
  logoUrl: string | null;
  /** A logo request is in flight. */
  logoBusy: boolean;
  onPickLogo: (file: File) => void;
  onRemoveLogo: () => void;
  paletteId: PaletteId;
  groundHex: string | undefined;
  finish: Finish;
  /** A curated look — palette and finish at once, clearing any custom colour. */
  onLook: (look: CardLook) => void;

  /* ── The cover, the position and the bio. All three persist — real `Card` columns. ─────── */
  coverUrl: string | null;
  /** True while the cover upload or removal is in flight. */
  coverBusy: boolean;
  /**
   * The composed crop: bytes to upload and the string to preview with until the server answers.
   * `null` is the removal — the same one-callback shape this row has always had.
   */
  onCover: (picked: { file: File; previewUrl: string } | null) => void;
  /**
   * The position and bio rows. **Omitted on the Profile & Cards workspace**, where they live in
   * the Fields panel beside the rest of what the card says (client, 2026-09-30: *"position and bio
   * should not be in the design section"*). The builder still passes them.
   */
  text?: {
    headline: string;
    onHeadline: (headline: string) => void;
    bio: string;
    onBio: (bio: string) => void;
  };
}

/**
 * How long a position line and a bio may be.
 *
 * ⚠ Enforced here because nothing else can yet — there is no column and therefore no server
 * validation. The numbers are the ones proposed to the backend in `ContactCard`'s ⚠ block, so
 * the limit an owner meets today is the limit they will meet after the columns land rather than
 * a stricter one that silently relaxes, or a looser one that starts rejecting saves.
 *
 * They are also the numbers the COMPOSITION holds: the hero centres the bio at a 34ch measure,
 * and past roughly 240 characters it stops being a bio and starts pushing the first field row
 * off a phone screen.
 */
export const HEADLINE_MAX = 80;
export const BIO_MAX = 240;

export function DesignPanel({
  logoUrl,
  logoBusy,
  onPickLogo,
  onRemoveLogo,
  paletteId,
  groundHex,
  finish,
  onLook,
  coverUrl,
  coverBusy,
  onCover,
  text,
}: DesignPanelProps): ReactElement {
  const look = selectedLook(paletteId, finish, groundHex);

  return (
    <div data-design-panel="" className="flex flex-col gap-8">
      {/* ⚠ **Brand comes first, above Colour.** The order inside this panel is the order the
          decisions depend on each other — Colour opens the Surface group because a finish is a
          way of painting *that colour*. A logo depends on nothing below it and nothing below it
          depends on a logo; it is the one decision here that is about the owner rather than
          about the card's material, so it is read first and then left alone. */}
      {/* ⚠ **"Identity", not "Brand", and it is no longer one row.**
          It held the logo alone, and the heading was accurate for that. It now holds the four
          things the hero prints — the mark, the photograph behind it, the position and the bio —
          which are one decision ("who is this card") taken four ways. The material system below
          is the other decision, and keeping the two under separate headings is what stops the
          panel reading as six unrelated dials again. */}
      <PanelGroup title="Identity">
        <PanelRow
          label="Logo"
          hint="JPEG, PNG or WebP."
          /* ⚠ "Added", not "Uploaded". This panel is deliberately path-agnostic — on `/cards/new`
             the file has been chosen and not sent anywhere yet — so the word has to be true in
             both paths. The thumbnail beside it is the real answer to "where does this row
             stand"; this line exists so the panel can be read closed. */
          value={logoUrl === null ? "None" : "Added"}
          id="logo"
          last
        >
          <LogoPicker
            logoUrl={logoUrl}
            busy={logoBusy}
            onPick={onPickLogo}
            onRemove={onRemoveLogo}
          />
        </PanelRow>

        <PanelRow
          label="Cover"
          /* The "not saved yet" warning that stood here is gone with the limitation it described:
             `Card.coverUrl` is a real column and the crop uploads the moment it is applied. */
          value={coverUrl === null ? "None" : "Added"}
          id="cover"
          last={text === undefined}
        >
          <CoverPicker
            coverUrl={coverUrl}
            busy={coverBusy}
            onPick={(file, previewUrl) => onCover({ file, previewUrl })}
            onRemove={() => onCover(null)}
          />
        </PanelRow>

        {text === undefined ? null : (
          <>
            <PanelRow
              label="Position"
              hint="Replaces your job title on this card."
              value={text.headline.trim() === "" ? "From profile" : text.headline}
              id="headline"
            >
              <Input
                label="Position"
                hideLabel
                id="headline"
                data-headline-input=""
                value={text.headline}
                maxLength={HEADLINE_MAX}
                placeholder="Founder & CEO"
                onChange={(event) => text.onHeadline(event.target.value)}
              />
            </PanelRow>

            <PanelRow
              label="Bio"
              value={text.bio.trim() === "" ? "None" : `${text.bio.trim().length}/${BIO_MAX}`}
              id="bio"
              last
            >
              <TextArea
                label="Bio"
                hideLabel
                id="bio"
                data-bio-input=""
                value={text.bio}
                rows={3}
                maxLength={BIO_MAX}
                placeholder="Partnerships lead, based in Mumbai."
                onChange={(event) => text.onBio(event.target.value)}
              />
            </PanelRow>
          </>
        )}
      </PanelGroup>

      {/* A look writes palette and finish together. The individual colour, finish and texture
          dials were removed from the UI (2026-10-06); the columns they wrote are unchanged. */}
      <PanelGroup title="Look">
        <PanelRow
          label="Style"
          value={look === null ? "Custom" : look.name}
          id="look"
          last
        >
          <LookPicker
            paletteId={paletteId}
            finish={finish}
            groundHex={groundHex}
            selected={look}
            onSelect={onLook}
          />
        </PanelRow>
      </PanelGroup>
    </div>
  );
}
