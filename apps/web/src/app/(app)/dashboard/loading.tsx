import { Skeleton } from "@/components/primitives/skeleton";

import { DashboardSkeleton } from "./dashboard-client";

/**
 * The route-level loading UI for `/dashboard` (spec §6.1 R-09, §8D.1).
 *
 * **Layout-matched, never a spinner.** This file replaces the whole segment — `page.tsx`
 * included — so it has to stand in for the page header too, or the title would appear late
 * and push everything below it down. The bone above therefore holds the same box
 * `PageHeader` does: a `--text-h3` title on a hairline rule. The page has no subtitle, so
 * neither do its bones.
 *
 * Everything under the rule is `DashboardSkeleton`, the same component `page.tsx` hands to
 * `<Suspense>`, so the two waiting surfaces are identical by construction rather than by
 * two people remembering to keep them in step.
 *
 * The shimmer belongs to the `Skeleton` primitive and freezes under reduced motion through
 * the one global rule in `globals.css` (AC-27). Nothing here knows about that.
 */
export default function DashboardLoading() {
  return (
    <>
      <div data-page-header-bones="" className="border-b border-line pb-6">
        <Skeleton className="h-9 w-48 rounded-sm" />
      </div>

      <DashboardSkeleton />
    </>
  );
}
