# Backend — the card QR needs a link it is allowed to carry

The QR renderer on the frontend is finished and correct. It encodes whatever string it is
handed (`resolved.qrPayload`), at ECC H, as inline SVG, with a computed quiet zone. It is not
a placeholder and it does not need work.

**The problem is that there is no URL the API can give it.**

Today `resolveCard` falls back to `${SITE_URL}/c/${card.slug}` — and `slug` does not exist on
the API. There is no `slug` column in `schema.prisma`. Our own type file has carried the note
*"the API will need a `slug` column"* since the card work started. So a card the owner has
never shared with anyone prints a QR that resolves to a 404.

This document is everything needed to close that.

---

## 1. Why an existing `ShareLink` token cannot go in the QR

`ShareLink` is `@@unique([cardId, contactId])`. Every token belongs to a **(card, person)**
pair, which is architecture invariant #1 and is correct — we are not asking you to relax it.

But a QR is scanned by a stranger. At scan time there is no `Contact` row for them. So there
is currently no token in the system that a QR is *allowed* to encode.

And putting one recipient's token in the QR would be actively wrong, not merely a shortcut:

| If the QR carried a per-contact token | Consequence |
|---|---|
| Owner revokes that one contact | The printed/lock-screen QR dies for everybody |
| A stranger scans | `viewCount` on a known recipient's link is incremented by an anonymous scan |
| Owner shares with a second person | Nothing moves — the card still advertises recipient #1 |

**We need two token namespaces with one destination page.** A per-contact `ShareLink` token
(exists, works, keep as is) and a per-card public token (new, below).

---

## 2. What we need — the shape

| Change | Where | Notes |
|---|---|---|
| `publicToken` column | `Card` model | `String @unique`. Add nullable → backfill → make required |
| Mint on create | `CardsService.create` (`cards.service.ts:49`) | Reuse `generateShareToken()` — no new crypto |
| `publicUrl` on read | `CardResponseDto` | `${SHARE_BASE_URL}/c/${publicToken}` |
| Resolve the token | `ShareLinksService.resolvePublic` (`share-links.service.ts:187`) | Try `ShareLink`, then fall back to `Card.publicToken` |
| Scan tracking | new `CardScan` model | Needed for the sharing dashboard regardless |

### 2.1 The column

```prisma
model Card {
  // ...
  publicToken String? @unique   // → String @unique after backfill
}
```

Use the existing `generateShareToken()` from `sharing/share-token.util.ts`: 128 bits, base62,
22 chars, already spec'd and unit-tested. Do **not** invent a second token format — one
generator keeps the length and entropy guarantees uniform across both namespaces.

Backfill every existing `Card` in the migration. A card without a `publicToken` has an
unscannable QR, so nullable-forever is not an option.

### 2.2 Minting

`CardsService.create` writes `publicToken: generateShareToken()` alongside `name`/`kind`. No
DTO change — the client never supplies it and must not be able to.

The token is **immutable for the life of the card**. If an owner ever needs to kill a
distributed QR we would add an explicit rotate endpoint later; that is not in this scope, but
please do not make `update` able to touch it by accident.

### 2.3 Exposing it

Add to `CardResponseDto`:

```ts
@ApiProperty({ example: 'https://cards.contactbook.app/c/4f8Kq2mR7xJp1sN0vLtQ9a' })
publicUrl!: string;
```

Built the same way `ShareLinksService` already builds one at `share-links.service.ts:285`:

```ts
`${this.config.shareBaseUrl.replace(/\/+$/, '')}/c/${card.publicToken}`
```

Please return the **full URL**, not the bare token. The frontend must never be the thing that
knows how to assemble a public URL — that is how the two sides drift, and it is exactly what
produced the dead `/c/{slug}` guess we are fixing.

Needed on `list`, `getOne`, `create` and `update` — the card list renders QRs too.

### 2.4 Resolving it

`GET /api/v1/public/links/:token` currently only looks up `ShareLink` and 404s otherwise.
Extend `resolvePublic(token)`:

1. Look up `ShareLink` by token. If found → existing behaviour, unchanged, including the
   `viewCount` / `firstViewedAt` / `lastViewedAt` bump and the `410 SHARE_LINK_REVOKED` path.
2. If not found, look up `Card` by `publicToken`.
   - Found and `archivedAt === null` → return the **same** `PublicCardResponseDto`.
   - Found and archived → `410`, same shape as a revoked link.
   - Neither → the existing `404 SHARE_LINK_NOT_FOUND`.

**Please keep this on one route.** A separate `/public/cards/:token` would mean the
recipient's phone has to know which kind of link it is holding before it can resolve it, and
it cannot know that. Both namespaces are 128-bit base62, so cross-namespace collision is not
a practical risk.

Same `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow` headers on both paths —
invariant #2 applies identically to a scanned card.

### 2.5 Scan tracking

A `ShareLink` scan increments that link's counters. A `publicToken` scan has nowhere to go
today, so it would be invisible. Minimum viable:

```prisma
model CardScan {
  id        String   @id @default(uuid())
  cardId    String
  card      Card     @relation(fields: [cardId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@index([cardId, createdAt])
}
```

No IP, no fingerprint, no precise UA string — a scan is an anonymous stranger and we should
not start building a profile of one. Count and timestamp is enough to answer "has anyone
scanned this card", which is what the dashboard needs.

---

## 3. The scan → connect flow (the Aug 27 client ask)

The client's requirement from the Aug 27 review is that **a QR scan sends a WhatsApp message
to both parties.** That is impossible for an anonymous scan — we do not have the scanner's
number. So the flow has to earn it:

1. Scan → `/c/{publicToken}` → **the card renders immediately.** Never gate this behind a
   form; a gated scan is a dead scan.
2. Below the card, a *"Save & connect"* action → scanner enters their phone → OTP.
3. On verify, the backend:
   - `ContactsService.upsertByPhone(ownerId, phoneE164)` — the method already exists
   - mints a per-contact `ShareLink` for `(cardId, contactId)`, reusing the existing token if
     the pair already has one (invariant #1 holds untouched)
   - enqueues **two** outbox rows **in the same transaction** as the above (invariant #3)

| Outbox kind | To | Purpose |
|---|---|---|
| `send_whatsapp_card_share` | the scanner | Exists already. "Here is X's card" |
| `send_whatsapp_scan_notice` | the card owner | New. "Y just scanned your card" |

`MessagePurpose` in `schema.prisma` already anticipates this — the comment on the enum reads
*"CARD_UPDATE, SCAN_REPLY land with broadcast/notify and QR scanning."* So: add `SCAN_REPLY`
to the enum, register a `WhatsAppTemplate` for it, and register the handler in
`SharingModule.onModuleInit` exactly as `send_whatsapp_card_share` is registered today.

Note the existing handler throws `CARD_SHARE_TEMPLATE_NOT_CONFIGURED` until an approved
template exists in Twilio. The same will be true for `SCAN_REPLY`. **Template approval takes
weeks — please start that submission before the code, not after.**

This is also what makes the sharing dashboard real: an anonymous scan upgrades itself into a
tracked connection, so "who has my card" stops being only the people we messaged first.

---

## 4. One hard constraint — payload budget

`qr-geometry.ts` caps a QR payload at **60 UTF-8 bytes**. Above that the symbol gets denser
and the scan gets marginal at arm's length.

```
https://cards.contactbook.app/c/  →  32 bytes
4f8Kq2mR7xJp1sN0vLtQ9a            →  22 bytes
                                     ── 54 bytes ✓
```

Fits, with 6 bytes of headroom. But that headroom is a function of `SHARE_BASE_URL`.

**Please keep the production `SHARE_BASE_URL` at or under 38 bytes** including the scheme and
the trailing `/c/`. If a longer domain or a path prefix is ever needed, tell us before it
ships — we would have to raise the cap and re-run the decode suite, not discover it from a
card that will not scan.

(On our side: the cap is currently declared and unit-tested but never actually asserted
against a live payload. We are adding that check when we wire `publicUrl` in.)

---

## 5. What the frontend does once this lands

Small, and listed here only so you can see the seam:

- Add `publicUrl` to the web `Card` type; delete the `slug` fiction
- `resolve-card.ts:374` — fall back to `card.publicUrl` instead of the `/c/{slug}` guess.
  That single line is the whole "inject the link into the QR" change; `<QrZone>` already
  reads `resolved.qrPayload`
- `card-detail-client.tsx:209` — **fix a precedence bug of ours.** `shareUrl` currently
  prefers the newest ACTIVE `ShareLink` over the fallback, which means the moment an owner
  shares with one person their card's QR silently switches to advertising that person's
  private link. The card's own QR must always be the card's public token
- Build the scan page's "Save & connect" step against whatever OTP shape you expose

---

## 6. How we will verify it end to end

1. Create a brand-new card, share it with nobody
2. `GET /cards/{id}` returns a `publicUrl`
3. The card page renders a QR encoding exactly that string (`data-qr-*` attributes make this
   assertable in Playwright)
4. Scan it with a real phone camera → the public card page loads
5. Archive the card → the same scan now 410s
6. A `CardScan` row exists for each scan

Step 4 is the one that has never once worked. That is the milestone.

---

## 7. Open questions for you

1. **Backfill timing** — is a nullable-then-required two-step fine, or do you want the column
   required from the first migration with a data migration in between?
2. **Rotation** — should we design `publicToken` as rotatable now (owner can kill a
   distributed QR), or defer? We do not need it for MVP but the column is cheap to plan for.
3. **`SCAN_REPLY` template** — who owns the Twilio submission, and has it started? This is
   the long pole on the notification half.
4. **Rate limiting** — `/public/links/:token` is unauthenticated and a `publicToken` is now
   effectively a permanent public URL. Is there a limiter in front of it, or should we assume
   Caddy handles it?

Items 1–2 do not block us. Item 3 blocks the notification half only; the QR itself works
without it. Item 4 we would like an answer on before this is public.
