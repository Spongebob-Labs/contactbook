import type { ReactNode } from "react";

/**
 * The hero's phone — a CSS-drawn iPhone around whatever it is handed, at every viewport.
 *
 * ## ⚠ REBUILT 2026-09-29 — MEASURED OFF THE CLIENT'S REFERENCE, NOT DRAWN FROM MEMORY
 *
 * The client's verdict on the previous device: not refined, not the reference. That device was
 * a Dynamic Island phone with a 3px single-gradient rail, three keys and a status bar reduced to
 * the time and a battery. The reference is a different phone, and every number in
 * `marketing-hero.css` is now read off it (edge profiles and fitted curves, not eyeballing):
 *
 *   1. **A notch, not an island.** 156×27 with 13px bottom corners and concave 3.5px "ears"
 *      where it meets the glass, a speaker slit and a camera. It is one SVG path, so its ears
 *      stay exact at every zoom.
 *   2. **A three-ring rail.** Dark hairline, graphite step, then a polished band brightest at
 *      the lower left — one box whose background is the band and whose two thin rings are
 *      inset shadows, which stay concentric round a 61px corner and are not snapped to device
 *      pixels. Six antenna breaks cut the band.
 *   3. **Four keys, not three.** Action, volume up and volume down on the left; power on the
 *      right. Graphite with dark ends, painted UNDER the silhouette so only their proud 2px
 *      show.
 *   4. **The full status bar is back — as vector paths.** The signal bars and Wi-Fi fan were
 *      removed on 2026-09-21 because they were drawn as 2px CSS boxes and smeared under
 *      `zoom`. That was the right call for boxes; these are single filled paths fitted to the
 *      reference's iOS glyphs, which resolve at any zoom.
 *   5. **No veil, no home indicator.** The card now fits the screen exactly (the reference ends
 *      on its social row with 24px of sheet below it), so there is no clip to disguise, and the
 *      reference draws no home indicator.
 *
 * ## Why the card's own box is never touched
 * This component only ever adds PADDING around its child. The one thing that varies the
 * device's rendered size is `--mk-phone-zoom` (set in `hero.tsx`), a real layout-and-rasterise
 * operation — never `transform: scale(...)`, which would resample rasterised text.
 *
 * Every element this file adds is `aria-hidden="true"`: none of it is content. It emits the
 * same markup at every width and the stylesheet alone decides how it looks, so this stays a
 * plain server component.
 */
export interface PhoneFrameProps {
  children: ReactNode;
}

/** The four keys, top to bottom on the left edge, then the one on the right. */
const KEYS = ["action", "volume-up", "volume-down", "power"] as const;

/**
 * Where the rail's antenna breaks sit — on straight runs only, as on the reference. The
 * positions live in the stylesheet; these are just the six hooks.
 */
const ANTENNAS = ["top", "bottom", "left-upper", "left-lower", "right-upper", "right-lower"] as const;

export function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <div className="mk-phone-frame" data-hero-phone-frame="">
      {/* The case's hardware — siblings of the silhouette and painted beneath it, so they can
          never occlude the screen and only their proud edge shows. */}
      {KEYS.map((key) => (
        <span
          key={key}
          className={`mk-phone-frame__button mk-phone-frame__button--${key}`}
          aria-hidden="true"
        />
      ))}

      {/* THE RAIL — the silhouette. Hairline, graphite step and polished band are ONE box: the
          band is its background and the two thin rings are inset shadows, which paint with
          anti-aliased edges instead of being snapped to device pixels (as nested boxes were —
          at 2× the 1px graphite ring vanished top and bottom). */}
      <div className="mk-phone-frame__rail">
        {ANTENNAS.map((at) => (
          <span
            key={at}
            className={`mk-phone-frame__antenna mk-phone-frame__antenna--${at}`}
            aria-hidden="true"
          />
        ))}
        {/* THE BEZEL — the black mask under the glass. */}
        <div className="mk-phone-frame__body">
          {/* THE SCREEN — a fixed window the size of the reference's display. */}
          <div className="mk-phone-frame__screen">
            {children}

            {/* The notch and the status bar sit ON the glass, over the card — a real phone
                draws both over whatever the display shows. */}
            <svg
              className="mk-phone-frame__notch"
              viewBox="0 -1 163 28"
              aria-hidden="true"
              focusable="false"
            >
              <path
                className="mk-phone-frame__notch-body"
                d="M0 -1H163V0A3.5 3.5 0 0 0 159.5 3.5V10A17 17 0 0 1 142.5 27H20.5A17 17 0 0 1 3.5 10V3.5A3.5 3.5 0 0 0 0 0Z"
              />
              <rect className="mk-phone-frame__speaker" x="62" y="8.2" width="39" height="4.4" rx="2.2" />
              <circle className="mk-phone-frame__camera" cx="118.2" cy="10.4" r="3" />
              <circle className="mk-phone-frame__lens" cx="118.2" cy="10.4" r="1.35" />
            </svg>

            <div className="mk-phone-frame__status" aria-hidden="true">
              <span className="mk-phone-frame__time">9:41</span>
              <svg className="mk-phone-frame__signal" viewBox="0 0 24 24" focusable="false">
                <rect x="4.53" y="13.49" width="2.66" height="3.29" rx="0.65" />
                <rect x="8.62" y="11.63" width="2.66" height="5.15" rx="0.65" />
                <rect x="12.71" y="9.52" width="2.66" height="7.26" rx="0.65" />
                <rect x="16.8" y="7.22" width="2.66" height="9.57" rx="0.65" />
              </svg>
              <svg className="mk-phone-frame__wifi" viewBox="0 0 24 24" focusable="false">
                <path d="M12 16.12L10.83 14.89A2.55 2.55 0 0 1 13.17 14.89ZM8.49 12.44A5.88 5.88 0 0 1 15.51 12.44L15.08 12.89A5.25 5.25 0 0 0 8.92 12.89ZM6.16 10A9.23 9.23 0 0 1 17.84 10L17.39 10.47A8.59 8.59 0 0 0 6.61 10.47Z" />
              </svg>
              <svg className="mk-phone-frame__battery" viewBox="0 0 24 24" focusable="false">
                <rect
                  className="mk-phone-frame__battery-case"
                  x="2.11"
                  y="7.35"
                  width="18.16"
                  height="9.3"
                  rx="1.5"
                />
                <rect x="3.37" y="8.61" width="15.64" height="6.78" rx="0.6" />
                <path
                  className="mk-phone-frame__battery-cap"
                  d="M21.5 10.75h.35a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-.75.75h-.35z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
