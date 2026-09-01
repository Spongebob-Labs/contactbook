/**
 * `profile` — 14 endpoints. The largest surface, and the one the UI leans on hardest.
 *
 * Two read models, on purpose:
 * - `profileMe()` → nested (`identity` + `personal` + `work[]` + `business[]` + `socials[]`
 *   + `financial[]`). This is what a profile screen and a card render from.
 * - `listFields()` → the flat, position-ordered list. This is what the field editor and the
 *   card field-picker use, because both work in terms of individual field ids.
 */

import "server-only";

import { authed } from "@/lib/api/server";
import type {
  CompleteOnboardingDto,
  CreateProfileFieldDto,
  CreateProfileFieldGroupDto,
  MeResponseDto,
  OnboardingResponseDto,
  PhotoResponseDto,
  ProfileFieldGroupResponseDto,
  ProfileFieldResponseDto,
  ReorderProfileFieldsDto,
  UpdateProfileFieldDto,
  UpdateProfileFieldGroupDto,
  ApiFieldCategory,
  ApiGroupCategory,
} from "@/lib/api/schema";

export function profileMe(): Promise<MeResponseDto> {
  return authed({ method: "GET", path: "/profile/me" });
}

/**
 * One-shot first-time setup.
 *
 * @throws `ONBOARDING_ALREADY_COMPLETED` (409) on a second call — so the caller must check
 * `onboardingCompleted` first rather than relying on the error, or a returning user sees a
 * failure on a screen they should never have reached.
 * @throws `CUSTOM_FIELDS_TOO_MANY`, `CUSTOM_FIELD_KEY_TOO_LONG`, `CUSTOM_FIELD_VALUE_TOO_LONG`.
 */
export function completeOnboarding(body: CompleteOnboardingDto): Promise<OnboardingResponseDto> {
  return authed({ method: "POST", path: "/profile/onboarding", body });
}

export function listFields(options?: {
  category?: ApiFieldCategory;
  includeArchived?: boolean;
}): Promise<ProfileFieldResponseDto[]> {
  return authed({
    method: "GET",
    path: "/profile/fields",
    query: { category: options?.category, includeArchived: options?.includeArchived },
  });
}

/** @throws `PHOTO_VIA_UPLOAD_ONLY`, `FIELD_ENCRYPTION_NOT_CONFIGURED`. */
export function createField(body: CreateProfileFieldDto): Promise<ProfileFieldResponseDto> {
  return authed({ method: "POST", path: "/profile/fields", body });
}

/** @throws `PROFILE_FIELD_NOT_FOUND`. */
export function getField(id: string): Promise<ProfileFieldResponseDto> {
  return authed({ method: "GET", path: `/profile/fields/${encodeURIComponent(id)}` });
}

/** `type` is immutable — delete and recreate to change it. @throws `PROFILE_FIELD_NOT_FOUND`. */
export function updateField(
  id: string,
  body: UpdateProfileFieldDto,
): Promise<ProfileFieldResponseDto> {
  return authed({ method: "PATCH", path: `/profile/fields/${encodeURIComponent(id)}`, body });
}

/** Soft delete — archived, so card history stays displayable. @throws `PROFILE_FIELD_NOT_FOUND`. */
export function deleteField(id: string): Promise<void> {
  return authed({ method: "DELETE", path: `/profile/fields/${encodeURIComponent(id)}` });
}

/**
 * All-or-nothing reorder.
 *
 * ⚠ `PUT /profile/fields/order` must be routed before `/profile/fields/{id}` upstream; it is,
 * but note the shape — this is not a field id, it is a literal path segment.
 *
 * @throws `PROFILE_FIELD_NOT_OWNED` (403) — and *nothing* is reordered when it fires.
 */
export function reorderFields(body: ReorderProfileFieldsDto): Promise<void> {
  return authed({ method: "PUT", path: "/profile/fields/order", body });
}

/** Each group arrives with its own fields, already ordered. */
export function listGroups(options?: {
  category?: ApiGroupCategory;
  includeArchived?: boolean;
}): Promise<ProfileFieldGroupResponseDto[]> {
  return authed({
    method: "GET",
    path: "/profile/groups",
    query: { category: options?.category, includeArchived: options?.includeArchived },
  });
}

/** One instance of a repeatable thing — a specific job, business, bank account or social profile. */
export function createGroup(
  body: CreateProfileFieldGroupDto,
): Promise<ProfileFieldGroupResponseDto> {
  return authed({ method: "POST", path: "/profile/groups", body });
}

/** @throws `PROFILE_FIELD_GROUP_NOT_FOUND`. */
export function updateGroup(
  id: string,
  body: UpdateProfileFieldGroupDto,
): Promise<ProfileFieldGroupResponseDto> {
  return authed({ method: "PATCH", path: `/profile/groups/${encodeURIComponent(id)}`, body });
}

/**
 * ⚠ Archives the group **and every field in it** — removing a job takes its phone, email and
 * title with it. The confirm dialog has to say so.
 *
 * @throws `PROFILE_FIELD_GROUP_NOT_FOUND`.
 */
export function deleteGroup(id: string): Promise<void> {
  return authed({ method: "DELETE", path: `/profile/groups/${encodeURIComponent(id)}` });
}

/**
 * JPEG / PNG / WebP, up to 20 MB. Replacing deletes the previous object from storage.
 *
 * @throws `PHOTO_STORAGE_NOT_CONFIGURED` (409), `PHOTO_TOO_LARGE` (413),
 * `PHOTO_TYPE_UNSUPPORTED` (415).
 */
export function uploadPhoto(file: File): Promise<PhotoResponseDto> {
  const form = new FormData();
  form.set("file", file);
  return authed({ method: "POST", path: "/profile/photo", form });
}

/** @throws `PHOTO_NOT_FOUND`. */
export function deletePhoto(): Promise<void> {
  return authed({ method: "DELETE", path: "/profile/photo" });
}
