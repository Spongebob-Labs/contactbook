# WhatsApp Contact Card Share — Architecture & Design Decisions

## Background

ContactBook lets users share their contact card with others via WhatsApp. The goal is for
the recipient to end up with the sender's contact saved natively in their phonebook — not
just a link they might ignore, but a proper "Add to Contacts" experience.

This document explains why we converged on a two-message flow after evaluating all
alternatives, and documents the constraints that ruled each approach out.

---

## The Goal

Recipient gets a WhatsApp message → one tap → contact is saved in their phonebook.

---

## Approach 1: Direct VCF Document (rejected for cold contacts)

**How it works:**  
Send the `.vcf` file as a `MediaUrl` document via Twilio.  
WhatsApp renders it as a native contact card with an "Add to Contacts" button.

**Why it's ideal:**  
One message, one tap, zero friction. The "Add to Contacts" button is built into WhatsApp —
no browser, no redirects, no instructions.

**Why it can't be used for cold contacts:**  
WhatsApp's Business Messaging policy requires **approved templates** for the first message to
any number that hasn't messaged you in the past 24 hours ("cold contacts"). Templates must
be text-only or contain image/video/PDF headers — VCF files are **not allowed** in template
headers. Attempting to send a raw VCF as a template causes a Twilio rejection at send time.

The restriction exists because WhatsApp Business doesn't want businesses spamming contacts
with unsolicited media.

**Conclusion:** Direct VCF document works perfectly _within_ a 24-hour session window but
cannot initiate contact. We need a template for the first message.

---

## Approach 2: Template with URL Button → Landing Page (abandoned as primary)

**How it works:**  
Send a `whatsapp/card` template with an image banner and a URL button. Recipient taps the
button → opens a landing page in WhatsApp's in-app browser → JavaScript attempts to trigger
a native "Save to Contacts" flow.

**What we built:**  
`/api/v1/vcards/*` — an HTML page that embeds the VCF as base64 and tries three techniques:

1. **Web Share API** — `navigator.share({ files: [vcfFile] })` opens the OS share sheet.
2. **`text/x-vcard` redirect** — navigating to a URL served with `Content-Type: text/x-vcard`
   causes Android WebView to fire an implicit `VIEW` intent to the Contacts app; iOS Safari
   recognises the UTI (`public.vcard`) and shows an import sheet.
3. **"Open in Safari" instruction** — manual fallback for iOS WhatsApp.

**Why it fails on iOS:**  
WhatsApp on iOS uses **WKWebView**, which is a locked-down in-app browser:

- `Content-Disposition: attachment` is ignored — the browser renders text files inline.
- The `<a download>` attribute is silently ignored.
- Web Share API _does_ open the share sheet, but iOS Contacts has **no Share Extension** —
  it never appears as an option in the share sheet.
- The `x-safari-https://` scheme triggers a share _modal_, not Safari navigation.
- Navigating directly to a `text/x-vcard` URL renders raw VCF text in the in-app browser.

Every technique we tried either failed silently or produced multi-step friction ("Open in
Safari → tap again → Add to Contacts"). This is not the UX we want.

**Why it works (partially) on Android:**  
Android's WebView _does_ fire an implicit `VIEW` intent for `text/x-vcard` MIME type. The
Contacts app handles the intent and opens the import screen. This path works but Android is
only part of our user base.

**Conclusion:** The landing page remains as a **fallback** (URL-button templates still exist
in the DB), but is no longer the primary contact-save mechanism. We continue to serve it for
non-WhatsApp shares and Android users who open the URL outside of the WhatsApp browser.

---

## Approach 3 (Current): Two-Message Flow (quick reply → VCF document)

**How it works:**

```
Sender's device                ContactBook API                Recipient's WhatsApp
─────────────────────────────  ──────────────────────────────  ─────────────────────────────
  POST /card-share ──────────→ dispatch cron
                                   └── Twilio template send ─→ [image card] + "Get Contact" button
                                                                           ↓  (user taps)
                               ← POST /webhooks/twilio/incoming ←──────────┘
                                   └── find VCF by phone + window
                                   └── sendVcfDocument(vcfUrl)  ─────────→ [VCF contact card]
                                                                              ↓  (user taps)
                                                                         "Add to Contacts" ✓
```

**Step-by-step:**

1. **Sender** calls `POST /api/v1/card-share` with recipient phone numbers.
2. **Dispatch cron** (`CardShareDispatchService`) picks up the `PENDING` `CardShareRecipient`
   rows and calls Twilio with the quick-reply template (`whatsapp/card` + `QUICK_REPLY` button).
3. **Recipient** receives an image card with a "Get Contact" button. Tapping it sends a
   WhatsApp message _to our number_ — this is what opens the 24-hour session window.
4. **Twilio** fires `POST /api/v1/webhooks/twilio/incoming` with the incoming message.
5. **`TwilioIncomingMessageController`** validates the signature and delegates to
   **`CardShareVcfReplyService.handleQuickReply()`**.
6. **Service** looks up the most recent `DISPATCHED` recipient for this phone number with
   `vcfSentAt IS NULL` and `sentAt` within the last 23 hours.
7. **Atomic claim**: `UPDATE … WHERE vcfSentAt IS NULL` → prevents duplicate sends if
   Twilio retries the webhook (Twilio retries on non-200 responses).
8. **`TwilioCardShareProvider.sendVcfDocument()`** posts a raw `MediaUrl` message (no
   template) to the Twilio Messages API with the GCS-hosted `.vcf` file URL.
9. **Recipient** receives a WhatsApp contact card. The "Add to Contacts" button is native —
   one tap saves the contact to the phonebook.

**Why quick-reply and not URL button:**  
WhatsApp templates enforce that buttons are either _all_ quick-reply OR _all_ URL/phone.
A quick-reply button sends a reply message to us, which:
- Opens the 24-hour session window (required to send non-template messages).
- Triggers our webhook immediately.

A URL button opens a browser — it does not open a session window and gives us no signal
to send the VCF.

**Why this approach is correct:**  
- Works identically on iOS and Android — native WhatsApp UI, no browser involved.
- No user instructions — one button tap is the entire UX.
- VCF document rendering is handled by WhatsApp's native engine, not a browser.
- Compliance — templates are required for first contact; we use one.
- Session window is guaranteed open when our webhook fires (the user just messaged us).

---

## Idempotency & Concurrency

Twilio retries webhook delivery if the endpoint returns a non-2xx status or times out (15s
default). The handler always returns `{ ok: true }` with HTTP 200 — errors inside
`handleQuickReply()` are caught and logged rather than propagated.

To prevent sending the VCF twice on a retry:

```sql
UPDATE card_share_recipients
SET    vcf_sent_at = NOW()
WHERE  id = $1
  AND  vcf_sent_at IS NULL
RETURNING id
```

If `vcf_sent_at` is already set, `count = 0` — the second invocation exits early without
calling Twilio.

---

## Template Variable Numbering

| Variable | URL-button template (`card_share_image_v2_html`) | Quick-reply template (`card_share_v3_quick_reply`) |
|----------|---------------------------------------------------|-----------------------------------------------------|
| `{{1}}`  | Sender display name                               | Sender display name                                 |
| `{{2}}`  | Card name                                         | Card name                                           |
| `{{3}}`  | Optional note (space fallback)                    | Optional note (space fallback)                      |
| `{{4}}`  | VCF object key (GCS path suffix)                  | _not used_ — VCF is looked up from the DB by phone  |

---

## Webhook Registration

After deploying, configure the incoming webhook in the Twilio console:

> **Phone Numbers → Active Numbers → [your WhatsApp number]**  
> **"A MESSAGE COMES IN"** → Webhook → HTTP POST  
> URL: `${APP_PUBLIC_URL}/api/v1/webhooks/twilio/incoming`

This is separate from the status-callback URL (registered per-message by the dispatch
service). The incoming webhook fires for _any_ inbound message — including template replies
from other flows (OTP, connection invites). `CardShareVcfReplyService` silently ignores
messages that don't match a pending card-share recipient.

---

## Failure Modes

| Failure | Behaviour |
|---------|-----------|
| Webhook fires before template is delivered | Recipient not found (no `DISPATCHED` row yet) — ignored silently |
| Recipient taps after 23-hour window | No match in `sentAt` filter — ignored silently |
| VCF send fails (Twilio error) | Logged as error; `vcfSentAt` is left set (operator can clear to retry) |
| Twilio retries the webhook | Atomic claim (`vcfSentAt IS NULL`) prevents a second VCF send |
| Multiple outstanding shares to same number | Most recent `sentAt DESC` is selected |

---

## Files

| File | Purpose |
|------|---------|
| `src/card-share/card-share-vcf-reply.service.ts` | VCF document send logic + DB lookup |
| `src/card-share/twilio-incoming-message.controller.ts` | Webhook endpoint for inbound WhatsApp |
| `src/card-share/twilio-card-share.provider.ts` | `sendVcfDocument()` added; `TWILIO_INCOMING_MESSAGE_PATH` exported |
| `prisma/migrations/20260731090000_card_share_vcf_tracking` | Adds `vcf_sent_at` + `vcf_message_sid` to `card_share_recipients` |
| `scripts/create-card-share-quickreply-template.ts` | One-shot script to create the quick-reply Twilio template |
| `src/card-share/vcard-download.controller.ts` | HTML landing page (retained as fallback for Android/non-WA) |
