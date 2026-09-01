import { CardsListSkeleton } from "./cards-list-client";

/**
 * The route-level loading UI for the `/cards` segment (spec §6.1 R-10, §8D.1).
 *
 * **Layout-matched, never a spinner.** The bones occupy the boxes the real screen will —
 * a header block at the header's rhythm, then six card bones at the real 400×860 aspect,
 * in the same grid at the same three breakpoints. Nothing moves when the content arrives,
 * which is the entire point of the family and what keeps AC-17's CLS budget honest.
 *
 * ⚠ **This file also covers the child segments.** Next resolves the *nearest* `loading.tsx`,
 * so `/cards/new` and `/cards/[cardId]` fall back to this one whenever they have no closer
 * boundary of their own. `CardsListSkeleton` is deliberately wordless about being the cards
 * list for exactly that reason — it announces "Loading cards", which is true of every route
 * under this segment, and it claims no page title it might not own.
 */
export default function CardsLoading() {
  return <CardsListSkeleton />;
}
