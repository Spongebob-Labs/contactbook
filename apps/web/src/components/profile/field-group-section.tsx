"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useId, type ReactNode } from "react";

import { EmptyState } from "@/components/data";
import { Badge } from "@/components/primitives/badge";
import { buttonClassName } from "@/components/primitives/button";
import { cn } from "@/lib/cn";
import type { FieldGroup } from "@/types/domain";

/**
 * One collapsible `FieldGroup` on `/profile` — spec §8D.3, §11 E-08.
 *
 * ## E-08 is the contract this component exists to keep
 * `?state=empty` hands the screen **seven groups with `fieldIds: []`**, not zero groups
 * (`EMPTY_FIXTURE_DB`, §6.3). "A profile has zero fields in every group" is a profile that
 * still has its seven groups, so the screen renders all seven and each one says
 * *"No fields in {group} yet"* with an **Add field** action right there. Rendering nothing
 * would be a different, wrong screen — and the owner would have no way to start.
 *
 * The empty copy is T10's `EmptyState`, not a local one. §8D.1 splits first-run emptiness
 * from filtered-to-nothing emptiness and the two are different components on purpose;
 * writing a third here would be the fork that makes the vocabulary stop being one
 * vocabulary. `/profile` has no filter and no search (§8D.3 lists the filtered-empty cell
 * for this screen as **n/a**), so `EmptyFilteredState` correctly never appears.
 *
 * ## Disclosure, not `<details>`
 * `<details>` cannot take a default that differs by viewport, and §8D.3 wants these
 * expanded on desktop and collapsed on mobile. A `button[aria-expanded]` driving a
 * `hidden` panel can — and its `aria-expanded` stays *true* at both widths, which a
 * CSS-only fake (`hidden md:block`) could never manage. That attribute is the whole
 * accessible contract of a disclosure, so it is the one thing not worth faking.
 *
 * `FieldGroup`s are a fixed set seeded from `FieldCategory` and are **renameable but never
 * deletable** (§5.5) — there is deliberately no delete control here or in the group editor.
 */

export interface FieldGroupSectionProps {
  group: FieldGroup;
  /** How many `ProfileField`s the group currently holds, after local edits. */
  fieldCount: number;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** The `AddFieldDialog` for this group. Rendered in the panel and in the empty state. */
  addSlot: ReactNode;
  /**
   * `/profile/groups/[groupId]` — the focused editor (§8D.3). Omit for a section that has no group upstream.
   *
   * `map.ts` invents a section to hold ungrouped `PERSONAL` / `IDENTITY` / `CUSTOM` fields, and
   * those have no id the API would recognise — reorder, rename and delete all address a real
   * group. Linking to an editor for one would 404.
   */
  editorHref?: string;
  /** The `<ul>` of rows. Omitted entirely when the group is empty. */
  children?: ReactNode;
}

export function FieldGroupSection({
  group,
  fieldCount,
  open,
  onOpenChange,
  addSlot,
  editorHref,
  children,
}: FieldGroupSectionProps) {
  const panelId = `${useId()}-group-panel`;
  const empty = fieldCount === 0;

  return (
    <section
      data-field-group-section={group.id}
      data-group-category={group.category}
      data-group-open={open ? "true" : "false"}
      /* The vertical rhythm moves ONTO the toggle below `lg` — see its own note. `py-3` here
         plus `py-3` inside the button is the same 24px of separation the `py-6` gave, except
         that half of it is now tappable instead of being dead space around a 26px strip. */
      className="border-b border-line py-3 last:border-b-0 lg:py-6"
    >
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          data-group-toggle={group.id}
          onClick={() => onOpenChange(!open)}
          /* ⚠ **44px on touch, and this is the single most important target on `/profile`.**
             Groups default to COLLAPSED below 768px (`profile-client.tsx` keys that off a
             `(max-width: 767px)` query), so this toggle is the only route to any profile field
             on a phone — and it was a 26px strip. The `py-6` that gave it breathing room was on
             the parent `<section>`, i.e. *outside* the button, so none of it was tappable.
             Moving the padding inside makes the same pixels the target. */
          className={cn(
            "flex w-full items-center gap-3 text-left",
            "min-h-11 py-3 lg:min-h-0 lg:py-0",
          )}
        >
          <ChevronDown
            aria-hidden="true"
            size={20}
            strokeWidth={1.5}
            className={cn(
              "shrink-0 text-ink-3 transition-transform duration-[var(--dur-fast)] ease-out",
              open ? "rotate-0" : "-rotate-90",
            )}
          />
          <span className="min-w-0 flex-1 text-lg text-ink">{group.name}</span>
          <Badge tone={empty ? "neutral" : "accent"} data-group-count={group.id}>
            {fieldCount}
            <span className="sr-only"> {fieldCount === 1 ? "field" : "fields"}</span>
          </Badge>
        </button>
      </h2>

      {/* `hidden` rather than unmounting: the rows keep their edit state across a collapse,
          and a screen reader's "collapsed" is honest because the content really is out of
          the accessibility tree. */}
      <div id={panelId} hidden={!open} className="pt-4">
        {empty ? (
          // The attribute lives on a wrapper because `EmptyState` takes a closed prop set
          // and spreads nothing — T10 owns that file and this track does not edit it.
          <div data-group-empty={group.id}>
            <EmptyState
              headingLevel={3}
              overline="Nothing here yet"
              title={`No fields in ${group.name} yet`}
              description="Add one and it becomes available to tick in every card you build — a card is a filter over these fields, not a copy of them."
            >
              <div className="mt-3 flex flex-wrap items-center gap-3">{addSlot}</div>
            </EmptyState>
          </div>
        ) : (
          <>
            {children}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {addSlot}
              {editorHref === undefined ? null : (
                <Link
                  href={editorHref}
                  data-group-editor-link={group.id}
                  className={buttonClassName({ variant: "text-link" })}
                >
                  Reorder or delete fields
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
