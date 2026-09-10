import { NextResponse } from "next/server";

import { auth, contacts } from "@/lib/api";
import type { ContactResponseDto } from "@/lib/api/schema";
import { isApiError } from "@/lib/api/errors";
import {
  INBOUND_MESSAGE_LIMIT,
  listInboundMessages,
} from "@/lib/api/endpoints/inbound-messages";

/**
 * **"Who has messaged you" — the caller's own inbound activity, and nobody else's.**
 *
 * ## ⚠ WHY THIS ROUTE EXISTS AT ALL, RATHER THAN A CALL FROM THE BROWSER
 *
 * Every other read on `/contacts` is fetched client-side through `/api/cb/*` — that is the
 * house pattern, and `contacts/page.tsx` says so explicitly ("the calls … now happen
 * client-side"). This one deviates, for one reason:
 *
 * `GET /inbound-messages` is **not ownership-scoped**. The API's own description: *"Every
 * message that has hit our WhatsApp number, from anyone, whether or not it resolves to a known
 * Contact or User — no ownership scoping, this is a raw capture."* It is tagged `webhooks`.
 *
 * Fetched from the browser, that response puts **other users' phone numbers, WhatsApp display
 * names and message bodies** into every client — visible in the Network tab, in a bug report,
 * in a screen-share. No UI choice fixes that, because the leak is the payload arriving.
 *
 * So the join happens here, where the caller's identity is known and the surplus can be thrown
 * away before anything is serialised: fetch the raw capture, fetch the caller's own contacts,
 * keep only the rows whose sender is already one of them. What crosses to the browser is a
 * per-contact summary of numbers the caller already had.
 *
 * ⚠ **Unmatched senders leave as a COUNT and nothing else.** A number that messaged us and is
 * not in the caller's registry may belong to another user's contact — so it is worth telling
 * the owner "4 numbers you don't have wrote to us" while telling them nothing about who.
 * Do not be tempted to return the numbers "so the UI can offer to add them": on an unscoped
 * endpoint that is the leak again, wearing a feature's clothes.
 *
 * ## A scan and a message are different events, and `source` is what separates them
 *
 * This route's first cut counted every inbound row as "messaged you", because the fields it
 * needed were missing from `InboundMessageResponseDto`. They exist on the API — the log was
 * unified in `cf63df6` — and reading them changes two things:
 *
 * · **`source`** is `WHATSAPP_MESSAGE` or `QR_SCAN_CONNECT`. A scan involves **no message at
 *   all**, so reporting one as "messaged you" was simply wrong, and reporting a date under
 *   that heading invited the owner to go looking for a conversation that does not exist.
 *
 * · **`resolvedOwnerId`** is the scanned card's owner, set on every `QR_SCAN_CONNECT` row.
 *   This is the **only real ownership signal on the endpoint**, and it fixes a false positive:
 *   the phone join alone attributes a scan to this caller whenever the scanner happens to sit
 *   in their registry — even when the card scanned belonged to somebody else entirely. A scan
 *   now counts only when `resolvedOwnerId` is the caller's own id. Rows failing that test are
 *   dropped outright, not counted as unknown: they are another owner's business.
 *
 * `WHATSAPP_MESSAGE` rows carry `resolvedOwnerId: null` — the API has no scan-code-in-message
 * resolution yet — so the phone join remains the only filter available for those, with the
 * imprecision that implies. That is a limit of the endpoint, recorded here rather than hidden.
 *
 * ## ⚠ What this still cannot tell you
 *
 * **Which card was scanned.** There is no `cardId` or `shareLinkId` on an inbound row;
 * `resolvedOwnerId` identifies the *owner*, not the card. So "Ada scanned one of your cards on
 * Tuesday" is supportable and "Ada scanned your Work card" is not. A per-card breakdown needs a
 * scoped, joined endpoint from the API, and must not be faked in the UI from these rows.
 *
 * Nor is the message `body` returned. The owner does not need the text to know somebody
 * reached out, WhatsApp already holds the conversation, and the fewer places a message body
 * exists the better — the same instinct as `PRODUCT.md`'s rule about field values in logs.
 */

export interface InboundConnect {
  contactId: string;
  phoneE164: string;
  /**
   * QR-scan connects by this contact against **this caller's own** cards — every one verified
   * by `resolvedOwnerId`, so none of these belongs to another owner.
   */
  scanCount: number;
  /** ISO, the most recent scan. `null` when this contact has never scanned. */
  lastScanAt: string | null;
  /** Real inbound WhatsApp messages from this number. Never includes scans. */
  messageCount: number;
  /** ISO, the most recent message. `null` when they have never written. */
  lastMessageAt: string | null;
  /** WhatsApp's own name for them, when it gave one — useful when the contact has no name. */
  profileName: string | null;
}

/**
 * A scan of one of this caller's cards by somebody who is **not** in their registry.
 *
 * ⚠ **This carries the scanner's phone number, and that is correct.** Everything else on this
 * endpoint is withheld until a contact match proves the number was already the caller's to see.
 * An owned scan needs no such proof: `resolvedOwnerId` says this person scanned *this caller's*
 * card and verified that number over WhatsApp to do it. The number is theirs by the same right
 * the resulting `ShareLink` is.
 *
 * ⚠ And it must be surfaced rather than dropped, which is the bug this type exists to fix. The
 * first cut required a contact match for scans too, on the reasoning that
 * `ContactsService.upsertFromScan` always creates one so the miss was "near-unreachable". That
 * is false in practice — an empty registry, a scan mid-flight, an owner viewing a different
 * account — and the failure mode was the worst available: `connects: []`, a page reporting no
 * activity, and a real scan visible nowhere at all.
 */
export interface UnlinkedScan {
  phoneE164: string;
  scanCount: number;
  /** ISO, the most recent scan. */
  lastScanAt: string;
  profileName: string | null;
}

export interface InboundConnectsResponse {
  connects: InboundConnect[];
  /**
   * Owned scans whose scanner is not in the registry. See {@link UnlinkedScan} — shown, never
   * silently discarded.
   */
  unlinkedScans: UnlinkedScan[];
  /**
   * Senders with no matching contact. ⚠ A count, never the numbers — see the module note.
   *
   * Counts unmatched **message** senders only. An unmatched *scan* is not an unknown number:
   * it is a known, owned event, and it leaves in `unlinkedScans` with its number attached.
   */
  unknownCount: number;
  /** True when either capture window was full, so counts are a floor rather than a total. */
  truncated: boolean;
  /**
   * ⚠ **Why the screen looks the way it does**, readable straight from the Network tab.
   *
   * An empty result has several distinct causes that are indistinguishable from `connects: []`
   * alone — the log genuinely holds no scans, or it holds scans that all belong to other
   * owners, or the registry is empty. Guessing between them meant reading source rather than a
   * response, so the response says which.
   *
   * Counts only, never identities. `scanRowsFetched` is the size of the global window this
   * caller happened to read, which is a volume figure and not anybody's data.
   */
  diagnostics: {
    /** Rows in the `QR_SCAN_CONNECT` window — every owner's, before scoping. */
    scanRowsFetched: number;
    /** Rows in the `WHATSAPP_MESSAGE` window — every owner's, before the join. */
    messageRowsFetched: number;
    /** Of those scan rows, how many named this caller as the scanned card's owner. */
    scansOwnedByYou: number;
    /** How many contacts the join had to work with. */
    contactsInRegistry: number;
  };
}

export async function GET() {
  try {
    /* Four independent reads, all needed for the join.

       ⚠ The two inbound reads are split by `source` rather than taken as one unfiltered page,
       and that is a headroom decision, not tidiness: the endpoint is a GLOBAL capture capped at
       500 rows newest-first. One combined page lets a burst of other users' WhatsApp traffic
       push this caller's scans off the end entirely — the scans would not be late, they would
       be absent, silently. Two windows means messages cannot crowd out scans. Neither call is
       ownership-scoped; the scoping is below. */
    const [scanRows, messageRows, registry, me] = await Promise.all([
      listInboundMessages({ source: "QR_SCAN_CONNECT", limit: INBOUND_MESSAGE_LIMIT }),
      listInboundMessages({ source: "WHATSAPP_MESSAGE", limit: INBOUND_MESSAGE_LIMIT }),
      contacts.listContacts(),
      auth.authMe(),
    ]);

    /* The caller's own numbers are the whole filter for messages. Anything not in here is
       discarded before it can be serialised. */
    const contactByPhone = new Map<string, ContactResponseDto>(
      registry.map((c) => [c.phoneE164, c] as const),
    );

    const byContact = new Map<string, InboundConnect>();

    /** The per-contact record, created empty on first sight so both passes can add to it. */
    function slotFor(contact: ContactResponseDto): InboundConnect {
      const existing = byContact.get(contact.id);
      if (existing !== undefined) return existing;
      const fresh: InboundConnect = {
        contactId: contact.id,
        phoneE164: contact.phoneE164,
        scanCount: 0,
        lastScanAt: null,
        messageCount: 0,
        lastMessageAt: null,
        profileName: null,
      };
      byContact.set(contact.id, fresh);
      return fresh;
    }

    /* ── pass 1: scans, scoped by `resolvedOwnerId` ────────────────────────────────────────
       The ownership test comes FIRST and is not a filter over the contact join — it is the
       thing that makes a scan this caller's at all. A row whose `resolvedOwnerId` is somebody
       else's is dropped here even when its sender sits in this caller's registry, which is the
       false positive the phone join alone produced. */
    const unlinkedByPhone = new Map<string, UnlinkedScan>();
    let scansOwnedByYou = 0;

    for (const row of scanRows) {
      if (row.resolvedOwnerId !== me.id) continue;
      scansOwnedByYou += 1;

      const contact = contactByPhone.get(row.fromPhoneE164);

      /* ⚠ NOT dropped. `ContactsService.upsertFromScan` does create a contact for a verified
         scanner, so a miss here was assumed unreachable and skipped — and that assumption is
         what made a real scan invisible whenever the registry did not contain the scanner yet
         (an empty registry being the easiest way to hit it). The row is provably this caller's
         by `resolvedOwnerId`, so it leaves with its number attached instead. */
      if (contact === undefined) {
        const existing = unlinkedByPhone.get(row.fromPhoneE164);
        if (existing === undefined) {
          unlinkedByPhone.set(row.fromPhoneE164, {
            phoneE164: row.fromPhoneE164,
            scanCount: 1,
            lastScanAt: row.receivedAt,
            profileName: row.profileName,
          });
        } else {
          existing.scanCount += 1;
          if (row.receivedAt > existing.lastScanAt) {
            existing.lastScanAt = row.receivedAt;
            existing.profileName = row.profileName ?? existing.profileName;
          }
        }
        continue;
      }

      const slot = slotFor(contact);
      slot.scanCount += 1;
      /* The API returns newest first, but that is its promise rather than ours to assume — a
         max is correct whatever order arrives. */
      if (slot.lastScanAt === null || row.receivedAt > slot.lastScanAt) {
        slot.lastScanAt = row.receivedAt;
      }
      slot.profileName ??= row.profileName;
    }

    /* ── pass 2: real messages, phone join only ────────────────────────────────────────────
       `resolvedOwnerId` is always null on these, so there is nothing better available. */
    let unknownCount = 0;
    const unknownPhones = new Set<string>();

    for (const row of messageRows) {
      const contact = contactByPhone.get(row.fromPhoneE164);
      if (contact === undefined) {
        /* Counted per distinct number, not per message — "4 numbers wrote to you" is a fact an
           owner can act on; "37 messages" from one wrong number is noise. */
        if (!unknownPhones.has(row.fromPhoneE164)) {
          unknownPhones.add(row.fromPhoneE164);
          unknownCount += 1;
        }
        continue;
      }

      const slot = slotFor(contact);
      slot.messageCount += 1;
      if (slot.lastMessageAt === null || row.receivedAt > slot.lastMessageAt) {
        slot.lastMessageAt = row.receivedAt;
        slot.profileName = row.profileName ?? slot.profileName;
      }
    }

    /** Most recent activity of either kind, for ordering only — never rendered as one date. */
    const lastActivity = (c: InboundConnect) =>
      c.lastScanAt !== null && c.lastMessageAt !== null
        ? (c.lastScanAt > c.lastMessageAt ? c.lastScanAt : c.lastMessageAt)
        : (c.lastScanAt ?? c.lastMessageAt ?? "");

    const body: InboundConnectsResponse = {
      connects: [...byContact.values()].sort((a, b) =>
        lastActivity(b).localeCompare(lastActivity(a)),
      ),
      unlinkedScans: [...unlinkedByPhone.values()].sort((a, b) =>
        b.lastScanAt.localeCompare(a.lastScanAt),
      ),
      unknownCount,
      /* Either window being full means the counts below are a floor. */
      truncated:
        scanRows.length >= INBOUND_MESSAGE_LIMIT ||
        messageRows.length >= INBOUND_MESSAGE_LIMIT,
      diagnostics: {
        scanRowsFetched: scanRows.length,
        messageRowsFetched: messageRows.length,
        scansOwnedByYou,
        contactsInRegistry: registry.length,
      },
    };

    /* `no-store`: this is per-caller data behind a session cookie. A shared cache here would
       serve one owner's connects to the next. */
    return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
  } catch (thrown) {
    if (isApiError(thrown)) {
      /* Pass the API's own status through — a 401 has to stay a 401 so the browser client's
         refresh-and-retry path can see it. */
      return NextResponse.json(
        { code: thrown.code, message: thrown.message },
        { status: thrown.status, headers: { "cache-control": "no-store" } },
      );
    }
    return NextResponse.json(
      { code: "INBOUND_UNAVAILABLE", message: "Could not read inbound activity." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
