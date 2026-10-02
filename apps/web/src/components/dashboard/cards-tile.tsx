import Link from "next/link";
import type { CSSProperties, ReactElement } from "react";
import { IdCard, Plus } from "lucide-react";

import { CardPageThumb } from "@/card/card-page-thumb";
import { paletteVars } from "@/card/template-palettes";
import { buttonClassName } from "@/components/primitives/button";
import { cn } from "@/lib/cn";
import type { ResolvedCard } from "@/types/domain";

import { SummaryTile, TileCount, TileEmpty } from "./summary-tile";

import "@/styles/card-tile.css";

/**
 * The Cards tile: how many cards the owner has, the three they touched last, and "New card".
 *
 * ## The thumbnails follow the tile rule
 *
 * A thumbnail is only the card's own design. Nothing of the dashboard's invention goes inside
 * it, and the whole thumbnail is one link to `/cards/{id}`. `<CardPageThumb>` renders its subtree
 * `inert`, and the wrapper is `aria-hidden`, so each thumbnail is exactly one tab stop named by
 * the card's name.
 *
 * ## ⚠ The scale is a breakpoint table, not a measurement
 *
 * `--card-thumb-scale` is read by `<CardPageThumb>` as a CSS variable, because measuring in
 * JavaScript renders one size on the server and another on the client. So the table below is
 * derived from the tile's width at each breakpoint (tile = (content − 2 × 16px gap) / 3 from
 * `lg`, full width below it; 20px padding; 8px between thumbnails):
 *
 *   < 380px   0.27  → 91px   three fit in a 296px tile body (360px phone)
 *   ≥ 380px   0.30  → 101px  326px body at 390
 *   ≥ 414px   0.32  → 108px
 *   ≥ md      0.45  → 151px  tiles are full width until lg
 *   ≥ lg      0.24  → 81px   186px body at 1024: only TWO fit, so the third is hidden to xl
 *   ≥ xl      0.24  → 81px   272px body at 1280: three fit (259px)
 *   ≥ 1400px  0.28  → 94px   312px body at 1400
 *
 * If the tile padding, the grid gap or the shell's content width changes, re-derive this.
 */

/** How many cards the tile previews. */
export const CARD_THUMB_LIMIT = 3;

const THUMB_ROW_CLASS = cn(
  "flex gap-2",
  "[--card-thumb-scale:0.27] min-[380px]:[--card-thumb-scale:0.3] min-[414px]:[--card-thumb-scale:0.32]",
  "md:[--card-thumb-scale:0.45] lg:[--card-thumb-scale:0.24] min-[1400px]:[--card-thumb-scale:0.28]",
);

export interface CardsTileProps {
  /** `totals.cards` from `GET /dashboard`. `null` when the API sent no usable count. */
  count: number | null;
  /** Most recently updated first, already capped. Empty when the card list could not be read. */
  recent: readonly ResolvedCard[];
}

export function CardsTile({ count, recent }: CardsTileProps): ReactElement {
  const empty = count === 0;

  return (
    <SummaryTile
      region="cards"
      title="Cards"
      link={empty ? undefined : { label: "View all", href: "/cards", ariaLabel: "View all cards" }}
      footer={
        empty ? (
          <Link
            href="/cards/new"
            data-cards-tile-create=""
            className={buttonClassName({ variant: "primary", className: "self-start" })}
          >
            Create your first card
          </Link>
        ) : (
          <Link
            href="/cards/new"
            data-cards-tile-new=""
            className={buttonClassName({ variant: "secondary", className: "self-start" })}
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            New card
          </Link>
        )
      }
    >
      {empty ? (
        <TileEmpty icon={IdCard} label="No cards yet" handle="data-cards-tile-empty" />
      ) : (
        <>
          <TileCount value={count} label={count === 1 ? "card" : "cards"} />

          {recent.length === 0 ? null : (
            <ul data-cards-tile-thumbs="" className={THUMB_ROW_CLASS}>
              {recent.slice(0, CARD_THUMB_LIMIT).map((resolved, i) => (
                <li
                  key={resolved.cardId}
                  /* The third thumbnail does not fit a 1024–1279px tile. */
                  className={cn("min-w-0", i === 2 && "lg:max-xl:hidden")}
                >
                  <CardThumbLink resolved={resolved} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </SummaryTile>
  );
}

function CardThumbLink({ resolved }: { resolved: ResolvedCard }): ReactElement {
  return (
    <div
      data-dashboard-card-thumb={resolved.cardId}
      className={cn(
        "relative rounded-sm",
        "[box-shadow:var(--elevation-card)] hover:[box-shadow:var(--elevation-2)]",
        "transition-[box-shadow] duration-[var(--dur-fast)] ease-out",
      )}
    >
      <span
        aria-hidden="true"
        className="relative block overflow-hidden rounded-sm border border-line"
        /* The veil fades to `--c-sheet`, which `paletteVars` sets inside the card root. The veil
           is a sibling of that root, so the variables go on this wrapper too. */
        style={paletteVars(resolved.palette) as CSSProperties}
      >
        {/* `rounded-none!`: the thumb states its own 14px radius inline, which is right at 200px
            and a pill at 81px. The wrapper's radius clips it instead. */}
        <CardPageThumb resolved={resolved} className="rounded-none!" />
        <span className="cb-tile-veil" />
      </span>

      {/* ⚠ **A stretched link BESIDE the preview, never around it.** The card page renders real
          `<a>` elements for its actionable fields (inert, but still anchors), and an `<a>` inside
          an `<a>` is invalid HTML that React reports as a hydration error. `<CardThumbTile>`
          solves it the same way. */}
      <Link
        href={`/cards/${resolved.cardId}`}
        aria-label={resolved.cardName}
        title={resolved.cardName}
        className="absolute inset-0 rounded-sm"
      />
    </div>
  );
}
