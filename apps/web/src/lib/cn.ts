import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * ⚠ **`tailwind-merge` has to be taught this project's type scale, and until it was, it was
 * silently deleting it.**
 *
 * `twMerge` resolves `text-*` by guessing which group a class belongs to: `text-sm` is a font
 * size, `text-ink` is a colour. It knows Tailwind's own size names and nothing else — and this
 * project renamed the scale. `text-hero`, `text-h1`, `text-h2`, `text-h3` and `text-overline` are
 * font sizes that twMerge classified as **colours**, so in any list where one met a real colour:
 *
 * ```
 * cn("text-h3 text-ink")   →  "text-ink"      // the size and the display face, gone
 * ```
 *
 * Silent, and it only bites through `cn()` — a plain `className="text-h3 text-ink"` string was
 * unaffected, which is why the bug survived: `panel-head.tsx` renders its title at 20px in Space
 * Grotesk and the builder toolbar rendered the very same classes at 15px in Geist, two inches
 * apart, because one of them went through `cn()`.
 *
 * Found by reading `getComputedStyle` off both, not by eye. `[data-table] th` had the same defect
 * with `text-overline`.
 *
 * The scale below is the one in `tokens.css`, minus two deliberate omissions:
 *
 * · `text-base`, `text-lg`, `text-sm`, `text-xs` — twMerge already knows these names, and
 *   re-declaring a group it owns is how you break the ones it gets right.
 * · `text-machine` — not a size at all. It is the mono face plus tabular figures
 *   (`globals.css` §4), so it belongs in the family group, where it correctly conflicts with
 *   `font-sans`/`font-mono` and correctly does *not* conflict with a colour.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["hero", "h1", "h2", "h3", "overline"] }],
      "font-family": ["text-machine"],
    },
  },
});

/**
 * Conditional class names with conflict resolution.
 *
 * `clsx` flattens the conditionals; `twMerge` makes the LAST conflicting Tailwind class
 * win, so a caller's `className` prop always beats a component's default. Without the
 * merge, `<Button className="bg-surface">` would silently lose to the component's own
 * `bg-accent` depending on stylesheet order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type { ClassValue };
