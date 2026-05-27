import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Building2,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { mockProfile } from "@/lib/mock-data";
import type { PostalAddress, ProfileMeResponse } from "@/lib/types";

type AddressLike = Partial<PostalAddress>;
type CustomRecord = Record<string, string | null | undefined>;

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

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

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
      <section className="rounded-lg border border-border bg-card p-6 md:p-8">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-12 w-full max-w-2xl" />
            <Skeleton className="h-10 w-40" />
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

      {isMockData && <SampleDataNotice />}

      {!isLoading && profile && (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                {profile.identity.profilePhoto ? (
                  <img
                    src={profile.identity.profilePhoto}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound className="h-9 w-9 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <div>
                <Badge variant="success">Profile</Badge>
                <h1 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
                  {fullName(profile)}
                </h1>
                <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap">
                  <span className="inline-flex items-center gap-2">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    {profile.identity.primaryPhone}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    {profile.identity.primaryEmail}
                  </span>
                </div>
              </div>
            </div>
            <Link
              to="/dashboard?onboarding=profile&returnTo=/profile"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <Edit3 className="h-4 w-4" aria-hidden="true" />
                Edit profile
            </Link>
          </div>
        )}
      </section>

      {profile && (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <SummaryCard label="Work cards" value={totals.work} />
            <SummaryCard label="Business cards" value={totals.business} />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                  Personal
                </CardTitle>
                <CardDescription>{profile.personal.tag}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <PersonalDetails personal={profile.personal} social={profile.socials[0]} />
              </CardContent>
            </Card>

            <ProfileCollection
              title="Work"
              icon={Building2}
              empty="No work profiles added yet."
              items={profile.work}
              render={(item) => <WorkDetails item={item} />}
            />

            <ProfileCollection
              title="Business"
              icon={Building2}
              empty="No business profiles added yet."
              items={profile.business}
              render={(item) => <BusinessDetails item={item} social={profile.socials[0]} />}
            />
          </section>
        </>
      )}
    </AppShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
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
        <ImageDetailRow
          alt="Company logo"
          label="Company logo"
          value={companyLogo}
        />
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
        <ImageDetailRow
          alt="Business logo"
          label="Business logo"
          value={businessLogo}
        />
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
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) {
    return null;
  }
  return (
    <div className="grid gap-1 text-sm">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <span className="break-words text-foreground">{value}</span>
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
    <div className="grid gap-1 text-sm">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-w-0 items-center gap-2 break-all font-medium text-primary"
      >
        <span className="min-w-0 break-all">{value}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </a>
    </div>
  );
}

function ImageDetailRow({
  alt,
  label,
  value,
}: {
  alt: string;
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
    <div className="grid gap-2 text-sm">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="group inline-flex w-fit max-w-full items-center gap-3 rounded-md border border-border bg-muted/30 p-2 transition-colors hover:bg-muted"
      >
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
          <img src={value} alt={alt} className="h-full w-full object-contain" />
        </span>
        <span className="min-w-0 max-w-64 truncate font-medium text-primary">
          Open image
        </span>
        <ExternalLink
          className="h-3.5 w-3.5 shrink-0 text-primary"
          aria-hidden="true"
        />
      </a>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{items.length} saved group{items.length === 1 ? "" : "s"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 && <EmptyState label={empty} />}
        {items.map((item) => (
          <div key={item.groupId} className="space-y-3 rounded-md border border-border p-4">
            <Badge variant="secondary">{item.tag}</Badge>
            {render(item)}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
