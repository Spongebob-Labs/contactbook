"use client";

import Link from "next/link";
import { ChevronDown, Plus, X } from "lucide-react";
import { useId, useState, type FormEvent, type ReactElement } from "react";

import type { FieldOffer } from "@/components/builder/field-catalogue";
import { childBirthdayLabel, type ChildEntry } from "@/components/builder/field-suggestions";
import { BUILDER_SCROLL_CLEAR } from "@/components/builder/scroll-clear";
import { LogoPicker } from "@/components/builder/logo-picker";
import { Button, TOUCH_HIT_44_Y } from "@/components/primitives";
import { buttonClassName } from "@/components/primitives/button";
import { needsOwnName } from "@/components/profile/field-types";
import { cn } from "@/lib/cn";
import type { ApiFieldCategory } from "@/lib/api/schema";
import type { FieldCategory, FieldType, ProfileField } from "@/types/domain";

import { WorkspaceFieldRow, type RowCardToggle } from "./workspace-field-row";
import type { FamilyEntry, WorkspaceSectionModel } from "./workspace-model";

/**
 * One collapsible category of the workspace — Personal, Work, Socials, Business, Payment, Other.
 *
 * Its list, top to bottom: the fields the owner has filled in, the suggestions nobody has
 * answered yet (blank rows), the section's special rows (children under Personal, the company
 * logo under Work), anything picked from "Add field", and then "Add field" itself.
 */

export interface NewFieldInput {
  category: ApiFieldCategory;
  type: FieldType;
  label: string;
  value: string;
}

export interface LogoRowProps {
  cardName: string;
  logoUrl: string | null;
  busy: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}

export interface WorkspaceSectionProps {
  model: WorkspaceSectionModel;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  categoryOf: (field: ProfileField) => FieldCategory;
  revealed: ReadonlySet<string>;
  onToggleReveal: (fieldId: string) => void;
  /** The selected card's switch for this field, or `null` when there is nothing to switch. */
  cardToggle: (field: ProfileField) => RowCardToggle | null;
  onEdit: (field: ProfileField, patch: { label: string; value: string }) => void;
  onCreate: (input: NewFieldInput) => void;
  onAddChild: (name: string, birthday: string) => void;
  /** Renames a child and keeps their birthday's label in step. */
  onRenameChild: (child: ChildEntry, name: string) => void;
  /** Renames a family member: the FAMILY group's tag and its RELATION field follow. */
  onRenameFamily: (entry: FamilyEntry, name: string) => void;
  /** Work only, and only when there is a card for the logo to go on. */
  logo?: LogoRowProps | null;
}

/** Per-row overrides a special block needs — a child's name row keeps its label fixed. */
interface RowExtra {
  onSave?: (patch: { label: string; value: string }) => void;
  labelEditable?: boolean;
}

interface DraftRow {
  key: number;
  offer: FieldOffer;
}

export function WorkspaceSection({
  model,
  open,
  onOpenChange,
  categoryOf,
  revealed,
  onToggleReveal,
  cardToggle,
  onEdit,
  onCreate,
  onAddChild,
  onRenameChild,
  onRenameFamily,
  logo,
}: WorkspaceSectionProps): ReactElement {
  const { section } = model;
  const panelId = `${useId()}-panel`;
  const [choosing, setChoosing] = useState(false);
  const [drafts, setDrafts] = useState<readonly DraftRow[]>([]);
  const [nextKey, setNextKey] = useState(1);

  const hasToggles =
    model.fields.length > 0 || model.children.length > 0 || model.families.length > 0;

  function pick(offer: FieldOffer) {
    setDrafts((current) => [...current, { key: nextKey, offer }]);
    setNextKey((key) => key + 1);
    setChoosing(false);
  }

  function dropDraft(key: number) {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
  }

  const row = (field: ProfileField, extra?: RowExtra) => (
    <WorkspaceFieldRow
      key={field.id}
      field={field}
      category={categoryOf(field)}
      label={field.label}
      type={field.type}
      labelEditable={extra?.labelEditable ?? true}
      revealed={revealed.has(field.id)}
      onToggleReveal={() => onToggleReveal(field.id)}
      onSave={extra?.onSave ?? ((patch) => onEdit(field, patch))}
      toggle={cardToggle(field)}
    />
  );

  return (
    <section
      data-workspace-section={section.id}
      data-section-open={open ? "true" : "false"}
      className="border-t border-line"
    >
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          data-section-toggle={section.id}
          onClick={() => onOpenChange(!open)}
          className={cn(
            "flex min-h-14 w-full items-center gap-2 px-3 text-left sm:px-4",
            BUILDER_SCROLL_CLEAR,
          )}
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-5 shrink-0 text-ink-3 transition-transform duration-[var(--dur-fast)] ease-out",
              open ? "rotate-0" : "-rotate-90",
            )}
          />
          <span className="min-w-0 flex-1 text-base font-medium text-ink">{section.label}</span>
          {open && hasToggles ? (
            <span aria-hidden="true" className="text-overline uppercase text-ink-3">
              On card
            </span>
          ) : null}
        </button>
      </h2>

      <div id={panelId} hidden={!open} className="pb-2">
        <ul data-section-rows={section.id} className="flex flex-col">
          {model.fields.map((field) => row(field))}

          {model.suggestions.map((suggestion) => (
            <WorkspaceFieldRow
              key={`suggestion-${suggestion.id}`}
              suggestionId={suggestion.id}
              field={null}
              category={suggestion.category}
              label={suggestion.label}
              type={suggestion.type}
              prompt={suggestion.prompt}
              placeholder={suggestion.placeholder}
              inputMode={suggestion.inputMode}
              onSave={(patch) =>
                onCreate({
                  category: suggestion.category,
                  type: suggestion.type,
                  label: suggestion.label,
                  value: patch.value,
                })
              }
            />
          ))}

          {section.children === true ? (
            <ChildrenBlock
              entries={model.children}
              row={row}
              onAddChild={onAddChild}
              onRenameChild={onRenameChild}
              onAddBirthday={(child, value) =>
                onCreate({
                  category: "PERSONAL",
                  type: "DATE",
                  label: childBirthdayLabel(child.name.value),
                  value,
                })
              }
            />
          ) : null}

          {model.families.length > 0 ? (
            <FamiliesBlock entries={model.families} row={row} onRenameFamily={onRenameFamily} />
          ) : null}

          {section.companyLogo === true && logo !== undefined && logo !== null ? (
            <li
              data-workspace-logo=""
              className="flex items-center gap-3 border-t border-line px-3 py-3 sm:px-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-3">Company logo</p>
                <p className="truncate text-sm text-ink-2">
                  Shown on every card with your work details
                </p>
              </div>
              <LogoPicker
                logoUrl={logo.logoUrl}
                busy={logo.busy}
                onPick={logo.onPick}
                onRemove={logo.onRemove}
              />
            </li>
          ) : null}

          {drafts.map((draft) => (
            <WorkspaceFieldRow
              key={`draft-${draft.key}`}
              field={null}
              category={section.createCategory}
              label={draft.offer.label}
              type={draft.offer.type}
              placeholder={draft.offer.placeholder}
              inputMode={draft.offer.inputMode}
              labelEditable={needsOwnName(draft.offer.type)}
              autoEdit
              onCancel={() => dropDraft(draft.key)}
              onSave={(patch) => {
                dropDraft(draft.key);
                onCreate({
                  category: section.createCategory,
                  type: draft.offer.type,
                  label: patch.label,
                  value: patch.value,
                });
              }}
            />
          ))}
        </ul>

        <div className="flex flex-col gap-2 px-3 pt-1 sm:px-4">
          {choosing ? (
            <div data-add-field-offers={section.id} className="flex flex-col gap-2 py-1">
              <div className="flex items-center gap-2">
                <p className="text-xs text-ink-3">Add to {section.label}</p>
                <Button
                  variant="ghost"
                  iconOnly
                  aria-label="Close"
                  className="ms-auto"
                  onClick={() => setChoosing(false)}
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-x-1.5 gap-y-2.5">
                {section.offers.map((offer) => (
                  <button
                    key={offer.id}
                    type="button"
                    data-field-offer={offer.id}
                    onClick={() => pick(offer)}
                    className={cn(
                      "inline-flex items-center rounded-md border border-line-control bg-canvas px-2.5 py-1",
                      "text-xs text-ink transition-colors hover:border-accent max-md:min-w-11",
                      TOUCH_HIT_44_Y,
                      BUILDER_SCROLL_CLEAR,
                    )}
                  >
                    {offer.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4">
              <Button
                variant="text-link"
                data-add-field-open={section.id}
                onClick={() => setChoosing(true)}
                className={BUILDER_SCROLL_CLEAR}
              >
                <Plus aria-hidden="true" className="size-4" />
                Add field
              </Button>
              {model.groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/profile/groups/${group.id}`}
                  data-group-editor-link={group.id}
                  className={buttonClassName({ variant: "text-link", className: "text-ink-3" })}
                >
                  {model.groups.length === 1 ? "Reorder or delete" : `Reorder or delete: ${group.name}`}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── children ─────────────────────────────────────────────────────────────────────────── */

function ChildrenBlock({
  entries,
  row,
  onAddChild,
  onRenameChild,
  onAddBirthday,
}: {
  entries: readonly ChildEntry[];
  row: (field: ProfileField, extra?: RowExtra) => ReactElement;
  onAddChild: (name: string, birthday: string) => void;
  onRenameChild: (child: ChildEntry, name: string) => void;
  onAddBirthday: (child: ChildEntry, value: string) => void;
}): ReactElement {
  const [adding, setAdding] = useState(false);

  return (
    <li data-workspace-children="" className="border-t border-line">
      <p className="px-3 pb-1 pt-3 text-overline font-medium uppercase text-ink-2 sm:px-4">
        Children
      </p>
      <ul className="flex flex-col">
        {entries.map((child) => (
          <li
            key={child.name.id}
            data-workspace-child={child.name.id}
            className="border-t border-line first:border-t-0"
          >
            <ul className="flex flex-col">
              {row(child.name, {
                labelEditable: false,
                onSave: (patch) => onRenameChild(child, patch.value),
              })}
              {child.birthday === null ? (
                <WorkspaceFieldRow
                  field={null}
                  category="PERSONAL"
                  label={childBirthdayLabel(child.name.value)}
                  type="DATE"
                  prompt={`Add ${childBirthdayLabel(child.name.value)}`}
                  onSave={(patch) => onAddBirthday(child, patch.value)}
                />
              ) : (
                row(child.birthday, { labelEditable: false })
              )}
            </ul>
          </li>
        ))}
      </ul>

      {adding ? (
        <AddChildForm
          onCancel={() => setAdding(false)}
          onSave={(name, birthday) => {
            setAdding(false);
            onAddChild(name, birthday);
          }}
        />
      ) : (
        <div className="px-3 pb-2 sm:px-4">
          <button
            type="button"
            data-add-child=""
            onClick={() => setAdding(true)}
            className={cn(
              "-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-1.5 rounded-md px-2 text-left text-sm text-ink-3",
              "transition-colors hover:bg-surface/70",
              BUILDER_SCROLL_CLEAR,
            )}
          >
            <Plus aria-hidden="true" className="size-3.5" />
            Add a child
          </button>
        </div>
      )}
    </li>
  );
}

function AddChildForm({
  onSave,
  onCancel,
}: {
  onSave: (name: string, birthday: string) => void;
  onCancel: () => void;
}): ReactElement {
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim() === "") {
      setError("Enter a name.");
      return;
    }
    onSave(name.trim(), birthday);
  }

  const inputClass = cn(
    "h-10 w-full min-w-0 rounded-md border border-line-control bg-canvas px-3 text-sm text-ink",
    "placeholder:text-ink-4 focus:border-accent focus:outline-none",
    BUILDER_SCROLL_CLEAR,
  );

  return (
    <form
      data-add-child-form=""
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      className="flex flex-col gap-2 px-3 pb-3 pt-1 sm:px-4"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-name`} className="text-xs text-ink-3">
            Name
          </label>
          <input
            id={`${id}-name`}
            autoFocus
            value={name}
            maxLength={80}
            autoComplete="off"
            aria-invalid={error === null ? undefined : true}
            onChange={(event) => {
              setName(event.target.value);
              if (error !== null) setError(null);
            }}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-birthday`} className="text-xs text-ink-3">
            Birthday
          </label>
          <input
            id={`${id}-birthday`}
            type="date"
            value={birthday}
            onChange={(event) => setBirthday(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      {error === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" data-add-child-save="" className={BUILDER_SCROLL_CLEAR}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} className={BUILDER_SCROLL_CLEAR}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ── family ────────────────────────────────────────────────────────────────────────────── */

/**
 * One `FAMILY` group per family member — the person's name and their birthday, side by side.
 *
 * Unlike `ChildrenBlock`, which pairs legacy loose fields by label, this reads a real group: the
 * member's name is the group's `tag` (falling back to the RELATION field's value), and the two
 * fields are rendered in the group's own order.
 */
function FamiliesBlock({
  entries,
  row,
  onRenameFamily,
}: {
  entries: readonly FamilyEntry[];
  row: (field: ProfileField, extra?: RowExtra) => ReactElement;
  onRenameFamily: (entry: FamilyEntry, name: string) => void;
}): ReactElement {
  return (
    <li data-workspace-family="" className="border-t border-line">
      <p className="px-3 pb-1 pt-3 text-overline font-medium uppercase text-ink-2 sm:px-4">
        Family
      </p>
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <li
            key={entry.group.id}
            data-workspace-family-member={entry.group.id}
            className="border-t border-line first:border-t-0"
          >
            <ul className="flex flex-col">
              {entry.nameField === null ? null : (
                <WorkspaceFieldRow
                  key={entry.nameField.id}
                  field={entry.nameField}
                  category="FAMILY"
                  label={entry.nameField.label}
                  type={entry.nameField.type}
                  labelEditable={false}
                  revealed={false}
                  onToggleReveal={() => undefined}
                  onSave={(patch) => onRenameFamily(entry, patch.value)}
                  toggle={null}
                />
              )}
              {entry.birthdayField === null ? null : row(entry.birthdayField, { labelEditable: false })}
            </ul>
          </li>
        ))}
      </ul>
    </li>
  );
}
