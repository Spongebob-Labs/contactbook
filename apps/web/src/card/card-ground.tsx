import type { CSSProperties, ReactElement } from "react";

import {
  TEXTURES,
  TEXTURE_EDGE_ALPHA,
  TEXTURE_PRESENCE,
  TEXTURE_SCALE,
  isPatternId,
  type Finish,
  type PatternId,
  type Texture,
  type TexturePresence,
  type TextureScale,
} from "@/card/card-surface";
import { contrastRatio, relativeLuminance } from "@/lib/contrast";
import type { TemplatePalette } from "@/card/template-palettes";

/**
 * THE PAINTED GROUND — the one element the whole card page stands on.
 *
 * ## What it is
 *
 * `<CardGround>` renders `card-surface.ts`'s finish × texture as **one absolutely
 * positioned, aria-hidden layer** behind the card's content. It draws nothing else: no text,
 * no border, no box. Everything it paints is derived from the card's own `TemplatePalette`,
 * so a ground is incapable of introducing a colour the palette contract has not seen.
 *
 * ## ⚠ Why the layer is an element and not `background-attachment: fixed`
 *
 * DESIGN.md's "the ground holds still" asks for a background that does not move while the
 * content scrolls over it. The obvious implementation is `background-attachment: fixed` on
 * the card root, and it is the wrong one: iOS Safari has never supported it reliably — it
 * either ignores it or paints one viewport-sized copy that jitters against momentum scroll —
 * and a phone browser is the *only* surface this page is guaranteed to be read on. So the
 * ground is a real element that `card.css` promotes to `position: fixed`, and the content
 * above it is `position: relative`. One element, no compatibility cliff.
 *
 * ## ⚠ Why `position: absolute` is the DEFAULT and `fixed` is opted into
 *
 * `position: fixed` escapes every ancestor that is not a containing block — and `overflow`
 * does not make one. `<CardPage>` renders in three places, and two of them are scrolled
 * frames: the builder's phone-width preview (`[data-preview-frame]`, `overflow-y: auto`) and
 * the marketing page's card objects. A fixed ground inside either would leave its frame and
 * paint the **entire browser viewport** the card's colour, on top of or beneath the app.
 *
 * The polarity is therefore fail-safe. The ground is `absolute` — pinned to the card, correct
 * everywhere, no parallax — and `card.css` upgrades it to `fixed` only under
 * `[data-card-page-surface]`, the marker `public-card-view.tsx` puts on the document-level
 * card. A consumer that has never heard of the marker gets the safe rendering, which is the
 * opposite of what a `fixed`-by-default layer would give it.
 *
 * ## The contrast argument, and which layer still pays it
 *
 * `PALETTE_CONTRACT` proves the flat ground carries primary ink at 7:1 and secondary at 4.5:1.
 * Anything painted on top of it under the text can spend that, so two of the three things this
 * module draws are **solved** rather than chosen:
 *
 *   · `mesh` — radial blooms mixed from the palette's accent, secondary ink and rule colour,
 *     all of which lie on the *same side* of the ground as the ink (they have to: each was
 *     chosen to be legible on it). Every bloom moves the ground **toward** the ink and spends
 *     contrast, so {@link meshBloomPercents} steps down from what the design wants — and checks
 *     the channel-wise envelope of the set, because three individually safe blooms can overlap
 *     into a fourth colour that is not.
 *   · a texture's **edge** — the ink-side counter-stroke that gives the mark relief.
 *     {@link textureEdgeAlpha} solves it against every base the finish can paint.
 *
 * The third thing pays nothing. A texture's **shadow** stroke is drawn on the side of the ground
 * *away* from the ink, where it raises both ratios rather than spending either — see
 * {@link textureDirection}. That is the whole reason `TEXTURE_PRESENCE` can be a control the
 * owner turns up instead of a ceiling the renderer defends, and it is why the old ink-side
 * motif had to be rationed to 0.060 on Onyx and was invisible there.
 *
 * ## ⚠ Why the SVGs bake their colour in rather than being masked
 *
 * The tempting implementation of "tint a motif from the ink" is `mask-image: url(svg)` over
 * `background-color: var(--c-ink)`, because the mask follows the custom property for free.
 * Its failure mode is what rules it out: an engine that does not apply the mask paints the
 * **solid ink rectangle**, i.e. a card whose text is invisible. Baking `palette.ink` into the
 * SVG's `stroke`/`fill` and shipping it as a `background-image` fails the other way — an
 * engine that cannot render it draws nothing and the card is merely plain. Same rule as the
 * `color-mix` tint on the action buttons: prefer the treatment whose failure is absence.
 *
 * ## No raster assets and no network
 *
 * Every mark below is authored SVG inlined as a `data:` URI, and every colour is a
 * `color-mix()` or a hex read off the palette. The build makes zero outbound calls, and a
 * wallpaper that 404s is a broken card — see DESIGN.md §"Surface style".
 */

/* ── the two thresholds every treatment is solved against ───────────────────────────── */

/**
 * `PALETTE_CONTRACT`'s own numbers, restated here as the floor a *treatment* may not cross.
 *
 * They are duplicated deliberately rather than imported: the contract asserts them about the
 * palette, this module asserts them about the palette **after** a treatment has been laid over
 * it. Two different claims that happen to share two numbers, and `tests/unit/card-variants.test.tsx`
 * re-derives both from `TEMPLATE_PALETTES` on every run.
 */
export const GROUND_PRIMARY_MIN = 7;
export const GROUND_SECONDARY_MIN = 4.5;

/** The solver's step. Fine enough that nothing visible is lost to rounding, coarse enough to be exact in a test. */
const SOLVE_STEP = 0.005;

/* ── colour maths, matched to CSS `color-mix(in srgb, …)` ───────────────────────────── */

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex(rgb: readonly number[]): string {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * `color-mix(in srgb, tint {ratio}%, base)`, computed.
 *
 * ⚠ Gamma-encoded, not linear. CSS Color 4 names the linear space `srgb-linear`; plain `srgb`
 * interpolates the encoded channels, which is what this does. Getting that backwards would
 * make every number the test computes disagree with what the browser paints — silently, and
 * in the safe direction on dark grounds and the unsafe one on light.
 */
export function mixSrgb(tint: string, base: string, ratio: number): string {
  const t = channels(tint);
  const b = channels(base);
  return toHex([0, 1, 2].map((i) => t[i] * ratio + b[i] * (1 - ratio)));
}

/** Both thresholds, against one composited colour. */
function legibleOn(palette: TemplatePalette, ground: string): boolean {
  return (
    contrastRatio(palette.ink, ground) >= GROUND_PRIMARY_MIN &&
    contrastRatio(palette.inkSoft, ground) >= GROUND_SECONDARY_MIN
  );
}

/**
 * The channel-wise envelope of a set of colours.
 *
 * Overlapping radial blooms composite to a convex combination of their peak colours and the
 * ground, and relative luminance is monotone in every channel — so the worst pixel any overlap
 * can produce is bounded by the channel-wise minimum and maximum of the set. Checking those
 * two synthetic colours is what makes "three blooms that are individually safe" into "no pixel
 * of the mesh is unsafe", which is not the same claim.
 */
function envelope(colours: readonly string[]): [string, string] {
  const all = colours.map(channels);
  const lo = [0, 1, 2].map((i) => Math.min(...all.map((c) => c[i])));
  const hi = [0, 1, 2].map((i) => Math.max(...all.map((c) => c[i])));
  return [toHex(lo), toHex(hi)];
}

/* ── which way a texture may move, and why one direction is free ────────────────────── */

/**
 * ⚠ **The finding this whole module was rebuilt around: a mark that moves the ground *away*
 * from the ink costs no contrast at all.**
 *
 * The old renderer drew every motif in `palette.ink` — white marks on a near-black card, behind
 * white text. Every one of them spent contrast, so `motifAlpha()` correctly solved *down* to
 * 0.060 on Onyx, and six percent white on `#181A1F` is invisible. Five motifs, one indis-
 * tinguishable result. The solver was never wrong; the mark's colour was.
 *
 * Move the mark the other way and the arithmetic inverts:
 *
 *   · On a **deep** ground (white ink) a mark toward black *lowers* the composited luminance,
 *     which *raises* the ratio for `ink` **and** for `inkSoft` — both sit above the ground.
 *   · On a **light** ground (near-black ink) a mark toward white raises the composited
 *     luminance, which raises the ratio for both inks — both sit below the ground.
 *
 * In each case the mark strictly improves every pair the palette contract measures, so there is
 * nothing to ration and `TEXTURE_PRESENCE` can be an owner-facing control. `tests/unit` asserts
 * the improvement rather than trusting this comment.
 *
 * `toward` is the opposite side, and it is *not* free — {@link textureEdgeAlpha} solves it.
 */
export function textureDirection(palette: TemplatePalette): { away: string; toward: string } {
  /* Which ink the palette actually uses, read off the palette rather than off the ground: the
     ground can be clamped by `derivePalette` and the ink is what the clamp was solved for. */
  const inkIsLight = relativeLuminance(palette.ink) > 0.5;
  return inkIsLight
    ? { away: "#000000", toward: "#FFFFFF" }
    : { away: "#FFFFFF", toward: "#000000" };
}

/**
 * Every base colour the chosen finish can put underneath a texture.
 *
 * A texture is now allowed over a gradient and over a mesh — the old rule forbidding it existed
 * only because an ink-side motif had to be solved against the worst stop and came out at
 * roughly zero. The freedom is real but it is not free of *proof*: the ink-side edge has to
 * clear both thresholds over the lightest **and** darkest thing the finish paints, not just
 * over the flat ground midpoint.
 */
function finishBases(palette: TemplatePalette, finish: Finish): string[] {
  if (finish === "gradient") return [palette.gradientFrom, palette.gradientTo];
  if (finish === "mesh") return [palette.ground, ...meshBloomHexes(palette)];
  return [palette.ground];
}

/**
 * The alpha of the **ink-side counter-stroke** — the 1px-offset highlight that makes a mark
 * read as cut into the surface rather than painted onto it. **Never above `TEXTURE_EDGE_ALPHA`.**
 *
 * This is the one layer that still spends contrast, so it is the one layer that is still solved.
 * The worst pixel it can produce is the stroke fully opaque with a glyph sitting exactly on it,
 * over whichever base the finish paints worst: `mix(toward, base, alpha)`. Solve down from the
 * ceiling until *every* base clears both thresholds, and the guarantee covers every pixel of
 * every motif on every finish without anyone reasoning about areal coverage.
 *
 * May return 0. A ground with no headroom then gets a clean deboss with no highlight, which
 * still reads — the shadow stroke carries the mark, and it was never the rationed part.
 */
export function textureEdgeAlpha(palette: TemplatePalette, finish: Finish): number {
  const { toward } = textureDirection(palette);
  const bases = finishBases(palette, finish);

  for (let a = TEXTURE_EDGE_ALPHA; a > 0; a -= SOLVE_STEP) {
    const alpha = Math.round(a * 1000) / 1000;
    if (bases.every((base) => legibleOn(palette, mixSrgb(toward, base, alpha)))) return alpha;
  }
  return 0;
}

/**
 * The alpha of the **ground-side shadow stroke** — the mark itself.
 *
 * Not solved, and that is the point: by {@link textureDirection} this layer only ever moves the
 * ground away from the ink, so every value improves every pair the contract measures. What it
 * reads off `TEXTURE_PRESENCE` is the owner's choice, applied unmodified.
 */
export function textureShadowAlpha(presence: TexturePresence): number {
  return TEXTURE_PRESENCE[presence];
}

/* ── the mesh ───────────────────────────────────────────────────────────────────────── */

/**
 * One radial bloom: which palette colour it leans toward, how far, and where it sits.
 *
 * The three tints are the only colours a palette owns that are *not* the ground: its accent
 * fill, its secondary ink and its rule colour. On the deep palettes those are pale tints of
 * the card's own hue; on the light ones they are hue-matched deeps. Either way they are
 * neighbours of the ground rather than strangers to it, which is what makes three blooms read
 * as one surface with depth instead of as three coloured lights.
 *
 * `want` is the strength the design asks for. What is actually painted is
 * {@link meshBloomPercents}, which never exceeds it.
 */
export interface MeshBloom {
  /** The `--c-*` custom property the CSS mixes toward. */
  cssVar: string;
  /** The matching key on `TemplatePalette`, so the solver and the test can compute the same mix. */
  key: "buttonBg" | "inkSoft" | "line";
  /** Wanted mix, 0–1. */
  want: number;
  /** `radial-gradient(<size> at <at>, …)`. */
  size: string;
  at: string;
  /** Where the bloom has faded out completely. */
  stop: string;
}

/**
 * Three blooms, not two and not five.
 *
 * Two read as a gradient with extra steps; four or more read as a lava lamp, which is the
 * expressive register DESIGN.md rules out for this surface. Three placed off-centre — high
 * left, mid right, low centre — give the ground a diagonal that never resolves into a
 * direction, which is the whole difference between "mesh" and "gradient".
 */
export const MESH_BLOOMS: readonly MeshBloom[] = [
  { cssVar: "--c-button-bg", key: "buttonBg", want: 0.14, size: "78% 62%", at: "16% 6%", stop: "68%" },
  { cssVar: "--c-ink-soft", key: "inkSoft", want: 0.14, size: "66% 58%", at: "92% 30%", stop: "64%" },
  { cssVar: "--c-line", key: "line", want: 0.26, size: "92% 68%", at: "34% 86%", stop: "70%" },
];

/**
 * What each bloom is actually mixed at on this palette — the wanted strength, or the most
 * this ground can carry, whichever is smaller.
 *
 * Two passes, and the second one matters. The first clamps each bloom on its own. The second
 * checks the {@link envelope} of the whole set, because three individually safe blooms can
 * still overlap into a colour lighter (or darker) than any of them, and scales the set down
 * together until that synthetic worst pixel is legible too.
 */
export function meshBloomPercents(palette: TemplatePalette): number[] {
  const solo = MESH_BLOOMS.map((bloom) => {
    for (let p = bloom.want; p > 0; p -= SOLVE_STEP) {
      const pct = Math.round(p * 1000) / 1000;
      if (legibleOn(palette, mixSrgb(palette[bloom.key], palette.ground, pct))) return pct;
    }
    return 0;
  });

  for (let scale = 1; scale > 0; scale -= 0.05) {
    const scaled = solo.map((p) => Math.round(p * scale * 1000) / 1000);
    const [lo, hi] = envelope([
      palette.ground,
      ...MESH_BLOOMS.map((b, i) => mixSrgb(palette[b.key], palette.ground, scaled[i])),
    ]);
    if (legibleOn(palette, lo) && legibleOn(palette, hi)) return scaled;
  }
  return solo.map(() => 0);
}

/** The peak colour of each bloom, as the browser will composite it. For the contrast test. */
export function meshBloomHexes(palette: TemplatePalette): string[] {
  const pcts = meshBloomPercents(palette);
  return MESH_BLOOMS.map((bloom, i) => mixSrgb(palette[bloom.key], palette.ground, pcts[i]));
}

/**
 * The blooms as a `background-image` value.
 *
 * `color-mix()` rather than the computed hex, deliberately: the CSS then reads the card's live
 * `--c-*` properties, so when free colour lands and a card's ground stops being one of the nine
 * presets, the mesh follows it without this module being touched. The percentages are the only
 * thing carried across from the solver.
 */
function meshLayers(palette: TemplatePalette): string {
  const pcts = meshBloomPercents(palette);
  return MESH_BLOOMS.map((bloom, i) => {
    const colour = `color-mix(in srgb, var(${bloom.cssVar}) ${(pcts[i] * 100).toFixed(1)}%, var(--c-ground))`;
    return `radial-gradient(${bloom.size} at ${bloom.at}, ${colour} 0%, transparent ${bloom.stop})`;
  }).join(", ");
}

/* ── the motifs ─────────────────────────────────────────────────────────────────────── */

/**
 * The three motifs, as SVG bodies drawn at their own tile size from `TEXTURES`.
 *
 * ⚠ `hatch` and `arcs` were here and were cut — `card-surface.ts` carries why, and
 * `LEGACY_TEXTURE` maps a card wearing one onto the nearest survivor.
 *
 * Every one is authored to **tile seamlessly**, which is the whole difficulty and the reason
 * they are written out rather than generated:
 *
 *   · `grid`  — one top edge and one left edge per cell. The neighbouring tiles supply the
 *               other two, so the rule is 1px everywhere instead of 2px on every seam.
 *   · `dots`  — a half-drop pair. A single centred dot tiles as a square lattice, which reads
 *               as a grid of dots; offsetting the second by half a tile reads as a texture.
 *   · `topo`  — three waves, one full period per 64px tile, at three amplitudes and two
 *               phases so they read as contour lines rather than as a comb. Each is a `Q`
 *               followed by one `T`, and `T` reflects the previous control point — so a wave
 *               that leaves the left edge on a crest arrives at the right edge with the
 *               **same tangent**. C1-continuous across the seam, which is what stops a
 *               contour kinking every 64px. (An earlier version used a half-period of 16 and
 *               tiled perfectly but read as ripples; the shape is the wavelength.)
 *
 * ⚠ **`mark` is no longer the palette's ink.** It used to be, and that single choice is what
 * made every motif invisible: an ink-coloured mark behind ink-coloured words has to be solved
 * down to nothing. Each body is now painted twice — once in `textureDirection().away` at the
 * owner's presence, once in `.toward` at the solved edge alpha, offset by 1px — so the same
 * geometry reads as a groove cut into the ground rather than a tint laid over it.
 */
const MOTIF_BODY: Record<PatternId, (mark: string) => string> = {
  grid: (mark) => `<path d="M0 .5H32M.5 0V32" fill="none" stroke="${mark}" stroke-width="1"/>`,
  dots: (mark) =>
    `<g fill="${mark}"><circle cx="6" cy="6" r="1.6"/><circle cx="18" cy="18" r="1.6"/></g>`,
  topo: (mark) =>
    `<g fill="none" stroke="${mark}" stroke-width="1.1">` +
    `<path d="M0 12Q16 3 32 12T64 12"/>` +
    `<path d="M0 34Q16 44 32 34T64 34"/>` +
    `<path d="M0 54Q16 47 32 54T64 54"/></g>`,
};

/**
 * The grain tile, in px — large enough that the eye cannot find the repeat, small enough to
 * rasterise cheaply. Mirrors `TEXTURES.grain.tile`, which is what the picker and the scale
 * multiplier read; this constant is the one the SVG viewport is authored at.
 */
const GRAIN_TILE = 160;

/**
 * Fine monochrome noise, as `feTurbulence` — no raster asset, no request, ~380 bytes.
 *
 * Two primitives:
 *   1. `feTurbulence type="fractalNoise"` with `stitchTiles="stitch"`, which is what makes the
 *      generated field wrap at the filter region's edges so CSS can repeat the tile without a
 *      visible grid of seams.
 *   2. an `feColorMatrix` that throws the noise's colour away and keeps only its shape: the
 *      output RGB is a **constant** — the palette's ink — and the output **alpha** is a
 *      luminance-weighted read of the turbulence. So the layer is ink at a varying alpha whose
 *      mean is ≈0.5, which is why grain at the same ceiling as a pattern reads roughly half as
 *      strong: it is ink at `motifAlpha × noise`, not ink at `motifAlpha`.
 *
 * `feColorMatrix` operates on un-premultiplied RGBA, which is what lets the last row read the
 * turbulence's colour channels while the first three rows have already replaced them.
 */
function grainBody(mark: string): string {
  const [r, g, b] = channels(mark).map((c) => (c / 255).toFixed(4));
  return (
    `<filter id="g" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" seed="7"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0.6 0.3 0.1 0 0"/>` +
    `</filter>` +
    `<rect width="${GRAIN_TILE}" height="${GRAIN_TILE}" filter="url(#g)"/>`
  );
}

/** `url("data:image/svg+xml,…")`. Encoded, so `#` in a hex colour cannot terminate the URI as a fragment. */
function svgUrl(width: number, height: number, body: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/* ── the texture, as painted layers ─────────────────────────────────────────────────── */

/** One `<span>` of texture. `shadow` is the mark; `edge` is the highlight that gives it relief. */
interface TextureLayer {
  role: "shadow" | "edge";
  style: CSSProperties;
}

/**
 * The one or two layers a texture paints, at the owner's presence and scale.
 *
 * ## ⚠ Why these are elements with `opacity` and not background layers on the ground
 *
 * Each layer needs its **own** alpha, and a `background-image` layer cannot carry one. It also
 * has to alpha-blend against *whatever the finish painted underneath it* — over a gradient the
 * mark must darken each stop proportionally, which is what compositing a translucent layer
 * does and what baking a single composited hex into the SVG would not.
 *
 * ## Why the edge is offset by exactly 1px, and why grain has none
 *
 * Relief is read from the pairing of a dark edge and a light one, not from either alone. One
 * device pixel of offset is enough for the eye and small enough that the two strokes still read
 * as one mark rather than as a doubled line — the same trick a blind deboss plays on paper.
 * Grain gets no edge: offsetting noise by 1px produces more noise, not relief.
 */
function textureLayers(
  palette: TemplatePalette,
  finish: Finish,
  texture: Texture,
  presence: TexturePresence,
  scale: TextureScale,
): TextureLayer[] {
  const authored = TEXTURES[texture].tile;
  if (texture === "none" || authored === null) return [];

  const { away, toward } = textureDirection(palette);
  const painted = Math.round(authored * TEXTURE_SCALE[scale]);
  const backgroundSize = `${painted}px ${painted}px`;

  /* The SVG viewport stays at the AUTHORED tile and `background-size` does the scaling. The
     motif geometry was solved at that size — `topo`'s C1 continuity across the seam, `arcs`'
     outermost radius landing on the opposite corner — and re-authoring it at another size
     would re-open both. */
  const image = (mark: string): string =>
    isPatternId(texture)
      ? svgUrl(authored, authored, MOTIF_BODY[texture](mark))
      : svgUrl(authored, authored, grainBody(mark));

  const shadow: TextureLayer = {
    role: "shadow",
    style: {
      backgroundImage: image(away),
      backgroundSize,
      opacity: textureShadowAlpha(presence),
    },
  };

  if (texture === "grain") return [shadow];

  const edge = textureEdgeAlpha(palette, finish);
  if (edge === 0) return [shadow];

  return [
    shadow,
    {
      role: "edge",
      style: {
        backgroundImage: image(toward),
        backgroundSize,
        backgroundPosition: "1px 1px",
        opacity: edge,
      },
    },
  ];
}

/* ── the component ──────────────────────────────────────────────────────────────────── */

export interface CardGroundProps {
  /** The card's resolved palette. Every colour painted here comes from it. */
  palette: TemplatePalette;
  /** How the colour is laid down. Independent of `texture`. */
  finish: Finish;
  /** What is cut into it. `none` paints the finish alone. */
  texture: Texture;
  texturePresence: TexturePresence;
  textureScale: TextureScale;
}

export function CardGround({
  palette,
  finish,
  texture,
  texturePresence,
  textureScale,
}: CardGroundProps): ReactElement {
  /* ⚠ There is no `painted` prop any more. It existed for the `minimal` header layout, whose
     definition was "no coloured hero"; that axis is gone and the ground is now always painted,
     edge to edge, which is the rule the card had anyway. */
  const base: CSSProperties = { backgroundColor: "var(--c-ground)" };

  if (finish === "gradient") base.backgroundImage = "var(--c-ground-gradient)";
  if (finish === "mesh") base.backgroundImage = meshLayers(palette);

  /* ⚠ A texture over a gradient or a mesh is now legal, and the old comment saying it was not
     described a real constraint on the OLD mark: an ink-side motif had to be solved against the
     finish's worst stop and came out at roughly zero. A ground-side mark only ever moves every
     stop AWAY from the ink, so it improves each one. `textureEdgeAlpha` still solves the
     ink-side highlight against every base the finish can paint — see `finishBases`. */
  const layers = textureLayers(palette, finish, texture, texturePresence, textureScale);

  return (
    <div
      data-card-ground=""
      /* Published so a screenshot sweep, a bug report or a builder preview can name the
         treatment instead of describing it. */
      data-card-finish={finish}
      data-card-texture={texture}
      aria-hidden="true"
      style={base}
    >
      {layers.map((layer) => (
        <span
          key={layer.role}
          data-card-ground-motif={texture}
          data-card-ground-motif-role={layer.role}
          style={layer.style}
        />
      ))}
    </div>
  );
}
