import { expect, test, type Page } from "@playwright/test";

import { gotoReady } from "../helpers/e2e";

/**
 * `/c/[slug]` — the QR-scan **"Save & connect"** flow (`contactbook-qr-scan-connect`).
 *
 * A stranger scans a card, reads it, and taps a third action to become a real recipient the
 * owner can notify later. Two endpoints, both anonymous and both absent from `/api/docs`:
 * `POST /public/links/{token}/connect/otp/{request,verify}`.
 *
 * ## Why this is a separate file from `public-card.spec.ts`
 * That file owns the five *rendering* contracts of the page — action count, masking, the
 * zero-field card, the unknown slug, the missing `PHONE`. This one owns a **state machine
 * with network in the middle**, which is a different kind of test: it types, it waits on a
 * POST, and it asserts on what came back. Keeping them apart also keeps this from colliding
 * with the in-flight edits to that file.
 *
 * ## The token vocabulary is the stub's, not the fixtures'
 * Every navigation here uses `/c/n{count}`, which is what `tests/stubs/public-card-api.mjs`
 * actually serves. ⚠ `public-card.spec.ts` still addresses `/c/prya-*` slugs that the stub
 * answers with `SHARE_LINK_NOT_FOUND` — a pre-existing mismatch, not something this file
 * introduced or works around.
 *
 * ## What the stub lets a test reach
 * The outcome rides on the **code typed**, so every failure is reachable from a page that
 * rendered: `424242` connects, `000000` is wrong-but-retryable, `111111` is spent, `222222`
 * has expired, `333333` is the owner's own number. On the request step it rides on the
 * **phone**: a national number ending `99` returns `OTP_COOLDOWN` with a 42-second
 * `retryAfterSeconds`, and one ending `98` returns `OTP_RATE_LIMITED`. See the stub's own
 * header for the full table.
 */

/** Five fields, so the card renders a `.vcf`-able body and the action tier is present. */
const CARD = "/c/n5";

const flow = (page: Page) => page.locator("[data-connect-flow]");
const message = (page: Page) => page.locator("[data-connect-message]");

/** Open the flow and get as far as the code step, using a number the stub is happy with. */
async function reachCodeStep(page: Page, national = "9820115577"): Promise<void> {
  await gotoReady(page, CARD);
  await page.locator('[data-card-action="connect"]').click();
  await expect(flow(page)).toHaveAttribute("data-connect-stage", "phone");
  await page.getByLabel("Your phone number").fill(national);
  await page.locator('[data-card-action="connect-send-code"]').click();
}

test("the connect action is present alongside save and WhatsApp, and starts idle", async ({
  page,
}) => {
  await gotoReady(page, CARD);

  await expect(flow(page)).toHaveAttribute("data-connect-stage", "idle");
  await expect(page.locator('[data-card-action="connect"]')).toHaveCount(1);
  // Third position: saving is what the reader came to do, connecting is the offer.
  await expect(page.locator('[data-card-action="save"]')).toHaveCount(1);

  // Nothing has been requested yet — this is a tap, never an effect on page load.
  await expect(page.locator('[data-card-action="connect-send-code"]')).toHaveCount(0);
});

test("a bad number is refused client-side, without a request", async ({ page }) => {
  await gotoReady(page, CARD);
  await page.locator('[data-card-action="connect"]').click();

  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/connect/otp/")) requests.push(request.url());
  });

  await page.getByLabel("Your phone number").fill("123");
  await page.locator('[data-card-action="connect-send-code"]').click();

  await expect(message(page)).toContainText("6 to 15 digits");
  // Still on the phone step, and the API was never troubled.
  await expect(flow(page)).toHaveAttribute("data-connect-stage", "phone");
  expect(requests).toEqual([]);
});

test("the happy path ends on a confirmation, on the same page, with no re-fetch", async ({
  page,
}) => {
  await reachCodeStep(page);

  await expect(flow(page)).toHaveAttribute("data-connect-stage", "code");
  // The stub returns the code rather than sending it, exactly as staging does.
  await expect(page.locator("[data-connect-dev-code]")).toHaveAttribute(
    "data-connect-dev-code",
    "424242",
  );

  /* The card must not be re-resolved on success — the copy already on screen is still correct,
     and a second GET would be the "no re-fetch step" rule broken. Counted across the verify. */
  const resolves: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/public/links/") && !url.includes("/connect/")) resolves.push(url);
  });

  await page.getByLabel("6-digit code").fill("424242");
  await page.locator('[data-card-action="connect-verify"]').click();

  await expect(flow(page)).toHaveAttribute("data-connect-stage", "done");
  await expect(page.getByText("You're connected")).toBeVisible();
  // Not a login: nothing navigated.
  await expect(page).toHaveURL(new RegExp(`${CARD}$`));
  // The card is still there, underneath the confirmation.
  await expect(page.locator("[data-card-name]")).toHaveText("Priyanka Raghunathan");
  expect(resolves).toEqual([]);
});

test("a wrong code keeps the input live so the next attempt can succeed", async ({ page }) => {
  await reachCodeStep(page);

  await page.getByLabel("6-digit code").fill("000000");
  await page.locator('[data-card-action="connect-verify"]').click();

  await expect(message(page)).toContainText("That code didn't match");
  // Retryable, so the flow stays on the code step and the control stays usable.
  await expect(flow(page)).toHaveAttribute("data-connect-stage", "code");
  await expect(page.locator('[data-card-action="connect-verify"]')).toBeEnabled();

  // And the right code still works afterwards — the attempt was not terminal.
  await page.getByLabel("6-digit code").fill("424242");
  await page.locator('[data-card-action="connect-verify"]').click();
  await expect(flow(page)).toHaveAttribute("data-connect-stage", "done");
});

test("a spent code is dead, and says so instead of offering a retry that cannot work", async ({
  page,
}) => {
  await reachCodeStep(page);

  await page.getByLabel("6-digit code").fill("111111");
  await page.locator('[data-card-action="connect-verify"]').click();

  await expect(message(page)).toContainText("Too many wrong attempts");
  /* The distinction this test exists for: `OTP_ATTEMPTS_EXCEEDED` means even the correct
     digits are now rejected, so the verify control must not invite another try. */
  const verify = page.locator('[data-card-action="connect-verify"]');
  await expect(verify).toBeDisabled();
  await expect(verify).toHaveText("Ask for a new code");
});

test("an expired code is treated the same way, and clears the input", async ({ page }) => {
  await reachCodeStep(page);

  await page.getByLabel("6-digit code").fill("222222");
  await page.locator('[data-card-action="connect-verify"]').click();

  await expect(message(page)).toContainText("That code has expired");
  await expect(page.getByLabel("6-digit code")).toHaveValue("");
  await expect(page.locator('[data-card-action="connect-verify"]')).toBeDisabled();
});

test("the owner's own number is refused with its own sentence", async ({ page }) => {
  await reachCodeStep(page);

  await page.getByLabel("6-digit code").fill("333333");
  await page.locator('[data-card-action="connect-verify"]').click();

  await expect(message(page)).toContainText("That's your own card");
  // Not terminal for the flow — a different number is a real way forward.
  await expect(flow(page)).toHaveAttribute("data-connect-stage", "code");
});

test("the resend countdown comes from the server's retryAfterSeconds, not a local guess", async ({
  page,
}) => {
  // A national number ending `99` makes the stub answer `OTP_COOLDOWN` with 42 seconds.
  await reachCodeStep(page, "9820115599");

  await expect(message(page)).toContainText("Give it a moment");
  /* 42 is the server's number and appears nowhere in our source — a locally invented timer
     would read `60` here, which is what makes this assertion able to fail.

     Read off the flow root, not the resend control: this cooldown landed on the *first*
     request, so the flow is still on the phone step and no resend control exists yet. */
  await expect(flow(page)).toHaveAttribute("data-connect-stage", "phone");
  await expect(flow(page)).toHaveAttribute("data-connect-remaining", /^(41|42)$/);

  /* And the send control must not invite the identical failure while the clock runs. This is
     the assertion that would have caught the first cut of this component. */
  const send = page.locator('[data-card-action="connect-send-code"]');
  await expect(send).toBeDisabled();
  await expect(send).toContainText("Send code in");
});

test("a rate-limited number gets the hourly-cap sentence and no countdown", async ({ page }) => {
  await reachCodeStep(page, "9820115598");

  await expect(message(page)).toContainText("Too many codes requested");
  // `OTP_RATE_LIMITED` carries no retry hint, so there is nothing honest to count down from.
  await expect(flow(page)).toHaveAttribute("data-connect-stage", "phone");
});

test("a successful send starts the 60-second courtesy countdown", async ({ page }) => {
  await reachCodeStep(page);

  const resend = page.locator("[data-connect-resend]");
  await expect(resend).toBeDisabled();
  await expect(resend).toContainText("Resend code in");
  // The documented gap between requests. Only an initial value — the server can override it.
  await expect(resend).toHaveAttribute("data-resend-remaining", /^(59|60)$/);
});
