/**
 * `contacts` — 5 endpoints.
 *
 * ⚠ Read the shape before writing UI against this. A `Contact` here is an **outbound
 * recipient**: a phone number, a display name, and the owner's private note. It is not the
 * inbound "someone scanned my card and saved their details" record the old fixtures
 * modelled — the API never collects a contact's job title, company or email, so no screen
 * can show them.
 *
 * What *can* be shown per contact is which cards have been shared with them, and whether
 * those links have been opened. That comes from `GET /share-links`, joined on `contactId`.
 *
 * ⚠ There is no delete. A contact can be created, read and edited, and that is all —
 * `optedOutAt` is the only way one goes quiet, and only they can set it (by texting STOP).
 */

import "server-only";

import { authed } from "@/lib/api/server";
import type {
  ContactResponseDto,
  ImportContactsDto,
  ImportContactsResponseDto,
  UpdateContactDto,
  UpsertContactDto,
} from "@/lib/api/schema";

/** Unpaginated — the whole registry in one array. Fine at demo scale; flagged for later. */
export function listContacts(): Promise<ContactResponseDto[]> {
  return authed({ method: "GET", path: "/contacts" });
}

/**
 * Upserts on `(you, phoneE164)`, so this is safe to call for a number that already exists —
 * it updates rather than 409s. Returns 200, not 201, for that reason.
 */
export function upsertContact(body: UpsertContactDto): Promise<ContactResponseDto> {
  return authed({ method: "POST", path: "/contacts", body });
}

/** @throws `CONTACT_NOT_FOUND`. */
export function getContact(id: string): Promise<ContactResponseDto> {
  return authed({ method: "GET", path: `/contacts/${encodeURIComponent(id)}` });
}

/** `phoneE164` is not editable — it is the identity a contact is matched by. @throws `CONTACT_NOT_FOUND`. */
export function updateContact(id: string, body: UpdateContactDto): Promise<ContactResponseDto> {
  return authed({ method: "PATCH", path: `/contacts/${encodeURIComponent(id)}`, body });
}

/**
 * The expected way contacts actually arrive — one call for a whole address book, rather than
 * one `upsertContact` per person. New rows are tagged `source=IMPORTED`; existing ones have
 * their `displayName` refreshed. The response splits `created` from `updated` so the UI can
 * report "18 added, 4 updated" honestly instead of claiming 22 new contacts.
 */
export function importContacts(body: ImportContactsDto): Promise<ImportContactsResponseDto> {
  return authed({ method: "POST", path: "/contacts/import", body });
}
