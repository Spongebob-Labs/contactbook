import { useEffect, useMemo, useState } from "react";
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
import { SampleDataNotice } from "@/components/sample-data-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { apiFetch } from "@/lib/api";
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
      <div className="space-y-4 app-fade-up">
        {isMockData && <SampleDataNotice />}

        {isLoading && (
          <section className="space-y-4 rounded-2xl border border-border/70 p-4 glass-panel md:p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
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
          <section className="rounded-2xl border border-border/70 glass-panel">
            <div className="border-b border-border/60 p-4 md:p-5">
              <ProfileHeader profile={profile} />
              <div className="mt-4">
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
              </div>
            </div>

            <div className="p-4 md:p-5">
              {activeTab === "personal" && (
                <PersonalProfileCard profile={profile} />
              )}

              {activeTab === "work" && (
                <ProfileCollection
                  empty="No work profiles added yet."
                  items={profile.work}
                  render={(item) => <WorkProfileCard item={item} />}
                />
              )}

              {activeTab === "business" && (
                <ProfileCollection
                  empty="No business profiles added yet."
                  items={profile.business}
                  render={(item) => (
                    <BusinessProfileCard item={item} social={profile.socials[0]} />
                  )}
                />
              )}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function ProfileHeader({ profile }: { profile: ProfileMeResponse }) {
  const title = profileValue(profile.personal, "title");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-muted/70">
          {profile.identity.profilePhoto ? (
            <img
              src={profile.identity.profilePhoto}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <UserRound className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight md:text-2xl">
              {fullName(profile)}
            </h1>
            <Badge variant="secondary">Profile</Badge>
          </div>
          {title && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{title}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{profile.identity.primaryPhone}</span>
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-border sm:inline-block" />
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{profile.identity.primaryEmail}</span>
            </span>
          </div>
        </div>
      </div>
      <Link
        to="/dashboard?onboarding=profile&returnTo=/profile"
        className={cn(buttonVariants(), "shrink-0 self-start sm:self-center")}
      >
        <Edit3 className="h-4 w-4" aria-hidden="true" />
        Edit profile
      </Link>
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
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-xs font-semibold text-primary">
      {initials !== "CB" ? (
        initials
      ) : (
        <FallbackIcon className="h-4 w-4" aria-hidden="true" />
      )}
    </div>
  );
}

function PersonalProfileCard({ profile }: { profile: ProfileMeResponse }) {
  return (
    <RecordPanel badge={profile.personal.tag || "Personal details"}>
      <PersonalDetails personal={profile.personal} social={profile.socials[0]} />
    </RecordPanel>
  );
}

function WorkProfileCard({ item }: { item: ProfileMeResponse["work"][number] }) {
  const companyLogo = profileValue(item, "companyLogo");
  const companyName = profileValue(item, "companyName") ?? item.tag ?? "Work profile";
  const workTitle = profileValue(item, "workTitle");

  return (
    <RecordPanel
      badge={item.tag || "Work"}
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
    return <EmptyFieldsState label="No personal details added yet." />;
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
        <LinkedDetailRow
          isLinkable={isLinkable}
          label="Facebook"
          value={optionalProfileValue(social, "facebook")}
        />
        <LinkedDetailRow
          isLinkable={isLinkable}
          label="Instagram"
          value={optionalProfileValue(social, "instagram")}
        />
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

  if (
    !values.some(Boolean) &&
    customEntries(custom, knownKeys).length === 0
  ) {
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
    <DetailGrid className="mt-3.5 border-t border-border/60 pt-3.5">
      {entries.map(([label, value]) => (
        <DetailRow key={label} label={displayLabel(label)} value={valueOrNull(value)} />
      ))}
    </DetailGrid>
  );
}

function ProfileCollection<T extends { groupId: string; tag: string }>({
  empty,
  items,
  render,
}: {
  empty: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) {
    return <EmptyFieldsState label={empty} />;
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {items.map((item) => (
        <div key={item.groupId}>{render(item)}</div>
      ))}
    </div>
  );
}
