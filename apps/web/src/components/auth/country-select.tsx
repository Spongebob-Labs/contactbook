"use client";

import { Select } from "@/components/primitives";
// Imported for local use by ITEMS below; also re-exported further down for callers.
import { COUNTRIES } from "@/lib/countries";

/**
 * The country dialling code beside the phone field — spec §8D.2 A-1.
 *
 * ## Why the value is an ISO code and not the dialling code
 * `+1` belongs to both the United States and Canada, and a Radix `Select` keys its items by
 * value: two items sharing `+1` means picking one highlights the other. So the stored
 * answer is the ISO 3166-1 alpha-2 code, and {@link dialCodeFor} derives what the user sees.
 * `auth-flow-context.tsx` holds `country`, never a raw `+`-string, for the same reason.
 *
 * ## Why there are no flags
 * A flag here would have to be an emoji — and emoji as an interface marker is F-07/F-08
 * (§8C.1). The dialling code is the information a person is actually looking for anyway.
 *
 * ## The list
 * Fifteen countries, alphabetical, chosen to cover the fixture user's market and the places
 * a card gets scanned. It is a UI fixture, not a data source: when the API arrives it hands
 * over the real list and only this array changes.
 */

/**
 * The data and the pure conversions now live in `@/lib/countries`, because the API mapper and
 * the sign-in Server Action need them and this is a `"use client"` module — importing them
 * from here would pull a React component tree into server-only code.
 *
 * Re-exported so every existing import site (`signin/phone`, `signin/otp`) is unchanged.
 */
export {
  COUNTRIES,
  countryNameFor,
  dialCodeFor,
  dialledNumber,
  dialPrefixOf,
  toE164,
  type Country,
} from "@/lib/countries";

/**
 * The trigger reads `India +91`, which is also the menu row — a Radix trigger renders the
 * selected item's own text, so the two cannot be given different wording without forking
 * T05's `Select`, and forking a primitive is not this track's call (plan §1.2).
 */
const ITEMS = COUNTRIES.map((country) => ({
  value: country.code,
  label: `${country.name} ${country.dial}`,
}));

export interface CountrySelectProps {
  /** ISO alpha-2. */
  value: string;
  onValueChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
}

export function CountrySelect({
  value,
  onValueChange,
  disabled,
  className,
}: CountrySelectProps) {
  return (
    <Select
      label="Country code"
      // The question above the field is the visible label; a second visible "Country code"
      // would make a one-question screen read as two. It stays in the accessibility tree.
      hideLabel
      items={ITEMS}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      // `SelectProps` is a closed interface, so there is no `data-*` hook to hang a test
      // selector on. Tests address the trigger by its accessible name — "Country code" —
      // which is the name a screen reader hears, and therefore the better assertion.
      fieldClassName={className}
      className="[&>span]:min-w-0 [&>span]:truncate"
      contentClassName="max-h-64"
    />
  );
}
