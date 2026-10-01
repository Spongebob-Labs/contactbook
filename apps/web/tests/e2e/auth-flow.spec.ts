import { expect, test, type Page } from "@playwright/test";

import { WELCOME_PATH } from "@/components/onboarding/welcome-steps";

import { PROJECT_VIEWPORT, gotoReady } from "../helpers/e2e";

/**
 * The `(auth)` flow, in a real browser — spec §8D.2, AC-28, §11 E-46 and E-47.
 *
 * What this suite is actually protecting:
 *  · **AC-28** — six screens, exactly one question each, a progress indicator on every one,
 *    a non-destructive Back on every one except step 1, and values that survive Back.
 *  · **E-46** — Back, both kinds: the control in the shell and the browser's own button.
 *  · **E-47** — a six-digit paste into the first OTP box.
 *  · **AC-26's auth clause** — the whole flow is walked with the keyboard and nothing else.
 *
 * Nothing here asserts that a code was sent or a session was created, because neither
 * happens: §7.1 says there is no auth in this run.
 */

const STEPS = [
  { index: 1, path: "/signin/phone", question: "What's your number?" },
  { index: 2, path: "/signin/otp", question: "Enter the code we sent" },
  { index: 3, path: "/signup/first-name", question: "What's your first name?" },
  { index: 4, path: "/signup/last-name", question: "And your last name?" },
  { index: 5, path: "/signup/email", question: "Where can we reach you?" },
  { index: 6, path: "/signup/done", question: "Your card is ready" },
] as const;

const PHONE = "9876543210";
const CODE = "123456";
const FIRST = "Priyanka";
const LAST = "Raghunathan";
const EMAIL = "priyanka@fernwood.example";

/** The step's own root, which only exists once the client step has hydrated. */
function stepForm(page: Page) {
  return page.locator("[data-auth-step-form]");
}

/**
 * The alerts **this product** renders, which is not the same set as the page's.
 *
 * Next's App Router appends its own route announcer to `document.body` on every route —
 * `<div id="__next-route-announcer__" role="alert" aria-live="assertive">`, from
 * `next/dist/client/components/app-router-announcer.js`. It is visually hidden but stays in
 * the accessibility tree, so it matches `getByRole("alert")` on every page in the app. An
 * unscoped alert locator is therefore a strict-mode violation wherever a real error is on
 * screen, and can never reach a count of zero where one is not.
 *
 * Scoping to the shell excludes that one framework node and nothing else: every surface
 * `(auth)` renders — the step form, the progress row, Back — is inside `[data-auth-shell]`,
 * so "no alert here" still means "no alert anywhere in this flow".
 */
function authAlert(page: Page) {
  return page.locator("[data-auth-shell]").getByRole("alert");
}

async function expectStep(page: Page, index: number) {
  await expect(stepForm(page)).toHaveAttribute("data-auth-step", String(index));
  await expect(page.locator("[data-auth-progress]")).toHaveAttribute(
    "data-auth-step",
    String(index),
  );
  await expect(page.locator("[data-auth-progress]")).toContainText(`STEP ${index} OF 6`);
}

/** Paste, as the browser delivers it — a real `paste` event carrying a `DataTransfer`. */
async function pasteInto(page: Page, selector: string, text: string) {
  await page.locator(selector).evaluate((node, value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    node.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, text);
}

test.describe("the six screens", () => {
  for (const step of STEPS) {
    test(`${step.path} asks exactly one question, with a progress indicator`, async ({
      page,
    }) => {
      await gotoReady(page, step.path);

      // AC-28: ONE question. One `<h1>`, one `[data-auth-question]`, one primary action.
      await expect(page.locator("[data-auth-question]")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("[data-auth-question]")).toContainText(step.question);
      await expect(page.locator("[data-auth-primary]")).toHaveCount(1);

      await expectStep(page, step.index);
      await expect(page.locator("[data-auth-progress] [data-auth-segment]")).toHaveCount(6);

      // Back on every screen except step 1, and never anywhere else.
      await expect(page.locator("[data-auth-back]")).toHaveCount(step.index === 1 ? 0 : 1);
    });
  }

  test("step 1 offers no Back and step 2 does", async ({ page }) => {
    await gotoReady(page, "/signin/phone");
    await expect(page.locator("[data-auth-back]")).toHaveCount(0);

    await gotoReady(page, "/signin/otp");
    const back = page.locator("[data-auth-back]");
    await expect(back).toHaveCount(1);
    await expect(back).toHaveAttribute("href", "/signin/phone");
  });

  test("the live card panel appears only from 1280px", async ({ page }, testInfo) => {
    await gotoReady(page, "/signin/phone");
    const width = PROJECT_VIEWPORT[testInfo.project.name];
    const showcase = page.locator("[data-auth-showcase]");

    if (width >= 1280) {
      await expect(showcase).toBeVisible();
      // §8D.2: the product, live — not a picture of it.
      await expect(showcase.locator("[data-card-thumb]")).toHaveCount(1);
    } else {
      await expect(showcase).toBeHidden();
    }
  });
});

test.describe("the walk", () => {
  test("phone → otp → first → last → email → done, keyboard only", async ({ page }) => {
    await gotoReady(page, "/signin/phone");

    // 1 — phone. §8D.2: the first field is focused on mount, on every screen.
    const phone = page.getByLabel("Phone number");
    await expect(phone).toBeFocused();
    await page.keyboard.type(PHONE);
    await page.keyboard.press("Enter"); // Enter submits — no mouse, ever.

    // 2 — otp.
    await expect(page).toHaveURL(/\/signin\/otp$/);
    await expectStep(page, 2);
    await expect(page.getByLabel("Digit 1 of 6")).toBeFocused();
    await page.keyboard.type(CODE);
    await expect(page.getByLabel("Digit 6 of 6")).toHaveValue("6");
    await page.keyboard.press("Enter");

    // 3 — first name.
    await expect(page).toHaveURL(/\/signup\/first-name$/);
    await expectStep(page, 3);
    const first = page.getByLabel("First name");
    await expect(first).toBeFocused();
    await page.keyboard.type(FIRST);
    await page.keyboard.press("Enter");

    // 4 — last name. The helper proves the previous answer survived the navigation.
    await expect(page).toHaveURL(/\/signup\/last-name$/);
    await expectStep(page, 4);
    await expect(stepForm(page)).toContainText(FIRST);
    const last = page.getByLabel("Last name");
    await expect(last).toBeFocused();
    await page.keyboard.type(LAST);
    await page.keyboard.press("Enter");

    // 5 — email.
    await expect(page).toHaveURL(/\/signup\/email$/);
    await expectStep(page, 5);
    const email = page.getByLabel("Email address");
    await expect(email).toBeFocused();
    await page.keyboard.type(EMAIL);
    await page.keyboard.press("Enter");

    // 6 — done, personalised from the name given three screens ago. It hands off to the
    // card walkthrough, not the dashboard (client feedback 2026-09-28).
    await expect(page).toHaveURL(/\/signup\/done$/);
    await expectStep(page, 6);
    await expect(page.locator("[data-auth-question]")).toContainText(FIRST);
    await expect(page.locator("[data-auth-primary]")).toHaveText("Set up my card");
    await expect(page.locator("[data-auth-primary]")).toHaveAttribute("href", WELCOME_PATH);
    // The fixture card is gone from this step: it was somebody else's card captioned "your
    // starter card". The owner's real card is the next screen.
    await expect(page.locator("[data-auth-card]")).toHaveCount(0);
  });

  test("a bad answer never advances the flow, and says what to fix", async ({ page }) => {
    await gotoReady(page, "/signin/phone");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/signin\/phone$/);
    const alert = authAlert(page);
    await expect(alert).toContainText("Enter your phone number.");
    // §8D.2: announced via role="alert" AND referenced by aria-describedby.
    const describedBy = await page.getByLabel("Phone number").getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(await alert.getAttribute("id")).toBe(describedBy);

    // Too short is a different sentence from "digits only" — the field filters letters out,
    // so length is what a person can actually get wrong by typing.
    await page.keyboard.type("12345");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/signin\/phone$/);
    await expect(authAlert(page)).toContainText("6 to 15 digits");
  });
});

test.describe("E-46 — Back is never destructive", () => {
  test("the Back control returns the previous answer intact", async ({ page }) => {
    await gotoReady(page, "/signin/phone");
    await page.getByLabel("Phone number").fill(PHONE);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/signin\/otp$/);

    // Keyboard-only Back: Shift+Tab out of the first OTP box lands on the Back link.
    await expect(page.getByLabel("Digit 1 of 6")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator("[data-auth-back]")).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/signin\/phone$/);
    await expect(page.getByLabel("Phone number")).toHaveValue(PHONE);
  });

  test("the browser's own Back button preserves the answer too", async ({ page }) => {
    await gotoReady(page, "/signin/phone");
    await page.getByLabel("Phone number").fill(PHONE);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/signin\/otp$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/signin\/phone$/);
    await expect(page.getByLabel("Phone number")).toHaveValue(PHONE);
  });

  test("two steps back, then forward again, keeps both answers", async ({ page }) => {
    await gotoReady(page, "/signin/phone");
    await page.getByLabel("Phone number").fill(PHONE);
    await page.keyboard.press("Enter");

    await expect(page.getByLabel("Digit 1 of 6")).toBeFocused();
    await page.keyboard.type(CODE);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/signup\/first-name$/);
    await page.getByLabel("First name").fill(FIRST);

    // Back to the OTP screen: its six boxes still hold the code.
    await page.locator("[data-auth-back]").click();
    await expect(page).toHaveURL(/\/signin\/otp$/);
    for (let index = 0; index < 6; index += 1) {
      await expect(page.getByLabel(`Digit ${index + 1} of 6`)).toHaveValue(CODE[index]);
    }

    // And forward again: the half-finished name is where it was left.
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/signup\/first-name$/);
    await expect(page.getByLabel("First name")).toHaveValue(FIRST);
  });

  test("'Skip for now' leaves the typed email alone", async ({ page }) => {
    await gotoReady(page, "/signup/email");
    await page.getByLabel("Email address").fill("half@typ");
    await page.locator("[data-auth-secondary]").click();

    await expect(page).toHaveURL(/\/signup\/done$/);
    await page.locator("[data-auth-back]").click();
    await expect(page.getByLabel("Email address")).toHaveValue("half@typ");
  });
});

test.describe("E-47 — the OTP boxes", () => {
  test("a six-digit paste into box 1 fills all six and focuses the last", async ({ page }) => {
    await gotoReady(page, "/signin/otp");
    await expect(page.getByLabel("Digit 1 of 6")).toBeFocused();

    await pasteInto(page, '[data-otp-box="0"]', CODE);

    for (let index = 0; index < 6; index += 1) {
      await expect(page.locator(`[data-otp-box="${index}"]`)).toHaveValue(CODE[index]);
    }
    await expect(page.locator('[data-otp-box="5"]')).toBeFocused();
  });

  test("a pasted code with punctuation in it still lands as six digits", async ({ page }) => {
    await gotoReady(page, "/signin/otp");
    await pasteInto(page, '[data-otp-box="0"]', "12-34 56");

    for (let index = 0; index < 6; index += 1) {
      await expect(page.locator(`[data-otp-box="${index}"]`)).toHaveValue(CODE[index]);
    }
  });

  test("typing advances, backspace retreats and clears", async ({ page }) => {
    await gotoReady(page, "/signin/otp");
    await expect(page.locator('[data-otp-box="0"]')).toBeFocused();

    await page.keyboard.type("12");
    await expect(page.locator('[data-otp-box="2"]')).toBeFocused();

    // Backspace in an empty box clears the one before it and lands there.
    await page.keyboard.press("Backspace");
    await expect(page.locator('[data-otp-box="1"]')).toBeFocused();
    await expect(page.locator('[data-otp-box="1"]')).toHaveValue("");
    await expect(page.locator('[data-otp-box="0"]')).toHaveValue("1");

    // Arrow keys move between boxes without changing anything.
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator('[data-otp-box="0"]')).toBeFocused();
    await expect(page.locator('[data-otp-box="0"]')).toHaveValue("1");
  });

  test("clearing a middle box does not shift the digits after it", async ({ page }) => {
    await gotoReady(page, "/signin/otp");
    await pasteInto(page, '[data-otp-box="0"]', CODE);

    await page.locator('[data-otp-box="2"]').click();
    await page.keyboard.press("Backspace");

    await expect(page.locator('[data-otp-box="2"]')).toHaveValue("");
    await expect(page.locator('[data-otp-box="3"]')).toHaveValue("4");
    await expect(page.locator('[data-otp-box="5"]')).toHaveValue("6");
  });

  test("a five-digit code is refused, with the count in the message", async ({ page }) => {
    await gotoReady(page, "/signin/otp");
    await page.keyboard.type("12345");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/signin\/otp$/);
    await expect(authAlert(page)).toContainText("Enter the 6-digit code.");
  });

  test("letters never reach the boxes", async ({ page }) => {
    await gotoReady(page, "/signin/otp");
    await page.keyboard.type("ab");
    await expect(page.locator('[data-otp-box="0"]')).toHaveValue("");
    await expect(page.locator('[data-otp-box="0"]')).toBeFocused();
  });
});

test.describe("the declared states, reachable by URL (§6.1, §6.3)", () => {
  test("?state=error shows the OTP mismatch message", async ({ page }) => {
    await gotoReady(page, "/signin/otp?state=error");
    await expect(stepForm(page)).toHaveAttribute("data-screen-state", "error");
    await expect(authAlert(page)).toContainText("That code didn't match");
  });

  test("?state=loading shows the verify button busy", async ({ page }) => {
    await gotoReady(page, "/signin/otp?state=loading");
    await expect(stepForm(page)).toHaveAttribute("data-screen-state", "loading");
    await expect(page.locator("[data-auth-primary]")).toHaveAttribute("aria-busy", "true");
  });

  test("?state=error on a name screen shows that screen's own message", async ({ page }) => {
    await gotoReady(page, "/signup/last-name?state=error");
    await expect(authAlert(page)).toContainText("Enter your last name.");
  });

  test("E-34: an unrecognised ?state= falls back to success and never blanks the page", async ({
    page,
  }) => {
    await gotoReady(page, "/signin/phone?state=banana");
    await expect(stepForm(page)).toHaveAttribute("data-screen-state", "success");
    await expect(page.locator("[data-auth-question]")).toContainText("What's your number?");
    await expect(authAlert(page)).toHaveCount(0);
  });
});

test.describe("the country code", () => {
  /**
   * Keyboard the whole way, because that is what the name promises and because a mouse
   * cannot check the part that actually matters: a listbox must hand focus *back* to its
   * trigger when it closes. Radix restores that focus asynchronously, a frame or more after
   * the menu is gone, so anything that moves focus before the restore lands gets it stolen
   * back — which is exactly what a `click()` here used to hide (§8D.2, AC-26).
   */
  test("defaults to India and can be changed with the keyboard", async ({ page }) => {
    await gotoReady(page, "/signin/phone");
    const trigger = page.getByLabel("Country code");
    const phone = page.getByLabel("Phone number");

    // §10.3: the fixture user's number is +91, so the picker opens on India.
    await expect(phone).toBeFocused();
    await expect(trigger).toContainText("India +91");

    // Back one stop to the picker, open it, and pick by typeahead — `s` is the first S in
    // an alphabetical list that also holds South Africa.
    await page.keyboard.press("Shift+Tab");
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    const singapore = page.getByRole("option", { name: "Singapore +65" });
    await expect(singapore).toBeVisible();
    await page.keyboard.press("s");
    await expect(page.locator('[role="option"][data-highlighted]')).toHaveText(
      "Singapore +65",
    );
    await page.keyboard.press("Enter");

    await expect(trigger).toContainText("Singapore +65");
    // Closing returns focus to the trigger, so Tab lands on the number and stays there.
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(phone).toBeFocused();

    // The chosen code follows the answer to the next screen.
    await page.keyboard.type(PHONE);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/signin\/otp$/);
    await expect(stepForm(page)).toContainText(`+65 ${PHONE}`);
  });
});
