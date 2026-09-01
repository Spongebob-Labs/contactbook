import { TemplateGallerySkeleton } from "@/components/gallery/template-grid";
import { Skeleton } from "@/components/primitives/skeleton";

/**
 * The route-level loading UI for `/templates` (spec §6.1 R-02, §8D.1).
 *
 * **Layout-matched, never a spinner.** The bones occupy the same boxes the real screen
 * will: the header block at the same rhythm, the rail at the same width, and eight frame
 * bones at the card's real 400×860 aspect. Nothing moves when the content arrives, which
 * is the entire point of the family.
 *
 * The closing band is deliberately absent — it is static, it never waits for anything, and
 * a bone standing in for it would be the one shift this file exists to prevent.
 */
export default function TemplatesLoading() {
  return (
    <div>
      <div className="mx-auto w-full max-w-[var(--content-max)] px-5 pt-12 pb-10 md:px-8 md:pt-16 md:pb-12">
        <Skeleton className="h-10 w-48 rounded-sm md:h-12" />
        <Skeleton className="mt-5 h-4 w-full max-w-[var(--prose-max)] rounded-xs" />
      </div>
      <TemplateGallerySkeleton />
    </div>
  );
}
