---
name: contactbook-card-appearance-dashboard
description: How to build against the new card appearance persistence, cover-photo upload, and single-call dashboard endpoints in apps/web. Load this before wiring the card Design panel to real storage, deleting the cb:card-draft:{cardId} localStorage shim, building POST/DELETE /cards/:id/cover, or building GET /dashboard. Backend built and verified live (including reproducing and fixing the peopleReached/behind bug) 2026-09-21 — uncommitted, on branch feat/card-appearance-and-dashboard, not yet merged. Nothing on the frontend consumes these endpoints yet; this is the build guide, not a description of shipped FE code.
---

# Card appearance, cover upload, dashboard — FE integration guide

## The mental model, in one paragraph

This closes the three biggest gaps between what the card builder's Design panel lets an owner
change and what the API actually persisted. Before this: palette/finish/texture/cover/headline/bio
either had no column at all, or lived in `localStorage` under `cb:card-draft:{cardId}` and were
lost on any other device. After this: every one of those fields is a real `Card` column, settable
through `PATCH /cards/:id` (or the dedicated upload endpoint, for the cover), and returned on every
card read — owner's own view, public page, everywhere. Separately, `GET /dashboard` replaces the
N+1 client-side assembly (`GET /cards` + `GET /contacts` + `GET /share-links` + one
`GET /cards/:id/audience` **per card**) with one server-computed call.

## Part 1 — Card appearance fields

### What's on `CardResponseDto` now

```ts
{
  // ...existing fields (id, name, kind, publicUrl, fields[], createdAt, updatedAt)...
  logoUrl: string | null;          // unchanged, already shipped
  coverUrl: string | null;         // NEW
  headline: string | null;         // NEW — overrides the profile job title on this card
  bio: string | null;              // NEW
  templateId: string;              // CHANGED: never null now, defaults to "meridian"
  paletteId: string | null;        // now 11 values, not 9 — see below
  groundHex: string | null;
  finish: string | null;           // now a closed set, defaults to "gradient"
  texture: string | null;          // now a closed set, defaults to "none"
  texturePresence: string | null;  // now a closed set
  textureScale: string | null;     // now a closed set
}
```

Same shape lands on the **public card page** (`GET /public/links/:token` → `card.{...}`), plus
`owner.name`/`owner.photoUrl` as before — a scanner sees the exact same `coverUrl`/`headline`/`bio`
the owner set.

### The closed sets (now enforced server-side, `@IsIn`)

```ts
templateId:      'meridian' | 'marigold'
paletteId:       'onyx' | 'sapphire' | 'emerald' | 'oxblood' | 'rust' | 'amber' | 'clay' |
                 'pistachio' | 'periwinkle' | 'mint' | 'ivory'   // mint/ivory are new
finish:          'flat' | 'gradient' | 'mesh'
texture:         'none' | 'grain' | 'grid' | 'dots' | 'topo'
texturePresence: 'subtle' | 'medium' | 'strong'
textureScale:    'fine' | 'regular' | 'large'
```

Sending anything outside these on create/update gets a `400` (`property must be one of the
following values: ...`). `headline` caps at 80 chars, `bio` at 280 — same limits the spec asked for.

### `PATCH /cards/:id` — omitted vs `null` is load-bearing, and it's enforced exactly

```ts
PATCH /cards/{id}
{
  "paletteId": "sapphire",   // sets it
  "groundHex": null,          // CLEARS it — different from not sending groundHex at all
  "finish": "gradient",
  "headline": "Head of Partnerships",
  "bio": "Connecting people, ideas and opportunities.",
  "coverUrl": null            // removes the cover — see below
}
```

- **Omit a key** → that field is left exactly as it was.
- **Send `null`** → that field is cleared (nullable fields fall back to their default at render
  time — `finish`/`texture` have a DB default, the rest just render as "not set").
- This applies to every nullable field: `paletteId`, `groundHex`, `finish`, `texture`,
  `texturePresence`, `textureScale`, `headline`, `bio`, `coverUrl`.
- `templateId` is the one exception — it's never nullable (defaults to `"meridian"` server-side),
  so there's nothing to clear; omit it or send a real value.

**`coverUrl` on PATCH accepts exactly one value: `null`.** Sending any actual URL string is
rejected with `400` — `coverUrl can only be explicitly set to null (to remove it) — upload a new
cover via POST /cards/:id/cover`. A real cover can only ever come from the upload endpoint below;
`DELETE /cards/:id/cover` does the identical thing and either is fine to use.

### `POST /cards` also takes an optional logo at creation (already shipped, unrelated to this pass)

Worth knowing since it changed the request shape: `POST /cards` is `multipart/form-data`, not
JSON, with an optional `file` field for a logo. Plain JSON still works too (Express's own JSON
parser handles it before Multer looks at the request) — nothing breaks either way. `coverUrl` is
**not** part of `POST /cards` — a cover can only be attached after the card exists, via
`POST /cards/:id/cover`.

## Part 2 — Cover photo upload

```
POST /cards/:id/cover     multipart/form-data, field name `file`   → CardResponseDto
DELETE /cards/:id/cover                                             → 204
```

JPEG/PNG/WebP, **5MB cap** (not the logo's 20MB). Mirrors the existing logo endpoints exactly —
same replace-deletes-the-old-object behavior, same error shape.

### ⚠ The API stores and serves exactly the bytes you send — read this before wiring the uploader

Per the crop contract: the frontend's crop dialog bakes the owner's composition into the file
**before** it's sent — 1:0.7 aspect ratio, ≤1280px long edge, JPEG q86. The API does **no**
server-side crop, resize, or recompress. Send anything else (an uncropped full photo, a different
aspect ratio) and that's exactly what renders on the card, the builder preview, and the public
page. If the crop dialog isn't wired yet, don't point this endpoint at a raw file picker — the bug
this whole feature exists to fix is a full-length photo rendering as a head crop.

### Errors

| Code | Status | When |
|---|---|---|
| `CARD_NOT_FOUND` | 404 | not your card |
| `COVER_NOT_FOUND` | 404 | `DELETE` when no cover exists |
| `COVER_TOO_LARGE` | 413 | over 5MB |
| `COVER_TYPE_UNSUPPORTED` | 415 | not JPEG/PNG/WebP |
| `COVER_STORAGE_NOT_CONFIGURED` | 409 | shouldn't happen — already configured everywhere |

## Part 3 — `GET /dashboard`

One authenticated call, no query params, replaces the whole client-side assembly.

```ts
{
  totals: {
    cards: number;              // non-archived cards
    contacts: number;
    fields: number;              // non-archived ProfileFields
    peopleReached: number;       // DISTINCT contacts holding an ACTIVE link — not link count
    totalOpens: number;          // viewCount summed, ACTIVE links only
    neverOpened: number;         // ACTIVE links with viewCount = 0
    behind: number | null;       // DISTINCT contacts behind on ≥1 card — null (never 0) with no cards yet
  };
  cardReach: Array<{             // one row per non-archived card, INCLUDING zero-activity ones
    cardId: string; cardName: string; opens: number; recipients: number;
  }>;
  attention: Array<{             // kind-priority order, worst (highest count) first within each kind
    kind: 'no-fields' | 'behind' | 'never-opened' | 'never-shared';
    cardId: string; cardName: string; count: number;   // 0 is a fixed marker for no-fields/never-shared
  }>;
  sharingActivity: Array<{       // 12 weekly buckets, oldest first, Monday-aligned UTC
    weekStart: string;           // "2026-06-29"
    count: number;               // ShareLinks CREATED that week — NOT opens, see below
  }>;
  groups: Array<{                // EVERY group, including empty ones
    id: string; name: string; fieldCount: number;
  }>;
}
```

### Things worth knowing before you render this

- **`peopleReached` and `behind` are computed from the exact same query** (every `ACTIVE`
  `ShareLink` across the caller's non-archived cards) — this is the fix for the bug the original
  spec flagged (a contact behind on two different cards used to be double-counted in one
  aggregate and not the other; now `behind` can never exceed `peopleReached`, verified by
  reproducing that exact scenario).
- **`behind: null` means "nothing to compute this from"** (no cards yet) — render that
  differently from `0` ("checked, nobody's behind"). Don't collapse the two.
- **`sharingActivity` counts link *creation*, not opens.** There's still no per-view log
  (`LinkEvent`) — see "Not built" below. Label the chart honestly ("cards shared over time," not
  "opens over time") until that lands.
- **`cardReach` and `attention` include the zero-activity cases on purpose** — a card with no
  fields, no shares, or no opens is the most actionable row, not one to filter out.
- **`groups`** returns a `name` even for an untagged group (`ProfileFieldGroup.tag` is nullable) —
  falls back to a title-cased category (`"WORK"` → `"Work"`) rather than `null`/empty.

## What's NOT built — don't wire a UI implying otherwise

- **Opens-over-time.** `LinkEvent` (a per-view log) doesn't exist. `sharingActivity` is link
  creations, which is real data — an "opens per week" chart would be fabricated. This is a
  deliberately deferred, lowest-priority item from the original spec — ask if it's actually wanted
  as a feature; it's a real, separate build (new table, a write on every public resolve, a new
  aggregation query), not a small addition.
- **A combined create-card-with-cover call.** Cover upload is always a second call after the card
  exists (`POST /cards` → `POST /cards/:id/cover`), unlike logo which can ride along on creation.

## Also worth knowing (not a FE change, but affects what the public page returns)

While verifying this, a real pre-existing gap was found and fixed: `GET /public/links/:token` used
to return **unmasked, real** `BANK_ACCOUNT`/`DIGITAL_WALLET`/`CRYPTO_WALLET` values. It now always
masks these to a fixed `"••••"` server-side — the real value never reaches the public payload at
all. If the FE was independently masking these client-side as a defense-in-depth measure, that can
stay (harmless double-masking), but it's no longer the only thing protecting them.

## Reference

- Schema: `apps/api/prisma/schema.prisma` (`Card` model)
- DTOs: `apps/api/src/sharing/dto/card-response.dto.ts`, `update-card.dto.ts`,
  `create-card.dto.ts`, `card-appearance.constants.ts`, `public-card-response.dto.ts`
- Business logic: `apps/api/src/sharing/cards.service.ts` (`create`, `update`, `uploadCover`,
  `removeCover`), `apps/api/src/sharing/share-links.service.ts` (`assemblePublicCard` — the
  masking fix lives here)
- Cover storage: `apps/api/src/sharing/card-cover-storage.service.ts` (mirrors the existing
  `card-logo-storage.service.ts`)
- Dashboard: `apps/api/src/dashboard/` (`dashboard.service.ts` has the exact aggregation logic,
  heavily commented — read it before changing any of the totals math)
- **Not yet merged** — branch `feat/card-appearance-and-dashboard`, uncommitted as of 2026-09-21.
  Confirm it's landed before building against it.
- For auth, the error envelope shape, and every other endpoint: **`contactbook-api-integration`**
