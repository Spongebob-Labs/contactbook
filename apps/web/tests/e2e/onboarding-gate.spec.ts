import { expect, test } from "@playwright/test";

import { signIn, statefulSub } from "../helpers/session";

/**
 * **A brand-new owner walks signup → card setup → Done and is never sent back to the name step.**
 *
 * The bug this guards (client, 2026-10-09 and again 2026-10-11): after finishing the walkthrough,
 * Done landed on `/signup/first-name`, and re-entering the same email was refused as "already
 * registered". It reproduced on the deployed site and not on a developer's machine, which is why
 * this runs against the **production build** the harness starts (`next build && next start`): a
 * production build prefetches `<Link>` targets and keeps a client router cache, neither of which
 * `next dev` does.
 *
 * The stub partition for a `new-…` sub starts un-onboarded and flips on `POST /profile/onboarding`
 * (`tests/stubs/api.mjs`), so the gate's two reads — `POST /auth/me` and `GET /profile/me` — answer
 * `false` before the email step and `true` after it, as the real API does.
 */
test.describe("onboarding gate", () => {
  test("Done after card setup lands on the dashboard and stays there", async ({ page, baseURL }) => {
    await signIn(page.context(), baseURL!, { sub: statefulSub("new-owner") });

    const visited: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) visited.push(new URL(frame.url()).pathname);
    });

    // A new account, signed in: the gate sends everything to the first question.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/signup\/first-name$/);

    await page.getByLabel("First name").fill("Priya");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/signup\/last-name$/);
    await page.getByLabel("Last name").fill("Raghunathan");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/signup\/email$/);
    await page.getByLabel("Email address").fill("priya@fernwood.example");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/signup\/done$/);
    await page.locator("[data-auth-primary]").click();

    await expect(page).toHaveURL(/\/welcome$/);
    const settled = visited.length;

    // photo → about → colour, each skipped; then Done.
    await page.locator("[data-welcome-skip]").click();
    await expect(page.locator("[data-welcome-step='about']")).toBeVisible();
    await page.locator("[data-welcome-skip]").click();
    await expect(page.locator("[data-welcome-step='colour']")).toBeVisible();
    await page.locator("[data-welcome-primary='done']").click();

    await expect(page).toHaveURL(/\/dashboard$/);
    // Give any late redirect the chance to fire before asserting it did not.
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(visited.slice(settled).filter((path) => path.startsWith("/signup"))).toEqual([]);

    // And a reload — a fresh server render of the gate — still lets them in.
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
