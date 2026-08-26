import { expect, test } from "@playwright/test";

import { TEMPLATE_PALETTES } from "@/card/template-palettes";

import { PROJECT_VIEWPORT, gotoReady } from "../helpers/e2e";
import { STATE_QUERIES, withState } from "../helpers/routes";

/** `#5B1626` → `rgb(91, 22, 38)`, which is the form `getComputedStyle` reports. */
function rgbOf(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * `/c/[slug]` — **the screen the whole product exists for** (spec §8D.5, plan T18).
 *
 * A stranger points a phone camera at a QR code and arrives here with no session, no
 * stored state and no assumptions. Everything below is written from that position: the
 * page is addressed by a slug in the URL and nothing else.
 *
 * ## What this file is responsible for, and what it deliberately is not
 * It owns the **five contracts of the page**: exactly two actions and no more (AC-20),
 * masking with no reveal (AC-33), the zero-field card that offers no Save at all
 * (E-02 / AC-36), the unknown slug that lands on a panel rather than a raw 404 (E-37),
 * and the missing `PHONE` that removes the secondary action rather than disabling it
 * (E-56).
 *
 * It does **not** decode a QR, and as of the share-face migration there is no QR on this page
 * to decode: `<CardPage>` renders none, deliberately (see the head of `src/card/card-page.tsx`).
 * QR-T5 in `qr-scannability.spec.ts` decodes the face at `/cards/{id}` for every template ×
 * every viewport. What this file owns is the **absence**, asserted in the first test below.
 *
 * Every navigation goes through `gotoReady` so animations are dead and `document.fonts`
 * has settled before anything is measured (§14.6, R-10).
 */

/** The §6.7 worked card: Ledger, five mapped fields, one of them a `PHONE`. */
const CARD_WITH_PHONE = "/c/prya-hq";

/** Terminal. Four links and a `CUSTOM`, and deliberately **no** `PHONE` (E-56). */
const CARD_WITHOUT_PHONE = "/c/prya-dev";

/** `card_empty_demo` — zero mapped fields. The 73-byte `.vcf` bug, made addressable (E-02). */
const CARD_WITH_NO_FIELDS = "/c/prya-blank";

/** Atrium. `BANK_ACCOUNT` + `DIGITAL_WALLET` + `CRYPTO_WALLET` — the masking card (AC-33). */
const CARD_WITH_FINANCIALS = "/c/prya-pay";

/** Almanac. Carries the `LOCATION_TRACKING` field, which may never render a coordinate. */
const CARD_WITH_LOCATION = "/c/prya-notes";

/**
 * `card_iris_demo` — **Periwinkle** on the **Marigold** template, whose default is **Amber**.
 * The one fixture where "the card's colour" and "the template's colour" disagree, which is what
 * makes the palette assertion below able to fail.
 */
const CARD_WITH_TEMPLATE_DEFAULT_OVERRIDDEN = "/c/prya-stage";

const UNKNOWN_SLUG = "/c/no-such-card";

/* ── the card itself ─────────────────────────────────────────────────────────────── */

/**
 * ⚠ **This used to assert "exactly one QR zone". It now asserts none, and that is the change.**
 *
 * `<CardPage>` carried a `<QrZone>` at its foot on the argument that a scanned card is also a
 * re-shareable card. It is not: whoever is reading this page already has the card open, so that
 * symbol encoded the URL of the page they were on. The QR lives on the **share face** — the
 * object that actually gets handed over — and the whole QR contract suite measures it there, at
 * `/cards/{id}`. See the head of `src/card/card-page.tsx` and `tests/helpers/qr-surface.ts`.
 *
 * The assertion is kept rather than deleted, and inverted rather than loosened, because "no QR
 * here" is now a property of this screen that someone could plausibly undo. `toHaveCount(0)` on
 * all three hooks is what makes putting one back a red test rather than a silent regression.
 */
test("renders exactly one full card and no QR at all (AC-11)", async ({ page }) => {
  await gotoReady(page, CARD_WITH_PHONE);

  await expect(page.locator("[data-card-root]")).toHaveCount(1);
  await expect(page.locator('[data-card-root][data-render-mode="full"]')).toHaveCount(1);

  await expect(
    page.locator("[data-qr-zone]"),
    "the scan destination must not carry a QR pointing at itself",
  ).toHaveCount(0);
  await expect(page.locator("[data-qr-symbol]")).toHaveCount(0);
  await expect(page.locator("[data-qr-glyph]")).toHaveCount(0);

  // And the page still ends with the owner's fields, which is what a scan is for.
  await expect(page.locator("[data-card-fields]")).toHaveAttribute("data-field-count", "5");
});

/* ── the stack: one tappable button per field the owner added ────────────────────── */

/**
 * The five fields of `/c/prya-hq`, and what each of them must become.
 *
 * Written out rather than derived so the expectation is readable as a *design decision*: a
 * destination is a button, everything else is quiet text, and a button wears the owner's
 * label and never their data. Deriving these from `FIELD_RENDERERS` would make the test pass
 * by construction and prove nothing about the page.
 */
const HQ_ROWS = [
  { id: "field_work_phone", kind: "action", label: "Work mobile", href: "tel:+919820115577" },
  { id: "field_job_title", kind: "note", label: "Role", text: "Head of Partnerships" },
  { id: "field_company", kind: "note", label: "Company", text: "Fernwood Studio" },
  {
    id: "field_work_email",
    kind: "action",
    label: "Work email",
    href: "mailto:priyanka@fernwood.example",
  },
  { id: "field_site_url", kind: "action", label: "Website", href: "https://fernwood.example" },
] as const;

/**
 * ⚠ **The card page is a link-in-bio page now, and this is the assertion that says so.**
 *
 * It used to render a `<dl>` of `LABEL / value` rows. It renders a stack of full-width
 * buttons: the Contact Book mark, the identity, then one control per field with somewhere to
 * go. The two claims worth pinning are that **the destination is right** and that **the value
 * is not printed on the button** — the card says "Work email", not the address, because the
 * action is what the button does. `toHaveText` is exact, so putting the value back is a red
 * test rather than a matter of taste.
 */
test("renders one tappable button per actionable field, labelled and not valued", async ({
  page,
}) => {
  await gotoReady(page, CARD_WITH_PHONE);

  for (const expected of HQ_ROWS) {
    const row = page.locator(`[data-card-field="${expected.id}"]`);
    await expect(row).toHaveAttribute("data-card-row-kind", expected.kind);

    if (expected.kind !== "action") continue;

    const button = row.locator(`[data-card-action-button="${expected.id}"]`);
    await expect(button).toHaveCount(1);
    await expect(button).toHaveAttribute("href", expected.href);
    /* The label, exactly — no address, no phone number, no URL. */
    await expect(button).toHaveText(expected.label);
    /* …and the value still reaches a screen reader, where it costs no pixels. */
    await expect(button).toHaveAttribute("aria-label", new RegExp(`^${expected.label}: .+`));
  }

  /* `https:` leaves the app; `tel:` and `mailto:` hand off to the phone. Only the first needs
     the opener guard, and it must have it (AC-32). */
  const external = page.locator('[data-card-action-button="field_site_url"]');
  await expect(external).toHaveAttribute("target", "_blank");
  await expect(external).toHaveAttribute("rel", "noopener noreferrer");
  const local = page.locator('[data-card-action-button="field_work_phone"]');
  /* Absent, not empty: `target="_blank"` on a `tel:` opens a blank tab beside the dialler. */
  expect(await local.getAttribute("target")).toBeNull();
  expect(await local.getAttribute("rel")).toBeNull();
});

/**
 * A stack in which everything is a button makes nothing look tappable.
 *
 * A job title has nowhere to go, so it is text — and text is what it must stay. A control the
 * reader presses to no effect teaches them that the three real controls above it are probably
 * dead too, which is a worse outcome than the row being quiet.
 */
test("descriptive fields render as text, never as dead controls", async ({ page }) => {
  await gotoReady(page, CARD_WITH_PHONE);

  for (const expected of HQ_ROWS.filter((row) => row.kind === "note")) {
    const row = page.locator(`[data-card-field="${expected.id}"]`);
    await expect(row.locator(`[data-card-note="${expected.id}"]`)).toHaveCount(1);
    await expect(row.locator("[data-card-field-value]")).toHaveText(expected.text);
    await expect(row.locator("a")).toHaveCount(0);
    await expect(row.locator("[data-card-action-button]")).toHaveCount(0);
  }
});

/** The mark at the head of the card — quiet, and deliberately not a second way out (§8D.5). */
test("wears the Contact Book mark above the identity block", async ({ page }) => {
  await gotoReady(page, CARD_WITH_PHONE);

  const brand = page.locator("[data-card-brand]");
  await expect(brand).toHaveCount(1);
  await expect(brand).toHaveText("Contact Book");
  await expect(brand).toBeVisible();
  await expect(page.locator("[data-card-hero] [data-card-brand]")).toHaveCount(1);
  await expect(brand.locator("a")).toHaveCount(0);

  /* Above the avatar, not beside the name. */
  const brandBox = await brand.boundingBox();
  const portraitBox = await page.locator("[data-card-portrait]").boundingBox();
  const nameBox = await page.locator("[data-card-name]").boundingBox();
  expect(brandBox && portraitBox && nameBox).toBeTruthy();
  expect((brandBox?.y ?? 0) + (brandBox?.height ?? 0)).toBeLessThanOrEqual(portraitBox?.y ?? 0);
  expect(portraitBox?.y ?? 0).toBeLessThan(nameBox?.y ?? 0);
});

/**
 * The geometry a thumb depends on, measured at whichever viewport this project runs.
 *
 * Full-width and at least 44px tall, on the 360px phone as much as on the 1440px desktop.
 * These are the numbers the old fixed-canvas build could not hold — it had about two hundred
 * pixels for the whole list — so measuring them here is measuring the fix.
 */
test("every field button is full-width and thumb-sized", async ({ page }) => {
  await gotoReady(page, CARD_WITH_PHONE);

  const stack = page.locator("[data-card-fields]");
  const stackBox = await stack.boundingBox();
  expect(stackBox).not.toBeNull();

  const buttons = page.locator("[data-card-action-button]");
  await expect(buttons).toHaveCount(3);

  for (const button of await buttons.all()) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    /* Full-width: the button fills its column to the pixel, so no row is narrower than
       another and the stack reads as one object. */
    expect(Math.abs((box?.width ?? 0) - (stackBox?.width ?? 0))).toBeLessThanOrEqual(1);
  }
});

test("renders the card's own templateId, not a default", async ({ page }) => {
  await gotoReady(page, CARD_WITH_PHONE);
  await expect(page.locator("[data-card-root]")).toHaveAttribute("data-template-id", "meridian");

  await gotoReady(page, CARD_WITH_LOCATION);
  await expect(page.locator("[data-card-root]")).toHaveAttribute("data-template-id", "marigold");
});

test("renders the card in the product's single typeface", async ({ page }) => {
  /* This asserted that `--font-archivo` and `--font-bricolage` were opted in on this route,
     because the old design gave four templates four different typefaces and route-scoped the
     two card-only ones to keep them off `/` and `(auth)`.
     
     There is one family now — Geist, variable 100–900 — loaded once in the root layout, so
     weight carries the hierarchy that a second and third family used to. Nothing to opt into,
     and `[data-card-fonts]` no longer exists. What is still worth asserting is that the card
     actually resolves that family rather than falling through to a system stack. */
  await gotoReady(page, CARD_WITH_PHONE);

  const family = await page
    .locator("[data-card-root] [data-card-name]")
    .evaluate((node) => getComputedStyle(node).fontFamily);

  expect(family.toLowerCase()).toContain("geist");
});

/* ── the two actions, and exactly two (§8A.2, §6.9, AC-20) ───────────────────────── */

test("renders exactly two action buttons when a PHONE is mapped (AC-20)", async ({ page }) => {
  await gotoReady(page, CARD_WITH_PHONE);

  await expect(page.locator("[data-card-action]")).toHaveCount(2);
  await expect(page.locator("[data-card-actions]")).toHaveAttribute("data-card-action-count", "2");
  await expect(page.locator('[data-card-action="save"]')).toHaveCount(1);
  await expect(page.locator('[data-card-action="whatsapp"]')).toHaveCount(1);

  // §6.9: the secondary is a wa.me deep link that leaves the app safely (§7.3, AC-32).
  const whatsapp = page.locator('[data-card-action="whatsapp"]');
  await expect(whatsapp).toHaveAttribute("href", "https://wa.me/919820115577");
  await expect(whatsapp).toHaveAttribute("target", "_blank");
  await expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
});

/**
 * ⚠ **Migrated from `builder.spec.ts`, where it could no longer run.**
 *
 * The builder used to preview the scan page and this claim was asserted on the *inert* copy of
 * its Save button: **the actions follow the card's own palette, not its template's default.**
 * That was a real defect — three call sites once read `resolved.template.paletteId`, leaving an
 * Oxblood card wearing Sapphire buttons — and the builder no longer previews the page, so the
 * assertion comes here, to the real buttons on the real surface.
 *
 * `card_iris_demo` (`/c/prya-stage`) is the fixture that makes it provable: **Periwinkle** on the
 * **Marigold** template, whose own default is **Amber**. A component reading the template would
 * paint Amber and fail; one reading `resolved.palette.id` paints Periwinkle.
 *
 * Both templates are `pageHeader: "band"`, so the body is the app canvas and the buttons use the
 * palette's `canvasActionBg` — the same surface the builder's copy used, read from
 * `TEMPLATE_PALETTES` rather than from a hand-written rgb triple so a re-tune moves the test
 * instead of breaking it.
 */
test("the card's own palette, not the template's default, paints the actions", async ({ page }) => {
  await gotoReady(page, CARD_WITH_TEMPLATE_DEFAULT_OVERRIDDEN);

  await expect(page.locator("[data-card-root]")).toHaveAttribute("data-template-id", "marigold");
  await expect(page.locator("[data-card-root]")).toHaveAttribute("data-palette-id", "periwinkle");

  const fill = await page
    .locator('[data-card-action="save"]')
    .evaluate((node) => getComputedStyle(node).backgroundColor);

  expect(fill).toBe(rgbOf(TEMPLATE_PALETTES.periwinkle.canvasActionBg));
  expect(fill, "the Marigold default must not have won").not.toBe(
    rgbOf(TEMPLATE_PALETTES.amber.canvasActionBg),
  );
});

test("Save to contacts downloads a vCard named after the contact (§6.9)", async ({ page }) => {
  await gotoReady(page, CARD_WITH_PHONE);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('[data-card-action="save"]').click(),
  ]);

  expect(download.suggestedFilename()).toBe("Priyanka Raghunathan.vcf");
});

test("omits the WhatsApp action entirely when no PHONE is mapped (E-56)", async ({ page }) => {
  await gotoReady(page, CARD_WITHOUT_PHONE);

  await expect(page.locator("[data-card-action]")).toHaveCount(1);
  await expect(page.locator('[data-card-action="save"]')).toHaveCount(1);
  // Absent from the DOM, never rendered-and-disabled.
  await expect(page.locator('[data-card-action="whatsapp"]')).toHaveCount(0);
  await expect(page.getByText("Message on WhatsApp")).toHaveCount(0);
});

/* ── E-02 / AC-36: the card that shares nothing ──────────────────────────────────── */

test("renders no Save to contacts button at all on a zero-field card (E-02, AC-36)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await gotoReady(page, CARD_WITH_NO_FIELDS);

  // The card still renders — name and hero — so the consequence is visible rather than hidden.
  // It used to say "name + QR"; the QR moved to the share face (see the AC-11 test above), so
  // what proves the card was not swapped for an empty state is the card root and the name.
  await expect(page.locator('[data-card-root][data-render-mode="full"]')).toHaveCount(1);
  await expect(page.locator("[data-card-name]")).toHaveText("Priyanka Raghunathan");
  await expect(page.locator("[data-qr-symbol]")).toHaveCount(0);
  // The mark and the identity survive; the stack is absent rather than an empty container,
  // so the page ends after the identity instead of holding a gap where rows would be.
  await expect(page.locator("[data-card-brand]")).toHaveCount(1);
  await expect(page.locator("[data-card-fields]")).toHaveCount(0);
  await expect(page.locator("[data-card-action-button]")).toHaveCount(0);

  // Not disabled — absent. `buildVcf` throws `EmptyCardError`, so a rendered button would
  // be a crash waiting to happen and the 73-byte name-only `.vcf` would be reachable.
  await expect(page.locator('[data-card-action="save"]')).toHaveCount(0);
  await expect(page.locator("[data-card-action]")).toHaveCount(0);
  await expect(page.locator("[data-card-actions]")).toHaveAttribute("data-card-action-count", "0");
  await expect(page.getByText("Save to contacts")).toHaveCount(0);

  await expect(page.locator("[data-public-card-empty-note]")).toHaveText(
    "This card doesn't share any details yet.",
  );

  // Nothing threw: `buildVcf` was never reached.
  expect(errors).toEqual([]);
});

test("the zero-field card reports the empty state family (§8D.5, AC-24)", async ({ page }) => {
  await gotoReady(page, CARD_WITH_NO_FIELDS);

  // ── kept deliberately: a real assertion, no longer the only barrier ───────────────────
  // `[data-screen-state]` is legitimately ambiguous for a moment on `/c/[slug]`. §6.1 R-18
  // requires a `loading.tsx`, a `loading.tsx` *is* a Suspense fallback, and that fallback
  // carries `data-screen-state="loading"` of its own (§13.2) — so one streamed response
  // really does hold **two** roots until React swaps the fallback for the resolved view:
  //
  //   $ curl -s 'http://localhost:3100/c/prya-hq?state=banana' \
  //       | grep -o 'data-screen-state="[a-z]*"' | sort | uniq -c
  //      1 data-screen-state="loading"
  //      1 data-screen-state="success"
  //
  // This line was written as the *synchronisation point* for that swap, because `gotoReady`
  // used to navigate with `waitUntil: 'load'` and stop — and `load` fires on the shell,
  // inside React's ~300 ms reveal throttle. `gotoReady` now waits the reveal out itself
  // (`waitForStreamedReveal`, D14), so the race is closed for the whole suite and this is no
  // longer load-bearing for timing. **It stays anyway, unchanged**: it is also the claim that
  // the route serves *exactly one* root, and that is the check a genuine product duplicate —
  // which would live inside the revealed markup and survive the settle — would have to fail.
  // Removing it would delete that claim, not a workaround.
  await expect(page.locator("[data-screen-state]")).toHaveCount(1);

  await expect(page.locator("[data-screen-state]")).toHaveAttribute("data-screen-state", "empty");
});

/* ── AC-33: masking, and no reveal control anywhere on this page ─────────────────── */

test("masks financial values and offers no reveal control (AC-33)", async ({ page }) => {
  await gotoReady(page, CARD_WITH_FINANCIALS);

  const masked = page.locator("[data-card-field-masked]");
  await expect(masked).toHaveCount(3);

  const bank = page.locator('[data-card-field="field_bank"]');
  await expect(bank.locator("[data-card-field-value]")).toContainText("••••");
  await expect(bank.locator("[data-card-field-value]")).toContainText("5678");

  // The raw account number appears nowhere in the served DOM — not as text, not in a
  // `title`, not in an `href`.
  const html = await page.content();
  expect(html).not.toContain("50100412345678");
  expect(html).not.toContain("0x8f2A55949038A501f5B7C0e1B4d8b9C3A2e4d612");

  // A masked row surrenders its link (§7.3) …
  await expect(bank.locator("a")).toHaveCount(0);
  // … and never becomes one of the stack's buttons, however tappable the rest of the page
  // looks. Only the work phone on this card has anywhere to go.
  await expect(masked.locator("[data-card-action-button]")).toHaveCount(0);
  await expect(page.locator("[data-card-action-button]")).toHaveCount(1);
  await expect(page.locator('[data-card-action-button="field_work_phone"]')).toHaveCount(1);
  // … and there is no reveal affordance of any kind on a public card.
  const card = page.locator("[data-card-root]");
  await expect(card.getByRole("button", { name: /reveal|show|unmask|unhide/i })).toHaveCount(0);
  await expect(card.getByRole("switch")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /reveal|show|unmask|unhide/i })).toHaveCount(0);

  // Only the two action buttons are interactive inside the card (AC-20 again, from the
  // other direction: a reveal control would show up as a third).
  await expect(card.locator("button")).toHaveCount(1);
});

test("renders no coordinate for LOCATION_TRACKING (AC-33)", async ({ page }) => {
  await gotoReady(page, CARD_WITH_LOCATION);

  const location = page.locator('[data-card-field="field_location"]');
  await expect(location).toHaveCount(1);
  await expect(location).toContainText("Sharing with saved contacts");

  // No decimal-degree pair anywhere on the page.
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/);
});

/* ── §8D.5: no app chrome, and the desktop caption ───────────────────────────────── */

test("renders no app chrome and no marketing nav", async ({ page }) => {
  await gotoReady(page, CARD_WITH_PHONE);

  await expect(page.locator("[data-app-shell]")).toHaveCount(0);
  await expect(page.locator("[data-app-sidebar]")).toHaveCount(0);
  await expect(page.locator("[data-app-bottom-bar]")).toHaveCount(0);
  await expect(page.locator("[data-pill-nav]")).toHaveCount(0);
  await expect(page.locator("nav")).toHaveCount(0);
});

test("shows the made-with caption only from 768px up (§8D.5)", async ({ page }, testInfo) => {
  const viewport = PROJECT_VIEWPORT[testInfo.project.name];
  await gotoReady(page, CARD_WITH_PHONE);

  const caption = page.locator("[data-public-card-made-with]");
  await expect(caption).toHaveCount(1);

  if (viewport >= 768) {
    await expect(caption).toBeVisible();
    await expect(caption.locator("a")).toHaveAttribute("href", "/");
  } else {
    await expect(caption).toBeHidden();
  }
});

test("the card never scrolls sideways (E-15, E-53)", async ({ page }) => {
  await gotoReady(page, CARD_WITH_FINANCIALS);

  const overflow = await page.evaluate(() => {
    const root = document.querySelector("[data-card-root]") as HTMLElement | null;
    if (root === null) throw new Error("no card root");
    return {
      card: root.scrollWidth - root.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(overflow.card).toBeLessThanOrEqual(0);
  expect(overflow.document).toBeLessThanOrEqual(0);
});

/* ── E-37: an unknown slug is a panel, never a raw 404 ───────────────────────────── */

test("renders the not-found panel for an unknown slug (E-37)", async ({ page }) => {
  const response = await gotoReady(page, UNKNOWN_SLUG);

  // The status here is 200, not 404, and that is Next's documented behaviour rather than a
  // defect of this page. §6.1 R-18's `loading.tsx` is a Suspense boundary, so the shell —
  // response headers included — is already flushed by the time `notFound()` runs: "When
  // streaming, a `200` status code will be returned … the status code of the response
  // cannot be updated"
  // (`next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md:103`). Next's
  // stated contract for exactly this case is the `noindex` tag in the streamed HTML (ibid.
  // :107) — the crawler's half of E-37, and the half that keeps a dead card out of search
  // results. Assert that, and do not "fix" this back into `expect(status).toBe(404)`: no
  // edit to `page.tsx` can make a status assertion pass while `loading.tsx` exists, and
  // §11 E-37 asks for the panel, never a raw 404, in the first place.
  const servedHtml = (await response?.text()) ?? "";
  expect(servedHtml).toContain('<meta name="robots" content="noindex"');
  await expect(page.locator("[data-not-found-panel]")).toHaveCount(1);
  await expect(page.getByText("This card doesn't exist or was removed")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");

  // A panel, not a stack trace and not a status code as a headline (§6.10).
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/\b404\b/);
  expect(text).not.toMatch(/\.tsx?:\d+/);
  await expect(page.locator("pre")).toHaveCount(0);
  await expect(page.locator("[data-card-root]")).toHaveCount(0);
});

/* ── §6.3 / AC-24: the state switch ──────────────────────────────────────────────── */

for (const state of STATE_QUERIES) {
  test(`?state=${state} sets data-screen-state (AC-24)`, async ({ page }) => {
    await gotoReady(page, withState(CARD_WITH_PHONE, state));

    const root = page.locator("[data-screen-state]");
    await expect(root).toHaveCount(1);

    // `empty` on this screen means "this card shares nothing" (§8D.5), which is what an
    // empty profile produces: the card still renders, with no Save button.
    await expect(root).toHaveAttribute("data-screen-state", state);

    if (state === "loading") {
      await expect(page.locator("[data-loading-skeleton]")).toHaveCount(1);
      await expect(page.locator("[data-card-root]")).toHaveCount(0);
    }
    if (state === "error" || state === "offline") {
      await expect(page.locator('[data-error-panel="page"]')).toHaveCount(1);
      await expect(page.getByRole("link", { name: "Go home" })).toBeVisible();
      await expect(page.locator("[data-card-root]")).toHaveCount(0);
    }
    if (state === "empty") {
      await expect(page.locator('[data-card-root][data-render-mode="full"]')).toHaveCount(1);
      await expect(page.locator('[data-card-action="save"]')).toHaveCount(0);
      await expect(page.locator("[data-public-card-empty-note]")).toHaveCount(1);
    }
    if (state === "success") {
      await expect(page.locator('[data-card-action="save"]')).toHaveCount(1);
    }
  });
}

test("an unrecognised ?state= falls back to success (E-34)", async ({ page }) => {
  await gotoReady(page, `${CARD_WITH_PHONE}?state=banana`);

  // The `loading.tsx` / resolved-view overlap again — see the long note on the zero-field
  // empty-state test above. This was W6-08: two `[data-screen-state]` roots are served and,
  // before `gotoReady` waited out React's reveal throttle, the assertion below failed roughly
  // 2 runs in 5 without this line. `gotoReady` closes that race for every spec now, so this
  // is belt-and-braces on timing — but it is still the assertion that exactly one root is
  // served, so it stays, byte for byte.
  await expect(page.locator("[data-screen-state]")).toHaveCount(1);

  await expect(page.locator("[data-screen-state]")).toHaveAttribute(
    "data-screen-state",
    "success",
  );
  await expect(page.locator("[data-card-action]")).toHaveCount(2);
});

/* ── metadata (§8D.5) ────────────────────────────────────────────────────────────── */

test("generateMetadata produces a per-card title and description", async ({ page }) => {
  await gotoReady(page, CARD_WITH_PHONE);

  await expect(page).toHaveTitle("Priyanka Raghunathan · Contact Book");

  const description = await page
    .locator('head meta[name="description"]')
    .getAttribute("content");
  expect(description).toContain("Priyanka Raghunathan");

  const ogImage = await page
    .locator('head meta[property="og:image"]')
    .first()
    .getAttribute("content");
  expect(ogImage).toContain("/c/prya-hq/opengraph-image");
});

/* ── the material system: the ground, the motion, the browser's own surfaces ─────── */

/**
 * ⚠ **THE GROUND HOLDS STILL.** The one claim in DESIGN.md that is invisible in a screenshot
 * and therefore invisible in review.
 *
 * It is a `position: fixed` painted element behind `position: relative` content —
 * deliberately **not** `background-attachment: fixed`, which iOS Safari does not implement
 * dependably and which is exactly the surface this page is read on. A future edit that
 * "simplifies" this back to a background on the card root would look identical in every static
 * screenshot in this suite and would lose the effect entirely, so the assertion is dynamic:
 * scroll the page and prove the content moved while the ground did not.
 *
 * The viewport is shortened here rather than the fixture being made longer. A five-field card
 * fits inside 900px at `vp-1440`, so the scroll this test depends on would be a no-op on one
 * of the three projects — and a scroll test that cannot scroll passes for the wrong reason.
 */
test("the ground is a fixed layer and does not move when the content scrolls", async ({
  page,
}) => {
  await gotoReady(page, CARD_WITH_PHONE);
  await page.setViewportSize({ width: page.viewportSize()?.width ?? 360, height: 420 });

  const ground = page.locator("[data-card-ground]");
  await expect(ground).toHaveCount(1);
  /* Decoration by definition: it carries no text, so it must carry no accessible presence. */
  await expect(ground).toHaveAttribute("aria-hidden", "true");

  const before = await page.evaluate(() => {
    const g = document.querySelector("[data-card-ground]") as HTMLElement;
    const n = document.querySelector("[data-card-name]") as HTMLElement;
    return {
      position: getComputedStyle(g).position,
      ground: g.getBoundingClientRect().top,
      height: Math.round(g.getBoundingClientRect().height),
      viewport: window.innerHeight,
      name: n.getBoundingClientRect().top,
      scrollable: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    };
  });

  expect(before.position).toBe("fixed");
  /* It is the viewport, not the card: `inset: 0` on a fixed element resolves against the
     initial containing block. That is what makes the content column scroll *over* it. */
  expect(before.height).toBe(before.viewport);
  expect(before.scrollable, "the page must actually be scrollable for this to prove anything")
    .toBeGreaterThan(80);

  await page.evaluate(() => window.scrollBy(0, 80));
  const after = await page.evaluate(() => ({
    ground: (document.querySelector("[data-card-ground]") as HTMLElement).getBoundingClientRect()
      .top,
    name: (document.querySelector("[data-card-name]") as HTMLElement).getBoundingClientRect().top,
    y: window.scrollY,
  }));

  expect(after.y).toBe(80);
  expect(after.name - before.name, "the content must scroll").toBe(-80);
  expect(after.ground, "the ground must not").toBe(before.ground);
});

/**
 * ⚠ **The rows' painted state is their DEFAULT, and the animation is additive.**
 *
 * `card.css` runs one authored moment on load: the stack rises, ~40ms apart, from a short
 * translate. `gotoReady` injects a stylesheet that zeroes every duration and delay with
 * `!important` before the page loads — which is what every geometry and screenshot assertion
 * in this repository depends on.
 *
 * If that entrance were ever written the usual way round — rows at `opacity: 0` until an
 * animation moves them — the harness would freeze them invisible and several hundred
 * assertions across a dozen suites would go red for a reason that has nothing to do with what
 * they test. So the keyframe only describes where a row comes FROM, and `animation-fill-mode`
 * is `backwards` rather than `forwards`. This test is that invariant, asserted under exactly
 * the conditions the harness creates.
 */
test("every row is fully painted with the animation killed", async ({ page }) => {
  await gotoReady(page, CARD_WITH_PHONE);

  const state = await page.evaluate(() =>
    [
      ...document.querySelectorAll("[data-card-fields] > li, [data-card-actions] > *"),
    ].map((el) => {
      const cs = getComputedStyle(el as HTMLElement);
      return { opacity: cs.opacity, translate: cs.translate };
    }),
  );

  expect(state.length).toBeGreaterThan(4);
  for (const row of state) {
    expect(row.opacity).toBe("1");
    expect(row.translate === "none" || row.translate === "0px").toBe(true);
  }
});

/**
 * The parts we did not draw still ship as part of the card.
 *
 * DESIGN.md calls a default scrollbar and a default underline the cheapest signal that a page
 * was assembled rather than built, so all four are stated. The scrollbar is the awkward one and
 * the reason it is worth a test: the viewport's scrollbar belongs to `documentElement`, the
 * card's colours live on the card root, and a custom property cannot travel upward — so
 * `public-card-view.tsx` lifts two resolved values onto `:root` in an effect. An effect that
 * silently stopped running would leave the OS scrollbar and nothing else would notice.
 */
test("themes the browser's own surfaces from the card's palette", async ({ page }) => {
  await gotoReady(page, CARD_WITH_FINANCIALS);

  /* ⚠ Waited for, not assumed. The scrollbar's two colours are lifted onto `documentElement`
     by a client effect — they have to be, because the viewport's scrollbar belongs to the
     document element and the card's `--c-*` properties are declared on the card root — so they
     land after hydration rather than in the server's HTML. `gotoReady` waits out React's
     streamed reveal and the fonts; it does not and should not wait for every effect. */
  await page.waitForFunction(() =>
    document.documentElement.hasAttribute("data-card-page-scroll"),
  );

  const surfaces = await page.evaluate(() => {
    const de = document.documentElement;
    const value = document.querySelector("[data-card-field-value]") as HTMLElement;
    const link = document.querySelector("[data-public-card-made-with] a") as HTMLElement;
    return {
      scrollAttr: de.getAttribute("data-card-page-scroll"),
      scrollbarWidth: getComputedStyle(de).scrollbarWidth,
      thumb: de.style.getPropertyValue("--cb-scroll-thumb"),
      track: de.style.getPropertyValue("--cb-scroll-track"),
      /* A phone number and an account number are read as data; proportional figures make the
         digits shift width under the eye. */
      numerals: getComputedStyle(value).fontVariantNumeric,
      underlineOffset: getComputedStyle(link).textUnderlineOffset,
      underlineThickness: getComputedStyle(link).textDecorationThickness,
      /* Which ground each region stands on — `card.css` keys `::selection` and the caret off
         this, because `--c-ink` is WHITE on the five deep palettes and a single ink-tinted
         selection rule would paint white on white the moment a reader dragged across the
         `banner` layout's canvas body. */
      hero: document.querySelector("[data-card-hero]")?.getAttribute("data-card-on-palette"),
      body: document.querySelector("[data-card-body]")?.getAttribute("data-card-on-palette"),
    };
  });

  expect(surfaces.scrollAttr).not.toBeNull();
  expect(surfaces.scrollbarWidth).toBe("thin");
  expect(surfaces.thumb).not.toBe("");
  /* The track is the card's own ground, read off the palette rather than guessed. */
  expect(surfaces.track).toBe(TEMPLATE_PALETTES.oxblood.ground);
  expect(surfaces.numerals).toContain("tabular-nums");
  expect(surfaces.underlineOffset).toBe("3px");
  expect(surfaces.underlineThickness).toBe("1.5px");
  /* ⚠ **Both are `true` now, and the second one changed.** With `HeaderLayout` gone there is
     one composition — the palette runs the full height and the field stack stands on it — so
     `bodyOnPalette` is no longer a thing a card can be false about. It read "false" here while
     the `band`/`banner` layout put the stack on an opaque app-canvas sheet beneath a colour
     band; that sheet is what made the ground stop where the article did. */
  expect(surfaces.hero).toBe("true");
  expect(surfaces.body).toBe("true");
});

/**
 * The composition axis, published.
 *
 * ⚠ `data-page-header` used to carry a resolved `HeaderLayout` beside the template's own legacy
 * `PageHeader`, because the two were different things and a card could override one with the
 * other. The layout axis is gone, so there is one value again and it is the template's —
 * published as metadata rather than as something the renderer branches on.
 *
 * The two axes that *are* live are published in its place. Both shipped templates are `band`.
 */
test("publishes the template's own header and the surface it resolved", async ({ page }) => {
  await gotoReady(page, CARD_WITH_PHONE);

  const root = page.locator("[data-card-root]");
  await expect(root).toHaveAttribute("data-page-header", "band");
  await expect(root).toHaveAttribute("data-finish", "gradient");
  await expect(root).toHaveAttribute("data-texture", "none");
  const ground = page.locator("[data-card-ground]");
  await expect(ground).toHaveAttribute("data-card-finish", "gradient");
  await expect(ground).toHaveAttribute("data-card-texture", "none");
});
