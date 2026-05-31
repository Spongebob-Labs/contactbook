import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  contactMatchesSource,
  fetchAllContacts,
  fetchImportSummary,
  getGoogleLastSyncAt,
} from "@/lib/contacts-api";
import {
  formatContactDate,
  getCompany,
  getContactName,
  getInitials,
  getPrimaryEmail,
  getPrimaryPhone,
  getSearchText,
  getTitle,
} from "@/lib/contact-display";
import type { ContactDetail, ContactImportSummary, ContactSource } from "@/lib/types";
import { cn } from "@/lib/utils";

type SourceFilter = "ALL" | Exclude<ContactSource, "MANUAL">;
type SortKey = "name" | "updatedAt" | "source";
type SortDirection = "asc" | "desc";

const sourceOptions: Array<{ value: SourceFilter; label: string }> = [
  { value: "ALL", label: "All sources" },
  { value: "GOOGLE", label: "Google" },
  { value: "ICLOUD", label: "iCloud" },
  { value: "VCARD", label: "vCard" },
];

const pageSizeOptions = [10, 25, 50];

function compareText(current: string, next: string) {
  return current.localeCompare(next, undefined, { sensitivity: "base" });
}

function ContactAvatar({ contact }: { contact: ContactDetail }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
      {getInitials(contact)}
    </div>
  );
}

export default function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<ContactDetail[]>([]);
  const [summary, setSummary] = useState<ContactImportSummary | null>(null);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadContacts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [contactsData, summaryData] = await Promise.all([
          fetchAllContacts(),
          fetchImportSummary(),
        ]);
        if (isMounted) {
          setContacts(contactsData);
          setSummary(summaryData);
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

  const filteredAndSortedContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return contacts
      .filter((contact) =>
        sourceFilter === "ALL"
          ? true
          : contactMatchesSource(contact, sourceFilter),
      )
      .filter((contact) =>
        normalizedQuery ? getSearchText(contact).includes(normalizedQuery) : true,
      )
      .slice()
      .sort((current, next) => {
        const direction = sortDirection === "asc" ? 1 : -1;
        if (sortKey === "updatedAt") {
          return (
            (new Date(current.updatedAt).getTime() -
              new Date(next.updatedAt).getTime()) *
            direction
          );
        }
        if (sortKey === "source") {
          return compareText(current.source, next.source) * direction;
        }
        return compareText(getContactName(current), getContactName(next)) * direction;
      });
  }, [contacts, query, sortDirection, sortKey, sourceFilter]);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSortedContacts.length / pageSize),
  );
  const currentPage = Math.min(page, totalPages);
  const paginatedContacts = filteredAndSortedContacts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const pageStart =
    filteredAndSortedContacts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filteredAndSortedContacts.length);

  useEffect(() => {
    setPage(1);
  }, [pageSize, query, sortDirection, sortKey, sourceFilter]);

  return (
    <AppShell>
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Contacts</h1>
        </div>
        <div className="flex w-full flex-col gap-3 lg:max-w-2xl lg:items-end">
          <div className="flex flex-col items-start gap-1 lg:items-end">
            <Link
              to="/dashboard/import"
              className={buttonVariants({ variant: "default" })}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Import contacts
            </Link>
            <p className="text-xs text-muted-foreground">
              Last sync {formatContactDate(getGoogleLastSyncAt(summary))}
            </p>
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

      <section>
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <CardTitle>Contacts ({filteredAndSortedContacts.length})</CardTitle>
                <CardDescription>
                  Browse imported contacts and open a contact for full details.
                </CardDescription>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[180px_150px_120px_minmax(220px,280px)]">
                <Select
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
                  aria-label="Filter contacts by source"
                >
                  {sourceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as SortKey)}
                  aria-label="Sort contacts"
                >
                  <option value="name">Name</option>
                  <option value="updatedAt">Updated</option>
                  <option value="source">Source</option>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setSortDirection((current) =>
                      current === "asc" ? "desc" : "asc",
                    )
                  }
                  aria-label="Toggle sort direction"
                >
                  {sortDirection === "asc" ? (
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  )}
                  {sortDirection === "asc" ? "Asc" : "Desc"}
                </Button>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search contacts"
                    className="pl-9"
                  />
                </div>
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

            {!isLoading && !error && filteredAndSortedContacts.length === 0 && (
              <div className="flex min-h-80 flex-col items-center justify-center p-6 text-center">
                <UsersRound className="mb-3 h-9 w-9 text-primary" aria-hidden="true" />
                <h2 className="font-semibold">No contacts found</h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Import contacts from the Import page, or adjust your search.
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

            {!isLoading && !error && filteredAndSortedContacts.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedContacts.map((contact) => (
                      <TableRow
                        key={contact.id}
                        role="link"
                        tabIndex={0}
                        className="cursor-pointer"
                        onClick={() => navigate(`/dashboard/contacts/${contact.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigate(`/dashboard/contacts/${contact.id}`);
                          }
                        }}
                      >
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-3">
                            <ContactAvatar contact={contact} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {getContactName(contact)}
                              </p>
                              <p className="truncate text-sm text-muted-foreground">
                                {getCompany(contact) ||
                                  getTitle(contact) ||
                                  contact.source.toLowerCase()}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-64 truncate text-muted-foreground">
                          {getPrimaryEmail(contact) || "No email"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {getPrimaryPhone(contact) || "No phone"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{contact.source.toLowerCase()}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatContactDate(contact.updatedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {pageStart}-{pageEnd} of {filteredAndSortedContacts.length}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={String(pageSize)}
                      onChange={(event) => setPageSize(Number(event.target.value))}
                      className="w-28"
                      aria-label="Rows per page"
                    >
                      {pageSizeOptions.map((value) => (
                        <option key={value} value={value}>
                          {value} / page
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((current) => Math.min(totalPages, current + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
