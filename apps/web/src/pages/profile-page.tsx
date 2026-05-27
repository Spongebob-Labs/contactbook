import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  Briefcase,
  Edit3,
  ExternalLink,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SampleDataNotice } from "@/components/sample-data-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { cardTypeStyles } from "@/lib/card-styles";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { mockProfile } from "@/lib/mock-data";
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

  return (
    <AppShell>
      {isMockData && <SampleDataNotice />}

      <Card className="overflow-hidden">
        {isLoading && (
          <CardContent className="space-y-4 p-6 md:p-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-12 w-full max-w-2xl" />
            <Skeleton className="h-10 w-40" />
          </CardContent>
        )}

        {!isLoading && error && (
          <CardContent className="p-6 md:p-8">
            <Alert className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="font-medium">Could not load profile</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {friendlyErrorMessages.load}
                </p>
              </div>
            </Alert>
          </CardContent>
        )}

        {!isLoading && profile && (
          <>
            <CardHeader className="gap-6 border-b border-border p-6 md:p-8">
              <ProfileHeader profile={profile} />
              <ProfileTabs
                activeTab={activeTab}
                totals={totals}
                onChange={setActiveTab}
              />
            </CardHeader>

            <CardContent className="p-6 md:p-8">
              {activeTab === "personal" && (
                <ProfileTabSection
                  description={profile.personal.tag}
                  icon={ShieldCheck}
                  title="Personal"
                >
                  <PersonalProfileCard profile={profile} />
                </ProfileTabSection>
              )}

              {activeTab === "work" && (
                <ProfileCollection
                  title="Work"
                  icon={Building2}
                  empty="No work profiles added yet."
                  items={profile.work}
                  render={(item) => <WorkProfileCard item={item} />}
                />
              )}

              {activeTab === "business" && (
                <ProfileCollection
                  title="Business"
                  icon={Building2}
                  empty="No business profiles added yet."
                  items={profile.business}
                  render={(item) => (
                    <BusinessProfileCard item={item} social={profile.socials[0]} />
                  )}
                />
              )}
            </CardContent>
          </>
        )}
      </Card>
    </AppShell>
  );
}

function ProfileHeader({ profile }: { profile: ProfileMeResponse }) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
          {profile.identity.profilePhoto ? (
            <img
              src={profile.identity.profilePhoto}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <UserRound
              className="h-9 w-9 text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </div>
        <div>
          <Badge className="rounded-full" variant="success">
            Profile
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
            {fullName(profile)}
          </h1>
          <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/70 px-3 py-2">
              <Phone className="h-4 w-4" aria-hidden="true" />
              {profile.identity.primaryPhone}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/70 px-3 py-2">
              <Mail className="h-4 w-4" aria-hidden="true" />
              {profile.identity.primaryEmail}
            </span>
          </div>
        </div>
      </div>
      <Link
        to="/dashboard?onboarding=profile&returnTo=/profile"
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Edit3 className="h-4 w-4" aria-hidden="true" />
        Edit profile
      </Link>
    </div>
  );
}

function ProfileTabs({
  activeTab,
  totals,
  onChange,
}: {
  activeTab: ProfileTab;
  totals: { work: number; business: number };
  onChange: (tab: ProfileTab) => void;
}) {
  const countFor = (tab: ProfileTab) => {
    if (tab === "work") {
      return totals.work;
    }
    if (tab === "business") {
      return totals.business;
    }
    return null;
  };

  return (
    <div
      className="grid overflow-hidden rounded-full border border-border bg-background md:grid-cols-3"
      role="tablist"
      aria-label="Profile sections"
    >
      {profileTabs.map((tab, index) => {
        const isActive = activeTab === tab.key;
        const count = countFor(tab.key);
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={[
              "flex min-h-16 items-center justify-center border-border p-4 text-center transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              index > 0 ? "border-t md:border-l md:border-t-0" : "",
              isActive
                ? "bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted/50",
            ].join(" ")}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span
                className={[
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  isActive ? "bg-primary-foreground/15" : "bg-muted",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 text-sm font-semibold">{tab.label}</span>
            {count !== null && (
              <span
                className={[
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  isActive
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {count}
              </span>
            )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ProfileTabSection({
  children,
  description,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  description?: string | null;
  icon: typeof Building2;
  title: string;
}) {
  return (
    <section className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function ProfileRecordCard({
  badge,
  children,
  fallbackIcon: FallbackIcon,
  fallbackText,
  mediaAlt,
  mediaUrl,
  subtitle,
  title,
  tone,
}: {
  badge: string;
  children: React.ReactNode;
  fallbackIcon: typeof UserRound;
  fallbackText: string;
  mediaAlt: string;
  mediaUrl?: string | null;
  subtitle?: string | null;
  title: string;
  tone: ProfileRecordTone;
}) {
  const style = tone === "personal" ? cardTypeStyles.PERSONAL : cardTypeStyles.BUSINESS;
  const initials = initialsFromText(fallbackText);

  return (
    <div className="group rounded-lg bg-background shadow-[0_18px_48px_rgba(20,52,48,0.08)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_64px_rgba(20,52,48,0.12)]">
      <div
        className={cn(
          "relative flex min-h-[20rem] flex-col overflow-hidden rounded-md border border-border/80 p-5 pl-6",
          style.faceClassName,
        )}
      >
        <div className={cn("absolute inset-y-0 left-0 w-1.5", style.foilClassName)} />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
        <div
          className={cn(
            "pointer-events-none absolute -right-4 top-2 text-[8rem] font-semibold leading-none tracking-normal",
            style.watermarkClassName,
          )}
        >
          {initials}
        </div>
        <div className="pointer-events-none absolute bottom-0 right-0 h-24 w-24 rounded-tl-full border-l border-t border-primary/10 bg-background/30" />

        <div className="relative flex items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">
              ContactBook
            </p>
            <p className="mt-5 truncate text-2xl font-semibold tracking-normal text-foreground">
              {title}
            </p>
            {subtitle && (
              <p className="mt-2 truncate text-sm font-medium text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <ProfileRecordMedia
              alt={mediaAlt}
              fallbackIcon={FallbackIcon}
              initials={initials}
              tone={tone}
              url={mediaUrl}
            />
            <Badge className={cn("mt-3", style.badgeClassName)} variant="secondary">
              {badge}
            </Badge>
          </div>
        </div>

        <div className="relative mt-8 border-y border-border/70 py-4">
          {children}
        </div>
      </div>
    </div>
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
      <div className="flex h-16 w-20 items-center justify-end">
        <img
          src={imageUrl}
          alt={alt}
          className={cn(
            "max-h-16 max-w-20 object-contain",
            tone === "personal" && "h-16 w-16 rounded-full object-cover",
          )}
        />
      </div>
    );
  }

  const style = tone === "personal" ? cardTypeStyles.PERSONAL : cardTypeStyles.BUSINESS;

  return (
    <div
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_22px_rgba(20,52,48,0.13)]",
        style.initialsClassName,
      )}
    >
      {initials !== "CB" ? (
        initials
      ) : (
        <FallbackIcon className="h-5 w-5" aria-hidden="true" />
      )}
    </div>
  );
}

function PersonalProfileCard({ profile }: { profile: ProfileMeResponse }) {
  const name = fullName(profile) || "Personal profile";
  const title = profileValue(profile.personal, "title");
  const location = profileValue(profile.personal, "currentLocation");

  return (
    <ProfileRecordCard
      badge="Personal"
      fallbackIcon={UserRound}
      fallbackText={name}
      mediaAlt="Profile photo"
      mediaUrl={profile.identity.profilePhoto}
      subtitle={firstValue(title, location, profile.identity.primaryEmail)}
      title={name}
      tone="personal"
    >
      <PersonalDetails personal={profile.personal} social={profile.socials[0]} />
    </ProfileRecordCard>
  );
}

function WorkProfileCard({ item }: { item: ProfileMeResponse["work"][number] }) {
  const companyLogo = profileValue(item, "companyLogo");
  const companyName = profileValue(item, "companyName") ?? item.tag ?? "Work profile";
  const workTitle = profileValue(item, "workTitle");

  return (
    <ProfileRecordCard
      badge={item.tag || "Work"}
      fallbackIcon={Briefcase}
      fallbackText={companyName}
      mediaAlt="Company logo"
      mediaUrl={companyLogo}
      subtitle={firstValue(workTitle, profileValue(item, "workEmail"))}
      title={companyName}
      tone="work"
    >
      <WorkDetails item={item} />
    </ProfileRecordCard>
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
    <ProfileRecordCard
      badge={item.tag || "Business"}
      fallbackIcon={Building2}
      fallbackText={businessName}
      mediaAlt="Business logo"
      mediaUrl={businessLogo}
      subtitle={firstValue(businessTitle, profileValue(item, "businessEmail"))}
      title={businessName}
      tone="business"
    >
      <BusinessDetails item={item} social={social} />
    </ProfileRecordCard>
  );
}

function PersonalDetails({
  personal,
  social,
}: {
  personal: ProfileMeResponse["personal"];
  social?: ProfileMeResponse["socials"][number];
}) {
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
  const values = [
    addressValue(personal.postalAddress, custom, "postal"),
    profileValue(personal, "title"),
    profileValue(personal, "nickname"),
    profileValue(personal, "mobile"),
    profileValue(personal, "landline"),
    profileValue(personal, "email"),
    profileValue(personal, "dateOfBirth"),
    profileValue(personal, "yearOfBirth"),
    profileValue(personal, "currentLocation"),
    profileValue(personal, "relationshipStatus"),
    profileValue(personal, "kidsNames"),
    profileValue(personal, "partnerName"),
    profileValue(personal, "petNames"),
    profileValue(personal, "bloodGroup"),
    optionalProfileValue(social, "facebook"),
    optionalProfileValue(social, "instagram"),
  ];

  if (
    !values.some(Boolean) &&
    customEntries(custom, knownKeys).length === 0
  ) {
    return <EmptyState label="No personal details added yet." />;
  }

  return (
    <>
      <DetailGrid>
        <DetailRow label="Title" value={profileValue(personal, "title")} />
        <DetailRow label="Nickname" value={profileValue(personal, "nickname")} />
        <DetailRow label="Mobile" value={profileValue(personal, "mobile")} />
        <DetailRow label="Landline" value={profileValue(personal, "landline")} />
        <DetailRow label="Email" value={profileValue(personal, "email")} />
        <DetailRow label="Date of birth" value={profileValue(personal, "dateOfBirth")} />
        <DetailRow label="Year of birth" value={profileValue(personal, "yearOfBirth")} />
        <DetailRow
          label="Current location"
          value={profileValue(personal, "currentLocation")}
        />
        <DetailRow
          label="Relationship status"
          value={profileValue(personal, "relationshipStatus")}
        />
        <DetailRow label="Kids names" value={profileValue(personal, "kidsNames")} />
        <DetailRow
          label="Partner name"
          value={profileValue(personal, "partnerName")}
        />
        <DetailRow label="Pet names" value={profileValue(personal, "petNames")} />
        <DetailRow label="Blood group" value={profileValue(personal, "bloodGroup")} />
        <LinkedDetailRow label="Facebook" value={optionalProfileValue(social, "facebook")} />
        <LinkedDetailRow label="Instagram" value={optionalProfileValue(social, "instagram")} />
        <DetailRow
          label="Postal address"
          value={addressValue(personal.postalAddress, custom, "postal")}
        />
      </DetailGrid>
      <CustomDetails custom={custom} exclude={knownKeys} />
    </>
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

  if (
    !values.some(Boolean) &&
    customEntries(custom, knownKeys).length === 0
  ) {
    return <EmptyState label="No details saved in this work group." />;
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

  if (
    !values.some(Boolean) &&
    customEntries(custom, knownKeys).length === 0
  ) {
    return <EmptyState label="No details saved in this business group." />;
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
        <LinkedDetailRow label="LinkedIn" value={optionalProfileValue(social, "linkedin")} />
        <LinkedDetailRow label="Website" value={optionalProfileValue(social, "website")} />
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

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">{children}</div>;
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) {
    return null;
  }
  return (
    <div className="min-w-0">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block break-words font-medium text-foreground">{value}</span>
    </div>
  );
}

function LinkedDetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) {
    return null;
  }
  if (!isLinkable(value)) {
    return <DetailRow label={label} value={value} />;
  }
  return (
    <div className="min-w-0">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex min-w-0 items-center gap-2 break-all font-medium text-primary"
      >
        <span className="min-w-0 break-all">{value}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </a>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-full border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
      {label}
    </div>
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
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([label, value]) => (
        <DetailRow key={label} label={displayLabel(label)} value={valueOrNull(value)} />
      ))}
    </div>
  );
}

function ProfileCollection<T extends { groupId: string; tag: string }>({
  title,
  icon: Icon,
  empty,
  items,
  render,
}: {
  title: string;
  icon: typeof Building2;
  empty: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  return (
    <ProfileTabSection
      description={`${items.length} saved group${items.length === 1 ? "" : "s"}`}
      icon={Icon}
      title={title}
    >
      <div className="grid gap-5 xl:grid-cols-2">
        {items.length === 0 && <EmptyState label={empty} />}
        {items.map((item) => (
          <div key={item.groupId}>{render(item)}</div>
        ))}
      </div>
    </ProfileTabSection>
  );
}
