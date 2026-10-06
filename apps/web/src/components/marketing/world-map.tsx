import { BrandLogo } from "@/components/layout/brand-logo";
import { howItWorks } from "@/fixtures/marketing";

import { MkReveal } from "./mk-reveal";
import { WorldGlobe } from "./world-globe";

/**
 * The globe band in how-it-works — a turning globe with a dot on every major city, and beside
 * it the logo and one statement.
 *
 * The client, 2026-09-28: *"Consider adding a global map element to reinforce international
 * feel."* 2026-10-06: *"The globe can stay, but remove the details on the right (not sure what
 * they are). The globe can have dots on all major cities globally … Where the text currently is,
 * let's just add the logo and 'it's time you use ContactBook to manage your global network. It's
 * not what you know, it's who you know.'"* So the four offices with their numbers and addresses
 * are gone from this band (they are still in step 01's profile), and so is everything that tied
 * the globe to them — the facing-city highlight, the on-globe name, the hairline in the list.
 *
 * ## Why a band under the frames, and not behind one of them
 * The frames are identical on purpose (`how-it-works.tsx`: "unlike things in identical columns
 * never read as one row"), and a globe behind one of them would make that one a different kind
 * of object again. As its own band it follows the same grammar as the frames (the white panel,
 * the hairline, the uppercase label).
 *
 * ## How it is built
 * This file stays a server component with the same props, so `how-it-works.tsx` did not change.
 * The picture is `world-globe.tsx`, a small client island that server-renders a composed still
 * and hands it to a canvas once scripts run; its a11y and perf contract (pause control, reduced
 * motion, off-screen pause, DPR cap, no per-frame render) is in its header. The statement is
 * rendered here and passed through as `children`, so it ships as server HTML, not in the island.
 * The logo is the nav's tagline-free lockup (`BrandLogo`), decorative: the sentence beside it
 * names ContactBook itself, so an alt would only say the name twice.
 */

export interface WorldMapProps {
  /** The band's label, in the frames' own label register. */
  label: string;
  /**
   * Kept so the signature is unchanged for `how-it-works.tsx`, but not rendered: the globe is
   * decorative (`aria-hidden`) and the statement beside it is the band's content.
   */
  alt: string;
}

export function WorldMap({ label }: WorldMapProps) {
  const { statement, control } = howItWorks.map;
  return (
    <MkReveal move="rise" data-steps-map="" className="mk-map">
      <WorldGlobe label={label} control={control}>
        <div className="mk-map__statement">
          <BrandLogo variant="lockup" className="h-8 md:h-10" />
          <p className="mk-map__copy">
            {statement.lead}{" "}
            <span className="mk-map__punchline">{statement.punchline}</span>
          </p>
        </div>
      </WorldGlobe>
    </MkReveal>
  );
}
