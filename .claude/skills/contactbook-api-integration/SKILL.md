---
name: contactbook-api-integration
description: Full API surface reference for building apps/web against the ContactBook backend — every real route, the auth flow, the error convention, and per-resource gotchas that aren't obvious from the OpenAPI spec alone. Load this before writing any frontend code that calls the API (auth screens, profile/onboarding UI, card curation, contact management, the share flow). For the one unauthenticated public share page specifically, load contactbook-share-page instead — this skill covers everything else.
---

# ContactBook API — integration reference

This is the *narrative* layer: flows, sequencing, and gotchas that a raw OpenAPI spec doesn't
convey. For exact field-level shapes (every property, type, validation constraint, example),
the live spec is the source of truth, not this file — see "The live spec" below. This document
will drift from the code eventually; the spec can't.

## Base URLs

| Environment | URL |
| --- | --- |
| Local dev | `http://localhost:8000/api/v1` |
| Staging | `https://apistaging.getcontactbook.com/api/v1` |

Swagger UI (not versioned, sits outside `/v1`): `{base}/api/docs`. Raw spec:
`{base}/api/docs-json` — importable directly into Postman (Import → Link) or any codegen tool.

## Authentication

WhatsApp OTP — passwordless, signup and login are the same flow. No email, no password, ever.

1. `POST /auth/otp/request` `{phoneE164}` → always `202 {sent: true}`, regardless of whether
   the number has an account yet. Never reveals account existence.
2. User receives a 6-digit code over WhatsApp, types it in.
3. `POST /auth/otp/verify` `{phoneE164, code}` → `200 {accessToken}`, and *also* sets two
   httpOnly cookies (`cb_access_token`, `cb_refresh_token`).
4. `POST /auth/refresh` (no body — reads the refresh cookie) → `200 {accessToken}`, rotates the
   refresh token. Replaying an already-rotated refresh token revokes the whole session family
   (stolen-token detection) — don't call this speculatively or in parallel from multiple tabs.
5. `POST /auth/logout` → revokes the current session family.

**Use the Bearer token, not the cookies, from the web app.** The access token is returned in
the body specifically so non-cookie clients don't need to fight cross-site cookie rules — and
the web app (Vercel) and the API (`getcontactbook.com`) are genuinely cross-site. The cookies
exist and are `SameSite=None; Secure` in staging/prod so they *can* work, but Safari's ITP and
the general third-party-cookie trend make that fragile. Store the access token in memory
(**not** `localStorage` — that's readable by any injected script), send
`Authorization: Bearer <token>` on every request, and call `/auth/refresh` when a request comes
back `401` to get a new one. The refresh *cookie* still does its job in that flow — the
frontend JS never needs to read it, only the browser needs to send it automatically to that one
endpoint.

`POST /auth/me` — not a profile fetch, a token-validity check. Returns `{id, phoneE164}` only.
For actual profile data, that's `GET /profile/me` (below) — auth and profile are deliberately
separate concerns, matching the API's domain-shaped modules.

## Error handling

Every error, from every endpoint, is the same shape:

```jsonc
{
  "statusCode": 404,
  "code": "CARD_NOT_FOUND",       // stable — branch UI logic on this, never on `message`
  "message": "No card with that id.",
  "requestId": "3f9c1b7e-...",     // include this if you ever need to ask for help debugging
  "details": { ... }               // optional, present on some validation errors
}
```

`message` is for humans reading logs, not for `if (error.message === ...)` checks — it can
change wording without notice. `code` won't.

## Resources

All of these require `Authorization: Bearer <token>` and act on the caller's own data only —
there is no "fetch user X's cards" surface anywhere in this API.

### Profile — `/profile/*`
- `GET /profile/me` — the *nested* read model: `{onboardingCompleted, identity, personal,
  work[], business[], socials[], financial[]}`. This is what a profile screen renders from.
- `POST /profile/onboarding` — first-time setup. **One-shot**: `409
  ONBOARDING_ALREADY_COMPLETED` on a second call. Only `identity.firstName/lastName/
  primaryEmail` are required; everything else is optional and can be filled in later through
  the field/group endpoints instead. `identity.primaryPhone` and `identity.profilePhoto` are
  rejected outright (`forbidNonWhitelisted`) — phone is the OTP-verified identity, not a text
  input; photo goes through the dedicated upload endpoint below.
- `GET/POST/PATCH/DELETE /profile/fields[/:id]` — the flat field CRUD. `type` is immutable
  once a field is created (delete and recreate to change it — this matters for the financial
  types, since encryption keys off `type`).
- `GET/POST /profile/groups`, `PATCH/DELETE /profile/groups/:id` — repeatable structures (a
  specific job, business, bank account, social profile). Deleting a group cascades to its
  fields.
- `POST /profile/photo` (multipart, field name `file`), `DELETE /profile/photo`.

### Contacts — `/contacts/*`
- `GET/POST/PATCH /contacts[/:id]` — `POST` **upserts** on `(you, phoneE164)`, not
  create-or-409. Calling it again for a number you already have updates displayName/notes.
- `POST /contacts/import` — the actual expected way contacts enter the registry (e.g. from
  reading the device address book), not one-at-a-time. Body: `{contacts: [{phoneE164,
  displayName?}, ...]}`, max 500 per call. Returns `{created, updated}` so a client can show
  "50 new, 10 already had."

### Cards — `/cards/*`
- `GET/POST/PATCH/DELETE /cards[/:id]` — `DELETE` archives (also revokes every active
  ShareLink on that card, immediately). Every card response includes `publicUrl` — a full,
  ready-to-encode-as-a-QR URL that resolves even before the card has ever been shared with
  anyone (falls back through the same `/public/links/:token` resolver as a per-contact link).
- `PUT /cards/:id/fields` — sets the card's curated field list. **Full replace, not a delta** —
  send the entire desired set every time, including fields that aren't changing, or they get
  dropped. `PHOTO`-type fields can't be added here (they render automatically on the public
  page regardless of card curation). A real change here also writes a `CardVersion` behind the
  scenes — see `GET /cards/:id/audience` below — but the response shape is unaffected.
- `POST /cards/:id/share` `{contactId}` — mints (or reuses) the share link for this
  (card, contact) pair. `contactId` must already exist — this endpoint does not accept an
  inline phone number. Enqueues the actual WhatsApp send; the returned `url` is real and live
  either way, independent of whether the send itself succeeds.
- `GET /cards/:id/audience`, `POST /cards/:id/notify` — the "tell recipients this card changed"
  flow. Built into the Profile & Cards workspace as the **Send update** button (2026-10-03) —
  request/response shapes, the gotcha about what the `notify` response does and doesn't confirm,
  and which profile edits now move `currentVersion`: **`contactbook-card-notifications`**.
- Card appearance now persists (`templateId`/`paletteId`/`groundHex`/`finish`/`texture`/etc,
  `coverUrl`, `headline`, `bio`), `PATCH /cards/:id` has real omitted-vs-`null` semantics, and
  `POST/DELETE /cards/:id/cover` exists — plus a new single-call `GET /dashboard`. Not built into
  any FE screen yet: **`contactbook-card-appearance-dashboard`**.

### Share links — `/share-links/*`
- `GET /share-links` — every link across all your cards, flat list.
- `PATCH /share-links/:id` `{status: "REVOKED" | "ACTIVE"}` — restoring reuses the *same*
  token, never mints a new one.

### Templates — `/templates/*`
Admin-ish surface for managing the WhatsApp Content Templates that `/cards/:id/share` sends
through. Not something an end-user ever touches; likely irrelevant to end-user-facing FE work
unless you're building an internal ops screen.

### Public — no auth, separate skills
`GET /public/links/:token` and the page that calls it are covered in full by the
**`contactbook-share-page`** skill — load that instead when building `/c/[token]`. The
QR-scan "Save & connect" actions on that same page (`.../connect/otp/request`, `.../verify`) are
their own skill: **`contactbook-qr-scan-connect`**.

## The live spec

Field-level ground truth — every property, every constraint, every realistic example — lives
in the running server, not in this document:

```
GET {base}/api/docs-json
```

Re-import this into Postman (Import → Link) or feed it to a codegen tool (openapi-typescript,
orval, etc.) whenever it's been a while — this file describes shapes and flows that are stable
by convention, but the spec is what's actually true right now.

## What's not built on the backend yet

Don't build UI implying these exist:

- **Field-level diff in the notify flow.** `CardVersion.diff` is computed and stored on every
  real field edit, but neither `GET /cards/:id/audience` nor the notify message itself exposes
  it — see **`contactbook-card-notifications`** for what update notifications *do* cover (they
  exist now, as of 2026-09-02) and exactly what they don't.
- **Per-contact field visibility.** Every contact holding a link to the same card sees the
  exact same fields — no "hide this field from this one person" override yet.
- **QR scan-to-connect exists now** (as of 2026-09-08, branch `feat/qr-scan-connect`, not yet
  merged) but is opt-in, not automatic — a plain scan is still just the anonymous `CardScan`
  count it always was. `POST /public/links/:token/connect/otp/request` + `/verify` let a scanner
  deliberately prove their own phone and become a real, notifiable recipient. Full guide:
  **`contactbook-qr-scan-connect`**.
- **Per-view analytics beyond a raw count.** `ShareLink` tracks `viewCount`/`firstViewedAt`/
  `lastViewedAt` only — no event-level detail (which field got tapped, vCard downloads, etc.).
- **vCard download.** `GET /public/links/:token/vcard.vcf` is designed, not built. If you need
  a "save contact" button before it ships, construct the `.vcf` client-side from the fields
  the public endpoint already returns.
