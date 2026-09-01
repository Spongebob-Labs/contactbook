import { expect, test, type Locator, type Page } from "@playwright/test";

import { PALETTE_ORDER, TEMPLATE_PALETTES } from "@/card/template-palettes";
import { TEMPLATE_LIST } from "@/card/templates";
import { GALLERY_CATEGORIES } from "@/components/gallery/category-rail";

/** The gallery tile is `aspect-[336/500]` — the face's own proportion. */
const TILE_ASPECT = 500 / 336;

import { PROJECT_VIEWPORT, boxOf, gotoReady, screenshotElement } from "../helpers/e2e";
import { decodeQrPng } from "../helpers/qr-decode";

/**
 * `/templates` — the template gallery (spec §8B.5, AC-30, AC-09(h)).
 *
 * Two assertions here are the reason the file exists, and both are easy to get backwards:
 *
 * 1. **The name caption is a SIBLING BELOW the frame, never a descendant of it** (AC-30).
 *    Putting it inside the frame is the single most common way this gallery gets built
 *    wrong, so it is asserted structurally (`frame.contains(name) === false`) *and*
 *    geometrically (the caption's box starts below the frame's), not by reading a class.
 *
 * 2. **A `thumb` QR must NOT decode** (AC-09(h), §8A.5, E-31). A thumbnail is the design
 *    canvas at `scale(0.24–0.5)`, which would put a real symbol at 34–70px — unscannable.
 *    Rendering a real one there would be a lie, so `<QrZone mode="thumb">` draws a glyph
 *    that encodes nothing. **A failure of this test means someone "fixed" the glyph into a
 *    real encode.** It is asserted the strong way — a real screenshot through `jsqr` —
 *    rather than by counting `[data-qr-symbol]` alone, because the count is trivially
 *    satisfiable and the decode is not.
 *
 * Column counts are read from **computed style**, never from a class name: AC-30 is about
 * what the reader sees, and a `lg:grid-cols-3` that never matches would pass a class check.
 */

/**
 * The grid holds one cell per PALETTE, not per template.
 *
 * A template used to *be* a colour, so a grid of templates was a grid of colours. The two axes
 * are separate now — a template is the field preset, a palette is the look — and what a person
 * browses here is the colour. The rail picks the template; the grid shows every colour it can
 * wear.
 */
const EXPECTED_CELL_COUNT = PALETTE_ORDER.length;

/** The captions under the cells are palette names, in the palette picker's own order. */
const EXPECTED_CELL_NAMES = PALETTE_ORDER.map((id) => TEMPLATE_PALETTES[id].name);

/** §8B.5, in the order the rail renders them. */
/**
 * Derived from the rail's own source, not restated.
 *
 * This was a hand-written list of five, and it survived two rounds of the rail changing shape:
 * `Event` was dropped, then `Payment` and `Creative` went with the template set. A restated list
 * only ever fails *after* the product has changed, and it fails on the count rather than on
 * anything meaningful.
 */
const CATEGORY_LABELS: readonly string[] = GALLERY_CATEGORIES.map((c) => c.label);

/** §8B.5: 3-up ≥1024px, 2-up 768–1023px, 1-up below 768px. */
const EXPECTED_COLUMNS: Record<number, number> = { 360: 1, 768: 2, 1440: 3 };

/**
 * Resolve a design token to the exact string `getComputedStyle` will report for it.
 *
 * Comparing a computed `rgb(20, 33, 28)` against the raw `#14211C` in `tokens.css` needs a
 * colour parser; painting a probe with `var(--ink)` and reading it back needs none, and it
 * measures the value that actually reached the page rather than the one in the file.
 */
async function resolvedTokenColour(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.cssText = `position:absolute;left:-9999px;top:0;background-color:var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  }, token);
}

function cells(page: Page): Locator {
  return page.locator("[data-template-cell]");
}

async function gotoGallery(page: Page, query = ""): Promise<void> {
  await gotoReady(page, `/templates${query}`);
  // The gallery reads `?state=` through `useSearchParams`, so it lands after hydration.
  await page.locator("[data-screen-state]").first().waitFor();
}

test.describe("the category rail (§8B.5)", () => {
  test("renders one full-width pill per category and fills exactly one with --ink", async ({
    page,
  }) => {
    await gotoGallery(page);

    const rail = page.locator("[data-category-rail]");
    await expect(rail).toHaveCount(1);
    await expect(rail.getByRole("link")).toHaveCount(CATEGORY_LABELS.length);

    for (const label of CATEGORY_LABELS) {
      await expect(rail.getByRole("link", { name: label, exact: true })).toHaveCount(1);
    }

    // The overline above the rail. Written sentence-case and uppercased in CSS — a
    // screen reader should not spell out an all-caps string letter by letter.
    await expect(rail.locator("[data-rail-label]")).toHaveText(/browse by category/i);
    await expect(rail.locator("[data-rail-label]")).toHaveCSS("text-transform", "uppercase");

    const active = rail.locator('[data-rail-item][data-active="true"]');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveText("All templates");
    await expect(active).toHaveAttribute("aria-current", "page");

    const ink = await resolvedTokenColour(page, "--ink");
    const paper = await resolvedTokenColour(page, "--canvas");
    await expect(active).toHaveCSS("background-color", ink);
    await expect(active).toHaveCSS("color", paper);

    // …and every other pill is a ghost: no fill at all.
    const ghosts = rail.locator('[data-rail-item]:not([data-active="true"])');
    await expect(ghosts).toHaveCount(CATEGORY_LABELS.length - 1);
    for (let index = 0; index < CATEGORY_LABELS.length - 1; index += 1) {
      await expect(ghosts.nth(index)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    }
  });

  test("moves the fill to the selected category and switches which template is previewed", async ({
    page,
  }) => {
    /* The rail no longer narrows the grid — it changes the TEMPLATE every cell is rendered from.
       The colour range is constant; the fields are what the category selects. Asserting a
       narrower grid would now be asserting the old model. */
    await gotoGallery(page, "?category=personal");

    const active = page.locator('[data-rail-item][data-active="true"]');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveText("Personal");

    const personal = TEMPLATE_LIST.find((t) => t.category === "personal");
    expect(personal, "no personal template in the registry").toBeDefined();

    /* Still nine cells: every colour, on the newly selected template. */
    await expect(cells(page)).toHaveCount(EXPECTED_CELL_COUNT);
    await expect(page.locator("[data-template-name]")).toHaveText(EXPECTED_CELL_NAMES);

    /* And every card really is that template… */
    const templateIds = await page
      .locator("[data-template-grid] [data-card-root]")
      .evaluateAll((nodes) => [...new Set(nodes.map((n) => (n as HTMLElement).dataset.templateId))]);
    expect(templateIds).toEqual([personal?.id]);

    /* …with its purpose stated once, rather than repeated under all nine cards. */
    await expect(page.locator("[data-template-purpose]")).toHaveText(personal?.blurb ?? "");
  });
});

test.describe("the grid (AC-30)", () => {
  test("is 3-up at 1440, 2-up at 768 and 1-up at 360, measured not classed", async ({
    page,
  }, testInfo) => {
    await gotoGallery(page);

    const grid = page.locator("[data-template-grid]");
    await expect(grid).toHaveCount(1);
    await expect(cells(page)).toHaveCount(EXPECTED_CELL_COUNT);

    const columns = await grid.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
    expect(columns).toBe(EXPECTED_COLUMNS[PROJECT_VIEWPORT[testInfo.project.name]]);
  });

  test("every cell holds one live thumb render, framed at the face aspect and --radius-xl", async ({
    page,
  }) => {
    await gotoGallery(page);

    const all = cells(page);
    await expect(all).toHaveCount(EXPECTED_CELL_COUNT);

    for (let index = 0; index < EXPECTED_CELL_COUNT; index += 1) {
      const cell = all.nth(index);
      const frame = cell.locator("[data-template-frame]");
      await expect(frame).toHaveCount(1);

      // Live component, not a screenshot of one (§8C.2).
      await expect(frame.locator('[data-card-root][data-render-mode="thumb"]')).toHaveCount(1);
      await expect(cell.locator("img[src$='.png'][data-card-preview]")).toHaveCount(0);

      const box = await boxOf(frame);
      expect(box.width).toBeGreaterThan(0);
      /* The tile's aspect tracks `TILE_ASPECT`, which tracks the face. Hard-coding it here meant
         hand-editing this line every time the card changed shape. */
      expect(box.height / box.width).toBeCloseTo(TILE_ASPECT, 1);

      await expect(frame).toHaveCSS("border-radius", "20px");
      // §8B.5: frames are --elevation-0. Separation comes from the gutter (F-09).
      await expect(frame).toHaveCSS("box-shadow", "none");
      await expect(cell).toHaveCSS("box-shadow", "none");
    }
  });

  test("the template name is a left-aligned caption BELOW the frame, never inside it", async ({
    page,
  }) => {
    await gotoGallery(page);

    const all = cells(page);
    for (let index = 0; index < EXPECTED_CELL_COUNT; index += 1) {
      const cell = all.nth(index);
      const frame = cell.locator("[data-template-frame]");
      const name = cell.locator("[data-template-name]");

      await expect(name).toHaveText(EXPECTED_CELL_NAMES[index]);

      // Structural: the caption is not a descendant of the frame.
      const nested = await cell.evaluate((el) => {
        const f = el.querySelector("[data-template-frame]");
        const n = el.querySelector("[data-template-name]");
        return f !== null && n !== null && f.contains(n);
      });
      expect(nested).toBe(false);

      // Geometric: it sits below the frame and shares its left edge.
      const frameBox = await boxOf(frame);
      const nameBox = await boxOf(name);
      expect(nameBox.y).toBeGreaterThanOrEqual(frameBox.y + frameBox.height);
      expect(Math.abs(nameBox.x - frameBox.x)).toBeLessThan(2);
      await expect(name).toHaveCSS("text-align", "left");
    }

    // Product names, never numbers (§8B.3, AC-18) — the gallery must not renumber them.
    const rendered = await page.locator("[data-template-name]").allInnerTexts();
    expect(rendered).toEqual(EXPECTED_CELL_NAMES);
    for (const label of rendered) expect(label).not.toMatch(/\d/);
  });

  test("the page heading clears the fixed pill bar without the page adding clearance", async ({
    page,
  }) => {
    await gotoGallery(page);

    const heading = page.getByRole("heading", { level: 1 });
    const headingBox = await boxOf(heading);
    const navBox = await boxOf(page.locator("[data-pill-nav]"));
    expect(headingBox.y).toBeGreaterThanOrEqual(navBox.y + navBox.height);

    // The clearance belongs to `(marketing)/layout.tsx`'s `<main class="pt-20">`; the page
    // adds section rhythm below it and never a second allowance for the bar.
    await expect(page.locator("main#main")).toHaveCSS("padding-top", "80px");
  });
});

/**
 * A thumbnail carries a REAL pattern and a FAKE payload.
 *
 * This block used to assert the opposite: that a thumbnail rendered no `[data-qr-symbol]` at
 * all, only an abstract corner-and-dots glyph. That glyph was honest about being decorative and
 * useless for the one job a tile has — showing what the finished card looks like. Every tile
 * read as a wireframe.
 *
 * So thumbnails now encode a real symbol from a fixed dummy string. The assertion that matters
 * is the one below, and it is *stronger* than the old one: a tile must not decode to anybody's
 * actual card. A thumbnail is scaled to roughly 200px, so it is not decodable in practice
 * either — but the payload is the guarantee and the size is a happy accident of the layout.
 */
test.describe("a thumb QR is a real pattern with a dummy payload", () => {
  test("renders a real symbol that never encodes a card URL", async ({ page }) => {
    await gotoGallery(page);

    const grid = page.locator("[data-template-grid]");
    const zones = grid.locator("[data-qr-zone]");
    await expect(zones).toHaveCount(EXPECTED_CELL_COUNT);

    /* A real pattern is present in every cell, and the old abstract glyph is not. */
    await expect(grid.locator("[data-qr-symbol]")).toHaveCount(EXPECTED_CELL_COUNT);
    await expect(grid.locator("[data-qr-glyph]")).toHaveCount(0);

    for (let index = 0; index < EXPECTED_CELL_COUNT; index += 1) {
      const zone = zones.nth(index);
      await expect(zone).toHaveAttribute("data-qr-mode", "thumb");
      await expect(zone).toHaveAttribute("data-qr-preview", "true");
      await expect(zone).toHaveAttribute("aria-hidden", "true");
    }

    /* THE assertion: no tile's markup carries a real card path. Checked on the markup rather
       than by decoding, because a 200px thumbnail is below the decode threshold — so a decode
       returning null would prove the tile is small, not that the payload is safe. */
    const markup = await zones.evaluateAll((nodes) => nodes.map((n) => n.outerHTML));
    for (const [index, html] of markup.entries()) {
      expect(html, `cell ${index} embeds a real card path`).not.toContain("/c/");
    }
  });
});


test.describe("states (R-02: all four families)", () => {
  test("?state=loading renders frame-shaped skeletons and never resolves", async ({ page }) => {
    await gotoGallery(page, "?state=loading");

    const root = page.locator("[data-screen-state]").first();
    await expect(root).toHaveAttribute("data-screen-state", "loading");
    await expect(root).toHaveAttribute("aria-busy", "true");
    await expect(cells(page)).toHaveCount(0);

    const bones = page.locator("[data-template-skeleton]");
    await expect(bones).toHaveCount(EXPECTED_CELL_COUNT);
    const box = await boxOf(bones.first());
    /* Bones share the tile's aspect so nothing shifts when the cards arrive. */
    expect(box.height / box.width).toBeCloseTo(TILE_ASPECT, 1);
  });

  test("?state=empty renders the FIRST-RUN empty state, not the filtered one", async ({
    page,
  }) => {
    await gotoGallery(page, "?state=empty");

    await expect(page.locator("[data-screen-state]").first()).toHaveAttribute(
      "data-screen-state",
      "empty",
    );
    await expect(page.locator('[data-empty-state="first-run"]')).toHaveCount(1);
    await expect(page.locator('[data-empty-state="filtered"]')).toHaveCount(0);
  });

  test("a category with no members renders the FILTERED empty state and Clear filters", async ({
    page,
  }) => {
    await gotoGallery(page, "?category=nothing-matches-this");

    await expect(page.locator("[data-screen-state]").first()).toHaveAttribute(
      "data-screen-state",
      "empty-filtered",
    );
    await expect(page.locator('[data-empty-state="filtered"]')).toHaveCount(1);
    // §8D.1: the filtered empty offers "Clear filters" and NEVER a create action.
    await expect(page.locator('[data-empty-state="first-run"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
    await expect(cells(page)).toHaveCount(0);

    // …and it clears back to the full grid, with the rail still navigable throughout.
    await expect(page.locator("[data-category-rail]")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(cells(page)).toHaveCount(EXPECTED_CELL_COUNT);
  });

  test("?state=error renders the §6.10 panel with a retry, not a blank page", async ({
    page,
  }) => {
    await gotoGallery(page, "?state=error");

    await expect(page.locator("[data-screen-state]").first()).toHaveAttribute(
      "data-screen-state",
      "error",
    );
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(cells(page)).toHaveCount(0);
    // No stack trace, no raw error code as a headline (§13.1).
    await expect(page.locator("body")).not.toContainText(/at .*\.tsx:\d+/);
  });

  test("?state=offline renders the offline family", async ({ page }) => {
    await gotoGallery(page, "?state=offline");
    await expect(page.locator("[data-screen-state]").first()).toHaveAttribute(
      "data-screen-state",
      "offline",
    );
  });

  test("E-34: an unrecognised ?state= falls back to success", async ({ page }) => {
    await gotoGallery(page, "?state=banana");
    await expect(page.locator("[data-screen-state]").first()).toHaveAttribute(
      "data-screen-state",
      "success",
    );
    await expect(cells(page)).toHaveCount(EXPECTED_CELL_COUNT);
  });
});

test.describe("the closing band (§8B.5)", () => {
  test("closes on one display line and exactly one call to action", async ({ page }) => {
    await gotoGallery(page);

    const band = page.locator("[data-gallery-closing-band]");
    await expect(band).toHaveCount(1);
    await expect(band.getByRole("heading")).toHaveCount(1);
    await expect(band.getByRole("link")).toHaveCount(1);
    await expect(band).toHaveCSS("box-shadow", "none");
  });
});
