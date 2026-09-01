import { LoadingSkeleton } from "@/components/data/loading-skeleton";
import { ScreenStateRoot } from "@/components/data/screen-state-root";

/**
 * The route-level loading surface for `/cards/[cardId]` (spec §6.1 R-12, §8D.3, §8D.1).
 *
 * §8D.3's card-detail row asks for **a card-shaped skeleton plus five field-row skeletons**,
 * and T10's `card-detail` variant is exactly that box: the card's real 400 × 860 ratio on the
 * left, a title bone and five two-line rows on the right, in the same grid the screen uses.
 * The reason is measurable rather than aesthetic — §8D.1 forbids a spinner outright, because
 * a spinner says something is happening and then the page jumps.
 *
 * A server component, deliberately. Nothing here reads `?state=`, so nothing here needs a
 * client boundary — and `loading.tsx` is a Suspense fallback, which is the one place a
 * needless client chunk would be paid for on every navigation.
 *
 * ⚠ **No `<main>`.** `AppShell` owns the single `<main id="main">` for the whole `(app)`
 * group and this boundary renders inside it; a second landmark fails axe's `landmark-unique`
 * (AC-25). `ScreenStateRoot` is a `section` for the same reason.
 *
 * It carries `data-screen-state="loading"` because T29's sweeps key off that attribute and
 * nothing else (§13.2).
 */
export default function CardDetailLoading() {
  return (
    <ScreenStateRoot
      state="loading"
      as="section"
      aria-label="Card detail"
      className="flex flex-col gap-8 pb-16"
    >
      <LoadingSkeleton variant="card-detail" label="Loading this card" />
    </ScreenStateRoot>
  );
}
