import { expect, test } from "@playwright/test";

import {
  PROJECT_VIEWPORT,
  VIEWPORTS,
  VIEWPORT_SIZES,
  boxesOverlap,
  gotoReady,
  screenshotElement,
  screenshotPage,
} from "../helpers/e2e";
import { readPng } from "../helpers/pixels";

/**
 * The Playwright harness proving itself, before 31 tracks depend on it.
 *
 * Everything here is deliberately independent of page *content*: T02 deletes the scaffold
 * `/` and T26 rebuilds it much later, so this file must stay green throughout the run.
 */

test("the app serves a response Playwright can read", async ({ page }) => {
  const response = await gotoReady(page, "/");
  expect(response).not.toBeNull();
  // A 404 is fine and expected between T02 and T26. A 5xx is not.
  expect(response!.status()).toBeLessThan(500);
});

test("each project runs at its declared viewport", async ({ page }, testInfo) => {
  const width = PROJECT_VIEWPORT[testInfo.project.name];
  expect(VIEWPORTS).toContain(width);

  await gotoReady(page, "/");
  expect(page.viewportSize()).toEqual(VIEWPORT_SIZES[width]);
});

test("screenshots come back at deviceScaleFactor 2 — the R-2 mitigation", async ({ page }, testInfo) => {
  const width = PROJECT_VIEWPORT[testInfo.project.name];
  await gotoReady(page, "/");

  const bitmap = readPng(await screenshotPage(page));
  // `scale: 'device'` + `deviceScaleFactor: 2` is what gives jsqr enough raster to work with.
  expect(bitmap.width).toBe(width * 2);
});

test("screenshotElement returns raw device-scale pixels for a known box", async ({ page }) => {
  await gotoReady(page, "/");
  await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.id = "harness-probe";
    probe.style.cssText =
      "position:fixed;top:0;left:0;width:100px;height:50px;background:#000;z-index:2147483647";
    document.body.append(probe);
  });

  const bitmap = readPng(await screenshotElement(page.locator("#harness-probe")));
  expect(bitmap.width).toBe(200);
  expect(bitmap.height).toBe(100);
});

test("gotoReady disables animations and settles fonts", async ({ page }) => {
  await gotoReady(page, "/");

  const state = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "transition: opacity 500ms linear; animation: spin 2s linear infinite";
    document.body.append(probe);
    const computed = getComputedStyle(probe);
    return {
      transitionDuration: computed.transitionDuration,
      animationDuration: computed.animationDuration,
      fontsStatus: document.fonts.status,
    };
  });

  expect(state.transitionDuration).toBe("0s");
  expect(state.animationDuration).toBe("0s");
  expect(state.fontsStatus).toBe("loaded");
});

test("boxesOverlap is the QR-T3 primitive", () => {
  const a = { x: 0, y: 0, width: 10, height: 10 };
  expect(boxesOverlap(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  expect(boxesOverlap(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
  expect(boxesOverlap(a, { x: 0, y: 10, width: 10, height: 10 })).toBe(false);
});
