---
name: contactbook-card-notifications
description: How to build the "this card was updated — notify recipients" flow in apps/web's authenticated dashboard — the audience picker/banner on a card's detail screen and the send action behind it. Load this before wiring GET /cards/:id/audience or POST /cards/:id/notify, or before building any "N recipients are behind" UI. Backend shipped and verified live (including a real WhatsApp send) as of 2026-09-02; nothing on the frontend consumes these two endpoints yet — this is the build guide, not a description of shipped FE code.
---

# Card-update notifications — FE integration guide

## The mental model, in one paragraph

Editing a card's fields (`PUT /cards/:id/fields`) already propagates live to every
recipient with **zero messages sent** — that's pre-existing, unrelated to this feature. What
was missing is a way to *tell* recipients to go look. This feature adds exactly that, and only
that: an owner-triggered, explicit "notify" action. There is no automatic send anywhere in this
system — an owner can make ten edits in a row and nothing goes out until they deliberately
choose to notify someone. Build the UI to match that: a passive "N recipients are behind"
signal, not a toast or a push that fires on save.

## The two endpoints

Both live on `CardsController`, both need `Authorization: Bearer <token>`, both scoped to
cards you own (`CARD_NOT_FOUND` if not).

### `GET /cards/:id/audience`

Read-only. Call this whenever the card detail screen renders, or whenever you need to refresh
the picker after a send.

```ts
interface AudienceResponseDto {
  currentVersion: number;
  recipients: AudienceRecipientDto[];   // ACTIVE ShareLinks only
}

interface AudienceRecipientDto {
  shareLinkId: string;                  // what you send back to /notify — see below
  contactId: string;
  contactDisplayName: string | null;
  contactPhoneE164: string;
  lastNotifiedVersion: number | null;   // null only for a link that predates this feature
  versionsBehind: number;               // currentVersion - (lastNotifiedVersion ?? 0); 0 = caught up
  viewCount: number;
  lastViewedAt: string | null;
}
```

A revoked or never-shared contact simply isn't in `recipients` — you never have to filter
`status` yourself.

**Banner logic**: show the "N recipients are behind" affordance only when
`recipients.some(r => r.versionsBehind > 0)`. Don't render it — not even greyed out — when
`recipients.length === 0` or everyone's caught up; an empty-state control here is worse than no
control (same rule the QR/save-to-contacts work already follows elsewhere in this app).

### `POST /cards/:id/notify`

```ts
// request
interface NotifyCardDto {
  shareLinkIds: string[];   // max 500, must be UUIDs, each an ACTIVE link on THIS card
}

// response — 201, one entry per requested id, same order isn't guaranteed
interface NotifyResultDto {
  shareLinkId: string;
  outboxMessageId: string;
  status: 'ENQUEUED';       // this is the ONLY status value — read the warning below
}
```

`shareLinkIds` is how you specify recipients — there's no separate `contactId`/phone number
parameter. Take the `shareLinkId` straight off the `AudienceRecipientDto` you already fetched;
don't look it up again elsewhere. Any id that isn't an active link on this specific card fails
the *whole call* with `404 SHARE_LINK_NOT_FOUND` — not a partial success. Validate client-side
against the `audience` response you already have before sending, so this is unreachable in
normal use.

**Default selection**: every active recipient, not just the ones behind — mirrors how the
original share flow works (an owner can always deliberately re-notify someone already caught
up). Let the owner deselect, don't pre-filter to only `versionsBehind > 0`.

## ⚠ The response does not mean delivered — read this before wiring a success toast

`status: 'ENQUEUED'` is returned **synchronously**, before the actual WhatsApp send has even
been attempted — the send happens later, out of the request path, via the outbox/Cloud Tasks
pipeline (same infra `POST /cards/:id/share` already uses). A `201` with `ENQUEUED` tells you
the request was written to the queue; it tells you nothing about whether the message actually
reached anyone. Verified live: every one of these calls returns identical `201 ENQUEUED` whether
the send later succeeds or fails outright.

**There is no webhook, no push, no way to be told "it worked" or "it failed" in real time.** The
only way to find out is to re-fetch `GET /cards/:id/audience` after a few seconds and check
whether `versionsBehind` actually dropped to `0` for that recipient — if it didn't, the send
failed (most commonly because no Twilio-approved template exists for the environment you're
hitting — see below). Build the UI around that: show "sending…" optimistically, then reconcile
against a fresh `audience` fetch a few seconds later, rather than treating the `notify` response
itself as confirmation.

**Re-notifying about a version already notified is a safe no-op**, not a duplicate send — calling
`/notify` twice with the same `shareLinkId` while `currentVersion` hasn't changed returns the
same `outboxMessageId` both times. Fine to fire on a double-click without debouncing defensively.

## Environment note — don't assume the template exists everywhere

The actual WhatsApp send depends on a `CARD_UPDATE`-purpose `WhatsAppTemplate` being registered
*and* Twilio/Meta-approved — a real one now exists and is `APPROVED` on **staging** (verified
live, 2026-09-02: a real message reached a real phone with the wording *"Hi! {{1}} just updated
their ContactBook contact card. Tap below to see the latest details."* / button *"View updated
card"*). Whether it's present on any other environment (prod, a fresh local DB) is a separate,
per-environment fact — check `GET /templates?purpose=CARD_UPDATE` if you need to know before
building around it. Where it's missing, the send fails cleanly and invisibly to the caller (see
above) — `versionsBehind` just never reaches `0`.

## Where this fits in the existing screens

- **Card detail** (`apps/web/src/app/(app)/cards/[cardId]/card-detail-client.tsx`) is the
  natural home — it already has the `PageHeader` actions row (Edit / Share / Export PNG /
  Delete) and the "Sent to" section listing every `ShareLink` (`CardShares` in
  `apps/web/src/components/share/card-sharing.tsx`). A "Notify recipients" action belongs
  alongside the other actions; the banner belongs directly above or inside the "Sent to" list,
  since that's already documented as "the only place every link is listed."
- `CardShares`'s existing row shape (`shareLinkId`/status/viewCount/createdAt per recipient) is
  structurally the same data `audience` returns, just missing `versionsBehind`/
  `lastNotifiedVersion` — extend that shared row type rather than inventing a second one, so a
  notify picker can reuse the same list rendering the "Sent to" section already has.
- **Not the dashboard** (`dashboard-client.tsx`) — that screen is deliberately scoped to 3 stat
  tiles and has no room for a per-card affordance; don't add one there.

## What this deliberately does not give you

- **No field-level diff.** `CardVersion.diff` is computed and stored server-side (added/
  removed/changed field labels, never values) but isn't exposed on either endpoint above — the
  product decision was a generic notify message, not "Work email changed." If a future in-app
  diff view gets built, it needs a new endpoint; don't expect `audience` to grow this field
  quietly.
- **No batch progress / delivery status per recipient beyond `versionsBehind`.** There's no
  `Broadcast`/`BroadcastTarget` model — each `shareLinkId` you send is enqueued independently,
  and the only signal you get back (eventually) is whether that one recipient's
  `lastNotifiedVersion` caught up.
- **No automatic trigger on save.** Don't wire `PUT /cards/:id/fields`'s response to imply a
  notify happened — it never does, by design (see the mental model above).

## Reference

- DTOs: `apps/api/src/sharing/dto/audience-response.dto.ts`,
  `audience-recipient.dto.ts`, `notify-card.dto.ts`, `notify-result.dto.ts`
- Route handlers: `apps/api/src/sharing/cards.controller.ts` (`getAudience`, `notify`)
- Business logic: `apps/api/src/sharing/cards.service.ts` (`getAudience`, `notify`),
  `apps/api/src/sharing/sharing.module.ts` (the `send_whatsapp_card_update` outbox handler —
  this is where a send actually happens, asynchronously, and where `lastNotifiedVersion` gets
  bumped only on confirmed success)
- Diff computation (server-side only, not exposed): `apps/api/src/sharing/card-version-diff.util.ts`
- For auth, the error envelope shape, and every other endpoint: **`contactbook-api-integration`**
