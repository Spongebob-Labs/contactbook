"use client";

import type { ReactElement, ReactNode } from "react";

import { Download, MessageCircle } from "lucide-react";

import { canBuildVcf } from "@/card/build-vcf";
import { CardActionButton } from "@/card/card-action-button";
import { whatsappActionFor } from "@/components/public-card/whatsapp-button";
import type { ResolvedCard } from "@/types/domain";

/**
 * The three actions on a scanned card, and deliberately only three.
 *
 * Save the contact, start a conversation, or connect. Everything else a link-in-bio product
 * would put here is already in the field list below, as a real labelled row with a working
 * `href` — turning six of those rows into six more buttons is how a contact card becomes a
 * link tree.
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
}: PublicCardActionsProps): ReactElement {
  const shape = resolved.template.shape.buttonShape;

  /* ⚠ Read from `cardPageSurface`, never re-derived here.
   *
   * `classic` runs the palette ground the whole height of the page, so the actions sit ON the
   * palette. `banner`, `hero` and `minimal` hand the body to the app canvas, so they sit on
   * white and need the canvas colourway — otherwise Onyx's white primary fill lands on white.
   *
   * This used to be a local `template.pageHeader === "solid"`, repeated in three files. Two of
   * them were reading a template property that the card could override.
   *
   * ⚠ It is now a **constant**, and deliberately still named. The `HeaderLayout` axis is gone,
   * so the field stack always stands on the painted ground and the buttons are always the
   * palette colourway; `bodyOnPalette` was the only thing that ever made it `canvas`. Kept as a
   * named local rather than inlined at the three call sites below, because that inlining is
   * precisely the drift this comment records. */
  const surface = "palette" as const;
  const saveable = canBuildVcf(resolved);
  const whatsapp = whatsappActionFor(resolved);

  const count = (saveable ? 1 : 0) + (whatsapp === null ? 0 : 1) + (connect === null ? 0 : 1);

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
          icon={<Download size={16} strokeWidth={1.75} />}
          onClick={() => onSaveToContacts(resolved)}
          disabled={savePending}
          busy={savePending}
        >
          {savePending ? "Saving…" : "Save to contacts"}
        </CardActionButton>
      )}

      {whatsapp === null ? null : (
        <CardActionButton
          action="whatsapp"
          paletteId={resolved.palette.id}
          palette={resolved.palette}
          variant="secondary"
          surface={surface}
          shape={shape}
          icon={<MessageCircle size={16} strokeWidth={1.75} />}
          href={whatsapp.href}
          external={whatsapp.external}
        >
          Message on WhatsApp
        </CardActionButton>
      )}

      {connect}
    </div>
  );
}
