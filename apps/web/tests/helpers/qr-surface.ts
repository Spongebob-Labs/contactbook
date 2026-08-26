import { expect, type Locator, type Page } from "@playwright/test";

import type { ContactCard } from "@/types/domain";

import { gotoReady } from "./e2e";

/**
 * **Where the QR lives, and how to get to it safely, for the five suites that measure it.**
 *
 * ## The migration this module records
 *
 * QR-T1 through QR-T5 used to address every card as `/c/{slug}` — the public scan page — because
 * that page rendered a `<QrZone>` at its foot. It no longer does, and the reason is recorded at
 * the head of `src/card/card-page.tsx`: a QR on the page a reader has already opened encodes the
 * URL of the page they are already on. It was a reload button wearing a symbol.
 *
 * **The QR did not go anywhere.** It lives on the `<ShareFace>` — the object that actually gets
 * handed over — and this run's assertions moved with it rather than being deleted. Not one QR
 * assertion was dropped in the move; the per-file notes say where each one now runs.
 *
 * ## Why `/cards/{id}` and not the builder
 *
 * Two surfaces render `<ShareFace mode="full">`:
 *
 * · **`/cards/[cardId]`** — the owner's card-detail screen, which paints the face at its
 *   **unscaled 336 × 500 design size**. Every constant in `qr-geometry.ts` was derived at that
 *   width (`qrSizePx(336) = 141.12`, one pixel over the 140px scannable floor), so this is the
 *   only place a *geometric* assertion measures what the spec actually specifies.
 * · **the builder's pinned preview** — a real `mode="full"` face, but `transform: scale()`d to
 *   fit a pane capped at half a phone's height. At 360 its symbol is ~92 CSS px. That is a
 *   preview to look at, not a code to scan, and a geometry assertion there would be measuring
 *   the pane's zoom level. `qr-scannability.spec.ts` is the only file that touches it, and only
 *   to prove the *payload* is the card's own — see the note on that test.
 *
 * ## ⚠ THE TWO TRAPS THE `(app)` SHELL ADDS, AND WHY {@link gotoCardFace} IS NOT OPTIONAL
 *
 * The public card page carried no chrome and resolved in one flush. The card-detail screen does
 * neither, and both differences produced real failures during the migration. Navigate through
 * {@link gotoCardFace} and both are handled; navigate with a bare `gotoReady` and they come back
 * intermittently, at one viewport, looking like product bugs.
 *
 * 1. **The segment can arrive after `load`.** §6.1 R-12 requires a `loading.tsx`, which is a
 *    `<Suspense>` boundary, so the shell — skeleton and all — flushes first and the card follows
 *    in the stream. `waitForStreamedReveal` cannot help: it waits for a *revealed* segment to be
 *    detached, and a segment that has not arrived yet leaves nothing to wait for, so the
 *    predicate is already true. A suite whose first act is `page.evaluate` therefore reads the
 *    skeleton and throws "no zone or no plate". Suites whose first act is a Playwright
 *    auto-retrying `expect` never saw it, which is exactly why it presented as a flake. The fix
 *    is an explicit `waitFor` on the plate.
 * 2. **The mobile bottom bar is `position: fixed` and `--surface`, and it covers the plate.**
 *    At 360×800 the plate lands low enough that Playwright's own `scrollIntoViewIfNeeded` parks
 *    it under the 64px bar, and an element screenshot then captures the bar: measured, the top
 *    quiet-zone band sampled `rgb(250, 250, 250)` — `--surface` exactly — instead of the plate's
 *    `#FFFFFF`, and QR-T2 reported a translucent plate on a build whose plate is opaque.
 *    `qr-scannability.spec.ts` had already recorded this trap against a *decode*; it turns out
 *    to bite every pixel assertion, so {@link centreZone} is applied on arrival for all of them.
 */

/** The route that renders a card's share face at its unscaled design size. */
export function cardFaceRoute(card: Pick<ContactCard, "id">): string {
  return `/cards/${card.id}`;
}

/**
 * The width the face's geometry is derived from — `FACE_WIDTH`, published by the zone as
 * `data-qr-host`. Stated here so a suite can assert it rather than infer it, and so the one
 * place that would have to change if the face were ever resized is findable.
 */
export const FACE_HOST_WIDTH = 336;

/**
 * Bring an element to the middle of the viewport, clear of anything pinned to an edge.
 *
 * `scrollIntoView({ block: "center" })` rather than Playwright's `scrollIntoViewIfNeeded`,
 * which stops as soon as the element is technically in the viewport — including when it is in
 * the viewport *and* underneath a fixed bar. See trap 2 above.
 */
export async function centreZone(locator: Locator): Promise<void> {
  await locator.evaluate((node) => {
    node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
  });
}

/**
 * Navigate to a card's face and return its QR zone, ready to measure.
 *
 * Everything in the five QR suites goes through here. It is `gotoReady` plus the two things the
 * `(app)` shell makes necessary — wait for the streamed segment to actually paint the plate,
 * then centre the zone away from the fixed bottom bar.
 */
export async function gotoCardFace(page: Page, card: Pick<ContactCard, "id">): Promise<Locator> {
  await gotoReady(page, cardFaceRoute(card));

  const zone = page.locator("[data-qr-zone]");
  /* The plate, not the zone: the zone is a `width: fit-content` flex column that exists the
     instant the card renders, while the plate is the box every assertion downstream measures.
     Waiting on the thing that gets measured is what makes the wait meaningful. */
  await page.locator("[data-qr-plate]").waitFor({ state: "visible" });
  await expect(zone, "the card-detail screen renders exactly one share face").toHaveCount(1);
  await centreZone(zone);

  return zone;
}
