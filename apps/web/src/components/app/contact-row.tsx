import Link from "next/link";

import { Badge } from "@/components/primitives/badge";
import { cn } from "@/lib/cn";
import { formatLongDate, formatPhoneDisplay } from "@/lib/format";
import { contactLabel, type Contact } from "@/types/domain";

/**
 * `ContactRow` — one recipient, as name · number · added (spec §8D.3).
 *
 * ## ⚠ Rewritten with the contact model
 * It used to render **name · source card · saved date**, because a contact was a saved lead and
 * the interesting fact about them was which card they had scanned. A contact is now an outbound
 * recipient: the interesting facts are the number you would send to and whether they have asked
 * you to stop. `<SourceCardLink>` is gone from here for the same reason — there is no source
 * card, and a contact's relationship to your cards is now *which ones you sent them*, which is a
 * share-link join and belongs on the detail screen rather than in a one-line row.
 *
 * The dashboard's "Recent contacts" list is the caller this exists for. `/contacts` renders the
 * same columns through `<DataTable>`, which owns the table-to-list switch that makes that screen
 * desktop-first (Q16); this is the single-row form, and it does the same collapse in miniature: a
 * row above 768px, a stack below it.
 *
 * Dates are absolute, never "3 days ago": a relative date has to be recomputed to be understood
 * and cannot be compared between two rows.
 */

export interface ContactRowProps {
  contact: Contact;
  /** The contact detail route. Omit to render the name as text. */
  href?: string;
  /** `li` inside the list a screen renders; `div` when the caller supplies its own grouping. */
  as?: "li" | "div";
  className?: string;
}

export function ContactRow({ contact, href, as = "li", className }: ContactRowProps) {
  const Row = as;
  // Falls back to the number, because an imported contact routinely has no name and a blank
  // cell where a name should be reads as a broken row.
  const label = contactLabel(contact);
  const named = contact.displayName !== null && contact.displayName.trim().length > 0;

  return (
    <Row
      data-contact-row={contact.id}
      data-contact-opted-out={contact.optedOutAt === null ? undefined : ""}
      className={cn(
        "flex flex-col gap-1 border-b border-line py-4 last:border-b-0",
        "md:flex-row md:items-baseline md:justify-between md:gap-6",
        className,
      )}
    >
      <p className="flex min-w-0 items-baseline gap-2 text-base text-ink">
        {href ? (
          <Link href={href} className="min-w-0 truncate text-ink underline-offset-4 hover:underline">
            {label}
          </Link>
        ) : (
          <span className="min-w-0 truncate">{label}</span>
        )}

        {/* The one status worth carrying into a one-line row: it changes what you may do next. */}
        {contact.optedOutAt === null ? null : (
          <Badge tone="neutral" data-contact-opted-out-badge={contact.id}>
            Opted out
          </Badge>
        )}
      </p>

      <span className="flex flex-col gap-1 md:flex-row md:items-baseline md:gap-6">
        {/* Suppressed when the label *is* the number — repeating it twice in one row is noise. */}
        {named ? (
          <span data-contact-phone={contact.id} className="text-xs text-ink-3 tabular-nums">
            {formatPhoneDisplay(contact.phoneE164)}
          </span>
        ) : null}
        <time dateTime={contact.createdAt} className="text-xs text-ink-3">
          {formatLongDate(contact.createdAt)}
        </time>
      </span>
    </Row>
  );
}
