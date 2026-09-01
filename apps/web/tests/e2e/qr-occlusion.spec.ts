import { expect, test, type Page } from "@playwright/test";

import {
  MARK_MAX_SIDE_RATIO,
  MAX_MARK_AREA_RATIO,
  MIN_MARK_CLEARANCE_MODULES,
} from "@/card/qr-geometry";
import { TEMPLATE_LIST } from "@/card/templates";
import { FIXTURE_DB } from "@/fixtures";

import { PROJECT_VIEWPORT } from "../helpers/e2e";
import { gotoCardFace } from "../helpers/qr-surface";

/**
 * **QR-T4 — the zone holds a plate, a symbol and at most one centre mark** (spec §8A.3,
 * §8A.4, §8A.7; AC-09(f); §11 E-28, E-30).
 *
 * ## ⚠ THE SURFACE MOVED. NOTHING WAS DROPPED.
 *
 * These tests addressed `/c/{slug}`. That page carries no QR now (see the head of
 * `src/card/card-page.tsx`), so they address `/cards/{id}` and inspect the **share face**'s zone.
 *
 * Every clause transfers verbatim — the permitted-vocabulary sweep, the one-mark cap, the
 * budget arithmetic and the injected over-budget mark that proves the budget is real. The one
 * observable difference is that the face's zone passes `decorate="none"` and no caption, where
 * the scan page passed a caption, so `strangers` and `decorationsOnPlate` are now asserted
 * against the tighter of the two vocabularies rather than the looser one.
 *
 * ## The clause, and why it is worth its own file
 * ECC level H recovers about 30% of a symbol, and §8A.3 spends **at most 20%** of that on a
 * centre mark — deliberately under budget, *"leaving headroom for screen glare and print
 * wear"*. Anything beyond one centred, cleared, in-budget mark is `Any other occlusion:
 * forbidden`. A symbol can be occluded past its recovery budget and still decode on a clean
 * screenshot in a test harness while failing on a phone at arm's length in a lit room, so
 * QR-T5 alone does not cover this: the budget has to be measured, not inferred from a decode.
 *
 * ## What QR-T3 cannot see, and this file must
 * QR-T3 sweeps `[data-card-root]` for intruders **and deliberately excludes the zone's own
 * subtree** — otherwise the plate, the symbol and the caption would each report as
 * overlapping themselves. That exclusion leaves a real gap: §8A.4 lets a template ask for
 * corner ticks and hairline rules, and those render **inside** `[data-qr-zone]`. If a tick
 * drifted onto the plate, QR-T3 would never look. So this file owns the zone's interior:
 * every `[data-qr-decoration]` is required to be strictly outside the plate's border box.
 *
 * ## The occlusion budget is checked against §8A.3's literals, not against the module
 * `isMarkWithinBudget` and `hasMarkClearance` already exist in `qr-geometry.ts` and T06 unit
 * tested them. Validating the DOM with them would make this a test of whether the module
 * agrees with itself. The arithmetic below is transcribed from §8A.3 instead — area ≤ 20%,
 * side ≤ 0.447 × symbol, clearance ≥ 2 modules — and the constants are separately pinned
 * against the same literals in `qr-geometry.spec.ts`.
 */

const CARDS = TEMPLATE_LIST.map((template) => {
  const card = FIXTURE_DB.cards.find(
    (candidate) => candidate.templateId === template.id && candidate.fieldIds.length > 0,
  );
  if (card === undefined) {
    throw new Error(`no fixture card maps template "${template.id}" (spec §10.3)`);
  }
  return { template, card };
});

interface MarkMeasurement {
  side: number;
  padSide: number;
  symbolSide: number;
  modulePx: number;
  centredOffset: { x: number; y: number };
}

interface ZoneContents {
  /** Descendants of the zone that are not part of §8A.3's permitted vocabulary. */
  strangers: string[];
  /** Element children of the plate, described. Only the symbol and one mark pad are legal. */
  plateChildren: string[];
  markCount: number;
  markPadCount: number;
  errorCount: number;
  symbolCount: number;
  /** `[data-qr-decoration]` boxes that intersect the plate's border box. Must be empty. */
  decorationsOnPlate: { description: string; overlapPx: number }[];
  decorationCount: number;
  declaredDecorate: string | null;
  marks: MarkMeasurement[];
}

async function zoneContents(page: Page): Promise<ZoneContents> {
  return page.evaluate(() => {
    const zone = document.querySelector("[data-qr-zone]");
    const plate = document.querySelector("[data-qr-plate]");
    if (zone === null || plate === null) throw new Error("QR-T4: no zone or no plate");

    const describe = (el: Element): string =>
      `${el.tagName.toLowerCase()}[${Array.from(el.attributes)
        .map((a) => (a.value === "" ? a.name : `${a.name}="${a.value.slice(0, 24)}"`))
        .join(" ")
        .slice(0, 120)}]`;

    /**
     * §8A.3's vocabulary for the inside of a zone. The unlabelled `<div>` is the positioning
     * wrapper `<QrZone>` puts around the plate so corner ticks live in its padding and are
     * therefore outside the plate by construction; it is permitted only in that role.
     */
    const isPermitted = (el: Element): boolean => {
      if (el.hasAttribute("data-qr-plate")) return true;
      if (el.hasAttribute("data-qr-symbol")) return true;
      if (el.hasAttribute("data-qr-caption")) return true;
      if (el.hasAttribute("data-qr-decoration")) return true;
      if (el.hasAttribute("data-qr-mark")) return true;
      if (el.hasAttribute("data-qr-mark-pad")) return true;
      if (el.hasAttribute("data-qr-error")) return true;
      /* the symbol's own geometry */
      if (el.tagName.toLowerCase() === "path" && el.closest("[data-qr-symbol]") !== null) {
        return true;
      }
      /* the plate's positioning wrapper: a direct child of the zone that holds the plate */
      if (el.parentElement === zone && el.contains(plate)) return true;
      return false;
    };

    const strangers: string[] = [];
    for (const el of Array.from(zone.querySelectorAll("*"))) {
      if (!isPermitted(el)) strangers.push(describe(el));
    }

    const region = plate.getBoundingClientRect();
    const decorations = Array.from(zone.querySelectorAll("[data-qr-decoration]"));
    const decorationsOnPlate: { description: string; overlapPx: number }[] = [];
    for (const el of decorations) {
      const box = el.getBoundingClientRect();
      /* A hairline rule has zero height; its border still paints, so a zero-area box that
         sits on the plate's rows is measured on the axis that can actually overlap. */
      const overlapsX = box.left < region.right && region.left < box.right;
      const overlapsY = box.top < region.bottom && region.top < box.bottom;
      if (overlapsX && overlapsY) {
        decorationsOnPlate.push({
          description: describe(el),
          overlapPx:
            Math.min(box.bottom, region.bottom) - Math.max(box.top, region.top),
        });
      }
    }

    const symbol = zone.querySelector("[data-qr-symbol]");
    const symbolBox = symbol === null ? null : symbol.getBoundingClientRect();
    const modules = Number(zone.getAttribute("data-qr-modules"));

    const marks: MarkMeasurement[] = [];
    for (const el of Array.from(zone.querySelectorAll("[data-qr-mark]"))) {
      const box = el.getBoundingClientRect();
      const pad = el.closest("[data-qr-mark-pad]");
      const padBox = pad === null ? box : pad.getBoundingClientRect();
      const side = Math.max(box.width, box.height);
      const symbolSide = symbolBox === null ? 0 : Math.max(symbolBox.width, symbolBox.height);
      marks.push({
        side,
        padSide: Math.max(padBox.width, padBox.height),
        symbolSide,
        modulePx: symbolSide / modules,
        centredOffset:
          symbolBox === null
            ? { x: 0, y: 0 }
            : {
                x: box.left + box.width / 2 - (symbolBox.left + symbolBox.width / 2),
                y: box.top + box.height / 2 - (symbolBox.top + symbolBox.height / 2),
              },
      });
    }

    return {
      strangers,
      plateChildren: Array.from(plate.children).map(describe),
      markCount: zone.querySelectorAll("[data-qr-mark]").length,
      markPadCount: zone.querySelectorAll("[data-qr-mark-pad]").length,
      errorCount: zone.querySelectorAll("[data-qr-error]").length,
      symbolCount: zone.querySelectorAll("[data-qr-symbol]").length,
      decorationsOnPlate,
      decorationCount: decorations.length,
      declaredDecorate: zone.getAttribute("data-qr-decorate"),
      marks,
    };
  });
}

/**
 * Chromium reports layout in 1/64 px, so a pad authored at exactly two modules of clearance
 * measures a hair under it. This is that quantum and nothing more — the failure this file
 * exists to catch is 30% against a 20% cap, four orders of magnitude away from it.
 */
const PX_EPSILON = 1 / 64;

/**
 * §8A.3's occlusion budget, transcribed. Returns the reasons a mark is illegal, or `[]`.
 *
 * Both halves are asserted: the mark's own area against the 20% cap and the 0.447 side
 * ratio, and — the stricter reading `<QrZone>` implements — the mark **plus its two-module
 * clearance pad**, because it is the pad that actually occludes modules.
 */
function markViolations(mark: MarkMeasurement): string[] {
  const reasons: string[] = [];
  const areaRatio = (mark.side - PX_EPSILON) ** 2 / mark.symbolSide ** 2;
  if (areaRatio > MAX_MARK_AREA_RATIO) {
    reasons.push(`area ${(areaRatio * 100).toFixed(1)}% exceeds the 20% budget (E-28)`);
  }
  if (mark.side - PX_EPSILON > MARK_MAX_SIDE_RATIO * mark.symbolSide) {
    reasons.push(`side ${mark.side.toFixed(1)}px exceeds 0.447 × the symbol`);
  }
  const clearance = (mark.padSide - mark.side) / 2;
  const requiredClearance = MIN_MARK_CLEARANCE_MODULES * mark.modulePx;
  if (clearance + PX_EPSILON < requiredClearance) {
    reasons.push(
      `clearance ${clearance.toFixed(1)}px is under ${MIN_MARK_CLEARANCE_MODULES} modules ` +
        `(${requiredClearance.toFixed(1)}px)`,
    );
  }
  const padRatio = (mark.padSide - PX_EPSILON) ** 2 / mark.symbolSide ** 2;
  if (padRatio > MAX_MARK_AREA_RATIO) {
    reasons.push(`mark + clearance pad occludes ${(padRatio * 100).toFixed(1)}% of the symbol`);
  }
  if (Math.abs(mark.centredOffset.x) > 1 || Math.abs(mark.centredOffset.y) > 1) {
    reasons.push("the mark is not centred — §8A.3 permits at most ONE CENTRED mark");
  }
  return reasons;
}

/* ── QR-T4, per template ──────────────────────────────────────────────────────────── */

for (const { template, card } of CARDS) {
  test(`QR-T4 · ${template.id} · the zone holds only what §8A.3 permits`, async ({
    page,
  }, testInfo) => {
    const viewport = PROJECT_VIEWPORT[testInfo.project.name];
    await gotoCardFace(page, card);

    const contents = await zoneContents(page);

    /* Exactly one real symbol, and the E-30 fallback plate was NOT taken — so what QR-T5
       decodes downstream is an encode of the payload rather than an apology for one. */
    expect(contents.symbolCount, "one symbol per zone").toBe(1);
    expect(
      contents.errorCount,
      `${template.id} rendered the E-30 "QR unavailable" plate — the encoder refused the ` +
        "payload, so this card has no working QR at all",
    ).toBe(0);

    /* §8A.7's QR-T4 in one line: the zone contains only the plate, the symbol and at most
       one mark. Anything else in there is an occlusion nobody declared. */
    expect(
      contents.strangers,
      `${template.id} at ${viewport}: unrecognised elements inside [data-qr-zone]`,
    ).toEqual([]);

    /* The plate's own children: the symbol, plus a mark pad if there is a mark. */
    expect(contents.plateChildren.length).toBeLessThanOrEqual(1 + contents.markPadCount);
    expect(contents.plateChildren.some((child) => child.includes("data-qr-symbol"))).toBe(true);

    /* AC-09(f) — at most one mark. */
    expect(contents.markCount, "§8A.3 permits at most ONE centre mark").toBeLessThanOrEqual(1);
    expect(contents.markPadCount).toBe(contents.markCount);

    /* …and if a template ever asks for one, it must be inside the budget. No template does
       today, so this loop is empty — which is why the last test in this file exists. */
    for (const mark of contents.marks) {
      expect(markViolations(mark), `${template.id} centre mark`).toEqual([]);
    }

    /* The gap QR-T3 leaves: the zone's own decoration must stay off the plate (§8A.4 —
       "corner tick marks outside the reserved region", "a caption below the plate"). */
    expect(
      contents.decorationsOnPlate,
      `${template.id} at ${viewport}: template decoration is painting on the plate (§8A.4)`,
    ).toEqual([]);
  });
}

/* ── the budget is a budget, not a formality ──────────────────────────────────────── */

/**
 * **Non-vacuity for the occlusion budget.**
 *
 * No template in the set requests a centre mark, so the per-template loop above measures
 * zero marks and would keep reporting green if `markViolations` returned `[]` unconditionally.
 * This performs E-28 — a mark at 30% of the symbol's area, past ECC H's whole recovery
 * budget — and requires it to be rejected, then repeats for an in-budget mark with too little
 * clearance and for an off-centre mark.
 *
 * The marks are injected into the live DOM. **No product code is modified.**
 */
test("QR-T4 · an over-budget centre mark is rejected (E-28)", async ({ page }) => {
  const { card } = CARDS[0];
  await gotoCardFace(page, card);

  /** Put a mark of `sideRatio × symbol` with `clearanceModules` of pad into the plate. */
  const inject = (sideRatio: number, clearanceModules: number, offsetPx: number) =>
    page.evaluate(
      ({ ratio, clearance, offset }) => {
        for (const stale of Array.from(document.querySelectorAll("[data-qr-mark-pad]"))) {
          stale.remove();
        }
        const zone = document.querySelector("[data-qr-zone]");
        const plate = document.querySelector("[data-qr-plate]");
        const symbol = document.querySelector("[data-qr-symbol]");
        if (zone === null || plate === null || symbol === null) throw new Error("no zone");

        const symbolSide = symbol.getBoundingClientRect().width;
        const modules = Number(zone.getAttribute("data-qr-modules"));
        const side = symbolSide * ratio;
        const pad = side + 2 * clearance * (symbolSide / modules);

        const padEl = document.createElement("span");
        padEl.setAttribute("data-qr-mark-pad", "");
        padEl.style.cssText =
          `position:absolute;width:${pad}px;height:${pad}px;` +
          `background-color:var(--qr-plate);display:flex;align-items:center;` +
          `justify-content:center;transform:translate(${offset}px, 0px)`;
        const markEl = document.createElement("span");
        markEl.setAttribute("data-qr-mark", "");
        markEl.style.cssText = `width:${side}px;height:${side}px;display:block;background-color:var(--qr-module)`;
        padEl.appendChild(markEl);
        plate.appendChild(padEl);
      },
      { ratio: sideRatio, clearance: clearanceModules, offset: offsetPx },
    );

  /* A conforming mark: 0.30 side → 9% area, two modules of clearance, centred. */
  await inject(0.3, 2, 0);
  const legal = await zoneContents(page);
  expect(legal.markCount).toBe(1);
  expect(markViolations(legal.marks[0])).toEqual([]);

  /* E-28: 0.55 side → 30.25% area, past ECC H's entire recovery budget. */
  await inject(0.55, 2, 0);
  const oversized = await zoneContents(page);
  expect(oversized.markCount).toBe(1);
  const oversizedReasons = markViolations(oversized.marks[0]);
  expect(oversizedReasons.length).toBeGreaterThan(0);
  expect(oversizedReasons.join(" ")).toContain("20% budget");

  /* In budget by area, but pressed right up against the modules. */
  await inject(0.3, 0, 0);
  const uncleared = await zoneContents(page);
  expect(markViolations(uncleared.marks[0]).join(" ")).toContain("clearance");

  /* In budget and cleared, but not centred — §8A.3 permits one CENTRED mark. */
  await inject(0.3, 2, 24);
  const offCentre = await zoneContents(page);
  expect(markViolations(offCentre.marks[0]).join(" ")).toContain("not centred");

  /* Two marks is never legal, whatever their sizes. */
  await inject(0.2, 2, 0);
  await page.evaluate(() => {
    const plate = document.querySelector("[data-qr-plate]");
    const pad = document.querySelector("[data-qr-mark-pad]");
    if (plate === null || pad === null) throw new Error("no pad to clone");
    plate.appendChild(pad.cloneNode(true));
  });
  const twoMarks = await zoneContents(page);
  expect(twoMarks.markCount).toBe(2);
  expect(twoMarks.markCount).toBeGreaterThan(1);
});
