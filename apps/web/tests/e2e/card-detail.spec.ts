import { expect, test, type Page } from "@playwright/test";

import { PROJECT_VIEWPORT, gotoReady } from "../helpers/e2e";
import { signIn } from "../helpers/session";
import { STATE_QUERIES, withState } from "../helpers/routes";

/**
 * ⚠ EVERY TEST BELOW IS ON A GATED ROUTE, SO THE CONTEXT NEEDS A SESSION FIRST.
 *
 * `proxy.ts` redirects `/cards/**` to `/signin/phone` without a `cb_at` cookie. Before this
 * hook existed, that redirect is what the whole suite was asserting against — every test found
 * a phone-number form and reported it as a missing element, which reads as a product bug. See
 * `tests/helpers/session.ts` for why a forged-`exp` cookie is the right seam and why it is
 * opt-in rather than global.
 *
 * On the CONTEXT and before `goto`: a cookie set afterwards arrives too late for a redirect
 * that has already happened.
 */
test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

/**
 * `/cards/[cardId]` — the owner's view of one card, and the screen where the **preview and
 * the payload are proved to be the same thing** (spec §8D.3, §6.4 I-5, plan T22).
 *
 * ## The one architectural claim this file exists to check
 * `card-detail-client.tsx` calls `resolveCard` **once** and `buildVcf` **once**, and passes
 * those values down to the renderer, the share panel and the PNG export. That is invariant
 * I-5: if a second surface re-derived, the two would be objects that merely usually agree,
 * which is the old build's "previewed file differs from sent file" bug (§6.4).
 *
 * ⚠ **No `.vcf` leaves this screen any more, so the I-5 assertions that read one are gone.**
 * The share sheet stopped offering a file first (what a recipient gets is a **link**, §4.2),
 * and the owner's "Save to contacts" followed on 2026-09-20. See the block comment above the
 * share-sheet section for where each claim is proved now — and note that the two guard tests
 * that keep a file from *reappearing* are still here, because "removed" and "gated" look
 * identical from the outside otherwise.
 *
 * ## What this file owns
 * · **the share-first layout (client review 2026-09-28)** — the card with its QR first, then
 *   "Send this card" to a phone number, then the card link with Copy, then Wallet, then who it
 *   was sent to; the field list behind a closed disclosure; no template name, no field-count
 *   meter, and one share UI (the header's Share focuses the phone field — there is no dialog).
 * · **the face** — at its exact design size, with nothing painted over its QR, and the wallet
 *   controls outside its rail. The reasoning lives at the head of
 *   `src/components/share/wallet-pass-block.tsx` and `wallet-actions.tsx`.
 * · **E-36** — an id that does not resolve lands on the dedicated not-found panel, never an
 *   empty state and never a raw 404.
 * · **E-43** — two fast taps on Export produce exactly one download and a busy control.
 * · **E-44** — a forced export failure shows a retry toast and **always** clears the spinner.
 * · **E-50** — Escape closes the delete dialog and returns focus to its trigger.
 * · **AC-24** — all four state families, each reachable through `?state=`.
 *
 * ## What it deliberately does not own
 * It never decodes a QR: QR-T5 and QR-T6 belong to T27 and run for every template × every
 * viewport (spec §16.1 R-2 — duplicating the run's flakiest assertion buys nothing). It does
 * not re-assert `buildVcf`'s §6.7 table either, nor AC-22's set equality; T11's unit suite
 * owns both, byte for byte and as a round trip.
 *
 * Every navigation goes through `gotoReady`: animations dead, `document.fonts` settled
 * (§14.6 / R-10) **and** React's throttled streamed reveal waited out (D14). That last part is
 * what makes a bare CSS locator unambiguous on this route. It used to be a local wrapper in this
 * file; `helpers/e2e.ts` absorbed it, so every spec in the run now inherits it and none can
 * forget it. The reasoning lives on `waitForStreamedReveal` there.
 */

/** The §6.7 worked card: Ledger, five mapped fields, one of them a `PHONE`. */
const CARD = "/cards/card_minimal_demo";

/** `card_empty_demo` — zero mapped fields. The 73-byte `.vcf` bug, made addressable (E-01). */
const EMPTY_CARD = "/cards/card_empty_demo";

/** Atrium. `BANK_ACCOUNT` + `DIGITAL_WALLET` + `CRYPTO_WALLET` — the masking card (AC-33). */
const FINANCIAL_CARD = "/cards/card_cobalt_demo";

/** An id shaped like a real one that resolves to nothing (E-36). */
const UNKNOWN_CARD = "/cards/card_does_not_exist";

/* ── the screen ──────────────────────────────────────────────────────────────────── */

test("renders one full card, one QR zone, and the shell's single main (AC-11)", async ({
  page,
}) => {
  await gotoReady(page, CARD);

  await expect(page.locator("[data-card-detail]")).toHaveCount(1);
  await expect(page.locator('[data-card-root][data-render-mode="full"]')).toHaveCount(1);
  await expect(page.locator("[data-qr-zone]")).toHaveCount(1);
  await expect(page.locator("[data-qr-symbol]")).toHaveCount(1);

  // The shell owns the one `<main id="main">`; a screen that renders a second fails axe's
  // `landmark-unique` in T29 (AC-25).
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("[data-app-shell]")).toHaveCount(1);
});

test("renders the card's own template in the product's single typeface", async ({ page }) => {
  await gotoReady(page, CARD);

  await expect(page.locator("[data-card-root]")).toHaveAttribute("data-template-id", "meridian");

  /* This asserted that `--font-archivo` and `--font-bricolage` resolved on this route.
     
     The old design gave templates four different typefaces and route-scoped the two card-only
     ones so `/` and `(auth)` did not pay to download them. There is one family now — Geist,
     variable 100–900, loaded once in the root layout — because four families still produced
     eight cards that looked identical, the palette being what made them identical. Weight
     carries the hierarchy the extra families used to.
     
     `[data-card-fonts]` no longer exists. What is still worth asserting is that the card
     resolves that one family rather than falling through to a system stack. */
  const family = await page
    .locator("[data-card-root] [data-card-name]")
    .evaluate((node) => getComputedStyle(node).fontFamily);

  expect(family.toLowerCase()).toContain("geist");
});

test("renders three header actions and no template name or field-count meter", async ({
  page,
}) => {
  await gotoReady(page, CARD);

  await expect(page.getByRole("heading", { level: 1, name: "Work" })).toBeVisible();

  /* Client review 2026-09-28: *"'Meridian field count' label is confusing and should be
     removed."* Both halves of it are gone from this page, not restyled. */
  await expect(page.locator("[data-card-meta]")).toHaveCount(0);
  await expect(page.locator("[data-card-meta-template]")).toHaveCount(0);
  await expect(page.locator("[data-field-count-meter]")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Meridian");
  await expect(page.locator("main")).not.toContainText(/field count/i);

  // Share · Edit · Delete. Export PNG became "Save QR to phone" in the wallet row.
  await expect(page.locator("[data-card-detail-action]")).toHaveCount(3);
  await expect(page.locator('[data-card-detail-action="edit"]')).toHaveAttribute(
    "href",
    "/cards/card_minimal_demo/edit",
  );
  await expect(page.locator('[data-card-detail-action="share"]')).toBeVisible();
  await expect(page.locator('[data-card-detail-action="delete"]')).toBeVisible();
  await expect(page.locator('[data-card-detail-action="export"]')).toHaveCount(0);
});

test("the header's Share focuses the phone field instead of opening a dialog", async ({
  page,
}) => {
  await gotoReady(page, CARD);

  await page.locator('[data-card-detail-action="share"]').click();

  await expect(page.locator("[data-send-phone]")).toBeFocused();
  // One share UI: no second copy of it in a modal.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-share-sheet]")).toHaveCount(0);
});

test("puts the card first, then send, link, wallet and recipients — in two columns on desktop", async ({
  page,
}, testInfo) => {
  const viewport = PROJECT_VIEWPORT[testInfo.project.name];
  await gotoReady(page, CARD);

  /* Measured on the blocks themselves: below lg the two column wrappers are `display: contents`
     and have no box of their own. */
  const box = async (selector: string) => {
    const found = await page.locator(selector).first().boundingBox();
    expect(found, `${selector} has no box`).not.toBeNull();
    return found!;
  };
  const face = await box("[data-card-detail-face]");
  const send = await box("[data-send-to-phone]");
  const link = await box("[data-card-link]");
  const wallet = await box("[data-wallet-actions]");
  const sentTo = await box("#card-shares-heading");

  if (viewport >= 1024) {
    // The card and its wallet row on the left, everything else to their right.
    expect(face.x + face.width).toBeLessThanOrEqual(send.x + 1);
    expect(wallet.y).toBeGreaterThan(face.y);
    expect(wallet.x + wallet.width).toBeLessThanOrEqual(send.x + 1);
    expect(send.y).toBeLessThan(link.y);
    expect(link.y).toBeLessThan(sentTo.y);
  } else {
    // One column, in the order the client asked for: card, send, link, wallet, recipients.
    expect(face.y).toBeLessThan(send.y);
    expect(send.y).toBeLessThan(link.y);
    expect(link.y).toBeLessThan(wallet.y);
    expect(wallet.y).toBeLessThan(sentTo.y);
  }
});

test("keeps the fields behind a closed 'What's on this card' disclosure", async ({ page }) => {
  await gotoReady(page, CARD);

  const disclosure = page.locator("[data-card-fields]");
  await expect(disclosure).toHaveCount(1);
  // Closed by default: the page is for sharing, not for reading the fields again.
  await expect(disclosure).not.toHaveAttribute("open", /.*/);
  await expect(page.locator("[data-field-list]")).toBeHidden();

  await page.locator("[data-card-fields-toggle]").click();
  await expect(page.locator("[data-field-list]")).toBeVisible();
});

/* ── AC-22 / the field list ───────────────────────────────────────────────────────── */

test("lists the card's fields in the resolved order, never re-sorted (§6.4)", async ({
  page,
}) => {
  await gotoReady(page, CARD);

  const rows = page.locator("[data-field-list] [data-field-row]");
  await expect(rows).toHaveCount(5);

  // §6.4's rule is category, then type, then label, then id — and `FieldList` groups by the
  // same category table without re-sorting inside a group, so the DOM order is exactly the
  // `ResolvedCard.fields` order T11 pins in `tests/unit/build-vcf.test.ts`. A second sort
  // anywhere is how the rendered card and the downloaded file start disagreeing again.
  const types = await rows.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-field-type")),
  );
  expect(types).toEqual(["PHONE", "EMAIL", "URL", "JOB_TITLE", "COMPANY"]);
});

test("every external destination carries rel=noopener noreferrer (AC-32)", async ({ page }) => {
  await gotoReady(page, CARD);

  const externals = page.locator('[data-field-list] a[target="_blank"]');

  /* A retrying assertion before the plain `.count()` read. `Locator.count()` is one-shot and
     does not poll, so reading it straight after navigation raced the field list's hydration and
     failed at 768 while passing at 1440 — the link was always correct, the read was just early. */
  await expect(externals).not.toHaveCount(0);
  const count = await externals.count();

  for (let index = 0; index < count; index += 1) {
    await expect(externals.nth(index)).toHaveAttribute("rel", "noopener noreferrer");
  }
});

test("masks financial values and offers no reveal control (AC-33)", async ({ page }) => {
  await gotoReady(page, FINANCIAL_CARD);

  await expect(page.locator("[data-field-list] [data-field-masked]")).toHaveCount(3);

  const html = await page.content();
  expect(html).not.toContain("50100412345678");
  expect(html).not.toContain("0x8f2A55949038A501f5B7C0e1B4d8b9C3A2e4d612");

  // Reveal lives in `/profile` and nowhere else (§7.3).
  await expect(page.getByRole("button", { name: /reveal|show|unmask|unhide/i })).toHaveCount(0);
  await expect(page.locator("[data-field-list]").getByRole("switch")).toHaveCount(0);
});

/* ── the share sheet, and the I-5 seam (AC-29) ────────────────────────────────────── */

/**
 * ⚠ **THE TWO vCARD DOWNLOAD TESTS THAT LIVED HERE ARE DELETED, AND THE CONTROL THEY DROVE
 * IS GONE FROM THIS ROUTE.**
 *
 * They were "Save to contacts writes the one vCard, and its raw bytes (§6.9, I-5, AC-29)" and
 * "the .vcf carries exactly the field types the screen shows (AC-22)", plus a `saveToContacts`
 * helper that clicked `[data-card-action="save"]` and read the download stream. The owner's
 * Save button was removed on 2026-09-20 — saving your own card into your own address book is
 * not an action anybody takes, and the client read the screen as cluttered. With no control to
 * press, both tests could only have been kept by keeping a button nobody wanted, or by
 * rewriting them into assertions about nothing. This file's own history is the argument for
 * deleting them outright: an earlier rename of this very hook left these tests orphaned and
 * one assertion vacuous, passing against an attribute that existed nowhere.
 *
 * ⚠ The claims themselves did not go with them, and that is why this is a deletion rather
 * than a loss:
 *
 * · **§6.7 / §6.9 — the bytes, the CRLF endings and the filename** are pinned byte for byte
 *   by `tests/unit/build-vcf.test.ts`, which is where they always were; the e2e copy was a
 *   second reading of the same string.
 * · **AC-22 — "the visible set is the file set"** is a round trip in that same unit suite
 *   (its "the .vcf carries exactly the field types the card renders" describe block), against
 *   a reverse property→type table rather than a hand-listed one.
 * · **§6.9's real download**, in a browser, is `public-card.spec.ts`'s "Send to Phone
 *   downloads a vCard named after the contact" — on `/c/{slug}`, which is where a recipient
 *   presses it and which is the product's stated success metric.
 *
 * What genuinely is no longer observable from this route is **I-5's seam** — that the bytes
 * leaving the screen came from the screen's single `resolveCard`/`buildVcf` pair. Nothing
 * leaves this screen as a `.vcf` any more. `buildVcf` is still called exactly once here, and
 * still gates the empty state, but the invariant is now proved where it is still reachable:
 * in `tests/unit/build-vcf.test.ts` and on the public card.
 */

test("the card link block publishes the card's own link, with Copy beside it", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await gotoReady(page, CARD);

  const field = page.locator("[data-card-link] [data-link-field-value]");
  const url = await field.inputValue();
  expect(url).toMatch(/\/c\/.+/);
  // One string, everywhere it is offered: the field, "Open card" and the WhatsApp message.
  await expect(page.locator("[data-card-link-open]")).toHaveAttribute("href", url);
  const whatsapp = await page.locator("[data-share-whatsapp-any]").getAttribute("href");
  expect(new URL(whatsapp ?? "").searchParams.get("text")).toContain(url);

  const copy = page.locator("[data-card-link] [data-copy-link]");
  await copy.click();
  await expect(copy).toHaveAttribute("data-copied", "true");
  await expect(copy).toContainText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
});

/**
 * The regression guard for the removal above.
 *
 * This panel hands over a link. It must not grow a file back — not a `.vcf` dump, not a
 * download control, and above all not a heading claiming the recipient gets one. A card that
 * shares plenty is used deliberately: on an empty card the controls were always absent, so
 * only a full card can tell "removed" apart from "gated".
 */
test("the page offers a link and no vCard at all (§4.2)", async ({ page }) => {
  await gotoReady(page, CARD);

  await expect(page.locator("[data-vcf-preview]")).toHaveCount(0);
  await expect(page.locator("[data-share-download]")).toHaveCount(0);

  const main = page.locator("main");
  await expect(main).not.toContainText("BEGIN:VCARD");
  await expect(main).not.toContainText(/what people receive/i);
  await expect(main).not.toContainText(/\.vcf/i);

  // The link, and the ways to send it, are what is left.
  await expect(page.locator("[data-card-link]")).toBeVisible();
  await expect(page.locator("[data-send-to-phone]")).toBeVisible();
});

/* ── the wallet pass ──────────────────────────────────────────────────────────────── */

/**
 * **The card with its QR, and the wallet row beneath it.**
 *
 * The share face is the card in its own palette with the QR someone scans; its QR encodes
 * `qrPayload`, the card's own public `/c/{token}`. History, briefly: the two "Add to Wallet"
 * buttons were removed on 2026-09-20 because they did nothing but apologise for themselves, and
 * came back on 2026-09-28 because the client asked for them to be *"functional and visible"*.
 * Apple's is now wired to the real `GET /cards/{id}/wallet-pass` — a live link on iPhone/iPad
 * once the server answers a pass, and visibly disabled with one line of explanation anywhere else
 * (this suite runs desktop Chrome, so it sees the disabled state) — beside a "Save QR to phone"
 * that works everywhere (`wallet-actions.tsx`).
 *
 * What is asserted, and never about decoration:
 *
 * · the face stays **unscaled at 336 × 500 with no transformed ancestor**, because
 *   `qr-geometry|plate|overlap|occlusion|scannability.spec.ts` all measure it on this route;
 * · **nothing in the face's block overlaps the plate**, and the wallet controls live outside it.
 */

test("shows the card with its QR, and a wallet row outside the face's rail", async ({ page }) => {
  await gotoReady(page, CARD);

  const block = page.locator("[data-wallet-pass]");
  await expect(block).toHaveCount(1);
  await expect(block.locator('[data-card-root][data-render-mode="full"]')).toHaveCount(1);

  /* ⚠ 2026-09-28: no "Wallet pass" eyebrow. The client read it as a mechanism rather than
     their card — *"show the card with QR code, not just the pass"*. */
  await expect(block.locator("[data-wallet-pass-caption]")).toHaveCount(0);

  /* *"'Add to Wallet' must be functional and visible."* Both buttons are visible. On a desktop browser (not an iPhone)
     they are disabled and one line says why, and the control that
     works today — the QR image — sits beside them. */
  const wallet = page.locator("[data-wallet-actions]");
  await expect(wallet.locator('[data-wallet-add="apple"]')).toBeVisible();
  await expect(wallet.locator('[data-wallet-add="google"]')).toBeVisible();
  if ((await wallet.getAttribute("data-wallet-enabled")) === "false") {
    await expect(wallet.locator('[data-wallet-add="apple"]')).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(wallet.locator("[data-wallet-off-note]")).toBeVisible();
  }
  await expect(wallet.locator("[data-export-png]")).toBeVisible();

  // Outside the face's rail, never inside the block that wraps the card.
  await expect(block.locator("[data-wallet-actions], button, a")).toHaveCount(0);

  /* ⚠ The owner's own "Save to contacts" must not come back: `data-card-action="save"` is the
     recipient's control on `/c/{slug}`, not a copy on the owner's card. */
  await expect(page.locator('[data-card-action="save"]')).toHaveCount(0);
});

test("the wallet block leaves the pass unscaled at 336 x 500 (the five QR suites)", async ({
  page,
}) => {
  await gotoReady(page, CARD);

  const face = page.locator('[data-card-root][data-render-mode="full"]');
  const box = await face.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) return;

  // The design size, not "about the design size": `qrSizePx(336)` is 141.12, one pixel over
  // the 140px scannable floor, so a wrapper that shaved even a few percent off would put the
  // symbol under it.
  expect(Math.round(box.width)).toBe(336);
  expect(Math.round(box.height)).toBe(500);

  /* No `transform`, `scale` or `zoom` anywhere between the face and the document. The builder
     preview legitimately scales its own copy of this component; this route must not, and a
     transformed ancestor is the one way to shrink the symbol without changing its layout box. */
  const scaled = await face.evaluate((node) => {
    const found: string[] = [];
    let el: Element | null = node;
    while (el !== null && el !== document.documentElement) {
      const style = getComputedStyle(el);
      if (style.transform !== "none" || style.scale !== "none" || style.zoom !== "1") {
        found.push(
          `${el.tagName.toLowerCase()}[${el.getAttribute("data-wallet-pass") === null ? el.className : "data-wallet-pass"}] ` +
            `transform=${style.transform} scale=${style.scale} zoom=${style.zoom}`,
        );
      }
      el = el.parentElement;
    }
    return found;
  });
  expect(scaled, "nothing between the pass and the document may scale it").toEqual([]);
});

test("no part of the wallet block covers the QR plate (E-24's local guard)", async ({ page }) => {
  await gotoReady(page, CARD);

  /* ⚠ Trap 1 from `tests/helpers/qr-surface.ts`, and it bit this test on the first run.
     §6.1 R-12 puts a `loading.tsx` — a Suspense boundary — on this route, so the shell flushes
     first and the card arrives later in the stream. `gotoReady` waits out the *streamed reveal*,
     which is a different thing: it proves no duplicate segment is attached, not that the segment
     has arrived. A `page.evaluate` as the first act therefore reads the skeleton and throws "no
     plate or no wallet block". An auto-retrying `expect` would have hidden it, which is exactly
     why the failure presents as a flake. Wait on the thing that gets measured. */
  await page.locator("[data-qr-plate]").waitFor({ state: "visible" });

  const offenders = await page.evaluate(() => {
    const plate = document.querySelector("[data-qr-plate]");
    const block = document.querySelector("[data-wallet-pass]");
    if (plate === null || block === null) throw new Error("no plate or no wallet block");

    const region = plate.getBoundingClientRect();
    const hits: string[] = [];
    for (const el of Array.from(block.querySelectorAll("*"))) {
      // Ancestors of the plate and the plate's own subtree are the region, not intruders.
      if (el === plate || el.contains(plate) || plate.contains(el)) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (
        box.left < region.right &&
        region.left < box.right &&
        box.top < region.bottom &&
        region.top < box.bottom
      ) {
        hits.push(el.tagName.toLowerCase() + " " + el.className);
      }
    }
    return hits;
  });

  expect(offenders, "a wallet control is painted over the QR").toEqual([]);
});

test("a zero-field card still has a pass and a link", async ({ page }) => {
  await gotoReady(page, EMPTY_CARD);

  /* `canBuildVcf` gates the `.vcf` and nothing else. A card that maps no fields still has a
     slug, still resolves, and its QR still decodes (QR-T5 asserts that for this exact card) —
     so the pass is still a pointer to it. Gating the block on emptiness would have invented a
     second meaning for the word on the one screen that keeps it to a single definition. */
  await expect(page.locator("[data-wallet-pass]")).toHaveCount(1);
  await expect(page.locator('[data-card-root][data-render-mode="full"]')).toHaveCount(1);

  /* ⚠ The link, read from the metadata block rather than from the wallet block's prose. That
     sentence printed the URL a second time and was removed as clutter; the assertion moved to
     the copy that was always the real one — a link a reader can tap to check what the QR
     opens. Its href rather than its text, and `/c/` rather than a pinned slug: the token is
     minted per environment, so a literal would be asserting about the fixture and not about
     the product. */
  await expect(page.locator("[data-card-link-open]")).toHaveAttribute("href", /\/c\/.+/);
});

/* ── E-01 / AC-36: the card that shares nothing ───────────────────────────────────── */

test("a zero-field card offers no .vcf at all and says why (E-01, AC-36)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await gotoReady(page, EMPTY_CARD);

  // The card still renders name-only, so the consequence is visible rather than hidden.
  await expect(page.locator('[data-card-root][data-render-mode="full"]')).toHaveCount(1);

  /* The consequence, in the send block, before the owner sends — and the fix one tap away. The
     meter that used to say this is gone from the page (2026-09-28). */
  await expect(page.locator("[data-share-empty-note]")).toBeVisible();
  await expect(page.locator("[data-share-add-fields]")).toHaveAttribute(
    "href",
    "/cards/card_empty_demo/edit",
  );

  // Nothing threw: `buildVcf` was never called.
  expect(errors).toEqual([]);
});

/* ── E-43: two fast taps on Export ────────────────────────────────────────────────── */

test("tapping Export twice quickly downloads exactly one file (E-43)", async ({ page }) => {
  await gotoReady(page, CARD);

  const downloads: string[] = [];
  page.on("download", (download) => {
    downloads.push(download.suggestedFilename());
  });

  const button = page.locator("[data-export-png]");

  // Record the busy state as it happens rather than polling for it afterwards: a fast
  // raster could clear `aria-busy` between the click and the first poll, and a busy flag
  // that is real but missed would look exactly like E-43 being broken.
  await button.evaluate((node) => {
    const bag = window as unknown as { __cbSawBusy?: boolean };
    bag.__cbSawBusy = node.getAttribute("aria-busy") === "true";
    new MutationObserver(() => {
      if (node.getAttribute("aria-busy") === "true") bag.__cbSawBusy = true;
    }).observe(node, { attributes: true, attributeFilter: ["aria-busy"] });
  });

  // Two taps inside one frame — a thumb on a phone, which is how E-43 is actually reached.
  // `dispatchEvent` skips actionability on purpose: waiting for the control to be clickable
  // would let React re-render between the taps and the race would never happen.
  await button.dispatchEvent("click");
  await button.dispatchEvent("click");

  // Busy **while the first raster is still running** — the assertion that catches a dropped
  // `isExportInFlight()` guard. Without it the second call reaches `exportCardPng`, is
  // rejected with `ExportBusyError`, and its own `finally` clears the busy flag a microtask
  // later while the first export is still going.
  //
  // ⚠ It is read from the observer installed above, **not** from a live attribute poll, and
  // the difference is not fussiness. The busy window is exactly the raster's lifetime —
  // `ExportPngButton` clears the flag in `finally` and nothing holds it open — and on a warm
  // production build that raster is ~75 ms. A poll can only start after both `dispatchEvent`
  // calls have round-tripped to the browser, by which time `setBusy(false)` has already run,
  // so it reads `null` for its whole timeout however long that timeout is. That is the exact
  // failure recorded at vp-768 and vp-1440: the trace has the first tap at t+0, the control
  // carrying `aria-busy="true"` at both dispatches, the one `download` event at t+75.3 ms,
  // and this expectation's first sample at t+78.2 ms — 24 polls, all `null`, one file. A
  // longer poll cannot recover a state that has already ended; the observer never misses it.
  await expect
    .poll(
      () => page.evaluate(() => (window as unknown as { __cbSawBusy?: boolean }).__cbSawBusy),
      { message: "the export control never announced itself busy" },
    )
    .toBe(true);

  await expect
    .poll(() => downloads.length, { timeout: 20_000, message: "waiting for the one export" })
    .toBe(1);

  // `exportFileName` is the card's NAME, slugged — "Work" here.
  expect(downloads).toEqual(["contact-book-work.png"]);

  // The control announced itself busy while the first raster ran (E-43).
  const sawBusy = await page.evaluate(
    () => (window as unknown as { __cbSawBusy?: boolean }).__cbSawBusy === true,
  );
  expect(sawBusy).toBe(true);

  // E-44's other half: the spinner is always cleared, success included.
  await expect(button).not.toHaveAttribute("aria-busy", "true");

  // A double tap is **not** a failure. `ExportBusyError` is deliberately not an
  // `ExportFailedError`, so a handler narrowing on `isExportFailedError` shows nothing —
  // and a handler that caught everything would put a red toast in front of a user whose
  // only mistake was tapping twice.
  await expect(page.locator("[data-overlay-toast]")).toHaveCount(0);

  // And a second tap after it settles produces a second file — the guard is a lock, not a
  // one-shot.
  await button.click();
  await expect.poll(() => downloads.length, { timeout: 20_000 }).toBe(2);
});

/* ── E-44: a forced export failure ────────────────────────────────────────────────── */

/**
 * Make the next export fail, deterministically, without a product hook.
 *
 * `exportCardPng` awaits `document.fonts.ready` after mounting the offscreen card and turns
 * a rejection into `ExportFailedError { reason: 'font-not-loaded' }`. Replacing `document.fonts`
 * *after* the page has settled reaches exactly that branch and nothing else — the page is
 * already rendered, so no layout depends on the replacement.
 */
async function breakFontLoading(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        status: "loading",
        get ready() {
          return Promise.reject(new Error("font loading failed"));
        },
      },
    });
  });
}

test("a failed export shows a retry toast and always clears the spinner (E-44)", async ({
  page,
}) => {
  await gotoReady(page, CARD);
  await breakFontLoading(page);

  const button = page.locator("[data-export-png]");
  await button.click();

  const toast = page.locator("[data-overlay-toast]");
  await expect(toast).toBeVisible();
  await expect(toast).toHaveAttribute("data-tone", "danger");
  await expect(toast).toContainText("We couldn't save that image");
  await expect(toast.getByRole("button", { name: "Try again" })).toBeVisible();

  // The whole point of E-44: the control comes back, it does not spin forever.
  await expect(button).not.toHaveAttribute("aria-busy", "true");
  await expect(button).toBeEnabled();

  // The card is untouched by the failure.
  await expect(page.locator('[data-card-root][data-render-mode="full"]')).toHaveCount(1);

  // No raw error text on the surface (§6.10, §13.1).
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/ExportFailedError|\.tsx?:\d+/);
});

/* ── the delete dialog (§5.5, E-50) ───────────────────────────────────────────────── */

test("the delete dialog is destructive, states the consequence, and confirms inline", async ({
  page,
}) => {
  await gotoReady(page, CARD);

  await page.locator('[data-card-detail-action="delete"]').click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Delete");
  // E-41's slot, used here for a card's blast radius: the link stops working, in words.
  /* The blast radius is the people holding a link (archiving revokes every one), so the line
     names them — or says nobody's link stops working. It used to print the card's URL. */
  await expect(dialog.locator("[data-confirm-consequence]")).toContainText(
    /links? stop (working|opening)/,
  );

  const confirm = dialog.getByRole("button", { name: "Delete card" });
  await expect(confirm).toHaveAttribute("data-variant", "destructive");

  // Focus starts on the safe choice, not one stray Enter from the irreversible one.
  await expect(dialog.getByRole("button", { name: "Keep card" })).toBeFocused();

  await confirm.click();

  // §8D.1: a destructive action is confirmed inline, never by a toast with no Undo.
  await expect(page.locator("[data-card-deleted]")).toBeVisible();
  await expect(page.locator("[data-card-deleted]")).toContainText("Work");
  await expect(page.locator("[data-card-root]")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Go to cards" })).toHaveAttribute("href", "/cards");
});

test("Escape closes the delete dialog and returns focus to the trigger (E-50)", async ({
  page,
}) => {
  await gotoReady(page, CARD);

  const trigger = page.locator('[data-card-detail-action="delete"]');
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Asserted rather than assumed — the whole reason E-50 is a row in §11.
  await expect(trigger).toBeFocused();
  // The card is still here: Escape cancels, it does not confirm.
  await expect(page.locator("[data-card-root]")).toHaveCount(1);
  await expect(page.locator("[data-card-deleted]")).toHaveCount(0);
});

/* ── E-36: an id that does not resolve ────────────────────────────────────────────── */

test("an unknown cardId renders the not-found panel, not an empty state (E-36)", async ({
  page,
}) => {
  const response = await gotoReady(page, UNKNOWN_CARD);

  // The status is 200 and that is Next's documented behaviour, not a defect of this page:
  // §6.1 R-12 requires a `loading.tsx`, a `loading.tsx` **is** a Suspense boundary, and the
  // page is `async` — so the shell, response headers included, is already flushed before
  // `notFound()` runs. "When streaming, a `200` status code will be returned … the status
  // code of the response cannot be updated"
  // (`next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`). Next's stated
  // contract for exactly this case is the injected `noindex`, asserted below. Do not "fix"
  // this into `expect(status).toBe(404)`: §11 E-36 asks for the panel, never a raw 404.
  const servedHtml = (await response?.text()) ?? "";
  expect(servedHtml).toContain('<meta name="robots" content="noindex"');

  await expect(page.locator("[data-not-found-panel]")).toHaveCount(1);
  await expect(page.getByText("We couldn't find that card")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to cards" })).toHaveAttribute("href", "/cards");

  // Not an empty state, and not a raw 404.
  await expect(page.locator('[data-screen-state="empty"]')).toHaveCount(0);
  await expect(page.locator("[data-empty-state]")).toHaveCount(0);
  await expect(page.locator("[data-card-root]")).toHaveCount(0);

  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/\b404\b/);
  expect(text).not.toMatch(/\.tsx?:\d+/);
  await expect(page.locator("pre")).toHaveCount(0);

  // The shell survives: a bad id costs the reader the card, never their navigation.
  await expect(page.locator("[data-app-shell]")).toHaveCount(1);
});

/* ── §6.3 / AC-24: the state switch ───────────────────────────────────────────────── */

for (const state of STATE_QUERIES) {
  test(`?state=${state} sets data-screen-state (AC-24)`, async ({ page }) => {
    await gotoReady(page, withState(CARD, state));

    const root = page.locator("[data-card-detail]");
    await expect(root).toHaveAttribute("data-screen-state", state);

    if (state === "loading") {
      await expect(page.locator("[data-loading-skeleton]")).toHaveCount(1);
      await expect(page.locator("[data-card-root]")).toHaveCount(0);
    }
    if (state === "error" || state === "offline") {
      await expect(page.locator('[data-error-panel="page"]')).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      await expect(page.locator("[data-card-root]")).toHaveCount(0);
    }
    if (state === "empty") {
      // §8D.3's "empty" for this screen is a card that shares nothing: `?state=empty`
      // empties the profile the card filters (E-08), so the same card resolves to zero
      // fields and the `.vcf` becomes unreachable.
      await expect(page.locator('[data-card-root][data-render-mode="full"]')).toHaveCount(1);
      await expect(page.locator("[data-share-empty-note]")).toBeVisible();
    }
    if (state === "success") {
      await expect(page.locator("[data-field-list]")).toHaveCount(1);
    }
  });
}

test("an unrecognised ?state= falls back to success (E-34)", async ({ page }) => {
  await gotoReady(page, `${CARD}?state=banana`);

  await expect(page.locator("[data-card-detail]")).toHaveAttribute(
    "data-screen-state",
    "success",
  );
  await expect(page.locator("[data-field-list]")).toHaveCount(1);
});

/* ── layout robustness ───────────────────────────────────────────────────────────── */

test("the screen never scrolls sideways (E-15, E-53)", async ({ page }) => {
  await gotoReady(page, FINANCIAL_CARD);

  /* Polled rather than sampled once.
   *
   * The claim is about the SETTLED layout, and a single `page.evaluate()` immediately after
   * navigation samples whatever the frame happened to be mid-paint. Under the full parallel run
   * (five workers against one dev server) that read intermittently caught a transient wider
   * layout at 360 and failed, while passing 75/75 when the file ran alone — the classic shape of
   * an assertion racing its own page rather than finding a defect.
   *
   * Polling keeps the assertion exactly as strict and makes it mean what it says. */
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const root = document.querySelector("[data-card-root]") as HTMLElement | null;
          if (root === null) return null;
          return {
            card: root.scrollWidth - root.clientWidth,
            document:
              document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        }),
      { message: "the card and the document must both settle without sideways overflow" },
    )
    .toEqual({ card: 0, document: 0 });
});
