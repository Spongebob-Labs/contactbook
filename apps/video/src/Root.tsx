import { Composition } from "remotion";

import { HeroLoop } from "./HeroLoop";

/**
 * 720 x 1080 — the product's own 336:500 pass ratio, near enough that the film sits inside a
 * pass-shaped slot on the page with no letterboxing. A 16:9 hero film would have to be
 * letterboxed or cropped into that slot, and cropping a film whose subject is a portrait card
 * is how you end up with a hero that shows the middle third of a business card.
 *
 * 15s at 30fps. Silent by design: it plays muted and autoplaying in a page hero, where audio
 * is not permitted to start and a soundtrack nobody hears is weight in the bundle.
 */
export const RemotionRoot = () => (
  <Composition
    id="HeroLoop"
    component={HeroLoop}
    durationInFrames={450}
    fps={30}
    width={720}
    height={1080}
  />
);
