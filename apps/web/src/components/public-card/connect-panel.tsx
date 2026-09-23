import type { CSSProperties, ReactElement, ReactNode } from "react";

/**
 * The building blocks both connect flows stand on — a titled panel and the two styles every
 * control inside one uses.
 *
 * Moved out of `connect-flow.tsx` when "Send to my phone" (`connect-send-flow.tsx`) arrived, so
 * the two flows render from one definition of what a connect panel looks like rather than two
 * copies free to drift.
 *
 * ## ⚠ Text stands on the SHEET, not on the palette ground
 * Since the card redesign the actions tier sits on the light sheet under the hero, where
 * `<CardPage>` defines `--cb-sheet-ink` (`--ink`) and `--cb-sheet-ink-soft` (`--ink-2`, 10.33:1).
 * The palette's `--c-ink` is the ink for the palette *ground* — white on Sapphire — so painting
 * a title with it put white text on near-white paper: invisible. Every text colour below reads
 * the sheet ink first and falls back to the palette ink only outside a card root, where there
 * is no sheet to stand on. The inputs keep the palette's alt-button pair, which is a filled
 * control and legible on either surface.
 */

/** Text on the sheet — see the ⚠ above for why not `--c-ink`. */
export const INK = "var(--cb-sheet-ink, var(--c-ink))";
export const INK_SOFT = "var(--cb-sheet-ink-soft, var(--c-ink-soft))";

export const fieldStyle: CSSProperties = {
  minHeight: "44px", // the same thumb-sized floor `CardActionButton` uses
  paddingInline: "var(--space-4)",
  borderRadius: "var(--radius-md)",
  /* The alt-button pair, not the ground: an input painted `--c-ground` on a `--c-ground` panel
     has no edge, and the alt pair is the one already proven legible against this palette. */
  background: "var(--c-button-alt-bg)",
  color: "var(--c-button-alt-ink)",
  border: "1px solid var(--c-button-alt-border)",
  fontSize: "var(--text-sm)",
  width: "100%",
};

export const helperStyle: CSSProperties = {
  margin: 0,
  fontSize: "var(--text-xs)",
  lineHeight: 1.5,
  color: INK_SOFT,
};

/** A titled group on the sheet. Borderless — the gap does the separating. */
export function Panel({
  title,
  helper,
  icon,
  children,
}: {
  title: string;
  helper: string;
  icon?: ReactElement;
  children?: ReactNode;
}): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <p
          style={{
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--weight-medium)",
            color: INK,
          }}
        >
          {icon === undefined ? null : <span aria-hidden="true">{icon}</span>}
          {title}
        </p>
        <p style={helperStyle}>{helper}</p>
      </div>
      {children}
    </div>
  );
}
