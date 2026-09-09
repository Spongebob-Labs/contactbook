"use client";

import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Popover } from "@/components/overlay";
import { Button } from "@/components/primitives/button";
import { Input } from "@/components/primitives/input";
import { Select } from "@/components/primitives/select";
import { Switch } from "@/components/primitives/switch";
import type { FieldGroup, FieldType } from "@/types/domain";

/**
 * "Add field" — spec §8D.3 (Profile), §5.5, §4.5.
 *
 * ## Why a popover and not a dialog
 * T08's `Popover` is deliberately **not modal**: the group underneath stays readable and
 * operable while the owner decides what to add, which matters because the thing they are
 * about to type is usually a variation on something already in the list. Escape still
 * closes it and focus still returns to the trigger — identical dismissal to a dialog, only
 * the modality differs (E-50, asserted by T08's own suite).
 *
 * Nothing in this file touches focus, and that is on purpose. Radix moves focus into the
 * panel on open and back to the trigger on close; a hand-rolled `autoFocus` or a
 * `preventDefault` on `onOpenAutoFocus` is exactly how E-50 gets broken by a track that
 * only meant to be helpful. The panel is closed by setting `open` to `false`, never by
 * moving focus somewhere else first.
 *
 * ## A card is a filter, so this is where cards get their content
 * §5.3: a card owns no data. A field added here becomes available to tick in **every**
 * card builder immediately, and a card that maps nothing renders name-only — the old
 * build's 73-byte `.vcf` (§11 E-01/E-02). That is the whole reason this screen was pulled
 * back into scope, and the reason the hint below says it out loud.
 *
 * ## No persistence, by design
 * The submitted field goes to the screen's `useReducer` and is gone on reload (§5.7,
 * §3.1). There is no network call, no server action and no browser storage in this track.
 */

/** All 21 `FieldType`s in the owner's language. Total by annotation, so none can be missed. */
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  PHONE: "Mobile number",
  LANDLINE: "Landline",
  FAX: "Fax",
  EMAIL: "Email",
  ADDRESS: "Address",
  URL: "Website",
  SOCIAL_LINK: "Social link",
  PHOTO: "Photo",
  TEXT: "Note",
  DATE: "Date",
  JOB_TITLE: "Job title",
  COMPANY: "Company",
  REG_NUMBER: "Registration number",
  DEPARTMENT: "Team",
  RELATION: "Relation",
  STATUS: "Status",
  LOCATION_TRACKING: "Location sharing",
  BANK_ACCOUNT: "Bank account",
  DIGITAL_WALLET: "Digital wallet",
  CRYPTO_WALLET: "Crypto wallet",
  CUSTOM: "Custom",
};

/**
 * **What a value of each kind looks like — the placeholder, and the keyboard to type it on.**
 *
 * ## Why this lives beside {@link FIELD_TYPE_LABELS}
 * Two surfaces ask an owner to type a raw field value: this popover and the builder's
 * one-line field composer. Both need the same answer to *"what goes in this box?"*, and the
 * client's note was that the box says nothing at all once you have chosen a kind — you pick
 * **Social link** and the input is still an empty rectangle. A second copy of these examples in
 * the builder would be a second thing to keep true, so they are `Record<FieldType, …>` here,
 * beside the labels, **total by annotation** exactly as those are: a new `FieldType` cannot be
 * added without deciding what one looks like.
 *
 * ⚠ **Reserved domains only.** These are demo values on a real screen, so they follow the same
 * rule the fixtures do (RFC 2606 / 6761 — `example`, `.example`, `.invalid`). The hygiene suite
 * walks `FIXTURE_DB` rather than source, so it will not catch a real domain typed here; that is
 * a reason to be careful, not a licence. `you@studio.com` used to sit in this file's own email
 * placeholder and is gone with this change.
 *
 * ⚠ **The four structured kinds get no placeholder.** `BANK_ACCOUNT`, `DIGITAL_WALLET`,
 * `CRYPTO_WALLET` and `PHOTO` are not free text — they have their own editors, and a
 * one-line example would teach the wrong shape. Empty string means "no hint", not "no entry".
 */
export const FIELD_TYPE_PLACEHOLDERS: Record<FieldType, string> = {
  PHONE: "+91 98765 43210",
  LANDLINE: "+91 22 2612 3456",
  FAX: "+91 22 2612 3457",
  EMAIL: "you@example.com",
  ADDRESS: "Flat 12, Sunder Nagar, Mumbai 400018",
  URL: "yourstudio.example",
  SOCIAL_LINK: "linkedin.com/in/yourname",
  PHOTO: "",
  TEXT: "Anything you want on the card",
  DATE: "8 March 1991",
  JOB_TITLE: "Head of Partnerships",
  COMPANY: "Fernwood Studio",
  REG_NUMBER: "U74999MH2019PTC123456",
  DEPARTMENT: "Revenue & Alliances",
  RELATION: "Brother",
  STATUS: "Taking partnership intros this quarter",
  LOCATION_TRACKING: "Sharing with saved contacts",
  BANK_ACCOUNT: "",
  DIGITAL_WALLET: "",
  CRYPTO_WALLET: "",
  CUSTOM: "Anything you want on the card",
};

/**
 * The on-screen keyboard each kind should summon.
 *
 * ⚠ `inputMode`, not `type`. `type="email"` and `type="url"` bring native constraint validation
 * with them, which would silently block a submit this form validates itself — and the two
 * disagree: the form's own rule is "not blank", the browser's is a full grammar. `inputMode`
 * changes the phone keyboard and nothing else, which is the whole benefit and none of the risk.
 * It is the pattern `signin/phone` and `contacts-list-client` already use.
 *
 * `undefined` means the ordinary text keyboard.
 */
export const FIELD_TYPE_INPUT_MODES: Partial<
  Record<FieldType, "tel" | "email" | "url" | "numeric">
> = {
  PHONE: "tel",
  LANDLINE: "tel",
  FAX: "tel",
  EMAIL: "email",
  URL: "url",
  SOCIAL_LINK: "url",
};

/**
 * The order the picker offers them in: the eight a person reaches for first, then the rest.
 * `PHOTO` is last because the avatar slot consumes it and it never renders as a row (§6.6).
 */
const TYPE_ORDER: readonly FieldType[] = [
  "PHONE",
  "EMAIL",
  "ADDRESS",
  "URL",
  "SOCIAL_LINK",
  "JOB_TITLE",
  "COMPANY",
  "TEXT",
  "LANDLINE",
  "FAX",
  "DATE",
  "DEPARTMENT",
  "REG_NUMBER",
  "RELATION",
  "STATUS",
  "LOCATION_TRACKING",
  "BANK_ACCOUNT",
  "DIGITAL_WALLET",
  "CRYPTO_WALLET",
  "CUSTOM",
  "PHOTO",
];

const TYPE_OPTIONS = TYPE_ORDER.map((type) => ({
  value: type,
  label: FIELD_TYPE_LABELS[type],
}));

const KNOWN_TYPES: ReadonlySet<string> = new Set<string>(TYPE_ORDER);

/** Radix hands back a `string`. Narrowing beats casting: the registry is total, so a value
 *  outside the set would otherwise reach `FIELD_RENDERERS` and index it with a lie. */
function toFieldType(value: string, fallback: FieldType): FieldType {
  return KNOWN_TYPES.has(value) ? (value as FieldType) : fallback;
}

/** The three types `isMaskedField()` masks whatever the switch below says (§7.3). */
const ALWAYS_MASKED_HINT = "Bank accounts and wallets are always masked, sensitive or not.";

export interface NewFieldDraft {
  type: FieldType;
  label: string;
  value: string;
  isSensitive: boolean;
}

export interface AddFieldPopoverProps {
  group: FieldGroup;
  onAdd: (draft: NewFieldDraft) => void;
  /** `secondary` inside a populated group, `primary` inside an empty one. */
  variant?: "primary" | "secondary";
}

const DEFAULT_TYPE: FieldType = "TEXT";

export function AddFieldPopover({ group, onAdd, variant = "secondary" }: AddFieldPopoverProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FieldType>(DEFAULT_TYPE);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [isSensitive, setIsSensitive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setType(DEFAULT_TYPE);
    setLabel("");
    setValue("");
    setIsSensitive(false);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Dismissing without adding discards the draft, so re-opening is not a half-typed
    // field the owner has to clear. Radix calls this for Escape and outside clicks too.
    if (!next) reset();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedLabel = label.trim();
    if (trimmedLabel.length === 0) {
      setError("Give the field a name — it is what the row is called.");
      return;
    }
    onAdd({ type, label: trimmedLabel, value: value.trim(), isSensitive });
    setOpen(false);
    reset();
  }

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      title={`Add a field to ${group.name}`}
      side="bottom"
      align="start"
      trigger={
        <Button variant={variant} data-add-field={group.id}>
          <Plus aria-hidden="true" size={16} strokeWidth={1.5} />
          Add field
        </Button>
      }
    >
      <form data-add-field-form={group.id} onSubmit={submit} className="flex flex-col gap-4">
        <Select
          label="Type"
          items={TYPE_OPTIONS}
          value={type}
          onValueChange={(next) => setType(toFieldType(next, DEFAULT_TYPE))}
          hint={
            type === "BANK_ACCOUNT" || type === "DIGITAL_WALLET" || type === "CRYPTO_WALLET"
              ? ALWAYS_MASKED_HINT
              : undefined
          }
        />

        <Input
          label="Field name"
          value={label}
          error={error}
          placeholder="Work email"
          onChange={(event) => setLabel(event.target.value)}
        />

        <Input
          label="Value"
          value={value}
          placeholder={FIELD_TYPE_PLACEHOLDERS.EMAIL}
          hint="Every card you build can tick this field on."
          onChange={(event) => setValue(event.target.value)}
        />

        <Switch
          label="Sensitive"
          description="Masked wherever it appears, and never on a card you have not ticked it into."
          checked={isSensitive}
          onCheckedChange={setIsSensitive}
        />

        <div className="flex items-center gap-3">
          <Button type="submit">Add field</Button>
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Popover>
  );
}
