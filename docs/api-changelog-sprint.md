# API changelog — sprint implementation

This document summarizes **REST API** changes from the sprint API implementation (Phases 0–3). All routes use the global prefix **`/api`** and URI version **`v1`** unless noted.

**OpenAPI / Swagger:** `/api/docs`  
**Auth:** Bearer JWT (`Authorization: Bearer <access_token>`) on protected routes unless stated otherwise.

---

## Summary

| Category | Count |
|----------|--------|
| New endpoints | 18 |
| Updated endpoints (behavior or contract) | 6 |
| Breaking changes | 4 |
| Removed enum values | 1 (`CSV` contact source) |
| Removed endpoints | 4 (card access) |
| Unchanged (explicit) | Connections HTTP accept/decline/share-back still **409** (WhatsApp-only) |

---

## Breaking changes

### 1. `ContactSource.CSV` removed

- **Enum:** `ContactSource` no longer includes `CSV`.
- **Valid values:** `GOOGLE`, `ICLOUD`, `VCARD`, `CONTACTBOOK`.
- **Impact:**
  - `GET /api/v1/contacts?source=CSV` → **400** validation error.
  - `GET /api/v1/contacts/sync?source=CSV` → rejected (unsupported source).
  - Any client storing or filtering `source: "CSV"` must stop using it.
- **Migration:** Existing DB rows that used `CSV` are migrated to `VCARD` in migration `20260529120000_remove_contact_source_csv` (if any existed).
- **Note:** There was never a dedicated CSV import HTTP endpoint; CSV was only an enum remnant.

### 1b. `ContactSource.CALDAV` removed

- **Enum:** `ContactSource` no longer includes `CALDAV` (iCloud sync uses `ICLOUD`).
- **Impact:** `GET /api/v1/contacts?source=CALDAV` → **400** validation error.
- **Migration:** Existing `CALDAV` rows are remapped to `ICLOUD` in migration `20260531180000_remove_contact_source_caldav` (conflicting duplicates are soft-deleted or dropped first).

### 2. Contact list/detail response shape — `tags` and `groups` always present

`GET /api/v1/contacts` (paginated items) and `GET /api/v1/contacts/:id` now **always** include:

```json
{
  "tags": [{ "id": "uuid", "name": "Investor" }],
  "groups": [{ "id": "uuid", "name": "Home" }]
}
```

Clients with strict JSON schemas must allow these arrays (empty `[]` when none assigned).

### 3. Tags and groups CRUD paths moved under contacts

| Old path | New path |
|----------|----------|
| `/api/v1/tags` | `/api/v1/contacts/tags` |
| `/api/v1/groups` | `/api/v1/contacts/groups` |

Assignment routes are unchanged: `PUT /api/v1/contacts/:id/tags`, `PUT /api/v1/contacts/:id/groups`.

### 4. Card access REST and `visibility` removed

- **Removed:** `GET/POST` card access-request endpoints (see [Removed endpoints](#removed-endpoints)).
- **Removed:** `ContactCard.visibility` column and `CardVisibility` enum.
- **Sharing model:** Connections only — on accept, the user picks a `ContactCard` to share via WhatsApp (`connection-share` flow). No separate card-level access requests.

---

## New endpoints

### Tags (`/api/v1/contacts/tags`)

User-defined labels; assigned to **contacts** (not connections). ContactBook-only (not synced to Google/iCloud).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/contacts/tags` | List tags for current user |
| `POST` | `/api/v1/contacts/tags` | Create tag — body: `{ "name": "Investor" }` |
| `PATCH` | `/api/v1/contacts/tags/:id` | Rename tag — body: `{ "name": "VIP" }` |
| `DELETE` | `/api/v1/contacts/tags/:id` | Delete tag |

**Response (tag):** `{ "id", "name" }`

---

### Groups (`/api/v1/contacts/groups`)

Named contact lists (e.g. Home, Office). Distinct from dedup `ContactMergeGroup`. Provider-imported groups include `source` + `externalId`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/contacts/groups` | List groups |
| `POST` | `/api/v1/contacts/groups` | Create user group — body: `{ "name": "Home" }` |
| `PATCH` | `/api/v1/contacts/groups/:id` | Rename user-created group only |
| `DELETE` | `/api/v1/contacts/groups/:id` | Delete user-created group only |

**Response (group):** `{ "id", "name", "source": null | "GOOGLE" | ..., "externalId": null | "..." }`

**Rules:**

- Groups with `source` set (imported from Google, etc.) **cannot** be renamed or deleted via API; they are reconciled on the next provider sync.

---

### Contacts — assignments & updates

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/contacts/import/summary` | Per-source import counts, last sync, sync token flags |
| `PATCH` | `/api/v1/contacts/:id` | Update contact — body: `{ "notes"?: string }`; triggers Google write-back when applicable |
| `PUT` | `/api/v1/contacts/:id/tags` | Replace tag set — body: `{ "tagIds": ["uuid", ...] }` |
| `PUT` | `/api/v1/contacts/:id/groups` | Replace group membership — body: `{ "groupIds": ["uuid", ...] }` |

**Import summary response:**

- `activeCount` / `deletedCount` are **live DB counts** where `Contact.source` equals that source (not last-sync deltas).
- All four sources (`GOOGLE`, `ICLOUD`, `VCARD`, `CONTACTBOOK`) are always returned in `bySource`.
- Sync metadata is nested under `lastSync` (replaces flat `lastSyncAt`, `hasSyncToken`, `lastSyncStats`).

```json
{
  "totalActive": 120,
  "totalDeleted": 3,
  "bySource": [
    {
      "source": "GOOGLE",
      "activeCount": 100,
      "deletedCount": 2,
      "lastSync": {
        "at": "2026-05-30T12:00:00.000Z",
        "hasSyncToken": true,
        "runStats": { "added": 1, "updated": 0, "deleted": 0, "duplicatesFound": 0 }
      }
    }
  ]
}
```

**Contact detail** (`GET /api/v1/contacts/:id`) includes `providerLinks[]` — every provider key (source + externalId) that sourced or updated the contact. Cross-source duplicates merge into the primary contact row; `Contact.source` stays the original provider.

**One-time repair:** Run `pnpm -C apps/api collapse-contacts --dry-run` then `pnpm -C apps/api collapse-contacts --yes` to collapse existing duplicate rows in the database.

---

### Travel (`/api/v1/travel`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/travel/settings` | `homeCity`, `homeCountry`, `calendarSyncEnabled` |
| `PATCH` | `/api/v1/travel/settings` | Update settings (partial body) |
| `GET` | `/api/v1/travel/events` | Travel events (calendar-derived, up to 100) |
| `GET` | `/api/v1/travel/notifications/contacts` | Contacts selected for travel notify list |
| `PUT` | `/api/v1/travel/notifications/contacts` | Replace list — body: `{ "contactIds": ["uuid", ...] }` |
| `POST` | `/api/v1/travel/notifications/dispatch` | Send message to listed contacts — body: `{ "message": "..." }` → `{ "sent": number }` |

---

## Updated endpoints

### `GET /api/v1/contacts`

**New query parameters:**

| Parameter | Type | Semantics |
|-----------|------|-----------|
| `tagIds` | Comma-separated UUIDs | **AND** filter — contact must have **all** listed tags |
| `groupIds` | Comma-separated UUIDs | **AND** filter — contact must belong to **all** listed groups |

Existing query params unchanged: `page`, `limit`, `search`, `source`, `sort`, `sortOrder`.

**Response:** Still paginated `{ items, page, limit, total, totalPages }`; each item includes `tags[]`, `groups[]`, and `providerLinks[]`.

**List deduplication:** Returns **one row per person** — the primary contact (oldest `createdAt`) in each merge group. Duplicate sibling rows are excluded from `items` and `total`. Tag/group filters match if **any** contact in the merge group matches.

---

### `GET /api/v1/contacts/:id`

Same additive `tags[]` and `groups[]` on the contact detail object.

---

### Import / sync (behavioral, same routes)

| Route | Change |
|-------|--------|
| `GET /api/v1/contacts/import/google` | **Pre-flight:** validates Google OAuth before import. After import, Google **contact groups** are fetched and linked. |
| `POST /api/v1/contacts/import/icloud` | **Pre-flight:** validates CardDAV credentials after upsert, before import. |
| `GET /api/v1/contacts/sync?source=GOOGLE\|ICLOUD` | **Pre-flight:** validates provider credentials before sync. |
| `POST /api/v1/contacts/import/vcf` | vCard `CATEGORIES` mapped to ContactBook groups after import (no OAuth pre-flight). |

**Credential errors (400):** If Google or iCloud credentials are missing, invalid, or expired, sync/import fails immediately with a message asking the user to reconnect that source (e.g. *"Google credentials are invalid or expired. Reconnect Google in settings and try again."*).

No new path; import/sync contracts (`ContactImportResultDto`, `ContactSyncResponseDto`) unchanged.

---

### `PATCH /api/v1/contacts/:id` (write-back)

When the contact has `source` of `GOOGLE` or `ICLOUD` and a valid `externalId`:

- After a successful DB update, the API attempts provider write-back:
  - **Google:** People API `updateContact` (requires `https://www.googleapis.com/auth/contacts` on the stored OAuth scope).
  - **iCloud:** CardDAV `updateVCard` (merge-update on existing vCard; uses stored `sourceRevision` as ETag).
- Failures are recorded on `IntegrationState` (`lastWriteBackError`, `lastWriteBackAt`) — not returned as HTTP errors to the client by default (fire-and-forget via `void`).

---

### Google OAuth link (client + API)

- **Web** [`apps/web/src/lib/google-oauth.ts`](../apps/web/src/lib/google-oauth.ts) now requests **`contacts`** (write) in addition to `contacts.readonly` and `calendar.readonly`.
- Users who linked Google **before** this change must **re-link** to grant write scope for contact write-back.

`POST /api/v1/integrations/google/link-provider` — unchanged route; stored `scope` string may now include the write scope.

---

## Removed endpoints

Card-level access (replaced by connection + WhatsApp card selection):

| Method | Path |
|--------|------|
| `GET` | `/api/v1/cards/access-requests` |
| `POST` | `/api/v1/cards/access-requests/:requestId/approve` |
| `POST` | `/api/v1/cards/access-requests/:requestId/deny` |
| `POST` | `/api/v1/cards/:cardId/access-requests` |

**Cards:** `PATCH /api/v1/cards/:cardId` still supports `name`, `type`, `isSensitive` (no `visibility`).

---

## Unchanged / intentional non-changes

| Area | Behavior |
|------|----------|
| **CSV import** | Never existed as HTTP API |
| **Time-limited sharing** | Parked — no new connection share TTL APIs |
| **Connections** | `POST .../accept`, `decline`, `share-back` still return **409** (complete via WhatsApp) |
| **Async import jobs** | Not added (`202` + `jobId` deferred) |
| **Auth** | `POST /api/v1/auth/whatsapp/request-code`, `verify-code` unchanged |

---

## Twilio webhooks (not client REST)

Inbound provider callbacks (not JWT-protected):

| Method | Path | Changes |
|--------|------|---------|
| `POST` | `/api/v1/webhooks/twilio/whatsapp` | Accepts optional **location** (`Latitude`, `Longitude`) for travel prompts |
| `POST` | `/api/v1/webhooks/twilio/whatsapp/fallback` | Unchanged (DLQ) |

Existing patterns still supported: `ACCEPT-{connectionId}`, `DECLINE-{connectionId}`, numbered card selection, `accept` / `decline` shortcuts.

---

## Data model & migrations

Apply in order:

1. `20260529120000_remove_contact_source_csv`
2. `20260529130000_contact_tags_and_groups`
3. `20260529140000_sprint_privacy_travel_writeback`
4. `20260529150000_remove_card_access`

**Notable schema additions:**

- `ContactGroup`, `_ContactTags`, `_ContactGroups`
- `UserTravelProfile`, `TravelNotificationContact`, `UserTravelSession`
- `IntegrationState.lastWriteBackAt`, `lastWriteBackError`

**Removed:** `_ConnectionToTag` (tags moved from connections to contacts); `CardAccessRequest`, `CardAccessGrant`, `ContactCard.visibility`.

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `FINANCIAL_FIELD_ENCRYPTION_KEY_BASE64` | AES-256-GCM for financial profile fields (separate from OAuth key) |

Existing Twilio variables unchanged. See [`apps/api/.env.example`](../apps/api/.env.example).

---

## Profile API (behavioral, no new routes)

Financial field types (`BANK_ACCOUNT`, `DIGITAL_WALLET`, `CRYPTO_WALLET`) are **encrypted at rest** on write when `FINANCIAL_FIELD_ENCRYPTION_KEY_BASE64` is set. Reads use dual-read (plaintext legacy + `cbfe:v1:` ciphertext).

`GET` / `PATCH /api/v1/profile/me` — same paths; decrypted values returned to owner in profile payloads.

**Backfill script:** `apps/api/scripts/encrypt-financial-profile-fields.ts` (`--dry-run` supported).

---

## Partial / follow-up (not full contract guarantees)

| Item | Status |
|------|--------|
| `GET /api/v1/travel/notifications` (history) | Not implemented; only `notifications/contacts` + `dispatch` |
| Travel cron message | Prompts traveler to reply **NOTIFY**; peer fan-out via dispatch API |
| iCloud write-back 412 conflicts | Logged on `IntegrationState`; no automatic refetch/retry |

---

## Quick reference — all new routes

```
GET    /api/v1/contacts/tags
POST   /api/v1/contacts/tags
PATCH  /api/v1/contacts/tags/:id
DELETE /api/v1/contacts/tags/:id

GET    /api/v1/contacts/groups
POST   /api/v1/contacts/groups
PATCH  /api/v1/contacts/groups/:id
DELETE /api/v1/contacts/groups/:id

GET    /api/v1/contacts/import/summary
PATCH  /api/v1/contacts/:id
PUT    /api/v1/contacts/:id/tags
PUT    /api/v1/contacts/:id/groups

GET    /api/v1/travel/settings
PATCH  /api/v1/travel/settings
GET    /api/v1/travel/events
GET    /api/v1/travel/notifications/contacts
PUT    /api/v1/travel/notifications/contacts
POST   /api/v1/travel/notifications/dispatch
```
