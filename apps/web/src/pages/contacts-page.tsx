import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Row,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDownUp,
  Building2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  ListFilter,
  Mail,
  MapPin,
  Phone,
  Search,
  Table2,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockContacts } from "@/lib/mock-contacts";
import type { ContactDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

type ViewMode = "table" | "cards";

const allOption: ComboboxOption = { label: "All", value: "all" };

function getContactName(contact: ContactDetail) {
  if (contact.displayName?.trim()) {
    return contact.displayName.trim();
  }
  return [contact.firstName, contact.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ") || "Unnamed contact";
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
  return getPrimaryOrganization(contact)?.companyName ?? "No company";
}

function getTitle(contact: ContactDetail) {
  return getPrimaryOrganization(contact)?.title ?? "No title";
}

function getCountry(contact: ContactDetail) {
  return getPrimaryAddress(contact)?.country ?? "No country";
}

function getLocation(contact: ContactDetail) {
  const address = getPrimaryAddress(contact);
  if (!address) {
    return "No location";
  }
  return [address.city, address.region, address.country].filter(Boolean).join(", ");
}

function getPrimaryContact(contact: ContactDetail) {
  return contact.primaryEmail?.value ?? contact.primaryPhone?.value ?? "No email or phone";
}

function getSearchText(contact: ContactDetail) {
  return [
    getContactName(contact),
    contact.primaryEmail?.value,
    contact.primaryPhone?.value,
    getCompany(contact),
    getTitle(contact),
    getCountry(contact),
    contact.source,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getUniqueOptions(values: string[]) {
  return [
    allOption,
    ...Array.from(new Set(values))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ label: value, value })),
  ];
}

function selectFilter(row: Row<ContactDetail>, columnId: string, filterValue: unknown) {
  if (!filterValue || filterValue === "all") {
    return true;
  }
  return row.getValue(columnId) === filterValue;
}

function ContactIdentity({ contact }: { contact: ContactDetail }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
        <UserRound className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium">{getContactName(contact)}</p>
        <p className="truncate text-sm text-muted-foreground">{getTitle(contact)}</p>
      </div>
    </div>
  );
}

function ContactCard({ contact }: { contact: ContactDetail }) {
  const email = contact.primaryEmail?.value;
  const phone = contact.primaryPhone?.value;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <ContactIdentity contact={contact} />
          <Badge variant="secondary" className="shrink-0">
            {contact.source.toLowerCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{getCompany(contact)}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{email ?? "No email"}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{phone ?? "No phone"}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{getLocation(contact)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-muted-foreground">Updated</span>
          <span className="font-medium">{formatDate(contact.updatedAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ContactsPage() {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const columns = useMemo<ColumnDef<ContactDetail>[]>(
    () => [
      {
        id: "name",
        accessorFn: getContactName,
        header: "Name",
        cell: ({ row }) => <ContactIdentity contact={row.original} />,
      },
      {
        id: "company",
        accessorFn: getCompany,
        header: "Company",
        filterFn: selectFilter,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{getCompany(row.original)}</p>
            <p className="truncate text-sm text-muted-foreground">
              {getTitle(row.original)}
            </p>
          </div>
        ),
      },
      {
        id: "contact",
        accessorFn: getPrimaryContact,
        header: "Contact",
        cell: ({ row }) => (
          <p className="max-w-64 truncate text-sm text-muted-foreground">
            {getPrimaryContact(row.original)}
          </p>
        ),
      },
      {
        id: "source",
        accessorKey: "source",
        header: "Source",
        filterFn: selectFilter,
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.source.toLowerCase()}</Badge>
        ),
      },
      {
        id: "country",
        accessorFn: getCountry,
        header: "Country",
        filterFn: selectFilter,
        cell: ({ row }) => (
          <p className="max-w-48 truncate text-sm text-muted-foreground">
            {getLocation(row.original)}
          </p>
        ),
      },
      {
        id: "updatedAt",
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.updatedAt)}
          </span>
        ),
      },
    ],
    [],
  );

  const sourceOptions = useMemo(
    () => getUniqueOptions(mockContacts.map((contact) => contact.source)),
    [],
  );
  const companyOptions = useMemo(
    () => getUniqueOptions(mockContacts.map((contact) => getCompany(contact))),
    [],
  );
  const countryOptions = useMemo(
    () => getUniqueOptions(mockContacts.map((contact) => getCountry(contact))),
    [],
  );

  const table = useReactTable({
    data: mockContacts,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 6,
      },
    },
    globalFilterFn: (row, _columnId, filterValue) =>
      getSearchText(row.original).includes(String(filterValue).toLowerCase()),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;
  const totalFiltered = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(table.getPageCount(), 1);

  const getFilterValue = (columnId: string) =>
    String(table.getColumn(columnId)?.getFilterValue() ?? "all");

  const setFilterValue = (columnId: string, value: string) => {
    table.getColumn(columnId)?.setFilterValue(value === "all" ? undefined : value);
    table.setPageIndex(0);
  };

  const clearFilters = () => {
    setGlobalFilter("");
    setColumnFilters([]);
    table.setPageIndex(0);
  };

  return (
    <AppShell>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-border bg-card p-6 md:p-8">
          <Badge variant="secondary">Contacts</Badge>
          <div className="mt-5 max-w-3xl space-y-4">
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
              Browse every contact in one clean directory.
            </h1>
            <p className="text-base text-muted-foreground">
              Review imported and manually created contacts with quick filters,
              sortable columns, and a card layout for compact screens.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Directory snapshot</CardTitle>
            <CardDescription>Mock data matching the contacts API shape</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm text-muted-foreground">Contacts</span>
              <span className="text-lg font-semibold">{mockContacts.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm text-muted-foreground">Visible</span>
              <span className="text-lg font-semibold">{totalFiltered}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>All contacts</CardTitle>
                <CardDescription>Filter, sort, and page through contact records.</CardDescription>
              </div>
              <div className="hidden rounded-md border border-border p-1 md:flex">
                <Button
                  type="button"
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                >
                  <Table2 className="h-4 w-4" aria-hidden="true" />
                  Table
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "cards" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("cards")}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  Cards
                </Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_220px_180px_auto] lg:items-end">
              <div className="relative">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Search</p>
                <Search className="pointer-events-none absolute left-3 top-9 h-4 w-4 text-muted-foreground" />
                <Input
                  value={globalFilter}
                  onChange={(event) => {
                    setGlobalFilter(event.target.value);
                    table.setPageIndex(0);
                  }}
                  placeholder="Name, company, email, phone"
                  className="pl-9"
                />
              </div>
              <Combobox
                label="Source"
                value={getFilterValue("source")}
                options={sourceOptions}
                onValueChange={(value) => setFilterValue("source", value)}
              />
              <Combobox
                label="Company"
                value={getFilterValue("company")}
                options={companyOptions}
                onValueChange={(value) => setFilterValue("company", value)}
              />
              <Combobox
                label="Country"
                value={getFilterValue("country")}
                options={countryOptions}
                onValueChange={(value) => setFilterValue("country", value)}
              />
              <Button type="button" variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4" aria-hidden="true" />
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 text-center">
              <ListFilter className="mb-3 h-8 w-8 text-primary" aria-hidden="true" />
              <h3 className="font-semibold">No contacts match</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Adjust search or filters to bring contacts back into view.
              </p>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  "hidden overflow-hidden rounded-lg border border-border md:block",
                  viewMode === "cards" && "md:hidden",
                )}
              >
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id} className="bg-muted hover:bg-muted">
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder ? null : (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1"
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                                <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div
                className={cn(
                  "grid gap-3 md:hidden",
                  viewMode === "cards" && "md:grid md:grid-cols-2 xl:grid-cols-3",
                )}
              >
                {rows.map((row) => (
                  <ContactCard key={row.id} contact={row.original} />
                ))}
              </div>
            </>
          )}

          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of {pageCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
