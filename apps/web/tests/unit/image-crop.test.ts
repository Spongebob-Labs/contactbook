import { describe, expect, it } from "vitest";

import {
  type CropFrame,
  type CropSource,
  type CropTransform,
  MAX_SCALE,
  centre,
  clampOffset,
  coverTransform,
  displaySize,
  outputSize,
  panBy,
  sourceRect,
  zoomTo,
} from "@/lib/image-crop";

/**
 * THE CROP GEOMETRY — the arithmetic behind the image-crop dialog, pinned.
 *
 * `image-crop.ts` exists because `card-page.tsx` had to guess where a photograph's subject was
 * (`object-position: 50% 28%`) and guessed wrong on a real upload. The dialog replaces the guess
 * with the owner's own composition, and this module is the part of that dialog which can be
 * *objectively wrong*: everything visible is a consequence of these numbers.
 *
 * ## What this file is protecting
 *
 * One property dominates: **the frame is never allowed to show blank space.** A cropper that
 * lets the photograph slide off its own aperture ships a card with a white wedge down one side,
 * and the owner cannot tell whether they did that or the product is broken. The module upholds
 * it in exactly one place — {@link clampOffset} — and every other function routes through it.
 * That is a good design and a fragile one: a refactor that adds a mutation which forgets to
 * clamp, or that "simplifies" the inverted-range branch, breaks the whole control while every
 * individual function still looks correct. So the invariant is not tested once, it is tested as
 * a sweep across source aspects × scales × pan deltas, after the mutations compose.
 *
 * The second property is the one that only shows up on the saved image: {@link sourceRect} must
 * stay inside the source's own bounds and keep the frame's aspect. Canvas renders an
 * out-of-bounds source region as *transparent* rather than clamping to the edge, so a rectangle
 * that overhangs by a fraction of a pixel is a visible seam down one side of an otherwise
 * correct crop — and a rectangle whose ratio drifts from the frame's is a subtly stretched face.
 * Neither failure throws, and neither is visible in a unit test that only checks the happy path,
 * which is why both are asserted on every sample of the sweep.
 *
 * ## Conventions used here
 *
 * · `expectCovers` and `expectUsableSourceRect` carry the two invariants, so the sweep reads as
 *   a table of cases rather than a wall of inequalities. Both take a `where` label naming the
 *   aspect, scale and pan, so a red test says *which* case broke without a debugger.
 * · `EPS` is float insurance, not slack. On the axis that exactly covers the frame the offset is
 *   the difference of two products of the same ratio, so it can land a few ulps off zero; at
 *   1e-9 CSS pixels nothing is visible, and a genuine drift is orders of magnitude larger.
 *   (As written the module lands on exact zeros for every case below — the epsilon is there so
 *   that a legitimate future change to the arithmetic cannot fail this suite cosmetically.)
 */

/** Sub-picometre. Large enough to absorb float residue, far too small to hide a real gap. */
const EPS = 1e-9;

/**
 * The two apertures that actually exist in the product: the cover is `1 : COVER_RATIO.photo`
 * (0.7, see `card-page.tsx`) and the badge is square. A third, tall frame is included because
 * the module must not assume the frame is wider than it is high — nothing in the arithmetic
 * cares, and this is what proves it.
 */
const COVER_FRAME: CropFrame = { width: 420, height: 294 };
const BADGE_FRAME: CropFrame = { width: 96, height: 96 };
const TALL_FRAME: CropFrame = { width: 360, height: 640 };

const LANDSCAPE: CropSource = { width: 4000, height: 3000 };
const PORTRAIT: CropSource = { width: 1200, height: 1600 };
const SQUARE: CropSource = { width: 900, height: 900 };

/**
 * The sweep's source column. The first three are ordinary uploads; the rest are the ones that
 * break naive implementations — a panorama and a tower where one axis is twenty times the
 * other, a pair of primes that make every ratio non-terminating in binary, and the 3024×4032
 * an iPhone actually produces.
 */
const SOURCES: ReadonlyArray<{ name: string; source: CropSource }> = [
  { name: "landscape 4000x3000", source: LANDSCAPE },
  { name: "portrait 1200x1600", source: PORTRAIT },
  { name: "square 900x900", source: SQUARE },
  { name: "panorama 4000x200", source: { width: 4000, height: 200 } },
  { name: "tower 200x4000", source: { width: 200, height: 4000 } },
  { name: "awkward 1279x853", source: { width: 1279, height: 853 } },
  { name: "phone 3024x4032", source: { width: 3024, height: 4032 } },
];

const FRAMES: ReadonlyArray<{ name: string; frame: CropFrame }> = [
  { name: "cover 420x294", frame: COVER_FRAME },
  { name: "badge 96x96", frame: BADGE_FRAME },
  { name: "tall 360x640", frame: TALL_FRAME },
];

/** 1 and `MAX_SCALE` are the ends the slider can actually reach; the rest are in between. */
const SCALES: readonly number[] = [1, 1.0001, 1.5, 2.375, 3, MAX_SCALE];

/**
 * Pan deltas. The large ones are deliberately far past any legal offset: a drag does not stop at
 * the edge of the image, the *clamp* stops it, and a delta of a million frame pixels is the
 * cheapest way to assert that the clamp — not the gesture — is what holds the invariant.
 */
const PANS: ReadonlyArray<{ name: string; dx: number; dy: number }> = [
  { name: "still", dx: 0, dy: 0 },
  { name: "flung left", dx: -5_000, dy: 0 },
  { name: "flung right", dx: 5_000, dy: 0 },
  { name: "flung up", dx: 0, dy: -5_000 },
  { name: "flung down", dx: 0, dy: 5_000 },
  { name: "flung to the top-left corner", dx: -1_000_000, dy: -1_000_000 },
  { name: "flung to the bottom-right corner", dx: 1_000_000, dy: 1_000_000 },
  { name: "an ordinary drag", dx: -37.5, dy: 91.25 },
];

/**
 * THE INVARIANT. The displayed image's top-left is at or outside the frame's top-left, and its
 * bottom-right is at or outside the frame's bottom-right — i.e. the frame is entirely inside the
 * image, so every pixel of the aperture has photograph behind it.
 *
 * Each of the four assertions names the visible defect it prevents, because "expected -12 to be
 * less than or equal to 0" tells a future reader nothing about what the owner would have seen.
 */
function expectCovers(
  transform: CropTransform,
  source: CropSource,
  frame: CropFrame,
  where: string,
): void {
  const displayed = displaySize(source, frame, transform.scale);
  expect(transform.x, `${where}: blank strip down the LEFT of the frame`).toBeLessThanOrEqual(EPS);
  expect(transform.y, `${where}: blank strip across the TOP of the frame`).toBeLessThanOrEqual(EPS);
  expect(
    transform.x + displayed.width,
    `${where}: blank strip down the RIGHT of the frame`,
  ).toBeGreaterThanOrEqual(frame.width - EPS);
  expect(
    transform.y + displayed.height,
    `${where}: blank strip across the BOTTOM of the frame`,
  ).toBeGreaterThanOrEqual(frame.height - EPS);
}

/**
 * The other half: the rectangle handed to `drawImage` must be a real region of a real image.
 *
 * `sx`/`sy` below zero or `sx + sw` past the source's width are the transparent-seam case the
 * module's own comment warns about. `sw / sh` drifting from the frame's ratio is the stretch
 * case — the crop would be drawn into an output canvas of the frame's aspect, so any mismatch
 * is resampled into a squashed face rather than being caught as an error.
 */
function expectUsableSourceRect(
  transform: CropTransform,
  source: CropSource,
  frame: CropFrame,
  where: string,
): void {
  const { sx, sy, sw, sh } = sourceRect(transform, source, frame);

  expect(sw, `${where}: empty crop width — drawImage would draw nothing`).toBeGreaterThan(0);
  expect(sh, `${where}: empty crop height — drawImage would draw nothing`).toBeGreaterThan(0);
  expect(sx, `${where}: crop starts left of the source — transparent seam`).toBeGreaterThanOrEqual(
    0,
  );
  expect(sy, `${where}: crop starts above the source — transparent seam`).toBeGreaterThanOrEqual(0);
  expect(sx + sw, `${where}: crop overhangs the source's right edge`).toBeLessThanOrEqual(
    source.width + EPS,
  );
  expect(sy + sh, `${where}: crop overhangs the source's bottom edge`).toBeLessThanOrEqual(
    source.height + EPS,
  );
  expect(sw / sh, `${where}: crop ratio drifted from the frame's — output would stretch`).toBeCloseTo(
    frame.width / frame.height,
    9,
  );
}

/** Every number a caller can read back, for the degenerate-input checks. */
function allNumbers(
  transform: CropTransform,
  source: CropSource,
  frame: CropFrame,
): Record<string, number> {
  const displayed = displaySize(source, frame, transform.scale);
  const rect = sourceRect(transform, source, frame);
  const out = outputSize(frame, 1024);
  return {
    scale: transform.scale,
    x: transform.x,
    y: transform.y,
    displayWidth: displayed.width,
    displayHeight: displayed.height,
    sx: rect.sx,
    sy: rect.sy,
    sw: rect.sw,
    sh: rect.sh,
    outWidth: out.width,
    outHeight: out.height,
  };
}

function expectAllFinite(values: Record<string, number>, where: string): void {
  for (const [key, value] of Object.entries(values)) {
    expect(Number.isFinite(value), `${where}: ${key} is ${String(value)}`).toBe(true);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   1 — the cover-fit identity
   ───────────────────────────────────────────────────────────────────────────── */

describe("coverTransform is the crop the card already shows", () => {
  /**
   * The dialog must OPEN on the composition the card is displaying, or the owner's first
   * impression is that opening the cropper changed their cover. That is the whole reason `scale`
   * is a multiplier on the cover fit rather than on natural pixels.
   *
   * So the assertion is not "some legal crop" — it is the exact rectangle `object-fit: cover`
   * takes: the full extent of whichever source axis runs short against the frame, centred on the
   * other. The numbers are worked by hand from the frame ratio (0.7): a 4000-wide landscape into
   * a 1 : 0.7 frame keeps all 4000 columns and 4000 × 0.7 = 2800 rows, leaving (3000 − 2800) / 2
   * = 100 rows trimmed from the top and the same from the bottom.
   */
  it("takes object-fit's rectangle from a landscape source", () => {
    const rect = sourceRect(coverTransform(LANDSCAPE, COVER_FRAME), LANDSCAPE, COVER_FRAME);

    expect(rect.sx).toBeCloseTo(0, 9);
    expect(rect.sw).toBeCloseTo(LANDSCAPE.width, 9); // the short axis, whole
    expect(rect.sh).toBeCloseTo(2800, 9);
    expect(rect.sy).toBeCloseTo(100, 9); // centred: (3000 - 2800) / 2
    /* Symmetry is the part that proves "centred" rather than "anchored at 0". */
    expect(LANDSCAPE.height - (rect.sy + rect.sh)).toBeCloseTo(rect.sy, 9);
  });

  it("takes object-fit's rectangle from a portrait source", () => {
    const rect = sourceRect(coverTransform(PORTRAIT, COVER_FRAME), PORTRAIT, COVER_FRAME);

    expect(rect.sx).toBeCloseTo(0, 9);
    expect(rect.sw).toBeCloseTo(PORTRAIT.width, 9);
    expect(rect.sh).toBeCloseTo(840, 9); // 1200 × 0.7
    expect(rect.sy).toBeCloseTo(380, 9); // (1600 - 840) / 2
    expect(PORTRAIT.height - (rect.sy + rect.sh)).toBeCloseTo(rect.sy, 9);
  });

  /**
   * The same source against a frame that is *taller* than it is wide, which flips which axis is
   * the short one: now the full 3000 rows survive and the columns are trimmed symmetrically.
   * Without this case, an implementation that hard-coded "trim vertically" would pass above.
   */
  it("flips axes when the frame is the square badge rather than the wide cover", () => {
    const rect = sourceRect(coverTransform(LANDSCAPE, BADGE_FRAME), LANDSCAPE, BADGE_FRAME);

    expect(rect.sy).toBeCloseTo(0, 9);
    expect(rect.sh).toBeCloseTo(LANDSCAPE.height, 9);
    expect(rect.sw).toBeCloseTo(3000, 9);
    expect(rect.sx).toBeCloseTo(500, 9); // (4000 - 3000) / 2
    expect(LANDSCAPE.width - (rect.sx + rect.sw)).toBeCloseTo(rect.sx, 9);
  });

  /**
   * `scale: 1` has to MEAN something, and what it means is "exactly covers": one axis matches the
   * frame to the pixel and the other overhangs. If a refactor anchored scale to natural pixels
   * instead, the slider's left end would be a different fit for every upload — and this is the
   * assertion that would go red.
   */
  it("makes scale 1 mean exactly-covers for every source shape", () => {
    for (const { name, source } of SOURCES) {
      for (const { name: frameName, frame } of FRAMES) {
        const where = `${name} in ${frameName}`;
        const displayed = displaySize(source, frame, 1);

        expect(displayed.width, `${where}: narrower than the frame at scale 1`).toBeGreaterThanOrEqual(
          frame.width - EPS,
        );
        expect(displayed.height, `${where}: shorter than the frame at scale 1`).toBeGreaterThanOrEqual(
          frame.height - EPS,
        );
        /* Exactly one axis is flush — "cover", not "contain" and not "larger than needed". */
        const flush =
          Math.abs(displayed.width - frame.width) < EPS || Math.abs(displayed.height - frame.height) < EPS;
        expect(flush, `${where}: scale 1 is not a tight cover fit (${JSON.stringify(displayed)})`).toBe(
          true,
        );
        /* And the image is never distorted: the displayed box keeps the source's own ratio. */
        expect(displayed.width / displayed.height, `${where}: display ratio drifted`).toBeCloseTo(
          source.width / source.height,
          9,
        );
      }
    }
  });

  /** Scale is a plain multiplier on that fit — twice the scale is twice the displayed size. */
  it("scales the displayed size linearly from the cover fit", () => {
    const base = displaySize(LANDSCAPE, COVER_FRAME, 1);
    for (const scale of SCALES) {
      const displayed = displaySize(LANDSCAPE, COVER_FRAME, scale);
      expect(displayed.width, `scale=${scale}`).toBeCloseTo(base.width * scale, 9);
      expect(displayed.height, `scale=${scale}`).toBeCloseTo(base.height * scale, 9);
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
   2 & 3 & 4 — the sweep
   ───────────────────────────────────────────────────────────────────────────── */

describe("the frame never shows blank space", () => {
  /**
   * The sweep, one test per source aspect so a failure names the shape in its title.
   *
   * Each sample composes the two mutations in the order the dialog does — zoom, then drag — and
   * then checks both invariants. Composition is the point: `clampOffset` in isolation is easy to
   * get right, and the failures that reach production come from a mutation that produces a legal
   * offset for the OLD scale and is written back against the new one.
   *
   * The pan deltas are absurd on purpose (see PANS). A drag of a million pixels must land exactly
   * on the edge of the legal range, not one pixel past it.
   */
  for (const { name, source } of SOURCES) {
    it(`holds for ${name} at every scale, in every drag direction`, () => {
      for (const { name: frameName, frame } of FRAMES) {
        for (const scale of SCALES) {
          for (const { name: panName, dx, dy } of PANS) {
            const where = `${name} in ${frameName} @ scale ${scale}, ${panName} (${dx},${dy})`;

            const zoomed = zoomTo(coverTransform(source, frame), source, frame, scale);
            const panned = panBy(zoomed, source, frame, dx, dy);

            expectCovers(zoomed, source, frame, `${where} [after zoom]`);
            expectCovers(panned, source, frame, `${where} [after pan]`);
            expectUsableSourceRect(panned, source, frame, where);
          }
        }
      }
    });
  }

  /**
   * The same sweep run as a *sequence* rather than independent samples: drag, zoom in on a corner,
   * drag again, zoom out, drag again — each step fed the previous step's output. This is what a
   * real minute with the dialog looks like, and it is where an error that is within tolerance per
   * step accumulates into a visible gap.
   */
  it("survives a long chain of alternating zooms and drags", () => {
    for (const { name, source } of SOURCES) {
      for (const { name: frameName, frame } of FRAMES) {
        let transform = coverTransform(source, frame);
        const steps: Array<[string, () => CropTransform]> = [
          ["drag up-left", () => panBy(transform, source, frame, -900, -900)],
          ["zoom to 2.75 on the top-left corner", () => zoomTo(transform, source, frame, 2.75, { x: 0, y: 0 })],
          ["drag down-right", () => panBy(transform, source, frame, 4_000, 4_000)],
          ["zoom to MAX on the bottom-right corner", () =>
            zoomTo(transform, source, frame, MAX_SCALE, { x: frame.width, y: frame.height })],
          ["drag right", () => panBy(transform, source, frame, 12_345, 0)],
          ["zoom back to 1.25", () => zoomTo(transform, source, frame, 1.25)],
          ["drag up", () => panBy(transform, source, frame, 0, -8_000)],
          ["zoom back to 1", () => zoomTo(transform, source, frame, 1)],
        ];

        for (const [step, apply] of steps) {
          transform = apply();
          const where = `${name} in ${frameName}: after "${step}"`;
          expectCovers(transform, source, frame, where);
          expectUsableSourceRect(transform, source, frame, where);
        }
      }
    }
  });

  /**
   * `clampOffset` must be idempotent — clamping an already-legal transform must not move it.
   *
   * This is the property that lets every mutation route through it without the callers tracking
   * whether they have clamped already. If it ever stopped being true, a transform would creep on
   * every gesture, and the drift would only be visible after a long composition session.
   */
  it("clamps to a fixed point, so repeated clamping cannot creep", () => {
    for (const { name, source } of SOURCES) {
      for (const { name: frameName, frame } of FRAMES) {
        for (const scale of SCALES) {
          const once = panBy(
            zoomTo(coverTransform(source, frame), source, frame, scale),
            source,
            frame,
            -2_500,
            1_750,
          );
          const twice = clampOffset(once, source, frame);
          expect(twice, `${name} in ${frameName} @ scale ${scale}: clamping moved a legal transform`).toEqual(
            once,
          );
        }
      }
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
   4 (continued) — what the crop rectangle means
   ───────────────────────────────────────────────────────────────────────────── */

describe("sourceRect converts a screen composition into source pixels", () => {
  /**
   * The dialog's own pixel size must never reach the output. Two frames of the same ratio but
   * wildly different sizes — a 420-wide dialog and a 1260-wide one — describe the same crop, so
   * they must produce the same source rectangle. If the frame's absolute size leaked in, an owner
   * who composed on a phone and one who composed on a desktop would get different covers from the
   * same gesture.
   */
  it("depends on the frame's ratio, never on its pixel size", () => {
    const small: CropFrame = { width: 420, height: 294 };
    const large: CropFrame = { width: 1260, height: 882 };

    const fromSmall = sourceRect(
      panBy(zoomTo(coverTransform(LANDSCAPE, small), LANDSCAPE, small, 2), LANDSCAPE, small, -120, -60),
      LANDSCAPE,
      small,
    );
    /* The same gesture at 3× the dialog size is 3× the pixels. */
    const fromLarge = sourceRect(
      panBy(zoomTo(coverTransform(LANDSCAPE, large), LANDSCAPE, large, 2), LANDSCAPE, large, -360, -180),
      LANDSCAPE,
      large,
    );

    expect(fromLarge.sx).toBeCloseTo(fromSmall.sx, 6);
    expect(fromLarge.sy).toBeCloseTo(fromSmall.sy, 6);
    expect(fromLarge.sw).toBeCloseTo(fromSmall.sw, 6);
    expect(fromLarge.sh).toBeCloseTo(fromSmall.sh, 6);
  });

  /**
   * Zooming in shows LESS of the photograph, in exact proportion: the crop's dimensions are
   * inversely proportional to scale. This is the sanity check that the scale is applied in the
   * right direction — an inverted sign still produces a legal, in-bounds rectangle, so neither
   * the invariant sweep nor the aspect check would catch it, but the owner would see the picture
   * pull away as they zoom in.
   */
  it("takes a proportionally smaller bite of the source as the scale rises", () => {
    for (const { name, source } of SOURCES) {
      const frame = COVER_FRAME;
      const atOne = sourceRect(coverTransform(source, frame), source, frame);

      for (const scale of SCALES) {
        const rect = sourceRect(zoomTo(coverTransform(source, frame), source, frame, scale), source, frame);
        expect(rect.sw * scale, `${name} @ scale ${scale}: crop width is not 1/scale of the cover crop`).toBeCloseTo(
          atOne.sw,
          6,
        );
        expect(rect.sh * scale, `${name} @ scale ${scale}: crop height is not 1/scale of the cover crop`).toBeCloseTo(
          atOne.sh,
          6,
        );
      }
    }
  });
  /**
   * The belt-and-braces clamp inside `sourceRect`, exercised the only way it can be: by handing it
   * a transform the invariant should have made impossible.
   *
   * ⚠ This is not a hypothetical. The module's own comment explains that float drift at the
   * extremes of a drag can put `sx + sw` a hair past the edge — and Canvas draws an out-of-bounds
   * source region as TRANSPARENT rather than clamping it, so the result is a transparent seam down
   * one side of an otherwise perfect crop, on one photograph in a hundred, which is the worst kind
   * of bug to be handed. It is also the clamp a refactor is most likely to delete as dead code,
   * because every transform the module itself produces is already legal: deleting it breaks
   * nothing that the rest of this file can see, which is exactly why this test exists.
   */
  it("refuses to hand drawImage a rectangle outside the source, even from an illegal transform", () => {
    const illegal: ReadonlyArray<{ name: string; transform: CropTransform }> = [
      { name: "positive offset (image slid off to the right)", transform: { scale: 1, x: 5, y: 5 } },
      { name: "offset far past the left bound", transform: { scale: 1, x: -100_000, y: -100_000 } },
      { name: "a hair past the bound, as float drift leaves it", transform: { scale: 1, x: 1e-7, y: -21.000000001 } },
    ];

    for (const { name, transform } of illegal) {
      const rect = sourceRect(transform, LANDSCAPE, COVER_FRAME);
      expect(rect.sx, `${name}: sx left of the source — transparent seam`).toBeGreaterThanOrEqual(0);
      expect(rect.sy, `${name}: sy above the source — transparent seam`).toBeGreaterThanOrEqual(0);
      expect(rect.sx + rect.sw, `${name}: overhangs the source's right edge`).toBeLessThanOrEqual(
        LANDSCAPE.width,
      );
      expect(rect.sy + rect.sh, `${name}: overhangs the source's bottom edge`).toBeLessThanOrEqual(
        LANDSCAPE.height,
      );
      expect(rect.sw, `${name}: empty crop`).toBeGreaterThan(0);
      expect(rect.sh, `${name}: empty crop`).toBeGreaterThan(0);
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
   5 — anchored zoom
   ───────────────────────────────────────────────────────────────────────────── */

/** Where a frame point sits within the displayed image, 0–1 on each axis. */
function imagePointUnder(
  anchor: { x: number; y: number },
  transform: CropTransform,
  source: CropSource,
  frame: CropFrame,
): { u: number; v: number } {
  const displayed = displaySize(source, frame, transform.scale);
  return { u: (anchor.x - transform.x) / displayed.width, v: (anchor.y - transform.y) / displayed.height };
}

describe("zoomTo grows the picture around a fixed point", () => {
  /**
   * ⚠ The defect: scaling the image and leaving the offset alone. The picture then slides toward
   * a corner as it grows, so composing becomes zoom, drag back, zoom, drag back — the control
   * feels like two fighting sliders instead of a camera. It is also invisible to a test that only
   * checks the invariant, because a drifting transform is still perfectly legal.
   *
   * The assertion is the definition of "anchored": whatever bit of the photograph was under the
   * owner's fingertip is still under it afterwards. Measured in normalised image space, because
   * that is the only coordinate system that is comparable across two different scales.
   */
  it("keeps the image point under an explicit anchor exactly where it was", () => {
    const anchors = [
      { x: 0, y: 0 },
      { x: 17, y: 233 },
      { x: COVER_FRAME.width, y: COVER_FRAME.height },
      { x: COVER_FRAME.width / 2, y: 3 },
    ];

    for (const { name, source } of SOURCES) {
      for (const anchor of anchors) {
        for (const scale of [1.5, 2.375, MAX_SCALE]) {
          const before = coverTransform(source, COVER_FRAME);
          const after = zoomTo(before, source, COVER_FRAME, scale, anchor);

          const was = imagePointUnder(anchor, before, source, COVER_FRAME);
          const is = imagePointUnder(anchor, after, source, COVER_FRAME);
          const where = `${name} @ scale ${scale}, anchor (${anchor.x},${anchor.y})`;

          expect(is.u, `${where}: the picture slid horizontally under the anchor`).toBeCloseTo(was.u, 9);
          expect(is.v, `${where}: the picture slid vertically under the anchor`).toBeCloseTo(was.v, 9);
        }
      }
    }
  });

  /** The same, starting from an already zoomed and dragged composition rather than from the fit. */
  it("stays anchored when zooming again from a composition in progress", () => {
    const start = panBy(
      zoomTo(coverTransform(PORTRAIT, TALL_FRAME), PORTRAIT, TALL_FRAME, 1.8, { x: 40, y: 40 }),
      PORTRAIT,
      TALL_FRAME,
      -260,
      -410,
    );
    const anchor = { x: 210, y: 470 };
    const after = zoomTo(start, PORTRAIT, TALL_FRAME, 3.2, anchor);

    const was = imagePointUnder(anchor, start, PORTRAIT, TALL_FRAME);
    const is = imagePointUnder(anchor, after, PORTRAIT, TALL_FRAME);
    expect(is.u).toBeCloseTo(was.u, 9);
    expect(is.v).toBeCloseTo(was.v, 9);
  });

  /**
   * The slider has no fingertip, so its zoom has to anchor somewhere sensible, and the frame's
   * centre is the only choice that does not appear to shove the picture sideways. This pins the
   * default to that, and the second half proves the assertion is not vacuous: an off-centre
   * anchor genuinely produces a different transform, so the first expectation is testing the
   * default rather than testing that anchoring does nothing.
   */
  it("defaults its anchor to the centre of the frame", () => {
    const start = coverTransform(LANDSCAPE, COVER_FRAME);
    const centred = { x: COVER_FRAME.width / 2, y: COVER_FRAME.height / 2 };

    expect(zoomTo(start, LANDSCAPE, COVER_FRAME, 2.3)).toEqual(
      zoomTo(start, LANDSCAPE, COVER_FRAME, 2.3, centred),
    );
    expect(zoomTo(start, LANDSCAPE, COVER_FRAME, 2.3)).not.toEqual(
      zoomTo(start, LANDSCAPE, COVER_FRAME, 2.3, { x: 0, y: 0 }),
    );
  });

  /**
   * `MAX_SCALE` exists because a 1280px source turns to porridge past it, and the floor exists
   * because below 1 the image no longer covers the frame — the invariant would be unreachable, not
   * merely violated. Both ends are clamped rather than rejected, so a slider that overshoots or a
   * trackpad pinch with momentum cannot put the dialog into an illegal state.
   */
  it("clamps the scale to [1, MAX_SCALE] rather than trusting its caller", () => {
    const start = coverTransform(LANDSCAPE, COVER_FRAME);

    expect(zoomTo(start, LANDSCAPE, COVER_FRAME, 0.999).scale).toBe(1);
    expect(zoomTo(start, LANDSCAPE, COVER_FRAME, 0).scale).toBe(1);
    expect(zoomTo(start, LANDSCAPE, COVER_FRAME, -42).scale).toBe(1);
    expect(zoomTo(start, LANDSCAPE, COVER_FRAME, MAX_SCALE + 0.001).scale).toBe(MAX_SCALE);
    expect(zoomTo(start, LANDSCAPE, COVER_FRAME, 1_000).scale).toBe(MAX_SCALE);
    expect(zoomTo(start, LANDSCAPE, COVER_FRAME, Number.POSITIVE_INFINITY).scale).toBe(MAX_SCALE);

    /* And the clamped result is a legal composition, not just a legal number. */
    expectCovers(zoomTo(start, LANDSCAPE, COVER_FRAME, 1_000), LANDSCAPE, COVER_FRAME, "scale 1000");
    expectCovers(zoomTo(start, LANDSCAPE, COVER_FRAME, -42), LANDSCAPE, COVER_FRAME, "scale -42");
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
   7 — the round trip
   ───────────────────────────────────────────────────────────────────────────── */

describe("zooming in and back out lands somewhere legal", () => {
  /**
   * The owner's undo is the slider: zoom in, dislike it, drag the slider back to 1. What they get
   * back need not be byte-identical to where they started — they dragged in between, and honouring
   * that drag is correct — but it must be a *legal* composition at scale 1, which for scale 1
   * means the full extent of the short axis is still in frame. If the offsets drifted out of
   * range, the clamp would silently swallow the difference and the picture would jump.
   */
  it("returns to a full-extent cover crop, slid along the long axis only", () => {
    for (const { name, source } of SOURCES) {
      for (const { name: frameName, frame } of FRAMES) {
        const where = `${name} in ${frameName}`;

        const composed = panBy(
          zoomTo(coverTransform(source, frame), source, frame, MAX_SCALE, { x: 0, y: 0 }),
          source,
          frame,
          -50_000,
          -50_000,
        );
        const back = zoomTo(composed, source, frame, 1);

        expect(back.scale, `${where}: did not come back to 1`).toBe(1);
        expectCovers(back, source, frame, `${where} [back at 1]`);
        expectUsableSourceRect(back, source, frame, `${where} [back at 1]`);

        /* Legal, not merely clamped-on-read: clamping it again is a no-op. */
        expect(clampOffset(back, source, frame), `${where}: drifted out of the legal range`).toEqual(back);

        /* At scale 1 one axis is flush with the frame, so its crop keeps the source's whole extent. */
        const rect = sourceRect(back, source, frame);
        const wholeAxis =
          Math.abs(rect.sw - source.width) < 1e-6 || Math.abs(rect.sh - source.height) < 1e-6;
        expect(wholeAxis, `${where}: scale 1 no longer shows a whole source axis (${JSON.stringify(rect)})`).toBe(
          true,
        );

        /* The offsets sit inside [frame − displayed, 0] on both axes — the definition of in-range. */
        const displayed = displaySize(source, frame, 1);
        expect(back.x, `${where}: x below the legal minimum`).toBeGreaterThanOrEqual(
          frame.width - displayed.width - EPS,
        );
        expect(back.y, `${where}: y below the legal minimum`).toBeGreaterThanOrEqual(
          frame.height - displayed.height - EPS,
        );
      }
    }
  });

  /**
   * With no drag in between, the round trip is exactly the identity: zoom in on the centre, zoom
   * back out on the centre, and the composition is the cover fit again — which is what makes the
   * slider feel reversible rather than lossy.
   */
  it("is exactly the identity when nothing is dragged in between", () => {
    for (const { name, source } of SOURCES) {
      const start = coverTransform(source, COVER_FRAME);
      const back = zoomTo(zoomTo(start, source, COVER_FRAME, MAX_SCALE), source, COVER_FRAME, 1);

      expect(back.scale, `${name}`).toBe(1);
      expect(back.x, `${name}: drifted horizontally over a centred zoom round trip`).toBeCloseTo(start.x, 6);
      expect(back.y, `${name}: drifted vertically over a centred zoom round trip`).toBeCloseTo(start.y, 6);
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
   8 — degenerate inputs
   ───────────────────────────────────────────────────────────────────────────── */

describe("degenerate inputs stay finite", () => {
  /**
   * ⚠ This path is real, not defensive theatre. An `<img>` reports `naturalWidth === 0` until it
   * decodes, and a dialog that measures its aperture on first paint can read 0 before layout
   * settles — so the very first transform the component computes may well be built from zeroes.
   *
   * What must not happen is a `NaN` entering the transform: React will happily render
   * `translate(NaN px, NaN px)`, the state persists once the image decodes, and the owner is left
   * with a permanently blank cropper that no amount of dragging fixes. A NaN never throws, never
   * logs, and never recovers on its own — which is exactly why it is asserted rather than assumed.
   */
  const degenerates: ReadonlyArray<{ name: string; source: CropSource; frame: CropFrame }> = [
    { name: "image not decoded yet (0x0)", source: { width: 0, height: 0 }, frame: COVER_FRAME },
    { name: "zero-width source", source: { width: 0, height: 2_000 }, frame: COVER_FRAME },
    { name: "zero-height source", source: { width: 2_000, height: 0 }, frame: COVER_FRAME },
    { name: "frame measured before layout (0 height)", source: LANDSCAPE, frame: { width: 420, height: 0 } },
    { name: "frame measured before layout (0 width)", source: LANDSCAPE, frame: { width: 0, height: 294 } },
    { name: "frame entirely unmeasured", source: LANDSCAPE, frame: { width: 0, height: 0 } },
    { name: "a 1x1 source", source: { width: 1, height: 1 }, frame: COVER_FRAME },
    { name: "negative nonsense", source: { width: -800, height: -600 }, frame: COVER_FRAME },
  ];

  for (const { name, source, frame } of degenerates) {
    it(`produces no NaN or Infinity for ${name}`, () => {
      const cover = coverTransform(source, frame);
      expectAllFinite(allNumbers(cover, source, frame), `${name} [cover]`);

      const zoomed = zoomTo(cover, source, frame, 2.5, { x: 10, y: 10 });
      expectAllFinite(allNumbers(zoomed, source, frame), `${name} [zoomed]`);

      const panned = panBy(zoomed, source, frame, -9_999, 9_999);
      expectAllFinite(allNumbers(panned, source, frame), `${name} [panned]`);

      const recentred = centre(panned, source, frame);
      expectAllFinite(allNumbers(recentred, source, frame), `${name} [recentred]`);

      const reclamped = clampOffset(recentred, source, frame);
      expectAllFinite(allNumbers(reclamped, source, frame), `${name} [reclamped]`);
    });
  }

  /**
   * A 1×1 source is degenerate in size but NOT in kind — it is a real image, so the full contract
   * still applies to it. It is here because it is the smallest input where the crop rectangle is a
   * fraction of a pixel, which is where an implementation that rounded to integers somewhere would
   * produce a zero-width rectangle and `drawImage` would silently draw nothing.
   */
  it("still upholds both invariants for a 1x1 source", () => {
    const source: CropSource = { width: 1, height: 1 };
    for (const { name: frameName, frame } of FRAMES) {
      for (const scale of SCALES) {
        const where = `1x1 in ${frameName} @ scale ${scale}`;
        const transform = panBy(
          zoomTo(coverTransform(source, frame), source, frame, scale),
          source,
          frame,
          -500,
          -500,
        );
        expectCovers(transform, source, frame, where);
        expectUsableSourceRect(transform, source, frame, where);
      }
    }
  });

  /**
   * When the image cannot cover the frame — only reachable through a degenerate source — the
   * documented behaviour is to CENTRE rather than clamp to a bound that sits behind its own
   * opposite. Pinning it matters because the naive `Math.min(0, Math.max(min, value))` returns
   * `min` (a positive number) in that case, which pins the useless image to the bottom-right
   * corner instead of the middle, and looks like a layout bug rather than a missing image.
   */
  it("centres, rather than corner-pinning, when the image cannot cover the frame", () => {
    const source: CropSource = { width: 0, height: 0 };
    const clamped = clampOffset({ scale: 1, x: -9_999, y: 9_999 }, source, COVER_FRAME);

    expect(clamped.x).toBe(COVER_FRAME.width / 2);
    expect(clamped.y).toBe(COVER_FRAME.height / 2);
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
   9 — the output canvas
   ───────────────────────────────────────────────────────────────────────────── */

describe("outputSize caps the long edge without changing the shape", () => {
  /**
   * ⚠ The cap is a storage constraint, not an aesthetic one. The crop is saved as a data URL, in
   * `localStorage` for a cover — a ~5MB budget shared with everything else the app keeps there.
   * An uncapped 4032px phone photograph base64s to several megabytes and throws
   * `QuotaExceededError` on save, which reaches the owner as a cover that silently fails to
   * persist. So the long edge must be the cap exactly, never "up to" it.
   */
  it("makes the long edge exactly the cap", () => {
    for (const { name, frame } of FRAMES) {
      for (const maxEdge of [64, 512, 1024, 1600]) {
        const out = outputSize(frame, maxEdge);
        expect(Math.max(out.width, out.height), `${name} @ maxEdge ${maxEdge}`).toBe(maxEdge);
      }
    }
  });

  /**
   * And the output has to keep the frame's ratio, because the crop drawn into it was computed for
   * that ratio — a mismatch here stretches every saved image by exactly the amount of the drift.
   * The tolerance is one pixel on the short edge: the dimensions are rounded to whole device
   * pixels, and half a pixel of rounding on each is the most that can survive.
   */
  it("keeps the frame's aspect to within the rounding of one pixel", () => {
    for (const { name, frame } of FRAMES) {
      for (const maxEdge of [64, 512, 1024, 1600]) {
        const out = outputSize(frame, maxEdge);
        const where = `${name} @ maxEdge ${maxEdge}`;
        const wanted = frame.width / frame.height;
        const tolerance = wanted / Math.min(out.width, out.height); // ±0.5px on the short edge
        expect(out.width / out.height, where).toBeCloseTo(wanted, 0);
        expect(Math.abs(out.width / out.height - wanted), `${where}: stretched beyond rounding`).toBeLessThanOrEqual(
          tolerance,
        );
        expect(Number.isInteger(out.width), `${where}: non-integer canvas width`).toBe(true);
        expect(Number.isInteger(out.height), `${where}: non-integer canvas height`).toBe(true);
      }
    }
  });

  /** The known frames, pinned to literals so the cap is not merely self-consistent. */
  it("pins the two apertures the product actually uses", () => {
    expect(outputSize(COVER_FRAME, 1024)).toEqual({ width: 1024, height: 717 }); // 294/420 × 1024
    expect(outputSize(BADGE_FRAME, 512)).toEqual({ width: 512, height: 512 });
  });

  /**
   * A canvas of zero width throws `IndexSizeError` on `getContext` in some browsers and draws
   * nothing in the rest, so an extreme frame ratio must still round up to at least one pixel
   * rather than down to none.
   */
  it("never returns a zero-pixel canvas, however extreme the frame", () => {
    for (const frame of [{ width: 1, height: 1_000 }, { width: 1_000, height: 1 }, { width: 3, height: 5_000 }]) {
      const out = outputSize(frame, 1024);
      expect(out.width, `${frame.width}x${frame.height}`).toBeGreaterThanOrEqual(1);
      expect(out.height, `${frame.width}x${frame.height}`).toBeGreaterThanOrEqual(1);
    }
  });

  /** The unmeasured-frame guard: a square at the cap, and above all a finite, positive size. */
  it("falls back to a square at the cap when the frame has not been measured", () => {
    expect(outputSize({ width: 0, height: 0 }, 800)).toEqual({ width: 800, height: 800 });
    expect(outputSize({ width: 420, height: 0 }, 800)).toEqual({ width: 800, height: 800 });
  });
});
