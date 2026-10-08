"use client";

import type { ReactElement } from "react";

import { canBuildVcf } from "@/card/build-vcf";
import { CardPage } from "@/card/card-page";
import { ConnectSendFlow } from "@/components/public-card/connect-send-flow";
import { PublicCardActions } from "@/components/public-card/public-card-actions";
import type { ResolvedCard } from "@/types/domain";

/**
 * The card a stranger sees, and the one thing they can do with it: **"Send to my phone"**.
 *
 * ## Why this is a client component at all
 * `<CardPage>` renders on the server perfectly well. The reason for a client boundary is the
 * action: "Send to my phone" is a POST with request state around it, so the page stays a Server
 * Component (it does the fetch) and only the action tier is hydrated.
 *
 * ## ⚠ There is no "Send to Phone" file download any more
 * This page used to offer a second, black button that wrote a `.vcf` into a blob URL. It is gone
 * (client, 2026-10-08): the scanner types their own number and the card goes to it over WhatsApp,
 * and that is the only path. `buildVcf` and `useVcfDownload` are still in the codebase for the
 * owner's own screens, so the download can come back as a slot in `PublicCardActions`.
 *
 * ## Which connect flow is on the page
 * **"Send to my phone"** (`ConnectSendFlow`, `POST …/connect/send`) — the scanner types a number
 * and the card goes to it over WhatsApp, with no code. It replaced the OTP-verified "Save &
 * connect" (`ConnectFlow`, `…/connect/otp/{request,verify}`) as a product call on 2026-09-23:
 * zero friction over proof of ownership. Only one is ever rendered — offering both would let the
 * same number fail on one path and succeed on the other in the same session. `ConnectFlow` is
 * still in the codebase, so reverting is the one line below.
 *
 * ## ⚠ The zero-field card has no actions at all, connect included
 * The `canBuildVcf` gate below predates connect and suppresses the **whole** action tier, so a
 * card sharing nothing renders no connect action either. That is not an argument that it
 * should not — a scanner connecting to an empty card is arguably the *most* useful case, since
 * the owner can then notify them the moment they map a field. It is preserved deliberately:
 * `public-card.spec.ts`'s E-02/AC-36 test asserts `data-card-action-count="0"` on `/c/prya-blank`,
 * and quietly turning that 0 into a 1 is a product decision, not a wiring detail. Flagged rather
 * than taken.
 */
export function PublicCardClient({
  resolved,
  token,
}: {
  resolved: ResolvedCard;
  /** The share token from `/c/[slug]` — the only input the connect endpoint needs. */
  token: string;
}): ReactElement {
  return (
    <CardPage
      resolved={resolved}
      actions={
        canBuildVcf(resolved) ? (
          <PublicCardActions connect={<ConnectSendFlow resolved={resolved} token={token} />} />
        ) : null
      }
    />
  );
}
