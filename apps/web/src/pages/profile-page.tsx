import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  Briefcase,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { apiFetch } from "@/lib/api";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { mockProfile } from "@/lib/mock-data";
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
  const [isMockData, setIsMockData] = useState(false);
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
        const data = await apiFetch<ProfileMeResponse>("/v1/profile/me");
        if (isMounted) {
          setProfile(data);
          setIsMockData(false);
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load profile", err);
          setProfile(mockProfile);
          setIsMockData(true);
          setError(null);
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
        await apiFetch("/v1/profile/me", {
          method: "PATCH",
          body: {
            identity: next.identity,
            personal: {
              mobile: next.personal.mobile,
              email: next.personal.email,
              dateOfBirth: next.personal.dateOfBirth,
              postalAddress: next.personal.postalAddress,
            },
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
        await apiFetch("/v1/profile/me", {
          method: "PATCH",
          body: { socials: next.socials },
        });
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
        await apiFetch("/v1/profile/me", {
          method: "PATCH",
          body: { work: next.work },
        });
      }

      setProfile(next);
      toast.success("Profile saved");
      cancelEdit();
    } catch (err) {
      logUiError("Could not save profile section", err);
      if (isMockData && profile) {
        // Keep local edits visible when API is unavailable (sample mode).
        let next = structuredClone(profile);
        if (key === "personal" && personalDraft) {
          next.identity.firstName = personalDraft.firstName.trim();
          next.identity.lastName = personalDraft.lastName.trim();
          next.identity.primaryPhone = personalDraft.phone.trim();
          next.identity.primaryEmail = personalDraft.email.trim();
          next.personal.mobile = personalDraft.phone.trim();
          next.personal.email = personalDraft.email.trim();
          next.personal.dateOfBirth = personalDraft.dateOfBirth.trim() || null;
        }
        if (key === "social" && socialDraft) {
          const social = next.socials[0] ?? { groupId: "social-local", tag: "Social" };
          const updated = {
            ...social,
            linkedin: socialDraft.linkedin.trim() || null,
            twitter: socialDraft.twitter.trim() || null,
            website: socialDraft.website.trim() || null,
            custom: { ...(social.custom ?? {}), instagram: socialDraft.instagram.trim() },
          };
          next.socials = next.socials.length
            ? next.socials.map((item, i) => (i === 0 ? updated : item))
            : [updated];
        }
        if (key === "work" && workDraft) {
          const work = next.work[0] ?? { groupId: "work-local", tag: "Work" };
          const updated = {
            ...work,
            companyName: workDraft.company.trim() || null,
            workTitle: workDraft.title.trim() || null,
            workEmail: workDraft.workEmail.trim() || null,
            custom: { ...(work.custom ?? {}), industry: workDraft.industry.trim() },
          };
          next.work = next.work.length
            ? next.work.map((item, i) => (i === 0 ? updated : item))
            : [updated];
        }
        setProfile(next);
        toast.success("Profile saved");
        cancelEdit();
      } else {
        toast.error("Couldn't save — check your connection");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Your profile"
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>This info appears on your cards</span>
              {isMockData ? (
                <StatusBadge variant="neutral">Sample data</StatusBadge>
              ) : null}
            </span>
          }
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
                      <div className="mb-5 flex items-center gap-4">
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
                        <p className="text-sm text-muted-foreground">
                          Photo is managed from card maker and onboarding.
                        </p>
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
}: {
  empty: string;
  items: Array<{ id: string; title: string; subtitle: string | null }>;
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
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          {item.subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
          ) : null}
        </Panel>
      ))}
    </div>
  );
}
