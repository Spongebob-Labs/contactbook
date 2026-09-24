"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition, type ReactElement } from "react";

import {
  DataTable,
  EmptyFilteredState,
  EmptyState,
  ErrorPanel,
  FilterBar,
  LoadingSkeleton,
  ScreenStateRoot,
  SearchField,
  resolveDataScreenState,
  type DataTableColumn,
  type FilterOption,
} from "@/components/data";
import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { Input } from "@/components/primitives/input";
import { Skeleton } from "@/components/primitives/skeleton";
import { TextArea } from "@/components/primitives/textarea";
import { useToast } from "@/components/overlay";
import { contacts as api } from "@/lib/api/browser";
import { fetchContactsData } from "@/lib/api/browser-loaders";
import { toScreenError } from "@/lib/api/errors";
import { normaliseE164, parseImportLines } from "@/lib/contacts-parse";
import { formatLongDate, formatPhoneDisplay } from "@/lib/format";
import { useApiResource } from "@/lib/use-api";
import type { InboundConnect, UnlinkedScan } from "@/app/api/inbound/connects/route";
import { fetchInboundConnects } from "@/lib/api/inbound-connects";
import { contactLabel, type Contact, type ContactSource, type FixtureError } from "@/types/domain";

/**
 * `/contacts` — the recipient registry (spec §6.1 R-14, §8D.3, §4.6, plan T24).
 *
 * ## ⚠ This screen was inverted, not ported
 * It used to be "everyone who scanned one of your cards and saved their details back to you" —
 * a list of inbound leads, with columns for the card they scanned and filters over the field
 * categories their snapshot happened to contain.
 *
 * **None of that exists in the API.** A contact is an outbound recipient: a phone number, a name
 * you gave it, a private note, and how it got here. So the columns are now *number* and *cards
 * sent*, the filter is over `ContactSource`, and the screen has two things it never had — **Add
 * contact** and **Import**, because a registry you cannot add to is not a registry.
 *
 * The old empty state told the reader to "share a card and wait for a scan". That was the
 * clearest symptom of the inversion: waiting is not how contacts arrive any more. Importing is.
 *
 * ## ⚠ THE ONE LINE THIS SCREEN IS MOST LIKELY TO GET WRONG
 * `resolveDataScreenState` is passed **`isFiltered`**, and the emptiness it is told about is
 * **this screen's own verdict** — `visible.length === 0`, never `state === 'empty'`.
 *
 * Omit `isFiltered` and the machinery still works, every unit test still passes, and the screen
 * silently downgrades `empty-filtered` to `empty`: a reader who searched for a name that matches
 * nothing is invited to import their address book. That is the exact conflation §8D.1 bans by
 * name and AC-24 decides on, and nothing else in the codebase can catch it.
 *
 * `EmptyFilteredState` has **no create-action prop at the type level**, so the other half of the
 * mistake is uncallable rather than merely discouraged.
 *
 * ## What "search" searches
 * The name and the number — i.e. **what the table shows**. `notes` is deliberately excluded:
 * they are private, they are not on screen, and a search that matches something invisible reads
 * as a bug either way.
 */

/** Seeds the search box. Also the hook the state sweep uses to reach `empty-filtered`. */
const QUERY_PARAM = "q";
/** Repeatable: `?source=IMPORTED&source=MANUAL`. Seeds the chips. */
const SOURCE_PARAM = "source";

/** How a contact arrived, in the owner's words rather than the API's. */
const SOURCE_LABELS: Readonly<Record<ContactSource, string>> = {
  MANUAL: "Added by you",
  IMPORTED: "Imported",
  QR_SCAN: "Scanned your card",
  INBOUND: "Messaged you",
};

const SOURCE_ORDER = Object.keys(SOURCE_LABELS) as readonly ContactSource[];
const KNOWN_SOURCES: ReadonlySet<string> = new Set<string>(SOURCE_ORDER);

/** A pseudo-filter alongside the four sources — it answers a question people actually ask. */
const OPTED_OUT_FILTER = "OPTED_OUT";

/**
 * ⚠ **"Scanned your card" — and note what it does and does not claim.**
 *
 * This file's header records that `/contacts` was once *"a list of inbound leads, with columns
 * for the card they scanned"*, and that the column became *cards sent* because the API had no
 * inbound source. It has one now, and enough of one to say "scanned": an inbound row carries
 * `source: QR_SCAN_CONNECT` and a `resolvedOwnerId` that is the scanned card's owner, so
 * `app/api/inbound/connects/route.ts` can attribute a scan to this caller exactly rather than
 * guess from whether the scanner sits in their registry.
 *
 * ⚠ What is still missing is **which** card. There is no `cardId` or `shareLinkId` on the row —
 * `resolvedOwnerId` names the owner, not the card — so "scanned one of your cards" is true and
 * "scanned your Work card" would be invented. That distinction is the whole reason the column
 * is headed *Scanned your card* rather than naming one.
 */
const SCANNED_FILTER = "SCANNED_YOU";

function matchesQuery(contact: Contact, needle: string): boolean {
  if (needle.length === 0) return true;
  const haystack = `${contact.displayName ?? ""} ${contact.phoneE164}`.toLowerCase();
  return haystack.includes(needle);
}

/** Chips are a union, not an intersection: "imported or opted out", which is what a reader means. */
function matchesFilters(
  contact: Contact,
  selected: readonly string[],
  connects: Readonly<Record<string, InboundConnect>>,
): boolean {
  if (selected.length === 0) return true;
  return selected.some((id) => {
    if (id === OPTED_OUT_FILTER) return contact.optedOutAt !== null;
    /* A count, not the slot's existence: a slot is created for any inbound activity, so
       `!== undefined` would match somebody who only ever messaged. */
    if (id === SCANNED_FILTER) return (connects[contact.id]?.scanCount ?? 0) > 0;
    return contact.source === id;
  });
}

/* ── the data this screen renders ─────────────────────────────────────────────────────── */

export interface ContactsData {
  contacts: Contact[];
  /**
   * How many cards have been sent to each contact, by contact id.
   *
   * A count rather than the links themselves: the table shows a number, and shipping every
   * share link for every row would be a large payload to render one integer. The detail screen
   * gets the full list.
   */
  shareCounts: Record<string, number>;
}

/** `?state=empty` — no contacts at all, which is the genuine first-run state here. */
export function emptyContactsData(): ContactsData {
  return { contacts: [], shareCounts: {} };
}

/* ── the loading family (§8D.1: layout-matched skeletons, never a spinner) ─────────── */

export function ContactsListSkeleton(): ReactElement {
  return (
    <ScreenStateRoot
      state="loading"
      as="section"
      aria-label="Contacts"
      data-contacts-list=""
      className="flex flex-col gap-6"
    >
      <div aria-hidden="true" className="flex flex-wrap items-center gap-6 border-b border-line pb-4">
        <Skeleton className="h-10 w-full rounded-md sm:w-80" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
      <LoadingSkeleton variant="table" count={8} label="Loading your contacts" />
    </ScreenStateRoot>
  );
}

/* ── the table (Name · Number · Cards sent · Source · Added) ──────────────────────── */

/**
 * `DataTable` renders **both** a real `<table>` (≥768px) and a stacked `<ul>` (≤767px) and hides
 * one with `display:none`, because §8D.3 drops *table semantics* on mobile rather than squeezing
 * four columns into 360px — and CSS cannot make a `<table>` stop being a table.
 */
function contactColumns(
  shareCounts: Record<string, number>,
  connects: Readonly<Record<string, InboundConnect>>,
): readonly DataTableColumn<Contact>[] {
  return [
    {
      id: "name",
      header: "Name",
      primary: true,
      cell: (contact) => (
        <span data-contact-name={contact.id} className="flex items-baseline gap-2">
          {contactLabel(contact)}
          {contact.optedOutAt === null ? null : (
            <Badge tone="neutral" data-contact-opted-out-badge={contact.id}>
              Opted out
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: "phone",
      header: "Number",
      cell: (contact) => (
        <span data-contact-phone={contact.id} className="text-ink-3 tabular-nums">
          {formatPhoneDisplay(contact.phoneE164)}
        </span>
      ),
    },
    {
      id: "shares",
      header: "Cards sent",
      align: "end",
      cell: (contact) => {
        const count = shareCounts[contact.id] ?? 0;
        return (
          <span data-contact-shares={contact.id} className="text-ink-3 tabular-nums">
            {count === 0 ? (
              <>
                <span aria-hidden="true">—</span>
                <span className="sr-only">No cards sent yet</span>
              </>
            ) : (
              <>
                {count}
                <span className="sr-only"> {count === 1 ? "card" : "cards"}</span>
              </>
            )}
          </span>
        );
      },
    },
    {
      /**
       * ⚠ **Read from `GET /contacts` itself — every row has an answer.**
       *
       * This used to be two columns, *Scanned your card* and *Messaged you*, both fed only by
       * `/api/inbound/connects`. The inbound log is sparse — a contact whose scan predates it,
       * or who was added by hand, has no row there — so on a real account both columns were a
       * wall of dashes while the contact's own `source` said `QR_SCAN` the whole time.
       *
       * `source` is always present, so the badge is never empty, and it uses the same labels as
       * the filter chips above the table. The inbound scan count is layered on top when it
       * exists — it is a metric, not the column's only evidence. *Messaged you* was removed.
       */
      id: "source",
      header: "Source",
      align: "end",
      cell: (contact) => {
        const scans = connects[contact.id]?.scanCount ?? 0;
        const lastScanAt = connects[contact.id]?.lastScanAt ?? null;
        return (
          <span
            data-contact-source-label={contact.id}
            data-contact-source-value={contact.source}
            // End-aligned in the table column; start-aligned in the ≤767px list, beside its label.
            className="inline-flex flex-col items-start gap-1 md:items-end"
          >
            <Badge tone={contact.source === "QR_SCAN" ? "accent" : "neutral"}>
              {SOURCE_LABELS[contact.source]}
            </Badge>
            {/* Both conditions, not just the count: a count with no date would render an empty
                `<time>`, and the types allow that combination even though the route does not. */}
            {scans > 0 && lastScanAt !== null ? (
              <span
                data-contact-scanned={contact.id}
                data-contact-scanned-count={scans}
                className="text-sm text-ink-3 tabular-nums"
              >
                {scans === 1 ? "Scanned" : `Scanned ${scans}×`} ·{" "}
                <time dateTime={lastScanAt}>{formatLongDate(lastScanAt)}</time>
                <span className="sr-only">
                  {scans === 1
                    ? ", one of your cards, on this date"
                    : `, one of your cards, ${scans} times, most recently on this date`}
                </span>
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      id: "added",
      header: "Added",
      align: "end",
      cell: (contact) => (
        // Absolute, never "3 days ago": a relative date has to be recomputed to be understood
        // and cannot be compared between two rows.
        <time
          data-contact-added={contact.id}
          dateTime={contact.createdAt}
          className="text-ink-3 tabular-nums"
        >
          {formatLongDate(contact.createdAt)}
        </time>
      ),
    },
  ];
}

/* ── adding, and importing ────────────────────────────────────────────────────────────── */

/**
 * Add one contact.
 *
 * `POST /contacts` **upserts** on `(you, phoneE164)`, so re-adding a number that already exists
 * updates its name rather than erroring — which is why this form has no duplicate check and no
 * "already exists" state. The toast says which of the two happened.
 */
function AddContactForm({
  onSubmit,
  onCancel,
  busy,
}: {
  onSubmit: (input: { phone: string; displayName: string; notes: string }) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      data-add-contact-form=""
      className="flex flex-col gap-4 border-b border-line pb-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (phone.trim().length === 0) {
          setError("Enter the number you want to send cards to.");
          return;
        }
        setError(null);
        onSubmit({ phone, displayName, notes });
        setPhone("");
        setDisplayName("");
        setNotes("");
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <Input
          label="Number"
          type="tel"
          inputMode="tel"
          placeholder="+91 98200 00000"
          hint="Include the country code."
          value={phone}
          error={error}
          onChange={(event) => setPhone(event.target.value)}
          fieldClassName="min-w-0 flex-1"
        />
        <Input
          label="Name"
          placeholder="Optional"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          fieldClassName="min-w-0 flex-1"
        />
      </div>

      <TextArea
        label="Private note"
        rows={2}
        hint="Only you ever see this."
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy} loadingLabel="Adding…">
          Add contact
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * Import many at once.
 *
 * `POST /contacts/import` is documented as the expected way contacts actually arrive — one call
 * for a whole address book rather than one `POST /contacts` per person. There is no device
 * address-book API on the web, so the honest input is a paste: one contact per line, number
 * first, optional name after a comma.
 *
 * The response splits `created` from `updated`, and the toast reports both — "18 added, 4
 * updated" rather than claiming 22 new contacts, which is what a single number would imply.
 */
function ImportContactsForm({
  onSubmit,
  onCancel,
  busy,
}: {
  onSubmit: (raw: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      data-import-contacts-form=""
      className="flex flex-col gap-4 border-b border-line pb-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (raw.trim().length === 0) {
          setError("Paste at least one number.");
          return;
        }
        setError(null);
        onSubmit(raw);
      }}
    >
      <TextArea
        label="Numbers to import"
        rows={6}
        placeholder={"+919820000001, Arjun Balasubramanian\n+919820000002, Mei Nakamura\n+919820000003"}
        hint="One per line. Number first, then an optional name after a comma."
        value={raw}
        error={error}
        onChange={(event) => setRaw(event.target.value)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy} loadingLabel="Importing…">
          Import
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ── the screen ───────────────────────────────────────────────────────────────────── */

type Panel = "none" | "add" | "import";

export function ContactsListClient(): ReactElement {
  // `GET /contacts` + `GET /share-links` (plus the identity reads) — all visible in the Network tab.
  const result = useApiResource(fetchContactsData, emptyContactsData);
  return (
    <ContactsListScreen
      key={result.state}
      state={result.state}
      data={result.data}
      error={result.error}
      reload={result.reload}
    />
  );
}

function ContactsListScreen({
  state,
  data,
  error,
  reload,
}: {
  state: string;
  data: ContactsData | null;
  error: FixtureError | null;
  reload: () => void;
}): ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<Panel>("none");

  // Seeded once, then owned locally — so "Clear filters" cannot be undone by a refresh.
  const [query, setQuery] = useState(() => searchParams.get(QUERY_PARAM) ?? "");
  const [selected, setSelected] = useState<readonly string[]>(() =>
    searchParams
      .getAll(SOURCE_PARAM)
      .map((value) => value.toUpperCase())
      .filter(
        (value) =>
          KNOWN_SOURCES.has(value) ||
          value === OPTED_OUT_FILTER ||
          value === SCANNED_FILTER,
      ),
  );

  const contacts = useMemo(() => data?.contacts ?? [], [data]);
  const shareCounts = useMemo(() => data?.shareCounts ?? {}, [data]);

  /**
   * ⚠ A SEPARATE FETCH, AND IT GOES TO OUR OWN ROUTE — NOT TO `/api/cb/*`.
   *
   * `GET /inbound-messages` is not ownership-scoped (the API says so itself), so the browser
   * must never call it: the raw response carries other users' numbers and message bodies.
   * `app/api/inbound/connects/route.ts` joins it against this caller's own contacts on the
   * server and returns only the matches. See that file's header.
   *
   * Its own state, not folded into `fetchContactsData`, because it must degrade on its own: a
   * failure here loses one column, while a failure in the registry loses the screen. Same
   * reasoning as `shareCounts` already follows in the loader.
   */
  const [connects, setConnects] = useState<Readonly<Record<string, InboundConnect>>>({});
  const [unknownCount, setUnknownCount] = useState(0);
  /**
   * ⚠ Scans of this owner's cards by somebody not (yet) in the registry.
   *
   * Kept in its own state and rendered **outside** `{body}`, which matters: `body` is the table
   * or the empty state, so anything inside it disappears the moment the registry is empty — and
   * an empty registry is precisely when an unlinked scan is the only thing there is to show.
   * That combination is what produced a page reporting no activity while a real scan sat in the
   * log. See `app/api/inbound/connects/route.ts`'s `UnlinkedScan`.
   */
  const [unlinkedScans, setUnlinkedScans] = useState<readonly UnlinkedScan[]>([]);

  useEffect(() => {
    let live = true;
    void fetchInboundConnects().then((result) => {
      if (!live || result === null) return;
      setConnects(
        Object.fromEntries(result.connects.map((connect) => [connect.contactId, connect])),
      );
      setUnknownCount(result.unknownCount);
      setUnlinkedScans(result.unlinkedScans);
    });
    return () => {
      live = false;
    };
  }, []);

  const needle = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      contacts.filter((c) => matchesFilters(c, selected, connects) && matchesQuery(c, needle)),
    [connects, contacts, needle, selected],
  );

  const filters = useMemo<readonly FilterOption[]>(() => {
    const counts = new Map<string, number>();
    let optedOut = 0;
    for (const contact of contacts) {
      counts.set(contact.source, (counts.get(contact.source) ?? 0) + 1);
      if (contact.optedOutAt !== null) optedOut += 1;
    }

    const options: FilterOption[] = SOURCE_ORDER.filter((source) => counts.has(source)).map(
      (source) => ({ id: source, label: SOURCE_LABELS[source], count: counts.get(source) }),
    );
    // Only offered when it would match something — a chip that can only ever return nothing is
    // a control that cannot do anything.
    if (optedOut > 0) {
      options.push({ id: OPTED_OUT_FILTER, label: "Opted out", count: optedOut });
    }
    /* Same rule as above: offered only when it would match something. */
    const scanned = contacts.filter((c) => (connects[c.id]?.scanCount ?? 0) > 0).length;
    if (scanned > 0) {
      options.push({ id: SCANNED_FILTER, label: "Scanned your card", count: scanned });
    }
    return options;
  }, [connects, contacts]);

  const clearFilters = useCallback(() => {
    setQuery("");
    setSelected([]);

    const params = new URLSearchParams(searchParams.toString());
    if (!params.has(QUERY_PARAM) && !params.has(SOURCE_PARAM)) return;
    params.delete(QUERY_PARAM);
    params.delete(SOURCE_PARAM);
    const rest = params.toString();
    // `?state=` survives on purpose — it is a contract, not a filter (§6.3).
    router.replace(rest.length > 0 ? `/contacts?${rest}` : "/contacts", { scroll: false });
  }, [router, searchParams]);

  const toggleFilter = useCallback((id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }, []);

  /** Call the API from the browser, then re-read. Both are visible requests. */
  function mutate<T>(run: () => Promise<T>, onOk: (value: T) => void) {
    startTransition(async () => {
      try {
        onOk(await run());
      } catch (thrown) {
        const shown = toScreenError(thrown);
        toast({ title: shown.title, description: shown.detail, tone: "danger" });
      }
      reload();
    });
  }

  const isFiltered = needle.length > 0 || selected.length > 0;

  // ⚠ `isEmpty` is this screen's own verdict, and `isFiltered` is REQUIRED. See the note at the
  // top of the file: without the second line, `empty-filtered` silently becomes `empty`.
  const screenState = resolveDataScreenState({
    state: state as never,
    isEmpty: visible.length === 0,
    isFiltered,
  });

  const showFilters =
    contacts.length > 0 &&
    screenState !== "loading" &&
    screenState !== "error" &&
    screenState !== "offline";

  let body: ReactElement;
  if (screenState === "loading") {
    body = <LoadingSkeleton variant="table" count={8} label="Loading your contacts" />;
  } else if (screenState === "error" || screenState === "offline") {
    body = <ErrorPanel error={error} onRetry={reload} />;
  } else if (screenState === "empty-filtered") {
    body = (
      <EmptyFilteredState
        title="No contacts match"
        query={query.trim()}
        onClearFilters={clearFilters}
      />
    );
  } else if (screenState === "empty") {
    body = (
      <EmptyState
        overline="Nothing here yet"
        title="No contacts yet"
        description="A contact is a number you can send a card to. Import your address book in one go, or add the first one by hand — you decide which card each person gets."
        action={{ label: "Import contacts", onClick: () => setPanel("import") }}
      />
    );
  } else {
    body = (
      <DataTable
        caption="Contacts"
        hideCaption
        columns={contactColumns(shareCounts, connects)}
        rows={visible}
        getRowKey={(contact) => contact.id}
        getRowHref={(contact) => `/contacts/${contact.id}`}
      />
    );
  }

  return (
    <ScreenStateRoot
      state={screenState}
      // `section`, never `main`: `AppShell` owns the single <main id="main"> and a second
      // landmark fails axe's `landmark-unique` (AC-25).
      as="section"
      aria-label="Contacts"
      data-contacts-list=""
      className="flex flex-col gap-6"
    >
      {screenState === "loading" || screenState === "error" || screenState === "offline" ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            data-add-contact-open=""
            onClick={() => setPanel(panel === "add" ? "none" : "add")}
          >
            Add contact
          </Button>
          <Button
            variant="secondary"
            data-import-contacts-open=""
            onClick={() => setPanel(panel === "import" ? "none" : "import")}
          >
            Import
          </Button>
        </div>
      )}

      {panel === "add" ? (
        <AddContactForm
          busy={pending}
          onCancel={() => setPanel("none")}
          onSubmit={(input) =>
            mutate(
              () => {
                const phoneE164 = normaliseE164(input.phone);
                if (phoneE164 === null) {
                  throw new Error("Enter the number with its country code, like +919820000000.");
                }
                const displayName = input.displayName.trim();
                const notes = input.notes.trim();
                return api.upsert({
                  phoneE164,
                  displayName: displayName.length > 0 ? displayName : undefined,
                  notes: notes.length > 0 ? notes : undefined,
                });
              },
              (saved) => {
                // "Saved", not "Added": `POST /contacts` upserts and does not report which
                // happened, and inventing the distinction would be a guess on screen.
                toast({ title: `Saved ${saved.displayName ?? saved.phoneE164}` });
                setPanel("none");
              },
            )
          }
        />
      ) : null}

      {panel === "import" ? (
        <ImportContactsForm
          busy={pending}
          onCancel={() => setPanel("none")}
          onSubmit={(raw) =>
            mutate(
              async () => {
                const { entries, skipped } = parseImportLines(raw);
                if (entries.length === 0) {
                  throw new Error(
                    "None of those lines had a number with a country code, like +919820000000.",
                  );
                }
                const result = await api.import({ contacts: entries });
                return { created: result.created.length, updated: result.updated.length, skipped };
              },
              (outcome) => {
                // Both numbers, because one would misrepresent the other.
                toast({
                  title: `${outcome.created} added, ${outcome.updated} updated`,
                  description:
                    outcome.skipped === 0
                      ? undefined
                      : `${outcome.skipped} ${outcome.skipped === 1 ? "line" : "lines"} had no number and were skipped.`,
                });
                setPanel("none");
              },
            )
          }
        />
      ) : null}

      {showFilters ? (
        <FilterBar
          label="Filter contacts by how they arrived"
          filters={filters}
          selectedIds={selected}
          onToggle={toggleFilter}
          onClear={clearFilters}
        >
          <SearchField
            label="Search contacts"
            placeholder="Search by name or number"
            value={query}
            onValueChange={setQuery}
            resultsLabel={`${visible.length} of ${contacts.length} contacts`}
          />
        </FilterBar>
      ) : null}

      {/*
        ⚠ A COUNT, AND DELIBERATELY NOT THE NUMBERS.

        Somebody messaged the product's WhatsApp number and is not in this registry. Telling the
        owner that is useful; telling them *who* is not ours to tell — an unmatched sender may be
        another user's contact, because `GET /inbound-messages` is a raw unscoped capture. The
        route handler drops the numbers server-side for exactly this reason, so there is nothing
        here to leak even by accident. Do not "improve" this into a list with an Add button.
      */}
      {/*
        ⚠ NUMBERS SHOWN HERE, ON PURPOSE — and this is the one place on this screen where that
        is right. Everything else withholds a sender's number until a contact match proves it
        was already the caller's. An owned scan needs no such proof: `resolvedOwnerId` says this
        person scanned THIS caller's card and verified that number over WhatsApp to do it.

        Rendered ahead of the registry, and outside `{body}`, because when the registry is empty
        this is the only evidence the owner has that anything happened at all.
      */}
      {unlinkedScans.length > 0 ? (
        <section
          data-inbound-unlinked-scans={unlinkedScans.length}
          className="w-full rounded-lg border border-line bg-surface px-5 py-4"
        >
          <h2 className="text-sm font-medium text-ink">
            {unlinkedScans.length === 1
              ? "1 person scanned your card"
              : `${unlinkedScans.length} people scanned your card`}
          </h2>
          <p className="mt-1 text-sm text-ink-3">
            They verified their number to get your card. They are not in your contacts yet.
          </p>
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {unlinkedScans.map((scan) => (
              <li
                key={scan.phoneE164}
                data-unlinked-scan={scan.phoneE164}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
              >
                <span className="text-ink">
                  {/* WhatsApp's own name when it gave one — a number alone is hard to place. */}
                  {scan.profileName ?? formatPhoneDisplay(scan.phoneE164)}
                  {scan.profileName === null ? null : (
                    <span className="ml-2 text-ink-3">{formatPhoneDisplay(scan.phoneE164)}</span>
                  )}
                </span>
                <span className="inline-flex items-baseline gap-2 text-ink-3">
                  <time dateTime={scan.lastScanAt} className="tabular-nums">
                    {formatLongDate(scan.lastScanAt)}
                  </time>
                  {scan.scanCount === 1 ? null : (
                    <span data-unlinked-scan-count={scan.scanCount} className="tabular-nums">
                      ×{scan.scanCount}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {unknownCount > 0 ? (
        <p data-inbound-unknown={unknownCount} className="text-sm text-ink-3">
          {unknownCount === 1
            ? "1 number that isn’t in your contacts has messaged you."
            : `${unknownCount} numbers that aren’t in your contacts have messaged you.`}{" "}
          Add them above to see what they sent and send them a card.
        </p>
      ) : null}

      {body}
    </ScreenStateRoot>
  );
}
