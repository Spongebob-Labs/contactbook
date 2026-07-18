import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  Briefcase,
  Edit3,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  DetailGrid,
  DetailRow,
  EmptyFieldsState,
  LinkedDetailRow,
  RecordPanel,
} from "@/components/ui/detail-fields";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import SplitText from "@/components/ui/SplitText";
import SpotlightCard from "@/components/ui/SpotlightCard";
import { apiFetch } from "@/lib/api";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { mockProfile } from "@/lib/mock-data";
import {
  getMissingProfileSections,
  getProfileCompletion,
} from "@/lib/profile-completion";
import type { PostalAddress, ProfileMeResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

type AddressLike = Partial<PostalAddress>;
type CustomRecord = Record<string, string | null | undefined>;
type ProfileTab = "personal" | "work" | "business";
type ProfileRecordTone = "personal" | "work" | "business";

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

function formatAddress(address: AddressLike | undefined): string | null {
  if (!address) {
    return null;
  }
  return [
    address.street,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function valueOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const next = String(value).trim();
  return next || null;
}

function labelFromCamelKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function displayLabel(label: string): string {
  return /[A-Z]/.test(label) && !label.includes(" ")
    ? labelFromCamelKey(label)
    : label;
}

function customValue(
  custom: CustomRecord | undefined,
  ...keys: string[]
): string | null {
  const expandedKeys = keys.flatMap((key) => [key, labelFromCamelKey(key)]);
  for (const key of expandedKeys) {
    const value = valueOrNull(custom?.[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function profileValue(
  source: object,
  key: string,
  ...customKeys: string[]
): string | null {
  const record = source as Record<string, unknown>;
  return (
    valueOrNull(record[key]) ??
    customValue(record.custom as CustomRecord | undefined, key, ...customKeys)
  );
}

function optionalProfileValue(
  source: object | null | undefined,
  key: string,
  ...customKeys: string[]
): string | null {
  return source ? profileValue(source, key, ...customKeys) : null;
}

function addressValue(
  address: AddressLike | undefined,
  custom: CustomRecord | undefined,
  prefix: string,
): string | null {
  const direct = formatAddress(address);
  if (direct) {
    return direct;
  }

  return formatAddress({
    street: customValue(custom, `${prefix}Street`) ?? undefined,
    city: customValue(custom, `${prefix}City`) ?? undefined,
    state: customValue(custom, `${prefix}State`) ?? undefined,
    pincode: customValue(custom, `${prefix}Pincode`) ?? undefined,
    country: customValue(custom, `${prefix}Country`) ?? undefined,
  });
}

function expandedCustomKeys(keys: string[]): Set<string> {
  return new Set(keys.flatMap((key) => [key, labelFromCamelKey(key)]));
}

function customEntries(custom: CustomRecord | undefined, exclude: string[] = []) {
  const excluded = expandedCustomKeys(exclude);
  return Object.entries(custom ?? {}).filter(
    ([label, value]) => !excluded.has(label) && Boolean(valueOrNull(value)),
  );
}

function isLinkable(value: string | null): value is string {
  return Boolean(value && /^(https?:|data:image\/)/i.test(value));
}

function firstValue(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const next = valueOrNull(value);
    if (next) {
      return next;
    }
  }
  return null;
}

function initialsFromText(value: string | null | undefined): string {
  const words = valueOrNull(value)?.split(/\s+/).filter(Boolean) ?? [];
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
  return initials || "CB";
}

function FieldSection({
  title,
  children,
  delay = 0,
}: {
  title: string;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <div
      className="app-fade-up rounded-[14px] border border-border bg-card/60 p-4 md:p-5"
      style={{ animationDelay: `${delay}s` }}
    >
      <p className="label-section mb-3">{title}</p>
      {children}
    </div>
  );
}

function hasAnyChildren(nodes: ReactNode[]): boolean {
  return nodes.some(Boolean);
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    if (typeof window === "undefined") {
      return "personal";
    }
    const storedTab = window.localStorage.getItem(PROFILE_TAB_STORAGE_KEY);
    return isProfileTab(storedTab) ? storedTab : "personal";
  });

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
        if (isMounted) {
          setIsLoading(false);
        }
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

  const totals = useMemo(() => {
    if (!profile) {
      return { work: 0, business: 0 };
    }
    return {
      work: profile.work.length,
      business: profile.business.length,
    };
  }, [profile]);

  const completion = getProfileCompletion(profile);
  const missing = getMissingProfileSections(profile).slice(0, 3);

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="flex flex-col gap-2">
          <SplitText
            text="Your profile"
            className="title-display"
            delay={70}
            tag="h1"
          />
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <span>Your identity bank — what cards can draw from.</span>
            {isMockData && (
              <span className="rounded border border-accent-border bg-accent-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
                Sample data
              </span>
            )}
          </p>
        </section>

        {isLoading && (
          <section className="space-y-4 rounded-[14px] border border-border bg-card p-5">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <Skeleton className="h-9 w-full max-w-md rounded-xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </section>
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
            <ProfileHero
              completion={completion}
              missing={missing}
              profile={profile}
            />

            <div className="space-y-4">
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
                onChange={setActiveTab}
              />

              {activeTab === "personal" && (
                <PersonalProfileBody profile={profile} />
              )}

              {activeTab === "work" && (
                <ProfileCollection
                  empty="No work profiles added yet."
                  emptyCta
                  items={profile.work}
                  render={(item) => <WorkProfileCard item={item} />}
                />
              )}

              {activeTab === "business" && (
                <ProfileCollection
                  empty="No business profiles added yet."
                  emptyCta
                  items={profile.business}
                  render={(item) => (
                    <BusinessProfileCard item={item} social={profile.socials[0]} />
                  )}
                />
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ProfileHero({
  profile,
  completion,
  missing,
}: {
  profile: ProfileMeResponse;
  completion: { completed: number; total: number; percent: number };
  missing: string[];
}) {
  const title = profileValue(profile.personal, "title");
  const name = fullName(profile);
  const initials = initialsFromText(name);

  return (
    <SpotlightCard
      className="rounded-[14px] border border-border bg-card p-5 md:p-6"
      spotlightColor="rgba(200,184,154,0.06)"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-subtle text-xl font-bold text-primary md:h-24 md:w-24 md:text-2xl">
            {profile.identity.profilePhoto ? (
              <img
                src={profile.identity.profilePhoto}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            <p className="label-section text-primary">Identity</p>
            <h2 className="title-section mt-1 truncate text-[22px] md:text-[24px]">
              {name || "Your name"}
            </h2>
            {title && (
              <p className="mt-1 truncate text-[13px] text-muted-foreground">{title}</p>
            )}
            <div className="mt-3 flex flex-col gap-1.5 text-[13px] text-muted-foreground">
              {profile.identity.primaryPhone && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-primary opacity-70" aria-hidden="true" />
                  <span className="truncate">{profile.identity.primaryPhone}</span>
                </span>
              )}
              {profile.identity.primaryEmail && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-primary opacity-70" aria-hidden="true" />
                  <span className="truncate">{profile.identity.primaryEmail}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3 lg:items-end">
          <Link
            to="/dashboard?onboarding=profile&returnTo=/profile"
            className={cn(buttonVariants(), "w-full justify-center sm:w-auto")}
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
            Edit profile
          </Link>
          <div className="w-full rounded-[10px] border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-[0.08em] text-text-muted">
                Completion
              </p>
              <span className="text-[11px] text-primary">{completion.percent}%</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {completion.completed} of {completion.total} sections done
            </p>
            <div className="mt-2 h-[3px] rounded-full bg-muted">
              <div
                className="h-[3px] rounded-full bg-primary transition-all duration-1000"
                style={{ width: `${completion.percent}%` }}
              />
            </div>
            {missing.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {missing.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <div className="h-1 w-1 rounded-full bg-primary opacity-50" />
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SpotlightCard>
  );
}

function ProfileRecordMedia({
  alt,
  fallbackIcon: FallbackIcon,
  initials,
  tone,
  url,
}: {
  alt: string;
  fallbackIcon: typeof UserRound;
  initials: string;
  tone: ProfileRecordTone;
  url?: string | null;
}) {
  const imageUrl = valueOrNull(url);

  if (isLinkable(imageUrl)) {
    return (
      <div className="flex h-10 w-10 items-center justify-end">
        <img
          src={imageUrl}
          alt={alt}
          className={cn(
            "max-h-10 max-w-10 object-contain",
            tone === "personal" && "h-10 w-10 rounded-full object-cover",
          )}
        />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-xs font-semibold text-primary">
      {initials !== "CB" ? (
        initials
      ) : (
        <FallbackIcon className="h-4 w-4" aria-hidden="true" />
      )}
    </div>
  );
}

function PersonalProfileBody({ profile }: { profile: ProfileMeResponse }) {
  const personal = profile.personal;
  const social = profile.socials[0];
  const custom = personal.custom;
  const knownKeys = [
    "postalStreet",
    "postalCity",
    "postalState",
    "postalPincode",
    "postalCountry",
    "title",
    "nickname",
    "mobile",
    "landline",
    "email",
    "dateOfBirth",
    "yearOfBirth",
    "currentLocation",
    "relationshipStatus",
    "kidsNames",
    "partnerName",
    "petNames",
    "bloodGroup",
  ];

  const contactRows = [
    <DetailRow key="mobile" label="Mobile" value={profileValue(personal, "mobile")} />,
    <DetailRow key="landline" label="Landline" value={profileValue(personal, "landline")} />,
    <DetailRow key="email" label="Email" value={profileValue(personal, "email")} />,
  ];
  const aboutRows = [
    <DetailRow key="title" label="Title" value={profileValue(personal, "title")} />,
    <DetailRow key="nickname" label="Nickname" value={profileValue(personal, "nickname")} />,
    <DetailRow key="dob" label="Date of birth" value={profileValue(personal, "dateOfBirth")} />,
    <DetailRow key="yob" label="Year of birth" value={profileValue(personal, "yearOfBirth")} />,
    <DetailRow key="blood" label="Blood group" value={profileValue(personal, "bloodGroup")} />,
  ];
  const locationRows = [
    <DetailRow
      key="location"
      label="Current location"
      value={profileValue(personal, "currentLocation")}
    />,
    <DetailRow
      key="postal"
      label="Postal address"
      value={addressValue(personal.postalAddress, custom, "postal")}
    />,
  ];
  const familyRows = [
    <DetailRow
      key="relationship"
      label="Relationship status"
      value={profileValue(personal, "relationshipStatus")}
    />,
    <DetailRow key="partner" label="Partner name" value={profileValue(personal, "partnerName")} />,
    <DetailRow key="kids" label="Kids names" value={profileValue(personal, "kidsNames")} />,
    <DetailRow key="pets" label="Pet names" value={profileValue(personal, "petNames")} />,
  ];
  const socialRows = [
    <LinkedDetailRow
      key="fb"
      isLinkable={isLinkable}
      label="Facebook"
      value={optionalProfileValue(social, "facebook")}
    />,
    <LinkedDetailRow
      key="ig"
      isLinkable={isLinkable}
      label="Instagram"
      value={optionalProfileValue(social, "instagram")}
    />,
  ];
  const customList = customEntries(custom, knownKeys);

  const hasAnything =
    hasAnyChildren(contactRows) ||
    hasAnyChildren(aboutRows) ||
    hasAnyChildren(locationRows) ||
    hasAnyChildren(familyRows) ||
    hasAnyChildren(socialRows) ||
    customList.length > 0;

  if (!hasAnything) {
    return (
      <EmptyTabState
        label="No personal details added yet."
        description="Add the details friends and family should have across your cards."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {hasAnyChildren(contactRows) && (
        <FieldSection title="Contact" delay={0}>
          <DetailGrid>{contactRows}</DetailGrid>
        </FieldSection>
      )}
      {hasAnyChildren(aboutRows) && (
        <FieldSection title="About" delay={0.05}>
          <DetailGrid>{aboutRows}</DetailGrid>
        </FieldSection>
      )}
      {hasAnyChildren(locationRows) && (
        <FieldSection title="Location" delay={0.1}>
          <DetailGrid>{locationRows}</DetailGrid>
        </FieldSection>
      )}
      {hasAnyChildren(familyRows) && (
        <FieldSection title="Family" delay={0.15}>
          <DetailGrid>{familyRows}</DetailGrid>
        </FieldSection>
      )}
      {hasAnyChildren(socialRows) && (
        <FieldSection title="Social" delay={0.2}>
          <DetailGrid>{socialRows}</DetailGrid>
        </FieldSection>
      )}
      {customList.length > 0 && (
        <FieldSection title="More" delay={0.25}>
          <DetailGrid>
            {customList.map(([label, value]) => (
              <DetailRow key={label} label={displayLabel(label)} value={valueOrNull(value)} />
            ))}
          </DetailGrid>
        </FieldSection>
      )}
    </div>
  );
}

function WorkProfileCard({ item }: { item: ProfileMeResponse["work"][number] }) {
  const companyLogo = profileValue(item, "companyLogo");
  const companyName = profileValue(item, "companyName") ?? item.tag ?? "Work profile";
  const workTitle = profileValue(item, "workTitle");

  return (
    <RecordPanel
      badge={item.tag || "Work"}
      className="rounded-[14px] border-border bg-card"
      media={
        <ProfileRecordMedia
          alt="Company logo"
          fallbackIcon={Briefcase}
          initials={initialsFromText(companyName)}
          tone="work"
          url={companyLogo}
        />
      }
      subtitle={firstValue(workTitle, profileValue(item, "workEmail"))}
      title={companyName}
    >
      <WorkDetails item={item} />
    </RecordPanel>
  );
}

function BusinessProfileCard({
  item,
  social,
}: {
  item: ProfileMeResponse["business"][number];
  social?: ProfileMeResponse["socials"][number];
}) {
  const businessLogo = profileValue(item, "businessLogo");
  const businessName =
    profileValue(item, "businessName") ?? item.tag ?? "Business profile";
  const businessTitle = profileValue(item, "businessTitle");

  return (
    <RecordPanel
      badge={item.tag || "Business"}
      className="rounded-[14px] border-border bg-card"
      media={
        <ProfileRecordMedia
          alt="Business logo"
          fallbackIcon={Building2}
          initials={initialsFromText(businessName)}
          tone="business"
          url={businessLogo}
        />
      }
      subtitle={firstValue(businessTitle, profileValue(item, "businessEmail"))}
      title={businessName}
    >
      <BusinessDetails item={item} social={social} />
    </RecordPanel>
  );
}

function WorkDetails({ item }: { item: ProfileMeResponse["work"][number] }) {
  const custom = item.custom;
  const companyLogo = profileValue(item, "companyLogo");
  const knownKeys = [
    "companyName",
    "companyLogo",
    "companyRegNumber",
    "workTitle",
    "workMobile",
    "workLandline",
    "workFax",
    "workEmail",
    "workPostalStreet",
    "workPostalCity",
    "workPostalState",
    "workPostalPincode",
    "workPostalCountry",
    "employeeId",
  ];
  const values = [
    profileValue(item, "companyName"),
    companyLogo,
    profileValue(item, "companyRegNumber"),
    profileValue(item, "workTitle"),
    profileValue(item, "workMobile"),
    profileValue(item, "workLandline"),
    profileValue(item, "workFax"),
    profileValue(item, "workEmail"),
    addressValue(item.workPostalAddress, custom, "workPostal"),
    profileValue(item, "employeeId"),
  ];

  if (!values.some(Boolean) && customEntries(custom, knownKeys).length === 0) {
    return <EmptyFieldsState label="No details saved in this work group." />;
  }

  return (
    <>
      <DetailGrid>
        <DetailRow label="Company" value={profileValue(item, "companyName")} />
        {!isLinkable(companyLogo) && (
          <DetailRow label="Company logo" value={companyLogo} />
        )}
        <DetailRow
          label="Registration number"
          value={profileValue(item, "companyRegNumber")}
        />
        <DetailRow label="Title" value={profileValue(item, "workTitle")} />
        <DetailRow label="Mobile" value={profileValue(item, "workMobile")} />
        <DetailRow label="Landline" value={profileValue(item, "workLandline")} />
        <DetailRow label="Fax" value={profileValue(item, "workFax")} />
        <DetailRow label="Email" value={profileValue(item, "workEmail")} />
        <DetailRow
          label="Address"
          value={addressValue(item.workPostalAddress, custom, "workPostal")}
        />
        <DetailRow label="Employee ID" value={profileValue(item, "employeeId")} />
      </DetailGrid>
      <CustomDetails custom={custom} exclude={knownKeys} />
    </>
  );
}

function BusinessDetails({
  item,
  social,
}: {
  item: ProfileMeResponse["business"][number];
  social?: ProfileMeResponse["socials"][number];
}) {
  const custom = item.custom;
  const businessLogo = profileValue(item, "businessLogo");
  const knownKeys = [
    "businessName",
    "businessLogo",
    "businessRegNumber",
    "businessTitle",
    "businessMobile",
    "businessLandline",
    "businessFax",
    "businessEmail",
    "businessDescription",
    "businessPostalStreet",
    "businessPostalCity",
    "businessPostalState",
    "businessPostalPincode",
    "businessPostalCountry",
    "businessType",
    "gstin",
  ];
  const values = [
    profileValue(item, "businessName"),
    businessLogo,
    profileValue(item, "businessRegNumber"),
    profileValue(item, "businessTitle"),
    profileValue(item, "businessMobile"),
    profileValue(item, "businessLandline"),
    profileValue(item, "businessFax"),
    profileValue(item, "businessEmail"),
    profileValue(item, "businessDescription", "description"),
    optionalProfileValue(social, "linkedin"),
    optionalProfileValue(social, "website"),
    addressValue(item.businessPostalAddress, custom, "businessPostal"),
    profileValue(item, "businessType"),
    profileValue(item, "gstin"),
  ];

  if (!values.some(Boolean) && customEntries(custom, knownKeys).length === 0) {
    return <EmptyFieldsState label="No details saved in this business group." />;
  }

  return (
    <>
      <DetailGrid>
        <DetailRow label="Business" value={profileValue(item, "businessName")} />
        {!isLinkable(businessLogo) && (
          <DetailRow label="Business logo" value={businessLogo} />
        )}
        <DetailRow
          label="Registration number"
          value={profileValue(item, "businessRegNumber")}
        />
        <DetailRow label="Title" value={profileValue(item, "businessTitle")} />
        <DetailRow label="Mobile" value={profileValue(item, "businessMobile")} />
        <DetailRow
          label="Landline"
          value={profileValue(item, "businessLandline")}
        />
        <DetailRow label="Fax" value={profileValue(item, "businessFax")} />
        <DetailRow label="Email" value={profileValue(item, "businessEmail")} />
        <DetailRow
          label="Description"
          value={profileValue(item, "businessDescription", "description")}
        />
        <LinkedDetailRow
          isLinkable={isLinkable}
          label="LinkedIn"
          value={optionalProfileValue(social, "linkedin")}
        />
        <LinkedDetailRow
          isLinkable={isLinkable}
          label="Website"
          value={optionalProfileValue(social, "website")}
        />
        <DetailRow
          label="Address"
          value={addressValue(item.businessPostalAddress, custom, "businessPostal")}
        />
        <DetailRow label="Business type" value={profileValue(item, "businessType")} />
        <DetailRow label="GSTIN" value={profileValue(item, "gstin")} />
      </DetailGrid>
      <CustomDetails custom={custom} exclude={knownKeys} />
    </>
  );
}

function CustomDetails({
  custom,
  exclude = [],
}: {
  custom?: CustomRecord;
  exclude?: string[];
}) {
  const entries = customEntries(custom, exclude);
  if (entries.length === 0) {
    return null;
  }
  return (
    <DetailGrid className="mt-3.5 border-t border-border pt-3.5">
      {entries.map(([label, value]) => (
        <DetailRow key={label} label={displayLabel(label)} value={valueOrNull(value)} />
      ))}
    </DetailGrid>
  );
}

function EmptyTabState({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-subtle text-primary">
        <UserRound className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>
      <Link
        to="/dashboard?onboarding=profile&returnTo=/profile"
        className={cn(buttonVariants(), "mt-5")}
      >
        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
        Edit profile
      </Link>
    </div>
  );
}

function ProfileCollection<T extends { groupId: string; tag: string }>({
  empty,
  emptyCta = false,
  items,
  render,
}: {
  empty: string;
  emptyCta?: boolean;
  items: T[];
  render: (item: T) => ReactNode;
}) {
  if (items.length === 0) {
    return (
      <EmptyTabState
        label={empty}
        description={
          emptyCta
            ? "Add a record so your shareable cards can use the right workplace details."
            : "Nothing here yet."
        }
      />
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {items.map((item, index) => (
        <div
          key={item.groupId}
          className="app-fade-up"
          style={{ animationDelay: `${index * 0.08}s` }}
        >
          {render(item)}
        </div>
      ))}
    </div>
  );
}
