"use client";

import { useState, type ReactElement } from "react";

import { buildVcf, canBuildVcf } from "@/card/build-vcf";
import { CardPage } from "@/card/card-page";
import { ConnectSendFlow } from "@/components/public-card/connect-send-flow";
import { PublicCardActions } from "@/components/public-card/public-card-actions";
import { useVcfDownload } from "@/components/share/share-sheet";
import type { ResolvedCard } from "@/types/domain";

/**
 * The card a stranger sees, and the three things they can do with it.
 *
 * ## Why this is a client component at all
 * `<CardPage>` renders on the server perfectly well — the reason for a client boundary is
 * **Save to contacts**, which writes a `.vcf` into a blob URL and clicks a synthetic anchor. That
 * needs a browser. So the page stays a Server Component (it does the fetch), and only the action
 * tier is hydrated. **"Send to my phone"** is the second reason: it is a POST with request state
 * around it.
 *
 * ## Which connect flow is on the page
 * **"Send to my phone"** (`ConnectSendFlow`, `POST …/connect/send`) — the scanner types a number
 * and the card goes to it over WhatsApp, with no code. It replaced the OTP-verified "Save &
 * connect" (`ConnectFlow`, `…/connect/otp/{request,verify}`) as a product call on 2026-09-23:
 * zero friction over proof of ownership. Only one is ever rendered — offering both would let the
 * same number fail on one path and succeed on the other in the same session. `ConnectFlow` is
 * still in the codebase, so reverting is the one line below.
 *
 * ## The vCard is written once
 * `buildVcf` runs here and the result is handed to the download — never rebuilt at the moment of
 * the click. That is §6.4's rule: the card on screen and the file that leaves the page are
 * produced from one derivation, so they cannot disagree.
 *
 * `canBuildVcf` gates it: a card that shares nothing has **no** download control rather than one
 * that refuses. `buildVcf` throws `EmptyCardError` in that case instead of writing the old build's
 * 73-byte name-only file (§11 E-01/E-02).
 *
 * ## ⚠ The zero-field card has no actions at all, connect included
 * The `vcf === null` gate below predates connect and suppresses the **whole** action tier, so a
 * card sharing nothing renders no connect action either. That is not an argument that it
 * should not — a scanner connecting to an empty card is arguably the *most* useful case, since
 * the owner can then notify them the moment they map a field. It is preserved deliberately:
 * `public-card.spec.ts`'s E-02/AC-36 test asserts `data-card-action-count="0"` on `/c/prya-blank`
 * with reasoning written entirely about the save button, and quietly turning that 0 into a 1 is a
 * product decision, not a wiring detail. Flagged rather than taken.
 */
export function PublicCardClient({
  resolved,
  token,
}: {
  resolved: ResolvedCard;
  /** The share token from `/c/[slug]` — the only input the connect endpoint needs. */
  token: string;
}): ReactElement {
  const { savePending, downloadVcf } = useVcfDownload();
  // Written once, on first render, and reused by every click.
  const [vcf] = useState(() => (canBuildVcf(resolved) ? buildVcf(resolved) : null));

  return (
    <CardPage
      resolved={resolved}
      actions={
        vcf === null ? null : (
          <PublicCardActions
            resolved={resolved}
            savePending={savePending}
            onSaveToContacts={(card) => downloadVcf(card, vcf)}
            connect={<ConnectSendFlow resolved={resolved} token={token} />}
          />
        )
      }
    />
  );
}
