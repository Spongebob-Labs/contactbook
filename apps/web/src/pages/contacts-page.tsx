import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Tags,
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
  fetchContactGroups,
  fetchContactSourceTotals,
  fetchContactTags,
} from "@/lib/contacts-api";
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
import type {
  ContactDetail,
  ContactGroup,
  ContactLabel,
  ContactListResponse,
  ContactSource,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type SourceFilter = "ALL" | ContactSource;
type SortKey = "name" | "updatedAt" | "source";
type SortDirection = "asc" | "desc";

const contactSourceValues: ContactSource[] = [
  "GOOGLE",
  "ICLOUD",
  "VCARD",
  "CONTACTBOOK",
];

const sourceOptions: Array<{ value: SourceFilter; label: string }> = [
  { value: "ALL", label: "All sources" },
  { value: "GOOGLE", label: "Google" },
  { value: "ICLOUD", label: "iCloud" },
  { value: "VCARD", label: "vCard" },
  { value: "CONTACTBOOK", label: "ContactBook" },
];

const pageSizeOptions = [25, 50, 100];

const sourceBadgeStyles: Record<ContactSource, string> = {
  GOOGLE: "bg-primary text-primary-foreground ring-primary/20",
  ICLOUD: "bg-secondary text-secondary-foreground ring-secondary-foreground/10",
  VCARD: "bg-accent text-accent-foreground ring-accent-foreground/10",
  CONTACTBOOK: "bg-success/12 text-success ring-success/20",
};

const sortableTableColumns: Partial<Record<string, SortKey>> = {
  name: "name",
  source: "source",
  updatedAt: "updatedAt",
};

function ContactAvatar({ contact }: { contact: ContactDetail }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
      {getInitials(contact)}
    </div>
  );
}

function readSourceFilter(value: string | null): SourceFilter {
  if (contactSourceValues.includes(value as ContactSource)) {
    return value as ContactSource;
  }
  return "ALL";
}

function readSingleIdParam(value: string | null) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean)[0] ?? "ALL";
}

function buildContactsPath({
  groupFilter,
  page,
  pageSize,
  query,
  sortDirection,
  sortKey,
  sourceFilter,
  tagFilter,
}: {
  groupFilter: string;
  page: number;
  pageSize: number;
  query: string;
  sortDirection: SortDirection;
  sortKey: SortKey;
  sourceFilter: SourceFilter;
  tagFilter: string;
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
  if (tagFilter !== "ALL") {
    params.set("tagIds", tagFilter);
  }
  if (groupFilter !== "ALL") {
    params.set("groupIds", groupFilter);
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

function getSortTooltipText(
  columnSortKey: SortKey,
  label: string,
  isActive: boolean,
  sortDirection: SortDirection,
) {
  if (!isActive) {
    return `Click to sort contacts by ${label.toLowerCase()}.`;
  }

  if (columnSortKey === "updatedAt") {
    return sortDirection === "asc"
      ? "Showing oldest first. Click for newest first."
      : "Showing newest first. Click for oldest first.";
  }

  return sortDirection === "asc"
    ? "Showing A to Z. Click for Z to A."
    : "Showing Z to A. Click for A to Z.";
}

function renderContactLabels(contact: ContactDetail) {
  const labels = [
    ...contact.tags.map((tag) => ({ id: `tag-${tag.id}`, label: tag.name, tone: "tag" })),
    ...contact.groups.map((group) => ({
      id: `group-${group.id}`,
      label: group.name,
      tone: "group",
    })),
  ];
  const visibleLabels = labels.slice(0, 3);
  const hiddenCount = labels.length - visibleLabels.length;

  if (labels.length === 0) {
    return <span className="text-sm text-muted-foreground">Unassigned</span>;
  }

  return (
    <div className="flex max-w-72 flex-wrap gap-1.5">
      {visibleLabels.map((label) => (
        <Badge
          key={label.id}
          variant="secondary"
          className={cn(
            "rounded-full",
            label.tone === "tag"
              ? "bg-primary/10 text-primary ring-primary/15"
              : "bg-muted text-muted-foreground ring-border",
          )}
        >
          {label.label}
        </Badge>
      ))}
      {hiddenCount > 0 && (
        <Badge variant="secondary" className="rounded-full">
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
}

export default function ContactsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contacts, setContacts] = useState<ContactDetail[]>([]);
  const [tags, setTags] = useState<ContactLabel[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [sourceTotals, setSourceTotals] = useState<Record<ContactSource, number> | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(() =>
    readSourceFilter(searchParams.get("source")),
  );
  const [tagFilter, setTagFilter] = useState(() =>
    readSingleIdParam(searchParams.get("tagIds")),
  );
  const [groupFilter, setGroupFilter] = useState(() =>
    readSingleIdParam(searchParams.get("groupIds")),
  );
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  const syncFilterUrl = (nextValues: {
    groupFilter?: string;
    sourceFilter?: SourceFilter;
    tagFilter?: string;
  }) => {
    const next = new URLSearchParams(searchParams);
    const nextSource = nextValues.sourceFilter;
    const nextTag = nextValues.tagFilter;
    const nextGroup = nextValues.groupFilter;

    if (nextSource !== undefined) {
      if (nextSource === "ALL") {
        next.delete("source");
      } else {
        next.set("source", nextSource);
      }
    }
    if (nextTag !== undefined) {
      if (nextTag === "ALL") {
        next.delete("tagIds");
      } else {
        next.set("tagIds", nextTag);
      }
    }
    if (nextGroup !== undefined) {
      if (nextGroup === "ALL") {
        next.delete("groupIds");
      } else {
        next.set("groupIds", nextGroup);
      }
    }
    setSearchParams(next, { replace: true });
  };

  const updateSortColumn = (nextSortKey: SortKey) => {
    if (nextSortKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(nextSortKey);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const getHeaderAriaSort = (columnId: string) => {
    const columnSortKey = sortableTableColumns[columnId];
    if (!columnSortKey) {
      return undefined;
    }
    if (columnSortKey !== sortKey) {
      return "none" as const;
    }
    return sortDirection === "asc" ? "ascending" as const : "descending" as const;
  };

  const renderSortableHeader = (columnSortKey: SortKey, label: string) => {
    const isActive = columnSortKey === sortKey;
    const SortIcon = isActive
      ? sortDirection === "asc"
        ? ArrowUp
        : ArrowDown
      : ArrowUpDown;
    const tooltip = getSortTooltipText(columnSortKey, label, isActive, sortDirection);

    return (
      <button
        type="button"
        className={cn(
          "group relative -ml-2 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-2 text-xs font-medium uppercase transition-colors hover:bg-muted hover:text-foreground",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
        onClick={() => updateSortColumn(columnSortKey)}
        aria-label={tooltip}
      >
        {label}
        <SortIcon
          className={cn(
            "h-3.5 w-3.5",
            isActive ? "text-primary" : "text-muted-foreground/50",
          )}
          aria-hidden="true"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-max max-w-56 -translate-x-1/2 rounded-full border border-border bg-popover px-3 py-2 text-xs normal-case text-popover-foreground opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {tooltip}
        </span>
      </button>
    );
  };

  const columns = useMemo<ColumnDef<ContactDetail>[]>(
    () => [
      {
        id: "name",
        accessorKey: "displayName",
        header: () => renderSortableHeader("name", "Name"),
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
        id: "labels",
        header: "Tags & groups",
        cell: ({ row }) => renderContactLabels(row.original),
      },
      {
        accessorKey: "source",
        header: () => renderSortableHeader("source", "Source"),
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
        header: () => renderSortableHeader("updatedAt", "Updated"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatContactDate(row.original.updatedAt)}
          </span>
        ),
      },
    ],
    [sortDirection, sortKey],
  );

  const table = useReactTable({
    data: contacts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });

  const visibleSourceOptions = useMemo(
    () =>
      sourceOptions.filter((option) => {
        if (option.value === "ALL") {
          return true;
        }
        if (sourceTotals === null) {
          return option.value === sourceFilter;
        }
        return sourceTotals[option.value] > 0;
      }),
    [sourceFilter, sourceTotals],
  );

  useEffect(() => {
    setSourceFilter(readSourceFilter(searchParams.get("source")));
    setTagFilter(readSingleIdParam(searchParams.get("tagIds")));
    setGroupFilter(readSingleIdParam(searchParams.get("groupIds")));
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;
    const loadFilterMetadata = async () => {
      try {
        const [tagData, groupData, totalsData] = await Promise.all([
          fetchContactTags(),
          fetchContactGroups(),
          fetchContactSourceTotals(contactSourceValues),
        ]);
        if (isMounted) {
          setTags(tagData);
          setGroups(groupData);
          setSourceTotals(totalsData);
        }
      } catch (err) {
        logUiError("Could not load contact filter metadata", err);
        if (isMounted) {
          setTags([]);
          setGroups([]);
          setSourceTotals(null);
        }
      }
    };

    void loadFilterMetadata();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      sourceTotals !== null &&
      sourceFilter !== "ALL" &&
      sourceTotals[sourceFilter] === 0
    ) {
      updateSourceFilter("ALL");
    }
  }, [sourceFilter, sourceTotals]);

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
            groupFilter,
            page,
            pageSize,
            query: debouncedQuery,
            sortDirection,
            sortKey,
            sourceFilter,
            tagFilter,
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
  }, [
    debouncedQuery,
    groupFilter,
    page,
    pageSize,
    sortDirection,
    sortKey,
    sourceFilter,
    tagFilter,
  ]);

  const currentPage = Math.min(page, totalPages);
  const pageStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, total);

  const updateSourceFilter = (value: SourceFilter) => {
    setSourceFilter(value);
    setPage(1);
    syncFilterUrl({ sourceFilter: value });
  };

  const updateTagFilter = (value: string) => {
    setTagFilter(value);
    setPage(1);
    syncFilterUrl({ tagFilter: value });
  };

  const updateGroupFilter = (value: string) => {
    setGroupFilter(value);
    setPage(1);
    syncFilterUrl({ groupFilter: value });
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
            className={cn(buttonVariants({ variant: "default" }), "cursor-pointer rounded-full")}
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
          <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-[180px_180px_180px_minmax(220px,280px)]">
            <Select
              value={sourceFilter}
              onChange={(event) => updateSourceFilter(event.target.value as SourceFilter)}
              className="cursor-pointer rounded-full"
              aria-label="Filter contacts by source"
            >
              {visibleSourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              value={tagFilter}
              onChange={(event) => updateTagFilter(event.target.value)}
              className="cursor-pointer rounded-full"
              aria-label="Filter contacts by tag"
            >
              <option value="ALL">All tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>
            <Select
              value={groupFilter}
              onChange={(event) => updateGroupFilter(event.target.value)}
              className="cursor-pointer rounded-full"
              aria-label="Filter contacts by group"
            >
              <option value="ALL">All groups</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
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
                <Tags className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="font-semibold">No contacts found</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Import contacts, or adjust your search, tag, and group filters.
              </p>
              <Link
                to="/dashboard/import"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "mt-5 cursor-pointer rounded-full",
                )}
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
                        <TableHead
                          key={header.id}
                          aria-sort={getHeaderAriaSort(header.column.id)}
                        >
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
                    className="w-28 cursor-pointer rounded-full"
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
                    className="cursor-pointer rounded-full disabled:cursor-not-allowed"
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
                    className="cursor-pointer rounded-full disabled:cursor-not-allowed"
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
