---
name: contactbook-architecture
description: Architecture reference for ContactBook's dynamic card-sharing system — share links, live profile resolution, per-recipient revocation, WhatsApp delivery via Twilio, the Postgres outbox and Cloud Tasks, observability, and the v1 sprint plan. Load this before designing, implementing, reviewing or estimating any work on cards, share links, recipients, broadcasts, QR scan codes, WhatsApp messaging, webhooks, the public profile page, or the outbox and job runtime. Also load it when a change touches the Prisma schema, so new models stay consistent with the documented data model.
---

# ContactBook architecture

## Where the detail lives

The design docs are in `docs/architecture/`, which is **deliberately gitignored** — they exist
on the maintainer's machine, not in the repository. On a fresh clone those files will be absent
and the table below will not resolve. The invariants and conventions in this file are the
committed source of truth; treat the docs as the expanded version when they are present.

Read the one that matches the work rather than all six.

| Working on… | Read |
| --- | --- |
| Anything, first time in the repo | [README.md](../../../docs/architecture/README.md) — decision log, confirmed constraints, open questions |
| System shape, a new flow, deployment | [hld.md](../../../docs/architecture/hld.md) |
| Schema, endpoints, state machines, the resolver | [lld.md](../../../docs/architecture/lld.md) |
| Sending, retries, webhooks, the outbox, failures | [messaging-reliability.md](../../../docs/architecture/messaging-reliability.md) |
| Logging, metrics, alerts, the audit log | [observability.md](../../../docs/architecture/observability.md) |
| GCP resources, Terraform, deploy runbook | [iac.md](../../../docs/architecture/iac.md) |
| Estimating, scoping, "can we fit X" | [sprint-plan.md](../../../docs/architecture/sprint-plan.md) |
| Building the public share page in `apps/web` | the `contactbook-share-page` skill |

## The invariants

Violating any of these breaks the product's core promise. Check them in every review.

**1. A share link is stable per (card, contact).**
`ShareLink` is unique on `(cardId, contactId)`. Sharing the same card to the same person
again must return the *existing* token. Never mint a second link for a pair that already has
one — the entire "resend the link and the update shows up" behaviour depends on this.
(`Contact` was named `Recipient` before 2026-08-23 — renamed to match product usage.)

**2. Nothing renders from a snapshot.**
The public page and the vCard both resolve from current data at request time. No cached HTML,
no pre-generated files, no denormalized copies of field values outside `CardVersion` (which is
an audit record and is never served to recipients).

**3. Outbound side effects go through the outbox, inside the transaction.**
Never call Twilio from a request handler or from inside `$transaction`. Write an
`OutboxMessage` in the same transaction as the domain change; enqueue the Cloud Task after
commit, best-effort.

**4. Every `@Cron` takes a Postgres advisory lock.**
In-process cron is fine on a single VM, but `@nestjs/schedule` does not prevent a job
overlapping itself and `docker compose up -d` briefly runs two containers. Wrap each job in
`pg_try_advisory_lock`, release in `finally`, skip the run if not acquired.

**4b. Postgres is Supabase, reached through the Supavisor pooler.**
`DATABASE_URL` is the transaction pooler on `:6543` with `pgbouncer=true&connection_limit=1`;
`DIRECT_URL` is session mode on `:5432` and is used only by `prisma migrate`. Omitting
`pgbouncer=true` produces `prepared statement already exists` failures that appear only under
production concurrency.

**5. Field values never reach logs, diffs, or audit metadata.**
`ProfileField.value` is the user's actual contact data. Log field ids and labels; never values.
Phone numbers go through `maskPhone()`.

**6. Financial field values are encrypted at rest.**
`BANK_ACCOUNT`, `DIGITAL_WALLET`, `CRYPTO_WALLET` — AES-256-GCM via
`src/crypto/field-encryption.util.ts`, AAD bound to `userId:fieldId:type` so a ciphertext
copied onto a different row fails to decrypt instead of silently succeeding. `type` is
immutable after a field is created for exactly this reason — changing it would strand a value
under the wrong encryption treatment.

**7. `phoneE164` is never a writable profile input, and onboarding is one-shot.**
It is the OTP-verified identity, not data the owner types in — no DTO (onboarding, profile
field, or otherwise) accepts it, and `ValidationPipe`'s `forbidNonWhitelisted` is what actually
enforces that at the API boundary, not just convention. `POST /profile/onboarding` is gated by
`User.profileOnboardingCompletedAt`: it runs once and returns `409 ONBOARDING_ALREADY_COMPLETED`
on replay. Later edits — adding a business, a bank account, a phone number — go through the
field and group endpoints, never by resubmitting onboarding.

## Conventions

- NestJS modules are domain-shaped (`sharing/`, `broadcast/`, `contacts/`), not layer-shaped.
- Prisma types stop at the repository boundary — never in a controller signature.
- One global `APP_FILTER` exception filter; the error envelope always carries `requestId`.
- `process.env` is read only by the zod-validated config module, which fails the boot on a
  missing required var.
- Log messages are dotted event names (`broadcast.enqueued`), with detail in structured fields.
- Tests are a merge gate. `--passWithNoTests` is banned; the previous codebase shipped to
  production for months on a vacuously green test job.

## Prior implementation

The pre-rebuild tree at `git show 761c3f5:<path>` is a useful reference for Twilio mechanics
and vCard MIME quirks. Two cautions:

- Its known weaknesses are catalogued throughout these docs as "the previous implementation…".
  Do not copy patterns forward without checking whether the docs call them out.
- **It contains committed credentials** — a Meta app secret and verify token in
  `apps/api/.env.example` and hardcoded in `whatsapp-cloud.controller.ts`, plus real phone
  numbers. Never copy an `.env.example` forward from that tree.
