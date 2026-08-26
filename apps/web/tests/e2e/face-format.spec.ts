import { expect, test } from "@playwright/test";

import { PALETTE_ORDER } from "@/card/template-palettes";

/**
 * The face format is identical on every template, and the QR fits inside the card.
 *
 * ## Why this suite has to be in a real browser
 *
 * Both claims are geometric, and the Vitest suite runs on happy-dom, which has no layout
 * engine — `getBoundingClientRect()` there returns zeroes. So the unit tests can assert the
 * *structure* of the face (which slots exist, how many pairs, no scroll container) and nothing
 * about where anything actually lands.
 *
 * That gap shipped a bug. Every card rendered its QR plate ending 15px below the card's own
 * bottom edge — and 47px below it on Lagoon, whose name wrapped to a second line and pushed
 * everything down. Eight clipped QR codes, invisible to `tsc`, to eslint and to 1,104 passing
 * unit tests, because not one of them could measure a box.
 *
 * ## What it asserts
 *
 * 1. **Nothing overflows the card.** Measured against the card root's own bounds, per element.
 * 2. **The QR plate is fully inside it**, with real clearance at the foot.
 * 3. **Every template agrees**, to the pixel, on where every slot sits. This is the one that
 *    enforces "one format": if a template moved its portrait or its symbol, the geometry of
 *    that card would differ from the other seven and this fails.
 */

/** The design size. Thumbnails are `transform: scale()`d, so measurements are normalised by it. */
const DESIGN_WIDTH = 336;

interface FaceMetrics {
  template: string;
  faceW: number;
  faceH: number;
  /** Worst-case overflow of any descendant past the card's bounds, in design px. */
  overflow: number;
  /** Slot origins, in design px relative to the card's top-left. */
  slots: Record<string, string>;
  /** Design px between the QR plate's bottom edge and the card's. */
  plateBottomGap: number;
  nameLineCount: number;
}

async function measure(page: import("@playwright/test").Page): Promise<FaceMetrics[]> {
  return page.evaluate((designWidth) => {
    const faces = [...document.querySelectorAll('[data-card-root][data-card-variant="face"]')];

    return faces.map((face) => {
      const fr = face.getBoundingClientRect();
      const scale = fr.width / designWidth;

      /* Every number below is divided by the thumbnail's scale, so a gallery tile and a
         full-size card produce the same figures and can be compared directly. */
      const rel = (selector: string): string => {
        const el = face.querySelector(selector);
        if (el === null) return "MISSING";
        const r = el.getBoundingClientRect();
        return [
          Math.round((r.left - fr.left) / scale),
          Math.round((r.top - fr.top) / scale),
          Math.round(r.width / scale),
          Math.round(r.height / scale),
        ].join(",");
      };

      let overflow = 0;
      for (const el of face.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        overflow = Math.max(
          overflow,
          Math.max(r.right - fr.right, fr.left - r.left, r.bottom - fr.bottom, fr.top - r.top) /
            scale,
        );
      }

      const plate = face.querySelector("[data-qr-plate]")?.getBoundingClientRect();
      const name = face.querySelector("[data-card-name]");
      const nameStyle = name === null ? null : getComputedStyle(name);

      return {
        template: (face as HTMLElement).dataset.templateId ?? "?",
        faceW: Math.round(fr.width / scale),
        faceH: Math.round(fr.height / scale),
        overflow: Math.round(overflow * 10) / 10,
        slots: {
          mark: rel("[data-card-mark]"),
          portrait: rel("[data-card-portrait]"),
          role: rel("[data-card-role]"),
          name: rel("[data-card-name]"),
          pairs: String(face.querySelectorAll("[data-card-pair]").length),
          plate: rel("[data-qr-plate]"),
        },
        plateBottomGap:
          plate === undefined ? -1 : Math.round((fr.bottom - plate.bottom) / scale),
        nameLineCount:
          name === null || nameStyle === null
            ? 0
            : Math.round(
                name.getBoundingClientRect().height / Number.parseFloat(nameStyle.lineHeight),
              ),
      };
    });
  }, DESIGN_WIDTH);
}

test.describe("the share-face format", () => {
  test("is identical on every colour, and nothing is clipped", async ({ page }) => {
    await page.goto("/templates");
    await page.locator("[data-card-root]").first().waitFor();

    const metrics = await measure(page);
    /* Derived, not hard-coded: this said 8, then 2, and had to be hand-edited each time the set
       changed shape. The gallery renders one card per PALETTE, so that is the count — and the
       identical-format claim below is stronger for it, since it now spans nine colours rather
       than a handful of templates. */
    expect(metrics.length, "expected every colour to render a face").toBe(PALETTE_ORDER.length);

    for (const m of metrics) {
      /* 1. Nothing paints outside the card. */
      expect(m.overflow, `${m.template} overflows its own card by ${m.overflow}px`).toBe(0);

      /* 2. The QR plate is fully inside it, with clearance. This is the assertion that was
            missing when eight cards shipped with their symbols hanging off the bottom. */
      expect(
        m.plateBottomGap,
        `${m.template}: QR plate ends ${-m.plateBottomGap}px past the card's bottom edge`,
      ).toBeGreaterThan(0);

      /* 3. One line of name, on every card. Two lines on one card and one on the next is the
            format varying with the data — and it is what pushed Lagoon's QR off the canvas. */
      expect(m.nameLineCount, `${m.template} wraps its name`).toBe(1);
      expect(m.slots.plate, `${m.template} has no QR plate`).not.toBe("MISSING");
    }

    /* 4. THE format assertion: every slot, on every card, at the same coordinates. Reduced to
          one string per card so a failure prints the two layouts side by side. */
    const signatures = new Map<string, string[]>();
    for (const m of metrics) {
      const signature = JSON.stringify({ w: m.faceW, h: m.faceH, ...m.slots });
      const list = signatures.get(signature) ?? [];
      list.push(m.template);
      signatures.set(signature, list);
    }

    expect(
      [...signatures.entries()].map(([sig, templates]) => `${templates.join("+")} → ${sig}`),
      "every colour must place every slot identically — colour is the ONLY permitted variation",
    ).toHaveLength(1);
  });

  test("renders the design size at full scale, with the QR inside it", async ({ page }) => {
    /* Measured on the card-detail route rather than the marketing hero. The hero rotates its
       card `-2deg` for effect — via the standalone `rotate` property, which `transform`
       reports as `none` — and an axis-aligned bounding rect of a rotated 360×520 box measures
       378×532. That is decoration, not a format difference, and comparing rects across the two
       pages measures the rotation rather than the card.

       `offsetWidth`/`offsetHeight` are used for the size for the same reason: they are the
       untransformed border box, so this assertion holds wherever the card is decorated. */
    await page.goto("/cards/card_midnight_demo");
    const face = page.locator('[data-card-root][data-render-mode="full"]').first();
    await face.waitFor();

    const box = await face.evaluate((el) => {
      const plate = el.querySelector("[data-qr-plate]") as HTMLElement | null;
      return {
        w: (el as HTMLElement).offsetWidth,
        h: (el as HTMLElement).offsetHeight,
        plateW: plate?.offsetWidth ?? -1,
        /* Offset parents differ down the tree, so walk the chain to get a card-relative top. */
        plateBottom: (() => {
          if (plate === null) return -1;
          let top = 0;
          let node: HTMLElement | null = plate;
          while (node !== null && node !== el) {
            top += node.offsetTop;
            node = node.offsetParent as HTMLElement | null;
          }
          return top + plate.offsetHeight;
        })(),
      };
    });

    expect(box.w).toBe(DESIGN_WIDTH);
    expect(box.h).toBe(500);

    /* The symbol clears the 140px scannable floor and still fits, with clearance at the foot. */
    expect(box.plateW).toBeGreaterThanOrEqual(140);
    expect(box.plateBottom).toBeGreaterThan(0);
    expect(
      box.h - box.plateBottom,
      `QR plate ends ${box.plateBottom - box.h}px past the card's bottom edge`,
    ).toBeGreaterThan(0);
  });
});
