# ContactBook

pnpm monorepo. `apps/web` (Next.js 16, App Router) + `apps/api` (NestJS 11, Prisma, Postgres),
with shared `packages/types` and `packages/utils`.

Deploys across three vendors: the **`contactbook-server` GCE VM** (Docker + Caddy) with
**Cloud Tasks** for outbound message dispatch, **Supabase** (Postgres — connect via the
Supavisor pooler, never directly, except for migrations), and **Vercel** (web). Secrets are
GitHub Actions secrets rendered to a `.env` on the VM. Terraform in `iac/` manages the small
GCP surface; the VM is referenced read-only, not imported.

The tree is currently a bare scaffold. The system being built is documented in
**[docs/architecture/](docs/architecture/README.md)** — read that before writing feature code.
The `contactbook-architecture` skill summarises the invariants and points at the right doc for
a given task.

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

## History

`git log` before `29c3fd1` is a previous, much larger implementation that was deliberately
deleted. It is a useful reference (`git show 761c3f5:<path>`) but **contains committed
credentials** — a Meta app secret and verify token, plus real phone numbers. Never copy an
`.env.example` forward from it.
