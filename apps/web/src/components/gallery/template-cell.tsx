import { ShareFace } from "@/card/share-face";
import type { TemplatePalette } from "@/card/template-palettes";
import type { ResolvedCard } from "@/types/domain";

/**
 * One gallery cell — spec §8B.5, AC-30.
 *
 * ## The two rules this component exists to keep
 *
 * 1. **The cell is a real rendered mini card, not an abstract swatch.** It mounts a live
 *    `<ShareFace mode="thumb">`, which is the single most important thing the reference
 *    gallery gets right and the reason `/templates` can be trusted as a preview at all.
 *    Nothing here paints a colour or a shape of its own: every pixel inside the frame comes
 *    from the template registry through the renderer.
 *
 * 2. **The name is a caption BELOW the frame, never inside it.** §8B.5 says so twice and
 *    the plan calls putting it inside "the single most common way this gallery gets built
 *    wrong". The frame and the caption are therefore *siblings* — `gallery.spec.ts` asserts
 *    `frame.contains(name) === false` structurally as well as by geometry.
 *
/**
 * A uniform tile, with the face centred inside it.
 *
 * `336/500` is the face's own aspect, so the card fills the tile exactly and nothing
 * letterboxes. Keep the two in step — a tile that disagrees with the face is either a hole under
 * every card or a crop across every one.
 *
 * This class used to be `aspect-[400/860]`, the old single-canvas ratio, which reserved 430px
 * of height for a 247px card — at 1280px wide the gallery was 2,886px tall to show eight
 * cards, most of it empty. It then briefly became 4:5 to hold a mix of portrait and landscape
 * faces; the landscape composition is gone, so the tile can be the card's real shape again.
 */
export const TEMPLATE_FRAME_CLASS =
  "relative flex w-full max-w-[200px] items-center justify-center overflow-hidden rounded-xl aspect-[336/500]";

export interface TemplateCellProps {
  /**
   * The palette this cell is showing. The cell is keyed on colour, not on template — colour is
   * what a person browses here, and a template is chosen by the rail above the grid.
   */
  palette: TemplatePalette;
  /** Resolved once by the grid, so every cell previews the same content in a different colour. */
  resolved: ResolvedCard;
}

export function TemplateCell({ palette, resolved }: TemplateCellProps) {
  return (
    <li data-template-cell={palette.id} className="flex min-w-0 flex-col gap-4">
      <div data-template-frame="" className={TEMPLATE_FRAME_CLASS}>
        <ShareFace resolved={resolved} mode="thumb" thumbWidth={200} />
      </div>

      {/* The caption. A sibling of the frame — see the note above. */}
      <div className="flex min-w-0 flex-col gap-1">
        <h2 data-template-name="" className="text-left font-sans text-lg text-ink">
          {palette.name}
        </h2>
        {/* No blurb. Every cell shows the same template in a different colour, so a per-cell
            description was the identical sentence printed nine times. What the template is FOR
            is stated once, above the grid, where it applies to all of them. */}
      </div>
    </li>
  );
}
