---
name: contactbook-apple-wallet-pass
description: Backend build guide for "Add to Apple Wallet" — generating a signed .pkpass for a card (QR code = the card's live share link), the owner download endpoint, Apple's PassKit web service (device registration, update polling, pass refresh), APNs push on card change, the Prisma model, env/secret wiring and tests. Load this before creating any `wallet/` module in apps/api, touching Apple Developer certificates or Pass Type IDs, or wiring the dashboard's Add to Apple Wallet button. Status as of 2026-10-02: nothing is built — apps/api has no wallet module; this is the build guide, not a description of shipped code.
---

# Apple Wallet pass — backend integration guide

## What we're building, in one paragraph

On the dashboard an owner taps **Add to Apple Wallet** on a card. The API builds a small signed
file (`.pkpass`) containing the owner's name, the card's headline and a **QR code that encodes
the card's `publicUrl`** (`${SHARE_BASE_URL}/c/<publicToken>`). iOS opens its "Add" sheet; the pass
lands in Wallet; the owner shows the QR to anyone, whose phone opens the **live** card page.
Because the QR is only a link, the page keeps resolving from current data (invariant #2) and
revoking/archiving still works. The pass itself carries **no contact-field values** — see
"Pass content".

## Decisions locked for v1 (change only with the maintainer)

| Decision | Choice | Why |
|---|---|---|
| Pass style | `generic` | Closest to a business card; no event/boarding semantics. |
| One pass per | **card** (`serialNumber = card.id`) | Re-adding the same card replaces the pass instead of duplicating it. |
| QR payload | `card.publicToken` URL (`publicUrl`), format `PKBarcodeFormatQR` | Stable, never tied to one contact, already what the dashboard QR encodes. |
| Front of pass | Owner name, headline, card name. **No field values.** | Invariants #5 / #6 and "nothing from a snapshot": a pass is a copy on a phone. |
| Updates | Implement Apple's web service + APNs push | Without it the pass goes stale; with it name/headline/colour edits and archive propagate. |
| Platform | Apple Wallet only | Google Wallet is a separate integration (own issuer account + service-account JSON). |

⚠ "Double-tap the side button" does **not** reliably surface a normal pass — Wallet only shows
passes there when `relevantDate`/`locations` match. The dependable path is Wallet app → tap the
pass. Do not promise double-tap to the client.

## The flow

```
ADD (owner action)
 Dashboard button ──► web proxy /api/cb/cards/:id/wallet-pass ──► GET /api/v1/cards/:id/wallet-pass
                                                                   │ own the card? (JWT)  else 404 CARD_NOT_FOUND
                                                                   │ build pass.json + images
                                                                   │ manifest.json (SHA-1 of every file)
                                                                   │ signature (PKCS#7, signer cert + WWDR)
                                                                   ▼
                                       200  Content-Type: application/vnd.apple.pkpass
 iOS Safari ◄───────────────────────────────────────────────────────┘ → "Add to Wallet" sheet

REGISTER (automatic, device → API, because pass.json has webServiceURL)
 iPhone ──► POST /api/wallet/v1/devices/{device}/registrations/{passTypeId}/{serial}   {pushToken}
            stores (device, pushToken, card)

UPDATE (owner edits name/headline/appearance, or archives the card)
 domain change ─► OutboxMessage kind=wallet_push (same transaction) ─► handler
   handler: for each registration of that card → APNs HTTP/2 push (empty payload)
 iPhone  ──► GET  /api/wallet/v1/devices/{device}/registrations/{passTypeId}?passesUpdatedSince=<tag>
         ◄── 200 {serialNumbers:[card.id], lastUpdated:"<tag>"}   (or 204)
 iPhone  ──► GET  /api/wallet/v1/passes/{passTypeId}/{serial}      Authorization: ApplePass <token>
         ◄── 200 fresh .pkpass (or 304 on If-Modified-Since)
```

## Prerequisites from the client (blockers — start these first)

The developer never needs the client's Apple login. What we need handed over:

| # | Item | Form |
|---|---|---|
| 1 | Apple Developer Program membership (paid; companies need a D-U-N-S, can take weeks) | — |
| 2 | **Team ID** (developer.apple.com/account → Membership details) | 10-char string |
| 3 | **Pass Type ID** registered by them: Certificates, Identifiers & Profiles → Identifiers → **+** → Pass Type IDs, `pass.com.<client>.contactbook` (cannot be renamed or reused) | string |
| 4 | **Signing certificate** (`.cer`) created from **our** CSR (below) | file |
| 5 | Organisation display name (any string — not looked up by Apple) | string |
| 6 | Brand assets: `icon.png` 29×29, `icon@2x.png` 58×58, `icon@3x.png` 87×87 (**required**; no icon = pass will not install), `logo.png` ~160×50 and `logo@2x.png` | transparent PNGs |
| 7 | Decision: which fields (if any) may ever appear on the pass | confirmation |

Do not wait for 1–4 to start building: use **your own** paid developer account/Pass Type ID in
dev. Moving to the client's is a config swap (Team ID, Pass Type ID, cert), not a rewrite — but
passes signed in dev show *your* team as issuer and can't be migrated.

### Generate the CSR (keep the key out of git)

```bash
mkdir -p ~/wallet-certs && cd ~/wallet-certs          # outside the repo
openssl genrsa -out passkey.pem 2048
openssl req -new -key passkey.pem -out pass.csr \
  -subj "/emailAddress=<team email>/CN=ContactBook Pass/C=IN"
# send pass.csr → client uploads it on their Pass Type ID → Create Certificate → downloads pass.cer
openssl x509 -inform DER -in pass.cer -out pass.pem
```

You now hold `passkey.pem` (private key) + `pass.pem` (cert) and need Apple's public **WWDR G4**
intermediate cert (convert to PEM the same way). Lose the key and the cert is useless — back it up.
The signing certificate **expires after one year**; put a renewal reminder somewhere real. When it
lapses new passes cannot be signed and APNs pushes fail.

Never commit any `.pem`/`.p12`/`.cer`. `git show 761c3f5:` is a reminder of what committed
credentials cost in this repo.

## Where the code goes (follow the repo's conventions)

New domain-shaped module `apps/api/src/wallet/` (not layer-shaped), registered in
`app.module.ts`. Same shape as `sharing/`:

```
apps/api/src/wallet/
  wallet.module.ts                 # imports PrismaModule, OutboxModule, AppConfigModule; registers the outbox handler in onModuleInit like sharing.module.ts
  wallet-pass.controller.ts        # owner-facing, JwtAuthGuard, Swagger-documented
  wallet-web-service.controller.ts # Apple-facing, @ApiExcludeController(), no JWT
  wallet-pass.service.ts           # orchestration: ownership check, build, registrations
  pass-builder.ts                  # pure: card+owner → Buffer (.pkpass). No Prisma inside.
  pass-colors.util.ts              # palette/groundHex → rgb(), contrast-safe fg/label
  pass-auth.util.ts                # HMAC authenticationToken derive/verify
  apns-client.ts                   # HTTP/2 push, cert-auth
  assets/                          # icon*.png, logo*.png (committed; brand assets are not secret)
  dto/
```

Conventions that apply (CLAUDE.md): Prisma types stop at the repository boundary (controllers
return DTOs); `process.env` only through the zod config module; errors via `ApiError` with stable
codes; log dotted event names with structured fields (`wallet.pass_issued`, `wallet.push_failed`),
**never field values**, phones via `maskPhone()`.

## Data model

One new table. No `WalletPass` table is needed — the pass is a pure function of card + owner, and
the auth token is derived (HMAC), not stored.

```prisma
/// One Apple device that has added one card's pass. Created by Apple's
/// registration call, deleted by its unregister call or when APNs says the
/// token is dead. pushToken is a device credential — never logged.
model WalletRegistration {
  id                  String   @id @default(uuid())
  cardId              String
  card                Card     @relation(fields: [cardId], references: [id], onDelete: Cascade)
  deviceLibraryId     String   // Apple's per-device id, opaque
  pushToken           String
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@unique([deviceLibraryId, cardId])
  @@index([cardId])
  @@map("wallet_registrations")
}
```

Add `walletRegistrations WalletRegistration[]` to `Card`. Migration via `pnpm prisma:migrate`
(uses `DIRECT_URL`, never the pooler).

`authenticationToken = base64url(HMAC-SHA256(WALLET_AUTH_SECRET, serialNumber))`, ≥16 chars, put in
`pass.json`; Apple sends it back as `Authorization: ApplePass <token>`. Verify with
`crypto.timingSafeEqual`. Rotating `WALLET_AUTH_SECRET` strands every installed pass — treat it as
non-rotatable once passes ship.

## Endpoints to create

### A. Owner-facing — `WalletPassController` (Swagger-documented, `JwtAuthGuard`)

| Method + path | Purpose | Responses |
|---|---|---|
| `GET /api/v1/cards/:id/wallet-pass` | Build and return the signed pass for a card the caller owns. | `200` `application/vnd.apple.pkpass` + `Content-Disposition: attachment; filename="<card-slug>.pkpass"`; `404 CARD_NOT_FOUND` (not yours **or** archived); `409 WALLET_NOT_CONFIGURED`; `401` |

⚠ `CardsService.findOwned` filters on `{id, userId}` only — it **returns archived cards**. The
wallet service must check `row.archivedAt !== null` itself and throw `CARD_NOT_FOUND`; don't assume
the lookup does it. (Apple's `GET /v1/passes/...` is the opposite on purpose: archived → `voided` pass.)

Every distinct status gets an `@ApiResponse`; failures reference `ApiErrorResponseDto`;
`@ApiOperation` describes behaviour (what is in the pass, that the QR is the live link), not the
route name. Put `Cache-Control: no-store`.

### B. Apple-facing — `WalletWebServiceController` (`@ApiExcludeController()`, no JWT)

⚠ **Route mounting is the #1 trap.** Apple builds URLs as `${webServiceURL}/v1/...`. Our global
prefix is `api` with URI versioning defaulting to `1`, so a normal controller lands at
`/api/v1/wallet/...`. Declare it **version-neutral** so the base is `/api/wallet`:

```ts
@ApiExcludeController()
@Controller({ path: 'wallet', version: VERSION_NEUTRAL })   // → /api/wallet/v1/...  (the `v1` is literal, in each @Get/@Post path)
export class WalletWebServiceController { … }
```

and set `webServiceURL = ${WALLET_WEB_SERVICE_URL}` = `https://<api-host>/api/wallet`.
⚠ **Not** `SHARE_BASE_URL` — that is the *web* domain. Must be public HTTPS reachable from
Apple's devices (Caddy on the VM already terminates TLS).

| Method + path (under `/api/wallet`) | Auth | Behaviour | Responses |
|---|---|---|---|
| `POST /v1/devices/:deviceId/registrations/:passTypeId/:serial` body `{pushToken}` | `ApplePass <token>` | Verify `passTypeId` matches config, token matches `serial`, card exists. Upsert `WalletRegistration`. | `201` new, `200` already registered, `401` bad token |
| `DELETE /v1/devices/:deviceId/registrations/:passTypeId/:serial` | `ApplePass <token>` | Remove the registration (idempotent). | `200`, `401` |
| `GET /v1/devices/:deviceId/registrations/:passTypeId?passesUpdatedSince=<tag>` | none (Apple sends none) | Cards this device registered whose `lastUpdated` tag is newer than `tag`. Body `{serialNumbers:[…], lastUpdated:"<tag>"}`. | `200`, `204` nothing new/none registered |
| `GET /v1/passes/:passTypeId/:serial` | `ApplePass <token>` | Rebuild the pass **from current data**. Honour `If-Modified-Since` → `304`. Set `Last-Modified`. If the card is archived, return the pass with `"voided": true` (do not 404 — Wallet should grey it out). | `200`, `304`, `401`, `404` |
| `POST /v1/log` body `{logs:[string]}` | none | Apple devices report pass errors. Log `wallet.device_log` with the strings (they contain no card data). | `200` |

`lastUpdated` tag = `max(card.updatedAt, owner.updatedAt)` as epoch-ms string. Keep it
monotonic and opaque. `Cache-Control: no-store` on all of them.

No other endpoints are needed. There is deliberately **no** "list passes" or "delete pass"
endpoint: a pass is removed by the user in Wallet, which triggers Apple's `DELETE` above.

## Pass content (`pass-builder.ts`)

```jsonc
{
  "formatVersion": 1,
  "passTypeIdentifier": "<WALLET_PASS_TYPE_ID>",
  "teamIdentifier": "<WALLET_TEAM_ID>",
  "organizationName": "<WALLET_ORG_NAME>",
  "description": "ContactBook digital card",
  "serialNumber": "<card.id>",
  "authenticationToken": "<hmac>",
  "webServiceURL": "<WALLET_WEB_SERVICE_URL>",
  "logoText": "<card.name>",
  "backgroundColor": "rgb(r,g,b)", "foregroundColor": "rgb(…)", "labelColor": "rgb(…)",
  "barcodes": [{ "format": "PKBarcodeFormatQR", "message": "<card.publicUrl>",
                 "messageEncoding": "iso-8859-1", "altText": "Scan to open card" }],
  "generic": {
    "primaryFields":   [{ "key": "name",     "label": "NAME",  "value": "<first last>" }],
    "secondaryFields": [{ "key": "headline", "label": "TITLE", "value": "<card.headline ?? ''>" }],
    "backFields":      [{ "key": "link", "label": "Card link", "value": "<card.publicUrl>" }]
  }
  // + "voided": true  when card.archivedAt != null
}
```

- **Zip contents:** `pass.json`, `manifest.json` (`{ "<file>": "<sha1 hex>" }` for every file),
  `signature` (detached PKCS#7 of the manifest, signed with signer cert/key, WWDR chain),
  `icon*.png`, `logo*.png`. A missing/ wrong hash silently fails to install. Use
  `passkit-generator` (verify the installed major's API — it has changed across versions) rather
  than hand-rolling the signing.
- **Colours:** `groundHex` if set → else palette id → else the template default (same precedence
  as web's `card-palette.ts`; the API has no palette→hex table, so add one in
  `pass-colors.util.ts` and note it mirrors `apps/web/src/card/template-palettes.ts`). Compute
  `foregroundColor`/`labelColor` from luminance so text meets WCAG contrast on that ground — an
  unreadable pass is a client-visible bug. Pass colours must be `rgb(r, g, b)`.
- **Name** = `[user.firstName, user.lastName].filter(Boolean).join(' ')`, same as
  `assemblePublicCard`. **Headline** = `card.headline`.
- **Never** put `ProfileField.value`, anything from `BANK_ACCOUNT`/`DIGITAL_WALLET`/`CRYPTO_WALLET`,
  or `phoneE164` on the pass in v1. If the client later wants phone/email on the pass: read through
  the same path as `assemblePublicCard` (archived-field filter, `decryptFieldValueForRead`, financial
  types masked), restrict to a type allow-list, treat it as a **separate spec change**, and accept
  that revoking a field then needs a push to take effect.
- The QR must be the card's `publicToken` URL (not a per-contact `ShareLink` token), so revoking
  one recipient never kills the owner's own pass.

## Keeping the pass fresh (push)

Triggers → enqueue, never push inline in a request handler (invariant #3 applies in spirit: APNs is
an outbound side effect, so it uses the same outbox):

| Event | Where | Why the pass changes |
|---|---|---|
| `PATCH /cards/:id` changes name/headline/palette/ground | `CardsService.update` | colours, `logoText`, headline |
| `DELETE /cards/:id` (archive) | `CardsService.archive` | `voided: true` |
| Owner's first/last name changes | profile name update | primary field |

Write an `OutboxMessage` `kind: 'wallet_push'`, `dedupeKey: wallet-push:<cardId>:<card.updatedAt ms>`,
`payload: {cardId}` **in the same transaction** as the change; register the handler in
`WalletModule.onModuleInit` via `TaskHandlerRegistry.register('wallet_push', …)` (one handler per
kind — duplicates throw). Handler: load registrations → `apns-client` →
`POST https://api.push.apple.com/3/device/<pushToken>` over HTTP/2, TLS client cert =
signer cert/key, header `apns-topic: <passTypeId>`, body `{}`. On `410`/`BadDeviceToken` delete that
registration. Use `node:http2`; don't add a dependency for one call. Failures throw so the outbox
retries; never include `pushToken` in a log line. No `@Cron` is needed (so no advisory lock) — if one
is ever added for sweeping dead registrations, invariant #4 applies.

## Config (`env.schema.ts` + secrets)

```
WALLET_PASS_TYPE_ID=pass.com.<client>.contactbook
WALLET_TEAM_ID=<10 chars>
WALLET_ORG_NAME=<display name>
WALLET_WEB_SERVICE_URL=https://<api-host>/api/wallet
WALLET_SIGNER_CERT_B64=<base64 of pass.pem>
WALLET_SIGNER_KEY_B64=<base64 of passkey.pem>
WALLET_SIGNER_KEY_PASSPHRASE=<only if the key is encrypted>
WALLET_WWDR_CERT_B64=<base64 of WWDR G4 pem>
WALLET_AUTH_SECRET=<≥32 random chars>
```

- **All optional, all-or-none.** Do **not** add them to `REQUIRED_IN_PRODUCTION`: that would block
  every deploy until the client hands over the certificate. Instead add a `superRefine` rule —
  if any `WALLET_*` var is set, all required ones must be, or the boot fails. If none are set the
  feature is off and the owner endpoint returns `409 WALLET_NOT_CONFIGURED` (same pattern as
  `PHOTO_STORAGE_NOT_CONFIGURED`). Expose via `AppConfigService.wallet` (undefined when off).
- Base64 because GitHub secrets mangle multi-line PEMs. Decode once at module init and fail fast
  on a bad cert.
- Add every var as a GitHub Actions secret in the `staging` environment, to the env block in
  `.github/workflows/deploy.yml` ("Render .env from secrets") **and** to
  `scripts/render-api-env.sh`. Forgetting the script means the secret exists but never reaches
  the VM.

## Error codes

| Code | Status | When |
|---|---|---|
| `CARD_NOT_FOUND` | 404 | Card isn't the caller's, or is archived — the archived check is the wallet service's own (existing code — reuse) |
| `WALLET_NOT_CONFIGURED` | 409 | `WALLET_*` env absent; feature off |
| `WALLET_ASSETS_MISSING` | 500 | `assets/` lacks the required icon files (also assert at boot) |

Apple-facing endpoints return bare statuses per Apple's spec; they don't use the JSON error
envelope. The global `APP_FILTER` still runs on them — make sure a `401` there is not rewritten
into something Apple can't parse (test it).

## Tests (merge gate — `--passWithNoTests` is banned)

- `pass-builder.spec.ts`: zip contains every required file; `manifest.json` hashes match; signature
  verifies (`openssl smime -verify -inform DER -in signature -content manifest.json -noverify` against
  a test cert generated in the spec — never a real one); barcode `message` equals `publicUrl`;
  `voided` set for archived; **assert no `ProfileField.value` string appears anywhere in the output**.
- `pass-colors.util.spec.ts`: groundHex beats palette beats template; contrast ≥ 4.5:1 for every
  palette id.
- `wallet-pass.service.spec.ts`: register `201` then `200` on repeat; bad token → `401`; wrong
  `passTypeId` → `401`; `passesUpdatedSince` returns `204` when nothing newer; `304` on
  `If-Modified-Since`; unregister is idempotent.
- Outbox: `wallet_push` row is written in the **same** transaction as the card update (rollback
  test); a `410` from a stubbed APNs deletes the registration.
- e2e (`test/app.e2e-spec.ts` style): `GET /cards/:id/wallet-pass` returns the pkpass content type for
  the owner and `404` for another user; `409 WALLET_NOT_CONFIGURED` with env unset.
- `env.schema.spec.ts`: partial `WALLET_*` config fails the boot; none passes.

**Manual proof the tests can't give:** a real iPhone. Simulator can add a pass (drag the `.pkpass`
onto it) but **push updates only work on a real device** and only against a public HTTPS
`webServiceURL` — local dev can't receive Apple's callbacks (use staging or a tunnel).

## Frontend handoff (small, but the proxy matters)

- Show the button **only on iOS** (`/iPhone|iPad/` UA); Android/desktop gets nothing (or a later
  Google Wallet button). Use Apple's official "Add to Apple Wallet" badge per their guidelines.
- `apps/web` never calls the API from the browser — everything goes through the proxy at
  `/api/cb/[...path]`, which owns the session cookies. So the button is a **top-level navigation**
  (`window.location.assign('/api/cb/cards/<id>/wallet-pass')` or an `<a href>`), not `fetch`+blob:
  iOS Safari must receive the response with `Content-Type: application/vnd.apple.pkpass` itself to
  open the Add sheet. **Verify** the proxy forwards the upstream `Content-Type` and
  `Content-Disposition` (it returns the API's bytes unchanged; headers weren't checked when this
  skill was written).
- The Apple web service (`/api/wallet/...`) is **not** behind the web proxy — Apple's devices call
  the API host directly.
- Surface `409 WALLET_NOT_CONFIGURED` as "not available yet", not an error toast.

## Build order (ship and verify one stage at a time)

1. **Pass only** — config, `pass-builder`, owner endpoint, button. Proof: add a pass on a real
   iPhone, scan its QR, the live page opens. (No registration/push yet; passes work, just don't
   auto-update.)
2. **Web service** — Prisma model + migration, the five Apple endpoints, `webServiceURL` in the pass.
   Proof: add a pass, edit the card headline, pull-to-refresh the pass back → new headline.
3. **Push** — `wallet_push` outbox kind + APNs client + triggers. Proof: edit headline, pass updates
   without opening it.
4. **Hardening** — archive → voided, 410 cleanup, cert-expiry reminder, Swagger pass.

## Gotchas

- Signature/manifest/missing-icon failures are **silent** on the device ("Safari cannot download
  this file"). Inspect the zip and re-verify the signature before blaming the network.
- `serialNumber` must be a string and stable; `authenticationToken` must be ≥16 chars.
- The pass cert, not an APNs key, authenticates pushes — it is the same cert that signs the pass.
- Apple caches by `Last-Modified`; a wrong `lastUpdated` tag means silently stale passes.
- A Pass Type ID can't be renamed or reused, and its cert expires yearly.
- Don't import the client's Apple login anywhere; the CSR/`.cer` handoff is the entire trust surface.

## Out of scope

Google Wallet, NFC passes (needs a special Apple entitlement), per-contact passes, contact-field
values on the pass, `relevantDate`/location surfacing, Apple Push for non-pass use.
