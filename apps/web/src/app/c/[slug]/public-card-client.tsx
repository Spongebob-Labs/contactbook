"use client";

import { useState, type ReactElement } from "react";

import { buildVcf, canBuildVcf } from "@/card/build-vcf";
import { CardPage } from "@/card/card-page";
import { PublicCardActions } from "@/components/public-card/public-card-actions";
import { useVcfDownload } from "@/components/share/share-sheet";
import type { ResolvedCard } from "@/types/domain";

/**
 * The card a stranger sees, and the two things they can do with it.
 *
 * ## Why this is a client component at all
 * `<CardPage>` renders on the server perfectly well — the reason for a client boundary is
 * **Save to contacts**, which writes a `.vcf` into a blob URL and clicks a synthetic anchor. That
 * needs a browser. So the page stays a Server Component (it does the fetch), and only the action
 * tier is hydrated.
 *
 * ## The vCard is written once
 * `buildVcf` runs here and the result is handed to the download — never rebuilt at the moment of
 * the click. That is §6.4's rule: the card on screen and the file that leaves the page are
 * produced from one derivation, so they cannot disagree.
 *
 * `canBuildVcf` gates it: a card that shares nothing has **no** download control rather than one
 * that refuses. `buildVcf` throws `EmptyCardError` in that case instead of writing the old build's
 * 73-byte name-only file (§11 E-01/E-02).
 */
export function PublicCardClient({ resolved }: { resolved: ResolvedCard }): ReactElement {
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
          />
        )
      }
    />
  );
}
