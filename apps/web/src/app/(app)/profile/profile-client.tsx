"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useSearchParams } from "next/navigation";
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

import { heroBio, splitHeroFields } from "@/card/card-page-rows";
import { resolveCard } from "@/card/resolve-card";
import { builderInitialState, type BuilderAction } from "@/components/builder/builder-reducer";
import { DesignPanel } from "@/components/builder/design-panel";
import { PanelHead } from "@/components/builder/panel-head";
import { type ChildEntry } from "@/components/builder/field-suggestions";
import {
  ErrorPanel,
  ScreenStateRoot,
  resolveDataScreenState,
} from "@/components/data";
import { PageHeader, SplitView } from "@/components/layout";
import { useToast } from "@/components/overlay";
import { Skeleton } from "@/components/primitives/skeleton";
import type { NewFieldDraft } from "@/components/profile/add-field-dialog";
import { isAlwaysMasked } from "@/components/profile/field-types";
import { IdentityBlock } from "@/components/profile/identity-block";
import { SendUpdateButton } from "@/components/profile/send-update-button";
import { useCardAudience } from "@/components/profile/use-card-audience";
import { useCardDesign } from "@/components/profile/use-card-design";
import { useCardFieldSync, type CardSyncStatus } from "@/components/profile/use-card-field-sync";
import type { RowCardToggle } from "@/components/profile/workspace-field-row";
import {
  carryOverFieldIds,
  groupIdForCreate,
  isLocalFieldId,
  workGroupTag,
  workspaceSections,
  type FamilyEntry,
} from "@/components/profile/workspace-model";
import { WorkspaceCardIntro } from "@/components/profile/workspace-card-intro";
import { WorkspacePreview } from "@/components/profile/workspace-preview";
import { WorkspaceSection, type NewFieldInput } from "@/components/profile/workspace-section";
import { WorkspaceSharePanel } from "@/components/profile/workspace-share-panel";
import {
  WorkspaceTabList,
  useWorkspacePanel,
  type WorkspacePanelId,
} from "@/components/profile/workspace-tabs";
import { cards as cardsApi, profile as api } from "@/lib/api/browser";
import { fetchCardsData } from "@/lib/api/browser-loaders";
import { toAppearanceDto } from "@/lib/api/card-appearance";
import { toScreenError } from "@/lib/api/errors";
import { isSyntheticGroupId, syntheticGroupId, toApiCardKind, toContactCard } from "@/lib/api/map";
import type { ApiFieldCategory } from "@/lib/api/schema";
import { cn } from "@/lib/cn";
import { useApiResource } from "@/lib/use-api";
import type {
  ContactCard,
  FieldCategory,
  FieldGroup,
  FixtureError,
  ProfileField,
  ResolvedCard,
  ScreenState,
  User,
} from "@/types/domain";

/**
 * `/profile` — **Profile & Cards**, one workspace.
 *
 * Client, 2026-09-28: *"Profile and Cards feel like duplicate, disconnected sections; merge them.
 * Left side acts as profile/field builder, right side shows the card being built live. Fields
 * already saved carry over to new cards automatically."*
 *
 * ## The shape
 *
 * `SplitView`, the builder's own geometry: three panels on the left — **Fields, Design, Share** —
 * and on the right a card switcher over the live `<BuilderPreview>` of the selected card. Every
 * filled row carries a switch for "on this card"; flipping it changes the preview in the same
 * frame and is written with `PUT /cards/{id}/fields` a moment later (`useCardFieldSync`).
 *
 * ⚠ **Design and Share are panels here, not links away** (client, 2026-09-30: *"There should be
 * no redirection"*). They used to open `/cards/{id}/edit?panel=design` and `/cards/{id}`. Now the
 * Design panel edits the selected card in place and writes itself (`useCardDesign`, the builder's
 * own reducer), and the Share panel sends, links and lists recipients for it. The card on the
 * right never moves. The open panel is `?panel=`, recorded the same way as `?card=`.
 *
 * ## The rules it keeps
 *
 * · **The selected card is in the URL** as `?card=`, written with `history.replaceState`. A Next
 *   navigation would re-run the route and remount the workspace, dropping a half-typed edit.
 * · **Blank rows are client-side only.** The API rejects an empty value, so a suggestion is drawn
 *   until a field answers it and the field is created on the first non-empty save.
 * · **A new card starts with every filled-in field on it** (`carryOverFieldIds`): create, then
 *   one `PUT` with the lot. The two calls are not atomic; if the second fails the card exists
 *   empty and the owner can switch fields on by hand.
 * · **A field added here goes onto the selected card too**, so the preview answers the edit.
 * · **The draft is an echo.** Every write is shown locally, sent, and then the profile is
 *   re-read, which replaces the echo with what the server stored — or removes it if the write
 *   was refused.
 * · `coverUrl` is never sent from here, and `phoneE164` is never an input.
 */

/* ── The data this screen renders ─────────────────────────────────────────────────────── */

export interface ProfileData {
  user: User;
  groups: FieldGroup[];
  fields: ProfileField[];
}

/** The profile plus the cards that filter it. */
export interface WorkspaceData extends ProfileData {
  cards: ContactCard[];
}

/**
 * §11 E-08: an empty profile is **the groups, with no fields** — not zero groups.
 */
export function emptyProfileData(real: ProfileData): ProfileData {
  return {
    user: real.user,
    groups: real.groups.map((group) => ({ ...group, fieldIds: [] })),
    fields: [],
  };
}

/** `?state=empty` on the workspace: the cards stay, the profile has nothing in it. */
export function emptyWorkspaceData(real: WorkspaceData): WorkspaceData {
  return { ...emptyProfileData(real), cards: real.cards };
}

/* ── The local echo ───────────────────────────────────────────────────────────────────── */

export interface ProfileDraft {
  /** `null` on the states that carry no data (`loading`, `error`, `offline`). */
  user: User | null;
  groups: FieldGroup[];
  fields: ProfileField[];
  /**
   * Monotonic, so a locally-added field gets a stable id without `crypto.randomUUID()`.
   *
   * ⚠ These ids are **local only** and must never reach the API. `reseed` replaces them with
   * the server's real ids as soon as the refresh lands.
   */
  nextLocalId: number;
}

export type ProfileDraftAction =
  | { kind: "reseed"; data: ProfileData | null }
  | { kind: "edit-field"; fieldId: string; label: string; value: string }
  | { kind: "toggle-sensitive"; fieldId: string; isSensitive: boolean }
  | { kind: "add-field"; groupId: string; draft: NewFieldDraft }
  | { kind: "delete-field"; fieldId: string }
  | { kind: "move-field"; groupId: string; fieldId: string; direction: -1 | 1 }
  | { kind: "rename-group"; groupId: string; name: string }
  /** Adds a group to echo into when the profile has none of that category yet. */
  | { kind: "ensure-group"; group: FieldGroup };

export function initProfileDraft(data: ProfileData | null): ProfileDraft {
  if (data === null) return { user: null, groups: [], fields: [], nextLocalId: 1 };
  return {
    user: data.user,
    groups: data.groups.map((group) => ({ ...group, fieldIds: [...group.fieldIds] })),
    fields: [...data.fields],
    nextLocalId: 1,
  };
}

/**
 * `FieldGroup.fieldIds` is the ordering authority, not the `fields` array — which is why
 * reordering touches the group and never the field list.
 */
function moveWithin(ids: readonly string[], fieldId: string, direction: -1 | 1): string[] {
  const index = ids.indexOf(fieldId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= ids.length) return [...ids];

  const next = [...ids];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

export function profileDraftReducer(
  state: ProfileDraft,
  action: ProfileDraftAction,
): ProfileDraft {
  switch (action.kind) {
    case "reseed":
      // The server has spoken. Local ids and local edits are both discarded, deliberately:
      // whatever the API now reports is the truth, including a rejected change reverting.
      return initProfileDraft(action.data);

    case "edit-field":
      return {
        ...state,
        fields: state.fields.map((field) =>
          field.id === action.fieldId
            ? { ...field, label: action.label, value: action.value }
            : field,
        ),
      };

    case "toggle-sensitive":
      return {
        ...state,
        fields: state.fields.map((field) =>
          field.id === action.fieldId ? { ...field, isSensitive: action.isSensitive } : field,
        ),
      };

    case "add-field": {
      const id = `field_local_${state.nextLocalId}`;
      const field: ProfileField = {
        id,
        groupId: action.groupId,
        type: action.draft.type,
        label: action.draft.label,
        value: action.draft.value,
        isSensitive: action.draft.isSensitive,
      };
      return {
        ...state,
        fields: [...state.fields, field],
        groups: state.groups.map((group) =>
          group.id === action.groupId
            ? { ...group, fieldIds: [...group.fieldIds, id] }
            : group,
        ),
        nextLocalId: state.nextLocalId + 1,
      };
    }

    case "delete-field":
      // §11 E-40 is the other half of this: a card whose `fieldIds` still names a deleted field
      // must drop it into `droppedFieldIds` rather than render a ghost row.
      return {
        ...state,
        fields: state.fields.filter((field) => field.id !== action.fieldId),
        groups: state.groups.map((group) => ({
          ...group,
          fieldIds: group.fieldIds.filter((id) => id !== action.fieldId),
        })),
      };

    case "move-field":
      return {
        ...state,
        groups: state.groups.map((group) =>
          group.id === action.groupId
            ? { ...group, fieldIds: moveWithin(group.fieldIds, action.fieldId, action.direction) }
            : group,
        ),
      };

    case "rename-group":
      return {
        ...state,
        groups: state.groups.map((group) =>
          group.id === action.groupId ? { ...group, name: action.name } : group,
        ),
      };

    case "ensure-group":
      return state.groups.some((group) => group.id === action.group.id)
        ? state
        : { ...state, groups: [...state.groups, { ...action.group, fieldIds: [] }] };
  }
}

/** The fields a group holds, in the group's own order. Dangling ids are dropped, not faked. */
export function fieldsOfGroup(
  draft: Pick<ProfileDraft, "fields">,
  group: Pick<FieldGroup, "fieldIds">,
): ProfileField[] {
  const byId = new Map(draft.fields.map((field) => [field.id, field]));
  const ordered: ProfileField[] = [];
  for (const id of group.fieldIds) {
    const field = byId.get(id);
    if (field !== undefined) ordered.push(field);
  }
  return ordered;
}

/** A card, reduced to what the §11 E-41 blast-radius line needs. */
export interface CardUsage {
  name: string;
  fieldIds: readonly string[];
}

/** Card names that map a given field — the E-41 blast radius, in the owner's words. */
export function cardNamesUsing(cards: readonly CardUsage[], fieldId: string): string[] {
  return cards.filter((card) => card.fieldIds.includes(fieldId)).map((card) => card.name);
}

/**
 * The whole profile's field ids, in display order.
 *
 * `position` is global rather than per-group upstream, so a move inside one section has to be
 * sent as the complete order — see `reorderFieldsAction`.
 */
export function globalFieldOrder(draft: Pick<ProfileDraft, "groups" | "fields">): string[] {
  const ids: string[] = [];
  for (const group of draft.groups) {
    for (const id of group.fieldIds) ids.push(id);
  }
  return ids;
}

/** Why the sensitive switch cannot move. Read by the group editor. */
export const SENSITIVE_READ_ONLY_REASON =
  "Set by the field's type. Payment details are always masked.";

/* ── The screen ───────────────────────────────────────────────────────────────────────── */

/** `?card=` — which card the preview shows. */
export const CARD_PARAM = "card";

/** The workspace split: fields fluid on the left, the preview column on the right. */
const SPLIT_CLASS = cn(
  /* `grid-cols-1` is `minmax(0, 1fr)`: without it the phone's single implicit column sizes to
     the card row's full width and pushes the whole preview off the right edge. */
  "grid-cols-1 gap-3",
  "lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-8",
);

/**
 * The bio the card page actually prints. `resolveCard` may compose "{role} at {company}", and the
 * page drops that when it only repeats the two lines above it — so the Bio row asks the page's own
 * rule, or it would claim a bio the card beside it is not showing.
 */
function printedBio(resolved: ResolvedCard): string | null {
  const hero = splitHeroFields(resolved.fields, resolved.bio);
  return heroBio(resolved.bio, resolved.headline, hero.org);
}

/** The disclosure key for the Fields panel's Position & bio section. */
const CARD_INTRO_SECTION = "card-intro";

/**
 * The two field labels a family member's `FAMILY` group holds: a `RELATION` "Name" and a `DATE`
 * "Birthday". The skill prescribes exactly this shape, and the group's `tag` carries the person.
 */
const CHILD_NAME_LABEL = "Name";
const CHILD_BIRTHDAY_LABEL = "Birthday";

/** The one surface every panel sits on, so switching tab never moves the frame. */
const PANEL_SURFACE =
  "flex flex-col rounded-xl border border-line bg-canvas shadow-[var(--elevation-1)]";

/** A logo or cover chosen in this session, ahead of the re-read that confirms it. */
interface CardMedia {
  logoUrl?: string | null;
  coverUrl?: string | null;
}

const NO_MEDIA: Readonly<Record<string, CardMedia>> = {};

/** What the one status line says when two writers are saving the same card. */
const STATUS_RANK: Record<CardSyncStatus, number> = {
  idle: 0,
  saved: 1,
  pending: 2,
  saving: 3,
  error: 4,
};

export function worstStatus(a: CardSyncStatus, b: CardSyncStatus): CardSyncStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

/** Design and Share need a card. With none yet, say where the one control that makes one is. */
function NoCardYet({ action }: { action: "design" | "share" }): ReactElement {
  return (
    <div data-workspace-no-card="" className={cn(PANEL_SURFACE, "items-start gap-2 p-6 sm:p-8")}>
      <h2 className="text-h3 text-ink">No card yet</h2>
      <p className="max-w-[48ch] text-sm text-ink-3">
        {action === "design"
          ? "Create a card with New card, then choose how it looks here."
          : "Create a card with New card, then send it from here."}
      </p>
    </div>
  );
}

/** Layout-matched bones for `page.tsx`'s `<Suspense>` fallback and for `loading.tsx`. */
export function ProfileSkeleton() {
  return (
    <div className="flex flex-col pb-16">
      <div className="border-b border-line pb-6">
        <Skeleton className="h-8 w-52 rounded-sm" />
      </div>
      <WorkspaceBones />
    </div>
  );
}

/** The split's bones, under a header that is already on screen. */
function WorkspaceBones() {
  return (
    <div data-workspace-bones="" className={cn("grid items-start pt-4 lg:pt-6", SPLIT_CLASS)}>
        <div className="flex flex-col gap-4 rounded-xl border border-line p-5 max-lg:order-2">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-48 rounded-sm" />
              <Skeleton className="h-4 w-32 rounded-xs" />
            </div>
          </div>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-14 w-full rounded-md" />
          ))}
        </div>
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-9 w-full rounded-full" />
          <Skeleton className="h-[var(--builder-preview-h)] w-full max-w-[320px] rounded-[26px] lg:h-[480px]" />
        </div>
    </div>
  );
}

export function ProfileClient() {
  // `GET /profile/me`, `POST /auth/me`, `GET /profile/fields`, `GET /profile/groups` and
  // `GET /cards` — five rows in the Network tab, on this screen, every load.
  const result = useApiResource(fetchCardsData, emptyWorkspaceData);
  return (
    <Workspace
      // Re-mounts when the `?state=` override changes which profile is in play.
      key={result.state}
      state={result.state}
      data={result.data}
      error={result.error}
      reload={result.reload}
    />
  );
}

function Workspace({
  state,
  data,
  error,
  reload,
}: {
  state: ScreenState;
  data: WorkspaceData | null;
  error: FixtureError | null;
  reload: () => void;
}) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [draft, dispatch] = useReducer(profileDraftReducer, data, initProfileDraft);
  const [, startTransition] = useTransition();
  const [photoBusy, startPhotoTransition] = useTransition();
  const [logoBusy, setLogoBusy] = useState(false);
  const [companyLogoBusy, setCompanyLogoBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [creatingCard, setCreatingCard] = useState(false);

  // `data` is a fresh object after every re-read, so this replaces the local echo with what the
  // API actually stored — including reverting a change the server rejected.
  useEffect(() => {
    dispatch({ kind: "reseed", data });
  }, [data]);

  /**
   * ⚠ AC-33. The revealed set lives here and only here: component state, nothing persisted.
   * Navigating away unmounts it, which is §7.3's "a toggle that resets on navigation".
   */
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});
  /** The field last switched on, so the preview can bring its row into view. */
  const [spotlight, setSpotlight] = useState<{ fieldId: string; nonce: number } | null>(null);

  /* Cards: the API's own order, which is stable under edits, plus a card created a moment ago
     that the re-read has not returned yet. */
  const [createdCards, setCreatedCards] = useState<readonly ContactCard[]>([]);
  const cards = useMemo(() => {
    const listed = data?.cards ?? [];
    const known = new Set(listed.map((card) => card.id));
    return [...listed, ...createdCards.filter((card) => !known.has(card.id))];
  }, [data, createdCards]);

  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get(CARD_PARAM));
  const selected = cards.find((card) => card.id === selectedId) ?? cards[0] ?? null;

  const select = useCallback((cardId: string) => {
    setSelectedId(cardId);
    /* `replaceState`, never `router.replace` — see the module note. Guarded for happy-dom. */
    try {
      const url = new URL(window.location.href);
      url.searchParams.set(CARD_PARAM, cardId);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* The selection still changed; only the record of it did not. */
    }
  }, []);

  const showError = useCallback(
    (thrown: unknown) => {
      const shown = toScreenError(thrown);
      toast({ title: shown.title, description: shown.detail, tone: "danger" });
    },
    [toast],
  );

  const sync = useCardFieldSync({ fields: draft.fields, onError: showError });
  const design = useCardDesign({ onError: showError });
  const { panel, setPanel } = useWorkspacePanel();

  /* Who holds the selected card and has not been told it changed — read from the server, and
     re-read whenever a field edit has landed (`data` is a fresh object after every write) or the
     card's field selection finishes saving. It feeds the Send update button and nothing else. */
  const audience = useCardAudience(
    selected?.id ?? null,
    data,
    selected === null ? "idle" : sync.statusFor(selected.id),
  );

  /**
   * A logo or cover picked a moment ago, shown on the card while it uploads and until the re-read
   * brings the server's copy. Scoped to the `data` it was set against, so the next re-read retires
   * it without an effect — and a stale preview can never outlive the answer it was waiting for.
   */
  const [media, setMedia] = useState<{
    for: WorkspaceData | null;
    byCard: Readonly<Record<string, CardMedia>>;
  }>({ for: null, byCard: {} });
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const mediaNow = media.for === data ? media.byCard : NO_MEDIA;
  const overrideMedia = useCallback((cardId: string, patch: CardMedia) => {
    setMedia((current) => {
      const base = current.for === dataRef.current ? current.byCard : NO_MEDIA;
      return {
        for: dataRef.current,
        byCard: { ...base, [cardId]: { ...base[cardId], ...patch } },
      };
    });
  }, []);
  const dropMedia = useCallback((cardId: string, key: keyof CardMedia) => {
    setMedia((current) => {
      const entry = current.byCard[cardId];
      if (entry === undefined) return current;
      const { [key]: _dropped, ...rest } = entry;
      void _dropped;
      return { ...current, byCard: { ...current.byCard, [cardId]: rest } };
    });
  }, []);

  /* Object URLs for a picked logo, released when the workspace goes. */
  const objectUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
      objectUrls.current = [];
    },
    [],
  );

  /**
   * The owner's profile-level company logo, if they have uploaded one.
   *
   * It arrives as a `WORK`-category `COMPANY_LOGO` field (see `POST /profile/company-logo`), and
   * is separate from a card's own logo: this one rides every card that includes work fields.
   */
  const companyLogoField = useMemo(
    () => draft.fields.find((field) => field.type === "COMPANY_LOGO") ?? null,
    [draft.fields],
  );
  const companyLogoUrl = companyLogoField?.value.trim() ?? "";

  /**
   * Upload or replace the profile-level company logo.
   *
   * ⚠ The endpoints return only `{ id, url }`, not a whole profile — so the field cannot be
   * echoed from the response. The re-read brings the real `COMPANY_LOGO` row back; until then the
   * row is left as it was rather than fabricating one.
   */
  function uploadCompanyLogo(file: File) {
    setCompanyLogoBusy(true);
    startTransition(async () => {
      try {
        await api.uploadCompanyLogo(file);
        toast({ title: "Company logo saved" });
      } catch (thrown) {
        showError(thrown);
      } finally {
        setCompanyLogoBusy(false);
        reload();
      }
    });
  }

  function removeCompanyLogo() {
    setCompanyLogoBusy(true);
    startTransition(async () => {
      try {
        await api.deleteCompanyLogo();
      } catch (thrown) {
        showError(thrown);
      } finally {
        setCompanyLogoBusy(false);
        reload();
      }
    });
  }

  /** The card as the owner sees it right now: the server's, plus design edits, plus uploads. */
  const present = useCallback(
    (card: ContactCard): ContactCard => {
      const designed = design.apply(card);
      const picked = mediaNow[card.id];
      if (picked === undefined) return designed;
      return {
        ...designed,
        ...(picked.logoUrl === undefined ? {} : { logoUrl: picked.logoUrl }),
        ...(picked.coverUrl === undefined ? {} : { coverUrl: picked.coverUrl }),
      };
    },
    [design, mediaNow],
  );
  const shown = selected === null ? null : present(selected);

  const categoryByGroup = useMemo(
    () => new Map(draft.groups.map((group) => [group.id, group.category] as const)),
    [draft.groups],
  );
  const categoryOf = useCallback(
    (field: ProfileField): FieldCategory => categoryByGroup.get(field.groupId) ?? "CUSTOM",
    [categoryByGroup],
  );

  const sections = useMemo(
    () => workspaceSections(draft.groups, draft.fields),
    [draft.groups, draft.fields],
  );

  const selectedIds = selected === null ? null : sync.fieldIdsFor(selected);
  const resolved = useMemo(() => {
    if (shown === null || selectedIds === null || draft.user === null) return null;
    return resolveCard({ ...shown, fieldIds: [...selectedIds] }, draft.user, draft.groups, draft.fields);
  }, [shown, selectedIds, draft.user, draft.groups, draft.fields]);

  const screenState = resolveDataScreenState({
    state,
    isEmpty: draft.fields.length === 0,
    isFiltered: false,
  });

  /* ── writes ───────────────────────────────────────────────────────────────────────── */

  /** Echo locally, call the API, then re-read either way so the server has the last word. */
  function mutate(run: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await run();
      } catch (thrown) {
        showError(thrown);
      }
      reload();
    });
  }

  /** The group a new field is echoed into: a real one of that category if there is one. */
  function echoGroupFor(category: ApiFieldCategory): FieldGroup {
    const existing =
      draft.groups.find((group) => group.category === category && !isSyntheticGroupId(group.id)) ??
      draft.groups.find((group) => group.category === category);
    if (existing !== undefined) return existing;
    return {
      id: syntheticGroupId(category),
      userId: draft.user?.id ?? "",
      category,
      name: category,
      fieldIds: [],
    };
  }

  function companyName(): string | undefined {
    return draft.fields.find(
      (field) => field.type === "COMPANY" && categoryOf(field) === "WORK" && field.value.trim() !== "",
    )?.value;
  }

  /** Create one field upstream; resolves to its real id. WORK gets a group on first use. */
  async function createUpstream(input: NewFieldInput): Promise<string> {
    let groupId = groupIdForCreate(input.category, draft.groups);
    if (input.category === "WORK" && groupId === undefined) {
      const company = input.type === "COMPANY" ? input.value : companyName();
      const group = await api.createGroup({ category: "WORK", tag: workGroupTag(company) });
      groupId = group.id;
    }
    return createFieldInGroup(groupId, input);
  }

  /** Create a field filed into a specific group id (or loose when it is `undefined`). */
  async function createFieldInGroup(
    groupId: string | undefined,
    input: NewFieldInput,
  ): Promise<string> {
    const created = await api.createField({
      category: input.category,
      type: input.type,
      label: input.label.trim(),
      value: input.value.trim(),
      ...(groupId === undefined ? {} : { groupId }),
    });
    return created.id;
  }

  function echoCreate(input: NewFieldInput) {
    const group = echoGroupFor(input.category);
    dispatch({ kind: "ensure-group", group });
    echoCreateInto(group.id, input);
  }

  /** Echo a field into a known group id — used by the family path, which owns its own group. */
  function echoCreateInto(groupId: string, input: NewFieldInput) {
    dispatch({
      kind: "add-field",
      groupId,
      draft: {
        type: input.type,
        label: input.label.trim(),
        value: input.value.trim(),
        isSensitive: isAlwaysMasked(input.type),
      },
    });
  }

  function createField(input: NewFieldInput) {
    echoCreate(input);
    const card = selected;
    mutate(async () => {
      const id = await createUpstream(input);
      if (card !== null) sync.tickCreated(card, id);
    });
  }

  function editField(field: ProfileField, patch: { label: string; value: string }) {
    if (isLocalFieldId(field.id)) return;
    dispatch({ kind: "edit-field", fieldId: field.id, label: patch.label, value: patch.value });
    mutate(() => api.updateField(field.id, { label: patch.label.trim(), value: patch.value.trim() }));
  }

  /**
   * A new child is a `FAMILY` group: the group's `tag` is the child's name, and its two fields
   * are a `RELATION` "Name" and (when given) a `DATE` "Birthday". `FieldGroupCategory.FAMILY`
   * is what makes the pairing real rather than a label convention.
   *
   * ⚠ The group is created first, then both fields are filed into it — the same order the
   * field-create path uses, and the only way `groupId` can be sent on the field writes.
   */
  function addChild(name: string, birthday: string) {
    const childName = name.trim();
    const group: FieldGroup = {
      id: syntheticGroupId("FAMILY"),
      userId: draft.user?.id ?? "",
      category: "FAMILY",
      name: childName,
      fieldIds: [],
    };
    dispatch({ kind: "ensure-group", group });
    const nameInput: NewFieldInput = {
      category: "FAMILY",
      type: "RELATION",
      label: CHILD_NAME_LABEL,
      value: childName,
    };
    const birthdayInput: NewFieldInput | null =
      birthday.trim() === ""
        ? null
        : { category: "FAMILY", type: "DATE", label: CHILD_BIRTHDAY_LABEL, value: birthday };
    echoCreateInto(group.id, nameInput);
    if (birthdayInput !== null) echoCreateInto(group.id, birthdayInput);
    const card = selected;
    mutate(async () => {
      const created = await api.createGroup({ category: "FAMILY", tag: childName });
      const nameId = await createFieldInGroup(created.id, nameInput);
      if (card !== null) sync.tickCreated(card, nameId);
      if (birthdayInput !== null) {
        const birthdayId = await createFieldInGroup(created.id, birthdayInput);
        if (card !== null) sync.tickCreated(card, birthdayId);
      }
    });
  }

  /** A child's birthday is stored under their name, so a rename carries it along. */
  function renameChild(child: ChildEntry, name: string) {
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === child.name.value.trim()) return;
    const birthday = child.birthday;
    dispatch({ kind: "edit-field", fieldId: child.name.id, label: child.name.label, value: trimmed });
    if (birthday !== null) {
      dispatch({
        kind: "edit-field",
        fieldId: birthday.id,
        label: birthday.label,
        value: birthday.value,
      });
    }
    mutate(async () => {
      await api.updateField(child.name.id, { label: child.name.label, value: trimmed });
      if (birthday !== null) {
        await api.updateField(birthday.id, { label: birthday.label, value: birthday.value });
      }
    });
  }

  /** Renames a family member: the group's tag is their name, and their RELATION field follows. */
  function renameFamily(entry: FamilyEntry, name: string) {
    const trimmed = name.trim();
    if (trimmed === "") return;
    dispatch({ kind: "rename-group", groupId: entry.group.id, name: trimmed });
    if (isSyntheticGroupId(entry.group.id) || entry.nameField === null) return;
    if (trimmed === entry.nameField.value.trim()) return;
    dispatch({ kind: "edit-field", fieldId: entry.nameField.id, label: entry.nameField.label, value: trimmed });
    mutate(async () => {
      await api.updateGroup(entry.group.id, { tag: trimmed });
      await api.updateField(entry.nameField!.id, { label: entry.nameField!.label, value: trimmed });
    });
  }

  function toggleReveal(fieldId: string) {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  }

  function cardToggle(field: ProfileField): RowCardToggle | null {
    if (selected === null || selectedIds === null || isLocalFieldId(field.id)) return null;
    if (field.value.trim() === "") return null;
    return {
      cardName: selected.name,
      on: selectedIds.includes(field.id),
      onChange: (next) => {
        sync.toggle(selected, field.id, next);
        if (next) setSpotlight((current) => ({ fieldId: field.id, nonce: (current?.nonce ?? 0) + 1 }));
      },
    };
  }

  function uploadPhoto(file: File) {
    startPhotoTransition(async () => {
      try {
        await api.uploadPhoto(file);
      } catch (thrown) {
        showError(thrown);
      }
      reload();
    });
  }

  function removePhoto() {
    startPhotoTransition(async () => {
      try {
        await api.deletePhoto();
      } catch (thrown) {
        showError(thrown);
      }
      reload();
    });
  }

  /**
   * The company logo is the card's — there is no profile-level logo upstream. The Work section and
   * the Design panel both write it, through here, so the two can never show different marks.
   */
  function pickLogo(card: ContactCard, file: File) {
    const previewUrl = URL.createObjectURL(file);
    objectUrls.current.push(previewUrl);
    overrideMedia(card.id, { logoUrl: previewUrl });
    setLogoBusy(true);
    void (async () => {
      try {
        const updated = await cardsApi.uploadLogo(card.id, file);
        overrideMedia(card.id, { logoUrl: updated.logoUrl ?? null });
      } catch (thrown) {
        /* Back to the logo the server still has: a card claiming a mark it does not carry is
           one the owner would go on to share. */
        dropMedia(card.id, "logoUrl");
        showError(thrown);
      } finally {
        setLogoBusy(false);
        reload();
      }
    })();
  }

  function removeLogo(card: ContactCard) {
    overrideMedia(card.id, { logoUrl: null });
    setLogoBusy(true);
    void (async () => {
      try {
        await cardsApi.removeLogo(card.id);
      } catch (thrown) {
        dropMedia(card.id, "logoUrl");
        showError(thrown);
      } finally {
        setLogoBusy(false);
        reload();
      }
    })();
  }

  /**
   * The cover is its own upload, never part of the design `PATCH` — that endpoint accepts only
   * `null` for it. `picked === null` is the removal.
   */
  function writeCover(card: ContactCard, picked: { file: File; previewUrl: string } | null) {
    overrideMedia(card.id, { coverUrl: picked === null ? null : picked.previewUrl });
    setCoverBusy(true);
    void (async () => {
      try {
        if (picked === null) {
          await cardsApi.removeCover(card.id);
        } else {
          const updated = await cardsApi.uploadCover(card.id, picked.file);
          overrideMedia(card.id, { coverUrl: updated.coverUrl ?? null });
        }
      } catch (thrown) {
        dropMedia(card.id, "coverUrl");
        showError(thrown);
      } finally {
        setCoverBusy(false);
        reload();
      }
    })();
  }

  /**
   * New card: create it with the builder's default design, then put every filled-in field on it.
   *
   * ⚠ **Atomic now.** `fieldIds` rides the create, so the card and its `CardField` rows land in
   * one server transaction. The old create-then-`PUT /cards/{id}/fields` pair could half-fail and
   * leave an empty card behind; `POST /cards` no longer can. The card overlay reads the whole
   * created card back, so there is no second `setFields` and no second response to reconcile.
   */
  async function createCard(name: string): Promise<boolean> {
    if (draft.user === null) return false;
    setCreatingCard(true);
    try {
      const base = builderInitialState({ card: null, userId: draft.user.id, seed: [] });
      const ids = carryOverFieldIds(draft.fields);
      const dto = await cardsApi.create({
        name,
        kind: toApiCardKind(base.cardType),
        ...toAppearanceDto(base),
        headline: null,
        bio: null,
        ...(ids.length === 0 ? {} : { fieldIds: ids }),
      });
      const card = toContactCard(dto, draft.user.id);
      setCreatedCards((current) => [...current, card]);
      select(card.id);
      reload();
      return true;
    } catch (thrown) {
      showError(thrown);
      return false;
    } finally {
      setCreatingCard(false);
    }
  }

  /* ── render ───────────────────────────────────────────────────────────────────────── */

  let body;
  if (screenState === "loading") {
    body = <WorkspaceBones />;
  } else if (screenState === "error" || screenState === "offline") {
    body = (
      <div className="pt-12">
        <ErrorPanel error={error} onRetry={reload} homeHref="/dashboard" homeLabel="Go to dashboard" />
      </div>
    );
  } else if (draft.user === null) {
    body = (
      <div className="pt-12">
        <ErrorPanel
          title="We couldn't load your profile"
          detail="Try again in a moment."
          retryable
          onRetry={reload}
          homeHref="/dashboard"
          homeLabel="Go to dashboard"
        />
      </div>
    );
  } else {
    const user = draft.user;
    const designState = selected === null ? null : design.stateFor(selected);
    const designDispatch = (action: BuilderAction) => {
      if (selected !== null) design.dispatch(selected, action);
    };
    body = (
      <SplitView
        pinnedSide="right"
        pinnedLabel="Card preview"
        contentLabel="Your fields"
        className={cn("pt-4 lg:pt-6", SPLIT_CLASS)}
        pinnedClassName={cn(
          "min-w-0 max-h-none overflow-visible border-b border-line pb-3 pt-2",
          "lg:max-h-[calc(100svh-var(--space-16))] lg:overflow-y-auto lg:border-b-0 lg:pb-0 lg:pt-0",
        )}
        pinned={
          <WorkspacePreview
            cards={cards.map((card) => ({ id: card.id, name: present(card).name }))}
            selectedId={selected?.id ?? null}
            onSelect={select}
            onCreate={createCard}
            creating={creatingCard}
            resolved={resolved}
            syncStatus={
              selected === null
                ? "idle"
                : worstStatus(sync.statusFor(selected.id), design.statusFor(selected.id))
            }
            onRetrySync={() => {
              if (selected === null) return;
              if (sync.statusFor(selected.id) === "error") sync.retry(selected.id);
              if (design.statusFor(selected.id) === "error") design.retry(selected.id);
            }}
            spotlight={spotlight}
          />
        }
      >
        <TabsPrimitive.Root
          value={panel}
          onValueChange={(value) => setPanel(value as WorkspacePanelId)}
          activationMode="automatic"
          className="flex min-w-0 flex-col gap-3 lg:gap-4"
        >
          {/* The tabs, and — at the right end of the same row, on every panel — the Send update
              button. It scrolls away with the row like anything else on the page: pinning it
              made the fields slide under it and read as a glitch (client, 2026-10-03). Wrapping:
              on a phone the tabs fill the row and the button drops under them at full width,
              where a thumb reaches it. */}
          <div
            data-workspace-toolbar=""
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
          >
            <WorkspaceTabList />
            {selected === null ? null : (
              <SendUpdateButton
                key={selected.id}
                cardId={selected.id}
                targets={audience.targets}
                ready={audience.ready}
                nudge={audience.nudge}
                onChanged={audience.reload}
              />
            )}
          </div>

          <TabsPrimitive.Content value="fields" data-workspace-panel="fields" className="outline-none">
            <div data-workspace-fields="" className={PANEL_SURFACE}>
              <div className="flex flex-col gap-4 p-4 sm:p-5">
                <IdentityBlock
                  user={user}
                  photoBusy={photoBusy}
                  onUploadPhoto={uploadPhoto}
                  onRemovePhoto={removePhoto}
                />
                <p data-workspace-intro="" className="text-sm text-ink-2">
                  Complete the fields below.
                </p>
              </div>

              {/* The two lines printed under the name — first, because that is where they sit on
                  the card. They are the selected card's own, so they follow the switcher. */}
              {shown === null || designState === null || resolved === null ? null : (
                <WorkspaceCardIntro
                  cardName={shown.name}
                  headline={designState.headline}
                  bio={designState.bio}
                  fallbackHeadline={resolved.headline}
                  fallbackBio={printedBio(resolved)}
                  open={openOverrides[CARD_INTRO_SECTION] ?? true}
                  onOpenChange={(next) =>
                    setOpenOverrides((current) => ({ ...current, [CARD_INTRO_SECTION]: next }))
                  }
                  onHeadline={(headline) => designDispatch({ kind: "headline", headline })}
                  onBio={(bio) => designDispatch({ kind: "bio", bio })}
                />
              )}

              {sections.map((model) => (
                <WorkspaceSection
                  key={model.section.id}
                  model={model}
                  open={openOverrides[model.section.id] ?? model.section.defaultOpen}
                  onOpenChange={(next) =>
                    setOpenOverrides((current) => ({ ...current, [model.section.id]: next }))
                  }
                  categoryOf={categoryOf}
                  revealed={revealed}
                  onToggleReveal={toggleReveal}
                  cardToggle={cardToggle}
                  onEdit={editField}
                  onCreate={createField}
                  onAddChild={addChild}
                  onRenameChild={renameChild}
                  onRenameFamily={renameFamily}
                  logo={
                    selected === null || shown === null
                      ? null
                      : {
                          cardName: shown.name,
                          logoUrl: companyLogoUrl === "" ? null : companyLogoUrl,
                          busy: companyLogoBusy,
                          onPick: uploadCompanyLogo,
                          onRemove: removeCompanyLogo,
                        }
                  }
                />
              ))}
            </div>
          </TabsPrimitive.Content>

          <TabsPrimitive.Content value="design" data-workspace-panel="design" className="outline-none">
            {selected === null || shown === null || designState === null || resolved === null ? (
              <NoCardYet action="design" />
            ) : (
              <div className={cn(PANEL_SURFACE, "gap-6 p-5 sm:p-6 lg:p-7")}>
                <PanelHead
                  section="Design"
                  name={designState.name}
                  onRename={(name) => designDispatch({ kind: "rename", name })}
                  intro="How this card looks to everyone who opens it. Changes save as you make them."
                />
                <DesignPanel
                  logoUrl={shown.logoUrl ?? null}
                  logoBusy={logoBusy}
                  onPickLogo={(file) => pickLogo(selected, file)}
                  onRemoveLogo={() => removeLogo(selected)}
                  paletteId={designState.paletteId}
                  groundHex={designState.groundHex}
                  finish={designState.finish}
                  texture={designState.texture}
                  texturePresence={designState.texturePresence}
                  textureScale={designState.textureScale}
                  /* I-5: the palette off the workspace's one resolution, never a second lookup. */
                  palette={resolved.palette}
                  onPreset={(paletteId) => designDispatch({ kind: "palette", paletteId })}
                  onGround={(hex) => designDispatch({ kind: "ground", hex })}
                  onFinish={(finish) => designDispatch({ kind: "finish", finish })}
                  onTexture={(texture) => designDispatch({ kind: "texture", texture })}
                  onPresence={(texturePresence) =>
                    designDispatch({ kind: "presence", texturePresence })
                  }
                  onScale={(textureScale) => designDispatch({ kind: "scale", textureScale })}
                  onLook={(look) => {
                    /* The builder's two transitions: `palette` clears a custom colour first. */
                    designDispatch({ kind: "palette", paletteId: look.paletteId });
                    designDispatch({ kind: "finish", finish: look.finish });
                  }}
                  coverUrl={shown.coverUrl ?? null}
                  coverBusy={coverBusy}
                  onCover={(picked) => writeCover(selected, picked)}
                />
              </div>
            )}
          </TabsPrimitive.Content>

          <TabsPrimitive.Content value="share" data-workspace-panel="share" className="outline-none">
            {selected === null || designState === null || resolved === null ? (
              <NoCardYet action="share" />
            ) : (
              <div className={cn(PANEL_SURFACE, "gap-8 p-5 sm:p-6 lg:p-7")}>
                <PanelHead
                  section="Share"
                  name={designState.name}
                  onRename={(name) => designDispatch({ kind: "rename", name })}
                  intro="Send it to someone's WhatsApp, or share the link. Edits you make later reach them on their own."
                />
                <WorkspaceSharePanel
                  key={selected.id}
                  cardId={selected.id}
                  userId={user.id}
                  resolved={resolved}
                  onAddFields={() => setPanel("fields")}
                />
              </div>
            )}
          </TabsPrimitive.Content>
        </TabsPrimitive.Root>
      </SplitView>
    );
  }

  return (
    <ScreenStateRoot state={screenState} as="section" aria-label="Profile and cards" className="pb-16">
      <PageHeader title="Profile & Cards" />
      {body}
    </ScreenStateRoot>
  );
}
