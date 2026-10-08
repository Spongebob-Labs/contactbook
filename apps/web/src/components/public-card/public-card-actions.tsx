"use client";

import type { ReactElement, ReactNode } from "react";

/**
 * ⚠ **ONE action, and it is "Send to my phone".**
 *
 * The page used to carry two stacked buttons: a black "Send to Phone" that downloaded a `.vcf`,
 * and under it a quiet "Send to my phone" that asked for a number and sent the card over
 * WhatsApp. The two read as the same thing and only the second did what the owner wanted —
 * Andrew, on the 2026-10-02 call, found "one of them doesn't seem to do anything" — so the file
 * download is gone (client, 2026-10-08: it is not offered right now) and the WhatsApp send took
 * its place, colour and arrow. `buildVcf` and `useSaveToContacts` are still in the codebase, so
 * bringing the download back is a slot here, not a rebuild.
 *
 * Before that, the page had three controls (Save, Message on WhatsApp, Connect) and cost about
 * 160px of vertical room before a single field appeared, on the surface with the least of it in
 * the product. The messaging action is not lost: it is a disc in the social strip, derived from
 * the card's own `PHONE`. See `SocialStrip` in `card-page.tsx`.
 *
 * Everything else a link-in-bio product would put here is already in the field list below, as a
 * real row with a working `href` — turning six of those rows into six more buttons is how a
 * contact card becomes a link tree.
 *
 * ## Why `connect` arrives as a node rather than a handler
 * "Send to my phone" is a multi-stage flow with its own request state, so it owns that state
 * itself and is handed in already built — this component decides *where* it sits, not *what* it
 * does. Passing a callback instead would move that stage machine into the component whose job is
 * laying out the action tier.
 *
 * The button's colourway is decided inside the flow (`surface="canvas"`, the pair
 * `PALETTE_CONTRACT` proves against the paper sheet the controls stand on), not here.
 */
export interface PublicCardActionsProps {
  /**
   * The connect flow — "Send to my phone" (`ConnectSendFlow`). A node rather than a handler, so
   * this tier never needs to know which connect path the page chose. `null` renders no action at
   * all.
   */
  connect?: ReactNode;
}

export function PublicCardActions({ connect = null }: PublicCardActionsProps): ReactElement {
  const count = connect === null ? 0 : 1;

  return (
    <div
      data-card-actions=""
      /* Published so a test can assert the count without enumerating selectors — and so a card
         that silently lost an action shows up as a number rather than as a missing element. */
      data-card-action-count={count}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
    >
      {connect}
    </div>
  );
}
