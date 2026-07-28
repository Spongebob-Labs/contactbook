import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  Briefcase,
  Camera,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
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
import { cn } from "@/lib/utils";

type ProfileTab = "personal" | "work" | "business";
type EditableKey = "personal" | "social" | "work";

const PROFILE_TAB_STORAGE_KEY = "contactbook:profile-page-tab";

const profileTabs: Array<{
  key: ProfileTab;
  label: string;
  icon: typeof Building2;
}> = [
  { key: "personal", label: "Personal", icon: UserRound },
  { key: "work", label: "Work", icon: Briefcase },
  { key: "business", label: "Business", icon: Building2 },
];

const MAX_PROFILE_PHOTO_BYTES = 1_048_576;
const ALLOWED_PROFILE_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function isProfileTab(value: string | null): value is ProfileTab {
  return profileTabs.some((tab) => tab.key === value);
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

function valueOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const next = String(value).trim();
  return next || null;
}

function initialsFromText(value: string | null | undefined): string {
  const words = valueOrNull(value)?.split(/\s+/).filter(Boolean) ?? [];
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "CB";
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
  company: string;
  title: string;
  industry: string;
  workEmail: string;
};

function personalDraftFrom(profile: ProfileMeResponse): PersonalDraft {
  return {
    firstName: profile.identity.firstName ?? "",
    lastName: profile.identity.lastName ?? "",
    phone:
      profile.identity.primaryPhone ||
      profile.personal.mobile ||
      "",
    email:
      profile.identity.primaryEmail ||
      profile.personal.email ||
      "",
    dateOfBirth: profile.personal.dateOfBirth ?? "",
    address: formatAddress(profile.personal.postalAddress),
  };
}

function socialDraftFrom(profile: ProfileMeResponse): SocialDraft {
  const social = profile.socials[0];
  return {
    linkedin: social?.linkedin ?? "",
    twitter: social?.twitter ?? "",
    instagram: social?.custom?.instagram ?? "",
    website: social?.website ?? "",
  };
}

function workDraftFrom(profile: ProfileMeResponse): WorkDraft {
  const work = profile.work[0];
  return {
    company: work?.companyName ?? "",
    title: work?.workTitle ?? "",
    industry: work?.custom?.industry ?? "",
    workEmail: work?.workEmail ?? "",
  };
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMutatingPhoto, setIsMutatingPhoto] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    if (typeof window === "undefined") return "personal";
    const stored = window.localStorage.getItem(PROFILE_TAB_STORAGE_KEY);
    return isProfileTab(stored) ? stored : "personal";
  });
  const [editing, setEditing] = useState<EditableKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [personalDraft, setPersonalDraft] = useState<PersonalDraft | null>(null);
  const [socialDraft, setSocialDraft] = useState<SocialDraft | null>(null);
  const [workDraft, setWorkDraft] = useState<WorkDraft | null>(null);

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

  useEffect(() => {
    window.localStorage.setItem(PROFILE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  const completion = getProfileCompletion(profile);
  const checklist = getProfileCompletionItems(profile);
  const totals = useMemo(() => {
    if (!profile) return { work: 0, business: 0 };
    return { work: profile.work.length, business: profile.business.length };
  }, [profile]);

  const startEdit = (key: EditableKey) => {
    if (!profile) return;
    if (key === "personal") setPersonalDraft(personalDraftFrom(profile));
    if (key === "social") setSocialDraft(socialDraftFrom(profile));
    if (key === "work") setWorkDraft(workDraftFrom(profile));
    setEditing(key);
  };

  const cancelEdit = () => {
    setEditing(null);
    setPersonalDraft(null);
    setSocialDraft(null);
    setWorkDraft(null);
  };

  const saveSection = async (key: EditableKey) => {
    if (!profile) return;
    setSaving(true);
    try {
      let next = structuredClone(profile);

      if (key === "personal" && personalDraft) {
        const [street, city, ...rest] = personalDraft.address
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        next = {
          ...next,
          identity: {
            ...next.identity,
            firstName: personalDraft.firstName.trim(),
            lastName: personalDraft.lastName.trim(),
            primaryPhone: personalDraft.phone.trim(),
            primaryEmail: personalDraft.email.trim(),
          },
          personal: {
            ...next.personal,
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
              : next.personal.postalAddress,
          },
        };
        await patchProfileMe({
          identity: next.identity,
          personal: {
            mobile: next.personal.mobile,
            email: next.personal.email,
            dateOfBirth: next.personal.dateOfBirth,
            postalAddress: next.personal.postalAddress,
          },
        });
      }

      if (key === "social" && socialDraft) {
        const social = next.socials[0] ?? {
          groupId: "social-local",
          tag: "Social",
        };
        const updatedSocial = {
          ...social,
          linkedin: socialDraft.linkedin.trim() || null,
          twitter: socialDraft.twitter.trim() || null,
          website: socialDraft.website.trim() || null,
          custom: {
            ...(social.custom ?? {}),
            instagram: socialDraft.instagram.trim(),
          },
        };
        next = {
          ...next,
          socials: next.socials.length
            ? next.socials.map((item, index) =>
                index === 0 ? updatedSocial : item,
              )
            : [updatedSocial],
        };
        await patchProfileMe({ socials: next.socials });
      }

      if (key === "work" && workDraft) {
        const work = next.work[0] ?? {
          groupId: "work-local",
          tag: "Work",
        };
        const updatedWork = {
          ...work,
          companyName: workDraft.company.trim() || null,
          workTitle: workDraft.title.trim() || null,
          workEmail: workDraft.workEmail.trim() || null,
          custom: {
            ...(work.custom ?? {}),
            industry: workDraft.industry.trim(),
          },
        };
        next = {
          ...next,
          work: next.work.length
            ? next.work.map((item, index) => (index === 0 ? updatedWork : item))
            : [updatedWork],
        };
        await patchProfileMe({ work: next.work });
      }

      setProfile(next);
      toast.success("Profile saved");
      cancelEdit();
    } catch (err) {
      logUiError("Could not save profile section", err);
      toast.error("Couldn't save — check your connection");
    } finally {
      setSaving(false);
    }
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

  const handleDeleteGroup = async (groupId: string, category: ProfileGroupCategory) => {
    setDeletingGroupId(groupId);
    try {
      const updated = await deleteProfileGroup(groupId, category);
      setProfile(updated);
      toast.success("Profile section removed.");
    } catch (err) {
      logUiError("Could not delete profile group", err);
      toast.error("We couldn't remove that section right now.");
    } finally {
      setDeletingGroupId(null);
    }
  };

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
          <>
            <SegmentedTabs
              aria-label="Profile sections"
              items={profileTabs.map((tab) => ({
                key: tab.key,
                label: tab.label,
                icon: tab.icon,
                count:
                  tab.key === "work"
                    ? totals.work
                    : tab.key === "business"
                      ? totals.business
                      : null,
              }))}
              value={activeTab}
              onChange={(tab) => {
                cancelEdit();
                setActiveTab(tab);
              }}
            />

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-4">
                {activeTab === "personal" && (
                  <>
                    <EditableSection
                      title="Personal information"
                      editing={editing === "personal"}
                      saving={saving}
                      onEdit={() => startEdit("personal")}
                      onCancel={cancelEdit}
                      onSave={() => void saveSection("personal")}
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
                      {editing === "personal" && personalDraft ? (
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
                            value={
                              profile.identity.primaryPhone || profile.personal.mobile
                            }
                          />
                          <ViewField
                            label="Email"
                            value={
                              profile.identity.primaryEmail || profile.personal.email
                            }
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
                      editing={editing === "social"}
                      saving={saving}
                      onEdit={() => startEdit("social")}
                      onCancel={cancelEdit}
                      onSave={() => void saveSection("social")}
                    >
                      {editing === "social" && socialDraft ? (
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
                            value={profile.socials[0]?.linkedin}
                          />
                          <ViewField
                            label="Twitter"
                            value={profile.socials[0]?.twitter}
                          />
                          <ViewField
                            label="Instagram"
                            value={profile.socials[0]?.custom?.instagram}
                          />
                          <ViewField
                            label="Website"
                            value={profile.socials[0]?.website}
                          />
                        </div>
                      )}
                    </EditableSection>

                    <EditableSection
                      title="Work"
                      editing={editing === "work"}
                      saving={saving}
                      onEdit={() => startEdit("work")}
                      onCancel={cancelEdit}
                      onSave={() => void saveSection("work")}
                    >
                      {editing === "work" && workDraft ? (
                        <div className="grid gap-4 sm:grid-cols-2">
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
                            onChange={(value) =>
                              setWorkDraft({ ...workDraft, title: value })
                            }
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
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <ViewField
                            label="Company"
                            value={profile.work[0]?.companyName}
                          />
                          <ViewField
                            label="Position"
                            value={profile.work[0]?.workTitle}
                          />
                          <ViewField
                            label="Industry"
                            value={profile.work[0]?.custom?.industry}
                          />
                          <ViewField
                            label="Work email"
                            value={profile.work[0]?.workEmail}
                          />
                        </div>
                      )}
                    </EditableSection>
                  </>
                )}

                {activeTab === "work" && (
                  <ProfileListPanel
                    empty="No work profiles yet"
                    items={profile.work.map((item) => ({
                      id: item.groupId,
                      title: item.companyName || item.tag || "Work",
                      subtitle: item.workTitle || item.workEmail || null,
                    }))}
                    deletingId={deletingGroupId}
                    onDelete={(groupId) => void handleDeleteGroup(groupId, "WORK")}
                  />
                )}

                {activeTab === "business" && (
                  <ProfileListPanel
                    empty="No business profiles yet"
                    items={profile.business.map((item) => ({
                      id: item.groupId,
                      title: item.businessName || item.tag || "Business",
                      subtitle: item.businessTitle || item.businessEmail || null,
                    }))}
                    deletingId={deletingGroupId}
                    onDelete={(groupId) => void handleDeleteGroup(groupId, "BUSINESS")}
                  />
                )}
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
          </>
        )}
      </div>
    </AppShell>
  );
}

function ProfileListPanel({
  empty,
  items,
  onDelete,
  deletingId,
}: {
  empty: string;
  items: Array<{ id: string; title: string; subtitle: string | null }>;
  onDelete?: (groupId: string) => void;
  deletingId?: string | null;
}) {
  if (items.length === 0) {
    return (
      <Panel className="border-dashed text-center">
        <p className="text-sm font-semibold text-foreground">{empty}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use Edit on the Personal tab Work section, or open full onboarding.
        </p>
        <Link
          to="/dashboard?onboarding=profile&returnTo=/profile"
          className={cn(buttonVariants({ variant: "secondary" }), "mt-4")}
        >
          Open profile editor
        </Link>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Panel key={item.id} className="!p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              {item.subtitle ? (
                <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
              ) : null}
            </div>
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-destructive hover:text-destructive"
                disabled={deletingId === item.id}
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {deletingId === item.id ? "Removing" : "Remove"}
              </Button>
            ) : null}
          </div>
        </Panel>
      ))}
    </div>
  );
}
