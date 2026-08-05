# Frontend API Integration Test Audit — Delivery Log

Generated: 2026-08-03

## Commands

```bash
# Unit + integration (mocked network)
pnpm test:web
# or: pnpm -C apps/web test

# Live smoke (default: production)
pnpm test:web:live
# or: pnpm -C apps/web test:live

# Live against UAT (while prod gateway is down)
VITE_API_URL=https://uat.api.getcontactbook.com/api pnpm -C apps/web test:live

# Protected GETs need a Bearer token
LIVE_ACCESS_TOKEN='…' pnpm -C apps/web test:live
```

Reports land in `apps/web/test-results/` (`live-api-report.md` / `.json`).

## Results summary

| Suite | Target | Result |
| --- | --- | --- |
| Unit + integration | local Vitest | **54/54 passed** |
| Live smoke | UAT (`uat.api.getcontactbook.com`) | **9/9 passed** (protected GETs skipped — no token) |
| Live smoke | Production (`api.getcontactbook.com`) | **FAIL** — Caddy returns **502** on `/api/v1/*` |

## Issues found and actions

### 1. Auth channel (web) — send / verify / register only

- Web clients use **only**:
  - `POST /v1/auth/otp/whatsapp/send`
  - `POST /v1/auth/otp/whatsapp/verify`
  - `POST /v1/auth/register`
- **Do not use** `request-code` / `verify-code` (outdated; not part of the shipping auth flow).
- An earlier audit experiment briefly pointed the web client at `request-code` / `verify-code`; that change has been **reverted**.

### 2. RESOLVED — Production API gateway 502 (not caused by frontend tests)

- **Symptom:** Caddy returned **502** for all routes (`/health`, OTP `OPTIONS`/`POST`, etc.).
- **Not caused by** the Vitest live suite (empty-body probes cannot stop the VM API).
- **Root cause:** Prod deploy that added `prisma migrate deploy` to container `CMD`, while the prod image has **no prisma CLI** (`pnpm deploy --prod`). Container exited → Caddy 502.
- **Recovery:** Re-ran known-good Deploy https://github.com/Spongebob-Labs/contactbook/actions/runs/30758124045 → health **200**, OTP OPTIONS **204**.
- **Permanent fix PR:** https://github.com/Spongebob-Labs/contactbook/pull/70 — merge so the next `main` deploy does not reintroduce the outage.

### 3. RISK — WhatsApp templates route missing on live API

- `GET /v1/whatsapp-templates` → **404** on UAT.
- Frontend still has [`whatsapp-templates-api.ts`](../src/lib/whatsapp-templates-api.ts) and dashboard page.
- Live suite tolerates 404; UI page will error until the API ships the route or the page is removed/hidden.

### 4. OK — Connections resend

- `POST /v1/connections/requests/:id/resend` → **401** without token on UAT (route exists; not 404).
- No frontend path change required.

### 5. SKIPPED — Protected production/UAT GETs

- `LIVE_ACCESS_TOKEN` was not provided.
- After prod recovers, re-run with a read-capable Bearer to verify:
  - `GET /v1/profile/me`
  - `GET /v1/contacts?page=1&limit=5`
  - `GET /v1/cards`
  - `GET /v1/connections`

## What was built (web only)

- Vitest + jsdom in `apps/web`
- Unit tests under `src/lib/__tests__/unit/`
- Integration (mocked fetch) under `src/lib/__tests__/integration/`
- Live smoke under `src/lib/__live__/prod-api.live.test.ts`
- Scripts: `test`, `test:unit`, `test:integration`, `test:live`; root `test:web` / `test:web:live`

## Explicit non-work

- No NestJS / `apps/api` test changes or runs (per scope).

## Delivery recommendation

1. **Production API restored** (health 200 after rollback deploy). Merge https://github.com/Spongebob-Labs/contactbook/pull/70 before the next API deploy.
2. Keep web auth on **send / verify / register** only — never call `request-code` / `verify-code`.
3. Decide on WhatsApp templates page (hide vs wait for API).
4. Provide `LIVE_ACCESS_TOKEN` and re-run protected live GETs for final sign-off.
5. Health may still report WhatsApp `degraded` — confirm Twilio/OpenWA config if OTP send returns a non-502 application error.
