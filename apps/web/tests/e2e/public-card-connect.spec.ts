import { expect, test, type Page } from "@playwright/test";

import { gotoReady } from "../helpers/e2e";

/**
 * `/c/[slug]` — the QR-scan **"Send to my phone"** flow (`contactbook-qr-scan-connect`).
 *
 * A stranger scans a card, types their number, and the card goes to it over WhatsApp — one
 * anonymous request, `POST /public/links/{token}/connect/send`, absent from `/api/docs`. No code
 * and no proof the number is theirs: product chose that trade on 2026-09-23, replacing the
 * OTP-verified "Save & connect" (`ConnectFlow`). That flow is still in the codebase, unwired; the
 * tests that covered it are in this file's git history, and belong back here if it is restored.
 *
 * ## Why this is a separate file from `public-card.spec.ts`
 * That file owns the page's *rendering* contracts — action count, masking, the zero-field card,
 * the unknown slug. This one owns a small state machine with a request in the middle: it types,
 * waits on a POST, and asserts on what came back.
 *
 * ## What the stub lets a test reach
 * Every navigation uses `/c/n{count}`, the vocabulary `tests/stubs/api.mjs` serves. The outcome
 * rides on the **phone**: a national number ending `97` is the owner's own
 * (`CANNOT_CONNECT_TO_SELF`), `96` means the owner turned the card off mid-flow
 * (`SHARE_LINK_REVOKED`), anything else connects.
 */

/** Five fields, so the card renders a `.vcf`-able body and the action tier is present. */
const CARD = "/c/n5";

const flow = (page: Page) => page.locator("[data-connect-flow]");
const message = (page: Page) => page.locator("[data-connect-message]");
const sendButton = (page: Page) => page.locator('[data-card-action="connect-send"]');

/** Open the flow to its one input and submit `national`. */
async function sendTo(page: Page, national: string): Promise<void> {
  await gotoReady(page, CARD);
  await page.locator('[data-card-action="connect"]').click();
  await expect(flow(page)).toHaveAttribute("data-connect-stage", "phone");
  await page.getByLabel("Your phone number").fill(national);
  await sendButton(page).click();
}

test("the send action is present alongside save, starts idle, and is the only connect path", async ({
  page,
}) => {
  await gotoReady(page, CARD);

  await expect(flow(page)).toHaveAttribute("data-connect-stage", "idle");
  /* Exactly one connect flow on the page, and it is this one. Offering the OTP path beside it
     would let one number fail on one and succeed on the other in the same session. */
  await expect(flow(page)).toHaveCount(1);
  await expect(flow(page)).toHaveAttribute("data-connect-mode", "send");

  const trigger = page.locator('[data-card-action="connect"]');
  await expect(trigger).toHaveCount(1);
  await expect(trigger).toHaveText(/Send to my phone/);
  await expect(page.locator('[data-card-action="save"]')).toHaveCount(1);

  // A tap, never an effect on page load: nothing is on screen to send with yet.
  await expect(sendButton(page)).toHaveCount(0);
});

test("the phone step says nothing is checked, and offers no code step at all", async ({
  page,
}) => {
  await gotoReady(page, CARD);
  await page.locator('[data-card-action="connect"]').click();

  /* The copy must not imply a verification that does not happen — the only safeguard against a
     typo on this path is the person typing, so it asks them to check. */
  await expect(flow(page)).toContainText("make sure it's yours");
  await expect(flow(page)).toContainText("No account, no code");
  await expect(page.getByLabel("6-digit code")).toHaveCount(0);
  await expect(page.locator("[data-connect-resend]")).toHaveCount(0);
});

test("a bad number is refused client-side, without a request", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/connect/")) requests.push(request.url());
  });

  await sendTo(page, "123");

  await expect(message(page)).toContainText("6 to 15 digits");
  await expect(flow(page)).toHaveAttribute("data-connect-stage", "phone");
  expect(requests).toEqual([]);
});

test("the happy path is one request, ends on the same page, and re-fetches nothing", async ({
  page,
}) => {
  const sends: Array<{ url: string; body: unknown }> = [];
  const resolves: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/connect/")) {
      sends.push({ url, body: JSON.parse(request.postData() ?? "{}") as unknown });
    } else if (url.includes("/public/links/")) {
      resolves.push(url);
    }
  });

  await sendTo(page, "9820115577");

  await expect(flow(page)).toHaveAttribute("data-connect-stage", "done");

  /* One POST to `/connect/send` carrying the E.164 number — and nothing to `/otp/`. The
     assertion that this really is the zero-verification path and not the old two-step flow. */
  expect(sends).toHaveLength(1);
  expect(sends[0].url).toMatch(/\/public\/links\/n5\/connect\/send$/);
  expect(sends[0].body).toEqual({ phoneE164: "+919820115577" });

  /* "Sending", never "sent" — delivery goes through the outbox, so this page cannot promise it.
     The stub's card carries no owner name, so this is also the nameless copy. */
  await expect(flow(page)).toContainText("We're sending this card to your WhatsApp");
  // The number is repeated back: on an unverified path this is where a typo gets noticed.
  await expect(flow(page)).toContainText("+919820115577");
  await expect(flow(page)).not.toContainText(/verif|confirmed/i);

  // Not a login: nothing navigated, the card is still underneath, and it was not re-resolved.
  await expect(page).toHaveURL(new RegExp(`${CARD}$`));
  /* One hook per rendered row. Not `[data-card-fields] > li`: since the redesign that element
     wraps sections rather than being the list itself, so a child selector finds nothing. */
  await expect(page.locator("[data-card-field]")).toHaveCount(5);
  expect(resolves).toEqual([]);
});

test("the owner's own number is refused with its own sentence, and the input stays live", async ({
  page,
}) => {
  await sendTo(page, "9820115597");

  await expect(message(page)).toContainText("That's your own card");
  // Not terminal: a different number is a real way forward.
  await expect(flow(page)).toHaveAttribute("data-connect-stage", "phone");
  await expect(page.getByLabel("Your phone number")).toBeEnabled();
  await expect(sendButton(page)).toBeEnabled();
});

test("a card turned off mid-flow ends the flow instead of inviting another try", async ({
  page,
}) => {
  await sendTo(page, "9820115596");

  await expect(flow(page)).toHaveAttribute("data-connect-stage", "dead");
  await expect(flow(page)).toContainText("This card is no longer available");
  // No input left to retry with — no number would work now.
  await expect(sendButton(page)).toHaveCount(0);
});
