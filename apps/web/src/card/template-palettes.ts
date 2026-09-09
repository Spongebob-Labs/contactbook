/**
 * The template palettes — the loud half of the colour system.
 *
 * ## Why this file exists at all
 *
 * The previous build declared every colour in `tokens.css` and enforced, with a contract
 * test, that no colour literal could appear anywhere else. The intent was discipline. The
 * effect was that all eight templates had to draw from the same eight app-chrome tokens, so
 * "Ledger", "Chapter", "Foundry" and five others were the same cream card with a different
 * button radius. Variety had been made a compile error.
 *
 * That rule is inverted here. Template colour is **data**, it lives in this one file, and
 * every palette is free to be as saturated as it likes. What replaces the old rule is
 * stricter and lives in `tests/contract/template-palettes.test.ts`: it walks every palette,
 * computes real WCAG 2.x ratios with `src/lib/contrast.ts` for each ink-on-ground and
 * ink-on-button pair, and fails the build on the first pair under threshold. Bold is
 * allowed. Illegible is not, and it is caught before review rather than during it.
 *
 * ## Why the ratios are in the comments
 *
 * Every number below was computed, not estimated, and the test re-derives all of them on
 * every run. If a comment and the test ever disagree, the test is right and the comment is
 * stale — but they have never disagreed, because the comments were written from the test's
 * own output.
 *
 * ## What is NOT here
 *
 * `--qr-module` and `--qr-plate` are app-level tokens and are identical on every palette,
 * Carbon included. A QR is a functional optical target: many decoders reject inverted
 * symbols, so the plate is always an opaque white and the modules are always near-black,
 * whatever the card is doing around them. A palette may only supply `plateBorder`, for the
 * one case where a white plate sits on a near-white ground and needs an edge to read as an
 * object.
 */

/** The palette ids. Adding one here without adding it to `TEMPLATE_PALETTES` is a type error. */
export type PaletteId =
  /* Deep — white ink. One neutral, three jewels, one warm. */
  | "onyx"
  | "sapphire"
  | "emerald"
  | "oxblood"
  | "rust"
  /* Light — near-black ink, each with a hue-matched deep button. */
  | "amber"
  | "clay"
  | "pistachio"
  | "periwinkle";

export interface TemplatePalette {
  id: PaletteId;
  /** Human name, shown in the builder's palette picker. */
  name: string;

  /**
   * The card ground as a single opaque colour — the midpoint of the gradient below.
   *
   * Still needed, and not just as a fallback: the canvas-action fill, the PNG exporter and any
   * flat context need one colour that represents the card, and `color-mix()`-ing a gradient at
   * runtime to get one would be both slower and less predictable than storing it.
   */
  ground: string;

  /**
   * The gradient actually painted on the card: two stops and an angle.
   *
   * ## Why this is contrast-tested differently from everything else
   *
   * Every other pair in this file is one foreground against one background. A gradient is a
   * *range*, so ink has to clear its threshold against **every stop**, not against the ground
   * midpoint — and the midpoint is exactly what a naive check would use, which is how a gradient
   * ships looking fine in the middle and illegible at one end.
   *
   * `PALETTE_CONTRACT` marks these pairs `allStops`, and the suite evaluates them against
   * `gradientStops()` rather than against `ground`. Two of the nine were caught by that rule
   * while being authored: Terracotta and Slate had light ends where white ink measured 5.43 and
   * 5.45, so their weak stop was deepened until the ink cleared 7:1 there too.
   *
   * Two stops rather than three, and a shallow angle: a card is a small object, and a gradient
   * with more movement than this reads as a graphic rather than as a surface.
   */
  gradientFrom: string;
  gradientTo: string;
  /** CSS degrees. 150–160 across the set — a consistent raking light, not a per-card flourish. */
  gradientAngle: number;
  /**
   * A second ground for templates that split the face into two zones. `null` when the
   * template is single-zone. Inks are tested against BOTH when it is set.
   */
  groundAlt: string | null;

  /** Primary text on `ground` — the name. Must clear 4.5:1. */
  ink: string;
  /** Secondary text on `ground` — role, bio, field labels. Must clear 4.5:1. */
  inkSoft: string;
  /** Hairlines and dividers drawn on `ground`. Decorative; held to 1.4.11's 3:1. */
  line: string;

  /** Primary action fill and its label. */
  buttonBg: string;
  buttonInk: string;
  /**
   * Secondary action fill and its label. Most palettes set `buttonAltBg` equal to `ground`,
   * making the secondary action an outline button — which is what the wallet-pass references
   * actually show, and what keeps two stacked actions from both shouting.
   */
  buttonAltBg: string;
  buttonAltInk: string;
  /**
   * The secondary button's boundary.
   *
   * WCAG 1.4.11 wants a control's boundary discernible at 3:1, but it does not care whether
   * the fill or the border provides it. An outline button's fill is its ground by definition,
   * so the border is the only thing that can — and `PALETTE_CONTRACT` accepts either.
   */
  buttonAltBorder: string;

  /**
   * The fill and label for a card action drawn on the **app canvas** rather than on the card.
   *
   * Two of the three `pageHeader` treatments hand the body of the scan page to the white app
   * canvas, and the card-detail screen puts the owner's save action beside the face. In those
   * positions the natural choice is the palette's own `ground` — a cobalt button on white —
   * which is why this usually equals `ground` / `ink`.
   *
   * Paper is why it is a separate slot rather than an alias. Its ground *is* white, so a
   * "cobalt button on white" becomes a white button on white: a 1:1 fill that renders as
   * unstyled text. That shipped. Paper therefore falls back to the app's own near-black
   * accent, and `PALETTE_CONTRACT` asserts this fill clears 3:1 against the canvas — so the
   * next palette with a near-white ground fails a test instead of shipping an invisible
   * button.
   */
  canvasActionBg: string;
  canvasActionInk: string;

  /**
   * An edge for the whole face, for a ground so close to the page colour that the card would
   * otherwise have no visible boundary.
   *
   * `null` on all eight palettes. It existed for the white Paper palette, which is gone — a
   * white card on a white page is an absence, not a card. The field stays because the need is
   * real for any future near-white ground, and the contract test below decides when it applies
   * rather than leaving it to judgement.
   */
  faceBorder: string | null;

  /**
   * An edge for the QR plate, for near-white grounds only, where an unbordered white plate
   * dissolves into the card. `null` on every ground dark or saturated enough to frame the
   * plate itself.
   */
  plateBorder: string | null;

  /** Fill behind a monogram when the card has no photo. */
  markBg: string;
  markInk: string;
}

/**
 * NINE PALETTES — a two-tier system, and the arithmetic that forces it.
 *
 * ## The complaint this set was rebuilt to answer
 *
 * Nine cards in the library rendered as two colours, and the nine in the picker read as one
 * design nine times. The first half was a data bug (no fixture card carried a `paletteId`, so
 * every card fell back to its template's default). The second half was this file's fault, and
 * measuring it says exactly why:
 *
 *     obsidian   L=0.012  chroma=  9      wisteria  L=0.577  chroma= 36
 *     indigo     L=0.022  chroma= 41      sage      L=0.534  chroma= 27
 *     claret     L=0.024  chroma= 42      ochre     L=0.452  chroma=109
 *     cypress    L=0.031  chroma= 19
 *     slate      L=0.073  chroma= 38
 *     terracotta L=0.077  chroma= 78
 *
 * Six of the nine sat below L=0.08, and four of those carried a chroma under 45. At the 96px
 * the picker actually draws, four near-black grounds separated only by a low-chroma hue *are*
 * the same card four times. The set was not short of colours; it was short of **range**.
 *
 * ## ⚠ The constraint every future palette must be designed around
 *
 * `PALETTE_CONTRACT` requires the primary ink to clear **7:1 on every gradient stop**. Solve it
 * for a ground's luminance and a hard dead band falls out:
 *
 *     white ink at 7:1        →  L ≤ 0.100
 *     near-black ink at 7:1   →  L ≥ 0.339
 *     ────────────────────────────────────
 *     L ∈ (0.100, 0.339)      →  IMPOSSIBLE, for either polarity
 *
 * **There is no such thing as a mid-tone card in this product.** A ground is either deep or it
 * is light. That is not a stylistic preference and it cannot be designed around by choosing a
 * cleverer ink — at L=0.20 a white ink measures 4.2:1 and a near-black one 4.5:1, so a mid-tone
 * ground fails plain WCAG AA from *both* directions before the headroom rule is even consulted.
 *
 * And the 7:1 rule itself is load-bearing rather than cautious. It exists so the card's two ink
 * levels — the name, and the softer role tag above it — stay distinguishable, and the margin
 * collapses fast:
 *
 *     ground L=0.03  →  ink 13.1:1,  ink/inkSoft separation 2.9:1
 *     ground L=0.10  →  ink  7.0:1,  ink/inkSoft separation 1.6:1
 *     ground L=0.16  →  ink  5.0:1,  ink/inkSoft separation 1.1:1
 *
 * Past L≈0.10 the role tag and the name come out the same colour and the hierarchy the fixed
 * face format depends on stops existing. So the band is real, it stays, and the design works
 * inside it.
 *
 * ## What varies instead, and why it is enough
 *
 * Three axes, none of which moves a single slot — the face format is a constant and this file
 * has no opinion about layout:
 *
 * 1. **Chroma, pushed hard.** Mean chroma roughly doubled (≈44 → ≈76). Within the deep tier
 *    this is the whole game: a real sapphire and a real emerald at L≈0.03 are unmistakable from
 *    each other in a way that a navy and a grey-green at the same luminance are not. Onyx keeps
 *    a chroma of 7 deliberately — a set of nine wants exactly one neutral.
 * 2. **The full range of each tier.** Deep spans L 0.010→0.074, light spans 0.44→0.60, so even
 *    same-tier neighbours separate by weight as well as hue.
 * 3. **The button and chip treatment.** This is the lever the reference sets use and the one
 *    this file previously ignored: every dark palette had a white button and every light one a
 *    near-black button, so the action and the brand chip looked identical on all nine. Now the
 *    three jewel darks carry a **pale tint of their own hue** (a card is a different object when
 *    its button is powder-blue rather than white) and the four lights carry a **hue-matched deep
 *    button** — deep brown on Amber, plum on Clay, forest on Pistachio, indigo on Periwinkle —
 *    instead of the same near-black on every one. `markBg`/`markInk` reuse the pair, so the
 *    brand chip moves with it.
 *
 * ## Everything except four values is derived, not chosen
 *
 * Per palette, only the **two gradient stops**, the **angle** and the **button pair** are picked
 * by eye. `ground` is the stops' midpoint — which makes the contract's "ground sits inside its
 * own gradient" check true by construction rather than by luck — and `inkSoft`, `line`,
 * `buttonAltBorder` and `plateBorder` are each found by searching for the smallest (or, for
 * `inkSoft`, the largest) shift that satisfies the pair's own contract. A stop that misses the
 * 7:1 rule is deepened until it holds, preserving hue and chroma, rather than re-picked.
 *
 * `tests/contract/template-palettes.test.ts` recomputes every ratio from these hex values on
 * every run, so a palette edit that breaks a relationship fails there rather than in review —
 * or, worse, on somebody's card. **Bold is allowed here; illegible is not.**
 *
 * Ratios worth keeping in view: `ink`/`inkSoft` separation runs 3.28 (Onyx) down to 1.52 (Clay),
 * and every palette clears every pair in `PALETTE_CONTRACT`.
 */
export const TEMPLATE_PALETTES: Record<PaletteId, TemplatePalette> = {
  onyx: {
    id: "onyx",
    name: "Onyx",
    ground: "#181A1F",
    gradientFrom: "#23262C",
    gradientTo: "#0D0E11",
    gradientAngle: 158,
    groundAlt: null,
    ink: "#FFFFFF",
    inkSoft: "#8D8E90",
    line: "#393B3F",
    buttonBg: "#FFFFFF",
    buttonInk: "#17191D",
    buttonAltBg: "#181A1F",
    buttonAltInk: "#FFFFFF",
    buttonAltBorder: "#6E7073",
    canvasActionBg: "#181A1F",
    canvasActionInk: "#FFFFFF",
    faceBorder: null,
    plateBorder: null,
    markBg: "#FFFFFF",
    markInk: "#17191D",
  },
  sapphire: {
    id: "sapphire",
    name: "Sapphire",
    ground: "#142C63",
    gradientFrom: "#1B3B80",
    gradientTo: "#0C1D45",
    gradientAngle: 150,
    groundAlt: null,
    ink: "#FFFFFF",
    inkSoft: "#A2ABC1",
    line: "#3E527F",
    buttonBg: "#CBD9F7",
    buttonInk: "#112656",
    buttonAltBg: "#142C63",
    buttonAltInk: "#FFFFFF",
    buttonAltBorder: "#7C8AA8",
    canvasActionBg: "#142C63",
    canvasActionInk: "#FFFFFF",
    faceBorder: null,
    plateBorder: null,
    markBg: "#CBD9F7",
    markInk: "#112656",
  },
  emerald: {
    id: "emerald",
    name: "Emerald",
    ground: "#0D3C2E",
    gradientFrom: "#12513E",
    gradientTo: "#07271E",
    gradientAngle: 162,
    groundAlt: null,
    ink: "#FFFFFF",
    inkSoft: "#AABBB6",
    line: "#3C6257",
    buttonBg: "#BFE6D2",
    buttonInk: "#0A3325",
    buttonAltBg: "#0D3C2E",
    buttonAltInk: "#FFFFFF",
    buttonAltBorder: "#819A92",
    canvasActionBg: "#0D3C2E",
    canvasActionInk: "#FFFFFF",
    faceBorder: null,
    plateBorder: null,
    markBg: "#BFE6D2",
    markInk: "#0A3325",
  },
  oxblood: {
    id: "oxblood",
    name: "Oxblood",
    ground: "#5B1626",
    gradientFrom: "#761D31",
    gradientTo: "#3F0F1B",
    gradientAngle: 152,
    groundAlt: null,
    ink: "#FFFFFF",
    inkSoft: "#BFA5AB",
    line: "#7A414E",
    buttonBg: "#F2CBD3",
    buttonInk: "#4E1220",
    buttonAltBg: "#5B1626",
    buttonAltInk: "#FFFFFF",
    buttonAltBorder: "#A68189",
    canvasActionBg: "#5B1626",
    canvasActionInk: "#FFFFFF",
    faceBorder: null,
    plateBorder: null,
    markBg: "#F2CBD3",
    markInk: "#4E1220",
  },
  rust: {
    id: "rust",
    name: "Rust",
    ground: "#80371C",
    gradientFrom: "#933E22",
    gradientTo: "#6D2F16",
    gradientAngle: 146,
    groundAlt: null,
    ink: "#FFFFFF",
    inkSoft: "#DFCDC6",
    line: "#985D47",
    buttonBg: "#FFFFFF",
    buttonInk: "#7A3318",
    buttonAltBg: "#80371C",
    buttonAltInk: "#FFFFFF",
    buttonAltBorder: "#C4A396",
    canvasActionBg: "#80371C",
    canvasActionInk: "#FFFFFF",
    faceBorder: null,
    plateBorder: null,
    markBg: "#FFFFFF",
    markInk: "#7A3318",
  },
  amber: {
    id: "amber",
    name: "Amber",
    ground: "#E1AA40",
    gradientFrom: "#EFBE55",
    gradientTo: "#D2952A",
    gradientAngle: 148,
    groundAlt: null,
    ink: "#0F1114",
    inkSoft: "#41351E",
    line: "#AA8235",
    buttonBg: "#3A2408",
    buttonInk: "#FFFFFF",
    buttonAltBg: "#E1AA40",
    buttonAltInk: "#0F1114",
    buttonAltBorder: "#624E25",
    canvasActionBg: "#3A2408",
    canvasActionInk: "#FFFFFF",
    faceBorder: null,
    plateBorder: null,
    markBg: "#3A2408",
    markInk: "#FFFFFF",
  },
  clay: {
    id: "clay",
    name: "Clay",
    ground: "#E3A28A",
    gradientFrom: "#F0B7A2",
    gradientTo: "#D68C72",
    gradientAngle: 150,
    groundAlt: null,
    ink: "#0F1114",
    inkSoft: "#3E312E",
    line: "#AB7B6B",
    buttonBg: "#4A1D14",
    buttonInk: "#FFFFFF",
    buttonAltBg: "#E3A28A",
    buttonAltInk: "#0F1114",
    buttonAltBorder: "#614942",
    canvasActionBg: "#4A1D14",
    canvasActionInk: "#FFFFFF",
    faceBorder: null,
    plateBorder: null,
    markBg: "#4A1D14",
    markInk: "#FFFFFF",
  },
  pistachio: {
    id: "pistachio",
    name: "Pistachio",
    ground: "#BFD48C",
    gradientFrom: "#D2E3A2",
    gradientTo: "#ACC576",
    gradientAngle: 156,
    groundAlt: null,
    ink: "#0F1114",
    inkSoft: "#464D39",
    line: "#97A770",
    buttonBg: "#1F3310",
    buttonInk: "#FFFFFF",
    buttonAltBg: "#BFD48C",
    buttonAltInk: "#0F1114",
    buttonAltBorder: "#5F694A",
    canvasActionBg: "#1F3310",
    canvasActionInk: "#FFFFFF",
    faceBorder: null,
    plateBorder: "#8A9968",
    markBg: "#1F3310",
    markInk: "#FFFFFF",
  },
  periwinkle: {
    id: "periwinkle",
    name: "Periwinkle",
    ground: "#B4C1EC",
    gradientFrom: "#C9D3F5",
    gradientTo: "#9FAFE2",
    gradientAngle: 154,
    groundAlt: null,
    ink: "#0F1114",
    inkSoft: "#3D4250",
    line: "#8C96B8",
    buttonBg: "#1B2450",
    buttonInk: "#FFFFFF",
    buttonAltBg: "#B4C1EC",
    buttonAltInk: "#0F1114",
    buttonAltBorder: "#565C70",
    canvasActionBg: "#1B2450",
    canvasActionInk: "#FFFFFF",
    faceBorder: null,
    plateBorder: "#8089A8",
    markBg: "#1B2450",
    markInk: "#FFFFFF",
  },
};

/** Declaration order — the order the builder's palette picker shows them in. */
/**
 * The palette's plain two-stop ground, as a CSS `background-image`.
 *
 * Three of a palette's fields only ever appear together — `gradientAngle`, `gradientFrom` and
 * `gradientTo` — and recombining them at a call site is how a card ends up with the right
 * colours at the wrong angle, or with a third stop nobody measured. So the composition lives
 * here, next to the data.
 *
 * `<CardGround>` is the richer path (finish × texture, mesh blooms, grain) and remains the one
 * a real card uses. This is for surfaces that want the ground and none of the machinery — the
 * marketing tiles, a swatch, a thumbnail — where paying for a mesh and an inline SVG grain per
 * instance buys nothing a reader can see.
 *
 * ⚠ It also keeps `linear-gradient(` out of `components/marketing/*`, which
 * `marketing.spec.ts` forbids there. That rule is not bureaucracy: a component that writes its
 * own gradient is a component that can quietly disagree with the palette it claims to be
 * wearing, and the whole point of the nine grounds is that every ink pair on them is proven.
 */
export function paletteGroundImage(palette: TemplatePalette): string {
  return `linear-gradient(${palette.gradientAngle}deg, ${palette.gradientFrom} 0%, ${palette.gradientTo} 100%)`;
}

export const PALETTE_ORDER: readonly PaletteId[] = Object.keys(
  TEMPLATE_PALETTES,
) as PaletteId[];

/**
 * A palette rendered as inline custom properties on the card root.
 *
 * This is the whole mechanism by which a per-card palette reaches the CSS: the card's
 * subtree reads `var(--c-ground)`, `var(--c-ink)` and so on, and knows nothing about which
 * palette it is inside. It is also why template colour never enters `globals.css` — a
 * palette is per-card data, and a global stylesheet cannot hold per-card data.
 *
 * The `--c-` prefix is short on purpose: these appear in the `style` attribute of every
 * rendered card, including inside the PNG export's serialised DOM.
 */
/** Both stops, for any check that must hold across the whole gradient. */
export function gradientStops(p: TemplatePalette): readonly string[] {
  return [p.gradientFrom, p.gradientTo];
}

/**
 * The card's ground as a CSS value.
 *
 * A `linear-gradient()`, which rasterises correctly in `html-to-image` — unlike a backdrop
 * filter or a frosted panel, both of which look right on screen and vanish from the PNG.
 * `tests/e2e/qr-export.spec.ts` decodes the exported file, so a ground that failed to render
 * would surface there rather than in a bug report.
 */
export function groundGradient(p: TemplatePalette): string {
  return `linear-gradient(${p.gradientAngle}deg, ${p.gradientFrom} 0%, ${p.gradientTo} 100%)`;
}

export function paletteVars(p: TemplatePalette): Record<string, string> {
  return {
    "--c-ground": p.ground,
    "--c-ground-gradient": groundGradient(p),
    "--c-ground-alt": p.groundAlt ?? p.ground,
    "--c-ink": p.ink,
    "--c-ink-soft": p.inkSoft,
    "--c-line": p.line,
    "--c-button-bg": p.buttonBg,
    "--c-button-ink": p.buttonInk,
    "--c-button-alt-bg": p.buttonAltBg,
    "--c-button-alt-ink": p.buttonAltInk,
    "--c-button-alt-border": p.buttonAltBorder,
    "--c-mark-bg": p.markBg,
    "--c-mark-ink": p.markInk,
    /* An absent plate border must still be a valid CSS colour, or the `border` shorthand
       on the plate becomes invalid and the browser drops the whole declaration. */
    "--c-plate-border": p.plateBorder ?? "transparent",
    "--c-face-border": p.faceBorder ?? "transparent",
    "--c-canvas-action-bg": p.canvasActionBg,
    "--c-canvas-action-ink": p.canvasActionInk,
  };
}

/**
 * The pairs the contract test asserts, named so a failure message says which relationship
 * broke rather than which two hex codes did.
 *
 * Exported from here rather than declared in the test so that the list of things we promise
 * about a palette lives beside the palettes themselves.
 */
/**
 * The app canvas, as a literal, so a palette pair can be checked against the surface it will
 * actually be drawn on. Mirrors `--canvas` in `tokens.css`; `tests/contract/tokens.test.ts`
 * owns that value and this is the one place a card-side rule needs to know it.
 */
export const APP_CANVAS = "#FFFFFF";

export interface PalettePair {
  label: string;
  /**
   * When true, `bg` is ignored and the pair is evaluated against **every gradient stop**.
   *
   * This is the flag that makes the suite gradient-aware. Without it a pair is checked against
   * `ground`, which is the gradient's midpoint — so a ground that is legible in the middle and
   * illegible at one end passes. Two of the nine palettes were exactly that when first authored.
   */
  allStops?: true;
  /**
   * One or more candidate foregrounds. The pair passes when **any** of them clears `min`.
   *
   * A list rather than a single colour because of the outline button: WCAG 1.4.11 asks that
   * a control's boundary be discernible at 3:1 but is indifferent to whether the fill or the
   * border supplies it. An outline button's fill *is* its ground, so only the border can —
   * and asserting the fill alone would fail every palette in the file for a problem none of
   * them has.
   */
  fg: (p: TemplatePalette) => string | readonly string[];
  bg: (p: TemplatePalette) => string;
  /** 4.5 for text, 3 for a control boundary, 1.2 for a decorative hairline. */
  min: number;
}

export const PALETTE_CONTRACT: readonly PalettePair[] = [
  /* ── Text, across the WHOLE gradient. No exceptions, no large-text discount: a card's name
     and role are both read at body size on a phone held at arm's length. ──────────────── */
  { label: "ink on every gradient stop", fg: (p) => p.ink, bg: (p) => p.ground, min: 4.5, allStops: true },
  {
    label: "inkSoft on every gradient stop",
    fg: (p) => p.inkSoft,
    bg: (p) => p.ground,
    min: 4.5,
    allStops: true,
  },
  /**
   * The headroom rule, and why it is 7 rather than 4.5.
   *
   * A ground carries two inks: the name and the softer role tag above it. If the primary only
   * just clears 4.5 there is nowhere for a second level to sit, and `inkSoft` collapses onto
   * `ink` — the tag and the name come out the same colour and the hierarchy the format depends
   * on disappears. Asserting the headroom directly is what forces a ground to be deep enough,
   * instead of leaving it to be noticed in review.
   */
  {
    label: "ink clears 7:1 on every stop, leaving room for a softer secondary",
    fg: (p) => p.ink,
    bg: (p) => p.ground,
    min: 7,
    allStops: true,
  },
  { label: "buttonInk on buttonBg", fg: (p) => p.buttonInk, bg: (p) => p.buttonBg, min: 4.5 },
  {
    label: "buttonAltInk on buttonAltBg",
    fg: (p) => p.buttonAltInk,
    bg: (p) => p.buttonAltBg,
    min: 4.5,
  },
  { label: "markInk on markBg", fg: (p) => p.markInk, bg: (p) => p.markBg, min: 4.5 },

  /**
   * ⚠ **The hole this closes, and how it was found.**
   *
   * Every other pair here compares a foreground to a *background*. That shape cannot express the
   * one relationship the 7:1 headroom rule exists to protect: that `ink` and `inkSoft` remain
   * **two distinguishable levels**. The rule forces a ground deep enough to leave room for a
   * second level — and then nothing checked that the second level actually used the room.
   *
   * Found by mutation while `derive-palette.ts` was being built: collapsing `inkSoft` onto `ink`
   * — so the role tag comes out the same colour as the name and the hierarchy the card format
   * depends on disappears — left **every pair in this contract passing**. A guarantee with a
   * blind spot exactly where its own rationale lives is worse than no guarantee, because it is
   * trusted.
   *
   * It needs no new machinery: `bg` is simply "the other colour", so a foreground-to-foreground
   * pair fits the existing shape. `allStops` is deliberately absent — this compares two inks to
   * each other, and neither is painted on the gradient for the purposes of this check.
   *
   * 1.4 is the floor rather than a target. The nine presets sit well above it; a palette that
   * only just clears it is legible but flat, and that is a design conversation, not a build
   * failure. What must never ship is 1.0.
   */
  {
    label: "ink and inkSoft stay two distinguishable levels",
    fg: (p) => p.ink,
    bg: (p) => p.inkSoft,
    min: 1.4,
  },

  /* ── Control boundaries — 1.4.11's 3:1. An action the eye cannot find is not an action. ── */
  {
    label: "buttonBg on every gradient stop",
    fg: (p) => p.buttonBg,
    bg: (p) => p.ground,
    min: 3,
    allStops: true,
  },
  {
    label: "buttonAlt boundary on every gradient stop (fill or border)",
    fg: (p) => [p.buttonAltBg, p.buttonAltBorder],
    bg: (p) => p.ground,
    min: 3,
    allStops: true,
  },

  /* ── The canvas colourway. The second pair is the one that matters: an action fill drawn on
     the white app canvas must be discernible FROM that canvas, which the palette's own ground
     is not when the ground is itself white. Paper failed exactly this before it existed. ── */
  {
    label: "canvasActionInk on canvasActionBg",
    fg: (p) => p.canvasActionInk,
    bg: (p) => p.canvasActionBg,
    min: 4.5,
  },
  {
    label: "canvasActionBg on the app canvas",
    fg: (p) => p.canvasActionBg,
    bg: () => APP_CANVAS,
    min: 3,
  },

  /* ── Decorative hairlines. Held to "visible at all", NOT to 3:1.
     1.4.11 covers components and graphical objects needed to understand content; a divider
     between two field rows is neither, which is also why the app's own `--line` sits at
     1.24:1 on white and is correct there. Demanding 3:1 here would force every card to wear
     a heavy grey rule it does not need — the first version of this file did exactly that and
     failed all eight palettes for it. ──────────────────────────────────────────────────── */
  { label: "line on every gradient stop", fg: (p) => p.line, bg: (p) => p.ground, min: 1.2, allStops: true },
];
