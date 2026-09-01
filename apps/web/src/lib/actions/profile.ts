"use server";

/**
 * Profile mutations — the write half of `/profile`.
 *
 * Ten of the fourteen `profile` endpoints. The four reads are not here: they belong to the
 * screen's server component, which fetches them directly.
 *
 * ## The one translation every write has to make
 * The profile screen speaks in **groups**, because that is what it renders — one collapsible
 * section per group, with an "Add field" inside each. But some of those sections are synthetic:
 * `PERSONAL`, `IDENTITY` and `CUSTOM` fields are *ungrouped* upstream and only have a section
 * because `map.ts` invented one to hold them.
 *
 * So a write aimed at a section has two possible meanings, and confusing them is a 404:
 *
 * · real group id → `groupId: <id>`, the field joins that job/account
 * · synthetic id  → **no** `groupId`, plus the category the synthetic group stands for
 *
 * `resolveTarget` below is the only place that decision is made.
 *
 * ## Why every action revalidates
 * The optimistic update in the client is a guess with a temporary id. Revalidating replaces it
 * with the server's real record — which matters most for `createField`, whose local id would
 * otherwise be sent back to the API by the next reorder and rejected as not-yours.
 */

import { revalidatePath } from "next/cache";

import { profile } from "@/lib/api";
import { categoryOfSyntheticGroup, isSyntheticGroupId } from "@/lib/api/map";
import type { ApiFieldCategory, ApiFieldType, ApiGroupCategory } from "@/lib/api/schema";
import { failFrom, failLocally, succeed, type ActionResult } from "@/lib/actions/result";

const PROFILE_PATH = "/profile";

/**
 * Where a write aimed at a section actually lands.
 *
 * Returns the `groupId` to send (or `undefined` for ungrouped) plus the `category` to stamp.
 * A synthetic id whose category cannot be recovered is a bug in the caller rather than
 * something to paper over, so it fails loudly instead of silently writing an ungrouped field.
 */
function resolveTarget(
  groupId: string,
  fallbackCategory: ApiFieldCategory,
): { groupId?: string; category: ApiFieldCategory } | null {
  if (!isSyntheticGroupId(groupId)) return { groupId, category: fallbackCategory };
  const category = categoryOfSyntheticGroup(groupId);
  return category === null ? null : { category };
}

/* ── Fields ──────────────────────────────────────────────────────────────────────────── */

export interface CreateFieldInput {
  /** The section the owner pressed "Add field" inside. May be synthetic — see `resolveTarget`. */
  groupId: string;
  /** The section's category, used when the section is synthetic. */
  category: ApiFieldCategory;
  type: ApiFieldType;
  label: string;
  value: string;
}

export async function createFieldAction(
  input: CreateFieldInput,
): Promise<ActionResult<{ id: string }>> {
  if (input.label.trim().length === 0) return failLocally("Give the field a label.");
  if (input.value.trim().length === 0) return failLocally("Give the field a value.");

  // The API rejects PHOTO here and says so; catching it locally spends no round trip and lets
  // the message point at the upload button instead of at the form.
  if (input.type === "PHOTO") {
    return failLocally("Add a photo with the upload button instead.");
  }

  const target = resolveTarget(input.groupId, input.category);
  if (target === null) return failLocally("We couldn't work out where that field belongs.");

  try {
    const created = await profile.createField({
      category: target.category,
      type: input.type,
      label: input.label.trim(),
      value: input.value.trim(),
      groupId: target.groupId,
    });
    revalidatePath(PROFILE_PATH);
    return succeed({ id: created.id });
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/** `type` is immutable upstream — only the label and value can move. */
export async function updateFieldAction(
  fieldId: string,
  patch: { label: string; value: string },
): Promise<ActionResult<undefined>> {
  if (patch.label.trim().length === 0) return failLocally("Give the field a label.");

  try {
    await profile.updateField(fieldId, { label: patch.label.trim(), value: patch.value.trim() });
    revalidatePath(PROFILE_PATH);
    return succeed(undefined);
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/**
 * Archive, not erase. The API soft-deletes so that any card which referenced the field stays
 * displayable — which is the other half of §11 E-40, where a card naming a removed field must
 * report it as dropped rather than render a ghost row.
 */
export async function deleteFieldAction(fieldId: string): Promise<ActionResult<undefined>> {
  try {
    await profile.deleteField(fieldId);
    revalidatePath(PROFILE_PATH);
    return succeed(undefined);
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/**
 * Reorder, with the **whole** list.
 *
 * `position` is global across a profile rather than per-group, so a move inside one section
 * shifts the absolute order. Sending only that section's ids would renumber them against
 * positions the other sections still hold, and the result reads as fields jumping between
 * groups. The client therefore computes the complete order and sends all of it.
 *
 * All-or-nothing upstream: one foreign id and nothing moves (403 `PROFILE_FIELD_NOT_OWNED`).
 */
export async function reorderFieldsAction(
  orderedIds: readonly string[],
): Promise<ActionResult<undefined>> {
  if (orderedIds.length === 0) return succeed(undefined);

  try {
    await profile.reorderFields({ orderedIds: [...orderedIds] });
    revalidatePath(PROFILE_PATH);
    return succeed(undefined);
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/* ── Groups ──────────────────────────────────────────────────────────────────────────── */

/**
 * Rename a group.
 *
 * ⚠ Only a **real** group can be renamed. A synthetic section's name is the category's own word
 * ("Personal"), which exists nowhere upstream and therefore cannot be stored — so the screen
 * hides the rename control on those rather than offering an edit that would evaporate.
 */
export async function renameGroupAction(
  groupId: string,
  name: string,
): Promise<ActionResult<undefined>> {
  if (isSyntheticGroupId(groupId)) {
    return failLocally("This section's name comes from its category and can't be changed.");
  }
  if (name.trim().length === 0) return failLocally("Give the group a name.");

  try {
    await profile.updateGroup(groupId, { tag: name.trim() });
    revalidatePath(PROFILE_PATH);
    return succeed(undefined);
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/** One instance of a repeatable thing — another job, another bank account. */
export async function createGroupAction(
  category: ApiGroupCategory,
  tag: string,
): Promise<ActionResult<{ id: string }>> {
  if (tag.trim().length === 0) return failLocally("Give the group a name.");

  try {
    const created = await profile.createGroup({ category, tag: tag.trim() });
    revalidatePath(PROFILE_PATH);
    return succeed({ id: created.id });
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/**
 * ⚠ Archives the group **and every field in it** — removing a job takes its phone, email and
 * title with it, not just the job label. Any confirm dialog in front of this has to say so.
 */
export async function deleteGroupAction(groupId: string): Promise<ActionResult<undefined>> {
  if (isSyntheticGroupId(groupId)) {
    return failLocally("This section isn't a group, so there's nothing to remove.");
  }

  try {
    await profile.deleteGroup(groupId);
    revalidatePath(PROFILE_PATH);
    return succeed(undefined);
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/* ── Photo ───────────────────────────────────────────────────────────────────────────── */

/**
 * Upload or replace the profile photo.
 *
 * Takes `FormData` rather than a `File` because that is what a Server Action can receive from a
 * form without the file being buffered into a JSON payload first. The API's own limits — JPEG /
 * PNG / WebP, 20 MB — are enforced upstream and surface as `PHOTO_TYPE_UNSUPPORTED` (415) and
 * `PHOTO_TOO_LARGE` (413), both of which already have copy.
 */
export async function uploadPhotoAction(form: FormData): Promise<ActionResult<{ url: string }>> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return failLocally("Choose an image to upload.");
  }

  try {
    const photo = await profile.uploadPhoto(file);
    revalidatePath(PROFILE_PATH);
    return succeed({ url: photo.url });
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/** Removing the photo also deletes the stored object; the avatar falls back to the monogram. */
export async function deletePhotoAction(): Promise<ActionResult<undefined>> {
  try {
    await profile.deletePhoto();
    revalidatePath(PROFILE_PATH);
    return succeed(undefined);
  } catch (thrown) {
    return failFrom(thrown);
  }
}
