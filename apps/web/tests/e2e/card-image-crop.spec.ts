import { expect, test, type Page } from "@playwright/test";

import { COVER_RATIO } from "@/card/card-page";
import { gotoReady } from "../helpers/e2e";
import { signIn } from "../helpers/session";

/**
 * THE CROP DIALOG — composing a cover, end to end.
 *
 * ## The defect this file exists for
 *
 * A cover was saved the instant a file was chosen, and the card drew it `object-fit: cover` at a
 * fixed `object-position: 50% 28%`. The client uploaded a full-length photograph and the card
 * rendered a head: correct behaviour from a component that had never been told what to keep.
 *
 * ## ⚠ Why this is an e2e test and not a unit test
 *
 * The geometry is already covered exhaustively in `tests/unit/image-crop.test.ts` — fuzzed and
 * mutation-tested — so nothing here re-checks arithmetic. What that suite cannot see is the
 * three-way join this feature actually depends on:
 *
 * 1. the aperture is **measured from real layout** (it is portalled, and a `useLayoutEffect`
 *    keyed on `open` read the node before it attached, leaving the frame 0px wide — the image
 *    rendered at zero size and the confirm button sat permanently disabled, on a dialog that
 *    otherwise looked completely correct);
 * 2. the aperture's aspect is the **card's own** `COVER_RATIO`, not a restated constant;
 * 3. the baked result reaches the card.
 *
 * Every one of those is a wiring fact, and jsdom has no layout engine to check any of them.
 */

/**
 * A tall, three-banded source, built in the page.
 *
 * Tall because that is the failing case — the aperture is far wider than it is high, so a
 * portrait source is where the crop has to make a real choice. Banded because it makes the
 * assertion about *content*: panning down must put a different colour under the frame, which is
 * something a screenshot-free test can actually read.
 */
async function chooseTallCover(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 1600;
    const ctx = canvas.getContext("2d")!;
    const bands = ["#1B4CE0", "#E1AA40", "#B42318"];
    bands.forEach((fill, i) => {
      ctx.fillStyle = fill;
      ctx.fillRect(0, (i * 1600) / 3, 600, 1600 / 3);
    });
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/png"),
    );
    /* Assigned through a `DataTransfer` and a real `change` event: `setInputFiles` cannot take a
       File constructed in the page, and this exercises the same path a person's file takes. */
    const input = document.querySelector<HTMLInputElement>("[data-cover-input]")!;
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "tall.png", { type: "image/png" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** Drive the range input the way React hears it — `fill()` does not work on `type=range`. */
async function setZoom(page: Page, value: string): Promise<void> {
  await page.locator("[data-crop-zoom]").evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

/* ⚠ On the context and before the first navigation — a cookie set after `goto` arrives too late
   for the redirect that already happened, and the test then reports the sign-in screen as a
   missing element. See `tests/helpers/session.ts`. */
test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

test.describe("composing a cover", () => {
  test("opens the cropper before anything is saved, at the card's own aspect", async ({ page }) => {
    await gotoReady(page, "/cards/card_minimal_demo/edit");
    await page.locator('[data-builder-nav-item="design"]').click();

    /* Nothing on the card yet — the file has not been chosen. */
    await expect(page.locator("[data-cover-adjust]")).toHaveCount(0);

    await chooseTallCover(page);

    const frame = page.locator("[data-crop-frame]");
    await expect(frame).toBeVisible({ timeout: 10_000 });

    /* ⚠ The aperture must be the CARD's, or the owner composes a picture they never see.
       Read `COVER_RATIO.photo` itself rather than restating its value: this literal drifted
       silently out of date across two rounds of retuning that constant (0.7 → 0.45 → 0.6) before
       anyone noticed the assertion, not the arithmetic, was wrong. Read from real geometry
       rather than from a class, because the bug this guards rendered a correctly-classed box at
       0px. */
    const box = (await frame.boundingBox())!;
    expect(box.width).toBeGreaterThan(80);
    expect(box.width / box.height).toBeCloseTo(1 / COVER_RATIO.photo, 2);

    /* The thirds grid is guidance for exactly the headroom judgement being made here. */
    await expect(page.locator("[data-crop-frame] span.absolute")).toHaveCount(4);
  });

  test("bakes the composed crop into the card at the aperture's aspect", async ({ page }) => {
    await gotoReady(page, "/cards/card_minimal_demo/edit");
    await page.locator('[data-builder-nav-item="design"]').click();
    await chooseTallCover(page);

    const frame = page.locator("[data-crop-frame]");
    await expect(frame).toBeVisible({ timeout: 10_000 });
    const box = (await frame.boundingBox())!;

    await setZoom(page, "2");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 400, { steps: 12 });
    await page.mouse.up();

    await page.locator("[data-crop-apply]").click();
    await expect(frame).toBeHidden();

    /* The card now carries a BAKED image: its natural aspect is the aperture's, which is what
       makes it correct on the public page and in the PNG export without a stored transform. */
    const cover = page.locator("[data-card-cover-photo]").first();
    await expect(cover).toBeVisible();
    const natural = await cover.evaluate((el) => {
      const img = el as HTMLImageElement;
      return { w: img.naturalWidth, h: img.naturalHeight };
    });
    expect(natural.w / natural.h).toBeCloseTo(1 / COVER_RATIO.photo, 2);

    /* ⚠ **Asserted on RED, and the first version of this check was vacuous.**
       It asserted the card was "no longer blue", which is true *without any panning at all*: at
       the default cover fit a 600×1600 source shows its vertical middle, which is the amber
       band. The test passed whether or not the composition was applied — the exact shape of
       useless coverage this file exists to avoid.
       The bottom band is red and is reachable ONLY by panning down, so sampling for red is what
       actually distinguishes "the crop was applied" from "the crop was ignored". */
    const bands = await cover.evaluate((el) => {
      const img = el as HTMLImageElement;
      const c = document.createElement("canvas");
      c.width = 16;
      c.height = 16;
      const x = c.getContext("2d")!;
      x.drawImage(img, 0, 0, 16, 16);
      /* ⚠ **Crimson is identified by its LOW GREEN, not by "red beats the others".**
         The second version of this check asked `r > g + 40 && r > b + 40` — which the AMBER
         band also satisfies (#E1AA40 is r=225, g=170, b=64). So it reported the bottom band as
         present whenever the middle band was, and a mutation run with the pan deleted still
         passed. Crimson #B42318 has g=35 and amber g=170, so green is the channel that actually
         separates them. */
      const hit = { crimson: false, blue: false };
      for (let y = 0; y < 16; y += 1) {
        const [r, g, b] = x.getImageData(8, y, 1, 1).data;
        if (r > 110 && g < 95 && b < 95) hit.crimson = true;
        if (b > 110 && r < 95 && g < 95) hit.blue = true;
      }
      return hit;
    });
    expect(
      bands.crimson,
      "the pan was not applied — the source's bottom band never reached the card",
    ).toBe(true);
    expect(bands.blue, "the card still shows the source's top band").toBe(false);

    /* Having a cover offers the two follow-up actions. */
    await expect(page.locator("[data-cover-adjust]")).toHaveCount(1);
    await expect(page.locator("[data-cover-remove]")).toHaveCount(1);
  });

  test("cancelling leaves the card untouched", async ({ page }) => {
    await gotoReady(page, "/cards/card_minimal_demo/edit");
    await page.locator('[data-builder-nav-item="design"]').click();
    await chooseTallCover(page);

    await expect(page.locator("[data-crop-frame]")).toBeVisible({ timeout: 10_000 });
    await page.locator("[data-crop-cancel]").click();
    await expect(page.locator("[data-crop-frame]")).toBeHidden();

    /* ⚠ The whole point of opening BEFORE saving: a cancelled compose must leave no cover at
       all, not a cover at the default crop. */
    await expect(page.locator("[data-cover-adjust]")).toHaveCount(0);
  });
});
