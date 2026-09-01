import { BuilderSkeleton } from "@/components/builder";
import { ScreenStateRoot } from "@/components/data/screen-state-root";

/**
 * The route-level loading surface for `/cards/[cardId]/edit` (spec §6.1 R-13, §8D.1).
 *
 * Identical to `/cards/new`'s, and deliberately so: the two routes are the same screen with
 * a different starting card, and a builder that arrived through two different-shaped
 * skeletons would shift on one of them. One `<BuilderSkeleton>`, four call sites.
 *
 * It renders **no `<main>`** — `AppShell` owns the only one in the `(app)` group (AC-25) —
 * and carries `data-screen-state="loading"` for T29's sweeps (§13.2).
 */
export default function EditCardLoading() {
  return (
    <ScreenStateRoot state="loading" className="flex flex-col gap-8 pb-16">
      <BuilderSkeleton />
    </ScreenStateRoot>
  );
}
