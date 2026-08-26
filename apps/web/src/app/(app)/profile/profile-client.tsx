"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useState, useSyncExternalStore, useTransition } from "react";

import {
  ErrorPanel,
  LoadingSkeleton,
  ScreenStateRoot,
  resolveDataScreenState,
} from "@/components/data";
import { PageHeader } from "@/components/layout";
import { useToast } from "@/components/overlay";
import { Skeleton } from "@/components/primitives/skeleton";
import { AddFieldPopover, type NewFieldDraft } from "@/components/profile/add-field-popover";
import { FieldGroupSection } from "@/components/profile/field-group-section";
import { ProfileFieldRow } from "@/components/profile/field-row";
import { IdentityBlock } from "@/components/profile/identity-block";
import { profile as api } from "@/lib/api/browser";
import { fetchProfileData } from "@/lib/api/browser-loaders";
import { toScreenError } from "@/lib/api/errors";
import { categoryOfSyntheticGroup, isSyntheticGroupId } from "@/lib/api/map";
import { useApiResource } from "@/lib/use-api";
import { Button } from "@/components/primitives/button";
import { Input } from "@/components/primitives/input";
import { Select } from "@/components/primitives/select";
import { API_GROUP_CATEGORIES, type ApiGroupCategory } from "@/lib/api/schema";
import type { FieldGroup, FixtureError, ProfileField, ScreenState, User } from "@/types/domain";

/**
 * `/profile` — the screen where the product's data actually lives (spec §6.1 R-16, §8D.3,
 * §4.5, §5.3, §11 E-08).
 *
 * ## Why this screen matters more than its size suggests
 * §5.3: **a card owns no data; a card is a filter over `ProfileField`s.** A card's own content is
 * a name, a type and a template — everything a scanner receives comes from here.
 *
 * ## What changed when the API arrived
 * The data is real, and so are the edits. Three consequences worth stating up front:
 *
 * · **Reads and writes both happen from the browser**, through the same-origin proxy at
 *   `/api/cb/*`. Every one is a row in the Network tab whose response body is exactly what Swagger
 *   returns — that visibility is the requirement this replaced a server-side fetch to satisfy.
 * · **`?state=` survives, and now means something narrower.** It is a *review override*, not the
 *   data source: `success` is the real profile, and `loading`/`error`/`offline` still render their
 *   surfaces on demand because a healthy server cannot be asked to produce them. 122 e2e URLs
 *   depend on that. See `@/lib/screen-data`.
 * · **The draft is an echo, not the truth.** Every mutation dispatches locally *and* calls a
 *   Server Action. On success the action revalidates and `router.refresh()` replaces the echo
 *   with the server's record — which matters most for an added field, whose local id is
 *   temporary. On failure the echo is discarded the same way, and the reason is toasted.
 *
 * ## Two controls that are honestly read-only
 * Not omissions — missing endpoints, recorded as ask #6 in `docs/INTEGRATION.md`:
 *
 * · **Identity.** There is no `PATCH` for a name or an email. `POST /profile/onboarding` sets
 *   them once and is one-shot, so the edit button is not rendered.
 * · **Sensitive.** There is no `isSensitive` column. The flag is derived from field type, so
 *   payment values are always masked and nothing else can be. The switch says so rather than
 *   moving and reverting on reload.
 */

/* ── The data this screen renders ─────────────────────────────────────────────────────── */

export interface ProfileData {
  user: User;
  groups: FieldGroup[];
  fields: ProfileField[];
}

/**
 * §11 E-08: an empty profile is **the groups, with no fields** — not zero groups.
 *
 * A screen showing nothing would be wrong twice over: wrong about the data, and offering the
 * owner no way to start. Each section keeps its own "No fields in {group} yet" + Add field.
 */
export function emptyProfileData(real: ProfileData): ProfileData {
  return {
    user: real.user,
    groups: real.groups.map((group) => ({ ...group, fieldIds: [] })),
    fields: [],
  };
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
   * ⚠ These ids are **local only** and must never reach the API — a reorder that sent one would
   * be rejected wholesale as not-yours (403 `PROFILE_FIELD_NOT_OWNED`). `reseed` replaces them
   * with the server's real ids as soon as the refresh lands.
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
  | { kind: "rename-group"; groupId: string; name: string };

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
      // must drop it into `droppedFieldIds` rather than render a ghost row. The API agrees by
      // archiving rather than erasing, so card history stays displayable.
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
 * sent as the complete order — see `reorderFieldsAction`. Groups are already in render order and
 * each holds its own ordered ids, so concatenating them *is* the display order.
 */
export function globalFieldOrder(draft: Pick<ProfileDraft, "groups" | "fields">): string[] {
  const ids: string[] = [];
  for (const group of draft.groups) {
    for (const id of group.fieldIds) ids.push(id);
  }
  return ids;
}

/** Why the sensitive switch cannot move. Read by both profile screens. */
export const SENSITIVE_READ_ONLY_REASON =
  "Set by the field's type — payment details are always masked.";

/** Why the identity block has no edit button. */
export const IDENTITY_READ_ONLY_REASON =
  "Your name and email are set when you sign up, and your number is how you sign in.";

/* ── Adding a group ───────────────────────────────────────────────────────────────────── */

/** What each group category is called when the owner is choosing one. */
const GROUP_CATEGORY_LABELS: Readonly<Record<ApiGroupCategory, string>> = {
  WORK: "Job",
  BUSINESS: "Business",
  SOCIAL: "Social profile",
  FINANCIAL: "Payment account",
};

/**
 * Add one instance of a repeatable thing — another job, another bank account.
 *
 * ## Why this control is new
 * There was nothing to create before: a group *was* a category, one per `FieldCategory`, seeded
 * and fixed (§5.5). The API's group is an instance, and `POST /profile/groups` exists because a
 * person can hold two jobs. Without this control four of the API's group categories would be
 * reachable only for groups that already happened to exist.
 *
 * Only the four categories the API allows a group in are offered — `IDENTITY`, `PERSONAL` and
 * `CUSTOM` fields are ungrouped upstream, and their sections on this screen are synthetic.
 */
function AddGroupRow({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreate: (category: ApiGroupCategory, name: string) => void;
}) {
  const [category, setCategory] = useState<ApiGroupCategory>("WORK");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="border-b border-line py-4">
        <Button variant="text-link" data-add-group-open="" onClick={() => onOpenChange(true)}>
          Add a job, business, social profile or account
        </Button>
      </div>
    );
  }

  return (
    <form
      data-add-group-form=""
      className="flex flex-col gap-3 border-b border-line py-6 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (trimmed.length === 0) {
          setError("Give it a name — it becomes the heading on your profile.");
          return;
        }
        setError(null);
        onCreate(category, trimmed);
        setName("");
      }}
    >
      <Select
        label="Kind"
        value={category}
        onValueChange={(next) => setCategory(next as ApiGroupCategory)}
        items={API_GROUP_CATEGORIES.map((value) => ({
          value,
          label: GROUP_CATEGORY_LABELS[value],
        }))}
        fieldClassName="sm:w-48 sm:shrink-0"
      />
      <Input
        label="Name"
        value={name}
        error={error}
        placeholder="Kestrel Telecom"
        onChange={(event) => setName(event.target.value)}
        fieldClassName="min-w-0 flex-1"
      />
      <div className="flex shrink-0 items-center gap-2">
        <Button type="submit">Add</Button>
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ── "Collapsed by default on mobile" (§8D.3), without lying about `aria-expanded` ───── */

const COMPACT_QUERY = "(max-width: 767px)";

function subscribeCompact(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function readCompact(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(COMPACT_QUERY).matches;
}

/**
 * The server has no viewport, so it renders the desktop default (expanded) and the client
 * corrects it during hydration. A CSS-only `hidden md:block` would avoid the correction and get
 * `aria-expanded` wrong at one of the two widths, which is the entire accessible contract of a
 * disclosure — so the attribute wins and the one-frame correction is the price.
 */
function readCompactOnServer(): boolean {
  return false;
}

/* ── The screen ───────────────────────────────────────────────────────────────────────── */

/** Layout-matched bones for `page.tsx`'s `<Suspense>` fallback and for `loading.tsx`. */
export function ProfileSkeleton() {
  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-line pb-6">
        <Skeleton className="h-10 w-44 rounded-sm" />
      </div>
      <div className="pt-8">
        <LoadingSkeleton variant="groups" count={3} label="Loading your profile" />
      </div>
    </div>
  );
}

export function ProfileClient() {
  // `GET /profile/me`, `POST /auth/me`, `GET /profile/fields`, `GET /profile/groups` — four rows
  // in the Network tab, on this screen, every load.
  const result = useApiResource(fetchProfileData, emptyProfileData);
  return (
    <ProfileScreen
      // Re-mounts when the `?state=` override changes which profile is in play, so a review URL
      // flipped from `success` to `empty` does not keep editing fields that are no longer shown.
      key={result.state}
      state={result.state}
      data={result.data}
      error={result.error}
      reload={result.reload}
    />
  );
}

function ProfileScreen({
  state,
  data,
  error,
  reload,
}: {
  state: ScreenState;
  data: ProfileData | null;
  error: FixtureError | null;
  reload: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [draft, dispatch] = useReducer(profileDraftReducer, data, initProfileDraft);
  const [, startTransition] = useTransition();
  // Separate from the general transition so the photo button reports busy on its own, rather
  // than every control on the screen going pending because a field was edited.
  const [photoBusy, startPhotoTransition] = useTransition();
  const [addingGroup, setAddingGroup] = useState(false);

  // `data` is a fresh object on every server render, so this fires after each `router.refresh()`
  // and replaces the local echo with what the API actually stored — including reverting a change
  // the server rejected.
  useEffect(() => {
    dispatch({ kind: "reseed", data });
  }, [data]);

  /**
   * ⚠ AC-33. The revealed set lives here and **only** here: plain component state, no browser
   * storage, no context above the route, no URL parameter. Navigating away unmounts this
   * component and the set goes with it, which is precisely §7.3's "a toggle that resets on
   * navigation" — implemented by not keeping it, rather than by remembering to clear it.
   */
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set<string>());

  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});
  const compact = useSyncExternalStore(subscribeCompact, readCompact, readCompactOnServer);

  const screenState = resolveDataScreenState({
    state,
    isEmpty: draft.fields.length === 0,
    // §8D.3 records the filtered-empty cell for this screen as n/a: no search, no filter.
    isFiltered: false,
  });

  function toggleReveal(fieldId: string) {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  }

  /**
   * Run a mutation: echo it locally, send it, then let the server have the last word.
   *
   * `router.refresh()` runs on **both** paths. On success it swaps a temporary local id for the
   * real one; on failure it discards the echo, which is what makes a rejected edit disappear
   * instead of lingering as a change that was never saved.
   */
  /**
   * Run a mutation: echo it locally, call the API from the browser, then re-read.
   *
   * `reload()` runs on **both** paths. On success it swaps a temporary local id for the real one;
   * on failure it discards the echo, which is what makes a rejected edit disappear instead of
   * lingering as a change that was never saved.
   *
   * The call itself is a visible request. So is the re-read.
   */
  function mutate<T>(run: () => Promise<T>, onOk?: (data: T) => void) {
    startTransition(async () => {
      try {
        const data = await run();
        onOk?.(data);
      } catch (thrown) {
        const shown = toScreenError(thrown);
        toast({ title: shown.title, description: shown.detail, tone: "danger" });
      }
      reload();
    });
  }

  /** The photo's own runner. Same shape as `mutate`, its own pending flag. */
  function mutatePhoto<T>(run: () => Promise<T>, onOk?: () => void) {
    startPhotoTransition(async () => {
      try {
        await run();
        onOk?.();
      } catch (thrown) {
        const shown = toScreenError(thrown);
        toast({ title: shown.title, description: shown.detail, tone: "danger" });
      }
      reload();
    });
  }

  function addField(group: FieldGroup, newField: NewFieldDraft) {
    dispatch({ kind: "add-field", groupId: group.id, draft: newField });
    setOpenOverrides((current) => ({ ...current, [group.id]: true }));

    /* ⚠ A synthetic section has no group upstream — `map.ts` invented it to hold ungrouped
       PERSONAL / IDENTITY / CUSTOM fields. Sending its id as a real `groupId` would 404, so it
       becomes "ungrouped, in this category" instead. This is the one place that decision is made
       on the client. */
    const synthetic = categoryOfSyntheticGroup(group.id);

    mutate(
      () =>
        api.createField({
          category: synthetic ?? group.category,
          type: newField.type,
          label: newField.label.trim(),
          value: newField.value.trim(),
          groupId: synthetic === null ? group.id : undefined,
        }),
      () => toast({ title: `Added ${newField.label} to ${group.name}` }),
    );
  }

  function editField(field: ProfileField, patch: { label: string; value: string }) {
    dispatch({ kind: "edit-field", fieldId: field.id, label: patch.label, value: patch.value });
    mutate(
      () => api.updateField(field.id, { label: patch.label.trim(), value: patch.value.trim() }),
      () => toast({ title: `Updated ${patch.label}` }),
    );
  }

  let body;
  if (screenState === "loading") {
    body = (
      <div className="pt-8">
        <LoadingSkeleton variant="groups" count={3} label="Loading your profile" />
      </div>
    );
  } else if (screenState === "error" || screenState === "offline") {
    body = (
      <div className="pt-12">
        <ErrorPanel
          error={error}
          onRetry={reload}
          homeHref="/dashboard"
          homeLabel="Go to dashboard"
        />
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
    body = (
      <>
        <div className="pt-8">
          <IdentityBlock
            user={draft.user}
            fieldCount={draft.fields.length}
            groupCount={draft.groups.length}
            readOnlyReason={IDENTITY_READ_ONLY_REASON}
            photoBusy={photoBusy}
            onUploadPhoto={(file) => {
              mutatePhoto(
                () => api.uploadPhoto(file),
                () => toast({ title: "Photo updated" }),
              );
            }}
            onRemovePhoto={() =>
              mutatePhoto(
                () => api.deletePhoto(),
                () => toast({ title: "Photo removed" }),
              )
            }
          />
        </div>

        <AddGroupRow
          open={addingGroup}
          onOpenChange={setAddingGroup}
          onCreate={(category, name) =>
            mutate(
              () => api.createGroup({ category, tag: name }),
              () => {
                toast({ title: `Added ${name}` });
                setAddingGroup(false);
              },
            )
          }
        />

        <div data-field-groups="">
          {draft.groups.map((group) => {
            const groupFields = fieldsOfGroup(draft, group);
            const open = openOverrides[group.id] ?? !compact;

            return (
              <FieldGroupSection
                key={group.id}
                group={group}
                fieldCount={groupFields.length}
                open={open}
                onOpenChange={(next) =>
                  setOpenOverrides((current) => ({ ...current, [group.id]: next }))
                }
                // A synthetic section has no record upstream, so there is nothing to open an
                // editor onto — reorder, rename and delete all address a real group id.
                editorHref={
                  isSyntheticGroupId(group.id) ? undefined : `/profile/groups/${group.id}`
                }
                addSlot={
                  <AddFieldPopover
                    group={group}
                    variant={groupFields.length === 0 ? "primary" : "secondary"}
                    onAdd={(newField) => addField(group, newField)}
                  />
                }
              >
                <ul data-field-rows={group.id} className="flex flex-col">
                  {groupFields.map((field) => (
                    <ProfileFieldRow
                      key={field.id}
                      field={field}
                      category={group.category}
                      revealed={revealed.has(field.id)}
                      onToggleReveal={() => toggleReveal(field.id)}
                      onEdit={(patch) => editField(field, patch)}
                      // Disabled — see SENSITIVE_READ_ONLY_REASON. The callback cannot fire.
                      onToggleSensitive={() => {}}
                      sensitiveReadOnlyReason={SENSITIVE_READ_ONLY_REASON}
                    />
                  ))}
                </ul>
              </FieldGroupSection>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <ScreenStateRoot state={screenState} as="section" aria-label="Profile" className="pb-16">
      <PageHeader
        title="Profile"
        subtitle="Every card is a filter over these fields. Edit one here and every card that maps it changes."
      />
      {body}
    </ScreenStateRoot>
  );
}
