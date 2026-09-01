import { expect, test } from "@playwright/test";

import { gotoReady } from "../helpers/e2e";

/**
 * **The ground is not a function of how many fields the card carries.**
 *
 * This has been reported three times and shipped broken twice, so it gets a file rather than a
 * line inside a larger spec.
 *
 * ## The failure it guards
 * `card.css` renders `[data-card-ground]` `absolute` by default and promotes it to `fixed` only
 * under `[data-card-page-surface]`. `absolute` pins it to the card article, and the article is
 * exactly as tall as its content — so a card sharing one or two fields painted a short band of
 * colour with the app's white canvas below it, while a card with five looked perfect because its
 * content happened to reach the fold. The background looked like a function of field count.
 *
 * ## Why it was invisible
 * `public-card.spec.ts` navigates to fixture slugs (`/c/prya-hq`) that stopped resolving when
 * this route moved to the real API. Those tests did not fail — they stopped exercising the page.
 * The suite now runs against `tests/stubs/public-card-api.mjs`, which serves `/c/n{count}`, so
 * the shortest article this route can produce is addressable and this contract is measurable.
 *
 * ## What is asserted
 * The ground covers the **viewport**, at every count from zero upward, on every project
 * viewport — not "the ground is tall", which an `absolute` ground satisfies whenever the content
 * happens to be tall enough.
 */

/** Zero is the real edge: the shortest article, and the one an owner reaches by unticking. */
const FIELD_COUNTS = [0, 1, 2, 3, 5] as const;

for (const count of FIELD_COUNTS) {
  test(`the ground covers the viewport with ${count} field(s)`, async ({ page }) => {
    await gotoReady(page, `/c/n${count}`);

    const measured = await page.evaluate(() => {
      const ground = document.querySelector("[data-card-ground]");
      const article = document.querySelector('[data-card-variant="page"]');
      if (ground === null || article === null) return null;
      const box = ground.getBoundingClientRect();
      return {
        position: getComputedStyle(ground).position,
        top: Math.round(box.top),
        height: Math.round(box.height),
        viewport: window.innerHeight,
        articleHeight: Math.round(article.getBoundingClientRect().height),
      };
    });

    expect(measured, "the card page rendered no ground at all").not.toBeNull();
    const { position, top, height, viewport, articleHeight } = measured!;

    /* The mechanism, named — so a failure says *why* rather than only that a number is small. */
    expect(
      position,
      "the ground fell back to `absolute`, which pins it to the article instead of the viewport " +
        "— check that [data-card-page-surface] still reaches the DOM on this route",
    ).toBe("fixed");

    expect(top).toBeLessThanOrEqual(0);
    expect(
      height,
      `the ground is ${height}px against a ${viewport}px viewport, so the page shows the app's ` +
        "white canvas below the card",
    ).toBeGreaterThanOrEqual(viewport);

    /* ⚠ Non-vacuity. Without this the test passes for the wrong reason the moment a card's
       content happens to be taller than the viewport — which is precisely why the five-field
       card always looked fine and hid the bug. At these counts the article MUST be shorter. */
    if (count <= 3) {
      expect(
        articleHeight,
        "this card is no longer shorter than the viewport, so it can no longer prove the ground " +
          "is independent of content height — lower the field count",
      ).toBeLessThan(viewport);
    }
  });
}

test("the ground holds still while a long card scrolls", async ({ page }) => {
  await gotoReady(page, "/c/n14");

  const before = await page.evaluate(() => {
    const g = document.querySelector("[data-card-ground]")!.getBoundingClientRect();
    return { top: Math.round(g.top), scrollable: document.documentElement.scrollHeight > window.innerHeight };
  });
  expect(before.scrollable, "n14 is meant to overflow the viewport; it did not").toBe(true);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);

  const after = await page.evaluate(() => {
    const g = document.querySelector("[data-card-ground]")!.getBoundingClientRect();
    return { top: Math.round(g.top), height: Math.round(g.height), viewport: window.innerHeight };
  });

  expect(after.top).toBe(before.top);
  expect(after.height).toBeGreaterThanOrEqual(after.viewport);
});
