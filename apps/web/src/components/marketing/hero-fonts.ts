import { DM_Sans, Inter, Libre_Caslon_Text } from "next/font/google";

/**
 * THE BRAND CARD'S OWN TYPE — three faces, chosen by rendering every plausible Google face over
 * a grid of sizes and tracking values in Chrome and scoring each against the client's reference
 * render (normalised cross-correlation), then checking the letters that tell faces apart:
 *
 *   · the name and bio — Libre Caslon Text 400 (0.914; the reference reads like Klim's Tiempos,
 *     which is commercial, and this matches its x-height, ball terminals and colour);
 *   · every sans line — Inter, variable (450 / 500 / 600), which alone of the close scorers
 *     matches the reference's 0.755 x-height-to-cap ratio;
 *   · "CONTACTBOOK" — DM Sans, whose round C and O won on the larger header wordmark (set at
 *     700: at 9px its 500 carried only 0.70× the reference's ink).
 *
 * NOTE — 2026-10-06: these moved here from `hero-card.tsx` because the card is now drawn in three
 * places on the landing page (the hero phone, the Solution deck and the How-it-works panels; see
 * `brand-card.tsx`), and the hero's proof-row titles read the serif too. One loader call per face
 * means one `@font-face` and one file however many components use it. Route-scoped: only the
 * landing page imports this module.
 *
 * ⚠ THE VARIABLES MUST LAND ON THE ELEMENT THAT READS THEM. `marketing.css` records why a
 * route-scoped face must be READ on the element that carries it: a custom property's `var()`
 * resolves where it is declared, so `marketing-hero.css` declares `--mk-phone-font-*` on `.mk-hc`
 * — the same element `BRAND_CARD_FONT_VARIABLES` is set on.
 */
export const heroSerif = Libre_Caslon_Text({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-hero-serif",
  display: "swap",
});

export const heroSans = Inter({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-hero-sans",
  display: "swap",
});

export const heroCaps = DM_Sans({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-hero-caps",
  display: "swap",
});

/** The three next/font variable classes, joined — set on every brand card's `<figure>`. */
export const BRAND_CARD_FONT_VARIABLES = [heroSerif, heroSans, heroCaps]
  .map((f) => f.variable)
  .join(" ");
