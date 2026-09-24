import { expect, test, type Locator, type Page } from "@playwright/test";

import { PROJECT_VIEWPORT, gotoReady } from "../helpers/e2e";
import { signIn } from "../helpers/session";
import { STATE_QUERIES, withState } from "../helpers/routes";

/* ⚠ `/contacts` is a gated route — `proxy.ts` bounces it to `/signin/phone` without a session
   cookie. See `tests/helpers/session.ts` for why a forged-`exp` token is the right seam. */
test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

/**
 * `/contacts` and `/contacts/[contactId]` — the saved-contact surfaces (spec §6.1 R-14 and
 * R-15, §8D.3, §4.6, plan T24).
 *
 * A saved contact is a **snapshot of what was scanned, not a live link** (§5.2). Nothing
 * here resolves a `SavedContactField` back through anybody's profile, and two of the tests
 * below exist to prove the snapshot never becomes a way around the rules the card it came
 * from obeyed.
 *
 * ## The four assertions this file exists for
 *
 * 1. **AC-24, and specifically "both empties".** `/contacts` is the screen where the
 *    filtered-to-nothing empty is most likely to be silently downgraded to the first-run
 *    one: `resolveDataScreenState` is correct, so the mistake can only happen at the call
 *    site — a screen that omits `isFiltered` — and no unit test anywhere goes red for it.
 *    So the two are asserted as **different components** (`[data-empty-state]`), with
 *    **different copy** and **different actions**: the filtered one offers "Clear filters"
 *    and no create action, the first-run one explains that contacts arrive by a scan and
 *    offers no way to clear a filter nobody applied.
 *
 * 2. **§11 E-39 — the dangling `sourceCardSlug`.** `contact_lena` was scanned from
 *    `prya-old`, a card that no longer exists. The "From card" link must not be rendered
 *    **at all** — not disabled, not greyed, not "card unavailable" — while the rest of the
 *    contact renders exactly as it would have. Asserted on both routes, because the list
 *    and the detail resolve the slug independently, and asserted with a control case so it
 *    cannot pass by the link never rendering anywhere.
 *
 * 3. **AC-33 survives the snapshot.** `savedContactFields` (T17) sets `isSensitive: false`,
 *    because a scanned snapshot carries no such flag — so masking of a saved bank account
 *    rests **entirely** on `ALWAYS_MASKED_TYPES` in T12's registry. `contact_vikram` is
 *    probed directly: masked value, no raw digits anywhere in the served DOM, no `href`, no
 *    `title`, no reveal control.
 *
 * 4. **Width is why this screen is desktop-first (Q16).** At 360px the three-column table is
 *    gone from the accessibility tree entirely and a list has taken its place — a *semantic*
 *    change, not a narrower table.
 *
 * ## Two mechanics that are easy to get wrong here
 * · `DataTable` renders **both** views into the DOM and hides one with `display:none`, so
 *   every row-level selector matches twice unless it is scoped to `[data-table-view]`.
 *   {@link rowsIn} is that scope, and it is keyed off the project's viewport.
 * · `ErrorPanel` and `SearchField` both emit ARIA live roles. A bare `getByRole('status')`
 *   or `getByRole('alert')` on this screen is ambiguous by construction — every such query
 *   below is scoped to its panel.
 *
 * Every navigation goes through `gotoReady` so animations are dead and `document.fonts` has
 * settled before anything is measured (§14.6, R-10).
 */

const CONTACTS = "/contacts";

/** Scanned from `prya-hq` ("Work"), which exists. The ordinary case, and the E-39 control. */
const CONTACT_WITH_SOURCE = "/contacts/contact_arjun";

/** §11 E-39: scanned from `prya-old`, which does not exist. The link must not render. */
const CONTACT_DANGLING_SOURCE = "/contacts/contact_lena";

/** Never scanned from a card at all — `sourceCardSlug` is `null`. Same outcome, other cause. */
const CONTACT_NO_SOURCE = "/contacts/contact_sunil";

/** Carries a `BANK_ACCOUNT`. The masking probe (AC-33). */
const CONTACT_WITH_BANK = "/contacts/contact_vikram";

/** Carries a `SOCIAL_LINK`. The `rel` + `context` probe (AC-32, E-23). */
const CONTACT_WITH_SOCIAL = "/contacts/contact_mei";

/** The raw value in `fixtures/contacts.ts`. It may appear nowhere in the served DOM. */
const RAW_ACCOUNT_NUMBER = "50100499887766";

const UNKNOWN_CONTACT = "/contacts/contact_does_not_exist";

/** Twelve saved contacts in the success fixture. */
const CONTACT_COUNT = 12;

/**
 * Wait for the Suspense swap before reading `[data-screen-state]`.
 *
 * Both routes carry a `loading.tsx` (§6.1 R-14, R-15), a `loading.tsx` **is** a Suspense
 * boundary, and its fallback carries a `data-screen-state="loading"` root of its own — so a
 * single streamed response really does hold two roots until React swaps them. Playwright
 * raises a strict-mode violation the instant a strict locator matches two elements and
 * **never retries it**, whereas `toHaveCount` does retry. This is therefore the
 * synchronisation point, not a redundant assertion: T18 lost a run to its absence (W6-08).
 */
async function screenRoot(page: Page): Promise<Locator> {
  const root = page.locator("[data-screen-state]");
  await expect(root).toHaveCount(1);
  return root;
}

/**
 * The **visible** half of `DataTable`. Both halves are in the DOM at every viewport; only
 * one is painted, and only one is in the accessibility tree.
 */
function visibleView(page: Page, projectName: string): Locator {
  const viewport = PROJECT_VIEWPORT[projectName];
  return page.locator(
    viewport === 360 ? '[data-table-view="list"]' : '[data-table-view="table"]',
  );
}

/** Every contact row in the visible view, addressed by the name cell's marker. */
function rowsIn(page: Page, projectName: string): Locator {
  return visibleView(page, projectName).locator("[data-contact-name]");
}

/* ── the list: structure ─────────────────────────────────────────────────────────── */

test("renders one screen root, one main landmark, and every saved contact", async ({
  page,
}, testInfo) => {
  await gotoReady(page, CONTACTS);
  const root = await screenRoot(page);

  await expect(root).toHaveAttribute("data-screen-state", "success");
  await expect(page.locator("[data-contacts-list]")).toHaveCount(1);

  // The shell owns the ONLY <main id="main">. A screen that renders its own — including
  // `<ScreenStateRoot as="main">`, which is a legal value — puts two landmarks on the page
  // and fails axe's `landmark-unique` in T29 (AC-25).
  await expect(page.locator("main#main")).toHaveCount(1);

  // The page heading is the header's <h1>; the screen adds no second one.
  await expect(page.getByRole("heading", { level: 1, name: "Contacts" })).toBeVisible();

  await expect(rowsIn(page, testInfo.project.name)).toHaveCount(CONTACT_COUNT);
});

test("the name cell links to the contact's own route", async ({ page }, testInfo) => {
  await gotoReady(page, CONTACTS);
  await screenRoot(page);

  const view = visibleView(page, testInfo.project.name);
  await expect(view.locator('a[href="/contacts/contact_arjun"]')).toHaveCount(1);
});

test("width is why this screen is desktop-first: table semantics are dropped at 360 (§8D.3, Q16)", async ({
  page,
}, testInfo) => {
  const viewport = PROJECT_VIEWPORT[testInfo.project.name];
  await gotoReady(page, CONTACTS);
  await screenRoot(page);

  const table = page.getByRole("table");
  const list = page.getByRole("list", { name: /saved contacts/i });

  if (viewport === 360) {
    // `display:none` removes the subtree from the accessibility tree, so the table is not
    // merely narrow — it is gone, and nothing reads the same row twice.
    await expect(table).toHaveCount(0);
    await expect(list).toBeVisible();
  } else {
    await expect(table).toHaveCount(1);
    await expect(table).toBeVisible();
    await expect(list).toHaveCount(0);
  }
});

/* ── the list: the state families (§8D.1, AC-24) ─────────────────────────────────── */

for (const state of STATE_QUERIES) {
  test(`/contacts ?state=${state} sets data-screen-state (AC-24)`, async ({ page }) => {
    await gotoReady(page, withState(CONTACTS, state));
    const root = await screenRoot(page);

    await expect(root).toHaveAttribute("data-screen-state", state);

    if (state === "loading") {
      // §8D.3: eight row skeletons, layout-matched, never a spinner.
      await expect(page.locator('[data-loading-skeleton="table"]')).toHaveCount(1);
      await expect(page.locator("[data-skeleton-row]")).toHaveCount(8);
      await expect(page.locator("[data-data-table]")).toHaveCount(0);
    }

    if (state === "error" || state === "offline") {
      const panel = page.locator('[data-error-panel="page"]');
      await expect(panel).toHaveCount(1);
      await expect(panel.getByRole("button", { name: "Try again" })).toBeVisible();
      await expect(page.locator("[data-data-table]")).toHaveCount(0);
    }

    if (state === "empty") {
      await expect(page.locator('[data-empty-state="first-run"]')).toHaveCount(1);
      await expect(page.locator('[data-empty-state="filtered"]')).toHaveCount(0);
      await expect(page.locator("[data-data-table]")).toHaveCount(0);
    }

    if (state === "success") {
      await expect(page.locator("[data-data-table]")).toHaveCount(1);
      await expect(page.locator("[data-empty-state]")).toHaveCount(0);
    }
  });
}

test("an unrecognised ?state= falls back to success (E-34)", async ({ page }, testInfo) => {
  await gotoReady(page, `${CONTACTS}?state=banana`);
  const root = await screenRoot(page);

  await expect(root).toHaveAttribute("data-screen-state", "success");
  await expect(rowsIn(page, testInfo.project.name)).toHaveCount(CONTACT_COUNT);
});

/* ── AC-24, the deciding pair: two empties, two components, two actions ──────────── */

test("the first-run empty explains that contacts arrive by a scan, and offers no Clear filters", async ({
  page,
}) => {
  await gotoReady(page, withState(CONTACTS, "empty"));
  const root = await screenRoot(page);
  await expect(root).toHaveAttribute("data-screen-state", "empty");

  const empty = page.locator('[data-empty-state="first-run"]');
  await expect(empty).toContainText("No saved contacts yet");
  // §8D.3 requires the explanation of how a contact arrives, not just the absence of one.
  await expect(empty).toContainText(/scan/i);

  // It never offers to clear a filter nobody applied.
  await expect(page.getByRole("button", { name: /clear filters/i })).toHaveCount(0);

  // With nothing to search, the filter surface is not rendered either: a search box over an
  // empty collection is a control that cannot do anything.
  await expect(page.locator("[data-search-field]")).toHaveCount(0);
  await expect(page.locator("[data-filter-bar]")).toHaveCount(0);
});

test("searching to nothing produces the FILTERED empty — a different component, copy and action (AC-24)", async ({
  page,
}) => {
  await gotoReady(page, CONTACTS);
  await screenRoot(page);

  await page.locator("[data-search-field] input").fill("zzzzz-no-such-contact");

  await expect(page.locator("[data-screen-state]")).toHaveAttribute(
    "data-screen-state",
    "empty-filtered",
  );

  const filtered = page.locator('[data-empty-state="filtered"]');
  await expect(filtered).toHaveCount(1);
  await expect(filtered).toContainText("No contacts match");

  // The banned conflation, asserted from both sides: this is NOT the first-run component,
  // and it must not carry the first-run copy or action.
  await expect(page.locator('[data-empty-state="first-run"]')).toHaveCount(0);
  await expect(filtered).not.toContainText(/no saved contacts yet/i);
  await expect(filtered.getByRole("button", { name: "Clear filters" })).toBeVisible();

  // The search box survives, because the reader has to be able to undo what they did.
  await expect(page.locator("[data-search-field]")).toHaveCount(1);
});

test("Clear filters restores the whole collection", async ({ page }, testInfo) => {
  await gotoReady(page, CONTACTS);
  await screenRoot(page);

  await page.locator("[data-search-field] input").fill("zzzzz-no-such-contact");
  await expect(page.locator("[data-screen-state]")).toHaveAttribute(
    "data-screen-state",
    "empty-filtered",
  );

  await page
    .locator('[data-empty-state="filtered"]')
    .getByRole("button", { name: "Clear filters" })
    .click();

  await expect(page.locator("[data-screen-state]")).toHaveAttribute(
    "data-screen-state",
    "success",
  );
  await expect(rowsIn(page, testInfo.project.name)).toHaveCount(CONTACT_COUNT);
  await expect(page.locator("[data-search-field] input")).toHaveValue("");
});

test("?q= drives the filtered empty without typing (AC-24, T29's sweep hook)", async ({
  page,
}) => {
  await gotoReady(page, `${CONTACTS}?q=zzzzz-no-such-contact`);
  const root = await screenRoot(page);

  await expect(root).toHaveAttribute("data-screen-state", "empty-filtered");
  await expect(page.locator('[data-empty-state="filtered"]')).toHaveCount(1);
});

test("a search that matches narrows the collection rather than emptying it", async ({
  page,
}, testInfo) => {
  await gotoReady(page, CONTACTS);
  await screenRoot(page);

  await page.locator("[data-search-field] input").fill("lena");

  await expect(page.locator("[data-screen-state]")).toHaveAttribute(
    "data-screen-state",
    "success",
  );
  await expect(rowsIn(page, testInfo.project.name)).toHaveCount(1);
  await expect(visibleView(page, testInfo.project.name)).toContainText("Lena Kowalski");
});

test("the search also matches the source card's name, which is the column beside it", async ({
  page,
}, testInfo) => {
  await gotoReady(page, CONTACTS);
  await screenRoot(page);

  // "Studio" is the name of `prya-studio`, the card `contact_ritu` was scanned from. No
  // contact is called Studio, so a hit here can only have come from the source column.
  await page.locator("[data-search-field] input").fill("studio");

  await expect(rowsIn(page, testInfo.project.name)).toHaveCount(1);
  await expect(visibleView(page, testInfo.project.name)).toContainText("Ritu Malhotra");
});

test("a category filter narrows the collection and reports itself", async ({
  page,
}, testInfo) => {
  await gotoReady(page, CONTACTS);
  await screenRoot(page);

  const bar = page.locator("[data-filter-bar]");
  await expect(bar).toHaveAttribute("data-active-filter-count", "0");

  await bar.getByRole("button", { name: /^Financial/ }).click();

  await expect(bar).toHaveAttribute("data-active-filter-count", "1");
  // Only `contact_vikram` carries a FINANCIAL field.
  await expect(rowsIn(page, testInfo.project.name)).toHaveCount(1);
  await expect(visibleView(page, testInfo.project.name)).toContainText("Vikram Sethi");
});

test("a category filter that excludes everything reaches the FILTERED empty, not the first-run one", async ({
  page,
}) => {
  await gotoReady(page, CONTACTS);
  await screenRoot(page);

  // Business + Financial: no contact carries both, so the intersection is empty.
  const bar = page.locator("[data-filter-bar]");
  await bar.getByRole("button", { name: /^Financial/ }).click();
  await page.locator("[data-search-field] input").fill("lena");

  await expect(page.locator("[data-screen-state]")).toHaveAttribute(
    "data-screen-state",
    "empty-filtered",
  );
  await expect(page.locator('[data-empty-state="first-run"]')).toHaveCount(0);
});

/* ── §11 E-39: the dangling source card, on both routes ──────────────────────────── */

test("E-39: a dangling sourceCardSlug renders NO From-card link in the list, and the row otherwise renders", async ({
  page,
}, testInfo) => {
  await gotoReady(page, CONTACTS);
  await screenRoot(page);

  const view = visibleView(page, testInfo.project.name);

  // The rest of the row is untouched: the name, its link, and the saved date all render.
  await expect(view.locator('[data-contact-name="contact_lena"]')).toContainText(
    "Lena Kowalski",
  );
  await expect(view.locator('a[href="/contacts/contact_lena"]')).toHaveCount(1);
  await expect(view.locator('[data-contact-saved="contact_lena"]')).toHaveCount(1);

  // …and there is no link to a card that does not exist. Not disabled, not greyed: absent.
  const source = view.locator('[data-contact-source="contact_lena"]');
  await expect(source).toHaveCount(1);
  await expect(source.locator("[data-source-card]")).toHaveCount(0);
  await expect(source.locator("a")).toHaveCount(0);
  await expect(view).not.toContainText(/prya-old/);

  // A contact that was never scanned from a card behaves identically.
  await expect(
    view.locator('[data-contact-source="contact_sunil"] [data-source-card]'),
  ).toHaveCount(0);

  // The control case: a live slug DOES render its link, so the assertions above are not
  // passing because the link never renders anywhere.
  const live = view.locator('[data-contact-source="contact_arjun"] [data-source-card]');
  await expect(live).toHaveCount(1);
  await expect(live).toContainText("Work");
});

test("E-39: the detail screen renders no From-card link, and everything else is unchanged", async ({
  page,
}) => {
  await gotoReady(page, CONTACT_DANGLING_SOURCE);
  const root = await screenRoot(page);

  await expect(root).toHaveAttribute("data-screen-state", "success");

  // The whole contact renders …
  await expect(page.locator("[data-contact-name]")).toHaveText("Lena Kowalski");
  await expect(page.locator("[data-contact-saved]")).toHaveCount(1);
  await expect(page.locator("[data-field-list]")).toHaveCount(1);
  await expect(page.locator("[data-field-row]")).toHaveCount(2);
  await expect(page.locator("[data-contact-detail]")).toContainText("lena@wtf.example");

  // … except the one link that would 404.
  await expect(page.locator("[data-source-card]")).toHaveCount(0);
  await expect(page.locator("[data-contact-detail]")).not.toContainText(/from card/i);
});

test("a live sourceCardSlug DOES render the From-card link on the detail screen", async ({
  page,
}) => {
  await gotoReady(page, CONTACT_WITH_SOURCE);
  await screenRoot(page);

  const link = page.locator("[data-source-card]");
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("data-source-card", "prya-hq");
  await expect(link).toHaveAttribute("href", "/cards/card_minimal_demo");
  await expect(link).toContainText("Work");
});

test("a contact with a null sourceCardSlug renders no From-card link either", async ({
  page,
}) => {
  await gotoReady(page, CONTACT_NO_SOURCE);
  await screenRoot(page);

  await expect(page.locator("[data-contact-name]")).toHaveText("Sunil Iyer");
  await expect(page.locator("[data-source-card]")).toHaveCount(0);
});

/* ── the detail: structure and grouping ──────────────────────────────────────────── */

test("the detail screen groups the captured snapshot by category (§8D.3)", async ({ page }) => {
  await gotoReady(page, CONTACT_WITH_SOURCE);
  await screenRoot(page);

  await expect(page.locator("main#main")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 1, name: "Arjun Balasubramanian" }),
  ).toBeVisible();

  // PERSONAL (phone, email) then WORK (job title, company) — §6.4's category order, which
  // is the order `resolveCard` sorts by and `buildVcf` writes in. Rows are never re-sorted
  // within a group.
  const groups = page.locator("[data-field-group]");
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0)).toHaveAttribute("data-field-group", "PERSONAL");
  await expect(groups.nth(1)).toHaveAttribute("data-field-group", "WORK");

  await expect(page.locator("[data-field-row]")).toHaveCount(4);
  // The owner's own labels travel with the snapshot; nothing is invented here.
  await expect(page.locator("[data-field-list]")).toContainText(
    "Director, Network Partnerships",
  );
});

test("a link field carries rel=noopener noreferrer and its context line (AC-32, E-23)", async ({
  page,
}) => {
  await gotoReady(page, CONTACT_WITH_SOCIAL);
  await screenRoot(page);

  const social = page.locator('[data-field-type="SOCIAL_LINK"]');
  await expect(social).toHaveCount(1);

  const anchor = social.locator('a[target="_blank"]');
  await expect(anchor).toHaveCount(1);
  await expect(anchor).toHaveAttribute("rel", "noopener noreferrer");

  // `row.context` is how the destination's identity reaches the DOM. Drop it and an
  // unrecognised handle renders with no clue where it points (E-23).
  await expect(social.locator("[data-field-context]")).toHaveCount(1);
});

/* ── AC-33: the snapshot is not a way around masking ─────────────────────────────── */

test("a saved BANK_ACCOUNT renders masked, with no href and no reveal control (AC-33)", async ({
  page,
}) => {
  await gotoReady(page, CONTACT_WITH_BANK);
  await screenRoot(page);

  const bank = page.locator('[data-field-type="BANK_ACCOUNT"]');
  await expect(bank).toHaveCount(1);
  await expect(bank).toHaveAttribute("data-field-masked", "");
  await expect(bank.locator("[data-field-value]")).toContainText("••••");
  await expect(bank.locator("[data-field-value]")).toContainText("7766");

  // `savedContactFields` sets `isSensitive: false` — masking here rests ENTIRELY on
  // `ALWAYS_MASKED_TYPES`. If that set is ever narrowed, this is the test that notices.
  const html = await page.content();
  expect(html).not.toContain(RAW_ACCOUNT_NUMBER);

  // No destination, no hover-readable title, no affordance to unmask. Reveal exists in
  // `/profile` and nowhere else (§7.3).
  await expect(bank.locator("a")).toHaveCount(0);
  await expect(bank.locator("[title]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /reveal|show|unmask|unhide/i })).toHaveCount(0);
  await expect(page.getByRole("switch")).toHaveCount(0);
});

/* ── the detail: the state families, and the not-found panel ─────────────────────── */

for (const state of STATE_QUERIES) {
  test(`/contacts/[contactId] ?state=${state} sets data-screen-state (AC-24)`, async ({
    page,
  }) => {
    await gotoReady(page, withState(CONTACT_WITH_SOURCE, state));
    const root = await screenRoot(page);

    await expect(root).toHaveAttribute("data-screen-state", state);

    if (state === "loading") {
      await expect(page.locator('[data-loading-skeleton="fields"]')).toHaveCount(1);
      await expect(page.locator("[data-field-list]")).toHaveCount(0);
    }

    if (state === "error" || state === "offline") {
      const panel = page.locator('[data-error-panel="page"]');
      await expect(panel).toHaveCount(1);
      await expect(panel.getByRole("button", { name: "Try again" })).toBeVisible();
    }

    if (state === "empty") {
      // §8D.3: the contact-detail empty IS the not-found panel — an id with nothing behind
      // it is not "you have no contacts", and it is not retryable.
      await expect(page.locator("[data-not-found-panel]")).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
      await expect(page.locator("[data-field-list]")).toHaveCount(0);
    }

    if (state === "success") {
      await expect(page.locator("[data-field-list]")).toHaveCount(1);
    }
  });
}

test("an unknown contactId renders the not-found panel, never a raw 404 (§8D.3, §11 E-36 shape)", async ({
  page,
}) => {
  await gotoReady(page, UNKNOWN_CONTACT);

  await expect(page.locator("[data-not-found-panel]")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Go to contacts" })).toBeVisible();

  // No status code as a headline, no stack trace, no retry on a URL that cannot resolve.
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/\b404\b/);
  expect(text).not.toMatch(/\.tsx?:\d+/);
  await expect(page.locator("pre")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
});

/* ── nothing on either screen throws on the happy path ───────────────────────────── */

test("the detail screen renders with no uncaught page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await gotoReady(page, CONTACT_WITH_BANK);
  await screenRoot(page);

  expect(errors).toEqual([]);
});

/* ── inbound activity ─────────────────────────────────────────────────────────────── */

/**
 * ⚠ **THE BROWSER MUST NEVER CALL `/inbound-messages` DIRECTLY.**
 *
 * That endpoint is not ownership-scoped — the API says so in its own description, and it is
 * tagged `webhooks`. Its raw response carries other users' phone numbers, WhatsApp display
 * names and message bodies. The join against the caller's own contacts happens in
 * `app/api/inbound/connects/route.ts`, on the server, where the surplus can be discarded
 * before anything is serialised.
 *
 * This is the assertion that keeps that true. `endpoints/inbound-messages.ts` is `server-only`
 * so a `"use client"` import fails the build — but a hand-written `fetch("/api/cb/…")` in a
 * client component would slip straight past that, and this is what catches it.
 */
test("the browser never requests the unscoped inbound endpoint", async ({ page }) => {
  const direct: string[] = [];
  page.on("request", (request) => {
    if (/\/inbound-messages/.test(request.url())) direct.push(request.url());
  });

  await gotoReady(page, CONTACTS);
  await page.waitForTimeout(1500);

  expect(
    direct,
    "a client component is calling the raw, unscoped inbound capture — route it through " +
      "/api/inbound/connects instead",
  ).toEqual([]);
});

/**
 * Every row names its source from `GET /contacts` itself — never a dash — and the *Messaged you*
 * column is gone. Strangers who wrote in are still reduced to a count with no numbers attached.
 */
test("shows every contact's source, and counts the senders you don't have", async ({
  page,
}, testInfo) => {
  await gotoReady(page, CONTACTS);

  const view = visibleView(page, testInfo.project.name);
  await expect(page.getByRole("columnheader", { name: "Messaged you" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Messaged you/ })).toHaveCount(0);
  await expect(page.locator("[data-contact-messaged-count]")).toHaveCount(0);

  /* One source badge per row: the column has an answer for everybody. */
  const rows = rowsIn(page, testInfo.project.name);
  await expect(rows).not.toHaveCount(0);
  await expect(view.locator("[data-contact-source-label]")).toHaveCount(await rows.count());

  /* ⚠ And the stranger is a COUNT ONLY. The stub seeds `+919000000001`, which is not in the
     fixture registry — it stands for another user's contact. Its number must not be anywhere
     in the DOM. */
  const unknown = page.locator("[data-inbound-unknown]");
  await expect(unknown).toHaveCount(1);

  const html = await page.content();
  expect(
    html.includes("919000000001"),
    "an unmatched sender's phone number reached the page — that is somebody else's data",
  ).toBe(false);
});

/**
 * The QR-scan metric: a contact who scanned one of **your** cards carries the scan count under
 * their source badge.
 *
 * The stub seeds two *messages* and one *scan* from the same contact, so a count of `1` here also
 * proves messages are not being counted as scans.
 */
test("marks the contacts who scanned your card, and never counts a message as a scan", async ({
  page,
}) => {
  await gotoReady(page, CONTACTS);

  const scanned = page.locator("[data-contact-scanned-count]");
  await expect(scanned, "no contact was marked as having scanned your card").not.toHaveCount(0);

  /* The fixture seeds exactly one scan of THIS user's card from the first contact. */
  await expect(scanned.first()).toHaveAttribute("data-contact-scanned-count", "1");

  // The filter chip is offered, because there is something for it to match.
  await expect(page.getByText("Scanned your card", { exact: false }).first()).toBeVisible();
});

/**
 * ⚠ **The false positive this column was built around.**
 *
 * `GET /inbound-messages` is a global capture. The phone join alone attributes a scan to
 * whoever's registry the *scanner* happens to sit in — so a contact of yours who scanned
 * **somebody else's** card was being reported as having scanned yours.
 *
 * `resolvedOwnerId` is the fix: a scan counts only when it names this caller. The fixture seeds
 * two `QR_SCAN_CONNECT` rows from the *same* known contact — one for this user, one for
 * `another-owner-user-id` — so a route that ignores ownership reports `2` here and a correct one
 * reports `1`. Without the second fixture row this assertion cannot fail, which is the only
 * reason it is worth writing.
 */
test("a scan of another owner's card is not counted as a scan of yours", async ({ page }) => {
  await gotoReady(page, CONTACTS);

  const scanned = page.locator("[data-contact-scanned-count]").first();
  await expect(scanned).toHaveAttribute("data-contact-scanned-count", "1");

  /* And the other owner's id must not have travelled to the browser either — it is not this
     caller's data, so it has no business being in the payload at all. */
  const html = await page.content();
  expect(
    html.includes("another-owner-user-id"),
    "another owner's user id reached the page — the scan row was not dropped server-side",
  ).toBe(false);
});

/**
 * ⚠ **A scan from somebody not in the registry must still be visible.**
 *
 * This is the failure the panel was built for, and it was reported from a real staging session:
 * `/api/inbound/connects` answered `{"connects":[],"unknownCount":0}` on a page reading "No
 * contacts yet", with a genuine scan sitting in the inbound log. The route required a contact
 * match for scans as well as messages, so with an empty registry every owned scan was dropped.
 *
 * Two things are asserted, and the second is the one that would have caught it: the scan is
 * rendered, and it is rendered **outside** the table — the table is replaced wholesale by the
 * empty state when the registry has nothing in it, so a panel inside it would vanish exactly
 * when it is the only thing worth showing.
 */
test("a scan by someone not in your contacts is shown, with their number", async ({ page }) => {
  await gotoReady(page, CONTACTS);

  const panel = page.locator("[data-inbound-unlinked-scans]");
  await expect(panel, "an owned scan from an unlisted number was dropped").toHaveCount(1);

  /* The fixture seeds one: `+919000000002`, profileName "Kabir", owned by this user. */
  await expect(panel).toHaveAttribute("data-inbound-unlinked-scans", "1");
  await expect(page.locator('[data-unlinked-scan="+919000000002"]')).toHaveCount(1);
  await expect(panel).toContainText("Kabir");

  /* ⚠ Outside the table. `[data-empty-state]` replaces the table entirely on an empty
     registry, so a panel nested in it would disappear in the very case it is needed. */
  await expect(page.locator("[data-empty-state] [data-inbound-unlinked-scans]")).toHaveCount(0);
});

/**
 * ⚠ The chip's count needs its own spacing: `Chip` puts every child inside one `<span>`, so the
 * `gap-2` on its flex shell never lands between a label and the count beside it. It shipped
 * reading "Added by you4".
 */
test("a filter chip separates its label from its count", async ({ page }) => {
  await gotoReady(page, CONTACTS);
  const chip = page.locator("[data-filter-bar] [data-chip]").first();
  await expect(chip).toBeVisible();
  expect(
    (await chip.innerText()).trim(),
    "the chip's count is jammed against its label",
  ).toMatch(/\D\s\d+$/);
});
