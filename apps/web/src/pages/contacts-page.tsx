import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CalendarDays,
  Download,
  Mail,
  MapPin,
  Phone,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type { ContactDetail, ContactImportSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

function getContactName(contact: ContactDetail) {
  if (contact.displayName?.trim()) {
    return contact.displayName.trim();
  }
  return [contact.firstName, contact.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ") || "Unnamed contact";
}

function getInitials(contact: ContactDetail) {
  const name = getContactName(contact);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "?";
}

function getPrimaryOrganization(contact: ContactDetail) {
  return (
    contact.organizations.find((organization) => organization.isPrimary) ??
    contact.organizations[0] ??
    null
  );
}

function getPrimaryAddress(contact: ContactDetail) {
  return (
    contact.addresses.find((address) => address.isPrimary) ??
    contact.addresses[0] ??
    null
  );
}

function getCompany(contact: ContactDetail) {
  return getPrimaryOrganization(contact)?.companyName ?? "";
}

function getTitle(contact: ContactDetail) {
  return getPrimaryOrganization(contact)?.title ?? "";
}

function getLocation(contact: ContactDetail) {
  const address = getPrimaryAddress(contact);
  if (!address) {
    return "";
  }
  return [address.city, address.region, address.country].filter(Boolean).join(", ");
}

function getPrimaryEmail(contact: ContactDetail) {
  return contact.primaryEmail?.value ?? contact.emails[0]?.value ?? "";
}

function getPrimaryPhone(contact: ContactDetail) {
  return contact.primaryPhone?.value ?? contact.phones[0]?.value ?? "";
}

function getSearchText(contact: ContactDetail) {
  return [
    getContactName(contact),
    getPrimaryEmail(contact),
    getPrimaryPhone(contact),
    getCompany(contact),
    getTitle(contact),
    getLocation(contact),
    contact.source,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not synced";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getGoogleSummary(summary: ContactImportSummary | null) {
  return summary?.bySource.find((item) => item.source === "GOOGLE") ?? null;
}

function ContactAvatar({ contact }: { contact: ContactDetail }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
      {getInitials(contact)}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-md border border-border p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-sm">{value}</p>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactDetail[]>([]);
  const [summary, setSummary] = useState<ContactImportSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadContacts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [contactsData, summaryData] = await Promise.all([
          apiFetch<ContactDetail[]>("/v1/contacts"),
          apiFetch<ContactImportSummary>("/v1/contacts/import"),
        ]);
        if (isMounted) {
          setContacts(contactsData);
          setSummary(summaryData);
          setSelectedId((current) => current ?? contactsData[0]?.id ?? null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Could not load contacts.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadContacts();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return contacts;
    }
    return contacts.filter((contact) => getSearchText(contact).includes(normalizedQuery));
  }, [contacts, query]);

  const selectedContact = useMemo(
    () =>
      filteredContacts.find((contact) => contact.id === selectedId) ??
      filteredContacts[0] ??
      null,
    [filteredContacts, selectedId],
  );
  const googleSummary = getGoogleSummary(summary);

  return (
    <AppShell>
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">Contacts</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">Contacts</h1>
        </div>
        <div className="flex w-full flex-col gap-3 lg:max-w-2xl lg:items-end">
          <Link
            to="/dashboard/import"
            className={buttonVariants({ variant: "default" })}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Import contacts
          </Link>
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search contacts"
              className="h-12 rounded-full bg-muted pl-12 text-base"
            />
          </div>
        </div>
      </section>

      {error && (
        <Alert className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">Could not load contacts</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </Alert>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border">
            <div className="flex items-end justify-between gap-3">
              <div>
                <CardTitle>Contacts ({filteredContacts.length})</CardTitle>
                <CardDescription>
                  Synced contact records from your connected sources.
                </CardDescription>
              </div>
              <div className="hidden items-center gap-3 md:flex">
                <p className="text-sm text-muted-foreground">
                  Last sync {formatDate(googleSummary?.lastSyncAt)}
                </p>
                <Link
                  to="/dashboard/import"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Import
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && (
              <div className="space-y-1 p-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            )}

            {!isLoading && !error && filteredContacts.length === 0 && (
              <div className="flex min-h-80 flex-col items-center justify-center p-6 text-center">
                <UsersRound className="mb-3 h-9 w-9 text-primary" aria-hidden="true" />
                <h2 className="font-semibold">No contacts found</h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Sync Google contacts from the Import page, or adjust your search.
                </p>
                <Link
                  to="/dashboard/import"
                  className={cn(buttonVariants({ variant: "default" }), "mt-5")}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Import contacts
                </Link>
              </div>
            )}

            {!isLoading && !error && filteredContacts.length > 0 && (
              <div>
                <div className="hidden grid-cols-[minmax(220px,1fr)_minmax(180px,0.8fr)_160px] border-b border-border px-4 py-3 text-xs font-medium uppercase text-muted-foreground md:grid">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Phone</span>
                </div>
                <div className="divide-y divide-border">
                  {filteredContacts.map((contact) => {
                    const isSelected = selectedContact?.id === contact.id;
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => setSelectedId(contact.id)}
                        className={cn(
                          "grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/70 md:grid-cols-[minmax(220px,1fr)_minmax(180px,0.8fr)_160px] md:items-center",
                          isSelected && "bg-secondary/70",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <ContactAvatar contact={contact} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{getContactName(contact)}</p>
                            <p className="truncate text-sm text-muted-foreground">
                              {getCompany(contact) || getTitle(contact) || contact.source.toLowerCase()}
                            </p>
                          </div>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {getPrimaryEmail(contact) || "No email"}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {getPrimaryPhone(contact) || "No phone"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:sticky xl:top-24 xl:h-fit">
          <CardHeader>
            <CardTitle>Contact details</CardTitle>
            <CardDescription>
              {selectedContact ? "Selected contact" : "Select a contact"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-16 rounded-full" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : selectedContact ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <ContactAvatar contact={selectedContact} />
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">
                      {getContactName(selectedContact)}
                    </h2>
                    <p className="truncate text-sm text-muted-foreground">
                      {getCompany(selectedContact) || selectedContact.source.toLowerCase()}
                    </p>
                  </div>
                </div>
                <DetailRow
                  icon={Mail}
                  label="Email"
                  value={getPrimaryEmail(selectedContact) || "No email"}
                />
                <DetailRow
                  icon={Phone}
                  label="Phone"
                  value={getPrimaryPhone(selectedContact) || "No phone"}
                />
                <DetailRow
                  icon={MapPin}
                  label="Location"
                  value={getLocation(selectedContact) || "No location"}
                />
                <DetailRow
                  icon={CalendarDays}
                  label="Updated"
                  value={formatDate(selectedContact.updatedAt)}
                />
                <Badge variant="secondary">{selectedContact.source.toLowerCase()}</Badge>
              </div>
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center text-center">
                <UserRound className="mb-3 h-8 w-8 text-primary" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  Choose a contact from the list to inspect details.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
