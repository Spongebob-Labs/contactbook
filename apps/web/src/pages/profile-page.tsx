import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Camera, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CompletionChecklist,
  CompletionRing,
} from "@/components/ui/completion-ring";
import {
  EditField,
  EditableSection,
  ViewField,
} from "@/components/ui/editable-section";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import {
  deleteProfileGroup,
  deleteProfilePhoto,
  fetchProfileMe,
  patchProfileMe,
  uploadProfilePhoto,
  type ProfileGroupCategory,
} from "@/lib/profile-api";
import {
  getProfileCompletion,
  getProfileCompletionItems,
} from "@/lib/profile-completion";
import type { PostalAddress, ProfileMeResponse } from "@/lib/types";

type WorkGroup = ProfileMeResponse["work"][number];
type BusinessGroup = ProfileMeResponse["business"][number];
type SocialGroup = ProfileMeResponse["socials"][number];

/**
 * The section currently open for editing. Work and business are repeatable, so
 * they carry an index; an index equal to the list length is a row being added
 * that the server has not seen yet.
 */
type EditTarget =
  | { kind: "personal" }
  | { kind: "social" }
  | { kind: "work"; index: number }
  | { kind: "business"; index: number };

const MAX_PROFILE_PHOTO_BYTES = 1_048_576;
const ALLOWED_PROFILE_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `groupId` is `@IsUUID()` on every upsert DTO, so a row the server has not
 * created yet must omit the key rather than invent a placeholder — omitting it
 * is also what tells `applyGroupArray` to create the group.
 */
function isServerGroupId(value: string | null | undefined): boolean {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Social keys `PATCH /v1/profile/me` accepts at the top level. The API runs
 * `forbidNonWhitelisted`, so anything outside `ProfileMeSocialUpsertDto` — and
 * that includes `linkedin` and `github`, which `GET /profile/me` happily
 * returns — makes the whole request 400. Those two travel in `custom` instead,
 * the same route Instagram has always taken on this page.
 */
const SOCIAL_TOP_LEVEL_KEYS: ReadonlyArray<keyof SocialGroup> = [
  "website",
  "facebook",
  "twitter",
  "whatsApp",
  "blog",
  "skype",
];

function valueOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const next = String(value).trim();
  return next || null;
}

function fullName(profile: ProfileMeResponse): string {
  return `${profile.identity.firstName} ${profile.identity.lastName}`.trim();
}

function formatAddress(address: Partial<PostalAddress> | undefined): string {
  if (!address) return "";
  return [address.street, address.city, address.state, address.pincode, address.country]
    .filter(Boolean)
    .join(", ");
}

function initialsFromText(value: string | null | undefined): string {
  const words = valueOrNull(value)?.split(/\s+/).filter(Boolean) ?? [];
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "CB";
}

/** Writes a trimmed value into a `custom` bag, or drops the key when cleared. */
function setCustom(
  custom: Record<string, string>,
  key: string,
  value: string,
): void {
  const next = value.trim();
  if (next) {
    custom[key] = next;
  } else {
    delete custom[key];
  }
}

function customPayload(custom: Record<string, string>) {
  return Object.keys(custom).length > 0 ? { custom } : {};
}

type PersonalDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  address: string;
};

type SocialDraft = {
  linkedin: string;
  twitter: string;
  instagram: string;
  website: string;
};

type WorkDraft = {
  tag: string;
  company: string;
  title: string;
  industry: string;
  workEmail: string;
};

type BusinessDraft = {
  tag: string;
  name: string;
  title: string;
  regNumber: string;
  businessEmail: string;
};

function personalDraftFrom(profile: ProfileMeResponse): PersonalDraft {
  return {
    firstName: profile.identity.firstName ?? "",
    lastName: profile.identity.lastName ?? "",
    phone: profile.identity.primaryPhone || profile.personal.mobile || "",
    email: profile.identity.primaryEmail || profile.personal.email || "",
    dateOfBirth: profile.personal.dateOfBirth ?? "",
    address: formatAddress(profile.personal.postalAddress),
  };
}

function socialDraftFrom(profile: ProfileMeResponse): SocialDraft {
  const social = profile.socials[0];
  return {
    linkedin: social?.custom?.linkedin ?? social?.linkedin ?? "",
    twitter: social?.twitter ?? "",
    instagram: social?.custom?.instagram ?? "",
    website: social?.website ?? "",
  };
}

function workDraftFrom(group: Partial<WorkGroup> | null): WorkDraft {
  return {
    tag: group?.tag ?? "Current Work",
    company: group?.companyName ?? "",
    title: group?.workTitle ?? "",
    industry: group?.custom?.industry ?? "",
    workEmail: group?.workEmail ?? "",
  };
}

function businessDraftFrom(group: Partial<BusinessGroup> | null): BusinessDraft {
  return {
    tag: group?.tag ?? "Primary Business",
    name: group?.businessName ?? "",
    title: group?.businessTitle ?? "",
    regNumber: group?.businessRegNumber ?? "",
    businessEmail: group?.businessEmail ?? "",
  };
}

function applyWorkDraft(
  group: Partial<WorkGroup> | null,
  draft: WorkDraft,
): Partial<WorkGroup> {
  const custom = { ...(group?.custom ?? {}) };
  setCustom(custom, "industry", draft.industry);
  return {
    ...(group ?? {}),
    tag: draft.tag.trim() || "Current Work",
    companyName: valueOrNull(draft.company),
    workTitle: valueOrNull(draft.title),
    workEmail: valueOrNull(draft.workEmail),
    custom,
  };
}

function applyBusinessDraft(
  group: Partial<BusinessGroup> | null,
  draft: BusinessDraft,
): Partial<BusinessGroup> {
  return {
    ...(group ?? {}),
    tag: draft.tag.trim() || "Primary Business",
    businessName: valueOrNull(draft.name),
    businessTitle: valueOrNull(draft.title),
    businessRegNumber: valueOrNull(draft.regNumber),
    businessEmail: valueOrNull(draft.businessEmail),
  };
}

/**
 * `PATCH /v1/profile/me` reconciles a group array destructively on both axes:
 * `applyGroupArray` deletes any group of that category the body leaves out, and
 * `syncGroupFields` deletes any field the row leaves out. So a save always
 * resends the whole list, and every row resends every key the DTO accepts —
 * including the logos, phone numbers, and addresses this page does not show.
 */
function workPayload(row: Partial<WorkGroup>): Record<string, unknown> {
  return {
    ...(isServerGroupId(row.groupId) ? { groupId: row.groupId } : {}),
    tag: valueOrNull(row.tag) ?? "Current Work",
    companyName: valueOrNull(row.companyName),
    companyLogo: valueOrNull(row.companyLogo),
    companyRegNumber: valueOrNull(row.companyRegNumber),
    workTitle: valueOrNull(row.workTitle),
    workMobile: valueOrNull(row.workMobile),
    workLandline: valueOrNull(row.workLandline),
    workFax: valueOrNull(row.workFax),
    workEmail: valueOrNull(row.workEmail),
    website: valueOrNull(row.website),
    ...(row.workPostalAddress
      ? { workPostalAddress: row.workPostalAddress }
      : {}),
    ...customPayload({ ...(row.custom ?? {}) }),
  };
}

function businessPayload(row: Partial<BusinessGroup>): Record<string, unknown> {
  return {
    ...(isServerGroupId(row.groupId) ? { groupId: row.groupId } : {}),
    tag: valueOrNull(row.tag) ?? "Primary Business",
    businessName: valueOrNull(row.businessName),
    businessLogo: valueOrNull(row.businessLogo),
    businessRegNumber: valueOrNull(row.businessRegNumber),
    businessTitle: valueOrNull(row.businessTitle),
    businessMobile: valueOrNull(row.businessMobile),
    businessLandline: valueOrNull(row.businessLandline),
    businessFax: valueOrNull(row.businessFax),
    businessEmail: valueOrNull(row.businessEmail),
    website: valueOrNull(row.website),
    ...(row.businessPostalAddress
      ? { businessPostalAddress: row.businessPostalAddress }
      : {}),
    ...customPayload({ ...(row.custom ?? {}) }),
  };
}

/**
 * The socials group, resent whole. Only keys with a value are included: the
 * server reconciles destructively, so omitting an empty key deletes a field
 * that was never there, while sending a key the DTO rejects would 400.
 */
function socialPayload(
  group: SocialGroup | undefined,
  draft: SocialDraft,
): Record<string, unknown> {
  const custom = { ...(group?.custom ?? {}) };
  setCustom(custom, "linkedin", draft.linkedin);
  setCustom(custom, "instagram", draft.instagram);
  // `github` has no input on this page and no home in the DTO, so carry it
  // across rather than letting the destructive sync drop it.
  const github = valueOrNull(group?.github);
  if (github && !custom.github) {
    custom.github = github;
  }

  const payload: Record<string, unknown> = {
    ...(isServerGroupId(group?.groupId) ? { groupId: group?.groupId } : {}),
    tag: valueOrNull(group?.tag) ?? "Social",
    twitter: valueOrNull(draft.twitter),
    website: valueOrNull(draft.website),
    ...customPayload(custom),
  };

  for (const key of SOCIAL_TOP_LEVEL_KEYS) {
    if (key in payload) continue;
    const carried = valueOrNull(group?.[key]);
    if (carried) {
      payload[key] = carried;
    }
  }

  return payload;
}

function workSectionTitle(
  group: Partial<WorkGroup> | null,
  index: number,
  total: number,
): string {
  if (!group) return "New workplace";
  const name = valueOrNull(group.companyName);
  if (name) return `Work · ${name}`;
  return total > 1 ? `Work ${index + 1}` : "Work";
}

function businessSectionTitle(
  group: Partial<BusinessGroup> | null,
  index: number,
  total: number,
): string {
  const name = valueOrNull(group?.businessName);
  if (name) return `Business · ${name}`;
  return total > 1 ? `Business ${index + 1}` : "Business";
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMutatingPhoto, setIsMutatingPhoto] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [personalDraft, setPersonalDraft] = useState<PersonalDraft | null>(null);
  const [socialDraft, setSocialDraft] = useState<SocialDraft | null>(null);
  const [workDraft, setWorkDraft] = useState<WorkDraft | null>(null);
  const [businessDraft, setBusinessDraft] = useState<BusinessDraft | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchProfileMe();
        if (isMounted) {
          setProfile(data);
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load profile", err);
          setProfile(null);
          setError(friendlyErrorMessages.load);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const completion = getProfileCompletion(profile);
  const checklist = getProfileCompletionItems(profile);

  const cancelEdit = () => {
    setEditing(null);
    setPersonalDraft(null);
    setSocialDraft(null);
    setWorkDraft(null);
    setBusinessDraft(null);
  };

  /** Opens one section for editing, discarding any other section's draft. */
  const startEdit = (target: EditTarget) => {
    if (!profile) return;
    cancelEdit();
    if (target.kind === "personal") {
      setPersonalDraft(personalDraftFrom(profile));
    }
    if (target.kind === "social") {
      setSocialDraft(socialDraftFrom(profile));
    }
    if (target.kind === "work") {
      setWorkDraft(workDraftFrom(profile.work[target.index] ?? null));
    }
    if (target.kind === "business") {
      setBusinessDraft(businessDraftFrom(profile.business[target.index] ?? null));
    }
    setEditing(target);
  };

  const isEditing = (target: EditTarget): boolean => {
    if (!editing || editing.kind !== target.kind) return false;
    if (editing.kind === "work" || editing.kind === "business") {
      return "index" in target && editing.index === target.index;
    }
    return true;
  };

  /**
   * Every save patches, then adopts the response rather than a locally merged
   * copy — that is the only way a row created in this save picks up its real
   * `groupId`, and it keeps server-side normalisation visible.
   */
  const runSave = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const updated = await patchProfileMe(body);
      setProfile(updated);
      toast.success("Profile saved");
      cancelEdit();
    } catch (err) {
      logUiError("Could not save profile section", err);
      toast.error("Couldn't save — check your connection");
    } finally {
      setSaving(false);
    }
  };

  const savePersonal = async () => {
    if (!profile || !personalDraft) return;
    const [street, city, ...rest] = personalDraft.address
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    await runSave({
      identity: {
        ...profile.identity,
        firstName: personalDraft.firstName.trim(),
        lastName: personalDraft.lastName.trim(),
        primaryPhone: personalDraft.phone.trim(),
        primaryEmail: personalDraft.email.trim(),
      },
      personal: {
        mobile: personalDraft.phone.trim(),
        email: personalDraft.email.trim(),
        dateOfBirth: personalDraft.dateOfBirth.trim() || null,
        postalAddress: personalDraft.address.trim()
          ? {
              street: street || personalDraft.address.trim(),
              city: city || "",
              state: rest[0] ?? null,
              pincode: rest[1] ?? null,
              country: rest[2] || "US",
            }
          : profile.personal.postalAddress,
      },
    });
  };

  const saveSocial = async () => {
    if (!profile || !socialDraft) return;
    await runSave({ socials: [socialPayload(profile.socials[0], socialDraft)] });
  };

  const saveWork = async (index: number) => {
    if (!profile || !workDraft) return;
    const rows: Array<Partial<WorkGroup>> = profile.work.map((group, i) =>
      i === index ? applyWorkDraft(group, workDraft) : group,
    );
    if (index >= profile.work.length) {
      rows.push(applyWorkDraft(null, workDraft));
    }
    await runSave({ work: rows.map(workPayload) });
  };

  const saveBusiness = async (index: number) => {
    if (!profile || !businessDraft) return;
    const rows: Array<Partial<BusinessGroup>> = profile.business.map((group, i) =>
      i === index ? applyBusinessDraft(group, businessDraft) : group,
    );
    await runSave({ business: rows.map(businessPayload) });
  };

  const handlePhotoUpload = async (file: File | undefined) => {
    if (!file || !profile) {
      return;
    }

    if (!ALLOWED_PROFILE_PHOTO_TYPES.has(file.type)) {
      toast.error("Choose a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      toast.error("Choose an image under 1 MB.");
      return;
    }

    setIsMutatingPhoto(true);
    try {
      const previousPhotoUrl = profile.identity.profilePhoto;
      const { url } = await uploadProfilePhoto(file);
      const updated = await patchProfileMe({
        identity: {
          ...profile.identity,
          profilePhoto: url,
        },
      });
      if (previousPhotoUrl) {
        await deleteProfilePhoto(previousPhotoUrl).catch(() => undefined);
      }
      setProfile(updated);
      toast.success("Profile photo updated.");
    } catch (err) {
      logUiError("Could not upload profile photo", err);
      toast.error("We couldn't update your profile photo. Please try again.");
    } finally {
      setIsMutatingPhoto(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!profile?.identity.profilePhoto) {
      return;
    }

    setIsMutatingPhoto(true);
    try {
      const previousPhotoUrl = profile.identity.profilePhoto;
      await deleteProfilePhoto(previousPhotoUrl);
      const updated = await patchProfileMe({
        identity: {
          ...profile.identity,
          profilePhoto: null,
        },
      });
      setProfile(updated);
      toast.success("Profile photo removed.");
    } catch (err) {
      logUiError("Could not delete profile photo", err);
      toast.error("We couldn't remove your profile photo. Please try again.");
    } finally {
      setIsMutatingPhoto(false);
    }
  };

  const handleDeleteGroup = async (
    groupId: string,
    category: ProfileGroupCategory,
    confirmMessage: string,
  ) => {
    if (!window.confirm(confirmMessage)) {
      return;
    }
    setDeletingGroupId(groupId);
    try {
      const updated = await deleteProfileGroup(groupId, category);
      setProfile(updated);
      cancelEdit();
      toast.success("Profile section removed.");
    } catch (err) {
      logUiError("Could not delete profile group", err);
      toast.error("We couldn't remove that section right now.");
    } finally {
      setDeletingGroupId(null);
    }
  };

  const renderRemoveRow = (
    groupId: string | undefined,
    category: ProfileGroupCategory,
    label: string,
  ) => {
    if (!isServerGroupId(groupId) || !groupId) return null;
    return (
      <div className="mt-5 border-t border-border pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={saving || deletingGroupId === groupId}
          onClick={() =>
            void handleDeleteGroup(
              groupId,
              category,
              `Remove this ${label}? Anything only it carried stops appearing on your cards.`,
            )
          }
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {deletingGroupId === groupId ? "Removing…" : `Remove this ${label}`}
        </Button>
      </div>
    );
  };

  const renderWorkSection = (
    group: WorkGroup | null,
    index: number,
    total: number,
  ) => {
    const target: EditTarget = { kind: "work", index };
    const editingThis = isEditing(target);
    return (
      <EditableSection
        key={group?.groupId ?? `work-new-${index}`}
        title={workSectionTitle(group, index, total)}
        editing={editingThis}
        saving={saving}
        onEdit={() => startEdit(target)}
        onCancel={cancelEdit}
        onSave={() => void saveWork(index)}
      >
        {editingThis && workDraft ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <EditField
                label="Label"
                value={workDraft.tag}
                placeholder="Current Work"
                onChange={(value) => setWorkDraft({ ...workDraft, tag: value })}
              />
              <EditField
                label="Company"
                value={workDraft.company}
                onChange={(value) =>
                  setWorkDraft({ ...workDraft, company: value })
                }
              />
              <EditField
                label="Position"
                value={workDraft.title}
                onChange={(value) => setWorkDraft({ ...workDraft, title: value })}
              />
              <EditField
                label="Industry"
                value={workDraft.industry}
                onChange={(value) =>
                  setWorkDraft({ ...workDraft, industry: value })
                }
              />
              <EditField
                label="Work email"
                type="email"
                value={workDraft.workEmail}
                onChange={(value) =>
                  setWorkDraft({ ...workDraft, workEmail: value })
                }
              />
            </div>
            {renderRemoveRow(group?.groupId, "WORK", "workplace")}
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <ViewField label="Company" value={group?.companyName} />
            <ViewField label="Position" value={group?.workTitle} />
            <ViewField label="Industry" value={group?.custom?.industry} />
            <ViewField label="Work email" value={group?.workEmail} />
          </div>
        )}
      </EditableSection>
    );
  };

  const renderBusinessSection = (
    group: BusinessGroup,
    index: number,
    total: number,
  ) => {
    const target: EditTarget = { kind: "business", index };
    const editingThis = isEditing(target);
    return (
      <EditableSection
        key={group.groupId}
        title={businessSectionTitle(group, index, total)}
        editing={editingThis}
        saving={saving}
        onEdit={() => startEdit(target)}
        onCancel={cancelEdit}
        onSave={() => void saveBusiness(index)}
      >
        {editingThis && businessDraft ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <EditField
                label="Label"
                value={businessDraft.tag}
                placeholder="Primary Business"
                onChange={(value) =>
                  setBusinessDraft({ ...businessDraft, tag: value })
                }
              />
              <EditField
                label="Business name"
                value={businessDraft.name}
                onChange={(value) =>
                  setBusinessDraft({ ...businessDraft, name: value })
                }
              />
              <EditField
                label="Title"
                value={businessDraft.title}
                onChange={(value) =>
                  setBusinessDraft({ ...businessDraft, title: value })
                }
              />
              <EditField
                label="Registration number"
                value={businessDraft.regNumber}
                onChange={(value) =>
                  setBusinessDraft({ ...businessDraft, regNumber: value })
                }
              />
              <EditField
                label="Business email"
                type="email"
                value={businessDraft.businessEmail}
                onChange={(value) =>
                  setBusinessDraft({ ...businessDraft, businessEmail: value })
                }
              />
            </div>
            {renderRemoveRow(group.groupId, "BUSINESS", "business")}
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <ViewField label="Business name" value={group.businessName} />
            <ViewField label="Title" value={group.businessTitle} />
            <ViewField
              label="Registration number"
              value={group.businessRegNumber}
            />
            <ViewField label="Business email" value={group.businessEmail} />
          </div>
        )}
      </EditableSection>
    );
  };

  const addingWork =
    profile !== null &&
    editing?.kind === "work" &&
    editing.index >= profile.work.length;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Your profile"
          subtitle="This info appears on your cards"
        />

        {isLoading && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Panel className="space-y-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </Panel>
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        )}

        {!isLoading && error && (
          <Alert className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
            <div>
              <p className="font-medium">Could not load profile</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {friendlyErrorMessages.load}
              </p>
            </div>
          </Alert>
        )}

        {!isLoading && profile && (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <EditableSection
                title="Personal information"
                editing={isEditing({ kind: "personal" })}
                saving={saving}
                onEdit={() => startEdit({ kind: "personal" })}
                onCancel={cancelEdit}
                onSave={() => void savePersonal()}
              >
                <div className="mb-5 flex flex-wrap items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-xl font-semibold">
                    {profile.identity.profilePhoto ? (
                      <img
                        src={profile.identity.profilePhoto}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initialsFromText(fullName(profile))
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={isMutatingPhoto}
                        onChange={(event) => {
                          void handlePhotoUpload(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isMutatingPhoto}
                        onClick={(event) => {
                          const input = event.currentTarget
                            .previousElementSibling as HTMLInputElement | null;
                          input?.click();
                        }}
                      >
                        <Camera className="h-4 w-4" aria-hidden="true" />
                        {isMutatingPhoto ? "Updating…" : "Upload photo"}
                      </Button>
                    </label>
                    {profile.identity.profilePhoto ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isMutatingPhoto}
                        onClick={() => void handlePhotoDelete()}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
                {isEditing({ kind: "personal" }) && personalDraft ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <EditField
                      label="First name"
                      value={personalDraft.firstName}
                      onChange={(value) =>
                        setPersonalDraft({ ...personalDraft, firstName: value })
                      }
                    />
                    <EditField
                      label="Last name"
                      value={personalDraft.lastName}
                      onChange={(value) =>
                        setPersonalDraft({ ...personalDraft, lastName: value })
                      }
                    />
                    <EditField
                      label="Phone"
                      value={personalDraft.phone}
                      onChange={(value) =>
                        setPersonalDraft({ ...personalDraft, phone: value })
                      }
                    />
                    <EditField
                      label="Email"
                      type="email"
                      value={personalDraft.email}
                      onChange={(value) =>
                        setPersonalDraft({ ...personalDraft, email: value })
                      }
                    />
                    <EditField
                      label="Date of birth"
                      value={personalDraft.dateOfBirth}
                      onChange={(value) =>
                        setPersonalDraft({ ...personalDraft, dateOfBirth: value })
                      }
                    />
                    <EditField
                      label="Address"
                      value={personalDraft.address}
                      onChange={(value) =>
                        setPersonalDraft({ ...personalDraft, address: value })
                      }
                    />
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ViewField label="Full name" value={fullName(profile)} />
                    <ViewField
                      label="Phone"
                      value={profile.identity.primaryPhone || profile.personal.mobile}
                    />
                    <ViewField
                      label="Email"
                      value={profile.identity.primaryEmail || profile.personal.email}
                    />
                    <ViewField
                      label="Date of birth"
                      value={profile.personal.dateOfBirth}
                    />
                    <ViewField
                      label="Address"
                      value={formatAddress(profile.personal.postalAddress)}
                    />
                  </div>
                )}
              </EditableSection>

              <EditableSection
                title="Social profiles"
                editing={isEditing({ kind: "social" })}
                saving={saving}
                onEdit={() => startEdit({ kind: "social" })}
                onCancel={cancelEdit}
                onSave={() => void saveSocial()}
              >
                {isEditing({ kind: "social" }) && socialDraft ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <EditField
                      label="LinkedIn"
                      value={socialDraft.linkedin}
                      onChange={(value) =>
                        setSocialDraft({ ...socialDraft, linkedin: value })
                      }
                    />
                    <EditField
                      label="Twitter"
                      value={socialDraft.twitter}
                      onChange={(value) =>
                        setSocialDraft({ ...socialDraft, twitter: value })
                      }
                    />
                    <EditField
                      label="Instagram"
                      value={socialDraft.instagram}
                      onChange={(value) =>
                        setSocialDraft({ ...socialDraft, instagram: value })
                      }
                    />
                    <EditField
                      label="Website"
                      value={socialDraft.website}
                      onChange={(value) =>
                        setSocialDraft({ ...socialDraft, website: value })
                      }
                    />
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ViewField
                      label="LinkedIn"
                      value={
                        profile.socials[0]?.custom?.linkedin ??
                        profile.socials[0]?.linkedin
                      }
                    />
                    <ViewField label="Twitter" value={profile.socials[0]?.twitter} />
                    <ViewField
                      label="Instagram"
                      value={profile.socials[0]?.custom?.instagram}
                    />
                    <ViewField label="Website" value={profile.socials[0]?.website} />
                  </div>
                )}
              </EditableSection>

              {profile.work.map((group, index) =>
                renderWorkSection(group, index, profile.work.length),
              )}
              {addingWork ? (
                renderWorkSection(null, profile.work.length, profile.work.length)
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit({ kind: "work", index: profile.work.length })}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:border-foreground/30 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {profile.work.length === 0 ? "Add workplace" : "Add another workplace"}
                </button>
              )}

              {profile.business.map((group, index) =>
                renderBusinessSection(group, index, profile.business.length),
              )}

              <p className="text-sm text-muted-foreground">
                Need logos, work addresses, or bank details?{" "}
                <Link
                  to="/dashboard?onboarding=profile&returnTo=/profile"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Open the full profile editor
                </Link>
                .
              </p>
            </div>

            <aside className="lg:sticky lg:top-6">
              <Panel className="space-y-5">
                <div className="flex flex-col items-center text-center">
                  <CompletionRing percent={completion.percent} />
                  <p className="mt-3 text-sm text-muted-foreground">
                    This info appears on your cards
                  </p>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="mb-3 text-sm font-semibold text-foreground">
                    Checklist
                  </p>
                  <CompletionChecklist items={checklist} />
                </div>
              </Panel>
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}
