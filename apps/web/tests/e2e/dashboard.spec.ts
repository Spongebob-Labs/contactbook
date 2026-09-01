import { expect, test, type Locator, type Page } from "@playwright/test";

import { EMPTY_CARD_NOTE } from "@/components/app";
import { fixtureCards, fixtureContacts, fixtureFields } from "@/fixtures";

import { PROJECT_VIEWPORT, boxOf, gotoReady } from "../helpers/e2e";

/**
 * `/dashboard` — the owner's landing surface (spec §8D.3 dashboard row, §6.1 R-09,
 * §4.4 step 1, AC-24, AC-16 surface, §11 E-09).
 *
 * ## The three things this file is really guarding
 *
 * 1. **Zero cards is the FIRST-RUN empty, and only ever that** (§11 E-09, AC-24). The
 *    dashboard has no search and no filter, so `EmptyFilteredState` must never appear on
 *    it under any query. It is asserted on `data-empty-state` *and* on the copy *and* on
 *    the action, because any one of the three alone is trivially satisfiable — and because
 *    the failure mode is silent: omitting `isFiltered` is correct here and passing it
 *    would downgrade the copy to "Clear filters" with no test in T10 going red.
 *
 * 2. **The featured card is the worst card, wearing its warning.** "Most recently updated"
 *    resolves to `card_empty_demo`, which maps **zero** fields — the fixtures reproduce the
 *    old build's `5a286f9e` bug on purpose (§11.6). A dashboard that sorted it quietly out
 *    of sight would pass a naive "does a card render" test and reproduce the bug, so the
 *    identity of the featured card is pinned to the fixture data, not to a class or a
 *    position.
 *
 * 3. **Nothing shifts between waiting and arrived** (§8D.1, AC-17). The bones carry the
 *    same `data-dashboard-region` handles the real content does, so the same selector
 *    addresses the same box in both states and the loading layout is checkable rather than
 *    asserted by eye.
 *
 * ## Two conventions that are easy to get wrong here
 *
 * - **Never a bare `getByRole('status')`.** The loading surface renders three polite live
 *   regions — one per region, each naming what it waits for — and `ErrorPanel` adds a
 *   `role="alert"` on the failure surface. Every live-region query below is scoped by
 *   `[data-dashboard-region]`.
 * - **Layout is read from real geometry, never from a class name.** A `lg:order-2` that
 *   never matches would pass a class check and still put the card in the wrong column.
 */

/** The card the whole screen is a guard against (§11.6). Derived, then pinned. */
const NEWEST_CARD = [...fixtureCards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

/** §8D.3: "a 'Recent contacts' list of 5". */
const RECENT_CONTACT_COUNT = 5;

/**
 * The five most recently added contacts, newest first — the order the list must render.
 *
 * `createdAt`, not `savedAt`: a contact is a recipient you added, not a lead who saved
 * themselves to you. See `types/domain.ts`.
 */
const RECENT_CONTACT_IDS = [...fixtureContacts]
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  .slice(0, RECENT_CONTACT_COUNT)
  .map((contact) => contact.id);

/** The `lg` breakpoint the two-column layout turns on at (§8D.3: ≥1024px). */
const TWO_COLUMN_FROM = 1024;

function root(page: Page): Locator {
  return page.locator("[data-screen-state]").first();
}

function region(page: Page, name: string): Locator {
  return page.locator(`[data-dashboard-region="${name}"]`);
}

async function gotoDashboard(page: Page, query = ""): Promise<void> {
  await gotoReady(page, `/dashboard${query}`);
  // ── barrier, not a redundant assertion — do not delete this line ──────────────────
  // `gotoReady`'s `waitUntil: "load"` fires on the shell, before React swaps the Suspense
  // fallback out. Until it does, this route's DOM holds **zero** `[data-screen-state]`
  // elements (the dashboard's fallback deliberately carries none, so the swap can never
  // put two on the page — the failure mode C2 diagnosed on `/c/[slug]` in wave 7). A bare
  // `toHaveAttribute` here would read the pre-hydration DOM and die at the race;
  // `toHaveCount` retries, so it waits the swap out. Every assertion below inherits it.
  await expect(page.locator("[data-screen-state]")).toHaveCount(1);
  await root(page).waitFor();
}

function viewportOf(projectName: string): number {
  const width = PROJECT_VIEWPORT[projectName];
  if (width === undefined) throw new Error(`no viewport mapped for project "${projectName}"`);
  return width;
}

/**
 * Resolve a design token to the exact string `getComputedStyle` reports for it. Painting a
 * probe and reading it back measures the value that actually reached the page, and needs no
 * colour parser.
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

test.describe("the shell (§8D.3 dashboard row)", () => {
  test("renders one h1, one main, and a labelled section root", async ({ page }) => {
    await gotoDashboard(page);

    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toHaveCount(1);

    // AppShell owns the only `<main>`; this screen is a labelled `section` inside it.
    await expect(page.locator("main#main")).toHaveCount(1);
    await expect(root(page)).toHaveJSProperty("tagName", "SECTION");
    await expect(root(page)).toHaveAttribute("aria-label", "Dashboard overview");
    await expect(root(page)).toHaveAttribute("data-screen-state", "success");

    // The page header sits outside the Suspense boundary, so the title is never a bone
    // while the body is live.
    await expect(page.locator("[data-page-header]")).toHaveCount(1);
  });

  test("renders all three regions once each", async ({ page }) => {
    await gotoDashboard(page);

    await expect(region(page, "stats")).toHaveCount(1);
    await expect(region(page, "recent-card")).toHaveCount(1);
    await expect(region(page, "recent-contacts")).toHaveCount(1);
  });
});

test.describe("the three stat blocks (§8D.3: Cards · Contacts · Fields)", () => {
  test("counts come from the fixtures and render with tabular figures", async ({ page }) => {
    await gotoDashboard(page);

    const row = page.locator("[data-stat-row]");
    await expect(row).toHaveCount(1);
    await expect(row.locator("[data-stat]")).toHaveCount(3);

    const expected: ReadonlyArray<[string, string, number]> = [
      ["cards", "Cards", fixtureCards.length],
      ["contacts", "Contacts", fixtureContacts.length],
      ["fields", "Fields", fixtureFields.length],
    ];

    for (const [id, label, count] of expected) {
      const block = row.locator(`[data-stat="${id}"]`);
      await expect(block).toHaveCount(1);
      await expect(block).toContainText(label);

      const value = block.locator("[data-stat-value]");
      await expect(value).toHaveText(String(count));

      // Three blocks that do not align on their digits are three blocks that read as
      // decoration. `font-variant-numeric` is composed from custom properties in Tailwind
      // v4, so this is a containment check rather than an equality one.
      const numeric = await value.evaluate((el) => getComputedStyle(el).fontVariantNumeric);
      expect(numeric).toContain("tabular-nums");
    }
  });

  test("each block navigates to the collection it counts", async ({ page }) => {
    await gotoDashboard(page);

    const destinations: ReadonlyArray<[string, string]> = [
      ["cards", "/cards"],
      ["contacts", "/contacts"],
      ["fields", "/profile"],
    ];

    for (const [id, href] of destinations) {
      const link = page.locator(`[data-stat="${id}"]`).getByRole("link");
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute("href", href);
    }
  });
});

test.describe("the featured card (§4.4 step 1, AC-36)", () => {
  test("is the most recently updated card, rendered live in thumb mode", async ({ page }) => {
    await gotoDashboard(page);

    const tiles = page.locator("[data-card-tile]");
    await expect(tiles).toHaveCount(1);
    await expect(tiles).toHaveAttribute("data-card-tile", NEWEST_CARD.id);
    await expect(tiles).toContainText(NEWEST_CARD.name);

    // A live component, never a picture of one (§8C.2).
    const card = page.locator('[data-card-root][data-render-mode="thumb"]');
    await expect(card).toHaveCount(1);
    await expect(region(page, "recent-card").locator("[data-card-root]")).toHaveCount(1);

    // No `full`-mode card on this route, so no scannable symbol either (§8A.5).
    await expect(page.locator('[data-card-root][data-render-mode="full"]')).toHaveCount(0);
  });

  test("wears the zero-field warning in words, not only in colour (AC-36, §11 E-01)", async ({
    page,
  }) => {
    await gotoDashboard(page);

    const badge = region(page, "recent-card").locator("[data-field-count-state]");
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveAttribute("data-field-count-state", "empty");
    await expect(badge).toHaveAttribute("data-field-count", "0");
    await expect(badge).toContainText(EMPTY_CARD_NOTE);
  });

  test("offers exactly one way into the builder, and one into the card", async ({ page }) => {
    await gotoDashboard(page);

    const builder = page.locator("[data-dashboard-builder-link]");
    await expect(builder).toHaveCount(1);
    await expect(builder).toHaveAttribute("href", `/cards/${NEWEST_CARD.id}/edit`);
    await expect(builder).toHaveText("Open builder");

    // The tile's stretched link is the only other tab stop in the region — the thumb
    // itself is `aria-hidden` and inert.
    await expect(region(page, "recent-card").getByRole("link")).toHaveCount(2);
    await expect(
      region(page, "recent-card").getByRole("link", { name: NEWEST_CARD.name }),
    ).toHaveAttribute("href", `/cards/${NEWEST_CARD.id}`);
  });
});

test.describe("recent contacts (§8D.3: a list of 5)", () => {
  test("renders five rows, newest first, each linking to its contact", async ({ page }) => {
    await gotoDashboard(page);

    const rows = page.locator("[data-contact-row]");
    await expect(rows).toHaveCount(RECENT_CONTACT_COUNT);

    expect(fixtureContacts.length).toBeGreaterThan(RECENT_CONTACT_COUNT);

    for (const [index, id] of RECENT_CONTACT_IDS.entries()) {
      await expect(rows.nth(index)).toHaveAttribute("data-contact-row", id);
    }

    for (const id of RECENT_CONTACT_IDS) {
      const row = page.locator(`[data-contact-row="${id}"]`);
      await expect(row.getByRole("link").first()).toHaveAttribute("href", `/contacts/${id}`);
    }
  });

  test("is headed and offers the way to the rest of them", async ({ page }) => {
    await gotoDashboard(page);

    const section = region(page, "recent-contacts");
    await expect(section.getByRole("heading", { level: 2, name: "Recent contacts" })).toHaveCount(
      1,
    );
    await expect(section.getByRole("link", { name: "All contacts" })).toHaveAttribute(
      "href",
      "/contacts",
    );
  });
});

test.describe("the state matrix (AC-24, R-09: all four families)", () => {
  test("?state=success carries data-screen-state=success and the full surface", async ({
    page,
  }) => {
    await gotoDashboard(page, "?state=success");

    await expect(root(page)).toHaveAttribute("data-screen-state", "success");
    await expect(page.locator("[data-stat-row]")).toHaveCount(1);
    await expect(page.locator("[data-card-tile]")).toHaveCount(1);
    await expect(page.locator("[data-contact-row]")).toHaveCount(RECENT_CONTACT_COUNT);
  });

  test("?state=loading renders layout-matched bones and never resolves", async ({ page }) => {
    await gotoDashboard(page, "?state=loading");

    await expect(root(page)).toHaveAttribute("data-screen-state", "loading");
    await expect(root(page)).toHaveAttribute("aria-busy", "true");

    // §8D.3: "3 stat skeletons + one card-shaped skeleton" — plus the contact rows, so
    // nothing moves when five of them arrive under a settled layout.
    await expect(
      region(page, "stats").locator('[data-loading-skeleton="stats"] [data-skeleton-row]'),
    ).toHaveCount(3);
    await expect(
      region(page, "recent-card").locator('[data-loading-skeleton="card"] [data-skeleton-card]'),
    ).toHaveCount(1);
    await expect(
      region(page, "recent-contacts").locator(
        '[data-loading-skeleton="list"] [data-skeleton-row]',
      ),
    ).toHaveCount(RECENT_CONTACT_COUNT);

    // Bones, not content.
    await expect(page.locator("[data-stat-row]")).toHaveCount(0);
    await expect(page.locator("[data-card-tile]")).toHaveCount(0);
    await expect(page.locator("[data-contact-row]")).toHaveCount(0);

    // One polite live region per region, each announcing what it waits for. Scoped, never
    // a bare `getByRole('status')` — there are three of them.
    for (const name of ["stats", "recent-card", "recent-contacts"]) {
      await expect(region(page, name).getByRole("status")).toHaveCount(1);
    }
  });

  test("?state=empty is the FIRST-RUN empty and never the filtered one (E-09)", async ({
    page,
  }) => {
    await gotoDashboard(page, "?state=empty");

    await expect(root(page)).toHaveAttribute("data-screen-state", "empty");

    const empty = page.locator('[data-empty-state="first-run"]');
    await expect(empty).toHaveCount(1);
    await expect(empty).toContainText("Nothing here yet");

    // The whole point of AC-24: the filtered-to-nothing component must not exist here, and
    // its action must not appear under any name.
    await expect(page.locator('[data-empty-state="filtered"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /clear filters/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /clear filters/i })).toHaveCount(0);

    const create = empty.getByRole("link", { name: "Create your first card" });
    await expect(create).toHaveCount(1);
    await expect(create).toHaveAttribute("href", "/cards/new");

    // Nothing to summarise, so nothing is summarised.
    await expect(page.locator("[data-stat-row]")).toHaveCount(0);
    await expect(page.locator("[data-card-tile]")).toHaveCount(0);
    await expect(page.locator("[data-contact-row]")).toHaveCount(0);
  });

  test("no stray query can conjure the filtered empty state (AC-24)", async ({ page }) => {
    // The silent failure this guards: a screen with no filter that passes `isFiltered`
    // anyway downgrades its first-run empty to "Clear filters", and nothing in T10 goes
    // red because the machinery is correct and only the call site is wrong. Asserted from
    // the outside, with the query parameters a filtered screen would read.
    await gotoDashboard(page, "?state=empty&q=zzz&category=business&filter=none");

    await expect(root(page)).toHaveAttribute("data-screen-state", "empty");
    await expect(page.locator('[data-empty-state="first-run"]')).toHaveCount(1);
    await expect(page.locator('[data-empty-state="filtered"]')).toHaveCount(0);
  });

  test("carries no search and no filter at all (§8D.3 gives it none)", async ({ page }) => {
    await gotoDashboard(page);

    await expect(page.locator("[data-search-field]")).toHaveCount(0);
    await expect(page.locator("[data-filter-bar]")).toHaveCount(0);
  });

  test("?state=error renders the panel with a retry", async ({ page }) => {
    await gotoDashboard(page, "?state=error");

    await expect(root(page)).toHaveAttribute("data-screen-state", "error");

    const panel = page.locator('[data-error-panel="page"]');
    await expect(panel).toHaveCount(1);
    await expect(panel).toContainText("Something went wrong");
    await expect(panel.getByRole("button", { name: "Try again" })).toHaveCount(1);
    await expect(panel.getByRole("link", { name: "Go to your cards" })).toHaveAttribute(
      "href",
      "/cards",
    );

    // §6.10: no stack, no raw message, no error code as a headline.
    await expect(panel.locator("[data-error-digest]")).toHaveCount(0);
  });

  test("?state=offline says so, in the reader's language", async ({ page }) => {
    await gotoDashboard(page, "?state=offline");

    await expect(root(page)).toHaveAttribute("data-screen-state", "offline");

    const panel = page.locator('[data-error-panel="page"]');
    await expect(panel).toContainText("You're offline");
    await expect(panel).toContainText("Check your connection");
    await expect(panel.getByRole("button", { name: "Try again" })).toHaveCount(1);
  });

  test("an unrecognised ?state= falls back to success and never white-screens (E-34)", async ({
    page,
  }) => {
    await gotoDashboard(page, "?state=banana");

    await expect(root(page)).toHaveAttribute("data-screen-state", "success");
    await expect(page.locator("[data-stat-row]")).toHaveCount(1);
  });
});

test.describe("layout (§8D.3: 2-col ≥1024px, stacked with the card first below)", () => {
  test("places the totals and the card by real geometry", async ({ page }, testInfo) => {
    await gotoDashboard(page);

    const stats = await boxOf(region(page, "stats"));
    const card = await boxOf(region(page, "recent-card"));

    if (viewportOf(testInfo.project.name) >= TWO_COLUMN_FROM) {
      // Totals left, card right, sharing a row.
      expect(stats.x + stats.width).toBeLessThanOrEqual(card.x + 1);
      expect(Math.abs(stats.y - card.y)).toBeLessThan(2);
    } else {
      // Stacked, and the card comes first — which is also its DOM order, so reading order
      // and visual order agree on the narrow viewport.
      expect(card.y + card.height).toBeLessThanOrEqual(stats.y + 1);
    }
  });

  test("keeps recent contacts below both of them at every width", async ({ page }) => {
    await gotoDashboard(page);

    const stats = await boxOf(region(page, "stats"));
    const card = await boxOf(region(page, "recent-card"));
    const contacts = await boxOf(region(page, "recent-contacts"));

    expect(contacts.y).toBeGreaterThan(stats.y);
    expect(contacts.y).toBeGreaterThan(card.y);
  });

  test("the waiting layout occupies the same columns as the arrived one", async ({
    page,
  }, testInfo) => {
    await gotoDashboard(page, "?state=loading");

    const stats = await boxOf(region(page, "stats"));
    const card = await boxOf(region(page, "recent-card"));

    if (viewportOf(testInfo.project.name) >= TWO_COLUMN_FROM) {
      expect(stats.x + stats.width).toBeLessThanOrEqual(card.x + 1);
    } else {
      expect(card.y + card.height).toBeLessThanOrEqual(stats.y + 1);
    }
  });
});

test.describe("AC-16 surface — the structural half of the 80/20 rule", () => {
  /**
   * The pixel measurement is T28's (`eighty-twenty.spec.ts`, ≥78% paper+ink). What is
   * asserted here is the reason that measurement passes: the dashboard paints **no ground
   * of its own**. Every region is transparent over the shell's `--canvas`, so restraint is
   * the default rather than something each region has to remember (§8.7, §8C.2).
   */
  test("every dashboard region is transparent over the paper ground", async ({ page }) => {
    await gotoDashboard(page);

    const paper = await resolvedTokenColour(page, "--canvas");
    await expect(page.locator("[data-app-shell]")).toHaveCSS("background-color", paper);

    await expect(root(page)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    for (const name of ["stats", "recent-card", "recent-contacts"]) {
      await expect(region(page, name)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    }
  });

  test("separation comes from hairline rules, not from stacked panels (§8.7)", async ({
    page,
  }) => {
    await gotoDashboard(page);

    const rule = await resolvedTokenColour(page, "--line");
    const row = page.locator("[data-stat-row]");
    await expect(row).toHaveCSS("border-top-color", rule);
    await expect(row).toHaveCSS("border-bottom-color", rule);
  });
});
