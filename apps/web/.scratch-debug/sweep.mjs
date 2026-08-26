// Sweep script — not part of the app. Exercises every /cards/new and /cards/{id}/edit
// route crossed with every ?state= value (+ one unrecognised value), both preview
// variants and all three builder tabs, on a already-running server (default port 3000).
//
// Usage: node sweep.mjs [baseUrl]

import { chromium } from "@playwright/test";

const BASE_URL = process.argv[2] ?? "http://localhost:3000";

const CARD_IDS = [
  null, // /cards/new
  "card_minimal_demo",
  "card_empty_demo",
  "card_forest_demo",
  "card_midnight_demo",
  "card_iris_demo",
  "card_cobalt_demo",
  "card_ember_demo",
  "card_lagoon_demo",
  "card_citrus_demo",
  "card_does_not_exist", // expect not-found, sanity check
];

const STATES = ["success", "loading", "empty", "error", "offline", "bogus-state-xyz"];

const TABS = ["template", "fields", "colour"];

let failures = [];
let visited = 0;

function urlFor(cardId, state) {
  const path = cardId === null ? "/cards/new" : `/cards/${cardId}/edit`;
  return `${BASE_URL}${path}?state=${encodeURIComponent(state)}`;
}

async function sweepOne(page, cardId, state) {
  const url = urlFor(cardId, state);
  const pageErrors = [];
  const consoleErrors = [];

  const onPageError = (err) => pageErrors.push(String(err && err.stack ? err.stack : err));
  const onConsole = (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  };
  page.on("pageerror", onPageError);
  page.on("console", onConsole);

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 });
    await page.waitForTimeout(150);

    const builder = page.locator("[data-builder]");
    const isBuilderUp = (await builder.count()) > 0;

    if (isBuilderUp) {
      // Flip preview variant both ways, if the toggle exists.
      const variantToggle = page.locator("[data-preview-variant-option]");
      const variantCount = await variantToggle.count();
      for (let i = 0; i < variantCount; i++) {
        await variantToggle.nth(i).click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(50);
      }

      // Click through every tab.
      for (const tab of TABS) {
        const trigger = page.locator(`[data-builder-tab="${tab}"]`);
        if ((await trigger.count()) > 0) {
          await trigger.first().click({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(50);
        }
      }
    }
  } catch (err) {
    pageErrors.push(`navigation/interaction threw: ${err}`);
  }

  visited++;
  if (pageErrors.length > 0 || consoleErrors.some((m) => m.includes("Cannot read properties"))) {
    failures.push({ url, pageErrors, consoleErrors });
  }

  page.off("pageerror", onPageError);
  page.off("console", onConsole);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  for (const cardId of CARD_IDS) {
    for (const state of STATES) {
      await sweepOne(page, cardId, state);
    }
  }

  await browser.close();

  console.log(`Visited ${visited} URL(s).`);
  if (failures.length === 0) {
    console.log("No crashes detected.");
  } else {
    console.log(`${failures.length} FAILURE(S):`);
    for (const f of failures) {
      console.log("----");
      console.log("URL:", f.url);
      console.log("pageerrors:", f.pageErrors);
      console.log("console errors:", f.consoleErrors);
    }
    process.exitCode = 1;
  }
}

main();
