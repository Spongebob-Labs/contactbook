import { LoadingSkeleton } from "@/components/data/loading-skeleton";
import { ScreenStateRoot } from "@/components/data/screen-state-root";

/**
 * The route-level loading surface for `/c/[slug]` (spec §6.1 R-18, §8D.5, §8D.1).
 *
 * §8D.5 asks for **a card-shaped skeleton at the exact aspect**, and `LoadingSkeleton`'s
 * `card` variant is that box: 400 × 860, the card's real design ratio. The reason is
 * measurable rather than aesthetic — AC-17 requires CLS 0 on this route, and a square
 * placeholder for a 1 : 2.15 card is the largest single shift this application could
 * produce. A spinner would be worse still: it says something is happening and then the
 * page jumps.
 *
 * A server component, deliberately. Nothing here reads `?state=`, so nothing here needs a
 * client boundary — and `loading.tsx` is a Suspense fallback, which is the one place a
 * needless client chunk would be paid for on every navigation.
 *
 * It carries `data-screen-state="loading"` for the same reason every other surface in this
 * screen does: T29's sweeps key off that attribute and nothing else (§13.2).
 */
export default function PublicCardLoading() {
  return (
    <main
      id="main"
      className="flex min-h-full flex-1 flex-col bg-canvas"
    >
      <ScreenStateRoot
        state="loading"
        className="flex min-h-full flex-1 flex-col items-center px-3 py-3 md:px-6 md:py-12"
      >
        <div className="my-auto w-full max-w-[480px]">
          <LoadingSkeleton variant="card" label="Loading this contact card" />
        </div>
      </ScreenStateRoot>
    </main>
  );
}
