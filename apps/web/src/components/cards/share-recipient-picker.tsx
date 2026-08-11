import { useEffect, useMemo, useState, type JSX } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import {
  SHARE_LIMITS,
  type CardShareRecipientInput,
} from "@/lib/card-share-types";
import { fetchAllContacts } from "@/lib/contacts-api";
import { getPrimaryPhone } from "@/lib/contact-display";
import { DIAL_COUNTRIES } from "@/lib/dial-countries";
import { logUiError } from "@/lib/friendly-errors";
import { buildE164, nationalDigits, parsePhoneParts } from "@/lib/phone";
import type { ContactDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ShareRecipientDraft = {
  /** Stable local key for React lists; not sent to the API. */
  key: string;
  countryCode: string;
  phone: string;
  contactId?: string;
  /** Display name when the row came from the contact list. */
  label?: string;
};

export type ShareRecipientPickerProps = {
  value: ShareRecipientDraft[];
  onChange: (next: ShareRecipientDraft[]) => void;
  disabled?: boolean;
  max?: number;
  className?: string;
};

/** Display name for a contact, or null when nothing usable is on file. */
function contactDisplayName(contact: ContactDetail): string | null {
  const displayName = contact.displayName?.trim();
  if (displayName) {
    return displayName;
  }
  const combined = [contact.firstName, contact.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return combined || null;
}

function formatDraft(draft: ShareRecipientDraft): string {
  return `${draft.countryCode} ${draft.phone}`;
}

/**
 * Contacts are frequently saved without a country code, so a fallback dial is
 * needed to read them. `+91` matches what the card share flow has always used —
 * taking `DIAL_COUNTRIES[0]` instead would silently reroute local Indian numbers
 * to `+1`.
 */
const FALLBACK_DIAL = "+91";

const DEFAULT_COUNTRY =
  DIAL_COUNTRIES.find((country) => country.dial === FALLBACK_DIAL) ??
  DIAL_COUNTRIES[0];

/** Builds a 1–50 recipient list from synced contacts and/or manually entered numbers. */
export function ShareRecipientPicker({
  value,
  onChange,
  disabled = false,
  max = SHARE_LIMITS.maxRecipientsPerBatch,
  className,
}: ShareRecipientPickerProps): JSX.Element {
  const [contacts, setContacts] = useState<ContactDetail[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);

  const [countryKey, setCountryKey] = useState(
    `${DEFAULT_COUNTRY.iso2}-${DEFAULT_COUNTRY.dial}`,
  );
  const [nationalNumber, setNationalNumber] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingContacts(true);
    setContactsError(null);
    fetchAllContacts({ source: "VCARD" })
      .then((items) => {
        if (!cancelled) {
          setContacts(items);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        logUiError("Could not load contacts for sharing", error);
        setContactsError(
          "We couldn't load your contacts. You can still add numbers manually.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingContacts(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCountry = useMemo(
    () =>
      DIAL_COUNTRIES.find(
        (country) => `${country.iso2}-${country.dial}` === countryKey,
      ) ?? DEFAULT_COUNTRY,
    [countryKey],
  );

  /**
   * Parsed against a fixed fallback dial rather than the manual-entry selector,
   * so changing that selector cannot retroactively re-describe a contact the
   * user already added under a different country code.
   */
  const { contactRecipients, skippedContactCount } = useMemo(() => {
    const list: Array<{
      id: string;
      countryCode: string;
      phone: string;
      label: string;
    }> = [];
    let skipped = 0;
    for (const contact of contacts) {
      const raw = getPrimaryPhone(contact);
      if (!raw.trim()) {
        skipped += 1;
        continue;
      }
      const parts = parsePhoneParts(raw, FALLBACK_DIAL);
      if (!parts) {
        skipped += 1;
        continue;
      }
      const formatted = `${parts.countryCode} ${parts.phone}`;
      list.push({
        id: contact.id,
        countryCode: parts.countryCode,
        phone: parts.phone,
        label: contactDisplayName(contact) ?? formatted,
      });
    }
    return { contactRecipients: list, skippedContactCount: skipped };
  }, [contacts]);

  const contactOptions = useMemo<MultiSelectOption[]>(
    () =>
      contactRecipients.map((item) => ({
        value: item.id,
        label: item.label,
        description: `${item.countryCode} ${item.phone}`,
      })),
    [contactRecipients],
  );

  const contactRecipientMap = useMemo(
    () => new Map(contactRecipients.map((item) => [item.id, item])),
    [contactRecipients],
  );

  const selectedContactIds = useMemo(
    () =>
      value
        .filter((draft) => draft.contactId)
        .map((draft) => draft.contactId as string),
    [value],
  );

  const atCap = value.length >= max;

  /**
   * The contact picker only knows about its own rows, so its ceiling is the
   * batch cap minus whatever was typed in by hand. Never drop below the current
   * selection, or rows already chosen could not be deselected.
   */
  const contactSelectionLimit = Math.max(
    selectedContactIds.length,
    max - value.filter((draft) => !draft.contactId).length,
  );

  const handleContactSelectionChange = (nextIds: string[]) => {
    const nextSet = new Set(nextIds);
    const existingIds = new Set(selectedContactIds);
    const kept = value.filter(
      (draft) => !draft.contactId || nextSet.has(draft.contactId),
    );
    const added: ShareRecipientDraft[] = [];
    for (const id of nextIds) {
      if (existingIds.has(id)) {
        continue;
      }
      const info = contactRecipientMap.get(id);
      if (!info) {
        continue;
      }
      added.push({
        key: crypto.randomUUID(),
        countryCode: info.countryCode,
        phone: info.phone,
        contactId: info.id,
        label: info.label,
      });
    }
    onChange([...kept, ...added]);
  };

  const handleAddManual = () => {
    setManualError(null);
    const dial = selectedCountry.dial;
    try {
      buildE164(dial, nationalNumber);
    } catch (error) {
      setManualError(
        error instanceof Error ? error.message : "Enter a valid phone number.",
      );
      return;
    }
    const phone = nationalDigits(nationalNumber);
    const isDuplicate = value.some(
      (draft) => draft.countryCode === dial && draft.phone === phone,
    );
    if (isDuplicate) {
      setManualError("That number is already in the list.");
      return;
    }
    onChange([...value, { key: crypto.randomUUID(), countryCode: dial, phone }]);
    setNationalNumber("");
  };

  const removeDraft = (key: string) => {
    onChange(value.filter((draft) => draft.key !== key));
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-2 text-sm font-medium">
        <span id="share-recipient-contacts-label">From your contacts</span>
        <MultiSelect
          aria-labelledby="share-recipient-contacts-label"
          options={contactOptions}
          value={selectedContactIds}
          onValueChange={handleContactSelectionChange}
          placeholder="Select synced contacts"
          searchPlaceholder="Search contacts"
          loadingMessage="Loading contacts…"
          emptyMessage={
            contactsError
              ? "Contacts could not be loaded"
              : "No synced contacts with a usable phone number"
          }
          isLoading={isLoadingContacts}
          disabled={disabled}
          maxSelected={contactSelectionLimit}
        />
        {contactsError ? (
          <p className="text-xs font-normal text-destructive">{contactsError}</p>
        ) : (
          <p className="text-xs font-normal text-muted-foreground">
            Numbers come from your synced contacts.
            {skippedContactCount > 0
              ? ` ${skippedContactCount} ${
                  skippedContactCount === 1 ? "contact was" : "contacts were"
                } left out because we couldn't read a phone number for them.`
              : ""}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 text-sm font-medium">
        <span>Add a number</span>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            aria-label="Country code"
            className="flex h-9 w-full rounded-md border border-border bg-surface px-3 text-sm sm:w-44"
            value={countryKey}
            onChange={(event) => setCountryKey(event.target.value)}
            disabled={disabled || atCap}
          >
            {DIAL_COUNTRIES.map((country) => (
              <option
                key={`${country.iso2}-${country.dial}`}
                value={`${country.iso2}-${country.dial}`}
              >
                {country.name} ({country.dial})
              </option>
            ))}
          </select>
          <Input
            aria-label="Phone number"
            inputMode="numeric"
            placeholder="9347243575"
            value={nationalNumber}
            onChange={(event) =>
              setNationalNumber(nationalDigits(event.target.value).slice(0, 15))
            }
            disabled={disabled || atCap}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || atCap || nationalNumber.trim().length === 0}
            onClick={handleAddManual}
          >
            Add
          </Button>
        </div>
        {manualError ? (
          <p className="text-sm text-destructive">{manualError}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          {value.length} of {max} recipients
        </p>
        {value.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recipients added yet.</p>
        ) : (
          <ul className="max-h-24 space-y-1 overflow-y-auto overscroll-contain">
            {value.map((draft) => {
              const label = draft.label ?? formatDraft(draft);
              return (
                <li
                  key={draft.key}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{label}</p>
                    {draft.label ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDraft(draft)}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label={`Remove ${label}`}
                    disabled={disabled}
                    onClick={() => removeDraft(draft.key)}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          WhatsApp allows at most {SHARE_LIMITS.maxRecipientsPerDay} distinct
          recipients per 24 hours across all shares.
        </p>
        {atCap ? (
          <p className="text-xs text-muted-foreground">
            You've reached the {max}-recipient limit for this share.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Maps drafts to the API payload, dropping the local-only fields. */
export function toRecipientInputs(
  drafts: ShareRecipientDraft[],
): CardShareRecipientInput[] {
  return drafts.map((draft) => ({
    phone: draft.phone,
    countryCode: draft.countryCode,
    ...(draft.contactId ? { contactId: draft.contactId } : {}),
  }));
}
