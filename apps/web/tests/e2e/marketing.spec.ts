import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { hero, MARKETING_SECTION_IDS } from "@/fixtures/marketing";

import { gotoReady } from "../helpers/e2e";

/**
 * `/` — THE WALLET DECK.
 *
 * This file was rewritten with the page. The previous version encoded spec §8C, a rule set
 * derived from a design reference the project has since rejected outright, and enforcing it was
 * what produced a page the client described as weak and under-designed. What survives from it
 * is every rule that is about QUALITY rather than about a look: banned marketing phrases,
 * fabricated social proof, contrast, no horizontal overflow, real product truth.
 *
 * See `docs/decisions/2026-08-24-marketing-micro-direction.md` and
 * `.impeccable/surfaces/src-app-marketing-page-tsx.md`.
 *
 * ## The three assertions that matter most
 * 1. **The page describes nothing that does not ship.** It used to carry a WhatsApp-assistant
 *    pass with a "not built yet" disclosure holding the honesty on its own; the pass was cut,
 *    so the assertion got stronger rather than weaker — no unshipped capability may be
 *    described at all. This is a truth test, not a style test.
 * 2. **No pricing anywhere.** Every figure previously on the page was invented.
 * 3. **No eyebrow above any heading.** An absolute ban, checked at source.
 */

const PAGE = "/";
const SECTION_IDS = MARKETING_SECTION_IDS;

/** The ids the chrome links at. `/#pricing` is gone with the section. */
const BANNED_PHRASES = [
  "Effortlessly",
  "Seamlessly",
  "Supercharge",
  "Unlock the",
  "Elevate your",
  "game-changing",
  "Say goodbye to",
  "revolutionize",
  "in seconds",
  "Transform your",
] as const;

const MARKETING_DIR = resolve(process.cwd(), "src/components/marketing");
const marketingSources = () =>
  readdirSync(MARKETING_DIR)
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map((f) => ({ file: f, code: strip(readFileSync(resolve(MARKETING_DIR, f), "utf8")) }));

/** Comments out, code in. A lint that punishes documenting its own rule trains people to
 *  delete the explanation and keep the behaviour, which is backwards. */
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function sections(page: Page): Locator {
  return page.locator("[data-section]");
}
function section(page: Page, id: string): Locator {
  return page.locator(`[data-section="${id}"]`);
}
async function gotoMarketing(page: Page) {
  await gotoReady(page, PAGE);
}

/* ── Structure ───────────────────────────────────────────────────────────────── */

test.describe("the deck", () => {
  test("renders every section once, in order", async ({ page }) => {
    await gotoMarketing(page);
    await expect(sections(page)).toHaveCount(SECTION_IDS.length);
    const rendered = await sections(page).evaluateAll((ns) =>
      ns.map((n) => n.getAttribute("data-section")),
    );
    expect(rendered).toEqual([...SECTION_IDS]);
  });

  test("every section is flat, full-bleed, and its ground alternates", async ({ page }) => {
    await gotoMarketing(page);

    /* ⚠ THIS TEST WAS INVERTED ON 2026-09-08 AND THE INVERSION IS THE REDESIGN.
       It read: eight passes, each with a shadow carrying a real offset and a radius of at least
       24px — the page as a wallet, every section an inset card riding over the lip of the one
       above. The client's website brief asks for a page that "just scrolls down", and eight
       overlapping passes make every boundary a visual event.

       So the claim is now the opposite, and it is asserted rather than merely allowed to
       happen: a pass has NO shadow, NO radius and NO inset, and the only thing separating two
       sections is that their grounds differ. That last clause is the load-bearing one — with a
       flat page and no rule between sections, an alternation bug does not look like a bug, it
       looks like one very long section. */
    const passes = await page.locator("[data-pass]").evaluateAll((ns) =>
      ns.map((n) => {
        const c = getComputedStyle(n);
        return {
          id: n.closest("[data-section]")?.getAttribute("data-section") ?? "?",
          shadow: c.boxShadow,
          radius: Number.parseFloat(c.borderTopLeftRadius),
        };
      }),
    );
    expect(passes).toHaveLength(SECTION_IDS.length - 1);
    for (const p of passes) {
      expect(p.shadow, `${p.id} still carries a pass shadow`).toBe("none");
      expect(p.radius, `${p.id} still carries a pass radius`).toBe(0);
    }

    /* Grounds, in document order, read off the SECTION — the ground moved off the inset child
       and onto the section itself so that it runs edge to edge at every width. */
    const grounds = await page
      .locator("[data-section]")
      .evaluateAll((ns) =>
        ns.map((n) => ({
          id: n.getAttribute("data-section"),
          bg: getComputedStyle(n).backgroundColor,
        })),
      );

    /* Every section paints its own ground. A transparent section inherits whatever is behind
       it, which is how an alternation silently collapses into one colour. */
    for (const g of grounds) {
      expect(g.bg, `${g.id} paints no ground of its own`).not.toBe("rgba(0, 0, 0, 0)");
    }

    /* And no two adjacent sections share one. This is the whole separator. */
    for (let i = 1; i < grounds.length; i += 1) {
      expect(
        grounds[i]!.bg,
        `${grounds[i - 1]!.id} and ${grounds[i]!.id} share a ground, so their boundary is invisible`,
      ).not.toBe(grounds[i - 1]!.bg);
    }
  });

  /**
   * **Every in-page link in the chrome points at a section that exists, and lands clear of the
   * fixed bar.**
   *
   * ⚠ THE TARGET LIST IS READ OFF THE RENDERED NAV, NOT HARD-CODED, AND THAT IS THE FIX.
   * It was `const CHROME_ANCHOR_IDS = ["how-it-works", "faq"]` — a second copy of the nav's
   * targets, sitting in the test file. When `faq` was deleted the nav still linked to `#faq`
   * and this test still looked for `#faq`, so it failed for the right reason by luck: it was
   * asserting against its own stale copy rather than against the nav. Derived from the DOM, the
   * assertion becomes "the nav never links to nothing", which is the property worth having and
   * needs no maintenance when the page changes again.
   */
  test("every in-page nav link points at a section that clears the fixed bar", async ({ page }) => {
    await gotoMarketing(page);

    const targets = await page.evaluate(() =>
      [...document.querySelectorAll('nav a[href*="#"]')]
        .map((a) => (a.getAttribute("href") ?? "").split("#")[1])
        .filter((id): id is string => Boolean(id) && id !== "main"),
    );

    /* The nav is expected to carry in-page links at all — a chrome with none would pass every
       assertion below by iterating an empty list. */
    expect(targets.length, "the chrome carries no in-page links").toBeGreaterThan(0);

    for (const id of targets) {
      const el = page.locator(`#${id}`);
      await expect(el, `the nav links to #${id}, which is not on the page`).toHaveCount(1);
      const top = await el.evaluate((n) => Number.parseFloat(getComputedStyle(n).scrollMarginTop));
      expect(top, `#${id} would land under the fixed bar`).toBeGreaterThan(0);
    }
  });

  test("never scrolls sideways", async ({ page }) => {
    await gotoMarketing(page);
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(over).toBeLessThanOrEqual(1);
  });

  test("exactly one main landmark, owned by the layout", async ({ page }) => {
    await gotoMarketing(page);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("#main")).toHaveCount(1);
  });
});

/* ── The hero ────────────────────────────────────────────────────────────────── */

/**
 * ⚠ THIS BLOCK WAS REWRITTEN WITH THE HERO, FOR THE THIRD TIME, AND THE PATTERN IS THE POINT.
 *
 * It has asserted, in order: an azure→cyan sky with a card crossing a meadow; a Sapphire→Onyx
 * sky with a tilted card; a Sapphire→Onyx sky with a film standing in an Amber bloom. Each was
 * rejected by the client — *"childish"*, *"very big"*, and finally *"the blue colour and the
 * video being rendered there are both looking the worst of all."*
 *
 * The tests were rewritten each time to match the new gradient, which is exactly why they never
 * caught the problem: **every one of them asserted the finish and none asserted the composition.**
 * A suite that pins `background-color` cannot tell you that seven hundred pixels of hero are
 * doing no work.
 *
 * So this rewrite keeps the claims that are true of any good hero on this product and drops the
 * ones that were true only of one gradient:
 *
 *   · the copy is legible on the ground it is ACTUALLY drawn on, measured, not assumed;
 *   · the primary action has a findable boundary there (WCAG 1.4.11);
 *   · the page's one authored moment renders at rest when durations are zeroed;
 *   · reduced motion loses the travel and keeps the content.
 *
 * And it adds the two the ledger introduces, both of which are regressions a screenshot would
 * not catch: the ruling stays in REGISTER with the type, and no copy on it uses the secondary
 * ink level, which is illegal on this ground at every rule density.
 */
test.describe("the hero", () => {
  test("sets the client's locked line as two clauses, with exactly one accented", async ({
    page,
  }) => {
    await gotoMarketing(page);
    const h = page.locator("[data-hero-headline]");
    await expect(h).toHaveCount(1);

    /* ⚠ THE COPY IS THE CLIENT'S AND IS ASSERTED VERBATIM. "Never lose contact." is the brand
       line — it is on the deck's cover and under the wordmark — and the previous assertion
       here was for a headline we wrote ourselves ("Hand over one card. Keep it true for
       years."). A test on brand copy is a test on the brand, so it is exact. */
    const spans = h.locator("span");
    const lines = await spans.allTextContents();
    expect(lines.length, "the headline is set as its two clauses").toBe(2);
    expect(lines.join(" ")).toBe("Never lose contact.");

    /* ⚠ ONE clause is ink and ONE is the brand green, and the split is asserted both ways.
       `--mk-green-display` (#43A491) measures 3.01:1 on white, which clears the LARGE-text bar
       and nothing else — so this word is legal at the display step and would not be legal one
       step down. Asserting the count is what stops the accent spreading: two green clauses is
       a green headline, and a green headline fails at 3.01:1 the moment anybody sets it
       smaller. */
    const colours = await spans.evaluateAll((ns) => ns.map((n) => getComputedStyle(n).color));
    expect(colours.filter((c) => c === "rgb(24, 26, 31)"), "the ink clause").toHaveLength(1);
    expect(colours.filter((c) => c === "rgb(65, 159, 141)"), "the accented clause").toHaveLength(
      1,
    );
  });

  /**
   * ⚠ THE RULED SHEET IS GONE AND THE LIVE CARD REPLACES IT, 2026-09-08.
   *
   * This test used to assert that the hero was a sheet of ruled contact-book paper whose rules
   * landed on the headline's own line boxes, and that no object sat on it. Both halves are
   * reversed on the client's website brief: the ground is white, and the hero carries an
   * animated card. `--mk-ledger-*` survives in `marketing.css` with nothing rendering it.
   *
   * What replaces it is the card's own contract. The object is now a FLIP — a real
   * `<ShareFace>` on the front and the animated card on the back — and four clauses matter:
   *
   *   1. **The box never changes size.** Not while flipping, not while the back's fields
   *      change. Its row stack is a fixed number of slots whether four are filled or five, so a
   *      field arriving or being revoked moves no other box on the page.
   *   2. **No frame is empty.** A visitor arrives mid-cycle, so every beat must be a card
   *      somebody designed — never a shell waiting to be filled.
   *   3. **The front's QR clears the scannable floor at rest.** `MIN_QR_SIZE_PX` is 140 and the
   *      symbol is authored at 141 — one pixel. A flip is a transform on an ancestor, which
   *      DESIGN.md says spends headroom that does not exist, so this measures the symbol on the
   *      settled front face and would catch any scale creeping into the animation.
   *   4. **A press stops the automatic cycle for good.** A QR is a scanning target; a code that
   *      turns away after four seconds cannot be scanned by somebody reaching for their phone.
   */
  test("the hero's card holds its size, flips, and keeps its QR scannable at rest", async ({
    page,
  }) => {
    await gotoMarketing(page);

    /* The ruling and its margin are gone, not hidden — and so are the three objects rejected on
       this sheet before the card: a gradient, a device frame and a film. */
    await expect(
      page.locator("[data-hero-ledger], [data-hero-margin-rule], .mk-ledger"),
    ).toHaveCount(0);
    await expect(
      page.locator(".mk-sky, .mk-hero-glow, .mk-film-frame, [data-hero-film]"),
    ).toHaveCount(0);

    const card = page.locator("button[data-hero-card]");
    await expect(card).toHaveCount(1);

    /* The front is what the server renders and what reduced motion keeps. */
    await expect(card).toHaveAttribute("data-face", "front");

    /* ── the resting front face, which is the scanning target ──────────────────────────── */
    const front = await page.evaluate(() => {
      const qr = document.querySelector('[data-side="front"] [data-qr-zone]');
      const inner = document.querySelector(".mk-flip-inner");
      const box = document.querySelector("button[data-hero-card]")!.getBoundingClientRect();
      const r = qr?.getBoundingClientRect();
      return {
        qrPx: r ? Math.round(Math.min(r.width, r.height)) : 0,
        innerTransform: inner ? getComputedStyle(inner).transform : "",
        box: `${Math.round(box.width)}x${Math.round(box.height)}`,
      };
    });

    /* `FACE_WIDTH` x `FACE_HEIGHT` — derived in `share-face.tsx`, never retyped in the layer. */
    expect(front.box, "the flip box is not the face's own size").toBe("336x500");
    expect(front.qrPx, "the resting symbol is under the scannable floor").toBeGreaterThanOrEqual(
      140,
    );
    /* Identity at rest. A `matrix` with a scale in it here is the failure DESIGN.md warns about,
       and it would be invisible in a screenshot. */
    expect(
      ["none", "matrix(1, 0, 0, 1, 0, 0)"],
      `the front face rests at ${front.innerTransform}`,
    ).toContain(front.innerTransform);

    /* ── a press turns it and takes control away from the cycle ────────────────────────── */
    await card.click();
    await expect(card).toHaveAttribute("data-face", "back");
    await expect(card, "a press did not stop the automatic cycle").toHaveAttribute(
      "data-manual",
      "",
    );

    /* ── the back's loop, over a whole lap ─────────────────────────────────────────────── */
    const lap = await page.evaluate(async () => {
      const box = document.querySelector("button[data-hero-card]")!;
      const sizes = new Set<string>();
      const beats: string[] = [];
      const rowCounts = new Set<number>();

      const t0 = performance.now();
      await new Promise<void>((res) => {
        const iv = setInterval(() => {
          const r = box.getBoundingClientRect();
          sizes.add(`${Math.round(r.width)}x${Math.round(r.height)}`);
          const beat =
            box.querySelector("[data-live-card][data-beat]")?.getAttribute("data-beat") ?? "?";
          if (beats.at(-1) !== beat) beats.push(beat);
          rowCounts.add(box.querySelectorAll(".mk-live-row").length);
          if (performance.now() - t0 > 13000) {
            clearInterval(iv);
            res();
          }
        }, 90);
      });
      return { sizes: [...sizes], beats, rowCounts: [...rowCounts] };
    });

    expect(lap.sizes, "the card changed size during the loop").toHaveLength(1);
    expect(lap.beats.length, `the back did not advance: ${lap.beats.join(" -> ")}`).toBeGreaterThan(
      3,
    );
    expect(Math.min(...lap.rowCounts), "a beat rendered an empty card").toBeGreaterThanOrEqual(4);
  });

  /**
   * ⚠ **THE RULED GROUND CARRIES ONE INK LEVEL AND HAS NO SECONDARY TIER.**
   *
   * The same rule the four washes already follow, and it was found the same way — by measuring
   * rather than assuming. `--mk-stone` is the secondary body level and it fails on this ground
   * at every rule density, including densities too faint to see:
   *
   *     rule @ 3%   ground #eeeeef   stone 4.28:1   FAIL
   *     rule @ 7%   ground #e6e6e6   stone 3.98:1   FAIL   ← shipped
   *
   * There is no density at which the ruling is visible and stone is legal, so every level of
   * copy in the hero is ink at full strength and hierarchy is carried by size alone.
   *
   * This is asserted on the RENDERED colour rather than on the source, because `<Prose>`
   * defaults to `tone="stone"` — a future hand adding a line here and omitting `tone="ink"`
   * gets the illegal one by default, silently, and it will look fine in a screenshot.
   */
  test("every level of hero copy is a legal ink on white, and the accent is the only green", async ({
    page,
  }) => {
    await gotoMarketing(page);

    /* ⚠ THIS RULE RELAXED ON PURPOSE, AND THE REASON IS THE GROUND.
       It used to demand that EVERY level of hero copy be full-strength Onyx, because the hero
       was a ruled sheet: `--mk-stone` measures 2.30–3.07:1 where it crosses a rule, so the
       secondary tier was illegal there and hierarchy had to be carried by size and weight
       alone. The sheet is gone. On white, stone measures 4.83:1 and pebble 4.80:1 — both legal
       — so the hero can have a real secondary tier again.

       What is asserted now is the closed SET of colours, which is a tighter rule than "all
       ink" was loose: three inks, the accent, and white on the Onyx fill. Anything else in the
       hero is a colour nobody measured. */
    const LEGAL = new Set([
      "rgb(24, 26, 31)", // --mk-ink      17.41:1 on white
      "rgb(118, 111, 101)", // --mk-stone  4.83:1
      "rgb(114, 112, 111)", // --mk-pebble 4.80:1
      "rgb(65, 159, 141)", // --mk-green-display 3.01:1 on the wash — LARGE TEXT ONLY
      "rgb(255, 255, 255)", // the label on the Onyx primary
    ]);

    const nodes = await page.evaluate(() => {
      const hero = document.querySelector('[data-section="hero"]')!;
      return [...hero.querySelectorAll("h1, p, span, a")]
        .filter((n) => (n.textContent ?? "").trim().length > 0 && n.children.length === 0)
        /* ⚠ THE CARD'S INTERIOR IS EXCLUDED, AND IT IS NOT AN EXEMPTION.
           The card wears the Emerald palette: its name is `ink`, its labels are `inkSoft`, its
           monogram is `markInk` on `markBg`. Those are proven against every stop of Emerald's
           own gradient by `tests/contract/template-palettes.test.ts`, which is a stronger check
           than this one — it measures against the ground the ink is actually drawn on, where
           this test's ladder is the set of colours legal ON WHITE. Adding #0A3325 to the ladder
           below would be the wrong repair: it would make a card colour legal as page copy. */
        .filter((n) => !n.closest("[data-hero-card]"))
        .map((n) => ({
          text: (n.textContent ?? "").trim().slice(0, 28),
          color: getComputedStyle(n).color,
          px: Number.parseFloat(getComputedStyle(n).fontSize),
        }));
    });

    expect(nodes.length).toBeGreaterThan(3);
    for (const n of nodes) {
      expect(LEGAL.has(n.color), `"${n.text}" is ${n.color}, which no level declares`).toBe(true);

      /* ⚠ THE ACCENT IS SIZE-GATED, AND THIS IS THE ASSERTION THAT MATTERS MOST HERE.
         3.01:1 is the large-text bar. The same green on a 16px paragraph is illegal and looks
         identical in a screenshot, so the only thing that can catch it is a test. 24px is
         WCAG's floor for large text; the accent renders at 44px on a phone and 88px wide. */
      if (n.color === "rgb(65, 159, 141)") {
        expect(n.px, `the green accent "${n.text}" is set at ${n.px}px, below the 3:1 large-text floor`).toBeGreaterThanOrEqual(
          24,
        );
      }
    }
  });

  /**
   * The hero is the page's ONE authored moment, and this is the guard on the rule that makes it
   * safe: **the final state is the default.**
   *
   * `gotoReady` injects a stylesheet zeroing every duration and delay, which is what a screenshot
   * run sees. Under it every arriving element must already be at full opacity and untransformed —
   * the same state a reader gets with no scripting, and the reason the arrival is a CSS keyframe
   * rather than a `motion` component whose `initial` is baked into the server HTML.
   *
   * ⚠ SIX WRAPPERS: two headline clauses, then the explainer, the lead, the controls and the
   * caveat. It was five — the hero gained one line of copy when the client's locked explainer
   * ("The address book that updates itself.") was separated from the sentence under it.
   *
   * ⚠ THE CARD IS NOT ONE OF THEM, AND THAT IS DELIBERATE. It carries no `data-mk-arrive` and
   * has no entrance: it is server-rendered complete, because it is also what a reader with
   * reduced motion keeps forever. Fading in the one element whose whole argument is that it is
   * already there and already true would be an animation working against its own content.
   */
  test("every arriving element is painted at rest once durations are zeroed", async ({ page }) => {
    await gotoMarketing(page);
    const arriving = page.locator("[data-mk-arrive]");
    await expect(arriving).toHaveCount(6);

    /* The card has no arrival of its own — see the note above. */
    await expect(page.locator("[data-hero-card][data-mk-arrive]")).toHaveCount(0);

    const states = await arriving.evaluateAll((ns) =>
      ns.map((n) => {
        const c = getComputedStyle(n);
        return {
          opacity: Number.parseFloat(c.opacity),
          transform: c.transform,
          clip: c.clipPath,
          variant: n.getAttribute("data-mk-arrive"),
        };
      }),
    );
    for (const [i, s] of states.entries()) {
      expect(s.opacity, `arrival ${i} is not fully painted`).toBe(1);
      expect(["none", "matrix(1, 0, 0, 1, 0, 0)"], `arrival ${i} is displaced`).toContain(
        s.transform,
      );
    }
  });

  /**
   * ⚠ **THE PRIMARY ACTION MAY NOT BE AMBER ON THIS GROUND, AND THAT IS 1.4.11, NOT TASTE.**
   *
   * Amber measures **1.92:1 on paper**: the fill has no findable boundary, so the control stops
   * being locatable before its label is read. DESIGN.md states both the rule and the
   * substitution — *"a light pass wanting a primary action uses `dark`"* — and this test is
   * what stops the hero's CTA drifting back to the colour it wore for two builds on a sky.
   */
  test("the primary action is Onyx with a findable boundary, and is not Amber", async ({
    page,
  }) => {
    await gotoMarketing(page);
    const cta = page.locator("[data-hero-cta]");
    await expect(cta).toHaveCount(1);
    expect(await cta.evaluate((n) => n.tagName)).toBe("A");
    /* The brief's own control, now that `/waitlist` exists. It read `/signup/first-name` while
       that page did not — a hero button pointing at a 404 is a defect, not a design decision,
       so the label and target changed in the same step that built the route. */
    await expect(cta).toHaveAttribute("href", "/waitlist");
    await expect(cta).toHaveCSS("background-color", "rgb(24, 26, 31)");
    await expect(cta).toHaveCSS("color", "rgb(255, 255, 255)");

    /* The secondary is the `line` variant: no fill, a ring at ink/55 measuring 3.81:1 on bare
       paper and 3.31:1 where it crosses a rule. A secondary with NO boundary on a light ground
       is the failure this variant exists to prevent, so the ring is asserted, not the colour. */
    /* ⚠ LOCATED FROM THE COPY FIXTURE, NOT BY A HARD-CODED HREF. This has been `/templates`,
       then `#cards`, and is now `/corporate` as each of the brief's real destinations came into
       existence — and each move broke this line while breaking nothing about the page. What the
       test is actually for is the two properties below: the secondary has a findable boundary,
       and both controls clear the touch floor. Reading the target from `hero.secondary` keeps
       it asserting those through the next rename. */
    const secondary = page.locator(
      `[data-section="hero"] a[href="${hero.secondary.href}"]`,
    );
    await expect(secondary).toHaveCount(1);
    const ring = await secondary.evaluate((n) => getComputedStyle(n).boxShadow);
    expect(ring, "the secondary action has no visible boundary").not.toBe("none");
    expect(ring).toContain("inset");

    /* Both controls are reachable one-handed. PRODUCT.md's floor is 44px. */
    for (const control of [cta, secondary]) {
      const b = (await control.boundingBox())!;
      expect(b.height, "a hero control is under the 44px touch floor").toBeGreaterThanOrEqual(44);
    }
  });

  /**
   * The copy is legible on the ground it is ACTUALLY drawn on.
   *
   * ⚠ THE WORST GROUND CHANGED. It used to be "the paper with a 1px rule composited over it",
   * because the hero was ruled and a rule at 7% Onyx darkened the sheet under every line of
   * type. There is no ruling now, so the worst ground on the page is the darkest thing any
   * body copy sits on — which is `--mk-wash`, the near-white brand-green tint that every second
   * section wears.
   *
   * ⚠ AND IT SWEEPS THE WHOLE PAGE, NOT JUST THE HERO. The old test measured the hero because
   * the hero was the one surface with a texture under it. The alternation introduced a second
   * ground for every section, so the interesting question moved: it is no longer "is this
   * headline legible" but "did anything become illegible when its section changed colour".
   *
   * Large text is exempted at 3:1 rather than skipped, because the green accent lives there and
   * is legal only under that bar.
   *
   * WCAG 2.x, transcribed the same way as `src/lib/contrast.ts`.
   */
  test("every line of copy on the page clears AA on the ground it is drawn on", async ({
    page,
  }) => {
    await gotoMarketing(page);
    const failures = await page.evaluate(() => {
      const lin = (c: number) => {
        const x = c / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      const lum = (rgb: number[]) =>
        0.2126 * lin(rgb[0]!) + 0.7152 * lin(rgb[1]!) + 0.0722 * lin(rgb[2]!);
      const ratio = (a: number[], b: number[]) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
        return (x! + 0.05) / (y! + 0.05);
      };
      /**
       * Any computed colour → `[r, g, b, a]` in sRGB.
       *
       * ⚠ IT MUST HANDLE `oklab()`, AND THE FIRST CUT OF THIS TEST DID NOT — which produced the
       * single most convincing false failure in the run. Tailwind v4 implements an opacity
       * modifier (`text-mk-white/75`) as a `color-mix()`, and Chrome serialises the result as
       * `oklab(0.999994 0.0000455678 0.0000200868 / 0.75)`. Scraped for numbers, that reads as
       * rgb(1, 0, 0) — near-black — so white-at-75%-on-Onyx was reported at 1.16:1 against a
       * 4.5 bar. The copy was always fine; the parser was measuring a different colour.
       *
       * Every `/opacity` utility on the page arrives this way, so this is not an edge case, and
       * a regex over a colour string is not a colour parser.
       */
      const parse = (v: string): number[] => {
        const nums = v.match(/-?[\d.]+(?:e-?\d+)?/g)?.map(Number) ?? [];
        const alpha = v.includes("/") ? (nums[3] ?? 1) : (nums[3] ?? 1);

        if (v.startsWith("oklab(") || v.startsWith("oklch(")) {
          const L = nums[0] ?? 0;
          let [a, b] = [nums[1] ?? 0, nums[2] ?? 0];
          if (v.startsWith("oklch(")) {
            /* Polar to rectangular: C, H(deg) → a, b. */
            const h = ((nums[2] ?? 0) * Math.PI) / 180;
            [a, b] = [(nums[1] ?? 0) * Math.cos(h), (nums[1] ?? 0) * Math.sin(h)];
          }
          /* Oklab → linear sRGB (Björn Ottosson's matrices), then the sRGB transfer curve. */
          const l_ = L + 0.3963377774 * a! + 0.2158037573 * b!;
          const m_ = L - 0.1055613458 * a! - 0.0638541728 * b!;
          const s_ = L - 0.0894841775 * a! - 1.291485548 * b!;
          const [l, m, sh] = [l_ ** 3, m_ ** 3, s_ ** 3];
          const linear = [
            4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * sh,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * sh,
            -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * sh,
          ];
          const enc = (c: number) => {
            const v2 = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
            return Math.max(0, Math.min(255, v2 * 255));
          };
          return [enc(linear[0]!), enc(linear[1]!), enc(linear[2]!), alpha];
        }

        return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0, alpha];
      };
      /** Composite a translucent ink over its ground, which is what the eye actually receives. */
      const over = (fg: number[], bg: number[]) =>
        [0, 1, 2].map((i) => fg[i]! * fg[3]! + bg[i]! * (1 - fg[3]!));

      /**
       * The ground this text is drawn on, or `null` when it is not this test's to measure.
       *
       * ⚠ `null` MEANS A GRADIENT, AND SKIPPING IT IS THE HONEST ANSWER RATHER THAN A HOLE.
       * An element painting a `background-image` has no single ground — a card ground is two
       * stops at an angle — and `getComputedStyle` will happily report its `backgroundColor` as
       * transparent, which is how the first cut of this test "measured" white-on-Emerald as
       * 1:1 and reported forty-odd false failures. Text on those grounds is proven, stop by
       * stop, by `tests/contract/template-palettes.test.ts`, which is the suite that owns the
       * nine palettes. This test owns the page's own flat grounds — white, the wash, Onyx — and
       * the thing it is really guarding is that nothing became illegible when the alternation
       * changed a section's colour.
       */
      const groundOf = (el: Element): number[] | null => {
        let n: Element | null = el;
        while (n) {
          const cs = getComputedStyle(n);
          if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
          const bg = parse(cs.backgroundColor);
          if (bg[3] === 1) return bg.slice(0, 3);
          n = n.parentElement;
        }
        return [255, 255, 255];
      };

      const out: { text: string; ratio: number; need: number; px: number }[] = [];
      const nodes = [
        ...document.querySelectorAll(
          "main h1, main h2, main h3, main p, main li, main a, main span, main dt, main dd",
        ),
      ]
        .filter((n) => (n.textContent ?? "").trim().length > 0 && n.children.length === 0)
        /**
         * ⚠ THE EMBEDDED PRODUCT OBJECTS ARE OUT OF SCOPE, AND THIS IS A LIMIT OF THE METHOD
         * RATHER THAN A WAIVER.
         *
         * `<CardGround>` paints a card's surface as an absolutely positioned SIBLING layer, not
         * as a background on any ancestor of its text. A DOM walk-up therefore cannot see it —
         * it falls through to the page's white and reports white-on-Emerald as 1:1. That is a
         * false failure, and a test that cries wolf on twenty rows gets its expectations edited
         * rather than its subject fixed.
         *
         * Their contrast is not unchecked: `tests/contract/template-palettes.test.ts` proves
         * every ink of every one of the nine palettes against every stop of its own gradient, at
         * 7:1 for the primary tier — a harder bar than this test applies. What THIS test owns is
         * the page's own flat grounds and the copy drawn straight onto them, which is where the
         * alternation between white and the wash can silently take a colour under its bar. It
         * has already caught exactly that, twice.
         */
        .filter(
          (n) =>
            !n.closest(
              "[data-hero-card], [data-card-root], [data-bento-cell], [data-qr-zone], [data-example-card]",
            ),
        );

      for (const n of nodes) {
        const cs = getComputedStyle(n);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const ground = groundOf(n);
        if (!ground) continue;

        const px = Number.parseFloat(cs.fontSize);
        const bold = Number.parseInt(cs.fontWeight, 10) >= 700;
        /* WCAG's large-text definition: 24px, or 18.66px when bold. */
        const need = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5;
        const r = ratio(over(parse(cs.color), ground), ground);
        if (r < need) {
          out.push({
            text: (n.textContent ?? "").trim().slice(0, 40),
            ratio: Math.round(r * 100) / 100,
            need,
            px,
          });
        }
      }
      return out;
    });

    expect(
      failures,
      `copy below AA on its own ground:\n${failures.map((f) => `  ${f.ratio}:1 (needs ${f.need}) at ${f.px}px — "${f.text}"`).join("\n")}`,
    ).toEqual([]);
  });

  /**
   * ⚠ Reduced motion removes TRAVEL, never CONTENT.
   *
   * The hero's moment has been, in turn: a margin rule drawing down, a card's field loop, and
   * now a flip. The object keeps changing and the claim does not.
   *
   * Under reduced motion the card must hold its FRONT face — the real wallet pass, complete,
   * with its QR — and must not flip or start the back's loop. The front is the right thing to
   * keep: it is what the server renders, and it is the face that carries the scanning target.
   *
   * The implementation earns this the strong way rather than by zeroing a duration: neither
   * component starts a timer or observes anything, so there is no animation to interrupt and
   * nothing that can be left half-applied.
   */
  test("reduced motion holds the front face and never clips the headline", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoMarketing(page);

    const card = page.locator("button[data-hero-card]");
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute("data-face", "front");

    /* It stays there. A cycle that merely starts slower is still a cycle. */
    await page.waitForTimeout(5200);
    await expect(card, "the card flipped under reduced motion").toHaveAttribute(
      "data-face",
      "front",
    );

    /* The front's QR is still a real, resting symbol — reduced motion removes travel, not
       content, and this is the one piece of content on the card a phone can act on. */
    const qrPx = await page.evaluate(() => {
      const r = document
        .querySelector('[data-side="front"] [data-qr-zone]')
        ?.getBoundingClientRect();
      return r ? Math.round(Math.min(r.width, r.height)) : 0;
    });
    expect(qrPx).toBeGreaterThanOrEqual(140);

    /* And the back is present and settled rather than mid-edit, because a press still reveals
       it and it must not be caught halfway through a story it never started telling. */
    const rest = await page.evaluate(() => {
      const back = document.querySelector('[data-side="back"] [data-live-card]');
      return {
        beat: back?.getAttribute("data-beat"),
        states: [...(back?.querySelectorAll(".mk-live-row") ?? [])].map((r) =>
          r.getAttribute("data-state"),
        ),
        running: [...(back?.querySelectorAll("*") ?? [])]
          .map((e) => getComputedStyle(e).animationName)
          .filter((a) => a && a !== "none"),
      };
    });
    expect(rest.beat).toBe("settle");
    expect(new Set(rest.states), "the back is mid-edit under reduced motion").toEqual(
      new Set(["stable"]),
    );
    expect(rest.running, "an animation runs inside the card under reduced motion").toEqual([]);

    /**
     * ⚠ **THE HEADLINE MUST CARRY NO CLIP AT ALL UNDER REDUCED MOTION.**
     *
     * `line` is the only move on this page that hides content while it runs, so it is the only
     * one where "reduced motion" could turn into "reduced content" — a stuck or skipped clip is
     * a headline that is simply not there. The rule drops the animation entirely rather than
     * shortening it, which leaves `clip-path: none` because the value only ever existed inside
     * the keyframes. Asserting `none` is what catches a future hand moving the clip onto the
     * base rule and gating only the duration.
     */
    const clips = await page
      .locator('[data-hero-headline] [data-mk-arrive="line"]')
      .evaluateAll((ns) =>
        ns.map((n) => ({
          clip: getComputedStyle(n).clipPath,
          anim: getComputedStyle(n).animationName,
        })),
      );
    expect(clips.length).toBe(2);
    for (const c of clips) {
      expect(c.anim, "the wipe ran under reduced motion").toBe("none");
      expect(c.clip, "reduced motion left the headline clipped").toBe("none");
    }
  });
});

/* ── Truth ───────────────────────────────────────────────────────────────────── */

test.describe("what the page may and may not claim", () => {
  /**
   * ⚠ THIS REPLACED "marks the WhatsApp assistant as roadmap, not as shipped", AND IT IS A
   * STRONGER CLAIM RATHER THAN A WEAKER ONE.
   *
   * That test guarded a disclosure: a whole pass described an unbuilt feature in the present
   * tense, and one paragraph at body size carried the entire correction. The pass was cut when
   * the client asked for a crisper page — 154 words whose most important sentence was "not
   * built yet" is the slowest thing on a landing page to read — and cutting it removed the
   * disclosure obligation with it.
   *
   * So the assertion inverts: rather than checking that the one unshipped thing is labelled,
   * it checks that there is no unshipped thing to label. A future hand re-adding a roadmap
   * section has to fail this test to do it, which is the right place for that argument.
   */
  test("describes no unshipped capability anywhere on the page", async ({ page }) => {
    await gotoMarketing(page);
    await expect(page.locator("[data-assistant-status]")).toHaveCount(0);
    await expect(page.locator('[data-section="assistant"]')).toHaveCount(0);

    /* The words a roadmap section reaches for. If one appears, something unbuilt is being
       described and it needs a disclosure this page no longer has anywhere to put.

       ⚠ "waitlist" LEFT THIS LIST ON 2026-09-09, AND IT IS THE ONLY ONE THAT SHOULD HAVE.
       It was banned when the page mentioned a waitlist that did not exist. `/waitlist` is now a
       real page with a real form, and more to the point a waitlist is not a promise about an
       unshipped *capability* — it is the honest way to say the product is not open yet, which
       is the opposite of the thing this test guards. Every other phrase here describes a
       feature as nearly-available without committing to anything, and all of them stay.

       What this test still catches, and must: a section describing a product feature the build
       does not have. It caught exactly that once — a WhatsApp assistant section whose most
       important sentence was that the feature did not exist. */
    const body = (await page.locator("main").innerText()).toLowerCase();
    for (const phrase of ["coming soon", "coming next", "not built yet", "in beta", "early access"]) {
      expect(body, `the page promises something unshipped: "${phrase}"`).not.toContain(phrase);
    }
  });


  test("ships no pricing, anywhere", async ({ page }) => {
    await gotoMarketing(page);
    await expect(page.locator('[data-section="pricing"]')).toHaveCount(0);
    await expect(page.locator("[data-plan]")).toHaveCount(0);
    await expect(page.locator('a[href="/#pricing"]')).toHaveCount(0);
    const body = await page.locator("main").innerText();
    // Every figure previously here was invented.
    expect(body).not.toMatch(/£\s?\d|\$\s?\d|\bper month\b|\ba month\b/i);
  });

  test("ships no fabricated social proof", async ({ page }) => {
    await gotoMarketing(page);
    await expect(page.locator("[data-testimonial]")).toHaveCount(0);
    await expect(page.locator("blockquote")).toHaveCount(0);
  });

  test("the copy fixture holds none of the banned phrases and no invented price", () => {
    const src = readFileSync(resolve(process.cwd(), "src/fixtures/marketing.ts"), "utf8");
    const hits = BANNED_PHRASES.filter((p) => new RegExp(p, "i").test(src));
    expect(hits, `banned: ${hits.join(", ")}`).toEqual([]);
    expect(/export const pricing/.test(src)).toBe(false);
    expect(/export const testimonials/.test(src)).toBe(false);
  });
});

/* ── Content ─────────────────────────────────────────────────────────────────── */

test.describe("content", () => {
  /* ⚠ THE FAQ TEST WAS DELETED HERE. `faq-accordion.tsx` is gone: five accordion questions on
     a one-scroll overview page is exactly the text-heaviness the client pushed back on
     (*"so text-heavy"*, *"just to the point, crisp"*). Two of its answers survive inside
     `solution` — the one about nothing being installed, and the one about no app being able to
     rewrite an entry in someone else's phone. The rest can return on their own page, at which
     point this test comes back with them. */

  test("the close carries exactly one action", async ({ page }) => {
    await gotoMarketing(page);
    const links = section(page, "start").getByRole("link");
    await expect(links).toHaveCount(1);
    await expect(links).toHaveAttribute("href", "/waitlist");
  });
});

/* ── Craft ───────────────────────────────────────────────────────────────────── */

test.describe("craft", () => {
  /**
   * ⚠ THE HERO IS RANGED LEFT, AND IT USED TO BE THE FIRST NAME IN THIS LIST.
   *
   * That is the substance of the redesign rather than a side effect of it. Centred type has no
   * reading axis: every line begins somewhere different, so the eye hunts for the start of the
   * next one. Three centred heroes were rejected in a row and each rewrite changed the colour
   * behind them; the alignment was never the thing that got looked at.
   *
   * The hero now hangs off one vertical edge — the margin rule — with headline, lead, actions
   * and caveat all starting on it, in reading order. The close stays centred: it is one line
   * and one button, where centring is a composition rather than a paragraph setting.
   */
  test("centres the close, and nothing else — the hero is ranged left", async ({ page }) => {
    await gotoMarketing(page);
    const centred = await sections(page).evaluateAll((ns) =>
      ns
        .filter((n) => getComputedStyle(n).textAlign === "center")
        .map((n) => n.getAttribute("data-section")),
    );
    expect(centred.sort()).toEqual(["start"]);

    /* And the hero's four blocks share one left edge — the assertion the alignment is FOR.
       `textAlign` alone would pass on a block that was centred by an auto margin instead. */
    const lefts = await page.evaluate(() => {
      const hero = document.querySelector('[data-section="hero"]')!;
      const sel = "[data-hero-headline], [data-mk-arrive] > p, [data-hero-cta]";
      return [...hero.querySelectorAll(sel)].map((n) => Math.round(n.getBoundingClientRect().left));
    });
    expect(lefts.length).toBeGreaterThanOrEqual(3);
    expect(new Set(lefts).size, `hero blocks do not share a left edge: ${lefts.join(", ")}`).toBe(1);
  });

  /**
   * ⚠ THE HERO CARRIES EXACTLY ONE OBJECT, AND ITS IDENTITY IS THE ASSERTION.
   *
   * The history matters here more than in any other test in this file. This hero has held, and
   * had rejected: an azure→cyan gradient with centred type; a Sapphire gradient with a big
   * tilted card; the same gradient with a silent film; and a fan of three real `<ShareFace>`
   * passes on a ruled sheet — the last of those built, tested and rejected on sight. After the
   * fourth, this test asserted `toHaveCount(0)` on every object, and the rule written beside it
   * was "the hero is type-only".
   *
   * It now carries `<LiveCard>`, on the client's explicit brief — *"a visual of contact cards
   * being updated... a card in the middle, you see the fields updating, flying off, updating,
   * new ones"* — and with sign-off. The distinction that makes this a different proposition
   * rather than a fifth attempt at the same mistake: the four rejected objects were PICTURES OF
   * A CARD, placed in the empty half of the screen to fill it. This one performs the product's
   * only claim, and a visitor who reads nothing has still watched a card go out of date and
   * repair itself.
   *
   * So the guard is no longer "no object". It is **one object, with two faces**:
   *
   *   · exactly one `[data-hero-card]`, and nothing else that reads as an object
   *   · no film, no device frame, no gradient sheet, no third card
   *   · the front is a REAL `<ShareFace>` with a real QR, and the back is the live card
   *
   * ⚠ THE "NO QR IN THE HERO" CLAUSE WAS DELETED, AND IT WAS RIGHT UNTIL IT WASN'T.
   * It read: no QR anywhere in the hero, because the symbol has one pixel of clearance over the
   * 140px floor and a transform on an ancestor spends headroom that does not exist — which was
   * the mechanical argument for the hero's card being a bespoke rendition rather than a real
   * pass. The client asked for the opposite: the card in the hero should be the product's own
   * QR card, flipping to reveal the fields.
   *
   * The constraint did not go away; it moved into the flip's design. The turn is `rotateY`
   * alone, so both faces rest at an identity-equivalent transform and the resting symbol is
   * exactly the size it was authored. That is asserted by measurement in "holds its size,
   * flips, and keeps its QR scannable at rest" — which is a stronger guard than banning the
   * component was.
   *
   * If the object is rejected, the lesson is NOT "try a seventh object".
   */
  test("the hero carries exactly one object — a real card with two faces", async ({ page }) => {
    await gotoMarketing(page);
    const hero = page.locator('[data-section="hero"]');

    /* One flip, two faces, and the faces are the real components. */
    await expect(hero.locator("button[data-hero-card]")).toHaveCount(1);
    await expect(hero.locator('[data-side="front"] [data-qr-zone]')).toHaveCount(1);
    await expect(hero.locator('[data-side="back"] [data-live-card]')).toHaveCount(1);

    /* The four objects rejected on this sheet before it stay out. */
    await expect(
      hero.locator("[data-hero-film], .mk-sky, .mk-film-frame, video, canvas"),
    ).toHaveCount(0);

    /* ⚠ IT IS A REAL BUTTON, AND THAT IS NOT A DETAIL. The card is pressable — a QR is a
       scanning target and a reader has to be able to stop it turning — so it has to be reachable
       by keyboard and announce what a press does. A `<div>` with an `onClick` would look
       identical and be unusable without a mouse. */
    const control = hero.locator("button[data-hero-card]");
    expect(await control.evaluate((n) => n.tagName)).toBe("BUTTON");
    const label = await control.getAttribute("aria-label");
    expect(label, "the flip control has no accessible name").toBeTruthy();
    expect(label!.toLowerCase(), "the label does not say what a press does").toContain("press");

    /* And the label follows the face, so it never describes the side already showing. */
    const before = label!;
    await control.click();
    await expect(control).not.toHaveAttribute("aria-label", before);

    /* The faces themselves are hidden from assistive technology: a screen reader gets the
       control's label and the figure's caption, not two card renders read out in sequence, one
       of which rewrites itself every two seconds. */
    for (const side of ["front", "back"]) {
      await expect(hero.locator(`[data-side="${side}"]`)).toHaveAttribute("aria-hidden", "true");
    }

    /* The only images in the hero are drawn icons. The portraits are monograms, so the first
       viewport still makes no image request at all. */
    await expect(hero.locator("img")).toHaveCount(0);
  });

  /**
   * **There are real product objects below the hero, and they live in a closed set of named
   * homes.**
   *
   * ## Why the rule is shaped like this
   * It began as its opposite — `expect(page.locator("[data-card-root]")).toHaveCount(0)`, no
   * live card anywhere below the hero — written against a build that had spread NINE identical
   * `<ShareFace mode="thumb">` renders across the page as wallpaper. Banning the component was
   * the wrong instrument for the right complaint: the defect was decoration, not the product.
   * What the page was left with was eight passes of prose the client read exactly as it was
   * built — *"just text, text, text and nothing else"*.
   *
   * So the rule is bounded rather than absolute, because an unbounded version invites the
   * wallpaper straight back: card objects exist, each is doing a job no sentence could do, and
   * they live **only** in homes named here.
   *
   * ## ⚠ BOTH HOMES CHANGED IN THIS REBUILD, AND THE COUNT IS THE SAME BY COINCIDENCE
   * They were `studio` (in the bento) and `hand-over` (in `broadcast`); both components are
   * deleted. The homes are now:
   *
   *     problem    1 card   the "after" half of the before/after, read off the hero's last beat
   *     solution   3 cards  the pressable filter exhibit
   *
   * A card in a third place fails, which is the tooth that matters.
   */
  test("carries live product objects below the hero, and only in its named homes", async ({
    page,
  }) => {
    await gotoMarketing(page);

    const homes = { problem: 1, solution: 3 } as const;

    /* `[data-live-card]` is the marketing card object; `[data-solution-card]` is a pressable
       card in the exhibit. Counting them per section is what bounds the rule. */
    for (const [id, expected] of Object.entries(homes)) {
      const count = await page
        .locator(`[data-section="${id}"] [data-live-card], [data-section="${id}"] [data-solution-card]`)
        .count();
      expect(count, `${id} holds ${count} card objects, not ${expected}`).toBe(expected);
    }

    /* And nowhere else below the hero. `cards` is excluded by name: its six tiles are NOT card
       objects — they carry a type name and three or four field labels, which is why they are
       tiles and why `/templates` exists for the real thing. */
    const strays = await page.evaluate(() => {
      const allowed = new Set(["hero", "problem", "solution"]);
      return [...document.querySelectorAll("[data-live-card], [data-solution-card]")]
        .map((n) => n.closest("[data-section]")?.getAttribute("data-section") ?? "?")
        .filter((id) => !allowed.has(id));
    });
    expect([...new Set(strays)], "a card object appeared outside its named homes").toEqual([]);
  });

  /**
   * ⚠ THE PILL BAR MUST FIT INSIDE ITSELF, AND NOTHING WAS CHECKING THAT.
   *
   * At 360px the bar needed ~380px of content in 336px of room, so "Get started" — the product's
   * primary action, in its loudest chrome — was clipped by the pill's own right edge. It survived
   * because the bar is `position: fixed`: fixed overflow does not extend the document's scroll
   * width, so "never scrolls sideways" stayed green throughout. The only way to catch it is to
   * measure the controls against the bar's padding box, which is what this does.
   */
  test("the pill bar keeps its controls inside its own padding box", async ({ page }) => {
    await gotoMarketing(page);
    const fit = await page.locator("[data-pill-nav]").evaluate((nav) => {
      const c = getComputedStyle(nav);
      const box = nav.getBoundingClientRect();
      const inner = {
        left: box.left + Number.parseFloat(c.paddingLeft) + Number.parseFloat(c.borderLeftWidth),
        right: box.right - Number.parseFloat(c.paddingRight) - Number.parseFloat(c.borderRightWidth),
      };
      /* ⚠ Zero-size boxes are filtered out, and skipping that is a trap this test fell into
         while it was being written. The three centre links are `hidden md:flex`, so below 768px
         the `<ul>` is `display: none` and `getBoundingClientRect()` reports `0,0,0,0` — a left
         edge of 0, which is outside every real bar and makes the left-hand check fail on a bar
         that is perfectly fine. */
      const kids = [...nav.children]
        .map((k) => k.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0);
      return {
        overhangLeft: inner.left - Math.min(...kids.map((k) => k.left)),
        overhangRight: Math.max(...kids.map((k) => k.right)) - inner.right,
      };
    });
    // Sub-pixel only. A whole clipped character is ~8px.
    expect(fit.overhangLeft, "content escapes the bar on the left").toBeLessThanOrEqual(0.5);
    expect(fit.overhangRight, "content escapes the bar on the right").toBeLessThanOrEqual(0.5);
  });

  /**
   * ⚠ THIS WAS "adds no entrance animation to any section". THE BAN IS LIFTED; THE RULES ARE NOT.
   *
   * DESIGN.md forbade scroll motion outright and the client overrode it — *"the scroll effect
   * should also be a very smooth and very crazy transition."* The objection behind the old ban
   * was still correct, though, and it is the thing this test now guards instead: scattered
   * reveals "read as a template with a plugin attached… and they make every section behave
   * identically."
   *
   * So three properties, and each is the failure the old rule was actually pointing at:
   *
   *   1. **The vocabulary is closed.** Two named moves, `deal` for a pass and `rise` for
   *      contents. A third value appearing here means a section has started authoring its own
   *      entrance, which is how "a template with a plugin" happens one commit at a time.
   *   2. **No move may hide content.** Opacity stays 1 while armed. `armed` is applied by
   *      script and removed by an observer, so anything hidden by it is missing for a crawler,
   *      for a failed script, and in a background tab where IntersectionObserver never
   *      delivers at all. A displaced element is merely low.
   *   3. **The scroll is never hijacked.** Unchanged, and non-negotiable.
   */
  test("the scroll vocabulary is closed, hides nothing, and never hijacks the scroll", async ({
    page,
  }) => {
    await gotoMarketing(page);

    const moves = await page
      .locator("[data-mk-reveal-move]")
      .evaluateAll((ns) => [...new Set(ns.map((n) => n.getAttribute("data-mk-reveal-move")))]);
    expect(moves.length, "nothing is staged for scroll at all").toBeGreaterThan(0);
    expect(moves.sort(), `an unnamed scroll move appeared: ${moves.join(", ")}`).toEqual([
      "deal",
      "rise",
    ]);

    /* The safety rule, measured on the armed state rather than trusted from the stylesheet. */
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll('[data-mk-reveal="armed"]')]
        .filter((n) => Number.parseFloat(getComputedStyle(n).opacity) < 1)
        .map((n) => n.getAttribute("data-mk-reveal-move")),
    );
    expect(hidden, "an armed element is hidden rather than displaced").toEqual([]);

    await expect(page.locator("[data-scroll-moment]")).toHaveCount(0);
    const jacked = await page.evaluate(() => {
      const before = window.scrollY;
      window.scrollBy(0, 700);
      return window.scrollY > before;
    });
    expect(jacked).toBe(true);
  });

  /**
   * **The deck deals: a pass below the fold arms, and settles when the reader reaches it.**
   *
   * This is the client's scroll effect, asserted end to end rather than by reading the
   * stylesheet — the observer, the arming, the release and the resting transform.
   *
   * ⚠ It also pins the rule that makes the whole thing safe: **a pass already on screen at load
   * is never armed.** Arming above-the-fold content means the reader watches the first section
   * jump on every load, and it is what would let a stuck observer present as "the top of the
   * page is broken" rather than "something further down is briefly low".
   */
  test("a pass below the fold arms, then settles when it is scrolled to", async ({ page }) => {
    await gotoMarketing(page);

    const stateOf = (id: string) =>
      page
        .locator(`[data-section="${id}"] [data-pass]`)
        .evaluate((n) => n.getAttribute("data-mk-reveal"));

    /**
     * ⚠ THIS USED TO NAME `problem` AND ASSERT IT WAS UNARMED, on the comment "the first pass
     * sits inside the first viewport at every project width". That stopped being true the day
     * the hero gained its card: below `lg` the card stacks UNDER the copy, the hero roughly
     * doubles in height, and `problem` is no longer on screen at 360 or 768 — so it arms, which
     * is the rule working rather than failing.
     *
     * A test that hard-codes which section happens to be visible is a test that breaks every
     * time the hero's height changes. So the invariant is asserted directly instead:
     * **nothing intersecting the first viewport is armed, and something below it is.**
     * Viewport-independent, and it says what the rule actually is.
     */
    const arming = await page.evaluate(() => {
      const vh = window.innerHeight;
      return [...document.querySelectorAll("[data-section]")].flatMap((sec) => {
        const pass = sec.querySelector("[data-pass]");
        if (!pass) return []; // the hero is not a pass
        const top = pass.getBoundingClientRect().top;
        return [
          {
            id: sec.getAttribute("data-section"),
            onScreen: top < vh,
            state: pass.getAttribute("data-mk-reveal"),
          },
        ];
      });
    });

    const wronglyArmed = arming.filter((a) => a.onScreen && a.state === "armed");
    expect(
      wronglyArmed.map((a) => a.id),
      "a pass already on screen was armed, so the reader watches it jump on load",
    ).toEqual([]);

    expect(
      arming.some((a) => !a.onScreen && a.state === "armed"),
      "no pass below the fold armed at all, so the deck's scroll move never runs",
    ).toBe(true);

    const far = page.locator('[data-section="start"] [data-pass]');
    expect(await stateOf("start"), "the last pass, far below the fold, was not armed").toBe(
      "armed",
    );

    await far.scrollIntoViewIfNeeded();
    await expect
      .poll(async () => stateOf("start"), { timeout: 4000 })
      .toBe("in");

    /* Durations are zeroed, so "in" must already be the finished state and not a frame of it. */
    const transform = await far.evaluate((n) => getComputedStyle(n).transform);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"], `the pass settled at ${transform}`).toContain(
      transform,
    );
  });

  test("themes the surfaces the browser would otherwise own", async ({ page }) => {
    await gotoMarketing(page);
    const themed = await page.evaluate(() => {
      const root = document.querySelector("[data-mk-root]");
      if (!root) return null;
      const c = getComputedStyle(root);
      return { caret: c.caretColor, numerals: c.fontVariantNumeric };
    });
    expect(themed).not.toBeNull();
    expect(themed!.caret).not.toBe("rgb(0, 0, 0)");
    expect(themed!.numerals).toContain("tabular-nums");
  });
});

/* ── Source rules ────────────────────────────────────────────────────────────── */

test.describe("the type scale actually lands", () => {
  /**
   * **Every `text-mk-*` size utility in the markup resolves to the size it names.**
   *
   * This guards the one failure mode `components/marketing/mk-cn.ts` exists for, and it has now
   * shipped twice. `twMerge` resolves conflicts by sorting a class into a *class group*; it
   * knows Tailwind's own scales and can only guess at a custom one. For `text-*` it asks "does
   * this value look like a size?" — and `mk-heading-xl` does not, so unless the name is listed
   * in `mk-cn.ts` it is filed as a text COLOUR. Put it next to a real colour and twMerge keeps
   * the last one and silently drops the font size.
   *
   * It fails in the browser only, and it fails quietly: the class is in the markup, the CSS
   * rule exists in the stylesheet, and the class never reaches the element. The first time, it
   * rendered every headline on the page at the inherited 15px. The second time,
   * `text-mk-heading-xl` was bridged in `marketing.css` but missing from `mk-cn.ts`, and the
   * close's headline came out at 18px — smaller than the paragraph beneath it — beside
   * `text-mk-white`.
   *
   * A code review cannot see it and a snapshot only sees it if someone looks closely at the
   * right element. Comparing the computed size against the token the class names is the only
   * thing that catches it, and it catches every future instance rather than that one.
   */
  test("no `text-mk-*` size utility is silently dropped", async ({ page }) => {
    await gotoMarketing(page);

    const mismatches = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);

      /** The bridged size tokens, read off the live stylesheet rather than restated here. */
      const NAMES = [
        "display",
        "heading-xl",
        "heading-lg",
        "heading",
        "heading-sm",
        "subheading",
        "body",
        "body-sm",
        "caption",
        "eyebrow",
      ];

      /* Resolve each token to px by measuring it, because the values are `clamp()` expressions
         and only the browser knows what they are at this viewport. */
      const probe = document.createElement("span");
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      document.body.appendChild(probe);
      const expected = new Map<string, number>();
      for (const name of NAMES) {
        const raw = root.getPropertyValue(`--mk-text-${name}`).trim();
        if (!raw) continue;
        probe.style.fontSize = raw;
        expected.set(name, Number.parseFloat(getComputedStyle(probe).fontSize));
      }
      probe.remove();

      const out: { name: string; got: number; want: number; text: string; cls: string }[] = [];
      for (const el of document.querySelectorAll('main [class*="text-mk-"]')) {
        for (const cls of el.classList) {
          const name = cls.startsWith("text-mk-") ? cls.slice("text-mk-".length) : null;
          if (!name || !expected.has(name)) continue;
          const got = Number.parseFloat(getComputedStyle(el).fontSize);
          const want = expected.get(name)!;
          /* A whole pixel of tolerance: sub-pixel rounding differs between a probe span and a
             laid-out element, and this test is looking for a size that was DROPPED, which is
             always wrong by much more than a pixel. */
          if (Math.abs(got - want) > 1) {
            out.push({
              name,
              got,
              want,
              text: (el.textContent ?? "").trim().slice(0, 32),
              cls: el.className,
            });
          }
        }
      }
      return out;
    });

    expect(
      mismatches,
      `a size utility did not reach its element — check mk-cn.ts's font-size group:\n${mismatches
        .map((m) => `  text-mk-${m.name} wanted ${m.want}px, got ${m.got}px — "${m.text}"`)
        .join("\n")}`,
    ).toEqual([]);
  });
});

test.describe("the brand accent", () => {
  /**
   * **Five sections set one phrase of their heading in the brand green, and that is the single
   * thing that makes a white page read as ContactBook rather than as any white page.**
   *
   * Two properties, and both are the kind that look fine in a screenshot and are wrong:
   *
   *   1. **Exactly one accent per section.** `accented()` matches its phrase inside the heading
   *      and renders the heading PLAIN if it misses — a headline is worth more than a stack
   *      trace. That fail-open is only safe because this test turns a silent miss into a red
   *      run. Two accents in one heading is the other failure: at that point it is a green
   *      headline, and a green headline breaks the moment anybody sets it smaller.
   *   2. **The accent is size-gated.** `--mk-green-display` (#419F8D) measures 3.01:1 on the
   *      wash. That clears the LARGE-text bar of 3:1 and NOTHING else, so the same colour on a
   *      16px paragraph is illegal and indistinguishable by eye. Only a test can catch it.
   */
  test("every section sets exactly one accented phrase, and only at a large size", async ({
    page,
  }) => {
    await gotoMarketing(page);

    const accents = await page.evaluate(() =>
      [...document.querySelectorAll("[data-accent]")].map((n) => ({
        section: n.closest("[data-section]")?.getAttribute("data-section") ?? "?",
        text: (n.textContent ?? "").trim(),
        color: getComputedStyle(n).color,
        px: Number.parseFloat(getComputedStyle(n).fontSize),
        weight: Number.parseInt(getComputedStyle(n).fontWeight, 10),
      })),
    );

    /* The hero's accent is a headline clause rather than an `accented()` call, so it carries no
       `data-accent`; it has its own assertion in "sets the client's locked line as two clauses".
       These are the five that use the helper. */
    const perSection = accents.reduce<Record<string, number>>((acc, a) => {
      acc[a.section] = (acc[a.section] ?? 0) + 1;
      return acc;
    }, {});
    expect(perSection, "each of the five helper sections accents exactly one phrase").toEqual({
      problem: 1,
      solution: 1,
      cards: 1,
      "how-it-works": 1,
      belief: 1,
    });

    for (const a of accents) {
      expect(a.color, `${a.section}'s accent is ${a.color}, not the display green`).toBe(
        "rgb(65, 159, 141)",
      );
      /* WCAG's large-text floor: 24px, or 18.66px when bold. */
      const large = a.px >= 24 || (a.weight >= 700 && a.px >= 18.66);
      expect(
        large,
        `${a.section}'s accent "${a.text}" is ${a.px}px at weight ${a.weight}, below the 3:1 large-text floor`,
      ).toBe(true);
    }
  });
});

test.describe("the source rules a rendered page cannot show", () => {
  test("no eyebrow or kicker above a heading, anywhere", () => {
    // An absolute ban. `SectionHead` no longer accepts an overline and every `overline` field
    // was deleted from the fixture; this stops one being reintroduced by hand.
    const src = readFileSync(resolve(process.cwd(), "src/fixtures/marketing.ts"), "utf8");
    expect(/\boverline\b/.test(src), "fixture still declares an overline").toBe(false);

    const offenders = marketingSources()
      .filter((f) => f.file !== "type.tsx" && f.file !== "site-footer.tsx")
      // The field catalogue's group labels sit above a LIST, which is a label, not a kicker.
      .filter((f) => f.file !== "field-catalogue.tsx")
      .filter((f) => /<Eyebrow|<EyebrowPill/.test(f.code))
      .map((f) => f.file);
    expect(offenders, `kicker above a heading in: ${offenders.join(", ")}`).toEqual([]);
  });

  test("no component declares its own gradient, shadow, blur or app-chrome colour", () => {
    const RULES: { name: string; re: RegExp; skip?: string[] }[] = [
      /* Repeating gradients come from `.mk-ledger`; elevation comes from the pass.

         ⚠ `hero.tsx` was exempt from both of these rules and no longer is. It held the meadow's
         `linear-gradient` and its own `boxShadow` inline; both are deleted, and the ledger's
         ruling — whose density is capped by a contrast table, not chosen — lives in one CSS
         rule for exactly the reason this test exists. A call site retyping that density at 8%
         would silently take the sheet's only ink level below AA. */
      { name: "declares a gradient", re: /(linear|radial|conic)-gradient\(/ },
      { name: "uses glassmorphism as decoration", re: /backdrop-(blur|filter)/ },
      {
        name: "uses an app-chrome colour utility",
        re: /\b(?:text|bg|border)-(?:ink|ink-2|ink-3|ink-4|canvas|surface|surface-sunk|accent|line)\b/,
      },
      { name: 'imports `cn` from "@/lib/cn"', re: /from "@\/lib\/cn"/ },
      { name: "hardcodes a character measure", re: /max-w-\[\d+ch\]/ },
    ];
    const failures: string[] = [];
    for (const { file, code } of marketingSources()) {
      for (const rule of RULES) {
        if (rule.skip?.includes(file)) continue;
        if (rule.re.test(code)) failures.push(`${file} ${rule.name}`);
      }
    }
    expect(failures, failures.join("; ")).toEqual([]);
  });

  test("uses drawn icons, never a glyph standing in for one", () => {
    const failures: string[] = [];
    for (const { file, code } of marketingSources()) {
      // Emoji and arrows never ship. A `+` or `×` as an accordion indicator is a unicode glyph
      // wearing an icon's job; the indicator is a drawn svg with a real stroke.
      if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}]/u.test(code)) {
        failures.push(`${file} ships an emoji or arrow glyph`);
      }
      if (/>\s*[+×✓✔]\s*</.test(code)) failures.push(`${file} uses a glyph as an icon`);
    }
    expect(failures, failures.join("; ")).toEqual([]);
  });

  test("`/` ships no loading.tsx — it is the one static route", () => {
    expect(existsSync(resolve(process.cwd(), "src/app/(marketing)/loading.tsx"))).toBe(false);
  });

  /**
   * ⚠ THIS ASSERTED THE FILM'S ASSETS WERE PRESENT. IT NOW ASSERTS NOTHING REFERENCES THEM.
   *
   * The films in `public/hero/` are deliberately NOT deleted — they are rendered output of
   * `apps/video` and the client may want them on another surface — but no route may load one.
   * A 1.5MB WebM that nothing renders is dead weight the moment somebody re-adds a `<video>`
   * "because the file is already there", which is precisely how the hero acquired one.
   */
  test("no route loads the hero film any more", () => {
    const roots = ["src/components/marketing", "src/app/(marketing)"];
    const offenders: string[] = [];
    for (const root of roots) {
      const dir = resolve(process.cwd(), root);
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir, { recursive: true, encoding: "utf8" })) {
        const full = resolve(dir, file);
        if (!/\.(tsx|ts)$/.test(file)) continue;
        const code = readFileSync(full, "utf8");
        if (/hero-loop|hero-poster|<video/.test(code)) offenders.push(`${root}/${file}`);
      }
    }
    expect(offenders, `the film is referenced by: ${offenders.join(", ")}`).toEqual([]);
  });
});

/* ── The bento ───────────────────────────────────────────────────────────────── */

/**
 * `how-it-works` — the pass where the product stops being described and starts being shown.
 *
 * The section was four columns of prose separated by hairlines, and the client's verdict on the
 * page it produced was *"just text, text, text and nothing else, with the text being written in
 * different dev boxes in different colors."* These assertions are the machine-checkable half of
 * the answer, and the thing they are all really protecting is one rule: **the page carries real
 * product artefacts, and they are real.** A screenshot, an illustration or a stock photograph
 * would satisfy any test that only looked at layout, so none of these only looks at layout.
 *
 * ⚠ The one thing deliberately NOT asserted here is a QR decode. Five contract suites already
 * own that — `tests/e2e/qr-*.spec.ts` are the product's ground truth for whether a symbol reads,
 * they run the same `jsqr` pipeline at the same device scale, and a sixth decode written from
 * the marketing side would be a second, weaker implementation of a rule that already has one.
 * What this file owns instead is everything that decides whether the symbol on `/` is the real
 * mode at the real size, which is the part a marketing edit can break.
 */
/* ⚠ THE `the bento` DESCRIBE BLOCK WAS DELETED HERE, 2026-09-08 — SIX TESTS.
   Its subject no longer exists. `bento.tsx`, `demo-cells.tsx` and `card-studio.tsx` were the
   four-cell exhibit inside the old `step-list`, and all three are deleted: by the time a reader
   reaches "how it works" the hero has animated, the problem has struck three fields out, the
   solution has an exhibit they can press and the cards section is six coloured objects, so a
   fifth dense section removed the contrast that made the others feel like something.

   ⚠ ONE OF THOSE SIX WAS ALREADY FAILING BEFORE THIS REBUILD, AND ITS PROPERTY STILL MATTERS.
   "the scannable symbol is real and the scaled one is not" asserted `data-qr-preview="true"`,
   an attribute that exists nowhere in `src/` — `git grep data-qr-preview HEAD` finds it only in
   test files — so it cannot ever have passed. The property it was reaching for is real: a QR
   rendered too small to decode must carry the fixed dummy `PREVIEW_PAYLOAD` rather than a live
   `/c/{slug}`, or an unscannable image has leaked a real link. `cards-list.spec.ts` and
   `gallery.spec.ts` assert the same missing attribute and are the right place to fix it, since
   they own surfaces that still render a thumb QR. Tracked separately; not resolved by this
   deletion. */
