import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
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
import { SampleDataNotice } from "@/components/sample-data-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { apiFetch } from "@/lib/api";
import {
  formatContactDate,
  getCompany,
  getContactName,
  getInitials,
  getPrimaryEmail,
  getPrimaryPhone,
  getTitle,
} from "@/lib/contact-display";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { mockContactListResponse } from "@/lib/mock-data";
import type { ContactDetail, ContactListResponse, ContactSource } from "@/lib/types";
import { cn } from "@/lib/utils";

type SourceFilter = "ALL" | Exclude<ContactSource, "MANUAL">;
type SortKey = "name" | "updatedAt" | "source";
type SortDirection = "asc" | "desc";

const sourceOptions: Array<{ value: SourceFilter; label: string }> = [
  { value: "ALL", label: "All sources" },
  { value: "GOOGLE", label: "Google" },
  { value: "ICLOUD", label: "iCloud" },
  { value: "CSV", label: "CSV" },
  { value: "VCARD", label: "vCard" },
  { value: "CALDAV", label: "CalDAV" },
];

const pageSizeOptions = [25, 50, 100];

const sourceBadgeStyles: Record<ContactSource, string> = {
  GOOGLE: "bg-primary text-primary-foreground ring-primary/20",
  ICLOUD: "bg-secondary text-secondary-foreground ring-secondary-foreground/10",
  CSV: "bg-success/12 text-success ring-success/20",
  VCARD: "bg-accent text-accent-foreground ring-accent-foreground/10",
  CALDAV: "bg-warning/15 text-warning ring-warning/25",
  MANUAL: "border border-border bg-background text-muted-foreground",
};

function ContactAvatar({ contact }: { contact: ContactDetail }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
      {getInitials(contact)}
    </div>
  );
}

function buildContactsPath({
  page,
  pageSize,
  query,
  sortDirection,
  sortKey,
  sourceFilter,
}: {
  page: number;
  pageSize: number;
  query: string;
  sortDirection: SortDirection;
  sortKey: SortKey;
  sourceFilter: SourceFilter;
}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
    sort: sortKey,
    sortOrder: sortDirection,
  });
  const search = query.trim();
  if (search) {
    params.set("search", search);
  }
  if (sourceFilter !== "ALL") {
    params.set("source", sourceFilter);
  }
  return `/v1/contacts?${params.toString()}`;
}

function isContactListResponse(value: unknown): value is ContactListResponse {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    Array.isArray((value as ContactListResponse).items) &&
    typeof (value as ContactListResponse).total === "number"
  );
}

export default function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<ContactDetail[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  const columns = useMemo<ColumnDef<ContactDetail>[]>(
    () => [
      {
        accessorKey: "displayName",
        header: "Name",
        cell: ({ row }) => {
          const contact = row.original;
          return (
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
          );
        },
      },
      {
        id: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="block max-w-64 truncate text-muted-foreground">
            {getPrimaryEmail(row.original) || "No email"}
          </span>
        ),
      },
      {
        id: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {getPrimaryPhone(row.original) || "No phone"}
          </span>
        ),
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => (
          <Badge
            variant="secondary"
            className={cn("rounded-full", sourceBadgeStyles[row.original.source])}
          >
            {row.original.source.toLowerCase()}
          </Badge>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatContactDate(row.original.updatedAt)}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: contacts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    let isMounted = true;

    const loadContacts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiFetch<unknown>(
          buildContactsPath({
            page,
            pageSize,
            query: debouncedQuery,
            sortDirection,
            sortKey,
            sourceFilter,
          }),
        );
        if (!isContactListResponse(response)) {
          throw new Error("Contacts response was not usable.");
        }
        if (isMounted) {
          setContacts(response.items);
          setTotal(response.total);
          setTotalPages(Math.max(1, response.totalPages));
          setIsMockData(false);
          if (response.totalPages > 0 && page > response.totalPages) {
            setPage(response.totalPages);
          }
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load contacts", err);
          setContacts(mockContactListResponse.items);
          setTotal(mockContactListResponse.total);
          setTotalPages(mockContactListResponse.totalPages);
          setIsMockData(true);
          setError(null);
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
  }, [debouncedQuery, page, pageSize, sortDirection, sortKey, sourceFilter]);

  const currentPage = Math.min(page, totalPages);
  const pageStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, total);

  const updateSourceFilter = (value: SourceFilter) => {
    setSourceFilter(value);
    setPage(1);
  };

  const updateSortKey = (value: SortKey) => {
    setSortKey(value);
    setPage(1);
  };

  const updateSortDirection = () => {
    setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    setPage(1);
  };

  const updatePageSize = (value: number) => {
    setPageSize(value);
    setPage(1);
  };

  const updateQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  return (
    <AppShell>
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Contacts</h1>
        </div>
        <div className="flex w-full flex-col gap-3 lg:max-w-2xl lg:items-end">
          <Link
            to="/dashboard/import"
            className={cn(buttonVariants({ variant: "default" }), "rounded-full")}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Import contacts
          </Link>
        </div>
      </section>

      {error && (
        <Alert className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">Could not load contacts</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {friendlyErrorMessages.load}
            </p>
          </div>
        </Alert>
      )}

      {isMockData && <SampleDataNotice />}

      <section className="space-y-4">
        <div className="flex justify-end">
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[180px_150px_120px_minmax(220px,280px)]">
            <Select
              value={sourceFilter}
              onChange={(event) => updateSourceFilter(event.target.value as SourceFilter)}
              className="rounded-full"
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
              onChange={(event) => updateSortKey(event.target.value as SortKey)}
              className="rounded-full"
              aria-label="Sort contacts"
            >
              <option value="name">Name</option>
              <option value="updatedAt">Updated</option>
              <option value="source">Source</option>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={updateSortDirection}
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
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="Search contacts"
                className="rounded-full pl-9"
              />
            </div>
          </div>
        </div>
        <div className="overflow-hidden border-y border-border">
            {isLoading && (
              <div className="space-y-1 p-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            )}

            {!isLoading && !error && contacts.length === 0 && (
              <div className="flex min-h-80 flex-col items-center justify-center p-6 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UsersRound className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="font-semibold">No contacts found</h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Import contacts from the Import page, or adjust your search.
                </p>
                <Link
                  to="/dashboard/import"
                  className={cn(buttonVariants({ variant: "default" }), "mt-5 rounded-full")}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Import contacts
                </Link>
              </div>
            )}

            {!isLoading && !error && contacts.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        role="link"
                        tabIndex={0}
                        className="cursor-pointer"
                        onClick={() => navigate(`/dashboard/contacts/${row.original.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigate(`/dashboard/contacts/${row.original.id}`);
                          }
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {pageStart}-{pageEnd} of {total}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={String(pageSize)}
                      onChange={(event) => updatePageSize(Number(event.target.value))}
                      className="w-28 rounded-full"
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
                      className="rounded-full"
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
                      className="rounded-full"
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
        </div>
      </section>
    </AppShell>
  );
}
