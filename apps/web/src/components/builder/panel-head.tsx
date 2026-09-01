import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The head of a builder panel: its title, its one-line introduction, and an optional control on
 * the title's baseline.
 *
 * ## ⚠ The title is the ONE place in the editor that uses the display face
 *
 * `globals.css` binds `.text-h1 / .text-h2 / .text-h3` to `--font-display` — Space Grotesk — and
 * the builder was not using any of them. Every heading on the screen was `text-lg`, which is
 * Geist at 17px, one step off the body it sat above. That is why the screen read as flat and
 * unstructured: **there was no typographic event anywhere on it.** A panel title at `.text-h3`
 * is 20px of a geometric grotesque at weight 560 against 15px Geist body — a change of *family*,
 * not just of size, which the eye reads before it reads a word.
 *
 * The three levels below it stay in Geist and separate by weight and size alone, which is what
 * keeps the shift at the top meaningful:
 *
 * | Level | Type | Where |
 * |---|---|---|
 * | Panel title | `.text-h3` — Space Grotesk 20 / 560 | here |
 * | Control heading | `text-base` — Geist 15 / 560 | `<h3>` in each picker |
 * | Group label | `text-overline` uppercase, `ink-4` | Deep / Light, Custom colour |
 * | Caption | `text-sm`, `ink-3` | under any of the above |
 *
 * ⚠ Do not put `.text-h3` on the control headings to "make them match". Two display-face levels
 * forty pixels apart is two titles competing, and the hierarchy collapses back to flat.
 *
 * ## The intro is capped at a reading measure
 *
 * `max-w-[58ch]`. The panel is ~520px at 1440 and wider on a large screen, and a description set
 * to the full width of a wide panel is a line nobody finishes. It is the only prose on the screen
 * and it is allowed to behave like prose.
 */

export interface PanelHeadProps {
  /** The section's name. Rendered as the panel's `<h2>` — one per panel, never more. */
  title: string;
  /** One sentence on what this panel changes. From `BUILDER_SECTIONS`, never retyped. */
  intro: string;
  /**
   * A control on the title's baseline — the Fields panel's **+ Add**.
   *
   * It is a slot rather than a prop pair because the one control that uses it opens a dialog
   * whose state belongs to `FieldPicker`; passing `onAdd` up here would put a piece of that
   * component's internals in the file that owns the screen.
   */
  action?: ReactNode;
  className?: string;
}

export function PanelHead({ title, intro, action, className }: PanelHeadProps): ReactElement {
  return (
    <div data-panel-head="" className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-h3 text-ink">{title}</h2>
        {action === undefined ? null : <div className="shrink-0">{action}</div>}
      </div>
      <p data-prose className="max-w-[58ch] text-sm text-ink-3">
        {intro}
      </p>
    </div>
  );
}
