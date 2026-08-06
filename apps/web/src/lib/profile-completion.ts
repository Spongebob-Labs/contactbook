import type { ProfileMeResponse } from "@/lib/types";

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasInitializedProfile(profile: ProfileMeResponse | null) {
  if (!profile) {
    return false;
  }
  return Boolean(
    profile.personal.groupId ||
      profile.work.length > 0 ||
      profile.business.length > 0 ||
      profile.socials.length > 0,
  );
}

function hasAddress(profile: ProfileMeResponse | null) {
  const address = profile?.personal.postalAddress;
  if (!address) {
    return false;
  }
  return [
    address.street,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ].some(hasText);
}

function hasSocialLink(profile: ProfileMeResponse | null) {
  return Boolean(
    profile?.socials.some((item) =>
      [
        item.facebook,
        item.website,
        item.linkedin,
        item.blog,
        item.twitter,
        item.whatsApp,
        item.custom?.instagram,
      ].some(hasText),
    ),
  );
}

const SECTION_LABELS = [
  "Add identity details",
  "Add profile records",
  "Add address",
  "Add work experience",
  "Add social profiles",
] as const;

export function getProfileCompletionItems(profile: ProfileMeResponse | null) {
  const missing = new Set(getMissingProfileSections(profile));
  return SECTION_LABELS.map((label) => ({
    label,
    done: !missing.has(label),
  }));
}

export function getMissingProfileSections(profile: ProfileMeResponse | null) {
  const missing: string[] = [];
  const hasIdentity = Boolean(
    hasText(profile?.identity.firstName) ||
      hasText(profile?.identity.lastName) ||
      hasText(profile?.identity.primaryEmail) ||
      hasText(profile?.identity.primaryPhone),
  );
  if (!hasIdentity) missing.push(SECTION_LABELS[0]);
  if (!hasInitializedProfile(profile)) missing.push(SECTION_LABELS[1]);
  if (!hasAddress(profile)) missing.push(SECTION_LABELS[2]);
  if (!(profile && (profile.work.length > 0 || profile.business.length > 0))) {
    missing.push(SECTION_LABELS[3]);
  }
  if (!hasSocialLink(profile)) missing.push(SECTION_LABELS[4]);
  return missing;
}

export function getProfileCompletion(profile: ProfileMeResponse | null) {
  const items = [
    Boolean(
      hasText(profile?.identity.firstName) ||
        hasText(profile?.identity.lastName) ||
        hasText(profile?.identity.primaryEmail) ||
        hasText(profile?.identity.primaryPhone),
    ),
    hasInitializedProfile(profile),
    hasAddress(profile),
    Boolean(profile && (profile.work.length > 0 || profile.business.length > 0)),
    hasSocialLink(profile),
  ];
  const completed = items.filter(Boolean).length;
  const total = items.length;

  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
  };
}
