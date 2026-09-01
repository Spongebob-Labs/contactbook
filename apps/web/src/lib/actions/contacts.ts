"use server";

/**
 * Contact registry mutations — three of the API's five contact endpoints.
 *
 * The two reads belong to the screens' server components. There is no delete: `POST/GET/PATCH
 * /contacts` and `POST /contacts/import` are the entire surface, and `optedOutAt` is the only way
 * a contact goes quiet — set by them, never by us.
 *
 * ## ⚠ Every export here must be an async function
 * A `"use server"` directive turns each export into a callable server endpoint, so a synchronous
 * helper alongside these is a **build error** — not a type error, which is why it survived
 * `tsc --noEmit` and died in `next build`. `normaliseE164` and `parseImportLines` therefore live
 * in `@/lib/contacts-parse`, which is also where their tests point.
 *
 * ## Normalising a number is the load-bearing part
 * Every endpoint here wants strict E.164, and the API validates with a real phone-number library
 * that rejects anything looser. A pasted `+91 98200 00000` has to become `+919820000000` before
 * it is sent, or the caller gets a 400 they cannot act on.
 */

import { revalidatePath } from "next/cache";

import { contacts } from "@/lib/api";
import { normaliseE164, parseImportLines } from "@/lib/contacts-parse";
import { failFrom, failLocally, succeed, type ActionResult } from "@/lib/actions/result";

const CONTACTS_PATH = "/contacts";

/* ── Add one ─────────────────────────────────────────────────────────────────────────── */

export interface AddContactOutcome {
  /** What to call them in the confirmation — the name if given, else the number. */
  label: string;
}

/**
 * Add a contact, or update the one that already holds this number.
 *
 * `POST /contacts` **upserts** on `(you, phoneE164)`, so this is safe to call for a number already
 * in the registry — it refreshes the name and notes rather than erroring, which is why the form
 * has no duplicate check.
 *
 * ⚠ The response does not say which of the two happened, and nothing here pretends to know. A
 * "created" flag would need either a second read (a race, for a toast) or an inference from
 * `source` (wrong for a number that was originally imported). So the confirmation says "Saved",
 * which is true either way.
 */
export async function addContactAction(input: {
  phone: string;
  displayName: string;
  notes: string;
}): Promise<ActionResult<AddContactOutcome>> {
  const phoneE164 = normaliseE164(input.phone);
  if (phoneE164 === null) {
    return failLocally("Enter the number with its country code, like +919820000000.");
  }

  const displayName = input.displayName.trim();
  const notes = input.notes.trim();

  try {
    const saved = await contacts.upsertContact({
      phoneE164,
      displayName: displayName.length > 0 ? displayName : undefined,
      notes: notes.length > 0 ? notes : undefined,
    });
    revalidatePath(CONTACTS_PATH);
    return succeed({ label: saved.displayName ?? saved.phoneE164 });
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/* ── Import many ─────────────────────────────────────────────────────────────────────── */

export interface ImportOutcome {
  created: number;
  updated: number;
  /** Lines that carried no usable number. Reported rather than silently dropped. */
  skipped: number;
}

/**
 * Hand over a whole address book in one call.
 *
 * This is the documented way contacts actually arrive — one request for the lot rather than one
 * `POST /contacts` per person. There is no device address-book API on the web, so the honest
 * input is a paste; `parseImportLines` turns it into entries.
 *
 * The response splits `created` from `updated`, and **both** are reported: one combined number
 * would claim 22 new contacts when 4 of them were already there.
 *
 * New rows are tagged `source=IMPORTED` by the API, which is what makes the registry's source
 * filter meaningful afterwards.
 */
export async function importContactsAction(raw: string): Promise<ActionResult<ImportOutcome>> {
  const { entries, skipped } = parseImportLines(raw);

  if (entries.length === 0) {
    return failLocally(
      skipped === 0
        ? "Paste at least one number."
        : "None of those lines had a number with a country code, like +919820000000.",
    );
  }

  try {
    const result = await contacts.importContacts({ contacts: entries });
    revalidatePath(CONTACTS_PATH);
    return succeed({
      created: result.created.length,
      updated: result.updated.length,
      skipped,
    });
  } catch (thrown) {
    return failFrom(thrown);
  }
}

/* ── Edit one ────────────────────────────────────────────────────────────────────────── */

/**
 * Rename a contact, or change your private note about them.
 *
 * ⚠ `phoneE164` is **not** editable — it is the identity a contact is matched by. A wrong number
 * is fixed by adding the right one, which upserts into a new row; the wrong one stays until the
 * API grows a delete.
 */
export async function updateContactAction(
  contactId: string,
  patch: { displayName: string; notes: string },
): Promise<ActionResult<undefined>> {
  try {
    await contacts.updateContact(contactId, {
      // Empty string rather than `undefined`: an omitted key leaves the old value in place, so
      // clearing a name would silently do nothing.
      displayName: patch.displayName.trim(),
      notes: patch.notes.trim(),
    });
    revalidatePath(CONTACTS_PATH);
    revalidatePath(`${CONTACTS_PATH}/${contactId}`);
    return succeed(undefined);
  } catch (thrown) {
    return failFrom(thrown);
  }
}
