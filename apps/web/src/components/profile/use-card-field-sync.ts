"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cards as cardsApi } from "@/lib/api/browser";
import type { ContactCard, ProfileField } from "@/types/domain";

import { cardFieldPayload } from "./workspace-model";

/**
 * The "on this card" toggles, persisted.
 *
 * ## The rules this hook exists to keep
 *
 * · **The preview never waits.** A toggle changes the desired set synchronously, and the preview
 *   renders from the desired set, so the row appears or leaves in the same frame as the tap.
 * · **One write per burst, not one per tap.** `PUT /cards/{id}/fields` writes a `CardVersion`
 *   whenever the set changes, and a recipient's "behind by N" counts those. Five taps in a row
 *   are one change to the owner, so they go out as one request after {@link SYNC_DELAY_MS}.
 * · **A toggle is never lost.** The desired set is kept for the whole session and only replaced
 *   by the owner. A tap during an in-flight write queues exactly one follow-up write with the
 *   newest set; a failed write keeps the set and offers Retry instead of snapping back; leaving
 *   the screen with a write pending sends it on the way out, and closing the tab asks first.
 * · **The body is always the whole set.** The endpoint replaces rather than patches, so what is
 *   sent is everything the card should carry, filtered to ids the API will accept.
 */

/** Long enough to fold a run of taps into one write, short enough to feel saved. */
export const SYNC_DELAY_MS = 700;

export type CardSyncStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface CardFieldSync {
  /** The set this card should carry — what the preview and the toggles read. */
  fieldIdsFor: (card: ContactCard) => readonly string[];
  toggle: (card: ContactCard, fieldId: string, on: boolean) => void;
  /** Put a field created a moment ago on the card, before the profile read knows about it. */
  tickCreated: (card: ContactCard, fieldId: string) => void;
  statusFor: (cardId: string) => CardSyncStatus;
  retry: (cardId: string) => void;
}

export function useCardFieldSync({
  fields,
  onError,
}: {
  /** The profile as it stands, so the payload can drop ids the API would refuse. */
  fields: readonly ProfileField[];
  onError: (thrown: unknown) => void;
}): CardFieldSync {
  const [desired, setDesired] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [status, setStatus] = useState<Readonly<Record<string, CardSyncStatus>>>({});

  /* Mirrors, because the write is async and must read the newest values, not the render's. */
  const desiredRef = useRef(desired);
  const fieldsRef = useRef(fields);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    fieldsRef.current = fields;
    onErrorRef.current = onError;
  }, [fields, onError]);

  const created = useRef(new Set<string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inflight = useRef(new Set<string>());
  const again = useRef(new Set<string>());

  const mark = useCallback((cardId: string, next: CardSyncStatus) => {
    setStatus((current) => (current[cardId] === next ? current : { ...current, [cardId]: next }));
  }, []);

  const flush = useCallback(
    async (cardId: string): Promise<void> => {
      if (desiredRef.current[cardId] === undefined) return;
      if (inflight.current.has(cardId)) {
        /* One follow-up, carrying whatever the set is by the time this write returns. */
        again.current.add(cardId);
        return;
      }
      inflight.current.add(cardId);
      mark(cardId, "saving");
      try {
        do {
          again.current.delete(cardId);
          const ids = desiredRef.current[cardId] ?? [];
          await cardsApi.setFields(cardId, {
            fields: cardFieldPayload(ids, fieldsRef.current, created.current),
          });
        } while (again.current.has(cardId));
        mark(cardId, "saved");
      } catch (thrown) {
        mark(cardId, "error");
        onErrorRef.current(thrown);
      } finally {
        inflight.current.delete(cardId);
        again.current.delete(cardId);
      }
    },
    [mark],
  );

  const schedule = useCallback(
    (cardId: string) => {
      const pending = timers.current.get(cardId);
      if (pending !== undefined) clearTimeout(pending);
      mark(cardId, "pending");
      timers.current.set(
        cardId,
        setTimeout(() => {
          timers.current.delete(cardId);
          void flush(cardId);
        }, SYNC_DELAY_MS),
      );
    },
    [flush, mark],
  );

  const toggle = useCallback(
    (card: ContactCard, fieldId: string, on: boolean) => {
      const base = desiredRef.current[card.id] ?? card.fieldIds;
      const present = base.includes(fieldId);
      if (on === present) return;
      const next = on ? [...base, fieldId] : base.filter((id) => id !== fieldId);
      desiredRef.current = { ...desiredRef.current, [card.id]: next };
      setDesired(desiredRef.current);
      schedule(card.id);
    },
    [schedule],
  );

  const tickCreated = useCallback(
    (card: ContactCard, fieldId: string) => {
      created.current.add(fieldId);
      toggle(card, fieldId, true);
    },
    [toggle],
  );

  const retry = useCallback((cardId: string) => void flush(cardId), [flush]);

  /* Leaving with a write still waiting on its timer: send it now rather than drop it. */
  useEffect(() => {
    const waiting = timers.current;
    return () => {
      for (const [cardId, timer] of waiting) {
        clearTimeout(timer);
        void flush(cardId);
      }
      waiting.clear();
    };
  }, [flush]);

  /* Closing the tab mid-write asks first. The browser owns the wording. */
  const unsaved = Object.values(status).some((s) => s === "pending" || s === "saving");
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  return {
    fieldIdsFor: (card) => desired[card.id] ?? card.fieldIds,
    toggle,
    tickCreated,
    statusFor: (cardId) => status[cardId] ?? "idle",
    retry,
  };
}
