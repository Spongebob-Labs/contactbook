import type { CSSProperties, ReactElement, ReactNode } from "react";

import {
  TEMPLATE_PALETTES,
  paletteVars,
  type PaletteId,
  type TemplatePalette,
} from "@/card/template-palettes";
import type { CardTemplate } from "@/card/template-types";

/**
 * A card action control, painted from the palette on the card root.
 *
 * It lives in `src/card/` rather than with the app's own `<Button>` because it belongs to a
 * different colour system: the app's button is near-black on white and always will be, while
 * this one is whatever the card's palette says. Sharing one component between the two would
 * mean a button that has to ask which world it is in, and every such component eventually
 * gets the answer wrong on one of them.
 *
 * ## `surface` is not cosmetic — it is a correctness argument
 *
 * A palette's button colours are defined against that palette's own ground. Cobalt's primary
 * fill is white, which is right on a cobalt card and **invisible on the app's white canvas**.
 * Two of the three `pageHeader` treatments (`band`, `quiet`) put the actions on the canvas
 * rather than on the palette, so the button has to know which it is standing on.
 *
 * `surface="palette"` uses the palette's own button colours, as validated.
 * `surface="canvas"` uses the palette's `canvasActionBg` / `canvasActionInk` pair — usually its
 * ground and ink, so a cobalt button with white text — and turns the secondary into a plain
 * outline on the canvas.
 *
 * That pair is a real palette slot rather than an alias for `ground`/`ink` because of Paper,
 * whose ground *is* white: a "ground button on the canvas" is then white on white, a 1:1 fill
 * that renders as unstyled text. `PALETTE_CONTRACT` asserts `canvasActionBg` clears 3:1 against
 * the app canvas, so that is now a failing test rather than a shipped bug.
 *
 * Renders an `<a>` when given an `href` and a `<button>` otherwise, so "Message on WhatsApp"
 * is a real link the browser can open, long-press and copy.
 *
 * ## Why it carries its own palette
 *
 * `paletteId` is required, and the button re-declares the `--c-*` custom properties on itself
 * rather than inheriting them from a card root above it.
 *
 * That is not redundancy. These buttons are used both inside a card (`<CardPage>`'s action
 * slot, where the vars are already in scope) and *beside* one (the card-detail screen puts the
 * owner's save action under the face, outside its subtree). In the second position an
 * inheriting button resolves `var(--c-ground)` to nothing, so `background` falls back to
 * transparent and `color` inherits the page's ink — a black-on-white label with no fill, which
 * is exactly how this shipped the first time. Re-declaring is idempotent inside the card and
 * load-bearing outside it, so it is done unconditionally.
 */

export interface CardActionButtonProps {
  children: ReactNode;
  /**
   * The card's palette. Required, and applied to this element — see the note above on why the
   * button cannot rely on inheriting it.
   *
   * ⚠ Prefer {@link CardActionButtonProps.palette} wherever the resolved object is in scope.
   * An id can only name one of the nine presets, and since free ground colour landed a derived
   * palette has to **borrow** the nearest preset's id to satisfy this type — so a button given
   * the id paints the preset's colours, not the owner's. Same polarity, so the text stays
   * legible, and wrong.
   */
  paletteId: PaletteId;
  /**
   * The resolved palette itself, which wins over `paletteId` when supplied.
   *
   * This is the correct input: `resolveCard` already produced the exact palette the card is
   * painted with — derived from a free colour or looked up from a preset — and handing over the
   * object carries that decision instead of re-deriving it from a name that cannot express it.
   * The same class of bug as reading `resolved.template.paletteId` instead of `resolved.palette`,
   * which put Indigo buttons on a Claret card.
   */
  palette?: TemplatePalette;
  /**
   * What the control does — `"save"`, `"whatsapp"`. Published as `data-card-action`.
   *
   * A semantic name rather than the visual variant: `data-card-action="save"` survives a
   * redesign that turns the primary button secondary, where `data-card-action="primary"` would
   * silently start matching the wrong control.
   */
  action: string;
  variant?: "primary" | "secondary";
  /**
   * Which ground the button is standing on. See the note above — getting this wrong makes a
   * button the same colour as the thing behind it.
   */
  surface?: "palette" | "canvas";
  shape: CardTemplate["shape"]["buttonShape"];
  icon?: ReactNode;
  href?: string;
  /** Adds `rel="noopener noreferrer"`; only meaningful alongside `href`. */
  external?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  /** Announced state for the save action's in-flight moment. */
  busy?: boolean;
  /**
   * An optional mark at the trailing edge — the card page's primary action wears an arrow
   * there, the way the reference does.
   *
   * ⚠ It is a SLOT and not a boolean, and it is placed out of flow rather than added to the
   * centred group, so the label stays optically centred. An arrow that joins the `icon`/label
   * group instead shifts every label left by half the arrow's width, which reads as a wobble
   * the moment two buttons are stacked.
   */
  trailing?: ReactNode;
}

export function CardActionButton({
  children,
  paletteId,
  palette,
  action,
  variant = "primary",
  surface = "palette",
  shape,
  icon,
  href,
  external = false,
  onClick,
  disabled = false,
  busy = false,
  trailing,
}: CardActionButtonProps): ReactElement {
  const primary = variant === "primary";
  const onCanvas = surface === "canvas";

  /* Four combinations, resolved once so the style object below stays readable. */
  /* ⚠ `transparent` and not `--canvas` for the canvas secondary.
     It was `var(--canvas)` — pure white — which was right while the only surface under it was
     the white app canvas. The card page's sheet is white carrying 3% of the palette's ground,
     so an opaque white fill on it reads as a pale rectangle floating on paper. Transparent lets
     the ghost button take whatever paper it stands on, on every surface; the `--line-control`
     border below is what makes it a control either way (1.4.11, 3.44:1 on canvas). */
  const fill = onCanvas
    ? primary
      ? "var(--c-canvas-action-bg)"
      : "transparent"
    : primary
      ? "var(--c-button-bg)"
      : "var(--c-button-alt-bg)";

  const label = onCanvas
    ? primary
      ? "var(--c-canvas-action-ink)"
      : "var(--ink)"
    : primary
      ? "var(--c-button-ink)"
      : "var(--c-button-alt-ink)";

  /* Only the secondary needs a drawn boundary: a primary's fill is its boundary, and both
     fills are proven ≥3:1 against the ground they sit on. */
  const edge = primary
    ? "1px solid transparent"
    : onCanvas
      ? "1px solid var(--line-control)"
      : "1px solid var(--c-button-alt-border)";

  const style: CSSProperties = {
    /* The palette, on this element. Idempotent when the button is already inside a card root;
       the only thing that makes it work when it is not. */
    ...(paletteVars(palette ?? TEMPLATE_PALETTES[paletteId]) as CSSProperties),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-2)",
    width: "100%",
    /* 44 is the pointer-target floor and what every other card action uses. The canvas PRIMARY
       is the card page's single hero control, so it is taller — but 48 rather than the 56 it
       briefly was: it is now the ONLY button on the card, so it no longer has to out-shout a
       second one beneath it, and 8px on the tightest axis in the product is worth more than the
       emphasis. It still clears the 44px field rows below it by a full step. */
    minHeight: onCanvas && primary ? "48px" : "44px",
    paddingInline: "var(--space-5)",
    borderRadius: shape === "pill" ? "var(--radius-full)" : "var(--radius-md)",
    background: fill,
    color: label,
    border: edge,
    fontSize: "var(--text-sm)",
    fontWeight: "var(--weight-medium)",
    letterSpacing: "0.002em",
    /* The containing block for `trailing`, above. */
    position: "relative",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    transition: `opacity var(--dur-fast) var(--ease-standard)`,
    textDecoration: "none",
  };

  const content = (
    <>
      {icon === undefined ? null : (
        <span aria-hidden="true" style={{ display: "flex", flexShrink: 0 }}>
          {icon}
        </span>
      )}
      <span>{children}</span>
      {trailing === undefined ? null : (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            insetInlineEnd: "var(--space-5)",
            display: "flex",
            flexShrink: 0,
            opacity: 0.85,
          }}
        >
          {trailing}
        </span>
      )}
    </>
  );

  if (href !== undefined && !disabled) {
    return (
      <a
        data-card-action={action}
        data-action-variant={variant}
        href={href}
        {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
        style={style}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      data-card-action={action}
      data-action-variant={variant}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      style={style}
    >
      {content}
    </button>
  );
}
