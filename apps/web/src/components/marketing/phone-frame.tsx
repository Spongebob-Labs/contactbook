import type { CSSProperties, ReactNode } from "react";

/**
 * The hero's phone — a CSS-drawn iPhone around whatever it is handed, at every viewport.
 *
 * ## Why this is its own file rather than a class on `<HeroCard>`'s wrapper
 * This component knows nothing about the card at all — it draws a device around `children` and
 * nothing else. That separation is what let it survive the 2026-09-20 pass that replaced
 * `<HeroCard>`'s whole insides (the wallet pass and its flip came out; `<CardPage>` went in):
 * the brief has always asked for a frame AROUND whatever object the hero shows, not a new
 * object, and this file has never needed to know which object that is.
 *
 * ## ⚠ REBUILT 2026-09-21 — THE FIFTH REVIEW REJECTED IT AS HARDWARE, NOT AS COMPOSITION
 * *"I want exactly this border of the design of the mobile, as you will be seeing this: the
 * design, the side buttons, and the upper bar of this iPhone."* The client attached a
 * photographic product render. Three structural things in it were missing here, and all three
 * are markup changes rather than restyles of what was already in the tree:
 *
 *   1. **A rail and a bezel, not one shell.** A real phone is machined metal with a black mask
 *      under the glass — two materials, and the hairline where the rail catches light is most
 *      of what makes a small picture read as a phone. `.mk-phone-frame` is the rail now and
 *      `.mk-phone-frame__body` (new) is the bezel inside it. `marketing-hero.css` has the
 *      measured thicknesses and why the rail alone carries a gradient.
 *   2. **Keys that protrude.** They were flush slivers at `left: 0` — a pixel of tint on a dark
 *      edge, invisible at any real size. They sit 2px proud of the silhouette now, in the
 *      rail's own metal. The three-key count (volume pair left, power right) is unchanged and
 *      is asserted by `tests/unit/marketing-hero.test.tsx`.
 *   3. **A lens in the island.** One faintly lighter disc at the right end, where the camera
 *      actually is. Without it the island is a plain pill, which is the shape of an older
 *      notch rather than the thing the reference draws.
 *
 * The status bar's glyphs also flipped from white-on-a-dark-scrim to ink-on-a-light-one, to
 * match the reference over a light cover photograph. That one is entirely a stylesheet change —
 * see `.mk-phone-frame__status` for why the scrim was inverted rather than deleted.
 *
 * ## ⚠ 2026-09-21, LATER THE SAME DAY — TWO FIXES, BOTH REPORTED AS GLITCHES
 *
 *   1. **The signal bars and the Wi-Fi fan are gone.** Removed at the client's instruction. They
 *      were four 2px bars and three stacked arcs drawn in CSS boxes, which at the size this
 *      device actually renders (`--mk-phone-zoom` takes it well under 1) resolved as a smear of
 *      grey pixels rather than as glyphs. **The status bar is the time and the battery now.** Do
 *      not put them back: a mockup's status bar is set dressing, and set dressing that does not
 *      resolve is noise. If they are ever wanted again they have to be drawn as vector paths,
 *      not as boxes.
 *   2. **The screen has a FOOT.** `<CardPage>` is taller than a 9/19.5 window and the clip is
 *      deliberate — see `.mk-phone-frame__screen` — but the clip was landing straight through
 *      the middle of the social strip's 36px icon discs, so four half-circles sat pressed
 *      against the bottom bezel. Reported as icons "overlapping with the frame", and that is
 *      exactly what it looked like. `.mk-phone-frame__veil` fades the card out before the bezel
 *      and `.mk-phone-frame__home` draws the home indicator over it, which is what the bottom of
 *      a real screen ends with. Together they turn a severed row into a screen with more page
 *      below it.
 *
 * ⚠ **The veil fades to the CARD's paper, not to white** — `screenTint`, below. The screen's own
 * background is `--mk-white` and the card on it is cream, so a veil that faded to white would
 * itself be a visible pale band across a warm card: the fix would have been the new glitch.
 *
 * ## Why the card's own box is never touched
 * `<CardPage>` is real, fluid typography with no fixed aspect ratio, so a `transform: scale(...)`
 * on any ancestor would resample rasterised text against a width it never laid out at. This
 * component only ever adds PADDING around its child's box; the one thing that varies the
 * device's rendered size is `--mk-phone-zoom`, a real layout-and-rasterise operation that
 * `hero.tsx` sets per breakpoint. `tests/unit/marketing-hero.test.tsx` asserts the literal
 * absence of `scale(` in this file and in the stylesheet.
 *
 * Every element this file adds is `aria-hidden="true"`: none of it is content, all of it is the
 * same decorative case chrome the bezel already was, and `<CardPage>`'s own actionable rows stay
 * reachable-or-not through `inert` exactly as `hero-card.tsx` documents — nothing focusable is
 * added in front of them.
 *
 * ## Why the chrome is a CSS rule, not two render paths
 * This component always emits the same markup and `marketing-hero.css` alone decides how it
 * looks, at every width. There is no viewport-conditional rendering to keep in sync with a
 * stylesheet, which is what lets this stay a plain server component with no client boundary.
 */
export interface PhoneFrameProps {
  children: ReactNode;
  /**
   * The colour the screen's bottom veil fades to — the paper of whatever is on the glass.
   *
   * ⚠ A prop rather than something this file derives, because this component has never known
   * what it is framing and should not start: the caller holds the resolved card and therefore
   * its palette's sheet. Defaults, through the stylesheet, to `--mk-white` — correct for a
   * child with no paper of its own, and wrong for a card, which is why `hero-card.tsx` passes
   * it. See the ⚠ in the module note.
   */
  screenTint?: string;
}

export function PhoneFrame({ children, screenTint }: PhoneFrameProps) {
  return (
    <div
      className="mk-phone-frame"
      data-hero-phone-frame=""
      style={
        screenTint === undefined
          ? undefined
          : ({ "--mk-phone-screen-tint": screenTint } as CSSProperties)
      }
    >
      {/* The case's own hardware — siblings of the bezel, never in front of the screen, so they
          can never occlude `children`. Volume up and down on the left edge, power opposite the
          gap between them on the right (`marketing-hero.css` for the positions). */}
      <span className="mk-phone-frame__button mk-phone-frame__button--volume-1" aria-hidden="true" />
      <span className="mk-phone-frame__button mk-phone-frame__button--volume-2" aria-hidden="true" />
      <span className="mk-phone-frame__button mk-phone-frame__button--power" aria-hidden="true" />

      {/* THE BEZEL. The black mask between the rail and the glass — the layer that was missing
          when the client said this did not read as an iPhone. It exists only to be a second,
          darker material; it holds no content of its own. */}
      <div className="mk-phone-frame__body">
        {/*
          THE SCREEN. A real phone's display is a FIXED window and its content scrolls behind
          it; this element is that window, and without it the "phone" was simply as tall as
          whatever it held — 1063px, once, when the fixture was enriched to look like a real
          card. `marketing-hero.css` carries the aspect ratio and the clip, and the reason the
          clip is the honest treatment: the reference shows a card continuing past the bottom
          edge, not a frame stretched to contain it.
        */}
        <div className="mk-phone-frame__screen">
          {/* The status bar and the island sit ON the glass, over the card's own surface — a
              real phone draws both as part of the display, not as part of the case. */}
          <div className="mk-phone-frame__status" aria-hidden="true">
            <span className="mk-phone-frame__time">9:41</span>
            {/* ⚠ The battery and nothing else. The signal bars and the Wi-Fi fan were removed
                at the client's instruction — see the module note for why they must not be
                reinstated as CSS boxes. */}
            <span className="mk-phone-frame__glyphs">
              <span className="mk-phone-frame__battery">
                <span className="mk-phone-frame__battery-cell">
                  <span className="mk-phone-frame__battery-fill" />
                </span>
                <span className="mk-phone-frame__battery-cap" />
              </span>
            </span>
          </div>
          <span className="mk-phone-frame__island" aria-hidden="true">
            <span className="mk-phone-frame__island-lens" />
          </span>
          {children}

          {/* THE FOOT. Both sit ON the glass, after the content, so they are over whatever the
              screen is showing — and both are decorative chrome like everything else here. */}
          <span className="mk-phone-frame__veil" aria-hidden="true" />
          <span className="mk-phone-frame__home" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
