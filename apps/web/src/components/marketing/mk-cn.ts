import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `cn` for the marketing layer.
 *
 * ## Why this exists rather than `@/lib/cn`
 * `cn` is `twMerge(clsx(...))`, and `twMerge` resolves conflicts by sorting each class into a
 * *class group*. It knows Tailwind's own scales; it can only guess at a custom one. For a
 * `text-*` utility it asks "does this value look like a size?" — and `mk-display` does not, so
 * **`text-mk-display` was filed as a text COLOUR**. Put it next to `text-mk-ink`, as every
 * heading in this layer does, and twMerge saw two colours, kept the last, and silently dropped
 * the font size. Every headline on the page rendered at the inherited 15px.
 *
 * It fails silently and it fails in the browser only — the classes are in the markup, the CSS
 * rule exists, and the class never reaches the element. That is worth a file to prevent.
 *
 * ## Why not just fix `@/lib/cn`
 * Because `cn` is used by every product screen, and widening its class groups changes conflict
 * resolution on surfaces this task is not allowed to touch. The app has the same latent hazard
 * with `text-h1` vs `text-ink`; that is worth fixing, but as its own change with the app's own
 * tests running, not as a side effect of a marketing redesign.
 *
 * So: same behaviour, same call signature, one extra `extend` block naming the four `mk-`
 * scales twMerge cannot infer. Marketing components import `mkcn`; product components keep
 * `cn`; neither can affect the other.
 *
 * ⚠ **Adding a token to a bridged scale in `marketing.css` means adding it here too.** A
 * missing entry does not error — it degrades to the same silent-drop bug. The lists below are
 * in the same order as the `@theme inline` block in that file so the two can be diffed by eye.
 */
const twMergeMk = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "mk-display",
            /* ⚠ `mk-heading-xl` WAS MISSING FROM THIS LIST WHILE BEING BRIDGED IN
               `marketing.css`, AND IT COST A SECTION.

               That is precisely the defect this file exists to prevent, arriving by omission
               rather than by design: `--text-mk-heading-xl` is declared in the `@theme inline`
               block, so `text-mk-heading-xl` is a real utility and the CSS rule ships — but
               unlisted here, twMerge cannot tell it is a SIZE, files it as a text colour, and
               drops it the moment it sits beside a real one. The close was
               `<Heading size="xl" className="text-mk-white">` and rendered its headline at the
               inherited 18px, smaller than the paragraph beneath it, with both classes present
               in the markup.

               `final-cta.tsx` had carried a long comment about routing around this — set the
               colour on the section and let the heading inherit it — which kept the workaround
               alive and the cause in place. The cause is fixed here instead. */
            "mk-heading-xl",
            "mk-heading-lg",
            "mk-heading",
            "mk-heading-sm",
            "mk-subheading",
            "mk-body",
            "mk-body-sm",
            "mk-caption",
            "mk-eyebrow",
          ],
        },
      ],
      "text-color": [
        {
          text: [
            "mk-ink",
            "mk-stone",
            "mk-pebble",
            "mk-pebble-mute",
            "mk-white",
            "mk-paper",
            "mk-wash",
            // The brand green ladder. `mk-green` is decorative-only and is listed here
            // because twMerge must still resolve it against the other text colours if a
            // future hand reaches for it — the ban is a review rule, not a build error.
            "mk-green",
            "mk-green-display",
            "mk-green-ink",
            "mk-green-deep",
            // The sky and the meadow, then the card grounds this layer draws from. A token
            // bridged in `marketing.css` but missing here does not error — it degrades to the
            // same silent class-drop this file exists to prevent, so the two lists are kept in
            // the same order.
            "mk-sky-zenith",
            "mk-sky-horizon",
            "mk-field-near",
            "mk-field-far",
            "mk-sapphire",
            "mk-sapphire-lift",
            "mk-sapphire-ink",
            "mk-emerald",
            "mk-emerald-ink",
            "mk-oxblood",
            "mk-rust",
            "mk-amber",
            "mk-amber-deep",
            "mk-clay",
            "mk-pistachio",
            "mk-periwinkle",
          ],
        },
      ],
      "font-family": [{ font: ["mk-display", "mk-sans", "mk-mono"] }],
      // `mk-heavy` is gone with `--mk-weight-heavy`: it resolved to 900, Space Grotesk's
      // `wght` axis stops at 700, and a weight token that clamps onto the one below it is
      // not a level. See the Weights block in `marketing.css`.
      "font-weight": [{ font: ["mk-regular", "mk-medium", "mk-strong", "mk-editorial"] }],
    },
  },
});

export function mkcn(...inputs: ClassValue[]): string {
  return twMergeMk(clsx(inputs));
}
