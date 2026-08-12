import { apiFetch } from "@/lib/api";
import type { ProfileMeResponse } from "@/lib/types";

export type ProfileGroupCategory = "WORK" | "BUSINESS" | "SOCIAL" | "FINANCIAL";

export async function fetchProfileMe(): Promise<ProfileMeResponse> {
  return apiFetch<ProfileMeResponse>("/v1/profile/me");
}

/** One profile field row, with the id `POST /cards/:id/field-mappings` needs. */
export type ProfileFieldRow = {
  id: string;
  type: string;
  label: string | null;
  /** Null for ADDRESS rows, whose parts live on the field's address record. */
  value: string | null;
  groupId: string;
};

/**
 * Every profile field with its **id** — the one thing `GET /v1/profile/me` does
 * not give up (it returns `fieldId` for financial rows only, and those are
 * excluded from vCards).
 *
 * This is what makes a card fillable from the client at all: a card's content is
 * `CardFieldMapping` rows, `POST /v1/cards/:cardId/field-mappings` needs a
 * `fieldId`, and this is the only endpoint that hands one out. Confirmed live
 * 2026-08-11 — it 200s on production even though `apps/api` in this checkout has
 * no such route, so do not delete it on the strength of a local grep.
 */
export async function listProfileFields(): Promise<ProfileFieldRow[]> {
  const rows = await apiFetch<unknown>("/v1/profile/me/fields");
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.flatMap((row): ProfileFieldRow[] => {
    if (!row || typeof row !== "object") {
      return [];
    }
    const record = row as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const type = typeof record.type === "string" ? record.type : "";
    const groupId = typeof record.groupId === "string" ? record.groupId : "";
    if (!id || !type) {
      return [];
    }
    return [
      {
        id,
        type,
        label: typeof record.label === "string" ? record.label : null,
        value: typeof record.value === "string" ? record.value : null,
        groupId,
      },
    ];
  });
}

export async function patchProfileMe(
  body: Record<string, unknown>,
): Promise<ProfileMeResponse> {
  return apiFetch<ProfileMeResponse>("/v1/profile/me", {
    method: "PATCH",
    body,
  });
}

export async function completeProfileOnboarding(
  body: Record<string, unknown>,
): Promise<ProfileMeResponse> {
  return apiFetch<ProfileMeResponse>("/v1/profile/onboarding", {
    method: "POST",
    body,
  });
}

export async function deleteProfileGroup(
  groupId: string,
  category: ProfileGroupCategory,
): Promise<ProfileMeResponse> {
  return apiFetch<ProfileMeResponse>("/v1/profile/me/groups", {
    method: "DELETE",
    body: { groupId, category },
  });
}

export async function uploadProfilePhoto(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<{ url: string }>("/v1/photo", {
    method: "POST",
    body: formData,
  });
}

export async function deleteProfilePhoto(url: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/v1/photo", {
    method: "DELETE",
    body: { url },
  });
}
