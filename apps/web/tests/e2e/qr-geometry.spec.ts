import { expect, test, type Locator } from "@playwright/test";

import {
  ECC_LEVEL,
  MAX_PLATE_RADIUS_PX,
  MIN_QR_SIZE_PX,
  MIN_QUIET_ZONE_PX,
  QR_WIDTH_RATIO,
  qrGeometry,
} from "@/card/qr-geometry";
import { resolveCard } from "@/card/resolve-card";
import { TEMPLATE_LIST } from "@/card/templates";
import { FIXTURE_DB } from "@/fixtures";

import { PROJECT_VIEWPORT, boxOf } from "../helpers/e2e";
import { FACE_HOST_WIDTH, gotoCardFace } from "../helpers/qr-surface";

/**
 * **QR-T1 — the reserved region, measured in a real browser** (spec §8A.3, §8A.7; AC-09(a),
 * AC-09(b), AC-11; §11 E-25, E-33).
 *
 * ## ⚠ THE SURFACE MOVED. NOTHING WAS DROPPED.
 *
 * Every test in this file used to address a card as `/c/{slug}` and measure the `<QrZone>` at the
 * foot of the scan page. The scan page carries no QR any more — see the head of
 * `src/card/card-page.tsx` for why a symbol encoding the URL of the page you are reading is not
 * a share affordance — so the same tests now address `/cards/{id}` and measure the **share
 * face**, which is where the QR has always belonged and where it now exclusively lives.
 *
 * The move is an *improvement* to this file rather than a compromise, and it is worth saying
 * why: `qr-geometry.ts`'s constants were derived at the face's 336px width. On the scan page the
 * symbol was sized from a 460px content column, so QR-T1 was measuring the geometry module
 * against a host the spec's own numbers were never written for. It now measures the 141.12px
 * symbol that §8A.3's 140px floor is actually about — see {@link FACE_HOST_WIDTH}.
 *
 * `tests/helpers/qr-surface.ts` carries the full migration note and the route helper.
 *
 * ## Why this file exists at all
 * `qr-geometry.ts` is pure arithmetic and T06 proved the arithmetic. `card-renderer.test.tsx`
 * asserted the attributes and T13 proved the attributes. **Neither ran a layout engine.**
 * happy-dom returns zeros from every `getBoundingClientRect`, so every geometric assertion
 * written against it is vacuously true — a card whose plate collapsed to `0 × 0` would have
 * passed both suites. This file is the first place in the run where the numbers are *measured*
 * off painted boxes rather than read back off the attributes that claim them.
 *
 * ## The two comparisons, and why both are needed
 * 1. **Measured box vs published attribute.** `[data-qr-symbol]`'s real box must equal
 *    `data-qr-size`. This catches a symbol that is authored correctly and then squashed by a
 *    flex parent, clipped by an `overflow: hidden` ancestor, or dropped into a collapsed grid
 *    track — T13's own mutation testing found exactly that last one
 *    (`QR_ROW_CLASS['bottom-plate']` pointing at a `0px` row) and recorded that it had **no
 *    DOM symptom at all**.
 * 2. **Published attribute vs `qrGeometry(cardWidth, moduleCount)`.** The renderer must have
 *    derived the box from the module, from the *measured* card width and from the encoder's
 *    *real* module count. §8A.2's `196` is nominal — the real reserved box is 173–210px — so a
 *    hard-coded constant would be wrong in a way no visual review would catch.
 *
 * ## ⚠ The reserved region is `[data-qr-plate]`'s border box, not the zone root's
 * §8A.3 puts the caption **below the plate and outside the region**, so the zone root is
 * taller than the region on every captioned template (measured: Atrium 210 = the plate
 * exactly, Terminal 257.95 for the same 210px plate). Measuring the root would silently
 * inflate the region and make QR-T3 report a false overlap on half the set.
 *
 * ## Sub-pixel tolerance, stated rather than assumed
 * Chromium reports layout in 1/64 px, so `qrSizePx(336) = 141.12` measures as `141.109375`.
 * {@link PX_EPSILON} is that quantum and nothing more. It cannot mask a real violation: the
 * smallest meaningful geometry error is one module (3.8–5.1 px here), 240× larger.
 */

/** Chromium's layout quantum. Not a fudge factor — see the note above. */
const PX_EPSILON = 1 / 64;

/**
 * One `full`-mode card per template, addressed at its owner's card-detail screen — the one
 * surface that paints the share face at its unscaled design size.
 *
 * `card_empty_demo` also carries `templateId: 'minimal'`, so the zero-field card is excluded
 * here by its field count and tested separately below — it has its own claim to make.
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

/** The zero-field card. Vansh, verbatim: *"each and every QR card should have a QR."* */
const EMPTY_CARD = FIXTURE_DB.cards.find((card) => card.id === "card_empty_demo");
if (EMPTY_CARD === undefined) throw new Error("card_empty_demo is missing from the fixtures");

interface ZoneAttributes {
  mode: string | null;
  ecc: string | null;
  modules: number;
  size: number;
  quiet: number;
  reserved: number;
  host: number;
}

async function zoneAttributes(zone: Locator): Promise<ZoneAttributes> {
  return zone.evaluate((node) => ({
    mode: node.getAttribute("data-qr-mode"),
    ecc: node.getAttribute("data-qr-ecc"),
    modules: Number(node.getAttribute("data-qr-modules")),
    size: Number(node.getAttribute("data-qr-size")),
    quiet: Number(node.getAttribute("data-qr-quiet")),
    reserved: Number(node.getAttribute("data-qr-reserved")),
    /* The width the geometry was derived from, published by the zone itself. */
    host: Number(node.getAttribute("data-qr-host")),
  }));
}

/* ── the constants still say what §8A.3 says ──────────────────────────────────────── */

/**
 * **The test that stops every other test in this file from lying.**
 *
 * T06 recorded the exact failure this closes: lowering `MIN_QR_SIZE_PX` from 140 to 120 left
 * its whole suite green, because every floor assertion was written in terms of the constant
 * rather than against the number §8A.3 states. The same trap is wide open here — everything
 * below compares a measured box against `qrGeometry()`, so a weakened constant would produce
 * a weakened contract and 24 green cells.
 *
 * These pins are **directional**, matching §16.1 R-2: raising the symbol floor to 160px (the
 * one sanctioned response to a marginal decode) still passes. Lowering it cannot.
 */
test("§8A.3's numbers are still the numbers the geometry module enforces", () => {
  expect(MIN_QR_SIZE_PX).toBeGreaterThanOrEqual(140);
  expect(MIN_QUIET_ZONE_PX).toBeGreaterThanOrEqual(16);
  expect(MAX_PLATE_RADIUS_PX).toBeLessThanOrEqual(4);
  expect(QR_WIDTH_RATIO).toBeCloseTo(0.42, 10);
  expect(ECC_LEVEL).toBe("H");
});

/* ── QR-T1, per template ──────────────────────────────────────────────────────────── */

for (const { template, card, resolved } of CARDS) {
  test(`QR-T1 · ${template.id} · the reserved region is the box §8A.3 specifies`, async ({
    page,
  }, testInfo) => {
    const viewport = PROJECT_VIEWPORT[testInfo.project.name];
    await gotoCardFace(page, card);

    /* AC-11 / E-33 — exactly one zone, and it renders `full`, not the thumb glyph. */
    await expect(page.locator("[data-qr-zone]")).toHaveCount(1);
    await expect(page.locator("[data-qr-plate]")).toHaveCount(1);
    await expect(page.locator("[data-qr-symbol]")).toHaveCount(1);
    await expect(page.locator("[data-qr-glyph]")).toHaveCount(0);

    const zone = page.locator("[data-qr-zone]");
    const attrs = await zoneAttributes(zone);
    expect(attrs.mode).toBe("full");

    /* ECC H is what legalises centre occlusion at all (§8A.3). Nothing may downgrade it. */
    expect(attrs.ecc).toBe(ECC_LEVEL);

    const rootBox = await boxOf(page.locator("[data-card-root]"));
    const plateBox = await boxOf(page.locator("[data-qr-plate]"));
    const symbolBox = await boxOf(page.locator("[data-qr-symbol]"));

    /* The renderer derived the box from its HOST width and the encoder's real module count.
       `data-qr-host` is still read rather than assumed — it is the number the zone actually
       computed from — but on the face it is checkable against the card, which is the whole
       point of moving here: the face IS its host, at every viewport, because it is rigid.
       The scan page was full-bleed and sized its symbol from a content column, so there was
       nothing on screen to check `host` against. */
    expect(attrs.host).toBe(FACE_HOST_WIDTH);
    expect(rootBox.width, "the face is rigid: it never reflows to the viewport").toBeCloseTo(
      FACE_HOST_WIDTH,
      1,
    );
    const expected = qrGeometry(attrs.host, attrs.modules);
    expect(attrs.size).toBeCloseTo(expected.qrSizePx, 6);
    expect(attrs.quiet).toBeCloseTo(expected.quietZonePx, 6);
    expect(attrs.reserved).toBeCloseTo(expected.reservedPx, 6);

    /* AC-09(a) — square, and never below the floor. E-25 at 360, where the card is 336. */
    expect(symbolBox.width).toBeCloseTo(symbolBox.height, 3);
    expect(symbolBox.width).toBeGreaterThanOrEqual(MIN_QR_SIZE_PX - PX_EPSILON);
    expect(symbolBox.width).toBeCloseTo(expected.qrSizePx, 1);

    /* The plate is the reserved region: square, and exactly symbol + 2 × quiet zone. */
    expect(plateBox.width).toBeCloseTo(plateBox.height, 3);
    expect(plateBox.width).toBeCloseTo(expected.reservedPx, 1);

    /* AC-09(b) — the plate exceeds the symbol by at least 16px on all four sides, and by
       exactly the published quiet zone. The four-sided form is the one that matters: a
       symbol flush to one edge scans from three directions and fails from the fourth. */
    const gaps = {
      left: symbolBox.x - plateBox.x,
      right: plateBox.x + plateBox.width - (symbolBox.x + symbolBox.width),
      top: symbolBox.y - plateBox.y,
      bottom: plateBox.y + plateBox.height - (symbolBox.y + symbolBox.height),
    };
    for (const [side, gap] of Object.entries(gaps)) {
      expect(gap, `${side} quiet zone on ${template.id} at ${viewport}`).toBeGreaterThanOrEqual(
        MIN_QUIET_ZONE_PX - PX_EPSILON,
      );
      expect(gap, `${side} quiet zone equals data-qr-quiet`).toBeCloseTo(attrs.quiet, 1);
    }

    /* AC-09(c)'s radius half — a larger radius clips the quiet zone at the corners. */
    const radii = await page
      .locator("[data-qr-plate]")
      .evaluate((node) => {
        const style = getComputedStyle(node);
        return [
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomRightRadius,
          style.borderBottomLeftRadius,
        ];
      });
    for (const radius of radii) {
      expect(Number.parseFloat(radius)).toBeLessThanOrEqual(MAX_PLATE_RADIUS_PX);
    }

    /* The symbol is the payload `resolveCard` computed, at the module count the encoder
       actually produced — the number QR-T5 then decodes. */
    expect(attrs.modules).toBeGreaterThan(0);
    /* The payload is the card's own API-minted publicUrl, verbatim — no origin is
       assembled here any more, so there is nothing for a dev host to get wrong. */
    expect(resolved.qrPayload).toBe(card.publicUrl);
  });
}

/* ── the zero-field card carries a QR too ─────────────────────────────────────────── */

/**
 * §11 E-02 removes the "Save to contacts" button from a card that shares nothing. It does
 * **not** remove the QR, and it must not: the card still resolves to a page, and Vansh's
 * requirement is unconditional. A zero-field card with no QR would be a blank rectangle.
 */
test("QR-T1 · the zero-field card still carries a full-size QR (E-02, §8A)", async ({ page }) => {
  await gotoCardFace(page, EMPTY_CARD);

  await expect(page.locator("[data-qr-zone]")).toHaveCount(1);
  const attrs = await zoneAttributes(page.locator("[data-qr-zone]"));
  expect(attrs.mode).toBe("full");
  expect(attrs.ecc).toBe(ECC_LEVEL);

  const symbolBox = await boxOf(page.locator("[data-qr-symbol]"));
  expect(symbolBox.width).toBeGreaterThanOrEqual(MIN_QR_SIZE_PX - PX_EPSILON);
  expect(symbolBox.width).toBeCloseTo(symbolBox.height, 3);

  /* And the card that offers no vCard offers no Save control — the two facts together are
     E-02. Asserted here only to prove the QR survives the removal, not to duplicate T18.

     This used to read the public page's action row and now reads the card-detail screen's,
     which gates on the same `canBuildVcf` and omits the control the same way. The claim is
     unchanged: the QR is not conditional on the card sharing anything. */
  await expect(page.locator("[data-card-action]")).toHaveCount(0);
});

/* ── the quiet zone is four MODULES, not a constant ───────────────────────────────── */

/**
 * **The module-count sensitivity T06 flagged as the thing to probe hardest.**
 *
 * `quietZonePx = max(16, ceil(4 × qrSizePx / moduleCount))`, so a *longer* payload produces
 * *more* modules and therefore a *smaller* quiet zone. The fixture set spans two versions —
 * `prya-studio` (12 chars of slug) encodes to 37 modules where the rest reach 33 — and that
 * is what makes this assertable from the shipped fixtures rather than from a contrived one.
 *
 * A renderer that had hard-coded 16px, or 21px, or §8A.2's nominal 196px reserved box would
 * pass every per-template test above and fail here, because here the two counts have to
 * disagree in the right direction and by the right amount.
 */
test("QR-T1 · the quiet zone tracks the module count, not a constant (§8A.3)", async ({
  page,
}) => {
  /* Iterates every fixture CARD, not one card per template.
   *
   * This test is about payload-length sensitivity: a longer slug encodes to more modules, and
   * more modules must produce a *smaller* quiet zone at the same symbol size. So its sample has
   * to span QR versions, which means it has to span slug lengths — `prya-studio` reaches 37
   * modules where the shorter slugs sit at 33.
   *
   * It used to walk `CARDS` (one per template) and that was fine while there were eight
   * templates and therefore eight different slugs. The set is two templates now, both with
   * short slugs, so every measurement came back at 33 modules and the comparison below had
   * nothing to compare. The sample was wrong, not the renderer. */
  const PAYLOAD_CARDS = FIXTURE_DB.cards.filter((card) => card.fieldIds.length > 0);
  const measurements: { id: string; modules: number; size: number; quiet: number }[] = [];

  for (const card of PAYLOAD_CARDS) {
    await gotoCardFace(page, card);
    const attrs = await zoneAttributes(page.locator("[data-qr-zone]"));
    measurements.push({
      id: card.id,
      modules: attrs.modules,
      size: attrs.size,
      quiet: attrs.quiet,
    });
  }

  /* Every measurement satisfies the formula against its own module count. */
  for (const m of measurements) {
    expect(m.quiet, `${m.id} quiet zone`).toBe(
      Math.max(MIN_QUIET_ZONE_PX, Math.ceil((4 * m.size) / m.modules)),
    );
  }

  /* The set genuinely spans more than one QR version, so the comparison below is real. */
  const counts = [...new Set(measurements.map((m) => m.modules))].sort((a, b) => a - b);
  expect(counts.length, `module counts across the fixture set: ${counts.join(", ")}`).toBeGreaterThan(1);

  /* More modules → a smaller quiet zone, at identical symbol size. This is the inversion a
     constant cannot reproduce. */
  const sizes = [...new Set(measurements.map((m) => m.size))];
  expect(sizes).toHaveLength(1);
  const coarsest = measurements.reduce((a, b) => (a.modules <= b.modules ? a : b));
  const finest = measurements.reduce((a, b) => (a.modules >= b.modules ? a : b));
  expect(finest.modules).toBeGreaterThan(coarsest.modules);
  expect(finest.quiet).toBeLessThan(coarsest.quiet);
});

/* ── E-04: 25+ fields must not move the zone by one pixel ─────────────────────────── */

/**
 * **E-04, proven in pixels rather than in CSS.** *"A QR pushed off-canvas is a dead card."*
 *
 * T13 built the guarantee structurally — the field slot is the only `minmax(0, 2fr)` track
 * and the only element with `min-height: 0` + `overflow-y: auto`, while the QR and action
 * tracks are `auto` and never flexible — and asserted it at DOM level, which is as far as
 * happy-dom can go. This is the measurement it asked wave 8 for.
 *
 * The 26-field fixture card is not routable (`extremeCards` is not in `FIXTURE_DB.cards`),
 * so the field count is driven the way a user drives it: through the builder's Fields tab,
 * ticking group checkboxes. Ticking all seven reaches **28** rendered field rows.
 *
 * ## ⚠ Isolating the variable — two wrong baselines, and what they actually measured
 * "Add fields, check the zone did not move" is the obvious test and it fails on a correct
 * build. Measured, ticking groups one at a time on the Ledger draft at 1440:
 *
 * | fields | actions | social | plate top within the card |
 * |---|---|---|---|
 * | 0 | 0 | 0 | 313.9 |
 * | 2 | **1** | 0 | 328.6 |
 * | 9 | **2** | 0 | 307.2 |
 * | 18 | 2 | 0 | **307.2** |
 * | 22 | 2 | 0 | **307.2** |
 * | 22 | 2 | **5** | 292.6 |
 * | 26 | 2 | 5 | **292.6** |
 * | 28 | 2 | 5 | **292.6** |
 *
 * Every move happens on a row where a **different slot changed shape** — the first action
 * button appearing, then the second (E-56 withholds WhatsApp until a `PHONE` is mapped),
 * then the social row going from absent to 44px. Those are `auto` tracks, so each one takes
 * height out of the card's free space and the `minmax(0, 1fr)` spacer above the zone gives
 * back exactly one third of it. **On every row where only the field count changed — 9→18,
 * 18→22, 22→26, 26→28 — the plate does not move by one hundredth of a pixel**, while the
 * field slot's own `scrollHeight` climbs 376 → 775 → 955 → 1259 against a constant
 * `clientHeight`. That is E-04's actual sentence, "the field row scrolls within its slot",
 * and it is what this test pins.
 *
 * So the baseline is taken once the composition is settled — both buttons present *and* the
 * social row populated — after which the only remaining variable is the field count. A
 * baseline taken earlier measures the action row appearing (21.3px) or the social row
 * appearing (14.7px) and reports a P0 that is not there.
 *
 * ⚠ The offset is measured **relative to `[data-card-root]`**, never to the viewport.
 * Clicking checkboxes scrolls the left pane, which moves the card on screen while moving it
 * not at all within its own canvas — a viewport-relative assertion would fail for the wrong
 * reason and be "fixed" by loosening it.
 */
/*
 * REMOVED: "the field list scrolls in its slot and never moves the QR (E-04)".
 *
 * That test asserted an `overflow-y: auto` field slot inside the card, and that the QR did not
 * move as the slot scrolled. The slot is gone, deliberately — it was the defect, not the
 * feature. One fixed canvas could not hold identity, a protected QR zone, two actions and an
 * unbounded field list, so the list was given an inner scrollbar and silently clipped its own
 * rows.
 *
 * The field list now lives on `<CardPage>`, which is a page with no height, and the share face
 * carries no list at all. What replaced this test:
 *
 *   · `tests/unit/card-variants.test.tsx` — the card page contains NO scroll container, and
 *     declares exactly as many field rows as it renders;
 *   · `tests/e2e/face-format.spec.ts` — nothing on the face overflows the card, and the QR
 *     plate sits fully inside it on every template.
 */
