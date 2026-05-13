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

`@supabase/supabase-js` is included in `apps/web` for future client work. Add `NEXT_PUBLIC_SUPABASE_*` in `apps/web/.env` when you wire it. Database access for the API is via Prisma and `DATABASE_URL` only.

## shadcn components

The stack includes `shadcn` CLI and [apps/web/components.json](apps/web/components.json). Add UI primitives as needed:

```bash
pnpm --filter web exec shadcn add button
```

## Shared packages

`apps/web` and `apps/api` depend on `@repo/types` and `@repo/utils` via `workspace:*`. Next transpiles them via [apps/web/next.config.ts](apps/web/next.config.ts).

## CI

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs install, Prisma generate, lint, build, and unit tests for **api**, and lint + build for **web**. `DATABASE_URL` in CI is a placeholder for Prisma tooling only (no database service is started).
