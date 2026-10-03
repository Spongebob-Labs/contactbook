---
name: contactbook-wallet-pass-fe
description: Frontend integration guide for "Add to Apple Wallet" — the backend is fully built (branch feat/wallet-pass). Load this before building the Wallet button in the dashboard, verifying the web proxy, or writing iOS-detection logic.
---

# Apple Wallet pass — frontend integration guide

## What's already built (backend — do not rebuild)

Everything below is live on `feat/wallet-pass`. No backend changes needed for v1.

| What | Where | Notes |
|---|---|---|
| `GET /api/v1/cards/:id/wallet-pass` | `WalletPassController` | Returns signed `.pkpass`. Auth: JWT (cookie or Bearer). `404` if card not yours/archived; `409 WALLET_NOT_CONFIGURED` if feature off. |
| Apple web service (5 endpoints at `/api/wallet/v1/...`) | `WalletWebServiceController` | Called **by Apple devices, not by the web app**. FE never touches these. |
| `WalletRegistration` DB table | Migration `20261003091029_wallet_registration` | Stores device push tokens. Managed entirely server-side. |
| `wallet_push` outbox writes | `CardsService.update()` + `CardsService.archive()` | Card edits and archives automatically push an update to installed passes. FE has no role here. |
| Pass content | `pass-builder.ts` | Owner name, card name, headline, QR = card `publicToken` URL. No field values, no phone numbers. Colors from card palette/groundHex. |

The pass is generated **on demand from current DB data** on every request — never cached on disk. iOS stores it in Wallet; the server holds nothing.

---

## What the frontend needs to build

### 1. iOS-only detection

Show the button **only on iPhone/iPad**. Android/desktop gets nothing (or a later Google Wallet button).

```tsx
const isIOS = /iPhone|iPad/i.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : ''
);

{isIOS && <AddToWalletButton cardId={card.id} />}
```

### 2. The button — must be a link, not fetch

**Critical:** iOS Safari must receive the `application/vnd.apple.pkpass` response itself to trigger the "Add to Wallet" sheet. A `fetch()` + blob approach will NOT work.

```tsx
// ✅ Correct — direct navigation, iOS Safari handles the content type
export function AddToWalletButton({ cardId }: { cardId: string }) {
  return (
    <a href={`/api/cb/cards/${cardId}/wallet-pass`} download>
      <img
        src="/add-to-apple-wallet.svg"
        alt="Add to Apple Wallet"
        height={44}
      />
    </a>
  );
}

// ❌ Wrong — fetch intercepts the response before iOS can handle it
const res = await fetch(`/api/cb/cards/${cardId}/wallet-pass`);
const blob = await res.blob(); // iOS Wallet never sees this
```

`window.location.assign()` also works if you need programmatic navigation.

### 3. Apple's official badge

Do **not** design a custom button. Apple requires their official "Add to Apple Wallet" badge:
- Download from https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/
- Available in SVG and PNG, dark/light variants
- Minimum size: 44pt height. Do not stretch, recolor, or add effects.
- Place the badge in `apps/web/public/` (e.g. `add-to-apple-wallet.svg`)

### 4. Error handling

| Response | What to show |
|---|---|
| `200 application/vnd.apple.pkpass` | iOS opens "Add to Wallet" sheet automatically — no UI needed |
| `409 WALLET_NOT_CONFIGURED` | Hide the button (or show "Coming soon") — never an error toast |
| `404 CARD_NOT_FOUND` | Shouldn't happen if the button is only shown for the owner's own cards |
| `401` | Re-login flow (same as any other 401) |

Since the button is a plain `<a>` link, you can't intercept the 409 response in-band. The cleanest approach is to **conditionally render the button** based on a flag from the API or a feature-flag in the app config:

```tsx
// Option A: check a /api/v1/config or /api/v1/dashboard endpoint that
// exposes walletEnabled: true/false (add this if needed)

// Option B: just hide the button until you've confirmed wallet is configured
// in staging/prod — 409 only fires when WALLET_* env vars are absent
```

For now Option B is fine — the button appears once `WALLET_*` env vars are deployed.

### 5. Verify the web proxy forwards headers

The FE hits `/api/cb/cards/:id/wallet-pass` which proxies to `GET /api/v1/cards/:id/wallet-pass`. The proxy **must** forward:

- `Content-Type: application/vnd.apple.pkpass`
- `Content-Disposition: attachment; filename="<slug>.pkpass"`
- `Cache-Control: no-store`

Check `apps/web/src/app/api/cb/[...path]/route.ts` (or wherever the proxy lives). A proxy that rewrites `Content-Type` to `application/json` or `text/plain` will silently break Wallet. Verify with:

```bash
curl -I "https://<your-staging-domain>/api/cb/cards/<id>/wallet-pass" \
  -H "Cookie: cb_access_token=<token>"
# Must show: content-type: application/vnd.apple.pkpass
```

### 6. Where to place the button in the dashboard

On the card detail view / card editor — next to the QR code download or share button. Mock placement:

```
┌─────────────────────────────┐
│  My Work Card               │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │  ← card preview
│                             │
│  [Share]  [QR Code]         │
│  [Add to Apple Wallet ↓]    │  ← iOS only, uses Apple badge
└─────────────────────────────┘
```

Only show on the **owner's** card view (not on a recipient's public share page).

---

## What the pass looks like on iPhone

```
┌─────────────────────────────┐
│  [ContactBook logo]  My Card │  ← logoText = card.name
│─────────────────────────────│
│  NAME                       │
│  Aayush Sharma              │  ← owner first + last name
│─────────────────────────────│
│  TITLE                      │
│  Head of Partnerships       │  ← card.headline (empty if unset)
│─────────────────────────────│
│  [QR code]                  │  ← encodes publicToken URL
│  Scan to open card          │
└─────────────────────────────┘
Back of pass: "Card link" + the live URL
```

Colors match the card's palette/groundHex. No phone numbers, no email, no field values — by design (the QR leads to the live card page which shows everything the owner chose to share).

---

## Staging / production checklist

Before the button goes live in production, the following GitHub Actions secrets must be set in the `staging` (and later `production`) environment **and** added to `scripts/render-api-env.sh`:

```
WALLET_PASS_TYPE_ID=pass.com.getcontactbook.card
WALLET_TEAM_ID=6Z2D66ASPQ
WALLET_ORG_NAME=ContactBook
WALLET_WEB_SERVICE_URL=https://apistaging.getcontactbook.com/api/wallet
WALLET_SIGNER_CERT_B64=<base64 of pass.pem>
WALLET_SIGNER_KEY_B64=<base64 of passkey.pem>
WALLET_WWDR_CERT_B64=<base64 of wwdr.pem>
WALLET_AUTH_SECRET=<≥32 random chars>
```

`WALLET_WEB_SERVICE_URL` must be the **API host** (not the web/Vercel domain) — Apple devices call this directly. The staging API host is `apistaging.getcontactbook.com`.

Without these, the feature is silently off and the endpoint returns `409 WALLET_NOT_CONFIGURED`.

---

## What push updates look like (no FE work needed)

When the owner edits a card (name/headline/colors) or archives it:
1. BE writes a `wallet_push` outbox message in the same DB transaction
2. The outbox handler fires APNs push → iPhone receives a silent notification
3. iPhone calls `GET /api/wallet/v1/passes/...` → gets a fresh `.pkpass`
4. Wallet updates the pass automatically in the background

The owner doesn't need to re-add the pass. The FE has no role in this flow.

---

## Signing certificate expiry

The pass signing cert expires **2027-11-02** (one year from creation). After that, new passes can't be signed and APNs pushes fail. Put a renewal reminder in the calendar for **2027-10-01**. Renewing means generating a new CSR + cert — same process as the original setup.
