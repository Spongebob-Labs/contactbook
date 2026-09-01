// HMR mechanism experiment 2 — NOT part of the app, deleted after use.
//
// Refinement of experiment 1: a *self-consistent* rename of "meridian" -> "meridianX"
// throughout templates/index.ts (registry key AND TEMPLATE_ORDER), so TEMPLATE_LIST and
// DEFAULT_TEMPLATE_ID are internally valid after the swap. The only thing that can now go
// stale is a *already-mounted* component's own `useReducer` state, captured before the
// edit, which Fast Refresh preserves across a re-render triggered by the module swap.
//
// Expected, if the hypothesis is right: the crash relocates from `seedPreview`'s
// `TEMPLATE_LIST[0].id` (experiment 1) to `resolveCard`'s `TEMPLATES[card.templateId]`,
// surfacing at `resolved.template.name` in BuilderPreview — the exact line and component
// from the original report.

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

  // An existing card, so the mounted reducer's templateId comes from the fixture
  // (`card_minimal_demo`, templateId "meridian") via builderInitialState — not from
  // DEFAULT_TEMPLATE_ID, which the edit below keeps valid throughout.
  await page.goto(`${BASE_URL}/cards/card_minimal_demo/edit?state=success`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("[data-builder-preview-summary]");
  const before = await page.locator("[data-builder-preview-summary]").textContent();
  console.log("Caption before edit:", before);

  // Self-consistent rename: the key, the inner `id`, AND `TEMPLATE_ORDER`'s entry all move
  // together, so the freshly re-evaluated module is internally coherent.
  let mutated = ORIGINAL
    .replace('meridian: {\n    id: "meridian",', 'meridianX: {\n    id: "meridianX",')
    .replace('["meridian", "marigold"]', '["meridianX", "marigold"]');

  if (mutated === ORIGINAL) {
    console.log("MUTATION DID NOT APPLY — pattern not found, aborting experiment.");
    await browser.close();
    return;
  }

  writeFileSync(TEMPLATES_PATH, mutated);
  console.log("Wrote self-consistent renamed templates/index.ts, waiting for Fast Refresh...");

  await page.waitForTimeout(3000);

  const stillThere = await page.locator("[data-builder-preview-summary]").count();
  console.log("Preview summary node still present after edit:", stillThere > 0);

  console.log("pageerrors captured:", pageErrors.length);
  for (const e of pageErrors) console.log("----\n" + e);

  writeFileSync(TEMPLATES_PATH, ORIGINAL);
  console.log("Reverted templates/index.ts.");

  await browser.close();
}

main().catch((err) => {
  writeFileSync(TEMPLATES_PATH, ORIGINAL);
  console.error("Experiment errored, file restored:", err);
  process.exitCode = 1;
});
