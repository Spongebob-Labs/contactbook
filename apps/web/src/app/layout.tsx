import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Sans, Space_Grotesk } from "next/font/google";

import "@/styles/globals.css";

/**
 * One typeface for the whole product.
 *
 * The previous build paired an editorial serif (Newsreader) with a second grotesk and
 * put the serif on every heading in the app. That is the single loudest "this is not a
 * modern product" signal in the old screens, and it is also derivative: the reference
 * brand this was modelled on licenses Tiempos + Modern Era, and copies of both were
 * sitting in the repository root. Both files are deleted; neither typeface is used.
 *
 * Geist is variable across 100–900, so weight carries the hierarchy a second family used
 * to carry. `--weight-semibold: 560` in `tokens.css` is a real interpolated instance, not
 * a synthesised bold.
 *
 * The CSS variable names are NOT `--font-sans` / `--font-mono`: those are Tailwind theme
 * keys in `globals.css`, and a theme key that references a variable of its own name is a
 * self-reference Tailwind emits verbatim into `:root`, invalidating it. `tokens.css`
 * aliases `--font-sans: var(--font-geist)`, so components write `font-sans` as normal.
 */
const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
  fallback: ["system-ui", "Segoe UI", "Helvetica Neue", "Arial"],
});

/**
 * Mono is used in exactly two places: the public card slug and a copied share URL. It is
 * loaded here rather than route-scoped because both surfaces are reachable from any route.
 */
const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

/**
 * The display face — headings only, and only inside the app's own chrome.
 *
 * Geist stays the body everywhere; this is not a replacement. The rule above about one family
 * was written against a build that put an editorial *serif* on every heading, and it was right
 * about that. What it over-corrected into was a dashboard with no voice at all: a neutral
 * grotesque at four weights, where hierarchy was the only thing distinguishing a page title from
 * a table row.
 *
 * Space Grotesk is a geometric grotesque with actual opinions — a single-storey `g`, a
 * straight-tailed `y`, an angular `k` — so a heading reads as designed rather than as defaulted,
 * while 15px body copy keeps Geist's neutrality where legibility is the only thing that matters.
 *
 * ⚠ It is bound to the three `.text-h*` utilities in `globals.css`, **not** to `h1`/`h2`/`h3`.
 * That is what keeps it out of the two places it must never appear: cards set their type with
 * inline `var(--text-h*)` sizes and pin `font-family: var(--font-sans)` on their own root, and
 * the marketing site draws from the separate `--mk-*` scale. Tag selectors would have reached
 * both.
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

/**
 * The **app chrome's** face — dashboard, cards list, builder, contacts, profile.
 *
 * ## ⚠ Loaded through `next/font`, not through the `<link>` tags it was requested as
 *
 * The brief arrived as a Google Fonts embed — two `preconnect`s and a stylesheet `<link>`.
 * Pasting that in would have cost three things this file already buys: the font files are
 * self-hosted from our own origin instead of fetched from `fonts.gstatic.com` on the critical
 * path, the stylesheet request is gone entirely rather than render-blocking, and `next/font`
 * generates a `size-adjust`-corrected local fallback so headings do not reflow when the real
 * face swaps in. Same family, same axes — declared the way the other three already are.
 *
 * The URL also carried **Fraunces** and **Noto Sans**. Neither is loaded, because neither is
 * used: the ask was *visual consistency*, and consistency is one family doing the work. A
 * webfont nothing renders is bytes, a preconnect and a fallback-metric penalty for nothing.
 * Fraunces is also a serif, which `PRODUCT.md`'s brand commitments rule out.
 *
 * ## Why one family, when the chrome had two
 *
 * The chrome ran Geist for body and Space Grotesk for `.text-h*`. Returning it to a single face
 * is what was asked for, and it is also what the original brand commitment says: *"Personality
 * comes from weight, tracking and case — not from loading a second family."* Instrument Sans is
 * variable across 400–700 with a true italic, so the heading steps keep their event through
 * weight and size rather than through a change of voice.
 *
 * **Geist stays loaded and is still the card's face** — see `--font-app` in `tokens.css` for
 * why that separation is the point rather than an oversight. `Space_Grotesk` stays too: the
 * marketing site's `--mk-font-display` reads `--font-space` directly and is untouched by this.
 */
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  /* Both, matching the requested URL's `ital,wght@0,400..700;1,400..700`. The italic is a
     drawn companion here, not a synthesised oblique, and it is worth the second file. */
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Contact Book",
    template: "%s · Contact Book",
  },
  description:
    "One card. One QR. Every field you choose. Build a contact card from your own profile, share it as a QR code, and let anyone save it to their phone.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${instrumentSans.variable} h-full antialiased`}
    >
      {/* ⚠ `suppressHydrationWarning` is here for **browser extensions**, and for nothing this
          app does.

          Extensions stamp their own attributes onto the document shell before React hydrates —
          ColorZilla writes `cz-shortcut-listen="true"` on `<body>`, and Grammarly, LastPass and
          Dark Reader all do something similar. React compares the served HTML against the
          client tree, finds an attribute the server never wrote, and reports a hydration
          mismatch the app cannot fix: the markup here is a static string, and nothing in
          `src/` sets an attribute on `<body>` at all.

          It is safe because it is **one level deep** — it makes React accept the DOM for this
          element's own attributes and text, and does not cascade to children. A real hydration
          bug anywhere inside the app still reports normally, which is the whole reason to reach
          for this rather than for a console filter: the noise was hiding the signal.

          If an extension ever stamps `<html>` instead, the same one word goes there. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
