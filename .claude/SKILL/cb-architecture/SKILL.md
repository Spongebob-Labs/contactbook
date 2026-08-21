---
name: contactbook-architecture
description: Architecture reference for ContactBook's dynamic card-sharing system — share links, live profile resolution, per-recipient revocation, WhatsApp delivery via Twilio, the Postgres outbox and Cloud Tasks, observability, and the v1 sprint plan. Load this before designing, implementing, reviewing or estimating any work on cards, share links, recipients, broadcasts, QR scan codes, WhatsApp messaging, webhooks, the public profile page, or the outbox and job runtime. Also load it when a change touches the Prisma schema, so new models stay consistent with the documented data model.
---

# ContactBook architecture

The design docs live in `docs/architecture/`. Read the one that matches the work rather than
all five.

| Working on… | Read |
| --- | --- |
| Anything, first time in the repo | [README.md](../../../docs/architecture/README.md) — decision log, confirmed constraints, open questions |
| System shape, a new flow, deployment | [hld.md](../../../docs/architecture/hld.md) |
| Schema, endpoints, state machines, the resolver | [lld.md](../../../docs/architecture/lld.md) |
| Sending, retries, webhooks, the outbox, failures | [messaging-reliability.md](../../../docs/architecture/messaging-reliability.md) |
| Logging, metrics, alerts, the audit log | [observability.md](../../../docs/architecture/observability.md) |
| Estimating, scoping, "can we fit X" | [sprint-plan.md](../../../docs/architecture/sprint-plan.md) |

## The five invariants

Violating any of these breaks the product's core promise. Check them in every review.

**1. A share link is stable per (card, recipient).**
`ShareLink` is unique on `(cardId, recipientId)`. Sharing the same card to the same person
again must return the *existing* token. Never mint a second link for a pair that already has
one — the entire "resend the link and the update shows up" behaviour depends on this.

**2. Nothing renders from a snapshot.**
The public page and the vCard both resolve from current data at request time. No cached HTML,
no pre-generated files, no denormalized copies of field values outside `CardVersion` (which is
an audit record and is never served to recipients).

**3. Outbound side effects go through the outbox, inside the transaction.**
Never call Twilio from a request handler or from inside `$transaction`. Write an
`OutboxMessage` in the same transaction as the domain change; enqueue the Cloud Task after
commit, best-effort.

**4. No in-process cron.**
Cloud Run runs many instances. `@Cron` runs once per instance with no locking. All scheduled
work is an HTTP endpoint invoked by Cloud Scheduler.

**5. Field values never reach logs, diffs, or audit metadata.**
`ProfileField.value` is the user's actual contact data. Log field ids and labels; never values.
Phone numbers go through `maskPhone()`.

## Conventions

- NestJS modules are domain-shaped (`sharing/`, `broadcast/`, `recipients/`), not layer-shaped.
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
