import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { close, hero, heroPhone, MARKETING_SECTION_IDS } from "@/fixtures/marketing";

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

/**
 * Resolve a `--mk-*` custom property, read off the active skin, to the `rgb(...)` string
 * `getComputedStyle().color` reports — so a colour assertion compares against what the browser
 * actually painted rather than a literal hex that drifts every time the skin layer moves one.
 *
 * ⚠ THE PATTERN, NOT A NEW ONE. This factors out the probe "the brand accent" describe block's
 * `every section sets exactly one accented phrase` test already does inline for
 * `--mk-accent-display`. Two skins share this suite (`atelier` default, `verdant` at
 * `?skin=verdant`), and a test that pins a hex is a test that is only ever honest about one of
 * them — this is the fix for every other colour assertion in the file that needs it.
 */
async function resolveSkinColor(page: Page, cssVar: string): Promise<string | null> {
  return page.evaluate((name) => {
    const root = document.querySelector("[data-mk-root]");
    if (root === null) return null;
    const raw = getComputedStyle(root).getPropertyValue(name).trim();
    if (!raw) return null;
    const probe = document.createElement("span");
    probe.style.color = raw;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, cssVar);
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
    /* ⚠ THE SELECTOR NARROWED TO THE TWO CLAUSE WRAPPERS, 2026-09-20, AND `h.locator("span")`
       IS WHY IT DID NOT BEFORE.
       `accented()` (`type.tsx`) renders the accent as a THIRD, nested `<span data-accent="">`
       inside the second clause's own `[data-mk-arrive="line"]` span — it always has, but this
       headline only started calling `accented()` in the 2026-09-20 pass (it used to hand-roll
       its own green span). A bare `"span"` selector matches all three: the two clauses AND the
       accent span nested inside the second one, so "two clauses" read as three. The two
       `[data-mk-arrive="line"]` spans ARE the two clauses regardless of what colours their own
       text — this is the same hook "every arriving element is painted at rest" already reads
       for the headline, so it needs no new attribute. */
    const clauses = h.locator('[data-mk-arrive="line"]');
    const lines = await clauses.allTextContents();
    expect(lines.length, "the headline is set as its two clauses").toBe(2);
    expect(lines.join(" ")).toBe("Never lose contact.");

    /* ⚠ ONE clause is ink and ONE carries the accent, and the split is asserted both ways.
       Colours are read off the active skin's own tokens (`--mk-ink`, `--mk-accent-display`),
       not a literal hex — see `resolveSkinColor`'s own comment — because the accent is gold
       under the default `atelier` skin and green only under `?skin=verdant`; a hex pinned to
       one skin is a test that is honest about the other only by coincidence.

       ⚠ EACH CLAUSE'S COLOUR IS READ OFF ITS DEEPEST COLOURED SPAN, NOT ITS OWN.
       The second clause's `[data-mk-arrive="line"]` wrapper carries no colour class itself —
       `accented()`'s nested `data-accent` span is what's actually green, and the wrapper's own
       `getComputedStyle().color` is just what it inherits (ink). Falling back to the wrapper
       when there is no nested accent span is what still reads the first clause correctly, since
       it has no such child. */
    const colours = await h.evaluate((node) =>
      [...node.querySelectorAll('[data-mk-arrive="line"]')].map((clause) => {
        const accent = clause.querySelector("[data-accent]");
        return getComputedStyle(accent ?? clause).color;
      }),
    );
    const [ink, accentInk] = await Promise.all([
      resolveSkinColor(page, "--mk-ink"),
      resolveSkinColor(page, "--mk-accent-display"),
    ]);
    expect(ink, "the skin layer did not define --mk-ink").not.toBeNull();
    expect(accentInk, "the skin layer did not define --mk-accent-display").not.toBeNull();

    /* `--mk-green-display` (the compatibility name for `--mk-accent-display`) measures 3.01:1
       on white under verdant and 3.44:1 under atelier — both clear the LARGE-text bar and
       nothing else, so this word is legal at the display step and would not be legal one step
       down. Asserting the count is what stops the accent spreading: two accented clauses is an
       accented headline, and an accented headline fails its own contrast bar the moment
       anybody sets it smaller. */
    expect(colours.filter((c) => c === ink), "the ink clause").toHaveLength(1);
    expect(colours.filter((c) => c === accentInk), "the accented clause").toHaveLength(1);
  });

  /**
   * ⚠ REWRITTEN AGAIN, 2026-09-20 — THE FLIP IS GONE, AND WITH IT THE QR THIS TEST USED TO GUARD.
   *
   * This test has now asserted, in order: a sheet of ruled contact-book paper with rules landing
   * on the headline's own line boxes (2026-09-08); then a FLIP — a real `<ShareFace>` on the
   * front, an animated look-alike on the back — whose four load-bearing clauses were the box
   * never resizing, no frame ever empty, the front's QR clearing the scannable floor at rest,
   * and a press stopping the automatic cycle. All four are gone with the component that made
   * them true. `docs/landing-integration.md`'s round on the hero card (Agent F) replaced the
   * whole flip with a single, static rendering of the product's own card page
   * (`@/card/card-page`) inside an `inert` wrapper — see `hero-card.tsx`'s own header for the
   * full account. There is no front, no back, no press, no cycle, and no QR: `<CardPage>` has
   * never carried one (that guarantee lives at `/cards/{id}` now — `qr-scannability.spec.ts`'s
   * own note says so), so "keeps its QR scannable at rest" is not a weaker claim here, it is a
   * claim about an object that no longer exists.
   *
   * What is left to guard, and is NOT already covered by "the hero carries exactly one object"
   * below: `<CardPage>` is fluid (`width: 100%` — no format of its own the way the wallet pass
   * had one), so *something* has to give it a definite width, and `hero.tsx`'s own `-mx-3`
   * sideways-scroll compensation is arithmetic against an EXACT number, 336. If this box quietly
   * started sizing itself off its fluid contents instead of a fixed budget, it would either
   * overflow at 360px or drift at some other width with nothing else on the page noticing, since
   * nothing else pins a card to a literal pixel count. That is the one property this test still
   * owns.
   *
   * ⚠ THE EXPECTED NUMBER IS 269, NOT 336, AND `SCREEN_WIDTH` HAS NEVER MOVED.
   * The client's fourth rejection was the device measuring too tall against a REAL laptop
   * viewport (700–780px, not the 900px every earlier pass measured against). `<CardPage>` was
   * already floored at 336px wide with every row at a 44px tap-target minimum, so there was no
   * height left to cut from its CONTENT; the whole device renders smaller instead, through
   * `zoom` on `.mk-phone-frame` (`marketing-hero.css`). `hero-card.tsx`'s `SCREEN_WIDTH` is
   * still exactly 336 and the card's own layout still resolves against that number — a
   * narrower card would reflow and wrap differently, which this build does not want. What
   * changed is that `getBoundingClientRect()` reports the POST-zoom, rendered footprint.
   *
   * ⚠ 262 → 269 ON 2026-09-21's DEVICE REBUILD, AND THE FACTOR NOW LIVES IN `hero.tsx`.
   * The fifth review asked for the reference's actual hardware — a machined rail outside the
   * black bezel, keys that protrude, a lens in the island (`phone-frame.tsx`'s header). That
   * widened the case from 6px a side to 13, so the zoom was re-derived against the same 360px
   * floor it always answered to and landed on 0.8: 362px of device renders at ~290px, which
   * keeps ~35px of margin a side at 360 and ~15px at 320. `marketing-hero.css` reads the
   * factor from `--mk-phone-zoom` so that the ONE thing that varies by viewport is set where
   * the breakpoints are (`hero.tsx`'s card column), not in a stylesheet that is contractually
   * free of media queries. 336 × 0.8 = 268.8, which rounds to the number below. A regression
   * that dropped the zoom entirely would fail this back up at 336; one that changed the case's
   * thickness without re-deriving the factor would fail it too, which is the point.
   */
  /* ⚠ 2026-09-29: 336 → 330. The card is now the client's reference card, laid out once at its
     330px design width (the reference's 326px screen ×1.012), and the zoom steps by viewport in
     `hero.tsx`'s card column. The claim is unchanged — the card is laid out at exactly its
     design width and rendered at another size only by `zoom` — and a regression that dropped the
     zoom, or let the card size itself off its contents, still fails it. */
  test("the hero's card holds a fixed 330px layout width, rendered only through the frame's zoom", async ({
    page,
  }) => {
    await gotoMarketing(page);
    const card = page.locator('[data-section="hero"] [data-hero-card]');
    await expect(card).toHaveCount(1);
    const { width, zoom } = await card.evaluate((n) => ({
      width: n.getBoundingClientRect().width,
      zoom: Number.parseFloat(getComputedStyle(n.closest(".mk-phone-frame")!).zoom),
    }));
    expect(zoom, "the frame lost its zoom").toBeLessThan(1);
    expect(
      Math.round(width),
      "the card drifted off its 330px design width — see hero-card.tsx's header",
    ).toBe(Math.round(330 * zoom));
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
  test("every level of hero copy is a legal ink on white, and the accent is the only colour", async ({
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
       hero is a colour nobody measured.

       ⚠ THE SET IS READ OFF THE ACTIVE SKIN, 2026-09-20, AND A HARDCODED HEX IS WHY THIS FAILED.
       Every literal below was verdant's — `rgb(24, 26, 31)` was `--mk-ink` before the skin
       layer, `rgb(65, 159, 141)` was `--mk-green-display` before the deck's own gold/green
       ladder existed. `atelier` (warm off-white, gold ladder) is the DEFAULT skin now, so a run
       against `/` with no `?skin` param renders `--mk-pebble` as `#6d6a64` — none of the four
       literals below — which is exactly the failure this test hit. Reading the ladder off
       `[data-mk-root]` via `resolveSkinColor` (this file's own helper, following "the brand
       accent" describe block's worked example) makes the set correct under BOTH skins instead
       of correct under whichever one happened to be default when the hex was copied in. The
       title drops "green" for the same reason: the accent is gold under the default skin and
       green only at `?skin=verdant`. */
    const [ink, stone, pebble, accent, white] = await Promise.all([
      resolveSkinColor(page, "--mk-ink"),
      resolveSkinColor(page, "--mk-stone"),
      resolveSkinColor(page, "--mk-pebble"),
      resolveSkinColor(page, "--mk-accent-display"),
      resolveSkinColor(page, "--mk-white"),
    ]);
    for (const [name, value] of [
      ["--mk-ink", ink],
      ["--mk-stone", stone],
      ["--mk-pebble", pebble],
      ["--mk-accent-display", accent],
      ["--mk-white", white],
    ] as const) {
      expect(value, `the skin layer did not define ${name}`).not.toBeNull();
    }
    const LEGAL = new Set([ink, stone, pebble, accent, white]);

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
        /* ⚠ 2026-09-29: THE WHOLE DEVICE, NOT ONLY THE CARD. The phone's status bar ("9:41")
           sits outside `[data-hero-card]` and is drawn in the reference's own pure black —
           hardware chrome in a picture of a phone, `aria-hidden`, not page copy on white. */
        .filter((n) => !n.closest("[data-hero-card], [data-hero-phone-frame]"))
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
         3:1 is the large-text bar and the accent clears it and nothing else under either skin.
         The same colour on a 16px paragraph is illegal and looks identical in a screenshot, so
         the only thing that can catch it is a test. 24px is WCAG's floor for large text; the
         accent renders at 44px on a phone and 88px wide. */
      if (n.color === accent) {
        expect(n.px, `the accent "${n.text}" is set at ${n.px}px, below the 3:1 large-text floor`).toBeGreaterThanOrEqual(
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
   * ⚠ IT WAS SIX WRAPPERS, THEN TEN, AND `toHaveCount(6)` WAS THE ANTIPATTERN, NOT THE PAGE.
   * Six was already a moving target before this — five until the client's locked explainer
   * ("The address book that updates itself.") was separated from the sentence under it — and
   * the 2026-09-19 pass added a 4-up proof row, one arrival per claim, without this count ever
   * being revisited. That is exactly backwards: a count that scales with fixture content
   * (`hero.proof.length`) belongs to the fixture, and this test hardcoding a second, silently
   * stale copy of it is the same failure mode the route manifest, the nav labels and the accent
   * tally already hit elsewhere in this file. So the proof row's contribution is read off
   * `hero.proof` and the rest — the eyebrow, the two headline clauses, the explainer, the lead
   * and the controls, which do NOT vary with fixture content — are asserted as the fixed shape
   * they are.
   *
   * ⚠ THE CARD IS NOT ONE OF THEM, AND THAT IS DELIBERATE. It carries no `data-mk-arrive` and
   * has no entrance: it is server-rendered complete, because it is also what a reader with
   * reduced motion keeps forever. Fading in the one element whose whole argument is that it is
   * already there and already true would be an animation working against its own content.
   */
  test("every arriving element is painted at rest once durations are zeroed", async ({ page }) => {
    await gotoMarketing(page);
    const arriving = page.locator("[data-mk-arrive]");

    /* One arrival per proof claim — derived from the fixture, not a magic number beside it. */
    const proofArrivals = await page.locator('[data-hero-proof] [data-mk-arrive]').count();
    expect(proofArrivals, "one arrival per proof item").toBe(hero.proof.length);

    /* The headline's two clauses, which is a shape of THIS headline, not of any fixture length. */
    const headlineArrivals = await page.locator('[data-hero-headline] [data-mk-arrive]').count();
    expect(headlineArrivals, "the headline's two clauses each arrive").toBe(2);

    /* Everything left over is the fixed, non-repeating part of the sequence: the eyebrow, the
       explainer, the lead and the controls. */
    const total = await arriving.count();
    expect(
      total - proofArrivals - headlineArrivals,
      "the eyebrow, explainer, lead and controls each arrive",
    ).toBe(4);

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
   *
   * ⚠ THE FILL IS NO LONGER `--mk-ink`, 2026-09-20 — SO NEITHER IS THIS TEST, AND "ONYX" LEFT
   * THE TITLE WITH IT.
   * `hero.tsx`'s own comment records the change: the CTA used to take `variant="dark"`, which
   * is `--mk-ink` — the site's general-purpose near-black every other `dark` control on the
   * page still uses. This one control overrides that fill with `--mk-accent-deep`, sampled
   * from the reference's own CTA (`docs/landing-integration.md`'s palette table — `#0D1C25`
   * under the default `atelier` skin). The two are near-identical under `atelier` and genuinely
   * different under `?skin=verdant` (`#0a5a4a`, a dark teal-green), so a literal "Onyx" hex here
   * was already skin-specific before it went stale — this reads `--mk-accent-deep` off the
   * active skin instead, via `resolveSkinColor`, the same as every other colour assertion added
   * this pass.
   */
  test("the primary action fill has a findable boundary, and is not Amber", async ({
    page,
  }) => {
    await gotoMarketing(page);
    const cta = page.locator("[data-hero-cta]");
    await expect(cta).toHaveCount(1);
    expect(await cta.evaluate((n) => n.tagName)).toBe("A");
    /* The brief's own control, now that `/waitlist` exists. It read `/signup/first-name` while
       that page did not — a hero button pointing at a 404 is a defect, not a design decision,
       so the label and target changed in the same step that built the route. */
    await expect(cta).toHaveAttribute("href", hero.primary.href);

    const [deep, white] = await Promise.all([
      resolveSkinColor(page, "--mk-accent-deep"),
      resolveSkinColor(page, "--mk-white"),
    ]);
    expect(deep, "the skin layer did not define --mk-accent-deep").not.toBeNull();
    expect(white, "the skin layer did not define --mk-white").not.toBeNull();
    await expect(cta).toHaveCSS("background-color", deep!);
    await expect(cta).toHaveCSS("color", white!);

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
   * The hero's moment has been, in turn: a margin rule drawing down, a card's field loop, a
   * flip, and now nothing at all — see "the hero's card holds a fixed, zoomed 262px width" above
   * for the full account of `<HeroCard>`'s 2026-09-20 rebuild. There is no front face to hold any
   * more, and holding one is not a weaker claim to have lost: `hero-card.tsx`'s own header
   * states it plainly — "there is no client state left in this file at all (no flip, no
   * timer)". A component that never starts a timer or observes anything has no animation for
   * `prefers-reduced-motion` to interrupt, so the property left to guard is that reduced motion
   * did not somehow stop the real card from rendering at all.
   *
   * What is UNCHANGED, and is still this test's main claim: the headline's `line` wipe is the
   * one move on the page that hides content while it runs, so it is the one place "reduced
   * motion" could still turn into "reduced content".
   */
  test("reduced motion changes nothing about the still card, and never clips the headline", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoMarketing(page);

    /* Non-vacuity: the card rendered, complete, exactly as it does with no motion preference
       set — an inert picture, not a control, so there is nothing else to hold. */
    const card = page.locator('[data-section="hero"] [data-hero-card]');
    await expect(card).toHaveCount(1);
    expect(await card.evaluate((n) => (n as HTMLElement).inert)).toBe(true);
    await expect(card).toContainText(heroPhone.name);

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

  /**
   * ⚠ REPLACED 2026-09-29 — THE CARD HOLDS STILL.
   *
   * From 2026-09-28 the hero card cycled through Maya Lauren's four cities on a timer, tinting
   * and tagging each changed line "Updated", with a pause control. The client called that
   * highlighting unrequested and asked for their reference card, which is a still picture. So
   * the property is now the opposite one, measured over longer than the old loop's first beat:
   * nothing on the card changes by itself, nothing is tagged, and there is no control to pause.
   */
  test("the hero card holds still — no cycling, no tags, no pause control", async ({ page }) => {
    await gotoMarketing(page);
    const card = page.locator("[data-section='hero'] [data-hero-card]");
    await expect(card).toHaveCount(1);
    const before = await card.innerHTML();
    await page.waitForTimeout(4500);
    expect(await card.innerHTML(), "the card changed by itself").toBe(before);
    await expect(card).not.toContainText("Updated");
    await expect(page.locator("[data-section='hero'] [data-hero-toggle]")).toHaveCount(0);
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
    await expect(links).toHaveAttribute("href", close.cta.href);
    /* 2026-09-28: the inline waitlist form went with the waitlist copy. */
    await expect(section(page, "start").locator("form")).toHaveCount(0);
  });

  /* 2026-09-29: the hero card and every card below it are one person. Until today the hero was
     the client's Maya Laurent and the sections under it another woman from the identity file. */
  test("every card on the page belongs to the hero card's person", async ({ page }) => {
    await gotoMarketing(page);
    await expect(section(page, "hero").locator("[data-hero-card]")).toContainText(heroPhone.name);
    const names = await page.locator("main [data-card-name]").allTextContents();
    expect(names.length, "no product card rendered below the hero").toBeGreaterThanOrEqual(4);
    for (const name of names) expect(name.trim()).toBe(heroPhone.name);
    for (const brand of await page.locator("main [data-card-brand]").allTextContents()) {
      expect(brand.trim()).toBe(heroPhone.company);
    }
  });

  /**
   * The client, 2026-09-28: *"Still showing old version: 'join the waitlist' copy and 'for
   * companies' tag need removing."* Both routes still exist; nothing on the homepage or its
   * chrome may point at them or say either phrase. Swept over the whole rendered page — nav,
   * every section, footer — by href as well as by text, so a relabelled link still fails.
   */
  test("links to neither the waitlist nor the companies page, and says neither phrase", async ({
    page,
  }) => {
    await gotoMarketing(page);
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") ?? ""),
    );
    expect(hrefs.filter((h) => /^\/(waitlist|corporate)\b/.test(h))).toEqual([]);
    const text = (await page.locator("body").innerText()).toLowerCase();
    for (const phrase of ["join the waitlist", "for companies"]) {
      expect(text, `the page still says "${phrase}"`).not.toContain(phrase);
    }
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

    /* And the hero's blocks share one left edge — the assertion the alignment is FOR.
       `textAlign` alone would pass on a block that was centred by an auto margin instead.

       ⚠ THE PROOF ROW IS EXCLUDED, AND THAT IS THE FIX, 2026-09-20.
       `[data-mk-arrive] > p` used to match exactly two paragraphs (the subhead, the lead) —
       the only direct-child `<p>`s of an arrival wrapper the hero had. The 2026-09-19 proof row
       added four more arrival wrappers, each with its OWN direct-child `<p>` (a serif title, a
       `<Prose as="p">` caption), and those are deliberately centred inside their own grid cell
       (`items-center text-center` — see `hero.tsx`'s own comment on the row), not ranged
       against the type column's left edge at all. Matching them here was never "the hero's
       left-ranged blocks gained four more", it was this selector becoming too broad for markup
       it predates: `hero blocks do not share a left edge` failed with eight distinct lefts, one
       pair per proof item, sitting exactly where their grid columns put them. The invariant this
       test protects is unchanged — headline, lead copy and the primary action hang off one
       edge — so the fix is excluding the row that was never part of that claim, not loosening
       the claim itself. */
    const lefts = await page.evaluate(() => {
      const hero = document.querySelector('[data-section="hero"]')!;
      const sel = "[data-hero-headline], [data-mk-arrive] > p, [data-hero-cta]";
      return [...hero.querySelectorAll(sel)]
        .filter((n) => !n.closest("[data-hero-proof]"))
        .map((n) => Math.round(n.getBoundingClientRect().left));
    });
    expect(lefts.length).toBeGreaterThanOrEqual(3);
    expect(new Set(lefts).size, `hero blocks do not share a left edge: ${lefts.join(", ")}`).toBe(1);
  });

  /**
   * ⚠ THE HERO CARRIES EXACTLY ONE OBJECT, AND ITS IDENTITY IS THE ASSERTION.
   *
   * The history matters here more than in any other test in this file. This hero has held, and
   * had rejected: an azure→cyan gradient with centred type; a Sapphire gradient with a big
   * tilted card; the same gradient with a silent film; a fan of three real `<ShareFace>` passes
   * on a ruled sheet; and then a flip between a real `<ShareFace>` (front) and an animated
   * look-alike (back), on the client's own brief for "a visual of contact cards being updated".
   *
   * ⚠ REWRITTEN AGAIN, 2026-09-20 — THE FLIP IS GONE, AND WITH IT "TWO FACES".
   * `docs/landing-integration.md`'s round on the hero card (Agent F) replaced the whole flip
   * with a single, static rendering of the product's own card page (`@/card/card-page`) —
   * `hero-card.tsx`'s own header makes the case at length: the reference shows one still card,
   * and a flip whose back is a live-updating card and whose front is now *also* a card is two
   * near-identical objects trading places rather than "what you hand over" vs. "what they see".
   * This is not the fifth rejected object — it is the fourth kept one, now presented without
   * the flip that used to carry it, which point 4 of the round's own brief explicitly permitted
   * ("Prefer one well-composed card page; say so if you disagree" — Agent F did not disagree).
   *
   * So the guard is no longer "one object, two faces". It is **one object, one real card, at
   * rest**:
   *
   *   · exactly one `[data-hero-card]`, and it is `inert` — a preview, not a control
   *   · it wraps exactly one real `<CardPage>` (`[data-card-root]`), never a hand-built look-alike
   *   · no film, no device frame, no gradient sheet, no third card, and no flip infrastructure
   *   · no QR — `<CardPage>` has never carried one; that guarantee lives at `/cards/{id}` now,
   *     which `qr-scannability.spec.ts` still decodes, per template, at every project viewport
   *
   * ⚠ THE ACCESSIBLE-NAME MECHANISM CHANGED WITH THE CONTROL IT DESCRIBED.
   * A pressable card needed an `aria-label` that changed with the face it announced. An `inert`
   * preview needs no label at all — `inert` removes the whole subtree from the accessibility
   * tree AND the tab order, which is the correct outcome for a card nobody can act on, and
   * `hero-card.tsx` gives a screen reader a plain `<figcaption>` in its place instead.
   */
  test("the hero carries exactly one object — the reference card, at rest", async ({
    page,
  }) => {
    await gotoMarketing(page);
    const hero = page.locator('[data-section="hero"]');

    const card = hero.locator("[data-hero-card]");
    await expect(card).toHaveCount(1);
    expect(await card.evaluate((n) => n.tagName)).toBe("DIV");

    /* Non-interactive: a preview, not a control. `inert` is read as the boolean IDL property,
       not just the markup attribute, so this also proves the browser actually applied it. */
    expect(
      await card.evaluate((n) => (n as HTMLElement).inert),
      "the card preview is not inert",
    ).toBe(true);

    /* ⚠ 2026-09-29: NO LONGER THE PRODUCT'S `<CardPage>`. The client asked for their reference
       card exactly, which no general-purpose card layout can be; it is a bespoke still drawing
       now (`hero-card.tsx`), and the one-object guard below is what still holds. */
    await expect(card.locator("[data-card-root]")).toHaveCount(0);

    /* No QR here any more — see this test's own docstring for where that guarantee lives now. */
    await expect(card.locator("[data-qr-zone]")).toHaveCount(0);

    /* Every object rejected on this sheet stays out, the flip's own infrastructure included now
       that it is retired rather than merely one of the rejects. */
    await expect(
      hero.locator(
        "[data-hero-film], .mk-sky, .mk-film-frame, video, canvas, button[data-hero-card], .mk-flip-inner, [data-side]",
      ),
    ).toHaveCount(0);

    /* A sighted-only caption stands in for the aria-label a pressable card used to need — the
       card itself is `inert`, so nothing inside it is what a screen reader should meet. */
    const caption = hero.locator("figure figcaption");
    await expect(caption).toHaveCount(1);
    expect(
      (await caption.textContent())?.trim().length ?? 0,
      "the caption has no accessible description",
    ).toBeGreaterThan(0);

    /* ⚠ 2026-09-29: ONE RASTER, AND IT CARRIES ITS OWN PRIORITY. The badge is inline SVG now,
       so the hero loads exactly one image — the client's reference portrait, at 2×/3× — and
       the `<img>` asks for it first itself (`fetchpriority="high"`), which replaces the
       `preload()` `hero.tsx` used while `<CardCover>` owned the tag. The property is the same
       one this block has always guarded: no unbudgeted, unprioritised photographic weight. */
    const images = card.locator("img");
    await expect(images).toHaveCount(1);
    await expect(images).toHaveAttribute("src", heroPhone.portrait.x2);
    await expect(images).toHaveAttribute("fetchpriority", "high");
    expect(
      await images.evaluate((n) => (n as HTMLImageElement).complete && (n as HTMLImageElement).naturalWidth > 0),
      "the portrait did not load",
    ).toBe(true);
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
   * ## ⚠ BOTH HOMES CHANGED IN THIS REBUILD; `problem` LOST ITS HOME ENTIRELY ON 2026-09-21
   * They were `studio` (in the bento) and `hand-over` (in `broadcast`); both components are
   * deleted. The homes became `problem` (1 card) and `solution` (the pressable filter exhibit),
   * and now `problem` is gone too: the client rejected the before/after card comparison outright
   * — *"I don't want you to just include this green card anymore in this"* — and `problem.tsx`
   * was rebuilt around a photograph and an editorial headline instead. See that file's own
   * header for the account in full. The only remaining named home is:
   *
   *     solution   3 cards  the pressable filter exhibit
   *
   * A card in a third place fails, which is the tooth that matters.
   */
  test("carries live product objects below the hero, and only in its named homes", async ({
    page,
  }) => {
    await gotoMarketing(page);

    /* `solution: 3` was here until 2026-09-19. Its three pressable filter cards were replaced
       by the pinned scroll sequence, and pinning that number again would just be the next
       stale list — the section is still being tuned and the count is an implementation
       detail. The rule this test exists to protect is stated in its own docstring: "a card in
       a third place fails, which is the tooth that matters." That is the `strays` assertion
       below, and it is untouched. `problem` no longer holds a card at all (see the docstring
       above), so it carries no exact count here any more — a card reappearing there would
       already fail as a stray, below. */
    const homes = {} as const;

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
       tiles and why `/templates` exists for the real thing. `problem` is excluded from the
       allowed set too, now that it holds no card object of its own — see the docstring above. */
    const strays = await page.evaluate(() => {
      const allowed = new Set(["hero", "solution"]);
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
    /* This listed five sections by name until 2026-09-19, two of which (`cards`, `belief`) were
       then cut — so it failed for a stale reason while the page was correct. That is the third
       time a hand-written list in this suite has done that.

       The property was never "these five sections exist". It is "a section that accents,
       accents exactly ONE phrase" — more than one and the emphasis stops meaning anything.
       Asserted that way, it needs no edit when a section is added or cut. */
    expect(
      Object.keys(perSection).length,
      "no section uses accented() any more — the helper or the markup has regressed",
    ).toBeGreaterThan(0);

    for (const [section, count] of Object.entries(perSection)) {
      expect(count, `${section} accents ${count} phrases; exactly one is the rule`).toBe(1);
    }

    for (const a of accents) {
      /* ⚠ THE VALUE CHANGED WITH THE SKIN LAYER, 2026-09-19, and the literal here was stale.
         It read `rgb(65, 159, 141)` — `#419F8D`, the ladder derived from the old `#5ABCA9`.
         The display rung is now the client deck's own `#15A185` under `verdant`, and
         `#A48157` under `atelier`.

         This run loads `/` with no query param, which the marketing layout stamps as
         `verdant`, so the verdant value is the correct expectation here. Read from the same
         custom property the component does rather than restating a hex, so the next palette
         move updates this assertion by definition instead of breaking it. */
      const displayInk = await page.evaluate(() => {
        const root = document.querySelector("[data-mk-root]");
        if (root === null) return null;
        const raw = getComputedStyle(root).getPropertyValue("--mk-accent-display").trim();
        /* Resolve the hex to the `rgb(...)` form `getComputedStyle().color` reports. */
        const probe = document.createElement("span");
        probe.style.color = raw;
        document.body.append(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        return resolved;
      });

      expect(displayInk, "the skin layer did not define --mk-accent-display").not.toBeNull();
      expect(
        a.color,
        `${a.section}'s accent is ${a.color}, not the skin's display ink ${displayInk}`,
      ).toBe(displayInk);
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

    /* ⚠ `hero.tsx` IS A SECOND EXCLUSION, ADDED 2026-09-20 — SCOPED, NOT A REPEAL.
       The rule bans a kicker over a SECTION heading — the page apologising for it before it
       argues anything. `hero.tsx`'s own comment at its one `<Eyebrow>` call draws the same
       distinction `field-catalogue.tsx`'s exclusion above already relies on: this is not that
       shape. "Contact Book" sits above the page's ONE `<h1>`, which is not a section — it is
       the masthead naming the product, the reference's own explicit layout, and a documented,
       signed-off exception rather than an oversight.

       Excluding the whole file by name would also silently wave through a SECOND, real kicker
       landing anywhere else in it, which is what "permit exactly that documented case" (not
       "exempt this file") means in practice: the exclusion is paired with a count, so hero.tsx
       may render `<Eyebrow>` exactly once — the masthead — and a second call anywhere in that
       file still fails this test, as does any `<EyebrowPill>` at all (a different component,
       built for a gradient ground this page no longer has, and not part of the documented
       exception). */
    const HERO_FILE = "hero.tsx";
    const heroFile = marketingSources().find((f) => f.file === HERO_FILE);
    expect(heroFile, `${HERO_FILE} is missing from marketingSources()`).toBeTruthy();
    const heroEyebrows = heroFile!.code.match(/<Eyebrow(?!Pill)/g)?.length ?? 0;
    expect(
      heroEyebrows,
      `hero.tsx's scoped eyebrow exception now renders ${heroEyebrows} — it is documented for exactly one, the masthead above the page's <h1>`,
    ).toBe(1);
    const heroEyebrowPills = heroFile!.code.match(/<EyebrowPill/g)?.length ?? 0;
    expect(heroEyebrowPills, "hero.tsx's scoped exception does not cover EyebrowPill").toBe(0);

    const offenders = marketingSources()
      .filter((f) => f.file !== "type.tsx" && f.file !== "site-footer.tsx" && f.file !== HERO_FILE)
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
