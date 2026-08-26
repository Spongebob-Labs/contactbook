import type { ReactNode } from "react";

import { mkcn } from "./mk-cn";
import { Figure, PanelTitle, Prose } from "./type";

/**
 * The bento — the grid the product demonstrates itself in.
 *
 * ## Why this exists, in the user's own words
 * *"It's looking just text, text, text and nothing else, with the text being written in
 * different dev boxes in different colors."* Eight passes of prose on tinted grounds is what
 * the deck had become: the structure was right and there was nothing inside it. This file is
 * the container for the fix, and the fix is not more prose in nicer boxes — it is the product
 * itself, mounted, on the page.
 *
 * ## ⚠ A BENTO IS NOT SIX IDENTICAL BOXES, AND THAT IS THE ONLY RULE HERE
 * A grid of same-size cells each holding an icon, a heading and two lines of copy is the most
 * generated-looking structure available on the web, and swapping tinted text boxes for grey
 * ones would have answered the complaint by restating it. So `BentoCell` takes a `span` and a
 * `tone`, both of which are expected to differ from cell to cell, and the four cells this page
 * ships are four different KINDS of object:
 *
 *     profile  2 cols   white   data          real rows from the fixture profile, masked included
 *     studio   4 cols   white   interactive   a live wallet pass and card page, recoloured on press
 *     scan     4 cols   ONYX    scannable     a real QR at full size, above the 140px decode floor
 *     reach    2 cols   quiet   drawn         the broadcast fan, three transports, no photograph
 *
 * Size, ground, and kind all vary. If a future hand adds a fifth cell that is 2 wide, white,
 * and made of an icon over two lines of text, the grid has stopped being a bento and has
 * become the thing it replaced.
 *
 * ## ⚠ A CELL IS A MOUNT, NOT A PASS
 * `DESIGN.md` is categorical: *"Nothing draws its own pass. No `box-shadow` and no second
 * radiused fill inside a `<Section>`."* The reason it gives is depth — a shadowed rounded box
 * inside a shadowed rounded box reads as a mistake, because the reader cannot tell which of
 * the two edges is the meaningful one.
 *
 * A bento cell therefore carries a ground, a radius and a 1px hairline, and **never a shadow
 * and never an overlap**. It adds no depth, so it cannot compete with the pass for it: the
 * pass is still the only object in the deck that is lifted off anything. This is the same
 * licence `assistant.tsx` takes for design.md's Context Graph Node, one step further, and for
 * a reason that node did not have — two of these cells hold a rendered 336x500 card, and a
 * dark card object floating on bare paper with nothing under it reads as a leak in the layout
 * rather than as an object lying on a surface. A card needs a mount. It does not need a second
 * shadow, and it does not get one.
 *
 * ## Ground is a variable, and one cell is dark on purpose
 * `paper` is the pass, so a `paper` cell would be invisible and a `white` cell is one step up.
 * The `ink` tone exists for exactly one cell: the QR. `<QrZone>`'s plate is an opaque white
 * rectangle — a functional optical target, never tinted, never inverted, because many decoders
 * reject an inverted symbol — so a white plate on a white cell has no findable edge at all and
 * the most important object on the page reads as a hole. On Onyx it reads as a plate, which is
 * what every card in the product already does with it. The dark cell is also the one place in
 * eight passes where the page inverts before the close, which is worth having.
 *
 * ⚠ The tone table below is deliberately short and there is no `amber`. Amber is the action
 * fill and measures 1.92:1 on paper; a cell in it would be a button-coloured rectangle that is
 * not a button.
 */

/* ── the grid ───────────────────────────────────────────────────────────────── */

/**
 * Six tracks at `lg`, one below it.
 *
 * ⚠ **There is deliberately no two-column step, and that is the reflow decision.** The obvious
 * middle stage is `md:grid-cols-2`, and it produces holes: CSS grid's sparse placement never
 * backtracks, so a 1-track cell followed by a 2-track cell leaves the first row half empty and
 * the layout silently depends on the span of every cell before it. Making the four cells pack
 * at two columns would mean pairing a 690px-tall interactive studio beside a 330px data list,
 * which is a worse tablet layout than a clean stack.
 *
 * So the bento shape appears at `lg`, where there is room for it, and below that the four cells
 * are four full-width objects in reading order. That is not a degraded layout: at 768 the studio
 * gets 632px of interior, which is more than it gets in its own 4-track cell at 1024.
 *
 * A real `gap`, unlike the ruled sets elsewhere on the page: those draw a hairline per shared
 * edge and a gap would leave the rule floating in dead space. These cells have their own
 * outline, so the air between them is the separation and a rule would be a second one.
 */
export function BentoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-bento=""
      className={mkcn("grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-6 lg:gap-6", className)}
    >
      {children}
    </div>
  );
}

/**
 * The four grounds a cell may take, and the ink each one forces.
 *
 * The ink is not a suggestion. `--mk-stone` is legal on white and paper (4.96:1 / 4.55:1) and
 * illegal on Onyx (3.51:1), and the failure looks completely fine to the eye — which is why
 * the pairing is decided here, once, rather than at four call sites.
 */
const CELL_TONE = {
  white: "bg-mk-white border-mk-hairline",
  paper: "bg-mk-paper border-mk-hairline-strong",
  /** Transparent on the pass's own ground: the cell is an outline and nothing else. */
  quiet: "bg-transparent border-mk-hairline-strong",
  /** Onyx. White ink at 17.41:1; the secondary line sits at 75% white, 10.18:1. */
  ink: "bg-mk-ink border-mk-ink text-mk-white",
} as const;

export type BentoTone = keyof typeof CELL_TONE;

export interface BentoCellProps {
  children: ReactNode;
  /** A stable hook, and the thing an e2e assertion counts. */
  id: string;
  tone?: BentoTone;
  /** Tailwind span utilities for `md` and `lg`. Written at the call site, because they differ. */
  span?: string;
  /** Interior padding. `none` is for a cell whose content runs to its own edge. */
  pad?: "default" | "none";
  className?: string;
}

/**
 * One cell.
 *
 * `overflow-hidden` is load-bearing rather than defensive: two of these cells crop a rendered
 * card deliberately — the card page is as tall as the owner's data and the whole point is that
 * it keeps going — and without it a 336x500 object escapes the cell, escapes the pass, and
 * takes `documentElement.scrollWidth` with it at 360px. `marketing.spec.ts` asserts there is no
 * horizontal scroll at all three viewports, so that failure is caught, but it is caught as
 * "the page scrolls sideways" rather than as "a card is outside its box".
 *
 * `min-w-0` for the same family of reason one track down: a grid item's default `min-width` is
 * `auto`, so a rigid 336px child stops the track shrinking below 336px and a two-column row
 * blows past the viewport at 360 rather than reflowing.
 */
export function BentoCell({
  children,
  id,
  tone = "white",
  span,
  pad = "default",
  className,
}: BentoCellProps) {
  return (
    <div
      data-bento-cell={id}
      data-tone={tone}
      className={mkcn(
        /*
          `justify-between` is the pinwheel's shock absorber. Two cells in a row are the same
          height whatever their content, so the shorter one has slack, and slack collected at
          the bottom of a cell reads as an unfinished layout. Pushed to the middle — between the
          step's copy and the object it introduces — the same pixels read as air around an
          exhibit, which is what a bento cell is meant to have.
        */
        "relative flex min-w-0 flex-col justify-between overflow-hidden rounded-mk-block border",
        CELL_TONE[tone],
        pad === "default" && "p-6 md:p-7",
        span,
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── the head a cell shares ─────────────────────────────────────────────────── */

/**
 * A step's ordinal, title and body, as the head of a cell.
 *
 * The ordinals are `<Figure>` — the page's one numeral treatment, decided in `type.tsx` and
 * shared with `problem`'s counts. They are the content here rather than decoration, exactly as
 * they were in the ruled four-column row this grid replaced: you cannot hand a card over before
 * you have made one, and the section heading is a claim ABOUT the sequence.
 *
 * ⚠ `tone="accent"` marks step 04 and nothing else, and `--mk-emerald-ink` is legal ONLY on
 * paper and white (4.52:1). On the `ink` cell it measures 2.7:1, so the accent is refused
 * there rather than silently drawn — the caller passes `onInk` and gets white, which is the
 * one level that is legal on Onyx anyway. A mark that means "this is the step that repeats"
 * is not worth a contrast failure, and hue alone never carries meaning on this page: the
 * heading says it in words first.
 */
export function BentoHead({
  ordinal,
  title,
  body,
  accent = false,
  onInk = false,
}: {
  ordinal: string;
  title: string;
  body: string;
  accent?: boolean;
  onInk?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Figure
        as="p"
        tone={accent && !onInk ? "accent" : "quiet"}
        className={mkcn("text-mk-heading", onInk && "text-mk-white/75")}
      >
        {ordinal}
      </Figure>
      <PanelTitle className={mkcn(onInk && "text-mk-white")}>{title}</PanelTitle>
      <Prose
        size="small"
        tone="stone"
        className={mkcn("max-w-mk-measure-tight", onInk && "text-mk-white/75")}
      >
        {body}
      </Prose>
    </div>
  );
}

/**
 * A label over an object inside a cell — the wallet pass, the card page, the profile stack.
 *
 * ⚠ It is NOT `<Eyebrow>`, and the difference is not cosmetic. `marketing.spec.ts` bans
 * `<Eyebrow>` outright in every section file, because the failure it is guarding against is a
 * kicker above a heading; `field-catalogue.tsx` is exempted by name because its labels sit
 * above a LIST. These labels sit above an OBJECT, which is the same case and would need a
 * second exemption — so rather than widen a ban that exists for a good reason, this is its own
 * device at its own size, in Geist, sentence case, with no letterspacing.
 *
 * Sentence case is also the honest choice here: an 11px uppercase tracked label is a heading
 * treatment, and these are captions.
 */
export function ObjectLabel({
  children,
  onInk = false,
  className,
  as: As = "p",
}: {
  children: ReactNode;
  onInk?: boolean;
  className?: string;
  /**
   * A label is not always a paragraph. Inside the scan cell it sits beside the destination
   * inside one `<p>`, and a nested `<p>` is invalid HTML that browsers repair by closing the
   * outer one — which silently splits the line into two blocks.
   */
  as?: "p" | "span";
}) {
  return (
    <As
      className={mkcn(
        "font-mk-sans text-mk-caption font-mk-medium",
        onInk ? "text-mk-white/75" : "text-mk-pebble",
        className,
      )}
    >
      {children}
    </As>
  );
}
