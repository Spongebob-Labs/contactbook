import { expect, test, type Page } from "@playwright/test";

import { MAX_PLATE_RADIUS_PX, MIN_MODULE_CONTRAST } from "@/card/qr-geometry";
import { TEMPLATE_LIST } from "@/card/templates";
import { FIXTURE_DB } from "@/fixtures";

import { PROJECT_VIEWPORT, screenshotElement } from "../helpers/e2e";
import { contrastBetween, parseColor, pixelAt, readPng, relativeLuminance, type Rgb } from "../helpers/pixels";
import { gotoCardFace } from "../helpers/qr-surface";

/**
 * **QR-T2 — the plate is opaque, unblurred, unimaged and un-inverted** (spec §8A.3, §8A.7;
 * AC-09(c), AC-09(d); §11 E-26, E-27).
 *
 * ## ⚠ THE SURFACE MOVED. NOTHING WAS DROPPED — and this file got *stronger*.
 *
 * These tests addressed `/c/{slug}` and sampled the plate on the scan page. That page carries no
 * QR now (see the head of `src/card/card-page.tsx`), so they address `/cards/{id}` and sample the
 * plate on the **share face**.
 *
 * That is a better test of the thing this file exists to test. The scan page put every plate on
 * the same two grounds — `--canvas` under a `band` header, the palette under a `solid` one — so
 * the cross-template comparison at the bottom, whose entire argument is *"an opaque plate
 * renders the identical RGB triple over very different grounds"*, was comparing a white plate
 * against near-identical near-white backdrops. The face paints the plate directly on the card's
 * **palette ground**, so the same comparison now runs over Sapphire's deep blue and
 * Periwinkle's — grounds that a translucent plate could not possibly survive unchanged.
 *
 * §8A.1's whole finding was that a bare QR dies on a saturated or gradient ground. The plate is
 * the answer to that, and this is now the surface where the answer is actually load-bearing.
 *
 * ## What this is really defending
 * §8A.1 measured the six reference templates against a bare QR and four of the six destroy
 * one outright — Lane's magenta→purple→blue mesh being *"the most hostile: chroma plus
 * gradient defeats binarisation"*. The plate is the entire answer to that, and it only works
 * if it is **solid**. A designer reaching for a frosted panel produces a card that looks
 * right on screen and, per §6.8 and E-27, **vanishes from the PNG export**, because
 * `backdrop-filter` does not rasterise in `html-to-image`.
 *
 * ## Three layers of assertion, because computed style alone is not enough
 * 1. **Computed style on the plate** — alpha, `background-image`, `backdrop-filter`, radius.
 *    This is what §8A.7 names, and it catches a template that authored the plate wrongly.
 * 2. **Computed style on every ancestor up to `[data-card-root]`** — `opacity`, `filter`,
 *    `mix-blend-mode`, `backdrop-filter`. A plate declared `#FFFFFF` inside a wrapper at
 *    `opacity: 0.9` is a translucent plate, and reading only the plate would call it opaque.
 * 3. **Rendered pixels** — the colour that actually reached the screen. This is the layer
 *    that cannot be talked around.
 *
 * ## ⚠ The cross-template test is the one that genuinely proves opacity
 * A single template's plate sampling as white proves nothing: white-over-white is white
 * whatever the alpha. The eight templates put eight very different grounds behind the same
 * plate — Ledger's `--canvas`, Terminal's dark ink, Marquee's high-chroma mesh, Atrium's and
 * Passage's photographs. **An opaque plate renders the identical RGB triple on all eight; a
 * translucent one cannot.** That test is at the bottom of this file and it is the reason the
 * file collects per-template samples rather than asserting each in isolation.
 */

/** Sampled pixels must land on the token exactly; 2/255 is PNG quantisation, not latitude. */
const CHANNEL_TOLERANCE = 2;

const CARDS = TEMPLATE_LIST.map((template) => {
  const card = FIXTURE_DB.cards.find(
    (candidate) => candidate.templateId === template.id && candidate.fieldIds.length > 0,
  );
  if (card === undefined) {
    throw new Error(`no fixture card maps template "${template.id}" (spec §10.3)`);
  }
  return { template, card };
});

/**
 * Resolve a design token to the exact triple `getComputedStyle` reports for it.
 *
 * Painting a probe with `var(--qr-plate)` and reading it back measures the value that
 * actually reached the page, rather than the one written in `tokens.css` (F-01 forbids the
 * literal here anyway).
 */
async function tokenColour(page: Page, token: string): Promise<Rgb> {
  const value = await page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.cssText = `position:absolute;left:-9999px;top:0;background-color:var(${name})`;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return resolved;
  }, token);
  return parseColor(value);
}

function channelsClose(a: Rgb, b: Rgb, tolerance = CHANNEL_TOLERANCE): boolean {
  return (
    Math.abs(a.r - b.r) <= tolerance &&
    Math.abs(a.g - b.g) <= tolerance &&
    Math.abs(a.b - b.b) <= tolerance
  );
}

/** The alpha component of a computed `rgb()` / `rgba()` string. Absent means opaque. */
function alphaOf(value: string): number {
  const match = /^rgba?\([^)]*?,\s*([\d.]+)\s*\)$/i.exec(value.trim());
  if (match === null) return 1;
  const parts = value.replace(/^rgba?\(|\)$/gi, "").split(",");
  return parts.length === 4 ? Number(parts[3]) : 1;
}

interface PlateSample {
  template: string;
  quietZone: Rgb;
  darkestModule: Rgb;
  measuredContrast: number;
}

/**
 * Cross-test state: each per-template test pushes what it measured, and the final test compares
 * all eight. That only works if they run in the same worker.
 *
 * `playwright.config.ts` sets `fullyParallel: true`, which distributes the tests in a file
 * across workers — so the aggregate test would see whatever subset landed in its own worker and
 * fail on a count mismatch, intermittently and for reasons that look like a product bug. Serial
 * mode is what makes the comparison meaningful rather than lucky.
 */
test.describe.configure({ mode: "serial" });

const samples: PlateSample[] = [];

for (const { template, card } of CARDS) {
  test(`QR-T2 · ${template.id} · the plate is solid, opaque and never inverted`, async ({
    page,
  }, testInfo) => {
    const viewport = PROJECT_VIEWPORT[testInfo.project.name];
    await gotoCardFace(page, card);

    const plate = page.locator("[data-qr-plate]");
    await expect(plate).toHaveCount(1);

    /* ── layer 1: the plate's own computed style (AC-09(c)) ─────────────────────── */
    const style = await plate.evaluate((node) => {
      const s = getComputedStyle(node);
      return {
        backgroundColor: s.backgroundColor,
        backgroundImage: s.backgroundImage,
        backdropFilter: s.backdropFilter,
        // The prefixed alias is not on the typed interface, so it is read by name. An
        // engine that does not implement it at all answers "" — which is still "no blur".
        webkitBackdropFilter: s.getPropertyValue("-webkit-backdrop-filter"),
        opacity: s.opacity,
        filter: s.filter,
        mixBlendMode: s.mixBlendMode,
        radii: [
          s.borderTopLeftRadius,
          s.borderTopRightRadius,
          s.borderBottomRightRadius,
          s.borderBottomLeftRadius,
        ],
      };
    });

    expect(alphaOf(style.backgroundColor), "plate background alpha (E-26)").toBe(1);
    expect(style.backgroundImage, "plate background-image (E-26)").toBe("none");
    expect(style.backdropFilter, "plate backdrop-filter (E-27)").toBe("none");
    expect(
      ["none", ""],
      "plate -webkit-backdrop-filter (E-27)",
    ).toContain(style.webkitBackdropFilter);
    expect(style.opacity).toBe("1");
    expect(style.filter).toBe("none");
    expect(style.mixBlendMode).toBe("normal");
    for (const radius of style.radii) {
      expect(Number.parseFloat(radius)).toBeLessThanOrEqual(MAX_PLATE_RADIUS_PX);
    }

    /* ── layer 2: nothing between the plate and the card root composites it away ── */
    const ancestors = await plate.evaluate((node) => {
      const rows: {
        tag: string;
        opacity: string;
        filter: string;
        backdropFilter: string;
        mixBlendMode: string;
      }[] = [];
      let el: HTMLElement | null = node.parentElement;
      while (el !== null && el.closest("[data-card-root]") !== null) {
        const s = getComputedStyle(el);
        rows.push({
          tag: el.tagName,
          opacity: s.opacity,
          filter: s.filter,
          backdropFilter: s.backdropFilter,
          mixBlendMode: s.mixBlendMode,
        });
        el = el.parentElement;
      }
      return rows;
    });
    expect(ancestors.length, "the plate must sit inside the card root").toBeGreaterThan(0);
    for (const ancestor of ancestors) {
      expect(ancestor.opacity, `${ancestor.tag} opacity above the plate`).toBe("1");
      expect(ancestor.filter, `${ancestor.tag} filter above the plate`).toBe("none");
      expect(ancestor.backdropFilter, `${ancestor.tag} backdrop-filter above the plate`).toBe(
        "none",
      );
      expect(ancestor.mixBlendMode, `${ancestor.tag} mix-blend-mode above the plate`).toBe(
        "normal",
      );
    }

    /* ── AC-09(d): computed contrast, and the never-inverted rule ───────────────── */
    const moduleFill = await page
      .locator("[data-qr-symbol] path")
      .first()
      .evaluate((node) => getComputedStyle(node).fill);

    const plateColour = parseColor(style.backgroundColor);
    const moduleColour = parseColor(moduleFill);
    const declared = contrastBetween(plateColour, moduleColour);
    expect(declared, `declared module/plate contrast on ${template.id}`).toBeGreaterThanOrEqual(
      MIN_MODULE_CONTRAST,
    );
    expect(
      relativeLuminance(plateColour),
      "the plate must be lighter than the modules — many scanners reject an inverted symbol",
    ).toBeGreaterThan(relativeLuminance(moduleColour));

    /* And the two are the tokens §8A.3 names, not a look-alike pair a template invented. */
    expect(channelsClose(plateColour, await tokenColour(page, "--qr-plate"), 0)).toBe(true);
    expect(channelsClose(moduleColour, await tokenColour(page, "--qr-module"), 0)).toBe(true);

    /* ── layer 3: the pixels that actually reached the screen ───────────────────── */
    const shot = readPng(await screenshotElement(plate));
    const quiet = Number(
      await page.locator("[data-qr-zone]").getAttribute("data-qr-quiet"),
    );
    /* `deviceScaleFactor: 2`, so a CSS px is two device px. Sample the middle of the top
       quiet-zone band, well clear of both the 4px corner radius and the outer edge. */
    const scale = shot.width / (Number(await page.locator("[data-qr-zone]").getAttribute("data-qr-reserved")));
    const bandInset = Math.round(quiet * scale * 0.5);
    expect(bandInset).toBeGreaterThan(4);

    const quietSamples: Rgb[] = [];
    for (let x = bandInset; x < shot.width - bandInset; x += 7) {
      quietSamples.push(pixelAt(shot, x, bandInset));
      quietSamples.push(pixelAt(shot, x, shot.height - 1 - bandInset));
    }
    expect(quietSamples.length).toBeGreaterThan(20);
    for (const sample of quietSamples) {
      expect(
        channelsClose(sample, plateColour),
        `a quiet-zone pixel on ${template.id} at ${viewport} rendered ` +
          `rgb(${sample.r}, ${sample.g}, ${sample.b}) instead of the plate colour`,
      ).toBe(true);
    }

    /* The darkest pixel anywhere on the plate is a module, and it is the module token. */
    let darkest = { r: 255, g: 255, b: 255 };
    let darkestLuminance = 1;
    for (let y = bandInset; y < shot.height - bandInset; y += 3) {
      for (let x = bandInset; x < shot.width - bandInset; x += 3) {
        const pixel = pixelAt(shot, x, y);
        const luminance = relativeLuminance(pixel);
        if (luminance < darkestLuminance) {
          darkestLuminance = luminance;
          darkest = pixel;
        }
      }
    }
    expect(channelsClose(darkest, moduleColour)).toBe(true);

    const rendered = contrastBetween(plateColour, darkest);
    expect(rendered, `rendered module/plate contrast on ${template.id}`).toBeGreaterThanOrEqual(
      MIN_MODULE_CONTRAST,
    );

    samples.push({
      template: template.id,
      quietZone: quietSamples[Math.floor(quietSamples.length / 2)],
      darkestModule: darkest,
      measuredContrast: rendered,
    });
  });
}

/* ── the test that actually proves opacity ────────────────────────────────────────── */

/**
 * **Every ground in the set, one plate colour.**
 *
 * §8A.3's `alpha === 1` is asserted per template above from computed style, which a template
 * could satisfy while an ancestor, a blend mode or a stacking trick still let the ground
 * through. This is the observational version: the same plate is painted on each card's own
 * palette ground and an opaque plate renders **the same RGB triple over all of them**. Anything
 * translucent varies, and the darkest, most saturated ground varies most.
 *
 * ⚠ It says "every ground in the set" and not a number on purpose. It read "all eight grounds"
 * when there were eight templates, went on saying it when the set collapsed to two, and would
 * have gone on saying it forever — the count is `CARDS.length`, asserted below, and the title
 * should not be a second place for it to be wrong.
 *
 * The samples now come from the **share face**, whose ground is the card's palette rather than
 * the scan page's near-white content column. See the migration note at the head of this file:
 * this comparison only means something when the grounds genuinely differ, and now they do.
 *
 * It runs last in the file so the per-template tests have populated `samples`; it asserts its
 * own precondition so a partial run cannot make it pass by having nothing to compare.
 */
test("QR-T2 · the rendered plate colour is identical over every card ground in the set", async () => {
  expect(
    samples.length,
    "this test reads the samples the per-template tests collect; run the whole file",
  ).toBe(CARDS.length);

  const first = samples[0];
  for (const sample of samples) {
    expect(
      channelsClose(sample.quietZone, first.quietZone),
      `${sample.template} rendered its plate as rgb(${sample.quietZone.r}, ` +
        `${sample.quietZone.g}, ${sample.quietZone.b}) where ${first.template} rendered ` +
        `rgb(${first.quietZone.r}, ${first.quietZone.g}, ${first.quietZone.b}) — ` +
        "the ground is showing through, so the plate is not opaque (§8A.3, E-26)",
    ).toBe(true);
    expect(channelsClose(sample.darkestModule, first.darkestModule)).toBe(true);
    expect(sample.measuredContrast).toBeGreaterThanOrEqual(MIN_MODULE_CONTRAST);
  }
});
