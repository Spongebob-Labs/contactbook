# ContactBook

This repository contains the **ContactBook** application: a pnpm monorepo with **Next.js** (`apps/web`) and **NestJS** (`apps/api`), copied from the internal monorepo template. Local Supabase and a production-style API container are configured under `docker/`.

### Local API + Supabase (Docker)

```bash
cd docker/supabase && supabase start
cd .. && docker compose up -d --build
```

- API (host): [http://127.0.0.1:8001/api/docs](http://127.0.0.1:8001/api/docs) (port **8001** avoids clashes with other stacks on **8000**)
- Ensure `docker/supabase/.env` defines `DATABASE_URL` and Supabase keys for the API container (see that file after `supabase start`).

---

# Monorepo (stack overview)

pnpm workspace using the same stack as the reference **alooofone** project (Next + Nest + Prisma + pnpm workspaces): **Next.js 16** (App Router, React 19, Tailwind v4, shadcn base-nova, Supabase client), **NestJS 11** (Swagger, CORS, URI versioning, ValidationPipe), **Prisma 7** with **PostgreSQL** via `@prisma/adapter-pg`, and shared packages **`@repo/types`** / **`@repo/utils`**.

## Requirements

- Node.js 20+
- pnpm 10+
- A PostgreSQL `DATABASE_URL` (Supabase, Neon, RDS, or local Postgres)

## Quick start (host)

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env and set DATABASE_URL

pnpm --filter api prisma:push
pnpm dev
```

- Web: [http://localhost:3000](http://localhost:3000)
- API health: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
- Swagger: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

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

## Docker

**Full dev stack** (bind-mounts repo, isolated `node_modules` volumes):

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Set DATABASE_URL in apps/api/.env

make up
```

Targets: `make up`, `make down`, `make logs`, `make prisma` (host `pnpm` against the DB), `make reset` (removes compose volumes).

**Production-style API image** (uses root `pnpm-lock.yaml`):

```bash
docker build -f apps/api/Dockerfile -t monorepo-api .
```

Compose file for a single API container: [docker/docker-compose.yml](docker/docker-compose.yml) (build context is the repo root; `dockerfile` is relative to that context).

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Supabase

- **Database**: point `DATABASE_URL` in `apps/api/.env` at your Supabase Postgres connection string (Prisma owns the schema; use migrations in production).
- **Auth / client**: `@supabase/supabase-js` is included in `apps/web`; add `NEXT_PUBLIC_SUPABASE_*` when you wire the client.

## shadcn components

The stack includes `shadcn` CLI and [apps/web/components.json](apps/web/components.json). Add UI primitives as needed:

```bash
pnpm --filter web exec shadcn add button
```

## Shared packages

`apps/web` and `apps/api` depend on `@repo/types` and `@repo/utils` via `workspace:*`. Next transpiles them via [apps/web/next.config.ts](apps/web/next.config.ts).

## CI

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs install, Prisma generate, lint, build, and unit tests for **api**, and lint + build for **web**. `DATABASE_URL` in CI is a placeholder for Prisma tooling only (no database service is started).
