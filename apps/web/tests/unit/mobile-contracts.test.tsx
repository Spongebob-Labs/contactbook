import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buttonClassName } from "@/components/primitives/button";
import { chipClassName } from "@/components/primitives/chip";
import { CONTROL_HEIGHT } from "@/components/primitives/label";
import { TOUCH_HIT_44, TOUCH_HIT_44_Y } from "@/components/primitives/touch-target";
import { viewport } from "@/app/layout";

/**
 * The mobile contracts — the handful of rules that make this product usable on a phone, pinned
 * so that a later change has to disagree with them **out loud**.
 *
 * ## Why these are asserted as class strings and CSS text rather than as measured pixels
 *
 * Every rule here is a *responsive* one: it applies below a breakpoint and not above it. happy-dom
 * has no layout engine and no media-query evaluation, so a rendered width is meaningless here —
 * the real geometry is measured in a browser by `tests/e2e/**`, which runs at 360, 768 and 1440.
 *
 * What a unit test *can* hold is the thing that actually regressed: somebody edits a class string
 * and the responsive half of it disappears. Each assertion below is paired with the number it
 * defends and the defect it was written against, so a future reader can tell an intentional
 * change from an accidental one.
 */

const webSrc = (rel: string) => readFileSync(resolve(__dirname, "../../src", rel), "utf8");

/**
 * The same file with its comments stripped.
 *
 * ⚠ Several assertions below are "this string must NOT appear", and this codebase documents its
 * own defects at length — `builder-preview.tsx` explains the `58svh` / `50svh` mismatch in prose,
 * and `app-shell.tsx` writes `env(safe-area-inset-bottom)` in a sentence about it. Scanning raw
 * source makes those tests fail on the *account* of the bug rather than on the bug, which would
 * teach the next reader to delete the explanation.
 */
const webCode = (rel: string) =>
  webSrc(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("the viewport export (safe-area insets)", () => {
  /**
   * ⚠ Without `viewportFit: "cover"` **every `env(safe-area-inset-*)` in the app computes 0px.**
   *
   * Next injects `width=device-width, initial-scale=1` and nothing else when a route exports no
   * `viewport`, so `viewport-fit` defaults to `auto`; under `auto` iOS Safari lays the document
   * out inside the safe area itself and the insets are all zero. Five places in this codebase
   * reason carefully about the home indicator — the bottom bar's height and padding, the content
   * column's bottom padding, both sheets, and the toast stack — and every one of them was
   * arithmetic against zero. They were not wrong; they were inert.
   */
  it("opts into the full viewport so the safe-area insets resolve", () => {
    expect(viewport.viewportFit).toBe("cover");
    expect(viewport.width).toBe("device-width");
    expect(viewport.initialScale).toBe(1);
  });

  /**
   * ⚠ Capping zoom is the usual companion to a `viewport` tag and it is an accessibility
   * failure — WCAG 1.4.4 requires 200% zoom. The fix for "iOS zooms when I focus a field" is a
   * 16px control font (below), never a pinch-zoom ban.
   */
  it("never caps zoom", () => {
    expect(viewport.maximumScale).toBeUndefined();
    expect(viewport.userScalable).toBeUndefined();
  });

  /**
   * ⚠ An `env()` with **no fallback is invalid at parse time** on an engine without support, and
   * an invalid value takes its whole declaration with it. Without `, 0px` the bottom bar's
   * `height` declaration is dropped entirely and a 64px bar collapses to `auto`.
   */
  it("gives every env() call a fallback", () => {
    const files = [
      "components/layout/app-shell.tsx",
      "components/layout/bottom-bar.tsx",
      "components/overlay/sheet.tsx",
      "components/overlay/toast.tsx",
    ];
    for (const file of files) {
      const source = webCode(file);
      const calls = source.match(/env\(safe-area-inset-[a-z]+[^)]*\)/g) ?? [];
      expect(calls.length, `${file} should still use env()`).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call, `${file}: ${call} has no fallback`).toMatch(/,\s*0px\)$/);
      }
    }
  });
});

describe("iOS focus zoom", () => {
  /**
   * ⚠ **The rule that stops the whole page zooming on every field tap.**
   *
   * Mobile Safari zooms the layout viewport whenever a focused input computes below 16px, and it
   * does not zoom back out on blur — the reader has to pinch, every time. `--text-base` is 15px
   * and the shared control skin uses it, so *every* text field in the product was under the line;
   * the builder's inline field-value input was `text-sm`, i.e. 13px, for a 1.23x jump.
   */
  it("floors every text control at 16px below md", () => {
    const css = webSrc("styles/globals.css");
    expect(css).toContain("@media (max-width: 767px)");
    const block = css.slice(css.indexOf("@media (max-width: 767px)"));
    expect(block).toMatch(/input:not\(\[type="checkbox"\]\)/);
    expect(block).toMatch(/textarea/);
    expect(block).toMatch(/select/);
    expect(block).toMatch(/font-size:\s*1rem/);
  });

  /**
   * The two controls that are deliberately ABOVE 16px — the OTP boxes at 17px and the builder's
   * card-name title at 20px — are excluded by selector. A blanket 16px would make them *smaller*,
   * which is the opposite of what a floor means.
   */
  it("excludes the two controls that are already larger", () => {
    const css = webSrc("styles/globals.css");
    expect(css).toContain(':not([data-otp-box])');
    expect(css).toContain(':not([data-builder-name])');
  });
});

describe("touch targets", () => {
  /**
   * §8D.7's 40px is a mouse number and right for a mouse. A fingertip needs 44 — Apple's HIG,
   * Material and WCAG 2.5.5 agree independently — and `md` is the size of every primary control
   * in the product.
   */
  it("gives the md button 44px below md and keeps 40px above it", () => {
    expect(buttonClassName()).toContain("h-10");
    expect(buttonClassName()).toContain("max-md:h-11");
    expect(buttonClassName({ iconOnly: true })).toContain("max-md:w-11");
  });

  /**
   * ⚠ `text-link` is type rather than a slab, so it cannot simply be made 44px tall — it would
   * stop reading as a link inside a sentence. `py-3` with a cancelling `-my-2` grows the hit box
   * and returns the same 8px a side to the flow, so every row keeps its height.
   *
   * It matters because this variant is the *only* affordance for Copy link, Revoke, Restore,
   * Undo in a six-second toast, and the profile's only add-group control.
   */
  it("gives text-link a 44px hit box that costs no layout", () => {
    const cls = buttonClassName({ variant: "text-link" });
    expect(cls).toContain("max-md:py-3");
    expect(cls).toContain("max-md:-my-2");
  });

  /** A chip is a small pill by design; the target grows around it, not the pill itself. */
  it("gives an interactive chip a hit region without resizing the pill", () => {
    const interactive = chipClassName({ interactive: true });
    expect(interactive).toContain("h-8");
    expect(interactive).toMatch(/max-md:before:/);
    expect(interactive).toContain("before:content-['']");

    // A decorative chip is a label, not a control — it must NOT grow an invisible box that
    // swallows taps meant for whatever sits beside it.
    expect(chipClassName()).not.toMatch(/max-md:before:/);
  });

  /** Every boxed form control resolves to one height, so a Select never sits 4px under an Input. */
  it("shares one 44/40 height across Input, Select and the addon shell", () => {
    expect(CONTROL_HEIGHT).toBe("h-10 max-md:h-11");
    for (const file of ["components/primitives/input.tsx", "components/primitives/select.tsx"]) {
      expect(webSrc(file), file).toContain("CONTROL_HEIGHT");
    }
  });

  /**
   * The hit-slop constants. All three parts are load-bearing: `relative` is the containing block,
   * `content-['']` is what generates the box at all, and `max-md:` keeps a 44px invisible region
   * off a pointer, where it would swallow clicks aimed 12px away.
   */
  it("scopes the shared hit slop to touch and generates a real box", () => {
    for (const hit of [TOUCH_HIT_44, TOUCH_HIT_44_Y]) {
      expect(hit).toContain("relative");
      expect(hit).toContain("before:content-['']");
      expect(hit).toMatch(/max-md:before:absolute/);
    }
    // The switch track is already 44 wide and only 24 tall, so its region grows on one axis and
    // must not spill sideways into whatever it is ranged against.
    expect(TOUCH_HIT_44_Y).toContain("before:inset-x-0");
  });
});

describe("the builder's pinned preview", () => {
  /**
   * ⚠ **One number, in one place.** It used to be two, in two files, and they disagreed:
   * `split-view.tsx` capped the pinned pane at `50svh` with `overflow: hidden` while
   * `builder-preview.tsx` gave its stage `58svh`. A taller child inside a shorter clipping parent
   * loses the difference silently — measured on a 375x812 phone, **65px of the live preview was
   * cut off**, taking the bottom of the card frame and the entire "name · palette" caption with
   * it. The caption was not truncated; it rendered 195px below the visible edge of its container.
   */
  it("takes its height from one token and never restates it", () => {
    expect(webSrc("styles/tokens.css")).toMatch(/--builder-preview-h:\s*min\(38svh,\s*300px\)/);

    const client = webSrc("components/builder/builder-client.tsx");
    expect(client).toContain("h-[var(--builder-preview-h)]");
    expect(client).toContain("max-h-[var(--builder-preview-h)]");

    // The stage fills the pane rather than declaring a second height. `h-[58svh]` here is the
    // exact bug above; it must never come back.
    //
    // Comments stripped — see `webCode`. This file discusses the two heights it used to have.
    const preview = webCode("components/builder/builder-preview.tsx");
    expect(preview).toContain("flex h-full flex-col");
    expect(preview).not.toMatch(/h-\[\d+svh\]/);

    // The bones reserve the same box, or the control column jumps on load (§8D.1, AC-17).
    expect(webSrc("components/builder/builder-skeleton.tsx")).toContain(
      "h-[var(--builder-preview-h)]",
    );
  });
});

describe("the rigid share face on a narrow phone", () => {
  /**
   * ⚠ `<ShareFace mode="full">` is 336px and cannot be narrowed — its QR clears the 140px
   * scannable floor by a single pixel. The shell's `px-3` leaves `viewport - 24`, so 360px fits
   * exactly and **320px is 40px short**. Nothing clipped between the face and the document, so
   * that overflow scrolled the whole page sideways on an iPhone SE, a Fold cover screen and any
   * Android in split-screen (E-15 / E-53, both P0).
   *
   * The rail wraps the FACE, not the block: wrapped around the whole column it took the
   * wallet-pass prose with it, so the copy was 336px wide in a 296px box and had to be nudged
   * sideways to read — a worse defect than the one being fixed.
   */
  it("scopes the overflow to a rail around the card alone", () => {
    const block = webSrc("components/share/wallet-pass-block.tsx");
    expect(block).toContain("data-wallet-pass-rail");
    expect(block).toContain("overflow-x-auto");
    expect(block).toContain("overscroll-x-contain");

    // The column itself stays fluid, so the prose and the controls wrap normally.
    expect(block).toContain('maxWidth: "100%"');
  });
});

describe("information that hover alone used to carry", () => {
  /**
   * ⚠ The activity chart prints no number per column by design, so its values lived exclusively
   * in a tooltip opened by `onMouseEnter`. Touch never fires it — twelve weeks of data were not
   * degraded on a phone, they were **absent**. A real `<button>` per column carries the value in
   * `aria-label`, opens on tap, and opens on keyboard focus, which hover never did either.
   */
  it("makes every chart column tappable, focusable and named", () => {
    const chart = webSrc("components/dashboard/activity-chart.tsx");
    expect(chart).toContain("onPointerDown");
    expect(chart).toContain("onFocus");
    expect(chart).toMatch(/aria-label=\{`\$\{week\.count\} shared/);
    // A toggle, not a set: with no "leave" on touch, a tapped column has to be dismissable.
    expect(chart).toContain("current === i ? null : i");
  });

  /**
   * A clamped card name's full text lives only in `title`, and a `title` tooltip never opens on
   * touch — so a 40-character name was unrecoverable there.
   */
  it("gives a clamped card name a second line on touch", () => {
    const tile = webSrc("components/app/card-thumb-tile.tsx");
    expect(tile).toContain("line-clamp-2");
    expect(tile).toContain("lg:line-clamp-1");
  });
});

describe("long user strings", () => {
  /**
   * `[data-field-value]` already had `overflow-wrap: anywhere`. These four carry owner- or
   * contact-authored text with no break opportunity and sat outside that hook — a 45-character
   * work email measures ~337px in a 296px box and scrolled the document by 41px.
   *
   * They are listed rather than folded into a blanket rule because breaking mid-word is a
   * concession, correct only where the alternative is a horizontal scrollbar. Prose must keep
   * breaking on spaces.
   */
  it("lets the four unbreakable strings break", () => {
    const css = webSrc("styles/globals.css");
    for (const hook of [
      "[data-identity-email]",
      "[data-contact-name]",
      "[data-contact-notes]",
      "[data-error-digest]",
    ]) {
      expect(css, hook).toContain(hook);
    }
  });
});
