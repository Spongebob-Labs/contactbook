import { ProfileSkeleton } from "./profile-client";

/**
 * The route-level loading UI for `/profile` (spec §6.1 R-16, §8D.1).
 *
 * §8D.3's loading column for this screen reads *"identity + 3 group skeletons"*, which is
 * exactly what `LoadingSkeleton variant="groups"` draws — the same bones, in the same
 * boxes, so nothing shifts when the real content lands.
 *
 * It deliberately carries **no `data-screen-state`**. That attribute belongs to the client
 * component's root and means "the screen resolved to this state"; a route-level Suspense
 * fallback is a different thing, and two elements matching `[data-screen-state]` is how a
 * strict-mode locator in an e2e suite starts failing for reasons that have nothing to do
 * with the product (see the wave-6 note on W6-08 in the run log).
 */
export default function ProfileLoading() {
  return <ProfileSkeleton />;
}
