/**
 * Phone normalisation and import parsing.
 *
 * ## Why these are not in `actions/contacts.ts` where they are used
 * A `"use server"` module may export **only async functions** — the directive turns every export
 * into a callable server endpoint, and Turbopack rejects a synchronous one at build time. These
 * two are pure and synchronous, so they live here and the actions import them.
 *
 * That is also the better shape: this is the logic worth unit-testing, and a test importing it
 * from here does not drag the whole API client in behind a `"use server"` boundary.
 */

import type { ImportContactEntryDto } from "@/lib/api/schema";

/**
 * A typed number → strict E.164, or `null` when it cannot be one.
 *
 * Keeps a single leading `+` and drops every other non-digit, so spaces, brackets, dots and
 * dashes all survive a paste. Returns `null` — rather than guessing a country — when the `+` is
 * missing, because guessing wrong sends somebody's card to a stranger and there is no country
 * picker on the contacts screen to infer from.
 *
 * The API validates with a real phone-number library, so anything looser than this produces a
 * 400 the user cannot act on.
 */
export function normaliseE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("+")) return null;

  const digits = trimmed.slice(1).replace(/[^0-9]/g, "");
  // Bounded by E.164 itself (max 15 digits), with a floor that rejects a stray "+".
  if (digits.length < 6 || digits.length > 15) return null;
  return `+${digits}`;
}

/**
 * Parse the import paste box into entries.
 *
 * One contact per line, number first, optional name after the **first** comma — so a name
 * containing a comma survives, which "Nakamura, Mei" routinely does.
 *
 * A line whose number cannot be normalised is **counted** as skipped rather than dropped
 * quietly: silently importing 18 of 22 lines and reporting 18 is how somebody discovers four
 * missing contacts a week later.
 */
export function parseImportLines(raw: string): {
  entries: ImportContactEntryDto[];
  skipped: number;
} {
  const entries: ImportContactEntryDto[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const line of raw.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;

    const comma = line.indexOf(",");
    const rawPhone = comma === -1 ? line : line.slice(0, comma);
    const rawName = comma === -1 ? "" : line.slice(comma + 1);

    const phoneE164 = normaliseE164(rawPhone);
    if (phoneE164 === null) {
      skipped += 1;
      continue;
    }

    // The API upserts per entry, so a duplicated line is harmless — but deduplicating here keeps
    // the reported counts honest rather than counting one number twice.
    if (seen.has(phoneE164)) continue;
    seen.add(phoneE164);

    const displayName = rawName.trim();
    entries.push({
      phoneE164,
      displayName: displayName.length > 0 ? displayName : undefined,
    });
  }

  return { entries, skipped };
}
