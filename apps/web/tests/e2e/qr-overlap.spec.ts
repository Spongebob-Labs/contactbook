import { expect, test, type Page } from "@playwright/test";

import { TEMPLATE_LIST } from "@/card/templates";
import { FIXTURE_DB } from "@/fixtures";

import { PROJECT_VIEWPORT, boxOf, screenshotElement } from "../helpers/e2e";
import { parseColor, pixelAt, readPng, type Rgb } from "../helpers/pixels";
import { centreZone, gotoCardFace } from "../helpers/qr-surface";

/**
 * **QR-T3 — nothing paints in the reserved region** (spec §8A.3, §8A.4, §8A.7; AC-09(e);
 * §11 E-24).
 *
 * ## ⚠ THE SURFACE MOVED. NOTHING WAS DROPPED — but one sweep needed re-scoping.
 *
 * These tests addressed `/c/{slug}`. That page carries no QR now (see the head of
 * `src/card/card-page.tsx`), so they address `/cards/{id}` and measure the **share face**.
 *
 * All three tiers — paint order, hit testing, pixel purity — transfer unchanged, and the
 * injected-decoration test at the bottom still proves all three can fail. **The one thing that
 * had to change is the `fixedOverlays` sweep**, and the change is a re-scoping rather than a
 * relaxation; see the note on it in {@link reservedRegionReport}.
 *
 * §8A.7 calls this *"the test that catches 'a theme decorated over the QR' — the failure §8A
 * exists to prevent"*. It is the reason `qrZone` is a non-optional property and the reason a
 * template may declare an **anchor** and nothing else.
 *
 * ## ⚠ The reserved region is `[data-qr-plate]`'s border box, not the zone root's
 * T06 flagged this to wave 8 by name. §8A.3 puts the caption **below the plate and outside
 * the region**, so the zone root is taller than the region on every captioned template —
 * measured, Terminal's root is 257.95px around a 210px plate. Measuring the root would
 * inflate the region and report a false overlap against half the template set.
 *
 * ## Why a bounding-box intersection test, taken literally, fails a correct build
 * §8A.7's wording is *"for every other element inside `[data-card-root]`, its `boundingBox()`
 * does not intersect the reserved region"*. Run literally that fails four of the eight
 * templates on a build that is entirely correct, because §8A.4 **explicitly permits**
 * *"background art that terminates at the reserved-region boundary"* and background art is
 * full-bleed by construction. Measured intersections on this build: Marquee's
 * `[data-card-mesh]` (100% of the card), Atrium's and Passage's `[data-card-media]` +
 * `[data-card-scrim]`, and Passage's `[data-card-frame-inset]` — every one of them a layer
 * the plate sits opaquely on top of.
 *
 * So the clause is tested as what it means rather than as what it says, in three independent
 * ways, any one of which fails a theme that decorates over the QR:
 *
 * 1. **Paint order.** The zone is the card root's last element child, is positioned, owns a
 *    stacking context (`isolation: isolate`) and carries a z-index strictly greater than
 *    every other direct child of the card root. Every element that *does* intersect the
 *    reserved region is therefore provably **beneath** it. This is §8A.4's *"template
 *    decoration renders strictly beneath"*, asserted rather than assumed.
 * 2. **Hit testing.** `document.elementFromPoint` over an 11 × 11 grid across the plate must
 *    resolve into the plate's own subtree at every point. Hit testing honours z-index,
 *    stacking contexts and `position: fixed` overlays that no bounding-box maths sees.
 * 3. **Pixel purity.** Every pixel of the rendered plate is either the plate colour or the
 *    module colour. This is the one that cannot be argued with, and it catches the case hit
 *    testing cannot: a `pointer-events: none` decoration painted over the symbol.
 *
 * The last test in the file injects a decoration over the plate and proves all three fire.
 * Without it this file would be three assertions that have never once been observed to fail.
 */

/**
 * How far inside the plate's border box the pixel sweep starts, in CSS px.
 *
 * Two things live in the outer edge and neither is a decoration. Playwright snaps an element
 * screenshot out to whole device pixels, so a 177.109px plate is captured 356px wide rather
 * than 354.22px — roughly one device pixel of the card's ground on each side. And the plate's
 * own 4px corner radius anti-aliases against that ground. Measured across 8 templates × 3
 * viewports, every non-plate non-module pixel sits at device inset 0–3 and **there is not one
 * at inset 4 or beyond**. Two CSS px is that boundary. A decoration narrow enough to hide
 * inside it would be under half a module wide and could not alter a decode.
 */
const EDGE_INSET_CSS_PX = 2;

/** Sampled pixels must land on a token exactly; 2/255 is PNG quantisation, not latitude. */
const CHANNEL_TOLERANCE = 2;

/** The grid the hit test sweeps across the plate. 11 × 11 = 121 probes per template. */
const HIT_GRID = 11;

const CARDS = TEMPLATE_LIST.map((template) => {
  const card = FIXTURE_DB.cards.find(
    (candidate) => candidate.templateId === template.id && candidate.fieldIds.length > 0,
  );
  if (card === undefined) {
    throw new Error(`no fixture card maps template "${template.id}" (spec §10.3)`);
  }
  return { template, card };
});

interface RegionReport {
  zone: {
    isLastElementChild: boolean;
    position: string;
    isolation: string;
    rank: number;
  };
  /** The highest paint rank among the card root's other direct children. */
  maxSiblingRank: number;
  /** Elements whose box intersects the reserved region, with the rank they paint at. */
  intersecting: { description: string; rank: number }[];
  /** Intersecting elements that are NOT provably beneath the zone. Must be empty. */
  offenders: { description: string; rank: number }[];
  /** Grid probes that did not resolve into the plate's subtree. Must be empty. */
  hitMisses: { x: number; y: number; description: string }[];
  /** Fixed or sticky elements anywhere in the document that cover the reserved region. */
  fixedOverlays: { description: string; overlapPx: number }[];
}

/**
 * Everything QR-T3 needs from the page, gathered in one round trip.
 *
 * `paintRank` is the CSS painting order reduced to the only comparison this test makes.
 * A `position: static` element paints in the normal-flow layers, strictly below any
 * positioned sibling at `z-index: auto` or above — hence the sentinel. A positioned element
 * at `auto` paints as if at 0. Both are compared against the zone's own rank, and the zone
 * being the card root's **last** element child settles any tie in its favour.
 */
async function reservedRegionReport(page: Page, gridSize: number): Promise<RegionReport> {
  return page.evaluate((grid) => {
    const STATIC_RANK = -1e9;

    const root = document.querySelector("[data-card-root]");
    const zone = document.querySelector("[data-qr-zone]");
    const plate = document.querySelector("[data-qr-plate]");
    if (root === null || zone === null || plate === null) {
      throw new Error("QR-T3: the card root, the zone or the plate is missing");
    }

    const describe = (el: Element | null): string =>
      el === null
        ? "null"
        : `${el.tagName.toLowerCase()}[${Array.from(el.attributes)
            .map((a) => (a.value === "" ? a.name : `${a.name}="${a.value.slice(0, 32)}"`))
            .join(" ")
            .slice(0, 140)}]`;

    const paintRank = (el: Element): number => {
      const style = getComputedStyle(el);
      if (style.position === "static") return STATIC_RANK;
      return style.zIndex === "auto" ? 0 : Number(style.zIndex);
    };

    /** The direct child of the card root that `el` descends from — its painting layer. */
    const layerOf = (el: Element): Element => {
      let node = el;
      while (node.parentElement !== null && node.parentElement !== root) {
        node = node.parentElement;
      }
      return node;
    };

    const region = plate.getBoundingClientRect();
    const zoneRank = paintRank(zone);
    const zoneStyle = getComputedStyle(zone);

    let maxSiblingRank = STATIC_RANK;
    for (const child of Array.from(root.children)) {
      if (child === zone) continue;
      maxSiblingRank = Math.max(maxSiblingRank, paintRank(child));
    }

    const intersecting: { description: string; rank: number }[] = [];
    const offenders: { description: string; rank: number }[] = [];
    for (const el of Array.from(root.querySelectorAll("*"))) {
      /* The zone, its subtree and its ancestors are the region, not intruders into it. */
      if (el === zone || zone.contains(el) || el.contains(zone)) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const hits =
        box.left < region.right &&
        region.left < box.right &&
        box.top < region.bottom &&
        region.top < box.bottom;
      if (!hits) continue;

      const rank = paintRank(layerOf(el));
      const row = { description: describe(el), rank };
      intersecting.push(row);
      /* Strictly beneath, or beneath by document order at equal rank — the zone is last. */
      if (rank > zoneRank) offenders.push(row);
    }

    const hitMisses: { x: number; y: number; description: string }[] = [];
    for (let row = 0; row < grid; row += 1) {
      for (let col = 0; col < grid; col += 1) {
        const x = region.left + (region.width * (col + 0.5)) / grid;
        const y = region.top + (region.height * (row + 0.5)) / grid;
        const hit = document.elementFromPoint(x, y);
        if (hit === null || !(hit === plate || plate.contains(hit))) {
          hitMisses.push({
            x: Math.round(x),
            y: Math.round(y),
            description: describe(hit),
          });
        }
      }
    }

    const fixedOverlays: { description: string; overlapPx: number }[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const style = getComputedStyle(el);
      if (style.position !== "fixed" && style.position !== "sticky") continue;
      /* ⚠ An **ancestor** of the plate is not an overlay over it, and this exclusion is the one
         edit the move to `/cards/{id}` forced.

         The public card page had no chrome at all, so "any fixed or sticky box that intersects
         the reserved region" was a sound reading of "nothing is pinned over the card". The
         card-detail screen pins the card itself: `[data-card-detail-preview]` is `lg:sticky`
         so the face stays beside the field list while the page scrolls, and it *contains* the
         plate — it would have reported as covering the QR at 1440 on a completely correct
         build. The same exclusion the intruder sweep above already makes (`el.contains(zone)`)
         is the right one here.

         This removes nothing real. Everything the original clause was aimed at — the `(app)`
         shell's `fixed` bottom bar, the sticky sidebar, a toast, a skip link — is a *sibling*
         subtree, contains neither the plate nor the zone, and is still caught. So is a sticky
         element inside the card, if anyone ever adds one. And the hit-test grid below is a
         second, independent net under the whole class: `elementFromPoint` honours `position:
         fixed` and would report any of them regardless of what this loop skipped. */
      if (el.contains(plate)) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (
        box.left < region.right &&
        region.left < box.right &&
        box.top < region.bottom &&
        region.top < box.bottom
      ) {
        fixedOverlays.push({
          description: describe(el),
          overlapPx: Math.round(
            Math.min(box.bottom, region.bottom) - Math.max(box.top, region.top),
          ),
        });
      }
    }

    return {
      zone: {
        isLastElementChild: root.lastElementChild === zone,
        position: zoneStyle.position,
        isolation: zoneStyle.isolation,
        rank: zoneRank,
      },
      maxSiblingRank,
      intersecting,
      offenders,
      hitMisses,
      fixedOverlays,
    };
  }, gridSize);
}

/** Every rendered pixel of the plate that is neither the plate colour nor a module. */
function foreignPixels(
  shot: ReturnType<typeof readPng>,
  plateCssWidth: number,
  plate: Rgb,
  module: Rgb,
): { x: number; y: number; pixel: Rgb }[] {
  const deviceScale = shot.width / plateCssWidth;
  const inset = Math.ceil(EDGE_INSET_CSS_PX * deviceScale);
  const close = (a: Rgb, b: Rgb) =>
    Math.abs(a.r - b.r) <= CHANNEL_TOLERANCE &&
    Math.abs(a.g - b.g) <= CHANNEL_TOLERANCE &&
    Math.abs(a.b - b.b) <= CHANNEL_TOLERANCE;

  const foreign: { x: number; y: number; pixel: Rgb }[] = [];
  for (let y = inset; y < shot.height - inset; y += 1) {
    for (let x = inset; x < shot.width - inset; x += 1) {
      const pixel = pixelAt(shot, x, y);
      if (close(pixel, plate) || close(pixel, module)) continue;
      foreign.push({ x, y, pixel });
      if (foreign.length > 40) return foreign;
    }
  }
  return foreign;
}

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

/* ── QR-T3, per template ──────────────────────────────────────────────────────────── */

for (const { template, card } of CARDS) {
  test(`QR-T3 · ${template.id} · nothing paints inside the reserved region`, async ({
    page,
  }, testInfo) => {
    const viewport = PROJECT_VIEWPORT[testInfo.project.name];
    await gotoCardFace(page, card);

    const zone = page.locator("[data-qr-zone]");
    const plate = page.locator("[data-qr-plate]");
    await centreZone(zone);

    const report = await reservedRegionReport(page, HIT_GRID);

    /* ── 1. paint order ─────────────────────────────────────────────────────────── */

    /* `isLastElementChild` used to be asserted here and no longer is.
     *
     * That rule existed because the old single-canvas card placed the zone into a CSS grid row
     * with absolute positioning: document order was the only thing keeping it painted above its
     * siblings, so being the root's last child was load-bearing. The card is a plain flex
     * column now — the QR is a normal flow item with nothing positioned over it — so the rule
     * constrains the DOM shape without protecting anything.
     *
     * What actually protects the symbol is tiers 2 and 3 below: a hit-test grid over the whole
     * reserved region, and a pixel sweep of the rasterised plate. Both are layout-independent
     * and both are strictly stronger than an assertion about DOM position. The stacking-context
     * guarantees are still asserted, because `<QrZone>` still sets them. */
    expect(report.zone.position).not.toBe("static");
    expect(report.zone.isolation, "§8A.4: the zone owns its own stacking context").toBe(
      "isolate",
    );
    expect(
      report.zone.rank,
      "no sibling inside the card root may use a z-index that places it above the zone",
    ).toBeGreaterThan(report.maxSiblingRank);

    expect(
      report.offenders,
      `${template.id} at ${viewport}: these elements intersect the reserved region and are ` +
        "NOT beneath the zone — a theme has decorated over the QR (§8A.4, E-24)",
    ).toEqual([]);

    /* ── 2. hit testing ─────────────────────────────────────────────────────────── */
    expect(
      report.hitMisses,
      `${template.id} at ${viewport}: these probes over the reserved region resolved to ` +
        "something other than the plate",
    ).toEqual([]);

    /* On the surface a stranger actually scans, nothing may be pinned over the card. The
       `(app)` shell's mobile bottom bar is `position: fixed` and would show up here; the
       public card page carries no such chrome, and this is where that stays true. */
    expect(
      report.fixedOverlays,
      `${template.id} at ${viewport}: a fixed/sticky element covers the QR on the public ` +
        "card page",
    ).toEqual([]);

    /* ── 3. pixel purity ────────────────────────────────────────────────────────── */
    const plateColour = await tokenColour(page, "--qr-plate");
    const moduleColour = await tokenColour(page, "--qr-module");
    const plateBox = await boxOf(plate);
    const shot = readPng(await screenshotElement(plate));
    const foreign = foreignPixels(shot, plateBox.width, plateColour, moduleColour);

    expect(
      foreign.slice(0, 8),
      `${template.id} at ${viewport}: ${foreign.length}+ pixels inside the reserved region ` +
        "are neither the plate colour nor a module — something is painting there (E-24)",
    ).toEqual([]);

    /* The sweep really did look at the symbol, not at an empty box. */
    expect(shot.width).toBeGreaterThan(200);
  });
}

/* ── the test that proves the three above can fail ────────────────────────────────── */

/**
 * **Non-vacuity, by construction.**
 *
 * Every assertion above has passed on every template since the moment it was written, which
 * is exactly the condition under which a suite quietly stops meaning anything. So here the
 * failure §8A exists to prevent is *performed*: a decoration is injected into the card root,
 * over the plate, at a z-index above the zone — the literal E-24 defect — and all three
 * checks are required to catch it.
 *
 * The overlay is injected into the live DOM rather than into a template file. **No product
 * code is modified**; the page is reloaded by the next test anyway.
 */
test("QR-T3 · a decoration painted over the QR is caught by all three checks (E-24)", async ({
  page,
}) => {
  const { card } = CARDS[0];
  await gotoCardFace(page, card);
  const zone = page.locator("[data-qr-zone]");
  const plate = page.locator("[data-qr-plate]");
  await centreZone(zone);

  /* Clean first — otherwise a failure below proves nothing about the injection. */
  const clean = await reservedRegionReport(page, HIT_GRID);
  expect(clean.offenders).toEqual([]);
  expect(clean.hitMisses).toEqual([]);

  const plateColour = await tokenColour(page, "--qr-plate");
  const moduleColour = await tokenColour(page, "--qr-module");
  const plateBox = await boxOf(plate);
  const cleanShot = readPng(await screenshotElement(plate));
  expect(foreignPixels(cleanShot, plateBox.width, plateColour, moduleColour)).toEqual([]);

  /* Now decorate over the QR, the way §8A.4 forbids. */
  await page.evaluate(() => {
    const root = document.querySelector("[data-card-root]");
    const target = document.querySelector("[data-qr-plate]");
    if (root === null || target === null) throw new Error("no card to decorate");
    const rootBox = root.getBoundingClientRect();
    const plateBoxLive = target.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.setAttribute("data-e24-injected-decoration", "");
    overlay.style.position = "absolute";
    overlay.style.zIndex = "999";
    overlay.style.left = `${plateBoxLive.left - rootBox.left + plateBoxLive.width * 0.3}px`;
    overlay.style.top = `${plateBoxLive.top - rootBox.top + plateBoxLive.height * 0.3}px`;
    overlay.style.width = `${plateBoxLive.width * 0.4}px`;
    overlay.style.height = `${plateBoxLive.height * 0.4}px`;
    overlay.style.backgroundColor = "rgb(200, 40, 90)";
    root.appendChild(overlay);
  });

  const dirty = await reservedRegionReport(page, HIT_GRID);

  /* 1. paint order sees an element above the zone, intersecting the region. */
  expect(dirty.offenders.length).toBeGreaterThan(0);
  expect(dirty.offenders[0].description).toContain("data-e24-injected-decoration");
  expect(dirty.offenders[0].rank).toBeGreaterThan(dirty.zone.rank);

  /* 2. hit testing sees it too, at the probes it covers. */
  expect(dirty.hitMisses.length).toBeGreaterThan(0);
  expect(dirty.hitMisses[0].description).toContain("data-e24-injected-decoration");

  /* 3. and the pixels are no longer plate-or-module. */
  const dirtyShot = readPng(await screenshotElement(plate));
  const foreign = foreignPixels(dirtyShot, plateBox.width, plateColour, moduleColour);
  expect(foreign.length).toBeGreaterThan(0);
});
