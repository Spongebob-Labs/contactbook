/**
 * The round badge on the hero card's wave — a cream disc carrying the ContactBook mark.
 *
 * ## ⚠ 2026-10-06 — THE BRAND MARK, NOT A TRACED MONOGRAM
 * Until today the disc carried an engraved "CB" monogram traced off the client's reference
 * render. The client called that the wrong logo and asked for the real one — the gold C with
 * the two dots (the B has no body, only a shadow) that the nav's lockup leads with, which they
 * call the "smiley face". So the mark is now the brand file itself, `contactbook-mark.png`: the
 * mark-only cut of the same un-matted gold/brown artwork the nav and the app chrome use
 * (`components/layout/brand-logo.tsx`). It is placed, never redrawn or recoloured here.
 *
 * ## Placement
 * `viewBox` is the disc's bounding square (100u). The PNG is 154px square, but its visible ink
 * (alpha > 50%) spans only x 0–116, y 11–135 — the right of the file is the B's soft shadow. So
 * the image is positioned by its INK box, not its file box: the ink is 56u tall (56% of the
 * disc, leaving ~22u of cream on every side) and its centre sits on the disc's centre. The
 * numbers below are that arithmetic: size = 56 × 154 / 124, origin = 50 − ink centre × scale.
 *
 * An SVG `<image>` rather than an HTML `<img>` so the mark stays inside the disc's own
 * coordinate space and the CSS that places `.mk-hc__medallion` is unchanged. Decorative (the
 * card is `inert` and captioned); the disc's colours are in `marketing-hero.css`.
 */
const MARK = {
  href: "/brand/contactbook-mark.png",
  size: 69.55,
  x: 23.81,
  y: 17.03,
} as const;

/* `idPrefix` keeps the gradient's id unique when several brand cards share a page; the hero's is
   the default, so its markup is unchanged. */
export function HeroMedallion({
  className,
  idPrefix = "mk-hc",
}: {
  className?: string;
  idPrefix?: string;
}) {
  const discId = `${idPrefix}-medallion-disc`;
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={discId} gradientUnits="userSpaceOnUse" cx="50" cy="28" r="75">
          <stop className="mk-hc-medallion__stop-0" offset="0" />
          <stop className="mk-hc-medallion__stop-1" offset="0.37" />
          <stop className="mk-hc-medallion__stop-2" offset="0.73" />
          <stop className="mk-hc-medallion__stop-3" offset="0.96" />
          <stop className="mk-hc-medallion__stop-4" offset="1" />
        </radialGradient>
      </defs>
      <circle className="mk-hc-medallion__disc" cx="50" cy="50" r="50" fill={`url(#${discId})`} />
      <image
        className="mk-hc-medallion__mark"
        href={MARK.href}
        x={MARK.x}
        y={MARK.y}
        width={MARK.size}
        height={MARK.size}
      />
    </svg>
  );
}
