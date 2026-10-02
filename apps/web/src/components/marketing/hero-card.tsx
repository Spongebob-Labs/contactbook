import type { ReactElement } from "react";

import { ChevronRight } from "lucide-react";
import { DM_Sans, Inter, Libre_Caslon_Text, Yellowtail } from "next/font/google";

import { heroPhone } from "@/fixtures/marketing";

import { ARROW_GLYPH, ROW_GLYPHS, SEND_GLYPH, SOCIAL_MARKS } from "./hero-phone-glyphs";
import { HeroMedallion } from "./hero-medallion";
import { PhoneFrame } from "./phone-frame";

/**
 * THE HERO'S CARD — the client's reference card, drawn still, in the reference's phone.
 *
 * ## ⚠ 2026-09-29 — NO LONGER THE PRODUCT'S `<CardPage>`, AND NO LONGER MOVING
 *
 * From 2026-09-20 this file rendered the real `<CardPage>`, and from 2026-09-28 it re-resolved
 * that card once per city so it could animate — a cross-fade between cards, with changed lines
 * tinted and tagged "Updated". The client rejected the result as "just the opposite" of their
 * reference: a component built to lay out any card cannot also be one specific, crafted
 * composition, and the automatic highlighting was never asked for. So this is now a bespoke,
 * still drawing of the reference card, with every size, gap, ink and glyph read off the
 * reference render (the measured specs are summarised in `marketing-hero.css`).
 *
 * What that costs, said plainly: this card no longer proves anything about `<CardPage>`. It is
 * a picture of a card — which is also all the reference is.
 *
 * ## Layout
 * The card is laid out at a FIXED 330px design width (the reference's screen, 326px, ×1.012)
 * and fills the screen exactly: the reference ends on its social row with 24px of sheet below
 * it, so nothing is clipped. The device's rendered size comes only from `--mk-phone-zoom`
 * (`hero.tsx`), so this layout is never reflowed — it is re-rasterised at the target size.
 *
 * ## Why `inert`, and the caption
 * It draws a button and tappable rows that do nothing. `inert` removes the whole subtree from
 * the tab order and the accessibility tree (`aria-hidden` over focusable content would be a
 * WCAG failure of its own), and the `<figcaption>` describes the card in its place.
 */
/*
  THE REFERENCE CARD'S OWN TYPE — four faces, chosen by rendering every plausible Google face over
  a grid of sizes and tracking values in Chrome and scoring each against the reference's pixels
  (normalised cross-correlation), then checking the letters that tell faces apart:

    · the name and bio — Libre Caslon Text 400 (0.914; the reference reads like Klim's Tiempos,
      which is commercial, and this matches its x-height, ball terminals and colour);
    · every sans line — Inter, variable (450 / 500 / 600), which alone of the close scorers
      matches the reference's 0.755 x-height-to-cap ratio;
    · "CONTACTBOOK" — DM Sans, whose round C and O won on the larger header wordmark (set at
      700: at 9px its 500 carried only 0.70× the reference's ink);
    · the handwriting — Yellowtail, the best pixel match of ~90 scripts (the reference's own
      signature brush is unidentified).

  ⚠ LOADED HERE, NOT IN A LAYOUT, AND THE VARIABLES LAND ON THIS CARD'S OWN `<figure>`. Only the
  landing hero draws this card, so only its route should fetch the faces. And `marketing.css`
  records why a route-scoped face must be READ on the element that carries it: a custom
  property's `var()` resolves where it is declared, so `marketing-hero.css` declares
  `--mk-phone-font-*` on `.mk-hc` — the same element these classes are on.
*/
const heroSerif = Libre_Caslon_Text({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-hero-serif",
  display: "swap",
});
const heroSans = Inter({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-hero-sans",
  display: "swap",
});
const heroCaps = DM_Sans({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-hero-caps",
  display: "swap",
});
const heroScript = Yellowtail({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-hero-script",
  display: "swap",
});

const FONT_VARIABLES = [heroSerif, heroSans, heroCaps, heroScript].map((f) => f.variable).join(" ");

export function HeroCard(): ReactElement {
  const c = heroPhone;
  return (
    <PhoneFrame>
      <figure className={`mk-hc ${FONT_VARIABLES}`}>
        <div data-hero-card="" inert className="mk-hc__card">
          <div className="mk-hc__cover">
            {/* The reference's portrait, lifted out of the render with the notch, status bar
                and script removed (they are drawn live, on top) and upscaled 3×.
                A plain `<img>` on purpose: the two files are hand-made at exactly 2× and 3×
                the 330px design width, and `next/image` would re-encode them at its q75
                default, softening an upscale that is already at the edge of its detail. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="mk-hc__photo"
              src={c.portrait.x2}
              srcSet={`${c.portrait.x2} 2x, ${c.portrait.x3} 3x`}
              alt=""
              width={330}
              height={262}
              fetchPriority="high"
              decoding="async"
            />
            <p className="mk-hc__script">
              {c.script.map((line) => (
                <span key={line} className="mk-hc__script-line">
                  {line}
                </span>
              ))}
            </p>
            {/* The underline flourish under the last script line. */}
            <svg className="mk-hc__flourish" viewBox="0 0 32 9" aria-hidden="true" focusable="false">
              <path d="M1.2 7.6C10.6 5.7 20.6 3.5 30.6 1.4" />
            </svg>

            {/*
              THE WAVE — photo edge, a cream lip, a 1px gold hairline, then the sheet. Paths are
              Béziers fitted to the reference's traced edge (rms 0.11px), with the dome's two
              interior knots shifted 3.4px right (the flanks keep their fitted knots): the
              reference drew dome and badge off-centre, and a centred name under an off-centre
              badge reads as a mistake. The lip and the hairline both
              fade out across the dome, exactly as the reference does.
            */}
            <svg
              className="mk-hc__wave"
              viewBox="0 0 330 265"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <linearGradient id="mk-hc-lip-fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="330" y2="0">
                  <stop offset="0" stopOpacity="0.85" />
                  <stop offset="0.13" stopOpacity="0.81" />
                  <stop offset="0.25" stopOpacity="0.61" />
                  <stop offset="0.28" stopOpacity="0.31" />
                  <stop offset="0.34" stopOpacity="0.18" />
                  <stop offset="0.4" stopOpacity="0" />
                  <stop offset="0.6" stopOpacity="0" />
                  <stop offset="0.63" stopOpacity="0.05" />
                  <stop offset="0.72" stopOpacity="0.23" />
                  <stop offset="0.75" stopOpacity="0.5" />
                  <stop offset="0.81" stopOpacity="0.63" />
                  <stop offset="0.88" stopOpacity="0.72" />
                  <stop offset="1" stopOpacity="1" />
                </linearGradient>
                <linearGradient id="mk-hc-gold-fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="330" y2="0">
                  <stop offset="0" stopOpacity="1" />
                  <stop offset="0.16" stopOpacity="0.9" />
                  <stop offset="0.22" stopOpacity="0.65" />
                  <stop offset="0.28" stopOpacity="0.45" />
                  <stop offset="0.34" stopOpacity="0.33" />
                  <stop offset="0.38" stopOpacity="0.2" />
                  <stop offset="0.41" stopOpacity="0" />
                  <stop offset="0.58" stopOpacity="0" />
                  <stop offset="0.6" stopOpacity="0.25" />
                  <stop offset="0.63" stopOpacity="0.4" />
                  <stop offset="0.69" stopOpacity="0.65" />
                  <stop offset="0.75" stopOpacity="0.8" />
                  <stop offset="0.81" stopOpacity="1" />
                  <stop offset="1" stopOpacity="1" />
                </linearGradient>
              </defs>
              <path
                className="mk-hc__sheet"
                d="M0 248.19C32.28 248.87 64.55 241.67 96.83 228.77C110.67 223.25 127.90 219.29 141.74 208.55C155.75 197.68 169.76 196 183.77 205.58C196.80 214.48 206.43 212.79 219.46 209.89C256.31 201.68 293.15 191.05 330 197.5V265H0Z"
              />
              <path
                className="mk-hc__lip"
                d="M0.0 248.2L3.1 248.2 6.3 248.2 9.4 248.2 12.6 248.1 15.7 247.9 18.9 247.7 22.0 247.5 25.2 247.2 28.3 246.8 31.5 246.4 34.6 246.0 37.8 245.5 40.9 245.0 44.1 244.4 47.2 243.8 50.4 243.2 53.5 242.5 56.6 241.7 59.8 240.9 62.9 240.1 66.1 239.3 69.2 238.4 72.4 237.4 75.5 236.4 78.7 235.4 81.8 234.3 85.0 233.3 88.1 232.1 91.3 230.9 94.4 229.7 97.5 228.5 100.5 227.4 103.6 226.2 106.6 225.2 109.7 224.1 112.8 223.0 115.8 221.9 118.8 220.8 121.8 219.6 123.2 219.0 123.3 228.2 121.1 229.2 117.8 230.5 114.6 231.9 111.4 233.2 108.2 234.6 105.0 235.8 101.8 237.1 98.6 238.3 95.5 239.5 92.3 240.7 89.2 241.8 86.1 242.9 82.9 244.0 79.8 245.0 76.7 246.0 73.6 246.9 70.5 247.9 67.5 248.8 64.4 249.6 61.3 250.4 58.3 251.2 55.2 251.9 52.1 252.6 49.1 253.3 46.1 253.9 43.0 254.5 40.0 255.0 37.0 255.5 34.0 255.9 30.9 256.3 27.9 256.7 24.9 257.0 21.9 257.3 18.9 257.5 15.9 257.7 12.9 257.8 9.9 257.9 6.6 257.9 3.3 257.9 0.0 257.8ZM201.4 212.1L204.4 212.2 207.4 212.0 210.5 211.7 213.5 211.1 216.6 210.5 219.7 209.8 222.8 209.1 225.8 208.5 228.9 207.8 231.9 207.1 234.9 206.4 238.0 205.7 241.0 205.0 244.1 204.3 247.1 203.6 250.1 202.9 253.2 202.3 256.2 201.6 259.3 201.0 262.3 200.4 265.3 199.8 268.4 199.3 271.4 198.7 274.5 198.2 277.5 197.8 280.5 197.4 283.6 197.0 286.6 196.6 289.7 196.3 292.7 196.1 295.7 195.8 298.8 195.7 301.8 195.6 304.9 195.5 307.9 195.5 310.9 195.6 314.0 195.7 317.0 195.9 320.1 196.2 323.1 196.5 326.1 196.9 329.2 197.4 330.0 197.5 330.0 205.7 327.7 205.3 324.6 204.8 321.5 204.4 318.5 204.1 315.4 203.9 312.3 203.7 309.3 203.6 306.2 203.6 303.1 203.7 300.1 203.7 297.0 203.9 293.9 204.1 290.9 204.3 287.8 204.5 284.7 204.8 281.7 205.0 278.6 205.3 275.5 205.7 272.4 206.2 269.3 206.7 266.2 207.3 263.1 207.9 260.0 208.6 256.9 209.3 253.8 210.0 250.8 210.7 247.7 211.5 244.7 212.2 241.6 213.0 238.6 213.7 235.6 214.5 232.4 215.2 229.3 215.9 226.1 216.6 223.0 217.2 219.9 217.7 216.8 218.2 213.8 218.5 210.7 218.8 207.5 219.0 204.4 219.1 201.3 219.0Z"
              />
              <path
                className="mk-hc__gold"
                d="M0 257.77C39.98 259.29 79.96 247.14 123.34 228.16 M201.28 219C225.56 220.17 253.24 207.66 280.92 205.1C297.28 203.58 313.64 202.49 330 205.68"
              />
            </svg>

            <HeroMedallion className="mk-hc__medallion" />
          </div>

          <div className="mk-hc__body">
            <p className="mk-hc__brand">{c.brand}</p>
            <p className="mk-hc__name">{c.name}</p>
            <p className="mk-hc__role">
              <span>{c.role}</span>
              <span>{c.company}</span>
            </p>
            <p className="mk-hc__bio">
              <span>{c.bio[0]}</span>
              <span>{c.bio[1]}</span>
            </p>

            <div className="mk-hc__action">
              {SEND_GLYPH}
              <span className="mk-hc__action-label">{c.action}</span>
              {ARROW_GLYPH}
            </div>

            {c.sections.map((section) => (
              <section key={section.label} className="mk-hc__section">
                <h3 className="mk-hc__label">{section.label}</h3>
                <ul className="mk-hc__rows">
                  {section.rows.map((row) => (
                    <li key={row.value} className={`mk-hc__row mk-hc__row--${row.icon}`}>
                      <span className="mk-hc__disc">{ROW_GLYPHS[row.icon]}</span>
                      <span className="mk-hc__value">{row.value}</span>
                      <ChevronRight className="mk-hc__chevron" aria-hidden="true" strokeWidth={1.85} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <section className="mk-hc__section mk-hc__section--social">
              <h3 className="mk-hc__label">{c.socialLabel}</h3>
              <ul className="mk-hc__social">
                {c.social.map((platform) => (
                  <li key={platform} className="mk-hc__social-disc">
                    {SOCIAL_MARKS[platform]}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
        <figcaption className="sr-only">{c.caption}</figcaption>
      </figure>
    </PhoneFrame>
  );
}
