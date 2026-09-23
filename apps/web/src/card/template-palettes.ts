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
  | "periwinkle"
  /* The brand hue. Lighter than the other four lights and the only palette taken from the
     client's own deck rather than picked here — see its entry. */
  | "mint"
  /* Warm neutral — the reference theme. See its entry for why it carries the three optional
     sheet fields that every other palette leaves null. */
  | "ivory";

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

  /* ── The card page's SHEET, and the three slots only it uses ──────────────────────────── */

  /**
   * The paper the card page is read on. `null` derives it — white carrying 3% of `ground`.
   *
   * ## Why an override exists at all
   *
   * The derived sheet is right for eight of the ten: it keeps a Sapphire card's paper faintly
   * cool and a Rust card's faintly warm without either becoming a tint block, and it does it
   * from one rule. It cannot express a paper that is a *deliberate colour* rather than a
   * whisper of the cover — and the reference theme's cream is exactly that: the warmth is the
   * point, not a side effect of the ground above it.
   *
   * ⚠ **An override must stay near-white.** Every ink on the sheet is an APP token (`--ink`,
   * `--ink-2`) proven against `--canvas`, and `PALETTE_CONTRACT` re-proves both against this
   * value when it is set. A sheet dark enough to need light ink is not a sheet, it is a second
   * ground, and the two-tone composition has no room for one.
   */
  sheet: string | null;

  /**
   * The decorative accent — icon discs, hairlines, the curve's edge, the social glyphs.
   *
   * `null` falls back to `canvasActionBg`, which is what the eight neutral palettes want: their
   * accent IS their action colour and a second hue would be a third voice on a two-tone card.
   *
   * Held to **3:1 on the sheet** and not 4.5, because everything it paints is a graphical
   * object under 1.4.11 rather than text. {@link accentText} is the slot for the text case, and
   * the split is the whole reason there are two: the reference's gold is legible as a mark and
   * illegible as a word, and one slot could only have got one of those right.
   */
  accent: string | null;

  /**
   * The accent used for TEXT — the company wordmark, and the badge's monogram.
   *
   * `null` falls back to `canvasActionBg`. Held to **4.5:1 on the sheet** (1.4.3).
   *
   * ⚠ This is normally a DEEPER tone than {@link accent}, and Ivory is why the pair exists: the
   * reference sets its wordmark in a light gold that measures about 2.1:1 on cream. That is not
   * a near miss to be waved through, it is unreadable — so the mark keeps a gold that clears
   * 3:1 and the word takes a bronze that clears 4.5:1. They read as the same metal.
   */
  accentText: string | null;
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
    sheet: null,
    accent: null,
    accentText: null,
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
    sheet: null,
    accent: null,
    accentText: null,
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
    sheet: null,
    accent: null,
    accentText: null,
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
    sheet: null,
    accent: null,
    accentText: null,
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
    sheet: null,
    accent: null,
    accentText: null,
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
    sheet: null,
    accent: null,
    accentText: null,
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
    sheet: null,
    accent: null,
    accentText: null,
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
    sheet: null,
    accent: null,
    accentText: null,
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
    sheet: null,
    accent: null,
    accentText: null,
  },

  /**
   * MINT — the brand hue, and the first palette lifted from the client's deck rather than
   * composed here.
   *
   * ## Where the colours come from
   *
   * `ContactBook About Us v13.pdf` paints 24 slides out of a single hue. Every green in it
   * measures **H=168°**, varied only by saturation and lightness: `#C5F7ED` (the pale tint),
   * `#51E8CA` (the bright mint), `#69C0B0` (the logo), `#15A185` (the deep accent) and
   * `#0C7560` (the darkest, used for strokes). This palette is that ladder re-spaced to fit
   * the constraints below: the stops hold S=0.76, the saturation the deck's own two tints
   * share, and `buttonBg` is `#0C7560` verbatim.
   *
   * ## ⚠ Why the stops are NOT the deck's values verbatim
   *
   * The deck's pale mint sits at L=0.845 on a white ground, so its own gradient would span
   * L 0.845→1.0 — a delta of 0.155, under the 0.19–0.23 every other light palette here runs
   * at, and a card that flat reads as an unpainted surface rather than as a colour. The mint
   * end is therefore deepened to L=0.735, restoring a 0.219 delta (mid-pack for the set) while
   * staying on the deck's hue and saturation. The deck's own `#C5F7ED` lands within a
   * hundredth of this gradient's midpoint, so the tint the client already knows is still the
   * colour the card averages to.
   *
   *     ink        #0F1114 on the darkest stop   14.13:1   (needs 7)
   *     inkSoft    #3C6B62 on the darkest stop    4.52:1   (needs 4.5)
   *     ink/inkSoft separation                    3.13:1   (needs 1.4)
   *     line       #96D4C8 on the darkest stop    1.25:1   (needs 1.2)
   *     buttonBg   #0C7560 on the darkest stop    4.21:1   (needs 3)
   *     buttonAltBorder #49887C, darkest stop     3.08:1   (needs 3)
   *     canvasActionBg #0C7560 on the canvas      5.63:1   (needs 4.5)
   *     accent/accentText on the derived sheet    5.61:1   (needs 3 / 4.5)
   *
   * ## The slot this is the first preset to need
   *
   * `ground` is L=0.830, which leaves white at **1.19:1** against it and the QR plate at
   * **1.05:1** — both under the 1.5 at which a white shape stops being self-evident. Mint is
   * therefore the first palette to set `faceBorder` as well as `plateBorder`, and the field
   * comment on `faceBorder` predicted this exact case: "the need is real for any future
   * near-white ground". Without the face edge a Mint card on the white app canvas is an
   * absence, which is the bug that retired the old white Paper palette.
   *
   * ## ⚠ Why no second accent, when the deck has one
   *
   * The deck runs two greens: `#15A185` on marks and a deeper one on words — a split that
   * `accent`/`accentText` exist to express, and that Ivory uses for its two golds. Mint leaves
   * both `null`, so the accent is `canvasActionBg` and the card speaks with one green. The
   * card format is committed to two tones, and a mark-green distinct from the word-green would
   * be a third voice on a face with room for two. If the deck's split is ever wanted here,
   * these are the two slots it goes in: `#15A185` clears the 3:1 mark bar on this sheet at
   * 3.23, which is why it is recorded here rather than left to be re-measured.
   */
  mint: {
    id: "mint",
    name: "Mint",
    ground: "#BFF6EC",
    gradientFrom: "#EEFDFA",
    gradientTo: "#90F0DD",
    gradientAngle: 154,
    groundAlt: null,
    ink: "#0F1114",
    inkSoft: "#3C6B62",
    line: "#96D4C8",
    /* The deck's darkest green, unmodified. At 5.63:1 on white it clears the TEXT bar the
       wordmark needs, not just the 3:1 a fill alone would have got away with. */
    buttonBg: "#0C7560",
    buttonInk: "#FFFFFF",
    buttonAltBg: "#BFF6EC",
    buttonAltInk: "#0F1114",
    buttonAltBorder: "#49887C",
    canvasActionBg: "#0C7560",
    canvasActionInk: "#FFFFFF",
    /* The ground is 1.19:1 on the app canvas — the face has no edge of its own without this. */
    faceBorder: "#56A092",
    /* And 1.05:1 against a white plate: the most dissolved ground in the set. */
    plateBorder: "#56A092",
    markBg: "#0C7560",
    markInk: "#FFFFFF",
    /* Derived. The deck reads on white, and 3% of a mint ground over white is #FDFFFE — which
       is the honest answer here, not a tint invented to look deliberate. */
    sheet: null,
    accent: null,
    accentText: null,
  },

  /**
   * IVORY — the reference theme, and the only palette that uses the three sheet slots.
   *
   * ## What it is for
   *
   * The client's reference card is a warm sand cover, a cream sheet, gold marks and a near-black
   * pill. Eight of the nine presets can get close by accident — a derived sheet at 3% of a warm
   * ground is faintly cream — and none of them can get there on purpose, because the gold is a
   * *third* colour: it is neither the ground nor the action fill.
   *
   * So Ivory is the palette that says out loud what the other nine leave derived. Every number
   * below was solved with `src/lib/contrast.ts` against both gradient stops and against its own
   * cream sheet, not chosen by eye:
   *
   *     ink        #0F1114 on the darkest stop   11.37:1   (needs 7)
   *     inkSoft    #4F4229 on the darkest stop    5.89:1   (needs 4.5)
   *     ink/inkSoft separation                    1.93:1   (needs 1.4)
   *     line       #B39C72 on the darkest stop    1.60:1   (needs 1.2)
   *     buttonAltBorder #6E5C3C, darkest stop     3.87:1   (needs 3)
   *     accent     #A87F33 on the cream sheet     3.39:1   (needs 3)
   *     accentText #8F6A26 on the cream sheet     4.58:1   (needs 4.5)
   *     canvasActionBg #1A1713 on the sheet      16.57:1   (needs 4.5)
   *
   * ## ⚠ The two golds, and why the reference's single gold could not be used
   *
   * The reference sets `CONTACTBOOK` in a light gold on cream. Measured, that is about 2.1:1 —
   * not a near miss, unreadable. A mark can live at 3:1 (1.4.11, graphical objects); a word
   * cannot (1.4.3 wants 4.5). One slot would have had to pick a side: keep the light gold and
   * ship an illegible wordmark, or darken it and lose the glint on every icon disc.
   *
   * Two slots keep both. `#A87F33` carries the discs, the hairlines and the curve's edge;
   * `#8F6A26` carries the wordmark and the monogram. They are the same hue two steps apart and
   * read as one metal on the page.
   */
  ivory: {
    id: "ivory",
    name: "Ivory",
    ground: "#E7D6BA",
    gradientFrom: "#F2E7D3",
    gradientTo: "#DCC6A0",
    gradientAngle: 152,
    groundAlt: null,
    ink: "#0F1114",
    inkSoft: "#4F4229",
    line: "#B39C72",
    buttonBg: "#1A1713",
    buttonInk: "#FFFFFF",
    buttonAltBg: "#E7D6BA",
    buttonAltInk: "#0F1114",
    buttonAltBorder: "#6E5C3C",
    canvasActionBg: "#1A1713",
    canvasActionInk: "#FFFFFF",
    faceBorder: null,
    /* The ground is light enough that a white QR plate would dissolve into it — the one case
       this slot exists for. */
    plateBorder: "#B9A47E",
    markBg: "#1A1713",
    markInk: "#FFFFFF",
    /* Cream, and deliberately warmer than the 3% derivation would produce. */
    sheet: "#FAF6EE",
    accent: "#A87F33",
    accentText: "#8F6A26",
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

    /* ── The card page's sheet, resolved HERE so the fallbacks exist once ─────────────────
       `sheet`, `accent` and `accentText` are nullable, and their fallbacks are rules rather
       than values — "3% of the ground over white", "the action fill". Resolving them in this
       function means every consumer reads a concrete colour and no renderer has to remember
       the rule. `card-page.tsx` used to spell the 3% mix itself, which put the rule in two
       places the moment a palette could override it. */
    "--c-sheet": sheetOf(p),
    "--c-accent": p.accent ?? p.canvasActionBg,
    "--c-accent-text": p.accentText ?? p.canvasActionBg,
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

/**
 * How much of the ground a derived sheet carries. 3% and not more: at 4% a deep ground pulls
 * the sheet to about #F6F6F6, where `--ink-3` measures 4.43:1 and misses AA. 3% keeps every app
 * ink token inside the margin it was proven at on pure white.
 */
const SHEET_TINT = 0.03;

/**
 * THE RESOLVED SHEET — the paper the card page is read on, always a real colour.
 *
 * ⚠ **A hex and never a `color-mix()`, and the contract is what forced that.** `paletteVars`
 * emitted the mix as a CSS expression, and `tests/contract/template-palettes.test.ts` asserts
 * every custom property it emits is a hex or `transparent` — for a good reason of its own: one
 * unparseable value inside a `border` shorthand invalidates the whole declaration.
 *
 * Computing it here is strictly better than relaxing that rule. The sheet becomes a colour the
 * contract can measure, so `PALETTE_CONTRACT` proves the app inks and the action fill against
 * the paper of ALL TEN palettes rather than only against the one that overrides it — which is
 * the case that could actually have shipped illegible.
 *
 * The mix is not imported from `card-ground.ts`, which has one: that module imports
 * `TemplatePalette` from this one, so the dependency would be a cycle. Six lines of sRGB
 * arithmetic is the cheaper answer than restructuring two modules around it.
 */
/**
 * ⚠ Memoised, and the reason is a test that started timing out rather than a micro-optimisation.
 *
 * Five `PALETTE_CONTRACT` pairs read the sheet, and `derive-palette.test.ts` sweeps every pair
 * against a freshly derived palette for **every byte value** through both band edges. That turned
 * one mix per palette into five, and pushed the sweep past its 5s budget — a real regression in
 * the cost of the contract, not a slow machine.
 *
 * Keyed on the palette object rather than on its hex so a derived palette, which is a new object
 * every time, still pays the arithmetic once across the five pairs that ask about it. A `WeakMap`
 * so nothing is retained: the sweep allocates hundreds of thousands of palettes and a `Map` would
 * hold every one of them for the life of the process.
 */
const SHEET_CACHE = new WeakMap<TemplatePalette, string>();

export function sheetOf(p: TemplatePalette): string {
  if (p.sheet !== null) return p.sheet;

  const cached = SHEET_CACHE.get(p);
  if (cached !== undefined) return cached;

  const ground = p.ground.replace("#", "");
  const channel = (i: number): number => {
    const g = Number.parseInt(ground.slice(i * 2, i * 2 + 2), 16);
    /* Over white, so the other side of the mix is 255 on every channel. */
    return Math.round(g * SHEET_TINT + 255 * (1 - SHEET_TINT));
  };

  const mixed =
    `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  SHEET_CACHE.set(p, mixed);
  return mixed;
}

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
  /**
   * ⚠ **The same pair again at a TEXT threshold, and the reason is the card page's rebuild.**
   *
   * `canvasActionBg` used to be one thing: the fill of a card action drawn on white. A fill is
   * a control boundary, so 3:1 is the right bar (1.4.11) and the pair above is correct for it.
   *
   * The 2026-09-17 card page promoted the same colour to `--cb-accent` and paints TEXT with it —
   * the company wordmark above the owner's name — as well as the social glyphs and the badge's
   * monogram. Text is 1.4.3, which is 4.5:1, and borrowing a boundary ratio for text is exactly
   * the kind of quiet reuse that ships something illegible.
   *
   * All nine presets clear this comfortably (the weakest is Amber's `#3A2408` at about 13:1),
   * so this asserts a property the set already has rather than forcing a change. It is here so
   * the NEXT palette cannot take the 3:1 route and land a wordmark nobody can read — and so
   * `derivePalette`, which must satisfy every pair in this contract for an arbitrary hex, is
   * held to it too.
   */
  {
    label: "canvasActionBg is legible as TEXT on the app canvas (wordmark, glyphs, monogram)",
    fg: (p) => p.canvasActionBg,
    bg: () => APP_CANVAS,
    min: 4.5,
  },

  /* ── The card page's SHEET, measured on EVERY palette.
     `sheetOf` returns the palette's own paper when it states one and the 3% derivation when it
     does not, so these five pairs are asserted against the colour each card is actually read
     on — not against `APP_CANVAS`, which only nine of the ten are. That distinction is the
     whole point: the derived sheet is where an ink could quietly fall under AA, because nobody
     picked it by hand. ─────────────────────────────────────────────────────────────────────
   */
  {
    label: "app ink stays legible on an overridden sheet",
    fg: () => "#0A0A0A",
    bg: (p) => sheetOf(p),
    min: 4.5,
  },
  {
    label: "app secondary ink stays legible on an overridden sheet",
    fg: () => "#3F3F46",
    bg: (p) => sheetOf(p),
    min: 4.5,
  },
  /**
   * The decorative accent is a GRAPHICAL OBJECT — icon discs, hairlines, the curve's edge — so
   * 1.4.11's 3:1 is the right bar and 4.5 would be borrowing a text threshold for a mark.
   */
  {
    label: "accent is discernible as a mark on the sheet",
    fg: (p) => p.accent ?? p.canvasActionBg,
    bg: (p) => sheetOf(p),
    min: 3,
  },
  /**
   * ⚠ And the text accent at 4.5 — the pair that stops the reference's own light gold shipping
   * as a wordmark. See the note on `accentText`.
   */
  {
    label: "accentText is legible as a WORD on the sheet",
    fg: (p) => p.accentText ?? p.canvasActionBg,
    bg: (p) => sheetOf(p),
    min: 4.5,
  },
  {
    label: "the primary action fill is legible on the sheet it sits on",
    fg: (p) => p.canvasActionBg,
    bg: (p) => sheetOf(p),
    min: 4.5,
  },

  /* ── Decorative hairlines. Held to "visible at all", NOT to 3:1.
     1.4.11 covers components and graphical objects needed to understand content; a divider
     between two field rows is neither, which is also why the app's own `--line` sits at
     1.24:1 on white and is correct there. Demanding 3:1 here would force every card to wear
     a heavy grey rule it does not need — the first version of this file did exactly that and
     failed all eight palettes for it. ──────────────────────────────────────────────────── */
  { label: "line on every gradient stop", fg: (p) => p.line, bg: (p) => p.ground, min: 1.2, allStops: true },
];
