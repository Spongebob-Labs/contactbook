"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState, useTransition, type FormEvent } from "react";

import {
  EmptyState,
  ErrorPanel,
  LoadingSkeleton,
  NotFoundPanel,
  ScreenStateRoot,
  resolveDataScreenState,
} from "@/components/data";
import { PageHeader } from "@/components/layout";
import { useToast } from "@/components/overlay";
import { Button, buttonClassName } from "@/components/primitives/button";
import { Input } from "@/components/primitives/input";
import { Skeleton } from "@/components/primitives/skeleton";
import { AddFieldDialog, type NewFieldDraft } from "@/components/profile/add-field-dialog";
import { ProfileFieldRow } from "@/components/profile/field-row";
import { ConfirmDialog } from "@/components/overlay";
import {
  SENSITIVE_READ_ONLY_REASON,
  cardNamesUsing,
  emptyProfileData,
  fieldsOfGroup,
  globalFieldOrder,
  initProfileDraft,
  profileDraftReducer,
  type CardUsage,
  type ProfileData,
} from "@/app/(app)/profile/profile-client";
import {
  createFieldAction,
  deleteFieldAction,
  deleteGroupAction,
  renameGroupAction,
  reorderFieldsAction,
  updateFieldAction,
} from "@/lib/actions/profile";
import type { ActionResult } from "@/lib/actions/result";
import { useScreenDataOrFailure } from "@/lib/screen-data";
import type { FixtureError, ProfileField, ScreenState } from "@/types/domain";

/**
 * `/profile/groups/[groupId]` — the focused editor for one `FieldGroup` (spec §6.1 R-17,
 * §8D.3, §5.5, §11 E-08, E-40, E-41).
 *
 * `/profile` is the overview: read every group, edit a value, add a field. This is the
 * screen for the operations that need room and need consequences spelled out —
 * **reorder, add, edit, delete.**
 *
 * ## The reducer is imported, not re-written
 * `profileDraftReducer` lives in `profile-client.tsx` and both screens dispatch into it.
 * Two copies of "what deleting a field does to its group's `fieldIds`" is exactly the kind
 * of divergence that produces a ghost row on one screen and not the other (§11 E-40).
 * Both screens now persist through the same Server Actions, and both hold the reducer only as a
 * local echo that `router.refresh()` replaces with the server's record.
 *
 * ## E-41, which is the reason this screen has a delete at all
 * Deleting a `ProfileField` opens T08's `ConfirmDialog` with its `consequence` slot filled
 * by **how many cards use the field, by name and count**, before anything is removed
 * (`cardsUsingConsequence`, in `field-row.tsx`). Afterwards E-40 applies: `resolveCard`
 * drops the now-dangling id into `droppedFieldIds`, so an affected card loses the row
 * rather than rendering a ghost of it. That half already holds in T11 — this screen only
 * has to make the count true and say it first.
 *
 * ## §5.5 changed meaning when the API arrived, and the delete control follows it
 * §5.5 said groups are "renameable and never deletable" — written when a group *was* a category,
 * one per `FieldCategory`, so deleting one would have deleted a category.
 *
 * The API's group is a different thing: **one instance of a repeatable thing** — a specific job,
 * a specific bank account — and a profile can hold several per category. Deleting a job you no
 * longer have is now an ordinary need rather than a category-destroying one, and
 * `DELETE /profile/groups/{id}` exists to serve it. So there is a delete control, behind a
 * confirm that states the part nobody would guess: **archiving a group archives every field in
 * it**, so removing a job takes its phone, email and title with it.
 *
 * The sections `/profile` invents to hold ungrouped fields are not groups and never reach this
 * screen — `map.ts` gives them synthetic ids and `/profile` renders no editor link for them.
 */

/** Layout-matched bones: §8D.3's "field-row skeletons" for this screen. */
export function GroupEditorSkeleton() {
  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-line pb-6">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-24 rounded-xs" />
          <Skeleton className="h-10 w-56 rounded-sm" />
        </div>
      </div>
      <div className="pt-8">
        <LoadingSkeleton variant="fields" count={5} label="Loading this field group" />
      </div>
    </div>
  );
}

export interface GroupEditorClientProps {
  /** Already checked against the caller's real groups by the server half. */
  groupId: string;
  data: ProfileData | null;
  /** Cards reduced to `{ name, fieldIds }` — the E-41 blast radius, fetched alongside. */
  cards: readonly CardUsage[];
  failure: FixtureError | null;
}

export function GroupEditorClient({ groupId, data, cards, failure }: GroupEditorClientProps) {
  const result = useScreenDataOrFailure(data, failure, emptyProfileData);

  // Same re-mount rule as `/profile`: a `?state=` flip changes which profile is in play.
  return (
    <GroupEditorScreen
      key={result.state}
      groupId={groupId}
      state={result.state}
      data={result.data}
      cards={cards}
      error={result.error}
    />
  );
}

function GroupEditorScreen({
  groupId,
  state,
  data,
  cards,
  error,
}: {
  groupId: string;
  state: ScreenState;
  data: ProfileData | null;
  cards: readonly CardUsage[];
  error: FixtureError | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [draft, dispatch] = useReducer(profileDraftReducer, data, initProfileDraft);
  const [, startTransition] = useTransition();

  // Fires after every `router.refresh()`, replacing the local echo with what the API stored —
  // including reverting a change the server rejected. See `/profile` for the full rationale.
  useEffect(() => {
    dispatch({ kind: "reseed", data });
  }, [data]);

  /**
   * Echo, send, then let the server have the last word.
   *
   * `router.refresh()` runs on both paths: on success it swaps temporary local ids for real
   * ones, and on failure it discards the echo so a rejected edit disappears rather than
   * lingering as a change that was never saved.
   */
  function mutate<T>(run: () => Promise<ActionResult<T>>, onOk?: (value: T) => void) {
    startTransition(async () => {
      const result = await run();
      if (result.ok) {
        onOk?.(result.data);
      } else {
        toast({ title: result.error.title, description: result.error.detail, tone: "danger" });
      }
      router.refresh();
    });
  }

  /**
   * ⚠ AC-33, again and for the same reason. Component state, nothing else. Navigating back
   * to `/profile` unmounts this screen, so a value revealed here is masked again the
   * moment the owner leaves — §7.3's "resets on navigation", implemented by not storing it.
   */
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set<string>());

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const group = draft.groups.find((candidate) => candidate.id === groupId) ?? null;
  const groupFields = group === null ? [] : fieldsOfGroup(draft, group);

  const screenState = resolveDataScreenState({
    state,
    isEmpty: groupFields.length === 0,
    // §8D.3 records the filtered-empty cell for this screen as n/a: it edits one group.
    isFiltered: false,
  });

  useEffect(() => {
    if (renaming) nameRef.current?.focus();
  }, [renaming]);

  function toggleReveal(fieldId: string) {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  }

  function addField(newField: NewFieldDraft) {
    if (group === null) return;
    dispatch({ kind: "add-field", groupId, draft: newField });
    mutate(
      () =>
        createFieldAction({
          groupId,
          category: group.category,
          type: newField.type,
          label: newField.label,
          value: newField.value,
        }),
      () => toast({ title: `Added ${newField.label}` }),
    );
  }

  function deleteField(field: ProfileField) {
    const cardCount = cardNamesUsing(cards, field.id).length;
    dispatch({ kind: "delete-field", fieldId: field.id });
    mutate(
      () => deleteFieldAction(field.id),
      () =>
        toast({
          title: `Deleted ${field.label}`,
          // E-40's other half, said out loud: the affected cards lose the row rather than
          // rendering a ghost of it. The API archives rather than erases, so their history holds.
          description:
            cardCount === 0
              ? undefined
              : `${cardCount} ${cardCount === 1 ? "card" : "cards"} stopped showing it.`,
          tone: "danger",
        }),
    );
  }

  /**
   * Move one field, send the whole order.
   *
   * `position` is global across a profile upstream, not per-group, so sending only this group's
   * ids would renumber them against positions the other sections still hold. `globalFieldOrder`
   * reads the complete display order off the echo *after* the local move has been applied.
   */
  function moveField(field: ProfileField, direction: -1 | 1) {
    const moved = profileDraftReducer(draft, {
      kind: "move-field",
      groupId,
      fieldId: field.id,
      direction,
    });
    dispatch({ kind: "move-field", groupId, fieldId: field.id, direction });
    mutate(() => reorderFieldsAction(globalFieldOrder(moved)));
  }

  function removeGroup() {
    if (group === null) return;
    const name = group.name;
    mutate(
      () => deleteGroupAction(groupId),
      () => {
        toast({ title: `Removed ${name}`, tone: "danger" });
        // Nothing left to edit on this route.
        router.push("/profile");
      },
    );
  }

  function startRenaming(currentName: string) {
    setNameDraft(currentName);
    setNameError(null);
    setRenaming(true);
  }

  function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = nameDraft.trim();
    if (name.length === 0) {
      setNameError("A group needs a name — it is the heading on your profile.");
      return;
    }
    dispatch({ kind: "rename-group", groupId, name });
    mutate(
      () => renameGroupAction(groupId, name),
      () => toast({ title: `Renamed to ${name}` }),
    );
    setRenaming(false);
  }

  const title = group?.name ?? "Field group";

  let body;
  if (screenState === "loading") {
    body = (
      <div className="pt-8">
        <LoadingSkeleton variant="fields" count={5} label="Loading this field group" />
      </div>
    );
  } else if (screenState === "error" || screenState === "offline") {
    body = (
      <div className="pt-12">
        <ErrorPanel
          error={error}
          onRetry={() => router.refresh()}
          homeHref="/profile"
          homeLabel="Back to profile"
        />
      </div>
    );
  } else if (group === null) {
    // The server half already sent an unknown `groupId` to `not-found.tsx`, so this is the
    // defensive twin of that check rather than the check itself — and it is a panel, never
    // an empty state and never a raw 404 (§11 E-36's rule, applied to R-17).
    body = (
      <div className="pt-12">
        <NotFoundPanel
          overline="Not found"
          title="We couldn't find that field group"
          detail="It may have been renamed, or the link may be wrong."
          backHref="/profile"
          backLabel="Back to profile"
        />
      </div>
    );
  } else if (groupFields.length === 0) {
    // §11 E-08, the same sentence the overview shows for an empty group.
    body = (
      <div data-group-empty={group.id} className="pt-8">
        <EmptyState
          overline="Nothing here yet"
          title={`No fields in ${group.name} yet`}
        >
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <AddFieldDialog group={group} variant="primary" onAdd={addField} />
          </div>
        </EmptyState>
      </div>
    );
  } else {
    body = (
      <div className="pt-8">
        <ol data-field-rows={group.id} className="flex flex-col">
          {groupFields.map((field, index) => (
            <ProfileFieldRow
              key={field.id}
              field={field}
              category={group.category}
              revealed={revealed.has(field.id)}
              onToggleReveal={() => toggleReveal(field.id)}
              onEdit={(patch) => {
                dispatch({
                  kind: "edit-field",
                  fieldId: field.id,
                  label: patch.label,
                  value: patch.value,
                });
                mutate(
                  () => updateFieldAction(field.id, patch),
                  () => toast({ title: `Updated ${patch.label}` }),
                );
              }}
              // Disabled: the API has no `isSensitive` column, so the flag is derived from the
              // field's type. See SENSITIVE_READ_ONLY_REASON.
              onToggleSensitive={() => {}}
              sensitiveReadOnlyReason={SENSITIVE_READ_ONLY_REASON}
              onMove={(direction) => moveField(field, direction)}
              canMoveUp={index > 0}
              canMoveDown={index < groupFields.length - 1}
              onDelete={() => deleteField(field)}
              cardNames={cardNamesUsing(cards, field.id)}
            />
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <AddFieldDialog group={group} onAdd={addField} />
          <Link href="/profile" className={buttonClassName({ variant: "text-link" })}>
            Back to profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ScreenStateRoot
      state={screenState}
      as="section"
      aria-label={group === null ? "Field group" : `${group.name} field group`}
      className="pb-16"
    >
      <PageHeader
        overline="Field group"
        title={title}
        actions={
          group === null || renaming ? null : (
            <>
              <Button
                variant="secondary"
                data-group-rename={group.id}
                onClick={() => startRenaming(group.name)}
              >
                Rename group
              </Button>
              <ConfirmDialog
                tone="destructive"
                title={`Remove ${group.name}?`}
                detail="This removes the group and everything in it."
                // The part nobody would guess, in the owner's own terms. The API archives the
                // group AND every field inside it, so this is not just losing a heading.
                consequence={
                  groupFields.length === 0
                    ? "It has no fields, so nothing else goes with it."
                    : `Its ${groupFields.length} ${groupFields.length === 1 ? "field" : "fields"} go with it, and any card showing them stops.`
                }
                confirmLabel="Remove group"
                onConfirm={removeGroup}
                trigger={
                  <Button variant="destructive" data-group-delete={group.id}>
                    Remove group
                  </Button>
                }
              />
              <Link href="/profile" className={buttonClassName({ variant: "text-link" })}>
                Back to profile
              </Link>
            </>
          )
        }
      />

      {renaming && group !== null ? (
        <form
          data-group-rename-form={group.id}
          onSubmit={submitRename}
          className="flex flex-col gap-3 border-b border-line py-6 sm:flex-row sm:items-end"
        >
          <Input
            ref={nameRef}
            label="Group name"
            value={nameDraft}
            error={nameError}
            onChange={(event) => setNameDraft(event.target.value)}
            fieldClassName="min-w-0 flex-1"
          />
          <div className="flex shrink-0 items-center gap-2">
            <Button type="submit">Save name</Button>
            <Button type="button" variant="secondary" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {body}
    </ScreenStateRoot>
  );
}
