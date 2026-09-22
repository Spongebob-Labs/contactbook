"use client";

import type { ReactElement, ReactNode } from "react";

import { ArrowRight, SmartphoneNfc } from "lucide-react";

import { canBuildVcf } from "@/card/build-vcf";
import { CardActionButton } from "@/card/card-action-button";
import type { ResolvedCard } from "@/types/domain";

/**
 * ⚠ **ONE action, and the card's whole weight is on it.**
 *
 * There were two full-width buttons — Save and Message on WhatsApp — plus a third slot for
 * Connect. Three stacked controls cost about 160px before a single field appeared, on the
 * surface with the least vertical room in the product, and the reference this composition is
 * built from has exactly one. The messaging action is not lost: it is a disc in the social
 * strip, derived from the card's own `PHONE`, which is where a destination belongs once there
 * is somewhere for destinations to live. See `SocialStrip` in `card-page.tsx`.
 *
 * Everything else a link-in-bio product would put here is already in the field list below, as a
 * real row with a working `href` — turning six of those rows into six more buttons is how a
 * contact card becomes a link tree.
 *
 * ## Why `connect` arrives as a node rather than a handler
 * The other two are one-shot: a synthetic click on a blob URL, and an `href`. "Save & connect"
 * is a four-state flow with its own request state, so it owns that state itself and is handed
 * in already built — this component decides *where* it sits, not *what* it does. Passing a
 * callback instead would move the OTP stage machine into the component whose entire job is
 * choosing three colourways.
 *
 * It renders last on purpose. Saving to contacts is what the reader came to do; connecting is
 * the thing they did not know they could do, and it reads as an offer in third position and as
 * a demand in first.
 *
 * Both controls are conditional on the data actually supporting them: no phone number means
 * no WhatsApp button, and a card whose fields produce a `.vcf` with nothing but a name gets a
 * disabled save rather than one that downloads an empty file. `canBuildVcf` is the single
 * definition of "enough to save" — the previous build inlined a field count here instead,
 * which drifted from the builder's own idea of an empty card.
 */
export interface PublicCardActionsProps {
  resolved: ResolvedCard;
  /**
   * What the one button says.
   *
   * ⚠ A prop rather than a literal because the action behind it is going to change and the
   * label is the only part of this component that has to change with it. Today it writes a
   * `.vcf`; when the connect flow lands it will ask for a number and send the card over
   * WhatsApp, and "Send to Phone" is true of both. Swapping the behaviour is then one `onClick`
   * and no redesign, which is the whole reason the actions arrive here as a slot.
   *
   * ⚠ On a DESKTOP browser a `.vcf` is a download rather than something that reaches a phone,
   * so the label is aspirational there. It is the label the client asked for, it is correct on
   * the surface this page is overwhelmingly opened on, and it stops being a stretch entirely
   * the moment the connect flow is wired.
   */
  primaryLabel?: string;
  onSaveToContacts: (resolved: ResolvedCard) => void;
  savePending: boolean;
  /** The "Save & connect" flow, already built. `null` renders no connect action at all. */
  connect?: ReactNode;
}

export function PublicCardActions({
  resolved,
  onSaveToContacts,
  savePending,
  connect = null,
  primaryLabel = "Send to Phone",
}: PublicCardActionsProps): ReactElement {
  const shape = resolved.template.shape.buttonShape;

  /* ⚠ **`canvas`, and this is the line the 2026-09-17 rebuild turned over.**
   *
   * It was `palette`, on the argument that the field stack always stands on the painted ground
   * so the buttons should take the palette's own button pair. That argument died with the
   * composition it described: the card page is now two surfaces, the palette owns only the
   * COVER, and these controls sit on the paper sheet below the curve. On paper, Onyx's
   * `--c-button-bg` is `#FFFFFF` — an invisible button, which is the exact defect the canvas
   * colourway was introduced to prevent in the first place.
   *
   * `canvas` resolves to `--c-canvas-action-bg` / `--c-canvas-action-ink`, the one pair
   * `PALETTE_CONTRACT` proves against white rather than against the card's own ground (≥3:1 for
   * the fill, ≥4.5:1 for its label). It is a deep colour on all nine palettes, so the primary
   * action is a near-black pill on an Onyx card and a deep-brown one on Amber — the reference's
   * black pill, arrived at from the contract rather than from a literal.
   *
   * Still a named local rather than inlined at the three call sites: that inlining is precisely
   * the drift the previous version of this comment recorded. */
  const surface = "canvas" as const;
  const saveable = canBuildVcf(resolved);

  const count = (saveable ? 1 : 0) + (connect === null ? 0 : 1);

  return (
    <div
      data-card-actions=""
      /* Published so a test can assert the count without enumerating selectors — and so a card
         that silently lost an action shows up as a number rather than as a missing element. */
      data-card-action-count={count}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
    >
      {/* Omitted entirely, not disabled, when there is nothing to save. A card that shares no
          fields produces a `.vcf` carrying only a name, and a permanently disabled button
          explains none of that — the page renders a note instead. */}
      {!saveable ? null : (
        <CardActionButton
          action="save"
          paletteId={resolved.palette.id}
          palette={resolved.palette}
          variant="primary"
          surface={surface}
          shape={shape}
          /* The phone-with-an-arrow the reference uses, not a download tray: the tray describes
             the mechanism (a file) and this button describes the outcome (it reaches your
             phone), which is also what survives the switch to the connect flow. */
          icon={<SmartphoneNfc size={18} strokeWidth={1.75} />}
          /* The arrow the reference puts at the trailing edge. Decorative — the button already
             says what it does — so it is `aria-hidden` inside `CardActionButton`. */
          trailing={<ArrowRight size={18} strokeWidth={1.75} />}
          onClick={() => onSaveToContacts(resolved)}
          disabled={savePending}
          busy={savePending}
        >
          {savePending ? "Sending…" : primaryLabel}
        </CardActionButton>
      )}

      {connect}
    </div>
  );
}
