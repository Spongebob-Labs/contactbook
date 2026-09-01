/**
 * The fixture contact registry (spec §10.3).
 *
 * ## ⚠ Rewritten, because a contact stopped meaning what it used to
 * These were twelve *saved leads*: each carried a denormalised snapshot of somebody else's job
 * title, company and email, plus the slug of the card they had scanned. The API has no such
 * concept — `ContactResponseDto` is a phone number, a name you chose for it, and a private note.
 * See `types/domain.ts` for the full inversion.
 *
 * So these are eight **recipients**, and they are chosen to cover the states that now exist
 * rather than to be eight plausible people:
 *
 * · every `ContactSource` — `MANUAL`, `IMPORTED`, `QR_SCAN`, `INBOUND`
 * · `displayName: null` — routine after an import, and the reason `contactLabel` exists
 * · `notes: null` and notes present — the notes column has to collapse, not render "null"
 * · one `optedOutAt` — the badge, and the rule that existing links stay live regardless
 *
 * ## The numbers are deliberately fake, and sequential so they read that way
 * A registry is *nothing but* phone numbers, so plausible-looking ones would be the same
 * hygiene mistake as a real email domain — which `fixture-hygiene.test.ts` already forbids for
 * hosts (RFC 2606 reserved names only). That test does not yet cover phone numbers; these are
 * written to the spirit of it anyway. `+91 99000000NN` is well-formed E.164 and obviously
 * patterned, so nobody can mistake one for a person's line.
 *
 * ⚠ Note for anyone tempted to use a *formally* reserved range here instead: the API rejects
 * them. `+447700900123` — Ofcom's permanent drama reserve — comes back 400 `BAD_REQUEST`,
 * because the server validates with a real phone-number library that knows the range is
 * unassignable. Reserved-for-fiction and accepted-by-the-API are mutually exclusive, which is
 * why these are patterned rather than reserved.
 */

import type { Contact } from "@/types/domain";
import { fixtureUser } from "@/fixtures/user";

const OWNER = fixtureUser.id;

export const fixtureContacts: readonly Contact[] = [
  {
    id: "contact_arjun",
    ownerId: OWNER,
    phoneE164: "+919900000001",
    displayName: "Arjun Balasubramanian",
    notes: "Met at the Bengaluru partner summit. Wants the payment card, not the work one.",
    source: "MANUAL",
    optedOutAt: null,
    createdAt: "2026-08-20T11:02:00.000Z",
  },
  {
    id: "contact_mei",
    ownerId: OWNER,
    phoneE164: "+919900000002",
    displayName: "Mei Nakamura",
    notes: null,
    source: "MANUAL",
    optedOutAt: null,
    createdAt: "2026-08-18T15:48:00.000Z",
  },
  {
    id: "contact_farida",
    ownerId: OWNER,
    phoneE164: "+919900000003",
    displayName: "Farida Sheikh",
    notes: "Prefers WhatsApp over email.",
    source: "IMPORTED",
    optedOutAt: null,
    createdAt: "2026-08-14T09:30:00.000Z",
  },
  {
    // §11: an import routinely brings a number with no name. Every surface that shows a contact
    // has to fall back to the number rather than render a blank cell.
    id: "contact_unnamed",
    ownerId: OWNER,
    phoneE164: "+919900000004",
    displayName: null,
    notes: null,
    source: "IMPORTED",
    optedOutAt: null,
    createdAt: "2026-08-13T18:05:00.000Z",
  },
  {
    id: "contact_declan",
    ownerId: OWNER,
    phoneE164: "+919900000005",
    displayName: "Declan Moore",
    notes: null,
    source: "QR_SCAN",
    optedOutAt: null,
    createdAt: "2026-08-12T20:11:00.000Z",
  },
  {
    // Texted STOP. The badge is the point — and so is the fact that any link already sent to
    // them keeps working, because opting out blocks new sends and revokes nothing.
    id: "contact_opted_out",
    ownerId: OWNER,
    phoneE164: "+919900000006",
    displayName: "Ravi Krishnan",
    notes: "Asked to stop receiving updates.",
    source: "IMPORTED",
    optedOutAt: "2026-08-11T07:40:00.000Z",
    createdAt: "2026-08-02T12:00:00.000Z",
  },
  {
    id: "contact_lena",
    ownerId: OWNER,
    phoneE164: "+919900000007",
    displayName: "Lena Fischer",
    notes: null,
    source: "INBOUND",
    optedOutAt: null,
    createdAt: "2026-08-09T14:22:00.000Z",
  },
  {
    id: "contact_priya",
    ownerId: OWNER,
    phoneE164: "+919900000008",
    displayName: "Priya Menon",
    notes: "Introduced by Farida.",
    source: "MANUAL",
    optedOutAt: null,
    createdAt: "2026-08-05T08:15:00.000Z",
  },
] as const satisfies readonly Contact[];

/** The one contact who has opted out — named so a test does not have to search for the flag. */
export const fixtureOptedOutContact: Contact = fixtureContacts[5]!;

/** The one contact with no `displayName`, for the `contactLabel` fallback. */
export const fixtureUnnamedContact: Contact = fixtureContacts[3]!;
