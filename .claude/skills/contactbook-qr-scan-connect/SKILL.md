---
name: contactbook-qr-scan-connect
description: How to build the "Save & connect" flow on apps/web's public card page (/c/[slug]) — letting an anonymous QR scanner verify their own phone number and become a real, notifiable recipient, without ever creating them a ContactBook account. Load this before adding any phone/OTP UI to the public card page, or before wiring POST /public/links/:token/connect/otp/request or /verify. Backend built and verified live (including a real HMAC-signed webhook simulation) 2026-09-08 — uncommitted, on branch feat/qr-scan-connect, not yet merged. Nothing on the frontend consumes these two endpoints yet; this is the build guide, not a description of shipped FE code.
---

# QR-scan "Save & connect" — FE integration guide

## The mental model, in one paragraph

Scanning a card's QR and landing on `/c/[slug]` already works today and is unrelated to this
feature — that's just `GET /public/links/:token` rendering the card, same as it always has, and
it's covered by **`contactbook-share-page`**. What's missing is a way for the stranger looking at
that page to turn "I viewed this once" into "I'm now a real recipient this owner can notify
later." This feature is a **third, deliberate action** on that page (alongside the existing
"Save to contacts" vCard download and "Message on WhatsApp" deep link) — not something that fires
automatically on page load, and not a login. A scanner who never taps it stays exactly what they
are today: an anonymous line in the `CardScan` counter.

## The two endpoints

Both live under the card's own token — same pattern as `resolvePublic`, no auth, no cookies.
**Both are `@ApiExcludeController()`, same as the existing resolve endpoint — they will not show
up in `/api/docs`.** The shapes below are the source of truth; don't go probing a live token to
reverse-engineer them the way `public-card.ts`'s own header comment had to for the resolve call.

### `POST /public/links/:token/connect/otp/request`

```ts
// request
{ phoneE164: string }   // the SCANNER's own number, E.164 — never the card owner's

// response — 202
{ sent: true, devCode?: string }   // devCode only ever present outside production
```

Resolves the token first (so a dead/revoked link 404s/410s before anything is sent), then sends
a WhatsApp OTP to that number. Reuses the exact same rate limiting the login flow has: max 5
requests/hour per phone, 60s cooldown between requests — build your "resend code" button around
`OTP_COOLDOWN`'s `details.retryAfterSeconds` (see error table below), don't invent your own timer.

### `POST /public/links/:token/connect/otp/verify`

```ts
// request
{ phoneE164: string, code: string }   // 6 digits

// response — 200
{ connected: true }
```

On success, the scanner now has a live `ShareLink` to this card — same as if the owner had typed
their number into "share this card with" by hand. They'll also receive the standard
`send_whatsapp_card_share` WhatsApp message with their own copy of the link, shortly after (async,
via the outbox — same "don't wait for it, don't promise instant delivery" caveat
**`contactbook-card-notifications`** documents for `/notify`).

**There is no re-fetch step.** The FE already has the resolved card in memory from the page's own
`fetchPublicCard(token)` call — a successful `verify` just needs a confirmation state layered on
top of the same page, not a second card fetch.

## Error codes to branch on

Standard envelope (`{statusCode, code, message, requestId, details?}`) — branch on `code`.

| Code | HTTP | From | Meaning | Suggested UI |
| --- | --- | --- | --- | --- |
| `SHARE_LINK_NOT_FOUND` | 404 | both | token is unknown | Same "this link isn't valid" state the page already has |
| `SHARE_LINK_REVOKED` | 410 | both | owner turned this card off | Same "no longer sharing" state the page already has |
| `OTP_RATE_LIMITED` | 409 | request | 5+ requests this hour for this number | "Too many attempts, try later" — no retry-after given |
| `OTP_COOLDOWN` | 409 | request | resent too fast; `details.retryAfterSeconds` present | Disable "resend" and count down using that value |
| `OTP_NOT_FOUND` | 404 | verify | no active code (expired or never requested) | "Request a new code" |
| `OTP_INVALID` | 409 | verify | wrong code, attempt counted | "That code is incorrect" — let them retry |
| `OTP_ATTEMPTS_EXCEEDED` | 409 | verify | 5 wrong tries on this code | "Request a new code" — this one is now dead, retrying it further won't work |
| `CANNOT_CONNECT_TO_SELF` | 409 | verify | typed number matches the card owner's own phone | "You can't connect to your own card" |

## Where this fits in the existing page

`apps/web/src/app/c/[slug]/public-card-client.tsx` is the real, live client component (the other
one, `components/public-card/public-card-view.tsx`, only renders fixture data — don't build
against that one). It currently wires exactly one action, `onSaveToContacts`, into
`<PublicCardActions resolved={...} savePending={...} onSaveToContacts={...} />`. "Message on
WhatsApp" is stateless (a pure `wa.me` deep link — see `whatsapp-button.tsx`) and needs no wiring
at all. This feature is the first action on this page that needs real request/response state:

- A trigger — button, or a state the "Message on WhatsApp" action defers to — that opens a small
  flow: phone input → submit → code input → submit → success.
- Loading/pending on both submits (mirror the `savePending` pattern `useVcfDownload`/
  `useSaveToContacts` already use elsewhere in this file's sibling components).
- An error slot rendering the table above's suggested copy.
- A resend affordance gated on `OTP_COOLDOWN`'s `retryAfterSeconds`, not a client-guessed timer.
- A success state — "You're connected" or similar — that doesn't navigate away or re-fetch
  anything; the card already on screen is still correct.

## What this deliberately does not give you

- **No account, no session, no JWT.** Verifying the code (`OtpService.verifyChallenge`) proves
  phone ownership and stops there — this is not a login, don't wire cookies or a redirect to an
  authenticated screen off a successful `verify`.
- **No indication of who else has connected**, or how many times this card's QR has been
  scanned/connected — that's an owner-side, authenticated concern (if it gets built at all), not
  something this public page surfaces.
- **Connecting twice is a safe no-op, not an error** — the same scanner verifying against the
  same card a second time still returns `{connected: true}}`; there's no "already connected"
  error to special-case.

## Reference

- DTOs: `apps/api/src/sharing/dto/connect-otp-request.dto.ts`,
  `connect-otp-verify.dto.ts`, `connect-otp-request-result.dto.ts`, `connect-result.dto.ts`
- Route handler: `apps/api/src/sharing/card-connect.controller.ts`
- Business logic: `apps/api/src/sharing/card-connect.service.ts` (`requestOtp`, `verifyAndConnect`)
- Phone-verify-without-login primitive: `apps/api/src/auth/otp.service.ts` (`verifyChallenge`)
- What a connect actually creates: `ContactsService.upsertFromScan` (`source: QR_SCAN`),
  `ShareLinksService.ensureActiveLinkAndNotify` (same core `POST /cards/:id/share` uses)
- **Not yet merged** — this is all on branch `feat/qr-scan-connect`, uncommitted as of
  2026-09-08. Confirm it's landed on the branch you're building against before wiring against it.
- For the page's existing resolve call, error states, and rendering rules:
  **`contactbook-share-page`**
- For auth, the error envelope shape, and every other endpoint: **`contactbook-api-integration`**
