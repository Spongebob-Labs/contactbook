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
import type { InboundConnect } from "@/app/api/inbound/connects/route";
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
 * ⚠ **"Messaged you" — the inbound half of this screen, and the loop this file's own header
 * says was lost.**
 *
 * That header records that `/contacts` used to be *"a list of inbound leads, with columns for
 * the card they scanned"*, and that the columns became *number* and *cards sent* because the
 * API had no source for the inbound side. `GET /inbound-messages` is now that source.
 *
 * ⚠ It answers **"this person has written to you"** and deliberately not *"this person scanned
 * card X"*. An inbound row carries no `cardId`, `shareLinkId` or `userId` — see
 * `app/api/inbound/connects/route.ts`. Labelling this column "Scanned" would be inventing a
 * link the data does not contain.
 */
const MESSAGED_FILTER = "MESSAGED_YOU";

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
    if (id === MESSAGED_FILTER) return connects[contact.id] !== undefined;
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

/* ── the table (Name · Number · Cards sent · Added) ───────────────────────────────── */

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
       * ⚠ **"Messaged you", not "Scanned".** See {@link MESSAGED_FILTER}: an inbound row has no
       * card on it, so this column can report that somebody reached out and nothing about why.
       *
       * The em-dash for "never" is the same device the *Cards sent* column uses, with the same
       * screen-reader sentence beside it — a bare "—" announces as nothing at all.
       */
      id: "messaged",
      header: "Messaged you",
      align: "end",
      cell: (contact) => {
        const connect = connects[contact.id];
        if (connect === undefined) {
          return (
            <span data-contact-messaged={contact.id} className="text-ink-3">
              <span aria-hidden="true">—</span>
              <span className="sr-only">Has not messaged you</span>
            </span>
          );
        }
        return (
          <span
            data-contact-messaged={contact.id}
            data-contact-messaged-count={connect.messageCount}
            className="inline-flex items-baseline gap-2"
          >
            <time dateTime={connect.lastReceivedAt} className="text-ink tabular-nums">
              {formatLongDate(connect.lastReceivedAt)}
            </time>
            <span className="sr-only">
              {connect.messageCount === 1
                ? "1 message received, most recently on this date"
                : `${connect.messageCount} messages received, most recently on this date`}
            </span>
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
          value === MESSAGED_FILTER,
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

  useEffect(() => {
    let live = true;
    void fetchInboundConnects().then((result) => {
      if (!live || result === null) return;
      setConnects(
        Object.fromEntries(result.connects.map((connect) => [connect.contactId, connect])),
      );
      setUnknownCount(result.unknownCount);
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
    /* Same rule as above: offered only when it would match something. A "Messaged you 0" chip
       is a control that can only ever return nothing. */
    const messaged = contacts.filter((c) => connects[c.id] !== undefined).length;
    if (messaged > 0) {
      options.push({ id: MESSAGED_FILTER, label: "Messaged you", count: messaged });
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
