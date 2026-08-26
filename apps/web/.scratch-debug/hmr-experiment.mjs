// HMR mechanism experiment — NOT part of the app, deleted after use.
//
// Hypothesis under test: a `Builder` mounted on the dev server, holding reducer state with
// `templateId: "meridian"`, survives a Fast-Refresh edit to `src/card/templates/index.ts`
// that removes the "meridian" key from the `TEMPLATES` record — and the next render reads
// `TEMPLATES[state.templateId]` against the *new* module with the *old* state, producing
// `template: undefined` without any page reload.

import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const BASE_URL = "http://localhost:3000";
const TEMPLATES_PATH = new URL("../src/card/templates/index.ts", import.meta.url).pathname;
const ORIGINAL = readFileSync(TEMPLATES_PATH, "utf8");

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err && err.stack ? err.stack : err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console.error]", msg.text());
  });

  await page.goto(`${BASE_URL}/cards/new?state=success`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-builder-preview-summary]");
  const before = await page.locator("[data-builder-preview-summary]").textContent();
  console.log("Caption before edit:", before);

  // Rename the "meridian" key to "meridianX" in the TEMPLATES record, leaving the fixture
  // card's own templateId ("meridian", already resolved server-side into the mounted
  // reducer's state) unchanged. This is exactly what a template-registry edit does mid-session.
  const mutated = ORIGINAL.replace(
    /meridian: \{\n    id: "meridian",/,
    'meridianX: {\n    id: "meridianX",',
  );
  if (mutated === ORIGINAL) {
    console.log("MUTATION DID NOT APPLY — pattern not found, aborting experiment.");
    await browser.close();
    return;
  }

  writeFileSync(TEMPLATES_PATH, mutated);
  console.log("Wrote mutated templates/index.ts, waiting for Fast Refresh...");

  // Give Turbopack's HMR websocket time to push the update and React time to re-render.
  await page.waitForTimeout(3000);

  const stillThere = await page.locator("[data-builder-preview-summary]").count();
  console.log("Preview summary node still present after edit:", stillThere > 0);
  if (stillThere > 0) {
    const after = await page.locator("[data-builder-preview-summary]").textContent().catch((e) => `<read failed: ${e}>`);
    console.log("Caption after edit:", after);
  }

  console.log("pageerrors captured:", pageErrors.length);
  for (const e of pageErrors) console.log("----\n" + e);

  // Also check the error overlay iframe, in case Next's dev overlay swallowed it into an
  // overlay rather than a raw pageerror event.
  const overlay = await page.locator("nextjs-portal").count().catch(() => 0);
  console.log("next dev error overlay present:", overlay > 0);
  if (overlay > 0) {
    const overlayText = await page.evaluate(() => {
      const portal = document.querySelector("nextjs-portal");
      return portal ? portal.shadowRoot?.body?.innerText ?? null : null;
    }).catch(() => null);
    console.log("overlay text:", overlayText);
  }

  writeFileSync(TEMPLATES_PATH, ORIGINAL);
  console.log("Reverted templates/index.ts.");

  await browser.close();
}

main().catch((err) => {
  // Always restore on any failure.
  writeFileSync(TEMPLATES_PATH, ORIGINAL);
  console.error("Experiment errored, file restored:", err);
  process.exitCode = 1;
});
