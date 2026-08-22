# ContactBook

pnpm monorepo. `apps/web` (Next.js 16, App Router) + `apps/api` (NestJS 11, Prisma, Postgres),
with shared `packages/types` and `packages/utils`.

Deploys across three vendors: the **`contactbook-server` GCE VM** (Docker + Caddy) with
**Cloud Tasks** for outbound message dispatch, **Supabase** (Postgres — connect via the
Supavisor pooler, never directly, except for migrations), and **Vercel** (web). Secrets are
GitHub Actions secrets rendered to a `.env` on the VM. Terraform in `iac/` manages the small
GCP surface; the VM is referenced read-only, not imported.

The system being built is documented in `docs/architecture/` (HLD, LLD, messaging reliability,
observability, IaC, sprint plan). **That directory is gitignored on purpose — it is not in the
repository.** If it is absent from your clone, the `contactbook-architecture` skill carries the
committed invariants and conventions; ask the maintainer for the docs themselves.

## What the product does

Users build **cards** — curated subsets of their profile fields. They share a card over
WhatsApp and the recipient gets a **link**, not a file. The link renders a view-only page from
live data, so an owner's edit reaches every recipient without sending anything, and revoking a
field removes it immediately.

## Non-negotiables

1. A `ShareLink` is unique on `(cardId, recipientId)` — re-sharing returns the same token.
2. The public page and vCard resolve from current data at request time. Never from a snapshot.
3. Outbound messaging goes through the Postgres outbox, written in the same transaction as the
   domain change. Never call Twilio from a request handler.
4. Every `@Cron` takes a Postgres advisory lock — `@nestjs/schedule` does not prevent a job
   overlapping itself, and a deploy briefly runs two containers.
5. `ProfileField.value` never appears in logs, diffs, or audit metadata.
6. `ProfileField.value` for `BANK_ACCOUNT`/`DIGITAL_WALLET`/`CRYPTO_WALLET` is encrypted at
   rest (AES-256-GCM, AAD bound to `userId:fieldId:type`) — never stored in the clear.
7. `phoneE164` is never a writable profile input — it's the OTP-verified identity, enforced by
   `forbidNonWhitelisted`, not just convention. `POST /profile/onboarding` is one-shot (409 on
   replay); later edits go through the field/group endpoints.

## Commands

```bash
pnpm dev          # web + api in parallel
pnpm dev:web      # http://localhost:3000
pnpm dev:api      # http://localhost:8000/api
pnpm build
pnpm lint
pnpm test
pnpm prisma:migrate
pnpm prisma:generate
```

## Conventions

- NestJS modules are domain-shaped (`sharing/`, `broadcast/`), not layer-shaped.
- Prisma types stop at the repository boundary — never in a controller signature.
- One global `APP_FILTER` exception filter; every error body carries `requestId`.
- `process.env` is read only by the zod-validated config module; a missing required var fails
  the boot, not the first request that needs it.
- Log dotted event names (`broadcast.enqueued`) with structured fields, never interpolated
  strings. Phone numbers go through `maskPhone()`.
- Tests gate merges. `--passWithNoTests` is banned.
- Every controller method gets Swagger docs: `@ApiOperation` describing behavior (not
  restating the name), one `@ApiResponse` per distinct status code, referencing the shared
  `ApiErrorResponseDto` for failures. Every DTO field gets `@ApiProperty` with a realistic
  `example`. Internal-only routes (`/internal/*`, `/health/*`) get `@ApiExcludeController()`.
  Served at `/api/docs`; on in dev by default, off in production unless `SWAGGER_ENABLED=true`.

## History

`git log` before `29c3fd1` is a previous, much larger implementation that was deliberately
deleted. It is a useful reference (`git show 761c3f5:<path>`) but **contains committed
credentials** — a Meta app secret and verify token, plus real phone numbers. Never copy an
`.env.example` forward from it.
