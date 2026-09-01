import { BuilderSkeleton } from "@/components/builder";
import { ScreenStateRoot } from "@/components/data/screen-state-root";

/**
 * The route-level loading surface for `/cards/new` (spec §6.1 R-11, §8D.1).
 *
 * The same `<BuilderSkeleton>` the page's own `<Suspense>` fallback renders — one shape in
 * one place, because a skeleton that drifts from the surface it stands in for is a layout
 * shift with extra steps. §8D.1: the bones are the real box of the real content, which here
 * means a card-shaped bone in the pinned pane and a form-shaped one beside it.
 *
 * It renders **no `<main>`**: `AppShell` owns the one `<main id="main">` in the `(app)`
 * group and a second landmark fails axe's `landmark-unique` (AC-25). It carries
 * `data-screen-state="loading"` because T29's state and a11y sweeps key off that attribute
 * and nothing else (§13.2).
 */
export default function NewCardLoading() {
  return (
    <ScreenStateRoot state="loading" className="flex flex-col gap-8 pb-16">
      <BuilderSkeleton />
    </ScreenStateRoot>
  );
}
