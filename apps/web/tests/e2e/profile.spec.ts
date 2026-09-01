import { expect, test, type Locator, type Page } from "@playwright/test";

import { gotoReady } from "../helpers/e2e";

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

/** `DATE`, `isSensitive: true` — a non-financial type masked purely by the owner's policy. */
const DOB_FIELD = "field_dob";
const DOB_RAW = "1991-03-08";

/** `PHONE`, not sensitive. The control case: never masked, always editable. */
const PHONE_FIELD = "field_mobile";

/** `CUSTOM`, not sensitive. Used to prove the policy → masking chain end to end. */
const PRONOUNS_FIELD = "field_pronouns";

const SEVEN_GROUPS = 7;

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

  test("the three financial types mask regardless of isSensitive", async ({ page }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_financial");

    // `field_upi` carries `isSensitive: false` and is masked anyway, because
    // `ALWAYS_MASKED_TYPES` can be added to by the owner's policy but never subtracted from.
    const upi = row(page, UPI_FIELD);
    await expect(upi).toHaveAttribute("data-field-masked", "");
    await expect(upi).not.toHaveAttribute("data-field-sensitive", "");
    expect(await markupOf(upi)).not.toContain(UPI_RAW);
  });

  test("a non-financial field masks purely because the owner marked it sensitive", async ({
    page,
  }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_identity");

    const dob = row(page, DOB_FIELD);
    await expect(dob).toHaveAttribute("data-field-sensitive", "");
    await expect(dob).toHaveAttribute("data-field-masked", "");
    expect(await markupOf(dob)).not.toContain(DOB_RAW);
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
    // `prya-pay` is the card that maps the bank account, the UPI handle and the wallet.
    await gotoReady(page, "/c/prya-pay");
    await expect(page.locator("[data-card-root]")).toHaveCount(1);

    // The whole point of the rule: `/c/[slug]` is unauthenticated by design.
    await expect(page.locator("[data-field-reveal]")).toHaveCount(0);
    expect(await markupOf(page.locator("[data-card-root]"))).not.toContain(BANK_RAW);
  });

  test("marking a field sensitive masks it, and a short value keeps no tail", async ({
    page,
  }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_custom");

    const pronouns = row(page, PRONOUNS_FIELD);
    await expect(pronouns).not.toHaveAttribute("data-field-masked", "");
    await expect(pronouns).toContainText("she/her");

    // The policy the owner writes down once, and every surface obeys.
    await pronouns.locator(`[data-sensitive-toggle="${PRONOUNS_FIELD}"]`).click();
    await expect(pronouns).toHaveAttribute("data-field-masked", "");
    await expect(pronouns).toHaveAttribute("data-field-sensitive", "");
    expect(await markupOf(pronouns)).not.toContain("she/her");

    // Reveal, shorten the value to four characters, then hide again: `maskTail` must show
    // `••••` with NO tail, so a short secret is never fully revealed by its own mask.
    await pronouns.locator(`[data-field-reveal="${PRONOUNS_FIELD}"]`).click();
    await pronouns.locator(`[data-field-edit="${PRONOUNS_FIELD}"]`).click();

    const form = page.locator(`[data-field-edit-form="${PRONOUNS_FIELD}"]`);
    await form.getByLabel("Value").fill("1234");
    await form.getByRole("button", { name: "Save" }).click();

    await pronouns.locator(`[data-field-reveal="${PRONOUNS_FIELD}"]`).click();
    await expect(pronouns).toHaveAttribute("data-field-masked", "");
    await expect(pronouns.locator("[data-field-value]")).toHaveText("••••");
    expect(await markupOf(pronouns)).not.toContain("1234");
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
       Targets the toast's own description rather than the raw text: Radix mirrors toast copy
       into an off-screen announce region for screen readers, so a bare `getByText` matches two
       nodes and fails strict mode. */
    await expect(page.locator("[data-toast-description]")).toContainText(
      "Changes live in this browser session only.",
    );
  });

  test("Add field opens a popover, adds a row, and Escape restores focus (E-50)", async ({
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
    await form.getByRole("button", { name: "Add field" }).click();

    await expect(form).toHaveCount(0);
    const added = row(page, "field_local_1");
    await expect(added).toBeVisible();
    await expect(added).toContainText("Studio motto");
    await expect(added).toContainText("Make the thing, then make it plain");
  });

  test("a field with no name is refused rather than added", async ({ page }) => {
    await gotoProfile(page);
    await expandGroup(page, "group_custom");

    await page.locator('[data-add-field="group_custom"]').click();
    const form = page.locator('[data-add-field-form="group_custom"]');
    await form.getByLabel("Value").fill("orphaned");
    await form.getByRole("button", { name: "Add field" }).click();

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
    await form.getByRole("button", { name: "Add field" }).click();
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
