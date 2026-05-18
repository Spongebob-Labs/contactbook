# ContactBook

This repository contains **ContactBook**: a pnpm workspace with **Vite + React** (`apps/web`) and **NestJS** (`apps/api`) for syncing contacts via web and WhatsApp. **Postgres** is expected to be available locally via **[Supabase CLI](https://supabase.com/docs/guides/cli)** (`supabase start`) or any other host; Prisma maps tables to the default **`public`** schema. A minimal **Docker Compose** file can run the API container against that same database.

## Local dev ports (defaults)

| App | Dev (default scripts) | Production |
|-----|------------------------|------------|
| Web | **5173** (`pnpm --filter web dev`) | Static build in `apps/web/dist` |
| API | **8001** (`PORT` unset and `NODE_ENV` not `production`) | **8000** (Docker image sets `NODE_ENV=production`) |

Copy [`apps/api/.env.example`](apps/api/.env.example) and [`apps/web/.env.example`](apps/web/.env.example); they match these ports.

---

# Stack overview

pnpm workspace for **ContactBook**: **Vite + React 19** (React Router, Tailwind v4, shadcn components), **NestJS 11** (Swagger, CORS, URI versioning, ValidationPipe), **Prisma 7** with **PostgreSQL** via `@prisma/adapter-pg`, and shared packages **`@repo/types`** / **`@repo/utils`**.

## Primary keys (UUID)

Entity tables use **UUID** string primary keys (`@id @default(uuid())` in Prisma). The **`ContactCardTag`** join table uses a **composite primary key** `(contactCardId, tagId)` (both UUIDs). Google `calendarEventId` and similar external ids are stored as strings, not necessarily UUIDs.

## Supabase (local CLI)

Start your global / linked Supabase stack, then point `DATABASE_URL` at the **database** URL (default Postgres port **54322**):

| Tool    | URL (typical local defaults) |
|--------|---------------------------------|
| Studio | http://127.0.0.1:54323        |
| API    | http://127.0.0.1:54321        |
| DB     | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

Copy **Publishable** / anon and **Secret** keys from `supabase status` into local `.env` files only — never commit real keys. [`apps/web/.env.example`](apps/web/.env.example) lists `VITE_SUPABASE_*` for the web app when you use `@supabase/supabase-js`.

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

- Web (dev): [http://localhost:5173](http://localhost:5173) — try [http://localhost:5173/auth](http://localhost:5173/auth) for the WhatsApp OTP sign-in / registration flow (country + phone, then OTP; new users need email).
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

Host port **8001** maps to the container’s **8000**. CORS in compose includes `localhost:5173` for the default web dev port.

**Makefile** (optional): `make up` uses [docker/docker-compose.yml](docker/docker-compose.yml).

**Production-style API image** (uses root `pnpm-lock.yaml`):

```bash
docker build -f apps/api/Dockerfile -t contactbook-api .
```

## Optional Supabase client (web)

`@supabase/supabase-js` is included in `apps/web` for client-side Auth. Add `VITE_SUPABASE_*` in `apps/web/.env` when you wire it.

## Google contact import

Google contact import uses the API-owned OAuth flow:

1. The web app calls `GET /api/v1/integrations/google/oauth-url` from `/dashboard/import`.
2. The browser redirects to Google consent.
3. Google redirects to `GOOGLE_REDIRECT_URI`.
4. The API stores Google tokens for the signed-in ContactBook user.
5. The API redirects back to `${WEB_APP_URL}/dashboard/import?google=connected`.
6. The web app calls `GET /api/v1/integrations/google/sync` to import contacts.

Local API env:

```bash
WEB_APP_URL="http://localhost:5173"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:8001/api/v1/integrations/google/callback"
```

Google Cloud setup:

- Enable the People API for the Google Cloud project.
- Configure the OAuth consent screen and include the contact import scopes.
- Add this authorized redirect URI for local dev:
  `http://localhost:8001/api/v1/integrations/google/callback`
- Add the production API callback URL before deploying production Google import.

The API requests:

- `https://www.googleapis.com/auth/contacts.readonly`
- `https://www.googleapis.com/auth/calendar.readonly`

Legacy Supabase Google OAuth notes, if you choose to re-enable browser-owned provider linking later:

- **Redirect URL**: add `http://localhost:5173/auth/callback` (and your production equivalent) to Supabase Auth Redirect URLs.
- **Offline refresh**: include `queryParams: { access_type: 'offline', prompt: 'consent' }` so Google returns a refresh token.
- **Scopes**: request Google scopes needed by the API integrations:
  - `https://www.googleapis.com/auth/contacts.readonly`
  - `https://www.googleapis.com/auth/calendar.readonly`

The callback route exchanges the code for a Supabase session, then forwards Google `provider_token` / `provider_refresh_token` to the API endpoint `POST /api/v1/integrations/google/link-provider` for the currently logged-in ContactBook user.

## shadcn components

The stack includes `shadcn` CLI and [apps/web/components.json](apps/web/components.json). Add UI primitives as needed:

```bash
pnpm --filter web exec shadcn add button
```

## Shared packages

`apps/web` and `apps/api` depend on `@repo/types` and `@repo/utils` via `workspace:*`. Vite resolves the shared package source through [apps/web/vite.config.ts](apps/web/vite.config.ts).

## CI

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs when `apps/api/**`, `packages/**`, or monorepo install roots change; it installs with a pnpm filter for **api**, then Prisma generate, lint, build, and unit tests for **api** only. `DATABASE_URL` in CI is a placeholder for Prisma tooling only (no database service is started).
