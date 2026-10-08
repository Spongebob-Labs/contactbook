import type { CSSProperties, ReactElement, ReactNode } from "react";

import { ChevronRight } from "lucide-react";

import type { HeroPhoneIcon, HeroPhoneSocial } from "@/fixtures/marketing";

import { BRAND_CARD_FONT_VARIABLES } from "./hero-fonts";
import { ARROW_GLYPH, ROW_GLYPHS, SEND_GLYPH, SOCIAL_MARKS } from "./hero-phone-glyphs";
import { HeroMedallion } from "./hero-medallion";

/**
 * THE BRAND CARD — the client's reference card, as one component. 2026-10-06.
 *
 * The hero phone's card (`hero-card.tsx`) is a measured, still drawing of the client's reference
 * render. The client then said the cards in the Solution deck and the How-it-works panels "don't
 * look like our actual card", and named that hero card as the reference. So the drawing was lifted
 * out of `hero-card.tsx` into this file, and all three places draw it. There is no second card
 * implementation on the landing page; the product's `<CardPage>`/`<ShareFace>` are no longer used
 * by any marketing section.
 *
 * ## Two layouts, one design
 * `measured` is the hero's: every block at its measured position on the 330×793 screen, exactly
 * as before — the hero passes this and its pixels are unchanged (verified by a 2× screenshot diff
 * on 2026-10-06). `flow` is for every other use. It adds `.mk-hc--flow`, which keeps the whole
 * header (cover, wave, badge, wordmark, name, role, bio, Send to Phone) at the same measured
 * positions but lets the field sections stack in normal flow, so a card can carry whichever
 * rows it actually holds and is as tall as its content. Typography, discs, glyphs, chevrons, the
 * pill and the ground are the same rules either way — `marketing-hero.css` has both.
 *
 * ## Covers
 * `photo` is the reference's portrait (the hero and the How-it-works card that IS that card);
 * `tone` paints the cover in a card's own colour, under the same wave. Which card gets which is
 * the caller's decision — see `solution.tsx` and `how-it-works.tsx`.
 *
 * ## Ids
 * The wave's two gradients and the badge's are referenced by id, and an id must be unique per
 * page. `idPrefix` makes them so; the hero keeps the original `mk-hc` prefix, so its ids are the
 * ones it always had.
 *
 * Decorative throughout: the card is `inert` (it draws a button and rows that do nothing), and a
 * caller that needs a text alternative passes `caption`, which renders as an `sr-only`
 * `<figcaption>` — the hero's.
 */

export type BrandCardIcon = HeroPhoneIcon;

export interface BrandCardRow {
  readonly icon: BrandCardIcon;
  readonly value: string;
  /** Draws the row as just changed: an "Updated" mark in place of the chevron. Flow only. */
  readonly updated?: boolean;
}

export interface BrandCardSection {
  readonly label: string;
  readonly rows: readonly BrandCardRow[];
  /** Drawn under the section's rows, inside the section — e.g. the share panel's QR. Flow only. */
  readonly after?: ReactNode;
}

export type BrandCardCover =
  | {
      readonly kind: "photo";
      readonly x2: string;
      readonly x3: string;
      readonly priority?: boolean;
      /** A colour laid over the photo's top edge and faded out by about a third of the way down —
       *  so a stack of identical portraits still tells its cards apart by the edge that shows. */
      readonly tint?: string;
    }
  | { readonly kind: "tone"; readonly colour: string };

export interface BrandCardProps {
  readonly layout: "measured" | "flow";
  readonly cover: BrandCardCover;
  readonly brand: string;
  readonly name: string;
  /** `null` for both drops the role line; the bio then moves up into its place. */
  readonly role: string | null;
  readonly company: string | null;
  readonly bio: readonly [string, string];
  readonly action: string;
  readonly sections: readonly BrandCardSection[];
  readonly social?: { readonly label: string; readonly platforms: readonly HeroPhoneSocial[] };
  /** The label of an `updated` row's mark. */
  readonly updatedLabel?: string;
  /** An `sr-only` text alternative for the drawing. */
  readonly caption?: string;
  /** Unique per page; see "Ids" above. */
  readonly idPrefix?: string;
  /** Data attributes for the card element (the hero's is `data-hero-card`). */
  readonly cardAttributes?: Readonly<Record<`data-${string}`, string>>;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/* The lip and the gold line fade out across the dome, exactly as the reference does. */
const LIP_STOPS: readonly (readonly [number, number])[] = [
  [0, 0.85],
  [0.13, 0.81],
  [0.25, 0.61],
  [0.28, 0.31],
  [0.34, 0.18],
  [0.4, 0],
  [0.6, 0],
  [0.63, 0.05],
  [0.72, 0.23],
  [0.75, 0.5],
  [0.81, 0.63],
  [0.88, 0.72],
  [1, 1],
];
const GOLD_STOPS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.16, 0.9],
  [0.22, 0.65],
  [0.28, 0.45],
  [0.34, 0.33],
  [0.38, 0.2],
  [0.41, 0],
  [0.58, 0],
  [0.6, 0.25],
  [0.63, 0.4],
  [0.69, 0.65],
  [0.75, 0.8],
  [0.81, 1],
  [1, 1],
];

function Cover({ cover }: { cover: BrandCardCover }): ReactElement {
  if (cover.kind === "tone") {
    return (
      <span
        className="mk-hc__photo mk-hc__photo--tone"
        style={{ ["--mk-hc-tone" as string]: cover.colour }}
      />
    );
  }
  /* The reference's portrait, lifted out of the render with the notch, status bar and script
     removed (the notch and status bar are drawn live, on top) and upscaled 3×. A plain `<img>`
     on purpose: the two files are hand-made at exactly 2× and 3× the 330px design width, and
     `next/image` would re-encode them at its q75 default, softening an upscale that is already
     at the edge of its detail. Only the hero's copy is fetched at high priority. */
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="mk-hc__photo"
        src={cover.x2}
        srcSet={`${cover.x2} 2x, ${cover.x3} 3x`}
        alt=""
        width={330}
        height={262}
        {...(cover.priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
        decoding="async"
      />
      {cover.tint ? (
        <span
          aria-hidden="true"
          className="mk-hc__tint"
          style={{ ["--mk-hc-tone" as string]: cover.tint }}
        />
      ) : null}
    </>
  );
}

export function BrandCard({
  layout,
  cover,
  brand,
  name,
  role,
  company,
  bio,
  action,
  sections,
  social,
  updatedLabel = "Updated",
  caption,
  idPrefix = "mk-hc",
  cardAttributes,
  className,
  style,
}: BrandCardProps): ReactElement {
  const lipId = `${idPrefix}-lip-fade`;
  const goldId = `${idPrefix}-gold-fade`;
  const figureClass = [
    "mk-hc",
    layout === "flow" ? "mk-hc--flow" : null,
    BRAND_CARD_FONT_VARIABLES,
    className ?? null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <figure className={figureClass} style={style}>
      <div {...cardAttributes} inert className="mk-hc__card">
        <div className="mk-hc__cover">
          <Cover cover={cover} />

          {/*
            THE WAVE — photo edge, a cream lip, a 1px gold hairline, then the sheet. Paths are
            Béziers fitted to the reference's traced edge (rms 0.11px), with the dome's two
            interior knots shifted 3.4px right (the flanks keep their fitted knots): the
            reference drew dome and badge off-centre, and a centred name under an off-centre
            badge reads as a mistake. The lip and the hairline both fade out across the dome,
            exactly as the reference does.
          */}
          <svg
            className="mk-hc__wave"
            viewBox="0 0 330 265"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient id={lipId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="330" y2="0">
                {LIP_STOPS.map(([offset, opacity]) => (
                  <stop key={offset} className="mk-hc__lip-stop" offset={offset} stopOpacity={opacity} />
                ))}
              </linearGradient>
              <linearGradient id={goldId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="330" y2="0">
                {GOLD_STOPS.map(([offset, opacity]) => (
                  <stop key={offset} className="mk-hc__gold-stop" offset={offset} stopOpacity={opacity} />
                ))}
              </linearGradient>
            </defs>
            <path
              className="mk-hc__sheet"
              d="M0 248.19C32.28 248.87 64.55 241.67 96.83 228.77C110.67 223.25 127.90 219.29 141.74 208.55C155.75 197.68 169.76 196 183.77 205.58C196.80 214.48 206.43 212.79 219.46 209.89C256.31 201.68 293.15 191.05 330 197.5V265H0Z"
            />
            <path
              className="mk-hc__lip"
              fill={`url(#${lipId})`}
              d="M0.0 248.2L3.1 248.2 6.3 248.2 9.4 248.2 12.6 248.1 15.7 247.9 18.9 247.7 22.0 247.5 25.2 247.2 28.3 246.8 31.5 246.4 34.6 246.0 37.8 245.5 40.9 245.0 44.1 244.4 47.2 243.8 50.4 243.2 53.5 242.5 56.6 241.7 59.8 240.9 62.9 240.1 66.1 239.3 69.2 238.4 72.4 237.4 75.5 236.4 78.7 235.4 81.8 234.3 85.0 233.3 88.1 232.1 91.3 230.9 94.4 229.7 97.5 228.5 100.5 227.4 103.6 226.2 106.6 225.2 109.7 224.1 112.8 223.0 115.8 221.9 118.8 220.8 121.8 219.6 123.2 219.0 123.3 228.2 121.1 229.2 117.8 230.5 114.6 231.9 111.4 233.2 108.2 234.6 105.0 235.8 101.8 237.1 98.6 238.3 95.5 239.5 92.3 240.7 89.2 241.8 86.1 242.9 82.9 244.0 79.8 245.0 76.7 246.0 73.6 246.9 70.5 247.9 67.5 248.8 64.4 249.6 61.3 250.4 58.3 251.2 55.2 251.9 52.1 252.6 49.1 253.3 46.1 253.9 43.0 254.5 40.0 255.0 37.0 255.5 34.0 255.9 30.9 256.3 27.9 256.7 24.9 257.0 21.9 257.3 18.9 257.5 15.9 257.7 12.9 257.8 9.9 257.9 6.6 257.9 3.3 257.9 0.0 257.8ZM201.4 212.1L204.4 212.2 207.4 212.0 210.5 211.7 213.5 211.1 216.6 210.5 219.7 209.8 222.8 209.1 225.8 208.5 228.9 207.8 231.9 207.1 234.9 206.4 238.0 205.7 241.0 205.0 244.1 204.3 247.1 203.6 250.1 202.9 253.2 202.3 256.2 201.6 259.3 201.0 262.3 200.4 265.3 199.8 268.4 199.3 271.4 198.7 274.5 198.2 277.5 197.8 280.5 197.4 283.6 197.0 286.6 196.6 289.7 196.3 292.7 196.1 295.7 195.8 298.8 195.7 301.8 195.6 304.9 195.5 307.9 195.5 310.9 195.6 314.0 195.7 317.0 195.9 320.1 196.2 323.1 196.5 326.1 196.9 329.2 197.4 330.0 197.5 330.0 205.7 327.7 205.3 324.6 204.8 321.5 204.4 318.5 204.1 315.4 203.9 312.3 203.7 309.3 203.6 306.2 203.6 303.1 203.7 300.1 203.7 297.0 203.9 293.9 204.1 290.9 204.3 287.8 204.5 284.7 204.8 281.7 205.0 278.6 205.3 275.5 205.7 272.4 206.2 269.3 206.7 266.2 207.3 263.1 207.9 260.0 208.6 256.9 209.3 253.8 210.0 250.8 210.7 247.7 211.5 244.7 212.2 241.6 213.0 238.6 213.7 235.6 214.5 232.4 215.2 229.3 215.9 226.1 216.6 223.0 217.2 219.9 217.7 216.8 218.2 213.8 218.5 210.7 218.8 207.5 219.0 204.4 219.1 201.3 219.0Z"
            />
            <path
              className="mk-hc__gold"
              stroke={`url(#${goldId})`}
              d="M0 257.77C39.98 259.29 79.96 247.14 123.34 228.16 M201.28 219C225.56 220.17 253.24 207.66 280.92 205.1C297.28 203.58 313.64 202.49 330 205.68"
            />
          </svg>

          <HeroMedallion className="mk-hc__medallion" idPrefix={idPrefix} />
        </div>

        <div className="mk-hc__body">
          <p className="mk-hc__brand">{brand}</p>
          <p className="mk-hc__name">{name}</p>
          {role !== null || company !== null ? (
            <p className="mk-hc__role">
              <span>{role}</span>
              <span>{company}</span>
            </p>
          ) : null}
          <p className="mk-hc__bio" data-rolesless={role === null && company === null ? "" : undefined}>
            <span>{bio[0]}</span>
            <span>{bio[1]}</span>
          </p>

          <div className="mk-hc__action">
            {SEND_GLYPH}
            <span className="mk-hc__action-label">{action}</span>
            {ARROW_GLYPH}
          </div>

          {sections.map((section) => (
            <section key={section.label} className="mk-hc__section">
              <h3 className="mk-hc__label">{section.label}</h3>
              <ul className="mk-hc__rows">
                {section.rows.map((row) => (
                  <li
                    key={row.value}
                    className={`mk-hc__row mk-hc__row--${row.icon}`}
                    {...(row.updated ? { "data-updated": "" } : {})}
                  >
                    <span className="mk-hc__disc">{ROW_GLYPHS[row.icon]}</span>
                    <span className="mk-hc__value">{row.value}</span>
                    {row.updated ? (
                      <span className="mk-hc__updated">{updatedLabel}</span>
                    ) : (
                      <ChevronRight className="mk-hc__chevron" aria-hidden="true" strokeWidth={1.85} />
                    )}
                  </li>
                ))}
              </ul>
              {section.after}
            </section>
          ))}

          {social ? (
            <section className="mk-hc__section mk-hc__section--social">
              <h3 className="mk-hc__label">{social.label}</h3>
              <ul className="mk-hc__social">
                {social.platforms.map((platform) => (
                  <li key={platform} className="mk-hc__social-disc">
                    {SOCIAL_MARKS[platform]}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
      {caption ? <figcaption className="sr-only">{caption}</figcaption> : null}
    </figure>
  );
}
