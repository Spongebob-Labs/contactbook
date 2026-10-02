import { expect, test, type Locator, type Page } from "@playwright/test";

import { profileCompleteness } from "@/components/dashboard/profile-completeness";
import { fixtureCards, fixtureContacts, fixtureFields, fixtureGroups, fixtureUser } from "@/fixtures";

import { PROJECT_VIEWPORT, boxOf, gotoReady } from "../helpers/e2e";
import { STATE_QUERIES, withState, type StateQuery } from "../helpers/routes";
import { signIn } from "../helpers/session";

/**
 * `/dashboard` — the owner's landing surface (spec §8D.3 dashboard row, §6.1 R-09,
 * §4.4 step 1, AC-24, AC-16 surface, §11 E-09).
 *
 * ## The four things this file is really guarding
 *
 * 1. **Zero cards is the FIRST-RUN empty, and only ever that** (§11 E-09, AC-24). The
 *    dashboard has no search and no filter, so `EmptyFilteredState` must never appear on
 *    it under any query. Since 2026-09-28 the first-run state is the three tiles with their
 *    own empty actions (the Cards tile prompts "Create your first card"), not a page-wide
 *    panel, and the sharing analytics are absent because there is nothing to measure.
 *
 * 2. **Profile → Cards → Contacts lead the page, in that order** (client feedback,
 *    2026-09-28: "logical onboarding flow"). Three summary tiles, one row of three from
 *    1024px and stacked below it, then the sharing analytics under them. The order is asserted
 *    from `boxOf(...)` geometry, never from the DOM: the reach panel once regressed to the
 *    BOTTOM of the screen because a `lg:order-1` was applied inside `SHELL_CLASS`, which is a
 *    flex *column*, and a DOM-order check passed happily the whole time.
 *
 * 3. **Nothing shifts between waiting and arrived** (§8D.1, AC-17). `DashboardBones` mirrors
 *    the arrived layout row for row and carries the same `data-dashboard-region` handles, so
 *    the same selector addresses the same box in both states and the claim is measurable
 *    rather than asserted by eye. When the two disagreed — bones in a two-column grid,
 *    content in a stack — the page visibly re-flowed on every load.
 *
 * 4. **No green.** A mint `--dash-*` family was scoped to this screen and **deleted on
 *    2026-09-20 at the client's explicit instruction**. Nothing replaced it: `/dashboard`
 *    draws from the same Surfaces / Ink / Lines / Accent ladder as every other screen. The
 *    sweep at the bottom of this file is the guard, and it is a *computed-style* sweep
 *    rather than a grep for `--dash-` because the defect is "the dashboard went green
 *    again", not "one particular token name came back".
 *
 * ## Two conventions that are easy to get wrong here
 *
 * - **Never a bare `getByRole('status')`.** The loading surface renders **five** polite live
 *   regions — one per skeleton, each naming what it waits for — and `ErrorPanel` adds a
 *   `role="alert"` on the failure surface. Every live-region query below is scoped by
 *   `[data-dashboard-region]` and named.
 * - **Layout is read from real geometry, never from a class name.** A `lg:order-2` that
 *   never matches would pass a class check and still put a region in the wrong place; an
 *   `lg:order-1` that *did* match is what shipped the defect in point 2.
 */

/* ⚠ **Without this the entire file was dark, and silently so.**
   `proxy.ts` gates `/dashboard` and bounces a session-less request to `/signin/phone`, so every
   assertion below resolved against the phone-number form and failed as "element not found" —
   which reads like a product bug and is not one. `contacts`, `profile`, `builder` and
   `card-detail` all sign in; this file was simply never updated when the gate landed, and a
   visible dashboard regression shipped underneath it. See `tests/helpers/session.ts`. */
test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

const DASHBOARD = "/dashboard";

/**
 * The three summary tiles, **in the order the client asked for** ("Profile, Cards, Contacts").
 * Left to right from 1024px, top to bottom below it. The JSX is what has to match this array.
 */
const TILE_ORDER = ["profile", "cards", "contacts"] as const;

/** The sharing analytics under the tiles: score beside the queue, then the two charts. */
const SHARING_REGIONS = ["stats", "attention", "charts"] as const;

/** Every region, for the sweeps that walk them all. */
const REGION_ORDER = [...TILE_ORDER, ...SHARING_REGIONS] as const;

/**
 * Regions the rebuilds **deleted**. Asserted to be absent rather than quietly dropped from the
 * suite, because a half-reverted rebuild is exactly the state in which a stale region comes
 * back on its own.
 *
 * - `recent-card` — one big thumbnail of the card the owner had just been editing. The Cards
 *   tile shows up to three small ones instead, as a summary, and its zero-field warning badge
 *   (`[data-field-count-state]`) still lives only on `/cards`.
 * - `recent-contacts` — the old standalone list. The three newest contacts are back, but inside
 *   the Contacts tile (`contacts`), not as a region of their own.
 * - `profile-strength` — the "N of M groups filled" block. It folded into the Profile tile,
 *   whose completeness is measured against a named key set.
 */
const REMOVED_REGIONS = ["recent-card", "recent-contacts", "profile-strength"] as const;

/** The `lg` breakpoint the multi-column rows turn on at (§8D.3: ≥1024px). */
const TWO_COLUMN_FROM = 1024;

/** What each skeleton announces while it waits, per region. The bones' own contract. */
const LOADING_ANNOUNCEMENTS: ReadonlyArray<[string, readonly string[]]> = [
  ["profile", ["Loading your profile"]],
  ["cards", ["Loading your cards"]],
  ["contacts", ["Loading your contacts"]],
  ["stats", ["Loading your reach score"]],
  ["attention", ["Loading what needs attention"]],
  ["charts", ["Loading links shared per week", "Loading your cards by opens"]],
];

/** At most this many card thumbnails and recent contacts (`CARD_THUMB_LIMIT`, `RECENT_CONTACT_LIMIT`). */
const TILE_PREVIEW_MAX = 3;

function root(page: Page): Locator {
  return page.locator("[data-screen-state]");
}

/**
 * The screen's own page header. ⚠ Not a bare `[data-page-header]`: the card page renders its own
 * header with the same handle, and the Cards tile's thumbnails are the card page in miniature
 * (inside an `aria-hidden` wrapper), so the bare selector matched four elements.
 */
function pageHeader(page: Page): Locator {
  return page.locator('[data-page-header]:not([aria-hidden="true"] *)');
}

function region(page: Page, name: string): Locator {
  return page.locator(`[data-dashboard-region="${name}"]`);
}

/**
 * The outermost node of a region, for geometry and for computed style. `.first()` so that a
 * wrapper re-acquiring a component's own handle (the `attention` wart, fixed) costs a warning
 * in the count test rather than a strict-mode throw in every measurement.
 */
function regionRoot(page: Page, name: string): Locator {
  return region(page, name).first();
}

async function gotoDashboard(page: Page, url: string = DASHBOARD): Promise<void> {
  await gotoReady(page, url);
  // ── barrier 1, not a redundant assertion — do not delete this line ────────────────
  // `gotoReady`'s `waitUntil: "load"` fires on the shell, before React swaps the Suspense
  // fallback out. Until it does, this route's DOM holds **zero** `[data-screen-state]`
  // elements (the dashboard's fallback deliberately carries none, so the swap can never
  // put two on the page — the failure mode C2 diagnosed on `/c/[slug]` in wave 7). A bare
  // `toHaveAttribute` here would read the pre-hydration DOM and die at the race;
  // `toHaveCount` retries, so it waits the swap out. Every assertion below inherits it.
  await expect(root(page)).toHaveCount(1);
  await root(page).waitFor();

  // ── barrier 2 — the one the API migration made necessary ──────────────────────────
  // This screen fetches from the browser now (`useApiResource`), so its FIRST client render
  // is `data-screen-state="loading"` on every navigation, whatever the data turns out to be.
  // Playwright's own assertions retry past that, but a bare `locator.count()` or `boxOf()`
  // does not — it would measure the bones and report the arrived layout as wrong. Waiting
  // the fetch out here means no test below has to remember, and none can opt out by accident.
  if (!url.includes("state=loading")) {
    await expect(root(page)).not.toHaveAttribute("data-screen-state", "loading");
  }
}

/** `?state=` through the shared helper, so the param name can never drift from §6.3. */
function stateUrl(state: StateQuery, extraQuery = ""): string {
  return `${withState(DASHBOARD, state)}${extraQuery}`;
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
 *
 * ⚠ This is why the AC-16 assertions below survived the move to the cream ground: they name
 * `--canvas`, never `#fff`. When `--canvas` went from white to `#FCFAF8` not one of them had
 * to change, and every one of them still measures the real paint.
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

/* ── the green sweep's two primitives, in Node so one implementation serves both ends ──── */

/** Every computed property that can put paint on the screen. */
const PAINT_PROPERTIES = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "textDecorationColor",
  "columnRuleColor",
  "fill",
  "stroke",
] as const;

/**
 * How far the green channel has to lead **both** others before a colour reads as green.
 *
 * 8 is not arbitrary. It is under the margin of the deleted mint's lightest step
 * (`--dash-wash`-class values sit around +10/+17), so the family cannot creep back in as a
 * "barely tinted" surface; and it is above the ±5 wobble of the neutral creams
 * (`--canvas` #FCFAF8, `--warning-wash` #FFFAEB), which are warm, not green, and must not be
 * flagged. Both ends of that range are asserted in the sweep itself.
 */
const GREEN_CAST_MARGIN = 8;

function parseRgb(value: string): { r: number; g: number; b: number; a: number } | null {
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+%?))?\s*\)$/.exec(
    value,
  );
  if (m === null) return null;
  const alpha = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : +m[4];
  return { r: +m[1], g: +m[2], b: +m[3], a: alpha };
}

/** A colour whose green channel is meaningfully ahead of both red and blue. */
function isGreenCast(value: string, margin = GREEN_CAST_MARGIN): boolean {
  const rgb = parseRgb(value);
  if (rgb === null || rgb.a === 0) return false;
  return rgb.g - rgb.r > margin && rgb.g - rgb.b > margin;
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
    await expect(pageHeader(page)).toHaveCount(1);
  });

  /**
   * AC-25, the half of it a landmark audit cannot see.
   *
   * `ScreenStateRoot` will happily be told to render `main` instead of `section`, and a second
   * `<main>` fails axe's `landmark-unique` — but it fails it as a generic rule violation with
   * no indication of which of the nineteen screens introduced it. Asserted here, on the screen
   * that would cause it, so the failure names itself.
   *
   * The heading half is the same shape: `PageHeader` owns the `<h1>` in `page.tsx`, so every
   * heading the client renders starts at `h2` and the outline must never jump a level: the
   * three tiles and "Sharing" are `h2`, and everything inside the sharing section is `h3`.
   */
  test("has one landmark, one h1, and an outline that never skips a level (AC-25)", async ({
    page,
  }) => {
    await gotoDashboard(page);

    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.locator("main#main main")).toHaveCount(0);
    await expect(pageHeader(page)).toHaveCount(1);
    await expect(pageHeader(page).locator("h1")).toHaveCount(1);

    /* Headings inside an `aria-hidden` subtree are not in the outline a reader gets. The Cards
       tile's thumbnails are the card page in miniature, `aria-hidden` and `inert`, and each
       carries the card's own `<h1>`; counting those would fail "one h1" on markup no assistive
       technology can reach. */
    const levels = await page
      .locator("main#main")
      .locator("h1, h2, h3, h4, h5, h6")
      .evaluateAll((nodes) =>
        nodes
          .filter((n) => n.closest('[aria-hidden="true"]') === null)
          .map((n) => Number(n.tagName.slice(1))),
      );

    expect(levels[0], "the page must open on its h1").toBe(1);
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    for (let i = 1; i < levels.length; i += 1) {
      expect(
        levels[i],
        `heading ${i} (h${levels[i]}) jumps more than one level below h${levels[i - 1]}: ${levels.join(
          " → ",
        )}`,
      ).toBeLessThanOrEqual(levels[i - 1] + 1);
    }
  });

  /** The rebuilt region set, and the stale ones. */
  test("renders the three tiles and the sharing regions, and none of the old ones", async ({
    page,
  }) => {
    await gotoDashboard(page);

    for (const name of REGION_ORDER) {
      await expect(region(page, name), `region "${name}"`).toHaveCount(1);
    }
    await expect(region(page, "sharing")).toHaveCount(1);

    // The content each region is a handle for, once each.
    await expect(page.locator("[data-summary-tile]")).toHaveCount(TILE_ORDER.length);
    await expect(page.locator("[data-reach-panel]")).toHaveCount(1);
    await expect(page.locator("[data-activity-chart]")).toHaveCount(1);
    await expect(page.locator("[data-reach-bars]")).toHaveCount(1);

    for (const gone of REMOVED_REGIONS) {
      await expect(region(page, gone)).toHaveCount(0);
    }
    await expect(page.locator("[data-profile-strength]")).toHaveCount(0);

    /* The list tile (caption, type chip, field-count meter) belongs to `/cards`. The dashboard
       draws bare thumbnails, so none of the list's furniture may appear here. */
    await expect(page.locator("[data-card-tile]")).toHaveCount(0);
    await expect(page.locator("[data-field-count-state]")).toHaveCount(0);
    await expect(page.locator("[data-contact-row]")).toHaveCount(0);
  });
});

test.describe("the summary tiles (client feedback 2026-09-28)", () => {
  test("the Profile tile names the owner and measures the named key set", async ({ page }) => {
    await gotoDashboard(page);

    const tile = region(page, "profile");
    await expect(tile.getByRole("heading", { level: 2 })).toHaveCount(1);
    await expect(tile.locator("[data-profile-name]")).toHaveText(
      `${fixtureUser.firstName} ${fixtureUser.lastName}`,
    );

    const { done, total, missing } = profileCompleteness({
      user: fixtureUser,
      groups: fixtureGroups,
      fields: fixtureFields,
    });
    await expect(tile.locator("[data-profile-completeness]")).toHaveAttribute(
      "data-profile-completeness",
      `${done}/${total}`,
    );
    await expect(tile.locator("[data-profile-suggestion]")).toHaveCount(Math.min(2, missing.length));
    await expect(tile.getByRole("link", { name: /edit profile/i })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  /**
   * The tile rule, on the dashboard: a thumbnail is only the card's own design, the whole of it
   * is one link to the card, and nothing inside it is reachable. `aria-hidden` + `inert` on the
   * preview is what makes the single stretched link the only tab stop.
   */
  test("the Cards tile leads with the API's count and previews cards as bare links", async ({
    page,
  }) => {
    await gotoDashboard(page);

    const tile = region(page, "cards");
    await expect(tile.locator("[data-summary-tile-count]")).toContainText(
      String(fixtureCards.length),
    );

    const thumbs = tile.locator("[data-dashboard-card-thumb]");
    const count = await thumbs.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(TILE_PREVIEW_MAX);

    for (let i = 0; i < count; i += 1) {
      const thumb = thumbs.nth(i);
      const id = await thumb.getAttribute("data-dashboard-card-thumb");
      const reachable = thumb.locator("a:not([aria-hidden='true'] *)");
      await expect(reachable).toHaveCount(1);
      await expect(reachable).toHaveAttribute("href", `/cards/${id}`);
      await expect(thumb.locator("[data-card-thumb]")).toHaveAttribute("inert", "");
    }

    await expect(tile.locator("[data-cards-tile-new]")).toHaveAttribute("href", "/cards/new");
  });

  test("the Contacts tile leads with the API's count and lists the newest few", async ({
    page,
  }) => {
    await gotoDashboard(page);

    const tile = region(page, "contacts");
    await expect(tile.locator("[data-summary-tile-count]")).toContainText(
      String(fixtureContacts.length),
    );

    const rows = tile.locator("[data-contacts-tile-row]");
    await expect(rows).toHaveCount(Math.min(TILE_PREVIEW_MAX, fixtureContacts.length));
    const ids = await rows.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("data-contacts-tile-row")),
    );
    for (const [i, id] of ids.entries()) {
      await expect(rows.nth(i).locator("a")).toHaveAttribute("href", `/contacts/${id}`);
    }
  });
});

test.describe("the reach score panel (§8D.3 stats region)", () => {
  /**
   * The dial says the score **in words**.
   *
   * An SVG's `<text>` children are announced in document order with no relationship to one
   * another, so a reader hears "89" and then "REACH SCORE" as two unconnected strings. One
   * `role="img"` with a written label says the whole thing once — and it is the only part of
   * the panel a screen reader can get the headline from, because both `<text>` nodes are
   * `aria-hidden`.
   */
  test("the dial reports the score in words, and the arc agrees with them", async ({ page }) => {
    await gotoDashboard(page);

    const dial = page.locator("[data-reach-dial]");
    await expect(dial).toHaveCount(1);
    await expect(dial).toHaveAttribute("role", "img");

    const label = await dial.getAttribute("aria-label");
    const match = /^Reach score (\d+) out of 100$/.exec(label ?? "");
    expect(match, `the dial's label must name the score; got ${JSON.stringify(label)}`).not.toBeNull();

    const spoken = Number(match![1]);
    expect(spoken).toBeGreaterThanOrEqual(0);
    expect(spoken).toBeLessThanOrEqual(100);

    /* The attribute the arc is drawn from and the number that is spoken are two derivations
       of one score. The panel prints the levers beside it, so a disagreement of even a point
       is arithmetic the reader can do and get wrong. */
    await expect(dial).toHaveAttribute("data-reach-dial", String(spoken));
    await expect(page.getByRole("img", { name: label! })).toHaveCount(1);
  });

  /**
   * Status is never carried by colour alone.
   *
   * Every lever on the panel is one of exactly two things: an **open** one, which is a link to
   * the screen where the work happens, or a **finished** one, which carries
   * `data-reach-lever-done` *and* a tick glyph *and* past-tense copy. A finished lever that was
   * only dimmed would fail the project's accessibility floor and fail plain legibility at a
   * glance — so the shape is asserted rather than the shade.
   *
   * ⚠ The count is deliberately not pinned. A lever that is not *measurable* (an owner who has
   * shared nothing has no open-rate to be graded on) is dropped entirely rather than scored
   * zero — see `reach-score.ts` on UNKNOWN IS NOT ZERO — so the number of rows is a function of
   * the fixture's share links and pinning it would make this test a test of the fixtures.
   */
  test("every lever is either a link to the work or a finished row", async ({ page }) => {
    await gotoDashboard(page);

    const levers = page.locator("[data-reach-lever]");
    const count = await levers.count();
    expect(count, "the panel must show at least one lever or its 'no score yet' copy").toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const lever = levers.nth(i);
      const done = (await lever.getAttribute("data-reach-lever-done")) !== null;
      const tag = await lever.evaluate((el) => el.tagName);

      if (done) {
        // Finished: a static row, no destination, and a glyph beside the sentence.
        expect(tag, "a finished lever is not a link — there is nothing left to do").not.toBe("A");
        await expect(lever.locator("svg")).not.toHaveCount(0);
      } else {
        // Open: the whole row is the affordance, and it goes somewhere.
        expect(tag, "an open lever must be the link itself, not a row containing one").toBe("A");
        await expect(lever).toHaveAttribute("href", /^\/(cards|contacts)$/);
      }
    }
  });

  /**
   * The count strip — the two reach counts.
   *
   * "Cards" and "Contacts" left it on 2026-09-28: the summary tiles lead with them, and a
   * number printed twice on one screen invites the reader to reconcile the two.
   *
   * ⚠ Both are pinned to **0**, and that is the assertion with teeth. The harness mints no share
   * links at all (`tests/stubs/api-snapshot.ts`), so an owner in this state has reached nobody.
   * Any other number on this strip is an invented one.
   */
  test("the count strip carries the reach totals, from the data, in tabular figures", async ({
    page,
  }) => {
    await gotoDashboard(page);

    const strip = page.locator("[data-reach-counts]");
    await expect(strip).toHaveCount(1);

    const expected: ReadonlyArray<[string, number]> = [
      ["People reached", 0],
      ["Opens", 0],
    ];

    await expect(strip.locator("dt")).toHaveText(expected.map(([label]) => label));

    const values = strip.locator("dd");
    await expect(values).toHaveText(expected.map(([, value]) => String(value)));

    // `font-variant-numeric` is composed from custom properties in Tailwind v4, so this is a
    // containment check rather than an equality one.
    const numerics = await values.evaluateAll((nodes) =>
      nodes.map((n) => getComputedStyle(n).fontVariantNumeric),
    );
    for (const numeric of numerics) expect(numeric).toContain("tabular-nums");
  });
});

test.describe("the reading order: Profile → Cards → Contacts, then sharing", () => {
  /**
   * **The tiles come first, in the client's order, measured in pixels.**
   *
   * `SHELL_CLASS` is a flex *column*, so an `order` utility on one child does not arrange
   * columns, it reorders the page: `lg:order-1` once sent the headline panel to the bottom of
   * every desktop viewport while the DOM order stayed correct. Only `boxOf(...)` can tell the
   * difference, which is why every layout claim in this file is a geometry claim.
   */
  test("the three tiles run Profile → Cards → Contacts, across from 1024px and down below it", async ({
    page,
  }, testInfo) => {
    await gotoDashboard(page);

    const [profile, cards, contacts] = await Promise.all(
      TILE_ORDER.map((name) => boxOf(regionRoot(page, name))),
    );

    if (viewportOf(testInfo.project.name) >= TWO_COLUMN_FROM) {
      expect(profile!.x + profile!.width).toBeLessThanOrEqual(cards!.x + 1);
      expect(cards!.x + cards!.width).toBeLessThanOrEqual(contacts!.x + 1);
      expect(Math.abs(profile!.y - cards!.y)).toBeLessThan(2);
      expect(Math.abs(cards!.y - contacts!.y)).toBeLessThan(2);
      /* Same visual weight: one row, one height. */
      expect(Math.abs(profile!.height - contacts!.height)).toBeLessThan(2);
      expect(Math.abs(cards!.height - contacts!.height)).toBeLessThan(2);
    } else {
      expect(profile!.y + profile!.height).toBeLessThanOrEqual(cards!.y + 1);
      expect(cards!.y + cards!.height).toBeLessThanOrEqual(contacts!.y + 1);
    }
  });

  test("every sharing region sits below every tile, at every width", async ({ page }) => {
    await gotoDashboard(page);

    let tilesBottom = 0;
    for (const name of TILE_ORDER) {
      const box = await boxOf(regionRoot(page, name));
      tilesBottom = Math.max(tilesBottom, box.y + box.height);
    }
    for (const name of SHARING_REGIONS) {
      const box = await boxOf(regionRoot(page, name));
      expect(
        box.y,
        `"${name}" (y=${box.y}) must render below the summary tiles (bottom=${tilesBottom})`,
      ).toBeGreaterThanOrEqual(tilesBottom - 1);
    }
  });

  test("inside sharing: score beside the queue from 1024px, then the charts", async ({
    page,
  }, testInfo) => {
    await gotoDashboard(page);

    const stats = await boxOf(regionRoot(page, "stats"));
    const attention = await boxOf(regionRoot(page, "attention"));
    const charts = await boxOf(regionRoot(page, "charts"));

    if (viewportOf(testInfo.project.name) >= TWO_COLUMN_FROM) {
      expect(stats.x + stats.width).toBeLessThanOrEqual(attention.x + 1);
      expect(Math.abs(stats.y - attention.y)).toBeLessThan(2);
    } else {
      // Stacked in DOM order: the score first, which is the order that matters on a phone.
      expect(stats.y + stats.height).toBeLessThanOrEqual(attention.y + 1);
    }
    expect(charts.y).toBeGreaterThanOrEqual(Math.max(stats.y + stats.height, attention.y + attention.height) - 1);
  });
});

test.describe("layout (§8D.3: multi-column ≥1024px, stacked below)", () => {
  /**
   * Nested in a side column the two charts resolved to ~280px at a 1280px viewport, which puts
   * twelve weekly columns at 21px each and truncates every card name in the reach list. They get
   * the full width between them.
   */
  test("the two charts share a row above the breakpoint and stack below it", async ({
    page,
  }, testInfo) => {
    await gotoDashboard(page);

    const activity = await boxOf(page.locator("[data-activity-chart]"));
    const bars = await boxOf(page.locator("[data-reach-bars]"));

    if (viewportOf(testInfo.project.name) >= TWO_COLUMN_FROM) {
      expect(activity.x + activity.width).toBeLessThanOrEqual(bars.x + 1);
      expect(Math.abs(activity.y - bars.y)).toBeLessThan(2);
    } else {
      expect(activity.y + activity.height).toBeLessThanOrEqual(bars.y + 1);
    }
  });

  /** A tile's content may never widen the page: the thumbnails are sized by a breakpoint table. */
  test("nothing in the tiles overflows its tile or the viewport", async ({ page }) => {
    await gotoDashboard(page);

    const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewport = page.viewportSize()!.width;
    expect(scroll, "the page scrolls sideways").toBeLessThanOrEqual(viewport);

    for (const name of TILE_ORDER) {
      const tile = await boxOf(regionRoot(page, name));
      const thumbs = regionRoot(page, name).locator("[data-dashboard-card-thumb]");
      const count = await thumbs.count();
      for (let i = 0; i < count; i += 1) {
        if (!(await thumbs.nth(i).isVisible())) continue;
        const box = await boxOf(thumbs.nth(i));
        expect(box.x + box.width, `thumbnail ${i} runs past the ${name} tile`).toBeLessThanOrEqual(
          tile.x + tile.width + 0.5,
        );
      }
    }
  });

  /**
   * **Nothing shifts** (§8D.1, AC-17).
   *
   * The bones wear the same `data-dashboard-region` handles the real content does, so this is
   * a like-for-like measurement. Heights legitimately differ, so what is compared is the
   * arrangement: the same row order down the page, and the same columns across it.
   */
  test("the waiting layout occupies the same rows and columns as the arrived one", async ({
    page,
  }) => {
    const arrangement = async (): Promise<Record<string, { y: number; x: number }>> => {
      const out: Record<string, { y: number; x: number }> = {};
      for (const name of REGION_ORDER) {
        const box = await boxOf(regionRoot(page, name));
        out[name] = { y: box.y, x: box.x };
      }
      return out;
    };

    await gotoDashboard(page, stateUrl("loading"));
    const bones = await arrangement();

    await gotoDashboard(page);
    const arrived = await arrangement();

    for (const name of REGION_ORDER) {
      expect(bones[name]!.x, `"${name}" changes column when the data lands`).toBe(arrived[name]!.x);
    }
    for (const state of [bones, arrived]) {
      expect(state.stats!.y).toBeGreaterThan(state.contacts!.y);
      expect(state.charts!.y).toBeGreaterThan(state.stats!.y);
    }
    // The tiles start where they start: the first row is the same row, waiting and arrived.
    expect(bones.profile!.y).toBe(arrived.profile!.y);
  });
});

test.describe("the state matrix (AC-24, R-09: all four families)", () => {
  /** Every `?state=` value in §6.3 reaches `data-screen-state` unchanged. */
  for (const state of STATE_QUERIES) {
    test(`?state=${state} sets data-screen-state=${state}`, async ({ page }) => {
      await gotoDashboard(page, stateUrl(state));
      await expect(root(page)).toHaveAttribute("data-screen-state", state);
    });
  }

  test("?state=success carries the full surface", async ({ page }) => {
    await gotoDashboard(page, stateUrl("success"));

    await expect(root(page)).toHaveAttribute("data-screen-state", "success");
    await expect(page.locator("[data-summary-tile]")).toHaveCount(TILE_ORDER.length);
    await expect(page.locator("[data-reach-panel]")).toHaveCount(1);
    await expect(page.locator("[data-reach-counts]")).toHaveCount(1);
    await expect(page.locator("[data-activity-chart]")).toHaveCount(1);
    await expect(page.locator("[data-reach-bars]")).toHaveCount(1);
    expect(await page.locator("[data-attention-row]").count()).toBeGreaterThan(0);
  });

  /**
   * The bones, region by region.
   *
   * One polite live region per waiting part, each naming what it waits for. That is why every
   * query here is scoped **and** named rather than a bare `getByRole('status')`, which would
   * resolve to several elements and fail strict mode with a message about the wrong thing.
   */
  test("?state=loading renders layout-matched bones and never resolves", async ({ page }) => {
    await gotoDashboard(page, stateUrl("loading"));

    await expect(root(page)).toHaveAttribute("data-screen-state", "loading");
    await expect(root(page)).toHaveAttribute("aria-busy", "true");

    for (const name of TILE_ORDER) {
      await expect(region(page, name).locator('[data-loading-skeleton="tile"]')).toHaveCount(1);
    }
    await expect(
      region(page, "stats").locator('[data-loading-skeleton="stats"] [data-skeleton-row]'),
    ).toHaveCount(3);
    await expect(
      region(page, "attention").locator('[data-loading-skeleton="list"] [data-skeleton-row]'),
    ).toHaveCount(3);
    await expect(region(page, "charts").locator('[data-loading-skeleton="list"]')).toHaveCount(2);

    // Bones, not content.
    await expect(page.locator("[data-summary-tile]")).toHaveCount(0);
    await expect(page.locator("[data-reach-panel]")).toHaveCount(0);
    await expect(page.locator("[data-reach-counts]")).toHaveCount(0);
    await expect(page.locator("[data-attention-row]")).toHaveCount(0);

    /* ⚠ Matched on the live region's TEXT, not on `getByRole('status', { name })`. `status` is
       not a name-from-content role, so the `sr-only` sentence inside it is what a reader hears
       but is not the element's accessible name. */
    for (const [name, announcements] of LOADING_ANNOUNCEMENTS) {
      const live = region(page, name).getByRole("status");
      await expect(live).toHaveCount(announcements.length);
      for (const announcement of announcements) {
        await expect(live.filter({ hasText: announcement })).toHaveCount(1);
      }
    }
  });

  /**
   * The first day: no cards, no contacts, a profile holding only what sign-up asked for.
   * `?state=empty` is the harness's own copy of that world (`emptyDashboardHome`).
   */
  test("?state=empty is the FIRST-RUN empty and never the filtered one (E-09)", async ({
    page,
  }) => {
    await gotoDashboard(page, stateUrl("empty"));

    await expect(root(page)).toHaveAttribute("data-screen-state", "empty");

    // The whole point of AC-24: the filtered-to-nothing component must not exist here, and
    // its action must not appear under any name.
    await expect(page.locator('[data-empty-state="filtered"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /clear filters/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /clear filters/i })).toHaveCount(0);

    // Every tile is still there, and each empty one prompts an action rather than a sentence.
    for (const name of TILE_ORDER) await expect(region(page, name)).toHaveCount(1);
    await expect(region(page, "cards").locator("[data-cards-tile-create]")).toHaveAttribute(
      "href",
      "/cards/new",
    );
    await expect(region(page, "cards").locator("[data-dashboard-card-thumb]")).toHaveCount(0);
    await expect(region(page, "contacts").locator("[data-contacts-tile-action]")).toHaveAttribute(
      "href",
      "/cards/new",
    );
    await expect(region(page, "profile").locator("[data-profile-suggestion]")).toHaveCount(2);

    /* Nothing to measure, so nothing is measured — and in particular no score. An owner ninety
       seconds old has not scored zero; they have not played. */
    for (const name of SHARING_REGIONS) await expect(region(page, name)).toHaveCount(0);
    await expect(region(page, "sharing")).toHaveCount(0);
    await expect(page.locator("[data-reach-panel]")).toHaveCount(0);
    await expect(page.locator("[data-reach-dial]")).toHaveCount(0);
  });

  test("no stray query can conjure the filtered empty state (AC-24)", async ({ page }) => {
    // The silent failure this guards: a screen with no filter that passes `isFiltered`
    // anyway downgrades its first-run empty to "Clear filters". Asserted from the outside,
    // with the query parameters a filtered screen would read.
    await gotoDashboard(page, stateUrl("empty", "&q=zzz&category=business&filter=none"));

    await expect(root(page)).toHaveAttribute("data-screen-state", "empty");
    await expect(page.locator("[data-cards-tile-create]")).toHaveCount(1);
    await expect(page.locator('[data-empty-state="filtered"]')).toHaveCount(0);
  });

  test("carries no search and no filter at all (§8D.3 gives it none)", async ({ page }) => {
    await gotoDashboard(page);

    await expect(page.locator("[data-search-field]")).toHaveCount(0);
    await expect(page.locator("[data-filter-bar]")).toHaveCount(0);
  });

  test("?state=error renders the panel with a retry", async ({ page }) => {
    await gotoDashboard(page, stateUrl("error"));

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
    await gotoDashboard(page, stateUrl("offline"));

    await expect(root(page)).toHaveAttribute("data-screen-state", "offline");

    const panel = page.locator('[data-error-panel="page"]');
    await expect(panel).toContainText("You're offline");
    await expect(panel).toContainText("Check your connection");
    await expect(panel.getByRole("button", { name: "Try again" })).toHaveCount(1);
  });

  test("an unrecognised ?state= falls back to success and never white-screens (E-34)", async ({
    page,
  }) => {
    await gotoDashboard(page, `${DASHBOARD}?state=banana`);

    await expect(root(page)).toHaveAttribute("data-screen-state", "success");
    await expect(page.locator("[data-reach-panel]")).toHaveCount(1);
    await expect(regionRoot(page, "profile")).toBeVisible();
  });
});

test.describe("AC-16 surface — the structural half of the 80/20 rule", () => {
  /**
   * The pixel measurement is T28's (`eighty-twenty.spec.ts`, ≥78% paper+ink). What is
   * asserted here is the reason that measurement passes: the dashboard paints **no ground of
   * its own** beyond one lifted level (§8.7, §8C.2).
   *
   * ⚠ Since 2026-09-28 that level is the three summary tiles, and only them: `--surface`, a
   * hairline and a radius each. The reach panel used to be the lifted object and is now flat,
   * because two lifted levels one above the other flatten the hierarchy again. So the tiles are
   * pinned to `--surface`, and every other region, the reach panel included, to transparent.
   */
  test("the tiles are the one lifted level; everything else is transparent over the paper", async ({
    page,
  }) => {
    await gotoDashboard(page);

    const paper = await resolvedTokenColour(page, "--canvas");
    await expect(page.locator("[data-app-shell]")).toHaveCSS("background-color", paper);
    await expect(root(page)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    const surface = await resolvedTokenColour(page, "--surface");
    for (const name of TILE_ORDER) {
      await expect(regionRoot(page, name)).toHaveCSS("background-color", surface);
    }

    for (const name of [...SHARING_REGIONS, "sharing"]) {
      const nodes = region(page, name);
      const count = await nodes.count();
      for (let i = 0; i < count; i += 1) {
        await expect(nodes.nth(i)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      }
    }
    await expect(page.locator("[data-reach-panel]")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
  });

  /**
   * Separation comes from hairline rules, not from stacked panels (§8.7).
   *
   * Re-targeted from the deleted `[data-stat-row]` onto the count strip that replaced it —
   * which is drawn as *a rule, not a box*, for the same reason one level down: a nested border
   * inside the panel's own border reads as two objects where there is one.
   */
  test("separation comes from hairline rules, not from stacked panels (§8.7)", async ({ page }) => {
    await gotoDashboard(page);

    const rule = await resolvedTokenColour(page, "--line");

    const strip = page.locator("[data-reach-counts]");
    await expect(strip).toHaveCSS("border-top-color", rule);
    await expect(strip).toHaveCSS("border-top-width", "1px");
    await expect(strip).toHaveCSS("border-bottom-width", "0px");

    // Attention rows are separated the same way, and by nothing else.
    const firstRow = page.locator("[data-attention-row]").first();
    await expect(firstRow).toHaveCSS("border-bottom-color", rule);
    await expect(firstRow).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  });

  /**
   * **NO GREEN.**
   *
   * A mint `--dash-*` family — seven values on the client's deck hue 168° — was scoped to
   * `/dashboard` as the one place app chrome was allowed a colour of its own. It was deleted on
   * 2026-09-20 at the client's own instruction, and nothing replaced it.
   *
   * ⚠ **The defect a scoped colour family produces is not a contrast failure.** Every `--dash-*`
   * value cleared its floor, which is precisely why no audit in this suite caught it and why
   * this test cannot be a contrast test. It is a sweep of what actually reached the screen: if
   * any element on `/dashboard` paints a colour whose green channel leads both red and blue by
   * more than {@link GREEN_CAST_MARGIN}, the family is back, whatever it is called this time.
   *
   * ## The one carve-out, and why it is not a loophole
   *
   * `PRODUCT.md`: "App chrome is pure white with neutral greys and a near-black accent; per-card
   * colour is a separate system that lives only on cards." Three handles on this page carry a
   * *card's own* palette by design — `[data-attention-marker]`, the rule that says which card a
   * queue row belongs to, `[data-reach-bar]`, and `[data-dashboard-card-thumb]`, the Cards
   * tile's miniatures, which are the card's own design and nothing else — and the fixture set
   * contains a forest card and a citrus one, so all three legitimately paint green. They are
   * exempt; **everything else on the screen is not.** The exemption is asserted to still match something, so a stale carve-out
   * cannot quietly widen into a hole.
   */
  test("paints no green in its own chrome — the deleted mint stays deleted", async ({ page }) => {
    await gotoDashboard(page);

    /* The semantic states must survive the rule. `--warning-*` is a warm amber and `--danger-*`
       a red; if the margin were ever tightened to the point of flagging them, this loop fails
       before the sweep does and says which token. */
    for (const token of ["--warning-ink", "--warning-wash", "--danger", "--danger-wash"]) {
      const value = await resolvedTokenColour(page, token);
      expect(isGreenCast(value), `${token} resolves to ${value}, which reads as green`).toBe(false);
    }

    /* And the deleted family must NOT survive it. `--success` is the app's own green and is not
       used on this screen; it stands in here for "a green that clears every contrast floor",
       which is exactly what the mint was. If the sweep would not catch this, it catches nothing. */
    const green = await resolvedTokenColour(page, "--success");
    expect(isGreenCast(green), `--success (${green}) must be caught by the sweep`).toBe(true);

    /* ⚠ **At least one carrier, not every carrier — and the difference is a real product state.**
       The guard exists so the exempt list cannot rot into a hole that silently protects nothing.
       Requiring EVERY selector to match assumed both always render, and `[data-reach-bar]` does
       not: when no card has been opened, `<ReachBars>` draws a stated empty line instead of a
       column of identical empty tracks, so there are legitimately zero bars. That is the figure
       behaving correctly on the fixture profile, and pinning each selector turned it into three
       red tests.

       One match still proves the carve-out is live, because the sweep below only means anything
       if something it exempts is actually on the page. */
    const carriers = ["[data-attention-marker]", "[data-reach-bar]", "[data-dashboard-card-thumb]"];
    const carrierCounts = await Promise.all(
      carriers.map(async (c) => [c, await page.locator(c).count()] as const),
    );
    expect(
      carrierCounts.filter(([, n]) => n > 0).length,
      `none of ${carriers.join(" / ")} matched — the green carve-out is exempting nothing, so the sweep proves nothing`,
    ).toBeGreaterThan(0);

    const painted = await page.evaluate(
      ({ properties, exempt }) => {
        const screen = document.querySelector("[data-screen-state]");
        if (screen === null) return [];
        const seen = new Set<string>();
        const out: Array<{ where: string; property: string; value: string }> = [];

        const describe = (el: Element): string => {
          const attrs = [...el.attributes]
            .filter((a) => a.name.startsWith("data-"))
            .map((a) => `[${a.name}]`)
            .join("");
          const cls = (el.getAttribute("class") ?? "").slice(0, 60);
          return `${el.tagName.toLowerCase()}${attrs} .${cls}`;
        };

        for (const el of [screen, ...screen.querySelectorAll("*")]) {
          if (exempt.some((selector) => el.closest(selector) !== null)) continue;
          const style = getComputedStyle(el);
          for (const property of properties) {
            const value = style.getPropertyValue(property);
            if (value === "") continue;
            const key = `${describe(el)}|${property}|${value}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ where: describe(el), property, value });
          }
        }
        return out;
      },
      {
        properties: PAINT_PROPERTIES.map((p) => p.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)),
        exempt: carriers,
      },
    );

    expect(painted.length, "the sweep read nothing — it is not measuring the page").toBeGreaterThan(
      0,
    );

    const offenders = painted.filter((entry) => isGreenCast(entry.value));
    expect(
      offenders,
      `the dashboard paints green outside the card-colour system:\n${offenders
        .map((o) => `  ${o.where} { ${o.property}: ${o.value} }`)
        .join("\n")}`,
    ).toEqual([]);
  });
});
