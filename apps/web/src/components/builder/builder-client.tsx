"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
  type ReactElement,
} from "react";

import { canBuildVcf } from "@/card/build-vcf";
import { resolveCard } from "@/card/resolve-card";
import { seedFieldIds } from "@/card/template-seed";
import { TEMPLATE_LIST } from "@/card/templates";
import { ErrorPanel, ScreenStateRoot, resolveDataScreenState } from "@/components/data";
import { SplitView } from "@/components/layout";
import { useToast } from "@/components/overlay";
import {
  NotifyRecipients,
  toNotifyTargets,
  type NotifyTarget,
} from "@/components/share/notify-recipients";
import { cn } from "@/lib/cn";
import { cards as cardsApi, profile as profileApi } from "@/lib/api/browser";
import { fetchCardDetail, fetchProfileData } from "@/lib/api/browser-loaders";
import { toScreenError } from "@/lib/api/errors";
import { toAppearanceDto } from "@/lib/api/card-appearance";
import { toCardFieldEntries, toApiCardKind } from "@/lib/api/map";
import { useApiResource } from "@/lib/use-api";
import type {
  ContactCard,
  FieldGroup,
  ProfileField,
  ResolvedCard,
  User,
} from "@/types/domain";

import { BuilderHeader } from "./builder-header";
import {
  BUILDER_SECTIONS,
  BuilderNav,
  useBuilderSection,
  type BuilderSectionId,
} from "./builder-nav";
import { BuilderPreview } from "./builder-preview";
import { BuilderSkeleton } from "./builder-skeleton";
import { DesignPanel } from "./design-panel";
import { DroppedFieldsNotice } from "./dropped-fields-notice";
import { EmptyCardWarning } from "./empty-card-warning";
import type { CreatedField, FieldDraft } from "./field-sources";
import { FieldPicker } from "./field-picker";
import { PanelHead } from "./panel-head";
import {
  applyFieldValues,
  builderCard,
  builderInitialState,
  builderProfileEdits,
  builderReducer,
  type BuilderState,
} from "./builder-reducer";

/**
 * The card builder — `/cards/new` and `/cards/[cardId]/edit` (spec §8D.4, §4.4, plan T23).
 *
 * **This is the core loop of the product, and it is designed against four recorded failures of
 * the old build.** Each one is answered by something structural rather than by a convention:
 *
 * | Old failure | What answers it here |
 * |---|---|
 * | A card with 0 mappings shipped and produced a 73-byte name-only `.vcf` | the meter in the header, the persistent `EmptyCardWarning`, and Save gated on `canBuildVcf` — while the preview keeps rendering, so the consequence is visible |
 * | Step 2 embedded a 12-row profile editor, so one screen had two competing commits | exactly one commit affordance. "Add a field" is a `<Link>` to `/profile`; there is no editor here and the only text input on the screen is the card's name |
 * | Step 3 taught a template choice and threw it away on Create | `templateId` and `paletteId` are reducer state, they go onto the card `builderCard` returns, and the pinned preview shows them from the first frame |
 * | The share dialog previewed nothing, so the previewed file could differ from the sent file | **one** `resolveCard` call, below, and every consumer takes that reference (I-5) |
 *
 * ## ⚠ The one architectural rule — invariant I-5
 *
 * `resolveCard` is called **once**, in `resolved`. The previewed card page, the field-count meter
 * and the Save gate all receive that same reference. `resolveCard` returns a
 * fresh object every call, so identity has to be *carried* — a second call anywhere below would
 * produce an object whose values match today and diverge the moment the two derivations
 * disagree, which is exactly the old build's "previewed file differs from sent file" bug.
 *
 * **There is no longer an exception.** `PalettePicker` used to be one — nine cells, each a
 * `resolveCard` of this card in another colour — and it is gone with the ShareFace thumbnails
 * it drew (see `background-picker.tsx` for why the colour axis stopped being nine live wallet
 * passes). Every cell in the Design panel now paints from `resolved.palette`, which is *this*
 * resolution, so the count of `resolveCard` calls on this screen is exactly one again.
 *
 * ## The shape: a section rail, one panel, and the phone beside it
 *
 * The screen is an **editor**, and it now looks like one: a narrow rail of sections, a single
 * rounded panel of controls next to it, and the live card in a phone in the right-hand column.
 * The three things that make that read as composed rather than as a pile are worth naming,
 * because each one is a thing that was on the screen and is not any more:
 *
 *   · **One panel, not one box per control.** The sections are separated by their own space and
 *     by a hairline inside a single surface, so the eye crosses one edge instead of six.
 *   · **One heading per decision.** Header layout had an `<h3>` under Design's `<h2>` under the
 *     section's own prose; it is the Layout section now and wears exactly one heading.
 *   · **The preview is on the right**, where the result of an edit belongs, with DOM order still
 *     preview-first so a phone still puts it under the header. `SplitView` does that with
 *     `order` alone.
 *
 * ## ⚠ The rail is a navigator and the controls are still one scrolling column
 *
 * This is the part most likely to be "tidied" into a tab set later, so it is stated here as
 * well as at the head of `builder-nav.tsx`: **every section is mounted at all times.** The rail
 * scrolls; it does not gate. A panel that exists only while its rail item is selected is
 * §8D.4's last recorded failure — an anchor into it is an anchor into nothing three-quarters of
 * the time — and it also breaks the judgement this screen is for, which needs the fields and
 * the colour visible together.
 *
 * ## The controls are one scrolling column, and that is a decision
 *
 * They were a Radix tab set — Template / Fields / Colour — and tabs were the wrong container for
 * exactly two controls that get used **together**. Picking a colour is a judgement about whether
 * a name and a number read on that ground, and the fields are what put a name and a number
 * there; a container whose whole job is to show one and hide the other makes that judgement
 * require a round trip, and the round trip loses the scroll position of whichever panel you
 * left. So: **Fields, Design, Layout, stacked, all live at once**, each under an `<h2>` and
 * behind a `data-builder-section` hook. There is no tab state left to be wrong about, and no
 * panel that exists only while it is selected — which was §8D.4's last recorded failure.
 *
 * ## Colour is Design's first control; header layout is its own section
 *
 * The card's look is four axes (`@/card/card-surface`), and they split two ways rather than
 * four. **Design** carries the three that answer one question — the ground colour, the wallpaper
 * style and the pattern — with colour first, because **the nine presets and the colour input are
 * the same choice** and two boxes offering one decision would have to invent a precedence rule
 * the owner never saw; `design-panel.tsx` has the full argument.
 *
 * **Layout** carries the fourth on its own, because it answers a different question: not *what
 * colour* but *how much of it do you see*. Four `<h3>`s down one box gave no clue which of them
 * were the same decision, and that was the single biggest source of the clutter this shape
 * replaces.
 *
 * The reducer still owns all four axes, `builderCard` still puts them on the card, and the card
 * is resolved once — so both panels are live for the same structural reason the field list is.
 *
 * ## The template picker is gone; the template plumbing is NOT
 *
 * `template-picker.tsx` is deleted. `templateId`, `TEMPLATES`, `template-seed.ts` and the
 * reducer's `template` action all stay, with every rule they carry intact — the palette
 * stickiness and the never-re-seed-an-existing-card guard included, still covered by
 * `tests/unit/builder-reducer.test.ts`. A new card is still seeded from `TEMPLATE_LIST[0]`
 * below; nothing in this UI dispatches a template change any more, and a future picker can be
 * dropped back in as a third section without touching the model.
 *
 * ## There is no wizard, no "apply", no step
 *
 * Every control writes into the reducer and the preview re-renders. That is the whole
 * interaction model, and it is why the reducer has its own test file: it *is* the behaviour.
 */

/**
 * ⚠ `CATEGORY_FOR_QUICK_TYPE` lived here and is DELETED.
 *
 * It mapped a `FieldType` to the category a field would be filed under — every `PHONE` to
 * `PERSONAL`, every `URL` to `WORK` — because the composer only asked for a type. That guess was
 * wrong often enough to matter: a work mobile landed in the card's PERSONAL section and the only
 * way to move it was a trip to `/profile`.
 *
 * The composer asks for the category first now (`field-catalogue.ts`), so the draft carries it
 * and there is nothing left to infer. Do not reintroduce a fallback here: a draft with no
 * category is a composer bug, and defaulting it would hide that bug behind a plausible wrong
 * answer — which is exactly what this table did.
 */

/* ── the data this screen renders ─────────────────────────────────────────────────────── */

/** The profile the builder picks from. The card itself arrives separately, resolved server-side. */
export interface BuilderData {
  user: User;
  groups: FieldGroup[];
  fields: ProfileField[];
}

/**
 * `?state=empty` — §11 E-08 on this screen: **there is nothing to pick from.**
 *
 * Deliberately not "this card maps nothing" — that is `canBuildVcf`'s job, announced by the
 * warning bar, and a card that shares nothing on a healthy profile is a card with a problem
 * rather than a screen with one.
 */
export function emptyBuilderData(real: BuilderData): BuilderData {
  return { ...real, groups: real.groups.map((g) => ({ ...g, fieldIds: [] })), fields: [] };
}

export interface BuilderClientProps {
  /**
   * The card being edited, or `null` on `/cards/new`.
   *
   * Resolved on the server, so an unknown id reaches the not-found boundary rather than a
   * client-side empty state (§11 E-36).
   */
  /** The card id being edited, or `null` on `/cards/new` where Save creates. */
  cardId: string | null;
}

export function BuilderClient({ cardId }: BuilderClientProps): ReactElement {
  const router = useRouter();

  // One read either way: a new card needs only the profile to seed from; an existing one needs
  // the card too. Both are visible requests through `/api/cb/*`.
  const load = useCallback(async (): Promise<{ data: BuilderData; card: ContactCard | null }> => {
    if (cardId === null) {
      const profile = await fetchProfileData();
      return { data: profile, card: null };
    }
    const loaded = await fetchCardDetail(cardId)();
    if (loaded === null) {
      return { data: await fetchProfileData(), card: null };
    }
    return {
      data: { user: loaded.user, groups: loaded.groups, fields: loaded.fields },
      card: loaded.card,
    };
  }, [cardId]);

  const result = useApiResource(load, (real) => ({
    ...real,
    data: emptyBuilderData(real.data),
  }));

  const state = result.state;
  const data = result.data?.data ?? null;
  /* The cover, position and bio arrive on the card itself now — `toContactCard` reads all three
     off `CardResponseDto`, and `initialBuilderState` seeds from them. The `withLocalCardDraft`
     merge that used to stand here is gone with the `localStorage` shim it read from. */
  const card = result.data?.card ?? null;
  const error = result.error;

  /**
   * The profile is empty — §11 E-08, reached by `?state=empty`. It is what "empty" means on
   * *this* screen: there is nothing to pick from. It is deliberately **not** "this card maps
   * nothing" — that is `canBuildVcf`'s job, announced by the warning bar, and a card that
   * shares nothing on a healthy profile is a card with a problem, not a screen with one.
   */
  const screenState = resolveDataScreenState({
    state,
    isEmpty: data !== null && data.fields.length === 0,
  });

  if (screenState === "loading") {
    return (
      <ScreenStateRoot state="loading" className="flex flex-col gap-8 pb-16">
        <BuilderSkeleton />
      </ScreenStateRoot>
    );
  }

  /* `data` is `null` on exactly three gateway states — loading, error and offline — and
     loading returned above. The `data === null` arm is therefore unreachable in practice and
     is kept as the type narrowing that lets everything below take a non-null database. */
  if (screenState === "error" || screenState === "offline" || data === null) {
    return (
      <ScreenStateRoot state={data === null && screenState === "success" ? "error" : screenState} className="py-12">
        <ErrorPanel
          error={error}
          headingLevel={1}
          onRetry={() => {
            router.refresh();
          }}
          homeHref="/cards"
          homeLabel="Go to cards"
        />
      </ScreenStateRoot>
    );
  }

  /**
   * Keyed on the gateway state so the reducer re-initialises when the `?state=` switch selects
   * a different world.
   *
   * `?state=` is not a filter over one dataset — it swaps the whole database, so a new card
   * seeded from the full profile makes no sense against the empty one and vice versa. Carrying
   * edits across that boundary would preserve them against a profile that no longer contains
   * the fields they refer to.
   */
  return (
    <Builder
      key={`${screenState}:${card?.id ?? "new"}`}
      card={card}
      db={data}
      reload={result.reload}
      screenState={screenState === "empty" ? "empty" : "success"}
    />
  );
}

function Builder({
  card,
  db,
  reload,
  screenState,
}: {
  card: ContactCard | null;
  db: BuilderData;
  /**
   * Re-run this screen's own read.
   *
   * ⚠ Not `router.refresh()`. The profile arrives through `useApiResource` — a client fetch — and
   * a router refresh re-renders the server tree without re-running it, so a field created mid-build
   * would be ticked in the reducer while `db.fields` still had no row for it: on the card, and
   * invisible in the panel. This is the only call that actually brings it back.
   */
  reload: () => void;
  /* No filter or search on this screen, so `empty-filtered` is unreachable here. */
  screenState: "success" | "empty";
}): ReactElement {
  const { toast } = useToast();
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [creatingField, setCreatingField] = useState(false);
  /**
   * A logo upload or remove is in flight.
   *
   * Its own flag rather than `saving`, because these are not saves: on a card that exists they
   * are complete writes of their own, and folding them into the Save transition would put the
   * header's Save button into a loading state for a request Save did not make and cannot undo.
   */
  const [logoBusy, setLogoBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);

  /**
   * ⚠ THE POST-SAVE NOTIFY PROMPT — the client's change of 2026-09-03.
   *
   * The old flow put a "Notify recipients" button in the card-detail header. An owner edited a
   * card here, saved, went back, and had to *notice* that button and press it; missing that
   * step is the entire problem it was supposed to solve. So the prompt is now the consequence
   * of pressing Save, at the one moment the owner knows what they changed.
   *
   * ⚠ It is a PROMPT, not an automatic send, and that distinction is load-bearing. The
   * `contactbook-card-notifications` guide is explicit that nothing in this system ever
   * notifies on its own — *"an owner can make ten edits in a row and nothing goes out until
   * they deliberately choose to notify someone."* Opening a picker the owner can cancel keeps
   * that promise; wiring the save's own response to a send would break it, and would break the
   * marketing page's central claim ("You press send. Nothing here runs on its own.") with it.
   *
   * `null` means "no prompt pending". A non-empty array means the dialog is open with those
   * recipients in it.
   */
  const [notifyTargets, setNotifyTargets] = useState<readonly NotifyTarget[] | null>(null);
  /** Which panel the rail is showing, and the `?panel=` record of it. See `builder-nav.tsx`. */
  const { section, setSection } = useBuilderSection();
  /**
   * That section's own entry, for the head above the panels.
   *
   * ⚠ The fallback is not defensive noise: `useBuilderSection` parses `?panel=` and already
   * falls back to Fields on nonsense, but `find` is typed as possibly-undefined and a `!` here
   * would be a claim about a *different* module's behaviour asserted in this one.
   */
  const activeSection =
    BUILDER_SECTIONS.find((def) => def.id === section) ?? BUILDER_SECTIONS[0];

  const [state, dispatch] = useReducer(
    builderReducer,
    {
      card,
      userId: db.user.id,
      /* A new card opens on the default template's preset, resolved against this profile. An
         existing card is never seeded — see the reducer's note on why a preset is only ever an
         opening offer. */
      seed: card === null ? seedFieldIds(TEMPLATE_LIST[0].id, db.groups, db.fields) : [],
    },
    builderInitialState,
  );

  /** The card the state describes. One object, memoised, so `resolved` below is stable. */
  const draft = useMemo(() => builderCard(state), [state]);

  /**
   * ⚠ THE ONE RESOLUTION (I-5). Nothing below re-derives it.
   *
   * ## ⚠ The material system is on `draft` and does not survive this call yet
   *
   * `builderCard` puts all four axes of `CardSurface` on the card, and `<CardPage>` reads them —
   * off `resolved.surface`, and it derives its whole composition from them. What is missing is
   * the middle: **`resolveCard` neither copies the card's `CardSurface` onto the `ResolvedCard`
   * nor calls `derivePalette` when the card carries a `groundHex`.** Until it does, the panel's
   * controls are live in the model and inert in the pane.
   *
   * **It is not fixed here, and that is a decision rather than an ownership technicality.** A
   * palette derived in this file would paint the builder's preview from one derivation and
   * `/c/{slug}` — which resolves the same card through the same function without passing through
   * here — from another. That is the "previewed file differs from the sent file" defect, exactly,
   * and I-5 exists to make it unreachable. The honest state is that *neither* surface is live,
   * so the two cannot disagree; the wire belongs in `resolveCard`, once, for both.
   *
   * `tests/e2e/builder.spec.ts` pins that with a `test.fail` — an assertion that is correct,
   * runs, and is expected to fail — so the day the resolver carries the surface, the suite says
   * "expected to fail but passed" instead of quietly staying green about a feature nobody
   * finished.
   */
  /**
   * ⚠ **The profile, with this session's value edits laid over it — derived ONCE and handed to
   * both the resolver and the Fields list.**
   *
   * I-5 says the builder resolves its card exactly once so the pane and the panel cannot
   * disagree. The same argument applies to the fields underneath it: two `applyFieldValues`
   * calls would be two arrays, and the day one of them was passed the raw `db.fields` the owner
   * would be typing into a row whose value the card beside it does not show.
   */
  const fields = useMemo(
    () => applyFieldValues(db.fields, state.fieldValues),
    [db.fields, state.fieldValues],
  );

  const resolved = useMemo(
    () => resolveCard(draft, db.user, db.groups, fields),
    [draft, db.user, db.groups, fields],
  );

  /**
   * Create a profile field and put it on this card, in one submit.
   *
   * ## Two calls, and the order is not arbitrary
   * 1. `POST /profile/fields` — the field has to exist in the profile first, because a card holds
   *    *references*. §5.3: a card is a filter over the profile, never a copy, so there is no such
   *    thing as a field that lives only on a card.
   * 2. `PUT /cards/{id}/fields` — the full set plus the new id. A replace, so everything already
   *    ticked goes with it.
   *
   * ⚠ If the second call fails the field still exists in the profile, unattached. That is not
   * rolled back deliberately: there is no transaction across two endpoints, and deleting a field
   * the owner just authored to tidy up a partial failure is the more destructive answer. It shows
   * up in the picker on the next read, ready to tick.
   *
   * On `/cards/new` there is no id to attach to yet, so only step 1 runs and the reducer holds the
   * tick until **Create card** does the pair. `createAndAddField` still reports success, because
   * from the owner's side the field *was* created and *is* on the card.
   */
  async function createAndAddField(draft: FieldDraft): Promise<CreatedField | null> {
    setCreatingField(true);
    try {
      /* ⚠ The owner's own choice, straight through. See the note where the guess table used
         to be for why nothing derives this any more. */
      const category = draft.category;
      const created = await profileApi.createField({
        // Ungrouped: a field authored mid-build belongs to no particular job or account, and the
        // profile's own grouping is where that decision is made.
        category,
        type: draft.type,
        label: draft.label,
        value: draft.value,
      });

      dispatch({ kind: "field", fieldId: created.id, on: true });

      if (state.cardId !== null) {
        await cardsApi.setFields(state.cardId, {
          fields: toCardFieldEntries([...state.fieldIds, created.id]),
        });
      }

      toast({
        title: `Added ${created.label}`,
        description: "Saved to your profile and this card.",
      });
      /* ⚠ `reload`, not `router.refresh()`. See the prop's own note: this screen's profile is a
         client fetch, and a router refresh would leave the new field ticked with no row to tick —
         which is precisely the "I added it and nothing happened" the dialog exists to avoid. */
      reload();
      return { fieldId: created.id, category };
    } catch (thrown) {
      const shown = toScreenError(thrown);
      toast({ title: shown.title, description: shown.detail, tone: "danger" });
      // `null`, not a throw: the dialog reads this as "keep the draft, stay open", and the owner
      // has already been told what went wrong.
      return null;
    } finally {
      setCreatingField(false);
    }
  }

  /* ── the logo ──────────────────────────────────────────────────────────────────────── */

  /**
   * Every object URL this session has minted, so they can all be released.
   *
   * ## ⚠ Why a ref and not just a revoke at the call site
   *
   * `URL.createObjectURL` pins the file in memory until it is revoked, and the obvious place to
   * revoke — right after dispatching the next one — is wrong twice over. React has not painted
   * the new `src` yet when the handler returns, so revoking the old URL there can blank the
   * preview for a frame; and it does nothing at all for the last URL, which is still live when
   * the owner navigates away without saving.
   *
   * So every URL is remembered and all of them are released on unmount. The set is at most a
   * handful of entries — one per time the owner re-picked a file on one unsaved card — and
   * holding a revoked URL in it is harmless.
   */
  const objectUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
      objectUrls.current = [];
    },
    [],
  );

  /**
   * The owner picked a logo.
   *
   * ⚠ **Two paths, and which one runs is decided by whether the card exists** — not by anything
   * the owner did differently:
   *
   * · **A card that exists** uploads now. It has to: `logoUrl` is rejected as a plain string by
   *   `PATCH /cards/{id}`, so there is no way to carry a logo on the Save that commits
   *   everything else. A file is either uploaded or it is nowhere.
   * · **`/cards/new`** has no id to address, so the file is held on the reducer and goes out as
   *   the `file` part of the multipart `POST /cards`. The preview shows it immediately either
   *   way, from the object URL.
   *
   * The pick is shown **before** either path runs, so the card wears the new mark while the
   * upload is in flight rather than only after it — and on an unsaved card, where there is no
   * request at all, that dispatch is the whole of the work. `logo-saved` is what later swaps the
   * object URL for the server's own, or puts the previous one back if the upload failed.
   */
  function pickLogo(file: File) {
    const previewUrl = URL.createObjectURL(file);
    objectUrls.current.push(previewUrl);

    /* Unconditional: the preview is the half both paths share, and the only half `/cards/new`
       has. `dirty` is scoped to the unsaved card inside the reducer rather than here, so this
       call does not have to know which path it is starting. */
    dispatch({ kind: "logo-pending", file, previewUrl });

    const cardId = state.cardId;
    if (cardId === null) return;

    /* The value to fall back to if the upload fails. Read before the request and not inside the
       catch: by then `state` may be a later render's, and `logo-pending` above deliberately did
       not touch `logoUrl`, so this is still the last thing the server confirmed. */
    const previous = state.logoUrl;

    setLogoBusy(true);
    void (async () => {
      try {
        /* Returns the whole card, so the URL comes from the API rather than being guessed. No
           remove-first: `POST .../logo` replaces atomically, and a remove that succeeded before
           an upload that failed would leave the card bare. */
        const updated = await cardsApi.uploadLogo(cardId, file);
        dispatch({ kind: "logo-saved", logoUrl: updated.logoUrl ?? null });
        toast({ title: "Logo updated" });
        /* The card list and the card's own screen both render this mark from a server read. */
        router.refresh();
      } catch (thrown) {
        const shown = toScreenError(thrown);
        toast({ title: shown.title, description: shown.detail, tone: "danger" });
        /* ⚠ Put the card back on the logo the server still has. Leaving the optimistic preview
           up would be the card claiming a logo that is not on it — and the owner would carry on,
           share it, and find the old mark on the page a recipient opens. */
        dispatch({ kind: "logo-saved", logoUrl: previous });
      } finally {
        setLogoBusy(false);
      }
    })();
  }

  /**
   * Remove the logo.
   *
   * On an unsaved card there is nothing to call: the file has never left the browser, so
   * dropping the pending pair *is* the removal. On a card that exists, `DELETE .../logo` is the
   * whole operation and the same undo-on-failure rule applies.
   */
  function removeLogo() {
    const cardId = state.cardId;
    if (cardId === null) {
      dispatch({ kind: "logo-pending", file: null, previewUrl: null });
      return;
    }

    const previous = state.logoUrl;
    dispatch({ kind: "logo-saved", logoUrl: null });

    setLogoBusy(true);
    void (async () => {
      try {
        await cardsApi.removeLogo(cardId);
        toast({ title: "Logo removed" });
        router.refresh();
      } catch (thrown) {
        const shown = toScreenError(thrown);
        toast({ title: shown.title, description: shown.detail, tone: "danger" });
        dispatch({ kind: "logo-saved", logoUrl: previous });
      } finally {
        setLogoBusy(false);
      }
    })();
  }

  /**
   * The owner applied a crop.
   *
   * ⚠ **Two paths, decided by whether the card exists** — the same split `pickLogo` makes, and
   * for a related but stricter reason. A logo can at least ride the multipart `POST /cards`; a
   * cover cannot ride anything. `PATCH /cards/{id}` rejects an actual `coverUrl` string
   * outright, and the create takes no cover part, so `POST /cards/{id}/cover` is the **only**
   * door and it needs an id.
   *
   * · **A card that exists** uploads now.
   * · **`/cards/new`** holds the composed file on the reducer and `onSave` uploads it in the
   *   step straight after the create returns an id.
   *
   * The preview updates before either path runs, from the composed data URL, so the card wears
   * the new photograph while the request is in flight rather than only after it.
   *
   * ⚠ `file` is the **composed** crop, not the file the owner picked off disk — the API stores
   * exactly the bytes it is sent and performs no crop of its own. See `cover-picker.tsx`.
   */
  function pickCover(file: File, previewUrl: string) {
    dispatch({ kind: "cover-pending", file, previewUrl });

    const cardId = state.cardId;
    if (cardId === null) return;

    /* Read before the request, not inside the catch: by then `state` may be a later render's,
       and `cover-pending` deliberately did not touch `coverUrl`, so this is still the last
       thing the server confirmed. */
    const previous = state.coverUrl;

    setCoverBusy(true);
    void (async () => {
      try {
        /* Returns the whole card, so the URL comes from the API rather than being guessed. No
           remove-first: `POST .../cover` replaces atomically, and a remove that succeeded
           before an upload that failed would leave the hero bare. */
        const updated = await cardsApi.uploadCover(cardId, file);
        dispatch({ kind: "cover-saved", coverUrl: updated.coverUrl ?? null });
        toast({ title: "Cover updated" });
        router.refresh();
      } catch (thrown) {
        const shown = toScreenError(thrown);
        toast({ title: shown.title, description: shown.detail, tone: "danger" });
        /* ⚠ Put the card back on the cover the server still has. Leaving the optimistic preview
           up would be the card claiming a photograph that is not on it — and the owner would
           share it and find the old one on the page a recipient opens. */
        dispatch({ kind: "cover-saved", coverUrl: previous });
      } finally {
        setCoverBusy(false);
      }
    })();
  }

  /**
   * Remove the cover.
   *
   * On an unsaved card there is nothing to call — the bytes have never left the browser, so
   * dropping the pending pair *is* the removal. On a card that exists, `DELETE .../cover` is the
   * whole operation. (`PATCH` with `coverUrl: null` is documented as identical; the dedicated
   * route is used because it says what it does, and because Save must never send that key —
   * a blind `coverUrl: null` on every Save would delete the cover on every rename.)
   */
  function removeCover() {
    const cardId = state.cardId;
    if (cardId === null) {
      dispatch({ kind: "cover-pending", file: null, previewUrl: null });
      return;
    }

    const previous = state.coverUrl;
    dispatch({ kind: "cover-saved", coverUrl: null });

    setCoverBusy(true);
    void (async () => {
      try {
        await cardsApi.removeCover(cardId);
        toast({ title: "Cover removed" });
        router.refresh();
      } catch (thrown) {
        const shown = toScreenError(thrown);
        toast({ title: shown.title, description: shown.detail, tone: "danger" });
        dispatch({ kind: "cover-saved", coverUrl: previous });
      } finally {
        setCoverBusy(false);
      }
    })();
  }

  /**
   * Tick or untick one field — **and persist it immediately.**
   *
   * ⚠ `PUT /cards/{id}/fields` **replaces** the whole curated set, so what goes out is the complete
   * list after the change, not the one field that moved. Sending only the delta would silently
   * strip everything else off the card.
   *
   * The next state is computed by running the reducer *before* dispatching, because `state` here is
   * the render-time value and would still be the old one. That is also what makes the request
   * correct on a rapid double-tick: each call sends a full set derived from the state it saw.
   *
   * On `/cards/new` there is no card to write to yet — `state.cardId` is `null` — so the change
   * stays local until **Create card** does the `POST` + `PUT` pair. That is not a gap: there is no
   * id to address until the card exists.
   */
  function toggleField(fieldId: string, on: boolean) {
    const next = builderReducer(state, { kind: "field", fieldId, on });
    dispatch({ kind: "field", fieldId, on });

    const cardId = state.cardId;
    if (cardId === null) return;

    startSaving(async () => {
      try {
        await cardsApi.setFields(cardId, { fields: toCardFieldEntries(next.fieldIds) });
      } catch (thrown) {
        const shown = toScreenError(thrown);
        toast({ title: shown.title, description: shown.detail, tone: "danger" });
        // Put the tick back where the server says it is, rather than leaving the UI claiming a
        // change that did not land.
        dispatch({ kind: "field", fieldId, on: !on });
      }
    });
  }

  /**
   * Save.
   *
   * ⚠ **Two writes, one button, and the toast has to say so.** A field *value* belongs to the
   * profile, not to this card (§5.3), so saving edits it for every card that maps it. Reporting
   * only the card would understate what the owner just did — which is why `saveCardAction`
   * returns the count and this reads it back rather than guessing from local state.
   *
   * ⚠ **Appearance is persisted, and every axis is sent on every write.** `templateId`,
   * `paletteId`, `groundHex` and the four surface axes now have columns, and `toAppearanceDto`
   * sends all seven — `null` included. That last part is not padding: `PATCH` leaves an omitted
   * column alone, so omitting "the owner cleared their custom colour" would be indistinguishable
   * from "the owner did not touch it", and the cleared colour would return on the next read.
   * Sending `null` is how a choice is unmade.
   *
   * A new card is two requests — create, then set fields — because `POST /cards` starts empty.
   * On success it navigates to the real card, which is also what replaces the `null` cardId.
   */
  function onSave() {
    const labels = new Map(db.fields.map((field) => [field.id, field.label]));
    const values = Object.entries(builderProfileEdits(state))
      // A value edited for a field that is no longer mapped is dropped: the owner removed the
      // row, so writing its value would be a change they cannot see.
      .filter(([fieldId]) => state.fieldIds.includes(fieldId))
      .map(([fieldId, value]) => ({
        fieldId,
        label: labels.get(fieldId) ?? "",
        value,
      }))
      .filter((edit) => edit.label.length > 0);

    const shares = resolved.fieldCount === 1 ? "1 field" : `${resolved.fieldCount} fields`;

    startSaving(async () => {
      try {
        if (state.cardId === null) {
          // Two calls, because `POST /cards` starts a card with no fields — there is no way to
          // create a populated one in a single request.
          const created = await cardsApi.create(
            {
              name: state.name.trim(),
              kind: toApiCardKind(state.cardType),
              // The design the owner has been looking at in the preview, from the same state the
              // preview renders from — so a card is created wearing what they built.
              ...toAppearanceDto(state),
              /* ⚠ **Empty becomes `null`, not `""`.** `""` is a value the column would store and
                 every reader would then have to re-trim; `null` is the one spelling of "not set"
                 the renderers already collapse the slot for. `coverUrl` is deliberately absent —
                 the create takes no cover, and it is uploaded below once there is an id. */
              headline: state.headline.trim() === "" ? null : state.headline.trim(),
              bio: state.bio.trim() === "" ? null : state.bio.trim(),
            },
            /**
             * ⚠ **The logo rides the create, and that is the only way it can.**
             *
             * `POST /cards` is `multipart/form-data` precisely so a card can be born wearing its
             * mark. The alternative — create, then `POST .../logo` — has no transaction across
             * it, so a failed second call leaves behind a card the owner can see wearing nothing
             * they chose. Here a logo that fails takes the whole create with it: nothing is
             * written, the catch below reports it, and the owner is still on `/cards/new` with
             * their file still picked.
             *
             * `?? undefined` because the reducer's "no pending file" is `null` and the client's
             * "send no file part" is an absent argument.
             */
            state.logoFile ?? undefined,
          );
          if (state.fieldIds.length > 0) {
            await cardsApi.setFields(created.id, {
              fields: toCardFieldEntries(state.fieldIds),
            });
          }
          /* ⚠ **The cover is a second request, always** — unlike the logo, which rides the
             multipart create. `POST /cards` has no cover part and `PATCH` rejects a URL string,
             so `POST /cards/{id}/cover` is the only door and this is the first moment there is
             an id to address. `headline` and `bio` already went out on the create above.

             A failure here is reported but does not fail the save: the card exists, it is
             wearing everything else the owner chose, and destroying it to tidy up a cover would
             lose real work. The owner lands on a real card and can retry the cover from the
             panel — which is exactly the state `pickCover`'s existing-card path handles. */
          if (state.coverFile !== null) {
            try {
              const withCover = await cardsApi.uploadCover(created.id, state.coverFile);
              dispatch({ kind: "cover-saved", coverUrl: withCover.coverUrl ?? null });
            } catch (thrown) {
              const shown = toScreenError(thrown);
              toast({ title: shown.title, description: shown.detail, tone: "danger" });
            }
          }
          dispatch({ kind: "save" });
          /* ⚠ Swap the object URL for the server's own, now that there is one. Without this the
             preview keeps rendering from a `blob:` URL that is revoked on unmount and means
             nothing on any other screen — and `state.logoFile` would still be set, so a second
             Save would upload the same file again. */
          dispatch({ kind: "logo-saved", logoUrl: created.logoUrl ?? null });
          toast({ title: "Card created", description: `"${state.name}" shares ${shares}.` });
          // Leaves `/cards/new` for the card that now exists, so a second Save updates rather
          // than creating a duplicate.
          router.push(`/cards/${created.id}`);
          return;
        }

        await cardsApi.update(state.cardId, {
          name: state.name.trim(),
          kind: toApiCardKind(state.cardType),
          ...toAppearanceDto(state),
          /* Cleared becomes `null`, which is how a PATCH unmakes a choice — an omitted key would
             leave the old position or bio in place and the owner would watch their deletion come
             back on the next read.

             ⚠ **`coverUrl` is deliberately NOT here**, and this is the one field that must never
             be added to a blanket save. `PATCH` accepts exactly one value for it — `null` — so
             sending it unconditionally would delete the owner's cover every time they renamed
             the card. The cover is written by its own upload, and removed by its own DELETE. */
          headline: state.headline.trim() === "" ? null : state.headline.trim(),
          bio: state.bio.trim() === "" ? null : state.bio.trim(),
        });
        // ⚠ Replaces the whole set — everything to keep is sent, not just what changed.
        await cardsApi.setFields(state.cardId, { fields: toCardFieldEntries(state.fieldIds) });

        // Sequential: these are writes to the same profile, and a burst of parallel PATCHes
        // against one row ordering is a race nobody needs for a handful of fields.
        for (const edit of values) {
          await profileApi.updateField(edit.fieldId, { label: edit.label, value: edit.value });
        }

        /* No cover write here: on a card that exists the crop uploaded the moment it was
           applied (`pickCover`), so by now the server already holds it and `state.coverFile` is
           null. Save commits the text and the design; the photograph is not Save's to carry. */
        dispatch({ kind: "save" });
        const edited = values.length;
        toast({
          title: "Card saved",
          description:
            edited === 0
              ? `"${state.name}" shares ${shares}.`
              : `"${state.name}" shares ${shares}. ${edited === 1 ? "1 value was" : `${edited} values were`} updated in your profile, on every card using ${edited === 1 ? "it" : "them"}.`,
        });
        router.refresh();

        /*
          ⚠ AND THEN OFFER TO TELL THE RECIPIENTS. Read the ⚠ on `notifyTargets` first.

          Ordered after the save, never in parallel: the audience's `versionsBehind` is computed
          against the card's CURRENT version, so asking before the write lands reports everyone
          as caught up and the prompt never appears.

          `audience` alone is enough to build the picker's rows — that is what `toNotifyTargets`
          is for, and why this costs one request rather than the three `fetchCardDetail` makes.

          A failure here is swallowed on purpose. The card is already saved and the owner has
          been told so; turning a missing follow-up read into an error toast would report a
          successful save as a failure. The banner on the card screen is the recovery path.
        */
        try {
          const audience = await cardsApi.audience(state.cardId);
          const targets = toNotifyTargets(audience.recipients);
          /* No recipients, or everyone already caught up, means nothing to ask about — the same
             rule the banner follows. An empty prompt is worse than no prompt. */
          if (targets.some((t) => (t.versionsBehind ?? 0) > 0)) setNotifyTargets(targets);
        } catch {
          /* Deliberately silent — see above. */
        }
      } catch (thrown) {
        const shown = toScreenError(thrown);
        toast({ title: shown.title, description: shown.detail, tone: "danger" });
      }
    });
  }

  return (
    <ScreenStateRoot
      state={screenState}
      as="section"
      aria-label={state.cardId === null ? "New card" : "Edit card"}
      data-builder=""
      className="flex flex-col gap-4 pb-8"
    >
      <BuilderHeader
        resolved={resolved}
        name={state.name}
        cardId={state.cardId}
        dirty={state.dirty}
        saving={saving}
        onSave={onSave}
      />

      {/* ⚠ `trigger={null}` — there is no button. This dialog is opened by Save and by nothing
          else; a visible trigger here would be the very control the client asked us to remove,
          moved one screen over. It is mounted only while a prompt is pending, so the picker
          starts from a fresh "everyone selected" state each time. */}
      {notifyTargets === null || state.cardId === null ? null : (
        <NotifyRecipients
          cardId={state.cardId}
          shares={notifyTargets}
          trigger={null}
          open
          onOpenChange={(next) => {
            if (!next) setNotifyTargets(null);
          }}
          onChanged={() => {
            setNotifyTargets(null);
            reload();
          }}
        />
      )}

      {/* Both notices sit directly under the header — the part of this screen that always
          exists — rather than in the bottom status bar §8D.4 sketches. A bar pinned to the
          bottom of a phone viewport lands under the app's own bottom navigation, and a
          persistent warning that has to be scrolled to is not persistent. */}
      <EmptyCardOrDropped
        resolved={resolved}
        onAddFields={() => {
          /* ⚠ Switches panels and stops. It used to also open the Add-field dialog, which no
             longer exists — the profile's fields and the create form are permanently on the
             Fields panel now, so arriving there IS the whole action. */
          setSection("fields");
        }}
      />

      <SplitView
        pinned={<BuilderPreview resolved={resolved} />}
        pinnedLabel="Card preview"
        contentLabel="Card controls"
        /* ⚠ **The preview is the right column, and the DOM order did not move with it.**
           An editor puts the thing you are changing under your hand and the result of the
           change beside it; left-to-right that is controls-then-card. `SplitView` does it with
           `order` precisely so reading order can stay preview-first: on a phone there is no
           left and right, the card is what must be under the header, and DOM order decides
           that. One property, two correct layouts. */
        pinnedSide="right"
        /* ⚠ **A fixed right column, not a ratio, and the number comes off the object in it.**
           `SplitView`'s 54/46 split is written for a pane whose content is fluid. This one's is
           not: the preview is a 352px device and a caption, so a percentage handed it a wide
           empty gutter and took that width off the controls — which is what made the colour
           grid five ~80px cells and printed "Periwink…" for Periwinkle. Everything past 400px
           goes to the panel, which is the pane that has more to show at a wider viewport. */
        /* ⚠ The row gap is 16px on a phone and `SplitView`'s own 32px from `lg` up.
           Below `lg` this "gap" is the space between a preview PINNED to the top of the
           viewport and the section rail directly beneath it — not a gutter between two
           independent panes. 32px of blank canvas there reads as a gap in the layout rather
           than as breathing room, and it is 32px taken from the ~220px the control panel gets
           on a short phone. The preview's own bottom hairline (see `pinnedClassName`) is what
           separates the two now, so the space does not have to. */
        className="gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6"
        /**
         * The mobile pane, from the one token that owns this number.
         *
         * ⚠ **A definite `h-`, not a `max-h-`, and the preview inside it is `h-full`.** Both
         * halves matter. It was `max-h-[50svh]` here against `h-[58svh]` in
         * `builder-preview.tsx`, and because this pane clips, the 8svh difference was cut off
         * rather than reported — 65px on a 375×812 phone, which took the bottom of the card and
         * the entire "name · palette" caption with it. Two files each declaring the height of
         * the same box is the whole bug; `--builder-preview-h` in `tokens.css` is now the only
         * place it is written, and this pane is the only consumer that sets it.
         *
         * 38svh capped at 300px rather than 50svh: half a phone viewport spent on a preview
         * left the controls 342px on an 812px screen and 146px on a 640px one, and the controls
         * are what the reader is using. AC-29 still holds — the preview is on screen without
         * scrolling at every viewport — it simply stops being the larger half.
         *
         * `pb-3` and the hairline are what make it read as a pinned layer rather than as
         * content that happens to be at the top: without an edge, the card's bottom sits
         * directly against the section rail scrolling underneath it.
         */
        pinnedClassName={cn(
          "h-[var(--builder-preview-h)] max-h-[var(--builder-preview-h)] pb-3",
          "border-b border-line",
          "lg:h-auto lg:max-h-[calc(100svh-var(--space-16))] lg:border-b-0 lg:pb-0",
        )}
      >
        {/* ── the rail and the panel ────────────────────────────────────────────
            ⚠ **One `Tabs.Root`, and it owns the only piece of view state on this screen.**
            Radix requires the list and the panels to share a root; the root is here because
            this is the component that has both. See `builder-nav.tsx` for why these are tabs
            now and how `?panel=` keeps every panel addressable — the property the previous
            scrolling column was built to protect. */}
        <TabsPrimitive.Root
          value={section}
          onValueChange={(value) => setSection(value as BuilderSectionId)}
          /* Binds Up/Down to the rail instead of Left/Right. On a phone the list is a row and
             the axis is wrong by one — an acceptable trade for one keyboard convention, and
             the alternative is a `useMediaQuery` deciding an ARIA property, which renders one
             orientation on the server and possibly the other on the client. */
          orientation="vertical"
          activationMode="automatic"
          className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-5"
        >
          <BuilderNav />

          {/* ⚠ **The panel scrolls, not the page** — at `lg`, where there is a viewport to
              measure against. This is the other half of the fix for "so much scrolling
              happening": with the rail pinned, the card pinned and the page itself static, the
              only thing that moves is the one column you are reading. Below `lg` it is an
              ordinary block and the document scrolls, because a nested scroller inside a phone
              viewport is a scroll trap. */}
          <div
            data-builder-panel-surface=""
            className={cn(
              "min-w-0 flex-1 rounded-xl border border-line bg-canvas",
              "shadow-[var(--elevation-1)]",
              /* A flex column so the head above the panels owns a gap rather than every
                 panel's first child needing a margin. */
              "flex flex-col gap-5",
              "p-5 sm:p-6",
              "lg:sticky lg:top-6 lg:max-h-[calc(100svh-9.5rem)] lg:overflow-y-auto lg:p-7",
            )}
          >
            {/**
             * ⚠ **THE HEAD IS ABOVE THE PANELS, NOT INSIDE EACH ONE — AND IT IS THE CARD'S NAME.**
             *
             * Two decisions in one element, and both were forced by something that went wrong.
             *
             * · **The title is the card's name** (client, 2026-09-07: *"make the title of the
             *   card more prominent — perhaps where 'Fields' is, we can put the title of the
             *   card"*). It used to print the section — a heading repeating the word already
             *   highlighted in the rail beside it — while the name sat in a toolbar input that
             *   the client's own screenshots show nobody used.
             * · **⚠ Rendered ONCE, and the reason is focus rather than tidiness.** The name is
             *   the same on both tabs, so it is not a tab's content. A head inside each
             *   `Tabs.Content` is a different element per tab, and Radix renders an inactive
             *   panel's children as `present && children` — so switching tab would unmount this
             *   input and mount another: caret, selection and focus gone, mid-rename, for a
             *   value that did not change. Hoisting it also makes "exactly one
             *   `[data-builder-name]` on the screen" a property of this layout rather than of
             *   Radix's mounting rules, which a later `forceMount` would quietly break.
             *
             * The intro still belongs to the section, so it is read off the *active* one.
             */}
            <PanelHead
              section={activeSection.label}
              name={state.name}
              onRename={(name) => dispatch({ kind: "rename", name })}
              intro={activeSection.intro}
            />

            {BUILDER_SECTIONS.map((def) => (
              <TabsPrimitive.Content
                key={def.id}
                value={def.id}
                /* ⚠ The hook the e2e suite counts and orders by. It is on the panel rather
                   than on a wrapper so that "how many sections does this screen have" and
                   "how many panels does this tab set have" are the same question. */
                data-builder-section={def.id}
                className="flex flex-col gap-6 outline-none"
              >
                {def.id !== "fields" ? null : (
                  /* ⚠ No `title`/`intro` any more: the panel's head is rendered once above
                     this map, so the picker is the list and nothing else. */
                  <FieldPicker
                    groups={db.groups}
                    fields={fields}
                    selected={state.fieldIds}
                    onToggle={(fieldId, on) => toggleField(fieldId, on)}
                    onCreateField={createAndAddField}
                    creatingField={creatingField}
                    onEditValue={(fieldId, value) => dispatch({ kind: "value", fieldId, value })}
                  />
                )}

                {def.id !== "design" ? null : (
                  <DesignPanel
                    /* ⚠ Off `draft`, not off `state`. `builderCard` is what decides a pending
                       file's preview beats a stored URL, and reading `state.logoUrl` here would
                       give the panel a different answer than the card beside it — the thumbnail
                       would stay empty on `/cards/new` while the preview showed the logo. */
                    logoUrl={draft.logoUrl ?? null}
                    logoBusy={logoBusy}
                    onPickLogo={pickLogo}
                    onRemoveLogo={removeLogo}
                    paletteId={state.paletteId}
                    groundHex={state.groundHex}
                    finish={state.finish}
                    texture={state.texture}
                    texturePresence={state.texturePresence}
                    textureScale={state.textureScale}
                    /* ⚠ I-5: the palette off the one resolution, never a second lookup.
                       Curated when the card is on a preset, derived when the owner picked
                       their own colour — either way it is the palette the card in the pane is
                       wearing, so the panel's cells and the preview cannot disagree about the
                       colour of the same card. */
                    palette={resolved.palette}
                    onPreset={(paletteId) => dispatch({ kind: "palette", paletteId })}
                    /* ⚠ Two dispatches rather than a new `look` reducer action.
                       They are the two transitions the reducer already defines, and `palette`
                       carries the load-bearing half — it unsets `groundHex`, so picking a look
                       cannot leave a custom colour rendering behind a ticked cell. React batches
                       both into one render, so the preview never shows the intermediate state.
                       A dedicated action would add a third way to write the same two columns. */
                    /* The composed crop while one is pending, else the URL the server holds —
                       the same precedence `builderCard` applies, so the panel's thumbnail and
                       the preview pane cannot show two different covers. */
                    coverUrl={state.coverPreviewUrl ?? state.coverUrl}
                    coverBusy={coverBusy}
                    onCover={(picked) => {
                      if (picked === null) removeCover();
                      else pickCover(picked.file, picked.previewUrl);
                    }}
                    headline={state.headline}
                    onHeadline={(headline) => dispatch({ kind: "headline", headline })}
                    bio={state.bio}
                    onBio={(bio) => dispatch({ kind: "bio", bio })}
                    onLook={(look) => {
                      dispatch({ kind: "palette", paletteId: look.paletteId });
                      dispatch({ kind: "finish", finish: look.finish });
                    }}
                    onGround={(hex) => dispatch({ kind: "ground", hex })}
                    onFinish={(finish) => dispatch({ kind: "finish", finish })}
                    onTexture={(texture) => dispatch({ kind: "texture", texture })}
                    onPresence={(texturePresence) => dispatch({ kind: "presence", texturePresence })}
                    onScale={(textureScale) => dispatch({ kind: "scale", textureScale })}
                  />
                )}

              </TabsPrimitive.Content>
            ))}
          </div>
        </TabsPrimitive.Root>
      </SplitView>
    </ScreenStateRoot>
  );
}

/**
 * The two notices, in one place so their order is fixed.
 *
 * §11 E-40 first, then §11 E-01: "five fields were removed from your profile" is the *cause*
 * of an empty card, and reading the cause before the consequence is the only order that makes
 * sense of it.
 */
function EmptyCardOrDropped({
  resolved,
  onAddFields,
}: {
  resolved: ResolvedCard;
  onAddFields: () => void;
}): ReactElement | null {
  const dropped =
    resolved.droppedFieldIds.length === 0 ? null : (
      <DroppedFieldsNotice droppedFieldIds={resolved.droppedFieldIds} />
    );

  /* `canBuildVcf` — T11's single definition of "this card shares nothing" — and never a local
     count. `fieldCount` includes social links, so a card mapping three profiles and nothing
     else is perfectly good; a `resolved.fields.length === 0` here would warn on it, and the
     meter beside it would not. One definition, three readers. */
  const empty = canBuildVcf(resolved) ? null : <EmptyCardWarning onAddFields={onAddFields} />;

  if (dropped === null && empty === null) return null;

  return (
    <div className="flex flex-col gap-3">
      {dropped}
      {empty}
    </div>
  );
}

export type { BuilderState };
