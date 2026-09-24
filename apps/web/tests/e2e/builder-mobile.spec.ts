import { expect, test, type Page } from "@playwright/test";

import { PROJECT_VIEWPORT, gotoReady } from "../helpers/e2e";
import { signIn } from "../helpers/session";

/**
 * The builder **on a phone** — the pinned preview, and whether it tells the truth about itself.
 *
 * ## Why this file exists separately from `builder.spec.ts`
 * That suite passes 52/52 at `vp-360` and did so throughout the defect below, because every
 * assertion in it addresses a selector that was present and correct. Nothing was missing; the
 * problem was a box **measuring** 257px around content measuring 787px, with no cue that the
 * remainder existed. A suite written against selectors cannot see that. So this file asserts
 * **measurements and reachability** instead: what the owner can actually see, and what they are
 * told about what they cannot.
 *
 * ## The defect, in numbers
 * `--builder-preview-h` is `min(38svh, 300px)`, which leaves `[data-preview-frame]` a 257px
 * window at 360×800. The fixture card page is 787px tall. **530px — every field row on the
 * card — sat below the fold**, and a touch browser draws no scrollbar until a finger is already
 * moving, so the frame was indistinguishable from a card that had been clipped. The header read
 * "Fields 5" above a preview showing none of them.
 *
 * ⚠ The fix is deliberately **not** more height. That number is argued at its definition in
 * `builder-client.tsx` — 50svh left the controls 146px on a 640px screen, and the controls are
 * what the owner is using. A 257px window is the right size; it has to admit what it is.
 */

test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

/** Five mapped fields — enough that the rows are certain to be below the fold on a phone. */
const CARD = "/cards/card_minimal_demo/edit";
/** Zero mapped fields: the shortest card page this route can produce. */
const EMPTY_CARD = "/cards/card_empty_demo/edit";

async function openBuilder(page: Page, url = CARD) {
  await gotoReady(page, url);
  /* ⚠ `gotoReady` does not wait for this screen's own data — the segment streams
     `builder-skeleton.tsx` first, and a diagnostic written without this measured the skeleton
     and reported a page with no card on it at all. */
  await expect(page.locator("[data-builder]")).toBeVisible();
  await expect(page.locator("[data-builder-preview] [data-card-root]")).toBeVisible();
}

function viewportOf(projectName: string): number {
  const width = PROJECT_VIEWPORT[projectName];
  if (width === undefined) throw new Error(`no viewport mapped for project "${projectName}"`);
  return width;
}

/** ⚠ `lg` and above paints a real scrollbar, which is the cue there. */
const DESKTOP_REASON = "covered by the frame's own scrollbar at lg and above";

const frameOf = (page: Page) => page.locator("[data-preview-frame]");
const cueOf = (page: Page) => page.locator("[data-preview-scroll-nudge]");

/* ── the invariant, at every viewport ─────────────────────────────────────────────────── */

/**
 * The contract in one sentence: **a frame that hides content offers a way to reach it, and a
 * frame that hides nothing offers no furniture.**
 *
 * Written as a relationship rather than a fixed expectation so it is true at all three
 * viewports: at 360 even a zero-field card overflows by ~34px, while at 1440 the frame gets a
 * measured budget and the same card fits exactly. Both are correct; a hard-coded expectation
 * either way would be wrong on two projects out of three.
 */
for (const [name, url] of [
  ["a populated card", CARD],
  ["a zero-field card", EMPTY_CARD],
] as const) {
  test(`the scroll cue is present exactly when ${name} overflows its frame`, async ({ page }) => {
    await openBuilder(page, url);
    const frame = frameOf(page);

    const { hidden, state } = await frame.evaluate((node) => ({
      hidden: node.scrollHeight - node.clientHeight,
      state: node.getAttribute("data-preview-scroll"),
    }));

    if (hidden > 2) {
      expect(state, "content is hidden but the frame reports no overflow").not.toBe("none");
      await expect(cueOf(page), `${hidden}px hidden with no way to reach it`).toHaveCount(1);
    } else {
      expect(state).toBe("none");
      await expect(cueOf(page), "nothing is hidden, so the cue is furniture").toHaveCount(0);
    }
  });
}

/* ── the phone, where the cue is the only cue there is ────────────────────────────────── */

test.describe("on a phone", () => {
  /**
   * ⚠ **The regression this file was written for.** Not "is there a cue" but "can the owner
   * actually see the fields they are ticking" — the preview's entire purpose.
   */
  test("the owner can reach the card's field rows from the preview", async ({ page }, testInfo) => {
    test.skip(viewportOf(testInfo.project.name) >= 1024, DESKTOP_REASON);
    await openBuilder(page);
    const frame = frameOf(page);

    // Nothing but the identity block fits, so no row is visible to begin with.
    const visibleRows = async () =>
      frame.evaluate((node) => {
        const box = node.getBoundingClientRect();
        return Array.from(node.querySelectorAll<HTMLElement>("[data-card-field]")).filter((row) => {
          const r = row.getBoundingClientRect();
          return r.top >= box.top - 2 && r.bottom <= box.bottom + 2;
        }).length;
      });

    expect(await visibleRows(), "a phone-height frame should not fit a field row yet").toBe(0);
    await expect(frame).toHaveAttribute("data-preview-scroll", "at-top");
    await expect(cueOf(page)).toHaveAttribute("data-preview-scroll-nudge", "down");

    /* ⚠ Reachability, not one tap — and the distinction is measured rather than assumed. The
       card page's identity block (brand, avatar, name, role) is ~500px on the fixture profile
       against a 257px window, so the first row cannot be one screenful away and an assertion
       that it is would be wrong about the content rather than about the control. The cue moves
       a screenful at a time, which is the conventional and predictable behaviour; what this
       test owns is that repeating it gets there, and in a sane number of taps. */
    let taps = 0;
    while (taps < 6 && (await visibleRows()) === 0) {
      const direction = await cueOf(page).getAttribute("data-preview-scroll-nudge");
      if (direction !== "down") break;
      await cueOf(page).click();
      // Settle the smooth scroll before measuring again.
      await expect(frame).not.toHaveAttribute("data-preview-scroll", "at-top");
      await page.waitForTimeout(400);
      taps += 1;
    }

    expect(await visibleRows(), `no field row reachable after ${taps} taps`).toBeGreaterThan(0);
    expect(taps, "the rows are too many taps away to be worth the cue").toBeLessThanOrEqual(3);
  });

  test("the cue turns back once there is nothing further down", async ({ page }, testInfo) => {
    test.skip(viewportOf(testInfo.project.name) >= 1024, DESKTOP_REASON);
    await openBuilder(page);
    const frame = frameOf(page);

    await frame.evaluate((node) => node.scrollTo({ top: node.scrollHeight }));
    await expect(frame).toHaveAttribute("data-preview-scroll", "at-end");
    // Pointing up is the only useful direction left — the name is what is off screen now.
    await expect(cueOf(page)).toHaveAttribute("data-preview-scroll-nudge", "up");

    await cueOf(page).click();
    await expect(frame).not.toHaveAttribute("data-preview-scroll", "at-end");
  });

  /**
   * ⚠ The cue sits **outside the frame** on a phone — in the caption row under it — and this
   * asserts both halves of why.
   *
   * It was centred first, and covered the middle of the role line. Then it moved to the
   * frame's bottom-right corner, and this test (which only checked TEXT glyphs) passed while
   * the cue sat on the full-width "Send to Phone" button: a button's fill and arrow are not
   * text. On a ~250px window no corner is empty, so the cue must not overlap the frame at all.
   */
  test("the cue covers none of the card — not its text, and not the frame", async ({ page }, testInfo) => {
    test.skip(viewportOf(testInfo.project.name) >= 1024, DESKTOP_REASON);
    await openBuilder(page);

    const overlap = await page.evaluate(() => {
      const cue = document.querySelector<HTMLElement>("[data-preview-scroll-nudge]");
      const frame = document.querySelector<HTMLElement>("[data-preview-frame]");
      if (cue === null || frame === null) return ["no cue or frame"];
      const c = cue.getBoundingClientRect();
      const hits: string[] = [];
      const f = frame.getBoundingClientRect();
      if (c.left < f.right && c.right > f.left && c.top < f.bottom && c.bottom > f.top) {
        hits.push(`the frame itself (cue ${Math.round(c.top)}-${Math.round(c.bottom)}, frame ends ${Math.round(f.bottom)})`);
      }
      /* ⚠ Per-LINE glyph boxes, via a Range — not the element's own rect.
         A centred paragraph that wraps has a full-width bounding box while its glyphs sit in
         the middle of each line, so an element-rect test reports the corner as covered on
         every wrapped role line and is a false positive. `getClientRects()` returns one box per
         line, tight to the text. */
      const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const text = (node.textContent ?? "").trim();
        if (text.length === 0) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of Array.from(range.getClientRects())) {
          if (r.width === 0 || r.height === 0) continue;
          if (r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top) {
            hits.push(`"${text.slice(0, 30)}"`);
            break;
          }
        }
      }
      return hits;
    });

    expect(overlap, "the scroll cue is sitting on the card's own words").toEqual([]);
  });

  /**
   * A whole class of phone defect in one assertion: nothing on this screen may reach past the
   * right edge, at either panel. A 60-character unbroken value (§11 E-15) and a long card name
   * are the two things that historically did.
   */
  for (const panel of ["fields", "design"] as const) {
    test(`the ${panel} panel produces no sideways overflow`, async ({ page }, testInfo) => {
      test.skip(viewportOf(testInfo.project.name) >= 1024, DESKTOP_REASON);
      await openBuilder(page);
      await page.locator(`[data-builder-nav-item="${panel}"]`).click();
      await expect(page.locator(`[data-builder-section="${panel}"]`)).toBeVisible();

      const spill = await page.evaluate(() => {
        const vw = window.innerWidth;
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right > vw + 1) {
            out.push(`${el.tagName.toLowerCase()} right=${Math.round(r.right)} vw=${vw}`);
          }
        }
        return { docScrollWidth: document.documentElement.scrollWidth, vw, spill: out.slice(0, 6) };
      });

      expect(spill.spill).toEqual([]);
      expect(spill.docScrollWidth, "the document scrolls sideways").toBeLessThanOrEqual(spill.vw);
    });
  }
});
