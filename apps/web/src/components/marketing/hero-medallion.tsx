/**
 * The round badge on the hero card's wave — the ContactBook "CB" monogram as the client's
 * reference draws it.
 *
 * ## ⚠ THIS IS THE REFERENCE'S DRAWING OF THE MARK, NOT THE DECK'S LOCKUP
 * The brand file (`public/brand/contactbook-mark.png`, from the About Us deck) is a heavy
 * geometric C beside a B that has no body — only a soft shadow. The reference re-draws that
 * same idea as an engraved monogram: a high-contrast Didone C whose top arm runs into the B's
 * top bar, an outlined B on a lighter cream face, and the B's stem shown only as an engraved
 * line (1px shade, 1px highlight). The client asked for exactly this badge, so it was traced
 * off the reference (Bézier paths, 9.4/255 mean luma error against an 8.8 noise floor) rather
 * than approximated with the deck's letterforms, which read heavy and blocky at 40px.
 *
 * `viewBox` is the disc's bounding square, so the mark sits on the disc with no offset. The ink
 * is 72% of the disc and sits 1u left and 1.2u below centre — the reference's own optical
 * placement, kept deliberately.
 *
 * Decorative (the card is `inert` and captioned); all colour is in `marketing-hero.css`.
 */
export function HeroMedallion({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="mk-hc-medallion-disc" gradientUnits="userSpaceOnUse" cx="50" cy="28" r="75">
          <stop className="mk-hc-medallion__stop-0" offset="0" />
          <stop className="mk-hc-medallion__stop-1" offset="0.37" />
          <stop className="mk-hc-medallion__stop-2" offset="0.73" />
          <stop className="mk-hc-medallion__stop-3" offset="0.96" />
          <stop className="mk-hc-medallion__stop-4" offset="1" />
        </radialGradient>
      </defs>
      <circle className="mk-hc-medallion__disc" cx="50" cy="50" r="50" />
      {/* The B's face — lighter than the disc, not the disc showing through. */}
      <path
        className="mk-hc-medallion__face"
        d="M40 17.5L63.8 19L64.6 20.45C68.22 22.98 72.82 26.2 72.82 31.38C72.82 43.09 64.22 46.98 56 46.98L56 49.3C67.6 49.3 76.03 53.61 76.03 66.31C76.03 69.37 76.04 83.1 56 83.1L40 83.1L40 17.5Z"
      />
      {/* The engraved stem: one shade and one highlight, pixel-snapped at 40px. */}
      <path className="mk-hc-medallion__shade" d="M40 18.6H42.5V74.8H40Z" />
      <path className="mk-hc-medallion__highlight" d="M45 18.6H47.5V74.8H45Z" />
      <path
        className="mk-hc-medallion__ink"
        d="M57 15.42L64.6 17.6L64.6 22.8C64.6 23.3 64.1 23.6 63.4 23.6C60.5 23.6 57.5 19.88 54.5 19.7C52 19.55 49 18.88 46 18.88C27.06 18.88 20.94 32.22 20.94 48.8C20.94 54.38 23.37 74 45 74C47.52 74 57.58 73.6 65.6 67.6C58.19 77.73 47.26 76.05 40 76.05C24.58 76.05 12.88 63.080 12.88 49.55C12.88 29.74 25.66 15.42 46 15.42L57 15.42ZM44 15.42L58 15.42C72.57 15.42 80.61 23.91 80.61 34.15C80.61 40.89 76.13 42.59 71.19 47.53C77.28 52.4 84.9 54.12 84.9 67.27C84.9 82.34 70.81 86.9 56.85 86.9L38.9 86.9L38.9 75.2L42.5 75.2L42.5 83.1L56 83.1C76.04 83.1 76.03 69.37 76.03 66.31C76.03 53.61 67.6 49.3 56 49.3L53.2 49.55C51.3 49.6 49.04 49.04 49.04 48.14C49.04 47.24 51.3 46.68 53.2 46.73L56 46.98C64.22 46.98 72.82 43.09 72.82 31.38C72.82 26.2 68.22 22.98 64.6 20.45L63.8 20.3L44 18.7L44 15.42Z"
      />
    </svg>
  );
}
