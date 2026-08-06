import { apiFetch } from "@/lib/api";
import type { ProfileMeResponse } from "@/lib/types";

export type ProfileGroupCategory = "WORK" | "BUSINESS" | "SOCIAL" | "FINANCIAL";

export async function fetchProfileMe(): Promise<ProfileMeResponse> {
  return apiFetch<ProfileMeResponse>("/v1/profile/me");
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
