import { MAYA_CITIES } from "@/fixtures/marketing-identity";

import { MkReveal } from "./mk-reveal";
import { WorldGlobe } from "./world-globe";

/**
 * The world-map band in how-it-works — Maya's four cities on one dotted globe.
 *
 * The client, 2026-09-28: *"replace Indian numbers with London, Dubai, New York, Singapore
 * addresses and numbers. Consider adding a global map element to reinforce international
 * feel."* The numbers are already in step 01's profile; this band is where the four cities
 * become a place rather than a list.
 *
 * ## Why a band under the three frames, and not behind step 03
 * The three frames are identical on purpose (`how-it-works.tsx`: "three unlike things in
 * identical columns never read as one row"), and a map behind one of them would make that one
 * a different kind of object again. As its own band it follows the same grammar as the frames
 * (the white panel, the hairline, the uppercase label) and says one thing: the profile in
 * frame 01 spans four cities.
 *
 * ## How it is built
 * ⚠ 2026-09-29: A GLOBE NOW, NOT A FLAT MAP. Vansh asked for it to turn on its own and light each
 * city as it comes round. This file stays a server component with the same props, so
 * `how-it-works.tsx` did not change; the picture is `world-globe.tsx`, a small client island
 * that server-renders a composed still (all four cities on the near side) and hands it to a
 * canvas once scripts run. The flat map's dots could not be reused — they are Mercator and
 * cropped, so a sphere built from them has no Pacific and a hard edge through the Arctic — so
 * the land was re-cut from the same Natural Earth source on the sphere (`globe-land.ts`). The
 * a11y and perf contract (pause control, reduced motion, off-screen pause, DPR cap, no per-frame
 * render) is in `world-globe.tsx`'s header. The cities, numbers and addresses are still read
 * from `fixtures/marketing-identity.ts`, never typed here.
 *
 * Motion: the rotation, which WCAG 2.2.2 makes pausable; plus the pins' one-shot landing when the
 * band scrolls in, kept from the flat map.
 */

export interface WorldMapProps {
  /** The band's label, in the frames' own label register. */
  label: string;
  /**
   * The flat map's accessible name. Kept so the signature is unchanged for `how-it-works.tsx`,
   * but no longer rendered: the globe is decorative (`aria-hidden`) and the city list beside it
   * is the accessible content, so an image name would only say the list twice.
   */
  alt: string;
}

/**
 * The pause control's words. ⚠ Copy belongs in `fixtures/marketing.ts` (`howItWorks.map`); it
 * sits here only because that file was being edited in parallel on 2026-09-29. Move it there.
 */
const GLOBE_CONTROL = { pause: "Pause", play: "Play", subject: "the globe" } as const;

export function WorldMap({ label }: WorldMapProps) {
  return (
    <MkReveal move="rise" data-steps-map="" className="mk-map">
      <WorldGlobe label={label} cities={MAYA_CITIES} control={GLOBE_CONTROL} />
    </MkReveal>
  );
}
