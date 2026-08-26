# API integration — contract, decisions, and what the backend still owes

Staging: `https://apistaging.getcontactbook.com` · spec: `/api/docs-json`
Committed snapshot: `src/lib/api/openapi.snapshot.json` (36 operations, 48 schemas)

The snapshot is the source of truth for `tests/contract/api-contract.test.ts`, which fails if
the client implements an operation the spec does not define, or misses one it does. Refresh it
deliberately:

```bash
curl -s https://apistaging.getcontactbook.com/api/docs-json > apps/web/src/lib/api/openapi.snapshot.json
```

---

## Architecture: a same-origin proxy, so every call is visible

Every call goes **from the browser** to `/api/cb/<path>`, which forwards to
`<API_BASE_URL>/api/v1/<path>`. Method, path, query, body, status and response **bytes** pass
through verbatim — what Swagger returns is what the Network tab shows, character for character,
with `x-request-id` preserved so a row can be matched to the API's own logs.

Filter the Network tab on `api/cb` to see only API traffic.

> **This replaced a server-side-only design, and the reason matters.** Calls used to be made in
> Server Components and Server Actions. That was correct and the API contract was identical — but
> the browser never saw a request, so the Network tab showed only Next.js's RSC payloads
> (`3:I["[project]/node_modules/…"`), which reads like a broken API. Being able to inspect the real
> request and response from the browser is a requirement, not a nicety: it is how the integration
> gets reviewed. `docs/API-MAP.md` lists which page triggers which call.

**The credential never reaches the browser.** The proxy reads the httpOnly session cookie
server-side and attaches `Authorization: Bearer` itself. That is why calls are proxied rather than
made directly to the API: the API sets its cookies on *its* domain, which a browser on our origin
cannot send back — they are cross-site, so they would need `SameSite=None; Secure`, and Safari
discards them regardless. Direct browser calls would give a session that works on one laptop and
fails silently on the client's iPhone.

Two endpoints are not pure passthrough — they still return the API's exact body, and additionally
manage *our* cookies: `POST /auth/otp/verify` (re-homes the refresh token, which exists only as a
`Set-Cookie` on the API's domain) and `POST /auth/logout` (clears them).

That is not fastidiousness — it is the fix for a specific failure. `POST /auth/otp/verify`
sets `cb_access_token` / `cb_refresh_token` scoped to `apistaging.getcontactbook.com`. A
browser on the web origin will not send those back: they are cross-site, so they would need
`SameSite=None; Secure`, and Safari's third-party cookie policy discards them anyway. That is
the classic "works on my machine, fails on the client's iPhone" integration bug.

So the tokens are **re-homed**, using the path the API's own docs describe for non-browser
clients: take `accessToken` from the response *body*, lift `cb_refresh_token` off the
`Set-Cookie` header server-side, and store both as first-party httpOnly cookies (`cb_at`,
`cb_rt`) on our origin. Subsequent calls send `Authorization: Bearer`. No cross-site cookie
exists in the flow at any point.

**Rotation lives in `src/proxy.ts`** and nowhere else, because a Server Component cannot set a
cookie — a refresh performed during a data read could never be persisted, so it would repeat on
every request forever. Proxy is the only place that can both see a stale cookie and write its
replacement. The consequence: by the time any Server Component runs, the token is already fresh,
which is why `server.ts` has no retry logic.

> ⚠ `proxy.ts`, not `middleware.ts`. The `middleware` file convention is **deprecated in Next 16**
> and renamed to `proxy`, with the exported function renamed to match. Same capabilities. The
> shipped docs are at `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
> Note also that making a rotated cookie visible to the *current* render requires
> `NextResponse.next({ request: { headers } })` — mutating `request.cookies` alone does not reach
> the application, which is the bug behind "the refresh only works after a reload".

| File | Responsibility |
| --- | --- |
| `schema.ts` | Exact wire mirrors. No conveniences — disagreements are resolved in `map.ts`. |
| `errors.ts` | Every documented `code` → the sentence a person reads (§6.10). |
| `transport.ts` | The only `fetch`. The only thing that can raise `ApiError`. |
| `session.ts` / `jwt.ts` | First-party cookie store; unverified `exp` read for rotation timing. |
| `server.ts` | `authed()` / `anon()`. Server-only, enforced by `import "server-only"`. |
| `endpoints/*.ts` | All 36 operations, one module per API tag. |
| `proxy.ts` | Token rotation + the route guards. |
| `map.ts` | The API↔domain boundary — the only file that knows the two models differ. |
| `actions/auth.ts` | The sign-in flow as Server Actions. |

---

## Decisions taken

Confirmed 2026-08-26. Each replaces an assumption that would have cost a rewrite.

1. **Sharing follows the API: broadcast, not open QR.** Contacts becomes a recipient
   registry; sharing is contact-directed via `POST /cards/{id}/share`. Matches the locked
   scope where broadcast updates replaced address-book sync.
2. **Card appearance derives from `kind`.** `WORK|PERSONAL|PAYMENT|CUSTOM` → a fixed
   template + palette, so a card renders identically on every device with zero backend
   change. The design picker is read-only until the columns exist (ask #2).
3. **Email is required in the UI.** `POST /profile/onboarding` requires `primaryEmail` and is
   one-shot (409 on repeat), so a skipped email would be unfixable through that endpoint.
   "Skip for now" comes off the email step.

---

## What the backend still owes

Ordered by what blocks the demo hardest.

### 1 — ✅ RESOLVED: the endpoint exists, but document it in Swagger

`GET /api/v1/public/links/{token}` is **live**. It was not findable from the spec because it is
**not in `GET /api/docs-json`** — the live document still lists 36 operations and this is not one
of them. It was confirmed by the shape of its 404:

```
/public/links/{token} → 404 {"code":"SHARE_LINK_NOT_FOUND","message":"This link does not exist."}
/public/cards/{token} → 404 {"code":"NOT_FOUND","message":"Cannot GET /api/v1/public/cards/…"}
```

A domain code means the route exists and the record does not; `Cannot GET` means the route itself
is absent. `/c/[slug]` now calls the correct path and renders the real card.

**Two things still wanted from the backend:**

1. **Add it to Swagger.** An undocumented endpoint on the single most important user journey is how
   this got missed for five steps.
2. **Confirm the response shape.** Unverifiable without a real token, so `parsePublicCard` is
   shape-tolerant: it looks for the owner's name and the field list across the layouts this
   endpoint plausibly returns (`root`, `card`, `snapshot`, `data`) and reports which matched. One
   real link settles it — the `[api]` log prints `ok shape=… fields=…`, and the rendered page
   carries `data-public-shape`. If it logs `UNREADABLE_SHAPE keys=…`, those keys are the real
   payload and the parser needs one more branch.

Financial values must arrive **masked** in that payload. The owner's own view decrypts them; a
stranger's must not. The renderer masks `BANK_ACCOUNT` / `DIGITAL_WALLET` / `CRYPTO_WALLET` by type
and offers no reveal control on this page, so a masked value never renders in full — but the API
should not be sending the plaintext to an unauthenticated caller in the first place.

### 2 — Card appearance columns · degrades the design system to read-only

`CardResponseDto` has no `slug`, `templateId`, `paletteId`, `groundHex`, `surfaceStyle` or
`patternId`. `src/types/domain.ts` flagged each of these for this run. Until they exist, a user's
template and palette choice cannot survive a reload, so the picker is read-only rather than
lying, and `appearanceForKind()` in `map.ts` derives a deterministic look from `kind`. Add them
to `CardResponseDto` + `UpdateCardDto`.

(An earlier draft of this doc also listed `headerLayout`. That axis was already removed from
`CardSurface` before this integration — it is not an outstanding ask.)

`slug` is separate and also needed: the public URL wants a short, non-enumerable id (≤24
chars, `/^[a-z0-9-]+$/`) so the QR payload stays under 60 bytes.

### 3 — Serialize the field extension tables · costs full address + vCard `ADR`

The API's Prisma model already has 1:1 `AddressDetail`, `BankAccountDetail`,
`DigitalWalletDetail`, `CryptoWalletDetail` rows — confirmed from `profile-me.flatten.ts` in
this repo's history. But `ProfileFieldResponseDto.value` is a scalar string, so the components
are unreachable over the wire.

Consequence: a 7-component vCard `ADR` collapses to one line, and a bank account cannot be
masked structurally (only the whole string). `POST /profile/onboarding` *accepts* the
structure via `PostalAddressDto`, so the write path exists and only the read path is missing.

Suggested: add an optional `detail` object to `ProfileFieldResponseDto`, discriminated on
`type`. It is additive, so nothing breaks.

### 4 — Document `BAD_REQUEST` in the spec

The OpenAPI document lists no validation error for any endpoint, but the NestJS validation pipe
emits one and **every DTO can produce it**. Observed live:

```
POST /api/v1/auth/otp/request   {"phoneE164":"+447700900123"}
→ 400 {"code":"BAD_REQUEST","message":"phoneE164 must be a valid phone number in E.164 format"}
```

It was degrading to `UNKNOWN` in the client and showing "Something went wrong" for what is really
"check the number you typed", so it is now a first-class member of the taxonomy. Worth adding to
the spec's documented responses so it does not have to be discovered per endpoint. Pinned by
`tests/contract/api-live.test.ts`.

### 5 — Two profile fields with no endpoint behind them

Both surfaced while wiring `/profile`, and both are now honestly read-only in the UI rather than
controls that move and revert on reload.

**No way to change a name or an email.** `MeIdentityDto` carries `firstName`, `lastName` and
`primaryEmail`; `POST /profile/onboarding` sets them once and 409s on a second call; and there is
no `PATCH` anywhere on the profile surface. So a typo in a name entered during signup is permanent.
The identity block renders without an edit button. Suggested: `PATCH /profile/identity` accepting
the same three fields.

**No `isSensitive` column.** `ProfileField.isSensitive` drives §7.3 masking on every public
surface. The API has no such field — what it has is a set of *types* it encrypts at rest, so the
flag is derived from `type` in `map.ts` (`BANK_ACCOUNT` / `DIGITAL_WALLET` / `CRYPTO_WALLET`).

That is stricter in one way — a bank account cannot be un-marked by accident — and weaker in
another: **a non-financial field can no longer be marked sensitive at all.** A home address the
owner wants masked has nowhere to record that wish, and the profile row's switch says so instead
of pretending. Suggested: a boolean on `ProfileFieldResponseDto` + `UpdateProfileFieldDto`.

### 6 — No anonymous card link · the Share button cannot publish, only address

`POST /cards/{id}/share` **requires** a `contactId` (`ShareCardDto.required: ["contactId"]`), and
every ShareLink is therefore minted for one recipient. There is no way to get a link for a card
*as such* — the one to print on a badge, paste in a group chat, or put on a website.

Probed against staging the same way ask #1 was, since an undocumented route had already been found
once:

```
/api/v1/public/links/{token}   → SHARE_LINK_NOT_FOUND   ← route exists, record does not
/api/v1/cards/{id}/link        → Cannot GET             ← route absent
/api/v1/cards/{id}/links       → Cannot GET             ← route absent
/api/v1/cards/{id}/public-link → Cannot GET             ← route absent
/api/v1/cards/{id}/share-link  → Cannot GET             ← route absent
```

The live `GET /api/docs-json` is also **byte-identical** to `openapi.snapshot.json`, so nothing has
shipped since the snapshot was taken.

**What the UI does instead.** The share panel leads with a phone number: `POST /contacts` (which
upserts, so no prior registry entry is needed) then `POST /cards/{id}/share`, and a live link
exists on one press. This is a genuine model rather than a workaround — a per-recipient link is
revocable per person and its `viewCount` answers "did Priya open it" rather than "was this card
looked at", both of which an anonymous link would lose.

**The ask, if a public link is wanted:** either make `contactId` optional on
`POST /cards/{id}/share`, or add `POST /cards/{id}/publish`, returning a `ShareLinkResponseDto`
with `contactId: null`. The web side needs no new plumbing for it — `resolveCard` already takes
whatever URL it is handed, and the panel already labels live and preview links differently.

⚠ Not to be worked around by minting against the owner's own number. That pollutes the contacts
registry with a self-row and folds the owner's own opens into the recipient analytics.

### 7 — Smaller gaps

- **`DELETE /contacts/{id}`** — a contact can be created and edited but never removed. Now
  user-visible: the registry screen has Add and Import and no way to take anything out, so a
  number typed wrongly stays. Correcting one means adding the right number (which upserts) and
  living with the wrong row.
- **Pagination** on `GET /contacts`, `/cards`, `/share-links` — all return unbounded arrays.
  Fine at demo scale, not past a few hundred contacts.
- **`DELETE /templates/{id}`** — `isActive: false` is currently the only retirement path.
- **`GET /share-links/{id}`** — links are listable and patchable but not individually readable.

---

## Endpoint coverage

| tag | wired | notes |
| --- | --- | --- |
| auth (5) | 5 | Step 2. `POST /auth/me` is used by the session loader. |
| profile (14) | 13 | `GET /profile/fields/{id}` intentionally unused — the list read carries every field, so fetching one by id has no caller. |
| contacts (5) | 5 | Step 4. |
| cards (7) | 7 | Step 5. |
| share-links (2) | 2 | Step 5. |
| whatsapp-templates (3) | 0 | Operator surface with no user-facing screen — see below. |

**34 of 36 reached by a screen.** The two that are not:

- `GET /profile/fields/{id}` — the list read carries every field, so fetching one by id has no
  caller.
- the three `whatsapp-templates` endpoints — they register a Twilio `contentSid` that already
  exists in Twilio, verify nothing against it, and are read by no user-facing flow. They matter
  for exactly one reason: `POST /cards/{id}/share` cannot send a WhatsApp message until an
  approved `CARD_SHARE` template is registered. `shareCardAction` handles that case explicitly —
  it treats `CARD_SHARE_TEMPLATE_NOT_CONFIGURED` as a **success with `templateMissing: true`**,
  because the link is minted and live either way, and hiding a working link behind an apology
  would be the wrong call. Registering templates is an operator job; a screen for it is a
  decision, not an omission.

`tests/contract/api-contract.test.ts` asserts all 36 are *implemented in the client*. This table
is about which are *reached by a screen*.

## Where the UI changed to follow the API

- **A group stopped being a category.** §5.5 said groups are "renameable and never deletable",
  written when a group *was* a `FieldCategory` — one per category, seeded and fixed. The API's
  group is one instance of a repeatable thing: a specific job, a specific bank account, several
  per category. So the group editor gained a **delete** control (behind a confirm stating that
  archiving a group archives every field in it) and `/profile` gained an **add** control, since
  otherwise `POST /profile/groups` would be unreachable.
- **Ungrouped fields needed somewhere to live.** `PERSONAL`, `IDENTITY` and `CUSTOM` fields carry
  no `groupId` upstream, but a domain field requires one and the screen renders one section per
  group. `map.ts` invents a section per category to hold them, marked with a `category:` id
  prefix. Those sections have no rename, no delete and no editor link — there is no record to
  address. Sending a synthetic id to the API as a real `groupId` would 404, which is why the
  translation lives in exactly one function.
- **Contacts were inverted, not ported.** The screens modelled *inbound leads*: "everyone who
  scanned your card and saved their details back to you", with a column for the card they scanned
  and filters over the field categories their snapshot contained. `ContactResponseDto` has none of
  that — it is a number, a name you chose, a private note, and how it arrived.

  So `Contact` in `types/domain.ts` was replaced, `SavedContactField` and its `savedContactFields`
  adapter were deleted, and `SourceCardLink` was deleted with them (there is no source card). The
  list is now Name · Number · Cards sent · Added, filtered by `ContactSource`; the detail screen's
  right-hand column is **what you have sent them and whether they opened it**, joined from
  `GET /share-links`.

  The screens also gained **Add contact** and **Import**, because a registry you cannot add to is
  not a registry. The old empty state — "share a card and wait for a scan" — was the clearest
  symptom of the inversion: waiting is not how contacts arrive now.
- **Sharing became an act aimed at one person.** The share panel was a QR code, a public link and
  a `.vcf` — an *anonymous* model: publish one link, let anyone scan it. Every API share link is
  minted for a specific `contactId`, so sharing is now "pick a contact, send". The QR and the
  `.vcf` are untouched and still work entirely offline; they are simply no longer the only way,
  or the primary one.
- **The card's design panel previews but does not save.** No column exists for `templateId`,
  `paletteId`, `groundHex`, `finish` or `texture` (ask #2), so Save does not send them and the
  panel says so in place. The controls stay live because evaluating a design is genuinely useful —
  unlike the sensitive toggle, which was disabled outright because a switch that reverts teaches
  nothing.
- **`/c/[slug]` stopped rendering fixtures.** It used to render a full designed card from fixture
  data **for any slug** — fine while nothing was real, actively misleading now, since a demo would
  show one person's card to anyone opening any link. It now calls the endpoint from ask #1 and
  reports honestly when it is absent. `opengraph-image.tsx` was **deleted** for the same reason and
  is worse: it would have published a fixture card as the WhatsApp link preview for a stranger's
  link. See `src/app/c/[slug]/OPENGRAPH.md`.
- **`?state=` became a review override rather than the data source.** 122 e2e URLs address
  loading / empty / error / offline surfaces that a healthy server cannot be asked to produce. So
  `success` is now the real API response and the other four still render on demand. See
  `src/lib/screen-data.ts`.

---

## Verification

```bash
npx tsc --noEmit                                          # types
npx vitest run                                            # 1340 unit + contract, live skipped
LIVE_API=1 npx vitest run tests/contract/api-live.test.ts  # 4 checks against real staging
```

`api-live.test.ts` is skipped unless `LIVE_API=1`: a suite that needs the network fails during
a deploy and passes while offline, so it cannot be a gate — but mocks alone cannot catch a
wrong prefix or a changed envelope. Both kinds are present.

### What the live checks established

**Twilio is configured on staging, and `devCode` is not returned.** Verified by driving the real
sign-in flow: `POST /auth/otp/request` succeeded and the OTP screen rendered no dev-code notice,
meaning `RequestOtpResponseDto.devCode` was absent and a real WhatsApp send was attempted.

The consequence is concrete: **demonstrating sign-in needs a handset somebody owns.** There is no
safe synthetic input, because the API's phone validation rejects precisely the ranges that would be
safe to use — Ofcom's permanently-unassigned drama range (`+447700900123`) is refused as invalid.

The flow itself is verified end to end against staging: a wrong code returns 409 `OTP_INVALID`, and
the UI renders "That code didn't match. Check the digits and try again." with the API's own
developer message never reaching the screen.

### ⚠ The Playwright suite is currently blocked by the auth guard

Every `(app)` route now redirects an unauthenticated request to `/signin/phone?next=…`. Verified:

```
GET /contacts?state=empty  →  /signin/phone?next=%2Fcontacts%3Fstate%3Dempty
```

The e2e specs navigate straight to those routes — `dashboard`, `cards`, `contacts`, `profile`,
`builder`, `card-detail` — so **all of them now land on the sign-in screen instead of the screen
under test.** That is the guard working, not a regression, but the suite cannot run until it can
present a session.

Two ways out, in preference order:

1. **A Playwright storage-state fixture.** Sign in once against staging, save the `cb_at` / `cb_rt`
   cookies, and reuse them. Needs the phone number below; it is the honest option because the
   tests then exercise the real guard.
2. **A test-only session seam.** E.g. honour a signed `cb_at` minted from a fixture secret when
   `NODE_ENV !== "production"`. Faster and offline-capable, but it is a second auth path, and a
   second auth path is a thing that can diverge from the first.

The vitest suite (1,401 tests) is unaffected — it renders components directly and never routes.

### Ask #1 is now the last thing standing between this and a complete demo

Everything else is wired. The recipient's view is not, and it cannot be faked honestly:

```
GET /api/v1/public/cards/{token}     # unauthenticated
→ 200 { cardName, kind, fullName, avatarUrl, fields: [{ type, label, value }] }
→ 410 when the link is REVOKED
→ 404 unknown token
```

`src/lib/api/public-card.ts` already calls it, shape-checks the response, and distinguishes *the
endpoint is not deployed* from *this token is unknown* — the two are both 404, separated by
NestJS's `Cannot GET` message on an unmatched route. Verified live: `/c/some-token` renders "This
link isn't live yet" today, and starts rendering the card the day the endpoint ships.

Financial values must arrive **masked** in that payload. The owner's own view decrypts them; a
stranger's must not.

### Still needed

A **staging phone number you control**. Everything behind the session guard — `/profile`,
`/profile/groups/*`, and the cards and contacts screens to come — has been built and type-checked
but **never rendered against real data**, because reaching it requires completing an OTP.

Two specific things it would settle:

1. **Ask #3.** How the API actually explodes an onboarding bank account or postal address into
   fields. `toProfile` is written shape-tolerant precisely because this is unknown: it renders
   whatever fields a group contains, in `position` order, so an unexpected layout produces
   unexpected rows rather than a crash or a dropped field. Worth re-reading that mapper's header
   once a real profile can be inspected.
2. **Whether `GET /profile/fields` returns `IDENTITY` and `CUSTOM` fields at all.** `toProfile`
   handles them if present; nothing confirms they are.
