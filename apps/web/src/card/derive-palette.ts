/**
 * `derivePalette` — a hex the owner picked, turned into a whole legible card.
 *
 * ## Why this module exists
 *
 * The nine palettes in `template-palettes.ts` were authored by hand, and their own header says
 * how: only the two gradient stops, the angle and the button pair were *chosen*; everything else
 * was **found by searching for the smallest shift that satisfies that value's own contract**.
 * That is nine palettes' worth of a procedure a person executed by hand. This file is that
 * procedure, executed by a machine, so the owner can pick any colour at all.
 *
 * Product Principle 3 is *freedom with a floor*: "an illegible card must be impossible to make,
 * not merely discouraged". A colour picker plus a warning is the discouraged version — nobody
 * reads it, and the card ships unreadable. The floor here is arithmetic. `derivePalette` is
 * **total**: every hex, on every `Finish`, yields a `TemplatePalette` that satisfies every
 * pair in `PALETTE_CONTRACT`. `tests/contract/derive-palette.test.ts` proves it over a fixed
 * sweep of the colour space rather than over the handful of colours anyone would think to try.
 *
 * ## The method, and the defect each step prevents
 *
 * 1. **Clamp the ground.** `LEGIBILITY_DEAD_BAND` is the band of relative luminance where
 *    neither white nor near-black ink clears 7:1. A colour landing there is moved to the nearer
 *    edge — hue and saturation held, lightness alone moved. *Prevents:* the mid-tone card whose
 *    own name cannot be read, which is what a free picker produces by default.
 * 2. **Ink polarity follows the clamped luminance**, never the requested one. *Prevents:* white
 *    ink chosen against the colour the owner asked for and then painted on the colour we
 *    actually used.
 * 3. **Stops are placed around the ground, inside the legal window.** Every `allStops` pair is
 *    checked against *both* stops, so a wider gradient is a harder contract, not a free one.
 *    *Prevents:* the defect the preset file records — Terracotta and Slate shipped legible in
 *    the middle and illegible at one end, because a naive check uses the midpoint.
 * 4. **Every other slot is searched, against the worst stop.** Not computed by a formula that
 *    happens to work on the colours we tried: scanned along a hue ray and scored. *Prevents:*
 *    the class of bug where a derivation is correct for deep grounds and quietly wrong for
 *    light ones (or for one narrow hue), which a formula hides and a search cannot.
 *
 * ## Purity
 *
 * No clock, no randomness, no I/O, no mutation of anything shared. The same hex and style
 * always give an equal — and freshly allocated — palette. Everything at module scope is a
 * frozen constant computed once from literals.
 *
 * ## Known cross-boundary gap
 *
 * `TemplatePalette.id` is typed `PaletteId`, a closed union of the nine preset ids, so a derived
 * palette has to borrow one. It borrows the **nearest preset's**, which keeps `data-palette-id`
 * selectors and any id-keyed lookup landing on a palette of the same polarity. It is still a
 * borrowed name: a consumer that re-reads `TEMPLATE_PALETTES[palette.id]` instead of using the
 * palette in hand will paint the preset's colours, not the owner's. See `nearestPresetId`.
 */

import { LEGIBILITY_DEAD_BAND, type Finish } from "@/card/card-surface";
import {
  APP_CANVAS,
  PALETTE_ORDER,
  TEMPLATE_PALETTES,
  type PaletteId,
  type TemplatePalette,
} from "@/card/template-palettes";
import { parseHex } from "@/lib/contrast";

/* ── The public shape ────────────────────────────────────────────────────────────────── */

export interface DerivedPalette {
  palette: TemplatePalette;
  /** The ground actually used. Differs from the request only when it was clamped. */
  groundHex: string;
  /** True when the requested colour fell in the dead band and was moved. */
  clamped: boolean;
  /** Owner-facing, plain, no jargon. Empty when nothing was clamped. */
  clampNote: string;
}

/* ── Constants ───────────────────────────────────────────────────────────────────────── */

/** The two inks the system has. There is no third, which is the whole reason for the clamp. */
const INK_ON_DARK = "#FFFFFF";
const INK_ON_LIGHT = "#0F1114";

/**
 * Added to every threshold before searching.
 *
 * The preset suite asserts `Number(ratio.toFixed(2)) >= min`, which forgives up to 0.005. This
 * module does not want that forgiveness — a derived palette should clear its contract on the raw
 * ratio, so tightening the suite later cannot retroactively break millions of owner colours.
 * The margin also removes a real hazard at the dead band's own edge: a ground at exactly
 * `L = 0.100` measures `1.05 / (0.1 + 0.05) = 6.999999999999999` in IEEE doubles, so an
 * unmargined 7:1 search would sit one ULP on the wrong side of its own specification.
 *
 * Cost of the margin: the effective dark edge is `L ≤ 0.09999` instead of `L ≤ 0.10000`. That is
 * one hundred-thousandth of the luminance axis and no owner can see it.
 */
const CONTRACT_MARGIN = 0.0005;

const MIN_INK = 4.5 + CONTRACT_MARGIN;
const MIN_INK_HEADROOM = 7 + CONTRACT_MARGIN;
const MIN_BOUNDARY = 3 + CONTRACT_MARGIN;
const MIN_HAIRLINE = 1.2 + CONTRACT_MARGIN;

/**
 * How far apart the two stops sit, as a span of HSL lightness.
 *
 * Measured off the presets, which land between 0.096 (Onyx) and 0.141 (Amber), and then spent
 * per finish. `flat` is the interesting one: the contract test rejects `gradientFrom === gradientTo`
 * because a one-stop gradient is a flat fill wearing a gradient's API and would satisfy every
 * `allStops` pair vacuously. So flat gets a span wide enough to quantise to two different bytes
 * and narrow enough that no eye can tell — a real range, invisible.
 *
 * The ordering is a legibility budget, not a taste ranking. Every extra unit of span is another
 * unit the ink, the buttons and the borders all have to survive at the far end.
 */
const STOP_SPAN: Record<Finish, number> = {
  flat: 0.008,
  gradient: 0.1,
  mesh: 0.15,
};

/**
 * One angle for every derived card.
 *
 * `TemplatePalette.gradientAngle`'s own comment settles this: "150–160 across the set — a
 * consistent raking light, not a per-card flourish". Deriving an angle from the hue would make
 * it exactly the per-card flourish that comment refuses.
 */
const GRADIENT_ANGLE = 154;

/**
 * Saturation, as a multiple of the ground's, for each family of derived value.
 *
 * Every one of these was read back off the nine presets rather than guessed, because HSL
 * saturation is not perceptual and the intuitive numbers are wrong. Sapphire's pale button
 * `#CBD9F7` measures **0.73** — *higher* than the `#142C63` ground it tints — because HSL
 * compresses saturation as lightness approaches 1, so holding chroma steady while lightening
 * means holding the multiplier near 1. Setting this to the intuitive "a tint is a third of the
 * hue" produced `#DADEE7`, a cool grey, and lost exactly the difference DESIGN.md says the
 * button carries: "a card is a different object when its button is powder-blue rather than
 * white".
 *
 * The hairlines go the other way. The presets mute them hard — Sapphire's `line` measures 0.52
 * of its ground and its `buttonAltBorder` 0.30 — because a hairline lightened at full saturation
 * on a deep ground comes out a vivid stripe, which is a flourish on a surface that wants none.
 */
/** Secondary ink: the ground's hue, heavily diluted — never a neutral grey dropped on top. */
const INK_SOFT_SATURATION = 0.3;
/** Hairlines and the outline button's edge: present, muted, never a stripe. */
const FURNITURE_SATURATION = 0.55;
/** A pale button is the hue *lightened*, not the hue washed out. See above. */
const PALE_TINT_SATURATION = 0.9;
/** A deep button needs *more* HSL saturation than its ground to keep any chroma at all. */
const DEEP_TINT_SATURATION = 1.4;
/** Where a pale button aims before the search corrects it. */
const PALE_TARGET_L = 0.88;
/** Where a deep button aims before the search corrects it. */
const DEEP_TARGET_L = 0.14;

/**
 * Below this, a white QR plate stops reading as an object on the ground and needs an edge.
 * Mirrors the threshold `tests/contract/template-palettes.test.ts` holds the presets to, so a
 * derived palette and a preset answer the same question the same way.
 */
const PLATE_DISSOLVES_BELOW = 1.5;
/** Same idea one level out: a card whose ground is this close to the app canvas has no edge. */
const FACE_DISSOLVES_BELOW = 1.5;

/* ── sRGB maths on packed 0xRRGGBB integers ──────────────────────────────────────────── */

/**
 * `linearise` for all 256 byte values, precomputed.
 *
 * A search scans hundreds of candidates per slot; going through `relativeLuminance` — which
 * regex-tests a string, slices it and calls `parseInt` three times — would make the sweep test
 * take minutes. The expression below is character-for-character the one in `src/lib/contrast.ts`,
 * and the weighted sum in `lumOf` applies the same three coefficients in the same order, so the
 * two agree bit-for-bit rather than approximately. The contract suite re-measures every derived
 * colour with the real `contrastRatio`, so any drift between them fails there.
 */
const LINEAR: readonly number[] = Object.freeze(
  Array.from({ length: 256 }, (_, i) => {
    const c = i / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }),
);

/** Relative luminance of a packed colour. */
function lumOf(pk: number): number {
  return (
    0.2126 * LINEAR[(pk >> 16) & 255] +
    0.7152 * LINEAR[(pk >> 8) & 255] +
    0.0722 * LINEAR[pk & 255]
  );
}

/** WCAG contrast between two packed colours. Order-independent, like `contrastRatio`. */
function ratioOf(a: number, b: number): number {
  const la = lumOf(a);
  const lb = lumOf(b);
  return ((la > lb ? la : lb) + 0.05) / ((la < lb ? la : lb) + 0.05);
}

function packHex(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (r << 16) | (g << 8) | b;
}

/** Uppercase `#RRGGBB`, which is the only form any palette slot is allowed to hold. */
function hexOf(pk: number): string {
  return `#${pk.toString(16).toUpperCase().padStart(6, "0")}`;
}

interface Hsl {
  /** Degrees, `[0, 360)`. */
  h: number;
  s: number;
  l: number;
}

function hslOf(pk: number): Hsl {
  const r = ((pk >> 16) & 255) / 255;
  const g = ((pk >> 8) & 255) / 255;
  const b = (pk & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  /* Achromatic: hue is undefined rather than zero, and every ray drawn from it is a grey ramp. */
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  return { h, s, l };
}

/**
 * A point on the hue/saturation **ray**: hue and saturation fixed, lightness swept.
 *
 * The ray is the only path this module ever moves a colour along, and that is the design. Every
 * derived value stays in the ground's own hue family by construction, so a palette cannot drift
 * into a second accent colour no one chose. It is also what makes "preserve the hue through a
 * clamp" true rather than approximately true.
 *
 * Each channel is non-decreasing in `l` for fixed `h`/`s`, and rounding preserves that, so
 * luminance along a ray is monotonic. Every search below relies on nothing but this ordering.
 */
function rayColour(h: number, s: number, l: number): number {
  const L = l < 0 ? 0 : l > 1 ? 1 : l;
  const c = (1 - Math.abs(2 * L - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) {
    r = c;
    g = x;
  } else if (hp < 2) {
    r = x;
    g = c;
  } else if (hp < 3) {
    g = c;
    b = x;
  } else if (hp < 4) {
    g = x;
    b = c;
  } else if (hp < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const m = L - c / 2;
  const q = (v: number) => {
    const n = Math.round((v + m) * 255);
    return n < 0 ? 0 : n > 255 ? 255 : n;
  };
  return (q(r) << 16) | (q(g) << 8) | q(b);
}

/* ── The search ──────────────────────────────────────────────────────────────────────── */

/**
 * How many candidates a ray is sampled at.
 *
 * A ray spans at most 256 distinct bytes per channel, and lightness maps to a channel with a
 * slope of at most `1 + s ≤ 2`, so 512 samples visit every reachable colour on the ray at least
 * once. Sampling rather than binary-searching is deliberate: it costs a few microseconds and it
 * does not assume the predicate is monotonic. Some of them are not — contrast against a fixed
 * background is V-shaped around that background's own luminance — and a bisection that met one
 * of those would return a wrong answer silently instead of a slow one.
 */
const RAY_SAMPLES = 512;

interface RayHit {
  pk: number;
  l: number;
}

/**
 * Scan `[loL, hiL]` along the ray and return the admissible candidate with the lowest `score`.
 * `null` when the ray holds no admissible colour at all — which every caller must handle rather
 * than assume away, because "there is no legal colour here" is a real answer for some inputs.
 */
function searchRay(
  h: number,
  s: number,
  loL: number,
  hiL: number,
  ok: (pk: number) => boolean,
  score: (pk: number, l: number) => number,
): RayHit | null {
  if (hiL < loL) return null;
  let best: RayHit | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= RAY_SAMPLES; i++) {
    const l = loL + ((hiL - loL) * i) / RAY_SAMPLES;
    const pk = rayColour(h, s, l);
    if (!ok(pk)) continue;
    const sc = score(pk, l);
    if (sc < bestScore) {
      bestScore = sc;
      best = { pk, l };
    }
  }
  return best;
}

/** The admissible colour whose lightness is closest to `anchorL` — the *smallest shift*. */
function nearestOnRay(
  h: number,
  s: number,
  loL: number,
  hiL: number,
  anchorL: number,
  ok: (pk: number) => boolean,
): RayHit | null {
  return searchRay(h, s, loL, hiL, ok, (_pk, l) => Math.abs(l - anchorL));
}

/** The admissible colour that contrasts *most* with `fromPk` — the deliberate opposite. */
function furthestFromOnRay(
  h: number,
  s: number,
  loL: number,
  hiL: number,
  fromPk: number,
  ok: (pk: number) => boolean,
): RayHit | null {
  return searchRay(h, s, loL, hiL, ok, (pk) => -ratioOf(pk, fromPk));
}

/* ── Step 1: the ground, and the clamp ───────────────────────────────────────────────── */

const WHITE = packHex(INK_ON_DARK);
const NEAR_BLACK = packHex(INK_ON_LIGHT);
const CANVAS = packHex(APP_CANVAS);
const BLACK = 0x000000;

/**
 * The ink a ground can carry, or `null` when it can carry neither — which is the definition of
 * "in the dead band", stated as the test that actually matters rather than as a range lookup.
 *
 * Both halves are asserted: the published band **and** the ratio it was derived from. They agree
 * to five decimal places, and requiring both means this function can never disagree with
 * `LEGIBILITY_DEAD_BAND` in one direction or with `PALETTE_CONTRACT` in the other.
 */
function groundInkFor(pk: number): number | null {
  const l = lumOf(pk);
  if (l <= LEGIBILITY_DEAD_BAND.min && ratioOf(WHITE, pk) >= MIN_INK_HEADROOM) return WHITE;
  if (l >= LEGIBILITY_DEAD_BAND.max && ratioOf(NEAR_BLACK, pk) >= MIN_INK_HEADROOM) {
    return NEAR_BLACK;
  }
  return null;
}

interface Ground {
  pk: number;
  ink: number;
  /** `true` when the ink is white, i.e. the ground is on the deep side of the band. */
  deep: boolean;
  clamped: boolean;
  /**
   * ⚠ The ray the whole palette is built on — **the requested colour's** hue and saturation,
   * carried out of here rather than re-derived from the clamped ground.
   *
   * Re-deriving looks equivalent and is not. A clamped ground is a rounded 8-bit sample of this
   * ray, and `hslOf` of that sample returns a saturation a fraction off the one the ray was
   * swept at. Placing the stops on that second, nearly-identical ray put them at lightnesses
   * whose colours had never been tested by the window search — seven greens, teals and blues in
   * the sweep came out with a stop measuring 6.95:1 against its ink, under the headroom rule by
   * a margin no eye would catch and every contract test would.
   */
  h: number;
  s: number;
  /** Where the ground sits on that ray. */
  groundL: number;
  /** The lightness range on that ray a ground or a stop may occupy. */
  windowLo: number;
  windowHi: number;
}

/**
 * Move a dead-band colour to the nearer edge of legality, hue and saturation untouched.
 *
 * "Nearer" is measured in **relative luminance**, the unit the band itself is published in. The
 * alternative — nearest in HSL lightness — picks a different side only for luminances between
 * roughly 0.220 and 0.246, a sliver 11% of the band wide, and there is no reason to prefer it
 * over the band's own unit.
 *
 * The edge is *found*, not computed from the inverse of the luminance formula: the search asks
 * the same `groundInkFor` predicate the rest of the module asks, on the quantised 8-bit colour
 * that will actually be painted. A closed-form edge would be right about the real-valued colour
 * and occasionally wrong about the byte it rounds to.
 */
function resolveGround(requestedPk: number): Ground {
  const { h, s, l: requestedL } = hslOf(requestedPk);

  const deepWindow = searchRay(
    h,
    s,
    0,
    1,
    (pk) => groundInkFor(pk) === WHITE,
    (_pk, l) => -l,
  );
  const lightWindow = searchRay(
    h,
    s,
    0,
    1,
    (pk) => groundInkFor(pk) === NEAR_BLACK,
    (_pk, l) => l,
  );

  /* Both always exist: black is legal for white ink and white is legal for near-black ink, on
     every ray. The guards below are for the type system, not for a case that can occur. */
  const deepEdge = deepWindow ?? { pk: BLACK, l: 0 };
  const lightEdge = lightWindow ?? { pk: 0xffffff, l: 1 };

  const ink = groundInkFor(requestedPk);
  if (ink !== null) {
    const deep = ink === WHITE;
    return {
      pk: requestedPk,
      ink,
      deep,
      clamped: false,
      h,
      s,
      groundL: requestedL,
      windowLo: deep ? 0 : lightEdge.l,
      windowHi: deep ? deepEdge.l : 1,
    };
  }

  const l = lumOf(requestedPk);
  const goDeep = l - LEGIBILITY_DEAD_BAND.min <= LEGIBILITY_DEAD_BAND.max - l;
  return goDeep
    ? {
        pk: deepEdge.pk,
        ink: WHITE,
        deep: true,
        clamped: true,
        h,
        s,
        groundL: deepEdge.l,
        windowLo: 0,
        windowHi: deepEdge.l,
      }
    : {
        pk: lightEdge.pk,
        ink: NEAR_BLACK,
        deep: false,
        clamped: true,
        h,
        s,
        groundL: lightEdge.l,
        windowLo: lightEdge.l,
        windowHi: 1,
      };
}

/**
 * What the owner is told, in the owner's words.
 *
 * Deliberately names no threshold and no colour space. "Relative luminance 0.21 falls inside the
 * 0.100–0.339 dead band" is true, is what happened, and is useless to the person who just picked
 * a colour. What they need is the consequence and the remedy, in one sentence, with the fact that
 * their colour survived — only its depth moved — stated rather than implied.
 */
function clampNoteFor(deep: boolean): string {
  return deep
    ? "No text colour is readable on the shade you picked, so your card uses a slightly deeper version of it."
    : "No text colour is readable on the shade you picked, so your card uses a slightly lighter version of it.";
}

/* ── Step 3: the two stops ───────────────────────────────────────────────────────────── */

interface Stops {
  /** The lighter stop, matching every preset's `gradientFrom`. */
  from: number;
  /** The darker stop. */
  to: number;
}

/**
 * Place the stops around the ground, inside the legal window.
 *
 * Three properties have to hold at once, and each one is a contract assertion:
 *
 * · **Both stops legible.** They are drawn from the same window the ground was clamped into, so
 *   the 7:1 ink rule holds at *both* ends, not just in the middle. This is the check the preset
 *   file records catching Terracotta and Slate on.
 * · **The ground inside its own range.** `ground` is the flat representative — the PNG exporter
 *   and the canvas-action fill paint it — so a ground outside the gradient means those two paint
 *   a colour the card never shows. The span is therefore spent *around* the ground, and any part
 *   of it that will not fit on one side is spent on the other rather than dropped, which keeps a
 *   ground sitting on the very edge of legality from silently losing its gradient.
 * · **Two distinct stops.** Enforced last, by widening, because the two rules above can pin both
 *   ends onto the same byte for a ground with almost no room.
 */
function placeStops(ground: Ground, span: number): Stops {
  const { h, s, groundL } = ground;
  const gLum = lumOf(ground.pk);
  const half = span / 2;

  const wantHi = groundL + half;
  const wantLo = groundL - half;
  const hiCapped = Math.min(wantHi, ground.windowHi);
  const loCapped = Math.max(wantLo, ground.windowLo);
  /* Spend the overflow on the other side instead of losing it. A ground pinned against the
     edge of legality still gets a gradient; it just gets an asymmetric one. */
  const loL = Math.max(ground.windowLo, loCapped - (wantHi - hiCapped));
  const hiL = Math.min(ground.windowHi, hiCapped + (loCapped - wantLo));

  let from = rayColour(h, s, hiL);
  let to = rayColour(h, s, loL);

  /* The ground came in as bytes, not as an HSL triple, and the round trip through `hslOf` can
     land a hair off. Pulling the offending stop onto the ground itself is exact, and cannot
     unseat legibility because the ground is legal by construction. At most one side can be
     wrong at a time: both would mean `lum(to) > lum(from)` on a monotonic ray. */
  if (lumOf(from) < gLum) from = ground.pk;
  if (lumOf(to) > gLum) to = ground.pk;

  if (from === to) {
    for (let i = 1; i <= RAY_SAMPLES; i++) {
      const step = i / RAY_SAMPLES;
      const up = rayColour(h, s, Math.min(ground.windowHi, groundL + step));
      if (up !== to && lumOf(up) >= gLum) {
        from = up;
        break;
      }
      const down = rayColour(h, s, Math.max(ground.windowLo, groundL - step));
      if (down !== from && lumOf(down) <= gLum) {
        to = down;
        break;
      }
    }
  }

  return { from, to };
}

/* ── Step 4: everything else, by search ──────────────────────────────────────────────── */

/** The weakest of the two stops for a given foreground. Every `allStops` pair is judged here. */
function worstOnStops(fg: number, stops: Stops): number {
  const a = ratioOf(fg, stops.from);
  const b = ratioOf(fg, stops.to);
  return a < b ? a : b;
}

/**
 * The better of the two poles as a label colour for `bg`, then walked back toward the fill to
 * the closest colour in `bg`'s own hue that still clears 4.5.
 *
 * Choosing by **pure black versus pure white** rather than by the palette's two inks is not a
 * detail. Compare against `#0F1114` instead and there is a window of backgrounds — luminance
 * roughly 0.183 to 0.192 — where the comparison prefers the dark side while `#0F1114` itself
 * measures under 4.5 on it, so the "obviously safe" pole is not safe. Against the true poles the
 * two admissible ranges overlap, and one of them always works.
 */
function labelFor(bg: number, h: number, s: number): number {
  const preferDark = ratioOf(BLACK, bg) >= ratioOf(WHITE, bg);
  const bgL = hslOf(bg).l;
  const ok = (pk: number) => ratioOf(pk, bg) >= MIN_INK;
  const hit = preferDark
    ? nearestOnRay(h, Math.min(1, s * DEEP_TINT_SATURATION), 0, bgL, DEEP_TARGET_L, ok)
    : nearestOnRay(h, s * PALE_TINT_SATURATION, bgL, 1, 1, ok);
  /* The pole is always admissible (see above), so the ray always holds at least one hit; the
     fallback is the pole itself so a future change to the ray cannot produce a missing label. */
  return hit?.pk ?? (preferDark ? BLACK : 0xffffff);
}

/* ── The nearest preset, for the borrowed id ─────────────────────────────────────────── */

interface PresetPoint {
  id: PaletteId;
  h: number;
  s: number;
  lum: number;
}

const PRESET_POINTS: readonly PresetPoint[] = Object.freeze(
  PALETTE_ORDER.map((id) => {
    const pk = packHex(TEMPLATE_PALETTES[id].ground);
    const { h, s } = hslOf(pk);
    return { id, h, s, lum: lumOf(pk) };
  }),
);

function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Which preset this colour most resembles.
 *
 * `TemplatePalette.id` is a closed union and a derived palette has to carry one of the nine.
 * Nearest-by-appearance is the least-wrong borrowing available: it keeps `data-palette-id`
 * meaningful, it is a pure function of the ground, and — because luminance is weighted hardest —
 * it never crosses the dead band, so an id-keyed lookup at worst paints the wrong colour and
 * never the wrong ink polarity.
 *
 * Hue is dropped from the distance for near-greys, where the hue angle is numerical noise left
 * over from an 8-bit rounding rather than a colour anyone chose.
 */
function nearestPresetId(groundPk: number): PaletteId {
  const { h, s } = hslOf(groundPk);
  const lum = lumOf(groundPk);
  const hueWeight = s < 0.08 ? 0 : 1;
  let best = PRESET_POINTS[0];
  let bestD = Number.POSITIVE_INFINITY;
  for (const p of PRESET_POINTS) {
    const d =
      Math.abs(lum - p.lum) * 2 + (hueGap(h, p.h) / 180) * hueWeight + Math.abs(s - p.s) * 0.5;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best.id;
}

/* ── The engine ──────────────────────────────────────────────────────────────────────── */

/**
 * Turn a ground colour into a complete, legible palette.
 *
 * @param requestedHex `#RGB` or `#RRGGBB`, any case. Throws for anything else — an unparseable
 *   colour is a programming error at the call site, and returning a silent fallback would let a
 *   builder ship a picker that quietly ignores half of what it is given.
 * @param finish How the ground will be painted. It sets the gradient's span, and a wider span
 *   is a *stricter* contract, since every `allStops` pair is judged on both ends.
 *
 *   ⚠ Keyed by `Finish` and no longer by the pre-split `SurfaceStyle`, which carried spans for
 *   `grain` (0.07) and `pattern` (0.06) even though the renderer painted both on a FLAT ground.
 *   Those two entries were describing a finish the card never had. A derived — never a preset —
 *   palette that was saved as `pattern` therefore resolves a hair differently now, and correctly.
 */
export function derivePalette(requestedHex: string, finish: Finish): DerivedPalette {
  const requested = packHex(requestedHex);
  const ground = resolveGround(requested);
  /* One ray for the whole palette — see `Ground.h`. Every derived slot is found along it, which
     is what keeps a card in a single hue family instead of growing an accent nobody chose. */
  const { h, s, groundL } = ground;
  const stops = placeStops(ground, STOP_SPAN[finish]);
  const ink = ground.ink;

  /* inkSoft — the *furthest* colour from `ink` that still clears 4.5 on the worst stop.
     Furthest, not nearest, and measured as contrast against `ink` rather than as a distance in
     lightness: the two ink levels exist to be told apart, and the 7:1 headroom rule on `ink`
     exists precisely to leave room for this search to find something. A "smallest shift" search
     here would return a secondary indistinguishable from the primary and quietly delete the
     card's type hierarchy — the exact defect the headroom rule was written to prevent. */
  const inkSoftHit = furthestFromOnRay(
    h,
    s * INK_SOFT_SATURATION,
    0,
    1,
    ink,
    (pk) => worstOnStops(pk, stops) >= MIN_INK,
  );
  const inkSoft = inkSoftHit?.pk ?? ink;

  /* Everything below moves *toward* the ink pole and no further than it needs to. On a deep
     ground that means lighter, on a light ground darker — the direction the eye already reads
     as "raised off the surface". Searching the other side would sometimes find a nearer colour
     that satisfies the arithmetic and reads as a shadow. */
  const towardInkLo = ground.deep ? groundL : 0;
  const towardInkHi = ground.deep ? 1 : groundL;

  /* line — a hairline held to "visible at all" (1.2), not to 1.4.11's 3:1. The smallest shift
     that clears it, so a card never wears a heavy grey rule it does not need. */
  const lineHit = nearestOnRay(
    h,
    s * FURNITURE_SATURATION,
    towardInkLo,
    towardInkHi,
    groundL,
    (pk) => worstOnStops(pk, stops) >= MIN_HAIRLINE,
  );
  const line = lineHit?.pk ?? ink;

  /* buttonBg — the design target first, the search second. Deep grounds get a pale tint of their
     own hue and light grounds a deep one, which is the lever that stops all nine presets looking
     like one card with a different ground. The search then applies the smallest correction to
     that target which clears 1.4.11's 3:1 on the worse stop, so the look is chosen and the
     legality is proven. The pole of each ray always satisfies the predicate, so this cannot fail:
     white measures at least 7:1 on any legal deep stop, black at least 7.8:1 on any legal light
     one. */
  const buttonSat = ground.deep ? s * PALE_TINT_SATURATION : Math.min(1, s * DEEP_TINT_SATURATION);
  const buttonTarget = ground.deep ? PALE_TARGET_L : DEEP_TARGET_L;
  const buttonHit = nearestOnRay(h, buttonSat, towardInkLo, towardInkHi, buttonTarget, (pk) =>
    worstOnStops(pk, stops) >= MIN_BOUNDARY,
  );
  const buttonBg = buttonHit?.pk ?? (ground.deep ? 0xffffff : BLACK);
  const buttonInk = labelFor(buttonBg, h, s);

  /* buttonAlt — an outline button, which is what the wallet-pass references show and what keeps
     two stacked actions from both shouting. Its fill *is* the ground, so it measures 1:1 against
     the ground by definition and only the border can carry 1.4.11; `PALETTE_CONTRACT` accepts
     either, which is why the pair is a list. The border is the smallest shift toward the ink that
     reaches 3:1 on the worse stop — the same construction Onyx's `#6E7073` was authored by, and
     it lands on the same 3.05 measurement. */
  const borderHit = nearestOnRay(
    h,
    s * FURNITURE_SATURATION,
    towardInkLo,
    towardInkHi,
    groundL,
    (pk) => worstOnStops(pk, stops) >= MIN_BOUNDARY,
  );
  const buttonAltBorder = borderHit?.pk ?? buttonBg;

  /* canvasActionBg — a card action drawn on the **white app canvas**, not on the card. The
     palette's own ground is the natural fill and is what every deep palette uses; a light ground
     cannot, because a pale fill on a white canvas is a 1:1 button that renders as unstyled text.
     That shipped once, on the old Paper palette, which is why `PALETTE_CONTRACT` measures this
     fill against `APP_CANVAS` rather than against the card. The deep button is the fallback and
     clears it by construction; the search is the third line of defence. */
  const canvasActionBg = pickCanvasAction(ground, buttonBg);
  const canvasActionInk = labelFor(canvasActionBg, h, s);

  /* plateBorder — a QR plate is always opaque white, because many decoders reject an inverted
     symbol, so on a near-white ground it dissolves. Measured against the *lightest* stop, where
     a white plate is closest to vanishing; the midpoint would pass a card whose top end is
     nearly white. `null` on anything dark or saturated enough to frame the plate itself. */
  const lightestStop = lumOf(stops.from) >= lumOf(stops.to) ? stops.from : stops.to;
  const plateBorder =
    ratioOf(CANVAS, lightestStop) < PLATE_DISSOLVES_BELOW
      ? hexOf(
          nearestOnRay(h, s, 0, groundL, groundL, (pk) => ratioOf(pk, CANVAS) >= MIN_BOUNDARY)
            ?.pk ?? NEAR_BLACK,
        )
      : null;

  /* faceBorder — the same question one level out. It is `null` on all nine presets because the
     white Paper palette that needed it is gone, and its field comment says the slot stays
     because "the need is real for any future near-white ground". Free colour is that future: an
     owner may now pick one, and a white card on a white page is an absence, not a card. */
  const faceBorder =
    ratioOf(CANVAS, ground.pk) < FACE_DISSOLVES_BELOW
      ? hexOf(
          nearestOnRay(h, s, 0, groundL, groundL, (pk) => ratioOf(pk, CANVAS) >= MIN_BOUNDARY)
            ?.pk ?? NEAR_BLACK,
        )
      : null;

  const groundHex = hexOf(ground.pk);

  const palette: TemplatePalette = {
    id: nearestPresetId(ground.pk),
    /* The hex itself. A derived palette has no curated name and inventing one ("Deep Ocean")
       would be a label the owner did not choose sitting where a name they did choose belongs. */
    name: groundHex,
    ground: groundHex,
    gradientFrom: hexOf(stops.from),
    gradientTo: hexOf(stops.to),
    gradientAngle: GRADIENT_ANGLE,
    /* Single-zone. A second ground is a template composition decision, not a colour one, and
       every ink here is proven against one range of stops rather than two. */
    groundAlt: null,
    ink: hexOf(ink),
    inkSoft: hexOf(inkSoft),
    line: hexOf(line),
    buttonBg: hexOf(buttonBg),
    buttonInk: hexOf(buttonInk),
    buttonAltBg: groundHex,
    buttonAltInk: hexOf(ink),
    buttonAltBorder: hexOf(buttonAltBorder),
    canvasActionBg: hexOf(canvasActionBg),
    canvasActionInk: hexOf(canvasActionInk),
    faceBorder,
    plateBorder,
    markBg: hexOf(buttonBg),
    markInk: hexOf(buttonInk),
    /* ⚠ **Always null, and that is the correct answer rather than a gap.**
       The three sheet slots exist so a CURATED palette can state a paper and an accent that its
       ground does not imply — Ivory's cream and its two golds. A derived palette has exactly one
       input, the owner's hex, so there is nothing to derive a third colour *from*: inventing one
       would be picking a metal on their behalf. `null` routes each slot to its documented
       fallback — a 3% sheet and `canvasActionBg` for both accents — which is a complete, tested
       look, and one `PALETTE_CONTRACT` already proves for every hex this function can return. */
    sheet: null,
    accent: null,
    accentText: null,
  };

  return {
    palette,
    groundHex,
    clamped: ground.clamped,
    clampNote: ground.clamped ? clampNoteFor(ground.deep) : "",
  };
}

/**
 * The fill for an action drawn on the app canvas: the ground when it can be seen against white,
 * the card's own deep button when it cannot, and a searched darkening when neither works.
 *
 * Written as three ordered candidates rather than as one search because the first two are the
 * answers the presets give and reusing them keeps a derived card and a preset card looking like
 * the same product. The search only runs for grounds no preset covers.
 */
function pickCanvasAction(ground: Ground, buttonBg: number): number {
  if (ratioOf(ground.pk, CANVAS) >= MIN_BOUNDARY) return ground.pk;
  if (ratioOf(buttonBg, CANVAS) >= MIN_BOUNDARY) return buttonBg;
  /* `ground.groundL` rather than `hslOf(ground.pk).l`: the ray, not a re-measurement of a
     rounded sample of it. Same reason as `Ground.h`. */
  const hit = nearestOnRay(ground.h, ground.s, 0, ground.groundL, ground.groundL, (pk) =>
    ratioOf(pk, CANVAS) >= MIN_BOUNDARY,
  );
  return hit?.pk ?? NEAR_BLACK;
}
