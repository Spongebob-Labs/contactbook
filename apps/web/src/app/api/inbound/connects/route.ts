import { NextResponse } from "next/server";

import { contacts } from "@/lib/api";
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
 * ## ⚠ What this deliberately cannot tell you
 *
 * There is no `cardId`, `shareLinkId` or `userId` on an inbound row. So this route can say
 * *"this contact has written to you, N times, most recently on …"* and it **cannot** say which
 * card they scanned, or that a scan is what caused it. A "who scanned which card" feature needs
 * a scoped, joined endpoint from the API; this is not a substitute for one and must not be
 * dressed up as one in the UI.
 *
 * Nor is the message `body` returned. The owner does not need the text to know somebody
 * reached out, WhatsApp already holds the conversation, and the fewer places a message body
 * exists the better — the same instinct as `PRODUCT.md`'s rule about field values in logs.
 */

export interface InboundConnect {
  contactId: string;
  phoneE164: string;
  /** How many messages that number has sent, within the capture window. */
  messageCount: number;
  /** ISO. The most recent one. */
  lastReceivedAt: string;
  /** WhatsApp's own name for them, when it gave one — useful when the contact has no name. */
  profileName: string | null;
}

export interface InboundConnectsResponse {
  connects: InboundConnect[];
  /**
   * Senders with no matching contact. ⚠ A count, never the numbers — see the module note.
   */
  unknownCount: number;
  /** True when the capture window was full, so counts are a floor rather than a total. */
  truncated: boolean;
}

export async function GET() {
  try {
    /* Concurrent: independent reads, and the join needs both. */
    const [messages, registry] = await Promise.all([
      listInboundMessages({ limit: INBOUND_MESSAGE_LIMIT }),
      contacts.listContacts(),
    ]);

    /* The caller's own numbers are the whole filter. Anything not in here is discarded before
       it can be serialised. */
    const contactByPhone = new Map<string, ContactResponseDto>(
      registry.map((c) => [c.phoneE164, c] as const),
    );

    const byContact = new Map<string, InboundConnect>();
    let unknownCount = 0;
    const unknownPhones = new Set<string>();

    for (const message of messages) {
      const contact = contactByPhone.get(message.fromPhoneE164);
      if (contact === undefined) {
        /* Counted per distinct number, not per message — "4 numbers wrote to you" is a fact an
           owner can act on; "37 messages" from one wrong number is noise. */
        if (!unknownPhones.has(message.fromPhoneE164)) {
          unknownPhones.add(message.fromPhoneE164);
          unknownCount += 1;
        }
        continue;
      }

      const existing = byContact.get(contact.id);
      if (existing === undefined) {
        byContact.set(contact.id, {
          contactId: contact.id,
          phoneE164: contact.phoneE164,
          messageCount: 1,
          lastReceivedAt: message.receivedAt,
          profileName: message.profileName,
        });
        continue;
      }

      existing.messageCount += 1;
      /* The API returns newest first, but that is its promise rather than ours to assume — a
         max is correct whatever order arrives. */
      if (message.receivedAt > existing.lastReceivedAt) {
        existing.lastReceivedAt = message.receivedAt;
        existing.profileName = message.profileName ?? existing.profileName;
      }
    }

    const body: InboundConnectsResponse = {
      connects: [...byContact.values()].sort((a, b) =>
        b.lastReceivedAt.localeCompare(a.lastReceivedAt),
      ),
      unknownCount,
      truncated: messages.length >= INBOUND_MESSAGE_LIMIT,
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
