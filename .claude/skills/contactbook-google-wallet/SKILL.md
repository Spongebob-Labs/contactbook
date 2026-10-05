---
name: contactbook-google-wallet
description: Full build guide for Google Wallet pass integration in ContactBook — backend (NestJS service, REST API, outbox), frontend (Android detection, Save to Google Wallet button), env wiring, and differences from the Apple Wallet implementation. Load this before creating any google-wallet/ module in apps/api, touching Google Cloud service accounts, or building the Android Wallet button in apps/web.
---

# Google Wallet pass — full build guide (BE + FE)

## What already exists (do not rebuild)

The Apple Wallet feature is fully shipped on `refac-new-build`:
- `apps/api/src/wallet/` — pass generation, APNs push, device registration
- `WalletRegistration` Prisma model
- `wallet_push` outbox kind

Google Wallet shares the outbox pattern and card ownership checks but needs its own module.

---

## Architecture overview

```
Owner taps "Save to Google Wallet"
  → FE calls GET /api/v1/cards/:id/google-wallet-pass
  → BE creates/updates the Pass Object in Google's API
  → BE returns { url: "https://pay.google.com/gp/v/save/<jwt>" }
  → FE redirects to that URL (or opens it)
  → Google Wallet opens on Android

Card edited/archived
  → BE writes google_wallet_push outbox in same transaction
  → Outbox handler calls PATCH /walletobjects/v1/genericObject/{id}
  → Google propagates update to all devices automatically
  (no device registration table, no push tokens, no server-exposed endpoints)
```

---

## Phase 1 — Backend

### 1.1 Google Cloud setup (one-time, not in code)

1. Create a project at console.cloud.google.com
2. Enable the **Google Wallet API** (`walletobjects.googleapis.com`)
3. Create a service account → add role **Wallet Object Issuer**
4. Download the JSON key file — extract `client_email` and `private_key`
5. Register as an issuer at pay.google.com/business/console → get your **Issuer ID** (long number like `3388000000022XXXXXX`)
6. New accounts are in demo mode. Passes show `[TEST ONLY]` until Google approves production access.

### 1.2 Environment variables

Add to `apps/api/src/config/env.schema.ts` with the same all-or-none `superRefine` pattern as WALLET_*:

```typescript
// Google Wallet — optional, all-or-none
GOOGLE_WALLET_ISSUER_ID: z.string().optional(),
GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_B64: z.string().optional(), // base64(private_key PEM)
GOOGLE_WALLET_CLASS_SUFFIX: z.string().optional(), // e.g. "card" → class ID = issuerId.card

const GOOGLE_WALLET_REQUIRED = [
  'GOOGLE_WALLET_ISSUER_ID',
  'GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_B64',
  'GOOGLE_WALLET_CLASS_SUFFIX',
] as const;
const anyGoogleWalletSet = GOOGLE_WALLET_REQUIRED.some((k) => !!env[k]);
if (anyGoogleWalletSet) {
  for (const key of GOOGLE_WALLET_REQUIRED) {
    if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} required when any GOOGLE_WALLET_* var is set` });
  }
}
```

Also add to `AppConfigService`:
```typescript
get googleWallet() {
  const id = this.env.GOOGLE_WALLET_ISSUER_ID;
  if (!id) return undefined;
  return {
    issuerId: id,
    serviceAccountEmail: this.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL!,
    serviceAccountKeyB64: this.env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_B64!,
    classSuffix: this.env.GOOGLE_WALLET_CLASS_SUFFIX!,
  };
}
```

### 1.3 Pass IDs — must be deterministic

| Resource | ID format | Example |
|---|---|---|
| Pass Class | `{issuerId}.{classSuffix}` | `3388...card` |
| Pass Object | `{issuerId}.{cardId}` | `3388...592a51af-...` |

Using `cardId` as the object ID suffix means updates always hit the right object without a lookup table. Class is created once at service init.

### 1.4 npm dependency

```bash
pnpm --filter api add google-auth-library jsonwebtoken
pnpm --filter api add -D @types/jsonwebtoken
```

`google-auth-library` handles the service account JWT for API auth. `jsonwebtoken` signs the Save URL JWT.

### 1.5 GoogleWalletService

Create `apps/api/src/google-wallet/google-wallet.service.ts`:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import * as jwt from 'jsonwebtoken';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { ApiError } from '../common/errors/api-error';

const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';

@Injectable()
export class GoogleWalletService implements OnModuleInit {
  private readonly cfg: ReturnType<AppConfigService['googleWallet']>;
  private auth!: GoogleAuth;
  private privateKey!: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    this.cfg = config.googleWallet;
    if (this.cfg) {
      this.privateKey = Buffer.from(this.cfg.serviceAccountKeyB64, 'base64').toString('utf8');
      this.auth = new GoogleAuth({
        credentials: {
          client_email: this.cfg.serviceAccountEmail,
          private_key: this.privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
      });
    }
  }

  /** Ensures the Pass Class exists. Called once at module init. */
  async onModuleInit(): Promise<void> {
    if (!this.cfg) return;
    await this.upsertPassClass();
  }

  /** Returns the Save to Google Wallet URL for a card the caller owns. */
  async getSaveUrl(userId: string, cardId: string): Promise<string> {
    if (!this.cfg) {
      throw ApiError.conflict('GOOGLE_WALLET_NOT_CONFIGURED', 'Google Wallet is not configured on this server.');
    }

    const card = await this.prisma.card.findFirst({
      where: { id: cardId, userId },
      select: {
        id: true, name: true, headline: true, publicToken: true,
        archivedAt: true, groundHex: true, paletteId: true, templateId: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!card || card.archivedAt) {
      throw ApiError.notFound('CARD_NOT_FOUND', 'Card not found.');
    }

    await this.upsertPassObject(card);

    const objectId = `${this.cfg.issuerId}.${cardId}`;
    const classId = `${this.cfg.issuerId}.${this.cfg.classSuffix}`;

    const claims = {
      iss: this.cfg.serviceAccountEmail,
      aud: 'google',
      typ: 'savetowallet',
      origins: [this.config.shareBaseUrl],
      payload: { genericObjects: [{ id: objectId, classId }] },
    };

    const token = jwt.sign(claims, this.privateKey, { algorithm: 'RS256' });
    this.logger.info('google_wallet.url_issued', { userId, cardId });
    return `https://pay.google.com/gp/v/save/${token}`;
  }

  /** Creates or fully replaces the Pass Object — called on card edit/archive. */
  async syncPassObject(cardId: string): Promise<void> {
    if (!this.cfg) return;

    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: {
        id: true, name: true, headline: true, publicToken: true,
        archivedAt: true, groundHex: true, paletteId: true, templateId: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!card) return;
    await this.upsertPassObject(card);
    this.logger.info('google_wallet.pass_synced', { cardId });
  }

  private async upsertPassClass(): Promise<void> {
    const classId = `${this.cfg!.issuerId}.${this.cfg!.classSuffix}`;
    const client = await this.auth.getClient();
    const url = `${WALLET_API}/genericClass/${encodeURIComponent(classId)}`;
    try {
      await (client as any).request({ url, method: 'GET' });
    } catch (err: any) {
      if (err?.response?.status !== 404) throw err;
      // Class doesn't exist yet — create it
      await (client as any).request({
        url: `${WALLET_API}/genericClass`,
        method: 'POST',
        data: {
          id: classId,
          classTemplateInfo: {
            cardTemplateOverride: {
              cardRowTemplateInfos: [
                { twoItems: { startItem: { firstValue: { fields: [{ fieldPath: 'object.textModulesData["headline"]' }] } }, endItem: { firstValue: { fields: [{ fieldPath: 'object.textModulesData["card"]' }] } } } },
              ],
            },
          },
        },
      });
    }
  }

  private async upsertPassObject(card: {
    id: string; name: string; headline: string | null; publicToken: string;
    archivedAt: Date | null; groundHex: string | null;
    user: { firstName: string | null; lastName: string | null };
  }): Promise<void> {
    const objectId = `${this.cfg!.issuerId}.${card.id}`;
    const classId = `${this.cfg!.issuerId}.${this.cfg!.classSuffix}`;
    const ownerName = [card.user.firstName, card.user.lastName].filter(Boolean).join(' ');
    const shareUrl = `${this.config.shareBaseUrl}/c/${card.publicToken}`;

    const passObject = {
      id: objectId,
      classId,
      genericType: 'GENERIC_OTHER',
      state: card.archivedAt ? 'EXPIRED' : 'ACTIVE',
      header: ownerName || card.name,
      subheader: card.headline ?? '',
      cardTitle: { defaultValue: { language: 'en-US', value: card.name } },
      hexBackgroundColor: card.groundHex ?? '#1a1a1a',
      barcode: {
        type: 'QR_CODE',
        value: shareUrl,
        alternateText: 'Scan to open card',
      },
      textModulesData: [
        { id: 'headline', header: 'TITLE', body: card.headline ?? '' },
        { id: 'card', header: 'CARD', body: card.name },
        { id: 'link', header: 'CARD LINK', body: shareUrl },
      ],
    };

    const client = await this.auth.getClient();
    const url = `${WALLET_API}/genericObject/${encodeURIComponent(objectId)}`;

    try {
      await (client as any).request({ url, method: 'PUT', data: passObject });
    } catch (err: any) {
      if (err?.response?.status !== 404) throw err;
      await (client as any).request({ url: `${WALLET_API}/genericObject`, method: 'POST', data: passObject });
    }
  }
}
```

### 1.6 Controller

`apps/api/src/google-wallet/google-wallet.controller.ts`:

```typescript
@ApiTags('wallet')
@Controller('cards')
@UseGuards(JwtAuthGuard)
export class GoogleWalletController {
  constructor(private readonly googleWallet: GoogleWalletService) {}

  @Get(':id/google-wallet-pass')
  @ApiOperation({ summary: 'Returns a Save to Google Wallet URL for the caller\'s card.' })
  @ApiResponse({ status: 200, schema: { properties: { url: { type: 'string', example: 'https://pay.google.com/gp/v/save/...' } } } })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto, description: 'GOOGLE_WALLET_NOT_CONFIGURED' })
  async getSaveUrl(
    @Param('id') cardId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ url: string }> {
    const url = await this.googleWallet.getSaveUrl(req.user!.id, cardId);
    return { url };
  }
}
```

**Key difference from Apple:** returns JSON `{ url }`, not binary. FE fetches this and redirects.

### 1.7 Outbox integration

Add `google_wallet_push` outbox kind. In `CardsService.update()` and `CardsService.archive()`, enqueue alongside the existing `wallet_push`:

```typescript
await this.outbox.enqueue(tx, {
  dedupeKey: `google-wallet-push:${id}:${updated.updatedAt.getTime()}`,
  kind: 'google_wallet_push',
  payload: { cardId: id },
});
```

Register the handler in `GoogleWalletModule.onModuleInit()`:

```typescript
this.registry.register('google_wallet_push', async (payload) => {
  const { cardId } = payload as { cardId: string };
  await this.googleWallet.syncPassObject(cardId);
});
```

### 1.8 Module

```typescript
@Module({
  imports: [AuthModule],
  controllers: [GoogleWalletController],
  providers: [GoogleWalletService],
  exports: [GoogleWalletService],
})
export class GoogleWalletModule implements OnModuleInit { ... }
```

Add `GoogleWalletModule` to `app.module.ts` imports.

### 1.9 No Prisma migration needed

Unlike Apple Wallet there is no device registration table. Google handles propagation server-side. No new Prisma model required.

---

## Phase 2 — Frontend

### 2.1 Android detection

```tsx
export function detectAndroid(nav: Pick<Navigator, 'userAgent'>): boolean {
  return /Android/i.test(nav.userAgent);
}
```

**Note:** Unlike Apple Wallet's iPad/iPadOS detection complexity, Android detection is straightforward. Show the button only on Android — desktop/iOS gets nothing (or the disabled "coming soon" state).

### 2.2 The button — fetch then redirect

Unlike Apple Wallet (which requires a direct link), Google Wallet requires a **fetch + redirect**. The endpoint returns JSON `{ url }`, not binary data.

```tsx
export function GoogleWalletButton({ cardId }: { cardId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch(`/api/cb/cards/${encodeURIComponent(cardId)}/google-wallet-pass`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!res.ok) return; // 409 = not configured — silently do nothing
      const { url } = await res.json() as { url: string };
      window.location.assign(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleSave} disabled={loading}>
      <img src="/save-to-google-wallet.svg" alt="Save to Google Wallet" height={44} />
    </button>
  );
}
```

### 2.3 Google's official badge

Download from: https://developers.google.com/wallet/generic/resources/logos
- Available in SVG, PNG, light/dark variants
- Minimum 44pt height, unmodified
- Place at `apps/web/public/save-to-google-wallet.svg`

### 2.4 Placement in WalletActions

Add inside `wallet-actions.tsx` next to the Apple button. Android detection mirrors iOS detection:

```tsx
const [isAndroid, setIsAndroid] = useState<boolean | null>(null);

useEffect(() => {
  setIsAndroid(detectAndroid(navigator));
}, []);

{isAndroid ? (
  <GoogleWalletButton cardId={cardId} />
) : (
  <Button variant="secondary" disabled data-wallet-add="google" className="justify-start">
    <Wallet aria-hidden size={16} />
    Add to Google Wallet
  </Button>
)}
```

### 2.5 Error handling

| Response | What to do |
|---|---|
| `200 { url }` | `window.location.assign(url)` |
| `409 GOOGLE_WALLET_NOT_CONFIGURED` | Hide button or show disabled state — never toast |
| `404` | Shouldn't happen if button only shown for owner's cards |
| `401` | Standard re-login flow |

---

## Env vars to add to deploy pipeline

Add to `scripts/render-api-env.sh` and `.github/workflows/deploy.yml` (same pattern as WALLET_*):

```
GOOGLE_WALLET_ISSUER_ID=
GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL=
GOOGLE_WALLET_SERVICE_ACCOUNT_KEY_B64=   # base64 of the private key PEM
GOOGLE_WALLET_CLASS_SUFFIX=card
```

The service account JSON key file from Google Cloud contains both `client_email` and `private_key`. Extract and base64-encode the private key:
```bash
cat key.json | jq -r '.private_key' | base64
cat key.json | jq -r '.client_email'
```

---

## Key differences from Apple Wallet implementation

| | Apple Wallet | Google Wallet |
|---|---|---|
| **Endpoint response** | Binary `.pkpass` (`application/vnd.apple.pkpass`) | JSON `{ url: string }` |
| **FE button** | `<a href>` direct link (never fetch) | `fetch` then `window.location.assign(url)` |
| **Platform** | iPhone/iPad only | Android only |
| **Pass updates** | `wallet_push` outbox → APNs → device fetches new file | `google_wallet_push` outbox → REST `PUT` to Google API |
| **Device registration** | `WalletRegistration` DB table, 5 web service endpoints | **None** |
| **Prisma migration** | Required | **Not required** |
| **Server-exposed endpoints** | 5 Apple PassKit endpoints | **None** |
| **Credentials** | 3 x509 certs + team ID + passphrase | 1 service account JSON key |
| **Production gating** | Works immediately with valid certs | Demo mode until Google approves |

---

## Gotchas

1. **JWT size limit**: Keep under ~1800 chars. Pre-create the Pass Object via REST before signing the JWT and only embed `{ id }` — never inline full pass data into the JWT.
2. **`PUT` not `PATCH` for upsert**: Use `PUT` to replace the object fully on update (avoids stale field merging). Catch 404 on `PUT` and fall back to `POST`.
3. **Class must exist before Object**: Create the Pass Class once at `onModuleInit`. Without it, object creation returns 404.
4. **`origins` in JWT claims**: Must include your web app's domain (`shareBaseUrl`). Without it Google rejects the save request.
5. **State = EXPIRED for archives**: Setting `state: 'EXPIRED'` is the Google equivalent of Apple's `voided: true`. The pass stays visible in Wallet but shows as expired.
6. **Production approval**: Submit for approval at pay.google.com/business/console before going live. Approval takes days. Start early.
7. **`ProfileField.value` never in pass data**: Same constraint as Apple — the pass carries only owner name, card name, headline, and QR link. No field values, no phone numbers.
