import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Globe,
  Mail,
  MapPin,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SampleDataNotice } from "@/components/sample-data-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import {
  formatContactDate,
  getCompany,
  getContactName,
  getInitials,
  getLocation,
  getPrimaryEmail,
  getPrimaryPhone,
  getTitle,
} from "@/lib/contact-display";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { mockContactDetail } from "@/lib/mock-data";
import type { ContactDetail } from "@/lib/types";

function ContactAvatar({ contact }: { contact: ContactDetail }) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-secondary-foreground">
      {getInitials(contact)}
    </div>
  );
}

function DetailTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-md border border-border p-4">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-sm">{value}</p>
      </div>
    </div>
  );
}

function ListSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {children ?? <p className="text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  );
}

export default function ContactDetailPage() {
  const { contactId } = useParams();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadContact = async () => {
      if (!contactId) {
        setError("Contact id is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const data = await apiFetch<ContactDetail>(`/v1/contacts/${contactId}`);
        if (isMounted) {
          setContact(data);
          setIsMockData(false);
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load contact", err);
          setContact(mockContactDetail(contactId));
          setIsMockData(true);
          setError(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadContact();
    return () => {
      isMounted = false;
    };
  }, [contactId]);

  return (
    <AppShell>
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/dashboard/contacts"
          className={buttonVariants({ variant: "outline" })}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Contacts
        </Link>
      </section>

      {error && (
        <Alert className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">Could not load contact</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {friendlyErrorMessages.load}
            </p>
          </div>
        </Alert>
      )}

      {isMockData && <SampleDataNotice />}

      {isLoading && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && contact && (
        <>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <ContactAvatar contact={contact} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-semibold tracking-normal">
                        {getContactName(contact)}
                      </h1>
                      <Badge variant="secondary">{contact.source.toLowerCase()}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {getCompany(contact) || getTitle(contact) || "Contact"}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:text-right">
                  <p>Created {formatContactDate(contact.createdAt)}</p>
                  <p>Updated {formatContactDate(contact.updatedAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-4 md:grid-cols-3">
            <DetailTile
              icon={Mail}
              label="Primary email"
              value={getPrimaryEmail(contact) || "No email"}
            />
            <DetailTile
              icon={Phone}
              label="Primary phone"
              value={getPrimaryPhone(contact) || "No phone"}
            />
            <DetailTile
              icon={MapPin}
              label="Location"
              value={getLocation(contact) || "No location"}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <ListSection title="Phones" empty="No phone numbers">
              {contact.phones.length > 0 ? (
                <div className="grid gap-2">
                  {contact.phones.map((phone) => (
                    <div key={`${phone.value}-${phone.label ?? "phone"}`} className="rounded-md border border-border p-3">
                      <p className="font-medium">{phone.value}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {phone.label ?? "Phone"}{phone.isPrimary ? " - Primary" : ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </ListSection>

            <ListSection title="Emails" empty="No email addresses">
              {contact.emails.length > 0 ? (
                <div className="grid gap-2">
                  {contact.emails.map((email) => (
                    <div key={`${email.value}-${email.label ?? "email"}`} className="rounded-md border border-border p-3">
                      <p className="font-medium">{email.value}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {email.label ?? "Email"}{email.isPrimary ? " - Primary" : ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </ListSection>

            <ListSection title="Organizations" empty="No organizations">
              {contact.organizations.length > 0 ? (
                <div className="grid gap-2">
                  {contact.organizations.map((organization, index) => (
                    <div key={`${organization.companyName ?? "organization"}-${index}`} className="rounded-md border border-border p-3">
                      <div className="flex items-start gap-3">
                        <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <div>
                          <p className="font-medium">
                            {organization.companyName ?? "Organization"}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {[organization.title, organization.department]
                              .filter(Boolean)
                              .join(" - ") || "No role details"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </ListSection>

            <ListSection title="Addresses" empty="No addresses">
              {contact.addresses.length > 0 ? (
                <div className="grid gap-2">
                  {contact.addresses.map((address, index) => (
                    <div key={`${address.street ?? "address"}-${index}`} className="rounded-md border border-border p-3">
                      <p className="font-medium">
                        {[address.street, address.city, address.region]
                          .filter(Boolean)
                          .join(", ") || "Address"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {[address.postalCode, address.country].filter(Boolean).join(", ") ||
                          "No location details"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </ListSection>
          </section>

          <section>
            <ListSection title="URLs" empty="No URLs">
              {contact.urls.length > 0 ? (
                <div className="grid gap-2">
                  {contact.urls.map((url) => (
                    <div key={url.value} className="flex items-start gap-3 rounded-md border border-border p-3">
                      <Globe className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0">
                        <a
                          href={url.value}
                          target="_blank"
                          rel="noreferrer"
                          className="break-words font-medium hover:underline"
                        >
                          {url.value}
                        </a>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {url.label ?? "URL"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </ListSection>
          </section>

          {contact.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {contact.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}
