"use client";

import type { ReactElement } from "react";

import { selectedLook, type CardLook } from "@/card/card-looks";
import { FINISHES, TEXTURES, type Finish, type Texture, type TexturePresence, type TextureScale } from "@/card/card-surface";
import type { PaletteId, TemplatePalette } from "@/card/template-palettes";

import { Input } from "@/components/primitives/input";
import { TextArea } from "@/components/primitives/textarea";

import { BackgroundPicker, groundLabel } from "./background-picker";
import { CoverPicker } from "./cover-picker";
import { LogoPicker } from "./logo-picker";
import { LookPicker } from "./look-picker";
import { PanelGroup, PanelRow } from "./panel-row";
import {
  FinishPicker,
  TexturePicker,
  TexturePresenceDial,
  TextureScaleDial,
} from "./surface-picker";

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
  texture: Texture;
  texturePresence: TexturePresence;
  textureScale: TextureScale;
  /** ⚠ The card's palette from the one resolution. Never looked up from a preset table here. */
  palette: TemplatePalette;
  onPreset: (paletteId: PaletteId) => void;
  onGround: (hex: string) => void;
  onFinish: (finish: Finish) => void;
  onTexture: (texture: Texture) => void;
  onPresence: (presence: TexturePresence) => void;
  onScale: (scale: TextureScale) => void;
  /** A curated look — palette and finish at once, clearing any custom colour. */
  onLook: (look: CardLook) => void;

  /* ── The three UI-only slots. Not persisted — see the ⚠ on `ContactCard`. ──────────────── */
  coverUrl: string | null;
  onCover: (previewUrl: string | null) => void;
  headline: string;
  onHeadline: (headline: string) => void;
  bio: string;
  onBio: (bio: string) => void;
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
const HEADLINE_MAX = 80;
const BIO_MAX = 240;

export function DesignPanel({
  logoUrl,
  logoBusy,
  onPickLogo,
  onRemoveLogo,
  paletteId,
  groundHex,
  finish,
  texture,
  texturePresence,
  textureScale,
  palette,
  onPreset,
  onGround,
  onFinish,
  onTexture,
  onPresence,
  onScale,
  onLook,
  coverUrl,
  onCover,
  headline,
  onHeadline,
  bio,
  onBio,
}: DesignPanelProps): ReactElement {
  const textured = texture !== "none";
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
          hint="Shown on the card and on the pass. JPEG, PNG or WebP."
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
          /* ⚠ The hint says "not saved yet" out loud. There is no column for this, so a reload
             drops it — and a control that silently forgets is worse than one that admits it. */
          hint="The photo behind the hero. Not saved yet — it will reset on reload."
          value={coverUrl === null ? "None" : "Added"}
          id="cover"
        >
          <CoverPicker
            coverUrl={coverUrl}
            onPick={(previewUrl) => onCover(previewUrl)}
            onRemove={() => onCover(null)}
          />
        </PanelRow>

        <PanelRow
          label="Position"
          hint="Printed under the name. Overrides the job title from your profile."
          value={headline.trim() === "" ? "From profile" : headline}
          id="headline"
        >
          <Input
            label="Position"
            hideLabel
            id="headline"
            data-headline-input=""
            value={headline}
            maxLength={HEADLINE_MAX}
            placeholder="Founder & CEO"
            onChange={(event) => onHeadline(event.target.value)}
          />
        </PanelRow>

        <PanelRow
          label="Bio"
          hint="One or two lines under the position."
          value={bio.trim() === "" ? "None" : `${bio.trim().length}/${BIO_MAX}`}
          id="bio"
          last
        >
          <TextArea
            label="Bio"
            hideLabel
            id="bio"
            data-bio-input=""
            value={bio}
            rows={3}
            maxLength={BIO_MAX}
            placeholder="Connecting people, ideas and opportunities to create lasting impact."
            onChange={(event) => onBio(event.target.value)}
          />
        </PanelRow>
      </PanelGroup>

      {/* ⚠ **Look comes before the dials, and the dials moved behind a disclosure.**

          The panel used to open on Background and then ask for Finish, Texture, Strength and
          Size. Four of those six ask the owner to art-direct a surface — how strong the grain,
          how large the dots — which is a question somebody setting up a contact card has no
          reason to hold an opinion about and the most likely way for them to make their own
          card worse.

          A look answers all of them at once, and picking one writes the SAME columns the dials
          wrote, so nothing new is stored and no migration exists. The dials survive intact
          underneath: an owner with brand colours has a real need the twelve cannot serve, and
          this is a default rather than a cage. */}
      <PanelGroup title="Look">
        <PanelRow
          label="Style"
          hint="Colour and finish, already paired."
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

      {/* A native `details`, not a state-driven panel: it needs no JavaScript to open, it is
          keyboard-operable and screen-reader-announced for free, and its open state is not
          something the builder should be remembering across a save. */}
      <details data-design-advanced="" className="group">
        <summary
          className="cursor-pointer list-none select-none text-sm text-ink-3 transition-colors hover:text-ink marker:content-none"
          data-design-advanced-toggle=""
        >
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="transition-transform group-open:rotate-90">
              ›
            </span>
            Advanced
          </span>
        </summary>

        <div className="flex flex-col gap-8 pt-6">
      <PanelGroup title="Colour">
        <PanelRow
          label="Background"
          hint="Every ink, button and line is derived from this."
          value={groundLabel(paletteId, groundHex)}
          id="ground"
          last
        >
          <BackgroundPicker
            paletteId={paletteId}
            groundHex={groundHex}
            palette={palette}
            finish={finish}
            texture={texture}
            onPreset={onPreset}
            onGround={onGround}
          />
        </PanelRow>
      </PanelGroup>

      <PanelGroup title="Surface">
        <PanelRow
          label="Finish"
          hint="How the colour is laid down."
          value={FINISHES[finish].name}
          id="finish"
        >
          <FinishPicker
            selected={finish}
            palette={palette}
            texture={texture}
            texturePresence={texturePresence}
            textureScale={textureScale}
            onSelect={onFinish}
          />
        </PanelRow>

        <PanelRow
          label="Texture"
          hint="Pressed into the ground, never painted over it."
          value={TEXTURES[texture].name}
          id="texture"
          last={!textured}
        >
          <TexturePicker
            selected={texture}
            palette={palette}
            finish={finish}
            texturePresence={texturePresence}
            textureScale={textureScale}
            onSelect={onTexture}
          />
        </PanelRow>

        {/* ⚠ Absent, not disabled — see the note in `surface-picker.tsx`. With no texture there
            is no strength or size to set, and a dial for a state you are not in is two tab
            stops that answer nothing. Both rows go together: they are one idea in two axes, and
            leaving one behind would read as a control that had failed to load. */}
        {!textured ? null : (
          <>
            <PanelRow label="Strength" id="presence">
              <TexturePresenceDial value={texturePresence} onSelect={onPresence} />
            </PanelRow>
            <PanelRow label="Size" id="scale" last>
              <TextureScaleDial value={textureScale} onSelect={onScale} />
            </PanelRow>
          </>
        )}
      </PanelGroup>
        </div>
      </details>
    </div>
  );
}
