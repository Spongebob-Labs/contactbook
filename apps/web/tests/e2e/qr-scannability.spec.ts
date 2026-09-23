import { expect, test, type Locator } from "@playwright/test";

import { MAX_PAYLOAD_BYTES, payloadByteLength } from "@/card/qr-geometry";
import { resolveCard } from "@/card/resolve-card";
import { TEMPLATE_LIST } from "@/card/templates";
import { FIXTURE_DB } from "@/fixtures";

import { PROJECT_VIEWPORT, gotoReady, screenshotElement } from "../helpers/e2e";
import { decodeQrPng, decodeWithRetry } from "../helpers/qr-decode";
import { centreZone, gotoCardFace } from "../helpers/qr-surface";
import { signIn } from "../helpers/session";

/**
 * ⚠ REAL DEFECT, FOUND RECONCILING THIS SUITE TO THE 2026-09-20 HERO REBUILD, FIXED THE SAME DAY.
 *
 * Every decode in this file moved from the public `/c/{slug}` page to `/cards/{id}` — see the
 * module header below — and `/cards/**` is a GATED `(app)` route: `proxy.ts` redirects any
 * request with no `cb_at` cookie to `/signin/phone`. This file's rewrite moved the navigation
 * target but never added the session every sibling suite on `/cards/**` already carries
 * (`card-detail.spec.ts`, `builder.spec.ts`, `contacts.spec.ts`, `profile.spec.ts`,
 * `builder-mobile.spec.ts` — see `tests/helpers/session.ts`'s own header for why this is a
 * `beforeEach` hook and not a global `storageState`).
 *
 * Unauthenticated, `gotoCardFace` did not fail — it could not tell it had been redirected,
 * because `/signin/phone`'s own sidebar ("What you're building") renders a `[data-qr-plate]`
 * preview of its own, using the fixture's first demo card regardless of which id the URL
 * named. Every decode in this file was silently reading THAT card. Eight of the eleven tests
 * below still failed, because their expected payload is a different card's — but three did
 * not: `meridian`'s own fixture card, `payloadByteLength`'s and the port-disagreement check all
 * happen to be keyed off `CARDS[0]`, which the sidebar's demo card matches by coincidence, so
 * they passed while reading the wrong page for the wrong reason. That is a more dangerous
 * failure mode than an outright red run: three green checks that were proving nothing.
 */
test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

/**
 * **QR-T5 — the ground truth of this product** (spec §8A.6, §8A.7; AC-09(g); §11 E-25).
 *
 * ## ⚠ THE SURFACE MOVED. NOTHING WAS DROPPED.
 *
 * Every decode in this file used to be taken off `/c/{slug}`. That page carries no QR now — see
 * the head of `src/card/card-page.tsx` — so the decodes are taken off the **share face** at
 * `/cards/{id}`, which is the object a stranger's phone is actually pointed at.
 *
 * That makes this file a harder test than it was. The scan page sized its symbol from a 460px
 * content column: 193 CSS px, 386 device px at `deviceScaleFactor: 2` — comfortable. The face's
 * symbol is **141.12 CSS px**, one pixel above §8A.3's scannable floor, at 282 device px. If a
 * decode in this run is ever going to be marginal it will be marginal here, which is precisely
 * where it should be, because 141px is the size a real card is handed over at.
 *
 * The one test that could not simply be repointed is the builder-preview one; its own note
 * explains what replaced its decode and why the replacement is not weaker.
 *
 * > *"Just make sure each and every card that I am sharing with you explicitly has a QR code
 * > in it. Make sure you are making the design according to that itself. Each and every QR
 * > card should have a QR."* — Vansh, quoted at the head of §8A.
 *
 * Every other QR assertion in this run — T06's arithmetic, T13's `data-qr-*` attributes,
 * T15's export node, and QR-T1 through QR-T4 in this directory — is a claim *about* the
 * symbol. This file is the only one that reads it the way a phone does: rasterise what the
 * browser actually painted, hand the bytes to a decoder, and require the string that comes
 * back to be **exactly** `resolved.qrPayload`. A card whose QR does not decode is a dead
 * card, and until this file ran, nothing in the build had shown that one decodes.
 *
 * ## The R-2 mitigations, all of which are load-bearing
 * · `deviceScaleFactor: 2` (per project) — a 1× screenshot through `jsqr` is the documented
 *   flake source. The 141–168 CSS px symbol lands at 282–336 device px.
 * · `animations: 'disabled'` and `await document.fonts.ready` — both inside `gotoReady` and
 *   `screenshotElement`, so no suite can opt out by forgetting.
 * · **The raw PNG buffer goes straight to `pngjs` + `jsqr`.** Never a canvas round trip.
 * · At most three attempts, each **re-taking the screenshot** so a retry actually resamples
 *   the raster rather than re-reading one stale buffer. A third failure is real.
 *
 * ## ⚠ Two traps this file is written around
 * 1. **Compare against `resolved.qrPayload`, never against the live URL.** `qrPayload` bakes
 *    `NEXT_PUBLIC_SITE_URL`, which defaults to `http://localhost:3000`, while Playwright
 *    serves the app on **3100**. The payload is *supposed* to disagree with the address bar;
 *    a test that compared against `page.url()` would fail on a perfect build. There is an
 *    explicit assertion of that disagreement at the bottom of the file so the next reader
 *    meets it as a documented fact rather than as a bug report.
 * 2. **Centre the zone in the viewport before screenshotting.** Playwright's own
 *    `scrollIntoViewIfNeeded` can leave an element under a `position: fixed` overlay, and an
 *    element screenshot then captures the overlay. Measured on `/cards/card_lagoon_demo`
 *    at 360×800: the `(app)` shell's mobile bottom bar covered the plate's bottom 28 CSS px
 *    and the decode failed — on a build whose QR is fine, and which decoded from the same
 *    card on `/c/prya-dev` at the same viewport back when that page carried one.
 *    `centreZone` removes that variable, and now that **every** decode in this file is
 *    taken inside the `(app)` shell it is not a nicety any more: it is the reason the mobile
 *    project passes at all.
 */

const CARDS = TEMPLATE_LIST.map((template) => {
  const card = FIXTURE_DB.cards.find(
    (candidate) => candidate.templateId === template.id && candidate.fieldIds.length > 0,
  );
  if (card === undefined) {
    throw new Error(`no fixture card maps template "${template.id}" (spec §10.3)`);
  }
  return {
    template,
    card,
    resolved: resolveCard(card, FIXTURE_DB.user, FIXTURE_DB.groups, FIXTURE_DB.fields),
  };
});

const EMPTY_CARD = FIXTURE_DB.cards.find((card) => card.id === "card_empty_demo");
if (EMPTY_CARD === undefined) throw new Error("card_empty_demo is missing from the fixtures");

/** Screenshot the zone and decode it, resampling the raster on each of three attempts. */
async function decodeZone(zone: Locator): Promise<string | null> {
  await centreZone(zone);
  return decodeWithRetry(async () => decodeQrPng(await screenshotElement(zone)));
}


/* ── QR-T5, per template × per viewport ───────────────────────────────────────────── */

for (const { template, card, resolved } of CARDS) {
  test(`QR-T5 · ${template.id} · the rendered QR decodes to exactly its payload`, async ({
    page,
  }, testInfo) => {
    const viewport = PROJECT_VIEWPORT[testInfo.project.name];
    await gotoCardFace(page, card);

    const zone = page.locator("[data-qr-zone]");
    await expect(zone).toHaveCount(1);

    const decoded = await decodeZone(zone);

    expect(
      decoded,
      `${template.id} at ${viewport}px did not decode. This is a DEAD CARD: a stranger ` +
        "pointing a phone at it lands nowhere. Per §14.6 the fix is the template or the " +
        "geometry — raising MIN_QR_SIZE_PX from 140 to 160 (§16.1 R-2) — and never this " +
        "assertion.",
    ).not.toBeNull();

    expect(decoded, `${template.id} at ${viewport}px decoded to the wrong payload`).toBe(
      resolved.qrPayload,
    );

    /* AC-08 / E-29, restated where it is observable: the string that actually came off the
       card is inside the byte cap that keeps the symbol at version 6 or below. */
    expect(resolved.qrPayload).not.toBeNull();
    expect(payloadByteLength(resolved.qrPayload as string)).toBeLessThanOrEqual(
      MAX_PAYLOAD_BYTES,
    );

    /* It is this card's page, not some other card's — the decoded symbol is byte-for-byte
       the publicUrl the API minted for it. */
    expect(decoded).toBe(card.publicUrl);
  });
}

/* ── the other surfaces that render a real symbol ─────────────────────────────────── */

/**
 * §11 E-02 strips the "Save to contacts" button from a card that shares nothing. The QR is
 * not conditional on having fields — a zero-field card still resolves to a page, and Vansh's
 * requirement has no exceptions in it. This is the card the old build shipped as a 73-byte
 * vCard; here it is, still scannable.
 */
test("QR-T5 · the zero-field card's QR decodes (E-02, §8A)", async ({ page }) => {
  const resolved = resolveCard(
    EMPTY_CARD,
    FIXTURE_DB.user,
    FIXTURE_DB.groups,
    FIXTURE_DB.fields,
  );
  await gotoCardFace(page, EMPTY_CARD);
  expect(await decodeZone(page.locator("[data-qr-zone]"))).toBe(resolved.qrPayload);
});

/**
 * **The homepage carries no QR symbol at all, and that is a new, true property — not a
 * weakened one.**
 *
 * ## History, restated so the next reader does not have to reconstruct it from git blame
 *
 * This assertion has moved twice. It was "both live cards on `/` decode, including the rotated
 * hero" — a tilted hero card plus a scan-demo card, before the 2026-09 rebuild. Then, once the
 * bento shipped and was later cut, it became "the hero's `<ShareFace>` decodes through its
 * flip" — a real 336×500 wallet pass on the front face of a 3D flip, auto-cycling to a
 * `<LiveCard>` look-alike on the back. **That subject is gone too.** The 2026-09-20 pass
 * (`docs/landing-integration.md`, ROUND 2 — hero card) replaced the wallet-pass-and-flip with
 * the card page (`@/card/card-page`) — see `hero-card.tsx` — which has never carried a QR at
 * all (see `card-page.tsx`'s own header: a page reached by scanning a code has no reason to
 * show that code again). There is nothing left on `/` for this test to decode, and there is not
 * supposed to be.
 *
 * ## ⚠ Do not read the zero below as this file losing coverage
 *
 * The decode guarantee this test used to carry for the hero did not vanish, it *relocated*
 * before this rewrite and stayed there: `/cards/{id}` renders the real `<ShareFace mode="full">`
 * — the actual wallet pass, QR included — and the `QR-T5 · ${template.id}` loop at the top of
 * this file, plus "the zero-field card's QR decodes" beneath it, already decode it there, per
 * template, at every project viewport. Removing the hero's own symbol does not touch that
 * coverage; the hero was never the wallet pass's only renderer, and `/cards/{id}` was already
 * the assertion's real home before this test existed.
 *
 * ## The old safety net, made total rather than weakened
 *
 * The previous version's last act was checking that a homepage symbol never encodes
 * `contactbook.app`. With zero symbols on the page, that check is not softened — it is
 * subsumed: there is nothing here that could encode *any* URL, real or fixture, for a
 * stranger's phone to resolve. What that leaves is a smaller, different, and already-covered
 * claim — `marketingUser`/`heroCard` still render real-shaped fixture text (a name, a role, a
 * phone number, an email) as plain rows and live `tel:`/`mailto:`/`https:` links in the card
 * page, same as every other `resolveCard` fixture the product renders un-redacted
 * (`/templates`, the builder) — and holding those values to reserved ranges and RFC 2606
 * domains is `tests/contract/fixture-hygiene.test.ts`'s job, not a QR test's.
 */
test("QR-T5 · the homepage carries no QR symbol now that the hero renders the card page", async ({
  page,
}) => {
  await gotoReady(page, "/");

  /* No `[data-qr-mode]` filter: neither a full-size nor a scaled symbol may appear anywhere on
     this page. `<QrZone>` is the only thing in the product that emits `[data-qr-zone]`
     (`qr-zone.tsx`), so this is a direct, page-wide assertion that nothing on `/` renders one. */
  await expect(page.locator("[data-qr-zone]")).toHaveCount(0);

  /* Non-vacuity: this must be a real, rendered hero and not an error boundary or an empty
     section — otherwise "zero symbols" would be true of a blank page for the wrong reason.
     `[data-hero-card]` is `hero-card.tsx`'s own hook for the object it renders in place of the
     old flip button; `[data-card-root]` is `<CardPage>`'s, asserted here as evidence the real
     component rendered rather than some other stand-in. */
  const card = page.locator("[data-hero-card]");
  await expect(card).toHaveCount(1);
  await expect(card.locator("[data-card-root]")).toHaveCount(1);
  await expect(card.locator("[data-qr-zone]")).toHaveCount(0);
});

/* ── the two tests that keep the eleven above honest ──────────────────────────────── */

/**
 * **X-7, asserted rather than commented.**
 *
 * ⚠ THE MECHANISM CHANGED UNDERNEATH THIS TEST, AND IT WAS STALE UNTIL THIS PASS — REAL DEFECT
 * OR STALE SPEC: STALE, and here is how to tell the difference.
 *
 * This used to read: `qrPayload` is built from `NEXT_PUBLIC_SITE_URL` (default
 * `http://localhost:3000`) at module scope, while Playwright serves the build on port
 * **3100**, so the string encoded in every symbol deliberately disagrees with the address bar.
 * That stopped being how `qrPayload` is built — `resolve-card.ts`'s own header now states
 * purity (I-4) as an invariant: "since the QR payload became `card.publicUrl` rather than a URL
 * assembled from `NEXT_PUBLIC_SITE_URL`, no environment read either. A call is a pure function
 * of its arguments in the strictest sense." `resolveCard` reads no env var at all any more, so
 * there is no `NEXT_PUBLIC_SITE_URL` left for it to disagree with the test port over, and
 * `expect(decoded).toContain(":3000")` could not pass against any build, correct or broken —
 * it was asserting a mechanism the resolver had already stopped having.
 *
 * That makes it a stale spec rather than a real defect: nothing regressed, a documented,
 * reasoned invariant (I-4, purity) landed in `resolve-card.ts` and this test was never updated
 * to match. It surfaced only once "keeps every decode in this file honest" (below) started
 * actually reaching this assertion — until this pass added the missing `signIn` hook (see the
 * top of this file), every test here silently decoded the sign-in page's own preview instead,
 * so this line never ran against a real result to notice it was wrong.
 *
 * The guarantee the test exists for did not go away, it moved: a QR must encode the CARD's own
 * address, never the address bar the browser happens to be serving the page from. Restated
 * against what `qrPayload` actually is now — `card.publicUrl`, a fixture-minted
 * `https://card.example/...` URL, never `page.url()`'s own origin. Pinning that here still
 * means a future reader who "fixes" the per-template comparisons to use the live URL turns this
 * red and gets the explanation, instead of turning six cells red and hunting for a cause.
 */
test("QR-T5 · the payload is the card's own minted URL, not the port the tests run on", async ({
  page,
}) => {
  const { card, resolved } = CARDS[0];
  await gotoCardFace(page, card);

  const decoded = await decodeZone(page.locator("[data-qr-zone]"));
  expect(decoded).toBe(resolved.qrPayload);

  expect(page.url()).toContain(":3100");
  expect(decoded).not.toContain(":3100");
  expect(decoded).toBe(card.publicUrl);
});

/**
 * **Non-vacuity: the decoder is reading these pixels.**
 *
 * Eleven green decodes are also what a decoder that returned a cached string, or a harness
 * that screenshotted the wrong element, would produce. So the symbol is occluded past ECC
 * H's recovery budget — a mask over 56% of its area, where §8A.3 caps a *sanctioned*
 * occlusion at 20% — and the decode is required to **stop working**. Then the mask is
 * removed and the decode is required to come back.
 *
 * The mask is injected into the live DOM. **No product code is modified.**
 */
test("QR-T5 · occluding the symbol past the ECC budget breaks the decode", async ({ page }) => {
  const { card, resolved } = CARDS[0];
  await gotoCardFace(page, card);
  const zone = page.locator("[data-qr-zone]");

  expect(await decodeZone(zone)).toBe(resolved.qrPayload);

  await page.evaluate(() => {
    const plate = document.querySelector("[data-qr-plate]");
    const symbol = document.querySelector("[data-qr-symbol]");
    if (plate === null || symbol === null) throw new Error("no symbol to occlude");
    const side = symbol.getBoundingClientRect().width * 0.75;
    const mask = document.createElement("span");
    mask.setAttribute("data-qr-test-mask", "");
    mask.style.cssText =
      `position:absolute;width:${side}px;height:${side}px;` +
      "background-color:var(--qr-module);display:block";
    plate.appendChild(mask);
  });

  /* One attempt, not three: this is expected to fail and retrying it three times only
     spends six screenshots proving the same thing. */
  await centreZone(zone);
  const occluded = decodeQrPng(await screenshotElement(zone));
  expect(
    occluded,
    "a symbol occluded over 56% of its area still decoded — the decode assertions in this " +
      "file are not reading the rendered symbol",
  ).not.toBe(resolved.qrPayload);

  await page.evaluate(() => {
    document.querySelector("[data-qr-test-mask]")?.remove();
  });
  expect(await decodeZone(zone)).toBe(resolved.qrPayload);
});
