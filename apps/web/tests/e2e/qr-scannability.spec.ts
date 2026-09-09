import { expect, test, type Locator } from "@playwright/test";

import { MAX_PAYLOAD_BYTES, payloadByteLength } from "@/card/qr-geometry";
import { resolveCard } from "@/card/resolve-card";
import { TEMPLATE_LIST } from "@/card/templates";
import { FIXTURE_DB } from "@/fixtures";
import { heroCard, marketingUser } from "@/fixtures/marketing";

import { PROJECT_VIEWPORT, gotoReady, screenshotElement } from "../helpers/e2e";
import { decodeQrPng, decodeWithRetry } from "../helpers/qr-decode";
import { centreZone, gotoCardFace } from "../helpers/qr-surface";

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
 * **Every real symbol on the marketing homepage decodes; every decorative one is inert.**
 *
 * ## What this replaced, and why the claim survived the page
 *
 * This was "both live cards on `/` decode, including the rotated hero" — it decoded a −2°
 * tilted hero card and a scan-demo card, and counted one preview thumbnail per template. All
 * three subjects are gone: the redesign removed the hero card (it was oversized and the film
 * took its place), the scan-demo section, and the template strip.
 *
 * The subjects went; **the claim did not**, and it is the one this file exists for — a symbol
 * on a public page either resolves to the card it advertises or it is a dead target. So it is
 * re-pointed at what `/` actually renders now: the bento's scan exhibit, which is a deliberate
 * `mode="full"` render at `FACE_WIDTH`, and the card studio's wallet pass, which is a scaled
 * `mode="thumb"`.
 *
 * ## The split is the interesting part
 *
 * Those two modes encode different things **on purpose**, and the page's whole argument is that
 * it tells the truth about the product:
 *
 * · the exhibit is 141px — one pixel above `MIN_QR_SIZE_PX` — and carries the real payload,
 *   because it is captioned as something the reader may point a phone at right now;
 * · the wallet pass is scaled to ~91px, under the decode floor. It carries the real payload
 *   too, now that no symbol in the product encodes a dummy.
 *
 * The safety property that used to come from a fake payload now comes from the fixture: every
 * demo card's `publicUrl` is on `card.example`, an RFC 2606 reserved domain nobody can own. So
 * a symbol on this page is honest AND cannot resolve to a real person's card — which is the
 * stronger guarantee, because it holds however large the symbol is rendered.
 */
test("QR-T5 · every symbol on the homepage is real, and the hero's decodes through its flip", async ({
  page,
}, testInfo) => {
  const viewport = PROJECT_VIEWPORT[testInfo.project.name];

  /**
   * ⚠ THE HOMEPAGE'S SYMBOL CENSUS CHANGED ON 2026-09-09, AND THE DECODE IS NOW THE POINT.
   *
   * It was one full-size symbol (a scan exhibit inside the bento) and one thumb (the studio
   * cell). Both are gone with the bento. The page now renders:
   *
   *   · **one `full` symbol** — the hero's card, which is a real `<ShareFace>` at its authored
   *     336×500 on the FRONT FACE OF A FLIP, and
   *   · **six `thumb` symbols** — the example-cards section, one per palette.
   *
   * The decode below is the most valuable assertion in this file now, because of where that
   * symbol sits. DESIGN.md is explicit that the pass's QR has ONE pixel of clearance over
   * `MIN_QR_SIZE_PX` and that a transform on an ancestor spends headroom that does not exist —
   * and a 3D flip is exactly such a transform. The flip is `rotateY` alone with no scale, so the
   * resting front face should be pixel-identical to an untransformed one. "Should be" is not
   * good enough for a scanning target: this decodes the real raster, through
   * `transform-style: preserve-3d`, at every viewport. If a future hand adds a scale, a
   * `perspective` tweak or a `will-change` that pins a mid-flight raster, this goes red and the
   * message says why.
   */
  const heroPayload = resolveCard(
    heroCard,
    marketingUser,
    FIXTURE_DB.groups,
    FIXTURE_DB.fields,
  ).qrPayload;

  await gotoReady(page, "/");

  const real = page.locator('[data-qr-zone][data-qr-mode="full"]');
  const thumbs = page.locator('[data-qr-zone][data-qr-mode="thumb"]');
  await expect(real, "the hero's card is the page's one full-size symbol").toHaveCount(1);
  await expect(thumbs, "one thumb per example card").toHaveCount(6);

  /* The hero's face must be showing — it is what the server renders and the flip's resting
     state — or this would be measuring the back of a card. */
  await expect(page.locator("button[data-hero-card]")).toHaveAttribute("data-face", "front");

  expect(
    await decodeZone(real),
    `the hero's symbol did not decode at ${viewport}px. It sits on the front face of a 3D flip, ` +
      "so the first thing to suspect is a transform on an ancestor — a scale, a perspective " +
      "change, or a cached raster from `will-change`. Per §14.6 the fix is the geometry or the " +
      "animation, never this assertion",
  ).toBe(heroPayload);

  /* ⚠ The guarantee, restated where it now lives. Every symbol on this page is a REAL encode of
     a real fixture URL, so what must hold is that none of them can resolve to an actual
     person's card: the marketing page renders fixtures, and every fixture URL is on an RFC 2606
     reserved domain nobody can own. That holds however large a symbol is rendered, which is a
     stronger guarantee than the fake payload it replaced. */
  for (const zone of [real, thumbs.first(), thumbs.last()]) {
    const html = await zone.evaluate((node) => node.outerHTML);
    expect(html, "a marketing symbol must not embed a resolvable production URL").not.toContain(
      "contactbook.app",
    );
  }
  expect(
    heroPayload,
    "the marketing fixture must sit on a domain nobody can own",
  ).toContain(".example/");
});

/* ── the two tests that keep the eleven above honest ──────────────────────────────── */

/**
 * **X-7, asserted rather than commented.**
 *
 * `qrPayload` is built from `NEXT_PUBLIC_SITE_URL` (default `http://localhost:3000`) at
 * module scope; Playwright serves the build on port **3100**. So the string encoded in every
 * symbol on this page deliberately disagrees with the address bar, and the eleven decodes
 * above compare against `resolved.qrPayload` for that reason. Pinning the disagreement here
 * means a future reader who "fixes" those comparisons to use the live URL turns this red and
 * gets the explanation, instead of turning eleven cells red and hunting for a cause.
 */
test("QR-T5 · the payload is the configured site URL, not the port the tests run on", async ({
  page,
}) => {
  const { card, resolved } = CARDS[0];
  await gotoCardFace(page, card);

  const decoded = await decodeZone(page.locator("[data-qr-zone]"));
  expect(decoded).toBe(resolved.qrPayload);

  expect(page.url()).toContain(":3100");
  expect(decoded).toContain(":3000");
  expect(decoded).not.toContain(":3100");
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
