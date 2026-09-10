import { expect, test, type Locator, type Page } from "@playwright/test";

import { gotoReady } from "../helpers/e2e";
import { signIn } from "../helpers/session";

/* ⚠ `/profile` is a gated route — `proxy.ts` bounces it to `/signin/phone` without a session
   cookie, and this file had no sign-in step at all, so every test in it was asserting against
   the phone-number screen rather than the profile. `contacts.spec.ts` has carried this exact
   block since the routes were gated; this file was simply missed. */
test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

/**
 * `/profile` and `/profile/groups/[groupId]` — spec §6.1 R-16/R-17, §8D.3, §4.5, §7.3,
 * §11 E-08, E-34, E-40, E-41, and **AC-33's reveal**.
 *
 * ## The three assertions this file exists for
 *
 * 1. **AC-33 — this is the only surface in the product with a reveal control, and while a
 *    row is masked the raw value is not in its markup at all.** The headline check is
 *    deliberately `outerHTML`, not `toContainText`: a leak through an `href`, a `title`, a
 *    `value=` or a `data-` attribute is invisible to a text assertion and is exactly the
 *    class of bug §7.3 is written against. T12 strips `href` and `title` from a masked row
 *    on purpose — a masked `+91 22612 34567` still carrying `tel:+912261234567` is a leak,
 *    not a cosmetic slip — so the row-level markup check is what proves the consumer did
 *    not put them back.
 *
 * 2. **E-08 — `?state=empty` is SEVEN groups with no fields, not zero groups.**
 *    `EMPTY_FIXTURE_DB` keeps the user and keeps every `FieldGroup` with `fieldIds: []`
 *    (§6.3). A test asserting "empty means nothing renders" on this screen would be
 *    asserting the wrong product.
 *
 * 3. **E-41 — deleting a field states how many cards use it, in the dialog, before the
 *    delete happens.** Asserted on the count itself, since the count is the decision.
 *
 * ## Two mechanics every test here depends on
 *
 * · **Wait for `[data-screen-state]`, never race the fallback.** Both routes ship a
 *   `loading.tsx`, so the response streams a skeleton before the client half mounts. The
 *   skeletons deliberately carry no `data-screen-state`, and `gotoProfile` waits for
 *   exactly one element that does — the wave-6 W6-08 lesson, applied up front.
 *
 * · **Sections are collapsed below 768px (§8D.3).** `expandGroup` reads `aria-expanded`
 *   and clicks only when it needs to, so every test reads identically at 360, 768 and
 *   1440 without branching on the project name.
 */

/* ── fixture facts these tests are written against (src/fixtures/profile.ts) ─────────── */

/** `BANK_ACCOUNT`, `isSensitive: true`. Masked twice over. */
const BANK_FIELD = "field_bank";
const BANK_RAW = "50100412345678";
const BANK_MASKED = "••••5678";

/** `DIGITAL_WALLET`, `isSensitive: FALSE` — masked anyway, because the type says so. */
const UPI_FIELD = "field_upi";
const UPI_RAW = "priyanka@okhdfcbank";

/**
 * `DATE`. ⚠ The fixture still carries `isSensitive: true`, and it no longer reaches the row —
 * sensitivity is derived from the field's type now, and `DATE` is not one of the three
 * encrypted kinds. The row renders plainly. `DOB_RAW` is gone with the assertion that used it:
 * the value is formatted for reading ("8 March 1991"), so the fixture's `1991-03-08` is not in
 * the markup even when nothing is hidden.
 */
const DOB_FIELD = "field_dob";

/** `PHONE`, not sensitive. The control case: never masked, always editable. */
const PHONE_FIELD = "field_mobile";

const SEVEN_GROUPS = 7;

/* ── helpers ────────────────────────────────────────────────────────────────────────── */

async function gotoProfile(page: Page, query = ""): Promise<void> {
  await gotoReady(page, `/profile${query}`);
  // Exactly one: the client root. `loading.tsx` and the Suspense fallback carry none.
  await expect(page.locator("[data-screen-state]")).toHaveCount(1);
}

/** The add-field dialog's submit control. See the note at its first call site. */
async function submitAddField(page: Page): Promise<void> {
  await page.getByRole("dialog").getByRole("button", { name: "Add field" }).click();
}

async function gotoGroup(page: Page, groupId: string, query = ""): Promise<void> {
  await gotoReady(page, `/profile/groups/${groupId}${query}`);
  await expect(page.locator("[data-screen-state]")).toHaveCount(1);
}

/** Expand a group if this viewport collapsed it. Idempotent, so tests never branch. */
async function expandGroup(page: Page, groupId: string): Promise<void> {
  const toggle = page.locator(`[data-group-toggle="${groupId}"]`);
  await toggle.waitFor();
  if ((await toggle.getAttribute("aria-expanded")) === "false") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

function row(page: Page, fieldId: string): Locator {
  return page.locator(`[data-profile-field="${fieldId}"]`);
}

/**
 * The strong form of "this value is not on screen": it is nowhere in the row's markup.
 * Text, `href`, `title`, `value`, `aria-label`, a data attribute — all covered at once.
 */
async function markupOf(target: Locator): Promise<string> {
  return target.evaluate((node) => node.outerHTML);
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
    await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
  });

  test("the shell keeps exactly one main landmark and one h1 (AC-25)", async ({ page }) => {
    await gotoProfile(page);
    // `AppShell` owns it. `<ScreenStateRoot as="main">` here would fail landmark-unique.
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);

    await gotoGroup(page, "group_identity");
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Identity" })).toBeVisible();
  });
});

/* ── §11 E-08 ───────────────────────────────────────────────────────────────────────── */

test.describe("E-08 — a profile with zero fields in every group", () => {
  test("renders all seven groups, each with its own empty state and Add field", async ({
    page,
  }) => {
    await gotoProfile(page, "?state=empty");

    // The screen is empty; the groups are not gone. Both facts, at once.
    await expect(page.locator("[data-screen-state]")).toHaveAttribute(
      "data-screen-state",
      "empty",
    );
    await expect(page.locator("[data-field-group-section]")).toHaveCount(SEVEN_GROUPS);
    await expect(page.locator("[data-group-empty]")).toHaveCount(SEVEN_GROUPS);
    await expect(page.locator("[data-add-field]")).toHaveCount(SEVEN_GROUPS);

    // Not a single field row anywhere.
    await expect(page.locator("[data-profile-field]")).toHaveCount(0);

    // And it is the FIRST-RUN empty, never the filtered-to-nothing one: this screen has
    // no filter, so `empty-filtered` is unreachable by construction (§8D.3 records it n/a).
    await expect(page.locator('[data-empty-state="first-run"]')).toHaveCount(SEVEN_GROUPS);
    await expect(page.locator('[data-empty-state="filtered"]')).toHaveCount(0);
  });

  test("the per-group copy names the group and the identity block still renders", async ({
    page,
  }) => {
    await gotoProfile(page, "?state=empty");
    await expandGroup(page, "group_identity");

    await expect(page.locator('[data-group-empty="group_identity"]')).toContainText(
      "No fields in Identity yet",
    );

    // §6.3: `?state=empty` keeps the user. An owner with no fields still has a name.
    await expect(page.locator("[data-profile-identity]")).toBeVisible();
    await expect(page.locator("[data-identity-name]")).toContainText("Priyanka");
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
    await expandGroup(page, "group_financial");

    const bank = row(page, BANK_FIELD);
    await expect(bank).toHaveAttribute("data-field-masked", "");
    await expect(bank).toContainText(BANK_MASKED);

    // The headline check: not the text, the markup. An `href`, a `title`, an input value
    // or a stray data attribute would all be caught here and by nothing else.
    expect(await markupOf(bank)).not.toContain(BANK_RAW);

    // T12 strips both deliberately. Neither may be put back by a consumer.
    await expect(bank.locator("a")).toHaveCount(0);
    await expect(bank.locator("[title]")).toHaveCount(0);
  });

  /**
   * ⚠ **Sensitivity is derived from the field's TYPE, not stored** — see `map.ts`'s
   * `isSensitiveType`. The API has no `isSensitive` column at all; what it has is a set of
   * types it encrypts at rest. So a financial field is sensitive *and* masked by construction,
   * and the guarantee is stronger than a stored boolean: a bank account cannot be un-marked,
   * because nothing anywhere stores the mark.
   *
   * This test used to assert the opposite of its second line — that `field_upi` was masked
   * while NOT carrying the sensitive flag, because the fixture set `isSensitive: false` on it.
   * That fixture property no longer reaches the row.
   */
  test("the three financial types are sensitive and masked, by type alone", async ({ page }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_financial");

    const upi = row(page, UPI_FIELD);
    await expect(upi).toHaveAttribute("data-field-masked", "");
    await expect(upi).toHaveAttribute("data-field-sensitive", "");
    expect(await markupOf(upi)).not.toContain(UPI_RAW);

    // The toggle is present but inert, and says why — nothing can subtract the mark.
    await expect(upi.locator(`[data-sensitive-toggle="${UPI_FIELD}"]`)).toBeDisabled();
    await expect(upi).toContainText("Set by the field's type");
  });

  /**
   * ⚠ **A non-financial field can no longer be masked, and this test records the loss.**
   *
   * It used to assert the opposite: `field_dob` is a `DATE` the fixture marked
   * `isSensitive: true`, and it was masked purely by that owner policy. With sensitivity
   * derived from the type there is nowhere to record such a wish — `map.ts` says so in as many
   * words, and `docs/INTEGRATION.md` carries it as ask #6 against the API.
   *
   * Inverted rather than deleted, deliberately. A home address the owner wants hidden is a real
   * request the product currently cannot meet, and a suite that simply dropped the test would
   * leave nothing to fail on the day an `isSensitive` column lands and the UI is not rewired.
   */
  test("a non-financial field cannot be masked — the owner's own policy has nowhere to live", async ({
    page,
  }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_identity");

    const dob = row(page, DOB_FIELD);
    await expect(dob).not.toHaveAttribute("data-field-sensitive", "");
    await expect(dob).not.toHaveAttribute("data-field-masked", "");
    /* Visible, and no reveal control — there is nothing to reveal.

       ⚠ The rendered date, not `DOB_RAW`. A `DATE` row is formatted for reading — the fixture
       holds `1991-03-08` and the row prints "8 March 1991" — so asserting the ISO string finds
       nothing and would fail on a perfectly unmasked field. */
    await expect(dob.locator("[data-field-value]")).toHaveText("8 March 1991");
    await expect(dob.locator("[data-field-reveal]")).toHaveCount(0);
    // The toggle cannot be used to change that, and says so rather than failing silently.
    await expect(dob.locator(`[data-sensitive-toggle="${DOB_FIELD}"]`)).toBeDisabled();
  });

  test("an ordinary field is not masked and offers no reveal control", async ({ page }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_personal");

    const phone = row(page, PHONE_FIELD);
    await expect(phone).not.toHaveAttribute("data-field-masked", "");
    await expect(phone.locator("[data-field-reveal]")).toHaveCount(0);
  });

  test("reveal shows the value, announces which field, and hides it again", async ({
    page,
  }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_financial");

    const bank = row(page, BANK_FIELD);
    const reveal = bank.locator(`[data-field-reveal="${BANK_FIELD}"]`);

    await expect(reveal).toHaveAttribute("aria-pressed", "false");
    await expect(reveal).toHaveAccessibleName("Reveal Business account");

    await reveal.click();

    await expect(bank).toHaveAttribute("data-field-revealed", "");
    await expect(bank).not.toHaveAttribute("data-field-masked", "");
    await expect(bank).toContainText(BANK_RAW);
    await expect(reveal).toHaveAttribute("aria-pressed", "true");
    await expect(reveal).toHaveAccessibleName("Hide Business account");

    // The announcement names the field and never carries the value (§13.1, §7.3).
    const status = bank.locator('[role="status"]');
    await expect(status).toHaveText("Showing Business account");

    // Revealing is a decision to look, not a decision to publish: still no link, still no
    // hoverable copy of the value.
    await expect(bank.locator("a")).toHaveCount(0);
    await expect(bank.locator("[title]")).toHaveCount(0);

    await reveal.click();
    await expect(bank).toHaveAttribute("data-field-masked", "");
    expect(await markupOf(bank)).not.toContain(BANK_RAW);
  });

  test("editing a masked field is gated on revealing it first", async ({ page }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_financial");

    const bank = row(page, BANK_FIELD);
    const edit = bank.locator(`[data-field-edit="${BANK_FIELD}"]`);

    // The edit form is populated from the stored value, so opening it on a masked row
    // would be an unlabelled reveal. The control stays focusable and says why (AC-26).
    await expect(edit).toHaveAttribute("aria-disabled", "true");

    // `dispatchEvent` rather than `click`, for the same reason as builder.spec.ts's blocked
    // Save: Playwright's actionability gate treats `aria-disabled="true"` on a `button` as
    // not-enabled and would wait out the timeout instead of ever pressing it, so a plain
    // `click()` here tests the harness rather than the guard. This fires a real DOM click
    // straight at the element and asks what the application does with it — which is the
    // whole point, since T05's Button never emits the native `disabled` attribute.
    await edit.dispatchEvent("click");

    // A negative assertion needs time to be wrong in: `startEditing` is a React state
    // update, so a form that opened one frame later would sail past an immediate
    // `toHaveCount(0)`.
    await page.waitForTimeout(500);

    await expect(page.locator(`[data-field-edit-form="${BANK_FIELD}"]`)).toHaveCount(0);
    expect(await markupOf(bank)).not.toContain(BANK_RAW);

    await bank.locator(`[data-field-reveal="${BANK_FIELD}"]`).click();
    await expect(edit).not.toHaveAttribute("aria-disabled", "true");
    await edit.click();
    await expect(page.locator(`[data-field-edit-form="${BANK_FIELD}"]`)).toBeVisible();
  });

  test("reveal resets when the owner navigates away and back (§7.3)", async ({ page }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_financial");
    await row(page, BANK_FIELD).locator(`[data-field-reveal="${BANK_FIELD}"]`).click();
    await expect(row(page, BANK_FIELD)).toHaveAttribute("data-field-revealed", "");

    // A real client-side navigation, not a reload: the reveal set has to die with the
    // component rather than be cleared by a full page load.
    await page.locator('[data-group-editor-link="group_financial"]').click();
    await expect(page.locator("[data-screen-state]")).toHaveCount(1);
    await expect(row(page, BANK_FIELD)).toHaveAttribute("data-field-masked", "");
    expect(await markupOf(row(page, BANK_FIELD))).not.toContain(BANK_RAW);

    await page.getByRole("link", { name: "Back to profile" }).first().click();
    await expect(page.locator("[data-screen-state]")).toHaveCount(1);
    await expandGroup(page, "group_financial");
    await expect(row(page, BANK_FIELD)).toHaveAttribute("data-field-masked", "");
    expect(await markupOf(row(page, BANK_FIELD))).not.toContain(BANK_RAW);
  });

  test("a reload never restores a reveal — nothing about it is persisted", async ({ page }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_financial");
    await row(page, BANK_FIELD).locator(`[data-field-reveal="${BANK_FIELD}"]`).click();
    await expect(row(page, BANK_FIELD)).toHaveAttribute("data-field-revealed", "");

    // Same URL, fresh document. A reveal recorded in storage or in the query string would
    // survive this; component state cannot.
    await gotoProfile(page);
    expect(page.url()).not.toContain("reveal");
    await expandGroup(page, "group_financial");
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

    const bank = row(page, BANK_FIELD);
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

/* ── editing, adding, reordering — all of it in-memory (§5.7) ───────────────────────── */

test.describe("the editor", () => {
  test("an inline edit updates the row and says so in words", async ({ page }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_work");

    const company = row(page, "field_company");
    await company.locator('[data-field-edit="field_company"]').click();

    const form = page.locator('[data-field-edit-form="field_company"]');
    await form.getByLabel("Value").fill("Fernwood Studio Pvt Ltd");
    await form.getByRole("button", { name: "Save" }).click();

    await expect(form).toHaveCount(0);
    await expect(company).toContainText("Fernwood Studio Pvt Ltd");
    /* §8D.1: every outcome is stated in words, never by an icon alone.
       ⚠ The wording moved and the assertion follows it. This screen used to be in-memory and
       said so — "Changes live in this browser session only." — and it now writes through
       `PATCH /profile/fields/{id}`, so that sentence would be a lie and was removed. The toast
       is title-only, hence `[data-toast-title]`; `[data-toast-description]` does not exist on
       it any more. Scoped to the toast's own node rather than the raw text because Radix
       mirrors the copy into an off-screen announce region, so a bare `getByText` matches two
       nodes and fails strict mode. */
    await expect(page.locator("[data-toast-title]")).toContainText("Updated Company");
  });

  /**
   * ⚠ It is a **modal dialog** now, not a popover anchored to the trigger — the old panel
   * covered the group it was adding to. Dismissal is unchanged and still asserted here:
   * Escape closes it and focus returns to the trigger (E-50).
   */
  test("Add field opens a dialog, adds a row, and Escape restores focus (E-50)", async ({
    page,
  }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_custom");

    const trigger = page.locator('[data-add-field="group_custom"]');

    await trigger.click();
    await expect(page.locator('[data-add-field-form="group_custom"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-add-field-form="group_custom"]')).toHaveCount(0);
    // Dismissal is identical to a dialog's; only the modality differs.
    await expect(trigger).toBeFocused();

    await trigger.click();
    const form = page.locator('[data-add-field-form="group_custom"]');
    await form.getByLabel("Field name").fill("Studio motto");
    await form.getByLabel("Value").fill("Make the thing, then make it plain");

    /* ⚠ The POST is what is asserted, not the row that briefly appears.
       `profile-client.tsx`'s `mutate` calls `reload()` after every write, and the e2e stub does
       not persist a created field — so the optimistic `field_local_*` row is removed again the
       moment the refetch lands. Asserting it is a race that the assertion sometimes wins, which
       is worse than either outcome. What this test actually owns is the payload the dialog
       assembles, and that is deterministic. */
    const posted = page.waitForRequest(
      (request) =>
        request.method() === "POST" && request.url().includes("/profile/fields"),
    );

    /* ⚠ Scoped to the dialog, not the form. The submit control sits in the dialog's footer —
       the house action row beneath a hairline — and is bound to the form by `form="…"`, so it
       is a sibling of `[data-add-field-form]` rather than a descendant. Scoping to `page`
       instead would match the trigger, which carries the same name. */
    await submitAddField(page);

    expect(JSON.parse((await posted).postData() ?? "{}")).toMatchObject({
      type: "TEXT",
      label: "Studio motto",
      value: "Make the thing, then make it plain",
    });
    await expect(form).toHaveCount(0);
  });

  /**
   * ⚠ **The name is derived from the kind, and the derived name is what gets saved.**
   *
   * This is the change the redesign turns on: for the nineteen kinds that name themselves, the
   * owner picks **Email** and types an address — they are never asked "field name" and "value"
   * as two peer questions with no stated difference, which is what made the old popover
   * confusing. If the derivation ever silently stops feeding `label`, this fails and the old
   * two-box form is the only way back.
   */
  test("choosing a kind names the field, so only the value is typed", async ({ page }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_custom");

    await page.locator('[data-add-field="group_custom"]').click();
    const form = page.locator('[data-add-field-form="group_custom"]');

    await form.locator('[data-field-type="EMAIL"]').click();

    // No "Field name" box at all for a kind that names itself — the whole point.
    await expect(form.getByLabel("Field name")).toHaveCount(0);
    await expect(form.locator("[data-derived-name]")).toHaveAttribute(
      "data-derived-name",
      "Email",
    );

    // The value box is labelled by the kind, and carries that kind's own example.
    const value = form.getByLabel("Email");
    await expect(value).toHaveAttribute("placeholder", "you@example.com");
    await value.fill("ada@example.com");

    const posted = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().includes("/profile/fields"),
    );
    await submitAddField(page);

    expect(JSON.parse((await posted).postData() ?? "{}")).toMatchObject({
      type: "EMAIL",
      label: "Email",
      value: "ada@example.com",
    });
  });

  /** Rename is the escape hatch for the derived name, and it must reach the wire. */
  test("Rename overrides the derived name", async ({ page }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_custom");

    await page.locator('[data-add-field="group_custom"]').click();
    const form = page.locator('[data-add-field-form="group_custom"]');

    await form.locator('[data-field-type="EMAIL"]').click();
    await form.locator("[data-field-rename]").click();

    // Seeded with the derived name, so Rename is an edit rather than a blank box.
    const name = form.getByLabel("Field name");
    await expect(name).toHaveValue("Email");
    await name.fill("Studio inbox");
    await form.getByLabel("Email").fill("studio@example.com");

    const posted = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().includes("/profile/fields"),
    );
    await submitAddField(page);

    expect(JSON.parse((await posted).postData() ?? "{}")).toMatchObject({
      type: "EMAIL",
      label: "Studio inbox",
      value: "studio@example.com",
    });
  });

  /**
   * ⚠ `PHOTO` must not be offered. `POST /profile/fields` rejects it outright — the old picker
   * listed it, so choosing it was a guaranteed round trip to a server error.
   */
  test("Photo is not offered as a field kind", async ({ page }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_custom");

    await page.locator('[data-add-field="group_custom"]').click();
    const form = page.locator('[data-add-field-form="group_custom"]');

    await form.locator("[data-field-type-more]").click();
    await expect(form.locator('[data-field-type="PHOTO"]')).toHaveCount(0);
    // And the reader is told where a picture actually comes from.
    await expect(form).toContainText("avatar at the top of your profile");
  });

  test("a field with no name is refused rather than added", async ({ page }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_custom");

    await page.locator('[data-add-field="group_custom"]').click();
    const form = page.locator('[data-add-field-form="group_custom"]');
    await form.getByLabel("Value").fill("orphaned");
    await submitAddField(page);

    await expect(form).toBeVisible();
    await expect(form.getByRole("alert")).toContainText("Give the field a name");
    await expect(page.locator('[data-profile-field="field_local_1"]')).toHaveCount(0);
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

  test("nothing is persisted — a reload restores the fixture profile (§5.7)", async ({
    page,
  }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_custom");

    await page.locator('[data-add-field="group_custom"]').click();
    const form = page.locator('[data-add-field-form="group_custom"]');
    await form.getByLabel("Field name").fill("Temporary");
    await form.getByLabel("Value").fill("gone on reload");
    await submitAddField(page);
    await expect(page.locator('[data-profile-field="field_local_1"]')).toHaveCount(1);

    await gotoProfile(page);
    await expandGroup(page, "group_custom");
    await expect(page.locator('[data-profile-field="field_local_1"]')).toHaveCount(0);
  });
});

/* ── §11 E-41 ───────────────────────────────────────────────────────────────────────── */

test.describe("E-41 — deleting a field states how many cards use it, first", () => {
  test("the confirm dialog carries a card count before anything is deleted", async ({
    page,
  }) => {
    await gotoGroup(page, "group_financial");

    await row(page, BANK_FIELD).locator(`[data-field-delete="${BANK_FIELD}"]`).click();

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
    await expect(row(page, BANK_FIELD)).toHaveCount(1);
  });

  test("confirming removes the row and reports what stopped showing it", async ({ page }) => {
    await gotoGroup(page, "group_financial");

    await row(page, BANK_FIELD).locator(`[data-field-delete="${BANK_FIELD}"]`).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete field" }).click();

    await expect(row(page, BANK_FIELD)).toHaveCount(0);
    /* Scoped to the toast's own description, for the same reason as the edit test above: Radix
       mirrors toast copy into an off-screen announce region for screen readers, so a bare
       `getByText` matches two nodes — the visible one and the announcement — and `toBeVisible`
       then resolves against whichever it picked. */
    await expect(page.locator("[data-toast-description]")).toContainText("stopped showing it");
  });

  test("delete lives on the group editor, not on the overview (§8D.3)", async ({ page }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_financial");
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

/* ── the collapsible sections (§8D.3) ───────────────────────────────────────────────── */

test.describe("the group sections", () => {
  test("every group renders with a count and a working disclosure", async ({ page }) => {
    await gotoProfile(page);

    await expect(page.locator("[data-field-group-section]")).toHaveCount(SEVEN_GROUPS);

    const toggle = page.locator('[data-group-toggle="group_social"]');
    const expandedBefore = await toggle.getAttribute("aria-expanded");

    await toggle.click();
    await expect(toggle).toHaveAttribute(
      "aria-expanded",
      expandedBefore === "true" ? "false" : "true",
    );

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", expandedBefore ?? "true");
  });

  test("collapsed sections hide their rows from everyone, not just visually", async ({
    page,
  }) => {
    await gotoProfile(page);

    const toggle = page.locator('[data-group-toggle="group_social"]');
    if ((await toggle.getAttribute("aria-expanded")) === "true") {
      await toggle.click();
    }
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(row(page, "field_linkedin")).toBeHidden();
  });
});
