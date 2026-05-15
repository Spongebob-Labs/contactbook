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

function fullName(profile: ProfileMeResponse): string {
  return `${profile.identity.firstName} ${profile.identity.lastName}`.trim();
}

function formatAddress(address: PostalAddress | undefined): string | null {
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

function maskMiddle(value: string): string {
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
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
              to="/onboarding/profile"
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
                <DetailRow label="Postal address" value={formatAddress(profile.personal.postalAddress)} />
                <CustomDetails custom={profile.personal.custom} />
                {!profile.personal.postalAddress &&
                  Object.keys(profile.personal.custom ?? {}).length === 0 && (
                    <EmptyState label="No personal details added yet." />
                  )}
              </CardContent>
            </Card>

            <ProfileCollection
              title="Work"
              icon={Building2}
              empty="No work profiles added yet."
              items={profile.work}
              render={(item) => (
                <>
                  <DetailRow label="Company" value={item.companyName} />
                  <DetailRow label="Title" value={item.workTitle} />
                  <DetailRow label="Address" value={formatAddress(item.workPostalAddress)} />
                  {item.companyLogo && (
                    <a
                      href={item.companyLogo}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary"
                    >
                      Company logo
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                  <CustomDetails custom={item.custom} />
                </>
              )}
            />

            <ProfileCollection
              title="Business"
              icon={Building2}
              empty="No business profiles added yet."
              items={profile.business}
              render={(item) => (
                <>
                  <DetailRow label="Business" value={item.businessName} />
                  <DetailRow label="Title" value={item.businessTitle} />
                  <DetailRow label="Address" value={formatAddress(item.businessPostalAddress)} />
                  {item.businessLogo && (
                    <a
                      href={item.businessLogo}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary"
                    >
                      Business logo
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                  <CustomDetails custom={item.custom} />
                </>
              )}
            />

            <ProfileCollection
              title="Socials"
              icon={ExternalLink}
              empty="No social profiles added yet."
              items={profile.socials}
              render={(item) => <CustomDetails custom={item.custom} />}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <FinancialCard title="Bank accounts" icon={Landmark}>
              {profile.financial.bankAccounts.length === 0 && (
                <EmptyState label="No bank accounts added yet." />
              )}
              {profile.financial.bankAccounts.map((item) => (
                <FinancialItem key={item.groupId} tag={item.tag} sensitive={item.isSensitive}>
                  <DetailRow label="Bank" value={item.bankName} />
                  <DetailRow label="Holder" value={item.accountHolder} />
                  <DetailRow label="Account" value={maskMiddle(item.accountNumber)} />
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
                <FinancialItem key={item.groupId} tag={item.tag} sensitive={item.isSensitive}>
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
                <FinancialItem key={item.groupId} tag={item.tag} sensitive={item.isSensitive}>
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

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function CustomDetails({ custom }: { custom?: Record<string, string> }) {
  const entries = Object.entries(custom ?? {}).filter(([, value]) => Boolean(value));
  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([label, value]) => (
        <DetailRow key={label} label={label} value={value} />
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
