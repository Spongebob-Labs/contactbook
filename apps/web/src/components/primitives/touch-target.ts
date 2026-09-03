/**
 * The 44px touch region, as a class string — for controls whose *drawn* size must stay small.
 *
 * ## Why this exists as a shared constant
 *
 * A 20px checkbox, a 20px radio, a 24px-tall switch track and a 16px chip dismissal are all
 * correct at those sizes: they are the sizes the design system draws them at, they are what
 * makes a dense form readable, and growing them to 44px would turn every settings row in the
 * product into a stack of slabs.
 *
 * They are also all far under the 44px pointer-target floor that Apple's HIG, Android's
 * Material guidance and WCAG 2.5.5 independently arrive at — and on a phone that is not a
 * cosmetic miss. It is felt as a control that "doesn't respond", which is how the reader
 * describes a tap that landed 6px outside a 20px box.
 *
 * ## ⚠ The mechanism, and why padding is the wrong tool
 *
 * `::before` with a negative inset grows a transparent hit region **outside** the control's
 * border box. Nothing about the layout changes: the box keeps its width and height, the row
 * keeps its rhythm, a flex line wraps in the same place. Padding cannot do this — it grows the
 * border box, so every row that contains the control gets taller and every grid of them
 * reflows.
 *
 * Three parts are all load-bearing:
 *
 *   · **`relative`** — the pseudo-element is absolutely positioned and needs this as its
 *     containing block. Without it the region anchors to some ancestor and lands anywhere.
 *   · **`before:content-['']`** — a pseudo-element with no `content` is never generated at all,
 *     so the whole rule silently does nothing.
 *   · **`max-md:`** — the floor applies below 768px only, the same line the shell uses to mean
 *     "this is a phone". On a pointer the extra region is not needed and an invisible 44px box
 *     around a 20px checkbox would swallow clicks aimed at whatever sits 12px away.
 *
 * ## ⚠ It does NOT replace a real label
 *
 * Every consumer of this also links a visible `<label>` with `htmlFor`, which makes the label
 * text tappable and is what carries the *composite* row past 44px. This constant is the answer
 * for the `hideLabel` case, where the label leaves the layout and the small box becomes the
 * only target there is. Both, always — the hit region is not a licence to drop the label.
 */

/** A 44px-tall region around a control up to ~20px tall. Checkbox, radio. */
export const TOUCH_HIT_44 =
  "relative max-md:before:absolute max-md:before:-inset-3 max-md:before:content-['']";

/**
 * A 44px-tall region around a control that is already wide enough — the switch track is
 * 44x24, so only the vertical axis is short. `inset-x-0` keeps the region from spilling
 * sideways into whatever the switch is ranged against.
 */
export const TOUCH_HIT_44_Y =
  "relative max-md:before:absolute max-md:before:-inset-y-2.5 max-md:before:inset-x-0 max-md:before:content-['']";
