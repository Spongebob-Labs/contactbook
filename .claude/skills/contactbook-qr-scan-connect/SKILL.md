---
name: contactbook-qr-scan-connect
description: How to build the "Save & connect" flow on apps/web's public card page (/c/[slug]) — letting an anonymous QR scanner become a real, notifiable recipient, without ever creating them a ContactBook account. Covers two paths — OTP-verified (POST .../connect/otp/request+verify) and the zero-verification "send to my phone" variant (POST .../connect/send) — load this before adding either. Both are merged on refac-new-build as of 2026-09-22. Nothing on the frontend consumes any of these three endpoints yet; this is the build guide, not a description of shipped FE code.
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

There are **two independent paths** to that same outcome, and they are not steps in one flow —
pick one UI, don't chain them:

1. **OTP-verified** (`otp/request` + `otp/verify`) — scanner types their number, gets a WhatsApp
   code, types it back. Proof of ownership before anything is sent.
2. **"Send to my phone"** (`send`) — scanner types their number, taps submit, done. No code, no
   proof — the number typed is trusted as-is. A deliberate zero-friction product choice, not a
   shortened version of path 1. Build whichever one product wants live; don't offer both on the
   same page unless that's an explicit, considered decision — a `CANNOT_CONNECT_TO_SELF` on one
   path and a success on the other for the same number would be a confusing thing to expose to
   the same user in the same session.

## The two OTP endpoints

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

## The zero-verification endpoint

### `POST /public/links/:token/connect/send`

```ts
// request
{ phoneE164: string }   // the SCANNER's own number, E.164 — never the card owner's,
                         // and NOT proven to be theirs — see below

// response — 200
{ connected: true }
```

One call, no round trip. Resolves the token first (same 404/410 posture as every other endpoint
on this controller), then immediately connects — same underlying effect as a successful
`otp/verify`: a live `ShareLink` is created/activated, and the scanner gets the standard
`send_whatsapp_card_share` WhatsApp message shortly after (async, via the outbox — same caveat as
above). The only difference from path 1 is what's skipped: no OTP request, no code, no proof.

**There is nothing to retry or resend here** — a single phone input and a single submit button is
the whole UI. Don't build a "resend code" affordance or a two-step form for this path; that's
path 1's UI, not this one's. If product wants a copy hint on this screen, something like "we'll
message this number on WhatsApp right away" is more honest than implying any verification step,
since none happens.

## Error codes to branch on

Standard envelope (`{statusCode, code, message, requestId, details?}`) — branch on `code`.

| Code | HTTP | From | Meaning | Suggested UI |
| --- | --- | --- | --- | --- |
| `SHARE_LINK_NOT_FOUND` | 404 | all three | token is unknown | Same "this link isn't valid" state the page already has |
| `SHARE_LINK_REVOKED` | 410 | all three | owner turned this card off | Same "no longer sharing" state the page already has |
| `OTP_RATE_LIMITED` | 409 | request | 5+ requests this hour for this number | "Too many attempts, try later" — no retry-after given |
| `OTP_COOLDOWN` | 409 | request | resent too fast; `details.retryAfterSeconds` present | Disable "resend" and count down using that value |
| `OTP_NOT_FOUND` | 404 | verify | no active code (expired or never requested) | "Request a new code" |
| `OTP_INVALID` | 409 | verify | wrong code, attempt counted | "That code is incorrect" — let them retry |
| `OTP_ATTEMPTS_EXCEEDED` | 409 | verify | 5 wrong tries on this code | "Request a new code" — this one is now dead, retrying it further won't work |
| `CANNOT_CONNECT_TO_SELF` | 409 | verify, send | typed number matches the card owner's own phone | "You can't connect to your own card" |

`send` only ever produces `SHARE_LINK_NOT_FOUND`, `SHARE_LINK_REVOKED`, `CANNOT_CONNECT_TO_SELF`,
or standard validation errors on a malformed `phoneE164` — none of the OTP-specific codes apply to
it, since it never touches `OtpService`.

## Where this fits in the existing page

`apps/web/src/app/c/[slug]/public-card-client.tsx` is the real, live client component (the other
one, `components/public-card/public-card-view.tsx`, only renders fixture data — don't build
against that one). It currently wires exactly one action, `onSaveToContacts`, into
`<PublicCardActions resolved={...} savePending={...} onSaveToContacts={...} />`. "Message on
WhatsApp" is stateless (a pure `wa.me` deep link — see `whatsapp-button.tsx`) and needs no wiring
at all. This feature is the first action on this page that needs real request/response state.

**If building path 1 (OTP-verified):**

- A trigger — button, or a state the "Message on WhatsApp" action defers to — that opens a small
  flow: phone input → submit → code input → submit → success.
- Loading/pending on both submits (mirror the `savePending` pattern `useVcfDownload`/
  `useSaveToContacts` already use elsewhere in this file's sibling components).
- An error slot rendering the error table's suggested copy.
- A resend affordance gated on `OTP_COOLDOWN`'s `retryAfterSeconds`, not a client-guessed timer.
- A success state — "You're connected" or similar — that doesn't navigate away or re-fetch
  anything; the card already on screen is still correct.

**If building path 2 ("send to my phone"):** the same trigger pattern, but the flow collapses to
phone input → submit → success — no code step, no resend affordance, one pending state instead of
two. Everything else (error slot, success state, no re-fetch) is identical to path 1.

Build the UI for whichever path (or both, deliberately) product has decided on — don't default to
building both just because both exist on the backend.

## What this deliberately does not give you

- **No account, no session, no JWT, on either path.** OTP verification
  (`OtpService.verifyChallenge`) proves phone ownership and stops there; `send` doesn't even do
  that much. Neither is a login — don't wire cookies or a redirect to an authenticated screen off
  a successful `verify` or `send`.
- **No indication of who else has connected**, or how many times this card's QR has been
  scanned/connected — that's an owner-side, authenticated concern (if it gets built at all), not
  something this public page surfaces.
- **Connecting twice is a safe no-op, not an error**, on both paths — the same scanner connecting
  against the same card a second time still returns `{connected: true}`; there's no "already
  connected" error to special-case.
- **`send` gives you no proof of anything.** Nothing stops a scanner from typing a stranger's
  number instead of their own — that's the explicit, accepted tradeoff of this path, not a bug to
  work around on the frontend. Don't add client-side "confirm this is your number" copy that
  implies a guarantee the backend doesn't provide.

## Reference

- DTOs: `apps/api/src/sharing/dto/connect-otp-request.dto.ts`, `connect-otp-verify.dto.ts`,
  `connect-otp-request-result.dto.ts`, `connect-result.dto.ts`, `connect-send.dto.ts` (path 2)
- Route handler: `apps/api/src/sharing/card-connect.controller.ts` — `otp/request`, `otp/verify`,
  `send`, all on the same controller
- Business logic: `apps/api/src/sharing/card-connect.service.ts` — `requestOtp`,
  `verifyAndConnect` (path 1), `connectViaSend` (path 2); both paths share a private `connect()`
  that does the actual Contact/ShareLink/log work, parameterized by an `InboundMessageSource` of
  `QR_SCAN_CONNECT` (path 1) or `SEND_TO_PHONE` (path 2) — this only matters for the backend's own
  trust-record log, it has no effect on the response shape either path returns
- Phone-verify-without-login primitive (path 1 only): `apps/api/src/auth/otp.service.ts`
  (`verifyChallenge`) — path 2 never calls into this
- What a connect actually creates, on either path: `ContactsService.upsertFromScan`
  (`source: QR_SCAN`), `ShareLinksService.ensureActiveLinkAndNotify` (same core
  `POST /cards/:id/share` uses)
- **Both paths are merged on `refac-new-build`** as of 2026-09-22 (path 1 landed earlier; path 2,
  commit `207c3ca`, most recently). Confirm your branch has caught up if it was cut before then.
- For the page's existing resolve call, error states, and rendering rules:
  **`contactbook-share-page`**
- For auth, the error envelope shape, and every other endpoint: **`contactbook-api-integration`**
