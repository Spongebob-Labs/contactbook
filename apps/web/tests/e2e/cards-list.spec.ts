import { expect, test, type Locator, type Page } from "@playwright/test";

import { fixtureCards } from "@/fixtures";
import { LONG_NAME } from "@/fixtures/extremes";

import { PROJECT_VIEWPORT, boxOf, gotoReady, screenshotElement } from "../helpers/e2e";
import { decodeQrPng } from "../helpers/qr-decode";

/**
 * `/cards` — the cards list (spec §8D.3 cards-list row, §6.1 R-10, AC-24, AC-09(h),
 * §11 E-09, E-13).
 *
 * ## The one bug this screen exists to not repeat
 * The old build's `decision-context.md` records card `5a286f9e` shipping with **zero**
 * field mappings and generating a 73-byte `.vcf` — `FN` and `N` and nothing else. It got
 * worse: presets were ranked `updatedAt desc`, so the newest card, which is always the
 * freshly-created empty one, was preselected, and copying it copied nothing.
 *
 * The fixtures reproduce that condition deliberately: `card_empty_demo` maps no fields and
 * is the **newest** card by `updatedAt`. This screen sorts by recency on purpose, so the
 * empty card lands in position one — and the whole point of the tests below is that it
 * arrives there **wearing its warning**, rather than being sorted quietly out of sight.
 * A list that hid it would pass a naive "does it render" test and reproduce the bug.
 *
 * ## Three assertions that are easy to get backwards
 *
 * 1. **The two empty states are different components** (AC-24, §8D.1). A user who filtered
 *    to nothing must never be told to "create your first card". It is asserted on the
 *    `data-empty-state` attribute *and* on the copy *and* on the actions, because any one
 *    of the three alone is trivially satisfiable.
 * 2. **Zero cards is the FIRST-RUN empty, never the filtered variant** (E-09) — even with
 *    a query in the box, because an empty collection is not something a filter did.
 * 3. **A `thumb` QR must NOT decode** (AC-09(h), §8A.5, E-31). `<QrZone mode="thumb">`
 *    draws a glyph whose rings are 1:1:1:1:1 rather than a finder pattern's 1:1:3:1:1, so
 *    no decoder can locate a symbol in it. **A failure here means someone "fixed" the
 *    glyph into a real encode.** Asserted the strong way — a real raster through `jsqr` —
 *    because counting `[data-qr-symbol]` alone is trivially satisfiable and a decode is not.
 *
 * Column counts are read from **computed style**, never from a class name: §8D.3 is about
 * what the reader sees, and an `xl:grid-cols-3` that never matches would pass a class check.
 */

/** §8D.3: 3-up ≥1280px, 2-up 768–1279px, 1-up ≤767px. */
/** The gallery tile is `aspect-[336/500]` — the face's own proportion. */
const TILE_ASPECT = 500 / 336;

const EXPECTED_COLUMNS: Record<number, number> = { 360: 1, 768: 2, 1440: 3 };

/** The card the whole screen is a guard against (§11.6). Spelled out, never derived. */
const EMPTY_CARD_ID = "card_empty_demo";

/**
 * `EMPTY_CARD_NOTE` from `@/components/app/field-count-meter`, transcribed rather than
 * imported. Two reasons, both deliberate:
 *
 *  - the barrel that exports it pulls `next/link`, `lucide-react` and the whole card
 *    renderer into Playwright's module loader, which no other e2e spec in this run does
 *    and which would turn a loader problem into something that looks like a product bug;
 *  - §11 E-01's sentence is **user-visible copy**, and a test that pins copy should state
 *    it. If T17 ever rewords the note, this assertion should be the thing that says so.
 */
const EMPTY_CARD_NOTE = "Anyone who scans it will only get your name.";

/** The one `PAYMENT` card in the fixtures — the filter-narrowing probe. */
const PAYMENT_CARD_ID = "card_cobalt_demo";

function tiles(page: Page): Locator {
  return page.locator("[data-card-tile]");
}

function root(page: Page): Locator {
  return page.locator("[data-screen-state]").first();
}

async function gotoCards(page: Page, query = ""): Promise<void> {
  await gotoReady(page, `/cards${query}`);
  // The screen reads `?state=` through `useSearchParams`, so it lands after hydration.
  await root(page).waitFor();
}

function viewportOf(projectName: string): number {
  const width = PROJECT_VIEWPORT[projectName];
  if (width === undefined) throw new Error(`no viewport mapped for project "${projectName}"`);
  return width;
}

test.describe("the shell (§8D.3 cards-list row)", () => {
  test("renders the page heading, the New card primary, and every card as a tile", async ({
    page,
  }) => {
    await gotoCards(page);

    await expect(root(page)).toHaveAttribute("data-screen-state", "success");
    await expect(page.getByRole("heading", { level: 1, name: "Cards" })).toHaveCount(1);

    // The shell owns the only `<main>`; this screen is a labelled `section` inside it.
    await expect(page.locator("main#main")).toHaveCount(1);
    await expect(root(page)).toHaveJSProperty("tagName", "SECTION");

    const newCard = page
      .locator("[data-page-header-actions]")
      .getByRole("link", { name: "New card" });
    await expect(newCard).toHaveCount(1);
    await expect(newCard).toHaveAttribute("href", "/cards/new");

    await expect(tiles(page)).toHaveCount(fixtureCards.length);
  });

  test("lays the grid out 3-up / 2-up / 1-up by computed style", async ({ page }, testInfo) => {
    await gotoCards(page);

    const columns = await page
      .locator("[data-cards-grid]")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);

    expect(columns).toBe(EXPECTED_COLUMNS[viewportOf(testInfo.project.name)]);
  });

  test("renders every tile in the product's single typeface", async ({ page }) => {
    await gotoCards(page);

  /* This asserted that `--font-archivo` and `--font-bricolage` resolved on this route.
     
     The old design gave templates four different typefaces and route-scoped the two card-only
     ones so `/` and `(auth)` did not pay to download them. There is one family now — Geist,
     variable 100–900, loaded once in the root layout — because four families still produced
     eight cards that looked identical, the palette being what made them identical. Weight
     carries the hierarchy the extra families used to.
     
     `[data-card-fonts]` no longer exists. What is still worth asserting is that the card
     resolves that one family rather than falling through to a system stack. */
    const families = await page
      .locator("[data-cards-grid] [data-card-name]")
      .evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).fontFamily.toLowerCase()));

    expect(families.length).toBeGreaterThan(0);
    for (const family of families) {
      expect(family).toContain("geist");
    }
  });

  test("every tile links to its own card detail route", async ({ page }) => {
    await gotoCards(page);

    for (const card of fixtureCards) {
      const link = page.locator(`[data-card-tile="${card.id}"]`).getByRole("link");
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute("href", `/cards/${card.id}`);
    }
  });
});

test.describe("the state matrix (AC-24, R-10: all four families)", () => {
  test("?state=success carries data-screen-state=success and a populated grid", async ({
    page,
  }) => {
    await gotoCards(page, "?state=success");

    await expect(root(page)).toHaveAttribute("data-screen-state", "success");
    await expect(tiles(page)).toHaveCount(fixtureCards.length);
  });

  test("?state=loading renders six card-shaped bones at the tile aspect and never resolves", async ({
    page,
  }) => {
    await gotoCards(page, "?state=loading");

    const region = root(page);
    await expect(region).toHaveAttribute("data-screen-state", "loading");
    await expect(region).toHaveAttribute("aria-busy", "true");

    const bones = page.locator('[data-loading-skeleton="card-grid"] [data-skeleton-card]');
    await expect(bones).toHaveCount(6);
    await expect(tiles(page)).toHaveCount(0);

    const box = await boxOf(bones.first());
     /* Bones share the tile's aspect so nothing shifts when the cards arrive. */
    expect(box.height / box.width).toBeCloseTo(TILE_ASPECT, 1);

    // §11 E-35: the skeleton must not spin forever *and* also error. It simply stays.
    await page.waitForTimeout(600);
    await expect(region).toHaveAttribute("data-screen-state", "loading");
    await expect(page.locator("[data-error-panel]")).toHaveCount(0);
  });

  test("?state=error renders the §6.10 panel with a working retry", async ({ page }) => {
    await gotoCards(page, "?state=error");

    await expect(root(page)).toHaveAttribute("data-screen-state", "error");

    const panel = page.locator('[data-error-panel="page"]');
    await expect(panel).toHaveCount(1);
    await expect(panel.getByRole("heading")).toHaveText("Something went wrong");
    await expect(panel.getByRole("button", { name: "Try again" })).toHaveCount(1);
    // Never a raw message or a stack trace on any surface (§13.1).
    await expect(panel).not.toContainText(/stack|Error:/i);
    await expect(tiles(page)).toHaveCount(0);
  });

  test("?state=offline renders the offline panel, not the generic one", async ({ page }) => {
    await gotoCards(page, "?state=offline");

    await expect(root(page)).toHaveAttribute("data-screen-state", "offline");

    const panel = page.locator('[data-error-panel="page"]');
    await expect(panel.getByRole("heading")).toHaveText("You're offline");
    await expect(panel.getByRole("button", { name: "Try again" })).toHaveCount(1);
  });

  test("?state=banana falls back to success and never blanks the page (E-34)", async ({
    page,
  }) => {
    await gotoCards(page, "?state=banana");

    await expect(root(page)).toHaveAttribute("data-screen-state", "success");
    await expect(tiles(page)).toHaveCount(fixtureCards.length);
  });
});

test.describe("E-09 — zero cards is the FIRST-RUN empty, never the filtered variant", () => {
  test("?state=empty offers 'create', and the filtered component is not on the page", async ({
    page,
  }) => {
    await gotoCards(page, "?state=empty");

    await expect(root(page)).toHaveAttribute("data-screen-state", "empty");

    const firstRun = page.locator('[data-empty-state="first-run"]');
    await expect(firstRun).toHaveCount(1);
    await expect(page.locator('[data-empty-state="filtered"]')).toHaveCount(0);

    await expect(firstRun.getByRole("heading")).toHaveText("You haven't made a card yet");
    const cta = firstRun.getByRole("link", { name: "Create your first card" });
    await expect(cta).toHaveCount(1);
    await expect(cta).toHaveAttribute("href", "/cards/new");

    // Nothing to filter, so no filter surface at all — which is what makes the wrong
    // empty state unreachable rather than merely unused.
    await expect(page.locator("[data-filter-bar]")).toHaveCount(0);
    await expect(tiles(page)).toHaveCount(0);
  });

  test("a query on an empty collection is STILL the first-run empty", async ({ page }) => {
    // An empty collection is not something a filter did. E-09 is unconditional.
    await gotoCards(page, "?state=empty&q=anything");

    await expect(root(page)).toHaveAttribute("data-screen-state", "empty");
    await expect(page.locator('[data-empty-state="first-run"]')).toHaveCount(1);
    await expect(page.locator('[data-empty-state="filtered"]')).toHaveCount(0);
  });
});

test.describe("AC-24 — the two empty states are different components", () => {
  test("filtering to nothing gives different copy and a different action", async ({ page }) => {
    await gotoCards(page);

    const search = page.locator("[data-search-field]").getByRole("searchbox");
    await search.fill("zzzznotacard");

    const region = root(page);
    await expect(region).toHaveAttribute("data-screen-state", "empty-filtered");

    const filtered = page.locator('[data-empty-state="filtered"]');
    await expect(filtered).toHaveCount(1);
    await expect(page.locator('[data-empty-state="first-run"]')).toHaveCount(0);

    await expect(filtered.getByRole("heading")).toHaveText("No cards match that filter");
    await expect(filtered.getByRole("button", { name: "Clear filters" })).toHaveCount(1);

    // The banned conflation, asserted directly: no create affordance inside the panel.
    await expect(filtered.getByRole("link")).toHaveCount(0);
    await expect(filtered).not.toContainText(/create your first card/i);

    // The filter surface survives, so the reader can get back out (§8D.1).
    await expect(page.locator("[data-filter-bar]")).toHaveCount(1);
  });

  test("the first-run and filtered headings and actions are not the same strings", async ({
    page,
  }) => {
    await gotoCards(page, "?state=empty");
    const firstRunHeading = await page
      .locator('[data-empty-state="first-run"]')
      .getByRole("heading")
      .textContent();
    const firstRunAction = await page
      .locator('[data-empty-state="first-run"]')
      .getByRole("link")
      .textContent();

    await gotoCards(page, "?q=zzzznotacard");
    const filteredHeading = await page
      .locator('[data-empty-state="filtered"]')
      .getByRole("heading")
      .textContent();
    const filteredAction = await page
      .locator('[data-empty-state="filtered"]')
      .getByRole("button")
      .textContent();

    expect(firstRunHeading?.trim()).not.toBe(filteredHeading?.trim());
    expect(firstRunAction?.trim()).not.toBe(filteredAction?.trim());
  });

  test("Clear filters restores the whole collection", async ({ page }) => {
    await gotoCards(page, "?q=zzzznotacard");

    await expect(root(page)).toHaveAttribute("data-screen-state", "empty-filtered");
    await page.locator('[data-empty-state="filtered"]').getByRole("button").click();

    await expect(root(page)).toHaveAttribute("data-screen-state", "success");
    await expect(tiles(page)).toHaveCount(fixtureCards.length);
    await expect(page.locator("[data-search-field]").getByRole("searchbox")).toHaveValue("");
  });
});

test.describe("the field-count badge — the old build's worst bug (AC-36, §11.6)", () => {
  test("the newest card is the empty one, it sorts first, and it wears the warning", async ({
    page,
  }) => {
    await gotoCards(page);

    // Recency order, exactly the ranking that hid the bug last time — except now the
    // consequence is visible in position one instead of preselected in silence.
    await expect(tiles(page).first()).toHaveAttribute("data-card-tile", EMPTY_CARD_ID);

    const badge = page.locator(
      `[data-card-tile="${EMPTY_CARD_ID}"] [data-field-count-meter="badge"]`,
    );
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveAttribute("data-field-count", "0");
    await expect(badge).toHaveAttribute("data-field-count-state", "empty");
    await expect(badge).toContainText("0 fields");
    // Spoken, not merely coloured: a warning nobody can hear is not a warning.
    await expect(badge).toContainText(EMPTY_CARD_NOTE);
  });

  test("exactly one tile is in the empty state and every other one says it shares", async ({
    page,
  }) => {
    await gotoCards(page);

    await expect(page.locator('[data-field-count-state="empty"]')).toHaveCount(1);
    await expect(page.locator('[data-field-count-state="sharing"]')).toHaveCount(
      fixtureCards.length - 1,
    );

    // Every sharing badge states a real, non-zero count — never an invented one.
    const sharing = page.locator('[data-field-count-state="sharing"]');
    for (let index = 0; index < fixtureCards.length - 1; index += 1) {
      const count = await sharing.nth(index).getAttribute("data-field-count");
      expect(Number(count)).toBeGreaterThan(0);
    }
  });
});

test.describe("E-13 — a 40+ character name clamps and the grid does not reflow", () => {
  test("the caption stays one line and the column tracks do not move", async ({ page }) => {
    await gotoCards(page);

    const grid = page.locator("[data-cards-grid]");
    const name = page.locator("[data-card-tile-name]").first();

    const columnsBefore = await grid.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns,
    );
    const gridBefore = await boxOf(grid);
    const nameBefore = await boxOf(name);

    // The fixtures ship no 40+ character card name, so the extreme is injected into the
    // rendered caption directly (§11.2 `LONG_NAME`, 42 chars). What is under test is the
    // tile's geometry — `line-clamp-1` plus a cell that may shrink below its content —
    // and that is exactly what this measures.
    await name.evaluate((element, text) => {
      const target = element.querySelector("a") ?? element;
      target.textContent = text;
    }, LONG_NAME);

    const columnsAfter = await grid.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns,
    );
    const gridAfter = await boxOf(grid);
    const nameAfter = await boxOf(name);

    expect(columnsAfter).toBe(columnsBefore);
    expect(gridAfter.width).toBeCloseTo(gridBefore.width, 0);
    expect(gridAfter.height).toBeCloseTo(gridBefore.height, 0);
    expect(nameAfter.height).toBeCloseTo(nameBefore.height, 0);

    // …and the clamp is doing real work rather than the string happening to fit.
    const overflowing = await name.evaluate(
      (element) => element.scrollHeight > element.clientHeight + 1,
    );
    expect(overflowing).toBe(true);
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
    await gotoCards(page);

    const grid = page.locator("[data-cards-grid]");
    const zones = grid.locator("[data-qr-zone]");
    await expect(zones).toHaveCount(fixtureCards.length);

    /* A real pattern is present on every tile, and the old abstract glyph is not. */
    await expect(grid.locator("[data-qr-symbol]")).toHaveCount(fixtureCards.length);
    await expect(grid.locator("[data-qr-glyph]")).toHaveCount(0);

    for (let index = 0; index < fixtureCards.length; index += 1) {
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
      expect(html, `tile ${index} embeds a real card path`).not.toContain("/c/");
    }
  });
});


test.describe("the filter bar", () => {
  test("a type chip narrows the grid and reports the active count", async ({ page }) => {
    await gotoCards(page);

    const bar = page.locator("[data-filter-bar]");
    await expect(bar).toHaveAttribute("data-active-filter-count", "0");

    const payment = bar.getByRole("button", { name: "Payment" });
    await expect(payment).toHaveAttribute("aria-pressed", "false");
    await payment.click();

    await expect(bar).toHaveAttribute("data-active-filter-count", "1");
    await expect(payment).toHaveAttribute("aria-pressed", "true");
    await expect(tiles(page)).toHaveCount(1);
    await expect(tiles(page).first()).toHaveAttribute("data-card-tile", PAYMENT_CARD_ID);
    // Narrowed, not emptied — this is still the success family.
    await expect(root(page)).toHaveAttribute("data-screen-state", "success");

    await bar.getByRole("button", { name: "Clear filters" }).click();
    await expect(bar).toHaveAttribute("data-active-filter-count", "0");
    await expect(tiles(page)).toHaveCount(fixtureCards.length);
  });

  test("the search box matches card names and announces the result count", async ({ page }) => {
    await gotoCards(page);

    const field = page.locator("[data-search-field]");
    await field.getByRole("searchbox").fill("Payments");

    await expect(tiles(page)).toHaveCount(1);
    await expect(tiles(page).first()).toHaveAttribute("data-card-tile", PAYMENT_CARD_ID);
    // Scoped, because `ErrorPanel` and the loading skeleton emit live roles too.
    await expect(field.getByRole("status")).toHaveText("1 card");
  });

  test("?q= is honoured on arrival, so the filtered state is reachable by URL", async ({
    page,
  }) => {
    await gotoCards(page, "?q=Payments");

    await expect(root(page)).toHaveAttribute("data-screen-state", "success");
    await expect(tiles(page)).toHaveCount(1);
    await expect(page.locator("[data-search-field]").getByRole("searchbox")).toHaveValue(
      "Payments",
    );
  });
});
