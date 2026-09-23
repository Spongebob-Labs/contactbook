# Backend API requirements — ContactBook web

**Written for:** the backend engineer building the API the web app integrates against.
**Written from:** `apps/web` as it stands on 2026-09-20. Every endpoint, field name, enum value
and constraint below was read out of the code, not remembered.

**How to read it.** Each section states what the frontend does today, what is missing, and the
exact shape we need. Where a decision is yours to make it says so. Where something is a hard
constraint — a contrast contract, a QR budget, a masking rule — it says that too, because
breaking it fails an automated suite rather than a review.

---

## 0. The one-paragraph summary

The web app renders cards that are **filters over a profile**. Almost all of that already works
against your API. Three things do not:

1. **A card's appearance is not persisted.** The owner picks a colour, a finish, a cover photo, a
   position and a bio; the API has columns for none of it. Four of these currently live in the
   browser's `localStorage` and are lost on any other device. **This is the single highest-value
   gap** — everything else on this page is smaller.
2. **The dashboard is computed client-side from four list endpoints plus one call per card.** It
   works, it does not scale, and one of its numbers is provably wrong (§4.4).
3. **Opens-over-time does not exist and cannot be faked.** `ShareLink` carries a counter and two
   timestamps — no per-view log — so any "activity over time" chart is either about link
   *creation* or it is invented. See §4.3.

---

## 1. What already exists and is working

For orientation. Nothing here needs changing unless a later section says so.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Profile | `GET/PATCH /profile/me`, `GET /profile/fields`, `POST /profile/fields`, `PUT /profile/fields/order`, `GET /profile/groups`, `POST /profile/onboarding`, `POST /profile/photo` |
| Cards | `GET /cards`, `POST /cards`, `GET /cards/{id}`, `PATCH /cards/{id}`, `DELETE /cards/{id}`, `PUT /cards/{id}/fields` |
| Card logo | `POST /cards/{id}/logo`, `DELETE /cards/{id}/logo` |
| Sharing | `POST /cards/{id}/share`, `GET /cards/{id}/audience`, `POST /cards/{id}/notify`, `GET /share-links` |
| Contacts | `GET /contacts`, `POST /contacts`, `POST /contacts/import` |
| Public | `GET /public/links/{token}` |

---

## 2. ⚠ HIGHEST PRIORITY — a card's appearance must persist

### 2.1 What the owner can now change

The card builder has a **Design** panel. Everything in it is currently either written to a column
that does not exist, or written to `localStorage` under `cb:card-draft:{cardId}` and lost the
moment the owner opens the app on another device. The code calls this a temporary shim and says
to delete it the day these columns land (`apps/web/src/lib/card-local-draft.ts`).

### 2.2 Columns to add to `Card`

| Column | Type | Null? | Notes |
|---|---|---|---|
| `templateId` | enum | no, default `meridian` | `meridian` \| `marigold`. What the card is *for*; seeds its opening field set. |
| `paletteId` | enum | yes | See §5 for the 11 values. `null` = use the template's default. |
| `groundHex` | `char(7)` | yes | `#RRGGBB`. A hand-picked colour that **outranks** `paletteId`. |
| `finish` | enum | yes | `flat` \| `gradient` \| `mesh`. Default `gradient`. |
| `texture` | enum | yes | `none` \| `grain` \| `grid` \| `dots` \| `topo`. Default `none`. |
| `texturePresence` | enum | yes | `subtle` \| `medium` \| `strong`. |
| `textureScale` | enum | yes | `fine` \| `regular` \| `large`. |
| `coverUrl` | text | yes | Uploaded photo behind the hero. See §3. |
| `headline` | varchar(80) | yes | The position printed under the name. Overrides the profile's job title. |
| `bio` | varchar(280) | yes | One or two lines under the position. |

**Every one is optional and absent must keep rendering.** The frontend applies defaults in one
place (`resolveCardSurface`), so a card written before these columns existed renders exactly as it
does today. Do not backfill.

⚠ **Two legacy names to accept but not require.** `surfaceStyle` (`flat|gradient|mesh|grain|pattern`)
and `patternId` (`grid|dots|topo`) are the pre-split spelling of `finish`+`texture`. The frontend
still reads them on a migration path. If it is cheap, store and return them; if not, ignore them —
they are not written by the current builder.

### 2.3 Precedence — please encode this, do not leave it to us

```
groundHex  ▸  paletteId  ▸  template's default palette
```

A card with both `groundHex` and `paletteId` uses `groundHex`. This matters because the owner sees
the hand-picked colour in the builder; if any surface resolves it the other way the card looks
different for the recipient than it did for its owner.

### 2.4 Request shape

`PATCH /cards/{id}` should accept any subset of the above. `null` clears a value; omitted leaves it
unchanged. That distinction is load-bearing for us — "remove the cover" and "do not touch the
cover" are different requests.

```jsonc
PATCH /cards/{id}
{
  "paletteId": "sapphire",
  "groundHex": null,
  "finish": "gradient",
  "headline": "Head of Partnerships",
  "bio": "Connecting people, ideas and opportunities.",
  "coverUrl": null          // explicit removal
}
```

---

## 3. Image upload — cover, and the crop contract

### 3.1 What we need

`POST /cards/{id}/cover` (multipart, field `file`) → `CardResponseDto`
`DELETE /cards/{id}/cover` → `204`

Same shape as the logo endpoints that already exist. Accept `image/jpeg`, `image/png`,
`image/webp`.

### 3.2 ⚠ We send an already-cropped image. Do not re-crop, re-fit or re-compress it

The builder now opens a crop dialog on upload: the owner composes the photograph inside the card's
real aperture, and we bake that crop into the bytes before sending. What arrives is **exactly what
must appear on the card**.

| | Aspect (w ÷ h) | We send at most |
|---|---|---|
| Cover | **1 : 0.7** (≈ 1.4286) | 1280 px on the long edge, JPEG q86 |
| Logo | **1 : 1** | 512 px, JPEG q86 |

So: store and serve the bytes. If you must transcode for CDN reasons, **preserve the aspect ratio
exactly** — any server-side "smart crop" or letterboxing will undo the owner's composition and
reintroduce the exact bug this feature was built to fix (a full-length photograph rendering as a
head). Suggested cap: reject > 5 MB.

### 3.3 Why not store a crop transform instead

We considered storing `{scale, x, y}` alongside the original and applying it at render. It fails
here: the card renders on four surfaces — the builder preview, `/cards/{id}`, the public
`/c/{slug}` page and a PNG export — and the public page is served from your API. A transform would
have to reach all four intact or the card composes correctly for its owner and reverts for the
person it was sent to. Baked bytes are correct everywhere by construction.

---

## 4. The dashboard — the biggest API-shaped gap

### 4.1 How it works today, and why that is a problem

`/dashboard` currently issues:

```
GET /profile/me  +  GET /auth/me  +  GET /profile/fields  +  GET /profile/groups
GET /cards
GET /contacts
GET /share-links
GET /cards/{id}/audience     ← once PER CARD
```

That last line is an **N+1**: a profile with 20 cards makes 20 extra round trips on every
dashboard load, purely to count how many recipients are on a stale version. Everything is then
derived in the browser.

### 4.2 What we would like instead

**`GET /dashboard`** — one call, server-computed:

```jsonc
{
  "totals": {
    "cards": 9,
    "contacts": 8,
    "fields": 35,
    "peopleReached": 12,      // DISTINCT contacts holding an ACTIVE link — not the contact count
    "totalOpens": 47,         // summed over ACTIVE links only
    "neverOpened": 3,         // ACTIVE links with viewCount = 0
    "behind": 5               // see §4.4 — and null, never 0, when unknown
  },
  "cardReach": [              // one row per card, INCLUDING never-shared ones at zero
    { "cardId": "…", "cardName": "Work", "opens": 12, "recipients": 3 }
  ],
  "attention": [              // worst first
    { "kind": "no-fields",     "cardId": "…", "cardName": "Blank card", "count": 0 },
    { "kind": "behind",        "cardId": "…", "cardName": "Work",       "count": 2 },
    { "kind": "never-opened",  "cardId": "…", "cardName": "Personal",   "count": 1 },
    { "kind": "never-shared",  "cardId": "…", "cardName": "Studio",     "count": 0 }
  ],
  "sharingActivity": [        // 12 buckets, oldest first — see §4.3 for what this measures
    { "weekStart": "2026-06-29", "count": 0 }
  ],
  "groups": [                 // EVERY group, including empty ones — they are the point
    { "id": "…", "name": "Work", "fieldCount": 4 }
  ]
}
```

Rules we rely on and would rather you own:

- `peopleReached` counts **distinct contacts**, not links. One person holding three cards is one
  person reached.
- `totalOpens` / `neverOpened` count **ACTIVE links only**. A revoked link's opens are history.
- `cardReach` **includes cards with zero opens**. "This card has never been shared" is the row most
  worth acting on, and dropping it hides exactly the cards that need attention.
- `groups` **includes empty groups**. A summary that omitted them would report a profile as
  complete precisely when it is not.
- `behind` is **`null` when unknown**, never `0`. We render "we do not know" differently from
  "nobody is behind", and collapsing the two makes the dashboard confidently wrong.

If a single endpoint is too big a change, the minimum useful fix is an aggregate that removes the
N+1: **`GET /cards/audience-summary` → `[{ cardId, versionsBehindCount }]`**.

### 4.3 ⚠ "Opens over time" does not exist — please read before building a chart

`ShareLinkResponseDto` carries `viewCount`, `firstViewedAt`, `lastViewedAt`. That is **a counter
and two bookends, not a log.** There is no way to know how many opens happened in a given week, so:

- the dashboard's activity chart currently plots **links created per week**, which is real;
- any "opens per week" chart is fabricated and we will not ship one.

**If you want opens-over-time**, it needs a new table — one row per view:

```
LinkEvent(id, shareLinkId, cardId, type: VIEW|SAVE|CHANNEL_OPEN, occurredAt, userAgentHash?)
```

`schema.prisma` already lists this as not yet built. Tell us if it lands and we will draw it. Until
then the chart stays honest about what it measures.

### 4.4 ⚠ A live data bug you should look at

On the account we tested, the API reported **`peopleReached: 2`** alongside **3 recipients behind**
across two cards. Three people cannot be behind on cards that only two people hold.

One of those two numbers is wrong on your side. The frontend now clamps the arithmetic so the
dashboard cannot print negative progress, but it deliberately still shows the real backlog count in
the instruction text — so the symptom is visible rather than hidden. Worth tracing: it is most
likely revoked links being counted in one aggregate and not the other.

---

## 5. Colour — what the API stores, and what it must not

### 5.1 The eleven palettes

These are the card grounds. The API stores **the id only**.

| id | ground | tier |
|---|---|---|
| `onyx` | `#181A1F` | deep |
| `sapphire` | `#142C63` | deep |
| `emerald` | `#0D3C2E` | deep |
| `oxblood` | `#5B1626` | deep |
| `rust` | `#80371C` | deep |
| `amber` | `#E1AA40` | light |
| `clay` | `#E3A28A` | light |
| `pistachio` | `#BFD48C` | light |
| `periwinkle` | `#B4C1EC` | light |
| `mint` | `#BFF6EC` | light |
| `ivory` | `#E7D6BA` | light |

### 5.2 ⚠ Recommendation: palettes stay in the frontend. Store the enum, not the hex

The brief for this document said "no static data — everything from the API". That is right for
**user data**, and this section is the one deliberate exception, so here is the reasoning rather
than a silent decision.

A palette is not one colour. It is ~20 related values — two gradient stops, two ink levels, a
hairline, two button pairs, a canvas-action colour, a QR plate border — and **every pair is proven
by an automated contrast suite** (`tests/contract/template-palettes.test.ts`) that computes real
WCAG ratios and fails the build under threshold. There is also a hard luminance dead band: a
ground must be either deep (L ≤ 0.100) or light (L ≥ 0.339), because no ink clears 7:1 between
them.

If palettes were served as data, a row edited in a database would bypass every one of those checks
and ship an illegible card with nothing to catch it. So:

- **API stores:** `paletteId` (enum, the 11 strings above) and `groundHex` (free colour).
- **Frontend owns:** what each id looks like, and derives a full legible palette from any
  `groundHex` — clamping it into the legible range automatically.

If you disagree, say so and we will design a served-palette shape with the contrast check moved to
write time. But it must move, not disappear.

### 5.3 App chrome, for reference

The app moved to a cream ground on 2026-09-20. Listed only so any server-rendered email or PDF can
match; **no API involvement**.

| token | value | role |
|---|---|---|
| `--canvas` | `#FCFAF8` | page ground |
| `--surface` | `#F7F2ED` | panels |
| `--surface-sunk` | `#F2EAE1` | wells, sidebar |
| `--ink` | `#010103` | primary text |
| `--ink-2` | `#3E3932` | secondary |
| `--ink-3` | `#816544` | captions |
| `--accent` | `#0D1C25` | primary action |
| `--line` | `#E8E2DC` | hairlines |
| `--line-control` | `#897F73` | control boundaries |
| `--warning-ink` / `--warning-wash` | `#7A4100` / `#FFFAEB` | needs-attention state |
| `--danger` | `#B42318` | destructive |

---

## 6. Static-data audit — everything the app still fakes

The brief asked for this explicitly. Current state, honestly:

| Thing | Where it lives now | Needs an API? |
|---|---|---|
| Cover image, headline, bio | **`localStorage`** (`cb:card-draft:{cardId}`) | **Yes — §2.** Highest priority. Lost on every other device. |
| `templateId`, `paletteId`, `groundHex`, finish/texture | Sent but **not persisted** | **Yes — §2.** |
| Dashboard aggregates | Computed in the browser from 4 lists + N calls | **Yes — §4.2.** Works today; does not scale. |
| Recipients behind per card | `GET /cards/{id}/audience`, one call per card | **Yes — §4.2.** N+1. |
| Opens over time | **Does not exist** | **Only if you add `LinkEvent` — §4.3.** |
| Palette definitions | Frontend constants | **No — §5.2**, by argued exception. |
| Field-type catalogue (21 types, 7 categories) | Frontend registry | **No.** Each type has a renderer; it is code, not rows. |
| Templates (`meridian`, `marigold`) | Frontend + `GET /templates` | Already served. |
| Demo/fixture data | `tests/stubs` only, never shipped | No. |

⚠ **There is no fabricated user data in the product.** Fixtures are confined to the test stub, and
every fixture domain is an RFC-reserved name enforced by an allowlist test. The dashboard shows
`0` where it has no data rather than a plausible number — please keep it that way at your end too.

---

## 7. Constraints that fail a build if broken

Not style notes. Each is enforced by an automated suite.

1. **Masking is absolute.** `BANK_ACCOUNT`, `DIGITAL_WALLET`, `CRYPTO_WALLET` values must never
   reach a public payload — not as text, not in an attribute — regardless of any owner flag.
   `GET /public/links/{token}` must mask server-side; we mask again, but the value should not
   leave your process.
2. **The QR must decode.** The public URL we encode has a **≤ 60 byte** payload budget so the
   symbol stays at version ≤ 6. Five contract suites measure this. Do not lengthen the public URL
   format without telling us.
3. **`publicUrl` is minted by you and passed through verbatim.** We never assemble it. `null` means
   "not published yet" and renders as an explicit state, never as a live-looking QR.
4. **Contrast is a contract.** See §5.2.
5. **`ShareLink` is unique per (card, recipient)** — re-sharing returns the same token. We rely on
   this: the share sheet assumes a second share to the same person does not mint a second link.
   ⚠ Naming mismatch worth settling: the backend invariant is written `(cardId, recipientId)`,
   while `ShareLinkResponseDto` exposes the same thing as `contactId`. We read `contactId`. One of
   the two should probably change, but tell us before it does.

---

## 8. Suggested order of work

1. **§2 — card appearance columns + `PATCH /cards/{id}`.** Unblocks deleting the `localStorage`
   shim, which is the only place the product currently loses user data.
2. **§3 — cover upload/delete.** Small, mirrors the logo endpoints.
3. **§4.4 — the `peopleReached` / `behind` contradiction.** A correctness bug, cheap to trace.
4. **§4.2 — `GET /cards/audience-summary`** (kills the N+1), then the full `GET /dashboard`.
5. **§4.3 — `LinkEvent`**, only if opens-over-time is wanted as a product feature.

---

## 9. Open questions for you

1. Do you want `coverUrl` as an upload endpoint (§3.1) or would you rather we send a URL you have
   already stored elsewhere?
2. Is `GET /dashboard` acceptable, or would you rather extend the existing list endpoints with
   query parameters?
3. Is `LinkEvent` on the roadmap? It decides whether the activity chart can ever mean "opens".
4. Do you accept the palette recommendation in §5.2, or should we design a served-palette shape?

Anything ambiguous here is a bug in this document — ask, and it gets corrected rather than guessed.
