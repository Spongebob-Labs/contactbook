---
name: contactbook-share-page
description: How to build the public share-link page in apps/web — the page a recipient's phone opens when they tap a ContactBook link from WhatsApp. Load this before creating the /c/[token] route, wiring it to the public API, or making any decision about caching, rendering, or error states on that page. Not built yet as of 2026-08-23 — this is the build guide, not a description of shipped code.
---

# Building the public share page

This is the page on the other end of the link a WhatsApp message sends. No login, no app
install — it has to work the instant someone taps a link on their phone, opened in whatever
mobile browser they have. That constraint drives every decision below.

## The URL scheme

A share link looks like `https://www.getcontactbook.com/c/<token>` — see
`ShareLinksService.buildUrl()` in `apps/api/src/sharing/share-links.service.ts` for exactly how
the API constructs it (`SHARE_BASE_URL` config + `/c/` + the token). Build the route at:

```
apps/web/src/app/c/[token]/page.tsx
```

`token` is an opaque 22-char base62 string (128 bits of entropy) — treat it as a bearer
credential, not a display id. Never log it, never echo it into an error page, don't put it
anywhere Sentry/analytics would capture full URLs unless that tool is configured to scrub them.

## The one call this page makes

```
GET {API_BASE}/api/v1/public/links/:token
```

No `Authorization` header, no cookies, nothing to authenticate — this is the one endpoint in
the whole API with no guard, by design (`PublicLinksController`). It already sets
`Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow` on every response.

**Response shape** (`PublicCardResponseDto` — see
`apps/api/src/sharing/dto/public-card-response.dto.ts` for the source of truth):

```ts
{
  owner: {
    name: string | null;      // firstName + lastName, or null if never onboarded
    photoUrl: string | null;
  };
  card: {
    name: string;             // "Work"
    kind: "WORK" | "PERSONAL" | "PAYMENT" | "CUSTOM";
    updatedAt: string;        // when the field SELECTION last changed, not a field's value
  };
  fields: Array<{
    type: FieldType;          // PHONE, EMAIL, ADDRESS, URL, SOCIAL_LINK, BANK_ACCOUNT, ...
    label: string;            // "Work mobile" — already the right display label
    value: string;            // live, decrypted, ready to render as-is
  }>;
}
```

Fields arrive **pre-ordered** (server sorts by position) — render the array in order, don't
re-sort client-side. There are no ids anywhere in this response, deliberately (nothing to probe
the authenticated API with) — don't try to build a "click to edit" link from this data; that's
a different, authenticated surface entirely.

## Error states — two distinct ones, render them differently

| HTTP | code | What it means | Suggested UI |
| --- | --- | --- | --- |
| 404 | `SHARE_LINK_NOT_FOUND` | Token never existed, or is malformed | Generic "this link isn't valid" — don't hint at why |
| 410 | `SHARE_LINK_REVOKED` | Was real, owner revoked it | "The owner is no longer sharing this" — a person who once had access understands this differently than a broken link |

Both come through the standard error envelope (`{statusCode, code, message, requestId}`) — branch
on `code`, not on parsing `message`.

## Freshness is not optional

Architecture invariant #2: **nothing here may ever be served from a cache.** An owner edits a
phone number and expects everyone holding a link to see it immediately — that promise breaks the
moment this page is statically generated, ISR-cached, or fetched with default Next.js caching.

Concretely, in the App Router:

```ts
export const dynamic = 'force-dynamic'; // no static generation, no ISR for this route

async function getCard(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/public/links/${token}`, {
    cache: 'no-store', // do not let fetch's own cache override this either
  });
  // ...
}
```

Do not add a CDN cache rule for `/c/*` at the Vercel/edge layer either, for the same reason.

## Rendering guidance per field type

The `type` on each field is what makes a nicer-than-plain-text render possible without any
extra API calls:

- `PHONE`, `LANDLINE` → `tel:` link
- `EMAIL` → `mailto:` link
- `URL`, `SOCIAL_LINK` → `<a href>`, opens in a new tab
- `ADDRESS` → plain text is fine for v1; a maps deep-link is a nice-to-have, not required
- `BANK_ACCOUNT`, `DIGITAL_WALLET`, `CRYPTO_WALLET` → plain text, but consider a "copy" button —
  these are exactly the fields someone opened the link to copy-paste
- everything else (`TEXT`, `DATE`, `JOB_TITLE`, `COMPANY`, `CUSTOM`, ...) → label + value, plain

## What's already handled server-side (don't rebuild it)

- **View counting**: every `GET` to this endpoint increments `viewCount` and sets
  `firstViewedAt`/`lastViewedAt` as a side effect. A plain page load already counts as a view —
  no separate "track this view" call needed.
- **Revoked/archived cards**: the resolver checks both `ShareLink.status` and the parent card's
  `archivedAt`, so a 410 covers both cases already; the FE doesn't need to know the difference.

## What's designed but NOT built yet — don't call these

- `GET /public/links/:token/vcard.vcf` — a "save contact" button can't hit this yet. If you need
  one before it ships, build the `.vcf` client-side from the `fields` array you already have
  rather than waiting.
- `POST /public/links/:token/events` — the finer-grained analytics beacon (field taps, vCard
  downloads, "become a member" CTA clicks) doesn't exist yet. Don't wire a call to it.
- Per-recipient field hiding (`ShareLinkFieldOverride`) — every contact holding a link to the
  same card currently sees the exact same field set. Don't build UI implying otherwise.
- Update notifications — there is no "3 people are 2 versions behind" concept live yet
  (`CardVersion` doesn't exist). This page has no "what changed" state to show.

## SEO / privacy

The API already sends `X-Robots-Tag: noindex, nofollow`. Mirror it in the page's own metadata
too (defense in depth — some crawlers only respect one or the other):

```ts
export const metadata = { robots: { index: false, follow: false } };
```

These pages contain a real person's live contact details — phone numbers, financial handles.
They must never end up indexed, cached by a browser extension, or screenshotted into a tool
that persists it longer than the owner intended.
