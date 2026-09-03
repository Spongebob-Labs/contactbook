import type { ReactElement, ReactNode } from "react";

import { renderFieldRow, type FieldIconSize, type FieldRow } from "@/card/field-renderers";
import { cn } from "@/lib/cn";
import type { FieldCategory, ResolvedField } from "@/types/domain";

/**
 * `FieldList` — the read-only field list outside a card: `/cards/[cardId]` and the public card's
 * detail block (spec §8D.3, §8D.5).
 *
 * ⚠ It used to serve `/contacts/[contactId]` too, through a `savedContactFields` adapter that
 * turned a saved lead's denormalised snapshot into `ResolvedField`s. Both are gone: the API's
 * contact is an outbound recipient with no fields at all, so there is no snapshot to adapt and
 * no second grouping table to keep in step with the real one.
 *
 * `<CardFieldRow>` is the same content inside the 400x860 canvas, under a template's art
 * direction. This is the same content on `--canvas`, in the product's own type, grouped by
 * `FieldCategory`. Both read T12's registry and neither re-implements a display rule.
 *
 * ## Four things this component must not drop
 * Every one of them is a real defect that lands *here*, at the consumer, and nowhere else:
 *
 * 1. **`row.context`** carries E-23's bare hostname, the bank's name, the wallet provider and
 *    the crypto network. Omit it and an unrecognised social link renders as a naked handle
 *    with no clue where it points.
 * 2. **`row.external`** means the destination leaves the app, so the anchor takes
 *    `rel="noopener noreferrer"` (AC-32). It is a per-row fact, never guessed per type.
 * 3. **`row.masked`** has already had its destination and its raw `title` stripped by T12
 *    (§7.3). Rendering the underlying value, a `title` that carries it, or **any** reveal
 *    affordance defeats AC-33 — and only the consumer can defeat it. Reveal exists in
 *    `/profile` and nowhere else, because `/c/[slug]` is unauthenticated by design.
 * 4. **The order.** `resolveCard` applied §6.4's ordering rule and `buildVcf` reads the same
 *    array. Rows are grouped by category and never re-sorted within a group; a second sort
 *    is how the rendered card and the downloaded file start disagreeing again.
 *
 * `renderFieldRow` returns `null` for `PHOTO` — the avatar slot owns it — and for a blank
 * value (E-07). Those fields contribute no row rather than an empty one.
 */

/** The seven §5.1 categories in the owner's language, keyed so a new one cannot be missed. */
export const FIELD_CATEGORY_LABELS: Record<FieldCategory, string> = {
  IDENTITY: "Identity",
  PERSONAL: "Personal",
  WORK: "Work",
  BUSINESS: "Business",
  SOCIAL: "Social",
  FINANCIAL: "Financial",
  CUSTOM: "Custom",
};

/**
 * Declaration order **is** group order (§6.4) — the same table `resolveCard` sorts by, which
 * is why a resolved card's rows are already in this order and grouping never moves a row.
 */
const CATEGORY_RANK: Record<FieldCategory, number> = {
  IDENTITY: 0,
  PERSONAL: 1,
  WORK: 2,
  BUSINESS: 3,
  SOCIAL: 4,
  FINANCIAL: 5,
  CUSTOM: 6,
};

/* ── rendering ──────────────────────────────────────────────────────────────────────── */

interface Entry {
  field: ResolvedField;
  row: FieldRow;
}

interface Group {
  category: FieldCategory;
  entries: Entry[];
}

/**
 * Group without sorting.
 *
 * Rows keep the order they arrived in; only the *groups* are placed, and by the same table
 * `resolveCard` already sorted on — so for a resolved card this is the identity, and for a
 * hand-built list it is the §6.4 order the `.vcf` would use.
 */
function groupRows(fields: readonly ResolvedField[], iconSize: FieldIconSize): Group[] {
  const byCategory = new Map<FieldCategory, Entry[]>();

  for (const field of fields) {
    const row = renderFieldRow(field, { iconSize });
    // `null` is PHOTO (the avatar owns it) or a blank value (E-07). Not a row.
    if (row === null) continue;

    const bucket = byCategory.get(field.category);
    if (bucket === undefined) byCategory.set(field.category, [{ field, row }]);
    else bucket.push({ field, row });
  }

  return [...byCategory.entries()]
    .map(([category, entries]) => ({ category, entries }))
    .sort((a, b) => CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category]);
}

/** §8.8: 16 pairs with `--text-base`, which is the size a field value is set at here. */
const DEFAULT_ICON_SIZE: FieldIconSize = 16;

function rowLines(row: FieldRow): ReactNode {
  return row.lines.map((line, index) => (
    <span key={`${line}-${index}`} className="block">
      {line}
    </span>
  ));
}

/**
 * §6.6's `LOCATION_TRACKING` row: a status chip, never a coordinate. T12 already scrubbed a
 * coordinate-shaped value down to a status string, and this is what a status looks like — a
 * `--radius-full` pill (§8.6) rather than a line of body copy claiming to be a place.
 *
 * Written from tokens rather than composed from `chipClassName` on purpose: that helper
 * lives in a client module, and importing it would make this whole list a client component.
 * `/c/[slug]` renders server-side (Q3), so the cost of that is real and the saving is one
 * class string.
 */
const STATUS_CHIP =
  "inline-flex h-6 w-fit items-center rounded-full border border-line bg-surface-sunk px-3 text-xs text-ink";

/**
 * The value cell.
 *
 * `title` is the untruncated text behind a CSS clamp (E-11, E-12) — and it is withheld from
 * a masked row on purpose. T12 already sets a masked row's `title` to the masked string, so
 * this is belt and braces; a `title` is readable on hover and survives a copy, so a masked
 * row that carried one would be masked in appearance only.
 */
function rowValue(row: FieldRow): ReactElement {
  if (row.variant === "status") {
    return (
      <span data-field-value="" data-field-status="" className={STATUS_CHIP}>
        {row.display}
      </span>
    );
  }

  if (row.masked || row.href === null) {
    return (
      <span
        data-field-value=""
        className="text-base text-ink"
        {...(row.masked ? {} : { title: row.title })}
      >
        {rowLines(row)}
      </span>
    );
  }

  return (
    <a
      href={row.href}
      title={row.title}
      data-field-value=""
      /* ⚠ 44px of target on touch. This anchor is a real `tel:` / `mailto:` / `https:` link —
         the one on `/cards/{id}` that a reader taps to call or write — and at `--text-base` it
         is a 24px line box. `py-2.5 -my-2.5` grows the hit region and takes the same 10px back
         out of the flow, so the field list keeps its exact rhythm. `inline-block` is required:
         vertical padding on an inline box paints but does not affect the hit area's layout. */
      className={cn(
        "text-base text-ink underline-offset-4 hover:underline",
        "max-md:-my-2.5 max-md:inline-block max-md:py-2.5",
      )}
      {...(row.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {rowLines(row)}
    </a>
  );
}

export interface FieldListProps {
  /** In `resolveCard`'s order (§6.4), or a hand-built list in the order it should read. */
  fields: readonly ResolvedField[];
  /** `false` on a surface with a single group, or where the screen supplies its own header. */
  showHeadings?: boolean;
  /** Match the surrounding outline — the axe sweep checks heading order (AC-25). */
  headingLevel?: 2 | 3 | 4;
  iconSize?: FieldIconSize;
  className?: string;
}

export function FieldList({
  fields,
  showHeadings = true,
  headingLevel = 3,
  iconSize = DEFAULT_ICON_SIZE,
  className,
}: FieldListProps) {
  const groups = groupRows(fields, iconSize);
  // Nothing to say. The screen owns the empty copy — it is the only one that knows whether
  // this is a card that shares nothing (E-02) or a contact saved with no detail.
  if (groups.length === 0) return null;

  const Heading = headingLevel === 2 ? "h2" : headingLevel === 4 ? "h4" : "h3";

  return (
    <div data-field-list="" className={cn("flex flex-col gap-6", className)}>
      {groups.map((group) => (
        <div key={group.category} data-field-group={group.category} className="flex flex-col gap-2">
          {showHeadings ? (
            <Heading className="text-overline uppercase text-ink-3">
              {FIELD_CATEGORY_LABELS[group.category]}
            </Heading>
          ) : null}

          <ul className="flex flex-col">
            {group.entries.map(({ field, row }) => (
              <li
                key={field.id}
                data-field-row={field.id}
                data-field-type={field.type}
                {...(row.masked ? { "data-field-masked": "" } : {})}
                className="flex items-start gap-3 border-b border-line py-3 last:border-b-0"
              >
                <span
                  data-field-icon=""
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-ink-3"
                >
                  {row.icon}
                </span>

                <span className="flex min-w-0 flex-col gap-1">
                  <span data-field-label="" className="text-xs text-ink-3">
                    {row.label}
                  </span>
                  {rowValue(row)}
                  {row.context === null ? null : (
                    <span data-field-context="" className="text-xs text-ink-3">
                      {row.context}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
