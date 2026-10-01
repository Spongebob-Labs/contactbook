import Link from "next/link";
import type { ReactElement } from "react";
import { UserRound, Users } from "lucide-react";

import { monogram } from "@/components/primitives/avatar";
import { buttonClassName } from "@/components/primitives/button";
import { formatPhoneDisplay } from "@/lib/format";
import { contactLabel, type Contact } from "@/types/domain";

import { SummaryTile, TileCount, TileEmpty } from "./summary-tile";

/**
 * The Contacts tile: how many contacts the owner has and the three added most recently.
 *
 * The empty state is an action, never an explanation. A contact arrives when the owner shares a
 * card with someone, so the action goes to the card they would share from. With no card yet it
 * goes to the builder instead, as a secondary button: the Cards tile beside it already carries
 * "Create your first card" as the primary action, and two identical primaries on one screen
 * compete with each other.
 */

/** How many recent contacts the tile lists. */
export const RECENT_CONTACT_LIMIT = 3;

export interface ContactsTileProps {
  /** `totals.contacts` from `GET /dashboard`. `null` when the API sent no usable count. */
  count: number | null;
  /** Newest first, already capped. Empty when the list could not be read. */
  recent: readonly Contact[];
  /** Where "Share your card" goes: the owner's most recent card, or `null` when they have none. */
  shareCardId: string | null;
  /** Whether the owner has any card. Unknown (`null` count) is treated as yes. */
  hasCards: boolean;
}

/**
 * "12 Sep", with the year only when it is not this one. Fixed to `en-GB` and UTC, matching
 * `formatLongDate`, so a date near midnight does not change day between machines.
 */
const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const SHORT_DATE_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatAddedDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.getUTCFullYear() === now.getUTCFullYear()
    ? SHORT_DATE.format(date)
    : SHORT_DATE_YEAR.format(date);
}

export function ContactsTile({
  count,
  recent,
  shareCardId,
  hasCards,
}: ContactsTileProps): ReactElement {
  const empty = count === 0;

  const emptyAction = !hasCards
    ? { label: "Create a card to share", href: "/cards/new", variant: "secondary" as const }
    : {
        label: "Share your card",
        href: shareCardId === null ? "/cards" : `/cards/${shareCardId}`,
        variant: "primary" as const,
      };

  return (
    <SummaryTile
      region="contacts"
      title="Contacts"
      link={
        empty ? undefined : { label: "View all", href: "/contacts", ariaLabel: "View all contacts" }
      }
      footer={
        empty ? (
          <Link
            href={emptyAction.href}
            data-contacts-tile-action=""
            className={buttonClassName({ variant: emptyAction.variant, className: "self-start" })}
          >
            {emptyAction.label}
          </Link>
        ) : undefined
      }
    >
      {empty ? (
        <TileEmpty icon={Users} label="No contacts yet" handle="data-contacts-tile-empty" />
      ) : (
        <>
          <TileCount value={count} label={count === 1 ? "contact" : "contacts"} />

          {recent.length === 0 ? null : (
            <ul data-contacts-tile-recent="" className="-mx-2 flex flex-col">
              {recent.slice(0, RECENT_CONTACT_LIMIT).map((contact) => (
                <RecentContactRow key={contact.id} contact={contact} />
              ))}
            </ul>
          )}
        </>
      )}
    </SummaryTile>
  );
}

function RecentContactRow({ contact }: { contact: Contact }): ReactElement {
  const label = contactLabel(contact);
  const named = contact.displayName !== null && contact.displayName.trim().length > 0;
  const added = formatAddedDate(contact.createdAt);

  return (
    <li data-contacts-tile-row={contact.id}>
      <Link
        href={`/contacts/${contact.id}`}
        className="flex min-h-11 min-w-0 items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-[var(--dur-fast)] hover:bg-surface-sunk"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunk text-xs text-ink-3"
        >
          {named ? (
            monogram(contact.displayName ?? "")
          ) : (
            <UserRound size={15} strokeWidth={1.75} />
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span title={label} className="truncate text-sm text-ink">
            {label}
          </span>
          {/* Only when the heading is a name: an unnamed contact's heading already is the number. */}
          {named ? (
            <span className="truncate text-xs tabular-nums text-ink-3">
              {formatPhoneDisplay(contact.phoneE164)}
            </span>
          ) : null}
        </span>

        {added === "" ? null : (
          <time
            dateTime={contact.createdAt}
            className="shrink-0 text-xs tabular-nums text-ink-3"
          >
            {added}
          </time>
        )}
      </Link>
    </li>
  );
}
