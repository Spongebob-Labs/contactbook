import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { MARKETING_SECTION_IDS, faq } from "@/fixtures/marketing";

import { PROJECT_VIEWPORT, boxOf, gotoReady } from "../helpers/e2e";

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
const CHROME_ANCHOR_IDS = ["how-it-works", "faq"] as const;

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

  test("every section but the hero is a pass with real depth", async ({ page }) => {
    await gotoMarketing(page);
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
    // Eight passes; the hero is the sky they lie on, not one of them.
    expect(passes).toHaveLength(SECTION_IDS.length - 1);
    for (const p of passes) {
      // A pass without a shadow is a rectangle, and the whole structure is depth.
      expect(p.shadow, `${p.id} has no shadow`).not.toBe("none");
      // The craft floor: a shadow must carry an offset and a blur, never be a flat halo.
      expect(p.shadow, `${p.id} shadow has no offset`).toMatch(/\dpx/);
      expect(p.radius, `${p.id} radius`).toBeGreaterThanOrEqual(24);
    }
  });

  test("the chrome's anchors exist and clear the fixed bar", async ({ page }) => {
    await gotoMarketing(page);
    for (const id of CHROME_ANCHOR_IDS) {
      const el = page.locator(`#${id}`);
      await expect(el).toHaveCount(1);
      const top = await el.evaluate((n) => Number.parseFloat(getComputedStyle(n).scrollMarginTop));
      expect(top, `${id} scroll-margin-top`).toBeGreaterThan(0);
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
  test("sets the headline in ink on paper, as two deliberate lines", async ({ page }) => {
    await gotoMarketing(page);
    const h = page.locator("[data-hero-headline]");
    await expect(h).toHaveCount(1);
    /* Onyx, 15.97:1 on paper. It was white-on-sky through three builds; the sky is gone and
       `amber`/`white`/`glass` all went with it, so this is the assertion that would fail first
       if a fourth gradient were quietly reintroduced under the copy. */
    await expect(h).toHaveCSS("color", "rgb(24, 26, 31)");

    /* The two clauses are set on their own lines at render time. The fixture still holds ONE
       string — this asserts the typographic split without letting the copy fork into two
       fields that can drift out of agreement with `hero.headline`. */
    const lines = await h.locator("span").allTextContents();
    expect(lines.length, "the headline is set as its two clauses").toBe(2);
    expect(lines.join(" ")).toBe("Hand over one card. Keep it true for years.");
  });

  /**
   * **The ruling is in register with the type, and that is the whole difference between a page
   * ruled for this text and lines drawn behind it.**
   *
   * `--mk-ledger-rhythm` is `--mk-text-display × --mk-text-display-lh`, so one ruled row is
   * exactly one headline line box, and `--mk-ledger-lead` anchors the pattern to the copy
   * block's top edge. Both are shared tokens — the hero's padding is `pt-[var(--mk-ledger-lead)]`
   * rather than a matching number — and this test is what makes that coupling load-bearing
   * instead of a comment. Retype either as a literal and the rules drift into the letterforms.
   */
  test("is a ruled sheet whose rules land on the headline's own line boxes", async ({ page }) => {
    await gotoMarketing(page);
    await expect(page.locator("[data-hero-ledger]")).toHaveCount(1);
    await expect(page.locator("[data-hero-margin-rule]")).toHaveCount(1);
    /* The sky, its bloom and the film are deleted, not hidden. A future hand putting a gradient
       or a video back into this hero should have to argue with this line first. */
    await expect(
      page.locator(".mk-sky, .mk-hero-glow, .mk-film-frame, [data-hero-film], [data-hero-card]"),
    ).toHaveCount(0);

    const reg = await page.evaluate(() => {
      const sec = document.querySelector('[data-section="hero"]')!;
      const secTop = sec.getBoundingClientRect().top + window.scrollY;

      /* Read the rhythm off a live element rather than parsing the calc: it is a clamp times a
         line height and only the browser knows what that is at this viewport. */
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;visibility:hidden;height:var(--mk-ledger-rhythm)";
      sec.appendChild(probe);
      const rhythm = probe.getBoundingClientRect().height;
      probe.remove();

      const lead = document.createElement("div");
      lead.style.cssText = "position:absolute;visibility:hidden;height:var(--mk-ledger-lead)";
      sec.appendChild(lead);
      const leadPx = lead.getBoundingClientRect().height;
      lead.remove();

      /* ⚠ Each span is one CLAUSE, and a clause WRAPS at narrow viewports — two rendered lines
         at 360, one at 1440. So the assertion cannot be "a span is one ruled row tall"; it is
         "a span is a WHOLE NUMBER of ruled rows tall", which holds at every width and is the
         property that actually keeps the type in register.
         (A `Range` over the text node was tried and is wrong: `getClientRects` returns the text
         box — 66.5px against an 89.76px line box — so it measures the glyphs, not the leading.) */
      const lines = [...document.querySelectorAll("[data-hero-headline] span")].map((n) => {
        const b = n.getBoundingClientRect();
        return { top: b.top + window.scrollY - secTop, height: b.height };
      });

      /* Distance from each line's top edge to the nearest rule. The rules sit at
         `leadPx + n * rhythm`. */
      const offBy = (y: number) => {
        const k = Math.round((y - leadPx) / rhythm);
        return Math.abs(y - (leadPx + k * rhythm));
      };

      const ledger = document.querySelector("[data-hero-ledger]")!.getBoundingClientRect();
      const rule = document.querySelector("[data-hero-margin-rule]")!.getBoundingClientRect();

      return {
        rhythm,
        rowsPerLine: lines.map((l) => l.height / rhythm),
        topsOffBy: lines.map((l) => offBy(l.top)),
        ledgerLeft: ledger.left,
        ruleLeft: rule.left,
      };
    });

    /* Every clause occupies a whole number of ruled rows. Sub-pixel tolerance only — this is
       arithmetic, not an eyeball. */
    for (const rows of reg.rowsPerLine) {
      expect(
        Math.abs(rows - Math.round(rows)) * reg.rhythm,
        `a headline clause is ${rows.toFixed(3)} ruled rows tall, not a whole number`,
      ).toBeLessThan(1);
      expect(Math.round(rows), "a headline clause occupies no rows").toBeGreaterThanOrEqual(1);
    }
    for (const [i, off] of reg.topsOffBy.entries()) {
      expect(off, `headline line ${i} does not sit on a rule`).toBeLessThan(1);
    }

    /* On a ledger the ruling STARTS at the margin rule. Running edge to edge past it is what
       made the vertical stroke read as an unrelated line in the first build. */
    expect(
      Math.abs(reg.ledgerLeft - reg.ruleLeft),
      "the ruling must begin at the margin rule",
    ).toBeLessThan(2);
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
  test("every level of hero copy is full-strength ink, never the secondary level", async ({
    page,
  }) => {
    await gotoMarketing(page);
    const colours = await page.evaluate(() => {
      const hero = document.querySelector('[data-section="hero"]')!;
      const text = [...hero.querySelectorAll("h1, p, span, a")].filter(
        (n) => (n.textContent ?? "").trim().length > 0 && n.children.length === 0,
      );
      return text.map((n) => ({
        text: (n.textContent ?? "").trim().slice(0, 28),
        color: getComputedStyle(n).color,
        // The dark CTA's white label is the one legitimate exception: it is on an Onyx fill.
        onFill: getComputedStyle(n.closest("a") ?? n).backgroundColor,
      }));
    });
    expect(colours.length).toBeGreaterThan(3);
    for (const c of colours) {
      if (c.onFill === "rgb(24, 26, 31)") continue; // white label on the Onyx primary
      expect(c.color, `"${c.text}" is not full-strength ink on the ruled ground`).toBe(
        "rgb(24, 26, 31)",
      );
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
   * ⚠ FIVE WRAPPERS: two headline clauses plus lead, controls and caveat. It was four, and
   * before that five including the film — the headline used to arrive as one block and is now
   * staged per clause, which is the client's *"professional animation that should be visible"*.
   */
  test("every arriving element is painted at rest once durations are zeroed", async ({ page }) => {
    await gotoMarketing(page);
    const arriving = page.locator("[data-mk-arrive]");
    await expect(arriving).toHaveCount(5);

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

    /**
     * ⚠ THE CLIP MUST NOT CLIP AT REST, AND ZERO IS THE WRONG VALUE FOR THAT.
     *
     * `line` finishes on `inset(-35% 0 -35% 0)` rather than `inset(0)` because the glyphs
     * overflow their own line box — Space Grotesk runs about 1.23em of ascender-plus-descender
     * against a 1.02em line box. A zero inset would permanently shave the caps and the tail of
     * every `y`, `p` and `g` in the finished headline, which reads as a rendering fault rather
     * than as an animation bug and would survive review.
     *
     * So the assertion is not "no clip-path": it is "the clip region is larger than the box".
     */
    const lines = states.filter((s) => s.variant === "line");
    expect(lines.length, "the headline is not staged per clause").toBe(2);
    for (const l of lines) {
      expect(l.clip, `a headline clause rests on a clipping region: ${l.clip}`).toMatch(/-\d/);
      expect(l.clip).not.toContain("100%");
    }

    /* The margin rule is the other half of the moment and it animates `scaleY`. With durations
       zeroed it must be at FULL height — an `animation-fill-mode` regression here leaves the
       rule collapsed to nothing in every screenshot and for every reader whose script fails. */
    const rule = page.locator("[data-hero-margin-rule]");
    const box = (await rule.boundingBox())!;
    expect(box.height, "the margin rule is collapsed at rest").toBeGreaterThan(100);
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
    await expect(cta).toHaveAttribute("href", "/signup/first-name");
    await expect(cta).toHaveCSS("background-color", "rgb(24, 26, 31)");
    await expect(cta).toHaveCSS("color", "rgb(255, 255, 255)");

    /* The secondary is the `line` variant: no fill, a ring at ink/55 measuring 3.81:1 on bare
       paper and 3.31:1 where it crosses a rule. A secondary with NO boundary on a light ground
       is the failure this variant exists to prevent, so the ring is asserted, not the colour. */
    const secondary = page.locator('[data-section="hero"] a[href="/templates"]');
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
   * The copy is legible on the ground it is ACTUALLY drawn on — which, on a ruled sheet, is not
   * the paper. It is the paper with a 1px rule composited over it, and that is the sample this
   * test takes: the worst case, not the average one.
   *
   * WCAG 2.x, transcribed the same way as `src/lib/contrast.ts`.
   */
  test("the hero copy clears AA over a rule, not just over bare paper", async ({ page }) => {
    await gotoMarketing(page);
    const worst = await page.evaluate(() => {
      const lin = (c: number) => {
        const x = c / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      const lum = (rgb: number[]) =>
        0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
      const parse = (s: string) => s.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number);
      const resolve = (value: string) => {
        const el = document.createElement("span");
        el.style.color = value;
        document.body.appendChild(el);
        const rgb = parse(getComputedStyle(el).color);
        el.remove();
        return rgb;
      };

      /* Read the ground and the rule off the live tokens, so a retune moves this test's inputs
         instead of leaving it measuring last month's sheet. */
      const cs = getComputedStyle(document.documentElement);
      const paper = resolve(cs.getPropertyValue("--mk-paper").trim());
      const inkRule = cs.getPropertyValue("--mk-ledger-ink").trim();
      const alpha = Number.parseFloat(inkRule.match(/\/\s*([\d.]+)\s*\)/)?.[1] ?? "0");
      const ink = resolve(cs.getPropertyValue("--mk-ink").trim());

      /* The worst ground in the hero: the paper with a rule drawn on it. */
      const overRule = paper.map((c, i) => ink[i] * alpha + c * (1 - alpha));

      const ratio = (a: number[], b: number[]) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };

      /* Every distinct rendered text colour in the hero, against the worst ground, excluding
         labels sitting on a filled control. */
      const hero = document.querySelector('[data-section="hero"]')!;
      const nodes = [...hero.querySelectorAll("h1, p, span, a")].filter(
        (n) =>
          (n.textContent ?? "").trim().length > 0 &&
          n.children.length === 0 &&
          getComputedStyle(n.closest("a") ?? n).backgroundColor !== "rgb(24, 26, 31)",
      );
      return Math.min(...nodes.map((n) => ratio(parse(getComputedStyle(n).color), overRule)));
    });
    expect(
      worst,
      "hero copy must clear AA where it crosses a rule, which is its worst ground",
    ).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * ⚠ Reduced motion removes TRAVEL, never CONTENT.
   *
   * The hero's moment is the margin rule drawing down. Under reduced motion the animation is
   * dropped entirely, which must leave the rule at rest and at full height — not collapsed,
   * and not mid-draw. This replaces the film's reduced-motion test, whose claim was the same
   * one about a different object.
   */
  test("reduced motion keeps the margin rule at full height and drops the draw", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoMarketing(page);
    const state = await page.locator("[data-hero-margin-rule]").evaluate((n) => {
      const c = getComputedStyle(n);
      return { anim: c.animationName, transform: c.transform, height: n.getBoundingClientRect().height };
    });
    expect(state.anim, "the draw must not run under reduced motion").toBe("none");
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(state.transform);
    expect(state.height, "reduced motion collapsed the rule instead of stilling it").toBeGreaterThan(
      100,
    );

    /**
     * ⚠ **THE HEADLINE MUST CARRY NO CLIP AT ALL UNDER REDUCED MOTION.**
     *
     * `line` is the only move on this page that hides content while it runs, so it is the only
     * one where "reduced motion" could turn into "reduced content" — a stuck or skipped clip is
     * a headline that is simply not there. The reduced-motion rule drops the animation entirely
     * rather than shortening it, which leaves `clip-path: none` because the value only ever
     * existed inside the keyframes. Asserting `none` (and not merely "non-clipping") is what
     * catches a future hand moving the clip onto the base rule and gating only the duration.
     */
    const clips = await page
      .locator('[data-hero-headline] [data-mk-arrive="line"]')
      .evaluateAll((ns) =>
        ns.map((n) => ({ clip: getComputedStyle(n).clipPath, anim: getComputedStyle(n).animationName })),
      );
    expect(clips.length).toBe(2);
    for (const c of clips) {
      expect(c.anim, "the wipe ran under reduced motion").toBe("none");
      expect(c.clip, "reduced motion left the headline clipped").toBe("none");
    }

    /* And the ruling is painted rather than mid-fade — reduced motion removes travel, not the
       page's ground. */
    const ledger = await page
      .locator("[data-hero-ledger]")
      .evaluate((n) => ({ op: getComputedStyle(n).opacity, anim: getComputedStyle(n).animationName }));
    expect(ledger.anim).toBe("none");
    expect(Number.parseFloat(ledger.op), "the ruling is faded out under reduced motion").toBe(1);
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
       described and it needs a disclosure this page no longer has anywhere to put. */
    const body = (await page.locator("main").innerText()).toLowerCase();
    for (const phrase of ["coming soon", "coming next", "not built yet", "in beta", "waitlist", "early access"]) {
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
  test("opens an answer on click, and every trigger starts closed", async ({ page }) => {
    await gotoMarketing(page);
    const triggers = section(page, "faq").getByRole("button");
    await expect(triggers).toHaveCount(faq.entries.length);
    for (let i = 0; i < faq.entries.length; i += 1) {
      await expect(triggers.nth(i)).toHaveAttribute("aria-expanded", "false");
    }
    await triggers.first().click();
    await expect(triggers.first()).toHaveAttribute("aria-expanded", "true");
    await expect(section(page, "faq").locator("[data-faq-answer]").first()).toBeVisible();
  });

  test("the close carries exactly one action", async ({ page }) => {
    await gotoMarketing(page);
    const links = section(page, "start").getByRole("link");
    await expect(links).toHaveCount(1);
    await expect(links).toHaveAttribute("href", "/signup/first-name");
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
   * ⚠ THE HERO NOW CARRIES NO OBJECT AT ALL, AND THAT IS THE ASSERTION.
   *
   * This was "the hero's one object is the film, in a frame that is not a second card", and
   * before that it counted a tilted card. The hero has held, in turn: a card, then a card drawn
   * around a film that already rendered a card, then a film alone. All three are gone —
   * *"remove both of them… it should be text."*
   *
   * So the claim inverts. There is no object in the hero, and the guard is that none comes
   * back: not a card, not a film, not a device frame, not a mockup. The hero is type on a ruled
   * sheet, and the one authored moment is a hairline being drawn, which is not an object.
   */
  test("the hero carries no object — no card, no film, no frame", async ({ page }) => {
    await gotoMarketing(page);
    const hero = page.locator('[data-section="hero"]');
    await expect(hero.locator("[data-hero-card], [data-hero-film], [data-card-root]")).toHaveCount(
      0,
    );
    await expect(hero.locator("video, img, canvas, svg")).toHaveCount(0);
  });

  /**
   * ⚠ THIS TEST WAS INVERTED, AND THE INVERSION IS THE POINT OF THE REDESIGN.
   *
   * It read `expect(page.locator("[data-card-root]")).toHaveCount(0)` — no live card anywhere
   * below the hero. That rule was written against a build which had spread NINE identical
   * `<ShareFace mode="thumb">` renders across the page as wallpaper, and banning the component
   * was the wrong instrument for the right complaint: the defect was decoration, not the
   * product.
   *
   * What the page was left with was eight passes of prose on tinted grounds, which the client
   * read exactly as it was built — *"just text, text, text and nothing else"*. So the rule is
   * now the other way round and it is bounded, because an unbounded version invites the
   * wallpaper straight back:
   *
   *   · There are card objects below the hero, and they are LIVE renders rather than pictures.
   *   · Each one is doing a job no sentence could do.
   *   · They live in a **closed set of named homes**, with a declared shape each, and nowhere
   *     else.
   *
   * ⚠ **THE SET GAINED A SECOND HOME AND THE COUNT WENT FROM TWO TO FOUR.** It began as "only
   * in the bento" with `toHaveCount(2)`; the hand-over flow in `broadcast` added the second.
   *
   * ⚠ A third home — a fan of three passes in the hero — was added and then **removed at the
   * client's word**: *"remove the cards that u just added into the hero section looking very
   * vague and odd."* That is the fourth object rejected on that sheet, after azure→cyan, the
   * Sapphire film, and now the fan. The hero's own test is back to banning every object, and
   * the standing lesson is that the hero holds type and nothing else.
   *
   * Growing the rule rather than deleting it is the entire point, so each home declares the
   * exact shape it may hold:
   *
   *     studio        1 face + 1 page   the reader recolours both
   *     hand-over     1 face + 1 page   the pass, and the page it opens
   *
   * That keeps every tooth the original had. A card in a third place fails — which matters,
   * because the build this rule was first written against had spread NINE identical
   * `<ShareFace>` renders across the page as wallpaper.
   */
  test("carries live product objects below the hero, and only in its two named homes", async ({
    page,
  }) => {
    await gotoMarketing(page);

    /* The closed set, each with the multiset of variants it is allowed to hold. */
    const HOMES = [
      { sel: '[data-bento-cell="studio"]', shape: ["face", "page"] },
      { sel: "[data-handover-flow]", shape: ["face", "page"] },
    ] as const;

    const cards = page.locator("[data-card-root]");
    await expect(cards).toHaveCount(HOMES.reduce((n, h) => n + h.shape.length, 0));

    const placed = await cards.evaluateAll(
      (ns, sels) =>
        ns.map((n) => ({
          variant: n.getAttribute("data-card-variant"),
          home: sels.find((sel) => n.closest(sel) !== null) ?? null,
        })),
      HOMES.map((h) => h.sel),
    );

    expect(
      placed.filter((c) => c.home === null).map((c) => c.variant),
      "a live card is rendering outside the three named homes",
    ).toEqual([]);

    for (const { sel, shape } of HOMES) {
      const got = placed
        .filter((c) => c.home === sel)
        .map((c) => c.variant)
        .sort();
      expect(got, `${sel} does not hold exactly ${shape.join(" + ")}`).toEqual([...shape].sort());
    }

    // ...and the hero holds none of them: it is type on a ruled sheet with no object in it.
    await expect(page.locator('[data-section="hero"] [data-card-root]')).toHaveCount(0);
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

    /* `problem` is the first pass and sits inside the first viewport at every project width. */
    expect(await stateOf("problem"), "the first pass was armed above the fold").toBeNull();

    const far = page.locator('[data-section="start"] [data-pass]');
    expect(await stateOf("start"), "a pass below the fold was not armed").toBe("armed");

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
test.describe("the bento", () => {
  const CELLS = ["profile", "studio", "scan", "reach"] as const;

  test("renders four cells, in ordinal order, and no two are the same kind", async ({ page }) => {
    await gotoMarketing(page);
    const grid = section(page, "how-it-works").locator("[data-bento]");
    await expect(grid).toHaveCount(1);

    const cells = page.locator("[data-bento-cell]");
    await expect(cells).toHaveCount(CELLS.length);
    expect(
      await cells.evaluateAll((ns) => ns.map((n) => n.getAttribute("data-bento-cell"))),
    ).toEqual([...CELLS]);

    /* ⚠ The ordinals must read in sequence in the DOM, not merely be present. An earlier
       arrangement mirrored the second row and printed 01 · 02 then 04 · 03, which is a numbered
       sequence a reader scans backwards — and no assertion on the grid's geometry would have
       said so. */
    const ordinals = await cells.evaluateAll((ns) =>
      ns.map((n) => (n.textContent ?? "").trim().slice(0, 2)),
    );
    expect(ordinals).toEqual(["01", "02", "03", "04"]);

    /* A bento is cells that differ in KIND as well as in size. Four cells on one ground, with
       one shape of content each, is the grid this section replaced. */
    const tones = await cells.evaluateAll((ns) => ns.map((n) => n.getAttribute("data-tone")));
    expect(new Set(tones).size, "every cell is on the same ground").toBeGreaterThanOrEqual(3);
  });

  /**
   * ⚠ Rule 1 of `mk-motion.tsx`: the final state is the default.
   *
   * `gotoReady` injects a stylesheet that zeroes every duration, which is the condition a
   * crawler, a reader whose script failed and every screenshot in this suite are all in. A cell
   * that is invisible until something animates fails all three, and the failure is silent in a
   * browser with working JavaScript — which is the only browser anybody reviews in.
   */
  test("every cell is painted, in position, at rest with durations zeroed", async ({ page }) => {
    await gotoMarketing(page);
    for (const id of CELLS) {
      const cell = page.locator(`[data-bento-cell="${id}"]`);
      await expect(cell).toBeVisible();
      const state = await cell.evaluate((n) => {
        const c = getComputedStyle(n);
        const r = n.getBoundingClientRect();
        return { opacity: Number.parseFloat(c.opacity), w: r.width, h: r.height, shadow: c.boxShadow };
      });
      expect(state.opacity, `${id} is not fully painted`).toBe(1);
      expect(state.w, `${id} has no width`).toBeGreaterThan(100);
      expect(state.h, `${id} has no height`).toBeGreaterThan(100);
      /* DESIGN.md: the pass is the only object in the deck with depth. A cell is a mount — a
         ground, a radius and a hairline — and a shadow inside a shadow is what makes a nested
         card read as a mistake. */
      expect(state.shadow, `${id} draws its own shadow inside the pass`).toBe("none");
    }
  });

  /**
   * The reflow. A bento that only works at 1440 is a desktop mockup, not a layout.
   */
  test("stacks to one column on a phone and pinwheels at the desktop step", async ({
    page,
  }, testInfo) => {
    await gotoMarketing(page);
    const viewport = PROJECT_VIEWPORT[testInfo.project.name];
    const boxes: Record<string, { x: number; y: number; w: number }> = {};
    for (const id of CELLS) {
      const b = await boxOf(page.locator(`[data-bento-cell="${id}"]`));
      boxes[id] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width) };
    }

    if (viewport === 1440) {
      /* Row one: the narrow cell left, the wide one right. Row two mirrors it — see the ⚠ in
         `step-list.tsx` for why the mirror must not invert the reading order. */
      expect(boxes.profile.y).toBe(boxes.studio.y);
      expect(boxes.scan.y).toBe(boxes.reach.y);
      expect(boxes.scan.y).toBeGreaterThan(boxes.profile.y);
      expect(boxes.studio.w, "the studio must be the wide cell of row one").toBeGreaterThan(
        boxes.profile.w,
      );
      expect(boxes.scan.w, "the scan cell must be the wide cell of row two").toBeGreaterThan(
        boxes.reach.w,
      );
      expect(boxes.profile.x, "the narrow cell must change sides between rows").toBeLessThan(
        boxes.reach.x,
      );
    } else {
      /* One column below `lg`, all four the same width and strictly in reading order. A cell
         that keeps a desktop span on a phone is the "bento that only works at 1440". */
      const widths = new Set(CELLS.map((id) => boxes[id].w));
      expect(widths.size, "cells are not all full width below lg").toBe(1);
      for (let i = 1; i < CELLS.length; i += 1) {
        expect(boxes[CELLS[i]].y).toBeGreaterThan(boxes[CELLS[i - 1]].y);
      }
    }
  });

  /**
   * The studio, and the reason it is worth the client bundle it costs.
   */
  test("recolours two live product objects when a ground is pressed", async ({ page }) => {
    await gotoMarketing(page);
    const studio = page.locator('[data-bento-cell="studio"]');

    // The nine card grounds, as controls rather than as a strip of rectangles.
    const swatches = studio.locator("[data-palette-swatch]");
    await expect(swatches).toHaveCount(9);

    const paletteOf = () =>
      studio.locator("[data-card-root]").evaluateAll((ns) =>
        ns.map((n) => n.getAttribute("data-palette-id")),
      );

    // Both objects start on one palette — one `ResolvedCard`, two renderers.
    const before = await paletteOf();
    expect(before).toHaveLength(2);
    expect(new Set(before).size, "the pass and the page disagree about the card's colour").toBe(1);

    const pressed = studio.locator('[data-palette-swatch="oxblood"]');
    await expect(pressed).toHaveAttribute("aria-pressed", "false");
    await pressed.click();
    await expect(pressed).toHaveAttribute("aria-pressed", "true");

    const after = await paletteOf();
    expect(after, "pressing a ground did not repaint both objects").toEqual([
      "oxblood",
      "oxblood",
    ]);

    /* The ground each swatch paints is the card system's own gradient, not a hex typed into a
       marketing component — the mechanism by which the two colour systems drifted apart the
       last time this layer invented a colour. */
    const painted = await swatches.first().evaluate((n) => getComputedStyle(n).backgroundImage);
    expect(painted).toContain("gradient");
  });

  /**
   * ⚠ THE TWO QR MODES ARE DOING TWO DIFFERENT JOBS AND THE DIVISION IS A SAFETY RULE.
   *
   * The scan cell's symbol is `mode="full"` at the card's own 336px width, so `qrSizePx`
   * resolves above `MIN_QR_SIZE_PX` and it genuinely decodes. The wallet pass in the studio is
   * `mode="thumb"`: it is scaled to 216px, which puts its symbol under the decode floor, so it
   * encodes a fixed dummy instead. A scaled symbol carrying a real card URL is a QR that looks
   * scannable and is not — printed on the page whose entire argument is that it tells the truth
   * about what software can do.
   */
  test("the scannable symbol is real and the scaled one is not", async ({ page }) => {
    await gotoMarketing(page);

    const real = page.locator('[data-bento-cell="scan"] [data-qr-zone]');
    await expect(real).toHaveCount(1);
    await expect(real).toHaveAttribute("data-qr-mode", "full");
    expect(await real.getAttribute("data-qr-preview"), "the page's one real QR is a preview").toBeNull();

    /**
     * ⚠ **MEASURE THE SYMBOL AT REST. THE 140px FLOOR IS A PROPERTY OF A RESTING SYMBOL.**
     *
     * This measured on load and started failing at all three viewports when the deck gained its
     * `deal` move: the exhibit renders 141px — one pixel of headroom over `MIN_QR_SIZE_PX` — and
     * an armed pass is scaled to 0.972, so `getBoundingClientRect` returned 137.1 for a symbol
     * that is 141 the moment it stops.
     *
     * The right resolution is the measurement, not the product. A symbol that is sliding up the
     * screen cannot be scanned at any size, so a floor enforced against a mid-animation frame is
     * measuring a state in which the number means nothing. What the floor protects is the symbol
     * somebody actually points a phone at, which is the settled one.
     *
     * ⚠ It is still worth knowing that the headroom is ONE PIXEL. Any future transform on an
     * ancestor — a scale, a zoom, a `deal` tuned deeper than 0.972 — spends more than exists.
     * `qr-geometry.ts` names raising `MIN_QR_SIZE_PX` as the sanctioned fix if a decode ever goes
     * marginal; raising the exhibit's own `cardWidth` is the other end of the same lever.
     */
    await real.scrollIntoViewIfNeeded();
    await expect
      .poll(
        async () =>
          real.evaluate((n) => n.closest("[data-pass]")?.getAttribute("data-mk-reveal") ?? "none"),
        { timeout: 4000 },
      )
      .not.toBe("armed");

    const side = await real.locator("[data-qr-symbol]").evaluate((n) => n.getBoundingClientRect().width);
    expect(side, "below the 140px scannable floor at this viewport").toBeGreaterThanOrEqual(140);

    const scaled = page.locator('[data-bento-cell="studio"] [data-qr-zone]');
    await expect(scaled).toHaveCount(1);
    await expect(scaled).toHaveAttribute("data-qr-preview", "true");
    expect(
      await scaled.evaluate((n) => n.outerHTML),
      "a scaled, undecodable symbol must not carry a real card URL",
    ).not.toContain("/c/");
  });

  /**
   * ⚠ THE MASKED VALUE MUST NOT REACH THE DOM — not as text, not in an attribute.
   *
   * `PRODUCT.md` states it as an absolute, and the profile cell is the only place on a public
   * marketing page where a masked field is rendered at all. The rule is enforced by the product's
   * own field registry, which replaces `display`, `title` and `href` together; this asserts the
   * outcome against the raw fixture strings so a future hand cannot "improve" the cell by
   * rendering `field.value` and masking it in CSS.
   */
  test("renders real profile rows, and no masked value survives into the markup", async ({
    page,
  }) => {
    await gotoMarketing(page);
    const rows = page.locator("[data-profile-row]");
    await expect(rows).toHaveCount(7);

    const masked = page.locator("[data-profile-row][data-masked]");
    await expect(masked).toHaveCount(2);

    const html = await page.content();
    for (const secret of ["+912261234567", "50100412345678", "HDFC0000123"]) {
      expect(html, `a masked value reached the DOM: ${secret}`).not.toContain(secret);
    }

    /* And the marker is a drawn padlock AND the word, never one of the two: status is never
       carried by an icon or a colour alone.

       ⚠ Scoped to `[data-private-mark]` rather than to `svg`. Every row already carries the
       field registry's own type icon, so a bare `svg` locator matches two elements on a masked
       row and one on an unmasked one — which would pass for the wrong reason the day the
       padlock was deleted and the type icon was all that was left. */
    for (let i = 0; i < 2; i += 1) {
      await expect(masked.nth(i).locator("[data-private-mark]")).toHaveCount(1);
      expect((await masked.nth(i).innerText()).toLowerCase()).toContain("private");
    }
    // The mark belongs to masked rows only — a padlock on a shareable field is a lie.
    await expect(page.locator("[data-profile-row]:not([data-masked]) [data-private-mark]")).toHaveCount(0);
  });

});
