# ContactBook

This repository contains **ContactBook**: a pnpm workspace with **Next.js** (`apps/web`) and **NestJS** (`apps/api`) for syncing contacts via web and WhatsApp. **Postgres** is expected to be available locally via **[Supabase CLI](https://supabase.com/docs/guides/cli)** (`supabase start`) or any other host; Prisma maps tables to the default **`public`** schema. A minimal **Docker Compose** file can run the API container against that same database.

## Local dev ports (defaults)

| App | Dev (default scripts) | Production |
|-----|------------------------|------------|
| Web | **3002** (`pnpm --filter web dev`) | **3000** (`next start`) |
| API | **8001** (`PORT` unset and `NODE_ENV` not `production`) | **8000** (Docker image sets `NODE_ENV=production`) |

Copy [`apps/api/.env.example`](apps/api/.env.example) and [`apps/web/.env.example`](apps/web/.env.example); they match these ports.

---

# Stack overview

pnpm workspace for **ContactBook**: **Next.js 16** (App Router, React 19, Tailwind v4, shadcn base-nova), **NestJS 11** (Swagger, CORS, URI versioning, ValidationPipe), **Prisma 7** with **PostgreSQL** via `@prisma/adapter-pg`, and shared packages **`@repo/types`** / **`@repo/utils`**.

## Primary keys (UUID)

Entity tables use **UUID** string primary keys (`@id @default(uuid())` in Prisma). The **`ContactCardTag`** join table uses a **composite primary key** `(contactCardId, tagId)` (both UUIDs). Google `calendarEventId` and similar external ids are stored as strings, not necessarily UUIDs.

## Supabase (local CLI)

Start your global / linked Supabase stack, then point `DATABASE_URL` at the **database** URL (default Postgres port **54322**):

| Tool    | URL (typical local defaults) |
|--------|---------------------------------|
| Studio | http://127.0.0.1:54323        |
| API    | http://127.0.0.1:54321        |
| DB     | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

Copy **Publishable** / anon and **Secret** keys from `supabase status` into local `.env` files only — never commit real keys. [`apps/web/.env.example`](apps/web/.env.example) lists `NEXT_PUBLIC_SUPABASE_*` for the web app when you use `@supabase/supabase-js`.

## Requirements

- Node.js 20+
- pnpm 10+
- PostgreSQL reachable via `DATABASE_URL` (local Supabase, Neon, RDS, etc.)

## Quick start (host)

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env if your Postgres URL differs from local Supabase (54322)

pnpm --filter api prisma:migrate
pnpm dev
```

**Note:** After this change, run `pnpm --filter api prisma migrate reset` on local databases that had the **`contactbook`** schema migration (or reconcile `_prisma_migrations` if you cannot reset). You can drop the old schema with `DROP SCHEMA IF EXISTS contactbook CASCADE;` once data is migrated or discarded.

- Web (dev): [http://localhost:3002](http://localhost:3002) — try [http://localhost:3002/auth](http://localhost:3002/auth) for the WhatsApp OTP sign-in / registration flow (country + phone, then OTP; new users need email).
- API health (dev): [http://localhost:8001/api/v1/health](http://localhost:8001/api/v1/health)
- Swagger (dev): [http://localhost:8001/api/docs](http://localhost:8001/api/docs)

Optional web env:

```bash
cp apps/web/.env.example apps/web/.env
```

## Scripts

| Command        | Description                          |
| -------------- | ------------------------------------ |
| `pnpm dev`     | Run `web` and `api` in parallel      |
| `pnpm build`   | Build all packages                   |
| `pnpm lint`    | Lint all packages                    |

API-only Prisma:

```bash
pnpm --filter api prisma:generate
pnpm --filter api prisma:migrate   # create migrations in dev
pnpm --filter api prisma:push      # push schema (prototyping)
pnpm --filter api prisma:studio    | UI for data
```

## Docker (API only)

Compose does **not** start Supabase; run `supabase start` (or your Postgres) first. Then:

```bash
cp docker/.env.example docker/.env
# Default example targets local Supabase Postgres on 127.0.0.1:54322

docker compose -f docker/docker-compose.yml up --build
```

Host port **8001** maps to the container’s **8000**. CORS in compose includes `localhost:3002` for the default web dev port.

**Makefile** (optional): `make up` uses [docker/docker-compose.yml](docker/docker-compose.yml).

**Production-style API image** (uses root `pnpm-lock.yaml`):

```bash
docker build -f apps/api/Dockerfile -t contactbook-api .
```

## Optional Supabase client (web)

`@supabase/supabase-js` is included in `apps/web` for client-side Auth. Add `NEXT_PUBLIC_SUPABASE_*` in `apps/web/.env` when you wire it.

Google OAuth (Supabase → API linking):

- **Redirect URL**: add `http://localhost:3002/auth/callback` (and your production equivalent) to Supabase Auth Redirect URLs.
- **Offline refresh**: include `queryParams: { access_type: 'offline', prompt: 'consent' }` so Google returns a refresh token.
- **Scopes**: request Google scopes needed by the API integrations:
  - `https://www.googleapis.com/auth/contacts.readonly`
  - `https://www.googleapis.com/auth/calendar.readonly`

The callback route exchanges the code for a Supabase session, then forwards Google `provider_token` / `provider_refresh_token` to `POST /api/v1/integrations/google/link-provider` for the currently logged-in ContactBook user. Tokens are encrypted at rest in `oauth_accounts` (set `OAUTH_TOKEN_ENCRYPTION_KEY_BASE64` in the API env; generate with `openssl rand -base64 32`). After a successful link, the callback signs out the Supabase session so only ContactBook JWTs remain active.

**Note:** Existing plaintext Google tokens in the database cannot be read after enabling encryption; users must re-link Google once.

## shadcn components

The stack includes `shadcn` CLI and [apps/web/components.json](apps/web/components.json). Add UI primitives as needed:

```bash
pnpm --filter web exec shadcn add button
```

## Shared packages

`apps/web` and `apps/api` depend on `@repo/types` and `@repo/utils` via `workspace:*`. Next transpiles them via [apps/web/next.config.ts](apps/web/next.config.ts).

## CI

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs when `apps/api/**`, `packages/**`, `scripts/**`, or monorepo install roots change; it decodes repository secret **`API_ENV_B64`** (base64 of a full `apps/api/.env` matching [.env.example](apps/api/.env.example)) into `apps/api/.env`, installs with a pnpm filter for **api**, then Prisma generate, build, unit tests, and (on push to `main`/`dev`) a Docker build that passes that file as BuildKit secret **`api_env`**. **ESLint is not run in CI**; run **[scripts/validate-api.sh](scripts/validate-api.sh)** locally (`pnpm validate:api` from the repo root) before you push. Optional secret **`API_ENV_CI_B64`**, when set, is used instead of `API_ENV_B64` in CI (e.g. a non-production database URL). Encode a local env file for GitHub: [scripts/encode-env-for-gh.sh](scripts/encode-env-for-gh.sh).

### API GitHub Releases

After a successful **CI** run on a **push** to **`main`** that changes files under **`apps/api/`**, [.github/workflows/release-api.yml](.github/workflows/release-api.yml) creates a **GitHub Release** titled `Contactbook API v<version>`. The git tag is **`api-v<version>`** (for example `api-v0.1.42`) so it does **not** become the newest `v*` tag used by `git describe` for Docker image versioning. Release notes list commits touching **`apps/api/`** since the previous `api-v*` tag (or the last 50 such commits if none). Releases are skipped if that tag already exists (idempotent re-runs).
