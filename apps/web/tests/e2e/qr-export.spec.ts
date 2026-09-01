import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { CARD_EXPORT_HEIGHT, CARD_EXPORT_WIDTH } from "@/card/export-card-png";
import { DEFAULT_EXPORT_PIXEL_RATIO } from "@/card/export-card-png";
import { resolveCard } from "@/card/resolve-card";
import { TEMPLATE_LIST } from "@/card/templates";
import { FIXTURE_DB } from "@/fixtures";

import { gotoReady } from "../helpers/e2e";
import { decodeQrPng } from "../helpers/qr-decode";
import { readPng } from "../helpers/pixels";

/**
 * QR-T6 — **an exported card still scans.** The ground truth for the whole export path.
 *
 * ## What was here before
 *
 * A single test named `PROBE-EXPORT` that clicked through every template, downloaded each PNG,
 * decoded it, computed an `ok` boolean — and then `console.log`ed a JSON blob and asserted
 * nothing at all. It was diagnostic scaffolding from the previous build: it could fail (and did,
 * on a 300-second timeout, once the builder route it also drove became a placeholder) but it
 * could never catch a regression, because it made no claims.
 *
 * The valuable half of it was real, though, and existed as an assertion nowhere else: a card
 * exported to PNG has to carry a symbol a phone can still read. `tests/unit/export-card-png.ts`
 * proves the *path* — that the right node is handed to the rasteriser, attached, at the right
 * size — but it mocks `html-to-image`, because happy-dom has no canvas. Only a real browser can
 * say whether the bytes decode.
 *
 * So the probe's claims are now assertions, and the parts that drove the unbuilt builder are
 * gone.
 */

const CARDS = TEMPLATE_LIST.map((template) => {
  const card = FIXTURE_DB.cards.find(
    (candidate) => candidate.templateId === template.id && candidate.fieldIds.length > 0,
  );
  if (card === undefined) throw new Error(`no fixture card for template ${template.id}`);
  return {
    template,
    card,
    resolved: resolveCard(card, FIXTURE_DB.user, FIXTURE_DB.groups, FIXTURE_DB.fields),
  };
});

for (const { template, card, resolved } of CARDS) {
  test(`QR-T6 · ${template.id} · the exported PNG decodes to the card's payload`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await gotoReady(page, `/cards/${card.id}`);

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      page.locator("[data-export-png]").click(),
    ]);

    const path = await download.path();
    expect(path, "the export produced no file").not.toBeNull();
    const bytes = readFileSync(path as string);
    const png = readPng(bytes);

    /* The raster is the face at `pixelRatio`. Asserted against the module's own constants, so
       a change to the face size updates both together or fails here. */
    expect(png.width).toBe(CARD_EXPORT_WIDTH * DEFAULT_EXPORT_PIXEL_RATIO);
    expect(png.height).toBe(CARD_EXPORT_HEIGHT * DEFAULT_EXPORT_PIXEL_RATIO);

    /* THE assertion. Not "a QR is present" — the exact payload, decoded from the shipped bytes
       by the same library a scanner's algorithm resembles. A card whose export does not scan is
       not an export. */
    expect(
      decodeQrPng(bytes),
      `${template.id}: the exported PNG did not decode to the card's own URL`,
    ).toBe(resolved.qrPayload);

    /* The filename reaches the user's downloads folder, so it has to be a name and not a hash. */
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });
}

test("QR-T6 · the exported PNG is the face, not the scan page", async ({ page }) => {
  /* A real confusion worth guarding: there are two card objects, and only one of them is a
     fixed-size artefact that can be rasterised. If the exporter ever pointed at `<CardPage>` the
     download would be a tall, mostly-empty image — and it would still contain a decodable QR, so
     the decode assertions above would all pass. The dimensions are what distinguish them. */
  const { card } = CARDS[0];
  await gotoReady(page, `/cards/${card.id}`);

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.locator("[data-export-png]").click(),
  ]);
  const png = readPng(readFileSync((await download.path()) as string));

  /* Portrait, and the face's own 336 : 500 ratio to within a pixel of rounding. */
  expect(png.height).toBeGreaterThan(png.width);
  expect(png.width / png.height).toBeCloseTo(CARD_EXPORT_WIDTH / CARD_EXPORT_HEIGHT, 2);
});
