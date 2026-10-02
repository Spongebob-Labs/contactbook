"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  builderInitialState,
  builderReducer,
  type BuilderAction,
  type BuilderState,
} from "@/components/builder/builder-reducer";
import { cards as cardsApi } from "@/lib/api/browser";
import { toAppearanceDto } from "@/lib/api/card-appearance";
import type { UpdateCardDto } from "@/lib/api/schema";
import type { ContactCard } from "@/types/domain";

import type { CardSyncStatus } from "./use-card-field-sync";

/**
 * A card's design edits on the Profile & Cards workspace — the Design panel, and the Position
 * and Bio rows at the top of the Fields panel — persisted as they are made.
 *
 * The builder commits a design with its Save button. The workspace has no Save — every field
 * toggle on it already writes itself — so a design edit writes itself too, with the same rules
 * `useCardFieldSync` keeps:
 *
 * · **The preview never waits.** An edit changes the draft synchronously and the preview renders
 *   the draft, so a colour lands on the card in the same frame as the tap.
 * · **One write per burst.** `PATCH /cards/{id}` versions the card, and a recipient's "behind by
 *   N" counts versions. Dragging through five colours or typing a bio is one change to the owner,
 *   so it goes out once, {@link DESIGN_SYNC_DELAY_MS} after the last edit.
 * · **An edit is never lost.** A failed write keeps the draft and offers Retry; an edit during an
 *   in-flight write queues one follow-up with the newest draft; leaving sends what is waiting.
 *
 * The transitions are the builder's own reducer, so "a preset clears a custom colour" and every
 * other rule of the Design panel means the same thing on both screens.
 *
 * ⚠ **Only the PATCH-able axes live in the draft.** The logo and the cover are uploads with their
 * own endpoints; the workspace writes them directly and re-reads, so a draft never carries a stale
 * copy of either. And `coverUrl` is never in the body — `PATCH` accepts only `null` for it, so a
 * blanket send would delete the cover.
 */

/** A little longer than the field toggles': a bio is typed, not tapped. */
export const DESIGN_SYNC_DELAY_MS = 900;

export interface CardDesign {
  /** The builder state for this card — the current draft, or the card as the server has it. */
  stateFor: (card: ContactCard) => BuilderState;
  /** The card wearing this session's design edits — what the preview and the switcher read. */
  apply: (card: ContactCard) => ContactCard;
  dispatch: (card: ContactCard, action: BuilderAction) => void;
  statusFor: (cardId: string) => CardSyncStatus;
  retry: (cardId: string) => void;
}

/** The body for `PATCH /cards/{id}`: the name, the seven design axes, the position and the bio. */
export function designPayload(state: BuilderState): UpdateCardDto {
  const name = state.name.trim();
  const headline = state.headline.trim();
  const bio = state.bio.trim();
  return {
    /* An emptied name is a title being retyped, not a card called "". The API would refuse it. */
    ...(name === "" ? {} : { name }),
    ...toAppearanceDto(state),
    headline: headline === "" ? null : headline,
    bio: bio === "" ? null : bio,
  };
}

/** The draft's design axes laid over the server's card. Fields, logo and cover are untouched. */
export function applyDesign(card: ContactCard, draft: BuilderState): ContactCard {
  /* Dropped, then re-added only when set — the builder's own shape, so `resolveCard` can tell
     "no choice" from "this value". */
  const { groundHex: _ground, headline: _headline, bio: _bio, ...rest } = card;
  void _ground;
  void _headline;
  void _bio;
  return {
    ...rest,
    name: draft.name,
    templateId: draft.templateId,
    paletteId: draft.paletteId,
    ...(draft.groundHex === undefined ? {} : { groundHex: draft.groundHex }),
    finish: draft.finish,
    texture: draft.texture,
    texturePresence: draft.texturePresence,
    textureScale: draft.textureScale,
    ...(draft.headline.trim() === "" ? {} : { headline: draft.headline }),
    ...(draft.bio.trim() === "" ? {} : { bio: draft.bio }),
  };
}

export function useCardDesign({
  onError,
}: {
  onError: (thrown: unknown) => void;
}): CardDesign {
  const [drafts, setDrafts] = useState<Readonly<Record<string, BuilderState>>>({});
  const [status, setStatus] = useState<Readonly<Record<string, CardSyncStatus>>>({});

  /* Mirrors, because the write is async and must send the newest draft, not the render's. */
  const draftsRef = useRef(drafts);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inflight = useRef(new Set<string>());
  const again = useRef(new Set<string>());

  const mark = useCallback((cardId: string, next: CardSyncStatus) => {
    setStatus((current) => (current[cardId] === next ? current : { ...current, [cardId]: next }));
  }, []);

  const flush = useCallback(
    async (cardId: string): Promise<void> => {
      if (draftsRef.current[cardId] === undefined) return;
      if (inflight.current.has(cardId)) {
        again.current.add(cardId);
        return;
      }
      inflight.current.add(cardId);
      mark(cardId, "saving");
      try {
        do {
          again.current.delete(cardId);
          const draft = draftsRef.current[cardId];
          if (draft !== undefined) await cardsApi.update(cardId, designPayload(draft));
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
        }, DESIGN_SYNC_DELAY_MS),
      );
    },
    [flush, mark],
  );

  const seed = useCallback(
    (card: ContactCard): BuilderState =>
      draftsRef.current[card.id] ?? builderInitialState({ card, userId: card.userId, seed: [] }),
    [],
  );

  const dispatch = useCallback(
    (card: ContactCard, action: BuilderAction) => {
      const next = builderReducer(seed(card), action);
      draftsRef.current = { ...draftsRef.current, [card.id]: next };
      setDrafts(draftsRef.current);
      schedule(card.id);
    },
    [schedule, seed],
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
    stateFor: (card) =>
      drafts[card.id] ?? builderInitialState({ card, userId: card.userId, seed: [] }),
    apply: (card) => {
      const draft = drafts[card.id];
      return draft === undefined ? card : applyDesign(card, draft);
    },
    dispatch,
    statusFor: (cardId) => status[cardId] ?? "idle",
    retry,
  };
}
