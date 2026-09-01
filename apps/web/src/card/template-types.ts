/**
 * The `CardTemplate` schema.
 *
 * ## What changed, and why
 *
 * The previous version of this file described a template with `buttonRadius`
 * (`'pill' | 'rounded-rect'`), `buttonShadow`, `avatarKind`, `splitPct`, `mesh`, `scrim`,
 * `cornerBlock`, `hairlineAccent` and `baselineGridPx` (`4 | 8`) — nine axes, every one of
 * them a detail you cannot see from more than a foot away, and all of them drawing on a
 * single shared cream palette. Eight templates built that way are one template eight times.
 * That is not a rendering bug; it is this file's fault.
 *
 * The axes below are the ones that decide whether two cards look like different cards at
 * gallery-thumbnail size, which is the only size at which a template is ever chosen:
 *
 *   1. `paletteId` — the ground colour and everything that has to stay legible on it.
 *      This is the dominant axis. A Cobalt card and a Citrus card are unmistakably
 *      different before a single word is read.
 *   2. `pageHeader` — how the scan page's hero reads. The share face and the page are two
 *      objects and each needs its own art direction; this is the page's.
 *   3. `nameWeight` — the one typographic dial left. Subordinate by design.
 *
 * There is deliberately no composition axis. See the note further down on why the face format
 * is a constant rather than a choice.
 *
 * Nothing here is a colour. Colour is a `PaletteId` pointing into
 * `src/card/template-palettes.ts`, so a template cannot invent an untested ground and the
 * palette contract test covers every template by construction.
 *
 * ## The two variants
 *
 * A card is rendered as one of two different objects, never as one object doing both jobs:
 *
 *   SHARE FACE (`<ShareFace>`) — fixed, compact, wallet-shaped. The name, at most two
 *   highlight details, and the QR. This is what gets displayed, shared, exported to PNG,
 *   and added to a wallet.
 *
 *   CARD PAGE (`<CardPage>`) — a real page, not a canvas. Every field the owner mapped,
 *   laid out at full size, growing as tall as it needs and scrolling with the document.
 *
 * The old build had one 400×860 canvas that had to hold identity, QR, two buttons and an
 * unbounded field list, so the field list got `overflow-y: auto` and clipped its own rows —
 * visible in every screenshot as a scrollbar inside a small card and a truncated last field.
 * Splitting the object is what fixes that, and it is why `QrZoneSpec` no longer has to
 * negotiate for vertical space with anything.
 *
 * Types only. The registry (`TEMPLATES: Record<TemplateId, CardTemplate>`) lives in
 * `src/card/templates/index.ts`. This module imports one type from `template-palettes` and
 * nothing else; `src/types/domain.ts` imports *from* here and never the reverse, which is
 * what keeps the two out of a cycle.
 */

import type { PaletteId } from "./template-palettes";

/**
 * Two templates. Not eight, and not one per colour.
 *
 * There were eight, and they were eight colours wearing eight names — which made "pick a
 * template" and "pick a colour" the same decision, and a bad version of both: a user who wanted
 * a navy personal card had to pick the business one and change its colour anyway.
 *
 * So the two axes are separated. A **template** is what the card is *for* — which fields it
 * starts with and how it is captioned. A **palette** is what it looks like, and all eight are
 * available to either template. Two templates × eight palettes is sixteen cards a user can
 * reach, from two things to understand.
 */
export type TemplateId = "meridian" | "marigold";

/**
 * What the card is for. Two members, matching the two templates.
 *
 * `payment` and `creative` used to be here and never matched a template — the gallery's filter
 * rail offered them and they resolved to an empty grid.
 */
export type TemplateCategory = "business" | "personal";

/* ── The face format is FIXED — there is no composition axis ─────────────────────────── */

/**
 * There is deliberately no `FaceLayout` type any more.
 *
 * There used to be four compositions (`pass`, `stack`, `banner`, `qr-hero`) and the templates
 * were spread across them. That was wrong: a card set whose members put the photograph, the
 * name and the QR in different places is not a set of templates, it is a set of different
 * products. Handing someone a card should teach them where to look on every other card.
 *
 * So the format is a constant of `<ShareFace>`, not a property a template may choose:
 *
 *     ┌──────────────────────────────┐
 *     │ [logo]                 ◯     │  brand mark left, portrait right
 *     │                              │
 *     │ ROLE                         │  tag, uppercase, muted
 *     │ Name                         │  large
 *     │                              │
 *     │ LABEL                        │  up to two detail pairs…
 *     │ value                        │
 *     │ LINK                         │  …then the card's own link, always last
 *     │ value                        │
 *     │                              │
 *     │          ▓▓▓▓▓▓              │  QR, centred, on its white plate
 *     │          ▓▓▓▓▓▓              │
 *     └──────────────────────────────┘
 *
 * A template chooses its palette and the weight of its name. Nothing else moves.
 */

/**
 * How the identity block on the scan page's hero is presented. The page is unbounded, so
 * this axis can afford presentation the compact face cannot.
 */
export type PageHeader =
  /** Full-bleed palette ground behind a centred avatar and name. */
  | "solid"
  /** Ground behind the identity, then the field list on the app canvas beneath it. */
  | "band"
  /** No coloured hero: name on the canvas, palette used only for accents and actions. */
  | "quiet";

/* ── Axis 4: type personality and shape ─────────────────────────────────────────────── */

/**
 * One typeface (Geist, variable 100–900) across the product, so personality comes from
 * weight, tracking and case rather than from loading a second family. The previous build
 * loaded four families to differentiate eight cards and the cards still looked identical,
 * because the thing that made them identical was the palette, not the type.
 */
export interface TemplateType {
  /** The name. 400–800; a variable-font instance, not a synthesised bold. */
  nameWeight: number;
  /** Tracking on the name, in em. Negative tightens — the modern-product default. */
  nameTracking: number;
}

export interface TemplateShape {
  /**
   * Action buttons, on the scan page. The only shape a template still chooses.
   *
   * `faceRadius` and `avatarShape` used to live here and are now constants in
   * `<ShareFace>` — a card whose corners and portrait shape differ from the next card's is
   * varying its format, which is exactly what the fixed format exists to prevent.
   */
  buttonShape: "pill" | "rounded";
}

/* ── The QR zone ────────────────────────────────────────────────────────────────────── */

/**
 * What a template may say about the QR.
 *
 * Deliberately much smaller than the previous version. Because the share face carries no
 * field list, the QR no longer competes for vertical space, so a template no longer needs
 * to nominate an anchor from four options or negotiate a budget — `faceLayout` already
 * determines where the symbol sits.
 *
 * `<QrZone>` computes the symbol size, the quiet zone and the reserved box from the measured
 * face width via `src/card/qr-geometry.ts`. A template influences what decorates *around*
 * the plate and never the geometry, because geometry is what makes a QR decode.
 */
export interface QrZoneSpec {
  /**
   * The only permitted plate treatment. The union has one member to make the intent explicit:
   * an opaque white plate. Not frosted, not tinted, not inverted — a translucent plate looks
   * correct on screen and vanishes in PNG export, and many decoders reject inverted symbols
   * outright.
   *
   * This is the whole of the type now. `caption` and `decorate` used to live here and were
   * format that varied per template: one card printed "Scan to save" beneath its symbol, the
   * next wore corner ticks, a third drew a rule above. The reference card has none of them, and
   * a symbol framed differently on every card is the format varying again.
   *
   * The field is kept — rather than the interface being deleted — because `qrZone` being
   * non-optional on `CardTemplate` is what makes "every template carries a QR" a compile
   * error to violate rather than something to remember.
   */
  plate: "solid";
}

/* ── The template ───────────────────────────────────────────────────────────────────── */

export interface CardTemplate {
  id: TemplateId;
  /** Product name, never a number. Shown in the gallery and the builder. */
  name: string;
  /** One line: gallery caption and builder tooltip. */
  blurb: string;
  category: TemplateCategory;

  /**
   * The dominant axis. A `PaletteId` rather than colour values, so a template can only
   * choose a palette that `tests/contract/template-palettes.test.ts` has already proven
   * legible — a template is incapable of introducing an untested colour.
   */
  paletteId: PaletteId;

  pageHeader: PageHeader;
  type: TemplateType;
  shape: TemplateShape;

  /**
   * A background photograph, `/public`-relative. `null` on every solid template.
   *
   * When set, the renderer lays a scrim over it derived from the palette's own ink — a
   * photograph is the one thing that can break a contrast guarantee the palette test made,
   * because the test can only see the flat ground beneath it.
   */
  photoSrc: string | null;

  /**
   * ⚠ NON-OPTIONAL, NO DEFAULT.
   *
   * Every card carries a working QR; it is the product. A `?` on this property would let a
   * template ship without one and no test would catch it, so the requirement is enforced
   * here, in the type, where omitting it fails `tsc --noEmit`.
   */
  qrZone: QrZoneSpec;
}
