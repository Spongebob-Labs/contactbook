import { expect, test, type Locator, type Page } from "@playwright/test";

import { fixtureCards } from "@/fixtures";
import { LONG_NAME } from "@/fixtures/extremes";

import { PROJECT_VIEWPORT, boxOf, gotoReady } from "../helpers/e2e";
import { signIn } from "../helpers/session";

/* ⚠ `/cards` is a gated route — without a session cookie `proxy.ts` bounces every test here to
   `/signin/phone`, and the whole file was asserting against the sign-in screen. The same fix
   `profile.spec.ts` carries. */
test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

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
 * 3. **A tile draws the card and nothing else** — no QR, and no control of the list's own
 *    invention. A "Tap for QR" pill and a flip to a QR face lived here for one day and were
 *    removed: a tile is a picture of the card, and the whole tile is one link to that card's
 *    page. Asserted on the absence of a symbol *and* on the absence of a second tab stop,
 *    because a stretched link makes any control inside the preview unreachable anyway.
 *
 * Column counts are read from **computed style**, never from a class name: §8D.3 is about
 * what the reader sees, and an `xl:grid-cols-3` that never matches would pass a class check.
 */

/** §8D.3: 3-up ≥1280px, 2-up 768–1279px, 1-up ≤767px. */
/**
 * The list tile is `TILE_ASPECT_CLASS` — `aspect-[336/620]`, and NOT the face's 336×500.
 *
 * ⚠ The two parted on 2026-09-21. The gallery's template cells are still the face's proportion;
 * a tile on this screen opens its window to `TILE_CROP_HEIGHT` so a reader sees field rows and
 * not only the hero, then draws its own foot. The bones and the tiles have to agree or the grid
 * shifts the moment the cards arrive (AC-17).
 */
const TILE_ASPECT = 620 / 336;

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

  /**
   * ⚠ **The whole tile is the link, not just its name.** `after:absolute after:inset-0` on the
   * name's anchor stretches it over the preview, so a click anywhere on the card opens that
   * card's page — which is also why nothing inside the preview may be interactive.
   */
  test("every tile links to its own card detail route, from anywhere on the card", async ({
    page,
  }) => {
    await gotoCards(page);

    for (const card of fixtureCards) {
      const tile = page.locator(`[data-card-tile="${card.id}"]`);
      const link = tile.getByRole("link");
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute("href", `/cards/${card.id}`);

      /* Exactly one tab stop per tile: everything in the preview is inert. */
      await expect(tile.locator("button")).toHaveCount(0);
    }
  });

  /** Clicking the card itself — not the caption — navigates. The stretched link, proven. */
  test("clicking the preview opens that card's page", async ({ page }) => {
    await gotoCards(page);

    const target = fixtureCards[0];
    await page.locator(`[data-card-tile="${target.id}"] [data-card-tile-preview]`).click();
    await expect(page).toHaveURL(new RegExp(`/cards/${target.id}$`));
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

    await expect(firstRun.getByRole("heading")).toHaveText("No cards yet");
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
    await expect(badge).toContainText("No fields yet");
    // Spoken, not merely coloured: a warning nobody can hear is not a warning.
    await expect(badge).toContainText(EMPTY_CARD_NOTE);
  });

  test("exactly one tile wears the warning, and no tile prints a count or a template name", async ({
    page,
  }) => {
    await gotoCards(page);

    await expect(page.locator('[data-field-count-state="empty"]')).toHaveCount(1);
    /* Client, 2026-09-28: the "Meridian · 5 fields" caption was confusing. A card that shares
       something carries neither, so the only badge in the grid is the warning above. */
    await expect(page.locator("[data-field-count-meter]")).toHaveCount(1);
    await expect(page.locator("[data-card-tile-template]")).toHaveCount(0);
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
 * A TILE DRAWS THE CARD, AND NOTHING OF THE LIST'S OWN.
 *
 * ## What this block has asserted, in three versions, and why it is back where it started
 *
 * It read *"a thumb QR must not decode"*, then *"a thumb QR is a real pattern with a dummy
 * payload"*, then *"the tile turns over to its QR"*. All three described a symbol in the grid.
 * There is none, and there is not meant to be: the tile is a **picture of the card**, the card
 * page carries no symbol, and a list of card pages carries none either.
 *
 * The flip-to-QR was added on 2026-09-21 and removed the same day at the client's instruction.
 * The reasoning is worth keeping because it is a rule and not a preference: a reader looking at
 * a tile must be able to trust that what they see is what the card is, and the moment the list
 * draws a control on top of the card they cannot. The real, scannable QR lives on
 * `<ShareFace>`, which is what `/cards/{id}` shows at full size — and clicking a tile is how a
 * reader gets there.
 */
test.describe("a tile is the card and nothing else", () => {
  test("draws no QR anywhere in the grid", async ({ page }) => {
    await gotoCards(page);

    const grid = page.locator("[data-cards-grid]");
    await expect(grid.locator("[data-qr-zone]")).toHaveCount(0);
    await expect(grid.locator("[data-qr-symbol]")).toHaveCount(0);
    await expect(grid.locator("[data-qr-glyph]")).toHaveCount(0);
  });

  /**
   * The cover and the logo are the two slots a tile is most likely to drop silently, because
   * both resolve through a ladder that ends in a fallback — `resolveCover` returns `none` and
   * `resolveBadge` falls through to a monogram. A tile missing one looks like a design choice
   * rather than a bug, so it is asserted against the fixtures that carry them.
   */
  test("draws each card's own cover and badge, exactly as the card page does", async ({
    page,
  }) => {
    await gotoCards(page);

    const grid = page.locator("[data-cards-grid]");

    /* Every tile paints a cover zone, and each names which kind it is — `photo` when the card
       has one, `none` when it does not. An absent `[data-card-cover]` means the tile is not
       rendering the real card. */
    const covers = grid.locator("[data-card-cover]");
    await expect(covers).toHaveCount(fixtureCards.length);
    for (const kind of await covers.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("data-cover")),
    )) {
      expect(["photo", "none"]).toContain(kind);
    }

    /* Every tile paints a badge — a logo when the card has one, its owner's initials when not
       (§11 E-19: never an empty ring). */
    await expect(grid.locator("[data-card-badge]")).toHaveCount(fixtureCards.length);

    /* And a card carrying a cover photograph shows that photograph in its tile. */
    const photos = grid.locator("[data-card-cover-photo]");
    const withPhoto = fixtureCards.filter((card) => (card.coverUrl ?? "").trim() !== "").length;
    await expect(photos).toHaveCount(withPhoto);
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
