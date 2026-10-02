import { expect, test, type Page } from "@playwright/test";

import { derivePalette } from "@/card/derive-palette";
import { TEMPLATE_PALETTES } from "@/card/template-palettes";
import { FIXTURE_DB } from "@/fixtures";

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

/** `#5B1626` → `rgb(91, 22, 38)`, which is the form `getComputedStyle` reports. */
function rgbOf(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * The card builder — `/cards/new` and `/cards/[cardId]/edit` (spec §8D.4, §4.4, plan T23).
 *
 * ## What this suite is responsible for
 *
 * §8D.4 is written against four recorded failures of the old build, and this file is the machine
 * check on the three a screen can be wrong about:
 *
 * 1. **AC-36 / §11 E-01 — the zero-field card.** The old build shipped card `5a286f9e` with no
 *    mappings and produced a **73-byte** name-only `.vcf`. The builder must show the warning bar,
 *    report `data-field-count="0"` and offer a Save that is `aria-disabled` with a stated reason —
 *    **while still rendering the preview**, because a consequence nobody can see is a consequence
 *    nobody acts on. It is asserted from both directions: the card that maps nothing, and the same
 *    card the moment a field is ticked.
 * 2. **AC-29 — split view, live.** The preview is visible without scrolling at 360, 768 and 1440,
 *    and every control reaches it with **no intermediate commit action**. No wizard, no "apply",
 *    exactly one Save.
 * 3. **§11 E-42** — ten selections in two seconds settle on the last with nothing stale, and
 *    **§11 E-40** — a card whose fields have left the profile says so in words rather than
 *    rendering a ghost row.
 *
 * It does **not** decode the QR: that is QR-T5, run for every template × viewport in T27's
 * `qr-scannability.spec.ts`, and duplicating the run's most flake-prone assertion here buys no
 * coverage (§16.1 R-2). It asserts only that the reserved zone is present and singular.
 *
 * ## What changed from the version this replaces
 *
 * The previous 27 tests were skipped wholesale while the builder was a placeholder. Every guard
 * they described is back; three of their assumptions are gone because the product moved:
 *
 * · **Eight templates became two, and a colour axis appeared.** **Colour** (nine palettes)
 *   replaced "Theme" — `buttonFill`, `buttonRadius`, `avatarKind` and `textOnMedia` no longer
 *   exist on `CardTemplate`, and were four controls for differences invisible past arm's length.
 *   That axis has since become **Design**, and the four controls in it are differences you can
 *   see from across a room.
 * · **A new card is seeded.** It opens on the first template's field preset rather than at zero,
 *   because that is what both gallery captions promise. E-01 is reached by `card_empty_demo`, by
 *   an empty profile, and by unticking — three paths rather than one, all asserted below.
 * · **Two font variables are gone.** `typeFamily` was a per-template axis; the product is one
 *   family now, so there is no `[data-card-fonts]` wrapper to check for.
 *
 * ## ⚠ THE FIELDS SECTION IS A LIST PLUS A MODAL, AND THE PREVIEW IS THE CARD PAGE
 *
 * Two shape changes since the version this replaces, both of which delete locators rather than
 * assertions:
 *
 * · **⚠ The checkbox list came BACK, and the two things that replaced it are both deleted.**
 *   The Fields section went: a checkbox list over the profile → a list of the card's own fields
 *   with a `+ Add` **modal** → the same list with two columns of offers under it → **one ticked
 *   list over the whole profile**, which is where it is now. So `getByRole("checkbox").click()`
 *   is right again, and {@link addField} / {@link removeField} are both a click on one row's
 *   tick. What did not come back is the per-group `n/m` counter: the header meter is the one
 *   count, and the categories are quiet group bands inside the single list rather than a rail
 *   or a filter. The section note above `the Fields panel lists the whole profile` tables every
 *   test the last two shapes took with them and names where each claim lives now.
 * · **The pane previews the card PAGE, in a phone frame — not the share face.** The two objects
 *   did not change; which of them is the product did. The face is the *wallet pass*: rigid
 *   336×500, a name, two details and the QR, rendered unscaled on `/cards/[cardId]`, where the
 *   whole QR contract suite measures it. The page is the card: the Linktree-shaped surface a
 *   scanned QR lands on, carrying every mapped field. An owner adding their seventh field must
 *   be looking at the object that will show it.
 *
 *   Three consequences for this file, each spelled out at the test that carries it:
 *
 *     1. **There is no QR in the preview and no `[data-qr-plate]` to contain.** AC-29's
 *        containment chain is re-derived below against the card page's own geometry.
 *     2. **There is no `scale()`.** The face was transform-scaled because it is rigid; the page
 *        is `width: 100%` and simply lays out at phone width. The mechanism assertion becomes
 *        its opposite — *no* transform, and no declared height on the card.
 *     3. **The frame scrolls and the card does not.** `<CardPage>` carries no `overflow` and no
 *        height anywhere, which is the defect that forced the rebuild; the preview must not put
 *        one back, so the frame around it is the scroller. Asserted structurally below, and
 *        per-template without a browser in `tests/unit/card-variants.test.tsx`.
 *
 * ## ⚠ The tabs are gone, and so is the template picker — what moved here, and what did not
 *
 * The control column was a Radix tab set (Template / Fields / Colour) and is now **one scrolling
 * column: Fields and Design**, each an `<h2>` section behind a `data-builder-section` hook.
 * Every `[data-builder-tab=…]` click and every `[data-builder-panel=…]` locator below went with
 * it — a click on a tab that does not exist is a test that fails for the wrong reason, and a
 * click that is merely *unnecessary* is worse, because it passes while asserting nothing.
 *
 * ## ⚠ Colour became **Design**, and it grew three axes
 *
 * The second section is the card's material system (`@/card/card-surface`): a **background
 * colour** the owner may pick freely, a **wallpaper style**, a **pattern** and a **header
 * layout**. Four consequences for this file, each asserted at the test that carries it:
 *
 * · **`[data-palette-picker]` no longer exists, and neither do its nine `<ShareFace>` cells.**
 *   The colour axis is `[data-background-picker]`: nine painted grounds plus a real colour
 *   input, one selected state across both, because a preset and a free colour are the same
 *   decision. The cells stopped being wallet passes because a pass cannot show a wallpaper.
 * · **The builder screen now carries no QR at all**, which the pane's own test states.
 *   `tests/e2e/qr-scannability.spec.ts` still counts nine picker thumbnails and belongs to
 *   another track — see the note there in "the preview carries no QR".
 * · **Free colour has a floor.** `derivePalette` clamps a ground that cannot carry legible text
 *   and hands back a sentence about it; the panel shows that sentence calmly, and this file
 *   asserts its *register* — `status`, not `alert`, never the danger colour, Save untouched —
 *   as carefully as its presence.
 * · **The Pattern control is absent outside pattern mode**, not disabled. A control for a mode
 *   you are not in is noise, and "absent" is the only honest way to say so.
 *
 * **The template picker UI was deleted, and nine tests here went with it.** They were not
 * redundant coverage being dropped: every rule they exercised is the reducer's, and every one of
 * them is asserted directly — without a browser — in `tests/unit/builder-reducer.test.ts`. The
 * mapping is spelled out at the point each one used to sit, so a reader who comes looking for
 * "where did the never-re-seed-an-existing-card test go" finds the answer rather than a gap.
 * The reducer still supports a `template` action with all of its behaviour intact; nothing in the
 * UI dispatches it, which is exactly why the coverage belongs at the unit level now.
 *
 * Every navigation goes through `gotoReady`, so animations are dead and `document.fonts` has
 * settled before anything is measured (§14.6, R-10).
 */

/** `/cards/new` is a **static** segment and beats `/cards/[cardId]` (§11 E-38, AC-05). */
const NEW = "/cards/new";

/** `card_empty_demo` — zero mappings, newest by `updatedAt`. The whole reason for AC-36. */
const EDIT_EMPTY = "/cards/card_empty_demo/edit";

/** The §6.7 worked card: Work, five mapped fields, Meridian. */
const EDIT_LEDGER = "/cards/card_minimal_demo/edit";

/** The preview's card — never one of the panel's swatches. */
const PREVIEW_CARD = "[data-builder-preview] [data-card-root]";

/**
 * A ground the owner might pick that the system can honour as given.
 *
 * Deep blue, relative luminance ≈ 0.017 — comfortably below `LEGIBILITY_DEAD_BAND.min`, so white
 * ink clears the 7:1 headroom rule on it and `derivePalette` returns it unmoved. Written as a
 * constant with its arithmetic recorded because the whole point of the pair below is that one of
 * them is legal and the other is not; a reader who cannot tell which is which cannot read either
 * test.
 */
const OWN_COLOUR = "#10243F";

/**
 * A ground the system cannot honour: mid grey, relative luminance ≈ 0.212, inside the dead band
 * `LEGIBILITY_DEAD_BAND` describes — white ink measures under 7:1 on it and so does near-black.
 * There is no third ink, so the colour is moved to the nearer edge and the owner is told.
 */
const DEAD_BAND_COLOUR = "#7F7F7F";

/**
 * Meridian's preset, resolved against the fixture profile — what a **new** card opens on.
 *
 * Marigold's used to sit beside it, for the tests that clicked the template picker. Those are
 * gone with the picker; `tests/unit/template-seed.test.ts` covers both presets against the
 * profile directly, which is where a claim about `seedFieldIds` belongs anyway.
 */
const MERIDIAN_SEED = ["field_work_phone", "field_work_email"];

/**
 * ⚠ Kept deliberately — a real assertion, no longer the only barrier.
 *
 * §6.1 R-11 and R-13 both require a `loading.tsx`, a `loading.tsx` **is** a `<Suspense>` boundary
 * around the segment, and that fallback carries a `data-screen-state="loading"` root of its own
 * (§13.2). One streamed response can therefore hold **two** roots until React swaps the fallback
 * out, and Playwright never retries a strict-mode violation — so this used to be the
 * synchronisation point that waited the swap out. `gotoReady` now does that for every spec in the
 * run (`waitForStreamedReveal`, D14), so the timing role is gone. The `toHaveCount(1)` stays
 * because it is also the claim that the route serves *exactly one* root.
 */
async function screenStateRoot(page: Page) {
  const root = page.locator("[data-screen-state]");
  await expect(root).toHaveCount(1);
  return root;
}

/**
 * The field ids this card maps — **the ticked rows**, in the list's order.
 *
 * ⚠ **`[data-field-on]` is the whole helper, and leaving it off is how this went wrong.** The
 * Fields panel used to be a list of the card's own fields, so every `[data-field-row]` in it was
 * a mapping; it lists the **whole profile** now, ticked, so the same selector answers "what
 * could this card share" — 35 rows on the fixture profile — and every `toEqual([...])` below
 * would have been comparing a card against a profile.
 *
 * ⚠ **SORTED, so no caller can read an order into it.** The panel lists the profile in the
 * profile's display order, which is *not* the card's §6.4 render order — the Ledger card's ticks
 * come back `job_title, company, work_phone, site_url` where the card renders
 * `work_phone, work_email, site_url, job_title, company`. Returning DOM order here invited every
 * caller to assert the wrong sequence and call it a regression. This helper answers **which
 * fields are mapped**; {@link previewFieldIds} answers **in what order the card renders them**,
 * off the card itself, resolved through the same `resolveCard` the public page uses (I-5).
 */
async function cardFieldIds(page: Page): Promise<string[]> {
  const ids = await page
    .locator("[data-field-picker] [data-field-row][data-field-on]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-field-row") ?? ""));
  return ids.sort();
}

/**
 * The field ids the previewed card **renders**, in §6.4's canonical order.
 *
 * ⚠ Not a duplicate of {@link cardFieldIds}: that one reads the panel's ticks (what is mapped),
 * this one reads the card (what is rendered, in what order). They differ by design in two ways
 * — a mapped field whose value is blank is dropped by the resolver (§11 E-07), and a mapped
 * `PHOTO` is consumed by the avatar slot and never rendered as a row — so a test asserting
 * *order* must read this and a test asserting *mapping* must read the other.
 */
async function previewFieldIds(page: Page): Promise<string[]> {
  return page
    .locator("[data-builder-preview] [data-card-field]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-card-field") ?? ""));
}

/**
 * Select one of the builder's three panels.
 *
 * ⚠ **New, and it is the whole shape of the change the rail underwent.** The controls used to be
 * one scrolling column with every section mounted, so a design test could click a swatch the
 * moment the page settled. They are a **tab set** now — one panel mounted at a time, the rest
 * not in the document — so reaching a background swatch means selecting Design first, exactly as
 * an owner does. Every test below that touches a Design control opens its panel here,
 * and that call is not ceremony: it is the first step of the journey being tested.
 *
 * `?panel=` would deep-link the same panel without a click, and is deliberately *not* used for
 * this. A URL that arrives pre-selected proves the deep link works (its own test, below) and
 * proves nothing about the rail; clicking is what keeps these tests honest about the control.
 */
async function openPanel(page: Page, panel: "fields" | "design") {
  await page.locator(`[data-builder-nav-item="${panel}"]`).click();
  await expect(page.locator(`[data-builder-section="${panel}"]`)).toBeVisible();
}

/**
 * The colour of the **previewed card's** ground layer.
 *
 * Scoped to `[data-builder-preview]` because the Design panel's cells render the very same
 * `<CardGround>` — that is what makes them previews of the treatment rather than pictures of it
 * — so an unscoped `[data-card-ground]` matches two dozen elements and Playwright's strict mode
 * is right to refuse it.
 */
async function previewGround(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const ground = document.querySelector("[data-builder-preview] [data-card-ground]");
    return ground === null ? null : getComputedStyle(ground).backgroundColor;
  });
}

/** One profile field, from the fixtures, so a test can name a row by its own label. */
function fixtureField(fieldId: string) {
  const field = FIXTURE_DB.fields.find((candidate) => candidate.id === fieldId);
  if (field === undefined) throw new Error(`no fixture field "${fieldId}"`);
  return field;
}

/* ⚠ `categoryOf()` is gone with the modal's category rail. It answered "which rail entry lists
   this field", and the categories are group bands *inside* the one list now — a row is reached
   by its id, never by navigating to its category first. */

/**
 * Bring the Fields panel into view.
 *
 * ⚠ THIS USED TO OPEN A MODAL, AND THERE IS NO MODAL ANY MORE. `add-field-dialog.tsx` was
 * replaced by two permanent columns on the panel itself (`field-sources.tsx`) after the client
 * asked *"why it opens a pop-up? There is a lot of white space below that"*. So the whole
 * open/close dance is gone: the profile's other fields and the create form are simply present.
 *
 * The helper survives, narrowed to "make sure we are on the Fields panel", because a dozen
 * tests were calling it to get there and the panel is one of several tabs.
 */
async function openAddField(page: Page) {
  const picker = page.locator("[data-field-picker]");
  if ((await picker.count()) === 0) {
    await page.locator('[data-builder-nav-item="fields"]').click();
  }
  await expect(picker).toBeVisible();
}

/**
 * Add one field to the card, the way an owner now does: press the `+` on its row.
 *
 * ⚠ The old helper went through the modal's **category rail** — open, click the category, click
 * the row's Add, wait for it to read "Added", press Escape. Three of those five steps described
 * mechanisms that no longer exist, and the fourth is now false by design: a field that has been
 * added **leaves this list** rather than reading "Added", because on a panel the row moving up
 * into the card's own list is the confirmation. See `field-sources.tsx`.
 *
 * So the wait inverts. It waits for the offer row to *disappear*, which is the same guarantee
 * the old wait gave — a test adding two fields in a row cannot race the second click against
 * the first re-render — expressed against the behaviour that replaced it.
 */
async function addField(page: Page, fieldId: string) {
  await openAddField(page);
  /* ⚠ THE ROW DOES NOT MOVE AND MUST NOT BE WAITED ON TO MOVE. Two earlier versions of this
     helper waited for the row to read "Added" (the modal) and then for it to *leave* an offer
     list (the two-column layout). Both encoded a layout that was rejected. The list is one
     ticked list now: the row stays exactly where it is and its tick changes, so that is what
     the wait watches. */
  await page.locator(`[data-field-tick="${fieldId}"]`).click();
  await expect(page.locator(`[data-field-row="${fieldId}"][data-field-on]`)).toHaveCount(1);
}

/**
 * Take one field off the card — by unticking its row.
 *
 * ⚠ **There is no per-row remove button anywhere on this screen, and its absence is the
 * design.** The tick is the only control, so "is this on the card?" has exactly one place it can
 * be changed and the row cannot move while it is changed. `[data-field-remove]` belonged to the
 * card's own field list, which was deleted for restating the preview beside it.
 */
async function removeField(page: Page, fieldId: string) {
  await page.locator(`[data-field-tick="${fieldId}"]`).click();
  await expect(page.locator(`[data-field-row="${fieldId}"][data-field-on]`)).toHaveCount(0);
}

/* ── AC-05 / E-38: the static segment wins ───────────────────────────────────────── */

test("/cards/new resolves to the builder, not to the detail screen (AC-05, E-38)", async ({
  page,
}) => {
  await gotoReady(page, NEW);

  await expect(page).toHaveURL(/\/cards\/new$/);
  await expect(page.locator("[data-builder]")).toHaveCount(1);
  await expect(page.locator("[data-builder-header]")).toHaveCount(1);
  // The name is editable in place — there is no separate "rename" screen.
  await expect(page.locator("[data-builder-name]")).toHaveValue("Untitled card");
});

test("the shell keeps the only main landmark (AC-25)", async ({ page }) => {
  await gotoReady(page, NEW);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("main#main")).toHaveCount(1);
});

/* ── the template preset: what makes a template mean anything ─────────────────────── */

/**
 * ⚠ **Four tests used to live in this block and are deliberately gone**, along with the template
 * picker they clicked. Each one's guard is still guarded — by the reducer's own suite, which
 * asserts the same rule as a pure function of state instead of through two DOM round trips:
 *
 * · "switching template on an untouched new card re-seeds it"
 * · "switching template NEVER re-seeds an existing card"
 * · "once the owner ticks something, no preset overwrites them"
 * · the caption half of the test below — the template cell whose blurb had to agree with the
 *   fields it handed over
 *
 * → all four in **`tests/unit/builder-reducer.test.ts`** (the `template` action's cases), with
 * the preset resolution itself in `tests/unit/template-seed.test.ts`. The reducer still supports
 * a template change with every one of those rules intact; there is simply no control in the UI
 * that dispatches it, so an e2e test would have nothing to click.
 *
 * What survives here is the half that is genuinely a screen claim: a new card **arrives** seeded.
 */
test("a new card still opens on the first template's preset, seeded from the profile", async ({
  page,
}) => {
  await gotoReady(page, NEW);

  await expect(page.locator(PREVIEW_CARD)).toHaveAttribute("data-template-id", "meridian");
  await expect(page.locator("[data-builder]")).toHaveAttribute(
    "data-builder-field-count",
    String(MERIDIAN_SEED.length),
  );
  // Not just the count: the *right* two fields are ticked…
  expect(await cardFieldIds(page)).toEqual([...MERIDIAN_SEED].sort());
  // …and the card the preview is showing renders exactly those, in §6.4's order.
  expect(await previewFieldIds(page)).toEqual(MERIDIAN_SEED);
});

/* ── AC-29: the split view, at all three viewports ───────────────────────────────── */

test("the preview is visible without scrolling, and the page never scrolls sideways (AC-29)", async ({
  page,
}, testInfo) => {
  const width = PROJECT_VIEWPORT[testInfo.project.name];
  expect(width, `unknown project ${testInfo.project.name}`).toBeDefined();

  await gotoReady(page, EDIT_LEDGER);

  const preview = page.locator("[data-builder-preview]");
  await expect(preview).toBeVisible();

  // Nothing has scrolled: `gotoReady` navigates and waits, it never scrolls.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(preview).toBeInViewport();

  /**
   * **The containment chain, re-derived for a card that is a page.**
   *
   * It used to read *plate ⊆ card ⊆ frame ⊆ viewport*, and two of those three links only made
   * sense while the pane previewed the rigid face:
   *
   * · `plateInsideCard` — there is no QR on the card page at all (see `card-page.tsx`), so
   *   there is no plate to contain. The claim itself is not lost: §8A.3's plate geometry is
   *   asserted on the surface that renders a plate, in `qr-plate.spec.ts` and
   *   `qr-geometry.spec.ts`, against the unscaled face on `/cards/[cardId]`.
   * · `cardInsideFrame` — **deliberately inverted.** The card page is as tall as the owner's
   *   field list, so requiring it to fit inside a half-viewport frame would be requiring it to
   *   clip itself, which is the exact defect the rebuild exists to close. What must hold is the
   *   *width* — a card wider than its frame is a sideways scrollbar in an editor pane — and the
   *   *mechanism*: the frame is the scroller and the card declares no height and no overflow.
   *
   * `frameInsideViewport` survives unchanged and is still the one that caught a real defect: a
   * declared `lg:h-[500px]` here put the bottom of the preview 3px under the fold at 1280×720,
   * and `toBeInViewport()` on the pane passed anyway because the pane's *top* was on screen.
   */
  const fits = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>("[data-builder-preview] [data-card-root]");
    const frame = document.querySelector<HTMLElement>("[data-preview-frame]");
    if (card === null || frame === null) return null;
    const c = card.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    const cardStyle = getComputedStyle(card);
    return {
      frameInsideViewport: f.bottom <= window.innerHeight + 0.5 && f.top >= -0.5,
      cardFitsFrameWidth: c.left >= f.left - 0.5 && c.right <= f.right + 0.5,
      cardStartsAtFrameTop: c.top >= f.top - 0.5 && c.top <= f.top + 2,
      // ⚠ The card has no scroll container and no height of its own. The frame owns both.
      cardOverflowY: cardStyle.overflowY,
      cardDeclaredHeight: card.style.height,
      cardDeclaredMaxHeight: card.style.maxHeight,
      frameOverflowY: getComputedStyle(frame).overflowY,
    };
  });
  expect(fits).toEqual({
    frameInsideViewport: true,
    cardFitsFrameWidth: true,
    cardStartsAtFrameTop: true,
    cardOverflowY: "visible",
    cardDeclaredHeight: "",
    cardDeclaredMaxHeight: "",
    frameOverflowY: "auto",
  });

  // The pinned pane comes first in DOM order at every width (T09's contract), which is what
  // makes "visible without scrolling" true on a phone as well as a desktop.
  const previewFirst = await page.evaluate(() => {
    const pinned = document.querySelector("[data-split-pinned]");
    const content = document.querySelector("[data-split-content]");
    if (pinned === null || content === null) return null;
    return (pinned.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  expect(previewFirst).toBe(true);

  // §11 E-15, and it did not get easier when the scaling went away: the card page reflows, but
  // a single unbroken 60-character token inside it does not, and the preview pane at 360 is
  // ~312px wide. The frame is `overflow-x: hidden` so nothing inside it can reach the document.
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
});

test("the controls are reachable without scrolling too", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);

  // A builder whose every control is below the fold is a builder nobody can use. The mobile
  // preview cap is chosen to keep both true at 360×800 — see the note in `builder-client.tsx`.
  //
  /* Asserted on the panel's **head**, not on `[data-builder-section="fields"]`: the section is a
     thousand pixels tall, so `toBeInViewport()` on it passes on any sliver of intersection and
     would keep passing with every actual control pushed off the bottom of the screen. This used
     to be `[data-builder-tabs]`, which was small for the same reason.

     ⚠ And it is the *card-name* input rather than the `<h2>`, because the `<h2>` is `sr-only`
     now — a 1px clipped box is never "in viewport", and the visible title of the panel is the
     card's name (`panel-head.tsx`). This is strictly the better proxy anyway: it is the first
     thing an owner sees inside the controls, and it is a control rather than a label. */
  await expect(page.locator("[data-panel-head] [data-builder-name]")).toBeInViewport();
});

test("the pinned pane stays put while the controls scroll (§8D.4)", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);

  const preview = page.locator("[data-builder-preview]");
  await expect(preview).toBeInViewport();

  // Scroll a long way down — with both sections stacked the column is taller than it ever was
  // behind tabs, so this lands well inside the field list rather than past the end of it.
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect(preview).toBeInViewport();
});

/**
 * ⚠ **This replaces "renders exactly one QR zone in the preview, and it is a real symbol
 * (AC-11)", and it asserts the opposite.**
 *
 * That test was correct while the pane previewed the face. It does not any more, and there is no
 * QR on the card page — `card-page.tsx` states the reason at length and it is worth repeating
 * here, because "add a QR back" is a tempting one-line change: whoever is looking at the page has
 * *already opened the card*, so a symbol down there encodes the URL of the document they are
 * reading. It is a button that reloads the current page dressed up as a share affordance.
 *
 * AC-11's real claim — the card the owner is judging carries a symbol that decodes to that
 * card's own payload — moved to the surface that carries one: `qr-scannability.spec.ts` decodes
 * the unscaled face on `/cards/[cardId]`, and `qr-geometry.spec.ts` measures it there.
 */
test("the preview carries no QR — the page it previews has none (see card-page.tsx)", async ({
  page,
}) => {
  await gotoReady(page, EDIT_LEDGER);

  await expect(page.locator(PREVIEW_CARD)).toHaveCount(1);
  await expect(
    page.locator('[data-builder-preview] [data-card-root][data-render-mode="full"]'),
  ).toHaveCount(1);

  // Said three ways, so a partial regression cannot slip through on the one hook nobody checked.
  await expect(page.locator("[data-builder-preview] [data-qr-zone]")).toHaveCount(0);
  await expect(page.locator("[data-builder-preview] [data-qr-symbol]")).toHaveCount(0);
  await expect(page.locator("[data-builder-preview] [data-qr-plate]")).toHaveCount(0);

  /* ⚠ **And now there is no QR anywhere on this screen at all**, which is a change of fact
     rather than a strengthening of the test. The colour picker used to render nine `<ShareFace>`
     thumbnails, each carrying the §8A.5 *preview* payload, and this file asserted their nine
     zones so "no QR in the pane" could not be misread as "no QR on this screen".

     The Design panel's cells are painted grounds, not wallet passes — because wallpapers,
     patterns and header layouts do not apply to the pass (DESIGN.md), so a colour cell drawn as
     one would have ignored three of the four controls beside it. With the faces went their
     symbols, and the honest claim is the simpler one below.

     ⚠ `tests/e2e/qr-scannability.spec.ts` still counts nine of those thumbnails inside
     `[data-palette-picker]`. That file belongs to the QR track and is not edited from here; the
     block it needs to lose is the "and the picker, from the other direction" one, whose subject
     no longer exists. Everything else it asserts about the builder — one card root in the pane,
     no zone, no symbol — is re-asserted above and still true. */
  await expect(page.locator("[data-builder] [data-qr-zone]")).toHaveCount(0);
  await expect(page.locator("[data-builder] [data-card-variant=\"face\"]")).toHaveCount(0);
});

/* ── the preview is the card page, in a phone frame ──────────────────────────────── */

/**
 * ⚠ **Two tests were deleted here with the old Scan-page toggle, and one of them has come back
 * from the other direction.**
 *
 * · **"the preview shows both card variants, and the page one never scrolls the card"** — half
 *   of it (a toggle exists, it flips `data-preview-variant`) was a test of a control that no
 *   longer exists and had no claim underneath it. The load-bearing half was the *card page has
 *   no scroll container* rule, which is the defect that forced the rebuild. That rule is
 *   asserted structurally, per template, in **`tests/unit/card-variants.test.tsx`**, and
 *   geometrically on the live page in `tests/e2e/public-card.spec.ts` — and now here too, at the
 *   one place a preview pane is most tempted to break it, because a short pane around a long
 *   card is precisely the situation that produced the original `overflow-y: auto`.
 * · **"the scan page's actions are previewed, and are inert"** — this one is genuinely back, in
 *   the test below it, because the pane renders look-alikes again. The thing it protects is the
 *   thing that was true the first time: the preview and the live page must not drift apart in
 *   layout, and the action row is ~100px of the page.
 *
 * The claim this test makes is the whole shape of the pane: **the card page, at phone width, in
 * a frame that scrolls, with no face, no QR and no zoom.**
 */
test("the preview is the card page in a phone frame, and the frame is what scrolls", async ({
  page,
}) => {
  await gotoReady(page, EDIT_LEDGER);

  await expect(page.locator(`${PREVIEW_CARD}[data-card-variant="page"]`)).toHaveCount(1);
  await expect(page.locator(`${PREVIEW_CARD}[data-card-variant="face"]`)).toHaveCount(0);

  /* The whole field list is in the pane — that is the point of previewing the page. Five rows on
     the Work card, the same five the section's own list reports, because both come off the one
     `resolveCard` (I-5). A face could only ever have shown two of them. */
  const fields = page.locator("[data-builder-preview] [data-card-fields]");
  await expect(fields).toHaveCount(1);
  await expect(fields).toHaveAttribute("data-field-count", "5");
  await expect(page.locator('[data-builder-preview] [data-card-field="field_company"]')).toHaveCount(
    1,
  );

  // The toggle and both of its options are gone, said out loud so a stale locator elsewhere
  // fails as "that control was removed" rather than as a 10-second timeout.
  await expect(
    page.locator("[data-preview-toggle], [data-preview-variant-option]"),
  ).toHaveCount(0);
  await expect(page.locator("[data-builder-preview]")).not.toHaveAttribute(
    "data-preview-variant",
    /./,
  );
  await expect(page.getByRole("button", { name: /^(share face|scan page)$/i })).toHaveCount(0);

  /**
   * **The mechanism, and it is the inverse of what this test used to assert.**
   *
   * The face was rigid — a declared 336×500 inline — and had to be shrunk with a `transform`,
   * so the old version of this test required a `scale(` on the card's wrapper and a frame that
   * clipped. Every one of those is now a defect:
   *
   * · a `transform: scale()` would mean somebody had reintroduced zoom on an element that
   *   reflows, which produces a card rendered at the wrong measurements and then resized —
   *   the type ends up at a size no phone will ever show;
   * · a declared height or `overflow` **on the card** is the original clipping bug;
   * · `overflow-y: hidden` on the frame would silently cut the field list off at the fold,
   *   which is that same bug moved one element outwards.
   *
   * `overflow-x` stays hidden: §11 E-15's unbroken token must not become a sideways scrollbar.
   */
  const frame = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>("[data-builder-preview] [data-card-root]");
    const box = document.querySelector<HTMLElement>("[data-preview-frame]");
    if (card === null || box === null || card.parentElement === null) return null;
    const cs = getComputedStyle(box);
    return {
      overflowX: cs.overflowX,
      overflowY: cs.overflowY,
      // Nothing declares the card's box. It is `width: 100%` and as tall as its content.
      declaredHeight: card.style.height,
      declaredMaxHeight: card.style.maxHeight,
      cardOverflowY: getComputedStyle(card).overflowY,
      // Read off the inline style, as before: a settled `scale(1)` computes to an identity
      // matrix that is indistinguishable from "no transform", and the mechanism is the claim.
      wrapperTransform: card.parentElement.style.transform,
      // A phone, not a desktop column. 336 is the cap; below `sm` the pane is narrower.
      frameWidth: box.clientWidth,
    };
  });
  expect(frame).toMatchObject({
    overflowX: "hidden",
    overflowY: "auto",
    declaredHeight: "",
    declaredMaxHeight: "",
    cardOverflowY: "visible",
    wrapperTransform: "",
  });
  expect(frame?.frameWidth).toBeGreaterThan(0);
  expect(frame?.frameWidth).toBeLessThanOrEqual(336);
});

/**
 * **The action row is previewed, and it is not a control.**
 *
 * `<CardPage>`'s action slot takes the real Save and the real WhatsApp deep link on `/c/{slug}`.
 * Neither may work here: Save writes a `.vcf` for a card that has not been saved, and the deep
 * link navigates the owner out of the builder mid-edit. But leaving the slot empty would make
 * the preview lie about the page's layout by ~100px, which is the drift this slot exists to
 * prevent.
 *
 * So the pane draws look-alikes with the *same* `<CardActionButton>` — the skin cannot diverge —
 * with no `href`, no `onClick`, and `inert` on the container. `inert` is the load-bearing half:
 * it takes the subtree out of the tab order **and** out of the accessibility tree, so the
 * decorative buttons are unreachable by keyboard and unannounced. `disabled` would have kept
 * them announced, as "dimmed" — a false statement about a card whose real Save works.
 */
test("the previewed actions are inert look-alikes, not working controls", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);

  const actions = page.locator("[data-builder-preview] [data-card-actions-preview]");
  await expect(actions).toHaveCount(1);
  await expect(actions).toHaveAttribute("inert", /.*/);

  /* ⚠ ONE, since the card page dropped to a single action. The Work card shares fields, so
     `canBuildVcf` holds and the button is drawn; the WhatsApp control is gone from the live page
     and therefore from its preview, which is the property actually under test here — the
     preview draws whatever the live page draws or it is not a preview. */
  await expect(actions).toHaveAttribute("data-card-action-count", "1");
  await expect(actions.locator('[data-card-action="save"]')).toHaveCount(1);
  await expect(actions.locator('[data-card-action="whatsapp"]')).toHaveCount(0);

  // Not links, and carrying no destination. A `wa.me` href in an editor is one mis-click from
  // an unsaved edit, `inert` or not.
  const shape = await actions.evaluateAll((nodes) =>
    Array.from(nodes[0]?.querySelectorAll("[data-card-action]") ?? []).map((node) => ({
      tag: node.tagName,
      href: node.getAttribute("href"),
    })),
  );
  expect(shape).toEqual([
    { tag: "BUTTON", href: null },
    { tag: "BUTTON", href: null },
  ]);

  // `inert` behaves: the element refuses focus, so it is not a tab stop.
  const focusable = await actions
    .locator('[data-card-action="save"]')
    .evaluate((node: HTMLElement) => {
      node.focus();
      return document.activeElement === node;
    });
  expect(focusable).toBe(false);

  // …and pressing one does nothing at all — no download, no toast, no navigation.
  const url = page.url();
  await actions.locator('[data-card-action="save"]').dispatchEvent("click");
  await page.waitForTimeout(300);
  await expect(page.locator("[data-overlay-toast]")).toHaveCount(0);
  expect(page.url()).toBe(url);
});

/* ── AC-29: live, with no intermediate commit ────────────────────────────────────── */

test("adding a field updates the preview with no intermediate commit action (AC-29)", async ({
  page,
}) => {
  await gotoReady(page, EDIT_EMPTY);

  // Start from the E-01 state and leave it.
  await expect(page.locator("[data-builder]")).toHaveAttribute(
    "data-builder-field-count",
    "0",
  );

  /* Deliberately NOT `addField()` here: that helper waits for the tick to land, and this test
     is about the *moment* of the add — so the checkbox is clicked by hand and everything below
     is a claim about what had already changed by the time it was released. */
  await openAddField(page);
  await page.locator('[data-field-tick="field_mobile"]').click();

  /* ⚠ The row flips **in place**, and there is nothing to dismiss or apply. This used to drive
     a modal and assert it stayed open behind its own scrim; the scrim, the modal and the
     "Added" state are all gone — one list, one tick. */
  await expect(page.locator('[data-field-row="field_mobile"][data-field-on]')).toHaveCount(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-builder]")).toHaveAttribute(
    "data-builder-field-count",
    "1",
  );
  await expect(page.locator("[data-empty-card-warning]")).toHaveCount(0);

  /* ⚠ **The preview itself has the row on it, while the modal is still open.** This is the
     assertion the pane could not make while it previewed the face: a face carries at most two
     details, so "the card now shows this field" was unobservable there and the meter was the
     best available proxy. The pane previews the page now, so the claim can be made directly —
     and it is the one an owner actually cares about. */
  await expect(
    page.locator('[data-builder-preview] [data-card-field="field_mobile"]'),
  ).toHaveCount(1);
  await expect(page.locator("[data-builder-preview] [data-card-fields]")).toHaveAttribute(
    "data-field-count",
    "1",
  );


  // Nothing was applied, submitted or advanced — closing the modal committed nothing, because
  // there was nothing left to commit.
  await expect(page.locator("[data-builder]")).toHaveAttribute(
    "data-builder-field-count",
    "1",
  );
  expect(await cardFieldIds(page)).toEqual(["field_mobile"]);

  // The old build's second failure: two competing commit affordances on one screen. There is
  // exactly one here, and it is Save.
  await expect(
    page.getByRole("button", { name: /^(apply|next|continue|step \d|update preview)$/i }),
  ).toHaveCount(0);
  await expect(page.locator("[data-builder-save]")).toHaveCount(1);

  // Removing is just as live, and it returns the card to the E-01 state.
  await removeField(page, "field_mobile");
  await expect(page.locator("[data-empty-card-warning]")).toBeVisible();
});

test("renaming the card updates the preview as it is typed (AC-29)", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);

  await page.locator("[data-builder-name]").fill("Conference");
  await expect(page.locator("[data-builder-name]")).toHaveValue("Conference");
  // The name on the card is the *owner's* name, not the card's — what must move is the preview
  // summary that names what is on screen.
  await expect(page.locator("[data-builder-preview-summary]")).toContainText("Conference");
  // And saved-ness is reported as a state rather than printed on the button.
  await expect(page.locator("[data-builder-dirty]")).toHaveAttribute("data-builder-dirty", "true");
});

/**
 * ⚠ **Two more deleted tests, and where their claims live now.**
 *
 * · "selecting a template swaps the preview instantly (AC-29, §8D.4)" — the AC-29 claim is
 *   *live control → live preview with no intermediate commit*, and it is asserted twice below on
 *   the two controls that still exist: the field checkboxes ("ticking a field updates the preview
 *   with no intermediate commit action") and the colour cells ("choosing a colour reaches the
 *   preview and its action buttons"). The template half was the same claim through a third
 *   control, not a different claim.
 * · "the template picker is one radio group of live cards, not a list of swatches" — the picker
 *   anatomy it was guarding is `preview-option.tsx`, which `PalettePicker` still uses, and the
 *   radiogroup / live-card / tick assertions on it are the colour tests immediately below.
 */

/* ── the Design panel: one ground, three treatments ──────────────────────────────── */

/**
 * ⚠ **What replaced "the colour picker offers every palette on the card being built".**
 *
 * That test read nine `<ShareFace>` thumbnails and asserted nine palettes on one template. The
 * cells are painted grounds now, for the reason `background-picker.tsx` sets out — a wallet pass
 * cannot show a wallpaper, a pattern or a header layout, so a colour cell drawn as one would
 * have ignored the three controls beside it — and the claims move with them:
 *
 * · *nine cells, nine different colours* → the swatches' computed backgrounds, below;
 * · *one card, one axis varying* → the cells all carry the owner's own wallpaper, so the only
 *   thing that differs between them is the ground;
 * · *radiogroup, roving tabindex, tick* → the shared `preview-option.tsx` anatomy, asserted here
 *   on all four controls at once rather than on the one that used to be the only consumer.
 */

/**
 * ⚠ **The swatch has to be mostly swatch, and the tick has to be smaller than the thing it
 * marks.** Both were false at once and the row shipped looking broken.
 *
 * `PreviewOptionFrame`'s chrome was tuned for ~150px captioned cells — `p-1.5` on the cell,
 * `border-2` + `p-0.5` + a 20px tick on the frame — and the colour row reused it at 36px. The
 * arithmetic came out at **16px of visible colour under a 20px tick**: a selected swatch showed
 * none of its own colour, which on a *colour picker* is the whole control failing. Nothing in
 * the suite noticed, because every assertion about that row was about ticks and counts.
 *
 * Two ratios, then, rather than two pixel counts — so this survives a resize but not a
 * regression of the nesting.
 */
test("a colour swatch is mostly colour, and its tick does not cover it", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);
  await openPanel(page, "design");

  await page.locator('[data-ground-option="clay"]').click();
  const cell = page.locator('[data-ground-option="clay"]');

  const size = await cell.evaluate((node) => {
    const area = (el: Element | null) => {
      if (el === null) return 0;
      const r = el.getBoundingClientRect();
      return r.width * r.height;
    };
    return {
      cell: area(node),
      swatch: area(node.querySelector("[data-surface-swatch]")),
      tick: area(node.querySelector("[data-preview-option-tick]")),
    };
  });

  /* The swatch is the control. Chrome may frame it; it may not consume it. At the defect this
     ratio was 0.20 — four fifths of the cell was border and padding. */
  expect(size.swatch / size.cell).toBeGreaterThan(0.6);

  /* ⚠ And it must have a height at all. `<CardGround>` is only `inset: 0` inside a card page;
     a percentage height against a frame with no definite height resolves to **zero**, and the
     cell still reports the right `background-color` while rendering nothing. */
  expect(size.swatch).toBeGreaterThan(0);

  // A marker that is a third of what it marks is a marker; one that is larger is a lid.
  expect(size.tick).toBeGreaterThan(0);
  expect(size.tick / size.swatch).toBeLessThan(0.35);
});

test("Background is one control: nine presets and a colour input, one selected state", async ({
  page,
}) => {
  await gotoReady(page, EDIT_LEDGER);
  await openPanel(page, "design");

  const background = page.locator("[data-background-picker]");
  await expect(background.getByRole("radiogroup")).toHaveCount(1);
  await expect(background.getByRole("radio")).toHaveCount(9);

  /* Nine grounds, nine different colours. Read off the paint rather than off an id, because the
     claim is that the cells *show* nine colours and not that they are labelled with nine names.

     ⚠ Read off `[data-card-ground]` inside each cell, not off the cell: the swatches render the
     card's **own** `<CardGround>` (`surface-swatch.tsx`), which is what makes them previews of
     the treatment rather than pictures of it — so the paint is on that element and the cell
     around it is a transparent box. */
  const grounds = await background
    .locator("[data-card-ground]")
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
  expect(grounds).toHaveLength(9);
  expect(new Set(grounds).size).toBe(9);

  // The free colour is part of the same control, with a real label — not a second section, and
  // not a swatch that opens a dialog.
  const input = background.getByLabel("Custom colour");
  await expect(input).toHaveAttribute("type", "color");

  // One tick in the whole control: the card is on Sapphire, so the input has none.
  await expect(background.locator("[data-preview-option-tick]")).toHaveCount(1);
  await expect(
    page.locator('[data-ground-option="sapphire"] [data-preview-option-tick]'),
  ).toHaveCount(1);

  // And no wallet pass anywhere in the panel — the cells are grounds, not cards.
  await expect(page.locator("[data-design-panel] [data-card-root]")).toHaveCount(0);
});

test("choosing a preset reaches the preview (§8D.4)", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);
  await openPanel(page, "design");

  await expect(page.locator(PREVIEW_CARD)).toHaveAttribute("data-palette-id", "sapphire");

  await page.locator('[data-ground-option="oxblood"]').click();

  await expect(page.locator(PREVIEW_CARD)).toHaveAttribute("data-palette-id", "oxblood");
  await expect(page.locator("[data-background-picker]")).toHaveAttribute(
    "data-selected-ground",
    "oxblood",
  );
  await expect(page.locator("[data-builder-preview-summary]")).toContainText(
    TEMPLATE_PALETTES.oxblood.name,
  );

  /* §8D.4: the selection wears a **tick** as well as the border — colour is never the status,
     and on a picker whose nine cells are themselves nine colours a colour-only marker is close
     to invisible. */
  await expect(
    page.locator('[data-ground-option="oxblood"] [data-preview-option-tick]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-ground-option="sapphire"] [data-preview-option-tick]'),
  ).toHaveCount(0);

  /**
   * ⚠ Read off `[data-card-ground]`, and off neither the card root nor the hero.
   *
   * The ground is **one out-of-flow painted element** now (`card-ground.tsx`), behind
   * `position: relative` content — which is how DESIGN.md's "the ground holds still" is
   * arranged, and why the hero and the root are both legitimately transparent. An assertion on
   * either would read `rgba(0, 0, 0, 0)` forever.
   *
   * ⚠ And it must be scoped to `[data-builder-preview]`. The Design panel's cells render the
   * same component — that is the point of `surface-swatch.tsx` — so there are two dozen
   * `[data-card-ground]` elements on this screen and only one of them is the card.
   */
  const ground = await previewGround(page);
  expect(ground).toBe(rgbOf(TEMPLATE_PALETTES.oxblood.ground));
  expect(ground).not.toBe(rgbOf(TEMPLATE_PALETTES.sapphire.ground));
});

/**
 * The free half of the axis (PRODUCT.md Principle 3, *freedom with a floor*).
 *
 * `#10243F` is deliberately outside `LEGIBILITY_DEAD_BAND` — a deep blue that white ink clears
 * with headroom — so this test is about the colour arriving, and the test after it is about what
 * happens when it cannot.
 */
test("a colour of the owner's own takes the tick off the presets", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);
  await openPanel(page, "design");

  const derived = derivePalette(OWN_COLOUR, "gradient");
  expect(derived.clamped).toBe(false);

  await page.getByLabel("Custom colour").fill(OWN_COLOUR.toLowerCase());

  await expect(page.locator("[data-background-picker]")).toHaveAttribute(
    "data-selected-ground",
    OWN_COLOUR,
  );
  /* ⚠ The readout moved onto the row. `BackgroundPicker` used to print "Using Emerald" / the
     hex under its own swatches; the Colour row's value line says it once, where every other
     axis says it too. */
  await expect(page.locator('[data-panel-row="ground"] [data-panel-row-value]')).toHaveText(
    OWN_COLOUR,
  );

  // One axis: the presets give up the tick the moment the colour is the owner's own, and the
  // radiogroup goes to no-selection rather than leaving a stale one behind.
  await expect(page.locator("[data-ground-option] [data-preview-option-tick]")).toHaveCount(0);
  await expect(page.locator("[data-ground-custom] [data-preview-option-tick]")).toHaveCount(1);

  // Picking a preset again is the way back, and it takes the tick with it.
  await page.locator('[data-ground-option="emerald"]').click();
  await expect(page.locator("[data-ground-custom] [data-preview-option-tick]")).toHaveCount(0);
  await expect(
    page.locator('[data-ground-option="emerald"] [data-preview-option-tick]'),
  ).toHaveCount(1);
  await expect(page.locator("[data-background-picker]")).toHaveAttribute(
    "data-selected-ground",
    "emerald",
  );
});

/**
 * ⚠ **`test.fail` — an assertion that is correct, currently red, and deliberately kept red.**
 *
 * Everything in this test is the product's actual claim: the four axes the Design panel sets are
 * stored on the `ContactCard`, resolved with it, and painted by `<CardPage>`. Three of the four
 * legs exist — `builderCard` puts them on the card (`tests/unit/builder-reducer.test.ts`), and
 * `card-page.tsx` reads them off `resolved.surface` and paints them (`card-ground.tsx`), and
 * **`resolveCard` now carries the middle**: it copies the card's `CardSurface` onto the
 * `ResolvedCard` as a concrete `ResolvedSurface`, and calls `derivePalette` when the card has a
 * `groundHex`.
 *
 * This test was authored `test.fail` while that leg was missing — deliberately running rather
 * than skipped, so that the day the wire landed Playwright would report *"expected to fail but
 * passed"* and tell whoever landed it that one word here needed deleting. That is exactly what
 * happened, and this is the word being deleted. A skipped test would have said nothing, ever.
 *
 * It stays as the end-to-end guard on the seam: a colour chosen in the builder must reach the
 * previewed card, because a palette derived anywhere *other* than the resolver would make
 * `/cards/{id}/edit` show a colour `/c/{slug}` does not — the "previewed file differs from the
 * sent file" defect this whole screen is organised against (I-5).
 */
test("every surface axis reaches the previewed card", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);

  const derived = derivePalette(OWN_COLOUR, "flat");

  /* ⚠ This used to end in the Layout panel, proving a choice survived leaving the panel it was
     set in. That axis is gone, so the surviving claim is the one that always mattered: four
     axes set in one panel all reach one card, and the ground the builder derives is the ground
     the resolver derives. Leaving Design and coming back is covered by the tab-set test. */
  await openPanel(page, "design");
  await page.getByLabel("Custom colour").fill(OWN_COLOUR.toLowerCase());
  await page.locator('[data-finish-option="flat"]').click();
  await page.locator('[data-texture-option="dots"]').click();
  await page.locator('[data-presence-option="strong"]').click();

  const card = page.locator(PREVIEW_CARD);
  await expect(card).toHaveAttribute("data-finish", "flat");
  await expect(card).toHaveAttribute("data-texture", "dots");
  expect(await previewGround(page)).toBe(rgbOf(derived.palette.ground));
});

/**
 * The floor, said out loud.
 *
 * `#7F7F7F` sits inside `LEGIBILITY_DEAD_BAND` — the luminance band where neither white nor
 * near-black ink can clear the 7:1 headroom rule — so the system moves it and says so. The test
 * is as much about the *register* of that message as about its presence: it is a `status`, not
 * an `alert`; it does not use the danger colour; the colour the owner picked stays in the input;
 * and nothing is blocked, because nothing failed.
 */
test("a colour that cannot carry text is clamped, and the note says so calmly", async ({
  page,
}) => {
  await gotoReady(page, EDIT_LEDGER);
  await openPanel(page, "design");

  const derived = derivePalette(DEAD_BAND_COLOUR, "gradient");
  expect(derived.clamped).toBe(true);

  await expect(page.locator("[data-ground-clamp]")).toHaveCount(0);

  await page.getByLabel("Custom colour").fill(DEAD_BAND_COLOUR.toLowerCase());

  const note = page.locator("[data-ground-clamp]");
  await expect(note).toBeVisible();
  await expect(note).toHaveText(derived.clampNote);
  await expect(note).toHaveAttribute("role", "status");

  /* Not an error, in either the accessibility tree or the paint.

     ⚠ Scoped to the panel. Next's own route announcer is a permanent `role="alert"` on every
     page in the app (`#__next-route-announcer__`), so an unscoped count asserts the framework
     rather than the product and is 1 forever. */
  await expect(page.locator('[data-design-panel] [role="alert"]')).toHaveCount(0);
  const tone = await note.evaluate((node) => ({
    color: getComputedStyle(node).color,
    danger: getComputedStyle(document.documentElement).getPropertyValue("--danger").trim(),
  }));
  expect(tone.color).not.toBe(rgbOf(tone.danger));

  // The owner's colour is still their colour: the input holds what they picked, and the card
  // wears the nearest legal version of it.
  await expect(page.getByLabel("Custom colour")).toHaveValue(DEAD_BAND_COLOUR.toLowerCase());
  expect(derived.palette.ground.toUpperCase()).not.toBe(DEAD_BAND_COLOUR);

  // Save is untouched — a clamp is not a validation failure (§11 E-01 owns the only blocked Save).
  await expect(page.locator("[data-builder-save]")).not.toHaveAttribute("aria-disabled", "true");

  // Going back to a preset clears the note with the colour it was about.
  await page.locator('[data-ground-option="onyx"]').click();
  await expect(page.locator("[data-ground-clamp]")).toHaveCount(0);
});

/* ── the wallpaper and the motif ─────────────────────────────────────────────────── */

test("the three finishes are live cells, and choosing one is live", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);
  await openPanel(page, "design");

  /* ⚠ `[data-finish-picker]` IS the radiogroup — the hook sits on `PreviewOptionGroup`'s own
     Root, not on a wrapper — so this is an `and`, never a descendant lookup. The old picker had
     a titled `<div>` around its group; the row layout removed it, and a `.getByRole()` under
     the hook now resolves to zero. */
  const wallpaper = page.locator("[data-finish-picker]");
  await expect(page.locator('[data-finish-picker][role="radiogroup"]')).toHaveCount(1);
  await expect(wallpaper.getByRole("radio")).toHaveCount(3);

  /* Each cell renders the **card's own ground component** for its own finish — which is the
     difference between previewing a treatment and drawing a picture of one. The published
     `data-card-finish` is the component naming what it painted, in declaration order. */
  const wallpaperCells = wallpaper.locator("[data-card-ground]");
  expect(
    await wallpaperCells.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-card-finish")),
    ),
  ).toEqual(["flat", "gradient", "mesh"]);

  // And no two are painted the same way: three treatments of one colour, which is what makes
  // the control a comparison rather than a list of adjectives. The motif layer is a child element
  // rather than a second background layer — see `card-ground.tsx` — so it is read separately.
  const paints = await wallpaperCells.evaluateAll((nodes) =>
    nodes.map((node) => {
      const motif = node.querySelector("[data-card-ground-motif]");
      return [
        getComputedStyle(node).backgroundImage,
        motif === null ? "none" : getComputedStyle(motif).backgroundImage,
      ].join("|");
    }),
  );
  expect(new Set(paints).size).toBe(3);

  /**
   * ⚠ **And every cell has a rectangle to paint in**, which is a separate claim from having a
   * colour and is the one that actually failed once.
   *
   * `<CardGround>` is only `position: absolute; inset: 0` inside a card page; anywhere else it
   * is an ordinary in-flow box, so a swatch that does not give it a size renders as a blank
   * white cell **while still reporting the right `background-color`**. Every assertion above
   * passes in that state. This one does not.
   */
  const heights = await page
    .locator("[data-design-panel] [data-card-ground]")
    .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)));
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThan(8);

  /* Nothing is fetched to draw them: a wallpaper that 404s is a broken card, and this build
     makes zero outbound requests (DESIGN.md, PRODUCT.md §3.1). Every image a treatment uses has
     to be an inline `data:` URI.

     ⚠ Matched on the URL inside `url(…)` rather than on the string "http": every one of these
     SVGs *contains* `http://www.w3.org/2000/svg`, which is an XML namespace and not an address
     anything is fetched from. A naive substring check reads that as a network request and fails
     on the correct implementation. */
  for (const paint of paints) {
    for (const [, url] of paint.matchAll(/url\("([^"]*)"\)/g)) {
      expect(url.startsWith("data:")).toBe(true);
    }
  }

  await expect(wallpaper).toHaveAttribute("data-selected-finish", "gradient");
  await page.locator('[data-finish-option="mesh"]').click();
  await expect(wallpaper).toHaveAttribute("data-selected-finish", "mesh");
  await expect(
    page.locator('[data-finish-option="mesh"] [data-preview-option-tick]'),
  ).toHaveCount(1);
});

/**
 * ⚠ The two dials are **absent** with no texture, not disabled.
 *
 * A control for a state you are not in is noise — a scan stop, two tab stops and a screen-reader
 * stop offering a choice that cannot take effect. This also pins the axis independence an owner
 * can actually see: changing the finish must not disturb the texture, and vice versa. The old
 * single `SurfaceStyle` could not express that, and its `pattern`/`grain` values set both.
 */
test("the texture dials appear only with a texture, and the two axes stay independent", async ({
  page,
}) => {
  await gotoReady(page, EDIT_LEDGER);
  await openPanel(page, "design");

  const textures = page.locator("[data-texture-picker]");
  await expect(textures.getByRole("radio")).toHaveCount(5);
  await expect(textures).toHaveAttribute("data-selected-texture", "none");
  await expect(page.locator('[data-panel-row="presence"]')).toHaveCount(0);
  await expect(page.locator('[data-panel-row="scale"]')).toHaveCount(0);

  await page.locator('[data-texture-option="topo"]').click();
  await expect(textures).toHaveAttribute("data-selected-texture", "topo");
  await expect(page.locator('[data-panel-row="presence"]')).toBeVisible();
  await expect(page.locator('[data-panel-row="scale"]')).toBeVisible();

  /* Independence, both directions. Changing the finish leaves the texture where it was — the
     whole point of splitting one axis into two — and going back to `none` leaves the finish. */
  await page.locator('[data-finish-option="mesh"]').click();
  await expect(textures).toHaveAttribute("data-selected-texture", "topo");
  await expect(page.locator("[data-finish-picker]")).toHaveAttribute(
    "data-selected-finish",
    "mesh",
  );

  await page.locator('[data-texture-option="none"]').click();
  await expect(page.locator("[data-finish-picker]")).toHaveAttribute(
    "data-selected-finish",
    "mesh",
  );
  await expect(page.locator('[data-panel-row="presence"]')).toHaveCount(0);
});

/**
 * Radix owns the keyboard, and this is the test that says so.
 *
 * A radiogroup needs a roving tabindex and arrow-key selection; hand-rolled grids of cards get
 * it wrong and axe catches it on every route. Asserted on the Finish control because its cells
 * are pure paint — if the keyboard works there, it works on the others that share the same
 * `preview-option.tsx` anatomy.
 */
test("every picker in the panel is a radiogroup with a roving tabindex", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);
  await openPanel(page, "design");

  /* Background, Finish and Texture. The two dials are radiogroups too but are absent until a
     texture is chosen, so the count with no texture is three. */
  await expect(page.locator("[data-design-panel]").getByRole("radiogroup")).toHaveCount(3);

  /* ⚠ **The tab stop is the group, not a cell**, which is Radix's roving-focus arrangement and
     the reason to use it rather than hand-roll one: the cells are one stop on the way through
     the column, and the arrows choose between them. So *no* item carries a positive tabindex
     until focus enters the group — that is the mechanism working, not a keyboard trap. */
  const group = page.locator('[data-finish-picker][role="radiogroup"]');
  await expect(group).toHaveAttribute("tabindex", "0");
  expect(
    await page
      .locator("[data-finish-option]")
      .evaluateAll((nodes) => nodes.filter((node) => node.getAttribute("tabindex") === "0").length),
  ).toBe(0);

  // Entering the group lands on the chosen cell rather than on the first one.
  await group.focus();
  await expect(page.locator('[data-finish-option="gradient"]')).toBeFocused();

  // The arrows rove across the cells, in the contract's declaration order.
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-finish-option="mesh"]')).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator('[data-finish-option="gradient"]')).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator('[data-finish-option="flat"]')).toBeFocused();

  /* And the keyboard chooses. Asserted with Space rather than with the arrow itself: Radix
     checks an arrowed-to radio from a document-level keydown flag, and whether that flag is set
     before or after the focus move depends on listener order — so the *first* arrow into a group
     sometimes moves focus without selecting. Space is the unambiguous activation, it is what a
     keyboard user presses when they mean it, and asserting it does not pin a Radix internal that
     is free to change. */
  await page.keyboard.press("Space");
  await expect(page.locator("[data-finish-picker]")).toHaveAttribute(
    "data-selected-finish",
    "flat",
  );

  // Exactly one cell is in the tab order once focus is inside it — the roving tabindex, from
  // the outside. Tabbing on leaves the whole group rather than walking its cells.
  expect(
    await page
      .locator("[data-finish-option]")
      .evaluateAll((nodes) => nodes.filter((node) => node.getAttribute("tabindex") === "0").length),
  ).toBe(1);
});

/**
 * ⚠ **The palette-stickiness pair is gone from here and lives in the reducer's suite.**
 *
 * · "a colour the owner picked survives every later template switch" → `builderReducer`'s
 *   `palette` then `template` sequence: `paletteChosen` is what makes a chosen colour final, and
 *   the unit test asserts it without needing a picker to click. It covers a free ground now as
 *   well as a preset, because a colour the owner mixed themselves is no less chosen.
 * · "an untouched colour follows the template it belongs to" → the same action's other branch,
 *   `paletteChosen === false`, where the template's own `paletteId` wins.
 *
 * Both in **`tests/unit/builder-reducer.test.ts`**. This is the one deletion worth being uneasy
 * about, because the rule it guards is the whole reason `templateId` and `paletteId` are two
 * fields — so it is worth saying plainly that the *rule* did not move an inch. The reducer still
 * implements both branches; only the control that used to drive them from a browser is gone, and
 * a UI test of a control that does not exist cannot be written honestly.
 */

/* ── §11 E-42: rapid switching ───────────────────────────────────────────────────── */

/*
 * "ten template clicks in two seconds settle on the last one (E-42)" is deleted with the picker.
 * E-42's claim — a burst of selections settles on the last with nothing torn or stale, and no
 * page error — is asserted by the colour version immediately below, on the control that still
 * exists and that now re-paints twenty-three swatches per click.
 */

test("ten colour clicks in two seconds settle on the last one (E-42)", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);
  await openPanel(page, "design");

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  const clicks = [
    "onyx",
    "oxblood",
    "pistachio",
    "periwinkle",
    "sapphire",
    "clay",
    "emerald",
    "amber",
    "rust",
    "onyx",
  ] as const;

  for (const id of clicks) {
    await page.locator(`[data-ground-option="${id}"]`).click();
  }

  // Twenty-three swatches re-paint on every click; a leaked timer or an abandoned gradient paint
  // would surface here (§11 E-21).
  await expect(page.locator(PREVIEW_CARD)).toHaveAttribute("data-palette-id", "onyx");
  expect(errors).toEqual([]);
});

/* ── AC-36 / E-01: the card that maps nothing ────────────────────────────────────── */

test("a zero-field card shows the warning bar, an empty state and a blocked Save (AC-36, E-01)", async ({
  page,
}) => {
  await gotoReady(page, EDIT_EMPTY);

  // 1. the persistent bar, with the exact sentence §11 E-01 specifies
  const warning = page.locator("[data-empty-card-warning]");
  await expect(warning).toBeVisible();
  await expect(warning.locator("[data-empty-card-warning-text]")).toHaveText(
    "No fields on this card. Anyone who scans it will only get your name.",
  );
  // Persistent means persistent: there is no way to dismiss it.
  await expect(warning.getByRole("button", { name: /dismiss|close|hide|got it/i })).toHaveCount(0);

  // …and it is said once. The meter owns that sentence everywhere else; here the bar does, and
  // printing it twice on one screen makes neither copy the authority.
  const occurrences = await page.evaluate(
    () =>
      document.body.innerText.split("Anyone who scans it will only get your name.").length - 1,
  );
  expect(occurrences).toBe(1);

  // 2. the screen's own state. The header meter that used to print "Field count 0" is gone
  //    (client, 2026-09-28), so the count is read off the builder root instead.
  const root = page.locator("[data-builder]");
  await expect(root).toHaveAttribute("data-builder-field-count", "0");
  await expect(root).toHaveAttribute("data-builder-field-count-state", "empty");
  await expect(page.locator('[data-field-count-meter="meter"]')).toHaveCount(0);

  // 3. Save blocked, with a reason attached to the control rather than only to the page.
  //    `aria-disabled` rather than the `disabled` attribute is deliberate (T05): a natively
  //    disabled button leaves the tab order, and a control nobody can focus is a control whose
  //    explanation nobody ever hears.
  const save = page.locator("[data-builder-save]");
  await expect(save).toBeVisible();
  await expect(save).toHaveAttribute("aria-disabled", "true");

  const reason = await save.evaluate((node) => {
    const id = node.getAttribute("aria-describedby");
    if (id === null) return null;
    return id
      .split(/\s+/)
      .map((each) => document.getElementById(each)?.textContent ?? "")
      .join(" ")
      .trim();
  });
  expect(reason).toBe("Tick at least one field to save this card.");

  // 4. and the preview STILL RENDERS — name only — so the consequence is visible, not hidden.
  //    This is the half of E-01 that is easiest to get wrong by "helpfully" swapping the card
  //    for an empty state.
  await expect(page.locator(PREVIEW_CARD)).toHaveCount(1);
  await expect(page.locator("[data-builder-preview] [data-card-name]")).toHaveText(
    "Priyanka Raghunathan",
  );
  /* And it renders the *consequence*, which is what makes it worth keeping on screen: a page
     with a name, a face and nothing under it. `<CardPage>` drops the field list entirely when
     there are no rows, so this is an absence rather than an empty container — and the action
     row is empty too, because `canBuildVcf` is false so there is no Save to look at and no
     PHONE so no WhatsApp (§11 E-02, E-56). The preview says "this shares nothing" by showing
     nothing, which no warning bar can do. */
  await expect(page.locator("[data-builder-preview] [data-card-fields]")).toHaveCount(0);
  await expect(
    page.locator("[data-builder-preview] [data-card-actions-preview]"),
  ).toHaveAttribute("data-card-action-count", "0");
  expect(await cardFieldIds(page)).toEqual([]);

  /* 5. …and the Fields section says the same thing in its own words: every profile field is
        listed and **not one of them is ticked**.

        ⚠ `[data-fields-empty]` and `[data-field-rows]` went with the card's own field list.
        The panel lists the *profile* now, which is not empty just because the card is — so
        "this card shares nothing" is a statement about the ticks, and that is what is read. */
  await expect(page.locator("[data-field-picker] [data-field-row]").first()).toBeVisible();
  await expect(
    page.locator("[data-field-picker] [data-field-row][data-field-on]"),
  ).toHaveCount(0);
  // And the way out is on the panel: the composer that authors a field the profile lacks.
  await expect(page.locator("[data-field-new-open]")).toHaveCount(1);
});

test("pressing the blocked Save does nothing at all (E-01)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await gotoReady(page, EDIT_EMPTY);

  // `dispatchEvent` rather than `click`: the button is `aria-disabled`, so an actionability
  // check would be the thing under test rather than the guard. This fires a real DOM click
  // straight at the element and asks what the application does with it.
  await page.locator("[data-builder-save]").dispatchEvent("click");

  // A negative assertion about an asynchronous surface needs time to be wrong in: a toast that
  // arrived 20ms later would sail past an immediate `toHaveCount(0)`. The positive half of this
  // contract is asserted separately, so this half only has to prove nothing happened.
  await page.waitForTimeout(500);

  await expect(page.locator("[data-overlay-toast]")).toHaveCount(0);
  await expect(page.locator("[data-empty-card-warning]")).toBeVisible();
  // `buildVcf` throws `EmptyCardError` on this card; nothing reached it.
  expect(errors).toEqual([]);
});

test("the guard lifts the moment a field is added, and returns when it is removed", async ({
  page,
}) => {
  await gotoReady(page, EDIT_EMPTY);

  const save = page.locator("[data-builder-save]");
  await expect(save).toHaveAttribute("aria-disabled", "true");

  await addField(page, "field_work_email");

  await expect(page.locator("[data-empty-card-warning]")).toHaveCount(0);
  await expect(page.locator('[data-field-row="field_work_email"][data-field-on]')).toHaveCount(1);
  await expect(save).not.toHaveAttribute("aria-disabled", "true");
  await expect(save).not.toHaveAttribute("aria-describedby", /./);

  await removeField(page, "field_work_email");
  await expect(page.locator("[data-empty-card-warning]")).toBeVisible();
  await expect(
    page.locator("[data-field-picker] [data-field-row][data-field-on]"),
  ).toHaveCount(0);
  await expect(save).toHaveAttribute("aria-disabled", "true");
});

test("a links-only card is not treated as empty (canBuildVcf, not a local count)", async ({
  page,
}) => {
  await gotoReady(page, EDIT_EMPTY);

  await addField(page, "field_linkedin");

  // `fieldCount` counts `fields` **and** `socialFields` (§6.4). A card mapping only social links
  // shares plenty, and a call site that counted `fields` alone would warn on it.
  await expect(page.locator("[data-empty-card-warning]")).toHaveCount(0);
  await expect(page.locator("[data-builder]")).toHaveAttribute(
    "data-builder-field-count",
    "1",
  );
  await expect(page.locator("[data-builder-save]")).not.toHaveAttribute("aria-disabled", "true");
});

test("Save is a simulated commit that announces itself (§3.1)", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);

  await expect(page.locator("[data-builder-dirty]")).toHaveAttribute(
    "data-builder-dirty",
    "false",
  );
  await page.locator("[data-builder-save]").click();
  /* Scoped to the toast itself. Radix mirrors toast copy into an off-screen announce region for
     screen readers, so a bare `getByText` on it matches two nodes — the component's own comment
     flags this. */
  await expect(page.locator("[data-overlay-toast]").getByText("Card saved")).toBeVisible();
  /* Title only (client, 2026-09-28: no counts as prose). A description appears only when the
     save also wrote profile values, and this one wrote none. */
  await expect(page.locator("[data-toast-description]")).toHaveCount(0);
});

test("a new card's Save says it is creating, not updating", async ({ page }) => {
  await gotoReady(page, NEW);

  await expect(page.locator("[data-builder-save]")).toHaveText("Create card");
  await page.locator("[data-builder-save]").click();
  await expect(page.locator("[data-overlay-toast]").getByText("Card created")).toBeVisible();
});

/* ── E-01's action, and the wall against an embedded editor ──────────────────────── */

test("E-01's Add fields opens the Fields panel instead of leaving the builder (§8D.4)", async ({
  page,
}) => {
  await gotoReady(page, EDIT_EMPTY);

  const addFields = page.locator("[data-add-fields]");
  await expect(addFields).toHaveCount(1);
  /* ⚠ No longer an anchor. Answering "this card maps 0 fields" by navigating to /profile threw
     away the very session that produced the empty card, every time. */
  await expect(addFields).not.toHaveAttribute("href", /./);

  await addFields.click();
  /* ⚠ It selects the Fields panel and stops. There is nothing to open: the profile's fields and
     the composer that authors a missing one are both permanently on that panel, so arriving
     there IS the whole action. */
  await expect(page.locator("[data-field-picker]")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/profile$/);
});

test("the Fields section offers no route out to /profile for a new field (§8D.4)", async ({
  page,
}) => {
  await gotoReady(page, NEW);

  // The deep link that used to sit under the list is gone, in both of its old positions.
  await expect(page.locator("[data-field-picker] [data-add-field]")).toHaveCount(0);
  /* `[data-field-edit-elsewhere]` is excluded and stays: it is a *masked or address* row asking
     to be edited in the profile's own editor (§7.3), which is a different thing from authoring a
     field and is deliberately still a navigation. */
  await expect(
    page.locator('[data-field-picker] a[href="/profile"]:not([data-field-edit-elsewhere])'),
  ).toHaveCount(0);

  /* The route to a new field is the panel's own composer — one row, opening in place, with no
     dialog and no navigation. */
  await page.locator("[data-field-new-open]").click();
  await expect(page.locator("[data-create-field-form]")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/profile$/);
});

/**
 * ⚠ **§8D.4's recorded failure was never "there are inputs here".**
 *
 * It was a builder with **two competing commit affordances and no answer to which one had been
 * pressed** — a 12-row profile editor embedded in Step 2, with its own save, beside the card's.
 * The old version of this test enforced that by counting inputs and asserting zero, which was a
 * cheap proxy that happened to hold while the Fields list was read-only. The list has editable
 * rows now, so the proxy is gone and the invariant is asserted directly:
 *
 * 1. **One commit affordance on the screen.** Nothing saves itself.
 * 2. **Nothing in the LIST creates a field.** Every input in the list belongs to a field already
 *    on the card — inputs and rows are the same count. Authoring moved into the Add-field dialog,
 *    which is a different surface and, crucially, writes the *profile*: it never commits the
 *    card's field set, so the count of card-commit affordances is still one.
 */
test("the builder has one commit affordance and creates no fields (§8D.4)", async ({ page }) => {
  await gotoReady(page, NEW);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // 1. One Save, and no second one hiding in a row.
  await expect(page.locator("[data-builder-save]")).toHaveCount(1);
  await expect(page.locator('[data-field-picker] button[type="submit"]')).toHaveCount(0);
  await expect(page.locator("[data-field-picker] form")).toHaveCount(0);

  /* 2. Inputs exist, and every one of them is a row's value. An input that is not bound to an
        existing row would be a field being authored here, which is the thing that may not
        happen — counting them against the rows is what makes that checkable rather than
        promised. */
  const rows = page.locator("[data-field-picker] [data-field-row]");
  const inputs = page.locator("[data-field-picker] [data-field-row-input]");
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);
  expect(await inputs.count()).toBeLessThanOrEqual(rowCount);
  await expect(page.locator("[data-field-picker] input:not([data-field-row-input])")).toHaveCount(
    0,
  );
  await expect(page.locator("[data-field-picker] textarea")).toHaveCount(0);

  /* Authoring lives on this panel now, and the resting state is what keeps that honest: the
     composer is one closed row, so it contributes no form, no submit and no input until it is
     asked for. Its own test drives it open. */
  await expect(page.locator("[data-field-picker] [data-add-field]")).toHaveCount(0);
  await expect(page.locator("[data-create-field-form]")).toHaveCount(0);
  await expect(page.locator("[data-field-new-open]")).toHaveAttribute("aria-expanded", "false");

  /* ⚠ **Exactly one card-name input on the screen**, and it is NOT in this panel — it is the
     head above the tab panels, because the name is the same on both tabs and a copy inside each
     one would remount on every tab switch. Asserted as a count *and* as an absence from the
     panel, so a head that crept back into `FieldPicker` fails here rather than by dropping a
     caret in somebody's rename. See `panel-head.tsx`. */
  await expect(page.locator("[data-builder-name]")).toHaveCount(1);
  await expect(page.locator("[data-field-picker] [data-builder-name]")).toHaveCount(0);
});

/**
 * The feature the editable rows exist for, end to end: **type here, and the card says it.**
 *
 * It is the same seam `renaming the card updates the preview` guards, one level down — a value
 * edited in the panel has to reach the previewed card through the *same* `resolveCard` the
 * public page uses, or the builder is showing a card that is not the one being sent (I-5).
 */
test("editing a field's value reaches the previewed card as it is typed", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);

  const row = page.locator('[data-field-picker] [data-field-row="field_company"]');
  const input = row.locator("[data-field-row-input]");
  await expect(input).toHaveCount(1);

  await input.fill("Fernwood Labs");

  const card = page.locator(PREVIEW_CARD);
  await expect(card.getByText("Fernwood Labs").first()).toBeVisible();
  /* Live, with no commit in between — the toolbar is what says there is something to save.
     ⚠ The attribute is always present and carries "true"/"false", so `toBeVisible` would pass
     on a clean card too. */
  await expect(page.locator("[data-builder-dirty]")).toHaveAttribute("data-builder-dirty", "true");
});

/**
 * ⚠ **Clearing a value must not delete the row out from under the cursor.**
 *
 * §11 E-07 ("a blank value is not a field") used to be applied in `buildFieldRows`, which fed
 * both the Add dialog *and* this list. That was correct while the list was read-only and became
 * a trap the moment it grew inputs: select-all, delete, and the input you were typing in
 * vanished mid-keystroke with no way back to it short of leaving for `/profile`.
 *
 * The rule still holds where it belongs — the field leaves the *card* immediately — but the row
 * stays, wearing a note, so the value can be typed back.
 */
test("clearing a value drops the field from the card and keeps the row", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);

  const row = page.locator('[data-field-picker] [data-field-row="field_company"]');
  const input = row.locator("[data-field-row-input]");
  const before = Number(
    await page.locator("[data-builder-preview] [data-card-fields]").getAttribute("data-field-count"),
  );

  await input.fill("");

  // The row is still here, still focusable, and says why the card lost a line.
  await expect(input).toHaveCount(1);
  await expect(row.locator('[data-field-row-note="field_company"]')).toBeVisible();
  await expect(page.locator("[data-builder-preview] [data-card-fields]")).toHaveAttribute(
    "data-field-count",
    String(before - 1),
  );

  // And typing it back restores it, which is the whole point of keeping the row.
  await input.fill("Fernwood Labs");
  await expect(row.locator('[data-field-row-note="field_company"]')).toHaveCount(0);
  await expect(page.locator("[data-builder-preview] [data-card-fields]")).toHaveAttribute(
    "data-field-count",
    String(before),
  );
});

/**
 * **The same wall, on the surface that authors.**
 *
 * §8D.4's ruling is about the *screen*, and this screen can now author a profile field without
 * leaving it. That is the shape most likely to grow a second commit affordance, so it is
 * asserted with the composer **open** rather than only with it closed.
 *
 * Three claims:
 *
 * 1. **Closed is the resting state.** The client's whole note about this panel was noise
 *    (*"still quite noisy. I would remove the kind and the value"*), and the structural answer
 *    is that the composer costs one row until it is asked for.
 * 2. **No dialog, at any point.** It expands in place, under the button that opened it, rather
 *    than over the preview it changes.
 * 3. **⚠ Its submit writes the PROFILE, and the card still has exactly one commit affordance.**
 *    `POST /profile/fields` is not a card commit: the field's *tick* is live like every other
 *    control here, and Save remains the only thing that writes the card.
 */
test("the field composer authors in place, and never becomes a second commit (§8D.4)", async ({
  page,
}) => {
  await gotoReady(page, NEW);

  // 1. Closed. No form, no select, no submit — the panel is a list of fields.
  await expect(page.locator("[data-create-field-form]")).toHaveCount(0);
  await expect(page.locator("[data-field-picker] form")).toHaveCount(0);
  const toggle = page.locator("[data-field-new-open]");
  await expect(toggle).toHaveCount(1);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  // 2. It opens in place. No dialog is mounted, before or after.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await toggle.click();
  await expect(page.locator("[data-create-field-form]")).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  /* ⚠ And the labels are gone from the screen without leaving the accessibility tree — the
     literal reading of "remove the kind and the value". A printed `<label>` in here fails. */
  await expect(page.getByRole("combobox", { name: /kind/i })).toBeVisible();
  await expect(page.locator("[data-create-field-value]")).toHaveAttribute(
    "placeholder",
    /.+/,
  );
  const printedLabels = await page
    .locator("[data-create-field-form] label")
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const box = node.getBoundingClientRect();
          return box.width > 1 && box.height > 1;
        })
        .map((node) => node.textContent),
    );
  expect(printedLabels, "a printed form label came back onto the panel").toEqual([]);

  // 3. One card commit on the screen, and it is Save. The composer's submit is not one.
  await expect(page.locator("[data-builder-save]")).toHaveCount(1);
  await expect(page.locator("[data-create-field-submit]")).toHaveCount(1);
  await expect(page).not.toHaveURL(/\/profile$/);

  // Closing it puts the panel back to a list and nothing else.
  await page.locator("[data-field-new-open]").click();
  await expect(page.locator("[data-create-field-form]")).toHaveCount(0);
});

/* ── the control panel: three tabs, one mounted, all three addressable ───────────── */

/**
 * This replaces "the controls are one scrolling column — Fields, then Design, both live at once",
 * which itself replaced "the controls are three tabs". The screen has gone tabs → column → tabs,
 * and the loop is worth stating so nobody closes it a third time by accident.
 *
 * §8D.4's recorded failure is **not** "tabs are wrong". It is: *a panel that only exists while
 * its tab is selected cannot be linked to or anchored on.* The column answered that by mounting
 * everything, and paid for it with a two-thousand-pixel scroll in which no single view of the
 * editor showed a complete decision. The tab set answers the same failure a better way — **the
 * selected panel is in the URL** — and this test is where that claim is checked rather than
 * asserted in a comment.
 *
 * So the structural half below is inverted from the last version on purpose:
 *
 * · **one** `[data-builder-section]` in the document, not three — Radix unmounts the rest, and
 *   a test that expected three would be a test that a tab set is not really a tab set;
 * · **three** tabs, in a fixed order, with the right ARIA;
 * · `?panel=` round-trips: it selects on arrival and it records on click.
 *
 * The absence assertions survive unchanged and are still the load-bearing half. `[data-builder-tab]`
 * and `[data-builder-panel]` were the *old* build's hooks — hand-rolled, unaddressable, and
 * exactly what this screen must not go back to. A stale locator for them elsewhere in the suite
 * would resolve to nothing and time out, which reads as a flake rather than as "that control is
 * gone"; asserting zero here is what makes the removal a fact the suite states once, loudly.
 */
test("the controls are a tab set — Fields, Design, one panel at a time", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);

  /* Two tabs, in the order the work happens: choose what the card carries, then choose what it
     looks like carrying it. Layout was a third and is gone — `card-surface.ts` carries why. */
  const tabs = page.locator("[data-builder-nav] [data-builder-nav-item]");
  await expect(tabs).toHaveCount(2);
  expect(
    await tabs.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-builder-nav-item")),
    ),
  ).toEqual(["fields", "design"]);

  /* Radix's ARIA, asserted rather than assumed — a hand-rolled tab set that merely *looks* like
     one is the thing this locator would otherwise happily match. `orientation` is vertical
     because the rail is a column, and it is what binds Up/Down instead of Left/Right. */
  const list = page.getByRole("tablist");
  await expect(list).toHaveCount(1);
  await expect(list).toHaveAttribute("aria-orientation", "vertical");
  await expect(page.getByRole("tab")).toHaveCount(2);

  /* ⚠ **Both panels stay in the document; the inactive one carries `hidden`.** That is
     Radix's behaviour for Tabs and it is better than unmounting for exactly the reason §8D.4
     cares about — the markup of every panel is still there to be addressed and asserted on —
     while only the selected one is visible, in the layout, and in the accessibility tree. A
     test that expected a count of 1 here would be asserting an implementation detail nobody
     wants. What matters is that exactly one is *visible*. */
  const panels = page.locator("[data-builder-section]");
  await expect(panels).toHaveCount(2);
  expect(
    await panels.evaluateAll((nodes) => nodes.filter((n) => !n.hasAttribute("hidden")).length),
  ).toBe(1);
  await expect(page.locator('[data-builder-section="fields"]')).toBeVisible();
  await expect(page.locator('[data-builder-section="design"]')).toBeHidden();
  await expect(page.locator("[data-field-picker]")).toBeVisible();

  /* Exactly one `<h2>` on the screen — the open panel's title. The builder's own `<h1>` is
     visually hidden in the toolbar, so the outline is 1 → 2 with nothing skipped whichever tab
     is open, which is what axe's `heading-order` rule reads. */
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Fields"]);

  await openPanel(page, "design");
  await expect(page.locator("[data-design-panel]")).toBeVisible();
  await expect(page.locator('[data-builder-section="fields"]')).toBeHidden();
  /* One `<h2>` in the accessibility tree — a `hidden` panel takes its heading with it, so the
     outline is 1 → 2 with nothing skipped whichever tab is open. */
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Design"]);
  /* ⚠ **Two `<h3>`s, and they are group dividers rather than per-control headings.** The panel
     used to carry one `<h3>` per axis — Background, Wallpaper, Pattern — which is what made it
     read as a stack of competing blocks. Each axis is now a `PanelRow` whose name is a plain
     `<span>`, so the outline is 1 → 2 → 3 with two entries however many controls the panel
     grows. Colour is still not a tab of its own: the nine presets and the colour input are one
     axis, and a screen that offered it twice would have to invent a precedence rule. */
  await expect(page.getByRole("heading", { level: 3 })).toHaveText(["Colour", "Surface"]);
  await expect(page.locator("[data-panel-row]")).toHaveCount(3);
  await expect(page.locator("[data-header-picker]")).toHaveCount(0);

  /* No hand-rolled tab machinery survives — not the old list, not a trigger, not a panel. */
  await expect(
    page.locator("[data-builder-tabs], [data-builder-tab], [data-builder-panel]"),
  ).toHaveCount(0);

  // And no template picker: the UI is gone even though the model still carries `templateId`,
  // which the preview is still rendering from. `[data-palette-picker]` is gone the same way —
  // that control's axis is `[data-background-picker]` now, and a stale locator for it must
  // resolve to nothing rather than to something that looks close enough.
  await expect(page.locator("[data-template-picker]")).toHaveCount(0);
  await expect(page.locator("[data-template-option]")).toHaveCount(0);
  await expect(page.locator("[data-palette-picker]")).toHaveCount(0);

  // The toolbar's Save sits above all three panels rather than inside any, so there is no state
  // of this screen in which the commit affordance is absent. That is §8D.4's fourth recorded
  // failure and it is the one thing about tabs that genuinely was dangerous.
  await expect(page.locator("[data-builder-save]")).toBeVisible();
  await expect(page.locator(PREVIEW_CARD)).toHaveCount(1);
});

/**
 * The property that makes a tab set legal on this screen: **every panel has an address.**
 *
 * §8D.4's failure was an unaddressable panel, and this is the assertion that keeps it answered.
 * It is deliberately two claims in one test, because either alone is worthless — a URL that
 * selects but is never written is a link nobody can produce, and a URL that is written but never
 * read is a link that does not work.
 */
test("the open panel is in the URL, both ways (§8D.4)", async ({ page }) => {
  // Read: arriving with `?panel=` opens that panel rather than the default.
  await gotoReady(page, `${EDIT_LEDGER}?panel=design`);
  await expect(page.locator('[data-builder-section="design"]')).toBeVisible();
  await expect(page.locator('[data-builder-nav-item="design"]')).toHaveAttribute(
    "data-state",
    "active",
  );

  // Write: choosing a tab records it, so the address bar is always shareable.
  await openPanel(page, "fields");
  await expect(page).toHaveURL(/[?&]panel=fields\b/);

  /* ⚠ Recorded with `history.replaceState`, so it must NOT have pushed an entry — going back
     from the editor is leaving the editor, not undoing three tab clicks. */
  await page.goBack();
  await expect(page).not.toHaveURL(/\/cards\/[^/]+\/edit/);
});

/**
 * `?panel=` is user input, so it gets §11 E-34's treatment: a value nothing recognises falls back
 * rather than rendering an empty panel or throwing.
 */
test("an unrecognised ?panel= falls back to Fields (E-34)", async ({ page }) => {
  await gotoReady(page, `${EDIT_LEDGER}?panel=nonsense`);

  await expect(page.locator('[data-builder-section="fields"]')).toBeVisible();
  await expect(page.locator('[data-builder-section="design"]')).toBeHidden();
  await expect(page.locator("[data-builder-save]")).toBeVisible();
});

/* ── the Fields section: one ticked list over the whole profile ──────────────────── */

/**
 * ⚠ **THIS IS THE THIRD VERSION OF THIS SECTION, AND THE PREVIOUS TWO ARE DELETED RATHER THAN
 * ADAPTED. Eight tests went; here is what each of them claimed and where the claim lives now.**
 *
 * The panel has been: a list of the card's own fields with a `+ Add` modal beside it → the same
 * list with two columns of offers under it → **one list of the whole profile, ticked**. The
 * tests below are written against the third, and these are the ones that could not survive it:
 *
 * | Deleted test | Why it cannot be adapted | Where the claim lives |
 * |---|---|---|
 * | "the + Add button opens a modal that offers a shortlist first" | there is no modal and no shortlist — every field is listed, always, so nothing has to be *ranked* into view | the list itself; `suggestedRows` is unused by this screen |
 * | "every row wears its type's glyph, decoratively" | rows carry no icon: at 35 rows a glyph column was 35 objects earning nothing, and `[data-field-row-icon]` is gone from the source | `FIELD_RENDERERS` is still asserted on the card, in `card-variants.test.tsx` |
 * | "the modal's search finds a field outside the shortlist" | ⚠ **the search box is deleted** — client, 2026-09-07: *"remove the search bar (won't be too many fields)"* | `rowMatches` is unit-tested in `field-rows`; nothing on this screen calls it |
 * | "the modal's category rail filters to one category" | there is no rail; the categories are group bands **in** the one list, so there is nothing to filter *to* | "groups the list under the profile's own category names", in `field-picker.test.tsx` |
 * | "a field already on the card reads Added and cannot be added twice" | structurally impossible now: one row per field, and its tick *is* its state | `shows every profile field once`, in `field-picker.test.tsx` |
 * | "Suggested does not shuffle under the cursor while several fields are added" | the list cannot reorder at all — `ordered` does not depend on `selected` | `does not move a row when it is ticked` (unit) and the tick test below |
 * | "the Fields section lists what the card carries, in the card's order" | the panel lists the **profile**; the card's order is the preview's | rewritten below, reading `previewFieldIds()` |
 * | "removing a field from the list is live" | `[data-field-remove]` is gone with the card's own list | rewritten below, unticking |
 *
 * ⚠ Deleting a test is the move that hides a regression, so the rule applied here was: every
 * deleted test's *claim* is either restated below, or named above with the file that now owns
 * it. A claim that could not be placed would have meant the UI change was wrong, not the test.
 */
test("the Fields panel lists the whole profile, ticked — and the card keeps its own order", async ({
  page,
}) => {
  await gotoReady(page, EDIT_LEDGER);

  /* Every profile field is offered, not just the card's five. This is the number that made the
     two rejected layouts unusable, and it is asserted so the list is known to be the long one.

     ⚠ `expect(...).toBeVisible()` first, and `count()` only after it: **this panel's fields are
     a client fetch** (`useApiResource`, not the server pass), so the list is empty for a tick
     after `gotoReady` returns. `count()` does not retry, and a bare `count()` here read 0. */
  const rows = page.locator("[data-field-picker] [data-field-row]");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(9);

  // The five the Work card maps are the ticked ones, and the meter agrees.
  expect(await cardFieldIds(page)).toEqual(
    [
      "field_work_phone",
      "field_work_email",
      "field_site_url",
      "field_job_title",
      "field_company",
    ].sort(),
  );
  await expect(page.locator("[data-builder]")).toHaveAttribute(
    "data-builder-field-count",
    "5",
  );

  /* ⚠ §6.4 — category, then type, then label, then id — is the **card's** order, so it is read
     off the card. The Work card maps five WORK fields, so type rank orders them: PHONE(0),
     EMAIL(3), URL(5), JOB_TITLE(10), COMPANY(11). That the panel lists them in the profile's
     order instead is the point of the split: the list is stable under a tick, and the card is
     sorted by `resolveCard`'s own comparator. */
  expect(await previewFieldIds(page)).toEqual([
    "field_work_phone",
    "field_work_email",
    "field_site_url",
    "field_job_title",
    "field_company",
  ]);

  // Each row names its field, and the tick is named for it too (§8.8, AC-25) — never a bare
  // "Share" repeated thirty-five times.
  await expect(page.locator('[data-field-row="field_work_email"]')).toContainText("Work email");
  await expect(page.getByRole("checkbox", { name: /Share Work email on this card/i })).toHaveCount(
    1,
  );

  /* A newly ticked field reaches the card in its canonical position, not at the end — while its
     row does not move at all. Both halves in one assertion pair. */
  const before = await rows.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-field-row")),
  );
  await addField(page, "field_mobile");

  expect(
    await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-field-row"))),
    "ticking a field re-sorted the panel",
  ).toEqual(before);
  expect(await previewFieldIds(page)).toEqual([
    // PERSONAL(1) sorts before every WORK(2) row, wherever it was ticked from.
    "field_mobile",
    "field_work_phone",
    "field_work_email",
    "field_site_url",
    "field_job_title",
    "field_company",
  ]);
  await expect(page.locator("[data-builder]")).toHaveAttribute(
    "data-builder-field-count",
    "6",
  );
});

test("unticking a field is live, and takes it off the card (AC-29)", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);

  await expect(page.locator("[data-builder]")).toHaveAttribute(
    "data-builder-field-count",
    "5",
  );

  await removeField(page, "field_work_email");

  /* ⚠ **The row stays. Only the tick changed.** This is where the old test and this one differ
     most: it asserted `[data-field-row="field_work_email"]` had *gone*, because the panel was a
     list of the card's fields. A row leaving the list under the finger is the defect three
     layouts were rejected for. */
  await expect(page.locator('[data-field-row="field_work_email"]')).toHaveCount(1);
  await expect(page.locator('[data-field-row="field_work_email"][data-field-on]')).toHaveCount(0);

  await expect(page.locator("[data-builder]")).toHaveAttribute(
    "data-builder-field-count",
    "4",
  );
  expect(await cardFieldIds(page)).toEqual(
    ["field_work_phone", "field_site_url", "field_job_title", "field_company"].sort(),
  );
  // And it is off the card itself, not merely out of the panel's own bookkeeping.
  expect(await previewFieldIds(page)).not.toContain("field_work_email");
});

/**
 * §4.5 and §7.3, on the one surface that can leak them now.
 *
 * The two-surface version of this test checked the modal's offer rows *and* the card's own list.
 * There is one list, so there is one place to check — and the document sweep at the end is what
 * covers whatever else might have printed the value.
 */
test("a masked field is marked, and its value is never printed here (§4.5, §7.3)", async ({
  page,
}) => {
  await gotoReady(page, NEW);

  // `field_bank` is sensitive *and* a financial type, so it is masked twice over.
  const bank = page.locator('[data-field-picker] [data-field-row="field_bank"]');
  await expect(bank.locator("[data-field-sensitive]")).toHaveCount(1);
  await expect(bank.locator("[data-field-row-value]")).toHaveCount(0);

  // A non-sensitive value *is* shown — it is already public on the card, and it is the only way
  // to tell two work numbers apart while choosing one.
  await expect(
    page.locator('[data-field-picker] [data-field-row="field_mobile"] [data-field-row-value]'),
  ).toHaveCount(1);

  // Ticking the masked field puts it on the card — still marked, still valueless.
  await addField(page, "field_bank");
  await expect(bank.locator("[data-field-sensitive]")).toHaveCount(1);
  await expect(bank.locator("[data-field-row-value]")).toHaveCount(0);

  /* ⚠ **And no input, which is the claim the editable rows made newly necessary.** Every other
     ticked row now holds `<input value={…}>`; §7.3 says a masked value must not reach the DOM
     *as an attribute*, and `value` is exactly that attribute. `isInlineEditable` is what keeps
     this row out of it, and this is where that is checked rather than assumed. */
  await expect(bank.locator("[data-field-row-input]")).toHaveCount(0);
  await expect(bank.locator('[data-field-edit-elsewhere="field_bank"]')).toHaveCount(1);

  // §7.3 puts reveal in `/profile` and nowhere else, so the raw value is absent from this
  // document entirely — not as text, not in a `title`, and not in an input's value.
  const html = await page.content();
  expect(html).not.toContain("50100412345678");
});

/* ── §11 E-40: the profile moving underneath an open builder ─────────────────────── */

test("a card whose fields have left the profile says so, and renders no ghost row (E-40)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  // `?state=empty` hands the builder a profile with no fields in it (§11 E-08), so all five of
  // the Work card's mappings have just become dangling.
  await gotoReady(page, withState(EDIT_LEDGER, "empty"));

  const notice = page.locator("[data-dropped-fields]");
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute("data-dropped-count", "5");
  await expect(notice).toHaveText("5 fields were removed from your profile.");

  // Never a ghost row, and never a crash (I-2).
  expect(await cardFieldIds(page)).toEqual([]);
  await expect(page.locator(PREVIEW_CARD)).toHaveCount(1);
  expect(errors).toEqual([]);

  // The card now shares nothing, so E-01 applies to it as well — and the cause is stated above
  // the consequence, which is the only order that explains it.
  await expect(page.locator("[data-empty-card-warning]")).toBeVisible();
  await expect(page.locator("[data-builder-save]")).toHaveAttribute("aria-disabled", "true");
  const order = await page.evaluate(() => {
    const dropped = document.querySelector("[data-dropped-fields]");
    const empty = document.querySelector("[data-empty-card-warning]");
    if (dropped === null || empty === null) return null;
    return (dropped.compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  expect(order).toBe(true);

  // §11 E-08 in the picker: there is nothing to tick, said in words. No tab click needed — the
  // Fields section is already in the document, which is also why this empty state is now
  // something the owner meets on arrival rather than after a click.
  await expect(page.locator("[data-field-picker-empty]")).toBeVisible();
  /* On an empty profile the way forward is to *make* a field, not to go elsewhere to find one —
     which is why the composer is on this panel at all. It is the panel's first row, so on the
     one profile with nothing to list it is the only thing to reach. */
  await expect(page.locator("[data-field-new-open]")).toHaveCount(1);
  await expect(page.locator("[data-field-picker] [data-add-field]")).toHaveCount(0);
});

test("a new card on an empty profile opens at zero rather than inventing a seed", async ({
  page,
}) => {
  await gotoReady(page, withState(NEW, "empty"));

  await expect(page.locator("[data-builder]")).toHaveAttribute(
    "data-builder-field-count",
    "0",
  );
  await expect(page.locator("[data-empty-card-warning]")).toBeVisible();
  await expect(page.locator(PREVIEW_CARD)).toHaveCount(1);
});

/* ── AC-24: the four state families, on both routes ──────────────────────────────── */

for (const route of [NEW, EDIT_LEDGER]) {
  test(`${route} renders every ?state= family (AC-24)`, async ({ page }) => {
    for (const state of STATE_QUERIES) {
      await gotoReady(page, withState(route, state));

      const root = await screenStateRoot(page);
      await expect(root).toHaveAttribute("data-screen-state", state);

      if (state === "loading") {
        // §11 E-35: the skeleton renders and never resolves. That is the point of it.
        await expect(page.locator("[data-builder-skeleton]").first()).toBeVisible();
        await expect(page.locator("[data-builder-header]")).toHaveCount(0);
      }

      if (state === "error" || state === "offline") {
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        await expect(page.locator("[data-builder-header]")).toHaveCount(0);
      }

      if (state === "success" || state === "empty") {
        // The builder renders in both: `empty` is a profile with nothing in it, not a reason to
        // hide the card.
        await expect(page.locator("[data-builder-header]")).toBeVisible();
        await expect(page.locator(PREVIEW_CARD)).toHaveCount(1);
      }
    }
  });
}

test("an unrecognised ?state= falls back to success and never blanks the page (E-34)", async ({
  page,
}) => {
  await gotoReady(page, `${NEW}?state=banana`);

  const root = await screenStateRoot(page);
  await expect(root).toHaveAttribute("data-screen-state", "success");
  await expect(page.locator("[data-builder-header]")).toBeVisible();
  await expect(page.locator(PREVIEW_CARD)).toHaveCount(1);
});

/* ── §11 E-36: an id that does not exist ─────────────────────────────────────────── */

test("an unknown cardId renders a panel rather than a stack trace (E-36)", async ({ page }) => {
  await gotoReady(page, "/cards/card_does_not_exist/edit");

  await expect(page.locator("[data-builder]")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  // §6.10: no error code as a headline, and never a raw framework 404.
  await expect(page.locator("body")).not.toContainText("This page could not be found");
});

/* ── the tick renders on the card, in the same frame ──────────────────────────────── */

/**
 * ⚠ **THE CLIENT'S EXPLICIT REQUIREMENT, ASSERTED RATHER THAN TRUSTED.**
 *
 * *"as we will be clicking over the tick then that ticked fields should be visible to us over
 * the card it should be automatically been rendered."*
 *
 * The chain is `onToggle` → `toggleField` → `dispatch` → `state.fieldIds` → `builderCard` →
 * `resolveCard` → `<BuilderPreview>`, all synchronous. The API write that follows is
 * fire-and-forget and the UI never awaits it.
 *
 * ⚠ That last property is the one worth a test: if anybody ever makes the preview wait on
 * `PUT /cards/:id/fields`, the tick starts lagging the network and this fails. It is asserted
 * with **no network wait at all** — tick, then read the preview — so a regression to
 * await-then-render cannot pass.
 */
test("ticking a field renders it on the card immediately, and unticking removes it", async ({
  page,
}) => {
  await gotoReady(page, EDIT_EMPTY);
  await openAddField(page);

  /* ⚠ A field that renders as a card ROW, named rather than taken off the top of the list.
     `.first()` picked `field_photo`, which the card renders as its portrait — there is no
     `[data-card-field]` for it, so the assertion failed on a card that was behaving correctly.
     A test that has to pick "any field" has to know which kinds produce a row. */
  const fieldId = "field_mobile";
  const label = fixtureField(fieldId).label;

  const onCard = page.locator(`[data-builder-preview] [data-card-field="${fieldId}"]`);
  const startCount = await onCard.count();

  await page.locator(`[data-field-tick="${fieldId}"]`).click();

  /* No `waitForResponse`, deliberately — see the ⚠ above. */
  await expect(onCard, `"${label}" did not reach the card on tick`).toHaveCount(startCount + 1);
  await expect(page.locator(`[data-field-row="${fieldId}"][data-field-on]`)).toHaveCount(1);

  await page.locator(`[data-field-tick="${fieldId}"]`).click();
  await expect(onCard, `"${label}" stayed on the card after unticking`).toHaveCount(startCount);
});

/**
 * **The two properties the panel's shape has to keep, measured in a real browser.**
 *
 * ⚠ Both are scars. The rejected two-column build put a `max-h-[22rem] overflow-y-auto` list
 * *inside* a panel that is itself `overflow-y-auto` — a scrollbar in a scrollbar, which is what
 * made 27 profile fields unreachable — and it put the add controls ~970px down the column, so
 * pressing `+` moved the row ~900px above the finger. Client, twice: *"the user will be
 * scrolling up and up… he has to scroll down and go on to the new field."*
 */
test("the panel has one scroller, and the composer stays in view while ticking", async ({
  page,
}) => {
  await gotoReady(page, EDIT_EMPTY);
  await openAddField(page);

  const nested = await page.locator("[data-field-picker] *").evaluateAll((nodes) =>
    nodes.filter((node) => {
      const overflow = getComputedStyle(node).overflowY;
      return overflow === "auto" || overflow === "scroll";
    }).length,
  );
  expect(nested, "the fields panel added its own scroll container").toBe(0);

  /**
   * ⚠ ASSERTED AS "STILL REACHABLE", NOT AS "SAME y".
   *
   * A first version compared the composer's viewport `y` before and after and failed at 273 vs
   * 205 — because clicking a checkbox scrolls it into view, which moves the page, and the panel
   * is itself sticky. That is the browser doing its job. The property the client asked for is
   * that the add control never becomes something you have to go and find.
   */
  await expect(page.locator("[data-field-new]")).toBeInViewport();

  const rows = page.locator("[data-field-row]");
  for (const i of [0, 1, 2]) {
    const id = await rows.nth(i).getAttribute("data-field-row");
    await page.locator(`[data-field-tick="${id}"]`).click();
  }

  await expect(
    page.locator("[data-field-new]"),
    "the composer row left the viewport once fields were ticked",
  ).toBeInViewport();
});

/**
 * ⚠ **THE COMPOSER IS THE LIST'S FIRST ROW AT EVERY WIDTH — 360, 768 AND 1440.**
 *
 * This replaces two tests that measured the deleted two-column grid: one counted
 * `gridTemplateColumns` tracks at three viewports to prove the split was a *container* query,
 * and one checked that the add column stacked above the list on a phone. The grid is gone —
 * there is one column now, which is most of what "less noise" bought — so the property that
 * survives is the one both of them existed to protect: **the add control's distance from the
 * top of the panel does not depend on the width, or on the field count.**
 */
test("the composer sits above the fields at every width", async ({ page }) => {
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, EDIT_LEDGER);
    await openAddField(page);

    const tops = await page.evaluate(() => {
      const composer = document.querySelector("[data-field-new]");
      const list = document.querySelector("[data-field-list]");
      if (composer === null || list === null) return null;
      return {
        composer: Math.round(composer.getBoundingClientRect().top),
        list: Math.round(list.getBoundingClientRect().top),
      };
    });

    expect(tops, `no composer or no list at ${width}px`).not.toBeNull();
    expect(
      tops!.composer,
      `the composer is below the list at ${width}px — a scroll away on a long profile`,
    ).toBeLessThan(tops!.list);
  }
});

/**
 * ⚠ **THE ROW'S SHAPE IS A CONTAINER QUERY, AND 1024 IS WHY IT HAS TO BE.**
 *
 * Measured widths of `[data-field-picker]`:
 *
 *     viewport   390   768  1024  1280  1440  1920
 *     panel      324   654   374   630   790  1014
 *
 * **1024 is narrower than 768** — that is where `SplitView` turns on and hands 400px to the
 * pinned preview. No `lg:` / `xl:` rule can express "wide at 768, narrow at 1024, wide at 1280",
 * so a viewport breakpoint would put the change at the single narrowest width in the range.
 *
 * The old test proved that on the deleted two-column grid's track count. Two claims replace it,
 * and the first is the one that makes the second necessary:
 *
 * 1. **The panel is narrower at 1024 than at 768** — the inversion itself, measured.
 * 2. **The row's label/value pairing follows the panel's width**, not the viewport's: paired at
 *    1440 (a 790px panel), stacked at 360 (a 324px one, under the 22rem the row asks for).
 *
 * ⚠ A first version of claim 2 expected 1024 to stack, and that was wrong on the arithmetic
 * rather than on the principle: 374px is still over the row's 352px threshold, so it pairs. The
 * inversion is real and is asserted directly in claim 1; the threshold simply does not fall
 * between 374 and 654.
 */
test("the field row's shape follows the panel's own width, not the viewport's", async ({
  page,
}) => {
  const panelWidth = async () => {
    await openAddField(page);
    await expect(page.locator("[data-field-row]").first()).toBeVisible();
    return page
      .locator("[data-field-picker]")
      .evaluate((node) => Math.round(node.getBoundingClientRect().width));
  };

  /** Do the label and the value share a line, in the first row that prints a value? */
  const sameLine = async () =>
    page.evaluate(() => {
      const value = document.querySelector("[data-field-row] [data-field-row-value]");
      const row = value?.closest("li") ?? null;
      const label = row?.querySelector("span > span") ?? null;
      if (value === null || label === null) return null;
      const a = label.getBoundingClientRect();
      const b = value.getBoundingClientRect();
      /* Overlapping vertically, rather than an exact `top` match: a 13px label and a 12px value
         on the same line differ by a pixel of baseline alignment. */
      return a.top < b.bottom && b.top < a.bottom;
    });

  await page.setViewportSize({ width: 768, height: 1024 });
  await gotoReady(page, EDIT_LEDGER);
  const at768 = await panelWidth();

  await page.setViewportSize({ width: 1024, height: 900 });
  await gotoReady(page, EDIT_LEDGER);
  const at1024 = await panelWidth();

  expect(
    at1024,
    `1024 gave a ${at1024}px panel and 768 gave ${at768}px — the inversion this query exists for is gone`,
  ).toBeLessThan(at768);

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoReady(page, EDIT_LEDGER);
  await panelWidth();
  expect(await sameLine(), "a 790px panel should pair label and value on one line").toBe(true);

  await page.setViewportSize({ width: 360, height: 800 });
  await gotoReady(page, EDIT_LEDGER);
  await panelWidth();
  expect(
    await sameLine(),
    "a 324px panel kept the value on the label's line — it has no room for the pair",
  ).toBe(false);
});

/* ── the card's name ──────────────────────────────────────────────────────────────── */

/**
 * ⚠ **WHY EVERY CARD WAS CALLED "Untitled card", AND WHY THAT IS A UI BUG NOT AN API ONE.**
 *
 * `POST /cards` and `PATCH /cards/:id` both carry `name` and always have — `builder-client.tsx`
 * sends `state.name.trim()` on create and on update. The name is displayed in the card-detail
 * header, the cards list, the dashboard tiles and the public page's `<title>`. Nothing was
 * missing from the integration.
 *
 * What was missing was any way to *notice* you could set it. The title is an `<input>` styled as
 * a heading, its fill appeared on `hover:` and `focus:` only — and **there is no hover on a
 * touch screen** — and because `CreateCardDto.name` is required, the field is pre-filled with
 * `BUILDER_NEW_CARD_NAME`, so its helpful `placeholder="Name this card"` is never once seen.
 * Undiscoverable, and then thirteen characters to delete if you did find it.
 *
 * Both halves are asserted here: the control looks like a control at rest, and the default
 * gets out of the way when you use it.
 */
test("the card name reads as editable at rest, not only on hover", async ({ page }) => {
  await gotoReady(page, NEW);

  const name = page.locator("[data-builder-name]");
  await expect(name).toHaveValue("Untitled card");

  /* ⚠ Measured without hovering or focusing. A transparent border here is the defect: on a
     phone that is the entire resting state. */
  const border = await name.evaluate((n) => {
    const cs = getComputedStyle(n);
    return { width: cs.borderTopWidth, colour: cs.borderTopColor };
  });
  expect(border.width, "the name field has no resting boundary").not.toBe("0px");
  expect(
    border.colour,
    "the name field's resting boundary is transparent — invisible on touch",
  ).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
});

test("focusing the untouched default selects it, so typing replaces rather than appends", async ({
  page,
}) => {
  await gotoReady(page, NEW);
  const name = page.locator("[data-builder-name]");

  await name.click();
  const selected = await name.evaluate((n) => {
    const input = n as HTMLInputElement;
    return input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0);
  });
  expect(selected, "the default was not selected on focus").toBe("Untitled card");

  await page.keyboard.type("Conference");
  await expect(name, "typing appended to the default instead of replacing it").toHaveValue(
    "Conference",
  );
});

/**
 * ⚠ And a real name is NOT auto-selected. The select-on-focus is scoped to the exact default
 * precisely so a one-character correction to a name somebody chose is never one keystroke away
 * from being wiped.
 */
test("a name the owner chose is not auto-selected on focus", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);
  const name = page.locator("[data-builder-name]");

  const original = await name.inputValue();
  expect(original, "this fixture card has no name to protect").not.toBe("Untitled card");

  await name.click();
  const selectionLength = await name.evaluate((n) => {
    const input = n as HTMLInputElement;
    return (input.selectionEnd ?? 0) - (input.selectionStart ?? 0);
  });
  expect(selectionLength, "a chosen name was selected on focus and is one keystroke from gone").toBe(
    0,
  );
});

/* ── the logo ────────────────────────────────────────────────────────────────────────── */

/**
 * The card's logo — `POST /cards/{id}/logo`, `DELETE /cards/{id}/logo`, and the `file` part of
 * the multipart `POST /cards`.
 *
 * ## Why this is an e2e test and not a unit one
 *
 * The reducer's behaviour is already pinned without a browser (`tests/unit/builder-reducer.test.ts`)
 * and so is the mark's resolution. What neither can reach is the part that actually broke in
 * every previous version of an upload control: **a real `<input type="file">`, a real
 * `URL.createObjectURL`, and the preview repainting from a `blob:` URL.** happy-dom has no
 * object-URL implementation worth trusting and no layout engine, so "the owner picks a file and
 * the card in the pane wears it" is only a claim until a browser does it.
 *
 * ## The two paths, and they are genuinely different requests
 *
 * · **An existing card** uploads on pick. `logoUrl` is rejected as a plain string by
 *   `PATCH /cards/{id}`, so there is no Save that could carry it — the file is either uploaded
 *   or it is nowhere.
 * · **`/cards/new`** has no id to address, so the file is held and goes out as the create's
 *   `file` part. Both are asserted below, because the code paths do not share a line.
 */

/** A 1×1 transparent PNG — the smallest thing that is genuinely an image to a browser. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

async function pickLogo(page: Page) {
  await page.locator("[data-logo-input]").setInputFiles({
    name: "mark.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
}

test("the Design panel offers a logo control, empty to begin with", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);
  await openPanel(page, "design");

  await expect(page.locator("[data-panel-row='logo']")).toBeVisible();
  await expect(page.locator("[data-logo-thumb]")).toHaveAttribute("data-logo-thumb", "empty");
  /* "Add logo", not "Replace" — the label is how the control says which state it is in, and it
     is the only thing on the row that does. */
  await expect(page.locator("[data-logo-upload]")).toHaveText(/add logo/i);
  // Nothing to remove yet, so no control offering it.
  await expect(page.locator("[data-logo-remove]")).toHaveCount(0);
});

/**
 * ⚠ **The preview must wear the logo, not just the panel.**
 *
 * A thumbnail that updates while the card beside it does not is the exact failure §8D.4 is
 * written against — the builder showing a choice it has not applied. The logo fills the card's
 * one image slot, the portrait circle, so `[data-card-portrait="logo"]` inside the preview
 * asserts the whole path: file → object URL → reducer → `builderCard` → `resolveCard` →
 * `resolveAvatar` → `<CardPage>`.
 */
test("picking a logo on an existing card uploads it and the preview wears it", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);
  await openPanel(page, "design");

  const request = page.waitForRequest(
    (r) => /\/cards\/[^/]+\/logo$/.test(r.url()) && r.method() === "POST",
  );
  await pickLogo(page);

  const posted = await request;
  expect(
    posted.headers()["content-type"] ?? "",
    "the upload was not sent as multipart/form-data",
  ).toContain("multipart/form-data");

  await expect(page.locator("[data-logo-thumb]")).toHaveAttribute("data-logo-thumb", "set");
  await expect(page.locator("[data-logo-upload]")).toHaveText(/replace/i);
  await expect(page.locator('[data-builder-preview] [data-card-portrait="logo"]')).toBeVisible();
});

/**
 * ⚠ **And the card must not be marked unsaved by it.** The upload has already landed, so a Save
 * offered afterwards would commit nothing — which teaches an owner that the button is noise.
 */
test("an uploaded logo does not leave the card claiming unsaved changes", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);
  await openPanel(page, "design");

  const status = page.locator("[data-builder-dirty]");
  // The baseline matters: an assertion that "false" is still "false" proves nothing unless the
  // screen actually started there.
  await expect(status).toHaveAttribute("data-builder-dirty", "false");

  await pickLogo(page);
  await expect(page.locator("[data-logo-thumb]")).toHaveAttribute("data-logo-thumb", "set");

  await expect(
    status,
    "an upload that already landed marked the card unsaved, so Save now commits nothing",
  ).toHaveAttribute("data-builder-dirty", "false");
});

/**
 * ⚠ The mirror, and the half that would be broken by "just never set dirty for a logo": on an
 * unsaved card the file has no route to the server except the create, so Save genuinely does
 * have something to commit and the screen has to say so.
 */
test("a logo picked on a new card does mark it unsaved, because Save is what sends it", async ({
  page,
}) => {
  await gotoReady(page, NEW);
  await openPanel(page, "design");

  const status = page.locator("[data-builder-dirty]");
  await expect(status).toHaveAttribute("data-builder-dirty", "false");

  await pickLogo(page);
  await expect(status).toHaveAttribute("data-builder-dirty", "true");
});

test("removing a logo calls DELETE and empties the slot", async ({ page }) => {
  await gotoReady(page, EDIT_LEDGER);
  await openPanel(page, "design");

  await pickLogo(page);
  /* ⚠ Wait for the upload to settle before removing. Both controls go inert while a logo request
     is in flight — deliberately, since a remove racing its own upload is exactly how a card ends
     up with an orphaned object — so clicking Remove mid-upload is a click on a disabled button.
     The label is what says the request finished: it reads "Uploading…" until it does. */
  await expect(page.locator("[data-logo-upload]")).toHaveText(/replace/i);
  await expect(page.locator("[data-logo-remove]")).toBeEnabled();

  const request = page.waitForRequest(
    (r) => /\/cards\/[^/]+\/logo$/.test(r.url()) && r.method() === "DELETE",
  );
  await page.locator("[data-logo-remove]").click();
  await request;

  await expect(page.locator("[data-logo-thumb]")).toHaveAttribute("data-logo-thumb", "empty");
  await expect(page.locator('[data-builder-preview] [data-card-portrait="logo"]')).toHaveCount(0);
});

/**
 * ⚠ **`/cards/new` uploads NOTHING on pick — and still shows the logo.**
 *
 * There is no card id to address, so a `POST .../logo` here would be a request to a card that
 * does not exist. The file waits for the create; the preview does not, and that is the half a
 * unit test cannot see.
 */
test("a logo picked on a new card is held, previewed, and sent with the create", async ({
  page,
}) => {
  await gotoReady(page, NEW);
  await openPanel(page, "design");

  let uploads = 0;
  page.on("request", (r) => {
    if (/\/cards\/[^/]+\/logo$/.test(r.url())) uploads += 1;
  });

  await pickLogo(page);

  // Visible immediately, from the object URL — before anything has been sent anywhere.
  await expect(page.locator("[data-logo-thumb]")).toHaveAttribute("data-logo-thumb", "set");
  await expect(page.locator('[data-builder-preview] [data-card-portrait="logo"]')).toBeVisible();
  expect(uploads, "an unsaved card tried to upload to a card id it does not have").toBe(0);

  const create = page.waitForRequest((r) => r.url().endsWith("/cards") && r.method() === "POST");
  await page.locator("[data-builder-save]").click();

  const posted = await create;
  expect(
    posted.headers()["content-type"] ?? "",
    "POST /cards was not multipart, so it cannot carry a file",
  ).toContain("multipart/form-data");
  /**
   * ⚠ **The file part is asserted through the API's answer, not by reading the request body.**
   *
   * Playwright hands back an empty `postData`/`postDataBuffer` for a body carrying binary parts,
   * so a `toContain('name="file"')` on either is unfailable rather than passing — it would go
   * green on a create that sent no file at all.
   *
   * The stub reports `logoUrl` on the created card exactly when the request carried a part named
   * `file` (see `tests/stubs/api.mjs`). Reading that back proves more than the string would
   * anyway: the part survived the same-origin proxy, which re-streams the body, and arrived at
   * the API under the name it reads.
   */
  const created = await (await posted.response())?.json();
  expect(created?.logoUrl, "the create reached the API without its `file` part").toBeTruthy();
});
