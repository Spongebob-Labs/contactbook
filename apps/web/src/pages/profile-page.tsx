import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  CircleDollarSign,
  Edit3,
  ExternalLink,
  Landmark,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
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

function maskMiddle(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function isLinkable(value: string | null): value is string {
  return Boolean(value && /^(https?:|data:image\/)/i.test(value));
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiFetch<ProfileMeResponse>("/v1/profile/me");
        if (isMounted) {
          setProfile(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Could not load profile.");
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
      return { work: 0, business: 0, socials: 0, financial: 0 };
    }
    return {
      work: profile.work.length,
      business: profile.business.length,
      socials: profile.socials.length,
      financial:
        profile.financial.bankAccounts.length +
        profile.financial.digitalWallets.length +
        profile.financial.cryptoWallets.length,
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
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
          </Alert>
        )}

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
          <section className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Work profiles" value={totals.work} />
            <SummaryCard label="Businesses" value={totals.business} />
            <SummaryCard label="Social groups" value={totals.socials} />
            <SummaryCard label="Financial rows" value={totals.financial} />
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
                <PersonalDetails personal={profile.personal} />
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
              render={(item) => <BusinessDetails item={item} />}
            />

            <ProfileCollection
              title="Socials"
              icon={ExternalLink}
              empty="No social profiles added yet."
              items={profile.socials}
              render={(item) => <SocialDetails item={item} />}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <FinancialCard title="Bank accounts" icon={Landmark}>
              {profile.financial.bankAccounts.length === 0 && (
                <EmptyState label="No bank accounts added yet." />
              )}
              {profile.financial.bankAccounts.map((item) => (
                <FinancialItem
                  key={item.fieldId ?? item.groupId}
                  tag={item.tag}
                  sensitive={item.isSensitive}
                >
                  <DetailRow label="Bank" value={item.bankName} />
                  <DetailRow label="Holder" value={item.accountHolder} />
                  <DetailRow label="Account" value={maskMiddle(item.accountNumber)} />
                  <DetailRow label="IBAN" value={maskMiddle(item.iban)} />
                  <DetailRow label="SWIFT/BIC" value={item.swiftBic} />
                  <DetailRow label="Routing number" value={item.routingNumber} />
                  <DetailRow label="IFSC" value={item.ifsc} />
                  <DetailRow label="Currency" value={item.currency} />
                </FinancialItem>
              ))}
            </FinancialCard>

            <FinancialCard title="Digital wallets" icon={CircleDollarSign}>
              {profile.financial.digitalWallets.length === 0 && (
                <EmptyState label="No digital wallets added yet." />
              )}
              {profile.financial.digitalWallets.map((item) => (
                <FinancialItem
                  key={item.fieldId ?? item.groupId}
                  tag={item.tag}
                  sensitive={item.isSensitive}
                >
                  <DetailRow label="Platform" value={item.platform} />
                  <DetailRow label="Handle or link" value={item.handleOrLink} />
                </FinancialItem>
              ))}
            </FinancialCard>

            <FinancialCard title="Crypto wallets" icon={CircleDollarSign}>
              {profile.financial.cryptoWallets.length === 0 && (
                <EmptyState label="No crypto wallets added yet." />
              )}
              {profile.financial.cryptoWallets.map((item) => (
                <FinancialItem
                  key={item.fieldId ?? item.groupId}
                  tag={item.tag}
                  sensitive={item.isSensitive}
                >
                  <DetailRow label="Network" value={item.network} />
                  <DetailRow label="Address" value={maskMiddle(item.address)} />
                </FinancialItem>
              ))}
            </FinancialCard>
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
}: {
  personal: ProfileMeResponse["personal"];
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
        <LinkedDetailRow label="Company logo" value={companyLogo} />
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
}: {
  item: ProfileMeResponse["business"][number];
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
        <LinkedDetailRow label="Business logo" value={businessLogo} />
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

function SocialDetails({ item }: { item: ProfileMeResponse["socials"][number] }) {
  const custom = item.custom;
  const knownKeys = [
    "skype",
    "facebook",
    "twitter",
    "whatsApp",
    "whatsapp",
    "blog",
    "website",
    "linkedin",
    "github",
  ];
  const values = [
    profileValue(item, "skype"),
    profileValue(item, "facebook"),
    profileValue(item, "twitter"),
    profileValue(item, "whatsApp", "whatsapp"),
    profileValue(item, "blog"),
    profileValue(item, "website"),
    profileValue(item, "linkedin"),
    profileValue(item, "github"),
  ];

  if (
    !values.some(Boolean) &&
    customEntries(custom, knownKeys).length === 0
  ) {
    return <EmptyState label="No details saved in this social group." />;
  }

  return (
    <>
      <DetailGrid>
        <DetailRow label="Skype" value={profileValue(item, "skype")} />
        <DetailRow label="Facebook" value={profileValue(item, "facebook")} />
        <DetailRow label="Twitter" value={profileValue(item, "twitter")} />
        <DetailRow label="WhatsApp" value={profileValue(item, "whatsApp", "whatsapp")} />
        <DetailRow label="Blog" value={profileValue(item, "blog")} />
        <LinkedDetailRow label="Website" value={profileValue(item, "website")} />
        <LinkedDetailRow label="LinkedIn" value={profileValue(item, "linkedin")} />
        <LinkedDetailRow label="GitHub" value={profileValue(item, "github")} />
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

function FinancialCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Landmark;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function FinancialItem({
  tag,
  sensitive,
  children,
}: {
  tag: string;
  sensitive: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="secondary">{tag}</Badge>
        {sensitive && <Badge variant="warning">Sensitive</Badge>}
      </div>
      {children}
    </div>
  );
}
