"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  builderInitialState,
  builderReducer,
  type BuilderAction,
  type BuilderState,
} from "@/components/builder/builder-reducer";
import { cards as cardsApi } from "@/lib/api/browser";
import { supportReference, toScreenError } from "@/lib/api/errors";
import type { ContactCard, ProfileField } from "@/types/domain";

import {
  applyDesign,
  changedDesignKeys,
  designPayload,
  fieldChangeCount,
  sameIds,
  withField,
} from "./card-draft-model";
import { cardFieldPayload } from "./workspace-model";

/**
 * The cards being edited on the Profile & Cards workspace — held as drafts until **Save changes**.
 *
 * Client, 2026-10-07: *"Right now, whenever any of the fields is changed, it is auto-saved. The
 * client doesn't want it auto-saved. He wants a Save Changes button."* This replaces the two
 * debounced writers that used to live here (`useCardFieldSync`, `useCardDesign`): nothing in this
 * hook sends a request except {@link CardDrafts.save}.
 *
 * ## The rules it keeps
 *
 * · **The preview never waits.** An edit changes the draft synchronously and the preview renders
 *   the draft, so the owner sees what they are about to save.
 * · **Dirty is a comparison, not a counter.** A card has unsaved changes when its draft differs
 *   from the last saved card (`changedDesignKeys`, `sameIds`). Add a field and remove it again and
 *   the card is clean.
 * · **A draft is never lost by the screen.** One draft per card, kept until it is saved or the
 *   owner discards it — across tab switches, card switches and re-reads of the profile. A failed
 *   save keeps it, and a partial failure leaves the unsent part unsaved.
 * · **Save is deterministic.** At most two requests, always in this order: `PATCH /cards/{id}`
 *   (name, design, position, bio) and then `PUT /cards/{id}/fields` (the whole set). There is no
 *   single endpoint that takes both; the second is not sent if the first fails.
 *
 * ## "Saved" before the re-read lands
 *
 * After a successful save the workspace re-reads, but until that answer arrives the cards it
 * holds still describe the card as it was. So what a save sent is remembered as the saved card,
 * tagged with the `updatedAt` it was sent against; the first read that carries a different
 * `updatedAt` is the server's word and replaces it. Without this the button would flash back on
 * between the save and the re-read.
 *
 * ⚠ Mount this ABOVE anything keyed on the screen state: a re-read that fails remounts the
 * workspace, and drafts held inside it would be dropped with it.
 */

export type CardSaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | {
      kind: "error";
      title: string;
      detail: string;
      /** The API's request id, for a support reference. `null` when there was no response. */
      requestId: string | null;
      /** Part of the save landed (the card's details) and part did not (its fields). */
      partial: boolean;
    };

export interface CardDrafts {
  /** The builder state the Design panel and the Position & bio rows edit: draft, else saved. */
  designFor: (card: ContactCard) => BuilderState;
  /** The fields this card carries in the draft — what the preview and the ticks read. */
  fieldIdsFor: (card: ContactCard) => readonly string[];
  /** The card wearing the draft's design — what the preview and the switcher read. */
  apply: (card: ContactCard) => ContactCard;
  /** The draft differs from the last saved card. */
  isDirty: (card: ContactCard) => boolean;
  /** How many things differ: one per changed column, one per field added or removed. */
  changeCount: (card: ContactCard) => number;
  saveStateFor: (cardId: string) => CardSaveState;
  dispatchDesign: (card: ContactCard, action: BuilderAction) => void;
  toggleField: (card: ContactCard, fieldId: string, on: boolean) => void;
  /** Put a field created a moment ago on the draft, before the profile read knows about it. */
  tickCreated: (card: ContactCard, fieldId: string) => void;
  /** Back to the last saved card. */
  discard: (card: ContactCard) => void;
  /**
   * Send the draft. Resolves to the card's save state afterwards: `saved` when everything landed,
   * `error` when something did not, `idle` when there was nothing to send, and `saving` when a
   * save for this card was already in flight (this call sent nothing).
   */
  save: (card: ContactCard) => Promise<CardSaveState>;
}

interface Draft {
  design?: BuilderState;
  fieldIds?: readonly string[];
}

/** What the last successful save sent, until a read of the card supersedes it. */
interface SavedOverlay {
  /** The `updatedAt` of the card the save was made against. */
  basedOn: string;
  design?: BuilderState;
  fieldIds?: readonly string[];
}

type Drafts = Readonly<Record<string, Draft>>;
type Overlays = Readonly<Record<string, SavedOverlay>>;

const IDLE: CardSaveState = { kind: "idle" };
const SAVING: CardSaveState = { kind: "saving" };
const SAVED: CardSaveState = { kind: "saved" };

const NAME_REQUIRED: CardSaveState = {
  kind: "error",
  title: "Give the card a name",
  detail: "A card needs a name before it can be saved.",
  requestId: null,
  partial: false,
};

function liveOverlay(overlays: Overlays, card: ContactCard): SavedOverlay | undefined {
  const overlay = overlays[card.id];
  return overlay !== undefined && overlay.basedOn === card.updatedAt ? overlay : undefined;
}

function savedDesign(overlays: Overlays, card: ContactCard): BuilderState {
  return (
    liveOverlay(overlays, card)?.design ??
    builderInitialState({ card, userId: card.userId, seed: [] })
  );
}

function savedFieldIds(overlays: Overlays, card: ContactCard): readonly string[] {
  return liveOverlay(overlays, card)?.fieldIds ?? card.fieldIds;
}

function designDirty(draft: Draft | undefined, saved: BuilderState): boolean {
  return draft?.design !== undefined && changedDesignKeys(draft.design, saved).length > 0;
}

function fieldsDirty(draft: Draft | undefined, saved: readonly string[]): boolean {
  return draft?.fieldIds !== undefined && !sameIds(draft.fieldIds, saved);
}

export function useCardDrafts({
  fields,
}: {
  /** The profile as it stands, so the field set sent drops ids the API would refuse. */
  fields: readonly ProfileField[];
}): CardDrafts {
  const [drafts, setDrafts] = useState<Drafts>({});
  const [overlays, setOverlays] = useState<Overlays>({});
  const [status, setStatus] = useState<Readonly<Record<string, CardSaveState>>>({});

  /* Mirrors, because two edits can land in one event (a look is a palette and a finish) and a
     save is async and must read the newest values rather than the render's. */
  const draftsRef = useRef(drafts);
  const overlaysRef = useRef(overlays);
  const fieldsRef = useRef(fields);
  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  const created = useRef(new Set<string>());
  const inflight = useRef(new Set<string>());

  const mark = useCallback((cardId: string, next: CardSaveState) => {
    setStatus((current) => (current[cardId] === next ? current : { ...current, [cardId]: next }));
  }, []);

  const writeDraft = useCallback(
    (cardId: string, next: Draft) => {
      draftsRef.current = { ...draftsRef.current, [cardId]: next };
      setDrafts(draftsRef.current);
      /* "All changes saved" describes the card as it was saved; an edit makes it untrue. An error
         stays until the next attempt — it is still the answer to the last one. */
      setStatus((current) =>
        current[cardId]?.kind === "saved" ? { ...current, [cardId]: IDLE } : current,
      );
    },
    [],
  );

  const dispatchDesign = useCallback(
    (card: ContactCard, action: BuilderAction) => {
      const draft = draftsRef.current[card.id];
      const base = draft?.design ?? savedDesign(overlaysRef.current, card);
      writeDraft(card.id, { ...draft, design: builderReducer(base, action) });
    },
    [writeDraft],
  );

  const toggleField = useCallback(
    (card: ContactCard, fieldId: string, on: boolean) => {
      const draft = draftsRef.current[card.id];
      const saved = savedFieldIds(overlaysRef.current, card);
      const current = draft?.fieldIds ?? saved;
      const next = withField(current, saved, fieldId, on);
      if (next === current) return;
      writeDraft(card.id, { ...draft, fieldIds: next });
    },
    [writeDraft],
  );

  const tickCreated = useCallback(
    (card: ContactCard, fieldId: string) => {
      created.current.add(fieldId);
      toggleField(card, fieldId, true);
    },
    [toggleField],
  );

  const discard = useCallback(
    (card: ContactCard) => {
      const { [card.id]: _dropped, ...rest } = draftsRef.current;
      void _dropped;
      draftsRef.current = rest;
      setDrafts(rest);
      mark(card.id, IDLE);
    },
    [mark],
  );

  const remember = useCallback((card: ContactCard, part: Omit<SavedOverlay, "basedOn">) => {
    const existing = overlaysRef.current[card.id];
    const base = existing !== undefined && existing.basedOn === card.updatedAt ? existing : undefined;
    overlaysRef.current = {
      ...overlaysRef.current,
      [card.id]: { ...base, ...part, basedOn: card.updatedAt },
    };
    setOverlays(overlaysRef.current);
  }, []);

  const save = useCallback(
    async (card: ContactCard): Promise<CardSaveState> => {
      if (inflight.current.has(card.id)) return SAVING;

      const draft = draftsRef.current[card.id];
      const design = draft?.design;
      const ids = draft?.fieldIds;
      const sendDesign = designDirty(draft, savedDesign(overlaysRef.current, card));
      const sendFields = fieldsDirty(draft, savedFieldIds(overlaysRef.current, card));
      if (!sendDesign && !sendFields) return IDLE;

      if (sendDesign && design !== undefined && design.name.trim() === "") {
        mark(card.id, NAME_REQUIRED);
        return NAME_REQUIRED;
      }

      inflight.current.add(card.id);
      mark(card.id, SAVING);
      let landed = false;
      try {
        if (sendDesign && design !== undefined) {
          await cardsApi.update(card.id, designPayload(design));
          remember(card, { design });
          landed = true;
        }
        if (sendFields && ids !== undefined) {
          const payload = cardFieldPayload(ids, fieldsRef.current, created.current);
          await cardsApi.setFields(card.id, { fields: payload });
          const sent = payload.map((entry) => entry.fieldId);
          remember(card, { fieldIds: sent });
          /* An id the API would have refused was left out of the request, so the saved set is
             what was sent. If the owner has not touched the fields since, the draft follows it —
             otherwise a dropped id would leave the card looking unsaved forever. */
          const now = draftsRef.current[card.id];
          if (now !== undefined && now.fieldIds === ids && !sameIds(ids, sent)) {
            draftsRef.current = { ...draftsRef.current, [card.id]: { ...now, fieldIds: sent } };
            setDrafts(draftsRef.current);
          }
        }
        mark(card.id, SAVED);
        return SAVED;
      } catch (thrown) {
        const shown = toScreenError(thrown);
        const failed: CardSaveState = {
          kind: "error",
          title: shown.title,
          detail: shown.detail,
          requestId: supportReference(thrown),
          partial: landed,
        };
        mark(card.id, failed);
        return failed;
      } finally {
        inflight.current.delete(card.id);
      }
    },
    [mark, remember],
  );

  return {
    designFor: (card) => drafts[card.id]?.design ?? savedDesign(overlays, card),
    fieldIdsFor: (card) => drafts[card.id]?.fieldIds ?? savedFieldIds(overlays, card),
    apply: (card) => {
      const design = drafts[card.id]?.design ?? liveOverlay(overlays, card)?.design;
      return design === undefined ? card : applyDesign(card, design);
    },
    isDirty: (card) => {
      const draft = drafts[card.id];
      return (
        designDirty(draft, savedDesign(overlays, card)) ||
        fieldsDirty(draft, savedFieldIds(overlays, card))
      );
    },
    changeCount: (card) => {
      const draft = drafts[card.id];
      if (draft === undefined) return 0;
      const designChanges =
        draft.design === undefined
          ? 0
          : changedDesignKeys(draft.design, savedDesign(overlays, card)).length;
      const fieldChanges =
        draft.fieldIds === undefined
          ? 0
          : fieldChangeCount(draft.fieldIds, savedFieldIds(overlays, card));
      return designChanges + fieldChanges;
    },
    saveStateFor: (cardId) => status[cardId] ?? IDLE,
    dispatchDesign,
    toggleField,
    tickCreated,
    discard,
    save,
  };
}
