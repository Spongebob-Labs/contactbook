import { expect, test, type Locator, type Page, type Request } from "@playwright/test";

import { ALL_SUGGESTIONS, PROFILE_SECTIONS, childBirthdayLabel } from "@/components/builder/field-suggestions";
import { FIELD_CATALOGUE } from "@/components/builder/field-catalogue";
import { fixtureFields } from "@/fixtures/profile";

import { gotoReady } from "../helpers/e2e";
import { signIn, statefulSub } from "../helpers/session";

/* ⚠ `/profile` is a gated route — `proxy.ts` bounces it to `/signin/phone` without a session
   cookie. Every test signs in first; the ones that need writes to persist sign in again with
   their own `e2e-state-*` sub. */
test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

/**
 * `/profile` — **Profile & Cards**, the merged workspace (client, 2026-09-28) — and
 * `/profile/groups/[groupId]`, the group editor that still owns reorder and delete.
 *
 * ## What this file pins
 *
 * 1. **AC-33** — the workspace and the group editor are the only surfaces with a reveal, and
 *    while a row is masked the raw value is nowhere in its markup (`outerHTML`, not text).
 * 2. **Click-to-edit** — the row itself opens the editor; Enter saves, Escape cancels.
 * 3. **Blank suggested fields** are client-side rows; the first non-empty save creates the
 *    field (`POST /profile/fields`) and puts it on the selected card.
 * 4. **The card tick** changes the preview at once and writes the card's whole set.
 * 5. **A new card carries every filled field.**
 * 6. **E-41** — deleting a field states how many cards use it, first (group editor).
 *
 * ## Mechanics
 *
 * · Wait for `[data-screen-state]`, never race the fallback: the skeletons carry none.
 * · Personal and Work open by default, the rest collapsed, at every width — `expandSection`
 *   clicks only when it needs to, so no test branches on the viewport.
 * · The stateless stub echoes profile writes without storing them, so a created field is
 *   asserted on the request it sends, never on a row that the re-read removes again.
 */

/* ── fixture facts these tests are written against (src/fixtures/profile.ts) ─────────── */

/** `BANK_ACCOUNT`. Masked by type. */
const BANK_FIELD = "field_bank";
const BANK_RAW = "50100412345678";
const BANK_MASKED = "••••5678";

/** `DIGITAL_WALLET` — masked because the type says so. */
const UPI_FIELD = "field_upi";
const UPI_RAW = "priyanka@okhdfcbank";

/** `DATE`, not one of the encrypted kinds, so it renders plainly ("8 March 1991"). */
const DOB_FIELD = "field_dob";

/** `PHONE`, not sensitive. The control case. */
const PHONE_FIELD = "field_mobile";

/** The stub's first card (API order) — what the workspace previews with no `?card=`. */
const FIRST_CARD = "card_minimal_demo";

/* ── helpers ────────────────────────────────────────────────────────────────────────── */

async function gotoProfile(page: Page, query = ""): Promise<void> {
  await gotoReady(page, `/profile${query}`);
  // Exactly one: the client root. `loading.tsx` and the Suspense fallback carry none.
  await expect(page.locator("[data-screen-state]")).toHaveCount(1);
}

async function gotoGroup(page: Page, groupId: string, query = ""): Promise<void> {
  await gotoReady(page, `/profile/groups/${groupId}${query}`);
  await expect(page.locator("[data-screen-state]")).toHaveCount(1);
}

/** Open a workspace section if it is collapsed. Idempotent. */
async function expandSection(page: Page, sectionId: string): Promise<void> {
  const toggle = page.locator(`[data-section-toggle="${sectionId}"]`);
  await toggle.waitFor();
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

/** A workspace row. */
function row(page: Page, fieldId: string): Locator {
  return page.locator(`[data-workspace-row="${fieldId}"]`);
}

/** A group-editor row — the old `ProfileFieldRow`, which that screen still uses. */
function groupRow(page: Page, fieldId: string): Locator {
  return page.locator(`[data-profile-field="${fieldId}"]`);
}

/** The strong form of "this value is not on screen": it is nowhere in the markup. */
async function markupOf(target: Locator): Promise<string> {
  return target.evaluate((node) => node.outerHTML);
}

function bodyOf(request: Request): Record<string, unknown> {
  return JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
}

function waitForWrite(page: Page, method: string, path: RegExp): Promise<Request> {
  return page.waitForRequest(
    (request) => request.method() === method && path.test(new URL(request.url()).pathname),
  );
}

/* ── the `?state=` matrix on both routes (AC-24, E-34) ──────────────────────────────── */

test.describe("the state matrix (§8D.1, AC-24)", () => {
  const CASES = [
    { query: "", expected: "success" },
    { query: "?state=success", expected: "success" },
    { query: "?state=loading", expected: "loading" },
    { query: "?state=empty", expected: "empty" },
    { query: "?state=error", expected: "error" },
    { query: "?state=offline", expected: "offline" },
    // §11 E-34: an unrecognised value falls back to success and never throws.
    { query: "?state=banana", expected: "success" },
  ] as const;

  for (const { query, expected } of CASES) {
    test(`/profile${query || " (no query)"} reports data-screen-state="${expected}"`, async ({
      page,
    }) => {
      await gotoProfile(page, query);
      await expect(page.locator("[data-screen-state]")).toHaveAttribute(
        "data-screen-state",
        expected,
      );
    });

    test(`/profile/groups/group_work${query || " (no query)"} reports data-screen-state="${expected}"`, async ({
      page,
    }) => {
      await gotoGroup(page, "group_work", query);
      await expect(page.locator("[data-screen-state]")).toHaveAttribute(
        "data-screen-state",
        expected,
      );
    });
  }

  test("error and offline both offer a retry, never a blank screen", async ({ page }) => {
    await gotoProfile(page, "?state=error");
    await expect(page.locator('[data-error-panel="page"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

    await gotoProfile(page, "?state=offline");
    await expect(page.locator('[data-error-panel="page"]')).toBeVisible();

    // §8D.1: the page header survives a data failure — a partial failure never costs the
    // reader their orientation.
    await expect(page.getByRole("heading", { level: 1, name: "Profile & Cards" })).toBeVisible();
  });

  test("the shell keeps exactly one main landmark and one page h1 (AC-25)", async ({ page }) => {
    await gotoProfile(page);
    // `AppShell` owns it. `<ScreenStateRoot as="main">` here would fail landmark-unique.
    await expect(page.locator("main")).toHaveCount(1);
    /* The preview is the card page itself, which titles the card with its own <h1> — the same
       as the builder's preview. The workspace's own heading is the one outside it. */
    await expect(page.locator("h1:not([data-builder-preview] h1)")).toHaveCount(1);

    await gotoGroup(page, "group_identity");
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Identity" })).toBeVisible();
  });
});

/* ── §11 E-08 ───────────────────────────────────────────────────────────────────────── */

test.describe("E-08 — a profile with no fields", () => {
  test("every section still renders, with every suggestion as a blank row to fill", async ({
    page,
  }) => {
    await gotoProfile(page, "?state=empty");

    await expect(page.locator("[data-screen-state]")).toHaveAttribute(
      "data-screen-state",
      "empty",
    );
    await expect(page.locator("[data-workspace-section]")).toHaveCount(PROFILE_SECTIONS.length);
    await expect(page.locator("[data-workspace-row-blank]")).toHaveCount(ALL_SUGGESTIONS.length);
    await expect(page.locator("[data-workspace-row]:not([data-workspace-row-blank])")).toHaveCount(0);
    await expect(page.locator("[data-add-child]")).toHaveCount(1);

    // §6.3: `?state=empty` keeps the user. An owner with no fields still has a name.
    await expect(page.locator("[data-profile-identity]")).toBeVisible();
    await expect(page.locator("[data-identity-name]")).toContainText("Priyanka");
    await expect(page.locator("[data-workspace-intro]")).toHaveText("Complete the fields below.");
  });

  test("the group editor shows the same empty state for an empty group", async ({ page }) => {
    await gotoGroup(page, "group_financial", "?state=empty");

    await expect(page.locator("[data-screen-state]")).toHaveAttribute(
      "data-screen-state",
      "empty",
    );
    await expect(page.locator('[data-group-empty="group_financial"]')).toContainText(
      "No fields in Payments yet",
    );
    await expect(page.locator("[data-add-field]")).toHaveCount(1);
  });
});

/* ── AC-33 — masking, and the one legitimate reveal ─────────────────────────────────── */

test.describe("AC-33 — masked values, and the reveal that lives only here", () => {
  test("a financial field is masked and its raw value is nowhere in the row", async ({
    page,
  }) => {
    await gotoProfile(page);
    await expandSection(page, "payment");

    const bank = row(page, BANK_FIELD);
    await expect(bank).toHaveAttribute("data-field-masked", "");
    await expect(bank).toContainText(BANK_MASKED);
    expect(await markupOf(bank)).not.toContain(BANK_RAW);
    await expect(bank.locator("a")).toHaveCount(0);
    await expect(bank.locator("[title]")).toHaveCount(0);
  });

  test("the three financial types are sensitive and masked, by type alone", async ({ page }) => {
    await gotoProfile(page);
    await expandSection(page, "payment");

    const upi = row(page, UPI_FIELD);
    await expect(upi).toHaveAttribute("data-field-masked", "");
    await expect(upi).toHaveAttribute("data-field-sensitive", "");
    expect(await markupOf(upi)).not.toContain(UPI_RAW);
  });

  /**
   * A non-financial field cannot be masked: sensitivity is derived from the type and there is
   * no `isSensitive` column to record an owner's wish (`docs/INTEGRATION.md` ask #6).
   */
  test("a non-financial field is shown plainly, with no reveal", async ({ page }) => {
    await gotoProfile(page);
    await expandSection(page, "personal");

    const dob = row(page, DOB_FIELD);
    await expect(dob).not.toHaveAttribute("data-field-sensitive", "");
    await expect(dob).not.toHaveAttribute("data-field-masked", "");
    await expect(dob.locator("[data-field-value]")).toHaveText("8 March 1991");
    await expect(dob.locator("[data-field-reveal]")).toHaveCount(0);
  });

  test("an ordinary field is not masked and offers no reveal control", async ({ page }) => {
    await gotoProfile(page);
    const phone = row(page, PHONE_FIELD);
    await expect(phone).not.toHaveAttribute("data-field-masked", "");
    await expect(phone.locator("[data-field-reveal]")).toHaveCount(0);
  });

  test("pressing a masked row reveals it, announces which field, and it hides again", async ({
    page,
  }) => {
    await gotoProfile(page);
    await expandSection(page, "payment");

    const bank = row(page, BANK_FIELD);
    await bank.getByRole("button", { name: "Reveal Business account" }).click();

    await expect(bank).toHaveAttribute("data-field-revealed", "");
    await expect(bank).not.toHaveAttribute("data-field-masked", "");
    await expect(bank).toContainText(BANK_RAW);
    const hide = bank.locator(`[data-field-reveal="${BANK_FIELD}"]`);
    await expect(hide).toHaveAttribute("aria-pressed", "true");
    await expect(hide).toHaveAccessibleName("Hide Business account");
    // The announcement names the field and never carries the value (§13.1, §7.3).
    await expect(bank.locator('[role="status"]')).toHaveText("Showing Business account");
    await expect(bank.locator("a")).toHaveCount(0);
    await expect(bank.locator("[title]")).toHaveCount(0);

    await hide.click();
    await expect(bank).toHaveAttribute("data-field-masked", "");
    expect(await markupOf(bank)).not.toContain(BANK_RAW);
  });

  test("editing a masked field needs the reveal first — the first press never opens a form", async ({
    page,
  }) => {
    await gotoProfile(page);
    await expandSection(page, "payment");

    const bank = row(page, BANK_FIELD);
    await bank.locator("[data-workspace-row-open]").click();
    // A negative assertion needs time to be wrong in.
    await page.waitForTimeout(300);
    await expect(bank.locator("[data-workspace-row-form]")).toHaveCount(0);
    await expect(bank).toHaveAttribute("data-field-revealed", "");

    await bank.locator("[data-workspace-row-open]").click();
    await expect(bank.locator("[data-workspace-row-form]")).toBeVisible();
  });

  test("reveal resets when the owner navigates away and back (§7.3)", async ({ page }) => {
    await gotoProfile(page);
    await expandSection(page, "payment");
    await row(page, BANK_FIELD).getByRole("button", { name: "Reveal Business account" }).click();
    await expect(row(page, BANK_FIELD)).toHaveAttribute("data-field-revealed", "");

    // A real client-side navigation: the reveal set has to die with the component.
    await page.locator('[data-group-editor-link="group_financial"]').click();
    await expect(page.locator("[data-screen-state]")).toHaveCount(1);
    await expect(groupRow(page, BANK_FIELD)).toHaveAttribute("data-field-masked", "");
    expect(await markupOf(groupRow(page, BANK_FIELD))).not.toContain(BANK_RAW);

    await page.getByRole("link", { name: "Back to profile" }).first().click();
    await expect(page.locator("[data-screen-state]")).toHaveCount(1);
    await expandSection(page, "payment");
    await expect(row(page, BANK_FIELD)).toHaveAttribute("data-field-masked", "");
    expect(await markupOf(row(page, BANK_FIELD))).not.toContain(BANK_RAW);
  });

  test("a reload never restores a reveal — nothing about it is persisted", async ({ page }) => {
    await gotoProfile(page);
    await expandSection(page, "payment");
    await row(page, BANK_FIELD).getByRole("button", { name: "Reveal Business account" }).click();
    await expect(row(page, BANK_FIELD)).toHaveAttribute("data-field-revealed", "");

    await gotoProfile(page);
    expect(page.url()).not.toContain("reveal");
    await expandSection(page, "payment");
    await expect(row(page, BANK_FIELD)).toHaveAttribute("data-field-masked", "");
  });

  test("the public card offers no reveal control at all (AC-33)", async ({ page }) => {
    /* ⚠ `pay`, not `prya-pay`. The e2e API stub serves the public link route itself — `/c/[slug]`
       resolves server-side, so `page.route()` cannot reach it — and it answers
       `SHARE_LINK_NOT_FOUND` to any token outside its own vocabulary. `prya-*` is a
       `src/fixtures` slug that the stub has never known, so this test was asserting against the
       not-found panel: `[data-card-root]` was absent and the "no reveal control" check passed
       vacuously. `pay` is the stub's named token for a card mapping a `BANK_ACCOUNT`. */
    await gotoReady(page, "/c/pay");
    await expect(page.locator("[data-card-root]")).toHaveCount(1);

    // The whole point of the rule: `/c/[slug]` is unauthenticated by design.
    await expect(page.locator("[data-field-reveal]")).toHaveCount(0);
    expect(await markupOf(page.locator("[data-card-root]"))).not.toContain(BANK_RAW);
  });

  /**
   * ⚠ **What this test owns now, and what it handed back.**
   *
   * It used to mark `field_pronouns` sensitive by clicking its toggle, shorten the value to
   * four characters, and assert the mask was `••••` with no tail. Two of those three steps are
   * no longer possible, and neither is a regression:
   *
   * · The toggle is inert — there is no `isSensitive` column, so sensitivity comes from the
   *   type (see the two tests above).
   * · A financial field's **inline edit is disabled**, which is right: the value is encrypted
   *   at rest and the owner is looking at a mask, so "edit" would mean typing over something
   *   they cannot read.
   *
   * The short-value rule itself is not dropped — it is asserted directly and more precisely by
   * `tests/unit/format.test.ts` ("masks a short value entirely rather than revealing all of
   * it": `maskTail("1234")` is a bare run with no tail, as are `"12"` and `""`). Duplicating it
   * here would need a fixture manufactured solely to be short.
   *
   * So this keeps the part only a browser can check: the rendered row shows the mask, never the
   * secret, and offers no way to edit it blind.
   */
  test("a masked financial row shows the mask, never the secret, and cannot be edited blind", async ({
    page,
  }) => {
    await gotoGroup(page, "group_financial");

    const bank = groupRow(page, BANK_FIELD);
    await expect(bank).toHaveAttribute("data-field-masked", "");
    await expect(bank.locator("[data-field-value]")).toHaveText(BANK_MASKED);
    expect(await markupOf(bank)).not.toContain(BANK_RAW);

    /* Disabled, not absent — the control keeps its place in the tab order and carries a reason,
       which is T05's rule for every disabled control (AC-26). */
    const edit = bank.locator(`[data-field-edit="${BANK_FIELD}"]`);
    await expect(edit).toHaveAttribute("aria-disabled", "true");
    await expect(edit).toHaveAttribute("aria-describedby", /.+/);
  });
});

/* ── click-to-edit, suggestions, Add field ─────────────────────────────────────────── */

test.describe("the workspace editor", () => {
  test("pressing a row opens it in place, and Enter saves it to the profile", async ({ page }) => {
    await gotoProfile(page);

    const company = row(page, "field_company");
    await company.locator("[data-workspace-row-open]").click();
    const input = company.locator("[data-workspace-row-input]");
    await expect(input).toBeFocused();
    await input.fill("Fernwood Studio Pvt Ltd");

    const patched = waitForWrite(page, "PATCH", /\/profile\/fields\/field_company$/);
    await input.press("Enter");

    expect(bodyOf(await patched)).toMatchObject({ label: "Company", value: "Fernwood Studio Pvt Ltd" });
    await expect(company.locator("[data-workspace-row-form]")).toHaveCount(0);
  });

  test("Escape cancels an edit and sends nothing", async ({ page }) => {
    await gotoProfile(page);
    let wrote = false;
    page.on("request", (request) => {
      if (request.method() === "PATCH" && request.url().includes("/profile/fields/")) wrote = true;
    });

    const company = row(page, "field_company");
    await company.locator("[data-workspace-row-open]").click();
    await company.locator("[data-workspace-row-input]").fill("Something else");
    await page.keyboard.press("Escape");

    await expect(company.locator("[data-workspace-row-form]")).toHaveCount(0);
    await expect(company.locator("[data-field-value]")).toHaveText("Fernwood Studio");
    await page.waitForTimeout(300);
    expect(wrote).toBe(false);
  });

  test("a stored field cannot be emptied — it stays open and says why", async ({ page }) => {
    await gotoProfile(page);
    const mobile = row(page, PHONE_FIELD);
    await mobile.locator("[data-workspace-row-open]").click();
    await mobile.locator("[data-workspace-row-input]").fill("");
    await page.keyboard.press("Enter");

    await expect(mobile.getByRole("alert")).toHaveText("Enter a value.");
    await expect(mobile.locator("[data-workspace-row-form]")).toBeVisible();
  });

  test("a blank suggestion is created on its first non-empty save, onto the selected card", async ({
    page,
  }) => {
    await gotoProfile(page);
    await expandSection(page, "business");

    /* The fixture has no business name, so the suggestion is a blank row with its prompt. */
    const blank = page.locator('[data-suggestion="business-name"]');
    await expect(blank).toHaveAttribute("data-workspace-row-blank", "");
    await blank.getByRole("button", { name: "Add business name" }).click();
    await blank.locator("[data-workspace-row-input]").fill("Fernwood Studio Pvt Ltd");

    const created = waitForWrite(page, "POST", /\/profile\/fields$/);
    const carded = waitForWrite(page, "PUT", new RegExp(`/cards/${FIRST_CARD}/fields$`));
    await page.keyboard.press("Enter");

    expect(bodyOf(await created)).toMatchObject({
      category: "BUSINESS",
      type: "COMPANY",
      label: "Business name",
      value: "Fernwood Studio Pvt Ltd",
      groupId: "group_business",
    });
    /* The stub answers the create with the id `field_created_stub`; the card's whole set goes
       out with it added. */
    const fields = (bodyOf(await carded).fields as { fieldId: string }[]).map((f) => f.fieldId);
    expect(fields).toContain("field_created_stub");
  });

  test("a blank row left empty closes without a request", async ({ page }) => {
    await gotoProfile(page);
    await expandSection(page, "business");
    let wrote = false;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/profile/fields")) wrote = true;
    });

    const blank = page.locator('[data-suggestion="business-name"]');
    await blank.locator("[data-workspace-row-open]").click();
    await page.locator('[data-section-toggle="business"]').focus();

    await expect(blank.locator("[data-workspace-row-form]")).toHaveCount(0);
    await expect(blank.getByRole("button", { name: "Add business name" })).toBeVisible();
    await page.waitForTimeout(300);
    expect(wrote).toBe(false);
  });

  test("Add field offers the section's own catalogue, and the pick is saved like a suggestion", async ({
    page,
  }) => {
    await gotoProfile(page);
    await expandSection(page, "other");

    await page.locator('[data-add-field-open="other"]').click();
    const offers = page.locator('[data-add-field-offers="other"] [data-field-offer]');
    const catalogue = FIELD_CATALOGUE.find((section) => section.category === "CUSTOM");
    await expect(offers).toHaveCount(catalogue?.offers.length ?? -1);

    await page.locator('[data-add-field-offers="other"] [data-field-offer="note"]').click();
    const draft = page.locator('[data-workspace-section="other"] [data-workspace-row-editing]');
    /* A note names itself badly, so its name is asked for too. */
    await draft.getByLabel("Field name").fill("Studio motto");
    await draft.locator("[data-workspace-row-input]").fill("Make the thing, then make it plain");

    const created = waitForWrite(page, "POST", /\/profile\/fields$/);
    await page.keyboard.press("Enter");
    expect(bodyOf(await created)).toMatchObject({
      category: "CUSTOM",
      type: "TEXT",
      label: "Studio motto",
      value: "Make the thing, then make it plain",
    });
  });

  test("Add a child saves the name and the birthday as two personal fields", async ({ page }) => {
    await gotoProfile(page);

    await page.locator("[data-add-child]").click();
    const form = page.locator("[data-add-child-form]");
    await form.getByLabel("Name").fill("Aarav");
    await form.getByLabel("Birthday").fill("2019-05-12");

    const posts: Record<string, unknown>[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/profile/fields")) {
        posts.push(bodyOf(request));
      }
    });
    await form.locator("[data-add-child-save]").click();

    await expect.poll(() => posts.length).toBe(2);
    expect(posts).toEqual([
      expect.objectContaining({ category: "PERSONAL", type: "RELATION", label: "Child", value: "Aarav" }),
      expect.objectContaining({
        category: "PERSONAL",
        type: "DATE",
        label: childBirthdayLabel("Aarav"),
        value: "2019-05-12",
      }),
    ]);
  });

  test("the company logo row says it belongs to the selected card", async ({ page }) => {
    await gotoProfile(page);
    const logo = page.locator('[data-workspace-section="work"] [data-workspace-logo]');
    await expect(logo).toContainText("Company logo");
    await expect(logo).toContainText("On the Work card only");
  });

  test("reordering moves a field within its group and stops at the ends", async ({ page }) => {
    await gotoGroup(page, "group_business");

    const rows = page.locator("[data-profile-field]");
    const before = await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-profile-field")),
    );
    expect(before.length).toBeGreaterThan(1);

    // The first row cannot go up — the control keeps its place in the tab order and says why.
    const first = page.locator(`[data-profile-field="${before[0]}"]`);
    await expect(first.locator('[data-field-move="up"]')).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await first.locator('[data-field-move="down"]').click();

    const after = await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-profile-field")),
    );
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[0]);
  });

});

/* ── Design and Share are panels on this page, not links away (client, 2026-09-30) ──── */

test.describe("Design and Share open beside the card", () => {
  test("neither tab leaves /profile, and the card stays on screen", async ({ page }) => {
    await gotoProfile(page);
    const preview = page.locator("[data-builder-preview]");
    await expect(preview).toBeVisible();
    /* The old links are gone, not hidden. */
    await expect(page.locator('[data-split-pinned] a[href^="/cards/"]')).toHaveCount(0);

    await page.locator('[data-workspace-tab="design"]').click();
    await expect(page.locator("[data-design-panel]")).toBeVisible();
    await expect(page).toHaveURL(/\/profile\?panel=design$/);
    await expect(preview).toBeVisible();

    await page.locator('[data-workspace-tab="share"]').click();
    await expect(page.locator("[data-send-to-phone]")).toBeVisible();
    await expect(page.locator("[data-card-link] [data-link-field] input")).toHaveValue(/\/c\//);
    await expect(page.locator("[data-workspace-qr] [data-qr-zone]")).toBeVisible();
    await expect(page).toHaveURL(/\/profile\?panel=share$/);
    await expect(preview).toBeVisible();

    await page.locator('[data-workspace-tab="fields"]').click();
    await expect(page.locator("[data-workspace-fields]")).toBeVisible();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("?panel= opens that panel on load", async ({ page }) => {
    await gotoProfile(page, "?panel=share&card=card_forest_demo");
    await expect(page.locator('[data-workspace-tab="share"]')).toHaveAttribute(
      "data-state",
      "active",
    );
    await expect(page.locator("[data-send-to-phone]")).toBeVisible();
  });

  test("a look lands on the preview at once and saves itself", async ({ page }) => {
    await gotoProfile(page, "?panel=design");
    const summary = page.locator("[data-builder-preview-summary]");
    await expect(summary).not.toContainText("Emerald");

    const patched = waitForWrite(page, "PATCH", new RegExp(`/cards/${FIRST_CARD}$`));
    await page.locator('[data-look-option="emerald-gradient"]').click();

    // Same frame as the tap — not after the write.
    await expect(summary).toContainText("Emerald");
    const body = bodyOf(await patched);
    expect(body.paletteId).toBe("emerald");
    expect(body.finish).toBe("gradient");
    /* PATCH takes only `null` for the cover; a design write must never carry it. */
    expect(body).not.toHaveProperty("coverUrl");
    await expect(page.locator('[data-workspace-sync="saved"]')).toBeVisible();

    /* The edit survives a trip to another panel and back. */
    await page.locator('[data-workspace-tab="fields"]').click();
    await page.locator('[data-workspace-tab="design"]').click();
    await expect(page.locator("[data-look-picker]")).toHaveAttribute(
      "data-selected-look",
      "emerald-gradient",
    );
  });

  test("renaming the card in Design renames its switcher pill and saves the name", async ({
    page,
  }) => {
    await gotoProfile(page, "?panel=design");
    const name = page.locator("[data-builder-name]");
    const patched = waitForWrite(page, "PATCH", new RegExp(`/cards/${FIRST_CARD}$`));
    await name.fill("Partnerships");
    await expect(page.locator(`[data-card-switch="${FIRST_CARD}"]`)).toContainText("Partnerships");
    expect(bodyOf(await patched).name).toBe("Partnerships");
  });

  test("Position and Bio are rows at the top of Fields, and Design no longer has them", async ({
    page,
  }) => {
    await gotoProfile(page);
    const intro = page.locator("[data-workspace-card-intro]");
    await expect(intro.locator("[data-card-intro-row]")).toHaveCount(2);
    await expect(intro.locator("[data-card-intro-scope]")).toContainText("Work");
    /* Above Personal: they print under the name, so they come first. */
    const order = await page
      .locator("[data-workspace-fields] > section")
      .evaluateAll((nodes) =>
        nodes.map((node) =>
          node.hasAttribute("data-workspace-card-intro")
            ? "intro"
            : node.getAttribute("data-workspace-section"),
        ),
      );
    expect(order[0]).toBe("intro");

    await page.locator('[data-workspace-tab="design"]').click();
    await expect(page.locator("[data-design-panel]")).toBeVisible();
    await expect(page.locator("[data-headline-input], [data-bio-input]")).toHaveCount(0);
  });

  test("a position typed in Fields replaces the job title on the card and saves to it", async ({
    page,
  }) => {
    await gotoProfile(page);
    const fold = page.locator("[data-workspace-preview-fold]");
    const preview = page.locator("[data-builder-preview]");

    await page.locator('[data-card-intro-open="headline"]').click();
    const patched = waitForWrite(page, "PATCH", new RegExp(`/cards/${FIRST_CARD}$`));
    await page.locator('[data-card-intro-input="headline"]').fill("Founder & CEO");
    await page.keyboard.press("Enter");

    if (await fold.isVisible()) await expect(fold).toHaveAttribute("aria-expanded", "true");
    await expect(preview).toContainText("Founder & CEO");
    await expect(page.locator('[data-card-intro-row="headline"] [data-card-intro-value]')).toHaveText(
      "Founder & CEO",
    );
    const body = bodyOf(await patched);
    expect(body.headline).toBe("Founder & CEO");
    expect(body).not.toHaveProperty("coverUrl");
  });

  test("Send to a phone sends from the Share panel without leaving it", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!, { sub: statefulSub("workspace-share") });
    await gotoProfile(page, "?panel=share");

    /* Below `lg` the preview is pinned over the top of the screen; fold it, as a phone user
       filling in the form would, so the form has the viewport. */
    const fold = page.locator("[data-workspace-preview-fold]");
    if (await fold.isVisible()) await fold.click();

    await page.locator("[data-send-mode-toggle]").click();
    await page.locator("[data-send-contact-picker] button").click();
    await page.getByRole("option").first().click();

    const sent = waitForWrite(page, "POST", new RegExp(`/cards/${FIRST_CARD}/share$`));
    await page.locator("[data-send-card]").click();
    await sent;

    await expect(page.locator("[data-send-to-phone]")).toHaveAttribute("data-send-state", /sent/);
    await expect(page.locator("[data-workspace-sent-to] [data-card-shares] li")).toHaveCount(1);
    await expect(page).toHaveURL(/\/profile\?panel=share$/);
  });
});

/* ── the card switcher, the tick and the preview ──────────────────────────────────── */

test.describe("the card beside the fields", () => {
  test("ticking a field shows it on the preview at once and writes the card's whole set", async ({
    page,
  }) => {
    await gotoProfile(page);
    const preview = page.locator("[data-builder-preview]");
    await expect(page.locator(`[data-workspace-row-toggle="${PHONE_FIELD}"]`)).toBeVisible();
    await expect(preview.locator(`[data-card-field="${PHONE_FIELD}"]`)).toHaveCount(0);

    const before = await page
      .locator("[data-workspace-row-toggle][data-state=checked]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-workspace-row-toggle")));

    const put = waitForWrite(page, "PUT", new RegExp(`/cards/${FIRST_CARD}/fields$`));
    await page.locator(`[data-workspace-row-toggle="${PHONE_FIELD}"]`).click();

    // Same frame as the tick — not after the write.
    await expect(preview.locator(`[data-card-field="${PHONE_FIELD}"]`)).toHaveCount(1);

    const sent = (bodyOf(await put).fields as { fieldId: string }[]).map((f) => f.fieldId);
    expect(sent.sort()).toEqual([...before, PHONE_FIELD].sort());
    await expect(page.locator('[data-workspace-sync="saved"]')).toBeVisible();
  });

  test("the selected card lives in ?card= and survives a reload", async ({ page }) => {
    await gotoProfile(page);
    await page.locator('[data-card-switch="card_forest_demo"]').click();
    await expect(page).toHaveURL(/[?&]card=card_forest_demo/);
    await expect(page.locator('[data-card-switch="card_forest_demo"]')).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.reload();
    await expect(page.locator("[data-screen-state]")).toHaveCount(1);
    await expect(page.locator('[data-card-switch="card_forest_demo"]')).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("a new card asks only for a name and starts with every filled field on it", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!, { sub: statefulSub("workspace-new-card") });
    await gotoProfile(page);

    await page.locator("[data-card-switcher-open]").click();
    await page.locator("[data-card-switcher-name]").fill("Weekend");

    const created = waitForWrite(page, "POST", /\/cards$/);
    const carried = page.waitForRequest(
      (request) => request.method() === "PUT" && /\/cards\/[^/]+\/fields$/.test(request.url()),
    );
    await page.keyboard.press("Enter");
    await created;

    const expected = fixtureFields
      .filter((field) => field.type !== "PHOTO" && field.value.trim() !== "")
      .map((field) => field.id);
    const sent = (bodyOf(await carried).fields as { fieldId: string }[]).map((f) => f.fieldId);
    expect(sent.sort()).toEqual([...expected].sort());

    const pill = page.locator('[data-card-switch]:has-text("Weekend")');
    await expect(pill).toHaveAttribute("aria-checked", "true");
    await expect(page).toHaveURL(/[?&]card=card_stateful_/);
  });
});

/* ── §11 E-41 ───────────────────────────────────────────────────────────────────────── */

test.describe("E-41 — deleting a field states how many cards use it, first", () => {
  test("the confirm dialog carries a card count before anything is deleted", async ({
    page,
  }) => {
    await gotoGroup(page, "group_financial");

    await groupRow(page, BANK_FIELD).locator(`[data-field-delete="${BANK_FIELD}"]`).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Delete Business account?");

    const consequence = dialog.locator("[data-confirm-consequence]");
    await expect(consequence).toBeVisible();
    // The count is the decision, so the count is what is asserted.
    await expect(consequence).toHaveText(/^\d+ cards? uses? this field/);
    // …and the names are what make the count mean something. `prya-pay` maps this field.
    await expect(consequence).toContainText("Payments");

    // Focus starts on the safe choice — one stray Enter must not delete anything.
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(groupRow(page, BANK_FIELD)).toHaveCount(1);
  });

  test("confirming removes the row and reports what stopped showing it", async ({ page }) => {
    await gotoGroup(page, "group_financial");

    await groupRow(page, BANK_FIELD).locator(`[data-field-delete="${BANK_FIELD}"]`).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete field" }).click();

    await expect(groupRow(page, BANK_FIELD)).toHaveCount(0);
    /* Scoped to the toast's own description, for the same reason as the edit test above: Radix
       mirrors toast copy into an off-screen announce region for screen readers, so a bare
       `getByText` matches two nodes — the visible one and the announcement — and `toBeVisible`
       then resolves against whichever it picked. */
    await expect(page.locator("[data-toast-description]")).toContainText("stopped showing it");
  });

  test("delete lives on the group editor, not on the workspace (§8D.3)", async ({ page }) => {
    await gotoProfile(page);
    await expandSection(page, "payment");
    await expect(page.locator("[data-field-delete]")).toHaveCount(0);
  });
});

/* ── §5.5 — groups are renameable and never deletable ───────────────────────────────── */

test.describe("field groups (§5.5)", () => {
  test("a group can be renamed and the heading follows", async ({ page }) => {
    await gotoGroup(page, "group_custom");

    await page.locator('[data-group-rename="group_custom"]').click();
    const form = page.locator('[data-group-rename-form="group_custom"]');
    await form.getByLabel("Group name").fill("Odds and ends");
    await form.getByRole("button", { name: "Save name" }).click();

    await expect(form).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Odds and ends" })).toBeVisible();
  });

  test("there is no way to delete a group anywhere in the track", async ({ page }) => {
    await gotoGroup(page, "group_custom");
    // Not disabled, not hidden behind a confirm — it does not exist (§5.5).
    await expect(page.getByRole("button", { name: /delete .*group/i })).toHaveCount(0);

    await gotoProfile(page);
    await expect(page.getByRole("button", { name: /delete .*group/i })).toHaveCount(0);
  });

  test("an unknown groupId renders the not-found panel, never a raw 404", async ({ page }) => {
    await gotoReady(page, "/profile/groups/group_does_not_exist");

    await expect(page.locator("[data-not-found-panel]")).toBeVisible();
    await expect(page.locator("[data-not-found-panel]")).toContainText(
      "We couldn't find that field group",
    );
    // Not an empty state, and no retry: retrying a wrong URL fails again.
    await expect(page.locator("[data-empty-state]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to profile" })).toBeVisible();
  });
});

/* ── the collapsible sections ─────────────────────────────────────────────────────── */

test.describe("the workspace sections", () => {
  test("Personal and Work open, the rest collapsed, each with a working disclosure", async ({
    page,
  }) => {
    await gotoProfile(page);

    await expect(page.locator("[data-workspace-section]")).toHaveCount(PROFILE_SECTIONS.length);
    for (const section of PROFILE_SECTIONS) {
      await expect(page.locator(`[data-section-toggle="${section.id}"]`)).toHaveAttribute(
        "aria-expanded",
        String(section.defaultOpen),
      );
    }

    const toggle = page.locator('[data-section-toggle="social"]');
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(row(page, "field_linkedin")).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("collapsed sections hide their rows from everyone, not just visually", async ({
    page,
  }) => {
    await gotoProfile(page);
    await expect(page.locator('[data-section-toggle="social"]')).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(row(page, "field_linkedin")).toBeHidden();
  });

  test("none of the retired helper copy is on the screen", async ({ page }) => {
    await gotoProfile(page);
    const text = await page.locator("[data-screen-state]").innerText();
    for (const retired of [
      "Every card is a filter",
      "fields across",
      "Add a job, business, social profile",
      "Your name and email are set when you sign up",
    ]) {
      expect(text, retired).not.toContain(retired);
    }
  });
});
