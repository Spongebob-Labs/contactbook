/**
 * The card's **material system** — the axes an owner may set on a card page, and the contract
 * every consumer codes against.
 *
 * ## Why this file is types-and-constants only
 *
 * Three things need to agree about these axes: the renderer that paints them, the builder panel
 * that sets them, and the palette engine that keeps them legible. They are built separately, so
 * the vocabulary lives here, in one module none of them owns, and each imports it. A `Record`
 * keyed by each union means adding a style or a pattern without teaching every consumer about it
 * is a compile error rather than a silent gap in a picker.
 *
 * ## The axes
 *
 * 1. **`groundHex`** — the owner's chosen colour, free. `derive-palette.ts` turns it into a full
 *    `TemplatePalette` and **clamps it** when it cannot carry legible text (see `LEGIBILITY_DEAD_BAND`).
 * 2. **`finish`** — how that colour is laid down: flat, gradient or mesh.
 * 3. **`texture`** — what is cut into it: none, grain, or one of four motifs.
 * 4. **`texturePresence`** and **`textureScale`** — how strong that texture is, and how big.
 *
 * The `headerLayout` axis that used to be here is gone — see the note where it stood.
 *
 * ## What is deliberately NOT here
 *
 * The wallet face. It is one fixed 336×500 format whose only variation is colour, and the QR on
 * it is measured by five contract suites. Finishes and textures apply to the
 * **card page only** — the surface a recipient actually opens.
 */

/* ── Axis 2: the FINISH — how the colour itself is painted ──────────────────────────── */

/**
 * How the ground colour is laid down. **Independent of {@link Texture}**, and that split is the
 * whole point of this pair of axes.
 *
 * ## ⚠ Why this used to be one axis of five, and why that was wrong
 *
 * The original axis was `flat | gradient | mesh | grain | pattern` — one `SurfaceStyle`, pick
 * exactly one. Two failures followed from it, and both were reported as "every wallpaper looks
 * the same":
 *
 *   1. **`grain` and `pattern` are not alternatives to `flat`, they are things done *to* it.**
 *      Choosing `pattern` silently also chose "flat", so on a deep ground Flat, Grain and Pattern
 *      rendered as three near-identical rectangles. Five options that behaved like two.
 *   2. **A gradient could never carry a motif.** The old renderer refused the combination on a
 *      real contrast argument (see `card-ground.tsx`) that no longer holds now that a texture
 *      moves *away* from the ink — and that combination is the single largest source of variety
 *      the format has.
 *
 * Three finishes × five textures is the same amount of picker and fifteen distinct grounds.
 */
export type Finish = "flat" | "gradient" | "mesh";

/**
 * The pre-split axis, kept **only** so cards written against it still resolve.
 *
 * `resolveCardSurface` maps it forward through {@link LEGACY_SURFACE_STYLE}; nothing renders
 * from it. Same treatment `headerLayout` gives `pageHeader` — an axis that is replaced maps, it
 * does not get discarded, or every card written before the change silently changes appearance.
 */
export type SurfaceStyle = "flat" | "gradient" | "mesh" | "grain" | "pattern";

export interface FinishSpec {
  id: Finish;
  /** Shown in the builder's Design panel. */
  name: string;
  /** One line: what it is, in the owner's language, not ours. */
  blurb: string;
}

/**
 * Declaration order is the order the picker shows them in: restrained first, most decorated
 * last. Someone scanning the list top-down meets the safe choices before the expressive ones.
 */
export const FINISHES: Record<Finish, FinishSpec> = {
  flat: { id: "flat", name: "Flat", blurb: "One solid colour. Lets the type do the work." },
  gradient: { id: "gradient", name: "Gradient", blurb: "A soft raking light across the card." },
  mesh: { id: "mesh", name: "Mesh", blurb: "Colour blooms that give the ground depth." },
};

export const FINISH_ORDER: readonly Finish[] = ["flat", "gradient", "mesh"];

/* ── Axis 3: the TEXTURE — what is cut into the finish ──────────────────────────────── */

/**
 * The mark tiled over the finish. `none` is a first-class member rather than an absent value:
 * "no texture" is a choice an owner makes in the same picker as the others, and modelling it as
 * `undefined` puts the same state in two places.
 *
 * `grain` sits with the motifs because from the owner's side it is one — a texture you pick —
 * even though the renderer generates it from noise rather than from a tile of authored SVG.
 */
export type Texture = "none" | "grain" | "grid" | "dots" | "topo";

/** The motif subset — every texture that is a tiled SVG. `grain` and `none` are not motifs. */
export type PatternId = "grid" | "dots" | "topo";

export interface TextureSpec {
  id: Texture;
  name: string;
  /**
   * Tile edge in px at `regular` scale, or `null` for `none`.
   *
   * The motif SVGs are authored at exactly this size — `topo`'s C1 continuity across the seam
   * is a property of the authored geometry. {@link TEXTURE_SCALE} therefore scales the *painted* tile via
   * `background-size` and never regenerates the SVG at another size, so the geometry that was
   * solved once stays solved.
   */
  tile: number | null;
}

/**
 * ⚠ **Five motifs became three, and the two that went were the two that could not be handed to
 * a client.**
 *
 * `hatch` read as shading — a diagonal rule at any strength looks like a redaction or a
 * hand-drawn fill, not a material. `arcs` read as decoration: four concentric quarter-circles
 * is a graphic device with a decade attached to it, and this card is meant to survive a decade.
 * The three that remain are the three a printer would recognise — a rule grid, a dot screen and
 * a contour line — plus `grain`, which is paper.
 *
 * Fewer is the point. A picker of eight motifs asks the owner to have an opinion about eight
 * things; a picker of four asks them to have one.
 */
export const TEXTURES: Record<Texture, TextureSpec> = {
  none: { id: "none", name: "None", tile: null },
  grain: { id: "grain", name: "Grain", tile: 160 },
  grid: { id: "grid", name: "Grid", tile: 32 },
  dots: { id: "dots", name: "Dots", tile: 24 },
  topo: { id: "topo", name: "Contour", tile: 64 },
};

export const TEXTURE_ORDER: readonly Texture[] = ["none", "grain", "grid", "dots", "topo"];

export const PATTERN_ORDER: readonly PatternId[] = ["grid", "dots", "topo"];

/* ── Axes 4 and 5: how much texture, and how big ────────────────────────────────────── */

/**
 * ⚠ **These two axes exist because the contrast budget stopped being the binding constraint.**
 *
 * The old system had a single `PATTERN_ALPHA = 0.07` **ceiling**, and it was the right number
 * for what it governed: a motif drawn in `palette.ink` sits in the same hue family as the text
 * above it, so at any real strength it competes with the name. `motifAlpha()` then solved *down*
 * from that ceiling — to 0.060 on Onyx — and 6% white on a near-black ground is not a wallpaper.
 * Five motifs all rendered as the same faint nothing, which is exactly how it was reported.
 *
 * `card-ground.tsx` now draws the mark on the side of the ground **away** from the ink, where
 * darkening a deep ground *raises* white's contrast rather than spending it. Strength is
 * therefore no longer rationed, so it becomes what it should always have been: **a control the
 * owner holds**, not a constant the renderer defends.
 *
 * The counter-stroke that makes a mark read as debossed rather than merely darker *is* still on
 * the ink side and *is* still solved — see `textureEdgeAlpha`. One costed layer, one free one.
 */
export type TexturePresence = "subtle" | "medium" | "strong";

/** How far the mark moves the ground away from the ink, as a `color-mix` ratio. */
export const TEXTURE_PRESENCE: Record<TexturePresence, number> = {
  subtle: 0.26,
  medium: 0.44,
  strong: 0.66,
};

export const TEXTURE_PRESENCE_ORDER: readonly TexturePresence[] = ["subtle", "medium", "strong"];

export type TextureScale = "fine" | "regular" | "large";

/** Multiplier on {@link TextureSpec.tile}. Painted size only — the SVG is never re-authored. */
export const TEXTURE_SCALE: Record<TextureScale, number> = {
  fine: 0.7,
  regular: 1,
  large: 1.6,
};

export const TEXTURE_SCALE_ORDER: readonly TextureScale[] = ["fine", "regular", "large"];

/**
 * ⚠ The ceiling on the **ink-side counter-stroke** only — the one layer that still costs contrast.
 *
 * This is what `PATTERN_ALPHA` became. The number is close to the old one and it governs
 * something much smaller: a 1px-offset highlight whose entire job is to give the shadow stroke
 * an edge, so the mark reads as cut into the surface instead of painted on it. `textureEdgeAlpha`
 * solves down from here against every base the finish can produce, and may return 0 — on a
 * ground with no headroom the texture is simply a clean deboss with no highlight, which still
 * reads, because the shadow stroke was never the part that was rationed.
 */
export const TEXTURE_EDGE_ALPHA = 0.1;

/**
 * How a pre-split `surfaceStyle` resolves onto the two axes that replaced it.
 *
 * `grain` and `pattern` both meant "flat, plus a mark" — that conflation is the defect the
 * split fixes — so both map to a `flat` finish carrying a texture. The card's own `patternId`
 * supplies which motif; `resolveCardSurface` is the only place that reads it.
 */
export const LEGACY_TEXTURE: Record<string, Texture> = {
  /* The two motifs that were cut. A card wearing one keeps a mark rather than losing its
     texture silently: `hatch` was a directional line screen, so it lands on `grid`; `arcs` was
     a curved one, so it lands on `topo`. */
  hatch: "grid",
  arcs: "topo",
};

export const LEGACY_SURFACE_STYLE: Record<SurfaceStyle, { finish: Finish; textured: boolean }> = {
  flat: { finish: "flat", textured: false },
  gradient: { finish: "gradient", textured: false },
  mesh: { finish: "mesh", textured: false },
  grain: { finish: "flat", textured: true },
  pattern: { finish: "flat", textured: true },
};

/* ── The axis that is gone ──────────────────────────────────────────────────────────── */

/**
 * ⚠ **`HeaderLayout` was here — `classic | banner | hero | minimal` — and it has been removed.**
 *
 * It was cut on the owner's own judgement, and the judgement is sound: four near-identical
 * diagram chips is a weak control, and three of its four values existed mainly to move the
 * palette *off* parts of the page, which fights the rule that the ground paints edge to edge
 * whatever the field count. `classic` — palette full height, identity and stack both on it —
 * is now the one composition, and `card-page.tsx` holds its measurements as a plain constant.
 *
 * Nothing maps forward, and nothing needs to: every one of the four rendered the same fields
 * in the same order (the axis was documented as "composition only"), so a card that chose
 * `hero` loses an arrangement, never a detail it shared. `LEGACY_HEADER_LAYOUT` went with it —
 * a template's `pageHeader` is still published on the card root as `data-page-header`, but as
 * the template's own metadata rather than as a layout the renderer branches on.
 */

/* ── The whole surface, as one value ────────────────────────────────────────────────── */

/**
 * What a card stores about its own look, beyond the fields it maps.
 *
 * Every member is optional so an existing card — and every fixture written before this system
 * existed — keeps rendering. `resolveCardSurface` below is the single place those defaults are
 * applied, so no renderer has to remember them and no two renderers can disagree.
 *
 * ⚠ Cross-boundary flag for the later integration run: the API will need columns for these.
 */
export interface CardSurface {
  /** `#RRGGBB`. Absent means "use the palette the card already resolves to". */
  groundHex?: string;

  finish?: Finish;
  texture?: Texture;
  texturePresence?: TexturePresence;
  textureScale?: TextureScale;

  /**
   * ⚠ Pre-split, and read **only** by {@link resolveCardSurface}'s migration path.
   *
   * Nothing renders from these. They stay on the interface because cards and fixtures written
   * before the finish/texture split still carry them, and a card that loses its look on a
   * refactor is the defect this whole module is organised against.
   */
  surfaceStyle?: SurfaceStyle;
  patternId?: PatternId;
}

/** Every axis made concrete. What renderers actually read. */
export interface ResolvedSurface {
  finish: Finish;
  texture: Texture;
  texturePresence: TexturePresence;
  textureScale: TextureScale;
}

export const SURFACE_DEFAULTS: ResolvedSurface = {
  /* `gradient` rather than `flat`: it is what every existing card already renders, so a card
     written before this system gains an axis without changing appearance. */
  finish: "gradient",
  texture: "none",
  texturePresence: "medium",
  textureScale: "regular",
};

/**
 * Every look axis, made concrete, with the pre-split fields migrated forward.
 *
 * ⚠ **Order of precedence is explicit-new → migrated-legacy → default, and it has to be.** A
 * card that has been edited since the split carries `finish`/`texture` and must render those. A
 * card that has not carries `surfaceStyle`/`patternId` and must render what it always did. A
 * card that carries neither gets the defaults. Collapsing any two of those three cases is how a
 * migration silently repaints somebody's card.
 */
export function resolveCardSurface(surface: CardSurface | undefined): ResolvedSurface {
  const legacy = surface?.surfaceStyle ? LEGACY_SURFACE_STYLE[surface.surfaceStyle] : undefined;

  return {
    finish: surface?.finish ?? legacy?.finish ?? SURFACE_DEFAULTS.finish,
    texture:
      surface?.texture ??
      /* `grain` is its own texture; `pattern` defers to the card's motif, defaulting to the one
         the pre-split `SURFACE_DEFAULTS.patternId` used so a card mid-migration is unchanged. */
      (legacy?.textured
        ? surface?.surfaceStyle === "grain"
          ? "grain"
          : (LEGACY_TEXTURE[surface?.patternId ?? ""] ?? surface?.patternId ?? "grid")
        : undefined) ??
      SURFACE_DEFAULTS.texture,
    texturePresence: surface?.texturePresence ?? SURFACE_DEFAULTS.texturePresence,
    textureScale: surface?.textureScale ?? SURFACE_DEFAULTS.textureScale,
  };
}

/** `true` when this texture is a tiled SVG motif rather than `none` or generated noise. */
export function isPatternId(texture: Texture): texture is PatternId {
  return texture !== "none" && texture !== "grain";
}

/* ── The legibility floor, as arithmetic ────────────────────────────────────────────── */

/**
 * ⚠ **The band of ground colours that cannot carry legible text, and why free colour needs a clamp.**
 *
 * A card's ground has to hold two levels of ink: the name, and a softer secondary for the role
 * tag and labels. `PALETTE_CONTRACT` therefore asks primary ink for **7:1**, not 4.5 — at 4.5
 * there is nowhere for a second level to sit and the two collapse into one colour, which is how
 * the hierarchy the format depends on disappears.
 *
 * Only two inks are available: white and near-black. Solving 7:1 for each gives a hard band of
 * relative luminance where **neither** works:
 *
 * · white ink needs `L ≤ 0.100`
 * · near-black ink needs `L ≥ 0.339`
 *
 * Nothing between the two can be a card ground. That is not a policy — it is what the numbers do,
 * and it is why the nine presets are five deep colours and four light ones with nothing in the
 * middle. A free colour picker that ignored it would let an owner build a mid-tone card whose own
 * name is unreadable.
 *
 * `derivePalette` clamps a chosen colour to the nearer edge and reports that it did, which is
 * Principle 3 — *freedom with a floor* — expressed as arithmetic rather than as a warning.
 */
export const LEGIBILITY_DEAD_BAND = { min: 0.1, max: 0.339 } as const;
