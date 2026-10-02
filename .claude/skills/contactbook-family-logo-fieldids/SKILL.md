---
name: contactbook-family-logo-fieldids
description: Frontend integration guide for three features added in feat/family-logo-fieldids — FAMILY field group, profile-level company logo upload, and fieldIds on POST /cards. Load this when building the profile FAMILY section, the company logo upload UI, or the card creation flow that pre-selects fields.
---

# FAMILY group · Company logo · fieldIds on POST /cards

Three additive backend changes. Nothing existing breaks — all changes are new
enum values or optional new request fields.

---

## 1. FAMILY field group

### What changed
Two new enum values are live in the DB and accepted by all existing field/group endpoints:
- `FieldGroupCategory.FAMILY` — can be used when creating a `ProfileFieldGroup`
- `FieldCategory.FAMILY` — can be used when creating a `ProfileField`

No new endpoints. Use the existing group and field endpoints exactly as before.

### Frontend checklist
- If your code has a **hardcoded list of `FieldGroupCategory` values** (e.g. a picker
  that shows Work / Business / Social / Financial), add `FAMILY`.
- If your code has a **hardcoded list of `FieldCategory` values**, add `FAMILY`.
- The intended UX is one group per family member, each group containing two fields:
  - `type: "RELATION"`, `label: "Name"` — child's name
  - `type: "DATE"`, `label: "Birthday"` — child's birthday

### Create a FAMILY group + fields

```http
POST /profile/groups
{ "category": "FAMILY", "tag": "Rohan" }
→ { "id": "<groupId>", ... }

POST /profile/fields
{ "category": "FAMILY", "type": "RELATION", "label": "Name", "value": "Rohan", "groupId": "<groupId>" }

POST /profile/fields
{ "category": "FAMILY", "type": "DATE", "label": "Birthday", "value": "2019-03-14", "groupId": "<groupId>" }
```

---

## 2. Profile-level company logo

### What changed
- New `FieldType` value: `COMPANY_LOGO`
- **`POST /profile/company-logo`** — upload or replace the logo
- **`DELETE /profile/company-logo`** — remove it
- `POST /profile/fields` with `type: "COMPANY_LOGO"` is blocked (returns
  `409 COMPANY_LOGO_VIA_UPLOAD_ONLY`) — use the upload endpoint, same as PHOTO.

### Why profile-level?
Previously logos were per-card (`POST /cards/:id/logo`). The new logo is a
`WORK`-category `ProfileField` (value = GCS public URL). Any card that includes
WORK fields carries the logo automatically — upload once, appears everywhere.

### Upload endpoint

```http
POST /profile/company-logo
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <image/jpeg | image/png | image/webp, max 20 MB>
```

Response `200`:
```json
{ "id": "<fieldId>", "url": "https://storage.googleapis.com/..." }
```

Error codes:
- `409 PHOTO_STORAGE_NOT_CONFIGURED` — GCS not wired up (staging/prod: never happens)
- `413 PHOTO_TOO_LARGE` — file over 20 MB
- `415 PHOTO_TYPE_UNSUPPORTED` — not JPEG/PNG/WebP

### Delete endpoint

```http
DELETE /profile/company-logo
Authorization: Bearer <token>
→ 204 No Content
```

Error: `404 COMPANY_LOGO_NOT_FOUND` — nothing to remove.

### Frontend checklist
- If you render a list of `ProfileField` rows and **filter by type** to hide
  upload-only fields, add `COMPANY_LOGO` next to `PHOTO` in that filter.
- If you have a hardcoded `FieldType` list anywhere (type picker UI), add
  `COMPANY_LOGO` — but note it's upload-only, same as PHOTO, so exclude it from
  the free-text-value creation flow.
- The field returned by `GET /profile/me` (under `work[]`) will contain a
  `COMPANY_LOGO`-typed field after upload — render `field.value` as `<img src>`.

---

## 3. `fieldIds` on `POST /cards`

### What changed
`POST /cards` now accepts an optional `fieldIds` array. When provided, the card
and its `CardField` rows are created **atomically in one transaction** — no more
two-call dance that could half-fail.

### Request

```http
POST /cards
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Work Card",
  "kind": "WORK",
  "fieldIds": [
    "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "7cb2b47a-1e3c-4d5f-a892-1234567890ab"
  ]
}
```

- `fieldIds` is optional. Omitting it gives identical behaviour to before.
- Max 50 IDs.
- All IDs must belong to the caller and not be archived — `404 PROFILE_FIELD_NOT_FOUND` otherwise.
- `PHOTO`-type fields are rejected — `409 PHOTO_NOT_A_CARD_FIELD`.

### Frontend use case
The "Create card from saved fields" UI (profile left-side builder → card preview
right side) should use this instead of two sequential calls:

```typescript
// Before — could half-fail
const card = await api.post('/cards', { name, kind });
await api.put(`/cards/${card.id}/fields`, { fields: fieldIds.map(id => ({ fieldId: id })) });

// After — atomic
const card = await api.post('/cards', { name, kind, fieldIds });
```

`PUT /cards/:id/fields` is still the right call for **editing** field selection on
an existing card — `fieldIds` on POST is creation-only.

---

## Breaking changes

None. All three features are purely additive:
- New enum values are ignored by any client that doesn't use them.
- `fieldIds` on `POST /cards` is optional — omitting it keeps existing behaviour.
- New endpoints don't affect any existing endpoint.

The only thing that could silently "break" the frontend UX (not an error, just a
missing option) is a hardcoded enum list that doesn't include `FAMILY` or
`COMPANY_LOGO` — those pickers would just not offer the new values until updated.
