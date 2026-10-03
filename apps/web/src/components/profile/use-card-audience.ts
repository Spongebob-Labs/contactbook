"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cards as cardsApi } from "@/lib/api/browser";
import { toNotifyTargets, type NotifyTarget } from "@/components/share/notify-recipients";

import type { CardSyncStatus } from "./use-card-field-sync";

/**
 * Who holds the selected card, and who has not been told it changed.
 *
 * ## The server decides who is "behind" — this hook never guesses
 *
 * It would be easy to light the Send update button off a local "the owner just typed something"
 * flag. That flag is wrong in both directions: it fires for an edit the server then ignores (a
 * resubmitted value, a financial value no recipient can see) and misses one made on another
 * device. `GET /cards/{id}/audience` already answers the real question — `versionsBehind` is the
 * card's current version minus the version each recipient was last told about — so that is the
 * only thing the button reads.
 *
 * ## When it re-reads
 *
 * · when the card changes (a different card has a different audience);
 * · whenever the profile is re-read (`profileData` is a fresh object after every write, which is
 *   exactly when a field edit has just landed — see `Workspace`'s `mutate`);
 * · when the card's field selection finishes saving (`syncStatus` reaching `saved`) — that is
 *   `PUT /cards/{id}/fields`, the other thing that moves the version. While it is `pending` or
 *   `saving` the write has not landed, so a read now would report the old version.
 *
 * ## `nudge`
 *
 * A counter that goes up each time the number of versions the audience is behind **grows**
 * (never on the first read, never on a card switch, never when a send shrinks it). The button
 * keys its jitter off it, so one burst of edits is one shake per landed write, not a shake per
 * keystroke and not a shake on page load.
 */

export interface CardAudience {
  /** Every ACTIVE recipient of the card. Empty until the first read, and for a card nobody has. */
  targets: readonly NotifyTarget[];
  /** `true` once a read for THIS card has landed. Before that the button must not claim "up to date". */
  ready: boolean;
  /** Re-read now. For after a send. */
  reload: () => void;
  /** Goes up by one each time more versions become unannounced. Starts at 0. */
  nudge: number;
}

interface Loaded {
  cardId: string;
  targets: readonly NotifyTarget[];
}

/** How far behind the audience is in total: the sum of every recipient's gap. */
export function totalBehind(targets: readonly NotifyTarget[]): number {
  return targets.reduce((sum, target) => sum + Math.max(0, target.versionsBehind ?? 0), 0);
}

export function useCardAudience(
  cardId: string | null,
  profileData: unknown,
  syncStatus: CardSyncStatus,
): CardAudience {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [nudge, setNudge] = useState(0);
  const [tick, setTick] = useState(0);

  /* The newest read wins, and one for a card we have since left must not land. */
  const runId = useRef(0);
  /* The last total we saw *for this card*, so a card switch starts from "unknown", not 0. */
  const seen = useRef<{ cardId: string; total: number } | null>(null);

  useEffect(() => {
    if (cardId === null) return;
    /* A write that is still in flight has not changed the version yet. The status reaching
       `saved` re-runs this effect, which is the read that matters. */
    if (syncStatus === "pending" || syncStatus === "saving") return;

    const ticket = ++runId.current;
    void (async () => {
      try {
        const audience = await cardsApi.audience(cardId);
        if (runId.current !== ticket) return;
        const targets = toNotifyTargets(audience.recipients);
        const total = totalBehind(targets);
        const previous = seen.current;
        if (previous !== null && previous.cardId === cardId && total > previous.total) {
          setNudge((count) => count + 1);
        }
        seen.current = { cardId, total };
        setLoaded({ cardId, targets });
      } catch {
        /* Silent on purpose. The edit has already saved and the owner has been told so; a failed
           follow-up read must not turn that into an error. With no read, the button simply
           stays as it was (or absent), and the Share panel's own list is the fallback. */
      }
    })();
  }, [cardId, profileData, syncStatus, tick]);

  const reload = useCallback(() => setTick((count) => count + 1), []);

  /* Never show another card's recipients while this card's read is in flight. */
  const targets = loaded !== null && loaded.cardId === cardId ? loaded.targets : NONE;
  return { targets, ready: loaded !== null && loaded.cardId === cardId, reload, nudge };
}

const NONE: readonly NotifyTarget[] = [];
