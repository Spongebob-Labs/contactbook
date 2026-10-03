import { expect, test, type Page, type Request } from "@playwright/test";

import { gotoReady } from "../helpers/e2e";
import { signIn } from "../helpers/session";

/**
 * **Send update** on `/profile` — the button at the right end of the Fields / Design / Share row.
 *
 * The stub's `audience` always answers "nobody holds this card", so this spec answers it itself
 * (`page.route` on the proxy path the browser actually calls) and flips the answer when a field
 * write is seen — which is what the real API now does, because a profile edit bumps the card's
 * version (see `ProfileService.update`).
 *
 * ⚠ `gotoReady` kills CSS animations (`ANIMATION_KILL_CSS`), so the jitter itself cannot be seen
 * here. What is asserted is the thing that *drives* it: `data-nudge` appearing on the button when
 * a change lands. The keyframes are covered by their placement in `globals.css`.
 */

test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

const FIRST_CARD = "card_minimal_demo";

interface Recipient {
  shareLinkId: string;
  contactId: string;
  contactDisplayName: string;
  contactPhoneE164: string;
  versionsBehind: number;
  lastNotifiedVersion: number | null;
}

const recipient = (id: string, name: string, behind: number): Recipient => ({
  shareLinkId: id,
  contactId: `contact-${id}`,
  contactDisplayName: name,
  contactPhoneE164: "+919999900000",
  versionsBehind: behind,
  lastNotifiedVersion: behind === 0 ? 2 : 1,
});

/** Answers `GET /cards/:id/audience` from a mutable list the test controls. */
async function serveAudience(page: Page, current: { recipients: Recipient[] }): Promise<void> {
  await page.route("**/api/cb/cards/*/audience", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ currentVersion: 3, recipients: current.recipients }),
    });
  });
}

async function gotoProfile(page: Page): Promise<void> {
  await gotoReady(page, "/profile");
  await expect(page.locator("[data-screen-state]")).toHaveCount(1);
}

const slot = (page: Page) => page.locator("[data-send-update]");

test.describe("Send update", () => {
  test("is there for a card nobody holds, disabled and saying so", async ({ page }) => {
    await serveAudience(page, { recipients: [] });
    await gotoProfile(page);
    await expect(slot(page)).toHaveAttribute("data-send-update-state", "empty");
    await expect(slot(page)).toHaveText("All up to date");
    await expect(slot(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("says 'All up to date' when everyone has been told", async ({ page }) => {
    await serveAudience(page, { recipients: [recipient("l1", "Aayush", 0)] });
    await gotoProfile(page);
    await expect(slot(page)).toHaveAttribute("data-send-update-state", "idle");
    await expect(slot(page)).toHaveText("All up to date");
    await page.screenshot({ path: "test-results/send-update-idle.png" });
  });

  test("a field edit lights it up and jitters it; pressing it picks who to tell", async ({ page }) => {
    const audience = { recipients: [recipient("l1", "Aayush", 0), recipient("l2", "Andrew", 0)] };
    await serveAudience(page, audience);

    /* The moment the field write is seen, the "server" starts reporting both as behind. */
    page.on("request", (request) => {
      if (request.method() === "PATCH" && request.url().includes("/profile/fields/")) {
        audience.recipients = [recipient("l1", "Aayush", 1), recipient("l2", "Andrew", 1)];
      }
    });

    await gotoProfile(page);
    await expect(slot(page)).toHaveAttribute("data-send-update-state", "idle");
    const sameButton = await slot(page).elementHandle();
    /* Quiet on arrival: no jitter before anything has changed. */
    await expect(slot(page)).not.toHaveAttribute("data-nudge", /.+/);

    /* Edit a field the way an owner does: press the row, type, Enter. */
    const company = page.locator('[data-workspace-row="field_company"]');
    await company.locator("[data-workspace-row-open]").click();
    const input = company.locator("[data-workspace-row-input]");
    await input.fill("Fernwood Studio Pvt Ltd");
    await input.press("Enter");

    const button = page.getByRole("button", { name: /send update: 1 change not yet shared with 2 people/i });
    await expect(button).toBeVisible();
    /* The badge counts unshared changes (one edit = 1), not the two people. */
    await expect(button.locator("[data-send-update-count]")).toHaveText("1");
    /* It was never added or removed — the very element that said "All up to date" now says Send update. */
    expect(await button.evaluate((node, before) => node === before, sameButton)).toBe(true);
    /* The jitter is driven by this attribute, set because the change landed while on screen. */
    await expect(button).toHaveAttribute("data-nudge", /^[ab]$/);
    /* Nothing opened by itself. */
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.screenshot({ path: "test-results/send-update-behind.png" });

    /* Pressing it opens the picker; both are ticked because both are behind. */
    await button.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("checkbox")).toHaveCount(2);
    await page.screenshot({ path: "test-results/send-update-dialog.png" });

    /* The owner tells only one of them. */
    await dialog.locator('[data-notify-row="l2"] [role="checkbox"]').click();
    const notified = page.waitForRequest(
      (request: Request) =>
        request.method() === "POST" && new RegExp(`/cards/[^/]+/notify$`).test(new URL(request.url()).pathname),
    );
    await dialog.getByRole("button", { name: /send 1 update/i }).click();
    expect(JSON.parse((await notified).postData() ?? "{}")).toEqual({ shareLinkIds: ["l1"] });

    /* Held out of the count while the send is in flight. */
    await expect(slot(page)).toBeVisible();
  });

  test("scrolls away with the page instead of pinning itself over the fields", async ({ page }) => {
    await serveAudience(page, { recipients: [recipient("l1", "Aayush", 1)] });
    await gotoProfile(page);
    const toolbar = page.locator("[data-workspace-toolbar]");
    await expect(toolbar).toHaveCSS("position", "static");
  });

  test("stays on every panel, not only Fields", async ({ page }) => {
    await serveAudience(page, { recipients: [recipient("l1", "Aayush", 2)] });
    await gotoProfile(page);
    const button = page.getByRole("button", { name: /send update: 2 changes/i });
    await expect(button).toBeVisible();
    await page.locator('[data-workspace-tab="share"]').click();
    await expect(button).toBeVisible();
    await page.locator('[data-workspace-tab="design"]').click();
    await expect(button).toBeVisible();
  });

  test("follows the selected card, never showing another card's recipients", async ({ page }) => {
    await page.route("**/api/cb/cards/*/audience", async (route) => {
      const holdsIt = route.request().url().includes(FIRST_CARD);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          currentVersion: 3,
          recipients: holdsIt ? [recipient("l1", "Aayush", 1)] : [],
        }),
      });
    });
    await gotoProfile(page);
    await expect(page.getByRole("button", { name: /send update: 1 change/i })).toBeVisible();

    const others = page.locator("[data-card-switch]:not([data-card-switch='" + FIRST_CARD + "'])");
    if ((await others.count()) > 0) {
      await others.first().click();
      /* Still there — never removed — but this card has nobody to tell. */
      await expect(slot(page)).toHaveAttribute("data-send-update-state", "empty");
    }
  });
});
