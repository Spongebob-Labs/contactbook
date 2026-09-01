"use client";

import { useState, type CSSProperties } from "react";

import { CardPage } from "@/card/card-page";
import { ShareFace } from "@/card/share-face";
import {
  PALETTE_ORDER,
  TEMPLATE_PALETTES,
  groundGradient,
  type PaletteId,
} from "@/card/template-palettes";
import { demo } from "@/fixtures/marketing";
import type { ResolvedCard } from "@/types/domain";

import { ObjectLabel } from "./bento";
import { mkcn } from "./mk-cn";
import { Prose } from "./type";

/**
 * The studio — **the product demonstrating itself, and the only genuinely interactive thing on
 * the page below the hero.**
 *
 * ## Why this is the most valuable cell on the page
 * The direction file's "proof on hand" is one line: *live product components that mount rather
 * than being pictured.* This cell is that line, taken literally. Everything inside the two
 * frames is rendered by the same `<ShareFace>` and `<CardPage>` the product ships — not a
 * screenshot of them, not an illustration of them, and emphatically not stock photography,
 * which is the single clearest tell that a SaaS page was generated. A competitor can copy a
 * screenshot. They cannot copy a card that repaints when you press a colour.
 *
 * It also answers the FAQ's `two-objects` question before it is asked. The wallet pass and the
 * card page are two objects with two jobs — a fixed 336x500 handover format and a page that
 * grows to fit however many fields you mapped — and the page argues that in prose seven passes
 * later. Here they are side by side, wearing the same colour, from the same `ResolvedCard`.
 *
 * ## ⚠ Rule 1 of the motion vocabulary, applied to an interactive cell
 * `mk-motion.tsx` states it: *the final state is the default; everything painted, in position,
 * at rest, with no JavaScript.* The first render of this component — on the server, and the
 * first client render before any press — is `initialPaletteId`, which is the card's own
 * resolved palette. So with scripting off, or before hydration, or in the e2e harness, this
 * cell is a fully painted wallet pass and a fully painted card page. The interactivity is an
 * enhancement layered on a finished object, never the thing that makes it appear.
 *
 * ## ⚠ WHY THE PALETTE IS SWAPPED ON THE RESOLVED CARD AND NOT WITH CSS VARIABLES
 * `paletteVars()` is the whole mechanism by which a per-card palette reaches the CSS, so the
 * tempting build is a wrapper `<div style={paletteVars(chosen)}>` around a server-rendered
 * card, which would keep both renderers out of the client bundle entirely.
 *
 * It cannot work, and the reason is in `share-face.tsx`: the card root spreads
 * `paletteVars(palette)` onto **its own** `style` attribute. An inline custom property on the
 * element beats the same property inherited from an ancestor, so the wrapper's values are
 * shadowed by the card's and nothing changes. Handing the renderers a different `palette` is
 * therefore the only honest swap, and it is also the one the builder makes — the card the
 * reader is pressing is behaving exactly like the owner's own preview.
 *
 * The cost is that `<ShareFace>` and `<CardPage>` land in the client bundle for `/`. It is
 * accepted here and nowhere else on the page: this is the cell the whole redesign exists for,
 * and every other product artefact below is server-rendered.
 *
 * ## ⚠ THE FACE'S QR IS DELIBERATELY `mode="thumb"`, AND THAT IS A SAFETY DECISION
 * `thumb` scales the 336px design face down. It used to also swap in a fixed dummy payload;
 * it now encodes the card's real URL like every other mode, and the safety property is carried
 * by the **fixture** instead: every demo card's `publicUrl` is on `card.example`, an RFC 2606
 * reserved domain nobody can own, asserted in `tests/contract/fixtures.test.ts`. So this page
 * can print a true symbol that could never resolve to a real person's card. What remains true:
 *
 *   · **Scaled.** The face renders at `FACE_SCALE_WIDTH`, which puts its 141px symbol under
 *     `MIN_QR_SIZE_PX`. A symbol below the decode floor that carries a real card URL is a QR
 *     that *looks* scannable and is not, printed on the page whose whole argument is that it
 *     tells the truth about what software can do.
 *   · **Dummy payload.** A decoration must not resolve to somebody's actual card.
 *
 * The page's real, scannable symbol is one cell to the right, at full size, in `mode="full"`.
 * The two modes are doing two different jobs and the division is the point.
 *
 * ## The card page is `inert`, and that is not laziness about accessibility
 * `<CardPage>` renders the owner's fields as real action controls — `tel:`, `mailto:`, a maps
 * link. On `/c/{slug}` that is the product. In a 220px demonstration frame on a marketing page
 * it is a trap: a reader pressing the demo's phone number opens their dialler on a fixture
 * number. `inert` removes the subtree from the tab order and from the accessibility tree in one
 * attribute, which is the correct treatment for a picture of a control — and the cell's own
 * copy, the labels and the pass beside it all remain readable.
 */

/**
 * The width the wallet pass is scaled into.
 *
 * 216, and the number is a viewport sum rather than a taste. At the 360px project the pass
 * runs: 360 viewport, less `<Section>`'s 12px of page inset each side, less the pass's own 24px
 * gutter each side, less this cell's 24px of padding each side — 240px of usable width. 216
 * leaves 24px of air and keeps the object clear of both edges.
 *
 * ⚠ Raising it past 240 does not make a bigger card at 360, it makes the grid track wider than
 * its column and `documentElement.scrollWidth` exceeds `clientWidth`, which is a failing
 * assertion in `marketing.spec.ts` at all three viewports rather than a cosmetic overflow.
 */
const FACE_SCALE_WIDTH = 216;

export interface CardStudioProps {
  /** Resolved once, on the server, from the fixture gateway. Plain data all the way down. */
  resolved: ResolvedCard;
  /** The palette the cell paints before anyone touches it. */
  initialPaletteId: PaletteId;
}

export function CardStudio({ resolved, initialPaletteId }: CardStudioProps) {
  const [paletteId, setPaletteId] = useState<PaletteId>(initialPaletteId);

  /* One object, two renderers, so the pass and the page cannot disagree about what colour the
     card is — the same guarantee `resolveCard` makes for the real product. */
  const shown: ResolvedCard = { ...resolved, palette: TEMPLATE_PALETTES[paletteId] };

  return (
    <>
      {/*
        ⚠ `items-start`, and the ragged bottom edge is the argument.

        The two objects share a TOP edge and end at different heights, because that is the true
        difference between them: the pass is one fixed 336x500 format on every card in the
        product, and the page is as long as the owner's data. Aligning their bottoms would have
        made them look like two variants of one object, which is exactly the confusion the FAQ's
        `two-objects` answer exists to clear up seven passes later.
      */}
      <div className="mt-7 flex flex-wrap items-start gap-5 md:mt-8 md:gap-7">
        {/*
          The wallet pass. A `<figure>` because it is an illustration with a caption, and the
          caption is above it rather than below: the reader meets the two objects left to right
          and needs to know which is which before looking, not after.
        */}
        <figure className="m-0 flex flex-col gap-2">
          <ObjectLabel>{demo.faceLabel}</ObjectLabel>
          <ShareFace resolved={shown} mode="thumb" thumbWidth={FACE_SCALE_WIDTH} />
        </figure>

        {/*
          The card page, cropped.

          ⚠ `min-w-44` rather than `min-w-0`, and the two are opposites here. `min-w-0` lets a
          flex item shrink to nothing, so the frame would compress to a 40px sliver beside the
          rigid 216px pass and never wrap. A real minimum is what makes `flex-wrap` fire: below
          176px of remaining space the frame drops to its own line at full width, which is the
          reflow this row needs at 360 and gets nowhere else.
        */}
        <figure className="m-0 flex min-w-44 flex-1 flex-col gap-2">
          <ObjectLabel>{demo.pageLabel}</ObjectLabel>
          {/*
            ⚠ The crop is the content, not a compromise. `<CardPage>` is as long as the owner's
            data — that is the difference between the two objects and the reason the product has
            both — so a frame that showed all of it would be showing the wrong thing. The last
            96px fade to the frame's own ground through `.mk-fade-b`, so the cut reads as
            "continues below" rather than as a clipping bug. `--mk-fade-to` names the ground
            being faded to, because the fade has to match whatever is behind it.

            368px, and the number is chosen against the CONTENT rather than against the pass
            beside it. The card page's identity block runs about 270px at this width, so a
            shorter frame shows a header and nothing else — two rounded objects side by side,
            both apparently a card, which is the opposite of the point. At 368 the first two
            action buttons clear the fold of the crop and the stack is legible as a stack. It is
            taller than the 321px pass on purpose; see the ⚠ on `items-start`.

            ⚠ No `height` on the card and no `overflow` on the card. Both belong to the frame.
            `card-page.tsx` rests on the card root having neither — see the ⚠ on its root style.
          */}
          <div
            data-card-page-frame=""
            inert
            aria-hidden="true"
            className="mk-fade-b h-[23rem] overflow-hidden rounded-mk-row border border-mk-hairline"
            style={{ "--mk-fade-to": "var(--mk-white)" } as CSSProperties}
          >
            <CardPage resolved={shown} />
          </div>
        </figure>
      </div>

      {/*
        The nine grounds.

        This rail is also the page's "nine card grounds" exhibit, and it is a set of controls
        rather than a strip of swatches on purpose: a reader who can press Oxblood and watch two
        product objects repaint has learned more about the colour system in one second than a
        static rail of nine rectangles teaches in ten.

        `role="group"` with a name from the fixture, not `radiogroup`: these are toggle buttons
        carrying `aria-pressed`, and a radio group would promise arrow-key roving that this does
        not implement. Nine tab stops is the honest cost of nine buttons.
      */}
      <div className="mt-7 flex flex-col gap-3 md:mt-8">
        <div
          role="group"
          aria-label={demo.paletteLegend}
          data-palette-rail=""
          className="flex flex-wrap gap-2.5"
        >
          {PALETTE_ORDER.map((id) => {
            const palette = TEMPLATE_PALETTES[id];
            const active = id === paletteId;

            return (
              <button
                key={id}
                type="button"
                data-palette-swatch={id}
                aria-pressed={active}
                aria-label={palette.name}
                title={palette.name}
                onClick={() => setPaletteId(id)}
                /*
                  The swatch IS the card's ground, drawn by the card system's own
                  `groundGradient()` at the card's own angle. Nothing here picks a colour: a
                  hand-typed hex in a marketing component is how the two colour systems drifted
                  apart the last time, and this rail would be the first place it happened again.
                */
                style={{ backgroundImage: groundGradient(palette) }}
                className={mkcn(
                  "size-9 rounded-mk-control border",
                  /*
                    WCAG 1.4.11 wants a control's boundary discernible at 3:1, and four of the
                    nine grounds are light enough to dissolve into a white cell without one.
                    `--mk-control` is the token that exists for exactly this job — 3.36:1 on
                    paper, 3.5:1 on white — rather than the decorative hairline, which measures
                    1.2:1 and would leave Pistachio and Clay as edgeless smudges.
                  */
                  "border-mk-control",
                  /*
                    Selected state is a SHAPE change, not a colour change, which it has to be:
                    every one of these controls is already a different colour, so a colour cue
                    would be indistinguishable from the control's own content. The outline sits
                    outside the swatch with an offset so it reads on a light ground and a deep
                    one alike, and `aria-pressed` carries the same fact to a screen reader.
                  */
                  active && "outline-2 outline-offset-2 outline-mk-ink",
                  /*
                    Interaction motion, on the site's own tap duration and curve. This is the
                    only kind of motion `DESIGN.md` permits below the hero: it happens because
                    somebody did something, and its absence reads as the control being broken.
                  */
                  "cursor-pointer transition-transform duration-[var(--mk-dur-tap)]",
                  "ease-[var(--mk-ease)] hover:-translate-y-0.5 active:translate-y-0",
                )}
              />
            );
          })}
        </div>

        <Prose size="small" className="max-w-mk-measure-tight">
          {demo.paletteHint}
        </Prose>
      </div>
    </>
  );
}
